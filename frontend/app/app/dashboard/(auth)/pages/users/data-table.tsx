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
import { ArrowUpDown, Columns, MoreHorizontal, PlusCircle } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { generateAvatarFallback } from '@/lib/utils';

import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';

export type User = {
  country: string;
  firstName: string;
  id: number;
  image: string;
  lastName: string;
  plan_name: string;
  status: 'active' | 'inactive' | 'pending';
};

export const columns: ColumnDef<User>[] = [
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
    header: 'Name',
    cell: ({ row }) => (
      <div className="flex items-center gap-4">
        <Avatar>
          <AvatarImage alt="shadcn ui kit" src={row.original.image} />
          <AvatarFallback>{generateAvatarFallback(row.getValue('name'))}</AvatarFallback>
        </Avatar>
        <div className="capitalize">{row.getValue('name')}</div>
      </div>
    ),
  },
  {
    accessorKey: 'role',
    header: ({ column }) => (
      <Button
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Role
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => row.getValue('role'),
  },
  {
    accessorKey: 'plan_name',
    header: ({ column }) => (
      <Button
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Plan
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => row.getValue('plan_name'),
  },
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <Button
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Email
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => row.getValue('email'),
  },
  {
    accessorKey: 'country',
    header: ({ column }) => (
      <Button
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Country
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => row.getValue('country'),
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
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => {
      const { status } = row.original;

      const statusMap = {
        active: 'success',
        inactive: 'destructive',
        pending: 'warning',
      } as const;

      const statusClass = statusMap[status] ?? 'outline';

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
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>View user</DropdownMenuItem>
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function UsersDataTable({ data }: { data: User[] }) {
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

  const statuses = [
    {
      value: 'active',
      label: 'Active',
    },
    {
      value: 'inactive',
      label: 'Inactive',
    },
    {
      value: 'pending',
      label: 'Pending',
    },
  ];

  const plans = [
    {
      value: 'basic',
      label: 'Basic',
    },
    {
      value: 'team',
      label: 'Team',
    },
    {
      value: 'enterprise',
      label: 'Enterprise',
    },
  ];

  const roles = [
    {
      value: 'construction-foreman',
      label: 'Construction Foreman',
    },
    {
      value: 'project-manager',
      label: 'Project Manager',
    },
    {
      value: 'surveyor',
      label: 'Surveyor',
    },
    {
      value: 'architect',
      label: 'Architect',
    },
    {
      value: 'subcontractor',
      label: 'Subcontractor',
    },
    {
      value: 'electrician',
      label: 'Electrician',
    },
    {
      value: 'estimator',
      label: 'Estimator',
    },
  ];

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 py-4">
        <div className="flex gap-2">
          <Input
            className="max-w-sm"
            onChange={(event) => table.getColumn('name')?.setFilterValue(event.target.value)}
            placeholder="Search users..."
            value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          />
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
                    {statuses.map((status) => (
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
                Plan
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0">
              <Command>
                <CommandInput className="h-9" placeholder="Plan" />
                <CommandList>
                  <CommandEmpty>No plan found.</CommandEmpty>
                  <CommandGroup>
                    {plans.map((plan) => (
                      <CommandItem key={plan.value} value={plan.value}>
                        <div className="flex items-center space-x-3 py-1">
                          <Checkbox id={plan.value} />
                          <label
                            className="leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            htmlFor={plan.value}
                          >
                            {plan.label}
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
                <PlusCircle className="h-4 w-4" />
                Role
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0">
              <Command>
                <CommandInput className="h-9" placeholder="Role" />
                <CommandList>
                  <CommandEmpty>No role found.</CommandEmpty>
                  <CommandGroup>
                    {roles.map((role) => (
                      <CommandItem
                        key={role.value}
                        onSelect={() => {
                          // setValue(currentValue === value ? "" : currentValue);
                          // setOpen(false);
                        }}
                        value={role.value}
                      >
                        <div className="flex items-center space-x-3 py-1">
                          <Checkbox id={role.value} />
                          <label
                            className="leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            htmlFor={role.value}
                          >
                            {role.label}
                          </label>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="ml-auto" variant="outline">
              <Columns /> <span className="hidden md:inline">Columns</span>
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
      <div className="flex items-center justify-end space-x-2 pt-4">
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
