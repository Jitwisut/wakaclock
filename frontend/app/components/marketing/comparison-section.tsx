import { CheckIcon, XIcon } from 'lucide-react';

import type { SiteLocale } from '@/lib/seo/site';

const MUTED_STYLE = { color: 'var(--mkt-fg-muted)' };

/**
 * Feature comparison against WakaTime.
 *
 * Every WakaTime cell here was verified against wakatime.com (plugin directory and
 * pricing page) in August 2026 — nothing is inferred. An earlier version of this table
 * marked several WakaTime cells "not publicly documented" when WakaTime in fact
 * documents them prominently; those rows were wrong and have been corrected, including
 * the ones where WakaTime is the stronger product.
 *
 * Re-verify before publishing: WakaTime ships quickly and these facts will date.
 */
const NEXT_REVIEW = 'September 2026';

const PRIMARY_SOURCES = [
  { href: 'https://wakatime.com/pricing', label: 'WakaTime pricing' },
  { href: 'https://wakatime.com/plugins', label: 'WakaTime official plugins' },
] as const;

type Cell = { kind: 'no' } | { kind: 'text'; value: string } | { kind: 'yes' };

interface ComparisonRow {
  atoaxis: Cell;
  label: string;
  note?: string;
  wakatime: Cell;
}

const ROWS: ComparisonRow[] = [
  {
    label: 'Complete history included in the base plan',
    atoaxis: { kind: 'yes' },
    wakatime: { kind: 'text', value: 'Premium' },
    note: 'WakaTime limits dashboard history to 1 week on Free and 2 weeks on Basic; complete history requires Premium.',
  },
  {
    label: 'Price for complete history',
    atoaxis: { kind: 'text', value: '$12/mo' },
    wakatime: { kind: 'text', value: '$14/mo' },
    note: 'AtoAxis has one plan with every feature included. WakaTime: Free $0 (1 week), Basic $9/mo (2 weeks), Premium $14/mo (complete).',
  },
  {
    label: 'Official editor plugins',
    atoaxis: { kind: 'text', value: 'VS Code' },
    wakatime: { kind: 'text', value: '80+' },
    note: 'Other editors reach AtoAxis through WakaTime-protocol compatibility rather than a plugin we publish.',
  },
  {
    label: 'Automatic AI agent tracking (Claude Code, Codex, Gemini CLI, Kilo Code, Kimi Code CLI)',
    atoaxis: { kind: 'yes' },
    wakatime: { kind: 'yes' },
    note: 'AtoAxis configures bundled hooks for Claude Code, Codex CLI, Gemini CLI, Kilo Code and Kimi Code CLI. Cursor and Copilot still need provider-specific adapters.',
  },
  {
    label: 'AI token usage and estimated cost',
    atoaxis: { kind: 'text', value: 'Conditional' },
    wakatime: { kind: 'yes' },
    note: 'Shown only when provider-reported usage and a known effective price are available; otherwise coverage is unknown.',
  },
  {
    label: 'Team and organisation dashboards',
    atoaxis: { kind: 'no' },
    wakatime: { kind: 'yes' },
    note: 'Full team and org dashboards are in development. Opt-in leaderboards and a presence prototype exist where the server runs PostgreSQL.',
  },
  {
    label: 'Free tier',
    atoaxis: { kind: 'no' },
    wakatime: { kind: 'yes' },
  },
];

function CellContent({ cell, locale }: { cell: Cell; locale: SiteLocale }) {
  if (cell.kind === 'yes') {
    return (
      <CheckIcon
        aria-label={locale === 'th' ? 'มี' : 'Yes'}
        className="mx-auto size-5"
        style={{ color: 'var(--mkt-accent)' }}
      />
    );
  }
  if (cell.kind === 'no') {
    return (
      <XIcon aria-label={locale === 'th' ? 'ไม่มี' : 'No'} className="mx-auto size-5 opacity-40" />
    );
  }

  return <span className="text-sm font-medium">{cell.value}</span>;
}

const THAI_LABELS = [
  'มีประวัติครบในแผนหลัก',
  'ราคาสำหรับประวัติครบถ้วน',
  'Official editor plugins',
  'ติดตาม AI agent อัตโนมัติ (Claude Code, Codex, Gemini CLI, Kilo Code, Kimi Code CLI)',
  'AI token usage และ estimated cost',
  'Team และ organisation dashboards',
  'Free tier',
];
const THAI_NOTES: readonly (string | undefined)[] = [
  'WakaTime จำกัด dashboard history ใน Free และ Basic ส่วนประวัติครบต้องใช้ Premium',
  'AtoAxis มีแผนเดียว ส่วน WakaTime มี Free, Basic และ Premium ตามช่วงประวัติ',
  'Editor อื่นเชื่อมผ่าน WakaTime protocol ไม่ใช่ plugin ที่เราดูแลเอง',
  'AtoAxis มี bundled hook สำหรับ Claude Code, Codex CLI, Gemini CLI, Kilo Code และ Kimi Code CLI ส่วน Cursor/Copilot ต้องมี adapter',
  'แสดงเมื่อมี provider usage และราคาที่มีผลใช้งานชัดเจน มิฉะนั้น coverage เป็น unknown',
  'team และ org dashboard เต็มรูปแบบยังอยู่ระหว่างพัฒนา มี leaderboard แบบ opt-in และ presence prototype เมื่อ server รัน PostgreSQL',
  undefined,
];

