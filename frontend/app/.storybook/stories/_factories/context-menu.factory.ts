/**
 * Context Menu Factory
 *
 * Provides faker-based test data generation for ContextMenu component stories.
 * Supports various menu item types, shortcuts, submenus, and common use cases.
 *
 * ## Features
 * - Type-safe menu item generation
 * - Specialized factories for file explorer, editor, and browser contexts
 * - Action handler type definitions for MSW integration
 * - Matrix factories for visual regression testing
 *
 * @module context-menu.factory
 * @see {@link file://./../../../components/ui/context-menu.tsx}
 * @see {@link file://./../_handlers/context-menu.handlers.ts}
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Context menu item variant types
 * @description Defines the visual style of menu items
 */
export type ContextMenuItemVariant = 'default' | 'destructive';

/**
 * Context menu item types
 * @description Defines the different types of items that can appear in a context menu
 */
export type ContextMenuItemType = 'checkbox' | 'item' | 'label' | 'radio' | 'separator' | 'submenu';

/**
 * Context menu content width presets
 * @description Tailwind width classes for menu content
 */
export type ContextMenuWidth = 'w-40' | 'w-48' | 'w-52' | 'w-56' | 'w-64' | 'w-72';

/**
 * Keyboard shortcut modifier keys
 * @description Platform-specific modifier keys for shortcuts
 */
export type ShortcutModifier = 'Alt' | 'Cmd' | 'Ctrl' | 'Shift';

/**
 * Common shortcut key combinations
 * @description Unicode symbols for common shortcut displays
 */
export type ShortcutSymbol = '⇧' | '⌃' | '⌘' | '⌥' | '⌫' | '⎋' | '⏎';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base context menu item interface
 */
export interface FakeContextMenuItem {
  /** Whether item is disabled */
  disabled?: boolean;
  /** Icon name (from lucide-react) */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Whether to add left inset padding */
  inset?: boolean;
  /** Display label */
  label: string;
  /** Keyboard shortcut display string */
  shortcut?: string;
  /** Text value for typeahead search */
  textValue?: string;
  /** Item type */
  type: ContextMenuItemType;
  /** Visual variant */
  variant?: ContextMenuItemVariant;
}

/**
 * Context menu checkbox item
 */
export interface FakeContextMenuCheckboxItem extends FakeContextMenuItem {
  /** Checked state */
  checked: boolean;
  type: 'checkbox';
}

/**
 * Context menu radio item
 */
export interface FakeContextMenuRadioItem extends FakeContextMenuItem {
  type: 'radio';
  /** Radio value */
  value: string;
}

/**
 * Context menu radio group
 */
export interface FakeContextMenuRadioGroup {
  /** Group identifier */
  id: string;
  /** Available radio options */
  items: FakeContextMenuRadioItem[];
  /** Group label */
  label?: string;
  /** Currently selected value */
  selectedValue: string;
}

/**
 * Context menu submenu item
 */
export interface FakeContextMenuSubmenu {
  /** Unique identifier */
  id: string;
  /** Whether trigger has inset */
  inset?: boolean;
  /** Submenu content items */
  items: FakeContextMenuItem[];
  /** Trigger label */
  label: string;
  /** Nested submenus */
  submenus?: FakeContextMenuSubmenu[];
  /** Content width class */
  width?: ContextMenuWidth;
}

/**
 * Complete context menu configuration
 */
export interface FakeContextMenu {
  /** Checkbox items */
  checkboxItems?: FakeContextMenuCheckboxItem[];
  /** Reading direction */
  dir?: 'ltr' | 'rtl';
  /** Unique identifier */
  id: string;
  /** Menu items */
  items: FakeContextMenuItem[];
  /** Whether to enable keyboard loop navigation */
  loop?: boolean;
  /** Radio groups */
  radioGroups?: FakeContextMenuRadioGroup[];
  /** Submenus */
  submenus?: FakeContextMenuSubmenu[];
  /** Content width class */
  width?: ContextMenuWidth;
}

/**
 * File explorer context menu configuration
 */
export interface FakeFileExplorerContextMenu extends FakeContextMenu {
  /** Selected file/folder info */
  selectedItem?: {
    extension?: string;
    modifiedAt?: Date;
    name: string;
    size?: string;
    type: 'file' | 'folder';
  };
}

/**
 * IDE/Editor context menu configuration
 */
export interface FakeEditorContextMenu extends FakeContextMenu {
  /** Current cursor position */
  cursorPosition?: {
    column: number;
    line: number;
  };
  /** Whether text is selected */
  hasSelection?: boolean;
  /** Active file language */
  language?: string;
}

/**
 * Browser context menu configuration
 */
