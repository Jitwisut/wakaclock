"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Offline-reliability Phase 05 — the single-flight contract (OFF-07).
 *
 * A refresh spawns a CLI process and can outlive its own interval, so the rule
 * is: one run at a time, at most one queued follow-up, and a result from a
 * superseded scope is never applied.
 */
const vitest_1 = require("vitest");
const singleFlight_1 = require("../src/singleFlight");
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => {
        resolve = done;
        reject = fail;
    });
    return { promise, resolve, reject };
}
async function flushMicrotasks() {
    for (let index = 0; index < 10; index += 1) {
        await Promise.resolve();
    }
}
(0, vitest_1.describe)("SingleFlight", () => {
    (0, vitest_1.it)("ten_refresh_triggers_spawn_one_cli_and_one_follow_up", async () => {
        const pending = deferred();
        const task = vitest_1.vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
        const flight = new singleFlight_1.SingleFlight();
        const calls = Array.from({ length: 10 }, () => flight.run(task));
        await flushMicrotasks();
        (0, vitest_1.expect)(task).toHaveBeenCalledTimes(1);
        pending.resolve();
        await Promise.all(calls);
        await flushMicrotasks();
        // The nine triggers that arrived while it ran collapse into one follow-up.
        (0, vitest_1.expect)(task).toHaveBeenCalledTimes(2);
        (0, vitest_1.expect)(flight.isRunning).toBe(false);
        (0, vitest_1.expect)(flight.hasQueuedRerun).toBe(false);
    });
    (0, vitest_1.it)("single_flight_unlocks_after_error", async () => {
        const failing = vitest_1.vi.fn().mockRejectedValue(new Error("cli exited with code 1"));
        const flight = new singleFlight_1.SingleFlight();
        await (0, vitest_1.expect)(flight.run(failing)).rejects.toThrow("cli exited");
        (0, vitest_1.expect)(flight.isRunning).toBe(false);
        // A later refresh still runs: one failure must not wedge the surface.
        const succeeding = vitest_1.vi.fn().mockResolvedValue(undefined);
        await flight.run(succeeding);
        (0, vitest_1.expect)(succeeding).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("key_change_invalidates_in_flight_old_scope_result", async () => {
        const flight = new singleFlight_1.SingleFlight();
        const generation = flight.current();
        (0, vitest_1.expect)(flight.isCurrent(generation)).toBe(true);
        flight.invalidate();
        (0, vitest_1.expect)(flight.isCurrent(generation)).toBe(false);
        (0, vitest_1.expect)(flight.isCurrent(flight.current())).toBe(true);
    });
    (0, vitest_1.it)("multiple_pending_verification_requests_share_one_retry_loop", async () => {
        // The real loop retries an unreachable server forever; this stands in for it.
        const stop = deferred();
        const retryLoop = vitest_1.vi.fn().mockImplementation(() => stop.promise);
        const flight = new singleFlight_1.SingleFlight();
        void flight.run(retryLoop);
        void flight.run(retryLoop);
        void flight.run(retryLoop);
        await flushMicrotasks();
        (0, vitest_1.expect)(retryLoop).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(flight.hasQueuedRerun).toBe(true);
        stop.resolve();
        await flushMicrotasks();
        // Exactly one follow-up attempt, not one per command invocation.
        (0, vitest_1.expect)(retryLoop).toHaveBeenCalledTimes(2);
    });
    (0, vitest_1.it)("dispose_ignores_late_results_and_clears_timers", async () => {
        const pending = deferred();
        const task = vitest_1.vi.fn().mockReturnValue(pending.promise);
        const flight = new singleFlight_1.SingleFlight();
        const generation = flight.current();
        void flight.run(task);
        await flushMicrotasks();
        flight.dispose();
        (0, vitest_1.expect)(flight.isCurrent(generation)).toBe(false);
        pending.resolve();
        await flushMicrotasks();
        // Nothing new starts after dispose, including the queued follow-up.
        await flight.run(task);
        (0, vitest_1.expect)(task).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=singleFlight.test.js.map