'use client';

import { useEffect, useState } from 'react';

import { MenuIcon, TimerIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LinkPending } from '@/components/link-pending';
import { Button } from '@/components/ui/button';
import { localizedPath, SITE_NAME, type SiteLocale } from '@/lib/seo/site';

import { LanguageSwitcher } from './language-switcher';
import { isNavLinkActive, NAV_COPY, NAV_LINKS } from './nav-links.data';
import {
  MKT_ACCENT,
  MKT_ACCENT_FG,
  MKT_BG_ELEVATED,
  MKT_BORDER,
  MKT_DISPLAY_FONT,
  MKT_FG,
  MKT_FG_MUTED,
} from './tokens';

const BAR_SURFACE = {
  background: MKT_BG_ELEVATED,
  borderColor: MKT_BORDER,
} as const;

/**
 * Client component because three things here depend on where the visitor currently is or
 * what they just did: the active-page marker, the mobile disclosure, and the per-link
 * pending indicator. The markup is still server-rendered, so the links are in the initial
 * HTML and remain crawlable.
 */
export function MarketingNav({ locale = 'en' }: { locale?: SiteLocale }) {
  const pathname = usePathname() || '/';
  const copy = NAV_COPY[locale];
  const [open, setOpen] = useState(false);

  // A menu left open across a route change would cover the page the visitor just asked
  // for, so arriving anywhere new closes it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <header className="sticky top-4 z-50 mx-4 md:top-6 md:mx-6">
      <div
        className="mkt-pixel-shadow mx-auto flex max-w-6xl items-center justify-between border-[3px] px-3 py-2.5 md:px-5"
        style={BAR_SURFACE}
      >
        <Link className="flex items-center gap-2 px-1 py-1.5" href={localizedPath(locale, '/')}>
          <TimerIcon aria-hidden className="size-5" style={{ color: MKT_ACCENT }} />
          <span
            className="text-base font-bold tracking-tight"
            style={{ fontFamily: MKT_DISPLAY_FONT }}
          >
            {SITE_NAME}
          </span>
          <LinkPending indicatorClassName="mkt-blink" label={copy.loading} />
        </Link>

        <nav aria-label={copy.primary} className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => {
            const active = isNavLinkActive(pathname, link.href);

            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className="border-b-[3px] px-3 py-2 text-sm font-medium transition-colors duration-150 hover:text-[var(--mkt-accent)]"
                href={localizedPath(locale, link.href)}
                key={link.href}
                style={{
                  borderBottomColor: active ? MKT_ACCENT : 'transparent',
                  color: active ? MKT_ACCENT : MKT_FG_MUTED,
                }}
              >
                {link.label[locale]}
                <LinkPending indicatorClassName="mkt-blink" label={copy.loading} />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} />
          <Button asChild className="hidden sm:inline-flex" size="sm" variant="ghost">
            <Link href="/dashboard/wakaclock">{copy.login}</Link>
          </Button>
          <Button
            asChild
            className="hidden font-bold sm:inline-flex"
            size="sm"
            style={{ background: MKT_ACCENT, color: MKT_ACCENT_FG }}
          >
            <Link href={localizedPath(locale, '/early-access')}>{copy.cta}</Link>
          </Button>
          <button
            aria-controls="marketing-mobile-menu"
            aria-expanded={open}
            aria-label={open ? copy.close : copy.open}
            className="mkt-pixel-press mkt-pixel-shadow-sm flex size-11 shrink-0 cursor-pointer items-center justify-center border-2 lg:hidden"
            onClick={() => setOpen((value) => !value)}
            style={{
              background: open ? MKT_ACCENT : 'var(--mkt-bg-sunken)',
              borderColor: MKT_BORDER,
              color: open ? MKT_ACCENT_FG : MKT_FG,
            }}
            type="button"
          >
            {open ? (
              <XIcon aria-hidden className="size-5" />
            ) : (
              <MenuIcon aria-hidden className="size-5" />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          aria-label={copy.primary}
          className="mkt-pixel-shadow mx-auto mt-3 max-w-6xl border-[3px] p-2 lg:hidden"
          id="marketing-mobile-menu"
          style={BAR_SURFACE}
        >
          <ul className="flex flex-col">
            {NAV_LINKS.map((link) => {
              const active = isNavLinkActive(pathname, link.href);

              return (
                <li key={link.href}>
                  <Link
                    aria-current={active ? 'page' : undefined}
                    className="flex min-h-11 items-center border-l-4 px-4 py-3 text-base font-medium transition-colors duration-150"
                    href={localizedPath(locale, link.href)}
                    style={{
                      background: active ? 'var(--mkt-accent-soft)' : 'transparent',
                      borderLeftColor: active ? MKT_ACCENT : 'transparent',
                      color: active ? MKT_ACCENT : MKT_FG,
                    }}
                  >
                    {link.label[locale]}
                    <LinkPending indicatorClassName="mkt-blink" label={copy.loading} />
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex flex-col gap-2 border-t-2 pt-3" style={BAR_SURFACE}>
            <Button asChild className="min-h-11 w-full" size="lg" variant="outline">
              <Link href="/dashboard/wakaclock">{copy.login}</Link>
            </Button>
            <Button
              asChild
              className="min-h-11 w-full font-bold"
              size="lg"
              style={{ background: MKT_ACCENT, color: MKT_ACCENT_FG }}
            >
              <Link href={localizedPath(locale, '/early-access')}>{copy.cta}</Link>
            </Button>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
