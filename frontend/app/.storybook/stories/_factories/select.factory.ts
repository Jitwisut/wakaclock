import { faker } from '@faker-js/faker';
import i18n from 'i18next';

const LABEL_WITH_OFFSET_KEY = 'factory.select.labelWithOffset';
const LABEL_WITH_OFFSET_FALLBACK = '{{label}} ({{offset}})';

// ============================================================================
// SELECT FACTORY
// ============================================================================
// Comprehensive test data factories for the Select component.
// Follows the Button factory pattern with type exports, constants, and
// specialized factories for different select configurations.
// ============================================================================

// ============================================================================
// SHARED STRING CONSTANTS
// ============================================================================

const LABEL_COUNTRY = i18n.t('factory.select.country', 'Country');
const LABEL_LANGUAGE = i18n.t('factory.select.language', 'Language');
const LABEL_CURRENCY = i18n.t('factory.select.currency', 'Currency');
const LABEL_TIMEZONE = i18n.t('factory.select.timezone', 'Timezone');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Select trigger size variant
 * @description Controls the height of the select trigger
 */
export type SelectTriggerSize = 'default' | 'sm';

/**
 * Select content position
 * @description Controls how the dropdown is positioned relative to trigger
 */
export type SelectContentPosition = 'item-aligned' | 'popper';

/**
 * Select option category
 * @description Common domain categories for select options
 */
export type SelectOptionCategory =
  | 'colors'
  | 'countries'
  | 'currencies'
  | 'fruits'
  | 'languages'
  | 'priorities'
  | 'statuses'
  | 'timezones';

/**
 * Select validation state
 * @description Visual state for form validation
 */
export type SelectValidationState = 'error' | 'success' | 'warning';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All trigger size variants
 */
export const SELECT_TRIGGER_SIZES: SelectTriggerSize[] = ['default', 'sm'];

/**
 * All content position options
 */
export const SELECT_CONTENT_POSITIONS: SelectContentPosition[] = ['popper', 'item-aligned'];

/**
 * All option categories
 */
export const SELECT_OPTION_CATEGORIES: SelectOptionCategory[] = [
  'fruits',
  'countries',
  'languages',
  'currencies',
  'timezones',
  'priorities',
  'statuses',
  'colors',
];

/**
 * All validation states
 */
export const SELECT_VALIDATION_STATES: SelectValidationState[] = ['success', 'warning', 'error'];

/**
 * Common select widths for demo
 */
export const SELECT_WIDTHS = ['w-[180px]', 'w-[200px]', 'w-[240px]', 'w-[280px]', 'w-full'];

/**
 * Fruit options
 */
export const FRUIT_OPTIONS = [
  { label: i18n.t('factory.select.fruitApple', 'Apple'), value: 'apple' },
  { label: i18n.t('factory.select.fruitBanana', 'Banana'), value: 'banana' },
  { label: i18n.t('factory.select.fruitCherry', 'Cherry'), value: 'cherry' },
  { label: i18n.t('factory.select.fruitDate', 'Date'), value: 'date' },
  { label: i18n.t('factory.select.fruitElderberry', 'Elderberry'), value: 'elderberry' },
  { label: i18n.t('factory.select.fruitFig', 'Fig'), value: 'fig' },
  { label: i18n.t('factory.select.fruitGrape', 'Grape'), value: 'grape' },
  { label: i18n.t('factory.select.fruitHoneydew', 'Honeydew'), value: 'honeydew' },
];

/**
 * Country options
 */
export const COUNTRY_OPTIONS = [
  {
    emoji: '🇺🇸',
    label: i18n.t('factory.select.countryUnitedStates', 'United States'),
    value: 'us',
  },
  {
    emoji: '🇬🇧',
    label: i18n.t('factory.select.countryUnitedKingdom', 'United Kingdom'),
    value: 'gb',
  },
  { emoji: '🇨🇦', label: i18n.t('factory.select.countryCanada', 'Canada'), value: 'ca' },
  { emoji: '🇦🇺', label: i18n.t('factory.select.countryAustralia', 'Australia'), value: 'au' },
  { emoji: '🇩🇪', label: i18n.t('factory.select.countryGermany', 'Germany'), value: 'de' },
  { emoji: '🇫🇷', label: i18n.t('factory.select.countryFrance', 'France'), value: 'fr' },
  { emoji: '🇯🇵', label: i18n.t('factory.select.countryJapan', 'Japan'), value: 'jp' },
  { emoji: '🇧🇷', label: i18n.t('factory.select.countryBrazil', 'Brazil'), value: 'br' },
  { emoji: '🇮🇳', label: i18n.t('factory.select.countryIndia', 'India'), value: 'in' },
  { emoji: '🇨🇳', label: i18n.t('factory.select.countryChina', 'China'), value: 'cn' },
];

/**
 * Language options
 */
export const LANGUAGE_OPTIONS = [
  { label: i18n.t('factory.select.languageEnglish', 'English'), native: 'English', value: 'en' },
  { label: i18n.t('factory.select.languageSpanish', 'Spanish'), native: 'Español', value: 'es' },
  { label: i18n.t('factory.select.languageFrench', 'French'), native: 'Français', value: 'fr' },
  { label: i18n.t('factory.select.languageGerman', 'German'), native: 'Deutsch', value: 'de' },
  { label: i18n.t('factory.select.languageJapanese', 'Japanese'), native: '日本語', value: 'ja' },
  { label: i18n.t('factory.select.languageChinese', 'Chinese'), native: '中文', value: 'zh' },
  {
    label: i18n.t('factory.select.languagePortuguese', 'Portuguese'),
    native: 'Português',
    value: 'pt',
  },
  { label: i18n.t('factory.select.languageRussian', 'Russian'), native: 'Русский', value: 'ru' },
  { label: i18n.t('factory.select.languageArabic', 'Arabic'), native: 'العربية', value: 'ar' },
  { label: i18n.t('factory.select.languageHindi', 'Hindi'), native: 'हिन्दी', value: 'hi' },
];

