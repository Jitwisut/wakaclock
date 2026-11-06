'use client';

import { ActivityHeatmapBoard } from '@/components/wakaclock/analytics/activity-heatmaps';
import { AnalyticsEmptyState } from '@/components/wakaclock/analytics/analytics-empty-state';
import { AnalyticsFrame } from '@/components/wakaclock/analytics/analytics-frame';
import { SourceSummary } from '@/components/wakaclock/analytics/source-summary';

export default function ActivityHeatmapPage() {
  return (
    <AnalyticsFrame
      description="Explore your coding rhythm through pixel maps and dimensional charts. Filter your projects, compare days, and discover your busiest moments."
      title="Activity Heatmap"
    >
      {({ data, filters, setFilter, setRange }) => (
        <div className="space-y-4">
          <SourceSummary
            data={data}
            onSelect={(source) => setFilter('source', source)}
            selected={filters.source}
          />
          {data.summary.total_seconds === 0 && (
            <AnalyticsEmptyState message="No activity is available for this heatmap filter." />
          )}
          <ActivityHeatmapBoard
            data={data}
            onSelectDate={(date) => setRange({ start: date, end: date })}
          />
        </div>
      )}
    </AnalyticsFrame>
  );
}
