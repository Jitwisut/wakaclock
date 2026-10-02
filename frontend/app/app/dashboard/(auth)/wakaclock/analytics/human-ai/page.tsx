'use client';

import { useQueries } from '@tanstack/react-query';
import { CalendarDaysIcon, GaugeIcon, SparklesIcon, TimerIcon } from 'lucide-react';

import { AnalyticsEmptyState } from '@/components/wakaclock/analytics/analytics-empty-state';
import { AnalyticsFrame } from '@/components/wakaclock/analytics/analytics-frame';
import type { AnalyticsFrameContext } from '@/components/wakaclock/analytics/analytics-frame';
import { StatTile } from '@/components/wakaclock/stat-tile';
import type { AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';
import { getAnalyticsExplorer } from '@/lib/wakaclock/endpoints';
import { formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';

import { ACTORS, dimensionMix } from './components/attribution';
import { AttributionMixList } from './components/attribution-mix-list';
import { AttributionOverview } from './components/attribution-overview';
import { AttributionTimeline } from './components/attribution-timeline';
import styles from './components/human-ai.module.css';

import type { ActorKey } from './components/attribution';

/**
 * Per-actor responses for the same filters, so each project and category can show its
 * own Human/AI mix. The explorer has no per-item actor split, and one request per
 * actor reuses the exact canonical durations the rest of the page shows. Skipped when
 * an actor filter is already applied, where a mix would be a single colour.
 */
function useActorMix({ filters, request, userId }: AnalyticsFrameContext) {
  const enabled = Boolean(userId) && !filters.actorType;
  const results = useQueries({
    queries: ACTORS.map((actor) => {
      const actorRequest = { ...request, actor_type: actor.key };
      return {
        enabled,
        queryFn: () => getAnalyticsExplorer(actorRequest),
        queryKey: [
          ...wakaclockKeys.analyticsExplorer(
            userId,
            actorRequest.start,
            actorRequest.end,
            filters.timezone,
            actorRequest.project_id,
            actorRequest.language,
            actorRequest.editor,
            actorRequest.category,
            actorRequest.source,
            actorRequest.operating_system,
            actorRequest.actor_type
          ),
          actorRequest,
        ] as const,
      };
    }),
  });
  const byActor: Partial<Record<ActorKey, AnalyticsExplorerResponse>> = {};
  ACTORS.forEach((actor, index) => {
    const data = results[index]?.data;
    if (data) byActor[actor.key] = data;
  });
  return { byActor, enabled, loading: enabled && results.some((result) => result.isLoading) };
}

function HumanAiView(context: AnalyticsFrameContext) {
  const { data, filters, href, setFilter } = context;
  const { byActor, enabled, loading } = useActorMix(context);
  const { summary } = data;
  const dailyAverage = summary.active_days > 0 ? summary.total_seconds / summary.active_days : 0;

  if (summary.total_seconds === 0) {
    return <AnalyticsEmptyState message="No attributed activity matches the current filters." />;
  }

  return (
    <div className={`${styles.root} space-y-4`}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <AttributionOverview
          data={data}
          onSelect={(actorType) => setFilter('actor_type', actorType)}
          selected={filters.actorType}
          trustHref={href('/dashboard/wakaclock/analytics/trust')}
        />
        <div className="grid auto-rows-fr grid-cols-2 gap-4">
          <StatTile
            icon={<SparklesIcon />}
            label="AI share"
            subtext="Verified and inferred AI time"
            value={
              summary.ai_share_percent === null ? '—' : `${summary.ai_share_percent.toFixed(1)}%`
            }
          />
          <StatTile
            icon={<TimerIcon />}
            label="Total time"
            subtext={`${data.range.start} – ${data.range.end}`}
            value={formatDurationShort(summary.total_seconds)}
          />
          <StatTile
            icon={<GaugeIcon />}
            label="Daily average"
            subtext="Per active day"
            value={formatDurationShort(dailyAverage)}
          />
          <StatTile
            icon={<CalendarDaysIcon />}
            label="Active days"
            subtext={`of ${data.range.days_included} in range`}
            value={String(summary.active_days)}
          />
        </div>
      </div>

      <AttributionTimeline data={data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AttributionMixList
          description={
            enabled
              ? 'Time per project, split by who did the work. Select one to filter.'
              : 'Time per project for the selected attribution. Select one to filter.'
          }
          items={data.breakdowns.projects}
          loading={loading}
          mix={
            enabled
              ? dimensionMix(
                  data.breakdowns.projects,
                  byActor,
                  (response) => response.breakdowns.projects
                )
              : undefined
          }
          onSelect={(item) => setFilter('project_id', item.key)}
          title="By project"
        />
        <AttributionMixList
          description={
            enabled
              ? 'Time per activity type, split by who did the work. Select one to filter.'
              : 'Time per activity type for the selected attribution. Select one to filter.'
          }
          items={data.breakdowns.categories}
          loading={loading}
          mix={
            enabled
              ? dimensionMix(
                  data.breakdowns.categories,
                  byActor,
                  (response) => response.breakdowns.categories
                )
              : undefined
          }
          onSelect={(item) => setFilter('category', item.key)}
          title="By activity type"
        />
      </div>
    </div>
  );
}

export default function HumanAiPage() {
  return (
    <AnalyticsFrame
      description="How your canonical coding time splits between you, AI agents, and activity that cannot be safely attributed."
      title="Human vs AI"
    >
      {(context) => <HumanAiView {...context} />}
    </AnalyticsFrame>
  );
}
