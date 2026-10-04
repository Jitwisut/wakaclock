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
import styles from '@/components/wakaclock/analytics/project-studio.module.css';
import { formatDurationShort } from '@/lib/wakaclock/format';

export default function AnalyticsProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <AnalyticsFrame
      description="Your time, tools and the details behind every project."
      lockedProjectId={projectId}
      title="Project Studio"
    >
      {({ data, filters, setFilter }) => {
        const project = data.filter_options.projects.find((item) => item.key === projectId);
        const actors = [
          {
            key: 'human' as const,
            label: 'Human',
            value: data.summary.human_seconds,
            color: '#688d79',
          },
          {
            key: 'ai_verified' as const,
            label: 'Verified AI',
            value: data.summary.ai_verified_seconds,
            color: '#9b8bc2',
          },
          {
            key: 'ai_inferred' as const,
            label: 'Inferred AI',
            value: data.summary.ai_inferred_seconds,
            color: '#d5a15e',
          },
          {
            key: 'unknown' as const,
            label: 'Unknown',
            value: data.summary.unknown_seconds,
            color: '#91a0a8',
          },
        ];
        return (
          <div className={styles.board}>
            <ProjectStudio data={data} name={project?.name ?? 'Project'} />
            <section
              aria-label="Time attribution"
              className={`${styles.panel} ${styles.sourcePanel}`}
            >
              <div className={styles.sourceTop}>
                <h3>How your time comes together</h3>
                <span className={styles.badge}>
                  AI share{' '}
                  {data.summary.ai_share_percent == null
                    ? 'unavailable'
                    : `${data.summary.ai_share_percent.toFixed(1)}%`}
                </span>
              </div>
              <div aria-hidden="true" className={styles.stackedBar}>
                {actors.map((actor) => (
                  <i key={actor.key} style={{ flex: actor.value ?? 0, background: actor.color }} />
                ))}
              </div>
              <div className={styles.sourceOptions}>
                {actors.map((actor) => (
                  <button
                    aria-pressed={filters.actorType === actor.key}
                    key={actor.key}
                    onClick={() =>
                      setFilter('actor_type', filters.actorType === actor.key ? '' : actor.key)
                    }
                    type="button"
                  >
                    <i className={styles.legendDot} style={{ background: actor.color }} />
                    {actor.label}
                    <strong>
                      {actor.value == null ? 'Unavailable' : formatDurationShort(actor.value)}
                    </strong>
                  </button>
                ))}
              </div>
            </section>
            {data.summary.total_seconds === 0 && (
              <AnalyticsEmptyState message="No activity for this project matches the current filters." />
            )}
            <div className={styles.timelineGrid}>
              <ActivityTimelineChart data={data} />
              <ProjectRhythm data={data} />
            </div>
            <div className={styles.twoColumns}>
              <StudioBreakdown
                eyebrow="03 / THE BUILDING BLOCKS"
                items={data.breakdowns.languages}
                onSelect={(key) => setFilter('language', key)}
                selected={filters.language}
                title="Language palette"
              />
              <StudioBreakdown
                eyebrow="04 / YOUR WORKBENCH"
                items={data.breakdowns.editors}
                onSelect={(key) => setFilter('editor', key)}
                selected={filters.editor}
                title="Tools of the trade"
              />
              <StudioBreakdown
                eyebrow="ACTIVITY MIX"
                items={data.breakdowns.categories}
                onSelect={(key) => setFilter('category', key)}
                selected={filters.category}
                title="What kind of work?"
              />
              <StudioBreakdown
                eyebrow="ENVIRONMENTS"
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
