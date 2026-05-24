/**
 * Sonner Toast Factory
 *
 * Generates fake data for Sonner toast notification stories and tests.
 * Supports various toast types, positions, durations, and action configurations.
 *
 * @module sonner.factory
 */
import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Toast notification types
 */
export type ToastType = 'default' | 'error' | 'info' | 'loading' | 'success' | 'warning';

/**
 * Toast position options
 */
export type ToastPosition =
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'top-left'
  | 'top-right';

/**
 * Toast theme options
 */
export type ToastTheme = 'dark' | 'light' | 'system';

/**
 * Toast priority levels
 */
export type ToastPriority = 'critical' | 'high' | 'low' | 'normal';

/**
 * Toast category for domain-specific messages
 */
export type ToastCategory =
  | 'authentication'
  | 'error'
  | 'file'
  | 'form'
  | 'network'
  | 'notification'
  | 'payment'
  | 'permission'
  | 'system'
  | 'user';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All toast types
 */
export const TOAST_TYPES: ToastType[] = [
  'default',
  'error',
  'info',
  'loading',
  'success',
  'warning',
];

/**
 * All toast positions
 */
export const TOAST_POSITIONS: ToastPosition[] = [
  'bottom-center',
  'bottom-left',
  'bottom-right',
  'top-center',
  'top-left',
  'top-right',
];

/**
 * All toast themes
 */
export const TOAST_THEMES: ToastTheme[] = ['dark', 'light', 'system'];

/**
 * All toast priorities
 */
export const TOAST_PRIORITIES: ToastPriority[] = ['critical', 'high', 'low', 'normal'];

/**
 * All toast categories
 */
export const TOAST_CATEGORIES: ToastCategory[] = [
  'authentication',
  'error',
  'file',
  'form',
  'network',
  'notification',
  'payment',
  'permission',
  'system',
  'user',
];

/**
 * Default toast durations in milliseconds
 */
export const TOAST_DURATIONS: Record<ToastType, number> = {
  default: 4000,
  error: 6000,
  info: 4000,
  loading: Infinity,
  success: 3000,
  warning: 5000,
};

/**
 * Toast titles by type
 */
export const TOAST_TITLES: Record<ToastType, string[]> = {
  default: [
    i18n.t('factory.sonner.saved', 'Saved'),
    i18n.t('factory.sonner.updated', 'Updated'),
    i18n.t('factory.sonner.done', 'Done'),
    i18n.t('factory.sonner.complete', 'Complete'),
    i18n.t('factory.sonner.noted', 'Noted'),
  ],
  error: [
    i18n.t('factory.sonner.error', 'Error'),
    i18n.t('factory.sonner.failed', 'Failed'),
    i18n.t('factory.sonner.oops', 'Oops'),
    i18n.t('factory.sonner.problem', 'Problem'),
    i18n.t('factory.sonner.unableToComplete', 'Unable to complete'),
  ],
  info: [
    i18n.t('factory.sonner.info', 'Info'),
    i18n.t('factory.sonner.notice', 'Notice'),
    i18n.t('factory.sonner.headsUp', 'Heads up'),
    'FYI',
    i18n.t('factory.sonner.didYouKnow', 'Did you know?'),
  ],
  loading: [
    i18n.t('factory.sonner.loading', 'Loading'),
    i18n.t('factory.sonner.processing', 'Processing'),
    i18n.t('factory.sonner.pleaseWait', 'Please wait'),
    i18n.t('factory.sonner.working', 'Working'),
    i18n.t('factory.sonner.syncing', 'Syncing'),
  ],
  success: [
    i18n.t('factory.sonner.success', 'Success'),
    i18n.t('factory.sonner.done', 'Done'),
    i18n.t('factory.sonner.completed', 'Completed'),
    i18n.t('factory.sonner.great', 'Great'),
    i18n.t('factory.sonner.perfect', 'Perfect'),
  ],
  warning: [
    i18n.t('factory.sonner.warning', 'Warning'),
    i18n.t('factory.sonner.caution', 'Caution'),
    i18n.t('factory.sonner.attention', 'Attention'),
    i18n.t('factory.sonner.beCareful', 'Be careful'),
    i18n.t('factory.sonner.notice', 'Notice'),
  ],
};

/**
 * Toast descriptions by type
 */
