'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { DashboardPanel } from '@/components/dashboard-panels';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

const keystrokeChartConfig = {
  keystrokes: { label: 'Keystrokes', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const actionChartConfig = {
  copy_actions: { label: 'Copy actions', color: 'var(--chart-2)' },
  paste_actions: { label: 'Paste actions', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const characterChartConfig = {
  copied_chars: { label: 'Copied characters', color: 'var(--chart-2)' },
  pasted_chars: { label: 'Pasted characters', color: 'var(--chart-4)' },
} satisfies ChartConfig;

export function ClipboardCoverageNotice({ percent }: { percent: number }) {
  if (percent === 0) {
    return (
      <Alert>
        <AlertTitle>Clipboard tracking was not available for this range</AlertTitle>
        <AlertDescription>
          These heartbeats came from an older extension, so zero cannot be interpreted as no Copy
          or Paste activity.
        </AlertDescription>
      </Alert>
    );
  }
  if (percent < 100) {
    return (
      <Alert>
        <AlertTitle>Partial clipboard coverage</AlertTitle>
        <AlertDescription>
          {percent.toFixed(1)}% of VS Code heartbeats support clipboard metrics. Copy and Paste
          totals may be incomplete.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}

export function KeystrokesPanel() {
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
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Input activity</CardTitle>
          </div>
          <RangePicker onChange={setRange} value={{ start, end }} />
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          error={error}
          isEmpty={!isLoading && !error && stats?.days_with_activity === 0}
          isLoading={isLoading}
        >
          {stats && (
            <div className="space-y-6">
              <ClipboardCoverageNotice percent={stats.clipboard_coverage.percent} />

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
                <StatTile
                  label="Keystrokes"
                  value={formatCompactNumber(stats.total_keystrokes)}
                />
                <StatTile
                  label="Copy actions"
                  value={formatCompactNumber(stats.total_copy_actions)}
                />
                <StatTile
                  label="Paste actions"
                  value={formatCompactNumber(stats.total_paste_actions)}
                />
                <StatTile
                  label="Pasted characters"
                  value={formatCompactNumber(stats.total_pasted_chars)}
                />
                <StatTile
                  label="Pasted lines"
                  value={formatCompactNumber(stats.total_pasted_lines)}
                />
                <StatTile label="Active days" value={String(stats.days_with_activity)} />
              </div>

              <DashboardPanel id="keystrokes.chart">
                <div className="grid gap-6 xl:grid-cols-3">
                  <ChartContainer className="h-56 w-full" config={keystrokeChartConfig}>
                    <LineChart data={stats.daily} margin={{ left: 4, right: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis axisLine={false} dataKey="date" tickFormatter={(v: string) => v.slice(5)} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} width={48} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line dataKey="keystrokes" dot={false} stroke="var(--color-keystrokes)" strokeWidth={2} type="monotone" />
                    </LineChart>
                  </ChartContainer>
                  <ChartContainer className="h-56 w-full" config={actionChartConfig}>
                    <BarChart data={stats.daily} margin={{ left: 4, right: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis axisLine={false} dataKey="date" tickFormatter={(v: string) => v.slice(5)} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} width={48} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="copy_actions" fill="var(--color-copy_actions)" radius={3} />
                      <Bar dataKey="paste_actions" fill="var(--color-paste_actions)" radius={3} />
                    </BarChart>
                  </ChartContainer>
                  <ChartContainer className="h-56 w-full" config={characterChartConfig}>
                    <LineChart data={stats.daily} margin={{ left: 4, right: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis axisLine={false} dataKey="date" tickFormatter={(v: string) => v.slice(5)} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} width={48} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line dataKey="copied_chars" dot={false} stroke="var(--color-copied_chars)" strokeWidth={2} type="monotone" />
                      <Line dataKey="pasted_chars" dot={false} stroke="var(--color-pasted_chars)" strokeWidth={2} type="monotone" />
                    </LineChart>
                  </ChartContainer>
                </div>
              </DashboardPanel>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatTile label="Same file" value={formatCompactNumber(stats.total_paste_same_file_actions)} />
                <StatTile label="Same workspace" value={formatCompactNumber(stats.total_paste_same_workspace_actions)} />
                <StatTile label="External or unknown" value={formatCompactNumber(stats.total_paste_external_or_unknown_actions)} />
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Keystrokes</TableHead>
                      <TableHead>Chars added</TableHead>
                      <TableHead>Chars deleted</TableHead>
                      <TableHead>Copy actions</TableHead>
                      <TableHead>Paste actions</TableHead>
                      <TableHead>Copied/Pasted chars</TableHead>
                      <TableHead className="text-right">Copied/Pasted lines</TableHead>
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
                          <TableCell>{formatCompactNumber(project.chars_deleted)}</TableCell>
                          <TableCell>{formatCompactNumber(project.copy_actions)}</TableCell>
                          <TableCell>{formatCompactNumber(project.paste_actions)}</TableCell>
                          <TableCell>
                            {formatCompactNumber(project.copied_chars)} /{' '}
                            {formatCompactNumber(project.pasted_chars)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCompactNumber(project.copied_lines)} /{' '}
                            {formatCompactNumber(project.pasted_lines)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-muted-foreground text-sm">
                Clipboard contents are never sent or stored. Paste lines remain Unattributed until
                direct provenance proves otherwise. Copy also includes Cut when VS Code reports the
                operation through its copy-to-clipboard callback. Historical keystroke totals may
                include pasted character volume.
              </p>
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
        description="Keystrokes and privacy-preserving Copy/Paste metadata from the editor."
        title="Input Activity"
      />
      <RequireUser>
        <KeystrokesPanel />
      </RequireUser>
    </div>
  );
}
