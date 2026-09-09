'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { localizedPath, type SiteLocale } from '@/lib/seo/site';

export function LanguageSwitcher({ locale }: { locale: SiteLocale }) {
  const pathname = usePathname() || '/';
  const basePath = locale === 'th' ? pathname.replace(/^\/th(?=\/|$)/, '') || '/' : pathname;
  const targetLocale = locale === 'th' ? 'en' : 'th';
  const label = targetLocale === 'th' ? 'ไทย' : 'EN';

  return (
    <Link
      aria-label={targetLocale === 'th' ? 'อ่านภาษาไทย' : 'Read in English'}
      className="mkt-pixel-press mkt-pixel-shadow-sm inline-flex h-11 shrink-0 items-center border-2 px-3 text-xs font-bold whitespace-nowrap"
      href={localizedPath(targetLocale, basePath)}
      style={{
        background: 'var(--mkt-bg-sunken)',
        borderColor: 'var(--mkt-border)',
        color: 'var(--mkt-fg)',
        // The label is always in the language being switched *to*, so on English pages it
        // is Thai text — and neither Latin face in this theme ships Thai glyphs.
        fontFamily:
          targetLocale === 'th' ? 'var(--font-mkt-thai), sans-serif' : 'var(--font-mkt-body)',
      }}
    >
      {label}
    </Link>
  );
}
