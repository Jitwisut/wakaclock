/**
 * Input Factory
 *
 * Provides faker-based test data generation for Input component stories.
 * Supports various input types, states, validation, and configurations.
 *
 * @module input.factory
 * @see {@link file://./../../../components/ui/input.tsx}
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// SHARED STRING CONSTANTS
// ============================================================================

const LABEL_EMAIL = i18n.t('factory.input.email', 'Email');
const LABEL_PASSWORD = i18n.t('factory.input.password', 'Password');

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Input field types
 */
export type InputType =
  | 'color'
  | 'date'
  | 'datetime-local'
  | 'email'
  | 'file'
  | 'hidden'
  | 'month'
  | 'number'
  | 'password'
  | 'search'
  | 'tel'
  | 'text'
  | 'time'
  | 'url'
  | 'week';

/**
 * Input size variant
 */
export type InputSize = 'default' | 'lg' | 'sm';

/**
 * Input validation state
 */
export type InputValidationState = 'error' | 'success' | 'warning';

/**
 * Input autocomplete type
 */
export type InputAutocomplete =
  | 'additional-name'
  | 'address-level1'
  | 'address-level2'
  | 'address-line1'
  | 'address-line2'
  | 'bday'
  | 'cc-exp'
  | 'cc-name'
  | 'cc-number'
  | 'country-name'
  | 'current-password'
  | 'email'
  | 'family-name'
  | 'given-name'
  | 'honorific-prefix'
  | 'name'
  | 'new-password'
  | 'off'
  | 'on'
  | 'one-time-code'
  | 'organization'
  | 'postal-code'
  | 'street-address'
  | 'tel'
  | 'username';

/**
 * Input mode for mobile keyboards
 */
export type InputMode =
  | 'decimal'
  | 'email'
  | 'none'
  | 'numeric'
  | 'search'
  | 'tel'
  | 'text'
  | 'url';

// ============================================================================
// CONSTANTS
// ============================================================================

/** All input types */
export const INPUT_TYPES: InputType[] = [
  'color',
  'date',
  'datetime-local',
  'email',
  'file',
  'hidden',
  'month',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'time',
  'url',
  'week',
];

/** Common input types for forms */
export const COMMON_INPUT_TYPES: InputType[] = [
  'email',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'url',
];

/** All input sizes */
export const INPUT_SIZES: InputSize[] = ['default', 'lg', 'sm'];

/** All validation states */
export const INPUT_VALIDATION_STATES: InputValidationState[] = ['error', 'success', 'warning'];

/** All input modes */
export const INPUT_MODES: InputMode[] = [
  'decimal',
  'email',
  'none',
  'numeric',
  'search',
  'tel',
  'text',
  'url',
];

/** Common placeholders by input type */
export const INPUT_PLACEHOLDERS: Record<InputType, string[]> = {
  color: [i18n.t('factory.input.pickAColor', 'Pick a color')],
  date: [
    i18n.t('factory.input.selectDate', 'Select date'),
    i18n.t('factory.input.pickADate', 'Pick a date'),
    i18n.t('factory.input.chooseDate', 'Choose date'),
  ],
  'datetime-local': [i18n.t('factory.input.selectDateAndTime', 'Select date and time')],
  email: [
    i18n.t('factory.input.youAtExampleCom', 'you@example.com'),
    i18n.t('factory.input.enterYourEmail', 'Enter your email'),
    i18n.t('factory.input.emailAddress', 'Email address'),
  ],
  file: [
    i18n.t('factory.input.chooseFile', 'Choose file'),
    i18n.t('factory.input.uploadFile', 'Upload file'),
    i18n.t('factory.input.selectFiles', 'Select files'),
  ],
  hidden: [],
  month: [i18n.t('factory.input.selectMonth', 'Select month')],
  number: [
    i18n.t('factory.input.enterAmount', 'Enter amount'),
    '0',
    i18n.t('factory.input.enterNumber', 'Enter number'),
  ],
  password: [
    i18n.t('factory.input.enterPassword', 'Enter password'),
    '••••••••',
    i18n.t('factory.input.yourPassword', 'Your password'),
  ],
  search: [
    i18n.t('factory.input.search', 'Search...'),
    i18n.t('factory.input.typeToSearch', 'Type to search'),
    i18n.t('factory.input.findSomething', 'Find something'),
  ],
  tel: [
    i18n.t('factory.input.phoneFormat', '+1 (555) 000-0000'),
    i18n.t('factory.input.phoneNumber', 'Phone number'),
    i18n.t('factory.input.enterPhone', 'Enter phone'),
  ],
  text: [
    i18n.t('factory.input.enterText', 'Enter text...'),
    i18n.t('factory.input.typeHere', 'Type here'),
    i18n.t('factory.input.enterValue', 'Enter value'),
  ],
  time: [i18n.t('factory.input.selectTime', 'Select time')],
  url: [
    i18n.t('factory.input.httpsExampleCom', 'https://example.com'),
    i18n.t('factory.input.websiteUrl', 'Website URL'),
    i18n.t('factory.input.enterUrl', 'Enter URL'),
  ],
  week: [i18n.t('factory.input.selectWeek', 'Select week')],
};

