'use client';

import {
  CalendarHeatmap,
  TimeOfDayHeatmap,
} from '@/components/wakaclock/analytics/activity-heatmaps';
import { AnalyticsEmptyState } from '@/components/wakaclock/analytics/analytics-empty-state';
import { AnalyticsFrame } from '@/components/wakaclock/analytics/analytics-frame';
import { SourceSummary } from '@/components/wakaclock/analytics/source-summary';

export default function ActivityHeatmapPage() {
  return (
    <AnalyticsFrame
      description="Find active days and productive time-of-day patterns after applying the same project, language, category and source filters."
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
          <CalendarHeatmap
            data={data}
            onSelectDate={(date) => setRange({ start: date, end: date })}
          />
          <TimeOfDayHeatmap data={data} />
        </div>
      )}
    </AnalyticsFrame>
  );
}
