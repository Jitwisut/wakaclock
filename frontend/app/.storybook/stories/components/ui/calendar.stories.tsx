import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import {
  calendarHandlers,
  calendarStatusHandlers,
} from '@/.storybook/stories/_handlers/calendar.handlers';
import {
  CALENDAR_CAPTION_LAYOUTS,
  CALENDAR_LOCALES,
  CALENDAR_MODES,
  CALENDAR_MONTH_COUNTS,
  CALENDAR_NAV_VIEWS,
  CALENDAR_PRESET_RANGES,
  CALENDAR_SIZES,
  CALENDAR_WEEK_STARTS,
  type CalendarCaptionLayout,
  type CalendarMode,
  type CalendarNavView,
  type CalendarSize,
  type CalendarWeekStartsOn,
  createFakeBirthDateCalendar,
  createFakeBookingCalendar,
  createFakeCalendar,
  createFakeCalendarConfig,
  createFakeCalendarDateRange,
  createFakeCalendarDisabledDates,
  createFakeCalendarEvent,
  createFakeCalendarEvents,
  createFakeCalendarMatrix,
  createFakeCalendarPresets,
  createFakeCalendars,
  createFakeCompactCalendar,
  createFakeDateRange,
  createFakeEuropeanCalendar,
  createFakeJapaneseCalendar,
  createFakeMultiMonthCalendar,
  createFakeMultipleCalendar,
  createFakeRangeCalendar,
  createFakeReminder,
  createFakeReminders,
  createFakeRestrictedCalendar,
  createFakeScheduleSlot,
  createFakeScheduleSlots,
  createFakeSelectedDates,
  createFakeSingleCalendar,
  createFakeTimeline,
  createFakeTimelineItem,
  createFakeYearPickerCalendar,
  type CalendarLocale as FactoryCalendarLocale,
  type FakeCalendar,
  type FakeCalendarConfig,
  type FakeCalendarDateRange,
  type FakeCalendarDisabledDates,
  type FakeDateRange,
  type FakeReminder,
  type FakeScheduleSlot,
  type FakeTimelineItem,
} from '@/.storybook/stories/_factories/calendar.factory';
import { createFakeEvents, type FakeEvent } from '@/.storybook/stories/_factories/event.factory';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import type { DateRange } from 'react-day-picker';
import { ja } from 'react-day-picker/locale';

import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircleIcon, RefreshCwIcon } from 'lucide-react';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

type CalendarLocale = React.ComponentProps<typeof Calendar>['locale'];

function CalendarSingleDemo({ locale }: { locale?: CalendarLocale }) {
  const [date, setDate] = React.useState<Date | undefined>(new Date(2024, 0, 1));
  return <Calendar locale={locale} mode="single" onSelect={setDate} selected={date} />;
}

function CalendarRangeDemo({ locale }: { locale?: CalendarLocale }) {
  const [range, setRange] = React.useState<DateRange | undefined>();
  return <Calendar locale={locale} mode="range" onSelect={setRange} selected={range} />;
}

function CalendarVariantsDemo() {
  const { t } = useTranslation();
  const [singleDate, setSingleDate] = React.useState<Date | undefined>(new Date(2024, 0, 15));
  const [rangeDate, setRangeDate] = React.useState<DateRange | undefined>({
    from: new Date(2024, 0, 10),
    to: new Date(2024, 0, 20),
  });
  const disabledDays = [
    new Date(2024, 0, 5),
    new Date(2024, 0, 12),
    new Date(2024, 0, 25),
    { from: new Date(2024, 0, 28), to: new Date(2024, 0, 31) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{t('calendar.variants.single')}</p>
        <Calendar mode="single" onSelect={setSingleDate} selected={singleDate} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('calendar.variants.range')}</p>
        <Calendar mode="range" onSelect={setRangeDate} selected={rangeDate} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('calendar.variants.multipleMonths')}</p>
        <Calendar mode="single" numberOfMonths={2} onSelect={setSingleDate} selected={singleDate} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('calendar.variants.disabledDates')}</p>
        <Calendar
          disabled={disabledDays}
          mode="single"
          onSelect={setSingleDate}
          selected={singleDate}
        />
      </div>
    </div>
  );
}

function CalendarSizesDemo() {
  const { t } = useTranslation();
  const [date, setDate] = React.useState<Date | undefined>(new Date(2024, 0, 15));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{t('calendar.sizes.compact')}</p>
        <div className="w-[260px]">
          <Calendar className="p-2 text-sm" mode="single" onSelect={setDate} selected={date} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('calendar.sizes.default')}</p>
        <Calendar mode="single" onSelect={setDate} selected={date} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('calendar.sizes.fullWidth')}</p>
        <div className="w-full max-w-lg">
          <Calendar className="w-full p-6" mode="single" onSelect={setDate} selected={date} />
        </div>
      </div>
    </div>
  );
}

// Error display component
interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

function CalendarErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="calendar-error">
      <AlertCircleIcon className="size-4" />
      <AlertTitle>
        Error {error.status}: {error.code}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {error.message}
        {error.details && (
          <ul className="mt-2 list-disc pl-4 text-sm">
            {Object.entries(error.details).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCwIcon className="mr-2 size-4" />
          Retry
        </Button>
      )}
    </Alert>
  );
}

