'use client';

import { useState } from 'react';

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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { ColumnDef, ColumnFiltersState, SortingState } from '@tanstack/react-table';

type RoomType = 'Deluxe' | 'Standard' | 'Suite';
type BookingStatus = 'Checked-In' | 'Pending';

const STATUS_CHECKED_IN: BookingStatus = 'Checked-In';
const CHECK_IN_DATE = 'June 19, 2028';

interface Booking {
  bookingId: string;
  checkIn: string;
  checkOut: string;
  duration: string;
  guestName: string;
  roomNumber: string;
  roomType: RoomType;
  status: BookingStatus;
}

const bookings: Booking[] = [
  {
    bookingId: 'LG-B00108',
    guestName: 'Angus Copper',
    roomType: 'Deluxe',
    roomNumber: 'Room 101',
    duration: '3 nights',
    checkIn: CHECK_IN_DATE,
    checkOut: 'June 22, 2028',
    status: STATUS_CHECKED_IN,
  },
  {
    bookingId: 'LG-B00109',
    guestName: 'Catherine Lopp',
    roomType: 'Standard',
    roomNumber: 'Room 202',
    duration: '2 nights',
    checkIn: CHECK_IN_DATE,
    checkOut: 'June 21, 2028',
    status: STATUS_CHECKED_IN,
  },
  {
    bookingId: 'LG-B00110',
    guestName: 'Edgar Irving',
    roomType: 'Suite',
    roomNumber: 'Room 303',
    duration: '5 nights',
    checkIn: CHECK_IN_DATE,
    checkOut: 'June 24, 2028',
    status: 'Pending',
  },
  {
    bookingId: 'LG-B00111',
    guestName: 'Ice B. Holand',
    roomType: 'Standard',
    roomNumber: 'Room 105',
    duration: '4 nights',
    checkIn: CHECK_IN_DATE,
    checkOut: 'June 23, 2028',
    status: STATUS_CHECKED_IN,
  },
  {
    bookingId: 'LG-B00112',
    guestName: 'John Smith',
    roomType: 'Deluxe',
    roomNumber: 'Room 201',
    duration: '2 nights',
    checkIn: 'June 20, 2028',
    checkOut: 'June 22, 2028',
    status: 'Pending',
  },
  {
    bookingId: 'LG-B00113',
    guestName: 'Mary Johnson',
    roomType: 'Suite',
    roomNumber: 'Room 401',
    duration: '7 nights',
    checkIn: 'June 21, 2028',
    checkOut: 'June 28, 2028',
    status: STATUS_CHECKED_IN,
  },
];

const columns: ColumnDef<Booking>[] = [
  {
    accessorKey: 'bookingId',
    header: ({ column }) => (
      <Button
        className="text-muted-foreground px-0 font-normal hover:bg-transparent"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Booking ID
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <span className="text-foreground">{row.getValue('bookingId')}</span>,
  },
  {
    accessorKey: 'guestName',
    header: ({ column }) => (
      <Button
        className="text-muted-foreground px-0 font-normal hover:bg-transparent"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Guest Name
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <span className="text-foreground">{row.getValue('guestName')}</span>,
  },
  {
    accessorKey: 'roomType',
    header: ({ column }) => (
      <Button
        className="text-muted-foreground px-0 font-normal hover:bg-transparent"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Room Type
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-lime-400" />
        <Badge
          className="border-lime-300 bg-lime-50 font-normal text-lime-700 dark:border-lime-900 dark:bg-lime-950 dark:text-lime-300"
          variant="outline"
        >
          {row.getValue('roomType')}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: 'roomNumber',
    header: ({ column }) => (
      <Button
        className="text-muted-foreground px-0 font-normal hover:bg-transparent"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Room Number
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <span className="text-foreground">{row.getValue('roomNumber')}</span>,
  },
  {
    accessorKey: 'duration',
    header: ({ column }) => (
      <Button
        className="text-muted-foreground px-0 font-normal hover:bg-transparent"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Duration
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <span className="text-foreground">{row.getValue('duration')}</span>,
  },
  {
    id: 'checkInOut',
    accessorFn: (row) => row.checkIn,
    header: ({ column }) => (
      <Button
        className="text-muted-foreground px-0 font-normal hover:bg-transparent"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        variant="ghost"
      >
        Check-In & Check-Out
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-foreground">
        {row.original.checkIn} - {row.original.checkOut}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <div className="flex justify-end">
        <Button
          className="text-muted-foreground px-0 font-normal hover:bg-transparent"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          variant="ghost"
        >
          Status
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      </div>
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as BookingStatus;
      return (
        <div className="flex justify-end">
          <Badge
            className={
              status === 'Checked-In'
                ? 'border-lime-300 bg-lime-50 font-normal text-lime-700 dark:border-lime-900 dark:bg-lime-950 dark:text-lime-300'
                : 'border-yellow-300 bg-yellow-50 font-normal text-yellow-700'
            }
            variant="outline"
          >
            {status}
          </Badge>
        </div>
      );
    },
    filterFn: (row, columnId, filterValue) => {
      if (filterValue === 'all') return true;
      return row.getValue(columnId) === filterValue;
    },
  },
];

export function BookingList() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: bookings,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    initialState: {
      pagination: {
        pageSize: 4,
      },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    if (value === 'all') {
      setColumnFilters([]);
    } else {
      setColumnFilters([{ id: 'status', value }]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between space-y-4 lg:flex-row lg:items-center lg:space-y-0">
          <CardTitle>Booking List</CardTitle>
          <div className="flex items-center gap-3">
            <InputGroup>
              <InputGroupInput
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search guest, status, etc"
                value={globalFilter}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
            <Select onValueChange={handleStatusChange} value={statusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Checked-In">Checked-In</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      className="bg-muted py-2 first:rounded-tl-lg first:rounded-bl-lg last:rounded-tr-lg last:rounded-br-lg"
                      key={header.id}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell className="py-4" key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="h-24 text-center" colSpan={columns.length}>
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.setPageIndex(0)}
                size="icon"
                variant="outline"
              >
                <ChevronsLeft />
              </Button>
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
              <Button
                disabled={!table.getCanNextPage()}
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                size="icon"
                variant="outline"
              >
                <ChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
