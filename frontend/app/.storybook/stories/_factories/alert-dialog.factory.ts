import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ SHARED STRING CONSTANTS ============

const LABEL_CONFIRM = i18n.t('factory.alertDialog.confirm', 'Confirm');
const LABEL_CANCEL = i18n.t('factory.alertDialog.cancel', 'Cancel');

// ============ TYPE DEFINITIONS ============

/** Alert dialog action type */
export type AlertDialogActionType = 'cancel' | 'confirm' | 'delete' | 'save';

/** Alert dialog variant based on action severity */
export type AlertDialogVariant = 'default' | 'destructive' | 'info' | 'warning';

/** Alert dialog size variant for layout */
export type AlertDialogSize = 'compact' | 'default' | 'wide';

/** Alert dialog content type for categorization */
export type AlertDialogContentType =
  | 'confirmation'
  | 'custom'
  | 'deleteConfirmation'
  | 'formInput'
  | 'info'
  | 'terms'
  | 'warning';

/** Interface for fake alert dialog data */
export interface FakeAlertDialog {
  /** Action button label */
  actionLabel: string;
  /** Action type */
  actionType: AlertDialogActionType;
  /** Cancel button label */
  cancelLabel: string;
  /** Content type */
  contentType: AlertDialogContentType;
  /** Dialog description */
  description: string;
  /** Whether the action is destructive */
  destructive: boolean;
  /** Unique identifier */
  id: string;
  /** Whether to show input field */
  showInput?: boolean;
  /** Dialog size */
  size: AlertDialogSize;
  /** Dialog title */
  title: string;
  /** Visual variant */
  variant: AlertDialogVariant;
}

/** Interface for alert dialog configuration */
export interface FakeAlertDialogConfig {
  /** Whether the dialog is open */
  defaultOpen: boolean;
  /** Whether action is destructive */
  destructive: boolean;
  /** Whether to force close on outside click (not standard for alert dialog) */
  forceClose: boolean;
  /** Whether to show input */
  showInput: boolean;
  /** Size variant */
  size: AlertDialogSize;
  /** Variant */
  variant: AlertDialogVariant;
}

// ============ CONSTANTS FOR ITERATION ============

/** All alert dialog action types */
export const ALERT_DIALOG_ACTION_TYPES: AlertDialogActionType[] = [
  'cancel',
  'confirm',
  'delete',
  'save',
];

/** All alert dialog variants */
export const ALERT_DIALOG_VARIANTS: AlertDialogVariant[] = [
  'default',
  'destructive',
  'info',
  'warning',
];

/** All alert dialog sizes */
export const ALERT_DIALOG_SIZES: AlertDialogSize[] = ['compact', 'default', 'wide'];

/** All alert dialog content types */
export const ALERT_DIALOG_CONTENT_TYPES: AlertDialogContentType[] = [
  'confirmation',
  'custom',
  'deleteConfirmation',
  'formInput',
  'info',
  'terms',
  'warning',
];

/** Common alert dialog titles */
export const ALERT_DIALOG_TITLES = [
  i18n.t('factory.alertDialog.areYouSure', 'Are you sure?'),
  i18n.t('factory.alertDialog.confirmAction', 'Confirm Action'),
  i18n.t('factory.alertDialog.deleteItem', 'Delete Item'),
  i18n.t('factory.alertDialog.discardChanges', 'Discard Changes?'),
  i18n.t('factory.alertDialog.saveChanges', 'Save Changes?'),
  i18n.t('factory.alertDialog.sessionExpired', 'Session Expired'),
  i18n.t('factory.alertDialog.termsOfService', 'Terms of Service'),
  i18n.t('factory.alertDialog.unsavedChanges', 'Unsaved Changes'),
  i18n.t('factory.alertDialog.warning', 'Warning'),
  i18n.t('factory.alertDialog.yourSessionIsAboutTo', 'Your session is about to expire'),
];

