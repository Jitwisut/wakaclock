'use client';

import { Area, AreaChart, CartesianGrid } from 'recharts';

import { CalendarDateRangePicker } from '@/components/custom-date-range-picker';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const chartData = [
  { month: 'January', desktop: 4 },
  { month: 'February', desktop: 5 },
  { month: 'March', desktop: 4 },
  { month: 'April', desktop: 6 },
  { month: 'May', desktop: 6 },
  { month: 'June', desktop: 7 },
];

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function CourseProgressByMonth() {
  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>Course Progress by Month</CardTitle>
        <CardDescription className="flex items-center gap-2">
          Compared to previous month 50.56%
          <Badge>+2.5%</Badge>
        </CardDescription>
        <CardAction>
          <CalendarDateRangePicker />
        </CardAction>
      </CardHeader>
      <ChartContainer className="w-full lg:h-[430px]" config={chartConfig}>
        <AreaChart
          accessibilityLayer
          data={chartData}
          margin={{
            left: 0,
            right: 0,
          }}
        >
          <CartesianGrid vertical={false} />
          <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
          <defs>
            <linearGradient id="fillDesktop" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--color-desktop)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--color-desktop)" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="fillMobile" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--color-mobile)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--color-mobile)" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <Area
            dataKey="mobile"
            fill="url(#fillMobile)"
            fillOpacity={0.4}
            stackId="a"
            stroke="var(--color-mobile)"
            type="natural"
          />
          <Area
            dataKey="desktop"
            fill="url(#fillDesktop)"
            fillOpacity={0.4}
            stackId="a"
            stroke="var(--color-desktop)"
            type="natural"
          />
        </AreaChart>
      </ChartContainer>
    </Card>
  );
}
