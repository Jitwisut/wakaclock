/**
 * EmptyState Component Factory
 *
 * Generates fake data for EmptyState component stories and tests.
 * Supports various icon types, action configs, and content variations.
 *
 * @module empty-state.factory
 */
import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Icon variant options
 */
export type EmptyStateIconVariant =
  | 'alert'
  | 'cart'
  | 'file'
  | 'folder'
  | 'inbox'
  | 'package'
  | 'search'
  | 'users';

/**
 * Context scenarios for empty states
 */
export type EmptyStateContext =
  | 'cart'
  | 'dashboard'
  | 'files'
  | 'messages'
  | 'notifications'
  | 'projects'
  | 'search'
  | 'users';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All icon variants
 */
export const EMPTY_STATE_ICON_VARIANTS: EmptyStateIconVariant[] = [
  'alert',
  'cart',
  'file',
  'folder',
  'inbox',
  'package',
  'search',
  'users',
];

/**
 * All context scenarios
 */
export const EMPTY_STATE_CONTEXTS: EmptyStateContext[] = [
  'cart',
  'dashboard',
  'files',
  'messages',
  'notifications',
  'projects',
  'search',
  'users',
];

/**
 * Titles by context
 */
export const EMPTY_STATE_TITLES: Record<EmptyStateContext, string[]> = {
  cart: [
    i18n.t('factory.emptyState.yourCartIsEmpty', 'Your cart is empty'),
    i18n.t('factory.emptyState.nothingInCart', 'Nothing in cart'),
    i18n.t('factory.emptyState.cartIsEmpty', 'Cart is empty'),
  ],
  dashboard: [
    i18n.t('factory.emptyState.welcomeToYourDashboard', 'Welcome to your dashboard'),
    i18n.t('factory.emptyState.noDataYet', 'No data yet'),
    i18n.t('factory.emptyState.getStarted', 'Get started'),
  ],
  files: [
    i18n.t('factory.emptyState.noFilesFound', 'No files found'),
    i18n.t('factory.emptyState.noDocuments', 'No documents'),
    i18n.t('factory.emptyState.folderIsEmpty', 'Folder is empty'),
  ],
  messages: [
    i18n.t('factory.emptyState.noMessages', 'No messages'),
    i18n.t('factory.emptyState.inboxIsEmpty', 'Inbox is empty'),
    i18n.t('factory.emptyState.noConversations', 'No conversations'),
  ],
  notifications: [
    i18n.t('factory.emptyState.noNotifications', 'No notifications'),
    i18n.t('factory.emptyState.allCaughtUp', 'All caught up'),
    i18n.t('factory.emptyState.nothingNew', 'Nothing new'),
  ],
  projects: [
    i18n.t('factory.emptyState.noProjects', 'No projects'),
    i18n.t('factory.emptyState.createYourFirstProject', 'Create your first project'),
    i18n.t('factory.emptyState.noProjectsFound', 'No projects found'),
  ],
  search: [
    i18n.t('factory.emptyState.noResultsFound', 'No results found'),
    i18n.t('factory.emptyState.nothingMatches', 'Nothing matches'),
    i18n.t('factory.emptyState.noSearchResults', 'No search results'),
  ],
  users: [
    i18n.t('factory.emptyState.noTeamMembers', 'No team members'),
    i18n.t('factory.emptyState.noUsersFound', 'No users found'),
    i18n.t('factory.emptyState.inviteYourTeam', 'Invite your team'),
  ],
};

/**
 * Descriptions by context
 */
