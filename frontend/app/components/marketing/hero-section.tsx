import Link from 'next/link';

import { Button } from '@/components/ui/button';
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
    note: 'Hosted service planned. Available in English and Thai.',
  },
  th: {
    cta: 'เข้าร่วม Early Access',
    compare: 'เปรียบเทียบกับ WakaTime',
    note: 'เตรียมเปิดให้ใช้งานแบบ hosted รองรับภาษาไทยและอังกฤษ',
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
              {copy.title.split('\n')[0]}
              <br />
              <span style={{ color: 'var(--mkt-accent)' }}>{copy.title.split('\n')[1]}</span>
            </h1>

            <div className="axis-hero-bottom">
              <div className="axis-hero-deck">
                <div className="axis-hero-tagline">{copy.tagline}</div>

                <p
                  className="mt-4 max-w-xl text-base text-pretty md:text-lg"
                  style={{ color: 'var(--mkt-fg-muted)' }}
                >
                  {locale === 'th'
                    ? 'เห็นเวลาที่ใช้ โปรเจกต์ที่เดินหน้า และสัดส่วนโค้ดจาก AI ในไทม์ไลน์เดียว พร้อมประวัติครบถ้วนและข้อมูลที่ยังระบุผู้เขียนไม่ได้อย่างชัดเจน'
                    : 'See your time, your projects, and AI contributions in one timeline. Keep your complete history, with missing attribution clearly marked.'}
                </p>
              </div>

              <div className="mkt-hero-actions mt-8 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  className="px-6"
                  size="lg"
                  style={{ background: 'var(--mkt-accent)', color: 'var(--mkt-accent-fg)' }}
                >
                  <Link href={localizedPath(locale, '/early-access')}>{ctaCopy.cta}</Link>
                </Button>
                <Button asChild className="px-6" size="lg" variant="outline">
                  <Link href={localizedPath(locale, '/wakatime-alternative')}>
                    {ctaCopy.compare}
                  </Link>
                </Button>
              </div>

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
