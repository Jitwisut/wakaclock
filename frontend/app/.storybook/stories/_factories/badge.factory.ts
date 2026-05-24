import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ TYPE DEFINITIONS ============

/** Badge visual variant */
export type BadgeVariant =
  | 'default'
  | 'destructive'
  | 'info'
  | 'outline'
  | 'secondary'
  | 'success'
  | 'warning';

/** Badge size variant (custom, not in base component) */
export type BadgeSize = 'default' | 'lg' | 'sm';

/** Badge semantic type */
export type BadgeType = 'count' | 'dot' | 'icon' | 'status' | 'text';

/** Interface for fake badge data */
export interface FakeBadge {
  /** Optional count value */
  count?: number;
  /** Whether badge has a dot indicator */
  dot?: boolean;
  /** Whether badge has icon */
  hasIcon?: boolean;
  /** Unique identifier */
  id: string;
  /** Badge label text */
  label: string;
  /** Badge type */
  type?: BadgeType;
  /** Visual variant */
  variant: BadgeVariant;
}

/** Interface for badge configuration */
export interface FakeBadgeConfig {
  /** Whether badge is interactive */
  interactive: boolean;
  /** Maximum count before showing "99+" */
  maxCount: number;
  /** Whether to show dot instead of count */
  showDot: boolean;
  /** Size variant */
  size: BadgeSize;
  /** Visual variant */
  variant: BadgeVariant;
}

// ============ CONSTANTS FOR ITERATION ============

/** All badge variant options */
export const BADGE_VARIANTS: BadgeVariant[] = [
  'default',
  'destructive',
  'info',
  'outline',
  'secondary',
  'success',
  'warning',
];

/** All badge size options */
export const BADGE_SIZES: BadgeSize[] = ['default', 'lg', 'sm'];

/** All badge type options */
export const BADGE_TYPES: BadgeType[] = ['count', 'dot', 'icon', 'status', 'text'];

/** Common badge labels for realistic test data */
export const BADGE_LABELS = [
  i18n.t('factory.badge.active', 'Active'),
  i18n.t('factory.badge.beta', 'Beta'),
  i18n.t('factory.badge.comingSoon', 'Coming Soon'),
  i18n.t('factory.badge.completed', 'Completed'),
  i18n.t('factory.badge.deprecated', 'Deprecated'),
  i18n.t('factory.badge.draft', 'Draft'),
  i18n.t('factory.badge.enterprise', 'Enterprise'),
  i18n.t('factory.badge.featured', 'Featured'),
  i18n.t('factory.badge.free', 'Free'),
  'Hot',
  i18n.t('factory.badge.inProgress', 'In Progress'),
  i18n.t('factory.badge.limited', 'Limited'),
  'New',
  i18n.t('factory.badge.onSale', 'On Sale'),
  i18n.t('factory.badge.pending', 'Pending'),
  i18n.t('factory.badge.popular', 'Popular'),
  i18n.t('factory.badge.premium', 'Premium'),
  'Pro',
  i18n.t('factory.badge.recommended', 'Recommended'),
  i18n.t('factory.badge.sale', 'Sale'),
  i18n.t('factory.badge.soldOut', 'Sold Out'),
  i18n.t('factory.badge.soon', 'Soon'),
  i18n.t('factory.badge.staffPick', 'Staff Pick'),
  i18n.t('factory.badge.trending', 'Trending'),
  i18n.t('factory.badge.verified', 'Verified'),
];

/** Status labels for status badges */
export const BADGE_STATUS_LABELS: Record<string, BadgeVariant> = {
  Active: 'success',
  Completed: 'success',
  Deprecated: 'destructive',
  Error: 'destructive',
  'In Progress': 'info',
  Pending: 'warning',
  Warning: 'warning',
};

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake badge
 * @param overrides - Optional partial overrides for the generated badge
 * @returns A fake badge
 */
export function createFakeBadge(overrides?: Partial<FakeBadge>): FakeBadge {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(BADGE_LABELS),
    variant: faker.helpers.arrayElement(BADGE_VARIANTS),
    count: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 99 }), { probability: 0.3 }),
    dot: faker.helpers.maybe(() => true, { probability: 0.1 }),
    hasIcon: faker.helpers.maybe(() => true, { probability: 0.2 }),
    type: faker.helpers.maybe(() => faker.helpers.arrayElement(BADGE_TYPES), { probability: 0.5 }),
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake badges
 * @param count - Number of badges to generate
 * @returns Array of fake badges
 */
