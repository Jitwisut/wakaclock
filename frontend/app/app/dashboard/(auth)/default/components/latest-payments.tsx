'use client';

import * as React from 'react';

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type RowSelectionState,
  useReactTable,
} from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  MoreHorizontal,
  Tag,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

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
import { Checkbox } from '@/components/ui/checkbox';
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

interface Payment {
  amount: number;
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  status: 'failed' | 'processing' | 'success';
}

export function LatestPayments() {
  const data = React.useMemo<Payment[]>(
    () => [
      {
        id: '1',
        status: 'success',
        email: 'ken99@yahoo.com',
        firstName: 'Kenneth',
        lastName: 'Thompson',
        amount: 316,
      },
      {
        id: '2',
        status: 'success',
        email: 'abe45@gmail.com',
        firstName: 'Abraham',
        lastName: 'Lincoln',
        amount: 242,
      },
      {
        id: '3',
        status: 'processing',
        email: 'monserrat44@gmail.com',
        firstName: 'Monserrat',
        lastName: 'Rodriguez',
        amount: 837,
      },
      {
        id: '4',
        status: 'success',
        email: 'silas22@gmail.com',
        firstName: 'Silas',
        lastName: 'Johnson',
        amount: 874,
      },
      {
        id: '5',
        status: 'failed',
        email: 'carmella@hotmail.com',
        firstName: 'Carmella',
        lastName: 'DeVito',
        amount: 721,
      },
      {
        id: '6',
        status: 'success',
        email: 'maria@gmail.com',
        firstName: 'Maria',
        lastName: 'Garcia',
        amount: 529,
      },
      {
        id: '7',
        status: 'processing',
        email: 'james34@outlook.com',
        firstName: 'James',
        lastName: 'Wilson',
        amount: 438,
      },
      {
        id: '8',
        status: 'success',
        email: 'sarah.j@yahoo.com',
        firstName: 'Sarah',
        lastName: 'Jones',
        amount: 692,
      },
      {
        id: '9',
        status: 'failed',
        email: 'robert55@gmail.com',
        firstName: 'Robert',
        lastName: 'Brown',
        amount: 512,
      },
      {
        id: '10',
        status: 'success',
        email: 'emily.p@hotmail.com',
        firstName: 'Emily',
        lastName: 'Parker',
        amount: 375,
      },
      {
        id: '11',
        status: 'success',
        email: 'david87@gmail.com',
        firstName: 'David',
        lastName: 'Miller',
        amount: 623,
      },
      {
        id: '12',
        status: 'processing',
        email: 'jennifer@yahoo.com',
        firstName: 'Jennifer',
        lastName: 'Davis',
        amount: 459,
      },
      {
        id: '13',
        status: 'failed',
        email: 'michael.s@hotmail.com',
        firstName: 'Michael',
        lastName: 'Smith',
        amount: 782,
      },
      {
        id: '14',
        status: 'success',
        email: 'lisa.w@gmail.com',
        firstName: 'Lisa',
        lastName: 'Wilson',
        amount: 347,
      },
      {
        id: '15',
        status: 'success',
        email: 'john.doe@outlook.com',
        firstName: 'John',
        lastName: 'Doe',
        amount: 594,
      },
      {
        id: '16',
        status: 'processing',
        email: 'emma.j@gmail.com',
        firstName: 'Emma',
        lastName: 'Johnson',
        amount: 428,
      },
    ],
    []
  );

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState('');

  const handleBulkAction = (action: string) => {
    const selectedRows = table.getSelectedRowModel().rows;

    // For demo purposes, let's just show what would happen
    switch (action) {
      case 'delete': {
        toast.info(`Deleting ${selectedRows.length} payments`);

        break;
      }
      case 'export': {
        toast.info(`Exporting ${selectedRows.length} payments`);

        break;
      }
      case 'email': {
        toast.info(`Sending email to ${selectedRows.length} customers`);

        break;
      }
      case 'tag': {
        toast.info(`Tagging ${selectedRows.length} payments`);

        break;
      }
      // No default
    }
  };

  const columns = React.useMemo<ColumnDef<Payment>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all"
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label="Select row"
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'name',
        header: 'Customer',
        cell: ({ row }) => (
          <div>
            {row.original.firstName} {row.original.lastName}
          </div>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => <div>{row.original.email}</div>,
      },
      {
        accessorKey: 'amount',
        header: () => <div>Amount</div>,
        cell: ({ row }) => {
          const amount = Number.parseFloat(row.original.amount.toString());
          return <div className="font-medium">${amount.toFixed(2)}</div>;
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
        cell: () => (
          <div className="text-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="size-8 p-0" variant="ghost">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>View details</DropdownMenuItem>
                <DropdownMenuItem>Download receipt</DropdownMenuItem>
                <DropdownMenuItem>Contact customer</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 8,
      },
    },
  });

  const selectedRowsCount = Object.keys(rowSelection).length;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Latest Payments</CardTitle>
        <CardDescription>See recent payments from your customers here.</CardDescription>
        <CardAction>
          <div className="flex gap-2">
            <Input
              className="max-w-sm"
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Filter payments..."
              value={globalFilter}
            />
            {selectedRowsCount > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Badge variant="outline">{selectedRowsCount} selected</Badge>
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleBulkAction('export')}>
                    <Download />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction('email')}>
                    <Mail />
                    Email customers
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction('tag')}>
                    <Tag />
                    Tag payments
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleBulkAction('delete')}
                    variant="destructive"
                  >
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
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
            {selectedRowsCount} of {data.length} row(s) selected.
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
