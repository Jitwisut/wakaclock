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
  BufferedFileState,
  ExtraHeartbeatPayload,
  FlushOverrides,
  FlushReason,
  HeartbeatCategory,
  WakaclockConfigSnapshot
} from "./types";
import {
  getEditorEntity,
  getSelectionMetrics,
  isFileDocument,
  normalizeFsPath,
  summarizeTextChanges
} from "./utils";

type HeartbeatSentHandler = () => void;

export class HeartbeatBufferManager {
  private readonly states = new Map<string, BufferedFileState>();

  public constructor(
    private readonly getConfig: () => WakaclockConfigSnapshot,
    private readonly cli: Pick<WakaclockCliService, "sendHeartbeat">,
    private readonly logger: Logger,
    private readonly onHeartbeatSent?: HeartbeatSentHandler,
    private readonly aiAttributionStore: AiAttributionStore = new AiAttributionStore()
  ) {}

  public async recordTextChange(
    document: Pick<TextDocument, "uri">,
    changes: readonly (Pick<TextDocumentContentChangeEvent, "rangeLength" | "text"> & {
      range?: TextDocumentContentChangeEvent["range"];
    })[],
    selection?: Pick<Selection, "active">,
    now = Date.now(),
    project?: string
  ): Promise<void> {
    if (!isFileDocument(document) || changes.length === 0) {
      return;
    }

    const entity = normalizeFsPath(document.uri.fsPath);
    const state = this.getOrCreateState(entity);
    this.updateProjectState(state, project);
    const summary = summarizeTextChanges(changes);
    const hadTrackedActivity = this.hasTrackedActivity(state);

    state.lastKeystrokeAt = now;
    state.firstActivityAt = hadTrackedActivity ? state.firstActivityAt : now;
    state.lastActivityAt = now;
    state.keystrokes += summary.keystrokes;
    state.charsAdded += summary.charsAdded;
    state.charsDeleted += summary.charsDeleted;
    state.humanLinesAdded += summary.linesAdded;
    state.humanLinesDeleted += summary.linesDeleted;
    this.updateSelectionState(state, selection);

    if (
      state.lastHeartbeatAt &&
      now - state.lastHeartbeatAt >= this.getConfig().sameFileHeartbeatMs &&
      this.hasPendingActivity(state)
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
    state.pendingWrite = true;
    await this.flushFile(entity, "save", { now, write: true, force: true });
  }

  public async recordEditorSwitch(
    previousEditor?: Pick<TextEditor, "document">,
    now = Date.now()
  ): Promise<void> {
    const entity = getEditorEntity(previousEditor);
    if (!entity) {
      return;
    }
    await this.flushFile(entity, "switch", { now });
  }

  public updateCursor(
    document: Pick<TextDocument, "uri">,
    selection?: Pick<Selection, "active">,
    project?: string
  ): void {
    if (!isFileDocument(document)) {
      return;
    }
    const entity = normalizeFsPath(document.uri.fsPath);
    const state = this.getOrCreateState(entity);
    this.updateProjectState(state, project);
    this.updateSelectionState(state, selection);
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
    const duePayloads: Array<{
      entity: string;
      payload: ExtraHeartbeatPayload;
      category: HeartbeatCategory;
      write: boolean;
      now: number;
    }> = [];

    for (const [entity, state] of this.states.entries()) {
      if (!this.shouldFlushOnTimer(state, now)) {
        continue;
      }

      await this.classifyPendingAttribution(state, now);
      if (!this.hasPendingActivity(state)) {
        this.markFlushed(entity, now);
        continue;
      }

      duePayloads.push({
        entity,
        payload: this.buildPayload(state, "coding", false),
        category: "coding",
        write: false,
        now
      });
    }

    if (duePayloads.length === 0) {
      return;
    }

    const [primary, ...rest] = duePayloads;
    try {
      await this.cli.sendHeartbeat(
        primary.entity,
        primary.write,
        primary.category,
        rest.map((item) => item.payload),
        primary.payload
      );
      for (const item of duePayloads) {
        this.markFlushed(item.entity, item.now);
      }
      this.onHeartbeatSent?.();
    } catch (error) {
      this.logger.error("failed to flush buffered heartbeats", error);
    }
  }

  public async flushFile(
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

    if (!force && !this.hasPendingActivity(state)) {
      return;
    }

    try {
      await this.classifyPendingAttribution(state, now);
      if (!force && !this.hasPendingActivity(state)) {
        this.markFlushed(entity, now);
        return;
      }
      await this.cli.sendHeartbeat(entity, write, category, [], this.buildPayload(state, category, write));
      this.markFlushed(entity, now);
      this.onHeartbeatSent?.();
      this.logger.debug("flushed heartbeat", { entity, reason, category, write });
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
      keystrokes: 0,
      charsAdded: 0,
      charsDeleted: 0,
      humanLinesAdded: 0,
      humanLinesDeleted: 0,
      pendingWrite: false
    };
    this.states.set(entity, created);
    return created;
  }

  private hasPendingActivity(state: BufferedFileState): boolean {
    return (
      state.pendingWrite ||
      state.keystrokes > 0 ||
      state.charsAdded > 0 ||
      state.charsDeleted > 0 ||
      state.humanLinesAdded > 0 ||
      state.humanLinesDeleted > 0
    );
  }

  private hasTrackedActivity(state: BufferedFileState): boolean {
    return (
      state.keystrokes > 0 ||
      state.charsAdded > 0 ||
      state.charsDeleted > 0 ||
      state.humanLinesAdded > 0 ||
      state.humanLinesDeleted > 0
    );
  }

  private shouldFlushOnTimer(state: BufferedFileState, now: number): boolean {
    const { idleMs } = this.getConfig();
    if (!this.hasPendingActivity(state)) {
      return false;
    }
    if (!state.lastKeystrokeAt) {
      return false;
    }
    return now - state.lastKeystrokeAt <= idleMs;
  }

  private buildPayload(
    state: BufferedFileState,
    category: HeartbeatCategory,
    write: boolean
  ): ExtraHeartbeatPayload {
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
      active_seconds: this.estimateActiveSeconds(state)
    };
  }

  private async classifyPendingAttribution(
    state: BufferedFileState,
    now: number
  ): Promise<void> {
    if (state.humanLinesAdded === 0 && state.humanLinesDeleted === 0) {
      return;
    }

    const matchedAiEdit = await this.aiAttributionStore.matchesRecentEdit(
      state.entity,
      state.lastActivityAt ?? now,
      state.humanLinesAdded,
      state.humanLinesDeleted
    );
    if (!matchedAiEdit) {
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
  }

  private estimateActiveSeconds(state: BufferedFileState): number {
    if (!this.hasTrackedActivity(state)) {
      return 0;
    }

    const start = state.firstActivityAt ?? state.lastActivityAt ?? Date.now();
    const end = state.lastActivityAt ?? start;
    const elapsedSeconds = Math.max(0, (end - start) / 1000);
    const maxWindowSeconds = Math.max(1, this.getConfig().flushIntervalMs / 1000);

    return Math.min(Math.max(elapsedSeconds, 1), maxWindowSeconds);
  }

  private markFlushed(entity: string, now: number): void {
    const state = this.states.get(entity);
    if (!state) {
      return;
    }

    state.lastHeartbeatAt = now;
    state.keystrokes = 0;
    state.charsAdded = 0;
    state.charsDeleted = 0;
    state.humanLinesAdded = 0;
    state.humanLinesDeleted = 0;
    state.firstActivityAt = undefined;
    state.lastActivityAt = undefined;
    state.pendingWrite = false;
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
