import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// SIDEBAR FACTORY
// ============================================================================
// Comprehensive test data factories for the Sidebar component.
// Follows the Button factory pattern with type exports, constants, and
// specialized factories for different sidebar configurations.
// ============================================================================

// ============================================================================
// SHARED STRING CONSTANTS
// ============================================================================

const LABEL_SETTINGS = i18n.t('factory.sidebar.settings', 'Settings');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Sidebar side position
 * @description Which side of the viewport the sidebar appears
 */
export type SidebarSide = 'left' | 'right';

/**
 * Sidebar variant
 * @description Visual style of the sidebar
 */
export type SidebarVariant = 'floating' | 'inset' | 'sidebar';

/**
 * Sidebar collapsible mode
 * @description How the sidebar collapses
 */
export type SidebarCollapsible = 'icon' | 'none' | 'offcanvas';

/**
 * Sidebar state
 * @description Current expansion state
 */
export type SidebarState = 'collapsed' | 'expanded';

/**
 * Menu item type
 * @description Type of menu item
 */
export type MenuItemType = 'button' | 'link' | 'submenu';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All sidebar sides
 */
export const SIDEBAR_SIDES: SidebarSide[] = ['left', 'right'];

/**
 * All sidebar variants
 */
export const SIDEBAR_VARIANTS: SidebarVariant[] = ['sidebar', 'floating', 'inset'];

/**
 * All collapsible modes
 */
export const SIDEBAR_COLLAPSIBLE_MODES: SidebarCollapsible[] = ['offcanvas', 'icon', 'none'];

/**
 * All sidebar states
 */
export const SIDEBAR_STATES: SidebarState[] = ['expanded', 'collapsed'];

/**
 * Common icon names for menu items
 */
export const MENU_ICONS = [
  i18n.t('factory.sidebar.home', 'Home'),
  LABEL_SETTINGS,
  i18n.t('factory.sidebar.users', 'Users'),
  'FileText',
  i18n.t('factory.sidebar.folder', 'Folder'),
  i18n.t('factory.sidebar.mail', 'Mail'),
  i18n.t('factory.sidebar.calendar', 'Calendar'),
  i18n.t('factory.sidebar.bell', 'Bell'),
  i18n.t('factory.sidebar.search', 'Search'),
  'BarChart',
  'PieChart',
  i18n.t('factory.sidebar.layers', 'Layers'),
  i18n.t('factory.sidebar.database', 'Database'),
  i18n.t('factory.sidebar.shield', 'Shield'),
  'Zap',
  i18n.t('factory.sidebar.terminal', 'Terminal'),
  i18n.t('factory.sidebar.code', 'Code'),
  i18n.t('factory.sidebar.globe', 'Globe'),
  i18n.t('factory.sidebar.inbox', 'Inbox'),
  i18n.t('factory.sidebar.archive', 'Archive'),
];

/**
 * Common menu labels
 */
export const MENU_LABELS = {
  main: [
    i18n.t('factory.sidebar.dashboard', 'Dashboard'),
    i18n.t('factory.sidebar.projects', 'Projects'),
    i18n.t('factory.sidebar.tasks', 'Tasks'),
    i18n.t('factory.sidebar.team', 'Team'),
    i18n.t('factory.sidebar.calendar', 'Calendar'),
    i18n.t('factory.sidebar.documents', 'Documents'),
    i18n.t('factory.sidebar.reports', 'Reports'),
  ],
  settings: [
    LABEL_SETTINGS,
    i18n.t('factory.sidebar.profile', 'Profile'),
    i18n.t('factory.sidebar.preferences', 'Preferences'),
    i18n.t('factory.sidebar.security', 'Security'),
    i18n.t('factory.sidebar.billing', 'Billing'),
  ],
  help: [
    i18n.t('factory.sidebar.help', 'Help'),
    i18n.t('factory.sidebar.documentation', 'Documentation'),
    i18n.t('factory.sidebar.support', 'Support'),
    i18n.t('factory.sidebar.feedback', 'Feedback'),
  ],
};

/**
 * Common workspace names
 */
