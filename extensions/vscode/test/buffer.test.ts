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
    heartbeatRateLimitMs: 120_000,
    sameFileHeartbeatMs: 120_000,
    idleMs: 300_000,
    statusBarEnabled: true,
    debugLogging: false,
    trackDebugSessions: true,
    trackBuildTasks: true
  };
}

describe("HeartbeatBufferManager", () => {
  it("text changes send the first heartbeat immediately", async () => {
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

  it("does not grow the local duration after the final activity event", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    await manager.recordTextChange(
      { uri: fileUri("C:/project/live.ts") },
      [{ text: "x", rangeLength: 0 }],
      selection(0, 0),
      1_000
    );

    expect(manager.getBufferedSeconds(61_000)).toBe(0);
    expect(manager.getBufferedSeconds(901_000)).toBe(0);
  });

  it("keeps activity that arrives during a request for the next rate window", async () => {
    let resolveSend!: () => void;
    const sendHeartbeat = vi.fn().mockImplementation((...args: unknown[]) => {
      if (sendHeartbeat.mock.calls.length === 1) {
        return new Promise<void>((resolve) => {
          resolveSend = resolve;
        });
      }
      return Promise.resolve(args);
    });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    const first = manager.recordTextChange(
      { uri: fileUri("C:/project/in-flight.ts") },
      [{ text: "a", rangeLength: 0 }],
      selection(0, 0),
      1_000
    );
    await vi.waitFor(() => expect(sendHeartbeat).toHaveBeenCalledTimes(1));
    const second = manager.recordTextChange(
      { uri: fileUri("C:/project/in-flight.ts") },
      [{ text: "b", rangeLength: 0 }],
      selection(0, 1),
      2_000
    );
    resolveSend();
    await Promise.all([first, second]);

    expect(sendHeartbeat).toHaveBeenCalledTimes(1);
    await manager.flushDueBuffers("timer", 121_000);
    expect(sendHeartbeat).toHaveBeenCalledTimes(2);
    expect(sendHeartbeat.mock.calls[1][4]).toEqual(
      expect.objectContaining({ keystrokes: 1, active_seconds: 1 })
    );
  });

  it("retries a failed snapshot with the same ID without absorbing newer activity", async () => {
    const sendHeartbeat = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    await manager.recordTextChange(
      { uri: fileUri("C:/project/retry.ts") },
      [{ text: "a", rangeLength: 0 }],
      selection(0, 0),
      1_000
    );
    const failedId = sendHeartbeat.mock.calls[0][4].heartbeat_id;

    await manager.recordTextChange(
      { uri: fileUri("C:/project/retry.ts") },
      [{ text: "b", rangeLength: 0 }],
      selection(0, 1),
      2_000
    );

    expect(sendHeartbeat).toHaveBeenCalledTimes(2);
    expect(sendHeartbeat.mock.calls[1][4].heartbeat_id).toBe(failedId);
    expect(sendHeartbeat.mock.calls[1][3][0].heartbeat_id).not.toBe(failedId);
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

  it("idle timeout suppresses stale timer flushes after the first heartbeat", async () => {
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

    expect(sendHeartbeat).toHaveBeenCalledTimes(1);
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
    await manager.flushDueBuffers("timer", 121_000);

    expect(sendHeartbeat).toHaveBeenCalledTimes(2);
    expect(sendHeartbeat.mock.calls[0][4]).toEqual(
      expect.objectContaining({ active_seconds: 0 })
    );
    expect(sendHeartbeat.mock.calls[1][4]).toEqual(
      expect.objectContaining({ active_seconds: 60 })
    );
  });

  it("keeps a five-minute session in strict wire-sized segments", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    for (const [index, now] of [1_000, 61_000, 121_000, 181_000, 241_000].entries()) {
      await manager.recordTextChange(
        { uri: fileUri("C:/project/five-minute.ts") },
        [{ text: String(index), rangeLength: 0 }],
        selection(index, 0),
        now
      );
    }

    const payloads = sendHeartbeat.mock.calls.map((call) => call[4]);
    expect(payloads).toHaveLength(3);
    expect(payloads[2]).toEqual(expect.objectContaining({ active_seconds: 120 }));
    for (const payload of payloads) {
      for (const segment of payload.activity_segments ?? []) {
        expect(segment.end - segment.start).toBeLessThanOrEqual(120);
      }
    }
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

  it("uses the fixed two-minute gap even when legacy idleMinutes is fifteen", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      () => ({ ...createConfig(), idleMs: 15 * 60 * 1000 }),
      { sendHeartbeat },
      new Logger(() => false)
    );

    await manager.recordTextChange(
      { uri: fileUri("C:/project/strict.ts") },
      [{ text: "a", rangeLength: 0 }],
      selection(0, 0),
      1_000
    );
    await manager.recordTextChange(
      { uri: fileUri("C:/project/strict.ts") },
      [{ text: "b", rangeLength: 0 }],
      selection(0, 1),
      10 * 60 * 1000 + 1_000
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

    expect(sendHeartbeat).toHaveBeenCalledTimes(2);
    expect(manager.getBufferedSeconds()).toBe(20);
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
    await manager.flushDueBuffers("timer", 121_000);

    expect(sendHeartbeat).toHaveBeenCalledTimes(3);
    expect(sendHeartbeat.mock.calls[2][0]).toBe("C:/project/a.ts");
    expect(sendHeartbeat.mock.calls[2][4].active_seconds).toBe(60);
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

  it("an agent edit does not erase the human intervals that preceded it", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
    try {
      const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.writeFile(
        logPath,
        JSON.stringify({
          event_id: "claude-owns-only-its-own-edit",
          entity: "C:/project/a.ts",
          time: 105,
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

      // 40 seconds of the developer genuinely typing in this file...
      await manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 0), undefined, 60_000);
      await manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 1), undefined, 80_000);
      await manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 2), undefined, 100_000);
      expect(manager.getBufferedSeconds()).toBe(40);

      // ...then, five seconds later, the agent patches the same file and its sidecar
      // event matches the change exactly.
      await manager.recordTextChange(
        { uri: fileUri("C:/project/a.ts") },
        [{ text: "hello", rangeLength: 0 }],
        selection(0, 3),
        105_000
      );
      await manager.flushDueBuffers("timer", 130_000);

      const payload = sendHeartbeat.mock.calls.at(-1)?.[4];
      // The agent owns the line counts and the interval its own edit closed; the
      // developer keeps the 40 seconds they had already earned.
      expect(payload.human_lines_added).toBeUndefined();
      expect(payload.active_seconds).toBe(40);
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
