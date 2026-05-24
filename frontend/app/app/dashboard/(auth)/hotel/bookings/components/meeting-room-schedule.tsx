'use client';

import { useMemo, useState } from 'react';

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { addDays, format, isToday, subDays } from 'date-fns';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  MoreHorizontal,
  MoreVertical,
  Phone,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { items } from '../data';

import { BookingFormSheet } from './booking-form-sheet';

import type { Booking, BookingStatus } from '../data';
import type { ColumnDef, SortingState } from '@tanstack/react-table';

const timeSlots = [
  '07:00 AM',
  '08:00 AM',
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 AM',
  '13:00 AM',
];

const rooms = ['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5', 'Room 6', 'Room 7'];

const statusConfig: Record<BookingStatus, { label: string }> = {
  finished: { label: 'Finished' },
  cancelled: { label: 'Cancelled' },
  pending: { label: 'Pending' },
  approved: { label: 'Approved' },
};

const getCardStyle = (status: BookingStatus) => {
  switch (status) {
    case 'finished': {
      return 'bg-yellow-50 dark:bg-yellow-950 border-l-4 border-l-yellow-400 dark:border-l-yellow-700';
    }
    case 'cancelled': {
      return 'bg-orange-50 dark:bg-orange-950 border-l-4 border-l-orange-400 dark:border-l-orange-700';
    }
    case 'pending': {
      return 'bg-yellow-50 dark:bg-yellow-950 border-l-4 border-l-yellow-400 dark:border-l-yellow-700';
    }
    case 'approved': {
      return 'bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-400 dark:border-l-blue-700';
    }
    default: {
      return ' border-l-4 border-l-gray-200';
    }
  }
};

const getStatusBadgeStyle = (status: BookingStatus) => {
  switch (status) {
    case 'finished': {
      return 'bg-green-500 dark:bg-green-950 hover:bg-green-500 text-white';
    }
    case 'cancelled': {
      return 'bg-orange-500 dark:bg-orange-950 hover:bg-orange-500 text-white';
    }
    case 'pending': {
      return 'bg-orange-400 dark:bg-orange-950 hover:bg-orange-400 text-white';
    }
    case 'approved': {
      return 'bg-green-500 dark:bg-green-950 hover:bg-green-500 text-white';
    }
    default: {
      return '';
    }
  }
};

