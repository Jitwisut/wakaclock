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
  title: 'Developer Analytics and Coding Metrics',
  description:
    `The coding analytics ${SITE_NAME} produces: total and daily-average coding time, best day, ` +
    'breakdowns by project, language, editor, operating system and branch, keystroke counts, and ' +
    'AI versus human attribution.',
  alternates: { canonical: '/developer-analytics' },
  openGraph: { url: '/developer-analytics', title: `Developer Analytics | ${SITE_NAME}` },
};

const BREADCRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Developer analytics', path: '/developer-analytics' },
];

const FAQ: readonly FaqEntry[] = [
  {
    question: 'How do developers measure coding activity?',
    answer:
      'The most common approach is to record editor activity as it happens and group it into ' +
      'sessions, rather than counting commits or lines shipped. Commit counts reward frequent ' +
      'committers and miss reading, debugging and refactoring; session-based tracking measures ' +
      'time actually spent in the editor on a given project.',
  },
  {
    question: 'How is coding time calculated?',
    answer:
      'Heartbeats arriving close together in time are grouped into a duration block, and a large ' +
      'enough gap closes it. Total coding time is the sum of those blocks, so pauses between ' +
      'blocks are excluded rather than counted as work.',
  },
  {
    question: 'What time ranges are available?',
    answer:
      'Statistics can be requested for today, the last 7 days, the last 30 days, or all time. ' +
      'Summaries, durations, keystroke stats and AI stats additionally accept an explicit start ' +
      'and end date for any custom range.',
  },
  {
    question: 'Can I see which programming languages I use most?',
    answer:
      'Yes. Every heartbeat carries a detected language, and statistics include a language ' +
      'breakdown with total seconds, hours and heartbeat count for each. Language detection uses ' +
      'tree-sitter to parse the file rather than inferring from the file extension alone.',
  },
  {
    question: 'Does it count keystrokes as well as time?',
    answer:
      'Yes. Keystrokes and characters added or deleted are recorded per heartbeat and aggregated ' +
      'per project and per day, alongside a count of days with activity.',
  },
];

export default function DeveloperAnalyticsPage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(BREADCRUMBS), faqSchema(FAQ))} />

      <PageShell>
        <Breadcrumbs entries={BREADCRUMBS} />
        <PageTitle>Developer analytics</PageTitle>

        <LeadAnswer>
          {SITE_NAME} turns editor heartbeats into coding analytics: total time, daily average
          and best day for a chosen range, plus breakdowns by project, programming language,
          editor, operating system and branch. It also reports keystroke and character counts,
          and separates lines attributed to an AI agent from code typed by hand.
        </LeadAnswer>

        <Section heading="Metrics available" id="metrics">
          <Subheading>Time</Subheading>
          <Bullets
            items={[
              'Total coding time for today, the last 7 days, the last 30 days, or all time',
              'Daily average across the range, and the number of days that had any activity',
              'Best day in the range, with its date and total',
              "Today's running total, which is what the editor status bar displays",
              'Duration blocks for a single day, showing when each session started and ended',
            ]}
          />

          <Subheading>Breakdowns</Subheading>
          <Bullets
            items={[
              'By project — total seconds, hours and heartbeat count for each',
              'By programming language, detected by parsing the file with tree-sitter',
              'By editor, so time is attributable when you work across more than one',
              'By operating system',
              'By branch, for work split across feature branches',
            ]}
          />

          <Subheading>Activity volume</Subheading>
          <Bullets
            items={[
              'Keystrokes recorded per project and per day',
              'Characters added and characters deleted',
              'Number of days with activity in the range',
              'Raw heartbeat counts behind every aggregate',
            ]}
          />

          <Subheading>AI attribution</Subheading>
          <Bullets
            items={[
              'Lines added and deleted attributed to an AI agent',
              'A per-agent table covering every agent name reported in the range',
              'The share of heartbeats in the range that were marked AI-generated',
              'A daily series putting AI lines and human keystrokes side by side',
            ]}
          />
        </Section>

        <Section heading="How the numbers are produced" id="how">
          <p style={MUTED_TEXT}>
            Heartbeats land in ClickHouse, where materialised views roll them into daily
            aggregate tables as the rows arrive — so a dashboard query reads pre-aggregated data
            rather than scanning raw heartbeats. Coding time itself comes from session grouping:
            consecutive heartbeats form a duration block, a sufficiently long gap ends it, and
            totals are the sum of the blocks. Because the database is yours, any metric on this
            page can also be reproduced with your own SQL.
          </p>
        </Section>

        <Section heading="What is not measured" id="not-measured">
          <p style={MUTED_TEXT}>
            No productivity score, ranking or estimate of output quality is produced. There is no
            team or organisation rollup — every metric is scoped to a single account. And nothing
            is inferred about activity outside a connected editor, because nothing reports it.
          </p>
        </Section>

        <RelatedLinks
          links={[
            {
              href: '/ai-coding-tracker',
              label: 'AI coding activity tracking',
              description: 'How AI attribution reaches these metrics, and what fills it in',
            },
            {
              href: '/integrations/vscode',
              label: 'VS Code time tracking',
              description: 'The editor client that produces most of this data',
            },
            {
              href: '/privacy',
              label: 'What data a heartbeat contains',
              description: 'The exact fields behind every metric listed here',
            },
          ]}
        />
      </PageShell>

      <FaqSection entries={FAQ} heading="Developer analytics FAQ" />
    </>
  );
}
