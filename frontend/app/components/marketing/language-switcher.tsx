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
      className="rounded-full border px-3 py-1.5 text-xs font-semibold"
      href={localizedPath(targetLocale, basePath)}
      style={{ borderColor: 'var(--mkt-border)', color: 'var(--mkt-fg-muted)' }}
    >
      {label}
    </Link>
  );
}
