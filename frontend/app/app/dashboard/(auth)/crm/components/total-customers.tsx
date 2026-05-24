import { Users2Icon } from 'lucide-react';

import { Card, CardAction, CardDescription, CardHeader } from '@/components/ui/card';

export function TotalCustomersCard() {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Total Customers</CardDescription>
        <div className="flex flex-col gap-2">
          <h4 className="font-display text-2xl lg:text-3xl">1890</h4>
          <div className="text-muted-foreground text-sm">
            <span className="text-green-600">+10.4%</span> from last month
          </div>
        </div>
        <CardAction>
          <div className="flex gap-4">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full border">
              <Users2Icon className="size-5" />
            </div>
          </div>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
