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
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { ChevronDownIcon, ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const data: Project[] = [
  {
    id: 1,
    name: 'Product Development',
    client: {
      avatar: `/images/avatars/01.png`,
      name: 'Kevin Heal',
    },
    date: '20/03/2024',
    deadline: '05/04/2024',
    status: 'active',
    progress: 30,
  },
  {
    id: 2,
    name: 'New Office Building',
    client: {
      avatar: `/images/avatars/02.png`,
      name: 'Sarah Johnson',
    },
    date: '15/03/2024',
    deadline: '10/04/2024',
    status: 'cancel',
    progress: 60,
  },
  {
    id: 3,
    name: 'Mobile app design',
    client: {
      avatar: `/images/avatars/03.png`,
      name: 'Michael Chen',
    },
    date: '10/03/2024',
    deadline: '01/04/2024',
    status: 'completed',
    progress: 100,
  },
  {
    id: 4,
    name: 'Website & Blog',
    client: {
      avatar: `/images/avatars/04.png`,
      name: 'Emily Rodriguez',
    },
    date: '05/03/2024',
    deadline: '20/03/2024',
    status: 'pending',
    progress: 50,
  },
  {
    id: 5,
    name: 'Marketing Campaign',
    client: {
      avatar: `/images/avatars/05.png`,
      name: 'David Wilson',
    },
    date: '01/03/2024',
    deadline: '15/04/2024',
    status: 'active',
    progress: 45,
  },
  {
    id: 6,
    name: 'E-commerce Platform',
    client: {
      avatar: `/images/avatars/06.png`,
      name: 'Jessica Lee',
    },
    date: '25/02/2024',
    deadline: '10/05/2024',
    status: 'pending',
    progress: 20,
  },
  {
    id: 7,
    name: 'CRM Integration',
    client: {
      avatar: `/images/avatars/07.png`,
      name: 'Robert Brown',
    },
    date: '20/02/2024',
    deadline: '15/03/2024',
    status: 'completed',
    progress: 100,
  },
  {
    id: 8,
    name: 'Data Analytics Dashboard',
    client: {
      avatar: `/images/avatars/08.png`,
      name: 'Amanda Taylor',
    },
    date: '15/02/2024',
    deadline: '30/03/2024',
    status: 'active',
    progress: 75,
  },
  {
    id: 9,
    name: 'Mobile Payment System',
    client: {
      avatar: `/images/avatars/09.png`,
      name: 'Thomas Garcia',
    },
    date: '10/02/2024',
    deadline: '25/03/2024',
    status: 'cancel',
    progress: 35,
  },
  {
    id: 10,
    name: 'AI Chatbot Development',
    client: {
      avatar: `/images/avatars/10.png`,
      name: 'Olivia Martinez',
    },
    date: '05/02/2024',
    deadline: '20/04/2024',
    status: 'active',
    progress: 60,
  },
  {
    id: 11,
    name: 'Cloud Migration',
    client: {
      avatar: `/images/avatars/01.png`,
      name: 'William Clark',
    },
    date: '01/02/2024',
    deadline: '15/03/2024',
    status: 'completed',
    progress: 95,
  },
  {
    id: 12,
    name: 'Security Audit',
    client: {
      avatar: `/images/avatars/02.png`,
      name: 'Sophia Kim',
    },
    date: '25/01/2024',
    deadline: '10/03/2024',
    status: 'pending',
    progress: 40,
  },
];

type Client = {
  avatar: string;
  name: string;
};

type Project = {
  client?: Client;
  date?: string;
  deadline?: string;
  id: number;
  name?: string;
  progress?: number;
  status: 'active' | 'cancel' | 'completed' | 'pending';
};

export const columns: ColumnDef<Project>[] = [
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
    header: 'Project Name',
    cell: ({ row }) => row.getValue('name'),
  },
  {
    accessorKey: 'client',
    header: 'Client Name',
    cell: ({ row }) => {
      const client = row.getValue('client') as Client;

      return (
        <div className="flex items-center gap-4">
          <Avatar>
            <AvatarImage alt="shadcn ui kit" src={client.avatar} />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          {client.name}
        </div>
      );
    },
  },
  {
    accessorKey: 'date',
    header: 'Start Date',
    cell: ({ row }) => row.getValue('date'),
  },
  {
    accessorKey: 'deadline',
    header: 'Deadline',
    cell: ({ row }) => row.getValue('deadline'),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as 'active' | 'cancel' | 'completed' | 'pending';

      const statusClassMap: Record<typeof status, string> = {
        pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
        active: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
        completed: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
        cancel: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
      };

      return <Badge className={`capitalize ${statusClassMap[status]}`}>{status}</Badge>;
    },
  },
  {
    accessorKey: 'progress',
    header: 'Progress',
    cell: ({ row }) => (
      <div className="flex flex-col lg:flex-row lg:items-center lg:gap-2">
        <Progress className="h-2" value={row.getValue('progress')} />
        <span className="text-muted-foreground text-sm">%{row.getValue('progress')}</span>
      </div>
    ),
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: () => (
      <div className="text-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-8 w-8 p-0" variant="ghost">
              <span className="sr-only">Open menu</span>
              <Ellipsis className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View Project</DropdownMenuItem>
            <DropdownMenuItem>Members</DropdownMenuItem>
            <DropdownMenuItem>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  },
];

export function TableRecentProjects() {
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
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Recent Projects</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-4">
          <Input
            className="max-w-sm"
            onChange={(event) => table.getColumn('name')?.setFilterValue(event.target.value)}
            placeholder="Filter projects..."
            value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="ml-auto" variant="outline">
                Columns <ChevronDownIcon className="ml-2 h-4 w-4" />
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
                    <TableHead className="[&:has([role=checkbox])]:pl-3" key={header.id}>
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
                      <TableCell className="[&:has([role=checkbox])]:pl-3" key={cell.id}>
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
