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
import { PRICING, SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    `${SITE_NAME} costs $${PRICING.monthlyUsd} per month or $${PRICING.annualUsd} per year after a ` +
    `${PRICING.trialDays}-day trial. One plan, every feature included, hosted on your own ` +
    'infrastructure.',
  alternates: { canonical: '/pricing' },
  openGraph: { url: '/pricing', title: `Pricing | ${SITE_NAME}` },
};

const BREADCRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Pricing', path: '/pricing' },
];

const FAQ: readonly FaqEntry[] = [
  {
    question: `How much does ${SITE_NAME} cost?`,
    answer:
      `${SITE_NAME} costs $${PRICING.monthlyUsd} per month, or $${PRICING.annualUsd} per year if ` +
      `billed annually. Every account includes the full product — there are no feature-gated ` +
      'tiers and no per-project or per-heartbeat limits.',
  },
  {
    question: `Is ${SITE_NAME} free?`,
    answer:
      `No. There is a ${PRICING.trialDays}-day trial, after which ${SITE_NAME} is a paid product. ` +
      'You host it yourself, so you also cover the cost of the infrastructure it runs on.',
  },
  {
    question: `Is ${SITE_NAME} open source?`,
    answer:
      `No. ${SITE_NAME} is a commercial, proprietary product. Self-hosting means the software runs ` +
      'on infrastructure you control and the data stays there; it does not mean the source code is ' +
      'publicly licensed.',
  },
  {
    question: 'What does self-hosted mean for cost?',
    answer:
      'You run the server, the ClickHouse database and the cache yourself, so hosting costs are ' +
      'yours and depend on your provider and the volume of activity you record. The subscription ' +
      'covers the software, not the infrastructure.',
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
          {SITE_NAME} costs ${PRICING.monthlyUsd} per month or ${PRICING.annualUsd} per year,
          following a {PRICING.trialDays}-day trial. There is a single plan: every account gets
          the complete product, with no feature gating and no limit on projects or heartbeats.
          Because {SITE_NAME} is self-hosted, infrastructure costs are separate and yours.
        </LeadAnswer>
      </PageShell>

      <PricingSection />

      <PageShell>
        <Section heading="What the subscription covers" id="covers">
          <p style={MUTED_TEXT}>
            The subscription licenses the {SITE_NAME} software — the server, the dashboard, the
            CLI and the VS Code extension. It does not include hosting: you provide the machine,
            the ClickHouse database and the cache, so your total cost depends on your provider
            and how much activity you record.
          </p>
        </Section>

        <Section heading="Licensing" id="licensing">
          <p style={MUTED_TEXT}>
            {SITE_NAME} is a commercial, proprietary product published by StandUpCode / Lodash
            (Thailand) Co., Ltd. Self-hosting refers to where the software runs and where your
            data lives — it is not a statement about the source code being openly licensed.
          </p>
        </Section>

        <RelatedLinks
          links={[
            {
              href: '/docs/getting-started',
              label: `Install ${SITE_NAME}`,
              description: 'What you need to run before the trial is useful',
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
