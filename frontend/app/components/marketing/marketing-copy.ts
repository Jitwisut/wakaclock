/* eslint-disable sonarjs/cognitive-complexity, sonarjs/no-all-duplicated-branches, sonarjs/no-duplicate-string */

import type { FaqEntry } from '@/lib/seo/schema';
import {
  PRICING,
  PRODUCT_ANSWER,
  PRODUCT_STATUS,
  PUBLIC_EVIDENCE_URL,
  SITE_NAME,
  type SiteLocale,
} from '@/lib/seo/site';

export type Localized<T> = Readonly<Record<SiteLocale, T>>;

export type MarketingBlock =
  | { readonly after?: string; readonly before: string; readonly kind: 'email' }
  | { readonly items: readonly string[]; readonly kind: 'bullets' }
  | { readonly kind: 'code'; readonly label?: string; readonly value: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'subheading'; readonly text: string };

export interface MarketingSectionCopy {
  readonly blocks: readonly MarketingBlock[];
  readonly heading: string;
  readonly id: string;
}

export interface MarketingLinkCopy {
  readonly description: string;
  readonly href: string;
  readonly label: string;
}

export interface MarketingPageCopy {
  readonly badge?: string;
  readonly breadcrumbs: readonly { readonly name: string; readonly path: string }[];
  readonly component?:
    | { readonly afterSectionId: null; readonly kind: 'pricing' }
    | { readonly afterSectionId: string; readonly kind: 'comparison' };
  readonly description: string;
  readonly faq?: { readonly entries: readonly FaqEntry[]; readonly heading: string };
  readonly form?: 'contact' | 'early-access' | 'teams';
  /**
   * Emit HowTo structured data for this page. Steps are derived from the rendered
   * sections rather than written here, for the same reason the FAQ schema is built from
   * the visible entries: markup that is authored separately drifts away from the page it
   * claims to describe. Set it only on a page whose sections really are ordered steps.
   */
  readonly howTo?: { readonly description: string; readonly name: string };
  readonly lead: string;
  readonly metadataTitle: string;
  readonly related?: readonly {
    readonly heading?: string;
    readonly links: readonly MarketingLinkCopy[];
  }[];
  readonly schema?: 'organization';
  readonly sections: readonly MarketingSectionCopy[];
  readonly title: string;
}

export const MARKETING_PAGE_KEYS = [
  '/teams',
  '/wakatime-alternative',
  '/ai-coding-tracker',
  '/ai-cost-tracking',
  '/developer-analytics',
  '/integrations',
  '/integrations/vscode',
  '/pricing',
  '/privacy',
  '/docs',
  '/docs/getting-started',
  '/docs/migrate-from-wakatime',
  '/docs/how-coding-time-is-calculated',
  '/docs/ai-attribution-and-coverage',
  '/docs/ai-cost-methodology',
  '/about',
  '/contact',
  '/terms',
  '/early-access',
] as const;
export type MarketingPageKey = (typeof MARKETING_PAGE_KEYS)[number];

const p = (text: string): MarketingBlock => ({ kind: 'paragraph', text });
const bullets = (items: readonly string[]): MarketingBlock => ({ kind: 'bullets', items });
const sub = (text: string): MarketingBlock => ({ kind: 'subheading', text });
const code = (value: string, label?: string): MarketingBlock => ({ kind: 'code', label, value });
const email = (before: string, after?: string): MarketingBlock => ({
  kind: 'email',
  before,
  after,
});
const section = (
  heading: string,
  id: string,
  blocks: readonly MarketingBlock[]
): MarketingSectionCopy => ({ heading, id, blocks });
const faq = (heading: string, entries: readonly FaqEntry[]) => ({ heading, entries });
const related = (links: readonly MarketingLinkCopy[], heading?: string) => ({ heading, links });
const local = (en: MarketingPageCopy, th: MarketingPageCopy): Localized<MarketingPageCopy> => ({
  en,
  th,
});

export const EN_HOME = {
  badge: 'Developer time tracking · AI coding analytics',
  title: 'AtoAxis — Developer Time Tracking & AI Coding Analytics',
  headline: ['Your coding time.', 'The whole picture.'],
  highlights: ['Complete history', 'WakaTime compatible', 'No source code uploaded'],
  tagline: 'Make every working session make sense.',
  // Kept under ~155 characters so search engines show it whole rather than truncating
  // mid-claim. "your" is deliberate: the second person reads as an answer to the visitor.
  description: `${SITE_NAME} tracks coding time, projects and AI contributions. Keep your complete history, connect WakaTime plugins and review attribution coverage.`,
  /**
   * The visible opening paragraph, deliberately separate from `description` above.
   *
   * They used to be the same string, which put them in direct conflict: a meta
   * description has to stay near 155 characters to avoid truncation in a result, while
   * the first paragraph on the page is what an answer engine lifts as a snippet and is
   * useless when it is one line long. Keeping two fields lets each be the right length.
   */
  heroLead: `${SITE_NAME} tracks your coding time by project, language and editor, with AI contributions shown alongside your work. Keep your complete history, connect your existing WakaTime plugin, and see where attribution is known or still missing.`,
  /**
   * The homepage's summary block. Every line restates a claim already made and verified
   * elsewhere on this page — nothing here introduces a capability the product does not
   * ship, and nothing from IN_DEVELOPMENT belongs in it.
   */
  keyTakeaways: [
    `${SITE_NAME} records your coding time from editor heartbeats — metadata only, never your source code.`,
    'It implements the WakaTime API, so an editor that already has a WakaTime plugin can point at it, and a WakaTime export can be imported.',
    'Every account keeps its complete coding history instead of a limited recent window.',
    'AI, human and Unattributed line changes are separated, with the coverage behind each total reported rather than guessed.',
    `Early Access: planned pricing is $${PRICING.monthlyUsd}/month or $${PRICING.annualUsd}/year, and checkout is not open yet.`,
  ],
  /**
   * Split into paragraphs rather than held as one block of prose. The section as a whole
   * is meant to stand on its own — a reader or an answer engine arriving here cold gets
   * the definition, the compatibility story and the privacy boundary without reading
   * anything above it — while each paragraph stays short enough to quote by itself.
   */
  /**
   * The first entry shares the concise product definition used in structured data
   * and discovery documents. It stands alone as a complete answer to "what is AtoAxis", opening with the
   * definition, for a reader or an answer engine that quotes only this one paragraph. The
   * second stays short — it is a boundary statement (what heartbeats do NOT contain), and
   * padding it would just be filler.
   */
  whatIs: [
    PRODUCT_ANSWER,
    'AtoAxis heartbeat payloads contain activity metadata and counts, not source code, prompts or AI responses. Connected AI providers have their own data policies.',
  ],
  howItWorks: [
    'Your editor sends a heartbeat when you type, switch to or save a file. Each signal carries metadata such as file path, project, branch, language, editor and operating system — never the contents of the file.',
    'The server groups consecutive heartbeats into duration blocks, and a long gap closes a block rather than padding it, so idle time is not counted as coding time.',
    'Line changes are split three ways: AI, human and Unattributed. Work we cannot prove either way stays Unattributed instead of being credited to you, and the coverage behind every total is reported as a percentage rather than guessed.',
  ],
  useCases: [
    'See coding hours today, this week or across a custom range',
    'Break time down by project, language, editor and branch',
    'Filter to one project or language and drill a timeline, heatmap and file list from a link',
    'Compare AI-attributed lines with human keystrokes and characters',
    'Set a daily or weekly coding-time goal and track it against the same timeline',
    'Group several checkouts with project rules and merges',
    'Import a WakaTime export into the same dashboard',
  ],
  // Deliberately framed as the other side of the case above rather than a disclaimer
  // buried at the bottom: a reader deciding against the product early costs less than one
  // who discovers the gap after switching.
  limitationsIntro: `That is the case for ${SITE_NAME}. On the other hand, here is what we have not built yet — stated plainly, because we would rather you rule us out now than find the gap after you switch:`,
  limitations: [
    'Only the VS Code plugin is first-party; other editors use the WakaTime protocol',
    'AI hooks cover Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI; Cursor/Copilot need adapters',
    'Tokens and costs require provider usage plus a known price; unavailable coverage is not shown as zero',
    'Nothing outside a connected editor or the AI transcript agent is captured; there is no desktop or browser client',
    'Analytics are single-account; goals, leaderboards and a presence prototype are available where the server runs PostgreSQL, but full team and organisation dashboards remain in development',
    'The planned hosted product has no free tier',
  ],
  /**
   * A verdict, not a second sales pitch. It names who the product is a poor fit for, in
   * the same words the limitations list uses, because a recommendation that only points
   * one way is not a recommendation.
   */
  /**
   * Claim-to-source pairs, each linking the authority for one statement made above.
   *
   * The point is not link count. Every entry names the primary source for a capability
   * this page claims, so a reader — or an answer engine deciding whether to cite this
   * page — can check it without taking our word for it. The language count is exact:
   * `backend/api/crates/wakaclock-ast/src/languages.rs` maps these nine names, and only
   * these, to a tree-sitter grammar. Update the number there and here together.
   */
  /**
   * A spec block: label and value, no prose around it.
   *
   * Every figure is countable in the repository rather than rounded for effect — the nine
   * languages are the nine grammars in `wakaclock-ast/src/languages.rs`, and the five agents
   * are the five bundled adapters under `extensions/ai-agents`. If either changes, this
   * block is wrong until it is changed with them.
   */
  atAGlance: {
    heading: `${SITE_NAME} at a glance`,
    entries: [
      { label: 'Product', value: 'Hosted developer time tracking service' },
      { label: 'Status', value: `${PRODUCT_STATUS.en.label} — checkout is not open yet` },
      {
        label: 'Planned price',
        value: `$${PRICING.monthlyUsd} per month, or $${PRICING.annualUsd} per year`,
      },
      { label: 'Protocol', value: 'WakaTime API, including WakaTime export import' },
      { label: 'First-party editor client', value: 'VS Code' },
      {
        label: 'AI agents with bundled hooks',
        value: '5 — Claude Code, Codex CLI, Gemini CLI, Kilo Code, Kimi Code CLI',
      },
      {
        label: 'Languages verified by parsing',
        value: '9 — Rust, Python, JavaScript, TypeScript, TSX, Go, C, C++, Objective-C',
      },
      { label: 'History retained', value: 'Complete, with no rolling window' },
      { label: 'Stored per heartbeat', value: 'File metadata and counts — never file contents' },
      { label: 'Site languages', value: 'English and Thai' },
    ],
  },
  /** Jump links. Each `id` must match a Section id rendered on the homepage. */
  tableOfContents: [
    { id: 'what-is-atoaxis', label: `What is ${SITE_NAME}?` },
    { id: 'how-it-works', label: 'How it tracks your coding time' },
    { id: 'use-cases', label: 'What you can do with it' },
    { id: 'worked-example', label: 'Worked dashboard example' },
    { id: 'limitations', label: 'What it does not do yet' },
    { id: 'faq', label: 'Frequently asked questions' },
    { id: 'accountability', label: 'Who publishes and reviews this page' },
    { id: 'sources', label: 'How we verify these claims' },
    { id: 'verdict', label: 'Is it right for you?' },
  ],
  sources: {
    heading: 'How do we verify these claims?',
    intro: `Every capability described above is checked against the source it comes from rather than a competitor round-up: 9 languages are verified by parsing rather than guessed from a file extension, and 5 AI agents ship with a bundled hook or adapter rather than being claimed without one. The WakaTime comparison in particular was verified against wakatime.com in August 2026, and we re-check it monthly.`,
    items: [
      {
        claim:
          '84% of developers use or plan to use AI tools in their development process, yet more distrust the accuracy of AI output (46%) than trust it (33%).',
        href: 'https://survey.stackoverflow.co/2025/ai',
        label: 'Stack Overflow Developer Survey 2025: AI',
      },
      {
        claim: `${SITE_NAME} implements the WakaTime API, so an editor with an existing WakaTime plugin can send to it.`,
        href: 'https://wakatime.com/developers',
        label: 'WakaTime API documentation',
      },
      {
        claim: 'Bundled hooks attribute work done through Claude Code.',
        href: 'https://docs.anthropic.com/en/docs/claude-code/hooks',
        label: 'Claude Code hooks documentation',
      },
      {
        claim: 'Bundled hooks attribute work done through Codex CLI.',
        href: 'https://github.com/openai/codex',
        label: 'OpenAI Codex CLI',
      },
      {
        claim: 'Bundled hooks attribute work done through Gemini CLI.',
        href: 'https://github.com/google-gemini/gemini-cli',
        label: 'Google Gemini CLI',
      },
      {
        claim:
          'Language is confirmed by parsing the file, not guessed from its extension. Nine languages have a grammar — Rust, Python, JavaScript, TypeScript, TSX, Go, C, C++ and Objective-C — which is how an ambiguous extension like .h is resolved.',
        href: 'https://tree-sitter.github.io/tree-sitter/',
        label: 'Tree-sitter',
      },
      {
        claim:
          'Current product boundaries and availability are explained in the AtoAxis public guides.',
        href: PUBLIC_EVIDENCE_URL,
        label: 'AtoAxis public documentation',
      },
    ],
  },
  verdict: {
    heading: `In conclusion: is ${SITE_NAME} right for you?`,
    fits: `${SITE_NAME} fits you best if you already code in a WakaTime-compatible editor, you want your complete history rather than a rolling window, and you care how much of the work an AI agent actually did.`,
    doesNotFit:
      'It is a weaker fit today if you need a desktop or browser client, if your team needs shared organisation dashboards, or if you work mainly in Cursor or Copilot — those still need adapters.',
    closing: `We plan to charge $${PRICING.monthlyUsd}/month or $${PRICING.annualUsd}/year, but our checkout is not open during Early Access, so joining the list now costs you nothing.`,
  },
  faq: [
    {
      question: `What is ${SITE_NAME}?`,
      answer: `${SITE_NAME} turns editor heartbeats into coding-time, project, language, branch and editor analytics while keeping source code and conversation content out of the heartbeat.`,
    },
    {
      question: `How does ${SITE_NAME} track coding activity?`,
      answer:
        'The editor sends metadata heartbeats and the server groups nearby heartbeats into duration blocks for daily and weekly totals.',
    },
    {
      question: `Is ${SITE_NAME} a WakaTime alternative?`,
      answer: `${SITE_NAME} implements the WakaTime API and can import a WakaTime export. Fit depends on the editors and reports you need.`,
    },
    {
      question: 'Which editors are supported?',
      answer:
        'A first-party VS Code extension is available; other editors can connect through an existing WakaTime plugin.',
    },
    {
      question: 'Does it track AI coding tools?',
      answer:
        'The API accepts AI attribution and bundled hooks support Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI. Cursor and Copilot need adapters.',
    },
    {
      question: `How is ${SITE_NAME} different from WakaTime?`,
      answer:
        'Two things WakaTime does not do: every account keeps its complete coding history instead of a recent window, and line changes are split three ways — AI, human and Unattributed — with coverage reported as a percentage rather than guessed. AI work is also attributed to a named agent, provider and model, with estimated token cost per project.',
    },
    {
      question: `Can ${SITE_NAME} track time spent by AI agents like Claude Code?`,
      answer:
        "Yes. Bundled hooks for Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI attribute their edits, and a local agent reads those tools' on-device transcripts so work done with no editor open is still counted. Changes that cannot be proven either way stay Unattributed rather than being assigned to you.",
    },
    {
      question: 'How is coding time calculated?',
      answer:
        'Close heartbeats form duration blocks and a long gap closes one. Idle gaps are excluded.',
    },
    {
      question: 'Does it store source code?',
      answer:
        'No. Heartbeats contain file metadata and counts, not source contents, prompts or AI responses.',
    },
    {
      question: `How much does ${SITE_NAME} cost?`,
      answer: `Planned launch pricing is $${PRICING.monthlyUsd}/month or $${PRICING.annualUsd}/year. Checkout is not open during Early Access.`,
    },
  ],
} as const;

export const TH_HOME = {
  badge: 'ประวัติครบถ้วน และรองรับ WakaTime API',
  title: 'AtoAxis — ติดตามเวลาเขียนโค้ด และวิเคราะห์การใช้ AI',
  headline: ['ทุกเวลาที่เขียนโค้ด', 'เห็นภาพชัดกว่าเดิม'],
  highlights: ['เก็บประวัติครบ', 'รองรับ WakaTime', 'ไม่อัปโหลดโค้ด'],
  tagline: 'เข้าใจงานของคุณ ในไทม์ไลน์เดียว',
  // Same length budget as the English description above.
  description: `${SITE_NAME} ติดตามเวลาเขียนโค้ด วิเคราะห์โปรเจกต์และสัดส่วนงานจาก AI รองรับ WakaTime เก็บประวัติครบ พร้อมแสดงความครอบคลุมของข้อมูลผู้เขียน`,
  heroLead: `${SITE_NAME} ช่วยติดตามเวลาเขียนโค้ด แยกตามโปรเจกต์ ภาษา และ editor พร้อมดูสัดส่วนงานจาก AI ในไทม์ไลน์เดียว เชื่อมต่อ WakaTime plugin เดิม เก็บประวัติครบถ้วน และเห็นชัดว่าข้อมูลส่วนใดยังระบุผู้เขียนไม่ได้`,
  keyTakeaways: [
    `${SITE_NAME} บันทึกเวลาเขียนโค้ดของคุณจาก editor heartbeat โดยเก็บเฉพาะ metadata ไม่เก็บ source code`,
    'รองรับ WakaTime API จึงใช้ plugin WakaTime เดิมชี้มาที่นี่ได้ และนำเข้า WakaTime export ได้',
    'ทุกบัญชีเก็บประวัติการเขียนโค้ดไว้ครบถ้วน ไม่ใช่แค่ช่วงเวลาล่าสุด',
    'แยกบรรทัดที่มาจาก AI, มนุษย์ และ Unattributed ออกจากกัน พร้อมรายงาน coverage จริงแทนการเดา',
    `Early Access: ราคาที่วางแผนไว้คือ $${PRICING.monthlyUsd}/เดือน หรือ $${PRICING.annualUsd}/ปี และยังไม่เปิดให้ชำระเงิน`,
  ],
  whatIs: [
    `${SITE_NAME} คือบริการติดตามเวลาเขียนโค้ดและวิเคราะห์การใช้ AI สำหรับนักพัฒนา เราเปลี่ยน heartbeat จาก editor ของคุณ เป็นรายงานแยกตามโปรเจกต์ ภาษา branch และ editor`,
    'ระบบรองรับ WakaTime API และเก็บประวัติการเขียนโค้ดของคุณครบถ้วน integration ที่เชื่อมต่อจะรายงานการแก้ไขจาก AI มนุษย์ และส่วนที่ยังระบุไม่ได้ พร้อมบอกความครอบคลุมของข้อมูล ตอนนี้เราเปิด Early Access แบบเชิญ',
    'ถ้าคุณเคยใช้ WakaTime มาก่อน คุณชี้ plugin เดิมมาที่ AtoAxis ได้เลย ไม่ต้องติดตั้ง editor ใหม่ และนำเข้า WakaTime export เพื่อดูประวัติเดิมต่อใน dashboard เดียวกันได้',
    'Heartbeat ที่ส่งไปยัง AtoAxis มีเฉพาะ metadata และตัวเลข ไม่ส่ง source code, prompt หรือคำตอบของ AI ส่วนผู้ให้บริการ AI ที่คุณเชื่อมต่อมีนโยบายข้อมูลของตนเอง',
  ],
  howItWorks: [
    'editor ของคุณจะส่ง heartbeat เมื่อพิมพ์ เปลี่ยนไฟล์ หรือ save โดยแต่ละครั้งมีเฉพาะ metadata เช่น file path, project, branch, language, editor และระบบปฏิบัติการ ไม่มีเนื้อหาในไฟล์',
    'ระบบจะรวม heartbeat ที่เกิดต่อเนื่องกันเป็น duration block และเมื่อเว้นช่วงนานพอ block นั้นจะถูกปิดแทนที่จะนับต่อ เวลาที่ไม่ได้ทำงานจึงไม่ถูกนับเป็นเวลาเขียนโค้ด',
    'ส่วนบรรทัดที่เปลี่ยนจะถูกแยกเป็นสามทาง คือ AI, มนุษย์ และ Unattributed งานที่เราพิสูจน์ไม่ได้ว่ามาจากทางไหนจะคงสถานะ Unattributed แทนที่จะยกให้คุณ และทุกยอดรวมจะรายงาน coverage เป็นเปอร์เซ็นต์แทนการเดา',
    'ตัวอย่างเช่น ถ้าคุณเขียนโค้ดต่อเนื่อง 50 นาที แล้วลุกไปประชุม 40 นาที โดยเปิด editor ค้างไว้ ช่วงประชุมจะไม่มี heartbeat ใหม่ block จึงถูกปิด และเวลาประชุมไม่ถูกนับ คุณจึงเห็นเวลาเขียนโค้ดจริง ไม่ใช่เวลาที่หน้าต่างเปิดอยู่',
  ],
  useCases: [
    'ดูเวลาการเขียนโค้ดวันนี้ สัปดาห์นี้ หรือช่วงวันที่กำหนดเอง เพื่อรู้ว่าเวลาของคุณหมดไปกับอะไร',
    'แยกเวลาตามโปรเจกต์ ภาษา editor และ branch เมื่อคุณต้องสรุปงานหรือประเมินเวลาให้ลูกค้า',
    'กรองเฉพาะโปรเจกต์หรือภาษาเดียว แล้ว drill timeline, heatmap และรายชื่อไฟล์จากลิงก์เดียว',
    'เปรียบเทียบ AI-attributed lines กับ human keystrokes และ characters เพื่อดูว่า AI ช่วยงานคุณมากแค่ไหน',
    'ตั้งเป้าเวลาเขียนโค้ดรายวันหรือรายสัปดาห์ แล้ววัดเทียบกับ timeline เดียวกัน',
    'รวมหลาย checkout เป็นโปรเจกต์เดียวด้วย project rules และ merge เมื่อคุณ clone repo เดียวกันไว้หลายที่ ยอดเวลาจึงไม่กระจายหลายโปรเจกต์',
    'นำเข้า WakaTime export เพื่อดู history เดิมใน dashboard เดียวกัน',
  ],
  limitationsIntro: `นั่นคือข้อดีของ ${SITE_NAME} ในทางกลับกัน นี่คือสิ่งที่เรายังไม่ได้ทำ บอกไว้ตรง ๆ เพราะเราอยากให้คุณตัดสินใจไม่เลือกเราตั้งแต่ตอนนี้ ดีกว่ามาเจอทีหลังตอนย้ายมาแล้ว:`,
  limitations: [
    'มี first-party plugin สำหรับ VS Code เท่านั้น editor อื่นเชื่อมต่อผ่าน WakaTime protocol',
    'AI hooks รองรับ Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI ส่วน Cursor/Copilot ต้องมี adapter',
    'token และ cost แสดงเฉพาะเมื่อมี provider usage และราคาที่ตรวจสอบได้ ข้อมูลที่ไม่ครบจะแสดงว่าไม่พร้อมใช้งาน',
    'ไม่มีการเก็บกิจกรรมนอก editor ที่เชื่อมต่อหรือนอก AI transcript agent และยังไม่มี desktop หรือ browser client',
    'analytics อยู่ในขอบเขตบัญชีเดียว goals, leaderboards และ presence prototype ใช้ได้เมื่อ server รัน PostgreSQL แต่ team และ organisation dashboard เต็มรูปแบบยังอยู่ระหว่างพัฒนา',
    'แผน hosted ที่วางไว้ยังไม่มี free tier',
  ],
  atAGlance: {
    heading: `${SITE_NAME} โดยสรุป`,
    entries: [
      { label: 'ผลิตภัณฑ์', value: 'บริการติดตามเวลาเขียนโค้ดสำหรับนักพัฒนา (hosted)' },
      { label: 'สถานะ', value: `${PRODUCT_STATUS.th.label} — ยังไม่เปิดให้ชำระเงิน` },
      {
        label: 'ราคาที่วางแผนไว้',
        value: `$${PRICING.monthlyUsd} ต่อเดือน หรือ $${PRICING.annualUsd} ต่อปี`,
      },
      { label: 'โปรโตคอล', value: 'WakaTime API รวมถึงการนำเข้า WakaTime export' },
      { label: 'editor ที่เราดูแลเอง', value: 'VS Code' },
      {
        label: 'AI agent ที่มี hooks ให้',
        value: '5 ตัว — Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI',
      },
      {
        label: 'ภาษาที่ยืนยันด้วยการ parse',
        value: '9 ภาษา — Rust, Python, JavaScript, TypeScript, TSX, Go, C, C++, Objective-C',
      },
      { label: 'ประวัติที่เก็บ', value: 'ครบถ้วน ไม่ตัดเป็นช่วงเวลา' },
      { label: 'ข้อมูลต่อ heartbeat', value: 'metadata และตัวเลขของไฟล์ ไม่มีเนื้อหาในไฟล์' },
      { label: 'ภาษาของเว็บไซต์', value: 'อังกฤษและไทย' },
    ],
  },
  tableOfContents: [
    { id: 'what-is-atoaxis', label: `${SITE_NAME} คืออะไร?` },
    { id: 'how-it-works', label: 'ติดตามเวลาเขียนโค้ดอย่างไร' },
    { id: 'use-cases', label: 'ใช้ทำอะไรได้บ้าง' },
    { id: 'worked-example', label: 'ตัวอย่างการอ่าน dashboard' },
    { id: 'limitations', label: 'ยังทำอะไรไม่ได้บ้าง' },
    { id: 'faq', label: 'คำถามที่พบบ่อย' },
    { id: 'accountability', label: 'ผู้เผยแพร่และผู้ตรวจทานหน้านี้' },
    { id: 'sources', label: 'เราตรวจสอบข้อมูลอย่างไร' },
    { id: 'verdict', label: 'เหมาะกับคุณไหม' },
  ],
  sources: {
    heading: 'เราตรวจสอบข้อมูลเหล่านี้อย่างไร?',
    intro: `ทุกความสามารถที่อธิบายไว้ข้างบนตรวจสอบจากแหล่งต้นทางจริง ไม่ได้คัดลอกจากบทความเปรียบเทียบของคนอื่น เรายืนยัน 9 ภาษาด้วยการ parse จริง ไม่ใช่เดาจากนามสกุลไฟล์ และ 5 AI agent มี hook หรือ adapter ที่อธิบายไว้ในคู่มือ integration โดยเฉพาะการเทียบกับ WakaTime เราตรวจจาก wakatime.com เมื่อสิงหาคม 2026 และตรวจซ้ำทุกเดือน`,
    items: [
      {
        claim:
          'นักพัฒนา 84% ใช้หรือวางแผนจะใช้เครื่องมือ AI ในการพัฒนา แต่ 46% ไม่เชื่อถือความถูกต้องของผลลัพธ์จาก AI และมีเพียง 33% ที่เชื่อถือ',
        href: 'https://survey.stackoverflow.co/2025/ai',
        label: 'Stack Overflow Developer Survey 2025: AI',
      },
      {
        claim: `${SITE_NAME} รองรับ WakaTime API ทำให้ editor ที่มี plugin WakaTime อยู่แล้วส่งข้อมูลมาที่นี่ได้`,
        href: 'https://wakatime.com/developers',
        label: 'เอกสาร WakaTime API',
      },
      {
        claim: 'hooks ที่ให้มาระบุที่มาของงานที่ทำผ่าน Claude Code ได้',
        href: 'https://docs.anthropic.com/en/docs/claude-code/hooks',
        label: 'เอกสาร Claude Code hooks',
      },
      {
        claim: 'hooks ที่ให้มาระบุที่มาของงานที่ทำผ่าน Codex CLI ได้',
        href: 'https://github.com/openai/codex',
        label: 'OpenAI Codex CLI',
      },
      {
        claim: 'hooks ที่ให้มาระบุที่มาของงานที่ทำผ่าน Gemini CLI ได้',
        href: 'https://github.com/google-gemini/gemini-cli',
        label: 'Google Gemini CLI',
      },
      {
        claim:
          'ระบุภาษาด้วยการ parse ไฟล์จริง ไม่ใช่เดาจากนามสกุล มีไวยากรณ์รองรับ 9 ภาษา ได้แก่ Rust, Python, JavaScript, TypeScript, TSX, Go, C, C++ และ Objective-C จึงแยกนามสกุลกำกวมอย่าง .h ได้',
        href: 'https://tree-sitter.github.io/tree-sitter/',
        label: 'Tree-sitter',
      },
      {
        claim: 'ขอบเขตและสถานะของผลิตภัณฑ์อธิบายไว้ในคู่มือสาธารณะของ AtoAxis',
        href: PUBLIC_EVIDENCE_URL,
        label: 'เอกสารสาธารณะของ AtoAxis',
      },
    ],
  },
  verdict: {
    heading: `สรุปแล้ว ${SITE_NAME} เหมาะกับคุณไหม?`,
    fits: `${SITE_NAME} เหมาะที่สุดถ้าคุณเขียนโค้ดใน editor ที่รองรับ WakaTime อยู่แล้ว ต้องการประวัติครบถ้วนแทนช่วงเวลาล่าสุด และอยากรู้ว่างานที่ AI ทำจริง ๆ มีสัดส่วนเท่าไร โดยเฉพาะถ้าคุณทำหลายโปรเจกต์พร้อมกัน และใช้ Claude Code, Codex CLI หรือ Gemini CLI เป็นประจำ`,
    doesNotFit:
      'แต่ยังไม่เหมาะถ้าคุณต้องการ desktop หรือ browser client ถ้าทีมต้องการ organisation dashboard ร่วมกัน หรือถ้าคุณทำงานกับ Cursor หรือ Copilot เป็นหลัก เพราะสองตัวนี้ยังต้องมี adapter',
    closing: `เราวางแผนคิดราคา $${PRICING.monthlyUsd}/เดือน หรือ $${PRICING.annualUsd}/ปี แต่ยังไม่เปิดให้ชำระเงินในช่วง Early Access การเข้าร่วมรายชื่อตอนนี้จึงไม่มีค่าใช้จ่ายกับคุณ ถ้ายังไม่แน่ใจ ลองอ่านหน้าเปรียบเทียบกับ WakaTime ก่อนตัดสินใจ`,
  },
  faq: [
    {
      question: `${SITE_NAME} คืออะไร?`,
      answer: `${SITE_NAME} เปลี่ยน editor heartbeat เป็น analytics ของเวลา โปรเจกต์ ภาษา branch และ editor โดยไม่เก็บ source code หรือเนื้อหาการสนทนา`,
    },
    {
      question: `${SITE_NAME} ติดตาม activity อย่างไร?`,
      answer:
        'editor ส่ง heartbeat ที่มี metadata แล้วระบบรวมเหตุการณ์ที่เกิดใกล้กันเป็น duration block สำหรับสรุปรายวันและรายสัปดาห์',
    },
    {
      question: `${SITE_NAME} ใช้แทน WakaTime ได้หรือไม่?`,
      answer: `${SITE_NAME} รองรับ WakaTime API และนำเข้า export ได้ ความเหมาะสมขึ้นกับ editor และรายงานที่คุณใช้`,
    },
    {
      question: 'รองรับ editor ใดบ้าง?',
      answer: 'มี VS Code extension ของเราเอง ส่วน editor อื่นเชื่อมต่อผ่าน WakaTime plugin เดิม',
    },
    {
      question: 'ติดตาม AI coding ได้หรือไม่?',
      answer:
        'API รองรับ AI attribution และมี hook ของ Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI ส่วน Cursor/Copilot ต้องมี adapter',
    },
    {
      question: `${SITE_NAME} ต่างจาก WakaTime อย่างไร?`,
      answer:
        'สองอย่างที่ WakaTime ไม่มี: ทุกบัญชีเก็บประวัติการเขียนโค้ดครบถ้วนแทนที่จะเห็นแค่ช่วงล่าสุด และการเปลี่ยนแปลงบรรทัดถูกแยกเป็นสามกลุ่ม — AI, human และ Unattributed — พร้อมรายงาน coverage เป็นเปอร์เซ็นต์แทนการเดา อีกทั้งระบุงาน AI ตามชื่อ agent, provider และ model และประเมินต้นทุน token ต่อโปรเจกต์',
    },
    {
      question: `${SITE_NAME} ติดตามเวลาที่ AI agent อย่าง Claude Code เขียนโค้ดได้ไหม?`,
      answer:
        'ได้ มี hook สำหรับ Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI ที่ระบุที่มาของการแก้ไข และมี agent ประจำเครื่องอ่าน transcript ในเครื่องของเครื่องมือเหล่านั้น งานที่ทำตอนไม่ได้เปิด editor จึงยังถูกนับ ส่วนการเปลี่ยนแปลงที่พิสูจน์ไม่ได้จะคงเป็น Unattributed ไม่ถูกนับเป็นของคุณ',
    },
    {
      question: 'คำนวณ coding time อย่างไร?',
      answer:
        'heartbeat ที่เกิดใกล้กันจะเป็น duration block ช่วงว่างที่นานพอจะปิด block และไม่นับเป็นเวลาทำงาน',
    },
    {
      question: 'เก็บ source code หรือไม่?',
      answer:
        'ไม่เก็บ heartbeat มีเพียง file metadata และ counts ไม่มี source contents, prompt หรือ AI response',
    },
    {
      question: `${SITE_NAME} ราคาเท่าไร?`,
      answer: `ราคาเปิดตัวที่วางไว้คือ $${PRICING.monthlyUsd}/เดือน หรือ $${PRICING.annualUsd}/ปี แต่ checkout ยังไม่เปิดในช่วง Early Access`,
    },
  ],
} as const;

