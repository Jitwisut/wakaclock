import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// NAVIGATION FACTORY - Enterprise Pattern
// Comprehensive test data generation for navigation components
// ============================================================================

// NOTE: Breadcrumb, Menu, and Tab factories are exported from their dedicated
// factory files via index.ts - do not re-export here to avoid conflicts

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Navigation item types for different navigation contexts */
export type NavItemType = 'button' | 'divider' | 'group' | 'link' | 'submenu';

/** Navigation item status states */
export type NavItemStatus = 'active' | 'default' | 'disabled' | 'error' | 'loading';

/** Navigation layout orientations */
export type NavOrientation = 'horizontal' | 'vertical';

/** Navigation variant styles */
export type NavVariant = 'bordered' | 'default' | 'minimal' | 'pills' | 'underline';

/** Navigation size options */
export type NavSize = 'lg' | 'md' | 'sm' | 'xl' | 'xs';

/** Sidebar collapse states */
export type SidebarState = 'collapsed' | 'expanded' | 'floating' | 'hidden';

/** Sidebar position options */
export type SidebarPosition = 'left' | 'right';

/** Navigation icon position relative to label */
export type IconPosition = 'left' | 'only' | 'right' | 'top';

/** Mobile navigation display modes */
export type MobileNavMode = 'bottom-sheet' | 'drawer' | 'dropdown' | 'overlay';

/** Breadcrumb separator styles */
export type NavBreadcrumbSeparator = 'arrow' | 'chevron' | 'custom' | 'dot' | 'slash';

// ============================================================================
// INTERFACES
// ============================================================================

/** Core navigation item structure */
export interface FakeNavItem {
  badge?: number | string;
  badgeVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
  children?: FakeNavItem[];
  description?: string;
  disabled?: boolean;
  external?: boolean;
  href: string;
  icon?: string;
  iconPosition?: IconPosition;
  id: string;
  isNew?: boolean;
  keywords?: string[];
  label: string;
  loading?: boolean;
  onClick?: string;
  shortcut?: string;
  status?: NavItemStatus;
  tooltip?: string;
  type?: NavItemType;
}

/** Sidebar group configuration */
export interface FakeNavSidebarGroup {
  action?: {
    icon: string;
    label: string;
    onClick: string;
  };
  badge?: number | string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  icon?: string;
  id: string;
  items: FakeNavItem[];
  title: string;
}

/** Complete sidebar configuration */
export interface FakeNavSidebar {
  collapseOnMobile?: boolean;
  collapsible?: boolean;
  defaultState?: SidebarState;
  footer?: FakeNavItem[];
  groups: FakeNavSidebarGroup[];
  header?: {
    logo?: string;
    subtitle?: string;
    title: string;
  };
  id: string;
  position?: SidebarPosition;
  quickActions?: FakeNavItem[];
  showSearch?: boolean;
  width?: number;
}

/** Top navigation bar configuration */
export interface FakeTopNav {
  centerItems?: FakeNavItem[];
  id: string;
  leftItems: FakeNavItem[];
  logo?: {
    alt: string;
    href: string;
    src: string;
  };
  mobileBreakpoint?: number;
  mobileMode?: MobileNavMode;
  rightItems?: FakeNavItem[];
  sticky?: boolean;
  transparent?: boolean;
  variant?: NavVariant;
}

/** Navigation menu (dropdown/flyout) */
export interface FakeNavMenu {
  align?: 'end' | 'start';
  closeOnSelect?: boolean;
  groups?: FakeNavMenuGroup[];
  id: string;
  items: FakeNavItem[];
  trigger: FakeNavItem;
  width?: 'auto' | number;
}

/** Navigation menu group */
export interface FakeNavMenuGroup {
  items: FakeNavItem[];
  label?: string;
}

/** Pagination navigation */
export interface FakePaginationNav {
  boundaryCount?: number;
  currentPage: number;
  disabled?: boolean;
  hasNext: boolean;
  hasPrev: boolean;
  id: string;
  onChange?: string;
  showFirstLast?: boolean;
  siblingCount?: number;
  size?: NavSize;
  total: number;
  totalPages: number;
  variant?: 'default' | 'ghost' | 'outline';
}

/** Step navigation (wizard/stepper) */
export interface FakeStepNav {
  allowClickNavigation?: boolean;
  currentStep: number;
  id: string;
  onStepChange?: string;
  orientation?: NavOrientation;
  showConnector?: boolean;
  size?: NavSize;
  steps: FakeStepItem[];
  variant?: 'circle' | 'default' | 'dots';
}

