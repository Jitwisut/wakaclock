'use client';

import { Line, LineChart } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

export function EcommerceRevenueCard() {
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
    { month: 'January', desktop: 186, mobile: 80 },
    { month: 'February', desktop: 305, mobile: 200 },
    { month: 'March', desktop: 237, mobile: 120 },
    { month: 'April', desktop: 73, mobile: 190 },
    { month: 'May', desktop: 209, mobile: 130 },
    { month: 'June', desktop: 214, mobile: 140 },
  ];

  return (
    <Card className="md:col-span-6 xl:col-span-3">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Revenue</CardTitle>
        <CardDescription className="text-xs">
          <span className="text-green-500">+20.1%</span> from last month
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="font-display text-3xl">$125,231</div>
        <div className="pt-4">
          <ChartContainer className="h-[60px] w-full" config={chartConfig}>
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
                top: 6,
              }}
            >
              <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
              <Line
                activeDot={{
                  r: 6,
                }}
                dataKey="desktop"
                dot={{
                  fill: 'var(--color-desktop)',
                }}
                stroke="var(--color-desktop)"
                strokeWidth={2}
                type="natural"
              />
            </LineChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