export const EMPTY_STATE_DESCRIPTIONS: Record<EmptyStateContext, string[]> = {
  cart: [
    i18n.t('factory.emptyState.addItemsToYourCart', 'Add items to your cart to continue shopping.'),
    i18n.t(
      'factory.emptyState.browseProductsAndAddItems',
      'Browse products and add items to your cart.'
    ),
  ],
  dashboard: [
    i18n.t(
      'factory.emptyState.getStartedByCreatingYour',
      'Get started by creating your first project.'
    ),
    i18n.t('factory.emptyState.setUpYourWorkspaceTo', 'Set up your workspace to see data here.'),
  ],
  files: [
    i18n.t('factory.emptyState.uploadFilesToGetStarted', 'Upload files to get started.'),
    i18n.t(
      'factory.emptyState.thisFolderDoesNotContain',
      'This folder does not contain any files.'
    ),
  ],
  messages: [
    i18n.t('factory.emptyState.newMessagesWillAppearHere', 'New messages will appear here.'),
    i18n.t(
      'factory.emptyState.checkBackLaterOrCompose',
      'Check back later or compose a new message.'
    ),
  ],
  notifications: [
    i18n.t('factory.emptyState.youHaveNoNewNotifications', 'You have no new notifications.'),
    i18n.t('factory.emptyState.checkBackLaterForUpdates', 'Check back later for updates.'),
  ],
  projects: [
    i18n.t(
      'factory.emptyState.createAProjectToStart',
      'Create a project to start organizing your work.'
    ),
    i18n.t('factory.emptyState.noProjectsMatchYourCriteria', 'No projects match your criteria.'),
  ],
  search: [
    i18n.t(
      'factory.emptyState.tryAdjustingYourSearchTerms',
      'Try adjusting your search terms or filters.'
    ),
    i18n.t('factory.emptyState.noItemsMatchYourSearch', 'No items match your search query.'),
  ],
  users: [
    i18n.t(
      'factory.emptyState.inviteTeamMembersToCollaborate',
      'Invite team members to collaborate.'
    ),
    i18n.t('factory.emptyState.noUsersMatchTheCurrent', 'No users match the current filters.'),
  ],
};

/**
 * Action labels by context
 */
