'use client';

import { BookOpenIcon, Car, CoffeeIcon, StoreIcon } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const transactions = [
  {
    id: 1,
    description: 'Samantha William',
    date: '30 April 2024, 10:15 AM',
    type: 'Income',
    amount: 1640.26,
    icon: 'S',
    color: 'bg-pink-500',
  },
  {
    id: 2,
    description: 'Grocery at Shop',
    date: '29 April 2024, 6:45 PM',
    type: 'Expenses',
    amount: -72.64,
    icon: <StoreIcon className="h-4 w-4" />,
    color: 'bg-emerald-500',
  },
  {
    id: 3,
    description: 'Coffee',
    date: '21 April 2024, 8:30 AM',
    type: 'Expenses',
    amount: -8.65,
    icon: <CoffeeIcon className="h-4 w-4" />,
    color: 'bg-amber-500',
  },
  {
    id: 4,
    description: 'Karen Smith',
    date: '10 April 2024, 3:50 PM',
    type: 'Income',
    amount: 842.5,
    icon: 'K',
    color: 'bg-purple-500',
  },
  {
    id: 5,
    description: 'Transportation',
    date: '2 April 2024, 5:20 PM',
    type: 'Expenses',
    amount: -18.52,
    icon: <Car className="h-4 w-4" />,
    color: 'bg-red-500',
  },
  {
    id: 6,
    description: 'Online Course Purchase',
    date: '12 March 2024, 2:10 PM',
    type: 'Expenses',
    amount: -120,
    icon: <BookOpenIcon className="h-4 w-4" />,
    color: 'bg-blue-500',
  },
  {
    id: 7,
    description: 'Freelance Project Payment',
    date: '5 March 2024, 11:00 AM',
    type: 'Income',
    amount: 980.75,
    icon: 'F',
    color: 'bg-green-600',
  },
];

export default function Transactions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline">
            View All
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Transaction</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-end">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className={cn('text-white', transaction.color)}>
                        {transaction.icon}
                      </AvatarFallback>
                    </Avatar>
                    {transaction.description}
                  </div>
                </TableCell>
                <TableCell>{transaction.date}</TableCell>
                <TableCell>
                  <Badge variant="outline">{transaction.type}</Badge>
                </TableCell>
                <TableCell
                  className={`text-end ${transaction.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {transaction.amount > 0 ? '' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
