import { TimerIcon } from 'lucide-react';
import Link from 'next/link';

import { localizedPath, SITE_NAME, type SiteLocale } from '@/lib/seo/site';

const MKT_FG_MUTED = 'var(--mkt-fg-muted)';

const FOOTER_SECTIONS = [
  {
    heading: { en: 'Product', th: 'ผลิตภัณฑ์' },
    links: [
      { href: '/wakatime-alternative', label: { en: 'WakaTime alternative', th: 'ทางเลือก WakaTime' } },
      { href: '/ai-coding-tracker', label: { en: 'AI coding tracker', th: 'ติดตาม AI coding' } },
      { href: '/developer-analytics', label: { en: 'Developer analytics', th: 'Developer analytics' } },
      { href: '/teams', label: { en: 'Teams (in development)', th: 'Teams (อยู่ระหว่างพัฒนา)' } },
      { href: '/pricing', label: { en: 'Pricing', th: 'ราคา' } },
    ],
  },
  {
    heading: { en: 'Documentation', th: 'เอกสาร' },
    links: [
      { href: '/docs/getting-started', label: { en: 'Getting started', th: 'เริ่มต้นใช้งาน' } },
      { href: '/integrations/vscode', label: { en: 'VS Code integration', th: 'การเชื่อมต่อ VS Code' } },
      { href: '/privacy', label: { en: 'Privacy and data', th: 'ความเป็นส่วนตัวและข้อมูล' } },
    ],
  },
];

const FOOTER_COPY = {
  en: {
    about: 'About',
    contact: 'Contact',
    privacy: 'Privacy',
    terms: 'Terms',
    copyright: 'Developer time tracking.',
    tagline: 'Developer time tracking with your complete history. One timeline for everything you do.',
  },
  th: {
    about: 'เกี่ยวกับเรา',
    contact: 'ติดต่อ',
    privacy: 'ความเป็นส่วนตัว',
    terms: 'ข้อกำหนด',
    copyright: 'บริการติดตามเวลาการเขียนโค้ด',
    tagline: 'ติดตามเวลาการเขียนโค้ดพร้อมประวัติครบถ้วนในไทม์ไลน์เดียว',
  },
} as const;

export function MarketingFooter({ locale = 'en' }: { locale?: SiteLocale }) {
  return (
    <footer className="border-t" style={{ borderColor: 'var(--mkt-border)' }}>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <TimerIcon aria-hidden className="size-4" style={{ color: 'var(--mkt-accent)' }} />
              <span
                className="text-sm font-semibold"
                style={{ fontFamily: 'var(--font-mkt-mono), monospace' }}
              >
                {SITE_NAME}
              </span>
            </div>
            <p className="mt-3 text-xs" style={{ color: MKT_FG_MUTED }}>
              {FOOTER_COPY[locale].tagline}
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav aria-label={section.heading[locale]} key={section.heading.en}>
              <h2 className="text-xs font-semibold">{section.heading[locale]}</h2>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      className="text-xs"
                      href={localizedPath(locale, link.href)}
                      style={{ color: MKT_FG_MUTED }}
                    >
                      {link.label[locale]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-xs" style={{ color: MKT_FG_MUTED }}>
          <Link href={localizedPath(locale, '/about')}>{FOOTER_COPY[locale].about}</Link>
          <Link href={localizedPath(locale, '/contact')}>{FOOTER_COPY[locale].contact}</Link>
          <Link href={localizedPath(locale, '/privacy')}>{FOOTER_COPY[locale].privacy}</Link>
          <Link href={localizedPath(locale, '/terms')}>{FOOTER_COPY[locale].terms}</Link>
        </div>

        <p
          className="mt-10 border-t pt-6 text-xs"
          style={{ borderColor: 'var(--mkt-border)', color: MKT_FG_MUTED }}
        >
          © {new Date().getFullYear()} {SITE_NAME}. {FOOTER_COPY[locale].copyright}
        </p>
      </div>
    </footer>
  );
}