const teams = local(
  {
    metadataTitle: 'Coding Presence for Remote Teams — Early Access',
    description:
      'Explore AtoAxis coding presence for remote teams: opt-in prototype rooms and co-working sessions. Organisation seats and billing are still in development.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Teams', path: '/teams' },
    ],
    title: 'Coding presence for remote teams',
    badge: 'Prototype: live rooms work, team and org seats do not',
    lead: 'A live room that shows teammates who are actually coding, with avatars you can drag together to start a recorded co-working session. The room, invite links and sessions work today as a prototype wherever the server enables it. What is missing is the layer above them: organisations, assigned team seats and billing.',
    sections: [
      section('The problem', 'problem', [
        p(
          'Remote teams lose the ambient awareness an office gives you. Chat presence only says an app is open; it does not say whether someone is in flow or whether this is a good time to interrupt.'
        ),
      ]),
      section('Presence you cannot fake', 'how', [
        p(
          `${SITE_NAME} already receives editor heartbeats while you work. That same signal can answer whether someone is writing code without anyone setting a manual status.`
        ),
        p('A chat status reflects an open window. This reflects work.'),
      ]),
      section('How presence works', 'design', [
        sub('Rooms and invites, today'),
        p(
          'You create a room, share an invite link, and everyone who joins appears as an avatar with a working, idle or offline state derived from their own editor heartbeats.'
        ),
        sub('Dragging avatars together, today'),
        p(
          'Dragging two avatars together starts a recorded co-working session; its duration and participants land in both histories.'
        ),
        sub('Sub-teams, later'),
        p(
          'An organisation will divide assigned seats into smaller working groups, each with its own standing room. That layer is not built yet.'
        ),
      ]),
      section('What this will not be', 'principles', [
        p('Presence and surveillance are separated by design:'),
        bullets([
          'Everyone who can see the room appears in it, including owners and admins',
          'Only working, idle or offline is shown, never file paths, projects or branches',
          'Presence is opt-in and leaving a room does not leave the organisation',
          'Presence changes nothing about heartbeat storage',
        ]),
        p(
          'A room where everyone is equally visible feels like working together; an observer view is monitoring software.'
        ),
      ]),
      section('What you can use today', 'today', [
        p(
          'Individual tracking works today: coding time by project, language, branch and editor, keystroke and character counts, and complete history. The presence prototype above is also usable now wherever the server enables it, for ad-hoc rooms and invite links rather than standing team seats.'
        ),
      ]),
    ],
    related: [
      related([
        {
          href: '/developer-analytics',
          label: 'What is available today',
          description: 'Current metrics and how they are calculated',
        },
        {
          href: '/early-access',
          label: `Join ${SITE_NAME} Teams early access`,
          description: 'Register interest while the prototype is developed',
        },
        {
          href: '/privacy',
          label: 'What data is collected',
          description: 'Every heartbeat field and what is never recorded',
        },
      ]),
    ],
    faq: faq('Team presence FAQ', [
      {
        question: `Can I use team features in ${SITE_NAME} today?`,
        answer: `Partly. A presence prototype with live rooms, invite links and recorded co-working sessions is usable now wherever the server enables it. Assigned team seats, sub-teams and organisation billing are still in development.`,
      },
      {
        question: 'What is coding presence?',
        answer:
          'A live avatar view derived from editor heartbeats rather than a manually selected status.',
      },
      {
        question: 'Will managers watch developers?',
        answer:
          'No. Presence is mutual and shows activity state only, never file paths, projects or branches.',
      },
      {
        question: 'How does it differ from chat tools?',
        answer:
          'It is derived from editor activity and is intended as an ambient team signal, not a chat product.',
      },
      {
        question: 'What does dragging avatars do?',
        answer: 'It records a co-working session with its duration and participants.',
      },
      {
        question: 'When is the full team version available?',
        answer:
          'There is no committed date. The presence prototype is usable now wherever it is enabled; organisation and assigned-seat support must land before it is a team product.',
      },
    ]),
    form: 'teams',
  },
  {
    metadataTitle: 'Coding Presence สำหรับทีมในช่วง Early Access',
    description:
      'presence ของ AtoAxis เป็น prototype ในช่วง Early Access: ห้องสดและ co-working session ที่บันทึกจาก activity ใน editor ส่วน team และ organisation seat ยังตามมาทีหลัง',
    breadcrumbs: [
      { name: 'หน้าหลัก', path: '/' },
      { name: 'Teams', path: '/teams' },
    ],
    title: 'Coding presence สำหรับทีม remote',
    badge: 'Prototype: ห้องสดใช้ได้ แต่ team และ org seat ยังไม่มี',
    lead: 'ห้องสดที่แสดงว่าเพื่อนร่วมทีมกำลังเขียนโค้ดจริงผ่าน avatar และลาก avatar มารวมกันเพื่อเริ่ม co-working session ที่บันทึกไว้ได้ ตัวห้อง ลิงก์เชิญ และ session ใช้งานได้แล้ววันนี้ในรูปแบบ prototype บน server ที่เปิดใช้ ส่วนที่ยังขาดคือชั้นบนของมัน คือ organisation, team seat ที่กำหนดให้ และระบบเรียกเก็บเงิน',
    sections: [
      section('ปัญหาที่ต้องการแก้', 'problem', [
        p(
          'ทีม remote ขาดการรับรู้แบบเดียวกับออฟฟิศ เช่น ใครกำลังโฟกัสอยู่หรือควรเข้าไปถามได้ไหม Chat presence บอกเพียงว่าเปิดแอป ไม่ได้บอกว่ากำลังทำงานจริง'
        ),
      ]),
      section('Presence ที่เสแสร้งไม่ได้', 'how', [
        p(
          `${SITE_NAME} รับ editor heartbeat ขณะทำงานอยู่แล้ว สัญญาณนี้ตอบได้ว่าคนกำลังเขียนโค้ดโดยไม่ต้องตั้งสถานะเอง`
        ),
        p('สถานะใน chat สะท้อนหน้าต่างที่เปิดอยู่ แต่ presence นี้สะท้อนงานจริง'),
      ]),
      section('Presence ทำงานอย่างไร', 'design', [
        sub('ห้องและลิงก์เชิญ ใช้ได้แล้ววันนี้'),
        p(
          'คุณสร้างห้อง แชร์ลิงก์เชิญ และทุกคนที่เข้าร่วมจะปรากฏเป็น avatar พร้อมสถานะ working, idle หรือ offline จาก editor heartbeat ของตัวเอง'
        ),
        sub('ลาก avatar มารวมกัน ใช้ได้แล้ววันนี้'),
        p(
          'ลาก avatar สองคนเข้าหากันเพื่อเริ่ม co-working session ที่บันทึกไว้ ระยะเวลาและสมาชิกจะเข้าไปอยู่ใน history ของทั้งสองฝ่าย'
        ),
        sub('Sub-teams ทีหลัง'),
        p(
          'องค์กรจะแบ่ง seat ที่กำหนดให้เป็นกลุ่มย่อย แต่ละกลุ่มมีห้องประจำของตัวเอง ชั้นนี้ยังไม่ได้สร้าง'
        ),
      ]),
      section('สิ่งที่ฟีเจอร์นี้จะไม่เป็น', 'principles', [
        p('เราแยก presence จาก surveillance ด้วย design ที่ชัดเจน:'),
        bullets([
          'ทุกคนที่เห็นห้องจะปรากฏตัวด้วย รวม owner และ admin',
          'แสดงเฉพาะ working, idle หรือ offline ไม่แสดง file path, project หรือ branch',
          'เป็น opt-in และออกจากห้องได้โดยไม่ออกจากองค์กร',
          'ไม่เปลี่ยนข้อมูลที่เก็บใน heartbeat',
        ]),
        p(
          'ห้องที่มองเห็นกันเท่าเทียมคือการทำงานร่วมกัน ส่วน observer view คือ monitoring software'
        ),
      ]),
      section('สิ่งที่ใช้ได้ในวันนี้', 'today', [
        p(
          'ตอนนี้ใช้ individual tracking ได้: เวลาตาม project, language, branch และ editor รวมถึง keystroke, character count และ history ครบถ้วน และ presence prototype ด้านบนก็ใช้ได้แล้วบน server ที่เปิดใช้ สำหรับห้องแบบเฉพาะกิจและลิงก์เชิญ ยังไม่ใช่ team seat ประจำ'
        ),
      ]),
    ],
    related: [
      related([
        {
          href: '/developer-analytics',
          label: 'สิ่งที่ใช้งานได้วันนี้',
          description: 'ดู metrics และวิธีคำนวณ',
        },
        {
          href: '/early-access',
          label: `เข้าร่วม ${SITE_NAME} Teams early access`,
          description: 'ลงทะเบียนความสนใจระหว่างพัฒนา prototype',
        },
        {
          href: '/privacy',
          label: 'ข้อมูลที่ระบบเก็บ',
          description: 'ดู heartbeat fields และสิ่งที่ไม่ถูกบันทึก',
        },
      ]),
    ],
    faq: faq('คำถามที่พบบ่อยเรื่อง team presence', [
      {
        question: `วันนี้ใช้ฟีเจอร์ทีมของ ${SITE_NAME} ได้หรือยัง?`,
        answer: `ได้บางส่วน presence prototype ที่มีห้องสด ลิงก์เชิญ และ co-working session ที่บันทึกไว้ ใช้งานได้แล้วบน server ที่เปิดใช้ ส่วน team seat ที่กำหนดให้ sub-teams และการเรียกเก็บเงินระดับองค์กรยังอยู่ระหว่างพัฒนา`,
      },
      {
        question: 'coding presence คืออะไร?',
        answer: 'มุมมอง avatar สดที่อ้างอิง editor heartbeat ไม่ใช่สถานะที่ตั้งเอง',
      },
      {
        question: 'ผู้จัดการจะดู developer ได้หรือไม่?',
        answer:
          'ไม่ได้ แสดงเพียง working, idle หรือ offline และไม่แสดง file path, project หรือ branch',
      },
      {
        question: 'ต่างจาก chat tool อย่างไร?',
        answer: 'อ้างอิง activity ใน editor และเป็นสัญญาณสำหรับทีม ไม่ใช่ chat product',
      },
      {
        question: 'ลาก avatar จะเกิดอะไรขึ้น?',
        answer: 'เริ่ม co-working session และบันทึกระยะเวลาและสมาชิก',
      },
      {
        question: 'เวอร์ชันทีมเต็มรูปแบบเปิดใช้เมื่อไร?',
        answer:
          'ยังไม่มีวันที่ยืนยัน presence prototype ใช้ได้แล้วบน server ที่เปิดใช้ แต่ต้องมี organisation และ assigned seat ก่อนจึงจะเป็นผลิตภัณฑ์สำหรับทีม',
      },
    ]),
    form: 'teams',
  }
);

const developerAnalytics = local(
  {
    metadataTitle: 'Developer Analytics and Coding Metrics',
    description:
      'Explore AtoAxis coding analytics for time, projects, languages, branches, keystrokes and AI-attributed versus human activity.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Developer analytics', path: '/developer-analytics' },
    ],
    title: 'Developer analytics and coding metrics',
    lead: `${SITE_NAME} turns editor heartbeats into total time, daily averages and breakdowns by project, language, editor, operating system and branch. Every view can be filtered and drilled into, and it also reports keystrokes, characters and AI-attributed lines.`,
    sections: [
      section('Metrics available', 'metrics', [
        sub('Time'),
        bullets([
          'Total time for today, 7 days, 30 days or a custom range',
          'Daily average, active days and best day',
          'Today’s running total and duration blocks',
        ]),
        sub('Breakdowns'),
        bullets([
          'Project, programming language, editor, operating system and branch',
          'Each item also shows how many distinct days you touched it, not just its total',
        ]),
        sub('Activity volume'),
        bullets(['Keystrokes, characters added/deleted, active days and raw heartbeat counts']),
        sub('AI attribution'),
        bullets(['AI lines by agent, AI heartbeat share and daily AI versus human series']),
      ]),
      section('Ranges and what counts as a day', 'ranges', [
        p(
          'Every metric is asked for over a range. Four named ranges exist alongside an explicit start and end date, and a day is a calendar day in the timezone the client sends, falling back to UTC when it sends none, so a session that runs past midnight lands where you expect it.'
        ),
        bullets([
          'today, last_7_days, last_30_days and all_time',
          'An explicit start and end date for anything else',
          'All time is bounded by your first recorded heartbeat, not by a retention window',
          'Ranges apply to breakdowns and daily series alike, so totals and charts always agree',
        ]),
      ]),
      section('Explore and drill in', 'explore', [
        p(
          'The numbers above are not a fixed report. One filter bar drives every view: narrow to a project, a language, a branch or an editor and the timeline, the breakdowns and the AI-versus-human split all recompute against the same range. The filter state lives in the URL, so a particular slice is a link you can bookmark or send.'
        ),
        bullets([
          'Activity timeline: when the work happened across the range, as blocks rather than one daily bar',
          'Human vs AI: the daily split between AI-attributed and hand-typed work, under any filter',
          'Projects: every project ranked for the current filter, each expandable to its files',
          'Activity heatmap: the day-of-week and hour-of-day pattern behind "when do I actually code"',
          'One duration model behind all four, so switching view never changes the total',
        ]),
      ]),
      section('How the numbers are produced', 'how', [
        p(
          'Heartbeats are rolled into daily aggregates in ClickHouse. Consecutive heartbeats form duration blocks; a long gap ends one and idle gaps are excluded.'
        ),
        sub('Why the total is lower than wall-clock time'),
        p(
          'A heartbeat is produced by an edit, a save or a file switch. Time spent reading, in a meeting or away from the keyboard produces none, so the gap closes the current block instead of extending it. The number is time spent changing code, which is the only quantity the editor can observe honestly.'
        ),
      ]),
      section('Per-project analytics', 'per-project', [
        p(
          'Every metric above also exists scoped to a single project, which is where most questions actually get answered: not how long you coded, but how long that project took.'
        ),
        bullets([
          'A daily time series for one project across the selected range',
          'The files touched inside the project, with their own totals',
          'The AI versus human split for that project alone',
          'Regex project rules and manual merges, so two checkouts of one repository stop counting as two projects',
        ]),
      ]),
      section('Attribution and coverage', 'attribution', [
        p(
          'Line changes resolve to one of three classes, and coverage is reported as a percentage rather than being hidden. A metric that cannot be established is null with the reason attached; it is never rendered as a confident zero.'
        ),
        bullets([
          'AI: lines a hook or client explicitly attributed to a named agent',
          'Human: keystrokes and characters the editor observed you type',
          'Unattributed: changes that arrived without proof of either, kept separate rather than guessed',
        ]),
      ]),
      section('Numbers you can re-derive', 'trust', [
        p(
          'Aggregates are a projection of the raw heartbeats, not the record itself, so they can be rebuilt. A rebuilt projection is published only once it reconciles, and each response carries the version it was built from.'
        ),
        bullets([
          'A day can be reprocessed from raw history without deleting anything',
          'A reconciliation that fails leaves the previous version readable instead of publishing a broken one',
          'Responses report the data version they were produced from, so a stale read is detectable',
          'The raw heartbeat stream is browsable directly, so any figure can be traced back to the events under it',
        ]),
      ]),
      section('Goals and leaderboards', 'goals', [
        p(
          'Two optional layers sit on top of the analytics, and both need the server to run PostgreSQL. Neither changes how coding time is measured.'
        ),
        bullets([
          'Goals: a daily, weekly or monthly target for coding time, optionally scoped to one project or language, tracked against the same canonical timeline. A goal can be an upper bound as easily as a lower one.',
          'Leaderboards: opt-in boards for coding time, hand-typed time, AI-attributed time or estimated AI spend, weekly or monthly. A board ranks only the people who joined it; nothing is compared automatically.',
        ]),
      ]),
      section('What is not measured', 'not-measured', [
        p(
          'The analytics here produce no productivity score and no quality estimate, and nothing in them ranks you automatically. Two opt-in extras sit alongside: leaderboards, which compare only the people who joined the same board, and a streak-and-level display on the overview. Work outside a connected editor or the AI transcript agent is not inferred.'
        ),
        bullets([
          'No single analytics number is presented as a verdict on a day',
          'No automatic comparison between accounts; leaderboards rank only opted-in members and require PostgreSQL on the server',
          'The streak, level and quest widgets on the overview are cosmetic and feed back into no metric',
          'No judgement of the code itself: lines changed is a volume, not a quality signal',
          'Nothing is inferred from typing speed or code shape to fill a gap in attribution',
        ]),
      ]),
    ],
    related: [
      related([
        {
          href: '/ai-coding-tracker',
          label: 'AI coding activity tracking',
          description: 'How AI attribution reaches these metrics',
        },
        {
          href: '/ai-cost-tracking',
          label: 'AI cost and token tracking',
          description: 'Token classes, estimated cost and per-project totals',
        },
        {
          href: '/integrations/vscode',
          label: 'VS Code time tracking',
          description: 'The editor client that produces the data',
        },
        {
          href: '/privacy',
          label: 'Heartbeat data',
          description: 'The exact fields behind each metric',
        },
      ]),
    ],
    faq: faq('Developer analytics FAQ', [
      {
        question: 'How is coding activity measured?',
        answer:
          'Editor activity is recorded and grouped into sessions instead of inferred from commits.',
      },
      {
        question: 'How is coding time calculated?',
        answer: 'Close heartbeats form a duration block and idle gaps are excluded.',
      },
      {
        question: 'What ranges are available?',
        answer: 'Today, 7 days, 30 days, all time and explicit start/end dates.',
      },
      {
        question: 'Can I see language usage?',
        answer: 'Yes. Each heartbeat carries a detected language and aggregate totals.',
      },
      {
        question: 'Are keystrokes counted?',
        answer: 'Yes. Keystrokes and characters are aggregated by project and day.',
      },
    ]),
  },
  {
    metadataTitle: 'AtoAxis Developer analytics และ coding metrics',
    description:
      'ดูเวลาเขียนโค้ดแยกตามโปรเจกต์ ภาษา editor และ branch พร้อม AI attribution และ coverage เรียนรู้วิธีคำนวณจาก heartbeat และข้อจำกัดของข้อมูลก่อนเปรียบเทียบผลงาน',
    breadcrumbs: [
      { name: 'หน้าหลัก', path: '/' },
      { name: 'Developer analytics', path: '/developer-analytics' },
    ],
    title: 'AtoAxis Developer analytics',
    lead: `${SITE_NAME} เปลี่ยน editor heartbeat เป็นเวลารวม ค่าเฉลี่ยต่อวัน และ breakdown ตาม project, language, editor, operating system และ branch ทุกมุมมองกรองและ drill down ต่อได้ พร้อม keystrokes, characters และ AI-attributed lines`,
    sections: [
      section('Metrics ที่มีให้ดู', 'metrics', [
        sub('เวลา'),
        bullets([
          'วันนี้ 7 วัน 30 วัน หรือช่วงวันที่กำหนดเอง',
          'ค่าเฉลี่ยต่อวัน active days และวันที่สูงสุด',
          'เวลาปัจจุบันและ duration blocks',
        ]),
        sub('Breakdown'),
        bullets([
          'Project, programming language, editor, operating system และ branch',
          'แต่ละรายการบอกด้วยว่าคุณแตะมันกี่วันไม่ซ้ำกัน ไม่ใช่แค่ยอดรวม',
        ]),
        sub('ปริมาณ activity'),
        bullets(['Keystrokes, characters เพิ่ม/ลบ, active days และ heartbeat count']),
        sub('AI attribution'),
        bullets(['AI lines ต่อ agent, สัดส่วน AI heartbeat และ daily AI เทียบ human']),
      ]),
      section('ช่วงเวลาและนิยามของ "หนึ่งวัน"', 'ranges', [
        p(
          'ทุก metric ต้องระบุช่วงเวลาเสมอ มีช่วงสำเร็จรูปสี่แบบและกำหนดวันเริ่ม-สิ้นสุดเองได้ และ "หนึ่งวัน" คือวันตามปฏิทินใน timezone ที่ client ส่งมา ถ้าไม่ส่งจะใช้ UTC งานที่ทำข้ามเที่ยงคืนจึงไปอยู่ในวันที่คุณคาดหวัง'
        ),
        bullets([
          'today, last_7_days, last_30_days และ all_time',
          'กำหนดวันเริ่มและวันสิ้นสุดเองสำหรับกรณีอื่น',
          'all_time นับจาก heartbeat แรกของคุณ ไม่ได้ถูกตัดด้วย retention window',
          'ช่วงเวลาเดียวกันใช้กับทั้ง breakdown และ daily series ยอดรวมกับกราฟจึงตรงกันเสมอ',
        ]),
      ]),
      section('สำรวจและ drill down', 'explore', [
        p(
          'ตัวเลขข้างบนไม่ใช่รายงานตายตัว filter bar ชุดเดียวขับทุกมุมมอง เลือกเจาะเฉพาะโปรเจกต์ ภาษา branch หรือ editor แล้ว timeline, breakdown และสัดส่วน AI เทียบ human จะคำนวณใหม่บนช่วงเดียวกัน สถานะ filter อยู่ใน URL การเจาะแบบหนึ่ง ๆ จึงเป็นลิงก์ที่ bookmark หรือส่งต่อได้'
        ),
        bullets([
          'Activity timeline: งานเกิดขึ้นตอนไหนตลอดช่วง แสดงเป็น block ไม่ใช่แท่งรายวันแท่งเดียว',
          'Human vs AI: สัดส่วนรายวันระหว่างงานที่ AI ทำกับที่พิมพ์เอง ภายใต้ filter ใดก็ได้',
          'Projects: ทุกโปรเจกต์เรียงตาม filter ปัจจุบัน กดขยายดูไฟล์ในแต่ละโปรเจกต์ได้',
          'Activity heatmap: รูปแบบตามวันในสัปดาห์และชั่วโมงในวัน เบื้องหลังคำถาม "จริง ๆ แล้วเขียนโค้ดตอนไหน"',
          'ทั้งสี่มุมมองใช้ duration model เดียวกัน สลับมุมมองแล้วยอดรวมไม่เปลี่ยน',
        ]),
      ]),
      section('ตัวเลขถูกสร้างขึ้นอย่างไร', 'how', [
        p(
          'Heartbeat ถูกรวมเป็น daily aggregate ใน ClickHouse heartbeat ที่เกิดใกล้กันเป็น duration block ช่วงว่างที่นานพอจะปิด block และไม่นับ idle gap'
        ),
        sub('ทำไมยอดรวมจึงน้อยกว่าเวลาที่นั่งอยู่จริง'),
        p(
          'heartbeat เกิดจากการแก้ไข การ save และการสลับไฟล์ เวลาที่ใช้อ่านโค้ด ประชุม หรือลุกออกจากโต๊ะจะไม่สร้าง heartbeat ช่วงว่างนั้นจึงปิด block แทนที่จะต่อเวลาให้ ตัวเลขที่ได้คือเวลาที่ลงมือเปลี่ยนโค้ดจริง ซึ่งเป็นสิ่งเดียวที่ editor สังเกตได้อย่างซื่อตรง'
        ),
      ]),
      section('Analytics ระดับโปรเจกต์', 'per-project', [
        p(
          'ทุก metric ข้างต้นดูแยกรายโปรเจกต์ได้ด้วย ซึ่งมักเป็นคำถามที่ต้องการคำตอบจริง ๆ ไม่ใช่ว่าเขียนโค้ดไปกี่ชั่วโมง แต่โปรเจกต์นั้นใช้เวลาไปเท่าไร'
        ),
        bullets([
          'กราฟรายวันของโปรเจกต์เดียวตลอดช่วงที่เลือก',
          'ไฟล์ที่แตะในโปรเจกต์นั้นพร้อมยอดของแต่ละไฟล์',
          'สัดส่วน AI เทียบ human เฉพาะโปรเจกต์นั้น',
          'project rule แบบ regex และการ merge เอง เพื่อไม่ให้ checkout สองที่ของ repository เดียวถูกนับเป็นสองโปรเจกต์',
        ]),
      ]),
      section('Attribution และความครอบคลุมของข้อมูล', 'attribution', [
        p(
          'การเปลี่ยนแปลงบรรทัดถูกจัดเป็นสามกลุ่ม และรายงาน coverage เป็นเปอร์เซ็นต์แทนที่จะซ่อนไว้ metric ที่ยืนยันไม่ได้จะเป็น null พร้อมเหตุผล ไม่ถูกแสดงเป็นเลขศูนย์ที่ดูเหมือนมั่นใจ'
        ),
        bullets([
          'AI: บรรทัดที่ hook หรือ client ระบุชัดว่ามาจาก agent ชื่อใด',
          'Human: keystroke และ character ที่ editor เห็นว่าคุณพิมพ์เอง',
          'Unattributed: การเปลี่ยนแปลงที่ไม่มีหลักฐานทั้งสองฝั่ง เก็บแยกไว้แทนที่จะเดา',
        ]),
      ]),
      section('ตัวเลขที่คำนวณย้อนกลับได้', 'trust', [
        p(
          'ค่า aggregate เป็นเพียง projection ของ heartbeat ดิบ ไม่ใช่ตัวบันทึกหลัก จึงสร้างใหม่ได้ และ projection ที่สร้างใหม่จะถูกเผยแพร่ก็ต่อเมื่อกระทบยอดตรงแล้ว โดยทุก response แนบเวอร์ชันของข้อมูลที่ใช้สร้างมาด้วย'
        ),
        bullets([
          'ประมวลผลข้อมูลของวันหนึ่งใหม่จาก history ดิบได้โดยไม่ต้องลบอะไร',
          'ถ้ากระทบยอดไม่ผ่าน ระบบจะคงเวอร์ชันเดิมที่อ่านได้ไว้ แทนที่จะเผยแพร่ตัวที่ผิด',
          'response บอก data version ที่ใช้สร้าง ทำให้รู้ได้ว่ากำลังอ่านข้อมูลเก่าอยู่หรือไม่',
          'เปิดดู stream ของ heartbeat ดิบได้โดยตรง ทุกตัวเลขจึงย้อนกลับไปหาเหตุการณ์ที่อยู่เบื้องหลังได้',
        ]),
      ]),
      section('Goals และ leaderboards', 'goals', [
        p(
          'มีสองชั้นเสริมแบบเลือกใช้อยู่บน analytics ทั้งคู่ต้องให้ server รัน PostgreSQL และไม่มีชั้นไหนเปลี่ยนวิธีวัด coding time'
        ),
        bullets([
          'Goals: ตั้งเป้าเวลาเขียนโค้ดรายวัน รายสัปดาห์ หรือรายเดือน จะเจาะเฉพาะโปรเจกต์หรือภาษาเดียวก็ได้ วัดเทียบกับ canonical timeline ชุดเดียวกัน และเป้าจะเป็นขอบบน (ไม่เกิน) ก็ได้เหมือนขอบล่าง',
          'Leaderboards: บอร์ดแบบ opt-in สำหรับเวลาเขียนโค้ดรวม เวลาที่พิมพ์เอง เวลาที่ AI ทำ หรือค่าใช้จ่าย AI โดยประมาณ รายสัปดาห์หรือรายเดือน บอร์ดจัดอันดับเฉพาะคนที่เข้าร่วม ไม่มีการเทียบอัตโนมัติ',
        ]),
      ]),
      section('สิ่งที่ระบบไม่ได้วัด', 'not-measured', [
        p(
          'หน้า analytics ไม่สร้าง productivity score และไม่ประเมินคุณภาพ และไม่มีอะไรในนั้นจัดอันดับคุณโดยอัตโนมัติ มีส่วนเสริมแบบ opt-in สองอย่างอยู่ข้าง ๆ คือ leaderboard ที่เทียบเฉพาะคนที่เข้าร่วมบอร์ดเดียวกัน และการแสดง streak กับ level บนหน้า overview ส่วนงานที่อยู่นอก editor ที่เชื่อมต่อหรือนอก AI transcript agent จะไม่ถูกอนุมาน'
        ),
        bullets([
          'ไม่มีตัวเลข analytics ตัวเดียวที่ถูกนำเสนอเป็นคำตัดสินของทั้งวัน',
          'ไม่มีการเปรียบเทียบระหว่างบัญชีโดยอัตโนมัติ leaderboard จัดอันดับเฉพาะสมาชิกที่ opt-in และต้องมี PostgreSQL บน server',
          'widget streak, level และ quest บนหน้า overview เป็นของประดับ ไม่ป้อนกลับไปที่ metric ใด',
          'ไม่ตัดสินคุณภาพของโค้ด จำนวนบรรทัดคือปริมาณ ไม่ใช่สัญญาณคุณภาพ',
          'ไม่เดาจากความเร็วการพิมพ์หรือรูปแบบโค้ดเพื่อเติมช่องว่างของ attribution',
        ]),
      ]),
    ],
    related: [
      related([
        {
          href: '/ai-coding-tracker',
          label: 'ติดตาม AI coding activity',
          description: 'วิธีเติม AI attribution เข้า metrics',
        },
        {
          href: '/ai-cost-tracking',
          label: 'ติดตาม token และค่าใช้จ่าย AI',
          description: 'ประเภท token ค่าใช้จ่ายโดยประมาณ และยอดรายโปรเจกต์',
        },
        {
          href: '/integrations/vscode',
          label: 'ติดตามเวลาบน VS Code',
          description: 'client ที่สร้างข้อมูล',
        },
        {
          href: '/privacy',
          label: 'ข้อมูลใน heartbeat',
          description: 'fields ที่อยู่เบื้องหลัง metrics',
        },
      ]),
    ],
    faq: faq('คำถามที่พบบ่อยเรื่อง Developer analytics', [
      {
        question: 'วัด coding activity อย่างไร?',
        answer: 'บันทึก activity จาก editor แล้วรวมเป็น session แทนการเดาจากจำนวน commit',
      },
      {
        question: 'คำนวณ coding time อย่างไร?',
        answer: 'heartbeat ใกล้กันเป็น duration block และไม่นับ idle gap',
      },
      {
        question: 'เลือกช่วงเวลาอะไรได้บ้าง?',
        answer: 'Today, 7 วัน, 30 วัน, all time หรือกำหนด start/end',
      },
      {
        question: 'ดูภาษาได้หรือไม่?',
        answer: 'ได้ heartbeat มี detected language และ aggregate totals',
      },
      {
        question: 'นับ keystrokes หรือไม่?',
        answer: 'นับ keystrokes และ characters แยกตาม project และวัน',
      },
    ]),
  }
);

