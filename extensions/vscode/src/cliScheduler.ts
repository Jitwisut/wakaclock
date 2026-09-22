/**
 * Coordinator for every CLI process owned by one extension activation.
 *
 * The CLI touches shared SQLite/config state, so overlapping status refreshes,
 * transcript sync and heartbeat delivery create avoidable lock pressure. Every
 * invocation is serialized. Idempotent reads may also provide a coalesce key so
 * equivalent queued or in-flight callers share one process. Writes omit a key and
 * are never dropped.
 */
export class CliScheduler {
  private readonly queue: Array<() => Promise<void>> = [];
  private readonly coalesced = new Map<string, Promise<unknown>>();
  private running = false;

  public schedule<T>(task: () => Promise<T>, coalesceKey?: string): Promise<T> {
    if (coalesceKey) {
      const existing = this.coalesced.get(coalesceKey);
      if (existing) return existing as Promise<T>;
    }

    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const result = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    if (coalesceKey) this.coalesced.set(coalesceKey, result);

    this.queue.push(async () => {
      try {
        resolve(await task());
      } catch (error) {
        reject(error);
      } finally {
        if (coalesceKey && this.coalesced.get(coalesceKey) === result) {
          this.coalesced.delete(coalesceKey);
        }
      }
    });
    this.drain();
    return result;
  }

  private drain(): void {
    if (this.running) return;
    const next = this.queue.shift();
    if (!next) return;
    this.running = true;
    void next().finally(() => {
      this.running = false;
      this.drain();
    });
  }
}
