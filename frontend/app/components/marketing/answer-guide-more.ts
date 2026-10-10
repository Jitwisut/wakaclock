 
/**
 * Answer-guide content that every marketing page carries: the trade-off a reader should
 * weigh, primary external references, and full guides for the pages that had none.
 *
 * Every statement here restates something the page itself already says, or a primary
 * source linked beside it. Nothing is a customer result, a benchmark or an invented quote.
 */
import { PRICING, PUBLIC_EVIDENCE_URL, type SiteLocale } from '@/lib/seo/site';

export type GuideSource = {
  href: string;
  label: string;
  note: string;
};

export type GuideTable = {
  caption: string;
  columns: readonly [string, string, string];
  rows: readonly (readonly [string, string, string])[];
};

export type Guide = {
  answer: string;
  example: string;
  facts: readonly (readonly [string, string])[];
  heading: string;
  question: string;
  recommendation: string;
  sources?: readonly GuideSource[];
  table?: GuideTable;
};

type Reference = { en: [string, string]; href: string; th: [string, string] };

/** Primary sources, each checked to resolve. [label, what it supports]. */
const REFERENCES = {
  wakatimeApi: {
    href: 'https://wakatime.com/developers',
    en: ['WakaTime API documentation', 'the heartbeat protocol compatible plugins send'],
    th: ['เอกสาร WakaTime API', 'โปรโตคอล heartbeat ที่ plugin ที่รองรับใช้ส่งข้อมูล'],
  },
  wakatimePlugins: {
    href: 'https://wakatime.com/help/creating-plugin',
    en: ['WakaTime plugin guide', 'how editor plugins produce heartbeats'],
    th: ['คู่มือสร้าง plugin ของ WakaTime', 'วิธีที่ plugin ของ editor สร้าง heartbeat'],
  },
  vscodeMarketplace: {
    href: 'https://code.visualstudio.com/docs/editor/extension-marketplace',
    en: ['VS Code extension documentation', 'installing and managing VS Code extensions'],
    th: ['เอกสาร extension ของ VS Code', 'วิธีติดตั้งและจัดการ extension ใน VS Code'],
  },
  vscodeApi: {
    href: 'https://code.visualstudio.com/api',
    en: ['VS Code Extension API', 'the editor events an extension can observe'],
    th: ['VS Code Extension API', 'event ของ editor ที่ extension มองเห็นได้'],
  },
  soSurveyAi: {
    href: 'https://survey.stackoverflow.co/2025/ai',
    en: ['Stack Overflow Developer Survey 2025: AI', 'how developers use and trust AI tools'],
    th: [
      'Stack Overflow Developer Survey 2025: AI',
      'การใช้และความเชื่อถือเครื่องมือ AI ของนักพัฒนา',
    ],
  },
  dora: {
    href: 'https://dora.dev/guides/dora-metrics-four-keys/',
    en: [
      'DORA software delivery metrics',
      'delivery outcomes, a different view from editor activity',
    ],
    th: ['DORA software delivery metrics', 'ผลลัพธ์การส่งมอบ ซึ่งเป็นคนละมุมกับกิจกรรมใน editor'],
  },
  claudeHooks: {
    href: 'https://docs.anthropic.com/en/docs/claude-code/hooks',
    en: ['Claude Code hooks documentation', 'the hook events an attribution integration reads'],
    th: ['เอกสาร hooks ของ Claude Code', 'event ของ hook ที่ระบบ attribution อ่าน'],
  },
  codexCli: {
    href: 'https://github.com/openai/codex',
    en: ['OpenAI Codex CLI repository', 'the agent behind one bundled integration'],
    th: ['repository ของ OpenAI Codex CLI', 'agent ของ integration หนึ่งที่มีให้ในตัว'],
  },
  geminiCli: {
    href: 'https://github.com/google-gemini/gemini-cli',
    en: ['Google Gemini CLI repository', 'the agent behind one bundled integration'],
    th: ['repository ของ Google Gemini CLI', 'agent ของ integration หนึ่งที่มีให้ในตัว'],
  },
  anthropicPricing: {
    href: 'https://www.anthropic.com/pricing',
    en: ['Anthropic pricing', 'the list prices behind the shipped price catalogue'],
    th: ['ราคาของ Anthropic', 'ราคามาตรฐานที่ใช้ใน price catalogue ที่มีให้'],
  },
  geminiPricing: {
    href: 'https://ai.google.dev/gemini-api/docs/pricing',
    en: ['Gemini API pricing', 'a provider whose prices are effective-dated by model'],
    th: ['ราคา Gemini API', 'ตัวอย่าง provider ที่ราคาเปลี่ยนตามรุ่นและวันที่มีผล'],
  },
  json: {
    href: 'https://www.rfc-editor.org/rfc/rfc8259',
    en: ['RFC 8259: the JSON format', 'the format of heartbeat and usage payloads'],
    th: ['RFC 8259: รูปแบบ JSON', 'รูปแบบของ payload heartbeat และ usage'],
  },
  isoDates: {
    href: 'https://www.w3.org/TR/NOTE-datetime',
    en: ['W3C date and time formats', 'the timestamp format used for events'],
    th: ['รูปแบบวันเวลาของ W3C', 'รูปแบบ timestamp ของ event'],
  },
  gitBranch: {
    href: 'https://git-scm.com/docs/git-branch',
    en: ['Git branch documentation', 'the branch names that analytics group by'],
    th: ['เอกสาร git branch', 'ชื่อ branch ที่ analytics ใช้จัดกลุ่ม'],
  },
  gdprPersonalData: {
    href: 'https://gdpr-info.eu/art-4-gdpr/',
    en: ['GDPR Article 4 definitions', 'why metadata such as names can still be personal data'],
    th: ['นิยามใน GDPR มาตรา 4', 'เหตุที่ metadata เช่นชื่อ ยังอาจเป็นข้อมูลส่วนบุคคล'],
  },
  timeTracking: {
    href: 'https://en.wikipedia.org/wiki/Time_tracking_software',
    en: ['Time tracking software (Wikipedia)', 'background on the product category'],
    th: ['Time tracking software (Wikipedia)', 'ภาพรวมของซอฟต์แวร์ประเภทนี้'],
  },
  founderGithub: {
    href: 'https://github.com/Jitwisut',
    en: ['Jitwisut Thobut on GitHub', 'the founder and developer behind AtoAxis'],
    th: ['Jitwisut Thobut บน GitHub', 'ผู้ก่อตั้งและนักพัฒนา AtoAxis'],
  },
} as const satisfies Record<string, Reference>;

