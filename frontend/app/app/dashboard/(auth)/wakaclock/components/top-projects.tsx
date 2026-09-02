'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryState } from '@/components/wakaclock/query-state';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { getProjectAnalytics } from '@/lib/wakaclock/endpoints';
import { formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/** Enough to see the shape of a week without turning the overview into a second
 *  projects page — "View all projects" carries anyone who needs the rest. */
const LIMIT = 8;

/** 8 rows at the 44px minimum touch target, plus the footer link. Reserving the settled
 *  height keeps the panels below this one from jumping when the query resolves. */
const SKELETON_HEIGHT = 'h-88 w-full';

export function TopProjects() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  // Read-only on purpose: this panel deliberately renders no RangePicker. Every picker on
  // this page writes the same ?start=&end= params, so a third one would make moving any
  // single control visibly shift the other two.
  const { start, end } = useWakaclockRange(30);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const { data, isLoading, error } = useQuery({
    enabled: Boolean(userId),
    queryFn: () =>
      getProjectAnalytics({ end, limit: LIMIT, order: 'desc', sort: 'duration', start, timezone }),
    queryKey: wakaclockKeys.topProjects(userId, start, end, LIMIT, timezone),
  });

  const projects = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
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
          <ul className="divide-border divide-y">
            {projects.map((project) => (
              <li className="flex min-h-11 items-center justify-between gap-3" key={project.project_id}>
                {/* The anchor wraps the name only, never the row: a screen reader then
                    announces the project as the link's accessible name instead of
                    "my-project 4h 12m", and the duration stays readable as adjacent text. */}
                <Link
                  className="focus-visible:ring-ring hover:text-primary flex min-h-11 min-w-0 flex-1 cursor-pointer items-center rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  href={`/dashboard/wakaclock/analytics/projects/${project.project_id}?start=${start}&end=${end}&project_id=${project.project_id}`}
                >
                  <span className="truncate text-sm font-medium">{project.name}</span>
                </Link>
                <span className="text-muted-foreground shrink-0 font-mono text-sm tabular-nums">
                  {formatDurationShort(project.total_seconds)}
                </span>
              </li>
            ))}
          </ul>

          <Link
            className="text-muted-foreground hover:text-foreground mt-4 inline-flex min-h-11 cursor-pointer items-center text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            href={`/dashboard/wakaclock/analytics/projects?start=${start}&end=${end}`}
          >
            View all projects
          </Link>
        </QueryState>
      </CardContent>
    </Card>
  );
}
