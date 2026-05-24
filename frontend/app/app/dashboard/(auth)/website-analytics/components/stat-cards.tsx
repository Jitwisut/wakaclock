'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const data = [
  {
    name: 'Daily active users',
    stat: '3,450',
    change: '+12.1%',
    changeType: 'positive',
  },
  {
    name: 'Weekly sessions',
    stat: '1,342',
    change: '-9.8%',
    changeType: 'negative',
  },
  {
    name: 'Duration',
    stat: '5.2min',
    change: '+7.7%',
    changeType: 'positive',
  },
  {
    name: 'Conversion Rate',
    stat: '2.8%',
    change: '+4.3%',
    changeType: 'positive',
  },
];

export default function StatCards() {
  return (
    <div className="flex w-full items-center justify-center">
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.map((item) => (
          <Card className="w-full p-6 py-4" key={item.name}>
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground text-sm font-medium">{item.name}</dt>
                <Badge
                  className={cn(
                    'inline-flex items-center px-1.5 py-0.5 ps-2.5 text-xs font-medium',
                    item.changeType === 'positive'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  )}
                  variant="outline"
                >
                  {item.changeType === 'positive' ? (
                    <TrendingUp className="mr-0.5 -ml-1 h-5 w-5 shrink-0 self-center text-green-500" />
                  ) : (
                    <TrendingDown className="mr-0.5 -ml-1 h-5 w-5 shrink-0 self-center text-red-500" />
                  )}
                  <span className="sr-only">
                    {' '}
                    {item.changeType === 'positive' ? 'Increased' : 'Decreased'} by{' '}
                  </span>
                  {item.change}
                </Badge>
              </div>
              <dd className="text-foreground mt-2 text-3xl font-semibold">{item.stat}</dd>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
