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
import { ArrowUpDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import Image from 'next/image';

import { ExportButton } from '@/components/CardActionMenus';
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

import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';

export type Product = {
  id: number;
  image: string;
  name: string;
  price: number;
  sales: number;
  sold: number;
};

const data: Product[] = [
  {
    id: 1,
    image: `/images/products/01.jpeg`,
    name: 'Sports Shoes',
    price: 316,
    sold: 316,
    sales: 10,
  },
  {
    id: 2,
    image: `/images/products/02.jpeg`,
    name: 'Black T-Shirt',
    price: 274,
    sold: 274,
    sales: 20,
  },
  {
    id: 3,
    image: `/images/products/03.jpeg`,
    name: 'Jeans',
    price: 195,
    sold: 195,
    sales: 15,
  },
  {
    id: 4,
    image: `/images/products/04.jpeg`,
    name: 'Red Sneakers',
    price: 402,
    sold: 402,
    sales: 40,
  },
  {
    id: 5,
    image: `/images/products/05.jpeg`,
    name: 'Red Scarf',
    price: 280,
    sold: 280,
    sales: 37,
  },
  {
    id: 6,
    image: `/images/products/06.jpeg`,
    name: 'Kitchen Accessory',
    price: 150,
    sold: 150,
    sales: 18,
  },
  {
    id: 7,
    image: `/images/products/07.jpeg`,
    name: 'Bicycle',
    price: 316,
    sold: 316,
    sales: 25,
  },
  {
    id: 8,
    image: `/images/products/01.jpeg`,
    name: 'Sports Shoes',
    price: 290,
    sold: 290,
    sales: 12,
  },
];

export const columns: ColumnDef<Product>[] = [
  {
    accessorKey: 'name',
    header: 'Product',
    cell: ({ row }) => (
      <div className="flex items-center gap-4">
        <Image
          alt="..."
          className="size-8"
          height={30}
          src={row.original.image}
          unoptimized
          width={30}
        />
        <div className="capitalize">{row.getValue('name')}</div>
      </div>
    ),
  },
  {
    accessorKey: 'sold',
    header: ({ column }) => (
      <Button
        className="p-0! hover:bg-transparent!"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Sold
        <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const amount = Number.parseFloat(row.getValue('sold'));

      // Format the amount as a dollar amount
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);

      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'sales',
    header: ({ column }) => (
      <Button
        className="p-0! hover:bg-transparent!"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Sales
        <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => <div>{row.getValue('sales')}</div>,
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const product = row.original;

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
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(String(product.id))}>
                Copy product ID
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

export function EcommerceBestSellingProductsCard() {
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
        pageSize: 8,
      },
    },
  });

  return (
    <Card className="lg:col-span-5">
      <CardHeader>
        <CardTitle>Best Selling Products</CardTitle>
        <CardAction className="relative">
          <ExportButton className="absolute end-0 top-0" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          className="max-w-xs"
          onChange={(event) => table.getColumn('name')?.setFilterValue(event.target.value)}
          placeholder="Filter products..."
          value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
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
        <div className="flex items-center justify-end space-x-2">
          <div className="text-muted-foreground flex-1 text-sm">
            {table.getFilteredSelectedRowModel().rows.length} of{' '}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="space-x-2">
            <Button
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              size="icon"
              variant="outline"
            >
              <ChevronLeft />
            </Button>
            <Button
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              size="icon"
              variant="outline"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