const simplePages: Partial<Record<MarketingPageKey, Localized<MarketingPageCopy>>> = {
  '/developer-analytics': developerAnalytics,
  '/teams': teams,
};

const page = (path: string, en: MarketingPageCopy, th: MarketingPageCopy) => {
  simplePages[path as MarketingPageKey] = local(en, th);
};

page(
  '/wakatime-alternative',
  {
    metadataTitle: 'WakaTime Alternative for Developer Time Tracking',
    description:
      'AtoAxis is a hosted WakaTime alternative with API compatibility, complete coding history, import support and transparent AI coverage.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'WakaTime alternative', path: '/wakatime-alternative' },
    ],
    title: 'WakaTime alternative for developer time tracking',
    lead: `${SITE_NAME} implements the WakaTime API, so an existing plugin can point to it with one config change. Every account keeps complete coding history, while AI token and cost metrics remain available only when provider usage and a known price are present.`,
    sections: [
      section('What is an alternative?', 'what-is', [
        p(
          `${SITE_NAME} records coding time by project, language, branch, editor and operating system. Heartbeats also carry keystroke counts and optional AI attribution.`
        ),
      ]),
      section('Why developers compare tools', 'why', [
        p(
          'Compare history retention, protocol compatibility, language detail, privacy and the AI metrics you can prove from your provider.'
        ),
      ]),
      section('When to stay with WakaTime', 'stay-with-wakatime', [
        bullets([
          'You need the widest official editor plugin coverage',
          'You need automatic Cursor or Copilot integrations today',
          'You need assigned team seats, an organisation rollup or a free tier today',
          'You need token and cost reports that your provider already exposes',
        ]),
      ]),
      section('Switching is a config change', 'switching', [
        p(
          'Editors that use the WakaTime protocol can send to the hosted API without replacing their plugin.'
        ),
        code(
          '[settings]\napi_url = https://api.atoaxis.com/api/v1\napi_key = your_generated_api_key',
          '~/.wakatime.cfg'
        ),
        p('Create an API key in your account. VS Code also has a first-party extension.'),
      ]),
      section('Honest comparison', 'comparison', [
        p(
          'The comparison table below is a dated snapshot. Check each provider’s current documentation before making a decision.'
        ),
      ]),
      section('Who it is for', 'who-for', [
        p(
          'Individual developers who want complete history and explainable project analytics during Early Access. Assigned team seats and organisation-wide reporting are still in development.'
        ),
      ]),
      section('Getting started', 'getting-started', [
        p(
          'Join Early Access, create an account, generate an API key, then install the VS Code extension or repoint an existing WakaTime plugin.'
        ),
      ]),
    ],
    component: { kind: 'comparison', afterSectionId: 'comparison' },
    related: [
      related([
        {
          href: '/early-access',
          label: `Join ${SITE_NAME} early access`,
          description: 'Hosted launch updates and access',
        },
        {
          href: '/integrations/vscode',
          label: 'VS Code time tracking',
          description: 'Install and configure the first-party extension',
        },
        {
          href: '/pricing',
          label: `${SITE_NAME} pricing`,
          description: 'Planned monthly and annual billing',
        },
      ]),
    ],
    faq: faq('WakaTime alternative FAQ', [
      {
        question: `Is ${SITE_NAME} an alternative to WakaTime?`,
        answer: `${SITE_NAME} implements the WakaTime API and can import an export; fit depends on your editors and reports.`,
      },
      {
        question: 'Do I need to replace my plugin?',
        answer:
          'No. Point an existing WakaTime plugin at the hosted API, or use the VS Code extension.',
      },
      {
        question: 'Can I import history?',
        answer: 'Yes, WakaTime exports can be reprocessed into the same dashboards.',
      },
      {
        question: 'Does it report AI tokens and cost?',
        answer:
          'Only when provider-reported usage and a known effective price are available; otherwise coverage is unknown.',
      },
      {
        question: 'Is it free?',
        answer:
          'Checkout is not open. Planned launch pricing is the paid hosted plan shown on the pricing page.',
      },
    ]),
  },
  {
    metadataTitle: 'ทางเลือก WakaTime สำหรับติดตามเวลานักพัฒนา',
    description:
      'เปรียบเทียบ AtoAxis กับระบบติดตามเวลาเดิม: รองรับ WakaTime API นำเข้าประวัติได้ เก็บประวัติครบ และแสดง AI attribution พร้อมข้อจำกัดที่ควรตรวจสอบก่อนย้าย',
    breadcrumbs: [
      { name: 'หน้าหลัก', path: '/' },
      { name: 'ทางเลือก WakaTime', path: '/wakatime-alternative' },
    ],
    title: 'ทางเลือก WakaTime ที่เก็บประวัติครบถ้วน',
    lead: `${SITE_NAME} รองรับ WakaTime API จึงเปลี่ยน config เพียงจุดเดียวเพื่อส่งข้อมูลจาก plugin เดิมได้ ทุกบัญชีเก็บ coding history ครบ ส่วน token และ cost จะแสดงเมื่อมี provider usage และราคาที่พิสูจน์ได้เท่านั้น`,
    sections: [
      section('ทางเลือกหมายถึงอะไร', 'what-is', [
        p(
          `${SITE_NAME} เก็บเวลาตาม project, language, branch, editor และ operating system พร้อม keystroke counts และ AI attribution ที่ส่งมาอย่างชัดเจน`
        ),
      ]),
      section('เหตุผลที่นักพัฒนาเปรียบเทียบ', 'why', [
        p(
          'เปรียบเทียบการเก็บ history, API compatibility, รายละเอียดภาษา, privacy และ metrics ของ AI ที่พิสูจน์ได้จาก provider'
        ),
      ]),
      section('กรณีที่ควรใช้ WakaTime ต่อ', 'stay-with-wakatime', [
        bullets([
          'ต้องการ editor plugin ทางการจำนวนมาก',
          'ต้องการ Cursor หรือ Copilot อัตโนมัติในวันนี้',
          'ต้องการ team seat ที่กำหนดให้ organisation rollup หรือ free tier ทันที',
          'ต้องการ token และ cost ที่ provider รายงานอยู่แล้ว',
        ]),
      ]),
      section('เปลี่ยนด้วย config เดียว', 'switching', [
        p('editor ที่ใช้ WakaTime protocol ส่งเข้ามาที่ hosted API ได้โดยไม่ต้องเปลี่ยน plugin'),
        code(
          '[settings]\napi_url = https://api.atoaxis.com/api/v1\napi_key = your_generated_api_key',
          '~/.wakatime.cfg'
        ),
        p('สร้าง API key ในบัญชี และใช้ first-party extension สำหรับ VS Code ได้เช่นกัน'),
      ]),
      section('การเปรียบเทียบอย่างตรงไปตรงมา', 'comparison', [
        p(
          'ตารางด้านล่างเป็น snapshot ที่มีวันที่ตรวจสอบ ควรดูเอกสารปัจจุบันของแต่ละ provider ก่อนตัดสินใจ'
        ),
      ]),
      section('เหมาะกับใคร', 'who-for', [
        p(
          'นักพัฒนารายบุคคลที่ต้องการ history ครบและ analytics ที่อธิบายได้ในช่วง Early Access ส่วน team seat ที่กำหนดให้และรายงานระดับองค์กรยังอยู่ระหว่างพัฒนา'
        ),
      ]),
      section('เริ่มต้นใช้งาน', 'getting-started', [
        p(
          'ลงทะเบียน Early Access สร้างบัญชีและ API key จากนั้นติดตั้ง VS Code extension หรือเปลี่ยนปลายทางของ WakaTime plugin เดิม'
        ),
      ]),
    ],
    component: { kind: 'comparison', afterSectionId: 'comparison' },
    related: [
      related([
        {
          href: '/early-access',
          label: `เข้าร่วม ${SITE_NAME} early access`,
          description: 'ข่าวการเปิดใช้งาน hosted service',
        },
        {
          href: '/integrations/vscode',
          label: 'ติดตามเวลาบน VS Code',
          description: 'ติดตั้งและตั้งค่า extension',
        },
        {
          href: '/pricing',
          label: `ราคา ${SITE_NAME}`,
          description: 'ราคาแบบรายเดือนและรายปีที่วางแผนไว้',
        },
      ]),
    ],
    faq: faq('คำถามที่พบบ่อยเรื่องทางเลือก WakaTime', [
      {
        question: `${SITE_NAME} ใช้แทน WakaTime ได้หรือไม่?`,
        answer: `${SITE_NAME} รองรับ WakaTime API และนำเข้า export ได้ ความเหมาะสมขึ้นกับ editor และรายงานที่ใช้`,
      },
      {
        question: 'ต้องเปลี่ยน plugin หรือไม่?',
        answer: 'ไม่ต้อง เปลี่ยน api_url ของ WakaTime plugin เดิม หรือใช้ VS Code extension',
      },
      {
        question: 'นำเข้า history ได้หรือไม่?',
        answer: 'ได้ ระบบนำเข้า WakaTime export เข้า dashboard เดียวกัน',
      },
      {
        question: 'มี AI token และ cost หรือไม่?',
        answer:
          'มีเฉพาะเมื่อ provider รายงาน usage และมีราคาที่ตรวจสอบได้ มิฉะนั้นจะแสดง coverage ว่าไม่พร้อมใช้งาน',
      },
      {
        question: 'ใช้ฟรีหรือไม่?',
        answer: 'checkout ยังไม่เปิด ราคาเปิดตัวที่วางแผนไว้ดูได้ในหน้าราคา',
      },
    ]),
  }
);

function dualPage(
  path: string,
  en: { breadcrumbs: MarketingPageCopy['breadcrumbs'] } & Omit<MarketingPageCopy, 'breadcrumbs'>,
  th: { breadcrumbs: MarketingPageCopy['breadcrumbs'] } & Omit<MarketingPageCopy, 'breadcrumbs'>
) {
  page(path, en, th);
}

dualPage(
  '/ai-coding-tracker',
  {
    metadataTitle: 'AI Coding Activity Tracking',
    description:
      'See how AtoAxis records AI-assisted coding with agent names and line counts without storing prompts, responses or source code.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'AI coding tracker', path: '/ai-coding-tracker' },
    ],
    title: 'AI coding activity tracking',
    lead: `${SITE_NAME} records AI-assisted work alongside ordinary coding. Agent names and AI line counts are supplied by a hook or client and aggregated per agent and day; unproven activity remains Unattributed rather than being guessed as human.`,
    sections: [
      section('Why time alone is incomplete', 'why', [
        p(
          'Elapsed editor time cannot distinguish a hand-typed function from a large accepted AI suggestion. Attribution keeps both signals visible.'
        ),
      ]),
      section(`How ${SITE_NAME} tracks AI work`, 'how', [
        p('A client posts explicit AI metadata with the heartbeat.'),
        code(
          '{\n  "is_ai_generated": true,\n  "ai_agent": "your-agent-name",\n  "ai_lines_added": 42,\n  "ai_lines_deleted": 3\n}',
          'POST /api/v1/heartbeats.bulk'
        ),
        p('The server aggregates line counts, human keystrokes, agent totals and daily series.'),
      ]),
      section('Supported AI tools', 'supported-tools', [
        p(
          'Bundled hooks cover Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI. Cursor and Copilot need provider-specific adapters.'
        ),
        sub('How fields are populated'),
        bullets([
          'Verified bundled hooks post an event id and provider metadata',
          'Your own wrapper can post the AI fields directly',
          'WakaTime imports with an AI category remain AI-attributed',
        ]),
      ]),
      section('AI, human and unattributed', 'attribution-classes', [
        p(
          'Every line change lands in one of three classes, and the third one is the point. A tool that only has "AI" and "human" has to guess when it cannot tell, and a guess in a metric you will use to make decisions is worse than an admission.'
        ),
        bullets([
          'AI: a hook or client named the agent that made the change',
          'Human: the editor observed the keystrokes and characters',
          'Unattributed: the change arrived without proof of either, and is reported as its own quantity',
        ]),
        p(
          'Unattributed is normal, not an error. Pasting from a browser, a refactor run by a tool without a hook, or a merge all produce real work that nothing can honestly attribute. Its share is visible so you can decide whether it is small enough to ignore.'
        ),
      ]),
      section('Agents that edit outside the editor', 'outside-editor', [
        p(
          'A terminal agent has no editor events to hook. When Claude Code rewrites six files while VS Code is closed, an editor plugin sees nothing, so a per-user agent reads each tool’s own local transcript instead and turns new events into AI-attributed heartbeats.'
        ),
        bullets([
          'The agent runs as a per-user service and checks active transcripts on a short interval',
          'It reads local transcript files only, and sends identifiers and line counts from them',
          'Work done with the editor closed is still recorded, with the same attribution',
          'A saved cursor tracks what has been read, so restarting it does not re-send events',
        ]),
      ]),
      section('Turning it on', 'setup', [
        p(
          'The VS Code setup flow detects which agents are installed and registers hooks for them. It never edits another tool’s configuration without asking first.'
        ),
        code(
          'Command Palette: AtoAxis: Show AI Tracking Status\nCommand Palette: AtoAxis: Set Up AI Tracking\nCommand Palette: AtoAxis: Repair AI Integrations',
          'VS Code'
        ),
        p('The same state is readable, and the same work is doable, from the terminal.'),
        code(
          'wakaclock-cli ai status              # what each agent looks like right now\nwakaclock-cli ai sync --dry-run      # parse without sending or advancing anything\nwakaclock-cli agent status           # is the always-on transcript service running',
          'Terminal'
        ),
      ]),
      section('AI metrics and coverage', 'compare-wakatime', [
        p(
          'Token usage and estimated cost are not invented. They appear only when provider-reported tokens and a versioned effective price are available; subscription activity without authoritative pricing is null with coverage metadata.'
        ),
        sub('What coverage means here'),
        bullets([
          'Token totals separate input, output and cache reads and writes when the provider reports them',
          'Estimated spend needs both the usage and a price that was in effect at the time',
          'Each of attribution, tokens and cost carries its own coverage percentage',
          'A missing value is null with its coverage, never a zero that reads like a measurement',
        ]),
      ]),
      section('What is recorded', 'what-is-recorded', [
        bullets([
          'AI flag, agent name and AI lines added/deleted',
          'Human keystrokes and character counts',
          'Project, branch, language, file path and timestamps',
        ]),
        sub('What is never recorded'),
        bullets(['Prompts or model responses', 'Source file contents, patches or transcripts']),
      ]),
      section('Privacy', 'privacy', [
        p(
          'AI attribution uses the same metadata-only pipeline as ordinary heartbeats. No conversation body is stored.'
        ),
      ]),
    ],
    related: [
      related([
        {
          href: '/ai-cost-tracking',
          label: 'AI cost and token tracking',
          description: 'What each agent consumed, and what it is estimated to cost',
        },
        {
          href: '/privacy',
          label: 'Heartbeat privacy',
          description: 'Fields stored and fields that never leave the editor',
        },
        {
          href: '/developer-analytics',
          label: 'Developer analytics',
          description: 'Daily AI, human and unattributed metrics',
        },
        {
          href: '/docs/getting-started',
          label: 'Getting started',
          description: 'Connect an editor before sending activity',
        },
      ]),
    ],
    faq: faq('AI tracking FAQ', [
      {
        question: 'What is AI coding activity tracking?',
        answer:
          'It separates AI-attributed lines from duration and human keystrokes using client-supplied metadata.',
      },
      {
        question: `Does ${SITE_NAME} support Claude Code, Codex, Gemini, Kilo Code and Kimi Code CLI?`,
        answer: 'Bundled hooks support all five; Cursor and Copilot require adapters.',
      },
      {
        question: 'Are prompts or responses stored?',
        answer: 'No. Only identifiers and counts are accepted.',
      },
      {
        question: 'Are token and cost metrics available?',
        answer:
          'Only with provider-reported usage and a known effective price; otherwise they are unknown.',
      },
      {
        question: 'What happens to unproven activity?',
        answer: 'It is classified as Unattributed rather than guessed as Human.',
      },
      {
        question: 'Can I import WakaTime AI activity?',
        answer: 'Yes. Heartbeats with an AI category keep their attribution.',
      },
    ]),
  },
  {
    metadataTitle: 'ติดตาม AI Coding Activity',
    description:
      'ติดตาม AI coding ด้วยชื่อ agent จำนวนบรรทัด และ attribution coverage แยกงาน AI, human และ Unattributed พร้อมอธิบายข้อจำกัด โดยไม่เก็บ prompt หรือ source code',
    breadcrumbs: [
      { name: 'หน้าหลัก', path: '/' },
      { name: 'AI coding tracker', path: '/ai-coding-tracker' },
    ],
    title: 'ติดตาม AI coding activity',
    lead: `${SITE_NAME} บันทึกงานที่มี AI ช่วยไว้ใน timeline เดียวกับงานทั่วไป โดย hook หรือ client ส่งชื่อ agent และ AI line counts แล้วระบบรวมตาม agent และวัน กิจกรรมที่พิสูจน์ไม่ได้จะเป็น Unattributed ไม่เดาเป็น Human`,
    sections: [
      section('ทำไมเวลาอย่างเดียวไม่พอ', 'why', [
        p(
          'เวลาใน editor แยกไม่ได้ว่าฟังก์ชันถูกพิมพ์เองหรือรับ suggestion ขนาดใหญ่จาก AI การมี attribution ทำให้เห็นสองสัญญาณพร้อมกัน'
        ),
      ]),
      section(`${SITE_NAME} ติดตามงาน AI อย่างไร`, 'how', [
        p('client ส่ง AI metadata ที่ระบุชัดไปพร้อม heartbeat'),
        code(
          '{\n  "is_ai_generated": true,\n  "ai_agent": "your-agent-name",\n  "ai_lines_added": 42,\n  "ai_lines_deleted": 3\n}',
          'POST /api/v1/heartbeats.bulk'
        ),
        p('server รวม line counts, human keystrokes, agent totals และ daily series'),
      ]),
      section('เครื่องมือ AI ที่รองรับ', 'supported-tools', [
        p(
          'bundled hooks รองรับ Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI ส่วน Cursor/Copilot ต้องมี adapter ของ provider'
        ),
        sub('วิธีเติมข้อมูล'),
        bullets([
          'bundled hook ส่ง event id และ provider metadata ที่ตรวจสอบได้',
          'wrapper ของคุณส่ง AI fields ได้โดยตรง',
          'WakaTime import ที่มี AI category จะคง attribution',
        ]),
      ]),
      section('AI, human และ unattributed', 'attribution-classes', [
        p(
          'ทุกการเปลี่ยนแปลงบรรทัดถูกจัดเข้าหนึ่งในสามกลุ่ม และกลุ่มที่สามคือหัวใจ เครื่องมือที่มีแค่ "AI" กับ "human" จำเป็นต้องเดาเมื่อแยกไม่ออก และการเดาใน metric ที่คุณจะใช้ตัดสินใจนั้นแย่กว่าการยอมรับตรง ๆ ว่าไม่รู้'
        ),
        bullets([
          'AI: hook หรือ client ระบุชื่อ agent ที่ทำการเปลี่ยนแปลงนั้น',
          'Human: editor เห็น keystroke และ character ที่พิมพ์จริง',
          'Unattributed: การเปลี่ยนแปลงที่ไม่มีหลักฐานทั้งสองฝั่ง และถูกรายงานเป็นค่าของตัวเอง',
        ]),
        p(
          'Unattributed เป็นเรื่องปกติ ไม่ใช่ข้อผิดพลาด การวางโค้ดจาก browser การ refactor ด้วยเครื่องมือที่ไม่มี hook หรือการ merge ล้วนเป็นงานจริงที่ไม่มีใครระบุที่มาได้อย่างซื่อตรง ระบบจึงแสดงสัดส่วนของมันไว้ให้คุณตัดสินเองว่าน้อยพอจะมองข้ามหรือไม่'
        ),
      ]),
      section('Agent ที่แก้ไฟล์นอก editor', 'outside-editor', [
        p(
          'agent ที่ทำงานบน terminal ไม่มี event ของ editor ให้ hook เมื่อ Claude Code แก้ไฟล์หกไฟล์ตอนที่ปิด VS Code อยู่ plugin ของ editor จะไม่เห็นอะไรเลย ระบบจึงใช้ agent ประจำเครื่องอ่าน transcript ในเครื่องของเครื่องมือแต่ละตัวแทน แล้วแปลง event ใหม่เป็น heartbeat ที่ระบุว่าเป็น AI'
        ),
        bullets([
          'agent ทำงานเป็น service ของผู้ใช้และตรวจ transcript ที่ยัง active เป็นระยะสั้น ๆ',
          'อ่านเฉพาะไฟล์ transcript ในเครื่อง แล้วส่งเพียงตัวระบุและจำนวนบรรทัดจากไฟล์นั้น',
          'งานที่ทำตอนปิด editor ยังถูกบันทึกด้วย attribution แบบเดียวกัน',
          'มี cursor บันทึกว่าอ่านถึงไหนแล้ว การรีสตาร์ทจึงไม่ส่ง event ซ้ำ',
        ]),
      ]),
      section('วิธีเปิดใช้งาน', 'setup', [
        p(
          'ขั้นตอนตั้งค่าใน VS Code จะตรวจว่ามี agent ตัวใดติดตั้งอยู่แล้วลง hook ให้ตัวนั้น และจะไม่แก้ config ของเครื่องมืออื่นโดยไม่ถามก่อน'
        ),
        code(
          'Command Palette: AtoAxis: Show AI Tracking Status\nCommand Palette: AtoAxis: Set Up AI Tracking\nCommand Palette: AtoAxis: Repair AI Integrations',
          'VS Code'
        ),
        p('สถานะเดียวกันนี้อ่านได้และสั่งงานได้จาก terminal เช่นกัน'),
        code(
          'wakaclock-cli ai status              # ตอนนี้ agent แต่ละตัวอยู่ในสถานะใด\nwakaclock-cli ai sync --dry-run      # อ่านและแสดงผลโดยไม่ส่งและไม่เลื่อน cursor\nwakaclock-cli agent status           # service อ่าน transcript ทำงานอยู่หรือไม่',
          'Terminal'
        ),
      ]),
      section('AI metrics และ coverage', 'compare-wakatime', [
        p(
          'ระบบไม่สร้าง token usage หรือ estimated cost ขึ้นเอง จะแสดงเมื่อ provider รายงาน token และมีราคาที่มีผลใช้งานเท่านั้น หากเป็น subscription ที่ไม่มีราคายืนยัน ค่า cost จะเป็น null พร้อม coverage metadata'
        ),
        sub('coverage ในที่นี้หมายถึงอะไร'),
        bullets([
          'ยอด token แยก input, output และ cache อ่าน/เขียน เมื่อ provider รายงานมา',
          'estimated spend ต้องมีทั้งข้อมูลการใช้งานและราคาที่มีผลอยู่ ณ เวลานั้น',
          'attribution, token และ cost ต่างมีเปอร์เซ็นต์ coverage ของตัวเอง',
          'ค่าที่ไม่มีจะเป็น null พร้อม coverage ไม่ใช่เลขศูนย์ที่ดูเหมือนผลการวัด',
        ]),
      ]),
      section('ข้อมูลที่บันทึก', 'what-is-recorded', [
        bullets([
          'AI flag, ชื่อ agent และ AI lines เพิ่ม/ลบ',
          'Human keystrokes และ character counts',
          'Project, branch, language, file path และ timestamp',
        ]),
        sub('สิ่งที่ไม่เคยบันทึก'),
        bullets(['Prompt หรือ model response', 'Source file, patch หรือ transcript body']),
      ]),
      section('Privacy', 'privacy', [
        p(
          'AI attribution ใช้ pipeline แบบ metadata เดียวกับ heartbeat ปกติ ไม่มี conversation body'
        ),
      ]),
    ],
    related: [
      related([
        {
          href: '/ai-cost-tracking',
          label: 'ติดตาม token และค่าใช้จ่าย AI',
          description: 'agent ใช้ token ไปเท่าไร และประมาณค่าใช้จ่ายเท่าไร',
        },
        {
          href: '/privacy',
          label: 'Privacy ของ heartbeat',
          description: 'fields ที่เก็บและสิ่งที่ไม่ออกจาก editor',
        },
        {
          href: '/developer-analytics',
          label: 'Developer analytics',
          description: 'metrics รายวันของ AI, human และ unattributed',
        },
        {
          href: '/docs/getting-started',
          label: 'เริ่มต้นใช้งาน',
          description: 'เชื่อม editor ก่อนส่ง activity',
        },
      ]),
    ],
    faq: faq('คำถามที่พบบ่อยเรื่อง AI tracking', [
      {
        question: 'AI coding activity คืออะไร?',
        answer:
          'การแยกงานที่มี AI ช่วยออกจากเวลาและ keystrokes ของมนุษย์โดยใช้ metadata ที่ client รายงาน',
      },
      {
        question: 'รองรับ Claude Code, Codex, Gemini, Kilo Code และ Kimi Code CLI หรือไม่?',
        answer: 'มี bundled hooks สำหรับทั้งห้ารายการ ส่วน Cursor/Copilot ต้องมี adapter',
      },
      {
        question: 'เก็บ prompt หรือ response หรือไม่?',
        answer: 'ไม่เก็บ schema มีเฉพาะ identifiers และ counts',
      },
      {
        question: 'token และ cost แสดงหรือไม่?',
        answer:
          'แสดงเมื่อ provider รายงาน tokens และมีราคาที่มีผลใช้งานชัดเจน มิฉะนั้นเป็น unknown',
      },
      {
        question: 'กิจกรรมที่พิสูจน์ไม่ได้ถูกนับเป็นอะไร?',
        answer: 'จัดเป็น Unattributed ไม่เดาเป็น Human',
      },
      {
        question: 'นำเข้าจาก WakaTime ได้หรือไม่?',
        answer: 'ได้ heartbeat ที่มี AI category จะคง attribution ไว้',
      },
    ]),
  }
);

function emptyPagePair(path: string, en: MarketingPageCopy, th: MarketingPageCopy) {
  page(path, en, th);
}

const baseRelated = (en: MarketingLinkCopy[], th: MarketingLinkCopy[], heading?: string) => ({
  en: [related(en, heading)],
  th: [related(th, heading)],
});

emptyPagePair(
  '/integrations',
  {
    metadataTitle: 'Developer Time Tracking Integrations',
    description:
      'Connect VS Code, WakaTime-compatible editor plugins and supported AI coding agents to AtoAxis while keeping source code and prompts out of heartbeats.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Integrations', path: '/integrations' },
    ],
    title: 'Developer time tracking integrations',
    lead: 'Connect the editor you already use. VS Code has a first-party extension; other editors can use their WakaTime-compatible plugin and point its api_url at the hosted API.',
    sections: [
      section('First-party integrations', 'first-party', [
        sub('VS Code'),
        p(
          'The AtoAxis extension buffers editor metadata, sends heartbeats through wakaclock-cli and shows today’s coding time in the status bar.'
        ),
        sub('AI hooks'),
        p(
          'The setup flow can configure Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI hooks without sending prompt or response content.'
        ),
        sub('Device authorization'),
        p(
          'A CLI or third-party integration can be authorized with a short code you approve in the dashboard, so it never has to be handed your API key. Approval grants only the scopes the integration asked for.'
        ),
      ]),
      section('WakaTime protocol', 'protocol', [
        p(
          'Neovim, JetBrains, Vim and other editors with a WakaTime plugin can set api_url and api_key. Their plugin controls its own behavior and update cadence.'
        ),
        sub('What that means in practice'),
        bullets([
          'No new extension to install: the plugin you already trust keeps running',
          'The plugin decides what it sends, so its own feature set is the ceiling, not ours',
          'Time, project, language, editor and branch arrive the same way they would from our own client',
          'Fields a plugin never sends, such as AI attribution, simply stay empty rather than being guessed',
        ]),
      ]),
      section('What reaches the server, whichever client you use', 'payload', [
        p(
          'The heartbeat is the contract. Whether it came from our extension, a WakaTime plugin or your own script, the server accepts the same shape and derives the same analytics from it.'
        ),
        bullets([
          'File path, project and Git branch',
          'Detected language, editor, operating system and machine',
          'Line, cursor, keystroke and character counts',
          'Activity category, optional AI attribution fields and the timestamp',
        ]),
      ]),
      section('Not supported yet', 'not-supported', [
        p(
          'Stated plainly, because discovering a gap after switching is worse than reading about it now.'
        ),
        bullets([
          'Cursor and Copilot: their activity needs a provider-specific adapter before it can be attributed',
          'Zed: a language-server client exists but there is no installable Zed extension wrapping it yet',
          'Design and 3D tools: no Figma or Blender client is published',
          'No desktop or browser client, so work outside a connected editor is not captured at all',
        ]),
      ]),
    ],
    related: baseRelated(
      [
        {
          href: '/integrations/vscode',
          label: 'VS Code integration',
          description: 'Installation, settings and supported events',
        },
        {
          href: '/docs/getting-started',
          label: 'Getting started',
          description: 'Create an API key and verify tracking',
        },
      ],
      [
        {
          href: '/integrations/vscode',
          label: 'VS Code integration',
          description: 'การติดตั้ง settings และ events ที่รองรับ',
        },
        {
          href: '/docs/getting-started',
          label: 'เริ่มต้นใช้งาน',
          description: 'สร้าง API key และตรวจสอบ tracking',
        },
      ],
      'Start here'
    ).en,
    faq: faq('Integration questions', [
      {
        question: 'Which editor integration should I start with?',
        answer:
          'Use the first-party AtoAxis extension for VS Code. For Neovim, JetBrains, Vim and other supported editors, keep the WakaTime-compatible plugin and point its api_url at AtoAxis.',
      },
      {
        question: 'Which AI coding agents have bundled hooks?',
        answer:
          'The setup flow includes hooks for Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI.',
      },
      {
        question: 'Do integrations send source code or AI conversations?',
        answer:
          'No. Heartbeats contain metadata and counts. Source code, prompts and responses are not part of the heartbeat payload.',
      },
      {
        question: 'Can I use an existing WakaTime-compatible plugin?',
        answer:
          'Yes. Configure its api_url and api_key for AtoAxis. The fields available still depend on what that plugin sends.',
      },
      {
        question: 'Are Cursor and Copilot attributed yet?',
        answer:
          'No. Their activity needs provider-specific adapters, so AtoAxis does not claim attribution for them today.',
      },
    ]),
  },
  {
    metadataTitle: 'การเชื่อมต่อ Editor กับ AtoAxis',
    description:
      'เชื่อม VS Code ผ่าน extension ของ AtoAxis หรือใช้ WakaTime-compatible plugin กับ editor อื่น ดูวิธีตั้งค่า API, ตรวจ heartbeat แรก และขอบเขตข้อมูลที่แต่ละ client ส่ง',
    breadcrumbs: [
      { name: 'หน้าหลัก', path: '/' },
      { name: 'Integrations', path: '/integrations' },
    ],
    title: 'การเชื่อมต่อ Editor กับ AtoAxis',
    lead: 'เชื่อมต่อ editor ที่คุณใช้อยู่ได้เลย VS Code มี first-party extension ส่วน editor อื่นใช้ WakaTime-compatible plugin แล้วเปลี่ยน api_url ให้ชี้ไป hosted API',
    sections: [
      section('การเชื่อมต่อที่เราดูแลเอง', 'first-party', [
        sub('VS Code'),
        p(
          'AtoAxis extension buffer metadata จาก editor ส่ง heartbeat ผ่าน wakaclock-cli และแสดง coding time วันนี้ใน status bar'
        ),
        sub('AI hooks'),
        p(
          'ขั้นตอนตั้งค่าสามารถติดตั้ง hook ของ Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI โดยไม่ส่ง prompt หรือ response'
        ),
        sub('Device authorization'),
        p(
          'CLI หรือ integration ของบุคคลที่สามขออนุญาตได้ด้วยรหัสสั้น ๆ ที่คุณกดอนุมัติใน dashboard จึงไม่ต้องมอบ API key ให้ การอนุมัติให้เฉพาะ scope ที่ integration ร้องขอเท่านั้น'
        ),
      ]),
      section('WakaTime protocol', 'protocol', [
        p(
          'Neovim, JetBrains, Vim และ editor อื่นที่มี WakaTime plugin ตั้ง api_url และ api_key ได้ behavior และรอบอัปเดตยังขึ้นกับ plugin นั้น'
        ),
        sub('ในทางปฏิบัติหมายความว่าอย่างไร'),
        bullets([
          'ไม่ต้องติดตั้ง extension ใหม่ plugin ที่คุณไว้ใจอยู่แล้วยังทำงานต่อได้',
          'plugin เป็นผู้ตัดสินว่าจะส่งอะไร ความสามารถของมันจึงเป็นเพดาน ไม่ใช่ของเรา',
          'เวลา, project, language, editor และ branch มาถึงเหมือนกับที่ client ของเราส่ง',
          'field ที่ plugin ไม่เคยส่ง เช่น AI attribution จะว่างไว้เฉย ๆ ไม่ถูกเดาขึ้นมา',
        ]),
      ]),
      section('ข้อมูลที่ไปถึง server ไม่ว่าจะใช้ client ตัวไหน', 'payload', [
        p(
          'heartbeat คือข้อตกลงกลาง ไม่ว่าจะมาจาก extension ของเรา, WakaTime plugin หรือสคริปต์ที่คุณเขียนเอง server รับโครงสร้างเดียวกันและสร้าง analytics แบบเดียวกันจากมัน'
        ),
        bullets([
          'File path, project และ Git branch',
          'ภาษาที่ตรวจพบ, editor, operating system และ machine',
          'จำนวนบรรทัด ตำแหน่ง cursor keystroke และ character',
          'ประเภทกิจกรรม, AI attribution fields ที่เลือกส่งได้ และ timestamp',
        ]),
      ]),
      section('สิ่งที่ยังไม่รองรับ', 'not-supported', [
        p('บอกไว้ตรง ๆ เพราะการมาพบช่องโหว่หลังย้ายระบบแล้วแย่กว่าการได้อ่านตั้งแต่ตอนนี้'),
        bullets([
          'Cursor และ Copilot: กิจกรรมของทั้งคู่ต้องมี adapter เฉพาะผู้ให้บริการก่อนจึงจะ attribute ได้',
          'Zed: มี language-server client อยู่แล้ว แต่ยังไม่มี extension ของ Zed ที่ติดตั้งได้มาห่อหุ้มมัน',
          'เครื่องมือออกแบบและงาน 3D: ยังไม่มี client สำหรับ Figma หรือ Blender',
          'ไม่มี client บน desktop หรือ browser งานที่ทำนอก editor ที่เชื่อมต่อไว้จึงไม่ถูกบันทึกเลย',
        ]),
      ]),
    ],
    related: baseRelated(
      [
        {
          href: '/integrations/vscode',
          label: 'VS Code integration',
          description: 'การติดตั้ง settings และ events ที่รองรับ',
        },
        {
          href: '/docs/getting-started',
          label: 'เริ่มต้นใช้งาน',
          description: 'สร้าง API key และตรวจสอบ tracking',
        },
      ],
      [
        {
          href: '/integrations/vscode',
          label: 'VS Code integration',
          description: 'การติดตั้ง settings และ events ที่รองรับ',
        },
        {
          href: '/docs/getting-started',
          label: 'เริ่มต้นใช้งาน',
          description: 'สร้าง API key และตรวจสอบ tracking',
        },
      ],
      'เริ่มต้นที่นี่'
    ).th,
    faq: faq('คำถามเรื่อง Integration', [
      {
        question: 'ควรเริ่มจาก editor integration ตัวไหน?',
        answer:
          'ถ้าใช้ VS Code ให้เริ่มจาก AtoAxis extension ส่วน Neovim, JetBrains, Vim และ editor อื่นที่รองรับ ให้ใช้ WakaTime-compatible plugin เดิมแล้วตั้ง api_url มาที่ AtoAxis',
      },
      {
        question: 'มี hook สำหรับ AI coding agent ตัวใดบ้าง?',
        answer:
          'ขั้นตอน setup มี hook สำหรับ Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI',
      },
      {
        question: 'Integration ส่ง source code หรือบทสนทนา AI หรือไม่?',
        answer:
          'ไม่ Heartbeat มีเฉพาะ metadata และ counts โดยไม่มี source code, prompt หรือ response อยู่ใน payload',
      },
      {
        question: 'ใช้ WakaTime-compatible plugin เดิมได้หรือไม่?',
        answer:
          'ได้ ตั้ง api_url และ api_key ของ plugin ให้ชี้มาที่ AtoAxis โดย field ที่มีจะยังขึ้นกับสิ่งที่ plugin นั้นส่ง',
      },
      {
        question: 'ตอนนี้รองรับ attribution ของ Cursor และ Copilot หรือยัง?',
        answer:
          'ยัง กิจกรรมของทั้งคู่ต้องใช้ adapter เฉพาะผู้ให้บริการ AtoAxis จึงยังไม่อ้างว่าแยก attribution ได้',
      },
    ]),
  }
);

