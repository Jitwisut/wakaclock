import { FaqSection } from '@/components/marketing/faq-section';
import {
  Breadcrumbs,
  Bullets,
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
import { SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy and Data Collection',
  description:
    `Exactly what a ${SITE_NAME} heartbeat contains, what is never collected, where the data is ` +
    'stored, and how to delete it. Self-hosted, so activity data stays on infrastructure you run.',
  alternates: { canonical: '/privacy' },
  openGraph: { url: '/privacy', title: `Privacy and Data Collection | ${SITE_NAME}` },
};

const BREADCRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Privacy', path: '/privacy' },
];

const COLLECTED = [
  'The path of the file being edited, and whether the activity was a save',
  'Project name and Git branch',
  'Detected programming language, plus the AST-detected language and a confidence score',
  'Editor, operating system and machine name',
  'Line count of the file, current line number and cursor position',
  'Keystrokes, characters added and characters deleted',
  'Category of activity, such as coding, debugging or building',
  'Whether the heartbeat was AI-generated, the agent name, and AI lines added and deleted',
  'Names of detected dependencies',
  'Timestamps',
];

const NOT_COLLECTED = [
  'The contents of your source files',
  'Prompts sent to AI tools, or responses returned by them',
  'Commit contents, diffs, or the code itself in any form',
  'Passwords, environment variables or secrets from your files',
  'Screenshots or screen recordings',
  'Keystroke content — only how many keys were pressed, never which ones',
];

const FAQ: readonly FaqEntry[] = [
  {
    question: `Where is ${SITE_NAME} data stored?`,
    answer:
      `${SITE_NAME} is self-hosted. Heartbeats are written to a ClickHouse database running on ` +
      'infrastructure you control. There is no central service operated by us that receives your ' +
      'coding activity.',
  },
  {
    question: `Does ${SITE_NAME} record my source code?`,
    answer:
      'No. A heartbeat carries metadata about a file — path, project, branch, language, line and ' +
      'character counts — but the heartbeat schema has no field capable of holding file contents.',
  },
  {
    question: 'Does it record what I type?',
    answer:
      'No. Keystrokes are recorded as a count, not as content. The number of keys pressed and ' +
      'characters added or deleted is stored; which keys or characters they were is not.',
  },
  {
    question: 'Are file paths sensitive?',
    answer:
      'They can be. A heartbeat includes the path of the file you are editing, which may reveal ' +
      'project structure, client names or internal repository names. Because you host the database ' +
      'yourself, that information stays within your own environment.',
  },
  {
    question: 'Can I delete my tracking data?',
    answer:
      'Yes. You own the database, so activity data can be deleted directly with SQL against your ' +
      'own ClickHouse instance, at whatever granularity you need.',
  },
  {
    question: 'Is my dashboard visible to search engines?',
    answer:
      'No. All dashboard, account and authentication routes are excluded from the sitemap, blocked ' +
      'in robots.txt, and marked noindex, so no personal activity data is exposed to crawlers.',
  },
];

export default function PrivacyPage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(BREADCRUMBS), faqSchema(FAQ))} />

      <PageShell>
        <Breadcrumbs entries={BREADCRUMBS} />
        <PageTitle>Privacy and data collection</PageTitle>

        <LeadAnswer>
          {SITE_NAME} is self-hosted, so your coding activity is written to a database you run
          and never reaches a service operated by us. A heartbeat records metadata about the file
          you are editing — path, project, branch, language and counts — and never the contents
          of that file, the code itself, or anything you typed.
        </LeadAnswer>

        <Section heading="What is collected" id="collected">
          <p style={MUTED_TEXT}>
            Each heartbeat can carry the following fields. This list is the heartbeat schema
            itself, not a summary of it:
          </p>
          <Bullets items={COLLECTED} />
        </Section>

        <Section heading="What is never collected" id="not-collected">
          <p style={MUTED_TEXT}>
            There is no field in the schema in which any of these could be stored, so this is a
            structural guarantee rather than a policy promise:
          </p>
          <Bullets items={NOT_COLLECTED} />
        </Section>

        <Section heading="AI-related data" id="ai-data">
          <p style={MUTED_TEXT}>
            When a heartbeat is marked as AI-generated, four things are stored: the flag itself,
            the agent name as a free-form string, and counts of AI lines added and deleted. No
            conversation content is involved at any point — there is no field for prompt text,
            response text or token usage in the live heartbeat pipeline.
          </p>
          <Subheading>One thing worth knowing</Subheading>
          <p style={MUTED_TEXT}>
            The agent name is whatever the client sends. If you build tooling that reports AI
            activity, avoid putting anything sensitive in that string — it is stored verbatim and
            displayed in the dashboard.
          </p>
        </Section>

        <Section heading="Where the data lives" id="where">
          <p style={MUTED_TEXT}>
            Activity is stored in ClickHouse on your infrastructure. The editor extension talks to
            a local CLI binary, which sends heartbeats to the server address in your own config
            file. Your API key is held in your editor&apos;s secret storage rather than in a
            settings file.
          </p>
        </Section>

        <Section heading="Retention and deletion" id="retention">
          <p style={MUTED_TEXT}>
            {SITE_NAME} does not impose a retention policy — data is kept until you remove it.
            Since the database is yours, deletion is a SQL statement you run against your own
            instance, and you can scope it to a project, a date range or everything.
          </p>
        </Section>

        <RelatedLinks
          links={[
            {
              href: '/ai-coding-tracker',
              label: 'AI coding activity tracking',
              description: 'How AI attribution works and which fields it populates',
            },
            {
              href: '/developer-analytics',
              label: 'Developer analytics metrics',
              description: 'What is derived from the data described on this page',
            },
          ]}
        />
      </PageShell>

      <FaqSection entries={FAQ} heading="Privacy FAQ" />
    </>
  );
}
