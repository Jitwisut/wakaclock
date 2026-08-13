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
import { ORGANIZATION, SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

const CANONICAL = '/privacy';

export const metadata: Metadata = {
  title: 'Privacy and Data Collection',
  description:
    `Exactly what a ${SITE_NAME} heartbeat contains, what is never collected, where the data is ` +
    'stored, and how to delete it. Heartbeats carry file paths and project names but never your ' +
    'source code.',
  alternates: { canonical: CANONICAL },
  openGraph: { url: CANONICAL, title: `Privacy and Data Collection | ${SITE_NAME}` },
};

const BREADCRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Privacy', path: CANONICAL },
];

const COLLECTED = [
  'The path of the file being edited, and whether the activity was a save',
  'Project name and Git branch',
  'Detected programming language, plus the AST-detected language and a confidence score',
  'Editor, operating system and machine name',
  'Line count of the file, current line number and cursor position',
  'Keystrokes, characters added and characters deleted — as counts, never as content',
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
  'Which keys you pressed — only how many',
];

const FAQ: readonly FaqEntry[] = [
  {
    question: `Where is ${SITE_NAME} data stored?`,
    answer:
      `${SITE_NAME} is a hosted service. Your heartbeats are transmitted over HTTPS to servers ` +
      `operated by ${ORGANIZATION.name} and stored in a ClickHouse database we run and secure. ` +
      'Your account is the only one that can read your activity.',
  },
  {
    question: `Does ${SITE_NAME} record my source code?`,
    answer:
      'No. A heartbeat carries metadata about a file — path, project, branch, language, line and ' +
      'character counts — but the heartbeat schema has no field capable of holding file contents. ' +
      'Your code never leaves your machine.',
  },
  {
    question: 'Does it record what I type?',
    answer:
      'No. Keystrokes are recorded as a count, not as content. The number of keys pressed and ' +
      'characters added or deleted is stored; which keys or characters they were is not, and there ' +
      'is no field in which they could be.',
  },
  {
    question: 'Do you receive my file paths and project names?',
    answer:
      'Yes, and this is the most sensitive thing we hold. A heartbeat includes the path of the file ' +
      'you are editing and its project and branch names, which can reveal internal repository ' +
      'names, client names or unreleased project names. If that is unacceptable for your work, ' +
      `${SITE_NAME} is not the right tool for you.`,
  },
  {
    question: 'Can I delete my tracking data?',
    answer:
      'Yes. You can request deletion of your account and its activity data, and we remove it from ' +
      'our systems. Contact us to start that process.',
  },
  {
    question: 'Is my dashboard visible to search engines?',
    answer:
      'No. All dashboard, account and authentication routes are excluded from the sitemap, blocked ' +
      'in robots.txt, and marked noindex, so no personal activity data is exposed to crawlers.',
  },
  {
    question: 'Do you sell or share my data?',
    answer:
      'No. Your coding activity is not sold, and it is not shared with third parties for ' +
      'advertising or profiling.',
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
          {SITE_NAME} is a hosted service, so your coding activity is sent to and stored on
          servers we operate. A heartbeat records metadata about the file you are editing — its
          path, project, branch, language and various counts — and never the contents of that
          file, your source code, or anything you typed.
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

        <Section heading="The part you should think hardest about" id="file-paths">
          <p style={MUTED_TEXT}>
            We would rather say this plainly than bury it. Although your source code never
            leaves your machine, <strong>file paths and project names do</strong>. A path like{' '}
            <code>~/work/acme-corp-migration/src/billing.rs</code> tells us the client, the
            project and roughly what you are building, even though we never see a line of the
            code itself.
          </p>
          <p style={MUTED_TEXT}>
            For most developers that is an acceptable trade for accurate time tracking. If you
            work under an agreement where even project names are confidential, it is not, and you
            should not connect {SITE_NAME} to that work.
          </p>
        </Section>

        <Section heading="AI-related data" id="ai-data">
          <p style={MUTED_TEXT}>
            When a heartbeat is marked as AI-generated, four things are stored: the flag itself,
            the agent name as a free-form string, and counts of AI lines added and deleted. No
            conversation content is involved at any point — there is no field for prompt text,
            response text or token usage anywhere in the pipeline.
          </p>
          <Subheading>One thing worth knowing</Subheading>
          <p style={MUTED_TEXT}>
            The agent name is whatever the client sends. If you build tooling that reports AI
            activity, avoid putting anything sensitive in that string — it is stored verbatim and
            displayed in your dashboard.
          </p>
        </Section>

        <Section heading="How the data travels" id="transport">
          <p style={MUTED_TEXT}>
            Your editor extension hands activity to a local CLI process, which sends heartbeats
            over HTTPS to our API using your API key. The key is held in your editor&apos;s secret
            storage rather than in a settings file, so it is not committed to a repository by
            accident.
          </p>
        </Section>

        <Section heading="Retention and deletion" id="retention">
          <p style={MUTED_TEXT}>
            Your activity is retained for as long as your account exists — complete history is
            the point of the product, so nothing is aged out or trimmed to a recent window. You
            can request deletion of your account and its data at any time, and it is removed from
            our systems.
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