/** Common labels by input type */
export const INPUT_LABELS: Record<InputType, string[]> = {
  color: [
    i18n.t('factory.input.color', 'Color'),
    i18n.t('factory.input.themeColor', 'Theme Color'),
    i18n.t('factory.input.pickColor', 'Pick Color'),
  ],
  date: [
    i18n.t('factory.input.date', 'Date'),
    i18n.t('factory.input.birthDate', 'Birth Date'),
    i18n.t('factory.input.startDate', 'Start Date'),
    i18n.t('factory.input.endDate', 'End Date'),
  ],
  'datetime-local': [
    i18n.t('factory.input.dateTime', 'Date & Time'),
    i18n.t('factory.input.appointment', 'Appointment'),
    i18n.t('factory.input.schedule', 'Schedule'),
  ],
  email: [
    LABEL_EMAIL,
    i18n.t('factory.input.emailAddress2', 'Email Address'),
    i18n.t('factory.input.workEmail', 'Work Email'),
  ],
  file: [
    i18n.t('factory.input.file', 'File'),
    i18n.t('factory.input.upload', 'Upload'),
    i18n.t('factory.input.attachment', 'Attachment'),
  ],
  hidden: [i18n.t('factory.input.hidden', 'Hidden')],
  month: [
    i18n.t('factory.input.month', 'Month'),
    i18n.t('factory.input.billingMonth', 'Billing Month'),
  ],
  number: [
    i18n.t('factory.input.amount', 'Amount'),
    i18n.t('factory.input.quantity', 'Quantity'),
    i18n.t('factory.input.age', 'Age'),
    i18n.t('factory.input.price', 'Price'),
  ],
  password: [
    LABEL_PASSWORD,
    i18n.t('factory.input.currentPassword', 'Current Password'),
    i18n.t('factory.input.newPassword', 'New Password'),
  ],
  search: [
    i18n.t('factory.input.search2', 'Search'),
    i18n.t('factory.input.find', 'Find'),
    i18n.t('factory.input.query', 'Query'),
  ],
  tel: [
    i18n.t('factory.input.phone', 'Phone'),
    i18n.t('factory.input.mobile', 'Mobile'),
    i18n.t('factory.input.phoneNumber2', 'Phone Number'),
  ],
  text: [
    i18n.t('factory.input.name', 'Name'),
    i18n.t('factory.input.title', 'Title'),
    i18n.t('factory.input.username', 'Username'),
    i18n.t('factory.input.company', 'Company'),
  ],
  time: [
    i18n.t('factory.input.time', 'Time'),
    i18n.t('factory.input.startTime', 'Start Time'),
    i18n.t('factory.input.endTime', 'End Time'),
  ],
  url: [
    i18n.t('factory.input.website', 'Website'),
    i18n.t('factory.input.url', 'URL'),
    i18n.t('factory.input.link', 'Link'),
  ],
  week: [
    i18n.t('factory.input.week', 'Week'),
    i18n.t('factory.input.scheduleWeek', 'Schedule Week'),
  ],
};

