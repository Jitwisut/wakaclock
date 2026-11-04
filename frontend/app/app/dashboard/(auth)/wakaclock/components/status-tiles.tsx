'use client';

import { useQuery } from '@tanstack/react-query';
import { ClockIcon } from 'lucide-react';

import { useDashboardPanels } from '@/components/dashboard-panels';
import { Skeleton } from '@/components/ui/skeleton';
import { TodayQuestCard } from '@/components/wakaclock/rpg/today-quest-card';
import { StatTile } from '@/components/wakaclock/stat-tile';
import { Widget } from '@/components/wakaclock/workspace';
import { getAllTime, getBrowserTimezone, getStatusBar } from '@/lib/wakaclock/endpoints';
import { formatCompactNumber, formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/**
 * Lifetime totals. Today's running total lives in the hero above (same status-bar query),
 * so it is not repeated here — unless the viewer has switched the hero off in Settings,
 * in which case the Today tile and the quest card come back so today's time never
 * disappears from the page.
 */
function LifetimeRow({
  isLoading,
  label,
  subtext,
  value,
}: {
  isLoading: boolean;
  label: string;
  subtext?: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt className="text-sm">{label}</dt>
        {subtext && <dd className="text-muted-foreground text-xs">{subtext}</dd>}
      </div>
      <dd className="shrink-0 text-lg font-semibold tracking-tight tabular-nums">
        {isLoading ? <Skeleton className="h-6 w-16" /> : value}
      </dd>
    </div>
  );
}

export function StatusTiles() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const timezone = getBrowserTimezone();
  const showToday = !useDashboardPanels().isVisible('overview.character-sheet');

  const statusBar = useQuery({
    queryKey: wakaclockKeys.statusBar(userId, timezone),
    queryFn: () => getStatusBar(),
    enabled: Boolean(userId) && showToday,
    refetchInterval: 60_000,
  });

  const allTime = useQuery({
    queryKey: wakaclockKeys.allTime(userId, timezone),
    queryFn: () => getAllTime(userId),
    enabled: Boolean(userId),
  });

  const activeAvailable = statusBar.data?.active_coverage === 'measured';
  const todaySeconds = activeAvailable
    ? (statusBar.data?.active_seconds ?? 0)
    : (statusBar.data?.total_seconds ?? 0);
  const allTimeActiveAvailable = allTime.data?.data.active_coverage === 'measured';
  const allTimeSeconds = allTimeActiveAvailable
    ? (allTime.data?.data.active_seconds ?? 0)
    : (allTime.data?.data.total_seconds ?? 0);

  return (
    <div className="flex h-full flex-col gap-5">
      {showToday && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <StatTile
              className="h-full"
              icon={<ClockIcon />}
              isLoading={statusBar.isLoading}
              label="Today"
              subtext={`${formatCompactNumber(statusBar.data?.heartbeat_count ?? 0)} heartbeats · ${activeAvailable ? 'Active' : 'WakaTime-compatible'}`}
              value={
                activeAvailable
                  ? formatDurationShort(todaySeconds)
                  : (statusBar.data?.human_readable ?? '0m')
              }
            />
          </div>
          <div>
            <TodayQuestCard isLoading={statusBar.isLoading} todaySeconds={todaySeconds} />
          </div>
        </div>
      )}
      <Widget title="Lifetime">
        <dl className="-my-1 divide-y">
          <LifetimeRow
            isLoading={allTime.isLoading}
            label={allTimeActiveAvailable ? 'All-time active coding' : 'All-time total'}
            subtext={
              allTimeActiveAvailable
                ? 'WakaTime-compatible total also available'
                : 'since first heartbeat'
            }
            value={
              allTimeActiveAvailable
                ? formatDurationShort(allTimeSeconds)
                : (allTime.data?.data.text ?? '0m')
            }
          />
          <LifetimeRow
            isLoading={allTime.isLoading}
            label="Days with activity"
            subtext="Distinct days with any coding, not a streak"
            value={String(allTime.data?.data.days_with_activity ?? 0)}
          />
          <LifetimeRow
            isLoading={allTime.isLoading}
            label="Coding since"
            value={
              allTime.data?.data.since
                ? new Date(allTime.data.data.since).toLocaleDateString()
                : '—'
            }
          />
        </dl>
      </Widget>
    </div>
  );
}
