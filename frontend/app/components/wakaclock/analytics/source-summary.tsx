'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  AnalyticsActorTypeFilter,
  AnalyticsExplorerResponse,
  AnalyticsSourceFilter,
} from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

function durationLabel(value?: number) {
  return value == null ? 'Unavailable' : formatDurationShort(value);
}

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
  const cards = [
    { key: undefined, label: 'Total time', value: data.summary.total_seconds },
    { key: 'human' as const, label: 'Human', value: data.summary.human_seconds },
    { key: 'ai' as const, label: 'AI agent', value: data.summary.ai_seconds },
    { key: 'other' as const, label: 'Other / handover', value: data.summary.other_seconds },
  ];
  const actorCards = [
    { key: 'human' as const, label: 'Human', value: data.summary.human_seconds },
    {
      key: 'ai_verified' as const,
      label: 'AI verified',
      value: data.summary.ai_verified_seconds ?? 0,
    },
    {
      key: 'ai_inferred' as const,
      label: 'AI inferred',
      value: data.summary.ai_inferred_seconds ?? 0,
    },
    { key: 'unknown' as const, label: 'Unknown', value: data.summary.unknown_seconds },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const active = selected === card.key || (!selected && card.key === undefined);
        return (
          <button
            aria-pressed={active}
            className="text-left"
            key={card.label}
            onClick={() => onSelect(card.key)}
            type="button"
          >
            <Card
              aria-label={`${card.label}: ${durationLabel(card.value)}`}
              className={active ? 'border-primary ring-primary/20 h-full ring-2' : 'h-full'}
            >
              <CardHeader className="pb-2">
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="text-2xl">{durationLabel(card.value)}</CardTitle>
              </CardHeader>
            </Card>
          </button>
        );
      })}
      {actorCards.map((card) => {
        const active = selectedActor === card.key;
        return (
          <button
            aria-pressed={active}
            className="text-left"
            key={`actor:${card.key}`}
            onClick={() => onSelectActor?.(active ? undefined : card.key)}
            type="button"
          >
            <Card
              aria-label={`${card.label}: ${durationLabel(card.value)}`}
              className={active ? 'border-primary ring-primary/20 h-full ring-2' : 'h-full'}
            >
              <CardHeader className="pb-2">
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="text-2xl">{durationLabel(card.value)}</CardTitle>
              </CardHeader>
            </Card>
          </button>
        );
      })}
      <Card>
        <CardContent className="flex h-full flex-col justify-center p-4">
          <p className="text-muted-foreground text-xs">AI share</p>
          <p className="mt-1 text-2xl font-semibold">
            {data.summary.ai_share_percent === null
              ? '—'
              : `${data.summary.ai_share_percent.toFixed(1)}%`}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex h-full flex-col justify-center p-4">
          <p className="text-muted-foreground text-xs">Active days</p>
          <p className="mt-1 text-2xl font-semibold">{data.summary.active_days}</p>
        </CardContent>
      </Card>
    </div>
  );
}
