import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// Re-export event-related types for calendar events
export type {
  FakeDateRange,
  FakeEvent,
  FakeReminder,
  FakeScheduleSlot,
  FakeTimelineItem,
} from './event.factory';

export {
  createFakeDateRange,
  createFakeEvent,
  createFakeEvents,
  createFakeReminder,
  createFakeReminders,
  createFakeScheduleSlot,
  createFakeScheduleSlots,
  createFakeTimeline,
  createFakeTimelineItem,
} from './event.factory';

// Calendar-specific aliases for semantic clarity
export {
  createFakeEvent as createFakeCalendarEvent,
  createFakeEvents as createFakeCalendarEvents,
} from './event.factory';

// ============ CALENDAR-SPECIFIC TYPE DEFINITIONS ============

/** Calendar selection mode */
export type CalendarMode = 'multiple' | 'range' | 'single';

/** Calendar navigation view */
export type CalendarNavView = 'days' | 'months' | 'years';

/** Calendar size variant */
export type CalendarSize = 'compact' | 'default' | 'fullWidth';

/** Day of week (0 = Sunday, 6 = Saturday) */
export type CalendarWeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Caption layout type */
export type CalendarCaptionLayout = 'buttons' | 'dropdown-months' | 'dropdown-years' | 'dropdown';

/** Calendar locale */
export type CalendarLocale = 'de' | 'en' | 'es' | 'fr' | 'ja' | 'ko' | 'pt' | 'zh';

/** Interface for fake calendar data */
export interface FakeCalendar {
  /** Caption layout */
  captionLayout?: CalendarCaptionLayout;
  /** Disabled dates */
  disabledDates?: Date[];
  /** Whether to show fixed weeks */
  fixedWeeks?: boolean;
  /** End month constraint */
  fromMonth?: Date;
  /** Unique identifier */
  id: string;
  /** Initial month */
  initialMonth: Date;
  /** Locale */
  locale?: CalendarLocale;
  /** Selection mode */
  mode: CalendarMode;
  /** Number of months to display */
  numberOfMonths: number;
  /** Selected date(s) */
  selectedDates?: Date[];
  /** Whether to show outside days */
  showOutsideDays?: boolean;
  /** Whether to show week numbers */
  showWeekNumbers?: boolean;
  /** Start month constraint */
  toMonth?: Date;
  /** Week starts on */
  weekStartsOn?: CalendarWeekStartsOn;
}

/** Interface for calendar date range */
export interface FakeCalendarDateRange {
  /** End date */
  from?: Date;
  /** Start date */
  to?: Date;
}

/** Interface for calendar configuration */
export interface FakeCalendarConfig {
  /** Caption layout */
  captionLayout: CalendarCaptionLayout;
  /** Whether to show fixed weeks */
  fixedWeeks: boolean;
  /** Locale */
  locale: CalendarLocale;
  /** Selection mode */
  mode: CalendarMode;
  /** Number of months */
  numberOfMonths: number;
  /** Whether to show outside days */
  showOutsideDays: boolean;
  /** Whether to show week numbers */
  showWeekNumbers: boolean;
  /** Week starts on */
  weekStartsOn: CalendarWeekStartsOn;
}

/** Interface for calendar disabled dates */
export interface FakeCalendarDisabledDates {
  /** After this date */
  after?: Date;
  /** Before this date */
  before?: Date;
  /** Range of disabled dates */
  ranges?: Array<{ from: Date; to: Date }>;
  /** Specific disabled dates */
  specific?: Date[];
  /** Disabled weekdays (0-6) */
  weekdays?: number[];
}

// ============ CONSTANTS FOR ITERATION ============

/** All calendar mode options */
export const CALENDAR_MODES: CalendarMode[] = ['single', 'multiple', 'range'];

/** All calendar nav view options */
export const CALENDAR_NAV_VIEWS: CalendarNavView[] = ['days', 'months', 'years'];

/** All calendar size options */
export const CALENDAR_SIZES: CalendarSize[] = ['compact', 'default', 'fullWidth'];

/** All calendar caption layout options */
export const CALENDAR_CAPTION_LAYOUTS: CalendarCaptionLayout[] = [
  'buttons',
  'dropdown',
  'dropdown-months',
  'dropdown-years',
];

