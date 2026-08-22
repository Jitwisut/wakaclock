import { TimerIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { localizedPath, SITE_NAME, type SiteLocale } from '@/lib/seo/site';

import { LanguageSwitcher } from './language-switcher';

/**
 * Real routes rather than same-page anchors, so each destination is crawlable and
 * the anchor text describes the page it points at.
 */
const NAV_LINKS = [
  { href: '/wakatime-alternative', label: { en: 'vs WakaTime', th: 'เทียบกับ WakaTime' } },
  { href: '/ai-coding-tracker', label: { en: 'AI tracking', th: 'ติดตาม AI' } },
  { href: '/developer-analytics', label: { en: 'Analytics', th: 'Analytics' } },
  { href: '/teams', label: { en: 'Teams', th: 'Teams' } },
  { href: '/pricing', label: { en: 'Pricing', th: 'ราคา' } },
  { href: '/docs/getting-started', label: { en: 'Docs', th: 'เอกสาร' } },
];

const NAV_COPY = {
  en: { cta: 'Join early access', login: 'Log in', primary: 'Primary' },
  th: { cta: 'เข้าร่วม Early Access', login: 'เข้าสู่ระบบ', primary: 'เมนูหลัก' },
} as const;

export function MarketingNav({ locale = 'en' }: { locale?: SiteLocale }) {
  return (
    <header className="sticky top-4 z-50 mx-4 md:top-6 md:mx-6">
      <div
        className="mx-auto flex max-w-6xl items-center justify-between rounded-full border px-4 py-2.5 backdrop-blur-lg md:px-6"
        style={{
          borderColor: 'var(--mkt-border)',
          background: 'color-mix(in oklab, var(--mkt-bg-elevated) 85%, transparent)',
        }}
      >
        <Link className="flex items-center gap-2" href={localizedPath(locale, '/') }>
          <TimerIcon aria-hidden className="size-5" style={{ color: 'var(--mkt-accent)' }} />
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-mkt-mono), monospace' }}
          >
            {SITE_NAME}
          </span>
        </Link>

        <nav aria-label={NAV_COPY[locale].primary} className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              className="text-sm font-medium transition-colors hover:opacity-100"
              href={localizedPath(locale, link.href)}
              key={link.href}
              style={{ color: 'var(--mkt-fg-muted)' }}
            >
              {link.label[locale]}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} />
          <Button asChild className="hidden sm:inline-flex" size="sm" variant="ghost">
            <Link href="/dashboard/wakaclock">{NAV_COPY[locale].login}</Link>
          </Button>
          <Button
            asChild
            className="rounded-full"
            size="sm"
            style={{ background: 'var(--mkt-accent)', color: 'var(--mkt-accent-fg)' }}
          >
            <Link href={localizedPath(locale, '/early-access')}>{NAV_COPY[locale].cta}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
