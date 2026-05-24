/**
 * @fileoverview Factory functions for generating fake NativeSelect component data
 * @module native-select.factory
 * @description Provides comprehensive test data generation for NativeSelect components
 * including options, option groups, and various select configurations.
 *
 * @example
 * ```typescript
 * import { createFakeNativeSelect, createFakeNativeSelectOption } from './_factories/native-select.factory';
 *
 * // Create a complete select with options
 * const select = createFakeNativeSelect();
 *
 * // Create specific option configurations
 * const options = createFakeNativeSelectOptions(5);
 * ```
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * NativeSelect size variants
 * @description Width-based size presets
 */
export type NativeSelectSize = 'full' | 'lg' | 'md' | 'sm';

/**
 * NativeSelect state
 * @description Different states of the select
 */
export type NativeSelectState = 'default' | 'disabled' | 'error' | 'focused';

/**
 * Option category for generating contextual options
 * @description Categories for generating realistic option sets
 */
export type NativeSelectOptionCategory =
  | 'colors'
  | 'countries'
  | 'currencies'
  | 'fruits'
  | 'languages'
  | 'months'
  | 'priorities'
  | 'sizes'
  | 'statuses'
  | 'timezones';

// ============================================================================
// CONSTANTS
// ============================================================================

/** All available sizes */
export const NATIVE_SELECT_SIZES: NativeSelectSize[] = ['sm', 'md', 'lg', 'full'];

/** All available states */
export const NATIVE_SELECT_STATES: NativeSelectState[] = [
  'default',
  'focused',
  'disabled',
  'error',
];

/** All option categories */
export const NATIVE_SELECT_OPTION_CATEGORIES: NativeSelectOptionCategory[] = [
  'fruits',
  'colors',
  'countries',
  'languages',
  'currencies',
  'months',
  'priorities',
  'statuses',
  'sizes',
  'timezones',
];

/** Size to width class mapping */
export const NATIVE_SELECT_SIZE_CLASSES: Record<NativeSelectSize, string> = {
  full: 'w-full',
  lg: 'w-[360px]',
  md: 'w-[260px]',
  sm: 'w-[160px]',
};

/** Fruits options */
export const NATIVE_SELECT_FRUITS = [
  { label: i18n.t('factory.nativeSelect.fruitApple', 'Apple'), value: 'apple' },
  { label: i18n.t('factory.nativeSelect.fruitBanana', 'Banana'), value: 'banana' },
  { label: i18n.t('factory.nativeSelect.fruitBlueberry', 'Blueberry'), value: 'blueberry' },
  { label: i18n.t('factory.nativeSelect.fruitCherry', 'Cherry'), value: 'cherry' },
  { label: i18n.t('factory.nativeSelect.fruitGrape', 'Grape'), value: 'grape' },
  { label: i18n.t('factory.nativeSelect.fruitLemon', 'Lemon'), value: 'lemon' },
  { label: i18n.t('factory.nativeSelect.fruitMango', 'Mango'), value: 'mango' },
  { label: i18n.t('factory.nativeSelect.fruitOrange', 'Orange'), value: 'orange' },
  { label: i18n.t('factory.nativeSelect.fruitPeach', 'Peach'), value: 'peach' },
  { label: i18n.t('factory.nativeSelect.fruitStrawberry', 'Strawberry'), value: 'strawberry' },
];

/** Colors options */
export const NATIVE_SELECT_COLORS = [
  { label: i18n.t('factory.nativeSelect.colorRed', 'Red'), value: 'red' },
  { label: i18n.t('factory.nativeSelect.colorBlue', 'Blue'), value: 'blue' },
  { label: i18n.t('factory.nativeSelect.colorGreen', 'Green'), value: 'green' },
  { label: i18n.t('factory.nativeSelect.colorYellow', 'Yellow'), value: 'yellow' },
  { label: i18n.t('factory.nativeSelect.colorPurple', 'Purple'), value: 'purple' },
  { label: i18n.t('factory.nativeSelect.colorOrange', 'Orange'), value: 'orange' },
  { label: i18n.t('factory.nativeSelect.colorPink', 'Pink'), value: 'pink' },
  { label: i18n.t('factory.nativeSelect.colorBlack', 'Black'), value: 'black' },
  { label: i18n.t('factory.nativeSelect.colorWhite', 'White'), value: 'white' },
  { label: i18n.t('factory.nativeSelect.colorGray', 'Gray'), value: 'gray' },
];

