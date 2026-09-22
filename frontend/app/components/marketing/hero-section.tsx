import { ArrowUpRightIcon, CheckIcon } from 'lucide-react';
import Link from 'next/link';

import { localizedPath, type SiteLocale } from '@/lib/seo/site';

import { HeroPanel } from './hero-panel';
import { EN_HOME, TH_HOME } from './marketing-copy';

/**
 * Server component. The heading and the supporting paragraph are plain server-rendered
 * markup so they are present, visible and styleable in the initial HTML response —
 * they are both the LCP element and the paragraph answer engines extract.
 */
const CTA_COPY = {
  en: {
    cta: 'Join early access',
    compare: 'Compare with WakaTime',
    note: 'Invite-only Early Access. No payment required to join the list.',
  },
  th: {
    cta: 'เข้าร่วม Early Access',
    compare: 'เปรียบเทียบกับ WakaTime',
    note: 'Early Access แบบเชิญ ลงชื่อแสดงความสนใจได้โดยไม่มีค่าใช้จ่าย',
  },
} as const;

const HOME_COPY = { en: EN_HOME, th: TH_HOME } as const;

export function HeroSection({ locale = 'en' }: { locale?: SiteLocale }) {
  const copy = HOME_COPY[locale];
  const ctaCopy = CTA_COPY[locale];
  return (
    <>
      <header className="axis-opening">
        <div className="axis-hero-inner">
          <div className="axis-hero-copy">
            {/*
            A badge and a deck line, not paragraphs. Marking them <p> put two fragments of
            display type ahead of the actual opening paragraph, which is the text a search
            or answer engine lifts as the page's snippet.
          */}
            <div className="mkt-hero-eyebrow">{copy.badge}</div>

            <h1 className="axis-hero-title">
              {copy.headline[0]}
              <br />
              <span style={{ color: 'var(--mkt-accent)' }}>{copy.headline[1]}</span>
            </h1>

            <div className="axis-hero-bottom">
              <div className="axis-hero-deck">
                <div className="axis-hero-tagline">{copy.tagline}</div>

                <p
                  className="mt-4 max-w-xl text-base text-pretty md:text-lg"
                  style={{ color: 'var(--mkt-fg-muted)' }}
                >
                  {copy.heroLead}
                </p>
              </div>

              <div className="mkt-hero-actions mt-8 flex flex-wrap items-center gap-3">
                <Link
                  className="axis-hero-cta"
                  data-slot="button"
                  href={localizedPath(locale, '/early-access')}
                  style={{ background: 'var(--mkt-accent)', color: 'var(--mkt-accent-fg)' }}
                >
                  {ctaCopy.cta}
                  <ArrowUpRightIcon aria-hidden size={16} />
                </Link>
                <Link
                  className="axis-hero-cta"
                  data-slot="button"
                  data-variant="outline"
                  href={localizedPath(locale, '/wakatime-alternative')}
                >
                  {ctaCopy.compare}
                </Link>
              </div>

              <ul
                aria-label={locale === 'th' ? 'จุดเด่นของ AtoAxis' : 'AtoAxis essentials'}
                className="axis-hero-proof"
              >
                {copy.highlights.map((highlight) => (
                  <li key={highlight}>
                    <CheckIcon aria-hidden size={13} />
                    {highlight}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs" style={{ color: 'var(--mkt-fg-muted)' }}>
                {ctaCopy.note}
              </p>
              <a className="mkt-hero-scroll" href="#features">
                <span aria-hidden="true">↓</span>
                {locale === 'th'
                  ? 'เลื่อนลง แล้วรู้จักงานของคุณให้มากขึ้น'
                  : 'Scroll to see your work more clearly'}
              </a>
            </div>
          </div>
        </div>
      </header>
      <section className="axis-hero">
        <div className="axis-hero-stage">
          <HeroPanel locale={locale} />
        </div>
      </section>
    </>
  );
}
