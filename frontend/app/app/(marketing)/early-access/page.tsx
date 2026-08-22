import { EarlyAccessForm } from '@/components/marketing/early-access-form';
import { Breadcrumbs, LeadAnswer, PageShell, PageTitle } from '@/components/marketing/prose';
import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbSchema, graph } from '@/lib/seo/schema';
import { createMarketingMetadata, SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

const PATH = '/early-access';

export const metadata: Metadata = createMarketingMetadata({
  title: `${SITE_NAME} Early Access`,
  description:
    'Join the AtoAxis Early Access list for hosted developer time tracking, complete coding history, team presence updates and future integration news.',
  path: PATH,
});

export default function EarlyAccessPage() {
  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Early Access', path: PATH },
  ];

  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(breadcrumbs))} />
      <PageShell>
        <Breadcrumbs entries={breadcrumbs} />
        <PageTitle>Join {SITE_NAME} Early Access</PageTitle>
        <LeadAnswer>
          Join the list for launch updates about hosted developer time tracking, complete coding
          history, WakaTime-compatible integrations and the team presence prototype.
        </LeadAnswer>
      </PageShell>
      <EarlyAccessForm sourcePage="early-access" />
    </>
  );
}