/** Individual step item */
export interface FakeStepItem {
  completed?: boolean;
  description?: string;
  disabled?: boolean;
  error?: boolean;
  icon?: string;
  id: string;
  label: string;
  optional?: boolean;
}

/** Footer navigation section */
export interface FakeFooterNav {
  columns: FakeFooterColumn[];
  copyright?: string;
  id: string;
  logo?: {
    alt: string;
    src: string;
  };
  socialLinks?: FakeNavSocialLink[];
}

/** Footer column */
export interface FakeFooterColumn {
  id: string;
  links: FakeNavItem[];
  title: string;
}

/** Social media link */
export interface FakeNavSocialLink {
  href: string;
  icon: string;
  id: string;
  label: string;
}

/** Quick action item */
export interface FakeQuickAction {
  color?: string;
  description?: string;
  href?: string;
  icon: string;
  id: string;
  label: string;
  onClick?: string;
  shortcut?: string;
}

/** Navigation search result */
export interface FakeNavSearchResult {
  category?: string;
  description?: string;
  href: string;
  icon?: string;
  id: string;
  keywords?: string[];
  label: string;
  score?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** All navigation item types */
export const NAV_ITEM_TYPES: NavItemType[] = ['link', 'button', 'divider', 'group', 'submenu'];

/** All navigation item status states */
export const NAV_ITEM_STATUSES: NavItemStatus[] = [
  'default',
  'active',
  'disabled',
  'loading',
  'error',
];

/** All navigation orientations */
export const NAV_ORIENTATIONS: NavOrientation[] = ['horizontal', 'vertical'];

/** All navigation variant styles */
export const NAV_VARIANTS: NavVariant[] = ['default', 'pills', 'underline', 'bordered', 'minimal'];

/** All navigation sizes */
export const NAV_SIZES: NavSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

/** All sidebar states */
export const SIDEBAR_STATES: SidebarState[] = ['expanded', 'collapsed', 'hidden', 'floating'];

/** All sidebar positions */
export const SIDEBAR_POSITIONS: SidebarPosition[] = ['left', 'right'];

/** All icon positions */
export const ICON_POSITIONS: IconPosition[] = ['left', 'right', 'top', 'only'];

/** All mobile navigation modes */
export const MOBILE_NAV_MODES: MobileNavMode[] = ['drawer', 'dropdown', 'bottom-sheet', 'overlay'];

/** All breadcrumb separator styles */
export const NAV_BREADCRUMB_SEPARATORS: NavBreadcrumbSeparator[] = [
  'slash',
  'chevron',
  'arrow',
  'dot',
  'custom',
];

/** Common navigation icons */
export const NAV_ICONS = [
  i18n.t('factory.navigation.home', 'Home'),
  i18n.t('factory.navigation.settings', 'Settings'),
  i18n.t('factory.navigation.users', 'Users'),
  'FileText',
  'BarChart',
  i18n.t('factory.navigation.calendar', 'Calendar'),
  i18n.t('factory.navigation.inbox', 'Inbox'),
  i18n.t('factory.navigation.bell', 'Bell'),
  i18n.t('factory.navigation.search', 'Search'),
  i18n.t('factory.navigation.folder', 'Folder'),
  i18n.t('factory.navigation.star', 'Star'),
  i18n.t('factory.navigation.heart', 'Heart'),
  i18n.t('factory.navigation.bookmark', 'Bookmark'),
  'Tag',
  i18n.t('factory.navigation.flag', 'Flag'),
  i18n.t('factory.navigation.mail', 'Mail'),
  'MessageSquare',
  i18n.t('factory.navigation.phone', 'Phone'),
  i18n.t('factory.navigation.globe', 'Globe'),
  i18n.t('factory.navigation.shield', 'Shield'),
  i18n.t('factory.navigation.lock', 'Lock'),
  'Key',
  'CreditCard',
  i18n.t('factory.navigation.package', 'Package'),
  i18n.t('factory.navigation.truck', 'Truck'),
  'ShoppingCart',
  i18n.t('factory.navigation.activity', 'Activity'),
  'PieChart',
  'TrendingUp',
  'DollarSign',
] as const;

/** Common social media icons */
export const SOCIAL_ICONS = [
  i18n.t('factory.navigation.twitter', 'Twitter'),
  i18n.t('factory.navigation.facebook', 'Facebook'),
  i18n.t('factory.navigation.instagram', 'Instagram'),
  'LinkedIn',
  'GitHub',
  'YouTube',
  i18n.t('factory.navigation.discord', 'Discord'),
  i18n.t('factory.navigation.slack', 'Slack'),
] as const;

/** Common navigation labels */
export const NAV_LABELS = [
  i18n.t('factory.navigation.dashboard', 'Dashboard'),
  i18n.t('factory.navigation.analytics', 'Analytics'),
  i18n.t('factory.navigation.users', 'Users'),
  i18n.t('factory.navigation.products', 'Products'),
  i18n.t('factory.navigation.orders', 'Orders'),
  i18n.t('factory.navigation.settings', 'Settings'),
  i18n.t('factory.navigation.reports', 'Reports'),
  i18n.t('factory.navigation.calendar', 'Calendar'),
  i18n.t('factory.navigation.messages', 'Messages'),
  i18n.t('factory.navigation.notifications', 'Notifications'),
  i18n.t('factory.navigation.profile', 'Profile'),
  i18n.t('factory.navigation.help', 'Help'),
  i18n.t('factory.navigation.documentation', 'Documentation'),
  i18n.t('factory.navigation.support', 'Support'),
  i18n.t('factory.navigation.billing', 'Billing'),
] as const;

/** Common keyboard shortcuts */
export const NAV_SHORTCUTS = ['⌘K', '⌘/', '⌘P', '⌘N', '⌘S', '⌘B', '⌘E', '⌘D', '⌘H', '⌘J'] as const;

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake navigation item with realistic properties
 * @param depth - Current nesting depth for recursive children
 * @param overrides - Optional property overrides
 */
export function createFakeNavItem(
  depth: number = 0,
  overrides?: Partial<FakeNavItem>
): FakeNavItem {
  const hasChildren = depth < 2 && faker.datatype.boolean({ probability: 0.3 });
  const childCount = hasChildren ? faker.number.int({ min: 2, max: 5 }) : 0;
  const type =
    overrides?.type ?? faker.helpers.arrayElement(NAV_ITEM_TYPES.filter((t) => t !== 'divider'));

  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(NAV_LABELS),
    href: `/${faker.lorem.slug()}`,
    type,
    icon: faker.helpers.arrayElement([...NAV_ICONS]),
    iconPosition: faker.helpers.arrayElement(ICON_POSITIONS),
    badge: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 99 }), { probability: 0.2 }),
    badgeVariant: faker.helpers.arrayElement(['default', 'destructive', 'outline', 'secondary']),
    disabled: faker.datatype.boolean({ probability: 0.05 }),
    loading: faker.datatype.boolean({ probability: 0.03 }),
    status: faker.helpers.arrayElement(NAV_ITEM_STATUSES),
    external: faker.datatype.boolean({ probability: 0.1 }),
    isNew: faker.datatype.boolean({ probability: 0.1 }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    tooltip: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.2 }),
    shortcut: faker.helpers.maybe(() => faker.helpers.arrayElement([...NAV_SHORTCUTS]), {
      probability: 0.15,
    }),
    keywords: faker.helpers.maybe(
      () => Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => faker.lorem.word()),
      { probability: 0.2 }
    ),
    children: hasChildren
      ? Array.from({ length: childCount }, () => createFakeNavItem(depth + 1))
      : undefined,
    ...overrides,
  };
}

