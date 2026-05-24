/**
 * Dialog Factory
 *
 * Provides faker-based test data generation for Dialog component stories.
 * Supports various dialog types: confirmation, form, wizard, settings, and more.
 *
 * @module dialog.factory
 * @see {@link file://./../../../components/ui/dialog.tsx}
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Dialog size variants
 * @description Controls the max-width of the dialog content
 */
export type DialogSize = 'default' | 'full' | 'lg' | 'sm' | 'xl';

/**
 * Dialog type classifications
 * @description Semantic types for different dialog use cases
 */
export type DialogType = 'alert' | 'confirmation' | 'form' | 'info' | 'settings' | 'wizard';

/**
 * Dialog position variants
 * @description Where the dialog appears on screen
 */
export type DialogPosition = 'bottom' | 'center' | 'left' | 'right' | 'top';

/**
 * Form field types for dialog forms
 * @description Types of inputs that can appear in form dialogs
 */
export type DialogFormFieldType =
  | 'checkbox'
  | 'date'
  | 'email'
  | 'file'
  | 'number'
  | 'password'
  | 'select'
  | 'text'
  | 'textarea';

/**
 * Dialog button action types
 * @description Types of actions for dialog buttons
 */
export type DialogButtonAction = 'cancel' | 'confirm' | 'custom' | 'destructive';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base dialog content interface
 */
export interface FakeDialogContent {
  /** Cancel button label */
  cancelLabel: string;
  /** Confirm button label */
  confirmLabel: string;
  /** Dialog description text */
  description: string;
  /** Whether this is a destructive action */
  destructive?: boolean;
  /** Unique identifier */
  id: string;
  /** Dialog title */
  title: string;
}

/**
 * Dialog button configuration
 */
export interface FakeDialogButton {
  /** Action type */
  action: DialogButtonAction;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Unique identifier */
  id: string;
  /** Button label */
  label: string;
  /** Whether button shows loading state */
  loading?: boolean;
  /** Button variant (maps to Button component) */
  variant?: 'default' | 'destructive' | 'ghost' | 'outline' | 'secondary';
}

/**
 * Form field configuration for dialog forms
 */
export interface FakeDialogFormField {
  /** Default value */
  defaultValue?: boolean | number | string;
  /** Field description/help text */
  description?: string;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Error message if validation fails */
  errorMessage?: string;
  /** Unique identifier */
  id: string;
  /** Field label */
  label: string;
  /** Select options if type is 'select' */
  options?: Array<{ label: string; value: string }>;
  /** Placeholder text */
  placeholder?: string;
  /** Whether field is required */
  required?: boolean;
  /** Field type */
  type: DialogFormFieldType;
}

/**
 * Form dialog configuration
 */
export interface FakeFormDialog extends FakeDialogContent {
  /** Form fields */
  fields: FakeDialogFormField[];
  /** Form submission endpoint */
  submitEndpoint?: string;
  /** Form validation rules */
  validationRules?: Record<string, string>;
}

/**
 * Confirmation dialog configuration
 */
export interface FakeConfirmationDialog extends FakeDialogContent {
  /** Checkbox confirmation text (e.g., "I understand this action cannot be undone") */
  checkboxLabel?: string;
  /** Whether confirmation checkbox is required */
  requiresCheckbox?: boolean;
  /** Warning message */
  warningMessage?: string;
}

/**
 * Wizard step configuration
 */
export interface FakeWizardStep {
  /** Step description */
  description?: string;
  /** Step fields */
  fields?: FakeDialogFormField[];
  /** Unique identifier */
  id: string;
  /** Whether step is optional */
  optional?: boolean;
  /** Step title */
  title: string;
  /** Validation before proceeding */
  validation?: string;
}

/**
 * Wizard dialog configuration
 */
export interface FakeWizardDialog extends FakeDialogContent {
  /** Whether user can skip ahead */
  allowSkip?: boolean;
  /** Current step index */
  currentStep: number;
  /** Whether to show progress indicator */
  showProgress?: boolean;
  /** Wizard steps */
  steps: FakeWizardStep[];
}

/**
 * Settings section configuration
 */
export interface FakeSettingsSection {
  /** Section description */
  description?: string;
  /** Settings fields */
  fields: FakeDialogFormField[];
  /** Unique identifier */
  id: string;
  /** Section title */
  title: string;
}

/**
 * Settings dialog configuration
 */
export interface FakeSettingsDialog extends FakeDialogContent {
  /** Active section ID */
  activeSectionId?: string;
  /** Whether settings are dirty (unsaved changes) */
  isDirty?: boolean;
  /** Settings sections */
  sections: FakeSettingsSection[];
}

