"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("node:fs/promises"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const vitest_1 = require("vitest");
const aiAttribution_1 = require("../src/aiAttribution");
const buffer_1 = require("../src/buffer");
const logging_1 = require("../src/logging");
function fileUri(fsPath) {
    return { scheme: "file", fsPath };
}
function selection(line, character) {
    return { active: { line, character } };
}
function editor(fsPath) {
    return { document: { uri: fileUri(fsPath) } };
}
function createConfig() {
    return {
        cliPath: "wakaclock-cli",
        flushIntervalMs: 30_000,
        heartbeatRateLimitMs: 120_000,
        sameFileHeartbeatMs: 120_000,
        idleMs: 300_000,
        statusBarEnabled: true,
        debugLogging: false,
        trackDebugSessions: true,
        trackBuildTasks: true
    };
}
(0, vitest_1.describe)("HeartbeatBufferManager", () => {
    (0, vitest_1.it)("does not call an editor change Human when broker line evidence is unknown", async () => {
        const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
        try {
            const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
            await fs.mkdir(path.dirname(logPath), { recursive: true });
            await fs.writeFile(logPath, JSON.stringify({
                event_id: "shell-unknown-lines",
                entity: "C:/project/a.ts",
                time: 10,
                lines_added: null,
                lines_deleted: null
            }) + "\n");
            await (0, vitest_1.expect)(new aiAttribution_1.AiAttributionStore(homeDir).classifyRecentEdit("C:/project/a.ts", 10_000, 2, 0)).resolves.toBe("unattributed");
        }
        finally {
            await fs.rm(homeDir, { recursive: true, force: true });
        }
    });
    (0, vitest_1.it)("text changes send the first heartbeat immediately", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "hello", rangeLength: 0 }], selection(4, 2), 1_000, "Daniel");
        await manager.flushDueBuffers("timer", 31_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledWith("C:/project/a.ts", false, "coding", [], vitest_1.expect.objectContaining({
            project: "Daniel",
            keystrokes: 5,
            chars_added: 5,
            // Like WakaTime, one isolated heartbeat has no duration until another
            // editor activity establishes the interval after it.
            active_seconds: 0,
            human_lines_added: 1,
            actor_type: "human",
            actor_confidence: 1,
            line_number: 5,
            cursor_position: 3
        }));
    });
    (0, vitest_1.it)("does not count an undo/redo replay as new lines, but still reports presence", async () => {
        // TextDocumentChangeReason.Undo === 1 (mirrored as
        // TEXT_DOCUMENT_CHANGE_REASON_UNDO in buffer.ts, without importing the real
        // vscode enum). Undo/redo replays content already counted once; if the line delta
        // were counted again, a large undo could also line-match an unrelated nearby AI
        // event purely by coincidence of size. Keystrokes/chars still count, and a
        // heartbeat still goes out — dropping the heartbeat entirely would also drop its
        // timestamp anchor, which the idle bridge needs to resume the clock correctly.
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "hello", rangeLength: 0 }], selection(4, 2), 1_000, "Daniel", 1);
        await manager.flushDueBuffers("timer", 31_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledWith("C:/project/a.ts", false, "coding", [], vitest_1.expect.objectContaining({
            keystrokes: 5,
            chars_added: 5,
            human_lines_added: undefined,
            human_lines_deleted: undefined
        }));
    });
    (0, vitest_1.it)("still counts an ordinary edit when reason is undefined", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "hello", rangeLength: 0 }], selection(4, 2), 1_000, "Daniel", undefined);
        await manager.flushDueBuffers("timer", 31_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledWith("C:/project/a.ts", false, "coding", [], vitest_1.expect.objectContaining({ keystrokes: 5, human_lines_added: 1 }));
    });
    (0, vitest_1.it)("save flushes immediately with write=true", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordSave({ uri: fileUri("C:/project/a.ts") }, 5_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledWith("C:/project/a.ts", true, "coding", [], vitest_1.expect.objectContaining({
            write: true,
            active_seconds: 0,
            actor_type: "human",
            actor_confidence: 1
        }));
    });
    (0, vitest_1.it)("does not grow the local duration after the final activity event", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/live.ts") }, [{ text: "x", rangeLength: 0 }], selection(0, 0), 1_000);
        (0, vitest_1.expect)(manager.getBufferedSeconds(61_000)).toBe(0);
        (0, vitest_1.expect)(manager.getBufferedSeconds(901_000)).toBe(0);
    });
    (0, vitest_1.it)("keeps activity that arrives during a request for the next rate window", async () => {
        let resolveSend;
        const sendHeartbeat = vitest_1.vi.fn().mockImplementation((...args) => {
            if (sendHeartbeat.mock.calls.length === 1) {
                return new Promise((resolve) => {
                    resolveSend = resolve;
                });
            }
            return Promise.resolve(args);
        });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        const first = manager.recordTextChange({ uri: fileUri("C:/project/in-flight.ts") }, [{ text: "a", rangeLength: 0 }], selection(0, 0), 1_000);
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(1));
        const second = manager.recordTextChange({ uri: fileUri("C:/project/in-flight.ts") }, [{ text: "b", rangeLength: 0 }], selection(0, 1), 2_000);
        resolveSend();
        await Promise.all([first, second]);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(1);
        await manager.flushDueBuffers("timer", 121_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[1][4]).toEqual(vitest_1.expect.objectContaining({ keystrokes: 1, active_seconds: 1 }));
    });
    (0, vitest_1.it)("retries a failed snapshot with the same ID without absorbing newer activity", async () => {
        const sendHeartbeat = vitest_1.vi
            .fn()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/retry.ts") }, [{ text: "a", rangeLength: 0 }], selection(0, 0), 1_000);
        const failedId = sendHeartbeat.mock.calls[0][4].heartbeat_id;
        await manager.recordTextChange({ uri: fileUri("C:/project/retry.ts") }, [{ text: "b", rangeLength: 0 }], selection(0, 1), 2_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[1][4].heartbeat_id).toBe(failedId);
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[1][3][0].heartbeat_id).not.toBe(failedId);
    });
    (0, vitest_1.it)("switch flushes previous file", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "x", rangeLength: 0 }], selection(0, 0), 1_000);
        await manager.recordEditorSwitch(editor("C:/project/a.ts"), 2_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("idle timeout suppresses stale timer flushes after the first heartbeat", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "hello", rangeLength: 0 }], selection(0, 0), 1_000);
        await manager.flushDueBuffers("timer", 400_001);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("same-file gap creates a new heartbeat window", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "hello", rangeLength: 0 }], selection(0, 0), 1_000);
        await manager.flushDueBuffers("timer", 30_000);
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "world", rangeLength: 0 }], selection(0, 0), 200_001);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(2);
    });
    (0, vitest_1.it)("accumulates continuous editor activity across heartbeat flushes", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "a", rangeLength: 0 }], selection(0, 0), 1_000);
        await manager.flushDueBuffers("timer", 30_000);
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "b", rangeLength: 0 }], selection(0, 1), 61_000);
        await manager.flushDueBuffers("timer", 121_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[0][4]).toEqual(vitest_1.expect.objectContaining({ active_seconds: 0 }));
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[1][4]).toEqual(vitest_1.expect.objectContaining({ active_seconds: 60 }));
    });
    (0, vitest_1.it)("keeps a five-minute session in strict wire-sized segments", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        for (const [index, now] of [1_000, 61_000, 121_000, 181_000, 241_000].entries()) {
            await manager.recordTextChange({ uri: fileUri("C:/project/five-minute.ts") }, [{ text: String(index), rangeLength: 0 }], selection(index, 0), now);
        }
        const payloads = sendHeartbeat.mock.calls.map((call) => call[4]);
        (0, vitest_1.expect)(payloads).toHaveLength(3);
        (0, vitest_1.expect)(payloads[2]).toEqual(vitest_1.expect.objectContaining({ active_seconds: 120 }));
        for (const payload of payloads) {
            for (const segment of payload.activity_segments ?? []) {
                (0, vitest_1.expect)(segment.end - segment.start).toBeLessThanOrEqual(120);
            }
        }
    });
    (0, vitest_1.it)("does not join activity at or beyond the idle timeout", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "a", rangeLength: 0 }], selection(0, 0), 1_000);
        await manager.flushDueBuffers("timer", 30_000);
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "b", rangeLength: 0 }], selection(0, 1), 301_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[1][4]).toEqual(vitest_1.expect.objectContaining({ active_seconds: 0 }));
    });
    (0, vitest_1.it)("uses the fixed two-minute gap even when legacy idleMinutes is fifteen", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(() => ({ ...createConfig(), idleMs: 15 * 60 * 1000 }), { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/strict.ts") }, [{ text: "a", rangeLength: 0 }], selection(0, 0), 1_000);
        await manager.recordTextChange({ uri: fileUri("C:/project/strict.ts") }, [{ text: "b", rangeLength: 0 }], selection(0, 1), 10 * 60 * 1000 + 1_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[1][4]).toEqual(vitest_1.expect.objectContaining({ active_seconds: 0 }));
    });
    (0, vitest_1.it)("uses one global activity timeline when work moves between files", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "a", rangeLength: 0 }], selection(0, 0), 1_000);
        await manager.recordTextChange({ uri: fileUri("C:/project/b.ts") }, [{ text: "b", rangeLength: 0 }], selection(0, 0), 11_000);
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "c", rangeLength: 0 }], selection(0, 1), 21_000);
        await manager.flushDueBuffers("timer", 30_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(manager.getBufferedSeconds()).toBe(20);
    });
    (0, vitest_1.it)("attributes a cross-file interval to the earlier heartbeat like WakaTime", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "a", rangeLength: 0 }], selection(0, 0), 1_000);
        await manager.recordTextChange({ uri: fileUri("C:/project/b.ts") }, [{ text: "b", rangeLength: 0 }], selection(0, 0), 61_000);
        await manager.flushDueBuffers("timer", 121_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(3);
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[2][0]).toBe("C:/project/a.ts");
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[2][4].active_seconds).toBe(60);
    });
    (0, vitest_1.it)("counts cursor activity without inventing overlapping file time", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 0), "Daniel", 1_000);
        manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(10, 4), "Daniel", 61_000);
        await manager.flushDueBuffers("timer", 90_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[0][4]).toEqual(vitest_1.expect.objectContaining({ active_seconds: 60, line_number: 11, cursor_position: 5 }));
    });
    (0, vitest_1.it)("does not claim a small edit as human when a nearby agent rewrite is ambiguous", async () => {
        // Regression test. The match used to be `event.lines_added >= linesAdded`, so an
        // agent event that rewrote a whole file (+491) matched any human edit in that file
        // within 15 seconds — `491 >= 1` — and the user's heartbeat was dropped entirely,
        // losing the time they genuinely spent. A large agent edit and a one-line editor
        // edit are not the same change, so the observation must remain visible as
        // Unattributed rather than being collapsed or mislabeled as Human.
        const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
        try {
            const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
            await fs.mkdir(path.dirname(logPath), { recursive: true });
            await fs.writeFile(logPath, JSON.stringify({
                event_id: "claude-big-rewrite",
                entity: "C:/project/a.ts",
                time: 10,
                lines_added: 491,
                lines_deleted: 4
            }) + "\n");
            const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
            const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false), undefined, new aiAttribution_1.AiAttributionStore(homeDir));
            await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "hello", rangeLength: 0 }], selection(0, 0), 10_000);
            await manager.flushDueBuffers("timer", 31_000);
            (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledWith("C:/project/a.ts", false, "coding", [], vitest_1.expect.objectContaining({
                unattributed_lines_added: 1,
                human_lines_added: undefined,
                keystrokes: 5,
                actor_type: "unknown",
                actor_confidence: 0
            }));
        }
        finally {
            await fs.rm(homeDir, { recursive: true, force: true });
        }
    });
    (0, vitest_1.it)("does not resend a matching AI edit as human activity", async () => {
        const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
        try {
            const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
            await fs.mkdir(path.dirname(logPath), { recursive: true });
            await fs.writeFile(logPath, JSON.stringify({
                event_id: "codex-1",
                entity: "C:/project/a.ts",
                time: 10,
                lines_added: 1,
                lines_deleted: 0
            }) + "\n");
            const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
            const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false), undefined, new aiAttribution_1.AiAttributionStore(homeDir));
            await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "hello", rangeLength: 0 }], selection(0, 0), 10_000);
            await manager.flushDueBuffers("timer", 31_000);
            (0, vitest_1.expect)(sendHeartbeat).not.toHaveBeenCalled();
        }
        finally {
            await fs.rm(homeDir, { recursive: true, force: true });
        }
    });
    (0, vitest_1.it)("an agent edit does not erase the human intervals that preceded it", async () => {
        const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
        try {
            const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
            await fs.mkdir(path.dirname(logPath), { recursive: true });
            await fs.writeFile(logPath, JSON.stringify({
                event_id: "claude-owns-only-its-own-edit",
                entity: "C:/project/a.ts",
                time: 105,
                lines_added: 1,
                lines_deleted: 0
            }) + "\n");
            const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
            const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false), undefined, new aiAttribution_1.AiAttributionStore(homeDir));
            // 40 seconds of the developer genuinely typing in this file...
            await manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 0), undefined, 60_000);
            await manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 1), undefined, 80_000);
            await manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 2), undefined, 100_000);
            (0, vitest_1.expect)(manager.getBufferedSeconds()).toBe(40);
            // ...then, five seconds later, the agent patches the same file and its sidecar
            // event matches the change exactly.
            await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "hello", rangeLength: 0 }], selection(0, 3), 105_000);
            await manager.flushDueBuffers("timer", 130_000);
            const payload = sendHeartbeat.mock.calls.at(-1)?.[4];
            // The agent owns the line counts and the interval its own edit closed; the
            // developer keeps the 40 seconds they had already earned.
            (0, vitest_1.expect)(payload.human_lines_added).toBeUndefined();
            (0, vitest_1.expect)(payload.active_seconds).toBe(40);
        }
        finally {
            await fs.rm(homeDir, { recursive: true, force: true });
        }
    });
    (0, vitest_1.it)("keeps an ambiguous nearby agent edit unattributed", async () => {
        const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
        try {
            const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
            await fs.mkdir(path.dirname(logPath), { recursive: true });
            await fs.writeFile(logPath, JSON.stringify({
                event_id: "codex-large-edit",
                entity: "C:/project/a.ts",
                time: 10,
                lines_added: 10,
                lines_deleted: 0
            }) + "\n");
            const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
            const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false), undefined, new aiAttribution_1.AiAttributionStore(homeDir));
            await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "hello", rangeLength: 0 }], selection(0, 0), 10_000);
            await manager.flushDueBuffers("timer", 31_000);
            (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledWith("C:/project/a.ts", false, "coding", [], vitest_1.expect.objectContaining({
                unattributed_lines_added: 1,
                human_lines_added: undefined,
                actor_type: "unknown",
                actor_confidence: 0
            }));
        }
        finally {
            await fs.rm(homeDir, { recursive: true, force: true });
        }
    });
    (0, vitest_1.it)("does not relabel a preceding human interval as AI when a whole-file overwrite follows it", async () => {
        // A whole-file agent overwrite (see the next test) must not turn the developer's
        // own preceding seconds into AI time. `human_lines_added` is correctly cleared —
        // the agent owns this edit's line counts — but `active_seconds: 40` here is time
        // the developer earned *before* the agent touched the file, so `actor_type` must
        // stay "human" for it. The agent's own attribution reaches the server separately,
        // through the CLI/broker path that classified this edit in the first place.
        const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
        try {
            const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
            await fs.mkdir(path.dirname(logPath), { recursive: true });
            await fs.writeFile(logPath, JSON.stringify({
                event_id: "claude-write-overwrite",
                entity: "C:/project/a.ts",
                time: 105,
                lines_added: 5,
                lines_deleted: 0,
                agent: "claude-code",
                actor_type: "ai_verified",
                actor_confidence: 1
            }) + "\n");
            const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
            const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false), undefined, new aiAttribution_1.AiAttributionStore(homeDir));
            await manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 0), undefined, 60_000);
            await manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 1), undefined, 80_000);
            await manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 2), undefined, 100_000);
            (0, vitest_1.expect)(manager.getBufferedSeconds()).toBe(40);
            await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [
                {
                    text: "line1\nline2\nline3\nline4\nline5",
                    rangeLength: 4000,
                    range: { start: { line: 0, character: 0 }, end: { line: 200, character: 0 } }
                }
            ], selection(0, 3), 105_000);
            await manager.flushDueBuffers("timer", 130_000);
            const payload = sendHeartbeat.mock.calls.at(-1)?.[4];
            (0, vitest_1.expect)(payload.human_lines_added).toBeUndefined();
            (0, vitest_1.expect)(payload.active_seconds).toBe(40);
            (0, vitest_1.expect)(payload.actor_type).toBe("human");
            (0, vitest_1.expect)(payload.ai_event_id).toBeUndefined();
        }
        finally {
            await fs.rm(homeDir, { recursive: true, force: true });
        }
    });
    (0, vitest_1.it)("attributes a whole-file agent overwrite as AI on the save that follows it", async () => {
        // Regression test for the `Write` line-delta asymmetry: an agent hook overwriting
        // an existing file has no prior content to diff, so it reports lines_deleted: 0.
        // VS Code sees the reload as a full-range replacement, so its own linesDeleted is
        // the old file's line count (200 here) — far outside LINE_MATCH_SLACK of the
        // hook's 0. Before this fix that mismatch fell through to "unattributed", so the
        // agent's entire rewrite was counted as neither Human nor AI in the wire payload.
        //
        // This edit has no prior activity behind it, so the classifying flush sends
        // nothing on its own (an AI-only edit produces no heartbeat by design — see "does
        // not resend a matching AI edit as human activity"). The save that follows is what
        // must carry the AI attribution: before this fix, `write: true` alone forced
        // `actor_type: "human"` on that save, even though every human-side counter for
        // this exact edit had already been zeroed.
        const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
        try {
            const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
            await fs.mkdir(path.dirname(logPath), { recursive: true });
            await fs.writeFile(logPath, JSON.stringify({
                event_id: "claude-write-overwrite-2",
                entity: "C:/project/b.ts",
                time: 10,
                lines_added: 5,
                lines_deleted: 0,
                agent: "claude-code",
                provider: "anthropic",
                model: "claude-sonnet-5",
                source: "agent_hook",
                confidence: "verified",
                actor_type: "ai_verified",
                actor_confidence: 1
            }) + "\n");
            const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
            const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false), undefined, new aiAttribution_1.AiAttributionStore(homeDir));
            await manager.recordTextChange({ uri: fileUri("C:/project/b.ts") }, [
                {
                    text: "line1\nline2\nline3\nline4\nline5",
                    rangeLength: 4000,
                    range: { start: { line: 0, character: 0 }, end: { line: 200, character: 0 } }
                }
            ], selection(0, 0), 10_000);
            (0, vitest_1.expect)(sendHeartbeat).not.toHaveBeenCalled();
            await manager.recordSave({ uri: fileUri("C:/project/b.ts") }, 10_500);
            (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(1);
            const payload = sendHeartbeat.mock.calls[0][4];
            (0, vitest_1.expect)(payload.actor_type).toBe("ai_verified");
            (0, vitest_1.expect)(payload.actor_confidence).toBe(1);
            (0, vitest_1.expect)(payload.ai_agent).toBe("claude-code");
            (0, vitest_1.expect)(payload.ai_provider).toBe("anthropic");
            (0, vitest_1.expect)(payload.ai_model).toBe("claude-sonnet-5");
            (0, vitest_1.expect)(payload.ai_event_id).toBe("claude-write-overwrite-2");
            (0, vitest_1.expect)(payload.human_lines_added).toBeUndefined();
        }
        finally {
            await fs.rm(homeDir, { recursive: true, force: true });
        }
    });
    (0, vitest_1.it)("does not attribute prettier or eslint whole-file reformat to AI without sidecar evidence", async () => {
        // Guards the A-2 whole-file-overwrite rule above: a large edit that looks like an
        // agent overwrite (big line delta, no matching deletions) must still resolve to
        // Human when the broker recorded nothing for this file — e.g. a "format on save"
        // reformat by prettier or eslint, which VS Code delivers as an ordinary large
        // `onDidChangeTextDocument` event with no AI evidence behind it. The whole-file
        // rule only ever narrows what counts as a match against an *existing* candidate
        // event (see `classify`'s `candidates.length === 0` early return above it); it can
        // never manufacture AI attribution out of no evidence.
        const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
        try {
            // No sidecar file is written at all for this home directory.
            const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
            const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false), undefined, new aiAttribution_1.AiAttributionStore(homeDir));
            await manager.recordTextChange({ uri: fileUri("C:/project/formatted.ts") }, [
                {
                    text: "line1\nline2\nline3\nline4\nline5",
                    rangeLength: 4000,
                    range: { start: { line: 0, character: 0 }, end: { line: 200, character: 0 } }
                }
            ], selection(0, 0), 10_000);
            await manager.flushDueBuffers("timer", 40_000);
            (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(1);
            const payload = sendHeartbeat.mock.calls[0][4];
            (0, vitest_1.expect)(payload.actor_type).toBe("human");
            (0, vitest_1.expect)(payload.ai_event_id).toBeUndefined();
            (0, vitest_1.expect)(payload.human_lines_added).toBe(5);
        }
        finally {
            await fs.rm(homeDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=buffer.test.js.map