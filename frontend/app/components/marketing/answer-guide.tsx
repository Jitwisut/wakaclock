/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The overflow table region must be keyboard-scrollable. */
/* eslint-disable sonarjs/no-duplicate-string -- Source labels and "For example, " openers are
   meant to repeat verbatim across guides; see the same disable in
   marketing-copy.ts. */
import Link from 'next/link';

import {
  contentModified,
  FOUNDER,
  localizedPath,
  PRICING,
  PUBLIC_EVIDENCE_URL,
  SITE_MODIFIED,
  type SiteLocale,
} from '@/lib/seo/site';

import {
  EN_MORE_GUIDES,
  evidenceFor,
  externalReferences,
  type Guide,
  type GuideSource,
  type GuideTable,
  TH_MORE_GUIDES,
  tradeoffFor,
} from './answer-guide-more';

const WAKATIME_DEVELOPER_URL = 'https://wakatime.com/developers';

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
    href: PUBLIC_EVIDENCE_URL,
    label: 'AtoAxis public documentation',
    note: 'documented product behavior and data handling',
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

/**
 * Thai default sources deliberately omit the WakaTime developer link that
 * `DEFAULT_SOURCES` carries. `/th/wakatime-alternative` already sits at the highest
 * brand-keyword density on the site (round 2 rewrote its body copy for exactly this
 * reason), so a shared fallback should not add another repetition of the word.
 */
const THAI_DEFAULT_SOURCES: readonly GuideSource[] = [
  {
    href: PUBLIC_EVIDENCE_URL,
    label: 'เอกสารสาธารณะของ AtoAxis',
    note: 'พฤติกรรมและขอบเขตข้อมูลที่อธิบายไว้ต่อสาธารณะ',
  },
  {
    href: '/docs/getting-started',
    label: 'คู่มือเริ่มต้นใช้งาน AtoAxis',
    note: 'ขั้นตอนสร้างบัญชีและเชื่อม editor',
  },
  {
    href: 'https://dora.dev/guides/dora-metrics/',
    label: 'DORA software delivery metrics',
    note: 'มุมมองผลลัพธ์การส่งมอบซอฟต์แวร์ ซึ่งแยกจากกิจกรรมใน editor',
  },
];

const THAI_DEFAULT_TABLE: GuideTable = {
  caption: 'วิธีตีความข้อมูลกิจกรรมการเขียนโค้ด',
  columns: ['สัญญาณ', 'ช่วยให้เข้าใจ', 'ไม่สามารถยืนยัน'],
  rows: [
    ['Editor heartbeat', 'กิจกรรมที่ระบบบันทึกได้', 'เวลาทำงานทั้งหมด'],
    ['Attributed changes', 'ที่มาของการเปลี่ยนแปลงที่มีหลักฐาน', 'คุณภาพโค้ดหรือเวลาที่ประหยัดได้'],
  ],
};

