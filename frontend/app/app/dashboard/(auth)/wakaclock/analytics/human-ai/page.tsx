'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityTimelineChart } from '@/components/wakaclock/analytics/activity-timeline-chart';
import { AnalyticsEmptyState } from '@/components/wakaclock/analytics/analytics-empty-state';
import { AnalyticsFrame } from '@/components/wakaclock/analytics/analytics-frame';
import { BreakdownList } from '@/components/wakaclock/analytics/breakdown-list';
import { SourceSummary } from '@/components/wakaclock/analytics/source-summary';
import { formatDurationShort } from '@/lib/wakaclock/format';

function ShareRow({ label, seconds, total }: { label: string; seconds: number; total: number }) {
  const percentage = total > 0 ? (seconds * 100) / total : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground font-mono text-xs">
          {formatDurationShort(seconds)} · {percentage.toFixed(1)}%
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default function HumanAiPage() {
  return (
    <AnalyticsFrame
      description="Compare Human, verified AI, inferred AI and Unknown time using the same canonical duration model as the rest of AtoAxis."
      title="Human vs AI"
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
          {data.summary.total_seconds === 0 && (
            <AnalyticsEmptyState message="No attributed activity matches the current filters." />
          )}
          <div className="grid gap-4 xl:grid-cols-[1fr_2fr]">
            <Card>
              <CardHeader>
                <CardTitle>Duration attribution</CardTitle>
                <CardDescription>
                  Actor attribution is measured duration. Unknown includes activity that cannot
                  safely be claimed as Human or AI; handover remains outside both actors.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ShareRow
                  label="Human"
                  seconds={data.summary.human_seconds}
                  total={data.summary.total_seconds}
                />
                <ShareRow
                  label="AI verified"
                  seconds={data.summary.ai_verified_seconds ?? 0}
                  total={data.summary.total_seconds}
                />
                <ShareRow
                  label="AI inferred"
                  seconds={data.summary.ai_inferred_seconds ?? 0}
                  total={data.summary.total_seconds}
                />
                <ShareRow
                  label="Unknown"
                  seconds={data.summary.unknown_seconds ?? 0}
                  total={data.summary.total_seconds}
                />
                <ShareRow
                  label="Other / handover"
                  seconds={data.summary.other_seconds}
                  total={data.summary.total_seconds}
                />
              </CardContent>
            </Card>
            <ActivityTimelineChart data={data} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownList
              description="Which projects carry the selected source mix."
              items={data.breakdowns.projects}
              onSelect={(item) => setFilter('project_id', item.key)}
              title="Source mix by project"
            />
            <BreakdownList
              description="Filter the attribution view by activity type."
              items={data.breakdowns.categories}
              onSelect={(item) => setFilter('category', item.key)}
              title="Source mix by category"
            />
          </div>
        </div>
      )}
    </AnalyticsFrame>
  );
}
