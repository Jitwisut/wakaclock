/**
 * @fileoverview Factory functions for generating fake Menubar component data
 * @module menubar.factory
 * @description Provides comprehensive test data generation for Menubar components
 * including menus, items, checkboxes, radio groups, submenus, and shortcuts.
 *
 * @example
 * ```typescript
 * import { createFakeMenubar, createFakeMenubarMenu, MENUBAR_ITEM_ACTIONS } from './_factories/menubar.factory';
 *
 * // Create a complete menubar
 * const menubar = createFakeMenubar();
 *
 * // Create a single menu with items
 * const menu = createFakeMenubarMenu();
 *
 * // Create specific item types
 * const checkboxItem = createFakeMenubarCheckboxItem();
 * const radioGroup = createFakeMenubarRadioGroup();
 * ```
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

const LABEL_PROFILE = 'Profile';
const LABEL_THEME = 'Theme';
const KEY_THEME = 'factory.menubar.theme';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Menubar item variant types
 * @description Visual variants for menu items
 */
export type MenubarItemVariant = 'default' | 'destructive';

/**
 * Menubar size variants
 * @description Size presets for the menubar
 */
export type MenubarSize = 'compact' | 'default' | 'wide';

/**
 * Menubar item type
 * @description Different types of menu items
 */
export type MenubarItemType = 'checkbox' | 'item' | 'label' | 'radio' | 'separator' | 'submenu';

/**
 * Menu trigger identifier
 * @description Standard menu trigger names
 */
export type MenubarTriggerName =
  | 'Edit'
  | 'File'
  | 'Format'
  | 'Help'
  | 'Insert'
  | 'Selection'
  | 'Tools'
  | 'View'
  | 'Window';

/**
 * Common action labels
 * @description Standard action names for menu items
 */
export type MenubarActionLabel =
  | 'Close'
  | 'Copy'
  | 'Cut'
  | 'Delete'
  | 'Exit'
  | 'Export'
  | 'Find'
  | 'Full Screen'
  | 'New'
  | 'New Tab'
  | 'New Window'
  | 'Open'
  | 'Paste'
  | 'Print'
  | 'Redo'
  | 'Replace'
  | 'Save'
  | 'Save As'
  | 'Select All'
  | 'Share'
  | 'Undo'
  | 'Zoom In'
  | 'Zoom Out';

/**
 * Platform for keyboard shortcuts
 * @description Platform affects how shortcuts are displayed
 */
export type MenubarPlatform = 'linux' | 'mac' | 'windows';

// ============================================================================
// CONSTANTS
// ============================================================================

/** All available item variants */
export const MENUBAR_ITEM_VARIANTS: MenubarItemVariant[] = ['default', 'destructive'];

/** All available sizes */
export const MENUBAR_SIZES: MenubarSize[] = ['compact', 'default', 'wide'];

/** All available item types */
export const MENUBAR_ITEM_TYPES: MenubarItemType[] = [
  'item',
  'checkbox',
  'radio',
  'separator',
  'label',
  'submenu',
];

/** Standard menu trigger names */
export const MENUBAR_TRIGGER_NAMES: MenubarTriggerName[] = [
  'File',
  'Edit',
  'View',
  'Insert',
  'Format',
  'Selection',
  'Tools',
  'Window',
  'Help',
];

/** Common action labels for menu items */
export const MENUBAR_ACTION_LABELS: MenubarActionLabel[] = [
  'New',
  'New Tab',
  'New Window',
  'Open',
  'Save',
  'Save As',
  'Export',
  'Print',
  'Close',
  'Exit',
  'Undo',
  'Redo',
  'Cut',
  'Copy',
  'Paste',
  'Delete',
  'Select All',
  'Find',
  'Replace',
  'Zoom In',
  'Zoom Out',
  'Full Screen',
  'Share',
];

/** Standard icons for menu items */
export const MENUBAR_ICONS = [
  'File',
  'FileText',
  'Folder',
  'FolderOpen',
  'Save',
  'Download',
  'Upload',
  'Print',
  'Share',
  'Trash',
  'Edit',
  'Pencil',
  'Copy',
  'Clipboard',
  'Scissors',
  'Search',
  'ZoomIn',
  'ZoomOut',
  'Eye',
  'EyeOff',
  'Settings',
  'HelpCircle',
  'Info',
];

