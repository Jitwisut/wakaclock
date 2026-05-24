import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/** Toast visual variant/type */
export type ToastVariant = 'default' | 'destructive' | 'info' | 'success' | 'warning';

/** Toast position on screen */
export type ToastPosition =
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'top-left'
  | 'top-right';

/** Toast action button style */
export type ToastActionStyle = 'default' | 'destructive' | 'outline';

// ═══════════════════════════════════════════════════════════════
// INTERFACE (Shape of Generated Data)
// ═══════════════════════════════════════════════════════════════

/** Toast action button */
export interface ToastAction {
  altText: string;
  label: string;
  onClick?: string;
  style?: ToastActionStyle;
}

/** Fake toast notification */
export interface FakeToast {
  action?: ToastAction;
  closable: boolean;
  createdAt: Date;
  description?: string;
  duration: number;
  icon?: string;
  id: string;
  open: boolean;
  title: string;
  variant: ToastVariant;
}

/** Toast configuration for Toaster component */
export interface FakeToasterConfig {
  closeButton: boolean;
  duration: number;
  expand: boolean;
  gap: number;
  hotkey: string[];
  offset: number | string;
  pauseWhenPageIsHidden: boolean;
  position: ToastPosition;
  richColors: boolean;
  theme: 'dark' | 'light' | 'system';
  visibleToasts: number;
}

