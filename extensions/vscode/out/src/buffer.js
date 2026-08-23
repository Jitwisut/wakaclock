"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeartbeatBufferManager = void 0;
const aiAttribution_1 = require("./aiAttribution");
const utils_1 = require("./utils");
class HeartbeatBufferManager {
    getConfig;
    cli;
    logger;
    onHeartbeatSent;
    aiAttributionStore;
    states = new Map();
    /**
     * One global activity cursor prevents two open files from claiming the same wall-clock
     * interval. WakaTime derives a mini-duration from each heartbeat to the next one; this
     * cursor provides the equivalent accounting while wakaclock still stores an explicit
     * `active_seconds` value on each heartbeat.
    */
    lastObservedActivityAt;
    lastObservedEntity;
    constructor(getConfig, cli, logger, onHeartbeatSent, aiAttributionStore = new aiAttribution_1.AiAttributionStore()) {
        this.getConfig = getConfig;
        this.cli = cli;
        this.logger = logger;
        this.onHeartbeatSent = onHeartbeatSent;
        this.aiAttributionStore = aiAttributionStore;
    }
    async recordTextChange(document, changes, selection, now = Date.now(), project) {
        if (!(0, utils_1.isFileDocument)(document) || changes.length === 0) {
            return;
        }
        const entity = (0, utils_1.normalizeFsPath)(document.uri.fsPath);
        const state = this.getOrCreateState(entity);
        this.updateProjectState(state, project);
        const summary = (0, utils_1.summarizeTextChanges)(changes);
        this.observeActivity(state, now);
        // Cross-file duration accounting may advance `lastActivityAt` on this state while
        // another file is edited. Attribution must use the actual editor-change timestamp,
        // otherwise a nearby AI sidecar event can fall outside the correlation window.
        state.lastEditAt = now;
        state.keystrokes += summary.keystrokes;
        state.charsAdded += summary.charsAdded;
        state.charsDeleted += summary.charsDeleted;
        state.humanLinesAdded += summary.linesAdded;
        state.humanLinesDeleted += summary.linesDeleted;
        this.updateSelectionState(state, selection);
        if (state.lastHeartbeatAt &&
            now - state.lastHeartbeatAt >= this.getConfig().sameFileHeartbeatMs &&
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
        state.pendingWrite = true;
        await this.flushFile(entity, "save", { now, write: true, force: true });
    }
    async recordEditorSwitch(previousEditor, now = Date.now()) {
        const entity = (0, utils_1.getEditorEntity)(previousEditor);
        if (!entity) {
            return;
        }
        await this.flushFile(entity, "switch", { now });
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
        const duePayloads = [];
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
            await this.cli.sendHeartbeat(primary.entity, primary.write, primary.category, rest.map((item) => item.payload), primary.payload);
            for (const item of duePayloads) {
                this.markFlushed(item.entity, item.now);
            }
            this.onHeartbeatSent?.();
        }
        catch (error) {
            this.logger.error("failed to flush buffered heartbeats", error);
        }
    }
    async flushFile(entity, reason, overrides = {}) {
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
            activeSeconds: 0,
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
            state.unattributedLinesDeleted > 0);
    }
    shouldFlushOnTimer(state, now) {
        const { idleMs } = this.getConfig();
        if (!this.hasPendingActivity(state)) {
            return false;
        }
        if (state.lastActivityAt === undefined) {
            return false;
        }
        return now - state.lastActivityAt <= idleMs;
    }
    buildPayload(state, category, write) {
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
            active_seconds: state.activeSeconds
        };
    }
    async classifyPendingAttribution(state, now) {
        if (state.humanLinesAdded === 0 && state.humanLinesDeleted === 0) {
            return;
        }
        const attribution = await this.aiAttributionStore.classifyRecentEdit(state.entity, state.lastEditAt ?? state.lastActivityAt ?? now, state.humanLinesAdded, state.humanLinesDeleted);
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
        // interacting with the editor. Keep the existing no-duplicate-heartbeat behaviour;
        // a later save can still emit a zero-duration write marker.
        state.activeSeconds = 0;
    }
    observeActivity(state, now) {
        const previous = this.lastObservedActivityAt;
        if (previous !== undefined) {
            const elapsedMs = now - previous;
            const { idleMs } = this.getConfig();
            // WakaTime gives a heartbeat the interval to the next heartbeat only while the
            // gap is below the user's keystroke timeout. Use the same strict boundary and do
            // not invent a minimum duration for an isolated event.
            if (elapsedMs >= 0 && elapsedMs < idleMs) {
                // Attribute the interval to the earlier activity's file, just as WakaTime's
                // heartbeat-to-next-heartbeat mini-duration algorithm does. The state remains
                // in the map after a flush, so a later event can safely account for a thinking
                // interval without double-counting it or assigning it to the newly opened file.
                const previousState = this.lastObservedEntity
                    ? this.states.get(this.lastObservedEntity)
                    : undefined;
                if (previousState) {
                    previousState.activeSeconds += elapsedMs / 1000;
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
    markFlushed(entity, now) {
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
        state.unattributedLinesAdded = 0;
        state.unattributedLinesDeleted = 0;
        state.activeSeconds = 0;
        state.lastEditAt = undefined;
        state.lastActivityAt = undefined;
        state.pendingWrite = false;
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