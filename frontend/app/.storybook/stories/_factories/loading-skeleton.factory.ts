/**
 * LoadingSkeleton Component Factory
 *
 * Generates fake data for LoadingSkeleton component stories and tests.
 * Supports various layout variants, row configurations, and edge cases.
 *
 * @module loading-skeleton.factory
 */
import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Skeleton layout variant
 */
export type SkeletonVariant = 'card' | 'list' | 'table' | 'text';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All skeleton variants
 */
export const SKELETON_VARIANTS: SkeletonVariant[] = ['card', 'list', 'table', 'text'];

/**
 * Common row counts for testing
 */
export const SKELETON_ROW_COUNTS: number[] = [1, 2, 3, 5, 7, 10];

/**
 * Default row count
 */
export const SKELETON_DEFAULT_ROWS = 3;

/**
 * Default variant
 */
export const SKELETON_DEFAULT_VARIANT: SkeletonVariant = 'list';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Fake loading skeleton configuration
 */
export interface FakeLoadingSkeleton {
  className?: string;
  id: string;
  rows: number;
  showHeader: boolean;
  testId: string;
  variant: SkeletonVariant;
}

// ============================================================================
// BASE FACTORIES
// ============================================================================

/**
 * Create a fake loading skeleton config
 */
export function createFakeLoadingSkeleton(
  overrides?: Partial<FakeLoadingSkeleton>
): FakeLoadingSkeleton {
  return {
    className: faker.helpers.maybe(() => 'p-4', { probability: 0.3 }),
    id: faker.string.uuid(),
    rows: faker.helpers.arrayElement(SKELETON_ROW_COUNTS),
    showHeader: faker.datatype.boolean(),
    testId: `skeleton-${faker.string.alphanumeric(8)}`,
    variant: faker.helpers.arrayElement(SKELETON_VARIANTS),
    ...overrides,
  };
}

/**
 * Create multiple fake loading skeletons
 */
export function createFakeLoadingSkeletons(
  count: number,
  overrides?: Partial<FakeLoadingSkeleton>
): FakeLoadingSkeleton[] {
  return Array.from({ length: count }, () => createFakeLoadingSkeleton(overrides));
}

// ============================================================================
// VARIANT FACTORIES
// ============================================================================

/**
 * Create skeleton with specific variant
 */
export function createFakeSkeletonForVariant(
  variant: SkeletonVariant,
  overrides?: Partial<FakeLoadingSkeleton>
): FakeLoadingSkeleton {
  return createFakeLoadingSkeleton({ variant, ...overrides });
}

/**
 * Create skeleton with header
 */
export function createFakeSkeletonWithHeader(
  overrides?: Partial<FakeLoadingSkeleton>
): FakeLoadingSkeleton {
  return createFakeLoadingSkeleton({ showHeader: true, ...overrides });
}

/**
 * Create skeleton without header
 */
export function createFakeSkeletonWithoutHeader(
  overrides?: Partial<FakeLoadingSkeleton>
): FakeLoadingSkeleton {
  return createFakeLoadingSkeleton({ showHeader: false, ...overrides });
}

/**
 * Create skeleton with many rows (edge case)
 */
export function createFakeSkeletonManyRows(
  overrides?: Partial<FakeLoadingSkeleton>
): FakeLoadingSkeleton {
  return createFakeLoadingSkeleton({ rows: 10, showHeader: true, ...overrides });
}

/**
 * Create skeleton with single row (edge case)
 */
export function createFakeSkeletonSingleRow(
  overrides?: Partial<FakeLoadingSkeleton>
): FakeLoadingSkeleton {
  return createFakeLoadingSkeleton({ rows: 1, showHeader: false, ...overrides });
}

/**
 * Create skeleton with custom class
 */
export function createFakeSkeletonWithClassName(
  overrides?: Partial<FakeLoadingSkeleton>
): FakeLoadingSkeleton {
  return createFakeLoadingSkeleton({
    className: i18n.t(
      'factory.loadingSkeleton.maxwmdMxautoP4BorderRoundedlg',
      'max-w-md mx-auto p-4 border rounded-lg'
    ),
    ...overrides,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Create skeletons for all variants
 */
export function createSkeletonVariantMatrix(): {
  skeleton: FakeLoadingSkeleton;
  variant: SkeletonVariant;
}[] {
  return SKELETON_VARIANTS.map((variant) => ({
    skeleton: createFakeSkeletonForVariant(variant),
    variant,
  }));
}

/**
 * Create variant × header matrix
 */
export function createSkeletonVariantHeaderMatrix(): {
  showHeader: boolean;
  skeleton: FakeLoadingSkeleton;
  variant: SkeletonVariant;
}[] {
  const results: {
    showHeader: boolean;
    skeleton: FakeLoadingSkeleton;
    variant: SkeletonVariant;
  }[] = [];

  for (const variant of SKELETON_VARIANTS) {
    for (const showHeader of [false, true]) {
      results.push({
        showHeader,
        skeleton: createFakeLoadingSkeleton({ variant, showHeader }),
        variant,
      });
    }
  }

  return results;
}

/**
 * Create row count matrix for a single variant
 */
export function createSkeletonRowMatrix(variant: SkeletonVariant = 'list'): {
  rows: number;
  skeleton: FakeLoadingSkeleton;
}[] {
  return SKELETON_ROW_COUNTS.map((rows) => ({
    rows,
    skeleton: createFakeLoadingSkeleton({ variant, rows }),
  }));
}

// ============================================================================
// SHOWCASE FACTORIES
// ============================================================================

/**
 * Create comprehensive test data
 */
export function createLoadingSkeletonTestData(): {
  basic: FakeLoadingSkeleton;
  manyRows: FakeLoadingSkeleton;
  rowMatrix: ReturnType<typeof createSkeletonRowMatrix>;
  singleRow: FakeLoadingSkeleton;
  variantMatrix: ReturnType<typeof createSkeletonVariantMatrix>;
  withClassName: FakeLoadingSkeleton;
  withHeader: FakeLoadingSkeleton;
  withoutHeader: FakeLoadingSkeleton;
} {
  return {
    basic: createFakeLoadingSkeleton(),
    manyRows: createFakeSkeletonManyRows(),
    rowMatrix: createSkeletonRowMatrix(),
    singleRow: createFakeSkeletonSingleRow(),
    variantMatrix: createSkeletonVariantMatrix(),
    withClassName: createFakeSkeletonWithClassName(),
    withHeader: createFakeSkeletonWithHeader(),
    withoutHeader: createFakeSkeletonWithoutHeader(),
  };
}

/**
 * Create showcase of all skeleton configurations
 */
export function createLoadingSkeletonShowcase(): {
  testData: ReturnType<typeof createLoadingSkeletonTestData>;
  variantHeaderMatrix: ReturnType<typeof createSkeletonVariantHeaderMatrix>;
  variantMatrix: ReturnType<typeof createSkeletonVariantMatrix>;
} {
  return {
    testData: createLoadingSkeletonTestData(),
    variantHeaderMatrix: createSkeletonVariantHeaderMatrix(),
    variantMatrix: createSkeletonVariantMatrix(),
  };
}
