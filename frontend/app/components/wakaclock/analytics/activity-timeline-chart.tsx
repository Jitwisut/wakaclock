'use client';

import { useState } from 'react';

import { Area, Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import type { AnalyticsExplorerResponse } from '@/lib/wakaclock/analytics';
import { formatDurationShort } from '@/lib/wakaclock/format';

const chartConfig = {
  human_seconds: { color: 'var(--chart-2)', label: 'Human' },
  ai_verified_seconds: { color: 'var(--chart-1)', label: 'AI verified' },
  ai_inferred_seconds: { color: 'var(--chart-3)', label: 'AI inferred' },
  unknown_seconds: { color: 'var(--chart-4)', label: 'Unknown' },
} satisfies ChartConfig;

function granularityLabel(bucketSeconds: number) {
  if (bucketSeconds >= 86_400) return 'daily';
  if (bucketSeconds >= 3600) return 'hourly';
  return '30-minute';
}

export function ActivityTimelineChart({ data }: { data: AnalyticsExplorerResponse }) {
  const [mode, setMode] = useState<'bars' | 'wave'>('wave');
  const granularity = granularityLabel(data.timeline.bucket_seconds);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>Activity timeline</CardTitle>
          <div aria-label="Chart style" className="flex gap-2" role="group">
            <Button
              aria-pressed={mode === 'wave'}
              onClick={() => setMode('wave')}
              size="sm"
              variant={mode === 'wave' ? 'default' : 'outline'}
            >
              ↝ Wave
            </Button>
            <Button
              aria-pressed={mode === 'bars'}
              onClick={() => setMode('bars')}
              size="sm"
              variant={mode === 'bars' ? 'default' : 'outline'}
            >
              ▥ Bars
            </Button>
          </div>
        </div>
        <CardDescription>
          Canonical time split into {granularity} buckets by Human, verified AI, inferred AI and
          Unknown attribution.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="h-80 w-full" config={chartConfig}>
          <ComposedChart
            accessibilityLayer
            data={data.timeline.items}
            margin={{ left: 4, right: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" minTickGap={28} tickLine={false} tickMargin={8} />
            <YAxis
              tickFormatter={(value) => formatDurationShort(Number(value))}
              tickLine={false}
              width={58}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent formatter={(value) => formatDurationShort(Number(value))} />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {Object.entries(chartConfig).map(([key, config]) =>
              mode === 'wave' ? (
                <Area
                  dataKey={key}
                  fill={config.color}
                  fillOpacity={0.3}
                  isAnimationActive={false}
                  key={key}
                  stackId="duration"
                  stroke={config.color}
                  strokeWidth={2.5}
                  type="stepAfter"
                />
              ) : (
                <Bar
                  dataKey={key}
                  fill={config.color}
                  isAnimationActive={false}
                  key={key}
                  maxBarSize={32}
                  stackId="duration"
                />
              )
            )}
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
