'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { RequireUser } from '@/components/wakaclock/require-user';
import { StatTile } from '@/components/wakaclock/stat-tile';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { getAiStats } from '@/lib/wakaclock/endpoints';
import { formatCompactNumber, formatPercent } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const attributionConfig = {
  heartbeats: { label: 'Heartbeats' },
  ai: { label: 'AI-assisted', color: 'var(--chart-1)' },
  human: { label: 'Human', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const dailyConfig = {
  ai_lines_added: { label: 'AI lines added', color: 'var(--chart-1)' },
  human_keystrokes: { label: 'Human keystrokes', color: 'var(--chart-3)' },
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
  const pieData = stats
    ? [
        { key: 'ai', heartbeats: Math.round(aiPct * 10) / 10, fill: 'var(--color-ai)' },
        { key: 'human', heartbeats: Math.round((100 - aiPct) * 10) / 10, fill: 'var(--color-human)' },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>AI code attribution</CardTitle>
            <CardDescription>GET /users/current/ai_stats</CardDescription>
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
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="AI heartbeats" value={formatPercent(aiPct)} />
                <StatTile
                  label="AI lines added"
                  subtext={`${formatCompactNumber(stats.total_ai_lines_deleted)} deleted`}
                  value={formatCompactNumber(stats.total_ai_lines_added)}
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

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-medium">AI vs. human heartbeats</h3>
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
                      <Bar dataKey="ai_lines_added" fill="var(--color-ai_lines_added)" radius={3} />
                      <Bar
                        dataKey="human_keystrokes"
                        fill="var(--color-human_keystrokes)"
                        radius={3}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Agents</h3>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead>Lines added</TableHead>
                        <TableHead>Lines deleted</TableHead>
                        <TableHead className="text-right">Heartbeats</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.agents.map((agent) => (
                        <TableRow key={agent.agent}>
                          <TableCell className="font-medium">{agent.agent}</TableCell>
                          <TableCell>{formatCompactNumber(agent.ai_lines_added)}</TableCell>
                          <TableCell>{formatCompactNumber(agent.ai_lines_deleted)}</TableCell>
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
        description="How much of your code comes from AI agents vs. human keystrokes."
        title="AI Stats"
      />
      <RequireUser>
        <AiStatsPanel />
      </RequireUser>
    </div>
  );
}
