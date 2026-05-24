import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ SHARED STRING CONSTANTS ============

const LABEL_HOME = i18n.t('factory.breadcrumb.home', 'Home');

// ============ HELPER FUNCTIONS ============

/**
 * Gets the icon for a settings breadcrumb item based on index
 * @param index - The index of the breadcrumb item
 * @returns The icon name or undefined
 */
function getSettingsIcon(index: number): 'home' | 'settings' | undefined {
  if (index === 0) return 'home';
  if (index === 1) return 'settings';
  return undefined;
}

// ============ TYPE DEFINITIONS ============

/** Breadcrumb separator type */
export type BreadcrumbSeparator = 'arrow' | 'chevron' | 'dot' | 'slash';

/** Breadcrumb icon type */
export type BreadcrumbIcon = 'chevron-right' | 'document' | 'file' | 'folder' | 'home' | 'settings';

/** Breadcrumb item type for categorization */
export type BreadcrumbItemType = 'current' | 'ellipsis' | 'link';

/** Interface for fake breadcrumb item data */
export interface FakeBreadcrumb {
  /** Whether this is the current page */
  current?: boolean;
  /** URL for the breadcrumb link */
  href?: string;
  /** Optional icon name */
  icon?: BreadcrumbIcon;
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Item type */
  type?: BreadcrumbItemType;
}

/** Interface for breadcrumb trail data */
export interface FakeBreadcrumbTrail {
  /** Breadcrumb items */
  items: FakeBreadcrumb[];
  /** Maximum items to display before collapsing */
  maxItems?: number;
  /** Separator type */
  separator: BreadcrumbSeparator;
}

/** Interface for breadcrumb configuration */
export interface FakeBreadcrumbConfig {
  /** Whether to collapse middle items */
  collapseMiddle: boolean;
  /** Maximum visible items */
  maxVisible: number;
  /** Separator type */
  separator: BreadcrumbSeparator;
  /** Whether to show home icon */
  showHomeIcon: boolean;
  /** Whether to show icons */
  showIcons: boolean;
}

// ============ CONSTANTS FOR ITERATION ============

/** All breadcrumb separator options */
export const BREADCRUMB_SEPARATORS: BreadcrumbSeparator[] = ['arrow', 'chevron', 'dot', 'slash'];

/** All breadcrumb icon options */
export const BREADCRUMB_ICONS: BreadcrumbIcon[] = [
  'chevron-right',
  'document',
  'file',
  'folder',
  'home',
  'settings',
];

/** All breadcrumb item types */
export const BREADCRUMB_ITEM_TYPES: BreadcrumbItemType[] = ['current', 'ellipsis', 'link'];

/** Common breadcrumb path segments for realistic test data */
export const BREADCRUMB_SEGMENTS = [
  i18n.t('factory.breadcrumb.account', 'Account'),
  i18n.t('factory.breadcrumb.admin', 'Admin'),
  i18n.t('factory.breadcrumb.analytics', 'Analytics'),
  i18n.t('factory.breadcrumb.apiKeys', 'API Keys'),
  i18n.t('factory.breadcrumb.billing', 'Billing'),
  i18n.t('factory.breadcrumb.categories', 'Categories'),
  i18n.t('factory.breadcrumb.dashboard', 'Dashboard'),
  i18n.t('factory.breadcrumb.documents', 'Documents'),
  i18n.t('factory.breadcrumb.edit', 'Edit'),
  i18n.t('factory.breadcrumb.files', 'Files'),
  LABEL_HOME,
  i18n.t('factory.breadcrumb.integrations', 'Integrations'),
  i18n.t('factory.breadcrumb.members', 'Members'),
  i18n.t('factory.breadcrumb.orders', 'Orders'),
  i18n.t('factory.breadcrumb.products', 'Products'),
  i18n.t('factory.breadcrumb.profile', 'Profile'),
  i18n.t('factory.breadcrumb.projects', 'Projects'),
  i18n.t('factory.breadcrumb.reports', 'Reports'),
  i18n.t('factory.breadcrumb.settings', 'Settings'),
  i18n.t('factory.breadcrumb.teams', 'Teams'),
  i18n.t('factory.breadcrumb.users', 'Users'),
];

