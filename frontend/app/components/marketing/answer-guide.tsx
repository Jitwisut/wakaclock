/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The overflow table region must be keyboard-scrollable. */
import Link from 'next/link';

import {
  contentModified,
  localizedPath,
  PRICING,
  SITE_MODIFIED,
  type SiteLocale,
  SOURCE_REPOSITORY_URL,
} from '@/lib/seo/site';

const WAKATIME_DEVELOPER_URL = 'https://wakatime.com/developers';

type GuideSource = {
  href: string;
  label: string;
  note: string;
};

type GuideTable = {
  caption: string;
  columns: readonly [string, string, string];
  rows: readonly (readonly [string, string, string])[];
};

type Guide = {
  answer: string;
  example: string;
  facts: readonly (readonly [string, string])[];
  heading: string;
  question: string;
  recommendation: string;
  sources?: readonly GuideSource[];
  table?: GuideTable;
};

const DEFAULT_TABLE: GuideTable = {
  caption: 'How to read coding activity metrics',
  columns: ['Signal', 'What it supports', 'What it cannot prove'],
  rows: [
    ['Editor heartbeats', 'Recorded coding activity', 'All working time'],
    ['Attributed changes', 'Reported source of changes', 'Code quality or time saved'],
  ],
};

const DEFAULT_SOURCES: readonly GuideSource[] = [
  {
    href: SOURCE_REPOSITORY_URL,
    label: 'AtoAxis implementation',
    note: 'product behavior and data handling',
  },
  {
    href: '/docs/getting-started',
    label: 'AtoAxis setup documentation',
    note: 'account and editor configuration',
  },
  {
    href: WAKATIME_DEVELOPER_URL,
    label: 'WakaTime API documentation',
    note: 'editor heartbeats and the compatibility protocol',
  },
  {
    href: 'https://dora.dev/guides/dora-metrics/',
    label: 'DORA software delivery metrics',
    note: 'delivery outcomes, a separate perspective from editor activity',
  },
];

