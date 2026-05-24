'use client';

import { Pie, PieChart } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const chartData = [
  { department: 'cardiology', visitors: 275, fill: 'var(--color-cardiology)' },
  { department: 'neurology', visitors: 200, fill: 'var(--color-neurology)' },
  { department: 'oncology', visitors: 187, fill: 'var(--color-oncology)' },
  { department: 'pediatrics', visitors: 173, fill: 'var(--color-pediatrics)' },
];

const chartConfig = {
  visitors: {
    label: 'Visitors',
  },
  cardiology: {
    label: 'Cardiology',
    color: 'var(--chart-1)',
  },
  neurology: {
    label: 'Neurology',
    color: 'var(--chart-2)',
  },
  oncology: {
    label: 'Oncology',
    color: 'var(--chart-3)',
  },
  pediatrics: {
    label: 'Pediatrics',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig;

export default function PatientsByDepartmentChart() {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Patients by Department</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="[&_.recharts-pie-label-text]:fill-foreground mx-auto aspect-square max-h-[400px] pb-0"
          config={chartConfig}
        >
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie data={chartData} dataKey="visitors" label nameKey="department" />
            <ChartLegend
              className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
              content={<ChartLegendContent nameKey="department" />}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
