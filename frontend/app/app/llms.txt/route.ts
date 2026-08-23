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
It is a hosted service operated by AtoAxis; customers do not deploy or maintain its infrastructure.

## Product

- [${SITE_NAME}](${absoluteUrl('/')}): What it is, how it works, use cases, limitations and FAQ.
- [WakaTime alternative](${absoluteUrl('/wakatime-alternative')}): How it compares to WakaTime, how to switch, and how to import a WakaTime export.
- [AI coding activity tracking](${absoluteUrl('/ai-coding-tracker')}): How AI-attributed work is recorded, and what is not automatic.
- [Developer analytics](${absoluteUrl('/developer-analytics')}): The metrics produced and how each is derived.
- [Pricing](${absoluteUrl('/pricing')}): Planned launch pricing and Early Access status.
- [Teams](${absoluteUrl('/teams')}): Coding presence for remote teams — Early Access prototype, not available as a production feature.
- [About](${absoluteUrl('/about')}): Company identity and product purpose.
- [Contact](${absoluteUrl('/contact')}): Early Access and support contact details.
- [Terms](${absoluteUrl('/terms')}): Terms for the hosted product and Early Access.
- [Join Early Access](${absoluteUrl('/join')}): The offer in one page — what ships today, what it will cost, what is still in development, and the signup form.

The WakaTime comparison was checked against the official pricing and plugins pages in August 2026 and is scheduled for a monthly review.

## Documentation

- [Getting started](${absoluteUrl('/docs/getting-started')}): Requirements, installation, connecting an editor, verifying tracking, troubleshooting.
- [VS Code integration](${absoluteUrl('/integrations/vscode')}): What the extension tracks, its settings and commands, and its limits.
- [Privacy and data collection](${absoluteUrl('/privacy')}): Every field a heartbeat stores, what is never collected, retention and deletion.

## Verified capabilities

- Hosted service — the customer will create an account and install an editor plugin; there is no server to run.
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
- The VS Code extension can detect and configure bundled hooks for Claude Code, Codex CLI and Gemini CLI. Cursor and Copilot still require provider-specific adapters.
- No desktop or browser client, so activity outside a connected editor is not captured.
- No team or organisation analytics; all metrics are scoped to a single account.
- Not free and not open source; there is no free tier.
- Hosted infrastructure is operated by AtoAxis; customers do not deploy or maintain the service.
- AI token usage and estimated cost are available when a provider exposes usage metadata; the
  API reports coverage and keeps unknown attribution/cost as unavailable rather than guessing.
- WakaTime (a competitor) supports more AI providers; AtoAxis currently ships automatic hooks for Claude Code, Codex CLI and Gemini CLI.
- Heartbeats never contain source code, prompts, AI responses, or the content of keystrokes.

## Thai pages

- [AtoAxis ภาษาไทย](${absoluteUrl('/th')}): คำอธิบายผลิตภัณฑ์และ Early Access.
- [ทางเลือก WakaTime](${absoluteUrl('/th/wakatime-alternative')}): ความเข้ากันได้ของ API และประวัติการเขียนโค้ด.
- [การติดตาม AI coding](${absoluteUrl('/th/ai-coding-tracker')}): AI attribution และข้อมูลที่ไม่ถูกเก็บ.
- [เข้าร่วม Early Access](${absoluteUrl('/th/early-access')}): ลงทะเบียนความสนใจสำหรับผลิตภัณฑ์ภาษาไทย.
- [หน้าแนะนำ Early Access](${absoluteUrl('/th/join')}): สรุปสิ่งที่ใช้ได้จริงวันนี้ ราคาที่วางไว้ ข้อจำกัด และแบบฟอร์มลงทะเบียน.
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