export const EMPTY_STATE_ACTIONS: Record<EmptyStateContext, string[]> = {
  cart: [
    i18n.t('factory.emptyState.browseProducts', 'Browse Products'),
    i18n.t('factory.emptyState.continueShopping', 'Continue Shopping'),
  ],
  dashboard: [
    i18n.t('factory.emptyState.createProject', 'Create Project'),
    i18n.t('factory.emptyState.getStarted2', 'Get Started'),
  ],
  files: [
    i18n.t('factory.emptyState.uploadFiles', 'Upload Files'),
    i18n.t('factory.emptyState.createFolder', 'Create Folder'),
  ],
  messages: [
    i18n.t('factory.emptyState.composeMessage', 'Compose Message'),
    i18n.t('factory.emptyState.startChat', 'Start Chat'),
  ],
  notifications: [
    i18n.t('factory.emptyState.viewSettings', 'View Settings'),
    i18n.t('factory.emptyState.refresh', 'Refresh'),
  ],
  projects: [
    i18n.t('factory.emptyState.newProject', 'New Project'),
    i18n.t('factory.emptyState.importProject', 'Import Project'),
  ],
  search: [
    i18n.t('factory.emptyState.clearFilters', 'Clear Filters'),
    i18n.t('factory.emptyState.resetSearch', 'Reset Search'),
  ],
  users: [
    i18n.t('factory.emptyState.inviteMembers', 'Invite Members'),
    i18n.t('factory.emptyState.addUser', 'Add User'),
  ],
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base empty state configuration
 */
export interface FakeEmptyState {
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  description: string;
  iconVariant: EmptyStateIconVariant;
  id: string;
  testId: string;
  title: string;
}

/**
 * Empty state with context
 */
export interface FakeEmptyStateWithContext extends FakeEmptyState {
  context: EmptyStateContext;
}

// ============================================================================
// BASE FACTORIES
// ============================================================================

/**
 * Create a fake empty state
 */
export function createFakeEmptyState(overrides?: Partial<FakeEmptyState>): FakeEmptyState {
  const context = faker.helpers.arrayElement(EMPTY_STATE_CONTEXTS);

  return {
    action: faker.helpers.maybe(
      () => ({
        label: faker.helpers.arrayElement(EMPTY_STATE_ACTIONS[context]),
        onClick: () => {},
      }),
      { probability: 0.6 }
    ),
    className: faker.helpers.maybe(() => 'py-8', { probability: 0.3 }),
    description: faker.helpers.arrayElement(EMPTY_STATE_DESCRIPTIONS[context]),
    iconVariant: faker.helpers.arrayElement(EMPTY_STATE_ICON_VARIANTS),
    id: faker.string.uuid(),
    testId: `empty-state-${faker.string.alphanumeric(8)}`,
    title: faker.helpers.arrayElement(EMPTY_STATE_TITLES[context]),
    ...overrides,
  };
}

/**
 * Create multiple fake empty states
 */
export function createFakeEmptyStates(
  count: number,
  overrides?: Partial<FakeEmptyState>
): FakeEmptyState[] {
  return Array.from({ length: count }, () => createFakeEmptyState(overrides));
}

// ============================================================================
// CONTEXT FACTORIES
// ============================================================================

/**
 * Create an empty state for a specific context
 */
export function createFakeEmptyStateForContext(
  context: EmptyStateContext,
  overrides?: Partial<FakeEmptyStateWithContext>
): FakeEmptyStateWithContext {
  return {
    ...createFakeEmptyState({
      title: faker.helpers.arrayElement(EMPTY_STATE_TITLES[context]),
      description: faker.helpers.arrayElement(EMPTY_STATE_DESCRIPTIONS[context]),
      action: {
        label: faker.helpers.arrayElement(EMPTY_STATE_ACTIONS[context]),
        onClick: () => {},
      },
      ...overrides,
    }),
    context,
    ...overrides,
  };
}

// ============================================================================
// STATE FACTORIES
// ============================================================================

/**
 * Create an empty state with action
 */
export function createFakeEmptyStateWithAction(
  overrides?: Partial<FakeEmptyState>
): FakeEmptyState {
  const context = faker.helpers.arrayElement(EMPTY_STATE_CONTEXTS);
  return createFakeEmptyState({
    action: {
      label: faker.helpers.arrayElement(EMPTY_STATE_ACTIONS[context]),
      onClick: () => {},
    },
    ...overrides,
  });
}

/**
 * Create an empty state without action
 */
export function createFakeEmptyStateWithoutAction(
  overrides?: Partial<FakeEmptyState>
): FakeEmptyState {
  return createFakeEmptyState({
    action: undefined,
    ...overrides,
  });
}

/**
 * Create an empty state with long text (edge case)
 */
export function createFakeEmptyStateLongText(overrides?: Partial<FakeEmptyState>): FakeEmptyState {
  return createFakeEmptyState({
    title: faker.lorem.sentence(15),
    description: faker.lorem.paragraph(5),
    ...overrides,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Create empty states for all contexts
 */
export function createEmptyStateContextMatrix(): FakeEmptyStateWithContext[] {
  return EMPTY_STATE_CONTEXTS.map((context) => createFakeEmptyStateForContext(context));
}

/**
 * Create empty states for all icon variants
 */
export function createEmptyStateIconMatrix(): {
  emptyState: FakeEmptyState;
  iconVariant: EmptyStateIconVariant;
}[] {
  return EMPTY_STATE_ICON_VARIANTS.map((iconVariant) => ({
    emptyState: createFakeEmptyState({ iconVariant }),
    iconVariant,
  }));
}

// ============================================================================
// SHOWCASE FACTORIES
// ============================================================================

/**
 * Create comprehensive test data
 */
export function createEmptyStateTestData(): {
  basic: FakeEmptyState;
  contextMatrix: FakeEmptyStateWithContext[];
  iconMatrix: ReturnType<typeof createEmptyStateIconMatrix>;
  longText: FakeEmptyState;
  noAction: FakeEmptyState;
  withAction: FakeEmptyState;
} {
  return {
    basic: createFakeEmptyState(),
    contextMatrix: createEmptyStateContextMatrix(),
    iconMatrix: createEmptyStateIconMatrix(),
    longText: createFakeEmptyStateLongText(),
    noAction: createFakeEmptyStateWithoutAction(),
    withAction: createFakeEmptyStateWithAction(),
  };
}

/**
 * Create showcase of all empty state configurations
 */
export function createEmptyStateShowcase(): {
  contextMatrix: FakeEmptyStateWithContext[];
  iconMatrix: ReturnType<typeof createEmptyStateIconMatrix>;
  testData: ReturnType<typeof createEmptyStateTestData>;
} {
  return {
    contextMatrix: createEmptyStateContextMatrix(),
    iconMatrix: createEmptyStateIconMatrix(),
    testData: createEmptyStateTestData(),
  };
}
