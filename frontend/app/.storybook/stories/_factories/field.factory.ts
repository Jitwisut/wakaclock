/**
 * Field Factory
 *
 * Provides faker-based test data generation for Field component stories.
 * Supports various form field configurations, layouts, and validation states.
 *
 * @module field.factory
 * @see {@link file://./../../../components/ui/field.tsx}
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// CONSTANTS - Common strings to avoid duplication (sonarjs/no-duplicate-string)
// ============================================================================

/** Common error message for required fields */
const ERR_FIELD_REQUIRED = i18n.t('factory.field.thisFieldIsRequired', 'This field is required');

/** Common email label */
const LABEL_EMAIL = i18n.t('factory.field.email', 'Email');

/** Common error message for required selections */
const ERR_SELECTION_REQUIRED = i18n.t('factory.field.selectionIsRequired', 'Selection is required');

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Field orientation types
 * @description Controls the layout of label and input
 */
export type FieldOrientation = 'horizontal' | 'responsive' | 'vertical';

/**
 * Field legend variant
 */
export type FieldLegendVariant = 'label' | 'legend';

/**
 * Field input types
 */
export type FieldInputType =
  | 'checkbox'
  | 'date'
  | 'datetime-local'
  | 'email'
  | 'file'
  | 'number'
  | 'password'
  | 'radio'
  | 'range'
  | 'select'
  | 'tel'
  | 'text'
  | 'textarea'
  | 'time'
  | 'url';

/**
 * Field validation state
 */
export type FieldValidationState = 'error' | 'success' | 'warning';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Field error configuration
 */
export interface FakeFieldError {
  /** Error message */
  message: string;
}

/**
 * Base field configuration
 */
export interface FakeField {
  /** Default value */
  defaultValue?: boolean | number | string;
  /** Field description/help text */
  description?: string;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Error messages */
  errors?: FakeFieldError[];
  /** Field HTML ID */
  id: string;
  /** Input type */
  inputType: FieldInputType;
  /** Whether field is invalid */
  invalid?: boolean;
  /** Field label */
  label: string;
  /** Field name attribute */
  name: string;
  /** Field layout orientation */
  orientation?: FieldOrientation;
  /** Placeholder text */
  placeholder?: string;
  /** Whether field is read-only */
  readOnly?: boolean;
  /** Whether field is required */
  required?: boolean;
  /** Validation state */
  validationState?: FieldValidationState;
}

/**
 * Text field configuration
 */
export interface FakeTextField extends FakeField {
  inputType: 'email' | 'password' | 'tel' | 'text' | 'url';
  /** Maximum length */
  maxLength?: number;
  /** Minimum length */
  minLength?: number;
  /** Validation pattern */
  pattern?: string;
}

/**
 * Number field configuration
 */
export interface FakeNumberField extends FakeField {
  inputType: 'number' | 'range';
  /** Maximum value */
  max?: number;
  /** Minimum value */
  min?: number;
  /** Step increment */
  step?: number;
}

/**
 * Select field configuration
 */
export interface FakeSelectField extends FakeField {
  inputType: 'select';
  /** Whether multiple selection is allowed */
  multiple?: boolean;
  /** Select options */
  options: Array<{
    disabled?: boolean;
    label: string;
    value: string;
  }>;
}

/**
 * Checkbox/Radio field configuration
 */
export interface FakeChoiceField extends FakeField {
  /** Whether checked by default */
  checked?: boolean;
  inputType: 'checkbox' | 'radio';
  /** Group value for radio buttons */
  value?: string;
}

/**
 * Textarea field configuration
 */
export interface FakeTextareaField extends FakeField {
  inputType: 'textarea';
  /** Maximum length */
  maxLength?: number;
  /** Number of visible rows */
  rows?: number;
}

/**
 * Date/Time field configuration
 */
export interface FakeDateTimeField extends FakeField {
  inputType: 'date' | 'datetime-local' | 'time';
  /** Maximum date/time */
  max?: string;
  /** Minimum date/time */
  min?: string;
}

