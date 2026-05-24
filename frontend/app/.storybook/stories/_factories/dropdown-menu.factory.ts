import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/** Dropdown menu item type */
export type DropdownMenuItemType = 'checkbox' | 'item' | 'radio' | 'separator' | 'sub';

/** Dropdown menu side for positioning */
export type DropdownMenuSide = 'bottom' | 'left' | 'right' | 'top';

/** Dropdown menu alignment */
export type DropdownMenuAlign = 'center' | 'end' | 'start';

// ═══════════════════════════════════════════════════════════════
// INTERFACE (Shape of Generated Data)
// ═══════════════════════════════════════════════════════════════

/** Dropdown menu item shortcut */
export interface DropdownMenuShortcut {
  key: string;
  modifiers?: ('alt' | 'cmd' | 'ctrl' | 'shift')[];
}

/** Base dropdown menu item */
export interface FakeDropdownMenuItem {
  checked?: boolean;
  disabled: boolean;
  icon?: string;
  id: string;
  label: string;
  onSelect?: string;
  radioGroup?: string;
  radioValue?: string;
  shortcut?: DropdownMenuShortcut;
  subItems?: FakeDropdownMenuItem[];
  type: DropdownMenuItemType;
}

/** Dropdown menu configuration */
export interface FakeDropdownMenu {
  align: DropdownMenuAlign;
  className?: string;
  defaultOpen: boolean;
  disabled: boolean;
  id: string;
  items: FakeDropdownMenuItem[];
  loop: boolean;
  modal: boolean;
  side: DropdownMenuSide;
  sideOffset: number;
  triggerLabel: string;
}

