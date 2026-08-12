import { TimerIcon } from 'lucide-react';
import Link from 'next/link';

import { SITE_NAME } from '@/lib/seo/site';

const FOOTER_SECTIONS = [
  {
    heading: 'Product',
    links: [
      { href: '/wakatime-alternative', label: 'WakaTime alternative' },
      { href: '/ai-coding-tracker', label: 'AI coding tracker' },
      { href: '/developer-analytics', label: 'Developer analytics' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    heading: 'Documentation',
    links: [
      { href: '/docs/getting-started', label: 'Getting started' },
      { href: '/integrations/vscode', label: 'VS Code integration' },
      { href: '/privacy', label: 'Privacy and data' },
    ],
  },
];

export function MarketingFooter() {
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
            <p className="mt-3 text-xs" style={{ color: 'var(--mkt-fg-muted)' }}>
              Self-hosted developer time tracking. One timeline for everything you do.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav aria-label={section.heading} key={section.heading}>
              <h2 className="text-xs font-semibold">{section.heading}</h2>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      className="text-xs"
                      href={link.href}
                      style={{ color: 'var(--mkt-fg-muted)' }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p
          className="mt-10 border-t pt-6 text-xs"
          style={{ borderColor: 'var(--mkt-border)', color: 'var(--mkt-fg-muted)' }}
        >
          © {new Date().getFullYear()} {SITE_NAME}. Self-hosted developer time tracking.
        </p>
      </div>
    </footer>
  );
}
