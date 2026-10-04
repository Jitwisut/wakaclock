"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CliScheduler = void 0;
/**
 * Coordinator for every CLI process owned by one extension activation.
 *
 * The CLI touches shared SQLite/config state, so overlapping status refreshes,
 * transcript sync and heartbeat delivery create avoidable lock pressure. Every
 * invocation is serialized. Idempotent reads may also provide a coalesce key so
 * equivalent queued or in-flight callers share one process. Writes omit a key and
 * are never dropped.
 */
class CliScheduler {
    queue = [];
    coalesced = new Map();
    running = false;
    schedule(task, coalesceKey) {
        if (coalesceKey) {
            const existing = this.coalesced.get(coalesceKey);
            if (existing)
                return existing;
        }
        let resolve;
        let reject;
        const result = new Promise((resolvePromise, rejectPromise) => {
            resolve = resolvePromise;
            reject = rejectPromise;
        });
        if (coalesceKey)
            this.coalesced.set(coalesceKey, result);
        this.queue.push(async () => {
            try {
                resolve(await task());
            }
            catch (error) {
                reject(error);
            }
            finally {
                if (coalesceKey && this.coalesced.get(coalesceKey) === result) {
                    this.coalesced.delete(coalesceKey);
                }
            }
        });
        this.drain();
        return result;
    }
    drain() {
        if (this.running)
            return;
        const next = this.queue.shift();
        if (!next)
            return;
        this.running = true;
        void next().finally(() => {
            this.running = false;
            this.drain();
        });
    }
}
exports.CliScheduler = CliScheduler;
//# sourceMappingURL=cliScheduler.js.map