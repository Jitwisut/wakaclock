import { describe, expect, it, vi } from "vitest";
import { CliScheduler } from "../src/cliScheduler";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("CliScheduler", () => {
  it("serializes all CLI work without dropping writes", async () => {
    const scheduler = new CliScheduler();
    const firstGate = deferred<string>();
    const first = vi.fn(() => firstGate.promise);
    const second = vi.fn(async () => "second");

    const firstResult = scheduler.schedule(first);
    const secondResult = scheduler.schedule(second);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    firstGate.resolve("first");

    await expect(firstResult).resolves.toBe("first");
    await expect(secondResult).resolves.toBe("second");
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("coalesces equivalent queued and in-flight reads", async () => {
    const scheduler = new CliScheduler();
    const gate = deferred<number>();
    const task = vi.fn(() => gate.promise);

    const first = scheduler.schedule(task, "broker-status");
    const duplicate = scheduler.schedule(task, "broker-status");

    expect(duplicate).toBe(first);
    expect(task).toHaveBeenCalledTimes(1);
    gate.resolve(7);
    await expect(Promise.all([first, duplicate])).resolves.toEqual([7, 7]);
  });

  it("unlocks and clears a coalesce key after failure", async () => {
    const scheduler = new CliScheduler();
    const failure = new Error("boom");

    await expect(scheduler.schedule(() => Promise.reject(failure), "status")).rejects.toThrow("boom");
    await expect(scheduler.schedule(() => Promise.resolve("recovered"), "status")).resolves.toBe(
      "recovered",
    );
  });
});
