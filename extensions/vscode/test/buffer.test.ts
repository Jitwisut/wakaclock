import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
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

function document(fsPath: string, text: string, version = 1) {
  return { uri: fileUri(fsPath), version, getText: () => text } as const as any;
}

function contentFingerprint(text: string) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
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
    trackBuildTasks: true,
    trackClipboardActions: true
  };
}

describe("HeartbeatBufferManager", () => {
  it("sends an isolated write heartbeat for an external file change without inventing active time", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(createConfig, { sendHeartbeat }, new Logger(() => false));

    await manager.recordExternalFileChange(
      "/workspace/README.md",
      {
        event_id: "observer:readme-1",
        change_kind: "modify",
        lines_added: 2,
        lines_deleted: 1,
      },
      10_000,
      "wakaclock",
    );

    expect(sendHeartbeat).toHaveBeenCalledTimes(1);
    expect(sendHeartbeat).toHaveBeenCalledWith(
      "/workspace/README.md",
      true,
      "coding",
      [],
      expect.objectContaining({
        heartbeat_id: "observer:readme-1",
        active_seconds: 0,
        actor_type: "unknown",
        actor_confidence: 0,
        unattributed_lines_added: 2,
        unattributed_lines_deleted: 1,
        project: "wakaclock",
      }),
    );
  });

  it("does not duplicate a native AI heartbeat when the external change matches its sidecar", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-external-ai-"));
    try {
      const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.writeFile(
        logPath,
        JSON.stringify({
          event_id: "codex-external-1",
          entity: "/workspace/README.md",
          time: 10,
          lines_added: 2,
          lines_deleted: 1,
          agent: "codex",
          provider: "openai",
          model: "gpt-6",
          source: "agent_hook",
          confidence: "verified",
          actor_type: "ai_verified",
          actor_confidence: 1,
          content_fingerprint: contentFingerprint("new\nline\n"),
        }) + "\n",
      );
      const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      const manager = new HeartbeatBufferManager(
        createConfig,
        { sendHeartbeat },
        new Logger(() => false),
        undefined,
        new AiAttributionStore(homeDir),
      );

      await manager.recordExternalFileChange(
        "/workspace/README.md",
        {
          event_id: "observer:readme-2",
          change_kind: "modify",
          lines_added: 2,
          lines_deleted: 1,
          content_fingerprint: contentFingerprint("new\nline\n"),
        },
        10_000,
      );

      expect(sendHeartbeat).not.toHaveBeenCalled();
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("flushes copy-only activity and records paste volume without inflating keystrokes", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(createConfig, { sendHeartbeat }, new Logger(() => false));

    await manager.recordClipboardCopy({ uri: fileUri("C:/project/a.ts") }, { copiedChars: 24, copiedLines: 3 }, 1_000, "project");
    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "x".repeat(2_000), rangeLength: 0 }],
      selection(4, 2),
      122_000,
      "project",
      undefined,
      { origin: "external_or_unknown" }
    );

    expect(sendHeartbeat).toHaveBeenNthCalledWith(1, "C:/project/a.ts", false, "coding", [], expect.objectContaining({
      clipboard_tracking_version: 1,
      copy_actions: 1,
      copied_chars: 24,
      copied_lines: 3,
      actor_type: "human"
    }));
    expect(sendHeartbeat).toHaveBeenNthCalledWith(2, "C:/project/a.ts", false, "coding", [], expect.objectContaining({
      clipboard_tracking_version: 1,
      paste_actions: 1,
      pasted_chars: 2_000,
      paste_external_or_unknown_actions: 1,
      unattributed_lines_added: undefined,
      human_lines_added: undefined,
      copy_actions: undefined
    }));
  });

  it("does not collect or send clipboard fields when tracking is disabled", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const config = { ...createConfig(), trackClipboardActions: false };
    const manager = new HeartbeatBufferManager(() => config, { sendHeartbeat }, new Logger(() => false));

    await manager.recordClipboardCopy({ uri: fileUri("C:/project/a.ts") }, { copiedChars: 8, copiedLines: 1 }, 1_000);
    await manager.recordTextChange(
      { uri: fileUri("C:/project/a.ts") },
      [{ text: "paste", rangeLength: 0 }],
      selection(0, 5),
      2_000,
      undefined,
      undefined,
      { origin: "external_or_unknown" }
    );

    expect(sendHeartbeat).toHaveBeenCalledTimes(1);
    expect(sendHeartbeat).toHaveBeenCalledWith(
      "C:/project/a.ts",
      false,
      "coding",
      [],
      expect.objectContaining({
        chars_added: 5,
        clipboard_tracking_version: undefined,
        paste_actions: undefined
      })
    );
  });

  it("does not call an editor change Human when broker line evidence is unknown", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
    try {
      const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.writeFile(
        logPath,
        JSON.stringify({
          event_id: "shell-unknown-lines",
          entity: "C:/project/a.ts",
          time: 10,
          lines_added: null,
          lines_deleted: null
        }) + "\n"
      );

      await expect(
        new AiAttributionStore(homeDir).classifyRecentEdit(
          "C:/project/a.ts",
          10_000,
          2,
          0
        )
      ).resolves.toBe("unattributed");
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

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
        keystrokes: undefined,
        chars_added: 5,
        // Like WakaTime, one isolated heartbeat has no duration until another
        // editor activity establishes the interval after it.
        active_seconds: 0,
        human_lines_added: undefined,
        unattributed_lines_added: undefined,
        actor_type: "unknown",
        actor_confidence: 0,
        line_number: 5,
        cursor_position: 3
      })
    );
  });

  it("reports undo character volume without fabricating keys or unversioned line totals", async () => {
    // An undo is observed activity; its generation identity is unknown.
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
      "Daniel",
      1
    );
    await manager.flushDueBuffers("timer", 31_000);

    expect(sendHeartbeat).toHaveBeenCalledTimes(1);
    expect(sendHeartbeat).toHaveBeenCalledWith(
      "C:/project/a.ts",
      false,
      "coding",
      [],
      expect.objectContaining({
        keystrokes: undefined,
        chars_added: 5,
        human_lines_added: undefined,
        human_lines_deleted: undefined
      })
    );
  });

  it("still counts an ordinary edit when reason is undefined", async () => {
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
      "Daniel",
      undefined
    );
    await manager.flushDueBuffers("timer", 31_000);

    expect(sendHeartbeat).toHaveBeenCalledWith(
      "C:/project/a.ts",
      false,
      "coding",
      [],
      expect.objectContaining({ keystrokes: undefined, human_lines_added: undefined, unattributed_lines_added: undefined })
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
      expect.objectContaining({
        write: true,
        active_seconds: 0,
        actor_type: "human",
        actor_confidence: 1
      })
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
      expect.objectContaining({ chars_added: 1, active_seconds: 1 })
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
    const failedTime = sendHeartbeat.mock.calls[0][4].time;

    await manager.recordTextChange(
      { uri: fileUri("C:/project/retry.ts") },
      [{ text: "b", rangeLength: 0 }],
      selection(0, 1),
      2_000
    );

    expect(sendHeartbeat).toHaveBeenCalledTimes(2);
    expect(sendHeartbeat.mock.calls[1][4].heartbeat_id).toBe(failedId);
    expect(sendHeartbeat.mock.calls[1][4].time).toBe(failedTime);
    expect(sendHeartbeat.mock.calls[1][3][0].heartbeat_id).not.toBe(failedId);
    expect(sendHeartbeat.mock.calls[1][3][0].time).toBe(2);
  });

  it("force flushes recent activity during shutdown and waits for delivery", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    await manager.recordTextChange(
      { uri: fileUri("C:/project/shutdown.ts") },
      [{ text: "a", rangeLength: 0 }],
      selection(0, 0),
      1_000
    );
    await manager.recordTextChange(
      { uri: fileUri("C:/project/shutdown.ts") },
      [{ text: "b", rangeLength: 0 }],
      selection(0, 1),
      2_000
    );

    expect(sendHeartbeat).toHaveBeenCalledTimes(1);
    await manager.flushAllBuffers("shutdown", 2_500);

    expect(sendHeartbeat).toHaveBeenCalledTimes(2);
    expect(sendHeartbeat.mock.calls[1][4]).toEqual(
      expect.objectContaining({ chars_added: 1, time: 2 })
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
      11_000
    );
    await manager.flushDueBuffers("timer", 121_000);

    expect(sendHeartbeat).toHaveBeenCalledTimes(2);
    expect(sendHeartbeat.mock.calls[0][4]).toEqual(
      expect.objectContaining({ active_seconds: 0 })
    );
    expect(sendHeartbeat.mock.calls[1][4]).toEqual(
        expect.objectContaining({ active_seconds: 10 })
    );
  });

  it("keeps a five-minute session in strict wire-sized segments", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      createConfig,
      { sendHeartbeat },
      new Logger(() => false)
    );

    for (const [index, now] of Array.from({ length: 25 }, (_, index) => [index, 1_000 + index * 10_000] as const)) {
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
        expect(segment.end - segment.start).toBeLessThanOrEqual(15);
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

  it("uses the fixed fifteen-second Active lease even when legacy idleMinutes is fifteen", async () => {
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

  it("does not turn a seven-minute run plus a one-minute pause into eight minutes", async () => {
    const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const manager = new HeartbeatBufferManager(
      () => ({ ...createConfig(), heartbeatRateLimitMs: 10_000_000 }),
      { sendHeartbeat },
      new Logger(() => false)
    );

    // Activity arrives every ten seconds for seven minutes. The editor can prove
    // those intervals, even though delivery is rate limited to 120 seconds.
    for (let now = 1_000; now <= 421_000; now += 10_000) {
      await manager.recordTextChange(
        { uri: fileUri("C:/project/lease.ts") },
        [{ text: "x", rangeLength: 0 }],
        selection(0, 0),
        now
      );
    }
    // Returning after a 60-second idle gap is an activity marker, not 60 seconds
    // of coding. Force the snapshot so the assertion observes all buffered time.
    await manager.recordTextChange(
      { uri: fileUri("C:/project/lease.ts") },
      [{ text: "y", rangeLength: 0 }],
      selection(0, 1),
      481_000
    );
    await manager.flushCurrentEditor(editor("C:/project/lease.ts"), "manual", undefined);

    const payload = sendHeartbeat.mock.calls.at(-1)?.[4];
    expect(payload.active_seconds).toBe(420);
    expect(payload.activity_segments?.every((segment: { end: number; start: number }) =>
      segment.end - segment.start <= 15
    )).toBe(true);
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

    expect(sendHeartbeat).toHaveBeenCalledTimes(2);
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

    expect(sendHeartbeat).toHaveBeenCalledTimes(0);
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
          unattributed_lines_added: undefined,
          human_lines_added: undefined,
          keystrokes: undefined,
          actor_type: "unknown",
          actor_confidence: 0
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
          lines_deleted: 0,
          content_fingerprint: contentFingerprint("hello")
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

      manager.updateCursor(document("C:/project/a.ts", "", 0), undefined, undefined, 10_000);
      await manager.recordTextChange(
        document("C:/project/a.ts", "hello"),
        [{ text: "hello", rangeLength: 0 }],
        selection(0, 0),
        10_000
      );
      await manager.flushDueBuffers("timer", 31_000);

      expect(sendHeartbeat).not.toHaveBeenCalled();
      expect(manager.getLastLineMeasurement("C:/project/a.ts")).toMatchObject({
        status: "measured", linesAdded: 1, linesDeleted: 0
      });
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
          lines_deleted: 0,
          content_fingerprint: contentFingerprint("hello")
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
      await manager.updateCursor(document("C:/project/a.ts", "", 0), selection(0, 0), undefined, 60_000);
      await manager.updateCursor(document("C:/project/a.ts", "", 0), selection(0, 1), undefined, 70_000);
      await manager.updateCursor(document("C:/project/a.ts", "", 0), selection(0, 2), undefined, 80_000);
      await manager.updateCursor(document("C:/project/a.ts", "", 0), selection(0, 3), undefined, 90_000);
      expect(manager.getBufferedSeconds()).toBe(30);

      // ...then, five seconds later, the agent patches the same file and its sidecar
      // event matches the change exactly.
      await manager.recordTextChange(
        document("C:/project/a.ts", "hello"),
        [{ text: "hello", rangeLength: 0 }],
        selection(0, 3),
        105_000
      );
      await manager.flushDueBuffers("timer", 130_000);

      const payload = sendHeartbeat.mock.calls.at(-1)?.[4];
      // The agent owns the line counts and the interval its own edit closed; the
      // developer keeps the 40 seconds they had already earned.
      expect(payload.human_lines_added).toBeUndefined();
      expect(payload.active_seconds).toBe(30);
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
          unattributed_lines_added: undefined,
          human_lines_added: undefined,
          actor_type: "unknown",
          actor_confidence: 0
        })
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("does not relabel a preceding human interval as AI when a whole-file overwrite follows it", async () => {
    // Missing before-content cannot establish ownership of the entire overwrite.
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
    try {
      const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.writeFile(
        logPath,
        JSON.stringify({
          event_id: "claude-write-overwrite",
          entity: "C:/project/a.ts",
          time: 105,
          lines_added: 5,
          lines_deleted: 0,
          agent: "claude-code",
          actor_type: "ai_verified",
          actor_confidence: 1,
          content_fingerprint: contentFingerprint("line1\nline2\nline3\nline4\nline5")
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

      await manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 0), undefined, 60_000);
      await manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 1), undefined, 70_000);
      await manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 2), undefined, 80_000);
      await manager.updateCursor({ uri: fileUri("C:/project/a.ts") }, selection(0, 3), undefined, 90_000);
      expect(manager.getBufferedSeconds()).toBe(30);

      await manager.recordTextChange(
        document("C:/project/a.ts", "line1\nline2\nline3\nline4\nline5"),
        [
          {
            text: "line1\nline2\nline3\nline4\nline5",
            rangeLength: 4000,
            range: { start: { line: 0, character: 0 }, end: { line: 200, character: 0 } } as any
          }
        ],
        selection(0, 3),
        105_000
      );
      await manager.flushDueBuffers("timer", 130_000);

      const payload = sendHeartbeat.mock.calls.at(-1)?.[4];
      expect(payload.human_lines_added).toBeUndefined();
      expect(payload.active_seconds).toBe(45);
      expect(payload.actor_type).toBe("unknown");
      expect(payload.ai_event_id).toBeUndefined();
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("keeps a whole-file overwrite unknown when its before-version is missing", async () => {
    // A matching final fingerprint cannot fill in missing before-content.
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
    try {
      const logPath = path.join(homeDir, ".wakaclock", "ai-events.jsonl");
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.writeFile(
        logPath,
        JSON.stringify({
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
          actor_confidence: 1,
          content_fingerprint: contentFingerprint("line1\nline2\nline3\nline4\nline5")
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
        document("C:/project/b.ts", "line1\nline2\nline3\nline4\nline5"),
        [
          {
            text: "line1\nline2\nline3\nline4\nline5",
            rangeLength: 4000,
            range: { start: { line: 0, character: 0 }, end: { line: 200, character: 0 } } as any
          }
        ],
        selection(0, 0),
        10_000
      );
      expect(sendHeartbeat).toHaveBeenCalledTimes(1);

      await manager.recordSave({ uri: fileUri("C:/project/b.ts") }, 10_500);

      expect(sendHeartbeat).toHaveBeenCalledTimes(2);
      const payload = sendHeartbeat.mock.calls[0][4];
      expect(payload.actor_type).toBe("unknown");
      expect(payload.actor_confidence).toBe(0);
      expect(payload.ai_agent).toBeUndefined();
      expect(payload.ai_provider).toBeUndefined();
      expect(payload.ai_model).toBeUndefined();
      expect(payload.ai_event_id).toBeUndefined();
      expect(payload.human_lines_added).toBeUndefined();
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("does not attribute prettier or eslint whole-file reformat to AI without sidecar evidence", async () => {
    // Formatter events provide neither human nor model authorship evidence.
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "atoaxis-ai-attribution-"));
    try {
      // No sidecar file is written at all for this home directory.
      const sendHeartbeat = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      const manager = new HeartbeatBufferManager(
        createConfig,
        { sendHeartbeat },
        new Logger(() => false),
        undefined,
        new AiAttributionStore(homeDir)
      );

      await manager.recordTextChange(
        { uri: fileUri("C:/project/formatted.ts") },
        [
          {
            text: "line1\nline2\nline3\nline4\nline5",
            rangeLength: 4000,
            range: { start: { line: 0, character: 0 }, end: { line: 200, character: 0 } } as any
          }
        ],
        selection(0, 0),
        10_000
      );
      await manager.flushDueBuffers("timer", 40_000);

      expect(sendHeartbeat).toHaveBeenCalledTimes(1);
      const payload = sendHeartbeat.mock.calls[0][4];
      expect(payload.actor_type).toBe("unknown");
      expect(payload.ai_event_id).toBeUndefined();
      expect(payload.human_lines_added).toBeUndefined();
      expect(payload.unattributed_lines_added).toBeUndefined();
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });
});
