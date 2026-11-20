import type { FigmaHeartbeat } from './protocol';

export type QueuedHeartbeat = FigmaHeartbeat & { heartbeat_id: string };
interface Entry {
  scope: string;
  payload: QueuedHeartbeat;
  attempts: number;
  dueAt: number;
  deferred: boolean;
  dead?: number;
}
interface Storage {
  getAsync(key: string): Promise<unknown>;
  setAsync(key: string, value: unknown): Promise<void>;
}
export interface DeliveryResult { status: number; retryAfter?: string | null }
const KEY = 'atoaxis-heartbeat-queue-v1';

// Figma's sandbox does not provide Web Crypto. These IDs are delivery identities,
// never credentials. Persist them once and never regenerate them during replay.
export function newDeliveryId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 3) | 8).toString(16);
  });
}

export class HeartbeatQueue {
  private serial: Promise<unknown> = Promise.resolve();
  private flushing = false;
  constructor(private storage: Storage, private now = Date.now) {}

  private transaction<T>(fn: (entries: Entry[]) => Promise<T>): Promise<T> {
    const task = this.serial.then(async () => {
      const stored = await this.storage.getAsync(KEY);
      if (stored !== undefined && stored !== null && !Array.isArray(stored)) {
        throw new Error('Stored heartbeat queue is invalid; preserved for recovery');
      }
      return fn((stored ?? []) as Entry[]);
    });
    this.serial = task.catch(() => undefined);
    return task;
  }

  async settled(): Promise<void> { await this.serial; }

  async enqueue(scope: string, payload: QueuedHeartbeat, dueAt = this.now()): Promise<void> {
    await this.transaction(async (entries) => {
      const deferred = dueAt > this.now();
      // Preserve the existing non-write coalescing window, only before delivery.
      const pending = deferred ? entries.findIndex((entry) => entry.scope === scope &&
        entry.deferred && entry.attempts === 0 && entry.dueAt > this.now()) : -1;
      const entry = { scope, payload, attempts: 0, dueAt, deferred };
      if (pending >= 0) entries[pending] = entry;
      else entries.push(entry);
      await this.storage.setAsync(KEY, entries);
    });
  }

  async flush(scope: string, deliver: (payload: QueuedHeartbeat) => Promise<DeliveryResult>): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      // Snapshot only the due records. Newly captured events cannot starve the caller.
      const due = await this.transaction(async (entries) => {
        // A server Retry-After/backoff also gates newer records in this grant.
        if (entries.some((entry) => entry.scope === scope && entry.dead === undefined &&
          entry.attempts > 0 && entry.dueAt > this.now())) return [];
        return entries.filter((entry) => entry.scope === scope &&
          entry.dead === undefined && entry.dueAt <= this.now());
      });
      for (const entry of due) {
        let result: DeliveryResult;
        try { result = await deliver(entry.payload); }
        catch { result = { status: 0 }; }
        await this.transaction(async (entries) => {
          const index = entries.findIndex((item) => item.scope === scope &&
            item.payload.heartbeat_id === entry.payload.heartbeat_id);
          if (index < 0) return;
          if (result.status >= 200 && result.status < 300) entries.splice(index, 1);
          else {
            const item = entries[index];
            const retryable = result.status === 0 || result.status === 401 ||
              result.status === 408 || result.status === 425 || result.status === 429 || result.status >= 500;
            if (!retryable) item.dead = result.status;
            else {
              item.attempts += 1;
              const delay = Math.min(3600, 60 * 2 ** Math.min(item.attempts - 1, 6)) * 1000;
              const header = result.retryAfter?.trim();
              const seconds = header && /^\d+(\.\d+)?$/.test(header) ? Number(header) * 1000 : NaN;
              const dateDelay = header ? Date.parse(header) - this.now() : NaN;
              const retryAfter = Number.isFinite(seconds) ? seconds : Number.isFinite(dateDelay) ? dateDelay : 0;
              item.dueAt = this.now() + Math.max(delay, Math.min(86_400_000, Math.max(0, retryAfter)));
              item.deferred = false;
            }
          }
          await this.storage.setAsync(KEY, entries);
        });
        // Authorization and server-wide failures should not hammer every queued record.
        if (result.status === 0 || result.status === 401 || result.status === 429 || result.status >= 500) break;
      }
    } finally { this.flushing = false; }
  }
}