export interface FakeBrowserContextMenu extends FakeContextMenu {
  /** Whether text is selected */
  hasSelection?: boolean;
  /** Image URL if applicable */
  imageUrl?: string;
  /** Whether image is right-clicked */
  isImage?: boolean;
  /** Whether link is right-clicked */
  isLink?: boolean;
  /** Link URL if applicable */
  linkUrl?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All context menu item variants
 */
export const CONTEXT_MENU_ITEM_VARIANTS: ContextMenuItemVariant[] = ['default', 'destructive'];

/**
 * All context menu item types
 */
export const CONTEXT_MENU_ITEM_TYPES: ContextMenuItemType[] = [
  'checkbox',
  'item',
  'label',
  'radio',
  'separator',
  'submenu',
];

/**
 * Width presets for context menu content
 */
export const CONTEXT_MENU_WIDTHS: ContextMenuWidth[] = [
  'w-40',
  'w-48',
  'w-52',
  'w-56',
  'w-64',
  'w-72',
];

/**
 * Common shortcut symbols (macOS style)
 */
export const SHORTCUT_SYMBOLS: Record<string, string> = {
  cmd: '⌘',
  alt: '⌥',
  shift: '⇧',
  ctrl: '⌃',
  enter: '⏎',
  backspace: '⌫',
  escape: '⎋',
  tab: '⇥',
  delete: '⌦',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

// Shared label constants to avoid sonarjs/no-duplicate-string
const LABEL_CUT = () => i18n.t('factory.contextMenu.cut', 'Cut');
const LABEL_COPY = () => i18n.t('factory.contextMenu.copy', 'Copy');
const LABEL_PASTE = () => i18n.t('factory.contextMenu.paste', 'Paste');
const LABEL_EDIT = () => i18n.t('factory.contextMenu.edit', 'Edit');
const LABEL_DELETE = () => i18n.t('factory.contextMenu.delete', 'Delete');
const LABEL_DUPLICATE = () => i18n.t('factory.contextMenu.duplicate', 'Duplicate');
const LABEL_OPEN = () => i18n.t('factory.contextMenu.open', 'Open');
const LABEL_RENAME = () => i18n.t('factory.contextMenu.rename', 'Rename');
const LABEL_ARCHIVE = () => i18n.t('factory.contextMenu.archive', 'Archive');
const LABEL_BACK = () => i18n.t('factory.contextMenu.back', 'Back');
const LABEL_FORWARD = () => i18n.t('factory.contextMenu.forward', 'Forward');
const LABEL_RELOAD = () => i18n.t('factory.contextMenu.reload', 'Reload');
const LABEL_VIEW = () => i18n.t('factory.contextMenu.view', 'View');
const LABEL_MOVE = () => i18n.t('factory.contextMenu.move', 'Move');
const LABEL_SHARE = () => i18n.t('factory.contextMenu.share', 'Share');
const LABEL_VIEW_DETAILS = () => i18n.t('factory.contextMenu.viewDetails', 'View Details');
const LABEL_NEW_FILE = () => i18n.t('factory.contextMenu.newFile', 'New File');
const LABEL_NEW_FOLDER = () => i18n.t('factory.contextMenu.newFolder', 'New Folder');
const LABEL_MOVE_TO_TRASH = () => i18n.t('factory.contextMenu.moveToTrash', 'Move to Trash');
const LABEL_SHOW_TOOLBAR = () => i18n.t('factory.contextMenu.showToolbar', 'Show Toolbar');
const LABEL_SHOW_SIDEBAR = () => i18n.t('factory.contextMenu.showSidebar', 'Show Sidebar');
const LABEL_SHOW_STATUS_BAR = () => i18n.t('factory.contextMenu.showStatusBar', 'Show Status Bar');
const LABEL_SHOW_HIDDEN_FILES = () =>
  i18n.t('factory.contextMenu.showHiddenFiles', 'Show Hidden Files');

/**
 * Common edit actions with shortcuts
 */
export const EDIT_ACTIONS: Array<{ icon?: string; label: string; shortcut: string }> = [
  { label: i18n.t('factory.contextMenu.undo', 'Undo'), shortcut: '⌘Z', icon: 'Undo2' },
  { label: i18n.t('factory.contextMenu.redo', 'Redo'), shortcut: '⇧⌘Z', icon: 'Redo2' },
  { label: LABEL_CUT(), shortcut: '⌘X', icon: 'Scissors' },
  { label: i18n.t('factory.contextMenu.copyAction', 'Copy'), shortcut: '⌘C', icon: 'Copy' },
  { label: i18n.t('factory.contextMenu.pasteAction', 'Paste'), shortcut: '⌘V', icon: 'Clipboard' },
  {
    label: i18n.t('factory.contextMenu.selectAll', 'Select All'),
    shortcut: '⌘A',
    icon: 'CheckSquare',
  },
];

/**
 * Common file actions with shortcuts
 */
export const FILE_ACTIONS: Array<{ icon?: string; label: string; shortcut?: string }> = [
  { label: LABEL_NEW_FILE(), shortcut: '⌘N', icon: 'FilePlus' },
  { label: LABEL_NEW_FOLDER(), shortcut: '⇧⌘N', icon: 'FolderPlus' },
  { label: i18n.t('factory.contextMenu.openFile', 'Open'), shortcut: '⌘O', icon: 'FolderOpen' },
  { label: i18n.t('factory.contextMenu.save', 'Save'), shortcut: '⌘S', icon: 'Save' },
  { label: i18n.t('factory.contextMenu.saveAs', 'Save As...'), shortcut: '⇧⌘S', icon: 'SaveAll' },
  { label: i18n.t('factory.contextMenu.renameFile', 'Rename'), shortcut: '⏎', icon: 'PenLine' },
  { label: LABEL_MOVE_TO_TRASH(), icon: 'Trash2' },
];

/**
 * Common view options
 */
export const VIEW_OPTIONS: Array<{ label: string; value: string }> = [
  { label: i18n.t('factory.contextMenu.list', 'List'), value: 'list' },
  { label: i18n.t('factory.contextMenu.grid', 'Grid'), value: 'grid' },
  { label: i18n.t('factory.contextMenu.columns', 'Columns'), value: 'columns' },
  { label: i18n.t('factory.contextMenu.gallery', 'Gallery'), value: 'gallery' },
];

/**
 * Sort options
 */
export const SORT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: i18n.t('factory.contextMenu.name', 'Name'), value: 'name' },
  { label: i18n.t('factory.contextMenu.dateModified', 'Date Modified'), value: 'modified' },
  { label: i18n.t('factory.contextMenu.dateCreated', 'Date Created'), value: 'created' },
  { label: i18n.t('factory.contextMenu.size', 'Size'), value: 'size' },
  { label: i18n.t('factory.contextMenu.kind', 'Kind'), value: 'kind' },
];

/**
 * Theme options
 */
export const THEME_OPTIONS: Array<{ label: string; value: string }> = [
  { label: i18n.t('factory.contextMenu.light', 'Light'), value: 'light' },
  { label: i18n.t('factory.contextMenu.dark', 'Dark'), value: 'dark' },
  { label: i18n.t('factory.contextMenu.system', 'System'), value: 'system' },
];

/**
 * Common action labels
 */
