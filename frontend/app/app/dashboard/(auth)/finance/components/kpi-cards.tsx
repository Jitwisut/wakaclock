'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  DollarSignIcon,
  FileTextIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  WalletIcon,
} from 'lucide-react';
import { Bar, BarChart } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const chartData = [
  { date: '2024-04-01', desktop: 222, mobile: 150 },
  { date: '2024-04-02', desktop: 97, mobile: 180 },
  { date: '2024-04-03', desktop: 167, mobile: 120 },
  { date: '2024-04-04', desktop: 242, mobile: 260 },
  { date: '2024-04-05', desktop: 373, mobile: 290 },
  { date: '2024-04-06', desktop: 301, mobile: 340 },
  { date: '2024-04-07', desktop: 245, mobile: 180 },
  { date: '2024-04-08', desktop: 409, mobile: 320 },
  { date: '2024-04-09', desktop: 59, mobile: 110 },
  { date: '2024-04-10', desktop: 261, mobile: 190 },
  { date: '2024-04-11', desktop: 327, mobile: 350 },
  { date: '2024-04-12', desktop: 292, mobile: 210 },
  { date: '2024-04-13', desktop: 342, mobile: 380 },
  { date: '2024-04-14', desktop: 137, mobile: 220 },
  { date: '2024-04-15', desktop: 120, mobile: 170 },
  { date: '2024-04-16', desktop: 138, mobile: 190 },
  { date: '2024-04-17', desktop: 446, mobile: 360 },
  { date: '2024-04-18', desktop: 364, mobile: 410 },
  { date: '2024-04-19', desktop: 243, mobile: 180 },
  { date: '2024-04-20', desktop: 89, mobile: 150 },
  { date: '2024-04-21', desktop: 137, mobile: 200 },
  { date: '2024-04-22', desktop: 224, mobile: 170 },
  { date: '2024-04-23', desktop: 138, mobile: 230 },
  { date: '2024-04-24', desktop: 387, mobile: 290 },
  { date: '2024-04-25', desktop: 215, mobile: 250 },
  { date: '2024-04-26', desktop: 75, mobile: 130 },
  { date: '2024-04-27', desktop: 383, mobile: 420 },
  { date: '2024-04-28', desktop: 122, mobile: 180 },
  { date: '2024-04-29', desktop: 315, mobile: 240 },
  { date: '2024-04-30', desktop: 454, mobile: 380 },
  { date: '2024-05-01', desktop: 165, mobile: 220 },
  { date: '2024-05-02', desktop: 293, mobile: 310 },
  { date: '2024-05-03', desktop: 247, mobile: 190 },
  { date: '2024-05-04', desktop: 385, mobile: 420 },
  { date: '2024-05-05', desktop: 481, mobile: 390 },
  { date: '2024-05-06', desktop: 498, mobile: 520 },
  { date: '2024-05-07', desktop: 388, mobile: 300 },
  { date: '2024-05-08', desktop: 149, mobile: 210 },
  { date: '2024-05-09', desktop: 227, mobile: 180 },
  { date: '2024-05-10', desktop: 293, mobile: 330 },
  { date: '2024-05-11', desktop: 335, mobile: 270 },
  { date: '2024-05-12', desktop: 197, mobile: 240 },
  { date: '2024-05-13', desktop: 197, mobile: 160 },
  { date: '2024-05-14', desktop: 448, mobile: 490 },
  { date: '2024-05-15', desktop: 473, mobile: 380 },
  { date: '2024-05-16', desktop: 338, mobile: 400 },
  { date: '2024-05-17', desktop: 499, mobile: 420 },
  { date: '2024-05-18', desktop: 315, mobile: 350 },
];

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export default function KPICards() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm">
            <WalletIcon className="mr-3 inline size-7 rounded-md border p-1.5" />
            My Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-display text-3xl">$125,430</div>
            <div className="flex flex-col text-sm text-green-600">
              <span className="flex items-center gap-2">
                <TrendingUpIcon className="size-4" />
                12.5%
              </span>
              <span className="text-muted-foreground ml-1">compared to last month</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="grow">
              <ArrowUpIcon />
              Transfer
            </Button>
            <Button className="grow" variant="outline">
              <ArrowDownIcon />
              Request
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm">
            <TrendingUpIcon className="mr-3 inline size-7 rounded-md border p-1.5" />
            Net Profit
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-full flex-col justify-between">
          <div className="font-display mb-2 text-3xl">$38,700</div>
          <div className="flex items-center text-sm text-green-600">
            <TrendingUpIcon className="mr-1 h-4 w-4" />
            8.5%
            <span className="text-muted-foreground ml-1">compared to last month</span>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm">
            <DollarSignIcon className="mr-3 inline size-7 rounded-md border p-1.5" />
            Expenses
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-full flex-col justify-between">
          <div className="font-display mb-2 text-3xl">$26,450</div>
          <div className="flex items-center text-sm text-red-600">
            <TrendingDownIcon className="mr-1 h-4 w-4" />
            5.5%
            <span className="text-muted-foreground ml-1">compared to last month</span>
          </div>
        </CardContent>
      </Card>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm">
            <FileTextIcon className="mr-3 inline size-7 rounded-md border p-1.5" />
            Pending Invoices
          </CardTitle>
          <CardAction>
            <Badge className="text-xs" variant="destructive">
              3 overdue invoices
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex h-full flex-col justify-between">
          <div className="space-y-2">
            <div className="font-display text-3xl">$3,200</div>
          </div>
        </CardContent>
        <div className="-mb-1.5">
          <ChartContainer className="h-14 w-full" config={chartConfig}>
            <BarChart accessibilityLayer data={chartData}>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
              <Bar dataKey="desktop" fill="var(--color-desktop)" radius={[7, 7, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </Card>
    </div>
  );
}