export const WORKSPACE_NAMES = [
  i18n.t('factory.sidebar.acmeCorp', 'Acme Corp'),
  i18n.t('factory.sidebar.startupInc', 'Startup Inc'),
  i18n.t('factory.sidebar.designStudio', 'Design Studio'),
  i18n.t('factory.sidebar.devTeam', 'Dev Team'),
  i18n.t('factory.sidebar.marketingHub', 'Marketing Hub'),
  i18n.t('factory.sidebar.salesTeam', 'Sales Team'),
  i18n.t('factory.sidebar.engineering', 'Engineering'),
  i18n.t('factory.sidebar.productTeam', 'Product Team'),
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Sidebar menu item
 */
export interface FakeSidebarMenuItem {
  /** Whether item is active */
  active?: boolean;
  /** Badge count */
  badge?: number;
  /** Whether item is disabled */
  disabled?: boolean;
  /** Item href (for links) */
  href?: string;
  /** Icon name */
  icon: string;
  /** Unique identifier */
  id: string;
  /** Item label */
  label: string;
  /** Click handler name (for tracking) */
  onClick?: string;
  /** Submenu items */
  subItems?: FakeSidebarSubItem[];
  /** Tooltip text */
  tooltip?: string;
  /** Item type */
  type: MenuItemType;
}

/**
 * Sidebar submenu item
 */
export interface FakeSidebarSubItem {
  /** Whether item is active */
  active?: boolean;
  /** Item href */
  href: string;
  /** Unique identifier */
  id: string;
  /** Item label */
  label: string;
}

/**
 * Sidebar group
 */
export interface FakeSidebarGroup {
  /** Group action label */
  actionLabel?: string;
  /** Whether group is collapsible */
  collapsible?: boolean;
  /** Whether group is default open */
  defaultOpen?: boolean;
  /** Unique identifier */
  id: string;
  /** Menu items in this group */
  items: FakeSidebarMenuItem[];
  /** Group label */
  label?: string;
}

/**
 * Sidebar user
 */
export interface FakeSidebarUser {
  /** User avatar URL */
  avatar?: string;
  /** User email */
  email: string;
  /** Unique identifier */
  id: string;
  /** User display name */
  name: string;
  /** User role/title */
  role?: string;
}

/**
 * Sidebar workspace
 */
export interface FakeSidebarWorkspace {
  /** Workspace icon */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Workspace logo URL */
  logo?: string;
  /** Workspace name */
  name: string;
  /** Workspace plan */
  plan?: string;
}

/**
 * Sidebar configuration
 */
export interface FakeSidebar {
  /** Collapsible mode */
  collapsible: SidebarCollapsible;
  /** Default open state */
  defaultOpen: boolean;
  /** Footer content type */
  footerType: 'actions' | 'none' | 'upgrade' | 'user';
  /** Menu groups */
  groups: FakeSidebarGroup[];
  /** Header content type */
  headerType: 'none' | 'search' | 'workspace';
  /** Unique identifier */
  id: string;
  /** Sidebar side */
  side: SidebarSide;
  /** Current user (if showing user in footer) */
  user?: FakeSidebarUser;
  /** Sidebar variant */
  variant: SidebarVariant;
  /** Workspace (if showing in header) */
  workspace?: FakeSidebarWorkspace;
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake sidebar menu item
 * @param overrides - Optional property overrides
 * @returns A fake menu item
 */
export function createFakeSidebarMenuItem(
  overrides?: Partial<FakeSidebarMenuItem>
): FakeSidebarMenuItem {
  const label = faker.helpers.arrayElement([
    ...MENU_LABELS.main,
    ...MENU_LABELS.settings,
    ...MENU_LABELS.help,
  ]);

  return {
    id: faker.string.uuid(),
    label,
    icon: faker.helpers.arrayElement(MENU_ICONS),
    type: faker.helpers.arrayElement(['link', 'button'] as MenuItemType[]),
    href: `/${label.toLowerCase().replaceAll(/\s+/g, '-')}`,
    tooltip: label,
    active: faker.datatype.boolean({ probability: 0.15 }),
    disabled: faker.datatype.boolean({ probability: 0.05 }),
    badge: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 99 }), { probability: 0.15 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake menu items
 * @param count - Number of items to create
 * @param overrides - Optional property overrides
 * @returns Array of fake menu items
 */
export function createFakeSidebarMenuItems(
  count: number,
  overrides?: Partial<FakeSidebarMenuItem>
): FakeSidebarMenuItem[] {
  return Array.from({ length: count }, (_, i) =>
    createFakeSidebarMenuItem({
      active: i === 0, // First item active by default
      ...overrides,
    })
  );
}

/**
 * Creates a fake submenu item
 * @param overrides - Optional property overrides
 * @returns A fake submenu item
 */
export function createFakeSidebarSubItem(
  overrides?: Partial<FakeSidebarSubItem>
): FakeSidebarSubItem {
  const label = faker.helpers.arrayElement([
    i18n.t('factory.sidebar.overview', 'Overview'),
    i18n.t('factory.sidebar.details', 'Details'),
    LABEL_SETTINGS,
    i18n.t('factory.sidebar.history', 'History'),
    i18n.t('factory.sidebar.export', 'Export'),
  ]);

  return {
    id: faker.string.uuid(),
    label,
    href: `#${label.toLowerCase()}`,
    active: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake submenu items
 * @param count - Number of items to create
 * @returns Array of fake submenu items
 */
export function createFakeSidebarSubItems(count: number): FakeSidebarSubItem[] {
  return Array.from({ length: count }, () => createFakeSidebarSubItem());
}

/**
 * Creates a fake menu item with submenu
 * @param subItemCount - Number of submenu items
 * @param overrides - Optional property overrides
 * @returns A fake menu item with submenu
 */
export function createFakeSidebarMenuItemWithSubmenu(
  subItemCount: number = 3,
  overrides?: Partial<FakeSidebarMenuItem>
): FakeSidebarMenuItem {
  return createFakeSidebarMenuItem({
    type: 'submenu',
    subItems: createFakeSidebarSubItems(subItemCount),
    ...overrides,
  });
}

/**
 * Creates a fake sidebar group
 * @param overrides - Optional property overrides
 * @returns A fake sidebar group
 */
export function createFakeSidebarGroup(overrides?: Partial<FakeSidebarGroup>): FakeSidebarGroup {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.sidebar.main', 'Main'),
          i18n.t('factory.sidebar.platform', 'Platform'),
          i18n.t('factory.sidebar.projects', 'Projects'),
          i18n.t('factory.sidebar.tools', 'Tools'),
          LABEL_SETTINGS,
        ]),
      { probability: 0.7 }
    ),
    items: createFakeSidebarMenuItems(faker.number.int({ min: 3, max: 6 })),
    collapsible: faker.datatype.boolean({ probability: 0.3 }),
    defaultOpen: true,
    actionLabel: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.sidebar.add', 'Add'),
          i18n.t('factory.sidebar.more', 'More'),
          i18n.t('factory.sidebar.edit', 'Edit'),
        ]),
      {
        probability: 0.2,
      }
    ),
    ...overrides,
  };
}

