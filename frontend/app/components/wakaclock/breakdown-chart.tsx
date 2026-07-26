'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';

/** Shared shape across StatsBreakdownItem / SummaryItem / InsightItem / ProjectItem. */
interface BreakdownRow {
  days?: number;
  heartbeats: number;
  hours: number;
  name: string;
  text: string;
  total_seconds: number;
}

interface BreakdownChartProps {
  data: BreakdownRow[];
  maxItems?: number;
}

const chartConfig = {
  hours: { label: 'Hours', color: 'var(--chart-1)' },
} satisfies ChartConfig;

export function BreakdownChart({ data, maxItems = 8 }: BreakdownChartProps) {
  const rows = [...data]
    .sort((a, b) => b.total_seconds - a.total_seconds)
    .slice(0, maxItems)
    .map((row) => ({ ...row, hours: Number(row.hours.toFixed(2)) }));

  return (
    <ChartContainer className="h-64 w-full" config={chartConfig}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis axisLine={false} tickLine={false} type="number" unit="h" />
        <YAxis
          axisLine={false}
          dataKey="name"
          tick={{ fontSize: 12 }}
          tickLine={false}
          type="category"
          width={112}
        />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--muted)' }} />
        <Bar dataKey="hours" fill="var(--color-hours)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