/** Country options */
export const NATIVE_SELECT_COUNTRIES = [
  { label: i18n.t('factory.nativeSelect.countryUnitedStates', 'United States'), value: 'us' },
  { label: i18n.t('factory.nativeSelect.countryUnitedKingdom', 'United Kingdom'), value: 'uk' },
  { label: i18n.t('factory.nativeSelect.countryCanada', 'Canada'), value: 'ca' },
  { label: i18n.t('factory.nativeSelect.countryAustralia', 'Australia'), value: 'au' },
  { label: i18n.t('factory.nativeSelect.countryGermany', 'Germany'), value: 'de' },
  { label: i18n.t('factory.nativeSelect.countryFrance', 'France'), value: 'fr' },
  { label: i18n.t('factory.nativeSelect.countryJapan', 'Japan'), value: 'jp' },
  { label: i18n.t('factory.nativeSelect.countryChina', 'China'), value: 'cn' },
  { label: i18n.t('factory.nativeSelect.countryIndia', 'India'), value: 'in' },
  { label: i18n.t('factory.nativeSelect.countryBrazil', 'Brazil'), value: 'br' },
];

/** Language options */
export const NATIVE_SELECT_LANGUAGES = [
  { label: i18n.t('factory.nativeSelect.languageEnglish', 'English'), value: 'en' },
  { label: i18n.t('factory.nativeSelect.languageSpanish', 'Spanish'), value: 'es' },
  { label: i18n.t('factory.nativeSelect.languageFrench', 'French'), value: 'fr' },
  { label: i18n.t('factory.nativeSelect.languageGerman', 'German'), value: 'de' },
  { label: i18n.t('factory.nativeSelect.languageItalian', 'Italian'), value: 'it' },
  { label: i18n.t('factory.nativeSelect.languagePortuguese', 'Portuguese'), value: 'pt' },
  { label: i18n.t('factory.nativeSelect.languageJapanese', 'Japanese'), value: 'ja' },
  { label: i18n.t('factory.nativeSelect.languageChinese', 'Chinese'), value: 'zh' },
  { label: i18n.t('factory.nativeSelect.languageKorean', 'Korean'), value: 'ko' },
  { label: i18n.t('factory.nativeSelect.languageRussian', 'Russian'), value: 'ru' },
];

/** Currency options */
export const NATIVE_SELECT_CURRENCIES = [
  { label: i18n.t('factory.nativeSelect.currencyUsDollar', 'US Dollar (USD)'), value: 'usd' },
  { label: i18n.t('factory.nativeSelect.currencyEuro', 'Euro (EUR)'), value: 'eur' },
  {
    label: i18n.t('factory.nativeSelect.currencyBritishPound', 'British Pound (GBP)'),
    value: 'gbp',
  },
  { label: i18n.t('factory.nativeSelect.currencyJapaneseYen', 'Japanese Yen (JPY)'), value: 'jpy' },
  {
    label: i18n.t('factory.nativeSelect.currencyCanadianDollar', 'Canadian Dollar (CAD)'),
    value: 'cad',
  },
  {
    label: i18n.t('factory.nativeSelect.currencyAustralianDollar', 'Australian Dollar (AUD)'),
    value: 'aud',
  },
  { label: i18n.t('factory.nativeSelect.currencySwissFranc', 'Swiss Franc (CHF)'), value: 'chf' },
  { label: i18n.t('factory.nativeSelect.currencyChineseYuan', 'Chinese Yuan (CNY)'), value: 'cny' },
  { label: i18n.t('factory.nativeSelect.currencyIndianRupee', 'Indian Rupee (INR)'), value: 'inr' },
  {
    label: i18n.t('factory.nativeSelect.currencyBrazilianReal', 'Brazilian Real (BRL)'),
    value: 'brl',
  },
];

