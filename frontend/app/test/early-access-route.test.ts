import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ saveSignup: vi.fn(), signupDatabaseUrl: vi.fn() }));
vi.mock('@/lib/early-access/store', () => store);

import { dynamic, POST, runtime } from '@/app/api/early-access/route';

const valid = {
  email: 'Demo@Example.com',
  interest: 'teams',
  locale: 'th',
  source_page: 'early-access',
  consent: true,
  bot_field: '',
};

function post(body: string) {
  return POST(new Request('http://localhost/api/early-access', { body, method: 'POST' }));
}

describe('POST /api/early-access', () => {
  beforeEach(() => {
    store.signupDatabaseUrl.mockReturnValue('postgres://db');
    store.saveSignup.mockResolvedValue(undefined);
  });

  it('runs on Node (pg cannot run on the Edge runtime) and is never cached', () => {
    expect(runtime).toBe('nodejs');
    expect(dynamic).toBe('force-dynamic');
  });

  it('stores a valid signup and acknowledges only after the insert', async () => {
    const response = await post(JSON.stringify(valid));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ accepted: true });
    expect(store.saveSignup).toHaveBeenCalledWith('postgres://db', {
      email: 'demo@example.com',
      interest: 'teams',
      locale: 'th',
      source_page: 'early-access',
    });
  });

  it('stores a utm-tagged source_page unchanged', async () => {
    const response = await post(JSON.stringify({ ...valid, source_page: 'en/join?utm_source=x' }));
    expect(response.status).toBe(200);
    expect(store.saveSignup).toHaveBeenCalledWith(
      'postgres://db',
      expect.objectContaining({ source_page: 'en/join?utm_source=x' })
    );
  });

  it('rejects an oversized body before parsing it', async () => {
    const response = await post(JSON.stringify({ ...valid, bot_field: 'x'.repeat(5000) }));
    expect(response.status).toBe(413);
    expect(store.saveSignup).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON and invalid signups without touching the database', async () => {
    expect((await post('{')).status).toBe(400);
    const invalid = await post(JSON.stringify({ ...valid, email: 'nope' }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'invalid_email' });
    expect(store.saveSignup).not.toHaveBeenCalled();
  });

  it('reports 503 when no database is configured', async () => {
    store.signupDatabaseUrl.mockReturnValue(null);
    const response = await post(JSON.stringify(valid));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'signup_unavailable' });
  });

  it('reports 503 without leaking details when the insert fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store.saveSignup.mockRejectedValue(
      new Error('password authentication failed for demo@example.com')
    );
    const response = await post(JSON.stringify(valid));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'signup_unavailable' });
    expect(log).toHaveBeenCalledWith('early-access: signup could not be stored');
  });
});