/**
 * The section hub a nested page belongs under.
 *
 * Without this, a nested page's breadcrumb jumped straight from Home to itself, so the
 * hub had no inbound link from its own child and nothing pointed at it except the
 * sitemap. The trail is rendered as real anchors and emitted as `BreadcrumbList`, so
 * adding the middle step gives the hub a crawl path from every page beneath it.
 */
const GENERIC_BREADCRUMB_PARENTS: Partial<
  Record<MarketingPageKey, { en: string; path: MarketingPageKey; th: string }>
> = {
  '/docs/getting-started': { en: 'Docs', path: '/docs', th: 'เอกสาร' },
  '/docs/migrate-from-wakatime': { en: 'Docs', path: '/docs', th: 'เอกสาร' },
  '/integrations/vscode': { en: 'Integrations', path: '/integrations', th: 'การเชื่อมต่อ' },
};

// The remaining pages use the same strongly typed section model. Keeping their copy here,
// rather than in route files, prevents the Thai pages from silently becoming short adapters.
//
// Every `generic()` page now supplies its own `faqEntries` — real, specific answers written
// against this page's content — rather than the placeholder "see the section above" text a
// generated `faqCount` used to produce. Keep writing real entries for any new page.
const genericFaq = (
  locale: SiteLocale,
  entries?: readonly FaqEntry[]
): MarketingPageCopy['faq'] => {
  if (!entries) return undefined;
  return faq(locale === 'en' ? 'Frequently asked questions' : 'คำถามที่พบบ่อย', entries);
};
const generic = (
  path: MarketingPageKey,
  en: {
    description: string;
    faqEntries?: readonly FaqEntry[];
    form?: MarketingPageCopy['form'];
    headings: string[];
    lead: string;
    title: string;
  },
  th: {
    description: string;
    faqEntries?: readonly FaqEntry[];
    form?: MarketingPageCopy['form'];
    headings: string[];
    lead: string;
    title: string;
  }
) => {
  const parent = GENERIC_BREADCRUMB_PARENTS[path];
  const make = (value: typeof en, locale: SiteLocale): MarketingPageCopy => ({
    metadataTitle: value.title,
    description: value.description,
    breadcrumbs: [
      { name: locale === 'en' ? 'Home' : 'หน้าหลัก', path: '/' },
      ...(parent ? [{ name: parent[locale], path: parent.path }] : []),
      { name: value.title, path },
    ],
    title: value.title,
    lead: value.lead,
    sections: value.headings.map((heading, index) =>
      section(
        heading,
        `${path.slice(1).replaceAll('/', '-')}-${index + 1}`,
        genericBlocks(path, heading, index, locale)
      )
    ),
    form: value.form,
    howTo:
      path === '/docs/getting-started' || path === '/docs/migrate-from-wakatime'
        ? { name: value.title, description: value.description }
        : undefined,
    component: path === '/pricing' ? { kind: 'pricing', afterSectionId: null } : undefined,
    schema: path === '/about' ? 'organization' : undefined,
    related: genericRelated(path, locale),
    faq: genericFaq(locale, value.faqEntries),
  });
  simplePages[path] = local(make(en, 'en'), make(th, 'th'));
};
/**
 * Hand-written blocks for the sections a reader actually follows step by step, keyed by
 * `path#sectionIndex`. Everything not listed here still falls through to the generic
 * paragraph at the bottom of `genericBlocks`.
 *
 * Commands, setting keys and file paths are quoted verbatim from the shipped code —
 * `backend/api/crates/wakaclock-cli/src/main.rs` (subcommands),
 * `backend/api/crates/wakaclock-core/src/config.rs` (`~/.wakaclock/config.toml` keys) and
 * `extensions/vscode/package.json` (command titles and settings). The product is marketed
 * as AtoAxis while the binary, config directory and setting keys still ship as
 * `wakaclock-*`, so the instructions say `wakaclock` wherever the reader must type it.
 */