export const TOAST_DESCRIPTIONS: Record<ToastType, string[]> = {
  default: [
    i18n.t('factory.sonner.yourChangesHaveBeenSaved', 'Your changes have been saved.'),
    i18n.t('factory.sonner.settingsUpdatedSuccessfully', 'Settings updated successfully.'),
    i18n.t('factory.sonner.operationCompleted', 'Operation completed.'),
    i18n.t('factory.sonner.yourPreferencesHaveBeenNoted', 'Your preferences have been noted.'),
    i18n.t('factory.sonner.actionRecorded', 'Action recorded.'),
  ],
  error: [
    i18n.t('factory.sonner.somethingWentWrongPleaseTry', 'Something went wrong. Please try again.'),
    i18n.t('factory.sonner.unableToCompleteTheOperation', 'Unable to complete the operation.'),
    i18n.t(
      'factory.sonner.anErrorOccurredWhileProcessing',
      'An error occurred while processing your request.'
    ),
    i18n.t('factory.sonner.theOperationCouldNotBe', 'The operation could not be completed.'),
    i18n.t('factory.sonner.pleaseCheckYourInputAnd', 'Please check your input and try again.'),
  ],
  info: [
    i18n.t(
      'factory.sonner.hereIsSomeInformationYou',
      'Here is some information you might find useful.'
    ),
    i18n.t(
      'factory.sonner.thisFeatureRequiresAdditionalSetup',
      'This feature requires additional setup.'
    ),
    i18n.t('factory.sonner.newUpdatesAreAvailable', 'New updates are available.'),
    i18n.t('factory.sonner.yourSessionWillExpireIn', 'Your session will expire in 5 minutes.'),
    i18n.t('factory.sonner.checkOutOurLatestFeatures', 'Check out our latest features.'),
  ],
  loading: [
    i18n.t('factory.sonner.pleaseWaitWhileWeProcess', 'Please wait while we process your request.'),
    i18n.t('factory.sonner.loadingYourData', 'Loading your data...'),
    i18n.t('factory.sonner.syncingWithServer', 'Syncing with server...'),
    i18n.t('factory.sonner.preparingYourContent', 'Preparing your content...'),
    i18n.t('factory.sonner.almostThere', 'Almost there...'),
  ],
  success: [
    i18n.t(
      'factory.sonner.yourActionWasCompletedSuccessfully',
      'Your action was completed successfully.'
    ),
    i18n.t('factory.sonner.everythingWentSmoothly', 'Everything went smoothly!'),
    i18n.t('factory.sonner.greatJobOperationSuccessful', 'Great job! Operation successful.'),
    i18n.t('factory.sonner.yourChangesAreNowLive', 'Your changes are now live.'),
    i18n.t(
      'factory.sonner.successfullyProcessedYourRequest',
      'Successfully processed your request.'
    ),
  ],
  warning: [
    i18n.t(
      'factory.sonner.pleaseReviewYourSettingsBefore',
      'Please review your settings before continuing.'
    ),
    i18n.t('factory.sonner.thisActionCannotBeUndone', 'This action cannot be undone.'),
    i18n.t('factory.sonner.yourSessionIsAboutTo', 'Your session is about to expire.'),
    i18n.t('factory.sonner.someFeaturesMayBeUnavailable', 'Some features may be unavailable.'),
    i18n.t('factory.sonner.pleaseSaveYourWorkBefore', 'Please save your work before leaving.'),
  ],
};

/**
 * Category-specific toast messages
 */
