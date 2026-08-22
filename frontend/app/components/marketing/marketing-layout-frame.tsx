import { IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google';

import { JsonLd } from '@/components/seo/json-ld';
import GoogleAnalyticsInit from '@/lib/ga';
import { graph, organizationSchema, softwareApplicationSchema, websiteSchema } from '@/lib/seo/schema';
import type { SiteLocale } from '@/lib/seo/site';

import { MarketingFooter } from './marketing-footer';
import { MarketingNav } from './marketing-nav';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mkt-mono',
  display: 'swap',
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mkt-sans',
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
      className={`wakaclock-marketing flex min-h-screen flex-col ${jetbrainsMono.variable} ${ibmPlexSans.variable}`}
      lang={locale}
      style={{ fontFamily: 'var(--font-mkt-sans), sans-serif' }}
    >
      <JsonLd data={SITE_GRAPH} />
      <MarketingNav locale={locale} />
      <main className="flex-1">{children}</main>
      <MarketingFooter locale={locale} />
      {process.env.NODE_ENV === 'production' ? <GoogleAnalyticsInit locale={locale} /> : null}
    </div>
  );
}