/**
 * Currency options
 */
export const CURRENCY_OPTIONS = [
  { label: i18n.t('factory.select.currencyUsDollar', 'US Dollar'), symbol: '$', value: 'usd' },
  { label: i18n.t('factory.select.currencyEuro', 'Euro'), symbol: '€', value: 'eur' },
  {
    label: i18n.t('factory.select.currencyBritishPound', 'British Pound'),
    symbol: '£',
    value: 'gbp',
  },
  {
    label: i18n.t('factory.select.currencyJapaneseYen', 'Japanese Yen'),
    symbol: '¥',
    value: 'jpy',
  },
  {
    label: i18n.t('factory.select.currencySwissFranc', 'Swiss Franc'),
    symbol: 'CHF',
    value: 'chf',
  },
  {
    label: i18n.t('factory.select.currencyCanadianDollar', 'Canadian Dollar'),
    symbol: 'C$',
    value: 'cad',
  },
  {
    label: i18n.t('factory.select.currencyAustralianDollar', 'Australian Dollar'),
    symbol: 'A$',
    value: 'aud',
  },
  {
    label: i18n.t('factory.select.currencyChineseYuan', 'Chinese Yuan'),
    symbol: '¥',
    value: 'cny',
  },
  {
    label: i18n.t('factory.select.currencyIndianRupee', 'Indian Rupee'),
    symbol: '₹',
    value: 'inr',
  },
  {
    label: i18n.t('factory.select.currencyBrazilianReal', 'Brazilian Real'),
    symbol: 'R$',
    value: 'brl',
  },
];

/**
 * Timezone options (grouped by region)
 */
export const TIMEZONE_OPTIONS = [
  {
    label: i18n.t('factory.select.timezonePacificTime', 'Pacific Time (PT)'),
    offset: 'UTC-8',
    value: 'America/Los_Angeles',
  },
  {
    label: i18n.t('factory.select.timezoneMountainTime', 'Mountain Time (MT)'),
    offset: 'UTC-7',
    value: 'America/Denver',
  },
  {
    label: i18n.t('factory.select.timezoneCentralTime', 'Central Time (CT)'),
    offset: 'UTC-6',
    value: 'America/Chicago',
  },
  {
    label: i18n.t('factory.select.timezoneEasternTime', 'Eastern Time (ET)'),
    offset: 'UTC-5',
    value: 'America/New_York',
  },
  { label: i18n.t('factory.select.timezoneUtc', 'UTC'), offset: 'UTC+0', value: 'UTC' },
  {
    label: i18n.t('factory.select.timezoneCentralEuropeanTime', 'Central European Time'),
    offset: 'UTC+1',
    value: 'Europe/Paris',
  },
  {
    label: i18n.t('factory.select.timezoneEasternEuropeanTime', 'Eastern European Time'),
    offset: 'UTC+2',
    value: 'Europe/Helsinki',
  },
  {
    label: i18n.t('factory.select.timezoneIndiaStandardTime', 'India Standard Time'),
    offset: 'UTC+5:30',
    value: 'Asia/Kolkata',
  },
  {
    label: i18n.t('factory.select.timezoneJapanStandardTime', 'Japan Standard Time'),
    offset: 'UTC+9',
    value: 'Asia/Tokyo',
  },
  {
    label: i18n.t('factory.select.timezoneAustralianEasternTime', 'Australian Eastern Time'),
    offset: 'UTC+10',
    value: 'Australia/Sydney',
  },
];

/**
 * Priority options
 */
export const PRIORITY_OPTIONS = [
  { color: 'red', label: i18n.t('factory.select.priorityCritical', 'Critical'), value: 'critical' },
  { color: 'orange', label: i18n.t('factory.select.priorityHigh', 'High'), value: 'high' },
  { color: 'yellow', label: i18n.t('factory.select.priorityMedium', 'Medium'), value: 'medium' },
  { color: 'green', label: i18n.t('factory.select.priorityLow', 'Low'), value: 'low' },
  { color: 'gray', label: i18n.t('factory.select.priorityNone', 'None'), value: 'none' },
];

/**
 * Status options
 */
export const STATUS_OPTIONS = [
  { color: 'gray', label: i18n.t('factory.select.statusDraft', 'Draft'), value: 'draft' },
  { color: 'blue', label: i18n.t('factory.select.statusPending', 'Pending'), value: 'pending' },
  {
    color: 'yellow',
    label: i18n.t('factory.select.statusInReview', 'In Review'),
    value: 'in-review',
  },
  { color: 'green', label: i18n.t('factory.select.statusApproved', 'Approved'), value: 'approved' },
  { color: 'red', label: i18n.t('factory.select.statusRejected', 'Rejected'), value: 'rejected' },
  {
    color: 'purple',
    label: i18n.t('factory.select.statusArchived', 'Archived'),
    value: 'archived',
  },
];

/**
 * Color options
 */
