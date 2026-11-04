'use client';

import { useState } from 'react';

import { MetricStrip, Widget } from '@/components/wakaclock/workspace';
import { cn } from '@/lib/utils';
import type { AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

const pad = (hour: number) => String(hour).padStart(2, '0');

function hourlyTotals(data: AnalyticsExplorerResponse) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    seconds: data.time_heatmap
      .filter((item) => item.hour === hour)
      .reduce((sum, item) => sum + item.total_seconds, 0),
  }));
  const peak = hours.reduce((best, item) => (item.seconds > best.seconds ? item : best), hours[0]);
  return { hours, peak };
}

/** The range at a glance: attended time, active days and the busiest local hour. */
export function TimelineMetrics({ data }: { data: AnalyticsExplorerResponse }) {
  const { peak } = hourlyTotals(data);
  return (
    <MetricStrip
      aria-label="Range summary"
      metrics={[
        {
          label: 'Time in motion',
          value: formatDurationShort(data.summary.total_seconds),
          hint: 'Total attended time',
        },
        {
          label: 'Active days',
          value: (
            <>
              {data.summary.active_days}
              <span className="text-muted-foreground text-sm font-normal">
                {' '}
                / {data.range.days_included}
              </span>
            </>
          ),
          hint: 'Days with recorded activity',
        },
        {
          label: 'Busiest local hour',
          value: peak.seconds ? `${pad(peak.hour)}:00` : '—',
          hint: `${formatDurationShort(peak.seconds)} across the selected dates`,
        },
        {
          label: 'Range',
          value: <span className="text-sm">{`${data.range.start} → ${data.range.end}`}</span>,
          hint: data.range.timezone,
        },
      ]}
    />
  );
}

/**
 * Activity by local hour across the selected dates. Each column is a button; the readout
 * follows the selection and starts on the busiest hour.
 */
export function DailyRhythm({ data }: { data: AnalyticsExplorerResponse }) {
  const [selected, setSelected] = useState<null | number>(null);
  const { hours, peak } = hourlyTotals(data);
  const current = hours[selected ?? peak.hour];
  const maximum = Math.max(peak.seconds, 1);

  return (
    <Widget
      action={
        <p aria-live="polite" className="text-right">
          <span className="block text-lg leading-tight font-semibold tabular-nums">
            {pad(current.hour)}:00
          </span>
          <span className="text-muted-foreground text-xs">
            {formatDurationShort(current.seconds)} recorded
          </span>
        </p>
      }
      description="Activity by local hour across your selected dates. Select a column to explore."
      title="Daily rhythm"
    >
      <div
        aria-label="Activity by hour"
        className="flex h-40 items-end gap-1 border-b pt-2"
        role="group"
      >
        {hours.map(({ hour, seconds }) => (
          <button
            aria-label={`${pad(hour)}:00, ${formatDurationShort(seconds)}`}
            aria-pressed={current.hour === hour}
            className="group flex h-full min-w-0 flex-1 flex-col justify-end"
            key={hour}
            onClick={() => setSelected(hour)}
            type="button"
          >
            <span
              className={cn(
                'block w-full rounded-t-[3px] transition-[background-color,opacity] duration-150',
                current.hour === hour ? 'bg-primary' : 'bg-primary/35 group-hover:bg-primary/60',
                seconds === 0 && 'bg-muted'
              )}
              style={{ height: `${Math.max((seconds / maximum) * 100, seconds ? 3 : 1.5)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="text-muted-foreground mt-2 flex justify-between text-[11px] tabular-nums">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </Widget>
  );
}
