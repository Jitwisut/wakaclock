'use client';

import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';

export function AchievementByYear() {
  return (
    <Card className="xl:col-span-1">
      <CardHeader>
        <CardTitle>Achievement by Year</CardTitle>
        <CardDescription>
          You completed more projects per day on average this year than last year.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid auto-rows-min gap-2">
          <div className="flex items-baseline gap-1 text-2xl leading-none font-semibold tabular-nums">
            57
            <span className="text-muted-foreground text-xs font-normal">projects</span>
          </div>
          <ChartContainer
            className="aspect-auto h-[32px] w-full"
            config={{
              steps: {
                label: 'Steps',
                color: 'var(--chart-1)',
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={[
                {
                  date: '2024',
                  steps: 57,
                },
              ]}
              layout="vertical"
              margin={{
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <Bar barSize={32} dataKey="steps" fill="var(--color-steps)" radius={4}>
                <LabelList
                  dataKey="date"
                  fill="var(--primary-foreground)"
                  fontSize={12}
                  offset={8}
                  position="insideLeft"
                />
              </Bar>
              <YAxis dataKey="date" hide tickCount={1} type="category" />
              <XAxis dataKey="steps" hide type="number" />
            </BarChart>
          </ChartContainer>
        </div>
        <div className="grid auto-rows-min gap-2">
          <div className="flex items-baseline gap-1 text-2xl leading-none font-semibold tabular-nums">
            29
            <span className="text-muted-foreground text-xs font-normal">projects</span>
          </div>
          <ChartContainer
            className="aspect-auto h-[32px] w-full"
            config={{
              steps: {
                label: 'Steps',
                color: 'var(--chart-2)',
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={[
                {
                  date: '2023',
                  steps: 48,
                },
              ]}
              layout="vertical"
              margin={{
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <Bar barSize={32} dataKey="steps" fill="var(--color-steps)" radius={4}>
                <LabelList
                  dataKey="date"
                  fill="var(--primary-foreground)"
                  fontSize={12}
                  offset={8}
                  position="insideLeft"
                />
              </Bar>
              <YAxis dataKey="date" hide tickCount={1} type="category" />
              <XAxis dataKey="steps" hide type="number" />
            </BarChart>
          </ChartContainer>
        </div>
        <div className="grid auto-rows-min gap-2">
          <div className="flex items-baseline gap-1 text-2xl leading-none font-semibold tabular-nums">
            35
            <span className="text-muted-foreground text-xs font-normal">projects</span>
          </div>
          <ChartContainer
            className="aspect-auto h-[32px] w-full"
            config={{
              steps: {
                label: 'Steps',
                color: 'var(--chart-3)',
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={[
                {
                  date: '2022',
                  steps: 42,
                },
              ]}
              layout="vertical"
              margin={{
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <Bar barSize={32} dataKey="steps" fill="var(--color-steps)" radius={4}>
                <LabelList
                  dataKey="date"
                  fill="var(--primary-foreground)"
                  fontSize={12}
                  offset={8}
                  position="insideLeft"
                />
              </Bar>
              <YAxis dataKey="date" hide tickCount={1} type="category" />
              <XAxis dataKey="steps" hide type="number" />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
