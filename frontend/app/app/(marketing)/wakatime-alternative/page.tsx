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
import { createMarketingMetadata, PRICING, SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

export const metadata: Metadata = createMarketingMetadata({
  title: 'WakaTime Alternative for Developer Time Tracking',
  description:
    'AtoAxis is a hosted WakaTime alternative with API compatibility, complete coding history, import support, project analytics and no plugin replacement required.',
  path: '/wakatime-alternative',
});

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
      `to the ${SITE_NAME} API and using an API key generated in your account. A dedicated VS Code ` +
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
      `Checkout is not open yet. ${SITE_NAME} is planned as a commercial hosted product at ` +
      `$${PRICING.monthlyUsd}/month or $${PRICING.annualUsd}/year. WakaTime does have a free ` +
      'plan, though its dashboard history is limited.',
  },
  {
    question: `What does ${SITE_NAME} not do that I should know about?`,
    answer:
      'The only editor plugin published by us is for VS Code, so other editors connect through the ' +
      'WakaTime protocol. There is no desktop or browser client, no team or organisation ' +
      'dashboard. The VS Code extension can configure Claude Code, Codex CLI and Gemini CLI hooks; ' +
      'Cursor and Copilot still need provider-specific adapters.',
  },
];

const REASONS = [
  'They want their complete coding history without paying for the top tier to see it',
  'They want one plan with everything included rather than choosing between feature tiers',
  'They want language detection that parses the file rather than guessing from the extension',
  'They want keystroke and character counts alongside elapsed time',
];

/**
 * Stated up front rather than buried. WakaTime is genuinely ahead on these, and a
 * comparison page that hides them is not a comparison page.
 */
const STAY_WITH_WAKATIME = [
  'You want automatic AI tracking for Cursor or Copilot today — AtoAxis currently supports Claude Code, Codex CLI and Gemini CLI',
  'You want AI token usage or estimated cost per model — AtoAxis does not track either',
  'You need team or organisation dashboards — AtoAxis analytics are scoped to one account',
  'You need a free tier today — AtoAxis is still in Early Access',
  'You want the widest editor plugin coverage — WakaTime publishes 80+ official plugins',
];

export default function WakaTimeAlternativePage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(BREADCRUMBS), faqSchema(FAQ))} />

      <PageShell>
        <Breadcrumbs entries={BREADCRUMBS} />
        <PageTitle>A WakaTime alternative with your full history</PageTitle>

        <LeadAnswer>
          {SITE_NAME} is a developer time tracking service that implements the WakaTime API.
          An editor that already has a WakaTime plugin can send its heartbeats to {SITE_NAME} by
          changing one config value, and an existing WakaTime data export can be imported. Every
          account includes your complete coding history rather than a limited recent window.
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
            The reasons we hear most often are about history retention and pricing rather than
            dissatisfaction with tracking itself:
          </p>
          <Bullets items={REASONS} />
        </Section>

        <Section heading="When you should stay with WakaTime" id="stay-with-wakatime">
          <p style={MUTED_TEXT}>
            There are real cases where switching would be a downgrade. WakaTime is the better
            product if any of these apply to you:
          </p>
          <Bullets items={STAY_WITH_WAKATIME} />
          <p style={MUTED_TEXT}>
            Verified against wakatime.com in August 2026. WakaTime ships quickly, so check their
            current documentation before deciding.
          </p>
        </Section>

        <Section heading="Switching is a config change" id="switching">
          <p style={MUTED_TEXT}>
            Because the heartbeat API is WakaTime-compatible, an editor that already reports to
            WakaTime can report to {SITE_NAME} instead by pointing at a different host:
          </p>
          <CodeBlock label="~/.wakatime.cfg">{`[settings]
api_url = https://api.atoaxis.com/api/v1
api_key = your_generated_api_key`}</CodeBlock>
          <p style={MUTED_TEXT}>
            Generate the API key from your {SITE_NAME} settings page. Editors connected this way
            are supported through the protocol — we publish a plugin only for VS Code.
          </p>
        </Section>

        <Section heading="Honest comparison" id="comparison">
          <p style={MUTED_TEXT}>
            {SITE_NAME} capabilities below were verified against its own source code, and every
            WakaTime cell against wakatime.com in August 2026. Rows where WakaTime wins are
            included rather than omitted. Both products change, so treat this as a snapshot and
            confirm anything decisive against WakaTime&apos;s current documentation.
          </p>
        </Section>
      </PageShell>

      <ComparisonSection />

      <PageShell>
        <Section heading={`Who ${SITE_NAME} is for`} id="who-for">
          <p style={MUTED_TEXT}>
            Individual developers who want visibility into where their development time goes and
            are comfortable joining Early Access before checkout opens. It is not currently a fit
            for engineering managers looking for team-wide reporting, because analytics are scoped
            to a single account.
          </p>
        </Section>

        <Section heading="Getting started" id="getting-started">
          <p style={MUTED_TEXT}>
            Join Early Access first. When access opens, the sequence will be to create an account,
            generate an API key, then install the VS Code extension or repoint an existing WakaTime
            plugin. The connection steps are documented for evaluation.
          </p>
        </Section>

        <RelatedLinks
          links={[
            {
              href: '/early-access',
              label: `Join ${SITE_NAME} early access`,
              description: 'Hosted launch requirements, editor connection and launch updates',
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
              description: 'Planned monthly and annual pricing before checkout opens',
            },
          ]}
        />
      </PageShell>

      <FaqSection entries={FAQ} heading="WakaTime alternative FAQ" />
    </>
  );
}
