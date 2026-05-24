import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// PAGINATION FACTORY
// ============================================================================
// Comprehensive test data factories for the Pagination component.
// Follows the Button factory pattern with type exports, constants, and
// specialized factories for different pagination configurations.
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Pagination size variants
 * @description Controls the visual size of pagination controls
 */
export type PaginationSize = 'default' | 'lg' | 'sm';

/**
 * Pagination variant styles
 * @description Controls the visual appearance of pagination
 */
export type PaginationVariant = 'default' | 'minimal' | 'rounded';

/**
 * Pagination layout styles
 * @description Controls how pagination elements are arranged
 */
export type PaginationLayout = 'compact' | 'full' | 'simple';

/**
 * Page item type
 * @description Distinguishes between page numbers and ellipsis markers
 */
export type PageItemType = 'ellipsis-end' | 'ellipsis-start' | 'number';

/**
 * Pagination state
 * @description Represents the current interaction state
 */
export type PaginationState = 'default' | 'disabled' | 'loading';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All available pagination sizes
 */
export const PAGINATION_SIZES: PaginationSize[] = ['sm', 'default', 'lg'];

/**
 * All pagination variants
 */
export const PAGINATION_VARIANTS: PaginationVariant[] = ['default', 'minimal', 'rounded'];

/**
 * All pagination layouts
 */
export const PAGINATION_LAYOUTS: PaginationLayout[] = ['simple', 'compact', 'full'];

/**
 * All page item types
 */
export const PAGE_ITEM_TYPES: PageItemType[] = ['number', 'ellipsis-start', 'ellipsis-end'];

/**
 * All pagination states
 */
export const PAGINATION_STATES: PaginationState[] = ['default', 'disabled', 'loading'];

/**
 * Common total page counts for testing
 */
export const COMMON_PAGE_COUNTS = [1, 3, 5, 7, 10, 15, 20, 50, 100, 500, 1000];

/**
 * Common items per page options
 */
export const ITEMS_PER_PAGE_OPTIONS = [5, 10, 15, 20, 25, 50, 100];

/**
 * Default sibling counts for pagination
 */
export const SIBLING_COUNT_OPTIONS = [0, 1, 2, 3];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Represents a single page item (number or ellipsis)
 */
export interface FakePageItem {
  /** Unique identifier */
  id: string;
  /** Whether this is the active/current page */
  isActive?: boolean;
  /** Whether this page is disabled */
  isDisabled?: boolean;
  /** Page label for display */
  label: string;
  /** Page number (undefined for ellipsis) */
  pageNumber?: number;
  /** Item type */
  type: PageItemType;
}

/**
 * Represents pagination configuration
 */
export interface FakePaginationConfig {
  /** Current active page (1-indexed) */
  currentPage: number;
  /** Whether to show first/last page buttons */
  hasFirstLast: boolean;
  /** Whether to show prev/next buttons */
  hasPrevNext: boolean;
  /** Unique identifier */
  id: string;
  /** Whether pagination is disabled */
  isDisabled: boolean;
  /** Items per page count */
  itemsPerPage: number;
  /** Layout style */
  layout: PaginationLayout;
  /** Generated page items to display */
  pageItems: FakePageItem[];
  /** Number of sibling pages to show on each side */
  siblingCount: number;
  /** Size variant */
  size: PaginationSize;
  /** Total number of items */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
  /** Visual variant */
  variant: PaginationVariant;
}

/**
 * Represents pagination with metadata for data tables
 */
export interface FakeTablePagination extends FakePaginationConfig {
  /** End index (1-indexed) */
  endIndex: number;
  /** Total count of filtered items (may differ from totalItems) */
  filteredCount?: number;
  /** Whether there's a next page */
  hasNextPage: boolean;
  /** Whether there's a previous page */
  hasPreviousPage: boolean;
  /** Selected items per page option */
  selectedPerPage: number;
  /** Start index (1-indexed) */
  startIndex: number;
}

/**
 * Represents pagination state for infinite scroll
 */
