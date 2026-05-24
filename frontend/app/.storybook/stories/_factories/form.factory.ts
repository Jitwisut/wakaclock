/**
 * Form Factory
 *
 * Provides faker-based test data generation for Form component stories.
 * Supports various form configurations, validation states, and field types.
 *
 * @module form.factory
 * @see {@link file://./../../../components/ui/form.tsx}
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Form field input types
 */
export type FormFieldType =
  | 'checkbox'
  | 'date'
  | 'datetime-local'
  | 'email'
  | 'file'
  | 'hidden'
  | 'month'
  | 'number'
  | 'password'
  | 'radio'
  | 'range'
  | 'search'
  | 'select'
  | 'tel'
  | 'text'
  | 'textarea'
  | 'time'
  | 'url'
  | 'week';

/**
 * Form validation mode
 */
export type FormValidationMode = 'all' | 'onBlur' | 'onChange' | 'onSubmit' | 'onTouched';

/**
 * Form submission status
 */
export type FormSubmissionStatus = 'error' | 'idle' | 'loading' | 'success';

/**
 * Form layout type
 */
export type FormLayoutType = 'horizontal' | 'inline' | 'stacked' | 'vertical';

/**
 * Form size variant
 */
export type FormSizeVariant = 'compact' | 'default' | 'spacious';

/**
 * Validation error severity
 */
export type ValidationSeverity = 'error' | 'info' | 'success' | 'warning';

// ============================================================================
// SHARED STRING CONSTANTS
// ============================================================================

const LABEL_CANCEL = i18n.t('factory.form.cancel', 'Cancel');
const LABEL_EMAIL = i18n.t('factory.form.email', 'Email');

// ============================================================================
// CONSTANTS
// ============================================================================

/** All form field types */
export const FORM_FIELD_TYPES: FormFieldType[] = [
  'checkbox',
  'date',
  'datetime-local',
  'email',
  'file',
  'hidden',
  'month',
  'number',
  'password',
  'radio',
  'range',
  'search',
  'select',
  'tel',
  'text',
  'textarea',
  'time',
  'url',
  'week',
];

/** All validation modes */
export const FORM_VALIDATION_MODES: FormValidationMode[] = [
  'all',
  'onBlur',
  'onChange',
  'onSubmit',
  'onTouched',
];

/** All submission statuses */
export const FORM_SUBMISSION_STATUSES: FormSubmissionStatus[] = [
  'error',
  'idle',
  'loading',
  'success',
];

/** All layout types */
export const FORM_LAYOUT_TYPES: FormLayoutType[] = ['horizontal', 'inline', 'stacked', 'vertical'];

/** All size variants */
export const FORM_SIZE_VARIANTS: FormSizeVariant[] = ['compact', 'default', 'spacious'];

/** Common form button labels */
export const FORM_BUTTON_LABELS = [
  i18n.t('factory.form.submit', 'Submit'),
  i18n.t('factory.form.save', 'Save'),
  i18n.t('factory.form.continue', 'Continue'),
  i18n.t('factory.form.next', 'Next'),
  i18n.t('factory.form.create', 'Create'),
  i18n.t('factory.form.update', 'Update'),
  i18n.t('factory.form.register', 'Register'),
  i18n.t('factory.form.signIn', 'Sign In'),
  i18n.t('factory.form.signUp', 'Sign Up'),
  i18n.t('factory.form.send', 'Send'),
  i18n.t('factory.form.apply', 'Apply'),
  i18n.t('factory.form.confirm', 'Confirm'),
];

