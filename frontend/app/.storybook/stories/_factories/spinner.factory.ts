/**
 * Spinner Component Factory
 *
 * Generates fake data for Spinner component stories and tests.
 * Supports various sizes, colors, and loading context configurations.
 *
 * @module spinner.factory
 */
import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// SHARED STRING CONSTANTS
// ============================================================================

const LABEL_LOADING = i18n.t('factory.spinner.loading2', 'Loading');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Spinner size options (using Tailwind classes)
 */
export type SpinnerSize = 'size-10' | 'size-12' | 'size-16' | 'size-4' | 'size-6' | 'size-8';

/**
 * Spinner color variants
 */
export type SpinnerColor =
  | 'current'
  | 'destructive'
  | 'muted'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning';

/**
 * Loading context types
 */
export type LoadingContext =
  | 'button'
  | 'card'
  | 'form'
  | 'fullpage'
  | 'inline'
  | 'modal'
  | 'overlay'
  | 'table';

/**
 * Loading state types
 */
export type LoadingState = 'complete' | 'error' | 'loading' | 'processing' | 'saving' | 'syncing';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All spinner sizes
 */
export const SPINNER_SIZES: SpinnerSize[] = [
  'size-4',
  'size-6',
  'size-8',
  'size-10',
  'size-12',
  'size-16',
];

/**
 * All spinner colors
 */
export const SPINNER_COLORS: SpinnerColor[] = [
  'current',
  'destructive',
  'muted',
  'primary',
  'secondary',
  'success',
  'warning',
];

/**
 * All loading contexts
 */
export const LOADING_CONTEXTS: LoadingContext[] = [
  'button',
  'card',
  'form',
  'fullpage',
  'inline',
  'modal',
  'overlay',
  'table',
];

/**
 * All loading states
 */
export const LOADING_STATES: LoadingState[] = [
  'complete',
  'error',
  'loading',
  'processing',
  'saving',
  'syncing',
];

/**
 * Size to pixel mapping
 */
export const SPINNER_SIZE_PIXELS: Record<SpinnerSize, number> = {
  'size-10': 40,
  'size-12': 48,
  'size-16': 64,
  'size-4': 16,
  'size-6': 24,
  'size-8': 32,
};

/**
 * Color to Tailwind class mapping
 */
export const SPINNER_COLOR_CLASSES: Record<SpinnerColor, string> = {
  current: '',
  destructive: 'text-destructive',
  muted: 'text-muted-foreground',
  primary: 'text-primary',
  secondary: 'text-secondary-foreground',
  success: 'text-green-500',
  warning: 'text-yellow-500',
};

/**
 * Loading messages by state
 */
export const LOADING_MESSAGES: Record<LoadingState, string[]> = {
  complete: [
    i18n.t('factory.spinner.complete', 'Complete!'),
    i18n.t('factory.spinner.done', 'Done!'),
    i18n.t('factory.spinner.finished', 'Finished!'),
    i18n.t('factory.spinner.success', 'Success!'),
    i18n.t('factory.spinner.allDone', 'All done!'),
  ],
  error: [
    i18n.t('factory.spinner.failed', 'Failed'),
    i18n.t('factory.spinner.errorOccurred', 'Error occurred'),
    i18n.t('factory.spinner.somethingWentWrong', 'Something went wrong'),
    i18n.t('factory.spinner.unableToComplete', 'Unable to complete'),
    i18n.t('factory.spinner.tryAgain', 'Try again'),
  ],
  loading: [
    i18n.t('factory.spinner.loading', 'Loading...'),
    i18n.t('factory.spinner.pleaseWait', 'Please wait...'),
    i18n.t('factory.spinner.fetchingData', 'Fetching data...'),
    i18n.t('factory.spinner.loadingContent', 'Loading content...'),
    i18n.t('factory.spinner.justAMoment', 'Just a moment...'),
  ],
  processing: [
    i18n.t('factory.spinner.processing', 'Processing...'),
    i18n.t('factory.spinner.workingOnIt', 'Working on it...'),
    i18n.t('factory.spinner.analyzing', 'Analyzing...'),
    i18n.t('factory.spinner.computing', 'Computing...'),
    i18n.t('factory.spinner.running', 'Running...'),
  ],
  saving: [
    i18n.t('factory.spinner.saving', 'Saving...'),
    i18n.t('factory.spinner.savingChanges', 'Saving changes...'),
    i18n.t('factory.spinner.updating', 'Updating...'),
    i18n.t('factory.spinner.committingChanges', 'Committing changes...'),
    i18n.t('factory.spinner.almostThere', 'Almost there...'),
  ],
  syncing: [
    i18n.t('factory.spinner.syncing', 'Syncing...'),
    i18n.t('factory.spinner.synchronizing', 'Synchronizing...'),
    i18n.t('factory.spinner.updatingData', 'Updating data...'),
    i18n.t('factory.spinner.syncingChanges', 'Syncing changes...'),
    i18n.t('factory.spinner.connecting', 'Connecting...'),
  ],
};

