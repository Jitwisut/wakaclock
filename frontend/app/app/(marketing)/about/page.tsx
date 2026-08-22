import { Breadcrumbs, LeadAnswer, MUTED_TEXT, PageShell, PageTitle, Section } from '@/components/marketing/prose';
import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbSchema, graph, organizationSchema } from '@/lib/seo/schema';
import { createMarketingMetadata, ORGANIZATION, SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

const PATH = '/about';

export const metadata: Metadata = createMarketingMetadata({
  title: `About ${SITE_NAME}`,
  description:
    'Learn who publishes AtoAxis, why it exists, and how its developer time tracking product with WakaTime-compatible editor integration is being prepared for Early Access.',
  path: PATH,
});

export default function AboutPage() {
  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'About', path: PATH },
  ];

  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(breadcrumbs), organizationSchema())} />
      <PageShell>
        <Breadcrumbs entries={breadcrumbs} />
        <PageTitle>About {SITE_NAME}</PageTitle>
        <LeadAnswer>
          {SITE_NAME} is a developer time tracking service published by {ORGANIZATION.name}. It
          turns editor heartbeats into coding-time and project analytics while keeping source code,
          prompts and AI responses out of the heartbeat data.
        </LeadAnswer>

        <Section heading="Why we are building it" id="why">
          <p style={MUTED_TEXT}>
            Developers should be able to understand where their coding time goes without losing
            their historical data to a short reporting window. {SITE_NAME} is designed around
            complete history, transparent heartbeat fields and compatibility with the WakaTime API.
          </p>
        </Section>

        <Section heading="Current status" id="status">
          <p style={MUTED_TEXT}>
            Individual coding analytics and the VS Code integration are the current product focus.
            Team presence is an Early Access prototype, not a production team dashboard. Checkout
            is not open yet; visitors can join the Early Access list to receive launch updates.
          </p>
        </Section>

        <Section heading="Publisher" id="publisher">
          <p style={MUTED_TEXT}>
            {ORGANIZATION.name} publishes {SITE_NAME}. For product questions, contact{' '}
            <a className="underline underline-offset-4" href={`mailto:${ORGANIZATION.email}`}>
              {ORGANIZATION.email}
            </a>
            .
          </p>
        </Section>
      </PageShell>
    </>
  );
}