/** Toast queue/stack */
export interface FakeToastQueue {
  id: string;
  maxToasts: number;
  position: ToastPosition;
  toasts: FakeToast[];
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS (Used in Stories for Iteration)
// ═══════════════════════════════════════════════════════════════

export const TOAST_VARIANTS: ToastVariant[] = [
  'default',
  'success',
  'warning',
  'destructive',
  'info',
];

export const TOAST_POSITIONS: ToastPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export const TOAST_DURATIONS = [3000, 4000, 5000, 7000, 10_000, Infinity];

export const TOAST_ICONS: Record<ToastVariant, string> = {
  default: i18n.t('factory.toast.bell', 'Bell'),
  success: 'CheckCircle',
  warning: 'AlertTriangle',
  destructive: 'XCircle',
  info: i18n.t('factory.toast.info', 'Info'),
};

export const TOAST_TITLES: Record<ToastVariant, string[]> = {
  default: [
    i18n.t('factory.toast.notification', 'Notification'),
    i18n.t('factory.toast.updateAvailable', 'Update Available'),
    i18n.t('factory.toast.newMessage', 'New Message'),
    i18n.t('factory.toast.reminder', 'Reminder'),
  ],
  success: [
    i18n.t('factory.toast.success', 'Success!'),
    i18n.t('factory.toast.savedSuccessfully', 'Saved Successfully'),
    i18n.t('factory.toast.uploadComplete', 'Upload Complete'),
    i18n.t('factory.toast.actionCompleted', 'Action Completed'),
  ],
  warning: [
    i18n.t('factory.toast.warning', 'Warning'),
    i18n.t('factory.toast.attentionRequired', 'Attention Required'),
    i18n.t('factory.toast.pleaseNote', 'Please Note'),
    i18n.t('factory.toast.headsUp', 'Heads Up'),
  ],
  destructive: [
    i18n.t('factory.toast.error', 'Error'),
    i18n.t('factory.toast.failed', 'Failed'),
    i18n.t('factory.toast.somethingWentWrong', 'Something went wrong'),
    i18n.t('factory.toast.operationFailed', 'Operation Failed'),
  ],
  info: [
    i18n.t('factory.toast.information', 'Information'),
    i18n.t('factory.toast.didYouKnow', 'Did you know?'),
    i18n.t('factory.toast.tip', 'Tip'),
    i18n.t('factory.toast.fyi', 'FYI'),
  ],
};

export const TOAST_DESCRIPTIONS: Record<ToastVariant, string[]> = {
  default: [
    i18n.t('factory.toast.youHaveANewNotification', 'You have a new notification.'),
    i18n.t('factory.toast.aNewVersionIsAvailable', 'A new version is available.'),
    i18n.t('factory.toast.someoneMentionedYou', 'Someone mentioned you.'),
    i18n.t('factory.toast.dontForgetYourMeetingAt', "Don't forget your meeting at 3pm."),
  ],
  success: [
    i18n.t('factory.toast.yourChangesHaveBeenSaved', 'Your changes have been saved.'),
    i18n.t('factory.toast.fileUploadedSuccessfully', 'File uploaded successfully.'),
    i18n.t('factory.toast.profileUpdated', 'Profile updated.'),
    i18n.t('factory.toast.settingsApplied', 'Settings applied.'),
  ],
  warning: [
    i18n.t('factory.toast.yourSessionWillExpireIn', 'Your session will expire in 5 minutes.'),
    i18n.t('factory.toast.storageIsAlmostFull', 'Storage is almost full.'),
    i18n.t('factory.toast.pleaseVerifyYourEmail', 'Please verify your email.'),
    i18n.t('factory.toast.someFeaturesMayBeLimited', 'Some features may be limited.'),
  ],
  destructive: [
    i18n.t('factory.toast.couldNotCompleteTheOperation', 'Could not complete the operation.'),
    i18n.t('factory.toast.networkConnectionLost', 'Network connection lost.'),
    i18n.t('factory.toast.invalidCredentials', 'Invalid credentials.'),
    i18n.t('factory.toast.pleaseTryAgainLater', 'Please try again later.'),
  ],
  info: [
    i18n.t('factory.toast.pressCmdkForQuickActions', 'Press Cmd+K for quick actions.'),
    i18n.t('factory.toast.youCanCustomizeThisIn', 'You can customize this in settings.'),
    i18n.t('factory.toast.newFeaturesAreAvailable', 'New features are available.'),
    i18n.t('factory.toast.checkOutOurDocumentation', 'Check out our documentation.'),
  ],
};

export const TOAST_ACTION_LABELS = [
  i18n.t('factory.toast.undo', 'Undo'),
  i18n.t('factory.toast.retry', 'Retry'),
  i18n.t('factory.toast.view', 'View'),
  i18n.t('factory.toast.dismiss', 'Dismiss'),
  i18n.t('factory.toast.learnMore', 'Learn More'),
  i18n.t('factory.toast.tryAgain', 'Try Again'),
  i18n.t('factory.toast.details', 'Details'),
  i18n.t('factory.toast.fixNow', 'Fix Now'),
  i18n.t('factory.toast.update', 'Update'),
  i18n.t('factory.toast.refresh', 'Refresh'),
];

// ═══════════════════════════════════════════════════════════════
// SINGLE ITEM FACTORY
// ═══════════════════════════════════════════════════════════════

/** Create a fake toast notification */
export function createFakeToast(overrides?: Partial<FakeToast>): FakeToast {
  const variant = overrides?.variant ?? faker.helpers.arrayElement(TOAST_VARIANTS);

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement(TOAST_TITLES[variant]),
    description: faker.helpers.maybe(
      () => faker.helpers.arrayElement(TOAST_DESCRIPTIONS[variant]),
      { probability: 0.7 }
    ),
    variant,
    duration: faker.helpers.arrayElement([3000, 4000, 5000, 7000]),
    open: true,
    closable: faker.datatype.boolean({ probability: 0.8 }),
    icon: faker.helpers.maybe(() => TOAST_ICONS[variant], { probability: 0.5 }),
    action: faker.helpers.maybe(
      () => ({
        label: faker.helpers.arrayElement(TOAST_ACTION_LABELS),
        altText: i18n.t('factory.toast.performAction', 'Perform action'),
        onClick: faker.word.verb(),
        style: faker.helpers.arrayElement<ToastActionStyle>(['default', 'outline']),
      }),
      { probability: 0.4 }
    ),
    createdAt: faker.date.recent(),
    ...overrides,
  };
}

