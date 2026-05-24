'use client';

import React from 'react';

import { ChevronRightIcon } from 'lucide-react';
import { Label, Pie, PieChart } from 'recharts';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

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
    label: 'Chrome',
    color: 'var(--chart-1)',
  },
  safari: {
    label: 'Safari',
    color: 'var(--chart-2)',
  },
  firefox: {
    label: 'Firefox',
    color: 'var(--chart-3)',
  },
  edge: {
    label: 'Edge',
    color: 'var(--chart-4)',
  },
  other: {
    label: 'Other',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig;

const summaryData = [
  { name: 'Food & Drink', value: 48, color: 'var(--chart-1)' },
  { name: 'Grocery', value: 32, color: 'var(--chart-2)' },
  { name: 'Shopping', value: 13, color: 'var(--chart-3)' },
  { name: 'Transport', value: 7, color: 'var(--chart-4)' },
];

export default function Summary() {
  const totalVisitors = React.useMemo(
    () => chartData.reduce((acc, curr) => acc + curr.visitors, 0),
    []
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
        <CardDescription>Data from 1-12 Apr, 2024</CardDescription>
        <CardAction>
          <Button size="icon" variant="outline">
            <ChevronRightIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex flex-1 items-center justify-center">
          <ChartContainer
            className="mx-auto aspect-square max-h-[250px] w-full"
            config={chartConfig}
          >
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
                            ${totalVisitors.toLocaleString()}
                          </tspan>
                        </text>
                      );
                    }
                    return null;
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {summaryData.map((item) => (
            <div
              className="bg-muted flex items-center justify-between rounded-md p-4"
              key={`summary-${item.name}`}
            >
              <div className="flex items-center space-x-2">
                <div className="size-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground text-sm">{item.name}</span>
              </div>
              <span className="text-sm font-medium">{item.value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
