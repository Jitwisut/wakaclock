'use client';

import { Dot, Line, LineChart } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const VISITOR_COLOR = 'var(--color-visitors)';

const chartData = [
  { browser: 'chrome', visitors: 100, fill: VISITOR_COLOR },
  { browser: 'safari', visitors: 200, fill: VISITOR_COLOR },
  { browser: 'firefox', visitors: 150, fill: VISITOR_COLOR },
  { browser: 'edge', visitors: 250, fill: VISITOR_COLOR },
  { browser: 'other', visitors: 110, fill: VISITOR_COLOR },
];

const chartConfig = {
  visitors: {
    label: 'Revenue',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function TotalRevenueCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-display text-3xl leading-6">$15,231.89</div>
        <p className="text-muted-foreground mt-1.5 text-xs">
          <span className="text-green-600">+20.1%</span> from last month
        </p>
        <ChartContainer className="mt-4 h-[100px] w-full" config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: 8,
              right: 8,
              left: 8,
            }}
          >
            <ChartTooltip
              content={<ChartTooltipContent hideLabel indicator="line" nameKey="visitors" />}
              cursor={false}
            />
            <Line
              dataKey="visitors"
              dot={({ payload, ...props }) => (
                <Dot
                  cx={props.cx}
                  cy={props.cy}
                  fill="var(--background)"
                  key={payload.browser}
                  r={5}
                  stroke={payload.fill}
                />
              )}
              stroke="var(--color-visitors)"
              strokeWidth={2}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
