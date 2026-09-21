/**
 * Offline-reliability Phase 05 — the single-flight contract (OFF-07).
 *
 * A refresh spawns a CLI process and can outlive its own interval, so the rule
 * is: one run at a time, at most one queued follow-up, and a result from a
 * superseded scope is never applied.
 */
import { describe, expect, it, vi } from "vitest";
import { SingleFlight } from "../src/singleFlight";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

describe("SingleFlight", () => {
  it("ten_refresh_triggers_spawn_one_cli_and_one_follow_up", async () => {
    const pending = deferred();
    const task = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
    const flight = new SingleFlight();

    const calls = Array.from({ length: 10 }, () => flight.run(task));
    await flushMicrotasks();
    expect(task).toHaveBeenCalledTimes(1);

    pending.resolve();
    await Promise.all(calls);
    await flushMicrotasks();
    // The nine triggers that arrived while it ran collapse into one follow-up.
    expect(task).toHaveBeenCalledTimes(2);
    expect(flight.isRunning).toBe(false);
    expect(flight.hasQueuedRerun).toBe(false);
  });

  it("single_flight_unlocks_after_error", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("cli exited with code 1"));
    const flight = new SingleFlight();

    await expect(flight.run(failing)).rejects.toThrow("cli exited");
    expect(flight.isRunning).toBe(false);

    // A later refresh still runs: one failure must not wedge the surface.
    const succeeding = vi.fn().mockResolvedValue(undefined);
    await flight.run(succeeding);
    expect(succeeding).toHaveBeenCalledTimes(1);
  });

  it("key_change_invalidates_in_flight_old_scope_result", async () => {
    const flight = new SingleFlight();
    const generation = flight.current();
    expect(flight.isCurrent(generation)).toBe(true);

    flight.invalidate();

    expect(flight.isCurrent(generation)).toBe(false);
    expect(flight.isCurrent(flight.current())).toBe(true);
  });

  it("multiple_pending_verification_requests_share_one_retry_loop", async () => {
    // The real loop retries an unreachable server forever; this stands in for it.
    const stop = deferred();
    const retryLoop = vi.fn().mockImplementation(() => stop.promise);
    const flight = new SingleFlight();

    void flight.run(retryLoop);
    void flight.run(retryLoop);
    void flight.run(retryLoop);
    await flushMicrotasks();

    expect(retryLoop).toHaveBeenCalledTimes(1);
    expect(flight.hasQueuedRerun).toBe(true);

    stop.resolve();
    await flushMicrotasks();
    // Exactly one follow-up attempt, not one per command invocation.
    expect(retryLoop).toHaveBeenCalledTimes(2);
  });

  it("dispose_ignores_late_results_and_clears_timers", async () => {
    const pending = deferred();
    const task = vi.fn().mockReturnValue(pending.promise);
    const flight = new SingleFlight();
    const generation = flight.current();

    void flight.run(task);
    await flushMicrotasks();
    flight.dispose();

    expect(flight.isCurrent(generation)).toBe(false);
    pending.resolve();
    await flushMicrotasks();
    // Nothing new starts after dispose, including the queued follow-up.
    await flight.run(task);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
