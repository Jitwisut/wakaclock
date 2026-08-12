import { ArrowRightIcon, ShieldCheckIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { PRICING, SITE_NAME, SITE_TAGLINE } from '@/lib/seo/site';

import { HeroPanel } from './hero-panel';

/**
 * Server component. The heading and the supporting paragraph are plain server-rendered
 * markup so they are present, visible and styleable in the initial HTML response —
 * they are both the LCP element and the paragraph answer engines extract.
 */
export function HeroSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-20 pb-16 md:px-6 md:pt-28 md:pb-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div>
          <p
            className="mb-6 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
            style={{ borderColor: 'var(--mkt-border)', color: 'var(--mkt-fg-muted)' }}
          >
            <ShieldCheckIcon aria-hidden className="size-3.5" />
            Self-hosted · Works with the WakaTime API
          </p>

          <h1
            className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance md:text-5xl lg:text-[3.4rem]"
            style={{ fontFamily: 'var(--font-mkt-mono), monospace' }}
          >
            Developer time tracking
            <br />
            <span style={{ color: 'var(--mkt-accent)' }}>on your own server.</span>
          </h1>

          <p className="mt-4 max-w-xl text-xl font-medium text-pretty">{SITE_TAGLINE}</p>

          <p className="mt-4 max-w-xl text-lg text-pretty" style={{ color: 'var(--mkt-fg-muted)' }}>
            {SITE_NAME} records how long you spend coding across projects, programming
            languages, branches and editors. It implements the WakaTime API, so an editor
            that already has a WakaTime plugin can point at your {SITE_NAME} server instead
            — and your heartbeats land in a ClickHouse database you own and can query
            directly.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              asChild
              className="rounded-full px-6"
              size="lg"
              style={{ background: 'var(--mkt-accent)', color: 'var(--mkt-accent-fg)' }}
            >
              <Link href="/docs/getting-started">
                Install {SITE_NAME}
                <ArrowRightIcon aria-hidden className="size-4" />
              </Link>
            </Button>
            <Button asChild className="rounded-full px-6" size="lg" variant="outline">
              <Link href="/wakatime-alternative">Compare with WakaTime</Link>
            </Button>
          </div>

          <p className="mt-4 text-xs" style={{ color: 'var(--mkt-fg-muted)' }}>
            {PRICING.trialDays}-day trial · ${PRICING.monthlyUsd}/month or $
            {PRICING.annualUsd}/year · Runs on your own infrastructure
          </p>
        </div>

        <HeroPanel />
      </div>
    </section>
  );
}
