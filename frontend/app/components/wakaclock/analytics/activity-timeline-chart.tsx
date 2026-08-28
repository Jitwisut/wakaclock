'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

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
  ai_seconds: { color: 'var(--chart-1)', label: 'AI' },
  human_seconds: { color: 'var(--chart-2)', label: 'Human' },
  other_seconds: { color: 'var(--chart-4)', label: 'Other / handover' },
} satisfies ChartConfig;

function granularityLabel(bucketSeconds: number) {
  if (bucketSeconds >= 86_400) return 'daily';
  if (bucketSeconds >= 3600) return 'hourly';
  return '30-minute';
}

export function ActivityTimelineChart({ data }: { data: AnalyticsExplorerResponse }) {
  const granularity = granularityLabel(data.timeline.bucket_seconds);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity timeline</CardTitle>
        <CardDescription>
          Canonical attended time split into {granularity} buckets. Human wins overlapping AI
          evidence.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="h-80 w-full" config={chartConfig}>
          <AreaChart data={data.timeline.items} margin={{ left: 4, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" minTickGap={28} tickLine={false} tickMargin={8} />
            <YAxis
              tickFormatter={(value) => formatDurationShort(Number(value))}
              tickLine={false}
              width={58}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatDurationShort(Number(value))}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="human_seconds"
              fill="var(--color-human_seconds)"
              fillOpacity={0.35}
              stackId="duration"
              stroke="var(--color-human_seconds)"
              type="monotone"
            />
            <Area
              dataKey="ai_seconds"
              fill="var(--color-ai_seconds)"
              fillOpacity={0.35}
              stackId="duration"
              stroke="var(--color-ai_seconds)"
              type="monotone"
            />
            <Area
              dataKey="other_seconds"
              fill="var(--color-other_seconds)"
              fillOpacity={0.3}
              stackId="duration"
              stroke="var(--color-other_seconds)"
              type="monotone"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
