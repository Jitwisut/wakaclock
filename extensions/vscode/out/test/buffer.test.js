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
        sameFileHeartbeatMs: 120_000,
        idleMs: 300_000,
        statusBarEnabled: true,
        debugLogging: false,
        trackDebugSessions: true,
        trackBuildTasks: true
    };
}
(0, vitest_1.describe)("HeartbeatBufferManager", () => {
    (0, vitest_1.it)("text changes increment counters and timer flush sends them", async () => {
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
            line_number: 5,
            cursor_position: 3
        }));
    });
    (0, vitest_1.it)("save flushes immediately with write=true", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordSave({ uri: fileUri("C:/project/a.ts") }, 5_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledWith("C:/project/a.ts", true, "coding", [], vitest_1.expect.objectContaining({ write: true, active_seconds: 0 }));
    });
    (0, vitest_1.it)("switch flushes previous file", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "x", rangeLength: 0 }], selection(0, 0), 1_000);
        await manager.recordEditorSwitch(editor("C:/project/a.ts"), 2_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("idle timeout suppresses stale timer flushes", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "hello", rangeLength: 0 }], selection(0, 0), 1_000);
        await manager.flushDueBuffers("timer", 400_001);
        (0, vitest_1.expect)(sendHeartbeat).not.toHaveBeenCalled();
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
        await manager.flushDueBuffers("timer", 90_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[0][4]).toEqual(vitest_1.expect.objectContaining({ active_seconds: 0 }));
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[1][4]).toEqual(vitest_1.expect.objectContaining({ active_seconds: 60 }));
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
    (0, vitest_1.it)("uses one global activity timeline when work moves between files", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "a", rangeLength: 0 }], selection(0, 0), 1_000);
        await manager.recordTextChange({ uri: fileUri("C:/project/b.ts") }, [{ text: "b", rangeLength: 0 }], selection(0, 0), 11_000);
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "c", rangeLength: 0 }], selection(0, 1), 21_000);
        await manager.flushDueBuffers("timer", 30_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(1);
        const primary = sendHeartbeat.mock.calls[0][4];
        const extras = sendHeartbeat.mock.calls[0][3];
        const totalSeconds = primary.active_seconds + extras[0].active_seconds;
        (0, vitest_1.expect)(totalSeconds).toBe(20);
        (0, vitest_1.expect)(primary.active_seconds).toBe(10);
        (0, vitest_1.expect)(extras[0].active_seconds).toBe(10);
    });
    (0, vitest_1.it)("attributes a cross-file interval to the earlier heartbeat like WakaTime", async () => {
        const sendHeartbeat = vitest_1.vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        const manager = new buffer_1.HeartbeatBufferManager(createConfig, { sendHeartbeat }, new logging_1.Logger(() => false));
        await manager.recordTextChange({ uri: fileUri("C:/project/a.ts") }, [{ text: "a", rangeLength: 0 }], selection(0, 0), 1_000);
        await manager.recordTextChange({ uri: fileUri("C:/project/b.ts") }, [{ text: "b", rangeLength: 0 }], selection(0, 0), 61_000);
        await manager.flushDueBuffers("timer", 90_000);
        (0, vitest_1.expect)(sendHeartbeat).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[0][0]).toBe("C:/project/a.ts");
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[0][4].active_seconds).toBe(60);
        (0, vitest_1.expect)(sendHeartbeat.mock.calls[0][3][0]).toEqual(vitest_1.expect.objectContaining({ entity: "C:/project/b.ts", active_seconds: 0 }));
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
                keystrokes: 5
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
                human_lines_added: undefined
            }));
        }
        finally {
            await fs.rm(homeDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=buffer.test.js.map