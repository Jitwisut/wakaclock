'use client';

import * as React from 'react';

import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CountAnimation } from '@/components/ui/custom/count-animation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';
import { bucketHeartbeatCounts, type HeartbeatSummary } from '@/lib/wakaclock/heartbeat-stats';
import type { HeartbeatItem } from '@/lib/wakaclock/types';

import styles from '../heartbeats.module.css';

import { SendHeartbeatDialog } from './send-heartbeat-dialog';

const BUCKET_MINUTES = 5;
const W = 1000;
const H = 190;
const TOP = 14;
const BASE = H - 16;
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

export function formatClock(epochSeconds: number, withSeconds = false) {
  return new Date(epochSeconds * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  });
}

function formatMinute(minuteOfDay: number) {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatAgo(seconds: number) {
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function useNow(enabled: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}

function clampY(y: number) {
  return Math.min(BASE, Math.max(TOP, y));
}

function tickAlign(hour: number) {
  if (hour === 0) return 'translate-x-0';
  if (hour === 24) return '-translate-x-full';
  return '-translate-x-1/2';
}

function signalLabel(isToday: boolean, isLive: boolean) {
  if (!isToday) return 'Recorded signal';
  return isLive ? 'Live signal' : 'Listening';
}

/** Catmull-Rom through the points, with control points clamped to the plot band. */
function smoothPath(points: Array<[number, number]>) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clampY(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clampY(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

interface PulseTraceProps {
  beat: number;
  buckets: number[];
  nowMinute: null | number;
}

function PulseTrace({ buckets, nowMinute, beat }: PulseTraceProps) {
  const reduced = useReducedMotion();
  const [hover, setHover] = React.useState<null | number>(null);
  const n = buckets.length;
  const max = Math.max(1, ...buckets);
  const lastIndex =
    nowMinute === null ? n - 1 : Math.min(n - 1, Math.floor(nowMinute / BUCKET_MINUTES));

  const { area, line, tip } = React.useMemo(() => {
    const points: Array<[number, number]> = [];
    for (let i = 0; i <= lastIndex; i += 1) {
      // Square-root scale keeps a quiet five minutes visible next to a busy one.
      const y = BASE - Math.sqrt(buckets[i] / max) * (BASE - TOP);
      points.push([((i + 0.5) / n) * W, y]);
    }
    const linePath = smoothPath(points);
    const first = points[0];
    const last = points.at(-1);
    return {
      area: first && last ? `${linePath} L${last[0]},${BASE} L${first[0]},${BASE} Z` : '',
      line: linePath,
      tip: last ?? null,
    };
  }, [buckets, lastIndex, max, n]);

  const peakIndex = buckets.indexOf(Math.max(...buckets));

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(n - 1, Math.floor(fraction * n))));
  }

  const nowX = tip ? (tip[0] / W) * 100 : null;
  const hoverCount = hover === null ? 0 : buckets[hover];

  return (
    <div className="relative">
      <div
        aria-label={`Heartbeats in ${BUCKET_MINUTES}-minute buckets. Busiest bucket ${formatMinute(
          peakIndex * BUCKET_MINUTES
        )} with ${buckets[peakIndex] ?? 0} heartbeats.`}
        className="relative h-[150px] cursor-crosshair touch-pan-y sm:h-[190px]"
        onPointerLeave={() => setHover(null)}
        onPointerMove={onPointerMove}
        role="img"
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${W} ${H}`}
        >
          <defs>
            <linearGradient id="hb-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.86 0.17 158)" stopOpacity="0.38" />
              <stop offset="100%" stopColor="oklch(0.86 0.17 158)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="hb-line" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="oklch(0.78 0.12 200)" />
              <stop offset="60%" stopColor="oklch(0.86 0.17 158)" />
              <stop offset="100%" stopColor="oklch(0.93 0.16 130)" />
            </linearGradient>
          </defs>
          <line
            stroke="oklch(1 0 0 / 0.14)"
            strokeDasharray="2 6"
            vectorEffect="non-scaling-stroke"
            x1="0"
            x2={W}
            y1={BASE}
            y2={BASE}
          />
          {area && (
            <motion.path
              animate={{ opacity: 1 }}
              d={area}
              fill="url(#hb-area)"
              initial={reduced ? false : { opacity: 0 }}
              transition={{ delay: 0.5, duration: 1.2 }}
            />
          )}
          {line && (
            <motion.path
              animate={{ pathLength: 1 }}
              className={styles.traceGlow}
              d={line}
              fill="none"
              initial={reduced ? false : { pathLength: 0 }}
              stroke="url(#hb-line)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              transition={{ duration: 1.8, ease: [0.65, 0, 0.35, 1] }}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {!reduced && <div aria-hidden="true" className={styles.sweep} />}

        {/* Leading edge of the trace: the latest bucket (or "now" on today). */}
        {tip && nowX !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{ left: `${nowX}%`, top: `${(tip[1] / H) * 100}%` }}
          >
            <span className="absolute -translate-x-1/2 -translate-y-1/2">
              <span className="block size-2.5 rounded-full bg-[oklch(0.93_0.16_140)] shadow-[0_0_14px_oklch(0.86_0.17_158)]" />
            </span>
            <AnimatePresence>
              {!reduced && beat > 0 && (
                <motion.span
                  animate={{ opacity: 0, scale: 5 }}
                  className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[oklch(0.86_0.17_158)]"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0.9, scale: 1 }}
                  key={beat}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                />
              )}
            </AnimatePresence>
          </div>
        )}
        {nowMinute !== null && nowX !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-[oklch(0.86_0.17_158/0.45)] to-transparent"
            style={{ left: `${nowX}%` }}
          />
        )}

        {hover !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0"
            style={{ left: `${((hover + 0.5) / n) * 100}%` }}
          >
            <div className="absolute inset-y-0 w-px bg-white/35" />
            <div
              className={cn(
                'absolute top-0 w-max rounded-lg border border-white/15 bg-[oklch(0.14_0.01_255/0.92)] px-2.5 py-1.5 text-[11px] leading-tight shadow-xl backdrop-blur',
                hover > n * 0.75 ? 'right-2' : 'left-2'
              )}
            >
              <div className="font-mono text-white/60 tabular-nums">
                {formatMinute(hover * BUCKET_MINUTES)}–{formatMinute((hover + 1) * BUCKET_MINUTES)}
              </div>
              <div className="font-medium text-white">
                {hoverCount} heartbeat{hoverCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        )}
      </div>

      <div aria-hidden="true" className="relative mt-2 h-4 font-mono text-[10px] text-white/45">
        {HOUR_TICKS.map((hour) => (
          <span
            className={cn(
              'absolute',
              tickAlign(hour),
              hour % 6 !== 0 && 'hidden sm:inline'
            )}
            key={hour}
            style={{ left: `${(hour / 24) * 100}%` }}
          >
            {String(hour).padStart(2, '0')}:00
          </span>
        ))}
      </div>
    </div>
  );
}

interface PulseMonitorProps {
  beat: number;
  date: string;
  isToday: boolean;
  onDateChange: (date: string) => void;
  rows: readonly HeartbeatItem[];
  summary: HeartbeatSummary;
  timezone: null | string;
  total: number;
}

export function PulseMonitor({
  beat,
  date,
  isToday,
  onDateChange,
  rows,
  summary,
  timezone,
  total,
}: PulseMonitorProps) {
  const now = useNow(isToday);
  const buckets = React.useMemo(() => bucketHeartbeatCounts(rows, BUCKET_MINUTES), [rows]);
  const hourly = React.useMemo(() => bucketHeartbeatCounts(rows, 60), [rows]);
  const peakHour = hourly.indexOf(Math.max(...hourly));
  const nowDate = new Date(now);
  const nowMinute = isToday ? nowDate.getHours() * 60 + nowDate.getMinutes() : null;
  const sinceLast = summary.lastTime === null ? null : Math.max(0, now / 1000 - summary.lastTime);
  const isLive = isToday && sinceLast !== null && sinceLast < 180;

  return (
    <section aria-labelledby="heartbeats-title" className={cn(styles.monitor, 'p-5 sm:p-7')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={cn(styles.eyebrow, 'flex items-center gap-2.5')}>
          <span
            aria-hidden="true"
            className={cn(styles.livePip, !isLive && styles.livePipIdle)}
          />
          {signalLabel(isToday, isLive)}
          {timezone && <span className="text-white/40">· {timezone}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button className={cn(styles.darkControl, 'gap-1.5')} size="sm" variant="outline">
                <CalendarIcon className="size-3.5" />
                {format(new Date(date), 'MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="single"
                onSelect={(d) => d && onDateChange(format(d, 'yyyy-MM-dd'))}
                selected={new Date(date)}
              />
            </PopoverContent>
          </Popover>
          <span className={styles.signalSlot}>
            <SendHeartbeatDialog date={date} timezone={timezone} />
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div>
          <h1 className="sr-only" id="heartbeats-title">
            Heartbeats
          </h1>
          <div className={styles.bigNumber}>
            <CountAnimation duration={1.2} value={total} />
          </div>
          <p className="mt-3 text-sm text-white/70">
            heartbeats recorded on{' '}
            <span className="text-white">{format(new Date(date), 'EEEE, MMMM d')}</span>
          </p>
        </div>
        <dl className="flex flex-wrap gap-2">
          <div className={styles.metaChip}>
            <dt>First</dt>
            <dd className="font-mono text-white tabular-nums">
              {summary.firstTime === null ? '—' : formatClock(summary.firstTime)}
            </dd>
          </div>
          <div className={styles.metaChip}>
            <dt>Latest</dt>
            <dd className="font-mono text-white tabular-nums">
              {summary.lastTime === null ? '—' : formatClock(summary.lastTime)}
            </dd>
          </div>
          {isToday && sinceLast !== null && (
            <div className={styles.metaChip}>
              <dt>Last beat</dt>
              <dd className="font-mono text-white tabular-nums">
                {formatAgo(sinceLast)}
              </dd>
            </div>
          )}
          {total > 0 && (
            <div className={styles.metaChip}>
              <dt>Busiest hour</dt>
              <dd className="font-mono text-white tabular-nums">
                {formatMinute(peakHour * 60)} · {hourly[peakHour]}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-6">
        <PulseTrace beat={beat} buckets={buckets} nowMinute={nowMinute} />
      </div>
    </section>
  );
}
