/**
 * @fileoverview Factory functions for generating fake Label component data
 * @module label.factory
 * @description Provides comprehensive test data generation for Label components
 * including form labels, required/optional indicators, and accessibility configurations.
 *
 * @example
 * ```typescript
 * import { createFakeLabel, createFakeFormField, LABEL_CONTEXTS } from './_factories/label.factory';
 *
 * // Create a single label
 * const label = createFakeLabel();
 *
 * // Create a form field with label
 * const field = createFakeFormField();
 *
 * // Create labels for specific contexts
 * const contextLabels = LABEL_CONTEXTS.map(ctx => createFakeLabelForContext(ctx));
 * ```
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Label size variants
 * @description Text size classes that can be applied to labels
 */
export type LabelSize = 'base' | 'lg' | 'sm' | 'xl' | 'xs';

/**
 * Label requirement status
 * @description Indicates whether a field is required or optional
 */
export type LabelRequirement = 'optional' | 'required';

/**
 * Label state based on associated input
 * @description Reflects the state of the associated form control
 */
export type LabelState = 'default' | 'disabled' | 'error' | 'focused' | 'success';

/**
 * Form control types that labels can be associated with
 * @description Different input types that labels can describe
 */
export type LabelControlType =
  | 'checkbox'
  | 'color'
  | 'date'
  | 'email'
  | 'file'
  | 'number'
  | 'password'
  | 'radio'
  | 'range'
  | 'search'
  | 'select'
  | 'switch'
  | 'tel'
  | 'text'
  | 'textarea'
  | 'time'
  | 'url';

/**
 * Label context - the type of data the label describes
 * @description Semantic context for generating appropriate label text
 */
export type LabelContext =
  | 'address'
  | 'bio'
  | 'city'
  | 'company'
  | 'confirmPassword'
  | 'country'
  | 'creditCard'
  | 'dateOfBirth'
  | 'description'
  | 'email'
  | 'firstName'
  | 'fullName'
  | 'lastName'
  | 'message'
  | 'password'
  | 'phone'
  | 'postalCode'
  | 'state'
  | 'subject'
  | 'terms'
  | 'title'
  | 'url'
  | 'username';

/**
 * Label position relative to its control
 * @description Where the label appears in relation to its form control
 */
export type LabelPosition = 'after' | 'before' | 'inside' | 'top';

/**
 * Required indicator style
 * @description How the required status is visually indicated
 */
export type RequiredIndicatorStyle = 'asterisk' | 'badge' | 'none' | 'text';

// ============================================================================
// CONSTANTS
// ============================================================================

/** All available label sizes */
export const LABEL_SIZES: LabelSize[] = ['xs', 'sm', 'base', 'lg', 'xl'];

/** All requirement statuses */
export const LABEL_REQUIREMENTS: LabelRequirement[] = ['required', 'optional'];

/** All label states */
export const LABEL_STATES: LabelState[] = ['default', 'focused', 'disabled', 'error', 'success'];

/** All control types labels can be associated with */
export const LABEL_CONTROL_TYPES: LabelControlType[] = [
  'text',
  'email',
  'password',
  'tel',
  'url',
  'number',
  'search',
  'date',
  'time',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'switch',
  'file',
  'color',
  'range',
];

/** All semantic label contexts */
export const LABEL_CONTEXTS: LabelContext[] = [
  'email',
  'password',
  'username',
  'fullName',
  'firstName',
  'lastName',
  'phone',
  'address',
  'city',
  'state',
  'postalCode',
  'country',
  'company',
  'title',
  'description',
  'message',
  'subject',
  'url',
  'dateOfBirth',
  'bio',
  'terms',
  'creditCard',
  'confirmPassword',
];

/** All label positions */
export const LABEL_POSITIONS: LabelPosition[] = ['top', 'before', 'after', 'inside'];

/** All required indicator styles */
export const REQUIRED_INDICATOR_STYLES: RequiredIndicatorStyle[] = [
  'asterisk',
  'text',
  'badge',
  'none',
];

