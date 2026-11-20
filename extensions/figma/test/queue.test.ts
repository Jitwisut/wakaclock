import { expect, it } from 'vitest';
import { HeartbeatQueue, newDeliveryId } from '../src/queue';
import { buildHeartbeat } from '../src/protocol';
function fixture() {
  let value: unknown;
  let now = 1000;
  let fail = false;
  const storage = {
    async getAsync() { return structuredClone(value); },
    async setAsync(_key: string, next: unknown) {
      if (fail) throw new Error('disk full');
      value = structuredClone(next);
    },
  };
  return { storage, clock: () => now, advance: (ms: number) => { now += ms; },
    read: () => value as Array<{ payload: unknown; attempts: number; dueAt: number; dead?: number }>,
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
