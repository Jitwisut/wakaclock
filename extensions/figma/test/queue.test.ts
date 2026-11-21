import { expect, it } from 'vitest';
import { HeartbeatQueue, newDeliveryId } from '../src/queue';
import { buildHeartbeat } from '../src/protocol';
function fixture() {
  const values = new Map<string, unknown>();
  let now = 1000;
  let fail = false;
  const storage = {
    async getAsync(key: string) { return structuredClone(values.get(key)); },
    async keysAsync() { return [...values.keys()]; },
    async deleteAsync(key: string) { if (fail) throw new Error('disk full'); values.delete(key); },
    async setAsync(key: string, next: unknown) {
      if (fail) throw new Error('disk full');
      values.set(key, structuredClone(next));
    },
  };
  return { storage, clock: () => now, advance: (ms: number) => { now += ms; },
    read: () => [...values.entries()].filter(([key]) => !/:(ack|retry|started)$/.test(key) && !values.get(`${key}:ack`))
      .map(([key, value]) => ({ ...(value as object), ...(values.get(`${key}:retry`) as object) })) as Array<{ payload: unknown; attempts: number; dueAt: number; dead?: number }>,
    fail: (next: boolean) => { fail = next; } };
}
const payload = (id = 'stable') => ({ ...buildHeartbeat('Doc / Page', true, 1234), heartbeat_id: id });
it('replays original identity and timestamp after lost ACK and restart', async () => {
  const f = fixture();
  const queue = new HeartbeatQueue(f.storage, f.clock);
  await queue.enqueue('a', payload());
  const received: unknown[] = [];
  await queue.flush('a', async (body) => { received.push(body); throw new Error('lost ACK'); });
  f.advance(60_000);
  await new HeartbeatQueue(f.storage, f.clock).flush('a', async (body) => { received.push(body); return { status: 201 }; });
  expect(received).toEqual([payload(), payload()]);
  expect(f.read()).toEqual([]);
});
it('isolates grants and serializes concurrent capture during ACK', async () => {
  const f = fixture();
  const queue = new HeartbeatQueue(f.storage, f.clock);
  await queue.enqueue('old-account', payload('old'));
  await queue.enqueue('new-account', payload('new'));
  const ids: string[] = [];
  await queue.flush('new-account', async (body) => {
    ids.push(body.heartbeat_id);
    await Promise.all([queue.enqueue('new-account', payload('next1')), queue.enqueue('new-account', payload('next2'))]);
    return { status: 200 };
  });
  expect(ids).toEqual(['new']);
  expect(f.read().map((entry) => entry.payload)).toEqual([payload('old'), payload('next1'), payload('next2')]);
});
it('retains unlimited retries with locked backoff and Retry-After', async () => {
  const f = fixture();
  const queue = new HeartbeatQueue(f.storage, f.clock);
  await queue.enqueue('a', payload());
  for (let attempt = 0; attempt < 15; attempt++) {
    await queue.flush('a', async () => ({ status: 503 }));
    expect(f.read()[0].dueAt - f.clock()).toBe(Math.min(3600, 60 * 2 ** attempt) * 1000);
    f.advance(86_400_000);
  }
  await queue.flush('a', async () => ({ status: 429, retryAfter: '9999999' }));
  expect(f.read()[0].dueAt - f.clock()).toBe(86_400_000);
  f.advance(86_400_000);
  await queue.flush('a', async () => ({ status: 400 }));
  expect(f.read()[0].dead).toBe(400);
});
it('fails capture on storage errors and retains records when ACK persistence fails', async () => {
  const f = fixture();
  const queue = new HeartbeatQueue(f.storage, f.clock);
  f.fail(true);
  await expect(queue.enqueue('a', payload())).rejects.toThrow('disk full');
  f.fail(false);
  await queue.enqueue('a', payload());
  await expect(queue.flush('a', async () => { f.fail(true); return { status: 200 }; })).rejects.toThrow();
  expect(f.read()[0].payload).toEqual(payload());
  f.fail(false);
  await queue.flush('a', async () => ({ status: 200 }));
  expect(f.read()).toEqual([]);
});
it('persists the coalesced nonwrite window across restarts', async () => {
  const f = fixture();
  const queue = new HeartbeatQueue(f.storage, f.clock);
  await queue.enqueue('a', payload('first'), 30_000);
  await queue.enqueue('a', payload('latest'), 30_000);
  expect(f.read()).toHaveLength(1);
  f.advance(30_000);
  let body: unknown;
  await new HeartbeatQueue(f.storage, f.clock).flush('a', async (entry) => { body = entry; return { status: 200 }; });
  expect(body).toEqual(payload('latest'));
});
it('creates UUID-shaped identifiers', () => {
  expect(newDeliveryId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
it('gates newly captured events behind the grant Retry-After deadline', async () => {
  const f = fixture();
  const queue = new HeartbeatQueue(f.storage, f.clock);
  await queue.enqueue('a', payload('throttled'));
  await queue.flush('a', async () => ({ status: 429, retryAfter: '120' }));
  await queue.enqueue('a', payload('new'));
  let sent = 0;
  await queue.flush('a', async () => { sent++; return { status: 200 }; });
  expect(sent).toBe(0);
  f.advance(120_000);
  await queue.flush('a', async () => { sent++; return { status: 200 }; });
  expect(sent).toBe(2);
});
it('preserves distinct captures from independent Figma windows', async () => {
  const f = fixture();
  const a = new HeartbeatQueue(f.storage, f.clock);
  const b = new HeartbeatQueue(f.storage, f.clock);
  await Promise.all([a.enqueue('a', payload('window-a'), 30_000), b.enqueue('a', payload('window-b'), 30_000)]);
  await a.enqueue('a', payload('window-a-latest'), 30_000);
  expect(f.read().map((entry) => entry.payload)).toEqual([payload('window-b'), payload('window-a-latest')]);
});
it('a late retry cannot resurrect another window ACK or lose a distinct capture', async () => {
  const f = fixture();
  const a = new HeartbeatQueue(f.storage, f.clock);
  const b = new HeartbeatQueue(f.storage, f.clock);
  await a.enqueue('a', payload('shared'));
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const failing = a.flush('a', async () => { started(); await blocked; return { status: 503 }; });
  await entered;
  await b.flush('a', async () => {
    await b.enqueue('a', payload('distinct'));
    return { status: 200 };
  });
  release();
  await failing;
  expect(f.read().map((entry) => entry.payload)).toEqual([payload('distinct')]);
  f.advance(60_000);
  const ids: string[] = [];
  await new HeartbeatQueue(f.storage, f.clock).flush('a', async (body) => { ids.push(body.heartbeat_id); return { status: 200 }; });
  expect(ids).toEqual(['distinct']);
});
it('ignores retry metadata written after an overlapping ACK deletes the payload', async () => {
  const f = fixture();
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const delayedStorage = { ...f.storage, async setAsync(key: string, value: unknown) {
    if (key.endsWith(':retry')) { started(); await blocked; }
    await f.storage.setAsync(key, value);
  } };
  const a = new HeartbeatQueue(delayedStorage, f.clock);
  const b = new HeartbeatQueue(f.storage, f.clock);
  await a.enqueue('a', payload('race'));
  const failure = a.flush('a', async () => ({ status: 503 }));
  await entered;
  await b.flush('a', async () => ({ status: 200 }));
  release();
  await failure;
  f.advance(120_000);
  let sent = false;
  await a.flush('a', async () => { sent = true; return { status: 200 }; });
  expect(sent).toBe(false);
  expect(f.read()).toEqual([]);
});
it('quarantines legacy records with a scope-specific warning while new tracking continues', async () => {
  const f = fixture();
  const legacy = [{ scope: 'original-account', payload: payload('original-id'), attempts: 3, dueAt: 1000, deferred: false }];
  await f.storage.setAsync('atoaxis-heartbeat-queue-v1', legacy);
  const warnings: string[] = [];
  const queue = new HeartbeatQueue(f.storage, f.clock, (message) => warnings.push(message));
  await queue.enqueue('new-account', payload('new'));
  expect(warnings).toEqual([]);
  const sent: string[] = [];
  await queue.flush('original-account', async (body) => { sent.push(body.heartbeat_id); return { status: 200 }; });
  expect(warnings[0]).toContain('1 legacy Figma activity record(s)');
  await queue.flush('new-account', async (body) => { sent.push(body.heartbeat_id); return { status: 200 }; });
  expect(sent).toEqual(['new']);
  expect(await f.storage.getAsync('atoaxis-heartbeat-queue-v1')).toEqual(legacy);
  expect(await f.storage.keysAsync()).toEqual(['atoaxis-heartbeat-queue-v1']);
});
it('compacts orphan metadata without removing pending events or their retry deadlines', async () => {
  const f = fixture();
  const a = new HeartbeatQueue(f.storage, f.clock);
  await a.enqueue('a', payload('pending'));
  await a.flush('a', async () => ({ status: 503 }));
  await f.storage.setAsync('atoaxis-heartbeat-entry-v2:a:gone:retry', { attempts: 1 });
  await f.storage.setAsync('atoaxis-heartbeat-entry-v2:a:gone:started', true);
  await f.storage.setAsync('atoaxis-heartbeat-entry-v2:a:gone:ack', true);
  const b = new HeartbeatQueue(f.storage, f.clock);
  await Promise.all([b.enqueue('b', payload('other-window')), a.flush('a', async () => ({ status: 200 }))]);
  expect((await f.storage.keysAsync()).some((key) => key.includes(':gone:'))).toBe(false);
  expect(f.read().map((entry) => entry.payload)).toEqual([payload('pending'), payload('other-window')]);
  expect(f.read()[0].dueAt).toBe(61_000);
  f.advance(60_000);
  await a.flush('a', async () => ({ status: 200 }));
  await b.flush('b', async () => ({ status: 200 }));
  expect(await f.storage.keysAsync()).toEqual([]);
});