const DOC_BLOCKS = new Map<string, (en: boolean) => MarketingBlock[]>([
  [
    '/docs#0',
    (en) => [
      p(
        en
          ? 'Start with Getting started: it takes an account from zero to a first verified heartbeat. The other pages answer questions that come up afterwards.'
          : 'เริ่มที่หน้าเริ่มต้นใช้งาน ซึ่งพาจากบัญชีเปล่าไปจนถึง heartbeat แรกที่ยืนยันแล้ว ส่วนหน้าอื่นตอบคำถามที่ตามมาภายหลัง'
      ),
      bullets(
        en
          ? [
              'Getting started: requirements, API key, editor setup, verification',
              'Migrate from WakaTime: keep your plugin, change two settings, import your history',
              'How coding time is calculated: heartbeat intervals, idle timeout and duration examples',
              'AI attribution and coverage: evidence for AI, human and Unattributed changes',
              'AI cost methodology: token classes, effective prices and unknown estimates',
              'VS Code integration: what the extension sends, its settings and its limits',
              'AI coding tracker: how Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI activity is attributed',
              'Privacy: the exact heartbeat fields, and the fields that do not exist',
            ]
          : [
              'เริ่มต้นใช้งาน: สิ่งที่ต้องเตรียม, API key, การตั้งค่า editor และการตรวจสอบ',
              'ย้ายจาก WakaTime: ใช้ plugin เดิม แก้สองค่า แล้ว import ประวัติ',
              'วิธีคำนวณเวลาการเขียนโค้ด: heartbeat, idle timeout และตัวอย่าง duration',
              'AI attribution และ coverage: หลักฐานของ AI, human และ Unattributed',
              'วิธีคำนวณค่าใช้จ่าย AI: ประเภท token ราคา effective และยอดที่ไม่ทราบ',
              'VS Code integration: extension ส่งอะไร มี settings อะไร และมีข้อจำกัดอะไร',
              'AI coding tracker: วิธี attribute งานจาก Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI',
              'Privacy: field ใน heartbeat ทั้งหมด และ field ที่ไม่มีอยู่จริง',
            ]
      ),
    ],
  ],

  [
    '/docs#1',
    (en) => [
      p(
        en
          ? 'Use the getting-started guide when you are connecting the service for the first time. It explains the account, API key and client requirements before it asks you to change editor settings. The guide then follows the data path from your editor to the first heartbeat visible in the dashboard, so each step has a result you can check before moving on.'
          : 'ใช้คู่มือเริ่มต้นใช้งานเมื่อต้องการเชื่อมบริการเป็นครั้งแรก คู่มืออธิบายบัญชี API key และ client ที่ต้องมีก่อนแก้ settings ของ editor จากนั้นจะพาตรวจเส้นทางข้อมูลตั้งแต่ editor จนเห็น heartbeat แรกใน dashboard ทำให้ตรวจผลแต่ละขั้นตอนได้ก่อนทำขั้นตอนต่อไป'
      ),
      code(
        'wakaclock-cli config set-key YOUR_API_KEY\nwakaclock-cli status',
        en ? 'First verification commands' : 'คำสั่งตรวจสอบเบื้องต้น'
      ),
      p(
        en
          ? 'Keep the key out of repositories and shared terminal logs. If the first record does not appear, check the server URL and CLI path before installing another client. Changing one variable at a time makes the failing boundary easier to identify.'
          : 'อย่าเก็บ key ไว้ใน repository หรือ terminal log ที่แชร์ร่วมกัน หากข้อมูลแรกยังไม่ปรากฏ ให้ตรวจ server URL และ CLI path ก่อนติดตั้ง client เพิ่ม การเปลี่ยนทีละจุดช่วยให้หาขอบเขตที่มีปัญหาได้ง่ายขึ้น'
      ),
    ],
  ],

  [
    '/docs#2',
    (en) => [
      p(
        en
          ? 'Read the integrations overview to choose a client path, then open the VS Code page for first-party settings and commands. Editors with an existing WakaTime plugin use the same heartbeat protocol, but the plugin decides which optional fields it sends. Read the privacy page for a field-by-field account of metadata that may reach the service and content that never belongs in a heartbeat.'
          : 'อ่านภาพรวม integrations เพื่อเลือกวิธีเชื่อม client จากนั้นเปิดหน้า VS Code สำหรับ settings และคำสั่งของ extension ที่เราดูแลเอง Editor ที่มี WakaTime plugin ใช้ heartbeat protocol เดียวกัน แต่ plugin เป็นผู้กำหนด optional fields ที่ส่ง อ่านหน้า privacy เพื่อดู metadata ที่อาจถึงบริการและข้อมูลที่ไม่ควรอยู่ใน heartbeat'
      ),
      bullets(
        en
          ? [
              'Integration evidence: client settings, commands and known limitations',
              'Privacy evidence: heartbeat fields, transport and deletion boundaries',
              'AI evidence: supported hooks, attribution classes and coverage limits',
            ]
          : [
              'หลักฐาน integration: settings, commands และข้อจำกัดของ client',
              'หลักฐาน privacy: fields ใน heartbeat การรับส่ง และขอบเขตการลบ',
              'หลักฐาน AI: hooks ที่รองรับ กลุ่ม attribution และข้อจำกัดของ coverage',
            ]
      ),
    ],
  ],

  [
    '/integrations/vscode#2',
    (en) => [
      code(
        'Extensions: install "AtoAxis — Developer Time Tracking"\nCommand Palette: AtoAxis: Set API Key\nCommand Palette: AtoAxis: Configure CLI Path   # only if the binary is not on PATH',
        'VS Code'
      ),
      p(
        en
          ? 'The key goes into VS Code secret storage, not settings.json, so it is never synced or committed with the rest of your editor configuration.'
          : 'key จะถูกเก็บใน secret storage ของ VS Code ไม่ใช่ settings.json จึงไม่ถูก sync หรือ commit ไปพร้อมกับ config อื่นของ editor'
      ),
    ],
  ],

  [
    '/docs/getting-started#0',
    (en) => [
      p(
        en
          ? 'Three pieces have to be in place before the first heartbeat: an editor AtoAxis can hear from, the CLI that actually delivers heartbeats, and a key that identifies your account. During Early Access, keys are issued to people on the list rather than at signup.'
          : 'ก่อนส่ง heartbeat แรกต้องมีสามอย่างพร้อม คือ editor ที่ AtoAxis รับข้อมูลได้, CLI ที่ทำหน้าที่ส่ง heartbeat จริง และ key ที่ระบุบัญชีของคุณ ช่วง Early Access เราออก key ให้เฉพาะผู้ที่อยู่ในรายชื่อ ไม่ได้ออกให้ทันทีตอนสมัคร'
      ),
      bullets(
        en
          ? [
              'VS Code 1.90 or newer for the first-party extension, or any editor that already has a WakaTime plugin',
              'wakaclock-cli on your PATH, or an absolute path in the wakaclock.cliPath setting: the extension buffers activity but never contacts the server itself',
              'An AtoAxis account plus an API key generated from the dashboard',
              'Outbound HTTPS. Heartbeats that cannot be delivered are queued locally in ~/.wakaclock/queue.db and resent later, so a flight or a dropped VPN does not lose the day',
            ]
          : [
              'VS Code 1.90 ขึ้นไปสำหรับ extension ของเราเอง หรือ editor ใดก็ได้ที่มี WakaTime plugin อยู่แล้ว',
              'มี wakaclock-cli ใน PATH หรือกำหนด path เต็มไว้ที่ setting wakaclock.cliPath เพราะ extension แค่เก็บ activity แต่ไม่ได้ติดต่อ server เอง',
              'บัญชี AtoAxis และ API key ที่สร้างจาก dashboard',
              'การเชื่อมต่อ HTTPS ขาออก heartbeat ที่ส่งไม่สำเร็จจะถูกคิวไว้ที่ ~/.wakaclock/queue.db แล้วส่งใหม่ภายหลัง ข้อมูลของวันนั้นจึงไม่หาย',
            ]
      ),
    ],
  ],

  [
    '/docs/getting-started#1',
    (en) => [
      p(
        en
          ? 'The API key authenticates every heartbeat your machines send. One key covers every editor and every AI hook on that account.'
          : 'API key ใช้ยืนยันตัวตนของทุก heartbeat ที่เครื่องคุณส่ง key เดียวครอบคลุมทั้ง editor ทุกตัวและ AI hook ทุกตัวในบัญชีนั้น'
      ),
      bullets(
        en
          ? [
              'Open Settings in the dashboard and find the API key panel',
              'Choose Generate key',
              'Copy the key. The dashboard keeps displaying it, so there is never a reason to regenerate just to read it again',
              'Regenerating replaces the old key immediately, so every machine still using the old one stops being accepted',
            ]
          : [
              'เปิดหน้า Settings ใน dashboard แล้วมองหาแผง API key',
              'กด Generate key',
              'คัดลอก key เก็บไว้ dashboard ยังแสดง key เดิมให้ดูได้เสมอ จึงไม่ต้อง regenerate เพียงเพื่อดูค่าอีกครั้ง',
              'การ regenerate จะแทนที่ key เดิมทันที เครื่องที่ยังใช้ key เก่าจะถูกปฏิเสธ',
            ]
      ),
      code('wakaclock-cli config set-key YOUR_API_KEY', en ? 'Terminal' : 'Terminal'),
      p(
        en
          ? 'That writes the key into ~/.wakaclock/config.toml, which is also where the CLI keeps user_id and server_url. The VS Code extension stores its own copy in VS Code secret storage instead of settings.json, so the key is never committed with your editor config.'
          : 'คำสั่งนี้เขียน key ลง ~/.wakaclock/config.toml ซึ่งเป็นที่เดียวกับที่ CLI เก็บ user_id และ server_url ส่วน VS Code extension เก็บ key ของตัวเองไว้ใน secret storage ของ VS Code ไม่ใช่ settings.json จึงไม่ถูก commit ไปพร้อมกับ config ของ editor'
      ),
    ],
  ],

  [
    '/docs/getting-started#2',
    (en) => [
      sub(en ? 'VS Code, the first-party extension' : 'VS Code กับ extension ของเราเอง'),
      code(
        'Extensions: install "AtoAxis — Developer Time Tracking"\nCommand Palette: AtoAxis: Set API Key\nCommand Palette: AtoAxis: Configure CLI Path   # only if the binary is not on PATH',
        'VS Code'
      ),
      p(
        en
          ? 'Nothing else is required: typing updates an in-memory buffer, saving flushes it as a write, and switching files flushes the file you left.'
          : 'ไม่ต้องตั้งค่าอย่างอื่นแล้ว การพิมพ์จะอัปเดต buffer ในหน่วยความจำ การ save จะ flush เป็น write และการสลับไฟล์จะ flush ไฟล์ที่เพิ่งออกมา'
      ),
      sub(
        en ? 'Any other editor, over the WakaTime protocol' : 'Editor อื่นผ่าน WakaTime protocol'
      ),
      code(
        '[settings]\napi_url = https://api.atoaxis.com/api/v1\napi_key = your_generated_api_key',
        '~/.wakatime.cfg'
      ),
      p(
        en
          ? 'An editor that already has a WakaTime plugin needs only this file changed. There is no AtoAxis extension to install for it: AtoAxis implements the WakaTime heartbeat API, so the plugin keeps working exactly as before.'
          : 'Editor ที่มี WakaTime plugin อยู่แล้วแก้แค่ไฟล์นี้ไฟล์เดียว ไม่ต้องติดตั้ง extension ของ AtoAxis เพิ่ม เพราะ AtoAxis รองรับ WakaTime heartbeat API ทำให้ plugin เดิมทำงานได้เหมือนเดิม'
      ),
    ],
  ],

  [
    '/docs/getting-started#3',
    (en) => [
      p(
        en
          ? 'Two commands answer "is it actually working?". The first asks the server, the second asks for the total it has counted today. Neither reads your local files.'
          : 'สองคำสั่งนี้ตอบคำถามว่า "ใช้งานได้จริงหรือยัง" คำสั่งแรกถาม server ส่วนคำสั่งที่สองถามยอดรวมของวันนี้ที่ server นับไว้ ทั้งคู่ไม่อ่านไฟล์ในเครื่อง'
      ),
      code(
        'wakaclock-cli status   # server reachable, API key present\nwakaclock-cli today    # today’s total, as the server counts it',
        'Terminal'
      ),
      bullets(
        en
          ? [
              'The VS Code status bar shows the same total and refreshes every 15 seconds',
              'AtoAxis: Send Heartbeat Now flushes buffered activity immediately instead of waiting for the 120-second same-file cadence',
              'The dashboard Overview page shows the total once the first heartbeat has landed',
            ]
          : [
              'status bar ของ VS Code แสดงยอดเดียวกันและรีเฟรชทุก 15 วินาที',
              'คำสั่ง AtoAxis: Send Heartbeat Now จะ flush activity ที่ค้างอยู่ทันที ไม่ต้องรอรอบ 120 วินาทีของไฟล์เดิม',
              'หน้า Overview ใน dashboard จะแสดงยอดรวมทันทีที่ heartbeat แรกเข้าระบบ',
            ]
      ),
    ],
  ],

  [
    '/docs/getting-started#4',
    (en) => [
      p(
        en
          ? 'Almost every first-run problem is one of these five, and each has a check that tells you which one it is.'
          : 'ปัญหาตอนเริ่มใช้งานเกือบทั้งหมดเป็นหนึ่งในห้าข้อนี้ และแต่ละข้อมีวิธีตรวจที่บอกได้ว่าเป็นข้อไหน'
      ),
      bullets(
        en
          ? [
              'No total in the status bar: the CLI cannot be found. Run AtoAxis: Configure CLI Path, or set wakaclock.cliPath to the absolute path of the binary',
              'Reading code is not counted: only edits, saves and file switches produce heartbeats, and gaps at or beyond the idle timeout are excluded on purpose',
              'The total stopped rising: run wakaclock-cli status. Undelivered heartbeats sit in ~/.wakaclock/queue.db and are resent once the server is reachable again',
              'One project counted twice: two checkouts of the same repository are two project names until you merge them under Settings, with project rules or a manual merge',
              'AI work missing: run AtoAxis: Show AI Tracking Status, then AtoAxis: Set Up AI Tracking to register hooks for Claude Code, Codex CLI, Gemini CLI, Kilo Code or Kimi Code CLI. Cursor and Copilot have no adapter yet',
            ]
          : [
              'status bar ไม่ขึ้นยอดเวลา แปลว่าหา CLI ไม่เจอ ให้รัน AtoAxis: Configure CLI Path หรือกำหนด wakaclock.cliPath เป็น path เต็มของ binary',
              'อ่านโค้ดเฉย ๆ ไม่ถูกนับ เพราะ heartbeat เกิดจากการแก้ไข การ save และการสลับไฟล์เท่านั้น ช่วงที่ไม่มีกิจกรรมถึงเกณฑ์ idle จะไม่ถูกนับโดยตั้งใจ',
              'ยอดหยุดเพิ่ม ให้รัน wakaclock-cli status heartbeat ที่ยังส่งไม่สำเร็จจะค้างอยู่ใน ~/.wakaclock/queue.db และถูกส่งใหม่เมื่อกลับมาต่อ server ได้',
              'โปรเจกต์เดียวถูกนับสองชื่อ เกิดจาก checkout สองที่ของ repository เดียวกัน ให้รวมเข้าด้วยกันที่หน้า Settings ผ่าน project rules หรือการ merge เอง',
              'ไม่เห็นงานฝั่ง AI ให้รัน AtoAxis: Show AI Tracking Status แล้วรัน AtoAxis: Set Up AI Tracking เพื่อติดตั้ง hook ของ Claude Code, Codex CLI, Gemini CLI, Kilo Code หรือ Kimi Code CLI ส่วน Cursor และ Copilot ยังไม่มี adapter',
            ]
      ),
    ],
  ],

  // Migration guide. Facts are taken from the shipped import path, not from memory:
  // `backend/api/src/services/wakatime_import.rs` (raw heartbeats only, 1 MiB and 10,000
  // records per upload, content-derived IDs so a re-upload is skipped, WakaTime AI flags kept
  // without an agent name) and `app/dashboard/(auth)/wakaclock/import/page.tsx` (connection
  // check, chunked resumable upload, before/after totals). The WakaTime side — an export of
  // type `heartbeats` rather than `daily`, created at wakatime.com/settings — is from
  // wakatime.com/developers, checked 2026-09-28.
  [
    '/docs/migrate-from-wakatime#0',
    (en) => [
      p(
        en
          ? 'Moving has two independent parts. Live tracking takes two lines in the settings file of the WakaTime plugin you already use. Your history moves separately, as a WakaTime data export you import into the dashboard. You can do either one first, and nothing in your WakaTime account is deleted by either.'
          : 'การย้ายมีสองส่วนที่แยกจากกัน ส่วนแรกคือการติดตามเวลาต่อจากนี้ ซึ่งแก้แค่สองบรรทัดในไฟล์ตั้งค่าของ WakaTime plugin ที่คุณใช้อยู่ ส่วนที่สองคือประวัติเดิม ซึ่งย้ายมาด้วยไฟล์ export ของ WakaTime แล้ว import เข้า dashboard คุณจะทำส่วนไหนก่อนก็ได้ และทั้งสองส่วนไม่ลบข้อมูลใดในบัญชี WakaTime ของคุณ'
      ),
      bullets(
        en
          ? [
              'Your editor with its WakaTime plugin, left installed exactly as it is',
              'An AtoAxis account and API key. During Early Access, keys are issued to people on the list',
              'Optional: your WakaTime history as a data export that contains raw heartbeats',
            ]
          : [
              'editor ของคุณพร้อม WakaTime plugin เดิม ไม่ต้องถอนหรือติดตั้งอะไรใหม่',
              'บัญชี AtoAxis และ API key ช่วง Early Access เราออก key ให้เฉพาะผู้ที่อยู่ในรายชื่อ',
              'ถ้าต้องการย้ายประวัติด้วย: ไฟล์ export ของ WakaTime แบบที่มี heartbeat ดิบ',
            ]
      ),
    ],
  ],
  [
    '/docs/migrate-from-wakatime#1',
    (en) => [
      p(
        en
          ? 'One AtoAxis key replaces your WakaTime key in the plugin. The same key also covers every other editor and AI hook on your account.'
          : 'key ของ AtoAxis หนึ่งตัวจะใช้แทน key ของ WakaTime ใน plugin และ key เดียวกันนี้ใช้ได้กับ editor และ AI hook ทุกตัวในบัญชีของคุณ'
      ),
      bullets(
        en
          ? [
              'Open Settings in the dashboard and find the API key panel',
              'Choose Generate key and copy it',
              'Regenerating later replaces the old key at once, so update every machine when you do',
            ]
          : [
              'เปิดหน้า Settings ใน dashboard แล้วไปที่แผง API key',
              'กด Generate key แล้วคัดลอกไว้',
              'ถ้า regenerate ภายหลัง key เก่าจะใช้ไม่ได้ทันที คุณต้องอัปเดตทุกเครื่องที่ใช้อยู่',
            ]
      ),
    ],
  ],
  [
    '/docs/migrate-from-wakatime#2',
    (en) => [
      p(
        en
          ? 'Every WakaTime plugin reads the same settings file in your home folder: ~/.wakatime.cfg on macOS and Linux, %USERPROFILE%\\.wakatime.cfg on Windows. Set two values and save it.'
          : 'WakaTime plugin ทุกตัวอ่านไฟล์ตั้งค่าเดียวกันใน home folder ของคุณ คือ ~/.wakatime.cfg บน macOS และ Linux หรือ %USERPROFILE%\\.wakatime.cfg บน Windows ให้แก้สองค่านี้แล้ว save'
      ),
      code(
        '[settings]\napi_url = https://api.atoaxis.com/api/v1\napi_key = your_atoaxis_api_key',
        '~/.wakatime.cfg'
      ),
      bullets(
        en
          ? [
              'No AtoAxis extension is needed for this editor. AtoAxis implements the WakaTime heartbeat API, so the plugin keeps working as before',
              'A plugin sends to one server, so from now on new activity goes to AtoAxis instead of WakaTime',
              'Some plugins cache their settings until the editor restarts. If nothing arrives, restart the editor once',
              'VS Code users can also switch to the first-party AtoAxis extension, which adds AI hook setup',
            ]
          : [
              'editor นี้ไม่ต้องติดตั้ง extension ของ AtoAxis เพราะ AtoAxis รองรับ WakaTime heartbeat API plugin จึงทำงานได้เหมือนเดิม',
              'plugin ส่งข้อมูลไปได้ทีละ server ดังนั้นกิจกรรมใหม่จะไปที่ AtoAxis แทน WakaTime ตั้งแต่ตอนนี้',
              'plugin บางตัวจำค่าตั้งค่าไว้จนกว่าจะปิดเปิด editor ใหม่ ถ้าข้อมูลยังไม่เข้า ให้ restart editor หนึ่งครั้ง',
              'ถ้าใช้ VS Code คุณเปลี่ยนไปใช้ extension ของ AtoAxis ได้ด้วย ซึ่งช่วยตั้งค่า AI hook ให้',
            ]
      ),
    ],
  ],
  [
    '/docs/migrate-from-wakatime#3',
    (en) => [
      p(
        en
          ? 'Edit and save a file in any project, then open Import WakaTime history in the dashboard and choose Check heartbeat and project. It shows today’s heartbeat count, the time of the latest heartbeat and the projects seen today.'
          : 'แก้ไขและ save ไฟล์ในโปรเจกต์ใดก็ได้ แล้วเปิดหน้า Import WakaTime history ใน dashboard และกด Check heartbeat and project ระบบจะแสดงจำนวน heartbeat ของวันนี้ เวลาของ heartbeat ล่าสุด และโปรเจกต์ที่เห็นในวันนี้'
      ),
      bullets(
        en
          ? [
              'If the latest heartbeat is older than your test edit, check the plugin log and restart the editor',
              'Reading code without editing, saving or switching files produces no heartbeat by design',
              'The Overview page shows the same total once the first heartbeat has landed',
            ]
          : [
              'ถ้า heartbeat ล่าสุดเก่ากว่าการแก้ไขที่คุณเพิ่งทำ ให้ดู log ของ plugin แล้ว restart editor',
              'การอ่านโค้ดเฉย ๆ โดยไม่แก้ไข save หรือสลับไฟล์ จะไม่สร้าง heartbeat ตามการออกแบบ',
              'หน้า Overview จะแสดงยอดเดียวกันทันทีที่ heartbeat แรกเข้าระบบ',
            ]
      ),
    ],
  ],
  [
    '/docs/migrate-from-wakatime#4',
    (en) => [
      p(
        en
          ? 'Create the export at wakatime.com/settings, or through the WakaTime API. Choose the export of heartbeats, not daily summaries: a summary cannot be turned back into a timeline, so the importer rejects it.'
          : 'สร้างไฟล์ export ที่ wakatime.com/settings หรือผ่าน WakaTime API โดยเลือกแบบ heartbeats ไม่ใช่ daily summaries เพราะข้อมูลสรุปรายวันสร้าง timeline กลับคืนไม่ได้ ระบบ import จึงไม่รับไฟล์แบบนั้น'
      ),
      code(
        'POST https://wakatime.com/api/v1/users/current/data_dumps\n{ "type": "heartbeats" }',
        en ? 'WakaTime API' : 'WakaTime API'
      ),
      p(
        en
          ? 'WakaTime prepares the file in the background and gives each export an expiry date, so download it once it is ready. Keep the JSON file as it is; there is no need to edit or split it yourself.'
          : 'WakaTime จะเตรียมไฟล์ให้เบื้องหลัง และลิงก์ดาวน์โหลดแต่ละไฟล์มีวันหมดอายุ จึงควรดาวน์โหลดทันทีที่พร้อม เก็บไฟล์ JSON ไว้ตามเดิม ไม่ต้องแก้ไขหรือแบ่งไฟล์เอง'
      ),
    ],
  ],
  [
    '/docs/migrate-from-wakatime#5',
    (en) => [
      p(
        en
          ? 'Open Import WakaTime history in the dashboard, choose the JSON file and select Review and import history. The browser splits a large export into chunks, strips fields the import does not use, and uploads the chunks in order.'
          : 'เปิดหน้า Import WakaTime history ใน dashboard เลือกไฟล์ JSON แล้วกด Review and import history browser จะแบ่งไฟล์ใหญ่เป็นชิ้น ตัด field ที่การ import ไม่ได้ใช้ออก แล้วอัปโหลดทีละชิ้นตามลำดับ'
      ),
      bullets(
        en
          ? [
              'Interrupted? Select the same file again and the import resumes from the chunks already received',
              'Importing the same file twice does not count its time twice: already imported heartbeats are skipped',
              'When it finishes, the page shows your all-time total before and after, plus how many records were skipped and why',
              'A small export, up to 1 MiB and 10,000 heartbeats, can also go through Settings → Maintenance',
            ]
          : [
              'ถ้าการ import ขาดกลางทาง ให้เลือกไฟล์เดิมอีกครั้ง ระบบจะทำต่อจากชิ้นที่ได้รับแล้ว',
              'import ไฟล์เดิมซ้ำจะไม่ทำให้เวลาถูกนับซ้ำ เพราะ heartbeat ที่ import แล้วจะถูกข้าม',
              'เมื่อเสร็จ หน้าเว็บจะแสดงยอดเวลารวมทั้งหมดก่อนและหลัง import พร้อมจำนวนรายการที่ถูกข้ามและเหตุผล',
              'ไฟล์ขนาดเล็กไม่เกิน 1 MiB และไม่เกิน 10,000 heartbeat จะ import ผ่าน Settings → Maintenance ก็ได้',
            ]
      ),
    ],
  ],
  [
    '/docs/migrate-from-wakatime#6',
    (en) => [
      p(
        en
          ? 'Your old and new activity now sit on one timeline, and every account keeps its complete history rather than a recent window. A few things behave differently from WakaTime, and it is better to know them before you compare totals.'
          : 'ตอนนี้กิจกรรมเก่าและใหม่ของคุณอยู่บน timeline เดียวกัน และทุกบัญชีเก็บประวัติครบถ้วน ไม่ใช่แค่ช่วงล่าสุด มีบางอย่างที่ทำงานต่างจาก WakaTime ซึ่งควรรู้ไว้ก่อนเทียบยอดเวลา'
      ),
      bullets(
        en
          ? [
              'Imported AI work stays AI but has no agent name: a WakaTime export shows that AI was involved, not which tool, so AtoAxis does not guess one',
              'Two checkouts of one repository may appear as two projects; join them under Settings with project rules or a manual merge',
              'AI hooks for Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI are set up separately from the WakaTime plugin',
              'To go back, delete the api_url line and put your WakaTime key back in api_key. Nothing in either account is lost',
            ]
          : [
              'งาน AI ที่ import มายังนับเป็น AI แต่ไม่มีชื่อ agent เพราะ export ของ WakaTime บอกได้แค่ว่ามี AI เกี่ยวข้อง ไม่ได้บอกว่าเป็นเครื่องมือตัวไหน AtoAxis จึงไม่เดาให้',
              'checkout สองที่ของ repository เดียวกันอาจแสดงเป็นสองโปรเจกต์ ให้รวมกันที่หน้า Settings ด้วย project rules หรือการ merge เอง',
              'AI hook ของ Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI ตั้งค่าแยกจาก WakaTime plugin',
              'ถ้าต้องการย้ายกลับ ให้ลบบรรทัด api_url แล้วใส่ key ของ WakaTime กลับใน api_key ข้อมูลในทั้งสองบัญชีไม่หายไปไหน',
            ]
      ),
    ],
  ],
  [
    '/pricing#1',
    (en) => [
      p(
        en
          ? 'Nothing can be charged today: no payment provider is connected, and the checkout does not exist yet. Early Access is a list, and joining it is not a purchase or a commitment to buy.'
          : 'ตอนนี้ยังเรียกเก็บเงินไม่ได้เลย เพราะยังไม่ได้เชื่อมต่อผู้ให้บริการชำระเงินและยังไม่มีหน้า checkout การเข้าร่วม Early Access เป็นเพียงการลงชื่อ ไม่ใช่การซื้อและไม่ใช่ข้อผูกมัดว่าจะต้องซื้อ'
      ),
      bullets(
        en
          ? [
              'One plan. There is no cheaper tier that hides your older history behind an upgrade',
              'No free tier is planned at launch, which is stated here rather than discovered at checkout',
              'Prices are shown in USD and are the planned launch prices, not a promotional rate',
              'Early Access members are told before anything becomes payable',
            ]
          : [
              'มีแผนเดียว ไม่มี tier ราคาถูกกว่าที่ซ่อนประวัติเก่าของคุณไว้หลังการอัปเกรด',
              'ตอนเปิดตัวจะไม่มี free tier ซึ่งเราบอกไว้ตรงนี้ ไม่ใช่ให้ไปเจอเอาตอน checkout',
              'ราคาแสดงเป็น USD และเป็นราคาที่วางไว้ตอนเปิดตัว ไม่ใช่ราคาโปรโมชัน',
              'สมาชิก Early Access จะได้รับแจ้งก่อนที่จะมีอะไรต้องจ่าย',
            ]
      ),
    ],
  ],
  [
    '/privacy#2',
    (en) => [
      p(
        en
          ? 'A file path is the field most likely to say more than you intended. It can carry a client name, an unreleased product, or your own name in a home directory, which is why it is called out separately here rather than filed under "metadata".'
          : 'file path คือ field ที่มีโอกาสบอกมากกว่าที่คุณตั้งใจมากที่สุด มันอาจมีชื่อลูกค้า ชื่อผลิตภัณฑ์ที่ยังไม่เปิดตัว หรือชื่อของคุณเองใน home directory เราจึงพูดถึงมันแยกออกมา แทนที่จะเหมารวมไว้ใต้คำว่า "metadata"'
      ),
      bullets(
        en
          ? [
              'The path is used to derive the project, the language and the file-level breakdown',
              'It is stored as your editor reported it, and is not parsed for meaning beyond that',
              'It is never shown to anyone else: analytics are scoped to a single account',
              'Deleting the account deletes the paths with it',
            ]
          : [
              'path ถูกใช้เพื่อหาโปรเจกต์ ภาษา และ breakdown ระดับไฟล์',
              'เก็บตามที่ editor ส่งมา และไม่ถูกตีความอะไรมากไปกว่านั้น',
              'ไม่ถูกแสดงให้ใครเห็น เพราะ analytics อยู่ในขอบเขตบัญชีเดียว',
              'การลบบัญชีจะลบ path เหล่านั้นไปด้วย',
            ]
      ),
    ],
  ],
  [
    '/privacy#4',
    (en) => [
      p(
        en
          ? 'One path in, one path out. The editor extension does not talk to the server at all: it hands activity to the local CLI, and the CLI is the only thing that makes a network request.'
          : 'ขาเข้าทางเดียว ขาออกทางเดียว extension ของ editor ไม่ได้ติดต่อ server เลย แต่ส่งข้อมูลกิจกรรมให้ CLI ในเครื่อง และมีเพียง CLI เท่านั้นที่เรียกออกเครือข่าย'
      ),
      bullets(
        en
          ? [
              'Editor activity is buffered in memory, then handed to wakaclock-cli on the same machine',
              'The CLI sends it over HTTPS, authenticated with your API key',
              'If the request fails the heartbeat is queued in a local SQLite file and retried later',
              'Heartbeat data is not sent to any third-party analytics or advertising service',
              'This public website loads Google Analytics in production to count page visits; the dashboard and the heartbeat pipeline do not',
            ]
          : [
              'กิจกรรมใน editor ถูกพักไว้ในหน่วยความจำ แล้วส่งต่อให้ wakaclock-cli บนเครื่องเดียวกัน',
              'CLI ส่งข้อมูลผ่าน HTTPS โดยยืนยันตัวตนด้วย API key ของคุณ',
              'ถ้าส่งไม่สำเร็จ heartbeat จะถูกคิวไว้ในไฟล์ SQLite ในเครื่องแล้วลองใหม่ภายหลัง',
              'ข้อมูล heartbeat ไม่ถูกส่งไปยังบริการ analytics หรือโฆษณาของบุคคลที่สามใด ๆ',
              'เว็บไซต์สาธารณะนี้โหลด Google Analytics ในโหมด production เพื่อนับจำนวนผู้เข้าชม ส่วน dashboard และเส้นทางของ heartbeat ไม่ได้ใช้',
            ]
      ),
    ],
  ],
  [
    '/privacy#5',
    (en) => [
      p(
        en
          ? 'Complete history is the product, so heartbeats are kept for as long as the account exists rather than aged out after a window. That is a deliberate trade: you get last year back, and in exchange the data has to be deletable on request.'
          : 'ประวัติที่ครบถ้วนคือตัวผลิตภัณฑ์ heartbeat จึงถูกเก็บไว้ตราบเท่าที่บัญชียังอยู่ ไม่ถูกตัดทิ้งเมื่อพ้นช่วงเวลาหนึ่ง นี่คือการแลกที่ตั้งใจ คุณได้ข้อมูลปีที่แล้วกลับมา และแลกกับสิ่งนั้น ข้อมูลต้องลบได้เมื่อคุณขอ'
      ),
      bullets(
        en
          ? [
              'Heartbeats are retained while the account is active, not trimmed to a recent window',
              'Aggregates are derived from the raw data, so deleting the raw data removes them too',
              'Deletion of an account or its data can be requested by email',
              'Revoking an API key stops new data immediately without deleting what exists',
            ]
          : [
              'heartbeat ถูกเก็บไว้ตลอดที่บัญชียังใช้งานอยู่ ไม่ถูกตัดให้เหลือเฉพาะช่วงล่าสุด',
              'ค่า aggregate สร้างจากข้อมูลดิบ การลบข้อมูลดิบจึงลบค่าเหล่านั้นไปด้วย',
              'ขอลบบัญชีหรือข้อมูลได้ทางอีเมล',
              'การเพิกถอน API key จะหยุดข้อมูลใหม่ทันที โดยไม่ลบข้อมูลที่มีอยู่แล้ว',
            ]
      ),
    ],
  ],
  [
    '/about#0',
    (en) => [
      p(
        en
          ? 'Two things changed at once. Coding-time tools started charging for your own history behind an upgrade, and a growing share of the code in a working day stopped being typed by a person at all. A tracker that answers "how long" but not "who wrote this" is now answering half the question.'
          : 'มีสองอย่างเปลี่ยนไปพร้อมกัน เครื่องมือติดตามเวลาเริ่มคิดเงินเพื่อให้คุณดูประวัติของตัวเอง และสัดส่วนของโค้ดในหนึ่งวันทำงานที่ไม่ได้พิมพ์โดยคนก็เพิ่มขึ้นเรื่อย ๆ เครื่องมือที่ตอบได้แค่ "ใช้เวลาเท่าไร" แต่ตอบไม่ได้ว่า "ใครเขียน" จึงตอบได้เพียงครึ่งเดียวของคำถาม'
      ),
      bullets(
        en
          ? [
              'Your complete history belongs in the base plan, not behind a higher tier',
              'AI-written and hand-written work are different quantities and should be counted separately',
              'A metric that cannot be established should say so instead of rendering as zero',
              'Metadata is enough to answer these questions; source code and prompts are not needed',
            ]
          : [
              'ประวัติทั้งหมดของคุณควรอยู่ในแผนหลัก ไม่ใช่ซ่อนไว้หลัง tier ที่แพงกว่า',
              'โค้ดที่ AI เขียนกับที่คนเขียนเป็นคนละปริมาณ และควรถูกนับแยกกัน',
              'metric ที่ยืนยันไม่ได้ควรบอกตรง ๆ ว่าไม่รู้ แทนที่จะแสดงเป็นเลขศูนย์',
              'แค่ metadata ก็ตอบคำถามเหล่านี้ได้ ไม่จำเป็นต้องใช้ source code หรือ prompt',
            ]
      ),
    ],
  ],
  [
    '/about#1',
    (en) => [
      p(
        en
          ? 'Early Access, and the boundary is worth stating plainly: the ingestion and analytics path is built and running, while billing and full team seats are not. Nothing on this site describes a feature that does not exist yet in the present tense.'
          : 'ตอนนี้อยู่ในช่วง Early Access และควรบอกขอบเขตให้ชัด ส่วนของการรับข้อมูลและ analytics สร้างเสร็จและทำงานอยู่จริง ส่วนระบบเรียกเก็บเงินและ team seat เต็มรูปแบบยังไม่เสร็จ ไม่มีข้อความไหนบนเว็บนี้ที่พูดถึงฟีเจอร์ที่ยังไม่มีอยู่ในรูปปัจจุบันกาล'
      ),
      bullets(
        en
          ? [
              'Working: heartbeat ingestion, duration blocks, project, language, editor and branch analytics',
              'Working: AI attribution with hooks for Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI',
              'Working: a first-party VS Code extension, and WakaTime-protocol compatibility for other editors',
              'Working where the server runs PostgreSQL: goals, leaderboards, and a presence prototype with recorded co-working sessions',
              'Not yet: billing and checkout, assigned team and organisation seats, adapters for Cursor and Copilot',
            ]
          : [
              'ใช้งานได้แล้ว: การรับ heartbeat, duration block และ analytics ของ project, language, editor และ branch',
              'ใช้งานได้แล้ว: AI attribution พร้อม hook สำหรับ Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI',
              'ใช้งานได้แล้ว: extension สำหรับ VS Code ที่เราดูแลเอง และความเข้ากันได้กับ WakaTime protocol สำหรับ editor อื่น',
              'ใช้งานได้เมื่อ server รัน PostgreSQL: goals, leaderboards และ presence prototype ที่มี co-working session บันทึกไว้',
              'ยังไม่มี: ระบบเรียกเก็บเงินและ checkout, team และ organisation seat ที่กำหนดให้ และ adapter สำหรับ Cursor และ Copilot',
            ]
      ),
    ],
  ],
  [
    '/contact#0',
    (en) => [
      p(
        en
          ? 'A real person reads this inbox, so a specific message gets a specific answer. The questions below are the ones we can answer properly today.'
          : 'มีคนอ่านกล่องข้อความนี้จริง คำถามที่เจาะจงจึงได้คำตอบที่เจาะจง หัวข้อด้านล่างคือเรื่องที่เราตอบได้ดีในตอนนี้'
      ),
      bullets(
        en
          ? [
              'Early Access: when keys are issued and what happens after you join the list',
              'Editors: whether a specific editor can reach the hosted API through its WakaTime plugin',
              'AI tracking: which agents have hooks today and what an adapter would need to supply',
              'Privacy: exactly which fields a heartbeat carries, and how to have data deleted',
              'Migration: importing an existing WakaTime export into the same dashboard',
            ]
          : [
              'Early Access: จะออก key เมื่อไร และหลังลงชื่อแล้วจะเกิดอะไรขึ้น',
              'Editor: editor ที่คุณใช้ส่งข้อมูลมาที่ hosted API ผ่าน WakaTime plugin ได้หรือไม่',
              'การติดตาม AI: ตอนนี้ agent ตัวใดมี hook แล้ว และ adapter ตัวใหม่ต้องส่งอะไรมาบ้าง',
              'ความเป็นส่วนตัว: heartbeat มี field อะไรบ้าง และขอให้ลบข้อมูลได้อย่างไร',
              'การย้ายระบบ: การ import ไฟล์ export ของ WakaTime เข้ามาใน dashboard เดียวกัน',
            ]
      ),
    ],
  ],
  [
    '/terms#0',
    (en) => [
      p(
        en
          ? 'This site is an Early Access website for a product that has not launched. Joining the list registers interest and nothing else: no account is created, no payment is taken, and no service level is promised.'
          : 'เว็บนี้เป็นเว็บ Early Access ของผลิตภัณฑ์ที่ยังไม่เปิดตัว การลงชื่อคือการแสดงความสนใจเท่านั้น ไม่มีการสร้างบัญชี ไม่มีการเรียกเก็บเงิน และไม่มีการรับประกันระดับการให้บริการ'
      ),
      bullets(
        en
          ? [
              'Joining the list is not a purchase and creates no obligation on either side',
              'Features described as planned or in development may change or be dropped',
              'Availability during Early Access is best effort and can be interrupted without notice',
              'These are preliminary terms and will be replaced before the product becomes payable',
            ]
          : [
              'การลงชื่อไม่ใช่การซื้อ และไม่สร้างข้อผูกมัดกับทั้งสองฝ่าย',
              'ฟีเจอร์ที่ระบุว่าวางแผนไว้หรืออยู่ระหว่างพัฒนาอาจเปลี่ยนแปลงหรือถูกยกเลิกได้',
              'ความพร้อมใช้งานช่วง Early Access เป็นแบบ best effort และอาจหยุดชะงักโดยไม่แจ้งล่วงหน้า',
              'นี่เป็นข้อกำหนดเบื้องต้น และจะถูกแทนที่ก่อนที่ผลิตภัณฑ์จะเริ่มมีค่าใช้จ่าย',
            ]
      ),
    ],
  ],
  [
    '/terms#1',
    (en) => [
      p(
        en
          ? 'The service is hosted and operated by us; there is nothing for you to deploy or maintain. The data you send stays scoped to your own account and is not sold, shared or used to train anything.'
          : 'บริการนี้เราเป็นผู้โฮสต์และดูแลเอง คุณไม่ต้อง deploy หรือดูแลอะไรทั้งสิ้น ข้อมูลที่คุณส่งมาอยู่ในขอบเขตบัญชีของคุณเอง ไม่ถูกขาย ไม่ถูกแบ่งปัน และไม่ถูกใช้ฝึกโมเดลใด ๆ'
      ),
      bullets(
        en
          ? [
              'You keep ownership of the activity data your machines send',
              'Data is not sold, shared with advertisers, or used as training material',
              'Heartbeats carry metadata and counts, never source code, prompts or responses',
              'You can request deletion of your data by email',
            ]
          : [
              'ข้อมูลกิจกรรมที่เครื่องของคุณส่งมายังเป็นของคุณ',
              'ข้อมูลไม่ถูกขาย ไม่ถูกแบ่งให้ผู้โฆษณา และไม่ถูกใช้เป็นข้อมูลฝึกโมเดล',
              'heartbeat มีเพียง metadata และตัวเลข ไม่มี source code, prompt หรือ response',
              'ขอลบข้อมูลของคุณได้ทางอีเมล',
            ]
      ),
    ],
  ],
  [
    '/terms#2',
    (en) => [
      p(
        en
          ? 'The rules here are short because there are only a few ways to misuse a heartbeat API, and all of them make the numbers meaningless for everyone.'
          : 'กฎในส่วนนี้สั้น เพราะมีไม่กี่วิธีที่จะใช้ heartbeat API ในทางที่ผิด และทุกวิธีล้วนทำให้ตัวเลขไม่มีความหมายสำหรับทุกคน'
      ),
      bullets(
        en
          ? [
              'Do not send fabricated activity or activity that is not yours',
              'Do not share one API key across people; it identifies one account',
              'Do not attempt to read another account’s data or bypass the rate limits',
              'Do not use the service where doing so would break a law that applies to you',
            ]
          : [
              'อย่าส่งกิจกรรมที่ปลอมขึ้นหรือกิจกรรมที่ไม่ใช่ของคุณ',
              'อย่าใช้ API key เดียวร่วมกันหลายคน เพราะมันระบุถึงบัญชีเดียว',
              'อย่าพยายามอ่านข้อมูลของบัญชีอื่นหรือหลบเลี่ยง rate limit',
              'อย่าใช้บริการนี้ในกรณีที่การใช้งานจะขัดต่อกฎหมายที่บังคับใช้กับคุณ',
            ]
      ),
    ],
  ],
  [
    '/integrations/vscode#1',
    (en) => [
      bullets(
        en
          ? [
              'VS Code 1.90 or newer',
              'wakaclock-cli on PATH, or an absolute path in wakaclock.cliPath',
              'An API key, stored through AtoAxis: Set API Key rather than in settings.json',
            ]
          : [
              'VS Code 1.90 ขึ้นไป',
              'มี wakaclock-cli ใน PATH หรือกำหนด path เต็มไว้ที่ wakaclock.cliPath',
              'API key ที่บันทึกผ่านคำสั่ง AtoAxis: Set API Key ไม่ใช่เก็บใน settings.json',
            ]
      ),
    ],
  ],

  [
    '/integrations/vscode#3',
    (en) => [
      bullets(
        en
          ? [
              'Typing updates an in-memory buffer for the file you are in',
              'Saving flushes that buffer immediately and marks the heartbeat as a write',
              'Switching files flushes the file you left, so its seconds are not attributed to the next one',
              'A timer re-checks buffers on a fixed interval without bypassing the same-file heartbeat cadence',
              'One global activity timeline is kept, so moving between files cannot count the same seconds twice',
            ]
          : [
              'การพิมพ์จะอัปเดต buffer ในหน่วยความจำของไฟล์ที่กำลังทำงานอยู่',
              'การ save จะ flush buffer นั้นทันทีและทำเครื่องหมาย heartbeat เป็น write',
              'การสลับไฟล์จะ flush ไฟล์ที่เพิ่งออกมา เวลาของไฟล์นั้นจึงไม่ถูกโอนไปให้ไฟล์ถัดไป',
              'มี timer คอยตรวจ buffer ตามรอบคงที่ โดยไม่ข้ามรอบ heartbeat ของไฟล์เดิม',
              'ระบบเก็บ timeline กิจกรรมรวมไว้ชุดเดียว การสลับไฟล์จึงไม่ทำให้วินาทีเดียวกันถูกนับซ้ำ',
            ]
      ),
    ],
  ],

  [
    '/integrations/vscode#4',
    (en) => [
      code(
        '{\n  "wakaclock.cliPath": "/usr/local/bin/wakaclock-cli",\n  "wakaclock.statusBarEnabled": true,\n  "wakaclock.trackDebugSessions": true,\n  "wakaclock.trackBuildTasks": true\n}',
        'settings.json'
      ),
      bullets(
        en
          ? [
              'wakaclock.cliPath: absolute path to the binary; empty resolves it from PATH',
              'wakaclock.statusBarEnabled: show today’s total in the status bar',
              'wakaclock.trackDebugSessions: emit debugging heartbeats when a debug session starts and stops',
              'wakaclock.trackBuildTasks: emit building heartbeats when a task starts and stops',
              'wakaclock.debugLogging: verbose logging in the extension host console',
            ]
          : [
              'wakaclock.cliPath: path เต็มของ binary ถ้าเว้นว่างจะหาใน PATH',
              'wakaclock.statusBarEnabled: แสดงยอดรวมของวันนี้บน status bar',
              'wakaclock.trackDebugSessions: ส่ง heartbeat ประเภท debugging เมื่อเริ่มและจบ debug session',
              'wakaclock.trackBuildTasks: ส่ง heartbeat ประเภท building เมื่อเริ่มและจบ task',
              'wakaclock.debugLogging: เปิด log แบบละเอียดใน extension host console',
            ]
      ),
    ],
  ],

  [
    '/integrations/vscode#5',
    (en) => [
      bullets(
        en
          ? [
              'File activity only, with no app, domain or url heartbeats',
              'AI hooks cover Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI; Cursor and Copilot need provider-specific adapters',
              'The extension requires wakaclock-cli and does not talk to the server directly',
            ]
          : [
              'ส่งเฉพาะกิจกรรมกับไฟล์ ไม่มี heartbeat ประเภท app, domain หรือ url',
              'AI hook ครอบคลุม Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI ส่วน Cursor และ Copilot ต้องมี adapter เฉพาะของผู้ให้บริการ',
              'extension ต้องใช้ wakaclock-cli และไม่ได้ติดต่อ server โดยตรง',
            ]
      ),
    ],
  ],
]);

const genericBlocks = (
  path: MarketingPageKey,
  heading: string,
  index: number,
  locale: SiteLocale
): MarketingBlock[] => {
  const en = locale === 'en';
  const specific = DOC_BLOCKS.get(`${path}#${index}`);
  if (specific) return specific(en);
  if (path === '/integrations/vscode' && index === 0) {
    return [
      bullets(
        en
          ? [
              'File, project, branch, language and editor metadata',
              'Save, debug and build activity',
              'Keystroke and character counts',
              'Optional AI attribution fields',
            ]
          : [
              'Metadata ของ file, project, branch, language และ editor',
              'กิจกรรม save, debug และ build',
              'Keystroke และ character counts',
              'AI attribution fields ที่เลือกใช้ได้',
            ]
      ),
    ];
  }
  if (path === '/about' && index === 2) {
    return [email(en ? 'For product questions, contact ' : 'ติดต่อเรื่องผลิตภัณฑ์ได้ที่ ', '.')];
  }
  if (path === '/terms' && index === 3) {
    return [
      email(
        en ? 'Contact ' : 'ติดต่อ ',
        en ? ' with questions about these terms.' : ' หากมีคำถามเกี่ยวกับข้อกำหนด'
      ),
    ];
  }
  if (path === '/privacy' && index === 0) {
    return [
      p(en ? 'The heartbeat schema can include:' : 'Heartbeat schema อาจมีข้อมูลเหล่านี้:'),
      bullets(
        en
          ? [
              'File path and save state',
              'Project and Git branch',
              'Language, editor, operating system and machine',
              'Line, cursor, keystroke and character counts',
              'Activity category, AI fields and timestamps',
            ]
          : [
              'File path และสถานะ save',
              'Project และ Git branch',
              'Language, editor, operating system และ machine',
              'Line, cursor, keystroke และ character counts',
              'Activity category, AI fields และ timestamp',
            ]
      ),
    ];
  }
  if (path === '/privacy' && index === 1) {
    return [
      p(en ? 'There is no field for:' : 'ไม่มี field สำหรับ:'),
      bullets(
        en
          ? [
              'Source code, diffs or patches',
              'AI prompts, responses or transcript bodies',
              'Passwords, environment variables or secrets',
              'Screenshots or recordings',
            ]
          : [
              'Source code, diff หรือ patch',
              'AI prompt, response หรือ transcript body',
              'Password, environment variable หรือ secret',
              'Screenshot หรือ recording',
            ]
      ),
    ];
  }
  if (path === '/privacy' && index === 3) {
    return [
      p(
        en
          ? 'AI heartbeats store the flag, agent name and line counts. Provider-reported token usage may be stored as usage metadata; prompt and response text never is.'
          : 'AI heartbeat เก็บ flag ชื่อ agent และ line counts ส่วน provider-reported token usage อาจเก็บเป็น usage metadata แต่ไม่เก็บ prompt หรือ response text'
      ),
      sub(en ? 'Cost coverage' : 'ความครอบคลุมของ cost'),
      p(
        en
          ? 'Estimated cost is null when provider pricing is unknown, and coverage metadata explains why.'
          : 'estimated cost เป็น null เมื่อไม่รู้ราคา provider และ coverage metadata จะบอกเหตุผล'
      ),
    ];
  }
  if (path === '/pricing' && index === 0) {
    return [
      p(
        en
          ? `The planned plan is designed as one complete product rather than a ladder of feature gates. At $${PRICING.monthlyUsd} per month or $${PRICING.annualUsd} per year, it is intended to include the full coding history, analysis views and import tools described below. These are planned Early Access terms; checkout is not open and joining the list does not create a subscription.`
          : `แผนที่วางไว้เป็นผลิตภัณฑ์แบบครบชุด ไม่ได้แบ่งฟีเจอร์สำคัญไว้ตามระดับราคา ราคาเป้าหมายคือ $${PRICING.monthlyUsd} ต่อเดือน หรือ $${PRICING.annualUsd} ต่อปี โดยตั้งใจให้รวมประวัติการเขียนโค้ดทั้งหมด หน้าวิเคราะห์ และเครื่องมือนำเข้าตามรายการด้านล่าง ขณะนี้ยังเป็นเงื่อนไขช่วง Early Access ระบบ checkout ยังไม่เปิด และการเข้าร่วมรายการยังไม่ก่อให้เกิดการสมัครสมาชิก`
      ),
      bullets(
        en
          ? [
              'Unlimited projects and heartbeats',
              'Complete coding history',
              'Filterable analytics with timeline, heatmap, projects and drilldown views',
              'AI versus human attribution fields',
              'Project rules, merges and WakaTime import',
              'Goals and opt-in leaderboards where the server runs PostgreSQL',
            ]
          : [
              'โปรเจกต์และ heartbeat ไม่จำกัด',
              'coding history ครบถ้วน',
              'analytics ที่กรองได้ พร้อมมุมมอง timeline, heatmap, projects และ drilldown',
              'AI เทียบ human attribution fields',
              'project rules, merge และ WakaTime import',
              'Goals และ leaderboards แบบ opt-in เมื่อ server รัน PostgreSQL',
            ]
      ),
    ];
  }
  if (path === '/early-access') return [];
  return [
    p(
      en
        ? `This section explains ${heading.toLowerCase()} and the practical limits of the current hosted product.`
        : `ส่วนนี้อธิบาย${heading}และขอบเขตของ hosted product ที่ใช้งานอยู่ในปัจจุบัน`
    ),
  ];
};
const genericRelated = (path: MarketingPageKey, locale: SiteLocale) => {
  const en = locale === 'en';
  const links: Record<string, MarketingLinkCopy[]> = {
    '/integrations/vscode': [
      {
        href: '/integrations',
        label: en ? 'All editor integrations' : 'การเชื่อมต่อ editor ทั้งหมด',
        description: en
          ? 'WakaTime-compatible editors and AI hooks'
          : 'editor ที่รองรับ WakaTime และ AI hooks',
      },
      {
        href: '/docs/getting-started',
        label: en ? 'Getting started' : 'เริ่มต้นใช้งาน',
        description: en
          ? 'Account, API key and first heartbeat'
          : 'บัญชี API key และ heartbeat แรก',
      },
      {
        href: '/privacy',
        label: 'Privacy',
        description: en ? 'Metadata-only collection' : 'การเก็บ metadata เท่านั้น',
      },
    ],
    '/privacy': [
      {
        href: '/ai-coding-tracker',
        label: en ? 'AI coding activity' : 'AI coding activity',
        description: en ? 'Attribution and usage coverage' : 'attribution และ coverage ของ usage',
      },
    ],
    // A hub is only worth crawling if it points at everything under it. These mirror the
    // Documentation section of /llms.txt so the two inventories stay in step.
    '/docs': [
      {
        href: '/docs/getting-started',
        label: en ? 'Getting started' : 'เริ่มต้นใช้งาน',
        description: en ? 'Connect an editor' : 'เชื่อม editor',
      },
      {
        href: '/docs/migrate-from-wakatime',
        label: en ? 'Migrate from WakaTime' : 'ย้ายจาก WakaTime',
        description: en
          ? 'Keep your plugin and import your history'
          : 'ใช้ plugin เดิมและ import ประวัติ',
      },
      {
        href: '/docs/how-coding-time-is-calculated',
        label: en ? 'How coding time is calculated' : 'วิธีคำนวณเวลาการเขียนโค้ด',
        description: en
          ? 'Heartbeats, idle gaps and duration blocks'
          : 'heartbeat, idle gap และ duration block',
      },
      {
        href: '/docs/ai-attribution-and-coverage',
        label: en ? 'AI attribution and coverage' : 'AI attribution และ coverage',
        description: en
          ? 'Evidence behind AI and human totals'
          : 'หลักฐานเบื้องหลังยอด AI และ human',
      },
      {
        href: '/docs/ai-cost-methodology',
        label: en ? 'AI cost methodology' : 'วิธีคำนวณค่าใช้จ่าย AI',
        description: en ? 'Token prices and unknown estimates' : 'ราคา token และยอดที่ไม่ทราบ',
      },
      {
        href: '/integrations',
        label: en ? 'Editor integrations' : 'การเชื่อมต่อ editor',
        description: en
          ? 'First-party and WakaTime-compatible clients'
          : 'client ของเราเองและที่รองรับ WakaTime',
      },
      {
        href: '/integrations/vscode',
        label: en ? 'VS Code integration' : 'VS Code integration',
        description: en ? 'Extension settings and commands' : 'settings และ commands ของ extension',
      },
      {
        href: '/privacy',
        label: en ? 'Privacy and data collection' : 'Privacy และข้อมูลที่เก็บ',
        description: en ? 'Every field a heartbeat stores' : 'ทุก field ที่ heartbeat เก็บ',
      },
    ],
    '/docs/getting-started': [
      {
        href: '/docs',
        label: en ? 'All documentation' : 'เอกสารทั้งหมด',
        description: en
          ? 'Setup, integration and privacy guides'
          : 'คู่มือ setup, integration และ privacy',
      },
      {
        href: '/integrations/vscode',
        label: en ? 'VS Code integration' : 'VS Code integration',
        description: en ? 'Extension settings' : 'settings ของ extension',
      },
      {
        href: '/docs/migrate-from-wakatime',
        label: en ? 'Migrate from WakaTime' : 'ย้ายจาก WakaTime',
        description: en
          ? 'Keep your plugin and import your history'
          : 'ใช้ plugin เดิมและ import ประวัติ',
      },
    ],
    '/docs/migrate-from-wakatime': [
      {
        href: '/wakatime-alternative',
        label: en ? 'AtoAxis vs WakaTime' : 'เทียบ AtoAxis กับ WakaTime',
        description: en
          ? 'What differs before you decide to move'
          : 'สิ่งที่ต่างกันก่อนตัดสินใจย้าย',
      },
      {
        href: '/docs/getting-started',
        label: en ? 'Getting started' : 'เริ่มต้นใช้งาน',
        description: en ? 'API key, CLI and first heartbeat' : 'API key, CLI และ heartbeat แรก',
      },
      {
        href: '/docs/how-coding-time-is-calculated',
        label: en ? 'How coding time is calculated' : 'วิธีคำนวณเวลาการเขียนโค้ด',
        description: en
          ? 'Why totals can differ between tools'
          : 'ทำไมยอดเวลาของแต่ละเครื่องมืออาจต่างกัน',
      },
      {
        href: '/integrations',
        label: en ? 'Editor integrations' : 'การเชื่อมต่อ editor',
        description: en
          ? 'Editors that work through the WakaTime protocol'
          : 'editor ที่ใช้งานผ่าน WakaTime protocol',
      },
    ],
    '/about': [
      {
        href: '/early-access',
        label: en ? 'Join early access' : 'เข้าร่วม Early Access',
        description: en ? 'Follow launch progress' : 'ติดตามความคืบหน้าการเปิดตัว',
      },
    ],
    '/terms': [
      {
        href: '/privacy',
        label: 'Privacy',
        description: en ? 'Data collection and deletion' : 'ข้อมูลที่เก็บและการลบ',
      },
    ],
    '/pricing': [
      {
        href: '/early-access',
        label: en ? 'Join early access' : 'เข้าร่วม Early Access',
        description: en ? 'Launch updates' : 'ข่าวการเปิดตัว',
      },
    ],
  };
  return links[path] ? [related(links[path])] : undefined;
};

