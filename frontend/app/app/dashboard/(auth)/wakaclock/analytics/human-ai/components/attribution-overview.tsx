'use client';

import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  AnalyticsActorTypeFilter,
  AnalyticsExplorerResponse,
} from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

import { actorShares } from './attribution';
import styles from './human-ai.module.css';

/**
 * The page's headline: how the canonical total splits across the four actor
 * attributions. The legend is the control — each entry toggles the `actor_type`
 * filter — so the bar itself stays a picture rather than a row of tiny targets.
 */
export function AttributionOverview({
  data,
  onSelect,
  selected,
  trustHref,
}: {
  data: AnalyticsExplorerResponse;
  onSelect: (actorType?: AnalyticsActorTypeFilter) => void;
  selected?: AnalyticsActorTypeFilter;
  trustHref: string;
}) {
  const shares = actorShares(data.summary);
  const total = data.summary.total_seconds;
  const aiPercent = shares
    .filter((share) => share.actor.tone !== 'human' && share.actor.tone !== 'unknown')
    .reduce((sum, share) => sum + share.percent, 0);
  const human = shares[0];
  const unknown = shares[3];
  const selectedShare = shares.find((share) => share.actor.key === selected);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>Where your time went</CardTitle>
            <CardDescription>
              {formatDurationShort(total)} of canonical activity, attributed by who did the work.
            </CardDescription>
          </div>
          {selectedShare && (
            <button
              className="bg-muted hover:bg-muted/70 focus-visible:ring-ring rounded-full px-3 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => onSelect(undefined)}
              type="button"
            >
              Showing {selectedShare.actor.label} only · Clear
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-lg leading-snug sm:text-xl">
          <span className="font-semibold">{aiPercent.toFixed(1)}%</span>
          <span className="text-muted-foreground"> AI · </span>
          <span className="font-semibold">{human.percent.toFixed(1)}%</span>
          <span className="text-muted-foreground"> Human · </span>
          <span className="font-semibold">{unknown.percent.toFixed(1)}%</span>
          <span className="text-muted-foreground"> not attributable</span>
        </p>

        <div
          aria-hidden
          className={cn(styles.stack, 'h-5')}
          data-dimmed={selected ? 'true' : 'false'}
        >
          {shares
            .filter((share) => share.seconds > 0)
            .map((share) => (
              <div
                className={cn(styles.segment, styles[share.actor.tone])}
                data-active={selected === share.actor.key ? 'true' : 'false'}
                key={share.actor.key}
                style={{ flexGrow: share.seconds }}
                title={`${share.actor.label}: ${formatDurationShort(share.seconds)}`}
              />
            ))}
        </div>

        <div
          aria-label="Filter by attribution"
          className="grid grid-cols-2 gap-2 xl:grid-cols-4"
          role="group"
        >
          {shares.map((share) => {
            const active = selected === share.actor.key;
            const empty = share.seconds === 0;
            return (
              <button
                aria-pressed={active}
                className={cn(
                  'hover:bg-muted/60 focus-visible:ring-ring flex items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  active ? 'border-primary bg-muted/60' : 'border-transparent',
                  empty && 'text-muted-foreground'
                )}
                key={share.actor.key}
                onClick={() => onSelect(active ? undefined : share.actor.key)}
                type="button"
              >
                <span className={cn(styles.swatch, styles[share.actor.tone], 'mt-1')} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{share.actor.label}</span>
                  <span className="block text-xl font-semibold tabular-nums">
                    {formatDurationShort(share.seconds)}
                  </span>
                  <span className="text-muted-foreground block text-xs tabular-nums">
                    {empty ? 'No activity in this range' : `${share.percent.toFixed(1)}% of total`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-muted-foreground border-t pt-4 text-sm">
          <span className="text-foreground font-medium">Unknown</span> is activity AtoAxis cannot
          safely credit to a person or an agent, such as editor changes without input evidence. It
          is kept separate rather than guessed.{' '}
          <Link className="text-foreground underline underline-offset-4" href={trustHref}>
            See how it is measured
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
