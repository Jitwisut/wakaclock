import { EN_HOME, TH_HOME } from '@/components/marketing/marketing-copy';
import {
  absoluteUrl,
  ORGANIZATION,
  SITE_MODIFIED,
  SITE_NAME,
} from '@/lib/seo/site';

export const dynamic = 'force-static';

export function GET(): Response {
  return Response.json(
    {
      schemaVersion: 1,
      name: SITE_NAME,
      canonicalUrl: absoluteUrl('/'),
      publisher: ORGANIZATION.legalName,
      lastModified: SITE_MODIFIED,
      languages: {
        en: {
          summary: EN_HOME.heroLead,
          capabilities: EN_HOME.keyTakeaways.slice(0, 4),
          limitations: EN_HOME.limitations,
          verdict: EN_HOME.verdict,
        },
        th: {
          summary: TH_HOME.heroLead,
          capabilities: TH_HOME.keyTakeaways.slice(0, 4),
          limitations: TH_HOME.limitations,
          verdict: TH_HOME.verdict,
        },
      },
      evidence: EN_HOME.sources.items.map(({ claim, href }) => ({ claim, url: href })),
    },
    { headers: { 'Cache-Control': 'public, max-age=3600' } }
  );
}