/** Dropdown menu group */
export interface FakeDropdownMenuGroup {
  id: string;
  items: FakeDropdownMenuItem[];
  label?: string;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS (Used in Stories for Iteration)
// ═══════════════════════════════════════════════════════════════

export const DROPDOWN_MENU_SIDES: DropdownMenuSide[] = ['top', 'right', 'bottom', 'left'];

export const DROPDOWN_MENU_ALIGNS: DropdownMenuAlign[] = ['start', 'center', 'end'];

export const DROPDOWN_MENU_ITEM_TYPES: DropdownMenuItemType[] = [
  'item',
  'checkbox',
  'radio',
  'separator',
  'sub',
];

export const DROPDOWN_MENU_ICONS = [
  'User',
  'Settings',
  'CreditCard',
  'Keyboard',
  'LogOut',
  'Mail',
  'MessageSquare',
  'PlusCircle',
  'Plus',
  'UserPlus',
  'Users',
  'Cloud',
  'Github',
  'LifeBuoy',
  'Copy',
  'Trash',
  'Edit',
  'Share',
  'Download',
  'ExternalLink',
];

export const DROPDOWN_MENU_LABELS = [
  i18n.t('factory.dropdownMenu.profile', 'Profile'),
  i18n.t('factory.dropdownMenu.settings', 'Settings'),
  i18n.t('factory.dropdownMenu.billing', 'Billing'),
  i18n.t('factory.dropdownMenu.team', 'Team'),
  i18n.t('factory.dropdownMenu.inviteUsers', 'Invite Users'),
  i18n.t('factory.dropdownMenu.newTeam', 'New Team'),
  'GitHub',
  i18n.t('factory.dropdownMenu.support', 'Support'),
  'API',
  i18n.t('factory.dropdownMenu.keyboardShortcuts', 'Keyboard Shortcuts'),
  i18n.t('factory.dropdownMenu.logOut', 'Log Out'),
  i18n.t('factory.dropdownMenu.edit', 'Edit'),
  i18n.t('factory.dropdownMenu.copy', 'Copy'),
  i18n.t('factory.dropdownMenu.delete', 'Delete'),
  i18n.t('factory.dropdownMenu.share', 'Share'),
  i18n.t('factory.dropdownMenu.download', 'Download'),
  i18n.t('factory.dropdownMenu.export', 'Export'),
  i18n.t('factory.dropdownMenu.print', 'Print'),
  i18n.t('factory.dropdownMenu.archive', 'Archive'),
  i18n.t('factory.dropdownMenu.moveToTrash', 'Move to Trash'),
];

export const DROPDOWN_MENU_SHORTCUTS: DropdownMenuShortcut[] = [
  { key: 'B', modifiers: ['cmd', 'shift'] },
  { key: 'S', modifiers: ['cmd'] },
  { key: 'P', modifiers: ['cmd'] },
  { key: 'K', modifiers: ['cmd'] },
  { key: 'N', modifiers: ['cmd'] },
  { key: 'D', modifiers: ['cmd'] },
  { key: 'Backspace', modifiers: ['cmd'] },
  { key: 'E', modifiers: ['cmd', 'shift'] },
];

// ═══════════════════════════════════════════════════════════════
// SINGLE ITEM FACTORY
// ═══════════════════════════════════════════════════════════════

/** Create a fake dropdown menu item */
export function createFakeDropdownMenuItem(
  overrides?: Partial<FakeDropdownMenuItem>
): FakeDropdownMenuItem {
  const type = overrides?.type ?? faker.helpers.arrayElement(DROPDOWN_MENU_ITEM_TYPES);
  const isCheckbox = type === 'checkbox';
  const isRadio = type === 'radio';

  return {
    id: faker.string.uuid(),
    type,
    label: type === 'separator' ? '' : faker.helpers.arrayElement(DROPDOWN_MENU_LABELS),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(DROPDOWN_MENU_ICONS), {
      probability: 0.4,
    }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    shortcut: faker.helpers.maybe(() => faker.helpers.arrayElement(DROPDOWN_MENU_SHORTCUTS), {
      probability: 0.2,
    }),
    checked: isCheckbox ? faker.datatype.boolean() : undefined,
    radioGroup: isRadio ? `radio-group-${faker.string.alphanumeric(4)}` : undefined,
    radioValue: isRadio ? faker.string.alphanumeric(6) : undefined,
    onSelect: faker.helpers.maybe(() => faker.word.verb(), { probability: 0.3 }),
    ...overrides,
  };
}

/** Create a fake dropdown menu */
export function createFakeDropdownMenu(overrides?: Partial<FakeDropdownMenu>): FakeDropdownMenu {
  return {
    id: faker.string.uuid(),
    triggerLabel: faker.helpers.arrayElement([
      i18n.t('factory.dropdownMenu.openMenu', 'Open Menu'),
      i18n.t('factory.dropdownMenu.options', 'Options'),
      i18n.t('factory.dropdownMenu.actions', 'Actions'),
      i18n.t('factory.dropdownMenu.more', 'More'),
      '⋮',
    ]),
    side: faker.helpers.arrayElement(DROPDOWN_MENU_SIDES),
    align: faker.helpers.arrayElement(DROPDOWN_MENU_ALIGNS),
    sideOffset: faker.helpers.arrayElement([0, 4, 8]),
    defaultOpen: false,
    modal: true,
    loop: true,
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    items: createFakeDropdownMenuItems(faker.number.int({ min: 3, max: 8 })),
    className: faker.helpers.maybe(() => 'w-56', { probability: 0.3 }),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// BULK FACTORY (For Lists/Tables)
// ═══════════════════════════════════════════════════════════════

/** Create multiple dropdown menu items */
export function createFakeDropdownMenuItems(
  count: number,
  overrides?: Partial<FakeDropdownMenuItem>
): FakeDropdownMenuItem[] {
  return Array.from({ length: count }, () => createFakeDropdownMenuItem(overrides));
}

/** Create multiple dropdown menus */
export function createFakeDropdownMenus(
  count: number,
  overrides?: Partial<FakeDropdownMenu>
): FakeDropdownMenu[] {
  return Array.from({ length: count }, () => createFakeDropdownMenu(overrides));
}

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED FACTORIES (For Specific Scenarios)
// ═══════════════════════════════════════════════════════════════

/** Create a user account dropdown menu */
export function createFakeUserAccountMenu(): FakeDropdownMenu {
  return createFakeDropdownMenu({
    triggerLabel: faker.person.fullName(),
    items: [
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.profile', 'Profile'),
        icon: 'User',
        type: 'item',
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.billing', 'Billing'),
        icon: 'CreditCard',
        type: 'item',
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.settings', 'Settings'),
        icon: 'Settings',
        type: 'item',
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.keyboardShortcuts2', 'Keyboard shortcuts'),
        icon: 'Keyboard',
        type: 'item',
        shortcut: { key: 'K', modifiers: ['cmd'] },
      }),
      createFakeDropdownMenuItem({ type: 'separator', label: '' }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.team', 'Team'),
        icon: 'Users',
        type: 'item',
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.inviteUsers2', 'Invite users'),
        icon: 'UserPlus',
        type: 'sub',
        subItems: [
          createFakeDropdownMenuItem({
            label: i18n.t('factory.dropdownMenu.email', 'Email'),
            icon: 'Mail',
            type: 'item',
          }),
          createFakeDropdownMenuItem({
            label: i18n.t('factory.dropdownMenu.message', 'Message'),
            icon: 'MessageSquare',
            type: 'item',
          }),
          createFakeDropdownMenuItem({ type: 'separator', label: '' }),
          createFakeDropdownMenuItem({
            label: i18n.t('factory.dropdownMenu.more2', 'More...'),
            icon: 'PlusCircle',
            type: 'item',
          }),
        ],
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.newTeam', 'New Team'),
        icon: 'Plus',
        type: 'item',
        shortcut: { key: 'T', modifiers: ['cmd'] },
      }),
      createFakeDropdownMenuItem({ type: 'separator', label: '' }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.github', 'GitHub'),
        icon: 'Github',
        type: 'item',
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.support', 'Support'),
        icon: 'LifeBuoy',
        type: 'item',
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.api', 'API'),
        icon: 'Cloud',
        type: 'item',
        disabled: true,
      }),
      createFakeDropdownMenuItem({ type: 'separator', label: '' }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.logOut2', 'Log out'),
        icon: 'LogOut',
        type: 'item',
        shortcut: { key: 'Q', modifiers: ['cmd', 'shift'] },
      }),
    ],
  });
}

