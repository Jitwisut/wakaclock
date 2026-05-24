'use client';

import * as React from 'react';

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';

import { ExportButton } from '@/components/CardActionMenus';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type Order = {
  amount: number;
  customer: {
    image: string;
    name: string;
  };
  id: number;
  product: {
    name: string;
  };
  status: 'failed' | 'paid' | 'processing' | 'success';
};

const orders: Order[] = [
  {
    id: 1023,
    customer: {
      name: 'Theodore Bell',
      image: `/images/avatars/01.png`,
    },
    product: {
      name: 'Tire Doodad',
    },
    amount: 300,
    status: 'processing',
  },
  {
    id: 2045,
    customer: {
      name: 'Amelia Grant',
      image: `/images/avatars/02.png`,
    },
    product: {
      name: 'Engine Kit',
    },
    amount: 450,
    status: 'paid',
  },
  {
    id: 3067,
    customer: {
      name: 'Eleanor Ward',
      image: `/images/avatars/03.png`,
    },
    product: {
      name: 'Brake Pad',
    },
    amount: 200,
    status: 'success',
  },
  {
    id: 4089,
    customer: {
      name: 'Henry Carter',
      image: `/images/avatars/04.png`,
    },
    product: {
      name: 'Fuel Pump',
    },
    amount: 500,
    status: 'processing',
  },
  {
    id: 5102,
    customer: {
      name: 'Olivia Harris',
      image: `/images/avatars/05.png`,
    },
    product: {
      name: 'Steering Wheel',
    },
    amount: 350,
    status: 'failed',
  },
  {
    id: 6123,
    customer: {
      name: 'James Robinson',
      image: `/images/avatars/06.png`,
    },
    product: {
      name: 'Air Filter',
    },
    amount: 180,
    status: 'paid',
  },
  {
    id: 7145,
    customer: {
      name: 'Sophia Martinez',
      image: `/images/avatars/07.png`,
    },
    product: {
      name: 'Oil Filter',
    },
    amount: 220,
    status: 'success',
  },
  {
    id: 8167,
    customer: {
      name: 'Liam Thompson',
      image: `/images/avatars/08.png`,
    },
    product: {
      name: 'Radiator Cap',
    },
    amount: 290,
    status: 'processing',
  },
  {
    id: 9189,
    customer: {
      name: 'Emma Wilson',
      image: `/images/avatars/09.png`,
    },
    product: {
      name: 'Spark Plug',
    },
    amount: 150,
    status: 'success',
  },
  {
    id: 10_211,
    customer: {
      name: 'Noah Davis',
      image: `/images/avatars/10.png`,
    },
    product: {
      name: 'Transmission Fluid',
    },
    amount: 120,
    status: 'paid',
  },
  {
    id: 11_233,
    customer: {
      name: 'Ava Johnson',
      image: `/images/avatars/01.png`,
    },
    product: {
      name: 'Battery Terminal',
    },
    amount: 85,
    status: 'processing',
  },
  {
    id: 12_255,
    customer: {
      name: 'William Brown',
      image: `/images/avatars/02.png`,
    },
    product: {
      name: 'Alternator',
    },
    amount: 420,
    status: 'failed',
  },
  {
    id: 13_277,
    customer: {
      name: 'Charlotte Miller',
      image: `/images/avatars/03.png`,
    },
    product: {
      name: 'Timing Belt',
    },
    amount: 380,
    status: 'success',
  },
  {
    id: 14_299,
    customer: {
      name: 'Benjamin Taylor',
      image: `/images/avatars/04.png`,
    },
    product: {
      name: 'Shock Absorber',
    },
    amount: 550,
    status: 'processing',
  },
  {
    id: 15_321,
    customer: {
      name: 'Mia Anderson',
      image: `/images/avatars/05.png`,
    },
    product: {
      name: 'Windshield Wiper',
    },
    amount: 95,
    status: 'paid',
  },
  {
    id: 16_343,
    customer: {
      name: 'Elijah Thomas',
      image: `/images/avatars/06.png`,
    },
    product: {
      name: 'Headlight Assembly',
    },
    amount: 320,
    status: 'success',
  },
];

const columns: ColumnDef<Order>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => (
      <Button className="text-muted-foreground hover:text-primary h-auto p-0" variant="link">
        <Link href="#">#{row.getValue('id')}</Link>
      </Button>
    ),
  },
  {
    accessorKey: 'customer',
    header: 'Customer',
    cell: ({ row }) => (
      <div className="flex items-center gap-4">
        <Avatar>
          <AvatarImage src={row.original.customer.image} />
        </Avatar>
        <div className="capitalize">{row.original.customer.name}</div>
      </div>
    ),
    filterFn: (row, _columnId, filterValue) =>
      row.original.customer.name.toLowerCase().includes(filterValue.toLowerCase()),
  },
  {
    accessorKey: 'product',
    header: 'Product',
    cell: ({ row }) => <div className="capitalize">{row.original.product.name}</div>,
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <Button
        className="p-0! hover:bg-transparent!"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Amount
        <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const amount = Number.parseFloat(row.getValue('amount'));

      // Format the amount as a dollar amount
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);

      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const { status } = row.original;

      const statusMap = {
        success: 'success',
        processing: 'info',
        paid: 'warning',
        failed: 'destructive',
      } as const;

      const statusClass = statusMap[status] ?? 'default';

      return (
        <Badge className="capitalize" variant={statusClass}>
          {status.replace('-', ' ')}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const order = row.original;

      return (
        <div className="text-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-8 w-8 p-0" variant="ghost">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(String(order.id))}>
                Copy order ID
              </DropdownMenuItem>
              <DropdownMenuItem>View customer</DropdownMenuItem>
              <DropdownMenuItem>View payment details</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export function EcommerceRecentOrdersCard() {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [{ pageIndex, pageSize }, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 8,
  });

  const pagination = React.useMemo(
    () => ({
      pageIndex,
      pageSize,
    }),
    [pageIndex, pageSize]
  );

  const table = useReactTable({
    data: orders,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    pageCount: Math.ceil(orders.length / pageSize),
  });

  return (
    <Card className="lg:col-span-7">
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
        <CardAction className="relative">
          <ExportButton className="absolute end-0 top-0" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          className="max-w-xs"
          onChange={(event) => table.getColumn('customer')?.setFilterValue(event.target.value)}
          placeholder="Filter orders..."
          value={(table.getColumn('customer')?.getFilterValue() as string) ?? ''}
        />
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
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Showing {pageIndex * pageSize + 1} to{' '}
            {Math.min((pageIndex + 1) * pageSize, orders.length)} of {orders.length} entries
          </p>
          <div className="space-x-2">
            <Button
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              size="sm"
              variant="outline"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              size="sm"
              variant="outline"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
