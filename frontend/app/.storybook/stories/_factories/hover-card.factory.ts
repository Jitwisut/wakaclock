/**
 * Hover Card Factory
 *
 * Provides faker-based test data generation for HoverCard component stories.
 * Supports user profiles, product previews, projects, teams, stats,
 * and various hover card configurations.
 *
 * @module hover-card.factory
 * @see {@link file://./../../../components/ui/hover-card.tsx}
 * @see {@link file://./../_handlers/hover-card.handlers.ts}
 * @see {@link file://./../components/ui/hover-card.stories.tsx}
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// SHARED STRING CONSTANTS
// ============================================================================

const LABEL_DELETE = i18n.t('factory.hoverCard.delete', 'Delete');

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Hover card content side position
 */
export type HoverCardSide = 'bottom' | 'left' | 'right' | 'top';

/**
 * Hover card content alignment
 */
export type HoverCardAlign = 'center' | 'end' | 'start';

/**
 * Hover card content type
 */
export type HoverCardContentType =
  | 'actions'
  | 'info'
  | 'preview'
  | 'product'
  | 'profile'
  | 'project'
  | 'stats'
  | 'team';

/**
 * Hover card width size
 */
export type HoverCardWidth = 'compact' | 'default' | 'wide';

/**
 * Hover card trigger type
 */
export type HoverCardTriggerType = 'avatar' | 'badge' | 'icon' | 'link' | 'text';

// ============================================================================
// CONSTANTS
// ============================================================================

/** All hover card side positions */
export const HOVER_CARD_SIDES: HoverCardSide[] = ['bottom', 'left', 'right', 'top'];

/** All hover card alignments */
export const HOVER_CARD_ALIGNS: HoverCardAlign[] = ['center', 'end', 'start'];

/** All hover card content types */
export const HOVER_CARD_CONTENT_TYPES: HoverCardContentType[] = [
  'actions',
  'info',
  'preview',
  'product',
  'profile',
  'project',
  'stats',
  'team',
];

/** All hover card width sizes */
export const HOVER_CARD_WIDTHS: HoverCardWidth[] = ['compact', 'default', 'wide'];

/** All hover card trigger types */
export const HOVER_CARD_TRIGGER_TYPES: HoverCardTriggerType[] = [
  'avatar',
  'badge',
  'icon',
  'link',
  'text',
];

/** Default open delays in ms */
export const HOVER_CARD_OPEN_DELAYS = [0, 200, 500, 700, 1000, 1500];

/** Default close delays in ms */
export const HOVER_CARD_CLOSE_DELAYS = [0, 100, 200, 300, 500];

