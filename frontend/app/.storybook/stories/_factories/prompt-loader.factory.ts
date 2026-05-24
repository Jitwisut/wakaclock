import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ TYPE DEFINITIONS ============

/** Loader variant type */
export type LoaderVariant =
  | 'bars'
  | 'circular'
  | 'classic'
  | 'dots'
  | 'loading-dots'
  | 'pulse-dot'
  | 'pulse'
  | 'terminal'
  | 'text-blink'
  | 'text-shimmer'
  | 'typing'
  | 'wave';

/** Loader size type */
export type LoaderSize = 'lg' | 'md' | 'sm';

/** Interface for fake prompt loader data */
export interface FakePromptLoader {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Accessible text */
  loadingText: string;
  /** Loader size */
  size: LoaderSize;
  /** Loader variant */
  variant: LoaderVariant;
}

/** Interface for loader configuration */
export interface FakePromptLoaderConfig {
  /** Custom CSS class */
  className: string;
  /** Display size */
  size: LoaderSize;
  /** Accessible text */
  text: string;
  /** Loader variant */
  variant: LoaderVariant;
}

// ============ CONSTANTS FOR ITERATION ============

/** All loader variant options */
export const LOADER_VARIANTS: LoaderVariant[] = [
  'bars',
  'circular',
  'classic',
  'dots',
  'loading-dots',
  'pulse',
  'pulse-dot',
  'terminal',
  'text-blink',
  'text-shimmer',
  'typing',
  'wave',
];

/** All loader size options */
export const LOADER_SIZES: LoaderSize[] = ['lg', 'md', 'sm'];

/** Common loading text options */
export const LOADER_TEXTS = [
  i18n.t('factory.promptLoader.loading', 'Loading'),
  i18n.t('factory.promptLoader.processing', 'Processing'),
  i18n.t('factory.promptLoader.thinking', 'Thinking'),
  i18n.t('factory.promptLoader.generating', 'Generating'),
  i18n.t('factory.promptLoader.analyzing', 'Analyzing'),
  i18n.t('factory.promptLoader.pleaseWait', 'Please wait'),
];

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake prompt loader
 * @param overrides - Optional partial overrides
 * @returns A fake prompt loader
 */
export function createFakePromptLoader(overrides?: Partial<FakePromptLoader>): FakePromptLoader {
  const variant = faker.helpers.arrayElement(LOADER_VARIANTS);

  return {
    id: faker.string.uuid(),
    label: variant,
    variant,
    size: faker.helpers.arrayElement(LOADER_SIZES),
    loadingText: faker.helpers.arrayElement(LOADER_TEXTS),
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake prompt loaders
 * @param count - Number of loaders to generate
 * @returns Array of fake prompt loaders
 */
export function createFakePromptLoaders(count: number): FakePromptLoader[] {
  return Array.from({ length: count }, () => createFakePromptLoader());
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a text-based loader
 * @param text - Loading text
 * @returns A text variant loader
 */
export function createFakeTextLoader(text?: string): FakePromptLoader {
  return createFakePromptLoader({
    variant: faker.helpers.arrayElement(['text-blink', 'text-shimmer', 'loading-dots']),
    loadingText: text ?? faker.helpers.arrayElement(LOADER_TEXTS),
  });
}

/**
 * Creates a spinner-based loader
 * @param size - Loader size
 * @returns A spinner variant loader
 */
export function createFakeSpinnerLoader(size?: LoaderSize): FakePromptLoader {
  return createFakePromptLoader({
    variant: faker.helpers.arrayElement(['circular', 'classic', 'pulse']),
    size: size ?? 'md',
  });
}

/**
 * Creates loaders for all variants
 * @returns Array with one loader per variant
 */
export function createFakePromptLoadersByVariant(): FakePromptLoader[] {
  return LOADER_VARIANTS.map((variant) =>
    createFakePromptLoader({
      id: `loader-${variant}`,
      variant,
      label: variant,
    })
  );
}

/**
 * Creates a loader configuration
 * @param scenario - Configuration scenario
 * @returns Loader configuration
 */
export function createFakePromptLoaderConfig(
  scenario: 'default' | 'large' | 'text' = 'default'
): FakePromptLoaderConfig {
  const configs: Record<string, FakePromptLoaderConfig> = {
    default: {
      variant: 'circular',
      size: 'md',
      text: i18n.t('factory.promptLoader.loading', 'Loading'),
      className: '',
    },
    large: {
      variant: 'dots',
      size: 'lg',
      text: i18n.t('factory.promptLoader.processing', 'Processing'),
      className: 'text-primary',
    },
    text: {
      variant: 'text-shimmer',
      size: 'md',
      text: i18n.t('factory.promptLoader.thinking', 'Thinking'),
      className: 'font-medium',
    },
  };

  return configs[scenario];
}
