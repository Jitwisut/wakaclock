'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CheckCircle2Icon, HeartPulseIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

import { Skeleton } from '@/components/ui/skeleton';
import { XpBar } from '@/components/wakaclock/rpg/xp-bar';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { getAllTime, getBrowserTimezone, getStatusBar } from '@/lib/wakaclock/endpoints';
import { formatCompactNumber, formatDurationShort } from '@/lib/wakaclock/format';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
import { DAILY_QUEST_GOAL_SECONDS } from '@/lib/wakaclock/rpg';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

import styles from '../overview.module.css';

import { AnimatedDuration } from './overview-motion';

const RING_RADIUS = 84;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const MAX_TILT_DEG = 7;

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Today's quest as a 3D-tilted progress orb. The SVG ring is the visual; the element
 * with `role="progressbar"` carries the same value for assistive technology.
 */
function GoalOrb({ isLoading, todaySeconds }: { isLoading: boolean; todaySeconds: number }) {
  const reduced = useReducedMotion();
  const orbRef = React.useRef<HTMLDivElement>(null);
  const progress = Math.min(1, todaySeconds / DAILY_QUEST_GOAL_SECONDS);
  const complete = !isLoading && todaySeconds >= DAILY_QUEST_GOAL_SECONDS;
  const goalHours = DAILY_QUEST_GOAL_SECONDS / 3600;
  const ticks = Array.from({ length: 48 }, (_, index) => index);

  let note: React.ReactNode = `${formatDurationShort(todaySeconds)} of ${goalHours}h`;
  if (isLoading) note = `Code for ${goalHours}h`;
  else if (complete) {
    note = (
      <span className="inline-flex items-center gap-1">
        <CheckCircle2Icon aria-hidden className="size-3.5" /> Quest complete!
      </span>
    );
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const orb = orbRef.current;
    if (!orb || reduced || event.pointerType !== 'mouse') return;
    const rect = orb.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    orb.style.setProperty('--ry', `${(x * MAX_TILT_DEG * 2).toFixed(2)}deg`);
    orb.style.setProperty('--rx', `${(-y * MAX_TILT_DEG * 2).toFixed(2)}deg`);
  }

  function onPointerLeave() {
    orbRef.current?.style.setProperty('--rx', '0deg');
    orbRef.current?.style.setProperty('--ry', '0deg');
  }

  return (
    <div className={styles.orbStage} onPointerLeave={onPointerLeave} onPointerMove={onPointerMove}>
      <div className={styles.orb} ref={orbRef}>
        <div aria-hidden className={styles.orbGlow} />
        <svg aria-hidden viewBox="0 0 200 200">
          <g className={styles.orbTicks} strokeLinecap="round" strokeWidth="1.5">
            {ticks.map((tick) => {
              const angle = (tick / ticks.length) * Math.PI * 2;
              const inner = tick % 4 === 0 ? 93 : 95;
              return (
                <line
                  key={tick}
                  x1={100 + Math.cos(angle) * inner}
                  x2={100 + Math.cos(angle) * 98}
                  y1={100 + Math.sin(angle) * inner}
                  y2={100 + Math.sin(angle) * 98}
                />
              );
            })}
          </g>
          <circle
            className={styles.orbTrack}
            cx="100"
            cy="100"
            fill="none"
            r={RING_RADIUS}
            strokeWidth="10"
          />
          <motion.circle
            animate={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - (isLoading ? 0 : progress)) }}
            className={styles.orbProgress}
            cx="100"
            cy="100"
            fill="none"
            initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
            r={RING_RADIUS}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeLinecap="round"
            strokeWidth="10"
            transform="rotate(-90 100 100)"
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className={styles.orbCenter}>
          <span className={styles.orbCaption}>Today&apos;s quest</span>
          <span
            aria-label="Today's quest progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(progress * 100)}
            className={styles.orbPercent}
            role="progressbar"
          >
            {isLoading ? '··' : `${Math.round(progress * 100)}%`}
          </span>
          <span className={complete ? `${styles.orbNote} ${styles.orbDone}` : styles.orbNote}>
            {note}
          </span>
        </div>
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
  const heroRef = React.useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
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

  function onPointerMove(event: React.PointerEvent<HTMLElement>) {
    const hero = heroRef.current;
    if (!hero || reduced || event.pointerType !== 'mouse') return;
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    hero.style.setProperty('--my', `${event.clientY - rect.top}px`);
  }

  return (
    <section
      aria-labelledby="today-heading"
      className={styles.hero}
      onPointerMove={onPointerMove}
      ref={heroRef}
    >
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}>
          <span className={styles.live}>
            <span aria-hidden className={styles.liveDot} /> Refreshes every minute
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
        </span>

        <div>
          <h2 className={styles.todayLabel} id="today-heading">
            {now ? greeting(now) : 'Hello'}
            {username ? `, ${username}` : ''} — you&apos;ve coded today
          </h2>
          {statusBar.isLoading ? (
            <Skeleton className="mt-3 h-16 w-64 bg-white/10" />
          ) : (
            <p className={styles.todayValue}>
              {activeAvailable ? (
                <AnimatedDuration seconds={todaySeconds} />
              ) : (
                (statusBar.data?.human_readable ?? '0m')
              )}
            </p>
          )}
        </div>

        <div className={styles.todayMeta}>
          <span className={styles.chip}>
            <HeartPulseIcon aria-hidden className="size-3.5" />
            <strong>{formatCompactNumber(statusBar.data?.heartbeat_count ?? 0)}</strong> heartbeats
          </span>
          <span className={styles.chip}>{activeAvailable ? 'Active' : 'WakaTime-compatible'}</span>
        </div>

        <div className={styles.level}>
          <XpBar
            isLoading={allTime.isLoading}
            totalSeconds={
              allTime.data?.data.active_coverage === 'measured'
                ? (allTime.data.data.active_seconds ?? 0)
                : (allTime.data?.data.total_seconds ?? 0)
            }
          />
        </div>

        <Link className={styles.heroLink} href="/dashboard/wakaclock/analytics/timeline">
          Explore your activity <ArrowUpRight aria-hidden size={16} />
        </Link>
      </div>

      <GoalOrb isLoading={statusBar.isLoading} todaySeconds={todaySeconds} />
    </section>
  );
}
