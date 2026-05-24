'use client';

import { CartesianGrid, Line, LineChart, XAxis } from 'recharts';

import { ExportButton } from '@/components/CardActionMenus';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const chartData = [
  { month: 'January', received: 100, send: 180, withdraw: 290 },
  { month: 'February', received: 305, send: 200, withdraw: 150 },
  { month: 'March', received: 237, send: 120, withdraw: 180 },
  { month: 'April', received: 73, send: 230, withdraw: 120 },
  { month: 'May', received: 209, send: 130, withdraw: 125 },
  { month: 'June', received: 214, send: 140, withdraw: 270 },
  { month: 'July', received: 144, send: 170, withdraw: 240 },
];

const chartConfig = {
  received: {
    label: 'Total Received',
    color: 'var(--chart-1)',
  },
  send: {
    label: 'Total Send',
    color: 'var(--chart-2)',
  },
  withdraw: {
    label: 'Total Withdraw',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

export function BalanceSummeryChart() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Balance Summary</CardTitle>
        <CardAction className="relative">
          <div className="absolute end-0 top-0">
            <ExportButton />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mb-8 grid gap-4 text-sm md:grid-cols-2 lg:max-w-(--breakpoint-sm) lg:grid-cols-3">
          <div className="bg-muted space-y-2 rounded-md border p-4">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[var(--chart-1)]" />
              <span>{chartConfig.received.label}</span>
            </div>
            <div className="text-xl font-semibold">2.010550 BTC</div>
          </div>
          <div className="bg-muted space-y-2 rounded-md border p-4">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[var(--chart-2)]" />
              <span>{chartConfig.send.label}</span>
            </div>
            <div className="text-xl font-semibold">1.201055 BTC</div>
          </div>
          <div className="bg-muted space-y-2 rounded-md border p-4">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[var(--chart-3)]" />
              <span>{chartConfig.withdraw.label}</span>
            </div>
            <div className="text-xl font-semibold">5.41055 BTC</div>
          </div>
        </div>
        <ChartContainer className="w-full lg:h-[350px]" config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="month"
              tickFormatter={(value) => value.slice(0, 3)}
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
            <Line
              dataKey="received"
              dot={false}
              stroke="var(--color-received)"
              strokeWidth={2}
              type="monotone"
            />
            <Line
              dataKey="send"
              dot={false}
              stroke="var(--color-send)"
              strokeWidth={2}
              type="monotone"
            />
            <Line
              dataKey="withdraw"
              dot={false}
              stroke="var(--color-withdraw)"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
