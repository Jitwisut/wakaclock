/**
 * Menu Factory
 *
 * Provides faker-based test data generation for menu components including
 * DropdownMenu, ContextMenu, and Menubar stories.
 * Supports various menu item types, shortcuts, submenus, and common use cases.
 *
 * @module menu.factory
 * @see {@link file://./../../../components/ui/dropdown-menu.tsx}
 * @see {@link file://./../../../components/ui/context-menu.tsx}
 * @see {@link file://./../../../components/ui/menubar.tsx}
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// SHARED STRING CONSTANTS
// ============================================================================

const ICON_TRASH = i18n.t('factory.menu.trash', 'Trash');

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Menu item variant (visual style)
 */
export type MenuItemVariant = 'default' | 'destructive';

/**
 * Menu size variants
 */
export type MenuSize = 'default' | 'lg' | 'sm';

/**
 * Menu content width presets
 */
export type MenuWidth = 'w-40' | 'w-48' | 'w-52' | 'w-56' | 'w-64' | 'w-72';

/**
 * Menu alignment options
 */
export type MenuAlign = 'center' | 'end' | 'start';

/**
 * Menu side options
 */
export type MenuSide = 'bottom' | 'left' | 'right' | 'top';

/**
 * Menu item types
 */
export type MenuItemType = 'checkbox' | 'item' | 'label' | 'radio' | 'separator' | 'submenu';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base menu item interface
 */
export interface FakeMenuItem {
  /** Whether this is a destructive action */
  destructive?: boolean;
  /** Whether item is disabled */
  disabled?: boolean;
  /** Icon name from lucide-react */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Whether item has left inset */
  inset?: boolean;
  /** Display label */
  label: string;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Nested submenu items */
  submenu?: FakeMenuItem[];
  /** Item type */
  type?: MenuItemType;
}

/**
 * Menu checkbox item
 */
export interface FakeMenuCheckboxItem extends FakeMenuItem {
  /** Whether checkbox is checked */
  checked: boolean;
  type: 'checkbox';
}

/**
 * Menu radio item
 */
export interface FakeMenuRadioItem extends FakeMenuItem {
  type: 'radio';
  /** Radio item value */
  value: string;
}

/**
 * Menu radio group
 */
export interface FakeMenuRadioGroup {
  /** Group identifier */
  id: string;
  /** Radio items */
  items: FakeMenuRadioItem[];
  /** Group label */
  label?: string;
  /** Currently selected value */
  selectedValue: string;
}

/**
 * Menu group configuration
 */
export interface FakeMenuGroup {
  /** Group identifier */
  id: string;
  /** Menu items in group */
  items: FakeMenuItem[];
  /** Group label */
  label?: string;
}

/**
 * Complete menu configuration
 */
export interface FakeMenu {
  /** Menu alignment relative to trigger */
  align?: MenuAlign;
  /** Checkbox items */
  checkboxItems?: FakeMenuCheckboxItem[];
  /** Menu groups */
  groups: FakeMenuGroup[];
  /** Unique identifier */
  id: string;
  /** Radio groups */
  radioGroups?: FakeMenuRadioGroup[];
  /** Menu side position */
  side?: MenuSide;
  /** Menu width class */
  width?: MenuWidth;
}

/**
 * User menu configuration (header/profile menu)
 */
export interface FakeUserMenu extends FakeMenu {
  /** User avatar URL */
  avatar?: string;
  /** User email */
  email: string;
  /** User name */
  name: string;
}

/**
 * File menu configuration
 */
export interface FakeFileMenu extends FakeMenu {
  /** Recent files list */
  recentFiles?: Array<{
    name: string;
    path: string;
  }>;
}

/**
 * Edit menu configuration
 */
export interface FakeEditMenu extends FakeMenu {
  /** Whether there's content to paste */
  canPaste?: boolean;
  /** Whether redo is available */
  canRedo?: boolean;
  /** Whether undo is available */
  canUndo?: boolean;
  /** Whether text is selected */
  hasSelection?: boolean;
}

/**
 * View menu configuration
 */
