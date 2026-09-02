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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AiAttributionLegend } from '@/components/wakaclock/ai-attribution-legend';
import { AiDiagnosticsPanel } from '@/components/wakaclock/ai-diagnostics-panel';
import { AiIntegrationsPanel } from '@/components/wakaclock/ai-integrations-panel';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { RequireUser } from '@/components/wakaclock/require-user';
import { StatTile } from '@/components/wakaclock/stat-tile';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { getAiDiagnostics, getAiStats } from '@/lib/wakaclock/endpoints';
import { formatCompactNumber, formatPercent } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const actorColors = {
  ai_inferred: 'var(--chart-2)',
  ai_verified: 'var(--chart-1)',
  human: 'var(--chart-3)',
  unknown: 'var(--chart-5)',
} as const;

const attributionConfig = {
  heartbeats: { label: 'Heartbeats' },
  ai_inferred: { label: 'AI inferred', color: actorColors.ai_inferred },
  ai_verified: { label: 'AI verified', color: actorColors.ai_verified },
  human: { label: 'Human', color: actorColors.human },
  unknown: { label: 'Unknown', color: actorColors.unknown },
} satisfies ChartConfig;

const dailyConfig = {
  ai_inferred_lines_added: { label: 'AI inferred lines', color: actorColors.ai_inferred },
  ai_verified_lines_added: { label: 'AI verified lines', color: actorColors.ai_verified },
  human_lines_added: { label: 'Human lines added', color: actorColors.human },
  unknown_lines_added: { label: 'Unknown lines', color: actorColors.unknown },
} satisfies ChartConfig;

function AiStatsPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const { start, end, setRange } = useWakaclockRange(14);

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.aiStats(userId, start, end),
    queryFn: () => getAiStats(userId, start, end),
    enabled: Boolean(userId),
  });

  const { data: diagnostics } = useQuery({
    queryKey: wakaclockKeys.aiDiagnostics(userId),
    queryFn: () => getAiDiagnostics(userId),
    enabled: Boolean(userId),
  });

  const stats = data?.data;
  const aiPct = stats?.ai_heartbeat_percentage ?? 0;
  const aiVerifiedPct = stats?.ai_verified_heartbeat_percentage ?? 0;
  const aiInferredPct = stats?.ai_inferred_heartbeat_percentage ?? 0;
  const humanPct = stats?.human_heartbeat_percentage ?? 0;
  const unknownPct = stats?.unknown_heartbeat_percentage ?? 0;
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
        <div className="flex flex-wrap items-center justify-between gap-3">
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
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-7">
                <StatTile label="AI heartbeats" value={formatPercent(aiPct)} />
                <StatTile
                  label="AI verified lines"
                  subtext={`${formatCompactNumber(stats.total_ai_verified_lines_deleted)} deleted`}
                  value={formatCompactNumber(stats.total_ai_verified_lines_added)}
                />
                <StatTile
                  label="AI inferred lines"
                  subtext={`${formatCompactNumber(stats.total_ai_inferred_lines_deleted)} deleted`}
                  value={formatCompactNumber(stats.total_ai_inferred_lines_added)}
                />
                <StatTile
                  label="Human lines added"
                  subtext={`${formatCompactNumber(stats.total_human_lines_deleted)} deleted`}
                  value={formatCompactNumber(stats.total_human_lines_added)}
                />
                <StatTile
                  label="Unknown lines"
                  subtext={`${formatCompactNumber(stats.total_unknown_lines_deleted)} deleted`}
                  value={formatCompactNumber(stats.total_unknown_lines_added)}
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

              <DashboardPanel id="ai.charts">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Human / AI verified / AI inferred / Unknown heartbeats</h3>
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
                    <h3 className="mb-2 text-sm font-medium">Daily attribution</h3>
                    <ChartContainer className="h-64 w-full" config={dailyConfig}>
                      <BarChart data={stats.daily} margin={{ left: 4, right: 4 }}>
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
                          dataKey="ai_verified_lines_added"
                          fill="var(--color-ai_verified_lines_added)"
                          radius={3}
                        />
                        <Bar
                          dataKey="ai_inferred_lines_added"
                          fill="var(--color-ai_inferred_lines_added)"
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
              </DashboardPanel>

              <AiAttributionLegend
                aiInferredPercent={aiInferredPct}
                aiVerifiedPercent={aiVerifiedPct}
                humanPercent={humanPct}
                unknownPercent={unknownPct}
              />

              <AiDiagnosticsPanel report={diagnostics?.report ?? null} />
              <AiIntegrationsPanel report={diagnostics?.report ?? null} />

              <div>
                <h3 className="mb-2 text-sm font-medium">Agents</h3>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Actor</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Provider / model</TableHead>
                        <TableHead>AI added</TableHead>
                        <TableHead>AI deleted</TableHead>
                        <TableHead>Human added</TableHead>
                        <TableHead>Unknown</TableHead>
                        <TableHead className="text-right">Heartbeats</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.agents.map((agent) => (
                        <TableRow
                          key={`${agent.actor_type}:${agent.agent}:${agent.provider ?? ''}:${agent.model ?? ''}`}
                        >
                          <TableCell className="capitalize">
                            {agent.actor_type.replaceAll('_', ' ')}
                          </TableCell>
                          <TableCell className="font-medium">{agent.agent}</TableCell>
                          <TableCell>
                            {agent.provider ?? 'unknown'} / {agent.model ?? 'unknown'}
                          </TableCell>
                          <TableCell>{formatCompactNumber(agent.ai_lines_added)}</TableCell>
                          <TableCell>{formatCompactNumber(agent.ai_lines_deleted)}</TableCell>
                          <TableCell>{formatCompactNumber(agent.human_lines_added)}</TableCell>
                          <TableCell>{formatCompactNumber(agent.unknown_lines_added)}</TableCell>
                          <TableCell className="text-right">
                            {formatCompactNumber(agent.heartbeat_count)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

export default function AiStatsPage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="Separate verified AI activity, positively attributed human changes, and work whose author is not yet proven."
        title="AI Stats"
      />
      <RequireUser>
        <AiStatsPanel />
      </RequireUser>
    </div>
  );
}
