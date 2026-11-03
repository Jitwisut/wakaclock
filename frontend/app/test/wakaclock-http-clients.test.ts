import { AxiosError } from 'axios';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

import { WakaclockError, wakaclockClient } from '@/lib/wakaclock/client';
import { wakaclockV2Client } from '@/lib/wakaclock/client-v2';
import { setCurrentToken, setUnauthorizedHandler } from '@/lib/wakaclock/session';

vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_WAKACLOCK_API_URL: 'http://client.test' } }));
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  setCurrentToken(null);
  setUnauthorizedHandler(null);
});
afterAll(() => server.close());

it.each([wakaclockClient, wakaclockV2Client])(
  'sends the current account bearer token and removes it after logout',
  async (client) => {
    const seen: (string | null)[] = [];
    server.use(
      http.get('http://client.test/api/:version/me', ({ request }) => {
        seen.push(request.headers.get('authorization'));
        return HttpResponse.json({ data: {} });
      })
    );
    setCurrentToken('owner-a');
    await client.get('/me');
    setCurrentToken('owner-b');
    await client.get('/me');
    setCurrentToken(null);
    await client.get('/me');
    expect(seen).toEqual(['Bearer owner-a', 'Bearer owner-b', null]);
  }
);

it.each([wakaclockClient, wakaclockV2Client])(
  'surfaces HTTP errors and ends rejected sessions',
  async (client) => {
    const logout = vi.fn();
    setCurrentToken('active-session');
    setUnauthorizedHandler(logout);
    server.use(
      http.get('http://client.test/api/:version/me', () =>
        HttpResponse.json({ error: { message: 'expired' } }, { status: 401 })
      )
    );
    await expect(client.get('/me')).rejects.toMatchObject({ status: 401, message: 'expired' });
    expect(logout).toHaveBeenCalledOnce();
    server.use(
      http.get('http://client.test/api/:version/me', () =>
        HttpResponse.json({ error: 'missing' }, { status: 404 })
      )
    );
    await expect(client.get('/me')).rejects.toMatchObject({
      status: 404,
      message: 'missing',
      isNotFound: true,
    });
    expect(new WakaclockError('forbidden', 403).isNotFound).toBe(false);
  }
);

it('does not clear an existing session when an authentication attempt has wrong credentials', async () => {
  const logout = vi.fn();
  setUnauthorizedHandler(logout);
  server.use(
    http.post('http://client.test/api/v1/auth/login', () =>
      HttpResponse.json({ error: 'wrong password' }, { status: 401 })
    )
  );
  await expect(wakaclockClient.post('/auth/login', {})).rejects.toMatchObject({ status: 401 });
  expect(logout).not.toHaveBeenCalled();
});

it.each([wakaclockClient, wakaclockV2Client])(
  'keeps transport failures distinct from HTTP status codes',
  async (client) => {
    for (const [code, expected] of [
      ['ECONNABORTED', 'Request timed out — is the backend running?'],
      ['ERR_NETWORK', 'Network Error'],
    ]) {
      await expect(
        client.get('/me', {
          adapter: async () => {
            throw new AxiosError('Network Error', code);
          },
        })
      ).rejects.toMatchObject({ status: null, message: expected });
    }
    server.use(
      http.get('http://client.test/api/:version/me', () => HttpResponse.json({}, { status: 503 }))
    );
    await expect(client.get('/me')).rejects.toMatchObject({
      status: 503,
      message: 'Request failed with status code 503',
    });
  }
);

it.each([wakaclockClient, wakaclockV2Client])(
  'isolates concurrent responses across refresh, logout and A-B-A switches',
  async (client) => {
    const logout = vi.fn();
    setUnauthorizedHandler(logout);
    for (const transitions of [['B'], ['A-refreshed'], ['B', 'A'], [null, 'A']]) {
      setCurrentToken('A');
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      const adapter = async (config: import('axios').InternalAxiosRequestConfig) => {
        expect(config.headers.Authorization).toBe('Bearer A');
        await pending;
        const response = { config, status: 200, statusText: 'OK', headers: {}, data: 'private' };
        if (config.url === '/late-401') {
          throw new AxiosError('expired', 'ERR_BAD_REQUEST', config, undefined, {
            ...response,
            status: 401,
          });
        }
        return response;
      };
      const rejected = expect(client.get('/late-401', { adapter })).rejects.toMatchObject({
        status: 401,
      });
      const stale = expect(client.get('/late-success', { adapter })).rejects.toMatchObject({
        code: 'ERR_CANCELED',
      });
      for (const token of transitions) setCurrentToken(token);
      release();
      await Promise.all([rejected, stale]);
      expect(logout).not.toHaveBeenCalled();
    }
  }
);
