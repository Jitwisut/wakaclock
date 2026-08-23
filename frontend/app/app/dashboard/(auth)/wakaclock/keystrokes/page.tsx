'use client';

import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { DashboardPanel } from '@/components/dashboard-panels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { RequireUser } from '@/components/wakaclock/require-user';
import { StatTile } from '@/components/wakaclock/stat-tile';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { getKeystrokeStats } from '@/lib/wakaclock/endpoints';
import { formatCompactNumber } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const chartConfig = {
  keystrokes: { label: 'Keystrokes', color: 'var(--chart-2)' },
} satisfies ChartConfig;

function KeystrokesPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const { start, end, setRange } = useWakaclockRange(14);

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.keystrokeStats(userId, start, end),
    queryFn: () => getKeystrokeStats(userId, start, end),
    enabled: Boolean(userId),
  });

  const stats = data?.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Combat log</CardTitle>
          </div>
          <RangePicker onChange={setRange} value={{ start, end }} />
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          error={error}
          isEmpty={!isLoading && !error && stats?.total_keystrokes === 0}
          isLoading={isLoading}
        >
          {stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile
                  label="Total keystrokes"
                  value={formatCompactNumber(stats.total_keystrokes)}
                />
                <StatTile
                  label="Chars added"
                  value={formatCompactNumber(stats.total_chars_added)}
                />
                <StatTile
                  label="Chars deleted"
                  value={formatCompactNumber(stats.total_chars_deleted)}
                />
                <StatTile label="Active days" value={String(stats.days_with_activity)} />
              </div>

              <DashboardPanel id="keystrokes.chart">
                <ChartContainer className="h-56 w-full" config={chartConfig}>
                  <LineChart data={stats.daily} margin={{ left: 4, right: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="date"
                      tickFormatter={(v: string) => v.slice(5)}
                      tickLine={false}
                    />
                    <YAxis axisLine={false} tickLine={false} width={48} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      dataKey="keystrokes"
                      dot={false}
                      stroke="var(--color-keystrokes)"
                      strokeWidth={2}
                      type="monotone"
                    />
                  </LineChart>
                </ChartContainer>
              </DashboardPanel>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Keystrokes</TableHead>
                      <TableHead>Chars added</TableHead>
                      <TableHead className="text-right">Chars deleted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...stats.projects]
                      .sort((a, b) => b.keystrokes - a.keystrokes)
                      .map((project) => (
                        <TableRow key={project.name}>
                          <TableCell className="font-medium">{project.name}</TableCell>
                          <TableCell>{formatCompactNumber(project.keystrokes)}</TableCell>
                          <TableCell>{formatCompactNumber(project.chars_added)}</TableCell>
                          <TableCell className="text-right">
                            {formatCompactNumber(project.chars_deleted)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

export default function KeystrokesPage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="Every keystroke logged as combat volume, independent of AI attribution."
        title="Keystrokes"
      />
      <RequireUser>
        <KeystrokesPanel />
      </RequireUser>
    </div>
  );
}
