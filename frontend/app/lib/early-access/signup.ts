/**
 * Early Access signup validation, ported 1:1 from the Rust API
 * (`backend/api/src/handlers/v1/early_access.rs`) so both write paths accept and
 * normalise exactly the same rows into the same `early_access_signups` table.
 */

export type EarlyAccessSignup = {
  email: string;
  interest: 'solo' | 'teams';
  locale: 'en' | 'th';
  source_page: string;
};

export type SignupResult =
  | { code: 'invalid_email' | 'invalid_signup'; ok: false }
  | { ok: true; signup: EarlyAccessSignup };

const LOCAL_PART_SYMBOLS = ".!#$%&'*+-/=?^_`{|}~";

function isAsciiAlphanumeric(char: string): boolean {
  return /^[\da-z]$/i.test(char);
}

/** Lower-cased, trimmed address, or null when it is not a plausible mailbox. */
export function normalizedEmail(raw: string): null | string {
  const trimmed = raw.trim();
  // Reject non-ASCII before lower-casing, as Rust's to_ascii_lowercase does: JS
  // toLowerCase() would fold e.g. the Kelvin sign into an ASCII "k" and accept it.
  if (!/^[\u0021-\u007E]*$/.test(trimmed)) return null;
  const email = trimmed.toLowerCase();
  if (email.length > 254) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts as [string, string];
  if (
    local.length === 0 ||
    local.length > 64 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    ![...local].every((char) => isAsciiAlphanumeric(char) || LOCAL_PART_SYMBOLS.includes(char)) ||
    !domain.includes('.') ||
    domain
      .split('.')
      .some(
        (label) =>
          label.length === 0 ||
          label.length > 63 ||
          label.startsWith('-') ||
          label.endsWith('-') ||
          ![...label].every((char) => isAsciiAlphanumeric(char) || char === '-')
      )
  ) {
    return null;
  }
  return email;
}

const KNOWN_FIELDS = new Set([
  'email',
  'interest',
  'locale',
  'source_page',
  'consent',
  'bot_field',
]);

function field(payload: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(payload, key) ? payload[key] : undefined;
}

/** Validate a JSON body the same way the Rust handler does. */
export function validateSignup(payload: unknown): SignupResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, code: 'invalid_signup' };
  }
  const body = payload as Record<string, unknown>;
  // Mirrors serde's deny_unknown_fields on the Rust Signup struct.
  if (Object.keys(body).some((key) => !KNOWN_FIELDS.has(key))) {
    return { ok: false, code: 'invalid_signup' };
  }
  const botField = field(body, 'bot_field') ?? '';
  if (typeof botField !== 'string' || botField !== '') {
    return { ok: false, code: 'invalid_signup' };
  }
  const rawEmail = field(body, 'email');
  const email = typeof rawEmail === 'string' ? normalizedEmail(rawEmail) : null;
  if (!email) return { ok: false, code: 'invalid_email' };

  const interest = field(body, 'interest');
  const locale = field(body, 'locale');
  const sourcePage = field(body, 'source_page');
  if (
    field(body, 'consent') !== true ||
    (interest !== 'solo' && interest !== 'teams') ||
    (locale !== 'en' && locale !== 'th') ||
    typeof sourcePage !== 'string' ||
    // Rust's String::len() counts UTF-8 bytes, not UTF-16 code units.
    new TextEncoder().encode(sourcePage).length > 128
  ) {
    return { ok: false, code: 'invalid_signup' };
  }
  return { ok: true, signup: { email, interest, locale, source_page: sourcePage } };
}
