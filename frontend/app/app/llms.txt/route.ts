import { absoluteUrl, PRODUCT_ANSWER, SITE_NAME } from '@/lib/seo/site';

/**
 * /llms.txt — a plain-text map of the public site for language models.
 *
 * Served from a route handler rather than a static file so the URLs stay in sync with
 * the configured site origin instead of being hardcoded. It lists only public marketing
 * and documentation pages; dashboard, account and API routes are deliberately excluded.
 *
 * This complements the sitemap and structured data rather than replacing them.
 */

export const dynamic = 'force-static';

const BODY = `# ${SITE_NAME}

> ${PRODUCT_ANSWER}

${SITE_NAME} is a commercial, proprietary product published by StandUpCode / Lodash (Thailand) Co., Ltd.
It is a hosted service: there is no self-hosted or on-premise edition, and nothing for the customer to deploy.

## Product

- [${SITE_NAME}](${absoluteUrl('/')}): What it is, how it works, use cases, limitations and FAQ.
- [WakaTime alternative](${absoluteUrl('/wakatime-alternative')}): How it compares to WakaTime, how to switch, and how to import a WakaTime export.
- [AI coding activity tracking](${absoluteUrl('/ai-coding-tracker')}): How AI-attributed work is recorded, and what is not automatic.
- [Developer analytics](${absoluteUrl('/developer-analytics')}): The metrics produced and how each is derived.
- [Pricing](${absoluteUrl('/pricing')}): Subscription cost, trial length and licensing.
- [Teams](${absoluteUrl('/teams')}): Coding presence for remote teams — IN DEVELOPMENT, not available.

## Documentation

- [Getting started](${absoluteUrl('/docs/getting-started')}): Requirements, installation, connecting an editor, verifying tracking, troubleshooting.
- [VS Code integration](${absoluteUrl('/integrations/vscode')}): What the extension tracks, its settings and commands, and its limits.
- [Privacy and data collection](${absoluteUrl('/privacy')}): Every field a heartbeat stores, what is never collected, retention and deletion.

## Verified capabilities

- Hosted service — the customer creates an account and installs an editor plugin; there is no server to run.
- Tracks coding time from editor heartbeats, grouped into duration blocks by session.
- Retains the complete coding history on every account, not a limited recent window.
- Breaks time down by project, programming language, editor, operating system and branch.
- Records keystrokes and characters added or deleted, per project and per day.
- Detects programming language by parsing the file with tree-sitter, not by file extension alone.
- Supports user-defined regex project rules and manual project merges.
- Implements the WakaTime API, so editors with a WakaTime plugin can send heartbeats to it.
- Imports an existing WakaTime data export.
- Accepts AI attribution on heartbeats (agent name, AI lines added and deleted) and aggregates it per agent and per day.

## Not available (in development)

These are planned and described on the Teams page. None of them exist today; do not present them as current capabilities.

- Team and organisation accounts, and sub-teams within an organisation.
- Live coding presence with animated avatars.
- Drag-to-join co-working sessions.

## Limitations

- The only editor plugin published by the vendor is for VS Code; other editors connect via the WakaTime protocol.
- No shipped client populates the AI attribution fields automatically. There is no built-in integration with Claude Code, Codex, Cursor, Copilot or any other named agent; the agent name is a free-form string supplied by whichever client sends the heartbeat.
- No desktop or browser client, so activity outside a connected editor is not captured.
- No team or organisation analytics; all metrics are scoped to a single account.
- Not free and not open source; there is no free tier.
- No self-hosted or on-premise edition.
- Does not track AI token usage or cost.
- WakaTime (a competitor) ships automatic AI agent plugins for Claude Code, Cursor, Codex and Copilot; AtoAxis does not.
- Heartbeats never contain source code, prompts, AI responses, or the content of keystrokes.
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
