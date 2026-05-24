/**
 * Drawer Factory
 *
 * Provides faker-based test data generation for Drawer component stories.
 * Supports various drawer directions, sizes, and common use cases like
 * navigation, filters, settings panels, and mobile menus.
 *
 * @module drawer.factory
 * @see {@link file://./../../../components/ui/drawer.tsx}
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Drawer direction (slide-in direction)
 * @description Controls which edge the drawer slides in from
 */
export type DrawerDirection = 'bottom' | 'left' | 'right' | 'top';

/**
 * Drawer size variants
 * @description Controls the width/height of the drawer based on direction
 */
export type DrawerSize = 'default' | 'full' | 'lg' | 'sm' | 'xl';

/**
 * Drawer type classifications
 * @description Semantic types for different drawer use cases
 */
export type DrawerType =
  | 'cart'
  | 'filters'
  | 'menu'
  | 'navigation'
  | 'notifications'
  | 'panel'
  | 'settings';

/**
 * Snap point options for bottom drawer
 * @description Predefined snap points for bottom sheet behavior
 */
export type DrawerSnapPoint = 0.25 | 0.5 | 0.75 | 1;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base drawer content interface
 */
export interface FakeDrawerContent {
  /** Cancel/close button label */
  cancelLabel?: string;
  /** Primary action button label */
  confirmLabel?: string;
  /** Drawer description text */
  description?: string;
  /** Whether this is a destructive action drawer */
  destructive?: boolean;
  /** Unique identifier */
  id: string;
  /** Drawer title */
  title: string;
}

/**
 * Navigation link item
 */
export interface FakeDrawerNavItem {
  /** Badge count (e.g., notifications) */
  badge?: number;
  /** Sub-items for nested navigation */
  children?: FakeDrawerNavItem[];
  /** Whether item is disabled */
  disabled?: boolean;
  /** Link URL or path */
  href: string;
  /** Icon name from lucide-react */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Whether this is the active/current item */
  isActive?: boolean;
  /** Display label */
  label: string;
}

/**
 * Navigation drawer configuration
 */
export interface FakeNavigationDrawer extends FakeDrawerContent {
  /** Footer content/links */
  footerLinks?: FakeDrawerNavItem[];
  /** Navigation sections */
  sections: Array<{
    items: FakeDrawerNavItem[];
    label?: string;
  }>;
  /** User info for header */
  user?: {
    avatar?: string;
    email: string;
    name: string;
  };
}

/**
 * Filter option interface
 */
export interface FakeFilterOption {
  /** Number of items matching this filter */
  count?: number;
  /** Whether filter is disabled */
  disabled?: boolean;
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Whether filter is selected */
  selected?: boolean;
  /** Option value */
  value: string;
}

/**
 * Filter group interface
 */
export interface FakeFilterGroup {
  /** Whether group is collapsed */
  collapsed?: boolean;
  /** Group identifier */
  id: string;
  /** Group label */
  label: string;
  /** Whether multiple selections are allowed */
  multiple?: boolean;
  /** Filter options */
  options: FakeFilterOption[];
  /** Filter type */
  type: 'checkbox' | 'radio' | 'range' | 'select';
}

/**
 * Filters drawer configuration
 */
export interface FakeFiltersDrawer extends FakeDrawerContent {
  /** Active filter count */
  activeFilterCount?: number;
  /** Filter groups */
  filterGroups: FakeFilterGroup[];
  /** Applied filters summary */
  filtersSummary?: string;
  /** Whether to show clear all button */
  showClearAll?: boolean;
}

/**
 * Cart item interface
 */
export interface FakeCartItem {
  /** Unique identifier */
  id: string;
  /** Product image URL */
  image: string;
  /** Maximum available quantity */
  maxQuantity?: number;
  /** Product name */
  name: string;
  /** Unit price */
  price: number;
  /** Item quantity */
  quantity: number;
  /** Product variant (e.g., size, color) */
  variant?: string;
}

/**
 * Cart drawer configuration
 */
export interface FakeCartDrawer extends FakeDrawerContent {
  /** Currency code */
  currency?: string;
  /** Discount amount */
  discount?: number;
  /** Discount code applied */
  discountCode?: string;
  /** Whether cart is empty */
  isEmpty?: boolean;
  /** Cart items */
  items: FakeCartItem[];
  /** Shipping cost */
  shipping?: number;
  /** Subtotal amount */
  subtotal: number;
  /** Total amount */
  total: number;
}

/**
 * Notification item interface
 */
