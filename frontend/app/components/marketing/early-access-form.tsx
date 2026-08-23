import { localizedPath, type SiteLocale } from '@/lib/seo/site';

import { FormSubmitButton } from './form-submit-button';

const COPY = {
  en: {
    consent: 'I agree to receive AtoAxis Early Access and launch updates.',
    email: 'Email address',
    heading: 'Join early access',
    interest: 'What are you interested in?',
    optionSolo: 'Personal coding analytics',
    optionTeams: 'Team coding presence',
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

  return (
    <section
      aria-labelledby="early-access-heading"
      className="mx-auto max-w-3xl px-4 py-20 md:px-6"
      id="early-access"
    >
      <div
        className="mkt-pixel-shadow border-[3px] p-8 md:p-10"
        style={{ borderColor: 'var(--mkt-border)', background: 'var(--mkt-bg-elevated)' }}
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

        <form
          action={localizedPath(locale, '/early-access/success')}
          className="mt-8 space-y-5"
          data-netlify="true"
          data-netlify-honeypot="bot-field"
          method="POST"
          name="early-access"
        >
          <input name="form-name" type="hidden" value="early-access" />
          <input name="locale" type="hidden" value={locale} />
          <input name="source_page" type="hidden" value={sourcePage} />

          <div>
            <label className="text-sm font-medium" htmlFor={`${locale}-early-access-email`}>
              {copy.email}
            </label>
            <input
              className="mt-2 w-full border-2 bg-transparent px-4 py-3 text-sm outline-none"
              id={`${locale}-early-access-email`}
              name="email"
              placeholder="you@example.com"
              required
              style={{ borderColor: 'var(--mkt-border)' }}
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
              style={{ borderColor: 'var(--mkt-border)' }}
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

          <FormSubmitButton label={copy.submit} pendingLabel={copy.submitting} />
        </form>
      </div>
    </section>
  );
}
