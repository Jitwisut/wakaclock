import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// FEEDBACK FACTORY - Enterprise Pattern
// Comprehensive test data generation for feedback components
// (Toast, Sonner, Spinner, Skeleton, Progress, Alert)
// ============================================================================

// ============================================================================
// CONSTANTS
// ============================================================================

/** Common loading message (defined once to satisfy sonarjs/no-duplicate-string) */
const LOADING_MESSAGE = i18n.t('factory.feedback.loading', 'Loading...');
const LABEL_WARNING = i18n.t('factory.feedback.warning', 'Warning');
const LABEL_INFO = i18n.t('factory.feedback.info', 'Info');
const LABEL_ERROR = i18n.t('factory.feedback.error', 'Error');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Toast variant types */
export type ToastVariant = 'default' | 'destructive';

/** Sonner toast types */
export type SonnerToastType = 'error' | 'info' | 'loading' | 'message' | 'success' | 'warning';

/** Spinner size options */
export type SpinnerSize = 'lg' | 'md' | 'sm' | 'xl' | 'xs';

/** Skeleton variant types */
export type SkeletonVariant = 'circular' | 'rectangular' | 'rounded' | 'text';

/** Skeleton animation types */
export type SkeletonAnimation = 'none' | 'pulse' | 'wave';

/** Feedback progress variant types (prefixed to avoid conflict with progress.factory.ts) */
export type FeedbackProgressVariant = 'default' | 'error' | 'info' | 'success' | 'warning';

/** Feedback progress size options (prefixed to avoid conflict with progress.factory.ts) */
export type FeedbackProgressSize = 'lg' | 'md' | 'sm' | 'xs';

/** Feedback alert variant types (prefixed to avoid conflict with alert.factory.ts) */
export type FeedbackAlertVariant = 'default' | 'destructive' | 'info' | 'success' | 'warning';

/** Feedback alert icon type (prefixed to avoid conflict with alert.factory.ts) */
export type FeedbackAlertIcon = 'error' | 'info' | 'none' | 'success' | 'warning';

/** Feedback position types */
export type FeedbackPosition =
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'top-left'
  | 'top-right';

/** Banner variant types */
export type BannerVariant = 'default' | 'error' | 'info' | 'promotional' | 'success' | 'warning';

/** Loading state types */
export type LoadingState = 'error' | 'idle' | 'loading' | 'success';

/** Feedback priority levels */
export type FeedbackPriority = 'high' | 'low' | 'normal' | 'urgent';

// ============================================================================
// INTERFACES
// ============================================================================

/** Toast item structure */
export interface FakeToastItem {
  action?: {
    altText?: string;
    label: string;
    onClick?: string;
  };
  className?: string;
  closable?: boolean;
  description?: string;
  duration: number;
  icon?: string;
  id: string;
  onDismiss?: string;
  priority?: FeedbackPriority;
  title: string;
  variant: ToastVariant;
}

/** Sonner toast structure */
export interface FakeSonnerToast {
  action?: {
    label: string;
    onClick?: string;
  };
  cancel?: {
    label: string;
    onClick?: string;
  };
  closeButton?: boolean;
  description?: string;
  duration?: number;
  icon?: string;
  id: string;
  important?: boolean;
  position?: FeedbackPosition;
  promise?: boolean;
  richColors?: boolean;
  title: string;
  type: SonnerToastType;
}

/** Spinner configuration */
export interface FakeSpinner {
  centered?: boolean;
  className?: string;
  color?: string;
  id: string;
  label?: string;
  overlay?: boolean;
  size: SpinnerSize;
  speed?: 'fast' | 'normal' | 'slow';
  variant?: 'bars' | 'default' | 'dots' | 'ring';
}

/** Skeleton configuration */
export interface FakeSkeleton {
  animation?: SkeletonAnimation;
  borderRadius?: number | string;
  className?: string;
  count?: number;
  height: number | string;
  id: string;
  variant: SkeletonVariant;
  width: number | string;
}

/** Skeleton group for complex layouts */
export interface FakeSkeletonGroup {
  gap?: number;
  id: string;
  items: FakeSkeleton[];
  layout: 'grid' | 'horizontal' | 'vertical';
}

/** Feedback progress bar configuration (prefixed to avoid conflict with progress.factory.ts) */
export interface FakeFeedbackProgress {
  animated?: boolean;
  className?: string;
  id: string;
  indeterminate?: boolean;
  label?: string;
  max?: number;
  showValue?: boolean;
  size?: FeedbackProgressSize;
  striped?: boolean;
  value: number;
  variant?: FeedbackProgressVariant;
}

/** Feedback progress with steps (prefixed to avoid conflict with progress.factory.ts) */
export interface FakeFeedbackProgressSteps {
  currentStep: number;
  id: string;
  showLabels?: boolean;
  showProgress?: boolean;
  steps: FakeFeedbackProgressStep[];
  variant?: FeedbackProgressVariant;
}

/** Individual feedback progress step (prefixed to avoid conflict with progress.factory.ts) */
export interface FakeFeedbackProgressStep {
  completed?: boolean;
  description?: string;
  error?: boolean;
  id: string;
  label: string;
}

/** Feedback alert configuration (prefixed to avoid conflict with alert.factory.ts) */
export interface FakeFeedbackAlert {
  action?: {
    label: string;
    onClick?: string;
  };
  className?: string;
  closable?: boolean;
  description?: string;
  icon?: FeedbackAlertIcon;
  id: string;
  onClose?: string;
  title: string;
  variant: FeedbackAlertVariant;
}

/** Feedback alert with multiple actions (prefixed to avoid conflict with alert.factory.ts) */
export interface FakeFeedbackAlertWithActions {
  actions: FakeFeedbackAlertAction[];
  closable?: boolean;
  description?: string;
  icon?: FeedbackAlertIcon;
  id: string;
  title: string;
  variant: FeedbackAlertVariant;
}

/** Feedback alert action button (prefixed to avoid conflict with alert.factory.ts) */
export interface FakeFeedbackAlertAction {
  id: string;
  label: string;
  onClick?: string;
  variant?: 'default' | 'ghost' | 'link' | 'outline';
}

/** Banner configuration */
export interface FakeBanner {
  action?: {
    href?: string;
    label: string;
    onClick?: string;
  };
  className?: string;
  closable?: boolean;
  id: string;
  message: string;
  position?: 'bottom' | 'top';
  sticky?: boolean;
  variant: BannerVariant;
}