export interface FakeNotificationItem {
  /** Action button label */
  action?: string;
  /** Whether notification can be dismissed */
  dismissible?: boolean;
  /** Icon name */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Notification message */
  message: string;
  /** Whether notification is read */
  read: boolean;
  /** Notification timestamp */
  timestamp: Date;
  /** Notification title */
  title: string;
  /** Notification type */
  type: 'error' | 'info' | 'success' | 'warning';
}

/**
 * Notifications drawer configuration
 */
export interface FakeNotificationsDrawer extends FakeDrawerContent {
  /** Notifications list */
  notifications: FakeNotificationItem[];
  /** Whether to show mark all read button */
  showMarkAllRead?: boolean;
  /** Unread count */
  unreadCount: number;
}

/**
 * Settings section interface
 */
export interface FakeSettingsSection {
  /** Section description */
  description?: string;
  /** Settings fields */
  fields: Array<{
    defaultValue?: boolean | number | string;
    description?: string;
    disabled?: boolean;
    id: string;
    label: string;
    options?: Array<{ label: string; value: string }>;
    type: 'checkbox' | 'number' | 'radio' | 'select' | 'text' | 'toggle';
  }>;
  /** Section identifier */
  id: string;
  /** Section title */
  title: string;
}

/**
 * Settings drawer configuration
 */
export interface FakeSettingsDrawer extends FakeDrawerContent {
  /** Whether there are unsaved changes */
  isDirty?: boolean;
  /** Settings sections */
  sections: FakeSettingsSection[];
}

/**
 * Complete drawer configuration
 */
export interface FakeDrawer {
  /** Drawer content */
  content: FakeDrawerContent;
  /** Drawer direction */
  direction: DrawerDirection;
  /** Whether dialog can be closed by clicking outside */
  dismissible?: boolean;
  /** Unique identifier */
  id: string;
  /** Whether drawer is open by default */
  open?: boolean;
  /** Show handle bar (for bottom drawer) */
  showHandle?: boolean;
  /** Drawer size */
  size?: DrawerSize;
  /** Snap points for bottom drawer */
  snapPoints?: DrawerSnapPoint[];
  /** Drawer type */
  type: DrawerType;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Drawer direction options
 */
export const DRAWER_DIRECTIONS: DrawerDirection[] = ['bottom', 'left', 'right', 'top'];

/**
 * Drawer size options
 */
export const DRAWER_SIZES: DrawerSize[] = ['sm', 'default', 'lg', 'xl', 'full'];

/**
 * Drawer type options
 */
export const DRAWER_TYPES: DrawerType[] = [
  'cart',
  'filters',
  'menu',
  'navigation',
  'notifications',
  'panel',
  'settings',
];

/**
 * Default snap points for bottom sheet
 */
export const DEFAULT_SNAP_POINTS: DrawerSnapPoint[] = [0.25, 0.5, 0.75, 1];

/**
 * Common navigation items
 */
export const NAVIGATION_ITEMS = [
  { icon: 'Home', label: i18n.t('factory.drawer.home', 'Home'), href: '/' },
  {
    icon: 'LayoutDashboard',
    label: i18n.t('factory.drawer.dashboard', 'Dashboard'),
    href: '/dashboard',
  },
  { icon: 'Users', label: i18n.t('factory.drawer.users', 'Users'), href: '/users' },
  { icon: 'ShoppingCart', label: i18n.t('factory.drawer.orders', 'Orders'), href: '/orders' },
  { icon: 'Package', label: i18n.t('factory.drawer.products', 'Products'), href: '/products' },
  { icon: 'BarChart', label: i18n.t('factory.drawer.analytics', 'Analytics'), href: '/analytics' },
  { icon: 'Settings', label: i18n.t('factory.drawer.settings', 'Settings'), href: '/settings' },
  { icon: 'HelpCircle', label: i18n.t('factory.drawer.help', 'Help'), href: '/help' },
];

/**
 * Common filter categories
 */
export const FILTER_CATEGORIES = [
  i18n.t('factory.drawer.category', 'Category'),
  i18n.t('factory.drawer.priceRange', 'Price Range'),
  i18n.t('factory.drawer.brand', 'Brand'),
  i18n.t('factory.drawer.color', 'Color'),
  i18n.t('factory.drawer.size', 'Size'),
  i18n.t('factory.drawer.rating', 'Rating'),
] as const;

/**
 * Notification types with icons
 */
export const NOTIFICATION_ICONS: Record<FakeNotificationItem['type'], string> = {
  error: 'XCircle',
  info: i18n.t('factory.drawer.info', 'Info'),
  success: 'CheckCircle',
  warning: 'AlertTriangle',
};

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates fake drawer content
 */
export function createFakeDrawerContent(overrides?: Partial<FakeDrawerContent>): FakeDrawerContent {
  return {
    cancelLabel: faker.helpers.arrayElement([
      i18n.t('factory.drawer.cancel', 'Cancel'),
      i18n.t('factory.drawer.close', 'Close'),
      i18n.t('factory.drawer.dismiss', 'Dismiss'),
    ]),
    confirmLabel: faker.helpers.arrayElement([
      i18n.t('factory.drawer.save', 'Save'),
      i18n.t('factory.drawer.apply', 'Apply'),
      i18n.t('factory.drawer.continue', 'Continue'),
      i18n.t('factory.drawer.done', 'Done'),
    ]),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.6 }),
    destructive: faker.helpers.maybe(() => true, { probability: 0.15 }),
    id: faker.string.uuid(),
    title: faker.lorem.sentence({ min: 2, max: 5 }),
    ...overrides,
  };
}