/** Common label texts for form fields */
export const LABEL_TEXTS: Record<LabelContext, string> = {
  address: i18n.t('factory.label.address', 'Address'),
  bio: i18n.t('factory.label.bio', 'Bio'),
  city: i18n.t('factory.label.city', 'City'),
  company: i18n.t('factory.label.company', 'Company'),
  confirmPassword: i18n.t('factory.label.confirmPassword', 'Confirm Password'),
  country: i18n.t('factory.label.country', 'Country'),
  creditCard: i18n.t('factory.label.creditCardNumber', 'Credit Card Number'),
  dateOfBirth: i18n.t('factory.label.dateOfBirth', 'Date of Birth'),
  description: i18n.t('factory.label.description', 'Description'),
  email: i18n.t('factory.label.emailAddress', 'Email Address'),
  firstName: i18n.t('factory.label.firstName', 'First Name'),
  fullName: i18n.t('factory.label.fullName', 'Full Name'),
  lastName: i18n.t('factory.label.lastName', 'Last Name'),
  message: i18n.t('factory.label.message', 'Message'),
  password: i18n.t('factory.label.password', 'Password'),
  phone: i18n.t('factory.label.phoneNumber', 'Phone Number'),
  postalCode: i18n.t('factory.label.postalCode', 'Postal Code'),
  state: i18n.t('factory.label.stateProvince', 'State / Province'),
  subject: i18n.t('factory.label.subject', 'Subject'),
  terms: i18n.t('factory.label.acceptTermsAndConditions', 'Accept Terms and Conditions'),
  title: i18n.t('factory.label.title', 'Title'),
  url: i18n.t('factory.label.websiteUrl', 'Website URL'),
  username: i18n.t('factory.label.username', 'Username'),
};

/** Size to Tailwind class mapping */
export const LABEL_SIZE_CLASSES: Record<LabelSize, string> = {
  base: 'text-base',
  lg: 'text-lg',
  sm: 'text-sm',
  xl: 'text-xl',
  xs: 'text-xs',
};

