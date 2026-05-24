import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ HELPER FUNCTIONS ============

/**
 * Gets the change direction based on percent change
 * @param changePercent - The percentage change value
 * @returns The direction: 'up', 'down', or 'neutral'
 */
function getChangeDirection(changePercent: number): 'down' | 'neutral' | 'up' {
  if (changePercent > 0) return 'up';
  if (changePercent < 0) return 'down';
  return 'neutral';
}

// ============ TYPE DEFINITIONS ============

/** Card layout variant */
export type CardLayout = 'default' | 'horizontal' | 'stacked' | 'vertical';

/** Card size variant */
export type CardSize = 'compact' | 'default' | 'full' | 'large';

/** Card content type */
export type CardContentType = 'article' | 'media' | 'pricing' | 'product' | 'profile' | 'stats';

/** Card status/state */
export type CardStatus = 'active' | 'disabled' | 'draft' | 'featured' | 'inactive';

/** Card action type */
export type CardActionType = 'confirm' | 'delete' | 'dismiss' | 'edit' | 'navigate' | 'view';

/** Interface for fake card data */
export interface FakeCard {
  /** Action buttons text */
  actions?: string[];
  /** Optional badge text */
  badge?: string;
  /** Main content text */
  content?: string;
  /** Card description */
  description: string;
  /** Footer text */
  footer?: string;
  /** Unique identifier */
  id: string;
  /** Image URL */
  image?: string;
  /** Card layout */
  layout?: CardLayout;
  /** Card size */
  size?: CardSize;
  /** Card status */
  status?: CardStatus;
  /** Card title */
  title: string;
  /** Content type */
  type?: CardContentType;
}

/** Interface for profile card data */
export interface FakeProfileCard extends FakeCard {
  /** Avatar URL */
  avatar: string;
  /** Bio/description */
  bio?: string;
  /** Email address */
  email: string;
  /** Job title */
  jobTitle?: string;
  /** User name */
  name: string;
  /** Online status */
  online?: boolean;
  /** Social links */
  socialLinks?: string[];
}

/** Interface for product card data */
export interface FakeProductCard extends FakeCard {
  /** Brand name */
  brand?: string;
  /** Product category */
  category: string;
  /** Discount percentage */
  discount?: number;
  /** Whether in stock */
  inStock: boolean;
  /** Original price */
  originalPrice?: number;
  /** Current price */
  price: number;
  /** Product rating */
  rating: number;
  /** Review count */
  reviewCount: number;
}

/** Interface for pricing card data */
export interface FakePricingCard extends FakeCard {
  /** Billing period */
  billingPeriod: 'monthly' | 'yearly';
  /** Currency */
  currency: string;
  /** Features list */
  features: string[];
  /** Whether highlighted/recommended */
  highlighted: boolean;
  /** Plan name */
  planName: string;
  /** Price amount */
  price: number;
}

/** Interface for stats card data */
export interface FakeStatsCard extends FakeCard {
  /** Change direction */
  changeDirection: 'down' | 'neutral' | 'up';
  /** Change percentage */
  changePercent: number;
  /** Metric name */
  metric: string;
  /** Previous value */
  previousValue?: number;
  /** Time period */
  timePeriod: string;
  /** Display unit */
  unit?: string;
  /** Current value */
  value: number;
}

/** Interface for article card data */
export interface FakeArticleCard extends FakeCard {
  /** Author name */
  author: string;
  /** Author avatar */
  authorAvatar?: string;
  /** Article category */
  category: string;
  /** Published date */
  publishedAt: Date;
  /** Read time in minutes */
  readTime: number;
  /** Tags */
  tags?: string[];
}

/** Interface for card configuration */
export interface FakeCardConfig {
  /** Whether to show action buttons */
  hasActions: boolean;
  /** Whether to show badge */
  hasBadge: boolean;
  /** Whether to show footer */
  hasFooter: boolean;
  /** Whether to show image */
  hasImage: boolean;
  /** Card layout */
  layout: CardLayout;
  /** Card size */
  size: CardSize;
}

// ============ CONSTANTS FOR ITERATION ============

/** All card layout options */
export const CARD_LAYOUTS: CardLayout[] = ['default', 'horizontal', 'stacked', 'vertical'];

