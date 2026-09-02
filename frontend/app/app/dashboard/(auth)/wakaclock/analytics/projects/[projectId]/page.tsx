'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityTimelineChart } from '@/components/wakaclock/analytics/activity-timeline-chart';
import { AnalyticsEmptyState } from '@/components/wakaclock/analytics/analytics-empty-state';
import { AnalyticsFrame } from '@/components/wakaclock/analytics/analytics-frame';
import { BreakdownList } from '@/components/wakaclock/analytics/breakdown-list';
import { SourceSummary } from '@/components/wakaclock/analytics/source-summary';

export default function AnalyticsProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <AnalyticsFrame
      description="One stable project identity, filtered by date, language, editor, category and activity source."
      lockedProjectId={projectId}
      title="Project Drill-down"
    >
      {({ data, filters, setFilter }) => {
        const project = data.filter_options.projects.find((item) => item.key === projectId);
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardDescription>Stable project ID · {projectId}</CardDescription>
                <CardTitle>{project?.name ?? 'Project'}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/wakaclock/projects/${projectId}?start=${filters.start}&end=${filters.end}`}>Open files & branches view</Link>
                </Button>
              </CardContent>
            </Card>
            <SourceSummary
              data={data}
              onSelect={(source) => setFilter('source', source)}
              selected={filters.source}
            />
            {data.summary.total_seconds === 0 && (
              <AnalyticsEmptyState message="No activity for this project matches the current filters." />
            )}
            <ActivityTimelineChart data={data} />
            <div className="grid gap-4 lg:grid-cols-2">
              <BreakdownList
                items={data.breakdowns.languages}
                onSelect={(item) => setFilter('language', item.key)}
                title="Languages"
              />
              <BreakdownList
                items={data.breakdowns.editors}
                onSelect={(item) => setFilter('editor', item.key)}
                title="Editors"
              />
              <BreakdownList
                items={data.breakdowns.categories}
                onSelect={(item) => setFilter('category', item.key)}
                title="Categories"
              />
              <BreakdownList items={data.breakdowns.operating_systems} title="Operating systems" />
            </div>
          </div>
        );
      }}
    </AnalyticsFrame>
  );
}