/** Common alert dialog descriptions */
export const ALERT_DIALOG_DESCRIPTIONS = [
  i18n.t(
    'factory.alertDialog.areYouSureYouWant',
    'Are you sure you want to continue? This action cannot be undone.'
  ),
  i18n.t('factory.alertDialog.doYouWantToSave', 'Do you want to save your changes before leaving?'),
  i18n.t(
    'factory.alertDialog.pleaseConfirmThatYouWant',
    'Please confirm that you want to proceed with this action.'
  ),
  i18n.t(
    'factory.alertDialog.pleaseReadAndAcceptOur',
    'Please read and accept our terms and conditions.'
  ),
  i18n.t(
    'factory.alertDialog.thisActionWillPermanentlyDelete',
    'This action will permanently delete this item.'
  ),
  i18n.t(
    'factory.alertDialog.thisActionWillPermanentlyRemove',
    'This action will permanently remove your data.'
  ),
  i18n.t(
    'factory.alertDialog.thisWillDeleteAllAssociated',
    'This will delete all associated data. This action cannot be undone.'
  ),
  i18n.t(
    'factory.alertDialog.youHaveUnsavedChangesDo',
    'You have unsaved changes. Do you want to discard them?'
  ),
  i18n.t(
    'factory.alertDialog.yourSessionHasExpiredPlease',
    'Your session has expired. Please log in again.'
  ),
  i18n.t(
    'factory.alertDialog.yourSessionWillExpireIn',
    'Your session will expire in 5 minutes due to inactivity.'
  ),
];

/** Common action button labels */
export const ALERT_DIALOG_ACTION_LABELS = [
  i18n.t('factory.alertDialog.accept', 'Accept'),
  LABEL_CONFIRM,
  i18n.t('factory.alertDialog.continue', 'Continue'),
  i18n.t('factory.alertDialog.delete', 'Delete'),
  i18n.t('factory.alertDialog.discard', 'Discard'),
  i18n.t('factory.alertDialog.ok', 'OK'),
  i18n.t('factory.alertDialog.proceed', 'Proceed'),
  i18n.t('factory.alertDialog.remove', 'Remove'),
  i18n.t('factory.alertDialog.save', 'Save'),
  i18n.t('factory.alertDialog.yesDelete', 'Yes, delete'),
];

/** Common cancel button labels */
export const ALERT_DIALOG_CANCEL_LABELS = [
  LABEL_CANCEL,
  i18n.t('factory.alertDialog.close', 'Close'),
  i18n.t('factory.alertDialog.decline', 'Decline'),
  i18n.t('factory.alertDialog.goBack', 'Go back'),
  i18n.t('factory.alertDialog.keepEditing', 'Keep editing'),
  i18n.t('factory.alertDialog.no', 'No'),
  i18n.t('factory.alertDialog.stay', 'Stay'),
];

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake alert dialog
 * @param overrides - Optional partial overrides for the generated dialog
 * @returns A fake alert dialog
 */
