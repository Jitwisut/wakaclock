'use client';

import { AreaChartIcon, DollarSignIcon, HandCoinsIcon } from 'lucide-react';
import { Bar, BarChart, XAxis } from 'recharts';

import { ExportButton } from '@/components/CardActionMenus';
import { Badge } from '@/components/ui/badge';
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
import { Progress } from '@/components/ui/progress';
import { useIsMobile } from '@/hooks/use-mobile';

const chartData = [
  { day: 'Mo', sales: 35 },
  { day: 'Thu', sales: 30 },
  { day: 'We', sales: 37 },
  { day: 'Th', sales: 14 },
  { day: 'Fr', sales: 20 },
  { day: 'Sa', sales: 24 },
  { day: 'Su', sales: 38 },
];

const chartConfig = {
  desktop: {
    label: 'Sales',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function EarningReportsCard() {
  const isMobile = useIsMobile();

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Earning Reports</CardTitle>
        <CardDescription>Last 28 days</CardDescription>
        <CardAction className="relative">
          <ExportButton className="absolute end-0 top-0" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="font-display text-2xl lg:text-3xl">$1.468</div>
                <Badge className="bg-green-600">+4.2%</Badge>
              </div>
              <ChartContainer className="max-h-[245px] w-full" config={chartConfig}>
                <BarChart accessibilityLayer data={chartData}>
                  <XAxis
                    axisLine={false}
                    dataKey="day"
                    tickFormatter={(value) => value.slice(0, 3)}
                    tickLine={false}
                    tickMargin={10}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent color="var(--chart-2)" hideLabel />}
                    cursor={false}
                  />
                  <Bar
                    barSize={isMobile ? 30 : 50}
                    dataKey="sales"
                    fill="url(#fillGradient)"
                    radius={5}
                  />
                  <defs>
                    <linearGradient id="fillGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" />
                      <stop offset="95%" stopColor="var(--chart-1)" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ChartContainer>
            </div>
          </div>
          <div>
            <div className="flex flex-col space-y-4">
              <div className="bg-muted border-border flex flex-col gap-4 rounded-md border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-background border-border flex size-8 items-center justify-center rounded-md border">
                      <DollarSignIcon className="size-4" />
                    </div>
                    <span>Earnings</span>
                  </div>
                  <div className="font-semibold">$545.69</div>
                </div>
                <Progress className="h-1" indicatorColor="bg-black dark:bg-white/90" value={70} />
              </div>
              <div className="bg-muted border-border flex flex-col gap-4 rounded-md border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-background border-border flex size-8 items-center justify-center rounded-md border">
                      <AreaChartIcon className="size-4" />
                    </div>
                    <span>Profit</span>
                  </div>
                  <div className="font-semibold">$256.34</div>
                </div>
                <Progress className="h-1" indicatorColor="bg-black dark:bg-white/90" value={45} />
              </div>
              <div className="bg-muted border-border flex flex-col gap-4 rounded-md border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="bg-background border-border flex size-8 items-center justify-center rounded-md border">
                      <HandCoinsIcon className="size-4" />
                    </div>
                    <span>Expense</span>
                  </div>
                  <div className="font-semibold">$74.19</div>
                </div>
                <Progress className="h-1" indicatorColor="bg-black dark:bg-white/90" value={80} />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
