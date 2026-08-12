import { LockIcon } from 'lucide-react';

const MKT_FG_MUTED = 'var(--mkt-fg-muted)';
const MKT_BORDER = 'var(--mkt-border)';

const WEEKLY_BARS = [
  { day: 'Mon', pct: 55 },
  { day: 'Tue', pct: 78 },
  { day: 'Wed', pct: 40 },
  { day: 'Thu', pct: 92 },
  { day: 'Fri', pct: 65 },
  { day: 'Sat', pct: 18 },
  { day: 'Sun', pct: 10 },
];

const STAT_TILES = [
  { label: 'Today', value: '5h 42m' },
  { label: 'This week', value: '28h 10m' },
  { label: 'AI-assisted', value: '34%' },
  { label: 'Active project', value: 'azyren' },
];

export function DashboardPreviewSection() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 md:px-6">
      <div className="mb-10 text-center">
        <h2
          className="text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ fontFamily: 'var(--font-mkt-mono), monospace' }}
        >
          Everything you&apos;d expect, plus what you can&apos;t get elsewhere
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: MKT_FG_MUTED }}>
          Illustrative preview — layout and data shown for orientation only.
        </p>
      </div>

      <div
        className="overflow-hidden rounded-2xl border shadow-xl"
        style={{ borderColor: MKT_BORDER, background: 'var(--mkt-bg-elevated)' }}
      >
        <div
          aria-hidden
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: MKT_BORDER, background: 'var(--mkt-bg-sunken)' }}
        >
          <span className="size-2.5 rounded-full bg-red-500/70" />
          <span className="size-2.5 rounded-full bg-yellow-500/70" />
          <span className="size-2.5 rounded-full bg-green-500/70" />
          <div
            className="ml-3 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs"
            style={{ background: 'var(--mkt-bg)', color: MKT_FG_MUTED }}
          >
            <LockIcon aria-hidden className="size-3" />
            your-azyren.example.com/dashboard
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {STAT_TILES.map((tile) => (
              <div
                className="rounded-lg border p-4"
                key={tile.label}
                style={{ borderColor: MKT_BORDER }}
              >
                <p className="text-xs" style={{ color: MKT_FG_MUTED }}>
                  {tile.label}
                </p>
                <p
                  className="mt-1 text-lg font-semibold"
                  style={{ fontFamily: 'var(--font-mkt-mono), monospace' }}
                >
                  {tile.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border p-4" style={{ borderColor: MKT_BORDER }}>
            <p className="mb-4 text-xs font-medium" style={{ color: MKT_FG_MUTED }}>
              Activity — last 7 days
            </p>
            <div className="flex h-32 items-end gap-3">
              {WEEKLY_BARS.map((bar) => (
                <div className="flex flex-1 flex-col items-center gap-2" key={bar.day}>
                  <div
                    className="w-full rounded-t-sm"
                    style={{
                      height: `${bar.pct}%`,
                      background: 'var(--mkt-accent)',
                      opacity: 0.85,
                    }}
                  />
                  <span className="text-[10px]" style={{ color: MKT_FG_MUTED }}>
                    {bar.day}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