type ReferenceKey = keyof typeof REFERENCES;

const PAGE_REFERENCES: Record<string, readonly ReferenceKey[]> = {
  '/': ['wakatimeApi', 'soSurveyAi', 'dora'],
  // These two pages already name WakaTime densely; their extra sources do not add to it.
  '/wakatime-alternative': ['timeTracking', 'json', 'dora'],
  '/ai-coding-tracker': ['claudeHooks', 'codexCli', 'geminiCli', 'soSurveyAi'],
  '/ai-cost-tracking': ['anthropicPricing', 'geminiPricing', 'claudeHooks', 'json'],
  '/developer-analytics': ['dora', 'gitBranch', 'timeTracking'],
  '/teams': ['dora', 'timeTracking', 'wakatimeApi'],
  '/pricing': ['timeTracking', 'wakatimeApi', 'dora'],
  '/integrations': ['wakatimePlugins', 'vscodeMarketplace', 'wakatimeApi'],
  '/integrations/vscode': ['vscodeMarketplace', 'vscodeApi', 'wakatimeApi'],
  '/docs': ['wakatimeApi', 'json', 'isoDates'],
  '/docs/getting-started': ['vscodeMarketplace', 'wakatimeApi', 'json'],
  '/docs/migrate-from-wakatime': ['json', 'isoDates', 'timeTracking'],
  '/docs/how-coding-time-is-calculated': ['wakatimeApi', 'isoDates', 'timeTracking'],
  '/docs/ai-attribution-and-coverage': ['claudeHooks', 'codexCli', 'geminiCli'],
  '/docs/ai-cost-methodology': ['anthropicPricing', 'geminiPricing', 'json'],
  '/about': ['founderGithub', 'timeTracking', 'wakatimeApi'],
  '/contact': ['founderGithub', 'wakatimeApi', 'vscodeMarketplace'],
  '/terms': ['gdprPersonalData', 'timeTracking', 'json'],
  '/privacy': ['gdprPersonalData', 'json', 'wakatimeApi'],
  '/early-access': ['wakatimeApi', 'vscodeMarketplace', 'timeTracking'],
};

/** External primary sources for a page, in the page's language. */
export function externalReferences(path: string, locale: SiteLocale): GuideSource[] {
  return (PAGE_REFERENCES[path] ?? []).map((key) => {
    const reference: Reference = REFERENCES[key];
    const [label, note] = reference[locale];
    return { href: reference.href, label, note };
  });
}

