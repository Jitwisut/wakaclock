'use client';

import { useEffect, useRef, useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LinkPending } from '@/components/link-pending';
import { localizedPath, SITE_NAME, type SiteLocale } from '@/lib/seo/site';

import { BrandMark } from './brand-mark';
import { LanguageSwitcher } from './language-switcher';
import { isNavLinkActive, NAV_COPY, NAV_LINKS } from './nav-links.data';

export function MarketingNav({ locale = 'en' }: { locale?: SiteLocale }) {
  const pathname = usePathname() || '/';
  const copy = NAV_COPY[locale];
  const [open, setOpen] = useState(false);
  const toggle = useRef<globalThis.HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  return (
    <header className="axis-nav" data-open={open} ref={header}>
      <div className="axis-nav-bar">
        <Link className="axis-wordmark" href={localizedPath(locale, '/')}>
          <BrandMark preload />
          {SITE_NAME}
          <LinkPending indicatorClassName="mkt-blink" label={copy.loading} />
        </Link>
        <nav aria-label={copy.primary} className="axis-nav-inline">
          {NAV_LINKS.map((link) => (
            <Link
              aria-current={isNavLinkActive(pathname, link.href) ? 'page' : undefined}
              href={localizedPath(locale, link.href)}
              key={link.href}
            >
              {link.label[locale]}
              <LinkPending label={copy.loading} />
            </Link>
          ))}
        </nav>
        <div className="axis-nav-controls">
          <LanguageSwitcher locale={locale} />
          <Link className="axis-nav-login" href="/login">
            {copy.login}
          </Link>
          <button
            aria-controls="marketing-mobile-menu"
            aria-expanded={open}
            aria-label={open ? copy.close : copy.open}
            className="axis-menu-toggle"
            onClick={() => setOpen((value) => !value)}
            ref={toggle}
            type="button"
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </div>
      {open ? (
        <nav aria-label={copy.primary} className="axis-nav-expanded" id="marketing-mobile-menu">
          <ol>
            {NAV_LINKS.map((link, index) => (
              <li key={link.href}>
                <Link
                  aria-current={isNavLinkActive(pathname, link.href) ? 'page' : undefined}
                  href={localizedPath(locale, link.href)}
                  onClick={() => setOpen(false)}
                >
                  <span aria-hidden="true">0{index + 1}</span>
                  {link.label[locale]}
                  <LinkPending label={copy.loading} />
                </Link>
              </li>
            ))}
          </ol>
          <div className="axis-nav-action">
            <span aria-hidden="true" className="axis-menu-brand">
              {SITE_NAME}
            </span>
            <Link
              className="axis-action"
              href={localizedPath(locale, '/early-access')}
              onClick={() => setOpen(false)}
            >
              {copy.cta}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/login" onClick={() => setOpen(false)}>
              {copy.login}
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