export const COLOR_OPTIONS = [
  { hex: '#ef4444', label: i18n.t('factory.select.colorRed', 'Red'), value: 'red' },
  { hex: '#f97316', label: i18n.t('factory.select.colorOrange', 'Orange'), value: 'orange' },
  { hex: '#eab308', label: i18n.t('factory.select.colorYellow', 'Yellow'), value: 'yellow' },
  { hex: '#22c55e', label: i18n.t('factory.select.colorGreen', 'Green'), value: 'green' },
  { hex: '#3b82f6', label: i18n.t('factory.select.colorBlue', 'Blue'), value: 'blue' },
  { hex: '#8b5cf6', label: i18n.t('factory.select.colorPurple', 'Purple'), value: 'purple' },
  { hex: '#ec4899', label: i18n.t('factory.select.colorPink', 'Pink'), value: 'pink' },
  { hex: '#6b7280', label: i18n.t('factory.select.colorGray', 'Gray'), value: 'gray' },
];

/**
 * Common select labels
 */
export const SELECT_LABELS = [
  i18n.t('factory.select.category', 'Category'),
  i18n.t('factory.select.type', 'Type'),
  i18n.t('factory.select.status', 'Status'),
  i18n.t('factory.select.priority', 'Priority'),
  LABEL_COUNTRY,
  LABEL_LANGUAGE,
  LABEL_CURRENCY,
  LABEL_TIMEZONE,
  i18n.t('factory.select.role', 'Role'),
  i18n.t('factory.select.department', 'Department'),
];

/**
 * Common placeholder text
 */
export const SELECT_PLACEHOLDERS = [
  i18n.t('factory.select.selectAnOption', 'Select an option...'),
  i18n.t('factory.select.chooseOne', 'Choose one...'),
  i18n.t('factory.select.pickAnItem', 'Pick an item...'),
  i18n.t('factory.select.select', 'Select...'),
  i18n.t('factory.select.noneSelected', 'None selected'),
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Select option
 */
export interface FakeSelectOption {
  /** Option description */
  description?: string;
  /** Whether option is disabled */
  disabled: boolean;
  /** Icon name (lucide icon) */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Option value */
  value: string;
}

/**
 * Select option group
 */
export interface FakeSelectOptionGroup {
  /** Unique identifier */
  id: string;
  /** Group label */
  label: string;
  /** Options in this group */
  options: FakeSelectOption[];
}

/**
 * Select configuration
 */
export interface FakeSelect {
  /** Content position */
  contentPosition: SelectContentPosition;
  /** Default selected value */
  defaultValue?: string;
  /** Whether entire select is disabled */
  disabled: boolean;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Unique identifier */
  id: string;
  /** Associated label */
  label: string;
  /** Whether dropdown is open */
  open?: boolean;
  /** Options or option groups */
  options: FakeSelectOption[];
  /** Placeholder text */
  placeholder: string;
  /** Whether select is required */
  required: boolean;
  /** Trigger size */
  size: SelectTriggerSize;
  /** Validation state */
  validationState?: SelectValidationState;
  /** Currently selected value */
  value?: string;
  /** Width class */
  width: string;
}

/**
 * Select with grouped options
 */
export interface FakeGroupedSelect extends FakeSelect {
  /** Option groups */
  groups: FakeSelectOptionGroup[];
}

/**
 * Country select option
 */
export interface FakeCountryOption extends FakeSelectOption {
  /** Country code (ISO 3166-1 alpha-2) */
  code: string;
  /** Flag emoji */
  emoji: string;
}

/**
 * Language select option
 */
export interface FakeLanguageOption extends FakeSelectOption {
  /** ISO 639-1 language code */
  code: string;
  /** Native language name */
  native: string;
}

/**
 * Currency select option
 */
export interface FakeCurrencyOption extends FakeSelectOption {
  /** ISO 4217 currency code */
  code: string;
  /** Currency symbol */
  symbol: string;
}

/**
 * Timezone select option
 */
export interface FakeTimezoneOption extends FakeSelectOption {
  /** UTC offset string */
  offset: string;
  /** IANA timezone identifier */
  timezone: string;
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake select option
 * @param overrides - Optional property overrides
 * @returns A fake select option
 */
export function createFakeSelectOption(overrides?: Partial<FakeSelectOption>): FakeSelectOption {
  const label = faker.helpers.arrayElement([
    i18n.t('factory.select.optionA', 'Option A'),
    i18n.t('factory.select.optionB', 'Option B'),
    i18n.t('factory.select.optionC', 'Option C'),
    i18n.t('factory.select.optionD', 'Option D'),
    i18n.t('factory.select.optionE', 'Option E'),
  ]);
  return {
    id: faker.string.uuid(),
    label,
    value: label.toLowerCase().replace(' ', '-'),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.2 }),
    icon: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.select.star', 'Star'),
          i18n.t('factory.select.heart', 'Heart'),
          i18n.t('factory.select.check', 'Check'),
          i18n.t('factory.select.circle', 'Circle'),
          i18n.t('factory.select.square', 'Square'),
          i18n.t('factory.select.triangle', 'Triangle'),
          i18n.t('factory.select.diamond', 'Diamond'),
        ]),
      { probability: 0.15 }
    ),
    ...overrides,
  };
}

/**
 * Creates multiple fake select options
 * @param count - Number of options to create
 * @param overrides - Optional property overrides
 * @returns Array of fake select options
 */
export function createFakeSelectOptions(
  count: number,
  overrides?: Partial<FakeSelectOption>
): FakeSelectOption[] {
  const labels = [
    i18n.t('factory.select.apple', 'Apple'),
    i18n.t('factory.select.banana', 'Banana'),
    i18n.t('factory.select.cherry', 'Cherry'),
    i18n.t('factory.select.date', 'Date'),
    i18n.t('factory.select.elderberry', 'Elderberry'),
    i18n.t('factory.select.fig', 'Fig'),
    i18n.t('factory.select.grape', 'Grape'),
    i18n.t('factory.select.honeydew', 'Honeydew'),
  ];
  return labels.slice(0, count).map((label, index) => ({
    id: faker.string.uuid(),
    label,
    value: label.toLowerCase(),
    disabled: index === count - 1 ? true : faker.datatype.boolean({ probability: 0.05 }),
    ...overrides,
  }));
}

