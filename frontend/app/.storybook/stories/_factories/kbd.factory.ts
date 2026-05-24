/**
 * @fileoverview Factory functions for generating fake Kbd component data
 * @module kbd.factory
 * @description Provides comprehensive test data generation for Kbd (keyboard) components
 * including individual keys, key combinations, and keyboard shortcuts.
 *
 * @example
 * ```typescript
 * import { createFakeKbd, createFakeKeyboardShortcut } from './_factories/kbd.factory';
 *
 * // Create a random keyboard key
 * const key = createFakeKbd();
 *
 * // Create a keyboard shortcut combination
 * const shortcut = createFakeKeyboardShortcut();
 * ```
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// SHARED STRING CONSTANTS
// ============================================================================

const KEY_ALT = i18n.t('factory.kbd.alt', 'Alt');
const KEY_CTRL = i18n.t('factory.kbd.ctrl', 'Ctrl');
const KEY_DELETE = i18n.t('factory.kbd.delete', 'Delete');
const KEY_WIN = i18n.t('factory.kbd.win', 'Win');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Keyboard key category
 * @description Categories of keyboard keys
 */
export type KbdKeyCategory =
  | 'action'
  | 'arrow'
  | 'function'
  | 'letter'
  | 'modifier'
  | 'navigation'
  | 'number'
  | 'symbol';

/**
 * Operating system type
 * @description Target OS for platform-specific shortcuts
 */
export type KbdPlatform = 'linux' | 'mac' | 'windows';

/**
 * Shortcut action type
 * @description Common actions that have keyboard shortcuts
 */
export type KbdShortcutAction =
  | 'close'
  | 'copy'
  | 'cut'
  | 'delete'
  | 'find'
  | 'new'
  | 'open'
  | 'paste'
  | 'print'
  | 'redo'
  | 'refresh'
  | 'save'
  | 'select-all'
  | 'undo';

// ============================================================================
// CONSTANTS
// ============================================================================

/** All available key categories */
export const KBD_KEY_CATEGORIES: KbdKeyCategory[] = [
  'modifier',
  'letter',
  'number',
  'symbol',
  'function',
  'navigation',
  'arrow',
  'action',
];

/** All available platforms */
export const KBD_PLATFORMS: KbdPlatform[] = ['mac', 'windows', 'linux'];

/** All available shortcut actions */
export const KBD_SHORTCUT_ACTIONS: KbdShortcutAction[] = [
  'save',
  'copy',
  'paste',
  'cut',
  'undo',
  'redo',
  'find',
  'new',
  'open',
  'close',
  'print',
  'select-all',
  'refresh',
  'delete',
];

/** Modifier keys by platform */
export const KBD_MODIFIERS: Record<KbdPlatform, string[]> = {
  mac: ['⌘', '⌥', '⇧', '⌃', 'fn'],
  windows: [KEY_CTRL, KEY_ALT, i18n.t('factory.kbd.shift', 'Shift'), KEY_WIN],
  linux: [
    KEY_CTRL,
    KEY_ALT,
    i18n.t('factory.kbd.shift', 'Shift'),
    i18n.t('factory.kbd.super', 'Super'),
  ],
};

/** Common modifier key symbols */
export const KBD_MODIFIER_SYMBOLS = {
  alt: '⌥',
  cmd: '⌘',
  ctrl: '⌃',
  fn: 'fn',
  shift: '⇧',
  win: '⊞',
};

/** Letter keys */
export const KBD_LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

/** Number keys */
export const KBD_NUMBERS = [...'0123456789'];

/** Function keys */
export const KBD_FUNCTION_KEYS = [
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
];

/** Navigation keys */
export const KBD_NAVIGATION_KEYS = [
  i18n.t('factory.kbd.home', 'Home'),
  'End',
  i18n.t('factory.kbd.pageUp', 'Page Up'),
  i18n.t('factory.kbd.pageDown', 'Page Down'),
  i18n.t('factory.kbd.insert', 'Insert'),
  KEY_DELETE,
];

