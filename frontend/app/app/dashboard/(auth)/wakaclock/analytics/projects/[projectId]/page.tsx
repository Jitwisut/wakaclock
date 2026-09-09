'use client';

import { useParams } from 'next/navigation';

import { ActivityTimelineChart } from '@/components/wakaclock/analytics/activity-timeline-chart';
import { AnalyticsEmptyState } from '@/components/wakaclock/analytics/analytics-empty-state';
import { AnalyticsFrame } from '@/components/wakaclock/analytics/analytics-frame';
import { BreakdownList } from '@/components/wakaclock/analytics/breakdown-list';
import { ProjectStudio } from '@/components/wakaclock/analytics/project-studio';
import styles from '@/components/wakaclock/analytics/project-studio.module.css';
import { SourceSummary } from '@/components/wakaclock/analytics/source-summary';

export default function AnalyticsProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <AnalyticsFrame
      description="Explore the time, languages and tools behind your project."
      lockedProjectId={projectId}
      title="Project Studio"
    >
      {({ data, filters, setFilter }) => {
        const project = data.filter_options.projects.find((item) => item.key === projectId);
        return (
          <div className={styles.board}>
            <ProjectStudio
              data={data}
              filesHref={`/dashboard/wakaclock/projects/${projectId}?start=${filters.start}&end=${filters.end}&timezone=${encodeURIComponent(filters.timezone)}`}
              name={project?.name ?? 'Project'}
              onLanguage={(language) => setFilter('language', language)}
              selectedLanguage={filters.language}
            />
            <SourceSummary
              data={data}
              onSelect={(source) => setFilter('source', source)}
              onSelectActor={(actorType) => setFilter('actor_type', actorType)}
              selected={filters.source}
              selectedActor={filters.actorType}
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
