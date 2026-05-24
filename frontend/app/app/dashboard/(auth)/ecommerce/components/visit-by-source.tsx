'use client';

import { Label, Pie, PieChart } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

export function EcommerceVisitBySourceCard() {
  const chartData = [
    { browser: 'chrome', visitors: 275, fill: 'var(--color-chrome)' },
    { browser: 'safari', visitors: 200, fill: 'var(--color-safari)' },
    { browser: 'firefox', visitors: 287, fill: 'var(--color-firefox)' },
    { browser: 'edge', visitors: 173, fill: 'var(--color-edge)' },
    { browser: 'other', visitors: 190, fill: 'var(--color-other)' },
  ];

  const chartConfig = {
    visitors: {
      label: 'Visitors',
    },
    chrome: {
      label: 'Direct',
      color: 'var(--chart-1)',
    },
    safari: {
      label: 'Social',
      color: 'var(--chart-2)',
    },
    firefox: {
      label: 'Email',
      color: 'var(--chart-3)',
    },
    edge: {
      label: 'Referrals',
      color: 'var(--chart-4)',
    },
    other: {
      label: 'Other',
      color: 'var(--chart-5)',
    },
  } satisfies ChartConfig;

  return (
    <Card className="lg:col-span-6 xl:col-span-3">
      <CardHeader>
        <CardTitle>Store Visits by Source</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer className="mx-auto aspect-square max-h-[350px]" config={chartConfig}>
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
            <Pie
              data={chartData}
              dataKey="visitors"
              innerRadius={60}
              nameKey="browser"
              strokeWidth={5}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text
                        dominantBaseline="middle"
                        textAnchor="middle"
                        x={viewBox.cx}
                        y={viewBox.cy}
                      >
                        <tspan
                          className="fill-foreground text-3xl font-bold"
                          x={viewBox.cx}
                          y={viewBox.cy}
                        >
                          {/* {totalVisitors.toLocaleString()} */} 10.2K
                        </tspan>
                        <tspan
                          className="fill-muted-foreground"
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                        >
                          Visitors
                        </tspan>
                      </text>
                    );
                  }
                  return null;
                }}
              />
            </Pie>
            <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