/** The honest counterweight to each page: when the product or the metric may not fit. */
const TRADEOFFS: Record<SiteLocale, Record<string, string>> = {
  en: {
    '/': 'On the other hand, editor heartbeats only see work done in a connected editor. Meetings, design reviews and time spent reading elsewhere stay invisible, so an AtoAxis total is a record of coding activity, not of a whole working day.',
    '/wakatime-alternative':
      'On the other hand, WakaTime is an established service with a long-running plugin ecosystem and team features. If you depend on mature team administration today, staying may be the better choice while AtoAxis team seats remain in development.',
    '/ai-coding-tracker':
      'On the other hand, attribution is only as complete as the hooks you install. Agents without a hook or adapter, such as Cursor and Copilot today, appear as Unattributed changes rather than as AI work.',
    '/ai-cost-tracking':
      'On the other hand, cost is an estimate from list prices. Subscription plans, negotiated discounts and providers without a price row are not reflected, so treat spend as a basis for comparison rather than as an invoice.',
    '/developer-analytics':
      'On the other hand, activity metrics describe effort in the editor, not outcomes. Delivery measures such as the DORA metrics answer different questions and belong beside these charts rather than being replaced by them.',
    '/teams':
      'On the other hand, team presence is a prototype. Assigned team and organisation seats are not available yet, so a team that needs administration and billing today should wait or keep an established tool.',
    '/pricing':
      'On the other hand, these are planned launch prices and checkout is not open. Nothing can be bought yet, and the plan may change before launch, so compare features rather than committing a budget today.',
    '/integrations':
      'On the other hand, support through the WakaTime protocol means each editor works as well as its own plugin. The first-party client is the VS Code extension; other editors rely on the WakaTime plugin they already ship.',
    '/integrations/vscode':
      'On the other hand, the extension only sees VS Code. Work in a terminal editor or another IDE needs its own WakaTime-compatible plugin before it appears in the same totals.',
    '/docs':
      'On the other hand, these guides describe a service in Early Access. Where a feature is marked as in development, the guide describes the intended behaviour, not something you can rely on yet.',
    '/docs/getting-started':
      'On the other hand, a first heartbeat only proves the connection works. Give it a day of normal work before judging project names, languages and totals.',
    '/docs/migrate-from-wakatime':
      'On the other hand, an import carries your history but not evidence it never contained. Imported days have no AI attribution, so compare like with like when a trend crosses the migration date.',
    '/docs/how-coding-time-is-calculated':
      'On the other hand, any timeout rule is a model of activity. A long pause spent reading code ends a block even though you were working, and a short gap between unrelated edits is still bridged.',
    '/docs/ai-attribution-and-coverage':
      'On the other hand, a high AI share with low coverage says little. Coverage tells you how much of the period had evidence at all, so read the two numbers together before drawing a conclusion.',
    '/docs/ai-cost-methodology':
      'On the other hand, effective-dated prices are only as current as the price catalogue. A provider price change that has not been added yet leaves new usage priced as unknown until the catalogue is updated.',
    '/about':
      'On the other hand, AtoAxis is a young, independently built product in Early Access. Check the current status before relying on a feature, and use the contact page when a claim matters to your decision.',
    '/contact':
      'On the other hand, this form is not an account support desk. Early Access has no separate support channel yet, so a question about one specific account may take longer to answer.',
    '/terms':
      'On the other hand, these are preliminary terms for the Early Access website. They will be replaced before paid accounts open, so read the final terms then instead of relying on this version.',
    '/privacy':
      'On the other hand, metadata can still be personal. Project names, branch names and file paths can reveal what you work on, so review what your clients send before you connect a sensitive repository.',
    '/early-access':
      'On the other hand, joining the list does not give you an account straight away. Keys are issued to people on the list over time, so you may wait before you can connect an editor.',
  },
  th: {
    '/': 'ในทางกลับกัน heartbeat จาก editor เห็นเฉพาะงานที่ทำใน editor ที่เชื่อมต่อ การประชุม การรีวิวงานออกแบบ และเวลาอ่านเอกสารที่อื่นจะไม่ถูกนับ ยอดของ AtoAxis จึงเป็นบันทึกกิจกรรมการเขียนโค้ด ไม่ใช่เวลาทำงานทั้งวัน',
    '/wakatime-alternative':
      'ในทางกลับกัน WakaTime เป็นบริการที่อยู่มานาน มี plugin จำนวนมากและมีฟีเจอร์สำหรับทีม ถ้าคุณต้องใช้ระบบจัดการทีมที่ครบวันนี้ การใช้ WakaTime ต่อไปอาจเหมาะกว่า ระหว่างที่ team seat ของ AtoAxis ยังพัฒนาอยู่',
    '/ai-coding-tracker':
      'ในทางกลับกัน attribution ครบได้เท่ากับ hook ที่คุณติดตั้งเท่านั้น agent ที่ไม่มี hook หรือ adapter เช่น Cursor และ Copilot ในตอนนี้ จะแสดงเป็น Unattributed ไม่ใช่งานของ AI',
    '/ai-cost-tracking':
      'ในทางกลับกัน ค่าใช้จ่ายเป็นค่าประมาณจากราคามาตรฐาน แผน subscription ส่วนลดที่ต่อรอง และ provider ที่ไม่มีข้อมูลราคาจะไม่ถูกสะท้อน ให้ใช้ตัวเลขนี้เพื่อเปรียบเทียบ ไม่ใช่แทนใบแจ้งหนี้',
    '/developer-analytics':
      'ในทางกลับกัน ตัวเลขกิจกรรมบอกความพยายามใน editor ไม่ใช่ผลลัพธ์ ตัวชี้วัดการส่งมอบอย่าง DORA ตอบคำถามคนละแบบ จึงควรดูควบคู่กับกราฟเหล่านี้ ไม่ใช่ใช้แทนกัน',
    '/teams':
      'ในทางกลับกัน presence สำหรับทีมยังเป็น prototype และยังไม่มี team หรือ organisation seat ทีมที่ต้องการระบบจัดการและการเรียกเก็บเงินวันนี้ควรรอ หรือใช้เครื่องมือที่มีอยู่ไปก่อน',
    '/pricing':
      'ในทางกลับกัน ราคานี้เป็นราคาเปิดตัวที่วางแผนไว้และยังไม่เปิด checkout ตอนนี้ยังซื้อไม่ได้ และแผนอาจเปลี่ยนก่อนเปิดตัว จึงควรเทียบฟีเจอร์มากกว่าการตั้งงบประมาณตั้งแต่วันนี้',
    '/integrations':
      'ในทางกลับกัน การรองรับผ่านโปรโตคอล WakaTime หมายความว่าแต่ละ editor ทำงานได้ดีเท่ากับ plugin ของมันเอง client ที่เราดูแลเองคือ extension สำหรับ VS Code ส่วน editor อื่นใช้ WakaTime plugin ที่มีอยู่แล้ว',
    '/integrations/vscode':
      'ในทางกลับกัน extension นี้เห็นเฉพาะงานใน VS Code งานใน editor บน terminal หรือ IDE อื่นต้องมี plugin ที่รองรับ WakaTime ของตัวเอง จึงจะรวมอยู่ในยอดเดียวกัน',
    '/docs':
      'ในทางกลับกัน คู่มือเหล่านี้อธิบายบริการที่อยู่ในช่วง Early Access ส่วนที่ระบุว่ากำลังพัฒนาคือพฤติกรรมที่ตั้งใจไว้ ยังไม่ใช่สิ่งที่พึ่งพาได้ในตอนนี้',
    '/docs/getting-started':
      'ในทางกลับกัน heartbeat แรกพิสูจน์แค่ว่าการเชื่อมต่อทำงาน ควรรอใช้งานจริงสักหนึ่งวันก่อนตัดสินชื่อโปรเจกต์ ภาษา และยอดเวลา',
    '/docs/migrate-from-wakatime':
      'ในทางกลับกัน การ import นำประวัติมาได้ แต่ไม่ได้สร้างหลักฐานที่ข้อมูลเดิมไม่เคยมี วันที่ import มาจึงไม่มี AI attribution เวลาดูแนวโน้มที่คร่อมวันย้ายระบบ ให้เทียบข้อมูลชนิดเดียวกัน',
    '/docs/how-coding-time-is-calculated':
      'ในทางกลับกัน กฎ timeout ทุกแบบเป็นเพียงแบบจำลองของกิจกรรม การหยุดนานเพื่ออ่านโค้ดจะปิด block ทั้งที่คุณยังทำงานอยู่ และช่วงว่างสั้นระหว่างการแก้ไขที่ไม่เกี่ยวกันก็ยังถูกเชื่อม',
    '/docs/ai-attribution-and-coverage':
      'ในทางกลับกัน สัดส่วน AI ที่สูงแต่ coverage ต่ำบอกอะไรได้น้อย coverage บอกว่าช่วงเวลานั้นมีหลักฐานมากแค่ไหน จึงควรอ่านสองตัวเลขนี้คู่กันก่อนสรุป',
    '/docs/ai-cost-methodology':
      'ในทางกลับกัน ราคาตามวันที่มีผลจะทันสมัยเท่ากับ price catalogue เท่านั้น ถ้า provider เปลี่ยนราคาแต่ยังไม่ได้เพิ่มใน catalogue การใช้งานใหม่จะแสดงค่าใช้จ่ายเป็น unknown จนกว่าจะอัปเดต',
    '/about':
      'ในทางกลับกัน AtoAxis เป็นผลิตภัณฑ์ใหม่ที่พัฒนาอย่างอิสระและอยู่ในช่วง Early Access ควรตรวจสถานะล่าสุดก่อนพึ่งพาฟีเจอร์ใด และใช้หน้าติดต่อเมื่อข้อมูลนั้นสำคัญต่อการตัดสินใจของคุณ',
    '/contact':
      'ในทางกลับกัน ฟอร์มนี้ไม่ใช่ช่องทาง support ของบัญชี ช่วง Early Access ยังไม่มีช่องทาง support แยก คำถามเกี่ยวกับบัญชีใดบัญชีหนึ่งจึงอาจใช้เวลาตอบนานกว่า',
    '/terms':
      'ในทางกลับกัน นี่คือข้อกำหนดเบื้องต้นของเว็บไซต์ช่วง Early Access และจะถูกแทนที่ก่อนเปิดบัญชีแบบชำระเงิน ควรอ่านข้อกำหนดฉบับจริงเมื่อถึงเวลานั้น แทนการยึดฉบับนี้',
    '/privacy':
      'ในทางกลับกัน metadata ก็ยังอาจเป็นข้อมูลส่วนตัวได้ ชื่อโปรเจกต์ ชื่อ branch และ path ของไฟล์บอกได้ว่าคุณทำงานอะไร ควรตรวจสิ่งที่ client ส่งก่อนเชื่อม repository ที่อ่อนไหว',
    '/early-access':
      'ในทางกลับกัน การลงชื่อไม่ได้ให้บัญชีทันที key จะทยอยส่งให้คนในรายชื่อ คุณจึงอาจต้องรอก่อนเชื่อม editor ได้',
  },
};

