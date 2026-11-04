'use client';

import * as React from 'react';

import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { MetricStrip } from '@/components/wakaclock/workspace';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { cn } from '@/lib/utils';
import { getProjectAnalytics } from '@/lib/wakaclock/endpoints';
import { formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { ProjectAnalyticsCard, ProjectAnalyticsListResponse } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

type ProjectSort =
  | 'ai_changes'
  | 'duration'
  | 'estimated_cost'
  | 'prompts'
  | 'recent'
  | 'sessions'
  | 'tokens';

function nullablePercent(value: null | number) {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

function ProjectRow({ project }: { project: ProjectAnalyticsCard }) {
  return (
    <TableRow className="hover:bg-accent/60">
      <TableCell className="max-w-64">
        <Link
          className="hover:text-primary block truncate font-medium underline-offset-4 hover:underline"
          href={`/dashboard/wakaclock/projects/${project.project_id}`}
        >
          {project.name}
        </Link>
        <span className="text-muted-foreground block truncate text-xs">
          {project.repository ?? 'Repository not available'}
        </span>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatDurationShort(project.total_seconds)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {project.ai_verified.changes.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {project.ai_inferred.changes.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {project.human.changes.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {project.unknown.changes.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {nullablePercent(project.ai.percentage)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {nullablePercent(project.attribution_coverage_percent)}
      </TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {project.last_activity_at ? new Date(project.last_activity_at).toLocaleDateString() : '—'}
      </TableCell>
    </TableRow>
  );
}

const SORTS = [
  ['duration', 'Duration'],
  ['recent', 'Recent'],
  ['ai_changes', 'AI changes'],
  ['prompts', 'Prompts'],
  ['sessions', 'Sessions'],
  ['tokens', 'Tokens'],
  ['estimated_cost', 'Estimated cost'],
] as const;

function ProjectsAnalytics() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const { start, end, setRange } = useWakaclockRange(30);
  const [sort, setSort] = React.useState<ProjectSort>('duration');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<
      ProjectAnalyticsListResponse,
      Error,
      InfiniteData<ProjectAnalyticsListResponse>,
      readonly unknown[],
      string | undefined
    >({
      enabled: Boolean(userId),
      getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
      initialPageParam: undefined as string | undefined,
      queryFn: ({ pageParam }) =>
        getProjectAnalytics({
          cursor: pageParam ?? undefined,
          end,
          limit: 100,
          order: 'desc',
          sort,
          start,
          timezone,
        }),
      queryKey: [...wakaclockKeys.projectAnalytics(userId, start, end, timezone), sort],
    });
  const pages = data?.pages ?? [];
  const firstPage = pages[0];
  const items = pages.flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-5">
      <WakaclockPageHeader
        actions={<RangePicker onChange={setRange} value={{ start, end }} />}
        description="Stable project identities keep links valid through renames and merges. Open one to inspect activity, attribution, files and branches."
        title="Projects"
      >
        <div
          aria-label="Project sort"
          className="no-scrollbar bg-muted inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg p-0.5 shadow-[inset_0_0_0_1px_var(--border)]"
          role="group"
        >
          {SORTS.map(([value, label]) => (
            <button
              aria-pressed={sort === value}
              className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                sort === value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              key={value}
              onClick={() => setSort(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </WakaclockPageHeader>
      <QueryState
        emptyDescription="No named projects were recorded in this range."
        error={error}
        isEmpty={!isLoading && !error && items.length === 0}
        isLoading={isLoading}
        skeletonClassName="h-72 w-full"
      >
        {firstPage && (
          <div className="flex flex-col gap-5">
            <MetricStrip
              aria-label="Projects summary"
              metrics={[
                { label: 'Projects', value: firstPage.totals.project_count.toLocaleString() },
                { label: 'Total', value: formatDurationShort(firstPage.totals.total_seconds) },
                ...(firstPage.totals.comparable_seconds !== undefined
                  ? [
                      {
                        label: 'Editor-only activity',
                        value: formatDurationShort(firstPage.totals.comparable_seconds),
                      },
                      {
                        label: 'Additional AI',
                        value: formatDurationShort(firstPage.totals.ai_additional_seconds ?? 0),
                      },
                    ]
                  : []),
              ]}
            />
            <Card className="gap-0 overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                    <TableHead className="text-right">AI verified</TableHead>
                    <TableHead className="text-right">AI inferred</TableHead>
                    <TableHead className="text-right">Human</TableHead>
                    <TableHead className="text-right">Unknown</TableHead>
                    <TableHead className="text-right">AI %</TableHead>
                    <TableHead className="text-right">Coverage</TableHead>
                    <TableHead className="text-right">Last activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((project) => (
                    <ProjectRow key={project.project_id} project={project} />
                  ))}
                </TableBody>
              </Table>
            </Card>
            <p className="text-muted-foreground text-xs">
              Changes are measured line changes per actor; the AI share and coverage describe
              attributed events, not authorship.
            </p>
            {hasNextPage && (
              <Button
                className="self-start"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
                type="button"
                variant="outline"
              >
                {isFetchingNextPage ? 'Loading…' : 'Load more projects'}
              </Button>
            )}
          </div>
        )}
      </QueryState>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <RequireUser>
      <ProjectsAnalytics />
    </RequireUser>
  );
}