export const CATEGORY_MESSAGES: Record<ToastCategory, { description: string; title: string }[]> = {
  authentication: [
    {
      title: i18n.t('factory.sonner.signedIn', 'Signed In'),
      description: i18n.t(
        'factory.sonner.welcomeBackYouAreNow',
        'Welcome back! You are now logged in.'
      ),
    },
    {
      title: i18n.t('factory.sonner.signedOut', 'Signed Out'),
      description: i18n.t(
        'factory.sonner.youHaveBeenSuccessfullyLogged',
        'You have been successfully logged out.'
      ),
    },
    {
      title: i18n.t('factory.sonner.sessionExpired', 'Session Expired'),
      description: i18n.t(
        'factory.sonner.pleaseSignInAgainTo',
        'Please sign in again to continue.'
      ),
    },
    {
      title: i18n.t('factory.sonner.passwordChanged', 'Password Changed'),
      description: i18n.t(
        'factory.sonner.yourPasswordHasBeenUpdated',
        'Your password has been updated.'
      ),
    },
    {
      title: i18n.t('factory.sonner.accountLocked', 'Account Locked'),
      description: i18n.t(
        'factory.sonner.tooManyFailedAttemptsPlease',
        'Too many failed attempts. Please try later.'
      ),
    },
  ],
  error: [
    {
      title: i18n.t('factory.sonner.serverError', 'Server Error'),
      description: i18n.t(
        'factory.sonner.internalServerErrorPleaseTry',
        'Internal server error. Please try again later.'
      ),
    },
    {
      title: i18n.t('factory.sonner.notFound', 'Not Found'),
      description: i18n.t(
        'factory.sonner.theRequestedResourceWasNot',
        'The requested resource was not found.'
      ),
    },
    {
      title: i18n.t('factory.sonner.permissionDenied', 'Permission Denied'),
      description: i18n.t(
        'factory.sonner.youDoNotHaveAccess',
        'You do not have access to this resource.'
      ),
    },
    {
      title: i18n.t('factory.sonner.validationError', 'Validation Error'),
      description: i18n.t(
        'factory.sonner.pleaseCheckYourInputAnd',
        'Please check your input and try again.'
      ),
    },
    {
      title: i18n.t('factory.sonner.timeout', 'Timeout'),
      description: i18n.t(
        'factory.sonner.theRequestTookTooLong',
        'The request took too long. Please try again.'
      ),
    },
  ],
  file: [
    {
      title: i18n.t('factory.sonner.fileUploaded', 'File Uploaded'),
      description: i18n.t(
        'factory.sonner.yourFileHasBeenUploaded',
        'Your file has been uploaded successfully.'
      ),
    },
    {
      title: i18n.t('factory.sonner.fileDeleted', 'File Deleted'),
      description: i18n.t(
        'factory.sonner.theFileHasBeenPermanently',
        'The file has been permanently deleted.'
      ),
    },
    {
      title: i18n.t('factory.sonner.downloadStarted', 'Download Started'),
      description: i18n.t(
        'factory.sonner.yourDownloadWillBeginShortly',
        'Your download will begin shortly.'
      ),
    },
    {
      title: i18n.t('factory.sonner.uploadFailed', 'Upload Failed'),
      description: i18n.t(
        'factory.sonner.unableToUploadFilePlease',
        'Unable to upload file. Please try again.'
      ),
    },
    {
      title: i18n.t('factory.sonner.fileTooLarge', 'File Too Large'),
      description: i18n.t(
        'factory.sonner.theFileExceedsTheMaximum',
        'The file exceeds the maximum size limit.'
      ),
    },
  ],
  form: [
    {
      title: i18n.t('factory.sonner.formSubmitted', 'Form Submitted'),
      description: i18n.t(
        'factory.sonner.yourFormHasBeenSubmitted',
        'Your form has been submitted successfully.'
      ),
    },
    {
      title: i18n.t('factory.sonner.formValidationError', 'Validation Error'),
      description: i18n.t(
        'factory.sonner.pleaseFillInAllRequired',
        'Please fill in all required fields.'
      ),
    },
    {
      title: i18n.t('factory.sonner.draftSaved', 'Draft Saved'),
      description: i18n.t(
        'factory.sonner.yourProgressHasBeenSaved',
        'Your progress has been saved as a draft.'
      ),
    },
    {
      title: i18n.t('factory.sonner.formReset', 'Form Reset'),
      description: i18n.t(
        'factory.sonner.allFieldsHaveBeenCleared',
        'All fields have been cleared.'
      ),
    },
    {
      title: i18n.t('factory.sonner.changesDiscarded', 'Changes Discarded'),
      description: i18n.t(
        'factory.sonner.yourUnsavedChangesHaveBeen',
        'Your unsaved changes have been discarded.'
      ),
    },
  ],
  network: [
    {
      title: i18n.t('factory.sonner.connectionLost', 'Connection Lost'),
      description: i18n.t(
        'factory.sonner.pleaseCheckYourInternet',
        'Please check your internet connection.'
      ),
    },
    {
      title: i18n.t('factory.sonner.reconnected', 'Reconnected'),
      description: i18n.t(
        'factory.sonner.connectionRestoredSyncingData',
        'Connection restored. Syncing data...'
      ),
    },
    {
      title: i18n.t('factory.sonner.slowConnection', 'Slow Connection'),
      description: i18n.t(
        'factory.sonner.networkIsSlowSomeFeatures',
        'Network is slow. Some features may be delayed.'
      ),
    },
    {
      title: i18n.t('factory.sonner.offlineMode', 'Offline Mode'),
      description: i18n.t(
        'factory.sonner.workingOfflineChangesWillSync',
        'Working offline. Changes will sync when online.'
      ),
    },
    {
      title: i18n.t('factory.sonner.syncComplete', 'Sync Complete'),
      description: i18n.t(
        'factory.sonner.allChangesHaveBeenSynchronized',
        'All changes have been synchronized.'
      ),
    },
  ],
  notification: [
    {
      title: i18n.t('factory.sonner.newMessage', 'New Message'),
      description: i18n.t(
        'factory.sonner.youHaveANewMessage',
        'You have a new message from a team member.'
      ),
    },
    {
      title: i18n.t('factory.sonner.reminder', 'Reminder'),
      description: i18n.t(
        'factory.sonner.yourScheduledEventStartsIn',
        'Your scheduled event starts in 15 minutes.'
      ),
    },
    {
      title: i18n.t('factory.sonner.updateAvailable', 'Update Available'),
      description: i18n.t(
        'factory.sonner.aNewVersionOfTheApp',
        'A new version of the app is available.'
      ),
    },
    {
      title: i18n.t('factory.sonner.taskAssigned', 'Task Assigned'),
      description: i18n.t(
        'factory.sonner.aNewTaskHasBeenAssigned',
        'A new task has been assigned to you.'
      ),
    },
    {
      title: i18n.t('factory.sonner.commentAdded', 'Comment Added'),
      description: i18n.t(
        'factory.sonner.someoneCommentedOnYourPost',
        'Someone commented on your post.'
      ),
    },
  ],
  payment: [
    {
      title: i18n.t('factory.sonner.paymentSuccessful', 'Payment Successful'),
      description: i18n.t(
        'factory.sonner.yourPaymentHasBeenProcessed',
        'Your payment has been processed.'
      ),
    },
    {
      title: i18n.t('factory.sonner.paymentFailed', 'Payment Failed'),
      description: i18n.t(
        'factory.sonner.unableToProcessPaymentPlease',
        'Unable to process payment. Please try again.'
      ),
    },
    {
      title: i18n.t('factory.sonner.subscriptionRenewed', 'Subscription Renewed'),
      description: i18n.t(
        'factory.sonner.yourSubscriptionHasBeenRenewed',
        'Your subscription has been renewed.'
      ),
    },
    {
      title: i18n.t('factory.sonner.invoiceGenerated', 'Invoice Generated'),
      description: i18n.t(
        'factory.sonner.yourInvoiceIsReadyFor',
        'Your invoice is ready for download.'
      ),
    },
    {
      title: i18n.t('factory.sonner.refundInitiated', 'Refund Initiated'),
      description: i18n.t(
        'factory.sonner.yourRefundIsBeingProcessed',
        'Your refund is being processed.'
      ),
    },
  ],
  permission: [
    {
      title: i18n.t('factory.sonner.permissionGranted', 'Permission Granted'),
      description: i18n.t(
        'factory.sonner.accessHasBeenGrantedSuccessfully',
        'Access has been granted successfully.'
      ),
    },
    {
      title: i18n.t('factory.sonner.permissionDeniedCategory', 'Permission Denied'),
      description: i18n.t(
        'factory.sonner.youDoNotHavePermission',
        'You do not have permission for this action.'
      ),
    },
    {
      title: i18n.t('factory.sonner.roleUpdated', 'Role Updated'),
      description: i18n.t(
        'factory.sonner.userPermissionsHaveBeenUpdated',
        'User permissions have been updated.'
      ),
    },
    {
      title: i18n.t('factory.sonner.accessRevoked', 'Access Revoked'),
      description: i18n.t(
        'factory.sonner.accessToThisResourceHasBeen',
        'Access to this resource has been revoked.'
      ),
    },
    {
      title: i18n.t('factory.sonner.invitationSent', 'Invitation Sent'),
      description: i18n.t(
        'factory.sonner.anInvitationHasBeenSent',
        'An invitation has been sent to the user.'
      ),
    },
  ],
  system: [
    {
      title: i18n.t('factory.sonner.systemUpdate', 'System Update'),
      description: i18n.t(
        'factory.sonner.theSystemWillRestartIn',
        'The system will restart in 5 minutes.'
      ),
    },
    {
      title: i18n.t('factory.sonner.maintenance', 'Maintenance'),
      description: i18n.t(
        'factory.sonner.scheduledMaintenanceStartingSoon',
        'Scheduled maintenance starting soon.'
      ),
    },
    {
      title: i18n.t('factory.sonner.cacheCleared', 'Cache Cleared'),
      description: i18n.t(
        'factory.sonner.systemCacheHasBeenCleared',
        'System cache has been cleared.'
      ),
    },
    {
      title: i18n.t('factory.sonner.backupComplete', 'Backup Complete'),
      description: i18n.t(
        'factory.sonner.systemBackupCompletedSuccessfully',
        'System backup completed successfully.'
      ),
    },
    {
      title: i18n.t('factory.sonner.performanceAlert', 'Performance Alert'),
      description: i18n.t(
        'factory.sonner.systemIsExperiencingHighLoad',
        'System is experiencing high load.'
      ),
    },
  ],
  user: [
    {
      title: i18n.t('factory.sonner.profileUpdated', 'Profile Updated'),
      description: i18n.t(
        'factory.sonner.yourProfileChangesHaveBeen',
        'Your profile changes have been saved.'
      ),
    },
    {
      title: i18n.t('factory.sonner.avatarChanged', 'Avatar Changed'),
      description: i18n.t('factory.sonner.yourNewAvatarIsNow', 'Your new avatar is now visible.'),
    },
    {
      title: i18n.t('factory.sonner.settingsSaved', 'Settings Saved'),
      description: i18n.t(
        'factory.sonner.yourPreferencesHaveBeenUpdated',
        'Your preferences have been updated.'
      ),
    },
    {
      title: i18n.t('factory.sonner.emailVerified', 'Email Verified'),
      description: i18n.t(
        'factory.sonner.yourEmailAddressHasBeen',
        'Your email address has been verified.'
      ),
    },
    {
      title: i18n.t('factory.sonner.accountDeleted', 'Account Deleted'),
      description: i18n.t(
        'factory.sonner.yourAccountHasBeenPermanently',
        'Your account has been permanently deleted.'
      ),
    },
  ],
};