const GUIDES: Record<string, Guide> = {
  '/': {
    heading: 'What should you know about AtoAxis?',
    answer:
      'AtoAxis tracks coding activity from editor heartbeats, with project analytics and explicit AI attribution.',
    facts: [
      ['Product', 'Hosted developer time tracking and coding analytics.'],
      ['Availability', 'Early Access; checkout is not enabled.'],
      ['History', 'Complete coding history is included on every account.'],
      ['Privacy', 'Heartbeat payloads contain activity metadata, not source code or AI prompts.'],
    ],
    question: 'How can you use coding activity data?',
    example:
      'For example, a developer can compare time spent across two projects during the same week. Project and language breakdowns describe recorded editor activity. Review them alongside completed work and time spent planning, reviewing or helping colleagues. Those activities can matter even when they produce no editor heartbeat.',
    recommendation:
      'Start with one editor and check that its project and language data match your work. Use the setup guide to connect your client, then review attribution coverage before interpreting AI totals. Coding duration is a record of observed activity; it is not a measure of code quality or individual value.',
  },
  '/wakatime-alternative': {
    heading: 'How do you choose a WakaTime alternative?',
    answer:
      'Compare editor compatibility, history access, migration support and attribution coverage before changing your coding time tracker.',
    facts: [
      ['Compatibility', 'AtoAxis implements the WakaTime API for compatible editor clients.'],
      [
        'Migration',
        'Import a WakaTime data export; check imported results before relying on comparisons.',
      ],
      ['History access', 'Complete coding history is included on every account.'],
      ['Availability', 'Early Access; planned pricing is not an active checkout offer.'],
    ],
    question: 'How should you evaluate a migration?',
    example:
      'For example, connect one editor and review a small set of known projects before moving your regular workflow. Check language labels, project names and date ranges against the activity you expect. An import is a way to carry historical records forward; it does not create AI attribution evidence that the original records never contained.',
    recommendation:
      'Choose based on the records you need to inspect and the clients you actually use. Keep your export while validating the migration. An established service may suit you better if you need a mature team administration workflow today. AtoAxis team and organisation features remain in development.',
  },
  '/ai-coding-tracker': {
    heading: 'What does an AI coding tracker measure?',
    answer:
      'An AI coding tracker records attributed code changes and agent activity. Missing evidence should remain visible as unattributed work.',
    facts: [
      ['AI attribution', 'A hook or client identifies the agent associated with a change.'],
      [
        'Human activity',
        'Editor-observed keystrokes and characters provide human activity signals.',
      ],
      ['Unattributed changes', 'Changes without sufficient evidence remain a separate category.'],
      [
        'Coverage',
        'Review attribution coverage alongside AI totals; missing evidence is not proof of human authorship.',
      ],
    ],
    question: 'How should you interpret an AI contribution report?',
    example:
      'Illustrative example, not customer data: a change set contains 100 added lines. Evidence attributes 40 to an AI tool, 35 to human activity and leaves 25 unattributed. Report all three categories. Treating the 25 unknown lines as human would hide missing coverage. These example counts explain interpretation; they are not a product benchmark or a productivity claim.',
    recommendation:
      'Use attribution to understand your workflow and to find gaps in instrumentation. Check supported hooks before comparing agents. Line counts describe changes, including changes that may later be edited or deleted. They do not establish correctness, maintainability, time saved or the business value of generated code.',
  },
  '/developer-analytics': {
    heading: 'What can developer analytics tell you?',
    answer:
      'Developer analytics explains recorded coding time by project, language, editor and branch. Activity alone does not measure productivity.',
    facts: [
      ['Coding time', 'Duration derived from editor heartbeats, with inactive gaps excluded.'],
      [
        'Project breakdown',
        'Recorded activity grouped by the project metadata sent by your client.',
      ],
      ['AI activity', 'Agent attribution and coverage provide context for observed changes.'],
      ['Interpretation', 'Use delivery outcomes and review context alongside activity metrics.'],
    ],
    question: 'How do you compare two weeks fairly?',
    example:
      'For example, fewer coding hours in a release week may reflect more review, testing or coordination. Compare the same date range and check that the same editors reported activity. Then ask what changed in the work. A rise in recorded time can reflect better tracking coverage rather than more effort or better outcomes.',
    recommendation:
      'Use coding metrics to investigate patterns in your own workflow. Keep editor activity distinct from software delivery performance. DORA studies delivery outcomes, while AtoAxis records coding activity. The two perspectives answer different questions; neither should become a standalone ranking of individual developers.',
  },
  '/teams': {
    heading: 'Is team coding presence available today?',
    answer:
      'AtoAxis team presence is an Early Access prototype. Organisation seats, team administration and billing are still in development.',
    facts: [
      [
        'Current scope',
        'Prototype rooms, invites and co-working sessions where the server enables them.',
      ],
      ['Presence states', 'Working, idle and offline reflect editor heartbeat activity.'],
      ['Participation', 'Presence is opt-in; participants can see who is in the room.'],
      [
        'Limitations',
        'Do not plan a production rollout around unfinished organisation and seat management.',
      ],
    ],
    question: 'When is a coding presence room useful?',
    example:
      'For example, two colleagues can use an enabled prototype room to coordinate a shared coding session. A working state indicates editor activity, not permission to interrupt. An idle state can mean someone is reviewing a design or discussing a problem. Agree on communication expectations before treating presence as an availability signal.',
    recommendation:
      'Evaluate the prototype with voluntary participants and clear expectations. Use chat or a direct conversation to confirm availability. Teams that require established administration, permissions and billing should wait for those capabilities. Presence and coding duration are context for collaboration, not evidence of an employee’s performance.',
  },
  '/pricing': {
    heading: 'What does AtoAxis developer time tracking cost?',
    answer: `Planned launch pricing is $${PRICING.monthlyUsd} per month or $${PRICING.annualUsd} per year. Checkout is closed during Early Access, so joining the list creates no charge.`,
    facts: [
      ['Monthly plan', `$${PRICING.monthlyUsd} per month when checkout opens.`],
      ['Annual plan', `$${PRICING.annualUsd} per year when checkout opens.`],
      ['Current charge', 'None. Early Access registration is not a purchase.'],
      ['Included history', 'The planned plan includes complete coding history.'],
    ],
    question: 'How should you compare the monthly and annual options?',
    example: `At the planned prices, 12 monthly payments total $${PRICING.monthlyUsd * 12}. The annual option totals $${PRICING.annualUsd}, which is $${PRICING.monthlyUsd * 12 - PRICING.annualUsd} less over one year. This arithmetic explains the displayed options; it is not a live offer, customer result or guarantee that pricing will remain unchanged before checkout opens.`,
    recommendation:
      'Choose a billing period only after checkout opens and final terms are visible. Use the monthly option when flexibility matters more than the planned annual saving. Use the annual option only when you expect to keep the service for a full year. Join Early Access for launch updates; you are not entering a paid subscription now.',
    sources: [
      {
        href: '/early-access',
        label: 'AtoAxis Early Access status',
        note: 'current availability and signup terms',
      },
      {
        href: SOURCE_REPOSITORY_URL,
        label: 'AtoAxis implementation',
        note: 'features currently represented in the product',
      },
      {
        href: 'https://wakatime.com/pricing',
        label: 'WakaTime pricing',
        note: 'a primary source for visitors making a service comparison',
      },
    ],
    table: {
      caption: 'Planned AtoAxis billing options',
      columns: ['Option', 'Planned total', 'Current availability'],
      rows: [
        ['Monthly', `$${PRICING.monthlyUsd} per month`, 'Checkout closed'],
        ['Annual', `$${PRICING.annualUsd} per year`, 'Checkout closed'],
      ],
    },
  },
  '/integrations': {
    heading: 'Which developer tools connect to AtoAxis?',
    answer:
      'AtoAxis connects through its first-party VS Code extension, WakaTime-compatible editor plugins and bundled hooks for supported AI coding agents.',
    facts: [
      ['First-party editor', 'VS Code connects through the AtoAxis extension and wakaclock-cli.'],
      ['Compatible editors', 'Existing WakaTime plugins can point at the hosted heartbeat API.'],
      ['Bundled AI hooks', 'Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI.'],
      ['Data boundary', 'Clients send activity metadata and counts, not source-code contents.'],
    ],
    question: 'How do you choose the correct integration path?',
    example:
      'If you use VS Code, start with the first-party extension because it exposes AtoAxis settings and sends activity through the CLI. If you use JetBrains, Neovim or Vim with an existing WakaTime plugin, keep that plugin and change its API URL and key. If you need AI attribution, install the matching agent hook and verify coverage before comparing totals.',
    recommendation:
      'Connect one tool first and confirm that a known project appears in the dashboard. Add other editors only after the first heartbeat is correct. A compatible plugin controls the fields it sends, so unsupported metadata stays empty. Cursor and Copilot still need provider-specific adapters and should not be treated as attributed sources today.',
    sources: [
      {
        href: '/integrations/vscode',
        label: 'AtoAxis VS Code integration guide',
        note: 'extension settings, commands and limitations',
      },
      {
        href: WAKATIME_DEVELOPER_URL,
        label: 'WakaTime API documentation',
        note: 'the heartbeat protocol used by compatible plugins',
      },
      {
        href: SOURCE_REPOSITORY_URL,
        label: 'AtoAxis integration source',
        note: 'the shipped clients and hook implementations',
      },
    ],
    table: {
      caption: 'AtoAxis connection paths',
      columns: ['Tool', 'Connection path', 'Important limit'],
      rows: [
        ['VS Code', 'First-party extension and CLI', 'File activity only'],
        [
          'WakaTime-compatible editor',
          'Existing plugin and API URL',
          'Plugin decides which fields arrive',
        ],
        ['Supported AI agent', 'Bundled hook', 'Coverage depends on captured events'],
      ],
    },
  },
  '/docs': {
    heading: 'What does the AtoAxis documentation cover?',
    answer:
      'The documentation explains how to connect an editor, verify the first heartbeat, understand integrations and review exactly which activity metadata reaches the service.',
    facts: [
      ['Getting started', 'Create a key, connect an editor and verify recorded activity.'],
      ['Integrations', 'Choose the VS Code extension or a WakaTime-compatible plugin.'],
      ['AI attribution', 'Understand supported hooks, coverage and unattributed changes.'],
      ['Privacy', 'Review heartbeat fields and the content that clients never send.'],
    ],
    question: 'Where should a new developer start?',
    example:
      'Start with the getting-started guide and connect one editor. Generate an API key only when Early Access provides access, then send a heartbeat and check the dashboard before adding more clients. Next, read the integration page for your editor and the privacy page for the payload boundary. Use the AI tracker guide only if you need agent attribution.',
    recommendation:
      'Follow the setup pages in order and keep your API key out of source control. If a heartbeat does not appear, verify the server URL, key and CLI path before changing multiple settings. Use the product source when you need implementation-level evidence. Use the WakaTime documentation when you need details about the compatibility protocol.',
    sources: [
      {
        href: '/docs/getting-started',
        label: 'Getting started with AtoAxis',
        note: 'the complete first-heartbeat workflow',
      },
      {
        href: WAKATIME_DEVELOPER_URL,
        label: 'WakaTime API documentation',
        note: 'the protocol used by compatible editor plugins',
      },
      {
        href: SOURCE_REPOSITORY_URL,
        label: 'AtoAxis source repository',
        note: 'implementation details for the documented behavior',
      },
    ],
    table: {
      caption: 'Choose an AtoAxis documentation guide',
      columns: ['Goal', 'Read next', 'Expected result'],
      rows: [
        ['Record activity', 'Getting started', 'A verified heartbeat'],
        ['Connect a tool', 'Integrations', 'The correct client path'],
        ['Review data', 'Privacy', 'A clear payload boundary'],
      ],
    },
  },
};

