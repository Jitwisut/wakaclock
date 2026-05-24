'use client';

import { Edit2, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type TransactionStatus = 'failed' | 'paid' | 'pending';

interface Transaction {
  amount: string;
  date: string;
  id: string;
  product: string;
  status: TransactionStatus;
}

const transactions: Transaction[] = [
  {
    id: '#36223',
    product: 'Mock premium pack',
    status: 'pending',
    date: '12/10/2025',
    amount: '$39.90',
  },
  {
    id: '#34283',
    product: 'Enterprise plan subscription',
    status: 'paid',
    date: '11/13/2025',
    amount: '$159.90',
  },
  {
    id: '#32234',
    product: 'Business board pro license',
    status: 'paid',
    date: '10/13/2025',
    amount: '$89.90',
  },
  {
    id: '#31354',
    product: 'Custom integration package',
    status: 'failed',
    date: '09/13/2025',
    amount: '$299.90',
  },
  {
    id: '#30254',
    product: 'Developer toolkit license',
    status: 'paid',
    date: '08/15/2025',
    amount: '$129.90',
  },
  {
    id: '#29876',
    product: 'Support package renewal',
    status: 'pending',
    date: '07/22/2025',
    amount: '$79.90',
  },
];

export default function Page() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>
            Billing monthly | Next payment on 02/09/2025 for{' '}
            <span className="font-medium">$59.90</span>
          </CardDescription>
          <CardAction>
            <Button>Change plan</Button>
          </CardAction>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="font-medium">Carolyn Perkins •••• 0392</div>
                <Badge variant="info">Primary</Badge>
              </div>
              <p className="text-muted-foreground text-sm">Expired Dec 2025</p>
            </div>
            <Button size="icon" variant="outline">
              <Edit2 />
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-2">
              <div className="font-medium">Carolyn Perkins •••• 8461</div>
              <p className="text-muted-foreground text-sm">Expired Jun 2025</p>
            </div>
            <Button size="icon" variant="outline">
              <Edit2 />
            </Button>
          </div>

          <Button className="w-full" variant="outline">
            <Plus />
            Add payment method
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => {
                const statusMap = {
                  pending: 'warning',
                  failed: 'destructive',
                  paid: 'success',
                } as const;

                const statusClass = statusMap[transaction.status] ?? 'secondary';

                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.id}</TableCell>
                    <TableCell>{transaction.product}</TableCell>
                    <TableCell>
                      <Badge variant={statusClass}>{transaction.status}</Badge>
                    </TableCell>
                    <TableCell>{transaction.date}</TableCell>
                    <TableCell className="text-right font-medium">{transaction.amount}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
