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

  it("passes the workspace name as --alternate-project, never as a --project override", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.sendHeartbeat("C:/project/a.ts", false, "coding", [], {
      alternate_project: "Daniel"
    });

    const args = spawnMock.mock.calls[0][1] as string[];
    const flagIndex = args.indexOf("--alternate-project");
    expect(flagIndex).toBeGreaterThan(-1);
    expect(args[flagIndex + 1]).toBe("Daniel");
    expect(args).not.toContain("--project");
  });

  it("omits --alternate-project when no workspace name is known", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.sendHeartbeat("C:/project/a.ts", false, "coding", [], {});

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).not.toContain("--alternate-project");
    expect(args).not.toContain("--project");
  });

  it("sends alternate_project, not project, in extra heartbeat payloads", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await service.sendHeartbeat("C:/project/a.ts", false, "coding", [
      { entity: "C:/project/b.ts", alternate_project: "Daniel" }
    ]);

    const child = spawnMock.mock.results[0]?.value as ReturnType<typeof mockChild>;
    const extras = JSON.parse(child.stdin.read()?.toString() ?? "[]") as Record<string, unknown>[];
    expect(extras[0]).toMatchObject({ entity: "C:/project/b.ts", alternate_project: "Daniel" });
    expect(extras[0]).not.toHaveProperty("project");
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

  it("retries without the fallback project name, never as --project, on a legacy CLI", async () => {
    spawnMock
      .mockImplementationOnce(() =>
        mockChild({ stderr: "error: unexpected argument '--alternate-project' found", exitCode: 2 })
      )
      .mockImplementationOnce(() => mockChild({ stdout: "ok\n", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await expect(
      service.sendHeartbeat("C:/project/a.ts", false, "coding", [], {
        alternate_project: "vscode"
      })
    ).resolves.toEqual({ stdout: "ok\n", stderr: "", exitCode: 0 });

    expect(spawnMock.mock.calls[0][1]).toContain("--alternate-project");
    expect(spawnMock.mock.calls[1][1]).not.toContain("--alternate-project");
    expect(spawnMock.mock.calls[1][1]).not.toContain("--project");
    expect(spawnMock.mock.calls[1][1]).not.toContain("vscode");
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

  // Offline-reliability OFF-02 (baseline in Phase 00, fixed in Phase 01): the text
  // parser used to drop the `Server error:` line, so an unreachable server read as a
  // verified idle day. `getToday` now reads `today --json`; the fake answers either.
  it("offline_today_is_parsed_with_its_connection_state", async () => {
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

  it("parses_structured_today_json", async () => {
    spawnMock.mockImplementation(() =>
      mockChild({
        stdout: JSON.stringify({
          confirmed_seconds: 300,
          queued_seconds: 4,
          total_seconds: 304,
          human_readable: "5m 4s",
          heartbeat_count: 42,
          last_heartbeat_at: 1770000000,
          covered_intervals: [],
          discarded_seconds: 0,
          agent_health: { installed: true, running: false },
          queued_heartbeats: 2,
          delivery_failure: {
            at: 1770000000,
            message: "HTTP error: error sending request for url (http://127.0.0.1:40213/api/v1/heartbeats)",
            category: "network",
            message_code: "connect_failed"
          },
          connection: {
            state: "offline",
            reachable: false,
            authenticated: null,
            http_status: null,
            last_error_kind: "network",
            last_error_at: 1770000001
          },
          queue: { depth: 2, seconds_today: 4 }
        }),
        exitCode: 0
      })
    );
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    const snapshot = await service.getToday("Asia/Bangkok");

    expect(spawnMock.mock.calls[0][1]).toEqual(["today", "--timezone", "Asia/Bangkok", "--json"]);
    expect(snapshot).toEqual({
      humanReadable: "5m 4s",
      totalSeconds: 304,
      heartbeatCount: 42,
      confirmedSeconds: 300,
      queuedSeconds: 4,
      lastHeartbeatAt: 1770000000,
      agentHealth: { state: "installed (stopped)" },
      discardedSeconds: 0,
      queuedHeartbeats: 2,
      delivery:
        "OFFLINE - HTTP error: error sending request for url (http://127.0.0.1:40213/api/v1/heartbeats)",
      connection: {
        state: "offline",
        reachable: false,
        authenticated: null,
        httpStatus: null,
        lastErrorKind: "network",
        lastErrorAt: 1770000001
      }
    });
  });

  it("labels a scoped network failure as offline, not a server refusal", async () => {
    spawnMock.mockImplementation(() =>
      mockChild({
        stdout: JSON.stringify({
          total_seconds: 0,
          human_readable: "0s",
          heartbeat_count: 0,
          queued_heartbeats: 1,
          // Phase 03 renamed the classified field to `category`; a pre-Phase-03
          // binary emits `kind` instead and must keep working.
          delivery_failure: { message: "connection refused", category: "network" },
          connection: { state: "offline", reachable: false, last_error_kind: "network" }
        }),
        exitCode: 0
      })
    );
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    const snapshot = await service.getToday("UTC");

    expect(snapshot.delivery).toBe("OFFLINE - connection refused");
  });

  it("falls_back_to_legacy_text_without_losing_timezone_behavior", async () => {
    // A CLI without `today --json`, and an older one without `--timezone` either.
    spawnMock.mockImplementation((_path: string, args: string[]) => {
      if (args.includes("--json") || args.includes("--timezone")) {
        return mockChild({
          stderr: `error: unexpected argument '${args.includes("--json") ? "--json" : "--timezone"}' found\n\nUsage: wakaclock today`,
          exitCode: 2
        });
      }
      return mockChild({ stdout: "Today: 1m\nTotal seconds: 60\nHeartbeats: 3\n", exitCode: 0 });
    });
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await expect(service.getToday("Asia/Bangkok")).resolves.toEqual({
      humanReadable: "1m",
      totalSeconds: 60,
      heartbeatCount: 3,
      legacyCli: true
    });
    expect(spawnMock.mock.calls.map((call) => call[1])).toEqual([
      ["today", "--timezone", "Asia/Bangkok", "--json"],
      ["today", "--timezone", "Asia/Bangkok"],
      ["today"]
    ]);

    // The unsupported flag is remembered: the next refresh does not retry --json.
    spawnMock.mockClear();
    await service.getToday("Asia/Bangkok");
    expect(spawnMock.mock.calls[0][1]).toEqual(["today", "--timezone", "Asia/Bangkok"]);
  });

  it("does not retry text mode when today --json fails for another reason", async () => {
    spawnMock.mockImplementation(() =>
      mockChild({ stderr: "Error: API key was rejected by the server.", exitCode: 1 })
    );
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await expect(service.getToday("UTC")).rejects.toThrow("API key was rejected");
    expect(spawnMock).toHaveBeenCalledTimes(1);
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
      expect(spawnMock.mock.calls[1][1]).toEqual(["today", "--json"]);
    });

    it("reports not verified when today --json says the key was rejected", async () => {
      spawnMock
        .mockImplementationOnce(() => mockChild({ stdout: "ok\n", exitCode: 0 }))
        .mockImplementationOnce(() =>
          mockChild({
            stdout: JSON.stringify({
              total_seconds: 0,
              human_readable: "0s",
              heartbeat_count: 0,
              connection: { state: "auth_rejected", reachable: true, http_status: 401 }
            }),
            exitCode: 0
          })
        );
      const service = new WakaclockCliService(createConfig, new Logger(() => false));

      const result = await service.syncAndVerifyApiKey("wcl_revoked");

      expect(result.verified).toBe(false);
      expect(result.verifyError).toContain("rejected");
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

  it("coalesces concurrent broker status probes into one CLI process", async () => {
    spawnMock.mockImplementation(() =>
      mockChild({
        stdout: JSON.stringify({ runtime_mode: "on_demand", inbox: { pending: 2 } }),
        exitCode: 0
      })
    );
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    const [first, second] = await Promise.all([
      service.getBrokerStatus(),
      service.getBrokerStatus()
    ]);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.inbox?.pending).toBe(2);
  });

  it("coalesces concurrent automatic AI sync passes", async () => {
    spawnMock.mockImplementation(() => mockChild({ stdout: "{}", exitCode: 0 }));
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await Promise.all([service.syncAiActivity(), service.syncAiActivity()]);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0][1]).toEqual(["sync", "--automatic", "--json"]);
  });

  it("rejects setApiKey when wakaclock-cli exits non-zero", async () => {
    spawnMock.mockImplementation(() =>
      mockChild({ stderr: "Error: could not write config\n", exitCode: 1 })
    );
    const service = new WakaclockCliService(createConfig, new Logger(() => false));

    await expect(service.setApiKey("wcl_abc123")).rejects.toThrow(/exited with code 1/);
  });
});
