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
export class SingleFlight {
    private running = false;
    private rerunQueued = false;
    private generation = 0;
    private disposed = false;

    /**
     * Run `task`, or — if one is already running — mark that exactly one more
     * run is owed once it finishes. Resolves when this call's work is done;
     * callers that only trigger a refresh can ignore the promise.
     */
    public async run(task: () => Promise<void>): Promise<void> {
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
        } finally {
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
    public invalidate(): number {
        this.rerunQueued = false;
        this.generation += 1;
        return this.generation;
    }

    public current(): number {
        return this.generation;
    }

    /** Whether a result captured at `generation` may still be applied. */
    public isCurrent(generation: number): boolean {
        return !this.disposed && generation === this.generation;
    }

    public get isRunning(): boolean {
        return this.running;
    }

    public get hasQueuedRerun(): boolean {
        return this.rerunQueued;
    }

    /** After this, nothing new starts and late results are ignored. */
    public dispose(): void {
        this.disposed = true;
        this.rerunQueued = false;
        this.generation += 1;
    }
}
