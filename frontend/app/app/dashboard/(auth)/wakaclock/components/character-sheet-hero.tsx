'use client';

import { useQuery } from '@tanstack/react-query';

import { ActiveDaysBadge } from '@/components/wakaclock/rpg/active-days-badge';
import { TodayQuestCard } from '@/components/wakaclock/rpg/today-quest-card';
import { XpBar } from '@/components/wakaclock/rpg/xp-bar';
import { getAllTime, getStatusBar } from '@/lib/wakaclock/endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/**
 * The Overview page's "character sheet" — Level/XP (derived from the all-time total,
 * see `lib/wakaclock/rpg.ts`), an active-days badge, and today's quest goal. `XpBar` and
 * `ActiveDaysBadge` are plain elements (not `Card`s) so they sit directly in the page's
 * own bordered hero panel below without nesting a beveled card inside another one;
 * `TodayQuestCard` is a real `Card` and renders as a sibling, not a child, of that panel.
 *
 * Fetches via the same query keys `StatusTiles`/`RangeStats` already use elsewhere on
 * this page — React Query dedupes identical keys against one cache entry, so this
 * doesn't add a second network round trip for the same data.
 */
export function CharacterSheetHero() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';

  const statusBar = useQuery({
    queryKey: wakaclockKeys.statusBar(userId),
    queryFn: () => getStatusBar(),
    enabled: Boolean(userId),
    refetchInterval: 60_000,
  });

  const allTime = useQuery({
    queryKey: wakaclockKeys.allTime(userId),
    queryFn: () => getAllTime(userId),
    enabled: Boolean(userId),
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="border-border bg-card flex flex-col justify-center gap-3 border-2 p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <XpBar isLoading={allTime.isLoading} totalSeconds={allTime.data?.data.total_seconds ?? 0} />
          <ActiveDaysBadge
            days={allTime.data?.data.days_with_activity ?? 0}
            isLoading={allTime.isLoading}
          />
        </div>
      </div>
      <TodayQuestCard isLoading={statusBar.isLoading} todaySeconds={statusBar.data?.total_seconds ?? 0} />
    </div>
  );
}
