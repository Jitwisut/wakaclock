import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const transactions = [
  {
    id: 1,
    date: '16 Aug 2025',
    description: 'Withdrawal to JP Morgan Chase (0440)',
    status: 'Completed',
    amount: '-1,275.79 USD',
    type: 'withdrawal',
  },
  {
    id: 2,
    date: '5 Aug 2025',
    description: 'Withdrawal to Citibank (2290)',
    status: 'Completed',
    amount: '-202.99 USD',
    type: 'withdrawal',
  },
  {
    id: 3,
    date: '5 Aug 2025',
    description: 'Withdrawal to Bank of America (3311)',
    status: 'Completed',
    amount: '-1,272.30 USD',
    type: 'withdrawal',
  },
  {
    id: 4,
    date: '4 Aug 2025',
    description: 'Payment from Paddle',
    status: 'Completed',
    amount: '+5,651.56 USD',
    type: 'payment',
  },
  {
    id: 5,
    date: '4 Aug 2025',
    description: 'Withdrawal to HSBC (5522)',
    status: 'Completed',
    amount: '-1,679.35 USD',
    type: 'withdrawal',
  },
  {
    id: 6,
    date: '20 Aug 2025',
    description: 'Withdrawal to JP Morgan Chase (1133)',
    status: 'Completed',
    amount: '-3,420.00 USD',
    type: 'withdrawal',
  },
  {
    id: 7,
    date: '18 Aug 2025',
    description: 'Payment from Stripe',
    status: 'Completed',
    amount: '+2,345.75 USD',
    type: 'payment',
  },
];

export function TransactionHistory() {
  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
        <CardDescription>Updated every several minutes</CardDescription>
        <CardAction>
          <Button asChild variant="ghost">
            <Link href="/dashboard/payment/transactions">
              View all
              <ChevronRightIcon />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs className="gap-0!" defaultValue="latest">
          <TabsList className="h-auto rounded-none bg-transparent p-0 ps-6">
            <TabsTrigger
              className="data-[state=active]:after:bg-primary relative rounded-none py-2 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              value="latest"
            >
              Latest
            </TabsTrigger>
            <TabsTrigger
              className="data-[state=active]:after:bg-primary relative rounded-none py-2 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              value="upcoming"
            >
              Upcoming
            </TabsTrigger>
          </TabsList>
          <Separator className="-mt-0.5" />
          <TabsContent value="latest">
            <div className="space-y-0">
              <Table>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="w-36 ps-6">{transaction.date}</TableCell>
                      <TableCell>
                        <div>
                          <div className="text-foreground font-medium">
                            {transaction.description}
                          </div>
                          <div className="text-muted-foreground text-sm">{transaction.status}</div>
                        </div>
                      </TableCell>
                      <TableCell className="pe-6">
                        <div className="flex items-center justify-end space-x-4">
                          <span
                            className={cn({
                              'text-green-600': transaction.type === 'payment',
                              'text-red-400': transaction.type === 'withdrawal',
                            })}
                          >
                            {transaction.amount}
                          </span>
                          <Button size="sm" variant="outline">
                            <ChevronRightIcon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="upcoming">
            <p className="text-muted-foreground px-4 py-4 text-center text-sm lg:py-10">
              Nothing to see here right now.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
