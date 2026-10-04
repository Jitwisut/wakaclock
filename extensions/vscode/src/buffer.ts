import type {
  Selection,
  TextDocument,
  TextDocumentContentChangeEvent,
  TextEditor
} from "vscode";
import { createHash } from "node:crypto";
import type { WakaclockCliService } from "./cli";
import { AiAttributionStore } from "./aiAttribution";
import { DocumentLineMeasurements, type LineMeasurement, type MeasurementDocument } from "./lineMeasurement";
import { Logger } from "./logging";
import type {
  ActivitySegment,
  ActorType,
  BufferedFileState,
  ClipboardCopyMetrics,
  ClipboardPasteMetrics,
  EditorObservationPayload,
  ExtraHeartbeatPayload,
  ExternalFileChangeMetadata,
  FlushOverrides,
  FlushReason,
  HeartbeatCategory,
  WakaclockConfigSnapshot
} from "./types";
import { appendSegment, MAX_ACTIVITY_GAP_MS, unionSeconds } from "./activity";
import { randomUUID } from "node:crypto";
import {
  getEditorEntity,
  getSelectionMetrics,
  isFileDocument,
  normalizeFsPath,
  summarizeTextChanges
} from "./utils";

/** Float timestamps survive a JSON round trip; compare interval edges with slack. */
const SEGMENT_MATCH_EPSILON_SECONDS = 0.001;

/**
 * Mirror `vscode.TextDocumentChangeReason`'s numeric values without importing the
 * real enum: this file only takes `vscode` types, not runtime values, so it stays
 * testable without a VS Code host. `events.ts` passes the real
 * `TextDocumentChangeEvent.reason` straight through — a numeric enum member is
 * structurally a `number`, so no cast is needed at that call site.
 */
const TEXT_DOCUMENT_CHANGE_REASON_UNDO = 1;
const TEXT_DOCUMENT_CHANGE_REASON_REDO = 2;

type HeartbeatSentHandler = () => void;
type ActivityHandler = () => void;

interface FlushSnapshot {
  payload: ExtraHeartbeatPayload;
  category: HeartbeatCategory;
  write: boolean;
  activitySegments: ActivitySegment[];
  activeSeconds: number;
  keystrokes: number;
  charsAdded: number;
  charsDeleted: number;
  humanLinesAdded: number;
  humanLinesDeleted: number;
  unattributedLinesAdded: number;
  unattributedLinesDeleted: number;
  copyActions: number;
  pasteActions: number;
  copiedChars: number;
  copiedLines: number;
  pastedChars: number;
  pastedLines: number;
  pasteSameFileActions: number;
  pasteSameWorkspaceActions: number;
  pasteExternalOrUnknownActions: number;
  pendingWrite: boolean;
  lastEditAt?: number;
  lastActivityAt?: number;
}

export class HeartbeatBufferManager {
  private readonly states = new Map<string, BufferedFileState>();
  private readonly lineMeasurements = new DocumentLineMeasurements();
  private readonly lastLineMeasurements = new Map<string, LineMeasurement>();

  /** Local diagnostics only: the legacy CLI cannot transport a versioned line metric. */
  public getLastLineMeasurement(entity: string): LineMeasurement | undefined {
    const measurement = this.lastLineMeasurements.get(normalizeFsPath(entity));
    return measurement ? { ...measurement } : undefined;
  }

  public forgetDocument(document: MeasurementDocument): void {
    this.lineMeasurements.forget(normalizeFsPath(document.uri.fsPath));
  }
  /**
   * One global activity cursor prevents two open files from claiming the same wall-clock
   * interval. WakaTime derives a mini-duration from each heartbeat to the next one; this
   * cursor provides the equivalent accounting while wakaclock still stores an explicit
   * `active_seconds` value on each heartbeat.
  */
  private lastObservedActivityAt?: number;
  private lastObservedEntity?: string;
  private flushTail: Promise<void> = Promise.resolve();
  /** Snapshots whose CLI request failed. They retain their original heartbeat ID. */
  private readonly retrySnapshots = new Map<string, FlushSnapshot[]>();

  public constructor(
    private readonly getConfig: () => WakaclockConfigSnapshot,
    private readonly cli: Pick<WakaclockCliService, "sendHeartbeat"> &
      Partial<Pick<WakaclockCliService, "sendEditorObservation" | "getEditorObservationStatus">>,
    private readonly logger: Logger,
    private readonly onHeartbeatSent?: HeartbeatSentHandler,
    private readonly aiAttributionStore: AiAttributionStore = new AiAttributionStore(),
    private readonly onActivity?: ActivityHandler
  ) {}

