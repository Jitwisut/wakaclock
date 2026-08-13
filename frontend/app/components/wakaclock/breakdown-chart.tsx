'use client';

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { formatDurationShort } from '@/lib/wakaclock/format';


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

/**
 * Plotted in seconds rather than hours. Hours forced the axis into decimals for anything
 * short — a 36-second session produced ticks like "0.0025h" — whereas seconds keep the
 * domain whole and let the tick formatter choose a sensible unit.
 */
const chartConfig = {
  seconds: { label: 'Time', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/** Row height is fixed so the chart grows with the data instead of stretching two bars to fill 16rem. */
const ROW_HEIGHT = 44;
const AXIS_HEIGHT = 36;

export function BreakdownChart({ data, maxItems = 8 }: BreakdownChartProps) {
  const rows = [...data]
    .sort((a, b) => b.total_seconds - a.total_seconds)
    .slice(0, maxItems)
    .map((row) => ({ ...row, seconds: row.total_seconds }));

  const height = rows.length * ROW_HEIGHT + AXIS_HEIGHT;

  return (
    <ChartContainer
      aria-label={`Time by ${rows.length} entries: ${rows
        .map((row) => `${row.name} ${formatDurationShort(row.total_seconds)}`)
        .join(', ')}`}
      className="w-full"
      config={chartConfig}
      // The bars carry visible value labels, so the chart is readable without the tooltip;
      // this describes the whole figure for screen readers in one pass.
      role="img"
      style={{ height }}
    >
      <BarChart
        accessibilityLayer
        barSize={22}
        data={rows}
        layout="vertical"
        // Right margin leaves room for the value label so it is never clipped.
        margin={{ left: 4, right: 56, top: 4, bottom: 0 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          axisLine={false}
          tickFormatter={formatDurationShort}
          tickLine={false}
          tickMargin={8}
          type="number"
        />
        <YAxis
          axisLine={false}
          dataKey="name"
          tick={{ fontSize: 12 }}
          tickLine={false}
          tickMargin={8}
          type="category"
          width={112}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatDurationShort(Number(value))}
              hideLabel={false}
            />
          }
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
        />
        <Bar
          dataKey="seconds"
          fill="var(--color-seconds)"
          // Guarantees a visible sliver for near-zero rows, which previously rendered as
          // a label with no bar at all and read as a rendering bug.
          minPointSize={3}
          radius={[4, 4, 4, 4]}
        >
          <LabelList
            className="fill-muted-foreground"
            dataKey="seconds"
            fontSize={12}
            formatter={(value) => formatDurationShort(Number(value))}
            offset={8}
            position="right"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