export function ComparisonSection({ locale = 'en' }: { locale?: SiteLocale }) {
  const rows =
    locale === 'th'
      ? ROWS.map((row, index) => ({ ...row, label: THAI_LABELS[index], note: THAI_NOTES[index] }))
      : ROWS;
  const copy =
    locale === 'th'
      ? {
          title: 'เปรียบเทียบ AtoAxis กับ WakaTime',
          intro:
            'แสดงเฉพาะข้อมูลที่ตรวจสอบได้จากทั้งสองระบบ รวมกรณีที่ WakaTime ทำได้ดีกว่า เพื่อให้ตัดสินใจได้ตรงไปตรงมา',
          capability: 'ความสามารถ',
          caption: 'ตารางเปรียบเทียบ AtoAxis และ WakaTime ตรวจสอบเมื่อ สิงหาคม 2026',
          note: 'รายละเอียดของ WakaTime ตรวจสอบจาก wakatime.com ใน สิงหาคม 2026 ควรดูเอกสารล่าสุดก่อนตัดสินใจ',
          source: 'แหล่งข้อมูลหลัก',
          review: 'ทบทวนครั้งถัดไป',
          nextReview: 'กันยายน 2026',
        }
      : {
          title: 'AtoAxis compared with WakaTime',
          intro:
            'Only rows where both products could be verified are listed, including cases where WakaTime is ahead. Check the current documentation before deciding.',
          capability: 'Capability',
          caption: 'Feature comparison between AtoAxis and WakaTime, verified August 2026',
          note: 'WakaTime details verified against wakatime.com in August 2026. Check their current documentation before deciding.',
          source: 'Primary sources',
          review: 'Next monthly review',
          nextReview: NEXT_REVIEW,
        };
  return (
    <section className="mkt-reveal mx-auto max-w-4xl px-4 py-20 md:px-6" id="compare">
      <div className="mb-10 text-center">
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace' }}
        >
          {copy.title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base" style={MUTED_STYLE}>
          {copy.intro}
        </p>
      </div>

      {/* Overflow regions need focus so keyboard users can scroll the full table. */}
      {/* eslint-disable jsx-a11y/no-noninteractive-tabindex */}
      <div
        aria-label={copy.caption}
        className="mkt-pixel-shadow overflow-x-auto border-[3px]"
        role="region"
        style={{ borderColor: 'var(--mkt-border)', background: 'var(--mkt-bg-elevated)' }}
        tabIndex={0}
      >
        {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="sr-only">{copy.caption}</caption>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--mkt-border)' }}>
              <th className="p-4 text-left font-medium" scope="col" style={MUTED_STYLE}>
                {copy.capability}
              </th>
              <th
                className="p-4 text-center font-semibold"
                scope="col"
                style={{
                  color: 'var(--mkt-accent)',
                  fontFamily: 'var(--font-mkt-display), var(--font-mkt-body), monospace',
                }}
              >
                AtoAxis
              </th>
              <th className="p-4 text-center font-medium" scope="col" style={MUTED_STYLE}>
                WakaTime
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} style={{ borderBottom: '1px solid var(--mkt-border)' }}>
                <th className="p-4 text-left font-normal" scope="row">
                  {row.label}
                  {row.note ? (
                    <span className="mt-1 block text-xs" style={MUTED_STYLE}>
                      {row.note}
                    </span>
                  ) : null}
                </th>
                <td className="p-4 text-center" style={{ background: 'var(--mkt-accent-soft)' }}>
                  <CellContent cell={row.atoaxis} locale={locale} />
                </td>
                <td className="p-4 text-center">
                  <CellContent cell={row.wakatime} locale={locale} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-center text-xs" style={MUTED_STYLE}>
        {copy.note} WakaTime is a trademark of its respective owner and is not affiliated with
        AtoAxis.
      </p>
      <p className="mt-2 text-center text-xs" style={MUTED_STYLE}>
        {copy.source}:{' '}
        {PRIMARY_SOURCES.map((source, index) => (
          <span key={source.href}>
            {index > 0 ? ', ' : null}
            <a
              className="underline underline-offset-4"
              href={source.href}
              rel="noreferrer"
              target="_blank"
            >
              {source.label}
            </a>
          </span>
        ))}
        . {copy.review}: {copy.nextReview}.
      </p>
    </section>
  );
}
