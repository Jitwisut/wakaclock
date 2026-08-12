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
import { SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

/** Declared once so the canonical, OG URL and breadcrumb entries cannot drift apart. */
const CANONICAL = '/docs/getting-started';

export const metadata: Metadata = {
  title: 'Getting Started — Installation',
  description:
    `How to install ${SITE_NAME}: start the infrastructure, run the server, generate an API key, ` +
    'then connect VS Code or repoint an existing WakaTime plugin, and verify that tracking works.',
  alternates: { canonical: CANONICAL },
  openGraph: { url: CANONICAL, title: `Getting Started | ${SITE_NAME}` },
};

const BREADCRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Docs', path: '/docs' },
  { name: 'Getting started', path: CANONICAL },
];

const FAQ: readonly FaqEntry[] = [
  {
    question: `How do I install ${SITE_NAME}?`,
    answer:
      'Start the infrastructure with Docker Compose, run the server, then create an account and ' +
      'generate an API key from the dashboard. Save that key with "wakaclock-cli set-key", and ' +
      'either install the VS Code extension or point an existing WakaTime plugin at your server. ' +
      'Run "wakaclock-cli today" to confirm activity is arriving.',
  },
  {
    question: 'What do I need before installing?',
    answer:
      'Docker and Docker Compose for ClickHouse and Redis, Rust 1.75 or newer to build the server ' +
      'and CLI, and Node.js 20 or newer for the dashboard. VS Code 1.90 or newer is required only ' +
      'if you want the editor extension.',
  },
  {
    question: 'Where does the CLI keep its configuration?',
    answer:
      'In ~/.wakaclock/config.toml, which holds your user id, the server URL and your API key. ' +
      'The WAKACLOCK_API_KEY environment variable takes precedence over the stored key without ' +
      'overwriting the file.',
  },
  {
    question: 'How do I check that tracking is working?',
    answer:
      'Run "wakaclock-cli status" to confirm the CLI can reach the server and has a key, then ' +
      '"wakaclock-cli today" to print your total for today. Editing a file and re-running the ' +
      'second command should show the total increase.',
  },
  {
    question: 'Do I need the extension if I already use WakaTime?',
    answer:
      'No. Set api_url in ~/.wakatime.cfg to your server and use an API key generated there. Your ' +
      'existing plugin will send heartbeats without any further changes.',
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
          To install {SITE_NAME}: start ClickHouse and Redis with Docker Compose, run the server,
          then create an account and generate an API key in the dashboard. Save the key with{' '}
          <code>wakaclock-cli set-key</code>, connect your editor — either the VS Code extension
          or an existing WakaTime plugin — and confirm heartbeats are arriving with{' '}
          <code>wakaclock-cli today</code>.
        </LeadAnswer>

        <Section heading="Requirements" id="requirements">
          <Bullets
            items={[
              'Docker and Docker Compose, for ClickHouse and Redis',
              'Rust 1.75 or newer, to build the server and the CLI',
              'Node.js 20 or newer, to run the dashboard',
              'VS Code 1.90 or newer, only if you want the editor extension',
            ]}
          />
        </Section>

        <Section heading="1. Start the infrastructure" id="infrastructure">
          <CodeBlock label="shell">docker compose -f docker-compose.dev.yaml up -d</CodeBlock>
        </Section>

        <Section heading="2. Run the server and dashboard" id="run">
          <CodeBlock label="shell">{`cd backend/api
cargo run -- web-service`}</CodeBlock>
          <p style={MUTED_TEXT}>
            Then, in a second terminal, start the dashboard:
          </p>
          <CodeBlock label="shell">{`cd frontend/app
npm ci && npm run dev`}</CodeBlock>
          <p style={MUTED_TEXT}>
            The API listens on port 8080 and the dashboard on port 3000.
          </p>
        </Section>

        <Section heading="3. Create an account and generate an API key" id="api-key">
          <p style={MUTED_TEXT}>
            Register in the dashboard, then open the settings page and generate an API key. Save
            it to the CLI config so every client on this machine can use it:
          </p>
          <CodeBlock label="shell">{`wakaclock-cli set-key <your-api-key>`}</CodeBlock>
          <p style={MUTED_TEXT}>
            This writes to <code>~/.wakaclock/config.toml</code>, which holds your user id, the
            server URL and the key:
          </p>
          <CodeBlock label="~/.wakaclock/config.toml">{`user_id = "00000000-0000-0000-0000-000000000000"
server_url = "http://localhost:8080"
api_key = "your_generated_api_key"`}</CodeBlock>
          <p style={MUTED_TEXT}>
            For CI or shared machines, setting <code>WAKACLOCK_API_KEY</code> in the environment
            overrides the stored key without writing it to disk.
          </p>
        </Section>

        <Section heading="4. Connect your editor" id="connect-editor">
          <Subheading>Option A — the VS Code extension</Subheading>
          <p style={MUTED_TEXT}>
            Install the extension, then set your key through the command palette so it is stored
            in VS Code secret storage rather than in a settings file:
          </p>
          <CodeBlock label="Command Palette">{`> Wakaclock: Set API Key
> Wakaclock: Configure CLI Path   # only if wakaclock-cli is not on PATH`}</CodeBlock>

          <Subheading>Option B — an existing WakaTime plugin</Subheading>
          <p style={MUTED_TEXT}>
            Any editor with a WakaTime plugin can send heartbeats by changing one value:
          </p>
          <CodeBlock label="~/.wakatime.cfg">{`[settings]
api_url = https://your-azyren.example.com/api/v1
api_key = your_generated_api_key`}</CodeBlock>
        </Section>

        <Section heading="5. Verify tracking" id="verify">
          <CodeBlock label="shell">{`wakaclock-cli status   # confirms the server is reachable and a key is set
wakaclock-cli today    # prints today's total`}</CodeBlock>
          <p style={MUTED_TEXT}>
            Edit and save a file, wait for the flush interval — 30 seconds by default — then run{' '}
            <code>wakaclock-cli today</code> again. The total should increase. If the status bar
            is enabled, the same figure appears in VS Code.
          </p>
        </Section>

        <Section heading="Troubleshooting" id="troubleshooting">
          <Subheading>No heartbeats are arriving</Subheading>
          <p style={MUTED_TEXT}>
            Check that <code>wakaclock-cli</code> resolves on your PATH, or set{' '}
            <code>wakaclock.cliPath</code> to its absolute location. Enable{' '}
            <code>wakaclock.debugLogging</code> to see what the extension is doing in the
            extension host console.
          </p>

          <Subheading>Activity stops after a few minutes</Subheading>
          <p style={MUTED_TEXT}>
            That is the idle threshold working as intended — background heartbeats stop after 5
            minutes without activity. Raise <code>wakaclock.idleMinutes</code> if you want a
            longer window.
          </p>

          <Subheading>A note on naming</Subheading>
          <p style={MUTED_TEXT}>
            The binary, config directory and editor setting keys still use the original{' '}
            <code>wakaclock</code> naming rather than {SITE_NAME}. Every command on this page is
            written exactly as it must be typed.
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