/** Loading overlay configuration */
export interface FakeLoadingOverlay {
  blur?: boolean;
  className?: string;
  id: string;
  message?: string;
  opacity?: number;
  spinner?: FakeSpinner;
  visible: boolean;
  zIndex?: number;
}

/** Loading state configuration */
export interface FakeLoadingState {
  data?: unknown;
  error?: FakeErrorState;
  id: string;
  progress?: number;
  retryCount?: number;
  state: LoadingState;
}

/** Error state configuration */
export interface FakeErrorState {
  code?: string;
  details?: Record<string, unknown>;
  id: string;
  message: string;
  recoverable?: boolean;
  retryAction?: string;
  title?: string;
}

/** Empty state configuration */
export interface FakeEmptyState {
  action?: {
    href?: string;
    label: string;
    onClick?: string;
  };
  className?: string;
  description?: string;
  icon?: string;
  id: string;
  title: string;
}

/** Notification badge configuration */
export interface FakeNotificationBadge {
  animate?: boolean;
  className?: string;
  count: number;
  id: string;
  max?: number;
  showZero?: boolean;
  size?: 'lg' | 'md' | 'sm';
  variant?: 'default' | 'destructive' | 'dot' | 'outline';
}

/** Feedback tooltip configuration (prefixed to avoid conflict with tooltip.factory.ts) */
export interface FakeFeedbackTooltip {
  align?: 'center' | 'end' | 'start';
  className?: string;
  content: string;
  delay?: number;
  id: string;
  offset?: number;
  side?: 'bottom' | 'left' | 'right' | 'top';
  trigger?: 'click' | 'focus' | 'hover';
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** All toast variants */
export const TOAST_VARIANTS: ToastVariant[] = ['default', 'destructive'];

/** All sonner toast types */
export const SONNER_TOAST_TYPES: SonnerToastType[] = [
  'success',
  'error',
  'warning',
  'info',
  'loading',
  'message',
];

/** All spinner sizes */
export const SPINNER_SIZES: SpinnerSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

/** All skeleton variants */
export const SKELETON_VARIANTS: SkeletonVariant[] = ['text', 'circular', 'rectangular', 'rounded'];

/** All skeleton animations */
export const SKELETON_ANIMATIONS: SkeletonAnimation[] = ['pulse', 'wave', 'none'];

/** All feedback progress variants (prefixed to avoid conflict with progress.factory.ts) */
export const FEEDBACK_PROGRESS_VARIANTS: FeedbackProgressVariant[] = [
  'default',
  'success',
  'warning',
  'error',
  'info',
];

/** All feedback progress sizes (prefixed to avoid conflict with progress.factory.ts) */
export const FEEDBACK_PROGRESS_SIZES: FeedbackProgressSize[] = ['xs', 'sm', 'md', 'lg'];

/** All feedback alert variants (prefixed to avoid conflict with alert.factory.ts) */
export const FEEDBACK_ALERT_VARIANTS: FeedbackAlertVariant[] = [
  'default',
  'destructive',
  'success',
  'warning',
  'info',
];

/** All feedback alert icons (prefixed to avoid conflict with alert.factory.ts) */
export const FEEDBACK_ALERT_ICONS: FeedbackAlertIcon[] = [
  'info',
  'success',
  'warning',
  'error',
  'none',
];

/** All feedback positions */
export const FEEDBACK_POSITIONS: FeedbackPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

/** All banner variants */
export const BANNER_VARIANTS: BannerVariant[] = [
  'default',
  'info',
  'success',
  'warning',
  'error',
  'promotional',
];

/** All loading states */
export const LOADING_STATES: LoadingState[] = ['idle', 'loading', 'success', 'error'];

/** All feedback priorities */
export const FEEDBACK_PRIORITIES: FeedbackPriority[] = ['low', 'normal', 'high', 'urgent'];

/** Common toast titles */
export const TOAST_TITLES = [
  i18n.t('factory.feedback.success', 'Success!'),
  i18n.t('factory.feedback.errorOccurred', 'Error occurred'),
  i18n.t('factory.feedback.updateAvailable', 'Update available'),
  i18n.t('factory.feedback.taskCompleted', 'Task completed'),
  LABEL_WARNING,
  i18n.t('factory.feedback.actionRequired', 'Action required'),
  i18n.t('factory.feedback.savedSuccessfully', 'Saved successfully'),
  i18n.t('factory.feedback.deleted', 'Deleted'),
  i18n.t('factory.feedback.connectionRestored', 'Connection restored'),
  i18n.t('factory.feedback.sessionExpiring', 'Session expiring'),
] as const;

/** Common toast descriptions */
export const TOAST_DESCRIPTIONS = [
  i18n.t('factory.feedback.yourChangesHaveBeenSaved', 'Your changes have been saved.'),
  i18n.t('factory.feedback.somethingWentWrongPleaseTry', 'Something went wrong. Please try again.'),
  i18n.t('factory.feedback.aNewVersionIsAvailable', 'A new version is available.'),
  i18n.t('factory.feedback.theTaskHasBeenCompleted', 'The task has been completed successfully.'),
  i18n.t('factory.feedback.pleaseReviewYourInput', 'Please review your input.'),
  i18n.t('factory.feedback.yourSessionWillExpireIn', 'Your session will expire in 5 minutes.'),
  i18n.t('factory.feedback.theItemHasBeenDeleted', 'The item has been deleted.'),
  i18n.t('factory.feedback.yourConnectionHasBeenRestored', 'Your connection has been restored.'),
] as const;

/** Common action labels */
export const ACTION_LABELS = [
  i18n.t('factory.feedback.undo', 'Undo'),
  i18n.t('factory.feedback.retry', 'Retry'),
  i18n.t('factory.feedback.dismiss', 'Dismiss'),
  i18n.t('factory.feedback.view', 'View'),
  i18n.t('factory.feedback.learnMore', 'Learn more'),
  i18n.t('factory.feedback.refresh', 'Refresh'),
  i18n.t('factory.feedback.close', 'Close'),
  i18n.t('factory.feedback.cancel', 'Cancel'),
  i18n.t('factory.feedback.confirm', 'Confirm'),
  i18n.t('factory.feedback.update', 'Update'),
] as const;

/** Common spinner labels */
export const SPINNER_LABELS = [
  LOADING_MESSAGE,
  i18n.t('factory.feedback.pleaseWait', 'Please wait...'),
  i18n.t('factory.feedback.processing', 'Processing...'),
  i18n.t('factory.feedback.saving', 'Saving...'),
  i18n.t('factory.feedback.uploading', 'Uploading...'),
  i18n.t('factory.feedback.downloading', 'Downloading...'),
  i18n.t('factory.feedback.connecting', 'Connecting...'),
  i18n.t('factory.feedback.verifying', 'Verifying...'),
] as const;

/** Common error codes */
export const ERROR_CODES = [
  'ERR_NETWORK',
  'ERR_TIMEOUT',
  'ERR_AUTH',
  'ERR_VALIDATION',
  'ERR_NOT_FOUND',
  'ERR_SERVER',
  'ERR_PERMISSION',
  'ERR_RATE_LIMIT',
] as const;

/** Common duration options (ms) */
export const TOAST_DURATIONS = [2000, 3000, 4000, 5000, 7000, 10_000] as const;

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake toast item
 * @param overrides - Optional property overrides
 */
export function createFakeToastItem(overrides?: Partial<FakeToastItem>): FakeToastItem {
  const variant = overrides?.variant ?? faker.helpers.arrayElement(TOAST_VARIANTS);

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([...TOAST_TITLES]),
    description: faker.helpers.maybe(() => faker.helpers.arrayElement([...TOAST_DESCRIPTIONS]), {
      probability: 0.7,
    }),
    variant,
    duration: faker.helpers.arrayElement([...TOAST_DURATIONS]),
    closable: faker.datatype.boolean({ probability: 0.8 }),
    icon: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['CheckCircle', 'XCircle', 'AlertTriangle', LABEL_INFO]),
      { probability: 0.5 }
    ),
    priority: faker.helpers.arrayElement(FEEDBACK_PRIORITIES),
    action: faker.helpers.maybe(
      () => ({
        label: faker.helpers.arrayElement([...ACTION_LABELS]),
        altText: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
      }),
      { probability: 0.4 }
    ),
    className: faker.helpers.maybe(() => 'custom-toast-class', { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake sonner toast
 * @param overrides - Optional property overrides
 */
export function createFakeSonnerToast(overrides?: Partial<FakeSonnerToast>): FakeSonnerToast {
  const type = overrides?.type ?? faker.helpers.arrayElement(SONNER_TOAST_TYPES);

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([...TOAST_TITLES]),
    description: faker.helpers.maybe(() => faker.helpers.arrayElement([...TOAST_DESCRIPTIONS]), {
      probability: 0.6,
    }),
    type,
    duration: faker.helpers.maybe(() => faker.helpers.arrayElement([...TOAST_DURATIONS]), {
      probability: 0.7,
    }),
    position: faker.helpers.arrayElement(FEEDBACK_POSITIONS),
    closeButton: faker.datatype.boolean({ probability: 0.7 }),
    richColors: faker.datatype.boolean({ probability: 0.6 }),
    important: faker.datatype.boolean({ probability: 0.2 }),
    promise: type === 'loading' && faker.datatype.boolean({ probability: 0.5 }),
    icon: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          'CheckCircle',
          'XCircle',
          'AlertTriangle',
          LABEL_INFO,
          i18n.t('factory.feedback.loader', 'Loader'),
        ]),
      { probability: 0.3 }
    ),
    action: faker.helpers.maybe(
      () => ({
        label: faker.helpers.arrayElement([...ACTION_LABELS]),
      }),
      { probability: 0.3 }
    ),
    cancel: faker.helpers.maybe(
      () => ({
        label: i18n.t('factory.feedback.cancel', 'Cancel'),
      }),
      { probability: 0.2 }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake spinner
 * @param overrides - Optional property overrides
 */
export function createFakeSpinner(overrides?: Partial<FakeSpinner>): FakeSpinner {
  return {
    id: faker.string.uuid(),
    size: faker.helpers.arrayElement(SPINNER_SIZES),
    variant: faker.helpers.arrayElement(['default', 'dots', 'bars', 'ring']),
    color: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['primary', 'secondary', 'muted', 'destructive']),
      { probability: 0.3 }
    ),
    speed: faker.helpers.arrayElement(['slow', 'normal', 'fast']),
    label: faker.helpers.maybe(() => faker.helpers.arrayElement([...SPINNER_LABELS]), {
      probability: 0.5,
    }),
    centered: faker.datatype.boolean({ probability: 0.4 }),
    overlay: faker.datatype.boolean({ probability: 0.2 }),
    className: faker.helpers.maybe(() => 'custom-spinner-class', { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake skeleton
 * @param overrides - Optional property overrides
 */
export function createFakeSkeleton(overrides?: Partial<FakeSkeleton>): FakeSkeleton {
  const variant = overrides?.variant ?? faker.helpers.arrayElement(SKELETON_VARIANTS);

  const getWidthForVariant = () => {
    if (variant === 'circular') return faker.number.int({ min: 32, max: 80 });
    if (variant === 'text') return faker.helpers.arrayElement(['100%', '80%', '60%', '40%']);
    return faker.helpers.arrayElement(['100%', '75%', '50%', 200, 300, 400]);
  };

  const getHeightForVariant = () => {
    if (variant === 'circular') return faker.number.int({ min: 32, max: 80 });
    if (variant === 'text') return faker.number.int({ min: 16, max: 24 });
    return faker.number.int({ min: 40, max: 200 });
  };

  return {
    id: faker.string.uuid(),
    variant,
    width: getWidthForVariant(),
    height: getHeightForVariant(),
    animation: faker.helpers.arrayElement(SKELETON_ANIMATIONS),
    borderRadius: faker.helpers.maybe(() => faker.helpers.arrayElement([4, 8, 12, '50%', 'full']), {
      probability: 0.3,
    }),
    count: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 5 }), { probability: 0.3 }),
    className: faker.helpers.maybe(() => 'custom-skeleton-class', { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake skeleton group
 * @param overrides - Optional property overrides
 */
export function createFakeSkeletonGroup(overrides?: Partial<FakeSkeletonGroup>): FakeSkeletonGroup {
  return {
    id: faker.string.uuid(),
    layout: faker.helpers.arrayElement(['horizontal', 'vertical', 'grid']),
    items: Array.from({ length: faker.number.int({ min: 2, max: 6 }) }, () => createFakeSkeleton()),
    gap: faker.helpers.arrayElement([4, 8, 12, 16, 20]),
    ...overrides,
  };
}

/**
 * Creates a fake progress bar
 * @param overrides - Optional property overrides
 */
export function createFakeFeedbackProgress(
  overrides?: Partial<FakeFeedbackProgress>
): FakeFeedbackProgress {
  const indeterminate = overrides?.indeterminate ?? faker.datatype.boolean({ probability: 0.2 });

  return {
    id: faker.string.uuid(),
    value: indeterminate ? 0 : faker.number.int({ min: 0, max: 100 }),
    max: 100,
    variant: faker.helpers.arrayElement(FEEDBACK_PROGRESS_VARIANTS),
    size: faker.helpers.arrayElement(FEEDBACK_PROGRESS_SIZES),
    indeterminate,
    animated: faker.datatype.boolean({ probability: 0.6 }),
    striped: faker.datatype.boolean({ probability: 0.3 }),
    showValue: faker.datatype.boolean({ probability: 0.5 }),
    label: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.feedback.uploading', 'Uploading...'),
          i18n.t('factory.feedback.processing', 'Processing...'),
          LOADING_MESSAGE,
          i18n.t('factory.feedback.progress', 'Progress'),
          i18n.t('factory.feedback.downloading', 'Downloading...'),
        ]),
      { probability: 0.4 }
    ),
    className: faker.helpers.maybe(() => 'custom-progress-class', { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake progress step
 * @param index - Step index
 * @param currentStep - Current active step
 * @param overrides - Optional property overrides
 */
export function createFakeFeedbackProgressStep(
  index: number,
  currentStep: number,
  overrides?: Partial<FakeFeedbackProgressStep>
): FakeFeedbackProgressStep {
  const stepLabels = [
    i18n.t('factory.feedback.start', 'Start'),
    i18n.t('factory.feedback.details', 'Details'),
    i18n.t('factory.feedback.review', 'Review'),
    i18n.t('factory.feedback.confirm', 'Confirm'),
    i18n.t('factory.feedback.complete', 'Complete'),
  ];

  return {
    id: faker.string.uuid(),
    label:
      stepLabels[index] ??
      i18n.t('factory.feedback.stepLabel', 'Step {{number}}', { number: index + 1 }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    completed: index < currentStep,
    error: faker.datatype.boolean({ probability: 0.05 }),
    ...overrides,
  };
}

/**
 * Creates a fake progress with steps
 * @param overrides - Optional property overrides
 */
export function createFakeFeedbackProgressSteps(
  overrides?: Partial<FakeFeedbackProgressSteps>
): FakeFeedbackProgressSteps {
  const stepCount = faker.number.int({ min: 3, max: 5 });
  const currentStep = faker.number.int({ min: 0, max: stepCount - 1 });

  return {
    id: faker.string.uuid(),
    steps: Array.from({ length: stepCount }, (_, index) =>
      createFakeFeedbackProgressStep(index, currentStep)
    ),
    currentStep,
    variant: faker.helpers.arrayElement(FEEDBACK_PROGRESS_VARIANTS),
    showLabels: faker.datatype.boolean({ probability: 0.8 }),
    showProgress: faker.datatype.boolean({ probability: 0.6 }),
    ...overrides,
  };
}

/**
 * Creates a fake alert
 * @param overrides - Optional property overrides
 */
export function createFakeFeedbackAlert(overrides?: Partial<FakeFeedbackAlert>): FakeFeedbackAlert {
  const variant = overrides?.variant ?? faker.helpers.arrayElement(FEEDBACK_ALERT_VARIANTS);

  const getIconForVariant = (): FeedbackAlertIcon => {
    if (variant === 'destructive') return 'error';
    if (variant === 'success') return 'success';
    if (variant === 'warning') return 'warning';
    if (variant === 'info') return 'info';
    return 'info';
  };

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.feedback.headsUp', 'Heads up!'),
      LABEL_ERROR,
      i18n.t('factory.feedback.success2', 'Success'),
      LABEL_WARNING,
      LABEL_INFO,
      i18n.t('factory.feedback.notice', 'Notice'),
    ]),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.8 }),
    variant,
    icon: getIconForVariant(),
    closable: faker.datatype.boolean({ probability: 0.6 }),
    action: faker.helpers.maybe(
      () => ({
        label: faker.helpers.arrayElement([...ACTION_LABELS]),
      }),
      { probability: 0.3 }
    ),
    className: faker.helpers.maybe(() => 'custom-alert-class', { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake alert with multiple actions
 * @param overrides - Optional property overrides
 */
export function createFakeFeedbackAlertWithActions(
  overrides?: Partial<FakeFeedbackAlertWithActions>
): FakeFeedbackAlertWithActions {
  const variant = overrides?.variant ?? faker.helpers.arrayElement(FEEDBACK_ALERT_VARIANTS);

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.feedback.confirmAction', 'Confirm action'),
      i18n.t('factory.feedback.areYouSure', 'Are you sure?'),
      i18n.t('factory.feedback.actionRequired', 'Action required'),
      i18n.t('factory.feedback.updateAvailable', 'Update available'),
    ]),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.8 }),
    variant,
    icon: faker.helpers.arrayElement(FEEDBACK_ALERT_ICONS),
    closable: faker.datatype.boolean({ probability: 0.5 }),
    actions: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => ({
      id: faker.string.uuid(),
      label: faker.helpers.arrayElement([...ACTION_LABELS]),
      variant: faker.helpers.arrayElement(['default', 'outline', 'ghost', 'link']),
    })),
    ...overrides,
  };
}

