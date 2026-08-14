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
    updateCursor(document, selection, project) {
        if (!(0, utils_1.isFileDocument)(document)) {
            return;
        }
        const entity = (0, utils_1.normalizeFsPath)(document.uri.fsPath);
        const state = this.getOrCreateState(entity);
        this.updateProjectState(state, project);
        this.updateSelectionState(state, selection);
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
    hasPendingActivity(state) {
        return (state.pendingWrite ||
            state.keystrokes > 0 ||
            state.charsAdded > 0 ||
            state.charsDeleted > 0 ||
            state.humanLinesAdded > 0 ||
            state.humanLinesDeleted > 0);
    }
    hasTrackedActivity(state) {
        return (state.keystrokes > 0 ||
            state.charsAdded > 0 ||
            state.charsDeleted > 0 ||
            state.humanLinesAdded > 0 ||
            state.humanLinesDeleted > 0);
    }
    shouldFlushOnTimer(state, now) {
        const { idleMs } = this.getConfig();
        if (!this.hasPendingActivity(state)) {
            return false;
        }
        if (!state.lastKeystrokeAt) {
            return false;
        }
        return now - state.lastKeystrokeAt <= idleMs;
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
            active_seconds: this.estimateActiveSeconds(state)
        };
    }
    async classifyPendingAttribution(state, now) {
        if (state.humanLinesAdded === 0 && state.humanLinesDeleted === 0) {
            return;
        }
        const matchedAiEdit = await this.aiAttributionStore.matchesRecentEdit(state.entity, state.lastActivityAt ?? now, state.humanLinesAdded, state.humanLinesDeleted);
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
    estimateActiveSeconds(state) {
        if (!this.hasTrackedActivity(state)) {
            return 0;
        }
        const start = state.firstActivityAt ?? state.lastActivityAt ?? Date.now();
        const end = state.lastActivityAt ?? start;
        const elapsedSeconds = Math.max(0, (end - start) / 1000);
        const maxWindowSeconds = Math.max(1, this.getConfig().flushIntervalMs / 1000);
        return Math.min(Math.max(elapsedSeconds, 1), maxWindowSeconds);
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
        state.firstActivityAt = undefined;
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