/** All supported locales */
export const CALENDAR_LOCALES: CalendarLocale[] = ['de', 'en', 'es', 'fr', 'ja', 'ko', 'pt', 'zh'];

/** Week start options with labels */
export const CALENDAR_WEEK_STARTS = [
  { label: i18n.t('factory.calendar.sunday', 'Sunday'), value: 0 as CalendarWeekStartsOn },
  { label: i18n.t('factory.calendar.monday', 'Monday'), value: 1 as CalendarWeekStartsOn },
  { label: i18n.t('factory.calendar.tuesday', 'Tuesday'), value: 2 as CalendarWeekStartsOn },
  { label: i18n.t('factory.calendar.wednesday', 'Wednesday'), value: 3 as CalendarWeekStartsOn },
  { label: i18n.t('factory.calendar.thursday', 'Thursday'), value: 4 as CalendarWeekStartsOn },
  { label: i18n.t('factory.calendar.friday', 'Friday'), value: 5 as CalendarWeekStartsOn },
  { label: i18n.t('factory.calendar.saturday', 'Saturday'), value: 6 as CalendarWeekStartsOn },
];

/** Common number of months configurations */
export const CALENDAR_MONTH_COUNTS = [1, 2, 3, 6, 12];

/** Preset date ranges */
export const CALENDAR_PRESET_RANGES = {
  lastMonth: () => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: new Date(now.getFullYear(), now.getMonth(), 0),
    };
  },
  lastWeek: () => {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from: lastWeek, to: now };
  },
  lastYear: () => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear() - 1, 0, 1),
      to: new Date(now.getFullYear() - 1, 11, 31),
    };
  },
  nextMonth: () => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      to: new Date(now.getFullYear(), now.getMonth() + 2, 0),
    };
  },
  nextWeek: () => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { from: now, to: nextWeek };
  },
  thisMonth: () => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  },
  thisWeek: () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return { from: startOfWeek, to: endOfWeek };
  },
  thisYear: () => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), 0, 1),
      to: new Date(now.getFullYear(), 11, 31),
    };
  },
  today: () => {
    const now = new Date();
    return { from: now, to: now };
  },
};

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake calendar configuration
 * @param overrides - Optional partial overrides
 * @returns A fake calendar
 */
export function createFakeCalendar(overrides?: Partial<FakeCalendar>): FakeCalendar {
  return {
    id: faker.string.uuid(),
    mode: faker.helpers.arrayElement(CALENDAR_MODES),
    numberOfMonths: faker.helpers.arrayElement([1, 1, 1, 2]), // Weighted towards 1
    initialMonth: faker.date.recent({ days: 30 }),
    showOutsideDays: faker.helpers.maybe(() => true, { probability: 0.7 }),
    showWeekNumbers: faker.helpers.maybe(() => true, { probability: 0.2 }),
    fixedWeeks: faker.helpers.maybe(() => true, { probability: 0.3 }),
    weekStartsOn: faker.helpers.maybe(
      () => faker.helpers.arrayElement([0, 1] as CalendarWeekStartsOn[]),
      { probability: 0.5 }
    ),
    locale: faker.helpers.maybe(() => faker.helpers.arrayElement(CALENDAR_LOCALES), {
      probability: 0.3,
    }),
    captionLayout: faker.helpers.maybe(() => faker.helpers.arrayElement(CALENDAR_CAPTION_LAYOUTS), {
      probability: 0.2,
    }),
    ...overrides,
  };
}

/**
 * Creates a calendar date range
 * @param daysSpan - Number of days in range
 * @returns A date range
 */
export function createFakeCalendarDateRange(daysSpan = 7): FakeCalendarDateRange {
  const from = faker.date.recent({ days: 30 });
  const to = new Date(from.getTime() + daysSpan * 24 * 60 * 60 * 1000);
  return { from, to };
}

/**
 * Creates disabled dates configuration
 * @returns Disabled dates config
 */
