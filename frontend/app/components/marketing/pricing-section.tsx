'use client';

import { useState } from 'react';

import { CheckIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { localizedPath, PRICING, type SiteLocale } from '@/lib/seo/site';

const MKT_FG_MUTED = 'var(--mkt-fg-muted)';
const MKT_ACCENT = 'var(--mkt-accent)';

const COPY = {
  en: {
    heading: 'One plan. Everything included.',
    description:
      'Planned launch pricing: one hosted plan with the complete product. Checkout is not open during Early Access.',
    billing: 'Billing period',
    monthly: 'Monthly billing',
    annual: 'Annual billing',
    save: 'save 31%',
    periodMonth: '/month',
    periodYear: '/year',
    included: [
      'Unlimited projects & heartbeats',
      'AI vs. human code attribution',
      'Keystroke & character metrics',
      'Project rules & merges',
      'AST-based language detection',
      'WakaTime data import',
      'Complete coding history, never trimmed',
    ],
    cta: 'Join early access',
    note: `Planned pricing: $${PRICING.monthlyUsd}/month or $${PRICING.annualUsd}/year. No charge now.`,
  },
  th: {
    heading: 'แผนเดียว รวมทุกอย่าง',
    description:
      'ราคาเปิดตัวที่วางแผนไว้สำหรับ hosted plan เดียว ช่วง Early Access ยังไม่เปิด checkout',
    billing: 'รอบการเรียกเก็บเงิน',
    monthly: 'รายเดือน',
    annual: 'รายปี',
    save: 'ประหยัด 31%',
    periodMonth: '/เดือน',
    periodYear: '/ปี',
    included: [
      'โปรเจกต์และ heartbeat ไม่จำกัด',
      'AI เทียบ human attribution',
      'ตัวชี้วัด keystroke และ character',
      'กฎโปรเจกต์และการรวมโปรเจกต์',
      'ตรวจภาษาแบบ AST',
      'นำเข้า WakaTime data',
      'coding history ครบถ้วน ไม่ตัดทอน',
    ],
    cta: 'เข้าร่วม Early Access',
    note: `ราคาที่วางแผนไว้: $${PRICING.monthlyUsd}/เดือน หรือ $${PRICING.annualUsd}/ปี ยังไม่มีการเรียกเก็บเงิน`,
  },
} as const;

export function PricingSection({ locale = 'en' }: { locale?: SiteLocale }) {
  const copy = COPY[locale];
  const [annual, setAnnual] = useState(true);
  const price = annual ? PRICING.annualUsd : PRICING.monthlyUsd;

  return (
    <section className="mkt-reveal mx-auto max-w-3xl px-4 py-20 md:px-6" id="pricing">
      <div className="mb-10 text-center">
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
        >
          {copy.heading}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: MKT_FG_MUTED }}>
          {copy.description}
        </p>
      </div>

      <div
        aria-label={copy.billing}
        className="mb-8 inline-flex w-full items-center justify-center"
        role="group"
      >
        <button
          aria-pressed={!annual}
          className="cursor-pointer border-2 border-r-0 px-5 py-2 text-sm font-semibold transition-colors"
          data-selected={!annual}
          onClick={() => setAnnual(false)}
          style={{
            background: annual ? 'transparent' : 'var(--mkt-bg-elevated)',
            borderColor: 'var(--mkt-border)',
            color: annual ? MKT_FG_MUTED : 'var(--mkt-fg)',
          }}
          type="button"
        >
          {copy.monthly}
        </button>
        <button
          aria-pressed={annual}
          className="cursor-pointer border-2 px-5 py-2 text-sm font-semibold transition-colors"
          data-selected={annual}
          onClick={() => setAnnual(true)}
          style={{
            background: annual ? 'var(--mkt-bg-elevated)' : 'transparent',
            borderColor: 'var(--mkt-border)',
            color: annual ? 'var(--mkt-fg)' : MKT_FG_MUTED,
          }}
          type="button"
        >
          {copy.annual}
          <span
            className="ml-1.5 px-2 py-0.5 text-xs font-semibold"
            style={{ background: 'var(--mkt-accent-soft)', color: MKT_ACCENT }}
          >
            {copy.save}
          </span>
        </button>
      </div>

      <div
        className="mkt-pixel-shadow border-[3px] p-8 md:p-10"
        style={{ borderColor: MKT_ACCENT, background: 'var(--mkt-bg-elevated)' }}
      >
        <div className="mb-6 flex items-baseline gap-2">
          <span
            className="mkt-price-change text-5xl font-semibold tracking-tight"
            key={price}
            style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
          >
            ${price}
          </span>
          <span style={{ color: MKT_FG_MUTED }}>{annual ? copy.periodYear : copy.periodMonth}</span>
        </div>

        <ul className="mb-8 space-y-3">
          {copy.included.map((item) => (
            <li className="flex items-start gap-2.5 text-sm" key={item}>
              <CheckIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0"
                style={{ color: MKT_ACCENT }}
              />
              {item}
            </li>
          ))}
        </ul>

        <Button
          asChild
          className="w-full"
          size="lg"
          style={{ background: MKT_ACCENT, color: 'var(--mkt-accent-fg)' }}
        >
          <Link href={localizedPath(locale, '/early-access')}>{copy.cta}</Link>
        </Button>
        <p className="mt-3 text-center text-xs" style={{ color: MKT_FG_MUTED }}>
          {copy.note}
        </p>
      </div>
    </section>
  );
}
