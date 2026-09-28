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
import { motion } from 'motion/react';
import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { QueryState } from '@/components/wakaclock/query-state';
import { useWakaclockRange } from '@/hooks/use-wakaclock-range';
import { presentPeriodComparison } from '@/lib/wakaclock/dashboard-analytics-presenters';
import { getDashboardAnalytics, getProjectAnalytics } from '@/lib/wakaclock/endpoints';
import { formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import type { BreakdownItem, PeriodComparison } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from '../overview.module.css';

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
    decrease: { className: styles.trendDown, icon: <TrendingDownIcon /> },
    increase: { className: styles.trendUp, icon: <TrendingUpIcon /> },
    new_activity: { className: styles.trendUp, icon: <SparklesIcon /> },
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
      <div className="flex flex-col gap-4">
        {comparison && (
          <p className={styles.headline}>
            <strong>{formatDurationShort(comparison.current_seconds)}</strong> logged across the
            last {days} {days === 1 ? 'day' : 'days'}
            {period && (
              <>
                {' '}
                · <strong className={TREND[comparison.direction].className}>
                  {period.value}
                </strong>{' '}
                vs the previous period
              </>
            )}
          </p>
        )}
        <ul className={styles.insightGrid}>
          {insights.map((insight, index) => (
            <motion.li
              animate={{ opacity: 1, y: 0 }}
              className={styles.lift}
              initial={{ opacity: 0, y: 14 }}
              key={insight.label}
              transition={{ delay: 0.08 * index }}
            >
              <Card
                className={`${styles.insight} gap-2 p-4 sm:gap-2.5 sm:p-5`}
                style={{ '--insight-color': insight.color } as React.CSSProperties}
              >
                <span aria-hidden className={styles.insightIcon}>
                  {insight.icon}
                </span>
                <span className={styles.insightLabel}>{insight.label}</span>
                {insight.href ? (
                  <Link
                    className={`${styles.insightValue} hover:text-primary focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none`}
                    href={insight.href}
                  >
                    {insight.value}
                  </Link>
                ) : (
                  <span className={`${styles.insightValue} ${insight.valueClassName ?? ''}`}>
                    {insight.value}
                  </span>
                )}
                <span className={styles.insightSub}>{insight.sub}</span>
              </Card>
            </motion.li>
          ))}
        </ul>
      </div>
    </QueryState>
  );
}