/**
 * Context-specific aria labels
 */
export const CONTEXT_ARIA_LABELS: Record<LoadingContext, string> = {
  button: i18n.t('factory.spinner.buttonLoading', 'Button loading'),
  card: i18n.t('factory.spinner.loadingCardContent', 'Loading card content'),
  form: i18n.t('factory.spinner.submittingForm', 'Submitting form'),
  fullpage: i18n.t('factory.spinner.loadingPage', 'Loading page'),
  inline: LABEL_LOADING,
  modal: i18n.t('factory.spinner.loadingDialogContent', 'Loading dialog content'),
  overlay: i18n.t('factory.spinner.processing2', 'Processing'),
  table: i18n.t('factory.spinner.loadingTableData', 'Loading table data'),
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base spinner configuration
 */
export interface FakeSpinner {
  ariaLabel: string;
  className: string;
  color: SpinnerColor;
  id: string;
  size: SpinnerSize;
  testId: string;
}

/**
 * Spinner with loading context
 */
export interface FakeSpinnerWithContext extends FakeSpinner {
  context: LoadingContext;
  message?: string;
  progress?: number;
  state: LoadingState;
}

/**
 * Spinner in button context
 */
export interface FakeButtonSpinner extends FakeSpinner {
  buttonDisabled: boolean;
  buttonText: string;
  buttonVariant: 'default' | 'destructive' | 'ghost' | 'outline' | 'secondary';
}

/**
 * Spinner with progress indicator
 */
export interface FakeProgressSpinner extends FakeSpinner {
  current: number;
  max: number;
  showPercentage: boolean;
}

/**
 * Full page loading spinner
 */
export interface FakeFullPageSpinner extends FakeSpinner {
  backdrop: boolean;
  description?: string;
  title: string;
}

/**
 * Inline loading spinner
 */
export interface FakeInlineSpinner extends FakeSpinner {
  message: string;
  showMessage: boolean;
}

/**
 * Card loading spinner
 */
export interface FakeCardSpinner extends FakeSpinner {
  cardHeight: string;
  cardWidth: string;
  subtitle?: string;
  title?: string;
}

/**
 * Table loading spinner
 */
export interface FakeTableSpinner extends FakeSpinner {
  columnCount: number;
  rowCount: number;
  showHeaders: boolean;
}

// ============================================================================
// BASE FACTORIES
// ============================================================================

/**
 * Create a basic fake spinner
 */
export function createFakeSpinner(overrides?: Partial<FakeSpinner>): FakeSpinner {
  const size = overrides?.size ?? faker.helpers.arrayElement(SPINNER_SIZES);
  const color = overrides?.color ?? faker.helpers.arrayElement(SPINNER_COLORS);

  return {
    ariaLabel: overrides?.ariaLabel ?? LABEL_LOADING,
    className: `${size} ${SPINNER_COLOR_CLASSES[color]}`.trim(),
    color,
    id: faker.string.uuid(),
    size,
    testId: `spinner-${faker.string.alphanumeric(8)}`,
    ...overrides,
  };
}

/**
 * Create multiple fake spinners
 */
export function createFakeSpinners(count: number, overrides?: Partial<FakeSpinner>): FakeSpinner[] {
  return Array.from({ length: count }, () => createFakeSpinner(overrides));
}

// ============================================================================
// SIZE-SPECIFIC FACTORIES
// ============================================================================

/**
 * Create a small spinner (size-4)
 */
export function createFakeSmallSpinner(overrides?: Partial<FakeSpinner>): FakeSpinner {
  return createFakeSpinner({ size: 'size-4', ...overrides });
}

/**
 * Create a medium spinner (size-6)
 */
export function createFakeMediumSpinner(overrides?: Partial<FakeSpinner>): FakeSpinner {
  return createFakeSpinner({ size: 'size-6', ...overrides });
}

/**
 * Create a large spinner (size-8)
 */
export function createFakeLargeSpinner(overrides?: Partial<FakeSpinner>): FakeSpinner {
  return createFakeSpinner({ size: 'size-8', ...overrides });
}

/**
 * Create an extra large spinner (size-12)
 */
export function createFakeXLSpinner(overrides?: Partial<FakeSpinner>): FakeSpinner {
  return createFakeSpinner({ size: 'size-12', ...overrides });
}

// ============================================================================
// CONTEXT-SPECIFIC FACTORIES
// ============================================================================

/**
 * Create a spinner with loading context
 */
export function createFakeSpinnerWithContext(
  context: LoadingContext,
  overrides?: Partial<FakeSpinnerWithContext>
): FakeSpinnerWithContext {
  const state = overrides?.state ?? faker.helpers.arrayElement(LOADING_STATES);

  return {
    ...createFakeSpinner(overrides),
    context,
    message: faker.helpers.maybe(() => faker.helpers.arrayElement(LOADING_MESSAGES[state]), {
      probability: 0.7,
    }),
    progress: faker.helpers.maybe(() => faker.number.int({ min: 0, max: 100 }), {
      probability: 0.3,
    }),
    state,
    ...overrides,
  };
}

/**
 * Create a button spinner
 */
export function createFakeButtonSpinner(overrides?: Partial<FakeButtonSpinner>): FakeButtonSpinner {
  return {
    ...createFakeSpinner({ size: 'size-4', ...overrides }),
    buttonDisabled: true,
    buttonText: faker.helpers.arrayElement([
      i18n.t('factory.spinner.loading', 'Loading...'),
      i18n.t('factory.spinner.processing', 'Processing...'),
      i18n.t('factory.spinner.saving', 'Saving...'),
      i18n.t('factory.spinner.pleaseWait', 'Please wait...'),
    ]),
    buttonVariant: faker.helpers.arrayElement([
      'default',
      'destructive',
      'ghost',
      'outline',
      'secondary',
    ]),
    ...overrides,
  };
}

/**
 * Create a progress spinner
 */
export function createFakeProgressSpinner(
  overrides?: Partial<FakeProgressSpinner>
): FakeProgressSpinner {
  const max = overrides?.max ?? 100;
  const current = overrides?.current ?? faker.number.int({ min: 0, max });

  return {
    ...createFakeSpinner({ size: 'size-16', ...overrides }),
    current,
    max,
    showPercentage: faker.datatype.boolean({ probability: 0.8 }),
    ...overrides,
  };
}

/**
 * Create a full page spinner
 */
export function createFakeFullPageSpinner(
  overrides?: Partial<FakeFullPageSpinner>
): FakeFullPageSpinner {
  return {
    ...createFakeSpinner({ size: 'size-12', ...overrides }),
    backdrop: faker.datatype.boolean({ probability: 0.7 }),
    description: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.spinner.pleaseWaitWhileWeFetch', 'Please wait while we fetch your data'),
          i18n.t('factory.spinner.loadingYourContent', 'Loading your content'),
          i18n.t('factory.spinner.thisMayTakeAMoment', 'This may take a moment'),
          i18n.t('factory.spinner.preparingYourWorkspace', 'Preparing your workspace'),
        ]),
      { probability: 0.6 }
    ),
    title: faker.helpers.arrayElement([
      LABEL_LOADING,
      i18n.t('factory.spinner.pleaseWait2', 'Please wait'),
      i18n.t('factory.spinner.loadingContent2', 'Loading content'),
      i18n.t('factory.spinner.fetchingData2', 'Fetching data'),
    ]),
    ...overrides,
  };
}