/** Mac keyboard shortcut modifiers */
export const MENUBAR_MAC_MODIFIERS = ['⌘', '⇧', '⌥', '⌃'];

/** Windows/Linux keyboard shortcut modifiers */
export const MENUBAR_WIN_MODIFIERS = ['Ctrl', 'Shift', 'Alt'];

/** Common keyboard shortcut mappings */
export const MENUBAR_SHORTCUTS: Record<MenubarActionLabel, string> = {
  Close: '⌘W',
  Copy: '⌘C',
  Cut: '⌘X',
  Delete: '⌫',
  Exit: '⌘Q',
  Export: '⇧⌘E',
  Find: '⌘F',
  'Full Screen': '⌃⌘F',
  New: '⌘N',
  'New Tab': '⌘T',
  'New Window': '⇧⌘N',
  Open: '⌘O',
  Paste: '⌘V',
  Print: '⌘P',
  Redo: '⇧⌘Z',
  Replace: '⌘H',
  Save: '⌘S',
  'Save As': '⇧⌘S',
  'Select All': '⌘A',
  Share: '⇧⌘S',
  Undo: '⌘Z',
  'Zoom In': '⌘+',
  'Zoom Out': '⌘-',
};

/** View options for checkbox items */
export const MENUBAR_VIEW_OPTIONS = [
  i18n.t('factory.menubar.showToolbar', 'Show Toolbar'),
  i18n.t('factory.menubar.showStatusBar', 'Show Status Bar'),
  i18n.t('factory.menubar.showSidebar', 'Show Sidebar'),
  i18n.t('factory.menubar.showBookmarksBar', 'Show Bookmarks Bar'),
  i18n.t('factory.menubar.showLineNumbers', 'Show Line Numbers'),
  i18n.t('factory.menubar.showMinimap', 'Show Minimap'),
  i18n.t('factory.menubar.showBreadcrumbs', 'Show Breadcrumbs'),
  i18n.t('factory.menubar.wordWrap', 'Word Wrap'),
  i18n.t('factory.menubar.showHiddenFiles', 'Show Hidden Files'),
  i18n.t('factory.menubar.showFileExtensions', 'Show File Extensions'),
];

/** Theme options for radio items */
export const MENUBAR_THEME_OPTIONS = [
  i18n.t('factory.menubar.light', 'Light'),
  i18n.t('factory.menubar.dark', 'Dark'),
  i18n.t('factory.menubar.system', 'System'),
];

/** Font size options for radio items */
export const MENUBAR_FONT_SIZE_OPTIONS = [
  i18n.t('factory.menubar.small', 'Small'),
  i18n.t('factory.menubar.medium', 'Medium'),
  i18n.t('factory.menubar.large', 'Large'),
  i18n.t('factory.menubar.extraLarge', 'Extra Large'),
];

/** Language options for radio items */
export const MENUBAR_LANGUAGE_OPTIONS = [
  i18n.t('factory.menubar.english', 'English'),
  i18n.t('factory.menubar.japanese', 'Japanese'),
  i18n.t('factory.menubar.spanish', 'Spanish'),
  i18n.t('factory.menubar.french', 'French'),
  i18n.t('factory.menubar.german', 'German'),
];

