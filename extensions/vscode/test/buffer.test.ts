import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AiAttributionStore } from "../src/aiAttribution";
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
        human_lines_added: 1,
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

  it("keeps a small human edit in a file the agent just rewrote", async () => {
    // Regression test. The match used to be `event.lines_added >= linesAdded`, so an
    // agent event that rewrote a whole file (+491) matched any human edit in that file
    // within 15 seconds — `491 >= 1` — and the user's heartbeat was dropped entirely,
    // losing the time they actually spent. A large agent edit and a one-line human edit
    // are not the same change and must not be collapsed.
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
    try {
      const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.writeFile(
        logPath,
        JSON.stringify({
          event_id: "claude-big-rewrite",
          entity: "C:/project/a.ts",
          time: 10,
          lines_added: 491,
          lines_deleted: 4
        }) + "\n"
      );

      const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      const manager = new HeartbeatBufferManager(
        createConfig,
        { sendHeartbeat },
        new Logger(() => false),
        undefined,
        new AiAttributionStore(homeDir)
      );

      await manager.recordTextChange(
        { uri: fileUri("C:/project/a.ts") },
        [{ text: "hello", rangeLength: 0 }],
        selection(0, 0),
        10_000
      );
      await manager.flushDueBuffers("timer", 31_000);

      expect(sendHeartbeat).toHaveBeenCalledTimes(1);
      expect(sendHeartbeat).toHaveBeenCalledWith(
        "C:/project/a.ts",
        false,
        "coding",
        [],
        expect.objectContaining({ human_lines_added: 1, keystrokes: 5 })
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("does not resend a matching AI edit as human activity", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
    try {
      const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.writeFile(
        logPath,
        JSON.stringify({
          event_id: "codex-1",
          entity: "C:/project/a.ts",
          time: 10,
          lines_added: 1,
          lines_deleted: 0
        }) + "\n"
      );

      const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      const manager = new HeartbeatBufferManager(
        createConfig,
        { sendHeartbeat },
        new Logger(() => false),
        undefined,
        new AiAttributionStore(homeDir)
      );

      await manager.recordTextChange(
        { uri: fileUri("C:/project/a.ts") },
        [{ text: "hello", rangeLength: 0 }],
        selection(0, 0),
        10_000
      );
      await manager.flushDueBuffers("timer", 31_000);

      expect(sendHeartbeat).not.toHaveBeenCalled();
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });
});
