'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryState } from '@/components/wakaclock/query-state';
import { RankBadge } from '@/components/wakaclock/rpg/rank-badge';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { getProjectAnalytics } from '@/lib/wakaclock/endpoints';
import { formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from '../overview.module.css';

import { OVERVIEW_RANGE_DAYS } from './overview-toolbar';

/** Enough to see the shape of a week without turning the overview into a second
 *  projects page — "View all projects" carries anyone who needs the rest. */
export const TOP_PROJECTS_LIMIT = 8;

/** 8 rows at the 44px minimum touch target, plus the footer link. Reserving the settled
 *  height keeps the panels below this one from jumping when the query resolves. */
const SKELETON_HEIGHT = 'h-88 w-full';

export function TopProjects() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  // Read-only on purpose: the overview toolbar owns the one RangePicker for this page.
  const { start, end } = useWakaclockRange(OVERVIEW_RANGE_DAYS);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const { data, isLoading, error } = useQuery({
    enabled: Boolean(userId),
    queryFn: () =>
      getProjectAnalytics({
        end,
        limit: TOP_PROJECTS_LIMIT,
        order: 'desc',
        sort: 'duration',
        start,
        timezone,
      }),
    queryKey: wakaclockKeys.topProjects(userId, start, end, TOP_PROJECTS_LIMIT, timezone),
  });

  const projects = data?.items ?? [];
  const maxSeconds = Math.max(1, ...projects.map((project) => project.total_seconds));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
        <CardDescription>Ranked by time in the selected range</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState
          emptyDescription="No named projects were recorded in this range."
          emptyTitle="No projects yet"
          error={error}
          isEmpty={!isLoading && !error && projects.length === 0}
          isLoading={isLoading}
          skeletonClassName={SKELETON_HEIGHT}
        >
          <ul className="flex flex-col gap-1">
            {projects.map((project, index) => (
              <li
                className="hover:bg-muted/50 -mx-2 flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5 transition-colors"
                key={project.project_id}
              >
                <RankBadge rank={index + 1} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    {/* The anchor wraps the name only, never the row: a screen reader then
                        announces the project as the link's accessible name instead of
                        "my-project 4h 12m", and the duration stays readable as adjacent text. */}
                    <Link
                      className="focus-visible:ring-ring hover:text-primary flex min-h-7 min-w-0 cursor-pointer items-center rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      href={`/dashboard/wakaclock/analytics/projects/${project.project_id}?start=${start}&end=${end}&project_id=${project.project_id}`}
                    >
                      <span className="truncate text-sm font-medium">{project.name}</span>
                    </Link>
                    <span className="text-muted-foreground shrink-0 font-mono text-sm tabular-nums">
                      {formatDurationShort(project.total_seconds)}
                    </span>
                  </div>
                  <div aria-hidden className={styles.bar}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${(project.total_seconds / maxSeconds) * 100}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Link
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-4 inline-flex min-h-11 cursor-pointer items-center text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            href={`/dashboard/wakaclock/analytics/projects?start=${start}&end=${end}`}
          >
            View all projects
          </Link>
        </QueryState>
      </CardContent>
    </Card>
  );
}