/** Common form cancel button labels */
export const FORM_CANCEL_LABELS = [
  LABEL_CANCEL,
  i18n.t('factory.form.back', 'Back'),
  i18n.t('factory.form.reset', 'Reset'),
  i18n.t('factory.form.clear', 'Clear'),
  i18n.t('factory.form.discard', 'Discard'),
  i18n.t('factory.form.close', 'Close'),
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Form select option
 */
export interface FakeOption {
  /** Option description */
  description?: string;
  /** Whether option is disabled */
  disabled?: boolean;
  /** Option display label */
  label: string;
  /** Option value */
  value: string;
}

/**
 * Form option group
 */
export interface FakeOptionGroup {
  /** Group label */
  label: string;
  /** Group options */
  options: FakeOption[];
}

/**
 * Form field configuration
 */
export interface FakeFormField {
  /** Default value */
  defaultValue?: boolean | number | string;
  /** Field description/help text */
  description?: string;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Field ID */
  id: string;
  /** Field label */
  label: string;
  /** Maximum value/length */
  max?: number | string;
  /** Maximum length */
  maxLength?: number;
  /** Minimum value/length */
  min?: number | string;
  /** Minimum length */
  minLength?: number;
  /** Field name */
  name: string;
  /** Options for select/radio */
  options?: FakeOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Whether field is read-only */
  readOnly?: boolean;
  /** Whether field is required */
  required?: boolean;
  /** Step for number inputs */
  step?: number | string;
  /** Field type */
  type: FormFieldType;
}

/**
 * Validation rule configuration
 */
export interface FakeValidationRule {
  /** Error message */
  message: string;
  /** Pattern for regex validation */
  pattern?: RegExp;
  /** Rule type */
  type: 'custom' | 'email' | 'max' | 'maxLength' | 'min' | 'minLength' | 'pattern' | 'required';
  /** Rule value */
  value?: boolean | number | string;
}

/**
 * Validation error
 */
export interface FakeValidationError {
  /** Error code */
  code: string;
  /** Field name */
  field: string;
  /** Error message */
  message: string;
  /** Error severity */
  severity?: ValidationSeverity;
}

/**
 * Form data (generic contact form)
 */
export interface FakeFormData {
  /** Street address */
  address: string;
  /** Terms agreement */
  agree: boolean;
  /** City */
  city: string;
  /** Country */
  country: string;
  /** Email address */
  email: string;
  /** Message content */
  message: string;
  /** Full name */
  name: string;
  /** Newsletter subscription */
  newsletter: boolean;
  /** Phone number */
  phone: string;
  /** ZIP/postal code */
  zipCode: string;
}

/**
 * Login form data
 */
export interface FakeLoginFormData {
  /** Email or username */
  email: string;
  /** Password */
  password: string;
  /** Remember me */
  rememberMe?: boolean;
}

/**
 * Registration form data
 */
export interface FakeRegistrationFormData {
  /** Confirm password */
  confirmPassword: string;
  /** Email address */
  email: string;
  /** First name */
  firstName: string;
  /** Last name */
  lastName: string;
  /** Password */
  password: string;
  /** Phone number */
  phone?: string;
  /** Terms acceptance */
  termsAccepted: boolean;
  /** Username */
  username?: string;
}

/**
 * Profile form data
 */
export interface FakeProfileFormData {
  /** Avatar URL */
  avatar?: string;
  /** Bio/description */
  bio?: string;
  /** Company name */
  company?: string;
  /** Date of birth */
  dateOfBirth?: string;
  /** Email address */
  email: string;
  /** First name */
  firstName: string;
  /** Job title */
  jobTitle?: string;
  /** Last name */
  lastName: string;
  /** Location/address */
  location?: string;
  /** Phone number */
  phone?: string;
  /** Website URL */
  website?: string;
}

/**
 * Contact form data
 */
export interface FakeContactFormData {
  /** Company name */
  company?: string;
  /** Email address */
  email: string;
  /** Message content */
  message: string;
  /** Full name */
  name: string;
  /** Phone number */
  phone?: string;
  /** Subject line */
  subject: string;
}

/**
 * Checkout form data
 */
export interface FakeCheckoutFormData {
  /** Billing address */
  billingAddress: {
    /** City */
    city: string;
    /** Country */
    country: string;
    /** Address line 1 */
    line1: string;
    /** Address line 2 */
    line2?: string;
    /** State/province */
    state: string;
    /** ZIP/postal code */
    zipCode: string;
  };
  /** Contact email */
  email: string;
  /** Card expiry date */
  expiryDate: string;
  /** Full name */
  fullName: string;
  /** Whether billing matches shipping */
  sameAsShipping: boolean;
  /** Shipping address */
  shippingAddress: {
    /** City */
    city: string;
    /** Country */
    country: string;
    /** Address line 1 */
    line1: string;
    /** Address line 2 */
    line2?: string;
    /** State/province */
    state: string;
    /** ZIP/postal code */
    zipCode: string;
  };
}

/**
 * Search form data
 */
export interface FakeSearchFormData {
  /** Date range end */
  dateEnd?: string;
  /** Date range start */
  dateStart?: string;
  /** Search filters */
  filters?: string[];
  /** Price range max */
  priceMax?: number;
  /** Price range min */
  priceMin?: number;
  /** Search query */
  query: string;
  /** Sort order */
  sortBy?: string;
}

/**
 * Settings form data
 */
export interface FakeSettingsFormData {
  /** Email notifications enabled */
  emailNotifications: boolean;
  /** Language preference */
  language: string;
  /** Marketing emails enabled */
  marketingEmails: boolean;
  /** Push notifications enabled */
  pushNotifications: boolean;
  /** Security alerts enabled */
  securityAlerts: boolean;
  /** Theme preference */
  theme: 'dark' | 'light' | 'system';
  /** Timezone */
  timezone: string;
  /** Two-factor auth enabled */
  twoFactorAuth: boolean;
}

/**
 * Password change form data
 */
export interface FakePasswordChangeFormData {
  /** Confirm new password */
  confirmPassword: string;
  /** Current password */
  currentPassword: string;
  /** New password */
  newPassword: string;
}

/**
 * Form submission response
 */
export interface FakeFormSubmitResponse {
  /** Created timestamp */
  createdAt: string;
  /** Response ID */
  id: string;
  /** Response message */
  message: string;
  /** Redirect URL */
  redirectUrl?: string;
  /** Success status */
  success: boolean;
}

/**
 * Country option
 */
export interface FakeCountry {
  /** Country code */
  code: string;
  /** Flag emoji */
  flag: string;
  /** Country name */
  name: string;
}

/**
 * Complete form configuration
 */
export interface FakeFormConfig {
  /** Cancel button label */
  cancelLabel?: string;
  /** Form fields */
  fields: FakeFormField[];
  /** Form ID */
  id: string;
  /** Form layout */
  layout: FormLayoutType;
  /** Form size */
  size: FormSizeVariant;
  /** Submit button label */
  submitLabel: string;
  /** Form title */
  title: string;
  /** Validation mode */
  validationMode: FormValidationMode;
}

// ============================================================================
// HELPER FACTORIES
// ============================================================================

/**
 * Creates a fake select option
 */
export function createFakeOption(overrides?: Partial<FakeOption>): FakeOption {
  return {
    description: faker.helpers.maybe(() => faker.commerce.productDescription(), {
      probability: 0.3,
    }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    label: faker.commerce.productName(),
    value: faker.string.uuid(),
    ...overrides,
  };
}

/**
 * Creates multiple fake options
 */
export function createFakeOptions(count: number): FakeOption[] {
  return Array.from({ length: count }, () => createFakeOption());
}

/**
 * Creates a fake option group
 */
export function createFakeOptionGroup(optionCount: number = 3): FakeOptionGroup {
  return {
    label: faker.commerce.department(),
    options: createFakeOptions(optionCount),
  };
}

/**
 * Creates multiple fake option groups
 */
export function createFakeOptionGroups(
  groupCount: number,
  optionsPerGroup: number = 3
): FakeOptionGroup[] {
  return Array.from({ length: groupCount }, () => createFakeOptionGroup(optionsPerGroup));
}

/**
 * Creates a fake form field
 */
export function createFakeFormField(overrides?: Partial<FakeFormField>): FakeFormField {
  const type = overrides?.type ?? faker.helpers.arrayElement(FORM_FIELD_TYPES);
  const name = faker.helpers.slugify(faker.lorem.word()).toLowerCase();

  return {
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    id: `field-${name}`,
    label: faker.lorem.words(2),
    name,
    placeholder: faker.helpers.maybe(() => faker.lorem.words(3), { probability: 0.6 }),
    required: faker.datatype.boolean({ probability: 0.6 }),
    type,
    ...(type === 'select' || type === 'radio'
      ? { options: createFakeOptions(faker.number.int({ min: 3, max: 6 })) }
      : {}),
    ...overrides,
  };
}

/**
 * Creates a fake validation error
 */
export function createFakeValidationError(field: string): FakeValidationError {
  const errorMessages: Record<string, { code: string; message: string }[]> = {
    confirmPassword: [
      {
        code: 'MISMATCH',
        message: i18n.t('factory.form.passwordsDoNotMatch', 'Passwords do not match'),
      },
      {
        code: 'REQUIRED',
        message: i18n.t('factory.form.pleaseConfirmYourPassword', 'Please confirm your password'),
      },
    ],
    default: [
      { code: 'INVALID', message: i18n.t('factory.form.invalidValue', 'Invalid value') },
      {
        code: 'REQUIRED',
        message: i18n.t('factory.form.thisFieldIsRequired', 'This field is required'),
      },
    ],
    email: [
      {
        code: 'EMAIL_EXISTS',
        message: i18n.t('factory.form.emailIsAlreadyRegistered', 'Email is already registered'),
      },
      {
        code: 'INVALID_EMAIL',
        message: i18n.t('factory.form.invalidEmailFormat', 'Invalid email format'),
      },
      { code: 'REQUIRED', message: i18n.t('factory.form.emailIsRequired', 'Email is required') },
    ],
    name: [
      {
        code: 'MIN_LENGTH',
        message: i18n.t('factory.form.nameMustBeAtLeast2', 'Name must be at least 2 characters'),
      },
      { code: 'REQUIRED', message: i18n.t('factory.form.nameIsRequired', 'Name is required') },
    ],
    password: [
      {
        code: 'MIN_LENGTH',
        message: i18n.t(
          'factory.form.passwordMustBeAtLeast8',
          'Password must be at least 8 characters'
        ),
      },
      {
        code: 'MISSING_NUMBER',
        message: i18n.t(
          'factory.form.passwordMustContainANumber',
          'Password must contain a number'
        ),
      },
      {
        code: 'MISSING_SPECIAL',
        message: i18n.t(
          'factory.form.passwordMustContainASpecial',
          'Password must contain a special character'
        ),
      },
    ],
    phone: [
      {
        code: 'INVALID_FORMAT',
        message: i18n.t('factory.form.invalidPhoneNumberFormat', 'Invalid phone number format'),
      },
      {
        code: 'REQUIRED',
        message: i18n.t('factory.form.phoneNumberIsRequired', 'Phone number is required'),
      },
    ],
  };

  const errors = errorMessages[field] ?? errorMessages.default;
  const error = faker.helpers.arrayElement(errors);

  return {
    field,
    severity: 'error',
    ...error,
  };
}

/**
 * Creates multiple validation errors
 */
export function createFakeValidationErrors(fields: string[]): FakeValidationError[] {
  return fields.map((field) => createFakeValidationError(field));
}

/**
 * Creates a fake form submit response
 */
export function createFakeFormSubmitResponse(success: boolean = true): FakeFormSubmitResponse {
  return {
    createdAt: new Date().toISOString(),
    id: faker.string.uuid(),
    message: success
      ? i18n.t('factory.form.formSubmittedSuccessfully', 'Form submitted successfully')
      : i18n.t('factory.form.formSubmissionFailed', 'Form submission failed'),
    redirectUrl: success
      ? faker.helpers.maybe(() => faker.internet.url(), { probability: 0.3 })
      : undefined,
    success,
  };
}

/**
 * Creates a fake country
 */
export function createFakeCountry(): FakeCountry {
  const flags = ['🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺', '🇯🇵', '🇩🇪', '🇫🇷', '🇪🇸', '🇮🇹', '🇧🇷'];
  return {
    code: faker.location.countryCode(),
    flag: faker.helpers.arrayElement(flags),
    name: faker.location.country(),
  };
}

/**
 * Creates multiple fake countries
 */
export function createFakeCountries(count: number = 10): FakeCountry[] {
  return Array.from({ length: count }, () => createFakeCountry());
}

// ============================================================================
// FORM DATA FACTORIES
// ============================================================================

/**
 * Creates fake generic form data
 */
export function createFakeFormData(overrides?: Partial<FakeFormData>): FakeFormData {
  return {
    address: faker.location.streetAddress(),
    agree: true,
    city: faker.location.city(),
    country: faker.location.country(),
    email: faker.internet.email(),
    message: faker.lorem.paragraph(),
    name: faker.person.fullName(),
    newsletter: faker.datatype.boolean(),
    phone: faker.phone.number(),
    zipCode: faker.location.zipCode(),
    ...overrides,
  };
}

/**
 * Creates fake login form data
 */
export function createFakeLoginFormData(overrides?: Partial<FakeLoginFormData>): FakeLoginFormData {
  return {
    email: faker.internet.email(),
    password: faker.internet.password({ length: 12 }),
    rememberMe: faker.datatype.boolean(),
    ...overrides,
  };
}

/**
 * Creates fake registration form data
 */
export function createFakeRegistrationFormData(
  overrides?: Partial<FakeRegistrationFormData>
): FakeRegistrationFormData {
  const password = faker.internet.password({ length: 12 });
  return {
    confirmPassword: password,
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    password,
    phone: faker.helpers.maybe(() => faker.phone.number(), { probability: 0.5 }),
    termsAccepted: true,
    username: faker.helpers.maybe(() => faker.internet.username(), { probability: 0.5 }),
    ...overrides,
  };
}

/**
 * Creates fake profile form data
 */
export function createFakeProfileFormData(
  overrides?: Partial<FakeProfileFormData>
): FakeProfileFormData {
  return {
    avatar: faker.helpers.maybe(() => faker.image.avatar(), { probability: 0.7 }),
    bio: faker.helpers.maybe(() => faker.lorem.paragraph(), { probability: 0.6 }),
    company: faker.helpers.maybe(() => faker.company.name(), { probability: 0.5 }),
    dateOfBirth: faker.helpers.maybe(
      () => faker.date.birthdate({ min: 18, max: 80, mode: 'age' }).toISOString().split('T')[0],
      { probability: 0.4 }
    ),
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    jobTitle: faker.helpers.maybe(() => faker.person.jobTitle(), { probability: 0.5 }),
    lastName: faker.person.lastName(),
    location: faker.helpers.maybe(() => `${faker.location.city()}, ${faker.location.country()}`, {
      probability: 0.4,
    }),
    phone: faker.helpers.maybe(() => faker.phone.number(), { probability: 0.6 }),
    website: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Creates fake contact form data
 */
export function createFakeContactFormData(
  overrides?: Partial<FakeContactFormData>
): FakeContactFormData {
  const subjects = [
    i18n.t('factory.form.generalInquiry', 'General Inquiry'),
    i18n.t('factory.form.supportRequest', 'Support Request'),
    i18n.t('factory.form.feedback', 'Feedback'),
    i18n.t('factory.form.partnershipOpportunity', 'Partnership Opportunity'),
    i18n.t('factory.form.pressInquiry', 'Press Inquiry'),
    i18n.t('factory.form.bugReport', 'Bug Report'),
    i18n.t('factory.form.featureRequest', 'Feature Request'),
  ];

  return {
    company: faker.helpers.maybe(() => faker.company.name(), { probability: 0.4 }),
    email: faker.internet.email(),
    message: faker.lorem.paragraphs(2),
    name: faker.person.fullName(),
    phone: faker.helpers.maybe(() => faker.phone.number(), { probability: 0.3 }),
    subject: faker.helpers.arrayElement(subjects),
    ...overrides,
  };
}

/**
 * Creates fake checkout form data
 */
export function createFakeCheckoutFormData(
  overrides?: Partial<FakeCheckoutFormData>
): FakeCheckoutFormData {
  const shippingAddress = {
    city: faker.location.city(),
    country: faker.location.country(),
    line1: faker.location.streetAddress(),
    line2: faker.helpers.maybe(() => faker.location.secondaryAddress(), { probability: 0.3 }),
    state: faker.location.state(),
    zipCode: faker.location.zipCode(),
  };

  return {
    billingAddress: shippingAddress,
    email: faker.internet.email(),
    expiryDate: `${faker.number.int({ min: 1, max: 12 }).toString().padStart(2, '0')}/${faker.number.int({ min: 25, max: 30 })}`,
    fullName: faker.person.fullName(),
    sameAsShipping: true,
    shippingAddress,
    ...overrides,
  };
}

/**
 * Creates fake search form data
 */
export function createFakeSearchFormData(
  overrides?: Partial<FakeSearchFormData>
): FakeSearchFormData {
  const sortOptions = ['relevance', 'date_desc', 'date_asc', 'price_asc', 'price_desc', 'rating'];
  const filterOptions = ['in_stock', 'on_sale', 'free_shipping', 'top_rated', 'new_arrivals'];

  return {
    dateEnd: faker.helpers.maybe(() => faker.date.future().toISOString().split('T')[0], {
      probability: 0.3,
    }),
    dateStart: faker.helpers.maybe(() => faker.date.past().toISOString().split('T')[0], {
      probability: 0.3,
    }),
    filters: faker.helpers.maybe(
      () => faker.helpers.arrayElements(filterOptions, faker.number.int({ min: 1, max: 3 })),
      { probability: 0.4 }
    ),
    priceMax: faker.helpers.maybe(() => faker.number.int({ min: 100, max: 1000 }), {
      probability: 0.3,
    }),
    priceMin: faker.helpers.maybe(() => faker.number.int({ min: 0, max: 100 }), {
      probability: 0.3,
    }),
    query: faker.commerce.product(),
    sortBy: faker.helpers.maybe(() => faker.helpers.arrayElement(sortOptions), {
      probability: 0.5,
    }),
    ...overrides,
  };
}

/**
 * Creates fake settings form data
 */
export function createFakeSettingsFormData(
  overrides?: Partial<FakeSettingsFormData>
): FakeSettingsFormData {
  const languages = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'pt', 'it'];
  const timezones = [
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney',
  ];
  const themes: Array<'dark' | 'light' | 'system'> = ['dark', 'light', 'system'];

  return {
    emailNotifications: faker.datatype.boolean({ probability: 0.8 }),
    language: faker.helpers.arrayElement(languages),
    marketingEmails: faker.datatype.boolean({ probability: 0.3 }),
    pushNotifications: faker.datatype.boolean({ probability: 0.6 }),
    securityAlerts: faker.datatype.boolean({ probability: 0.9 }),
    theme: faker.helpers.arrayElement(themes),
    timezone: faker.helpers.arrayElement(timezones),
    twoFactorAuth: faker.datatype.boolean({ probability: 0.4 }),
    ...overrides,
  };
}

/**
 * Creates fake password change form data
 */
export function createFakePasswordChangeFormData(
  overrides?: Partial<FakePasswordChangeFormData>
): FakePasswordChangeFormData {
  const newPassword = faker.internet.password({ length: 12 });
  return {
    confirmPassword: newPassword,
    currentPassword: faker.internet.password({ length: 10 }),
    newPassword,
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED FORM CONFIG FACTORIES
// ============================================================================

/**
 * Creates a login form configuration
 */
export function createFakeLoginForm(): FakeFormConfig {
  return {
    cancelLabel: i18n.t('factory.form.forgotPassword', 'Forgot Password?'),
    fields: [
      {
        description: i18n.t('factory.form.enterYourEmailAddress', 'Enter your email address'),
        id: 'login-email',
        label: LABEL_EMAIL,
        name: 'email',
        placeholder: i18n.t('factory.form.youAtExampleCom', 'you@example.com'),
        required: true,
        type: 'email',
      },
      {
        id: 'login-password',
        label: i18n.t('factory.form.password', 'Password'),
        name: 'password',
        placeholder: i18n.t('factory.form.enterYourPassword', 'Enter your password'),
        required: true,
        type: 'password',
      },
      {
        defaultValue: false,
        id: 'login-remember',
        label: i18n.t('factory.form.rememberMe', 'Remember me'),
        name: 'rememberMe',
        type: 'checkbox',
      },
    ],
    id: 'login-form',
    layout: 'vertical',
    size: 'default',
    submitLabel: i18n.t('factory.form.signIn', 'Sign In'),
    title: i18n.t('factory.form.login', 'Login'),
    validationMode: 'onBlur',
  };
}

/**
 * Creates a registration form configuration
 */
export function createFakeRegistrationForm(): FakeFormConfig {
  return {
    cancelLabel: i18n.t('factory.form.alreadyHaveAnAccount', 'Already have an account?'),
    fields: [
      {
        id: 'reg-firstName',
        label: i18n.t('factory.form.firstName', 'First Name'),
        name: 'firstName',
        placeholder: i18n.t('factory.form.john', 'John'),
        required: true,
        type: 'text',
      },
      {
        id: 'reg-lastName',
        label: i18n.t('factory.form.lastName', 'Last Name'),
        name: 'lastName',
        placeholder: i18n.t('factory.form.doe', 'Doe'),
        required: true,
        type: 'text',
      },
      {
        description: i18n.t(
          'factory.form.weWillSendAVerification',
          'We will send a verification email'
        ),
        id: 'reg-email',
        label: LABEL_EMAIL,
        name: 'email',
        placeholder: i18n.t('factory.form.youAtExampleCom', 'you@example.com'),
        required: true,
        type: 'email',
      },
      {
        description: i18n.t('factory.form.mustBeAtLeast8', 'Must be at least 8 characters'),
        id: 'reg-password',
        label: i18n.t('factory.form.password', 'Password'),
        minLength: 8,
        name: 'password',
        placeholder: i18n.t('factory.form.createAPassword', 'Create a password'),
        required: true,
        type: 'password',
      },
      {
        id: 'reg-confirmPassword',
        label: i18n.t('factory.form.confirmPassword', 'Confirm Password'),
        name: 'confirmPassword',
        placeholder: i18n.t('factory.form.confirmYourPassword', 'Confirm your password'),
        required: true,
        type: 'password',
      },
      {
        defaultValue: false,
        id: 'reg-terms',
        label: i18n.t(
          'factory.form.iAgreeToTheTerms',
          'I agree to the Terms of Service and Privacy Policy'
        ),
        name: 'termsAccepted',
        required: true,
        type: 'checkbox',
      },
    ],
    id: 'registration-form',
    layout: 'vertical',
    size: 'default',
    submitLabel: i18n.t('factory.form.createAccount', 'Create Account'),
    title: i18n.t('factory.form.createAnAccount', 'Create an Account'),
    validationMode: 'onBlur',
  };
}

/**
 * Creates a contact form configuration
 */
export function createFakeContactForm(): FakeFormConfig {
  return {
    cancelLabel: LABEL_CANCEL,
    fields: [
      {
        id: 'contact-name',
        label: i18n.t('factory.form.fullName', 'Full Name'),
        name: 'name',
        placeholder: i18n.t('factory.form.yourName', 'Your name'),
        required: true,
        type: 'text',
      },
      {
        id: 'contact-email',
        label: LABEL_EMAIL,
        name: 'email',
        placeholder: i18n.t('factory.form.youAtExampleCom', 'you@example.com'),
        required: true,
        type: 'email',
      },
      {
        id: 'contact-subject',
        label: i18n.t('factory.form.subject', 'Subject'),
        name: 'subject',
        options: [
          { label: i18n.t('factory.form.generalInquiry', 'General Inquiry'), value: 'general' },
          { label: i18n.t('factory.form.support', 'Support'), value: 'support' },
          { label: i18n.t('factory.form.feedback', 'Feedback'), value: 'feedback' },
          { label: i18n.t('factory.form.partnership', 'Partnership'), value: 'partnership' },
        ],
        required: true,
        type: 'select',
      },
      {
        description: i18n.t(
          'factory.form.pleaseProvideAsMuchDetail',
          'Please provide as much detail as possible'
        ),
        id: 'contact-message',
        label: i18n.t('factory.form.message', 'Message'),
        minLength: 10,
        name: 'message',
        placeholder: i18n.t('factory.form.howCanWeHelpYou', 'How can we help you?'),
        required: true,
        type: 'textarea',
      },
    ],
    id: 'contact-form',
    layout: 'vertical',
    size: 'default',
    submitLabel: i18n.t('factory.form.sendMessage', 'Send Message'),
    title: i18n.t('factory.form.contactUs', 'Contact Us'),
    validationMode: 'onBlur',
  };
}

/**
 * Creates a profile form configuration
 */
export function createFakeProfileForm(): FakeFormConfig {
  return {
    cancelLabel: LABEL_CANCEL,
    fields: [
      {
        description: i18n.t('factory.form.uploadAProfilePicture', 'Upload a profile picture'),
        id: 'profile-avatar',
        label: i18n.t('factory.form.avatar', 'Avatar'),
        name: 'avatar',
        type: 'file',
      },
      {
        id: 'profile-firstName',
        label: i18n.t('factory.form.firstName', 'First Name'),
        name: 'firstName',
        placeholder: i18n.t('factory.form.john', 'John'),
        required: true,
        type: 'text',
      },
      {
        id: 'profile-lastName',
        label: i18n.t('factory.form.lastName', 'Last Name'),
        name: 'lastName',
        placeholder: i18n.t('factory.form.doe', 'Doe'),
        required: true,
        type: 'text',
      },
      {
        id: 'profile-email',
        label: LABEL_EMAIL,
        name: 'email',
        readOnly: true,
        required: true,
        type: 'email',
      },
      {
        id: 'profile-phone',
        label: i18n.t('factory.form.phone', 'Phone'),
        name: 'phone',
        placeholder: i18n.t('factory.form.phoneFormat', '+1 (555) 000-0000'),
        type: 'tel',
      },
      {
        id: 'profile-company',
        label: i18n.t('factory.form.company', 'Company'),
        name: 'company',
        placeholder: i18n.t('factory.form.yourCompany', 'Your company'),
        type: 'text',
      },
      {
        id: 'profile-jobTitle',
        label: i18n.t('factory.form.jobTitle', 'Job Title'),
        name: 'jobTitle',
        placeholder: i18n.t('factory.form.yourRole', 'Your role'),
        type: 'text',
      },
      {
        description: i18n.t('factory.form.tellOthersAboutYourself', 'Tell others about yourself'),
        id: 'profile-bio',
        label: i18n.t('factory.form.bio', 'Bio'),
        maxLength: 500,
        name: 'bio',
        placeholder: i18n.t('factory.form.aShortBio', 'A short bio...'),
        type: 'textarea',
      },
      {
        id: 'profile-website',
        label: i18n.t('factory.form.website', 'Website'),
        name: 'website',
        placeholder: i18n.t('factory.form.httpsYourwebsiteCom', 'https://yourwebsite.com'),
        type: 'url',
      },
    ],
    id: 'profile-form',
    layout: 'vertical',
    size: 'spacious',
    submitLabel: i18n.t('factory.form.saveProfile', 'Save Profile'),
    title: i18n.t('factory.form.editProfile', 'Edit Profile'),
    validationMode: 'onBlur',
  };
}

/**
 * Creates a settings form configuration
 */
export function createFakeSettingsForm(): FakeFormConfig {
  return {
    cancelLabel: i18n.t('factory.form.resetToDefaults', 'Reset to Defaults'),
    fields: [
      {
        id: 'settings-theme',
        label: i18n.t('factory.form.theme', 'Theme'),
        name: 'theme',
        options: [
          { label: i18n.t('factory.form.light', 'Light'), value: 'light' },
          { label: i18n.t('factory.form.dark', 'Dark'), value: 'dark' },
          { label: i18n.t('factory.form.system', 'System'), value: 'system' },
        ],
        type: 'select',
      },
      {
        id: 'settings-language',
        label: i18n.t('factory.form.language', 'Language'),
        name: 'language',
        options: [
          { label: i18n.t('factory.form.english', 'English'), value: 'en' },
          { label: i18n.t('factory.form.spanish', 'Spanish'), value: 'es' },
          { label: i18n.t('factory.form.french', 'French'), value: 'fr' },
          { label: i18n.t('factory.form.german', 'German'), value: 'de' },
          { label: i18n.t('factory.form.japanese', 'Japanese'), value: 'ja' },
        ],
        type: 'select',
      },
      {
        defaultValue: true,
        description: i18n.t(
          'factory.form.receiveEmailUpdatesAboutYour',
          'Receive email updates about your account'
        ),
        id: 'settings-emailNotifications',
        label: i18n.t('factory.form.emailNotifications', 'Email Notifications'),
        name: 'emailNotifications',
        type: 'checkbox',
      },
      {
        defaultValue: true,
        description: i18n.t(
          'factory.form.receivePushNotificationsOnYour',
          'Receive push notifications on your device'
        ),
        id: 'settings-pushNotifications',
        label: i18n.t('factory.form.pushNotifications', 'Push Notifications'),
        name: 'pushNotifications',
        type: 'checkbox',
      },
      {
        defaultValue: false,
        description: i18n.t(
          'factory.form.receiveMarketingAndPromotionalEmails',
          'Receive marketing and promotional emails'
        ),
        id: 'settings-marketingEmails',
        label: i18n.t('factory.form.marketingEmails', 'Marketing Emails'),
        name: 'marketingEmails',
        type: 'checkbox',
      },
      {
        defaultValue: false,
        description: i18n.t(
          'factory.form.enableTwofactorAuthenticationForAdded',
          'Enable two-factor authentication for added security'
        ),
        id: 'settings-twoFactorAuth',
        label: i18n.t('factory.form.twofactorAuthentication', 'Two-Factor Authentication'),
        name: 'twoFactorAuth',
        type: 'checkbox',
      },
    ],
    id: 'settings-form',
    layout: 'vertical',
    size: 'default',
    submitLabel: i18n.t('factory.form.saveSettings', 'Save Settings'),
    title: i18n.t('factory.form.accountSettings', 'Account Settings'),
    validationMode: 'onChange',
  };
}

/**
 * Creates a search form configuration
 */
export function createFakeSearchForm(): FakeFormConfig {
  return {
    cancelLabel: i18n.t('factory.form.clear', 'Clear'),
    fields: [
      {
        id: 'search-query',
        label: i18n.t('factory.form.search', 'Search'),
        name: 'query',
        placeholder: i18n.t('factory.form.search2', 'Search...'),
        required: true,
        type: 'search',
      },
      {
        id: 'search-category',
        label: i18n.t('factory.form.category', 'Category'),
        name: 'category',
        options: [
          { label: i18n.t('factory.form.allCategories', 'All Categories'), value: 'all' },
          { label: i18n.t('factory.form.products', 'Products'), value: 'products' },
          { label: i18n.t('factory.form.articles', 'Articles'), value: 'articles' },
          { label: i18n.t('factory.form.users', 'Users'), value: 'users' },
        ],
        type: 'select',
      },
      {
        id: 'search-sortBy',
        label: i18n.t('factory.form.sortBy', 'Sort By'),
        name: 'sortBy',
        options: [
          { label: i18n.t('factory.form.relevance', 'Relevance'), value: 'relevance' },
          { label: i18n.t('factory.form.newest', 'Newest'), value: 'date_desc' },
          { label: i18n.t('factory.form.oldest', 'Oldest'), value: 'date_asc' },
          {
            label: i18n.t('factory.form.priceLowToHigh', 'Price: Low to High'),
            value: 'price_asc',
          },
          {
            label: i18n.t('factory.form.priceHighToLow', 'Price: High to Low'),
            value: 'price_desc',
          },
        ],
        type: 'select',
      },
    ],
    id: 'search-form',
    layout: 'inline',
    size: 'compact',
    submitLabel: i18n.t('factory.form.search', 'Search'),
    title: i18n.t('factory.form.search', 'Search'),
    validationMode: 'onSubmit',
  };
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of forms by layout and size
 */
export function createFakeFormMatrix(): Record<
  FormLayoutType,
  Record<FormSizeVariant, FakeFormConfig>
> {
  const result = {} as Record<FormLayoutType, Record<FormSizeVariant, FakeFormConfig>>;

  for (const layout of FORM_LAYOUT_TYPES) {
    result[layout] = {} as Record<FormSizeVariant, FakeFormConfig>;
    for (const size of FORM_SIZE_VARIANTS) {
      result[layout][size] = {
        cancelLabel: LABEL_CANCEL,
        fields: [
          createFakeFormField({
            name: 'name',
            label: i18n.t('factory.form.name', 'Name'),
            type: 'text',
            required: true,
          }),
          createFakeFormField({
            name: 'email',
            label: i18n.t('factory.form.email', 'Email'),
            type: 'email',
            required: true,
          }),
        ],
        id: `form-${layout}-${size}`,
        layout,
        size,
        submitLabel: i18n.t('factory.form.submit', 'Submit'),
        title: `${layout} / ${size}`,
        validationMode: 'onBlur',
      };
    }
  }

  return result;
}

/**
 * Creates a showcase of all specialized forms
 */
export function createFakeFormShowcase(): Record<string, FakeFormConfig> {
  return {
    contact: createFakeContactForm(),
    login: createFakeLoginForm(),
    profile: createFakeProfileForm(),
    registration: createFakeRegistrationForm(),
    search: createFakeSearchForm(),
    settings: createFakeSettingsForm(),
  };
}

/**
 * Creates an array of validation errors for demonstration
 */
export function createFakeValidationErrorShowcase(): FakeValidationError[] {
  return [
    {
      code: 'REQUIRED',
      field: 'email',
      message: i18n.t('factory.form.emailIsRequired', 'Email is required'),
      severity: 'error',
    },
    {
      code: 'INVALID_EMAIL',
      field: 'email',
      message: i18n.t('factory.form.invalidEmailFormat', 'Invalid email format'),
      severity: 'error',
    },
    {
      code: 'MIN_LENGTH',
      field: 'password',
      message: i18n.t(
        'factory.form.passwordMustBeAtLeast',
        'Password must be at least 8 characters'
      ),
      severity: 'error',
    },
    {
      code: 'MISMATCH',
      field: 'confirmPassword',
      message: i18n.t('factory.form.passwordsDoNotMatch', 'Passwords do not match'),
      severity: 'error',
    },
    {
      code: 'WEAK_PASSWORD',
      field: 'password',
      message: i18n.t('factory.form.passwordIsTooWeak', 'Password is too weak'),
      severity: 'warning',
    },
    {
      code: 'EMAIL_EXISTS',
      field: 'email',
      message: i18n.t(
        'factory.form.thisEmailIsAlreadyRegistered',
        'This email is already registered'
      ),
      severity: 'info',
    },
  ];
}