  public async recordTextChange(
    document: MeasurementDocument,
    changes: readonly (Pick<TextDocumentContentChangeEvent, "rangeLength" | "text"> & {
      range?: TextDocumentContentChangeEvent["range"];
    })[],
    selection?: Pick<Selection, "active">,
    now = Date.now(),
    project?: string,
    changeReason?: number,
    paste?: ClipboardPasteMetrics
  ): Promise<void> {
    if (!isFileDocument(document) || changes.length === 0) {
      return;
    }

    const entity = normalizeFsPath(document.uri.fsPath);
    const state = this.getOrCreateState(entity);
    this.updateProjectState(state, project);
    const summary = summarizeTextChanges(changes);

    // Captured before `observeActivity` moves the cursor: this is the start of the
    // interval this very edit is about to close, and the only thing an agent edit is
    // ever allowed to take back.
    const intervalStartAt = this.lastObservedActivityAt;
    this.observeActivity(state, now);
    state.heartbeatId ||= randomUUID();
    // Cross-file duration accounting may advance `lastActivityAt` on this state while
    // another file is edited. Attribution must use the actual editor-change timestamp,
    // otherwise a nearby AI sidecar event can fall outside the correlation window.
    state.lastEditAt = now;
    state.lastEditIntervalStartAt = intervalStartAt;
    // These are character volumes, never physical key presses or authorship evidence.
    state.charsAdded += summary.charsAdded;
    state.charsDeleted += summary.charsDeleted;
    this.lineMeasurements.change(entity, document,
      changeReason === TEXT_DOCUMENT_CHANGE_REASON_UNDO || changeReason === TEXT_DOCUMENT_CHANGE_REASON_REDO);
    if (paste && this.getConfig().trackClipboardActions) {
      state.pasteActions += 1;
      state.pastedChars += summary.charsAdded;
      state.pastedLines += summary.insertedTextLines;
      if (paste.origin === "same_file") state.pasteSameFileActions += 1;
      else if (paste.origin === "same_workspace") state.pasteSameWorkspaceActions += 1;
      else state.pasteExternalOrUnknownActions += 1;
    }
    if (state.pendingEditorChanges.length < 2) state.pendingEditorChanges.push({
      timeMs: now,
      linesAdded: 0,
      linesDeleted: 0,
      contentFingerprint: fingerprintDocument(document)
    });
    this.updateSelectionState(state, selection);

    this.onActivity?.();

    // WakaTime sends the first file-change heartbeat immediately. Subsequent
    // same-file heartbeats are rate limited to the configured network cadence;
    // the independent 15-second lease in `observeActivity` is the only duration
    // this editor can prove.
    if (
      (state.lastHeartbeatAt === undefined ||
        now - state.lastHeartbeatAt >= this.getConfig().heartbeatRateLimitMs) &&
      this.hasPendingActivity(state)
    ) {
      await this.flushFile(entity, "gap", { now });
    }
  }

  public async recordClipboardCopy(
    document: MeasurementDocument,
    metrics: ClipboardCopyMetrics,
    now = Date.now(),
    project?: string
  ): Promise<void> {
    if (!this.getConfig().trackClipboardActions || !isFileDocument(document)) {
      return;
    }
    const entity = normalizeFsPath(document.uri.fsPath);
    this.lineMeasurements.observe(entity, document);
    const state = this.getOrCreateState(entity);
    this.updateProjectState(state, project);
    this.observeActivity(state, now);
    state.heartbeatId ||= randomUUID();
    state.copyActions += 1;
    state.copiedChars += metrics.copiedChars;
    state.copiedLines += metrics.copiedLines;
    this.onActivity?.();
    if (
      state.lastHeartbeatAt === undefined ||
      now - state.lastHeartbeatAt >= this.getConfig().heartbeatRateLimitMs
    ) {
      await this.flushFile(entity, "gap", { now });
    }
  }

  public async recordSave(
    document: MeasurementDocument,
    now = Date.now(),
    project?: string
  ): Promise<void> {
    if (!isFileDocument(document)) {
      return;
    }

    const entity = normalizeFsPath(document.uri.fsPath);
    this.lineMeasurements.observe(entity, document);
    const state = this.getOrCreateState(entity);
    this.updateProjectState(state, project);
    this.observeActivity(state, now);
    state.heartbeatId ||= randomUUID();
    state.pendingWrite = true;
    this.onActivity?.();
    await this.flushFile(entity, "save", { now, write: true, force: true });
  }