/** Profile names for radio items */
export const MENUBAR_PROFILE_OPTIONS = [
  i18n.t('factory.menubar.default', 'Default'),
  i18n.t('factory.menubar.work', 'Work'),
  i18n.t('factory.menubar.personal', 'Personal'),
  i18n.t('factory.menubar.development', 'Development'),
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base interface for all menubar items
 */
export interface FakeMenubarItemBase {
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Unique identifier */
  id: string;
  /** Item type discriminator */
  type: MenubarItemType;
}

/**
 * Standard menu item
 */
export interface FakeMenubarItem extends FakeMenubarItemBase {
  /** Icon name */
  icon?: string;
  /** Whether to show inset padding */
  inset?: boolean;
  /** Display label */
  label: string;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Nested submenu items */
  submenu?: FakeMenubarAnyItem[];
  /** Item type */
  type: 'item' | 'submenu';
  /** Visual variant */
  variant?: MenubarItemVariant;
}

/**
 * Checkbox menu item
 */
export interface FakeMenubarCheckboxItem extends FakeMenubarItemBase {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Display label */
  label: string;
  /** Item type */
  type: 'checkbox';
}

/**
 * Radio menu item
 */
export interface FakeMenubarRadioItem extends FakeMenubarItemBase {
  /** Display label */
  label: string;
  /** Item type */
  type: 'radio';
  /** Radio value */
  value: string;
}

/**
 * Label item (non-interactive)
 */
export interface FakeMenubarLabelItem extends FakeMenubarItemBase {
  /** Whether to show inset padding */
  inset?: boolean;
  /** Display label */
  label: string;
  /** Item type */
  type: 'label';
}

/**
 * Separator item
 */
export interface FakeMenubarSeparatorItem extends FakeMenubarItemBase {
  /** Item type */
  type: 'separator';
}

/**
 * Radio group containing radio items
 */
export interface FakeMenubarRadioGroup {
  /** Unique identifier */
  id: string;
  /** Radio items in the group */
  items: FakeMenubarRadioItem[];
  /** Group label */
  label?: string;
  /** Currently selected value */
  value: string;
}

/**
 * Union type of all menu item types
 */
export type FakeMenubarAnyItem =
  | FakeMenubarCheckboxItem
  | FakeMenubarItem
  | FakeMenubarLabelItem
  | FakeMenubarSeparatorItem;

/**
 * Menu with trigger and content
 */
export interface FakeMenubarMenu {
  /** Unique identifier */
  id: string;
  /** Menu items */
  items: FakeMenubarAnyItem[];
  /** Radio groups in this menu */
  radioGroups?: FakeMenubarRadioGroup[];
  /** Trigger label */
  trigger: string;
}

/**
 * Complete menubar structure
 */
export interface FakeMenubar {
  /** Unique identifier */
  id: string;
  /** Menus in the menubar */
  menus: FakeMenubarMenu[];
  /** Menubar size */
  size: MenubarSize;
}

/**
 * Menubar keyboard shortcut
 */
export interface FakeMenubarShortcut {
  /** Action this shortcut performs */
  action: string;
  /** Platform-specific display string */
  display: string;
  /** Shortcut keys */
  keys: string[];
  /** Platform */
  platform: MenubarPlatform;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets a shortcut for an action
 * @param action - The action label
 * @returns The keyboard shortcut or undefined
 */
function getShortcutForAction(action: string): string | undefined {
  return MENUBAR_SHORTCUTS[action as MenubarActionLabel];
}

/**
 * Determines if an action should have a shortcut
 * @param action - The action label
 * @returns Whether to include a shortcut
 */
function shouldHaveShortcut(action: string): boolean {
  return action in MENUBAR_SHORTCUTS && faker.datatype.boolean({ probability: 0.7 });
}

/**
 * Gets variant based on action type
 * @param action - The action label
 * @returns The appropriate variant
 */
function getVariantForAction(action: string): MenubarItemVariant {
  const destructiveActions = ['Delete', 'Exit', 'Close'];
  return destructiveActions.includes(action) ? 'destructive' : 'default';
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake menubar item
 * @param overrides - Optional property overrides
 * @param depth - Current nesting depth (for limiting recursion)
 * @returns Fake menubar item
 */
export function createFakeMenubarItem(
  overrides?: Partial<FakeMenubarItem>,
  depth: number = 0
): FakeMenubarItem {
  const label = faker.helpers.arrayElement(MENUBAR_ACTION_LABELS);
  const hasSubmenu = depth < 2 && faker.datatype.boolean({ probability: 0.15 });
  const shortcut = shouldHaveShortcut(label) ? getShortcutForAction(label) : undefined;

  return {
    id: faker.string.uuid(),
    type: hasSubmenu ? 'submenu' : 'item',
    label,
    shortcut,
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(MENUBAR_ICONS), {
      probability: 0.3,
    }),
    variant: getVariantForAction(label),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    inset: faker.helpers.maybe(() => true, { probability: 0.3 }),
    submenu: hasSubmenu
      ? createFakeMenubarItems(faker.number.int({ min: 2, max: 5 }), depth + 1)
      : undefined,
    ...overrides,
  };
}

/**
 * Creates a fake checkbox item
 * @param overrides - Optional property overrides
 * @returns Fake checkbox item
 */
export function createFakeMenubarCheckboxItem(
  overrides?: Partial<FakeMenubarCheckboxItem>
): FakeMenubarCheckboxItem {
  return {
    id: faker.string.uuid(),
    type: 'checkbox',
    label: faker.helpers.arrayElement(MENUBAR_VIEW_OPTIONS),
    checked: faker.datatype.boolean(),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake radio item
 * @param overrides - Optional property overrides
 * @returns Fake radio item
 */
export function createFakeMenubarRadioItem(
  overrides?: Partial<FakeMenubarRadioItem>
): FakeMenubarRadioItem {
  const label = faker.lorem.word();
  return {
    id: faker.string.uuid(),
    type: 'radio',
    label,
    value: label.toLowerCase().replaceAll(/\s+/g, '-'),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake label item
 * @param overrides - Optional property overrides
 * @returns Fake label item
 */
export function createFakeMenubarLabelItem(
  overrides?: Partial<FakeMenubarLabelItem>
): FakeMenubarLabelItem {
  return {
    id: faker.string.uuid(),
    type: 'label',
    label: faker.helpers.arrayElement([
      i18n.t('factory.menubar.options', 'Options'),
      i18n.t('factory.menubar.settings', 'Settings'),
      i18n.t('factory.menubar.preferences', 'Preferences'),
      i18n.t('factory.menubar.profile', LABEL_PROFILE),
      i18n.t(KEY_THEME, LABEL_THEME),
    ]),
    inset: faker.helpers.maybe(() => true, { probability: 0.5 }),
    disabled: false,
    ...overrides,
  };
}

/**
 * Creates a fake separator item
 * @returns Fake separator item
 */
export function createFakeMenubarSeparatorItem(): FakeMenubarSeparatorItem {
  return {
    id: faker.string.uuid(),
    type: 'separator',
  };
}

/**
 * Creates a fake radio group
 * @param options - Array of option labels
 * @param overrides - Optional property overrides
 * @returns Fake radio group
 */
export function createFakeMenubarRadioGroup(
  options?: string[],
  overrides?: Partial<FakeMenubarRadioGroup>
): FakeMenubarRadioGroup {
  const optionLabels =
    options ??
    faker.helpers.arrayElement([
      MENUBAR_THEME_OPTIONS,
      MENUBAR_FONT_SIZE_OPTIONS,
      MENUBAR_PROFILE_OPTIONS,
    ]);

  const items = optionLabels.map((label) =>
    createFakeMenubarRadioItem({
      label,
      value: label.toLowerCase().replaceAll(/\s+/g, '-'),
    })
  );

  return {
    id: faker.string.uuid(),
    items,
    value: faker.helpers.arrayElement(items).value,
    label: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t(KEY_THEME, LABEL_THEME),
          i18n.t('factory.menubar.fontSize', 'Font Size'),
          i18n.t('factory.menubar.profile', LABEL_PROFILE),
        ]),
      {
        probability: 0.5,
      }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake keyboard shortcut
 * @param overrides - Optional property overrides
 * @returns Fake keyboard shortcut
 */
export function createFakeMenubarShortcut(
  overrides?: Partial<FakeMenubarShortcut>
): FakeMenubarShortcut {
  const action = faker.helpers.arrayElement(MENUBAR_ACTION_LABELS);
  const platform = faker.helpers.arrayElement<MenubarPlatform>(['mac', 'windows', 'linux']);
  const display = MENUBAR_SHORTCUTS[action] ?? '⌘K';

  return {
    action,
    platform,
    display,
    keys: [...display],
    ...overrides,
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple menubar items
 * @param count - Number of items to create
 * @param depth - Current nesting depth
 * @returns Array of menubar items
 */
export function createFakeMenubarItems(count: number, depth: number = 0): FakeMenubarItem[] {
  return Array.from({ length: count }, () => createFakeMenubarItem(undefined, depth));
}

/**
 * Creates multiple checkbox items
 * @param count - Number of items to create
 * @returns Array of checkbox items
 */
export function createFakeMenubarCheckboxItems(count: number): FakeMenubarCheckboxItem[] {
  return Array.from({ length: count }, () => createFakeMenubarCheckboxItem());
}

/**
 * Creates multiple radio groups
 * @param count - Number of groups to create
 * @returns Array of radio groups
 */
export function createFakeMenubarRadioGroups(count: number): FakeMenubarRadioGroup[] {
  return Array.from({ length: count }, () => createFakeMenubarRadioGroup());
}

// ============================================================================
// MENU FACTORIES
// ============================================================================

/**
 * Creates a fake menu with mixed item types
 * @param overrides - Optional property overrides
 * @returns Fake menu
 */
export function createFakeMenubarMenu(overrides?: Partial<FakeMenubarMenu>): FakeMenubarMenu {
  const items: FakeMenubarAnyItem[] = [];

  // Add some regular items
  items.push(...createFakeMenubarItems(faker.number.int({ min: 2, max: 4 })));

  // Maybe add a separator and more items
  if (faker.datatype.boolean({ probability: 0.7 })) {
    items.push(createFakeMenubarSeparatorItem());
    items.push(...createFakeMenubarItems(faker.number.int({ min: 1, max: 3 })));
  }

  // Maybe add checkbox items
  if (faker.datatype.boolean({ probability: 0.3 })) {
    items.push(createFakeMenubarSeparatorItem());
    items.push(
      createFakeMenubarLabelItem({ label: i18n.t('factory.menubar.viewOptions', 'View Options') })
    );
    items.push(
      ...MENUBAR_VIEW_OPTIONS.slice(0, faker.number.int({ min: 2, max: 4 })).map((label) =>
        createFakeMenubarCheckboxItem({ label })
      )
    );
  }

  return {
    id: faker.string.uuid(),
    trigger: faker.helpers.arrayElement(MENUBAR_TRIGGER_NAMES),
    items,
    radioGroups: faker.helpers.maybe(() => [createFakeMenubarRadioGroup()], { probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Creates a fake menubar with multiple menus
 * @param overrides - Optional property overrides
 * @returns Fake menubar
 */
export function createFakeMenubar(overrides?: Partial<FakeMenubar>): FakeMenubar {
  const triggers = [...MENUBAR_TRIGGER_NAMES];
  const menuCount = faker.number.int({ min: 4, max: 7 });

  const menus = triggers.slice(0, menuCount).map((trigger) => createFakeMenubarMenu({ trigger }));

  return {
    id: faker.string.uuid(),
    menus,
    size: faker.helpers.arrayElement(MENUBAR_SIZES),
    ...overrides,
  };
}

/**
 * Creates multiple menubars
 * @param count - Number of menubars to create
 * @returns Array of menubars
 */
export function createFakeMenubars(count: number): FakeMenubar[] {
  return Array.from({ length: count }, () => createFakeMenubar());
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a File menu
 * @returns File menu with standard actions
 */
export function createFakeMenubarFileMenu(): FakeMenubarMenu {
  return createFakeMenubarMenu({
    trigger: 'File',
    items: [
      createFakeMenubarItem({ label: i18n.t('factory.menubar.new', 'New'), shortcut: '⌘N' }),
      createFakeMenubarItem({ label: i18n.t('factory.menubar.newTab', 'New Tab'), shortcut: '⌘T' }),
      createFakeMenubarItem({
        label: i18n.t('factory.menubar.newWindow', 'New Window'),
        shortcut: '⇧⌘N',
      }),
      createFakeMenubarSeparatorItem(),
      createFakeMenubarItem({ label: i18n.t('factory.menubar.open', 'Open'), shortcut: '⌘O' }),
      createFakeMenubarItem({
        label: i18n.t('factory.menubar.openRecent', 'Open Recent'),
        type: 'submenu',
        submenu: [
          createFakeMenubarItem({ label: 'document1.txt' }),
          createFakeMenubarItem({ label: 'document2.txt' }),
          createFakeMenubarItem({ label: 'document3.txt' }),
          createFakeMenubarSeparatorItem(),
          createFakeMenubarItem({ label: i18n.t('factory.menubar.clearRecent', 'Clear Recent') }),
        ],
      }),
      createFakeMenubarSeparatorItem(),
      createFakeMenubarItem({ label: i18n.t('factory.menubar.save', 'Save'), shortcut: '⌘S' }),
      createFakeMenubarItem({
        label: i18n.t('factory.menubar.saveAs', 'Save As'),
        shortcut: '⇧⌘S',
      }),
      createFakeMenubarSeparatorItem(),
      createFakeMenubarItem({
        label: i18n.t('factory.menubar.share', 'Share'),
        type: 'submenu',
        submenu: [
          createFakeMenubarItem({ label: i18n.t('factory.menubar.email', 'Email') }),
          createFakeMenubarItem({ label: i18n.t('factory.menubar.copyLink', 'Copy Link') }),
          createFakeMenubarItem({ label: i18n.t('factory.menubar.airDrop', 'AirDrop') }),
        ],
      }),
      createFakeMenubarSeparatorItem(),
      createFakeMenubarItem({ label: i18n.t('factory.menubar.print', 'Print'), shortcut: '⌘P' }),
      createFakeMenubarSeparatorItem(),
      createFakeMenubarItem({
        label: i18n.t('factory.menubar.close', 'Close'),
        shortcut: '⌘W',
        variant: 'destructive',
      }),
    ],
  });
}

/**
 * Creates an Edit menu
 * @returns Edit menu with standard actions
 */
export function createFakeMenubarEditMenu(): FakeMenubarMenu {
  return createFakeMenubarMenu({
    trigger: 'Edit',
    items: [
      createFakeMenubarItem({ label: i18n.t('factory.menubar.undo', 'Undo'), shortcut: '⌘Z' }),
      createFakeMenubarItem({ label: i18n.t('factory.menubar.redo', 'Redo'), shortcut: '⇧⌘Z' }),
      createFakeMenubarSeparatorItem(),
      createFakeMenubarItem({ label: i18n.t('factory.menubar.cut', 'Cut'), shortcut: '⌘X' }),
      createFakeMenubarItem({ label: i18n.t('factory.menubar.copy', 'Copy'), shortcut: '⌘C' }),
      createFakeMenubarItem({ label: i18n.t('factory.menubar.paste', 'Paste'), shortcut: '⌘V' }),
      createFakeMenubarItem({
        label: i18n.t('factory.menubar.delete', 'Delete'),
        variant: 'destructive',
      }),
      createFakeMenubarSeparatorItem(),
      createFakeMenubarItem({
        label: i18n.t('factory.menubar.selectAll', 'Select All'),
        shortcut: '⌘A',
      }),
      createFakeMenubarSeparatorItem(),
      createFakeMenubarItem({ label: i18n.t('factory.menubar.find', 'Find'), shortcut: '⌘F' }),
      createFakeMenubarItem({
        label: i18n.t('factory.menubar.replace', 'Replace'),
        shortcut: '⌘H',
      }),
    ],
  });
}

/**
 * Creates a View menu with checkboxes and radio groups
 * @returns View menu with view options
 */
export function createFakeMenubarViewMenu(): FakeMenubarMenu {
  return {
    id: faker.string.uuid(),
    trigger: 'View',
    items: [
      createFakeMenubarCheckboxItem({
        label: i18n.t('factory.menubar.showToolbar', 'Show Toolbar'),
        checked: true,
      }),
      createFakeMenubarCheckboxItem({
        label: i18n.t('factory.menubar.showStatusBar', 'Show Status Bar'),
        checked: true,
      }),
      createFakeMenubarCheckboxItem({
        label: i18n.t('factory.menubar.showSidebar', 'Show Sidebar'),
        checked: false,
      }),
      createFakeMenubarSeparatorItem(),
      createFakeMenubarItem({ label: i18n.t('factory.menubar.zoomIn', 'Zoom In'), shortcut: '⌘+' }),
      createFakeMenubarItem({
        label: i18n.t('factory.menubar.zoomOut', 'Zoom Out'),
        shortcut: '⌘-',
      }),
      createFakeMenubarSeparatorItem(),
      createFakeMenubarItem({
        label: i18n.t('factory.menubar.fullScreen', 'Full Screen'),
        shortcut: '⌃⌘F',
      }),
    ],
    radioGroups: [
      createFakeMenubarRadioGroup(MENUBAR_THEME_OPTIONS, {
        label: i18n.t(KEY_THEME, LABEL_THEME),
        value: 'system',
      }),
    ],
  };
}

/**
 * Creates a Help menu
 * @returns Help menu with standard items
 */
export function createFakeHelpMenu(): FakeMenubarMenu {
  return createFakeMenubarMenu({
    trigger: 'Help',
    items: [
      createFakeMenubarItem({
        label: i18n.t('factory.menubar.documentation', 'Documentation'),
        icon: 'FileText',
      }),
      createFakeMenubarItem({
        label: i18n.t('factory.menubar.keyboardShortcuts', 'Keyboard Shortcuts'),
        shortcut: '⌘/',
      }),
      createFakeMenubarSeparatorItem(),
      createFakeMenubarItem({ label: i18n.t('factory.menubar.reportIssue', 'Report Issue') }),
      createFakeMenubarItem({
        label: i18n.t('factory.menubar.checkForUpdates', 'Check for Updates'),
      }),
      createFakeMenubarSeparatorItem(),
      createFakeMenubarItem({ label: i18n.t('factory.menubar.about', 'About'), icon: 'Info' }),
    ],
  });
}

/**
 * Creates a complete application menubar
 * @returns Menubar with File, Edit, View, and Help menus
 */
export function createFakeApplicationMenubar(): FakeMenubar {
  return {
    id: faker.string.uuid(),
    menus: [
      createFakeMenubarFileMenu(),
      createFakeMenubarEditMenu(),
      createFakeMenubarViewMenu(),
      createFakeHelpMenu(),
    ],
    size: 'default',
  };
}

/**
 * Creates a text editor menubar
 * @returns Menubar optimized for text editing
 */
export function createFakeTextEditorMenubar(): FakeMenubar {
  return {
    id: faker.string.uuid(),
    menus: [
      createFakeMenubarFileMenu(),
      createFakeMenubarEditMenu(),
      createFakeMenubarMenu({
        trigger: 'Format',
        items: [
          createFakeMenubarItem({ label: i18n.t('factory.menubar.bold', 'Bold'), shortcut: '⌘B' }),
          createFakeMenubarItem({
            label: i18n.t('factory.menubar.italic', 'Italic'),
            shortcut: '⌘I',
          }),
          createFakeMenubarItem({
            label: i18n.t('factory.menubar.underline', 'Underline'),
            shortcut: '⌘U',
          }),
          createFakeMenubarItem({
            label: i18n.t('factory.menubar.strikethrough', 'Strikethrough'),
            shortcut: '⇧⌘X',
          }),
          createFakeMenubarSeparatorItem(),
          createFakeMenubarItem({
            label: i18n.t('factory.menubar.alignment', 'Alignment'),
            type: 'submenu',
            submenu: [
              createFakeMenubarItem({ label: i18n.t('factory.menubar.alignLeft', 'Align Left') }),
              createFakeMenubarItem({
                label: i18n.t('factory.menubar.alignCenter', 'Align Center'),
              }),
              createFakeMenubarItem({ label: i18n.t('factory.menubar.alignRight', 'Align Right') }),
              createFakeMenubarItem({ label: i18n.t('factory.menubar.justify', 'Justify') }),
            ],
          }),
        ],
      }),
      createFakeMenubarViewMenu(),
      createFakeHelpMenu(),
    ],
    size: 'default',
  };
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of menu items by variant
 * @returns Array of items, one for each variant
 */
export function createFakeMenubarItemVariantMatrix(): FakeMenubarItem[] {
  return MENUBAR_ITEM_VARIANTS.map((variant) =>
    createFakeMenubarItem({
      variant,
      label: i18n.t('factory.menubar.variantLabel', 'Variant: {{variant}}', { variant }),
    })
  );
}

/**
 * Creates a matrix of menubars by size
 * @returns Array of menubars, one for each size
 */
export function createFakeMenubarSizeMatrix(): FakeMenubar[] {
  return MENUBAR_SIZES.map((size) =>
    createFakeMenubar({
      size,
    })
  );
}

/**
 * Creates a matrix of item types
 * @returns Array with one of each item type
 */
export function createFakeMenubarItemTypeMatrix(): FakeMenubarAnyItem[] {
  return [
    createFakeMenubarItem({ label: i18n.t('factory.menubar.regularItem', 'Regular Item') }),
    createFakeMenubarItem({
      label: i18n.t('factory.menubar.disabledItem', 'Disabled Item'),
      disabled: true,
    }),
    createFakeMenubarItem({
      label: i18n.t('factory.menubar.withShortcut', 'With Shortcut'),
      shortcut: '⌘S',
    }),
    createFakeMenubarItem({ label: i18n.t('factory.menubar.withIcon', 'With Icon'), icon: 'File' }),
    createFakeMenubarItem({
      label: i18n.t('factory.menubar.destructive', 'Destructive'),
      variant: 'destructive',
    }),
    createFakeMenubarItem({
      label: i18n.t('factory.menubar.insetItem', 'Inset Item'),
      inset: true,
    }),
    createFakeMenubarCheckboxItem({
      label: i18n.t('factory.menubar.checkboxItem', 'Checkbox Item'),
      checked: true,
    }),
    createFakeMenubarCheckboxItem({
      label: i18n.t('factory.menubar.unchecked', 'Unchecked'),
      checked: false,
    }),
    createFakeMenubarLabelItem({ label: i18n.t('factory.menubar.labelItem', 'Label Item') }),
    createFakeMenubarSeparatorItem(),
  ];
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all menubar configurations
 * @returns Record of categorized menubar configurations
 */
export function createFakeMenubarShowcase(): Record<string, unknown> {
  return {
    // Basic elements
    menubar: createFakeMenubar(),
    menu: createFakeMenubarMenu(),
    item: createFakeMenubarItem(),
    checkboxItem: createFakeMenubarCheckboxItem(),
    radioGroup: createFakeMenubarRadioGroup(),
    labelItem: createFakeMenubarLabelItem(),
    separator: createFakeMenubarSeparatorItem(),
    shortcut: createFakeMenubarShortcut(),

    // Item variants
    itemDefault: createFakeMenubarItem({
      variant: 'default',
      label: i18n.t('factory.menubar.defaultItem', 'Default Item'),
    }),
    itemDestructive: createFakeMenubarItem({
      variant: 'destructive',
      label: i18n.t('factory.menubar.destructiveItem', 'Destructive Item'),
    }),
    itemDisabled: createFakeMenubarItem({
      disabled: true,
      label: i18n.t('factory.menubar.disabledItem', 'Disabled Item'),
    }),
    itemWithShortcut: createFakeMenubarItem({
      shortcut: '⌘S',
      label: i18n.t('factory.menubar.withShortcut', 'With Shortcut'),
    }),
    itemWithIcon: createFakeMenubarItem({
      icon: 'File',
      label: i18n.t('factory.menubar.withIcon', 'With Icon'),
    }),
    itemInset: createFakeMenubarItem({
      inset: true,
      label: i18n.t('factory.menubar.insetItem', 'Inset Item'),
    }),

    // Size variations
    menubarCompact: createFakeMenubar({ size: 'compact' }),
    menubarDefault: createFakeMenubar({ size: 'default' }),
    menubarWide: createFakeMenubar({ size: 'wide' }),

    // Checkbox variations
    checkboxChecked: createFakeMenubarCheckboxItem({
      checked: true,
      label: i18n.t('factory.menubar.checked', 'Checked'),
    }),
    checkboxUnchecked: createFakeMenubarCheckboxItem({
      checked: false,
      label: i18n.t('factory.menubar.unchecked', 'Unchecked'),
    }),
    checkboxDisabled: createFakeMenubarCheckboxItem({
      checked: false,
      disabled: true,
      label: i18n.t('factory.menubar.disabled', 'Disabled'),
    }),

    // Radio groups
    radioGroupTheme: createFakeMenubarRadioGroup(MENUBAR_THEME_OPTIONS, {
      label: i18n.t(KEY_THEME, LABEL_THEME),
    }),
    radioGroupFontSize: createFakeMenubarRadioGroup(MENUBAR_FONT_SIZE_OPTIONS, {
      label: i18n.t('factory.menubar.fontSize', 'Font Size'),
    }),
    radioGroupProfile: createFakeMenubarRadioGroup(MENUBAR_PROFILE_OPTIONS, {
      label: i18n.t('factory.menubar.profile', LABEL_PROFILE),
    }),

    // Standard menus
    fileMenu: createFakeMenubarFileMenu(),
    editMenu: createFakeMenubarEditMenu(),
    viewMenu: createFakeMenubarViewMenu(),
    helpMenu: createFakeHelpMenu(),

    // Complete menubars
    applicationMenubar: createFakeApplicationMenubar(),
    textEditorMenubar: createFakeTextEditorMenubar(),

    // Matrices
    variantMatrix: createFakeMenubarItemVariantMatrix(),
    sizeMatrix: createFakeMenubarSizeMatrix(),
    itemTypeMatrix: createFakeMenubarItemTypeMatrix(),
  };
}