/** All card size options */
export const CARD_SIZES: CardSize[] = ['compact', 'default', 'full', 'large'];

/** All card content types */
export const CARD_CONTENT_TYPES: CardContentType[] = [
  'article',
  'media',
  'pricing',
  'product',
  'profile',
  'stats',
];

/** All card status options */
export const CARD_STATUSES: CardStatus[] = ['active', 'disabled', 'draft', 'featured', 'inactive'];

/** All card action types */
export const CARD_ACTION_TYPES: CardActionType[] = [
  'confirm',
  'delete',
  'dismiss',
  'edit',
  'navigate',
  'view',
];

/** Common card titles */
export const CARD_TITLES = [
  i18n.t('factory.card.accountSettings', 'Account Settings'),
  i18n.t('factory.card.dashboardOverview', 'Dashboard Overview'),
  i18n.t('factory.card.gettingStarted', 'Getting Started'),
  i18n.t('factory.card.newFeature', 'New Feature'),
  i18n.t('factory.card.paymentDetails', 'Payment Details'),
  i18n.t('factory.card.profileInformation', 'Profile Information'),
  i18n.t('factory.card.projectSummary', 'Project Summary'),
  i18n.t('factory.card.quickActions', 'Quick Actions'),
  i18n.t('factory.card.recentActivity', 'Recent Activity'),
  i18n.t('factory.card.teamMembers', 'Team Members'),
  i18n.t('factory.card.usageStatistics', 'Usage Statistics'),
  i18n.t('factory.card.welcomeBack', 'Welcome Back'),
];

/** Common card badges */
export const CARD_BADGES = [
  i18n.t('factory.card.beta', 'Beta'),
  i18n.t('factory.card.featured', 'Featured'),
  i18n.t('factory.card.free', 'Free'),
  i18n.t('factory.card.hot', 'Hot'),
  i18n.t('factory.card.limited', 'Limited'),
  i18n.t('factory.card.new', 'New'),
  i18n.t('factory.card.popular', 'Popular'),
  i18n.t('factory.card.premium', 'Premium'),
  i18n.t('factory.card.pro', 'Pro'),
  i18n.t('factory.card.sale', 'Sale'),
  i18n.t('factory.card.soon', 'Soon'),
  i18n.t('factory.card.trending', 'Trending'),
];

/** Card width classes by size */
export const CARD_SIZE_WIDTHS: Record<CardSize, string> = {
  compact: 'w-[240px]',
  default: 'w-[350px]',
  full: 'w-full',
  large: 'w-[480px]',
};

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake card
 * @param overrides - Optional partial overrides
 * @returns A fake card
 */
export function createFakeCard(overrides?: Partial<FakeCard>): FakeCard {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.sentence({ min: 3, max: 6 }),
    description: faker.lorem.paragraph({ min: 1, max: 3 }),
    image: faker.helpers.maybe(() => faker.image.urlPicsumPhotos({ width: 400, height: 200 }), {
      probability: 0.6,
    }),
    footer: faker.helpers.maybe(() => faker.lorem.sentence({ min: 3, max: 6 }), {
      probability: 0.5,
    }),
    badge: faker.helpers.maybe(() => faker.helpers.arrayElement(CARD_BADGES), {
      probability: 0.4,
    }),
    content: faker.helpers.maybe(() => faker.lorem.paragraphs({ min: 1, max: 2 }), {
      probability: 0.5,
    }),
    actions: faker.helpers.maybe(
      () => [i18n.t('factory.card.view', 'View'), i18n.t('factory.card.edit', 'Edit')],
      { probability: 0.4 }
    ),
    layout: faker.helpers.maybe(() => faker.helpers.arrayElement(CARD_LAYOUTS), {
      probability: 0.3,
    }),
    size: faker.helpers.maybe(() => faker.helpers.arrayElement(CARD_SIZES), { probability: 0.3 }),
    status: faker.helpers.maybe(() => faker.helpers.arrayElement(CARD_STATUSES), {
      probability: 0.2,
    }),
    type: faker.helpers.maybe(() => faker.helpers.arrayElement(CARD_CONTENT_TYPES), {
      probability: 0.3,
    }),
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake cards
 * @param count - Number of cards to generate
 * @returns Array of fake cards
 */
export function createFakeCards(count: number): FakeCard[] {
  return Array.from({ length: count }, () => createFakeCard());
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a profile card
 * @param overrides - Optional overrides
 * @returns A profile card
 */
export function createFakeProfileCard(overrides?: Partial<FakeProfileCard>): FakeProfileCard {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    ...createFakeCard({ type: 'profile' }),
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ firstName, lastName }),
    avatar: faker.image.avatar(),
    jobTitle: faker.person.jobTitle(),
    bio: faker.lorem.sentence(),
    online: faker.datatype.boolean(),
    socialLinks: faker.helpers.maybe(() => [faker.internet.url(), faker.internet.url()], {
      probability: 0.5,
    }),
    ...overrides,
  };
}

