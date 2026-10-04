import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  getOffice,
  officeCommand,
  officeMediaToken,
  officeMessages,
  personalPresenceSummary,
} from '@/lib/wakaclock/office';
vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_WAKACLOCK_API_URL: 'http://office.test' } }));
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
it('uses the room and history endpoints, preserving commands, cursor and local date boundaries', async () => {
  const requests: { method: string; path: string; query: Record<string, string>; body: unknown }[] =
    [];
  server.use(
    http.all('http://office.test/api/v2/*', async ({ request }) => {
      const url = new URL(request.url);
      const body = await request.text();
      requests.push({
        method: request.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        body: body ? JSON.parse(body) : null,
      });
      return HttpResponse.json({ data: { ok: true } });
    })
  );
  expect(await getOffice('room')).toEqual({ ok: true });
  await officeCommand('room', { kind: 'message', id: 'opaque', body: 'Hello' });
  await officeMessages('room', 'signed+/=');
  await officeMessages('room');
  await officeMediaToken('room');
  await personalPresenceSummary({ from: '2026-10-01', to: '2026-10-02', timezone: 'Asia/Bangkok' });
  expect(requests).toEqual([
    { method: 'GET', path: '/api/v2/presence/rooms/room/office', query: {}, body: null },
    {
      method: 'POST',
      path: '/api/v2/presence/rooms/room/office',
      query: {},
      body: { kind: 'message', id: 'opaque', body: 'Hello' },
    },
    {
      method: 'GET',
      path: '/api/v2/presence/rooms/room/messages',
      query: { before: 'signed+/=' },
      body: null,
    },
    { method: 'GET', path: '/api/v2/presence/rooms/room/messages', query: {}, body: null },
    { method: 'POST', path: '/api/v2/presence/rooms/room/media-token', query: {}, body: null },
    {
      method: 'GET',
      path: '/api/v2/presence/history/summary',
      query: { from: '2026-10-01', to: '2026-10-02', timezone: 'Asia/Bangkok' },
      body: null,
    },
  ]);
});
it('propagates a forbidden media request without inventing a token', async () => {
  server.use(
    http.post('http://office.test/api/v2/presence/rooms/room/media-token', () =>
      HttpResponse.json({ error: 'forbidden' }, { status: 403 })
    )
  );
  await expect(officeMediaToken('room')).rejects.toMatchObject({
    status: 403,
    message: 'forbidden',
  });
});

it('approves a normalized device code at the OAuth endpoint with the current session token', async () => {
  const { approveOAuthDevice } = await import('@/lib/wakaclock/oauth');
  const { setCurrentToken } = await import('@/lib/wakaclock/session');
  const received = vi.fn();
  server.use(
    http.post('http://office.test/oauth/device/approve', async ({ request }) => {
      received(
        request.headers.get('authorization'),
        request.headers.get('content-type'),
        await request.text()
      );
      return new HttpResponse(null, { status: 204 });
    })
  );
  setCurrentToken('test-session');
  try {
    await expect(approveOAuthDevice('  abcd efgh  ')).resolves.toBeUndefined();
    expect(received).toHaveBeenCalledWith(
      'Bearer test-session',
      'application/x-www-form-urlencoded',
      'user_code=ABCD-EFGH'
    );
  } finally {
    setCurrentToken(null);
  }
});
