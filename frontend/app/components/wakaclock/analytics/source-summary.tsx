'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyticsExplorerResponse, AnalyticsSourceFilter } from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

export function SourceSummary({
  data,
  onSelect,
  selected,
}: {
  data: AnalyticsExplorerResponse;
  onSelect: (source?: AnalyticsSourceFilter) => void;
  selected?: AnalyticsSourceFilter;
}) {
  const cards = [
    { key: undefined, label: 'Total time', value: data.summary.total_seconds },
    { key: 'human' as const, label: 'Human', value: data.summary.human_seconds },
    { key: 'ai' as const, label: 'AI agent', value: data.summary.ai_seconds },
    { key: 'other' as const, label: 'Other / handover', value: data.summary.other_seconds },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const active = selected === card.key || (!selected && card.key === undefined);
        return (
          <button className="text-left" key={card.label} onClick={() => onSelect(card.key)} type="button">
            <Card className={active ? 'border-primary ring-primary/20 h-full ring-2' : 'h-full'}>
              <CardHeader className="pb-2">
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="text-2xl">{formatDurationShort(card.value)}</CardTitle>
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
