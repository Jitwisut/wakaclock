import { WalletMinimal } from 'lucide-react';

import { Card, CardAction, CardDescription, CardHeader } from '@/components/ui/card';

export function TotalRevenueCard() {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Total Revenue</CardDescription>
        <div className="flex flex-col gap-2">
          <h4 className="font-display text-2xl lg:text-3xl">$435,578</h4>
          <div className="text-muted-foreground text-sm">
            <span className="text-green-600">+20.1%</span> from last month
          </div>
        </div>
        <CardAction>
          <div className="flex gap-4">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full border">
              <WalletMinimal className="size-5" />
            </div>
          </div>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