export interface FakeViewMenu extends FakeMenu {
  /** Current zoom level */
  zoomLevel?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Menu item variants
 */
export const MENU_ITEM_VARIANTS: MenuItemVariant[] = ['default', 'destructive'];

/**
 * Menu sizes
 */
export const MENU_SIZES: MenuSize[] = ['sm', 'default', 'lg'];

/**
 * Menu width options
 */
export const MENU_WIDTHS: MenuWidth[] = ['w-40', 'w-48', 'w-52', 'w-56', 'w-64', 'w-72'];

/**
 * Menu alignment options
 */
export const MENU_ALIGNS: MenuAlign[] = ['start', 'center', 'end'];

/**
 * Menu side options
 */
export const MENU_SIDES: MenuSide[] = ['top', 'right', 'bottom', 'left'];

/**
 * Common menu icons
 */
export const MENU_ICONS = [
  'ArrowRight',
  i18n.t('factory.menu.check', 'Check'),
  i18n.t('factory.menu.copy', 'Copy'),
  i18n.t('factory.menu.download', 'Download'),
  i18n.t('factory.menu.edit', 'Edit'),
  'ExternalLink',
  i18n.t('factory.menu.file', 'File'),
  i18n.t('factory.menu.folder', 'Folder'),
  'HelpCircle',
  'LogOut',
  i18n.t('factory.menu.mail', 'Mail'),
  'MessageSquare',
  i18n.t('factory.menu.minus', 'Minus'),
  'MoreHorizontal',
  i18n.t('factory.menu.paste', 'Paste'),
  i18n.t('factory.menu.plus', 'Plus'),
  i18n.t('factory.menu.redo', 'Redo'),
  i18n.t('factory.menu.scissors', 'Scissors'),
  i18n.t('factory.menu.settings', 'Settings'),
  i18n.t('factory.menu.share', 'Share'),
  ICON_TRASH,
  i18n.t('factory.menu.undo', 'Undo'),
  i18n.t('factory.menu.upload', 'Upload'),
  i18n.t('factory.menu.user', 'User'),
] as const;

/**
 * Common action labels with shortcuts
 */
export const COMMON_ACTIONS: Array<{
  destructive?: boolean;
  icon?: string;
  label: string;
  shortcut?: string;
}> = [
  { label: i18n.t('factory.menu.cut', 'Cut'), shortcut: '⌘X', icon: 'Scissors' },
  { label: i18n.t('factory.menu.copyAction', 'Copy'), shortcut: '⌘C', icon: 'Copy' },
  { label: i18n.t('factory.menu.pasteAction', 'Paste'), shortcut: '⌘V', icon: 'Paste' },
  { label: i18n.t('factory.menu.undoAction', 'Undo'), shortcut: '⌘Z', icon: 'Undo' },
  { label: i18n.t('factory.menu.redoAction', 'Redo'), shortcut: '⇧⌘Z', icon: 'Redo' },
  {
    label: i18n.t('factory.menu.deleteAction', 'Delete'),
    shortcut: '⌫',
    icon: 'Trash',
    destructive: true,
  },
  { label: i18n.t('factory.menu.selectAll', 'Select All'), shortcut: '⌘A' },
  { label: i18n.t('factory.menu.find', 'Find...'), shortcut: '⌘F' },
  { label: i18n.t('factory.menu.replace', 'Replace...'), shortcut: '⌥⌘F' },
];

/**
 * File menu actions
 */
export const FILE_ACTIONS: Array<{
  destructive?: boolean;
  icon?: string;
  label: string;
  shortcut?: string;
}> = [
  { label: i18n.t('factory.menu.new', 'New'), shortcut: '⌘N', icon: 'Plus' },
  { label: i18n.t('factory.menu.open', 'Open...'), shortcut: '⌘O', icon: 'Folder' },
  { label: i18n.t('factory.menu.save', 'Save'), shortcut: '⌘S' },
  { label: i18n.t('factory.menu.saveAs', 'Save As...'), shortcut: '⇧⌘S' },
  { label: i18n.t('factory.menu.export', 'Export'), icon: 'Download' },
  { label: i18n.t('factory.menu.print', 'Print...'), shortcut: '⌘P' },
  { label: i18n.t('factory.menu.close', 'Close'), shortcut: '⌘W' },
];

/**
 * View options for view menu
 */
export const VIEW_OPTIONS: Array<{ label: string; value: string }> = [
  { label: i18n.t('factory.menu.compact', 'Compact'), value: 'compact' },
  { label: i18n.t('factory.menu.comfortable', 'Comfortable'), value: 'comfortable' },
  { label: i18n.t('factory.menu.list', 'List'), value: 'list' },
  { label: i18n.t('factory.menu.grid', 'Grid'), value: 'grid' },
];

/**
 * Theme options
 */
export const THEME_OPTIONS: Array<{ label: string; value: string }> = [
  { label: i18n.t('factory.menu.light', 'Light'), value: 'light' },
  { label: i18n.t('factory.menu.dark', 'Dark'), value: 'dark' },
  { label: i18n.t('factory.menu.system', 'System'), value: 'system' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generates a random keyboard shortcut
 */
function generateShortcut(): string {
  const modifiers = ['⌘', '⇧⌘', '⌥⌘', '⌃'];
  const keys = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

  const modifier = faker.helpers.arrayElement(modifiers);
  const key = faker.helpers.arrayElement(keys);

  return `${modifier}${key}`;
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake menu item
 */
export function createFakeMenuItem(
  overrides?: Partial<FakeMenuItem>,
  depth: number = 0
): FakeMenuItem {
  const hasSubmenu = depth < 2 && faker.datatype.boolean({ probability: 0.2 });
  const hasShortcut = !hasSubmenu && faker.helpers.maybe(() => true, { probability: 0.4 });

  return {
    destructive: faker.helpers.maybe(() => true, { probability: 0.1 }),
    disabled: faker.helpers.maybe(() => true, { probability: 0.1 }),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement([...MENU_ICONS]), {
      probability: 0.5,
    }),
    id: faker.string.uuid(),
    inset: faker.helpers.maybe(() => true, { probability: 0.2 }),
    label: faker.lorem.words({ min: 1, max: 3 }),
    shortcut: hasShortcut ? generateShortcut() : undefined,
    submenu: hasSubmenu
      ? createFakeMenuItems(faker.number.int({ min: 2, max: 4 }), depth + 1)
      : undefined,
    type: 'item',
    ...overrides,
  };
}

/**
 * Creates a fake checkbox menu item
 */
export function createFakeMenuCheckboxItem(
  overrides?: Partial<FakeMenuCheckboxItem>
): FakeMenuCheckboxItem {
  const labels = [
    i18n.t('factory.menu.showToolbar', 'Show Toolbar'),
    i18n.t('factory.menu.showSidebar', 'Show Sidebar'),
    i18n.t('factory.menu.showStatusBar', 'Show Status Bar'),
    i18n.t('factory.menu.showLineNumbers', 'Show Line Numbers'),
    i18n.t('factory.menu.wordWrap', 'Word Wrap'),
    i18n.t('factory.menu.autoSave', 'Auto Save'),
    i18n.t('factory.menu.spellCheck', 'Spell Check'),
    i18n.t('factory.menu.showHiddenFiles', 'Show Hidden Files'),
    i18n.t('factory.menu.bookmarked', 'Bookmarked'),
    i18n.t('factory.menu.pinned', 'Pinned'),
  ];

  return {
    checked: faker.datatype.boolean(),
    disabled: faker.helpers.maybe(() => true, { probability: 0.1 }),
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(labels),
    type: 'checkbox',
    ...overrides,
  };
}

/**
 * Creates a fake radio menu item
 */
export function createFakeMenuRadioItem(
  value: string,
  label: string,
  overrides?: Partial<FakeMenuRadioItem>
): FakeMenuRadioItem {
  return {
    disabled: faker.helpers.maybe(() => true, { probability: 0.05 }),
    id: faker.string.uuid(),
    label,
    type: 'radio',
    value,
    ...overrides,
  };
}

/**
 * Creates a fake radio group
 */
export function createFakeMenuRadioGroup(
  options: Array<{ label: string; value: string }>,
  label?: string,
  overrides?: Partial<FakeMenuRadioGroup>
): FakeMenuRadioGroup {
  const items = options.map((opt) => createFakeMenuRadioItem(opt.value, opt.label));
  const selectedValue = faker.helpers.arrayElement(options).value;

  return {
    id: faker.string.uuid(),
    items,
    label,
    selectedValue,
    ...overrides,
  };
}

/**
 * Creates a fake menu group
 */
export function createFakeMenuGroup(
  itemCount: number = 3,
  label?: string,
  overrides?: Partial<FakeMenuGroup>
): FakeMenuGroup {
  return {
    id: faker.string.uuid(),
    items: createFakeMenuItems(itemCount),
    label,
    ...overrides,
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple menu items
 */
export function createFakeMenuItems(count: number, depth: number = 0): FakeMenuItem[] {
  return Array.from({ length: count }, () => createFakeMenuItem(undefined, depth));
}

/**
 * Creates multiple checkbox items
 */
export function createFakeMenuCheckboxItems(count: number): FakeMenuCheckboxItem[] {
  return Array.from({ length: count }, () => createFakeMenuCheckboxItem());
}

/**
 * Creates a complete fake menu configuration
 */
export function createFakeMenu(overrides?: Partial<FakeMenu>): FakeMenu {
  const hasCheckboxes = faker.helpers.maybe(() => true, { probability: 0.4 });
  const hasRadioGroup = faker.helpers.maybe(() => true, { probability: 0.3 });

  return {
    align: faker.helpers.arrayElement(MENU_ALIGNS),
    checkboxItems: hasCheckboxes
      ? createFakeMenuCheckboxItems(faker.number.int({ min: 2, max: 4 }))
      : undefined,
    groups: [createFakeMenuGroup(faker.number.int({ min: 3, max: 6 }))],
    id: faker.string.uuid(),
    radioGroups: hasRadioGroup
      ? [createFakeMenuRadioGroup(THEME_OPTIONS, i18n.t('factory.menu.theme', 'Theme'))]
      : undefined,
    side: faker.helpers.arrayElement(MENU_SIDES),
    width: faker.helpers.arrayElement(MENU_WIDTHS),
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a user menu (profile/account dropdown)
 */
export function createFakeUserMenu(overrides?: Partial<FakeUserMenu>): FakeUserMenu {
  return {
    ...createFakeMenu(),
    avatar: faker.image.avatar(),
    email: faker.internet.email(),
    groups: [
      {
        id: 'account',
        label: i18n.t('factory.menu.myAccount', 'My Account'),
        items: [
          {
            id: 'profile',
            label: i18n.t('factory.menu.profile', 'Profile'),
            icon: 'User',
            shortcut: '⇧⌘P',
          },
          {
            id: 'settings',
            label: i18n.t('factory.menu.settingsLabel', 'Settings'),
            icon: 'Settings',
            shortcut: '⌘,',
          },
          { id: 'billing', label: i18n.t('factory.menu.billing', 'Billing'), icon: 'CreditCard' },
        ],
      },
      {
        id: 'team',
        items: [
          { id: 'team', label: i18n.t('factory.menu.team', 'Team'), icon: 'Users' },
          {
            id: 'invite',
            label: i18n.t('factory.menu.inviteUsers', 'Invite Users'),
            icon: 'UserPlus',
          },
          {
            id: 'new-team',
            label: i18n.t('factory.menu.newTeam', 'New Team'),
            icon: 'Plus',
            shortcut: '⌘T',
          },
        ],
      },
      {
        id: 'support',
        items: [
          { id: 'help', label: i18n.t('factory.menu.help', 'Help'), icon: 'HelpCircle' },
          {
            id: 'feedback',
            label: i18n.t('factory.menu.sendFeedback', 'Send Feedback'),
            icon: 'MessageSquare',
          },
        ],
      },
      {
        id: 'logout',
        items: [
          {
            id: 'logout',
            label: i18n.t('factory.menu.logOut', 'Log out'),
            icon: 'LogOut',
            shortcut: '⇧⌘Q',
          },
        ],
      },
    ],
    name: faker.person.fullName(),
    width: 'w-56',
    ...overrides,
  };
}

/**
 * Creates a file menu
 */
export function createFakeFileMenu(overrides?: Partial<FakeFileMenu>): FakeFileMenu {
  const recentFiles = Array.from({ length: faker.number.int({ min: 3, max: 5 }) }, () => ({
    name: faker.system.fileName(),
    path: faker.system.filePath(),
  }));

  return {
    ...createFakeMenu(),
    groups: [
      {
        id: 'file-actions',
        items: FILE_ACTIONS.slice(0, 4).map((action) => ({
          id: action.label.toLowerCase().replaceAll(/\W/g, ''),
          label: action.label,
          shortcut: action.shortcut,
          icon: action.icon,
        })),
      },
      {
        id: 'recent',
        label: i18n.t('factory.menu.recentFiles', 'Recent Files'),
        items: recentFiles.map((file) => ({
          id: faker.string.uuid(),
          label: file.name,
          icon: i18n.t('factory.menu.file', 'File'),
        })),
      },
      {
        id: 'close',
        items: [
          { id: 'print', label: i18n.t('factory.menu.print', 'Print...'), shortcut: '⌘P' },
          { id: 'close', label: i18n.t('factory.menu.close', 'Close'), shortcut: '⌘W' },
        ],
      },
    ],
    recentFiles,
    width: 'w-56',
    ...overrides,
  };
}

/**
 * Creates an edit menu
 */
export function createFakeEditMenu(overrides?: Partial<FakeEditMenu>): FakeEditMenu {
  const canUndo = faker.datatype.boolean();
  const canRedo = faker.datatype.boolean();
  const hasSelection = faker.datatype.boolean();
  const canPaste = faker.datatype.boolean();

  return {
    ...createFakeMenu(),
    canPaste,
    canRedo,
    canUndo,
    groups: [
      {
        id: 'undo-redo',
        items: [
          {
            id: 'undo',
            label: i18n.t('factory.menu.undoAction', 'Undo'),
            shortcut: '⌘Z',
            icon: 'Undo',
            disabled: !canUndo,
          },
          {
            id: 'redo',
            label: i18n.t('factory.menu.redoAction', 'Redo'),
            shortcut: '⇧⌘Z',
            icon: 'Redo',
            disabled: !canRedo,
          },
        ],
      },
      {
        id: 'clipboard',
        items: [
          {
            id: 'cut',
            label: i18n.t('factory.menu.cut', 'Cut'),
            shortcut: '⌘X',
            icon: 'Scissors',
            disabled: !hasSelection,
          },
          {
            id: 'copy',
            label: i18n.t('factory.menu.copyAction', 'Copy'),
            shortcut: '⌘C',
            icon: 'Copy',
            disabled: !hasSelection,
          },
          {
            id: 'paste',
            label: i18n.t('factory.menu.pasteAction', 'Paste'),
            shortcut: '⌘V',
            icon: 'Paste',
            disabled: !canPaste,
          },
        ],
      },
      {
        id: 'selection',
        items: [
          {
            id: 'select-all',
            label: i18n.t('factory.menu.selectAll', 'Select All'),
            shortcut: '⌘A',
          },
          {
            id: 'delete',
            label: i18n.t('factory.menu.delete', 'Delete'),
            shortcut: '⌫',
            icon: ICON_TRASH,
            destructive: true,
            disabled: !hasSelection,
          },
        ],
      },
      {
        id: 'find',
        items: [
          { id: 'find', label: i18n.t('factory.menu.find', 'Find...'), shortcut: '⌘F' },
          { id: 'replace', label: i18n.t('factory.menu.replace', 'Replace...'), shortcut: '⌥⌘F' },
        ],
      },
    ],
    hasSelection,
    width: 'w-52',
    ...overrides,
  };
}

/**
 * Creates a view menu
 */
export function createFakeViewMenu(overrides?: Partial<FakeViewMenu>): FakeViewMenu {
  const zoomLevel = faker.helpers.arrayElement([50, 75, 100, 125, 150, 200]);

  return {
    ...createFakeMenu(),
    checkboxItems: [
      {
        id: 'toolbar',
        label: i18n.t('factory.menu.showToolbar', 'Show Toolbar'),
        checked: true,
        type: 'checkbox',
      },
      {
        id: 'sidebar',
        label: i18n.t('factory.menu.showSidebar', 'Show Sidebar'),
        checked: true,
        type: 'checkbox',
      },
      {
        id: 'statusbar',
        label: i18n.t('factory.menu.showStatusBar', 'Show Status Bar'),
        checked: true,
        type: 'checkbox',
      },
      {
        id: 'minimap',
        label: i18n.t('factory.menu.showMinimap', 'Show Minimap'),
        checked: false,
        type: 'checkbox',
      },
    ],
    groups: [
      {
        id: 'zoom',
        items: [
          { id: 'zoom-in', label: i18n.t('factory.menu.zoomIn', 'Zoom In'), shortcut: '⌘+' },
          { id: 'zoom-out', label: i18n.t('factory.menu.zoomOut', 'Zoom Out'), shortcut: '⌘-' },
          {
            id: 'zoom-reset',
            label: i18n.t('factory.menu.resetZoom', 'Reset Zoom ({{zoomLevel}}%)', { zoomLevel }),
            shortcut: '⌘0',
          },
        ],
      },
    ],
    radioGroups: [createFakeMenuRadioGroup(VIEW_OPTIONS, i18n.t('factory.menu.layout', 'Layout'))],
    width: 'w-52',
    zoomLevel,
    ...overrides,
  };
}

/**
 * Creates a sort menu
 */
export function createFakeSortMenu(): FakeMenu {
  const sortOptions = [
    { label: i18n.t('factory.menu.name', 'Name'), value: 'name' },
    { label: i18n.t('factory.menu.dateModified', 'Date Modified'), value: 'modified' },
    { label: i18n.t('factory.menu.dateCreated', 'Date Created'), value: 'created' },
    { label: i18n.t('factory.menu.size', 'Size'), value: 'size' },
    { label: i18n.t('factory.menu.kind', 'Kind'), value: 'kind' },
  ];

  const orderOptions = [
    { label: i18n.t('factory.menu.ascending', 'Ascending'), value: 'asc' },
    { label: i18n.t('factory.menu.descending', 'Descending'), value: 'desc' },
  ];

  return {
    groups: [],
    id: faker.string.uuid(),
    radioGroups: [
      createFakeMenuRadioGroup(sortOptions, i18n.t('factory.menu.sortBy', 'Sort By')),
      createFakeMenuRadioGroup(orderOptions, i18n.t('factory.menu.order', 'Order')),
    ],
    width: 'w-48',
  };
}

/**
 * Creates a share menu
 */
export function createFakeShareMenu(): FakeMenu {
  return {
    groups: [
      {
        id: 'share-options',
        items: [
          {
            id: 'copy-link',
            label: i18n.t('factory.menu.copyLink', 'Copy Link'),
            icon: 'Link',
            shortcut: '⌘L',
          },
          { id: 'email', label: i18n.t('factory.menu.email', 'Email'), icon: 'Mail' },
          {
            id: 'message',
            label: i18n.t('factory.menu.message', 'Message'),
            icon: 'MessageSquare',
          },
        ],
      },
      {
        id: 'social',
        label: i18n.t('factory.menu.shareTo', 'Share to'),
        items: [
          { id: 'twitter', label: i18n.t('factory.menu.twitter', 'Twitter') },
          { id: 'facebook', label: i18n.t('factory.menu.facebook', 'Facebook') },
          { id: 'linkedin', label: i18n.t('factory.menu.linkedIn', 'LinkedIn') },
        ],
      },
    ],
    id: faker.string.uuid(),
    width: 'w-48',
  };
}

/**
 * Creates a more actions menu (ellipsis menu)
 */
export function createFakeMoreActionsMenu(): FakeMenu {
  return {
    groups: [
      {
        id: 'actions',
        items: [
          { id: 'edit', label: i18n.t('factory.menu.editAction', 'Edit'), icon: 'Edit' },
          { id: 'duplicate', label: i18n.t('factory.menu.duplicate', 'Duplicate'), icon: 'Copy' },
          { id: 'archive', label: i18n.t('factory.menu.archive', 'Archive'), icon: 'Archive' },
        ],
      },
      {
        id: 'destructive',
        items: [
          {
            id: 'delete',
            label: i18n.t('factory.menu.delete', 'Delete'),
            icon: ICON_TRASH,
            destructive: true,
          },
        ],
      },
    ],
    id: faker.string.uuid(),
    width: 'w-40',
  };
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of menu configurations for visual testing
 */
export function createFakeMenuMatrix(): Record<string, FakeMenu> {
  return {
    basic: {
      groups: [createFakeMenuGroup(4)],
      id: 'basic-menu',
      width: 'w-48',
    },
    withShortcuts: {
      groups: [
        {
          id: 'shortcuts',
          items: COMMON_ACTIONS.slice(0, 5).map((action) => ({
            destructive: action.destructive,
            icon: action.icon,
            id: action.label.toLowerCase().replaceAll(/\W/g, ''),
            label: action.label,
            shortcut: action.shortcut,
          })),
        },
      ],
      id: 'shortcuts-menu',
      width: 'w-52',
    },
    withCheckboxes: {
      checkboxItems: createFakeMenuCheckboxItems(4),
      groups: [],
      id: 'checkbox-menu',
      width: 'w-52',
    },
    withRadioGroup: {
      groups: [],
      id: 'radio-menu',
      radioGroups: [createFakeMenuRadioGroup(THEME_OPTIONS, i18n.t('factory.menu.theme', 'Theme'))],
      width: 'w-48',
    },
    withSubmenu: {
      groups: [
        {
          id: 'main',
          items: [
            { id: 'item-1', label: i18n.t('factory.menu.item1', 'Item 1') },
            {
              id: 'submenu',
              label: i18n.t('factory.menu.moreOptions', 'More Options'),
              submenu: [
                { id: 'sub-1', label: i18n.t('factory.menu.subItem1', 'Sub Item 1') },
                { id: 'sub-2', label: i18n.t('factory.menu.subItem2', 'Sub Item 2') },
                { id: 'sub-3', label: i18n.t('factory.menu.subItem3', 'Sub Item 3') },
              ],
            },
            { id: 'item-2', label: i18n.t('factory.menu.item2', 'Item 2') },
          ],
        },
      ],
      id: 'submenu-menu',
      width: 'w-48',
    },
    withGroups: {
      groups: [
        {
          id: 'group-1',
          label: i18n.t('factory.menu.group1', 'Group 1'),
          items: createFakeMenuItems(3),
        },
        {
          id: 'group-2',
          label: i18n.t('factory.menu.group2', 'Group 2'),
          items: createFakeMenuItems(2),
        },
      ],
      id: 'grouped-menu',
      width: 'w-56',
    },
    withDestructive: {
      groups: [
        {
          id: 'actions',
          items: [
            { id: 'edit', label: i18n.t('factory.menu.editAction', 'Edit'), icon: 'Edit' },
            { id: 'share', label: i18n.t('factory.menu.shareAction', 'Share'), icon: 'Share' },
          ],
        },
        {
          id: 'danger',
          items: [
            {
              id: 'delete',
              label: i18n.t('factory.menu.delete', 'Delete'),
              icon: ICON_TRASH,
              destructive: true,
            },
          ],
        },
      ],
      id: 'destructive-menu',
      width: 'w-48',
    },
    complex: createFakeMenu(),
  };
}

/**
 * Creates a showcase of all menu types
 */
export function createFakeMenuShowcase(): Record<string, FakeMenu> {
  return {
    basic: createFakeMenu(),
    userMenu: createFakeUserMenu(),
    fileMenu: createFakeFileMenu(),
    editMenu: createFakeEditMenu(),
    viewMenu: createFakeViewMenu(),
    sortMenu: createFakeSortMenu(),
    shareMenu: createFakeShareMenu(),
    moreActions: createFakeMoreActionsMenu(),
  };
}