/**
 * Alert dialog configuration
 */
export interface FakeAlertDialog extends FakeDialogContent {
  /** Alert type */
  alertType: 'error' | 'info' | 'success' | 'warning';
  /** Whether dialog auto-closes */
  autoClose?: boolean;
  /** Auto-close delay in ms */
  autoCloseMs?: number;
  /** Icon name to display */
  icon?: string;
}

/**
 * Image preview dialog configuration
 */
export interface FakeImagePreviewDialog {
  /** Alt text */
  alt: string;
  /** Caption text */
  caption?: string;
  /** Download URL */
  downloadUrl?: string;
  /** Unique identifier */
  id: string;
  /** Image URL */
  imageUrl: string;
  /** Image title */
  title: string;
}

/**
 * Video dialog configuration
 */
export interface FakeVideoDialog {
  /** Whether to autoplay */
  autoplay?: boolean;
  /** Video duration in seconds */
  duration: number;
  /** Unique identifier */
  id: string;
  /** Poster image URL */
  posterUrl?: string;
  /** Video title */
  title: string;
  /** Video URL */
  videoUrl: string;
}

/**
 * Complete dialog configuration
 */
export interface FakeDialog {
  /** Buttons configuration */
  buttons: FakeDialogButton[];
  /** Dialog content */
  content: FakeDialogContent;
  /** Whether dialog is open */
  defaultOpen?: boolean;
  /** Footer text */
  footerText?: string;
  /** Unique identifier */
  id: string;
  /** Whether clicking overlay closes dialog */
  overlayClose?: boolean;
  /** Dialog position */
  position?: DialogPosition;
  /** Whether to show close icon */
  showCloseIcon?: boolean;
  /** Dialog size */
  size?: DialogSize;
  /** Dialog type */
  type: DialogType;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Dialog size options
 */
export const DIALOG_SIZES: DialogSize[] = ['sm', 'default', 'lg', 'xl', 'full'];

/**
 * Dialog type options
 */
export const DIALOG_TYPES: DialogType[] = [
  'alert',
  'confirmation',
  'form',
  'info',
  'settings',
  'wizard',
];

/**
 * Dialog position options
 */
export const DIALOG_POSITIONS: DialogPosition[] = ['center', 'top', 'bottom', 'left', 'right'];

/**
 * Form field type options
 */
export const DIALOG_FORM_FIELD_TYPES: DialogFormFieldType[] = [
  'checkbox',
  'date',
  'email',
  'file',
  'number',
  'password',
  'select',
  'text',
  'textarea',
];

/**
 * Common dialog titles by category
 */
export const DIALOG_TITLES = {
  alert: [
    i18n.t('factory.dialog.alert', 'Alert'),
    i18n.t('factory.dialog.notice', 'Notice'),
    i18n.t('factory.dialog.attention', 'Attention'),
    i18n.t('factory.dialog.important', 'Important'),
    i18n.t('factory.dialog.message', 'Message'),
  ],
  confirmation: [
    i18n.t('factory.dialog.confirmAction', 'Confirm Action'),
    i18n.t('factory.dialog.areYouSure', 'Are you sure?'),
    i18n.t('factory.dialog.pleaseConfirm', 'Please Confirm'),
    i18n.t('factory.dialog.confirmationRequired', 'Confirmation Required'),
    i18n.t('factory.dialog.verifyAction', 'Verify Action'),
  ],
  delete: [
    i18n.t('factory.dialog.deleteItem', 'Delete Item'),
    i18n.t('factory.dialog.confirmDeletion', 'Confirm Deletion'),
    i18n.t('factory.dialog.removeItem', 'Remove Item'),
    i18n.t('factory.dialog.deletePermanently', 'Delete Permanently'),
    i18n.t('factory.dialog.trashItem', 'Trash Item'),
  ],
  form: [
    i18n.t('factory.dialog.editProfile', 'Edit Profile'),
    i18n.t('factory.dialog.createNew', 'Create New'),
    i18n.t('factory.dialog.updateSettings', 'Update Settings'),
    i18n.t('factory.dialog.addItem', 'Add Item'),
    i18n.t('factory.dialog.submitForm', 'Submit Form'),
  ],
  info: [
    i18n.t('factory.dialog.information', 'Information'),
    i18n.t('factory.dialog.details', 'Details'),
    i18n.t('factory.dialog.about', 'About'),
    i18n.t('factory.dialog.learnMore', 'Learn More'),
    i18n.t('factory.dialog.help', 'Help'),
  ],
  settings: [
    i18n.t('factory.dialog.settings', 'Settings'),
    i18n.t('factory.dialog.preferences', 'Preferences'),
    i18n.t('factory.dialog.configuration', 'Configuration'),
    i18n.t('factory.dialog.options', 'Options'),
    i18n.t('factory.dialog.customize', 'Customize'),
  ],
  wizard: [
    i18n.t('factory.dialog.getStarted', 'Get Started'),
    i18n.t('factory.dialog.setupWizard', 'Setup Wizard'),
    i18n.t('factory.dialog.onboarding', 'Onboarding'),
    i18n.t('factory.dialog.quickStart', 'Quick Start'),
    i18n.t('factory.dialog.configurationWizard', 'Configuration Wizard'),
  ],
} as const;

/**
 * Common confirm button labels
 */
export const CONFIRM_LABELS = {
  create: [
    i18n.t('factory.dialog.create', 'Create'),
    i18n.t('factory.dialog.add', 'Add'),
    i18n.t('factory.dialog.submit', 'Submit'),
    i18n.t('factory.dialog.save', 'Save'),
  ],
  delete: [
    i18n.t('factory.dialog.delete', 'Delete'),
    i18n.t('factory.dialog.remove', 'Remove'),
    i18n.t('factory.dialog.trash', 'Trash'),
    i18n.t('factory.dialog.confirmDelete', 'Confirm Delete'),
  ],
  neutral: [
    i18n.t('factory.dialog.ok', 'OK'),
    i18n.t('factory.dialog.continue', 'Continue'),
    i18n.t('factory.dialog.proceed', 'Proceed'),
    i18n.t('factory.dialog.next', 'Next'),
  ],
  save: [
    i18n.t('factory.dialog.save', 'Save'),
    i18n.t('factory.dialog.saveChanges', 'Save Changes'),
    i18n.t('factory.dialog.update', 'Update'),
    i18n.t('factory.dialog.apply', 'Apply'),
  ],
} as const;

/**
 * Common cancel button labels
 */
export const CANCEL_LABELS = [
  i18n.t('factory.dialog.cancel', 'Cancel'),
  i18n.t('factory.dialog.close', 'Close'),
  i18n.t('factory.dialog.dismiss', 'Dismiss'),
  i18n.t('factory.dialog.neverMind', 'Never Mind'),
  i18n.t('factory.dialog.goBack', 'Go Back'),
] as const;

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a single fake dialog content
 */
export function createFakeDialogContent(overrides?: Partial<FakeDialogContent>): FakeDialogContent {
  const isDestructive = overrides?.destructive ?? faker.datatype.boolean({ probability: 0.3 });

  return {
    cancelLabel: faker.helpers.arrayElement([...CANCEL_LABELS]),
    confirmLabel: isDestructive
      ? faker.helpers.arrayElement([...CONFIRM_LABELS.delete])
      : faker.helpers.arrayElement([...CONFIRM_LABELS.save]),
    description: faker.lorem.paragraph(),
    destructive: isDestructive,
    id: faker.string.uuid(),
    title: faker.lorem.sentence({ min: 2, max: 5 }),
    ...overrides,
  };
}

/**
 * Creates a fake dialog button
 */
export function createFakeDialogButton(overrides?: Partial<FakeDialogButton>): FakeDialogButton {
  const action =
    overrides?.action ??
    faker.helpers.arrayElement<DialogButtonAction>(['cancel', 'confirm', 'destructive']);

  const variantMap: Record<DialogButtonAction, FakeDialogButton['variant']> = {
    cancel: 'outline',
    confirm: 'default',
    custom: 'secondary',
    destructive: 'destructive',
  };

  const labelMap: Record<DialogButtonAction, string[]> = {
    cancel: [...CANCEL_LABELS],
    confirm: [...CONFIRM_LABELS.save],
    custom: [
      i18n.t('factory.dialog.custom', 'Custom'),
      i18n.t('factory.dialog.action', 'Action'),
      i18n.t('factory.dialog.doIt', 'Do It'),
    ],
    destructive: [...CONFIRM_LABELS.delete],
  };

  return {
    action,
    disabled: faker.helpers.maybe(() => true, { probability: 0.1 }),
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(labelMap[action]),
    loading: faker.helpers.maybe(() => true, { probability: 0.1 }),
    variant: variantMap[action],
    ...overrides,
  };
}

/**
 * Creates a fake form field
 */
export function createFakeDialogFormField(
  overrides?: Partial<FakeDialogFormField>
): FakeDialogFormField {
  const type = overrides?.type ?? faker.helpers.arrayElement(DIALOG_FORM_FIELD_TYPES);

  const fieldNamesByType: Record<DialogFormFieldType, string[]> = {
    checkbox: [
      i18n.t('factory.dialog.subscribeToNewsletter', 'Subscribe to newsletter'),
      i18n.t('factory.dialog.acceptTerms', 'Accept terms'),
      i18n.t('factory.dialog.rememberMe', 'Remember me'),
      i18n.t('factory.dialog.enableNotifications', 'Enable notifications'),
    ],
    date: [
      i18n.t('factory.dialog.dateOfBirth', 'Date of birth'),
      i18n.t('factory.dialog.startDate', 'Start date'),
      i18n.t('factory.dialog.endDate', 'End date'),
      i18n.t('factory.dialog.dueDate', 'Due date'),
    ],
    email: [
      i18n.t('factory.dialog.email', 'Email'),
      i18n.t('factory.dialog.emailAddress', 'Email address'),
      i18n.t('factory.dialog.workEmail', 'Work email'),
      i18n.t('factory.dialog.contactEmail', 'Contact email'),
    ],
    file: [
      i18n.t('factory.dialog.uploadFile', 'Upload file'),
      i18n.t('factory.dialog.attachment', 'Attachment'),
      i18n.t('factory.dialog.document', 'Document'),
      i18n.t('factory.dialog.image', 'Image'),
    ],
    number: [
      i18n.t('factory.dialog.quantity', 'Quantity'),
      i18n.t('factory.dialog.amount', 'Amount'),
      i18n.t('factory.dialog.age', 'Age'),
      i18n.t('factory.dialog.phoneNumber', 'Phone number'),
    ],
    password: [
      i18n.t('factory.dialog.password', 'Password'),
      i18n.t('factory.dialog.newPassword', 'New password'),
      i18n.t('factory.dialog.confirmPassword', 'Confirm password'),
      i18n.t('factory.dialog.currentPassword', 'Current password'),
    ],
    select: [
      i18n.t('factory.dialog.country', 'Country'),
      i18n.t('factory.dialog.category', 'Category'),
      i18n.t('factory.dialog.status', 'Status'),
      i18n.t('factory.dialog.priority', 'Priority'),
    ],
    text: [
      i18n.t('factory.dialog.name', 'Name'),
      i18n.t('factory.dialog.title', 'Title'),
      i18n.t('factory.dialog.description', 'Description'),
      i18n.t('factory.dialog.username', 'Username'),
    ],
    textarea: [
      i18n.t('factory.dialog.bio', 'Bio'),
      i18n.t('factory.dialog.description', 'Description'),
      i18n.t('factory.dialog.notes', 'Notes'),
      i18n.t('factory.dialog.message', 'Message'),
    ],
  };

  return {
    defaultValue: type === 'checkbox' ? false : undefined,
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    disabled: faker.helpers.maybe(() => true, { probability: 0.05 }),
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(fieldNamesByType[type]),
    options:
      type === 'select'
        ? Array.from({ length: faker.number.int({ min: 3, max: 6 }) }, () => ({
            label: faker.word.noun(),
            value: faker.string.alphanumeric(8),
          }))
        : undefined,
    placeholder: faker.helpers.maybe(
      () =>
        i18n.t('factory.dialog.enterPlaceholder', 'Enter {{field}}', {
          field: faker.word.noun().toLowerCase(),
        }),
      {
        probability: 0.5,
      }
    ),
    required: faker.helpers.maybe(() => true, { probability: 0.4 }),
    type,
    ...overrides,
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple dialog contents
 */
export function createFakeDialogContents(count: number): FakeDialogContent[] {
  return Array.from({ length: count }, () => createFakeDialogContent());
}

/**
 * Creates multiple form fields
 */
export function createFakeDialogFormFields(count: number): FakeDialogFormField[] {
  return Array.from({ length: count }, () => createFakeDialogFormField());
}

/**
 * Creates a complete fake dialog configuration
 */
export function createFakeDialog(overrides?: Partial<FakeDialog>): FakeDialog {
  const type = overrides?.type ?? faker.helpers.arrayElement(DIALOG_TYPES);
  const content = createFakeDialogContent({
    title: faker.helpers.arrayElement(
      DIALOG_TITLES[type === 'confirmation' && faker.datatype.boolean() ? 'delete' : type] ||
        DIALOG_TITLES.form
    ),
  });

  return {
    buttons: [
      createFakeDialogButton({ action: 'cancel' }),
      createFakeDialogButton({ action: content.destructive ? 'destructive' : 'confirm' }),
    ],
    content,
    defaultOpen: false,
    id: faker.string.uuid(),
    overlayClose: true,
    position: 'center',
    showCloseIcon: true,
    size: faker.helpers.arrayElement(DIALOG_SIZES),
    type,
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a confirmation dialog
 */
export function createFakeConfirmationDialog(
  overrides?: Partial<FakeConfirmationDialog>
): FakeConfirmationDialog {
  const isDestructive = overrides?.destructive ?? faker.datatype.boolean({ probability: 0.5 });

  return {
    ...createFakeDialogContent({
      destructive: isDestructive,
      title: faker.helpers.arrayElement([...DIALOG_TITLES.confirmation]),
    }),
    checkboxLabel: isDestructive
      ? faker.helpers.maybe(
          () =>
            i18n.t(
              'factory.dialog.iUnderstandThisActionCannot',
              'I understand this action cannot be undone'
            ),
          { probability: 0.6 }
        )
      : undefined,
    requiresCheckbox:
      isDestructive && faker.helpers.maybe(() => true, { probability: 0.4 }) !== undefined,
    warningMessage: isDestructive
      ? faker.helpers.maybe(
          () =>
            i18n.t(
              'factory.dialog.thisActionIsPermanentAnd',
              'This action is permanent and cannot be reversed.'
            ),
          {
            probability: 0.5,
          }
        )
      : undefined,
    ...overrides,
  };
}

/**
 * Creates a form dialog with fields
 */
export function createFakeFormDialog(
  fieldCount: number = 3,
  overrides?: Partial<FakeFormDialog>
): FakeFormDialog {
  return {
    ...createFakeDialogContent({
      destructive: false,
      title: faker.helpers.arrayElement([...DIALOG_TITLES.form]),
    }),
    fields: Array.from({ length: fieldCount }, () => createFakeDialogFormField()),
    submitEndpoint: `/api/${faker.word.noun().toLowerCase()}`,
    ...overrides,
  };
}

/**
 * Creates a wizard dialog with steps
 */
export function createFakeWizardDialog(
  stepCount: number = 3,
  overrides?: Partial<FakeWizardDialog>
): FakeWizardDialog {
  const steps: FakeWizardStep[] = Array.from({ length: stepCount }, (_, index) => ({
    description: faker.lorem.sentence(),
    fields:
      index < stepCount - 1
        ? createFakeDialogFormFields(faker.number.int({ min: 2, max: 4 }))
        : undefined,
    id: faker.string.uuid(),
    optional: index > 0 && faker.helpers.maybe(() => true, { probability: 0.2 }) !== undefined,
    title: i18n.t('factory.dialog.stepTitle', 'Step {{number}}: {{name}}', {
      number: index + 1,
      name: faker.word.words(2),
    }),
  }));

  return {
    ...createFakeDialogContent({
      destructive: false,
      title: faker.helpers.arrayElement([...DIALOG_TITLES.wizard]),
    }),
    allowSkip: faker.datatype.boolean(),
    currentStep: 0,
    showProgress: true,
    steps,
    ...overrides,
  };
}

/**
 * Creates a settings dialog with sections
 */
export function createFakeSettingsDialog(
  sectionCount: number = 3,
  overrides?: Partial<FakeSettingsDialog>
): FakeSettingsDialog {
  const sectionNames = [
    i18n.t('factory.dialog.general', 'General'),
    i18n.t('factory.dialog.notifications', 'Notifications'),
    i18n.t('factory.dialog.privacy', 'Privacy'),
    i18n.t('factory.dialog.security', 'Security'),
    i18n.t('factory.dialog.appearance', 'Appearance'),
    i18n.t('factory.dialog.language', 'Language'),
  ];

  const sections: FakeSettingsSection[] = faker.helpers
    .arrayElements(sectionNames, sectionCount)
    .map((name) => ({
      description: faker.lorem.sentence(),
      fields: createFakeDialogFormFields(faker.number.int({ min: 2, max: 5 })),
      id: name.toLowerCase(),
      title: name,
    }));

  return {
    ...createFakeDialogContent({
      destructive: false,
      title: faker.helpers.arrayElement([...DIALOG_TITLES.settings]),
    }),
    activeSectionId: sections[0]?.id,
    isDirty: faker.datatype.boolean(),
    sections,
    ...overrides,
  };
}

/**
 * Creates an alert dialog
 */
export function createFakeAlertDialog(
  alertType: FakeAlertDialog['alertType'] = 'info',
  overrides?: Partial<FakeAlertDialog>
): FakeAlertDialog {
  const iconMap: Record<FakeAlertDialog['alertType'], string> = {
    error: 'XCircle',
    info: i18n.t('factory.dialog.info', 'Info'),
    success: 'CheckCircle',
    warning: 'AlertTriangle',
  };

  const titleMap: Record<FakeAlertDialog['alertType'], string[]> = {
    error: [
      i18n.t('factory.dialog.error', 'Error'),
      i18n.t('factory.dialog.somethingWentWrong', 'Something went wrong'),
      i18n.t('factory.dialog.operationFailed', 'Operation failed'),
      i18n.t('factory.dialog.errorOccurred', 'Error occurred'),
    ],
    info: [
      i18n.t('factory.dialog.information', 'Information'),
      i18n.t('factory.dialog.note', 'Note'),
      i18n.t('factory.dialog.tip', 'Tip'),
      i18n.t('factory.dialog.didYouKnow', 'Did you know?'),
    ],
    success: [
      i18n.t('factory.dialog.success', 'Success!'),
      i18n.t('factory.dialog.done', 'Done!'),
      i18n.t('factory.dialog.completed', 'Completed'),
      i18n.t('factory.dialog.allSet', 'All set!'),
    ],
    warning: [
      i18n.t('factory.dialog.warning', 'Warning'),
      i18n.t('factory.dialog.caution', 'Caution'),
      i18n.t('factory.dialog.attention', 'Attention'),
      i18n.t('factory.dialog.pleaseNote', 'Please note'),
    ],
  };

  return {
    ...createFakeDialogContent({
      destructive: false,
      title: faker.helpers.arrayElement(titleMap[alertType]),
    }),
    alertType,
    autoClose: alertType === 'success',
    autoCloseMs: alertType === 'success' ? 3000 : undefined,
    icon: iconMap[alertType],
    ...overrides,
  };
}

/**
 * Creates an image preview dialog
 */
export function createFakeImagePreviewDialog(
  overrides?: Partial<FakeImagePreviewDialog>
): FakeImagePreviewDialog {
  return {
    alt: faker.lorem.sentence({ min: 3, max: 8 }),
    caption: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    downloadUrl: faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }),
    id: faker.string.uuid(),
    imageUrl: faker.image.url({ width: 800, height: 600 }),
    title: faker.lorem.sentence({ min: 2, max: 5 }),
    ...overrides,
  };
}

/**
 * Creates a video dialog
 */
export function createFakeVideoDialog(overrides?: Partial<FakeVideoDialog>): FakeVideoDialog {
  return {
    autoplay: faker.datatype.boolean(),
    duration: faker.number.int({ min: 30, max: 600 }),
    id: faker.string.uuid(),
    posterUrl: faker.helpers.maybe(() => faker.image.url({ width: 1280, height: 720 }), {
      probability: 0.7,
    }),
    title: faker.lorem.sentence({ min: 2, max: 6 }),
    videoUrl: `https://example.com/videos/${faker.string.alphanumeric(10)}.mp4`,
    ...overrides,
  };
}

/**
 * Creates a user profile edit dialog
 */
export function createFakeProfileEditDialog(): FakeFormDialog {
  return createFakeFormDialog(0, {
    description: i18n.t(
      'factory.dialog.updateYourProfileInformation',
      'Update your profile information.'
    ),
    fields: [
      {
        id: 'avatar',
        label: i18n.t('factory.dialog.profilePicture', 'Profile Picture'),
        type: 'file',
        description: i18n.t(
          'factory.dialog.uploadANewProfilePicture',
          'Upload a new profile picture'
        ),
      },
      {
        id: 'name',
        label: i18n.t('factory.dialog.fullName', 'Full Name'),
        type: 'text',
        required: true,
        defaultValue: faker.person.fullName(),
      },
      {
        id: 'email',
        label: i18n.t('factory.dialog.email', 'Email'),
        type: 'email',
        required: true,
        defaultValue: faker.internet.email(),
      },
      {
        id: 'bio',
        label: i18n.t('factory.dialog.bio', 'Bio'),
        type: 'textarea',
        placeholder: i18n.t('factory.dialog.tellUsAboutYourself', 'Tell us about yourself...'),
      },
      {
        id: 'website',
        label: i18n.t('factory.dialog.website', 'Website'),
        type: 'text',
        placeholder: i18n.t('factory.dialog.httpsPrefix', 'https://'),
      },
    ],
    title: i18n.t('factory.dialog.editProfile', 'Edit Profile'),
  });
}

/**
 * Creates a delete confirmation dialog
 */
export function createFakeDeleteConfirmationDialog(
  itemName: string = faker.word.noun()
): FakeConfirmationDialog {
  return createFakeConfirmationDialog({
    checkboxLabel: i18n.t(
      'factory.dialog.iUnderstandThisCannotBe',
      'I understand this cannot be undone'
    ),
    confirmLabel: i18n.t('factory.dialog.delete', 'Delete'),
    description: i18n.t(
      'factory.dialog.deleteConfirmDescription',
      'Are you sure you want to delete "{{item}}"? This action cannot be undone.',
      { item: itemName }
    ),
    destructive: true,
    requiresCheckbox: true,
    title: i18n.t('factory.dialog.deleteTitle', 'Delete {{item}}', { item: itemName }),
    warningMessage: i18n.t(
      'factory.dialog.allAssociatedDataWillBe',
      'All associated data will be permanently removed.'
    ),
  });
}

/**
 * Creates a share dialog
 */
export function createFakeShareDialog(): FakeDialog {
  return {
    buttons: [
      createFakeDialogButton({
        action: 'cancel',
        label: i18n.t('factory.dialog.cancel', 'Cancel'),
      }),
      createFakeDialogButton({
        action: 'confirm',
        label: i18n.t('factory.dialog.copyLink', 'Copy Link'),
      }),
    ],
    content: {
      cancelLabel: i18n.t('factory.dialog.cancel', 'Cancel'),
      confirmLabel: i18n.t('factory.dialog.copyLink', 'Copy Link'),
      description: i18n.t(
        'factory.dialog.shareThisItemWithOthers',
        'Share this item with others via link or social media.'
      ),
      id: faker.string.uuid(),
      title: i18n.t('factory.dialog.share', 'Share'),
    },
    id: faker.string.uuid(),
    overlayClose: true,
    showCloseIcon: true,
    size: 'default',
    type: 'info',
  };
}

/**
 * Creates an onboarding wizard dialog
 */
export function createFakeOnboardingWizard(): FakeWizardDialog {
  return createFakeWizardDialog(4, {
    allowSkip: false,
    description: i18n.t(
      'factory.dialog.letsGetYouSetUp',
      "Let's get you set up in just a few steps."
    ),
    showProgress: true,
    steps: [
      {
        description: i18n.t('factory.dialog.tellUsABitAbout', 'Tell us a bit about yourself'),
        fields: [
          {
            id: 'name',
            label: i18n.t('factory.dialog.yourName', 'Your Name'),
            type: 'text',
            required: true,
          },
          {
            id: 'role',
            label: i18n.t('factory.dialog.yourRole', 'Your Role'),
            type: 'select',
            options: [
              { label: i18n.t('factory.dialog.developer', 'Developer'), value: 'developer' },
              { label: i18n.t('factory.dialog.designer', 'Designer'), value: 'designer' },
              { label: i18n.t('factory.dialog.productManager', 'Product Manager'), value: 'pm' },
              { label: i18n.t('factory.dialog.other', 'Other'), value: 'other' },
            ],
          },
        ],
        id: 'welcome',
        title: i18n.t('factory.dialog.welcome', 'Welcome!'),
      },
      {
        description: i18n.t('factory.dialog.customizeYourWorkspace', 'Customize your workspace'),
        fields: [
          {
            id: 'theme',
            label: i18n.t('factory.dialog.theme', 'Theme'),
            type: 'select',
            options: [
              { label: i18n.t('factory.dialog.light', 'Light'), value: 'light' },
              { label: i18n.t('factory.dialog.dark', 'Dark'), value: 'dark' },
              { label: i18n.t('factory.dialog.system', 'System'), value: 'system' },
            ],
          },
          {
            id: 'notifications',
            label: i18n.t('factory.dialog.enableNotifications', 'Enable notifications'),
            type: 'checkbox',
            defaultValue: true,
          },
        ],
        id: 'preferences',
        title: i18n.t('factory.dialog.preferences', 'Preferences'),
      },
      {
        description: i18n.t('factory.dialog.connectYourTeamMembers', 'Connect your team members'),
        fields: [
          {
            id: 'invites',
            label: i18n.t(
              'factory.dialog.emailAddressesCommaSeparated',
              'Email addresses (comma separated)'
            ),
            type: 'textarea',
            placeholder: i18n.t(
              'factory.dialog.janeexamplecomJohnexamplecom',
              'jane@example.com, john@example.com'
            ),
          },
        ],
        id: 'team',
        optional: true,
        title: i18n.t('factory.dialog.inviteTeam', 'Invite Team'),
      },
      {
        description: i18n.t(
          'factory.dialog.youreAllSetStartExploring',
          "You're all set! Start exploring the platform."
        ),
        id: 'complete',
        title: i18n.t('factory.dialog.allDone', 'All Done!'),
      },
    ],
    title: i18n.t('factory.dialog.welcomeToThePlatform', 'Welcome to the Platform'),
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of dialog configurations for visual testing
 */
export function createFakeDialogMatrix(): Record<string, FakeDialog> {
  return {
    confirmationDefault: {
      ...createFakeDialog({ type: 'confirmation' }),
      content: createFakeDialogContent({
        destructive: false,
        title: i18n.t('factory.dialog.confirmAction', 'Confirm Action'),
      }),
    },
    confirmationDestructive: {
      ...createFakeDialog({ type: 'confirmation' }),
      buttons: [
        createFakeDialogButton({ action: 'cancel' }),
        createFakeDialogButton({
          action: 'destructive',
          label: i18n.t('factory.dialog.delete', 'Delete'),
        }),
      ],
      content: createFakeDialogContent({
        destructive: true,
        title: i18n.t('factory.dialog.deleteItem', 'Delete Item'),
      }),
    },
    formSimple: {
      ...createFakeDialog({ type: 'form' }),
      content: createFakeDialogContent({
        destructive: false,
        title: i18n.t('factory.dialog.editDetails', 'Edit Details'),
      }),
    },
    infoAlert: {
      ...createFakeDialog({ type: 'info' }),
      content: createFakeDialogContent({
        destructive: false,
        title: i18n.t('factory.dialog.information', 'Information'),
      }),
    },
    sizeSmall: {
      ...createFakeDialog({ size: 'sm' }),
      content: createFakeDialogContent({
        title: i18n.t('factory.dialog.smallDialog', 'Small Dialog'),
      }),
    },
    sizeLarge: {
      ...createFakeDialog({ size: 'lg' }),
      content: createFakeDialogContent({
        title: i18n.t('factory.dialog.largeDialog', 'Large Dialog'),
      }),
    },
    sizeXl: {
      ...createFakeDialog({ size: 'xl' }),
      content: createFakeDialogContent({
        title: i18n.t('factory.dialog.extraLargeDialog', 'Extra Large Dialog'),
      }),
    },
    sizeFull: {
      ...createFakeDialog({ size: 'full' }),
      content: createFakeDialogContent({
        title: i18n.t('factory.dialog.fullWidthDialog', 'Full Width Dialog'),
      }),
    },
    noCloseIcon: {
      ...createFakeDialog(),
      content: createFakeDialogContent({
        title: i18n.t('factory.dialog.noCloseIcon', 'No Close Icon'),
      }),
      showCloseIcon: false,
    },
    withFooterText: {
      ...createFakeDialog(),
      content: createFakeDialogContent({
        title: i18n.t('factory.dialog.withFooterText', 'With Footer Text'),
      }),
      footerText: i18n.t(
        'factory.dialog.byContinuingYouAgreeTo',
        'By continuing, you agree to our Terms of Service.'
      ),
    },
  };
}

/**
 * Creates a showcase of all dialog types
 */
export function createFakeDialogShowcase(): Record<
  string,
  FakeAlertDialog | FakeDialog | FakeFormDialog | FakeSettingsDialog | FakeWizardDialog
> {
  return {
    simpleConfirmation: createFakeDialog({ type: 'confirmation' }),
    deleteConfirmation: {
      ...createFakeDialog({ type: 'confirmation' }),
      buttons: [
        createFakeDialogButton({ action: 'cancel' }),
        createFakeDialogButton({ action: 'destructive' }),
      ],
      content: createFakeDialogContent({ destructive: true }),
    },
    formDialog: createFakeFormDialog(4),
    profileEdit: createFakeProfileEditDialog(),
    wizardDialog: createFakeWizardDialog(4),
    onboardingWizard: createFakeOnboardingWizard(),
    settingsDialog: createFakeSettingsDialog(4),
    alertSuccess: createFakeAlertDialog('success'),
    alertError: createFakeAlertDialog('error'),
    alertWarning: createFakeAlertDialog('warning'),
    alertInfo: createFakeAlertDialog('info'),
    shareDialog: createFakeShareDialog(),
  };
}