/** Error messages by input type */
export const INPUT_ERRORS: Record<InputType, string[]> = {
  color: [i18n.t('factory.input.invalidColor', 'Invalid color')],
  date: [
    i18n.t('factory.input.invalidDate', 'Invalid date'),
    i18n.t('factory.input.dateIsRequired', 'Date is required'),
  ],
  'datetime-local': [i18n.t('factory.input.invalidDatetime', 'Invalid date/time')],
  email: [
    i18n.t('factory.input.invalidEmail', 'Invalid email'),
    i18n.t('factory.input.emailIsRequired', 'Email is required'),
    i18n.t('factory.input.enterAValidEmail', 'Enter a valid email'),
  ],
  file: [
    i18n.t('factory.input.fileIsRequired', 'File is required'),
    i18n.t('factory.input.invalidFileType', 'Invalid file type'),
  ],
  hidden: [],
  month: [i18n.t('factory.input.invalidMonth', 'Invalid month')],
  number: [
    i18n.t('factory.input.invalidNumber', 'Invalid number'),
    i18n.t('factory.input.enterAValidNumber', 'Enter a valid number'),
    i18n.t('factory.input.mustBeAPositiveNumber', 'Must be a positive number'),
  ],
  password: [
    i18n.t('factory.input.passwordIsRequired', 'Password is required'),
    i18n.t('factory.input.passwordTooShort', 'Password too short'),
    i18n.t('factory.input.passwordTooWeak', 'Password too weak'),
  ],
  search: [i18n.t('factory.input.searchTermRequired', 'Search term required')],
  tel: [
    i18n.t('factory.input.invalidPhoneNumber', 'Invalid phone number'),
    i18n.t('factory.input.phoneNumberRequired', 'Phone number required'),
  ],
  text: [
    i18n.t('factory.input.thisFieldIsRequired', 'This field is required'),
    i18n.t('factory.input.tooShort', 'Too short'),
    i18n.t('factory.input.tooLong', 'Too long'),
  ],
  time: [i18n.t('factory.input.invalidTime', 'Invalid time')],
  url: [
    i18n.t('factory.input.invalidUrl', 'Invalid URL'),
    i18n.t('factory.input.enterAValidUrl', 'Enter a valid URL'),
  ],
  week: [i18n.t('factory.input.invalidWeek', 'Invalid week')],
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base input configuration
 */
export interface FakeInput {
  /** Autocomplete attribute */
  autocomplete?: InputAutocomplete;
  /** Default value */
  defaultValue?: string;
  /** Whether input is disabled */
  disabled: boolean;
  /** Error message */
  error?: string;
  /** Input ID */
  id: string;
  /** Input mode for mobile */
  inputMode?: InputMode;
  /** Input label */
  label: string;
  /** Maximum value/length */
  max?: number | string;
  /** Maximum character length */
  maxLength?: number;
  /** Minimum value/length */
  min?: number | string;
  /** Minimum character length */
  minLength?: number;
  /** Input name */
  name?: string;
  /** Pattern for validation */
  pattern?: string;
  /** Placeholder text */
  placeholder: string;
  /** Whether input is read-only */
  readOnly?: boolean;
  /** Whether input is required */
  required: boolean;
  /** Input size */
  size?: InputSize;
  /** Step for number inputs */
  step?: number | string;
  /** Input type */
  type: InputType;
  /** Validation state */
  validationState?: InputValidationState;
}

/**
 * Password input configuration
 */
export interface FakePasswordInput extends FakeInput {
  /** Confirm password field */
  confirmField?: FakeInput;
  /** Password requirements */
  requirements?: {
    /** Minimum length */
    minLength: number;
    /** Require lowercase */
    requireLowercase: boolean;
    /** Require number */
    requireNumber: boolean;
    /** Require special character */
    requireSpecial: boolean;
    /** Require uppercase */
    requireUppercase: boolean;
  };
  /** Show password toggle */
  showToggle: boolean;
  type: 'password';
}

/**
 * Search input configuration
 */
export interface FakeSearchInput extends FakeInput {
  /** Clear button */
  clearable: boolean;
  /** Search suggestions */
  suggestions?: string[];
  type: 'search';
}

/**
 * Number input configuration
 */
export interface FakeNumberInput extends FakeInput {
  /** Currency symbol */
  currency?: string;
  /** Decimal places */
  decimals?: number;
  /** Max value */
  max?: number;
  /** Min value */
  min?: number;
  /** Show stepper */
  showStepper?: boolean;
  /** Step value */
  step?: number;
  type: 'number';
  /** Unit suffix */
  unit?: string;
}

/**
 * File input configuration
 */
export interface FakeFileInput extends FakeInput {
  /** Accepted file types */
  accept?: string;
  /** Allow multiple files */
  multiple?: boolean;
  type: 'file';
}

/**
 * Textarea configuration
 */
export interface FakeTextarea {
  /** Default value */
  defaultValue?: string;
  /** Whether textarea is disabled */
  disabled: boolean;
  /** Error message */
  error?: string;
  /** Textarea ID */
  id: string;
  /** Textarea label */
  label: string;
  /** Maximum character length */
  maxLength?: number;
  /** Minimum character length */
  minLength?: number;
  /** Textarea name */
  name?: string;
  /** Placeholder text */
  placeholder: string;
  /** Whether textarea is read-only */
  readOnly?: boolean;
  /** Whether textarea is required */
  required: boolean;
  /** Auto-resize behavior */
  resize?: 'both' | 'horizontal' | 'none' | 'vertical';
  /** Number of rows */
  rows: number;
  /** Show character count */
  showCount?: boolean;
}

/**
 * Field configuration
 */
export interface FakeField {
  /** Field description */
  description?: string;
  /** Error message */
  error?: string;
  /** Field ID */
  id: string;
  /** Field label */
  label: string;
  /** Whether field is required */
  required: boolean;
}

/**
 * Label configuration
 */
export interface FakeLabel {
  /** Associated input ID */
  htmlFor: string;
  /** Label ID */
  id: string;
  /** Whether associated field is required */
  required: boolean;
  /** Label text */
  text: string;
}

/**
 * Input group configuration
 */
export interface FakeInputGroup {
  /** Group ID */
  id: string;
  /** Inputs in group */
  inputs: FakeInput[];
  /** Prefix text/element */
  prefix?: string;
  /** Suffix text/element */
  suffix?: string;
}

/**
 * OTP input configuration
 */
export interface FakeInputOtp {
  /** Whether input is disabled */
  disabled: boolean;
  /** Input ID */
  id: string;
  /** Number of digits */
  length: number;
  /** Whether to mask input */
  masked?: boolean;
  /** Separator between groups */
  separator?: string;
  /** Current value */
  value?: string;
}

/**
 * Input with icon configuration
 */
export interface FakeInputWithIcon extends FakeInput {
  /** Icon name */
  icon: string;
  /** Icon position */
  iconPosition: 'left' | 'right';
}

/**
 * Complete form input configuration
 */
export interface FakeFormInput {
  /** Field description */
  description?: string;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Input configuration */
  input: FakeInput;
  /** Label text */
  label: string;
  /** Whether field is required */
  required?: boolean;
}

// ============================================================================
// HELPER FACTORIES
// ============================================================================

/**
 * Creates a fake input
 */
export function createFakeInput(overrides?: Partial<FakeInput>): FakeInput {
  const type = overrides?.type ?? faker.helpers.arrayElement(COMMON_INPUT_TYPES);
  const placeholders = INPUT_PLACEHOLDERS[type];
  const labels = INPUT_LABELS[type];

  return {
    autocomplete: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement(['off', 'on', 'email', 'name', 'tel'] as InputAutocomplete[]),
      { probability: 0.3 }
    ),
    defaultValue: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    error: faker.helpers.maybe(
      () => faker.helpers.arrayElement(INPUT_ERRORS[type] || INPUT_ERRORS.text),
      { probability: 0.1 }
    ),
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(labels),
    name: faker.helpers.slugify(faker.lorem.word()).toLowerCase(),
    placeholder: faker.helpers.arrayElement(placeholders),
    required: faker.datatype.boolean({ probability: 0.3 }),
    type,
    ...overrides,
  };
}

