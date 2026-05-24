import { ArrowUpIcon } from 'lucide-react';

import { Card, CardDescription, CardHeader } from '@/components/ui/card';

export function BalanceCard() {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardDescription>Total Balance</CardDescription>
        <div className="font-display text-2xl lg:text-3xl">$103,045</div>
        <div className="flex items-center text-xs">
          <ArrowUpIcon className="mr-1 size-3 text-green-500" />
          <span className="font-medium text-green-500">3.6%</span>
          <span className="text-muted-foreground ml-1">Compare from last month</span>
        </div>
      </CardHeader>
    </Card>
  );
}
