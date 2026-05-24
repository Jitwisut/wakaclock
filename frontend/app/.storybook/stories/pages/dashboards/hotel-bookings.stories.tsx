import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  LayoutGridIcon,
  ListIcon,
  MoreHorizontalIcon,
  PhoneIcon,
  PlusIcon,
} from 'lucide-react';

import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  createFakeTableData,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';
import {
  createFakeCalendar,
  createFakeCalendarEvents,
} from '@/.storybook/stories/_factories/calendar.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DATA
// ============================================================================

const timeSlots = [
  '07:00 AM',
  '08:00 AM',
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '01:00 PM',
];

const rooms = [
  i18n.t('hotelBookings.story.room1', 'Room 1'),
  i18n.t('hotelBookings.story.room2', 'Room 2'),
  i18n.t('hotelBookings.story.room3', 'Room 3'),
  i18n.t('hotelBookings.story.room4', 'Room 4'),
  i18n.t('hotelBookings.story.room5', 'Room 5'),
];

type BookingStatus = 'approved' | 'cancelled' | 'finished' | 'pending';

interface Booking {
  duration: string;
  guestName: string;
  id: string;
  phone: string;
  room: string;
  status: BookingStatus;
  time: string;
}

const bookings: Booking[] = [
  {
    id: 'b1',
    guestName: i18n.t('hotelBookings.story.guestJohnSmith', 'John Smith'),
    room: i18n.t('hotelBookings.story.room1', 'Room 1'),
    time: '08:00 AM',
    duration: '2h',
    phone: '+1 234-5678',
    status: 'approved',
  },
  {
    id: 'b2',
    guestName: i18n.t('hotelBookings.story.guestSarahJohnson', 'Sarah Johnson'),
    room: i18n.t('hotelBookings.story.room2', 'Room 2'),
    time: '09:00 AM',
    duration: '1h',
    phone: '+1 345-6789',
    status: 'pending',
  },
  {
    id: 'b3',
    guestName: i18n.t('hotelBookings.story.guestMikeBrown', 'Mike Brown'),
    room: i18n.t('hotelBookings.story.room3', 'Room 3'),
    time: '10:00 AM',
    duration: '3h',
    phone: '+1 456-7890',
    status: 'finished',
  },
  {
    id: 'b4',
    guestName: i18n.t('hotelBookings.story.guestEmilyDavis', 'Emily Davis'),
    room: i18n.t('hotelBookings.story.room1', 'Room 1'),
    time: '11:00 AM',
    duration: '1h',
    phone: '+1 567-8901',
    status: 'cancelled',
  },
  {
    id: 'b5',
    guestName: i18n.t('hotelBookings.story.guestDavidWilson', 'David Wilson'),
    room: i18n.t('hotelBookings.story.room4', 'Room 4'),
    time: '07:00 AM',
    duration: '2h',
    phone: '+1 678-9012',
    status: 'approved',
  },
];

