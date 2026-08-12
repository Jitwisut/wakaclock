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
  'Self-hosted on your infrastructure',
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
          No tiers to compare, no feature gating. Every account gets the full product.
        </p>
      </div>

      <div className="mb-8 flex items-center justify-center gap-3">
        <button
          className="cursor-pointer text-sm font-medium"
          onClick={() => setAnnual(false)}
          style={{ color: annual ? MKT_FG_MUTED : 'var(--mkt-fg)' }}
          type="button"
        >
          Monthly
        </button>
        <button
          aria-checked={annual}
          className="relative h-6 w-11 cursor-pointer rounded-full transition-colors"
          onClick={() => setAnnual((current) => !current)}
          role="switch"
          style={{ background: annual ? MKT_ACCENT : 'var(--mkt-border)' }}
          type="button"
        >
          <span
            className="absolute top-0.5 size-5 rounded-full bg-white transition-transform"
            style={{ transform: annual ? 'translateX(22px)' : 'translateX(2px)' }}
          />
        </button>
        <button
          className="cursor-pointer text-sm font-medium"
          onClick={() => setAnnual(true)}
          style={{ color: annual ? 'var(--mkt-fg)' : MKT_FG_MUTED }}
          type="button"
        >
          Annual
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
          <Link href="/docs/getting-started">Start {PRICING.trialDays}-day free trial</Link>
        </Button>
        <p className="mt-3 text-center text-xs" style={{ color: MKT_FG_MUTED }}>
          Runs on your own infrastructure — hosting costs are separate.
        </p>
      </div>
    </section>
  );
}