export function createFakeAlertDialog(overrides?: Partial<FakeAlertDialog>): FakeAlertDialog {
  const destructive = faker.datatype.boolean({ probability: 0.3 });
  const variant = destructive
    ? 'destructive'
    : faker.helpers.arrayElement<AlertDialogVariant>(['default', 'info', 'warning']);

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement(ALERT_DIALOG_TITLES),
    description: faker.helpers.arrayElement(ALERT_DIALOG_DESCRIPTIONS),
    actionLabel: faker.helpers.arrayElement(ALERT_DIALOG_ACTION_LABELS),
    cancelLabel: faker.helpers.arrayElement(ALERT_DIALOG_CANCEL_LABELS),
    actionType: faker.helpers.arrayElement(ALERT_DIALOG_ACTION_TYPES),
    contentType: faker.helpers.arrayElement(ALERT_DIALOG_CONTENT_TYPES),
    variant,
    size: faker.helpers.arrayElement(ALERT_DIALOG_SIZES),
    destructive,
    showInput: faker.helpers.maybe(() => true, { probability: 0.2 }),
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake alert dialogs
 * @param count - Number of dialogs to generate
 * @returns Array of fake alert dialogs
 */
export function createFakeAlertDialogs(count: number): FakeAlertDialog[] {
  return Array.from({ length: count }, () => createFakeAlertDialog());
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a delete confirmation dialog
 * @param itemName - Name of the item being deleted
 * @returns A delete confirmation dialog
 */
export function createFakeDeleteConfirmationDialog(itemName?: string): FakeAlertDialog {
  const name = itemName ?? faker.helpers.arrayElement(['item', 'file', 'project', 'account']);

  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.deleteTitle', 'Delete {{name}}?', { name }),
    description: i18n.t(
      'factory.alertDialog.deleteDescription',
      'This action will permanently delete this {{name}}. This cannot be undone.',
      { name }
    ),
    actionLabel: i18n.t('factory.alertDialog.delete', 'Delete'),
    cancelLabel: LABEL_CANCEL,
    actionType: 'delete',
    contentType: 'deleteConfirmation',
    variant: 'destructive',
    destructive: true,
  });
}

/**
 * Creates a save changes dialog
 * @returns A save changes dialog
 */
export function createFakeSaveChangesDialog(): FakeAlertDialog {
  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.saveChanges', 'Save Changes?'),
    description: i18n.t(
      'factory.alertDialog.youHaveUnsavedChangesDo2',
      'You have unsaved changes. Do you want to save them before leaving?'
    ),
    actionLabel: i18n.t('factory.alertDialog.save', 'Save'),
    cancelLabel: i18n.t('factory.alertDialog.discard', 'Discard'),
    actionType: 'save',
    contentType: 'confirmation',
    variant: 'default',
    destructive: false,
  });
}

/**
 * Creates a session expired dialog
 * @returns A session expired dialog
 */
export function createFakeSessionExpiredDialog(): FakeAlertDialog {
  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.sessionExpired', 'Session Expired'),
    description: i18n.t(
      'factory.alertDialog.yourSessionHasExpiredDue',
      'Your session has expired due to inactivity. Please log in again to continue.'
    ),
    actionLabel: i18n.t('factory.alertDialog.logIn', 'Log In'),
    cancelLabel: LABEL_CANCEL,
    actionType: 'confirm',
    contentType: 'warning',
    variant: 'warning',
    destructive: false,
  });
}

/**
 * Creates a terms of service dialog
 * @returns A terms of service dialog
 */
export function createFakeTermsDialog(): FakeAlertDialog {
  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.termsOfService', 'Terms of Service'),
    description: i18n.t(
      'factory.alertDialog.pleaseReadAndAcceptOur2',
      'Please read and accept our terms and conditions to continue.'
    ),
    actionLabel: i18n.t('factory.alertDialog.accept', 'Accept'),
    cancelLabel: i18n.t('factory.alertDialog.decline', 'Decline'),
    actionType: 'confirm',
    contentType: 'terms',
    variant: 'info',
    destructive: false,
  });
}

/**
 * Creates a form input dialog (email confirmation)
 * @returns A form input dialog
 */
export function createFakeFormInputDialog(): FakeAlertDialog {
  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.confirmYourEmail', 'Confirm Your Email'),
    description: i18n.t(
      'factory.alertDialog.pleaseEnterYourEmailAddress',
      'Please enter your email address to verify your identity.'
    ),
    actionLabel: LABEL_CONFIRM,
    cancelLabel: LABEL_CANCEL,
    actionType: 'confirm',
    contentType: 'formInput',
    variant: 'default',
    destructive: false,
    showInput: true,
  });
}

/**
 * Creates a warning dialog
 * @param message - Custom warning message
 * @returns A warning dialog
 */