/**
 * Create an inline spinner
 */
export function createFakeInlineSpinner(overrides?: Partial<FakeInlineSpinner>): FakeInlineSpinner {
  return {
    ...createFakeSpinner({ size: 'size-4', ...overrides }),
    message: faker.helpers.arrayElement([
      i18n.t('factory.spinner.fetchingUserData', 'Fetching user data...'),
      i18n.t('factory.spinner.processingYourRequest', 'Processing your request...'),
      i18n.t('factory.spinner.syncingInBackground', 'Syncing in background...'),
      i18n.t('factory.spinner.loadingItems', 'Loading items...'),
      i18n.t('factory.spinner.updating', 'Updating...'),
    ]),
    showMessage: true,
    ...overrides,
  };
}

/**
 * Create a card spinner
 */
export function createFakeCardSpinner(overrides?: Partial<FakeCardSpinner>): FakeCardSpinner {
  return {
    ...createFakeSpinner({ size: 'size-8', ...overrides }),
    cardHeight: faker.helpers.arrayElement(['200px', '250px', '300px', 'auto']),
    cardWidth: faker.helpers.arrayElement(['300px', '350px', '400px', '100%']),
    subtitle: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.spinner.pleaseWaitWhileWeLoad', 'Please wait while we load your data'),
          i18n.t('factory.spinner.fetchingContent', 'Fetching content...'),
          i18n.t('factory.spinner.almostThere', 'Almost there...'),
        ]),
      { probability: 0.5 }
    ),
    title: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          LABEL_LOADING,
          i18n.t('factory.spinner.pleaseWait2', 'Please wait'),
          i18n.t('factory.spinner.loadingContent2', 'Loading content'),
        ]),
      {
        probability: 0.7,
      }
    ),
    ...overrides,
  };
}

