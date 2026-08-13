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
      'There is no free tier. Hosting is included in the price — there is no separate ' +
      'infrastructure cost.',
  },
  {
    question: `Is ${SITE_NAME} open source?`,
    answer:
      `No. ${SITE_NAME} is a commercial, proprietary hosted service. The source code is not ` +
      'publicly licensed, and there is no self-hosted or on-premise edition.',
  },
  {
    question: 'Is hosting included?',
    answer:
      `Yes. ${SITE_NAME} runs the server, the database and the dashboard. There is nothing to ` +
      'deploy and no infrastructure bill on top of the subscription.',
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
          {SITE_NAME} costs ${PRICING.monthlyUsd} per month or ${PRICING.annualUsd} per year,
          following a {PRICING.trialDays}-day trial. There is a single plan: every account gets
          the complete product, your full coding history, and no limit on projects or heartbeats.
          Hosting is included — there is no infrastructure to run or pay for separately.
        </LeadAnswer>
      </PageShell>

      <PricingSection />

      <PageShell>
        <Section heading="What the subscription covers" id="covers">
          <p style={MUTED_TEXT}>
            Everything: the hosted service, your dashboard, the CLI and the VS Code extension,
            plus storage of your complete coding history. There is no separate infrastructure
            bill and no per-project, per-heartbeat or per-editor limit.
          </p>
        </Section>

        <Section heading="Licensing" id="licensing">
          <p style={MUTED_TEXT}>
            {SITE_NAME} is a commercial, proprietary product published by StandUpCode / Lodash
            (Thailand) Co., Ltd. It is a hosted service: there is no self-hosted or on-premise
            edition, and the source code is not publicly licensed.
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