// Loading skeleton for events
function CalendarEventsLoadingSkeleton() {
  return (
    <div className="space-y-4" data-state="loading" data-testid="calendar-loading">
      <Calendar mode="single" selected={new Date(2024, 0, 1)} />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`calendar-skeleton-${String(i)}`} className="flex items-center gap-2">
            <Skeleton className="size-3 rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Empty state
function CalendarEmptyState() {
  return (
    <div className="space-y-4" data-state="empty" data-testid="calendar-empty">
      <Calendar mode="single" selected={new Date(2024, 0, 1)} />
      <div className="text-muted-foreground text-center text-sm">
        {i18n.t('calendar.story.noEventsFound', 'No events found')}
      </div>
    </div>
  );
}

// Calendar with events demo (async data fetching)
function CalendarWithEventsDemo() {
  const { t } = useTranslation();

  const [date, setDate] = React.useState<Date | undefined>(new Date(2024, 0, 1));
  const [events, setEvents] = React.useState<FakeEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchEvents = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/events?start=2024-01-01&end=2024-01-31')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<{ events: FakeEvent[] }>;
      })
      .then((json) => {
        setEvents(json.events);
        setLoading(false);
        return undefined;
      })
      .catch((error_: ApiError) => {
        setError(error_);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (loading) {
    return <CalendarEventsLoadingSkeleton />;
  }

  if (error) {
    return <CalendarErrorDisplay error={error} onRetry={fetchEvents} />;
  }

  if (events.length === 0) {
    return <CalendarEmptyState />;
  }

  return (
    <div className="space-y-4" data-state="success" data-testid="calendar-success">
      <Calendar mode="single" onSelect={setDate} selected={date} />
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Events ({events.length})</h4>
        <div className="max-h-40 space-y-2 overflow-y-auto">
          {events.slice(0, 5).map((event) => (
            <div key={event.id} className="flex items-center gap-2 text-sm">
              <div className="size-3 rounded-full" style={{ backgroundColor: event.color }} />
              <span className="truncate">{event.title}</span>
              {event.allDay && (
                <Badge variant="secondary">{t('calendar.story.allDay', 'All day')}</Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Static demo with Faker data (no API)
function CalendarWithFakerData() {
  const calendarConfig = React.useMemo(
    () => createFakeCalendar({ mode: 'single', numberOfMonths: 1 }),
    []
  );
  const events = React.useMemo(() => createFakeEvents(5), []);
  const [date, setDate] = React.useState<Date | undefined>(calendarConfig.initialMonth);

  return (
    <div className="space-y-4">
      <Calendar
        mode="single"
        onSelect={setDate}
        selected={date}
        showOutsideDays={calendarConfig.showOutsideDays}
      />
      <div className="space-y-2">
        <h4 className="text-sm font-medium">
          {i18n.t('calendar.story.eventsFakerData', 'Events (Faker data)')}
        </h4>
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="flex items-center gap-2 text-sm">
              <div className="size-3 rounded-full" style={{ backgroundColor: event.color }} />
              <span className="truncate">{event.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Calendar',
  component: Calendar,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onSelect: fn(),
    onMonthChange: fn(),
  },
  parameters: {
    msw: {
      handlers: calendarHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    selected: {
      control: false,
      description: i18n.t('calendar.argType.currentlySelectedDates', 'Currently selected date(s)'),
      table: {
        category: 'Content',
        type: { summary: 'Date | Date[] | DateRange' },
      },
    },
    disabled: {
      control: false,
      description: i18n.t(
        'calendar.argType.disableSpecificDatesMatcherOrArrayOfMatchers',
        'Disable specific dates (Matcher or array of Matchers)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'Matcher | Matcher[]' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t('calendar.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    captionLayout: {
      control: 'select',
      options: ['buttons', 'dropdown', 'dropdown-months', 'dropdown-years'],
      description: i18n.t(
        'calendar.argType.layoutOfTheMonthyearCaption',
        'Layout of the month/year caption'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'buttons' },
        type: { summary: "'buttons' | 'dropdown' | 'dropdown-months' | 'dropdown-years'" },
      },
    },
    showOutsideDays: {
      control: 'boolean',
      description: i18n.t(
        'calendar.argType.showDaysFromAdjacentMonths',
        'Show days from adjacent months'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    showWeekNumber: {
      control: 'boolean',
      description: i18n.t('calendar.argType.showWeekNumbers', 'Show week numbers'),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // State
    mode: {
      control: 'select',
      options: ['single', 'multiple', 'range'],
      description: i18n.t(
        'calendar.argType.selectionModeOfTheCalendar',
        'Selection mode of the calendar'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'single' },
        type: { summary: "'single' | 'multiple' | 'range'" },
      },
    },
    defaultMonth: {
      control: false,
      description: i18n.t('calendar.argType.initialMonthToDisplay', 'Initial month to display'),
      table: {
        category: 'State',
        type: { summary: 'Date' },
      },
    },
    // Layout
    numberOfMonths: {
      control: { type: 'number', min: 1, max: 12 },
      description: i18n.t(
        'calendar.argType.numberOfMonthsToDisplay',
        'Number of months to display'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: '1' },
        type: { summary: 'number' },
      },
    },
    fixedWeeks: {
      control: 'boolean',
      description: i18n.t(
        'calendar.argType.alwaysShow6WeeksPerMonth',
        'Always show 6 weeks per month'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    weekStartsOn: {
      control: { type: 'number', min: 0, max: 6 },
      description: i18n.t(
        'calendar.argType.firstDayOfWeek0Sunday1MondayEtc',
        'First day of week (0 = Sunday, 1 = Monday, etc.)'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: '0' },
        type: { summary: '0 | 1 | 2 | 3 | 4 | 5 | 6' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('calendar.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('calendar.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('calendar.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('calendar.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('calendar.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('calendar.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('calendar.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onSelect: {
      action: 'onSelect',
      description: i18n.t(
        'calendar.argType.calledWhenDateIsSelected',
        'Called when date is selected'
      ),
      table: { category: 'Events' },
    },
    onMonthChange: {
      action: 'onMonthChange',
      description: i18n.t('calendar.argType.calledWhenMonthChanges', 'Called when month changes'),
      table: { category: 'Events' },
    },
    // Calendar Props Reference (react-day-picker DayPicker):
    // - mode: Selection mode ('single' | 'multiple' | 'range')
    // - selected: Currently selected date(s) (Date | Date[] | DateRange)
    // - onSelect: Called when date is selected ((date: Date | Date[] | DateRange | undefined) => void)
    // - defaultMonth: Initial month to display (Date)
    // - month: Controlled month display (Date)
    // - onMonthChange: Called when month changes ((month: Date) => void)
    // - numberOfMonths: Number of months to display (number, default: 1)
    // - fromDate: Minimum selectable date (Date)
    // - toDate: Maximum selectable date (Date)
    // - fromMonth: First allowed month for navigation (Date)
    // - toMonth: Last allowed month for navigation (Date)
    // - fromYear: First allowed year for navigation (number)
    // - toYear: Last allowed year for navigation (number)
    // - disabled: Disable specific dates (Matcher | Matcher[])
    // - hidden: Hide specific dates (Matcher | Matcher[])
    // - locale: Locale for date formatting (Locale, e.g., 'ja' from react-day-picker/locale)
    // - weekStartsOn: First day of week (0-6, 0 = Sunday)
    // - fixedWeeks: Always show 6 weeks (boolean)
    // - showOutsideDays: Show days from adjacent months (boolean)
    // - showWeekNumber: Show week numbers (boolean)
    // - captionLayout: Caption layout ('dropdown' | 'buttons' | 'dropdown-months' | 'dropdown-years')
    // - modifiers: Custom day modifiers (Record<string, Matcher | Matcher[]>)
    // - modifiersStyles: Styles for custom modifiers (Record<string, CSSProperties>)
    // - modifiersClassNames: Class names for custom modifiers (Record<string, string>)
    // - className: Additional CSS classes (string)
    //
    // Range Mode Props:
    // - min: Minimum days in range (number)
    // - max: Maximum days in range (number)
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Single: Story = {
  render: () => <CalendarSingleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
    expect(canvas.getByRole('grid')).toBeInTheDocument();

    const selectedDay = canvasElement.querySelector('button[aria-selected="true"]');
    expect(selectedDay).toBeInTheDocument();
  },
};

export const Range: Story = {
  render: () => <CalendarRangeDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    const startText = canvas.getByText('10');
    const startButton = startText.closest('button');

    if (!(startButton instanceof HTMLButtonElement)) {
      throw new Error(
        i18n.t('test.expectedDayButtonForRangeStart', 'Expected a day button for range start (10).')
      );
    }

    const endText = canvas.getByText('15');
    const endButton = endText.closest('button');

    if (!(endButton instanceof HTMLButtonElement)) {
      throw new Error(
        i18n.t('test.expectedDayButtonForRangeEnd', 'Expected a day button for range end (15).')
      );
    }

    await userEvent.click(startButton);
    await userEvent.click(endButton);

    const startAfter = canvas.getByText('10').closest('button');
    const endAfter = canvas.getByText('15').closest('button');

    if (!(startAfter instanceof HTMLButtonElement) || !(endAfter instanceof HTMLButtonElement)) {
      throw new Error(
        i18n.t(
          'test.expectedDayButtonsToRemainInDom',
          'Expected day buttons to remain in the DOM after selection.'
        )
      );
    }

    expect(startAfter.getAttribute('aria-selected')).toBe('true');
    expect(endAfter.getAttribute('aria-selected')).toBe('true');
  },
};

export const Playground: Story = {
  ...Single,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
    expect(canvas.getByRole('grid')).toBeInTheDocument();
  },
};

export const Variants: Story = {
  render: () => <CalendarVariantsDemo />,
  play: async ({ canvasElement }) => {
    const calendars = canvasElement.querySelectorAll('[data-slot="calendar"]');
    expect(calendars.length).toBeGreaterThanOrEqual(4);

    const grids = canvasElement.querySelectorAll('table');
    expect(grids.length).toBeGreaterThanOrEqual(4);
  },
};

export const Sizes: Story = {
  render: () => <CalendarSizesDemo />,
  play: async ({ canvasElement }) => {
    const calendars = canvasElement.querySelectorAll('[data-slot="calendar"]');
    expect(calendars.length).toBe(3);

    const grids = canvasElement.querySelectorAll('table');
    expect(grids.length).toBe(3);
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByRole('navigation')).toBeInTheDocument();
    expect(canvasElement.querySelector('table')).toBeInTheDocument();
    expect(canvasElement.querySelector('button[aria-selected="true"]')).toBeInTheDocument();

    const dayText = canvas.getByText('15');
    const dayButton = dayText.closest('button');

    if (!(dayButton instanceof HTMLButtonElement)) {
      throw new Error(
        i18n.t('test.expectedDayButtonForDate', 'Expected a day button for date 15.')
      );
    }

    await userEvent.click(dayButton);

    const selectedAfter = canvasElement.querySelector('button[aria-selected="true"]');
    expect(selectedAfter).toBeInTheDocument();
    expect(selectedAfter?.textContent).toContain('15');
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
    expect(canvas.getByRole('grid')).toBeInTheDocument();
    expect(canvasElement.querySelector('button[aria-selected="true"]')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
    expect(canvas.getByRole('grid')).toBeInTheDocument();
    expect(canvasElement.querySelector('button[aria-selected="true"]')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: () => <CalendarSingleDemo locale={ja} />,
  play: async (context) => {
    await Default.play?.(context);

    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(context.canvasElement);
    expect(canvas.getByRole('button', { name: '前の月へ' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: '次の月へ' })).toBeInTheDocument();
  },
};

export const DesignReference: Story = {
  ...Default,
  tags: ['!test'],
  parameters: {
    ...(Default.parameters ?? {}),
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('calendar.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-wrap items-center gap-3">
        <div id="hover">
          <Story />
        </div>
        <div id="focus">
          <Story />
        </div>
        <div id="active">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover *'],
      focusVisible: ['#focus *'],
      active: ['#active *'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => <CalendarWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
    // Verify events are displayed
    const eventItems = canvasElement.querySelectorAll('.rounded-full');
    expect(eventItems.length).toBe(5);
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncEvents: Story = {
  parameters: {
    msw: { handlers: calendarHandlers },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(canvasElement.querySelector('[data-testid="calendar-loading"]')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="calendar-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify calendar and events rendered
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: calendarStatusHandlers.loading },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="calendar-loading"]')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: calendarStatusHandlers.empty },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="calendar-empty"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('calendar.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: calendarStatusHandlers.badRequest },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="400"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('calendar.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: calendarStatusHandlers.unauthorized },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="401"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('calendar.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: calendarStatusHandlers.forbidden },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="403"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('calendar.storyName.error409Conflict', 'Error 409: Conflict'),
  parameters: {
    msw: { handlers: calendarStatusHandlers.conflict },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="409"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('calendar.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: calendarStatusHandlers.tooManyRequests },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="429"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error422UnprocessableEntity: Story = {
  name: i18n.t('calendar.storyName.error422UnprocessableEntity', 'Error 422: Unprocessable Entity'),
  parameters: {
    msw: { handlers: calendarStatusHandlers.unprocessableEntity },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="422"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'calendar.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  parameters: {
    msw: { handlers: calendarStatusHandlers.internalServerError },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="500"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('calendar.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: calendarStatusHandlers.badGateway },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="502"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('calendar.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: calendarStatusHandlers.serviceUnavailable },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="503"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('calendar.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: calendarStatusHandlers.gatewayTimeout },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="504"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ SPECIAL STATE STORIES ============

export const SlowResponse: Story = {
  name: i18n.t('calendar.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: calendarStatusHandlers.slowResponse },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(canvasElement.querySelector('[data-testid="calendar-loading"]')).toBeInTheDocument();
    // Wait for data (slow response takes 5s)
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="calendar-success"]')).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('calendar.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: calendarStatusHandlers.networkError },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="calendar-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const ManyEvents: Story = {
  name: i18n.t('calendar.storyName.manyEvents', 'Many Events (50+)'),
  parameters: {
    msw: { handlers: calendarStatusHandlers.manyEvents },
  },
  render: () => <CalendarWithEventsDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="calendar-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: calendarHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
    expect(canvas.getByRole('grid')).toBeInTheDocument();
    expect(canvasElement.querySelector('button[aria-selected="true"]')).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('calendar.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Verify calendar has proper ARIA role
    const calendar = canvasElement.querySelector('[data-slot="calendar"]');
    expect(calendar).toBeInTheDocument();

    // Verify navigation buttons exist and are accessible
    const prevButton = canvasElement.querySelector('[data-slot="calendar-prev-button"]');
    const nextButton = canvasElement.querySelector('[data-slot="calendar-next-button"]');
    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();

    // Verify month/year header
    const monthCaption = canvasElement.querySelector('[data-slot="calendar-month-caption"]');
    expect(monthCaption).toBeInTheDocument();

    // Verify day cells have proper attributes
    const dayCells = canvasElement.querySelectorAll('[data-slot="calendar-day"]');
    expect(dayCells.length).not.toBe(0);

    // Test keyboard navigation on calendar
    if (prevButton instanceof HTMLButtonElement) {
      prevButton.focus();
      expect(document.activeElement).toBe(prevButton);

      // Navigate with keyboard
      await userEvent.keyboard('{Tab}');
      expect(document.activeElement).not.toBe(prevButton);
    }

    // Verify weekday headers exist
    const weekdayHeaders = canvasElement.querySelectorAll('[data-slot="calendar-weekday"]');
    expect(weekdayHeaders.length).toBe(7);

    // Test day selection via keyboard
    const todayButton = canvasElement.querySelector(
      '[data-slot="calendar-day"][data-today="true"]'
    );
    if (todayButton instanceof HTMLButtonElement) {
      todayButton.focus();
      await userEvent.keyboard('{Enter}');
      expect(
        todayButton.getAttribute('aria-selected') === 'true' ||
          todayButton.hasAttribute('data-selected')
      ).toBeInTheDocument();
    }
  },
};

// ============ FACTORY WIRING: CONSTANTS ============

function CalendarModesDemo() {
  const [date, setDate] = React.useState<Date | undefined>(new Date(2024, 0, 15));

  return (
    <div className="flex flex-col gap-6" data-testid="calendar-modes-demo">
      <h3 className="text-lg font-semibold">{i18n.t('calendar.factory.modes')}</h3>
      {CALENDAR_MODES.map((mode: CalendarMode) => (
        <div key={mode} data-testid={`mode-${mode}`}>
          <p className="mb-2 text-sm font-medium">{mode}</p>
          {mode === 'single' && <Calendar mode="single" onSelect={setDate} selected={date} />}
          {mode === 'range' && <Calendar mode="range" />}
          {mode === 'multiple' && <Calendar mode="multiple" />}
        </div>
      ))}
    </div>
  );
}

function CalendarNavViewsDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4" data-testid="calendar-nav-views-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.navViews')}</h3>
      <ul className="space-y-1">
        {CALENDAR_NAV_VIEWS.map((view: CalendarNavView) => (
          <li key={view} className="text-sm" data-testid={`nav-view-${view}`}>
            {view}
          </li>
        ))}
      </ul>
      <Calendar mode="single" />
    </div>
  );
}

function CalendarCaptionLayoutsDemo() {
  const { t } = useTranslation();
  const [date, setDate] = React.useState<Date | undefined>(new Date(2024, 0, 15));

  return (
    <div className="flex flex-col gap-6" data-testid="calendar-caption-layouts-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.captionLayouts')}</h3>
      {CALENDAR_CAPTION_LAYOUTS.filter(
        (l): l is Exclude<CalendarCaptionLayout, 'buttons'> => l !== 'buttons'
      ).map((layout) => (
        <div key={layout} data-testid={`caption-${layout}`}>
          <p className="mb-2 text-sm font-medium">{layout}</p>
          <Calendar
            captionLayout={layout}
            fromYear={2020}
            mode="single"
            onSelect={setDate}
            selected={date}
            toYear={2030}
          />
        </div>
      ))}
    </div>
  );
}

function CalendarLocalesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4" data-testid="calendar-locales-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.locales')}</h3>
      <div className="flex flex-wrap gap-2">
        {CALENDAR_LOCALES.map((locale: FactoryCalendarLocale) => (
          <Badge key={locale} variant="outline" data-testid={`locale-${locale}`}>
            {locale}
          </Badge>
        ))}
      </div>
      <Calendar mode="single" />
    </div>
  );
}

function CalendarWeekStartsDemo() {
  const { t } = useTranslation();
  const [date, setDate] = React.useState<Date | undefined>(new Date(2024, 0, 15));

  return (
    <div className="flex flex-col gap-6" data-testid="calendar-week-starts-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.weekStarts')}</h3>
      {CALENDAR_WEEK_STARTS.slice(0, 2).map((ws) => (
        <div key={ws.value} data-testid={`week-start-${String(ws.value)}`}>
          <p className="mb-2 text-sm font-medium">
            {ws.label} ({String(ws.value)})
          </p>
          <Calendar
            mode="single"
            onSelect={setDate}
            selected={date}
            weekStartsOn={ws.value as 0 | 1 | 2 | 3 | 4 | 5 | 6}
          />
        </div>
      ))}
    </div>
  );
}

function CalendarMonthCountsDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6" data-testid="calendar-month-counts-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.monthCounts')}</h3>
      {CALENDAR_MONTH_COUNTS.slice(0, 3).map((count) => (
        <div key={count} data-testid={`month-count-${String(count)}`}>
          <p className="mb-2 text-sm font-medium">{String(count)} month(s)</p>
          <Calendar mode="single" numberOfMonths={count} />
        </div>
      ))}
    </div>
  );
}

function CalendarSizesConstDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4" data-testid="calendar-sizes-const-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.modes')}</h3>
      <div className="flex flex-wrap gap-2">
        {CALENDAR_SIZES.map((size: CalendarSize) => (
          <Badge key={size} variant="secondary" data-testid={`size-${size}`}>
            {size}
          </Badge>
        ))}
      </div>
      <Calendar mode="single" />
    </div>
  );
}

function CalendarPresetRangesDemo() {
  const { t } = useTranslation();
  const presets = React.useMemo(() => {
    const today = CALENDAR_PRESET_RANGES.today();
    const thisWeek = CALENDAR_PRESET_RANGES.thisWeek();
    const lastWeek = CALENDAR_PRESET_RANGES.lastWeek();
    const thisMonth = CALENDAR_PRESET_RANGES.thisMonth();
    const lastMonth = CALENDAR_PRESET_RANGES.lastMonth();
    const nextWeek = CALENDAR_PRESET_RANGES.nextWeek();
    const nextMonth = CALENDAR_PRESET_RANGES.nextMonth();
    const thisYear = CALENDAR_PRESET_RANGES.thisYear();
    const lastYear = CALENDAR_PRESET_RANGES.lastYear();
    return {
      lastMonth,
      lastWeek,
      lastYear,
      nextMonth,
      nextWeek,
      thisMonth,
      thisWeek,
      thisYear,
      today,
    };
  }, []);

  return (
    <div className="flex flex-col gap-4" data-testid="calendar-preset-ranges-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.presetRanges')}</h3>
      <div className="space-y-2">
        {Object.entries(presets).map(([name, range]) => (
          <div
            key={name}
            className="flex items-center gap-2 text-sm"
            data-testid={`preset-${name}`}
          >
            <Badge variant="outline">{name}</Badge>
            <span>
              {range.from.toLocaleDateString()} - {range.to.toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
      <Calendar mode="range" />
    </div>
  );
}

// ============ FACTORY WIRING: FUNCTIONS ============

function CalendarDateRangeDemo() {
  const { t } = useTranslation();
  const range = React.useMemo(() => createFakeCalendarDateRange(14), []);

  return (
    <div className="space-y-4" data-testid="calendar-date-range-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.dateRange')}</h3>
      <p className="text-sm">
        From: {range.from?.toLocaleDateString()} / To: {range.to?.toLocaleDateString()}
      </p>
      <Calendar mode="single" />
    </div>
  );
}

function CalendarDisabledDatesDemo() {
  const disabledConfig = React.useMemo(() => createFakeCalendarDisabledDates(), []);
  const _config: FakeCalendarDisabledDates = disabledConfig;

  return (
    <div className="space-y-4" data-testid="calendar-disabled-dates-demo">
      <h3 className="text-lg font-semibold">{i18n.t('calendar.factory.disabledDates')}</h3>
      <div className="space-y-1 text-sm">
        {_config.before && <p>Before: {_config.before.toLocaleDateString()}</p>}
        {_config.after && <p>After: {_config.after.toLocaleDateString()}</p>}
        {_config.specific && <p>Specific dates: {String(_config.specific.length)}</p>}
        {_config.weekdays && <p>Disabled weekdays: {_config.weekdays.join(', ')}</p>}
        {_config.ranges && <p>Disabled ranges: {String(_config.ranges.length)}</p>}
      </div>
      <Calendar disabled={_config.specific ?? []} mode="single" />
    </div>
  );
}

function CalendarBulkDemo() {
  const { t } = useTranslation();
  const calendars = React.useMemo(() => createFakeCalendars(3), []);

  return (
    <div className="space-y-4" data-testid="calendar-bulk-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.bulkCalendars')}</h3>
      <p className="text-sm">
        {t('calendar.story.generatedCalendars', { count: calendars.length })}
      </p>
      {calendars.map((cal: FakeCalendar) => (
        <div key={cal.id} className="border-b pb-2">
          <p className="text-xs">
            Mode: {cal.mode} | Months: {String(cal.numberOfMonths)}
          </p>
        </div>
      ))}
      <Calendar mode="single" />
    </div>
  );
}

function CalendarSelectedDatesDemo() {
  const { t } = useTranslation();
  const dates = React.useMemo(() => createFakeSelectedDates(5), []);

  return (
    <div className="space-y-4" data-testid="calendar-selected-dates-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.selectedDates')}</h3>
      <ul className="space-y-1 text-sm">
        {dates.map((d, i) => (
          <li key={`date-${String(i)}`}>{d.toLocaleDateString()}</li>
        ))}
      </ul>
      <Calendar mode="multiple" selected={dates} />
    </div>
  );
}

function CalendarSingleFactoryDemo() {
  const { t } = useTranslation();
  const cal = React.useMemo(() => createFakeSingleCalendar(), []);
  const [date, setDate] = React.useState<Date | undefined>(cal.selectedDates?.[0]);

  return (
    <div className="space-y-4" data-testid="calendar-single-factory-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.singleCalendar')}</h3>
      <Calendar
        mode="single"
        onSelect={setDate}
        selected={date}
        showOutsideDays={cal.showOutsideDays}
      />
    </div>
  );
}

function CalendarRangeFactoryDemo() {
  const { t } = useTranslation();
  const cal = React.useMemo(() => createFakeRangeCalendar(10), []);
  const [range, setRange] = React.useState<DateRange | undefined>(
    cal.selectedDates && cal.selectedDates.length >= 2
      ? { from: cal.selectedDates[0], to: cal.selectedDates[1] }
      : undefined
  );

  return (
    <div className="space-y-4" data-testid="calendar-range-factory-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.rangeCalendar')}</h3>
      <Calendar
        mode="range"
        numberOfMonths={cal.numberOfMonths}
        onSelect={setRange}
        selected={range}
      />
    </div>
  );
}

function CalendarMultipleFactoryDemo() {
  const { t } = useTranslation();
  const cal = React.useMemo(() => createFakeMultipleCalendar(4), []);
  const [dates, setDates] = React.useState<Date[]>(cal.selectedDates ?? []);

  return (
    <div className="space-y-4" data-testid="calendar-multiple-factory-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.multipleCalendar')}</h3>
      <p className="text-sm">{t('calendar.story.selectedDates', { count: dates.length })}</p>
      <Calendar
        mode="multiple"
        onSelect={(d) => setDates(d ?? [])}
        required={false}
        selected={dates}
      />
    </div>
  );
}

function CalendarRestrictedDemo() {
  const { t } = useTranslation();
  const cal = React.useMemo(() => createFakeRestrictedCalendar(), []);
  const [date, setDate] = React.useState<Date | undefined>();

  return (
    <div className="space-y-4" data-testid="calendar-restricted-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.restrictedCalendar')}</h3>
      <Calendar
        disabled={cal.disabledDates ?? []}
        fromMonth={cal.fromMonth}
        mode="single"
        onSelect={setDate}
        selected={date}
        toMonth={cal.toMonth}
      />
    </div>
  );
}

function CalendarBookingDemo() {
  const { t } = useTranslation();
  const cal = React.useMemo(() => createFakeBookingCalendar(), []);
  const [date, setDate] = React.useState<Date | undefined>();

  return (
    <div className="space-y-4" data-testid="calendar-booking-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.bookingCalendar')}</h3>
      <Calendar
        disabled={cal.disabledDates ?? []}
        fromMonth={cal.fromMonth}
        mode="single"
        onSelect={setDate}
        selected={date}
        showOutsideDays={cal.showOutsideDays}
        toMonth={cal.toMonth}
      />
    </div>
  );
}

function CalendarMultiMonthDemo() {
  const { t } = useTranslation();
  const cal = React.useMemo(() => createFakeMultiMonthCalendar(3), []);

  return (
    <div className="space-y-4" data-testid="calendar-multi-month-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.multiMonth')}</h3>
      <Calendar
        fixedWeeks={cal.fixedWeeks}
        mode="range"
        numberOfMonths={cal.numberOfMonths}
        showOutsideDays={cal.showOutsideDays}
      />
    </div>
  );
}

function CalendarJapaneseFactoryDemo() {
  const cal = React.useMemo(() => createFakeJapaneseCalendar(), []);
  const [date, setDate] = React.useState<Date | undefined>();

  return (
    <div className="space-y-4" data-testid="calendar-japanese-factory-demo">
      <h3 className="text-lg font-semibold">{i18n.t('calendar.factory.japaneseCalendar')}</h3>
      <Calendar
        locale={ja}
        mode="single"
        onSelect={setDate}
        selected={date}
        weekStartsOn={cal.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6}
      />
    </div>
  );
}

function CalendarEuropeanDemo() {
  const { t } = useTranslation();
  const cal = React.useMemo(() => createFakeEuropeanCalendar(), []);
  const [date, setDate] = React.useState<Date | undefined>();

  return (
    <div className="space-y-4" data-testid="calendar-european-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.europeanCalendar')}</h3>
      <p className="text-sm">
        Locale: {cal.locale ?? 'en'} | Week numbers: {cal.showWeekNumbers ? 'yes' : 'no'}
      </p>
      <Calendar
        mode="single"
        onSelect={setDate}
        selected={date}
        showWeekNumber={cal.showWeekNumbers}
        weekStartsOn={cal.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6}
      />
    </div>
  );
}

function CalendarYearPickerDemo() {
  const { t } = useTranslation();
  const cal = React.useMemo(() => createFakeYearPickerCalendar(), []);
  const [date, setDate] = React.useState<Date | undefined>();

  return (
    <div className="space-y-4" data-testid="calendar-year-picker-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.yearPicker')}</h3>
      <Calendar
        captionLayout={
          cal.captionLayout as 'dropdown' | 'dropdown-months' | 'dropdown-years' | 'label'
        }
        fromYear={cal.fromMonth?.getFullYear()}
        mode="single"
        onSelect={setDate}
        selected={date}
        toYear={cal.toMonth?.getFullYear()}
      />
    </div>
  );
}

function CalendarBirthDateDemo() {
  const { t } = useTranslation();
  const cal = React.useMemo(() => createFakeBirthDateCalendar(), []);
  const [date, setDate] = React.useState<Date | undefined>();

  return (
    <div className="space-y-4" data-testid="calendar-birth-date-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.birthDate')}</h3>
      <Calendar
        captionLayout={
          cal.captionLayout as 'dropdown' | 'dropdown-months' | 'dropdown-years' | 'label'
        }
        defaultMonth={cal.initialMonth}
        fromYear={cal.fromMonth?.getFullYear()}
        mode="single"
        onSelect={setDate}
        selected={date}
        toYear={cal.toMonth?.getFullYear()}
      />
    </div>
  );
}

function CalendarCompactDemo() {
  const { t } = useTranslation();
  const cal = React.useMemo(() => createFakeCompactCalendar(), []);
  const [date, setDate] = React.useState<Date | undefined>();

  return (
    <div className="space-y-4" data-testid="calendar-compact-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.compactCalendar')}</h3>
      <div className="w-[260px]">
        <Calendar
          className="p-2 text-sm"
          fixedWeeks={cal.fixedWeeks}
          mode="single"
          onSelect={setDate}
          selected={date}
          showOutsideDays={cal.showOutsideDays}
        />
      </div>
    </div>
  );
}

function CalendarMatrixDemo() {
  const { t } = useTranslation();
  const matrix = React.useMemo(() => createFakeCalendarMatrix(), []);

  return (
    <div className="space-y-6" data-testid="calendar-matrix-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.matrix')}</h3>
      <p className="text-sm">
        {t('calendar.story.generatedConfigurations', { count: matrix.length })}
      </p>
      {matrix.slice(0, 4).map((cal: FakeCalendar) => (
        <div key={cal.id} data-testid={`matrix-${cal.id}`}>
          <p className="mb-1 text-xs font-medium">
            {cal.mode} / {String(cal.numberOfMonths)} month(s)
          </p>
          {cal.mode === 'single' && (
            <Calendar
              mode="single"
              numberOfMonths={cal.numberOfMonths}
              showOutsideDays={cal.showOutsideDays}
            />
          )}
          {cal.mode === 'range' && (
            <Calendar
              mode="range"
              numberOfMonths={cal.numberOfMonths}
              showOutsideDays={cal.showOutsideDays}
            />
          )}
          {cal.mode === 'multiple' && (
            <Calendar
              mode="multiple"
              numberOfMonths={cal.numberOfMonths}
              showOutsideDays={cal.showOutsideDays}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function CalendarConfigDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(() => {
    const defaultCfg = createFakeCalendarConfig('default');
    const bookingCfg = createFakeCalendarConfig('booking');
    const dateRangeCfg = createFakeCalendarConfig('dateRange');
    const multiMonthCfg = createFakeCalendarConfig('multiMonth');
    return {
      booking: bookingCfg,
      dateRange: dateRangeCfg,
      default: defaultCfg,
      multiMonth: multiMonthCfg,
    };
  }, []);

  return (
    <div className="space-y-6" data-testid="calendar-config-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.config')}</h3>
      {Object.entries(configs).map(([scenario, cfg]: [string, FakeCalendarConfig]) => (
        <div key={scenario} className="border-b pb-4" data-testid={`config-${scenario}`}>
          <p className="mb-1 text-sm font-medium">{scenario}</p>
          <p className="text-xs">
            Mode: {cfg.mode} | Months: {String(cfg.numberOfMonths)} | Locale: {cfg.locale}
          </p>
          <Calendar
            captionLayout={
              cfg.captionLayout as 'dropdown' | 'dropdown-months' | 'dropdown-years' | 'label'
            }
            fixedWeeks={cfg.fixedWeeks}
            mode="single"
            numberOfMonths={Math.min(cfg.numberOfMonths, 2)}
            showOutsideDays={cfg.showOutsideDays}
            showWeekNumber={cfg.showWeekNumbers}
            weekStartsOn={cfg.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6}
          />
        </div>
      ))}
    </div>
  );
}

function CalendarPresetsDemo() {
  const { t } = useTranslation();
  const presets = React.useMemo(() => createFakeCalendarPresets(), []);

  return (
    <div className="space-y-4" data-testid="calendar-presets-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.presets')}</h3>
      <div className="space-y-2">
        {Object.entries(presets).map(([name, range]: [string, FakeCalendarDateRange]) => (
          <div
            key={name}
            className="flex items-center gap-2 text-sm"
            data-testid={`preset-item-${name}`}
          >
            <Badge variant="outline">{name}</Badge>
            <span>
              {range.from?.toLocaleDateString()} - {range.to?.toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
      <Calendar mode="range" />
    </div>
  );
}

// ============ FACTORY WIRING: RE-EXPORTED EVENT FUNCTIONS ============

function CalendarEventsAliasDemo() {
  const { t } = useTranslation();
  const event = React.useMemo(() => createFakeCalendarEvent(), []);
  const events = React.useMemo(() => createFakeCalendarEvents(3), []);

  return (
    <div className="space-y-4" data-testid="calendar-events-alias-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.calendarEvents')}</h3>
      <div className="text-sm">
        <p className="font-medium">Single event: {event.title}</p>
        <p className="text-xs">All day: {event.allDay ? 'yes' : 'no'}</p>
      </div>
      <div className="space-y-1">
        {events.map((ev) => (
          <div key={ev.id} className="flex items-center gap-2 text-sm">
            <div className="size-3 rounded-full" style={{ backgroundColor: ev.color }} />
            <span>{ev.title}</span>
          </div>
        ))}
      </div>
      <Calendar mode="single" />
    </div>
  );
}

function CalendarRemindersDemo() {
  const { t } = useTranslation();
  const reminder = React.useMemo(() => createFakeReminder(), []);
  const reminders = React.useMemo(() => createFakeReminders(4), []);

  return (
    <div className="space-y-4" data-testid="calendar-reminders-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.reminders')}</h3>
      <div className="text-sm">
        <p className="font-medium">Single: {reminder.title}</p>
        <p className="text-xs">
          {reminder.date} at {reminder.time} | Repeat: {reminder.repeat}
        </p>
      </div>
      <div className="space-y-1">
        {reminders.map((r: FakeReminder) => (
          <div
            key={r.id}
            className="flex items-center gap-2 text-sm"
            data-testid={`reminder-${r.id}`}
          >
            <Badge variant={r.enabled ? 'default' : 'secondary'}>{r.repeat}</Badge>
            <span>{r.title}</span>
          </div>
        ))}
      </div>
      <Calendar mode="single" />
    </div>
  );
}

function CalendarScheduleSlotsDemo() {
  const { t } = useTranslation();
  const slot = React.useMemo(() => createFakeScheduleSlot(), []);
  const slots = React.useMemo(() => createFakeScheduleSlots(6), []);

  return (
    <div className="space-y-4" data-testid="calendar-schedule-slots-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.scheduleSlots')}</h3>
      <p className="text-sm">
        Single slot: {slot.time} ({String(slot.duration)}min) -{' '}
        {slot.available
          ? i18n.t('calendar.story.available', 'Available')
          : i18n.t('calendar.story.booked', 'Booked')}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((s: FakeScheduleSlot) => (
          <div
            key={s.id}
            className={`rounded border p-2 text-center text-xs ${s.available ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
            data-testid={`slot-${s.id}`}
          >
            {s.time} ({String(s.duration)}m)
          </div>
        ))}
      </div>
      <Calendar mode="single" />
    </div>
  );
}

function getTimelineVariant(status: string): 'default' | 'outline' | 'secondary' {
  if (status === 'completed') return 'default';
  if (status === 'current') return 'secondary';
  return 'outline';
}

function CalendarTimelineDemo() {
  const item = React.useMemo(() => createFakeTimelineItem(), []);
  const timeline = React.useMemo(() => createFakeTimeline(5), []);

  return (
    <div className="space-y-4" data-testid="calendar-timeline-demo">
      <h3 className="text-lg font-semibold">{i18n.t('calendar.factory.timeline')}</h3>
      <p className="text-sm">
        Single item: {item.title} ({item.status})
      </p>
      <div className="space-y-2">
        {timeline.map((ti: FakeTimelineItem) => (
          <div
            key={ti.id}
            className="flex items-center gap-2 text-sm"
            data-testid={`timeline-${ti.id}`}
          >
            <Badge variant={getTimelineVariant(ti.status)}>{ti.status}</Badge>
            <span>{ti.title}</span>
          </div>
        ))}
      </div>
      <Calendar mode="single" />
    </div>
  );
}

function CalendarDateRangeEventDemo() {
  const { t } = useTranslation();
  const range = React.useMemo(() => createFakeDateRange(10), []);

  return (
    <div className="space-y-4" data-testid="calendar-date-range-event-demo">
      <h3 className="text-lg font-semibold">{t('calendar.factory.dateRangeEvent')}</h3>
      <p className="text-sm">
        From: {new Date(range.from).toLocaleDateString()} / To:{' '}
        {new Date(range.to).toLocaleDateString()}
      </p>
      <Calendar mode="range" />
    </div>
  );
}

// Ensure type-only imports are used at the value level for type-checking
// This prevents TS from removing them as unused
const _typeAssertions: {
  captionLayout?: CalendarCaptionLayout;
  config?: FakeCalendarConfig;
  dateRange?: FakeCalendarDateRange;
  disabledDates?: FakeCalendarDisabledDates;
  eventDateRange?: FakeDateRange;
  locale?: FactoryCalendarLocale;
  mode?: CalendarMode;
  navView?: CalendarNavView;
  size?: CalendarSize;
  weekStartsOn?: CalendarWeekStartsOn;
} = {};
void _typeAssertions;

// ============ FACTORY CONSTANT STORIES ============

export const FactoryModes: Story = {
  name: i18n.t('calendar.storyName.factoryModes', 'Factory: Modes'),
  render: () => <CalendarModesDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-modes-demo"]');
    expect(el).toBeInTheDocument();
    for (const mode of CALENDAR_MODES) {
      expect(canvasElement.querySelector(`[data-testid="mode-${mode}"]`)).toBeInTheDocument();
    }
    const calendars = canvasElement.querySelectorAll('[data-slot="calendar"]');
    expect(calendars.length).toBe(3);
  },
};

export const FactoryNavViews: Story = {
  name: i18n.t('calendar.storyName.factoryNavViews', 'Factory: Nav Views'),
  render: () => <CalendarNavViewsDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-nav-views-demo"]');
    expect(el).toBeInTheDocument();
    for (const view of CALENDAR_NAV_VIEWS) {
      expect(canvasElement.querySelector(`[data-testid="nav-view-${view}"]`)).toBeInTheDocument();
    }
  },
};

export const FactoryCaptionLayouts: Story = {
  name: i18n.t('calendar.storyName.factoryCaptionLayouts', 'Factory: Caption Layouts'),
  render: () => <CalendarCaptionLayoutsDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-caption-layouts-demo"]');
    expect(el).toBeInTheDocument();
    for (const layout of CALENDAR_CAPTION_LAYOUTS) {
      expect(canvasElement.querySelector(`[data-testid="caption-${layout}"]`)).toBeInTheDocument();
    }
  },
};

export const FactoryLocales: Story = {
  name: i18n.t('calendar.storyName.factoryLocales', 'Factory: Locales'),
  render: () => <CalendarLocalesDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-locales-demo"]');
    expect(el).toBeInTheDocument();
    for (const locale of CALENDAR_LOCALES) {
      expect(canvasElement.querySelector(`[data-testid="locale-${locale}"]`)).toBeInTheDocument();
    }
  },
};

export const FactoryWeekStarts: Story = {
  name: i18n.t('calendar.storyName.factoryWeekStarts', 'Factory: Week Starts'),
  render: () => <CalendarWeekStartsDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-week-starts-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="week-start-0"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="week-start-1"]')).toBeInTheDocument();
  },
};

export const FactoryMonthCounts: Story = {
  name: i18n.t('calendar.storyName.factoryMonthCounts', 'Factory: Month Counts'),
  render: () => <CalendarMonthCountsDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-month-counts-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="month-count-1"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="month-count-2"]')).toBeInTheDocument();
  },
};

export const FactorySizes: Story = {
  name: i18n.t('calendar.storyName.factorySizes', 'Factory: Sizes'),
  render: () => <CalendarSizesConstDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-sizes-const-demo"]');
    expect(el).toBeInTheDocument();
    for (const size of CALENDAR_SIZES) {
      expect(canvasElement.querySelector(`[data-testid="size-${size}"]`)).toBeInTheDocument();
    }
  },
};

export const FactoryPresetRanges: Story = {
  name: i18n.t('calendar.storyName.factoryPresetRanges', 'Factory: Preset Ranges'),
  render: () => <CalendarPresetRangesDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-preset-ranges-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="preset-today"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="preset-thisWeek"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="preset-lastMonth"]')).toBeInTheDocument();
  },
};

// ============ FACTORY FUNCTION STORIES ============

export const FactoryDateRange: Story = {
  name: i18n.t('calendar.storyName.factoryDateRange', 'Factory: Date Range'),
  render: () => <CalendarDateRangeDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-date-range-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  },
};

export const FactoryDisabledDates: Story = {
  name: i18n.t('calendar.storyName.factoryDisabledDates', 'Factory: Disabled Dates'),
  render: () => <CalendarDisabledDatesDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-disabled-dates-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  },
};

export const FactoryBulkCalendars: Story = {
  name: i18n.t('calendar.storyName.factoryBulkCalendars', 'Factory: Bulk Calendars'),
  render: () => <CalendarBulkDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-bulk-demo"]');
    expect(el).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-testid="calendar-bulk-demo"] .border-b');
    expect(items.length).toBe(3);
  },
};

export const FactorySelectedDates: Story = {
  name: i18n.t('calendar.storyName.factorySelectedDates', 'Factory: Selected Dates'),
  render: () => <CalendarSelectedDatesDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-selected-dates-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  },
};

export const FactorySingleCalendar: Story = {
  name: i18n.t('calendar.storyName.factorySingleCalendar', 'Factory: Single Calendar'),
  render: () => <CalendarSingleFactoryDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-single-factory-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  },
};

export const FactoryRangeCalendar: Story = {
  name: i18n.t('calendar.storyName.factoryRangeCalendar', 'Factory: Range Calendar'),
  render: () => <CalendarRangeFactoryDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-range-factory-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  },
};

export const FactoryMultipleCalendar: Story = {
  name: i18n.t('calendar.storyName.factoryMultipleCalendar', 'Factory: Multiple Calendar'),
  render: () => <CalendarMultipleFactoryDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-multiple-factory-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Selected:/)).toBeInTheDocument();
  },
};

export const FactoryRestrictedCalendar: Story = {
  name: i18n.t('calendar.storyName.factoryRestrictedCalendar', 'Factory: Restricted Calendar'),
  render: () => <CalendarRestrictedDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-restricted-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  },
};

export const FactoryBookingCalendar: Story = {
  name: i18n.t('calendar.storyName.factoryBookingCalendar', 'Factory: Booking Calendar'),
  render: () => <CalendarBookingDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-booking-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  },
};

export const FactoryMultiMonthCalendar: Story = {
  name: i18n.t('calendar.storyName.factoryMultiMonthCalendar', 'Factory: Multi-Month Calendar'),
  render: () => <CalendarMultiMonthDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-multi-month-demo"]');
    expect(el).toBeInTheDocument();
    const tables = canvasElement.querySelectorAll('table');
    expect(tables.length).toBeGreaterThanOrEqual(2);
  },
};

export const FactoryJapaneseCalendar: Story = {
  name: i18n.t('calendar.storyName.factoryJapaneseCalendar', 'Factory: Japanese Calendar'),
  render: () => <CalendarJapaneseFactoryDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-japanese-factory-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  },
};

export const FactoryEuropeanCalendar: Story = {
  name: i18n.t('calendar.storyName.factoryEuropeanCalendar', 'Factory: European Calendar'),
  render: () => <CalendarEuropeanDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-european-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Locale:/)).toBeInTheDocument();
  },
};

export const FactoryYearPicker: Story = {
  name: i18n.t('calendar.storyName.factoryYearPicker', 'Factory: Year Picker'),
  render: () => <CalendarYearPickerDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-year-picker-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  },
};

export const FactoryBirthDate: Story = {
  name: i18n.t('calendar.storyName.factoryBirthDate', 'Factory: Birth Date'),
  render: () => <CalendarBirthDateDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-birth-date-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  },
};

export const FactoryCompactCalendar: Story = {
  name: i18n.t('calendar.storyName.factoryCompactCalendar', 'Factory: Compact Calendar'),
  render: () => <CalendarCompactDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-compact-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  },
};

export const FactoryMatrix: Story = {
  name: i18n.t('calendar.storyName.factoryMatrix', 'Factory: Calendar Matrix'),
  render: () => <CalendarMatrixDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-matrix-demo"]');
    expect(el).toBeInTheDocument();
    const calendars = canvasElement.querySelectorAll('[data-slot="calendar"]');
    expect(calendars.length).toBeGreaterThanOrEqual(2);
  },
};

export const FactoryConfig: Story = {
  name: i18n.t('calendar.storyName.factoryConfig', 'Factory: Calendar Config'),
  render: () => <CalendarConfigDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-config-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="config-default"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="config-booking"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="config-dateRange"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="config-multiMonth"]')).toBeInTheDocument();
  },
};

export const FactoryPresets: Story = {
  name: i18n.t('calendar.storyName.factoryPresets', 'Factory: Calendar Presets'),
  render: () => <CalendarPresetsDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-presets-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="preset-item-today"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="preset-item-thisWeek"]')).toBeInTheDocument();
  },
};

// ============ RE-EXPORTED EVENT FACTORY STORIES ============

export const FactoryCalendarEvents: Story = {
  name: i18n.t('calendar.storyName.factoryCalendarEvents', 'Factory: Calendar Events (Alias)'),
  render: () => <CalendarEventsAliasDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-events-alias-demo"]');
    expect(el).toBeInTheDocument();
    const dots = canvasElement.querySelectorAll('.rounded-full');
    expect(dots.length).toBeGreaterThanOrEqual(3);
  },
};

export const FactoryReminders: Story = {
  name: i18n.t('calendar.storyName.factoryReminders', 'Factory: Reminders'),
  render: () => <CalendarRemindersDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-reminders-demo"]');
    expect(el).toBeInTheDocument();
    const reminders = canvasElement.querySelectorAll('[data-testid^="reminder-"]');
    expect(reminders.length).toBe(4);
  },
};

export const FactoryScheduleSlots: Story = {
  name: i18n.t('calendar.storyName.factoryScheduleSlots', 'Factory: Schedule Slots'),
  render: () => <CalendarScheduleSlotsDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-schedule-slots-demo"]');
    expect(el).toBeInTheDocument();
    const slots = canvasElement.querySelectorAll('[data-testid^="slot-"]');
    expect(slots.length).toBe(6);
  },
};

export const FactoryTimeline: Story = {
  name: i18n.t('calendar.storyName.factoryTimeline', 'Factory: Timeline'),
  render: () => <CalendarTimelineDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-timeline-demo"]');
    expect(el).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-testid^="timeline-"]');
    expect(items.length).toBe(5);
  },
};

export const FactoryDateRangeEvent: Story = {
  name: i18n.t('calendar.storyName.factoryDateRangeEvent', 'Factory: Date Range (Event)'),
  render: () => <CalendarDateRangeEventDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-testid="calendar-date-range-event-demo"]');
    expect(el).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('calendar.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('calendar.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('calendar.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('calendar.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   created
//   notFound
//   noAvailableSlots
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('calendar.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: calendarStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCreated: Story = {
  ...Default,
  name: i18n.t('calendar.storyName.handlerCreated', 'Handler: Created'),
  parameters: { msw: { handlers: calendarStatusHandlers.created } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('calendar.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: calendarStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNoAvailableSlots: Story = {
  ...Default,
  name: i18n.t('calendar.storyName.handlerNoAvailableSlots', 'Handler: No Available Slots'),
  parameters: { msw: { handlers: calendarStatusHandlers.noAvailableSlots } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