/**
 * Creates multiple fake inputs
 */
export function createFakeInputs(count: number): FakeInput[] {
  return Array.from({ length: count }, () => createFakeInput());
}

/**
 * Creates a fake password input
 */
export function createFakePasswordInput(overrides?: Partial<FakePasswordInput>): FakePasswordInput {
  return {
    ...createFakeInput({
      type: 'password',
      label: i18n.t('factory.input.password', 'Password'),
      placeholder: '••••••••',
    }),
    confirmField: faker.helpers.maybe(
      () =>
        createFakeInput({
          type: 'password',
          label: i18n.t('factory.input.confirmPassword', 'Confirm Password'),
        }),
      { probability: 0.5 }
    ),
    requirements: {
      minLength: 8,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: faker.datatype.boolean(),
      requireUppercase: true,
    },
    showToggle: true,
    type: 'password',
    ...overrides,
  };
}

/**
 * Creates a fake search input
 */
export function createFakeSearchInput(overrides?: Partial<FakeSearchInput>): FakeSearchInput {
  const categories = [
    i18n.t('factory.input.products', 'Products'),
    i18n.t('factory.input.users', 'Users'),
    i18n.t('factory.input.documents', 'Documents'),
    i18n.t('factory.input.orders', 'Orders'),
    i18n.t('factory.input.settings', 'Settings'),
    i18n.t('factory.input.help', 'Help'),
  ];

  return {
    ...createFakeInput({
      type: 'search',
      label: i18n.t('factory.input.searchLabel', 'Search'),
      placeholder: i18n.t('factory.input.search', 'Search...'),
    }),
    clearable: true,
    suggestions: faker.helpers.maybe(
      () => faker.helpers.arrayElements(categories, faker.number.int({ min: 3, max: 6 })),
      { probability: 0.4 }
    ),
    type: 'search',
    ...overrides,
  };
}