/**
 * Creates multiple fake sidebar groups
 * @param count - Number of groups to create
 * @param overrides - Optional property overrides
 * @returns Array of fake sidebar groups
 */
export function createFakeSidebarGroups(
  count: number,
  overrides?: Partial<FakeSidebarGroup>
): FakeSidebarGroup[] {
  return Array.from({ length: count }, () => createFakeSidebarGroup(overrides));
}

/**
 * Creates a fake sidebar user
 * @param overrides - Optional property overrides
 * @returns A fake sidebar user
 */
export function createFakeSidebarUser(overrides?: Partial<FakeSidebarUser>): FakeSidebarUser {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    avatar: faker.helpers.maybe(() => faker.image.avatar(), { probability: 0.8 }),
    role: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.sidebar.admin', 'Admin'),
          i18n.t('factory.sidebar.member', 'Member'),
          i18n.t('factory.sidebar.viewer', 'Viewer'),
          i18n.t('factory.sidebar.editor', 'Editor'),
          i18n.t('factory.sidebar.owner', 'Owner'),
        ]),
      { probability: 0.6 }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake sidebar workspace
 * @param overrides - Optional property overrides
 * @returns A fake sidebar workspace
 */
export function createFakeSidebarWorkspace(
  overrides?: Partial<FakeSidebarWorkspace>
): FakeSidebarWorkspace {
  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement(WORKSPACE_NAMES),
    logo: faker.helpers.maybe(
      () => faker.image.urlPicsumPhotos({ width: 32, height: 32, grayscale: true }),
      { probability: 0.5 }
    ),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(MENU_ICONS), { probability: 0.5 }),
    plan: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.sidebar.free', 'Free'),
          i18n.t('factory.sidebar.pro', 'Pro'),
          i18n.t('factory.sidebar.enterprise', 'Enterprise'),
        ]),
      {
        probability: 0.4,
      }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake sidebar configuration
 * @param overrides - Optional property overrides
 * @returns A fake sidebar configuration
 */
