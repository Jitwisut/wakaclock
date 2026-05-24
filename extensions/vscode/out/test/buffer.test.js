"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
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
            active_seconds: 1,
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
});
//# sourceMappingURL=buffer.test.js.map