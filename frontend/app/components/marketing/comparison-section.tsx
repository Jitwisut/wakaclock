import { CheckIcon, MinusIcon, XIcon } from 'lucide-react';

const MUTED_STYLE = { color: 'var(--mkt-fg-muted)' };

type Cell =
  | { kind: 'no' }
  | { kind: 'text'; value: string }
  | { kind: 'unknown' }
  | { kind: 'yes' };

interface ComparisonRow {
  label: string;
  wakaclock: Cell;
  wakatime: Cell;
}

const ROWS: ComparisonRow[] = [
  {
    label: 'Self-hosted / on your own infrastructure',
    wakaclock: { kind: 'yes' },
    wakatime: { kind: 'no' },
  },
  {
    label: 'Works with your existing editor plugin',
    wakaclock: { kind: 'text', value: 'Via protocol' },
    wakatime: { kind: 'text', value: 'Native' },
  },
  {
    label: 'AI vs. human code attribution (per agent, per day)',
    wakaclock: { kind: 'yes' },
    wakatime: { kind: 'unknown' },
  },
  {
    label: 'Keystroke and character counts per project',
    wakaclock: { kind: 'yes' },
    wakatime: { kind: 'unknown' },
  },
  {
    label: 'AST-based language detection (tree-sitter)',
    wakaclock: { kind: 'yes' },
    wakatime: { kind: 'unknown' },
  },
  {
    label: 'Underlying data store you can query yourself',
    wakaclock: { kind: 'text', value: 'ClickHouse' },
    wakatime: { kind: 'unknown' },
  },
  {
    label: 'Import an existing WakaTime data export',
    wakaclock: { kind: 'yes' },
    wakatime: { kind: 'unknown' },
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
  if (cell.kind === 'unknown') {
    return <MinusIcon aria-label="Not publicly documented" className="mx-auto size-5 opacity-30" />;
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
          Switching from WakaTime is a config change,
          <br />
          not a migration
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base" style={MUTED_STYLE}>
          Same heartbeat protocol, same plugin you already installed — different server, different
          guarantees.
        </p>
      </div>

      <div
        className="overflow-hidden rounded-2xl border"
        style={{ borderColor: 'var(--mkt-border)', background: 'var(--mkt-bg-elevated)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--mkt-border)' }}>
              <th className="p-4 text-left font-medium" style={MUTED_STYLE}>
                &nbsp;
              </th>
              <th
                className="p-4 text-center font-semibold"
                style={{
                  color: 'var(--mkt-accent)',
                  fontFamily: 'var(--font-mkt-mono), monospace',
                }}
              >
                Azyren
              </th>
              <th className="p-4 text-center font-medium" style={MUTED_STYLE}>
                WakaTime
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} style={{ borderBottom: '1px solid var(--mkt-border)' }}>
                <td className="p-4 text-left">{row.label}</td>
                <td className="p-4 text-center" style={{ background: 'var(--mkt-accent-soft)' }}>
                  <CellContent cell={row.wakaclock} />
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
        — indicates a feature not publicly documented by WakaTime at the time of writing, not a
        confirmed absence.
      </p>
    </section>
  );
}
