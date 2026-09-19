/**
 * Offline-reliability Phase 00 — status-bar regression harness.
 *
 * Kept separate from statusBar.test.ts because that file's `vscode` mock has no
 * `showWarningMessage`: a refused-delivery snapshot would throw inside `refresh()`
 * and fall into the catch path, which hides exactly the mapping these tests pin.
 *
 * `it.fails(...)` marks an OFF-0x contract that is broken on the pre-fix code. The
 * phase that fixes the bug changes it to `it(...)`; never weaken the assertion.
 */
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WakaclockCliService } from "../src/cli";
import { Logger } from "../src/logging";
import { StatusBarController } from "../src/statusBar";
import type { StatusBarSnapshot, WakaclockConfigSnapshot } from "../src/types";

const item = {
  text: "",
  tooltip: "",
  command: "",
  name: "",
  backgroundColor: undefined as unknown,
  show: vi.fn(),
  hide: vi.fn(),
  dispose: vi.fn(),
};

const showWarningMessage = vi.fn().mockResolvedValue(undefined);
const showErrorMessage = vi.fn().mockResolvedValue(undefined);
const spawnMock = vi.fn();

vi.mock("vscode", () => ({
  StatusBarAlignment: { Left: 1 },
  ThemeColor: class {
    public constructor(public readonly id: string) {}
  },
  window: {
    createStatusBarItem: () => item,
    showWarningMessage: (...args: unknown[]) => showWarningMessage(...args),
    showErrorMessage: (...args: unknown[]) => showErrorMessage(...args),
  },
  commands: { executeCommand: vi.fn() },
}));

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
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
    trackClipboardActions: true,
  };
}

const logger = new Logger(() => false);

/** A deferred promise so a test controls exactly when a "request" completes. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

function mockChild(stdout: string, exitCode = 0) {
  const child = new EventEmitter() as EventEmitter & {
    stdin: PassThrough;
    stdout: PassThrough;
    stderr: PassThrough;
  };
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  queueMicrotask(() => {
    child.stdout.write(stdout);
    child.stdout.end();
    child.stderr.end();
    child.emit("close", exitCode);
  });
  return child;
}

// What the current CLI prints for `today` while the API is unreachable and the
// local queue is empty (see `Commands::Today` in wakaclock-cli/src/main.rs).
const OFFLINE_EMPTY_TODAY_TEXT = [
  "Server error: HTTP error: error sending request for url (http://127.0.0.1:9/api/v1/status_bar/today?timezone=UTC)",
  "Today: 0s",
  "Total seconds: 0",
  "Confirmed seconds: 0",
  "Queued seconds: 0",
  "Heartbeats: 0",
  "Agent: not installed",
  "Discarded seconds: 0",
  "",
].join("\n");

// The same state through the Phase 01 structured contract (`today --json`).
const OFFLINE_EMPTY_TODAY_JSON = JSON.stringify({
  confirmed_seconds: 0,
  queued_seconds: 0,
  total_seconds: 0,
  human_readable: "0s",
  heartbeat_count: 0,
  error:
    "HTTP error: error sending request for url (http://127.0.0.1:9/api/v1/status_bar/today?timezone=UTC)",
  queued_heartbeats: 0,
  delivery_failure: null,
  connection: {
    state: "offline",
    reachable: false,
    authenticated: null,
    http_status: null,
    last_error_kind: "network",
    last_error_at: null,
  },
  queue: { depth: 0, seconds_today: 0, eligible_now: 0 },
});

/** A fake CLI that answers `today` in text or JSON depending on the flags. */
function fakeOfflineCli(): void {
  spawnMock.mockImplementation((_path: string, args: string[]) =>
    mockChild(args.includes("--json") ? OFFLINE_EMPTY_TODAY_JSON : OFFLINE_EMPTY_TODAY_TEXT),
  );
}