/** Width class mappings */
export const HOVER_CARD_WIDTH_CLASSES: Record<HoverCardWidth, string> = {
  compact: 'w-48',
  default: 'w-64',
  wide: 'w-96',
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base hover card configuration
 */
export interface FakeHoverCard {
  /** Content alignment */
  align: HoverCardAlign;
  /** Close delay in ms */
  closeDelay: number;
  /** Content type */
  contentType: HoverCardContentType;
  /** Unique ID */
  id: string;
  /** Open delay in ms */
  openDelay: number;
  /** Content side position */
  side: HoverCardSide;
  /** Side offset in pixels */
  sideOffset: number;
  /** Trigger label */
  triggerLabel: string;
  /** Trigger type */
  triggerType: HoverCardTriggerType;
  /** Content width */
  width: HoverCardWidth;
}

/**
 * User profile data for hover card
 */
export interface FakeHoverCardUserProfile {
  /** Avatar URL */
  avatar: string;
  /** User bio */
  bio: string;
  /** Follower count */
  followers: number;
  /** Following count */
  following: number;
  /** Unique ID */
  id: string;
  /** Joined date */
  joinedDate: string;
  /** Location */
  location?: string;
  /** User display name */
  name: string;
  /** Username handle */
  username: string;
  /** Verified status */
  verified?: boolean;
  /** Website URL */
  website?: string;
}

/**
 * Product data for hover card
 */
export interface FakeHoverCardProduct {
  /** Product category */
  category: string;
  /** Product description */
  description: string;
  /** Discount percentage */
  discount?: number;
  /** Unique ID */
  id: string;
  /** Product image URL */
  image: string;
  /** In stock status */
  inStock: boolean;
  /** Product name */
  name: string;
  /** Original price */
  originalPrice?: number;
  /** Current price */
  price: number;
  /** Rating (0-5) */
  rating: number;
  /** Number of reviews */
  reviewCount: number;
}

/**
 * Project data for hover card
 */
export interface FakeHoverCardProject {
  /** Project description */
  description: string;
  /** Unique ID */
  id: string;
  /** Last updated date */
  lastUpdated: string;
  /** Team member count */
  memberCount: number;
  /** Project name */
  name: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Project status */
  status: 'active' | 'archived' | 'completed' | 'paused';
  /** Task count */
  taskCount: number;
}

/**
 * Team data for hover card
 */
export interface FakeHoverCardTeam {
  /** Department name */
  department: string;
  /** Team description */
  description: string;
  /** Unique ID */
  id: string;
  /** Team lead name */
  lead: string;
  /** Member avatars (first 5) */
  memberAvatars: string[];
  /** Total member count */
  memberCount: number;
  /** Team name */
  name: string;
  /** Active project count */
  projectCount: number;
}

/**
 * Stats data for hover card
 */
export interface FakeHoverCardStats {
  /** Change from previous period */
  change: number;
  /** Change direction */
  changeDirection: 'down' | 'neutral' | 'up';
  /** Unique ID */
  id: string;
  /** Stat label */
  label: string;
  /** Previous period value */
  previousValue: number;
  /** Trend percentage */
  trend: number;
  /** Stat unit */
  unit?: string;
  /** Current value */
  value: number;
}

/**
 * Action item for hover card
 */
export interface FakeHoverCardAction {
  /** Action description */
  description?: string;
  /** Whether action is destructive */
  destructive?: boolean;
  /** Whether action is disabled */
  disabled?: boolean;
  /** Icon name */
  icon?: string;
  /** Unique ID */
  id: string;
  /** Action label */
  label: string;
  /** Action type */
  variant: 'default' | 'destructive' | 'ghost' | 'outline' | 'secondary';
}

/**
 * Complete hover card content configuration
 */
export interface FakeHoverCardContent {
  /** Action items */
  actions?: FakeHoverCardAction[];
  /** Configuration */
  config: FakeHoverCard;
  /** Info text */
  infoText?: string;
  /** Product data */
  product?: FakeHoverCardProduct;
  /** Project data */
  project?: FakeHoverCardProject;
  /** Stats data */
  stats?: FakeHoverCardStats;
  /** Team data */
  team?: FakeHoverCardTeam;
  /** Title */
  title?: string;
  /** User profile */
  userProfile?: FakeHoverCardUserProfile;
}

// ============================================================================
// HELPER FACTORIES
// ============================================================================

/**
 * Creates a fake hover card configuration
 */
export function createFakeHoverCard(overrides?: Partial<FakeHoverCard>): FakeHoverCard {
  return {
    align: faker.helpers.arrayElement(HOVER_CARD_ALIGNS),
    closeDelay: faker.helpers.arrayElement(HOVER_CARD_CLOSE_DELAYS),
    contentType: faker.helpers.arrayElement(HOVER_CARD_CONTENT_TYPES),
    id: faker.string.uuid(),
    openDelay: faker.helpers.arrayElement(HOVER_CARD_OPEN_DELAYS),
    side: faker.helpers.arrayElement(HOVER_CARD_SIDES),
    sideOffset: faker.helpers.arrayElement([0, 4, 8, 12, 16]),
    triggerLabel: faker.lorem.words(2),
    triggerType: faker.helpers.arrayElement(HOVER_CARD_TRIGGER_TYPES),
    width: faker.helpers.arrayElement(HOVER_CARD_WIDTHS),
    ...overrides,
  };
}

/**
 * Creates a fake user profile for hover card
 */
export function createFakeHoverCardUserProfile(
  overrides?: Partial<FakeHoverCardUserProfile>
): FakeHoverCardUserProfile {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    avatar: faker.image.avatar(),
    bio: faker.lorem.sentence(),
    followers: faker.number.int({ min: 10, max: 100_000 }),
    following: faker.number.int({ min: 10, max: 5000 }),
    id: faker.string.uuid(),
    joinedDate: faker.date.past({ years: 5 }).toISOString(),
    location: faker.helpers.maybe(() => `${faker.location.city()}, ${faker.location.country()}`, {
      probability: 0.6,
    }),
    name: `${firstName} ${lastName}`,
    username: faker.internet.username({ firstName, lastName }).toLowerCase(),
    verified: faker.datatype.boolean({ probability: 0.2 }),
    website: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.4 }),
    ...overrides,
  };
}

/**
 * Creates a fake product for hover card
 */