/** Control type to input type mapping */
export const CONTROL_TYPE_INPUT_MAP: Record<LabelControlType, string> = {
  checkbox: 'checkbox',
  color: 'color',
  date: 'date',
  email: 'email',
  file: 'file',
  number: 'number',
  password: 'password',
  radio: 'radio',
  range: 'range',
  search: 'search',
  select: 'select',
  switch: 'checkbox',
  tel: 'tel',
  text: 'text',
  textarea: 'textarea',
  time: 'time',
  url: 'url',
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Fake label data structure
 */
export interface FakeLabel {
  /** Additional CSS classes */
  className?: string;
  /** Control ID this label is associated with */
  htmlFor: string;
  /** Unique identifier */
  id: string;
  /** Label requirement status */
  requirement: LabelRequirement;
  /** Label size */
  size: LabelSize;
  /** Label state */
  state: LabelState;
  /** Label text content */
  text: string;
}

/**
 * Fake form field with label
 */
export interface FakeFormField {
  /** Default value for the input */
  defaultValue?: string;
  /** Description/help text */
  description?: string;
  /** Whether the field is disabled */
  disabled: boolean;
  /** Error message */
  errorMessage?: string;
  /** Unique identifier for the field */
  id: string;
  /** The associated label */
  label: FakeLabel;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required: boolean;
  /** The type of form control */
  type: LabelControlType;
}

/**
 * Fake checkbox field with label
 */
export interface FakeCheckboxField {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Whether the checkbox is disabled */
  disabled: boolean;
  /** Unique identifier */
  id: string;
  /** Indeterminate state */
  indeterminate?: boolean;
  /** The associated label */
  label: FakeLabel;
  /** Whether the checkbox is required */
  required: boolean;
}

/**
 * Fake switch field with label
 */
export interface FakeSwitchField {
  /** Whether the switch is on */
  checked: boolean;
  /** Whether the switch is disabled */
  disabled: boolean;
  /** Unique identifier */
  id: string;
  /** The associated label */
  label: FakeLabel;
}

/**
 * Fake radio group with labels
 */
export interface FakeRadioOption {
  /** Whether this option is disabled */
  disabled: boolean;
  /** Unique identifier */
  id: string;
  /** The associated label */
  label: FakeLabel;
  /** Radio value */
  value: string;
}

/**
 * Fake radio group
 */
export interface FakeRadioGroup {
  /** Group name attribute */
  name: string;
  /** Available options */
  options: FakeRadioOption[];
  /** Whether selection is required */
  required: boolean;
  /** Currently selected value */
  selectedValue?: string;
}

/**
 * Complete fake form section with multiple fields
 */
export interface FakeFormSection {
  /** Section description */
  description?: string;
  /** Fields in this section */
  fields: FakeFormField[];
  /** Section title */
  title: string;
}

/**
 * Label accessibility configuration
 */
export interface FakeLabelA11yConfig {
  /** aria-describedby reference */
  ariaDescribedBy?: string;
  /** Whether label is hidden visually but available to screen readers */
  srOnly: boolean;
  /** Whether to use aria-label instead of visible label */
  useAriaLabel: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generates a label text based on context
 * @param context - The semantic context
 * @returns Appropriate label text
 */
function getLabelTextForContext(context: LabelContext): string {
  return LABEL_TEXTS[context];
}

/**
 * Gets the appropriate control type for a context
 * @param context - The semantic context
 * @returns Appropriate control type
 */
function getControlTypeForContext(context: LabelContext): LabelControlType {
  if (context === 'email') return 'email';
  if (context === 'password' || context === 'confirmPassword') return 'password';
  if (context === 'phone') return 'tel';
  if (context === 'url') return 'url';
  if (context === 'dateOfBirth') return 'date';
  if (context === 'bio' || context === 'description' || context === 'message') return 'textarea';
  if (context === 'country' || context === 'state') return 'select';
  if (context === 'terms') return 'checkbox';
  return 'text';
}

/**
 * Generates a placeholder based on context
 * @param context - The semantic context
 * @returns Appropriate placeholder text
 */
function getPlaceholderForContext(context: LabelContext): string {
  if (context === 'email') return 'name@example.com';
  if (context === 'phone') return '+1 (555) 000-0000';
  if (context === 'url') return 'https://example.com';
  if (context === 'password' || context === 'confirmPassword') return '••••••••';
  if (context === 'username') return 'johndoe';
  if (context === 'fullName') return i18n.t('factory.label.johnDoe', 'John Doe');
  if (context === 'firstName') return i18n.t('factory.label.john', 'John');
  if (context === 'lastName') return i18n.t('factory.label.doe', 'Doe');
  if (context === 'postalCode') return '12345';
  if (context === 'creditCard') return '4242 4242 4242 4242';
  return i18n.t('factory.label.enterContext', 'Enter {{context}}', {
    context: LABEL_TEXTS[context].toLowerCase(),
  });
}

/**
 * Determines if a context is typically required
 * @param context - The semantic context
 * @returns Whether the field is typically required
 */
function isContextTypicallyRequired(context: LabelContext): boolean {
  const requiredContexts: LabelContext[] = [
    'email',
    'password',
    'confirmPassword',
    'username',
    'fullName',
    'firstName',
    'lastName',
    'terms',
  ];
  return requiredContexts.includes(context);
}

/**
 * Gets the label state based on field conditions
 * @param isDisabled - Whether the field is disabled
 * @param hasError - Whether the field has an error
 * @returns The appropriate label state
 */
function getLabelStateForField(isDisabled: boolean, hasError: boolean): LabelState {
  if (isDisabled) return 'disabled';
  if (hasError) return 'error';
  return 'default';
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a single fake label
 * @param overrides - Optional property overrides
 * @returns Fake label object
 */
export function createFakeLabel(overrides?: Partial<FakeLabel>): FakeLabel {
  const id = faker.string.uuid();
  const htmlFor = overrides?.htmlFor ?? `input-${faker.string.alphanumeric(8)}`;

  return {
    id,
    htmlFor,
    text: faker.helpers.arrayElement(Object.values(LABEL_TEXTS)),
    size: faker.helpers.arrayElement(LABEL_SIZES),
    requirement: faker.helpers.arrayElement(LABEL_REQUIREMENTS),
    state: faker.helpers.arrayElement(LABEL_STATES),
    className: faker.helpers.maybe(
      () => faker.helpers.arrayElement(Object.values(LABEL_SIZE_CLASSES)),
      {
        probability: 0.3,
      }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake label for a specific context
 * @param context - The semantic context
 * @param overrides - Optional property overrides
 * @returns Fake label object for the context
 */
export function createFakeLabelForContext(
  context: LabelContext,
  overrides?: Partial<FakeLabel>
): FakeLabel {
  return createFakeLabel({
    text: getLabelTextForContext(context),
    requirement: isContextTypicallyRequired(context) ? 'required' : 'optional',
    ...overrides,
  });
}

/**
 * Creates a fake form field with label
 * @param overrides - Optional property overrides
 * @returns Fake form field object
 */
export function createFakeFormField(overrides?: Partial<FakeFormField>): FakeFormField {
  const id = faker.string.uuid();
  const context = faker.helpers.arrayElement(LABEL_CONTEXTS);
  const controlType = getControlTypeForContext(context);
  const isRequired = isContextTypicallyRequired(context);
  const isDisabled = faker.datatype.boolean({ probability: 0.1 });
  const hasError = faker.datatype.boolean({ probability: 0.15 });

  const label = createFakeLabelForContext(context, {
    htmlFor: id,
    requirement: isRequired ? 'required' : 'optional',
    state: getLabelStateForField(isDisabled, hasError),
  });

  return {
    id,
    label,
    type: controlType,
    required: isRequired,
    disabled: isDisabled,
    placeholder: getPlaceholderForContext(context),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    errorMessage: hasError ? faker.lorem.sentence() : undefined,
    defaultValue: faker.helpers.maybe(() => faker.lorem.words(2), { probability: 0.2 }),
    ...overrides,
  };
}

/**
 * Creates a fake checkbox field with label
 * @param overrides - Optional property overrides
 * @returns Fake checkbox field object
 */
export function createFakeCheckboxField(overrides?: Partial<FakeCheckboxField>): FakeCheckboxField {
  const id = faker.string.uuid();
  const isDisabled = faker.datatype.boolean({ probability: 0.1 });
  const isRequired = faker.datatype.boolean({ probability: 0.3 });

  const checkboxLabels = [
    i18n.t('factory.label.acceptTermsAndConditions2', 'Accept terms and conditions'),
    i18n.t('factory.label.subscribeToNewsletter', 'Subscribe to newsletter'),
    i18n.t('factory.label.rememberMe', 'Remember me'),
    i18n.t('factory.label.enableNotifications', 'Enable notifications'),
    i18n.t('factory.label.iAgreeToThePrivacy', 'I agree to the privacy policy'),
    i18n.t('factory.label.sendMePromotionalEmails', 'Send me promotional emails'),
    i18n.t('factory.label.enableTwofactorAuthentication', 'Enable two-factor authentication'),
    i18n.t('factory.label.shareUsageData', 'Share usage data'),
  ];

  return {
    id,
    label: createFakeLabel({
      htmlFor: id,
      text: faker.helpers.arrayElement(checkboxLabels),
      requirement: isRequired ? 'required' : 'optional',
      state: isDisabled ? 'disabled' : 'default',
    }),
    checked: faker.datatype.boolean(),
    disabled: isDisabled,
    required: isRequired,
    indeterminate: faker.helpers.maybe(() => true, { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake switch field with label
 * @param overrides - Optional property overrides
 * @returns Fake switch field object
 */
export function createFakeSwitchField(overrides?: Partial<FakeSwitchField>): FakeSwitchField {
  const id = faker.string.uuid();
  const isDisabled = faker.datatype.boolean({ probability: 0.1 });

  const switchLabels = [
    i18n.t('factory.label.darkMode', 'Dark mode'),
    i18n.t('factory.label.airplaneMode', 'Airplane mode'),
    i18n.t('factory.label.doNotDisturb', 'Do not disturb'),
    i18n.t('factory.label.autoSave', 'Auto-save'),
    i18n.t('factory.label.enableSounds', 'Enable sounds'),
    i18n.t('factory.label.showPreviews', 'Show previews'),
    i18n.t('factory.label.syncAcrossDevices', 'Sync across devices'),
    i18n.t('factory.label.locationServices', 'Location services'),
    i18n.t('factory.label.pushNotifications', 'Push notifications'),
    i18n.t('factory.label.emailNotifications', 'Email notifications'),
  ];

  return {
    id,
    label: createFakeLabel({
      htmlFor: id,
      text: faker.helpers.arrayElement(switchLabels),
      requirement: 'optional',
      state: isDisabled ? 'disabled' : 'default',
    }),
    checked: faker.datatype.boolean(),
    disabled: isDisabled,
    ...overrides,
  };
}

/**
 * Creates a fake radio option
 * @param overrides - Optional property overrides
 * @returns Fake radio option object
 */
export function createFakeRadioOption(overrides?: Partial<FakeRadioOption>): FakeRadioOption {
  const id = faker.string.uuid();
  const isDisabled = faker.datatype.boolean({ probability: 0.1 });
  const value = faker.string.alphanumeric(8);

  return {
    id,
    value,
    label: createFakeLabel({
      htmlFor: id,
      text: faker.lorem.words({ min: 1, max: 3 }),
      state: isDisabled ? 'disabled' : 'default',
    }),
    disabled: isDisabled,
    ...overrides,
  };
}

/**
 * Creates a fake radio group
 * @param optionCount - Number of options (default: 3-5)
 * @param overrides - Optional property overrides
 * @returns Fake radio group object
 */
export function createFakeRadioGroup(
  optionCount?: number,
  overrides?: Partial<FakeRadioGroup>
): FakeRadioGroup {
  const count = optionCount ?? faker.number.int({ min: 3, max: 5 });
  const options = Array.from({ length: count }, () => createFakeRadioOption());
  const hasSelection = faker.datatype.boolean({ probability: 0.6 });

  return {
    name: faker.string.alphanumeric(8),
    options,
    required: faker.datatype.boolean({ probability: 0.5 }),
    selectedValue: hasSelection ? faker.helpers.arrayElement(options).value : undefined,
    ...overrides,
  };
}

/**
 * Creates a fake form section
 * @param fieldCount - Number of fields (default: 2-5)
 * @param overrides - Optional property overrides
 * @returns Fake form section object
 */
export function createFakeFormSection(
  fieldCount?: number,
  overrides?: Partial<FakeFormSection>
): FakeFormSection {
  const count = fieldCount ?? faker.number.int({ min: 2, max: 5 });

  const sectionTitles = [
    i18n.t('factory.label.personalInformation', 'Personal Information'),
    i18n.t('factory.label.contactDetails', 'Contact Details'),
    i18n.t('factory.label.accountSettings', 'Account Settings'),
    i18n.t('factory.label.billingAddress', 'Billing Address'),
    i18n.t('factory.label.shippingAddress', 'Shipping Address'),
    i18n.t('factory.label.paymentInformation', 'Payment Information'),
    i18n.t('factory.label.securitySettings', 'Security Settings'),
    i18n.t('factory.label.notificationPreferences', 'Notification Preferences'),
    i18n.t('factory.label.profileSettings', 'Profile Settings'),
    i18n.t('factory.label.companyInformation', 'Company Information'),
  ];

  return {
    title: faker.helpers.arrayElement(sectionTitles),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    fields: Array.from({ length: count }, () => createFakeFormField()),
    ...overrides,
  };
}

/**
 * Creates a fake label accessibility configuration
 * @param overrides - Optional property overrides
 * @returns Fake accessibility config object
 */
export function createFakeLabelA11yConfig(
  overrides?: Partial<FakeLabelA11yConfig>
): FakeLabelA11yConfig {
  return {
    srOnly: faker.datatype.boolean({ probability: 0.2 }),
    useAriaLabel: faker.datatype.boolean({ probability: 0.1 }),
    ariaDescribedBy: faker.helpers.maybe(() => `desc-${faker.string.alphanumeric(6)}`, {
      probability: 0.3,
    }),
    ...overrides,
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple fake labels
 * @param count - Number of labels to create
 * @returns Array of fake labels
 */
export function createFakeLabels(count: number): FakeLabel[] {
  return Array.from({ length: count }, () => createFakeLabel());
}

/**
 * Creates multiple fake form fields
 * @param count - Number of fields to create
 * @returns Array of fake form fields
 */
export function createFakeFormFields(count: number): FakeFormField[] {
  return Array.from({ length: count }, () => createFakeFormField());
}

/**
 * Creates multiple fake checkbox fields
 * @param count - Number of checkbox fields to create
 * @returns Array of fake checkbox fields
 */
export function createFakeCheckboxFields(count: number): FakeCheckboxField[] {
  return Array.from({ length: count }, () => createFakeCheckboxField());
}

/**
 * Creates multiple fake switch fields
 * @param count - Number of switch fields to create
 * @returns Array of fake switch fields
 */
export function createFakeSwitchFields(count: number): FakeSwitchField[] {
  return Array.from({ length: count }, () => createFakeSwitchField());
}

/**
 * Creates multiple fake form sections
 * @param count - Number of sections to create
 * @returns Array of fake form sections
 */
export function createFakeFormSections(count: number): FakeFormSection[] {
  return Array.from({ length: count }, () => createFakeFormSection());
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a registration form field set
 * @returns Array of form fields for a registration form
 */
export function createFakeRegistrationForm(): FakeFormField[] {
  const contexts: LabelContext[] = [
    'email',
    'username',
    'password',
    'confirmPassword',
    'firstName',
    'lastName',
  ];

  return contexts.map((context) => {
    const id = faker.string.uuid();
    return createFakeFormField({
      id,
      type: getControlTypeForContext(context),
      required: isContextTypicallyRequired(context),
      label: createFakeLabelForContext(context, { htmlFor: id }),
      placeholder: getPlaceholderForContext(context),
    });
  });
}

/**
 * Creates a login form field set
 * @returns Array of form fields for a login form
 */
export function createFakeLoginForm(): FakeFormField[] {
  const contexts: LabelContext[] = ['email', 'password'];

  return contexts.map((context) => {
    const id = faker.string.uuid();
    return createFakeFormField({
      id,
      type: getControlTypeForContext(context),
      required: true,
      label: createFakeLabelForContext(context, { htmlFor: id, requirement: 'required' }),
      placeholder: getPlaceholderForContext(context),
    });
  });
}

/**
 * Creates a contact form field set
 * @returns Array of form fields for a contact form
 */
export function createFakeContactForm(): FakeFormField[] {
  const contexts: LabelContext[] = ['fullName', 'email', 'phone', 'subject', 'message'];

  return contexts.map((context) => {
    const id = faker.string.uuid();
    return createFakeFormField({
      id,
      type: getControlTypeForContext(context),
      required: context !== 'phone',
      label: createFakeLabelForContext(context, {
        htmlFor: id,
        requirement: context !== 'phone' ? 'required' : 'optional',
      }),
      placeholder: getPlaceholderForContext(context),
    });
  });
}

/**
 * Creates an address form field set
 * @returns Array of form fields for an address form
 */
export function createFakeAddressForm(): FakeFormField[] {
  const contexts: LabelContext[] = ['address', 'city', 'state', 'postalCode', 'country'];

  return contexts.map((context) => {
    const id = faker.string.uuid();
    return createFakeFormField({
      id,
      type: getControlTypeForContext(context),
      required: true,
      label: createFakeLabelForContext(context, { htmlFor: id, requirement: 'required' }),
      placeholder: getPlaceholderForContext(context),
    });
  });
}

/**
 * Creates a profile form field set
 * @returns Array of form fields for a profile form
 */
export function createFakeProfileForm(): FakeFormField[] {
  const contexts: LabelContext[] = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'company',
    'title',
    'bio',
    'url',
  ];

  return contexts.map((context) => {
    const id = faker.string.uuid();
    const isRequired = ['firstName', 'lastName', 'email'].includes(context);
    return createFakeFormField({
      id,
      type: getControlTypeForContext(context),
      required: isRequired,
      label: createFakeLabelForContext(context, {
        htmlFor: id,
        requirement: isRequired ? 'required' : 'optional',
      }),
      placeholder: getPlaceholderForContext(context),
    });
  });
}

/**
 * Creates a payment form field set
 * @returns Array of form fields for a payment form
 */
export function createFakePaymentForm(): FakeFormField[] {
  const fields: FakeFormField[] = [];

  // Card holder name
  const nameId = faker.string.uuid();
  fields.push(
    createFakeFormField({
      id: nameId,
      type: 'text',
      required: true,
      label: createFakeLabel({
        htmlFor: nameId,
        text: i18n.t('factory.label.cardholderName', 'Cardholder Name'),
        requirement: 'required',
      }),
      placeholder: i18n.t('factory.label.johnDoe', 'John Doe'),
    })
  );

  // Credit card number
  const cardId = faker.string.uuid();
  fields.push(
    createFakeFormField({
      id: cardId,
      type: 'text',
      required: true,
      label: createFakeLabelForContext('creditCard', { htmlFor: cardId, requirement: 'required' }),
      placeholder: getPlaceholderForContext('creditCard'),
    })
  );

  // Expiry date
  const expiryId = faker.string.uuid();
  fields.push(
    createFakeFormField({
      id: expiryId,
      type: 'text',
      required: true,
      label: createFakeLabel({
        htmlFor: expiryId,
        text: i18n.t('factory.label.expiryDate', 'Expiry Date'),
        requirement: 'required',
      }),
      placeholder: i18n.t('factory.label.mmYy', 'MM / YY'),
    })
  );

  // CVV
  const cvvId = faker.string.uuid();
  fields.push(
    createFakeFormField({
      id: cvvId,
      type: 'text',
      required: true,
      label: createFakeLabel({
        htmlFor: cvvId,
        text: i18n.t('factory.label.securityCodeCvv', 'Security Code (CVV)'),
        requirement: 'required',
      }),
      placeholder: '123',
    })
  );

  return fields;
}

/**
 * Creates a settings preference field set with switches
 * @returns Array of switch fields for settings
 */
export function createFakeSettingsPreferences(): FakeSwitchField[] {
  const labels = [
    i18n.t('factory.label.darkMode', 'Dark mode'),
    i18n.t('factory.label.emailNotifications', 'Email notifications'),
    i18n.t('factory.label.pushNotifications', 'Push notifications'),
    i18n.t('factory.label.smsAlerts', 'SMS alerts'),
    i18n.t('factory.label.autosaveDrafts', 'Auto-save drafts'),
    i18n.t('factory.label.showOnlineStatus', 'Show online status'),
    i18n.t('factory.label.twofactorAuthentication', 'Two-factor authentication'),
    i18n.t('factory.label.marketingEmails', 'Marketing emails'),
  ];

  return labels.map((text) => {
    const id = faker.string.uuid();
    return createFakeSwitchField({
      id,
      label: createFakeLabel({
        htmlFor: id,
        text,
        requirement: 'optional',
      }),
    });
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of labels by size
 * @returns Array of labels, one for each size
 */
export function createFakeLabelSizeMatrix(): FakeLabel[] {
  return LABEL_SIZES.map((size) =>
    createFakeLabel({
      size,
      text: i18n.t('factory.label.sizeLabel', 'Size: {{size}}', { size }),
      className: LABEL_SIZE_CLASSES[size],
    })
  );
}

/**
 * Creates a matrix of labels by state
 * @returns Array of labels, one for each state
 */
export function createFakeLabelStateMatrix(): FakeLabel[] {
  return LABEL_STATES.map((state) =>
    createFakeLabel({
      state,
      text: i18n.t('factory.label.stateLabel', 'State: {{state}}', { state }),
    })
  );
}

/**
 * Creates a matrix of labels by requirement
 * @returns Array of labels, one for each requirement type
 */
export function createFakeLabelRequirementMatrix(): FakeLabel[] {
  return LABEL_REQUIREMENTS.map((requirement) =>
    createFakeLabel({
      requirement,
      text: i18n.t('factory.label.fieldRequirement', 'Field ({{requirement}})', { requirement }),
    })
  );
}

/**
 * Creates a matrix of labels for each context
 * @returns Array of labels, one for each context
 */
export function createFakeLabelContextMatrix(): FakeLabel[] {
  return LABEL_CONTEXTS.map((context) => createFakeLabelForContext(context));
}

/**
 * Creates a matrix of form fields by control type
 * @returns Array of form fields, one for each control type
 */
export function createFakeFormFieldControlTypeMatrix(): FakeFormField[] {
  return LABEL_CONTROL_TYPES.map((type) => {
    const id = faker.string.uuid();
    return createFakeFormField({
      id,
      type,
      label: createFakeLabel({
        htmlFor: id,
        text: i18n.t('factory.label.controlType', 'Control: {{type}}', { type }),
      }),
    });
  });
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all label configurations
 * @returns Record of categorized label configurations
 */
export function createFakeLabelShowcase(): Record<string, unknown> {
  return {
    // Basic elements
    label: createFakeLabel(),
    formField: createFakeFormField(),
    checkboxField: createFakeCheckboxField(),
    switchField: createFakeSwitchField(),
    radioGroup: createFakeRadioGroup(),
    formSection: createFakeFormSection(),

    // Size variations
    labelXs: createFakeLabel({
      size: 'xs',
      text: i18n.t('factory.label.extraSmallLabel', 'Extra Small Label'),
    }),
    labelSm: createFakeLabel({
      size: 'sm',
      text: i18n.t('factory.label.smallLabel', 'Small Label'),
    }),
    labelBase: createFakeLabel({
      size: 'base',
      text: i18n.t('factory.label.baseLabel', 'Base Label'),
    }),
    labelLg: createFakeLabel({
      size: 'lg',
      text: i18n.t('factory.label.largeLabel', 'Large Label'),
    }),
    labelXl: createFakeLabel({
      size: 'xl',
      text: i18n.t('factory.label.extraLargeLabel', 'Extra Large Label'),
    }),

    // State variations
    labelDefault: createFakeLabel({
      state: 'default',
      text: i18n.t('factory.label.defaultState', 'Default State'),
    }),
    labelFocused: createFakeLabel({
      state: 'focused',
      text: i18n.t('factory.label.focusedState', 'Focused State'),
    }),
    labelDisabled: createFakeLabel({
      state: 'disabled',
      text: i18n.t('factory.label.disabledState', 'Disabled State'),
    }),
    labelError: createFakeLabel({
      state: 'error',
      text: i18n.t('factory.label.errorState', 'Error State'),
    }),
    labelSuccess: createFakeLabel({
      state: 'success',
      text: i18n.t('factory.label.successState', 'Success State'),
    }),

    // Requirement variations
    labelRequired: createFakeLabel({
      requirement: 'required',
      text: i18n.t('factory.label.requiredField', 'Required Field'),
    }),
    labelOptional: createFakeLabel({
      requirement: 'optional',
      text: i18n.t('factory.label.optionalField', 'Optional Field'),
    }),

    // Common form patterns
    registrationForm: createFakeRegistrationForm(),
    loginForm: createFakeLoginForm(),
    contactForm: createFakeContactForm(),
    addressForm: createFakeAddressForm(),
    profileForm: createFakeProfileForm(),
    paymentForm: createFakePaymentForm(),
    settingsPreferences: createFakeSettingsPreferences(),

    // Accessibility
    a11yConfig: createFakeLabelA11yConfig(),
    srOnlyLabel: createFakeLabelA11yConfig({ srOnly: true }),
    ariaLabelOnly: createFakeLabelA11yConfig({ useAriaLabel: true }),

    // Matrices
    sizeMatrix: createFakeLabelSizeMatrix(),
    stateMatrix: createFakeLabelStateMatrix(),
    requirementMatrix: createFakeLabelRequirementMatrix(),
    contextMatrix: createFakeLabelContextMatrix(),
    controlTypeMatrix: createFakeFormFieldControlTypeMatrix(),
  };
}