/**
 * Creates a fake navigation item
 */
export function createFakeDrawerNavItem(overrides?: Partial<FakeDrawerNavItem>): FakeDrawerNavItem {
  const hasChildren = faker.helpers.maybe(() => true, { probability: 0.2 });

  return {
    badge: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 99 }), { probability: 0.15 }),
    children: hasChildren
      ? Array.from({ length: faker.number.int({ min: 2, max: 4 }) }, () =>
          createFakeDrawerNavItem({ children: undefined })
        )
      : undefined,
    disabled: faker.helpers.maybe(() => true, { probability: 0.05 }),
    href: `/${faker.word.noun().toLowerCase()}`,
    icon: faker.helpers.arrayElement(NAVIGATION_ITEMS.map((i) => i.icon)),
    id: faker.string.uuid(),
    isActive: faker.helpers.maybe(() => true, { probability: 0.1 }),
    label: faker.helpers.arrayElement(NAVIGATION_ITEMS.map((i) => i.label)),
    ...overrides,
  };
}

/**
 * Creates a fake filter option
 */
export function createFakeFilterOption(overrides?: Partial<FakeFilterOption>): FakeFilterOption {
  return {
    count: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 500 }), { probability: 0.6 }),
    disabled: faker.helpers.maybe(() => true, { probability: 0.05 }),
    id: faker.string.uuid(),
    label: faker.commerce.productAdjective(),
    selected: faker.helpers.maybe(() => true, { probability: 0.2 }),
    value: faker.string.alphanumeric(8),
    ...overrides,
  };
}

/**
 * Creates a fake filter group
 */
export function createFakeFilterGroup(overrides?: Partial<FakeFilterGroup>): FakeFilterGroup {
  const type =
    overrides?.type ??
    faker.helpers.arrayElement<FakeFilterGroup['type']>(['checkbox', 'radio', 'select']);

  return {
    collapsed: faker.helpers.maybe(() => true, { probability: 0.2 }),
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([...FILTER_CATEGORIES]),
    multiple: type === 'checkbox',
    options: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () =>
      createFakeFilterOption()
    ),
    type,
    ...overrides,
  };
}

/**
 * Creates a fake cart item
 */
export function createFakeCartItem(overrides?: Partial<FakeCartItem>): FakeCartItem {
  const quantity = overrides?.quantity ?? faker.number.int({ min: 1, max: 5 });
  const price =
    overrides?.price ?? faker.number.float({ min: 9.99, max: 299.99, fractionDigits: 2 });

  return {
    id: faker.string.uuid(),
    image: faker.image.url({ width: 80, height: 80 }),
    maxQuantity: faker.number.int({ min: quantity, max: 20 }),
    name: faker.commerce.productName(),
    price,
    quantity,
    variant: faker.helpers.maybe(
      () => `${faker.color.human()} / ${faker.helpers.arrayElement(['XS', 'S', 'M', 'L', 'XL'])}`,
      { probability: 0.5 }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake notification item
 */
export function createFakeNotificationItem(
  overrides?: Partial<FakeNotificationItem>
): FakeNotificationItem {
  const type =
    overrides?.type ??
    faker.helpers.arrayElement<FakeNotificationItem['type']>([
      'error',
      'info',
      'success',
      'warning',
    ]);

  return {
    action: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.drawer.view', 'View'),
          i18n.t('factory.drawer.open', 'Open'),
          i18n.t('factory.drawer.dismiss', 'Dismiss'),
        ]),
      {
        probability: 0.3,
      }
    ),
    dismissible: faker.helpers.maybe(() => true, { probability: 0.7 }),
    icon: NOTIFICATION_ICONS[type],
    id: faker.string.uuid(),
    message: faker.lorem.sentence(),
    read: faker.datatype.boolean(),
    timestamp: faker.date.recent({ days: 7 }),
    title: faker.lorem.sentence({ min: 2, max: 5 }),
    type,
    ...overrides,
  };
}