/**
 * Creates multiple profile cards
 * @param count - Number of cards
 * @returns Array of profile cards
 */
export function createFakeProfileCards(count: number): FakeProfileCard[] {
  return Array.from({ length: count }, () => createFakeProfileCard());
}

/**
 * Creates a product card
 * @param overrides - Optional overrides
 * @returns A product card
 */
export function createFakeProductCard(overrides?: Partial<FakeProductCard>): FakeProductCard {
  const originalPrice = faker.number.float({ min: 10, max: 1000, fractionDigits: 2 });
  const hasDiscount = faker.datatype.boolean();
  const discount = hasDiscount ? faker.number.int({ min: 5, max: 50 }) : undefined;
  const price = discount ? originalPrice * (1 - discount / 100) : originalPrice;

  return {
    ...createFakeCard({ type: 'product' }),
    title: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    image: faker.image.urlPicsumPhotos({ width: 400, height: 300 }),
    category: faker.commerce.department(),
    brand: faker.company.name(),
    price: Number(price.toFixed(2)),
    originalPrice: hasDiscount ? originalPrice : undefined,
    discount,
    rating: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
    reviewCount: faker.number.int({ min: 0, max: 500 }),
    inStock: faker.datatype.boolean({ probability: 0.8 }),
    ...overrides,
  };
}

/**
 * Creates multiple product cards
 * @param count - Number of cards
 * @returns Array of product cards
 */
export function createFakeProductCards(count: number): FakeProductCard[] {
  return Array.from({ length: count }, () => createFakeProductCard());
}

/**
 * Creates a pricing card
 * @param overrides - Optional overrides
 * @returns A pricing card
 */
export function createFakePricingCard(overrides?: Partial<FakePricingCard>): FakePricingCard {
  const planNames = [
    i18n.t('factory.card.free', 'Free'),
    i18n.t('factory.card.starter', 'Starter'),
    i18n.t('factory.card.pro', 'Pro'),
    i18n.t('factory.card.enterprise', 'Enterprise'),
    i18n.t('factory.card.basic', 'Basic'),
    i18n.t('factory.card.premium', 'Premium'),
  ];
  const featureCount = faker.number.int({ min: 3, max: 8 });

  return {
    ...createFakeCard({ type: 'pricing' }),
    planName: faker.helpers.arrayElement(planNames),
    price: faker.helpers.arrayElement([0, 9, 19, 29, 49, 99, 199]),
    currency: 'USD',
    billingPeriod: faker.helpers.arrayElement(['monthly', 'yearly']),
    features: Array.from({ length: featureCount }, () => faker.lorem.sentence({ min: 2, max: 5 })),
    highlighted: faker.datatype.boolean({ probability: 0.2 }),
    ...overrides,
  };
}

/**
 * Creates a pricing table (Free, Pro, Enterprise)
 * @returns Array of pricing cards
 */
