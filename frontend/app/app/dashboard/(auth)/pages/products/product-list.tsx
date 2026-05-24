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
import {
  ArrowUpDown,
  ColumnsIcon,
  FilterIcon,
  MoreHorizontal,
  PlusCircle,
  Star,
} from 'lucide-react';
import Image from 'next/image';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  category?: string;
  description?: string;
  id: number;
  image?: string;
  name?: string;
  price?: string;
  rating?: string;
  sku?: string;
  status: 'active' | 'closed-for-sale' | 'out-of-stock';
  stock?: string;
};

export const columns: ColumnDef<Product>[] = [
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
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Product Name
        <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-4">
        <figure className="rounded-lg border">
          <Image
            alt="..."
            height={48}
            src={`/images${row.original.image}`}
            unoptimized
            width={48}
          />
        </figure>
        <div className="capitalize">{row.getValue('name')}</div>
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
    accessorKey: 'category',
    header: ({ column }) => (
      <Button
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Category
        <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => <div className="capitalize">{row.getValue('category')}</div>,
  },
  {
    accessorKey: 'stock',
    header: ({ column }) => (
      <Button
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Stock
        <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => row.getValue('stock'),
  },
  {
    accessorKey: 'sku',
    header: 'SKU',
    cell: ({ row }) => row.getValue('sku'),
  },
  {
    accessorKey: 'rating',
    header: 'Rating',
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Star className="size-4 fill-orange-400 text-orange-400" /> {row.getValue('rating')}
      </div>
    ),
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
        'out-of-stock': 'warning',
        'closed-for-sale': 'destructive',
        completed: 'success',
      } as const;

      const statusClass = statusMap[status] ?? 'default';

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-8 w-8 p-0" variant="ghost">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>View details</DropdownMenuItem>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Copy ID</DropdownMenuItem>
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

const productStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'out-of-stock', label: 'Out of stock' },
  { value: 'closed-for-sale', label: 'Closed for sale' },
];

const productCategories = [
  { value: 'beauty', label: 'Beauty' },
  { value: 'technology', label: 'Technology' },
  { value: 'toys', label: 'Toys' },
  { value: 'food', label: 'Food' },
  { value: 'home-appliances', label: 'Home Appliances' },
];

function ProductFilters() {
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
                {productStatuses.map((status) => (
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
                {productCategories.map((category) => (
                  <CommandItem key={category.value} value={category.label}>
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
      <Select defaultValue="all">
        <SelectTrigger className="w-52 lg:w-auto">
          <span className="text-muted-foreground text-sm">Price:</span>
          <SelectValue placeholder="Select a product" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">$100-$200</SelectItem>
          <SelectItem value="in-stock">$200-$300</SelectItem>
          <SelectItem value="low-stock">$300-$400</SelectItem>
          <SelectItem value="archived">$400-$500</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

export default function ProductList({ data }: { data: Product[] }) {
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
    <div className="w-full space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          <Input
            className="max-w-sm"
            onChange={(event) => table.getColumn('name')?.setFilterValue(event.target.value)}
            placeholder="Search products..."
            value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          />
          <div className="hidden gap-2 md:flex">
            <ProductFilters />
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
                  <ProductFilters />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="ms-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <span className="hidden lg:inline">Columns</span> <ColumnsIcon />
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
                    onCheckedChange={(value) => column.toggleVisibility(value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-lg border">
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
  );
}
