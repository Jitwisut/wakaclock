'use client';

import * as React from 'react';

import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';
import { QueryState } from '@/components/wakaclock/query-state';
import { RangePicker } from '@/components/wakaclock/range-picker';
import { RequireUser } from '@/components/wakaclock/require-user';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
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

function ProjectCard({ project }: { project: ProjectAnalyticsCard }) {
  return (
    <Link className="block" href={`/dashboard/wakaclock/projects/${project.project_id}`}>
      <Card className="hover:border-primary/60 hover:bg-muted/30 h-full transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{project.name}</CardTitle>
              <CardDescription className="truncate">
                {project.repository ?? 'Repository not available'}
              </CardDescription>
            </div>
            <span className="shrink-0 font-mono text-sm font-semibold">
              {formatDurationShort(project.total_seconds)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">AI changes</p>
            <p className="font-medium">{project.ai.changes.toLocaleString()} lines</p>
          </div>
          <div>
            <p className="text-muted-foreground">Human changes</p>
            <p className="font-medium">{project.human.changes.toLocaleString()} lines</p>
          </div>
          <div>
            <p className="text-muted-foreground">AI attribution</p>
            <p className="font-medium">{nullablePercent(project.ai.percentage)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Unattributed</p>
            <p className="font-medium">
              {project.unattributed.changes.toLocaleString()} lines
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Coverage</p>
            <p className="font-medium">{nullablePercent(project.attribution_coverage_percent)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last activity</p>
            <p className="font-medium">
              {project.last_activity_at
                ? new Date(project.last_activity_at).toLocaleDateString()
                : '—'}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ProjectsAnalytics() {
  const userId = useWakaclockUserStore((state) => state.userId) ?? '';
  const { start, end, setRange } = useWakaclockRange(30);
  const [sort, setSort] = React.useState<ProjectSort>('duration');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<
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
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Quest board</CardTitle>
            <CardDescription>
              Stable project identities keep links valid through renames and merges.
            </CardDescription>
          </div>
          <RangePicker onChange={setRange} value={{ start, end }} />
        </div>
        <div aria-label="Project sort" className="flex flex-wrap gap-2 pt-2" role="group">
          {(
            [
              ['duration', 'Duration'],
              ['recent', 'Recent'],
              ['ai_changes', 'AI changes'],
              ['prompts', 'Prompts'],
              ['sessions', 'Sessions'],
              ['tokens', 'Tokens'],
              ['estimated_cost', 'Estimated cost'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              onClick={() => setSort(value)}
              size="sm"
              variant={sort === value ? 'default' : 'outline'}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          emptyDescription="No named projects were recorded in this range."
          error={error}
          isEmpty={!isLoading && !error && items.length === 0}
          isLoading={isLoading}
          skeletonClassName="h-72 w-full"
        >
          {firstPage && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {firstPage.totals.project_count.toLocaleString()} projects ·{' '}
                {formatDurationShort(firstPage.totals.total_seconds)} total
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((project) => (
                  <ProjectCard key={project.project_id} project={project} />
                ))}
              </div>
              {hasNextPage && (
                <Button
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
      </CardContent>
    </Card>
  );
}

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-4">
      <WakaclockPageHeader
        description="Projects are stable quests: choose one to inspect activity, attribution, files and branches."
        title="Projects"
      />
      <RequireUser>
        <ProjectsAnalytics />
      </RequireUser>
    </div>
  );
}
