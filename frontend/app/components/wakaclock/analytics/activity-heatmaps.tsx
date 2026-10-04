'use client';

import { useState } from 'react';

import { Activity, CalendarDays, Trophy } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyticsDurationSplit, AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

import styles from './activity-heatmaps.module.css';

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
    : { backgroundColor: `color-mix(in oklab, var(--primary) ${strength}%, var(--muted))` };
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
    // Every generated week intersects the validated range; label its first included day.
    const firstInRange = new Date(Math.max(cursor.getTime(), rangeStart.getTime()));
    weeks.push({
      cells,
      key: dateKey(cursor),
      monthLabel: MONTH_FORMATTER.format(firstInRange),
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
                    backgroundColor: `color-mix(in oklab, var(--primary) ${strength}%, var(--muted))`,
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
  const [inspectedDate, setInspectedDate] = useState<null | string>(null);
  const weeks = buildCalendarWeeks(data);
  const inspected = weeks
    .flatMap((week) => week.cells)
    .find((cell) => cell.date === inspectedDate && cell.inRange);
  const max = Math.max(0, ...data.calendar_heatmap.map((cell) => cell.total_seconds));

  return (
    <div className={styles.calendar}>
      <div className={styles.scroll}>
        <div className={styles.matrix}>
          <div className={styles.months}>
            {weeks.map((week, index) => {
              const previous = weeks[index - 1]?.monthLabel;
              const showLabel = week.monthLabel && week.monthLabel !== previous;
              return (
                <div className={styles.month} key={week.key}>
                  {showLabel ? <span className="block w-8">{week.monthLabel}</span> : null}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <div className={styles.weekdays}>
              {WEEKDAYS.map((day) => (
                <div className={styles.dayLabel} key={day}>
                  {day}
                </div>
              ))}
            </div>

            <div className={styles.columns}>
              {weeks.map((week) => (
                <div className={styles.week} key={week.key}>
                  {week.cells.map((cell) => {
                    if (!cell.inRange) {
                      return <span className={styles.spacer} key={cell.date} />;
                    }
                    return (
                      <button
                        aria-label={`${cell.date}: ${formatDurationShort(cell.total_seconds)}`}
                        className={styles.tile}
                        data-active={cell.total_seconds > 0}
                        key={cell.date}
                        onClick={() => onSelectDate(cell.date)}
                        onFocus={() => setInspectedDate(cell.date)}
                        onMouseEnter={() => setInspectedDate(cell.date)}
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
      <div aria-live="polite" className={styles.readout}>
        <span>
          {inspected?.inRange &&
          inspected.date >= data.range.start &&
          inspected.date <= data.range.end
            ? inspected.date
            : 'SELECT A PIXEL'}
        </span>
        <strong>
          {inspected && inspected.date >= data.range.start && inspected.date <= data.range.end
            ? formatDurationShort(inspected.total_seconds)
            : 'Explore your activity'}
        </strong>
        <span>Hover or focus to inspect · Click to open that day</span>
      </div>
    </div>
  );
}

function WeeklyActivityChart({
  data,
  onSelectDate,
}: {
  data: AnalyticsExplorerResponse;
  onSelectDate: (date: string) => void;
}) {
  const points = buildLatestWeek(data);
  const max = Math.max(1, ...points.map((point) => point.totalSeconds));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Weekly Activity</CardTitle>
        <CardDescription>
          Latest Monday–Sunday week. Only days in your selected range are included.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={styles.barPlot}>
          {points.map((point) => {
            const height =
              point.totalSeconds > 0 ? Math.max(8, (point.totalSeconds / max) * 100) : 0;
            return (
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end" key={point.date}>
                <span className={styles.barValue}>{formatDurationShort(point.totalSeconds)}</span>
                <button
                  aria-label={`${point.date}: ${formatDurationShort(point.totalSeconds)}`}
                  className={styles.bar}
                  data-empty={point.totalSeconds === 0}
                  disabled={point.date < data.range.start || point.date > data.range.end}
                  onClick={() => onSelectDate(point.date)}
                  style={{ height: `${height}%` }}
                  title={`${point.date}\n${formatDurationShort(point.totalSeconds)}`}
                  type="button"
                />
              </div>
            );
          })}
        </div>
        <div className="text-muted-foreground grid grid-cols-7 px-2 pt-2 text-center text-xs">
          {points.map((point) => (
            <span key={point.date}>{point.label}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyProgressChart({ data }: { data: AnalyticsExplorerResponse }) {
  const points = buildMonthlyActivity(data);
  const max = Math.max(1, ...points.map((point) => point.totalSeconds));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Monthly Progress</CardTitle>
        <CardDescription>
          Time recorded in each month of this range. Partial months are included.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={styles.monthly}>
          {points.map((point) => (
            <div className={styles.monthRow} key={point.key}>
              <div className={styles.monthHeading}>
                <span>
                  {point.label} <small>{point.key.slice(0, 4)}</small>
                </span>
                <strong>{formatDurationShort(point.totalSeconds)}</strong>
              </div>
              <div
                aria-label={`${point.key}: ${formatDurationShort(point.totalSeconds)}`}
                className={styles.track}
                role="img"
              >
                <div
                  className={styles.trackFill}
                  style={{ width: `${(point.totalSeconds / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className={styles.scaleNote}>Bars scale to the busiest month in this range.</p>
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
  const activeDays = data.calendar_heatmap.filter((day) => day.total_seconds > 0);
  const total = activeDays.reduce((sum, day) => sum + day.total_seconds, 0);
  const best = activeDays.reduce<(typeof activeDays)[number] | null>(
    (winner, day) => (!winner || day.total_seconds > winner.total_seconds ? day : winner),
    null
  );
  return (
    <div className={styles.board}>
      <div className={styles.intro}>
        <div>
          <span className={styles.kicker}>ACTIVITY ARCADE / YOUR FOCUS MAP</span>
          <h2>Every pixel tells a story.</h2>
          <p>Discover your rhythm, one day at a time.</p>
        </div>
        <div aria-hidden="true" className={styles.pixelArt}>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className={styles.stats}>
        <div>
          <Activity aria-hidden size={18} />
          <span>Tracked time</span>
          <strong>{formatDurationShort(total)}</strong>
        </div>
        <div>
          <CalendarDays aria-hidden size={18} />
          <span>Active days</span>
          <strong>
            {activeDays.length}
            <small> days</small>
          </strong>
        </div>
        <div>
          <Trophy aria-hidden size={18} />
          <span>Peak day · {best?.date ?? '—'}</span>
          <strong>{best ? formatDurationShort(best.total_seconds) : '—'}</strong>
        </div>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>Activity heatmap</CardTitle>
              <CardDescription className="mt-1">
                Each pixel is one day. Color intensity is relative to the busiest day in this range.
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
        <WeeklyActivityChart data={data} onSelectDate={onSelectDate} />
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
