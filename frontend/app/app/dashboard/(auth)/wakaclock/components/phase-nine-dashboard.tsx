'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';

import { DashboardPanel } from '@/components/dashboard-panels';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { getDashboardAnalytics } from '@/lib/wakaclock/endpoints';
import {
  formatDurationShort,
  formatMagnitude,
  toDivergingNegative,
} from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/**
 * Colour means attribution class; position means direction.
 *
 * This used to be two stacks of three bars sharing three colours, so `ai_added` and
 * `ai_deleted` rendered identically and the legend listed six entries in three colours
 * with no way to tell the stacks apart. Deletions now sit below the zero line — the usual
 * shape for code churn — so direction no longer has to compete with colour for meaning.
 * The deleted series keep their class colour at a lighter fill and stay out of the legend,
 * which leaves three legend entries for three colours.
 */
const chartConfig = {
  ai_added: { color: 'var(--chart-1)', label: 'AI' },
  ai_deleted: { color: 'var(--chart-1)', label: 'AI deleted' },
  human_added: { color: 'var(--chart-2)', label: 'Human' },
  human_deleted: { color: 'var(--chart-2)', label: 'Human deleted' },
  unattributed_added: { color: 'var(--chart-4)', label: 'Unattributed' },
  unattributed_deleted: { color: 'var(--chart-4)', label: 'Unattributed deleted' },
} satisfies ChartConfig;

function percent(value: null | number) {
  return value === null ? 'Unavailable' : `${value.toFixed(1)}%`;
}

function count(value: null | number) {
  return value === null ? 'Unavailable' : value.toLocaleString();
}

function spend(value: null | number) {
  return value === null ? 'Unavailable' : `$${(value / 1_000_000).toFixed(2)}`;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function BreakdownList({
  items,
  title,
}: {
  items: Array<{ name: string; percentage: number; text: string; value: number }>;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.slice(0, 5).map((item) => (
          <div key={item.name}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="truncate">{item.name}</span>
              <span className="text-muted-foreground shrink-0">
                {item.text} · {item.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${Math.min(item.percentage, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Phase 9 dashboard contract: all panels share one date range and one API response. */
export function PhaseNineDashboard() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const { start, end, setRange } = useWakaclockRange(30);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { data, error, isLoading } = useQuery({
    enabled: Boolean(userId),
    queryFn: () => getDashboardAnalytics({ end, start, timezone }),
    queryKey: [...wakaclockKeys.all, 'dashboard-analytics', userId, start, end, timezone],
  });

  // `unattributed_*` is nullable on purpose — the API reports "we cannot tell" rather
  // than a measured zero — so the transform has to preserve null instead of negating it
  // into NaN, which would silently drop the bar.
  const divergingSeries = React.useMemo(
    () =>
      (data?.daily_attribution ?? []).map((row) => ({
        ai_added: row.ai_added,
        ai_deleted: toDivergingNegative(row.ai_deleted),
        date: row.date,
        human_added: row.human_added,
        human_deleted: toDivergingNegative(row.human_deleted),
        unattributed_added: row.unattributed_added,
        unattributed_deleted: toDivergingNegative(row.unattributed_deleted),
      })),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Analytics</CardTitle>
            <CardDescription>
              AI attribution is code-change attribution, not a measure of time or quality.
            </CardDescription>
          </div>
          <RangePicker onChange={setRange} value={{ start, end }} />
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          emptyDescription="No heartbeats were recorded in this range."
          error={error}
          isEmpty={!isLoading && !error && data?.summary.calendar_day_average_seconds === 0}
          isLoading={isLoading}
          skeletonClassName="h-72 w-full"
        >
          {data && (
            <div className="space-y-6">
              <DashboardPanel id="overview.analytics-metrics">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Today"
                    value={formatDurationShort(data.summary.today_seconds)}
                  />
                  <MetricCard
                    label="Active-day average"
                    value={formatDurationShort(data.summary.active_day_average_seconds)}
                  />
                  <MetricCard
                    label="Best day"
                    value={data.summary.most_active_day?.text ?? 'No activity'}
                  />
                  <MetricCard
                    label="Previous period"
                    value={`${data.summary.previous_period.percent?.toFixed(1) ?? '—'}% ${data.summary.previous_period.direction}`}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <MetricCard
                    label="Attribution coverage"
                    value={percent(data.coverage.attribution_percent)}
                  />
                  <MetricCard label="Token coverage" value={percent(data.coverage.token_percent)} />
                  <MetricCard label="Cost coverage" value={percent(data.coverage.cost_percent)} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard label="Prompts" value={count(data.usage.prompts)} />
                  <MetricCard label="AI sessions" value={count(data.usage.sessions)} />
                  <MetricCard label="Reported tokens" value={count(data.usage.tokens.total)} />
                  <MetricCard
                    label="Estimated spend"
                    value={spend(data.usage.estimated_spend.amount_microusd)}
                  />
                </div>
              </DashboardPanel>

              <DashboardPanel id="overview.analytics-attribution">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Daily code-change attribution</CardTitle>
                    <CardDescription>
                      Additions above the axis, deletions below. Unknown provenance remains
                      Unattributed.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer className="h-72 w-full" config={chartConfig}>
                      <BarChart data={divergingSeries} margin={{ left: 0, right: 12 }} stackOffset="sign">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tickLine={false} tickMargin={8} />
                        <YAxis tickFormatter={formatMagnitude} tickLine={false} tickMargin={8} />
                        <ReferenceLine stroke="var(--border)" y={0} />
                        <ChartTooltip
                          content={<ChartTooltipContent formatter={(value) => formatMagnitude(value)} />}
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="ai_added" fill="var(--color-ai_added)" stackId="churn" />
                        <Bar
                          dataKey="human_added"
                          fill="var(--color-human_added)"
                          stackId="churn"
                        />
                        <Bar
                          dataKey="unattributed_added"
                          fill="var(--color-unattributed_added)"
                          stackId="churn"
                        />
                        <Bar
                          dataKey="ai_deleted"
                          fill="var(--color-ai_deleted)"
                          fillOpacity={0.55}
                          legendType="none"
                          stackId="churn"
                        />
                        <Bar
                          dataKey="human_deleted"
                          fill="var(--color-human_deleted)"
                          fillOpacity={0.55}
                          legendType="none"
                          stackId="churn"
                        />
                        <Bar
                          dataKey="unattributed_deleted"
                          fill="var(--color-unattributed_deleted)"
                          fillOpacity={0.55}
                          legendType="none"
                          stackId="churn"
                        />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </DashboardPanel>

              <DashboardPanel id="overview.analytics-breakdowns">
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  <BreakdownList items={data.breakdowns.languages.items} title="Languages" />
                  <BreakdownList items={data.breakdowns.editors.items} title="Editors" />
                  <BreakdownList items={data.breakdowns.models.items} title="AI models" />
                  <BreakdownList
                    items={data.breakdowns.operating_systems.items}
                    title="Operating systems"
                  />
                  <BreakdownList items={data.breakdowns.machines.items} title="Machines" />
                  <BreakdownList items={data.breakdowns.weekdays.items} title="Weekdays" />
                </div>
              </DashboardPanel>
            </div>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