/**
 * Creates a fake select option group
 * @param overrides - Optional property overrides
 * @returns A fake select option group
 */
export function createFakeSelectOptionGroup(
  overrides?: Partial<FakeSelectOptionGroup>
): FakeSelectOptionGroup {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.select.groupA', 'Group A'),
      i18n.t('factory.select.groupB', 'Group B'),
      i18n.t('factory.select.groupC', 'Group C'),
      i18n.t('factory.select.category', 'Category'),
      i18n.t('factory.select.section', 'Section'),
    ]),
    options: createFakeSelectOptions(faker.number.int({ min: 2, max: 5 })),
    ...overrides,
  };
}

/**
 * Creates multiple fake select option groups
 * @param count - Number of groups to create
 * @param optionsPerGroup - Number of options per group
 * @returns Array of fake select option groups
 */
export function createFakeSelectOptionGroups(
  count: number,
  optionsPerGroup: number = 3
): FakeSelectOptionGroup[] {
  const groupNames = [
    i18n.t('factory.select.fruits', 'Fruits'),
    i18n.t('factory.select.vegetables', 'Vegetables'),
    i18n.t('factory.select.meats', 'Meats'),
    i18n.t('factory.select.dairy', 'Dairy'),
    i18n.t('factory.select.grains', 'Grains'),
    i18n.t('factory.select.beverages', 'Beverages'),
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: faker.string.uuid(),
    label: groupNames[i % groupNames.length],
    options: createFakeSelectOptions(optionsPerGroup),
  }));
}

/**
 * Creates a fake select configuration
 * @param overrides - Optional property overrides
 * @returns A fake select configuration
 */
export function createFakeSelect(overrides?: Partial<FakeSelect>): FakeSelect {
  const options = createFakeSelectOptions(faker.number.int({ min: 3, max: 8 }));
  const hasValue = faker.datatype.boolean({ probability: 0.3 });

  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(SELECT_LABELS),
    placeholder: faker.helpers.arrayElement(SELECT_PLACEHOLDERS),
    options,
    required: faker.datatype.boolean({ probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    size: faker.helpers.arrayElement(SELECT_TRIGGER_SIZES),
    contentPosition: faker.helpers.arrayElement(SELECT_CONTENT_POSITIONS),
    width: faker.helpers.arrayElement(SELECT_WIDTHS),
    value: hasValue ? faker.helpers.arrayElement(options).value : undefined,
    defaultValue: faker.helpers.maybe(() => faker.helpers.arrayElement(options).value, {
      probability: 0.2,
    }),
    error: faker.helpers.maybe(
      () => i18n.t('factory.select.pleaseSelectAnOption', 'Please select an option'),
      { probability: 0.1 }
    ),
    helperText: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.15 }),
    validationState: faker.helpers.maybe(
      () => faker.helpers.arrayElement(SELECT_VALIDATION_STATES),
      { probability: 0.1 }
    ),
    ...overrides,
  };
}

/**
 * Creates multiple fake selects
 * @param count - Number of selects to create
 * @param overrides - Optional property overrides
 * @returns Array of fake select configurations
 */
export function createFakeSelects(count: number, overrides?: Partial<FakeSelect>): FakeSelect[] {
  return Array.from({ length: count }, () => createFakeSelect(overrides));
}

// ============================================================================
// SPECIALIZED DOMAIN FACTORIES
// ============================================================================

/**
 * Creates country select options
 * @param count - Number of options to create
 * @returns Array of country options
 */
export function createFakeCountryOptions(count?: number): FakeCountryOption[] {
  const countries = COUNTRY_OPTIONS.slice(0, count ?? COUNTRY_OPTIONS.length);
  return countries.map((country) => ({
    id: faker.string.uuid(),
    label: country.label,
    value: country.value,
    code: country.value.toUpperCase(),
    emoji: country.emoji,
    disabled: false,
  }));
}

/**
 * Creates a country select configuration
 * @param overrides - Optional property overrides
 * @returns A country select configuration
 */
export function createFakeCountrySelect(overrides?: Partial<FakeSelect>): FakeSelect {
  const options = createFakeCountryOptions();
  return createFakeSelect({
    label: LABEL_COUNTRY,
    placeholder: i18n.t('factory.select.selectACountry', 'Select a country...'),
    options: options.map((o) => ({
      id: o.id,
      label: i18n.t('factory.select.emojiLabel', '{{emoji}} {{label}}', {
        emoji: o.emoji,
        label: o.label,
      }),
      value: o.value,
      disabled: o.disabled,
    })),
    ...overrides,
  });
}

/**
 * Creates language select options
 * @param count - Number of options to create
 * @returns Array of language options
 */
export function createFakeLanguageOptions(count?: number): FakeLanguageOption[] {
  const languages = LANGUAGE_OPTIONS.slice(0, count ?? LANGUAGE_OPTIONS.length);
  return languages.map((lang) => ({
    id: faker.string.uuid(),
    label: lang.label,
    value: lang.value,
    code: lang.value,
    native: lang.native,
    disabled: false,
  }));
}

/**
 * Creates a language select configuration
 * @param overrides - Optional property overrides
 * @returns A language select configuration
 */
export function createFakeLanguageSelect(overrides?: Partial<FakeSelect>): FakeSelect {
  const options = createFakeLanguageOptions();
  return createFakeSelect({
    label: LABEL_LANGUAGE,
    placeholder: i18n.t('factory.select.selectALanguage', 'Select a language...'),
    options: options.map((o) => ({
      id: o.id,
      label: i18n.t('factory.select.labelWithNative', '{{label}} ({{native}})', {
        label: o.label,
        native: o.native,
      }),
      value: o.value,
      disabled: o.disabled,
    })),
    ...overrides,
  });
}

