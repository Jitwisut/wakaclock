'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BreakdownChart } from '@/components/wakaclock/breakdown-chart';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RequireUser } from '@/components/wakaclock/require-user';
import { getInsights } from '@/lib/wakaclock/endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { InsightType, StatsRange } from '@/lib/wakaclock/types';
import { INSIGHT_TYPES, STATS_RANGES } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const TYPE_LABELS: Record<InsightType, string> = {
  languages: 'Languages',
  projects: 'Projects',
  editors: 'Editors',
  operating_systems: 'Operating systems',
  branches: 'Branches',
};

const RANGE_LABELS: Record<StatsRange, string> = {
  today: 'Today',
  last_7_days: 'Last 7 days',
  last_30_days: 'Last 30 days',
  all_time: 'All time',
};

function InsightsPanel() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [type, setType] = React.useState<InsightType>('languages');
  const [range, setRange] = React.useState<StatsRange>('last_7_days');

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.insights(userId, type, range),
    queryFn: () => getInsights(userId, type, range),
    enabled: Boolean(userId),
  });

  const rows = data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Insights</CardTitle>
            <CardDescription>GET /insights/:type/:range</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select onValueChange={(v) => setType(v as InsightType)} value={type}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSIGHT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tabs onValueChange={(v) => setRange(v as StatsRange)} value={range}>
              <TabsList>
                {STATS_RANGES.map((r) => (
                  <TabsTrigger key={r} value={r}>
                    {RANGE_LABELS[r]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          emptyTitle={`No ${TYPE_LABELS[type].toLowerCase()} recorded`}
          error={error}
          isEmpty={!isLoading && !error && rows.length === 0}
          isLoading={isLoading}
        >
          <div className="space-y-6">
            <BreakdownChart data={rows} />
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>{TYPE_LABELS[type]}</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Active days</TableHead>
                    <TableHead className="text-right">Heartbeats</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...rows]
                    .sort((a, b) => b.total_seconds - a.total_seconds)
                    .map((row, i) => (
                      <TableRow key={row.name}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="font-mono text-xs">{row.text}</TableCell>
                        <TableCell>{row.days}</TableCell>
                        <TableCell className="text-right">
                          {row.heartbeats.toLocaleString()}
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

export default function InsightsPage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="Ranked breakdowns with unique active-day counts."
        title="Insights"
      />
      <RequireUser>
        <InsightsPanel />
      </RequireUser>
    </div>
  );
}
