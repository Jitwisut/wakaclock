import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Preset key type for date range presets
 */
export type PresetKey =
  | 'custom'
  | 'last28Days'
  | 'last7Days'
  | 'lastMonth'
  | 'thisMonth'
  | 'thisWeek'
  | 'thisYear'
  | 'today'
  | 'yesterday';

/**
 * Date range picker state
 */
export type DateRangePickerState = 'disabled' | 'error' | 'idle' | 'loading' | 'open';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * All preset keys
 */
export const PRESET_KEYS: PresetKey[] = [
  'custom',
  'last28Days',
  'last7Days',
  'lastMonth',
  'thisMonth',
  'thisWeek',
  'thisYear',
  'today',
  'yesterday',
];

/**
 * Date range picker states
 */
export const DATE_RANGE_PICKER_STATES: DateRangePickerState[] = [
  'disabled',
  'error',
  'idle',
  'loading',
  'open',
];

/**
 * Preset labels in English
 */
export const PRESET_LABELS_EN: Record<PresetKey, string> = {
  custom: i18n.t('factory.dateRangePicker.customRange', 'Custom Range'),
  last28Days: i18n.t('factory.dateRangePicker.last28Days', 'Last 28 Days'),
  last7Days: i18n.t('factory.dateRangePicker.last7Days', 'Last 7 Days'),
  lastMonth: i18n.t('factory.dateRangePicker.lastMonth', 'Last Month'),
  thisMonth: i18n.t('factory.dateRangePicker.thisMonth', 'This Month'),
  thisWeek: i18n.t('factory.dateRangePicker.thisWeek', 'This Week'),
  thisYear: i18n.t('factory.dateRangePicker.thisYear', 'This Year'),
  today: i18n.t('factory.dateRangePicker.today', 'Today'),
  yesterday: i18n.t('factory.dateRangePicker.yesterday', 'Yesterday'),
};

/**
 * Preset labels in Japanese
 */
export const PRESET_LABELS_JA: Record<PresetKey, string> = {
  custom: 'カスタム範囲',
  last28Days: '過去28日間',
  last7Days: '過去7日間',
  lastMonth: '先月',
  thisMonth: '今月',
  thisWeek: '今週',
  thisYear: '今年',
  today: '今日',
  yesterday: '昨日',
};

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Date range object
 */
export interface FakeDateRange {
  from: Date;
  to: Date;
}

/**
 * Date range picker labels for i18n
 */
export interface FakeDateRangePickerLabels {
  placeholder: string;
  presets: Record<PresetKey, string>;
  selectAriaLabel: string;
  selectPlaceholder: string;
}

/**
 * Date range picker configuration
 */
export interface FakeDateRangePicker {
  dateRange: FakeDateRange | null;
  defaultOpen: boolean;
  defaultPreset: PresetKey;
  id: string;
  labels: FakeDateRangePickerLabels;
  state: DateRangePickerState;
}

/**
 * Date range preset definition
 */
export interface FakeDateRangePreset {
  dateRange: FakeDateRange;
  description?: string;
  key: PresetKey;
  label: string;
}

/**
 * Date range selection event
 */
export interface FakeDateRangeSelection {
  dateRange: FakeDateRange;
  id: string;
  preset: null | PresetKey;
  timestamp: Date;
}

/**
 * Date range validation result
 */
export interface FakeDateRangeValidation {
  errors: string[];
  isValid: boolean;
  maxDate?: Date;
  minDate?: Date;
  range: FakeDateRange;
}

/**
 * Date range picker showcase
 */
