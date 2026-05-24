import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Time period (AM/PM)
 */
export type TimePeriod = 'AM' | 'PM';

/**
 * Date time picker state
 */
export type DateTimePickerState = 'disabled' | 'error' | 'idle' | 'loading' | 'open';

/**
 * Display format type
 */
export type DisplayFormat = '12-hour' | '24-hour' | 'iso' | 'localized';

/**
 * Time granularity
 */
export type TimeGranularity = 'hour' | 'minute' | 'second';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Time periods
 */
export const TIME_PERIODS: TimePeriod[] = ['AM', 'PM'];

/**
 * Date time picker states
 */
export const DATE_TIME_PICKER_STATES: DateTimePickerState[] = [
  'disabled',
  'error',
  'idle',
  'loading',
  'open',
];

/**
 * Display formats
 */
export const DISPLAY_FORMATS: DisplayFormat[] = ['12-hour', '24-hour', 'iso', 'localized'];

/**
 * Time granularities
 */
export const TIME_GRANULARITIES: TimeGranularity[] = ['hour', 'minute', 'second'];

/**
 * Hours (1-12 for 12-hour format)
 */
export const HOURS_12: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Hours (0-23 for 24-hour format)
 */
export const HOURS_24: number[] = Array.from({ length: 24 }, (_, i) => i);

/**
 * Minutes (0-59)
 */
export const MINUTES: number[] = Array.from({ length: 60 }, (_, i) => i);

/**
 * Common minute intervals
 */
export const MINUTE_INTERVALS = [1, 5, 10, 15, 30];

/**
 * Format strings for date-fns
 */
export const FORMAT_STRINGS: Record<DisplayFormat, string> = {
  '12-hour': 'MM/dd/yyyy hh:mm aa',
  '24-hour': 'MM/dd/yyyy HH:mm',
  iso: "yyyy-MM-dd'T'HH:mm:ss",
  localized: 'PPpp',
};

/**
 * Placeholder strings
 */
export const PLACEHOLDER_STRINGS: Record<DisplayFormat, string> = {
  '12-hour': 'MM/DD/YYYY hh:mm aa',
  '24-hour': 'MM/DD/YYYY HH:mm',
  iso: 'YYYY-MM-DDTHH:mm:ss',
  localized: i18n.t('factory.dateTimePicker.selectDateAndTime', 'Select date and time'),
};

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Time value
 */
export interface FakeTimeValue {
  hour: number;
  minute: number;
  period?: TimePeriod;
  second?: number;
}

/**
 * Date time value
 */
export interface FakeDateTimeValue {
  date: Date;
  formatted: string;
  time: FakeTimeValue;
}

/**
 * Date time picker labels for i18n
 */
export interface FakeDateTimePickerLabels {
  amLabel: string;
  hourLabel: string;
  minuteLabel: string;
  placeholder: string;
  pmLabel: string;
  secondLabel?: string;
}

/**
 * Date time picker configuration
 */
export interface FakeDateTimePicker {
  dateTime: Date | undefined;
  defaultOpen: boolean;
  displayFormat: string;
  id: string;
  labels: FakeDateTimePickerLabels;
  minuteInterval: number;
  placeholder: string;
  showSeconds: boolean;
  state: DateTimePickerState;
  use24Hour: boolean;
}

/**
 * Date time selection event
 */
export interface FakeDateTimeSelection {
  dateTime: Date;
  id: string;
  previousDateTime?: Date;
  timestamp: Date;
}

/**
 * Date time validation result
 */
export interface FakeDateTimeValidation {
  dateTime: Date;
  errors: string[];
  isValid: boolean;
  maxDateTime?: Date;
  minDateTime?: Date;
}

/**
 * Time slot for scheduling
 */
export interface FakeTimeSlot {
  available: boolean;
  endTime: string;
  label: string;
  startTime: string;
}

/**
 * Date time picker showcase
 */
