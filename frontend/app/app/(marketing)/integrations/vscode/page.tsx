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
import { SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

/** Declared once so the canonical, OG URL and breadcrumb entries cannot drift apart. */
const CANONICAL = '/integrations/vscode';

export const metadata: Metadata = {
  title: 'VS Code Time Tracking Extension',
  description:
    `The ${SITE_NAME} VS Code extension records editor activity, buffers it in memory, and sends ` +
    'it through wakaclock-cli. It tracks typing, saves, file switches, debug sessions and build ' +
    "tasks, and shows today's total in the status bar.",
  alternates: { canonical: CANONICAL },
  openGraph: { url: CANONICAL, title: `VS Code Time Tracking | ${SITE_NAME}` },
};

const BREADCRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Integrations', path: '/integrations' },
  { name: 'VS Code', path: CANONICAL },
];

const FAQ: readonly FaqEntry[] = [
  {
    question: `How do I track coding time in VS Code with ${SITE_NAME}?`,
    answer:
      'Install the extension, make sure the wakaclock-cli binary is on your PATH or set ' +
      'wakaclock.cliPath to its location, then run the "Set API Key" command and enter the key ' +
      `generated in your ${SITE_NAME} settings. Today's total appears in the status bar once ` +
      'heartbeats start arriving.',
  },
  {
    question: 'What activity does the extension record?',
    answer:
      'Typing updates an in-memory buffer per file. Saving flushes immediately and marks the ' +
      'heartbeat as a write. Switching files flushes the previous file. Pending typing is flushed ' +
      'on a timer, every 30 seconds by default. Debug sessions and build tasks emit their own ' +
      'debugging and building heartbeats when they start and stop.',
  },
  {
    question: 'Does the extension slow VS Code down?',
    answer:
      'Activity is accumulated in memory and flushed on an interval rather than sent per ' +
      'keystroke, and heartbeat delivery is handed to a separate wakaclock-cli process rather than ' +
      'done in the extension host. The flush interval, idle threshold and same-file gap are all ' +
      'configurable if you want to reduce the work further.',
  },
  {
    question: 'Does it track activity when I am idle?',
    answer:
      'No. Background heartbeats stop after there has been no activity for longer than the idle ' +
      'threshold, which is 5 minutes by default and configurable via wakaclock.idleMinutes.',
  },
  {
    question: 'Does the VS Code extension track AI coding tools?',
    answer:
      'Yes for Claude Code, Codex CLI and Gemini CLI. Run AtoAxis: Set Up AI Tracking and the ' +
      'extension registers their native hooks. Cursor and Copilot need provider-specific adapters.',
  },
  {
    question: 'Can I use my existing WakaTime plugin instead?',
    answer:
      'Yes. The heartbeat API is WakaTime-compatible, so pointing api_url in ~/.wakatime.cfg at ' +
      `your ${SITE_NAME} server works without installing this extension. The dedicated extension ` +
      'exists for people who want a native client and the status bar total.',
  },
];

const SETTINGS = [
  'wakaclock.cliPath — absolute path to wakaclock-cli; leave empty to resolve from PATH',
  'wakaclock.flushIntervalSeconds — how often buffered typing is flushed, default 30',
  'wakaclock.sameFileHeartbeatMinutes — gap after which the same file starts a new window, default 2',
  'wakaclock.idleMinutes — stop emitting background heartbeats after this much inactivity, default 5',
  "wakaclock.statusBarEnabled — show today's total in the status bar, default on",
  'wakaclock.trackDebugSessions — emit debugging heartbeats, default on',
  'wakaclock.trackBuildTasks — emit building heartbeats, default on',
  'wakaclock.debugLogging — verbose logging in the extension host console, default off',
];

const COMMANDS = [
  'Set API Key — store your API key in VS Code secret storage',
  'Clear API Key — remove the stored key',
  'Configure CLI Path — point the extension at a wakaclock-cli binary',
  "Show Today's Total — display today's tracked time",
  'Send Heartbeat Now — flush pending activity immediately',
  'Toggle Status Bar — show or hide the status bar item',
];

