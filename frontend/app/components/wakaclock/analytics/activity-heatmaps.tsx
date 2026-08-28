'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyticsDurationSplit, AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_MS = 86_400_000;

const MONTH_FORMATTER = new Intl.DateTimeFormat('en', {
  month: 'short',
  timeZone: 'UTC',
});

interface CalendarCell extends AnalyticsDurationSplit {
  date: string;
  inRange: boolean;
}

interface WeekColumn {
  cells: CalendarCell[];
  key: string;
  monthLabel: string;
}

export interface WeeklyActivityPoint {
  date: string;
  label: (typeof WEEKDAYS)[number];
  totalSeconds: number;
}

export interface MonthlyActivityPoint {
  key: string;
  label: string;
  totalSeconds: number;
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const weekday = (result.getUTCDay() + 6) % 7;
  result.setUTCDate(result.getUTCDate() - weekday);
  return result;
}

function endOfWeek(date: Date) {
  const result = startOfWeek(date);
  result.setUTCDate(result.getUTCDate() + 6);
  return result;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function emptySplit(): AnalyticsDurationSplit {
  return { ai_seconds: 0, human_seconds: 0, other_seconds: 0, total_seconds: 0 };
}

function heatStrength(value: number, max: number) {
  if (value <= 0 || max <= 0) return 0;
  const ratio = Math.min(1, value / max);
  if (ratio <= 0.25) return 24;
  if (ratio <= 0.5) return 45;
  if (ratio <= 0.75) return 68;
  return 92;
}

function heatStyle(value: number, max: number) {
  const strength = heatStrength(value, max);
  return strength === 0
    ? { backgroundColor: 'var(--muted)' }
    : { backgroundColor: `color-mix(in oklab, var(--primary) ${strength}%, transparent)` };
}

export function buildCalendarWeeks(data: AnalyticsExplorerResponse): WeekColumn[] {
  const byDate = new Map(data.calendar_heatmap.map((cell) => [cell.date, cell]));
  const rangeStart = parseDate(data.range.start);
  const rangeEnd = parseDate(data.range.end);
  const gridStart = startOfWeek(rangeStart);
  const gridEnd = endOfWeek(rangeEnd);
  const weeks: WeekColumn[] = [];

  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 7)) {
    const cells = Array.from({ length: 7 }, (_, weekday) => {
      const date = addDays(cursor, weekday);
      const key = dateKey(date);
      const source = byDate.get(key);
      return {
        ...(source ?? emptySplit()),
        date: key,
        inRange: date >= rangeStart && date <= rangeEnd,
      };
    });
    const firstInRange = cells.find((cell) => cell.inRange);
    weeks.push({
      cells,
      key: dateKey(cursor),
      monthLabel: firstInRange ? MONTH_FORMATTER.format(parseDate(firstInRange.date)) : '',
    });
  }

  return weeks;
}

export function buildLatestWeek(data: AnalyticsExplorerResponse): WeeklyActivityPoint[] {
  const byDate = new Map(data.calendar_heatmap.map((cell) => [cell.date, cell.total_seconds]));
  const weekStart = startOfWeek(parseDate(data.range.end));
  return WEEKDAYS.map((label, weekday) => {
    const date = dateKey(addDays(weekStart, weekday));
    return { date, label, totalSeconds: byDate.get(date) ?? 0 };
  });
}