/**
 * Action button labels
 */
export const ACTION_LABELS = [
  i18n.t('factory.sonner.undo', 'Undo'),
  i18n.t('factory.sonner.retry', 'Retry'),
  i18n.t('factory.sonner.view', 'View'),
  i18n.t('factory.sonner.dismiss', 'Dismiss'),
  i18n.t('factory.sonner.learnMore', 'Learn more'),
  i18n.t('factory.sonner.open', 'Open'),
  i18n.t('factory.sonner.details', 'Details'),
];

/**
 * Cancel button labels
 */
export const CANCEL_LABELS = [
  i18n.t('factory.sonner.dismiss', 'Dismiss'),
  i18n.t('factory.sonner.cancel', 'Cancel'),
  i18n.t('factory.sonner.close', 'Close'),
  i18n.t('factory.sonner.notNow', 'Not now'),
  i18n.t('factory.sonner.skip', 'Skip'),
  i18n.t('factory.sonner.ignore', 'Ignore'),
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Toast action configuration
 */
export interface FakeToastAction {
  label: string;
  onClick: () => void;
}

/**
 * Base toast notification
 */
export interface FakeToast {
  action?: FakeToastAction;
  cancel?: FakeToastAction;
  category?: ToastCategory;
  closeButton: boolean;
  description?: string;
  dismissible: boolean;
  duration: number;
  icon?: string;
  id: string;
  important: boolean;
  position: ToastPosition;
  priority: ToastPriority;
  testId: string;
  title: string;
  type: ToastType;
}

/**
 * Toast with promise handling
 */
export interface FakeToastPromise extends FakeToast {
  errorMessage: string;
  loadingMessage: string;
  promise: Promise<unknown>;
  successMessage: string;
}

/**
 * Toast queue item
 */
export interface FakeToastQueueItem extends FakeToast {
  delay: number;
  index: number;
}

/**
 * Toaster configuration
 */
export interface FakeToasterConfig {
  closeButton: boolean;
  dir: 'auto' | 'ltr' | 'rtl';
  duration: number;
  expand: boolean;
  gap: number;
  hotkey: string[];
  invert: boolean;
  offset: number | string;
  position: ToastPosition;
  richColors: boolean;
  theme: ToastTheme;
  visibleToasts: number;
}

/**
 * Toast notification sequence
 */
export interface FakeToastSequence {
  delay: number;
  id: string;
  toasts: FakeToast[];
}

/**
 * Toast notification group
 */
export interface FakeToastGroup {
  category: ToastCategory;
  id: string;
  toasts: FakeToast[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * No-op function for action handlers in stories
 */
function noopHandler(): void {
  // No-op for story purposes
}

// ============================================================================
// BASE FACTORIES
// ============================================================================

/**
 * Create a fake toast notification
 */
export function createFakeToast(overrides?: Partial<FakeToast>): FakeToast {
  const type = overrides?.type ?? faker.helpers.arrayElement(TOAST_TYPES);
  const hasAction = faker.datatype.boolean({ probability: 0.3 });
  const hasCancel = faker.datatype.boolean({ probability: 0.2 });

  return {
    action: hasAction
      ? {
          label: faker.helpers.arrayElement(ACTION_LABELS),
          onClick: noopHandler,
        }
      : undefined,
    cancel: hasCancel
      ? {
          label: faker.helpers.arrayElement(CANCEL_LABELS),
          onClick: noopHandler,
        }
      : undefined,
    category: faker.helpers.maybe(() => faker.helpers.arrayElement(TOAST_CATEGORIES), {
      probability: 0.5,
    }),
    closeButton: faker.datatype.boolean({ probability: 0.7 }),
    description: faker.helpers.maybe(() => faker.helpers.arrayElement(TOAST_DESCRIPTIONS[type]), {
      probability: 0.8,
    }),
    dismissible: faker.datatype.boolean({ probability: 0.9 }),
    duration: TOAST_DURATIONS[type],
    icon: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['🎉', '✅', '❌', '⚠️', 'ℹ️', '🔔']),
      { probability: 0.2 }
    ),
    id: faker.string.uuid(),
    important: faker.datatype.boolean({ probability: 0.1 }),
    position: faker.helpers.arrayElement(TOAST_POSITIONS),
    priority: faker.helpers.arrayElement(TOAST_PRIORITIES),
    testId: `toast-${faker.string.alphanumeric(8)}`,
    title: faker.helpers.arrayElement(TOAST_TITLES[type]),
    type,
    ...overrides,
  };
}

/**
 * Create multiple fake toasts
 */
export function createFakeToasts(count: number, overrides?: Partial<FakeToast>): FakeToast[] {
  return Array.from({ length: count }, () => createFakeToast(overrides));
}

// ============================================================================
// TYPE-SPECIFIC FACTORIES
// ============================================================================

/**
 * Create a success toast
 */
export function createFakeSuccessToast(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeToast({
    type: 'success',
    title: faker.helpers.arrayElement(TOAST_TITLES.success),
    description: faker.helpers.arrayElement(TOAST_DESCRIPTIONS.success),
    duration: TOAST_DURATIONS.success,
    ...overrides,
  });
}

/**
 * Create an error toast
 */
export function createFakeErrorToast(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeToast({
    type: 'error',
    title: faker.helpers.arrayElement(TOAST_TITLES.error),
    description: faker.helpers.arrayElement(TOAST_DESCRIPTIONS.error),
    duration: TOAST_DURATIONS.error,
    important: true,
    ...overrides,
  });
}

/**
 * Create a warning toast
 */
export function createFakeWarningToast(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeToast({
    type: 'warning',
    title: faker.helpers.arrayElement(TOAST_TITLES.warning),
    description: faker.helpers.arrayElement(TOAST_DESCRIPTIONS.warning),
    duration: TOAST_DURATIONS.warning,
    ...overrides,
  });
}

/**
 * Create an info toast
 */
export function createFakeInfoToast(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeToast({
    type: 'info',
    title: faker.helpers.arrayElement(TOAST_TITLES.info),
    description: faker.helpers.arrayElement(TOAST_DESCRIPTIONS.info),
    duration: TOAST_DURATIONS.info,
    ...overrides,
  });
}

/**
 * Create a loading toast
 */
export function createFakeLoadingToast(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeToast({
    type: 'loading',
    title: faker.helpers.arrayElement(TOAST_TITLES.loading),
    description: faker.helpers.arrayElement(TOAST_DESCRIPTIONS.loading),
    duration: TOAST_DURATIONS.loading,
    dismissible: false,
    ...overrides,
  });
}

/**
 * Create a default toast
 */
export function createFakeDefaultToast(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeToast({
    type: 'default',
    title: faker.helpers.arrayElement(TOAST_TITLES.default),
    description: faker.helpers.arrayElement(TOAST_DESCRIPTIONS.default),
    duration: TOAST_DURATIONS.default,
    ...overrides,
  });
}

// ============================================================================
// CATEGORY-SPECIFIC FACTORIES
// ============================================================================

/**
 * Create a toast by category
 */
export function createFakeCategoryToast(
  category: ToastCategory,
  overrides?: Partial<FakeToast>
): FakeToast {
  const message = faker.helpers.arrayElement(CATEGORY_MESSAGES[category]);
  const typeMapping: Record<ToastCategory, ToastType> = {
    authentication: 'info',
    error: 'error',
    file: 'success',
    form: 'success',
    network: 'warning',
    notification: 'info',
    payment: 'success',
    permission: 'warning',
    system: 'info',
    user: 'success',
  };

  return createFakeToast({
    category,
    description: message.description,
    title: message.title,
    type: typeMapping[category],
    ...overrides,
  });
}

/**
 * Create an authentication toast
 */
export function createFakeAuthToast(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeCategoryToast('authentication', overrides);
}

/**
 * Create a file operation toast
 */
export function createFakeFileToast(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeCategoryToast('file', overrides);
}

/**
 * Create a payment toast
 */
export function createFakePaymentToast(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeCategoryToast('payment', overrides);
}

/**
 * Create a network toast
 */
export function createFakeNetworkToast(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeCategoryToast('network', overrides);
}

/**
 * Create a form toast
 */
export function createFakeFormToast(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeCategoryToast('form', overrides);
}

// ============================================================================
// ACTION TOAST FACTORIES
// ============================================================================

/**
 * Create a toast with an action button
 */
export function createFakeToastWithAction(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeToast({
    action: {
      label: faker.helpers.arrayElement(ACTION_LABELS),
      onClick: noopHandler,
    },
    ...overrides,
  });
}

/**
 * Create a toast with undo action
 */
export function createFakeUndoToast(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeToast({
    title: i18n.t('factory.sonner.itemDeleted', 'Item Deleted'),
    description: i18n.t('factory.sonner.theItemHasBeenMoved', 'The item has been moved to trash.'),
    type: 'default',
    action: {
      label: i18n.t('factory.sonner.undo', 'Undo'),
      onClick: noopHandler,
    },
    ...overrides,
  });
}

/**
 * Create a toast with retry action
 */
export function createFakeRetryToast(overrides?: Partial<FakeToast>): FakeToast {
  return createFakeToast({
    title: i18n.t('factory.sonner.operationFailed', 'Operation Failed'),
    description: i18n.t(
      'factory.sonner.unableToCompleteTheOperation',
      'Unable to complete the operation.'
    ),
    type: 'error',
    action: {
      label: i18n.t('factory.sonner.retry', 'Retry'),
      onClick: noopHandler,
    },
    ...overrides,
  });
}

// ============================================================================
// PROMISE TOAST FACTORIES
// ============================================================================

/**
 * Create a promise-based toast
 */
export function createFakeToastPromise(overrides?: Partial<FakeToastPromise>): FakeToastPromise {
  const baseToast = createFakeToast({ type: 'loading', ...overrides });

  return {
    ...baseToast,
    errorMessage:
      overrides?.errorMessage ?? i18n.t('factory.sonner.operationFailed2', 'Operation failed'),
    loadingMessage:
      overrides?.loadingMessage ?? i18n.t('factory.sonner.processing2', 'Processing...'),
    promise:
      overrides?.promise ??
      new Promise((resolve) => {
        setTimeout(resolve, faker.number.int({ min: 1000, max: 3000 }));
      }),
    successMessage:
      overrides?.successMessage ??
      i18n.t('factory.sonner.operationCompleted2', 'Operation completed!'),
  };
}

/**
 * Create a successful promise toast
 */
export function createFakeSuccessPromiseToast(
  delayMs = 2000,
  overrides?: Partial<FakeToastPromise>
): FakeToastPromise {
  return createFakeToastPromise({
    errorMessage: i18n.t('factory.sonner.failedToComplete', 'Failed to complete'),
    loadingMessage: i18n.t('factory.sonner.loadingData', 'Loading data...'),
    promise: new Promise((resolve) => {
      setTimeout(() => resolve({ success: true }), delayMs);
    }),
    successMessage: i18n.t('factory.sonner.dataLoadedSuccessfully', 'Data loaded successfully!'),
    ...overrides,
  });
}

/**
 * Create a failing promise toast
 */
export function createFakeErrorPromiseToast(
  delayMs = 2000,
  overrides?: Partial<FakeToastPromise>
): FakeToastPromise {
  return createFakeToastPromise({
    errorMessage: i18n.t('factory.sonner.connectionFailed', 'Connection failed'),
    loadingMessage: i18n.t('factory.sonner.connectingToServer', 'Connecting to server...'),
    promise: new Promise((_resolve, reject) => {
      setTimeout(
        () => reject(new Error(i18n.t('factory.sonner.connectionFailed', 'Connection failed'))),
        delayMs
      );
    }),
    successMessage: i18n.t('factory.sonner.connected', 'Connected!'),
    ...overrides,
  });
}

// ============================================================================
// TOASTER CONFIG FACTORIES
// ============================================================================

/**
 * Create a fake toaster configuration
 */
export function createFakeToasterConfig(overrides?: Partial<FakeToasterConfig>): FakeToasterConfig {
  return {
    closeButton: faker.datatype.boolean({ probability: 0.7 }),
    dir: faker.helpers.arrayElement<'auto' | 'ltr' | 'rtl'>(['auto', 'ltr', 'rtl']),
    duration: faker.helpers.arrayElement([3000, 4000, 5000, 6000]),
    expand: faker.datatype.boolean({ probability: 0.3 }),
    gap: faker.helpers.arrayElement([8, 12, 14, 16]),
    hotkey: ['altKey', 'KeyT'],
    invert: faker.datatype.boolean({ probability: 0.2 }),
    offset: faker.helpers.arrayElement([16, 24, 32, '1rem', '2rem']),
    position: faker.helpers.arrayElement(TOAST_POSITIONS),
    richColors: faker.datatype.boolean({ probability: 0.8 }),
    theme: faker.helpers.arrayElement(TOAST_THEMES),
    visibleToasts: faker.helpers.arrayElement([1, 2, 3, 4, 5]),
    ...overrides,
  };
}

// ============================================================================
// QUEUE FACTORIES
// ============================================================================

/**
 * Create a toast queue for sequential display
 */
export function createFakeToastQueue(count: number, delayBetween = 500): FakeToastQueueItem[] {
  return Array.from({ length: count }, (_, index) => ({
    ...createFakeToast(),
    delay: index * delayBetween,
    index,
  }));
}

/**
 * Create a notification sequence
 */
export function createFakeToastSequence(
  count: number,
  overrides?: Partial<FakeToastSequence>
): FakeToastSequence {
  return {
    delay: faker.number.int({ min: 500, max: 2000 }),
    id: faker.string.uuid(),
    toasts: createFakeToasts(count),
    ...overrides,
  };
}

// ============================================================================
// GROUP FACTORIES
// ============================================================================

/**
 * Create a toast group by category
 */
export function createFakeToastGroup(
  category: ToastCategory,
  count = 3,
  overrides?: Partial<FakeToastGroup>
): FakeToastGroup {
  return {
    category,
    id: faker.string.uuid(),
    toasts: Array.from({ length: count }, () => createFakeCategoryToast(category)),
    ...overrides,
  };
}

/**
 * Create groups for all categories
 */
export function createFakeToastGroupsByCategory(countPerCategory = 2): FakeToastGroup[] {
  return TOAST_CATEGORIES.map((category) => createFakeToastGroup(category, countPerCategory));
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Create a matrix of toasts by type
 */
export function createToastTypeMatrix(): { toast: FakeToast; type: ToastType }[] {
  return TOAST_TYPES.map((type) => ({
    toast: createFakeToast({ type }),
    type,
  }));
}

/**
 * Create a matrix of toasts by position
 */
export function createToastPositionMatrix(): { position: ToastPosition; toast: FakeToast }[] {
  return TOAST_POSITIONS.map((position) => ({
    position,
    toast: createFakeToast({ position }),
  }));
}

/**
 * Create a matrix of toasts by priority
 */
export function createToastPriorityMatrix(): { priority: ToastPriority; toast: FakeToast }[] {
  return TOAST_PRIORITIES.map((priority) => ({
    priority,
    toast: createFakeToast({ priority }),
  }));
}

/**
 * Create a matrix of toasts by category
 */
export function createToastCategoryMatrix(): { category: ToastCategory; toast: FakeToast }[] {
  return TOAST_CATEGORIES.map((category) => ({
    category,
    toast: createFakeCategoryToast(category),
  }));
}

// ============================================================================
// SHOWCASE FACTORIES
// ============================================================================

/**
 * Create comprehensive toast test data
 */
export function createToastTestData(): {
  auth: FakeToast;
  default: FakeToast;
  error: FakeToast;
  errorPromise: FakeToastPromise;
  file: FakeToast;
  info: FakeToast;
  loading: FakeToast;
  network: FakeToast;
  payment: FakeToast;
  retry: FakeToast;
  success: FakeToast;
  successPromise: FakeToastPromise;
  toasterConfig: FakeToasterConfig;
  undo: FakeToast;
  warning: FakeToast;
  withAction: FakeToast;
} {
  return {
    auth: createFakeAuthToast(),
    default: createFakeDefaultToast(),
    error: createFakeErrorToast(),
    errorPromise: createFakeErrorPromiseToast(),
    file: createFakeFileToast(),
    info: createFakeInfoToast(),
    loading: createFakeLoadingToast(),
    network: createFakeNetworkToast(),
    payment: createFakePaymentToast(),
    retry: createFakeRetryToast(),
    success: createFakeSuccessToast(),
    successPromise: createFakeSuccessPromiseToast(),
    toasterConfig: createFakeToasterConfig(),
    undo: createFakeUndoToast(),
    warning: createFakeWarningToast(),
    withAction: createFakeToastWithAction(),
  };
}

/**
 * Create a showcase of all toast variants
 */
export function createToastShowcase(): {
  categoryMatrix: ReturnType<typeof createToastCategoryMatrix>;
  groups: FakeToastGroup[];
  positionMatrix: ReturnType<typeof createToastPositionMatrix>;
  priorityMatrix: ReturnType<typeof createToastPriorityMatrix>;
  queue: FakeToastQueueItem[];
  testData: ReturnType<typeof createToastTestData>;
  typeMatrix: ReturnType<typeof createToastTypeMatrix>;
} {
  return {
    categoryMatrix: createToastCategoryMatrix(),
    groups: createFakeToastGroupsByCategory(),
    positionMatrix: createToastPositionMatrix(),
    priorityMatrix: createToastPriorityMatrix(),
    queue: createFakeToastQueue(5),
    testData: createToastTestData(),
    typeMatrix: createToastTypeMatrix(),
  };
}