export default function VsCodeIntegrationPage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(BREADCRUMBS), faqSchema(FAQ))} />

      <PageShell>
        <Breadcrumbs entries={BREADCRUMBS} />
        <PageTitle>VS Code time tracking</PageTitle>

        <LeadAnswer>
          The {SITE_NAME} VS Code extension captures editor activity, buffers it in memory, and
          delegates heartbeat delivery to the wakaclock-cli binary. It records typing, saves,
          file switches, debug sessions and build tasks, and can show today&apos;s total coding
          time in the status bar. It is the only editor plugin published by us.
        </LeadAnswer>

        <Section heading={`What ${SITE_NAME} tracks in VS Code`} id="what-it-tracks">
          <Bullets
            items={[
              'The file you are editing, as a file-type heartbeat with its project and branch',
              'Whether the heartbeat was a save, which is marked as a write',
              'Keystrokes and characters added or deleted, buffered per file',
              'Cursor position and line number at the time of the flush',
              'Debug sessions, as debugging heartbeats when they start and stop',
              'Build tasks, as building heartbeats when they start and stop',
            ]}
          />
        </Section>

        <Section heading="Requirements" id="requirements">
          <Bullets
            items={[
              'VS Code 1.90 or newer',
              'The wakaclock-cli binary, either on your PATH or set via wakaclock.cliPath',
              `A running ${SITE_NAME} server and an API key generated from its settings page`,
              'A CLI config file at ~/.wakaclock/config.toml pointing at that server',
            ]}
          />
        </Section>

        <Section heading="Installation" id="installation">
          <p style={MUTED_TEXT}>
            Install the extension, then store your API key through the command palette rather
            than in settings.json — it is kept in VS Code secret storage, not in a file:
          </p>
          <CodeBlock label="Command Palette">{`> Wakaclock: Set API Key
> Wakaclock: Configure CLI Path   # only if the binary is not on PATH`}</CodeBlock>
          <p style={MUTED_TEXT}>
            If you prefer to point the extension at an explicit binary, the path can also be set
            directly:
          </p>
          <CodeBlock label="settings.json">{`{
  "wakaclock.cliPath": "/usr/local/bin/wakaclock-cli",
  "wakaclock.statusBarEnabled": true
}`}</CodeBlock>
          <p style={MUTED_TEXT}>
            Note that the binary, config path and setting keys still use the original{' '}
            <code>wakaclock</code> naming. Those identifiers are what actually ship, so they are
            written here exactly as you must type them.
          </p>
        </Section>

        <Section heading="Tracked activity and how it is buffered" id="how-it-works">
          <p style={MUTED_TEXT}>
            Typing does not send a request per keystroke. The extension keeps a per-file buffer
            in memory and flushes it on an interval — 30 seconds by default. A save flushes
            immediately and marks the heartbeat as a write. Switching to another file flushes the
            file you left. If activity resumes on the same file after a gap longer than the
            same-file threshold, a new heartbeat window is started rather than extending the old
            one. After the idle threshold passes with no activity, background heartbeats stop
            entirely.
          </p>
        </Section>

        <Section heading="Settings" id="settings">
          <Bullets items={SETTINGS} />
        </Section>

        <Section heading="Commands" id="commands">
          <Bullets items={COMMANDS} />
        </Section>

        <Section heading="Limitations" id="limitations">
          <Bullets
            items={[
              'Only file activity is sent — the extension does not report app, domain or url heartbeats',
              'AI hooks currently cover Claude Code, Codex CLI and Gemini CLI; Cursor/Copilot need adapters',
              'The extension requires wakaclock-cli; it does not talk to the server directly',
            ]}
          />
        </Section>

        <RelatedLinks
          links={[
            {
              href: '/docs/getting-started',
              label: `Install ${SITE_NAME}`,
              description: 'Server setup, API keys, and verifying that tracking works end to end',
            },
            {
              href: '/wakatime-alternative',
              label: 'Using an existing WakaTime plugin',
              description: 'Connect any WakaTime-compatible editor without installing this extension',
            },
            {
              href: '/ai-coding-tracker',
              label: 'AI coding activity tracking',
              description: 'What the extension does not do, and how AI attribution is populated',
            },
          ]}
        />
      </PageShell>

      <FaqSection entries={FAQ} heading="VS Code integration FAQ" />
    </>
  );
}
