/**
 * AsyncWrapper Component Factory
 *
 * Generates fake data for AsyncWrapper component stories and tests.
 * Supports various skeleton variants, fetch states, and data configurations.
 *
 * @module async-wrapper.factory
 */
import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Skeleton variant options for loading state
 */
export type SkeletonVariant = 'card' | 'list' | 'table' | 'text';

/**
 * Fetch status values
 */
export type FetchStatus = 'error' | 'idle' | 'loading' | 'success';

/**
 * HTTP error status codes
 */
export type HttpErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503 | 504;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All skeleton variants
 */
export const SKELETON_VARIANTS: SkeletonVariant[] = ['card', 'list', 'table', 'text'];

/**
 * All fetch statuses
 */
export const FETCH_STATUSES: FetchStatus[] = ['idle', 'loading', 'success', 'error'];

/**
 * All HTTP error status codes
 */
export const HTTP_ERROR_STATUSES: HttpErrorStatus[] = [
  400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504,
];

/**
 * User roles
 */
export const USER_ROLES = ['admin', 'editor', 'viewer'] as const;

/**
 * User statuses
 */
export const USER_STATUSES = ['active', 'inactive'] as const;

/**
 * Skeleton row counts by variant
 */
export const SKELETON_ROW_DEFAULTS: Record<SkeletonVariant, number> = {
  card: 3,
  list: 5,
  table: 4,
  text: 6,
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Fake user data
 */
export interface FakeUser {
  avatar: string;
  email: string;
  id: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'active' | 'inactive';
}

/**
 * Fake product data
 */
export interface FakeProduct {
  category: string;
  description: string;
  id: string;
  image: string;
  name: string;
  price: number;
  stock: number;
}

/**
 * API response wrapper
 */
export interface FakeApiResponse<T> {
  data: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
  };
}

/**
 * AsyncWrapper configuration
 */
export interface FakeAsyncWrapperConfig {
  endpoint: string;
  id: string;
  skeletonRows: number;
  skeletonVariant: SkeletonVariant;
  testId: string;
}

// ============================================================================
// BASE FACTORIES
// ============================================================================

/**
 * Create a fake user
 */
export function createFakeUser(overrides?: Partial<FakeUser>): FakeUser {
  return {
    avatar: faker.image.avatar(),
    email: faker.internet.email(),
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    role: faker.helpers.arrayElement(USER_ROLES),
    status: faker.helpers.arrayElement(USER_STATUSES),
    ...overrides,
  };
}

/**
 * Create multiple fake users
 */
export function createFakeUsers(count: number, overrides?: Partial<FakeUser>): FakeUser[] {
  return Array.from({ length: count }, () => createFakeUser(overrides));
}

/**
 * Create a fake product
 */
export function createFakeProduct(overrides?: Partial<FakeProduct>): FakeProduct {
  return {
    category: faker.commerce.department(),
    description: faker.commerce.productDescription(),
    id: faker.string.uuid(),
    image: faker.image.urlPicsumPhotos({ width: 200, height: 200 }),
    name: faker.commerce.productName(),
    price: Number.parseFloat(faker.commerce.price({ min: 10, max: 500 })),
    stock: faker.number.int({ min: 0, max: 100 }),
    ...overrides,
  };
}

/**
 * Create multiple fake products
 */
export function createFakeProducts(count: number, overrides?: Partial<FakeProduct>): FakeProduct[] {
  return Array.from({ length: count }, () => createFakeProduct(overrides));
}

// ============================================================================
// API RESPONSE FACTORIES
// ============================================================================

/**
 * Create a fake API response with users
 */
export function createFakeUserResponse(
  count = 5,
  overrides?: Partial<FakeApiResponse<FakeUser>>
): FakeApiResponse<FakeUser> {
  return {
    data: createFakeUsers(count),
    meta: { page: 1, perPage: 10, total: faker.number.int({ min: count, max: 100 }) },
    ...overrides,
  };
}

/**
 * Create a fake API response with products
 */
export function createFakeProductResponse(
  count = 6,
  overrides?: Partial<FakeApiResponse<FakeProduct>>
): FakeApiResponse<FakeProduct> {
  return {
    data: createFakeProducts(count),
    meta: { page: 1, perPage: 10, total: faker.number.int({ min: count, max: 200 }) },
    ...overrides,
  };
}

/**
 * Create an empty API response
 */
export function createFakeEmptyResponse<T>(): FakeApiResponse<T> {
  return {
    data: [],
    meta: { page: 1, perPage: 10, total: 0 },
  };
}

// ============================================================================
// STATE FACTORIES
// ============================================================================

/**
 * Create a user with active status
 */
export function createFakeActiveUser(overrides?: Partial<FakeUser>): FakeUser {
  return createFakeUser({ status: 'active', ...overrides });
}

/**
 * Create a user with inactive status
 */
export function createFakeInactiveUser(overrides?: Partial<FakeUser>): FakeUser {
  return createFakeUser({ status: 'inactive', ...overrides });
}

/**
 * Create a product that is out of stock
 */
