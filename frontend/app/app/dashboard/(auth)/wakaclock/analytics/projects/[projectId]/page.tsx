'use client';

import { useParams } from 'next/navigation';

import { ActivityTimelineChart } from '@/components/wakaclock/analytics/activity-timeline-chart';
import { AnalyticsEmptyState } from '@/components/wakaclock/analytics/analytics-empty-state';
import { AnalyticsFrame } from '@/components/wakaclock/analytics/analytics-frame';
import { ProjectDeepDive } from '@/components/wakaclock/analytics/project-deep-dive';
import {
  ProjectRhythm,
  ProjectStudio,
  StudioBreakdown,
} from '@/components/wakaclock/analytics/project-studio';
import { Widget } from '@/components/wakaclock/workspace';
import { cn } from '@/lib/utils';
import { formatDurationShort } from '@/lib/wakaclock/format';

export default function AnalyticsProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <AnalyticsFrame
      description="Your time, tools and the details behind every project."
      lockedProjectId={projectId}
      title="Project"
    >
      {({ data, filters, setFilter }) => {
        const project = data.filter_options.projects.find((item) => item.key === projectId);
        const actors = [
          {
            key: 'human' as const,
            label: 'Human',
            value: data.summary.human_seconds,
            color: 'var(--chart-2)',
          },
          {
            key: 'ai_verified' as const,
            label: 'Verified AI',
            value: data.summary.ai_verified_seconds,
            color: 'var(--chart-1)',
          },
          {
            key: 'ai_inferred' as const,
            label: 'Inferred AI',
            value: data.summary.ai_inferred_seconds,
            color: 'var(--chart-3)',
          },
          {
            key: 'unknown' as const,
            label: 'Unknown',
            value: data.summary.unknown_seconds,
            color: 'var(--chart-4)',
          },
        ];
        return (
          <div className="flex flex-col gap-5">
            <ProjectStudio data={data} name={project?.name ?? 'Project'} />
            <section aria-label="Time attribution">
              <Widget
                action={
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                    AI share{' '}
                    {data.summary.ai_share_percent == null
                      ? 'unavailable'
                      : `${data.summary.ai_share_percent.toFixed(1)}%`}
                  </span>
                }
                description="Select an actor to filter the project; select it again to clear."
                title="How your time comes together"
              >
                <div
                  aria-hidden
                  className="bg-muted mb-3 flex h-2 gap-px overflow-hidden rounded-full"
                >
                  {actors.map((actor) => (
                    <i
                      key={actor.key}
                      style={{ flex: actor.value ?? 0, background: actor.color }}
                    />
                  ))}
                </div>
                <div className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-4">
                  {actors.map((actor) => (
                    <button
                      aria-pressed={filters.actorType === actor.key}
                      className={cn(
                        'bg-card hover:bg-accent flex flex-col gap-0.5 px-3 py-2.5 text-left transition-colors',
                        filters.actorType === actor.key &&
                          'bg-primary/10 shadow-[inset_0_-2px_0_var(--primary)]'
                      )}
                      key={actor.key}
                      onClick={() =>
                        setFilter('actor_type', filters.actorType === actor.key ? '' : actor.key)
                      }
                      type="button"
                    >
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <i
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ background: actor.color }}
                        />
                        {actor.label}
                      </span>
                      <strong className="text-base font-semibold tabular-nums">
                        {actor.value == null ? 'Unavailable' : formatDurationShort(actor.value)}
                      </strong>
                    </button>
                  ))}
                </div>
              </Widget>
            </section>
            {data.summary.total_seconds === 0 && (
              <AnalyticsEmptyState message="No activity for this project matches the current filters." />
            )}
            <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <ActivityTimelineChart data={data} />
              <ProjectRhythm data={data} />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <StudioBreakdown
                eyebrow="Languages"
                items={data.breakdowns.languages}
                onSelect={(key) => setFilter('language', key)}
                selected={filters.language}
                title="Language palette"
              />
              <StudioBreakdown
                eyebrow="Editors"
                items={data.breakdowns.editors}
                onSelect={(key) => setFilter('editor', key)}
                selected={filters.editor}
                title="Tools of the trade"
              />
              <StudioBreakdown
                eyebrow="Activity mix"
                items={data.breakdowns.categories}
                onSelect={(key) => setFilter('category', key)}
                selected={filters.category}
                title="What kind of work?"
              />
              <StudioBreakdown
                eyebrow="Environments"
                items={data.breakdowns.operating_systems}
                onSelect={(key) => setFilter('operating_system', key)}
                selected={filters.operatingSystem}
                title="Where you build"
              />
            </div>
            <ProjectDeepDive
              end={filters.end}
              hasExplorerFilters={Boolean(
                filters.language ||
                filters.editor ||
                filters.category ||
                filters.source ||
                filters.actorType ||
                filters.operatingSystem
              )}
              key={projectId}
              projectId={projectId}
              start={filters.start}
              timezone={filters.timezone}
            />
          </div>
        );
      }}
    </AnalyticsFrame>
  );
}
