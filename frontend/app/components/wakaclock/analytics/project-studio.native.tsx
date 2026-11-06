'use client';

import { MetricStrip, Widget } from '@/components/wakaclock/workspace';
import { cn } from '@/lib/utils';
import type { AnalyticsExplorerResponse, AnalyticsFilterOption } from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

/** Series colours for project breakdowns, read from the active theme's chart palette. */
export const studioColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--muted-foreground)',
];

const pad = (hour: number) => String(hour).padStart(2, '0');

/**
 * The project's header: identity and range on the left, total time with a daily
 * sparkline on the right, then the key figures as one strip.
 */
export function ProjectStudio({ data, name }: { data: AnalyticsExplorerResponse; name: string }) {
  const busiest = [...data.calendar_heatmap].sort((a, b) => b.total_seconds - a.total_seconds)[0];
  const active = data.summary.active_days;
  return (
    <section aria-label="Project overview" className="flex flex-col gap-5">
      <Widget className="gap-0" title={<span className="sr-only">Project</span>}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <h2 className="font-display truncate text-2xl font-semibold tracking-tight">{name}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {data.range.start} — {data.range.end} · {data.range.timezone}
            </p>
            <a
              className="text-primary mt-3 inline-block text-sm font-medium underline-offset-4 hover:underline"
              href="#project-files"
            >
              Explore your files
            </a>
          </div>
          <div className="flex items-end gap-4">
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Time invested</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {formatDurationShort(data.summary.total_seconds)}
              </p>
              <p className="text-muted-foreground text-xs">
                Across {active} active {active === 1 ? 'day' : 'days'}
              </p>
            </div>
            <div aria-hidden className="flex h-12 w-32 items-end gap-px">
              {data.calendar_heatmap.map((day) => (
                <i
                  className="bg-primary/60 block flex-1 rounded-t-[2px]"
                  key={day.date}
                  style={{
                    height: `${Math.max(4, (day.total_seconds / (busiest?.total_seconds || 1)) * 100)}%`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </Widget>
      <MetricStrip
        aria-label="Project figures"
        metrics={[
          {
            label: 'Daily average',
            value: formatDurationShort(active ? data.summary.total_seconds / active : 0),
            hint: 'Per active day',
          },
          {
            label: 'Consistency',
            value: `${data.range.days_included ? Math.round((active / data.range.days_included) * 100) : 0}%`,
            hint: `${active} of ${data.range.days_included} days active`,
          },
          {
            label: 'Busiest day',
            value: busiest?.total_seconds ? formatDurationShort(busiest.total_seconds) : '—',
            hint: busiest?.total_seconds ? busiest.date : 'No activity in this range',
          },
          {
            label: 'Your toolkit',
            value: `${data.breakdowns.languages.length} languages`,
            hint: `${data.breakdowns.editors.length} editors in this selection`,
          },
        ]}
      />
    </section>
  );
}

/** A dimension of the project's time as a proportion bar and selectable rows. */
export function StudioBreakdown({
  title,
  eyebrow,
  items,
  selected,
  onSelect,
}: {
  eyebrow: string;
  items: AnalyticsFilterOption[];
  onSelect: (key: string) => void;
  selected?: string;
  title: string;
}) {
  const ordered = [...items].sort((a, b) => b.total_seconds - a.total_seconds);
  const total = ordered.reduce((sum, item) => sum + item.total_seconds, 0);
  return (
    <Widget
      action={
        <span className="text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs">
          {items.length} total
        </span>
      }
      description={`${eyebrow} · Select a row to filter, again to clear.`}
      title={title}
    >
      {ordered.length > 0 && (
        <div aria-hidden className="bg-muted mb-2 flex h-2 gap-px overflow-hidden rounded-full">
          {ordered.map((item, i) => (
            <i
              key={item.key}
              style={{
                flex: item.total_seconds,
                background: studioColors[i % studioColors.length],
              }}
            />
          ))}
        </div>
      )}
      <div className="-mx-2 flex flex-col">
        {ordered.length === 0 && (
          <p className="text-muted-foreground px-2 py-4 text-sm">
            No activity recorded in this selection.
          </p>
        )}
        {ordered.map((item, i) => (
          <button
            aria-pressed={selected === item.key}
            className={cn(
              'hover:bg-accent flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors',
              selected === item.key && 'bg-primary/10'
            )}
            key={item.key}
            onClick={() => onSelect(selected === item.key ? '' : item.key)}
            type="button"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: studioColors[i % studioColors.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            <strong className="font-medium tabular-nums">
              {formatDurationShort(item.total_seconds)}
            </strong>
            <small className="text-muted-foreground w-12 text-right text-xs tabular-nums">
              {total ? ((item.total_seconds / total) * 100).toFixed(1) : '0.0'}%
            </small>
          </button>
        ))}
      </div>
    </Widget>
  );
}

/** Weekday × hour heatmap of the project, with the busiest weekly hour called out. */
export function ProjectRhythm({ data }: { data: AnalyticsExplorerResponse }) {
  const max = Math.max(1, ...data.time_heatmap.map((cell) => cell.total_seconds));
  const peak = [...data.time_heatmap].sort((a, b) => b.total_seconds - a.total_seconds)[0];
  const cells = new Map(data.time_heatmap.map((cell) => [`${cell.weekday}:${cell.hour}`, cell]));
  return (
    <Widget
      description={`Activity by weekday and hour · ${data.range.timezone}`}
      title="When ideas happen"
    >
      {data.time_heatmap.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">
          Hourly activity is not available for this selection.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="grid min-w-[520px] grid-cols-[2.25rem_repeat(24,minmax(0,1fr))] gap-[3px] text-[10px]">
              <span />
              {Array.from({ length: 24 }, (_, hour) => (
                <span className="text-muted-foreground text-center tabular-nums" key={hour}>
                  {hour % 6 === 0 ? pad(hour) : ''}
                </span>
              ))}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, weekday) => (
                <div className="contents" key={day}>
                  <span className="text-muted-foreground self-center">{day}</span>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const cell = cells.get(`${weekday}:${hour}`);
                    const label = `${day} ${pad(hour)}:00 — ${formatDurationShort(cell?.total_seconds ?? 0)}`;
                    return (
                      <span
                        aria-label={label}
                        className="bg-muted aspect-square rounded-[3px]"
                        key={hour}
                        role="img"
                        style={{
                          background: cell?.total_seconds
                            ? `color-mix(in oklab, var(--chart-1) ${25 + (cell.total_seconds / max) * 75}%, var(--card))`
                            : undefined,
                        }}
                        title={label}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-muted mt-4 rounded-lg px-3 py-2.5">
            <strong className="text-sm font-semibold">
              {peak?.total_seconds
                ? `${peak.weekday_name} · ${pad(peak.hour)}:00–${pad(peak.hour + 1)}:00`
                : 'Your rhythm starts here'}
            </strong>
            <p className="text-muted-foreground text-xs">
              {peak?.total_seconds
                ? `${formatDurationShort(peak.total_seconds)} recorded in your busiest weekly hour.`
                : 'No activity in this selection.'}
            </p>
          </div>
        </>
      )}
      <p className="text-muted-foreground mt-3 text-xs">Recorded time, not a productivity score.</p>
    </Widget>
  );
}
