'use client';

import { Heart } from 'lucide-react';
import { Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';

const chartData = [{ browser: 'safari', visitors: 200, fill: 'var(--color-safari)' }];

const chartConfig = {
  visitors: {
    label: 'Visitors',
  },
  safari: {
    label: 'Safari',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function HeartRateCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-muted-foreground text-sm font-medium">Heart Rate</CardTitle>
          <Heart className="text-destructive h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-center">
        <ChartContainer className="mx-auto aspect-square h-44 w-full" config={chartConfig}>
          <RadialBarChart
            data={chartData}
            endAngle={250}
            innerRadius={80}
            outerRadius={110}
            startAngle={0}
          >
            <PolarGrid
              className="first:fill-muted last:fill-background"
              gridType="circle"
              polarRadius={[86, 74]}
              radialLines={false}
              stroke="none"
            />
            <RadialBar background cornerRadius={10} dataKey="visitors" />
            <PolarRadiusAxis axisLine={false} tick={false} tickLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text
                        dominantBaseline="middle"
                        textAnchor="middle"
                        x={viewBox.cx}
                        y={viewBox.cy}
                      >
                        <tspan
                          className="fill-foreground text-4xl font-bold"
                          x={viewBox.cx}
                          y={viewBox.cy}
                        >
                          {chartData[0].visitors.toLocaleString()}
                        </tspan>
                        <tspan
                          className="fill-muted-foreground"
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                        >
                          BPM
                        </tspan>
                      </text>
                    );
                  }
                  return null;
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
