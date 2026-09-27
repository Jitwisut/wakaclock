import { SITE_NAME, type SiteLocale } from '@/lib/seo/site';

import { EN_HOME, TH_HOME } from '../marketing-copy';

/**
 * Copy for the six-chapter cinematic homepage experience.
 *
 * Every capability sentence here restates a claim that already ships elsewhere on the site
 * (marketing-copy.ts, the feature list, the docs). This file adds narrative framing, not
 * product claims. Numbers that appear in the experience come from `experience-data.ts` and
 * are always rendered next to a "demo data" label.
 *
 * The Thai object is typed against the English one, so a chapter added in one language
 * and forgotten in the other fails the typecheck instead of shipping half-translated.
 */

export type AttributionKind = 'ai' | 'all' | 'human' | 'unattributed';
export type ProductView = 'human-ai' | 'overview' | 'projects' | 'timeline';

const EN = {
  rail: {
    label: 'Story chapters',
    chapters: [
      'The invisible',
      'Every second',
      'Human + AI',
      'Understanding',
      'The product',
      'Begin',
    ],
  },
  loader: {
    label: 'Preparing the 3D scene',
    steps: ['Scene module', 'Activity geometry', 'First frame'],
    ready: '3D scene ready',
    skipped: 'Showing the still version of the scene',
  },
  demoBadge: 'Illustrative demo data',
  hero: {
    // Kept from the previous hero: this line carries the category keywords above the H1.
    eyebrow: EN_HOME.badge,
    headline: ['Make Your', 'Work Visible.'],
    statement:
      'Understand where your development time goes, how your projects evolve, and how humans and AI contribute to the work you create.',
    // The answer-engine paragraph from the previous hero, unchanged.
    lead: EN_HOME.heroLead,
    explore: `Explore ${SITE_NAME}`,
    product: 'View the Product',
    earlyAccessNote: 'Invite-only Early Access. No payment required to join the list.',
    join: 'Join early access',
    compare: 'Compare with WakaTime',
    highlights: EN_HOME.highlights,
    highlightsLabel: `${SITE_NAME} essentials`,
    scroll: 'Scroll to make the work visible',
    sceneCaption:
      'A column of fine marks: two weeks of illustrative coding activity, folded into one axis.',
  },
  second: {
    kicker: '02 — Activity',
    heading: 'Every Second Tells a Story.',
    body: 'See how your development time takes shape across projects, tools, and coding sessions.',
    explain:
      'Each mark in the scene is one duration block. Your editor sends a heartbeat when you type, switch to or save a file, and the server joins nearby heartbeats into blocks. A long gap closes a block instead of padding it, so idle time is never counted as coding time.',
    hoverHint: 'Point at the spiral to read a block. Each ring is one day.',
    projectsLabel: 'Demo projects',
    toolsHeading: 'Works from the editor you already use',
    toolsBody:
      'Connect your existing WakaTime plugin to track coding time. AI attribution depends on your integration.',
    toolsCount: 'editors through the WakaTime plugin protocol',
    toolsLabel: 'Editors compatible through the WakaTime plugin protocol',
    toolsRegion: 'Browse compatible editors',
  },
  humanAi: {
    kicker: '03 — Human + AI',
    heading: 'Development Has Changed.',
    subheading: 'Understand the Human + AI Workflow.',
    body: 'Explore how human development and AI-assisted activity contribute to your projects.',
    controlsLabel: 'Choose which activity to focus on',
    caution:
      'Attribution is code-change attribution, not a measure of time or quality. It is only as complete as the evidence your tools report.',
    kinds: {
      human: {
        label: 'Human',
        title: 'Human activity',
        body: 'Changes backed by your own editor activity. Keystrokes and characters added or deleted are counted per project and per day, alongside elapsed time.',
        pattern: 'Solid marks',
      },
      ai: {
        label: 'AI agents',
        title: 'AI coding agent activity',
        body: 'Line changes reported by a coding agent’s hook, aggregated per agent and per day. Hooks cover Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI; Cursor and Copilot need adapters.',
        pattern: 'Segmented marks',
      },
      unattributed: {
        label: 'Unattributed',
        title: 'Evidence we do not have',
        body: 'Work that cannot be proved either way stays Unattributed instead of being credited to you or to an AI. Missing evidence stays unknown.',
        pattern: 'Faint marks',
      },
      all: {
        label: 'Together',
        title: 'Combined development activity',
        body: 'Both systems on one timeline, with the coverage behind every total reported as a percentage rather than guessed.',
        pattern: 'All marks',
      },
    },
    shareLabel: 'Share of demo coding time (not line changes)',
    minutesLabel: 'demo minutes',
  },
  insight: {
    kicker: '04 — Insight',
    heading: 'From Activity to Understanding.',
    body: 'Turn development activity into meaningful insights about your time, projects, and workflows.',
    // Kept from the previous worked-example section: the interpretation is what answer
    // engines lift, and the source line is what keeps the sample honest.
    interpretation:
      'This worked example shows how a developer can read one week without opening several reports. The illustrative account logged 28 hours 10 minutes across seven days, including 5 hours 42 minutes today, and 34% of its measured line changes were attributed to AI. The bars show when activity happened; the tiles summarize duration, attribution and the active project. Those figures are sample data created for this preview, not customer results or a performance benchmark. In a real account, AtoAxis derives duration from nearby editor heartbeats, labels line changes as AI, human or Unattributed, and reports coverage so missing evidence is not silently converted to zero. Use the timeline to find an unusual day, then filter by project, language, editor or branch before reviewing the related file list.',
    source: 'Data source: illustrative AtoAxis sample, not customer data.',
    timelineTitle: 'Activity, last 7 days',
    frameLabel: 'Illustration of the AtoAxis activity timeline',
  },
  product: {
    kicker: '05 — The product',
    heading: `Meet ${SITE_NAME}.`,
    body: 'The same activity, organised into the views you open every day: an overview of your time, a timeline of your rhythm, your projects, and the Human + AI split.',
    tabsLabel: 'Product views',
    illustration: 'Illustration based on the product interface · demo data, not a screenshot',
    screenshot: 'Product screenshot',
    hotspotsLabel: 'What you are looking at',
    views: {
      overview: {
        tab: 'Overview',
        title: 'Your time at a glance',
        body: 'Today, all-time active coding, active days and your first recorded day, with a daily goal tracked against the same timeline.',
      },
      timeline: {
        tab: 'Activity Timeline',
        title: 'Your rhythm, hour by hour',
        body: 'When the work happened, drilled from a link into a timeline, a heatmap and the file list, filtered by project, language, editor or branch.',
      },
      projects: {
        tab: 'Projects',
        title: 'Every project, measured',
        body: 'Time broken down by project, language, editor and branch. Several checkouts can be grouped with project rules and merges.',
      },
      'human-ai': {
        tab: 'Human vs AI',
        title: 'Who changed the code',
        body: 'AI-attributed lines compared with human keystrokes and characters, with Unattributed kept separate and coverage shown.',
      },
    },
    featuresHeading: `What ${SITE_NAME} tracks`,
    featuresIntro:
      'Not just elapsed time: which project and language, how the code was written, and where the data lives.',
    features: [
      {
        title: 'Complete history',
        description:
          'Every account keeps your full coding history. Nothing is aged out to a recent window, and there is no higher tier to buy for it.',
      },
      {
        title: 'AI attribution in the API',
        description:
          'Heartbeats accept an AI agent name and AI line counts. Whatever your tooling reports under that field is aggregated per agent and per day.',
      },
      {
        title: 'AI vs. human breakdown',
        description:
          'Lines attributed to an AI agent are counted separately from human keystrokes and characters, so the two can be compared over a date range.',
      },
      {
        title: 'Keystroke-level detail',
        description:
          'Keystrokes and characters added or deleted are recorded per project and per day, alongside elapsed time.',
      },
      {
        title: 'Project rules & merges',
        description:
          'Regex-based project detection and manual merges, applied server-side so every client stays in sync automatically.',
      },
      {
        title: 'AST-based language detection',
        description:
          'Tree-sitter parsing instead of file-extension guessing, so ambiguous extensions like .h are handled correctly.',
      },
    ],
  },
  invitation: {
    kicker: '06 — Begin',
    heading: 'See the Bigger Picture of Your Work.',
    body: 'Understand your development activity, discover meaningful patterns, and explore how humans and AI work together.',
    primary: `Get Started with ${SITE_NAME}`,
    secondary: 'Explore Features',
    note: 'Early Access is invite-only. Join the list and we will email your API key.',
    navLabel: 'Continue exploring',
    links: [
      { label: 'Product', href: '#features' },
      { label: 'Analytics', href: '/developer-analytics' },
      { label: 'Documentation', href: '/docs' },
      { label: 'Integrations', href: '/integrations' },
      { label: 'Contact', href: '/contact' },
    ],
  },
};