export function createFakeHoverCardProduct(
  overrides?: Partial<FakeHoverCardProduct>
): FakeHoverCardProduct {
  const hasDiscount = faker.datatype.boolean({ probability: 0.3 });
  const originalPrice = faker.number.float({ min: 10, max: 500, fractionDigits: 2 });
  const discount = hasDiscount ? faker.number.int({ min: 10, max: 50 }) : undefined;
  const price = discount ? originalPrice * (1 - discount / 100) : originalPrice;

  return {
    category: faker.commerce.department(),
    description: faker.commerce.productDescription(),
    discount,
    id: faker.string.uuid(),
    image: faker.image.urlLoremFlickr({ category: 'product' }),
    inStock: faker.datatype.boolean({ probability: 0.85 }),
    name: faker.commerce.productName(),
    originalPrice: hasDiscount ? originalPrice : undefined,
    price: Number(price.toFixed(2)),
    rating: faker.number.float({ min: 3, max: 5, fractionDigits: 1 }),
    reviewCount: faker.number.int({ min: 5, max: 1000 }),
    ...overrides,
  };
}

/**
 * Creates a fake project for hover card
 */
export function createFakeHoverCardProject(
  overrides?: Partial<FakeHoverCardProject>
): FakeHoverCardProject {
  const statuses: Array<'active' | 'archived' | 'completed' | 'paused'> = [
    'active',
    'archived',
    'completed',
    'paused',
  ];

  return {
    description: faker.lorem.sentence(),
    id: faker.string.uuid(),
    lastUpdated: faker.date.recent({ days: 7 }).toISOString(),
    memberCount: faker.number.int({ min: 2, max: 20 }),
    name: faker.company.catchPhrase(),
    progress: faker.number.int({ min: 0, max: 100 }),
    status: faker.helpers.arrayElement(statuses),
    taskCount: faker.number.int({ min: 5, max: 100 }),
    ...overrides,
  };
}

/**
 * Creates a fake team for hover card
 */
export function createFakeHoverCardTeam(overrides?: Partial<FakeHoverCardTeam>): FakeHoverCardTeam {
  const memberCount = faker.number.int({ min: 3, max: 25 });

  return {
    department: faker.commerce.department(),
    description: faker.lorem.sentence(),
    id: faker.string.uuid(),
    lead: faker.person.fullName(),
    memberAvatars: Array.from({ length: Math.min(5, memberCount) }, () => faker.image.avatar()),
    memberCount,
    name: i18n.t('factory.hoverCard.teamName', '{{adjective}} {{noun}} Team', {
      adjective: faker.word.adjective(),
      noun: faker.word.noun(),
    }),
    projectCount: faker.number.int({ min: 1, max: 10 }),
    ...overrides,
  };
}

/**
 * Creates fake stats for hover card
 */
export function createFakeHoverCardStats(
  overrides?: Partial<FakeHoverCardStats>
): FakeHoverCardStats {
  const labels = [
    i18n.t('factory.hoverCard.totalRevenue', 'Total Revenue'),
    i18n.t('factory.hoverCard.activeUsers', 'Active Users'),
    i18n.t('factory.hoverCard.newSignups', 'New Signups'),
    i18n.t('factory.hoverCard.conversionRate', 'Conversion Rate'),
    i18n.t('factory.hoverCard.pageViews', 'Page Views'),
    i18n.t('factory.hoverCard.sessions', 'Sessions'),
    i18n.t('factory.hoverCard.bounceRate', 'Bounce Rate'),
    i18n.t('factory.hoverCard.avgOrderValue', 'Avg. Order Value'),
  ];
  const units = ['$', '%', 'K', 'M', undefined];
  const previousValue = faker.number.int({ min: 1000, max: 50_000 });
  const change = faker.number.int({ min: -30, max: 50 });
  const currentValue = Math.round(previousValue * (1 + change / 100));

  let changeDirection: 'down' | 'neutral' | 'up' = 'neutral';
  if (change > 2) changeDirection = 'up';
  else if (change < -2) changeDirection = 'down';

  return {
    change,
    changeDirection,
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(labels),
    previousValue,
    trend: change,
    unit: faker.helpers.arrayElement(units),
    value: currentValue,
    ...overrides,
  };
}

/**
 * Creates a fake action for hover card
 */
