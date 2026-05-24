'use client';

import { ArrowUpIcon, CreditCardIcon, TrendingUpIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const incomeData = [
  { category: 'Rental', amount: 35_000, color: 'var(--chart-1)' },
  { category: 'Investments', amount: 28_000, color: 'var(--chart-2)' },
  { category: 'Business', amount: 18_000, color: 'var(--chart-3)' },
  { category: 'Freelance', amount: 11_000, color: 'var(--chart-4)' },
];

export default function Revenue() {
  return (
    <Card className="pb-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Income Sources</CardTitle>
          <Button size="sm" variant="ghost">
            <ArrowUpIcon className="rotate-45" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grow space-y-4 lg:space-y-6">
        <div>
          <div className="text-muted-foreground mb-1 text-sm">Total Income</div>
          <div className="font-display mb-2 text-3xl">$92,000</div>
          <div className="mb-4 flex items-center text-sm text-green-600">
            <TrendingUpIcon className="mr-1 size-4" />
            15.5%
            <span className="text-muted-foreground ml-1">compared to last month</span>
          </div>
        </div>

        <div className="flex h-3 overflow-hidden rounded-full">
          {incomeData.map((item) => (
            <div
              className="h-full"
              key={`bar-${item.category}`}
              style={{
                backgroundColor: item.color,
                width: `${(item.amount / 92_000) * 100}%`,
              }}
            />
          ))}
        </div>

        <div className="space-y-4">
          {incomeData.map((item) => (
            <div
              className="flex items-center justify-between text-sm"
              key={`income-${item.category}`}
            >
              <div className="flex items-center gap-3">
                <div className="size-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{item.category}</span>
              </div>
              <span className="font-medium" suppressHydrationWarning>
                ${item.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="bg-muted py-4">
        <div className="flex items-start">
          <CreditCardIcon className="text-muted-foreground mt-0.5 mr-3 h-5 w-5" />
          <div className="text-muted-foreground text-sm">
            <div className="mb-1 font-medium">Passive income streams growing steadily.</div>
            <div>Automate your rental collection for better efficiency.</div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
