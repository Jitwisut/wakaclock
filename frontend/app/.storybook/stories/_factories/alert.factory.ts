import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Alert visual variant (matches component variants) */
export type AlertVariant = 'default' | 'destructive';

/** Alert semantic type for extended styling purposes */
export type AlertType = 'default' | 'destructive' | 'info' | 'success' | 'warning';

/** Alert size variant for layout */
export type AlertSize = 'compact' | 'default' | 'fullWidth';

/** Alert icon type for common use cases */
export type AlertIconType = 'alertCircle' | 'alertTriangle' | 'checkCircle' | 'info' | 'xCircle';

/** Alert position for toast-style notifications */
export type AlertPosition =
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'top-left'
  | 'top-right';

/** Alert animation type */
export type AlertAnimation = 'fade' | 'none' | 'scale' | 'slide';

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACE (Shape of Generated Data)
// ═══════════════════════════════════════════════════════════════════════════

/** Interface for fake alert data */
export interface FakeAlert {
  /** Alert animation type */
  animation?: AlertAnimation;
  /** Auto-dismiss timeout in ms (0 = no auto-dismiss) */
  autoCloseMs?: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Alert description/content */
  description: string;
  /** Whether alert can be dismissed */
  dismissible: boolean;
  /** Optional icon type */
  icon?: AlertIconType;
  /** Unique identifier */
  id: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Alert position for toast-style */
  position?: AlertPosition;
  /** Priority level (affects styling and ordering) */
  priority?: 'high' | 'low' | 'medium';
  /** Whether to show progress bar for auto-close */
  showProgress?: boolean;
  /** Alert size variant */
  size?: AlertSize;
  /** Custom test ID */
  testId?: string;
  /** Alert title/heading */
  title: string;
  /** Semantic type (for custom styling) */
  type?: AlertType;
  /** Visual variant */
  variant: AlertVariant;
}

/** Interface for alert configuration */
export interface FakeAlertConfig {
  /** Animation type */
  animation: AlertAnimation;
  /** Auto-close duration */
  autoCloseMs: number;
  /** Whether dismissible */
  dismissible: boolean;
  /** Position for toast-style */
  position: AlertPosition;
  /** Whether to show icon */
  showIcon: boolean;
  /** Whether to show progress bar */
  showProgress: boolean;
  /** Size variant */
  size: AlertSize;
  /** Visual variant */
  variant: AlertVariant;
}

/** Interface for alert action button */
export interface FakeAlertAction {
  /** Button label */
  label: string;
  /** Whether primary action */
  primary?: boolean;
  /** Button variant */
  variant?: 'default' | 'destructive' | 'ghost' | 'link' | 'outline';
}

