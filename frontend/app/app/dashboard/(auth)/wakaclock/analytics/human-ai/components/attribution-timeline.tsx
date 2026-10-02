'use client';

import { useState } from 'react';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import type { AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

import { ACTORS, percentOf } from './attribution';
import styles from './human-ai.module.css';

const INFERRED_PATTERN = 'hai-inferred-pattern';

const chartConfig = {
  human_seconds: { color: 'var(--hai-human)', label: 'Human' },
  ai_verified_seconds: { color: 'var(--hai-ai)', label: 'AI verified' },
  ai_inferred_seconds: { color: 'var(--hai-ai)', label: 'AI inferred' },
  unknown_seconds: { color: 'var(--hai-unknown)', label: 'Unknown' },
} satisfies ChartConfig;

type Mode = 'share' | 'time';

/** Axis and tooltip text for a value in the given measure. */
export function formatMeasure(mode: Mode, value: unknown) {
  return mode === 'share' ? `${Number(value).toFixed(0)}%` : formatDurationShort(Number(value));
}

export const formatShare = (value: unknown) => formatMeasure('share', value);
export const formatTime = (value: unknown) => formatMeasure('time', value);

export function granularityLabel(bucketSeconds: number) {
  if (bucketSeconds >= 86_400) return 'Daily';
  if (bucketSeconds >= 3600) return 'Hourly';
  return '30-minute';
}

/** Rows for the chart: raw seconds, or each actor's share of its bucket. */
export function timelineRows(data: AnalyticsExplorerResponse, mode: Mode) {
  return data.timeline.items.map((item) => {
    const row: Record<string, number | string> = { label: item.label };
    for (const actor of ACTORS) {
      const seconds = item[actor.field] ?? 0;
      row[actor.field] = mode === 'share' ? percentOf(seconds, item.total_seconds) : seconds;
    }
    return row;
  });
}

export function AttributionTimeline({ data }: { data: AnalyticsExplorerResponse }) {
  const [mode, setMode] = useState<Mode>('time');
  const format = mode === 'share' ? formatShare : formatTime;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>Attribution over time</CardTitle>
            <CardDescription>
              {granularityLabel(data.timeline.bucket_seconds)} buckets.{' '}
              {mode === 'share'
                ? 'Each bar is 100% of that bucket, so the mix is comparable on quiet and busy days.'
                : 'Bar height is the canonical time in that bucket.'}
            </CardDescription>
          </div>
          <div aria-label="Chart measure" className="flex gap-1" role="group">
            <Button
              aria-pressed={mode === 'time'}
              onClick={() => setMode('time')}
              size="sm"
              variant={mode === 'time' ? 'default' : 'outline'}
            >
              Time
            </Button>
            <Button
              aria-pressed={mode === 'share'}
              onClick={() => setMode('share')}
              size="sm"
              variant={mode === 'share' ? 'default' : 'outline'}
            >
              Share
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ChartContainer className="h-72 w-full" config={chartConfig}>
          <BarChart
            accessibilityLayer
            data={timelineRows(data, mode)}
            margin={{ left: 4, right: 8 }}
          >
            <defs>
              <pattern
                height="6"
                id={INFERRED_PATTERN}
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
                width="6"
              >
                <rect fill="var(--hai-ai)" fillOpacity={0.35} height="6" width="6" />
                <rect fill="var(--hai-ai)" height="6" width="2.5" />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" minTickGap={28} tickLine={false} tickMargin={8} />
            <YAxis
              domain={mode === 'share' ? [0, 100] : undefined}
              tickFormatter={format}
              tickLine={false}
              width={58}
            />
            <ChartTooltip content={<ChartTooltipContent formatter={format} />} />
            {ACTORS.map((actor) => (
              <Bar
                dataKey={actor.field}
                fill={
                  actor.tone === 'inferred'
                    ? `url(#${INFERRED_PATTERN})`
                    : `var(--color-${actor.field})`
                }
                isAnimationActive={false}
                key={actor.field}
                maxBarSize={28}
                stackId="attribution"
                stroke="var(--hai-gap)"
                strokeWidth={1}
              />
            ))}
          </BarChart>
        </ChartContainer>
        <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-xs">
          {ACTORS.map((actor) => (
            <li className="flex items-center gap-2" key={actor.key}>
              <span className={cn(styles.swatch, styles[actor.tone])} />
              {actor.label}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
