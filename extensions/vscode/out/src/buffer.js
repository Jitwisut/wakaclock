"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeartbeatBufferManager = void 0;
const aiAttribution_1 = require("./aiAttribution");
const activity_1 = require("./activity");
const node_crypto_1 = require("node:crypto");
const utils_1 = require("./utils");
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
class HeartbeatBufferManager {
    getConfig;
    cli;
    logger;
    onHeartbeatSent;
    aiAttributionStore;
    onActivity;
    states = new Map();
    /**
     * One global activity cursor prevents two open files from claiming the same wall-clock
     * interval. WakaTime derives a mini-duration from each heartbeat to the next one; this
     * cursor provides the equivalent accounting while wakaclock still stores an explicit
     * `active_seconds` value on each heartbeat.
    */
    lastObservedActivityAt;
    lastObservedEntity;
    flushTail = Promise.resolve();
    /** Snapshots whose CLI request failed. They retain their original heartbeat ID. */
    retrySnapshots = new Map();
    constructor(getConfig, cli, logger, onHeartbeatSent, aiAttributionStore = new aiAttribution_1.AiAttributionStore(), onActivity) {
        this.getConfig = getConfig;
        this.cli = cli;
        this.logger = logger;
        this.onHeartbeatSent = onHeartbeatSent;
        this.aiAttributionStore = aiAttributionStore;
        this.onActivity = onActivity;
    }
    async recordTextChange(document, changes, selection, now = Date.now(), project, changeReason) {
        if (!(0, utils_1.isFileDocument)(document) || changes.length === 0) {
            return;
        }
        const entity = (0, utils_1.normalizeFsPath)(document.uri.fsPath);
        const state = this.getOrCreateState(entity);
        this.updateProjectState(state, project);
        const summary = (0, utils_1.summarizeTextChanges)(changes);
        // Captured before `observeActivity` moves the cursor: this is the start of the
        // interval this very edit is about to close, and the only thing an agent edit is
        // ever allowed to take back.
        const intervalStartAt = this.lastObservedActivityAt;
        this.observeActivity(state, now);
        state.heartbeatId ||= (0, node_crypto_1.randomUUID)();
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
        state.keystrokes += summary.keystrokes;
        state.charsAdded += summary.charsAdded;
        state.charsDeleted += summary.charsDeleted;
        if (changeReason !== TEXT_DOCUMENT_CHANGE_REASON_UNDO &&
            changeReason !== TEXT_DOCUMENT_CHANGE_REASON_REDO) {
            state.humanLinesAdded += summary.linesAdded;
            state.humanLinesDeleted += summary.linesDeleted;
        }
        this.updateSelectionState(state, selection);
        this.onActivity?.();
        // WakaTime sends the first file-change heartbeat immediately. Subsequent
        // same-file heartbeats are rate limited to the configured cadence.
        if ((state.lastHeartbeatAt === undefined ||
            now - state.lastHeartbeatAt >= this.getConfig().heartbeatRateLimitMs) &&
            this.hasPendingActivity(state)) {
            await this.flushFile(entity, "gap", { now });
        }
    }
    async recordSave(document, now = Date.now(), project) {
        if (!(0, utils_1.isFileDocument)(document)) {
            return;
        }
        const entity = (0, utils_1.normalizeFsPath)(document.uri.fsPath);
        const state = this.getOrCreateState(entity);
        this.updateProjectState(state, project);
        this.observeActivity(state, now);
        state.heartbeatId ||= (0, node_crypto_1.randomUUID)();
        state.pendingWrite = true;
        this.onActivity?.();
        await this.flushFile(entity, "save", { now, write: true, force: true });
    }
    async recordEditorSwitch(previousEditor, currentEditorOrNow, now = Date.now()) {
        const currentEditor = typeof currentEditorOrNow === "number" ? undefined : currentEditorOrNow;
        if (typeof currentEditorOrNow === "number") {
            now = currentEditorOrNow;
        }
        const previousEntity = (0, utils_1.getEditorEntity)(previousEditor);
        if (previousEntity) {
            await this.flushFile(previousEntity, "switch", { now });
        }
        const currentEntity = (0, utils_1.getEditorEntity)(currentEditor);
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
    updateCursor(document, selection, project, now = Date.now()) {
        if (!(0, utils_1.isFileDocument)(document)) {
            return;
        }
        const entity = (0, utils_1.normalizeFsPath)(document.uri.fsPath);
        const state = this.getOrCreateState(entity);
        this.updateProjectState(state, project);
        this.updateSelectionState(state, selection);
        this.observeActivity(state, now);
        this.onActivity?.();
    }
    async flushCurrentEditor(editor, reason = "manual", overrides, project) {
        const entity = (0, utils_1.getEditorEntity)(editor);
        if (!entity) {
            return;
        }
        const state = this.getOrCreateState(entity);
        this.updateProjectState(state, project);
        await this.flushFile(entity, reason, { force: true, ...overrides });
    }
    async flushDueBuffers(reason, now = Date.now()) {
        return this.enqueueFlush(() => this.flushDueBuffersInternal(reason, now));
    }
    getBufferedSeconds(now = Date.now()) {
        void now;
        // Do not turn an idle clock into coding time. The duration is closed only by the
        // next editor activity event (or a save/switch), exactly like the persisted
        // `active_seconds` calculation. This keeps the status bar from climbing after the
        // user stops typing while still exposing every interval as soon as activity arrives.
        return (0, activity_1.unionSeconds)(this.getBufferedSegments());
    }
    getBufferedSegments() {
        const current = Array.from(this.states.values()).flatMap((state) => state.activitySegments.map((segment) => ({ ...segment })));
        const retries = Array.from(this.retrySnapshots.values()).flatMap((snapshots) => snapshots.flatMap((snapshot) => snapshot.activitySegments.map((segment) => ({ ...segment }))));
        return [...current, ...retries];
    }
    async flushDueBuffersInternal(reason, now) {
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
    async flushFile(entity, reason, overrides = {}) {
        return this.enqueueFlush(() => this.flushFileInternal(entity, reason, overrides));
    }
    async flushFileInternal(entity, reason, overrides = {}) {
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
        if (!force &&
            reason === "gap" &&
            state.lastHeartbeatAt !== undefined &&
            now - state.lastHeartbeatAt < this.getConfig().heartbeatRateLimitMs) {
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
                await this.cli.sendHeartbeat(entity, primary.write, primary.category, rest.map((snapshot) => snapshot.payload), primary.payload);
            }
            catch (error) {
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
        }
        catch (error) {
            this.logger.error(`failed to flush heartbeat for ${entity}`, { reason, error });
        }
    }
    getOrCreateState(entity) {
        const existing = this.states.get(entity);
        if (existing) {
            return existing;
        }
        const created = {
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
            pendingWrite: false
        };
        this.states.set(entity, created);
        return created;
    }
    hasPendingActivity(state) {
        return (state.pendingWrite ||
            state.activeSeconds > 0 ||
            state.keystrokes > 0 ||
            state.charsAdded > 0 ||
            state.charsDeleted > 0 ||
            state.humanLinesAdded > 0 ||
            state.humanLinesDeleted > 0 ||
            state.unattributedLinesAdded > 0 ||
            state.unattributedLinesDeleted > 0 ||
            state.activitySegments.length > 0);
    }
    shouldFlushOnTimer(state, now) {
        const { heartbeatRateLimitMs } = this.getConfig();
        const hasRetry = (this.retrySnapshots.get(state.entity)?.length ?? 0) > 0;
        if (!this.hasPendingActivity(state) && !hasRetry) {
            return false;
        }
        if (state.lastActivityAt === undefined && !hasRetry) {
            return false;
        }
        return (state.lastHeartbeatAt === undefined ||
            now - state.lastHeartbeatAt >= heartbeatRateLimitMs);
    }
    buildPayload(state, category, write) {
        const hasAmbiguousLines = state.unattributedLinesAdded > 0 || state.unattributedLinesDeleted > 0;
        const hasHumanEvidence = write ||
            state.humanLinesAdded > 0 ||
            state.humanLinesDeleted > 0 ||
            state.keystrokes > 0 ||
            state.charsAdded > 0 ||
            state.charsDeleted > 0 ||
            state.activitySegments.length > 0;
        // `state.aiEventId` is set only when this flush is reporting an edit the broker
        // sidecar already matched to an agent (see classifyPendingAttribution). That takes
        // priority over `write`: a save that immediately follows an agent-owned edit must
        // not fall back to Human just because a save happened, since every human-side
        // counter was already zeroed for this exact edit.
        const aiAttribution = state.aiEventId
            ? {
                actor_type: (state.aiActorType ??
                    (state.aiConfidence === "verified" ? "ai_verified" : "ai_inferred")),
                actor_confidence: state.aiActorConfidence ?? (state.aiConfidence === "verified" ? 1 : 0.6),
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
                actor_type: (hasAmbiguousLines ? "unknown" : hasHumanEvidence ? "human" : "unknown"),
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
            active_seconds: (0, activity_1.unionSeconds)(state.activitySegments),
            heartbeat_id: state.heartbeatId,
            activity_segments: state.activitySegments.length > 0 ? state.activitySegments : undefined,
            ...aiAttribution
        };
    }
    async classifyPendingAttribution(state, now) {
        if (state.humanLinesAdded === 0 && state.humanLinesDeleted === 0) {
            return;
        }
        const { attribution, event } = await this.aiAttributionStore.classify(state.entity, state.lastEditAt ?? state.lastActivityAt ?? now, state.humanLinesAdded, state.humanLinesDeleted);
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
        state.activeSeconds = (0, activity_1.unionSeconds)(state.activitySegments);
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
            state.aiActorType = event?.actor_type;
            state.aiActorConfidence = event?.actor_confidence;
            state.aiLinesAdded = event?.lines_added ?? undefined;
            state.aiLinesDeleted = event?.lines_deleted ?? undefined;
        }
    }
    observeActivity(state, now) {
        const previous = this.lastObservedActivityAt;
        if (previous !== undefined) {
            const elapsedMs = now - previous;
            // Strict Wakaclock timing gives a heartbeat the interval to the next activity only
            // while the gap is at most 120 seconds.
            if (elapsedMs >= 0 && elapsedMs <= activity_1.MAX_ACTIVITY_GAP_MS) {
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
                    (0, activity_1.appendSegment)(previousState.activitySegments, {
                        segment_id: (0, node_crypto_1.randomUUID)(),
                        start,
                        end,
                        source: "editor"
                    });
                    previousState.activeSeconds = (0, activity_1.unionSeconds)(previousState.activitySegments);
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
    clearMeasurements(state) {
        state.keystrokes = 0;
        state.charsAdded = 0;
        state.charsDeleted = 0;
        state.humanLinesAdded = 0;
        state.humanLinesDeleted = 0;
        state.unattributedLinesAdded = 0;
        state.unattributedLinesDeleted = 0;
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
    captureSnapshot(state, category, write) {
        state.heartbeatId ||= (0, node_crypto_1.randomUUID)();
        const snapshot = {
            payload: this.buildPayload(state, category, write),
            category,
            write,
            activitySegments: state.activitySegments.map((segment) => ({ ...segment })),
            activeSeconds: (0, activity_1.unionSeconds)(state.activitySegments),
            keystrokes: state.keystrokes,
            charsAdded: state.charsAdded,
            charsDeleted: state.charsDeleted,
            humanLinesAdded: state.humanLinesAdded,
            humanLinesDeleted: state.humanLinesDeleted,
            unattributedLinesAdded: state.unattributedLinesAdded,
            unattributedLinesDeleted: state.unattributedLinesDeleted,
            pendingWrite: state.pendingWrite,
            lastEditAt: state.lastEditAt,
            lastActivityAt: state.lastActivityAt
        };
        this.clearMeasurements(state);
        return snapshot;
    }
    commitSnapshot(entity, now, _snapshot) {
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
    clearEmptyState(state) {
        if (!this.hasPendingActivity(state)) {
            state.lastEditAt = undefined;
            state.lastActivityAt = undefined;
            state.pendingWrite = false;
        }
    }
    enqueueFlush(operation) {
        const result = this.flushTail.catch(() => undefined).then(operation);
        this.flushTail = result.then(() => undefined, () => undefined);
        return result;
    }
    updateSelectionState(state, selection) {
        const metrics = (0, utils_1.getSelectionMetrics)(selection);
        state.lineNumber = metrics.lineNumber;
        state.cursorPosition = metrics.cursorPosition;
    }
    updateProjectState(state, project) {
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
exports.HeartbeatBufferManager = HeartbeatBufferManager;
//# sourceMappingURL=buffer.js.map