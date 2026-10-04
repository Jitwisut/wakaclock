import { Client } from 'pg';

import type { EarlyAccessSignup } from './signup';

/**
 * Same DDL as `backend/api/migrations/postgres/004_early_access.sql`, so a database
 * used by this route and one migrated by the Rust API hold identical rows and the
 * list can later move to the API database without a transform.
 */
const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS early_access_signups (
    email TEXT PRIMARY KEY CHECK (length(email) BETWEEN 3 AND 254),
    interest TEXT NOT NULL CHECK (interest IN ('solo', 'teams')),
    locale TEXT NOT NULL CHECK (locale IN ('en', 'th')),
    source_page TEXT NOT NULL CHECK (length(source_page) <= 128),
    consent_version TEXT NOT NULL DEFAULT 'early-access-v1',
    consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

const INSERT_SIGNUP =
  'INSERT INTO early_access_signups (email, interest, locale, source_page) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING';

/**
 * The connection string for the signup list. An explicit name first; otherwise the
 * variable the Vercel Postgres/Neon integration injects. The template's DATABASE_URL is
 * deliberately not read (see .context/environment.md).
 */
export function signupDatabaseUrl(
  environment: Record<string, string | undefined> = process.env
): null | string {
  const value =
    environment.EARLY_ACCESS_DATABASE_URL?.trim() || environment.POSTGRES_URL?.trim() || '';
  return value === '' ? null : value;
}

/**
 * Durably store one signup. One short-lived client per request: a module-level pool can
 * hold sockets open on a frozen serverless instance, and signup volume is tiny. TLS is
 * whatever the connection string asks for (`sslmode=require` on hosted Postgres).
 */
export async function saveSignup(connectionString: string, signup: EarlyAccessSignup) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query(CREATE_TABLE);
    await client.query(INSERT_SIGNUP, [
      signup.email,
      signup.interest,
      signup.locale,
      signup.source_page,
    ]);
  } finally {
    await client.end().catch(() => undefined);
  }
}