/**
 * Creates a fake banner
 * @param overrides - Optional property overrides
 */
export function createFakeBanner(overrides?: Partial<FakeBanner>): FakeBanner {
  const variant = overrides?.variant ?? faker.helpers.arrayElement(BANNER_VARIANTS);

  return {
    id: faker.string.uuid(),
    message: faker.helpers.arrayElement([
      i18n.t('factory.feedback.welcomeToOurNewPlatform', 'Welcome to our new platform!'),
      i18n.t(
        'factory.feedback.systemMaintenanceScheduledForTonight',
        'System maintenance scheduled for tonight.'
      ),
      i18n.t('factory.feedback.newFeaturesAreNowAvailable', 'New features are now available!'),
      i18n.t('factory.feedback.yourTrialExpiresIn3', 'Your trial expires in 3 days.'),
      i18n.t(
        'factory.feedback.importantSecurityUpdateRequired',
        'Important security update required.'
      ),
    ]),
    variant,
    position: faker.helpers.arrayElement(['top', 'bottom']),
    closable: faker.datatype.boolean({ probability: 0.7 }),
    sticky: faker.datatype.boolean({ probability: 0.5 }),
    action: faker.helpers.maybe(
      () => ({
        label: faker.helpers.arrayElement([
          i18n.t('factory.feedback.learnMore', 'Learn more'),
          i18n.t('factory.feedback.updateNow', 'Update now'),
          i18n.t('factory.feedback.dismiss', 'Dismiss'),
          i18n.t('factory.feedback.view', 'View'),
        ]),
        href: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.5 }),
      }),
      { probability: 0.5 }
    ),
    className: faker.helpers.maybe(() => 'custom-banner-class', { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake loading overlay
 * @param overrides - Optional property overrides
 */
export function createFakeLoadingOverlay(
  overrides?: Partial<FakeLoadingOverlay>
): FakeLoadingOverlay {
  return {
    id: faker.string.uuid(),
    visible: faker.datatype.boolean({ probability: 0.5 }),
    message: faker.helpers.maybe(() => faker.helpers.arrayElement([...SPINNER_LABELS]), {
      probability: 0.6,
    }),
    spinner: createFakeSpinner({ centered: true }),
    blur: faker.datatype.boolean({ probability: 0.4 }),
    opacity: faker.helpers.arrayElement([0.5, 0.6, 0.7, 0.8]),
    zIndex: faker.helpers.arrayElement([50, 100, 1000]),
    className: faker.helpers.maybe(() => 'custom-overlay-class', { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake loading state
 * @param overrides - Optional property overrides
 */
export function createFakeLoadingState(overrides?: Partial<FakeLoadingState>): FakeLoadingState {
  const state = overrides?.state ?? faker.helpers.arrayElement(LOADING_STATES);

  return {
    id: faker.string.uuid(),
    state,
    progress: state === 'loading' ? faker.number.int({ min: 0, max: 100 }) : undefined,
    data: state === 'success' ? { result: faker.lorem.sentence() } : undefined,
    error: state === 'error' ? createFakeErrorState() : undefined,
    retryCount: state === 'error' ? faker.number.int({ min: 0, max: 3 }) : undefined,
    ...overrides,
  };
}

/**
 * Creates a fake error state
 * @param overrides - Optional property overrides
 */
export function createFakeErrorState(overrides?: Partial<FakeErrorState>): FakeErrorState {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.feedback.somethingWentWrong', 'Something went wrong'),
      i18n.t('factory.feedback.requestFailed', 'Request failed'),
      LABEL_ERROR,
      i18n.t('factory.feedback.unableToCompleteAction', 'Unable to complete action'),
    ]),
    message: faker.helpers.arrayElement([
      i18n.t('factory.feedback.pleaseTryAgainLater', 'Please try again later.'),
      i18n.t('factory.feedback.anUnexpectedErrorOccurred', 'An unexpected error occurred.'),
      i18n.t('factory.feedback.theServerIsNotResponding', 'The server is not responding.'),
      i18n.t('factory.feedback.yourSessionHasExpired', 'Your session has expired.'),
      i18n.t('factory.feedback.networkConnectionLost', 'Network connection lost.'),
    ]),
    code: faker.helpers.arrayElement([...ERROR_CODES]),
    recoverable: faker.datatype.boolean({ probability: 0.7 }),
    retryAction: faker.helpers.maybe(() => 'handleRetry', { probability: 0.5 }),
    details: faker.helpers.maybe(
      () => ({
        timestamp: faker.date.recent().toISOString(),
        requestId: faker.string.uuid(),
      }),
      { probability: 0.3 }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake empty state
 * @param overrides - Optional property overrides
 */
export function createFakeEmptyState(overrides?: Partial<FakeEmptyState>): FakeEmptyState {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.feedback.noResultsFound', 'No results found'),
      i18n.t('factory.feedback.nothingHereYet', 'Nothing here yet'),
      i18n.t('factory.feedback.empty', 'Empty'),
      i18n.t('factory.feedback.noDataAvailable', 'No data available'),
      i18n.t('factory.feedback.getStarted', 'Get started'),
    ]),
    description: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t(
            'factory.feedback.tryAdjustingYourSearchOr',
            'Try adjusting your search or filters.'
          ),
          i18n.t(
            'factory.feedback.createYourFirstItemTo',
            'Create your first item to get started.'
          ),
          i18n.t('factory.feedback.noItemsMatchYourCriteria', 'No items match your criteria.'),
          i18n.t('factory.feedback.youHaventAddedAnythingYet', "You haven't added anything yet."),
        ]),
      { probability: 0.8 }
    ),
    icon: faker.helpers.arrayElement([
      i18n.t('factory.feedback.search', 'Search'),
      i18n.t('factory.feedback.inbox', 'Inbox'),
      'FileText',
      'FolderOpen',
      i18n.t('factory.feedback.plus', 'Plus'),
    ]),
    action: faker.helpers.maybe(
      () => ({
        label: faker.helpers.arrayElement([
          i18n.t('factory.feedback.createNew', 'Create new'),
          i18n.t('factory.feedback.addItem', 'Add item'),
          i18n.t('factory.feedback.getStarted', 'Get started'),
          i18n.t('factory.feedback.refresh', 'Refresh'),
        ]),
        href: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.3 }),
      }),
      { probability: 0.6 }
    ),
    className: faker.helpers.maybe(() => 'custom-empty-state-class', { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake notification badge
 * @param overrides - Optional property overrides
 */
export function createFakeNotificationBadge(
  overrides?: Partial<FakeNotificationBadge>
): FakeNotificationBadge {
  return {
    id: faker.string.uuid(),
    count: faker.number.int({ min: 0, max: 150 }),
    max: faker.helpers.arrayElement([9, 99, 999]),
    size: faker.helpers.arrayElement(['sm', 'md', 'lg']),
    variant: faker.helpers.arrayElement(['default', 'destructive', 'outline', 'dot']),
    showZero: faker.datatype.boolean({ probability: 0.2 }),
    animate: faker.datatype.boolean({ probability: 0.5 }),
    className: faker.helpers.maybe(() => 'custom-badge-class', { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake tooltip
 * @param overrides - Optional property overrides
 */
export function createFakeFeedbackTooltip(
  overrides?: Partial<FakeFeedbackTooltip>
): FakeFeedbackTooltip {
  return {
    id: faker.string.uuid(),
    content: faker.helpers.arrayElement([
      i18n.t('factory.feedback.clickToLearnMore', 'Click to learn more'),
      i18n.t('factory.feedback.thisFeatureIsNew', 'This feature is new!'),
      i18n.t('factory.feedback.keyboardShortcutK', 'Keyboard shortcut: ⌘K'),
      i18n.t('factory.feedback.requiredField', 'Required field'),
      i18n.t('factory.feedback.optional', 'Optional'),
    ]),
    side: faker.helpers.arrayElement(['top', 'right', 'bottom', 'left']),
    align: faker.helpers.arrayElement(['start', 'center', 'end']),
    delay: faker.helpers.arrayElement([0, 200, 400, 700]),
    offset: faker.helpers.arrayElement([0, 4, 8, 12]),
    trigger: faker.helpers.arrayElement(['hover', 'click', 'focus']),
    className: faker.helpers.maybe(() => 'custom-tooltip-class', { probability: 0.1 }),
    ...overrides,
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple fake toast items
 * @param count - Number of toasts to create
 */
export function createFakeToastItems(count: number): FakeToastItem[] {
  return Array.from({ length: count }, () => createFakeToastItem());
}

/**
 * Creates multiple fake sonner toasts
 * @param count - Number of toasts to create
 */
export function createFakeSonnerToasts(count: number): FakeSonnerToast[] {
  return Array.from({ length: count }, () => createFakeSonnerToast());
}

/**
 * Creates multiple fake spinners
 * @param count - Number of spinners to create
 */
export function createFakeSpinners(count: number): FakeSpinner[] {
  return Array.from({ length: count }, () => createFakeSpinner());
}

/**
 * Creates multiple fake skeletons
 * @param count - Number of skeletons to create
 */
export function createFakeSkeletons(count: number): FakeSkeleton[] {
  return Array.from({ length: count }, () => createFakeSkeleton());
}

/**
 * Creates multiple fake feedback progress bars
 * @param count - Number of progress bars to create
 */
export function createFakeFeedbackProgressBars(count: number): FakeFeedbackProgress[] {
  return Array.from({ length: count }, () => createFakeFeedbackProgress());
}

/**
 * Creates multiple fake alerts
 * @param count - Number of alerts to create
 */
export function createFakeFeedbackAlerts(count: number): FakeFeedbackAlert[] {
  return Array.from({ length: count }, () => createFakeFeedbackAlert());
}

/**
 * Creates multiple fake banners
 * @param count - Number of banners to create
 */
export function createFakeBanners(count: number): FakeBanner[] {
  return Array.from({ length: count }, () => createFakeBanner());
}

/**
 * Creates multiple fake empty states
 * @param count - Number of empty states to create
 */
export function createFakeEmptyStates(count: number): FakeEmptyState[] {
  return Array.from({ length: count }, () => createFakeEmptyState());
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a success toast item (prefixed to avoid conflict with notification.factory)
 */
export function createFakeSuccessToastItem(overrides?: Partial<FakeToastItem>): FakeToastItem {
  return createFakeToastItem({
    title: i18n.t('factory.feedback.success', 'Success!'),
    description: i18n.t(
      'factory.feedback.yourChangesHaveBeenSaved',
      'Your changes have been saved.'
    ),
    variant: 'default',
    icon: 'CheckCircle',
    ...overrides,
  });
}

/**
 * Creates an error toast item (prefixed to avoid conflict with notification.factory)
 */
export function createFakeErrorToastItem(overrides?: Partial<FakeToastItem>): FakeToastItem {
  return createFakeToastItem({
    title: LABEL_ERROR,
    description: i18n.t(
      'factory.feedback.somethingWentWrongPleaseTry',
      'Something went wrong. Please try again.'
    ),
    variant: 'destructive',
    icon: 'XCircle',
    ...overrides,
  });
}

/**
 * Creates a warning toast item
 */
export function createFakeWarningToastItem(overrides?: Partial<FakeToastItem>): FakeToastItem {
  return createFakeToastItem({
    title: LABEL_WARNING,
    description: i18n.t('factory.feedback.pleaseReviewYourInput', 'Please review your input.'),
    variant: 'default',
    icon: 'AlertTriangle',
    ...overrides,
  });
}

/**
 * Creates an info toast item
 */
export function createFakeInfoToastItem(overrides?: Partial<FakeToastItem>): FakeToastItem {
  return createFakeToastItem({
    title: LABEL_INFO,
    description: i18n.t('factory.feedback.aNewUpdateIsAvailable', 'A new update is available.'),
    variant: 'default',
    icon: LABEL_INFO,
    ...overrides,
  });
}

/**
 * Creates a success sonner toast
 */
export function createFakeSuccessSonnerToast(
  overrides?: Partial<FakeSonnerToast>
): FakeSonnerToast {
  return createFakeSonnerToast({
    title: i18n.t('factory.feedback.success', 'Success!'),
    description: i18n.t(
      'factory.feedback.operationCompletedSuccessfully',
      'Operation completed successfully.'
    ),
    type: 'success',
    richColors: true,
    ...overrides,
  });
}

/**
 * Creates an error sonner toast
 */
export function createFakeErrorSonnerToast(overrides?: Partial<FakeSonnerToast>): FakeSonnerToast {
  return createFakeSonnerToast({
    title: LABEL_ERROR,
    description: i18n.t('factory.feedback.somethingWentWrong2', 'Something went wrong.'),
    type: 'error',
    richColors: true,
    ...overrides,
  });
}

/**
 * Creates a loading sonner toast
 */
export function createFakeLoadingSonnerToast(
  overrides?: Partial<FakeSonnerToast>
): FakeSonnerToast {
  return createFakeSonnerToast({
    title: LOADING_MESSAGE,
    description: i18n.t('factory.feedback.pleaseWait2', 'Please wait.'),
    type: 'loading',
    promise: true,
    ...overrides,
  });
}

/**
 * Creates a small spinner
 */
export function createFakeSmallSpinner(overrides?: Partial<FakeSpinner>): FakeSpinner {
  return createFakeSpinner({
    size: 'sm',
    ...overrides,
  });
}

/**
 * Creates a large spinner
 */
export function createFakeLargeSpinner(overrides?: Partial<FakeSpinner>): FakeSpinner {
  return createFakeSpinner({
    size: 'lg',
    ...overrides,
  });
}

/**
 * Creates a spinner with label
 */
export function createFakeSpinnerWithLabel(overrides?: Partial<FakeSpinner>): FakeSpinner {
  return createFakeSpinner({
    label: LOADING_MESSAGE,
    centered: true,
    ...overrides,
  });
}

/**
 * Creates a text skeleton
 */
export function createFakeTextSkeleton(overrides?: Partial<FakeSkeleton>): FakeSkeleton {
  return createFakeSkeleton({
    variant: 'text',
    height: 16,
    width: '100%',
    ...overrides,
  });
}

/**
 * Creates a circular skeleton (avatar)
 */
export function createFakeAvatarSkeleton(overrides?: Partial<FakeSkeleton>): FakeSkeleton {
  return createFakeSkeleton({
    variant: 'circular',
    width: 40,
    height: 40,
    ...overrides,
  });
}

/**
 * Creates a card skeleton
 */
export function createFakeCardSkeleton(overrides?: Partial<FakeSkeleton>): FakeSkeleton {
  return createFakeSkeleton({
    variant: 'rectangular',
    width: '100%',
    height: 200,
    borderRadius: 8,
    ...overrides,
  });
}

/**
 * Creates a determinate feedback progress bar
 */
export function createFakeFeedbackDeterminateProgress(
  overrides?: Partial<FakeFeedbackProgress>
): FakeFeedbackProgress {
  return createFakeFeedbackProgress({
    value: faker.number.int({ min: 0, max: 100 }),
    indeterminate: false,
    showValue: true,
    ...overrides,
  });
}

/**
 * Creates an indeterminate feedback progress bar
 */
export function createFakeFeedbackIndeterminateProgress(
  overrides?: Partial<FakeFeedbackProgress>
): FakeFeedbackProgress {
  return createFakeFeedbackProgress({
    indeterminate: true,
    animated: true,
    ...overrides,
  });
}

/**
 * Creates a success feedback progress bar
 */
export function createFakeFeedbackSuccessProgress(
  overrides?: Partial<FakeFeedbackProgress>
): FakeFeedbackProgress {
  return createFakeFeedbackProgress({
    value: 100,
    variant: 'success',
    ...overrides,
  });
}

/**
 * Creates an error feedback progress bar
 */
export function createFakeFeedbackErrorProgress(
  overrides?: Partial<FakeFeedbackProgress>
): FakeFeedbackProgress {
  return createFakeFeedbackProgress({
    value: faker.number.int({ min: 20, max: 80 }),
    variant: 'error',
    ...overrides,
  });
}

/**
 * Creates a success alert
 */
export function createFakeFeedbackSuccessAlert(
  overrides?: Partial<FakeFeedbackAlert>
): FakeFeedbackAlert {
  return createFakeFeedbackAlert({
    title: i18n.t('factory.feedback.success2', 'Success'),
    description: i18n.t(
      'factory.feedback.yourChangesHaveBeenSaved',
      'Your changes have been saved.'
    ),
    variant: 'success',
    icon: 'success',
    ...overrides,
  });
}

/**
 * Creates an error alert
 */
export function createFakeFeedbackErrorAlert(
  overrides?: Partial<FakeFeedbackAlert>
): FakeFeedbackAlert {
  return createFakeFeedbackAlert({
    title: LABEL_ERROR,
    description: i18n.t('factory.feedback.somethingWentWrong2', 'Something went wrong.'),
    variant: 'destructive',
    icon: 'error',
    ...overrides,
  });
}

/**
 * Creates a warning alert
 */
export function createFakeFeedbackWarningAlert(
  overrides?: Partial<FakeFeedbackAlert>
): FakeFeedbackAlert {
  return createFakeFeedbackAlert({
    title: LABEL_WARNING,
    description: i18n.t('factory.feedback.pleaseReviewYourInput', 'Please review your input.'),
    variant: 'warning',
    icon: 'warning',
    ...overrides,
  });
}

/**
 * Creates an info alert
 */
export function createFakeFeedbackInfoAlert(
  overrides?: Partial<FakeFeedbackAlert>
): FakeFeedbackAlert {
  return createFakeFeedbackAlert({
    title: LABEL_INFO,
    description: i18n.t('factory.feedback.aNewUpdateIsAvailable', 'A new update is available.'),
    variant: 'info',
    icon: 'info',
    ...overrides,
  });
}

/**
 * Creates a promotional banner
 */
export function createFakePromotionalBanner(overrides?: Partial<FakeBanner>): FakeBanner {
  return createFakeBanner({
    variant: 'promotional',
    message: i18n.t('factory.feedback.get20OffWithCode', 'Get 20% off with code SAVE20!'),
    action: {
      label: i18n.t('factory.feedback.shopNow', 'Shop now'),
      href: '/shop',
    },
    ...overrides,
  });
}

/**
 * Creates a warning banner
 */
export function createFakeWarningBanner(overrides?: Partial<FakeBanner>): FakeBanner {
  return createFakeBanner({
    variant: 'warning',
    message: i18n.t(
      'factory.feedback.systemMaintenanceScheduledForTonight',
      'System maintenance scheduled for tonight.'
    ),
    closable: true,
    ...overrides,
  });
}

/**
 * Creates an error banner
 */
export function createFakeErrorBanner(overrides?: Partial<FakeBanner>): FakeBanner {
  return createFakeBanner({
    variant: 'error',
    message: i18n.t(
      'factory.feedback.weAreExperiencingTechnicalDifficulties',
      'We are experiencing technical difficulties.'
    ),
    sticky: true,
    ...overrides,
  });
}

/**
 * Creates an idle loading state
 */
export function createFakeIdleLoadingState(
  overrides?: Partial<FakeLoadingState>
): FakeLoadingState {
  return createFakeLoadingState({
    state: 'idle',
    ...overrides,
  });
}

/**
 * Creates an active loading state
 */
export function createFakeActiveLoadingState(
  overrides?: Partial<FakeLoadingState>
): FakeLoadingState {
  return createFakeLoadingState({
    state: 'loading',
    progress: faker.number.int({ min: 0, max: 100 }),
    ...overrides,
  });
}

/**
 * Creates a success loading state
 */
export function createFakeSuccessLoadingState(
  overrides?: Partial<FakeLoadingState>
): FakeLoadingState {
  return createFakeLoadingState({
    state: 'success',
    data: {
      result: i18n.t(
        'factory.feedback.operationCompletedSuccessfully',
        'Operation completed successfully.'
      ),
    },
    ...overrides,
  });
}

/**
 * Creates an error loading state
 */
export function createFakeErrorLoadingState(
  overrides?: Partial<FakeLoadingState>
): FakeLoadingState {
  return createFakeLoadingState({
    state: 'error',
    error: createFakeErrorState(),
    retryCount: faker.number.int({ min: 0, max: 3 }),
    ...overrides,
  });
}

/**
 * Creates a recoverable error state
 */
export function createFakeRecoverableError(overrides?: Partial<FakeErrorState>): FakeErrorState {
  return createFakeErrorState({
    recoverable: true,
    retryAction: 'handleRetry',
    ...overrides,
  });
}

/**
 * Creates a non-recoverable error state
 */
export function createFakeNonRecoverableError(overrides?: Partial<FakeErrorState>): FakeErrorState {
  return createFakeErrorState({
    recoverable: false,
    message: i18n.t(
      'factory.feedback.thisOperationCannotBeRetried',
      'This operation cannot be retried.'
    ),
    ...overrides,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of toasts across all variants
 */
export function createFakeToastVariantMatrix(): Record<ToastVariant, FakeToastItem> {
  const result = {} as Record<ToastVariant, FakeToastItem>;

  for (const variant of TOAST_VARIANTS) {
    result[variant] = createFakeToastItem({ variant });
  }

  return result;
}

/**
 * Creates a matrix of sonner toasts across all types
 */
export function createFakeSonnerToastTypeMatrix(): Record<SonnerToastType, FakeSonnerToast> {
  const result = {} as Record<SonnerToastType, FakeSonnerToast>;

  for (const type of SONNER_TOAST_TYPES) {
    result[type] = createFakeSonnerToast({ type });
  }

  return result;
}

/**
 * Creates a matrix of spinners across all sizes
 */
export function createFakeSpinnerSizeMatrix(): Record<SpinnerSize, FakeSpinner> {
  const result = {} as Record<SpinnerSize, FakeSpinner>;

  for (const size of SPINNER_SIZES) {
    result[size] = createFakeSpinner({ size });
  }

  return result;
}

/**
 * Creates a matrix of skeletons across all variants
 */
export function createFakeSkeletonVariantMatrix(): Record<SkeletonVariant, FakeSkeleton> {
  const result = {} as Record<SkeletonVariant, FakeSkeleton>;

  for (const variant of SKELETON_VARIANTS) {
    result[variant] = createFakeSkeleton({ variant });
  }

  return result;
}

/**
 * Creates a matrix of feedback progress bars across all variants
 */
export function createFakeFeedbackProgressVariantMatrix(): Record<
  FeedbackProgressVariant,
  FakeFeedbackProgress
> {
  const result = {} as Record<FeedbackProgressVariant, FakeFeedbackProgress>;

  for (const variant of FEEDBACK_PROGRESS_VARIANTS) {
    result[variant] = createFakeFeedbackProgress({ variant });
  }

  return result;
}

/**
 * Creates a matrix of feedback progress bars across all sizes
 */
export function createFakeFeedbackProgressSizeMatrix(): Record<
  FeedbackProgressSize,
  FakeFeedbackProgress
> {
  const result = {} as Record<FeedbackProgressSize, FakeFeedbackProgress>;

  for (const size of FEEDBACK_PROGRESS_SIZES) {
    result[size] = createFakeFeedbackProgress({ size });
  }

  return result;
}

/**
 * Creates a matrix of feedback alerts across all variants
 */
export function createFakeFeedbackAlertVariantMatrix(): Record<
  FeedbackAlertVariant,
  FakeFeedbackAlert
> {
  const result = {} as Record<FeedbackAlertVariant, FakeFeedbackAlert>;

  for (const variant of FEEDBACK_ALERT_VARIANTS) {
    result[variant] = createFakeFeedbackAlert({ variant });
  }

  return result;
}

/**
 * Creates a matrix of banners across all variants
 */
export function createFakeBannerVariantMatrix(): Record<BannerVariant, FakeBanner> {
  const result = {} as Record<BannerVariant, FakeBanner>;

  for (const variant of BANNER_VARIANTS) {
    result[variant] = createFakeBanner({ variant });
  }

  return result;
}

/**
 * Creates a matrix of loading states across all states
 */
export function createFakeLoadingStateMatrix(): Record<LoadingState, FakeLoadingState> {
  const result = {} as Record<LoadingState, FakeLoadingState>;

  for (const state of LOADING_STATES) {
    result[state] = createFakeLoadingState({ state });
  }

  return result;
}

/**
 * Creates a matrix of feedback positions
 */
export function createFakeFeedbackPositionMatrix(): Record<FeedbackPosition, FakeSonnerToast> {
  const result = {} as Record<FeedbackPosition, FakeSonnerToast>;

  for (const position of FEEDBACK_POSITIONS) {
    result[position] = createFakeSonnerToast({ position });
  }

  return result;
}

/**
 * Creates a comprehensive feedback demo data set
 */
export function createFakeFeedbackDemoData() {
  return {
    toasts: createFakeToastItems(5),
    sonnerToasts: createFakeSonnerToasts(5),
    spinners: createFakeSpinners(5),
    skeletons: createFakeSkeletons(5),
    skeletonGroups: [createFakeSkeletonGroup()],
    progressBars: createFakeFeedbackProgressBars(5),
    progressSteps: createFakeFeedbackProgressSteps(),
    alerts: createFakeFeedbackAlerts(5),
    banners: createFakeBanners(3),
    loadingOverlay: createFakeLoadingOverlay(),
    loadingStates: LOADING_STATES.map((state) => createFakeLoadingState({ state })),
    emptyStates: createFakeEmptyStates(3),
    errorStates: [createFakeErrorState()],
    badges: [createFakeNotificationBadge()],
    tooltips: [createFakeFeedbackTooltip()],
  };
}