/** Create a context action menu (edit, copy, delete) */
export function createFakeContextActionMenu(): FakeDropdownMenu {
  return createFakeDropdownMenu({
    triggerLabel: i18n.t('factory.dropdownMenu.actions', 'Actions'),
    items: [
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.edit', 'Edit'),
        icon: 'Edit',
        type: 'item',
        shortcut: { key: 'E', modifiers: ['cmd'] },
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.copy', 'Copy'),
        icon: 'Copy',
        type: 'item',
        shortcut: { key: 'C', modifiers: ['cmd'] },
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.share', 'Share'),
        icon: 'Share',
        type: 'item',
      }),
      createFakeDropdownMenuItem({ type: 'separator', label: '' }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.delete', 'Delete'),
        icon: 'Trash',
        type: 'item',
        shortcut: { key: 'Backspace', modifiers: ['cmd'] },
      }),
    ],
  });
}

/** Create a checkbox group menu */
export function createFakeCheckboxMenu(): FakeDropdownMenu {
  return createFakeDropdownMenu({
    triggerLabel: i18n.t('factory.dropdownMenu.viewOptions', 'View Options'),
    items: [
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.showToolbar', 'Show Toolbar'),
        type: 'checkbox',
        checked: true,
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.showSidebar', 'Show Sidebar'),
        type: 'checkbox',
        checked: true,
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.showStatusBar', 'Show Status Bar'),
        type: 'checkbox',
        checked: false,
      }),
      createFakeDropdownMenuItem({ type: 'separator', label: '' }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.showLineNumbers', 'Show Line Numbers'),
        type: 'checkbox',
        checked: true,
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.wordWrap', 'Word Wrap'),
        type: 'checkbox',
        checked: false,
      }),
    ],
  });
}

