import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets the progress value for a step based on its position relative to the active step
 * @param stepIndex - The index of the step
 * @param activeStep - The index of the currently active step
 * @returns The progress value (0-100)
 */
function getStepProgress(stepIndex: number, activeStep: number): number {
  if (stepIndex < activeStep) return 100;
  if (stepIndex === activeStep) return faker.number.int({ min: 0, max: 100 });
  return 0;
}

/**
 * Gets the progress state for a step based on its position relative to the active step
 * @param stepIndex - The index of the step
 * @param activeStep - The index of the currently active step
 * @returns The progress state
 */
function getStepState(stepIndex: number, activeStep: number): ProgressState {
  if (stepIndex < activeStep) return 'complete';
  if (stepIndex === activeStep) return 'active';
  return 'idle';
}

// ============================================================================
// PROGRESS FACTORY
// ============================================================================
// Comprehensive test data factories for the Progress component.
// Follows the Button factory pattern with type exports, constants, and
// specialized factories for different progress bar configurations.
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Progress visual variant
 * @description Controls the color/style of the progress indicator
 */
export type ProgressVariant = 'default' | 'error' | 'info' | 'success' | 'warning';

/**
 * Progress size variant
 * @description Controls the height of the progress bar
 */
export type ProgressSize = 'default' | 'lg' | 'sm' | 'xl' | 'xs';

/**
 * Progress state
 * @description The current state of the progress
 */
export type ProgressState = 'active' | 'complete' | 'error' | 'idle' | 'indeterminate' | 'paused';

/**
 * Progress animation type
 * @description Controls the animation behavior
 */
export type ProgressAnimation = 'indeterminate' | 'none' | 'pulse' | 'stripe';

/**
 * Progress label position
 * @description Where the label/value text appears
 */
export type ProgressLabelPosition = 'above' | 'below' | 'inside' | 'none' | 'right';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All progress variants
 */
export const PROGRESS_VARIANTS: ProgressVariant[] = [
  'default',
  'success',
  'warning',
  'error',
  'info',
];

/**
 * All progress sizes
 */
export const PROGRESS_SIZES: ProgressSize[] = ['xs', 'sm', 'default', 'lg', 'xl'];

/**
 * All progress states
 */
export const PROGRESS_STATES: ProgressState[] = [
  'idle',
  'active',
  'paused',
  'complete',
  'error',
  'indeterminate',
];

/**
 * All animation types
 */
export const PROGRESS_ANIMATIONS: ProgressAnimation[] = [
  'none',
  'pulse',
  'stripe',
  'indeterminate',
];

/**
 * All label positions
 */
export const PROGRESS_LABEL_POSITIONS: ProgressLabelPosition[] = [
  'none',
  'above',
  'below',
  'inside',
  'right',
];

/**
 * Indicator color classes for variants
 */
export const VARIANT_COLORS: Record<ProgressVariant, string> = {
  default: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
};

/**
 * Size height classes
 */
export const SIZE_HEIGHTS: Record<ProgressSize, string> = {
  xs: 'h-1',
  sm: 'h-1.5',
  default: 'h-2',
  lg: 'h-3',
  xl: 'h-4',
};

/**
 * Common progress labels
 */
const PROGRESS_LABELS = [
  i18n.t('factory.progress.loading', 'Loading...'),
  i18n.t('factory.progress.uploading', 'Uploading'),
  i18n.t('factory.progress.downloading', 'Downloading'),
  i18n.t('factory.progress.processing', 'Processing'),
  i18n.t('factory.progress.saving', 'Saving'),
  i18n.t('factory.progress.importing', 'Importing'),
  i18n.t('factory.progress.exporting', 'Exporting'),
  i18n.t('factory.progress.installing', 'Installing'),
  i18n.t('factory.progress.syncing', 'Syncing'),
  i18n.t('factory.progress.converting', 'Converting'),
];

/**
 * Task/step labels for multi-step progress
 */