export function tradeoffFor(path: string, locale: SiteLocale): string | undefined {
  return TRADEOFFS[locale][path];
}

/** Full guides for English pages that had none. */
export const EN_MORE_GUIDES: Record<string, Guide> = {
  '/ai-cost-tracking': {
    heading: 'What does AI cost tracking tell you, and what can it not?',
    answer:
      'It reports the tokens your coding agents consumed and their estimated cost by project and day. An estimate that cannot be derived is shown as unknown, not as zero.',
    facts: [
      ['Token classes', 'Input, output, cache-read and cache-write tokens are kept apart.'],
      ['Pricing', 'Each provider and model has effective-dated price rows.'],
      ['Privacy', 'Usage events carry identifiers and counts, never prompts or responses.'],
      ['Coverage', 'Tokens and estimated spend each report their own coverage percentage.'],
    ],
    question: 'How should you read a project’s estimated spend?',
    example:
      'Illustrative example, not customer data: a project shows 1,204,300 tokens with 92.4% token coverage and estimated spend with 74.1% coverage. Read the spend as a lower bound for the priced part of the period. The remaining usage has tokens but no price evidence, so it is not added as zero.',
    recommendation:
      'Use cost tracking to compare agents and projects over the same range, and check the priced-token coverage before quoting a total. Your data stays metadata only: prompts are counted locally and only their character count is sent.',
  },
  '/docs/how-coding-time-is-calculated': {
    heading: 'How does AtoAxis turn heartbeats into coding time?',
    answer:
      'Nearby heartbeats become duration blocks. A gap no longer than the 15-minute default idle timeout is bridged; a longer or trailing gap stays outside the total.',
    facts: [
      ['Evidence', 'A heartbeat is an event from a connected editor with metadata and counts.'],
      ['Blocks', 'Overlapping evidence is merged, so two sources never count the same seconds.'],
      ['Idle timeout', 'The default human idle timeout is 15 minutes.'],
      ['Trailing gap', 'Time after the last event is not counted.'],
    ],
    question: 'How do you check a total that looks surprising?',
    example:
      'Illustrative example, not customer data: an interval ends at 09:00 and the next begins at 09:10. The 10-minute gap is bridged. If the next interval had begun at 09:30, the 20-minute gap would stay outside the total, because it is longer than the 15-minute timeout.',
    recommendation:
      'Open the timeline for the day in question and read the interval evidence before assuming a total is wrong. Run wakaclock-cli status first if no heartbeat appears at all, then check the editor connection.',
  },
  '/docs/ai-attribution-and-coverage': {
    heading: 'How should you read AI attribution and coverage together?',
    answer:
      'AtoAxis separates AI, human and Unattributed changes. Coverage reports how much of the change set has evidence, so missing evidence never becomes a confident zero.',
    facts: [
      ['AI evidence', 'An agent name, an is_ai_generated flag and line counts from a hook.'],
      ['Human evidence', 'Editor activity such as keystrokes and characters.'],
      ['Unattributed', 'Changes without enough evidence; not a synonym for human work.'],
      ['Line coverage', 'Attributed lines divided by attributed plus Unattributed lines.'],
    ],
    question: 'How do you compare two agents fairly?',
    example:
      'Illustrative example, not customer data: one agent shows 60% of known lines with 90% coverage, another 60% with 40% coverage. The first figure rests on far more evidence. Compare agents only over the same range, with both hooks installed for the whole period.',
    recommendation:
      'Read the line totals, the coverage status and the denominators before quoting an AI share. Install the supported hook for each agent you use, and treat a gap in coverage as a reason to add instrumentation rather than to guess.',
  },
  '/docs/ai-cost-methodology': {
    heading: 'How does AtoAxis estimate AI cost from token usage?',
    answer:
      'For each reported token class, the count is multiplied by that class’s rate per million tokens at the price in force when the event happened. A missing price leaves the estimate unknown.',
    facts: [
      ['Inputs', 'Provider, model, event time and token counts per class.'],
      ['Arithmetic', 'Count × rate per million tokens ÷ 1,000,000, summed in micro-USD.'],
      ['Price window', 'The row whose effective dates contain the event timestamp.'],
      ['Unknown', 'No matching price row means unknown cost, never zero.'],
    ],
    question: 'Why does a later price change not rewrite older events?',
    example:
      'Illustrative example, not customer data: a model’s price changes on the first of a month. Events from the previous month keep the earlier rate, because the lookup selects the price window that contains each event’s timestamp. Only events after the change use the new rate.',
    recommendation:
      'Compare the token total, the priced-token coverage and the pricing version for the same range before quoting a cost. Treat a low priced coverage as missing price evidence, not as free usage.',
  },
  '/docs/migrate-from-wakatime': {
    heading: 'What does migrating from WakaTime to AtoAxis involve?',
    answer:
      'Keep your WakaTime plugin and change two lines in ~/.wakatime.cfg, api_url and api_key. New coding time then goes to AtoAxis; history comes from a WakaTime export you import.',
    facts: [
      ['Plugin', 'No new plugin; the WakaTime plugin you already use keeps working.'],
      ['Config', 'Two lines in ~/.wakatime.cfg: api_url and api_key.'],
      ['History', 'Export heartbeats from WakaTime, then import the JSON file.'],
      ['Going back', 'Remove api_url and restore your WakaTime key; neither account loses data.'],
    ],
    question: 'How do you validate the migration before relying on it?',
    example:
      'For example, after changing the two lines, code for a few minutes and run wakaclock-cli status, then check that the day appears in the dashboard. Compare a handful of imported days with the same days in your WakaTime export before trusting long-range trends.',
    recommendation:
      'Keep your WakaTime export until you have checked the imported projects and dates. Migrate one machine first, and change the remaining machines once the first one reports as expected.',
  },
};