/** Common path structures for different contexts */
export const BREADCRUMB_PATHS = {
  admin: [
    LABEL_HOME,
    i18n.t('factory.breadcrumb.admin', 'Admin'),
    i18n.t('factory.breadcrumb.users', 'Users'),
    i18n.t('factory.breadcrumb.editUser', 'Edit User'),
  ],
  dashboard: [LABEL_HOME, i18n.t('factory.breadcrumb.dashboard', 'Dashboard')],
  ecommerce: [
    LABEL_HOME,
    i18n.t('factory.breadcrumb.products', 'Products'),
    i18n.t('factory.breadcrumb.electronics', 'Electronics'),
    i18n.t('factory.breadcrumb.smartphones', 'Smartphones'),
    i18n.t('factory.breadcrumb.iphone15', 'iPhone 15'),
  ],
  files: [
    LABEL_HOME,
    i18n.t('factory.breadcrumb.documents', 'Documents'),
    i18n.t('factory.breadcrumb.projects', 'Projects'),
    '2024',
    i18n.t('factory.breadcrumb.q1Reportpdf', 'Q1 Report.pdf'),
  ],
  settings: [
    LABEL_HOME,
    i18n.t('factory.breadcrumb.settings', 'Settings'),
    i18n.t('factory.breadcrumb.account', 'Account'),
    i18n.t('factory.breadcrumb.security', 'Security'),
  ],
};

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake breadcrumb item
 * @param overrides - Optional partial overrides for the generated item
 * @returns A fake breadcrumb item
 */
export function createFakeBreadcrumb(overrides?: Partial<FakeBreadcrumb>): FakeBreadcrumb {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(BREADCRUMB_SEGMENTS),
    href: faker.internet.url(),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(BREADCRUMB_ICONS), {
      probability: 0.2,
    }),
    current: false,
    type: 'link',
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake breadcrumb items (as a trail)
 * @param count - Number of items to generate
 * @returns Array of fake breadcrumb items (last is current)
 */
