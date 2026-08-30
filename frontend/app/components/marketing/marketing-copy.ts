/* eslint-disable sonarjs/cognitive-complexity, sonarjs/no-all-duplicated-branches, sonarjs/no-duplicate-string, sonarjs/no-nested-conditional */

import type { FaqEntry } from '@/lib/seo/schema';
import { PRICING, SITE_NAME, type SiteLocale } from '@/lib/seo/site';

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
  badge: 'Complete history, and it works with the WakaTime API',
  title: 'Developer time tracking\nwith your full history.',
  tagline: 'One timeline for everything you do.',
  description: `${SITE_NAME} records coding time across projects, languages, branches and editors. It implements the WakaTime API, so an existing plugin can point at it and every account keeps complete coding history.`,
  whatIs: `${SITE_NAME} is a developer time tracking service. It receives editor heartbeats and turns them into dashboards for coding time, projects, programming languages, branches and editors without storing source code or conversation content.`,
  howItWorks:
    'An editor sends a heartbeat when you type, switch to or save a file. Each event carries metadata such as file path, project, branch, language, editor and operating system. Consecutive events become duration blocks; idle gaps are not counted.',
  useCases: [
    'See coding hours today, this week or across a custom range',
    'Break time down by project, language, editor and branch',
    'Filter to one project or language and drill a timeline, heatmap and file list from a link',
    'Compare AI-attributed lines with human keystrokes and characters',
    'Set a daily or weekly coding-time goal and track it against the same timeline',
    'Group several checkouts with project rules and merges',
    'Import a WakaTime export into the same dashboard',
  ],
  limitationsIntro: `What ${SITE_NAME} does not do today, stated plainly:`,
  limitations: [
    'Only the VS Code plugin is first-party; other editors use the WakaTime protocol',
    'AI hooks cover Claude Code, Codex CLI and Gemini CLI; Cursor/Copilot need adapters',
    'Tokens and costs require provider usage plus a known price; unavailable coverage is not shown as zero',
    'Nothing outside a connected editor or the AI transcript agent is captured; there is no desktop or browser client',
    'Analytics are single-account; goals, leaderboards and a presence prototype are available where the server runs PostgreSQL, but full team and organisation dashboards remain in development',
    'The planned hosted product has no free tier',
  ],
  faq: [
    {
      question: `What is ${SITE_NAME}?`,
      answer: `${SITE_NAME} turns editor heartbeats into coding-time, project, language, branch and editor analytics while keeping source code and conversation content out of the heartbeat.`,
    },
    {
      question: `How does ${SITE_NAME} track coding activity?`,
      answer:
        'The editor sends metadata heartbeats and the server groups close events into duration blocks for daily and weekly totals.',
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
        'The API accepts AI attribution and bundled hooks support Claude Code, Codex CLI and Gemini CLI. Cursor and Copilot need adapters.',
    },
    {
      question: `How is ${SITE_NAME} different from WakaTime?`,
      answer:
        'Two things WakaTime does not do: every account keeps its complete coding history instead of a recent window, and line changes are split three ways — AI, human and Unattributed — with coverage reported as a percentage rather than guessed. AI work is also attributed to a named agent, provider and model, with estimated token cost per project.',
    },
    {
      question: `Can ${SITE_NAME} track time spent by AI agents like Claude Code?`,
      answer:
        "Yes. Bundled hooks for Claude Code, Codex CLI and Gemini CLI attribute their edits, and a local agent reads those tools' on-device transcripts so work done with no editor open is still counted. Changes that cannot be proven either way stay Unattributed rather than being assigned to you.",
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
  title: 'ติดตามเวลาการเขียนโค้ด\nพร้อมประวัติของคุณครบถ้วน',
  tagline: 'ไทม์ไลน์เดียวสำหรับทุกสิ่งที่คุณทำ',
  description: `${SITE_NAME} คือเครื่องมือติดตามเวลาการเขียนโค้ด (โปรแกรมจับเวลา coding) สำหรับนักพัฒนา บันทึกเวลาแยกตามโปรเจกต์ ภาษา branch และ editor รองรับ WakaTime API เพื่อเชื่อม plugin เดิม และเก็บประวัติการเขียนโค้ดของบัญชีไว้อย่างครบถ้วน`,
  whatIs: `${SITE_NAME} คือเครื่องมือและบริการติดตามเวลาการเขียนโค้ด (โปรแกรมนับเวลาเขียนโค้ด) สำหรับนักพัฒนา รับ editor heartbeat แล้วเปลี่ยนเป็น dashboard ของเวลา โปรเจกต์ ภาษา branch และ editor โดยไม่เก็บ source code หรือเนื้อหาการสนทนา`,
  howItWorks:
    'editor จะส่ง heartbeat เมื่อพิมพ์ เปลี่ยนไฟล์ หรือ save โดยมีเฉพาะ metadata เช่น file path, project, branch, language, editor และระบบปฏิบัติการ ระบบรวม heartbeat ที่เกิดใกล้กันเป็น duration block และไม่นับ idle gap',
  useCases: [
    'ดูเวลาการเขียนโค้ดวันนี้ สัปดาห์นี้ หรือช่วงวันที่กำหนดเอง',
    'แยกเวลาตามโปรเจกต์ ภาษา editor และ branch',
    'กรองเฉพาะโปรเจกต์หรือภาษาเดียว แล้ว drill timeline, heatmap และรายชื่อไฟล์จากลิงก์เดียว',
    'เปรียบเทียบ AI-attributed lines กับ human keystrokes และ characters',
    'ตั้งเป้าเวลาเขียนโค้ดรายวันหรือรายสัปดาห์ แล้ววัดเทียบกับ timeline เดียวกัน',
    'รวมหลาย checkout เป็นโปรเจกต์เดียวด้วย project rules และ merge',
    'นำเข้า WakaTime export เพื่อดู history เดิมใน dashboard เดียวกัน',
  ],
  limitationsIntro: `สิ่งที่ ${SITE_NAME} ยังไม่ทำในวันนี้:`,
  limitations: [
    'มี first-party plugin สำหรับ VS Code เท่านั้น editor อื่นเชื่อมต่อผ่าน WakaTime protocol',
    'AI hooks รองรับ Claude Code, Codex CLI และ Gemini CLI ส่วน Cursor/Copilot ต้องมี adapter',
    'token และ cost แสดงเฉพาะเมื่อมี provider usage และราคาที่ตรวจสอบได้ ข้อมูลที่ไม่ครบจะแสดงว่าไม่พร้อมใช้งาน',
    'ไม่มีการเก็บกิจกรรมนอก editor ที่เชื่อมต่อหรือนอก AI transcript agent และยังไม่มี desktop หรือ browser client',
    'analytics อยู่ในขอบเขตบัญชีเดียว goals, leaderboards และ presence prototype ใช้ได้เมื่อ server รัน PostgreSQL แต่ team และ organisation dashboard เต็มรูปแบบยังอยู่ระหว่างพัฒนา',
    'แผน hosted ที่วางไว้ยังไม่มี free tier',
  ],
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
        'API รองรับ AI attribution และมี hook ของ Claude Code, Codex CLI และ Gemini CLI ส่วน Cursor/Copilot ต้องมี adapter',
    },
    {
      question: `${SITE_NAME} ต่างจาก WakaTime อย่างไร?`,
      answer:
        'สองอย่างที่ WakaTime ไม่มี: ทุกบัญชีเก็บประวัติการเขียนโค้ดครบถ้วนแทนที่จะเห็นแค่ช่วงล่าสุด และการเปลี่ยนแปลงบรรทัดถูกแยกเป็นสามกลุ่ม — AI, human และ Unattributed — พร้อมรายงาน coverage เป็นเปอร์เซ็นต์แทนการเดา อีกทั้งระบุงาน AI ตามชื่อ agent, provider และ model และประเมินต้นทุน token ต่อโปรเจกต์',
    },
    {
      question: `${SITE_NAME} ติดตามเวลาที่ AI agent อย่าง Claude Code เขียนโค้ดได้ไหม?`,
      answer:
        'ได้ มี hook สำหรับ Claude Code, Codex CLI และ Gemini CLI ที่ระบุที่มาของการแก้ไข และมี agent ประจำเครื่องอ่าน transcript ในเครื่องของเครื่องมือเหล่านั้น งานที่ทำตอนไม่ได้เปิด editor จึงยังถูกนับ ส่วนการเปลี่ยนแปลงที่พิสูจน์ไม่ได้จะคงเป็น Unattributed ไม่ถูกนับเป็นของคุณ',
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
    metadataTitle: 'Team Coding Presence in Early Access',
    description:
      'AtoAxis coding presence is an Early Access prototype: live rooms and recorded co-working sessions from editor activity, with assigned team and organisation seats still to come.',
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
    title: 'Developer analytics',
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
    metadataTitle: 'Developer Analytics และ Coding Metrics',
    description:
      'ดู analytics ของเวลา โปรเจกต์ ภาษา branch keystrokes และ AI attribution พร้อมวิธีคำนวณที่อธิบายได้',
    breadcrumbs: [
      { name: 'หน้าหลัก', path: '/' },
      { name: 'Developer analytics', path: '/developer-analytics' },
    ],
    title: 'Developer analytics',
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
    title: 'A WakaTime alternative with your full history',
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
      'AtoAxis เป็นทางเลือก WakaTime ที่รองรับ API มีประวัติครบถ้วน และอธิบายขอบเขต AI อย่างตรงไปตรงมา',
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
          'Bundled hooks cover Claude Code, Codex CLI and Gemini CLI. Cursor and Copilot need provider-specific adapters.'
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
        question: `Does ${SITE_NAME} support Claude Code, Codex and Gemini?`,
        answer: 'Bundled hooks support all three; Cursor and Copilot require adapters.',
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
      'ดูวิธีบันทึก AI-assisted coding ด้วยชื่อ agent และ line counts โดยไม่เก็บ prompt, response หรือ source code',
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
          'bundled hooks รองรับ Claude Code, Codex CLI และ Gemini CLI ส่วน Cursor/Copilot ต้องมี adapter ของ provider'
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
        question: 'รองรับ Claude Code, Codex และ Gemini หรือไม่?',
        answer: 'มี bundled hooks สำหรับทั้งสามรายการ ส่วน Cursor/Copilot ต้องมี adapter',
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
    metadataTitle: 'Editor Integrations',
    description:
      'Connect VS Code with the AtoAxis extension or use a WakaTime-compatible plugin with the hosted API.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Integrations', path: '/integrations' },
    ],
    title: 'Editor integrations',
    lead: 'Connect the editor you already use. VS Code has a first-party extension; other editors can use their WakaTime-compatible plugin and point its api_url at the hosted API.',
    sections: [
      section('First-party integrations', 'first-party', [
        sub('VS Code'),
        p(
          'The AtoAxis extension buffers editor metadata, sends heartbeats through wakaclock-cli and shows today’s coding time in the status bar.'
        ),
        sub('AI hooks'),
        p(
          'The setup flow can configure Claude Code, Codex CLI and Gemini CLI hooks without sending prompt or response content.'
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
  },
  {
    metadataTitle: 'Editor Integrations',
    description:
      'เชื่อม VS Code ด้วย AtoAxis extension หรือใช้ WakaTime-compatible plugin กับ hosted API',
    breadcrumbs: [
      { name: 'หน้าหลัก', path: '/' },
      { name: 'Integrations', path: '/integrations' },
    ],
    title: 'Editor integrations',
    lead: 'เชื่อมต่อ editor ที่คุณใช้อยู่ได้เลย VS Code มี first-party extension ส่วน editor อื่นใช้ WakaTime-compatible plugin แล้วเปลี่ยน api_url ให้ชี้ไป hosted API',
    sections: [
      section('การเชื่อมต่อที่เราดูแลเอง', 'first-party', [
        sub('VS Code'),
        p(
          'AtoAxis extension buffer metadata จาก editor ส่ง heartbeat ผ่าน wakaclock-cli และแสดง coding time วันนี้ใน status bar'
        ),
        sub('AI hooks'),
        p(
          'ขั้นตอนตั้งค่าสามารถติดตั้ง hook ของ Claude Code, Codex CLI และ Gemini CLI โดยไม่ส่ง prompt หรือ response'
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
  }
);

// The remaining pages use the same strongly typed section model. Keeping their copy here,
// rather than in route files, prevents the Thai pages from silently becoming short adapters.
const generic = (
  path: MarketingPageKey,
  en: {
    description: string;
    faqCount?: number;
    form?: MarketingPageCopy['form'];
    headings: string[];
    lead: string;
    title: string;
  },
  th: {
    description: string;
    faqCount?: number;
    form?: MarketingPageCopy['form'];
    headings: string[];
    lead: string;
    title: string;
  }
) => {
  const make = (value: typeof en, locale: SiteLocale): MarketingPageCopy => ({
    metadataTitle: value.title,
    description: value.description,
    breadcrumbs: [
      { name: locale === 'en' ? 'Home' : 'หน้าหลัก', path: '/' },
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
      path === '/docs/getting-started'
        ? { name: value.title, description: value.description }
        : undefined,
    component: path === '/pricing' ? { kind: 'pricing', afterSectionId: null } : undefined,
    schema: path === '/about' ? 'organization' : undefined,
    related: genericRelated(path, locale),
    faq: value.faqCount
      ? faq(
          locale === 'en' ? 'Frequently asked questions' : 'คำถามที่พบบ่อย',
          Array.from({ length: value.faqCount }, (_, index) => ({
            question:
              locale === 'en'
                ? `${headingLabel(value.headings, index)}: common question`
                : `${headingLabel(value.headings, index)}: คำถามที่พบบ่อย`,
            answer:
              locale === 'en'
                ? 'See the section above for the current product behavior and data limits.'
                : 'ดูรายละเอียดในส่วนด้านบนสำหรับพฤติกรรมและขอบเขตข้อมูลปัจจุบัน',
          }))
        )
      : undefined,
  });
  simplePages[path] = local(make(en, 'en'), make(th, 'th'));
};
const headingLabel = (headings: string[], index: number) => headings[index % headings.length];
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
              'VS Code integration: what the extension sends, its settings and its limits',
              'AI coding tracker: how Claude Code, Codex CLI and Gemini CLI activity is attributed',
              'Privacy: the exact heartbeat fields, and the fields that do not exist',
            ]
          : [
              'เริ่มต้นใช้งาน: สิ่งที่ต้องเตรียม, API key, การตั้งค่า editor และการตรวจสอบ',
              'VS Code integration: extension ส่งอะไร มี settings อะไร และมีข้อจำกัดอะไร',
              'AI coding tracker: วิธี attribute งานจาก Claude Code, Codex CLI และ Gemini CLI',
              'Privacy: field ใน heartbeat ทั้งหมด และ field ที่ไม่มีอยู่จริง',
            ]
      ),
    ],
  ],

  [
    '/integrations/vscode#2',
    (en) => [
      code(
        'Extensions: install "AtoAxis — Developer Time Tracking"\nCommand Palette: Wakaclock: Set API Key\nCommand Palette: Wakaclock: Configure CLI Path   # only if the binary is not on PATH',
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
        'Extensions: install "AtoAxis — Developer Time Tracking"\nCommand Palette: Wakaclock: Set API Key\nCommand Palette: Wakaclock: Configure CLI Path   # only if the binary is not on PATH',
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
              'Wakaclock: Send Heartbeat Now flushes buffered activity immediately instead of waiting for the 120-second same-file cadence',
              'The dashboard Overview page shows the total once the first heartbeat has landed',
            ]
          : [
              'status bar ของ VS Code แสดงยอดเดียวกันและรีเฟรชทุก 15 วินาที',
              'คำสั่ง Wakaclock: Send Heartbeat Now จะ flush activity ที่ค้างอยู่ทันที ไม่ต้องรอรอบ 120 วินาทีของไฟล์เดิม',
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
              'No total in the status bar: the CLI cannot be found. Run Wakaclock: Configure CLI Path, or set wakaclock.cliPath to the absolute path of the binary',
              'Reading code is not counted: only edits, saves and file switches produce heartbeats, and gaps at or beyond the idle timeout are excluded on purpose',
              'The total stopped rising: run wakaclock-cli status. Undelivered heartbeats sit in ~/.wakaclock/queue.db and are resent once the server is reachable again',
              'One project counted twice: two checkouts of the same repository are two project names until you merge them under Settings, with project rules or a manual merge',
              'AI work missing: run AtoAxis: Show AI Tracking Status, then AtoAxis: Set Up AI Tracking to register hooks for Claude Code, Codex CLI or Gemini CLI. Cursor and Copilot have no adapter yet',
            ]
          : [
              'status bar ไม่ขึ้นยอดเวลา แปลว่าหา CLI ไม่เจอ ให้รัน Wakaclock: Configure CLI Path หรือกำหนด wakaclock.cliPath เป็น path เต็มของ binary',
              'อ่านโค้ดเฉย ๆ ไม่ถูกนับ เพราะ heartbeat เกิดจากการแก้ไข การ save และการสลับไฟล์เท่านั้น ช่วงที่ไม่มีกิจกรรมถึงเกณฑ์ idle จะไม่ถูกนับโดยตั้งใจ',
              'ยอดหยุดเพิ่ม ให้รัน wakaclock-cli status heartbeat ที่ยังส่งไม่สำเร็จจะค้างอยู่ใน ~/.wakaclock/queue.db และถูกส่งใหม่เมื่อกลับมาต่อ server ได้',
              'โปรเจกต์เดียวถูกนับสองชื่อ เกิดจาก checkout สองที่ของ repository เดียวกัน ให้รวมเข้าด้วยกันที่หน้า Settings ผ่าน project rules หรือการ merge เอง',
              'ไม่เห็นงานฝั่ง AI ให้รัน AtoAxis: Show AI Tracking Status แล้วรัน AtoAxis: Set Up AI Tracking เพื่อติดตั้ง hook ของ Claude Code, Codex CLI หรือ Gemini CLI ส่วน Cursor และ Copilot ยังไม่มี adapter',
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
              'Working: AI attribution with hooks for Claude Code, Codex CLI and Gemini CLI',
              'Working: a first-party VS Code extension, and WakaTime-protocol compatibility for other editors',
              'Working where the server runs PostgreSQL: goals, leaderboards, and a presence prototype with recorded co-working sessions',
              'Not yet: billing and checkout, assigned team and organisation seats, adapters for Cursor and Copilot',
            ]
          : [
              'ใช้งานได้แล้ว: การรับ heartbeat, duration block และ analytics ของ project, language, editor และ branch',
              'ใช้งานได้แล้ว: AI attribution พร้อม hook สำหรับ Claude Code, Codex CLI และ Gemini CLI',
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
              'An API key, stored through Wakaclock: Set API Key rather than in settings.json',
            ]
          : [
              'VS Code 1.90 ขึ้นไป',
              'มี wakaclock-cli ใน PATH หรือกำหนด path เต็มไว้ที่ wakaclock.cliPath',
              'API key ที่บันทึกผ่านคำสั่ง Wakaclock: Set API Key ไม่ใช่เก็บใน settings.json',
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
              'AI hooks cover Claude Code, Codex CLI and Gemini CLI; Cursor and Copilot need provider-specific adapters',
              'The extension requires wakaclock-cli and does not talk to the server directly',
            ]
          : [
              'ส่งเฉพาะกิจกรรมกับไฟล์ ไม่มี heartbeat ประเภท app, domain หรือ url',
              'AI hook ครอบคลุม Claude Code, Codex CLI และ Gemini CLI ส่วน Cursor และ Copilot ต้องมี adapter เฉพาะของผู้ให้บริการ',
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
    '/docs': [
      {
        href: '/docs/getting-started',
        label: en ? 'Getting started' : 'เริ่มต้นใช้งาน',
        description: en ? 'Connect an editor' : 'เชื่อม editor',
      },
    ],
    '/docs/getting-started': [
      {
        href: '/integrations/vscode',
        label: en ? 'VS Code integration' : 'VS Code integration',
        description: en ? 'Extension settings' : 'settings ของ extension',
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
    faqCount: 6,
  },
  {
    title: 'VS Code time tracking extension',
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
    faqCount: 6,
  }
);
generic(
  '/pricing',
  {
    title: 'Pricing',
    description: `Planned pricing: $${PRICING.monthlyUsd}/month or $${PRICING.annualUsd}/year.`,
    lead: 'Checkout is not open during Early Access and nothing is charged now.',
    headings: ['What the plan covers', 'Billing and availability'],
    faqCount: 6,
  },
  {
    title: 'ราคา',
    description: `ราคาแผนที่วางไว้ $${PRICING.monthlyUsd}/เดือน หรือ $${PRICING.annualUsd}/ปี`,
    lead: 'ช่วง Early Access ยังไม่เปิด checkout และยังไม่มีการเรียกเก็บเงิน',
    headings: ['สิ่งที่รวมในแผน', 'การเรียกเก็บเงินและสถานะ'],
    faqCount: 6,
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
    faqCount: 7,
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
    faqCount: 7,
  }
);
generic(
  '/docs',
  {
    title: 'AtoAxis documentation',
    description: 'Documentation for setup, editor integration and heartbeat privacy.',
    lead: 'Connect an editor and understand the hosted product through these guides.',
    headings: ['Start here'],
  },
  {
    title: 'เอกสาร AtoAxis',
    description: 'เอกสาร setup, editor integration และ heartbeat privacy',
    lead: 'เชื่อม editor และทำความเข้าใจ hosted product ผ่านคู่มือนี้',
    headings: ['เริ่มต้นที่นี่'],
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
    faqCount: 6,
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
    faqCount: 6,
  }
);
generic(
  '/about',
  {
    title: `About ${SITE_NAME}`,
    description: `Learn why ${SITE_NAME} exists and who publishes it.`,
    lead: `${SITE_NAME} (spelled A-t-o-A-x-i-s) is a developer time-tracking product published by StandUpCode / Lodash (Thailand) Co., Ltd. It is not affiliated with similarly named products such as ATOSS, Atto or Axis ERP.`,
    headings: ['Why we are building it', 'Current status', 'Publisher'],
  },
  {
    title: `เกี่ยวกับ ${SITE_NAME}`,
    description: `รู้จักเหตุผลและผู้เผยแพร่ ${SITE_NAME}`,
    lead: `${SITE_NAME} (สะกด A-t-o-A-x-i-s) เป็นผลิตภัณฑ์ติดตามเวลาการเขียนโค้ดสำหรับนักพัฒนา เผยแพร่โดย StandUpCode / Lodash (Thailand) Co., Ltd. ไม่มีความเกี่ยวข้องกับผลิตภัณฑ์ชื่อคล้ายกันอย่าง ATOSS, Atto หรือ Axis ERP`,
    headings: ['เหตุผลที่สร้าง', 'สถานะปัจจุบัน', 'ผู้เผยแพร่'],
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
  },
  {
    title: 'ติดต่อ AtoAxis',
    description: 'ติดต่อ AtoAxis เรื่อง Early Access integrations และ privacy',
    lead: 'สอบถามเรื่อง Early Access, hosted analytics, integrations หรือ privacy',
    headings: ['หัวข้อที่สอบถามได้'],
    form: 'contact',
  }
);
generic(
  '/terms',
  {
    title: `${SITE_NAME} terms`,
    description: 'Early Access, hosted service and acceptable-use terms.',
    lead: `These preliminary terms describe the ${SITE_NAME} Early Access website.`,
    headings: ['Early Access', 'Hosted service and data', 'Acceptable use', 'Questions'],
  },
  {
    title: `ข้อกำหนด ${SITE_NAME}`,
    description: 'ข้อกำหนด Early Access hosted service และ acceptable use',
    lead: `ข้อกำหนดเบื้องต้นนี้อธิบายเว็บไซต์ ${SITE_NAME} ในช่วง Early Access`,
    headings: ['Early Access', 'Hosted service และข้อมูล', 'การใช้งานที่ยอมรับได้', 'คำถาม'],
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
  },
  {
    title: 'เข้าร่วม AtoAxis Early Access',
    description: 'ลงทะเบียน AtoAxis Early Access',
    lead: 'ลงทะเบียนความสนใจใน hosted developer time tracking และข่าวการเปิดตัว',
    headings: [],
    form: 'early-access',
  }
);

dualPage(
  '/ai-cost-tracking',
  {
    metadataTitle: 'AI Coding Cost and Token Usage Tracking',
    description:
      'Track Claude Code, Codex CLI and Gemini CLI token usage and estimated cost per project. Prices are versioned and effective-dated, and an unknown price stays unknown instead of being reported as zero.',
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
          'Claude Code, Codex CLI and Gemini CLI have bundled hooks that read their local transcripts',
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
          'Claude Code, Codex CLI and Gemini CLI have bundled hooks. Any other tool can post to the same endpoint. Cursor and Copilot need a provider-specific adapter first.',
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
      'ติดตาม token และค่าใช้จ่ายโดยประมาณของ Claude Code, Codex CLI และ Gemini CLI แยกตามโปรเจกต์ ราคามีเวอร์ชันและช่วงเวลาที่มีผล สิ่งที่คำนวณไม่ได้จะแสดงว่าไม่ทราบ ไม่ใช่ศูนย์',
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
          'Claude Code, Codex CLI และ Gemini CLI มี bundled hook อ่าน transcript ในเครื่อง',
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
          'Claude Code, Codex CLI และ Gemini CLI มี bundled hook เครื่องมืออื่นส่งเข้า endpoint เดียวกันได้ ส่วน Cursor และ Copilot ต้องมี adapter ก่อน',
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

export const PAGE_COPY = simplePages as Record<MarketingPageKey, Localized<MarketingPageCopy>>;
