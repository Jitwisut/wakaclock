'use client';

import { useState } from 'react';

import { CalendarIcon, Download } from 'lucide-react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const data: Record<
  string,
  {
    booked: number;
    chartData: { booked: number; date: string; visited: number }[];
    performanceChange: number;
    visited: number;
  }
> = {
  'this-week': {
    booked: 290,
    visited: 638,
    performanceChange: 12,
    chartData: [
      { date: '25-Nov', visited: 45, booked: 30 },
      { date: '26-Nov', visited: 20, booked: 10 },
      { date: '27-Nov', visited: 60, booked: 25 },
      { date: '28-Nov', visited: 95, booked: 60 },
      { date: '29-Nov', visited: 140, booked: 110 },
      { date: '30-Nov', visited: 10, booked: 45 },
      { date: '01-Dec', visited: 110, booked: 90 },
    ],
  },
  'last-week': {
    booked: 245,
    visited: 520,
    performanceChange: 8,
    chartData: [
      { date: '18-Nov', visited: 35, booked: 25 },
      { date: '19-Nov', visited: 50, booked: 35 },
      { date: '20-Nov', visited: 80, booked: 45 },
      { date: '21-Nov', visited: 70, booked: 50 },
      { date: '22-Nov', visited: 100, booked: 70 },
      { date: '23-Nov', visited: 85, booked: 55 },
      { date: '24-Nov', visited: 100, booked: 65 },
    ],
  },
  'this-month': {
    booked: 850,
    visited: 1920,
    performanceChange: 15,
    chartData: [
      { date: '1-Nov', visited: 180, booked: 120 },
      { date: '8-Nov', visited: 220, booked: 150 },
      { date: '15-Nov', visited: 280, booked: 190 },
      { date: '22-Nov', visited: 320, booked: 210 },
      { date: '29-Nov', visited: 290, booked: 180 },
    ],
  },
  'last-month': {
    booked: 780,
    visited: 1750,
    performanceChange: 10,
    chartData: [
      { date: '1-Oct', visited: 150, booked: 100 },
      { date: '8-Oct', visited: 200, booked: 130 },
      { date: '15-Oct', visited: 250, booked: 170 },
      { date: '22-Oct', visited: 300, booked: 200 },
      { date: '29-Oct', visited: 280, booked: 180 },
    ],
  },
  'last-3-months': {
    booked: 2100,
    visited: 4800,
    performanceChange: 22,
    chartData: [
      { date: 'Sep', visited: 1400, booked: 600 },
      { date: 'Oct', visited: 1600, booked: 700 },
      { date: 'Nov', visited: 1800, booked: 800 },
    ],
  },
};

const chartConfig = {
  visited: {
    label: 'Visited',
    color: 'var(--chart-1)',
  },
  booked: {
    label: 'Booked',
    color: 'var(--chart-4)',
  },
};

export function CampaignOverview() {
  const [dateRange, setDateRange] = useState('this-week');
  const campaignData = data[dateRange];

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Overview</CardTitle>
        <CardAction className="flex gap-2">
          <Select onValueChange={handleDateRangeChange} value={dateRange}>
            <SelectTrigger>
              <CalendarIcon />
              <div className="hidden lg:flex">
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="last-week">Last Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="last-3-months">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" variant="outline">
            <Download />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid items-end gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="order-2 grid grid-cols-2 divide-x rounded-lg border lg:order-1">
            <div className="space-y-1 p-4">
              <p className="text-muted-foreground text-sm">Booked</p>
              <p className="text-xl font-semibold lg:text-2xl">{campaignData.booked}</p>
            </div>
            <div className="space-y-1 p-4">
              <p className="text-muted-foreground text-sm">Visited</p>
              <p className="text-xl font-semibold lg:text-2xl">{campaignData.visited}</p>
            </div>
          </div>
          <div className="order-1 space-y-1 lg:order-2 lg:text-end">
            <p>Performance</p>
            <p className="text-sm">
              <span className="text-green-500">{campaignData.performanceChange}+</span>
              <span className="text-muted-foreground ml-1">Compared to last week</span>
            </p>
          </div>
        </div>

        <ChartContainer className="aspect-video w-full md:h-[180px]" config={chartConfig}>
          <LineChart
            data={campaignData.chartData}
            margin={{ top: 20, right: 20, bottom: 20, left: -15 }}
          >
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="date"
              dy={10}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              domain={[0, 200]}
              dx={-10}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickLine={false}
              ticks={[0, 50, 100, 150, 200]}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="visited" dot={false} stroke="var(--color-visited)" type="monotone" />
            <Line dataKey="booked" dot={false} stroke="var(--color-booked)" type="monotone" />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
