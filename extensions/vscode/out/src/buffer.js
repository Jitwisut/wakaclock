"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeartbeatBufferManager = void 0;
const node_crypto_1 = require("node:crypto");
const aiAttribution_1 = require("./aiAttribution");
const activity_1 = require("./activity");
const node_crypto_2 = require("node:crypto");
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
    async recordTextChange(document, changes, selection, now = Date.now(), project, changeReason, paste) {
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
        state.heartbeatId ||= (0, node_crypto_2.randomUUID)();
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
            }
            else if (paste.origin === "same_workspace") {
                state.pasteSameWorkspaceActions += 1;
            }
            else {
                state.pasteExternalOrUnknownActions += 1;
            }
            state.unattributedLinesAdded += summary.linesAdded;
            state.unattributedLinesDeleted += summary.linesDeleted;
        }
        else if (changeReason !== TEXT_DOCUMENT_CHANGE_REASON_UNDO &&
            changeReason !== TEXT_DOCUMENT_CHANGE_REASON_REDO) {
            state.humanLinesAdded += summary.linesAdded;
            state.humanLinesDeleted += summary.linesDeleted;
        }
        const contentFingerprint = fingerprintDocument(document);
        for (const change of changes) {
            const changeSummary = (0, utils_1.summarizeTextChanges)([change]);
            if (changeSummary.linesAdded === 0 && changeSummary.linesDeleted === 0) {
                continue;
            }
            state.pendingEditorChanges.push({
                timeMs: now,
                linesAdded: changeSummary.linesAdded,
                linesDeleted: changeSummary.linesDeleted,
                contentFingerprint
            });
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
    async recordClipboardCopy(document, metrics, now = Date.now(), project) {
        if (!this.getConfig().trackClipboardActions || !(0, utils_1.isFileDocument)(document)) {
            return;
        }
        const entity = (0, utils_1.normalizeFsPath)(document.uri.fsPath);
        const state = this.getOrCreateState(entity);
        this.updateProjectState(state, project);
        this.observeActivity(state, now);
        state.heartbeatId ||= (0, node_crypto_2.randomUUID)();
        state.copyActions += 1;
        state.copiedChars += metrics.copiedChars;
        state.copiedLines += metrics.copiedLines;
        this.onActivity?.();
        if (state.lastHeartbeatAt === undefined ||
            now - state.lastHeartbeatAt >= this.getConfig().heartbeatRateLimitMs) {
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
        state.heartbeatId ||= (0, node_crypto_2.randomUUID)();
        state.pendingWrite = true;
        this.onActivity?.();
        await this.flushFile(entity, "save", { now, write: true, force: true });
    }
    /**
     * Correlate an OS-level workspace write with the broker's native AI event. The
     * broker owns the attribution decision; this method only sends metadata and emits
     * the old unknown fallback if the 15-second observation window expires.
     */
    async recordExternalFileChange(entity, metadata = {}, now = Date.now(), project, workspaceRoot) {
        const normalizedEntity = (0, utils_1.normalizeFsPath)(entity);
        const normalizedWorkspaceRoot = workspaceRoot ? (0, utils_1.normalizeFsPath)(workspaceRoot) : undefined;
        if (!normalizedEntity)
            return;
        const sendObservation = this.cli.sendEditorObservation;
        const getObservationStatus = this.cli.getEditorObservationStatus;
        const observationId = metadata.event_id ??
            `observer:${(0, node_crypto_1.createHash)("sha256")
                .update(normalizedEntity)
                .update("\0")
                .update(metadata.change_kind ?? "modify")
                .update("\0")
                .update(metadata.content_fingerprint ?? String(now))
                .digest("hex")}`;
        if (sendObservation && getObservationStatus && normalizedWorkspaceRoot) {
            const observation = {
                schema_version: 1,
                observation_id: observationId,
                editor: "vscode",
                entity: normalizedEntity,
                workspace_root: normalizedWorkspaceRoot,
                occurred_at: new Date(now).toISOString(),
                change_kind: metadata.change_kind ?? "modify",
                previous_entity: metadata.previous_entity
                    ? (0, utils_1.normalizeFsPath)(metadata.previous_entity)
                    : undefined,
                lines_added: metadata.lines_added,
                lines_deleted: metadata.lines_deleted,
                content_fingerprint: metadata.content_fingerprint,
            };
            try {
                let status = await sendObservation.call(this.cli, observation);
                if (status.status === "matched")
                    return;
                const deadline = Date.now() + 15_000;
                while (status.status !== "expired" && Date.now() < deadline) {
                    await wait(250);
                    status = await getObservationStatus.call(this.cli, observationId);
                    if (status.status === "matched")
                        return;
                }
                if (status.status !== "expired") {
                    // Treat a silent/legacy broker as unmatched after the bounded window.
                    this.logger.debug("editor observation window elapsed", {
                        entity: normalizedEntity,
                        observationId,
                    });
                }
            }
            catch (error) {
                this.logger.debug("editor observation submission failed", {
                    entity: normalizedEntity,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        const payload = {
            entity: normalizedEntity,
            entity_type: "file",
            project,
            category: "coding",
            write: true,
            active_seconds: 0,
            heartbeat_id: observationId,
            actor_type: "unknown",
            actor_confidence: 0,
            unattributed_lines_added: metadata.lines_added,
            unattributed_lines_deleted: metadata.lines_deleted,
        };
        try {
            await this.cli.sendHeartbeat(normalizedEntity, true, "coding", [], payload);
            this.onHeartbeatSent?.();
            this.logger.debug("flushed unmatched external file-change heartbeat", {
                entity: normalizedEntity,
                changeKind: metadata.change_kind ?? "modify",
            });
        }
        catch (error) {
            this.logger.error(`failed to flush external heartbeat for ${normalizedEntity}`, { error });
        }
    }
    forgetDocument(document) {
        const entity = (0, utils_1.normalizeFsPath)(document.uri.fsPath);
        const state = this.states.get(entity);
        if (state && !this.hasPendingActivity(state))
            this.states.delete(entity);
    }
    async recordEditorSwitch(previousEditor, currentEditorOrNow, now = Date.now(), project) {
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
            this.updateProjectState(state, project);
            this.updateSelectionState(state, currentEditor?.selection);
            this.observeActivity(state, now);
            state.pendingPresence = true;
            state.heartbeatId ||= (0, node_crypto_2.randomUUID)();
            this.onActivity?.();
            // A switch is an activity marker even when the file has no pending edits.
            await this.flushFile(currentEntity, "switch", { now, force: true });
            this.logger.debug("recorded active editor switch", {
                entity: state.entity,
                previousEntity
            });
        }
    }
    async updateCursor(document, selection, project, now = Date.now()) {
        if (!(0, utils_1.isFileDocument)(document)) {
            return;
        }
        const entity = (0, utils_1.normalizeFsPath)(document.uri.fsPath);
        const state = this.getOrCreateState(entity);
        this.updateProjectState(state, project);
        this.updateSelectionState(state, selection);
        this.observeActivity(state, now);
        this.onActivity?.();
        // A sparse navigation/read session may never create an activity segment: the next
        // cursor event can be more than the strict 120-second evidence window away. Emit
        // the first rate-eligible instant as a zero-duration anchor, matching WakaTime.
        if (state.lastHeartbeatAt === undefined ||
            now - state.lastHeartbeatAt >= this.getConfig().heartbeatRateLimitMs) {
            state.pendingPresence = true;
            state.heartbeatId ||= (0, node_crypto_2.randomUUID)();
            await this.flushFile(entity, "gap", { now });
        }
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
            // A producer may prove only part of a whole-file overwrite (for example a
            // Write hook reports added lines but VS Code observes the deleted old file).
            // Keep the residual unknown counters attached to the AI event until save/timer
            // gives us a durable heartbeat; an automatic gap flush must not emit a second
            // editor heartbeat for an edit already owned by the broker.
            if (!force &&
                reason === "gap" &&
                state.aiEventId !== undefined &&
                state.activitySegments.length === 0 &&
                state.humanLinesAdded === 0 &&
                state.humanLinesDeleted === 0 &&
                state.keystrokes === 0 &&
                state.charsAdded === 0 &&
                state.charsDeleted === 0 &&
                state.copyActions === 0 &&
                state.pasteActions === 0 &&
                !state.pendingWrite) {
                return;
            }
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
            copyActions: 0,
            pasteActions: 0,
            copiedChars: 0,
            copiedLines: 0,
            pastedChars: 0,
            pastedLines: 0,
            pasteSameFileActions: 0,
            pasteSameWorkspaceActions: 0,
            pasteExternalOrUnknownActions: 0,
            pendingPresence: false,
            pendingWrite: false,
            pendingEditorChanges: []
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
            state.copyActions > 0 ||
            state.pasteActions > 0 ||
            state.pendingPresence ||
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
        const clipboardEnabled = this.getConfig().trackClipboardActions;
        const hasAmbiguousLines = state.unattributedLinesAdded > 0 || state.unattributedLinesDeleted > 0;
        const hasHumanEvidence = write ||
            state.humanLinesAdded > 0 ||
            state.humanLinesDeleted > 0 ||
            state.keystrokes > 0 ||
            state.charsAdded > 0 ||
            state.charsDeleted > 0 ||
            state.copyActions > 0 ||
            state.pendingPresence ||
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
            active_seconds: (0, activity_1.unionSeconds)(state.activitySegments),
            heartbeat_id: state.heartbeatId,
            activity_segments: state.activitySegments.length > 0 ? state.activitySegments : undefined,
            ...aiAttribution
        };
    }
    async classifyPendingAttribution(state, now) {
        if (state.humanLinesAdded === 0 && state.humanLinesDeleted === 0) {
            state.pendingEditorChanges = [];
            return;
        }
        const observations = state.pendingEditorChanges.length > 0
            ? state.pendingEditorChanges.splice(0)
            : [{
                    timeMs: state.lastEditAt ?? state.lastActivityAt ?? now,
                    linesAdded: state.humanLinesAdded,
                    linesDeleted: state.humanLinesDeleted
                }];
        let humanLinesAdded = 0;
        let humanLinesDeleted = 0;
        let aiLinesAdded = 0;
        let aiLinesDeleted = 0;
        let unattributedLinesAdded = 0;
        let unattributedLinesDeleted = 0;
        let matchedEvent;
        for (const observation of observations) {
            const result = await this.aiAttributionStore.classify(state.entity, observation.timeMs, observation.linesAdded, observation.linesDeleted, observation.contentFingerprint, observation.toolEventId, observations.length > 1);
            if (result.attribution === "human") {
                humanLinesAdded += observation.linesAdded;
                humanLinesDeleted += observation.linesDeleted;
            }
            else if (result.attribution === "ai") {
                aiLinesAdded += result.ai_lines_added ?? observation.linesAdded;
                aiLinesDeleted += result.ai_lines_deleted ?? observation.linesDeleted;
                unattributedLinesAdded += result.unattributed_lines_added ?? 0;
                unattributedLinesDeleted += result.unattributed_lines_deleted ?? 0;
                matchedEvent ??= result.event;
            }
            else {
                unattributedLinesAdded +=
                    result.unattributed_lines_added ?? observation.linesAdded;
                unattributedLinesDeleted +=
                    result.unattributed_lines_deleted ?? observation.linesDeleted;
            }
        }
        state.humanLinesAdded = humanLinesAdded;
        state.humanLinesDeleted = humanLinesDeleted;
        state.unattributedLinesAdded += unattributedLinesAdded;
        state.unattributedLinesDeleted += unattributedLinesDeleted;
        if (aiLinesAdded === 0 && aiLinesDeleted === 0) {
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
        state.aiLinesAdded = aiLinesAdded;
        state.aiLinesDeleted = aiLinesDeleted;
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
        state.activeSeconds = (0, activity_1.unionSeconds)(state.activitySegments);
        // Only carry the matched event's provenance onto the payload when nothing
        // developer-earned survived the truncation above. If a segment remains, the
        // developer's own time is still in this flush and the payload must report Human
        // for it — the agent's own attribution already reaches the server independently,
        // through the CLI/broker path that classified this edit in the first place.
        // Reporting `ai_verified` here on top of a surviving human segment would relabel
        // the developer's own earned seconds as AI activity server-side.
        if (state.activitySegments.length === 0) {
            state.aiEventId = matchedEvent?.event_id;
            state.aiAgent = matchedEvent?.agent;
            state.aiProvider = matchedEvent?.provider;
            state.aiModel = matchedEvent?.model;
            state.aiSource = matchedEvent?.source;
            state.aiConfidence = matchedEvent?.confidence;
            state.aiActorType = matchedEvent?.actor_type;
            state.aiActorConfidence = matchedEvent?.actor_confidence;
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
                        segment_id: (0, node_crypto_2.randomUUID)(),
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
        state.copyActions = 0;
        state.pasteActions = 0;
        state.copiedChars = 0;
        state.copiedLines = 0;
        state.pastedChars = 0;
        state.pastedLines = 0;
        state.pasteSameFileActions = 0;
        state.pasteSameWorkspaceActions = 0;
        state.pasteExternalOrUnknownActions = 0;
        state.pendingPresence = false;
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
    captureSnapshot(state, category, write) {
        state.heartbeatId ||= (0, node_crypto_2.randomUUID)();
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
function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
/** Metadata-only content identity used for exact cross-producer reconciliation. */
function fingerprintDocument(document) {
    if (typeof document.getText !== "function") {
        return undefined;
    }
    try {
        return `sha256:${(0, node_crypto_1.createHash)("sha256").update(document.getText()).digest("hex")}`;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=buffer.js.map