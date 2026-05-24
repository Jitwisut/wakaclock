'use client';

import { useState } from 'react';

import { Calendar, TrendingUp } from 'lucide-react';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RevenueDataItem {
  day: string;
  projected: number;
  revenue: number;
}

interface PeriodData {
  data: RevenueDataItem[];
  percentageChange: number;
  total: number;
}

const items = {
  weekly: {
    data: [
      { day: 'Sat', revenue: 2500, projected: 1500 },
      { day: 'Sun', revenue: 4500, projected: 2000 },
      { day: 'Mon', revenue: 3200, projected: 1800 },
      { day: 'Tue', revenue: 6500, projected: 1500 },
      { day: 'Wed', revenue: 4200, projected: 1800 },
      { day: 'Thu', revenue: 5500, projected: 2000 },
      { day: 'Fri', revenue: 3800, projected: 1700 },
    ],
    total: 12_480,
    percentageChange: 16,
  },
  monthly: {
    data: [
      { day: 'Week 1', revenue: 8500, projected: 3500 },
      { day: 'Week 2', revenue: 12_000, projected: 4000 },
      { day: 'Week 3', revenue: 9500, projected: 4500 },
      { day: 'Week 4', revenue: 14_000, projected: 3000 },
    ],
    total: 59_000,
    percentageChange: 22,
  },
  yearly: {
    data: [
      { day: 'Jan', revenue: 28_000, projected: 12_000 },
      { day: 'Feb', revenue: 32_000, projected: 10_000 },
      { day: 'Mar', revenue: 38_000, projected: 14_000 },
      { day: 'Apr', revenue: 30_000, projected: 15_000 },
      { day: 'May', revenue: 42_000, projected: 10_000 },
      { day: 'Jun', revenue: 45_000, projected: 12_000 },
      { day: 'Jul', revenue: 40_000, projected: 16_000 },
      { day: 'Aug', revenue: 44_000, projected: 14_000 },
      { day: 'Sep', revenue: 48_000, projected: 10_000 },
      { day: 'Oct', revenue: 38_000, projected: 18_000 },
      { day: 'Nov', revenue: 52_000, projected: 12_000 },
      { day: 'Dec', revenue: 58_000, projected: 15_000 },
    ],
    total: 643_000,
    percentageChange: 35,
  },
  selectedPeriod: 'weekly',
};

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'var(--color-chart-1)',
  },
  projected: {
    label: 'Projected',
    color: '#d1d5db',
  },
} satisfies ChartConfig;

const formatYAxisTick = (value: number) => {
  if (value === 0) return '0';
  if (value >= 1_000_000) return `${value / 1_000_000}M`;
  if (value >= 1000) return `${value / 1000}K`;
  return value.toString();
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);

const StripePattern = () => (
  <pattern
    height="8"
    id="stripePattern"
    patternTransform="rotate(-45)"
    patternUnits="userSpaceOnUse"
    width="8"
  >
    <rect fill="var(--muted)" height="8" width="8" />
    <rect fill="var(--background)" height="8" width="4" />
  </pattern>
);

const getYAxisConfig = (period: string) => {
  switch (period) {
    case 'yearly': {
      return { ticks: [0, 20_000, 40_000, 60_000, 80_000], domain: [0, 80_000], refLine: 50_000 };
    }
    case 'monthly': {
      return { ticks: [0, 5000, 10_000, 15_000, 20_000], domain: [0, 20_000], refLine: 12_000 };
    }
    default: {
      return { ticks: [0, 2000, 4000, 6000, 8000, 10_000], domain: [0, 10_000], refLine: 6000 };
    }
  }
};

export function RevenueStat() {
  const [selectedPeriod, setSelectedPeriod] = useState(items.selectedPeriod);

  const currentData = items[selectedPeriod as keyof typeof items] as PeriodData;
  const { data, total, percentageChange } = currentData;
  const yAxisConfig = getYAxisConfig(selectedPeriod);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Stat</CardTitle>
        <CardAction>
          <Select onValueChange={setSelectedPeriod} value={selectedPeriod}>
            <SelectTrigger>
              <Calendar />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col items-baseline justify-between lg:flex-row">
          <span className="text-2xl font-semibold tracking-tight lg:text-3xl">
            {formatCurrency(total)}
          </span>
          <div className="flex items-center gap-1 text-sm">
            <TrendingUp className="size-4 text-green-600" />
            <span className="text-success font-medium">{percentageChange}%</span>
            <span className="text-muted-foreground">from last month</span>
          </div>
        </div>

        <ChartContainer className="h-[240px] w-full" config={chartConfig}>
          <BarChart data={data} margin={{ top: 20, right: 0, left: -30, bottom: 0 }}>
            <defs>
              <StripePattern />
            </defs>
            <XAxis
              axisLine={false}
              dataKey="day"
              tick={{ fill: 'var(--muted-foreground)' }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              domain={yAxisConfig.domain}
              tick={{ fill: 'var(--muted-foreground)' }}
              tickFormatter={formatYAxisTick}
              tickLine={false}
              ticks={yAxisConfig.ticks}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: name === 'revenue' ? 'hsl(142 71% 45%)' : '#d1d5db',
                        }}
                      />
                      <span className="text-muted-foreground capitalize">
                        {name === 'revenue' ? 'Revenue' : 'Projected'}:
                      </span>
                      <span className="font-medium">{formatCurrency(Number(value))}</span>
                    </div>
                  )}
                  labelFormatter={(value) => `${value} 2026`}
                />
              }
              cursor={false}
            />
            <Bar
              dataKey="revenue"
              fill="var(--color-revenue)"
              radius={[0, 0, 4, 4]}
              stackId="stack"
            />
            <Bar
              dataKey="projected"
              fill="url(#stripePattern)"
              radius={[4, 4, 0, 0]}
              stackId="stack"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
