'use client';

import * as React from 'react';

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpIcon, ChevronDown } from 'lucide-react';

import { ExportButton } from '@/components/CardActionMenus';
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';

type OrderStatus = 'completed' | 'in-progress' | 'new-order' | 'on-hold' | 'return';

type Order = {
  amount: number;
  customerName: string;
  id: string;
  items: number;
  paymentMethod: string;
  status: OrderStatus;
};

const BANK_TRANSFER = 'Bank Transfer';
const STATUS_NEW_ORDER: OrderStatus = 'new-order';
const STATUS_IN_PROGRESS: OrderStatus = 'in-progress';

const data: Order[] = [
  {
    id: '1083',
    customerName: 'Marvin Dekidis',
    items: 2,
    amount: 34.5,
    paymentMethod: 'E-Wallet',
    status: STATUS_NEW_ORDER,
  },
  {
    id: '1082',
    customerName: 'Carter Lipshitz',
    items: 6,
    amount: 60.5,
    paymentMethod: BANK_TRANSFER,
    status: STATUS_IN_PROGRESS,
  },
  {
    id: '1081',
    customerName: 'Addison Philips',
    items: 3,
    amount: 47.5,
    paymentMethod: 'E-Wallet',
    status: STATUS_NEW_ORDER,
  },
  {
    id: '1079',
    customerName: 'Craig Siphron',
    items: 15,
    amount: 89.8,
    paymentMethod: BANK_TRANSFER,
    status: 'on-hold',
  },
  {
    id: '1078',
    customerName: 'Emma Johnson',
    items: 4,
    amount: 120.75,
    paymentMethod: 'Credit Card',
    status: 'completed',
  },
  {
    id: '1077',
    customerName: 'Michael Smith',
    items: 8,
    amount: 210.5,
    paymentMethod: 'PayPal',
    status: 'completed',
  },
  {
    id: '1076',
    customerName: 'Sarah Williams',
    items: 1,
    amount: 25.99,
    paymentMethod: 'E-Wallet',
    status: STATUS_IN_PROGRESS,
  },
  {
    id: '1075',
    customerName: 'James Brown',
    items: 3,
    amount: 78.45,
    paymentMethod: BANK_TRANSFER,
    status: 'return',
  },
  {
    id: '1074',
    customerName: 'David Miller',
    items: 5,
    amount: 145.2,
    paymentMethod: 'Credit Card',
    status: STATUS_NEW_ORDER,
  },
  {
    id: '1073',
    customerName: 'Jennifer Davis',
    items: 2,
    amount: 67.8,
    paymentMethod: 'PayPal',
    status: STATUS_IN_PROGRESS,
  },
  {
    id: '1072',
    customerName: 'Robert Wilson',
    items: 7,
    amount: 198.35,
    paymentMethod: BANK_TRANSFER,
    status: 'completed',
  },
  {
    id: '1071',
    customerName: 'Lisa Anderson',
    items: 4,
    amount: 112.9,
    paymentMethod: 'E-Wallet',
    status: 'on-hold',
  },
  {
    id: '1070',
    customerName: 'Thomas Taylor',
    items: 9,
    amount: 245.75,
    paymentMethod: 'Credit Card',
    status: STATUS_NEW_ORDER,
  },
  {
    id: '1069',
    customerName: 'Patricia Moore',
    items: 3,
    amount: 87.6,
    paymentMethod: BANK_TRANSFER,
    status: 'return',
  },
  {
    id: '1068',
    customerName: 'Christopher White',
    items: 6,
    amount: 156.4,
    paymentMethod: 'PayPal',
    status: 'completed',
  },
  {
    id: '1067',
    customerName: 'Elizabeth Harris',
    items: 2,
    amount: 54.25,
    paymentMethod: 'E-Wallet',
    status: STATUS_IN_PROGRESS,
  },
];

const columns: ColumnDef<Order>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    size: 80,
  },
  {
    accessorKey: 'customerName',
    header: 'Customer Name',
  },
  {
    accessorKey: 'items',
    header: 'Qty Items',
    cell: ({ row }) => `${row.getValue('items')} Items`,
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => `$${row.getValue('amount')}`,
  },
  {
    accessorKey: 'paymentMethod',
    header: 'Payment Method',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const { status } = row.original;

      const statusMap = {
        completed: 'success',
        'new-order': 'info',
        'in-progress': 'warning',
        'on-hold': 'warning',
        return: 'destructive',
      } as const;

      const statusClass = statusMap[status] ?? 'default';

      return (
        <Badge className="capitalize" variant={statusClass}>
          {status.replace('-', ' ')}
        </Badge>
      );
    },
  },
];

export function TableOrderStatus() {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 6,
      },
    },
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Track Order Status</CardTitle>
        <CardDescription>Analyze growth and changes in visitor patterns</CardDescription>
        <CardAction>
          <ExportButton />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <div className="font-display text-2xl lg:text-3xl">43</div>
            <div className="flex gap-2">
              <div className="text-muted-foreground text-sm">New Order</div>
              <div className="flex items-center gap-0.5 text-xs text-green-500">
                <ArrowUpIcon className="size-3" />
                0.5%
              </div>
            </div>
            <Progress
              className="h-2 bg-blue-100 dark:bg-blue-950"
              indicatorColor="bg-blue-400"
              value={43}
            />
          </div>
          <div className="space-y-2">
            <div className="font-display text-2xl lg:text-3xl">12</div>
            <div className="flex gap-2">
              <div className="text-muted-foreground text-sm">On Progress</div>
              <div className="flex items-center gap-0.5 text-xs text-red-500">
                <ArrowDownIcon className="size-3" />
                0.3%
              </div>
            </div>
            <Progress
              className="h-2 bg-teal-100 dark:bg-teal-950"
              indicatorColor="bg-teal-400"
              value={25}
            />
          </div>
          <div className="space-y-2">
            <div className="font-display text-2xl lg:text-3xl">40</div>
            <div className="flex gap-2">
              <div className="text-muted-foreground text-sm">Completed</div>
              <div className="flex items-center gap-0.5 text-xs text-green-500">
                <ArrowUpIcon className="size-3" />
                0.5%
              </div>
            </div>
            <Progress
              className="h-2 bg-green-100 dark:bg-green-950"
              indicatorColor="bg-green-400"
              value={40}
            />
          </div>
          <div className="space-y-2">
            <div className="font-display text-2xl lg:text-3xl">2</div>
            <div className="flex gap-2">
              <div className="text-muted-foreground text-sm">Return</div>
              <div className="flex items-center gap-0.5 text-xs text-red-500">
                <ArrowDownIcon className="size-3" />
                0.5%
              </div>
            </div>
            <Progress
              className="h-2 bg-orange-100 dark:bg-orange-950"
              indicatorColor="bg-orange-400"
              value={48}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              className="max-w-sm"
              onChange={(event) =>
                table.getColumn('customerName')?.setFilterValue(event.target.value)
              }
              placeholder="Filter orders..."
              value={(table.getColumn('customerName')?.getFilterValue() as string) ?? ''}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="ml-auto" variant="outline">
                  Columns <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      checked={column.getIsVisible()}
                      className="capitalize"
                      key={column.id}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow data-state={row.getIsSelected() && 'selected'} key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="h-24 text-center" colSpan={columns.length}>
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2">
            <div className="text-muted-foreground flex-1 text-sm">
              {table.getFilteredSelectedRowModel().rows.length} of{' '}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <div className="space-x-2">
              <Button
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
                size="sm"
                variant="outline"
              >
                Previous
              </Button>
              <Button
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
                size="sm"
                variant="outline"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