export const COMMON_LABELS = [
  LABEL_OPEN(),
  LABEL_EDIT(),
  LABEL_DELETE(),
  LABEL_RENAME(),
  LABEL_COPY(),
  LABEL_CUT(),
  LABEL_PASTE(),
  LABEL_DUPLICATE(),
  LABEL_SHARE(),
  i18n.t('factory.contextMenu.download', 'Download'),
  LABEL_MOVE(),
  LABEL_ARCHIVE(),
  i18n.t('factory.contextMenu.pin', 'Pin'),
  i18n.t('factory.contextMenu.favorite', 'Favorite'),
  i18n.t('factory.contextMenu.hide', 'Hide'),
  i18n.t('factory.contextMenu.lock', 'Lock'),
  i18n.t('factory.contextMenu.unlock', 'Unlock'),
  i18n.t('factory.contextMenu.refresh', 'Refresh'),
  i18n.t('factory.contextMenu.sync', 'Sync'),
  i18n.t('factory.contextMenu.export', 'Export'),
] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generates a random keyboard shortcut string
 */
function generateShortcut(): string {
  const modifiers = [
    SHORTCUT_SYMBOLS.cmd,
    `${SHORTCUT_SYMBOLS.shift}${SHORTCUT_SYMBOLS.cmd}`,
    `${SHORTCUT_SYMBOLS.alt}${SHORTCUT_SYMBOLS.cmd}`,
    SHORTCUT_SYMBOLS.ctrl,
  ];
  const keys = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'];

  const modifier = faker.helpers.arrayElement(modifiers);
  const key = faker.helpers.arrayElement(keys);

  return `${modifier}${key}`;
}

/**
 * Generates a consistent ID from a label
 */
