import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The route reads `process.env.INDEXNOW_KEY` inside the handler, so each case just
 * stubs the value and calls `GET()` — no module reset needed.
 */
describe('indexnow key route', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves the configured key as plain text', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
    const { GET } = await import('@/app/indexnow-key.txt/route');

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    await expect(response.text()).resolves.toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
  });

  it('trims surrounding whitespace from the configured key', async () => {
    vi.stubEnv('INDEXNOW_KEY', '  spaced-key  ');
    const { GET } = await import('@/app/indexnow-key.txt/route');

    await expect(GET().text()).resolves.toBe('spaced-key');
  });

  it('returns 404 when no key is configured', async () => {
    vi.stubEnv('INDEXNOW_KEY', '');
    const { GET } = await import('@/app/indexnow-key.txt/route');

    expect(GET().status).toBe(404);
  });
});