/**
 * Creates a fake settings section
 */
export function createFakeSettingsSection(
  overrides?: Partial<FakeSettingsSection>
): FakeSettingsSection {
  const sectionLabels = [
    i18n.t('factory.drawer.general', 'General'),
    i18n.t('factory.drawer.notifications', 'Notifications'),
    i18n.t('factory.drawer.privacy', 'Privacy'),
    i18n.t('factory.drawer.appearance', 'Appearance'),
    i18n.t('factory.drawer.language', 'Language'),
  ];

  return {
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 }),
    fields: Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, () => ({
      defaultValue: faker.datatype.boolean(),
      description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
      id: faker.string.uuid(),
      label: faker.word.words(2),
      type: faker.helpers.arrayElement<FakeSettingsSection['fields'][0]['type']>([
        'checkbox',
        'toggle',
        'select',
      ]),
    })),
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement(sectionLabels),
    ...overrides,
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple navigation items
 */
export function createFakeDrawerNavItems(count: number): FakeDrawerNavItem[] {
  return Array.from({ length: count }, () => createFakeDrawerNavItem());
}

/**
 * Creates multiple filter groups
 */
export function createFakeFilterGroups(count: number): FakeFilterGroup[] {
  return Array.from({ length: count }, () => createFakeFilterGroup());
}

/**
 * Creates multiple cart items
 */
export function createFakeCartItems(count: number): FakeCartItem[] {
  return Array.from({ length: count }, () => createFakeCartItem());
}

/**
 * Creates multiple notification items
 */
export function createFakeNotificationItems(count: number): FakeNotificationItem[] {
  return Array.from({ length: count }, () => createFakeNotificationItem());
}

/**
 * Creates a complete fake drawer configuration
 */
