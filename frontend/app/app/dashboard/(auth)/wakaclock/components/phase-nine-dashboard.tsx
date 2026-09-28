'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { BarChart3Icon } from 'lucide-react';
import { motion } from 'motion/react';
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
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import {
  presentAttributionDataCoverage,
  presentCodeAttribution,
} from '@/lib/wakaclock/dashboard-analytics-presenters';
import { getDashboardAnalytics } from '@/lib/wakaclock/endpoints';
import { formatMagnitude, toDivergingNegative } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from '../overview.module.css';

import { OVERVIEW_RANGE_DAYS } from './overview-toolbar';

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

const UNAVAILABLE = 'Unavailable';

/** A compact metric well. "Unavailable" renders quieter than a measured value so the
 *  eye lands on what the API could actually measure. */
function MetricCard({ label, subtext, value }: { label: string; subtext?: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span
        className={
          value === UNAVAILABLE
            ? `${styles.metricValue} ${styles.metricUnavailable}`
            : styles.metricValue
        }
      >
        {value}
      </span>
      {subtext && <p className={styles.metricSub}>{subtext}</p>}
    </div>
  );
}

function MetricGroup({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className={styles.metricGroup}>
      <h3 className={styles.metricGroupTitle}>{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
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
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        {items.length === 0 && (
          <p className="text-muted-foreground text-xs">Nothing recorded in this range.</p>
        )}
        {items.slice(0, 5).map((item, index) => (
          <div key={item.name}>
            <div className="mb-1.5 flex justify-between gap-3 text-sm">
              <span className="truncate">{item.name}</span>
              <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                {item.text} · {item.percentage.toFixed(1)}%
              </span>
            </div>
            <div className={styles.bar}>
              <motion.div
                className={styles.barFill}
                initial={{ scaleX: 0 }}
                style={{ width: `${Math.min(item.percentage, 100)}%` }}
                transition={{ delay: 0.05 * index, duration: 0.8 }}
                viewport={{ once: true }}
                whileInView={{ scaleX: 1 }}
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
  const { start, end } = useWakaclockRange(OVERVIEW_RANGE_DAYS);
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
  const hasAttribution = divergingSeries.some((row) =>
    Object.entries(row).some(
      ([key, value]) => key !== 'date' && typeof value === 'number' && value !== 0
    )
  );

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
          <span className="text-muted-foreground rounded-full border px-3 py-1 font-mono text-xs">
            {start} → {end}
          </span>
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
              {/* Today, averages, best day, period change and the comparable/AI-time pair
                  moved to the hero, Highlights, Stats and Daily summaries respectively, so
                  this card now holds only what no other panel shows. */}
              <DashboardPanel id="overview.analytics-metrics">
                <div className="space-y-5">
                  <MetricGroup title="Code attribution">
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
                    <MetricCard
                      label="Token coverage"
                      value={percent(data.coverage.token_percent)}
                    />
                    <MetricCard label="Cost coverage" value={percent(data.coverage.cost_percent)} />
                  </MetricGroup>

                  <MetricGroup title="AI usage">
                    <MetricCard label="Prompts" value={count(data.usage.prompts)} />
                    <MetricCard label="AI sessions" value={count(data.usage.sessions)} />
                    <MetricCard label="Reported tokens" value={count(data.usage.tokens.total)} />
                    <MetricCard
                      label="Estimated spend"
                      value={spend(data.usage.estimated_spend.amount_microusd)}
                    />
                  </MetricGroup>
                </div>
              </DashboardPanel>

              <DashboardPanel id="overview.analytics-attribution">
                <Card className="gap-4">
                  <CardHeader>
                    <CardTitle className="text-base">Daily code-change attribution</CardTitle>
                    <CardDescription>
                      Additions above the axis, deletions below. Human, verified AI, inferred AI and
                      Unknown remain separate actor classes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!hasAttribution ? (
                      <div className={styles.chartEmpty}>
                        <BarChart3Icon aria-hidden className="size-6" />
                        <strong>No code changes recorded in this range</strong>
                        <p>
                          Line additions and deletions appear here once an editor or AI agent
                          reports code-change attribution.
                        </p>
                      </div>
                    ) : (
                      <ChartContainer className="h-72 w-full" config={chartConfig}>
                        <BarChart
                          data={divergingSeries}
                          margin={{ left: 0, right: 12 }}
                          maxBarSize={22}
                          stackOffset="sign"
                        >
                          <CartesianGrid strokeOpacity={0.5} vertical={false} />
                          <XAxis
                            axisLine={false}
                            dataKey="date"
                            tickFormatter={(value: string) => value.slice(5)}
                            tickLine={false}
                            tickMargin={8}
                          />
                          <YAxis
                            axisLine={false}
                            tickFormatter={formatMagnitude}
                            tickLine={false}
                            tickMargin={8}
                          />
                          <ReferenceLine stroke="var(--border)" y={0} />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent formatter={(value) => formatMagnitude(value)} />
                            }
                            cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
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
                    )}
                  </CardContent>
                </Card>
              </DashboardPanel>

              <DashboardPanel id="overview.analytics-breakdowns">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
