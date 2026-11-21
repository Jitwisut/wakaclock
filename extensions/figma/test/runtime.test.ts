import { afterEach, expect, it, vi } from 'vitest';
import { build } from 'esbuild';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

async function start(connected: boolean, response: { status: number; headersObject: Record<string, string> },
  verificationUri = 'https://account.example.test/approve?code=old&x=1#details') {
  vi.useFakeTimers();
  vi.stubGlobal('__ATOAXIS_API_URL__', 'https://api.example.test');
  vi.stubGlobal('__html__', '<html></html>');

  const values = new Map<string, unknown>();
  if (connected) values.set('atoaxis-oauth-credential-v1', {
    queueScope: 'account', accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 100_000,
  });
  const ui = { postMessage: vi.fn(), onmessage: undefined as undefined | ((message: { type: string }) => void) };
  const openExternal = vi.fn();
  const fetchMock = vi.fn(async () => ({ ...response, ok: response.status >= 200 && response.status < 300,
    json: async () => ({ verification_uri: verificationUri,
      user_code: 'A+B &C', expires_in: 60, interval: 5, device_code: 'device' }) }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('figma', {
    clientStorage: {
      getAsync: async (key: string) => structuredClone(values.get(key)),
      setAsync: async (key: string, value: unknown) => { values.set(key, structuredClone(value)); },
      deleteAsync: async (key: string) => { values.delete(key); },
      keysAsync: async () => [...values.keys()],
    },
    showUI: vi.fn(), ui, on: vi.fn(), loadAllPagesAsync: async () => undefined,
    root: { name: 'Document' }, currentPage: { name: 'Page' }, notify: vi.fn(), closePlugin: vi.fn(), openExternal,
  });
  const compiled = await build({ entryPoints: ['src/code.ts'], bundle: true, format: 'iife', write: false,
    define: { __ATOAXIS_API_URL__: JSON.stringify('https://api.example.test') } });
  // Shadow DOM constructors only inside the compiled plugin, not Vitest's own loader.
  new Function('URL', 'URLSearchParams', compiled.outputFiles[0].text)(undefined, undefined);
  await vi.advanceTimersByTimeAsync(1_000);
  return { values, fetchMock, ui, openExternal };
}

it('drains a persisted heartbeat with actual Figma headersObject and no DOM APIs', async () => {
  const { values, fetchMock } = await start(true, { status: 201, headersObject: {} });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const calls = fetchMock.mock.calls as unknown as Array<[string, { body: string }]>;
  expect(calls[0][0]).toBe('https://api.example.test/api/v1/heartbeats');
  const sent = JSON.parse(calls[0][1].body);
  expect(sent.heartbeat_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(sent.time).toBeGreaterThan(0);
  expect([...values.keys()]).toEqual(['atoaxis-oauth-credential-v1']);
});

it('honors mixed-case Figma Retry-After headers at the entry point', async () => {
  const { values, fetchMock } = await start(true, { status: 429, headersObject: { 'rEtRy-AfTeR': '120' } });
  const retry = [...values.entries()].find(([key]) => key.endsWith(':retry'))?.[1] as { dueAt: number };
  expect(retry.dueAt - Date.now()).toBeGreaterThanOrEqual(119_000);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('encodes device form and approval link without URL or URLSearchParams globals', async () => {
  const { ui, openExternal, fetchMock } = await start(false, { status: 200, headersObject: {} });
  ui.onmessage?.({ type: 'connect' });
  await vi.advanceTimersByTimeAsync(0);
  expect(openExternal).toHaveBeenCalledWith('https://account.example.test/approve?x=1&code=A%2BB%20%26C#details');
  const calls = fetchMock.mock.calls as unknown as Array<[string, { body: string }]>;
  expect(calls[0][1].body).toBe('client_id=atoaxis_figma&scope=write_logged_time');
  ui.onmessage?.({ type: 'disconnect' });
});

it.each(['javascript:alert(1)', 'https://trusted.example@evil.example/approve', 'https://trusted.example\\@evil.example'])('rejects unsafe approval URI %s', async (uri) => {
  const { ui, openExternal } = await start(false, { status: 200, headersObject: {} }, uri);
  ui.onmessage?.({ type: 'connect' });
  await vi.advanceTimersByTimeAsync(0);
  expect(openExternal).not.toHaveBeenCalled();
  expect(ui.postMessage).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid device approval URL' }));
});