/**
 * Creates currency select options
 * @param count - Number of options to create
 * @returns Array of currency options
 */
export function createFakeCurrencyOptions(count?: number): FakeCurrencyOption[] {
  const currencies = CURRENCY_OPTIONS.slice(0, count ?? CURRENCY_OPTIONS.length);
  return currencies.map((curr) => ({
    id: faker.string.uuid(),
    label: curr.label,
    value: curr.value,
    code: curr.value.toUpperCase(),
    symbol: curr.symbol,
    disabled: false,
  }));
}

/**
 * Creates a currency select configuration
 * @param overrides - Optional property overrides
 * @returns A currency select configuration
 */
export function createFakeCurrencySelect(overrides?: Partial<FakeSelect>): FakeSelect {
  const options = createFakeCurrencyOptions();
  return createFakeSelect({
    label: LABEL_CURRENCY,
    placeholder: i18n.t('factory.select.selectACurrency', 'Select a currency...'),
    options: options.map((o) => ({
      id: o.id,
      label: i18n.t('factory.select.symbolLabel', '{{symbol}} {{label}}', {
        symbol: o.symbol,
        label: o.label,
      }),
      value: o.value,
      disabled: o.disabled,
    })),
    ...overrides,
  });
}

/**
 * Creates timezone select options
 * @param count - Number of options to create
 * @returns Array of timezone options
 */
export function createFakeTimezoneOptions(count?: number): FakeTimezoneOption[] {
  const timezones = TIMEZONE_OPTIONS.slice(0, count ?? TIMEZONE_OPTIONS.length);
  return timezones.map((tz) => ({
    id: faker.string.uuid(),
    label: tz.label,
    value: tz.value,
    timezone: tz.value,
    offset: tz.offset,
    disabled: false,
  }));
}

/**
 * Creates a timezone select configuration
 * @param overrides - Optional property overrides
 * @returns A timezone select configuration
 */
export function createFakeTimezoneSelect(overrides?: Partial<FakeSelect>): FakeSelect {
  const options = createFakeTimezoneOptions();
  return createFakeSelect({
    label: LABEL_TIMEZONE,
    placeholder: i18n.t('factory.select.selectATimezone', 'Select a timezone...'),
    options: options.map((o) => ({
      id: o.id,
      label: i18n.t(LABEL_WITH_OFFSET_KEY, LABEL_WITH_OFFSET_FALLBACK, {
        label: o.label,
        offset: o.offset,
      }),
      value: o.value,
      disabled: o.disabled,
    })),
    width: 'w-[300px]',
    ...overrides,
  });
}

/**
 * Creates a priority select configuration
 * @param overrides - Optional property overrides
 * @returns A priority select configuration
 */
export function createFakePrioritySelect(overrides?: Partial<FakeSelect>): FakeSelect {
  const options = PRIORITY_OPTIONS.map((p) => ({
    id: faker.string.uuid(),
    label: p.label,
    value: p.value,
    disabled: false,
  }));
  return createFakeSelect({
    label: i18n.t('factory.select.priority', 'Priority'),
    placeholder: i18n.t('factory.select.selectPriority', 'Select priority...'),
    options,
    ...overrides,
  });
}

/**
 * Creates a status select configuration
 * @param overrides - Optional property overrides
 * @returns A status select configuration
 */
export function createFakeStatusSelect(overrides?: Partial<FakeSelect>): FakeSelect {
  const options = STATUS_OPTIONS.map((s) => ({
    id: faker.string.uuid(),
    label: s.label,
    value: s.value,
    disabled: false,
  }));
  return createFakeSelect({
    label: i18n.t('factory.select.status', 'Status'),
    placeholder: i18n.t('factory.select.selectStatus', 'Select status...'),
    options,
    ...overrides,
  });
}

/**
 * Creates a color select configuration
 * @param overrides - Optional property overrides
 * @returns A color select configuration
 */
export function createFakeColorSelect(overrides?: Partial<FakeSelect>): FakeSelect {
  const options = COLOR_OPTIONS.map((c) => ({
    id: faker.string.uuid(),
    label: c.label,
    value: c.value,
    disabled: false,
  }));
  return createFakeSelect({
    label: i18n.t('factory.select.color', 'Color'),
    placeholder: i18n.t('factory.select.selectAColor', 'Select a color...'),
    options,
    ...overrides,
  });
}

// ============================================================================
// GROUPED SELECT FACTORIES
// ============================================================================

/**
 * Creates a grouped select (food categories)
 * @param overrides - Optional property overrides
 * @returns A grouped select configuration
 */
