import Link from 'next/link';

import { localizedPath, SITE_NAME, type SiteLocale } from '@/lib/seo/site';

import { BrandMark } from './brand-mark';

const MKT_FG_MUTED = 'var(--mkt-fg-muted)';

const FOOTER_SECTIONS = [
  {
    heading: { en: 'Product', th: 'ผลิตภัณฑ์' },
    links: [
      {
        href: '/wakatime-alternative',
        label: { en: 'WakaTime alternative', th: 'ทางเลือก WakaTime' },
      },
      { href: '/ai-coding-tracker', label: { en: 'AI coding tracker', th: 'ติดตาม AI coding' } },
      {
        href: '/developer-analytics',
        label: { en: 'Developer analytics', th: 'Developer analytics' },
      },
      { href: '/teams', label: { en: 'Teams (in development)', th: 'Teams (อยู่ระหว่างพัฒนา)' } },
      { href: '/pricing', label: { en: 'Pricing', th: 'ราคา' } },
      { href: '/join', label: { en: 'Join Early Access', th: 'เข้าร่วม Early Access' } },
    ],
  },
  {
    heading: { en: 'Documentation', th: 'เอกสาร' },
    links: [
      { href: '/docs/getting-started', label: { en: 'Getting started', th: 'เริ่มต้นใช้งาน' } },
      {
        href: '/integrations/vscode',
        label: { en: 'VS Code integration', th: 'การเชื่อมต่อ VS Code' },
      },
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
    tagline:
      'Developer time tracking with your complete history. One timeline for everything you do.',
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

const LEGAL_LINKS = [
  { href: '/about', key: 'about' },
  { href: '/contact', key: 'contact' },
  { href: '/privacy', key: 'privacy' },
  { href: '/terms', key: 'terms' },
] as const;

export function MarketingFooter({ locale = 'en' }: { locale?: SiteLocale }) {
  return (
    <footer className="axis-footer">
      <div className="axis-footer-inner">
        <div className="axis-footer-grid">
          <div>
            <div className="flex items-center gap-2">
              <BrandMark />
              <span
                className="axis-footer-name"
                style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
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
                      className="inline-flex min-h-8 items-center text-xs transition-colors duration-150 hover:text-[var(--mkt-accent)] hover:underline hover:underline-offset-4"
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

        <div
          className="mt-8 flex flex-wrap gap-x-2 gap-y-1 text-xs"
          style={{ color: MKT_FG_MUTED }}
        >
          {LEGAL_LINKS.map((entry) => (
            <Link
              className="inline-flex min-h-11 items-center px-2 transition-colors duration-150 hover:text-[var(--mkt-accent)] hover:underline hover:underline-offset-4"
              href={localizedPath(locale, entry.href)}
              key={entry.href}
            >
              {FOOTER_COPY[locale][entry.key]}
            </Link>
          ))}
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
