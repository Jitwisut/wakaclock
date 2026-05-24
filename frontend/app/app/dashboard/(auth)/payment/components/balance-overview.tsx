import { ChevronRight } from 'lucide-react';

import { NotificationBanner } from '@/app/dashboard/(auth)/payment/components/notification-banner';
import { Card, CardContent } from '@/components/ui/card';

const balances = [
  { currency: 'USD', amount: '1,240.30', flag: '🇺🇸' },
  { currency: 'EUR', amount: '500.00', flag: '🇪🇺' },
  { currency: 'GBP', amount: '0.00', flag: '🇬🇧' },
];

export function BalanceOverview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Balances</h1>
          <div className="text-muted-foreground flex items-center space-x-2 text-sm">
            Total funds in all balances: 1.740,30 USD
          </div>
        </div>
      </div>

      <NotificationBanner />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {balances.map((balance) => (
          <Card className="cursor-pointer transition-shadow hover:shadow-md" key={balance.currency}>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{balance.flag}</span>
                  <div>
                    <div className="text-foreground text-2xl font-bold">
                      {balance.amount} {balance.currency}
                    </div>
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
