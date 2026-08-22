import { Breadcrumbs, LeadAnswer, MUTED_TEXT, PageShell, PageTitle, Section } from '@/components/marketing/prose';
import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbSchema, graph } from '@/lib/seo/schema';
import { createMarketingMetadata, ORGANIZATION, SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

const PATH = '/terms';

export const metadata: Metadata = createMarketingMetadata({
  title: `${SITE_NAME} Terms`,
  description:
    'Read the Early Access terms for AtoAxis, including hosted service status, acceptable use, privacy and launch expectations before paid checkout opens.',
  path: PATH,
});

export default function TermsPage() {
  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Terms', path: PATH },
  ];

  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(breadcrumbs))} />
      <PageShell>
        <Breadcrumbs entries={breadcrumbs} />
        <PageTitle>{SITE_NAME} terms</PageTitle>
        <LeadAnswer>
          These preliminary terms describe the {SITE_NAME} Early Access website and product
          evaluation. Paid checkout and the final subscription agreement will be published before
          commercial launch.
        </LeadAnswer>

        <Section heading="Early Access" id="early-access">
          <p style={MUTED_TEXT}>
            Joining the Early Access list does not create a paid subscription. Access may be
            invited, limited or changed while the product is being prepared. No payment is taken
            through this website during Early Access.
          </p>
        </Section>

        <Section heading="Hosted service and data" id="data">
          <p style={MUTED_TEXT}>
            {SITE_NAME} is planned as a hosted service operated by {ORGANIZATION.name}. The data
            collected by editor heartbeats is described on the privacy page. Source code, prompts
            and AI responses are not heartbeat fields.
          </p>
        </Section>

        <Section heading="Acceptable use" id="acceptable-use">
          <p style={MUTED_TEXT}>
            Do not abuse the website, submit another person&apos;s email without permission, attempt
            to bypass access controls or use the service to violate applicable law. These terms are
            subject to the final commercial agreement published at launch.
          </p>
        </Section>

        <Section heading="Questions" id="questions">
          <p style={MUTED_TEXT}>
            Contact <a className="underline underline-offset-4" href={`mailto:${ORGANIZATION.email}`}>
              {ORGANIZATION.email}
            </a>{' '}
            with questions about these terms.
          </p>
        </Section>
      </PageShell>
    </>
  );
}
