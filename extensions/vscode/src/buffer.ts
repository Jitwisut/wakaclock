import type {
  Selection,
  TextDocument,
  TextDocumentContentChangeEvent,
  TextEditor
} from "vscode";
import type { WakaclockCliService } from "./cli";
import { AiAttributionStore } from "./aiAttribution";
import { Logger } from "./logging";
import type {
  ActivitySegment,
  ActorType,
  BufferedFileState,
  ClipboardCopyMetrics,
  ClipboardPasteMetrics,
  ExtraHeartbeatPayload,
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
    private readonly cli: Pick<WakaclockCliService, "sendHeartbeat">,
    private readonly logger: Logger,
    private readonly onHeartbeatSent?: HeartbeatSentHandler,
    private readonly aiAttributionStore: AiAttributionStore = new AiAttributionStore(),
    private readonly onActivity?: ActivityHandler
  ) {}

  public async recordTextChange(
    document: Pick<TextDocument, "uri">,
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
    // Undo/redo replays content already counted once before, and it is specifically
    // the *line* delta that gets compared against nearby AI sidecar evidence
    // (classifyPendingAttribution → AiAttributionStore.classify): a large undo could
    // otherwise manufacture a coincidental line-count match against unrelated AI
    // activity, or double-count a human's own earlier edit as new lines written.
    // Keystrokes/chars still accumulate regardless — they carry no line-match risk,
    // and withholding them here would make an undo-only edit indistinguishable from
    // no activity at all (`hasPendingActivity` would see nothing to report), silently
    // dropping the heartbeat whose timestamp anchor the idle bridge relies on to
    // resume the clock after a break (see docs/duration-accuracy-audit.md Finding 0).
    state.keystrokes += paste ? 0 : summary.keystrokes;
    state.charsAdded += summary.charsAdded;
    state.charsDeleted += summary.charsDeleted;
    if (paste && this.getConfig().trackClipboardActions) {
      state.pasteActions += 1;
      state.pastedChars += summary.charsAdded;
      state.pastedLines += summary.linesAdded;
      if (paste.origin === "same_file") {
        state.pasteSameFileActions += 1;
      } else if (paste.origin === "same_workspace") {
        state.pasteSameWorkspaceActions += 1;
      } else {
        state.pasteExternalOrUnknownActions += 1;
      }
      state.unattributedLinesAdded += summary.linesAdded;
      state.unattributedLinesDeleted += summary.linesDeleted;
    } else if (
      changeReason !== TEXT_DOCUMENT_CHANGE_REASON_UNDO &&
      changeReason !== TEXT_DOCUMENT_CHANGE_REASON_REDO
    ) {
      state.humanLinesAdded += summary.linesAdded;
      state.humanLinesDeleted += summary.linesDeleted;
    }
    this.updateSelectionState(state, selection);

    this.onActivity?.();

    // WakaTime sends the first file-change heartbeat immediately. Subsequent
    // same-file heartbeats are rate limited to the configured cadence.
    if (
      (state.lastHeartbeatAt === undefined ||
        now - state.lastHeartbeatAt >= this.getConfig().heartbeatRateLimitMs) &&
      this.hasPendingActivity(state)
    ) {
      await this.flushFile(entity, "gap", { now });
    }
  }

  public async recordClipboardCopy(
    document: Pick<TextDocument, "uri">,
    metrics: ClipboardCopyMetrics,
    now = Date.now(),
    project?: string
  ): Promise<void> {
    if (!this.getConfig().trackClipboardActions || !isFileDocument(document)) {
      return;
    }
    const entity = normalizeFsPath(document.uri.fsPath);
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
    document: Pick<TextDocument, "uri">,
    now = Date.now(),
    project?: string
  ): Promise<void> {
    if (!isFileDocument(document)) {
      return;
    }

    const entity = normalizeFsPath(document.uri.fsPath);
    const state = this.getOrCreateState(entity);
    this.updateProjectState(state, project);
    this.observeActivity(state, now);
    state.heartbeatId ||= randomUUID();
    state.pendingWrite = true;
    this.onActivity?.();
    await this.flushFile(entity, "save", { now, write: true, force: true });
  }

  public async recordEditorSwitch(
    previousEditor?: Pick<TextEditor, "document">,
    currentEditorOrNow?: Pick<TextEditor, "document"> | number,
    now = Date.now()
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
    if (currentEntity && currentEntity !== previousEntity) {
      const state = this.getOrCreateState(currentEntity);
      // A switch is an activity marker even when the file has no pending edits.
      await this.flushFile(currentEntity, "switch", { now, force: true });
      this.logger.debug("recorded active editor switch", {
        entity: state.entity,
        previousEntity
      });
    }
  }

  public updateCursor(
    document: Pick<TextDocument, "uri">,
    selection?: Pick<Selection, "active">,
    project?: string,
    now = Date.now()
  ): void {
    if (!isFileDocument(document)) {
      return;
    }
    const entity = normalizeFsPath(document.uri.fsPath);
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
      await this.classifyPendingAttribution(state, now);
      if (!force && !this.hasPendingActivity(state) && retries.length === 0) {
        this.clearEmptyState(state);
        return;
      }

      const snapshots = [...retries];
      if (this.hasPendingActivity(state)) {
        snapshots.push(this.captureSnapshot(state, category, write));
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
      pendingWrite: false
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
    write: boolean
  ): ExtraHeartbeatPayload {
    const clipboardEnabled = this.getConfig().trackClipboardActions;
    const hasAmbiguousLines =
      state.unattributedLinesAdded > 0 || state.unattributedLinesDeleted > 0;
    const hasHumanEvidence =
      write ||
      state.humanLinesAdded > 0 ||
      state.humanLinesDeleted > 0 ||
      state.keystrokes > 0 ||
      state.charsAdded > 0 ||
      state.charsDeleted > 0 ||
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
      entity_type: "file",
      project: state.project,
      category,
      write,
      line_number: state.lineNumber,
      cursor_position: state.cursorPosition,
      keystrokes: state.keystrokes || undefined,
      chars_added: state.charsAdded || undefined,
      chars_deleted: state.charsDeleted || undefined,
      human_lines_added: state.humanLinesAdded || undefined,
      human_lines_deleted: state.humanLinesDeleted || undefined,
      unattributed_lines_added: state.unattributedLinesAdded || undefined,
      unattributed_lines_deleted: state.unattributedLinesDeleted || undefined,
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
      activity_segments: state.activitySegments.length > 0 ? state.activitySegments : undefined,
      ...aiAttribution
    };
  }

  private async classifyPendingAttribution(
    state: BufferedFileState,
    now: number
  ): Promise<void> {
    if (state.humanLinesAdded === 0 && state.humanLinesDeleted === 0) {
      return;
    }

    const { attribution, event } = await this.aiAttributionStore.classify(
      state.entity,
      state.lastEditAt ?? state.lastActivityAt ?? now,
      state.humanLinesAdded,
      state.humanLinesDeleted
    );
    if (attribution === "human") {
      return;
    }

    if (attribution === "unattributed") {
      // A nearby agent event exists but its line delta is ambiguous. Keep the
      // observed change visible without claiming it was human work; a later
      // transcript retry can still prove the event and be deduplicated server-side.
      state.unattributedLinesAdded += state.humanLinesAdded;
      state.unattributedLinesDeleted += state.humanLinesDeleted;
      state.humanLinesAdded = 0;
      state.humanLinesDeleted = 0;
      return;
    }

    // The agent hook owns this edit's line/time attribution. Remove the editor-side
    // counters so the same change is not reported as human as well. A pending save is
    // left intact so the ordinary write heartbeat can still mark the file as active.
    this.logger.debug("classified editor change as AI-generated", { entity: state.entity });
    state.keystrokes = 0;
    state.charsAdded = 0;
    state.charsDeleted = 0;
    state.humanLinesAdded = 0;
    state.humanLinesDeleted = 0;
    state.unattributedLinesAdded = 0;
    state.unattributedLinesDeleted = 0;
    // AI provenance changes who owns the edited lines, not who invoked the editor's
    // Copy/Paste interaction. Clipboard counters therefore survive correlation.
    // A transcript-confirmed AI patch is not evidence that the developer was actively
    // interacting with the editor, so the interval the patch itself closed is dropped.
    //
    // Only that interval. Clearing the whole list — which is what this used to do —
    // also deleted every interval the developer had genuinely earned in this file
    // before the agent touched it, so one agent edit could erase minutes of real
    // typing. Everything up to the moment the agent's edit landed is the developer's
    // and stands on its own evidence; the segment list is truncated there rather than
    // emptied. Adjacent intervals merge, so truncation has to cut a segment in half
    // instead of only dropping whole ones.
    const boundary = (state.lastEditIntervalStartAt ?? state.lastEditAt ?? now) / 1000;
    state.activitySegments = state.activitySegments.flatMap((segment) => {
      if (segment.end <= boundary + SEGMENT_MATCH_EPSILON_SECONDS) {
        return [segment];
      }
      if (segment.start >= boundary - SEGMENT_MATCH_EPSILON_SECONDS) {
        return [];
      }
      return [{ ...segment, end: boundary }];
    });
    state.activeSeconds = unionSeconds(state.activitySegments);

    // Only carry the matched event's provenance onto the payload when nothing
    // developer-earned survived the truncation above. If a segment remains, the
    // developer's own time is still in this flush and the payload must report Human
    // for it — the agent's own attribution already reaches the server independently,
    // through the CLI/broker path that classified this edit in the first place.
    // Reporting `ai_verified` here on top of a surviving human segment would relabel
    // the developer's own earned seconds as AI activity server-side.
    if (state.activitySegments.length === 0) {
      state.aiEventId = event?.event_id;
      state.aiAgent = event?.agent;
      state.aiProvider = event?.provider;
      state.aiModel = event?.model;
      state.aiSource = event?.source;
      state.aiConfidence = event?.confidence;
      state.aiActorType = event?.actor_type as BufferedFileState["aiActorType"];
      state.aiActorConfidence = event?.actor_confidence;
      state.aiLinesAdded = event?.lines_added ?? undefined;
      state.aiLinesDeleted = event?.lines_deleted ?? undefined;
    }
  }

  private observeActivity(state: BufferedFileState, now: number): void {
    const previous = this.lastObservedActivityAt;
    if (previous !== undefined) {
      const elapsedMs = now - previous;
      // Strict Wakaclock timing gives a heartbeat the interval to the next activity only
      // while the gap is at most 120 seconds.
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
            source: "editor"
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
  }

  private captureSnapshot(
    state: BufferedFileState,
    category: HeartbeatCategory,
    write: boolean
  ): FlushSnapshot {
    state.heartbeatId ||= randomUUID();
    const snapshot: FlushSnapshot = {
      payload: this.buildPayload(state, category, write),
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
    state.project = trimmed;
  }
}