export function createFakeHoverCardAction(
  overrides?: Partial<FakeHoverCardAction>
): FakeHoverCardAction {
  const labels = [
    i18n.t('factory.hoverCard.view', 'View'),
    i18n.t('factory.hoverCard.edit', 'Edit'),
    LABEL_DELETE,
    i18n.t('factory.hoverCard.share', 'Share'),
    i18n.t('factory.hoverCard.download', 'Download'),
    i18n.t('factory.hoverCard.copy', 'Copy'),
    i18n.t('factory.hoverCard.archive', 'Archive'),
    i18n.t('factory.hoverCard.pin', 'Pin'),
    i18n.t('factory.hoverCard.follow', 'Follow'),
    i18n.t('factory.hoverCard.block', 'Block'),
  ];
  const icons = [
    'eye',
    'pencil',
    'trash',
    'share',
    'download',
    'copy',
    'archive',
    'pin',
    'heart',
    'ban',
  ];
  const variants: Array<'default' | 'destructive' | 'ghost' | 'outline' | 'secondary'> = [
    'default',
    'destructive',
    'ghost',
    'outline',
    'secondary',
  ];
  const label = faker.helpers.arrayElement(labels);
  const isDestructive =
    label === LABEL_DELETE || label === i18n.t('factory.hoverCard.block', 'Block');

  return {
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    destructive: isDestructive,
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    icon: faker.helpers.arrayElement(icons),
    id: faker.string.uuid(),
    label,
    variant: isDestructive ? 'destructive' : faker.helpers.arrayElement(variants),
    ...overrides,
  };
}

/**
 * Creates multiple fake actions
 */