export function buildMonthlyActivity(data: AnalyticsExplorerResponse): MonthlyActivityPoint[] {
  const totals = new Map<string, number>();
  for (const cell of data.calendar_heatmap) {
    const month = cell.date.slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + cell.total_seconds);
  }

  const start = parseDate(data.range.start);
  const end = parseDate(data.range.end);
  const points: MonthlyActivityPoint[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const finalMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= finalMonth) {
    const key = dateKey(cursor).slice(0, 7);
    points.push({
      key,
      label: MONTH_FORMATTER.format(cursor),
      totalSeconds: totals.get(key) ?? 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return points;
}

function HeatLegend() {
  const levels = [0, 24, 45, 68, 92];
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <span>Less</span>
      <div className="flex gap-1">
        {levels.map((strength) => (
          <span
            aria-hidden="true"
            className="border-border size-3 rounded-[2px] border"
            key={strength}
            style={
              strength === 0
                ? { backgroundColor: 'var(--muted)' }
                : {
                    backgroundColor: `color-mix(in oklab, var(--primary) ${strength}%, transparent)`,
                  }
            }
          />
        ))}
      </div>
      <span>More</span>
    </div>
  );
}

function CalendarActivityGrid({
  data,
  onSelectDate,
}: {
  data: AnalyticsExplorerResponse;
  onSelectDate: (date: string) => void;
}) {
  const weeks = buildCalendarWeeks(data);
  const max = Math.max(0, ...data.calendar_heatmap.map((cell) => cell.total_seconds));

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-max">
        <div className="mb-1.5 ml-10 flex gap-1">
          {weeks.map((week, index) => {
            const previous = weeks[index - 1]?.monthLabel;
            const showLabel = week.monthLabel && week.monthLabel !== previous;
            return (
              <div className="text-muted-foreground w-3 text-[10px]" key={week.key}>
                {showLabel ? <span className="block w-8">{week.monthLabel}</span> : null}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <div className="text-muted-foreground grid grid-rows-7 gap-1 text-[10px]">
            {WEEKDAYS.map((day, index) => (
              <div className="flex h-3 w-8 items-center" key={day}>
                {index % 2 === 0 ? day : ''}
              </div>
            ))}
          </div>

          <div className="flex gap-1">
            {weeks.map((week) => (
              <div className="grid grid-rows-7 gap-1" key={week.key}>
                {week.cells.map((cell) => {
                  if (!cell.inRange) {
                    return <span className="size-3" key={cell.date} />;
                  }
                  return (
                    <button
                      aria-label={`${cell.date}: ${formatDurationShort(cell.total_seconds)}`}
                      className="border-border focus-visible:ring-ring size-3 rounded-[2px] border transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:outline-none"
                      key={cell.date}
                      onClick={() => onSelectDate(cell.date)}
                      style={heatStyle(cell.total_seconds, max)}
                      title={`${cell.date}\nTotal ${formatDurationShort(cell.total_seconds)}\nHuman ${formatDurationShort(cell.human_seconds)}\nAI ${formatDurationShort(cell.ai_seconds)}`}
                      type="button"
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeeklyActivityChart({ data }: { data: AnalyticsExplorerResponse }) {
  const points = buildLatestWeek(data);
  const max = Math.max(1, ...points.map((point) => point.totalSeconds));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Weekly Activity</CardTitle>
        <CardDescription>Tracked time for the latest Monday–Sunday week in this range.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-52 items-end gap-2 border-b px-2 pt-5">
          {points.map((point) => {
            const height = point.totalSeconds > 0 ? Math.max(8, (point.totalSeconds / max) * 100) : 3;
            return (
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end" key={point.date}>
                <div
                  aria-label={`${point.date}: ${formatDurationShort(point.totalSeconds)}`}
                  className="bg-primary/80 hover:bg-primary relative w-full rounded-t-sm transition-colors"
                  role="img"
                  style={{ height: `${height}%` }}
                  title={`${point.date}\n${formatDurationShort(point.totalSeconds)}`}
                />
              </div>
            );
          })}
        </div>
        <div className="text-muted-foreground grid grid-cols-7 px-2 pt-2 text-center text-xs">
          {points.map((point) => (
            <span key={point.date}>{point.label.slice(0, 1)}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyProgressChart({ data }: { data: AnalyticsExplorerResponse }) {
  const points = buildMonthlyActivity(data);
  const max = Math.max(1, ...points.map((point) => point.totalSeconds));
  const width = 100;
  const height = 44;
  const coordinates = points.map((point, index) => {
    const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - (point.totalSeconds / max) * (height - 6) - 3;
    return { ...point, x, y };
  });
  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(' ');
  const area = coordinates.length > 0 ? `0,${height} ${polyline} ${width},${height}` : '';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Monthly Progress</CardTitle>
        <CardDescription>Monthly tracked-time trend within the selected date range.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-52 border-b border-l">
          {coordinates.length > 0 ? (
            <svg
              aria-label="Monthly tracked-time trend"
              className="absolute inset-0 size-full overflow-visible"
              preserveAspectRatio="none"
              role="img"
              viewBox={`0 0 ${width} ${height}`}
            >
              <polygon className="fill-primary/10" points={area} />
              <polyline
                className="stroke-primary"
                fill="none"
                points={polyline}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              {coordinates.map((point) => (
                <circle
                  className="fill-primary"
                  cx={point.x}
                  cy={point.y}
                  key={point.key}
                  r="1.4"
                  vectorEffect="non-scaling-stroke"
                >
                  <title>{`${point.key}: ${formatDurationShort(point.totalSeconds)}`}</title>
                </circle>
              ))}
            </svg>
          ) : null}
        </div>
        <div
          className="text-muted-foreground grid pt-2 text-center text-xs"
          style={{ gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))` }}
        >
          {points.map((point) => (
            <span className="truncate" key={point.key}>{point.label}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ActivityHeatmapBoard({
  data,
  onSelectDate,
}: {
  data: AnalyticsExplorerResponse;
  onSelectDate: (date: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>Activity heatmap</CardTitle>
              <CardDescription className="mt-1">
                Daily tracked time across the selected range. Click a day to drill down.
              </CardDescription>
            </div>
            <HeatLegend />
          </div>
        </CardHeader>
        <CardContent>
          <CalendarActivityGrid data={data} onSelectDate={onSelectDate} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WeeklyActivityChart data={data} />
        <MonthlyProgressChart data={data} />
      </div>
    </div>
  );
}

export function CalendarHeatmap({
  data,
  onSelectDate,
}: {
  data: AnalyticsExplorerResponse;
  onSelectDate: (date: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar heatmap</CardTitle>
        <CardDescription>Daily tracked time across the selected range.</CardDescription>
      </CardHeader>
      <CardContent>
        <CalendarActivityGrid data={data} onSelectDate={onSelectDate} />
      </CardContent>
    </Card>
  );
}

export function TimeOfDayHeatmap() {
  return null;
}