/**
 * File field configuration
 */
export interface FakeFileField extends FakeField {
  /** Accepted file types */
  accept?: string;
  inputType: 'file';
  /** Allow multiple files */
  multiple?: boolean;
}

/**
 * Field group configuration
 */
export interface FakeFieldGroup {
  /** Group description */
  description?: string;
  /** Fields in the group */
  fields: FakeField[];
  /** Unique identifier */
  id: string;
  /** Group legend/title */
  legend?: string;
  /** Legend variant */
  legendVariant?: FieldLegendVariant;
}

/**
 * Fieldset configuration
 */
export interface FakeFieldSet {
  /** Field groups */
  groups: FakeFieldGroup[];
  /** Unique identifier */
  id: string;
  /** Fieldset legend */
  legend: string;
  /** Legend variant */
  legendVariant?: FieldLegendVariant;
}

/**
 * Complete form configuration
 */
export interface FakeFormConfig {
  /** Form description */
  description?: string;
  /** Form field sets */
  fieldSets: FakeFieldSet[];
  /** Form HTML ID */
  id: string;
  /** Submit button label */
  submitLabel?: string;
  /** Form title */
  title?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Field orientations
 */
export const FIELD_ORIENTATIONS: FieldOrientation[] = ['vertical', 'horizontal', 'responsive'];

/**
 * Legend variants
 */
export const LEGEND_VARIANTS: FieldLegendVariant[] = ['legend', 'label'];

/**
 * Input types
 */
export const INPUT_TYPES: FieldInputType[] = [
  'checkbox',
  'date',
  'datetime-local',
  'email',
  'file',
  'number',
  'password',
  'radio',
  'range',
  'select',
  'tel',
  'text',
  'textarea',
  'time',
  'url',
];

/**
 * Text input types
 */
export const TEXT_INPUT_TYPES: FakeTextField['inputType'][] = [
  'email',
  'password',
  'tel',
  'text',
  'url',
];

/**
 * Common field labels by type
 */
export const FIELD_LABELS_BY_TYPE: Record<FieldInputType, string[]> = {
  checkbox: [
    i18n.t('factory.field.iAgreeToTerms', 'I agree to terms'),
    i18n.t('factory.field.subscribeToNewsletter', 'Subscribe to newsletter'),
    i18n.t('factory.field.rememberMe', 'Remember me'),
    i18n.t('factory.field.enableNotifications', 'Enable notifications'),
  ],
  date: [
    i18n.t('factory.field.dateOfBirth', 'Date of birth'),
    i18n.t('factory.field.startDate', 'Start date'),
    i18n.t('factory.field.endDate', 'End date'),
    i18n.t('factory.field.dueDate', 'Due date'),
  ],
  'datetime-local': [
    i18n.t('factory.field.eventDateTime', 'Event date & time'),
    i18n.t('factory.field.appointment', 'Appointment'),
    i18n.t('factory.field.reminder', 'Reminder'),
    i18n.t('factory.field.deadline', 'Deadline'),
  ],
  email: [
    LABEL_EMAIL,
    i18n.t('factory.field.emailAddress', 'Email address'),
    i18n.t('factory.field.workEmail', 'Work email'),
    i18n.t('factory.field.contactEmail', 'Contact email'),
  ],
  file: [
    i18n.t('factory.field.uploadFile', 'Upload file'),
    i18n.t('factory.field.attachment', 'Attachment'),
    i18n.t('factory.field.profilePicture', 'Profile picture'),
    i18n.t('factory.field.document', 'Document'),
  ],
  number: [
    i18n.t('factory.field.quantity', 'Quantity'),
    i18n.t('factory.field.amount', 'Amount'),
    'Age',
    i18n.t('factory.field.score', 'Score'),
  ],
  password: [
    i18n.t('factory.field.password', 'Password'),
    i18n.t('factory.field.newPassword', 'New password'),
    i18n.t('factory.field.confirmPassword', 'Confirm password'),
    i18n.t('factory.field.currentPassword', 'Current password'),
  ],
  radio: [
    i18n.t('factory.field.option', 'Option'),
    i18n.t('factory.field.choice', 'Choice'),
    i18n.t('factory.field.selection', 'Selection'),
    i18n.t('factory.field.preference', 'Preference'),
  ],
  range: [
    i18n.t('factory.field.volume', 'Volume'),
    i18n.t('factory.field.brightness', 'Brightness'),
    i18n.t('factory.field.progress', 'Progress'),
    i18n.t('factory.field.rating', 'Rating'),
  ],
  select: [
    i18n.t('factory.field.country', 'Country'),
    i18n.t('factory.field.category', 'Category'),
    i18n.t('factory.field.status', 'Status'),
    i18n.t('factory.field.priority', 'Priority'),
  ],
  tel: [
    i18n.t('factory.field.phone', 'Phone'),
    i18n.t('factory.field.mobile', 'Mobile'),
    i18n.t('factory.field.contactNumber', 'Contact number'),
    i18n.t('factory.field.phoneNumber', 'Phone number'),
  ],
  text: [
    i18n.t('factory.field.name', 'Name'),
    i18n.t('factory.field.title', 'Title'),
    i18n.t('factory.field.username', 'Username'),
    i18n.t('factory.field.company', 'Company'),
  ],
  textarea: [
    i18n.t('factory.field.description', 'Description'),
    'Bio',
    i18n.t('factory.field.notes', 'Notes'),
    i18n.t('factory.field.message', 'Message'),
  ],
  time: [
    i18n.t('factory.field.startTime', 'Start time'),
    i18n.t('factory.field.endTime', 'End time'),
    i18n.t('factory.field.reminderTime', 'Reminder time'),
    i18n.t('factory.field.appointmentTime', 'Appointment time'),
  ],
  url: [
    i18n.t('factory.field.website', 'Website'),
    'URL',
    i18n.t('factory.field.link', 'Link'),
    i18n.t('factory.field.homepage', 'Homepage'),
  ],
};

/**
 * Common error messages by type
 */
export const ERROR_MESSAGES_BY_TYPE: Record<FieldInputType, string[]> = {
  checkbox: [
    i18n.t('factory.field.youMustAcceptTheTerms', 'You must accept the terms'),
    ERR_FIELD_REQUIRED,
  ],
  date: [
    i18n.t('factory.field.pleaseEnterAValidDate', 'Please enter a valid date'),
    i18n.t('factory.field.dateIsRequired', 'Date is required'),
  ],
  'datetime-local': [
    i18n.t('factory.field.pleaseEnterAValidDate2', 'Please enter a valid date and time'),
    ERR_FIELD_REQUIRED,
  ],
  email: [
    i18n.t('factory.field.pleaseEnterAValidEmail', 'Please enter a valid email address'),
    i18n.t('factory.field.emailIsRequired', 'Email is required'),
    i18n.t('factory.field.invalidEmailFormat', 'Invalid email format'),
  ],
  file: [
    i18n.t('factory.field.pleaseSelectAFile', 'Please select a file'),
    i18n.t('factory.field.fileIsRequired', 'File is required'),
    i18n.t('factory.field.fileTypeNotSupported', 'File type not supported'),
  ],
  number: [
    i18n.t('factory.field.pleaseEnterAValidNumber', 'Please enter a valid number'),
    i18n.t('factory.field.numberIsRequired', 'Number is required'),
    i18n.t('factory.field.valueMustBePositive', 'Value must be positive'),
  ],
  password: [
    i18n.t('factory.field.passwordIsRequired', 'Password is required'),
    i18n.t('factory.field.passwordMustBeAtLeast', 'Password must be at least 8 characters'),
    i18n.t('factory.field.passwordsDoNotMatch', 'Passwords do not match'),
  ],
  radio: [
    i18n.t('factory.field.pleaseSelectAnOption', 'Please select an option'),
    ERR_SELECTION_REQUIRED,
  ],
  range: [
    i18n.t('factory.field.valueIsOutOfRange', 'Value is out of range'),
    i18n.t('factory.field.pleaseSelectAValue', 'Please select a value'),
  ],
  select: [
    i18n.t('factory.field.pleaseSelectAnOption', 'Please select an option'),
    ERR_SELECTION_REQUIRED,
  ],
  tel: [
    i18n.t('factory.field.pleaseEnterAValidPhone', 'Please enter a valid phone number'),
    i18n.t('factory.field.phoneNumberIsRequired', 'Phone number is required'),
  ],
  text: [
    ERR_FIELD_REQUIRED,
    i18n.t('factory.field.pleaseEnterAValidValue', 'Please enter a valid value'),
    i18n.t('factory.field.valueIsTooShort', 'Value is too short'),
  ],
  textarea: [
    ERR_FIELD_REQUIRED,
    i18n.t('factory.field.pleaseEnterADescription', 'Please enter a description'),
    i18n.t('factory.field.textIsTooLong', 'Text is too long'),
  ],
  time: [
    i18n.t('factory.field.pleaseEnterAValidTime', 'Please enter a valid time'),
    i18n.t('factory.field.timeIsRequired', 'Time is required'),
  ],
  url: [
    i18n.t('factory.field.pleaseEnterAValidUrl', 'Please enter a valid URL'),
    i18n.t('factory.field.urlIsRequired', 'URL is required'),
    i18n.t('factory.field.invalidUrlFormat', 'Invalid URL format'),
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generates a field name from label
 */
function labelToName(label: string): string {
  return label
    .toLowerCase()
    .replaceAll(/\s+/g, '_')
    .replaceAll(/[^a-z0-9_]/g, '');
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake field error
 */
export function createFakeFieldError(overrides?: Partial<FakeFieldError>): FakeFieldError {
  return {
    message: faker.lorem.sentence(),
    ...overrides,
  };
}

/**
 * Creates a fake field
 */
export function createFakeField(overrides?: Partial<FakeField>): FakeField {
  const inputType = overrides?.inputType ?? faker.helpers.arrayElement(INPUT_TYPES);
  const label = overrides?.label ?? faker.helpers.arrayElement(FIELD_LABELS_BY_TYPE[inputType]);
  const hasError = faker.helpers.maybe(() => true, { probability: 0.15 });

  return {
    defaultValue: undefined,
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 }),
    disabled: faker.helpers.maybe(() => true, { probability: 0.05 }),
    errors: hasError
      ? [{ message: faker.helpers.arrayElement(ERROR_MESSAGES_BY_TYPE[inputType]) }]
      : undefined,
    id: faker.string.uuid(),
    inputType,
    invalid: hasError,
    label,
    name: labelToName(label),
    orientation: faker.helpers.arrayElement(FIELD_ORIENTATIONS),
    placeholder: faker.helpers.maybe(
      () =>
        i18n.t('factory.field.enterPlaceholder', 'Enter {{label}}', { label: label.toLowerCase() }),
      { probability: 0.5 }
    ),
    readOnly: faker.helpers.maybe(() => true, { probability: 0.02 }),
    required: faker.helpers.maybe(() => true, { probability: 0.4 }),
    ...overrides,
  };
}

/**
 * Creates a fake text field
 */
export function createFakeTextField(overrides?: Partial<FakeTextField>): FakeTextField {
  const inputType = overrides?.inputType ?? faker.helpers.arrayElement(TEXT_INPUT_TYPES);

  return {
    ...createFakeField({ ...overrides, inputType }),
    inputType,
    maxLength: faker.helpers.maybe(() => faker.number.int({ min: 50, max: 500 }), {
      probability: 0.2,
    }),
    minLength: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 10 }), {
      probability: 0.2,
    }),
    ...overrides,
  };
}