/** Create a radio group menu */
export function createFakeRadioMenu(): FakeDropdownMenu {
  const radioGroup = 'theme-group';
  return createFakeDropdownMenu({
    triggerLabel: i18n.t('factory.dropdownMenu.theme', 'Theme'),
    items: [
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.light', 'Light'),
        type: 'radio',
        radioGroup,
        radioValue: 'light',
        checked: true,
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.dark', 'Dark'),
        type: 'radio',
        radioGroup,
        radioValue: 'dark',
        checked: false,
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.system', 'System'),
        type: 'radio',
        radioGroup,
        radioValue: 'system',
        checked: false,
      }),
    ],
  });
}

/** Create a nested submenu */
export function createFakeNestedMenu(): FakeDropdownMenu {
  return createFakeDropdownMenu({
    triggerLabel: i18n.t('factory.dropdownMenu.file', 'File'),
    items: [
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.new', 'New'),
        icon: 'Plus',
        type: 'sub',
        subItems: [
          createFakeDropdownMenuItem({
            label: i18n.t('factory.dropdownMenu.document', 'Document'),
            type: 'item',
          }),
          createFakeDropdownMenuItem({
            label: i18n.t('factory.dropdownMenu.spreadsheet', 'Spreadsheet'),
            type: 'item',
          }),
          createFakeDropdownMenuItem({
            label: i18n.t('factory.dropdownMenu.presentation', 'Presentation'),
            type: 'item',
          }),
          createFakeDropdownMenuItem({ type: 'separator', label: '' }),
          createFakeDropdownMenuItem({
            label: i18n.t('factory.dropdownMenu.fromTemplate', 'From Template...'),
            type: 'item',
          }),
        ],
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.open', 'Open'),
        type: 'item',
        shortcut: { key: 'O', modifiers: ['cmd'] },
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.save', 'Save'),
        type: 'item',
        shortcut: { key: 'S', modifiers: ['cmd'] },
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.saveAs', 'Save As...'),
        type: 'item',
      }),
      createFakeDropdownMenuItem({ type: 'separator', label: '' }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.export', 'Export'),
        icon: 'Download',
        type: 'sub',
        subItems: [
          createFakeDropdownMenuItem({
            label: i18n.t('factory.dropdownMenu.pdf', 'PDF'),
            type: 'item',
          }),
          createFakeDropdownMenuItem({
            label: i18n.t('factory.dropdownMenu.word', 'Word'),
            type: 'item',
          }),
          createFakeDropdownMenuItem({
            label: i18n.t('factory.dropdownMenu.html', 'HTML'),
            type: 'item',
          }),
        ],
      }),
      createFakeDropdownMenuItem({ type: 'separator', label: '' }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.print', 'Print'),
        type: 'item',
        shortcut: { key: 'P', modifiers: ['cmd'] },
      }),
    ],
  });
}

/** Create disabled state menu */
export function createFakeDisabledMenu(): FakeDropdownMenu {
  return createFakeDropdownMenu({
    triggerLabel: i18n.t('factory.dropdownMenu.disabledOptions', 'Disabled Options'),
    items: [
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.enabledAction', 'Enabled Action'),
        type: 'item',
        disabled: false,
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.disabledAction', 'Disabled Action'),
        type: 'item',
        disabled: true,
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.anotherEnabled', 'Another Enabled'),
        type: 'item',
        disabled: false,
      }),
      createFakeDropdownMenuItem({ type: 'separator', label: '' }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.disabledWithIcon', 'Disabled with Icon'),
        icon: 'Settings',
        type: 'item',
        disabled: true,
      }),
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// GROUP FACTORIES
// ═══════════════════════════════════════════════════════════════

/** Create a dropdown menu group */
export function createFakeDropdownMenuGroup(
  overrides?: Partial<FakeDropdownMenuGroup>
): FakeDropdownMenuGroup {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.maybe(() => faker.word.noun(), { probability: 0.5 }),
    items: createFakeDropdownMenuItems(faker.number.int({ min: 2, max: 5 })),
    ...overrides,
  };
}

