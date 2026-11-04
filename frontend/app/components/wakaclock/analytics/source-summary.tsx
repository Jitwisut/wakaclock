'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  AnalyticsActorTypeFilter,
  AnalyticsExplorerResponse,
  AnalyticsSourceFilter,
} from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

function durationLabel(value?: number) {
  return value == null ? 'Unavailable' : formatDurationShort(value);
}

interface Segment<K> {
  color?: string;
  key: K;
  label: string;
  value?: number;
}

function SegmentGroup<K extends string | undefined>({
  isActive,
  label,
  onPick,
  segments,
}: {
  isActive: (key: K) => boolean;
  label: string;
  onPick: (key: K) => void;
  segments: Segment<K>[];
}) {
  return (
    <div aria-label={label} className="flex min-w-0 flex-col gap-2" role="group">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-4">
        {segments.map((segment) => {
          const active = isActive(segment.key);
          return (
            <button
              aria-label={`${segment.label}: ${durationLabel(segment.value)}`}
              aria-pressed={active}
              className={cn(
                'bg-card hover:bg-accent flex min-w-0 flex-col gap-0.5 px-3 py-2.5 text-left transition-colors',
                active && 'bg-primary/10 hover:bg-primary/15 shadow-[inset_0_-2px_0_var(--primary)]'
              )}
              key={`${label}:${segment.label}`}
              onClick={() => onPick(segment.key)}
              type="button"
            >
              <span className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                {segment.color && (
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: segment.color }}
                  />
                )}
                {segment.label}
              </span>
              <span className="text-base font-semibold tracking-tight tabular-nums">
                {durationLabel(segment.value)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Where the time came from, as one panel: a proportion bar of attributed time, then two
 * segmented selectors (source and attribution) that filter every view on the page.
 */
export function SourceSummary({
  data,
  onSelect,
  onSelectActor,
  selected,
  selectedActor,
}: {
  data: AnalyticsExplorerResponse;
  onSelect: (source?: AnalyticsSourceFilter) => void;
  onSelectActor?: (actorType?: AnalyticsActorTypeFilter) => void;
  selected?: AnalyticsSourceFilter;
  selectedActor?: AnalyticsActorTypeFilter;
}) {
  const sources: Segment<AnalyticsSourceFilter | undefined>[] = [
    { key: undefined, label: 'Total time', value: data.summary.total_seconds },
    { key: 'human', label: 'Human', value: data.summary.human_seconds },
    { key: 'ai', label: 'AI agent', value: data.summary.ai_seconds },
    { key: 'other', label: 'Other / handover', value: data.summary.other_seconds },
  ];
  const actors: Segment<AnalyticsActorTypeFilter>[] = [
    { color: 'var(--chart-2)', key: 'human', label: 'Human', value: data.summary.human_seconds },
    {
      color: 'var(--chart-1)',
      key: 'ai_verified',
      label: 'AI verified',
      value: data.summary.ai_verified_seconds,
    },
    {
      color: 'var(--chart-3)',
      key: 'ai_inferred',
      label: 'AI inferred',
      value: data.summary.ai_inferred_seconds,
    },
    {
      color: 'var(--chart-4)',
      key: 'unknown',
      label: 'Unknown',
      value: data.summary.unknown_seconds,
    },
  ];
  const attributed = actors.reduce((sum, actor) => sum + (actor.value ?? 0), 0);
  const share = data.summary.ai_share_percent;

  return (
    <Card className="gap-4 px-4 py-4 sm:px-5" data-slot="source-summary">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Time by source</h2>
          <p className="text-muted-foreground text-xs">
            Select a segment to filter every view on this page.
          </p>
        </div>
        <dl className="text-muted-foreground flex gap-5 text-xs">
          <div className="flex items-baseline gap-1.5">
            <dt>AI share</dt>
            <dd className="text-foreground text-sm font-semibold tabular-nums">
              {share === null ? '—' : `${share.toFixed(1)}%`}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt>Active days</dt>
            <dd className="text-foreground text-sm font-semibold tabular-nums">
              {data.summary.active_days}
            </dd>
          </div>
        </dl>
      </div>
      {attributed > 0 && (
        <div
          aria-label={actors
            .map((actor) => `${actor.label} ${durationLabel(actor.value)}`)
            .join(', ')}
          className="bg-muted flex h-2 overflow-hidden rounded-full"
          role="img"
        >
          {actors.map((actor) =>
            actor.value ? (
              <span
                className="h-full"
                key={actor.key}
                style={{ background: actor.color, width: `${(actor.value / attributed) * 100}%` }}
              />
            ) : null
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <SegmentGroup
          isActive={(key) => selected === key || (!selected && key === undefined)}
          label="Source"
          onPick={(key) => onSelect(key)}
          segments={sources}
        />
        <SegmentGroup
          isActive={(key) => selectedActor === key}
          label="Attribution"
          onPick={(key) => onSelectActor?.(selectedActor === key ? undefined : key)}
          segments={actors}
        />
      </div>
    </Card>
  );
}