/**
 * Create a table spinner
 */
export function createFakeTableSpinner(overrides?: Partial<FakeTableSpinner>): FakeTableSpinner {
  return {
    ...createFakeSpinner({ size: 'size-6', ...overrides }),
    columnCount: faker.number.int({ min: 3, max: 8 }),
    rowCount: faker.number.int({ min: 5, max: 15 }),
    showHeaders: true,
    ...overrides,
  };
}

// ============================================================================
// STATE-SPECIFIC FACTORIES
// ============================================================================

/**
 * Create a loading state spinner
 */
export function createFakeLoadingSpinner(
  overrides?: Partial<FakeSpinnerWithContext>
): FakeSpinnerWithContext {
  return createFakeSpinnerWithContext('inline', {
    state: 'loading',
    message: faker.helpers.arrayElement(LOADING_MESSAGES.loading),
    ...overrides,
  });
}

/**
 * Create a processing state spinner
 */
export function createFakeProcessingSpinner(
  overrides?: Partial<FakeSpinnerWithContext>
): FakeSpinnerWithContext {
  return createFakeSpinnerWithContext('overlay', {
    state: 'processing',
    message: faker.helpers.arrayElement(LOADING_MESSAGES.processing),
    ...overrides,
  });
}

/**
 * Create a saving state spinner
 */
export function createFakeSavingSpinner(
  overrides?: Partial<FakeSpinnerWithContext>
): FakeSpinnerWithContext {
  return createFakeSpinnerWithContext('button', {
    state: 'saving',
    message: faker.helpers.arrayElement(LOADING_MESSAGES.saving),
    ...overrides,
  });
}

/**
 * Create a syncing state spinner
 */