export function createFakeFoodGroupedSelect(
  overrides?: Partial<FakeGroupedSelect>
): FakeGroupedSelect {
  const groups: FakeSelectOptionGroup[] = [
    {
      id: faker.string.uuid(),
      label: i18n.t('factory.select.fruits', 'Fruits'),
      options: FRUIT_OPTIONS.slice(0, 4).map((f) => ({
        id: faker.string.uuid(),
        label: f.label,
        value: f.value,
        disabled: false,
      })),
    },
    {
      id: faker.string.uuid(),
      label: i18n.t('factory.select.vegetables', 'Vegetables'),
      options: [
        {
          id: faker.string.uuid(),
          label: i18n.t('factory.select.carrot', 'Carrot'),
          value: 'carrot',
          disabled: false,
        },
        {
          id: faker.string.uuid(),
          label: i18n.t('factory.select.broccoli', 'Broccoli'),
          value: 'broccoli',
          disabled: false,
        },
        {
          id: faker.string.uuid(),
          label: i18n.t('factory.select.spinach', 'Spinach'),
          value: 'spinach',
          disabled: false,
        },
      ],
    },
    {
      id: faker.string.uuid(),
      label: i18n.t('factory.select.proteins', 'Proteins'),
      options: [
        {
          id: faker.string.uuid(),
          label: i18n.t('factory.select.chicken', 'Chicken'),
          value: 'chicken',
          disabled: false,
        },
        {
          id: faker.string.uuid(),
          label: i18n.t('factory.select.beef', 'Beef'),
          value: 'beef',
          disabled: false,
        },
        {
          id: faker.string.uuid(),
          label: i18n.t('factory.select.fish', 'Fish'),
          value: 'fish',
          disabled: false,
        },
      ],
    },
  ];

  const base = createFakeSelect({
    label: i18n.t('factory.select.food', 'Food'),
    placeholder: i18n.t('factory.select.selectFood', 'Select food...'),
    options: groups.flatMap((g) => g.options),
  });

  return {
    ...base,
    groups,
    ...overrides,
  };
}

/**
 * Creates a grouped timezone select (by region)
 * @param overrides - Optional property overrides
 * @returns A grouped timezone select
 */