export interface FakeInfiniteScrollPagination {
  /** Cursor for next page */
  cursor?: string;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Unique identifier */
  id: string;
  /** Whether currently loading */
  isLoading: boolean;
  /** Number of items loaded so far */
  loadedCount: number;
  /** Items per page/batch */
  pageSize: number;
  /** Total count (if known) */
  totalCount?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generates page items array for a given configuration
 */
function generatePageItems(
  currentPage: number,
  totalPages: number,
  siblingCount: number
): FakePageItem[] {
  const items: FakePageItem[] = [];

  if (totalPages <= 1) {
    return [
      {
        id: faker.string.uuid(),
        type: 'number',
        pageNumber: 1,
        label: '1',
        isActive: true,
      },
    ];
  }

  // Always add first page
  items.push({
    id: faker.string.uuid(),
    type: 'number',
    pageNumber: 1,
    label: '1',
    isActive: currentPage === 1,
  });

  // Calculate range around current page
  const leftSibling = Math.max(2, currentPage - siblingCount);
  const rightSibling = Math.min(totalPages - 1, currentPage + siblingCount);

  // Add start ellipsis if needed
  if (leftSibling > 2) {
    items.push({
      id: faker.string.uuid(),
      type: 'ellipsis-start',
      label: '...',
    });
  }

  // Add pages in range
  for (let i = leftSibling; i <= rightSibling; i++) {
    if (i !== 1 && i !== totalPages) {
      items.push({
        id: faker.string.uuid(),
        type: 'number',
        pageNumber: i,
        label: String(i),
        isActive: currentPage === i,
      });
    }
  }

  // Add end ellipsis if needed
  if (rightSibling < totalPages - 1) {
    items.push({
      id: faker.string.uuid(),
      type: 'ellipsis-end',
      label: '...',
    });
  }

  // Always add last page if more than 1
  if (totalPages > 1) {
    items.push({
      id: faker.string.uuid(),
      type: 'number',
      pageNumber: totalPages,
      label: String(totalPages),
      isActive: currentPage === totalPages,
    });
  }

  return items;
}

/**
 * Calculate total pages from items
 */
function calculateTotalPages(totalItems: number, itemsPerPage: number): number {
  return Math.max(1, Math.ceil(totalItems / itemsPerPage));
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake page item
 * @param type - Item type (number or ellipsis)
 * @param overrides - Optional property overrides
 * @returns A fake page item
 */
export function createFakePageItem(
  type: PageItemType = 'number',
  overrides?: Partial<FakePageItem>
): FakePageItem {
  if (type === 'ellipsis-start' || type === 'ellipsis-end') {
    return {
      id: faker.string.uuid(),
      type,
      label: '...',
      ...overrides,
    };
  }

  const pageNumber = overrides?.pageNumber ?? faker.number.int({ min: 1, max: 100 });
  return {
    id: faker.string.uuid(),
    type: 'number',
    pageNumber,
    label: String(pageNumber),
    isActive: faker.datatype.boolean({ probability: 0.1 }),
    isDisabled: faker.datatype.boolean({ probability: 0.05 }),
    ...overrides,
  };
}

/**
 * Creates a fake pagination configuration
 * @param overrides - Optional property overrides
 * @returns A fake pagination configuration
 */
export function createFakePaginationConfig(
  overrides?: Partial<FakePaginationConfig>
): FakePaginationConfig {
  const totalItems = overrides?.totalItems ?? faker.number.int({ min: 10, max: 500 });
  const itemsPerPage =
    overrides?.itemsPerPage ?? faker.helpers.arrayElement(ITEMS_PER_PAGE_OPTIONS);
  const totalPages = overrides?.totalPages ?? calculateTotalPages(totalItems, itemsPerPage);
  const currentPage = overrides?.currentPage ?? faker.number.int({ min: 1, max: totalPages });
  const siblingCount = overrides?.siblingCount ?? faker.helpers.arrayElement(SIBLING_COUNT_OPTIONS);

  return {
    id: faker.string.uuid(),
    totalItems,
    totalPages,
    currentPage,
    itemsPerPage,
    siblingCount,
    size: faker.helpers.arrayElement(PAGINATION_SIZES),
    variant: faker.helpers.arrayElement(PAGINATION_VARIANTS),
    layout: faker.helpers.arrayElement(PAGINATION_LAYOUTS),
    hasPrevNext: faker.datatype.boolean({ probability: 0.9 }),
    hasFirstLast: faker.datatype.boolean({ probability: 0.3 }),
    isDisabled: faker.datatype.boolean({ probability: 0.05 }),
    pageItems: generatePageItems(currentPage, totalPages, siblingCount),
    ...overrides,
  };
}

/**
 * Creates multiple fake pagination configurations
 * @param count - Number of configurations to create
 * @param overrides - Optional property overrides
 * @returns Array of fake pagination configurations
 */
export function createFakePaginationConfigs(
  count: number,
  overrides?: Partial<FakePaginationConfig>
): FakePaginationConfig[] {
  return Array.from({ length: count }, () => createFakePaginationConfig(overrides));
}

/**
 * Creates a fake table pagination with metadata
 * @param overrides - Optional property overrides
 * @returns A fake table pagination configuration
 */
export function createFakeTablePagination(
  overrides?: Partial<FakeTablePagination>
): FakeTablePagination {
  const config = createFakePaginationConfig(overrides);
  const startIndex = (config.currentPage - 1) * config.itemsPerPage + 1;
  const endIndex = Math.min(config.currentPage * config.itemsPerPage, config.totalItems);

  return {
    ...config,
    startIndex,
    endIndex,
    hasPreviousPage: config.currentPage > 1,
    hasNextPage: config.currentPage < config.totalPages,
    selectedPerPage: config.itemsPerPage,
    filteredCount: faker.helpers.maybe(
      () => faker.number.int({ min: config.totalItems / 2, max: config.totalItems }),
      { probability: 0.3 }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake infinite scroll pagination
 * @param overrides - Optional property overrides
 * @returns A fake infinite scroll pagination
 */
export function createFakeInfiniteScrollPagination(
  overrides?: Partial<FakeInfiniteScrollPagination>
): FakeInfiniteScrollPagination {
  const pageSize = overrides?.pageSize ?? faker.helpers.arrayElement([10, 20, 50]);
  const totalCount = overrides?.totalCount ?? faker.number.int({ min: 50, max: 500 });
  const loadedCount =
    overrides?.loadedCount ?? faker.number.int({ min: pageSize, max: totalCount });
  const hasMore = loadedCount < totalCount;

  return {
    id: faker.string.uuid(),
    pageSize,
    loadedCount,
    totalCount,
    hasMore,
    isLoading: faker.datatype.boolean({ probability: 0.1 }),
    cursor: hasMore ? faker.string.uuid() : undefined,
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a simple pagination with few pages
 * @param totalPages - Number of total pages (default: 5)
 * @returns A simple pagination configuration
 */
export function createFakeSimplePagination(totalPages: number = 5): FakePaginationConfig {
  return createFakePaginationConfig({
    totalPages,
    totalItems: totalPages * 10,
    itemsPerPage: 10,
    layout: 'simple',
    hasPrevNext: true,
    hasFirstLast: false,
    siblingCount: 1,
  });
}

/**
 * Creates a pagination at the first page
 * @param totalPages - Number of total pages
 * @returns A pagination configuration at page 1
 */
export function createFakeFirstPagePagination(totalPages: number = 10): FakePaginationConfig {
  return createFakePaginationConfig({
    currentPage: 1,
    totalPages,
    totalItems: totalPages * 10,
    itemsPerPage: 10,
  });
}

/**
 * Creates a pagination at the last page
 * @param totalPages - Number of total pages
 * @returns A pagination configuration at the last page
 */
export function createFakeLastPagePagination(totalPages: number = 10): FakePaginationConfig {
  return createFakePaginationConfig({
    currentPage: totalPages,
    totalPages,
    totalItems: totalPages * 10,
    itemsPerPage: 10,
  });
}

/**
 * Creates a pagination at a middle page (with both ellipses)
 * @param totalPages - Number of total pages
 * @returns A pagination configuration at a middle page
 */
export function createFakeMiddlePagePagination(totalPages: number = 20): FakePaginationConfig {
  const middlePage = Math.floor(totalPages / 2);
  return createFakePaginationConfig({
    currentPage: middlePage,
    totalPages,
    totalItems: totalPages * 10,
    itemsPerPage: 10,
    siblingCount: 1,
  });
}

/**
 * Creates a disabled pagination
 * @returns A disabled pagination configuration
 */
export function createFakeDisabledPagination(): FakePaginationConfig {
  return createFakePaginationConfig({
    isDisabled: true,
  });
}

/**
 * Creates a single page pagination (no navigation needed)
 * @returns A single page pagination configuration
 */
export function createFakeSinglePagePagination(): FakePaginationConfig {
  return createFakePaginationConfig({
    totalPages: 1,
    totalItems: 5,
    itemsPerPage: 10,
    currentPage: 1,
  });
}

/**
 * Creates a large dataset pagination
 * @param totalPages - Number of total pages (default: 100)
 * @returns A large pagination configuration
 */
export function createFakeLargePagination(totalPages: number = 100): FakePaginationConfig {
  return createFakePaginationConfig({
    totalPages,
    totalItems: totalPages * 25,
    itemsPerPage: 25,
    layout: 'full',
    hasFirstLast: true,
    hasPrevNext: true,
    siblingCount: 2,
  });
}

/**
 * Creates a compact/minimal pagination
 * @returns A compact pagination configuration
 */
export function createFakeCompactPagination(): FakePaginationConfig {
  return createFakePaginationConfig({
    layout: 'compact',
    variant: 'minimal',
    hasPrevNext: true,
    hasFirstLast: false,
    siblingCount: 0,
  });
}

/**
 * Creates pagination for a data table context
 * @param itemCount - Total number of data items
 * @param perPage - Items per page
 * @returns A table pagination configuration
 */
export function createFakeDataTablePagination(
  itemCount: number = 150,
  perPage: number = 10
): FakeTablePagination {
  const totalPages = calculateTotalPages(itemCount, perPage);
  const currentPage = faker.number.int({ min: 1, max: totalPages });

  return createFakeTablePagination({
    totalItems: itemCount,
    itemsPerPage: perPage,
    totalPages,
    currentPage,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of pagination sizes
 * @returns Grid of pagination configs across sizes
 */
export function createPaginationSizeMatrix(): FakePaginationConfig[] {
  return PAGINATION_SIZES.map((size) =>
    createFakePaginationConfig({
      size,
      totalPages: 10,
      currentPage: 5,
    })
  );
}

/**
 * Creates a matrix of pagination layouts
 * @returns Grid of pagination configs across layouts
 */
export function createPaginationLayoutMatrix(): FakePaginationConfig[] {
  return PAGINATION_LAYOUTS.map((layout) =>
    createFakePaginationConfig({
      layout,
      totalPages: 15,
      currentPage: 7,
    })
  );
}

/**
 * Creates a matrix of pagination variants
 * @returns Grid of pagination configs across variants
 */
export function createPaginationVariantMatrix(): FakePaginationConfig[] {
  return PAGINATION_VARIANTS.map((variant) =>
    createFakePaginationConfig({
      variant,
      totalPages: 10,
      currentPage: 5,
    })
  );
}

/**
 * Creates a matrix of pagination states
 * @returns Grid of pagination configs across states
 */
export function createPaginationStateMatrix(): FakePaginationConfig[] {
  return PAGINATION_STATES.map((state) =>
    createFakePaginationConfig({
      isDisabled: state === 'disabled',
      totalPages: 10,
      currentPage: 5,
    })
  );
}

/**
 * Creates a matrix of page positions (first, middle, last)
 * @param totalPages - Number of pages
 * @returns Grid of pagination configs at different positions
 */
export function createPaginationPositionMatrix(totalPages: number = 10): FakePaginationConfig[] {
  const middlePage = Math.floor(totalPages / 2);
  return [
    createFakePaginationConfig({ currentPage: 1, totalPages }),
    createFakePaginationConfig({ currentPage: middlePage, totalPages }),
    createFakePaginationConfig({ currentPage: totalPages, totalPages }),
  ];
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all pagination configurations
 * @returns Array of pagination configs for showcase
 */
export function createPaginationShowcase(): Array<{
  config: FakePaginationConfig;
  description: string;
  name: string;
}> {
  return [
    {
      name: i18n.t('factory.pagination.default', 'Default'),
      description: i18n.t(
        'factory.pagination.standardPaginationWith10Pages',
        'Standard pagination with 10 pages'
      ),
      config: createFakePaginationConfig({ totalPages: 10, currentPage: 1 }),
    },
    {
      name: i18n.t('factory.pagination.firstPage', 'First Page'),
      description: i18n.t(
        'factory.pagination.paginationAtTheFirstPage',
        'Pagination at the first page'
      ),
      config: createFakeFirstPagePagination(15),
    },
    {
      name: i18n.t('factory.pagination.lastPage', 'Last Page'),
      description: i18n.t(
        'factory.pagination.paginationAtTheLastPage',
        'Pagination at the last page'
      ),
      config: createFakeLastPagePagination(15),
    },
    {
      name: i18n.t('factory.pagination.middlePage', 'Middle Page'),
      description: i18n.t(
        'factory.pagination.paginationInTheMiddleWith',
        'Pagination in the middle with both ellipses'
      ),
      config: createFakeMiddlePagePagination(20),
    },
    {
      name: i18n.t('factory.pagination.singlePage', 'Single Page'),
      description: i18n.t('factory.pagination.onlyOnePageOfResults', 'Only one page of results'),
      config: createFakeSinglePagePagination(),
    },
    {
      name: i18n.t('factory.pagination.largeDataset', 'Large Dataset'),
      description: i18n.t('factory.pagination.paginationFor100Pages', 'Pagination for 100+ pages'),
      config: createFakeLargePagination(100),
    },
    {
      name: i18n.t('factory.pagination.compact', 'Compact'),
      description: i18n.t(
        'factory.pagination.minimalPaginationForTightSpaces',
        'Minimal pagination for tight spaces'
      ),
      config: createFakeCompactPagination(),
    },
    {
      name: i18n.t('factory.pagination.disabled', 'Disabled'),
      description: i18n.t(
        'factory.pagination.disabledPaginationState',
        'Disabled pagination state'
      ),
      config: createFakeDisabledPagination(),
    },
    {
      name: i18n.t('factory.pagination.simpleLayout', 'Simple Layout'),
      description: i18n.t(
        'factory.pagination.simpleLayoutWithFewerControls',
        'Simple layout with fewer controls'
      ),
      config: createFakeSimplePagination(5),
    },
  ];
}

/**
 * Creates a complete test data set for pagination testing
 * @returns Comprehensive test data
 */
export function createPaginationTestData(): {
  configs: FakePaginationConfig[];
  infiniteScroll: FakeInfiniteScrollPagination[];
  layoutMatrix: FakePaginationConfig[];
  pageItems: FakePageItem[];
  positionMatrix: FakePaginationConfig[];
  showcase: Array<{ config: FakePaginationConfig; description: string; name: string }>;
  sizeMatrix: FakePaginationConfig[];
  stateMatrix: FakePaginationConfig[];
  tablePaginations: FakeTablePagination[];
  variantMatrix: FakePaginationConfig[];
} {
  return {
    configs: createFakePaginationConfigs(5),
    pageItems: Array.from({ length: 10 }, () => createFakePageItem()),
    tablePaginations: Array.from({ length: 3 }, () => createFakeTablePagination()),
    infiniteScroll: Array.from({ length: 3 }, () => createFakeInfiniteScrollPagination()),
    sizeMatrix: createPaginationSizeMatrix(),
    layoutMatrix: createPaginationLayoutMatrix(),
    variantMatrix: createPaginationVariantMatrix(),
    stateMatrix: createPaginationStateMatrix(),
    positionMatrix: createPaginationPositionMatrix(20),
    showcase: createPaginationShowcase(),
  };
}