export function createFakePricingTable(): FakePricingCard[] {
  return [
    createFakePricingCard({
      planName: i18n.t('factory.card.free', 'Free'),
      price: 0,
      features: [
        i18n.t('factory.card.fiveProjects', '5 Projects'),
        i18n.t('factory.card.basicSupport', 'Basic Support'),
        i18n.t('factory.card.oneGbStorage', '1GB Storage'),
      ],
      highlighted: false,
    }),
    createFakePricingCard({
      planName: i18n.t('factory.card.pro', 'Pro'),
      price: 29,
      features: [
        i18n.t('factory.card.unlimitedProjects', 'Unlimited Projects'),
        i18n.t('factory.card.prioritySupport', 'Priority Support'),
        i18n.t('factory.card.hundredGbStorage', '100GB Storage'),
        i18n.t('factory.card.apiAccess', 'API Access'),
      ],
      highlighted: true,
      badge: i18n.t('factory.card.mostPopular', 'Most Popular'),
    }),
    createFakePricingCard({
      planName: i18n.t('factory.card.enterprise', 'Enterprise'),
      price: 99,
      features: [
        i18n.t('factory.card.unlimitedEverything', 'Unlimited Everything'),
        i18n.t('factory.card.twentyFourSevenSupport', '24/7 Support'),
        i18n.t('factory.card.unlimitedStorage', 'Unlimited Storage'),
        i18n.t('factory.card.apiAccess', 'API Access'),
        i18n.t('factory.card.sso', 'SSO'),
        i18n.t('factory.card.customDomain', 'Custom Domain'),
      ],
      highlighted: false,
    }),
  ];
}

/**
 * Creates a stats card
 * @param overrides - Optional overrides
 * @returns A stats card
 */
export function createFakeStatsCard(overrides?: Partial<FakeStatsCard>): FakeStatsCard {
  const metrics = [
    i18n.t('factory.card.revenue', 'Revenue'),
    i18n.t('factory.card.users', 'Users'),
    i18n.t('factory.card.orders', 'Orders'),
    i18n.t('factory.card.visitors', 'Visitors'),
    i18n.t('factory.card.conversionRate', 'Conversion Rate'),
    i18n.t('factory.card.pageViews', 'Page Views'),
  ];
  const value = faker.number.int({ min: 100, max: 100_000 });
  const changePercent = faker.number.float({ min: -20, max: 30, fractionDigits: 1 });

  return {
    ...createFakeCard({ type: 'stats' }),
    metric: faker.helpers.arrayElement(metrics),
    value,
    previousValue: Math.round(value * (1 - changePercent / 100)),
    changePercent: Math.abs(changePercent),
    changeDirection: getChangeDirection(changePercent),
    timePeriod: faker.helpers.arrayElement([
      i18n.t('factory.card.today', 'Today'),
      i18n.t('factory.card.thisWeek', 'This Week'),
      i18n.t('factory.card.thisMonth', 'This Month'),
      i18n.t('factory.card.thisYear', 'This Year'),
    ]),
    unit: faker.helpers.maybe(() => faker.helpers.arrayElement(['$', '%', 'k']), {
      probability: 0.3,
    }),
    ...overrides,
  };
}

/**
 * Creates a dashboard stats grid
 * @returns Array of stats cards
 */
export function createFakeDashboardStats(): FakeStatsCard[] {
  return [
    createFakeStatsCard({
      metric: i18n.t('factory.card.totalRevenue', 'Total Revenue'),
      unit: '$',
    }),
    createFakeStatsCard({ metric: i18n.t('factory.card.activeUsers', 'Active Users') }),
    createFakeStatsCard({ metric: i18n.t('factory.card.newOrders', 'New Orders') }),
    createFakeStatsCard({
      metric: i18n.t('factory.card.conversionRate', 'Conversion Rate'),
      unit: '%',
    }),
  ];
}

/**
 * Creates an article card
 * @param overrides - Optional overrides
 * @returns An article card
 */
export function createFakeArticleCard(overrides?: Partial<FakeArticleCard>): FakeArticleCard {
  const categories = [
    i18n.t('factory.card.technology', 'Technology'),
    i18n.t('factory.card.design', 'Design'),
    i18n.t('factory.card.business', 'Business'),
    i18n.t('factory.card.lifestyle', 'Lifestyle'),
    i18n.t('factory.card.tutorial', 'Tutorial'),
    i18n.t('factory.card.news', 'News'),
  ];

  return {
    ...createFakeCard({ type: 'article' }),
    title: faker.lorem.sentence({ min: 5, max: 10 }),
    description: faker.lorem.paragraph(),
    image: faker.image.urlPicsumPhotos({ width: 600, height: 400 }),
    author: faker.person.fullName(),
    authorAvatar: faker.image.avatar(),
    category: faker.helpers.arrayElement(categories),
    publishedAt: faker.date.recent({ days: 30 }),
    readTime: faker.number.int({ min: 2, max: 15 }),
    tags: faker.helpers.maybe(
      () => Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, () => faker.word.noun()),
      { probability: 0.6 }
    ),
    ...overrides,
  };
}

