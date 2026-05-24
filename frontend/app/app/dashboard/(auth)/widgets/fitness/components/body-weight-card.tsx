'use client';

import { CartesianGrid, Line, LineChart, XAxis } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const chartData = [
  { month: 'January', weight: 68 },
  { month: 'February', weight: 55 },
  { month: 'March', weight: 70 },
  { month: 'April', weight: 45 },
  { month: 'May', weight: 68 },
  { month: 'June', weight: 57 },
];
const chartConfig = {
  weight: {
    label: 'Weight',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function BodyWeightCard() {
  return (
    <Card className="relative overflow-hidden border-0 bg-slate-900 text-white">
      <img
        alt="Body weight tracking"
        className="absolute inset-0 h-full w-full object-cover opacity-40"
        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/attachments/gen-images/public/fitness-person-lifting-weights-dramatic-lighting-oApiCHq5LsUhdfcVwBSzDhOZFaufqL.jpg"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-transparent" />
      <CardHeader className="relative pb-2">
        <CardTitle className="text-2xl font-bold">Body Weight</CardTitle>
        <p className="text-sm text-white/80">72 kg target</p>
      </CardHeader>
      <CardContent className="relative">
        <ChartContainer className="aspect-square h-[200px] w-full" config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 5,
              right: 5,
            }}
          >
            <CartesianGrid stroke="var(--color-slate-600)" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="month"
              tickFormatter={(value) => value.slice(0, 3)}
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
            <Line
              activeDot={{
                r: 6,
              }}
              dataKey="weight"
              dot={{
                fill: 'var(--color-slate-600)',
              }}
              stroke="var(--color-amber-300)"
              type="natural"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