const statusVariant: Record<BookingStatus, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  approved: 'default',
  pending: 'secondary',
  finished: 'outline',
  cancelled: 'destructive',
};

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function HotelBookingsDemo() {
  const { t } = useTranslation();

  const [view, setView] = useState<'grid' | 'list'>('grid');

  const roomLabelMap: Record<string, string> = {
    'Room 1': t('hotelPage.story.room1', 'Room 1'),
    'Room 2': t('hotelPage.story.room2', 'Room 2'),
    'Room 3': t('hotelPage.story.room3', 'Room 3'),
    'Room 4': t('hotelPage.story.room4', 'Room 4'),
    'Room 5': t('hotelPage.story.room5', 'Room 5'),
  };

  return (
    <div className="flex h-[90vh] flex-col p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('hotelPage.story.heading', 'Hotel Bookings')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t('hotelPage.story.description', 'Manage meeting room schedules and reservations')}
        </p>
      </div>

      <div className="flex-1 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline">
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span className="font-semibold">
              {t('hotelPage.story.dateLabel', 'Today — Jan 15, 2025')}
            </span>
            <Button size="icon" variant="outline">
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setView('grid')}
              size="icon"
              variant={view === 'grid' ? 'default' : 'outline'}
            >
              <LayoutGridIcon className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setView('list')}
              size="icon"
              variant={view === 'list' ? 'default' : 'outline'}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              {t('hotelPage.story.newBooking', 'New Booking')}
            </Button>
          </div>
        </div>

        {/* Grid View */}
        {view === 'grid' ? (
          <div className="overflow-auto">
            <div className="bg-border grid min-w-[800px] grid-cols-6 gap-px rounded-lg border">
              {/* Header row */}
              <div className="bg-muted p-3 text-sm font-medium">
                <ClockIcon className="mb-1 h-4 w-4" />
                {t('hotelPage.story.time', 'Time')}
              </div>
              {rooms.map((room) => (
                <div className="bg-muted p-3 text-center text-sm font-medium" key={room}>
                  {roomLabelMap[room] || room}
                </div>
              ))}

              {/* Time slots */}
              {timeSlots.map((slot) => (
                <>
                  <div className="bg-background p-3 text-sm" key={`time-${slot}`}>
                    {slot}
                  </div>
                  {rooms.map((room) => {
                    const booking = bookings.find((b) => b.time === slot && b.room === room);
                    return (
                      <div className="bg-background p-2" key={`${slot}-${room}`}>
                        {booking ? (
                          <div className="rounded-md border p-2">
                            <div className="text-xs font-medium">{booking.guestName}</div>
                            <div className="text-muted-foreground text-xs">{booking.duration}</div>
                            <Badge className="mt-1" variant={statusVariant[booking.status]}>
                              {booking.status}
                            </Badge>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        ) : (
          /* List View */
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('hotelBookings.story.guest', 'Guest')}</TableHead>
                    <TableHead>{t('hotelBookings.story.room', 'Room')}</TableHead>
                    <TableHead>{t('hotelBookings.story.time', 'Time')}</TableHead>
                    <TableHead>{t('hotelBookings.story.duration', 'Duration')}</TableHead>
                    <TableHead>{t('hotelBookings.story.status', 'Status')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{booking.guestName}</TableCell>
                      <TableCell>{roomLabelMap[booking.room] || booking.room}</TableCell>
                      <TableCell>{booking.time}</TableCell>
                      <TableCell>{booking.duration}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[booking.status]}>{booking.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreHorizontalIcon className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              {t('hotelBookings.story.edit', 'Edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              {t('hotelBookings.story.cancel', 'Cancel')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function BookingListDemo() {
  const { t } = useTranslation();

  const roomLabelMap: Record<string, string> = {
    'Room 1': t('hotelPage.story.room1', 'Room 1'),
    'Room 2': t('hotelPage.story.room2', 'Room 2'),
    'Room 3': t('hotelPage.story.room3', 'Room 3'),
    'Room 4': t('hotelPage.story.room4', 'Room 4'),
    'Room 5': t('hotelPage.story.room5', 'Room 5'),
  };

  return (
    <div className="max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('hotelPage.story.bookingList', 'Booking List')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {bookings.slice(0, 4).map((booking) => (
            <div
              className="flex items-center justify-between rounded-lg border p-3"
              key={booking.id}
            >
              <div>
                <div className="font-medium">{booking.guestName}</div>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <span>{roomLabelMap[booking.room] || booking.room}</span>
                  <span>•</span>
                  <span>{booking.time}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <PhoneIcon className="h-3 w-3" />
                    {booking.phone}
                  </span>
                </div>
              </div>
              <Badge variant={statusVariant[booking.status]}>{booking.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Hotel Bookings',
  component: HotelBookingsDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...formHandlers] },
    docs: {
      description: {
        component:
          'Hotel Bookings Page - Meeting room schedule with grid and list views, booking management, and status tracking.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof HotelBookingsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('hotelBookings.storyName.default', 'Full Page'),
  render: () => <HotelBookingsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify main layout elements
    expect(canvas.getByText('Hotel Bookings')).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /new booking/i })).toBeInTheDocument();

    // Verify grid view content
    expect(canvas.getByText('Room 1')).toBeInTheDocument();
    expect(canvas.getByText('John Smith')).toBeInTheDocument();

    // Switch to list view
    const listButton = canvas.getAllByRole('button').find((btn) => {
      const svg = btn.querySelector('svg');
      return svg && btn.getAttribute('aria-pressed') !== 'true';
    });
    if (listButton) {
      await userEvent.click(listButton);
    }
  },
};

export const BookingList: Story = {
  name: i18n.t('hotelBookings.storyName.bookingList', 'Booking List'),
  render: () => <BookingListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvas.getByText('Booking List')).toBeInTheDocument();
    expect(canvas.getByText('John Smith')).toBeInTheDocument();
    expect(canvas.getByText('Sarah Johnson')).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('hotelBookings.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <HotelBookingsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('hotelBookings.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <HotelBookingsDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('hotelBookings.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <HotelBookingsDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Created: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.created', 'Handler: created'),
  parameters: { msw: { handlers: formStatusHandlers.created } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: formStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: formStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: formStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'hotelBookings.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: formStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: formStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PayloadTooLarge: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.payloadTooLarge', 'Handler: payloadTooLarge'),
  parameters: { msw: { handlers: formStatusHandlers.payloadTooLarge } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: formStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: formStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'hotelBookings.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: formStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: formStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'hotelBookings.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: formStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: formStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: formStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowSubmission: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.slowSubmission', 'Handler: slowSubmission'),
  parameters: { msw: { handlers: formStatusHandlers.slowSubmission } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: formStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: formStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: formStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OtpExpired: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.otpExpired', 'Handler: otpExpired'),
  parameters: { msw: { handlers: formStatusHandlers.otpExpired } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OtpMaxAttempts: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.otpMaxAttempts', 'Handler: otpMaxAttempts'),
  parameters: { msw: { handlers: formStatusHandlers.otpMaxAttempts } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmailTaken: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.emailTaken', 'Handler: emailTaken'),
  parameters: { msw: { handlers: formStatusHandlers.emailTaken } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmailAvailable: Story = {
  ...Default,
  name: i18n.t('hotelBookings.storyName.emailAvailable', 'Handler: emailAvailable'),
  parameters: { msw: { handlers: formStatusHandlers.emailAvailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY DATA STORY
// ============================================================================

function FactoryDataDemo() {
  const { t } = useTranslation();
  const tableRow = createFakeTableRow();
  const tableData = createFakeTableData(3);
  const calendar = createFakeCalendar();
  const events = createFakeCalendarEvents(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ tableRow, tableData, calendar, events }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('hotelBookings.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