export function createFakeOutOfStockProduct(overrides?: Partial<FakeProduct>): FakeProduct {
  return createFakeProduct({ stock: 0, ...overrides });
}

/**
 * Create a product with high stock
 */
export function createFakeHighStockProduct(overrides?: Partial<FakeProduct>): FakeProduct {
  return createFakeProduct({ stock: faker.number.int({ min: 50, max: 100 }), ...overrides });
}

// ============================================================================
// CONFIG FACTORIES
// ============================================================================

/**
 * Create a fake AsyncWrapper config
 */
export function createFakeAsyncWrapperConfig(
  overrides?: Partial<FakeAsyncWrapperConfig>
): FakeAsyncWrapperConfig {
  const variant = overrides?.skeletonVariant ?? faker.helpers.arrayElement(SKELETON_VARIANTS);

  return {
    endpoint: faker.helpers.arrayElement([
      '/api/async-wrapper/users',
      '/api/async-wrapper/products',
    ]),
    id: faker.string.uuid(),
    skeletonRows: overrides?.skeletonRows ?? SKELETON_ROW_DEFAULTS[variant],
    skeletonVariant: variant,
    testId: `async-wrapper-${faker.string.alphanumeric(8)}`,
    ...overrides,
  };
}

// ============================================================================
// VARIANT FACTORIES
// ============================================================================

/**
 * Create configs for all skeleton variants
 */
export function createFakeAllVariantConfigs(): FakeAsyncWrapperConfig[] {
  return SKELETON_VARIANTS.map((variant) =>
    createFakeAsyncWrapperConfig({ skeletonVariant: variant })
  );
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Create a matrix of variant x row count combinations
 */
export function createVariantRowMatrix(): {
  config: FakeAsyncWrapperConfig;
  rows: number;
  variant: SkeletonVariant;
}[] {
  const rowCounts = [1, 3, 5, 8];
  return SKELETON_VARIANTS.flatMap((variant) =>
    rowCounts.map((rows) => ({
      config: createFakeAsyncWrapperConfig({ skeletonVariant: variant, skeletonRows: rows }),
      rows,
      variant,
    }))
  );
}

/**
 * Create a matrix of user roles
 */
export function createUserRoleMatrix(): { role: FakeUser['role']; user: FakeUser }[] {
  return USER_ROLES.map((role) => ({
    role,
    user: createFakeUser({ role }),
  }));
}

/**
 * Create a response with many items for edge case testing
 */
export function createFakeLargeUserResponse(): FakeApiResponse<FakeUser> {
  return createFakeUserResponse(50, { meta: { page: 1, perPage: 50, total: 500 } });
}

/**
 * Create a response with users that have very long names
 */
export function createFakeLongNameUsers(count = 5): FakeUser[] {
  return Array.from({ length: count }, () =>
    createFakeUser({
      name: `${faker.person.firstName()} ${faker.person.middleName()} ${faker.person.lastName()}-${faker.person.lastName()} the ${faker.helpers.arrayElement([i18n.t('factory.asyncWrapper.third', 'Third'), i18n.t('factory.asyncWrapper.fourth', 'Fourth'), i18n.t('factory.asyncWrapper.fifth', 'Fifth'), i18n.t('factory.asyncWrapper.sixth', 'Sixth')])}`,
      email: `${faker.string.alphanumeric(30)}@${faker.internet.domainName()}`,
    })
  );
}

// ============================================================================
// SHOWCASE FACTORIES
// ============================================================================

/**
 * Create comprehensive test data
 */
export function createAsyncWrapperTestData(): {
  activeUsers: FakeUser[];
  allVariantConfigs: FakeAsyncWrapperConfig[];
  basicConfig: FakeAsyncWrapperConfig;
  emptyResponse: FakeApiResponse<FakeUser>;
  inactiveUsers: FakeUser[];
  largeResponse: FakeApiResponse<FakeUser>;
  longNameUsers: FakeUser[];
  productResponse: FakeApiResponse<FakeProduct>;
  userResponse: FakeApiResponse<FakeUser>;
} {
  return {
    activeUsers: Array.from({ length: 5 }, () => createFakeActiveUser()),
    allVariantConfigs: createFakeAllVariantConfigs(),
    basicConfig: createFakeAsyncWrapperConfig(),
    emptyResponse: createFakeEmptyResponse<FakeUser>(),
    inactiveUsers: Array.from({ length: 3 }, () => createFakeInactiveUser()),
    largeResponse: createFakeLargeUserResponse(),
    longNameUsers: createFakeLongNameUsers(),
    productResponse: createFakeProductResponse(),
    userResponse: createFakeUserResponse(),
  };
}

/**
 * Create showcase of all async wrapper configurations
 */
export function createAsyncWrapperShowcase(): {
  roleMatrix: ReturnType<typeof createUserRoleMatrix>;
  testData: ReturnType<typeof createAsyncWrapperTestData>;
  variantRowMatrix: ReturnType<typeof createVariantRowMatrix>;
} {
  return {
    roleMatrix: createUserRoleMatrix(),
    testData: createAsyncWrapperTestData(),
    variantRowMatrix: createVariantRowMatrix(),
  };
}
