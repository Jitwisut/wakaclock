import { TimerIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { SITE_NAME } from '@/lib/seo/site';

/**
 * Real routes rather than same-page anchors, so each destination is crawlable and
 * the anchor text describes the page it points at.
 */
const NAV_LINKS = [
  { href: '/wakatime-alternative', label: 'vs WakaTime' },
  { href: '/ai-coding-tracker', label: 'AI tracking' },
  { href: '/developer-analytics', label: 'Analytics' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs/getting-started', label: 'Docs' },
];

export function MarketingNav() {
  return (
    <header className="sticky top-4 z-50 mx-4 md:top-6 md:mx-6">
      <div
        className="mx-auto flex max-w-6xl items-center justify-between rounded-full border px-4 py-2.5 backdrop-blur-lg md:px-6"
        style={{
          borderColor: 'var(--mkt-border)',
          background: 'color-mix(in oklab, var(--mkt-bg-elevated) 85%, transparent)',
        }}
      >
        <Link className="flex items-center gap-2" href="/">
          <TimerIcon aria-hidden className="size-5" style={{ color: 'var(--mkt-accent)' }} />
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-mkt-mono), monospace' }}
          >
            {SITE_NAME}
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              className="text-sm font-medium transition-colors hover:opacity-100"
              href={link.href}
              key={link.href}
              style={{ color: 'var(--mkt-fg-muted)' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild className="hidden sm:inline-flex" size="sm" variant="ghost">
            <Link href="/dashboard/wakaclock">Log in</Link>
          </Button>
          <Button
            asChild
            className="rounded-full"
            size="sm"
            style={{ background: 'var(--mkt-accent)', color: 'var(--mkt-accent-fg)' }}
          >
            <Link href="/dashboard/wakaclock">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
