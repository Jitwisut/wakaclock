import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const activities = [
  {
    type: 'Buy',
    name: 'Bitcoin',
    icon: `/images/crypto-icons/bitcoin.svg`,
    short_name: 'BTC',
    date: 'Nov 12, 2024 11:34 PM',
    amount: 0.5384,
    valueUSD: 3980.93,
  },
  {
    type: 'Buy',
    name: 'Ethereum',
    icon: `/images/crypto-icons/ethereum.svg`,
    short_name: 'ETH',
    date: 'Nov 28, 2024 11:34 PM',
    amount: 0.5384,
    valueUSD: 3980.93,
  },
  {
    type: 'Sell',
    name: 'Dogecoin',
    icon: `/images/crypto-icons/bitcoin.svg`,
    short_name: 'DOGE',
    date: 'Nov 10, 2024 11:34 PM',
    amount: 0.5384,
    valueUSD: 3980.93,
  },
  {
    type: 'Buy',
    name: 'Tether',
    icon: `/images/crypto-icons/bitcoin.svg`,
    symbol: 'USDT',
    date: 'Nov 12, 2024 11:34 PM',
    amount: 0.5384,
    valueUSD: 3980.93,
  },
  {
    type: 'Sell',
    name: 'Toncoin',
    icon: `/images/crypto-icons/toncoin.svg`,
    short_name: 'TON',
    date: 'Sept 04, 2024 11:34 PM',
    amount: 0.5384,
    valueUSD: 3980.93,
  },
  {
    type: 'Send',
    name: 'Avalanche',
    icon: `/images/crypto-icons/avalanche.svg`,
    short_name: 'AVAX',
    date: 'Nov 12, 2019 11:34 PM',
    amount: 0.5384,
    valueUSD: 3980.93,
  },
];

export function RecentActivities() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Activities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-6">
          {activities.map((activity) => (
            <div className="flex items-center" key={`${activity.name}-${activity.date}`}>
              <Image
                alt="shadcn/ui"
                className="bg-muted size-12 rounded-full border p-2"
                height={40}
                src={activity.icon}
                unoptimized
                width={40}
              />
              <div className="ml-4 space-y-1">
                <p className="flex items-center gap-2 text-sm leading-none font-medium">
                  {activity.name}
                  <Badge
                    className={cn('border', {
                      'border-green-400 bg-green-100 text-green-900 dark:border-green-700 dark:bg-green-900 dark:text-white':
                        activity.type === 'Send',
                      'border-orange-400 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-900 dark:text-white':
                        activity.type === 'Buy',
                      'border-blue-400 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-900 dark:text-white':
                        activity.type === 'Sell',
                    })}
                  >
                    {activity.type}
                  </Badge>
                </p>
                <p className="text-muted-foreground text-sm">{activity.date}</p>
              </div>
              <div className="ml-auto flex flex-col text-end">
                <span>{activity.amount} BTC</span>
                <span className="text-muted-foreground text-sm">{activity.valueUSD} USD</span>
              </div>
            </div>
          ))}
        </div>
        <Button className="w-full" variant="outline">
          <Link href="#">View All</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
