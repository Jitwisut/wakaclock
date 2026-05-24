import { TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

export function SaleOverviewCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>Sales Overview</CardDescription>
        <div className="font-display mb-6 text-2xl lg:text-3xl">$42.5K</div>
        <CardAction>
          <TrendingUp className="size-4 text-green-600" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 divide-x">
          <div className="flex items-center gap-3 text-sm">
            <Badge className="border-border w-12 border" variant="secondary">
              62.2%
            </Badge>
            <span>Orders</span>
          </div>
          <div className="flex items-center justify-end gap-3 text-sm">
            <Badge className="border-border w-12 border" variant="secondary">
              25.5%
            </Badge>
            <span>Visits</span>
          </div>
        </div>
        <div className="mt-4 flex overflow-hidden rounded-md">
          <span className="h-4 bg-orange-600" style={{ width: '70%' }} />
          <span className="h-4 bg-green-600" style={{ width: '30%' }} />
        </div>
      </CardContent>
    </Card>
  );
}
