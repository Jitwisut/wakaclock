'use client';

import { ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const data = [
  {
    name: 'Monthly recurring revenue',
    value: '$34.1K',
    change: '+6.1%',
    changeType: 'positive',
    href: '#',
  },
  {
    name: 'Users',
    value: '500.1K',
    change: '+19.2%',
    changeType: 'positive',
    href: '#',
  },
  {
    name: 'User growth',
    value: '11.3%',
    change: '-1.2%',
    changeType: 'negative',
    href: '#',
  },
];

export default function StatCards() {
  return (
    <div className="flex w-full items-center justify-center">
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
        {data.map((item) => (
          <Card className="py-0" key={item.name}>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start justify-between space-x-2">
                <span className="text-muted-foreground truncate text-sm">{item.name}</span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    item.changeType === 'positive'
                      ? 'text-emerald-700 dark:text-emerald-500'
                      : 'text-red-700 dark:text-red-500'
                  )}
                >
                  {item.change}
                </span>
              </div>
              <dd className="text-foreground mt-1 text-3xl font-semibold">{item.value}</dd>
            </CardContent>
            <CardFooter className="border-border flex justify-end border-t p-0!">
              <Link
                className="text-primary hover:text-primary/90 flex items-center px-6 py-3 text-sm font-medium"
                href="#"
              >
                View more <ArrowRightIcon className="ms-2 size-4" />
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
