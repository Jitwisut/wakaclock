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
import { createMarketingMetadata, SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

export const metadata: Metadata = createMarketingMetadata({
  title: 'AI Coding Activity Tracking',
  description:
    'See how AtoAxis records AI-assisted coding with agent names, AI line counts and human keystrokes without storing prompts, responses or source code.',
  path: '/ai-coding-tracker',
});

const BREADCRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'AI coding tracker', path: '/ai-coding-tracker' },
];

const FAQ: readonly FaqEntry[] = [
  {
    question: 'What is AI coding activity tracking?',
    answer:
      'AI coding activity tracking records which parts of your work were produced with help from ' +
      'an AI coding tool, rather than counting only the time an editor was open. In practice that ' +
      'means attributing lines of code to an agent and comparing them against code typed by hand.',
  },
  {
    question: `Does ${SITE_NAME} track AI-assisted development?`,
    answer:
      `${SITE_NAME} stores AI attribution on every heartbeat: a flag marking the heartbeat as ` +
      'AI-generated, the name of the agent, and the number of AI lines added and deleted. Those ' +
      'values are aggregated into a per-agent and per-day breakdown that can be compared against ' +
      'human keystrokes and characters over any date range.',
  },
  {
    question: `Does ${SITE_NAME} support Claude Code, Codex or Cursor out of the box?`,
    answer:
      'Claude Code, Codex CLI and Gemini CLI are supported through the VS Code setup wizard. ' +
      'Cursor and Copilot require provider-specific adapters; unsupported tools are not guessed ' +
      'from typing speed or code shape.',
  },
  {
    question: 'How do AI attribution fields get populated today?',
    answer:
      'Three ways. The bundled agent hooks call the heartbeat API with verified metadata; your own ' +
      'tooling can call it directly with is_ai_generated, ' +
      'ai_agent and the AI line counts set, or you import a WakaTime data export — imported ' +
      'heartbeats carrying an AI category or AI session are recorded as AI-generated under the ' +
      'agent name "wakatime".',
  },
  {
    question: `Does ${SITE_NAME} store my AI prompts or the AI's responses?`,
    answer:
      'No. The heartbeat schema has no field for prompt text, response text, or source code. It ' +
      'records counts and identifiers only: how many lines an agent added or deleted, the agent ' +
      'name, the file path, project, branch and language.',
  },
  {
    question: 'Why do coding-time metrics alone miss AI-assisted work?',
    answer:
      'Elapsed editor time treats a hand-typed function and a large accepted AI suggestion the ' +
      'same way, even though they take very different amounts of time to produce. Recording AI ' +
      'lines separately from human keystrokes keeps that difference visible instead of averaging ' +
      'it away.',
  },
];

const TRACKED = [
  'Whether a heartbeat was AI-generated',
  'The agent name reported for it, as a free-form string',
  'Lines added and lines deleted attributed to the agent',
  'Human keystrokes and characters added, counted separately',
  'The project, branch, language and file path the activity belongs to',
  'The date, so AI and human activity can be compared day by day',
];

const NOT_TRACKED = [
  'Prompt text sent to an AI tool',
  'Responses returned by an AI tool',
  'The contents of your source files',
  'Any per-token or monetary cost figure',
];

