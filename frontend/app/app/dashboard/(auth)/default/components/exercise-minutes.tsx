'use client';

import type React from 'react';

import { Line, LineChart, Tooltip } from 'recharts';

import { ExportButton } from '@/components/CardActionMenus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';

const THEME_PRIMARY = 'THEME_PRIMARY';

const chartData = [
  {
    average: 400,
    today: 240,
  },
  {
    average: 300,
    today: 139,
  },
  {
    average: 200,
    today: 400,
  },
  {
    average: 278,
    today: 390,
  },
  {
    average: 189,
    today: 480,
  },
  {
    average: 239,
    today: 380,
  },
  {
    average: 349,
    today: 400,
  },
];

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

export function ExerciseMinutes() {
  return (
    <Card className="h-full">
      <CardHeader className="flex items-start justify-between">
        <div className="space-y-1.5">
          <CardTitle>Exercise Minutes</CardTitle>
          <CardDescription>
            Your exercise minutes are ahead of where you normally are.
          </CardDescription>
        </div>
        <ExportButton />
      </CardHeader>
      <CardContent>
        <ChartContainer className="h-32 w-full lg:h-[250px]" config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: 5,
              right: 10,
              left: 10,
            }}
          >
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  return (
                    <div className="bg-background rounded-lg border p-2 shadow-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground text-[0.70rem] uppercase">
                            Average
                          </span>
                          <span className="text-muted-foreground font-bold">
                            {payload[0].value}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground text-[0.70rem] uppercase">
                            Today
                          </span>
                          <span className="font-bold">{payload[1].value}</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              activeDot={{
                r: 6,
                style: { fill: THEME_PRIMARY, opacity: 0.25 },
              }}
              dataKey="average"
              strokeWidth={2}
              style={
                {
                  stroke: THEME_PRIMARY,
                  opacity: 0.35,
                  '--theme-primary': `var(--primary)`,
                } as React.CSSProperties
              }
              type="monotone"
            />
            <Line
              activeDot={{
                r: 8,
                style: { fill: THEME_PRIMARY },
              }}
              dataKey="today"
              strokeWidth={2}
              style={
                {
                  stroke: THEME_PRIMARY,
                  '--theme-primary': `var(--primary)`,
                } as React.CSSProperties
              }
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
