import { describe, expect, it } from 'vitest';

import { normalizedEmail, validateSignup } from '@/lib/early-access/signup';

const valid = {
  email: '  Demo+test@Example.COM ',
  interest: 'solo',
  locale: 'en',
  source_page: 'early-access',
  consent: true,
  bot_field: '',
};

describe('normalizedEmail', () => {
  it('trims and lower-cases a valid address, as the Rust API does', () => {
    expect(normalizedEmail('  Demo+test@Example.COM ')).toBe('demo+test@example.com');
  });

  it('rejects the same addresses as the Rust validator', () => {
    // Mirrors backend/api/src/handlers/v1/early_access.rs `validates_and_normalizes_addresses`.
    for (const invalid of [
      '',
      'a',
      'a@',
      '@example.com',
      'a@@example.com',
      'a@-example.com',
      'a@example..com',
      'a b@example.com',
      'a\n@example.com',
      'a..b@example.com',
      `${'a'.repeat(65)}@example.com`,
    ]) {
      expect(normalizedEmail(invalid), invalid).toBeNull();
    }
  });

  it('rejects the remaining local-part and domain shapes', () => {
    for (const invalid of [
      '.a@example.com',
      'a.@example.com',
      'a(b)@example.com',
      'a@localhost',
      'a@example-.com',
      'a@exa_mple.com',
      `a@${'b'.repeat(64)}.com`,
      `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.com`,
    ]) {
      expect(normalizedEmail(invalid), invalid).toBeNull();
    }
  });

  it('rejects non-ASCII before lower-casing (Kelvin sign would fold to "k")', () => {
    expect(normalizedEmail('Kim@example.com')).toBeNull();
    expect(normalizedEmail('ผู้ใช้@example.com')).toBeNull();
  });
});

describe('validateSignup', () => {
  it('accepts a complete signup and normalises the email', () => {
    expect(validateSignup(valid)).toEqual({
      ok: true,
      signup: {
        email: 'demo+test@example.com',
        interest: 'solo',
        locale: 'en',
        source_page: 'early-access',
      },
    });
    const teams = validateSignup({ ...valid, interest: 'teams', locale: 'th' });
    expect(teams.ok && teams.signup).toMatchObject({ interest: 'teams', locale: 'th' });
  });

  it('treats a missing honeypot as empty', () => {
    const { bot_field: _ignored, ...withoutBot } = valid;
    expect(validateSignup(withoutBot).ok).toBe(true);
  });

  it('rejects bodies that are not a plain object', () => {
    for (const body of [null, undefined, 'x', 1, []]) {
      expect(validateSignup(body)).toEqual({ ok: false, code: 'invalid_signup' });
    }
  });

  it('rejects unknown fields and a filled or non-string honeypot', () => {
    for (const body of [
      { ...valid, extra: 1 },
      { ...valid, bot_field: 'spam' },
      { ...valid, bot_field: 1 },
    ]) {
      expect(validateSignup(body)).toEqual({ ok: false, code: 'invalid_signup' });
    }
  });

  it('reports an invalid or non-string email as invalid_email', () => {
    for (const email of ['nope', 42, undefined]) {
      expect(validateSignup({ ...valid, email })).toEqual({ ok: false, code: 'invalid_email' });
    }
  });

  it('requires consent, a known interest and locale, and a short source page', () => {
    for (const body of [
      { ...valid, consent: false },
      { ...valid, consent: 'yes' },
      { ...valid, interest: 'enterprise' },
      { ...valid, locale: 'de' },
      { ...valid, source_page: 7 },
      { ...valid, source_page: undefined },
      { ...valid, source_page: 'x'.repeat(129) },
      // 43 three-byte characters are 129 UTF-8 bytes but only 43 UTF-16 units.
      { ...valid, source_page: 'ก'.repeat(43) },
    ]) {
      expect(validateSignup(body)).toEqual({ ok: false, code: 'invalid_signup' });
    }
    expect(validateSignup({ ...valid, source_page: 'x'.repeat(128) }).ok).toBe(true);
  });
});