type ExperienceCopy = typeof EN;
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : { readonly [K in keyof T]: Widen<T[K]> };

const TH: Widen<ExperienceCopy> = {
  rail: {
    label: 'บทของเรื่องราว',
    chapters: ['สิ่งที่มองไม่เห็น', 'ทุกวินาที', 'คน + AI', 'ความเข้าใจ', 'ผลิตภัณฑ์', 'เริ่มต้น'],
  },
  loader: {
    label: 'กำลังเตรียมฉาก 3D',
    steps: ['โมดูลฉาก', 'รูปทรงกิจกรรม', 'เฟรมแรก'],
    ready: 'ฉาก 3D พร้อมแล้ว',
    skipped: 'แสดงฉากแบบภาพนิ่ง',
  },
  demoBadge: 'ข้อมูลตัวอย่างเพื่ออธิบาย',
  hero: {
    eyebrow: TH_HOME.badge,
    headline: ['ทำให้งานของคุณ', 'มองเห็นได้'],
    statement:
      'เข้าใจว่าเวลาพัฒนาของคุณไปอยู่ที่ไหน โปรเจกต์เติบโตอย่างไร และคนกับ AI มีส่วนร่วมในงานที่คุณสร้างอย่างไร',
    lead: TH_HOME.heroLead,
    explore: `สำรวจ ${SITE_NAME}`,
    product: 'ดูผลิตภัณฑ์',
    earlyAccessNote: 'Early Access แบบเชิญ ลงชื่อแสดงความสนใจได้โดยไม่มีค่าใช้จ่าย',
    join: 'เข้าร่วม Early Access',
    compare: 'เปรียบเทียบกับ WakaTime',
    highlights: TH_HOME.highlights,
    highlightsLabel: `จุดเด่นของ ${SITE_NAME}`,
    scroll: 'เลื่อนลงเพื่อทำให้งานมองเห็นได้',
    sceneCaption:
      'เสาที่ประกอบด้วยเส้นเล็ก ๆ: กิจกรรมเขียนโค้ดตัวอย่างสองสัปดาห์ พับรวมไว้บนแกนเดียว',
  },
  second: {
    kicker: '02 — กิจกรรม',
    heading: 'ทุกวินาทีมีเรื่องราว',
    body: 'ดูว่าเวลาพัฒนาของคุณก่อตัวอย่างไร ข้ามโปรเจกต์ เครื่องมือ และ coding session',
    explain:
      'แต่ละเส้นในฉากคือหนึ่ง duration block เมื่อคุณพิมพ์ สลับ หรือบันทึกไฟล์ editor จะส่ง heartbeat แล้ว server รวม heartbeat ที่อยู่ใกล้กันเป็น block ช่วงว่างที่ยาวจะปิด block แทนการนับต่อ เวลาที่ไม่ได้ทำงานจึงไม่ถูกนับเป็นเวลาเขียนโค้ด',
    hoverHint: 'ชี้ที่เกลียวเพื่ออ่านแต่ละ block หนึ่งวงคือหนึ่งวัน',
    projectsLabel: 'โปรเจกต์ตัวอย่าง',
    toolsHeading: 'ใช้งานจาก editor ที่คุณใช้อยู่แล้ว',
    toolsBody:
      'เชื่อมต่อผ่าน WakaTime plugin เดิมเพื่อบันทึกเวลาเขียนโค้ด ส่วนข้อมูล AI ขึ้นอยู่กับ integration ที่ใช้',
    toolsCount: 'editor ผ่าน WakaTime plugin protocol',
    toolsLabel: 'Editor ที่เข้ากันได้ผ่าน WakaTime protocol',
    toolsRegion: 'รายชื่อ editor เลื่อนดูได้',
  },
  humanAi: {
    kicker: '03 — คน + AI',
    heading: 'การพัฒนาซอฟต์แวร์เปลี่ยนไปแล้ว',
    subheading: 'เข้าใจ workflow ระหว่างคนกับ AI',
    body: 'สำรวจว่างานที่คนเขียนและกิจกรรมที่ AI ช่วย มีส่วนร่วมในโปรเจกต์ของคุณอย่างไร',
    controlsLabel: 'เลือกกิจกรรมที่ต้องการโฟกัส',
    caution:
      'Attribution คือการระบุที่มาของการเปลี่ยนแปลงโค้ด ไม่ใช่การวัดเวลาหรือคุณภาพ และครบถ้วนได้เท่าที่หลักฐานจากเครื่องมือของคุณรายงาน',
    kinds: {
      human: {
        label: 'คน',
        title: 'กิจกรรมของคน',
        body: 'การเปลี่ยนแปลงที่มีกิจกรรมใน editor ของคุณรองรับ นับ keystrokes และ characters ที่เพิ่มหรือลบตามโปรเจกต์และวัน ควบคู่กับเวลาที่ใช้',
        pattern: 'เส้นทึบ',
      },
      ai: {
        label: 'AI agent',
        title: 'กิจกรรมของ AI coding agent',
        body: 'การเปลี่ยนแปลงบรรทัดที่ hook ของ coding agent รายงาน รวมตาม agent และวัน รองรับ Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI ส่วน Cursor และ Copilot ต้องใช้ adapter',
        pattern: 'เส้นประ',
      },
      unattributed: {
        label: 'ไม่ทราบที่มา',
        title: 'หลักฐานที่เราไม่มี',
        body: 'งานที่พิสูจน์ไม่ได้ว่าใครทำจะอยู่ในกลุ่ม Unattributed แทนการยกให้คุณหรือ AI ข้อมูลที่ไม่มีหลักฐานยังคงเป็น “ไม่ทราบ”',
        pattern: 'เส้นจาง',
      },
      all: {
        label: 'รวมกัน',
        title: 'กิจกรรมการพัฒนาทั้งหมด',
        body: 'ทั้งสองระบบบนไทม์ไลน์เดียว พร้อมรายงาน coverage ของทุกยอดรวมเป็นเปอร์เซ็นต์แทนการเดา',
        pattern: 'ทุกเส้น',
      },
    },
    shareLabel: 'สัดส่วนเวลาเขียนโค้ดตัวอย่าง (ไม่ใช่จำนวนบรรทัด)',
    minutesLabel: 'นาที (ตัวอย่าง)',
  },
  insight: {
    kicker: '04 — ความเข้าใจ',
    heading: 'จากกิจกรรม สู่ความเข้าใจ',
    body: 'เปลี่ยนกิจกรรมการพัฒนาให้เป็น insight ที่มีความหมายเกี่ยวกับเวลา โปรเจกต์ และ workflow ของคุณ',
    interpretation:
      'ตัวอย่างนี้แสดงวิธีอ่านหนึ่งสัปดาห์ของนักพัฒนาโดยไม่ต้องเปิดรายงานหลายหน้า บัญชีตัวอย่างมีเวลา 28 ชั่วโมง 10 นาทีในเจ็ดวัน วันนี้ทำไป 5 ชั่วโมง 42 นาที และ 34% ของการเปลี่ยนแปลงบรรทัดที่วัดได้มาจาก AI แท่งกราฟบอกว่ากิจกรรมเกิดวันใด ส่วนการ์ดสรุประยะเวลา attribution และโปรเจกต์ปัจจุบัน ตัวเลขทั้งหมดเป็นข้อมูลตัวอย่างที่ AtoAxis สร้างขึ้นเพื่ออธิบายหน้าจอ ไม่ใช่ผลลัพธ์ของลูกค้าหรือ benchmark ในบัญชีจริง ระบบคำนวณระยะเวลาจาก editor heartbeat ที่เกิดใกล้กัน แบ่งการเปลี่ยนแปลงบรรทัดเป็น AI, human หรือ Unattributed และรายงาน coverage เพื่อไม่เปลี่ยนข้อมูลที่ขาดเป็นศูนย์โดยไม่บอก คุณสามารถเริ่มจากวันที่ผิดปกติใน timeline แล้วกรองตามโปรเจกต์ ภาษา editor หรือ branch ก่อนเปิดดูรายชื่อไฟล์ที่เกี่ยวข้อง',
    source: 'แหล่งข้อมูล: ข้อมูลจำลองโดย AtoAxis ไม่ใช่ข้อมูลลูกค้า',
    timelineTitle: 'Activity ย้อนหลัง 7 วัน',
    frameLabel: 'ภาพประกอบ activity timeline ของ AtoAxis',
  },
  product: {
    kicker: '05 — ผลิตภัณฑ์',
    heading: `รู้จัก ${SITE_NAME}`,
    body: 'กิจกรรมชุดเดียวกัน จัดเป็นหน้าจอที่คุณเปิดทุกวัน: ภาพรวมเวลา ไทม์ไลน์จังหวะการทำงาน โปรเจกต์ และสัดส่วนคนกับ AI',
    tabsLabel: 'หน้าจอผลิตภัณฑ์',
    illustration: 'ภาพประกอบจากหน้าจอผลิตภัณฑ์ · ข้อมูลตัวอย่าง ไม่ใช่ภาพหน้าจอจริง',
    screenshot: 'ภาพหน้าจอผลิตภัณฑ์',
    hotspotsLabel: 'สิ่งที่คุณกำลังดู',
    views: {
      overview: {
        tab: 'ภาพรวม',
        title: 'เวลาของคุณในภาพเดียว',
        body: 'วันนี้ เวลาเขียนโค้ดทั้งหมด จำนวนวันที่มีกิจกรรม และวันแรกที่บันทึก พร้อมเป้าหมายรายวันบนไทม์ไลน์เดียวกัน',
      },
      timeline: {
        tab: 'Activity Timeline',
        title: 'จังหวะการทำงานรายชั่วโมง',
        body: 'งานเกิดขึ้นเมื่อไร เจาะลงจากลิงก์เดียวไปยัง timeline, heatmap และรายชื่อไฟล์ กรองตามโปรเจกต์ ภาษา editor หรือ branch',
      },
      projects: {
        tab: 'โปรเจกต์',
        title: 'วัดผลได้ทุกโปรเจกต์',
        body: 'แยกเวลาตามโปรเจกต์ ภาษา editor และ branch และรวมหลาย checkout เข้าด้วยกันด้วย project rules และ merge',
      },
      'human-ai': {
        tab: 'คน vs AI',
        title: 'ใครเปลี่ยนโค้ด',
        body: 'เทียบบรรทัดที่มาจาก AI กับ keystrokes และ characters ของคน โดยแยก Unattributed ไว้ต่างหากพร้อมแสดง coverage',
      },
    },
    featuresHeading: `${SITE_NAME} ติดตามอะไรบ้าง`,
    featuresIntro: 'เห็นภาพงานครบขึ้น ตั้งแต่เวลาที่ใช้ โปรเจกต์และภาษา ไปจนถึงการมีส่วนร่วมของ AI',
    features: [
      {
        title: 'ประวัติครบถ้วน',
        description:
          'ทุกบัญชีเก็บ coding history เต็ม ไม่ตัดเหลือเฉพาะช่วงล่าสุด และไม่ต้องซื้อ tier สูงกว่า',
      },
      {
        title: 'AI attribution ใน API',
        description: 'Heartbeat รองรับชื่อ agent และ AI line counts แล้วรวมผลตาม agent และวัน',
      },
      {
        title: 'แยก AI กับ human',
        description:
          'นับ AI-attributed lines แยกจาก human keystrokes และ characters เพื่อเทียบในช่วงเวลาเดียวกัน',
      },
      {
        title: 'รายละเอียดระดับ keystroke',
        description:
          'เก็บจำนวน keystrokes และ characters เพิ่มหรือลบตาม project และวัน โดยไม่เก็บเนื้อหา',
      },
      {
        title: 'Project rules และ merge',
        description:
          'ตรวจ project ด้วย regex และรวมโปรเจกต์ฝั่ง server ให้ client ทุกตัวเห็นตรงกัน',
      },
      {
        title: 'ตรวจภาษาด้วย AST',
        description: 'ใช้ tree-sitter แทนการเดาจากนามสกุลไฟล์เพื่อรองรับไฟล์ที่กำกวม',
      },
    ],
  },
  invitation: {
    kicker: '06 — เริ่มต้น',
    heading: 'เห็นภาพใหญ่ของงานคุณ',
    body: 'เข้าใจกิจกรรมการพัฒนาของคุณ ค้นพบรูปแบบที่มีความหมาย และสำรวจว่าคนกับ AI ทำงานร่วมกันอย่างไร',
    primary: `เริ่มต้นกับ ${SITE_NAME}`,
    secondary: 'สำรวจฟีเจอร์',
    note: 'Early Access แบบเชิญ เข้าร่วมรายชื่อแล้วเราจะส่ง API key ให้ทางอีเมล',
    navLabel: 'สำรวจต่อ',
    links: [
      { label: 'ผลิตภัณฑ์', href: '#features' },
      { label: 'Analytics', href: '/developer-analytics' },
      { label: 'เอกสาร', href: '/docs' },
      { label: 'การเชื่อมต่อ', href: '/integrations' },
      { label: 'ติดต่อ', href: '/contact' },
    ],
  },
};

export const EXPERIENCE_COPY: Record<SiteLocale, Widen<ExperienceCopy>> = { en: EN, th: TH };
export type ExperienceCopyShape = Widen<ExperienceCopy>;

export const ATTRIBUTION_KINDS = ['human', 'ai', 'unattributed', 'all'] as const;
export const PRODUCT_VIEWS = ['overview', 'timeline', 'projects', 'human-ai'] as const;