export interface FakeDateRangePickerShowcase {
  pickers: FakeDateRangePicker[];
  presets: FakeDateRangePreset[];
  selections: FakeDateRangeSelection[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get date range for a preset key
 */
function getDateRangeForPreset(preset: PresetKey, now: Date = new Date()): FakeDateRange {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'today': {
      return { from: today, to: today };
    }
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: yesterday, to: yesterday };
    }
    case 'thisWeek': {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      return { from: weekStart, to: today };
    }
    case 'last7Days': {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 6);
      return { from: weekAgo, to: today };
    }
    case 'last28Days': {
      const monthAgo = new Date(today);
      monthAgo.setDate(today.getDate() - 27);
      return { from: monthAgo, to: today };
    }
    case 'thisMonth': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: monthStart, to: today };
    }
    case 'lastMonth': {
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: lastMonthStart, to: lastMonthEnd };
    }
    case 'thisYear': {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return { from: yearStart, to: today };
    }
    default: {
      const customStart = new Date(today);
      customStart.setDate(today.getDate() - faker.number.int({ max: 90, min: 1 }));
      return { from: customStart, to: today };
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS - Labels
// =============================================================================

/**
 * Create date range picker labels in English
 */
export function createFakeDateRangePickerLabelsEn(): FakeDateRangePickerLabels {
  return {
    placeholder: i18n.t('factory.dateRangePicker.selectDateRange', 'Select date range'),
    presets: PRESET_LABELS_EN,
    selectAriaLabel: i18n.t(
      'factory.dateRangePicker.selectADateRangePreset',
      'Select a date range preset'
    ),
    selectPlaceholder: i18n.t('factory.dateRangePicker.pickADate', 'Pick a date'),
  };
}

/**
 * Create date range picker labels in Japanese
 */
export function createFakeDateRangePickerLabelsJa(): FakeDateRangePickerLabels {
  return {
    placeholder: '日付範囲を選択',
    presets: PRESET_LABELS_JA,
    selectAriaLabel: '日付範囲プリセットを選択',
    selectPlaceholder: '日付を選択',
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Date Range
// =============================================================================

/**
 * Create a fake date range
 */
export function createFakeDateRange(overrides?: Partial<FakeDateRange>): FakeDateRange {
  const from = overrides?.from ?? faker.date.recent({ days: 30 });
  const to = overrides?.to ?? faker.date.between({ from, to: new Date() });

  return { from, to };
}

/**
 * Create multiple date ranges
 */
export function createFakeDateRanges(count: number): FakeDateRange[] {
  return Array.from({ length: count }, () => createFakeDateRange());
}

/**
 * Create a date range for a specific preset
 */
export function createFakeDateRangeForPreset(preset: PresetKey, now?: Date): FakeDateRange {
  return getDateRangeForPreset(preset, now);
}

// =============================================================================
// FACTORY FUNCTIONS - Date Range Picker
// =============================================================================

/**
 * Create a fake date range picker configuration
 */
export function createFakeDateRangePicker(
  overrides?: Partial<FakeDateRangePicker>
): FakeDateRangePicker {
  const defaultPreset =
    overrides?.defaultPreset ??
    faker.helpers.arrayElement(PRESET_KEYS.filter((k) => k !== 'custom'));
  const state = overrides?.state ?? faker.helpers.arrayElement(DATE_RANGE_PICKER_STATES);

  return {
    dateRange: state === 'idle' ? getDateRangeForPreset(defaultPreset) : null,
    defaultOpen: faker.datatype.boolean({ probability: 0.2 }),
    defaultPreset,
    id: faker.string.uuid(),
    labels: createFakeDateRangePickerLabelsEn(),
    state,
    ...overrides,
  };
}

/**
 * Create multiple date range pickers
 */
export function createFakeDateRangePickers(count: number): FakeDateRangePicker[] {
  return Array.from({ length: count }, () => createFakeDateRangePicker());
}

/**
 * Create a date range picker in open state
 */
export function createFakeDateRangePickerOpen(): FakeDateRangePicker {
  return createFakeDateRangePicker({ defaultOpen: true, state: 'open' });
}

/**
 * Create a date range picker in loading state
 */
export function createFakeDateRangePickerLoading(): FakeDateRangePicker {
  return createFakeDateRangePicker({ state: 'loading' });
}

/**
 * Create a date range picker in error state
 */
export function createFakeDateRangePickerError(): FakeDateRangePicker {
  return createFakeDateRangePicker({ state: 'error' });
}

/**
 * Create a date range picker in disabled state
 */
export function createFakeDateRangePickerDisabled(): FakeDateRangePicker {
  return createFakeDateRangePicker({ state: 'disabled' });
}

/**
 * Create a date range picker with no selection
 */
export function createFakeDateRangePickerEmpty(): FakeDateRangePicker {
  return createFakeDateRangePicker({ dateRange: null });
}

// =============================================================================
// FACTORY FUNCTIONS - Date Range Preset
// =============================================================================

/**
 * Create a fake date range preset
 */
export function createFakeDateRangePreset(
  overrides?: Partial<FakeDateRangePreset>
): FakeDateRangePreset {
  const key = overrides?.key ?? faker.helpers.arrayElement(PRESET_KEYS);

  return {
    dateRange: getDateRangeForPreset(key),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    key,
    label: PRESET_LABELS_EN[key],
    ...overrides,
  };
}

/**
 * Create all preset definitions
 */
export function createFakeAllPresets(now?: Date): FakeDateRangePreset[] {
  return PRESET_KEYS.filter((k) => k !== 'custom').map((key) => ({
    dateRange: getDateRangeForPreset(key, now),
    key,
    label: PRESET_LABELS_EN[key],
  }));
}

// =============================================================================
// FACTORY FUNCTIONS - Date Range Selection
// =============================================================================

/**
 * Create a fake date range selection event
 */
export function createFakeDateRangeSelection(
  overrides?: Partial<FakeDateRangeSelection>
): FakeDateRangeSelection {
  const preset = faker.helpers.maybe(
    () => faker.helpers.arrayElement(PRESET_KEYS.filter((k) => k !== 'custom')),
    { probability: 0.7 }
  );

  return {
    dateRange: preset ? getDateRangeForPreset(preset) : createFakeDateRange(),
    id: faker.string.uuid(),
    preset: preset ?? null,
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Create multiple date range selections
 */
export function createFakeDateRangeSelections(count: number): FakeDateRangeSelection[] {
  return Array.from({ length: count }, () => createFakeDateRangeSelection());
}

// =============================================================================
// FACTORY FUNCTIONS - Date Range Validation
// =============================================================================

/**
 * Create a fake date range validation result
 */
export function createFakeDateRangeValidation(
  overrides?: Partial<FakeDateRangeValidation>
): FakeDateRangeValidation {
  const isValid = overrides?.isValid ?? faker.datatype.boolean({ probability: 0.9 });

  return {
    errors: isValid
      ? []
      : [
          faker.helpers.arrayElement([
            i18n.t(
              'factory.dateRangePicker.startDateMustBeBefore',
              'Start date must be before end date'
            ),
            i18n.t(
              'factory.dateRangePicker.dateRangeExceedsMaximumAllowed',
              'Date range exceeds maximum allowed period'
            ),
            i18n.t(
              'factory.dateRangePicker.startDateCannotBeIn',
              'Start date cannot be in the future'
            ),
            i18n.t('factory.dateRangePicker.invalidDateFormat', 'Invalid date format'),
          ]),
        ],
    isValid,
    maxDate: faker.helpers.maybe(() => faker.date.soon({ days: 365 }), { probability: 0.3 }),
    minDate: faker.helpers.maybe(() => faker.date.past({ years: 2 }), { probability: 0.3 }),
    range: createFakeDateRange(),
    ...overrides,
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Showcase
// =============================================================================

/**
 * Create a comprehensive date range picker showcase
 */
export function createFakeDateRangePickerShowcase(): FakeDateRangePickerShowcase {
  return {
    pickers: [
      createFakeDateRangePicker({ defaultPreset: 'last28Days' }),
      createFakeDateRangePickerOpen(),
      createFakeDateRangePickerEmpty(),
      createFakeDateRangePickerLoading(),
      createFakeDateRangePickerDisabled(),
    ],
    presets: createFakeAllPresets(),
    selections: createFakeDateRangeSelections(5),
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Specific Use Cases
// =============================================================================

/**
 * Create a date range picker for analytics dashboard
 */
export function createFakeAnalyticsPicker(): FakeDateRangePicker {
  return createFakeDateRangePicker({
    defaultPreset: 'last28Days',
    labels: {
      ...createFakeDateRangePickerLabelsEn(),
      placeholder: i18n.t(
        'factory.dateRangePicker.selectDateRangeForAnalytics',
        'Select date range for analytics'
      ),
    },
  });
}

/**
 * Create a date range picker for reports
 */
export function createFakeReportPicker(): FakeDateRangePicker {
  return createFakeDateRangePicker({
    defaultPreset: 'lastMonth',
    labels: {
      ...createFakeDateRangePickerLabelsEn(),
      placeholder: i18n.t('factory.dateRangePicker.selectReportPeriod', 'Select report period'),
    },
  });
}

/**
 * Create a date range picker for filtering
 */
export function createFakeFilterPicker(): FakeDateRangePicker {
  return createFakeDateRangePicker({
    defaultPreset: 'last7Days',
    labels: {
      ...createFakeDateRangePickerLabelsEn(),
      placeholder: i18n.t('factory.dateRangePicker.filterByDate', 'Filter by date'),
    },
  });
}
