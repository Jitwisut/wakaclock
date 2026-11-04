'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  CodeIcon,
  FolderGit2Icon,
  GaugeIcon,
  MinusIcon,
  SparklesIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from 'lucide-react';
import Link from 'next/link';

import { QueryState } from '@/components/wakaclock/query-state';
import { Widget } from '@/components/wakaclock/workspace';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { presentPeriodComparison } from '@/lib/wakaclock/dashboard-analytics-presenters';
import { getDashboardAnalytics, getProjectAnalytics } from '@/lib/wakaclock/endpoints';
import { formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { BreakdownItem, PeriodComparison } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import { OVERVIEW_RANGE_DAYS } from './overview-toolbar';
import { TOP_PROJECTS_LIMIT } from './top-projects';

interface Insight {
  color: string;
  href?: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  value: string;
  valueClassName?: string;
}

const TREND: Record<PeriodComparison['direction'], { className?: string; icon: React.ReactNode }> =
  {
    decrease: { className: 'text-destructive', icon: <TrendingDownIcon /> },
    increase: { className: 'text-primary', icon: <TrendingUpIcon /> },
    new_activity: { className: 'text-primary', icon: <SparklesIcon /> },
    unchanged: { icon: <MinusIcon /> },
  };

/** The API's own order is not a contract, so the leader is picked by value. */
export function leadingItem(items: readonly BreakdownItem[]): BreakdownItem | undefined {
  return items.reduce<BreakdownItem | undefined>(
    (best, item) => (best === undefined || item.value > best.value ? item : best),
    undefined
  );
}

/**
 * "Highlights": a one-line read of the range plus four insight cards. Nothing here is a
 * new calculation — every number is a value the API already returned, formatted with the
 * same presenter/formatter the analytics card uses. It shares the dashboard-analytics and
 * top-projects query keys with the panels below, so it costs no extra requests.
 */
export function OverviewInsights() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const { start, end } = useWakaclockRange(OVERVIEW_RANGE_DAYS);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const analytics = useQuery({
    enabled: Boolean(userId),
    queryFn: () => getDashboardAnalytics({ end, start, timezone }),
    queryKey: wakaclockKeys.dashboardAnalytics(userId, start, end, timezone),
  });

  const projects = useQuery({
    enabled: Boolean(userId),
    queryFn: () =>
      getProjectAnalytics({
        end,
        limit: TOP_PROJECTS_LIMIT,
        order: 'desc',
        sort: 'duration',
        start,
        timezone,
      }),
    queryKey: wakaclockKeys.topProjects(userId, start, end, TOP_PROJECTS_LIMIT, timezone),
  });

  const { data } = analytics;
  const comparison = data?.summary.previous_period;
  const days = data?.range.days_included ?? 0;
  const period = comparison ? presentPeriodComparison(comparison, days) : null;
  const language = leadingItem(data?.breakdowns.languages.items ?? []);
  const project = projects.data?.items[0];

  const insights: Insight[] = [];
  if (comparison && period) {
    insights.push({
      color: 'var(--chart-1)',
      icon: TREND[comparison.direction].icon,
      label: period.label,
      sub: period.subtext,
      value: period.value,
      valueClassName: TREND[comparison.direction].className,
    });
  }
  if (data) {
    insights.push(
      {
        color: 'var(--chart-2)',
        icon: <GaugeIcon />,
        label: 'Active-day average',
        sub: 'Average across the days you coded in this range',
        value: formatDurationShort(data.summary.active_day_average_seconds),
      },
      {
        color: 'var(--chart-3)',
        icon: <CodeIcon />,
        label: 'Top language',
        sub: language
          ? `${language.text} · ${language.percentage.toFixed(1)}% of this range`
          : 'No languages recorded in this range',
        value: language?.name ?? '—',
      },
      {
        color: 'var(--chart-4)',
        href: project
          ? `/dashboard/wakaclock/analytics/projects/${project.project_id}?start=${start}&end=${end}&project_id=${project.project_id}`
          : undefined,
        icon: <FolderGit2Icon />,
        label: 'Top project',
        sub: project
          ? `${formatDurationShort(project.total_seconds)} in this range`
          : 'No named projects in this range',
        value: project?.name ?? '—',
      }
    );
  }

  return (
    <QueryState
      emptyDescription="No heartbeats were recorded in this range."
      emptyTitle="Nothing to highlight yet"
      error={analytics.error}
      isEmpty={
        !analytics.isLoading && !analytics.error && data?.summary.calendar_day_average_seconds === 0
      }
      isLoading={analytics.isLoading}
      skeletonClassName="h-40 w-full"
    >
      <Widget
        description={
          comparison ? (
            <>
              <strong className="text-foreground">
                {formatDurationShort(comparison.current_seconds)}
              </strong>{' '}
              logged across the last {days} {days === 1 ? 'day' : 'days'}
              {period && (
                <>
                  {' '}
                  ·{' '}
                  <strong className={TREND[comparison.direction].className}>
                    {period.value}
                  </strong>{' '}
                  vs the previous period
                </>
              )}
            </>
          ) : undefined
        }
        title="Highlights"
      >
        <ul className="bg-border grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2 xl:grid-cols-4">
          {insights.map((insight) => (
            <li className="bg-card flex min-w-0 flex-col gap-1 px-4 py-3.5" key={insight.label}>
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: insight.color }}
                />
                {insight.label}
              </span>
              {insight.href ? (
                <Link
                  className="hover:text-primary focus-visible:ring-ring truncate rounded-sm text-lg font-semibold tracking-tight underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  href={insight.href}
                >
                  {insight.value}
                </Link>
              ) : (
                <span
                  className={`truncate text-lg font-semibold tracking-tight tabular-nums ${insight.valueClassName ?? ''}`}
                >
                  {insight.value}
                </span>
              )}
              <span className="text-muted-foreground text-xs">{insight.sub}</span>
            </li>
          ))}
        </ul>
      </Widget>
    </QueryState>
  );
}