/** Full guides for Thai pages that had none, written to match the Thai page copy. */
export const TH_MORE_GUIDES: Record<string, Guide> = {
  '/about': {
    heading: 'ใครพัฒนา AtoAxis และตรวจสอบได้อย่างไร?',
    answer:
      'AtoAxis พัฒนาโดย Jitwisut Thobut ผู้ก่อตั้งและนักพัฒนา ร่วมกับ team Atoaxis และไม่เกี่ยวข้องกับผลิตภัณฑ์ชื่อคล้ายกันอย่าง ATOSS, Atto หรือ Axis ERP',
    facts: [
      ['ผู้พัฒนา', 'team Atoaxis ออกแบบ พัฒนา และดูแลบริการ hosted นี้'],
      [
        'สถานะ',
        'Early Access: การรับ heartbeat และ analytics ใช้งานได้ ส่วนการเรียกเก็บเงินและ team seat ยังไม่พร้อม',
      ],
      ['ใช้งานได้แล้ว', 'การรับ heartbeat, analytics ตามโปรเจกต์และภาษา และ AI attribution'],
      ['การตรวจสอบ', 'ตรวจข้อความเกี่ยวกับผลิตภัณฑ์ได้จากเอกสารสาธารณะและช่องทางติดต่อ'],
    ],
    question: 'จะตรวจสอบข้อความบนเว็บไซต์นี้ได้อย่างไร?',
    example:
      'ตัวอย่างเช่น ก่อนเชื่อความสามารถที่หน้า pricing หรือ integrations อธิบายไว้ ให้เปิดคู่มือที่เกี่ยวข้องในเอกสาร หรือถามคำถามเฉพาะผ่านหน้าติดต่อ คู่มือที่มีวันที่และช่องทางติดต่อที่ใช้งานได้ ทำให้ตรวจสอบได้ง่ายกว่าข้อความการตลาด',
    recommendation:
      'ใช้หน้านี้เป็นข้อมูลอ้างอิงว่าใครดูแลบริการและอะไรใช้งานได้จริงในวันนี้ ตรวจรายการที่ยังไม่พร้อมก่อนคิดว่าฟีเจอร์ทีมหรือการเรียกเก็บเงินมีแล้ว และใช้หน้าติดต่อสำหรับคำถามที่หน้านี้ยังไม่ได้ตอบ',
    sources: [
      {
        href: '/contact',
        label: 'หน้าติดต่อ AtoAxis',
        note: 'ช่องทางสำหรับคำถามเกี่ยวกับผลิตภัณฑ์',
      },
      {
        href: PUBLIC_EVIDENCE_URL,
        label: 'เอกสารสาธารณะของ AtoAxis',
        note: 'หลักฐานสำหรับข้อความในหน้านี้',
      },
      { href: '/privacy', label: 'หน้า privacy ของ AtoAxis', note: 'ขอบเขตข้อมูลที่ทีมยึดถือ' },
    ],
  },
  '/contact': {
    heading: 'จะได้คำตอบที่ตรงประเด็นจาก AtoAxis ได้อย่างไร?',
    answer:
      'คนในทีมอ่านอีเมลติดต่อเอง คำถามที่เจาะจงเรื่อง Early Access, editor, AI tracking, privacy หรือการย้ายระบบ จึงได้คำตอบที่เจาะจงกลับไป ไม่ใช่ข้อความอัตโนมัติ',
    facts: [
      ['ช่องทาง', 'อีเมลที่ทีมพัฒนาผลิตภัณฑ์อ่านเอง ไม่ใช่คิว support'],
      [
        'ตอบได้วันนี้',
        'กำหนดการ Early Access, editor ที่รองรับ, hook ของ AI และ field ด้าน privacy',
      ],
      ['ขอบเขต', 'คำถามเกี่ยวกับผลิตภัณฑ์ ส่วน support รายบัญชีต้องมีบัญชีที่ใช้งานอยู่'],
      ['ดูก่อนเขียนมา', 'เอกสารและหน้า privacy ตอบคำถามที่พบบ่อยได้เร็วกว่า'],
    ],
    question: 'ควรใส่อะไรในข้อความของคุณ?',
    example:
      'ตัวอย่างเช่น คำถามว่า “JetBrains WakaTime plugin ใช้กับ AtoAxis ได้ไหม” จะได้คำตอบตรงพร้อม setting ที่ต้องแก้ แต่คำถามว่า “ใช้กับเครื่องของฉันได้ไหม” โดยไม่ระบุ editor จะตอบให้แม่นยำไม่ได้ เพราะวิธีเชื่อมต่อขึ้นกับ client ที่คุณใช้อยู่',
    recommendation:
      'ระบุ editor หัวข้อที่ถาม และสิ่งที่ลองแล้วก่อนส่งข้อความ ถ้าเป็นเรื่องการเชื่อม client ให้อ่านคู่มือเริ่มต้นใช้งานก่อน ซึ่งตอบคำถามการตั้งค่าที่พบบ่อยโดยไม่ต้องรอคำตอบ',
    sources: [
      {
        href: '/docs/getting-started',
        label: 'คู่มือเริ่มต้นใช้งาน AtoAxis',
        note: 'ตอบคำถามการเชื่อมต่อส่วนใหญ่',
      },
      {
        href: '/privacy',
        label: 'หน้า privacy ของ AtoAxis',
        note: 'คำตอบระดับ field สำหรับคำถามเรื่องข้อมูล',
      },
    ],
  },
  '/terms': {
    heading: 'ข้อกำหนดปัจจุบันของ AtoAxis ผูกพันคุณเรื่องอะไรบ้าง?',
    answer:
      'นี่คือข้อกำหนดเบื้องต้นช่วง Early Access การลงชื่อเป็นการแสดงความสนใจเท่านั้น ไม่มีการสร้างบัญชี ไม่มีการเก็บเงิน และไม่มีการรับประกันระดับบริการ',
    facts: [
      ['ลักษณะ', 'ข้อกำหนดเบื้องต้นของเว็บไซต์ช่วง Early Access ไม่ใช่สัญญาบริการแบบชำระเงิน'],
      ['การลงชื่อ', 'ไม่ใช่การซื้อ และไม่สร้างภาระผูกพันกับทั้งสองฝ่าย'],
      ['ความเป็นเจ้าของข้อมูล', 'คุณยังเป็นเจ้าของข้อมูลกิจกรรมที่เครื่องของคุณส่งมา'],
      ['การเปลี่ยนแปลง', 'ฟีเจอร์ที่วางแผนหรือกำลังพัฒนาอาจเปลี่ยนก่อนเปิดตัว'],
    ],
    question: 'ควรมองฟีเจอร์ที่เขียนว่า “วางแผนไว้” หรือ “กำลังพัฒนา” อย่างไร?',
    example:
      'ตัวอย่างเช่น ฟีเจอร์ที่หน้า about ระบุว่ากำลังพัฒนา ไม่ได้ถูกรับรองโดยข้อกำหนดนี้ว่าส่งมอบแล้ว แม้จะถูกกล่าวถึง ให้มองคำว่าวางแผนไว้เป็นแผนงาน ไม่ใช่คำมั่นพร้อมวันส่งมอบ และอ่านข้อกำหนดอีกครั้งเมื่อเปิด checkout จริง',
    recommendation:
      'อ่านส่วนการใช้งานที่ยอมรับได้ก่อนส่งกิจกรรมจากระบบอัตโนมัติหรือบัญชีที่ใช้ร่วมกัน เพราะ API key หนึ่งตัวระบุบัญชีหนึ่งบัญชี ถ้าข้อใดไม่ชัดเจน ให้ติดต่อทีมแทนการคาดเดา',
    sources: [
      {
        href: '/privacy',
        label: 'หน้า privacy ของ AtoAxis',
        note: 'ข้อผูกพันด้านข้อมูลที่ข้อกำหนดนี้อ้างถึง',
      },
      { href: '/contact', label: 'หน้าติดต่อ AtoAxis', note: 'ช่องทางสอบถามข้อกำหนดเฉพาะข้อ' },
    ],
  },
  '/privacy': {
    heading: 'heartbeat ของ AtoAxis มีข้อมูลอะไรบ้าง?',
    answer:
      'heartbeat มี metadata ของไฟล์ โปรเจกต์ branch ภาษา และ editor พร้อมตัวเลขนับกิจกรรม และไม่เคยมี source code, diff, prompt หรือคำตอบจาก AI, รหัสผ่าน หรือภาพหน้าจอ',
    facts: [
      [
        'สิ่งที่เก็บ',
        'path ของไฟล์ โปรเจกต์ branch ภาษา editor ระบบปฏิบัติการ และจำนวน keystroke/character',
      ],
      [
        'สิ่งที่ไม่เก็บ',
        'source code, diff, ข้อความ prompt หรือคำตอบจาก AI, รหัสผ่าน และภาพหน้าจอ',
      ],
      ['การส่งข้อมูล', 'editor ส่งกิจกรรมให้ CLI ในเครื่อง และมีเพียง CLI ที่ส่ง HTTPS request'],
      ['การเก็บรักษา', 'เก็บไว้ระหว่างที่บัญชีใช้งาน และขอลบได้ทางอีเมล'],
    ],
    question: 'จะตรวจขอบเขต privacy ด้วยตัวเองได้อย่างไร?',
    example:
      'ตัวอย่างเช่น เปิด log ของ CLI แล้วดูว่ามันส่งอะไรออกไปทางเครือข่ายจริง จากนั้นเทียบกับรายการ field ในคู่มือ privacy ขอบเขตที่ระบุไว้คือ metadata และตัวเลขนับ โดยไม่มี field สำหรับเนื้อหาไฟล์หรือข้อความจาก AI',
    recommendation:
      'อ่านหัวข้อสิ่งที่ไม่เก็บก่อนเชื่อมโปรเจกต์ที่อ่อนไหว และขอลบข้อมูลทางอีเมลเมื่อเลิกใช้บริการ การยกเลิก API key จะหยุดข้อมูลใหม่ทันที แต่ไม่ลบประวัติที่เก็บไว้แล้ว',
  },
  '/early-access': {
    heading: 'เกิดอะไรขึ้นเมื่อคุณเข้าร่วม Early Access ของ AtoAxis?',
    answer:
      'การลงชื่อคือการแสดงความสนใจและรับข่าวการเปิดตัว ไม่ใช่การซื้อ ไม่มีการเก็บข้อมูลการชำระเงิน และไม่มีการเริ่ม subscription',
    facts: [
      ['สิ่งที่เกิดขึ้น', 'ชื่อคุณจะอยู่ในรายชื่อ Early Access และได้รับอีเมลข่าวการเปิดตัว'],
      ['สิ่งที่ไม่เกิดขึ้น', 'ไม่เก็บข้อมูลการชำระเงิน และไม่เริ่ม trial หรือ subscription'],
      ['การออก key', 'key จะส่งให้คนในรายชื่อ ไม่ได้ออกให้อัตโนมัติตอนลงชื่อ'],
      [
        'ราคาที่วางแผนไว้',
        `$${PRICING.monthlyUsd}/เดือน หรือ $${PRICING.annualUsd}/ปี เมื่อเปิด checkout`,
      ],
    ],
    question: 'การเข้าร่วม Early Access ต่างจากการสมัครใช้งานทั่วไปอย่างไร?',
    example:
      'ตัวอย่างเช่น การสมัครผลิตภัณฑ์ที่เปิดใช้แล้วมักสร้างบัญชีที่ login ได้ทันที แต่การลงชื่อนี้ไม่ทำทั้งสองอย่าง ยังเข้า dashboard ไม่ได้จนกว่าจะได้ key และไม่มีการเรียกเก็บเงินในขั้นตอนใดเลย',
    recommendation:
      'ลงชื่อถ้าต้องการรับแจ้งเมื่อมีการส่ง key และเมื่อราคาสรุปแล้ว อ่านหน้า pricing สำหรับราคาที่วางแผนไว้ และหน้าข้อกำหนดเพื่อเข้าใจความหมายของคำว่าวางแผนไว้ ก่อนคาดหวังวันเปิดตัว',
    sources: [
      { href: '/pricing', label: 'หน้าราคาของ AtoAxis', note: 'ราคารายเดือนและรายปีที่วางแผนไว้' },
      { href: '/terms', label: 'ข้อกำหนดของ AtoAxis', note: 'สิ่งที่การลงชื่อผูกพันและไม่ผูกพัน' },
    ],
  },
  '/docs/getting-started': {
    heading: 'ต้องมีอะไรบ้างก่อน heartbeat แรกของ AtoAxis?',
    answer:
      'ต้องมีสามอย่าง คือ editor ที่ส่งข้อมูลมาได้, wakaclock-cli สำหรับส่ง heartbeat และ API key ที่ระบุบัญชีของคุณ',
    facts: [
      ['Editor', 'VS Code 1.90 ขึ้นไปพร้อม extension ของเรา หรือ editor ที่รองรับ WakaTime'],
      ['CLI', 'wakaclock-cli อยู่ใน PATH หรือกำหนด path เต็มใน setting wakaclock.cliPath'],
      ['API key', 'สร้างจาก dashboard เมื่อได้สิทธิ์ Early Access'],
      ['ตอนออฟไลน์', 'heartbeat ที่ยังส่งไม่ได้จะรอใน ~/.wakaclock/queue.db แล้วส่งใหม่ภายหลัง'],
    ],
    question: 'จะยืนยันได้อย่างไรว่า heartbeat แรกมาถึงจริง?',
    example:
      'ตัวอย่างเช่น รัน wakaclock-cli status เพื่อตรวจว่าเข้าถึง server ได้และ key ถูกต้อง แล้วรัน wakaclock-cli today เพื่อดูยอดที่ server นับไว้ ทั้งสองคำสั่งไม่อ่านไฟล์ในเครื่อง แต่ถาม server ว่าบันทึกอะไรไว้จริง',
    recommendation:
      'เวลาแก้ปัญหา ให้เปลี่ยนทีละ setting คือ ตรวจ URL ของ server ก่อน แล้วจึงตรวจ path ของ CLI และ key ถ้าใช้ VS Code ให้อ่านคู่มือ VS Code ต่อ หรืออ่านหน้า integrations สำหรับ client อื่นที่รองรับ WakaTime',
  },
  '/integrations/vscode': {
    heading: 'extension ของ AtoAxis สำหรับ VS Code ส่งอะไรบ้าง?',
    answer:
      'ส่ง metadata ของไฟล์ โปรเจกต์ branch ภาษา และ editor พร้อมกิจกรรมการ save, debug, build และจำนวน keystroke ผ่าน wakaclock-cli โดยไม่ส่งเนื้อหาไฟล์',
    facts: [
      ['ข้อกำหนด', 'VS Code 1.90 ขึ้นไป และ wakaclock-cli ใน PATH หรือ path ที่ตั้งไว้'],
      ['การเก็บ key', 'เก็บใน secret storage ของ VS Code ผ่านคำสั่ง ไม่อยู่ใน settings.json'],
      ['ข้อมูลที่ส่ง', 'metadata ของไฟล์ โปรเจกต์ branch ภาษา editor และตัวเลขนับกิจกรรม'],
      ['ข้อจำกัด', 'เฉพาะกิจกรรมในไฟล์ ไม่มี heartbeat ของแอป โดเมน หรือ URL'],
    ],
    question: 'จะตรวจได้อย่างไรว่า extension รายงานถูกต้องหลังติดตั้ง?',
    example:
      'ตัวอย่างเช่น พิมพ์ในไฟล์ แล้วดู status bar ของ VS Code ซึ่งควรแสดงยอดวันนี้และรีเฟรชประมาณทุก 15 วินาที ถ้ายังเป็นศูนย์ แปลว่า extension หา wakaclock-cli ไม่เจอ ให้ใช้คำสั่ง AtoAxis: Configure CLI Path แทนการติดตั้ง extension ใหม่',
    recommendation:
      'ตั้ง wakaclock.cliPath ให้ชัดเจนถ้า binary ไม่อยู่ใน PATH ก่อนสรุปว่า extension เสีย และใช้คำสั่ง AtoAxis: Send Heartbeat Now เพื่อส่งกิจกรรมที่รอไว้ทันทีเมื่อต้องการตรวจผล',
  },
  '/ai-cost-tracking': {
    heading: 'การติดตามค่าใช้จ่าย AI บอกอะไรได้ และบอกอะไรไม่ได้?',
    answer:
      'ระบบรายงาน token ที่ agent ใช้และค่าใช้จ่ายโดยประมาณ แยกตามโปรเจกต์และวัน ถ้าคำนวณไม่ได้จะแสดงว่าไม่ทราบ ไม่ใช่ศูนย์',
    facts: [
      ['ประเภท token', 'แยก input, output, cache-read และ cache-write ออกจากกัน'],
      ['ราคา', 'provider และ model แต่ละคู่มีราคาตามช่วงวันที่มีผล'],
      ['Privacy', 'usage event มีเพียง identifier และตัวเลข ไม่มี prompt หรือคำตอบ'],
      ['Coverage', 'token และค่าใช้จ่ายโดยประมาณมี coverage ของตัวเอง'],
    ],
    question: 'ควรอ่านค่าใช้จ่ายโดยประมาณของโปรเจกต์อย่างไร?',
    example:
      'ตัวอย่างสมมติ ไม่ใช่ข้อมูลลูกค้า: โปรเจกต์หนึ่งมี 1,204,300 token โดย token coverage 92.4% และค่าใช้จ่ายมี coverage 74.1% ให้อ่านค่าใช้จ่ายเป็นขั้นต่ำของส่วนที่มีราคา ส่วนที่เหลือมี token แต่ไม่มีหลักฐานราคา จึงไม่ถูกบวกเป็นศูนย์',
    recommendation:
      'ใช้ข้อมูลนี้เทียบ agent และโปรเจกต์ในช่วงเวลาเดียวกัน และตรวจ coverage ของ token ที่มีราคาก่อนอ้างยอดรวม prompt ถูกนับในเครื่องและส่งเพียงจำนวนตัวอักษรเท่านั้น',
  },
  '/docs/how-coding-time-is-calculated': {
    heading: 'AtoAxis เปลี่ยน heartbeat เป็นเวลาเขียนโค้ดอย่างไร?',
    answer:
      'heartbeat ที่อยู่ใกล้กันจะรวมเป็น duration block ช่วงว่างที่ไม่เกิน idle timeout ค่าเริ่มต้น 15 นาทีจะถูกเชื่อม ส่วนช่วงว่างที่ยาวกว่าหรือช่วงท้ายจะไม่ถูกนับ',
    facts: [
      ['หลักฐาน', 'heartbeat คือ event จาก editor ที่เชื่อมต่อ พร้อม metadata และตัวเลขนับ'],
      ['Block', 'หลักฐานที่ซ้อนกันจะถูกรวม ทำให้สองแหล่งไม่นับวินาทีเดียวกันซ้ำ'],
      ['Idle timeout', 'ค่าเริ่มต้นสำหรับคนคือ 15 นาที'],
      ['ช่วงท้าย', 'เวลาหลัง event สุดท้ายไม่ถูกนับ'],
    ],
    question: 'จะตรวจยอดที่ดูแปลกได้อย่างไร?',
    example:
      'ตัวอย่างสมมติ ไม่ใช่ข้อมูลลูกค้า: ช่วงหนึ่งจบเวลา 09:00 และช่วงถัดไปเริ่ม 09:10 ช่วงว่าง 10 นาทีจะถูกเชื่อม แต่ถ้าช่วงถัดไปเริ่ม 09:30 ช่วงว่าง 20 นาทีจะไม่ถูกนับ เพราะยาวกว่า timeout 15 นาที',
    recommendation:
      'เปิด timeline ของวันนั้นและอ่านหลักฐานของแต่ละช่วงก่อนสรุปว่ายอดผิด ถ้าไม่มี heartbeat เลย ให้รัน wakaclock-cli status ก่อน แล้วจึงตรวจการเชื่อม editor',
  },
  '/docs/ai-attribution-and-coverage': {
    heading: 'ควรอ่าน AI attribution กับ coverage คู่กันอย่างไร?',
    answer:
      'AtoAxis แยกการเปลี่ยนแปลงเป็น AI, human และ Unattributed โดย coverage บอกว่ามีหลักฐานมากแค่ไหน หลักฐานที่ขาดหายจึงไม่กลายเป็นศูนย์อย่างมั่นใจเกินจริง',
    facts: [
      ['หลักฐานของ AI', 'ชื่อ agent, flag is_ai_generated และจำนวนบรรทัดจาก hook'],
      ['หลักฐานของคน', 'กิจกรรมใน editor เช่น keystroke และ character'],
      ['Unattributed', 'การเปลี่ยนแปลงที่หลักฐานไม่พอ ไม่ได้แปลว่าเป็นงานของคน'],
      ['Line coverage', 'บรรทัดที่ระบุที่มาได้ หารด้วยบรรทัดที่ระบุได้รวมกับ Unattributed'],
    ],
    question: 'จะเทียบ agent สองตัวให้เป็นธรรมได้อย่างไร?',
    example:
      'ตัวอย่างสมมติ ไม่ใช่ข้อมูลลูกค้า: agent ตัวแรกมีสัดส่วน 60% ของบรรทัดที่รู้ที่มา โดย coverage 90% อีกตัวก็ 60% แต่ coverage 40% ตัวเลขแรกมีหลักฐานรองรับมากกว่ามาก ควรเทียบในช่วงเวลาเดียวกันและติดตั้ง hook ของทั้งสองตัวตลอดช่วงนั้น',
    recommendation:
      'อ่านยอดบรรทัด สถานะ coverage และตัวหารก่อนอ้างสัดส่วน AI ติดตั้ง hook ที่รองรับสำหรับทุก agent ที่ใช้ และมอง coverage ที่ขาดเป็นเหตุผลให้เพิ่มการวัด แทนการเดา',
  },
  '/docs/ai-cost-methodology': {
    heading: 'AtoAxis ประมาณค่าใช้จ่าย AI จาก token อย่างไร?',
    answer:
      'แต่ละประเภท token ที่รายงานมา จะถูกคูณด้วยราคาต่อล้าน token ของประเภทนั้น ตามราคาที่มีผลในเวลาที่ event เกิด ถ้าไม่มีราคา ค่าใช้จ่ายจะเป็นไม่ทราบ',
    facts: [
      ['ข้อมูลตั้งต้น', 'provider, model, เวลาของ event และจำนวน token แต่ละประเภท'],
      ['การคำนวณ', 'จำนวน × ราคาต่อล้าน token ÷ 1,000,000 แล้วรวมเป็น micro-USD'],
      ['ช่วงราคา', 'แถวราคาที่ช่วงวันที่มีผลครอบ timestamp ของ event'],
      ['ไม่ทราบ', 'ถ้าไม่มีแถวราคาที่ตรง ค่าใช้จ่ายจะเป็นไม่ทราบ ไม่ใช่ศูนย์'],
    ],
    question: 'ทำไมการเปลี่ยนราคาภายหลังจึงไม่แก้ event เก่า?',
    example:
      'ตัวอย่างสมมติ ไม่ใช่ข้อมูลลูกค้า: ราคาของ model หนึ่งเปลี่ยนในวันที่ 1 ของเดือน event ของเดือนก่อนยังใช้ราคาเดิม เพราะระบบเลือกช่วงราคาที่ครอบ timestamp ของแต่ละ event มีเพียง event หลังการเปลี่ยนที่ใช้ราคาใหม่',
    recommendation:
      'เทียบยอด token, coverage ของ token ที่มีราคา และเวอร์ชันราคาในช่วงเดียวกันก่อนอ้างค่าใช้จ่าย และมอง coverage ราคาที่ต่ำว่าเป็นหลักฐานราคาที่ขาด ไม่ใช่การใช้งานฟรี',
  },
  '/docs/migrate-from-wakatime': {
    heading: 'การย้ายจาก WakaTime มา AtoAxis ต้องทำอะไรบ้าง?',
    answer:
      'ใช้ WakaTime plugin เดิมได้ แค่แก้สองบรรทัดใน ~/.wakatime.cfg คือ api_url และ api_key เวลาเขียนโค้ดใหม่จะเข้ามาที่ AtoAxis ส่วนประวัติมาจากไฟล์ export ของ WakaTime ที่คุณ import',
    facts: [
      ['Plugin', 'ไม่ต้องติดตั้งใหม่ WakaTime plugin ที่ใช้อยู่ทำงานต่อได้'],
      ['การตั้งค่า', 'สองบรรทัดใน ~/.wakatime.cfg คือ api_url และ api_key'],
      ['ประวัติ', 'export heartbeat จาก WakaTime แล้ว import ไฟล์ JSON'],
      ['ย้ายกลับ', 'ลบ api_url แล้วใส่ key ของ WakaTime กลับ ข้อมูลทั้งสองบัญชีไม่หาย'],
    ],
    question: 'จะตรวจการย้ายระบบอย่างไรก่อนใช้งานจริง?',
    example:
      'ตัวอย่างเช่น หลังแก้สองบรรทัด ให้เขียนโค้ดสักครู่แล้วรัน wakaclock-cli status จากนั้นดูว่าวันนั้นขึ้นใน dashboard แล้ว เทียบวันที่ import มาสักสองสามวันกับวันเดียวกันในไฟล์ export ของ WakaTime ก่อนเชื่อแนวโน้มระยะยาว',
    recommendation:
      'เก็บไฟล์ export ของ WakaTime ไว้จนกว่าจะตรวจโปรเจกต์และวันที่ที่ import มาแล้ว ย้ายเครื่องแรกก่อน แล้วค่อยเปลี่ยนเครื่องที่เหลือเมื่อเครื่องแรกรายงานถูกต้อง',
  },
};
