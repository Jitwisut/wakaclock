'use client';

import { useQuery } from '@tanstack/react-query';
import { ActivityIcon, CalendarDaysIcon, ClockIcon, ZapIcon } from 'lucide-react';

import { StatTile } from '@/components/wakaclock/stat-tile';
import { getAllTime, getBrowserTimezone, getStatusBar } from '@/lib/wakaclock/endpoints';
import { formatCompactNumber, formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

export function StatusTiles() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const timezone = getBrowserTimezone();

  const statusBar = useQuery({
    queryKey: wakaclockKeys.statusBar(userId, timezone),
    queryFn: () => getStatusBar(),
    enabled: Boolean(userId),
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
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
      <StatTile
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
      <StatTile
        icon={<CalendarDaysIcon />}
        isLoading={allTime.isLoading}
        label="Days with activity"
        value={String(allTime.data?.data.days_with_activity ?? 0)}
      />
      <StatTile
        icon={<ActivityIcon />}
        isLoading={allTime.isLoading}
        label="Coding since"
        value={
          allTime.data?.data.since ? new Date(allTime.data.data.since).toLocaleDateString() : '—'
        }
      />
    </div>
  );
}