/**
 * Creates a fake sidebar group
 * @param overrides - Optional property overrides
 */
export function createFakeNavSidebarGroup(
  overrides?: Partial<FakeNavSidebarGroup>
): FakeNavSidebarGroup {
  return {
    id: faker.string.uuid(),
    title: faker.commerce.department(),
    icon: faker.helpers.arrayElement([...NAV_ICONS]),
    items: createFakeNavItems(faker.number.int({ min: 3, max: 7 })),
    collapsible: faker.datatype.boolean({ probability: 0.5 }),
    defaultOpen: faker.datatype.boolean({ probability: 0.7 }),
    badge: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 99 }), { probability: 0.15 }),
    action: faker.helpers.maybe(
      () => ({
        label: faker.helpers.arrayElement([
          i18n.t('factory.navigation.add', 'Add'),
          i18n.t('factory.navigation.create', 'Create'),
          i18n.t('factory.navigation.new', 'New'),
          i18n.t('factory.navigation.import', 'Import'),
        ]),
        icon: i18n.t('factory.navigation.plus', 'Plus'),
        onClick: 'handleAction',
      }),
      { probability: 0.2 }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake sidebar configuration
 * @param overrides - Optional property overrides
 */
export function createFakeNavSidebar(overrides?: Partial<FakeNavSidebar>): FakeNavSidebar {
  return {
    id: faker.string.uuid(),
    groups: createFakeNavSidebarGroups(faker.number.int({ min: 2, max: 5 })),
    position: faker.helpers.arrayElement(SIDEBAR_POSITIONS),
    defaultState: faker.helpers.arrayElement(SIDEBAR_STATES),
    collapsible: faker.datatype.boolean({ probability: 0.7 }),
    collapseOnMobile: faker.datatype.boolean({ probability: 0.9 }),
    width: faker.helpers.arrayElement([240, 256, 280, 300, 320]),
    showSearch: faker.datatype.boolean({ probability: 0.6 }),
    header: faker.helpers.maybe(
      () => ({
        title: faker.company.name(),
        subtitle: faker.helpers.maybe(() => faker.company.catchPhrase(), { probability: 0.5 }),
        logo: faker.helpers.maybe(() => faker.image.urlLoremFlickr({ category: 'business' }), {
          probability: 0.8,
        }),
      }),
      { probability: 0.8 }
    ),
    footer: faker.helpers.maybe(() => createFakeNavItems(faker.number.int({ min: 2, max: 4 })), {
      probability: 0.5,
    }),
    quickActions: faker.helpers.maybe(
      () => createFakeNavItems(faker.number.int({ min: 1, max: 3 })),
      { probability: 0.3 }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake top navigation bar
 * @param overrides - Optional property overrides
 */
export function createFakeTopNav(overrides?: Partial<FakeTopNav>): FakeTopNav {
  return {
    id: faker.string.uuid(),
    leftItems: createFakeNavItems(faker.number.int({ min: 3, max: 6 })),
    centerItems: faker.helpers.maybe(
      () => createFakeNavItems(faker.number.int({ min: 2, max: 4 })),
      { probability: 0.3 }
    ),
    rightItems: faker.helpers.maybe(
      () => createFakeNavItems(faker.number.int({ min: 2, max: 4 })),
      { probability: 0.8 }
    ),
    logo: faker.helpers.maybe(
      () => ({
        src: faker.image.urlLoremFlickr({ category: 'business' }),
        alt: faker.company.name(),
        href: '/',
      }),
      { probability: 0.9 }
    ),
    variant: faker.helpers.arrayElement(NAV_VARIANTS),
    sticky: faker.datatype.boolean({ probability: 0.7 }),
    transparent: faker.datatype.boolean({ probability: 0.2 }),
    mobileMode: faker.helpers.arrayElement(MOBILE_NAV_MODES),
    mobileBreakpoint: faker.helpers.arrayElement([640, 768, 1024]),
    ...overrides,
  };
}

/**
 * Creates a fake navigation menu (dropdown)
 * @param overrides - Optional property overrides
 */
export function createFakeNavMenu(overrides?: Partial<FakeNavMenu>): FakeNavMenu {
  const hasGroups = faker.datatype.boolean({ probability: 0.4 });

  return {
    id: faker.string.uuid(),
    trigger: createFakeNavItem(0, { type: 'button' }),
    items: hasGroups ? [] : createFakeNavItems(faker.number.int({ min: 3, max: 8 })),
    groups: hasGroups
      ? Array.from({ length: faker.number.int({ min: 2, max: 4 }) }, () => ({
          label: faker.helpers.maybe(() => faker.commerce.department(), { probability: 0.7 }),
          items: createFakeNavItems(faker.number.int({ min: 2, max: 5 })),
        }))
      : undefined,
    align: faker.helpers.arrayElement(['start', 'end']),
    width: faker.helpers.arrayElement([200, 240, 280, 320, 'auto']),
    closeOnSelect: faker.datatype.boolean({ probability: 0.9 }),
    ...overrides,
  };
}

/**
 * Creates a fake pagination navigation
 * @param overrides - Optional property overrides
 */
export function createFakePaginationNav(overrides?: Partial<FakePaginationNav>): FakePaginationNav {
  const total = overrides?.total ?? faker.number.int({ min: 50, max: 500 });
  const totalPages = overrides?.totalPages ?? Math.ceil(total / 10);
  const currentPage = overrides?.currentPage ?? faker.number.int({ min: 1, max: totalPages });

  return {
    id: faker.string.uuid(),
    currentPage,
    total,
    totalPages,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
    siblingCount: faker.helpers.arrayElement([1, 2]),
    boundaryCount: faker.helpers.arrayElement([1, 2]),
    showFirstLast: faker.datatype.boolean({ probability: 0.7 }),
    size: faker.helpers.arrayElement(NAV_SIZES),
    variant: faker.helpers.arrayElement(['default', 'outline', 'ghost']),
    disabled: faker.datatype.boolean({ probability: 0.05 }),
    ...overrides,
  };
}

/**
 * Creates a fake step navigation (wizard)
 * @param overrides - Optional property overrides
 */
export function createFakeStepNav(overrides?: Partial<FakeStepNav>): FakeStepNav {
  const stepCount = faker.number.int({ min: 3, max: 6 });
  const currentStep = faker.number.int({ min: 0, max: stepCount - 1 });

  return {
    id: faker.string.uuid(),
    steps: Array.from({ length: stepCount }, (_, index) => createFakeStepItem(index, currentStep)),
    currentStep,
    orientation: faker.helpers.arrayElement(NAV_ORIENTATIONS),
    variant: faker.helpers.arrayElement(['default', 'circle', 'dots']),
    size: faker.helpers.arrayElement(NAV_SIZES),
    showConnector: faker.datatype.boolean({ probability: 0.9 }),
    allowClickNavigation: faker.datatype.boolean({ probability: 0.6 }),
    ...overrides,
  };
}

/**
 * Creates a fake step item
 * @param index - Step index
 * @param currentStep - Current active step
 * @param overrides - Optional property overrides
 */
export function createFakeStepItem(
  index: number,
  currentStep: number,
  overrides?: Partial<FakeStepItem>
): FakeStepItem {
  const stepLabels = [
    i18n.t('factory.navigation.account', 'Account'),
    i18n.t('factory.navigation.personalInfo', 'Personal Info'),
    i18n.t('factory.navigation.address', 'Address'),
    i18n.t('factory.navigation.payment', 'Payment'),
    i18n.t('factory.navigation.review', 'Review'),
    i18n.t('factory.navigation.confirmation', 'Confirmation'),
    i18n.t('factory.navigation.complete', 'Complete'),
  ];

  return {
    id: faker.string.uuid(),
    label:
      stepLabels[index] ??
      i18n.t('factory.navigation.stepLabel', 'Step {{number}}', { number: index + 1 }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement([...NAV_ICONS]), {
      probability: 0.3,
    }),
    completed: index < currentStep,
    disabled: index > currentStep + 1,
    optional: faker.datatype.boolean({ probability: 0.1 }),
    error: faker.datatype.boolean({ probability: 0.05 }),
    ...overrides,
  };
}

/**
 * Creates a fake footer navigation
 * @param overrides - Optional property overrides
 */
export function createFakeFooterNav(overrides?: Partial<FakeFooterNav>): FakeFooterNav {
  return {
    id: faker.string.uuid(),
    columns: Array.from({ length: faker.number.int({ min: 3, max: 5 }) }, () => ({
      id: faker.string.uuid(),
      title: faker.commerce.department(),
      links: createFakeNavItems(faker.number.int({ min: 4, max: 7 })),
    })),
    logo: faker.helpers.maybe(
      () => ({
        src: faker.image.urlLoremFlickr({ category: 'business' }),
        alt: faker.company.name(),
      }),
      { probability: 0.8 }
    ),
    copyright: i18n.t(
      'factory.navigation.copyright',
      '© {{year}} {{company}}. All rights reserved.',
      { year: new Date().getFullYear(), company: faker.company.name() }
    ),
    socialLinks: Array.from({ length: faker.number.int({ min: 3, max: 6 }) }, () => ({
      id: faker.string.uuid(),
      icon: faker.helpers.arrayElement([...SOCIAL_ICONS]),
      href: faker.internet.url(),
      label: faker.helpers.arrayElement([
        i18n.t('factory.navigation.twitter', 'Twitter'),
        i18n.t('factory.navigation.facebook', 'Facebook'),
        'GitHub',
        'LinkedIn',
      ]),
    })),
    ...overrides,
  };
}

/**
 * Creates a fake quick action
 * @param overrides - Optional property overrides
 */
export function createFakeQuickAction(overrides?: Partial<FakeQuickAction>): FakeQuickAction {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.navigation.newDocument', 'New Document'),
      i18n.t('factory.navigation.createProject', 'Create Project'),
      i18n.t('factory.navigation.addUser', 'Add User'),
      i18n.t('factory.navigation.sendMessage', 'Send Message'),
      i18n.t('factory.navigation.generateReport', 'Generate Report'),
      i18n.t('factory.navigation.quickSearch', 'Quick Search'),
    ]),
    icon: faker.helpers.arrayElement([...NAV_ICONS]),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    shortcut: faker.helpers.maybe(() => faker.helpers.arrayElement([...NAV_SHORTCUTS]), {
      probability: 0.4,
    }),
    href: faker.helpers.maybe(() => `/${faker.lorem.slug()}`, { probability: 0.5 }),
    color: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          'text-blue-500',
          'text-green-500',
          'text-purple-500',
          'text-orange-500',
        ]),
      { probability: 0.3 }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake navigation search result
 * @param overrides - Optional property overrides
 */
export function createFakeNavSearchResult(
  overrides?: Partial<FakeNavSearchResult>
): FakeNavSearchResult {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(NAV_LABELS),
    href: `/${faker.lorem.slug()}`,
    icon: faker.helpers.arrayElement([...NAV_ICONS]),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.6 }),
    category: faker.helpers.arrayElement([
      i18n.t('factory.navigation.pages', 'Pages'),
      i18n.t('factory.navigation.settings', 'Settings'),
      i18n.t('factory.navigation.users', 'Users'),
      i18n.t('factory.navigation.actions', 'Actions'),
      i18n.t('factory.navigation.recent', 'Recent'),
    ]),
    keywords: Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () =>
      faker.lorem.word()
    ),
    score: faker.number.float({ min: 0.5, max: 1, fractionDigits: 2 }),
    ...overrides,
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple fake navigation items
 * @param count - Number of items to create
 * @param depth - Current nesting depth
 */