/** Arrow keys */
export const KBD_ARROW_KEYS = ['↑', '↓', '←', '→'];

/** Arrow key names */
export const KBD_ARROW_KEY_NAMES = [
  'Up',
  i18n.t('factory.kbd.down', 'Down'),
  i18n.t('factory.kbd.left', 'Left'),
  i18n.t('factory.kbd.right', 'Right'),
];

/** Action keys */
export const KBD_ACTION_KEYS = [
  i18n.t('factory.kbd.enter', 'Enter'),
  i18n.t('factory.kbd.return', 'Return'),
  'Tab',
  i18n.t('factory.kbd.space', 'Space'),
  i18n.t('factory.kbd.backspace', 'Backspace'),
  i18n.t('factory.kbd.escape', 'Escape'),
  'Esc',
  KEY_DELETE,
  'Del',
];

/** Symbol keys */
export const KBD_SYMBOL_KEYS = ['+', '-', '=', '[', ']', '\\', ';', "'", ',', '.', '/', '`'];

/** Common keyboard shortcuts (platform-agnostic description) */
export const KBD_COMMON_SHORTCUTS: Record<
  KbdShortcutAction,
  { description: string; keys: { linux: string[]; mac: string[]; windows: string[] } }
> = {
  close: {
    description: i18n.t('factory.kbd.close', 'Close'),
    keys: { mac: ['⌘', 'W'], windows: ['Ctrl', 'W'], linux: ['Ctrl', 'W'] },
  },
  copy: {
    description: i18n.t('factory.kbd.copy', 'Copy'),
    keys: { mac: ['⌘', 'C'], windows: ['Ctrl', 'C'], linux: ['Ctrl', 'C'] },
  },
  cut: {
    description: i18n.t('factory.kbd.cut', 'Cut'),
    keys: { mac: ['⌘', 'X'], windows: ['Ctrl', 'X'], linux: ['Ctrl', 'X'] },
  },
  delete: {
    description: KEY_DELETE,
    keys: { mac: ['⌘', '⌫'], windows: ['Del'], linux: ['Del'] },
  },
  find: {
    description: i18n.t('factory.kbd.find', 'Find'),
    keys: { mac: ['⌘', 'F'], windows: ['Ctrl', 'F'], linux: ['Ctrl', 'F'] },
  },
  new: {
    description: i18n.t('factory.kbd.new', 'New'),
    keys: { mac: ['⌘', 'N'], windows: ['Ctrl', 'N'], linux: ['Ctrl', 'N'] },
  },
  open: {
    description: i18n.t('factory.kbd.open', 'Open'),
    keys: { mac: ['⌘', 'O'], windows: ['Ctrl', 'O'], linux: ['Ctrl', 'O'] },
  },
  paste: {
    description: i18n.t('factory.kbd.paste', 'Paste'),
    keys: { mac: ['⌘', 'V'], windows: ['Ctrl', 'V'], linux: ['Ctrl', 'V'] },
  },
  print: {
    description: i18n.t('factory.kbd.print', 'Print'),
    keys: { mac: ['⌘', 'P'], windows: ['Ctrl', 'P'], linux: ['Ctrl', 'P'] },
  },
  redo: {
    description: i18n.t('factory.kbd.redo', 'Redo'),
    keys: { mac: ['⌘', '⇧', 'Z'], windows: ['Ctrl', 'Y'], linux: ['Ctrl', 'Y'] },
  },
  refresh: {
    description: i18n.t('factory.kbd.refresh', 'Refresh'),
    keys: { mac: ['⌘', 'R'], windows: ['F5'], linux: ['F5'] },
  },
  save: {
    description: i18n.t('factory.kbd.save', 'Save'),
    keys: { mac: ['⌘', 'S'], windows: ['Ctrl', 'S'], linux: ['Ctrl', 'S'] },
  },
  'select-all': {
    description: i18n.t('factory.kbd.selectAll', 'Select All'),
    keys: { mac: ['⌘', 'A'], windows: ['Ctrl', 'A'], linux: ['Ctrl', 'A'] },
  },
  undo: {
    description: i18n.t('factory.kbd.undo', 'Undo'),
    keys: { mac: ['⌘', 'Z'], windows: ['Ctrl', 'Z'], linux: ['Ctrl', 'Z'] },
  },
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Represents a single keyboard key
 */
export interface FakeKbd {
  /** Accessible description */
  ariaLabel?: string;
  /** Key category */
  category: KbdKeyCategory;
  /** Additional CSS classes */
  className?: string;
  /** Unique identifier */
  id: string;
  /** Whether this is a modifier key */
  isModifier: boolean;
  /** Key label to display */
  label: string;
  /** Test ID */
  testId?: string;
}

/**
 * Represents a keyboard shortcut combination
 */
export interface FakeKeyboardShortcut {
  /** Action type */
  action?: KbdShortcutAction;
  /** Human-readable action description */
  description: string;
  /** Formatted shortcut string (e.g., "⌘+C") */
  formatted: string;
  /** Unique identifier */
  id: string;
  /** Raw key labels */
  keyLabels: string[];
  /** Array of keys in the combination */
  keys: FakeKbd[];
  /** Target platform */
  platform: KbdPlatform;
  /** Whether to show the plus sign between keys */
  showSeparator: boolean;
}

/**
 * Represents a keyboard key group
 */
export interface FakeKbdGroup {
  /** Additional CSS classes */
  className?: string;
  /** Unique identifier */
  id: string;
  /** Keys in the group */
  keys: FakeKbd[];
  /** Key labels */
  labels: string[];
  /** Whether to show separator between keys */
  showSeparator: boolean;
}

/**
 * Represents a collection of shortcuts for a feature/context
 */
export interface FakeKbdShortcutCollection {
  /** Description of the context */
  description?: string;
  /** Unique identifier */
  id: string;
  /** Target platform */
  platform: KbdPlatform;
  /** Shortcuts in this collection */
  shortcuts: FakeKeyboardShortcut[];
  /** Collection title */
  title: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets the category for a key label
 */
function getKeyCategory(label: string): KbdKeyCategory {
  if (KBD_MODIFIERS.mac.includes(label) || KBD_MODIFIERS.windows.includes(label)) {
    return 'modifier';
  }
  if (KBD_LETTERS.includes(label)) {
    return 'letter';
  }
  if (KBD_NUMBERS.includes(label)) {
    return 'number';
  }
  if (KBD_FUNCTION_KEYS.includes(label)) {
    return 'function';
  }
  if (KBD_NAVIGATION_KEYS.includes(label)) {
    return 'navigation';
  }
  if (KBD_ARROW_KEYS.includes(label) || KBD_ARROW_KEY_NAMES.includes(label)) {
    return 'arrow';
  }
  if (KBD_ACTION_KEYS.includes(label)) {
    return 'action';
  }
  return 'symbol';
}

/**
 * Checks if a key is a modifier
 */
function isModifierKey(label: string): boolean {
  return (
    KBD_MODIFIERS.mac.includes(label) ||
    KBD_MODIFIERS.windows.includes(label) ||
    KBD_MODIFIERS.linux.includes(label)
  );
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a single fake Kbd configuration
 * @param overrides - Optional partial object to override default values
 * @returns A fake Kbd configuration
 */
export function createFakeKbd(overrides?: Partial<FakeKbd>): FakeKbd {
  const category = faker.helpers.arrayElement(KBD_KEY_CATEGORIES);
  let label: string;

  switch (category) {
    case 'modifier': {
      label = faker.helpers.arrayElement([...KBD_MODIFIERS.mac, ...KBD_MODIFIERS.windows]);
      break;
    }
    case 'letter': {
      label = faker.helpers.arrayElement(KBD_LETTERS);
      break;
    }
    case 'number': {
      label = faker.helpers.arrayElement(KBD_NUMBERS);
      break;
    }
    case 'function': {
      label = faker.helpers.arrayElement(KBD_FUNCTION_KEYS);
      break;
    }
    case 'navigation': {
      label = faker.helpers.arrayElement(KBD_NAVIGATION_KEYS);
      break;
    }
    case 'arrow': {
      label = faker.helpers.arrayElement(KBD_ARROW_KEYS);
      break;
    }
    case 'action': {
      label = faker.helpers.arrayElement(KBD_ACTION_KEYS);
      break;
    }
    default: {
      label = faker.helpers.arrayElement(KBD_SYMBOL_KEYS);
      break;
    }
  }

  return {
    id: faker.string.uuid(),
    label,
    category,
    isModifier: isModifierKey(label),
    ariaLabel: i18n.t('factory.kbd.keyAriaLabel', 'Key: {{label}}', { label }),
    className: faker.helpers.maybe(() => 'custom-kbd', { probability: 0.1 }),
    testId: `kbd-${faker.string.alphanumeric(6)}`,
    ...overrides,
  };
}

/**
 * Creates a fake keyboard key from a specific label
 * @param label - The key label
 * @returns A fake Kbd configuration
 */
export function createFakeKbdFromLabel(label: string): FakeKbd {
  return createFakeKbd({
    label,
    category: getKeyCategory(label),
    isModifier: isModifierKey(label),
    ariaLabel: i18n.t('factory.kbd.keyAriaLabel', 'Key: {{label}}', { label }),
  });
}

/**
 * Creates multiple fake Kbd configurations
 * @param count - Number of configurations to create
 * @returns Array of fake Kbd configurations
 */
export function createFakeKbds(count: number): FakeKbd[] {
  return Array.from({ length: count }, () => createFakeKbd());
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a keyboard shortcut combination
 * @param overrides - Optional partial object to override default values
 * @returns A fake keyboard shortcut configuration
 */
export function createFakeKeyboardShortcut(
  overrides?: Partial<FakeKeyboardShortcut>
): FakeKeyboardShortcut {
  const platform = faker.helpers.arrayElement(KBD_PLATFORMS);
  const action = faker.helpers.arrayElement(KBD_SHORTCUT_ACTIONS);
  const shortcutConfig = KBD_COMMON_SHORTCUTS[action];
  const keyLabels = shortcutConfig.keys[platform];
  const keys = keyLabels.map((label) => createFakeKbdFromLabel(label));

  return {
    id: faker.string.uuid(),
    description: shortcutConfig.description,
    action,
    platform,
    keys,
    keyLabels,
    formatted: keyLabels.join('+'),
    showSeparator: false,
    ...overrides,
  };
}

/**
 * Creates a keyboard shortcut for a specific action and platform
 * @param action - The shortcut action
 * @param platform - Target platform
 * @returns A fake keyboard shortcut configuration
 */
export function createFakeShortcutForAction(
  action: KbdShortcutAction,
  platform: KbdPlatform = 'mac'
): FakeKeyboardShortcut {
  const shortcutConfig = KBD_COMMON_SHORTCUTS[action];
  const keyLabels = shortcutConfig.keys[platform];
  const keys = keyLabels.map((label) => createFakeKbdFromLabel(label));

  return {
    id: faker.string.uuid(),
    description: shortcutConfig.description,
    action,
    platform,
    keys,
    keyLabels,
    formatted: keyLabels.join('+'),
    showSeparator: false,
  };
}

/**
 * Creates a keyboard key group
 * @param labels - Array of key labels
 * @param overrides - Optional partial object to override default values
 * @returns A fake key group configuration
 */
export function createFakeKbdGroup(
  labels?: string[],
  overrides?: Partial<FakeKbdGroup>
): FakeKbdGroup {
  const keyLabels =
    labels ??
    faker.helpers.arrayElements([...KBD_MODIFIERS.mac, ...KBD_LETTERS.slice(0, 10)], {
      min: 2,
      max: 4,
    });

  return {
    id: faker.string.uuid(),
    keys: keyLabels.map((label) => createFakeKbdFromLabel(label)),
    labels: keyLabels,
    showSeparator: faker.helpers.maybe(() => true, { probability: 0.5 }) ?? false,
    className: faker.helpers.maybe(() => 'custom-group', { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a collection of shortcuts for a context
 * @param overrides - Optional partial object to override default values
 * @returns A fake shortcut collection configuration
 */
export function createFakeKbdShortcutCollection(
  overrides?: Partial<FakeKbdShortcutCollection>
): FakeKbdShortcutCollection {
  const platform = faker.helpers.arrayElement(KBD_PLATFORMS);
  const actions = faker.helpers.arrayElements(KBD_SHORTCUT_ACTIONS, { min: 4, max: 8 });

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.kbd.editing', 'Editing'),
      i18n.t('factory.kbd.fileOperations', 'File Operations'),
      i18n.t('factory.kbd.navigation', 'Navigation'),
      i18n.t('factory.kbd.general', 'General'),
      i18n.t('factory.kbd.textFormatting', 'Text Formatting'),
    ]),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    shortcuts: actions.map((action) => createFakeShortcutForAction(action, platform)),
    platform,
    ...overrides,
  };
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of keys by category
 * @returns Array of Kbd configurations for each category
 */
export function createFakeKbdCategoryMatrix(): FakeKbd[] {
  return KBD_KEY_CATEGORIES.map((category) => {
    let label: string;
    switch (category) {
      case 'modifier': {
        label = '⌘';
        break;
      }
      case 'letter': {
        label = 'A';
        break;
      }
      case 'number': {
        label = '1';
        break;
      }
      case 'function': {
        label = 'F1';
        break;
      }
      case 'navigation': {
        label = i18n.t('factory.kbd.home', 'Home');
        break;
      }
      case 'arrow': {
        label = '↑';
        break;
      }
      case 'action': {
        label = i18n.t('factory.kbd.enter', 'Enter');
        break;
      }
      default: {
        label = '+';
        break;
      }
    }
    return createFakeKbd({ label, category });
  });
}

/**
 * Creates a matrix of shortcuts by platform
 * @param action - The shortcut action to use
 * @returns Array of shortcuts for each platform
 */
export function createFakeKbdPlatformMatrix(
  action: KbdShortcutAction = 'copy'
): FakeKeyboardShortcut[] {
  return KBD_PLATFORMS.map((platform) => createFakeShortcutForAction(action, platform));
}

/**
 * Creates a matrix of all common shortcuts for a platform
 * @param platform - Target platform
 * @returns Array of shortcuts for each action
 */
export function createFakeKbdShortcutMatrix(platform: KbdPlatform = 'mac'): FakeKeyboardShortcut[] {
  return KBD_SHORTCUT_ACTIONS.map((action) => createFakeShortcutForAction(action, platform));
}

/**
 * Creates a matrix of modifier keys for a platform
 * @param platform - Target platform
 * @returns Array of modifier keys
 */
export function createFakeKbdModifierMatrix(platform: KbdPlatform = 'mac'): FakeKbd[] {
  return KBD_MODIFIERS[platform].map((label) => createFakeKbdFromLabel(label));
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all Kbd configurations
 * @returns Record of categorized Kbd configurations
 */
export function createFakeKbdShowcase(): Record<string, unknown> {
  return {
    // Basic keys
    letterKey: createFakeKbd({ label: 'A', category: 'letter' }),
    numberKey: createFakeKbd({ label: '1', category: 'number' }),
    symbolKey: createFakeKbd({ label: '+', category: 'symbol' }),
    functionKey: createFakeKbd({ label: 'F1', category: 'function' }),
    arrowKey: createFakeKbd({ label: '↑', category: 'arrow' }),
    actionKey: createFakeKbd({ label: i18n.t('factory.kbd.enter', 'Enter'), category: 'action' }),
    navigationKey: createFakeKbd({
      label: i18n.t('factory.kbd.home', 'Home'),
      category: 'navigation',
    }),

    // Modifier keys
    cmdKey: createFakeKbd({ label: '⌘', category: 'modifier', isModifier: true }),
    optionKey: createFakeKbd({ label: '⌥', category: 'modifier', isModifier: true }),
    shiftKey: createFakeKbd({ label: '⇧', category: 'modifier', isModifier: true }),
    ctrlKey: createFakeKbd({ label: '⌃', category: 'modifier', isModifier: true }),
    ctrlWinKey: createFakeKbd({ label: KEY_CTRL, category: 'modifier', isModifier: true }),
    altWinKey: createFakeKbd({ label: KEY_ALT, category: 'modifier', isModifier: true }),

    // Key groups
    groupCmdK: createFakeKbdGroup(['⌘', 'K']),
    groupCmdShiftP: createFakeKbdGroup(['⌘', '⇧', 'P']),
    groupCtrlAltDel: createFakeKbdGroup([KEY_CTRL, KEY_ALT, KEY_DELETE]),

    // Common shortcuts (Mac)
    shortcutSaveMac: createFakeShortcutForAction('save', 'mac'),
    shortcutCopyMac: createFakeShortcutForAction('copy', 'mac'),
    shortcutPasteMac: createFakeShortcutForAction('paste', 'mac'),
    shortcutUndoMac: createFakeShortcutForAction('undo', 'mac'),
    shortcutRedoMac: createFakeShortcutForAction('redo', 'mac'),

    // Common shortcuts (Windows)
    shortcutSaveWin: createFakeShortcutForAction('save', 'windows'),
    shortcutCopyWin: createFakeShortcutForAction('copy', 'windows'),
    shortcutPasteWin: createFakeShortcutForAction('paste', 'windows'),

    // Shortcut collections
    editingShortcuts: createFakeKbdShortcutCollection({
      title: i18n.t('factory.kbd.editing', 'Editing'),
    }),
    fileShortcuts: createFakeKbdShortcutCollection({
      title: i18n.t('factory.kbd.fileOperations', 'File Operations'),
    }),

    // Matrices
    categoryMatrix: createFakeKbdCategoryMatrix(),
    platformMatrix: createFakeKbdPlatformMatrix('copy'),
    shortcutMatrix: createFakeKbdShortcutMatrix('mac'),
    modifierMatrixMac: createFakeKbdModifierMatrix('mac'),
    modifierMatrixWin: createFakeKbdModifierMatrix('windows'),
  };
}

// ============================================================================
// PRESET FACTORIES
// ============================================================================

/**
 * Creates common Mac modifier keys
 * @returns Array of Mac modifier key configurations
 */
export function createFakeMacModifiers(): FakeKbd[] {
  return ['⌘', '⌥', '⇧', '⌃'].map((label) => createFakeKbdFromLabel(label));
}

/**
 * Creates common Windows modifier keys
 * @returns Array of Windows modifier key configurations
 */
export function createFakeWindowsModifiers(): FakeKbd[] {
  return [KEY_CTRL, KEY_ALT, i18n.t('factory.kbd.shift', 'Shift'), KEY_WIN].map((label) =>
    createFakeKbdFromLabel(label)
  );
}

/**
 * Creates arrow key set
 * @returns Array of arrow key configurations
 */
export function createFakeArrowKeys(): FakeKbd[] {
  return KBD_ARROW_KEYS.map((label) => createFakeKbdFromLabel(label));
}

/**
 * Creates function key set
 * @returns Array of function key configurations
 */
export function createFakeFunctionKeys(): FakeKbd[] {
  return KBD_FUNCTION_KEYS.map((label) => createFakeKbdFromLabel(label));
}