/**
 * Creates multiple article cards
 * @param count - Number of articles
 * @returns Array of article cards
 */
export function createFakeArticleCards(count: number): FakeArticleCard[] {
  return Array.from({ length: count }, () => createFakeArticleCard());
}

/**
 * Creates a card with image
 * @returns A card with image
 */
export function createFakeImageCard(): FakeCard {
  return createFakeCard({
    image: faker.image.urlPicsumPhotos({ width: 400, height: 300 }),
  });
}

/**
 * Creates a card without image (text only)
 * @returns A text-only card
 */
export function createFakeTextOnlyCard(): FakeCard {
  return createFakeCard({
    image: undefined,
    content: faker.lorem.paragraphs({ min: 2, max: 4 }),
  });
}

/**
 * Creates a compact card
 * @returns A compact card
 */
export function createFakeCompactCard(): FakeCard {
  return createFakeCard({
    size: 'compact',
    image: undefined,
    footer: undefined,
    description: faker.lorem.sentence(),
  });
}

/**
 * Creates a featured/highlighted card
 * @returns A featured card
 */
export function createFakeFeaturedCard(): FakeCard {
  return createFakeCard({
    status: 'featured',
    badge: i18n.t('factory.card.featured', 'Featured'),
    image: faker.image.urlPicsumPhotos({ width: 600, height: 400 }),
  });
}

/**
 * Creates a horizontal layout card
 * @returns A horizontal card
 */
export function createFakeHorizontalCard(): FakeCard {
  return createFakeCard({
    layout: 'horizontal',
    image: faker.image.urlPicsumPhotos({ width: 200, height: 200 }),
  });
}

// ============ MATRIX FACTORY ============

/**
 * Creates a matrix of cards for visual regression testing
 * across all layout and size combinations
 * @returns Array of cards with different configurations
 */
export function createFakeCardMatrix(): FakeCard[] {
  const matrix: FakeCard[] = [];

  for (const layout of CARD_LAYOUTS) {
    for (const size of CARD_SIZES) {
      matrix.push({
        ...createFakeCard(),
        id: `${layout}-${size}`,
        title: `${layout} / ${size}`,
        layout,
        size,
      });
    }
  }

  return matrix;
}

/**
 * Creates card configuration for different scenarios
 * @param scenario - Scenario name
 * @returns Card configuration
 */
export function createFakeCardConfig(
  scenario: 'default' | 'full' | 'minimal' | 'withImage' = 'default'
): FakeCardConfig {
  const configs: Record<string, FakeCardConfig> = {
    default: {
      layout: 'default',
      size: 'default',
      hasImage: true,
      hasBadge: false,
      hasFooter: true,
      hasActions: true,
    },
    full: {
      layout: 'default',
      size: 'large',
      hasImage: true,
      hasBadge: true,
      hasFooter: true,
      hasActions: true,
    },
    minimal: {
      layout: 'default',
      size: 'compact',
      hasImage: false,
      hasBadge: false,
      hasFooter: false,
      hasActions: false,
    },
    withImage: {
      layout: 'vertical',
      size: 'default',
      hasImage: true,
      hasBadge: false,
      hasFooter: false,
      hasActions: false,
    },
  };

  return configs[scenario];
}

/**
 * Creates a set of demo cards for showcase
 * @returns Object with different card types
 */
export function createFakeDemoCards(): Record<string, FakeCard | FakeCard[]> {
  return {
    article: createFakeArticleCard(),
    articles: createFakeArticleCards(3),
    basic: createFakeCard(),
    compact: createFakeCompactCard(),
    dashboardStats: createFakeDashboardStats(),
    featured: createFakeFeaturedCard(),
    horizontal: createFakeHorizontalCard(),
    pricingTable: createFakePricingTable(),
    product: createFakeProductCard(),
    products: createFakeProductCards(4),
    profile: createFakeProfileCard(),
    profiles: createFakeProfileCards(6),
    stats: createFakeStatsCard(),
    textOnly: createFakeTextOnlyCard(),
  };
}