/** Interface for alert with actions */
export interface FakeAlertWithActions extends FakeAlert {
  /** Action buttons */
  actions?: FakeAlertAction[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS FOR ITERATION
// ═══════════════════════════════════════════════════════════════════════════

/** All alert variant options */
export const ALERT_VARIANTS: AlertVariant[] = ['default', 'destructive'];

/** All alert semantic types (for custom styling) */
export const ALERT_TYPES: AlertType[] = ['default', 'destructive', 'info', 'success', 'warning'];

/** All alert size options */
export const ALERT_SIZES: AlertSize[] = ['compact', 'default', 'fullWidth'];

/** All alert icon options */
export const ALERT_ICONS: AlertIconType[] = [
  'alertCircle',
  'alertTriangle',
  'checkCircle',
  'info',
  'xCircle',
];

/** All alert position options */
export const ALERT_POSITIONS: AlertPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

/** All alert animation options */
export const ALERT_ANIMATIONS: AlertAnimation[] = ['none', 'fade', 'slide', 'scale'];

/** Common alert titles for realistic test data */
export const ALERT_TITLES = [
  i18n.t('factory.alert.headsUp', 'Heads up!'),
  i18n.t('factory.alert.somethingWentWrong', 'Something went wrong'),
  i18n.t('factory.alert.success', 'Success!'),
  i18n.t('factory.alert.warning', 'Warning'),
  i18n.t('factory.alert.information', 'Information'),
  i18n.t('factory.alert.actionRequired', 'Action required'),
  i18n.t('factory.alert.updateAvailable', 'Update available'),
  i18n.t('factory.alert.connectionLost', 'Connection lost'),
  i18n.t('factory.alert.changesSaved', 'Changes saved'),
  i18n.t('factory.alert.pleaseReview', 'Please review'),
  i18n.t('factory.alert.note', 'Note'),
  i18n.t('factory.alert.important', 'Important'),
  i18n.t('factory.alert.errorOccurred', 'Error occurred'),
  i18n.t('factory.alert.tip', 'Tip'),
  i18n.t('factory.alert.attention', 'Attention'),
];

/** Common alert descriptions */
export const ALERT_DESCRIPTIONS = [
  i18n.t('factory.alert.thisIsAnImportantNotification', 'This is an important notification.'),
  i18n.t('factory.alert.pleaseCheckYourInputAnd', 'Please check your input and try again.'),
  i18n.t('factory.alert.yourChangesHaveBeenSaved', 'Your changes have been saved successfully.'),
  i18n.t(
    'factory.alert.thisActionMayHaveUnintended',
    'This action may have unintended consequences.'
  ),
  i18n.t('factory.alert.hereIsSomeHelpfulInformation', 'Here is some helpful information for you.'),
  i18n.t('factory.alert.pleaseCompleteThisActionTo', 'Please complete this action to continue.'),
  i18n.t('factory.alert.aNewVersionIsAvailable', 'A new version is available for download.'),
  i18n.t(
    'factory.alert.pleaseCheckYourInternetConnection',
    'Please check your internet connection.'
  ),
  i18n.t('factory.alert.allYourChangesHaveBeen', 'All your changes have been saved.'),
  i18n.t(
    'factory.alert.pleaseReviewTheDetailsBefore',
    'Please review the details before proceeding.'
  ),
  i18n.t(
    'factory.alert.youCanAddComponentsTo',
    'You can add components to your app using the CLI.'
  ),
  i18n.t('factory.alert.thisOperationCannotBeUndone', 'This operation cannot be undone.'),
  i18n.t('factory.alert.yourSessionWillExpireIn', 'Your session will expire in 5 minutes.'),
  i18n.t('factory.alert.saveYourWorkToAvoid', 'Save your work to avoid losing changes.'),
  i18n.t('factory.alert.contactSupportIfTheProblem', 'Contact support if the problem persists.'),
];

/** Auto-close duration options in ms */
export const AUTO_CLOSE_DURATIONS = [0, 3000, 5000, 8000, 10_000, 15_000];

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE ITEM FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a single fake alert
 * @param overrides - Optional partial overrides for the generated alert
 * @returns A fake alert
 */
export function createFakeAlert(overrides?: Partial<FakeAlert>): FakeAlert {
  const variant = overrides?.variant ?? faker.helpers.arrayElement(ALERT_VARIANTS);
  const dismissible = overrides?.dismissible ?? faker.datatype.boolean();

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement(ALERT_TITLES),
    description: faker.helpers.arrayElement(ALERT_DESCRIPTIONS),
    variant,
    type: faker.helpers.arrayElement(ALERT_TYPES),
    dismissible,
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(ALERT_ICONS), { probability: 0.7 }),
    autoCloseMs: faker.helpers.maybe(() => faker.helpers.arrayElement(AUTO_CLOSE_DURATIONS), {
      probability: 0.3,
    }),
    size: faker.helpers.maybe(() => faker.helpers.arrayElement(ALERT_SIZES), { probability: 0.3 }),
    position: faker.helpers.maybe(() => faker.helpers.arrayElement(ALERT_POSITIONS), {
      probability: 0.2,
    }),
    animation: faker.helpers.maybe(() => faker.helpers.arrayElement(ALERT_ANIMATIONS), {
      probability: 0.3,
    }),
    priority: faker.helpers.maybe(
      () => faker.helpers.arrayElement<'high' | 'low' | 'medium'>(['low', 'medium', 'high']),
      { probability: 0.3 }
    ),
    showProgress: dismissible && faker.datatype.boolean({ probability: 0.3 }),
    createdAt: faker.date.recent(),
    testId: `alert-${faker.string.alphanumeric(6)}`,
    metadata: faker.helpers.maybe(
      () => ({
        source: faker.helpers.arrayElement(['system', 'user', 'api', 'webhook']),
        category: faker.helpers.arrayElement(['notification', 'warning', 'error', 'info']),
      }),
      { probability: 0.2 }
    ),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BULK FACTORY (For Lists/Tables)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates multiple fake alerts
 * @param count - Number of alerts to generate
 * @param overrides - Optional partial overrides for all generated alerts
 * @returns Array of fake alerts
 */
export function createFakeAlerts(count: number, overrides?: Partial<FakeAlert>): FakeAlert[] {
  return Array.from({ length: count }, () => createFakeAlert(overrides));
}

// ═══════════════════════════════════════════════════════════════════════════
// SPECIALIZED FACTORIES (For Specific Scenarios)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates an error/destructive alert
 * @returns A destructive alert
 */
export function createFakeErrorAlert(): FakeAlert {
  return createFakeAlert({
    title: faker.helpers.arrayElement([
      i18n.t('factory.alert.errorOccurred', 'Error occurred'),
      i18n.t('factory.alert.somethingWentWrong', 'Something went wrong'),
      i18n.t('factory.alert.failedToCompleteAction', 'Failed to complete action'),
      i18n.t('factory.alert.connectionError', 'Connection error'),
      i18n.t('factory.alert.requestFailed', 'Request failed'),
    ]),
    description: faker.helpers.arrayElement([
      i18n.t('factory.alert.pleaseTryAgainLater', 'Please try again later.'),
      i18n.t('factory.alert.checkYourInputAndTry', 'Check your input and try again.'),
      i18n.t(
        'factory.alert.contactSupportIfTheProblem',
        'Contact support if the problem persists.'
      ),
      i18n.t('factory.alert.anUnexpectedErrorOccurred', 'An unexpected error occurred.'),
      i18n.t('factory.alert.unableToProcessYourRequest', 'Unable to process your request.'),
    ]),
    variant: 'destructive',
    type: 'destructive',
    icon: 'alertCircle',
    dismissible: true,
    priority: 'high',
  });
}

/**
 * Creates a success alert
 * @returns A success-styled alert (using default variant with success type)
 */
export function createFakeSuccessAlert(): FakeAlert {
  return createFakeAlert({
    title: faker.helpers.arrayElement([
      i18n.t('factory.alert.success', 'Success!'),
      i18n.t('factory.alert.changesSaved', 'Changes saved'),
      i18n.t('factory.alert.actionCompleted', 'Action completed'),
      i18n.t('factory.alert.uploadSuccessful', 'Upload successful'),
      i18n.t('factory.alert.operationCompleted', 'Operation completed'),
    ]),
    description: faker.helpers.arrayElement([
      i18n.t(
        'factory.alert.yourChangesHaveBeenSaved',
        'Your changes have been saved successfully.'
      ),
      i18n.t(
        'factory.alert.theActionWasCompletedWithout',
        'The action was completed without errors.'
      ),
      i18n.t('factory.alert.allItemsHaveBeenUpdated', 'All items have been updated.'),
      i18n.t('factory.alert.yourDataHasBeenProcessed', 'Your data has been processed.'),
      i18n.t('factory.alert.everythingIsWorkingAsExpected', 'Everything is working as expected.'),
    ]),
    variant: 'default',
    type: 'success',
    icon: 'checkCircle',
    dismissible: true,
    autoCloseMs: 5000,
    showProgress: true,
    priority: 'medium',
  });
}

/**
 * Creates a warning alert
 * @returns A warning-styled alert
 */
export function createFakeWarningAlert(): FakeAlert {
  return createFakeAlert({
    title: faker.helpers.arrayElement([
      i18n.t('factory.alert.warning', 'Warning'),
      i18n.t('factory.alert.caution', 'Caution'),
      i18n.t('factory.alert.attentionRequired', 'Attention required'),
      i18n.t('factory.alert.pleaseReview', 'Please review'),
      i18n.t('factory.alert.importantNotice', 'Important notice'),
    ]),
    description: faker.helpers.arrayElement([
      i18n.t('factory.alert.thisActionCannotBeUndone', 'This action cannot be undone.'),
      i18n.t('factory.alert.pleaseVerifyBeforeContinuing', 'Please verify before continuing.'),
      i18n.t('factory.alert.someDataMayBeAffected', 'Some data may be affected.'),
      i18n.t('factory.alert.proceedWithCaution', 'Proceed with caution.'),
      i18n.t('factory.alert.reviewTheChangesCarefully', 'Review the changes carefully.'),
    ]),
    variant: 'default',
    type: 'warning',
    icon: 'alertTriangle',
    dismissible: false,
    priority: 'high',
  });
}

/**
 * Creates an info alert
 * @returns An informational alert
 */
export function createFakeInfoAlert(): FakeAlert {
  return createFakeAlert({
    title: faker.helpers.arrayElement([
      i18n.t('factory.alert.didYouKnow', 'Did you know?'),
      i18n.t('factory.alert.tip', 'Tip'),
      i18n.t('factory.alert.information', 'Information'),
      i18n.t('factory.alert.note', 'Note'),
      i18n.t('factory.alert.hint', 'Hint'),
    ]),
    description: faker.helpers.arrayElement([
      i18n.t(
        'factory.alert.youCanUseKeyboardShortcuts',
        'You can use keyboard shortcuts for faster navigation.'
      ),
      i18n.t('factory.alert.hoverOverItemsForMore', 'Hover over items for more details.'),
      i18n.t(
        'factory.alert.settingsCanBeCustomizedIn',
        'Settings can be customized in preferences.'
      ),
      i18n.t(
        'factory.alert.checkOutOurDocumentationFor',
        'Check out our documentation for more help.'
      ),
      i18n.t('factory.alert.thisFeatureIsAvailableTo', 'This feature is available to all users.'),
    ]),
    variant: 'default',
    type: 'info',
    icon: 'info',
    dismissible: true,
    priority: 'low',
  });
}

/**
 * Creates a system notification alert
 * @returns A system notification style alert
 */
export function createFakeSystemAlert(): FakeAlert {
  return createFakeAlert({
    title: faker.helpers.arrayElement([
      i18n.t('factory.alert.maintenanceScheduled', 'Maintenance scheduled'),
      i18n.t('factory.alert.updateAvailable', 'Update available'),
      i18n.t('factory.alert.newFeatureReleased', 'New feature released'),
      i18n.t('factory.alert.systemNotice', 'System notice'),
      i18n.t('factory.alert.serviceAnnouncement', 'Service announcement'),
    ]),
    description: faker.helpers.arrayElement([
      i18n.t(
        'factory.alert.theSystemWillBeDown',
        'The system will be down for maintenance at midnight.'
      ),
      i18n.t('factory.alert.aNewVersionOfThe', 'A new version of the application is available.'),
      i18n.t('factory.alert.checkOutTheNewFeatures', 'Check out the new features in this release.'),
      i18n.t(
        'factory.alert.pleaseUpdateYourPreferencesTo',
        'Please update your preferences to continue.'
      ),
      i18n.t(
        'factory.alert.importantChangesToOurTerms',
        'Important changes to our terms of service.'
      ),
    ]),
    variant: 'default',
    type: 'info',
    icon: 'info',
    dismissible: true,
    autoCloseMs: 10_000,
    showProgress: true,
    priority: 'medium',
    metadata: {
      source: 'system',
      category: 'notification',
    },
  });
}

/**
 * Creates a dismissible alert with action
 * @returns A dismissible alert with action button
 */
export function createFakeDismissibleAlert(): FakeAlert {
  return createFakeAlert({
    dismissible: true,
    autoCloseMs: 0,
    showProgress: false,
  });
}

/**
 * Creates an auto-closing alert
 * @param durationMs - Auto-close duration in milliseconds
 * @returns An alert that auto-closes
 */
export function createFakeAutoCloseAlert(durationMs: number = 5000): FakeAlert {
  return createFakeAlert({
    dismissible: true,
    autoCloseMs: durationMs,
    showProgress: true,
    animation: 'fade',
  });
}

/**
 * Creates a compact alert
 * @returns A compact-sized alert
 */
export function createFakeCompactAlert(): FakeAlert {
  return createFakeAlert({
    size: 'compact',
    dismissible: false,
    icon: undefined, // Compact alerts typically don't have icons
  });
}

/**
 * Creates a full-width alert
 * @returns A full-width alert
 */
export function createFakeFullWidthAlert(): FakeAlert {
  return createFakeAlert({
    size: 'fullWidth',
    dismissible: true,
  });
}

/**
 * Creates alerts for all semantic types
 * @returns Array with one alert of each type
 */
export function createFakeAlertsByType(): FakeAlert[] {
  return [
    createFakeAlert({
      variant: 'default',
      type: 'default',
      title: i18n.t('factory.alert.defaultAlert', 'Default Alert'),
      icon: 'info',
    }),
    createFakeErrorAlert(),
    createFakeSuccessAlert(),
    createFakeWarningAlert(),
    createFakeInfoAlert(),
  ];
}

/**
 * Creates alerts for all variants
 * @returns Array with one alert of each variant
 */
export function createFakeAlertsByVariant(): FakeAlert[] {
  return ALERT_VARIANTS.map((variant) =>
    createFakeAlert({
      variant,
      title: i18n.t('factory.alert.variantAlert', '{{variant}} Alert', {
        variant: variant.charAt(0).toUpperCase() + variant.slice(1),
      }),
    })
  );
}

/**
 * Creates alerts for all sizes
 * @returns Array with one alert of each size
 */
export function createFakeAlertsBySizes(): FakeAlert[] {
  return ALERT_SIZES.map((size) =>
    createFakeAlert({
      size,
      title: i18n.t('factory.alert.sizeAlert', '{{size}} Alert', {
        size: size.charAt(0).toUpperCase() + size.slice(1),
      }),
    })
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ALERT WITH ACTIONS FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates an alert with action buttons
 * @param actionCount - Number of action buttons
 * @returns An alert with action buttons
 */
export function createFakeAlertWithActions(actionCount: number = 2): FakeAlertWithActions {
  const actionLabels = [
    i18n.t('factory.alert.dismiss', 'Dismiss'),
    i18n.t('factory.alert.learnMore', 'Learn more'),
    i18n.t('factory.alert.undo', 'Undo'),
    i18n.t('factory.alert.retry', 'Retry'),
    i18n.t('factory.alert.viewDetails', 'View details'),
    i18n.t('factory.alert.contactSupport', 'Contact support'),
  ];

  const actions: FakeAlertAction[] = Array.from({ length: actionCount }, (_, index) => ({
    label: actionLabels[index % actionLabels.length],
    variant: index === 0 ? 'default' : 'ghost',
    primary: index === 0,
  }));

  return {
    ...createFakeAlert({ dismissible: true }),
    actions,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MATRIX FACTORIES (For Visual Regression)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a matrix of alerts for visual regression testing
 * across all variant and size combinations
 * @returns 2D array of alerts [variant][size]
 */
export function createFakeAlertMatrix(): FakeAlert[][] {
  return ALERT_VARIANTS.map((variant) =>
    ALERT_SIZES.map((size) => ({
      id: `${variant}-${size}`,
      title: i18n.t('factory.alert.variantSizeTitle', '{{variant}} ({{size}})', {
        variant: variant.charAt(0).toUpperCase() + variant.slice(1),
        size,
      }),
      description: i18n.t(
        'factory.alert.variantSizeDescription',
        'A {{variant}} alert displayed at {{size}} size.',
        { variant, size }
      ),
      variant,
      dismissible: true,
      icon: variant === 'destructive' ? 'alertCircle' : 'info',
      size,
      createdAt: new Date(),
    }))
  );
}

/**
 * Creates a matrix of alerts by type
 * @returns 2D array of alerts [type][dismissible]
 */
export function createFakeAlertTypeMatrix(): FakeAlert[][] {
  return ALERT_TYPES.map((type) =>
    [true, false].map((dismissible) =>
      createFakeAlert({
        type,
        variant: type === 'destructive' ? 'destructive' : 'default',
        dismissible,
        title: i18n.t('factory.alert.typeAlert', '{{type}} Alert', {
          type: type.charAt(0).toUpperCase() + type.slice(1),
        }),
        description: dismissible
          ? i18n.t('factory.alert.thisAlertCanBeDismissed', 'This alert can be dismissed.')
          : i18n.t('factory.alert.thisAlertCannotBeDismissed', 'This alert cannot be dismissed.'),
      })
    )
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates alert configuration for different scenarios
 * @param scenario - Scenario name
 * @returns Alert configuration
 */
export function createFakeAlertConfig(
  scenario: 'autoClose' | 'compact' | 'default' | 'dismissible' | 'toast' = 'default'
): FakeAlertConfig {
  const configs: Record<string, FakeAlertConfig> = {
    default: {
      variant: 'default',
      size: 'default',
      dismissible: false,
      showIcon: true,
      autoCloseMs: 0,
      showProgress: false,
      animation: 'none',
      position: 'top-right',
    },
    dismissible: {
      variant: 'default',
      size: 'default',
      dismissible: true,
      showIcon: true,
      autoCloseMs: 0,
      showProgress: false,
      animation: 'fade',
      position: 'top-right',
    },
    autoClose: {
      variant: 'default',
      size: 'default',
      dismissible: true,
      showIcon: true,
      autoCloseMs: 5000,
      showProgress: true,
      animation: 'slide',
      position: 'top-right',
    },
    compact: {
      variant: 'default',
      size: 'compact',
      dismissible: false,
      showIcon: false,
      autoCloseMs: 0,
      showProgress: false,
      animation: 'none',
      position: 'top-right',
    },
    toast: {
      variant: 'default',
      size: 'default',
      dismissible: true,
      showIcon: true,
      autoCloseMs: 5000,
      showProgress: true,
      animation: 'slide',
      position: 'bottom-right',
    },
  };

  return configs[scenario];
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTERPRISE FEATURE FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a toast-style notification alert
 * @param position - Toast position
 * @returns A toast-style alert
 */
export function createFakeToastAlert(position: AlertPosition = 'bottom-right'): FakeAlert {
  return createFakeAlert({
    position,
    animation: 'slide',
    autoCloseMs: 5000,
    showProgress: true,
    dismissible: true,
    size: 'default',
  });
}

/**
 * Creates a high-priority alert
 * @returns A high-priority alert
 */
export function createFakeHighPriorityAlert(): FakeAlert {
  return createFakeAlert({
    priority: 'high',
    variant: 'destructive',
    dismissible: false,
    autoCloseMs: 0,
    icon: 'alertCircle',
  });
}

/**
 * Creates an accessible alert with all ARIA attributes
 * @returns An accessible alert
 */
export function createFakeAccessibleAlert(): FakeAlert {
  return createFakeAlert({
    testId: 'accessible-alert',
    dismissible: true,
    icon: 'info',
    metadata: {
      ariaLive: 'polite',
      ariaAtomic: true,
      role: 'alert',
    },
  });
}

/**
 * Creates all enterprise alert types for testing
 * @returns Array of enterprise alerts
 */
export function createFakeEnterpriseAlertSet(): FakeAlert[] {
  return [
    createFakeErrorAlert(),
    createFakeSuccessAlert(),
    createFakeWarningAlert(),
    createFakeInfoAlert(),
    createFakeSystemAlert(),
    createFakeDismissibleAlert(),
    createFakeAutoCloseAlert(),
    createFakeToastAlert(),
    createFakeHighPriorityAlert(),
    createFakeAccessibleAlert(),
  ];
}
