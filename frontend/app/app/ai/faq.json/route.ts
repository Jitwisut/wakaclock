import { EN_HOME, TH_HOME } from '@/components/marketing/marketing-copy';
import { absoluteUrl, SITE_MODIFIED, SITE_NAME } from '@/lib/seo/site';

export const dynamic = 'force-static';

export function GET(): Response {
  return Response.json(
    {
      schemaVersion: 1,
      name: `${SITE_NAME} FAQ`,
      canonicalUrl: absoluteUrl('/#faq'),
      lastModified: SITE_MODIFIED,
      languages: {
        en: EN_HOME.faq,
        th: TH_HOME.faq,
      },
    },
    { headers: { 'Cache-Control': 'public, max-age=3600' } }
  );
}
