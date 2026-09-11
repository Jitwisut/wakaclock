/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The overflow table region must be keyboard-scrollable. */
import Link from 'next/link';

import { SOURCE_REPOSITORY_URL } from '@/lib/seo/site';

type Guide = {
  answer: string;
  example: string;
  facts: readonly (readonly [string, string])[];
  heading: string;
  question: string;
  recommendation: string;
};

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
};

export function AnswerGuide({ path }: { path: string }) {
  const guide = GUIDES[path];
  if (!guide) return null;
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
      <h3 className="mt-8 text-lg font-semibold">Key takeaways</h3>
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
      <div
        aria-label="Metric interpretation"
        className="mt-6 overflow-x-auto"
        role="region"
        tabIndex={0}
      >
        <table className="w-full text-left text-sm">
          <caption className="mb-3 text-left font-semibold">
            How to read coding activity metrics
          </caption>
          <thead>
            <tr>
              <th className="p-3" scope="col">
                Signal
              </th>
              <th className="p-3" scope="col">
                What it supports
              </th>
              <th className="p-3" scope="col">
                What it cannot prove
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <th className="p-3" scope="row">
                Editor heartbeats
              </th>
              <td className="p-3">Recorded coding activity</td>
              <td className="p-3">All working time</td>
            </tr>
            <tr className="border-t">
              <th className="p-3" scope="row">
                Attributed changes
              </th>
              <td className="p-3">Reported source of changes</td>
              <td className="p-3">Code quality or time saved</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3 className="mt-8 text-lg font-semibold">Recommendation</h3>
      <p className="mt-3 leading-relaxed">{guide.recommendation}</p>
      <h3 className="mt-8 text-lg font-semibold">Sources and review</h3>
      <p className="mt-3">
        Prepared by the{' '}
        <Link className="underline" href="/about">
          AtoAxis development team
        </Link>
        . Reviewed <time dateTime="2026-09-11">September 11, 2026</time>. Product claims describe
        our implementation; examples are illustrative, not customer research.
      </p>
      <ul className="mt-4 space-y-3">
        <li>
          <a className="underline" href={SOURCE_REPOSITORY_URL}>
            AtoAxis implementation
          </a>{' '}
          and{' '}
          <Link className="underline" href="/docs/getting-started">
            setup documentation
          </Link>
          : product behavior and configuration.
        </li>
        <li>
          <a className="underline" href="https://wakatime.com/developers">
            WakaTime API documentation
          </a>
          : editor heartbeats and the compatibility protocol.
        </li>
        <li>
          <a className="underline" href="https://dora.dev/guides/dora-metrics/">
            DORA software delivery metrics
          </a>
          : delivery performance, a separate perspective from editor activity.
        </li>
      </ul>
    </section>
  );
}