/** Create a fake toaster configuration */
export function createFakeToasterConfig(overrides?: Partial<FakeToasterConfig>): FakeToasterConfig {
  return {
    position: faker.helpers.arrayElement(TOAST_POSITIONS),
    theme: faker.helpers.arrayElement(['light', 'dark', 'system']),
    richColors: faker.datatype.boolean({ probability: 0.6 }),
    expand: faker.datatype.boolean({ probability: 0.3 }),
    duration: faker.helpers.arrayElement([3000, 4000, 5000]),
    gap: faker.helpers.arrayElement([8, 12, 16]),
    visibleToasts: faker.helpers.arrayElement([3, 4, 5]),
    closeButton: faker.datatype.boolean({ probability: 0.7 }),
    offset: faker.helpers.arrayElement([16, 24, 32, '1rem', '1.5rem']),
    hotkey: ['altKey', 'KeyT'],
    pauseWhenPageIsHidden: true,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// BULK FACTORY (For Lists/Tables)
// ═══════════════════════════════════════════════════════════════

/** Create multiple fake toasts */
export function createFakeToasts(count: number, overrides?: Partial<FakeToast>): FakeToast[] {
  return Array.from({ length: count }, () => createFakeToast(overrides));
}

/** Create a toast queue */
export function createFakeToastQueue(overrides?: Partial<FakeToastQueue>): FakeToastQueue {
  return {
    id: faker.string.uuid(),
    position: faker.helpers.arrayElement(TOAST_POSITIONS),
    maxToasts: faker.helpers.arrayElement([3, 4, 5]),
    toasts: createFakeToasts(faker.number.int({ min: 1, max: 5 })),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED FACTORIES (For Specific Scenarios)
// ═══════════════════════════════════════════════════════════════

/** Create a success toast */
export function createFakeSuccessToast(message?: string): FakeToast {
  return createFakeToast({
    variant: 'success',
    title: i18n.t('factory.toast.success', 'Success!'),
    description: message ?? faker.helpers.arrayElement(TOAST_DESCRIPTIONS.success),
    icon: 'CheckCircle',
  });
}

/** Create an error/destructive toast */
export function createFakeErrorToast(message?: string): FakeToast {
  return createFakeToast({
    variant: 'destructive',
    title: i18n.t('factory.toast.error', 'Error'),
    description: message ?? faker.helpers.arrayElement(TOAST_DESCRIPTIONS.destructive),
    icon: 'XCircle',
    action: {
      label: i18n.t('factory.toast.tryAgain', 'Try Again'),
      altText: i18n.t('factory.toast.retryTheFailedOperation', 'Retry the failed operation'),
      style: 'destructive',
    },
  });
}

/** Create a warning toast */
export function createFakeWarningToast(message?: string): FakeToast {
  return createFakeToast({
    variant: 'warning',
    title: i18n.t('factory.toast.warning', 'Warning'),
    description: message ?? faker.helpers.arrayElement(TOAST_DESCRIPTIONS.warning),
    icon: 'AlertTriangle',
  });
}

/** Create an info toast */
export function createFakeInfoToast(message?: string): FakeToast {
  return createFakeToast({
    variant: 'info',
    title: i18n.t('factory.toast.information', 'Information'),
    description: message ?? faker.helpers.arrayElement(TOAST_DESCRIPTIONS.info),
    icon: i18n.t('factory.toast.info', 'Info'),
  });
}

/** Create a toast with undo action */
export function createFakeUndoToast(actionDescription: string): FakeToast {
  return createFakeToast({
    variant: 'default',
    title: actionDescription,
    description: i18n.t('factory.toast.clickUndoToRevertThis', 'Click undo to revert this action.'),
    action: {
      label: i18n.t('factory.toast.undo', 'Undo'),
      altText: i18n.t('factory.toast.undoAltText', 'Undo {{action}}', {
        action: actionDescription,
      }),
      style: 'outline',
    },
    duration: 7000,
  });
}

/** Create a persistent toast (no auto-dismiss) */
export function createFakePersistentToast(): FakeToast {
  return createFakeToast({
    duration: Infinity,
    closable: true,
    action: {
      label: i18n.t('factory.toast.dismiss', 'Dismiss'),
      altText: i18n.t('factory.toast.dismissThisNotification', 'Dismiss this notification'),
      style: 'default',
    },
  });
}

/** Create a loading toast (for async operations) */
export function createFakeLoadingToast(): FakeToast {
  return createFakeToast({
    variant: 'default',
    title: i18n.t('factory.toast.loading', 'Loading...'),
    description: i18n.t(
      'factory.toast.pleaseWaitWhileWeProcess',
      'Please wait while we process your request.'
    ),
    icon: i18n.t('factory.toast.loader', 'Loader'),
    closable: false,
    duration: Infinity,
  });
}

/** Create a promise-based toast set (loading → success/error) */
export interface FakePromiseToastSet {
  error: FakeToast;
  loading: FakeToast;
  success: FakeToast;
}

export function createFakePromiseToastSet(operation: string): FakePromiseToastSet {
  return {
    loading: createFakeToast({
      variant: 'default',
      title: i18n.t('factory.toast.operationInProgress', '{{operation}}...', { operation }),
      description: i18n.t('factory.toast.pleaseWait', 'Please wait.'),
      icon: i18n.t('factory.toast.loader', 'Loader'),
      closable: false,
      duration: Infinity,
    }),
    success: createFakeToast({
      variant: 'success',
      title: i18n.t('factory.toast.operationComplete', '{{operation}} Complete', { operation }),
      description: i18n.t(
        'factory.toast.operationCompletedSuccessfully',
        'Operation completed successfully.'
      ),
      icon: 'CheckCircle',
    }),
    error: createFakeToast({
      variant: 'destructive',
      title: i18n.t('factory.toast.operationFailed2', '{{operation}} Failed', { operation }),
      description: i18n.t(
        'factory.toast.somethingWentWrongPleaseTry',
        'Something went wrong. Please try again.'
      ),
      icon: 'XCircle',
      action: {
        label: i18n.t('factory.toast.retry', 'Retry'),
        altText: i18n.t('factory.toast.retryAltText', 'Retry {{operation}}', { operation }),
        style: 'destructive',
      },
    }),
  };
}

// ═══════════════════════════════════════════════════════════════
// MATRIX FACTORIES (For Visual Regression)
// ═══════════════════════════════════════════════════════════════

/** Create all variants for visual testing */
export function createFakeToastVariantMatrix(): FakeToast[] {
  return TOAST_VARIANTS.map((variant) =>
    createFakeToast({
      variant,
      title: faker.helpers.arrayElement(TOAST_TITLES[variant]),
      description: faker.helpers.arrayElement(TOAST_DESCRIPTIONS[variant]),
      icon: TOAST_ICONS[variant],
    })
  );
}

/** Create position matrix for visual testing */
export function createFakeToastPositionMatrix(): FakeToasterConfig[] {
  return TOAST_POSITIONS.map((position) => createFakeToasterConfig({ position }));
}

/** Create variant × action matrix for visual testing */
export function createFakeToastWithActionsMatrix(): FakeToast[] {
  return TOAST_VARIANTS.map((variant) =>
    createFakeToast({
      variant,
      action: {
        label: faker.helpers.arrayElement(TOAST_ACTION_LABELS),
        altText: i18n.t('factory.toast.actionButton', 'Action button'),
        style: variant === 'destructive' ? 'destructive' : 'default',
      },
    })
  );
}

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE FEATURE FACTORIES
// ═══════════════════════════════════════════════════════════════

/** Create an accessible toast with proper ARIA */
export function createFakeAccessibleToast(): FakeToast {
  return createFakeToast({
    title: i18n.t('factory.toast.accessibleNotification', 'Accessible Notification'),
    description: i18n.t(
      'factory.toast.thisToastHasProperAria',
      'This toast has proper ARIA attributes for screen readers.'
    ),
    closable: true,
    action: {
      label: i18n.t('factory.toast.acknowledge', 'Acknowledge'),
      altText: i18n.t(
        'factory.toast.acknowledgeThisNotificationAndClose',
        'Acknowledge this notification and close it'
      ),
      style: 'default',
    },
  });
}

/** Create toast for form validation errors */
export function createFakeFormValidationToast(errors: string[]): FakeToast {
  return createFakeToast({
    variant: 'destructive',
    title: i18n.t('factory.toast.validationError', 'Validation Error'),
    description:
      errors.length > 1
        ? i18n.t('factory.toast.fieldsHaveErrors', '{{count}} fields have errors', {
            count: errors.length,
          })
        : errors[0],
    icon: 'AlertCircle',
    duration: 7000,
  });
}

/** Create toast for network status */
export function createFakeNetworkStatusToast(online: boolean): FakeToast {
  return online
    ? createFakeToast({
        variant: 'success',
        title: i18n.t('factory.toast.backOnline', 'Back Online'),
        description: i18n.t(
          'factory.toast.yourConnectionHasBeenRestored',
          'Your connection has been restored.'
        ),
        icon: i18n.t('factory.toast.wifi', 'Wifi'),
        duration: 3000,
      })
    : createFakeToast({
        variant: 'destructive',
        title: i18n.t('factory.toast.connectionLost', 'Connection Lost'),
        description: i18n.t(
          'factory.toast.pleaseCheckYourInternetConnection',
          'Please check your internet connection.'
        ),
        icon: 'WifiOff',
        duration: Infinity,
        closable: false,
      });
}

/** Helper function to get file operation verb (avoids nested ternary) */
function getFileOperationVerb(op: string): string {
  if (op === 'delete') return i18n.t('factory.toast.deleted', 'deleted');
  if (op === 'upload') return i18n.t('factory.toast.uploaded', 'uploaded');
  return i18n.t('factory.toast.downloaded', 'downloaded');
}

/** Create toast for file operations */
export function createFakeFileOperationToast(
  operation: 'delete' | 'download' | 'upload',
  success: boolean,
  fileName?: string
): FakeToast {
  const file = fileName ?? faker.system.fileName();

  if (success) {
    return createFakeToast({
      variant: 'success',
      title: i18n.t('factory.toast.fileOperationComplete', '{{operation}} Complete', {
        operation: operation.charAt(0).toUpperCase() + operation.slice(1),
      }),
      description: i18n.t(
        'factory.toast.fileOperationSuccess',
        '"{{file}}" {{verb}} successfully.',
        { file, verb: getFileOperationVerb(operation) }
      ),
      icon: 'CheckCircle',
    });
  }

  return createFakeToast({
    variant: 'destructive',
    title: i18n.t('factory.toast.fileOperationFailed', '{{operation}} Failed', {
      operation: operation.charAt(0).toUpperCase() + operation.slice(1),
    }),
    description: i18n.t(
      'factory.toast.operationFailedDescription',
      'Could not {{operation}} "{{file}}". Please try again.',
      { operation, file }
    ),
    icon: 'XCircle',
    action: {
      label: i18n.t('factory.toast.retry', 'Retry'),
      altText: i18n.t('factory.toast.retryAltText', 'Retry {{operation}}', { operation }),
      style: 'destructive',
    },
  });
}

/** Create a stacked notification scenario */
export function createFakeStackedToasts(): FakeToast[] {
  return [
    createFakeSuccessToast(i18n.t('factory.toast.fileUploaded', 'File uploaded')),
    createFakeInfoToast(i18n.t('factory.toast.threeNewMessages', '3 new messages')),
    createFakeWarningToast(i18n.t('factory.toast.storage90Full', 'Storage 90% full')),
    createFakeErrorToast(i18n.t('factory.toast.syncFailed', 'Sync failed')),
  ];
}
