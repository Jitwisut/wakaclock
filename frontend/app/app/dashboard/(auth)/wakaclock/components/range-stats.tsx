'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BreakdownChart } from '@/components/wakaclock/breakdown-chart';
import { EvidenceSplitPanel } from '@/components/wakaclock/evidence-split';
import { QueryState } from '@/components/wakaclock/query-state';
import { StatTile } from '@/components/wakaclock/stat-tile';
import { getStats } from '@/lib/wakaclock/endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { StatsRange } from '@/lib/wakaclock/types';
import { STATS_RANGES } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const RANGE_LABELS: Record<StatsRange, string> = {
  today: 'Today',
  last_7_days: 'Last 7 days',
  last_30_days: 'Last 30 days',
  all_time: 'All time',
};

// Projects deliberately absent: `StatsBreakdownItem` carries only a name, so a project
// here cannot link anywhere. The overview's `TopProjects` panel covers projects instead,
// reading `/projects/analytics` for the stable `project_id` the detail route needs.
const BREAKDOWN_LABELS = {
  languages: 'Languages',
  editors: 'Editors',
  operating_systems: 'Operating systems',
} as const;

export function RangeStats() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const [range, setRange] = React.useState<StatsRange>('last_7_days');
  const [breakdown, setBreakdown] = React.useState<keyof typeof BREAKDOWN_LABELS>('languages');

  const { data, isLoading, error } = useQuery({
    queryKey: wakaclockKeys.stats(userId, range),
    queryFn: () => getStats(userId, range),
    enabled: Boolean(userId),
  });

  const stats = data?.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Stats</CardTitle>
          </div>
          {/*
            `min-w-0` is what actually lets the rail scroll. A flex item defaults to
            min-width:auto, so without it the range tabs hold the header open at their
            content width and push the whole card past the viewport on a phone.
          */}
          <Tabs
            className="max-w-full min-w-0"
            onValueChange={(v) => setRange(v as StatsRange)}
            value={range}
          >
            <TabsList className="no-scrollbar max-w-full justify-start overflow-x-auto">
              {STATS_RANGES.map((r) => (
                <TabsTrigger key={r} value={r}>
                  {RANGE_LABELS[r]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          emptyTitle="No activity in this range"
          error={error}
          isEmpty={!isLoading && !error && stats?.total_seconds === 0}
          isLoading={isLoading}
        >
          {stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="Total" value={stats.text} />
                <StatTile label="Daily average" value={stats.daily_average_text} />
                <StatTile
                  label="Days active"
                  value={`${stats.days_with_activity}/${stats.days_included}`}
                />
                <StatTile
                  label="Best day"
                  subtext={stats.best_day?.date}
                  value={stats.best_day?.text ?? '—'}
                />
              </div>

              {stats.evidence && <EvidenceSplitPanel evidence={stats.evidence} />}

              <Tabs
                className="max-w-full min-w-0"
                onValueChange={(v) => setBreakdown(v as typeof breakdown)}
                value={breakdown}
              >
                <TabsList className="no-scrollbar max-w-full justify-start overflow-x-auto">
                  {(Object.keys(BREAKDOWN_LABELS) as (keyof typeof BREAKDOWN_LABELS)[]).map(
                    (key) => (
                      <TabsTrigger key={key} value={key}>
                        {BREAKDOWN_LABELS[key]}
                      </TabsTrigger>
                    )
                  )}
                </TabsList>
                {(Object.keys(BREAKDOWN_LABELS) as (keyof typeof BREAKDOWN_LABELS)[]).map((key) => (
                  <TabsContent key={key} value={key}>
                    {stats[key].length > 0 ? (
                      <BreakdownChart data={stats[key]} />
                    ) : (
                      <p className="text-muted-foreground py-8 text-center text-sm">
                        No {BREAKDOWN_LABELS[key].toLowerCase()} recorded in this range.
                      </p>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
