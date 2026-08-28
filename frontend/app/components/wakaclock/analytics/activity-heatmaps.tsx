'use client';

import * as React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function intensity(value: number, max: number) {
  if (value <= 0 || max <= 0) return 0.08;
  return Math.max(0.18, Math.min(1, 0.18 + (value / max) * 0.82));
}

export function CalendarHeatmap({
  data,
  onSelectDate,
}: {
  data: AnalyticsExplorerResponse;
  onSelectDate: (date: string) => void;
}) {
  const max = Math.max(0, ...data.calendar_heatmap.map((cell) => cell.total_seconds));
  const firstDate = data.calendar_heatmap[0]?.date;
  const leading = firstDate
    ? (new Date(`${firstDate}T00:00:00Z`).getUTCDay() + 6) % 7
    : 0;
  const leadingCells = firstDate
    ? Array.from({ length: leading }, (_, offset) => {
        const date = new Date(`${firstDate}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() - (leading - offset));
        return { cell: null, key: date.toISOString().slice(0, 10) };
      })
    : [];
  const cells = [
    ...leadingCells,
    ...data.calendar_heatmap.map((cell) => ({ cell, key: cell.date })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar heatmap</CardTitle>
        <CardDescription>Click a day to drill the global date range down to that day.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="flex min-w-max gap-3">
          <div className="text-muted-foreground grid grid-rows-7 gap-1 pt-0.5 text-[10px] leading-5">
            {WEEKDAYS.map((day) => (
              <span className="h-5" key={day}>
                {day.slice(0, 3)}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-1">
            {cells.map(({ cell, key }) =>
              cell ? (
                <button
                  aria-label={`${cell.date}: ${formatDurationShort(cell.total_seconds)}`}
                  className="bg-primary focus-visible:ring-ring h-5 w-5 rounded-[3px] focus-visible:ring-2 focus-visible:outline-none"
                  key={key}
                  onClick={() => onSelectDate(cell.date)}
                  style={{ opacity: intensity(cell.total_seconds, max) }}
                  title={`${cell.date}\nTotal ${formatDurationShort(cell.total_seconds)}\nHuman ${formatDurationShort(cell.human_seconds)}\nAI ${formatDurationShort(cell.ai_seconds)}`}
                  type="button"
                />
              ) : (
                <span className="h-5 w-5" key={key} />
              )
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TimeOfDayHeatmap({ data }: { data: AnalyticsExplorerResponse }) {
  const max = Math.max(0, ...data.time_heatmap.map((cell) => cell.total_seconds));
  const byDay = React.useMemo(
    () =>
      WEEKDAYS.map((weekdayName, weekday) => ({
        cells: data.time_heatmap
          .filter((cell) => cell.weekday === weekday)
          .sort((left, right) => left.hour - right.hour),
        weekdayName,
      })),
    [data.time_heatmap]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time-of-day heatmap</CardTitle>
        <CardDescription>
          See which weekday and hour combinations carry the most attended work.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[860px] space-y-1">
          <div className="text-muted-foreground grid grid-cols-[80px_repeat(24,minmax(28px,1fr))] gap-1 text-center text-[10px]">
            <span />
            {HOURS.map((hour) => (
              <span key={`hour-label-${hour}`}>{hour.toString().padStart(2, '0')}</span>
            ))}
          </div>
          {byDay.map(({ cells, weekdayName }) => (
            <div
              className="grid grid-cols-[80px_repeat(24,minmax(28px,1fr))] gap-1"
              key={weekdayName}
            >
              <span className="text-muted-foreground flex items-center text-xs">{weekdayName}</span>
              {HOURS.map((hour) => {
                const cell = cells.find((item) => item.hour === hour);
                const seconds = cell?.total_seconds ?? 0;
                return (
                  <div
                    aria-label={`${weekdayName} ${hour}:00, ${formatDurationShort(seconds)}`}
                    className="bg-primary h-7 rounded-[3px]"
                    key={`${weekdayName}-${hour}`}
                    role="img"
                    style={{ opacity: intensity(seconds, max) }}
                    title={`${weekdayName} ${hour.toString().padStart(2, '0')}:00\nTotal ${formatDurationShort(seconds)}\nHuman ${formatDurationShort(cell?.human_seconds ?? 0)}\nAI ${formatDurationShort(cell?.ai_seconds ?? 0)}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