/** Month options */
export const NATIVE_SELECT_MONTHS = [
  { label: i18n.t('factory.nativeSelect.january', 'January'), value: '01' },
  { label: i18n.t('factory.nativeSelect.february', 'February'), value: '02' },
  { label: i18n.t('factory.nativeSelect.march', 'March'), value: '03' },
  { label: i18n.t('factory.nativeSelect.april', 'April'), value: '04' },
  { label: i18n.t('factory.nativeSelect.may', 'May'), value: '05' },
  { label: i18n.t('factory.nativeSelect.june', 'June'), value: '06' },
  { label: i18n.t('factory.nativeSelect.july', 'July'), value: '07' },
  { label: i18n.t('factory.nativeSelect.august', 'August'), value: '08' },
  { label: i18n.t('factory.nativeSelect.september', 'September'), value: '09' },
  { label: i18n.t('factory.nativeSelect.october', 'October'), value: '10' },
  { label: i18n.t('factory.nativeSelect.november', 'November'), value: '11' },
  { label: i18n.t('factory.nativeSelect.december', 'December'), value: '12' },
];

/** Priority options */
export const NATIVE_SELECT_PRIORITIES = [
  { label: i18n.t('factory.nativeSelect.priorityLow', 'Low'), value: 'low' },
  { label: i18n.t('factory.nativeSelect.priorityMedium', 'Medium'), value: 'medium' },
  { label: i18n.t('factory.nativeSelect.priorityHigh', 'High'), value: 'high' },
  { label: i18n.t('factory.nativeSelect.priorityUrgent', 'Urgent'), value: 'urgent' },
  { label: i18n.t('factory.nativeSelect.priorityCritical', 'Critical'), value: 'critical' },
];

/** Status options */
export const NATIVE_SELECT_STATUSES = [
  { label: i18n.t('factory.nativeSelect.statusDraft', 'Draft'), value: 'draft' },
  { label: i18n.t('factory.nativeSelect.statusPending', 'Pending'), value: 'pending' },
  { label: i18n.t('factory.nativeSelect.statusInProgress', 'In Progress'), value: 'in-progress' },
  { label: i18n.t('factory.nativeSelect.statusInReview', 'In Review'), value: 'in-review' },
  { label: i18n.t('factory.nativeSelect.statusApproved', 'Approved'), value: 'approved' },
  { label: i18n.t('factory.nativeSelect.statusCompleted', 'Completed'), value: 'completed' },
  { label: i18n.t('factory.nativeSelect.statusCancelled', 'Cancelled'), value: 'cancelled' },
  { label: i18n.t('factory.nativeSelect.statusOnHold', 'On Hold'), value: 'on-hold' },
];

/** Size options */
export const NATIVE_SELECT_SIZES_OPTIONS = [
  { label: i18n.t('factory.nativeSelect.sizeExtraSmall', 'Extra Small'), value: 'xs' },
  { label: i18n.t('factory.nativeSelect.sizeSmall', 'Small'), value: 'sm' },
  { label: i18n.t('factory.nativeSelect.sizeMedium', 'Medium'), value: 'md' },
  { label: i18n.t('factory.nativeSelect.sizeLarge', 'Large'), value: 'lg' },
  { label: i18n.t('factory.nativeSelect.sizeExtraLarge', 'Extra Large'), value: 'xl' },
  { label: i18n.t('factory.nativeSelect.size2xl', '2XL'), value: '2xl' },
  { label: i18n.t('factory.nativeSelect.size3xl', '3XL'), value: '3xl' },
];

