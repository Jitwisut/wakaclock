'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDownIcon } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { IncompleteTimeBadge } from '@/components/wakaclock/delivery-status-notice';
import { QueryState } from '@/components/wakaclock/query-state';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { getBrowserTimezone, getSummaries } from '@/lib/wakaclock/endpoints';
import { formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { SummaryDay, SummaryItem } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from '../overview.module.css';

import { OVERVIEW_RANGE_DAYS } from './overview-toolbar';

const chartConfig = {
  seconds: { label: 'Time', color: 'var(--chart-1)' },
} satisfies ChartConfig;

function topItem(items: SummaryItem[]) {
  return [...items].sort((a, b) => b.total_seconds - a.total_seconds)[0];
}

export function SummariesPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  // Follows the overview toolbar's range (30 days by default) instead of its own picker.
  const { start, end } = useWakaclockRange(OVERVIEW_RANGE_DAYS);
  const timezone = getBrowserTimezone();

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.summaries(userId, start, end, timezone),
    queryFn: () => getSummaries(userId, start, end),
    enabled: Boolean(userId),
  });

  const days = data?.days ?? [];
  const chartData = days.map((day) => ({
    date: day.date,
    seconds:
      day.grand_total.active_coverage === 'measured'
        ? (day.grand_total.active_seconds ?? 0)
        : day.grand_total.total_seconds,
  }));
  const comparableSeconds = days.reduce(
    (sum, day) => sum + (day.grand_total.comparable_seconds ?? 0),
    0
  );
  const timeoutSeconds = days.reduce((sum, day) => sum + day.grand_total.total_seconds, 0);
  const hasDurationV2 = days.some((day) => day.grand_total.comparable_seconds !== undefined);
  const activeSeconds = days.reduce(
    (sum, day) =>
      sum +
      (day.grand_total.active_coverage === 'measured' ? (day.grand_total.active_seconds ?? 0) : 0),
    0
  );
  const hasActive = days.some((day) => day.grand_total.active_coverage === 'measured');

  return (
    <Card>
      <CardHeader>
        <IncompleteTimeBadge />
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Daily summaries</CardTitle>
            <CardDescription>Your coding time per day across the selected range</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          error={error}
          isEmpty={!isLoading && !error && days.length === 0}
          isLoading={isLoading}
        >
          <div className="space-y-6">
            <ChartContainer className="h-64 w-full" config={chartConfig}>
              <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="summaryHoursFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-seconds)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-seconds)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeOpacity={0.5} vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tickFormatter={formatDurationShort}
                  tickLine={false}
                  width={48}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatDurationShort(Number(value))}
                    />
                  }
                  cursor={{
                    stroke: 'var(--color-seconds)',
                    strokeDasharray: '4 4',
                    strokeOpacity: 0.6,
                  }}
                />
                <Area
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
                  animationDuration={900}
                  dataKey="seconds"
                  fill="url(#summaryHoursFill)"
                  stroke="var(--color-seconds)"
                  strokeWidth={2.5}
                  type="monotone"
                />
              </AreaChart>
            </ChartContainer>

            {(hasDurationV2 || hasActive) && (
              <dl aria-label="Duration comparison" className="grid gap-3 sm:grid-cols-3">
                {hasActive && (
                  <div className="border-primary/30 bg-primary/5 rounded-md border p-3">
                    <dt className="text-muted-foreground text-xs">Measured Active</dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {formatDurationShort(activeSeconds)}
                    </dd>
                  </div>
                )}
                <div className="rounded-md border p-3">
                  <dt className="text-muted-foreground text-xs">Editor-only activity</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {formatDurationShort(comparableSeconds)}
                  </dd>
                </div>
                <div className="rounded-md border p-3">
                  <dt className="text-muted-foreground text-xs">Activity with timeout</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {formatDurationShort(timeoutSeconds)}
                  </dd>
                </div>
              </dl>
            )}
            <p className="text-muted-foreground text-xs">
              Measured Active and Activity with timeout overlap; never add them together.
              Editor-only activity excludes all AI Coding and can be zero.
            </p>

            <Collapsible>
              <CollapsibleTrigger className={styles.disclosure}>
                Daily breakdown table ({days.length} {days.length === 1 ? 'day' : 'days'})
                <ChevronDownIcon aria-hidden className="size-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Heartbeats</TableHead>
                        <TableHead>Top language</TableHead>
                        <TableHead>Top project</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {days.map((day: SummaryDay) => (
                        <TableRow key={day.date}>
                          <TableCell className="font-mono text-xs">{day.date}</TableCell>
                          <TableCell>{day.grand_total.text}</TableCell>
                          <TableCell>{day.grand_total.heartbeats}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {day.languages.length > 0 ? topItem(day.languages).name : '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {day.projects.length > 0 ? topItem(day.projects).name : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </QueryState>
      </CardContent>
    </Card>
  );
}