  /**
   * Correlate an OS-level workspace write with the broker's native AI event. The
   * broker owns the attribution decision; this method only sends metadata and emits
   * the old unknown fallback if the observation window expires.
   */
  public async recordExternalFileChange(
    entity: string,
    metadata: ExternalFileChangeMetadata = {},
    now = Date.now(),
    project?: string,
    workspaceRoot?: string,
  ): Promise<void> {
    const normalizedEntity = normalizeFsPath(entity);
    const normalizedWorkspaceRoot = workspaceRoot ? normalizeFsPath(workspaceRoot) : undefined;
    if (!normalizedEntity) return;

    const sendObservation = this.cli.sendEditorObservation;
    const getObservationStatus = this.cli.getEditorObservationStatus;
    const observationId =
      metadata.event_id ??
      `observer:${createHash("sha256")
        .update(normalizedEntity)
        .update("\0")
        .update(metadata.change_kind ?? "modify")
        .update("\0")
        .update(metadata.content_fingerprint ?? String(now))
        .digest("hex")}`;

    if (sendObservation && getObservationStatus && normalizedWorkspaceRoot) {
      const observation: EditorObservationPayload = {
        schema_version: 1,
        observation_id: observationId,
        editor: "vscode",
        entity: normalizedEntity,
        workspace_root: normalizedWorkspaceRoot,
        occurred_at: new Date(now).toISOString(),
        change_kind: metadata.change_kind ?? "modify",
        previous_entity: metadata.previous_entity
          ? normalizeFsPath(metadata.previous_entity)
          : undefined,
        lines_added: metadata.lines_added,
        lines_deleted: metadata.lines_deleted,
        content_fingerprint: metadata.content_fingerprint,
      };
      try {
        let status = await sendObservation.call(this.cli, observation);
        if (status.status === "matched") return;
        const deadline = Date.now() + 15_000;
        while (status.status !== "expired" && Date.now() < deadline) {
          await wait(250);
          status = await getObservationStatus.call(this.cli, observationId);
          if (status.status === "matched") return;
        }
        if (status.status !== "expired") {
          this.logger.debug("editor observation window elapsed", {
            entity: normalizedEntity,
            observationId,
          });
        }
      } catch (error) {
        this.logger.debug("editor observation submission failed", {
          entity: normalizedEntity,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Older CLIs do not expose editor observations. Keep the sidecar fallback for
    // those installations and for a transient observation endpoint failure.
    let classification:
      | Awaited<ReturnType<AiAttributionStore["classify"]>>
      | undefined;
    const linesAdded = metadata.lines_added;
    const linesDeleted = metadata.lines_deleted;
    if (
      linesAdded !== undefined &&
      linesDeleted !== undefined &&
      (linesAdded > 0 || linesDeleted > 0)
    ) {
      try {
        classification = await this.aiAttributionStore.classify(
          normalizedEntity,
          now,
          linesAdded,
          linesDeleted,
          metadata.content_fingerprint,
        );
      } catch {
        // Sidecar reads are best effort. The file change itself still gets a
        // heartbeat below, with unknown authorship when identity cannot be proven.
      }
    }

    const matched = classification?.attribution === "ai" ? classification.event : undefined;
    if (matched) {
      // A native hook/transcript event already owns the durable AI heartbeat. The
      // filesystem receiver is only a recovery path for a missed producer event;
      // forwarding the same fingerprint a second time would double-count the write.
      this.logger.debug("skipped duplicate external file-change heartbeat", {
        entity: normalizedEntity,
        aiEventId: matched.event_id,
      });
      return;
    }
    const payload: ExtraHeartbeatPayload = {
      entity: normalizedEntity,
      time: now / 1000,
      entity_type: "file",
      alternate_project: project,
      category: "coding",
      write: true,
      active_seconds: 0,
      heartbeat_id: observationId,
      actor_type: "unknown",
      actor_confidence: 0,
      unattributed_lines_added: linesAdded,
      unattributed_lines_deleted: linesDeleted,
    };

    try {
      await this.cli.sendHeartbeat(normalizedEntity, true, "coding", [], payload);
      this.onHeartbeatSent?.();
      this.logger.debug("flushed external file-change heartbeat", {
        entity: normalizedEntity,
        changeKind: metadata.change_kind ?? "modify",
        attributed: Boolean(matched),
      });
    } catch (error) {
      this.logger.error(`failed to flush external heartbeat for ${normalizedEntity}`, {
        error,
      });
    }
  }

  public async recordEditorSwitch(
    previousEditor?: Pick<TextEditor, "document">,
    currentEditorOrNow?: Pick<TextEditor, "document" | "selection"> | number,
    now = Date.now(),
    project?: string,
  ): Promise<void> {
    const currentEditor =
      typeof currentEditorOrNow === "number" ? undefined : currentEditorOrNow;
    if (typeof currentEditorOrNow === "number") {
      now = currentEditorOrNow;
    }

    const previousEntity = getEditorEntity(previousEditor);
    if (previousEntity) {
      await this.flushFile(previousEntity, "switch", { now });
    }

    const currentEntity = getEditorEntity(currentEditor);
    if (currentEntity && currentEditor) this.lineMeasurements.observe(currentEntity, currentEditor.document);
    if (currentEntity && currentEntity !== previousEntity) {
      const state = this.getOrCreateState(currentEntity);
      this.updateProjectState(state, project);
      this.updateSelectionState(state, currentEditor?.selection);
      // A switch is an activity marker even when the file has no pending edits.
      await this.flushFile(currentEntity, "switch", { now, force: true });
      this.logger.debug("recorded active editor switch", {
        entity: state.entity,
        previousEntity
      });
    }
  }

  public updateCursor(
    document: MeasurementDocument,
    selection?: Pick<Selection, "active">,
    project?: string,
    now = Date.now()
  ): void {
    if (!isFileDocument(document)) {
      return;
    }
    const entity = normalizeFsPath(document.uri.fsPath);
    this.lineMeasurements.observe(entity, document);
    const state = this.getOrCreateState(entity);
    this.updateProjectState(state, project);
    this.updateSelectionState(state, selection);
    this.observeActivity(state, now);
    this.onActivity?.();
  }

  public async flushCurrentEditor(
    editor?: Pick<TextEditor, "document">,
    reason: FlushReason = "manual",
    overrides?: FlushOverrides,
    project?: string
  ): Promise<void> {
    const entity = getEditorEntity(editor);
    if (!entity) {
      return;
    }
    const state = this.getOrCreateState(entity);
    this.updateProjectState(state, project);
    await this.flushFile(entity, reason, { force: true, ...overrides });
  }

  public async flushDueBuffers(reason: FlushReason, now = Date.now()): Promise<void> {
    return this.enqueueFlush(() => this.flushDueBuffersInternal(reason, now));
  }

  /** Flush every measured or retryable snapshot before the extension host exits. */
  public async flushAllBuffers(reason: FlushReason = "shutdown", now = Date.now()): Promise<void> {
    return this.enqueueFlush(async () => {
      for (const entity of this.states.keys()) {
        await this.flushFileInternal(entity, reason, { now, force: true });
      }
    });
  }

  public getBufferedSeconds(now = Date.now()): number {
    void now;
    // Do not turn an idle clock into coding time. The duration is closed only by the
    // next editor activity event (or a save/switch), exactly like the persisted
    // `active_seconds` calculation. This keeps the status bar from climbing after the
    // user stops typing while still exposing every interval as soon as activity arrives.
    return unionSeconds(this.getBufferedSegments());
  }

  public getBufferedSegments(): ActivitySegment[] {
    const current = Array.from(this.states.values()).flatMap((state) =>
      state.activitySegments.map((segment) => ({ ...segment }))
    );
    const retries = Array.from(this.retrySnapshots.values()).flatMap((snapshots) =>
      snapshots.flatMap((snapshot) =>
        snapshot.activitySegments.map((segment) => ({ ...segment }))
      )
    );
    return [...current, ...retries];
  }

  private async flushDueBuffersInternal(reason: FlushReason, now: number): Promise<void> {
    // Keep each file's serialized snapshot independent. A failed request can then
    // retain its stable ID while another file continues accumulating activity; the
    // next pass may still use the CLI's bulk stdin path, but correctness no longer
    // depends on a cross-file all-or-nothing in-memory snapshot.
    for (const [entity, state] of this.states.entries()) {
      if (!this.shouldFlushOnTimer(state, now)) {
        continue;
      }
      await this.flushFileInternal(entity, reason, { now });
    }
  }

  public async flushFile(
    entity: string,
    reason: FlushReason,
    overrides: FlushOverrides = {}
  ): Promise<void> {
    return this.enqueueFlush(() => this.flushFileInternal(entity, reason, overrides));
  }

  private async flushFileInternal(
    entity: string,
    reason: FlushReason,
    overrides: FlushOverrides = {}
  ): Promise<void> {
    const state = this.states.get(entity);
    if (!state) {
      return;
    }

    const now = overrides.now ?? Date.now();
    const category = overrides.category ?? "coding";
    const write = overrides.write ?? state.pendingWrite;
    const force = overrides.force ?? false;
    const retries = this.retrySnapshots.get(entity) ?? [];

    // A second editor event can enqueue a flush while the first request is still in
    // flight. Re-check the cadence at execution time so that queued work remains in
    // the next 120-second snapshot instead of bypassing the rate limit after the first
    // request commits.
    if (
      !force &&
      reason === "gap" &&
      state.lastHeartbeatAt !== undefined &&
      now - state.lastHeartbeatAt < this.getConfig().heartbeatRateLimitMs
    ) {
      return;
    }

    if (!force && !this.hasPendingActivity(state) && retries.length === 0) {
      return;
    }

    try {
      const snapshots = [...retries];
      if (this.hasPendingActivity(state)) {
        // Detach before any sidecar I/O. Changes arriving during classification/send
        // belong to the next window and can never mutate a retry's counters.
        const captured: BufferedFileState = {
          ...state,
          activitySegments: state.activitySegments.map((segment) => ({ ...segment })),
          pendingEditorChanges: [...state.pendingEditorChanges]
        };
        const measurement = this.lineMeasurements.close(entity) ?? (captured.pendingEditorChanges.length > 0 ? {
          metricVersion: "editor-before-after-v1" as const,
          boundary: "flush" as const,
          status: "unavailable" as const,
          reason: "baseline_missing" as const,
          changeEvents: captured.pendingEditorChanges.length,
          containsReplay: false
        } : undefined);
        if (measurement) this.lastLineMeasurements.set(entity, measurement);
        this.clearMeasurements(state);
        const matchedAiOperation = await this.classifyPendingAttribution(captured, now, measurement);
        if (this.hasPendingActivity(captured)) {
          snapshots.push(this.captureSnapshot(captured, category, write, measurement, matchedAiOperation));
        }
      }
      if (snapshots.length === 0) {
        return;
      }
      this.retrySnapshots.delete(entity);
      const [primary, ...rest] = snapshots;
      try {
        await this.cli.sendHeartbeat(
          entity,
          primary.write,
          primary.category,
          rest.map((snapshot) => snapshot.payload),
          primary.payload
        );
      } catch (error) {
        this.retrySnapshots.set(entity, snapshots);
        throw error;
      }
      this.commitSnapshot(entity, now, snapshots[snapshots.length - 1]);
      this.onHeartbeatSent?.();
      this.logger.debug("flushed heartbeat", {
        entity,
        reason,
        category,
        write,
        snapshots: snapshots.length
      });
    } catch (error) {
      this.logger.error(`failed to flush heartbeat for ${entity}`, { reason, error });
    }
  }

  private getOrCreateState(entity: string): BufferedFileState {
    const existing = this.states.get(entity);
    if (existing) {
      return existing;
    }

    const created: BufferedFileState = {
      entity,
      heartbeatId: undefined,
      activeSeconds: 0,
      activitySegments: [],
      keystrokes: 0,
      charsAdded: 0,
      charsDeleted: 0,
      humanLinesAdded: 0,
      humanLinesDeleted: 0,
      unattributedLinesAdded: 0,
      unattributedLinesDeleted: 0,
      copyActions: 0,
      pasteActions: 0,
      copiedChars: 0,
      copiedLines: 0,
      pastedChars: 0,
      pastedLines: 0,
      pasteSameFileActions: 0,
      pasteSameWorkspaceActions: 0,
      pasteExternalOrUnknownActions: 0,
      pendingWrite: false,
      pendingEditorChanges: []
    };
    this.states.set(entity, created);
    return created;
  }

  private hasPendingActivity(state: BufferedFileState): boolean {
    return (
      state.pendingWrite ||
      state.activeSeconds > 0 ||
      state.keystrokes > 0 ||
      state.charsAdded > 0 ||
      state.charsDeleted > 0 ||
      state.humanLinesAdded > 0 ||
      state.humanLinesDeleted > 0 ||
      state.unattributedLinesAdded > 0 ||
      state.unattributedLinesDeleted > 0 ||
      state.copyActions > 0 ||
      state.pasteActions > 0 ||
      state.activitySegments.length > 0
    );
  }

  private shouldFlushOnTimer(state: BufferedFileState, now: number): boolean {
    const { heartbeatRateLimitMs } = this.getConfig();
    const hasRetry = (this.retrySnapshots.get(state.entity)?.length ?? 0) > 0;
    if (!this.hasPendingActivity(state) && !hasRetry) {
      return false;
    }
    if (state.lastActivityAt === undefined && !hasRetry) {
      return false;
    }
    return (
      state.lastHeartbeatAt === undefined ||
      now - state.lastHeartbeatAt >= heartbeatRateLimitMs
    );
  }

  private buildPayload(
    state: BufferedFileState,
    category: HeartbeatCategory,
    write: boolean,
    measurement?: LineMeasurement,
    matchedAiOperation = false
  ): ExtraHeartbeatPayload {
    const clipboardEnabled = this.getConfig().trackClipboardActions;
    const hasAmbiguousLines =
      state.pendingEditorChanges.length > 0;
    const hasHumanEvidence =
      write ||
      state.copyActions > 0 ||
      state.activitySegments.length > 0;
    // `state.aiEventId` is set only when this flush is reporting an edit the broker
    // sidecar already matched to an agent (see classifyPendingAttribution). That takes
    // priority over `write`: a save that immediately follows an agent-owned edit must
    // not fall back to Human just because a save happened, since every human-side
    // counter was already zeroed for this exact edit.
    const aiAttribution = state.aiEventId
      ? {
          actor_type: (state.aiActorType ??
            (state.aiConfidence === "verified" ? "ai_verified" : "ai_inferred")) as ActorType,
          actor_confidence:
            state.aiActorConfidence ?? (state.aiConfidence === "verified" ? 1 : 0.6),
          ai_agent: state.aiAgent,
          ai_provider: state.aiProvider,
          ai_model: state.aiModel,
          ai_source: state.aiSource,
          ai_confidence: state.aiConfidence,
          ai_event_id: state.aiEventId,
          ai_lines_added: state.aiLinesAdded,
          ai_lines_deleted: state.aiLinesDeleted
        }
      : {
          actor_type: (hasAmbiguousLines ? "unknown" : hasHumanEvidence ? "human" : "unknown") as ActorType,
          actor_confidence: hasAmbiguousLines ? 0 : hasHumanEvidence ? 1 : 0
        };
    return {
      entity: state.entity,
      time: state.lastActivityAt === undefined ? undefined : state.lastActivityAt / 1000,
      entity_type: "file",
      alternate_project: state.alternateProject,
      category,
      write,
      line_number: state.lineNumber,
      cursor_position: state.cursorPosition,
      keystrokes: undefined,
      chars_added: state.charsAdded || undefined,
      chars_deleted: state.charsDeleted || undefined,
      // Unknown/mixed editor observations stay unknown. When the observation is
      // already represented by a verified AI operation, omit its line counters so
      // the editor cannot create a second total for the same edit.
      human_lines_added: undefined,
      human_lines_deleted: undefined,
      unattributed_lines_added:
        !matchedAiOperation && measurement?.status === "measured"
          ? measurement.linesAdded
          : undefined,
      unattributed_lines_deleted:
        !matchedAiOperation && measurement?.status === "measured"
          ? measurement.linesDeleted
          : undefined,
      clipboard_tracking_version: clipboardEnabled ? 1 : undefined,
      copy_actions: clipboardEnabled ? state.copyActions || undefined : undefined,
      paste_actions: clipboardEnabled ? state.pasteActions || undefined : undefined,
      copied_chars: clipboardEnabled ? state.copiedChars || undefined : undefined,
      copied_lines: clipboardEnabled ? state.copiedLines || undefined : undefined,
      pasted_chars: clipboardEnabled ? state.pastedChars || undefined : undefined,
      pasted_lines: clipboardEnabled ? state.pastedLines || undefined : undefined,
      paste_same_file_actions: clipboardEnabled
        ? state.pasteSameFileActions || undefined
        : undefined,
      paste_same_workspace_actions: clipboardEnabled
        ? state.pasteSameWorkspaceActions || undefined
        : undefined,
      paste_external_or_unknown_actions: clipboardEnabled
        ? state.pasteExternalOrUnknownActions || undefined
        : undefined,
      active_seconds: unionSeconds(state.activitySegments),
      heartbeat_id: state.heartbeatId,
      line_metric_version: measurement?.metricVersion,
      line_measurement_status: measurement?.status,
      line_measurement_reason:
        measurement?.status === "unavailable" ? measurement.reason : undefined,
      measurement_window_id: measurement ? state.heartbeatId : undefined,
      activity_segments: state.activitySegments.length > 0 ? state.activitySegments : undefined,
      ...aiAttribution
    };
  }

  private async classifyPendingAttribution(
    state: BufferedFileState,
    now: number,
    measurement?: LineMeasurement
  ): Promise<boolean> {
    // A final fingerprint cannot prove who made earlier edits in a mixed window.
    // Until native operation boundaries exist, only one non-replay change event
    // with a known before-version can be reconciled with a producer-owned edit.
    if (measurement?.status !== "measured" || measurement.containsReplay ||
        measurement.changeEvents !== 1 || state.pendingEditorChanges.length !== 1 ||
        (measurement.linesAdded === 0 && measurement.linesDeleted === 0)) return false;
    const observation = state.pendingEditorChanges[0];
    let result;
    try {
      result = await this.aiAttributionStore.classify(
        state.entity, observation.timeMs, measurement.linesAdded!, measurement.linesDeleted!,
        observation.contentFingerprint, observation.toolEventId
      );
    } catch {
      // Sidecar availability must not drop already-observed activity or characters.
      return false;
    }
    if (result.attribution !== "ai" || !result.event ||
        result.unattributed_lines_added || result.unattributed_lines_deleted) return false;
    // The producer already owns these line totals. The editor sends only supporting
    // identity, never a second AI line count.
    state.charsAdded = 0;
    state.charsDeleted = 0;
    state.pendingEditorChanges = [];
    const boundary = (state.lastEditIntervalStartAt ?? state.lastEditAt ?? now) / 1000;
    state.activitySegments = state.activitySegments.flatMap((segment) => {
      if (segment.start >= boundary - SEGMENT_MATCH_EPSILON_SECONDS) return [];
      if (segment.end <= boundary + SEGMENT_MATCH_EPSILON_SECONDS) return [segment];
      return [{ ...segment, end: boundary }];
    });
    state.activeSeconds = unionSeconds(state.activitySegments);
    if (state.activitySegments.length === 0) {
      state.aiEventId = result.event.event_id;
      state.aiAgent = result.event.agent;
      state.aiProvider = result.event.provider;
      state.aiModel = result.event.model;
      state.aiSource = result.event.source;
      state.aiConfidence = result.event.confidence;
      state.aiActorType = result.event.actor_type as BufferedFileState["aiActorType"];
      state.aiActorConfidence = result.event.actor_confidence;
    }
    return true;
  }

  private observeActivity(state: BufferedFileState, now: number): void {
    const previous = this.lastObservedActivityAt;
    if (previous !== undefined) {
      const elapsedMs = now - previous;
      // Strict Active timing gives a heartbeat the interval to the next activity only
      // while the gap is at most the 15-second human lease. The 120-second heartbeat
      // cadence is a delivery concern and must never manufacture coding time.
      if (elapsedMs >= 0 && elapsedMs <= MAX_ACTIVITY_GAP_MS) {
        // Attribute the interval to the earlier activity's file, just as WakaTime's
        // heartbeat-to-next-heartbeat mini-duration algorithm does. The state remains
        // in the map after a flush, so a later event can safely account for a thinking
        // interval without double-counting it or assigning it to the newly opened file.
        const previousState = this.lastObservedEntity
          ? this.states.get(this.lastObservedEntity)
          : undefined;
        if (previousState) {
          const start = previous / 1000;
          const end = now / 1000;
          appendSegment(previousState.activitySegments, {
            segment_id: randomUUID(),
            start,
            end,
            // The suffix is an additive wire marker. Legacy readers still see
            // this as editor activity, while the API can distinguish explicit
            // 15-second Active evidence from older WakaTime-compatible rows.
            source: "editor_active_v1"
          });
          previousState.activeSeconds = unionSeconds(previousState.activitySegments);
          previousState.lastActivityAt = now;
        }
      }
    }

    // Resetting the cursor on a backwards system-clock jump avoids a permanently stale
    // anchor while never manufacturing negative duration.
    this.lastObservedActivityAt = now;
    this.lastObservedEntity = state.entity;
    state.lastActivityAt = now;
  }

  private clearMeasurements(state: BufferedFileState): void {
    state.keystrokes = 0;
    state.charsAdded = 0;
    state.charsDeleted = 0;
    state.humanLinesAdded = 0;
    state.humanLinesDeleted = 0;
    state.unattributedLinesAdded = 0;
    state.unattributedLinesDeleted = 0;
    state.copyActions = 0;
    state.pasteActions = 0;
    state.copiedChars = 0;
    state.copiedLines = 0;
    state.pastedChars = 0;
    state.pastedLines = 0;
    state.pasteSameFileActions = 0;
    state.pasteSameWorkspaceActions = 0;
    state.pasteExternalOrUnknownActions = 0;
    state.activeSeconds = 0;
    state.activitySegments = [];
    state.heartbeatId = undefined;
    state.lastEditAt = undefined;
    state.lastEditIntervalStartAt = undefined;
    state.lastActivityAt = undefined;
    state.pendingWrite = false;
    state.aiEventId = undefined;
    state.aiAgent = undefined;
    state.aiProvider = undefined;
    state.aiModel = undefined;
    state.aiSource = undefined;
    state.aiConfidence = undefined;
    state.aiActorType = undefined;
    state.aiActorConfidence = undefined;
    state.aiLinesAdded = undefined;
    state.aiLinesDeleted = undefined;
    state.pendingEditorChanges = [];
  }

  private captureSnapshot(
    state: BufferedFileState,
    category: HeartbeatCategory,
    write: boolean,
    measurement?: LineMeasurement,
    matchedAiOperation = false
  ): FlushSnapshot {
    state.heartbeatId ||= randomUUID();
    const snapshot: FlushSnapshot = {
      payload: this.buildPayload(state, category, write, measurement, matchedAiOperation),
      category,
      write,
      activitySegments: state.activitySegments.map((segment) => ({ ...segment })),
      activeSeconds: unionSeconds(state.activitySegments),
      keystrokes: state.keystrokes,
      charsAdded: state.charsAdded,
      charsDeleted: state.charsDeleted,
      humanLinesAdded: state.humanLinesAdded,
      humanLinesDeleted: state.humanLinesDeleted,
      unattributedLinesAdded: state.unattributedLinesAdded,
      unattributedLinesDeleted: state.unattributedLinesDeleted,
      copyActions: state.copyActions,
      pasteActions: state.pasteActions,
      copiedChars: state.copiedChars,
      copiedLines: state.copiedLines,
      pastedChars: state.pastedChars,
      pastedLines: state.pastedLines,
      pasteSameFileActions: state.pasteSameFileActions,
      pasteSameWorkspaceActions: state.pasteSameWorkspaceActions,
      pasteExternalOrUnknownActions: state.pasteExternalOrUnknownActions,
      pendingWrite: state.pendingWrite,
      lastEditAt: state.lastEditAt,
      lastActivityAt: state.lastActivityAt
    };
    this.clearMeasurements(state);
    return snapshot;
  }

  private commitSnapshot(entity: string, now: number, _snapshot: FlushSnapshot): void {
    const state = this.states.get(entity);
    if (!state) {
      return;
    }
    state.lastHeartbeatAt = now;
    // New activity may have arrived while the request was in flight. Its counters
    // remain in the state and must belong to the next heartbeat.
    if (!this.hasPendingActivity(state)) {
      state.lastEditAt = undefined;
      state.lastActivityAt = undefined;
      state.pendingWrite = false;
    }
  }

  private clearEmptyState(state: BufferedFileState): void {
    if (!this.hasPendingActivity(state)) {
      state.lastEditAt = undefined;
      state.lastActivityAt = undefined;
      state.pendingWrite = false;
    }
  }

  private enqueueFlush<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.flushTail.catch(() => undefined).then(operation);
    this.flushTail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private updateSelectionState(
    state: BufferedFileState,
    selection?: Pick<Selection, "active">
  ): void {
    const metrics = getSelectionMetrics(selection);
    state.lineNumber = metrics.lineNumber;
    state.cursorPosition = metrics.cursorPosition;
  }

  private updateProjectState(state: BufferedFileState, project?: string): void {
    if (!project) {
      return;
    }
    const trimmed = project.trim();
    if (!trimmed) {
      return;
    }
    state.alternateProject = trimmed;
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Metadata-only content identity used for exact cross-producer reconciliation. */
function fingerprintDocument(document: Pick<TextDocument, "uri"> & { getText?: () => string }): string | undefined {
  if (typeof document.getText !== "function") {
    return undefined;
  }
  try {
    const text = document.getText();
    if (text.length > 512 * 1024) return undefined;
    return `sha256:${createHash("sha256").update(text).digest("hex")}`;
  } catch {
    return undefined;
  }
}