/** Timezone options */
export const NATIVE_SELECT_TIMEZONES = [
  {
    label: i18n.t('factory.nativeSelect.timezonePacificTime', 'Pacific Time (PT)'),
    value: 'America/Los_Angeles',
  },
  {
    label: i18n.t('factory.nativeSelect.timezoneMountainTime', 'Mountain Time (MT)'),
    value: 'America/Denver',
  },
  {
    label: i18n.t('factory.nativeSelect.timezoneCentralTime', 'Central Time (CT)'),
    value: 'America/Chicago',
  },
  {
    label: i18n.t('factory.nativeSelect.timezoneEasternTime', 'Eastern Time (ET)'),
    value: 'America/New_York',
  },
  { label: i18n.t('factory.nativeSelect.timezoneUtc', 'UTC'), value: 'UTC' },
  { label: i18n.t('factory.nativeSelect.timezoneLondon', 'London (GMT)'), value: 'Europe/London' },
  { label: i18n.t('factory.nativeSelect.timezoneParis', 'Paris (CET)'), value: 'Europe/Paris' },
  { label: i18n.t('factory.nativeSelect.timezoneTokyo', 'Tokyo (JST)'), value: 'Asia/Tokyo' },
  {
    label: i18n.t('factory.nativeSelect.timezoneSydney', 'Sydney (AEST)'),
    value: 'Australia/Sydney',
  },
];

/** Category to options mapping */
export const NATIVE_SELECT_OPTIONS_BY_CATEGORY: Record<
  NativeSelectOptionCategory,
  Array<{ label: string; value: string }>