export interface FakeDateTimePickerShowcase {
  pickers: FakeDateTimePicker[];
  selections: FakeDateTimeSelection[];
  timeSlots: FakeTimeSlot[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert 24-hour to 12-hour format
 */
function to12Hour(hour24: number): { hour: number; period: TimePeriod } {
  const period: TimePeriod = hour24 >= 12 ? 'PM' : 'AM';
  let hour = hour24 % 12;
  if (hour === 0) hour = 12;
  return { hour, period };
}

/**
 * Format time for display
 */
function formatTime(hour: number, minute: number, use24Hour: boolean): string {
  if (use24Hour) {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
  const { hour: h12, period } = to12Hour(hour);
  return `${h12}:${minute.toString().padStart(2, '0')} ${period}`;
}

// =============================================================================
// FACTORY FUNCTIONS - Labels
// =============================================================================

/**
 * Create date time picker labels in English
 */
export function createFakeDateTimePickerLabelsEn(): FakeDateTimePickerLabels {
  return {
    amLabel: i18n.t('factory.dateTimePicker.am', 'AM'),
    hourLabel: i18n.t('factory.dateTimePicker.hour', 'Hour'),
    minuteLabel: i18n.t('factory.dateTimePicker.minute', 'Minute'),
    placeholder: i18n.t('factory.dateTimePicker.selectDateAndTime', 'Select date and time'),
    pmLabel: i18n.t('factory.dateTimePicker.pm', 'PM'),
    secondLabel: i18n.t('factory.dateTimePicker.second', 'Second'),
  };
}

/**
 * Create date time picker labels in Japanese
 */
export function createFakeDateTimePickerLabelsJa(): FakeDateTimePickerLabels {
  return {
    amLabel: '午前',
    hourLabel: '時',
    minuteLabel: '分',
    placeholder: '日時を選択',
    pmLabel: '午後',
    secondLabel: '秒',
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Time Value
// =============================================================================

/**
 * Create a fake time value
 */
export function createFakeTimeValue(overrides?: Partial<FakeTimeValue>): FakeTimeValue {
  const hour = overrides?.hour ?? faker.number.int({ max: 23, min: 0 });
  const { hour: h12, period } = to12Hour(hour);

  return {
    hour: h12,
    minute: overrides?.minute ?? faker.number.int({ max: 59, min: 0 }),
    period,
    second: overrides?.second,
    ...overrides,
  };
}

/**
 * Create multiple time values
 */
export function createFakeTimeValues(count: number): FakeTimeValue[] {
  return Array.from({ length: count }, () => createFakeTimeValue());
}

// =============================================================================
// FACTORY FUNCTIONS - Date Time Value
// =============================================================================

/**
 * Create a fake date time value
 */
export function createFakeDateTimeValue(overrides?: Partial<FakeDateTimeValue>): FakeDateTimeValue {
  const date = overrides?.date ?? faker.date.soon({ days: 30 });
  const time =
    overrides?.time ??
    createFakeTimeValue({
      hour: date.getHours(),
      minute: date.getMinutes(),
    });

  return {
    date,
    formatted: date.toISOString(),
    time,
    ...overrides,
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Date Time Picker
// =============================================================================

/**
 * Create a fake date time picker configuration
 */
export function createFakeDateTimePicker(
  overrides?: Partial<FakeDateTimePicker>
): FakeDateTimePicker {
  const state = overrides?.state ?? faker.helpers.arrayElement(DATE_TIME_PICKER_STATES);
  const use24Hour = overrides?.use24Hour ?? faker.datatype.boolean({ probability: 0.3 });
  const displayFormat = use24Hour ? FORMAT_STRINGS['24-hour'] : FORMAT_STRINGS['12-hour'];

  return {
    dateTime: state === 'idle' ? faker.date.soon({ days: 30 }) : undefined,
    defaultOpen: faker.datatype.boolean({ probability: 0.2 }),
    displayFormat,
    id: faker.string.uuid(),
    labels: createFakeDateTimePickerLabelsEn(),
    minuteInterval: faker.helpers.arrayElement(MINUTE_INTERVALS),
    placeholder: use24Hour ? PLACEHOLDER_STRINGS['24-hour'] : PLACEHOLDER_STRINGS['12-hour'],
    showSeconds: faker.datatype.boolean({ probability: 0.1 }),
    state,
    use24Hour,
    ...overrides,
  };
}

/**
 * Create multiple date time pickers
 */
export function createFakeDateTimePickers(count: number): FakeDateTimePicker[] {
  return Array.from({ length: count }, () => createFakeDateTimePicker());
}

/**
 * Create a date time picker in open state
 */
export function createFakeDateTimePickerOpen(): FakeDateTimePicker {
  return createFakeDateTimePicker({ defaultOpen: true, state: 'open' });
}

/**
 * Create a date time picker in loading state
 */
export function createFakeDateTimePickerLoading(): FakeDateTimePicker {
  return createFakeDateTimePicker({ state: 'loading' });
}

/**
 * Create a date time picker in error state
 */
export function createFakeDateTimePickerError(): FakeDateTimePicker {
  return createFakeDateTimePicker({ state: 'error' });
}

/**
 * Create a date time picker in disabled state
 */
export function createFakeDateTimePickerDisabled(): FakeDateTimePicker {
  return createFakeDateTimePicker({ state: 'disabled' });
}

/**
 * Create a date time picker with no selection
 */
export function createFakeDateTimePickerEmpty(): FakeDateTimePicker {
  return createFakeDateTimePicker({ dateTime: undefined });
}

/**
 * Create a 24-hour format date time picker
 */
export function createFakeDateTimePicker24Hour(): FakeDateTimePicker {
  return createFakeDateTimePicker({
    displayFormat: FORMAT_STRINGS['24-hour'],
    placeholder: PLACEHOLDER_STRINGS['24-hour'],
    use24Hour: true,
  });
}

/**
 * Create a date time picker with seconds
 */
export function createFakeDateTimePickerWithSeconds(): FakeDateTimePicker {
  return createFakeDateTimePicker({ showSeconds: true });
}

// =============================================================================
// FACTORY FUNCTIONS - Date Time Selection
// =============================================================================

/**
 * Create a fake date time selection event
 */
export function createFakeDateTimeSelection(
  overrides?: Partial<FakeDateTimeSelection>
): FakeDateTimeSelection {
  return {
    dateTime: faker.date.soon({ days: 30 }),
    id: faker.string.uuid(),
    previousDateTime: faker.helpers.maybe(() => faker.date.recent({ days: 7 }), {
      probability: 0.5,
    }),
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Create multiple date time selections
 */
export function createFakeDateTimeSelections(count: number): FakeDateTimeSelection[] {
  return Array.from({ length: count }, () => createFakeDateTimeSelection());
}

// =============================================================================
// FACTORY FUNCTIONS - Date Time Validation
// =============================================================================

/**
 * Create a fake date time validation result
 */
export function createFakeDateTimeValidation(
  overrides?: Partial<FakeDateTimeValidation>
): FakeDateTimeValidation {
  const isValid = overrides?.isValid ?? faker.datatype.boolean({ probability: 0.9 });

  return {
    dateTime: faker.date.soon({ days: 30 }),
    errors: isValid
      ? []
      : [
          faker.helpers.arrayElement([
            i18n.t(
              'factory.dateTimePicker.selectedTimeIsNotAvailable',
              'Selected time is not available'
            ),
            i18n.t('factory.dateTimePicker.dateCannotBeInThe', 'Date cannot be in the past'),
            i18n.t(
              'factory.dateTimePicker.timeIsOutsideBusinessHours',
              'Time is outside business hours'
            ),
            i18n.t('factory.dateTimePicker.invalidDatetimeFormat', 'Invalid date/time format'),
          ]),
        ],
    isValid,
    maxDateTime: faker.helpers.maybe(() => faker.date.future({ years: 1 }), { probability: 0.3 }),
    minDateTime: faker.helpers.maybe(() => faker.date.recent({ days: 1 }), { probability: 0.3 }),
    ...overrides,
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Time Slots
// =============================================================================

/**
 * Create a fake time slot
 */
export function createFakeTimeSlot(overrides?: Partial<FakeTimeSlot>): FakeTimeSlot {
  const hour = faker.number.int({ max: 17, min: 9 });
  const available = overrides?.available ?? faker.datatype.boolean({ probability: 0.7 });

  return {
    available,
    endTime: formatTime(hour + 1, 0, false),
    label: `${formatTime(hour, 0, false)} - ${formatTime(hour + 1, 0, false)}`,
    startTime: formatTime(hour, 0, false),
    ...overrides,
  };
}

/**
 * Create time slots for a day
 */
export function createFakeTimeSlotsForDay(
  startHour: number = 9,
  endHour: number = 17
): FakeTimeSlot[] {
  return Array.from({ length: endHour - startHour }, (_, i) => {
    const hour = startHour + i;
    return createFakeTimeSlot({
      endTime: formatTime(hour + 1, 0, false),
      label: `${formatTime(hour, 0, false)} - ${formatTime(hour + 1, 0, false)}`,
      startTime: formatTime(hour, 0, false),
    });
  });
}

// =============================================================================
// FACTORY FUNCTIONS - Showcase
// =============================================================================

/**
 * Create a comprehensive date time picker showcase
 */
export function createFakeDateTimePickerShowcase(): FakeDateTimePickerShowcase {
  return {
    pickers: [
      createFakeDateTimePicker({ state: 'idle' }),
      createFakeDateTimePickerOpen(),
      createFakeDateTimePickerEmpty(),
      createFakeDateTimePicker24Hour(),
      createFakeDateTimePickerWithSeconds(),
      createFakeDateTimePickerLoading(),
      createFakeDateTimePickerDisabled(),
    ],
    selections: createFakeDateTimeSelections(5),
    timeSlots: createFakeTimeSlotsForDay(),
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Specific Use Cases
// =============================================================================

/**
 * Create a date time picker for appointments
 */
export function createFakeAppointmentPicker(): FakeDateTimePicker {
  return createFakeDateTimePicker({
    labels: {
      ...createFakeDateTimePickerLabelsEn(),
      placeholder: i18n.t(
        'factory.dateTimePicker.selectAppointmentTime',
        'Select appointment time'
      ),
    },
    minuteInterval: 15,
    use24Hour: false,
  });
}

/**
 * Create a date time picker for meetings
 */
export function createFakeMeetingPicker(): FakeDateTimePicker {
  return createFakeDateTimePicker({
    labels: {
      ...createFakeDateTimePickerLabelsEn(),
      placeholder: i18n.t('factory.dateTimePicker.selectMeetingTime', 'Select meeting time'),
    },
    minuteInterval: 30,
    use24Hour: false,
  });
}

/**
 * Create a date time picker for deadlines
 */
export function createFakeDeadlinePicker(): FakeDateTimePicker {
  return createFakeDateTimePicker({
    labels: {
      ...createFakeDateTimePickerLabelsEn(),
      placeholder: i18n.t('factory.dateTimePicker.setDeadline', 'Set deadline'),
    },
    minuteInterval: 1,
    showSeconds: false,
    use24Hour: true,
  });
}

/**
 * Create a date time picker for scheduling
 */
export function createFakeSchedulingPicker(): FakeDateTimePicker {
  return createFakeDateTimePicker({
    labels: {
      ...createFakeDateTimePickerLabelsEn(),
      placeholder: i18n.t('factory.dateTimePicker.scheduleFor', 'Schedule for'),
    },
    minuteInterval: 15,
    use24Hour: false,
  });
}
