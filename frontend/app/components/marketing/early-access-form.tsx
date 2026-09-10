'use client';

import { useRef, useState } from 'react';

import { env } from '@/lib/env';
import { localizedPath, type SiteLocale } from '@/lib/seo/site';

import { MKT_BORDER } from './tokens';

const COPY = {
  en: {
    consent: 'I agree to receive AtoAxis Early Access and launch updates.',
    email: 'Email address',
    heading: 'Join early access',
    interest: 'What are you interested in?',
    optionSolo: 'Personal coding analytics',
    optionTeams: 'Team coding presence',
    error: 'Something went wrong. Please try again.',
    submit: 'Join the list',
    submitting: 'Sending…',
    success: 'We will use this address only for AtoAxis Early Access updates.',
  },
  th: {
    consent: 'ฉันยินยอมรับข่าวสาร Early Access และการเปิดตัว AtoAxis',
    email: 'อีเมล',
    heading: 'เข้าร่วม Early Access',
    interest: 'คุณสนใจอะไรเป็นหลัก?',
    optionSolo: 'การวิเคราะห์เวลาการเขียนโค้ดส่วนตัว',
    optionTeams: 'coding presence สำหรับทีม',
    error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
    submit: 'ลงทะเบียน',
    submitting: 'กำลังส่ง…',
    success: 'เราจะใช้อีเมลนี้สำหรับข่าวสาร AtoAxis Early Access เท่านั้น',
  },
} as const;

export function EarlyAccessForm({
  locale = 'en',
  sourcePage = 'early-access',
}: {
  locale?: SiteLocale;
  sourcePage?: string;
}) {
  const copy = COPY[locale];
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(false);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      email: String(formData.get('email') || '').trim(),
      interest: String(formData.get('interest') || 'solo'),
      locale,
      source_page: sourcePage,
      consent: formData.get('consent') === 'yes',
      bot_field: String(formData.get('bot-field') || ''),
    };

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_WAKACLOCK_API_URL.replace(/\/$/, '')}/api/v1/early-access`,
        {
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          signal: AbortSignal.timeout(15_000),
        }
      );
      const result: unknown = response.ok ? await response.json() : null;
      if (
        !result ||
        typeof result !== 'object' ||
        !('accepted' in result) ||
        result.accepted !== true
      ) {
        throw new Error('Signup was not accepted');
      }

      window.location.assign(localizedPath(locale, '/early-access/success'));
    } catch {
      inFlight.current = false;
      setPending(false);
      setError(true);
    }
  }

  return (
    <section
      aria-labelledby="early-access-heading"
      className="mkt-signup-section mkt-reveal mx-auto max-w-5xl px-4 py-20 md:px-6"
      id="early-access"
    >
      <div
        className="mkt-pixel-shadow border-[3px] p-8 md:p-10"
        style={{ borderColor: MKT_BORDER }}
      >
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          id="early-access-heading"
          style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
        >
          {copy.heading}
        </h2>
        <p className="mt-3 text-sm" style={{ color: 'var(--mkt-fg-muted)' }}>
          {copy.success}
        </p>
        {error ? (
          <p className="mt-3 text-sm" role="alert" style={{ color: 'var(--mkt-danger, #ef4444)' }}>
            {copy.error}
          </p>
        ) : null}

        <form className="mt-8 space-y-5" method="POST" name="early-access" onSubmit={handleSubmit}>
          <input name="locale" type="hidden" value={locale} />
          <input name="source_page" type="hidden" value={sourcePage} />

          <div>
            <label className="text-sm font-medium" htmlFor={`${locale}-early-access-email`}>
              {copy.email}
            </label>
            <input
              autoComplete="email"
              className="mt-2 w-full border-2 bg-transparent px-4 py-3 text-sm outline-none"
              id={`${locale}-early-access-email`}
              maxLength={254}
              name="email"
              placeholder="you@example.com"
              required
              style={{ borderColor: MKT_BORDER }}
              type="email"
            />
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor={`${locale}-early-access-interest`}>
              {copy.interest}
            </label>
            <select
              className="mt-2 w-full border-2 bg-transparent px-4 py-3 text-sm outline-none"
              defaultValue="solo"
              id={`${locale}-early-access-interest`}
              name="interest"
              style={{ borderColor: MKT_BORDER }}
            >
              <option value="solo">{copy.optionSolo}</option>
              <option value="teams">{copy.optionTeams}</option>
            </select>
          </div>

          <label
            className="flex items-start gap-3 text-xs"
            style={{ color: 'var(--mkt-fg-muted)' }}
          >
            <input className="mt-0.5" name="consent" required type="checkbox" value="yes" />
            <span>{copy.consent}</span>
          </label>

          <div aria-hidden="true" className="hidden">
            <label htmlFor={`${locale}-early-access-bot`}>Do not fill this out</label>
            <input id={`${locale}-early-access-bot`} name="bot-field" tabIndex={-1} />
          </div>

          <button
            aria-busy={pending}
            className="mkt-pixel-press mkt-pixel-shadow min-h-11 w-full cursor-pointer border-2 px-6 py-3 text-sm font-bold disabled:cursor-progress disabled:opacity-70"
            disabled={pending}
            style={{
              background: 'var(--mkt-accent)',
              borderColor: MKT_BORDER,
              color: 'var(--mkt-accent-fg)',
            }}
            type="submit"
          >
            {pending ? copy.submitting : copy.submit}
            {pending ? (
              <span aria-hidden className="mkt-blink ml-2 inline-block size-2 bg-current" />
            ) : null}
          </button>
        </form>
      </div>
    </section>
  );
}