/**
 * Creates a fake number field
 */
export function createFakeNumberField(overrides?: Partial<FakeNumberField>): FakeNumberField {
  const inputType =
    overrides?.inputType ?? faker.helpers.arrayElement<'number' | 'range'>(['number', 'range']);
  const min = faker.number.int({ min: 0, max: 10 });
  const max = faker.number.int({ min: min + 10, max: 1000 });

  return {
    ...createFakeField({ ...overrides, inputType }),
    inputType,
    max,
    min,
    step: faker.helpers.maybe(() => faker.helpers.arrayElement([1, 5, 10, 0.1, 0.01]), {
      probability: 0.3,
    }),
    ...overrides,
  };
}

/**
 * Creates a fake select field
 */
export function createFakeSelectField(overrides?: Partial<FakeSelectField>): FakeSelectField {
  const optionCount = faker.number.int({ min: 3, max: 8 });

  return {
    ...createFakeField({ ...overrides, inputType: 'select' }),
    inputType: 'select',
    multiple: faker.helpers.maybe(() => true, { probability: 0.1 }),
    options: Array.from({ length: optionCount }, () => ({
      disabled: faker.helpers.maybe(() => true, { probability: 0.05 }),
      label: faker.word.noun(),
      value: faker.string.alphanumeric(8),
    })),
    ...overrides,
  };
}

