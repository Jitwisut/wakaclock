import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND FACTORY
// Enterprise-grade test data generation for Command/Command Palette component
// Following button.factory.ts pattern for comprehensive type coverage
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED STRING CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ICON_SETTINGS = i18n.t('factory.command.settings', 'Settings');
const ICON_USER = i18n.t('factory.command.user', 'User');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** Command item type for categorization */
export type CommandItemType = 'action' | 'file' | 'navigation' | 'search' | 'setting' | 'user';

/** Command group identifier */
export type CommandGroup =
  | 'actions'
  | 'files'
  | 'navigation'
  | 'recent'
  | 'settings'
  | 'suggestions';

/** Command palette state */
export type CommandState = 'closed' | 'error' | 'idle' | 'loading' | 'open';

/** Command item priority for sorting */
export type CommandPriority = 'high' | 'low' | 'medium' | 'normal';

/** Command execution status */
export type CommandExecutionStatus = 'error' | 'idle' | 'pending' | 'success';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** Individual command item */
export interface FakeCommandItem {
  /** Optional description text */
  description?: string;
  /** Whether item is disabled */
  disabled?: boolean;
  /** Execution status of the command */
  executionStatus?: CommandExecutionStatus;
  /** Group this item belongs to */
  group: CommandGroup;
  /** Icon name from lucide-react */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Additional search keywords */
  keywords?: string[];
  /** Display label */
  label: string;
  /** Optional metadata for tracking */
  metadata?: Record<string, unknown>;
  /** Select callback (for demo purposes) */
  onSelect?: () => void;
  /** Priority for sorting */
  priority?: CommandPriority;
  /** Keyboard shortcut hint */
  shortcut?: string;
  /** Test ID for automation */
  testId?: string;
  /** Item type */
  type: CommandItemType;
  /** Search value (defaults to label) */
  value?: string;
}

/** Command group with items */
export interface FakeCommandGroup {
  /** Whether group should always be visible */
  forceMount?: boolean;
  /** Group heading text */
  heading: string;
  /** Unique identifier */
  id: string;
  /** Items in this group */
  items: FakeCommandItem[];
  /** Priority for group ordering */
  priority?: number;
}

/** Full command palette configuration */
export interface FakeCommandPalette {
  /** Custom empty state message */
  emptyMessage: string;
  /** Command groups */
  groups: FakeCommandGroup[];
  /** Unique identifier */
  id: string;
  /** Whether keyboard navigation should loop */
  loop?: boolean;
  /** Search input placeholder */
  placeholder: string;
  /** Recent command items */
  recentItems: FakeCommandItem[];
  /** Whether to filter items */
  shouldFilter?: boolean;
  /** Current state */
  state: CommandState;
  /** Test ID for automation */
  testId?: string;
}

/** Command search query */
export interface FakeCommandSearch {
  /** Filtered results */
  filteredItems: FakeCommandItem[];
  /** Whether currently searching */
  isSearching: boolean;
  /** Current query string */
  query: string;
  /** Total results count */
  totalResults: number;
}

/** Command dialog configuration */
export interface FakeCommandDialog {
  /** Dialog description for accessibility */
  description: string;
  /** Unique identifier */
  id: string;
  /** Whether dialog is open */
  open: boolean;
  /** Keyboard shortcut to open dialog */
  shortcut?: string;
  /** Dialog title for accessibility */
  title: string;
}

