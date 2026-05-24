'use client';

import { Pie, PieChart } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const chartData = [
  { source: 'mentoring', leads: 65.2, fill: 'var(--color-mentoring)' },
  { source: 'organization', leads: 25, fill: 'var(--color-organization)' },
  { source: 'planning', leads: 9.8, fill: 'var(--color-planning)' },
];

const chartConfig = {
  mentoring: {
    label: 'Mentoring',
    color: 'var(--chart-1)',
  },
  organization: {
    label: 'Organization',
    color: 'var(--chart-2)',
  },
  planning: {
    label: 'Planning',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

type ChartConfigKeys = keyof typeof chartConfig;

export function ChartMostActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Most Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer className="mx-auto aspect-square max-h-[250px]" config={chartConfig}>
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
            <Pie
              data={chartData}
              dataKey="leads"
              innerRadius={60}
              nameKey="source"
              strokeWidth={5}
            />
          </PieChart>
        </ChartContainer>
        <div className="flex justify-around">
          {chartData.map((item) => (
            <div className="flex flex-col" key={item.source}>
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="block size-2 rounded-full"
                  style={{
                    backgroundColor: chartConfig[item.source as ChartConfigKeys]?.color,
                  }}
                />
                <div>{chartConfig[item.source as ChartConfigKeys]?.label}</div>
              </div>
              <div className="text-center text-xl font-semibold">{item.leads}%</div>
            </div>
          ))}
          <div />
        </div>
      </CardContent>
    </Card>
  );
}
