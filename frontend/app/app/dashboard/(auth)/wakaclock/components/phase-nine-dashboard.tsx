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
import {
  presentAttributionDataCoverage,
  presentCodeAttribution,
  presentPeriodComparison,
} from '@/lib/wakaclock/dashboard-analytics-presenters';
import { getDashboardAnalytics } from '@/lib/wakaclock/endpoints';
import { formatDurationShort, formatMagnitude, toDivergingNegative } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/**
 * Colour means attribution class; position means direction.
 *
 * Colour means actor class; position means direction. Deletions sit below the zero line,
 * while verified AI, inferred AI and Unknown remain separate series so a boolean cannot
 * collapse materially different evidence classes into one dashboard number.
 */
const chartConfig = {
  ai_verified_added: { color: 'var(--chart-1)', label: 'AI verified' },
  ai_verified_deleted: { color: 'var(--chart-1)', label: 'AI verified deleted' },
  ai_inferred_added: { color: 'var(--chart-3)', label: 'AI inferred' },
  ai_inferred_deleted: { color: 'var(--chart-3)', label: 'AI inferred deleted' },
  human_added: { color: 'var(--chart-2)', label: 'Human' },
  human_deleted: { color: 'var(--chart-2)', label: 'Human deleted' },
  unknown_added: { color: 'var(--chart-4)', label: 'Unknown' },
  unknown_deleted: { color: 'var(--chart-4)', label: 'Unknown deleted' },
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

function MetricCard({ label, subtext, value }: { label: string; subtext?: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
        {subtext && <p className="text-muted-foreground text-xs leading-relaxed">{subtext}</p>}
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
    queryKey: wakaclockKeys.dashboardAnalytics(userId, start, end, timezone),
  });

  // `unattributed_*` is nullable on purpose — the API reports "we cannot tell" rather
  // than a measured zero — so the transform has to preserve null instead of negating it
  // into NaN, which would silently drop the bar.
  const divergingSeries = React.useMemo(
    () =>
      (data?.daily_attribution ?? []).map((row) => ({
        ai_verified_added: row.ai_verified_added ?? 0,
        ai_verified_deleted: toDivergingNegative(row.ai_verified_deleted ?? 0),
        ai_inferred_added: row.ai_inferred_added ?? 0,
        ai_inferred_deleted: toDivergingNegative(row.ai_inferred_deleted ?? 0),
        date: row.date,
        human_added: row.human_added,
        human_deleted: toDivergingNegative(row.human_deleted),
        unknown_added: row.unknown_added ?? row.unattributed_added ?? 0,
        unknown_deleted: toDivergingNegative(row.unknown_deleted ?? row.unattributed_deleted ?? 0),
      })),
    [data]
  );

  const periodComparison = data
    ? presentPeriodComparison(data.summary.previous_period, data.range.days_included)
    : null;
  const codeAttribution = data ? presentCodeAttribution(data.coverage) : null;
  const attributionDataCoverage = data ? presentAttributionDataCoverage(data.coverage) : null;

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
                  {periodComparison && (
                    <MetricCard
                      label={periodComparison.label}
                      subtext={periodComparison.subtext}
                      value={periodComparison.value}
                    />
                  )}
                </div>

                {data.summary.comparable_seconds !== undefined && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricCard
                      label="WakaTime-comparable activity"
                      subtext={`Calculation ${data.summary.calculation_version ?? 'legacy'}`}
                      value={formatDurationShort(data.summary.comparable_seconds)}
                    />
                    <MetricCard
                      label="Additional measured AI time"
                      subtext="Unioned with comparable activity in the main total"
                      value={formatDurationShort(data.summary.ai_additional_seconds ?? 0)}
                    />
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {codeAttribution && (
                    <MetricCard
                      label={codeAttribution.label}
                      subtext={codeAttribution.subtext}
                      value={codeAttribution.value}
                    />
                  )}
                  {attributionDataCoverage && (
                    <MetricCard
                      label={attributionDataCoverage.label}
                      subtext={attributionDataCoverage.subtext}
                      value={attributionDataCoverage.value}
                    />
                  )}
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
                      Additions above the axis, deletions below. Human, verified AI, inferred AI and
                      Unknown remain separate actor classes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer className="h-72 w-full" config={chartConfig}>
                      <BarChart
                        data={divergingSeries}
                        margin={{ left: 0, right: 12 }}
                        stackOffset="sign"
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tickLine={false} tickMargin={8} />
                        <YAxis tickFormatter={formatMagnitude} tickLine={false} tickMargin={8} />
                        <ReferenceLine stroke="var(--border)" y={0} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent formatter={(value) => formatMagnitude(value)} />
                          }
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar
                          dataKey="ai_verified_added"
                          fill="var(--color-ai_verified_added)"
                          stackId="churn"
                        />
                        <Bar
                          dataKey="ai_inferred_added"
                          fill="var(--color-ai_inferred_added)"
                          stackId="churn"
                        />
                        <Bar
                          dataKey="human_added"
                          fill="var(--color-human_added)"
                          stackId="churn"
                        />
                        <Bar
                          dataKey="unknown_added"
                          fill="var(--color-unknown_added)"
                          stackId="churn"
                        />
                        <Bar
                          dataKey="ai_verified_deleted"
                          fill="var(--color-ai_verified_deleted)"
                          fillOpacity={0.55}
                          legendType="none"
                          stackId="churn"
                        />
                        <Bar
                          dataKey="ai_inferred_deleted"
                          fill="var(--color-ai_inferred_deleted)"
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
                          dataKey="unknown_deleted"
                          fill="var(--color-unknown_deleted)"
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
