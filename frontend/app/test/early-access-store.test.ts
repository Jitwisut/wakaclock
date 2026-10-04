import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  connect: vi.fn(),
  end: vi.fn(),
  options: undefined as unknown,
  query: vi.fn(),
}));

vi.mock('pg', () => ({
  Client: class {
    constructor(options: unknown) {
      client.options = options;
    }
    connect = client.connect;
    end = client.end;
    query = client.query;
  },
}));

import { saveSignup, signupDatabaseUrl } from '@/lib/early-access/store';

const signup = {
  email: 'demo@example.com',
  interest: 'solo',
  locale: 'en',
  source_page: 'early-access',
} as const;

describe('signupDatabaseUrl', () => {
  it('prefers the explicit variable, then the Vercel Postgres one', () => {
    expect(
      signupDatabaseUrl({
        EARLY_ACCESS_DATABASE_URL: ' postgres://a ',
        POSTGRES_URL: 'postgres://b',
      })
    ).toBe('postgres://a');
    expect(signupDatabaseUrl({ POSTGRES_URL: 'postgres://b' })).toBe('postgres://b');
  });

  it('returns null when neither is set, and never reads DATABASE_URL', () => {
    expect(
      signupDatabaseUrl({ EARLY_ACCESS_DATABASE_URL: '  ', DATABASE_URL: 'postgres://c' })
    ).toBeNull();
  });

  it('reads process.env by default', () => {
    vi.stubEnv('EARLY_ACCESS_DATABASE_URL', 'postgres://from-env');
    expect(signupDatabaseUrl()).toBe('postgres://from-env');
    vi.unstubAllEnvs();
  });
});

describe('saveSignup', () => {
  beforeEach(() => {
    client.connect.mockResolvedValue(undefined);
    client.query.mockResolvedValue({ rowCount: 1 });
    client.end.mockResolvedValue(undefined);
  });

  it('creates the table if needed, inserts idempotently and closes the client', async () => {
    await saveSignup('postgres://db', signup);
    expect(client.options).toEqual({
      connectionString: 'postgres://db',
      connectionTimeoutMillis: 5000,
    });
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('CREATE TABLE IF NOT EXISTS early_access_signups')
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('ON CONFLICT (email) DO NOTHING'),
      ['demo@example.com', 'solo', 'en', 'early-access']
    );
    expect(client.end).toHaveBeenCalledOnce();
  });

  it('still closes the client when a query fails, and ignores a failing close', async () => {
    client.query.mockRejectedValueOnce(new Error('down'));
    client.end.mockRejectedValueOnce(new Error('already closed'));
    await expect(saveSignup('postgres://db', signup)).rejects.toThrow('down');
    expect(client.end).toHaveBeenCalledOnce();
  });
});