export function createFakeBadges(count: number): FakeBadge[] {
  return Array.from({ length: count }, () => createFakeBadge());
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a success badge
 * @param label - Custom label
 * @returns A success variant badge
 */
export function createFakeSuccessBadge(label?: string): FakeBadge {
  return createFakeBadge({
    label:
      label ??
      faker.helpers.arrayElement([
        i18n.t('factory.badge.active', 'Active'),
        i18n.t('factory.badge.completed', 'Completed'),
        i18n.t('factory.badge.verified', 'Verified'),
        i18n.t('factory.badge.approved', 'Approved'),
      ]),
    variant: 'success',
  });
}

/**
 * Creates a warning badge
 * @param label - Custom label
 * @returns A warning variant badge
 */
export function createFakeWarningBadge(label?: string): FakeBadge {
  return createFakeBadge({
    label:
      label ??
      faker.helpers.arrayElement([
        i18n.t('factory.badge.pending', 'Pending'),
        i18n.t('factory.badge.warning', 'Warning'),
        i18n.t('factory.badge.attention', 'Attention'),
        i18n.t('factory.badge.review', 'Review'),
      ]),
    variant: 'warning',
  });
}

/**
 * Creates a destructive/error badge
 * @param label - Custom label
 * @returns A destructive variant badge
 */
export function createFakeDestructiveBadge(label?: string): FakeBadge {
  return createFakeBadge({
    label:
      label ??
      faker.helpers.arrayElement([
        i18n.t('factory.badge.error', 'Error'),
        i18n.t('factory.badge.failed', 'Failed'),
        i18n.t('factory.badge.deprecated', 'Deprecated'),
        i18n.t('factory.badge.expired', 'Expired'),
      ]),
    variant: 'destructive',
  });
}

/**
 * Creates an info badge
 * @param label - Custom label
 * @returns An info variant badge
 */
export function createFakeInfoBadge(label?: string): FakeBadge {
  return createFakeBadge({
    label:
      label ??
      faker.helpers.arrayElement([
        i18n.t('factory.badge.info', 'Info'),
        'New',
        i18n.t('factory.badge.beta', 'Beta'),
        i18n.t('factory.badge.updated', 'Updated'),
      ]),
    variant: 'info',
  });
}

/**
 * Creates a count badge (notification style)
 * @param count - Number to display
 * @returns A count badge
 */
export function createFakeCountBadge(count?: number): FakeBadge {
  return createFakeBadge({
    label: String(count ?? faker.number.int({ min: 1, max: 99 })),
    count: count ?? faker.number.int({ min: 1, max: 99 }),
    variant: 'destructive',
    type: 'count',
  });
}

/**
 * Creates a status badge with appropriate variant
 * @param status - Status text
 * @returns A status badge
 */
export function createFakeStatusBadge(status?: string): FakeBadge {
  const statusKeys = Object.keys(BADGE_STATUS_LABELS);
  const selectedStatus = status ?? faker.helpers.arrayElement(statusKeys);
  const variant = BADGE_STATUS_LABELS[selectedStatus] ?? 'default';

  return createFakeBadge({
    label: selectedStatus,
    variant,
    type: 'status',
  });
}

/**
 * Creates a dot badge (small indicator)
 * @returns A dot badge
 */
export function createFakeDotBadge(): FakeBadge {
  return createFakeBadge({
    label: '',
    dot: true,
    type: 'dot',
    variant: faker.helpers.arrayElement(['success', 'warning', 'destructive']),
  });
}

/**
 * Creates a product badge (sale, new, etc.)
 * @returns A product badge
 */
export function createFakeProductBadge(): FakeBadge {
  const productLabels = [
    'New',
    i18n.t('factory.badge.sale', 'Sale'),
    'Hot',
    i18n.t('factory.badge.trending', 'Trending'),
    i18n.t('factory.badge.limited', 'Limited'),
    i18n.t('factory.badge.soldOut', 'Sold Out'),
    i18n.t('factory.badge.featured', 'Featured'),
  ];
  const label = faker.helpers.arrayElement(productLabels);

  let variant: BadgeVariant = 'default';
  if (label === i18n.t('factory.badge.sale', 'Sale') || label === 'Hot') variant = 'destructive';
  if (label === 'New' || label === i18n.t('factory.badge.featured', 'Featured')) variant = 'info';
  if (label === i18n.t('factory.badge.soldOut', 'Sold Out')) variant = 'secondary';

  return createFakeBadge({ label, variant });
}

/**
 * Creates badges for all variants
 * @returns Array with one badge of each variant
 */
export function createFakeBadgesByVariant(): FakeBadge[] {
  return BADGE_VARIANTS.map((variant) => ({
    id: `variant-${variant}`,
    label: variant.charAt(0).toUpperCase() + variant.slice(1),
    variant,
  }));
}

/**
 * Creates badges for a tag list (product tags, article tags)
 * @param count - Number of tags
 * @returns Array of tag badges
 */
export function createFakeTagBadges(count = 5): FakeBadge[] {
  const tags = faker.helpers.uniqueArray(() => faker.word.noun(), count);

  return tags.map((tag) => ({
    id: faker.string.uuid(),
    label: tag.charAt(0).toUpperCase() + tag.slice(1),
    variant: faker.helpers.arrayElement(['outline', 'secondary']) as BadgeVariant,
  }));
}

// ============ MATRIX FACTORY ============

/**
 * Creates a matrix of badges for visual regression testing
 * across all variant and size combinations
 * @returns 2D array of badges [variant][size]
 */
export function createFakeBadgeMatrix(): FakeBadge[][] {
  return BADGE_VARIANTS.map((variant) =>
    BADGE_SIZES.map((size) => ({
      id: `${variant}-${size}`,
      label: `${variant} (${size})`,
      variant,
    }))
  );
}

/**
 * Creates badge configuration for different scenarios
 * @param scenario - Scenario name
 * @returns Badge configuration
 */
export function createFakeBadgeConfig(
  scenario: 'count' | 'default' | 'dot' | 'interactive' = 'default'
): FakeBadgeConfig {
  const configs: Record<string, FakeBadgeConfig> = {
    default: {
      variant: 'default',
      size: 'default',
      showDot: false,
      maxCount: 99,
      interactive: false,
    },
    count: {
      variant: 'destructive',
      size: 'sm',
      showDot: false,
      maxCount: 99,
      interactive: false,
    },
    dot: {
      variant: 'success',
      size: 'sm',
      showDot: true,
      maxCount: 0,
      interactive: false,
    },
    interactive: {
      variant: 'outline',
      size: 'default',
      showDot: false,
      maxCount: 99,
      interactive: true,
    },
  };

  return configs[scenario];
}
