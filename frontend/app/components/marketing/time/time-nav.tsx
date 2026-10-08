'use client';

import { useEffect, useState } from 'react';

import type { TimeCopyShape } from './time-copy';

type NavLink = { href: string; label: string };

export function TimeNav({
  copy,
  earlyAccessHref,
  homeHref,
  links,
  otherLocaleHref,
  otherLocaleLang,
}: {
  copy: TimeCopyShape['nav'];
  earlyAccessHref: string;
  homeHref: string;
  links: NavLink[];
  otherLocaleHref: string;
  otherLocaleLang: 'en' | 'th';
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 24);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="tx-nav" data-open={open} data-scrolled={scrolled}>
      <div className="tx-nav-inner">
        <a className="tx-wordmark" href={homeHref}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="12" fill="none" r="9.5" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M12 12V5.5M12 12l4.5 2.6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.6"
            />
          </svg>
          AtoAxis
        </a>
        <nav aria-label={copy.label} className="tx-nav-links" id="tx-nav-links">
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={close}>
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a
                aria-label={copy.languageLabel}
                className="tx-nav-lang"
                href={otherLocaleHref}
                hrefLang={otherLocaleLang}
                lang={otherLocaleLang}
                onClick={close}
              >
                {copy.language}
              </a>
            </li>
          </ul>
          <a className="tx-btn tx-btn--primary tx-btn--sm" href={earlyAccessHref} onClick={close}>
            {copy.join}
          </a>
        </nav>
        <button
          aria-controls="tx-nav-links"
          aria-expanded={open}
          aria-label={open ? copy.close : copy.open}
          className="tx-nav-toggle"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
