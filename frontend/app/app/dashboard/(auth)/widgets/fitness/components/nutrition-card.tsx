'use client';

import { Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';

const macros = [
  { label: 'Carbs', amount: '178g', color: 'bg-red-400' },
  { label: 'Protein', amount: '92g', color: 'bg-blue-400' },
  { label: 'Fats', amount: '38g', color: 'bg-yellow-400' },
];

const chartData = [{ browser: 'safari', visitors: 1300, fill: 'var(--color-safari)' }];

const chartConfig = {
  visitors: {
    label: 'Visitors',
  },
  safari: {
    label: 'Safari',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function NutritionCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Nutrition</CardTitle>
        <CardDescription>Today&#39;s intake</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ChartContainer className="mx-auto aspect-square h-44 w-full" config={chartConfig}>
          <RadialBarChart
            data={chartData}
            endAngle={300}
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
                          kcal
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
        <p className="text-muted-foreground text-center text-sm">680 kcal remaining</p>
        <div className="grid grid-cols-3 gap-3">
          {macros.map((macro) => (
            <div className="bg-muted rounded-xl p-4 text-center" key={macro.label}>
              <div className={`h-1 w-8 ${macro.color} mx-auto mb-2 rounded-full`} />
              <p className="text-muted-foreground mb-1 text-xs">{macro.label}</p>
              <p className="text-lg font-bold">{macro.amount}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