generic(
  '/integrations/vscode',
  {
    title: 'VS Code time tracking extension',
    description: 'Install and configure the AtoAxis VS Code extension.',
    lead: 'The first-party extension buffers metadata-only editor activity and sends heartbeats through wakaclock-cli.',
    headings: [
      'What it tracks',
      'Requirements',
      'Installation',
      'How it works',
      'Settings',
      'Limitations',
    ],
    faqEntries: [
      {
        question: 'What does the extension actually track?',
        answer:
          'File, project, branch, language and editor metadata, plus save, debug and build activity and keystroke/character counts. It never sends file contents.',
      },
      {
        question: 'What do I need before installing it?',
        answer:
          'VS Code 1.90 or newer, wakaclock-cli on PATH (or a configured wakaclock.cliPath), and an API key generated from the dashboard.',
      },
      {
        question: 'Where is my API key stored?',
        answer:
          "In VS Code's secret storage after running AtoAxis: Set API Key — never in settings.json, so it is never synced or committed with your editor config.",
      },
      {
        question: 'Why does the status bar show zero?',
        answer:
          'The extension cannot find wakaclock-cli. Run AtoAxis: Configure CLI Path, or set wakaclock.cliPath to the absolute path of the binary.',
      },
      {
        question: 'Does it track other apps or browser tabs?',
        answer:
          'No. It tracks file activity only, inside VS Code. There are no app, domain or URL heartbeats.',
      },
      {
        question: 'Which AI agents does it attribute?',
        answer:
          'Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI have bundled hooks. Cursor and Copilot need a provider-specific adapter first.',
      },
    ],
  },
  {
    title: 'ส่วนขยาย AtoAxis สำหรับติดตามเวลาใน VS Code',
    description: 'ติดตั้งและตั้งค่า AtoAxis VS Code extension',
    lead: 'extension ของเราจะ buffer editor activity แบบ metadata แล้วส่ง heartbeat ผ่าน wakaclock-cli',
    headings: [
      'ข้อมูลที่ติดตาม',
      'สิ่งที่ต้องมี',
      'การติดตั้ง',
      'การทำงาน',
      'Settings',
      'ข้อจำกัด',
    ],
    faqEntries: [
      {
        question: 'extension ติดตามอะไรบ้าง?',
        answer:
          'Metadata ของไฟล์ โปรเจกต์ branch ภาษา และ editor รวมถึงกิจกรรม save, debug, build และ keystroke/character counts โดยไม่ส่งเนื้อหาไฟล์',
      },
      {
        question: 'ต้องมีอะไรก่อนติดตั้ง?',
        answer:
          'VS Code 1.90 ขึ้นไป, wakaclock-cli ใน PATH (หรือกำหนด wakaclock.cliPath) และ API key ที่สร้างจาก dashboard',
      },
      {
        question: 'API key เก็บไว้ที่ไหน?',
        answer:
          'เก็บใน secret storage ของ VS Code หลังรันคำสั่ง AtoAxis: Set API Key ไม่เคยเก็บใน settings.json จึงไม่ถูก sync หรือ commit ไปกับ config อื่น',
      },
      {
        question: 'ทำไม status bar ถึงขึ้นศูนย์?',
        answer:
          'extension หา wakaclock-cli ไม่เจอ ให้รัน AtoAxis: Configure CLI Path หรือกำหนด wakaclock.cliPath เป็น path เต็มของ binary',
      },
      {
        question: 'ติดตามแอปอื่นหรือ browser tab ด้วยหรือไม่?',
        answer:
          'ไม่ ติดตามเฉพาะกิจกรรมกับไฟล์ใน VS Code เท่านั้น ไม่มี heartbeat ประเภท app, domain หรือ URL',
      },
      {
        question: 'รองรับ AI agent ตัวใดบ้าง?',
        answer:
          'Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI มี hook ให้พร้อมใช้ ส่วน Cursor และ Copilot ต้องมี adapter เฉพาะของผู้ให้บริการก่อน',
      },
    ],
  }
);
generic(
  '/pricing',
  {
    title: 'Developer time tracking pricing',
    description: `Review AtoAxis planned pricing: $${PRICING.monthlyUsd} monthly or $${PRICING.annualUsd} annually for complete coding history and developer analytics. Checkout is not open yet.`,
    lead: `AtoAxis plans one hosted developer time tracking plan at $${PRICING.monthlyUsd} per month or $${PRICING.annualUsd} per year. Checkout is not open during Early Access, so joining the list creates no charge.`,
    headings: ['What does the plan include?', 'When will billing become available?'],
    faqEntries: [
      {
        question: 'Is AtoAxis checkout open now?',
        answer:
          'No. Checkout is not open during Early Access, and joining the list does not create a subscription or charge.',
      },
      {
        question: 'What is the planned monthly price?',
        answer: `The published target is $${PRICING.monthlyUsd} per month for the complete hosted plan. Final terms will be shown before checkout opens.`,
      },
      {
        question: 'What is the planned annual price?',
        answer: `The published target is $${PRICING.annualUsd} per year, which is $${PRICING.monthlyUsd * 12 - PRICING.annualUsd} less than twelve planned monthly payments.`,
      },
      {
        question: 'What is intended to be included?',
        answer:
          'The planned plan includes unlimited projects and heartbeats, complete coding history, filterable analytics, AI attribution, project rules, WakaTime import, goals and supported leaderboards.',
      },
      {
        question: 'Is there a free tier?',
        answer:
          'A permanent free tier is not currently listed. Early Access has no active checkout, so no payment is collected today.',
      },
      {
        question: 'Will joining Early Access charge me?',
        answer:
          'No. Joining Early Access only records your interest. It does not start a paid plan or collect payment details.',
      },
    ],
  },
  {
    title: 'ราคา',
    description: `ตรวจราคาเป้าหมายของ AtoAxis: $${PRICING.monthlyUsd} ต่อเดือน หรือ $${PRICING.annualUsd} ต่อปี พร้อมสิ่งที่รวมในแผนและสถานะ Early Access ซึ่งยังไม่เปิด checkout หรือเก็บเงิน`,
    lead: 'ช่วง Early Access ยังไม่เปิด checkout และยังไม่มีการเรียกเก็บเงิน',
    headings: ['สิ่งที่รวมในแผน', 'การเรียกเก็บเงินและสถานะ'],
    faqEntries: [
      {
        question: 'ตอนนี้ AtoAxis เปิด checkout แล้วหรือยัง?',
        answer:
          'ยัง ช่วง Early Access ยังไม่เปิด checkout และการเข้าร่วมรายการไม่สร้าง subscription หรือค่าใช้จ่าย',
      },
      {
        question: 'ราคารายเดือนที่วางไว้เท่าไร?',
        answer: `ราคาเป้าหมายที่ประกาศไว้คือ $${PRICING.monthlyUsd} ต่อเดือนสำหรับ hosted plan แบบครบชุด โดยจะแสดงเงื่อนไขสุดท้ายก่อนเปิด checkout`,
      },
      {
        question: 'ราคารายปีที่วางไว้เท่าไร?',
        answer: `ราคาเป้าหมายคือ $${PRICING.annualUsd} ต่อปี ซึ่งน้อยกว่าการจ่ายรายเดือนครบสิบสองครั้ง $${PRICING.monthlyUsd * 12 - PRICING.annualUsd}`,
      },
      {
        question: 'แผนนี้ตั้งใจรวมอะไรบ้าง?',
        answer:
          'แผนที่วางไว้รวมโปรเจกต์และ heartbeat ไม่จำกัด ประวัติทั้งหมด analytics, AI attribution, project rules, WakaTime import, goals และ leaderboards ที่รองรับ',
      },
      {
        question: 'มี free tier หรือไม่?',
        answer:
          'ขณะนี้ยังไม่ได้ประกาศ free tier แบบถาวร และในช่วง Early Access ยังไม่มี checkout จึงยังไม่มีการเก็บเงิน',
      },
      {
        question: 'เข้าร่วม Early Access แล้วจะถูกเรียกเก็บเงินหรือไม่?',
        answer:
          'ไม่ การเข้าร่วมเป็นเพียงการแจ้งความสนใจ ไม่เริ่มแผนแบบชำระเงินและไม่เก็บข้อมูลการชำระเงิน',
      },
    ],
  }
);
generic(
  '/privacy',
  {
    title: 'Privacy and data collection',
    description: 'See what an AtoAxis heartbeat stores and what never leaves your machine.',
    lead: 'Heartbeats carry metadata and counts, never source code, prompts, responses or transcript bodies.',
    headings: [
      'What is collected',
      'What is never collected',
      'File paths are sensitive',
      'AI-related data',
      'How data travels',
      'Retention and deletion',
    ],
    faqEntries: [
      {
        question: 'What fields does a heartbeat actually contain?',
        answer:
          'File path and save state, project and Git branch, language, editor, OS and machine, line/cursor/keystroke/character counts, activity category, AI fields and timestamps.',
      },
      {
        question: 'Is my source code ever sent?',
        answer: 'No. There is no field for source code, diffs or patches.',
      },
      {
        question: 'Are AI prompts or responses stored?',
        answer:
          'No. AI heartbeats store a flag, the agent name and line counts. Provider-reported token usage may be stored as usage metadata; prompt and response text never is.',
      },
      {
        question: 'Why is the file path treated as sensitive?',
        answer:
          'A path can carry a client name, an unreleased product or your own name in a home directory. It is used to derive the project, language and file breakdown, and is never shown to anyone else.',
      },
      {
        question: 'How does data travel from my editor to the server?',
        answer:
          'The editor hands buffered activity to the local wakaclock-cli, which sends it over HTTPS authenticated with your API key. Heartbeat data is not sent to third-party analytics or advertising services.',
      },
      {
        question: 'How long is my data retained?',
        answer:
          'Heartbeats are kept while the account is active rather than aged out after a window. Deletion of an account or its data can be requested by email.',
      },
      {
        question: 'What happens if I revoke my API key?',
        answer:
          'New data stops immediately; revoking a key does not delete data that already exists.',
      },
    ],
  },
  {
    title: 'Privacy และข้อมูลที่เก็บ',
    description: 'ดูข้อมูลใน heartbeat และสิ่งที่ไม่ออกจากเครื่อง',
    lead: 'Heartbeat มี metadata และ counts ไม่เก็บ source code, prompt, response หรือ transcript body',
    headings: [
      'ข้อมูลที่เก็บ',
      'สิ่งที่ไม่เคยเก็บ',
      'File path เป็นข้อมูลอ่อนไหว',
      'ข้อมูลที่เกี่ยวกับ AI',
      'ข้อมูลเดินทางอย่างไร',
      'การเก็บรักษาและลบ',
    ],
    faqEntries: [
      {
        question: 'heartbeat มี field อะไรบ้าง?',
        answer:
          'File path และสถานะ save, project และ Git branch, language, editor, OS และ machine, line/cursor/keystroke/character counts, activity category, AI fields และ timestamp',
      },
      {
        question: 'ระบบส่ง source code ของฉันไปด้วยหรือไม่?',
        answer: 'ไม่ ไม่มี field สำหรับ source code, diff หรือ patch',
      },
      {
        question: 'เก็บ prompt หรือ response ของ AI หรือไม่?',
        answer:
          'ไม่ AI heartbeat เก็บเพียง flag ชื่อ agent และ line counts ส่วน provider-reported token usage อาจเก็บเป็น usage metadata แต่ไม่เก็บ prompt หรือ response text',
      },
      {
        question: 'ทำไม file path ถึงถือเป็นข้อมูลอ่อนไหว?',
        answer:
          'path อาจมีชื่อลูกค้า ชื่อผลิตภัณฑ์ที่ยังไม่เปิดตัว หรือชื่อคุณเองใน home directory ใช้เพื่อหาโปรเจกต์ ภาษา และ breakdown เท่านั้น และไม่ถูกแสดงให้ใครเห็น',
      },
      {
        question: 'ข้อมูลเดินทางจาก editor ไปยัง server อย่างไร?',
        answer:
          'editor ส่งกิจกรรมที่ buffer ไว้ให้ wakaclock-cli ในเครื่อง แล้ว CLI ส่งผ่าน HTTPS โดยยืนยันตัวตนด้วย API key ข้อมูล heartbeat ไม่ถูกส่งไปยัง analytics หรือโฆษณาของบุคคลที่สาม',
      },
      {
        question: 'เก็บข้อมูลไว้นานแค่ไหน?',
        answer:
          'heartbeat ถูกเก็บไว้ตราบเท่าที่บัญชียังใช้งานอยู่ ไม่ถูกตัดเมื่อพ้นช่วงเวลาหนึ่ง ขอลบบัญชีหรือข้อมูลได้ทางอีเมล',
      },
      {
        question: 'ถ้าเพิกถอน API key จะเกิดอะไรขึ้น?',
        answer: 'ข้อมูลใหม่จะหยุดทันที แต่การเพิกถอนไม่ลบข้อมูลที่มีอยู่แล้ว',
      },
    ],
  }
);
generic(
  '/docs',
  {
    title: 'AtoAxis developer time tracking documentation',
    description:
      'Use AtoAxis documentation to connect an editor, verify coding activity, configure compatible integrations and understand heartbeat privacy boundaries.',
    lead: 'AtoAxis documentation explains how you connect an editor, verify your first heartbeat and understand the metadata used for developer time tracking.',
    headings: [
      'What is included in the documentation?',
      'How do you start tracking coding time?',
      'Where can you verify integrations and privacy?',
    ],
    faqEntries: [
      {
        question: 'Where should a new AtoAxis user start?',
        answer:
          'Start with Getting started, which covers the account, API key, editor connection and first verified heartbeat in order.',
      },
      {
        question: 'Where are editor settings documented?',
        answer:
          'Use the VS Code integration guide for first-party commands and settings, or the integrations overview for WakaTime-compatible editors.',
      },
      {
        question: 'Where can I check exactly what a heartbeat contains?',
        answer:
          'The privacy guide lists the metadata fields that may be sent and the sensitive content that is never included.',
      },
      {
        question: 'Does the documentation cover AI coding activity?',
        answer:
          'Yes. The AI coding tracker guide explains supported agent hooks, attribution categories, token coverage and unknown cost handling.',
      },
      {
        question: 'Where is the coding-time calculation explained?',
        answer:
          'The coding-time guide explains duration blocks, the default idle timeout, short-gap bridging and why trailing gaps are not counted.',
      },
      {
        question: 'Where is the AI cost formula documented?',
        answer:
          'The AI cost methodology guide shows token classes, effective-dated provider/model prices, micro-USD arithmetic and unknown-cost handling.',
      },
      {
        question: 'Can I verify behavior against the implementation?',
        answer:
          'Yes. The documentation identifies the shipped CLI commands, configuration paths and integration boundaries, and the contact page can answer implementation questions that are not covered there.',
      },
    ],
  },
  {
    title: 'เอกสาร AtoAxis',
    description:
      'เริ่มใช้ AtoAxis จากคู่มือเชื่อม editor และตรวจ heartbeat แรก อ่านวิธีคำนวณเวลา AI attribution การตั้งค่า integration และข้อมูลที่ส่งเพื่อใช้งานอย่างเข้าใจ',
    lead: 'เชื่อม editor และทำความเข้าใจ hosted product ผ่านคู่มือนี้',
    headings: [
      'เอกสารนี้มีอะไรบ้าง?',
      'เริ่มติดตามเวลาการเขียนโค้ดอย่างไร?',
      'ตรวจสอบ integration และ privacy ที่ไหน?',
    ],
    faqEntries: [
      {
        question: 'ผู้ใช้ AtoAxis ใหม่ควรเริ่มที่ไหน?',
        answer:
          'เริ่มจากคู่มือเริ่มต้นใช้งาน ซึ่งเรียงขั้นตอนตั้งแต่บัญชี API key การเชื่อม editor ไปจนถึงการยืนยัน heartbeat แรก',
      },
      {
        question: 'การตั้งค่า editor อยู่ในเอกสารใด?',
        answer:
          'ใช้คู่มือ VS Code integration สำหรับ command และ settings ของ extension หรือดูหน้ารวม integrations สำหรับ editor ที่รองรับ WakaTime protocol',
      },
      {
        question: 'ตรวจสอบได้ที่ไหนว่า heartbeat มีข้อมูลอะไร?',
        answer:
          'คู่มือ Privacy แสดง field ของ metadata ที่อาจส่ง และรายการข้อมูลอ่อนไหวที่ไม่อยู่ใน heartbeat',
      },
      {
        question: 'เอกสารครอบคลุม AI coding activity หรือไม่?',
        answer:
          'ครอบคลุม คู่มือ AI coding tracker อธิบาย agent hooks ที่รองรับ หมวด attribution, token coverage และการจัดการ cost ที่ไม่ทราบค่า',
      },
      {
        question: 'อธิบายวิธีคำนวณ coding time ที่ไหน?',
        answer:
          'ดูคู่มือวิธีคำนวณเวลาการเขียนโค้ด ซึ่งอธิบาย duration block, idle timeout, การเชื่อม gap สั้น และเหตุผลที่ไม่รวมเวลาหลัง event สุดท้าย',
      },
      {
        question: 'สูตรคำนวณค่าใช้จ่าย AI อยู่ที่ไหน?',
        answer:
          'ดูคู่มือวิธีคำนวณค่าใช้จ่าย AI ซึ่งแสดงประเภท token, ราคา provider/model ตามช่วงเวลา หน่วย micro-USD และการจัดการราคาที่ไม่ทราบ',
      },
      {
        question: 'ตรวจสอบข้อมูลกับ implementation ได้หรือไม่?',
        answer:
          'ได้ เอกสารระบุ CLI command, config path และขอบเขต integration ที่มีอยู่จริง ส่วนคำถามที่เอกสารยังไม่ครอบคลุมสามารถสอบถามผ่านหน้าติดต่อได้',
      },
    ],
  }
);
generic(
  '/docs/getting-started',
  {
    title: 'Getting started',
    description: 'Create an API key, connect an editor and verify tracking.',
    lead: 'Create an account, generate an API key and connect your editor when Early Access opens.',
    headings: [
      'Requirements',
      'Create an API key',
      'Connect an editor',
      'Verify tracking',
      'Troubleshooting',
    ],
    faqEntries: [
      {
        question: 'What do I need before the first heartbeat?',
        answer:
          'An editor AtoAxis can hear from, wakaclock-cli on your machine, an API key and outbound HTTPS. Undelivered heartbeats queue locally and resend later.',
      },
      {
        question: 'How do I get an API key?',
        answer:
          'Open Settings in the dashboard, find the API key panel and choose Generate key. During Early Access, keys are issued to people on the list rather than at signup.',
      },
      {
        question: 'How do I connect VS Code?',
        answer:
          'Install "AtoAxis — Developer Time Tracking", then run AtoAxis: Set API Key from the Command Palette.',
      },
      {
        question: 'How do I connect an editor that already has a WakaTime plugin?',
        answer:
          'Change api_url and api_key in that plugin’s existing settings file. AtoAxis implements the WakaTime heartbeat API, so no new extension is needed.',
      },
      {
        question: 'How do I verify tracking worked?',
        answer:
          'Run wakaclock-cli status and wakaclock-cli today, check the VS Code status bar, or open the dashboard Overview page once the first heartbeat has landed.',
      },
      {
        question: 'My total is not increasing — what should I check first?',
        answer:
          'Confirm wakaclock-cli is on PATH or wakaclock.cliPath is set, then run wakaclock-cli status. Reading code without editing, saving or switching files produces no heartbeat by design.',
      },
    ],
  },
  {
    title: 'เริ่มต้นใช้งาน',
    description: 'สร้าง API key เชื่อม editor และตรวจสอบ tracking',
    lead: 'สร้างบัญชี API key และเชื่อม editor เมื่อ Early Access เปิด',
    headings: [
      'สิ่งที่ต้องเตรียม',
      'สร้าง API key',
      'เชื่อมต่อ editor',
      'ตรวจสอบ tracking',
      'แก้ปัญหาเบื้องต้น',
    ],
    faqEntries: [
      {
        question: 'ต้องมีอะไรก่อนส่ง heartbeat แรก?',
        answer:
          'editor ที่ AtoAxis รับข้อมูลได้, wakaclock-cli ในเครื่อง, API key และการเชื่อมต่อ HTTPS ขาออก heartbeat ที่ส่งไม่สำเร็จจะถูกคิวไว้แล้วส่งใหม่ภายหลัง',
      },
      {
        question: 'สร้าง API key ได้อย่างไร?',
        answer:
          'เปิดหน้า Settings ใน dashboard แล้วกด Generate key ที่แผง API key ช่วง Early Access เราออก key ให้เฉพาะผู้ที่อยู่ในรายชื่อ ไม่ได้ออกทันทีตอนสมัคร',
      },
      {
        question: 'เชื่อม VS Code อย่างไร?',
        answer:
          'ติดตั้ง "AtoAxis — Developer Time Tracking" แล้วรัน AtoAxis: Set API Key จาก Command Palette',
      },
      {
        question: 'เชื่อม editor ที่มี WakaTime plugin อยู่แล้วอย่างไร?',
        answer:
          'แก้ api_url และ api_key ในไฟล์ settings ของ plugin เดิม เพราะ AtoAxis รองรับ WakaTime heartbeat API จึงไม่ต้องติดตั้ง extension ใหม่',
      },
      {
        question: 'ตรวจสอบได้อย่างไรว่า tracking ทำงาน?',
        answer:
          'รัน wakaclock-cli status และ wakaclock-cli today ดู status bar ของ VS Code หรือเปิดหน้า Overview ใน dashboard หลังมี heartbeat แรกแล้ว',
      },
      {
        question: 'ยอดไม่เพิ่มขึ้น ควรตรวจอะไรก่อน?',
        answer:
          'ตรวจว่า wakaclock-cli อยู่ใน PATH หรือกำหนด wakaclock.cliPath แล้ว จากนั้นรัน wakaclock-cli status การอ่านโค้ดเฉย ๆ โดยไม่แก้ไข save หรือสลับไฟล์จะไม่เกิด heartbeat ตามการออกแบบ',
      },
    ],
  }
);
generic(
  '/docs/migrate-from-wakatime',
  {
    title: 'Migrate from WakaTime to AtoAxis',
    description:
      'Move from WakaTime to AtoAxis: keep your WakaTime plugin, change two settings, then import your WakaTime heartbeat export without double-counting time.',
    lead: 'To move from WakaTime to AtoAxis, keep the WakaTime plugin you already use and change two lines in ~/.wakatime.cfg: api_url and api_key. New coding time then goes to AtoAxis. To bring your history, export your heartbeats from WakaTime and import the JSON file in the dashboard; the import resumes after interruptions and never counts the same heartbeat twice.',
    headings: [
      'Before you start',
      'Get an AtoAxis API key',
      'Point your WakaTime plugin at AtoAxis',
      'Check that the first heartbeat arrived',
      'Export your WakaTime history',
      'Import the export into AtoAxis',
      'What changes after you move',
    ],
    faqEntries: [
      {
        question: 'Do I need to uninstall the WakaTime plugin?',
        answer:
          'No. Keep it installed and change api_url and api_key in ~/.wakatime.cfg. AtoAxis implements the WakaTime heartbeat API, so the plugin works as before.',
      },
      {
        question: 'Can I import my full WakaTime history?',
        answer:
          'Yes, from a WakaTime data export of type heartbeats. Large exports are split into chunks in the browser and imported in order, and the import can be resumed with the same file.',
      },
      {
        question: 'Why was my WakaTime export rejected?',
        answer:
          'It most likely contains daily summaries instead of raw heartbeats. Summaries cannot be rebuilt into a timeline, so create a new export and choose heartbeats.',
      },
      {
        question: 'Will importing the same file twice double my time?',
        answer:
          'No. Each imported heartbeat gets an ID derived from its content, so heartbeats that were already imported are skipped and reported as skipped.',
      },
      {
        question: 'Does the imported history keep AI information?',
        answer:
          'Heartbeats that WakaTime marked as AI stay AI, but without an agent name, because the export does not say which tool made the change.',
      },
      {
        question: 'Can I switch back to WakaTime later?',
        answer:
          'Yes. Delete the api_url line and put your WakaTime key back in api_key. Data already in either account is not deleted.',
      },
    ],
  },
  {
    title: 'ย้ายจาก WakaTime มาใช้ AtoAxis',
    description:
      'วิธีย้ายจาก WakaTime มา AtoAxis ใช้ WakaTime plugin เดิม แก้ค่าตั้งค่าสองบรรทัด แล้ว import ประวัติ heartbeat จาก WakaTime โดยเวลาไม่ถูกนับซ้ำ',
    lead: 'การย้ายจาก WakaTime มา AtoAxis ไม่ต้องถอน plugin เดิม คุณแค่แก้สองบรรทัดใน ~/.wakatime.cfg คือ api_url และ api_key แล้วเวลาเขียนโค้ดใหม่จะเข้ามาที่ AtoAxis ส่วนประวัติเดิม ให้ export heartbeat จาก WakaTime แล้ว import ไฟล์ JSON ใน dashboard ระบบทำต่อได้ถ้าขาดกลางทาง และไม่นับ heartbeat เดิมซ้ำ',
    headings: [
      'ก่อนเริ่ม',
      'สร้าง API key ของ AtoAxis',
      'ชี้ WakaTime plugin มาที่ AtoAxis',
      'ตรวจว่า heartbeat แรกเข้าแล้ว',
      'export ประวัติจาก WakaTime',
      'import ไฟล์ export เข้า AtoAxis',
      'อะไรเปลี่ยนไปหลังย้าย',
    ],
    faqEntries: [
      {
        question: 'ต้องถอน WakaTime plugin ออกไหม?',
        answer:
          'ไม่ต้อง เก็บ plugin ไว้ตามเดิม แล้วแก้ api_url และ api_key ใน ~/.wakatime.cfg เพราะ AtoAxis รองรับ WakaTime heartbeat API plugin จึงทำงานได้เหมือนเดิม',
      },
      {
        question: 'import ประวัติ WakaTime ทั้งหมดได้ไหม?',
        answer:
          'ได้ ใช้ไฟล์ export ของ WakaTime แบบ heartbeats ไฟล์ใหญ่จะถูกแบ่งเป็นชิ้นใน browser แล้ว import ตามลำดับ และทำต่อได้ด้วยการเลือกไฟล์เดิมอีกครั้ง',
      },
      {
        question: 'ทำไมไฟล์ export ของ WakaTime ถึงถูกปฏิเสธ?',
        answer:
          'ส่วนใหญ่เป็นเพราะไฟล์มีแต่สรุปรายวัน (daily) ไม่มี heartbeat ดิบ ข้อมูลสรุปสร้าง timeline กลับคืนไม่ได้ ให้สร้าง export ใหม่แล้วเลือกแบบ heartbeats',
      },
      {
        question: 'import ไฟล์เดิมสองครั้ง เวลาจะเพิ่มเป็นสองเท่าไหม?',
        answer:
          'ไม่ heartbeat ที่ import แต่ละรายการมี ID ที่คำนวณจากเนื้อหาของมันเอง รายการที่ import ไปแล้วจึงถูกข้าม และแสดงเป็นจำนวนที่ถูกข้าม',
      },
      {
        question: 'ประวัติที่ import มายังมีข้อมูล AI อยู่ไหม?',
        answer:
          'heartbeat ที่ WakaTime ระบุว่าเป็นงาน AI จะยังนับเป็น AI แต่ไม่มีชื่อ agent เพราะไฟล์ export ไม่ได้บอกว่าเครื่องมือตัวไหนเป็นผู้แก้ไข',
      },
      {
        question: 'ย้ายกลับไป WakaTime ภายหลังได้ไหม?',
        answer:
          'ได้ ลบบรรทัด api_url แล้วใส่ key ของ WakaTime กลับใน api_key ข้อมูลที่อยู่ในทั้งสองบัญชีแล้วจะไม่ถูกลบ',
      },
    ],
  }
);
generic(
  '/about',
  {
    title: `About ${SITE_NAME}`,
    description: `Learn why ${SITE_NAME} exists and who builds it.`,
    lead: `${SITE_NAME} (spelled A-t-o-A-x-i-s) is a developer time-tracking product developed by team Atoaxis. It is not affiliated with similarly named products such as ATOSS, Atto or Axis ERP.`,
    headings: ['Why we are building it', 'Current status', 'Who builds it'],
    faqEntries: [
      {
        question: `Is ${SITE_NAME} affiliated with ATOSS, Atto or Axis ERP?`,
        answer: 'No. The name is spelled A-t-o-A-x-i-s and is unrelated to those products.',
      },
      {
        question: 'Who builds AtoAxis?',
        answer: 'Team Atoaxis designs, develops and operates the hosted service.',
      },
      {
        question: 'What is actually working today?',
        answer:
          'Heartbeat ingestion, duration analytics by project/language/editor/branch, AI attribution hooks, and a first-party VS Code extension.',
      },
      {
        question: 'What is not ready yet?',
        answer:
          'Billing and checkout, assigned team and organisation seats, and adapters for Cursor and Copilot.',
      },
    ],
  },
  {
    title: `เกี่ยวกับ ${SITE_NAME}`,
    description: `รู้จักเหตุผลและผู้พัฒนา ${SITE_NAME}`,
    lead: `${SITE_NAME} (สะกด A-t-o-A-x-i-s) เป็นผลิตภัณฑ์ติดตามเวลาการเขียนโค้ดสำหรับนักพัฒนา พัฒนาขึ้น โดย team Atoaxis ไม่มีความเกี่ยวข้องกับผลิตภัณฑ์ชื่อคล้ายกันอย่าง ATOSS, Atto หรือ Axis ERP`,
    headings: ['เหตุผลที่สร้าง', 'สถานะปัจจุบัน', 'ผู้พัฒนา'],
    faqEntries: [
      {
        question: `${SITE_NAME} เกี่ยวข้องกับ ATOSS, Atto หรือ Axis ERP หรือไม่?`,
        answer: 'ไม่เกี่ยวข้อง สะกดว่า A-t-o-A-x-i-s และเป็นคนละผลิตภัณฑ์กัน',
      },
      {
        question: `ใครเป็นผู้พัฒนา ${SITE_NAME}?`,
        answer: 'พัฒนาขึ้น โดย team Atoaxis ซึ่งเป็นผู้ออกแบบ พัฒนา และดูแลบริการ hosted นี้',
      },
      {
        question: 'ตอนนี้ใช้งานได้จริงส่วนไหนบ้าง?',
        answer:
          'การรับ heartbeat, analytics แบบ duration ตาม project/language/editor/branch, AI attribution hooks และ extension สำหรับ VS Code ที่เราดูแลเอง',
      },
      {
        question: 'ส่วนไหนยังไม่พร้อม?',
        answer:
          'ระบบเรียกเก็บเงินและ checkout, team และ organisation seat ที่กำหนดให้ และ adapter สำหรับ Cursor และ Copilot',
      },
    ],
  }
);
generic(
  '/contact',
  {
    title: 'Contact AtoAxis',
    description: 'Contact AtoAxis about Early Access, integrations and privacy.',
    lead: 'Ask about Early Access, hosted analytics, integrations or privacy.',
    headings: ['Topics we can help with'],
    form: 'contact',
    faqEntries: [
      {
        question: 'Who reads the contact form?',
        answer: 'A real person on the team building the product, not an automated support queue.',
      },
      {
        question: 'Can you tell me if my editor is compatible?',
        answer:
          'Yes. Name the editor you use and whether it already has a WakaTime plugin, and you will get a direct answer with the setting to change.',
      },
      {
        question: 'Can I ask about a specific heartbeat field?',
        answer:
          'Yes, though the privacy page already lists every field a heartbeat can and cannot contain, and answers most of these questions faster than waiting for a reply.',
      },
      {
        question: 'Do you offer account-specific support here?',
        answer:
          'This form answers product questions. Early Access does not yet have a separate account support channel.',
      },
    ],
  },
  {
    title: 'ติดต่อ AtoAxis',
    description: 'ติดต่อ AtoAxis เรื่อง Early Access integrations และ privacy',
    lead: 'สอบถามเรื่อง Early Access, hosted analytics, integrations หรือ privacy',
    headings: ['หัวข้อที่สอบถามได้'],
    form: 'contact',
    faqEntries: [
      {
        question: 'ใครเป็นคนอ่านฟอร์มติดต่อนี้?',
        answer: 'คนในทีมที่พัฒนาผลิตภัณฑ์อ่านเองจริง ไม่ใช่คิวระบบอัตโนมัติ',
      },
      {
        question: 'ถามได้ไหมว่า editor ของฉันใช้ได้หรือเปล่า?',
        answer:
          'ได้ ระบุชื่อ editor และบอกว่ามี WakaTime plugin อยู่แล้วหรือไม่ จะได้คำตอบตรงพร้อม setting ที่ต้องแก้',
      },
      {
        question: 'ถามเรื่อง field ใน heartbeat ได้ไหม?',
        answer:
          'ได้ แต่หน้า privacy มีรายการ field ทั้งหมดอยู่แล้ว และตอบคำถามส่วนใหญ่ได้เร็วกว่าการรอคำตอบ',
      },
      {
        question: 'มีช่องทาง support สำหรับบัญชีโดยเฉพาะหรือไม่?',
        answer:
          'ฟอร์มนี้ตอบคำถามเกี่ยวกับผลิตภัณฑ์ ช่วง Early Access ยังไม่มีช่องทาง support แยกสำหรับบัญชี',
      },
    ],
  }
);
generic(
  '/terms',
  {
    title: `${SITE_NAME} terms`,
    description: 'Early Access, hosted service and acceptable-use terms.',
    lead: `These preliminary terms describe the ${SITE_NAME} Early Access website.`,
    headings: ['Early Access', 'Hosted service and data', 'Acceptable use', 'Questions'],
    faqEntries: [
      {
        question: 'Does joining Early Access create a paid account?',
        answer: 'No. It registers interest only; no account is created and no payment is taken.',
      },
      {
        question: 'Who owns the activity data I send?',
        answer: 'You do. It is not sold, shared with advertisers, or used as training material.',
      },
      {
        question: 'Can I share one API key across a team?',
        answer:
          'No. One key identifies one account; sharing it is against the acceptable-use rules.',
      },
      {
        question: 'Will these terms change before launch?',
        answer:
          'Yes. These are preliminary terms and will be replaced before the product becomes payable.',
      },
    ],
  },
  {
    title: `ข้อกำหนด ${SITE_NAME}`,
    description: 'ข้อกำหนด Early Access hosted service และ acceptable use',
    lead: `ข้อกำหนดเบื้องต้นนี้อธิบายเว็บไซต์ ${SITE_NAME} ในช่วง Early Access`,
    headings: ['Early Access', 'Hosted service และข้อมูล', 'การใช้งานที่ยอมรับได้', 'คำถาม'],
    faqEntries: [
      {
        question: 'เข้าร่วม Early Access สร้างบัญชีแบบชำระเงินหรือไม่?',
        answer: 'ไม่ เป็นเพียงการแสดงความสนใจ ไม่มีการสร้างบัญชีและไม่มีการเรียกเก็บเงิน',
      },
      {
        question: 'ข้อมูลกิจกรรมที่ส่งไปเป็นของใคร?',
        answer: 'เป็นของคุณ ไม่ถูกขาย ไม่ถูกแบ่งให้ผู้โฆษณา และไม่ถูกใช้เป็นข้อมูลฝึกโมเดล',
      },
      {
        question: 'แชร์ API key เดียวกันในทีมได้หรือไม่?',
        answer: 'ไม่ได้ key หนึ่งดวงระบุถึงบัญชีเดียว การแชร์ขัดกับกฎการใช้งานที่ยอมรับได้',
      },
      {
        question: 'ข้อกำหนดนี้จะเปลี่ยนก่อนเปิดตัวหรือไม่?',
        answer:
          'จะเปลี่ยน นี่เป็นข้อกำหนดเบื้องต้นและจะถูกแทนที่ก่อนที่ผลิตภัณฑ์จะเริ่มมีค่าใช้จ่าย',
      },
    ],
  }
);
generic(
  '/early-access',
  {
    title: 'Join AtoAxis Early Access',
    description: 'Join the AtoAxis Early Access list.',
    lead: 'Register interest in hosted developer time tracking and launch updates.',
    headings: [],
    form: 'early-access',
    faqEntries: [
      {
        question: 'Does joining charge me anything?',
        answer: 'No. Joining the list creates no charge and collects no payment details.',
      },
      {
        question: 'When do I get an API key?',
        answer:
          'Keys are issued to people on the list as Early Access opens, not automatically at signup.',
      },
      {
        question: 'What is the planned price once checkout opens?',
        answer: `$${PRICING.monthlyUsd} per month or $${PRICING.annualUsd} per year for one complete plan.`,
      },
    ],
  },
  {
    title: 'เข้าร่วม AtoAxis Early Access',
    description: 'ลงทะเบียน AtoAxis Early Access',
    lead: 'ลงทะเบียนความสนใจใน hosted developer time tracking และข่าวการเปิดตัว',
    headings: [],
    form: 'early-access',
    faqEntries: [
      {
        question: 'เข้าร่วมแล้วมีค่าใช้จ่ายหรือไม่?',
        answer: 'ไม่มี การเข้าร่วมรายการไม่มีค่าใช้จ่ายและไม่มีการเก็บข้อมูลการชำระเงิน',
      },
      {
        question: 'จะได้ API key เมื่อไร?',
        answer: 'key จะออกให้ผู้ที่อยู่ในรายชื่อเมื่อ Early Access เปิด ไม่ได้ออกทันทีตอนลงทะเบียน',
      },
      {
        question: 'ราคาที่วางไว้เมื่อเปิด checkout คือเท่าไร?',
        answer: `$${PRICING.monthlyUsd} ต่อเดือน หรือ $${PRICING.annualUsd} ต่อปี สำหรับแผนเดียวที่ครบทุกฟีเจอร์`,
      },
    ],
  }
);

