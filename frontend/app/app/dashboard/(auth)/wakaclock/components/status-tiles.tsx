'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDaysIcon, ClockIcon, FlameIcon, ZapIcon } from 'lucide-react';

import { useDashboardPanels } from '@/components/dashboard-panels';
import { TodayQuestCard } from '@/components/wakaclock/rpg/today-quest-card';
import { StatTile } from '@/components/wakaclock/stat-tile';
import { getAllTime, getBrowserTimezone, getStatusBar } from '@/lib/wakaclock/endpoints';
import { formatCompactNumber, formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from '../overview.module.css';

/**
 * Lifetime totals. Today's running total lives in the hero above (same status-bar query),
 * so it is not repeated here — unless the viewer has switched the hero off in Settings,
 * in which case the Today tile and the quest card come back so today's time never
 * disappears from the page.
 */
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
    <div className="flex flex-col gap-4">
      {showToday && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={styles.lift}>
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
          <div className={styles.lift}>
            <TodayQuestCard isLoading={statusBar.isLoading} todaySeconds={todaySeconds} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={styles.lift}>
          <StatTile
            className="h-full"
            icon={<ZapIcon />}
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
        </div>
        <div className={styles.lift}>
          <StatTile
            className="h-full"
            icon={<FlameIcon />}
            isLoading={allTime.isLoading}
            label="Days with activity"
            subtext="Distinct days with any coding, not a streak"
            value={String(allTime.data?.data.days_with_activity ?? 0)}
          />
        </div>
        <div className={styles.lift}>
          <StatTile
            className="h-full"
            icon={<CalendarDaysIcon />}
            isLoading={allTime.isLoading}
            label="Coding since"
            value={
              allTime.data?.data.since
                ? new Date(allTime.data.data.since).toLocaleDateString()
                : '—'
            }
          />
        </div>
      </div>
    </div>
  );
}
