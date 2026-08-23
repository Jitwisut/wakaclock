import { IBM_Plex_Sans_Thai, Pixelify_Sans, Space_Mono } from 'next/font/google';

import { JsonLd } from '@/components/seo/json-ld';
import GoogleAnalyticsInit from '@/lib/ga';
import {
  graph,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from '@/lib/seo/schema';
import type { SiteLocale } from '@/lib/seo/site';

import { MarketingFooter } from './marketing-footer';
import { MarketingNav } from './marketing-nav';

/**
 * Display face — the same Pixelify Sans the dashboard's Retro Pixel 3D preset uses
 * (`lib/fonts.ts`), so the site and the product it sells share one voice. Multi-weight
 * pixel-cut rather than a true bitmap face like Press Start 2P, which only ships one
 * crude weight and cannot carry a heading hierarchy.
 */
const pixelDisplay = Pixelify_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mkt-pixel',
  display: 'swap',
});

/**
 * Body face. Space Mono keeps the retro-terminal character at paragraph sizes, where the
 * pixel display face would fail the readable-font-size and line-length guidelines — the
 * same split the dashboard preset and the presence page already make.
 */
const bodyMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mkt-body',
  display: 'swap',
});

/**
 * Thai copy cannot use either Latin face: neither Pixelify Sans nor Space Mono ships Thai
 * glyphs, so a Thai heading set in them silently falls back to a system font and loses the
 * art direction entirely. IBM Plex Sans Thai carries Thai headings *and* Thai body copy,
 * and `marketing.css` points `--font-mkt-display` at it for `[lang='th']`. Thai therefore
 * reads as the same product through colour, the zero radius and the hard offset shadows
 * rather than through a pixel typeface it has no glyphs for.
 */
const thaiSans = IBM_Plex_Sans_Thai({
  subsets: ['latin', 'thai'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mkt-thai',
  display: 'swap',
});

const SITE_GRAPH = graph(organizationSchema(), websiteSchema(), softwareApplicationSchema());

export function MarketingLayoutFrame({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: SiteLocale;
}) {
  return (
    <div
      className={`wakaclock-marketing flex min-h-screen flex-col ${pixelDisplay.variable} ${bodyMono.variable} ${thaiSans.variable}`}
      lang={locale}
      style={{
        fontFamily:
          locale === 'th'
            ? 'var(--font-mkt-thai), sans-serif'
            : 'var(--font-mkt-body), ui-monospace, monospace',
      }}
    >
      <JsonLd data={SITE_GRAPH} />
      <MarketingNav locale={locale} />
      <main className="flex-1">{children}</main>
      <MarketingFooter locale={locale} />
      {process.env.NODE_ENV === 'production' ? <GoogleAnalyticsInit locale={locale} /> : null}
    </div>
  );
}
