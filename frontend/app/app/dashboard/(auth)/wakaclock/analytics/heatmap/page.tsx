'use client';

import { ActivityHeatmapBoard } from '@/components/wakaclock/analytics/activity-heatmaps';
import { AnalyticsEmptyState } from '@/components/wakaclock/analytics/analytics-empty-state';
import { AnalyticsFrame } from '@/components/wakaclock/analytics/analytics-frame';
import { SourceSummary } from '@/components/wakaclock/analytics/source-summary';

export default function ActivityHeatmapPage() {
  return (
    <AnalyticsFrame
      description="Your coding rhythm day by day: compare weeks and months, then open any day to drill in."
      title="Activity Heatmap"
    >
      {({ data, filters, setFilter, setRange }) => (
        <div className="flex flex-col gap-5">
          {data.summary.total_seconds === 0 && (
            <AnalyticsEmptyState message="No activity is available for this heatmap filter." />
          )}
          <ActivityHeatmapBoard
            data={data}
            onSelectDate={(date) => setRange({ start: date, end: date })}
          />
          <SourceSummary
            data={data}
            onSelect={(source) => setFilter('source', source)}
            selected={filters.source}
          />
        </div>
      )}
    </AnalyticsFrame>
  );
}
