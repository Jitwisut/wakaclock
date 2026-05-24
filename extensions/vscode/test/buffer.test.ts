import { describe, expect, it, vi } from "vitest";
import { HeartbeatBufferManager } from "../src/buffer";
import { Logger } from "../src/logging";
import type { WakaclockConfigSnapshot } from "../src/types";

function fileUri(fsPath: string) {
  return { scheme: "file", fsPath } as const as any;
}

function selection(line: number, character: number) {
  return { active: { line, character } } as const as any;
}

function editor(fsPath: string) {
  return { document: { uri: fileUri(fsPath) } } as const as any;
}

function createConfig(): WakaclockConfigSnapshot {
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

describe("HeartbeatBufferManager", () => {
  it("text changes increment counters and timer flush sends them", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "hello", rangeLength: 0 }],
      selection(4, 2),
      1_000,
      "Daniel"
    );
    await manager.flushDueBuffers("timer", 31_000);

    expect(sendHeartbeat).toHaveBeenCalledTimes(1);
    expect(sendHeartbeat).toHaveBeenCalledWith(
      "C:/project/a.ts",
      false,
      "coding",
      [],
      expect.objectContaining({
        project: "Daniel",
        keystrokes: 5,
        chars_added: 5,
        active_seconds: 1,
        line_number: 5,
        cursor_position: 3
      })
    );
  });

  it("save flushes immediately with write=true", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    await manager.recordSave({ uri: fileUri("C:/project/a.ts") }, 5_000);

    expect(sendHeartbeat).toHaveBeenCalledWith(
      "C:/project/a.ts",
      true,
      "coding",
      [],
      expect.objectContaining({ write: true, active_seconds: 0 })
    );
  });

  it("switch flushes previous file", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "x", rangeLength: 0 }],
      selection(0, 0),
      1_000
    );
    await manager.recordEditorSwitch(
      editor("C:/project/a.ts"),
      2_000
    );

    expect(sendHeartbeat).toHaveBeenCalledTimes(1);
  });

  it("idle timeout suppresses stale timer flushes", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "hello", rangeLength: 0 }],
      selection(0, 0),
      1_000
    );
    await manager.flushDueBuffers("timer", 400_001);

    expect(sendHeartbeat).not.toHaveBeenCalled();
  });

  it("same-file gap creates a new heartbeat window", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "hello", rangeLength: 0 }],
      selection(0, 0),
      1_000
    );
    await manager.flushDueBuffers("timer", 30_000);
    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "world", rangeLength: 0 }],
      selection(0, 0),
      200_001
    );

    expect(sendHeartbeat).toHaveBeenCalledTimes(2);
  });
});