export function createFakeNavItems(count: number, depth: number = 0): FakeNavItem[] {
  return Array.from({ length: count }, () => createFakeNavItem(depth));
}

/**
 * Creates multiple fake sidebar groups
 * @param count - Number of groups to create
 */
export function createFakeNavSidebarGroups(count: number): FakeNavSidebarGroup[] {
  return Array.from({ length: count }, () => createFakeNavSidebarGroup());
}

/**
 * Creates multiple fake navigation menus
 * @param count - Number of menus to create
 */
export function createFakeNavMenus(count: number): FakeNavMenu[] {
  return Array.from({ length: count }, () => createFakeNavMenu());
}

/**
 * Creates multiple fake step items
 * @param count - Number of steps to create
 * @param currentStep - Current active step
 */
export function createFakeStepItems(count: number, currentStep: number = 0): FakeStepItem[] {
  return Array.from({ length: count }, (_, index) => createFakeStepItem(index, currentStep));
}

/**
 * Creates multiple fake quick actions
 * @param count - Number of actions to create
 */
export function createFakeQuickActions(count: number): FakeQuickAction[] {
  return Array.from({ length: count }, () => createFakeQuickAction());
}

/**
 * Creates multiple fake navigation search results
 * @param count - Number of results to create
 */
export function createFakeNavSearchResults(count: number): FakeNavSearchResult[] {
  return Array.from({ length: count }, () => createFakeNavSearchResult());
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a nav item in active state
 */
export function createFakeActiveNavItem(overrides?: Partial<FakeNavItem>): FakeNavItem {
  return createFakeNavItem(0, {
    status: 'active',
    disabled: false,
    loading: false,
    ...overrides,
  });
}

/**
 * Creates a nav item in disabled state
 */
export function createFakeDisabledNavItem(overrides?: Partial<FakeNavItem>): FakeNavItem {
  return createFakeNavItem(0, {
    status: 'disabled',
    disabled: true,
    loading: false,
    ...overrides,
  });
}

/**
 * Creates a nav item in loading state
 */
export function createFakeLoadingNavItem(overrides?: Partial<FakeNavItem>): FakeNavItem {
  return createFakeNavItem(0, {
    status: 'loading',
    loading: true,
    disabled: false,
    ...overrides,
  });
}

/**
 * Creates a nav item in error state
 */
export function createFakeErrorNavItem(overrides?: Partial<FakeNavItem>): FakeNavItem {
  return createFakeNavItem(0, {
    status: 'error',
    disabled: false,
    loading: false,
    badge: '!',
    badgeVariant: 'destructive',
    ...overrides,
  });
}

/**
 * Creates a nav item with badge notification
 */
export function createFakeNavItemWithBadge(overrides?: Partial<FakeNavItem>): FakeNavItem {
  return createFakeNavItem(0, {
    badge: faker.number.int({ min: 1, max: 99 }),
    badgeVariant: faker.helpers.arrayElement(['default', 'destructive']),
    ...overrides,
  });
}

/**
 * Creates a nav item with children (submenu)
 */
export function createFakeNavItemWithChildren(overrides?: Partial<FakeNavItem>): FakeNavItem {
  return createFakeNavItem(0, {
    type: 'submenu',
    children: createFakeNavItems(faker.number.int({ min: 3, max: 6 }), 1),
    ...overrides,
  });
}

/**
 * Creates an external link nav item
 */
export function createFakeExternalNavItem(overrides?: Partial<FakeNavItem>): FakeNavItem {
  return createFakeNavItem(0, {
    external: true,
    href: faker.internet.url(),
    icon: 'ExternalLink',
    ...overrides,
  });
}

/**
 * Creates a collapsed sidebar configuration
 */
export function createFakeNavCollapsedSidebar(overrides?: Partial<FakeNavSidebar>): FakeNavSidebar {
  return createFakeNavSidebar({
    defaultState: 'collapsed',
    collapsible: true,
    ...overrides,
  });
}

/**
 * Creates an expanded sidebar configuration
 */
export function createFakeNavExpandedSidebar(overrides?: Partial<FakeNavSidebar>): FakeNavSidebar {
  return createFakeNavSidebar({
    defaultState: 'expanded',
    collapsible: true,
    ...overrides,
  });
}

/**
 * Creates a floating sidebar configuration
 */
export function createFakeNavFloatingSidebar(overrides?: Partial<FakeNavSidebar>): FakeNavSidebar {
  return createFakeNavSidebar({
    defaultState: 'floating',
    collapsible: true,
    collapseOnMobile: true,
    ...overrides,
  });
}

/**
 * Creates a transparent top navigation
 */
export function createFakeTransparentTopNav(overrides?: Partial<FakeTopNav>): FakeTopNav {
  return createFakeTopNav({
    transparent: true,
    sticky: false,
    ...overrides,
  });
}

/**
 * Creates a sticky top navigation
 */
export function createFakeStickyTopNav(overrides?: Partial<FakeTopNav>): FakeTopNav {
  return createFakeTopNav({
    sticky: true,
    transparent: false,
    ...overrides,
  });
}

/**
 * Creates a minimal footer navigation
 */
export function createFakeMinimalFooterNav(overrides?: Partial<FakeFooterNav>): FakeFooterNav {
  return createFakeFooterNav({
    columns: [
      {
        id: faker.string.uuid(),
        title: i18n.t('factory.navigation.links', 'Links'),
        links: createFakeNavItems(4),
      },
    ],
    socialLinks: [],
    ...overrides,
  });
}

/**
 * Creates pagination at the first page
 */
export function createFakeNavFirstPagePagination(
  overrides?: Partial<FakePaginationNav>
): FakePaginationNav {
  return createFakePaginationNav({
    currentPage: 1,
    hasPrev: false,
    hasNext: true,
    ...overrides,
  });
}

/**
 * Creates pagination at the last page
 */
export function createFakeNavLastPagePagination(
  overrides?: Partial<FakePaginationNav>
): FakePaginationNav {
  const totalPages = overrides?.totalPages ?? 10;
  return createFakePaginationNav({
    currentPage: totalPages,
    totalPages,
    hasPrev: true,
    hasNext: false,
    ...overrides,
  });
}

/**
 * Creates disabled pagination
 */
export function createFakeDisabledPagination(
  overrides?: Partial<FakePaginationNav>
): FakePaginationNav {
  return createFakePaginationNav({
    disabled: true,
    ...overrides,
  });
}

/**
 * Creates a step navigation at the beginning
 */
export function createFakeStepNavAtStart(overrides?: Partial<FakeStepNav>): FakeStepNav {
  return createFakeStepNav({
    currentStep: 0,
    ...overrides,
  });
}

/**
 * Creates a step navigation in the middle
 */
export function createFakeStepNavInProgress(overrides?: Partial<FakeStepNav>): FakeStepNav {
  return createFakeStepNav({
    currentStep: 2,
    ...overrides,
  });
}

/**
 * Creates a completed step navigation
 */
export function createFakeCompletedStepNav(overrides?: Partial<FakeStepNav>): FakeStepNav {
  const stepCount = overrides?.steps?.length ?? 5;
  return createFakeStepNav({
    currentStep: stepCount - 1,
    steps: Array.from({ length: stepCount }, (_, index) => ({
      ...createFakeStepItem(index, stepCount),
      completed: true,
    })),
    ...overrides,
  });
}

/**
 * Creates a step navigation with an error
 */
export function createFakeStepNavWithError(overrides?: Partial<FakeStepNav>): FakeStepNav {
  const stepNav = createFakeStepNav(overrides);
  if (stepNav.steps.length > 0) {
    stepNav.steps[stepNav.currentStep] = {
      ...stepNav.steps[stepNav.currentStep],
      error: true,
    };
  }
  return stepNav;
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of nav items across all statuses
 * Useful for visual regression testing
 */
export function createFakeNavItemStatusMatrix(): Record<NavItemStatus, FakeNavItem> {
  const result = {} as Record<NavItemStatus, FakeNavItem>;

  for (const status of NAV_ITEM_STATUSES) {
    result[status] = createFakeNavItem(0, { status });
  }

  return result;
}

/**
 * Creates a matrix of nav items across all types
 */
export function createFakeNavItemTypeMatrix(): Record<NavItemType, FakeNavItem> {
  const result = {} as Record<NavItemType, FakeNavItem>;

  for (const type of NAV_ITEM_TYPES) {
    result[type] = createFakeNavItem(0, { type });
  }

  return result;
}

/**
 * Creates a matrix of nav variants across all sizes
 */
export function createFakeNavVariantSizeMatrix(): Record<NavVariant, Record<NavSize, FakeTopNav>> {
  const result = {} as Record<NavVariant, Record<NavSize, FakeTopNav>>;

  for (const variant of NAV_VARIANTS) {
    result[variant] = {} as Record<NavSize, FakeTopNav>;
    for (const size of NAV_SIZES) {
      result[variant][size] = createFakeTopNav({ variant });
    }
  }

  return result;
}

/**
 * Creates a matrix of sidebar states across all positions
 */
export function createFakeNavSidebarStatePositionMatrix(): Record<
  SidebarState,
  Record<SidebarPosition, FakeNavSidebar>
> {
  const result = {} as Record<SidebarState, Record<SidebarPosition, FakeNavSidebar>>;

  for (const state of SIDEBAR_STATES) {
    result[state] = {} as Record<SidebarPosition, FakeNavSidebar>;
    for (const position of SIDEBAR_POSITIONS) {
      result[state][position] = createFakeNavSidebar({ defaultState: state, position });
    }
  }

  return result;
}

/**
 * Creates a matrix of pagination variants across all sizes
 */
export function createFakePaginationVariantSizeMatrix(): Record<
  'default' | 'ghost' | 'outline',
  Record<NavSize, FakePaginationNav>
> {
  const variants = ['default', 'outline', 'ghost'] as const;
  const result = {} as Record<(typeof variants)[number], Record<NavSize, FakePaginationNav>>;

  for (const variant of variants) {
    result[variant] = {} as Record<NavSize, FakePaginationNav>;
    for (const size of NAV_SIZES) {
      result[variant][size] = createFakePaginationNav({ variant, size });
    }
  }

  return result;
}

/**
 * Creates a matrix of step nav variants across all orientations
 */
export function createFakeStepNavVariantOrientationMatrix(): Record<
  'circle' | 'default' | 'dots',
  Record<NavOrientation, FakeStepNav>
> {
  const variants = ['default', 'circle', 'dots'] as const;
  const result = {} as Record<(typeof variants)[number], Record<NavOrientation, FakeStepNav>>;

  for (const variant of variants) {
    result[variant] = {} as Record<NavOrientation, FakeStepNav>;
    for (const orientation of NAV_ORIENTATIONS) {
      result[variant][orientation] = createFakeStepNav({ variant, orientation });
    }
  }

  return result;
}

/**
 * Creates a comprehensive navigation demo data set
 */
export function createFakeNavigationDemoData() {
  return {
    sidebar: createFakeNavSidebar(),
    topNav: createFakeTopNav(),
    footer: createFakeFooterNav(),
    pagination: createFakePaginationNav(),
    stepNav: createFakeStepNav(),
    quickActions: createFakeQuickActions(6),
    searchResults: createFakeNavSearchResults(10),
    menus: createFakeNavMenus(3),
  };
}
