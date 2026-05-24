'use client';

import React from 'react';

import { Label, Pie, PieChart } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const TOTAL_SALES = 86_000;

const chartData = [
  { name: 'confirmed', value: 180, fill: 'var(--color-confirmed)' },
  { name: 'checkedIn', value: 120, fill: 'var(--color-checkedIn)' },
  { name: 'checkedOut', value: 62, fill: 'var(--color-checkedOut)' },
];

const chartConfig = {
  confirmed: {
    label: 'Confirmed',
    color: 'var(--chart-1)',
  },
  checkedIn: {
    label: 'Checked In',
    color: 'var(--chart-2)',
  },
  checkedOut: {
    label: 'Checked Out',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig;

export function ReservationsCard() {
  const total = React.useMemo(() => chartData.reduce((acc, curr) => acc + curr.value, 0), []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reservations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 lg:flex-row">
          <div className="relative flex-shrink-0">
            <ChartContainer className="aspect-square h-[250px]" config={chartConfig}>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
                <Pie data={chartData} dataKey="value" innerRadius={60} nameKey="name">
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
                              className="fill-foreground text-2xl font-semibold lg:text-3xl"
                              x={viewBox.cx}
                              y={viewBox.cy}
                            >
                              {total.toLocaleString()}
                            </tspan>
                            <tspan
                              className="fill-muted-foreground"
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 24}
                            >
                              Reservations
                            </tspan>
                          </text>
                        );
                      }
                      return null;
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>

          <div className="flex flex-row gap-3 lg:flex-col">
            {(Object.keys(chartConfig) as Array<keyof typeof chartConfig>).map((item) => (
              <div className="flex items-center gap-3" key={chartConfig[item]?.label}>
                <div
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: chartConfig[item].color }}
                />
                <span className="text-xs">{chartConfig[item].label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-center lg:mt-0">
          <p className="text-2xl font-semibold lg:text-3xl">${TOTAL_SALES.toLocaleString()}</p>
          <p className="text-muted-foreground mt-1 text-sm">Total Sales This Week</p>
        </div>
      </CardContent>
    </Card>
  );
}
