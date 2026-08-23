import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { localizedPath, SITE_NAME, type SiteLocale } from '@/lib/seo/site';

import { HeroPanel } from './hero-panel';

/**
 * Server component. The heading and the supporting paragraph are plain server-rendered
 * markup so they are present, visible and styleable in the initial HTML response —
 * they are both the LCP element and the paragraph answer engines extract.
 */
const COPY = {
  en: {
    badge: 'Complete history, and it works with the WakaTime API',
    title: ['Developer time tracking', 'with your full history.'],
    tagline: 'One timeline for everything you do.',
    description: `${SITE_NAME} records how long you spend coding across projects, programming languages, branches and editors. It implements the WakaTime API, so an editor with a WakaTime plugin can point at ${SITE_NAME} instead.`,
    cta: 'Join early access',
    compare: 'Compare with WakaTime',
    note: 'Planned hosted launch. Nothing to deploy. English and Thai support.',
  },
  th: {
    badge: 'ประวัติครบถ้วน และรองรับ WakaTime API',
    title: ['ติดตามเวลาการเขียนโค้ด', 'พร้อมประวัติของคุณครบถ้วน'],
    tagline: 'ไทม์ไลน์เดียวสำหรับทุกสิ่งที่คุณทำ',
    description: `${SITE_NAME} บันทึกเวลาการเขียนโค้ดตามโปรเจกต์ ภาษา branch และ editor รองรับ WakaTime API จึงใช้ plugin เดิมชี้มายัง ${SITE_NAME} ได้`,
    cta: 'เข้าร่วม Early Access',
    compare: 'เปรียบเทียบกับ WakaTime',
    note: 'แผน hosted ที่วางไว้ ไม่ต้อง deploy เอง รองรับทั้งภาษาอังกฤษและไทย',
  },
} as const;

export function HeroSection({ locale = 'en' }: { locale?: SiteLocale }) {
  const copy = COPY[locale];
  return (
    <section className="mx-auto max-w-6xl px-4 pt-20 pb-16 md:px-6 md:pt-28 md:pb-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        {/* min-w-0: the config panel's longest line would otherwise set the grid
            column's min-content width and push the whole hero past the viewport. */}
        <div className="min-w-0">
          <p
            className="mb-6 inline-flex max-w-full flex-wrap items-center gap-1.5 border-2 px-3 py-1 text-[0.7rem] font-medium sm:text-xs"
            style={{ borderColor: 'var(--mkt-border)', color: 'var(--mkt-fg-muted)' }}
          >
            {copy.badge}
          </p>

          <h1
            className="text-[1.75rem] leading-[1.15] font-bold tracking-tight text-balance break-words sm:text-4xl md:text-5xl lg:text-[3.4rem]"
            style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
          >
            {copy.title[0]}
            <br />
            <span style={{ color: 'var(--mkt-accent)' }}>{copy.title[1]}</span>
          </h1>

          <p className="mt-4 max-w-xl text-lg font-medium text-pretty md:text-xl">{copy.tagline}</p>

          <p
            className="mt-4 max-w-xl text-base text-pretty md:text-lg"
            style={{ color: 'var(--mkt-fg-muted)' }}
          >
            {copy.description}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              asChild
              className="px-6"
              size="lg"
              style={{ background: 'var(--mkt-accent)', color: 'var(--mkt-accent-fg)' }}
            >
              <Link href={localizedPath(locale, '/early-access')}>{copy.cta}</Link>
            </Button>
            <Button asChild className="px-6" size="lg" variant="outline">
              <Link href={localizedPath(locale, '/wakatime-alternative')}>{copy.compare}</Link>
            </Button>
          </div>

          <p className="mt-4 text-xs" style={{ color: 'var(--mkt-fg-muted)' }}>
            {copy.note}
          </p>
        </div>

        <HeroPanel locale={locale} />
      </div>
    </section>
  );
}
