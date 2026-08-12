'use client';

import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { getSummaries } from '@/lib/wakaclock/endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { SummaryDay, SummaryItem } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const chartConfig = {
  hours: { label: 'Hours', color: 'var(--chart-1)' },
} satisfies ChartConfig;

function topItem(items: SummaryItem[]) {
  return [...items].sort((a, b) => b.total_seconds - a.total_seconds)[0];
}

export function SummariesPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const { start, end, setRange } = useWakaclockRange(7);

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.summaries(userId, start, end),
    queryFn: () => getSummaries(userId, start, end),
    enabled: Boolean(userId),
  });

  const days = data?.days ?? [];
  const chartData = days.map((day) => ({
    date: day.date,
    hours: Number(day.grand_total.hours.toFixed(2)),
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Daily summaries</CardTitle>
            <CardDescription>GET /summaries</CardDescription>
          </div>
          <RangePicker onChange={setRange} value={{ start, end }} />
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          error={error}
          isEmpty={!isLoading && !error && days.length === 0}
          isLoading={isLoading}
        >
          <div className="space-y-6">
            <ChartContainer className="h-56 w-full" config={chartConfig}>
              <AreaChart data={chartData} margin={{ left: 8, right: 8 }}>
                <defs>
                  <linearGradient id="summaryHoursFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-hours)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-hours)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  tickLine={false}
                />
                <YAxis axisLine={false} tickLine={false} unit="h" width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="hours"
                  fill="url(#summaryHoursFill)"
                  stroke="var(--color-hours)"
                  strokeWidth={2}
                  type="monotone"
                />
              </AreaChart>
            </ChartContainer>

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
          </div>
        </QueryState>
      </CardContent>
    </Card>
  );
}
