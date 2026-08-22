import { EarlyAccessForm } from '@/components/marketing/early-access-form';
import { Breadcrumbs, LeadAnswer, MUTED_TEXT, PageShell, PageTitle, Section } from '@/components/marketing/prose';
import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbSchema, graph } from '@/lib/seo/schema';
import { createMarketingMetadata, ORGANIZATION, SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

const PATH = '/contact';

export const metadata: Metadata = createMarketingMetadata({
  title: `Contact ${SITE_NAME}`,
  description:
    'Contact AtoAxis about Early Access, developer time tracking, integrations, privacy, team coding presence or product questions from developers.',
  path: PATH,
});

export default function ContactPage() {
  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Contact', path: PATH },
  ];

  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(breadcrumbs))} />
      <PageShell>
        <Breadcrumbs entries={breadcrumbs} />
        <PageTitle>Contact {SITE_NAME}</PageTitle>
        <LeadAnswer>
          Contact the {SITE_NAME} team about Early Access, hosted developer analytics, editor
          integrations, privacy or the team presence prototype.
        </LeadAnswer>

        <Section heading="Email" id="email">
          <p style={MUTED_TEXT}>
            Product and privacy questions can be sent to{' '}
            <a className="underline underline-offset-4" href={`mailto:${ORGANIZATION.email}`}>
              {ORGANIZATION.email}
            </a>
            .
          </p>
        </Section>
      </PageShell>
      <EarlyAccessForm sourcePage="contact" />
    </>
  );
}