/**
 * Creates a fake number input
 */
export function createFakeNumberInput(overrides?: Partial<FakeNumberInput>): FakeNumberInput {
  return {
    ...createFakeInput({
      type: 'number',
      label: i18n.t('factory.input.amount', 'Amount'),
      placeholder: '0',
    }),
    currency: faker.helpers.maybe(() => faker.helpers.arrayElement(['$', '€', '£', '¥']), {
      probability: 0.3,
    }),
    decimals: faker.helpers.maybe(() => faker.number.int({ min: 0, max: 4 }), {
      probability: 0.4,
    }),
    max: faker.helpers.maybe(() => faker.number.int({ min: 100, max: 10_000 }), {
      probability: 0.3,
    }),
    min: faker.helpers.maybe(() => faker.number.int({ min: 0, max: 10 }), { probability: 0.3 }),
    showStepper: faker.datatype.boolean({ probability: 0.3 }),
    step: faker.helpers.maybe(() => faker.helpers.arrayElement([1, 5, 10, 0.01, 0.1]), {
      probability: 0.4,
    }),
    type: 'number',
    unit: faker.helpers.maybe(() => faker.helpers.arrayElement(['kg', 'lbs', 'm', 'ft', '%']), {
      probability: 0.2,
    }),
    ...overrides,
  };
}

/**
 * Creates a fake file input
 */
export function createFakeFileInput(overrides?: Partial<FakeFileInput>): FakeFileInput {
  const acceptOptions = ['image/*', '.pdf', '.doc,.docx', '.csv,.xlsx', 'image/png,image/jpeg'];

  return {
    ...createFakeInput({
      type: 'file',
      label: i18n.t('factory.input.uploadFile', 'Upload File'),
      placeholder: i18n.t('factory.input.chooseFile', 'Choose file'),
    }),
    accept: faker.helpers.maybe(() => faker.helpers.arrayElement(acceptOptions), {
      probability: 0.6,
    }),
    multiple: faker.datatype.boolean({ probability: 0.3 }),
    type: 'file',
    ...overrides,
  };
}

/**
 * Creates a fake textarea
 */