/**
 * Creates a fake checkbox or radio field
 */
export function createFakeChoiceField(
  inputType: 'checkbox' | 'radio' = 'checkbox',
  overrides?: Partial<FakeChoiceField>
): FakeChoiceField {
  return {
    ...createFakeField({ ...overrides, inputType }),
    checked: faker.datatype.boolean(),
    inputType,
    value: inputType === 'radio' ? faker.string.alphanumeric(8) : undefined,
    ...overrides,
  };
}

/**
 * Creates a fake textarea field
 */
export function createFakeTextareaField(overrides?: Partial<FakeTextareaField>): FakeTextareaField {
  return {
    ...createFakeField({ ...overrides, inputType: 'textarea' }),
    inputType: 'textarea',
    maxLength: faker.helpers.maybe(() => faker.number.int({ min: 500, max: 5000 }), {
      probability: 0.3,
    }),
    rows: faker.helpers.arrayElement([3, 4, 5, 6, 8]),
    ...overrides,
  };
}

/**
 * Creates a fake date/time field
 */
export function createFakeDateTimeField(
  inputType: 'date' | 'datetime-local' | 'time' = 'date',
  overrides?: Partial<FakeDateTimeField>
): FakeDateTimeField {
  return {
    ...createFakeField({ ...overrides, inputType }),
    inputType,
    ...overrides,
  };
}

