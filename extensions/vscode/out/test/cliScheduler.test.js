"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const cliScheduler_1 = require("../src/cliScheduler");
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}
(0, vitest_1.describe)("CliScheduler", () => {
    (0, vitest_1.it)("serializes all CLI work without dropping writes", async () => {
        const scheduler = new cliScheduler_1.CliScheduler();
        const firstGate = deferred();
        const first = vitest_1.vi.fn(() => firstGate.promise);
        const second = vitest_1.vi.fn(async () => "second");
        const firstResult = scheduler.schedule(first);
        const secondResult = scheduler.schedule(second);
        (0, vitest_1.expect)(first).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(second).not.toHaveBeenCalled();
        firstGate.resolve("first");
        await (0, vitest_1.expect)(firstResult).resolves.toBe("first");
        await (0, vitest_1.expect)(secondResult).resolves.toBe("second");
        (0, vitest_1.expect)(second).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("coalesces equivalent queued and in-flight reads", async () => {
        const scheduler = new cliScheduler_1.CliScheduler();
        const gate = deferred();
        const task = vitest_1.vi.fn(() => gate.promise);
        const first = scheduler.schedule(task, "broker-status");
        const duplicate = scheduler.schedule(task, "broker-status");
        (0, vitest_1.expect)(duplicate).toBe(first);
        (0, vitest_1.expect)(task).toHaveBeenCalledTimes(1);
        gate.resolve(7);
        await (0, vitest_1.expect)(Promise.all([first, duplicate])).resolves.toEqual([7, 7]);
    });
    (0, vitest_1.it)("unlocks and clears a coalesce key after failure", async () => {
        const scheduler = new cliScheduler_1.CliScheduler();
        const failure = new Error("boom");
        await (0, vitest_1.expect)(scheduler.schedule(() => Promise.reject(failure), "status")).rejects.toThrow("boom");
        await (0, vitest_1.expect)(scheduler.schedule(() => Promise.resolve("recovered"), "status")).resolves.toBe("recovered");
    });
});
//# sourceMappingURL=cliScheduler.test.js.map