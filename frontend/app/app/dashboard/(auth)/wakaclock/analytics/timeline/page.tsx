'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ActivityTimelineChart } from '@/components/wakaclock/analytics/activity-timeline-chart';
import { AnalyticsFrame } from '@/components/wakaclock/analytics/analytics-frame';
import { BreakdownList } from '@/components/wakaclock/analytics/breakdown-list';
import { SourceSummary } from '@/components/wakaclock/analytics/source-summary';

export default function ActivityTimelinePage() {
  return (
    <AnalyticsFrame
      description="Explore canonical attended time and cross-filter it by project, language, editor, category and source."
      title="Activity Timeline"
    >
      {({ data, filters, setFilter }) => (
        <div className="space-y-4">
          <SourceSummary
            data={data}
            onSelect={(source) => setFilter('source', source)}
            onSelectActor={(actorType) => setFilter('actor_type', actorType)}
            selected={filters.source}
            selectedActor={filters.actorType}
          />
          {data.summary.total_seconds === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground p-8 text-center text-sm">
                No canonical activity matches the current filters. Change or reset a filter to continue exploring.
              </CardContent>
            </Card>
          ) : (
            <>
              <ActivityTimelineChart data={data} />
              <div className="grid gap-4 lg:grid-cols-2">
                <BreakdownList
                  description="Click a project to apply it as a global filter."
                  items={data.breakdowns.projects}
                  onSelect={(item) => setFilter('project_id', item.key)}
                  title="Projects"
                />
                <BreakdownList
                  items={data.breakdowns.languages}
                  onSelect={(item) => setFilter('language', item.key)}
                  title="Languages"
                />
                <BreakdownList
                  items={data.breakdowns.categories}
                  onSelect={(item) => setFilter('category', item.key)}
                  title="Activity categories"
                />
                <BreakdownList
                  items={data.breakdowns.editors}
                  onSelect={(item) => setFilter('editor', item.key)}
                  title="Editors"
                />
              </div>
            </>
          )}
        </div>
      )}
    </AnalyticsFrame>
  );
}
