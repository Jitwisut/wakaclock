'use client';

import Link from 'next/link';

import { AnalyticsFrame } from '@/components/wakaclock/analytics/analytics-frame';
import { MetricStrip, Widget } from '@/components/wakaclock/workspace';
import { formatDurationShort } from '@/lib/wakaclock/format';

export default function AnalyticsProjectsPage() {
  return (
    <AnalyticsFrame
      description="Rank projects with the same filters and canonical duration as Timeline and Heatmap, then open one to drill in."
      title="Project Analytics"
    >
      {({ data, href }) => {
        const {projects} = data.breakdowns;
        const total = data.summary.total_seconds;
        const leader = projects[0];
        return (
          <div className="flex flex-col gap-5">
            <MetricStrip
              aria-label="Project summary"
              metrics={[
                { label: 'Projects', value: projects.length.toLocaleString() },
                { label: 'Filtered time', value: formatDurationShort(total) },
                {
                  label: 'Most time',
                  value: <span className="truncate text-base">{leader?.name ?? '—'}</span>,
                  hint: leader ? formatDurationShort(leader.total_seconds) : undefined,
                },
              ]}
            />
            <Widget
              description={`${projects.length.toLocaleString()} projects · ${formatDurationShort(total)} in the current filter.`}
              title="Projects"
            >
              {projects.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No stable projects match the current filters.
                </p>
              ) : (
                <ol aria-label="Projects by time" className="-mx-2 flex flex-col">
                  <li
                    aria-hidden
                    className="text-muted-foreground grid grid-cols-[2rem_minmax(0,1fr)_5.5rem] items-center gap-3 px-2 pb-2 text-xs sm:grid-cols-[2rem_minmax(0,1.2fr)_minmax(0,1fr)_4rem_5.5rem]"
                  >
                    <span>#</span>
                    <span>Project</span>
                    <span className="hidden sm:block">Share</span>
                    <span className="hidden text-right sm:block">%</span>
                    <span className="text-right">Time</span>
                  </li>
                  {projects.map((project, index) => {
                    const percentage = total > 0 ? (project.total_seconds * 100) / total : 0;
                    return (
                      <li className="border-t first:border-t-0" key={project.key}>
                        <Link
                          className="hover:bg-accent grid grid-cols-[2rem_minmax(0,1fr)_5.5rem] items-center gap-3 rounded-md px-2 py-2.5 text-sm transition-colors sm:grid-cols-[2rem_minmax(0,1.2fr)_minmax(0,1fr)_4rem_5.5rem]"
                          href={href(`/dashboard/wakaclock/analytics/projects/${project.key}`, {
                            projectId: project.key,
                          })}
                        >
                          <span className="text-muted-foreground tabular-nums">{index + 1}</span>
                          <span className="truncate font-medium">{project.name}</span>
                          <span className="bg-muted hidden h-1.5 overflow-hidden rounded-full sm:block">
                            <span
                              className="bg-primary block h-full rounded-full"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </span>
                          <span className="text-muted-foreground hidden text-right text-xs tabular-nums sm:block">
                            {percentage.toFixed(1)}%
                          </span>
                          <span className="text-right font-medium tabular-nums">
                            {formatDurationShort(project.total_seconds)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Widget>
          </div>
        );
      }}
    </AnalyticsFrame>
  );
}