export function createFakeSidebar(overrides?: Partial<FakeSidebar>): FakeSidebar {
  const headerType = faker.helpers.arrayElement(['workspace', 'search', 'none'] as const);
  const footerType = faker.helpers.arrayElement(['user', 'upgrade', 'actions', 'none'] as const);

  return {
    id: faker.string.uuid(),
    side: faker.helpers.arrayElement(SIDEBAR_SIDES),
    variant: faker.helpers.arrayElement(SIDEBAR_VARIANTS),
    collapsible: faker.helpers.arrayElement(SIDEBAR_COLLAPSIBLE_MODES),
    defaultOpen: true,
    headerType,
    footerType,
    groups: createFakeSidebarGroups(faker.number.int({ min: 1, max: 3 })),
    workspace: headerType === 'workspace' ? createFakeSidebarWorkspace() : undefined,
    user: footerType === 'user' ? createFakeSidebarUser() : undefined,
    ...overrides,
  };
}

/**
 * Creates multiple fake sidebars
 * @param count - Number of sidebars to create
 * @param overrides - Optional property overrides
 * @returns Array of fake sidebar configurations
 */
export function createFakeSidebars(count: number, overrides?: Partial<FakeSidebar>): FakeSidebar[] {
  return Array.from({ length: count }, () => createFakeSidebar(overrides));
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a standard application sidebar
 * @param overrides - Optional property overrides
 * @returns A standard app sidebar
 */
export function createFakeAppSidebar(overrides?: Partial<FakeSidebar>): FakeSidebar {
  const mainGroup: FakeSidebarGroup = {
    id: faker.string.uuid(),
    label: i18n.t('factory.sidebar.main', 'Main'),
    items: MENU_LABELS.main.slice(0, 5).map((label, i) => ({
      id: faker.string.uuid(),
      label,
      icon: MENU_ICONS[i] || i18n.t('factory.sidebar.circle', 'Circle'),
      type: 'link' as const,
      href: `/${label.toLowerCase()}`,
      tooltip: label,
      active: i === 0,
    })),
    collapsible: false,
    defaultOpen: true,
  };

  const settingsGroup: FakeSidebarGroup = {
    id: faker.string.uuid(),
    label: LABEL_SETTINGS,
    items: MENU_LABELS.settings.slice(0, 3).map((label) => ({
      id: faker.string.uuid(),
      label,
      icon:
        label === 'Settings'
          ? i18n.t('factory.sidebar.settings', LABEL_SETTINGS)
          : faker.helpers.arrayElement(MENU_ICONS),
      type: 'link' as const,
      href: `/${label.toLowerCase()}`,
      tooltip: label,
    })),
    collapsible: true,
    defaultOpen: false,
  };

  return createFakeSidebar({
    variant: 'inset',
    collapsible: 'icon',
    headerType: 'workspace',
    footerType: 'user',
    groups: [mainGroup, settingsGroup],
    workspace: createFakeSidebarWorkspace(),
    user: createFakeSidebarUser(),
    ...overrides,
  });
}

/**
 * Creates a minimal sidebar (icon-only when collapsed)
 * @param overrides - Optional property overrides
 * @returns A minimal sidebar
 */
export function createFakeMinimalSidebar(overrides?: Partial<FakeSidebar>): FakeSidebar {
  return createFakeSidebar({
    variant: 'sidebar',
    collapsible: 'icon',
    headerType: 'none',
    footerType: 'none',
    groups: [
      {
        id: faker.string.uuid(),
        items: MENU_LABELS.main.slice(0, 4).map((label, i) => ({
          id: faker.string.uuid(),
          label,
          icon: MENU_ICONS[i] || i18n.t('factory.sidebar.circle', 'Circle'),
          type: 'link' as const,
          href: `/${label.toLowerCase()}`,
          tooltip: label,
          active: i === 0,
        })),
        collapsible: false,
        defaultOpen: true,
      },
    ],
    ...overrides,
  });
}

/**
 * Creates a floating sidebar
 * @param overrides - Optional property overrides
 * @returns A floating sidebar
 */
export function createFakeFloatingSidebar(overrides?: Partial<FakeSidebar>): FakeSidebar {
  return createFakeSidebar({
    variant: 'floating',
    collapsible: 'offcanvas',
    ...overrides,
  });
}

/**
 * Creates a right-side sidebar
 * @param overrides - Optional property overrides
 * @returns A right-side sidebar
 */
export function createFakeRightSidebar(overrides?: Partial<FakeSidebar>): FakeSidebar {
  return createFakeSidebar({
    side: 'right',
    headerType: 'search',
    footerType: 'actions',
    ...overrides,
  });
}

/**
 * Creates a sidebar with nested submenus
 * @param overrides - Optional property overrides
 * @returns A sidebar with submenus
 */
export function createFakeSidebarWithSubmenus(overrides?: Partial<FakeSidebar>): FakeSidebar {
  const groupWithSubmenus: FakeSidebarGroup = {
    id: faker.string.uuid(),
    label: i18n.t('factory.sidebar.navigation', 'Navigation'),
    items: [
      createFakeSidebarMenuItem({
        label: i18n.t('factory.sidebar.dashboard', 'Dashboard'),
        icon: 'Home',
        active: true,
      }),
      createFakeSidebarMenuItemWithSubmenu(4, {
        label: i18n.t('factory.sidebar.projects', 'Projects'),
        icon: 'Folder',
      }),
      createFakeSidebarMenuItemWithSubmenu(3, {
        label: i18n.t('factory.sidebar.reports', 'Reports'),
        icon: 'BarChart',
      }),
      createFakeSidebarMenuItem({ label: i18n.t('factory.sidebar.team', 'Team'), icon: 'Users' }),
      createFakeSidebarMenuItemWithSubmenu(5, {
        label: i18n.t('factory.sidebar.settings', 'Settings'),
        icon: 'Settings',
      }),
    ],
    collapsible: false,
    defaultOpen: true,
  };

  return createFakeSidebar({
    groups: [groupWithSubmenus],
    ...overrides,
  });
}

/**
 * Creates a sidebar with badges
 * @param overrides - Optional property overrides
 * @returns A sidebar with badges
 */
export function createFakeSidebarWithBadges(overrides?: Partial<FakeSidebar>): FakeSidebar {
  const groupWithBadges: FakeSidebarGroup = {
    id: faker.string.uuid(),
    label: i18n.t('factory.sidebar.menu', 'Menu'),
    items: [
      createFakeSidebarMenuItem({
        label: i18n.t('factory.sidebar.inbox', 'Inbox'),
        icon: 'Inbox',
        badge: 12,
        active: true,
      }),
      createFakeSidebarMenuItem({
        label: i18n.t('factory.sidebar.notifications', 'Notifications'),
        icon: 'Bell',
        badge: 5,
      }),
      createFakeSidebarMenuItem({
        label: i18n.t('factory.sidebar.tasks', 'Tasks'),
        icon: 'FileText',
        badge: 23,
      }),
      createFakeSidebarMenuItem({
        label: i18n.t('factory.sidebar.messages', 'Messages'),
        icon: 'Mail',
        badge: 3,
      }),
      createFakeSidebarMenuItem({
        label: i18n.t('factory.sidebar.alerts', 'Alerts'),
        icon: 'Zap',
        badge: 1,
      }),
    ],
    collapsible: false,
    defaultOpen: true,
  };

  return createFakeSidebar({
    groups: [groupWithBadges],
    ...overrides,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of sidebars across variants
 * @returns Grid of sidebars for each variant
 */
export function createSidebarVariantMatrix(): FakeSidebar[] {
  return SIDEBAR_VARIANTS.map((variant) =>
    createFakeSidebar({
      variant,
    })
  );
}

/**
 * Creates a matrix of sidebars across collapsible modes
 * @returns Grid of sidebars for each collapsible mode
 */
export function createSidebarCollapsibleMatrix(): FakeSidebar[] {
  return SIDEBAR_COLLAPSIBLE_MODES.map((collapsible) =>
    createFakeSidebar({
      collapsible,
    })
  );
}

/**
 * Creates a matrix of sidebars across sides
 * @returns Grid of sidebars for each side
 */
export function createSidebarSideMatrix(): FakeSidebar[] {
  return SIDEBAR_SIDES.map((side) =>
    createFakeSidebar({
      side,
    })
  );
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all sidebar configurations
 * @returns Array of sidebar configs for showcase
 */
export function createSidebarShowcase(): Array<{
  description: string;
  name: string;
  sidebar: FakeSidebar;
}> {
  return [
    {
      name: i18n.t('factory.sidebar.appSidebar', 'App Sidebar'),
      description: i18n.t(
        'factory.sidebar.standardApplicationSidebarWithWorkspace',
        'Standard application sidebar with workspace and user'
      ),
      sidebar: createFakeAppSidebar(),
    },
    {
      name: i18n.t('factory.sidebar.minimal', 'Minimal'),
      description: i18n.t(
        'factory.sidebar.icononlyCollapsibleSidebar',
        'Icon-only collapsible sidebar'
      ),
      sidebar: createFakeMinimalSidebar(),
    },
    {
      name: i18n.t('factory.sidebar.floating', 'Floating'),
      description: i18n.t(
        'factory.sidebar.floatingVariantWithRoundedCorners',
        'Floating variant with rounded corners'
      ),
      sidebar: createFakeFloatingSidebar(),
    },
    {
      name: i18n.t('factory.sidebar.rightSide', 'Right Side'),
      description: i18n.t('factory.sidebar.sidebarOnTheRightSide', 'Sidebar on the right side'),
      sidebar: createFakeRightSidebar(),
    },
    {
      name: i18n.t('factory.sidebar.withSubmenus', 'With Submenus'),
      description: i18n.t('factory.sidebar.nestedSubmenuNavigation', 'Nested submenu navigation'),
      sidebar: createFakeSidebarWithSubmenus(),
    },
    {
      name: i18n.t('factory.sidebar.withBadges', 'With Badges'),
      description: i18n.t(
        'factory.sidebar.menuItemsWithNotificationBadges',
        'Menu items with notification badges'
      ),
      sidebar: createFakeSidebarWithBadges(),
    },
    {
      name: i18n.t('factory.sidebar.insetVariant', 'Inset Variant'),
      description: i18n.t('factory.sidebar.insetStyleSidebar', 'Inset style sidebar'),
      sidebar: createFakeSidebar({ variant: 'inset' }),
    },
    {
      name: i18n.t('factory.sidebar.offcanvas', 'Offcanvas'),
      description: i18n.t('factory.sidebar.offcanvasCollapsibleMode', 'Offcanvas collapsible mode'),
      sidebar: createFakeSidebar({ collapsible: 'offcanvas' }),
    },
    {
      name: i18n.t('factory.sidebar.nonCollapsible', 'Non-collapsible'),
      description: i18n.t('factory.sidebar.alwaysExpandedSidebar', 'Always expanded sidebar'),
      sidebar: createFakeSidebar({ collapsible: 'none' }),
    },
  ];
}

// ============================================================================
// TEST DATA FACTORY
// ============================================================================

/**
 * Creates a complete test data set for sidebar testing
 * @returns Comprehensive test data
 */
export function createSidebarTestData(): {
  appSidebar: FakeSidebar;
  badgesSidebar: FakeSidebar;
  basicSidebar: FakeSidebar;
  collapsibleMatrix: FakeSidebar[];
  floatingSidebar: FakeSidebar;
  groups: FakeSidebarGroup[];
  menuItems: FakeSidebarMenuItem[];
  minimalSidebar: FakeSidebar;
  rightSidebar: FakeSidebar;
  showcase: Array<{
    description: string;
    name: string;
    sidebar: FakeSidebar;
  }>;
  sidebars: FakeSidebar[];
  sideMatrix: FakeSidebar[];
  subItems: FakeSidebarSubItem[];
  submenusSidebar: FakeSidebar;
  user: FakeSidebarUser;
  users: FakeSidebarUser[];
  variantMatrix: FakeSidebar[];
  workspace: FakeSidebarWorkspace;
  workspaces: FakeSidebarWorkspace[];
} {
  return {
    sidebars: createFakeSidebars(5),
    basicSidebar: createFakeSidebar(),
    appSidebar: createFakeAppSidebar(),
    minimalSidebar: createFakeMinimalSidebar(),
    floatingSidebar: createFakeFloatingSidebar(),
    rightSidebar: createFakeRightSidebar(),
    submenusSidebar: createFakeSidebarWithSubmenus(),
    badgesSidebar: createFakeSidebarWithBadges(),
    menuItems: createFakeSidebarMenuItems(10),
    subItems: createFakeSidebarSubItems(5),
    groups: createFakeSidebarGroups(3),
    user: createFakeSidebarUser(),
    users: Array.from({ length: 5 }, () => createFakeSidebarUser()),
    workspace: createFakeSidebarWorkspace(),
    workspaces: Array.from({ length: 3 }, () => createFakeSidebarWorkspace()),
    variantMatrix: createSidebarVariantMatrix(),
    collapsibleMatrix: createSidebarCollapsibleMatrix(),
    sideMatrix: createSidebarSideMatrix(),
    showcase: createSidebarShowcase(),
  };
}