describe("offline status contract", () => {
  beforeEach(() => {
    item.text = "";
    item.tooltip = "";
    item.command = "";
    item.backgroundColor = undefined;
    item.show.mockReset();
    item.hide.mockReset();
    showWarningMessage.mockClear();
    showErrorMessage.mockClear();
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // OFF-01: `Delivery: REFUSED` is printed for *any* recorded failure, including
  // a connection refused, and the status bar maps every REFUSED to subscription.
  it.fails("network_failure_is_not_reported_as_subscription_required", async () => {
    const snapshot: StatusBarSnapshot = {
      humanReadable: "30s",
      totalSeconds: 30,
      confirmedSeconds: 0,
      queuedSeconds: 30,
      heartbeatCount: 0,
      queuedHeartbeats: 1,
      delivery:
        "REFUSED - HTTP error: error sending request for url (http://127.0.0.1:49238/api/v1/heartbeats)",
    };
    const controller = new StatusBarController(
      createConfig,
      { getToday: vi.fn().mockResolvedValue(snapshot) },
      logger,
    );

    await controller.refresh();

    expect(item.text).not.toContain("$(warning)");
    expect(item.text.startsWith("$(cloud-offline)")).toBe(true);
    expect(item.command).toBe("wakaclock.showToday");
    expect(showWarningMessage).not.toHaveBeenCalled();
  });

  // Guard: a real 402 refusal must keep the subscription warning.
  it("a_real_402_refusal_is_reported_as_subscription_required", async () => {
    const snapshot: StatusBarSnapshot = {
      humanReadable: "30s",
      totalSeconds: 30,
      queuedSeconds: 30,
      heartbeatCount: 0,
      queuedHeartbeats: 1,
      delivery:
        'REFUSED - HTTP status 402: {"error":"trial expired or subscription inactive"}',
    };
    const controller = new StatusBarController(
      createConfig,
      { getToday: vi.fn().mockResolvedValue(snapshot) },
      logger,
    );

    await controller.refresh();

    expect(item.text.startsWith("$(warning)")).toBe(true);
    expect(showWarningMessage).toHaveBeenCalledTimes(1);
  });

  // OFF-02: the CLI → parser → status bar path. The text parser drops the
  // `Server error:` line, so an unreachable server with an empty queue renders
  // exactly like a verified, idle day.
  it.fails("offline_today_with_an_empty_queue_is_not_verified", async () => {
    fakeOfflineCli();
    const cli = new WakaclockCliService(createConfig, logger);
    const controller = new StatusBarController(createConfig, cli, logger);

    await controller.refresh();

    expect(item.text).not.toBe("$(clock) 0s");
    expect(item.text.startsWith("$(cloud-offline)")).toBe(true);
  });

  // OFF-07: every call starts another `wakaclock today` child process while the
  // previous one is still waiting on the network.
  it.fails("status_bar_refresh_is_single_flight", async () => {
    const pending = deferred<StatusBarSnapshot>();
    const getToday = vi
      .fn()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue({ humanReadable: "0s", totalSeconds: 0, heartbeatCount: 0 });
    const controller = new StatusBarController(createConfig, { getToday }, logger);

    const calls = [1, 2, 3, 4, 5].map(() => controller.refresh());
    await flushMicrotasks();
    expect(getToday).toHaveBeenCalledTimes(1);

    pending.resolve({ humanReadable: "0s", totalSeconds: 0, heartbeatCount: 0 });
    await Promise.all(calls);
    await flushMicrotasks();
    // At most one coalesced rerun for everything requested while in flight.
    expect(getToday.mock.calls.length).toBeLessThanOrEqual(2);
  });

  // OFF-07 with the fake clock: a hung request must not let the 15s poll stack
  // one CLI process per tick.
  it.fails("status_bar_polling_does_not_stack_while_a_refresh_is_in_flight", async () => {
    vi.useFakeTimers();
    const pending = deferred<StatusBarSnapshot>();
    const getToday = vi.fn().mockImplementation(() => pending.promise);
    const controller = new StatusBarController(createConfig, { getToday }, logger);

    try {
      controller.start();
      for (let tick = 0; tick < 4; tick += 1) {
        await vi.advanceTimersByTimeAsync(15_000);
      }

      expect(getToday).toHaveBeenCalledTimes(1);
    } finally {
      pending.resolve({ humanReadable: "0s", totalSeconds: 0, heartbeatCount: 0 });
      controller.dispose();
    }
  });
});
