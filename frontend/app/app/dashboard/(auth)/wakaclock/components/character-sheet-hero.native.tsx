'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CheckCircle2Icon, HeartPulseIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

import { Skeleton } from '@/components/ui/skeleton';
import { IncompleteTimeBadge } from '@/components/wakaclock/delivery-status-notice';
import { XpBar } from '@/components/wakaclock/rpg/xp-bar';
import { cn } from '@/lib/utils';
import { getAllTime, getBrowserTimezone, getStatusBar } from '@/lib/wakaclock/endpoints';
import { formatCompactNumber, formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { DAILY_QUEST_GOAL_SECONDS } from '@/lib/wakaclock/rpg';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import { AnimatedDuration } from './overview-motion';

const RING_RADIUS = 84;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Today's quest as a progress ring. The SVG ring is the visual; the element with
 * `role="progressbar"` carries the same value for assistive technology.
 */
function GoalOrb({ isLoading, todaySeconds }: { isLoading: boolean; todaySeconds: number }) {
  const progress = Math.min(1, todaySeconds / DAILY_QUEST_GOAL_SECONDS);
  const complete = !isLoading && todaySeconds >= DAILY_QUEST_GOAL_SECONDS;
  const goalHours = DAILY_QUEST_GOAL_SECONDS / 3600;

  let note: React.ReactNode = `${formatDurationShort(todaySeconds)} of ${goalHours}h`;
  if (isLoading) note = `Code for ${goalHours}h`;
  else if (complete) {
    note = (
      <span className="inline-flex items-center gap-1">
        <CheckCircle2Icon aria-hidden className="size-3.5" /> Quest complete!
      </span>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 border-t px-6 py-8 sm:border-t-0 sm:border-l"
      data-slot="quest-widget"
    >
      <div className="relative size-36">
        <svg aria-hidden className="size-full" viewBox="0 0 200 200">
          <circle
            className="stroke-border"
            cx="100"
            cy="100"
            fill="none"
            r={RING_RADIUS}
            strokeWidth="5"
          />
          <motion.circle
            animate={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - (isLoading ? 0 : progress)) }}
            className="stroke-primary"
            cx="100"
            cy="100"
            fill="none"
            initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
            r={RING_RADIUS}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeLinecap="butt"
            strokeWidth="5"
            transform="rotate(-90 100 100)"
            transition={{ duration: 1.2, ease: [0.2, 0, 0, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            aria-label="Today's quest progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(progress * 100)}
            className="font-display text-4xl font-medium tracking-[-0.04em] tabular-nums"
            role="progressbar"
          >
            {isLoading ? '··' : `${Math.round(progress * 100)}%`}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="cinema-label">Today&apos;s quest</p>
        <p
          className={cn(
            'text-muted-foreground mt-1.5 text-sm',
            complete && 'text-primary font-medium'
          )}
        >
          {note}
        </p>
      </div>
    </div>
  );
}

/**
 * The overview's command-center hero: today's time as the headline number, the daily
 * quest as a goal orb, and Level/XP (derived from the all-time total, see
 * `lib/wakaclock/rpg.ts`). Today's value and its subtext are chosen exactly as the old
 * "Today" status tile chose them — measured active time when the API reports it, the
 * WakaTime-compatible `human_readable` otherwise.
 *
 * Fetches via the same query keys `StatusTiles` uses — React Query dedupes identical keys
 * against one cache entry, so this adds no second round trip for the same data.
 */
export function CharacterSheetHero() {
  const userId = useWakaclockUserStore((s) => s.userId) ?? '';
  const username = useWakaclockUserStore((s) => s.username);
  const timezone = getBrowserTimezone();
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => setNow(new Date()), []);

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

  return (
    <div className="grid grid-cols-1 border-y sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <section
        aria-labelledby="today-heading"
        className="flex min-w-0 flex-col gap-5 py-6 sm:pr-8"
      >
        <div className="cinema-label flex w-full flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="bg-primary size-1.5" /> Refreshes every minute
          </span>
          {now && (
            <span>
              {now.toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
                weekday: 'long',
              })}
            </span>
          )}
        </div>
        <div>
          <h2 className="text-muted-foreground text-sm" id="today-heading">
            {now ? greeting(now) : 'Hello'}
            {username ? `, ${username}` : ''} — you&apos;ve coded today
          </h2>
          {statusBar.isLoading ? (
            <Skeleton className="mt-2 h-12 w-48" />
          ) : (
            <p className="font-display mt-2 text-[length:clamp(3.5rem,6vw,5.25rem)] leading-[0.9] font-medium tracking-[-0.05em] tabular-nums">
              {activeAvailable ? (
                <AnimatedDuration seconds={todaySeconds} />
              ) : (
                (statusBar.data?.human_readable ?? '0m')
              )}
            </p>
          )}
        </div>
        <IncompleteTimeBadge />
        <div className="cinema-label flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <HeartPulseIcon aria-hidden className="size-3.5" />
            <strong className="text-foreground font-medium">
              {formatCompactNumber(statusBar.data?.heartbeat_count ?? 0)}
            </strong>{' '}
            heartbeats
          </span>
          <span className="border-l pl-4">
            {activeAvailable ? 'Active' : 'WakaTime-compatible'}
          </span>
        </div>
        <div className="mt-auto flex flex-col items-start gap-4 border-t pt-4">
          <div className="w-full max-w-md">
            <XpBar
              isLoading={allTime.isLoading}
              totalSeconds={
                allTime.data?.data.active_coverage === 'measured'
                  ? (allTime.data.data.active_seconds ?? 0)
                  : (allTime.data?.data.total_seconds ?? 0)
              }
            />
          </div>
          <Link
            className="text-primary inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            href="/dashboard/wakaclock/analytics/timeline"
          >
            Explore your activity <ArrowUpRight aria-hidden size={15} />
          </Link>
        </div>
      </section>
      <GoalOrb isLoading={statusBar.isLoading} todaySeconds={todaySeconds} />
    </div>
  );
}