const TASK_LABELS = [
  i18n.t('factory.progress.initializing', 'Initializing'),
  i18n.t('factory.progress.fetchingData', 'Fetching data'),
  i18n.t('factory.progress.processingFiles', 'Processing files'),
  i18n.t('factory.progress.validating', 'Validating'),
  i18n.t('factory.progress.optimizing', 'Optimizing'),
  i18n.t('factory.progress.finalizing', 'Finalizing'),
  i18n.t('factory.progress.complete', 'Complete'),
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Basic progress bar configuration
 */
export interface FakeProgress {
  /** Animation type */
  animation?: ProgressAnimation;
  /** Unique identifier */
  id: string;
  /** Custom indicator color class */
  indicatorColor?: string;
  /** Progress label */
  label?: string;
  /** Label position */
  labelPosition?: ProgressLabelPosition;
  /** Maximum value */
  max: number;
  /** Whether to show percentage text */
  showPercentage?: boolean;
  /** Size variant */
  size?: ProgressSize;
  /** Current state */
  state?: ProgressState;
  /** Current value (0-max) */
  value: number;
  /** Visual variant */
  variant: ProgressVariant;
}

/**
 * Progress with time estimation
 */
export interface FakeProgressWithTime extends FakeProgress {
  /** Elapsed time in milliseconds */
  elapsedTime: number;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
  /** Start timestamp */
  startedAt: Date;
}

/**
 * Multi-step progress configuration
 */
export interface FakeMultiStepProgress {
  /** Current step index (0-based) */
  currentStep: number;
  /** Unique identifier */
  id: string;
  /** Overall progress percentage */
  overallProgress: number;
  /** Progress within current step */
  stepProgress: number;
  /** Array of step configurations */
  steps: FakeProgressStep[];
}

/**
 * Individual step in multi-step progress
 */
export interface FakeProgressStep {
  /** Whether step is complete */
  completed: boolean;
  /** Step description */
  description?: string;
  /** Unique identifier */
  id: string;
  /** Step label */
  label: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Step state */
  state: ProgressState;
}

/**
 * File upload progress
 */
export interface FakeUploadProgress extends FakeProgress {
  /** Bytes uploaded */
  bytesUploaded: number;
  /** File name */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** File type/extension */
  fileType: string;
  /** Upload speed in bytes per second */
  uploadSpeed?: number;
}

/**
 * Circular progress configuration
 */
export interface FakeCircularProgress {
  /** Unique identifier */
  id: string;
  /** Progress label */
  label?: string;
  /** Whether to show center value */
  showValue?: boolean;
  /** Diameter in pixels */
  size: number;
  /** Stroke width in pixels */
  strokeWidth: number;
  /** Current value (0-100) */
  value: number;
  /** Visual variant */
  variant: ProgressVariant;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get indicator color for variant
 */
function getIndicatorColor(variant: ProgressVariant): string {
  return VARIANT_COLORS[variant];
}

/**
 * Calculate percentage from value and max
 */
function calculatePercentage(value: number, max: number): number {
  return Math.round((value / max) * 100);
}

/**
 * Get state for a given progress percentage
 */
function getStateForPercentage(percentage: number): ProgressState {
  if (percentage === 0) return 'idle';
  if (percentage === 100) return 'complete';
  return 'active';
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake progress configuration
 * @param overrides - Optional property overrides
 * @returns A fake progress configuration
 */
export function createFakeProgress(overrides?: Partial<FakeProgress>): FakeProgress {
  const max = overrides?.max ?? 100;
  const value = overrides?.value ?? faker.number.int({ min: 0, max });
  const variant = overrides?.variant ?? faker.helpers.arrayElement(PROGRESS_VARIANTS);

  return {
    id: faker.string.uuid(),
    value,
    max,
    variant,
    indicatorColor: getIndicatorColor(variant),
    label: faker.helpers.maybe(() => faker.helpers.arrayElement(PROGRESS_LABELS), {
      probability: 0.5,
    }),
    size: faker.helpers.arrayElement(PROGRESS_SIZES),
    state: getStateForPercentage(calculatePercentage(value, max)),
    animation: faker.helpers.maybe(() => faker.helpers.arrayElement(PROGRESS_ANIMATIONS), {
      probability: 0.2,
    }),
    showPercentage: faker.datatype.boolean({ probability: 0.5 }),
    labelPosition: faker.helpers.maybe(() => faker.helpers.arrayElement(PROGRESS_LABEL_POSITIONS), {
      probability: 0.4,
    }),
    ...overrides,
  };
}

/**
 * Creates multiple fake progress items
 * @param count - Number of items to create
 * @param overrides - Optional property overrides
 * @returns Array of fake progress configurations
 */
export function createFakeProgressItems(
  count: number,
  overrides?: Partial<FakeProgress>
): FakeProgress[] {
  return Array.from({ length: count }, () => createFakeProgress(overrides));
}

/**
 * Creates a fake progress with time tracking
 * @param overrides - Optional property overrides
 * @returns A fake progress with time configuration
 */
export function createFakeProgressWithTime(
  overrides?: Partial<FakeProgressWithTime>
): FakeProgressWithTime {
  const progress = createFakeProgress(overrides);
  const elapsedTime = faker.number.int({ min: 1000, max: 60_000 });
  const percentComplete = calculatePercentage(progress.value, progress.max);

  // Estimate remaining time based on progress
  const estimatedTotal = percentComplete > 0 ? (elapsedTime / percentComplete) * 100 : undefined;
  const estimatedRemaining = estimatedTotal ? estimatedTotal - elapsedTime : undefined;

  return {
    ...progress,
    startedAt: faker.date.recent({ days: 0.01 }),
    elapsedTime,
    estimatedTimeRemaining: estimatedRemaining ? Math.max(0, estimatedRemaining) : undefined,
    ...overrides,
  };
}

/**
 * Creates a fake progress step
 * @param index - Step index
 * @param overrides - Optional property overrides
 * @returns A fake progress step
 */
export function createFakeProgressStep(
  index: number,
  overrides?: Partial<FakeProgressStep>
): FakeProgressStep {
  const completed = overrides?.completed ?? faker.datatype.boolean({ probability: 0.5 });

  return {
    id: faker.string.uuid(),
    label: TASK_LABELS[index % TASK_LABELS.length],
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    progress: completed ? 100 : faker.number.int({ min: 0, max: 99 }),
    completed,
    state: completed ? 'complete' : 'active',
    ...overrides,
  };
}

/**
 * Creates a fake multi-step progress
 * @param stepCount - Number of steps
 * @param currentStep - Current active step
 * @param overrides - Optional property overrides
 * @returns A fake multi-step progress configuration
 */
export function createFakeMultiStepProgress(
  stepCount: number = 5,
  currentStep?: number,
  overrides?: Partial<FakeMultiStepProgress>
): FakeMultiStepProgress {
  const activeStep = currentStep ?? faker.number.int({ min: 0, max: stepCount - 1 });

  const steps = Array.from({ length: stepCount }, (_, index) =>
    createFakeProgressStep(index, {
      completed: index < activeStep,
      state: getStepState(index, activeStep),
      progress: getStepProgress(index, activeStep),
    })
  );

  const completedSteps = steps.filter((s) => s.completed).length;
  const currentStepProgress = steps[activeStep]?.progress ?? 0;
  const overallProgress = Math.round(
    ((completedSteps + currentStepProgress / 100) / stepCount) * 100
  );

  return {
    id: faker.string.uuid(),
    steps,
    currentStep: activeStep,
    stepProgress: currentStepProgress,
    overallProgress,
    ...overrides,
  };
}

/**
 * Creates a fake file upload progress
 * @param overrides - Optional property overrides
 * @returns A fake upload progress configuration
 */
export function createFakeUploadProgress(
  overrides?: Partial<FakeUploadProgress>
): FakeUploadProgress {
  const fileSize = overrides?.fileSize ?? faker.number.int({ min: 1024, max: 10_485_760 }); // 1KB to 10MB
  const percentage = faker.number.int({ min: 0, max: 100 });
  const bytesUploaded = Math.round((fileSize * percentage) / 100);

  const progress = createFakeProgress({
    value: percentage,
    max: 100,
    label: i18n.t('factory.progress.uploading', 'Uploading'),
    ...overrides,
  });

  return {
    ...progress,
    fileName: faker.system.fileName(),
    fileType: faker.system.fileExt(),
    fileSize,
    bytesUploaded,
    uploadSpeed: faker.helpers.maybe(() => faker.number.int({ min: 10_000, max: 5_000_000 }), {
      probability: 0.7,
    }),
    ...overrides,
  };
}

/**
 * Creates a fake circular progress
 * @param overrides - Optional property overrides
 * @returns A fake circular progress configuration
 */
export function createFakeCircularProgress(
  overrides?: Partial<FakeCircularProgress>
): FakeCircularProgress {
  return {
    id: faker.string.uuid(),
    value: faker.number.int({ min: 0, max: 100 }),
    size: faker.helpers.arrayElement([40, 60, 80, 100, 120]),
    strokeWidth: faker.helpers.arrayElement([4, 6, 8, 10]),
    variant: faker.helpers.arrayElement(PROGRESS_VARIANTS),
    label: faker.helpers.maybe(() => faker.helpers.arrayElement(PROGRESS_LABELS), {
      probability: 0.5,
    }),
    showValue: faker.datatype.boolean({ probability: 0.7 }),
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a progress at 0%
 * @returns A zero progress configuration
 */
export function createFakeZeroProgress(): FakeProgress {
  return createFakeProgress({
    value: 0,
    state: 'idle',
    label: i18n.t('factory.progress.notStarted', 'Not started'),
  });
}

/**
 * Creates a completed progress (100%)
 * @returns A complete progress configuration
 */
export function createFakeCompleteProgress(): FakeProgress {
  return createFakeProgress({
    value: 100,
    state: 'complete',
    variant: 'success',
    label: i18n.t('factory.progress.complete', 'Complete'),
  });
}

/**
 * Creates an error progress
 * @returns An error progress configuration
 */
export function createFakeErrorProgress(): FakeProgress {
  return createFakeProgress({
    value: faker.number.int({ min: 20, max: 80 }),
    state: 'error',
    variant: 'error',
    label: i18n.t('factory.progress.errorOccurred', 'Error occurred'),
  });
}

/**
 * Creates an indeterminate progress
 * @returns An indeterminate progress configuration
 */
export function createFakeIndeterminateProgress(): FakeProgress {
  return createFakeProgress({
    value: 0,
    state: 'indeterminate',
    animation: 'indeterminate',
    label: i18n.t('factory.progress.loading', 'Loading...'),
  });
}

/**
 * Creates a paused progress
 * @returns A paused progress configuration
 */
export function createFakePausedProgress(): FakeProgress {
  return createFakeProgress({
    value: faker.number.int({ min: 30, max: 70 }),
    state: 'paused',
    animation: 'none',
    label: i18n.t('factory.progress.paused', 'Paused'),
  });
}

/**
 * Creates progress showing different percentage values
 * @returns Array of progress at different percentages
 */
export function createFakeProgressPercentages(): FakeProgress[] {
  const percentages = [0, 25, 50, 75, 100];
  return percentages.map((value) =>
    createFakeProgress({
      value,
      state: getStateForPercentage(value),
      showPercentage: true,
    })
  );
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of progress variants
 * @returns Grid of progress configs for each variant
 */
export function createProgressVariantMatrix(): FakeProgress[] {
  return PROGRESS_VARIANTS.map((variant) =>
    createFakeProgress({
      variant,
      value: 60,
      indicatorColor: getIndicatorColor(variant),
    })
  );
}

/**
 * Creates a matrix of progress sizes
 * @returns Grid of progress configs for each size
 */
export function createProgressSizeMatrix(): FakeProgress[] {
  return PROGRESS_SIZES.map((size) =>
    createFakeProgress({
      size,
      value: 50,
    })
  );
}

/**
 * Creates a matrix of progress states
 * @returns Grid of progress configs for each state
 */
/**
 * Gets the progress value for a given state
 * @param state - The progress state
 * @returns The progress value
 */
function getProgressValueForState(state: ProgressState): number {
  if (state === 'complete') return 100;
  if (state === 'idle') return 0;
  return 50;
}

export function createProgressStateMatrix(): FakeProgress[] {
  return PROGRESS_STATES.map((state) => {
    const value = getProgressValueForState(state);
    return createFakeProgress({
      state,
      value,
      animation: state === 'indeterminate' ? 'indeterminate' : 'none',
    });
  });
}

/**
 * Creates a matrix of progress animations
 * @returns Grid of progress configs for each animation
 */
export function createProgressAnimationMatrix(): FakeProgress[] {
  return PROGRESS_ANIMATIONS.map((animation) =>
    createFakeProgress({
      animation,
      value: animation === 'indeterminate' ? 0 : 50,
      state: animation === 'indeterminate' ? 'indeterminate' : 'active',
    })
  );
}

/**
 * Creates a full variant x size matrix
 * @returns Grid of all variant/size combinations
 */
export function createProgressVariantSizeMatrix(): FakeProgress[][] {
  return PROGRESS_VARIANTS.map((variant) =>
    PROGRESS_SIZES.map((size) =>
      createFakeProgress({
        variant,
        size,
        value: 60,
        indicatorColor: getIndicatorColor(variant),
      })
    )
  );
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all progress configurations
 * @returns Array of progress configs for showcase
 */
export function createProgressShowcase(): Array<{
  description: string;
  name: string;
  progress: FakeMultiStepProgress | FakeProgress | FakeUploadProgress;
}> {
  return [
    {
      name: i18n.t('factory.progress.default', 'Default'),
      description: i18n.t(
        'factory.progress.standardProgressBarAt50',
        'Standard progress bar at 50%'
      ),
      progress: createFakeProgress({ value: 50 }),
    },
    {
      name: i18n.t('factory.progress.complete', 'Complete'),
      description: i18n.t(
        'factory.progress.completedProgressWithSuccessVariant',
        'Completed progress with success variant'
      ),
      progress: createFakeCompleteProgress(),
    },
    {
      name: i18n.t('factory.progress.zero', 'Zero'),
      description: i18n.t('factory.progress.progressNotYetStarted', 'Progress not yet started'),
      progress: createFakeZeroProgress(),
    },
    {
      name: i18n.t('factory.progress.error', 'Error'),
      description: i18n.t('factory.progress.progressWithErrorState', 'Progress with error state'),
      progress: createFakeErrorProgress(),
    },
    {
      name: i18n.t('factory.progress.indeterminate', 'Indeterminate'),
      description: i18n.t(
        'factory.progress.loadingAnimationForUnknownDuration',
        'Loading animation for unknown duration'
      ),
      progress: createFakeIndeterminateProgress(),
    },
    {
      name: i18n.t('factory.progress.paused', 'Paused'),
      description: i18n.t('factory.progress.pausedProgressOperation', 'Paused progress operation'),
      progress: createFakePausedProgress(),
    },
    {
      name: i18n.t('factory.progress.multiStep', 'Multi-Step'),
      description: i18n.t('factory.progress.multistepWizardProgress', 'Multi-step wizard progress'),
      progress: createFakeMultiStepProgress(5, 2),
    },
    {
      name: i18n.t('factory.progress.fileUpload', 'File Upload'),
      description: i18n.t(
        'factory.progress.fileUploadProgressWithMetadata',
        'File upload progress with metadata'
      ),
      progress: createFakeUploadProgress(),
    },
  ];
}

/**
 * Creates a complete test data set for progress testing
 * @returns Comprehensive test data
 */
export function createProgressTestData(): {
  animationMatrix: FakeProgress[];
  circularProgress: FakeCircularProgress[];
  multiStep: FakeMultiStepProgress[];
  percentages: FakeProgress[];
  progressItems: FakeProgress[];
  showcase: Array<{
    description: string;
    name: string;
    progress: FakeMultiStepProgress | FakeProgress | FakeUploadProgress;
  }>;
  sizeMatrix: FakeProgress[];
  stateMatrix: FakeProgress[];
  uploadProgress: FakeUploadProgress[];
  variantMatrix: FakeProgress[];
  variantSizeMatrix: FakeProgress[][];
  withTime: FakeProgressWithTime[];
} {
  return {
    progressItems: createFakeProgressItems(5),
    withTime: Array.from({ length: 3 }, () => createFakeProgressWithTime()),
    multiStep: Array.from({ length: 3 }, () => createFakeMultiStepProgress()),
    uploadProgress: Array.from({ length: 3 }, () => createFakeUploadProgress()),
    circularProgress: Array.from({ length: 3 }, () => createFakeCircularProgress()),
    percentages: createFakeProgressPercentages(),
    variantMatrix: createProgressVariantMatrix(),
    sizeMatrix: createProgressSizeMatrix(),
    stateMatrix: createProgressStateMatrix(),
    animationMatrix: createProgressAnimationMatrix(),
    variantSizeMatrix: createProgressVariantSizeMatrix(),
    showcase: createProgressShowcase(),
  };
}
