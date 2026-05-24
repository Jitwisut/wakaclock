'use client';

import { ChevronUpIcon, DollarSignIcon, HandCoinsIcon } from 'lucide-react';
import { Bar, BarChart, XAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useIsMobile } from '@/hooks/use-mobile';

const chartData = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'June', desktop: 214, mobile: 140 },
];

const chartConfig = {
  desktop: {
    label: 'Revenue',
    color: 'var(--chart-1)',
  },
  mobile: {
    label: 'Sales',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

export function TotalEarningCard() {
  const isMobile = useIsMobile();

  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>Total Earning</CardDescription>
        <CardAction>
          <Badge className="text-green-600" variant="outline">
            <ChevronUpIcon className="size-4" /> 24.2%
          </Badge>
        </CardAction>
        <div className="flex items-center gap-4">
          <div className="font-display text-2xl lg:text-3xl">83%</div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-21/9! w-full" config={chartConfig}>
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: -8,
              right: -8,
            }}
          >
            <Bar
              barSize={50}
              dataKey="desktop"
              fill="var(--color-desktop)"
              radius={[0, 0, 5, 5]}
              stackId="a"
            />
            <Bar
              barSize={isMobile ? 30 : 50}
              dataKey="mobile"
              fill="var(--color-mobile)"
              radius={[5, 5, 0, 0]}
              stackId="a"
            />
            <XAxis
              axisLine={false}
              dataKey="month"
              tickFormatter={(value) => value.slice(0, 3)}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
            <defs>
              <linearGradient id="fillDesktop" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color)" />
                <stop offset="95%" stopColor="var(--chart-1)" />
              </linearGradient>
            </defs>
          </BarChart>
        </ChartContainer>
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex size-10 items-center justify-center rounded-md border">
              <HandCoinsIcon className="size-4" />
            </div>
            <div>
              <div className="font-medium">Total Revenue</div>
              <div className="text-muted-foreground text-xs">Client Payment</div>
            </div>
            <div className="ms-auto text-sm text-green-600">+$126</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-muted flex size-10 items-center justify-center rounded-md border">
              <DollarSignIcon className="size-4" />
            </div>
            <div>
              <div className="font-medium">Total Sales</div>
              <div className="text-muted-foreground text-xs">Refund</div>
            </div>
            <div className="ms-auto text-sm text-red-600">-$98</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