export default function AiCodingTrackerPage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(BREADCRUMBS), faqSchema(FAQ))} />

      <PageShell>
        <Breadcrumbs entries={BREADCRUMBS} />
        <PageTitle>AI coding activity tracking</PageTitle>

        <LeadAnswer>
          {SITE_NAME} records AI-assisted development as part of the same timeline as ordinary
          coding. Every heartbeat can carry an AI agent name and a count of AI lines added and
          deleted, which the dashboard aggregates per agent and per day so AI-attributed work
          can be compared against human keystrokes. These fields are supplied by the client
          sending the heartbeat.
        </LeadAnswer>

        <Section heading="Why traditional coding-time metrics are incomplete" id="why">
          <p style={MUTED_TEXT}>
            A conventional time tracker answers &ldquo;how long was this file open and being
            edited&rdquo;. That question has become harder to interpret: accepting a large
            suggestion from a coding agent produces a lot of code in very little editor time,
            while the same code written by hand produces the opposite pattern. Elapsed time alone
            cannot tell those apart. Recording attributed lines next to keystrokes keeps both
            signals, so the ratio between them stays visible rather than being flattened into a
            single duration.
          </p>
        </Section>

        <Section heading={`How ${SITE_NAME} tracks AI-assisted work`} id="how">
          <p style={MUTED_TEXT}>
            AI attribution lives on the heartbeat itself. A client posting to the heartbeat
            endpoint may set four additional fields:
          </p>
          <CodeBlock label="POST /api/v1/heartbeats.bulk">{`{
  "entity": "src/parser.rs",
  "entity_type": "file",
  "project": "atoaxis",
  "language": "Rust",
  "is_ai_generated": true,
  "ai_agent": "your-agent-name",
  "ai_lines_added": 42,
  "ai_lines_deleted": 3
}`}</CodeBlock>
          <p style={MUTED_TEXT}>
            The server stores those values alongside the ordinary heartbeat metadata. The AI
            stats endpoint then returns totals for AI lines added and deleted, total human
            keystrokes and characters, the share of heartbeats that were AI-generated, a
            per-agent table, and a daily series — for whatever date range you ask for.
          </p>
        </Section>

        <Section heading="Supported AI tools" id="supported-tools">
          <p style={MUTED_TEXT}>
            {SITE_NAME} ships verified hook integrations for Claude Code, Codex CLI and Gemini CLI.
            The VS Code setup wizard detects those CLIs and registers their hooks without reading
            prompts, responses or source code. Cursor and Copilot are not yet supported because
            their editor events need provider-specific adapters.
          </p>
          <p style={MUTED_TEXT}>
            Every hook sends provider, agent, optional model, line deltas, timestamp and an event id.
            Unsupported tools remain unclassified rather than being guessed as human activity.
          </p>
          <Subheading>The two paths that populate it today</Subheading>
          <Bullets
            items={[
              'The bundled Claude Code, Codex CLI or Gemini CLI hook posts verified heartbeats after an AI file edit',
              'Your own tooling — a wrapper, hook or script around another agent — posts heartbeats with the AI fields set',
              'A WakaTime data import, where heartbeats carrying an AI category or AI session are recorded under the agent name "wakatime"',
            ]}
          />
        </Section>

        <Section heading="If automatic AI tracking is what you need" id="compare-wakatime">
          <p style={MUTED_TEXT}>
            Worth saying plainly, because it may save you an evaluation: WakaTime publishes
            dedicated plugins for Claude Code, Cursor, Codex and Copilot, and its paid tiers
            report AI-generated versus human-written lines, token usage and estimated cost per
            model without any integration work. {SITE_NAME} does none of that automatically, and
            it does not track tokens or cost at all.
          </p>
          <p style={MUTED_TEXT}>
            So if automatic AI agent analytics is your primary requirement, WakaTime is the
            better product today. {SITE_NAME} is the better fit when the deciding factor is
            keeping your complete coding history at a lower price —
            and you are willing to send the AI attribution yourself. Verified against
            wakatime.com in August 2026; check their current documentation before deciding.
          </p>
        </Section>

        <Section heading="What is recorded" id="what-is-recorded">
          <Bullets items={TRACKED} />
          <Subheading>What is never recorded</Subheading>
          <p style={MUTED_TEXT}>
            Verified against the heartbeat schema — there is no field in which any of the
            following could be stored:
          </p>
          <Bullets items={NOT_TRACKED} />
        </Section>

        <Section heading="Privacy" id="privacy">
          <p style={MUTED_TEXT}>
            AI attribution data is stored the same way as the rest of your activity: in the
            ClickHouse infrastructure operated by {SITE_NAME}. Because the fields hold counts and
            an agent name rather than conversation content, an AI-attributed heartbeat is no more
            sensitive than an ordinary one. The privacy page describes the full set of fields
            that a heartbeat can contain.
          </p>
        </Section>

        <RelatedLinks
          links={[
            {
              href: '/privacy',
              label: 'What data a heartbeat contains',
              description: 'Every field stored, what is never collected, and how to delete data',
            },
            {
              href: '/developer-analytics',
              label: 'Developer analytics metrics',
              description: 'The full list of metrics available and how each one is derived',
            },
            {
              href: '/docs/getting-started',
              label: `Join ${SITE_NAME} early access`,
              description: 'Learn how the hosted product will connect an editor before sending AI heartbeats',
            },
          ]}
        />
      </PageShell>

      <FaqSection entries={FAQ} heading="AI tracking FAQ" />
    </>
  );
}