export function createFakeWarningDialog(message?: string): FakeAlertDialog {
  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.warning', 'Warning'),
    description:
      message ??
      i18n.t(
        'factory.alertDialog.thisActionMayHaveUnintended',
        'This action may have unintended consequences. Please proceed carefully.'
      ),
    actionLabel: i18n.t('factory.alertDialog.proceed', 'Proceed'),
    cancelLabel: LABEL_CANCEL,
    actionType: 'confirm',
    contentType: 'warning',
    variant: 'warning',
    destructive: false,
  });
}

/**
 * Creates a compact quick confirm dialog
 * @returns A compact confirmation dialog
 */
export function createFakeQuickConfirmDialog(): FakeAlertDialog {
  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.quickConfirm', 'Quick Confirm'),
    description: i18n.t(
      'factory.alertDialog.areYouSureYouWant2',
      'Are you sure you want to proceed?'
    ),
    actionLabel: i18n.t('factory.alertDialog.yes', 'Yes'),
    cancelLabel: i18n.t('factory.alertDialog.no', 'No'),
    actionType: 'confirm',
    contentType: 'confirmation',
    variant: 'default',
    size: 'compact',
    destructive: false,
  });
}

/**
 * Creates dialogs for all content types
 * @returns Array with one dialog of each content type
 */
export function createFakeAlertDialogsByType(): FakeAlertDialog[] {
  return [
    createFakeAlertDialog({
      contentType: 'confirmation',
      title: i18n.t('factory.alertDialog.confirmationDialog', 'Confirmation Dialog'),
    }),
    createFakeDeleteConfirmationDialog(),
    createFakeSaveChangesDialog(),
    createFakeTermsDialog(),
    createFakeFormInputDialog(),
    createFakeWarningDialog(),
    createFakeQuickConfirmDialog(),
  ];
}

// ============ MATRIX FACTORY ============

/**
 * Creates a matrix of alert dialogs for visual regression testing
 * across all variant and size combinations
 * @returns 2D array of alert dialogs [variant][size]
 */
export function createFakeAlertDialogMatrix(): FakeAlertDialog[][] {
  return ALERT_DIALOG_VARIANTS.map((variant) =>
    ALERT_DIALOG_SIZES.map((size) => ({
      id: `${variant}-${size}`,
      title: i18n.t('factory.alertDialog.variantSizeTitle', '{{variant}} ({{size}})', {
        variant: variant.charAt(0).toUpperCase() + variant.slice(1),
        size,
      }),
      description: i18n.t(
        'factory.alertDialog.variantSizeDescription',
        'A {{variant}} alert dialog displayed at {{size}} size.',
        { variant, size }
      ),
      actionLabel:
        variant === 'destructive' ? i18n.t('factory.alertDialog.delete', 'Delete') : LABEL_CONFIRM,
      cancelLabel: LABEL_CANCEL,
      actionType: variant === 'destructive' ? 'delete' : ('confirm' as AlertDialogActionType),
      contentType: 'confirmation' as AlertDialogContentType,
      variant,
      size,
      destructive: variant === 'destructive',
    }))
  );
}

/**
 * Creates alert dialog configuration for different scenarios
 * @param scenario - Scenario name
 * @returns Alert dialog configuration
 */
export function createFakeAlertDialogConfig(
  scenario: 'default' | 'destructive' | 'formInput' | 'wide' = 'default'
): FakeAlertDialogConfig {
  const configs: Record<string, FakeAlertDialogConfig> = {
    default: {
      variant: 'default',
      size: 'default',
      destructive: false,
      showInput: false,
      forceClose: false,
      defaultOpen: false,
    },
    destructive: {
      variant: 'destructive',
      size: 'default',
      destructive: true,
      showInput: false,
      forceClose: false,
      defaultOpen: false,
    },
    formInput: {
      variant: 'default',
      size: 'default',
      destructive: false,
      showInput: true,
      forceClose: false,
      defaultOpen: false,
    },
    wide: {
      variant: 'default',
      size: 'wide',
      destructive: false,
      showInput: false,
      forceClose: false,
      defaultOpen: false,
    },
  };

  return configs[scenario];
}

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE FACTORIES (Following Button Pattern)
// ═══════════════════════════════════════════════════════════════

