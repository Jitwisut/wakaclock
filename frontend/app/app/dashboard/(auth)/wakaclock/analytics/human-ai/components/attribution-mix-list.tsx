'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { AnalyticsFilterOption } from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

import { ACTORS, percentOf } from './attribution';
import styles from './human-ai.module.css';

import type { DimensionMix } from './attribution';

const MAX_ROWS = 8;

/** The bar's fill: the actor mix, a skeleton while it loads, or a plain total. */
function MixSegments({ entry, loading }: { entry?: DimensionMix; loading: boolean }) {
  if (entry) {
    return ACTORS.filter((actor) => entry.seconds[actor.key] > 0).map((actor) => (
      <span
        className={cn(styles.segment, styles[actor.tone])}
        key={actor.key}
        style={{ flexGrow: entry.seconds[actor.key] }}
      />
    ));
  }
  if (loading) return <Skeleton className="h-full w-full" />;
  return <span className={cn(styles.segment, 'bg-primary w-full')} />;
}

/**
 * One row per project or category: bar length is that item's time relative to the
 * largest item, and the segments inside are its actor mix.
 *
 * `mix` is `null` while the per-actor responses load, and `undefined` when an actor
 * filter makes a mix meaningless; both fall back to plain totals rather than a
 * half-drawn split.
 */
export function AttributionMixList({
  description,
  items,
  loading,
  mix,
  onSelect,
  title,
}: {
  description: string;
  items: AnalyticsFilterOption[];
  loading: boolean;
  mix?: DimensionMix[] | null;
  onSelect: (item: AnalyticsFilterOption) => void;
  title: string;
}) {
  const rows = items.slice(0, MAX_ROWS);
  const largest = Math.max(0, ...rows.map((item) => item.total_seconds));
  const mixByKey = new Map((mix ?? []).map((entry) => [entry.key, entry]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.length === 0 && (
          <p className="text-muted-foreground text-sm">No activity matches these filters.</p>
        )}
        {rows.map((item) => {
          const entry = mixByKey.get(item.key);
          const aiSeconds = entry ? entry.seconds.ai_verified + entry.seconds.ai_inferred : 0;
          return (
            <button
              className="hover:bg-muted/60 focus-visible:ring-ring w-full rounded-md px-2 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
              key={item.key}
              onClick={() => onSelect(item)}
              type="button"
            >
              <span className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{item.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {entry && `${percentOf(aiSeconds, entry.total).toFixed(0)}% AI · `}
                  {formatDurationShort(item.total_seconds)}
                </span>
              </span>
              <span
                aria-hidden
                className={cn(styles.stack, 'h-2.5')}
                style={{ width: `${Math.max(percentOf(item.total_seconds, largest), 2)}%` }}
              >
                <MixSegments entry={entry} loading={loading} />
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