export function createFakeHoverCardActions(count: number = 3): FakeHoverCardAction[] {
  const labels = [
    i18n.t('factory.hoverCard.view', 'View'),
    i18n.t('factory.hoverCard.edit', 'Edit'),
    LABEL_DELETE,
    i18n.t('factory.hoverCard.share', 'Share'),
    i18n.t('factory.hoverCard.download', 'Download'),
    i18n.t('factory.hoverCard.copy', 'Copy'),
  ];
  const selectedLabels = faker.helpers.arrayElements(labels, count);

  return selectedLabels.map((label) =>
    createFakeHoverCardAction({
      label,
      destructive: label === LABEL_DELETE,
      variant: label === LABEL_DELETE ? 'destructive' : 'default',
    })
  );
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a user profile hover card
 */
export function createFakeUserProfileHoverCard(): FakeHoverCardContent {
  return {
    config: createFakeHoverCard({
      contentType: 'profile',
      triggerType: 'link',
      width: 'wide',
    }),
    userProfile: createFakeHoverCardUserProfile(),
  };
}

/**
 * Creates a product preview hover card
 */
export function createFakeProductHoverCard(): FakeHoverCardContent {
  return {
    config: createFakeHoverCard({
      contentType: 'product',
      triggerType: 'link',
      width: 'wide',
    }),
    product: createFakeHoverCardProduct(),
  };
}

/**
 * Creates a project info hover card
 */
export function createFakeProjectHoverCard(): FakeHoverCardContent {
  return {
    config: createFakeHoverCard({
      contentType: 'project',
      triggerType: 'link',
      width: 'default',
    }),
    project: createFakeHoverCardProject(),
  };
}

/**
 * Creates a team info hover card
 */
export function createFakeTeamHoverCard(): FakeHoverCardContent {
  return {
    config: createFakeHoverCard({
      contentType: 'team',
      triggerType: 'link',
      width: 'wide',
    }),
    team: createFakeHoverCardTeam(),
  };
}

/**
 * Creates a stats hover card
 */
export function createFakeStatsHoverCard(): FakeHoverCardContent {
  return {
    config: createFakeHoverCard({
      contentType: 'stats',
      triggerType: 'text',
      width: 'default',
    }),
    stats: createFakeHoverCardStats(),
  };
}

/**
 * Creates an actions hover card
 */
export function createFakeActionsHoverCard(): FakeHoverCardContent {
  return {
    actions: createFakeHoverCardActions(4),
    config: createFakeHoverCard({
      contentType: 'actions',
      triggerType: 'text',
      width: 'compact',
    }),
    title: i18n.t('factory.hoverCard.quickActions', 'Quick Actions'),
  };
}

/**
 * Creates an info hover card
 */
export function createFakeInfoHoverCard(): FakeHoverCardContent {
  return {
    config: createFakeHoverCard({
      contentType: 'info',
      triggerType: 'icon',
      width: 'default',
    }),
    infoText: faker.lorem.paragraph(),
    title: faker.lorem.words(3),
  };
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of hover cards by side and alignment
 */
export function createFakeHoverCardPositionMatrix(): Record<
  HoverCardSide,
  Record<HoverCardAlign, FakeHoverCard>
> {
  const result = {} as Record<HoverCardSide, Record<HoverCardAlign, FakeHoverCard>>;

  for (const side of HOVER_CARD_SIDES) {
    result[side] = {} as Record<HoverCardAlign, FakeHoverCard>;
    for (const align of HOVER_CARD_ALIGNS) {
      result[side][align] = createFakeHoverCard({
        side,
        align,
        triggerLabel: i18n.t('factory.hoverCard.sideAlignLabel', '{{side}} - {{align}}', {
          side,
          align,
        }),
      });
    }
  }

  return result;
}

/**
 * Creates a matrix of hover cards by content type and width
 */
export function createFakeHoverCardContentMatrix(): Record<
  HoverCardContentType,
  Record<HoverCardWidth, FakeHoverCardContent>
> {
  const result = {} as Record<HoverCardContentType, Record<HoverCardWidth, FakeHoverCardContent>>;

  for (const contentType of HOVER_CARD_CONTENT_TYPES) {
    result[contentType] = {} as Record<HoverCardWidth, FakeHoverCardContent>;
    for (const width of HOVER_CARD_WIDTHS) {
      const config = createFakeHoverCard({ contentType, width });
      const content: FakeHoverCardContent = { config };

      switch (contentType) {
        case 'profile': {
          content.userProfile = createFakeHoverCardUserProfile();
          break;
        }
        case 'product': {
          content.product = createFakeHoverCardProduct();
          break;
        }
        case 'project': {
          content.project = createFakeHoverCardProject();
          break;
        }
        case 'team': {
          content.team = createFakeHoverCardTeam();
          break;
        }
        case 'stats': {
          content.stats = createFakeHoverCardStats();
          break;
        }
        case 'actions': {
          content.actions = createFakeHoverCardActions(3);
          content.title = i18n.t('factory.hoverCard.actions', 'Actions');
          break;
        }
        case 'info':
        case 'preview': {
          content.title = faker.lorem.words(3);
          content.infoText = faker.lorem.paragraph();
          break;
        }
        default: {
          // All content types are handled above
          break;
        }
      }

      result[contentType][width] = content;
    }
  }

  return result;
}

/**
 * Creates a timing configuration matrix
 */
export function createFakeHoverCardTimingMatrix(): Array<{
  closeDelay: number;
  label: string;
  openDelay: number;
}> {
  return [
    { openDelay: 0, closeDelay: 0, label: i18n.t('factory.hoverCard.instant', 'Instant') },
    { openDelay: 200, closeDelay: 100, label: i18n.t('factory.hoverCard.fast', 'Fast') },
    { openDelay: 500, closeDelay: 200, label: i18n.t('factory.hoverCard.medium', 'Medium') },
    { openDelay: 700, closeDelay: 300, label: i18n.t('factory.hoverCard.default', 'Default') },
    { openDelay: 1000, closeDelay: 400, label: i18n.t('factory.hoverCard.slow', 'Slow') },
    { openDelay: 1500, closeDelay: 500, label: i18n.t('factory.hoverCard.verySlow', 'Very Slow') },
  ];
}

/**
 * Creates a showcase of all hover card content types
 */
export function createFakeHoverCardShowcase(): Record<HoverCardContentType, FakeHoverCardContent> {
  return {
    actions: createFakeActionsHoverCard(),
    info: createFakeInfoHoverCard(),
    preview: {
      config: createFakeHoverCard({ contentType: 'preview', width: 'default' }),
      infoText: faker.lorem.paragraph(),
      title: i18n.t('factory.hoverCard.preview', 'Preview'),
    },
    product: createFakeProductHoverCard(),
    profile: createFakeUserProfileHoverCard(),
    project: createFakeProjectHoverCard(),
    stats: createFakeStatsHoverCard(),
    team: createFakeTeamHoverCard(),
  };
}

// ============================================================================
// SPECIALIZED POSITION/TIMING FACTORIES
// ============================================================================

/**
 * Creates hover cards for each side position
 */
export function createFakeHoverCardsForAllSides(): Record<HoverCardSide, FakeHoverCard> {
  const result = {} as Record<HoverCardSide, FakeHoverCard>;

  for (const side of HOVER_CARD_SIDES) {
    result[side] = createFakeHoverCard({
      side,
      triggerLabel: i18n.t('factory.hoverCard.positionLabel', 'Position: {{side}}', { side }),
    });
  }

  return result;
}

/**
 * Creates hover cards for each alignment option
 */
export function createFakeHoverCardsForAllAligns(): Record<HoverCardAlign, FakeHoverCard> {
  const result = {} as Record<HoverCardAlign, FakeHoverCard>;

  for (const align of HOVER_CARD_ALIGNS) {
    result[align] = createFakeHoverCard({
      align,
      triggerLabel: i18n.t('factory.hoverCard.alignLabel', 'Align: {{align}}', { align }),
    });
  }

  return result;
}

/**
 * Creates a set of hover cards with different sideOffset values
 */
export function createFakeHoverCardsWithOffsets(): Array<{
  config: FakeHoverCard;
  offset: number;
}> {
  const offsets = [0, 4, 8, 12, 16, 24, 32];

  return offsets.map((offset) => ({
    offset,
    config: createFakeHoverCard({
      sideOffset: offset,
      triggerLabel: i18n.t('factory.hoverCard.offsetLabel', 'Offset: {{offset}}px', { offset }),
    }),
  }));
}

/**
 * Creates a controlled hover card configuration for testing
 */
export interface FakeControlledHoverCard {
  config: FakeHoverCard;
  defaultOpen?: boolean;
  open?: boolean;
}

export function createFakeControlledHoverCard(
  overrides?: Partial<FakeControlledHoverCard>
): FakeControlledHoverCard {
  return {
    config: createFakeHoverCard(),
    open: faker.datatype.boolean({ probability: 0.3 }),
    defaultOpen: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

// ============================================================================
// DARK MODE FACTORY
// ============================================================================

/**
 * Creates a hover card configuration optimized for dark mode testing
 */
export function createFakeDarkModeHoverCard(): FakeHoverCardContent {
  return {
    config: createFakeHoverCard({
      width: 'wide',
      triggerType: 'link',
      openDelay: 200,
      closeDelay: 100,
    }),
    userProfile: createFakeHoverCardUserProfile({
      name: i18n.t('factory.hoverCard.darkModeUser', 'Dark Mode User'),
      bio: i18n.t(
        'factory.hoverCard.testingContrastAndVisibilityIn',
        'Testing contrast and visibility in dark theme.'
      ),
      verified: true,
    }),
  };
}

// ============================================================================
// FOCUS MANAGEMENT FACTORY
// ============================================================================

/**
 * Configuration for focus management testing
 */
export interface FakeFocusTestConfig {
  afterButtonLabel: string;
  beforeButtonLabel: string;
  hoverCard: FakeHoverCard;
  triggerLabel: string;
}

export function createFakeFocusTestConfig(): FakeFocusTestConfig {
  return {
    beforeButtonLabel: faker.helpers.arrayElement([
      i18n.t('factory.hoverCard.previous', 'Previous'),
      i18n.t('factory.hoverCard.back', 'Back'),
      i18n.t('factory.hoverCard.before', 'Before'),
    ]),
    triggerLabel: faker.helpers.arrayElement([
      i18n.t('factory.hoverCard.viewDetails', 'View Details'),
      i18n.t('factory.hoverCard.showInfo', 'Show Info'),
      i18n.t('factory.hoverCard.more', 'More'),
    ]),
    afterButtonLabel: faker.helpers.arrayElement([
      i18n.t('factory.hoverCard.next', 'Next'),
      i18n.t('factory.hoverCard.forward', 'Forward'),
      i18n.t('factory.hoverCard.after', 'After'),
    ]),
    hoverCard: createFakeHoverCard({
      openDelay: 300,
      closeDelay: 150,
    }),
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple hover cards for list/grid displays
 */
export function createFakeHoverCards(count: number): FakeHoverCard[] {
  return Array.from({ length: count }, () => createFakeHoverCard());
}

/**
 * Creates multiple user profile hover cards
 */
export function createFakeUserProfileHoverCards(count: number): FakeHoverCardContent[] {
  return Array.from({ length: count }, () => createFakeUserProfileHoverCard());
}

/**
 * Creates multiple product hover cards
 */
export function createFakeProductHoverCards(count: number): FakeHoverCardContent[] {
  return Array.from({ length: count }, () => createFakeProductHoverCard());
}

/**
 * Creates multiple project hover cards
 */
export function createFakeProjectHoverCards(count: number): FakeHoverCardContent[] {
  return Array.from({ length: count }, () => createFakeProjectHoverCard());
}
