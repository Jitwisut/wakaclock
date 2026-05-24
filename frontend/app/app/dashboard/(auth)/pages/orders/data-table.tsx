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
import { ArrowUpDown, Columns, FilterIcon, MoreHorizontal, PlusCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

export type Order = {
  customer: Customer;
  date?: string;
  id: number;
  image: string;
  price?: string;
  product_name: string;
  status: 'active' | 'cancel' | 'completed' | 'pending' | 'transportation';
  type?: string;
};

export type Customer = {
  email?: string;
  name?: string;
};

export const columns: ColumnDef<Order>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all"
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')
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
    accessorKey: 'id',
    header: '#',
    cell: ({ row }) => (
      <Link
        className="text-muted-foreground hover:text-primary hover:underline"
        href={`/dashboard/pages/orders/${row.getValue('id')}`}
      >
        #{row.getValue('id')}
      </Link>
    ),
  },
  {
    accessorKey: 'product_name',
    header: 'Product',
    cell: ({ row }) => (
      <div className="flex items-center gap-4">
        <Image
          alt="..."
          className="size-10 rounded-md lg:size-12"
          height={40}
          src={`/images${row.original.image}`}
          unoptimized
          width={40}
        />
        {row.getValue('product_name')}
      </div>
    ),
  },
  {
    accessorKey: 'price',
    header: ({ column }) => (
      <Button
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Price
        <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => row.getValue('price'),
  },
  {
    accessorKey: 'customer',
    header: 'Customer',
    cell: ({ row }) => {
      const { customer } = row.original;

      return (
        <div className="space-y-1">
          <div className="font-semibold">{customer.name}</div>
          <div className="text-muted-foreground">{customer.email}</div>
        </div>
      );
    },
  },
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <Button
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Date
        <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => row.getValue('date'),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => <div className="capitalize">{row.getValue('type')}</div>,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <Button
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Status
        <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const { status } = row.original;

      const statusMap = {
        active: 'success',
        transportation: 'info',
        pending: 'warning',
        cancel: 'destructive',
        completed: 'success',
        delivered: 'success',
      } as const;

      const statusClass = statusMap[status] ?? 'secondary';

      return (
        <div>
          <Badge className="capitalize" variant={statusClass}>
            {status.replaceAll('-', ' ')}
          </Badge>
        </div>
      );
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: () => (
      <div className="text-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Order Details</DropdownMenuItem>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  },
];

const filterStatuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
];

const filterCategories = [
  { value: 'beauty', label: 'Beauty' },
  { value: 'technology', label: 'Technology' },
  { value: 'toys', label: 'Toys' },
  { value: 'food', label: 'Food' },
  { value: 'home-appliances', label: 'Home Appliances' },
];

function OrderFilters() {
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <PlusCircle />
            Status
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-0">
          <Command>
            <CommandInput className="h-9" placeholder="Status" />
            <CommandList>
              <CommandEmpty>No status found.</CommandEmpty>
              <CommandGroup>
                {filterStatuses.map((status) => (
                  <CommandItem key={status.value} value={status.value}>
                    <div className="flex items-center space-x-3 py-1">
                      <Checkbox id={status.value} />
                      <label
                        className="leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        htmlFor={status.value}
                      >
                        {status.label}
                      </label>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <PlusCircle />
            Category
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-0">
          <Command>
            <CommandInput className="h-9" placeholder="Category" />
            <CommandList>
              <CommandEmpty>No category found.</CommandEmpty>
              <CommandGroup>
                {filterCategories.map((category) => (
                  <CommandItem key={category.value} value={category.value}>
                    <div className="flex items-center space-x-3 py-1">
                      <Checkbox id={category.value} />
                      <label
                        className="leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        htmlFor={category.value}
                      >
                        {category.label}
                      </label>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}

export default function OrdersDataTable({ data }: { data: Order[] }) {
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
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Input
          className="md:max-w-sm"
          onChange={(event) => table.getColumn('product_name')?.setFilterValue(event.target.value)}
          placeholder="Search orders..."
          value={(table.getColumn('product_name')?.getFilterValue() as string) ?? ''}
        />
        <div className="hidden gap-2 md:flex">
          <OrderFilters />
        </div>
        {/* filter for mobile*/}
        <div className="inline md:hidden">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="outline">
                <FilterIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-4">
              <div className="grid space-y-2">
                <OrderFilters />
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="ms-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <span className="hidden lg:inline">Columns</span> <Columns />
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
      </div>
      <div className="space-y-4">
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
    </div>
  );
}