/** Command execution result */
export interface FakeCommandExecution {
  /** Command that was executed */
  commandId: string;
  /** Error message if failed */
  error?: string;
  /** Execution timestamp */
  executedAt: string;
  /** Whether execution was successful */
  success: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS (Used in Stories for Iteration)
// ═══════════════════════════════════════════════════════════════════════════════

export const COMMAND_ITEM_TYPES: CommandItemType[] = [
  'action',
  'navigation',
  'search',
  'setting',
  'user',
  'file',
];

export const COMMAND_GROUPS: CommandGroup[] = [
  'suggestions',
  'recent',
  'actions',
  'navigation',
  'settings',
  'files',
];

export const COMMAND_STATES: CommandState[] = ['idle', 'open', 'loading', 'error', 'closed'];

export const COMMAND_PRIORITIES: CommandPriority[] = ['high', 'medium', 'normal', 'low'];

export const COMMAND_EXECUTION_STATUSES: CommandExecutionStatus[] = [
  'idle',
  'pending',
  'success',
  'error',
];

export const COMMAND_ICONS = [
  i18n.t('factory.command.search', 'Search'),
  ICON_SETTINGS,
  ICON_USER,
  i18n.t('factory.command.home', 'Home'),
  i18n.t('factory.command.file', 'File'),
  i18n.t('factory.command.folder', 'Folder'),
  i18n.t('factory.command.mail', 'Mail'),
  i18n.t('factory.command.calendar', 'Calendar'),
  i18n.t('factory.command.bell', 'Bell'),
  i18n.t('factory.command.star', 'Star'),
  i18n.t('factory.command.heart', 'Heart'),
  i18n.t('factory.command.bookmark', 'Bookmark'),
  i18n.t('factory.command.share', 'Share'),
  i18n.t('factory.command.download', 'Download'),
  i18n.t('factory.command.upload', 'Upload'),
  i18n.t('factory.command.trash', 'Trash'),
  i18n.t('factory.command.edit', 'Edit'),
  i18n.t('factory.command.copy', 'Copy'),
  i18n.t('factory.command.clipboard', 'Clipboard'),
  i18n.t('factory.command.check', 'Check'),
  'X',
  i18n.t('factory.command.plus', 'Plus'),
  i18n.t('factory.command.minus', 'Minus'),
  'RefreshCw',
  'Zap',
  i18n.t('factory.command.terminal', 'Terminal'),
  i18n.t('factory.command.code', 'Code'),
  'GitBranch',
  i18n.t('factory.command.database', 'Database'),
  i18n.t('factory.command.cloud', 'Cloud'),
  i18n.t('factory.command.lock', 'Lock'),
  i18n.t('factory.command.unlock', 'Unlock'),
  'Eye',
  'EyeOff',
  i18n.t('factory.command.filter', 'Filter'),
  i18n.t('factory.command.grid', 'Grid'),
  i18n.t('factory.command.list', 'List'),
  'LayoutGrid',
  i18n.t('factory.command.layers', 'Layers'),
  i18n.t('factory.command.package', 'Package'),
  i18n.t('factory.command.palette', 'Palette'),
  i18n.t('factory.command.moon', 'Moon'),
  'Sun',
  i18n.t('factory.command.globe', 'Globe'),
  'MessageSquare',
  i18n.t('factory.command.phone', 'Phone'),
  i18n.t('factory.command.video', 'Video'),
  i18n.t('factory.command.image', 'Image'),
  'FileText',
  'FilePlus',
  'FolderOpen',
  'FolderPlus',
  i18n.t('factory.command.archive', 'Archive'),
  'LogOut',
  'LogIn',
  'UserPlus',
  i18n.t('factory.command.users', 'Users'),
  i18n.t('factory.command.shield', 'Shield'),
  'Key',
  'CreditCard',
  'DollarSign',
  i18n.t('factory.command.percent', 'Percent'),
  'TrendingUp',
  'BarChart',
  'PieChart',
  i18n.t('factory.command.activity', 'Activity'),
];

export const COMMAND_LABELS = {
  actions: [
    i18n.t('factory.command.createNew', 'Create New...'),
    i18n.t('factory.command.deleteSelected', 'Delete Selected'),
    i18n.t('factory.command.duplicate', 'Duplicate'),
    i18n.t('factory.command.export', 'Export'),
    i18n.t('factory.command.import', 'Import'),
    i18n.t('factory.command.share', 'Share'),
    i18n.t('factory.command.print', 'Print'),
    i18n.t('factory.command.archive', 'Archive'),
    i18n.t('factory.command.undo', 'Undo'),
    i18n.t('factory.command.redo', 'Redo'),
    i18n.t('factory.command.copy', 'Copy'),
    i18n.t('factory.command.paste', 'Paste'),
    i18n.t('factory.command.cut', 'Cut'),
    i18n.t('factory.command.selectAll', 'Select All'),
  ],
  navigation: [
    i18n.t('factory.command.goToDashboard', 'Go to Dashboard'),
    i18n.t('factory.command.goToSettings', 'Go to Settings'),
    i18n.t('factory.command.goToProfile', 'Go to Profile'),
    i18n.t('factory.command.goToProjects', 'Go to Projects'),
    i18n.t('factory.command.goToTasks', 'Go to Tasks'),
    i18n.t('factory.command.goToCalendar', 'Go to Calendar'),
    i18n.t('factory.command.goToReports', 'Go to Reports'),
    i18n.t('factory.command.goToTeam', 'Go to Team'),
    i18n.t('factory.command.goToBilling', 'Go to Billing'),
    i18n.t('factory.command.goToHelp', 'Go to Help'),
  ],
  settings: [
    i18n.t('factory.command.toggleDarkMode', 'Toggle Dark Mode'),
    i18n.t('factory.command.changeLanguage', 'Change Language'),
    i18n.t('factory.command.notificationSettings', 'Notification Settings'),
    i18n.t('factory.command.privacySettings', 'Privacy Settings'),
    i18n.t('factory.command.accountSettings', 'Account Settings'),
    i18n.t('factory.command.appearance', 'Appearance'),
    i18n.t('factory.command.accessibility', 'Accessibility'),
    i18n.t('factory.command.keyboardShortcuts', 'Keyboard Shortcuts'),
    i18n.t('factory.command.integrations', 'Integrations'),
  ],
  files: [
    i18n.t('factory.command.openFile', 'Open File'),
    i18n.t('factory.command.saveFile', 'Save File'),
    i18n.t('factory.command.saveAs', 'Save As...'),
    i18n.t('factory.command.newDocument', 'New Document'),
    i18n.t('factory.command.recentFiles', 'Recent Files'),
    i18n.t('factory.command.browseFiles', 'Browse Files'),
    i18n.t('factory.command.uploadFile', 'Upload File'),
    i18n.t('factory.command.downloadFile', 'Download File'),
    i18n.t('factory.command.renameFile', 'Rename File'),
  ],
  users: [
    i18n.t('factory.command.switchAccount', 'Switch Account'),
    i18n.t('factory.command.inviteUser', 'Invite User'),
    i18n.t('factory.command.manageTeam', 'Manage Team'),
    i18n.t('factory.command.viewProfile', 'View Profile'),
    i18n.t('factory.command.signOut', 'Sign Out'),
    i18n.t('factory.command.editProfile', 'Edit Profile'),
    i18n.t('factory.command.changePassword', 'Change Password'),
  ],
  search: [
    i18n.t('factory.command.searchFiles', 'Search Files'),
    i18n.t('factory.command.searchUsers', 'Search Users'),
    i18n.t('factory.command.searchProjects', 'Search Projects'),
    i18n.t('factory.command.searchTasks', 'Search Tasks'),
    i18n.t('factory.command.advancedSearch', 'Advanced Search'),
    i18n.t('factory.command.searchHistory', 'Search History'),
  ],
};

export const COMMAND_SHORTCUTS = [
  '⌘K',
  '⌘N',
  '⌘S',
  '⌘P',
  '⌘F',
  '⌘G',
  '⌘D',
  '⌘E',
  '⌘⇧N',
  '⌘⇧S',
  '⌘⇧P',
  '⌘⇧F',
  '⌘⇧D',
  '⌘⌥N',
  '⌘⌥S',
  '⌘⌥P',
  '⌘⌥F',
  'Ctrl+K',
  'Ctrl+N',
  'Ctrl+S',
  'Ctrl+P',
  'Ctrl+F',
  'Ctrl+G',
  'Ctrl+D',
  'Ctrl+E',
  'Ctrl+Shift+N',
  'Ctrl+Shift+S',
  'Ctrl+Shift+P',
  'Ctrl+Shift+F',
  i18n.t('factory.command.escape', 'Escape'),
  i18n.t('factory.command.enter', 'Enter'),
  'Tab',
];

export const COMMAND_PLACEHOLDERS = [
  i18n.t('factory.command.typeACommandOrSearch', 'Type a command or search...'),
  i18n.t('factory.command.searchCommands', 'Search commands...'),
  i18n.t('factory.command.whatWouldYouLikeTo', 'What would you like to do?'),
  i18n.t('factory.command.searchOrRunACommand', 'Search or run a command...'),
  i18n.t('factory.command.pressKToSearch', 'Press ⌘K to search...'),
  i18n.t('factory.command.findAnything', 'Find anything...'),
];

export const COMMAND_EMPTY_MESSAGES = [
  i18n.t('factory.command.noResultsFound', 'No results found.'),
  i18n.t('factory.command.noMatchingCommands', 'No matching commands.'),
  i18n.t('factory.command.tryADifferentSearchTerm', 'Try a different search term.'),
  i18n.t('factory.command.noItemsMatchYourQuery', 'No items match your query.'),
  i18n.t('factory.command.nothingHereYet', 'Nothing here yet.'),
];

export const COMMAND_GROUP_HEADINGS: Record<CommandGroup, string> = {
  suggestions: i18n.t('factory.command.suggestions', 'Suggestions'),
  recent: i18n.t('factory.command.recent', 'Recent'),
  actions: i18n.t('factory.command.actions', 'Actions'),
  navigation: i18n.t('factory.command.navigation', 'Navigation'),
  settings: ICON_SETTINGS,
  files: i18n.t('factory.command.files', 'Files'),
};

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE ITEM FACTORIES
// ═══════════════════════════════════════════════════════════════════════════════

/** Create a single fake command item */
export function createFakeCommandItem(overrides?: Partial<FakeCommandItem>): FakeCommandItem {
  const type = overrides?.type ?? faker.helpers.arrayElement(COMMAND_ITEM_TYPES);
  const group = overrides?.group ?? faker.helpers.arrayElement(COMMAND_GROUPS);

  // Select label based on type/group
  const labelPool = COMMAND_LABELS[type as keyof typeof COMMAND_LABELS] ?? COMMAND_LABELS.actions;
  const label = faker.helpers.arrayElement(labelPool);

  return {
    id: faker.string.uuid(),
    label,
    value: label.toLowerCase().replaceAll(/\s+/g, '-'),
    description: faker.helpers.maybe(() => faker.lorem.sentence({ min: 3, max: 8 }), {
      probability: 0.5,
    }),
    icon: faker.helpers.arrayElement(COMMAND_ICONS),
    shortcut: faker.helpers.maybe(() => faker.helpers.arrayElement(COMMAND_SHORTCUTS), {
      probability: 0.4,
    }),
    type,
    group,
    disabled: faker.helpers.maybe(() => true, { probability: 0.1 }),
    keywords: faker.helpers.maybe(
      () => Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () => faker.word.noun()),
      { probability: 0.6 }
    ),
    priority: faker.helpers.maybe(() => faker.helpers.arrayElement(COMMAND_PRIORITIES), {
      probability: 0.3,
    }),
    executionStatus: faker.helpers.maybe(
      () => faker.helpers.arrayElement(COMMAND_EXECUTION_STATUSES),
      { probability: 0.1 }
    ),
    testId: `command-item-${faker.string.alphanumeric(6)}`,
    metadata: faker.helpers.maybe(
      () => ({
        source: faker.helpers.arrayElement(['keyboard', 'mouse', 'voice', 'api']),
        timestamp: faker.date.recent().toISOString(),
      }),
      { probability: 0.2 }
    ),
    ...overrides,
  };
}

