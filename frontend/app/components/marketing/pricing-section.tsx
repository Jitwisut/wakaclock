'use client';

import { useState } from 'react';

import { CheckIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { PRICING } from '@/lib/seo/site';

const MKT_FG_MUTED = 'var(--mkt-fg-muted)';
const MKT_ACCENT = 'var(--mkt-accent)';

const INCLUDED = [
  'Unlimited projects & heartbeats',
  'AI vs. human code attribution',
  'Keystroke & character metrics',
  'Project rules & merges',
  'AST-based language detection',
  'WakaTime data import',
  'Complete coding history, never trimmed',
];

export function PricingSection() {
  const [annual, setAnnual] = useState(true);
  const price = annual ? PRICING.annualUsd : PRICING.monthlyUsd;
  const period = annual ? '/year' : '/month';

  return (
    <section className="mx-auto max-w-3xl px-4 py-20 md:px-6" id="pricing">
      <div className="mb-10 text-center">
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: 'var(--font-mkt-mono), monospace' }}
        >
          One plan. Everything included.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: MKT_FG_MUTED }}>
          Planned launch pricing — one hosted plan with the complete product. Checkout is not open
          during Early Access.
        </p>
      </div>

      <div
        aria-label="Billing period"
        className="mb-8 inline-flex w-full items-center justify-center"
        role="group"
      >
        <button
          aria-pressed={!annual}
          className="cursor-pointer rounded-l-md border border-r-0 px-5 py-2 text-sm font-semibold transition-colors"
          data-selected={!annual}
          onClick={() => setAnnual(false)}
          style={{
            background: annual ? 'transparent' : 'var(--mkt-bg-elevated)',
            borderColor: 'var(--mkt-border)',
            color: annual ? MKT_FG_MUTED : 'var(--mkt-fg)',
          }}
          type="button"
        >
          Monthly billing
        </button>
        <button
          aria-pressed={annual}
          className="cursor-pointer rounded-r-md border px-5 py-2 text-sm font-semibold transition-colors"
          data-selected={annual}
          onClick={() => setAnnual(true)}
          style={{
            background: annual ? 'var(--mkt-bg-elevated)' : 'transparent',
            borderColor: 'var(--mkt-border)',
            color: annual ? 'var(--mkt-fg)' : MKT_FG_MUTED,
          }}
          type="button"
        >
          Annual billing
          <span
            className="ml-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ background: 'var(--mkt-accent-soft)', color: MKT_ACCENT }}
          >
            save 31%
          </span>
        </button>
      </div>

      <div
        className="rounded-2xl border p-8 md:p-10"
        style={{ borderColor: MKT_ACCENT, background: 'var(--mkt-bg-elevated)' }}
      >
        <div className="mb-6 flex items-baseline gap-2">
          <span
            className="text-5xl font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-mkt-mono), monospace' }}
          >
            ${price}
          </span>
          <span style={{ color: MKT_FG_MUTED }}>{period}</span>
        </div>

        <ul className="mb-8 space-y-3">
          {INCLUDED.map((item) => (
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
          className="w-full rounded-full"
          size="lg"
          style={{ background: MKT_ACCENT, color: 'var(--mkt-accent-fg)' }}
        >
          <Link href="/early-access">Join early access</Link>
        </Button>
        <p className="mt-3 text-center text-xs" style={{ color: MKT_FG_MUTED }}>
          Planned pricing: ${PRICING.monthlyUsd}/month or ${PRICING.annualUsd}/year. No charge now.
        </p>
      </div>
    </section>
  );
}