export function createFakeDrawer(overrides?: Partial<FakeDrawer>): FakeDrawer {
  const direction = overrides?.direction ?? faker.helpers.arrayElement(DRAWER_DIRECTIONS);
  const type = overrides?.type ?? faker.helpers.arrayElement(DRAWER_TYPES);

  return {
    content: createFakeDrawerContent(),
    direction,
    dismissible: true,
    id: faker.string.uuid(),
    open: false,
    showHandle: direction === 'bottom',
    size: faker.helpers.arrayElement(DRAWER_SIZES),
    snapPoints: direction === 'bottom' ? DEFAULT_SNAP_POINTS : undefined,
    type,
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a navigation drawer
 */
export function createFakeNavigationDrawer(
  overrides?: Partial<FakeNavigationDrawer>
): FakeNavigationDrawer {
  return {
    ...createFakeDrawerContent({ title: i18n.t('factory.drawer.navigation', 'Navigation') }),
    footerLinks: [
      {
        id: 'settings',
        label: i18n.t('factory.drawer.settings', 'Settings'),
        href: '/settings',
        icon: 'Settings',
      },
      {
        id: 'help',
        label: i18n.t('factory.drawer.help', 'Help'),
        href: '/help',
        icon: 'HelpCircle',
      },
      {
        id: 'logout',
        label: i18n.t('factory.drawer.logOut', 'Log out'),
        href: '/logout',
        icon: 'LogOut',
      },
    ],
    sections: [
      {
        label: i18n.t('factory.drawer.main', 'Main'),
        items: NAVIGATION_ITEMS.slice(0, 4).map((item, index) => ({
          id: faker.string.uuid(),
          label: item.label,
          href: item.href,
          icon: item.icon,
          isActive: index === 0,
        })),
      },
      {
        label: i18n.t('factory.drawer.management', 'Management'),
        items: NAVIGATION_ITEMS.slice(4, 7).map((item) => ({
          id: faker.string.uuid(),
          label: item.label,
          href: item.href,
          icon: item.icon,
        })),
      },
    ],
    user: {
      avatar: faker.image.avatar(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
    },
    ...overrides,
  };
}

/**
 * Creates a filters drawer
 */
export function createFakeFiltersDrawer(
  groupCount: number = 4,
  overrides?: Partial<FakeFiltersDrawer>
): FakeFiltersDrawer {
  const filterGroups = createFakeFilterGroups(groupCount);
  const activeCount = filterGroups.reduce(
    (acc, group) => acc + group.options.filter((o) => o.selected).length,
    0
  );

  return {
    ...createFakeDrawerContent({ title: i18n.t('factory.drawer.filters', 'Filters') }),
    activeFilterCount: activeCount,
    filterGroups,
    filtersSummary:
      activeCount > 0
        ? i18n.t('factory.drawer.filtersApplied', '{{count}} filters applied', {
            count: activeCount,
          })
        : undefined,
    showClearAll: activeCount > 0,
    ...overrides,
  };
}

/**
 * Creates a cart drawer
 */
export function createFakeCartDrawer(
  itemCount: number = 3,
  overrides?: Partial<FakeCartDrawer>
): FakeCartDrawer {
  const items = createFakeCartItems(itemCount);
  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shipping = subtotal > 100 ? 0 : 9.99;
  const discount = faker.helpers.maybe(
    () => faker.number.float({ min: 5, max: 25, fractionDigits: 2 }),
    {
      probability: 0.3,
    }
  );
  const total = subtotal + shipping - (discount ?? 0);

  return {
    ...createFakeDrawerContent({
      cancelLabel: i18n.t('factory.drawer.continueShopping', 'Continue Shopping'),
      confirmLabel: i18n.t('factory.drawer.checkout', 'Checkout'),
      title: i18n.t('factory.drawer.shoppingCart', 'Shopping Cart'),
    }),
    currency: 'USD',
    discount,
    discountCode: discount ? faker.string.alphanumeric(8).toUpperCase() : undefined,
    isEmpty: itemCount === 0,
    items,
    shipping,
    subtotal,
    total: Math.max(0, total),
    ...overrides,
  };
}

/**
 * Creates a notifications drawer
 */
export function createFakeNotificationsDrawer(
  count: number = 5,
  overrides?: Partial<FakeNotificationsDrawer>
): FakeNotificationsDrawer {
  const notifications = createFakeNotificationItems(count);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    ...createFakeDrawerContent({
      title: i18n.t('factory.drawer.notifications', 'Notifications'),
      description:
        unreadCount > 0
          ? i18n.t(
              'factory.drawer.unreadNotifications',
              'You have {{count}} unread notifications',
              { count: unreadCount }
            )
          : undefined,
    }),
    notifications,
    showMarkAllRead: unreadCount > 0,
    unreadCount,
    ...overrides,
  };
}

/**
 * Creates a settings drawer
 */
export function createFakeSettingsDrawer(
  sectionCount: number = 3,
  overrides?: Partial<FakeSettingsDrawer>
): FakeSettingsDrawer {
  return {
    ...createFakeDrawerContent({
      cancelLabel: i18n.t('factory.drawer.cancel', 'Cancel'),
      confirmLabel: i18n.t('factory.drawer.saveChanges', 'Save Changes'),
      title: i18n.t('factory.drawer.settings', 'Settings'),
    }),
    isDirty: faker.datatype.boolean(),
    sections: Array.from({ length: sectionCount }, () => createFakeSettingsSection()),
    ...overrides,
  };
}

/**
 * Creates a mobile menu drawer
 */
export function createFakeMobileMenuDrawer(): FakeNavigationDrawer {
  return createFakeNavigationDrawer({
    description: undefined,
    title: i18n.t('factory.drawer.menu', 'Menu'),
  });
}

/**
 * Creates a product details drawer (for quick view)
 */
export function createFakeProductQuickViewDrawer(): FakeDrawer {
  return {
    content: {
      cancelLabel: i18n.t('factory.drawer.close', 'Close'),
      confirmLabel: i18n.t('factory.drawer.addToCart', 'Add to Cart'),
      description: faker.commerce.productDescription(),
      id: faker.string.uuid(),
      title: faker.commerce.productName(),
    },
    direction: 'right',
    dismissible: true,
    id: faker.string.uuid(),
    showHandle: false,
    size: 'lg',
    type: 'panel',
  };
}

/**
 * Creates a help drawer
 */
export function createFakeHelpDrawer(): FakeDrawer {
  return {
    content: {
      cancelLabel: i18n.t('factory.drawer.close', 'Close'),
      description: i18n.t(
        'factory.drawer.findAnswersToCommonQuestions',
        'Find answers to common questions or contact support.'
      ),
      id: faker.string.uuid(),
      title: i18n.t('factory.drawer.helpSupport', 'Help & Support'),
    },
    direction: 'right',
    dismissible: true,
    id: faker.string.uuid(),
    showHandle: false,
    size: 'default',
    type: 'panel',
  };
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of drawer configurations for visual testing
 */
export function createFakeDrawerMatrix(): Record<string, FakeDrawer> {
  return {
    directionBottom: createFakeDrawer({ direction: 'bottom' }),
    directionTop: createFakeDrawer({ direction: 'top' }),
    directionLeft: createFakeDrawer({ direction: 'left' }),
    directionRight: createFakeDrawer({ direction: 'right' }),
    sizeSmall: createFakeDrawer({ size: 'sm', direction: 'right' }),
    sizeDefault: createFakeDrawer({ size: 'default', direction: 'right' }),
    sizeLarge: createFakeDrawer({ size: 'lg', direction: 'right' }),
    sizeXl: createFakeDrawer({ size: 'xl', direction: 'right' }),
    sizeFull: createFakeDrawer({ size: 'full', direction: 'right' }),
    withSnapPoints: createFakeDrawer({
      direction: 'bottom',
      snapPoints: [0.25, 0.5, 1],
    }),
    notDismissible: createFakeDrawer({
      dismissible: false,
      direction: 'right',
    }),
  };
}

/**
 * Creates a showcase of all drawer types
 */
export function createFakeDrawerShowcase(): Record<
  string,
  | FakeCartDrawer
  | FakeDrawer
  | FakeFiltersDrawer
  | FakeNavigationDrawer
  | FakeNotificationsDrawer
  | FakeSettingsDrawer
> {
  return {
    navigation: createFakeNavigationDrawer(),
    mobileMenu: createFakeMobileMenuDrawer(),
    filters: createFakeFiltersDrawer(4),
    cart: createFakeCartDrawer(3),
    cartEmpty: createFakeCartDrawer(0),
    notifications: createFakeNotificationsDrawer(5),
    notificationsEmpty: createFakeNotificationsDrawer(0),
    settings: createFakeSettingsDrawer(3),
    productQuickView: createFakeProductQuickViewDrawer(),
    helpPanel: createFakeHelpDrawer(),
  };
}

// ============================================================================
// SWIPE GESTURE FACTORIES
// ============================================================================

/**
 * Swipe gesture state interface
 */
export interface FakeSwipeGesture {
  /** Current position during swipe */
  currentPosition: number;
  /** Swipe direction */
  direction: 'down' | 'left' | 'right' | 'up';
  /** Whether gesture resulted in dismiss */
  dismissed: boolean;
  /** Unique identifier */
  id: string;
  /** Starting position */
  startPosition: number;
  /** Dismiss threshold */
  threshold: number;
  /** Swipe velocity */
  velocity: number;
}

/**
 * Creates a fake swipe gesture
 */
export function createFakeSwipeGesture(overrides?: Partial<FakeSwipeGesture>): FakeSwipeGesture {
  const velocity = overrides?.velocity ?? faker.number.float({ min: 0.1, max: 2.5 });
  const distance = faker.number.int({ min: 20, max: 300 });
  const threshold = overrides?.threshold ?? 100;

  return {
    currentPosition: distance,
    direction: faker.helpers.arrayElement(['up', 'down', 'left', 'right']),
    dismissed: velocity > 0.5 || distance > threshold,
    id: faker.string.uuid(),
    startPosition: 0,
    threshold,
    velocity,
    ...overrides,
  };
}

/**
 * Creates a successful dismiss swipe gesture
 */
export function createFakeSwipeDismiss(
  direction: FakeSwipeGesture['direction'] = 'down'
): FakeSwipeGesture {
  return createFakeSwipeGesture({
    direction,
    velocity: 1.5,
    currentPosition: 200,
    dismissed: true,
  });
}

/**
 * Creates a swipe gesture that doesn't dismiss (below threshold)
 */
export function createFakeSwipeBelowThreshold(
  direction: FakeSwipeGesture['direction'] = 'down'
): FakeSwipeGesture {
  return createFakeSwipeGesture({
    direction,
    velocity: 0.2,
    currentPosition: 30,
    dismissed: false,
  });
}

/**
 * Creates swipe gestures for all directions
 */
export function createFakeSwipeGesturesAllDirections(): Record<
  FakeSwipeGesture['direction'],
  FakeSwipeGesture
> {
  return {
    up: createFakeSwipeDismiss('up'),
    down: createFakeSwipeDismiss('down'),
    left: createFakeSwipeDismiss('left'),
    right: createFakeSwipeDismiss('right'),
  };
}

// ============================================================================
// ANIMATION STATE FACTORIES
// ============================================================================

/**
 * Slide animation state type
 */
export type SlideAnimationState = 'closed' | 'closing' | 'open' | 'opening';

/**
 * Slide animation state interface
 */
export interface FakeSlideState {
  /** Animation duration in ms */
  animationDuration: number;
  /** Slide direction */
  direction: DrawerDirection;
  /** Unique identifier */
  id: string;
  /** Whether currently animating */
  isAnimating: boolean;
  /** Animation progress (0-1) */
  progress: number;
  /** Current animation state */
  state: SlideAnimationState;
}

/**
 * Creates a fake slide animation state
 */
export function createFakeSlideState(overrides?: Partial<FakeSlideState>): FakeSlideState {
  const state =
    overrides?.state ??
    faker.helpers.arrayElement<SlideAnimationState>(['open', 'closed', 'opening', 'closing']);

  const isOpening = state === 'opening';
  const isClosing = state === 'closing';
  const isAnimating = isOpening || isClosing;

  let progress: number;
  if (state === 'open') {
    progress = 1;
  } else if (state === 'closed') {
    progress = 0;
  } else {
    progress = faker.number.float({ min: 0.1, max: 0.9 });
  }

  return {
    animationDuration: faker.helpers.arrayElement([200, 300, 400, 500]),
    direction: faker.helpers.arrayElement(DRAWER_DIRECTIONS),
    id: faker.string.uuid(),
    isAnimating,
    progress,
    state,
    ...overrides,
  };
}

/**
 * Creates an open slide state
 */
export function createFakeSlideStateOpen(direction: DrawerDirection = 'bottom'): FakeSlideState {
  return createFakeSlideState({
    state: 'open',
    direction,
    progress: 1,
    isAnimating: false,
  });
}

/**
 * Creates a closed slide state
 */
export function createFakeSlideStateClosed(direction: DrawerDirection = 'bottom'): FakeSlideState {
  return createFakeSlideState({
    state: 'closed',
    direction,
    progress: 0,
    isAnimating: false,
  });
}

/**
 * Creates an opening animation state
 */
export function createFakeSlideStateOpening(direction: DrawerDirection = 'bottom'): FakeSlideState {
  return createFakeSlideState({
    state: 'opening',
    direction,
    progress: 0.5,
    isAnimating: true,
  });
}

/**
 * Creates a closing animation state
 */
export function createFakeSlideStateClosing(direction: DrawerDirection = 'bottom'): FakeSlideState {
  return createFakeSlideState({
    state: 'closing',
    direction,
    progress: 0.5,
    isAnimating: true,
  });
}

/**
 * Creates slide states for all directions
 */
export function createFakeSlideStatesAllDirections(): Record<DrawerDirection, FakeSlideState> {
  return {
    bottom: createFakeSlideStateOpen('bottom'),
    top: createFakeSlideStateOpen('top'),
    left: createFakeSlideStateOpen('left'),
    right: createFakeSlideStateOpen('right'),
  };
}

// ============================================================================
// OVERLAY STATE FACTORIES
// ============================================================================

/**
 * Overlay state interface
 */
export interface FakeOverlayState {
  /** Whether backdrop blur is enabled */
  backdropBlur: boolean;
  /** Unique identifier */
  id: string;
  /** Whether overlay is visible */
  isVisible: boolean;
  /** Overlay opacity (0-1) */
  opacity: number;
}

/**
 * Creates a fake overlay state
 */
export function createFakeOverlayState(overrides?: Partial<FakeOverlayState>): FakeOverlayState {
  return {
    backdropBlur: faker.datatype.boolean({ probability: 0.2 }),
    id: faker.string.uuid(),
    isVisible: faker.datatype.boolean({ probability: 0.8 }),
    opacity: faker.number.float({ min: 0.3, max: 0.8, fractionDigits: 2 }),
    ...overrides,
  };
}

/**
 * Creates a visible overlay state
 */
export function createFakeOverlayVisible(): FakeOverlayState {
  return createFakeOverlayState({
    isVisible: true,
    opacity: 0.5,
    backdropBlur: false,
  });
}

/**
 * Creates a hidden overlay state
 */
export function createFakeOverlayHidden(): FakeOverlayState {
  return createFakeOverlayState({
    isVisible: false,
    opacity: 0,
    backdropBlur: false,
  });
}

/**
 * Creates a blurred overlay state
 */
export function createFakeOverlayBlurred(): FakeOverlayState {
  return createFakeOverlayState({
    isVisible: true,
    opacity: 0.3,
    backdropBlur: true,
  });
}

// ============================================================================
// SNAP POINT FACTORIES
// ============================================================================

/**
 * Snap point state interface
 */
export interface FakeSnapPointState {
  /** Currently active snap point */
  activeSnapPoint: DrawerSnapPoint | null;
  /** Available snap points */
  availableSnapPoints: DrawerSnapPoint[];
  /** Snap direction */
  direction: 'down' | 'up';
  /** Unique identifier */
  id: string;
  /** Next snap point in direction */
  nextSnapPoint: DrawerSnapPoint | null;
}

/**
 * Creates a fake snap point state
 */
export function createFakeSnapPointState(
  overrides?: Partial<FakeSnapPointState>
): FakeSnapPointState {
  const availableSnapPoints = overrides?.availableSnapPoints ?? DEFAULT_SNAP_POINTS;
  const activeIndex = faker.number.int({ min: 0, max: availableSnapPoints.length - 1 });
  const activeSnapPoint = availableSnapPoints[activeIndex];
  const nextIndex = activeIndex < availableSnapPoints.length - 1 ? activeIndex + 1 : null;

  return {
    activeSnapPoint,
    availableSnapPoints,
    direction: faker.helpers.arrayElement(['up', 'down']),
    id: faker.string.uuid(),
    nextSnapPoint: nextIndex !== null ? availableSnapPoints[nextIndex] : null,
    ...overrides,
  };
}

/**
 * Creates snap point states for each snap point value
 */
export function createFakeSnapPointStatesAll(): Record<string, FakeSnapPointState> {
  return {
    snap25: createFakeSnapPointState({ activeSnapPoint: 0.25, nextSnapPoint: 0.5 }),
    snap50: createFakeSnapPointState({ activeSnapPoint: 0.5, nextSnapPoint: 0.75 }),
    snap75: createFakeSnapPointState({ activeSnapPoint: 0.75, nextSnapPoint: 1 }),
    snapFull: createFakeSnapPointState({ activeSnapPoint: 1, nextSnapPoint: null }),
  };
}

// ============================================================================
// DIRECTION-SPECIFIC DRAWER FACTORIES
// ============================================================================

/**
 * Creates a bottom drawer (default mobile pattern)
 */
export function createFakeBottomDrawer(): FakeDrawer {
  return createFakeDrawer({
    direction: 'bottom',
    showHandle: true,
    snapPoints: DEFAULT_SNAP_POINTS,
  });
}

/**
 * Creates a top drawer (notification-style)
 */
export function createFakeTopDrawer(): FakeDrawer {
  return createFakeDrawer({
    direction: 'top',
    showHandle: false,
    size: 'sm',
  });
}

/**
 * Creates a left drawer (navigation-style)
 */
export function createFakeLeftDrawer(): FakeDrawer {
  return createFakeDrawer({
    direction: 'left',
    showHandle: false,
    type: 'navigation',
  });
}

/**
 * Creates a right drawer (details panel-style)
 */
export function createFakeRightDrawer(): FakeDrawer {
  return createFakeDrawer({
    direction: 'right',
    showHandle: false,
    type: 'panel',
    size: 'lg',
  });
}

/**
 * Creates drawers for all four directions
 */
export function createFakeDrawersAllDirections(): Record<DrawerDirection, FakeDrawer> {
  return {
    bottom: createFakeBottomDrawer(),
    top: createFakeTopDrawer(),
    left: createFakeLeftDrawer(),
    right: createFakeRightDrawer(),
  };
}

// ============================================================================
// DARK MODE FACTORY
// ============================================================================

/**
 * Dark mode drawer configuration
 */
export interface FakeDarkModeDrawer extends FakeDrawer {
  /** Theme mode */
  theme: 'dark' | 'light';
}

/**
 * Creates a drawer configured for dark mode testing
 */
export function createFakeDarkModeDrawer(
  overrides?: Partial<FakeDarkModeDrawer>
): FakeDarkModeDrawer {
  return {
    ...createFakeDrawer(),
    theme: 'dark',
    ...overrides,
  };
}

/**
 * Creates drawer configurations for both light and dark modes
 */
export function createFakeDrawerThemeVariants(): {
  dark: FakeDarkModeDrawer;
  light: FakeDarkModeDrawer;
} {
  return {
    light: createFakeDarkModeDrawer({ theme: 'light' }),
    dark: createFakeDarkModeDrawer({ theme: 'dark' }),
  };
}
