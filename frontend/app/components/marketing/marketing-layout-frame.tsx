import localFont from 'next/font/local';

import { JsonLd } from '@/components/seo/json-ld';
import GoogleAnalyticsInit from '@/lib/ga';
import {
  founderSchema,
  graph,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from '@/lib/seo/schema';
import type { SiteLocale } from '@/lib/seo/site';

import { MarketingFooter } from './marketing-footer';
import { MarketingMotion } from './marketing-motion';
import { MarketingNav } from './marketing-nav';
import { MarketingPointerEffects } from './marketing-pointer-effects';
import { MarketingScrollIndex } from './marketing-scroll-index';

/** Shared local display face. Keeping the asset local makes Netlify builds deterministic. */
const pixelDisplay = localFont({
  src: '../../public/fonts/atoaxis-sans.woff2',
  variable: '--font-mkt-pixel',
  display: 'swap',
});

/** Shared local monospace face for dense analytics and code-oriented copy. */
const bodyMono = localFont({
  src: '../../public/fonts/atoaxis-mono.woff2',
  variable: '--font-mkt-body',
  display: 'swap',
});

/**
 * Thai text: IBM Plex Sans Thai (Thai subset). Listed after the Latin faces in every stack,
 * so the browser takes Latin glyphs from Geist / Space Grotesk and Thai glyphs from here.
 */
const thaiSans = localFont({
  src: [
    { path: '../../public/fonts/cinema-text-thai-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/cinema-text-thai-500.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/cinema-text-thai-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-mkt-thai',
  display: 'swap',
});

/** Code Universe display face: Space Grotesk (variable 300–700), vendored. */
const cosmosDisplay = localFont({
  src: '../../public/fonts/cinema-display.woff2',
  variable: '--font-mkt-cosmos',
  weight: '300 700',
  display: 'swap',
});

const SITE_GRAPH = graph(
  organizationSchema(),
  founderSchema(),
  websiteSchema(),
  softwareApplicationSchema()
);

export function MarketingLayoutFrame({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: SiteLocale;
}) {
  return (
    <div
      className={`wakaclock-marketing flex min-h-screen flex-col ${pixelDisplay.variable} ${bodyMono.variable} ${thaiSans.variable} ${cosmosDisplay.variable}`}
      lang={locale}
      style={{
        fontFamily:
          locale === 'th'
            ? 'var(--font-mkt-pixel), var(--font-mkt-thai), sans-serif'
            : 'var(--font-mkt-pixel), sans-serif',
      }}
    >
      <JsonLd data={SITE_GRAPH} />
      <a className="axis-skip" href="#marketing-content">
        {locale === 'th' ? 'ข้ามไปเนื้อหา' : 'Skip to content'}
      </a>
      <MarketingNav locale={locale} />
      <MarketingMotion />
      <MarketingPointerEffects />
      <main className="axis-main flex-1" id="marketing-content" tabIndex={-1}>
        {children}
      </main>
      <MarketingScrollIndex locale={locale} />
      <MarketingFooter locale={locale} />
      {process.env.NODE_ENV === 'production' ? <GoogleAnalyticsInit locale={locale} /> : null}
    </div>
  );
}
