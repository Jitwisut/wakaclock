'use client';

import { Bar, BarChart, XAxis } from 'recharts';

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

export function EcommerceTotalRevenueCard() {
  const chartConfig = {
    desktop: {
      label: 'Desktop',
      color: 'var(--chart-1)',
    },
    mobile: {
      label: 'Mobile',
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig;

  const chartData = [
    { month: 'January', desktop: 190, mobile: 180 },
    { month: 'February', desktop: 250, mobile: 200 },
    { month: 'March', desktop: 240, mobile: 120 },
    { month: 'April', desktop: 120, mobile: 190 },
    { month: 'May', desktop: 110, mobile: 130 },
    { month: 'June', desktop: 250, mobile: 140 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Revenue</CardTitle>
        <CardDescription>Income in the last 28 days</CardDescription>
        <CardAction className="relative col-start-auto row-start-auto justify-self-start lg:col-start-2 lg:row-start-1 lg:justify-self-end">
          <div className="end-0 top-0 mt-2 flex flex-col items-stretch space-y-0 p-0 sm:flex-row lg:absolute lg:mt-0">
            <div className="flex gap-8 rounded-lg border p-4">
              <button className="flex flex-1 flex-col justify-center gap-2 text-left">
                <span className="text-muted-foreground text-xs tracking-wider uppercase">
                  Desktop
                </span>
                <span className="font-display text-lg leading-none sm:text-2xl">24,828</span>
              </button>
              <button className="flex flex-1 flex-col justify-center gap-2 text-left">
                <span className="text-muted-foreground text-xs tracking-wider uppercase">
                  Mobile
                </span>
                <span className="font-display text-lg leading-none sm:text-2xl">25,010</span>
              </button>
            </div>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="lg:mt-10">
          <ChartContainer className="!aspect-21/9 w-full" config={chartConfig}>
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: -6,
                right: -6,
              }}
            >
              <XAxis
                axisLine={false}
                dataKey="month"
                tickFormatter={(value) => value}
                tickLine={false}
                tickMargin={10}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} cursor={false} />
              <Bar dataKey="desktop" fill="var(--color-desktop)" radius={8} />
              <Bar dataKey="mobile" fill="var(--color-mobile)" radius={8} />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
