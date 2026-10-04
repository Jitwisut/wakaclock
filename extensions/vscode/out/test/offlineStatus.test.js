"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Offline-reliability Phase 00 — status-bar regression harness.
 *
 * Kept separate from statusBar.test.ts because that file's `vscode` mock has no
 * `showWarningMessage`: a refused-delivery snapshot would throw inside `refresh()`
 * and fall into the catch path, which hides exactly the mapping these tests pin.
 *
 * Every contract here started as an ignored/failing baseline test in Phase 00 and
 * is enforced since Phase 05. Never weaken an assertion to make one pass.
 */
const node_events_1 = require("node:events");
const node_stream_1 = require("node:stream");
const vitest_1 = require("vitest");
const cli_1 = require("../src/cli");
const logging_1 = require("../src/logging");
const statusBar_1 = require("../src/statusBar");
const item = {
    text: "",
    tooltip: "",
    command: "",
    name: "",
    backgroundColor: undefined,
    show: vitest_1.vi.fn(),
    hide: vitest_1.vi.fn(),
    dispose: vitest_1.vi.fn(),
};
const showWarningMessage = vitest_1.vi.fn().mockResolvedValue(undefined);
const showErrorMessage = vitest_1.vi.fn().mockResolvedValue(undefined);
const spawnMock = vitest_1.vi.fn();
vitest_1.vi.mock("vscode", () => ({
    StatusBarAlignment: { Left: 1 },
    ThemeColor: class {
        id;
        constructor(id) {
            this.id = id;
        }
    },
    window: {
        createStatusBarItem: () => item,
        showWarningMessage: (...args) => showWarningMessage(...args),
        showErrorMessage: (...args) => showErrorMessage(...args),
    },
    commands: { executeCommand: vitest_1.vi.fn() },
}));
vitest_1.vi.mock("node:child_process", () => ({
    spawn: (...args) => spawnMock(...args),
}));
function createConfig() {
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
const logger = new logging_1.Logger(() => false);
/** A deferred promise so a test controls exactly when a "request" completes. */
function deferred() {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
}
async function flushMicrotasks() {
    for (let index = 0; index < 10; index += 1) {
        await Promise.resolve();
    }
}
function mockChild(stdout, exitCode = 0) {
    const child = new node_events_1.EventEmitter();
    child.stdin = new node_stream_1.PassThrough();
    child.stdout = new node_stream_1.PassThrough();
    child.stderr = new node_stream_1.PassThrough();
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
    error: "HTTP error: error sending request for url (http://127.0.0.1:9/api/v1/status_bar/today?timezone=UTC)",
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
function fakeOfflineCli() {
    spawnMock.mockImplementation((_path, args) => mockChild(args.includes("--json") ? OFFLINE_EMPTY_TODAY_JSON : OFFLINE_EMPTY_TODAY_TEXT));
}
(0, vitest_1.describe)("offline status contract", () => {
    (0, vitest_1.beforeEach)(() => {
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
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.useRealTimers();
    });
    // OFF-01: `Delivery: REFUSED` is printed for *any* recorded failure, including
    // a connection refused, and the status bar maps every REFUSED to subscription.
    (0, vitest_1.it)("network_failure_is_not_reported_as_subscription_required", async () => {
        const snapshot = {
            humanReadable: "30s",
            totalSeconds: 30,
            confirmedSeconds: 0,
            queuedSeconds: 30,
            heartbeatCount: 0,
            queuedHeartbeats: 1,
            delivery: "REFUSED - HTTP error: error sending request for url (http://127.0.0.1:49238/api/v1/heartbeats)",
        };
        const controller = new statusBar_1.StatusBarController(createConfig, { getToday: vitest_1.vi.fn().mockResolvedValue(snapshot) }, logger);
        await controller.refresh();
        (0, vitest_1.expect)(item.text).not.toContain("$(warning)");
        (0, vitest_1.expect)(item.text.startsWith("$(cloud-offline)")).toBe(true);
        (0, vitest_1.expect)(item.command).toBe("wakaclock.showToday");
        (0, vitest_1.expect)(showWarningMessage).not.toHaveBeenCalled();
    });
    // Guard: a real 402 refusal must keep the subscription warning.
    (0, vitest_1.it)("a_real_402_refusal_is_reported_as_subscription_required", async () => {
        const snapshot = {
            humanReadable: "30s",
            totalSeconds: 30,
            queuedSeconds: 30,
            heartbeatCount: 0,
            queuedHeartbeats: 1,
            delivery: 'REFUSED - HTTP status 402: {"error":"trial expired or subscription inactive"}',
        };
        const controller = new statusBar_1.StatusBarController(createConfig, { getToday: vitest_1.vi.fn().mockResolvedValue(snapshot) }, logger);
        await controller.refresh();
        (0, vitest_1.expect)(item.text.startsWith("$(warning)")).toBe(true);
        (0, vitest_1.expect)(showWarningMessage).toHaveBeenCalledTimes(1);
    });
    // OFF-02: the CLI → parser → status bar path. The text parser drops the
    // `Server error:` line, so an unreachable server with an empty queue renders
    // exactly like a verified, idle day.
    (0, vitest_1.it)("offline_today_with_an_empty_queue_is_not_verified", async () => {
        fakeOfflineCli();
        const cli = new cli_1.WakaclockCliService(createConfig, logger);
        const controller = new statusBar_1.StatusBarController(createConfig, cli, logger);
        await controller.refresh();
        (0, vitest_1.expect)(item.text).not.toBe("$(clock) 0s");
        (0, vitest_1.expect)(item.text.startsWith("$(cloud-offline)")).toBe(true);
    });
    // Phase 01 — the typed `connection.state` decides the status bar.
    function controllerFor(snapshot) {
        return new statusBar_1.StatusBarController(createConfig, { getToday: vitest_1.vi.fn().mockResolvedValue(snapshot) }, logger);
    }
    const base = { humanReadable: "0s", totalSeconds: 0, heartbeatCount: 0 };
    (0, vitest_1.it)("renders_cloud_offline_for_network_failure_with_empty_queue", async () => {
        await controllerFor({
            ...base,
            queuedHeartbeats: 0,
            connection: { state: "offline", reachable: false, lastErrorKind: "network" },
        }).refresh();
        (0, vitest_1.expect)(item.text).toBe("$(cloud-offline) AtoAxis: 0s");
        (0, vitest_1.expect)(String(item.tooltip)).toContain("Offline");
        (0, vitest_1.expect)(item.command).toBe("wakaclock.showToday");
        (0, vitest_1.expect)(showWarningMessage).not.toHaveBeenCalled();
        (0, vitest_1.expect)(showErrorMessage).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("renders_subscription_required_only_for_payment_402", async () => {
        await controllerFor({
            ...base,
            queuedHeartbeats: 1,
            delivery: 'REFUSED - HTTP status 402: {"error":"trial expired"}',
            connection: { state: "subscription_required", reachable: true, httpStatus: 402 },
        }).refresh();
        (0, vitest_1.expect)(item.text.startsWith("$(warning) AtoAxis:")).toBe(true);
        (0, vitest_1.expect)(showWarningMessage).toHaveBeenCalledTimes(1);
        // Every other typed state must not produce the subscription warning.
        for (const state of ["online", "offline", "retryable_server_error", "validation_rejected"]) {
            showWarningMessage.mockClear();
            await controllerFor({ ...base, connection: { state } }).refresh();
            (0, vitest_1.expect)(item.text.startsWith("$(warning)"), state).toBe(false);
            (0, vitest_1.expect)(showWarningMessage, state).not.toHaveBeenCalled();
        }
    });
    (0, vitest_1.it)("renders_key_rejected_only_for_auth_401", async () => {
        await controllerFor({
            ...base,
            connection: { state: "auth_rejected", reachable: true, authenticated: false, httpStatus: 401 },
        }).refresh();
        (0, vitest_1.expect)(item.text).toBe("$(warning) AtoAxis: key rejected");
        (0, vitest_1.expect)(item.command).toBe("wakaclock.setApiKey");
        (0, vitest_1.expect)(showErrorMessage).toHaveBeenCalledTimes(1);
        for (const state of ["offline", "subscription_required", "retryable_server_error"]) {
            showErrorMessage.mockClear();
            await controllerFor({ ...base, connection: { state } }).refresh();
            (0, vitest_1.expect)(item.text, state).not.toContain("key rejected");
            (0, vitest_1.expect)(showErrorMessage, state).not.toHaveBeenCalled();
        }
    });
    (0, vitest_1.it)("renders_a_retryable_server_error_as_degraded_not_invalid_key", async () => {
        await controllerFor({
            ...base,
            queuedHeartbeats: 2,
            connection: { state: "retryable_server_error", reachable: true, httpStatus: 503 },
        }).refresh();
        (0, vitest_1.expect)(item.text.startsWith("$(cloud-offline)")).toBe(true);
        (0, vitest_1.expect)(String(item.tooltip)).toContain("Service degraded");
        (0, vitest_1.expect)(item.command).toBe("wakaclock.showToday");
    });
    (0, vitest_1.it)("an_online_server_with_a_draining_backlog_is_not_offline", async () => {
        await controllerFor({
            ...base,
            queuedHeartbeats: 3,
            queuedSeconds: 90,
            connection: { state: "online", reachable: true, authenticated: true },
        }).refresh();
        (0, vitest_1.expect)(item.text).toBe("$(clock) 0s");
        (0, vitest_1.expect)(String(item.tooltip)).toContain("Held locally: 3 heartbeat(s)");
    });
    (0, vitest_1.it)("a_legacy_cli_refusal_without_a_402_status_is_treated_as_offline", async () => {
        // Pre-Phase-01 CLIs printed REFUSED for every recorded failure.
        await controllerFor({
            ...base,
            queuedHeartbeats: 1,
            delivery: "REFUSED - HTTP error: error sending request for url (http://127.0.0.1:40213/api/v1/heartbeats)",
        }).refresh();
        (0, vitest_1.expect)(item.text.startsWith("$(cloud-offline)")).toBe(true);
        (0, vitest_1.expect)(showWarningMessage).not.toHaveBeenCalled();
    });
    // OFF-07: every call starts another `wakaclock today` child process while the
    // previous one is still waiting on the network.
    (0, vitest_1.it)("status_bar_refresh_is_single_flight", async () => {
        const pending = deferred();
        const getToday = vitest_1.vi
            .fn()
            .mockImplementationOnce(() => pending.promise)
            .mockResolvedValue({ humanReadable: "0s", totalSeconds: 0, heartbeatCount: 0 });
        const controller = new statusBar_1.StatusBarController(createConfig, { getToday }, logger);
        const calls = [1, 2, 3, 4, 5].map(() => controller.refresh());
        await flushMicrotasks();
        (0, vitest_1.expect)(getToday).toHaveBeenCalledTimes(1);
        pending.resolve({ humanReadable: "0s", totalSeconds: 0, heartbeatCount: 0 });
        await Promise.all(calls);
        await flushMicrotasks();
        // At most one coalesced rerun for everything requested while in flight.
        (0, vitest_1.expect)(getToday.mock.calls.length).toBeLessThanOrEqual(2);
    });
    (0, vitest_1.it)("activity_repaint_does_not_spawn_a_network_refresh_when_snapshot_exists", async () => {
        const getToday = vitest_1.vi.fn().mockResolvedValue({
            humanReadable: "1m",
            totalSeconds: 60,
            heartbeatCount: 2,
            connection: { state: "online" },
        });
        const controller = new statusBar_1.StatusBarController(createConfig, { getToday }, logger);
        await controller.refresh();
        (0, vitest_1.expect)(getToday).toHaveBeenCalledTimes(1);
        // Local typing repaints from the snapshot already held; it must not start
        // another CLI process per keystroke burst.
        controller.setBufferedSecondsProvider(() => 30);
        controller.handleActivity();
        controller.handleActivity();
        await flushMicrotasks();
        (0, vitest_1.expect)(getToday).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(String(item.tooltip)).toContain("Local pending: 30s");
    });
    (0, vitest_1.it)("late_offline_response_cannot_replace_a_newer_online_snapshot", async () => {
        const slowOffline = deferred();
        const getToday = vitest_1.vi
            .fn()
            .mockImplementationOnce(() => slowOffline.promise)
            .mockResolvedValue({
            humanReadable: "5m",
            totalSeconds: 300,
            heartbeatCount: 9,
            connection: { state: "online", reachable: true },
        });
        const controller = new statusBar_1.StatusBarController(createConfig, { getToday }, logger);
        const stale = controller.refresh();
        await flushMicrotasks();
        // The key or server changed while that request was still running, so its
        // answer describes an account this bar no longer shows.
        controller.invalidateScope();
        slowOffline.resolve({
            humanReadable: "0s",
            totalSeconds: 0,
            heartbeatCount: 0,
            queuedHeartbeats: 4,
            connection: { state: "offline", reachable: false },
        });
        await stale;
        await flushMicrotasks();
        (0, vitest_1.expect)(item.text).toBe("");
        (0, vitest_1.expect)(item.show).not.toHaveBeenCalled();
        // The next refresh, in the current scope, is what paints.
        await controller.refresh();
        (0, vitest_1.expect)(item.text).toBe("$(clock) 5m 0s");
    });
    (0, vitest_1.it)("dispose_ignores_late_results_and_clears_timers", async () => {
        vitest_1.vi.useFakeTimers();
        const pending = deferred();
        const getToday = vitest_1.vi.fn().mockReturnValue(pending.promise);
        const controller = new statusBar_1.StatusBarController(createConfig, { getToday }, logger);
        controller.start();
        await flushMicrotasks();
        (0, vitest_1.expect)(getToday).toHaveBeenCalledTimes(1);
        controller.dispose();
        await vitest_1.vi.advanceTimersByTimeAsync(60_000);
        pending.resolve({ humanReadable: "9m", totalSeconds: 540, heartbeatCount: 1 });
        await flushMicrotasks();
        // No further refreshes after dispose, and the late result repaints nothing.
        (0, vitest_1.expect)(getToday).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(item.text).not.toContain("9m");
    });
    // OFF-07 with the fake clock: a hung request must not let the 15s poll stack
    // one CLI process per tick.
    (0, vitest_1.it)("status_bar_polling_does_not_stack_while_a_refresh_is_in_flight", async () => {
        vitest_1.vi.useFakeTimers();
        const pending = deferred();
        const getToday = vitest_1.vi.fn().mockImplementation(() => pending.promise);
        const controller = new statusBar_1.StatusBarController(createConfig, { getToday }, logger);
        try {
            controller.start();
            for (let tick = 0; tick < 4; tick += 1) {
                await vitest_1.vi.advanceTimersByTimeAsync(15_000);
            }
            (0, vitest_1.expect)(getToday).toHaveBeenCalledTimes(1);
        }
        finally {
            pending.resolve({ humanReadable: "0s", totalSeconds: 0, heartbeatCount: 0 });
            controller.dispose();
        }
    });
});
//# sourceMappingURL=offlineStatus.test.js.map