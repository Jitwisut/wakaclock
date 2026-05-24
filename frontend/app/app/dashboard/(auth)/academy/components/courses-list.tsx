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
import { ChevronLeft, ChevronRight, MoreHorizontalIcon, StarIcon } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

const data: Course[] = [
  {
    id: 1,
    name: 'Introduction to React',
    category: 'Web Development',
    image: `/images/tech/react.svg`,
    score: 4.5,
    progress: 60,
    started: true,
  },
  {
    id: 2,
    name: 'Machine Learning Basics',
    category: 'Data Science',
    image: `/images/tech/angular.svg`,
    score: 4.8,
    progress: 0,
    started: false,
  },
  {
    id: 3,
    name: 'Digital Marketing Fundamentals',
    category: 'Marketing',
    image: `/images/tech/vue.svg`,
    score: 4.2,
    progress: 45,
    started: true,
  },
  {
    id: 4,
    name: 'Python for Beginners',
    category: 'Programming',
    image: `/images/tech/html.svg`,
    score: 4.6,
    progress: 0,
    started: false,
  },
  {
    id: 5,
    name: 'UX Design Principles',
    category: 'Design',
    image: `/images/tech/css.svg`,
    score: 4.4,
    progress: 0,
    started: false,
  },
  {
    id: 5,
    name: 'Svelte Project Development',
    category: 'Programming',
    image: `/images/tech/svelte.svg`,
    score: 4.8,
    progress: 0,
    started: false,
  },
];

export type Course = {
  category: string;
  id: number;
  image: string;
  name: string;
  progress: number;
  score: number;
  started: boolean;
};

export const columns: ColumnDef<Course>[] = [
  {
    accessorKey: 'name',
    header: 'Course name',
    cell: ({ row }) => (
      <div className="flex items-center gap-4">
        <Image
          alt="shadcn/ui"
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
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => row.getValue('category'),
  },
  {
    accessorKey: 'score',
    header: 'Score',
    cell: ({ row }) => (
      <div className="flex items-center">
        <StarIcon className="mr-1 size-4 fill-yellow-500 text-yellow-500" />
        {row.getValue('score')}
      </div>
    ),
  },
  {
    accessorKey: 'progress',
    header: 'Progress',
    cell: ({ row }) => <Progress className="h-2 w-20" value={row.getValue('progress')} />,
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => (
      <div className="text-end">
        {row.original.started ? (
          <Button size="sm">
            Continue <ChevronRight />
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Start Course</DropdownMenuItem>
              <DropdownMenuItem>Add to Wishlist</DropdownMenuItem>
              <DropdownMenuItem>View Details</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    ),
  },
];

export function CoursesListTable() {
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
    <Card>
      <CardHeader>
        <CardTitle>Popular Courses</CardTitle>
        <CardAction className="col-start-auto row-start-auto mt-2 justify-self-start lg:col-start-2 lg:row-start-1 lg:mt-0 lg:justify-self-end">
          <Input
            className="w-full sm:w-52"
            onChange={(event) => table.getColumn('name')?.setFilterValue(event.target.value)}
            placeholder="Search courses"
            value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
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
              variant="outline"
            >
              <ChevronLeft />
            </Button>
            <Button
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
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