export function MeetingRoomSchedule() {
  const [bookings] = useState<Booking[]>(items);
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const goToPreviousDay = () => setSelectedDate(subDays(selectedDate, 1));
  const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const goToToday = () => setSelectedDate(new Date());

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  const filteredBookings = useMemo(
    () => bookings.filter((booking) => booking.date === selectedDateStr),
    [bookings, selectedDateStr]
  );

  const columns: ColumnDef<Booking>[] = useMemo(
    () => [
      {
        accessorKey: 'id',
        header: ({ column }) => (
          <Button
            className="p-0 hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            variant="ghost"
          >
            ID
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => <span className="font-medium">{row.getValue('id')}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            className="p-0 hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            variant="ghost"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
      },
      {
        accessorKey: 'room',
        header: 'Room',
        cell: ({ row }) => `Room ${row.getValue('room')}`,
      },
      {
        id: 'time',
        header: 'Time',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Clock className="text-muted-foreground h-3 w-3" />
            {row.original.startTime} → {row.original.endTime}
          </div>
        ),
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Phone className="text-muted-foreground h-3 w-3" />
            {row.getValue('phone')}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.getValue('status') as BookingStatus;
          return (
            <Badge className={getStatusBadgeStyle(status)}>{statusConfig[status].label}</Badge>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-8 w-8" size="icon" variant="ghost">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setBookingToDelete(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredBookings,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  const getBookingsForSlot = (timeSlot: string, roomIndex: number) =>
    filteredBookings.filter(
      (booking) => booking.timeSlot === timeSlot && booking.room === roomIndex + 1
    );

  const handleDeleteBooking = () => {
    if (bookingToDelete) {
      toast.success('Booking deleted successfully');
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-end justify-between lg:items-center">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <h1 className="me-6 text-xl font-bold tracking-tight lg:text-2xl">Bookings</h1>
            <div className="flex gap-2">
              <div className="flex items-center rounded-lg border">
                <Button
                  className="rounded-e-none border-e"
                  onClick={goToPreviousDay}
                  size="icon"
                  variant="ghost"
                >
                  <ChevronLeft />
                </Button>
                <div className="px-3 text-center text-sm lg:min-w-[140px]">
                  {format(selectedDate, 'EEE, MMM d')}
                </div>
                <Button
                  className="rounded-s-none border-s"
                  onClick={goToNextDay}
                  size="icon"
                  variant="ghost"
                >
                  <ChevronRight />
                </Button>
              </div>
              {!isToday(selectedDate) && (
                <Button className="hidden md:flex" onClick={goToToday} variant="outline">
                  Today
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border">
              <Button
                className="rounded-r-none"
                onClick={() => setViewMode('grid')}
                size="icon"
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              >
                <LayoutGrid />
              </Button>
              <Button
                className="rounded-l-none"
                onClick={() => setViewMode('list')}
                size="icon"
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              >
                <List />
              </Button>
            </div>
            <BookingFormSheet />
          </div>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="overflow-hidden rounded-lg border">
            <div className="flex">
              {/* Fixed Time Column */}
              <div className="z-10 w-[100px] flex-shrink-0 border-r">
                <div className="text-muted-foreground flex h-[57px] items-center border-b p-4 text-sm">
                  Time
                </div>
                {timeSlots.map((timeSlot) => (
                  <div
                    className="text-muted-foreground flex h-[120px] items-start justify-center border-b p-4 text-sm last:border-b-0"
                    key={timeSlot}
                  >
                    {timeSlot}
                  </div>
                ))}
              </div>

              {/* Scrollable Rooms Area */}
              <div className="flex-1 overflow-x-auto">
                <div className="inline-flex min-w-full">
                  {rooms.map((room, roomIndex) => (
                    <div className="w-[200px] flex-shrink-0 border-r last:border-r-0" key={room}>
                      {/* Room Header */}
                      <div className="text-muted-foreground flex h-[57px] items-center justify-center border-b p-4 text-center text-sm">
                        {room}
                      </div>
                      {/* Time Slots for this Room */}
                      {timeSlots.map((timeSlot) => {
                        const slotBookings = getBookingsForSlot(timeSlot, roomIndex);
                        const isEmpty = slotBookings.length === 0;

                        return (
                          <div
                            className={`group relative h-[120px] border-b p-2 last:border-b-0 ${isEmpty ? 'hover:bg-muted/50' : ''}`}
                            key={timeSlot}
                          >
                            {isEmpty && (
                              <div className="flex h-full items-center justify-center opacity-0 group-hover:opacity-100">
                                <Button size="sm" variant="outline">
                                  <Plus />
                                  Add
                                </Button>
                              </div>
                            )}
                            {slotBookings.map((booking) => (
                              <Card
                                className={`p-3 ${getCardStyle(booking.status)}`}
                                key={`${booking.id}-${booking.room}-${booking.timeSlot}`}
                              >
                                <CardContent className="px-1">
                                  <div className="mb-1 flex items-start justify-between">
                                    <span className="text-foreground text-xs font-medium">
                                      {booking.id}
                                    </span>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          className="absolute end-3 top-3"
                                          size="icon-sm"
                                          variant="ghost"
                                        >
                                          <MoreHorizontal />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem>Edit</DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onClick={() => setBookingToDelete(booking)}
                                        >
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  <div className="mb-1 text-xs">
                                    <strong>{booking.name}</strong>
                                  </div>
                                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                                    <Clock className="h-2.5 w-2.5" />
                                    <span>
                                      {booking.startTime} - {booking.endTime}
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* List View with TanStack Table */}
        {viewMode === 'list' && (
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
                    <TableRow key={row.id}>
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
                      No bookings found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        onOpenChange={(open) => !open && setBookingToDelete(null)}
        open={!!bookingToDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the booking for{' '}
              <strong>{bookingToDelete?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteBooking}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