const THAI_HOME_GUIDE: Guide = {
  heading: 'เครื่องมือติดตามเวลาเขียนโค้ดช่วยคุณตอบคำถามอะไรได้บ้าง?',
  answer:
    'บริการนี้เปลี่ยน heartbeat จาก editor ให้เป็นภาพรวมเวลา โปรเจกต์ ภาษา branch และที่มาของการเปลี่ยนแปลงโค้ด โดยไม่ส่งเนื้อหา source code ไปยังเซิร์ฟเวอร์',
  facts: [
    ['ข้อมูลตั้งต้น', 'heartbeat ที่มี metadata ของไฟล์ โปรเจกต์ ภาษา editor และเวลา'],
    ['ผลลัพธ์', 'dashboard เวลาเขียนโค้ดพร้อมตัวกรองและประวัติครบถ้วน'],
    ['AI attribution', 'แยก AI, human และ Unattributed พร้อมรายงาน coverage'],
    ['สถานะบริการ', 'อยู่ในช่วง Early Access และยังไม่เปิด checkout'],
  ],
  question: 'ควรอ่านตัวเลขใน dashboard อย่างไร?',
  example:
    'ตัวอย่างสมมติที่ไม่ใช่ข้อมูลลูกค้า: หากระบบบันทึกกิจกรรมได้ 5 ชั่วโมงในหนึ่งวัน ตัวเลขนั้นหมายถึงช่วงที่ heartbeat ต่อเนื่องกันตามกติกาการคำนวณ ไม่ได้หมายความว่าคุณทำงานทั้งหมดเพียง 5 ชั่วโมง เวลาประชุม อ่านเอกสาร หรือคิดแก้ปัญหาอาจไม่มี heartbeat ควรดูโปรเจกต์ ภาษา และ coverage ประกอบก่อนสรุปผล',
  recommendation:
    'เริ่มจากเชื่อม editor เพียงตัวเดียว แล้วตรวจว่าโปรเจกต์และภาษาตรงกับงานของคุณหรือไม่ จากนั้นจึงเพิ่ม AI hook หรือ editor อื่น ใช้ข้อมูลเพื่อมองหารูปแบบการทำงานของตัวเอง ไม่ควรใช้เวลาที่บันทึกได้หรือจำนวนบรรทัดเป็นคะแนนคุณภาพหรือเครื่องมือจัดอันดับคนในทีม',
  sources: [
    {
      href: '/docs/getting-started',
      label: 'คู่มือเริ่มต้นใช้งาน',
      note: 'ขั้นตอนเชื่อม editor และตรวจ heartbeat แรก',
    },
    {
      href: WAKATIME_DEVELOPER_URL,
      label: 'เอกสาร WakaTime API',
      note: 'ที่มาของรูปแบบ heartbeat ที่รองรับ',
    },
    {
      href: SOURCE_REPOSITORY_URL,
      label: 'ซอร์สโค้ดผลิตภัณฑ์',
      note: 'หลักฐานการทำงานและขอบเขตข้อมูลของระบบ',
    },
  ],
  table: {
    caption: 'วิธีตีความข้อมูลกิจกรรมการเขียนโค้ด',
    columns: ['สัญญาณ', 'ช่วยให้เข้าใจ', 'ไม่สามารถยืนยัน'],
    rows: [
      ['Editor heartbeat', 'กิจกรรมที่ระบบบันทึกได้', 'เวลาทำงานทั้งหมด'],
      [
        'Attributed changes',
        'ที่มาของการเปลี่ยนแปลงที่มีหลักฐาน',
        'คุณภาพโค้ดหรือเวลาที่ประหยัดได้',
      ],
    ],
  },
};

