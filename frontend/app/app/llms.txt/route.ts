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
- [AI cost and token tracking](${absoluteUrl('/ai-cost-tracking')}): Token classes, how estimated cost is derived from versioned effective prices, cost per project, and the coverage reported with every total.
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
- Classifies tracked line changes as AI, human or Unattributed, and reports coverage as a percentage; a metric it cannot establish is left unavailable rather than shown as a confident zero.
- Attributes AI work to a named agent, and to a provider and model when the client supplies them, aggregated per agent and per day.
- Bundled local agents read the on-device transcripts of terminal AI tools (Claude Code, Codex CLI, Gemini CLI) and convert them to AI-attributed heartbeats, so agent edits made with no editor open are still counted.
- Derives estimated AI token cost from versioned effective prices and reports it per project, always alongside the coverage the total is based on.

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

The Thai pages mirror the English ones one-for-one. AtoAxis เป็นเครื่องมือ (โปรแกรม) ติดตามเวลาการเขียนโค้ดสำหรับนักพัฒนา รองรับ WakaTime API และเก็บประวัติครบถ้วน.

- [AtoAxis ภาษาไทย](${absoluteUrl('/th')}): เครื่องมือติดตามเวลาการเขียนโค้ดคืออะไร ทำงานอย่างไร กรณีใช้งาน ข้อจำกัด และ FAQ.
- [ทางเลือก WakaTime](${absoluteUrl('/th/wakatime-alternative')}): เทียบกับ WakaTime วิธีย้าย และการนำเข้า WakaTime export.
- [การติดตาม AI coding](${absoluteUrl('/th/ai-coding-tracker')}): วิธีบันทึกงานที่ AI ช่วย การแยก AI / human / Unattributed และสิ่งที่ไม่อัตโนมัติ.
- [ต้นทุนและ token ของ AI](${absoluteUrl('/th/ai-cost-tracking')}): กลุ่ม token วิธีคำนวณต้นทุนประมาณจากราคาที่มีเวอร์ชัน ต้นทุนต่อโปรเจกต์ และ coverage ที่แนบมากับทุกยอดรวม.
- [Developer analytics](${absoluteUrl('/th/developer-analytics')}): metric ที่ระบบสร้างและวิธีได้มาของแต่ละตัว.
- [ราคา](${absoluteUrl('/th/pricing')}): ราคาเปิดตัวที่วางไว้และสถานะ Early Access.
- [ทีม](${absoluteUrl('/th/teams')}): coding presence สำหรับทีม remote — ต้นแบบ Early Access ยังไม่ใช่ฟีเจอร์ที่ใช้งานจริง.
- [เกี่ยวกับ](${absoluteUrl('/th/about')}): ตัวตนของบริษัทและเป้าหมายของผลิตภัณฑ์.
- [ติดต่อ](${absoluteUrl('/th/contact')}): ช่องทางติดต่อ Early Access และซัพพอร์ต.
- [เงื่อนไข](${absoluteUrl('/th/terms')}): เงื่อนไขสำหรับผลิตภัณฑ์แบบ hosted และ Early Access.
- [เริ่มต้นใช้งาน](${absoluteUrl('/th/docs/getting-started')}): ความต้องการของระบบ การติดตั้ง การเชื่อม editor การตรวจสอบการติดตาม และการแก้ปัญหา.
- [การเชื่อมต่อ VS Code](${absoluteUrl('/th/integrations/vscode')}): สิ่งที่ extension ติดตาม การตั้งค่าและคำสั่ง และข้อจำกัด.
- [ความเป็นส่วนตัวและการเก็บข้อมูล](${absoluteUrl('/th/privacy')}): ทุกฟิลด์ที่ heartbeat เก็บ สิ่งที่ไม่เก็บ การเก็บรักษาและการลบ.
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