> = {
  colors: NATIVE_SELECT_COLORS,
  countries: NATIVE_SELECT_COUNTRIES,
  currencies: NATIVE_SELECT_CURRENCIES,
  fruits: NATIVE_SELECT_FRUITS,
  languages: NATIVE_SELECT_LANGUAGES,
  months: NATIVE_SELECT_MONTHS,
  priorities: NATIVE_SELECT_PRIORITIES,
  sizes: NATIVE_SELECT_SIZES_OPTIONS,
  statuses: NATIVE_SELECT_STATUSES,
  timezones: NATIVE_SELECT_TIMEZONES,
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Fake option data structure
 */
export interface FakeNativeSelectOption {
  /** Whether the option is disabled */
  disabled?: boolean;
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Whether this is selected */
  selected?: boolean;
  /** Option value */
  value: string;
}

/**
 * Fake option group data structure
 */
export interface FakeNativeSelectOptGroup {
  /** Whether the group is disabled */
  disabled?: boolean;
  /** Unique identifier */
  id: string;
  /** Group label */
  label: string;
  /** Options in this group */
  options: FakeNativeSelectOption[];
}

/**
 * Fake native select data structure
 */
export interface FakeNativeSelect {
  /** Accessible label */
  ariaLabel?: string;
  /** Default selected value */
  defaultValue?: string;
  /** Whether the select is disabled */
  disabled: boolean;
  /** Unique identifier */
  id: string;
  /** Whether the select has invalid input */
  invalid: boolean;
  /** Whether multiple selection is allowed */
  multiple: boolean;
  /** Select name attribute */
  name: string;
  /** Option groups (optional) */
  optGroups?: FakeNativeSelectOptGroup[];
  /** Options in this select */
  options: FakeNativeSelectOption[];
  /** Placeholder option */
  placeholder?: string;
  /** Whether a selection is required */
  required: boolean;
  /** Select size */
  size: NativeSelectSize;
  /** Select state */
  state: NativeSelectState;
}

/**
 * Fake form field with native select
 */
export interface FakeNativeSelectFormField {
  /** Description/help text */
  description?: string;
  /** Error message */
  errorMessage?: string;
  /** Unique identifier */
  id: string;
  /** Label for the select */
  label: string;
  /** Whether the field is required */
  required: boolean;
  /** The native select configuration */
  select: FakeNativeSelect;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets options for a specific category
 * @param category - The option category
 * @returns Array of label/value pairs
 */
function getOptionsForCategory(
  category: NativeSelectOptionCategory
): Array<{ label: string; value: string }> {
  return NATIVE_SELECT_OPTIONS_BY_CATEGORY[category];
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake native select option
 * @param overrides - Optional property overrides
 * @returns Fake option object
 */
export function createFakeNativeSelectOption(
  overrides?: Partial<FakeNativeSelectOption>
): FakeNativeSelectOption {
  const label = faker.helpers.arrayElement([
    faker.commerce.productName(),
    faker.company.name(),
    faker.location.city(),
    faker.person.fullName(),
  ]);

  return {
    id: faker.string.uuid(),
    label,
    value: faker.string.alphanumeric(8),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    selected: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake option from category
 * @param category - The option category
 * @param overrides - Optional property overrides
 * @returns Fake option from the specified category
 */
export function createFakeNativeSelectOptionFromCategory(
  category: NativeSelectOptionCategory,
  overrides?: Partial<FakeNativeSelectOption>
): FakeNativeSelectOption {
  const categoryOptions = getOptionsForCategory(category);
  const option = faker.helpers.arrayElement(categoryOptions);

  return {
    id: faker.string.uuid(),
    label: option.label,
    value: option.value,
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake option group
 * @param overrides - Optional property overrides
 * @returns Fake option group object
 */
export function createFakeNativeSelectOptGroup(
  overrides?: Partial<FakeNativeSelectOptGroup>
): FakeNativeSelectOptGroup {
  const groupLabels = [
    i18n.t('factory.nativeSelect.popular', 'Popular'),
    i18n.t('factory.nativeSelect.recent', 'Recent'),
    i18n.t('factory.nativeSelect.favorites', 'Favorites'),
    i18n.t('factory.nativeSelect.all', 'All'),
    i18n.t('factory.nativeSelect.other', 'Other'),
    i18n.t('factory.nativeSelect.categoryA', 'Category A'),
    i18n.t('factory.nativeSelect.categoryB', 'Category B'),
    i18n.t('factory.nativeSelect.premium', 'Premium'),
    i18n.t('factory.nativeSelect.standard', 'Standard'),
    i18n.t('factory.nativeSelect.basic', 'Basic'),
  ];

  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(groupLabels),
    options: createFakeNativeSelectOptions(faker.number.int({ min: 2, max: 5 })),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake native select
 * @param overrides - Optional property overrides
 * @returns Fake native select object
 */
export function createFakeNativeSelect(overrides?: Partial<FakeNativeSelect>): FakeNativeSelect {
  const category = faker.helpers.arrayElement(NATIVE_SELECT_OPTION_CATEGORIES);
  const categoryOptions = getOptionsForCategory(category);
  const options = categoryOptions.map((opt) => ({
    id: faker.string.uuid(),
    label: opt.label,
    value: opt.value,
    disabled: faker.datatype.boolean({ probability: 0.05 }),
  }));

  const state = faker.helpers.arrayElement(NATIVE_SELECT_STATES);
  const hasPlaceholder = faker.datatype.boolean({ probability: 0.5 });

  return {
    id: faker.string.uuid(),
    name: faker.string.alphanumeric(8),
    options,
    size: faker.helpers.arrayElement(NATIVE_SELECT_SIZES),
    state,
    disabled: state === 'disabled',
    invalid: state === 'error',
    required: faker.datatype.boolean({ probability: 0.3 }),
    multiple: faker.datatype.boolean({ probability: 0.1 }),
    defaultValue: faker.helpers.maybe(() => faker.helpers.arrayElement(options).value, {
      probability: 0.6,
    }),
    placeholder: hasPlaceholder
      ? i18n.t('factory.nativeSelect.selectCategoryPlaceholder', 'Select {{category}}...', {
          category,
        })
      : undefined,
    ariaLabel: i18n.t('factory.nativeSelect.selectCategoryAria', 'Select {{category}}', {
      category,
    }),
    ...overrides,
  };
}

/**
 * Creates a fake form field with native select
 * @param overrides - Optional property overrides
 * @returns Fake form field object
 */
export function createFakeNativeSelectFormField(
  overrides?: Partial<FakeNativeSelectFormField>
): FakeNativeSelectFormField {
  const id = faker.string.uuid();
  const select = createFakeNativeSelect({ id });
  const hasError = select.state === 'error';

  const fieldLabels = [
    i18n.t('factory.nativeSelect.country', 'Country'),
    i18n.t('factory.nativeSelect.language', 'Language'),
    i18n.t('factory.nativeSelect.currency', 'Currency'),
    i18n.t('factory.nativeSelect.timezone', 'Timezone'),
    i18n.t('factory.nativeSelect.priority', 'Priority'),
    i18n.t('factory.nativeSelect.status', 'Status'),
    i18n.t('factory.nativeSelect.category', 'Category'),
    i18n.t('factory.nativeSelect.type', 'Type'),
    i18n.t('factory.nativeSelect.size', 'Size'),
    i18n.t('factory.nativeSelect.color', 'Color'),
  ];

  return {
    id,
    label: faker.helpers.arrayElement(fieldLabels),
    select,
    required: select.required,
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    errorMessage: hasError ? faker.lorem.sentence() : undefined,
    ...overrides,
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple native select options
 * @param count - Number of options to create
 * @returns Array of fake options
 */
export function createFakeNativeSelectOptions(count: number): FakeNativeSelectOption[] {
  return Array.from({ length: count }, () => createFakeNativeSelectOption());
}

/**
 * Creates options from a specific category
 * @param category - The option category
 * @param count - Optional max number of options
 * @returns Array of fake options from the category
 */
export function createFakeNativeSelectOptionsFromCategory(
  category: NativeSelectOptionCategory,
  count?: number
): FakeNativeSelectOption[] {
  const categoryOptions = getOptionsForCategory(category);
  const optionCount = count ?? categoryOptions.length;

  return categoryOptions.slice(0, optionCount).map((opt) => ({
    id: faker.string.uuid(),
    label: opt.label,
    value: opt.value,
    disabled: faker.datatype.boolean({ probability: 0.05 }),
  }));
}

/**
 * Creates multiple option groups
 * @param count - Number of groups to create
 * @returns Array of fake option groups
 */
export function createFakeNativeSelectOptGroups(count: number): FakeNativeSelectOptGroup[] {
  return Array.from({ length: count }, () => createFakeNativeSelectOptGroup());
}

/**
 * Creates multiple native selects
 * @param count - Number of selects to create
 * @returns Array of fake native selects
 */
export function createFakeNativeSelects(count: number): FakeNativeSelect[] {
  return Array.from({ length: count }, () => createFakeNativeSelect());
}

/**
 * Creates multiple form fields with native selects
 * @param count - Number of fields to create
 * @returns Array of fake form fields
 */
export function createFakeNativeSelectFormFields(count: number): FakeNativeSelectFormField[] {
  return Array.from({ length: count }, () => createFakeNativeSelectFormField());
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a country select
 * @returns Native select configured for countries
 */
export function createFakeCountrySelect(): FakeNativeSelect {
  return createFakeNativeSelect({
    options: createFakeNativeSelectOptionsFromCategory('countries'),
    ariaLabel: i18n.t('factory.nativeSelect.selectCountry', 'Select country'),
    placeholder: i18n.t('factory.nativeSelect.selectACountry', 'Select a country...'),
    name: 'country',
  });
}

/**
 * Creates a language select
 * @returns Native select configured for languages
 */
export function createFakeLanguageSelect(): FakeNativeSelect {
  return createFakeNativeSelect({
    options: createFakeNativeSelectOptionsFromCategory('languages'),
    ariaLabel: i18n.t('factory.nativeSelect.selectLanguage', 'Select language'),
    placeholder: i18n.t('factory.nativeSelect.selectALanguage', 'Select a language...'),
    name: 'language',
  });
}

/**
 * Creates a currency select
 * @returns Native select configured for currencies
 */
export function createFakeCurrencySelect(): FakeNativeSelect {
  return createFakeNativeSelect({
    options: createFakeNativeSelectOptionsFromCategory('currencies'),
    ariaLabel: i18n.t('factory.nativeSelect.selectCurrency', 'Select currency'),
    placeholder: i18n.t('factory.nativeSelect.selectACurrency', 'Select a currency...'),
    name: 'currency',
  });
}

/**
 * Creates a timezone select
 * @returns Native select configured for timezones
 */
export function createFakeTimezoneSelect(): FakeNativeSelect {
  return createFakeNativeSelect({
    options: createFakeNativeSelectOptionsFromCategory('timezones'),
    ariaLabel: i18n.t('factory.nativeSelect.selectTimezone', 'Select timezone'),
    placeholder: i18n.t('factory.nativeSelect.selectATimezone', 'Select a timezone...'),
    name: 'timezone',
  });
}

/**
 * Creates a priority select
 * @returns Native select configured for priorities
 */
export function createFakePrioritySelect(): FakeNativeSelect {
  return createFakeNativeSelect({
    options: createFakeNativeSelectOptionsFromCategory('priorities'),
    ariaLabel: i18n.t('factory.nativeSelect.selectPriority', 'Select priority'),
    placeholder: i18n.t('factory.nativeSelect.selectPriority2', 'Select priority...'),
    name: 'priority',
  });
}

/**
 * Creates a status select
 * @returns Native select configured for statuses
 */
export function createFakeStatusSelect(): FakeNativeSelect {
  return createFakeNativeSelect({
    options: createFakeNativeSelectOptionsFromCategory('statuses'),
    ariaLabel: i18n.t('factory.nativeSelect.selectStatus', 'Select status'),
    placeholder: i18n.t('factory.nativeSelect.selectStatus2', 'Select status...'),
    name: 'status',
  });
}

/**
 * Creates a month select
 * @returns Native select configured for months
 */
export function createFakeMonthSelect(): FakeNativeSelect {
  return createFakeNativeSelect({
    options: createFakeNativeSelectOptionsFromCategory('months'),
    ariaLabel: i18n.t('factory.nativeSelect.selectMonth', 'Select month'),
    placeholder: i18n.t('factory.nativeSelect.selectMonth2', 'Select month...'),
    name: 'month',
  });
}

/**
 * Creates a select with grouped options
 * @returns Native select with option groups
 */
export function createFakeGroupedSelect(): FakeNativeSelect {
  const popularFruits = NATIVE_SELECT_FRUITS.slice(0, 3).map((opt) => ({
    id: faker.string.uuid(),
    ...opt,
  }));

  const otherFruits = NATIVE_SELECT_FRUITS.slice(3).map((opt) => ({
    id: faker.string.uuid(),
    ...opt,
  }));

  return {
    id: faker.string.uuid(),
    name: 'grouped-select',
    options: [],
    optGroups: [
      {
        id: faker.string.uuid(),
        label: i18n.t('factory.nativeSelect.popular', 'Popular'),
        options: popularFruits,
      },
      {
        id: faker.string.uuid(),
        label: i18n.t('factory.nativeSelect.other', 'Other'),
        options: otherFruits,
      },
    ],
    size: 'md',
    state: 'default',
    disabled: false,
    invalid: false,
    required: false,
    multiple: false,
    ariaLabel: i18n.t('factory.nativeSelect.selectFruit', 'Select fruit'),
    placeholder: i18n.t('factory.nativeSelect.selectAFruit', 'Select a fruit...'),
  };
}

/**
 * Creates a multi-select configuration
 * @param category - Option category to use
 * @returns Native select configured for multiple selection
 */
export function createFakeMultiSelect(
  category: NativeSelectOptionCategory = 'colors'
): FakeNativeSelect {
  return createFakeNativeSelect({
    options: createFakeNativeSelectOptionsFromCategory(category),
    multiple: true,
    ariaLabel: i18n.t('factory.nativeSelect.selectCategoryAria', 'Select {{category}}', {
      category,
    }),
    name: `multi-${category}`,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of selects by size
 * @returns Array of selects, one for each size
 */
export function createFakeNativeSelectSizeMatrix(): FakeNativeSelect[] {
  return NATIVE_SELECT_SIZES.map((size) =>
    createFakeNativeSelect({
      size,
      ariaLabel: i18n.t('factory.nativeSelect.sizeAriaLabel', 'Size: {{size}}', { size }),
    })
  );
}

/**
 * Creates a matrix of selects by state
 * @returns Array of selects, one for each state
 */
export function createFakeNativeSelectStateMatrix(): FakeNativeSelect[] {
  return NATIVE_SELECT_STATES.map((state) =>
    createFakeNativeSelect({
      state,
      disabled: state === 'disabled',
      invalid: state === 'error',
      ariaLabel: i18n.t('factory.nativeSelect.stateAriaLabel', 'State: {{state}}', { state }),
    })
  );
}

/**
 * Creates a matrix of selects by category
 * @returns Array of selects, one for each category
 */
export function createFakeNativeSelectCategoryMatrix(): FakeNativeSelect[] {
  return NATIVE_SELECT_OPTION_CATEGORIES.map((category) =>
    createFakeNativeSelect({
      options: createFakeNativeSelectOptionsFromCategory(category),
      ariaLabel: i18n.t('factory.nativeSelect.categoryAriaLabel', 'Category: {{category}}', {
        category,
      }),
      name: category,
    })
  );
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all native select configurations
 * @returns Record of categorized native select configurations
 */
export function createFakeNativeSelectShowcase(): Record<string, unknown> {
  return {
    // Basic elements
    select: createFakeNativeSelect(),
    option: createFakeNativeSelectOption(),
    optGroup: createFakeNativeSelectOptGroup(),
    formField: createFakeNativeSelectFormField(),

    // Size variations
    selectSm: createFakeNativeSelect({ size: 'sm' }),
    selectMd: createFakeNativeSelect({ size: 'md' }),
    selectLg: createFakeNativeSelect({ size: 'lg' }),
    selectFull: createFakeNativeSelect({ size: 'full' }),

    // State variations
    selectDefault: createFakeNativeSelect({ state: 'default' }),
    selectFocused: createFakeNativeSelect({ state: 'focused' }),
    selectDisabled: createFakeNativeSelect({ state: 'disabled', disabled: true }),
    selectError: createFakeNativeSelect({ state: 'error', invalid: true }),

    // Feature variations
    selectRequired: createFakeNativeSelect({ required: true }),
    selectMultiple: createFakeNativeSelect({ multiple: true }),
    selectWithPlaceholder: createFakeNativeSelect({
      placeholder: i18n.t('factory.nativeSelect.selectAnOption', 'Select an option...'),
    }),
    selectWithGroups: createFakeGroupedSelect(),

    // Category-specific selects
    countrySelect: createFakeCountrySelect(),
    languageSelect: createFakeLanguageSelect(),
    currencySelect: createFakeCurrencySelect(),
    timezoneSelect: createFakeTimezoneSelect(),
    prioritySelect: createFakePrioritySelect(),
    statusSelect: createFakeStatusSelect(),
    monthSelect: createFakeMonthSelect(),

    // Multi-selects
    multiSelectColors: createFakeMultiSelect('colors'),
    multiSelectLanguages: createFakeMultiSelect('languages'),

    // Category options
    fruitsOptions: createFakeNativeSelectOptionsFromCategory('fruits'),
    colorsOptions: createFakeNativeSelectOptionsFromCategory('colors'),
    countriesOptions: createFakeNativeSelectOptionsFromCategory('countries'),
    languagesOptions: createFakeNativeSelectOptionsFromCategory('languages'),
    currenciesOptions: createFakeNativeSelectOptionsFromCategory('currencies'),
    monthsOptions: createFakeNativeSelectOptionsFromCategory('months'),
    prioritiesOptions: createFakeNativeSelectOptionsFromCategory('priorities'),
    statusesOptions: createFakeNativeSelectOptionsFromCategory('statuses'),
    sizesOptions: createFakeNativeSelectOptionsFromCategory('sizes'),
    timezonesOptions: createFakeNativeSelectOptionsFromCategory('timezones'),

    // Matrices
    sizeMatrix: createFakeNativeSelectSizeMatrix(),
    stateMatrix: createFakeNativeSelectStateMatrix(),
    categoryMatrix: createFakeNativeSelectCategoryMatrix(),
  };
}