/** Create a single fake command group */
export function createFakeCommandGroup(overrides?: Partial<FakeCommandGroup>): FakeCommandGroup {
  const groupType = overrides?.id
    ? (overrides.id as CommandGroup)
    : faker.helpers.arrayElement(COMMAND_GROUPS);

  return {
    id: groupType,
    heading: COMMAND_GROUP_HEADINGS[groupType] ?? groupType,
    items: Array.from({ length: faker.number.int({ min: 2, max: 6 }) }, () =>
      createFakeCommandItem({ group: groupType })
    ),
    priority: faker.number.int({ min: 0, max: 100 }),
    forceMount: faker.helpers.maybe(() => true, { probability: 0.1 }),
    ...overrides,
  };
}

/** Create a full fake command palette configuration */
export function createFakeCommandPalette(
  overrides?: Partial<FakeCommandPalette>
): FakeCommandPalette {
  const groupCount = faker.number.int({ min: 2, max: 5 });
  const selectedGroups = faker.helpers.arrayElements(COMMAND_GROUPS, groupCount);

  return {
    id: faker.string.uuid(),
    placeholder: faker.helpers.arrayElement(COMMAND_PLACEHOLDERS),
    groups: selectedGroups.map((group) =>
      createFakeCommandGroup({
        id: group,
        heading: COMMAND_GROUP_HEADINGS[group],
      })
    ),
    recentItems: Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () =>
      createFakeCommandItem({ group: 'recent' })
    ),
    emptyMessage: faker.helpers.arrayElement(COMMAND_EMPTY_MESSAGES),
    state: faker.helpers.arrayElement(COMMAND_STATES),
    shouldFilter: true,
    loop: faker.helpers.maybe(() => true, { probability: 0.3 }),
    testId: `command-palette-${faker.string.alphanumeric(6)}`,
    ...overrides,
  };
}