export function hasAnswerGuide(path: string, locale: SiteLocale): boolean {
  return locale === 'th' ? path === '/' : Boolean(GUIDES[path]);
}

export function AnswerGuide({ locale = 'en', path }: { locale?: SiteLocale; path: string }) {
  const guide = locale === 'th' && path === '/' ? THAI_HOME_GUIDE : GUIDES[path];
  if (!guide) return null;
  const sources = guide.sources ?? DEFAULT_SOURCES;
  const table = guide.table ?? DEFAULT_TABLE;
  const reviewDate = contentModified(path, locale) ?? SITE_MODIFIED;
  return (
    <section
      aria-labelledby="answer-guide-title"
      className="mx-auto my-16 max-w-4xl px-4 md:px-6"
      id="answer-guide"
    >
      <h2 className="text-2xl font-semibold tracking-tight" id="answer-guide-title">
        {guide.heading}
      </h2>
      <p className="mt-4 text-lg">{guide.answer}</p>
      <h3 className="mt-8 text-lg font-semibold">
        {locale === 'th' ? 'สรุปสาระสำคัญ (Key takeaways)' : 'Key takeaways'}
      </h3>
      <dl className="mt-4 divide-y divide-current/15">
        {guide.facts.map(([term, definition]) => (
          <div className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr]" key={term}>
            <dt className="font-semibold">{term}:</dt>
            <dd>{definition}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-8 text-lg font-semibold">{guide.question}</h3>
      <p className="mt-3 leading-relaxed">{guide.example}</p>
      {/* Keyboard users need to scroll this comparison on narrow screens. */}
      <figure className="mt-6">
        <div aria-label={table.caption} className="overflow-x-auto" role="region" tabIndex={0}>
          <table className="w-full text-left text-sm">
            <caption className="mb-3 text-left font-semibold">{table.caption}</caption>
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th className="p-3" key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map(([name, meaning, limit]) => (
                <tr className="border-t" key={name}>
                  <th className="p-3" scope="row">
                    {name}
                  </th>
                  <td className="p-3">{meaning}</td>
                  <td className="p-3">{limit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <figcaption className="mt-3 text-sm opacity-75">
          {locale === 'th'
            ? 'ตารางนี้ช่วยแยกสิ่งที่ข้อมูลรองรับออกจากข้อสรุปที่ข้อมูลยืนยันไม่ได้'
            : 'This comparison separates what the data supports from conclusions it cannot establish.'}
        </figcaption>
      </figure>
      <h3 className="mt-8 text-lg font-semibold">
        {locale === 'th' ? 'คำแนะนำ' : 'Recommendation'}
      </h3>
      <p className="mt-3 leading-relaxed">{guide.recommendation}</p>
      <h3 className="mt-8 text-lg font-semibold">
        {locale === 'th' ? 'แหล่งอ้างอิงและการตรวจทาน' : 'Sources and review'}
      </h3>
      <p className="mt-3">
        {locale === 'th' ? 'จัดทำโดย' : 'Prepared by the'}{' '}
        <Link className="underline" href={localizedPath(locale, '/about')}>
          {locale === 'th' ? 'ทีมพัฒนา AtoAxis' : 'AtoAxis development team'}
        </Link>
        . {locale === 'th' ? 'ตรวจทานเมื่อ ' : 'Reviewed '}
        <time dateTime={reviewDate}>{reviewDate}</time>.{' '}
        {locale === 'th'
          ? 'ข้อความเกี่ยวกับผลิตภัณฑ์อ้างอิงจากระบบที่พัฒนาอยู่ ตัวอย่างเป็นข้อมูลสมมติ ไม่ใช่งานวิจัยหรือข้อมูลลูกค้า'
          : 'Product claims describe our implementation; examples are illustrative, not customer research.'}
      </p>
      <ul className="mt-4 space-y-3">
        {sources.map((source) => (
          <li key={source.href}>
            {source.href.startsWith('/') ? (
              <Link className="underline" href={localizedPath(locale, source.href)}>
                {source.label}
              </Link>
            ) : (
              <a className="underline" href={source.href} rel="noopener noreferrer">
                {source.label}
              </a>
            )}
            : {source.note}.
          </li>
        ))}
      </ul>
    </section>
  );
}
