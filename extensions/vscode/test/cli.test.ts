import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WakaclockCliService } from "../src/cli";
import { Logger } from "../src/logging";
import type { CliResult, WakaclockConfigSnapshot } from "../src/types";

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args)
}));

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

function mockChild(result: Partial<CliResult> & { error?: Error } = {}) {
  const child = new EventEmitter() as EventEmitter & {
    stdin: PassThrough;
    stdout: PassThrough;
    stderr: PassThrough;
  };
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();

  queueMicrotask(() => {
    if (result.error) {
      child.emit("error", result.error);
      return;
    }
    if (result.stdout) {
      child.stdout.write(result.stdout);
    }
    if (result.stderr) {
      child.stderr.write(result.stderr);
    }
    child.stdout.end();
    child.stderr.end();
    child.emit("close", result.exitCode ?? 0);
  });

  return child;
}

describe("WakaclockCliService", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it("sends no stdin payload when there are no extras", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.sendHeartbeat("C:/project/a.ts", false, "coding");

    const child = spawnMock.mock.results[0]?.value as ReturnType<typeof mockChild>;
    expect(spawnMock).toHaveBeenCalledWith(
      "wakaclock-cli",
      expect.any(Array),
      expect.objectContaining({
        stdio: "pipe",
        env: expect.objectContaining({
          WAKACLOCK_EDITOR: "vscode"
        })
      })
    );
    expect(child.stdin.read()?.toString() ?? "").toBe("");
  });

  it("marks a remote extension host for topology-aware CLI calls", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(
      createConfig,
      new Logger(() => false),
      () => Promise.resolve(undefined),
      undefined,
      undefined,
      "remote_extension",
    );

    await service.sendHeartbeat("/workspace/project/main.ts", false, "coding");

    expect(spawnMock.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({
        env: expect.objectContaining({
          WAKACLOCK_EXECUTION_SURFACE: "remote_extension",
          WAKACLOCK_TOPOLOGY_AUTO: "1",
        }),
      }),
    );
  });

  it("writes json array to stdin when extras are provided", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.sendHeartbeat("C:/project/a.ts", false, "coding", [
      { entity: "C:/project/b.ts", keystrokes: 3 }
    ]);

    const child = spawnMock.mock.results[0]?.value as ReturnType<typeof mockChild>;
    const stdinPayload = child.stdin.read()?.toString() ?? "";
    expect(stdinPayload).toContain("\"entity\": \"C:/project/b.ts\"");
    expect(spawnMock.mock.calls[0][1]).toContain("--extra-heartbeats");
  });

  it("passes --project for the primary heartbeat when provided", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.sendHeartbeat("C:/project/a.ts", false, "coding", [], {
      project: "Daniel"
    });

    expect(spawnMock.mock.calls[0][1]).toContain("--project");
    expect(spawnMock.mock.calls[0][1]).toContain("Daniel");
  });

  it("passes the original event timestamp to the CLI", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.sendHeartbeat("C:/project/a.ts", false, "coding", [], { time: 123.25 });

    expect(spawnMock.mock.calls[0][1]).toEqual(
      expect.arrayContaining(["--time", "123.25"])
    );
  });

  it("passes AI attribution metadata to the CLI", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.sendHeartbeat("C:/project/a.ts", true, "coding", [], {
      ai_agent: "codex",
      ai_provider: "openai",
      ai_model: "gpt-5",
      ai_source: "agent_hook",
      ai_confidence: "verified",
      ai_event_id: "event-1",
      ai_lines_added: 12,
      ai_lines_deleted: 3
    });

    expect(spawnMock.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        "--ai-agent",
        "codex",
        "--ai-provider",
        "openai",
        "--ai-model",
        "gpt-5",
        "--ai-source",
        "agent_hook",
        "--ai-confidence",
        "verified",
        "--ai-event-id",
        "event-1",
        "--ai-lines-added",
        "12",
        "--ai-lines-deleted",
        "3"
      ])
    );
  });

  it("passes clipboard metadata to a capable CLI", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.sendHeartbeat("C:/project/a.ts", false, "coding", [], {
      clipboard_tracking_version: 1,
      paste_actions: 1,
      pasted_chars: 2_000,
      paste_external_or_unknown_actions: 1
    });

    expect(spawnMock.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        "--clipboard-tracking-version",
        "1",
        "--paste-actions",
        "1",
        "--pasted-chars",
        "2000",
        "--paste-external-or-unknown-actions",
        "1"
      ])
    );
  });

  it("retries without clipboard flags when the installed CLI is legacy", async () => {
    spawnMock
      .mockImplementationOnce(() =>
        mockChild({ stderr: "error: unexpected argument '--clipboard-tracking-version'", exitCode: 2 })
      )
      .mockImplementationOnce(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await expect(
      service.sendHeartbeat("C:/project/a.ts", false, "coding", [], {
        clipboard_tracking_version: 1,
        copy_actions: 1
      })
    ).resolves.toEqual({ stdout: "ok\n", stderr: "", exitCode: 0 });

    expect(spawnMock.mock.calls[0][1]).toContain("--copy-actions");
    expect(spawnMock.mock.calls[1][1]).not.toContain("--copy-actions");
    expect(spawnMock.mock.calls[1][1]).toContain("--entity");
  });

  it("passes stable heartbeat ids and explicit activity segments", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.sendHeartbeat("C:/project/a.ts", false, "coding", [], {
      heartbeat_id: "hb-1",
      activity_segments: [
        { segment_id: "segment-1", start: 100, end: 120, source: "editor" }
      ],
    });

    expect(spawnMock.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        "--heartbeat-id",
        "hb-1",
        "--activity-segments",
        JSON.stringify([{ segment_id: "segment-1", start: 100, end: 120, source: "editor" }])
      ])
    );
  });

  it("parses today output", async () => {
    spawnMock.mockImplementation(() =>
      mockChild({
        stdout: "Today: 1 hr 20 mins\nTotal seconds: 4800\nHeartbeats: 42\n",
        exitCode: 0
      })
    );
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await expect(service.getToday()).resolves.toEqual({
      humanReadable: "1 hr 20 mins",
      totalSeconds: 4800,
      heartbeatCount: 42
    });
  });

  it("parses additive confirmed and offline queue fields", async () => {
    spawnMock.mockImplementation(() =>
      mockChild({
        stdout:
          "Today: 5m 4s\nTotal seconds: 304\nConfirmed seconds: 300\nQueued seconds: 4\nHeartbeats: 42\nLast heartbeat at: 1770000000\n",
        exitCode: 0
      })
    );
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await expect(service.getToday()).resolves.toEqual({
      humanReadable: "5m 4s",
      totalSeconds: 304,
      confirmedSeconds: 300,
      queuedSeconds: 4,
      heartbeatCount: 42,
      lastHeartbeatAt: 1770000000
    });
  });

  // Offline-reliability OFF-02 (Phase 00 baseline): an unreachable server is only
  // visible on the `Server error:` line, which the text parser drops, so the
  // snapshot is indistinguishable from a verified idle day. Phase 01 moves this to
  // `today --json`; the fake CLI answers either form.
  it.fails("offline_today_is_parsed_with_its_connection_state", async () => {
    spawnMock.mockImplementation((_path: string, args: string[]) =>
      mockChild({
        stdout: args.includes("--json")
          ? JSON.stringify({
              total_seconds: 0,
              human_readable: "0s",
              heartbeat_count: 0,
              queued_heartbeats: 0,
              error: "HTTP error: error sending request for url (http://127.0.0.1:9/api/v1/status_bar/today)",
              connection: { state: "offline", reachable: false, last_error_kind: "network" },
              queue: { depth: 0, seconds_today: 0, eligible_now: 0 }
            })
          : "Server error: HTTP error: error sending request for url (http://127.0.0.1:9/api/v1/status_bar/today)\nToday: 0s\nTotal seconds: 0\nConfirmed seconds: 0\nQueued seconds: 0\nHeartbeats: 0\n",
        exitCode: 0
      })
    );
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    const snapshot = (await service.getToday("UTC")) as unknown as {
      connection?: { state?: string };
    };

    expect(snapshot.connection?.state).toBe("offline");
  });

  it("surfaces missing cli errors", async () => {
    spawnMock.mockImplementation(() =>
      mockChild({
        error: new Error("spawn wakaclock-cli ENOENT")
      })
    );
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await expect(service.getStatus()).rejects.toThrow(/Failed to start wakaclock-cli/);
  });

  describe("syncAndVerifyApiKey", () => {
    it("reports verified when the key mirrors and the server accepts it", async () => {
      spawnMock
        .mockImplementationOnce(() => mockChild({ stdout: "ok\n", exitCode: 0 }))
        .mockImplementationOnce(() =>
          mockChild({
            stdout: "Today: 1h 2m\nTotal seconds: 3720\nHeartbeats: 12\n",
            exitCode: 0
          })
        );
      const service = new WakaclockCliService(createConfig, new Logger(() => false));

      const result = await service.syncAndVerifyApiKey("wcl_good");

      expect(result).toEqual({ mirroredToCliConfig: true, verified: true });
      expect(spawnMock.mock.calls[0][1]).toEqual(["config", "set-key", "wcl_good"]);
      expect(spawnMock.mock.calls[1][1]).toEqual(["today"]);
    });

    // The failure that made a wrong key undetectable: the key saves fine, and only a
    // real authenticated request reveals the server rejects it.
    it("reports not verified when the server rejects the key", async () => {
      spawnMock
        .mockImplementationOnce(() => mockChild({ stdout: "ok\n", exitCode: 0 }))
        .mockImplementationOnce(() =>
          mockChild({ stderr: "Error: API key was rejected by the server.", exitCode: 1 })
        );
      const service = new WakaclockCliService(createConfig, new Logger(() => false));

      const result = await service.syncAndVerifyApiKey("wcl_revoked");

      expect(result.mirroredToCliConfig).toBe(true);
      expect(result.verified).toBe(false);
      expect(result.verifyError).toMatch(/rejected by the server/);
    });

    // A failed mirror must still be reported, because config.toml is the only place
    // the AI agent hooks can read a key from.
    it("reports a failed config.toml mirror without giving up on verification", async () => {
      spawnMock
        .mockImplementationOnce(() => mockChild({ stderr: "boom", exitCode: 1 }))
        .mockImplementationOnce(() =>
          mockChild({
            stdout: "Today: 0m\nTotal seconds: 0\nHeartbeats: 0\n",
            exitCode: 0
          })
        );
      const service = new WakaclockCliService(createConfig, new Logger(() => false));

      const result = await service.syncAndVerifyApiKey("wcl_good");

      expect(result.mirroredToCliConfig).toBe(false);
      expect(result.mirrorError).toMatch(/boom/);
      expect(result.verified).toBe(true);
    });
  });

  it("passes the key as an argv value to config set-key", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.setApiKey("wcl_abc123");

    expect(spawnMock.mock.calls[0][1]).toEqual(["config", "set-key", "wcl_abc123"]);
  });

  it("runs config clear-key with no arguments", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.clearApiKey();

    expect(spawnMock.mock.calls[0][1]).toEqual(["config", "clear-key"]);
  });

  it("rejects setApiKey when wakaclock-cli exits non-zero", async () => {
    spawnMock.mockImplementation(() =>
      mockChild({ stderr: "Error: could not write config\n", exitCode: 1 })
    );
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await expect(service.setApiKey("wcl_abc123")).rejects.toThrow(/exited with code 1/);
  });
});