export function createFakeTextarea(overrides?: Partial<FakeTextarea>): FakeTextarea {
  return {
    defaultValue: faker.helpers.maybe(() => faker.lorem.paragraph(), { probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    error: faker.helpers.maybe(
      () => i18n.t('factory.input.thisFieldIsRequired', 'This field is required'),
      { probability: 0.1 }
    ),
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.input.description', 'Description'),
      i18n.t('factory.input.comments', 'Comments'),
      i18n.t('factory.input.message', 'Message'),
      i18n.t('factory.input.notes', 'Notes'),
      'Bio',
      i18n.t('factory.input.details', 'Details'),
    ]),
    maxLength: faker.helpers.maybe(() => faker.number.int({ min: 100, max: 500 }), {
      probability: 0.3,
    }),
    minLength: faker.helpers.maybe(() => faker.number.int({ min: 10, max: 50 }), {
      probability: 0.2,
    }),
    placeholder: faker.helpers.arrayElement([
      i18n.t('factory.input.enterDescription', 'Enter description...'),
      i18n.t('factory.input.writeYourMessage', 'Write your message...'),
      i18n.t('factory.input.addNotes', 'Add notes...'),
    ]),
    required: faker.datatype.boolean({ probability: 0.3 }),
    resize: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['vertical', 'horizontal', 'both', 'none'] as const),
      { probability: 0.3 }
    ),
    rows: faker.number.int({ min: 3, max: 10 }),
    showCount: faker.datatype.boolean({ probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake textareas
 */
export function createFakeTextareas(count: number): FakeTextarea[] {
  return Array.from({ length: count }, () => createFakeTextarea());
}

/**
 * Creates a fake field
 */
export function createFakeField(overrides?: Partial<FakeField>): FakeField {
  return {
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 }),
    error: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.input.required', 'Required'),
          i18n.t('factory.input.invalid', 'Invalid'),
          i18n.t('factory.input.tooShort', 'Too short'),
        ]),
      { probability: 0.1 }
    ),
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      LABEL_EMAIL,
      LABEL_PASSWORD,
      i18n.t('factory.input.username', 'Username'),
      i18n.t('factory.input.fullName', 'Full Name'),
      i18n.t('factory.input.phoneNumber2', 'Phone Number'),
    ]),
    required: faker.datatype.boolean({ probability: 0.5 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake fields
 */
export function createFakeFields(count: number): FakeField[] {
  return Array.from({ length: count }, () => createFakeField());
}

/**
 * Creates a fake label
 */
export function createFakeLabel(overrides?: Partial<FakeLabel>): FakeLabel {
  return {
    htmlFor: faker.string.uuid(),
    id: faker.string.uuid(),
    required: faker.datatype.boolean({ probability: 0.4 }),
    text: faker.helpers.arrayElement([
      i18n.t('factory.input.name', 'Name'),
      LABEL_EMAIL,
      LABEL_PASSWORD,
      i18n.t('factory.input.phone', 'Phone'),
      i18n.t('factory.input.address', 'Address'),
      i18n.t('factory.input.city', 'City'),
      i18n.t('factory.input.country', 'Country'),
    ]),
    ...overrides,
  };
}

/**
 * Creates multiple fake labels
 */
export function createFakeLabels(count: number): FakeLabel[] {
  return Array.from({ length: count }, () => createFakeLabel());
}

/**
 * Creates a fake input group
 */
export function createFakeInputGroup(overrides?: Partial<FakeInputGroup>): FakeInputGroup {
  return {
    id: faker.string.uuid(),
    inputs: createFakeInputs(faker.number.int({ min: 1, max: 3 })),
    prefix: faker.helpers.maybe(() => faker.helpers.arrayElement(['$', '@', 'https://']), {
      probability: 0.3,
    }),
    suffix: faker.helpers.maybe(() => faker.helpers.arrayElement(['.com', '%', 'USD']), {
      probability: 0.3,
    }),
    ...overrides,
  };
}

/**
 * Creates multiple fake input groups
 */
export function createFakeInputGroups(count: number): FakeInputGroup[] {
  return Array.from({ length: count }, () => createFakeInputGroup());
}

/**
 * Creates a fake OTP input
 */
export function createFakeInputOtp(overrides?: Partial<FakeInputOtp>): FakeInputOtp {
  const length = overrides?.length ?? faker.number.int({ min: 4, max: 6 });
  return {
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    id: faker.string.uuid(),
    length,
    masked: faker.datatype.boolean({ probability: 0.2 }),
    separator: faker.helpers.maybe(() => faker.helpers.arrayElement(['-', ' ', '·']), {
      probability: 0.3,
    }),
    value: faker.helpers.maybe(() => faker.string.numeric(length), { probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake OTP inputs
 */
export function createFakeInputOtps(count: number): FakeInputOtp[] {
  return Array.from({ length: count }, () => createFakeInputOtp());
}

/**
 * Creates a fake input with icon
 */
export function createFakeInputWithIcon(overrides?: Partial<FakeInputWithIcon>): FakeInputWithIcon {
  const icons = ['search', 'mail', 'user', 'lock', 'phone', 'calendar', 'link'];

  return {
    ...createFakeInput(),
    icon: faker.helpers.arrayElement(icons),
    iconPosition: faker.helpers.arrayElement(['left', 'right']),
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates an email input configuration
 */
export function createFakeEmailInput(): FakeInput {
  return createFakeInput({
    autocomplete: 'email',
    inputMode: 'email',
    label: LABEL_EMAIL,
    name: 'email',
    placeholder: 'you@example.com',
    required: true,
    type: 'email',
  });
}

/**
 * Creates a phone input configuration
 */
export function createFakePhoneInput(): FakeInput {
  return createFakeInput({
    autocomplete: 'tel',
    inputMode: 'tel',
    label: i18n.t('factory.input.phoneNumber2', 'Phone Number'),
    name: 'phone',
    placeholder: '+1 (555) 000-0000',
    type: 'tel',
  });
}

/**
 * Creates a URL input configuration
 */
export function createFakeUrlInput(): FakeInput {
  return createFakeInput({
    inputMode: 'url',
    label: i18n.t('factory.input.website', 'Website'),
    name: 'website',
    placeholder: 'https://example.com',
    type: 'url',
  });
}

/**
 * Creates a date input configuration
 */
export function createFakeDateInput(): FakeInput {
  return createFakeInput({
    label: i18n.t('factory.input.date', 'Date'),
    name: 'date',
    type: 'date',
  });
}

/**
 * Creates a login form input set
 */
export function createFakeLoginInputs(): { email: FakeInput; password: FakePasswordInput } {
  return {
    email: createFakeEmailInput(),
    password: createFakePasswordInput({
      label: LABEL_PASSWORD,
      name: 'password',
      required: true,
    }),
  };
}

/**
 * Creates a registration form input set
 */
export function createFakeRegistrationInputs(): {
  confirmPassword: FakePasswordInput;
  email: FakeInput;
  firstName: FakeInput;
  lastName: FakeInput;
  password: FakePasswordInput;
} {
  return {
    confirmPassword: createFakePasswordInput({
      label: i18n.t('factory.input.confirmPassword', 'Confirm Password'),
      name: 'confirmPassword',
      required: true,
    }),
    email: createFakeEmailInput(),
    firstName: createFakeInput({
      autocomplete: 'given-name',
      label: i18n.t('factory.input.firstName', 'First Name'),
      name: 'firstName',
      placeholder: i18n.t('factory.input.john', 'John'),
      required: true,
      type: 'text',
    }),
    lastName: createFakeInput({
      autocomplete: 'family-name',
      label: i18n.t('factory.input.lastName', 'Last Name'),
      name: 'lastName',
      placeholder: i18n.t('factory.input.doe', 'Doe'),
      required: true,
      type: 'text',
    }),
    password: createFakePasswordInput({
      label: LABEL_PASSWORD,
      name: 'password',
      required: true,
    }),
  };
}

/**
 * Creates a contact form input set
 */
export function createFakeContactInputs(): {
  email: FakeInput;
  message: FakeTextarea;
  name: FakeInput;
  phone: FakeInput;
  subject: FakeInput;
} {
  return {
    email: createFakeEmailInput(),
    message: createFakeTextarea({
      label: i18n.t('factory.input.message', 'Message'),
      minLength: 10,
      name: 'message',
      placeholder: i18n.t('factory.input.howCanWeHelpYou', 'How can we help you?'),
      required: true,
      rows: 5,
    }),
    name: createFakeInput({
      autocomplete: 'name',
      label: i18n.t('factory.input.name', 'Name'),
      name: 'name',
      placeholder: i18n.t('factory.input.yourName', 'Your name'),
      required: true,
      type: 'text',
    }),
    phone: createFakePhoneInput(),
    subject: createFakeInput({
      label: i18n.t('factory.input.subject', 'Subject'),
      name: 'subject',
      placeholder: i18n.t('factory.input.whatIsThisAbout', 'What is this about?'),
      required: true,
      type: 'text',
    }),
  };
}

/**
 * Creates a profile form input set
 */
export function createFakeProfileInputs(): {
  bio: FakeTextarea;
  company: FakeInput;
  email: FakeInput;
  firstName: FakeInput;
  lastName: FakeInput;
  phone: FakeInput;
  website: FakeInput;
} {
  return {
    bio: createFakeTextarea({
      label: i18n.t('factory.input.bio', 'Bio'),
      maxLength: 300,
      name: 'bio',
      placeholder: i18n.t('factory.input.tellUsAboutYourself', 'Tell us about yourself...'),
      rows: 4,
      showCount: true,
    }),
    company: createFakeInput({
      autocomplete: 'organization',
      label: i18n.t('factory.input.company', 'Company'),
      name: 'company',
      placeholder: i18n.t('factory.input.yourCompany', 'Your company'),
      type: 'text',
    }),
    email: createFakeEmailInput(),
    firstName: createFakeInput({
      autocomplete: 'given-name',
      label: i18n.t('factory.input.firstName', 'First Name'),
      name: 'firstName',
      placeholder: i18n.t('factory.input.john', 'John'),
      required: true,
      type: 'text',
    }),
    lastName: createFakeInput({
      autocomplete: 'family-name',
      label: i18n.t('factory.input.lastName', 'Last Name'),
      name: 'lastName',
      placeholder: i18n.t('factory.input.doe', 'Doe'),
      required: true,
      type: 'text',
    }),
    phone: createFakePhoneInput(),
    website: createFakeUrlInput(),
  };
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of inputs by type
 */
export function createFakeInputTypeMatrix(): Record<InputType, FakeInput> {
  const result = {} as Record<InputType, FakeInput>;

  for (const type of INPUT_TYPES) {
    result[type] = createFakeInput({ type });
  }

  return result;
}

/**
 * Creates a matrix of inputs by size
 */
export function createFakeInputSizeMatrix(): Record<InputSize, FakeInput> {
  return {
    default: createFakeInput({ size: 'default' }),
    lg: createFakeInput({ size: 'lg' }),
    sm: createFakeInput({ size: 'sm' }),
  };
}

/**
 * Creates a matrix of inputs by validation state
 */
export function createFakeInputValidationMatrix(): Record<InputValidationState, FakeInput> {
  return {
    error: createFakeInput({
      error: i18n.t('factory.input.thisFieldIsRequired', 'This field is required'),
      validationState: 'error',
    }),
    success: createFakeInput({
      validationState: 'success',
    }),
    warning: createFakeInput({
      error: i18n.t('factory.input.considerAStrongerValue', 'Consider a stronger value'),
      validationState: 'warning',
    }),
  };
}

/**
 * Creates a showcase of all input types
 */
export function createFakeInputShowcase(): Record<
  string,
  FakeFileInput | FakeInput | FakeNumberInput | FakePasswordInput | FakeSearchInput
> {
  return {
    date: createFakeDateInput(),
    email: createFakeEmailInput(),
    file: createFakeFileInput(),
    number: createFakeNumberInput(),
    password: createFakePasswordInput(),
    phone: createFakePhoneInput(),
    search: createFakeSearchInput(),
    text: createFakeInput({ type: 'text' }),
    url: createFakeUrlInput(),
  };
}

/**
 * Creates fake input form data with common fields for input story testing
 */
export function createFakeInputFormData(): {
  address: string;
  email: string;
  name: string;
  phone: string;
} {
  return {
    address: faker.location.streetAddress(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    phone: faker.phone.number(),
  };
}