/** Create multiple dropdown menu groups */
export function createFakeDropdownMenuGroups(count: number): FakeDropdownMenuGroup[] {
  return Array.from({ length: count }, () => createFakeDropdownMenuGroup());
}

// ═══════════════════════════════════════════════════════════════
// MATRIX FACTORIES (For Visual Regression)
// ═══════════════════════════════════════════════════════════════

/** Create side × align matrix for positioning tests */
export function createFakeDropdownMenuPositionMatrix(): FakeDropdownMenu[][] {
  return DROPDOWN_MENU_SIDES.map((side) =>
    DROPDOWN_MENU_ALIGNS.map((align) =>
      createFakeDropdownMenu({
        side,
        align,
        triggerLabel: i18n.t('factory.dropdownMenu.positionLabel', '{{side}}-{{align}}', {
          side,
          align,
        }),
      })
    )
  );
}

/** Create all item types for visual testing */
export function createFakeDropdownMenuItemTypeMatrix(): FakeDropdownMenuItem[] {
  return [
    createFakeDropdownMenuItem({
      type: 'item',
      label: i18n.t('factory.dropdownMenu.regularItem', 'Regular Item'),
      icon: 'User',
    }),
    createFakeDropdownMenuItem({
      type: 'checkbox',
      label: i18n.t('factory.dropdownMenu.checkboxItem', 'Checkbox Item'),
      checked: true,
    }),
    createFakeDropdownMenuItem({
      type: 'checkbox',
      label: i18n.t('factory.dropdownMenu.uncheckedItem', 'Unchecked Item'),
      checked: false,
    }),
    createFakeDropdownMenuItem({
      type: 'radio',
      label: i18n.t('factory.dropdownMenu.radioItem', 'Radio Item'),
      checked: true,
    }),
    createFakeDropdownMenuItem({ type: 'separator', label: '' }),
    createFakeDropdownMenuItem({
      type: 'item',
      label: i18n.t('factory.dropdownMenu.disabledItem', 'Disabled Item'),
      disabled: true,
    }),
    createFakeDropdownMenuItem({
      type: 'item',
      label: i18n.t('factory.dropdownMenu.withShortcut', 'With Shortcut'),
      shortcut: { key: 'K', modifiers: ['cmd'] },
    }),
  ];
}

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE FEATURE FACTORIES
// ═══════════════════════════════════════════════════════════════

/** Create an accessible dropdown menu with ARIA labels */
export function createFakeAccessibleDropdownMenu(): FakeDropdownMenu {
  return createFakeDropdownMenu({
    triggerLabel: i18n.t('factory.dropdownMenu.accessibleMenu', 'Accessible Menu'),
    items: [
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.profileSettings', 'Profile Settings'),
        icon: 'User',
        type: 'item',
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.notificationPreferences', 'Notification Preferences'),
        icon: 'Settings',
        type: 'item',
      }),
      createFakeDropdownMenuItem({ type: 'separator', label: '' }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.signOut', 'Sign Out'),
        icon: 'LogOut',
        type: 'item',
      }),
    ],
    modal: true,
    loop: true,
  });
}

/** Create a data table row actions menu */
export function createFakeTableRowActionsMenu(): FakeDropdownMenu {
  return createFakeDropdownMenu({
    triggerLabel: '⋮',
    side: 'bottom',
    align: 'end',
    items: [
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.viewDetails', 'View Details'),
        icon: 'ExternalLink',
        type: 'item',
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.edit', 'Edit'),
        icon: 'Edit',
        type: 'item',
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.duplicate', 'Duplicate'),
        icon: 'Copy',
        type: 'item',
      }),
      createFakeDropdownMenuItem({ type: 'separator', label: '' }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.archive', 'Archive'),
        type: 'item',
      }),
      createFakeDropdownMenuItem({
        label: i18n.t('factory.dropdownMenu.delete', 'Delete'),
        icon: 'Trash',
        type: 'item',
      }),
    ],
  });
}
