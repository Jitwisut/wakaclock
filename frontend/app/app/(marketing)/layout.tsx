import { IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google';

import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { JsonLd } from '@/components/seo/json-ld';
import { graph, organizationSchema, softwareApplicationSchema, websiteSchema } from '@/lib/seo/schema';
import { cn } from '@/lib/utils';

import './marketing.css';

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

/**
 * Organization, WebSite and SoftwareApplication describe the site as a whole, so
 * they are emitted once here rather than repeated per page. Page-specific nodes
 * (FAQPage, BreadcrumbList) are added by the individual pages.
 */
const SITE_GRAPH = graph(organizationSchema(), websiteSchema(), softwareApplicationSchema());

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'wakaclock-marketing flex min-h-screen flex-col',
        jetbrainsMono.variable,
        ibmPlexSans.variable
      )}
      style={{ fontFamily: 'var(--font-mkt-sans), sans-serif' }}
    >
      <JsonLd data={SITE_GRAPH} />
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
