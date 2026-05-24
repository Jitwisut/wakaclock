import { ArrowUpRight, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function OverviewCard() {
  return (
    <Card className="from-chart-1/40 to-chart-2/60 h-full gap-2 space-y-0 overflow-hidden border-0 bg-gradient-to-r py-0">
      <CardHeader className="pt-6 pb-0">
        <h2 className="text-2xl font-bold">Overview</h2>
      </CardHeader>
      <CardContent className="p-4">
        <div className="bg-background space-y-6 rounded-lg p-4">
          <div className="flex justify-between">
            <div className="space-y-1">
              <h3 className="text-4xl font-semibold">150</h3>
              <p className="text-muted-foreground">Transactions</p>
            </div>
            <div className="bg-muted flex flex-col items-center justify-center rounded-xl p-3">
              <h3 className="text-3xl font-semibold">3</h3>
              <p className="text-muted-foreground">Wallets</p>
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="font-display text-3xl lg:text-4xl">$46,200</h3>
            <p className="text-muted-foreground">Current balance</p>
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold">4,620,910</span>
              <span className="text-muted-foreground">USDT</span>
              <Badge className="bg-green-100 text-green-600 dark:bg-green-900">
                <ArrowUpRight className="mr-0.5 size-3" />
                12%
              </Badge>
            </div>
            <Button>
              Buy
              <ChevronRight />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
