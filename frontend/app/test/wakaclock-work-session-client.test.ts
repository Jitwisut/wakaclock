import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

import {
  getEffectiveness,
  getSessionEvidence,
  getWorkSession,
  getWorkSessions,
  setSessionOutcome,
} from '@/lib/wakaclock/work-sessions';

import { receiptFixture } from './fixtures/work-session';

vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_WAKACLOCK_API_URL: 'http://receipt.test' } }));
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const base = 'http://receipt.test/api/v2';

it('serializes list filters and cursor without turning missing filters into strings', async () => {
  const seen: URL[] = [];
  server.use(
    http.get(`${base}/me/work-sessions`, ({ request }) => {
      seen.push(new URL(request.url));
      return HttpResponse.json({ data: { items: [], next_cursor: null, has_more: false } });
    })
  );
  const filters = { start: '2026-10-01', end: '2026-10-02', timezone: 'Asia/Bangkok' };
  expect(await getWorkSessions(filters)).toEqual({ items: [], next_cursor: null, has_more: false });
  await getWorkSessions({ ...filters, agent: 'claude-code', project_id: 'a/b' }, 'signed+/=');
  expect(Object.fromEntries(seen[0].searchParams)).toEqual({ ...filters, limit: '25' });
  expect(Object.fromEntries(seen[1].searchParams)).toEqual({
    ...filters,
    agent: 'claude-code',
    project_id: 'a/b',
    cursor: 'signed+/=',
    limit: '25',
  });
});

it('unwraps detail and paginated evidence, preserves nulls, and encodes opaque references', async () => {
  const id = 'opaque/reference';
  const seen: string[] = [];
  server.use(
    http.get(`${base}/me/work-sessions/*`, ({ request }) => {
      const url = new URL(request.url);
      seen.push(url.pathname);
      if (url.pathname.endsWith('/evidence')) {
        expect(url.searchParams.get('limit')).toBe('25');
        expect(url.searchParams.get('cursor')).toBe('next+/=');
        return HttpResponse.json({ data: { operations: [], has_more: false, next_cursor: null } });
      }
      return HttpResponse.json({ data: receiptFixture });
    })
  );
  expect(await getWorkSession(id)).toEqual(receiptFixture);
  expect(await getSessionEvidence(id, 'next+/=')).toMatchObject({ operations: [] });
  expect(seen).toEqual([
    '/api/v2/me/work-sessions/opaque%2Freference',
    '/api/v2/me/work-sessions/opaque%2Freference/evidence',
  ]);
});

it('uses PUT for each outcome and DELETE for withdrawal, and surfaces rejected writes', async () => {
  const seen: unknown[] = [];
  server.use(
    http.put(`${base}/me/work-sessions/session/outcome`, async ({ request }) => {
      seen.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete(`${base}/me/work-sessions/session/outcome`, () => {
      seen.push('DELETE');
      return new HttpResponse(null, { status: 204 });
    })
  );
  for (const outcome of ['completed', 'needs_work', 'abandoned'] as const)
    await setSessionOutcome('session', outcome);
  await setSessionOutcome('session', null);
  expect(seen).toEqual([
    { outcome: 'completed' },
    { outcome: 'needs_work' },
    { outcome: 'abandoned' },
    'DELETE',
  ]);
  server.use(
    http.put(`${base}/me/work-sessions/session/outcome`, () =>
      HttpResponse.json({ error: { message: 'scope required' } }, { status: 403 })
    )
  );
  await expect(setSessionOutcome('session', 'completed')).rejects.toMatchObject({
    message: 'scope required',
    status: 403,
  });
});

it('preserves effectiveness timezone compatibility and rejects unavailable reads', async () => {
  const zones: (string | null)[] = [];
  server.use(
    http.get(`${base}/me/ai/effectiveness`, ({ request }) => {
      zones.push(new URL(request.url).searchParams.get('timezone'));
      return HttpResponse.json({ data: { stats: {}, metrics_v2: { ai_line_share: null } } });
    })
  );
  await getEffectiveness('2026-10-01', '2026-10-01');
  await getEffectiveness('2026-10-01', '2026-10-01', 'Asia/Bangkok');
  expect(zones).toEqual(['UTC', 'Asia/Bangkok']);
  server.use(
    http.get(`${base}/me/work-sessions/missing`, () =>
      HttpResponse.json({ error: 'not found' }, { status: 404 })
    )
  );
  await expect(getWorkSession('missing')).rejects.toMatchObject({
    status: 404,
    message: 'not found',
  });
});
