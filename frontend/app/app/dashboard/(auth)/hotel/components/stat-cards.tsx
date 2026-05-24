import { Clock, CreditCard, DollarSign, LogOut, MoreVertical, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const items = [
  {
    title: "Today's check-in",
    value: '200',
    unitNumber: '1,000',
    color: 'cyan' as const,
    icon: 'checkin' as const,
  },
  {
    title: 'Today check-out',
    value: '34',
    unitNumber: '520',
    color: 'green' as const,
    icon: 'checkout' as const,
  },
  {
    title: 'Total guests',
    value: '3432',
    unitNumber: '152',
    color: 'pink' as const,
    icon: 'guests' as const,
  },
  {
    title: 'Total amount',
    value: '$668,726',
    unitNumber: '266',
    color: 'yellow' as const,
    icon: 'amount' as const,
  },
];

const colorClasses = {
  cyan: {
    card: 'bg-linear-to-tr from-cyan-200/40 to-cyan-100/40 dark:from-cyan-950/40 dark:to-cyan-900/40',
    text: 'text-cyan-900 dark:text-cyan-500',
    icon: 'bg-cyan-800',
  },
  green: {
    card: 'bg-linear-to-tr from-green-200/40 to-green-100/40  dark:from-green-950/40 dark:to-green-900/40',
    text: 'text-green-900 dark:text-green-500',
    icon: 'bg-green-800',
  },
  pink: {
    card: 'bg-linear-to-tr from-pink-200/40 to-pink-100/40  dark:from-pink-950/40 dark:to-pink-900/40',
    text: 'text-pink-900 dark:text-pink-500',
    icon: 'bg-pink-800',
  },
  yellow: {
    card: 'bg-linear-to-tr from-yellow-200/40 to-yellow-100/40  dark:from-yellow-950/40 dark:to-yellow-900/40',
    text: 'text-yellow-900 dark:text-yellow-500',
    icon: 'bg-yellow-800',
  },
};

const iconMap = {
  checkin: Clock,
  checkout: LogOut,
  guests: Users,
  amount: DollarSign,
  loans: CreditCard,
};

export function StatCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const IconComponent = iconMap[item.icon];
        return (
          <Card
            className={`${colorClasses[item.color].card} border-0 shadow-none`}
            key={`stat-${item.title}`}
          >
            <CardContent className="space-y-1">
              <div className="mb-4 flex items-start justify-between">
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-xl lg:size-10',
                    colorClasses[item.color].icon
                  )}
                >
                  <IconComponent className="size-4 text-white/90 lg:size-5" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="h-8 w-8" size="icon" variant="ghost">
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View Details</DropdownMenuItem>
                    <DropdownMenuItem>Export</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="text-muted-foreground text-sm">{item.title}</p>
              <p
                className={cn('text-2xl font-semibold lg:text-3xl', colorClasses[item.color].text)}
              >
                {item.value}
              </p>
              <p className="text-muted-foreground text-sm">Unit Number: {item.unitNumber}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
