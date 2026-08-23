'use client';

import { useQuery } from '@tanstack/react-query';

import { getAllTime } from '@/lib/wakaclock/endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { levelProgressForSeconds } from '@/lib/wakaclock/rpg';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

/**
 * A small "Lv.N" badge next to the brand wordmark in the sidebar header — visible on
 * every authenticated page, reinforcing the character-sheet framing everywhere at once
 * without every page needing its own copy of this fetch. Shares the same query key as
 * `CharacterSheetHero` on the Overview page, so React Query serves both from one cache
 * entry rather than fetching twice.
 *
 * Renders nothing before there's a signed-in user or a loaded total — a placeholder
 * "Lv.1" badge flashing in before real data arrives would be more misleading than
 * useful. Hidden entirely in the sidebar's collapsed icon-only state, same as other
 * header text.
 */
export function SidebarLevelBadge() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';

  const allTime = useQuery({
    queryKey: wakaclockKeys.allTime(userId),
    queryFn: () => getAllTime(userId),
    enabled: Boolean(userId),
  });

  if (!allTime.data) return null;

  const { level } = levelProgressForSeconds(allTime.data.data.total_seconds);

  return (
    <span
      aria-label={`Level ${level}`}
      className="border-border bg-primary/10 text-primary group-data-[collapsible=icon]:hidden ml-auto shrink-0 border-2 px-1.5 py-0.5 text-[10px] font-bold"
    >
      Lv.{level}
    </span>
  );
}
