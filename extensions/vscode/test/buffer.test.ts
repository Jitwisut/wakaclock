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
        // Like WakaTime, one isolated heartbeat has no duration until another
        // editor activity establishes the interval after it.
        active_seconds: 0,
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

  it("accumulates continuous editor activity across heartbeat flushes", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "a", rangeLength: 0 }],
      selection(0, 0),
      1_000
    );
    await manager.flushDueBuffers("timer", 30_000);
    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "b", rangeLength: 0 }],
      selection(0, 1),
      61_000
    );
    await manager.flushDueBuffers("timer", 90_000);

    expect(sendHeartbeat).toHaveBeenCalledTimes(2);
    expect(sendHeartbeat.mock.calls[0][4]).toEqual(
      expect.objectContaining({ active_seconds: 0 })
    );
    expect(sendHeartbeat.mock.calls[1][4]).toEqual(
      expect.objectContaining({ active_seconds: 60 })
    );
  });

  it("does not join activity at or beyond the idle timeout", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "a", rangeLength: 0 }],
      selection(0, 0),
      1_000
    );
    await manager.flushDueBuffers("timer", 30_000);
    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "b", rangeLength: 0 }],
      selection(0, 1),
      301_000
    );

    expect(sendHeartbeat).toHaveBeenCalledTimes(2);
    expect(sendHeartbeat.mock.calls[1][4]).toEqual(
      expect.objectContaining({ active_seconds: 0 })
    );
  });

  it("uses one global activity timeline when work moves between files", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "a", rangeLength: 0 }],
      selection(0, 0),
      1_000
    );
    await manager.recordTextChange(
      { uri: fileUri("C:/project/b.ts") },
      [{ text: "b", rangeLength: 0 }],
      selection(0, 0),
      11_000
    );
    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "c", rangeLength: 0 }],
      selection(0, 1),
      21_000
    );
    await manager.flushDueBuffers("timer", 30_000);

    expect(sendHeartbeat).toHaveBeenCalledTimes(1);
    const primary = sendHeartbeat.mock.calls[0][4];
    const extras = sendHeartbeat.mock.calls[0][3];
    const totalSeconds = primary.active_seconds + extras[0].active_seconds;
    expect(totalSeconds).toBe(20);
    expect(primary.active_seconds).toBe(10);
    expect(extras[0].active_seconds).toBe(10);
  });

  it("attributes a cross-file interval to the earlier heartbeat like WakaTime", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "a", rangeLength: 0 }],
      selection(0, 0),
      1_000
    );
    await manager.recordTextChange(
      { uri: fileUri("C:/project/b.ts") },
      [{ text: "b", rangeLength: 0 }],
      selection(0, 0),
      61_000
    );
    await manager.flushDueBuffers("timer", 90_000);

    expect(sendHeartbeat).toHaveBeenCalledTimes(1);
    expect(sendHeartbeat.mock.calls[0][0]).toBe("C:/project/a.ts");
    expect(sendHeartbeat.mock.calls[0][4].active_seconds).toBe(60);
    expect(sendHeartbeat.mock.calls[0][3][0]).toEqual(
      expect.objectContaining({ entity: "C:/project/b.ts", active_seconds: 0 })
    );
  });

  it("counts cursor activity without inventing overlapping file time", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    manager.updateCursor(
      { uri: fileUri("C:/project/a.ts") },
      selection(0, 0),
      "Daniel",
      1_000
    );
    manager.updateCursor(
      { uri: fileUri("C:/project/a.ts") },
      selection(10, 4),
      "Daniel",
      61_000
    );
    await manager.flushDueBuffers("timer", 90_000);

    expect(sendHeartbeat).toHaveBeenCalledTimes(1);
    expect(sendHeartbeat.mock.calls[0][4]).toEqual(
      expect.objectContaining({ active_seconds: 60, line_number: 11, cursor_position: 5 })
    );
  });

  it("does not claim a small edit as human when a nearby agent rewrite is ambiguous", async () => {
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
        expect.objectContaining({
          unattributed_lines_added: 1,
          human_lines_added: undefined,
          keystrokes: 5
        })
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

  it("keeps an ambiguous nearby agent edit unattributed", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
    try {
      const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.writeFile(
        logPath,
        JSON.stringify({
          event_id: "codex-large-edit",
          entity: "C:/project/a.ts",
          time: 10,
          lines_added: 10,
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

      expect(sendHeartbeat).toHaveBeenCalledWith(
        "C:/project/a.ts",
        false,
        "coding",
        [],
        expect.objectContaining({
          unattributed_lines_added: 1,
          human_lines_added: undefined
        })
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });
});
