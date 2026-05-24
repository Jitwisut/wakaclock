'use client';

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
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

export function TargetCard() {
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="font-display text-xl">Your target is incomplete</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div>
            <ChartContainer className="mx-auto aspect-square h-[60px]" config={chartConfig}>
              <RadialBarChart
                data={chartData}
                endAngle={250}
                innerRadius={25}
                outerRadius={20}
                startAngle={0}
              >
                <PolarGrid
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
                              className="fill-foreground font-bold"
                              x={viewBox.cx}
                              y={viewBox.cy}
                            >
                              %48
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
          </div>
          <p className="text-muted-foreground text-sm">
            You have completed <span className="text-orange-500">48%</span> of the given target, you
            can also check your status
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