export function createFakeSyncingSpinner(
  overrides?: Partial<FakeSpinnerWithContext>
): FakeSpinnerWithContext {
  return createFakeSpinnerWithContext('inline', {
    state: 'syncing',
    message: faker.helpers.arrayElement(LOADING_MESSAGES.syncing),
    color: 'muted',
    ...overrides,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Create a matrix of spinners by size
 */
export function createSpinnerSizeMatrix(): {
  pixels: number;
  size: SpinnerSize;
  spinner: FakeSpinner;
}[] {
  return SPINNER_SIZES.map((size) => ({
    pixels: SPINNER_SIZE_PIXELS[size],
    size,
    spinner: createFakeSpinner({ size }),
  }));
}

/**
 * Create a matrix of spinners by color
 */
export function createSpinnerColorMatrix(): {
  className: string;
  color: SpinnerColor;
  spinner: FakeSpinner;
}[] {
  return SPINNER_COLORS.map((color) => ({
    className: SPINNER_COLOR_CLASSES[color],
    color,
    spinner: createFakeSpinner({ color }),
  }));
}

/**
 * Create a matrix of spinners by context
 */
export function createSpinnerContextMatrix(): {
  context: LoadingContext;
  spinner: FakeSpinnerWithContext;
}[] {
  return LOADING_CONTEXTS.map((context) => ({
    context,
    spinner: createFakeSpinnerWithContext(context),
  }));
}

/**
 * Create a matrix of spinners by state
 */
export function createSpinnerStateMatrix(): {
  spinner: FakeSpinnerWithContext;
  state: LoadingState;
}[] {
  return LOADING_STATES.map((state) => ({
    spinner: createFakeSpinnerWithContext('inline', { state }),
    state,
  }));
}

// ============================================================================
// SHOWCASE FACTORIES
// ============================================================================

/**
 * Create comprehensive spinner test data
 */
export function createSpinnerTestData(): {
  basic: FakeSpinner;
  button: FakeButtonSpinner;
  card: FakeCardSpinner;
  destructive: FakeSpinner;
  fullPage: FakeFullPageSpinner;
  inline: FakeInlineSpinner;
  large: FakeSpinner;
  loading: FakeSpinnerWithContext;
  medium: FakeSpinner;
  muted: FakeSpinner;
  primary: FakeSpinner;
  processing: FakeSpinnerWithContext;
  progress: FakeProgressSpinner;
  saving: FakeSpinnerWithContext;
  small: FakeSpinner;
  syncing: FakeSpinnerWithContext;
  table: FakeTableSpinner;
  xl: FakeSpinner;
} {
  return {
    basic: createFakeSpinner(),
    button: createFakeButtonSpinner(),
    card: createFakeCardSpinner(),
    destructive: createFakeSpinner({ color: 'destructive' }),
    fullPage: createFakeFullPageSpinner(),
    inline: createFakeInlineSpinner(),
    large: createFakeLargeSpinner(),
    loading: createFakeLoadingSpinner(),
    medium: createFakeMediumSpinner(),
    muted: createFakeSpinner({ color: 'muted' }),
    primary: createFakeSpinner({ color: 'primary' }),
    processing: createFakeProcessingSpinner(),
    progress: createFakeProgressSpinner(),
    saving: createFakeSavingSpinner(),
    small: createFakeSmallSpinner(),
    syncing: createFakeSyncingSpinner(),
    table: createFakeTableSpinner(),
    xl: createFakeXLSpinner(),
  };
}

/**
 * Create a showcase of all spinner variants
 */
export function createSpinnerShowcase(): {
  colorMatrix: ReturnType<typeof createSpinnerColorMatrix>;
  contextMatrix: ReturnType<typeof createSpinnerContextMatrix>;
  sizeMatrix: ReturnType<typeof createSpinnerSizeMatrix>;
  stateMatrix: ReturnType<typeof createSpinnerStateMatrix>;
  testData: ReturnType<typeof createSpinnerTestData>;
} {
  return {
    colorMatrix: createSpinnerColorMatrix(),
    contextMatrix: createSpinnerContextMatrix(),
    sizeMatrix: createSpinnerSizeMatrix(),
    stateMatrix: createSpinnerStateMatrix(),
    testData: createSpinnerTestData(),
  };
}