function labelToId(label: string): string {
  return label
    .toLowerCase()
    .replaceAll(/\s+/g, '-')
    .replaceAll(/[^a-z0-9-]/g, '');
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a single fake context menu item
 */
export function createFakeContextMenuItem(
  overrides?: Partial<FakeContextMenuItem>
): FakeContextMenuItem {
  const label = faker.helpers.arrayElement(COMMON_LABELS);
  const hasShortcut = faker.helpers.maybe(() => true, { probability: 0.4 });
  const isDisabled = faker.helpers.maybe(() => true, { probability: 0.1 });
  const isDestructive =
    label === LABEL_DELETE() || faker.helpers.maybe(() => true, { probability: 0.05 });

  return {
    id: faker.string.uuid(),
    label,
    type: 'item',
    disabled: isDisabled,
    variant: isDestructive ? 'destructive' : 'default',
    shortcut: hasShortcut ? generateShortcut() : undefined,
    inset: faker.helpers.maybe(() => true, { probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Creates a fake checkbox menu item
 */
export function createFakeContextMenuCheckboxItem(
  overrides?: Partial<FakeContextMenuCheckboxItem>
): FakeContextMenuCheckboxItem {
  const labels = [
    LABEL_SHOW_TOOLBAR(),
    LABEL_SHOW_SIDEBAR(),
    LABEL_SHOW_STATUS_BAR(),
    i18n.t('factory.contextMenu.showLineNumbers', 'Show Line Numbers'),
    i18n.t('factory.contextMenu.wordWrap', 'Word Wrap'),
    i18n.t('factory.contextMenu.autoSave', 'Auto Save'),
    i18n.t('factory.contextMenu.spellCheck', 'Spell Check'),
    i18n.t('factory.contextMenu.showHiddenFiles', 'Show Hidden Files'),
    i18n.t('factory.contextMenu.bookmarked', 'Bookmarked'),
    i18n.t('factory.contextMenu.pinned', 'Pinned'),
  ];

  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(labels),
    type: 'checkbox',
    checked: faker.datatype.boolean(),
    disabled: faker.helpers.maybe(() => true, { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake radio menu item
 */
export function createFakeContextMenuRadioItem(
  value: string,
  label: string,
  overrides?: Partial<FakeContextMenuRadioItem>
): FakeContextMenuRadioItem {
  return {
    id: faker.string.uuid(),
    label,
    type: 'radio',
    value,
    disabled: faker.helpers.maybe(() => true, { probability: 0.05 }),
    ...overrides,
  };
}

/**
 * Creates a fake radio group
 */
export function createFakeContextMenuRadioGroup(
  options: Array<{ label: string; value: string }>,
  label?: string,
  overrides?: Partial<FakeContextMenuRadioGroup>
): FakeContextMenuRadioGroup {
  const items = options.map((opt) => createFakeContextMenuRadioItem(opt.value, opt.label));
  const selectedValue = faker.helpers.arrayElement(options).value;

  return {
    id: faker.string.uuid(),
    label,
    items,
    selectedValue,
    ...overrides,
  };
}

/**
 * Creates a fake submenu
 */
export function createFakeContextMenuSubmenu(
  label: string,
  itemCount: number = 3,
  overrides?: Partial<FakeContextMenuSubmenu>
): FakeContextMenuSubmenu {
  return {
    id: faker.string.uuid(),
    label,
    items: createFakeContextMenuItems(itemCount),
    width: faker.helpers.arrayElement(CONTEXT_MENU_WIDTHS),
    inset: faker.helpers.maybe(() => true, { probability: 0.3 }),
    ...overrides,
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple fake context menu items
 */
export function createFakeContextMenuItems(count: number): FakeContextMenuItem[] {
  return Array.from({ length: count }, () => createFakeContextMenuItem());
}

/**
 * Creates a complete fake context menu configuration
 */
export function createFakeContextMenu(overrides?: Partial<FakeContextMenu>): FakeContextMenu {
  const itemCount = faker.number.int({ min: 3, max: 8 });
  const hasCheckboxes = faker.helpers.maybe(() => true, { probability: 0.5 });
  const hasRadioGroup = faker.helpers.maybe(() => true, { probability: 0.4 });
  const hasSubmenu = faker.helpers.maybe(() => true, { probability: 0.5 });

  return {
    id: faker.string.uuid(),
    items: createFakeContextMenuItems(itemCount),
    checkboxItems: hasCheckboxes
      ? Array.from({ length: faker.number.int({ min: 2, max: 4 }) }, () =>
          createFakeContextMenuCheckboxItem()
        )
      : undefined,
    radioGroups: hasRadioGroup
      ? [
          createFakeContextMenuRadioGroup(
            THEME_OPTIONS,
            i18n.t('factory.contextMenu.theme', 'Theme')
          ),
        ]
      : undefined,
    submenus: hasSubmenu
      ? [createFakeContextMenuSubmenu(i18n.t('factory.contextMenu.moreOptions', 'More Options'))]
      : undefined,
    width: faker.helpers.arrayElement(CONTEXT_MENU_WIDTHS),
    loop: faker.datatype.boolean(),
    ...overrides,
  };
}

/**
 * Creates multiple complete context menu configurations
 */
export function createFakeContextMenus(count: number): FakeContextMenu[] {
  return Array.from({ length: count }, () => createFakeContextMenu());
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a file explorer context menu
 */
export function createFakeFileExplorerContextMenu(
  fileType: 'file' | 'folder' = 'file',
  overrides?: Partial<FakeFileExplorerContextMenu>
): FakeFileExplorerContextMenu {
  const isFolder = fileType === 'folder';
  const fileName = isFolder
    ? faker.system.directoryPath().split('/').pop() || 'folder'
    : faker.system.fileName();

  const fileExtension = isFolder ? undefined : fileName.split('.').pop();

  const items: FakeContextMenuItem[] = [
    { id: 'open', label: LABEL_OPEN(), type: 'item', shortcut: '⌘O' },
    ...(isFolder
      ? [
          {
            id: 'open-new-window',
            label: i18n.t('factory.contextMenu.openInNewWindow', 'Open in New Window'),
            type: 'item' as const,
          },
        ]
      : []),
    { id: 'sep-1', label: '', type: 'separator' },
    { id: 'cut', label: LABEL_CUT(), type: 'item', shortcut: '⌘X' },
    { id: 'copy', label: LABEL_COPY(), type: 'item', shortcut: '⌘C' },
    { id: 'duplicate', label: LABEL_DUPLICATE(), type: 'item', shortcut: '⌘D' },
    { id: 'sep-2', label: '', type: 'separator' },
    { id: 'rename', label: LABEL_RENAME(), type: 'item', shortcut: '⏎' },
    { id: 'move-to-trash', label: LABEL_MOVE_TO_TRASH(), type: 'item', variant: 'destructive' },
  ];

  return {
    id: faker.string.uuid(),
    items,
    width: 'w-56',
    selectedItem: {
      name: fileName,
      type: fileType,
      extension: fileExtension,
      size: faker.helpers.arrayElement(['1.2 KB', '45.8 KB', '2.3 MB', '156 MB']),
      modifiedAt: faker.date.recent(),
    },
    submenus: [
      {
        id: 'share-submenu',
        label: LABEL_SHARE(),
        items: [
          {
            id: 'share-email',
            label: i18n.t('factory.contextMenu.email', 'Email'),
            type: 'item',
            icon: 'Mail',
          },
          {
            id: 'share-airdrop',
            label: i18n.t('factory.contextMenu.airDrop', 'AirDrop'),
            type: 'item',
            icon: 'Wifi',
          },
          {
            id: 'share-messages',
            label: i18n.t('factory.contextMenu.messages', 'Messages'),
            type: 'item',
            icon: 'MessageSquare',
          },
        ],
        width: 'w-48',
      },
    ],
    ...overrides,
  };
}

/**
 * Creates an IDE/editor context menu
 */
export function createFakeEditorContextMenu(
  hasSelection: boolean = false,
  overrides?: Partial<FakeEditorContextMenu>
): FakeEditorContextMenu {
  const items: FakeContextMenuItem[] = [
    ...(hasSelection
      ? [
          {
            id: 'cut',
            label: LABEL_CUT(),
            type: 'item' as const,
            shortcut: '⌘X',
            icon: 'Scissors',
          },
          { id: 'copy', label: LABEL_COPY(), type: 'item' as const, shortcut: '⌘C', icon: 'Copy' },
        ]
      : []),
    { id: 'paste', label: LABEL_PASTE(), type: 'item', shortcut: '⌘V', icon: 'Clipboard' },
    { id: 'sep-1', label: '', type: 'separator' },
    {
      id: 'go-to-definition',
      label: i18n.t('factory.contextMenu.goToDefinition', 'Go to Definition'),
      type: 'item',
      shortcut: 'F12',
    },
    {
      id: 'go-to-references',
      label: i18n.t('factory.contextMenu.goToReferences', 'Go to References'),
      type: 'item',
      shortcut: '⇧F12',
    },
    {
      id: 'peek-definition',
      label: i18n.t('factory.contextMenu.peekDefinition', 'Peek Definition'),
      type: 'item',
      shortcut: '⌥F12',
    },
    { id: 'sep-2', label: '', type: 'separator' },
    {
      id: 'rename-symbol',
      label: i18n.t('factory.contextMenu.renameSymbol', 'Rename Symbol'),
      type: 'item',
      shortcut: 'F2',
    },
    {
      id: 'format-document',
      label: i18n.t('factory.contextMenu.formatDocument', 'Format Document'),
      type: 'item',
      shortcut: '⇧⌥F',
    },
  ];

  return {
    id: faker.string.uuid(),
    items,
    width: 'w-64',
    hasSelection,
    cursorPosition: {
      line: faker.number.int({ min: 1, max: 500 }),
      column: faker.number.int({ min: 1, max: 120 }),
    },
    language: faker.helpers.arrayElement(['typescript', 'javascript', 'python', 'rust', 'go']),
    submenus: [
      {
        id: 'refactor-submenu',
        label: i18n.t('factory.contextMenu.refactor', 'Refactor'),
        items: [
          {
            id: 'extract-variable',
            label: i18n.t('factory.contextMenu.extractVariable', 'Extract Variable'),
            type: 'item',
          },
          {
            id: 'extract-function',
            label: i18n.t('factory.contextMenu.extractFunction', 'Extract Function'),
            type: 'item',
          },
          {
            id: 'extract-component',
            label: i18n.t('factory.contextMenu.extractComponent', 'Extract Component'),
            type: 'item',
          },
          {
            id: 'inline-variable',
            label: i18n.t('factory.contextMenu.inlineVariable', 'Inline Variable'),
            type: 'item',
          },
        ],
        width: 'w-52',
      },
      {
        id: 'source-action-submenu',
        label: i18n.t('factory.contextMenu.sourceAction', 'Source Action'),
        items: [
          {
            id: 'organize-imports',
            label: i18n.t('factory.contextMenu.organizeImports', 'Organize Imports'),
            type: 'item',
            shortcut: '⇧⌥O',
          },
          {
            id: 'add-missing-imports',
            label: i18n.t('factory.contextMenu.addMissingImports', 'Add Missing Imports'),
            type: 'item',
          },
          { id: 'fix-all', label: i18n.t('factory.contextMenu.fixAll', 'Fix All'), type: 'item' },
        ],
        width: 'w-52',
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a browser context menu
 */
export function createFakeBrowserContextMenu(
  context: 'image' | 'link' | 'page' | 'selection' = 'page',
  overrides?: Partial<FakeBrowserContextMenu>
): FakeBrowserContextMenu {
  const baseItems: FakeContextMenuItem[] = [
    { id: 'back', label: LABEL_BACK(), type: 'item', shortcut: '⌥←', disabled: false },
    { id: 'forward', label: LABEL_FORWARD(), type: 'item', shortcut: '⌥→', disabled: true },
    { id: 'reload', label: LABEL_RELOAD(), type: 'item', shortcut: '⌘R' },
    { id: 'sep-1', label: '', type: 'separator' },
  ];

  const selectionItems: FakeContextMenuItem[] =
    context === 'selection'
      ? [
          { id: 'copy', label: LABEL_COPY(), type: 'item', shortcut: '⌘C' },
          {
            id: 'search',
            label: i18n.t('factory.contextMenu.searchWithGoogle', 'Search with Google'),
            type: 'item',
          },
          { id: 'sep-sel', label: '', type: 'separator' },
        ]
      : [];

  const linkItems: FakeContextMenuItem[] =
    context === 'link'
      ? [
          {
            id: 'open-link',
            label: i18n.t('factory.contextMenu.openLink', 'Open Link'),
            type: 'item',
          },
          {
            id: 'open-link-new-tab',
            label: i18n.t('factory.contextMenu.openLinkInNewTab', 'Open Link in New Tab'),
            type: 'item',
          },
          {
            id: 'copy-link',
            label: i18n.t('factory.contextMenu.copyLinkAddress', 'Copy Link Address'),
            type: 'item',
          },
          { id: 'sep-link', label: '', type: 'separator' },
        ]
      : [];

  const imageItems: FakeContextMenuItem[] =
    context === 'image'
      ? [
          {
            id: 'open-image',
            label: i18n.t('factory.contextMenu.openImageInNewTab', 'Open Image in New Tab'),
            type: 'item',
          },
          {
            id: 'save-image',
            label: i18n.t('factory.contextMenu.saveImageAs', 'Save Image As...'),
            type: 'item',
          },
          {
            id: 'copy-image',
            label: i18n.t('factory.contextMenu.copyImage', 'Copy Image'),
            type: 'item',
          },
          {
            id: 'copy-image-address',
            label: i18n.t('factory.contextMenu.copyImageAddress', 'Copy Image Address'),
            type: 'item',
          },
          { id: 'sep-img', label: '', type: 'separator' },
        ]
      : [];

  const commonItems: FakeContextMenuItem[] = [
    {
      id: 'save-page',
      label: i18n.t('factory.contextMenu.savePageAs', 'Save Page As...'),
      type: 'item',
      shortcut: '⌘S',
    },
    {
      id: 'print',
      label: i18n.t('factory.contextMenu.print', 'Print...'),
      type: 'item',
      shortcut: '⌘P',
    },
    { id: 'sep-2', label: '', type: 'separator' },
    {
      id: 'view-source',
      label: i18n.t('factory.contextMenu.viewPageSource', 'View Page Source'),
      type: 'item',
      shortcut: '⌥⌘U',
    },
    {
      id: 'inspect',
      label: i18n.t('factory.contextMenu.inspect', 'Inspect'),
      type: 'item',
      shortcut: '⌥⌘I',
    },
  ];

  return {
    id: faker.string.uuid(),
    items: [...baseItems, ...selectionItems, ...linkItems, ...imageItems, ...commonItems],
    width: 'w-64',
    isLink: context === 'link',
    isImage: context === 'image',
    hasSelection: context === 'selection',
    linkUrl: context === 'link' ? faker.internet.url() : undefined,
    imageUrl: context === 'image' ? faker.image.url() : undefined,
    ...overrides,
  };
}

/**
 * Creates a table row context menu
 */
export function createFakeTableRowContextMenu(): FakeContextMenu {
  return {
    id: faker.string.uuid(),
    items: [
      { id: 'view', label: LABEL_VIEW_DETAILS(), type: 'item', icon: 'Eye' },
      { id: 'edit', label: LABEL_EDIT(), type: 'item', shortcut: '⌘E', icon: 'Pencil' },
      { id: 'sep-1', label: '', type: 'separator' },
      {
        id: 'duplicate',
        label: i18n.t('factory.contextMenu.duplicateRow', 'Duplicate Row'),
        type: 'item',
        icon: 'Copy',
      },
      {
        id: 'copy-id',
        label: i18n.t('factory.contextMenu.copyId', 'Copy ID'),
        type: 'item',
        icon: 'Hash',
      },
      { id: 'sep-2', label: '', type: 'separator' },
      { id: 'delete', label: LABEL_DELETE(), type: 'item', variant: 'destructive', icon: 'Trash2' },
    ],
    width: 'w-48',
  };
}

/**
 * Creates a kanban card context menu
 */
export function createFakeKanbanCardContextMenu(): FakeContextMenu {
  return {
    id: faker.string.uuid(),
    items: [
      {
        id: 'open',
        label: i18n.t('factory.contextMenu.openCard', 'Open Card'),
        type: 'item',
        shortcut: '⏎',
      },
      { id: 'sep-1', label: '', type: 'separator' },
      {
        id: 'edit-labels',
        label: i18n.t('factory.contextMenu.editLabels', 'Edit Labels'),
        type: 'item',
        icon: 'Tag',
      },
      {
        id: 'change-members',
        label: i18n.t('factory.contextMenu.changeMembers', 'Change Members'),
        type: 'item',
        icon: 'Users',
      },
      {
        id: 'set-due-date',
        label: i18n.t('factory.contextMenu.setDueDate', 'Set Due Date'),
        type: 'item',
        icon: 'Calendar',
      },
      { id: 'sep-2', label: '', type: 'separator' },
      { id: 'move', label: LABEL_MOVE(), type: 'item', icon: 'MoveRight' },
      { id: 'copy', label: LABEL_COPY(), type: 'item', icon: 'Copy' },
      { id: 'sep-3', label: '', type: 'separator' },
      { id: 'archive', label: LABEL_ARCHIVE(), type: 'item', icon: 'Archive' },
    ],
    submenus: [
      {
        id: 'move-to-submenu',
        label: i18n.t('factory.contextMenu.moveToList', 'Move to List'),
        items: [
          {
            id: 'move-backlog',
            label: i18n.t('factory.contextMenu.backlog', 'Backlog'),
            type: 'item',
          },
          { id: 'move-todo', label: i18n.t('factory.contextMenu.toDo', 'To Do'), type: 'item' },
          {
            id: 'move-in-progress',
            label: i18n.t('factory.contextMenu.inProgress', 'In Progress'),
            type: 'item',
          },
          { id: 'move-done', label: i18n.t('factory.contextMenu.done', 'Done'), type: 'item' },
        ],
        width: 'w-40',
      },
    ],
    width: 'w-52',
  };
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of context menus for visual testing
 */
export function createFakeContextMenuMatrix(): Record<string, FakeContextMenu> {
  return {
    basic: {
      id: 'basic-menu',
      items: EDIT_ACTIONS.slice(0, 4).map((action) => ({
        id: labelToId(action.label),
        label: action.label,
        type: 'item' as const,
        shortcut: action.shortcut,
        icon: action.icon,
      })),
      width: 'w-48',
    },
    withSeparators: {
      id: 'separator-menu',
      items: [
        { id: 'cut', label: LABEL_CUT(), type: 'item', shortcut: '⌘X' },
        { id: 'copy', label: LABEL_COPY(), type: 'item', shortcut: '⌘C' },
        { id: 'paste', label: LABEL_PASTE(), type: 'item', shortcut: '⌘V' },
        { id: 'sep-1', label: '', type: 'separator' },
        { id: 'delete', label: LABEL_DELETE(), type: 'item', variant: 'destructive' },
      ],
      width: 'w-48',
    },
    withInset: {
      id: 'inset-menu',
      items: [
        { id: 'back', label: LABEL_BACK(), type: 'item', shortcut: '⌥←', inset: true },
        {
          id: 'forward',
          label: LABEL_FORWARD(),
          type: 'item',
          shortcut: '⌥→',
          inset: true,
          disabled: true,
        },
        { id: 'reload', label: LABEL_RELOAD(), type: 'item', shortcut: '⌘R', inset: true },
      ],
      width: 'w-56',
    },
    withCheckboxes: {
      id: 'checkbox-menu',
      items: [],
      checkboxItems: [
        { id: 'toolbar', label: LABEL_SHOW_TOOLBAR(), type: 'checkbox', checked: true },
        { id: 'sidebar', label: LABEL_SHOW_SIDEBAR(), type: 'checkbox', checked: false },
        { id: 'statusbar', label: LABEL_SHOW_STATUS_BAR(), type: 'checkbox', checked: true },
      ],
      width: 'w-52',
    },
    withRadioGroup: {
      id: 'radio-menu',
      items: [],
      radioGroups: [
        {
          id: 'view-group',
          label: LABEL_VIEW(),
          items: VIEW_OPTIONS.map((opt) => ({
            id: labelToId(opt.label),
            label: opt.label,
            type: 'radio' as const,
            value: opt.value,
          })),
          selectedValue: 'list',
        },
      ],
      width: 'w-48',
    },
    withSubmenu: {
      id: 'submenu-menu',
      items: [
        {
          id: 'new',
          label: i18n.t('factory.contextMenu.new', 'New'),
          type: 'item',
          shortcut: '⌘N',
        },
        { id: 'open', label: LABEL_OPEN(), type: 'item', shortcut: '⌘O' },
      ],
      submenus: [
        {
          id: 'recent-submenu',
          label: i18n.t('factory.contextMenu.openRecent', 'Open Recent'),
          items: [
            {
              id: 'file-1',
              label: i18n.t('factory.contextMenu.documentFile', 'document.txt'),
              type: 'item',
            },
            {
              id: 'file-2',
              label: i18n.t('factory.contextMenu.imageFile', 'image.png'),
              type: 'item',
            },
            {
              id: 'file-3',
              label: i18n.t('factory.contextMenu.videoFile', 'video.mp4'),
              type: 'item',
            },
          ],
          width: 'w-48',
        },
      ],
      width: 'w-48',
    },
    complex: {
      id: 'complex-menu',
      items: [
        { id: 'new-file', label: LABEL_NEW_FILE(), type: 'item', shortcut: '⌘N', inset: true },
        { id: 'new-folder', label: LABEL_NEW_FOLDER(), type: 'item', shortcut: '⇧⌘N', inset: true },
        { id: 'sep-1', label: '', type: 'separator' },
      ],
      checkboxItems: [
        { id: 'hidden', label: LABEL_SHOW_HIDDEN_FILES(), type: 'checkbox', checked: false },
      ],
      radioGroups: [
        {
          id: 'sort-group',
          label: i18n.t('factory.contextMenu.sortBy', 'Sort By'),
          items: SORT_OPTIONS.slice(0, 3).map((opt) => ({
            id: labelToId(opt.label),
            label: opt.label,
            type: 'radio' as const,
            value: opt.value,
          })),
          selectedValue: 'name',
        },
      ],
      submenus: [
        {
          id: 'view-submenu',
          label: LABEL_VIEW(),
          inset: true,
          items: VIEW_OPTIONS.map((opt) => ({
            id: labelToId(opt.label),
            label: opt.label,
            type: 'item' as const,
          })),
          width: 'w-40',
        },
      ],
      width: 'w-56',
    },
  };
}

/**
 * Creates a showcase of all context menu use cases
 */
export function createFakeContextMenuShowcase(): Record<string, FakeContextMenu> {
  return {
    fileExplorer: createFakeFileExplorerContextMenu('file'),
    folderExplorer: createFakeFileExplorerContextMenu('folder'),
    editorNoSelection: createFakeEditorContextMenu(false),
    editorWithSelection: createFakeEditorContextMenu(true),
    browserPage: createFakeBrowserContextMenu('page'),
    browserLink: createFakeBrowserContextMenu('link'),
    browserImage: createFakeBrowserContextMenu('image'),
    browserSelection: createFakeBrowserContextMenu('selection'),
    tableRow: createFakeTableRowContextMenu(),
    kanbanCard: createFakeKanbanCardContextMenu(),
  };
}

// ============================================================================
// ACTION HANDLER TYPE DEFINITIONS (for MSW integration)
// ============================================================================

/**
 * Context menu action event type
 * @description Used for tracking and analytics integration
 */
export type ContextMenuActionEvent =
  | 'archive'
  | 'bookmark'
  | 'copy'
  | 'custom'
  | 'cut'
  | 'delete'
  | 'download'
  | 'duplicate'
  | 'edit'
  | 'move'
  | 'open'
  | 'paste'
  | 'pin'
  | 'preview'
  | 'rename'
  | 'share';

/**
 * Action request payload for API handlers
 */
export interface ContextMenuActionPayload {
  /** Action identifier */
  action: ContextMenuActionEvent;
  /** Mouse coordinates where menu was opened */
  coordinates?: { x: number; y: number };
  /** Additional action-specific data */
  data?: Record<string, unknown>;
  /** Source context (e.g., 'file-explorer', 'editor', 'table') */
  source?: string;
  /** Target element/resource ID */
  targetId: string;
  /** Timestamp of action */
  timestamp?: number;
}

/**
 * Action response from API handlers
 */
export interface ContextMenuActionResponse {
  /** Action that was performed */
  action: ContextMenuActionEvent;
  /** Additional response data */
  data?: Record<string, unknown>;
  /** Error details if failed */
  error?: {
    code: string;
    details?: Record<string, unknown>;
    message: string;
  };
  /** Human-readable message */
  message?: string;
  /** Whether action succeeded */
  success: boolean;
  /** Affected resource ID */
  targetId?: string;
  /** Whether undo is available */
  undoAvailable?: boolean;
  /** Undo expiration timestamp */
  undoExpiresAt?: string;
}

/**
 * Creates a fake action payload for testing
 */
export function createFakeActionPayload(
  action: ContextMenuActionEvent = 'copy',
  overrides?: Partial<ContextMenuActionPayload>
): ContextMenuActionPayload {
  return {
    action,
    targetId: faker.string.uuid(),
    timestamp: Date.now(),
    source: faker.helpers.arrayElement(['file-explorer', 'editor', 'table', 'kanban', 'browser']),
    coordinates: {
      x: faker.number.int({ min: 0, max: 1920 }),
      y: faker.number.int({ min: 0, max: 1080 }),
    },
    ...overrides,
  };
}

/**
 * Creates a fake success response
 */
export function createFakeActionResponse(
  action: ContextMenuActionEvent,
  success = true,
  overrides?: Partial<ContextMenuActionResponse>
): ContextMenuActionResponse {
  return {
    success,
    action,
    targetId: faker.string.uuid(),
    message: success
      ? i18n.t(
          'factory.contextMenu.actionCompletedSuccessfully',
          '{{action}} completed successfully',
          { action: action.charAt(0).toUpperCase() + action.slice(1) }
        )
      : i18n.t('factory.contextMenu.failedToAction', 'Failed to {{action}}', { action }),
    undoAvailable: success && ['delete', 'move', 'archive'].includes(action),
    undoExpiresAt: success ? new Date(Date.now() + 30_000).toISOString() : undefined,
    ...overrides,
  };
}

// ============================================================================
// ENTERPRISE FEATURE FACTORIES
// ============================================================================

/**
 * Context menu with tracking/analytics data
 */
export interface FakeTrackedContextMenu extends FakeContextMenu {
  /** Custom tracking data */
  trackingData?: Record<string, unknown>;
  /** Analytics tracking ID */
  trackingId?: string;
}

/**
 * Creates a context menu with analytics tracking
 */
export function createFakeTrackedContextMenu(
  overrides?: Partial<FakeTrackedContextMenu>
): FakeTrackedContextMenu {
  const baseMenu = createFakeContextMenu();
  return {
    ...baseMenu,
    trackingId: `ctx-menu-${faker.string.alphanumeric(8)}`,
    trackingData: {
      source: faker.helpers.arrayElement(['header', 'sidebar', 'main-content', 'footer']),
      userSegment: faker.helpers.arrayElement(['free', 'pro', 'enterprise']),
      sessionId: faker.string.uuid(),
    },
    ...overrides,
  };
}

/**
 * Creates a context menu with undo support for delete actions
 */
export function createFakeUndoableContextMenu(): FakeContextMenu {
  return {
    id: faker.string.uuid(),
    items: [
      { id: 'edit', label: LABEL_EDIT(), type: 'item', icon: 'Pencil' },
      { id: 'duplicate', label: LABEL_DUPLICATE(), type: 'item', icon: 'Copy' },
      { id: 'sep-1', label: '', type: 'separator' },
      {
        id: 'delete',
        label: i18n.t('factory.contextMenu.deleteUndoable', 'Delete (Undoable)'),
        type: 'item',
        variant: 'destructive',
        icon: 'Trash2',
        shortcut: '⌫',
      },
    ],
    width: 'w-52',
  };
}

/**
 * Creates a context menu with confirmation for destructive actions
 */
export function createFakeConfirmationContextMenu(): FakeContextMenu {
  return {
    id: faker.string.uuid(),
    items: [
      { id: 'view', label: LABEL_VIEW_DETAILS(), type: 'item', icon: 'Eye' },
      { id: 'edit', label: LABEL_EDIT(), type: 'item', icon: 'Pencil' },
      { id: 'sep-1', label: '', type: 'separator' },
      {
        id: 'archive',
        label: LABEL_ARCHIVE(),
        type: 'item',
        icon: 'Archive',
      },
      {
        id: 'delete-confirm',
        label: i18n.t(
          'factory.contextMenu.deleteRequiresConfirmation',
          'Delete (Requires Confirmation)'
        ),
        type: 'item',
        variant: 'destructive',
        icon: 'AlertTriangle',
      },
    ],
    width: 'w-64',
  };
}

/**
 * Creates a batch action context menu for multi-select scenarios
 */
export function createFakeBatchActionContextMenu(selectedCount = 3): FakeContextMenu {
  return {
    id: faker.string.uuid(),
    items: [
      {
        id: 'batch-move',
        label: i18n.t('factory.contextMenu.moveItems', 'Move {{count}} items...', {
          count: selectedCount,
        }),
        type: 'item',
        icon: 'FolderInput',
      },
      {
        id: 'batch-copy',
        label: i18n.t('factory.contextMenu.copyItems', 'Copy {{count}} items', {
          count: selectedCount,
        }),
        type: 'item',
        icon: 'Copy',
      },
      {
        id: 'batch-download',
        label: i18n.t('factory.contextMenu.downloadItems', 'Download {{count}} items', {
          count: selectedCount,
        }),
        type: 'item',
        icon: 'Download',
      },
      { id: 'sep-1', label: '', type: 'separator' },
      {
        id: 'batch-archive',
        label: i18n.t('factory.contextMenu.archiveItems', 'Archive {{count}} items', {
          count: selectedCount,
        }),
        type: 'item',
        icon: 'Archive',
      },
      {
        id: 'batch-delete',
        label: i18n.t('factory.contextMenu.deleteItems', 'Delete {{count}} items', {
          count: selectedCount,
        }),
        type: 'item',
        variant: 'destructive',
        icon: 'Trash2',
      },
    ],
    width: 'w-56',
  };
}

// ============================================================================
// ACCESSIBILITY TESTING FACTORIES
// ============================================================================

/**
 * Creates a context menu specifically for accessibility testing
 * with all ARIA-relevant item types
 */
export function createFakeA11yTestContextMenu(): FakeContextMenu {
  return {
    id: 'a11y-test-menu',
    items: [
      // Standard menu items (role="menuitem")
      { id: 'item-1', label: i18n.t('factory.contextMenu.menuItem1', 'Menu Item 1'), type: 'item' },
      {
        id: 'item-2',
        label: i18n.t('factory.contextMenu.menuItem2Disabled', 'Menu Item 2 (disabled)'),
        type: 'item',
        disabled: true,
      },
      {
        id: 'item-3',
        label: i18n.t('factory.contextMenu.destructiveItem', 'Destructive Item'),
        type: 'item',
        variant: 'destructive',
      },
      { id: 'sep-1', label: '', type: 'separator' },
    ],
    checkboxItems: [
      // Checkbox items (role="menuitemcheckbox")
      {
        id: 'check-1',
        label: i18n.t('factory.contextMenu.checkboxChecked', 'Checkbox Checked'),
        type: 'checkbox',
        checked: true,
      },
      {
        id: 'check-2',
        label: i18n.t('factory.contextMenu.checkboxUnchecked', 'Checkbox Unchecked'),
        type: 'checkbox',
        checked: false,
      },
      {
        id: 'check-3',
        label: i18n.t('factory.contextMenu.checkboxDisabled', 'Checkbox Disabled'),
        type: 'checkbox',
        checked: false,
        disabled: true,
      },
    ],
    radioGroups: [
      // Radio items (role="menuitemradio")
      {
        id: 'radio-group',
        label: i18n.t('factory.contextMenu.radioGroup', 'Radio Group'),
        items: [
          {
            id: 'radio-1',
            label: i18n.t('factory.contextMenu.radioOption1', 'Radio Option 1'),
            type: 'radio',
            value: 'opt1',
          },
          {
            id: 'radio-2',
            label: i18n.t('factory.contextMenu.radioOption2', 'Radio Option 2'),
            type: 'radio',
            value: 'opt2',
          },
          {
            id: 'radio-3',
            label: i18n.t('factory.contextMenu.radioDisabled', 'Radio Disabled'),
            type: 'radio',
            value: 'opt3',
            disabled: true,
          },
        ],
        selectedValue: 'opt1',
      },
    ],
    submenus: [
      // Submenu (nested role="menu")
      {
        id: 'submenu',
        label: i18n.t('factory.contextMenu.submenuTrigger', 'Submenu Trigger'),
        items: [
          {
            id: 'sub-1',
            label: i18n.t('factory.contextMenu.submenuItem1', 'Submenu Item 1'),
            type: 'item',
          },
          {
            id: 'sub-2',
            label: i18n.t('factory.contextMenu.submenuItem2', 'Submenu Item 2'),
            type: 'item',
          },
        ],
        width: 'w-48',
      },
    ],
    width: 'w-56',
    loop: true,
  };
}
