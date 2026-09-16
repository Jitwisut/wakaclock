'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis, YAxis } from 'recharts';

import { DashboardPanel } from '@/components/dashboard-panels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { AiAgentsTable } from '@/components/wakaclock/ai-agents-table';
import { AiAttributionLegend } from '@/components/wakaclock/ai-attribution-legend';
import { AiDiagnosticsPanel } from '@/components/wakaclock/ai-diagnostics-panel';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { RequireUser } from '@/components/wakaclock/require-user';
import { StatTile } from '@/components/wakaclock/stat-tile';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { formatAiIdentityReason } from '@/lib/wakaclock/ai-display';
import { getAiDiagnostics, getAiDiagnosticsV2, getAiStats } from '@/lib/wakaclock/endpoints';
import { formatCompactNumber, formatPercent } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const attributionConfig = {
  heartbeats: { label: 'Heartbeats' },
  ai_verified: { label: 'AI verified', color: 'var(--chart-1)' },
  ai_inferred: { label: 'AI inferred', color: 'var(--chart-2)' },
  human: { label: 'Human', color: 'var(--chart-3)' },
  unknown: { label: 'Unknown authorship', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const dailyConfig = {
  ai_lines_added: { label: 'AI lines added', color: 'var(--chart-1)' },
  human_lines_added: { label: 'Human lines added', color: 'var(--chart-3)' },
  unknown_lines_added: { label: 'Unknown lines added', color: 'var(--chart-4)' },
} satisfies ChartConfig;

function AiStatsPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const { start, end, setRange } = useWakaclockRange(14);

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.aiStats(userId, start, end),
    queryFn: () => getAiStats(userId, start, end),
    enabled: Boolean(userId),
  });

  const stats = data?.data;
  const aiPct = stats?.ai_heartbeat_percentage ?? 0;
  const aiVerifiedPct = stats?.ai_verified_heartbeat_percentage ?? 0;
  const aiInferredPct = stats?.ai_inferred_heartbeat_percentage ?? 0;
  const humanPct = stats?.human_heartbeat_percentage ?? 0;
  const unknownPct = stats?.unknown_heartbeat_percentage ?? 0;
  const coverageStatus =
    stats?.coverage?.status ?? (stats?.total_heartbeats ? 'partial' : 'no_activity');
  const knownHeartbeatCount = stats?.coverage
    ? Math.max(0, stats.coverage.heartbeat_denominator - stats.coverage.unknown_heartbeats)
    : null;
  const pieData = stats
    ? [
        {
          key: 'ai_verified',
          heartbeats: Math.round(aiVerifiedPct * 10) / 10,
          fill: 'var(--color-ai_verified)',
        },
        {
          key: 'ai_inferred',
          heartbeats: Math.round(aiInferredPct * 10) / 10,
          fill: 'var(--color-ai_inferred)',
        },
        {
          key: 'human',
          heartbeats: Math.round(humanPct * 10) / 10,
          fill: 'var(--color-human)',
        },
        {
          key: 'unknown',
          heartbeats: Math.round(unknownPct * 10) / 10,
          fill: 'var(--color-unknown)',
        },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>AI party member</CardTitle>
          </div>
          <RangePicker onChange={setRange} value={{ start, end }} />
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          error={error}
          isEmpty={!isLoading && !error && stats?.total_heartbeats === 0}
          isLoading={isLoading}
        >
          {stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <StatTile label="AI heartbeats" value={formatPercent(aiPct)} />
                <StatTile
                  label="AI lines added"
                  subtext={`${formatCompactNumber(stats.total_ai_lines_deleted)} deleted`}
                  value={formatCompactNumber(stats.total_ai_lines_added)}
                />
                <StatTile
                  label="Human lines added"
                  subtext={`${formatCompactNumber(stats.total_human_lines_deleted)} deleted`}
                  value={formatCompactNumber(stats.total_human_lines_added)}
                />
                <StatTile
                  label="Human keystrokes"
                  value={formatCompactNumber(stats.total_human_keystrokes)}
                />
                <StatTile
                  label="Total heartbeats"
                  value={formatCompactNumber(stats.total_heartbeats)}
                />
              </div>

              <div className="rounded-md border p-3 text-sm" role="status">
                <p className="font-medium">
                  Attribution coverage: {coverageStatus.replaceAll('_', ' ')}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Coverage describes received events, not all coding activity. Line totals show
                  measured changes; missing measurements are marked in the agent table. These
                  changes are not retained code or a productivity score.
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {stats.coverage
                    ? `Event evidence: ${formatCompactNumber(knownHeartbeatCount ?? 0)} of ${formatCompactNumber(stats.coverage.heartbeat_denominator)} heartbeats have a known actor.`
                    : 'Event evidence counts are unavailable on this server version.'}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {stats.coverage?.line_coverage_percent == null
                    ? 'Line attribution coverage is unavailable for this range.'
                    : `Line evidence: ${formatCompactNumber(stats.coverage.attributed_line_changes)} of ${formatCompactNumber(stats.coverage.line_change_denominator)} measured line changes have an explicit actor (${formatPercent(stats.coverage.line_coverage_percent)}).`}
                </p>
              </div>

              {stats.identity && (
                <section
                  aria-label="AI identity coverage"
                  className="rounded-md border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">AI identity coverage</p>
                    <p className="text-muted-foreground text-xs">
                      {formatCompactNumber(stats.identity.confirmed_ai_heartbeats)} confirmed
                      {stats.identity.confirmed_ai_heartbeat_percentage != null
                        ? ` (${formatPercent(stats.identity.confirmed_ai_heartbeat_percentage)})`
                        : ''}{' '}
                      · {formatCompactNumber(stats.identity.incomplete_ai_heartbeats)} needs review
                    </p>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Confirmation rate uses all AI verified heartbeats in this range as the
                    denominator ({formatCompactNumber(
                      stats.identity.ai_verified_heartbeat_denominator ??
                        stats.identity.confirmed_ai_heartbeats +
                          stats.identity.incomplete_ai_heartbeats
                    )}).
                  </p>
                  {stats.identity.incomplete_ai_heartbeats > 0 && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Incomplete activity stays in the totals. Provider/model names appear in the
                      confirmed table only when the source evidence is complete.
                    </p>
                  )}
                  {stats.identity.reason_counts.length > 0 && (
                    <ul className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {stats.identity.reason_counts.map((reason) => (
                        <li key={reason.reason}>
                          {formatAiIdentityReason(reason.reason)} ·{' '}
                          {formatCompactNumber(reason.heartbeats)}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              <DashboardPanel id="ai.charts">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Heartbeats by authorship evidence</h3>
                    <ChartContainer
                      className="mx-auto aspect-square max-h-64"
                      config={attributionConfig}
                    >
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        <Pie
                          data={pieData}
                          dataKey="heartbeats"
                          innerRadius={60}
                          nameKey="key"
                          strokeWidth={4}
                        >
                          <Label
                            content={({ viewBox }) => {
                              if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                                return (
                                  <text
                                    dominantBaseline="middle"
                                    textAnchor="middle"
                                    x={viewBox.cx}
                                    y={viewBox.cy}
                                  >
                                    <tspan
                                      className="fill-foreground text-2xl font-bold"
                                      x={viewBox.cx}
                                      y={viewBox.cy}
                                    >
                                      {formatPercent(aiPct, 0)}
                                    </tspan>
                                    <tspan
                                      className="fill-muted-foreground text-xs"
                                      x={viewBox.cx}
                                      y={(viewBox.cy ?? 0) + 20}
                                    >
                                      AI-assisted
                                    </tspan>
                                  </text>
                                );
                              }
                              return null;
                            }}
                          />
                        </Pie>
                        <ChartLegend content={<ChartLegendContent nameKey="key" />} />
                      </PieChart>
                    </ChartContainer>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-medium">Daily AI vs. human activity</h3>
                    <ChartContainer className="h-64 w-full" config={dailyConfig}>
                      <BarChart
                        data={stats.daily.map((row) => ({
                          ...row,
                          unknown_lines_added:
                            row.unknown_lines_added ?? row.unattributed_lines_added ?? 0,
                        }))}
                        margin={{ left: 4, right: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          axisLine={false}
                          dataKey="date"
                          tickFormatter={(v: string) => v.slice(5)}
                          tickLine={false}
                        />
                        <YAxis axisLine={false} tickLine={false} width={40} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar
                          dataKey="ai_lines_added"
                          fill="var(--color-ai_lines_added)"
                          radius={3}
                        />
                        <Bar
                          dataKey="human_lines_added"
                          fill="var(--color-human_lines_added)"
                          radius={3}
                        />
                        <Bar
                          dataKey="unknown_lines_added"
                          fill="var(--color-unknown_lines_added)"
                          radius={3}
                        />
                      </BarChart>
                    </ChartContainer>
                  </div>
                </div>
                <AiAttributionLegend
                  aiInferredPercent={aiInferredPct}
                  aiVerifiedPercent={aiVerifiedPct}
                  humanPercent={humanPct}
                  unknownPercent={unknownPct}
                />
              </DashboardPanel>

              <div>
                <h3 className="mb-2 text-sm font-medium">Which AI?</h3>
                {stats.agents.length > 0 ? (
                  <AiAgentsTable agents={stats.agents} title={null} />
                ) : (
                  <p className="text-muted-foreground rounded-md border p-4 text-sm">
                    No AI activity is available for this range.
                  </p>
                )}
              </div>
            </div>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function AiDiagnosticsPanelContainer() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const legacy = useQuery({
    queryKey: wakaclockKeys.aiDiagnostics(userId),
    queryFn: () => getAiDiagnostics(userId),
    enabled: Boolean(userId),
  });
  const v2 = useQuery({
    queryKey: wakaclockKeys.aiDiagnosticsV2(userId),
    queryFn: () => getAiDiagnosticsV2(userId),
    enabled: Boolean(userId),
  });

  const reports = v2.data?.reports ?? [];
  const legacyReport = legacy.data?.report;
  const hasSnapshot = reports.length > 0 || Boolean(legacyReport);

  return (
    <AiDiagnosticsPanel
      error={hasSnapshot ? undefined : (v2.error ?? legacy.error)}
      isLoading={v2.isLoading || (reports.length === 0 && legacy.isLoading)}
      report={reports[0] ?? legacyReport}
      reports={reports}
    />
  );
}

export default function AiStatsPage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="How much of the work your AI party member carried vs. what you typed yourself."
        title="AI Stats"
      />
      <RequireUser>
        <AiStatsPanel />
        <AiDiagnosticsPanelContainer />
      </RequireUser>
    </div>
  );
}
