import { validateSignup } from '@/lib/early-access/signup';
import { saveSignup, signupDatabaseUrl } from '@/lib/early-access/store';

/**
 * POST /api/early-access — the public Early Access form posts here, same origin, so the
 * list works on the marketing host before the Rust API is deployed. Contract matches
 * the API's `/api/v1/early-access`: `{ accepted: true }` only after a durable insert,
 * the same reply for new and existing addresses (no enumeration), `{ error }` otherwise.
 *
 * Unlike the API there is no per-IP rate limit (serverless memory is not shared); the
 * honeypot field and the body cap are the only abuse controls here.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 4096;

function reply(status: number, body: Record<string, unknown>) {
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status });
}

export async function POST(request: Request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return reply(413, { error: 'invalid_signup' });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return reply(400, { error: 'invalid_signup' });
  }

  const result = validateSignup(payload);
  if (!result.ok) return reply(400, { error: result.code });

  const connectionString = signupDatabaseUrl();
  if (!connectionString) return reply(503, { error: 'signup_unavailable' });

  try {
    await saveSignup(connectionString, result.signup);
  } catch {
    // Never log the address or the connection string.
    console.error('early-access: signup could not be stored');
    return reply(503, { error: 'signup_unavailable' });
  }
  return reply(200, { accepted: true });
}