/**
 * Creates a fake file field
 */
export function createFakeFileField(overrides?: Partial<FakeFileField>): FakeFileField {
  return {
    ...createFakeField({ ...overrides, inputType: 'file' }),
    accept: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['.pdf', 'image/*', '.doc,.docx', '.csv,.xlsx']),
      { probability: 0.5 }
    ),
    inputType: 'file',
    multiple: faker.helpers.maybe(() => true, { probability: 0.2 }),
    ...overrides,
  };
}

/**
 * Creates a fake field group
 */
export function createFakeFieldGroup(
  fieldCount: number = 3,
  overrides?: Partial<FakeFieldGroup>
): FakeFieldGroup {
  return {
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    fields: Array.from({ length: fieldCount }, () => createFakeField()),
    id: faker.string.uuid(),
    legend: faker.helpers.maybe(() => faker.word.words(2), { probability: 0.6 }),
    legendVariant: faker.helpers.arrayElement(LEGEND_VARIANTS),
    ...overrides,
  };
}

/**
 * Creates a fake fieldset
 */
export function createFakeFieldSet(
  groupCount: number = 2,
  overrides?: Partial<FakeFieldSet>
): FakeFieldSet {
  return {
    groups: Array.from({ length: groupCount }, () => createFakeFieldGroup()),
    id: faker.string.uuid(),
    legend: faker.word.words(2),
    legendVariant: faker.helpers.arrayElement(LEGEND_VARIANTS),
    ...overrides,
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple fields
 */
export function createFakeFields(count: number): FakeField[] {
  return Array.from({ length: count }, () => createFakeField());
}

/**
 * Creates multiple field groups
 */
export function createFakeFieldGroups(count: number): FakeFieldGroup[] {
  return Array.from({ length: count }, () => createFakeFieldGroup());
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a login form configuration
 */
export function createFakeLoginForm(): FakeFormConfig {
  return {
    fieldSets: [
      {
        groups: [
          {
            fields: [
              createFakeTextField({
                inputType: 'email',
                label: LABEL_EMAIL,
                placeholder: i18n.t('factory.field.enterYourEmail', 'Enter your email'),
                required: true,
              }),
              createFakeTextField({
                inputType: 'password',
                label: i18n.t('factory.field.password', 'Password'),
                placeholder: i18n.t('factory.field.enterYourPassword', 'Enter your password'),
                required: true,
              }),
              createFakeChoiceField('checkbox', {
                label: i18n.t('factory.field.rememberMe', 'Remember me'),
                required: false,
              }),
            ],
            id: 'credentials',
          },
        ],
        id: 'login-fieldset',
        legend: i18n.t('factory.field.signIn', 'Sign In'),
      },
    ],
    id: 'login-form',
    submitLabel: i18n.t('factory.field.signIn', 'Sign In'),
    title: i18n.t('factory.field.login', 'Login'),
  };
}

/**
 * Creates a registration form configuration
 */
export function createFakeRegistrationForm(): FakeFormConfig {
  return {
    fieldSets: [
      {
        groups: [
          {
            fields: [
              createFakeTextField({
                inputType: 'text',
                label: i18n.t('factory.field.fullName', 'Full Name'),
                required: true,
              }),
              createFakeTextField({
                inputType: 'email',
                label: LABEL_EMAIL,
                required: true,
              }),
              createFakeTextField({
                inputType: 'password',
                label: i18n.t('factory.field.password', 'Password'),
                minLength: 8,
                required: true,
              }),
              createFakeTextField({
                inputType: 'password',
                label: i18n.t('factory.field.confirmPassword2', 'Confirm Password'),
                required: true,
              }),
            ],
            id: 'account-info',
            legend: i18n.t('factory.field.accountInformation', 'Account Information'),
          },
          {
            fields: [
              createFakeChoiceField('checkbox', {
                label: i18n.t('factory.field.iAgreeToTheTerms', 'I agree to the Terms of Service'),
                required: true,
              }),
              createFakeChoiceField('checkbox', {
                label: i18n.t('factory.field.subscribeToNewsletter', 'Subscribe to newsletter'),
                required: false,
              }),
            ],
            id: 'agreements',
          },
        ],
        id: 'registration-fieldset',
        legend: i18n.t('factory.field.createAccount', 'Create Account'),
      },
    ],
    id: 'registration-form',
    submitLabel: i18n.t('factory.field.createAccount', 'Create Account'),
    title: i18n.t('factory.field.signUp', 'Sign Up'),
  };
}

/**
 * Creates a contact form configuration
 */
export function createFakeContactForm(): FakeFormConfig {
  return {
    fieldSets: [
      {
        groups: [
          {
            fields: [
              createFakeTextField({
                inputType: 'text',
                label: i18n.t('factory.field.name', 'Name'),
                required: true,
              }),
              createFakeTextField({
                inputType: 'email',
                label: LABEL_EMAIL,
                required: true,
              }),
              createFakeSelectField({
                label: i18n.t('factory.field.subject', 'Subject'),
                options: [
                  {
                    label: i18n.t('factory.field.generalInquiry', 'General Inquiry'),
                    value: 'general',
                  },
                  { label: i18n.t('factory.field.support', 'Support'), value: 'support' },
                  { label: i18n.t('factory.field.sales', 'Sales'), value: 'sales' },
                  { label: i18n.t('factory.field.feedback', 'Feedback'), value: 'feedback' },
                ],
                required: true,
              }),
              createFakeTextareaField({
                label: i18n.t('factory.field.message', 'Message'),
                required: true,
                rows: 5,
              }),
            ],
            id: 'contact-fields',
          },
        ],
        id: 'contact-fieldset',
        legend: i18n.t('factory.field.contactUs', 'Contact Us'),
      },
    ],
    description: i18n.t(
      'factory.field.fillOutTheFormBelow',
      "Fill out the form below and we'll get back to you as soon as possible."
    ),
    id: 'contact-form',
    submitLabel: i18n.t('factory.field.sendMessage', 'Send Message'),
    title: i18n.t('factory.field.contact', 'Contact'),
  };
}

/**
 * Creates a profile settings form
 */
export function createFakeProfileForm(): FakeFormConfig {
  return {
    fieldSets: [
      {
        groups: [
          {
            fields: [
              createFakeFileField({
                accept: 'image/*',
                label: i18n.t('factory.field.profilePicture2', 'Profile Picture'),
              }),
              createFakeTextField({
                inputType: 'text',
                label: i18n.t('factory.field.displayName', 'Display Name'),
                required: true,
              }),
              createFakeTextField({
                inputType: 'email',
                label: LABEL_EMAIL,
                readOnly: true,
                required: true,
              }),
              createFakeTextareaField({
                description: i18n.t(
                  'factory.field.briefDescriptionAboutYourself',
                  'Brief description about yourself'
                ),
                label: i18n.t('factory.field.bio', 'Bio'),
                maxLength: 500,
                rows: 4,
              }),
            ],
            id: 'personal-info',
            legend: i18n.t('factory.field.personalInformation', 'Personal Information'),
          },
          {
            fields: [
              createFakeTextField({
                inputType: 'url',
                label: i18n.t('factory.field.website', 'Website'),
              }),
              createFakeTextField({
                inputType: 'text',
                label: i18n.t('factory.field.location', 'Location'),
              }),
            ],
            id: 'additional-info',
            legend: i18n.t('factory.field.additionalInformation', 'Additional Information'),
          },
        ],
        id: 'profile-fieldset',
        legend: i18n.t('factory.field.profileSettings', 'Profile Settings'),
      },
    ],
    id: 'profile-form',
    submitLabel: i18n.t('factory.field.saveChanges', 'Save Changes'),
    title: i18n.t('factory.field.editProfile', 'Edit Profile'),
  };
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of field configurations for visual testing
 */
export function createFakeFieldMatrix(): Record<string, FakeField> {
  return {
    textVertical: createFakeTextField({ inputType: 'text', orientation: 'vertical' }),
    textHorizontal: createFakeTextField({ inputType: 'text', orientation: 'horizontal' }),
    textResponsive: createFakeTextField({ inputType: 'text', orientation: 'responsive' }),
    emailRequired: createFakeTextField({ inputType: 'email', required: true }),
    passwordWithError: createFakeTextField({
      errors: [
        {
          message: i18n.t(
            'factory.field.passwordMustBeAtLeast',
            'Password must be at least 8 characters'
          ),
        },
      ],
      inputType: 'password',
      invalid: true,
    }),
    numberWithRange: createFakeNumberField({ inputType: 'number', max: 100, min: 0 }),
    selectMultiple: createFakeSelectField({ multiple: true }),
    textareaLarge: createFakeTextareaField({ rows: 8 }),
    checkboxChecked: createFakeChoiceField('checkbox', { checked: true }),
    radioOption: createFakeChoiceField('radio', { value: 'option-1' }),
    fileImage: createFakeFileField({ accept: 'image/*' }),
    dateField: createFakeDateTimeField('date'),
    disabled: createFakeField({ disabled: true }),
    readOnly: createFakeField({ readOnly: true }),
    withDescription: createFakeField({
      description: i18n.t(
        'factory.field.thisIsAHelpfulDescription',
        'This is a helpful description for the field.'
      ),
    }),
  };
}

/**
 * Creates a showcase of all form types
 */
export function createFakeFormShowcase(): Record<string, FakeFormConfig> {
  return {
    contact: createFakeContactForm(),
    login: createFakeLoginForm(),
    profile: createFakeProfileForm(),
    registration: createFakeRegistrationForm(),
  };
}
