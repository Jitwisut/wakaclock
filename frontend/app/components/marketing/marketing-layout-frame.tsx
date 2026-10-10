import localFont from 'next/font/local';

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

/** Thai text uses the same local asset and a system fallback for missing glyphs. */
const thaiSans = localFont({
  src: '../../public/fonts/atoaxis-sans.woff2',
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
