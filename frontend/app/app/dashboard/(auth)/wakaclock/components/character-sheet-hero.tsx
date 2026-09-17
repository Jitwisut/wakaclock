'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { ActiveDaysBadge } from '@/components/wakaclock/rpg/active-days-badge';
import { TodayQuestCard } from '@/components/wakaclock/rpg/today-quest-card';
import { XpBar } from '@/components/wakaclock/rpg/xp-bar';
import { getAllTime, getBrowserTimezone, getStatusBar } from '@/lib/wakaclock/endpoints';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from '../overview.module.css';

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

  const todaySeconds =
    statusBar.data?.active_coverage === 'measured'
      ? (statusBar.data.active_seconds ?? 0)
      : (statusBar.data?.total_seconds ?? 0);

  return (
    <div className={styles.heroGrid}>
      <section aria-labelledby="focus-heading" className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>
            <Sparkles aria-hidden size={14} /> PLAYER ONE · READY TO CODE
          </span>
          <h2 id="focus-heading">
            Build your skills.
            <br />
            <span>Unlock your next level.</span>
          </h2>
          <p>
            Turn everyday focus into lasting progress. Your next level starts with a little time
            today.
          </p>
          <Link className={styles.heroLink} href="/dashboard/wakaclock/analytics/timeline">
            Explore your activity <ArrowUpRight aria-hidden size={16} />
          </Link>
        </div>
        <div aria-hidden="true" className={styles.scene}>
          <div className={styles.gridFloor} />
          <div className={styles.gridBack} />
          <div className={styles.console}>
            <span>&gt;_</span>
          </div>
          <div className={styles.satellite} />
          <div className={styles.spark} />
          <div className={styles.platform} />
        </div>
        <div className={styles.progress}>
          <XpBar
            isLoading={allTime.isLoading}
            totalSeconds={
              allTime.data?.data.active_coverage === 'measured'
                ? (allTime.data.data.active_seconds ?? 0)
                : (allTime.data?.data.total_seconds ?? 0)
            }
          />
          <ActiveDaysBadge
            days={allTime.data?.data.days_with_activity ?? 0}
            isLoading={allTime.isLoading}
          />
        </div>
      </section>
      <TodayQuestCard
        isLoading={statusBar.isLoading}
        todaySeconds={todaySeconds}
      />
    </div>
  );
}