dualPage(
  '/ai-cost-tracking',
  {
    metadataTitle: 'AI Coding Cost and Token Usage Tracking',
    description:
      'Track Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI token usage and estimated cost per project. Prices are versioned and effective-dated, and an unknown price stays unknown instead of being reported as zero.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'AI cost tracking', path: '/ai-cost-tracking' },
    ],
    title: 'AI coding cost and token tracking',
    lead: `${SITE_NAME} records how many tokens your coding agents consume and what that usage is estimated to cost, broken down by project and by day. Input, output and cache tokens are kept apart, prices are versioned and effective-dated, and any figure that cannot be derived from reported usage and a known price is returned as unknown rather than as zero.`,
    sections: [
      section('What AI cost tracking measures', 'what-is', [
        p(
          'A coding agent bills on tokens, not on the time you spent watching it work. Duration answers "how long was this session"; token usage answers "what did this session consume". Both are recorded here, on the same timeline, so a project can be read as time spent and as spend incurred.'
        ),
        sub('The four token classes'),
        bullets([
          'Input tokens: what was sent to the model',
          'Output tokens: what the model generated',
          'Cache read tokens: prompt content served from cache, billed at a lower rate',
          'Cache write tokens: content written into the cache, billed at a higher rate',
        ]),
        p(
          'They are stored separately because they are priced separately. Collapsing them into one number makes a cache-heavy session look identical to one that re-sent its whole context, and those two sessions do not cost the same.'
        ),
      ]),
      section('How usage reaches your account', 'how', [
        p(
          'Usage events arrive on a dedicated endpoint that carries identifiers and counts only. There is no prompt, response, patch, file path or source-code field in the payload.'
        ),
        code(
          '[\n  {\n    "usage_event_id": "msg_01ExampleProviderMessageId",\n    "ai_session_id": "your-session-id",\n    "occurred_at": "2026-08-23T04:15:00Z",\n    "agent": "claude-code",\n    "provider": "anthropic",\n    "model": "your-model-name",\n    "prompt_count": 1,\n    "input_tokens": 18450,\n    "output_tokens": 1220,\n    "cache_read_tokens": 96300,\n    "cache_write_tokens": 4100,\n    "token_source": "reported"\n  }\n]',
          'POST /api/v1/ai/usage'
        ),
        p(
          'Events are keyed by the provider’s own message id, so replaying a transcript cannot double-count a session. Bundled hooks read this from each agent’s local transcript; you can also post it from your own wrapper.'
        ),
      ]),
      section('Which agents are covered', 'agents', [
        bullets([
          'Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI have bundled hooks that read their local transcripts',
          'Any other tool can post to the same endpoint directly',
          'Cursor and Copilot need a provider-specific adapter before their usage can be attributed',
        ]),
        p(
          'A tool with no hook and no adapter is not reported as zero usage. It is simply absent, and the coverage figures show how much of the period that absence accounts for.'
        ),
      ]),
      section('How estimated cost is calculated', 'pricing', [
        p(
          'Cost is derived, never guessed. Each provider and model pair has price rows with an effective window, so an event is priced with the rate that was actually in force when it happened rather than with today’s rate.'
        ),
        sub('The rules that keep the number honest'),
        bullets([
          'Pricing is selected by provider and model together, never by model name alone — two providers can publish the same model label at different rates',
          'Each price row carries an effective-from date and a version, so a repricing does not silently rewrite last month',
          'Amounts are held in micro-USD to avoid rounding drift across millions of events',
          'An unknown provider or model produces an unknown cost, not a cost of zero',
        ]),
        p(
          'The shipped catalogue covers Anthropic list prices. Usage from a provider with no price row still reports its tokens — you keep the consumption figure and lose only the money figure.'
        ),
      ]),
      section('Cost per project', 'per-project', [
        p(
          'Usage events carry the agent’s workspace context, reduced to a project name before it leaves your machine, so spend can be grouped the same way coding time is.'
        ),
        sub('When an event has no explicit project'),
        bullets([
          'If every other event in that session belongs to one project, the event inherits it',
          'If the session touched more than one project, the event stays unattributed rather than being copied into all of them',
        ]),
        p(
          'The second rule is why a project total can be lower than the account total. Splitting an ambiguous session across projects would make every project look more expensive than it was, and there would be no way to tell which part was invented.'
        ),
      ]),
      section('Coverage instead of false precision', 'coverage', [
        p(
          'Attribution, tokens and estimated spend each carry their own coverage percentage, and a value that cannot be derived is returned as null with that coverage attached.'
        ),
        code(
          '{\n  "tokens":          { "total": 1204300, "coverage_percent": 92.4 },\n  "estimated_spend": { "amount_microusd": 3184500, "coverage_percent": 74.1, "currency": "USD" },\n  "coverage":        { "attribution_percent": 88.0, "token_percent": 92.4, "cost_percent": 74.1 }\n}',
          'GET /api/v1/dashboard/analytics'
        ),
        p(
          'A dashboard that renders an unknown as 0 is telling you something it does not know. Reading "74% priced" tells you how far to trust the total, and a subscription plan that never exposes per-call pricing is visibly out of scope rather than quietly counted as free.'
        ),
      ]),
      section('What is never collected', 'privacy', [
        bullets([
          'Prompts, model responses and conversation transcripts',
          'Source file contents and patches',
          'Absolute paths — only the final directory name is used as the project label',
        ]),
        p(
          'The usage stream is numeric and identifier-only by design. Prompt length is counted locally and only the character count is sent; the prompt text itself is discarded on your machine.'
        ),
      ]),
      section('Limits worth knowing', 'limits', [
        bullets([
          'Estimated cost is a list-price estimate, not an invoice, and will not match a bill that includes negotiated or subscription terms',
          'A subscription plan with no per-call pricing produces tokens without a cost figure',
          'Usage arrives only from agents with a hook or an adapter',
          'Historical events keep the price that was effective when they happened; changing the catalogue does not restate them',
        ]),
      ]),
    ],
    related: [
      related([
        {
          href: '/ai-coding-tracker',
          label: 'AI coding activity tracking',
          description: 'How AI, human and unattributed line counts are decided',
        },
        {
          href: '/developer-analytics',
          label: 'Developer analytics',
          description: 'The metrics produced and how each is derived',
        },
        {
          href: '/privacy',
          label: 'Privacy and data collection',
          description: 'Every field stored, and everything that is never sent',
        },
      ]),
    ],
    faq: faq('AI cost and token FAQ', [
      {
        question: 'Can I track how many tokens Claude Code uses?',
        answer:
          'Yes. A bundled hook reads Claude Code’s local transcript and posts input, output, cache read and cache write tokens per event, grouped by session, project and day.',
      },
      {
        question: 'How is the estimated cost of an AI coding session calculated?',
        answer:
          'Reported tokens are multiplied by the price that was in effect for that provider and model when the event happened. Prices are versioned and effective-dated, and an unknown provider or model yields an unknown cost rather than zero.',
      },
      {
        question: 'Does it show AI spend per project?',
        answer:
          'Yes. Usage inherits a project from its session when that session touched exactly one project; a session spanning several projects stays unattributed instead of being copied into each.',
      },
      {
        question: 'Which coding agents report token usage?',
        answer:
          'Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI have bundled hooks. Any other tool can post to the same endpoint. Cursor and Copilot need a provider-specific adapter first.',
      },
      {
        question: 'Will the estimate match my provider invoice?',
        answer:
          'No. It is a list-price estimate from reported usage. Negotiated rates, subscription bundles and provider-side adjustments are not visible to it, which is why coverage is reported alongside every total.',
      },
      {
        question: 'Are prompts or responses stored to calculate cost?',
        answer:
          'No. The usage stream carries identifiers and numeric counts only. Prompt length is counted on your machine and the text is discarded.',
      },
    ]),
  },
  {
    metadataTitle: 'ติดตาม Token และค่าใช้จ่าย AI Coding',
    description:
      'ติดตาม token และค่าใช้จ่ายโดยประมาณของ Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI แยกตามโปรเจกต์ ราคามีเวอร์ชันและช่วงเวลาที่มีผล สิ่งที่คำนวณไม่ได้จะแสดงว่าไม่ทราบ ไม่ใช่ศูนย์',
    breadcrumbs: [
      { name: 'หน้าหลัก', path: '/' },
      { name: 'ติดตามค่าใช้จ่าย AI', path: '/ai-cost-tracking' },
    ],
    title: 'ติดตาม token และค่าใช้จ่าย AI coding',
    lead: `${SITE_NAME} บันทึกว่า coding agent ของคุณใช้ token ไปเท่าไร และประมาณค่าใช้จ่ายเท่าไร แยกตามโปรเจกต์และรายวัน โดยแยก input, output และ cache token ออกจากกัน ราคามีเวอร์ชันและช่วงเวลาที่มีผลกำกับ ส่วนตัวเลขที่คำนวณจาก usage และราคาที่รู้ไม่ได้ จะรายงานว่าไม่ทราบ ไม่ใช่ศูนย์`,
    sections: [
      section('วัดอะไรบ้าง', 'what-is', [
        p(
          'coding agent คิดเงินตาม token ไม่ใช่ตามเวลาที่คุณนั่งดูมันทำงาน เวลาตอบคำถามว่า session นี้นานแค่ไหน ส่วน token ตอบว่า session นี้ใช้ทรัพยากรไปเท่าไร ทั้งสองอยู่บน timeline เดียวกัน'
        ),
        sub('token สี่ประเภท'),
        bullets([
          'Input token: สิ่งที่ส่งเข้า model',
          'Output token: สิ่งที่ model สร้างออกมา',
          'Cache read token: เนื้อหา prompt ที่อ่านจาก cache คิดราคาถูกกว่า',
          'Cache write token: เนื้อหาที่เขียนลง cache คิดราคาแพงกว่า',
        ]),
        p(
          'ที่แยกเก็บเพราะคิดราคาต่างกัน ถ้ายุบเป็นตัวเลขเดียว session ที่ใช้ cache หนักจะดูเหมือน session ที่ส่ง context ใหม่ทั้งก้อน ซึ่งราคาไม่เท่ากัน'
        ),
      ]),
      section('usage เข้ามาอย่างไร', 'how', [
        p(
          'usage event ส่งเข้า endpoint เฉพาะที่มีเฉพาะ identifier และตัวเลข ไม่มีฟิลด์สำหรับ prompt, response, patch, file path หรือ source code'
        ),
        code(
          '[\n  {\n    "usage_event_id": "msg_01ExampleProviderMessageId",\n    "ai_session_id": "your-session-id",\n    "occurred_at": "2026-08-23T04:15:00Z",\n    "agent": "claude-code",\n    "provider": "anthropic",\n    "model": "your-model-name",\n    "prompt_count": 1,\n    "input_tokens": 18450,\n    "output_tokens": 1220,\n    "cache_read_tokens": 96300,\n    "cache_write_tokens": 4100,\n    "token_source": "reported"\n  }\n]',
          'POST /api/v1/ai/usage'
        ),
        p(
          'event ใช้ message id ของ provider เป็นคีย์ ส่งซ้ำจึงนับซ้ำไม่ได้ bundled hook อ่านจาก transcript ในเครื่องคุณเอง หรือจะเขียน wrapper ส่งเองก็ได้'
        ),
      ]),
      section('agent ที่รองรับ', 'agents', [
        bullets([
          'Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI มี bundled hook อ่าน transcript ในเครื่อง',
          'เครื่องมืออื่นส่งเข้า endpoint เดียวกันได้โดยตรง',
          'Cursor และ Copilot ต้องมี adapter เฉพาะของ provider ก่อน',
        ]),
        p(
          'เครื่องมือที่ยังไม่มี hook จะไม่ถูกรายงานเป็นศูนย์ แต่จะไม่มีข้อมูล และตัวเลข coverage จะบอกว่าช่วงนั้นขาดไปเท่าไร'
        ),
      ]),
      section('คำนวณค่าใช้จ่ายอย่างไร', 'pricing', [
        p(
          'ค่าใช้จ่ายมาจากการคำนวณ ไม่ใช่การเดา แต่ละคู่ provider กับ model มีแถวราคาพร้อมช่วงเวลาที่มีผล event จึงคิดด้วยราคา ณ เวลานั้น ไม่ใช่ราคาวันนี้'
        ),
        sub('กฎที่ทำให้ตัวเลขน่าเชื่อถือ'),
        bullets([
          'เลือกราคาจาก provider คู่กับ model เสมอ ไม่เคยใช้ชื่อ model อย่างเดียว เพราะสอง provider อาจตั้งชื่อซ้ำกันแต่คิดราคาต่างกัน',
          'แต่ละแถวราคามีวันเริ่มมีผลและเวอร์ชัน การปรับราคาจึงไม่ไปเขียนทับเดือนที่แล้ว',
          'เก็บมูลค่าเป็น micro-USD เพื่อไม่ให้เกิด rounding drift เมื่อมี event หลายล้านรายการ',
          'provider หรือ model ที่ไม่รู้จัก จะได้ต้นทุนว่า "ไม่ทราบ" ไม่ใช่ ศูนย์',
        ]),
        p(
          'ชุดราคาที่ให้มาครอบราคา list price ของ Anthropic การใช้งานจาก provider ที่ยังไม่มีแถวราคายังรายงาน token ตามปกติ ขาดไปเฉพาะตัวเลขค่าใช้จ่าย'
        ),
      ]),
      section('ค่าใช้จ่ายแยกตามโปรเจกต์', 'per-project', [
        p(
          'usage event นำ workspace context ของ agent มาด้วย โดยย่อเหลือเพียงชื่อโปรเจกต์ก่อนออกจากเครื่อง จึงจัดกลุ่มค่าใช้จ่ายได้แบบเดียวกับ coding time'
        ),
        sub('เมื่อ event ไม่ระบุโปรเจกต์'),
        bullets([
          'ถ้าทุก event ใน session นั้นอยู่โปรเจกต์เดียว event นั้นจะสืบโปรเจกต์นั้น',
          'ถ้า session แตะหลายโปรเจกต์ event จะคงเป็น unattributed แทนที่จะคัดลอกไปทุกโปรเจกต์',
        ]),
        p(
          'กฎข้อสองคือเหตุผลที่ยอดรวมรายโปรเจกต์อาจน้อยกว่ายอดรวมของบัญชี การกระจาย session ที่คลุมเครือไปทุกโปรเจกต์จะทำให้ทุกโปรเจกต์ดูแพงเกินจริง และแยกไม่ออกว่าส่วนไหนถูกเดาขึ้นมา'
        ),
      ]),
      section('coverage แทนความแม่นยำเทียม', 'coverage', [
        p(
          'attribution, token และค่าใช้จ่ายมี coverage ของตัวเอง ส่วนค่าที่คำนวณไม่ได้จะเป็น null พร้อม coverage กำกับ'
        ),
        code(
          '{\n  "tokens":          { "total": 1204300, "coverage_percent": 92.4 },\n  "estimated_spend": { "amount_microusd": 3184500, "coverage_percent": 74.1, "currency": "USD" },\n  "coverage":        { "attribution_percent": 88.0, "token_percent": 92.4, "cost_percent": 74.1 }\n}',
          'GET /api/v1/dashboard/analytics'
        ),
        p(
          'dashboard ที่แสดงค่าที่ไม่รู้เป็น 0 คือการบอกสิ่งที่มันไม่รู้ การเห็นว่า "คิดราคาได้ 74%" บอกได้ว่าควรเชื่อตัวเลขรวมแค่ไหน และแพ็กเกจ subscription ที่ไม่เปิดราคาต่อครั้งจะอยู่นอกขอบเขตอย่างชัดเจน ไม่ถูกนับเงียบ ๆ ว่าฟรี'
        ),
      ]),
      section('สิ่งที่ไม่เก็บ', 'privacy', [
        bullets([
          'prompt, คำตอบของ model และ transcript ของบทสนทนา',
          'เนื้อหาไฟล์ source และ patch',
          'absolute path — ใช้เฉพาะชื่อโฟลเดอร์สุดท้ายเป็นชื่อโปรเจกต์',
        ]),
        p(
          'usage stream ออกแบบมาให้มีเฉพาะตัวเลขและ identifier ความยาว prompt ถูกนับในเครื่องคุณและส่งมาเฉพาะตัวเลข ส่วนตัวข้อความถูกทิ้งไป'
        ),
      ]),
      section('ข้อจำกัดที่ควรรู้', 'limits', [
        bullets([
          'ค่าใช้จ่ายเป็นการประมาณจาก list price ไม่ใช่ใบแจ้งหนี้ จึงไม่ตรงกับราคาที่ต่อรองไว้หรือแพ็กเกจ subscription',
          'แพ็กเกจ subscription ที่ไม่เปิดราคาต่อครั้งจะได้ token แต่ไม่ได้ค่าใช้จ่าย',
          'usage มาจาก agent ที่มี hook หรือ adapter เท่านั้น',
          'event เก่าเก็บราคา ณ เวลาที่เกิด การแก้ชุดราคาไม่ย้อนกลับไปแก้ของเดิม',
        ]),
      ]),
    ],
    related: [
      related([
        {
          href: '/ai-coding-tracker',
          label: 'ติดตาม AI coding activity',
          description: 'วิธีแยก AI, human และ unattributed',
        },
        {
          href: '/developer-analytics',
          label: 'Developer analytics',
          description: 'metrics ที่มีและวิธีคำนวณ',
        },
        {
          href: '/privacy',
          label: 'Privacy และการเก็บข้อมูล',
          description: 'ทุก field ที่เก็บ และสิ่งที่ไม่เคยส่ง',
        },
      ]),
    ],
    faq: faq('คำถามที่พบบ่อยเรื่อง token และค่าใช้จ่าย AI', [
      {
        question: 'ติดตามได้หรือไม่ว่า Claude Code ใช้ token ไปเท่าไร?',
        answer:
          'ได้ bundled hook อ่าน transcript ของ Claude Code ในเครื่องแล้วส่ง input, output, cache read และ cache write token แยกตาม session โปรเจกต์และวัน',
      },
      {
        question: 'คำนวณค่าใช้จ่ายของ AI coding session อย่างไร?',
        answer:
          'นำ token ที่ provider รายงานมาคูณกับราคาที่มีผล ณ เวลาที่ event เกิด ราคามีเวอร์ชันและช่วงเวลา หากไม่รู้จัก provider หรือ model จะตอบว่าไม่ทราบ ไม่ใช่ 0',
      },
      {
        question: 'ดูค่าใช้จ่าย AI แยกตามโปรเจกต์ได้หรือไม่?',
        answer:
          'ได้ usage จะสืบโปรเจกต์จาก session เมื่อ session นั้นแตะโปรเจกต์เดียว ถ้าแตะหลายโปรเจกต์จะคงเป็น unattributed แทนการคัดลอกไปทุกโปรเจกต์',
      },
      {
        question: 'agent ใดบ้างที่รายงาน token ได้?',
        answer:
          'Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI มี bundled hook เครื่องมืออื่นส่งเข้า endpoint เดียวกันได้ ส่วน Cursor และ Copilot ต้องมี adapter ก่อน',
      },
      {
        question: 'ตัวเลขจะตรงกับบิลจาก provider หรือไม่?',
        answer:
          'ไม่ตรง เป็นการประมาณจาก list price และ usage ที่รายงานมา ราคาที่ต่อรองไว้ แพ็กเกจ และการปรับฝั่ง provider มองไม่เห็น จึงต้องดู coverage ควบคู่เสมอ',
      },
      {
        question: 'ต้องเก็บ prompt หรือ response เพื่อคำนวณค่าใช้จ่ายหรือไม่?',
        answer:
          'ไม่ต้อง usage stream มีเฉพาะ identifier และตัวเลข ความยาว prompt นับในเครื่องแล้วทิ้งข้อความ',
      },
    ]),
  }
);