/** Create a fake command dialog configuration */
export function createFakeCommandDialog(overrides?: Partial<FakeCommandDialog>): FakeCommandDialog {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.command.commandPalette', 'Command Palette'),
      i18n.t('factory.command.quickActions', 'Quick Actions'),
      i18n.t('factory.command.search', 'Search'),
      i18n.t('factory.command.runCommand', 'Run Command'),
    ]),
    description: faker.helpers.arrayElement([
      i18n.t('factory.command.searchForACommandTo', 'Search for a command to run...'),
      i18n.t('factory.command.typeToSearchAcrossAll', 'Type to search across all commands'),
      i18n.t('factory.command.findAndExecuteCommandsQuickly', 'Find and execute commands quickly'),
    ]),
    open: false,
    shortcut: faker.helpers.arrayElement(['⌘K', 'Ctrl+K', '⌘P', 'Ctrl+P']),
    ...overrides,
  };
}

/** Create a fake command search state */
export function createFakeCommandSearch(overrides?: Partial<FakeCommandSearch>): FakeCommandSearch {
  const query = overrides?.query ?? faker.lorem.words({ min: 1, max: 3 });
  const allItems = createFakeCommandItems(20);
  const filteredItems = query
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.keywords?.some((k) => k.toLowerCase().includes(query.toLowerCase()))
      )
    : allItems;

  return {
    query,
    filteredItems,
    totalResults: filteredItems.length,
    isSearching: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK FACTORIES (For Lists/Tables)
// ═══════════════════════════════════════════════════════════════════════════════

/** Create multiple fake command items */
export function createFakeCommandItems(
  count: number,
  overrides?: Partial<FakeCommandItem>
): FakeCommandItem[] {
  return Array.from({ length: count }, () => createFakeCommandItem(overrides));
}

/** Create multiple fake command groups */
export function createFakeCommandGroups(
  count?: number,
  overrides?: Partial<FakeCommandGroup>
): FakeCommandGroup[] {
  const groupCount = count ?? faker.number.int({ min: 2, max: 5 });
  return Array.from({ length: groupCount }, () => createFakeCommandGroup(overrides));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPECIALIZED FACTORIES (For Specific Scenarios)
// ═══════════════════════════════════════════════════════════════════════════════

/** Create navigation command items */
export function createFakeNavigationCommands(): FakeCommandItem[] {
  return COMMAND_LABELS.navigation.map((label) =>
    createFakeCommandItem({
      label,
      type: 'navigation',
      group: 'navigation',
      icon: faker.helpers.arrayElement([
        i18n.t('factory.command.home', 'Home'),
        ICON_SETTINGS,
        ICON_USER,
        i18n.t('factory.command.folder', 'Folder'),
        i18n.t('factory.command.calendar', 'Calendar'),
      ]),
    })
  );
}

/** Create action command items */
export function createFakeActionCommands(): FakeCommandItem[] {
  return COMMAND_LABELS.actions.map((label) =>
    createFakeCommandItem({
      label,
      type: 'action',
      group: 'actions',
      icon: faker.helpers.arrayElement([
        i18n.t('factory.command.plus', 'Plus'),
        i18n.t('factory.command.trash', 'Trash'),
        i18n.t('factory.command.copy', 'Copy'),
        i18n.t('factory.command.share', 'Share'),
        i18n.t('factory.command.download', 'Download'),
      ]),
    })
  );
}

/** Create settings command items */
export function createFakeSettingsCommands(): FakeCommandItem[] {
  return COMMAND_LABELS.settings.map((label) =>
    createFakeCommandItem({
      label,
      type: 'setting',
      group: 'settings',
      icon: faker.helpers.arrayElement([
        ICON_SETTINGS,
        i18n.t('factory.command.bell', 'Bell'),
        i18n.t('factory.command.lock', 'Lock'),
        i18n.t('factory.command.globe', 'Globe'),
        ICON_USER,
      ]),
    })
  );
}

/** Create file command items */
export function createFakeFileCommands(): FakeCommandItem[] {
  return COMMAND_LABELS.files.map((label) =>
    createFakeCommandItem({
      label,
      type: 'file',
      group: 'files',
      icon: faker.helpers.arrayElement([
        i18n.t('factory.command.file', 'File'),
        i18n.t('factory.command.folder', 'Folder'),
        'FileText',
        'FilePlus',
        'FolderOpen',
      ]),
    })
  );
}

/** Create user command items */
export function createFakeUserCommands(): FakeCommandItem[] {
  return COMMAND_LABELS.users.map((label) =>
    createFakeCommandItem({
      label,
      type: 'user',
      group: 'actions',
      icon: faker.helpers.arrayElement([
        ICON_USER,
        i18n.t('factory.command.users', 'Users'),
        'UserPlus',
        'LogOut',
        i18n.t('factory.command.shield', 'Shield'),
      ]),
    })
  );
}

/** Create search command items */
export function createFakeSearchCommands(): FakeCommandItem[] {
  return COMMAND_LABELS.search.map((label) =>
    createFakeCommandItem({
      label,
      type: 'search',
      group: 'suggestions',
      icon: faker.helpers.arrayElement([
        i18n.t('factory.command.search', 'Search'),
        i18n.t('factory.command.filter', 'Filter'),
        'Eye',
        i18n.t('factory.command.list', 'List'),
      ]),
    })
  );
}

/** Create search results based on query */
export function createFakeSearchResults(query: string): FakeCommandItem[] {
  const allItems = [
    ...createFakeNavigationCommands(),
    ...createFakeActionCommands(),
    ...createFakeSettingsCommands(),
    ...createFakeFileCommands(),
    ...createFakeUserCommands(),
    ...createFakeSearchCommands(),
  ];

  if (!query) return allItems;

  const lowerQuery = query.toLowerCase();
  return allItems.filter(
    (item) =>
      item.label.toLowerCase().includes(lowerQuery) ||
      item.description?.toLowerCase().includes(lowerQuery) ||
      item.keywords?.some((k) => k.toLowerCase().includes(lowerQuery))
  );
}

/** Create recent command items */
export function createFakeRecentCommands(count = 5): FakeCommandItem[] {
  return Array.from({ length: count }, () =>
    createFakeCommandItem({
      group: 'recent',
      metadata: {
        lastUsed: faker.date.recent().toISOString(),
        useCount: faker.number.int({ min: 1, max: 50 }),
      },
    })
  );
}

/** Create a disabled command item */
export function createFakeDisabledCommand(): FakeCommandItem {
  return createFakeCommandItem({
    disabled: true,
    description: i18n.t(
      'factory.command.thisCommandIsCurrentlyUnavailable',
      'This command is currently unavailable'
    ),
  });
}

/** Create a command with shortcut */
export function createFakeShortcutCommand(shortcut: string): FakeCommandItem {
  return createFakeCommandItem({
    shortcut,
    priority: 'high',
  });
}

/** Create a command with loading state */
export function createFakeLoadingCommand(): FakeCommandItem {
  return createFakeCommandItem({
    executionStatus: 'pending',
    description: i18n.t('factory.command.loading', 'Loading...'),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATRIX FACTORIES (For Visual Regression Testing)
// ═══════════════════════════════════════════════════════════════════════════════

/** Create a matrix of command groups for visual testing */
export function createFakeCommandMatrix(): FakeCommandGroup[] {
  return COMMAND_GROUPS.map((group) => ({
    id: group,
    heading: COMMAND_GROUP_HEADINGS[group],
    items: Array.from({ length: 4 }, () => createFakeCommandItem({ group })),
    priority: COMMAND_GROUPS.indexOf(group),
  }));
}

/** Create a state matrix for visual testing */
export function createFakeCommandStateMatrix(): Array<{
  items: FakeCommandItem[];
  state: CommandState;
}> {
  return COMMAND_STATES.map((state) => ({
    state,
    items: createFakeCommandItems(3),
  }));
}

/** Create a type matrix for visual testing */
export function createFakeCommandTypeMatrix(): Array<{
  items: FakeCommandItem[];
  type: CommandItemType;
}> {
  return COMMAND_ITEM_TYPES.map((type) => ({
    type,
    items: Array.from({ length: 3 }, () => createFakeCommandItem({ type })),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE FEATURE FACTORIES
// ═══════════════════════════════════════════════════════════════════════════════

/** Create a command palette with keyboard shortcuts */
export function createFakeKeyboardShortcutPalette(): FakeCommandPalette {
  const items = [
    createFakeShortcutCommand('⌘S'),
    createFakeShortcutCommand('⌘N'),
    createFakeShortcutCommand('⌘P'),
    createFakeShortcutCommand('⌘K'),
    createFakeShortcutCommand('⌘⇧F'),
  ];

  return createFakeCommandPalette({
    groups: [
      {
        id: 'shortcuts',
        heading: i18n.t('factory.command.keyboardShortcuts', 'Keyboard Shortcuts'),
        items,
        priority: 0,
      },
    ],
  });
}

/** Create a command palette with search capability */
export function createFakeSearchablePalette(query?: string): FakeCommandPalette {
  const filteredItems = createFakeSearchResults(query ?? '');

  // Group items by their group property
  const groupedItems = filteredItems.reduce(
    (acc, item) => {
      if (!acc[item.group]) {
        acc[item.group] = [];
      }
      acc[item.group].push(item);
      return acc;
    },
    {} as Record<CommandGroup, FakeCommandItem[]>
  );

  const groups = Object.entries(groupedItems).map(([groupId, items]) => ({
    id: groupId as CommandGroup,
    heading: COMMAND_GROUP_HEADINGS[groupId as CommandGroup] ?? groupId,
    items,
    priority: COMMAND_GROUPS.indexOf(groupId as CommandGroup),
  }));

  return createFakeCommandPalette({
    groups,
    state: 'open',
    shouldFilter: true,
  });
}

/** Create a command palette with all features for showcase */
export function createFakeEnterpriseCommandPalette(): FakeCommandPalette {
  return createFakeCommandPalette({
    state: 'open',
    groups: [
      {
        id: 'recent',
        heading: i18n.t('factory.command.recent', 'Recent'),
        items: createFakeRecentCommands(3),
        priority: 0,
      },
      {
        id: 'suggestions',
        heading: i18n.t('factory.command.suggestions', 'Suggestions'),
        items: [
          createFakeShortcutCommand('⌘K'),
          createFakeCommandItem({
            label: i18n.t('factory.command.toggleTheme', 'Toggle Theme'),
            icon: 'Moon',
          }),
          createFakeCommandItem({
            label: i18n.t('factory.command.openSettings', 'Open Settings'),
            icon: 'Settings',
          }),
        ],
        priority: 1,
      },
      {
        id: 'actions',
        heading: i18n.t('factory.command.actions', 'Actions'),
        items: createFakeActionCommands().slice(0, 5),
        priority: 2,
      },
      {
        id: 'navigation',
        heading: i18n.t('factory.command.navigation', 'Navigation'),
        items: createFakeNavigationCommands().slice(0, 4),
        priority: 3,
      },
      {
        id: 'settings',
        heading: ICON_SETTINGS,
        items: [...createFakeSettingsCommands().slice(0, 3), createFakeDisabledCommand()],
        priority: 4,
      },
    ],
    placeholder: i18n.t('factory.command.typeACommandOrSearch', 'Type a command or search...'),
    emptyMessage: i18n.t(
      'factory.command.noResultsFoundTryA',
      'No results found. Try a different search term.'
    ),
    shouldFilter: true,
    loop: true,
    testId: 'enterprise-command-palette',
  });
}
