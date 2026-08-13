import { CheckIcon, XIcon } from 'lucide-react';

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
const VERIFIED_ON = 'August 2026';

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
    label: 'Automatic AI agent tracking (Claude Code, Cursor, Codex, Copilot)',
    atoaxis: { kind: 'no' },
    wakatime: { kind: 'yes' },
    note: 'WakaTime ships dedicated plugins for these agents. AtoAxis accepts AI attribution on its API but no shipped client populates it automatically.',
  },
  {
    label: 'AI token usage and estimated cost',
    atoaxis: { kind: 'no' },
    wakatime: { kind: 'yes' },
    note: 'Not tracked by AtoAxis at all — there is no token or cost field in its pipeline.',
  },
  {
    label: 'Team and organisation dashboards',
    atoaxis: { kind: 'no' },
    wakatime: { kind: 'yes' },
    note: 'AtoAxis analytics are scoped to a single account.',
  },
  {
    label: 'Free tier',
    atoaxis: { kind: 'no' },
    wakatime: { kind: 'yes' },
  },
];

function CellContent({ cell }: { cell: Cell }) {
  if (cell.kind === 'yes') {
    return (
      <CheckIcon
        aria-label="Yes"
        className="mx-auto size-5"
        style={{ color: 'var(--mkt-accent)' }}
      />
    );
  }
  if (cell.kind === 'no') {
    return <XIcon aria-label="No" className="mx-auto size-5 opacity-40" />;
  }

  return <span className="text-sm font-medium">{cell.value}</span>;
}

export function ComparisonSection() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-20 md:px-6" id="compare">
      <div className="mb-10 text-center">
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: 'var(--font-mkt-mono), monospace' }}
        >
          AtoAxis compared with WakaTime
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base" style={MUTED_STYLE}>
          Only rows where both products could be verified are listed, including the four where
          WakaTime is ahead. If automatic AI agent tracking or team dashboards matter most to
          you, WakaTime is the better fit today.
        </p>
      </div>

      <div
        className="overflow-x-auto rounded-2xl border"
        style={{ borderColor: 'var(--mkt-border)', background: 'var(--mkt-bg-elevated)' }}
      >
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="sr-only">
            Feature comparison between AtoAxis and WakaTime, verified {VERIFIED_ON}
          </caption>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--mkt-border)' }}>
              <th className="p-4 text-left font-medium" scope="col" style={MUTED_STYLE}>
                Capability
              </th>
              <th
                className="p-4 text-center font-semibold"
                scope="col"
                style={{
                  color: 'var(--mkt-accent)',
                  fontFamily: 'var(--font-mkt-mono), monospace',
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
            {ROWS.map((row) => (
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
                  <CellContent cell={row.atoaxis} />
                </td>
                <td className="p-4 text-center">
                  <CellContent cell={row.wakatime} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-center text-xs" style={MUTED_STYLE}>
        WakaTime details verified against wakatime.com in {VERIFIED_ON}. WakaTime is a trademark of
        its respective owner and is not affiliated with AtoAxis. Check their current documentation
        before deciding.
      </p>
    </section>
  );
}
