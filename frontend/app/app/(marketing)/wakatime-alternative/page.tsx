import { ComparisonSection } from '@/components/marketing/comparison-section';
import { FaqSection } from '@/components/marketing/faq-section';
import {
  Breadcrumbs,
  Bullets,
  CodeBlock,
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
  title: `WakaTime Alternative for Developer Time Tracking`,
  description:
    `${SITE_NAME} is a self-hosted alternative to WakaTime that implements the WakaTime API. ` +
    'Keep your existing editor plugin, host the server yourself, and import your WakaTime export.',
  alternates: { canonical: '/wakatime-alternative' },
  openGraph: {
    url: '/wakatime-alternative',
    title: `WakaTime Alternative for Developer Time Tracking | ${SITE_NAME}`,
  },
};

const BREADCRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'WakaTime alternative', path: '/wakatime-alternative' },
];

const FAQ: readonly FaqEntry[] = [
  {
    question: `Is ${SITE_NAME} an alternative to WakaTime?`,
    answer:
      `${SITE_NAME} is a developer time tracking service that can serve as an alternative for ` +
      'developers evaluating coding-time and productivity tracking. It implements the WakaTime ' +
      'API and can import a WakaTime data export. Whether it fits depends on the editors, ' +
      'integrations and reports you rely on.',
  },
  {
    question: 'Do I have to replace my editor plugin?',
    answer:
      'No. Any editor with a WakaTime plugin can send data by changing api_url in ~/.wakatime.cfg ' +
      `to your ${SITE_NAME} server and using an API key generated there. A dedicated VS Code ` +
      `extension is also available if you prefer a ${SITE_NAME}-native client.`,
  },
  {
    question: 'Can I bring my existing WakaTime history with me?',
    answer:
      `Yes. ${SITE_NAME} exposes an import endpoint that accepts a WakaTime data export, so your ` +
      'historical heartbeats are reprocessed into the same dashboards as new activity. Imported ' +
      'heartbeats that carry a WakaTime AI category are recorded as AI-attributed.',
  },
  {
    question: `Is ${SITE_NAME} free or open source?`,
    answer:
      `No. ${SITE_NAME} is a commercial, proprietary product. It costs $${PRICING.monthlyUsd} per ` +
      `month or $${PRICING.annualUsd} per year after a ${PRICING.trialDays}-day trial. You host it ` +
      'on your own infrastructure, but the source is not publicly licensed.',
  },
  {
    question: `What does ${SITE_NAME} not do that I should know about?`,
    answer:
      'The only editor plugin published by us is for VS Code, so other editors connect through the ' +
      'WakaTime protocol. There is no desktop or browser client, no team or organisation ' +
      'dashboard, and AI attribution fields are accepted by the API but not filled in automatically ' +
      'by any shipped client.',
  },
];

const REASONS = [
  'They want the data on infrastructure they control rather than a third-party service',
  'They want to query the underlying database directly instead of only through a dashboard UI',
  'They want language detection that parses the file rather than guessing from the extension',
  'They want keystroke and character counts alongside elapsed time',
  'They want a place to record AI-attributed work next to human-written work',
];

export default function WakaTimeAlternativePage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(BREADCRUMBS), faqSchema(FAQ))} />

      <PageShell>
        <Breadcrumbs entries={BREADCRUMBS} />
        <PageTitle>A self-hosted WakaTime alternative</PageTitle>

        <LeadAnswer>
          {SITE_NAME} is a self-hosted developer time tracking service that implements the
          WakaTime API. Editors that already have a WakaTime plugin can send their heartbeats
          to your {SITE_NAME} server by changing one config value, and an existing WakaTime
          data export can be imported. Your coding activity is stored in a ClickHouse database
          you run and can query yourself.
        </LeadAnswer>

        <Section heading={`What is ${SITE_NAME}?`} id="what-is">
          <p style={MUTED_TEXT}>
            {SITE_NAME} records how long you spend coding and breaks that time down by project,
            programming language, branch, editor and operating system. Your editor sends a
            heartbeat whenever you type in, switch to, or save a file; the server groups
            consecutive heartbeats into duration blocks and reports those blocks as coding
            time. It also records keystroke and character counts, and accepts AI attribution
            fields so AI-written lines can be counted separately from human keystrokes.
          </p>
        </Section>

        <Section heading="Why developers look for WakaTime alternatives" id="why">
          <p style={MUTED_TEXT}>
            The reasons we hear most often are about ownership and granularity rather than
            dissatisfaction with tracking itself:
          </p>
          <Bullets items={REASONS} />
        </Section>

        <Section heading="Switching is a config change" id="switching">
          <p style={MUTED_TEXT}>
            Because the heartbeat API is WakaTime-compatible, an editor that already reports to
            WakaTime can report to {SITE_NAME} instead by pointing at a different host:
          </p>
          <CodeBlock label="~/.wakatime.cfg">{`[settings]
api_url = https://your-azyren.example.com/api/v1
api_key = your_generated_api_key`}</CodeBlock>
          <p style={MUTED_TEXT}>
            Generate the API key from your {SITE_NAME} settings page. Editors connected this way
            are supported through the protocol — we publish a plugin only for VS Code.
          </p>
        </Section>

        <Section heading="Honest comparison" id="comparison">
          <p style={MUTED_TEXT}>
            The table below describes {SITE_NAME} capabilities verified against its own source
            code. Cells marked with a dash mean WakaTime does not publicly document that
            capability at the time of writing — they are not claims that the feature is absent,
            and WakaTime&apos;s product may have changed since. Check WakaTime&apos;s own
            documentation before making a decision on those rows.
          </p>
        </Section>
      </PageShell>

      <ComparisonSection />

      <PageShell>
        <Section heading={`Who ${SITE_NAME} is for`} id="who-for">
          <p style={MUTED_TEXT}>
            Individual developers who want visibility into where their development time goes and
            are willing to run a server to keep that data in their own environment. It suits
            people already comfortable with Docker and a database. It is not currently a fit for
            engineering managers looking for team-wide reporting, because analytics are scoped to
            a single account.
          </p>
        </Section>

        <Section heading="Getting started" id="getting-started">
          <p style={MUTED_TEXT}>
            Deploy the server, create an account, generate an API key, then either install the VS
            Code extension or repoint your existing WakaTime plugin. The full sequence, including
            requirements and how to verify that tracking works, is on the installation page.
          </p>
        </Section>

        <RelatedLinks
          links={[
            {
              href: '/docs/getting-started',
              label: `Install ${SITE_NAME}`,
              description: 'Requirements, server setup, connecting an editor, and verifying tracking',
            },
            {
              href: '/integrations/vscode',
              label: 'VS Code time tracking',
              description: 'What the VS Code extension records, its settings, and its limits',
            },
            {
              href: '/ai-coding-tracker',
              label: 'AI coding activity tracking',
              description: 'How AI-attributed work is recorded, and what does not happen automatically',
            },
            {
              href: '/pricing',
              label: `${SITE_NAME} pricing`,
              description: 'Monthly and annual cost, trial length, and what every account includes',
            },
          ]}
        />
      </PageShell>

      <FaqSection entries={FAQ} heading="WakaTime alternative FAQ" />
    </>
  );
}