export function createFakeCalendarDisabledDates(): FakeCalendarDisabledDates {
  const now = new Date();
  return {
    before: faker.helpers.maybe(() => new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), {
      probability: 0.3,
    }),
    after: faker.helpers.maybe(() => new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), {
      probability: 0.3,
    }),
    specific: faker.helpers.maybe(
      () =>
        Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, () =>
          faker.date.soon({ days: 30 })
        ),
      { probability: 0.4 }
    ),
    weekdays: faker.helpers.maybe(() => [0, 6], { probability: 0.2 }), // Weekends
    ranges: faker.helpers.maybe(
      () => [
        {
          from: faker.date.soon({ days: 10 }),
          to: faker.date.soon({ days: 15 }),
        },
      ],
      { probability: 0.2 }
    ),
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple calendar configurations
 * @param count - Number of calendars to generate
 * @returns Array of fake calendars
 */
export function createFakeCalendars(count: number): FakeCalendar[] {
  return Array.from({ length: count }, () => createFakeCalendar());
}

/**
 * Creates selected dates for multiple selection mode
 * @param count - Number of dates to select
 * @returns Array of selected dates
 */
export function createFakeSelectedDates(count: number): Date[] {
  return Array.from({ length: count }, () => faker.date.soon({ days: 30 }));
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a single selection calendar
 * @returns A single mode calendar
 */
export function createFakeSingleCalendar(): FakeCalendar {
  return createFakeCalendar({
    mode: 'single',
    numberOfMonths: 1,
    selectedDates: [faker.date.recent({ days: 7 })],
  });
}

/**
 * Creates a range selection calendar
 * @param daysSpan - Range span in days
 * @returns A range mode calendar
 */
export function createFakeRangeCalendar(daysSpan = 7): FakeCalendar {
  const range = createFakeCalendarDateRange(daysSpan);
  return createFakeCalendar({
    mode: 'range',
    numberOfMonths: 2,
    selectedDates: range.from && range.to ? [range.from, range.to] : undefined,
  });
}

/**
 * Creates a multiple selection calendar
 * @param selectedCount - Number of selected dates
 * @returns A multiple mode calendar
 */
export function createFakeMultipleCalendar(selectedCount = 5): FakeCalendar {
  return createFakeCalendar({
    mode: 'multiple',
    numberOfMonths: 1,
    selectedDates: createFakeSelectedDates(selectedCount),
  });
}

/**
 * Creates a date picker with restrictions
 * @returns A restricted calendar
 */
export function createFakeRestrictedCalendar(): FakeCalendar {
  const now = new Date();
  return createFakeCalendar({
    mode: 'single',
    fromMonth: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    toMonth: new Date(now.getFullYear(), now.getMonth() + 3, 0),
    disabledDates: createFakeCalendarDisabledDates().specific,
  });
}

/**
 * Creates a booking calendar (no past dates, weekends disabled)
 * @returns A booking-style calendar
 */
export function createFakeBookingCalendar(): FakeCalendar {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Generate disabled weekends for next 3 months
  const disabledDates: Date[] = [];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);
  const current = new Date(now);

  while (current <= endDate) {
    if (current.getDay() === 0 || current.getDay() === 6) {
      disabledDates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return createFakeCalendar({
    mode: 'single',
    numberOfMonths: 1,
    fromMonth: now,
    toMonth: endDate,
    disabledDates,
    showOutsideDays: false,
  });
}

/**
 * Creates a multi-month calendar
 * @param monthCount - Number of months
 * @returns A multi-month calendar
 */
export function createFakeMultiMonthCalendar(monthCount = 2): FakeCalendar {
  return createFakeCalendar({
    mode: 'range',
    numberOfMonths: monthCount,
    showOutsideDays: true,
    fixedWeeks: true,
  });
}

/**
 * Creates a Japanese locale calendar
 * @returns A Japanese calendar
 */
export function createFakeJapaneseCalendar(): FakeCalendar {
  return createFakeCalendar({
    mode: 'single',
    locale: 'ja',
    weekStartsOn: 0, // Sunday in Japan
  });
}

/**
 * Creates a European calendar (Monday start)
 * @returns A European-style calendar
 */
export function createFakeEuropeanCalendar(): FakeCalendar {
  return createFakeCalendar({
    mode: 'single',
    locale: faker.helpers.arrayElement(['de', 'fr', 'es']),
    weekStartsOn: 1, // Monday
    showWeekNumbers: true,
  });
}

/**
 * Creates a year picker calendar
 * @returns A year selection calendar
 */
export function createFakeYearPickerCalendar(): FakeCalendar {
  return createFakeCalendar({
    mode: 'single',
    captionLayout: 'dropdown-years',
    fromMonth: new Date(2000, 0, 1),
    toMonth: new Date(2030, 11, 31),
  });
}

/**
 * Creates a birth date picker calendar
 * @returns A birth date calendar (past dates only)
 */
export function createFakeBirthDateCalendar(): FakeCalendar {
  const now = new Date();
  return createFakeCalendar({
    mode: 'single',
    captionLayout: 'dropdown',
    fromMonth: new Date(1900, 0, 1),
    toMonth: now,
    initialMonth: new Date(1990, 0, 1),
  });
}

/**
 * Creates a compact calendar
 * @returns A compact calendar configuration
 */
export function createFakeCompactCalendar(): FakeCalendar {
  return createFakeCalendar({
    mode: 'single',
    numberOfMonths: 1,
    showOutsideDays: false,
    fixedWeeks: false,
  });
}

// ============ MATRIX FACTORY ============

/**
 * Creates a matrix of calendars for visual regression testing
 * across all mode and size combinations
 * @returns Array of calendars with different configurations
 */
export function createFakeCalendarMatrix(): FakeCalendar[] {
  const matrix: FakeCalendar[] = [];

  for (const mode of CALENDAR_MODES) {
    for (const numberOfMonths of [1, 2]) {
      matrix.push({
        id: `${mode}-${numberOfMonths}`,
        mode,
        numberOfMonths,
        initialMonth: new Date(2024, 0, 1),
        showOutsideDays: true,
      });
    }
  }

  return matrix;
}

/**
 * Creates calendar configuration for different scenarios
 * @param scenario - Scenario name
 * @returns Calendar configuration
 */
export function createFakeCalendarConfig(
  scenario: 'booking' | 'dateRange' | 'default' | 'multiMonth' = 'default'
): FakeCalendarConfig {
  const configs: Record<string, FakeCalendarConfig> = {
    booking: {
      mode: 'single',
      numberOfMonths: 1,
      showOutsideDays: false,
      showWeekNumbers: false,
      fixedWeeks: false,
      weekStartsOn: 1,
      locale: 'en',
      captionLayout: 'buttons',
    },
    dateRange: {
      mode: 'range',
      numberOfMonths: 2,
      showOutsideDays: true,
      showWeekNumbers: false,
      fixedWeeks: true,
      weekStartsOn: 0,
      locale: 'en',
      captionLayout: 'buttons',
    },
    default: {
      mode: 'single',
      numberOfMonths: 1,
      showOutsideDays: true,
      showWeekNumbers: false,
      fixedWeeks: false,
      weekStartsOn: 0,
      locale: 'en',
      captionLayout: 'buttons',
    },
    multiMonth: {
      mode: 'range',
      numberOfMonths: 3,
      showOutsideDays: true,
      showWeekNumbers: true,
      fixedWeeks: true,
      weekStartsOn: 1,
      locale: 'en',
      captionLayout: 'dropdown',
    },
  };

  return configs[scenario];
}

/**
 * Creates preset date range options for quick selection
 * @returns Object with preset date ranges
 */
export function createFakeCalendarPresets(): Record<string, FakeCalendarDateRange> {
  return {
    lastMonth: CALENDAR_PRESET_RANGES.lastMonth(),
    lastWeek: CALENDAR_PRESET_RANGES.lastWeek(),
    nextMonth: CALENDAR_PRESET_RANGES.nextMonth(),
    nextWeek: CALENDAR_PRESET_RANGES.nextWeek(),
    thisMonth: CALENDAR_PRESET_RANGES.thisMonth(),
    thisWeek: CALENDAR_PRESET_RANGES.thisWeek(),
    today: CALENDAR_PRESET_RANGES.today(),
  };
}
