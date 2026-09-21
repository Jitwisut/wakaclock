"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingleFlight = void 0;
/**
 * One in-flight run per surface, with at most one queued rerun.
 *
 * Every refresh here spawns a `wakaclock` child process, and a refresh can
 * outlive its own interval: with a 15s timer and a 45s CLI timeout, a server
 * that stops answering produced a new process every tick until they piled up
 * (OFF-07). Debouncing does not fix that — the request is longer than any
 * sensible debounce window — so triggers that arrive while a run is in flight
 * collapse into a single follow-up run instead.
 *
 * The generation counter exists for the other half of the problem: a result
 * from the old API key, server or timezone must not be applied after the scope
 * has changed. Callers bump it on such a change and check `isCurrent` before
 * they write anything.
 */
class SingleFlight {
    running = false;
    rerunQueued = false;
    generation = 0;
    disposed = false;
    /**
     * Run `task`, or — if one is already running — mark that exactly one more
     * run is owed once it finishes. Resolves when this call's work is done;
     * callers that only trigger a refresh can ignore the promise.
     */
    async run(task) {
        if (this.disposed) {
            return;
        }
        if (this.running) {
            this.rerunQueued = true;
            return;
        }
        this.running = true;
        try {
            await task();
        }
        finally {
            this.running = false;
        }
        // A failing task must never leave the lock held, so the rerun is driven
        // from outside the try/finally above.
        if (this.rerunQueued && !this.disposed) {
            this.rerunQueued = false;
            await this.run(task);
        }
    }
    /**
     * Invalidate every result that is still in flight. Call when the API key,
     * server URL or timezone changes; the returned value is the new generation.
     */
    invalidate() {
        this.rerunQueued = false;
        this.generation += 1;
        return this.generation;
    }
    current() {
        return this.generation;
    }
    /** Whether a result captured at `generation` may still be applied. */
    isCurrent(generation) {
        return !this.disposed && generation === this.generation;
    }
    get isRunning() {
        return this.running;
    }
    get hasQueuedRerun() {
        return this.rerunQueued;
    }
    /** After this, nothing new starts and late results are ignored. */
    dispose() {
        this.disposed = true;
        this.rerunQueued = false;
        this.generation += 1;
    }
}
exports.SingleFlight = SingleFlight;
//# sourceMappingURL=singleFlight.js.map