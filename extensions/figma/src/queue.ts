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
  keysAsync(): Promise<string[]>;
  deleteAsync(key: string): Promise<void>;
}
export interface DeliveryResult { status: number; retryAfter?: string | null }
const PREFIX = 'atoaxis-heartbeat-entry-v2:';
const keyFor = (scope: string, id: string) => `${PREFIX}${encodeURIComponent(scope)}:${id}`;

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
  constructor(private storage: Storage, private now = Date.now,
    private onWarning: (message: string) => void = () => undefined) {}

  private deferred = new Map<string, string>();

  private transaction<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.serial.then(fn);
    this.serial = task.catch(() => undefined);
    return task;
  }

  private async warnLegacy(scope: string): Promise<void> {
    const legacy = await this.storage.getAsync('atoaxis-heartbeat-queue-v1');
    if (Array.isArray(legacy)) {
      const count = legacy.filter((entry: Entry) => entry?.scope === scope).length;
      if (count) this.onWarning(`${count} legacy Figma activity record(s) for this connection are quarantined and preserved for recovery. New activity continues tracking.`);
    } else if (legacy != null) {
      this.onWarning('Unrecognized legacy Figma queue is quarantined and preserved for recovery. New activity continues tracking.');
    }
  }

  async settled(): Promise<void> { await this.serial; }

  async enqueue(scope: string, payload: QueuedHeartbeat, dueAt = this.now()): Promise<void> {
    await this.transaction(async () => {
      await this.warnLegacy(scope);
      const key = keyFor(scope, payload.heartbeat_id);
      // Each producer owns distinct immutable payload keys. No shared-array read/modify/write.
      if (await this.storage.getAsync(`${key}:ack`)) return;
      if (await this.storage.getAsync(key)) throw new Error('Heartbeat identity already persisted');
      const deferred = dueAt > this.now();
      await this.storage.setAsync(key, { scope, payload, attempts: 0, dueAt, deferred });
      if (deferred) {
        const previous = this.deferred.get(scope);
        this.deferred.set(scope, key);
        if (previous) {
          const old = await this.storage.getAsync(previous) as Entry | undefined;
          if (old && old.dueAt > this.now() && !await this.storage.getAsync(`${previous}:started`)) {
            // Supersede only this instance's unsent deferred event; never edit its payload.
            await this.storage.deleteAsync(previous);
          }
        }
      }
    });
  }

  // Metadata is disposable only after its immutable payload is absent. A late retry
  // may recreate metadata, but never a payload; the next pass reclaims that orphan.
  private async compact(): Promise<void> {
    for (const key of await this.storage.keysAsync()) {
      if (!key.startsWith(PREFIX)) continue;
      const match = key.match(/:(ack|retry|started)$/);
      if (!match) continue;
      const payloadKey = key.slice(0, -match[0].length);
      // Compatibility with ACK tombstones produced by the first v2 implementation.
      if (match[1] === 'ack' && await this.storage.getAsync(key)) {
        await this.storage.deleteAsync(payloadKey);
      }
      if (!await this.storage.getAsync(payloadKey)) await this.storage.deleteAsync(key);
    }
  }

  private async entries(): Promise<Entry[]> {
    const entries: Entry[] = [];
    for (const key of await this.storage.keysAsync()) {
      if (!key.startsWith(PREFIX) || /:(ack|retry|started)$/.test(key)) continue;
      if (await this.storage.getAsync(`${key}:ack`)) continue;
      const entry = await this.storage.getAsync(key) as Entry | undefined;
      if (!entry) continue;
      const retry = await this.storage.getAsync(`${key}:retry`) as Partial<Entry> | undefined;
      entries.push({ ...entry, ...retry });
    }
    return entries;
  }

  async flush(scope: string, deliver: (payload: QueuedHeartbeat) => Promise<DeliveryResult>): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      // Snapshot only the due records. Newly captured events cannot starve the caller.
      const due = await this.transaction(async () => {
        await this.warnLegacy(scope);
        await this.compact();
        const entries = await this.entries();
        // A server Retry-After/backoff also gates newer records in this grant.
        if (entries.some((entry) => entry.scope === scope && entry.dead === undefined &&
          entry.attempts > 0 && entry.dueAt > this.now())) return [];
        return entries.filter((entry) => entry.scope === scope &&
          entry.dead === undefined && entry.dueAt <= this.now());
      });
      for (const entry of due) {
        const key = keyFor(scope, entry.payload.heartbeat_id);
        await this.storage.setAsync(`${key}:started`, true);
        if (!await this.storage.getAsync(key) || await this.storage.getAsync(`${key}:ack`)) continue;
        let result: DeliveryResult;
        try { result = await deliver(entry.payload); }
        catch { result = { status: 0 }; }
        await this.transaction(async () => {
          if (result.status >= 200 && result.status < 300) {
            // Delete the immutable payload first. Concurrent retry writes contain only
            // metadata and cannot resurrect it; no permanent tombstone is necessary.
            await this.storage.deleteAsync(key);
            await this.storage.deleteAsync(`${key}:retry`);
            await this.storage.deleteAsync(`${key}:started`);
          } else {
            if (!await this.storage.getAsync(key) || await this.storage.getAsync(`${key}:ack`)) return;
            const retryable = result.status === 0 || result.status === 401 ||
              result.status === 408 || result.status === 425 || result.status === 429 || result.status >= 500;
            const attempts = entry.attempts + 1;
            const delay = Math.min(3600, 60 * 2 ** Math.min(attempts - 1, 6)) * 1000;
            const header = result.retryAfter?.trim();
            const seconds = header && /^\d+(\.\d+)?$/.test(header) ? Number(header) * 1000 : NaN;
            const dateDelay = header ? Date.parse(header) - this.now() : NaN;
            const retryAfter = Number.isFinite(seconds) ? seconds : Number.isFinite(dateDelay) ? dateDelay : 0;
            await this.storage.setAsync(`${key}:retry`, retryable ? {
              attempts, dueAt: this.now() + Math.max(delay, Math.min(86_400_000, Math.max(0, retryAfter))),
              deferred: false,
            } : { dead: result.status });
          }
        });
        // Authorization and server-wide failures should not hammer every queued record.
        if (result.status === 0 || result.status === 401 || result.status === 429 || result.status >= 500) break;
      }
    } finally { this.flushing = false; }
  }
}