/**
 * Creates an info dialog for non-destructive information
 * @param message - Custom info message
 * @returns An info dialog
 */
export function createFakeInfoDialog(message?: string): FakeAlertDialog {
  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.information', 'Information'),
    description:
      message ??
      i18n.t(
        'factory.alertDialog.hereIsSomeImportantInformation',
        'Here is some important information you should know.'
      ),
    actionLabel: i18n.t('factory.alertDialog.ok', 'OK'),
    cancelLabel: i18n.t('factory.alertDialog.close', 'Close'),
    actionType: 'confirm',
    contentType: 'info',
    variant: 'info',
    destructive: false,
  });
}

/**
 * Creates an account deletion dialog with double-confirmation
 * @returns An account deletion dialog
 */
export function createFakeAccountDeletionDialog(): FakeAlertDialog {
  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.deleteAccount', 'Delete Account'),
    description: i18n.t(
      'factory.alertDialog.thisActionIsPermanentAnd',
      'This action is permanent and cannot be undone. All your data will be permanently removed from our servers.'
    ),
    actionLabel: i18n.t('factory.alertDialog.deleteMyAccount', 'Delete My Account'),
    cancelLabel: i18n.t('factory.alertDialog.keepAccount', 'Keep Account'),
    actionType: 'delete',
    contentType: 'deleteConfirmation',
    variant: 'destructive',
    destructive: true,
    showInput: true,
  });
}

/**
 * Creates an unsaved changes dialog
 * @returns An unsaved changes dialog
 */
export function createFakeUnsavedChangesDialog(): FakeAlertDialog {
  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.unsavedChanges', 'Unsaved Changes'),
    description: i18n.t(
      'factory.alertDialog.youHaveUnsavedChangesThat',
      'You have unsaved changes that will be lost if you leave this page. Do you want to save your changes?'
    ),
    actionLabel: i18n.t('factory.alertDialog.saveChanges2', 'Save Changes'),
    cancelLabel: i18n.t('factory.alertDialog.discard', 'Discard'),
    actionType: 'save',
    contentType: 'confirmation',
    variant: 'warning',
    destructive: false,
  });
}

/**
 * Creates a payment confirmation dialog
 * @param amount - Payment amount
 * @param currency - Currency code (default: USD)
 * @returns A payment confirmation dialog
 */
export function createFakePaymentConfirmationDialog(
  amount?: number,
  currency = 'USD'
): FakeAlertDialog {
  const paymentAmount = amount ?? faker.number.float({ min: 10, max: 500, fractionDigits: 2 });
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(paymentAmount);

  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.confirmPayment', 'Confirm Payment'),
    description: i18n.t(
      'factory.alertDialog.paymentDescription',
      'You are about to be charged {{amount}}. This payment will be processed immediately.',
      { amount: formattedAmount }
    ),
    actionLabel: i18n.t('factory.alertDialog.payLabel', 'Pay {{amount}}', {
      amount: formattedAmount,
    }),
    cancelLabel: LABEL_CANCEL,
    actionType: 'confirm',
    contentType: 'confirmation',
    variant: 'default',
    destructive: false,
  });
}

/**
 * Creates a subscription cancellation dialog
 * @returns A subscription cancellation dialog
 */
export function createFakeSubscriptionCancellationDialog(): FakeAlertDialog {
  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.cancelSubscription', 'Cancel Subscription'),
    description: i18n.t(
      'factory.alertDialog.yourSubscriptionWillRemainActive',
      'Your subscription will remain active until the end of the current billing period. You can resubscribe at any time.'
    ),
    actionLabel: i18n.t('factory.alertDialog.cancelSubscription', 'Cancel Subscription'),
    cancelLabel: i18n.t('factory.alertDialog.keepSubscription', 'Keep Subscription'),
    actionType: 'delete',
    contentType: 'confirmation',
    variant: 'warning',
    destructive: true,
  });
}