export function createFakeBreadcrumbs(count: number): FakeBreadcrumb[] {
  return Array.from({ length: count }, (_, index) => {
    const isLast = index === count - 1;
    const isFirst = index === 0;

    return createFakeBreadcrumb({
      current: isLast,
      href: isLast ? undefined : `/${faker.lorem.slug()}`,
      icon: isFirst ? 'home' : undefined,
      type: isLast ? 'current' : 'link',
    });
  });
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a simple breadcrumb trail (Home > Current)
 * @param currentLabel - Label for current page
 * @returns Simple two-item breadcrumb trail
 */
export function createFakeSimpleBreadcrumbs(currentLabel?: string): FakeBreadcrumb[] {
  return [
    createFakeBreadcrumb({
      label: LABEL_HOME,
      href: '/',
      icon: 'home',
      current: false,
      type: 'link',
    }),
    createFakeBreadcrumb({
      label: currentLabel ?? faker.helpers.arrayElement(BREADCRUMB_SEGMENTS),
      href: undefined,
      current: true,
      type: 'current',
    }),
  ];
}

/**
 * Creates a dashboard breadcrumb trail
 * @returns Dashboard context breadcrumbs
 */
export function createFakeDashboardBreadcrumbs(): FakeBreadcrumb[] {
  return BREADCRUMB_PATHS.dashboard.map((label, index, arr) => ({
    id: faker.string.uuid(),
    label,
    href: index === arr.length - 1 ? undefined : `/${label.toLowerCase()}`,
    icon: index === 0 ? 'home' : undefined,
    current: index === arr.length - 1,
    type: index === arr.length - 1 ? 'current' : 'link',
  }));
}

/**
 * Creates an e-commerce breadcrumb trail (deep hierarchy)
 * @returns E-commerce context breadcrumbs
 */
export function createFakeEcommerceBreadcrumbs(): FakeBreadcrumb[] {
  return BREADCRUMB_PATHS.ecommerce.map((label, index, arr) => ({
    id: faker.string.uuid(),
    label,
    href: index === arr.length - 1 ? undefined : `/${label.toLowerCase().replaceAll(' ', '-')}`,
    icon: index === 0 ? 'home' : undefined,
    current: index === arr.length - 1,
    type: index === arr.length - 1 ? 'current' : 'link',
  }));
}

/**
 * Creates a file path breadcrumb trail
 * @returns File path context breadcrumbs
 */
export function createFakeFileBreadcrumbs(): FakeBreadcrumb[] {
  return BREADCRUMB_PATHS.files.map((label, index, arr) => ({
    id: faker.string.uuid(),
    label,
    href: index === arr.length - 1 ? undefined : `/files/${label.toLowerCase()}`,
    icon: getIconForFileSegment(label, index),
    current: index === arr.length - 1,
    type: index === arr.length - 1 ? 'current' : 'link',
  }));
}

function getIconForFileSegment(label: string, index: number): BreadcrumbIcon | undefined {
  if (index === 0) return 'home';
  if (label.includes('.')) return 'file';
  return 'folder';
}

/**
 * Creates a settings breadcrumb trail
 * @returns Settings context breadcrumbs
 */
export function createFakeSettingsBreadcrumbs(): FakeBreadcrumb[] {
  return BREADCRUMB_PATHS.settings.map((label, index, arr) => ({
    id: faker.string.uuid(),
    label,
    href: index === arr.length - 1 ? undefined : `/settings/${label.toLowerCase()}`,
    icon: getSettingsIcon(index),
    current: index === arr.length - 1,
    type: index === arr.length - 1 ? 'current' : 'link',
  }));
}

/**
 * Creates a breadcrumb trail with ellipsis (collapsed)
 * @param totalItems - Total number of items (including hidden)
 * @param visibleItems - Number of visible items
 * @returns Breadcrumb trail with ellipsis
 */
export function createFakeCollapsedBreadcrumbs(totalItems = 6, visibleItems = 3): FakeBreadcrumb[] {
  const allItems = Array.from({ length: totalItems }, (_, index) => ({
    id: faker.string.uuid(),
    label: BREADCRUMB_SEGMENTS[index % BREADCRUMB_SEGMENTS.length],
    href: `/${faker.lorem.slug()}`,
    current: index === totalItems - 1,
    type: 'link' as BreadcrumbItemType,
  }));

  // Return first item, ellipsis, and last (visibleItems - 1) items
  const result: FakeBreadcrumb[] = [
    { ...allItems[0], icon: 'home' },
    { id: 'ellipsis', label: '...', type: 'ellipsis' },
    ...allItems.slice(-(visibleItems - 1)).map((item, i, arr) => ({
      ...item,
      current: i === arr.length - 1,
      href: i === arr.length - 1 ? undefined : item.href,
      type: (i === arr.length - 1 ? 'current' : 'link') as BreadcrumbItemType,
    })),
  ];

  return result;
}

/**
 * Creates a complete breadcrumb trail with options
 * @param options - Configuration options
 * @returns Breadcrumb trail
 */
export function createFakeBreadcrumbTrail(
  options?: Partial<{
    collapsed: boolean;
    context: 'admin' | 'dashboard' | 'ecommerce' | 'files' | 'settings';
    separator: BreadcrumbSeparator;
  }>
): FakeBreadcrumbTrail {
  const context =
    options?.context ??
    faker.helpers.arrayElement(['admin', 'dashboard', 'ecommerce', 'files', 'settings']);

  let items: FakeBreadcrumb[];
  switch (context) {
    case 'admin': {
      items = BREADCRUMB_PATHS.admin.map((label, i, arr) => ({
        id: faker.string.uuid(),
        label,
        href: i === arr.length - 1 ? undefined : `/${label.toLowerCase().replaceAll(' ', '-')}`,
        current: i === arr.length - 1,
        type: (i === arr.length - 1 ? 'current' : 'link') as BreadcrumbItemType,
      }));
      break;
    }
    case 'dashboard': {
      items = createFakeDashboardBreadcrumbs();
      break;
    }
    case 'ecommerce': {
      items = createFakeEcommerceBreadcrumbs();
      break;
    }
    case 'files': {
      items = createFakeFileBreadcrumbs();
      break;
    }
    case 'settings': {
      items = createFakeSettingsBreadcrumbs();
      break;
    }
    default: {
      items = createFakeBreadcrumbs(4);
    }
  }

  return {
    items: options?.collapsed ? createFakeCollapsedBreadcrumbs(items.length) : items,
    separator: options?.separator ?? 'chevron',
    maxItems: options?.collapsed ? 3 : undefined,
  };
}

// ============ MATRIX FACTORY ============

/**
 * Creates a matrix of breadcrumb trails for visual regression testing
 * @returns Array of breadcrumb trails with different configurations
 */
export function createFakeBreadcrumbMatrix(): FakeBreadcrumbTrail[] {
  return BREADCRUMB_SEPARATORS.map((separator) => ({
    items: createFakeBreadcrumbs(4),
    separator,
  }));
}

/**
 * Creates breadcrumb configuration for different scenarios
 * @param scenario - Scenario name
 * @returns Breadcrumb configuration
 */
export function createFakeBreadcrumbConfig(
  scenario: 'collapsed' | 'default' | 'withIcons' = 'default'
): FakeBreadcrumbConfig {
  const configs: Record<string, FakeBreadcrumbConfig> = {
    collapsed: {
      separator: 'chevron',
      showIcons: false,
      showHomeIcon: true,
      collapseMiddle: true,
      maxVisible: 3,
    },
    default: {
      separator: 'chevron',
      showIcons: false,
      showHomeIcon: true,
      collapseMiddle: false,
      maxVisible: 10,
    },
    withIcons: {
      separator: 'chevron',
      showIcons: true,
      showHomeIcon: true,
      collapseMiddle: false,
      maxVisible: 10,
    },
  };

  return configs[scenario];
}