dualPage(
  '/docs/how-coding-time-is-calculated',
  {
    metadataTitle: 'How AtoAxis calculates coding time',
    description:
      'Learn how AtoAxis turns editor heartbeats into duration blocks, bridges short idle gaps and leaves long or trailing gaps uncounted.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Docs', path: '/docs' },
      { name: 'How coding time is calculated', path: '/docs/how-coding-time-is-calculated' },
    ],
    title: 'How AtoAxis calculates coding time',
    lead: 'AtoAxis derives coding time from editor heartbeats. Nearby evidence becomes a duration block; a long or trailing gap stays outside the total.',
    howTo: {
      name: 'Calculate coding time from editor heartbeats',
      description: 'Follow the data path from a heartbeat to a duration total.',
    },
    sections: [
      section('What a heartbeat proves', 'inputs', [
        p(
          'A heartbeat is an event from a connected editor. It can include a timestamp, file and project metadata, branch, language, editor and activity counts. It describes observed editor activity; it does not prove that every minute spent planning, reading or talking produced coding time.'
        ),
        bullets([
          'The timestamp places the event on the account timeline.',
          'Metadata lets the same interval be filtered by project, language, branch or editor.',
          'Counts and attribution fields remain separate from the duration calculation.',
        ]),
      ]),
      section('From events to duration blocks', 'blocks', [
        p(
          'AtoAxis canonicalises overlapping evidence first, then orders the remaining intervals. The duration of a block is the union of its intervals, so two sources cannot count the same seconds twice. A single isolated event proves an instant but does not invent a long session after it.'
        ),
        code(
          '09:00 interval ───── 09:05 interval ───── 09:10 interval\n          one continuous duration block',
          'Illustrative timeline'
        ),
      ]),
      section('How idle gaps are handled', 'idle', [
        p(
          'The default human idle timeout is 15 minutes. When two proven intervals are separated by a positive gap no longer than that timeout, the gap is bridged to the earlier interval, matching the WakaTime-compatible session model. A gap longer than the configured timeout closes the block. The timeout is configurable per deployment, so the deployed setting is the source of truth.'
        ),
        bullets([
          'A short gap between two real events can be included in the earlier block.',
          'A gap longer than the timeout starts a new block instead of padding the old one.',
          'Time after the final event is never added just because the session was once active.',
          'Agent activity can use its own timeout when that deployment enables the split timeline.',
        ]),
      ]),
      section('Worked example', 'example', [
        p(
          'Illustrative example, not customer data: suppose an interval ends at 09:00 and the next begins at 09:10. With the default 15-minute timeout, that 10-minute gap is bridged. If the next interval begins at 09:30, the 20-minute gap is too long, so the first block ends and a second block begins. Time after the final interval remains uncounted.'
        ),
        code(
          '09:00 ──(10 min gap)── 09:10    bridged\n09:10 ──(20 min gap)── 09:30    new block',
          'Worked example'
        ),
        p(
          'The arithmetic explains the rule, not a promise about a particular dashboard total. Check the timeline and its interval evidence when a total looks surprising.'
        ),
      ]),
      section('How to read the result', 'interpretation', [
        bullets([
          'Coding time is observed editor activity, not all time spent on a task.',
          'A duration total does not measure code quality, value, focus or productivity.',
          'Use project, language, branch and editor filters to find which evidence produced a total.',
          'Compare the duration with the activity timeline and coverage fields before drawing a conclusion.',
        ]),
      ]),
      section('Verify your first total', 'verify', [
        p(
          'Connect one editor, run wakaclock-cli status, make a small change and wait for the first heartbeat. The dashboard timeline should show the event and the Overview page should use the same duration model. If it does not, check the API key, server URL and local queue before adding another client.'
        ),
        p('Review owner: AtoAxis product team. Last reviewed: 20 September 2026.'),
      ]),
    ],
    related: [
      related([
        {
          href: '/docs/getting-started',
          label: 'Getting started',
          description: 'Connect an editor and verify a first heartbeat',
        },
        {
          href: '/developer-analytics',
          label: 'Developer analytics',
          description: 'See the metrics and filters built on this timeline',
        },
        {
          href: '/privacy',
          label: 'Privacy and data collection',
          description: 'Review the fields a heartbeat can carry',
        },
      ]),
    ],
    faq: faq('Coding time FAQ', [
      {
        question: 'Does AtoAxis count time after my last heartbeat?',
        answer:
          'No. A trailing gap after the final observed event is not added to the duration total.',
      },
      {
        question: 'What is the default idle timeout?',
        answer:
          'The default human timeout is 15 minutes. A deployment can configure it, so check the deployed setting when comparing totals.',
      },
      {
        question: 'Does a heartbeat include my source code?',
        answer:
          'No. Heartbeats carry activity metadata and counts; source code, prompts and responses are outside the payload.',
      },
      {
        question: 'Is coding time a productivity score?',
        answer:
          'No. It is a record of observed editor activity and should be read with its limits and coverage.',
      },
    ]),
  },
  {
    metadataTitle: 'AtoAxis คำนวณเวลาการเขียนโค้ดอย่างไร',
    description:
      'ดูวิธีที่ AtoAxis เปลี่ยน editor heartbeat เป็นช่วงเวลา เชื่อมช่วงว่างสั้น และไม่นับช่วงว่างยาวหรือเวลาหลัง heartbeat สุดท้าย',
    breadcrumbs: [
      { name: 'หน้าหลัก', path: '/' },
      { name: 'เอกสาร', path: '/docs' },
      { name: 'วิธีคำนวณเวลาการเขียนโค้ด', path: '/docs/how-coding-time-is-calculated' },
    ],
    title: 'AtoAxis คำนวณเวลาการเขียนโค้ดอย่างไร',
    lead: 'AtoAxis คำนวณเวลาจาก editor heartbeat หลักฐานที่อยู่ใกล้กันจะรวมเป็นช่วงเวลา ส่วนช่วงว่างยาวหรือหลังเหตุการณ์สุดท้ายจะไม่ถูกเติมเข้าไป',
    howTo: {
      name: 'คำนวณเวลาจาก editor heartbeat',
      description: 'ตามเส้นทางข้อมูลตั้งแต่ heartbeat ไปจนถึงยอดเวลาที่แสดง',
    },
    sections: [
      section('Heartbeat ยืนยันอะไร', 'inputs', [
        p(
          'Heartbeat คือ event จาก editor ที่เชื่อมต่ออยู่ อาจมีเวลา file และ project metadata, branch, language, editor และ activity counts ข้อมูลนี้ยืนยันกิจกรรมที่ editor สังเกตได้ ไม่ได้หมายความว่าเวลาวางแผน อ่าน หรือประชุมทุกนาทีจะกลายเป็น coding time'
        ),
        bullets([
          'เวลาใน event วางกิจกรรมบน timeline ของบัญชี',
          'Metadata ทำให้กรองตาม project, language, branch หรือ editor ได้',
          'Counts และ attribution แยกจากการคำนวณ duration',
        ]),
      ]),
      section('จาก event เป็น duration block', 'blocks', [
        p(
          'AtoAxis รวมหลักฐานที่ทับซ้อนกันก่อน แล้วเรียง interval ที่เหลือ ระยะเวลาของ block คือ union ของ interval จึงไม่นับวินาทีซ้ำจากหลายแหล่ง event เดี่ยวพิสูจน์เพียงจุดเวลา ไม่ได้สร้าง session ยาวต่อท้ายเอง'
        ),
        code(
          '09:00 interval ───── 09:05 interval ───── 09:10 interval\n          เป็น duration block เดียวกัน',
          'Timeline ตัวอย่าง'
        ),
      ]),
      section('จัดการ idle gap อย่างไร', 'idle', [
        p(
          'ค่าเริ่มต้นของ idle timeout สำหรับกิจกรรมจากคนคือ 15 นาที หาก interval ที่พิสูจน์ได้สองช่วงมี gap ไม่เกินค่านี้ ระบบจะเชื่อม gap ให้กับ interval ก่อนหน้า ตาม session model ที่เข้ากันได้กับ WakaTime หาก gap ยาวกว่านั้น block เดิมจะจบและเริ่ม block ใหม่ ค่า timeout ปรับได้ตาม deployment จึงควรยึดค่าของระบบที่ใช้งานจริง'
        ),
        bullets([
          'gap สั้นระหว่าง event จริงอาจถูกรวมใน block ก่อนหน้า',
          'gap ยาวกว่าค่าที่ตั้งจะปิด block เดิม ไม่เติมเวลาให้',
          'หลัง event สุดท้ายจะไม่เติมเวลาเพียงเพราะ session เคย active',
          'กิจกรรมจาก agent อาจใช้ timeout แยก หาก deployment เปิด timeline แบบแยก',
        ]),
      ]),
      section('ตัวอย่างการคำนวณ', 'example', [
        p(
          'ตัวอย่างสมมติ ไม่ใช่ข้อมูลลูกค้า: interval หนึ่งจบเวลา 09:00 และช่วงถัดไปเริ่ม 09:10 เมื่อ timeout เริ่มต้นคือ 15 นาที gap 10 นาทีจึงเชื่อมกัน หากช่วงถัดไปเริ่ม 09:30 gap 20 นาทีจะยาวเกินไป block แรกจึงจบและเริ่ม block ที่สอง เวลาหลัง interval สุดท้ายไม่ถูกนับ'
        ),
        code(
          '09:00 ──(gap 10 นาที)── 09:10    เชื่อมกัน\n09:10 ──(gap 20 นาที)── 09:30    block ใหม่',
          'ตัวอย่าง'
        ),
        p(
          'ตัวเลขนี้อธิบายกติกา ไม่ใช่การรับประกันยอด dashboard ใด ๆ ให้ดู timeline และหลักฐานของ interval เมื่อยอดไม่ตรงกับความคาดหมาย'
        ),
      ]),
      section('อ่านผลลัพธ์อย่างไร', 'interpretation', [
        bullets([
          'Coding time คือกิจกรรมจาก editor ที่สังเกตได้ ไม่ใช่เวลาทั้งหมดของงาน',
          'ยอด duration ไม่ใช่คะแนนคุณภาพ คุณค่า สมาธิ หรือ productivity',
          'ใช้ filter ตาม project, language, branch และ editor เพื่อหา evidence ของยอดนั้น',
          'อ่าน timeline คู่กับ coverage ก่อนสรุปผล',
        ]),
      ]),
      section('ตรวจสอบยอดแรก', 'verify', [
        p(
          'เชื่อม editor หนึ่งตัว รัน wakaclock-cli status แก้ไฟล์เล็กน้อย และรอ heartbeat แรก หน้า timeline ควรเห็น event และหน้า Overview ควรใช้ duration model เดียวกัน หากไม่เห็น ให้ตรวจ API key, server URL และ local queue ก่อนเพิ่ม client ตัวอื่น'
        ),
        p('ผู้ทบทวน: ทีมผลิตภัณฑ์ AtoAxis อัปเดตล่าสุด: 20 กันยายน 2026'),
      ]),
    ],
    related: [
      related([
        {
          href: '/docs/getting-started',
          label: 'เริ่มต้นใช้งาน',
          description: 'เชื่อม editor และยืนยัน heartbeat แรก',
        },
        {
          href: '/developer-analytics',
          label: 'Developer analytics',
          description: 'metric และ filter ที่สร้างจาก timeline นี้',
        },
        {
          href: '/privacy',
          label: 'Privacy และข้อมูลที่เก็บ',
          description: 'field ที่ heartbeat อาจส่ง',
        },
      ]),
    ],
    faq: faq('คำถามเรื่องการคำนวณ coding time', [
      {
        question: 'หลัง heartbeat สุดท้ายระบบนับเวลาต่อหรือไม่?',
        answer: 'ไม่ เวลาหลัง event ที่สังเกตได้สุดท้ายจะไม่ถูกเติมในยอด duration',
      },
      {
        question: 'ค่า idle timeout เริ่มต้นเท่าไร?',
        answer:
          'ค่าเริ่มต้นของกิจกรรมจากคนคือ 15 นาที แต่ deployment ปรับได้ ให้ตรวจค่าของระบบจริง',
      },
      {
        question: 'Heartbeat ส่ง source code หรือไม่?',
        answer:
          'ไม่ ส่ง metadata และ counts ของกิจกรรม ส่วน source code, prompt และ response ไม่อยู่ใน payload',
      },
      {
        question: 'Coding time เป็น productivity score หรือไม่?',
        answer: 'ไม่ เป็นบันทึกกิจกรรมจาก editor ที่สังเกตได้และต้องอ่านคู่กับข้อจำกัดและ coverage',
      },
    ]),
  }
);

dualPage(
  '/docs/ai-attribution-and-coverage',
  {
    metadataTitle: 'AtoAxis AI attribution and coverage',
    description:
      'Understand how AtoAxis separates AI, human and Unattributed line changes and reports the evidence coverage behind each total.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Docs', path: '/docs' },
      { name: 'AI attribution and coverage', path: '/docs/ai-attribution-and-coverage' },
    ],
    title: 'AtoAxis AI attribution and coverage',
    lead: 'AtoAxis keeps AI, human and Unattributed changes separate. Coverage tells you how much of the observed change set has evidence instead of turning uncertainty into a confident zero.',
    sections: [
      section('The three attribution buckets', 'buckets', [
        bullets([
          'AI: a hook or client explicitly marks the activity as AI-assisted and can provide an agent name and line counts.',
          'Human: the editor reports hand-typed keystrokes or characters and the corresponding measured changes.',
          'Unattributed: the system has observed a change but cannot prove which source produced it.',
        ]),
        p(
          'The buckets are mutually exclusive in the canonical totals. Unattributed is evidence that is missing, not a synonym for human work and not a reason to guess.'
        ),
      ]),
      section('Where evidence comes from', 'evidence', [
        p(
          'AI attribution comes from explicit fields supplied by a supported hook or client, such as an agent name, is_ai_generated flag and line counts. Human attribution uses editor activity fields such as keystrokes and characters. A compatible editor can send time without sending every attribution field, so missing fields remain visible.'
        ),
        code(
          '{\n  "is_ai_generated": true,\n  "ai_agent": "your-agent-name",\n  "ai_lines_added": 42,\n  "ai_lines_deleted": 3\n}',
          'Illustrative heartbeat fields'
        ),
      ]),
      section('What coverage means', 'coverage', [
        p(
          'Line coverage is calculated from the same canonical totals: attributed AI and human line changes divided by attributed plus Unattributed line changes. The response also exposes the denominators and an explicit status. With no activity, the percentage is unavailable rather than a misleading 0%.'
        ),
        code(
          'Illustrative change set: 40 AI + 35 human + 25 Unattributed = 100 lines\nAttributed line coverage: (40 + 35) / 100 = 75%',
          'Worked example — not customer data'
        ),
        p(
          'Data coverage is a separate question from the AI share. A result can have a high AI percentage among known lines while still having incomplete evidence for the whole period. Read both the line totals and the coverage status.'
        ),
      ]),
      section('How to compare agents', 'compare', [
        bullets([
          'Compare agents only over the same date range, project filters and evidence status.',
          'Check whether a tool has a bundled hook or a provider-specific adapter before expecting automatic attribution.',
          'Do not treat line counts as correctness, maintainability, time saved or business value.',
          'Keep Unattributed visible when a tool reports activity without attribution metadata.',
        ]),
      ]),
      section('Privacy boundary', 'privacy', [
        p(
          'Attribution carries labels, identifiers and numeric counts. It does not require sending source code, prompts or AI response text. Provider usage can add token metadata, but the text of the transcript remains outside the usage event.'
        ),
      ]),
      section('Review and verification', 'review', [
        p(
          'Use the AI coding tracker page for supported hooks and the dashboard analytics response for the denominators behind a result. Review owner: AtoAxis product team. Last reviewed: 20 September 2026.'
        ),
      ]),
    ],
    related: [
      related([
        {
          href: '/ai-coding-tracker',
          label: 'AI coding activity tracking',
          description: 'Supported hooks and attribution limits',
        },
        {
          href: '/ai-cost-tracking',
          label: 'AI cost and token tracking',
          description: 'Usage fields and estimated cost coverage',
        },
        {
          href: '/privacy',
          label: 'Privacy and data collection',
          description: 'The heartbeat payload boundary',
        },
      ]),
    ],
    faq: faq('AI attribution FAQ', [
      {
        question: 'Does Unattributed mean human?',
        answer:
          'No. Unattributed means the available evidence cannot establish AI or human attribution.',
      },
      {
        question: 'How is line coverage calculated?',
        answer:
          'Attributed AI and human line changes are divided by attributed plus Unattributed line changes from the canonical totals.',
      },
      {
        question: 'Can AtoAxis infer AI activity from line count alone?',
        answer:
          'No. AI attribution requires explicit metadata from a supported hook or client; unsupported evidence stays Unattributed.',
      },
      {
        question: 'Are prompts stored for attribution?',
        answer: 'No. Attribution uses labels, identifiers and counts, not prompt or response text.',
      },
    ]),
  },
  {
    metadataTitle: 'AtoAxis แยก AI attribution และ coverage อย่างไร',
    description:
      'ทำความเข้าใจการแยกการเปลี่ยนแปลงเป็น AI, human และ Unattributed พร้อม coverage ของหลักฐานที่อยู่เบื้องหลังยอดรวม',
    breadcrumbs: [
      { name: 'หน้าหลัก', path: '/' },
      { name: 'เอกสาร', path: '/docs' },
      { name: 'AI attribution และ coverage', path: '/docs/ai-attribution-and-coverage' },
    ],
    title: 'AtoAxis แยก AI attribution และ coverage อย่างไร',
    lead: 'AtoAxis แยกการเปลี่ยนแปลงเป็น AI, human และ Unattributed พร้อมบอก coverage ของหลักฐาน แทนการเปลี่ยนข้อมูลที่ไม่แน่ใจให้เป็นศูนย์อย่างมั่นใจเกินจริง',
    sections: [
      section('สามกลุ่มของ attribution', 'buckets', [
        bullets([
          'AI: hook หรือ client ระบุชัดว่าเป็นงานที่ AI ช่วย และอาจส่งชื่อ agent กับจำนวนบรรทัด',
          'Human: editor รายงาน keystroke หรือ character ที่พิมพ์เองและการเปลี่ยนแปลงที่วัดได้',
          'Unattributed: ระบบเห็นการเปลี่ยนแปลงแต่พิสูจน์ไม่ได้ว่าเกิดจากแหล่งใด',
        ]),
        p(
          'ยอด canonical ทำให้ทั้งสามกลุ่มไม่ทับกัน Unattributed คือหลักฐานที่ขาด ไม่ใช่คำพ้องกับ human และไม่ใช่เหตุผลให้ระบบเดา'
        ),
      ]),
      section('หลักฐานมาจากไหน', 'evidence', [
        p(
          'AI attribution มาจาก field ที่ hook หรือ client ที่รองรับส่งมาโดยตรง เช่น ชื่อ agent, is_ai_generated และ line counts ส่วน human attribution ใช้ข้อมูลกิจกรรมจาก editor เช่น keystroke และ character editor ที่รองรับ protocol อาจส่งเวลาได้โดยไม่ส่ง attribution ครบ field ที่ไม่มีจึงคงเป็นข้อมูลที่ขาด'
        ),
        code(
          '{\n  "is_ai_generated": true,\n  "ai_agent": "your-agent-name",\n  "ai_lines_added": 42,\n  "ai_lines_deleted": 3\n}',
          'field ตัวอย่าง'
        ),
      ]),
      section('Coverage หมายถึงอะไร', 'coverage', [
        p(
          'Line coverage คำนวณจากยอด canonical ชุดเดียวกัน คือ line change ของ AI และ human ที่มีหลักฐาน หารด้วยยอดที่มีหลักฐานรวมกับ Unattributed response ยังแสดง denominator และ status และถ้าไม่มี activity จะไม่สร้างเปอร์เซ็นต์ 0% ปลอม'
        ),
        code(
          'ตัวอย่างสมมติ: AI 40 + human 35 + Unattributed 25 = 100 บรรทัด\nline coverage: (40 + 35) / 100 = 75%',
          'ตัวอย่าง ไม่ใช่ข้อมูลลูกค้า'
        ),
        p(
          'AI share ในบรรทัดที่รู้ กับ coverage ของหลักฐานทั้งช่วงเวลาเป็นคนละเรื่อง จึงควรอ่านทั้งยอดและ status'
        ),
      ]),
      section('เปรียบเทียบ agent อย่างไร', 'compare', [
        bullets([
          'ใช้ช่วงเวลาและ filter project เดียวกันก่อนเทียบ agent',
          'ตรวจว่าเครื่องมือมี bundled hook หรือ adapter เฉพาะ provider ก่อนคาดหวัง attribution อัตโนมัติ',
          'อย่าแปลจำนวนบรรทัดเป็นความถูกต้อง คุณภาพ เวลาที่ประหยัด หรือคุณค่าทางธุรกิจ',
          'เก็บ Unattributed ให้เห็นเมื่อเครื่องมือส่ง activity แต่ไม่มี metadata ของ attribution',
        ]),
      ]),
      section('ขอบเขตความเป็นส่วนตัว', 'privacy', [
        p(
          'Attribution ส่ง label, identifier และจำนวน ไม่ต้องส่ง source code, prompt หรือข้อความตอบของ AI Provider usage อาจเพิ่ม token metadata แต่ไม่ส่งข้อความ transcript'
        ),
      ]),
      section('ทบทวนและตรวจสอบ', 'review', [
        p(
          'ดูหน้าติดตาม AI coding activity สำหรับ hook ที่รองรับ และดู denominator ใน dashboard analytics เมื่อต้องการตรวจยอด ผู้ทบทวน: ทีมผลิตภัณฑ์ AtoAxis อัปเดตล่าสุด: 20 กันยายน 2026'
        ),
      ]),
    ],
    related: [
      related([
        {
          href: '/ai-coding-tracker',
          label: 'ติดตาม AI coding activity',
          description: 'hook ที่รองรับและข้อจำกัดของ attribution',
        },
        {
          href: '/ai-cost-tracking',
          label: 'ติดตาม token และค่าใช้จ่าย AI',
          description: 'field ของ usage และ coverage ของค่าใช้จ่าย',
        },
        {
          href: '/privacy',
          label: 'Privacy และข้อมูลที่เก็บ',
          description: 'ขอบเขตข้อมูลใน heartbeat',
        },
      ]),
    ],
    faq: faq('คำถามเรื่อง AI attribution', [
      {
        question: 'Unattributed แปลว่า human หรือไม่?',
        answer: 'ไม่ หมายถึงหลักฐานที่มีอยู่ยังยืนยันไม่ได้ว่าเป็น AI หรือ human',
      },
      {
        question: 'Line coverage คำนวณอย่างไร?',
        answer:
          'นำ line change ของ AI และ human ที่มีหลักฐานหารด้วยยอดดังกล่าวรวมกับ Unattributed จาก canonical totals',
      },
      {
        question: 'AtoAxis เดา AI จากจำนวนบรรทัดได้หรือไม่?',
        answer:
          'ไม่ได้ ต้องมี metadata จาก hook หรือ client ที่รองรับ หากไม่มีหลักฐานจะเป็น Unattributed',
      },
      {
        question: 'ต้องเก็บ prompt เพื่อทำ attribution หรือไม่?',
        answer: 'ไม่ ใช้ label, identifier และ counts โดยไม่เก็บ prompt หรือ response text',
      },
    ]),
  }
);

dualPage(
  '/docs/ai-cost-methodology',
  {
    metadataTitle: 'AtoAxis AI cost methodology',
    description:
      'See how AtoAxis estimates AI cost from reported token classes, provider and model price windows, and why unknown prices stay unknown.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Docs', path: '/docs' },
      { name: 'AI cost methodology', path: '/docs/ai-cost-methodology' },
    ],
    title: 'AtoAxis AI cost methodology',
    lead: 'AtoAxis estimates usage cost from provider-reported token classes and the price that was effective when the event occurred. Missing prices produce an unknown estimate, not a zero.',
    sections: [
      section('What is recorded', 'usage', [
        p(
          'A usage event contains identifiers, provider and model names, an event time and numeric token counts. Input, output, cache-read and cache-write tokens remain separate because providers can price each class differently.'
        ),
        code(
          '{\n  "provider": "example-provider",\n  "model": "example-model",\n  "input_tokens": 1000000,\n  "output_tokens": 500000,\n  "token_source": "reported"\n}',
          'Illustrative usage event'
        ),
      ]),
      section('How the estimate is calculated', 'formula', [
        p(
          'For every token class that the provider reports, AtoAxis multiplies the count by that class rate per million tokens, divides by 1,000,000 and adds the result in micro-USD. A class that is absent does not block the estimate; a reported class without a known rate makes the event cost unknown so a partial total cannot look complete.'
        ),
        code(
          'Example rates (illustrative only):\ninput 1,000,000 × $3.00 / 1M = $3.00\noutput 500,000 × $15.00 / 1M = $7.50\nestimated total = $10.50 = 10,500,000 micro-USD',
          'Worked arithmetic — not a live price'
        ),
      ]),
      section('Provider, model and effective date', 'price-window', [
        p(
          'The lookup matches both provider and model. It then selects the price window whose effective-from and effective-to dates contain the event timestamp. A later price change therefore does not silently rewrite an older event, and the pricing version can be inspected with the result.'
        ),
        bullets([
          'The same model label at two providers is treated as two different price records.',
          'A provider or model with no matching price remains unpriced.',
          'A cache class with no rate makes cost unknown when that class is present.',
          'Historical events keep the rate effective at their own event time.',
        ]),
      ]),
      section('Why unknown is not zero', 'unknown', [
        p(
          'A zero could mean free usage, missing usage, an unpriced provider or a genuinely zero count. Those cases are not equivalent. AtoAxis reports token usage when it has it and leaves estimated cost unavailable when the price evidence is incomplete, with coverage explaining how much of the range is priced.'
        ),
      ]),
      section('Project totals and limitations', 'limits', [
        bullets([
          'Usage is grouped by project when the session provides an unambiguous project context.',
          'A session that spans several projects stays Unattributed instead of being copied into every project.',
          'An estimate is not an invoice: negotiated rates, subscriptions and provider-side adjustments may be outside the visible data.',
          'Prompt and response text are not required and are not stored in the usage event.',
        ]),
      ]),
      section('Review and verification', 'review', [
        p(
          'Use the AI cost tracking page for supported agents, then compare the dashboard token total, priced-token coverage and pricing version for the same range. Review owner: AtoAxis product team. Last reviewed: 20 September 2026.'
        ),
      ]),
    ],
    related: [
      related([
        {
          href: '/ai-cost-tracking',
          label: 'AI cost and token tracking',
          description: 'Supported agents and project breakdowns',
        },
        {
          href: '/docs/ai-attribution-and-coverage',
          label: 'AI attribution and coverage',
          description: 'Interpret AI, human and Unattributed changes',
        },
        {
          href: '/pricing',
          label: 'Planned AtoAxis pricing',
          description: 'Hosted product pricing and Early Access status',
        },
      ]),
    ],
    faq: faq('AI cost methodology FAQ', [
      {
        question: 'Does the estimate equal my provider invoice?',
        answer:
          'No. It is based on reported usage and visible price rows; negotiated rates, subscriptions and provider adjustments may not be available.',
      },
      {
        question: 'What happens when a model price is unknown?',
        answer:
          'Token usage can remain visible, but the estimated cost is unavailable rather than reported as zero.',
      },
      {
        question: 'Why do cache tokens have their own fields?',
        answer:
          'Providers can price cache reads and writes differently from input and output, so combining them would hide the calculation.',
      },
      {
        question: 'Does AtoAxis store prompts to calculate cost?',
        answer:
          'No. The usage event needs numeric token counts and identifiers, not prompt or response text.',
      },
    ]),
  },
  {
    metadataTitle: 'วิธีคำนวณค่าใช้จ่าย AI ของ AtoAxis',
    description:
      'ดูวิธีที่ AtoAxis ประมาณค่าใช้จ่ายจาก token ที่ provider รายงานและราคาตามช่วงเวลา พร้อมเหตุผลที่ราคาที่ไม่รู้จะไม่กลายเป็นศูนย์',
    breadcrumbs: [
      { name: 'หน้าหลัก', path: '/' },
      { name: 'เอกสาร', path: '/docs' },
      { name: 'วิธีคำนวณค่าใช้จ่าย AI', path: '/docs/ai-cost-methodology' },
    ],
    title: 'วิธีคำนวณค่าใช้จ่าย AI ของ AtoAxis',
    lead: 'AtoAxis ประมาณค่าใช้จ่ายจาก token ที่ provider รายงานและราคาที่มีผลในเวลาที่ event เกิด หากหลักฐานราคาไม่ครบ ระบบจะรายงานว่าไม่ทราบ ไม่ใช่ศูนย์',
    sections: [
      section('ข้อมูลที่บันทึก', 'usage', [
        p(
          'Usage event มี identifier, ชื่อ provider และ model, เวลา event และจำนวน token แยก input, output, cache-read และ cache-write เพราะ provider อาจตั้งราคาแต่ละประเภทไม่เท่ากัน'
        ),
        code(
          '{\n  "provider": "example-provider",\n  "model": "example-model",\n  "input_tokens": 1000000,\n  "output_tokens": 500000,\n  "token_source": "reported"\n}',
          'usage event ตัวอย่าง'
        ),
      ]),
      section('สูตรประมาณค่าใช้จ่าย', 'formula', [
        p(
          'ทุก token class ที่ provider รายงานจะคูณกับ rate ต่อหนึ่งล้าน token หารด้วย 1,000,000 แล้วรวมเป็นหน่วย micro-USD class ที่ไม่มีการรายงานจะไม่ขัดขวางการคำนวณ แต่ถ้ามี class ที่รายงานแล้วไม่มี rate ระบบจะทำให้ cost ของ event นั้นเป็นไม่ทราบ เพื่อไม่ให้ยอดบางส่วนดูเหมือนครบ'
        ),
        code(
          'ตัวอย่างราคา (สมมติ ไม่ใช่ราคาปัจจุบัน):\ninput 1,000,000 × $3.00 / 1M = $3.00\noutput 500,000 × $15.00 / 1M = $7.50\nยอดประมาณ = $10.50 = 10,500,000 micro-USD',
          'ตัวอย่างการคำนวณ'
        ),
      ]),
      section('Provider, model และวันที่มีผล', 'price-window', [
        p(
          'ระบบจับคู่ทั้ง provider และ model แล้วเลือก price window ที่ effective-from และ effective-to ครอบคลุมเวลา event การเปลี่ยนราคาในภายหลังจึงไม่เขียนทับ event เก่า และผลลัพธ์ตรวจ pricing version ได้'
        ),
        bullets([
          'model ชื่อเหมือนกันแต่คนละ provider ถือเป็นราคาอีกชุดหนึ่ง',
          'provider หรือ model ที่ไม่มีราคา matching จะยังเป็น unpriced',
          'ถ้า cache class มีข้อมูลแต่ไม่มี rate cost จะเป็นไม่ทราบ',
          'event เก่าใช้ราคาที่มีผลในเวลาเกิด event นั้น',
        ]),
      ]),
      section('ทำไมไม่ทราบจึงไม่ใช่ศูนย์', 'unknown', [
        p(
          'เลขศูนย์อาจหมายถึงใช้ฟรี ไม่มีข้อมูล provider ไม่มีราคา หรือจำนวนเป็นศูนย์ ซึ่งไม่ใช่ความหมายเดียวกัน AtoAxis จึงแสดง token เมื่อมีข้อมูลและเว้น estimated cost เมื่อหลักฐานราคาไม่ครบ พร้อม coverage ว่าช่วงใดคิดราคาได้'
        ),
      ]),
      section('ยอดต่อโปรเจกต์และข้อจำกัด', 'limits', [
        bullets([
          'ระบบจัด usage ตาม project เมื่อ session ให้บริบทที่ชัดเจน',
          'session ที่แตะหลาย project จะคงเป็น Unattributed แทนการคัดลอกไปทุก project',
          'ยอดประมาณไม่ใช่ใบแจ้งหนี้ ราคา negotiated, subscription และการปรับฝั่ง provider อาจอยู่นอกข้อมูล',
          'ไม่ต้องและไม่เก็บ prompt หรือ response text เพื่อคำนวณ',
        ]),
      ]),
      section('ทบทวนและตรวจสอบ', 'review', [
        p(
          'ดูหน้าติดตามค่าใช้จ่าย AI สำหรับ agent ที่รองรับ แล้วเทียบ token total, priced-token coverage และ pricing version ในช่วงเวลาเดียวกัน ผู้ทบทวน: ทีมผลิตภัณฑ์ AtoAxis อัปเดตล่าสุด: 20 กันยายน 2026'
        ),
      ]),
    ],
    related: [
      related([
        {
          href: '/ai-cost-tracking',
          label: 'ติดตาม token และค่าใช้จ่าย AI',
          description: 'agent ที่รองรับและยอดแยกตาม project',
        },
        {
          href: '/docs/ai-attribution-and-coverage',
          label: 'AI attribution และ coverage',
          description: 'อ่าน AI, human และ Unattributed',
        },
        {
          href: '/pricing',
          label: 'ราคา AtoAxis ที่วางแผนไว้',
          description: 'สถานะ hosted product และ Early Access',
        },
      ]),
    ],
    faq: faq('คำถามเรื่องวิธีคำนวณค่าใช้จ่าย AI', [
      {
        question: 'ยอดประมาณตรงกับใบแจ้งหนี้ provider หรือไม่?',
        answer:
          'ไม่ คำนวณจาก usage ที่รายงานและ price row ที่มองเห็น ราคา negotiated, subscription และการปรับฝั่ง provider อาจไม่มีในข้อมูล',
      },
      {
        question: 'ถ้าไม่รู้ราคา model จะเกิดอะไรขึ้น?',
        answer: 'ยังแสดง token ได้ แต่ estimated cost จะเป็นไม่ทราบ ไม่รายงานเป็นศูนย์',
      },
      {
        question: 'ทำไม cache token ต้องแยก field?',
        answer:
          'เพราะ provider อาจตั้งราคา cache read และ cache write ต่างจาก input และ output การรวมทันทีจะซ่อนที่มาของสูตร',
      },
      {
        question: 'ต้องเก็บ prompt เพื่อคำนวณหรือไม่?',
        answer: 'ไม่ ใช้จำนวน token และ identifier โดยไม่เก็บ prompt หรือ response text',
      },
    ]),
  }
);

export const PAGE_COPY = simplePages as Record<MarketingPageKey, Localized<MarketingPageCopy>>;
