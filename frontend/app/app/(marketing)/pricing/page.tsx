import { FaqSection } from '@/components/marketing/faq-section';
import { PricingSection } from '@/components/marketing/pricing-section';
import {
  Breadcrumbs,
  LeadAnswer,
  MUTED_TEXT,
  PageShell,
  PageTitle,
  RelatedLinks,
  Section,
} from '@/components/marketing/prose';
import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbSchema, type FaqEntry, faqSchema, graph } from '@/lib/seo/schema';
import { createMarketingMetadata, PRICING, SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

export const metadata: Metadata = createMarketingMetadata({
  title: 'Planned Pricing',
  description:
    'Planned AtoAxis launch pricing: $12/month or $99/year for hosted developer analytics. Join Early Access before checkout opens; nothing is charged now.',
  path: '/pricing',
});

const BREADCRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Pricing', path: '/pricing' },
];

const FAQ: readonly FaqEntry[] = [
  {
    question: `How much does ${SITE_NAME} cost?`,
    answer:
      `${SITE_NAME} plans to launch at $${PRICING.monthlyUsd} per month or $${PRICING.annualUsd} ` +
      'per year. Checkout is not open during Early Access; join the list for launch updates.',
  },
  {
    question: `Is ${SITE_NAME} free?`,
    answer:
      `Checkout is not open yet. ${SITE_NAME} is planned as a paid hosted product with no free ` +
      'tier; join Early Access to receive the launch terms.',
  },
  {
    question: `Is ${SITE_NAME} open source?`,
    answer:
      `No. ${SITE_NAME} is a commercial, proprietary hosted service. The source code is not ` +
      'publicly licensed.',
  },
  {
    question: 'Is hosting included?',
    answer:
      `Yes, the planned product is hosted by ${SITE_NAME}. Customers will not need to run a ` +
      'database or pay a separate infrastructure bill.',
  },
  {
    question: 'What do I get that the WakaTime free plan does not give me?',
    answer:
      'Your complete coding history rather than a one-week dashboard window. WakaTime keeps your ' +
      'stats but requires its $14/month Premium plan to see all of it; complete history is ' +
      `included in the single $${PRICING.monthlyUsd}/month ${SITE_NAME} plan. Verified against ` +
      'wakatime.com in August 2026.',
  },
  {
    question: 'Is there a team plan?',
    answer:
      'Not currently. Analytics are scoped to a single account, and there is no organisation-wide ' +
      'dashboard, so pricing is per individual account.',
  },
];

export default function PricingPage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(BREADCRUMBS), faqSchema(FAQ))} />

      <PageShell>
        <Breadcrumbs entries={BREADCRUMBS} />
        <PageTitle>Pricing</PageTitle>

        <LeadAnswer>
          Planned launch pricing is ${PRICING.monthlyUsd} per month or ${PRICING.annualUsd} per
          year. Checkout is not open during Early Access. The hosted service is designed to
          include complete coding history, analytics and hosting in one plan.
        </LeadAnswer>
      </PageShell>

      <PricingSection />

      <PageShell>
        <Section heading="What the subscription covers" id="covers">
          <p style={MUTED_TEXT}>
            The planned subscription covers the hosted service, dashboard, CLI and VS Code
            extension, plus storage of your complete coding history. Final limits and trial terms
            will be published before checkout opens.
          </p>
        </Section>

        <Section heading="Licensing" id="licensing">
          <p style={MUTED_TEXT}>
            {SITE_NAME} is a commercial, proprietary product published by StandUpCode / Lodash
            (Thailand) Co., Ltd. It is a hosted service operated by the publisher, and the source
            code is not publicly licensed.
          </p>
        </Section>

        <RelatedLinks
          links={[
            {
              href: '/docs/getting-started',
              label: `Hosted setup for ${SITE_NAME}`,
              description: 'How the hosted Early Access product will connect to your editor',
            },
            {
              href: '/wakatime-alternative',
              label: 'Comparing with WakaTime',
              description: 'How the two differ on hosting, data ownership and metrics',
            },
          ]}
        />
      </PageShell>

      <FaqSection entries={FAQ} heading="Pricing FAQ" />
    </>
  );
}