const EN_GUIDES: Record<string, Guide> = {
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
        href: PUBLIC_EVIDENCE_URL,
        label: 'AtoAxis public documentation',
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
        href: PUBLIC_EVIDENCE_URL,
        label: 'AtoAxis integration documentation',
        note: 'the supported clients, hooks and stated limitations',
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
      'Follow the setup pages in order and keep your API key out of source control. If a heartbeat does not appear, verify the server URL, key and CLI path before changing multiple settings. Use the dated public guides when you need behavior evidence. Use the WakaTime documentation when you need details about the compatibility protocol.',
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
        href: PUBLIC_EVIDENCE_URL,
        label: 'AtoAxis public documentation',
        note: 'implementation behavior explained in the public guides',
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
  '/about': {
    heading: 'Who builds AtoAxis, and can you verify that?',
    answer:
      'AtoAxis is developed by team Atoaxis. It is not affiliated with similarly named products such as ATOSS, Atto or Axis ERP.',
    facts: [
      ['Team', 'Team Atoaxis designs, develops and operates the hosted service.'],
      [
        'Status',
        'Early Access: heartbeat ingestion and analytics run; billing and team seats do not.',
      ],
      ['Working today', 'Heartbeat ingestion, project and language analytics, and AI attribution.'],
      [
        'Verification',
        'Product claims can be checked against the public documentation and support channel.',
      ],
    ],
    question: 'How should you verify a claim made on this site?',
    example:
      'For example, before trusting a capability described on the pricing or integrations page, check the matching public guide in this section or ask a specific question through the contact page. A dated guide and a working contact channel make a claim easier to verify than a marketing statement alone.',
    recommendation:
      'Treat this page as the entity record for AtoAxis, not as a sales pitch: it names who operates the service and what is actually running today. Use the contact page for questions this page does not answer, and check the "Not yet" items on this page before assuming a team or billing feature already exists.',
    sources: [
      {
        href: '/contact',
        label: 'AtoAxis contact page',
        note: 'the reachable channel for product questions',
      },
      {
        href: PUBLIC_EVIDENCE_URL,
        label: 'AtoAxis public documentation',
        note: 'verifiable evidence for the claims on this page',
      },
      {
        href: '/privacy',
        label: 'AtoAxis privacy page',
        note: 'the data boundary the team commits to',
      },
    ],
    table: {
      caption: 'AtoAxis status, by area',
      columns: ['Area', 'Status', 'Where to verify'],
      rows: [
        ['Heartbeat ingestion and analytics', 'Working', 'Getting-started and privacy guides'],
        ['AI attribution hooks', 'Working, 5 agents', 'Integrations page'],
        ['Billing, team and organisation seats', 'In development', 'This page, "Current status"'],
      ],
    },
  },
  '/contact': {
    heading: 'How do you get a specific answer from AtoAxis?',
    answer:
      'A real person reads the contact inbox, so a specific question about Early Access, editors, AI tracking, privacy or migration gets a specific answer rather than an automated reply.',
    facts: [
      ['Channel', 'Email, read by the team building the product, not a support queue.'],
      [
        'Answerable today',
        'Early Access timing, editor compatibility, AI hook coverage, privacy fields.',
      ],
      ['Response scope', 'Product questions; account-specific support requires an active account.'],
      ['Alternative first stop', 'Check the documentation and privacy pages before writing in.'],
    ],
    question: 'What should you include in your message?',
    example:
      'For example, "does the JetBrains WakaTime plugin work with AtoAxis" gets a direct yes-or-no answer with the setting to change. "Does your tool work with my setup" without naming the editor cannot get a precise answer, because the correct integration path depends on which client you already use.',
    recommendation:
      'Name your editor, your question topic and what you already tried before writing in. Read the getting-started guide first if your question is about connecting a client: it answers the most common setup questions without waiting for a reply.',
    sources: [
      {
        href: '/docs/getting-started',
        label: 'AtoAxis setup documentation',
        note: 'answers most connection questions without contacting support',
      },
      {
        href: '/privacy',
        label: 'AtoAxis privacy page',
        note: 'the field-level answer to most data questions',
      },
      {
        href: PUBLIC_EVIDENCE_URL,
        label: 'AtoAxis public documentation',
        note: 'the public evidence behind every claim this page and the contact form describe',
      },
    ],
  },
  '/terms': {
    heading: 'What do the current AtoAxis terms actually commit you to?',
    answer:
      'These are preliminary Early Access terms. Joining the list registers interest only: no account is created, no payment is taken and no service level is promised.',
    facts: [
      ['Nature', 'Preliminary terms for an Early Access website, not a paid-service contract.'],
      ['Joining the list', 'Not a purchase; creates no obligation on either side.'],
      ['Data ownership', 'You keep ownership of the activity data your machines send.'],
      ['Change expectation', 'Planned or in-development features may change before launch.'],
    ],
    question: 'How should you treat a feature described as "planned" or "in development" here?',
    example:
      'For example, a feature listed as in development on the about page is not covered by these terms as a delivered capability, even if it is mentioned. Treat "planned" language as a roadmap statement, not a commitment with a delivery date, and re-read the terms again once checkout actually opens.',
    recommendation:
      'Read the acceptable-use section before sending activity from automation or shared accounts, since one API key identifies one account. Contact the team if a clause is unclear rather than assuming a common industry default; these terms will be replaced before the product becomes payable, and the current wording is the one that applies today.',
    sources: [
      {
        href: '/privacy',
        label: 'AtoAxis privacy page',
        note: 'the data-handling commitments referenced by these terms',
      },
      {
        href: '/contact',
        label: 'AtoAxis contact page',
        note: 'where to ask about a specific clause',
      },
      {
        href: PUBLIC_EVIDENCE_URL,
        label: 'AtoAxis public documentation',
        note: 'what the hosted service actually does today',
      },
    ],
  },
  '/privacy': {
    heading: 'What does an AtoAxis heartbeat actually contain?',
    answer:
      'A heartbeat carries file, project, branch, language and editor metadata plus counts. It never carries source code, diffs, AI prompts, responses, passwords or screenshots.',
    facts: [
      [
        'Collected',
        'File path, project, branch, language, editor, OS and keystroke/character counts.',
      ],
      [
        'Never collected',
        'Source code, diffs, AI prompt or response text, passwords, screenshots.',
      ],
      [
        'Transport',
        'The editor hands activity to the local CLI; only the CLI sends HTTPS requests.',
      ],
      ['Retention', 'Kept while the account is active; deletion can be requested by email.'],
    ],
    question:
      'How can you verify the privacy boundary yourself, rather than take the claim on faith?',
    example:
      'For example, run the CLI with logging enabled and inspect what it actually sends over the network, then compare the fields with the privacy guide. The documented boundary is metadata and counts, with no field for file contents or AI transcript text.',
    recommendation:
      'Read "What is never collected" before connecting a sensitive project, and request deletion by email if you stop using the service. Revoking an API key stops new data immediately but does not delete history already stored; use the deletion request for that.',
    sources: [
      {
        href: PUBLIC_EVIDENCE_URL,
        label: 'AtoAxis privacy documentation',
        note: 'the exact fields a heartbeat may contain',
      },
      {
        href: '/docs/getting-started',
        label: 'AtoAxis setup documentation',
        note: 'where the API key and CLI described here come from',
      },
      {
        href: '/terms',
        label: 'AtoAxis terms',
        note: 'the commitments that apply to this data',
      },
    ],
    table: {
      caption: 'What is, and is not, in a heartbeat',
      columns: ['Category', 'In a heartbeat', 'Never in a heartbeat'],
      rows: [
        ['File', 'Path, language, save state', 'File contents or diffs'],
        ['Project', 'Project name, Git branch', 'Repository contents'],
        ['AI activity', 'Agent flag, line counts', 'Prompt or response text'],
      ],
    },
  },
  '/early-access': {
    heading: 'What actually happens when you join AtoAxis Early Access?',
    answer:
      'Joining the list registers your interest and adds you to launch updates. It is not a purchase: no payment method is collected and no subscription starts.',
    facts: [
      ['What joining does', 'Adds you to the Early Access list and launch-update emails.'],
      ['What it does not do', 'Collect payment details or start a trial or subscription.'],
      ['Key issuance', 'Keys are issued to people on the list, not automatically at signup.'],
      [
        'Planned pricing',
        `$${PRICING.monthlyUsd}/month or $${PRICING.annualUsd}/year once checkout opens.`,
      ],
    ],
    question: 'How is joining Early Access different from a normal product signup?',
    example:
      'For example, signing up for a live product usually creates an account you can log into immediately. Joining this list does neither: there is no dashboard access until a key is issued, and no charge occurs at any point in the process described on this page.',
    recommendation:
      'Join if you want to be notified when keys are issued and pricing is finalized. Read the pricing page for the current planned figures and the terms page for what "planned" and "in development" mean before assuming a specific launch date.',
    sources: [
      {
        href: '/pricing',
        label: 'AtoAxis pricing page',
        note: 'the planned monthly and annual figures',
      },
      {
        href: '/terms',
        label: 'AtoAxis terms',
        note: 'what joining the list does and does not commit you to',
      },
      {
        href: '/join',
        label: 'AtoAxis Early Access campaign page',
        note: 'the same offer with the full feature list',
      },
      {
        href: 'https://wakatime.com/pricing',
        label: 'WakaTime pricing',
        note: 'a primary source for visitors comparing Early Access against an existing service',
      },
    ],
  },
  '/docs/getting-started': {
    heading: 'What do you need before your first AtoAxis heartbeat?',
    answer:
      'Three things: an editor AtoAxis can hear from, wakaclock-cli to deliver heartbeats, and an API key that identifies your account.',
    facts: [
      [
        'Editor',
        'VS Code 1.90+ with the first-party extension, or any WakaTime-compatible editor.',
      ],
      ['CLI', 'wakaclock-cli on PATH, or an absolute path in the wakaclock.cliPath setting.'],
      ['API key', 'Generated from the dashboard once Early Access issues your account access.'],
      [
        'Offline handling',
        'Undelivered heartbeats queue in ~/.wakaclock/queue.db and resend later.',
      ],
    ],
    question: 'How do you confirm the first heartbeat actually arrived, rather than assume it did?',
    example:
      'For example, run wakaclock-cli status to confirm the server is reachable and the key is accepted, then run wakaclock-cli today to read the total the server has counted. Neither command reads your local files; both ask the server for what it has actually recorded.',
    recommendation:
      'Change one setting at a time when troubleshooting: verify the server URL, then the CLI path, then the key, rather than editing all three before checking whether the first one fixed it. Read the VS Code integration guide next if you use that editor, or the integrations overview for any other WakaTime-compatible client.',
    sources: [
      {
        href: '/integrations/vscode',
        label: 'AtoAxis VS Code integration guide',
        note: 'first-party extension settings and commands',
      },
      {
        href: WAKATIME_DEVELOPER_URL,
        label: 'WakaTime API documentation',
        note: 'the heartbeat protocol compatible editor plugins use',
      },
      {
        href: PUBLIC_EVIDENCE_URL,
        label: 'AtoAxis setup documentation',
        note: 'the documented behavior of the commands in this guide',
      },
    ],
    table: {
      caption: 'First-heartbeat verification commands',
      columns: ['Command', 'What it checks', 'Reads local files?'],
      rows: [
        ['wakaclock-cli status', 'Server reachable, API key accepted', 'No'],
        ['wakaclock-cli today', "Today's server-counted total", 'No'],
      ],
    },
  },
  '/integrations/vscode': {
    heading: 'What does the AtoAxis VS Code extension actually send?',
    answer:
      'File, project, branch, language and editor metadata plus save, debug and build activity and keystroke counts — routed through wakaclock-cli, never file contents.',
    facts: [
      ['Requirement', 'VS Code 1.90 or newer, plus wakaclock-cli on PATH or a configured path.'],
      ['Key storage', 'Stored in VS Code secret storage via a command, never in settings.json.'],
      ['Data sent', 'File, project, branch, language and editor metadata, plus activity counts.'],
      [
        'Limitation',
        'File activity only — no app, domain or URL heartbeats, unlike a browser tracker.',
      ],
    ],
    question: 'How do you confirm the extension is reporting correctly after installing it?',
    example:
      "For example, type in a file, then check the VS Code status bar: it should show today's total and refresh roughly every 15 seconds. If it stays at zero, the extension cannot find wakaclock-cli, and the fix is AtoAxis: Configure CLI Path, not reinstalling the extension.",
    recommendation:
      'Set wakaclock.cliPath explicitly if the binary is not on your PATH before assuming the extension itself is broken. Use AtoAxis: Send Heartbeat Now to flush buffered activity immediately when you need to verify a change without waiting for the normal save-triggered cadence.',
    sources: [
      {
        href: '/docs/getting-started',
        label: 'AtoAxis getting-started guide',
        note: 'the account and API key steps this extension depends on',
      },
      {
        href: '/privacy',
        label: 'AtoAxis privacy page',
        note: 'the exact metadata fields this extension can send',
      },
      {
        href: WAKATIME_DEVELOPER_URL,
        label: 'WakaTime API documentation',
        note: 'the protocol this extension speaks to the server',
      },
    ],
    table: {
      caption: 'AtoAxis VS Code extension settings',
      columns: ['Setting', 'Purpose', 'Default'],
      rows: [
        ['wakaclock.cliPath', 'Absolute path to the CLI binary', 'Resolved from PATH'],
        ['wakaclock.statusBarEnabled', "Show today's total in the status bar", 'Enabled'],
        ['wakaclock.trackDebugSessions', 'Emit heartbeats for debug sessions', 'Enabled'],
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
      href: PUBLIC_EVIDENCE_URL,
      label: 'เอกสารสาธารณะของ AtoAxis',
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

/**
 * Thai guides for `/wakatime-alternative` and `/ai-coding-tracker`.
 *
 * Before this, `hasAnswerGuide` returned `path === '/'` for every Thai path, so these two
 * pages rendered no key takeaways, sources or comparison table at all even though their
 * English counterparts had all three — the gap behind their much lower AEO/GEO scores.
 * `/th/wakatime-alternative` already carries the highest brand-keyword density on the
 * site, so this copy names the current product once and otherwise says "ระบบเดิม"
 * ("your existing system") rather than repeating "WakaTime".
 */
const TH_GUIDES: Record<string, Guide> = {
  '/': THAI_HOME_GUIDE,
  '/developer-analytics': {
    heading: 'ข้อมูล Developer analytics ช่วยตอบอะไรได้บ้าง?',
    answer:
      'AtoAxis แสดงเวลาเขียนโค้ดที่บันทึกได้แยกตามโปรเจกต์ ภาษา editor และ branch พร้อมบริบทของ AI attribution แต่กิจกรรมใน editor ไม่ใช่คะแนนประสิทธิภาพของคน',
    facts: [
      ['เวลาเขียนโค้ด', 'คำนวณจาก heartbeat ที่ต่อเนื่องกัน โดยไม่นับช่วงว่างที่ไม่มี activity'],
      ['การแยกข้อมูล', 'กรองตามโปรเจกต์ ภาษา editor และ branch ในช่วงเวลาเดียวกัน'],
      ['AI attribution', 'ดูที่มาของการเปลี่ยนแปลงพร้อม coverage ของหลักฐาน'],
      ['ข้อจำกัด', 'เวลาที่บันทึกได้ไม่ครอบคลุมการประชุม การรีวิว และงานนอก editor'],
    ],
    question: 'จะเทียบข้อมูลสองสัปดาห์อย่างเป็นธรรมได้อย่างไร?',
    example:
      'ตัวอย่างสมมติ: สัปดาห์ที่ปล่อยเวอร์ชันอาจมีเวลาเขียนโค้ดน้อยลง เพราะใช้เวลารีวิว ทดสอบ และประสานงานมากขึ้น ก่อนเปรียบเทียบ ให้เลือกช่วงวันที่เท่ากันและตรวจว่า editor ชุดเดียวกันส่งข้อมูลครบ ตัวเลขที่เพิ่มขึ้นอาจสะท้อนการเชื่อมต่อที่ครอบคลุมขึ้น ไม่ใช่ผลงานที่ดีขึ้น',
    recommendation:
      'ใช้รายงานเพื่อหาคำถามเกี่ยวกับรูปแบบการทำงานของตนเอง แล้วตรวจร่วมกับผลการส่งมอบและบริบทของงาน อย่านำชั่วโมงหรือจำนวนบรรทัดไปจัดอันดับคนในทีม อ่านวิธีคำนวณเวลาและ coverage ก่อนสรุปผลจากกราฟ',
    sources: [
      {
        href: '/docs/how-coding-time-is-calculated',
        label: 'วิธีคำนวณเวลาของ AtoAxis',
        note: 'นิยาม heartbeat และ idle gap',
      },
      {
        href: '/docs/ai-attribution-and-coverage',
        label: 'วิธีอ่าน AI attribution',
        note: 'หลักฐานและ coverage ของข้อมูล',
      },
      {
        href: 'https://dora.dev/guides/dora-metrics/',
        label: 'DORA software delivery metrics',
        note: 'ตัวชี้วัดผลการส่งมอบที่ต่างจากกิจกรรมใน editor',
      },
    ],
    table: {
      caption: 'การอ่าน Developer analytics อย่างระมัดระวัง',
      columns: ['ข้อมูล', 'ใช้ดู', 'ไม่ควรสรุปว่า'],
      rows: [
        ['Coding time', 'กิจกรรมใน editor ที่บันทึกได้', 'เวลาทำงานทั้งหมด'],
        [
          'AI-attributed lines',
          'การเปลี่ยนแปลงที่มีหลักฐานจาก agent',
          'คุณภาพโค้ดหรือเวลาที่ประหยัดได้',
        ],
      ],
    },
  },
  '/teams': {
    heading: 'AtoAxis สำหรับทีมพร้อมใช้งานระดับใด?',
    answer:
      'ห้องแสดงสถานะและการทำงานร่วมกันยังเป็น prototype ในช่วง Early Access ส่วนการจัดการองค์กร สมาชิก และการเรียกเก็บเงินยังอยู่ระหว่างพัฒนา',
    facts: [
      ['สถานะ', 'ห้องและการแสดง presence ใช้ได้เฉพาะสภาพแวดล้อมที่เปิด prototype'],
      ['การเข้าร่วม', 'ผู้ใช้เลือกเข้าร่วมเอง และผู้เข้าร่วมเห็นสถานะในห้อง'],
      ['สัญญาณ', 'working และ idle อิง activity จาก editor ไม่ใช่ความพร้อมให้ติดต่อ'],
      ['ข้อจำกัด', 'ยังไม่ควรวางระบบการจัดการทีมจริงบนฟีเจอร์องค์กรที่อยู่ระหว่างพัฒนา'],
    ],
    question: 'ควรทดลองห้องทำงานร่วมกันอย่างไร?',
    example:
      'ตัวอย่างเช่น ให้เพื่อนร่วมงานสองคนที่สมัครใจทดลองห้อง prototype เพื่อประสานช่วงเขียนโค้ดด้วยกัน สถานะ working บอกเพียงว่ามี activity ใน editor ส่วน idle อาจหมายถึงกำลังอ่านเอกสารหรือคุยเรื่องงาน จึงควรถามผ่านช่องทางสื่อสารปกติก่อนขัดจังหวะ',
    recommendation:
      'ทดลองกับผู้เข้าร่วมที่ยินยอมและกำหนดความหมายของสถานะร่วมกันก่อน ทีมที่ต้องการสิทธิ์องค์กร ที่นั่ง และ billing ที่พร้อมใช้งานควรรอการพัฒนา ห้ามใช้ presence หรือชั่วโมงที่บันทึกได้เป็นหลักฐานประเมินผลงานรายบุคคล',
    sources: [
      {
        href: '/privacy',
        label: 'นโยบายข้อมูลของ AtoAxis',
        note: 'ขอบเขต heartbeat และข้อมูลที่ส่ง',
      },
      {
        href: '/developer-analytics',
        label: 'คู่มือ Developer analytics',
        note: 'ข้อจำกัดของการวัด activity',
      },
      {
        href: 'https://dora.dev/guides/dora-metrics/',
        label: 'DORA software delivery metrics',
        note: 'มุมมองผลการส่งมอบที่ต่างจากสถานะใน editor',
      },
    ],
    table: {
      caption: 'สถานะฟีเจอร์สำหรับทีม',
      columns: ['ส่วนงาน', 'สถานะปัจจุบัน', 'สิ่งที่ควรทำ'],
      rows: [
        ['Presence room', 'Prototype แบบเลือกเข้าร่วม', 'ทดสอบกับผู้สมัครใจ'],
        ['Organisation seats และ billing', 'อยู่ระหว่างพัฒนา', 'รอประกาศก่อนวางแผนใช้งานจริง'],
      ],
    },
  },
  '/pricing': {
    heading: 'ราคา AtoAxis ที่วางแผนไว้เท่าไร?',
    answer: `ราคาเป้าหมายคือ $${PRICING.monthlyUsd} ต่อเดือนหรือ $${PRICING.annualUsd} ต่อปี แต่ช่วง Early Access ยังไม่เปิด checkout และการลงชื่อไม่ทำให้เกิดค่าใช้จ่าย`,
    facts: [
      ['รายเดือน', `$${PRICING.monthlyUsd} ต่อเดือนเมื่อเปิด checkout`],
      ['รายปี', `$${PRICING.annualUsd} ต่อปีเมื่อเปิด checkout`],
      ['สถานะปัจจุบัน', 'ยังไม่มีการซื้อหรือสมัครสมาชิกแบบชำระเงิน'],
      ['ประวัติ', 'แผนที่วางไว้รวมประวัติการเขียนโค้ดครบถ้วน'],
    ],
    question: 'รายปีต่างจากจ่ายรายเดือนสิบสองครั้งอย่างไร?',
    example: `คำนวณจากราคาเป้าหมาย: จ่ายรายเดือนสิบสองครั้งรวม $${PRICING.monthlyUsd * 12} ส่วนรายปีคือ $${PRICING.annualUsd} ต่างกัน $${PRICING.monthlyUsd * 12 - PRICING.annualUsd} ตัวเลขนี้เป็นเพียงการคำนวณจากราคาที่ประกาศไว้ ยังไม่ใช่ข้อเสนอที่ซื้อได้หรือการรับประกันว่าราคาจะไม่เปลี่ยน`,
    recommendation:
      'รอเงื่อนไขสุดท้ายก่อนเลือกแผน หากต้องการความยืดหยุ่นให้พิจารณารายเดือน ส่วนรายปีเหมาะเมื่อคาดว่าจะใช้งานครบปี การเข้าร่วม Early Access เป็นการรับข่าว ไม่ใช่การสมัครแผนชำระเงิน',
    sources: [
      {
        href: '/early-access',
        label: 'สถานะ Early Access',
        note: 'เงื่อนไขการลงชื่อและสถานะ checkout',
      },
      { href: '/docs', label: 'เอกสารผลิตภัณฑ์ AtoAxis', note: 'ขอบเขตฟีเจอร์ที่มีเอกสารรองรับ' },
    ],
    table: {
      caption: 'ราคาเป้าหมายของ AtoAxis',
      columns: ['แผน', 'ราคาเป้าหมาย', 'สถานะ'],
      rows: [
        ['รายเดือน', `$${PRICING.monthlyUsd} ต่อเดือน`, 'ยังไม่เปิด checkout'],
        ['รายปี', `$${PRICING.annualUsd} ต่อปี`, 'ยังไม่เปิด checkout'],
      ],
    },
  },
  '/integrations': {
    heading: 'เครื่องมือใดเชื่อมกับ AtoAxis ได้?',
    answer:
      'เชื่อมผ่าน extension ของ AtoAxis สำหรับ VS Code, plugin ที่รองรับ WakaTime API หรือ hook ของ AI agent ที่รองรับ โดยแต่ละวิธีส่งข้อมูลและมีข้อจำกัดต่างกัน',
    facts: [
      ['VS Code', 'ใช้ extension ของ AtoAxis ร่วมกับ wakaclock-cli'],
      ['Editor อื่น', 'ใช้ WakaTime-compatible plugin และตั้งค่า API URL กับ key'],
      ['AI agent', 'ใช้ hook ที่รองรับเพื่อเก็บ attribution และตรวจ coverage'],
      ['ขอบเขตข้อมูล', 'ส่ง metadata และจำนวนกิจกรรม ไม่ส่งเนื้อหา source code'],
    ],
    question: 'ควรเลือกวิธีเชื่อมต่อแบบใด?',
    example:
      'ถ้าใช้ VS Code ให้เริ่มจาก extension ที่ทีมดูแลเอง ถ้าใช้ JetBrains, Neovim หรือ Vim ที่มี WakaTime plugin อยู่แล้ว ให้เปลี่ยน API URL และ key ใน plugin เดิม หากต้องการแยกงานของ AI ให้ติดตั้ง hook ของ agent ที่รองรับ แล้วตรวจ coverage ก่อนเปรียบเทียบยอดกับกิจกรรมของคน',
    recommendation:
      'เริ่มทีละเครื่องมือและตรวจว่าโปรเจกต์ที่รู้จักปรากฏใน dashboard ก่อนเพิ่ม client อื่น Plugin แต่ละตัวเลือก field ที่ส่งเอง จึงอาจไม่มี metadata บางชนิด Cursor และ Copilot ยังต้องการ adapter เฉพาะ และไม่ควรนับเป็นแหล่ง attribution ที่รองรับแล้ว',
    sources: [
      {
        href: '/integrations/vscode',
        label: 'คู่มือ VS Code ของ AtoAxis',
        note: 'การตั้งค่าและข้อจำกัดของ extension',
      },
      {
        href: WAKATIME_DEVELOPER_URL,
        label: 'เอกสาร WakaTime API',
        note: 'รูปแบบ heartbeat ที่ plugin ใช้',
      },
      {
        href: '/docs/getting-started',
        label: 'คู่มือเริ่มต้นใช้งาน',
        note: 'วิธีตรวจ heartbeat แรก',
      },
    ],
    table: {
      caption: 'เส้นทางการเชื่อมต่อกับ AtoAxis',
      columns: ['เครื่องมือ', 'วิธีเชื่อม', 'ข้อจำกัดสำคัญ'],
      rows: [
        ['VS Code', 'Extension และ CLI ของ AtoAxis', 'บันทึกกิจกรรมไฟล์'],
        ['Editor ที่รองรับ WakaTime', 'Plugin เดิมและ API URL', 'Field ขึ้นอยู่กับ plugin'],
        ['AI agent ที่รองรับ', 'Hook ของ agent', 'Coverage ขึ้นอยู่กับ event ที่เก็บได้'],
      ],
    },
  },
  '/docs': {
    heading: 'เอกสาร AtoAxis ช่วยเริ่มต้นอย่างไร?',
    answer:
      'เอกสารอธิบายการเชื่อม editor การตรวจ heartbeat แรก วิธีอ่าน AI attribution และขอบเขตข้อมูลที่ส่งไปยังบริการ',
    facts: [
      ['เริ่มต้น', 'สร้าง API key เมื่อได้รับสิทธิ์ เชื่อม editor และตรวจ activity'],
      ['การเชื่อมต่อ', 'เลือก extension ของ VS Code หรือ plugin ที่รองรับ WakaTime'],
      ['การวัด', 'อ่านวิธีคำนวณเวลาและ coverage ก่อนตีความยอดรวม'],
      ['ความเป็นส่วนตัว', 'ตรวจ field ของ heartbeat และข้อมูลที่ client ไม่ส่ง'],
    ],
    question: 'ผู้ใช้ใหม่ควรอ่านหน้าใดก่อน?',
    example:
      'เริ่มจากคู่มือเริ่มต้นใช้งานและเชื่อม editor เพียงตัวเดียว เมื่อได้รับสิทธิ์ Early Access ให้สร้าง API key แล้วตรวจ heartbeat ใน dashboard ก่อนเพิ่ม client จากนั้นอ่านคู่มือ integration สำหรับ editor ของคุณ และอ่านหน้า privacy เพื่อดูขอบเขตข้อมูล หากต้องการ AI attribution ค่อยอ่านคู่มือ coverage ต่อ',
    recommendation:
      'ทำตามขั้นตอนทีละหน้าและเก็บ API key ออกจาก source control หาก heartbeat ไม่ปรากฏ ให้ตรวจ server URL, key และ CLI path ก่อนเปลี่ยนหลายค่าในครั้งเดียว ใช้เอกสาร WakaTime API เมื่อจำเป็นต้องตรวจรูปแบบ protocol ของ plugin ที่รองรับ',
    sources: [
      {
        href: '/docs/getting-started',
        label: 'คู่มือเริ่มต้นใช้งาน AtoAxis',
        note: 'ลำดับการเชื่อมต่อและตรวจ heartbeat',
      },
      {
        href: WAKATIME_DEVELOPER_URL,
        label: 'เอกสาร WakaTime API',
        note: 'รูปแบบ protocol ที่รองรับ',
      },
      { href: '/privacy', label: 'เอกสารความเป็นส่วนตัว', note: 'ข้อมูลที่ heartbeat อาจส่ง' },
    ],
    table: {
      caption: 'เลือกคู่มือตามสิ่งที่ต้องการทำ',
      columns: ['เป้าหมาย', 'อ่านต่อ', 'ผลที่คาดหวัง'],
      rows: [
        ['เริ่มบันทึก activity', 'คู่มือเริ่มต้นใช้งาน', 'เห็น heartbeat แรก'],
        ['เชื่อมเครื่องมือ', 'คู่มือ integrations', 'เลือก client ที่เหมาะ'],
        ['ตรวจข้อมูลที่ส่ง', 'คู่มือ privacy', 'เข้าใจขอบเขต heartbeat'],
      ],
    },
  },
  '/wakatime-alternative': {
    heading: 'ควรพิจารณาอะไรก่อนย้ายจากระบบติดตามเวลาเดิม?',
    answer:
      'เทียบความเข้ากันได้ของ editor การเข้าถึงประวัติ การย้ายข้อมูล และความครอบคลุมของ AI attribution ก่อนเปลี่ยนเครื่องมือติดตามเวลาเขียนโค้ด',
    facts: [
      ['ความเข้ากันได้', 'AtoAxis รองรับ WakaTime API จึงใช้ editor plugin เดิมที่มีอยู่ได้ทันที'],
      ['การย้ายข้อมูล', 'นำเข้าไฟล์ export จากระบบเดิมได้ ควรตรวจผลลัพธ์ก่อนเชื่อถือตัวเลข'],
      ['ประวัติ', 'ทุกบัญชีเก็บประวัติการเขียนโค้ดแบบครบถ้วน ไม่ตัดเหลือเฉพาะช่วงล่าสุด'],
      ['สถานะ', 'อยู่ในช่วง Early Access ราคาที่ประกาศไว้ยังไม่ใช่ checkout ที่เปิดใช้จริง'],
    ],
    question: 'ควรประเมินการย้ายระบบอย่างไรให้ปลอดภัย?',
    example:
      'ตัวอย่างเช่น เชื่อม editor ตัวเดียวก่อน แล้วตรวจโปรเจกต์และช่วงเวลาที่คุ้นเคยก่อนย้ายงานประจำทั้งหมดมาที่นี่ ตรวจชื่อภาษา ชื่อโปรเจกต์ และช่วงวันที่ให้ตรงกับที่คาดไว้ การนำเข้าเป็นการพาประวัติเดิมมาต่อเนื่องเท่านั้น ไม่ได้สร้างหลักฐาน AI attribution ที่ข้อมูลเดิมไม่เคยมีมาก่อน',
    recommendation:
      'เลือกตามหลักฐานที่ต้องตรวจสอบและ client ที่ใช้งานจริง เก็บไฟล์ export ไว้ระหว่างตรวจสอบผลลัพธ์ บริการที่ตั้งตัวมานานอาจเหมาะกับทีมที่ต้องการระบบจัดการสมาชิกที่ครบแล้ววันนี้ เพราะฟีเจอร์ทีมและองค์กรของ AtoAxis ยังอยู่ระหว่างพัฒนา',
    // No `sources`/`table` override: the component falls back to THAI_DEFAULT_SOURCES and
    // THAI_DEFAULT_TABLE for any Thai guide that doesn't need its own.
  },
  '/ai-coding-tracker': {
    heading: 'เครื่องมือติดตาม AI coding วัดอะไรบ้าง?',
    answer:
      'เครื่องมือติดตาม AI coding บันทึกการเปลี่ยนแปลงโค้ดที่มีหลักฐานที่มาและกิจกรรมของ agent ส่วนที่ไม่มีหลักฐานเพียงพอควรแสดงเป็นงานที่ยังไม่ทราบที่มา แทนที่จะนับรวมเป็นของคนเขียนไปเลย',
    facts: [
      ['AI attribution', 'Hook หรือ client ระบุ agent ที่เกี่ยวข้องกับการเปลี่ยนแปลงแต่ละครั้ง'],
      ['กิจกรรมของคน', 'Keystroke และ character ที่ editor สังเกตได้ เป็นสัญญาณกิจกรรมของคน'],
      ['ยังไม่ทราบที่มา', 'การเปลี่ยนแปลงที่ไม่มีหลักฐานเพียงพอจะถูกแยกไว้เป็นหมวดต่างหาก'],
      [
        'การอ่านผล',
        'ควรดู coverage ควบคู่กับยอดรวม เพราะหลักฐานที่ขาดหายไม่ใช่ข้อพิสูจน์ว่าเป็นคนเขียน',
      ],
    ],
    question: 'ควรตีความรายงาน AI contribution อย่างไร?',
    example:
      'ตัวอย่างสมมติ ไม่ใช่ข้อมูลลูกค้า: ชุดการเปลี่ยนแปลงหนึ่งมี 100 บรรทัดที่เพิ่มเข้ามา หลักฐานระบุว่า 40 บรรทัดมาจาก AI, 35 บรรทัดมาจากกิจกรรมของคน และเหลือ 25 บรรทัดที่ยังไม่มีหลักฐานเพียงพอ ควรรายงานครบทั้งสามหมวด การนับ 25 บรรทัดที่ไม่ทราบที่มาว่าเป็นของคนจะซ่อน coverage ที่ขาดหายไป ตัวเลขตัวอย่างนี้ใช้อธิบายวิธีตีความเท่านั้น ไม่ใช่ผลวัดของผลิตภัณฑ์',
    recommendation:
      'ใช้ attribution เพื่อเข้าใจ workflow ของตัวเองและมองหาจุดที่ยังไม่มีเครื่องมือวัด ตรวจ hook ที่รองรับก่อนเทียบตัวเลขระหว่าง agent จำนวนบรรทัดอธิบายการเปลี่ยนแปลง ไม่ได้ยืนยันความถูกต้อง การดูแลรักษาได้ เวลาที่ประหยัดได้ หรือมูลค่าทางธุรกิจของโค้ดที่ AI สร้างขึ้น',
  },
};

function guideFor(path: string, locale: SiteLocale): Guide | undefined {
  return locale === 'th'
    ? (TH_GUIDES[path] ?? TH_MORE_GUIDES[path])
    : (EN_GUIDES[path] ?? EN_MORE_GUIDES[path]);
}

/** The page's own sources first, then its primary external references, without repeats. */
function sourcesFor(guide: Guide, path: string, locale: SiteLocale): GuideSource[] {
  const own = guide.sources ?? (locale === 'th' ? THAI_DEFAULT_SOURCES : DEFAULT_SOURCES);
  const seen = new Set<string>();
  return [...own, ...externalReferences(path, locale)].filter((source) => {
    if (seen.has(source.href)) return false;
    seen.add(source.href);
    return true;
  });
}

export function hasAnswerGuide(path: string, locale: SiteLocale): boolean {
  return Boolean(guideFor(path, locale));
}

export function AnswerGuide({ locale = 'en', path }: { locale?: SiteLocale; path: string }) {
  const guide = guideFor(path, locale);
  if (!guide) return null;
  const sources = sourcesFor(guide, path, locale);
  const tradeoff = tradeoffFor(path, locale);
  const evidence = evidenceFor(path, locale);
  const table = guide.table ?? (locale === 'th' ? THAI_DEFAULT_TABLE : DEFAULT_TABLE);
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
            <dt>
              <strong>{term}:</strong>
            </dt>
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
      {tradeoff ? (
        <>
          <h3 className="mt-8 text-lg font-semibold">
            {locale === 'th' ? 'ข้อจำกัดที่ควรพิจารณา' : 'Trade-offs to weigh'}
          </h3>
          <p className="mt-3 leading-relaxed">{tradeoff}</p>
        </>
      ) : null}
      <h3 className="mt-8 text-lg font-semibold">
        {locale === 'th' ? 'แหล่งอ้างอิงและการตรวจทาน' : 'Sources and review'}
      </h3>
      <p className="mt-3">
        {locale === 'th' ? 'เขียนและตรวจทานโดย' : 'Written and reviewed by'}{' '}
        <Link className="underline" href={localizedPath(locale, '/about')} rel="author">
          {FOUNDER.name}
        </Link>
        , {locale === 'th' ? FOUNDER.thJobTitle : FOUNDER.jobTitle} {locale === 'th' ? 'ของ' : 'of'}{' '}
        AtoAxis. {locale === 'th' ? 'ตรวจทานเมื่อ ' : 'Reviewed '}
        <time dateTime={reviewDate}>{reviewDate}</time>.{' '}
        {locale === 'th'
          ? 'ข้อความเกี่ยวกับผลิตภัณฑ์อ้างอิงจากระบบที่พัฒนาอยู่ ตัวอย่างเป็นข้อมูลสมมติ ไม่ใช่งานวิจัยหรือข้อมูลลูกค้า'
          : 'Product claims describe our implementation; examples are illustrative, not customer research.'}
      </p>
      {evidence ? (
        <p className="mt-3">
          {evidence.text}{' '}
          <cite>
            <a className="underline" href={evidence.href} rel="noopener noreferrer">
              {locale === 'th' ? 'ที่มา' : 'Source'}
            </a>
          </cite>
          .
        </p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {sources.map((source) => (
          <li key={source.href}>
            {source.href.startsWith('/') ? (
              <cite>
                <Link className="underline" href={localizedPath(locale, source.href)}>
                  {source.label}
                </Link>
              </cite>
            ) : (
              <cite>
                <a className="underline" href={source.href} rel="noopener noreferrer">
                  {source.label}
                </a>
              </cite>
            )}
            : {source.note}.
          </li>
        ))}
      </ul>
    </section>
  );
}
