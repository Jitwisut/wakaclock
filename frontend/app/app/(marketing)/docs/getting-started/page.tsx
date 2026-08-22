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
  Subheading,
} from '@/components/marketing/prose';
import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbSchema, type FaqEntry, faqSchema, graph } from '@/lib/seo/schema';
import { createMarketingMetadata, PRICING, SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

/** Declared once so the canonical, OG URL and breadcrumb entries cannot drift apart. */
const CANONICAL = '/docs/getting-started';

export const metadata: Metadata = createMarketingMetadata({
  title: 'Getting Started — Hosted Setup',
  description:
    'Learn how AtoAxis will connect VS Code or an existing WakaTime plugin to its hosted API when Early Access opens, without running your own server.',
  path: CANONICAL,
});

const BREADCRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Docs', path: '/docs' },
  { name: 'Getting started', path: CANONICAL },
];

const FAQ: readonly FaqEntry[] = [
  {
    question: `How do I install ${SITE_NAME}?`,
    answer:
      'Create an account, generate an API key from your settings page, then connect your editor: ' +
      'either install the VS Code extension and run its "Set API Key" command, or set api_url and ' +
      'api_key in ~/.wakatime.cfg if you already use a WakaTime plugin. Coding time appears in ' +
      'your dashboard within about a minute.',
  },
  {
    question: 'Do I need to run a server myself?',
    answer:
      `No. ${SITE_NAME} is a hosted service — there is nothing to deploy, no database to run and ` +
      'no infrastructure to maintain. You install an editor plugin and sign in.',
  },
  {
    question: 'What do I need before starting?',
    answer:
      `An ${SITE_NAME} account and an editor. VS Code 1.90 or newer is required for the official ` +
      'extension; any other editor with a WakaTime plugin can connect through configuration alone.',
  },
  {
    question: 'How do I check that tracking is working?',
    answer:
      'Edit and save a file, wait about 30 seconds for the flush interval, then open your ' +
      "dashboard — today's total should increase. If the status bar is enabled in VS Code, the " +
      'same figure appears there.',
  },
  {
    question: 'Do I need the extension if I already use WakaTime?',
    answer:
      `No. Set api_url in ~/.wakatime.cfg to the ${SITE_NAME} API and use an API key generated in ` +
      'your account. Your existing plugin sends heartbeats without any further changes.',
  },
  {
    question: 'Can I try it today?',
    answer:
      `${SITE_NAME} is in Early Access, so checkout and the final trial terms are not open yet. ` +
      `Planned launch pricing is $${PRICING.monthlyUsd}/month or $${PRICING.annualUsd}/year; ` +
      'join the Early Access list for updates.',
  },
];

export default function GettingStartedPage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(BREADCRUMBS), faqSchema(FAQ))} />

      <PageShell>
        <Breadcrumbs entries={BREADCRUMBS} />
        <PageTitle>Getting started</PageTitle>

        <LeadAnswer>
          When Early Access opens, start tracking with {SITE_NAME} by creating an account,
          generating an API key, then connecting your editor — either install the VS Code
          extension and run its <code>Set API Key</code> command, or point an existing WakaTime
          plugin at the {SITE_NAME} API. There is no server to deploy.
        </LeadAnswer>

        <Section heading="What you need" id="requirements">
          <Bullets
            items={[
              `An ${SITE_NAME} account — Early Access signup is currently required`,
              'VS Code 1.90 or newer, if you want the official extension',
              'Or any editor with a WakaTime plugin already installed',
            ]}
          />
          <p style={MUTED_TEXT}>
            Nothing else. {SITE_NAME} runs the API, database and dashboard — customers do not
            install or maintain infrastructure.
          </p>
        </Section>

        <Section heading="1. When access opens: create an account and generate an API key" id="api-key">
          <p style={MUTED_TEXT}>
            When access opens, create an account, open your settings page and generate an API key.
            Treat it like a password: it authorises writing activity to your account.
          </p>
        </Section>

        <Section heading="2. Connect your editor" id="connect-editor">
          <Subheading>Option A — the VS Code extension</Subheading>
          <p style={MUTED_TEXT}>
            Install the extension from the Marketplace, then set your key through the command
            palette so it is stored in VS Code secret storage rather than in a settings file:
          </p>
          <CodeBlock label="Command Palette">&gt; Wakaclock: Set API Key</CodeBlock>
          <p style={MUTED_TEXT}>
            The extension commands and settings still use the original <code>wakaclock</code>{' '}
            naming. They are written here exactly as they appear in VS Code.
          </p>

          <Subheading>Option B — an existing WakaTime plugin</Subheading>
          <p style={MUTED_TEXT}>
            Already tracking with WakaTime in Neovim, a JetBrains IDE, Xcode or anything else?
            Change one value and your existing plugin reports to {SITE_NAME} instead — no new
            extension required:
          </p>
          <CodeBlock label="~/.wakatime.cfg">{`[settings]
api_url = https://api.atoaxis.com/api/v1
api_key = your_generated_api_key`}</CodeBlock>
        </Section>

        <Section heading="3. Verify tracking" id="verify">
          <p style={MUTED_TEXT}>
            Edit and save a file, then wait for the flush interval — 30 seconds by default. Open
            your dashboard and today&apos;s total should have increased. In VS Code, the same
            figure appears in the status bar when it is enabled.
          </p>
        </Section>

        <Section heading="Troubleshooting" id="troubleshooting">
          <Subheading>Nothing appears in the dashboard</Subheading>
          <p style={MUTED_TEXT}>
            Check that your API key was saved — run <code>Wakaclock: Set API Key</code> again to
            confirm. Enable <code>wakaclock.debugLogging</code> to see what the extension is doing
            in the extension host console.
          </p>

          <Subheading>Tracking stops after a few minutes</Subheading>
          <p style={MUTED_TEXT}>
            That is the idle threshold working as intended — background heartbeats stop after 5
            minutes without activity, so time away from the keyboard is not counted. Raise{' '}
            <code>wakaclock.idleMinutes</code> if you want a longer window.
          </p>

          <Subheading>Time is attributed to the wrong project</Subheading>
          <p style={MUTED_TEXT}>
            Project detection follows your Git repository. If you work across several checkouts of
            the same project, use project rules and merges in settings to group them under one
            name — those are applied on the server, so every editor stays consistent.
          </p>
        </Section>

        <RelatedLinks
          links={[
            {
              href: '/integrations/vscode',
              label: 'VS Code extension reference',
              description: 'Every setting and command, and what the extension does not track',
            },
            {
              href: '/privacy',
              label: 'What data a heartbeat contains',
              description: 'The full field list, and what is never collected',
            },
            {
              href: '/wakatime-alternative',
              label: 'Migrating from WakaTime',
              description: 'Repointing an existing plugin and importing your data export',
            },
          ]}
        />
      </PageShell>

      <FaqSection entries={FAQ} heading="Installation FAQ" />
    </>
  );
}