/**
 * Creates a logout confirmation dialog
 * @returns A logout confirmation dialog
 */
export function createFakeLogoutDialog(): FakeAlertDialog {
  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.signOut', 'Sign Out'),
    description: i18n.t(
      'factory.alertDialog.areYouSureYouWant3',
      'Are you sure you want to sign out? You will need to sign in again to continue.'
    ),
    actionLabel: i18n.t('factory.alertDialog.signOut', 'Sign Out'),
    cancelLabel: i18n.t('factory.alertDialog.staySignedIn', 'Stay Signed In'),
    actionType: 'confirm',
    contentType: 'confirmation',
    variant: 'default',
    destructive: false,
  });
}

/**
 * Creates a data export confirmation dialog
 * @returns A data export confirmation dialog
 */
export function createFakeDataExportDialog(): FakeAlertDialog {
  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.exportData', 'Export Data'),
    description: i18n.t(
      'factory.alertDialog.yourDataExportWillBe',
      'Your data export will be prepared and sent to your email address. This may take a few minutes.'
    ),
    actionLabel: i18n.t('factory.alertDialog.exportData', 'Export Data'),
    cancelLabel: LABEL_CANCEL,
    actionType: 'confirm',
    contentType: 'confirmation',
    variant: 'info',
    destructive: false,
  });
}

/**
 * Creates a privacy consent dialog
 * @returns A privacy consent dialog
 */
export function createFakePrivacyConsentDialog(): FakeAlertDialog {
  return createFakeAlertDialog({
    title: i18n.t('factory.alertDialog.privacyConsent', 'Privacy Consent'),
    description: i18n.t(
      'factory.alertDialog.byContinuingYouAgreeTo',
      'By continuing, you agree to our Privacy Policy and consent to the processing of your personal data as described.'
    ),
    actionLabel: i18n.t('factory.alertDialog.iAgree', 'I Agree'),
    cancelLabel: i18n.t('factory.alertDialog.decline', 'Decline'),
    actionType: 'confirm',
    contentType: 'terms',
    variant: 'info',
    destructive: false,
  });
}

/**
 * Creates all enterprise alert dialog scenarios for testing
 * @returns Array of enterprise alert dialogs
 */
export function createFakeEnterpriseAlertDialogSet(): FakeAlertDialog[] {
  return [
    createFakeDeleteConfirmationDialog('item'),
    createFakeSaveChangesDialog(),
    createFakeSessionExpiredDialog(),
    createFakeTermsDialog(),
    createFakeFormInputDialog(),
    createFakeWarningDialog(),
    createFakeQuickConfirmDialog(),
    createFakeInfoDialog(),
    createFakeAccountDeletionDialog(),
    createFakeUnsavedChangesDialog(),
    createFakePaymentConfirmationDialog(99.99),
    createFakeSubscriptionCancellationDialog(),
    createFakeLogoutDialog(),
    createFakeDataExportDialog(),
    createFakePrivacyConsentDialog(),
  ];
}

/**
 * Creates alert dialogs for A/B testing scenarios
 * @param title - Base title for the dialog
 * @returns Object with variant A and variant B dialogs
 */
export interface FakeAlertDialogABTest {
  testId: string;
  variantA: FakeAlertDialog;
  variantB: FakeAlertDialog;
}

export function createFakeAlertDialogABTest(title: string): FakeAlertDialogABTest {
  const testId = faker.string.alphanumeric(8);

  return {
    testId,
    variantA: createFakeAlertDialog({
      id: `ab-${testId}-a`,
      title,
      actionLabel: LABEL_CONFIRM,
      cancelLabel: LABEL_CANCEL,
      variant: 'default',
    }),
    variantB: createFakeAlertDialog({
      id: `ab-${testId}-b`,
      title,
      actionLabel: i18n.t('factory.alertDialog.yesContinue', 'Yes, Continue'),
      cancelLabel: i18n.t('factory.alertDialog.noGoBack', 'No, Go Back'),
      variant: 'default',
    }),
  };
}