export function createFakeTimezoneGroupedSelect(
  overrides?: Partial<FakeGroupedSelect>
): FakeGroupedSelect {
  const groups: FakeSelectOptionGroup[] = [
    {
      id: faker.string.uuid(),
      label: i18n.t('factory.select.americas', 'Americas'),
      options: TIMEZONE_OPTIONS.filter((tz) => tz.value.startsWith('America')).map((tz) => ({
        id: faker.string.uuid(),
        label: i18n.t(LABEL_WITH_OFFSET_KEY, LABEL_WITH_OFFSET_FALLBACK, {
          label: tz.label,
          offset: tz.offset,
        }),
        value: tz.value,
        disabled: false,
      })),
    },
    {
      id: faker.string.uuid(),
      label: i18n.t('factory.select.europe', 'Europe'),
      options: TIMEZONE_OPTIONS.filter(
        (tz) => tz.value.startsWith('Europe') || tz.value === 'UTC'
      ).map((tz) => ({
        id: faker.string.uuid(),
        label: i18n.t(LABEL_WITH_OFFSET_KEY, LABEL_WITH_OFFSET_FALLBACK, {
          label: tz.label,
          offset: tz.offset,
        }),
        value: tz.value,
        disabled: false,
      })),
    },
    {
      id: faker.string.uuid(),
      label: i18n.t('factory.select.asiaPacific', 'Asia & Pacific'),
      options: TIMEZONE_OPTIONS.filter(
        (tz) => tz.value.startsWith('Asia') || tz.value.startsWith('Australia')
      ).map((tz) => ({
        id: faker.string.uuid(),
        label: i18n.t(LABEL_WITH_OFFSET_KEY, LABEL_WITH_OFFSET_FALLBACK, {
          label: tz.label,
          offset: tz.offset,
        }),
        value: tz.value,
        disabled: false,
      })),
    },
  ];

  const base = createFakeSelect({
    label: LABEL_TIMEZONE,
    placeholder: i18n.t('factory.select.selectTimezone', 'Select timezone...'),
    options: groups.flatMap((g) => g.options),
    width: 'w-[300px]',
  });

  return {
    ...base,
    groups,
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED STATE FACTORIES
// ============================================================================

/**
 * Creates a disabled select
 * @returns A disabled select configuration
 */
export function createFakeDisabledSelect(): FakeSelect {
  return createFakeSelect({
    disabled: true,
    value: 'apple',
  });
}

/**
 * Creates a required select
 * @returns A required select configuration
 */
export function createFakeRequiredSelect(): FakeSelect {
  return createFakeSelect({
    required: true,
    label: i18n.t('factory.select.requiredField', 'Required Field'),
    helperText: i18n.t('factory.select.thisFieldIsRequired', '* This field is required'),
  });
}

/**
 * Creates a select with error
 * @returns A select with error state
 */
export function createFakeErrorSelect(): FakeSelect {
  return createFakeSelect({
    error: i18n.t('factory.select.pleaseSelectAnOption', 'Please select an option'),
    validationState: 'error',
    required: true,
  });
}

/**
 * Creates a select with success state
 * @returns A select with success state
 */
export function createFakeSuccessSelect(): FakeSelect {
  return createFakeSelect({
    validationState: 'success',
    value: 'apple',
    helperText: i18n.t('factory.select.greatChoice', 'Great choice!'),
  });
}

/**
 * Creates a small size select
 * @returns A small select configuration
 */
export function createFakeSmallSelect(): FakeSelect {
  return createFakeSelect({
    size: 'sm',
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of selects across sizes
 * @returns Grid of selects for each size
 */
export function createSelectSizeMatrix(): FakeSelect[] {
  return SELECT_TRIGGER_SIZES.map((size) =>
    createFakeSelect({
      size,
      label: i18n.t('factory.select.sizeLabel', '{{size}} Size', {
        size: size.charAt(0).toUpperCase() + size.slice(1),
      }),
    })
  );
}

/**
 * Creates a matrix of selects across validation states
 * @returns Grid of selects for each validation state
 */
export function createSelectValidationMatrix(): FakeSelect[] {
  return SELECT_VALIDATION_STATES.map((validationState) =>
    createFakeSelect({
      validationState,
      label: i18n.t('factory.select.validationStateLabel', '{{state}} State', {
        state: validationState.charAt(0).toUpperCase() + validationState.slice(1),
      }),
    })
  );
}

/**
 * Creates a matrix of domain-specific selects
 * @returns Grid of domain selects
 */
export function createSelectDomainMatrix(): FakeSelect[] {
  return [
    createFakeCountrySelect(),
    createFakeLanguageSelect(),
    createFakeCurrencySelect(),
    createFakeTimezoneSelect(),
    createFakePrioritySelect(),
    createFakeStatusSelect(),
    createFakeColorSelect(),
  ];
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all select configurations
 * @returns Array of select configs for showcase
 */
export function createSelectShowcase(): Array<{
  description: string;
  name: string;
  select: FakeGroupedSelect | FakeSelect;
}> {
  return [
    {
      name: i18n.t('factory.select.basic', 'Basic'),
      description: i18n.t(
        'factory.select.simpleSelectWithDefaultOptions',
        'Simple select with default options'
      ),
      select: createFakeSelect(),
    },
    {
      name: LABEL_COUNTRY,
      description: i18n.t(
        'factory.select.countrySelectWithFlagEmojis',
        'Country select with flag emojis'
      ),
      select: createFakeCountrySelect(),
    },
    {
      name: LABEL_LANGUAGE,
      description: i18n.t(
        'factory.select.languageSelectWithNativeNames',
        'Language select with native names'
      ),
      select: createFakeLanguageSelect(),
    },
    {
      name: LABEL_CURRENCY,
      description: i18n.t(
        'factory.select.currencySelectWithSymbols',
        'Currency select with symbols'
      ),
      select: createFakeCurrencySelect(),
    },
    {
      name: LABEL_TIMEZONE,
      description: i18n.t(
        'factory.select.timezoneSelectWithUtcOffsets',
        'Timezone select with UTC offsets'
      ),
      select: createFakeTimezoneSelect(),
    },
    {
      name: i18n.t('factory.select.priority', 'Priority'),
      description: i18n.t(
        'factory.select.prioritySelectForTaskManagement',
        'Priority select for task management'
      ),
      select: createFakePrioritySelect(),
    },
    {
      name: i18n.t('factory.select.status', 'Status'),
      description: i18n.t('factory.select.statusSelectForWorkflows', 'Status select for workflows'),
      select: createFakeStatusSelect(),
    },
    {
      name: i18n.t('factory.select.groupedFood', 'Grouped (Food)'),
      description: i18n.t(
        'factory.select.selectWithCategorizedOptions',
        'Select with categorized options'
      ),
      select: createFakeFoodGroupedSelect(),
    },
    {
      name: i18n.t('factory.select.groupedTimezone', 'Grouped (Timezone)'),
      description: i18n.t(
        'factory.select.timezoneSelectGroupedByRegion',
        'Timezone select grouped by region'
      ),
      select: createFakeTimezoneGroupedSelect(),
    },
    {
      name: i18n.t('factory.select.small', 'Small'),
      description: i18n.t('factory.select.compactSelectTrigger', 'Compact select trigger'),
      select: createFakeSmallSelect(),
    },
    {
      name: i18n.t('factory.select.disabled', 'Disabled'),
      description: i18n.t('factory.select.noninteractiveSelect', 'Non-interactive select'),
      select: createFakeDisabledSelect(),
    },
    {
      name: i18n.t('factory.select.error', 'Error'),
      description: i18n.t(
        'factory.select.selectWithValidationError',
        'Select with validation error'
      ),
      select: createFakeErrorSelect(),
    },
    {
      name: i18n.t('factory.select.success', 'Success'),
      description: i18n.t('factory.select.selectWithSuccessState', 'Select with success state'),
      select: createFakeSuccessSelect(),
    },
  ];
}

// ============================================================================
// TEST DATA FACTORY
// ============================================================================

/**
 * Creates a complete test data set for select testing
 * @returns Comprehensive test data
 */
export function createSelectTestData(): {
  basicSelect: FakeSelect;
  colorSelect: FakeSelect;
  countryOptions: FakeCountryOption[];
  countrySelect: FakeSelect;
  currencyOptions: FakeCurrencyOption[];
  currencySelect: FakeSelect;
  disabledSelect: FakeSelect;
  domainMatrix: FakeSelect[];
  errorSelect: FakeSelect;
  foodGroupedSelect: FakeGroupedSelect;
  languageOptions: FakeLanguageOption[];
  languageSelect: FakeSelect;
  optionGroups: FakeSelectOptionGroup[];
  options: FakeSelectOption[];
  prioritySelect: FakeSelect;
  selects: FakeSelect[];
  showcase: Array<{
    description: string;
    name: string;
    select: FakeGroupedSelect | FakeSelect;
  }>;
  sizeMatrix: FakeSelect[];
  statusSelect: FakeSelect;
  successSelect: FakeSelect;
  timezoneGroupedSelect: FakeGroupedSelect;
  timezoneOptions: FakeTimezoneOption[];
  timezoneSelect: FakeSelect;
  validationMatrix: FakeSelect[];
} {
  return {
    options: createFakeSelectOptions(8),
    optionGroups: createFakeSelectOptionGroups(3),
    selects: createFakeSelects(5),
    basicSelect: createFakeSelect(),
    countryOptions: createFakeCountryOptions(),
    countrySelect: createFakeCountrySelect(),
    languageOptions: createFakeLanguageOptions(),
    languageSelect: createFakeLanguageSelect(),
    currencyOptions: createFakeCurrencyOptions(),
    currencySelect: createFakeCurrencySelect(),
    timezoneOptions: createFakeTimezoneOptions(),
    timezoneSelect: createFakeTimezoneSelect(),
    prioritySelect: createFakePrioritySelect(),
    statusSelect: createFakeStatusSelect(),
    colorSelect: createFakeColorSelect(),
    foodGroupedSelect: createFakeFoodGroupedSelect(),
    timezoneGroupedSelect: createFakeTimezoneGroupedSelect(),
    disabledSelect: createFakeDisabledSelect(),
    errorSelect: createFakeErrorSelect(),
    successSelect: createFakeSuccessSelect(),
    sizeMatrix: createSelectSizeMatrix(),
    validationMatrix: createSelectValidationMatrix(),
    domainMatrix: createSelectDomainMatrix(),
    showcase: createSelectShowcase(),
  };
}

// ============================================================================
// LEGACY EXPORTS (backward compatibility)
// ============================================================================

// Note: These are kept for backward compatibility with existing code
// that imports from this factory. New code should use the specialized
// factories above.

export interface FakeNativeSelect {
  disabled: boolean;
  id: string;
  label: string;
  options: FakeSelectOption[];
  required: boolean;
  value?: string;
}

export interface FakeRadioOption {
  description?: string;
  disabled: boolean;
  id: string;
  label: string;
  value: string;
}

export interface FakeRadioGroup {
  disabled: boolean;
  id: string;
  label: string;
  options: FakeRadioOption[];
  orientation: 'horizontal' | 'vertical';
  required: boolean;
  value?: string;
}

export interface FakeCheckbox {
  checked: boolean;
  description?: string;
  disabled: boolean;
  id: string;
  indeterminate: boolean;
  label: string;
}

export interface FakeCheckboxGroup {
  id: string;
  items: FakeCheckbox[];
  label: string;
}

export function createFakeNativeSelect(overrides?: Partial<FakeNativeSelect>): FakeNativeSelect {
  const options = createFakeSelectOptions(faker.number.int({ min: 3, max: 8 }));
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      LABEL_COUNTRY,
      LABEL_LANGUAGE,
      LABEL_CURRENCY,
      LABEL_TIMEZONE,
    ]),
    options,
    required: faker.datatype.boolean({ probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    value: faker.helpers.maybe(() => faker.helpers.arrayElement(options).value, {
      probability: 0.3,
    }),
    ...overrides,
  };
}

export function createFakeNativeSelects(count: number): FakeNativeSelect[] {
  return Array.from({ length: count }, () => createFakeNativeSelect());
}

export function createFakeRadioOption(overrides?: Partial<FakeRadioOption>): FakeRadioOption {
  const label = faker.helpers.arrayElement([
    i18n.t('factory.select.small', 'Small'),
    i18n.t('factory.select.medium', 'Medium'),
    i18n.t('factory.select.large', 'Large'),
    i18n.t('factory.select.extraLarge', 'Extra Large'),
  ]);
  return {
    id: faker.string.uuid(),
    label,
    value: label.toLowerCase().replace(' ', '-'),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    ...overrides,
  };
}

export function createFakeRadioOptions(count: number): FakeRadioOption[] {
  const labels = [
    i18n.t('factory.select.option1', 'Option 1'),
    i18n.t('factory.select.option2', 'Option 2'),
    i18n.t('factory.select.option3', 'Option 3'),
    i18n.t('factory.select.option4', 'Option 4'),
    i18n.t('factory.select.option5', 'Option 5'),
  ];
  return labels.slice(0, count).map((label) => ({
    id: faker.string.uuid(),
    label,
    value: label.toLowerCase().replace(' ', '-'),
    disabled: faker.datatype.boolean({ probability: 0.05 }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.2 }),
  }));
}

export function createFakeRadioGroup(overrides?: Partial<FakeRadioGroup>): FakeRadioGroup {
  const options = createFakeRadioOptions(faker.number.int({ min: 2, max: 5 }));
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.select.size', 'Size'),
      i18n.t('factory.select.plan', 'Plan'),
      i18n.t('factory.select.frequency', 'Frequency'),
      i18n.t('factory.select.type', 'Type'),
    ]),
    options,
    orientation: faker.helpers.arrayElement(['horizontal', 'vertical']),
    required: faker.datatype.boolean({ probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    value: faker.helpers.maybe(() => faker.helpers.arrayElement(options).value, {
      probability: 0.3,
    }),
    ...overrides,
  };
}

export function createFakeRadioGroups(count: number): FakeRadioGroup[] {
  return Array.from({ length: count }, () => createFakeRadioGroup());
}

export function createFakeCheckbox(overrides?: Partial<FakeCheckbox>): FakeCheckbox {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.select.rememberMe', 'Remember me'),
      i18n.t('factory.select.acceptTerms', 'Accept terms'),
      i18n.t('factory.select.subscribeToNewsletter', 'Subscribe to newsletter'),
      i18n.t('factory.select.enableNotifications', 'Enable notifications'),
    ]),
    checked: faker.datatype.boolean({ probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    indeterminate: faker.datatype.boolean({ probability: 0.05 }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.2 }),
    ...overrides,
  };
}

export function createFakeCheckboxes(count: number): FakeCheckbox[] {
  return Array.from({ length: count }, () => createFakeCheckbox());
}

export function createFakeCheckboxGroup(overrides?: Partial<FakeCheckboxGroup>): FakeCheckboxGroup {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.select.preferences', 'Preferences'),
      i18n.t('factory.select.settings', 'Settings'),
      i18n.t('factory.select.options', 'Options'),
      i18n.t('factory.select.features', 'Features'),
    ]),
    items: createFakeCheckboxes(faker.number.int({ min: 2, max: 5 })),
    ...overrides,
  };
}

export function createFakeCheckboxGroups(count: number): FakeCheckboxGroup[] {
  return Array.from({ length: count }, () => createFakeCheckboxGroup());
}
