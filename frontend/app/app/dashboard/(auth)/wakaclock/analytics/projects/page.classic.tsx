'use client';

import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsFrame } from '@/components/wakaclock/analytics/analytics-frame';
import { formatDurationShort } from '@/lib/wakaclock/format';

export default function AnalyticsProjectsPage() {
  return (
    <AnalyticsFrame
      description="Rank projects using the same global filters and canonical duration as Timeline and Heatmap, then drill into one stable project identity."
      title="Project Analytics"
    >
      {({ data, href }) => (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <CardDescription>
                {data.breakdowns.projects.length.toLocaleString()} projects ·{' '}
                {formatDurationShort(data.summary.total_seconds)} in the current filter.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.breakdowns.projects.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No stable projects match the current filters.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {data.breakdowns.projects.map((project, index) => {
                    const percentage = data.summary.total_seconds > 0
                      ? (project.total_seconds * 100) / data.summary.total_seconds
                      : 0;
                    return (
                      <Link
                        className="block"
                        href={href(`/dashboard/wakaclock/analytics/projects/${project.key}`, {
                          projectId: project.key,
                        })}
                        key={project.key}
                      >
                        <Card className="hover:border-primary/60 hover:bg-muted/30 h-full transition-colors">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <CardDescription>#{index + 1}</CardDescription>
                                <CardTitle className="truncate text-base">{project.name}</CardTitle>
                              </div>
                              <span className="shrink-0 font-mono text-sm font-semibold">
                                {formatDurationShort(project.total_seconds)}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="bg-muted h-2 overflow-hidden rounded-full">
                              <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(percentage, 100)}%` }} />
                            </div>
                            <p className="text-muted-foreground mt-2 text-xs">{percentage.toFixed(1)}% of filtered activity</p>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AnalyticsFrame>
  );
}
