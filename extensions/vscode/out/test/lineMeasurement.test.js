"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const lineMeasurement_1 = require("../src/lineMeasurement");
const buffer_1 = require("../src/buffer");
const logging_1 = require("../src/logging");
const entity = "/project/example.ts";
const doc = (text, version) => ({ uri: { scheme: "file", fsPath: entity }, getText: () => text, version });
const config = () => ({ cliPath: "wakaclock", flushIntervalMs: 30_000, heartbeatRateLimitMs: 120_000, sameFileHeartbeatMs: 120_000, idleMs: 120_000, statusBarEnabled: true, debugLogging: false, trackDebugSessions: true, trackBuildTasks: true, trackClipboardActions: true });
const manager = (store = { classify: vitest_1.vi.fn().mockResolvedValue({ attribution: "unattributed" }) }) => {
    const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    return { buffer: new buffer_1.HeartbeatBufferManager(config, { sendHeartbeat }, new logging_1.Logger(() => false), undefined, store), sendHeartbeat, store };
};
(0, vitest_1.describe)("bounded before/after editor lines", () => {
    vitest_1.it.each([
        ["", "abc", 1, 0], ["abc", "", 0, 1], ["abc", "xyz", 1, 1],
        ["same\nold\nend\n", "same\nnew\nend\n", 1, 1],
        ["a\r\nb\r\n", "a\nb\n", 0, 0], ["", "\n", 1, 0],
        ["α\n🙂", "α\n🚀", 1, 1], ["a\nb\na", "b\na\nb", 1, 1],
        ["a\n", "a", 0, 0]
    ])("measures %j → %j", (before, after, added, deleted) => {
        (0, vitest_1.expect)((0, lineMeasurement_1.measureLineDelta)(before, after)).toEqual({ status: "measured", linesAdded: added, linesDeleted: deleted });
    });
    (0, vitest_1.it)("returns unavailable for large documents and expensive dissimilar diffs", () => {
        (0, vitest_1.expect)((0, lineMeasurement_1.measureLineDelta)("", "x".repeat(512 * 1024 + 1))).toEqual({ status: "unavailable", reason: "document_too_large" });
        (0, vitest_1.expect)((0, lineMeasurement_1.measureLineDelta)("a\n".repeat(20_001), "")).toEqual({ status: "unavailable", reason: "document_too_large" });
        (0, vitest_1.expect)((0, lineMeasurement_1.measureLineDelta)("a\n".repeat(1001), "b\n".repeat(1001))).toEqual({ status: "unavailable", reason: "diff_budget_exceeded" });
        // Common context is trimmed before the work budget; a large one-line edit is cheap.
        (0, vitest_1.expect)((0, lineMeasurement_1.measureLineDelta)("a\n".repeat(10_000) + "old", "a\n".repeat(10_000) + "new")).toMatchObject({ status: "measured", linesAdded: 1, linesDeleted: 1 });
    });
    (0, vitest_1.it)("does not guess a baseline on first change, restart, or eviction", () => {
        const tracker = new lineMeasurement_1.DocumentLineMeasurements();
        tracker.change(entity, doc("after", 2), false);
        (0, vitest_1.expect)(tracker.close(entity)).toMatchObject({ status: "unavailable", reason: "baseline_missing" });
        tracker.change(entity, doc("next", 3), false);
        (0, vitest_1.expect)(tracker.close(entity)).toMatchObject({ status: "measured", linesAdded: 1, linesDeleted: 1 });
        tracker.forget(entity);
        tracker.change(entity, doc("reopened", 4), false);
        (0, vitest_1.expect)(tracker.close(entity)).toMatchObject({ status: "unavailable", reason: "baseline_missing" });
        for (let i = 0; i < 16; i++)
            tracker.observe(`/project/${i}`, doc("unrelated", 1));
        tracker.change(entity, doc("evicted", 5), false);
        (0, vitest_1.expect)(tracker.close(entity)).toMatchObject({ status: "unavailable", reason: "baseline_missing" });
    });
    (0, vitest_1.it)("invalidates missing versions, missed events, external reloads and failed reads", () => {
        for (const after of [doc("after", 3), { ...doc("after", 2), version: undefined }]) {
            const tracker = new lineMeasurement_1.DocumentLineMeasurements();
            tracker.observe(entity, doc("before", 1));
            tracker.change(entity, after, false);
            (0, vitest_1.expect)(tracker.close(entity)).toMatchObject({ status: "unavailable", reason: "version_discontinuity" });
        }
        const tracker = new lineMeasurement_1.DocumentLineMeasurements();
        tracker.observe(entity, doc("before", 1));
        tracker.observe(entity, doc("external", 2));
        tracker.change(entity, doc("after", 3), false);
        (0, vitest_1.expect)(tracker.close(entity)).toMatchObject({ status: "unavailable", reason: "version_discontinuity" });
        tracker.change(entity, { ...doc("", 4), getText: () => { throw new Error("closed"); } }, false);
        (0, vitest_1.expect)(tracker.close(entity)).toMatchObject({ status: "unavailable", reason: "document_unavailable" });
    });
});
(0, vitest_1.describe)("editor measurement integration", () => {
    (0, vitest_1.it)("gives identical churn for identical flush boundaries regardless of event batching", async () => {
        const results = [];
        for (const values of [["a", "ab", "abc"], ["abc"]]) {
            const { buffer, sendHeartbeat } = manager();
            await buffer.recordSave(doc("", 1), 0);
            let version = 1;
            for (const text of values)
                await buffer.recordTextChange(doc(text, ++version), [{ text: text.slice(values.length === 1 ? 0 : -1), rangeLength: 0 }], undefined, version);
            await buffer.recordSave(doc("abc", version), 10);
            const measured = buffer.getLastLineMeasurement(entity);
            results.push([measured.status, measured.linesAdded, measured.linesDeleted]);
            (0, vitest_1.expect)(measured).toMatchObject({ metricVersion: "editor-before-after-v1", boundary: "flush" });
            const payload = sendHeartbeat.mock.calls.at(-1)[4];
            (0, vitest_1.expect)(payload).toMatchObject({
                actor_type: "unknown",
                chars_added: 3,
                line_metric_version: "editor-before-after-v1",
                line_measurement_status: "measured",
                unattributed_lines_added: 1,
                unattributed_lines_deleted: 0,
            });
            (0, vitest_1.expect)(payload.human_lines_added).toBeUndefined();
            (0, vitest_1.expect)(payload.keystrokes).toBeUndefined();
            (0, vitest_1.expect)(payload.measurement_window_id).toBe(payload.heartbeat_id);
            // A random heartbeat id may legitimately contain the letters "abc"; check
            // the metadata shape instead of making a probabilistic string assertion.
            (0, vitest_1.expect)(payload).not.toHaveProperty("content");
            (0, vitest_1.expect)(payload).not.toHaveProperty("text");
            (0, vitest_1.expect)(payload).not.toHaveProperty("diff");
            (0, vitest_1.expect)(JSON.stringify(measured)).not.toContain("abc");
        }
        (0, vitest_1.expect)(results).toEqual([["measured", 1, 0], ["measured", 1, 0]]);
    });
    (0, vitest_1.it)("makes undo within a window zero and undo across windows new churn with unknown authorship", async () => {
        const { buffer, store } = manager();
        await buffer.recordSave(doc("old", 1), 0);
        await buffer.recordTextChange(doc("new", 2), [{ text: "new", rangeLength: 3 }], undefined, 1);
        await buffer.recordTextChange(doc("old", 3), [{ text: "old", rangeLength: 3 }], undefined, 2, undefined, 1);
        await buffer.recordSave(doc("old", 3), 3);
        (0, vitest_1.expect)(buffer.getLastLineMeasurement(entity)).toMatchObject({ status: "measured", linesAdded: 0, linesDeleted: 0, containsReplay: true });
        await buffer.recordTextChange(doc("new", 4), [{ text: "new", rangeLength: 3 }], undefined, 4, undefined, 2);
        await buffer.recordSave(doc("new", 4), 5);
        (0, vitest_1.expect)(buffer.getLastLineMeasurement(entity)).toMatchObject({ status: "measured", linesAdded: 1, linesDeleted: 1, containsReplay: true });
        (0, vitest_1.expect)(store.classify).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("never assigns a mixed window to the first or final model", async () => {
        const { buffer, sendHeartbeat, store } = manager();
        await buffer.recordSave(doc("", 1), 0);
        await buffer.recordTextChange(doc("first", 2), [{ text: "first", rangeLength: 0 }], undefined, 1);
        await buffer.recordTextChange(doc("first\nsecond", 3), [{ text: "\nsecond", rangeLength: 0 }], undefined, 2);
        await buffer.recordSave(doc("first\nsecond", 3), 3);
        (0, vitest_1.expect)(store.classify).not.toHaveBeenCalled();
        (0, vitest_1.expect)(sendHeartbeat.mock.calls.at(-1)[4].actor_type).toBe("unknown");
        (0, vitest_1.expect)(sendHeartbeat.mock.calls.at(-1)[4].ai_model).toBeUndefined();
        (0, vitest_1.expect)(buffer.getLastLineMeasurement(entity)).toMatchObject({ linesAdded: 2, linesDeleted: 0 });
    });
    (0, vitest_1.it)("sends supporting AI provenance on save without duplicating producer line totals", async () => {
        const classify = vitest_1.vi.fn().mockResolvedValue({
            attribution: "ai", ai_lines_added: 1, ai_lines_deleted: 0,
            event: { event_id: "operation-1", agent: "codex", model: "model-a", actor_type: "ai_verified", actor_confidence: 1 }
        });
        const { buffer, sendHeartbeat } = manager({ classify });
        await buffer.recordSave(doc("", 1), 0);
        await buffer.recordTextChange(doc("generated", 2), [{ text: "generated", rangeLength: 0 }], undefined, 1);
        await buffer.recordSave(doc("generated", 2), 1);
        const payload = sendHeartbeat.mock.calls.at(-1)[4];
        (0, vitest_1.expect)(payload).toMatchObject({ actor_type: "ai_verified", ai_event_id: "operation-1", ai_model: "model-a" });
        (0, vitest_1.expect)(payload.ai_lines_added).toBeUndefined();
        (0, vitest_1.expect)(payload.ai_lines_deleted).toBeUndefined();
        (0, vitest_1.expect)(payload.chars_added).toBeUndefined();
        (0, vitest_1.expect)(payload.active_seconds).toBe(0);
    });
    (0, vitest_1.it)("detaches measurements before attribution I/O and keeps a failed retry immutable", async () => {
        let resolveClassification;
        const classify = vitest_1.vi.fn().mockImplementationOnce(() => new Promise((resolve) => { resolveClassification = resolve; })).mockResolvedValue({ attribution: "unattributed" });
        const { buffer, sendHeartbeat } = manager({ classify });
        await buffer.recordSave(doc("", 1), 0);
        await buffer.recordTextChange(doc("first", 2), [{ text: "first", rangeLength: 0 }], undefined, 1);
        sendHeartbeat.mockRejectedValueOnce(new Error("offline"));
        const flushing = buffer.recordSave(doc("first", 2), 2);
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(classify).toHaveBeenCalledTimes(1));
        await buffer.recordTextChange(doc("first\nsecond", 3), [{ text: "\nsecond", rangeLength: 0 }], undefined, 3);
        resolveClassification({ attribution: "unattributed" });
        await flushing;
        const failedPayload = sendHeartbeat.mock.calls.at(-1)[4];
        (0, vitest_1.expect)(failedPayload.chars_added).toBe(5);
        (0, vitest_1.expect)(buffer.getLastLineMeasurement(entity)).toMatchObject({ linesAdded: 1, linesDeleted: 0, afterVersion: 2 });
        await buffer.recordSave(doc("first\nsecond", 3), 4);
        const retried = sendHeartbeat.mock.calls.at(-1);
        (0, vitest_1.expect)(retried[4]).toEqual(failedPayload);
        (0, vitest_1.expect)(retried[3][0]).toMatchObject({ chars_added: 7 });
        (0, vitest_1.expect)(retried[3][0].heartbeat_id).not.toBe(failedPayload.heartbeat_id);
        (0, vitest_1.expect)(buffer.getLastLineMeasurement(entity)).toMatchObject({ linesAdded: 1, linesDeleted: 0, beforeVersion: 2, afterVersion: 3 });
    });
});
//# sourceMappingURL=lineMeasurement.test.js.map