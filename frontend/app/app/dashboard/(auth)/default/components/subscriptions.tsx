'use client';

import { Bar, BarChart, LabelList } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const chartData = [
  {
    revenue: 10_400,
    subscription: 240,
  },
  {
    revenue: 14_405,
    subscription: 300,
  },
  {
    revenue: 9400,
    subscription: 200,
  },
  {
    revenue: 8200,
    subscription: 278,
  },
  {
    revenue: 7000,
    subscription: 189,
  },
  {
    revenue: 9600,
    subscription: 239,
  },
  {
    revenue: 11_244,
    subscription: 278,
  },
  {
    revenue: 26_475,
    subscription: 189,
  },
];

const chartConfig = {
  desktop: {
    label: 'Subscription',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

export function SubscriptionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscriptions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-display text-3xl leading-6">+4850</div>
        <p className="text-muted-foreground mt-1.5 text-xs">
          <span className="text-green-500">+180.1%</span> from last month
        </p>
        <ChartContainer className="mt-6 h-[100px] w-full" config={chartConfig}>
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: 22,
              right: 0,
              left: 0,
            }}
          >
            <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
            <Bar dataKey="subscription" fill="var(--color-desktop)" radius={5}>
              <LabelList className="fill-foreground" fontSize={12} offset={12} position="top" />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
