/**
 * Empty State Factory
 *
 * Provides faker-based test data generation for Empty component stories.
 * Supports various empty state scenarios like no data, search results,
 * error states, onboarding, and feature discovery.
 *
 * @module empty.factory
 * @see {@link file://./../../../components/ui/empty.tsx}
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Empty state media variant
 * @description Controls the visual style of the icon/media container
 */
export type EmptyMediaVariant = 'default' | 'icon';

/**
 * Empty state type classifications
 * @description Semantic types for different empty state scenarios
 */
export type EmptyStateType =
  | 'coming-soon'
  | 'error'
  | 'feature'
  | 'no-data'
  | 'no-permissions'
  | 'no-results'
  | 'offline'
  | 'onboarding';

/**
 * Empty state icon names (lucide-react)
 */
export type EmptyStateIcon =
  | 'AlertTriangle'
  | 'Archive'
  | 'Bell'
  | 'Calendar'
  | 'Clock'
  | 'Cloud'
  | 'CloudOff'
  | 'File'
  | 'FileQuestion'
  | 'FileX2'
  | 'Folder'
  | 'FolderOpen'
  | 'Heart'
  | 'Image'
  | 'Inbox'
  | 'Lock'
  | 'Mail'
  | 'MapPin'
  | 'MessageSquare'
  | 'Package'
  | 'Rocket'
  | 'Search'
  | 'SearchX'
  | 'Settings'
  | 'ShoppingCart'
  | 'Star'
  | 'Tag'
  | 'Users'
  | 'WifiOff';

/**
 * Action button type
 */
export type EmptyActionType = 'link' | 'primary' | 'secondary';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Empty state action button
 */
export interface FakeEmptyAction {
  /** Whether action is disabled */
  disabled?: boolean;
  /** Optional icon name */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Button label */
  label: string;
  /** Action type */
  type: EmptyActionType;
  /** URL for link actions */
  url?: string;
}

/**
 * Base empty state configuration
 */
export interface FakeEmptyState {
  /** Action buttons */
  actions?: FakeEmptyAction[];
  /** Additional description/help text */
  description: string;
  /** Icon name from lucide-react */
  icon: EmptyStateIcon;
  /** Unique identifier */
  id: string;
  /** Media variant */
  mediaVariant?: EmptyMediaVariant;
  /** Optional secondary description */
  secondaryText?: string;
  /** Empty state title */
  title: string;
  /** Empty state type */
  type: EmptyStateType;
}

/**
 * No data empty state (lists, tables, grids)
 */
export interface FakeNoDataEmptyState extends FakeEmptyState {
  /** Entity name (e.g., "projects", "tasks", "users") */
  entityName: string;
  /** Number of items (always 0 for no data) */
  itemCount: 0;
  type: 'no-data';
}

/**
 * No search results empty state
 */
export interface FakeNoResultsEmptyState extends FakeEmptyState {
  /** Applied filters (if any) */
  appliedFilters?: string[];
  /** Number of results (always 0) */
  resultCount: 0;
  /** Original search query */
  searchQuery: string;
  /** Whether filters are applied */
  showClearFilters?: boolean;
  type: 'no-results';
}

/**
 * Error empty state
 */
export interface FakeErrorEmptyState extends FakeEmptyState {
  /** Error code (e.g., 404, 500) */
  errorCode?: number;
  /** Error message */
  errorMessage: string;
  /** Whether retry is available */
  retryAvailable?: boolean;
  type: 'error';
}

/**
 * Onboarding empty state
 */
export interface FakeOnboardingEmptyState extends FakeEmptyState {
  /** Current step in onboarding */
  currentStep?: number;
  /** Total onboarding steps */
  totalSteps?: number;
  type: 'onboarding';
}

/**
 * Feature discovery empty state
 */
export interface FakeFeatureEmptyState extends FakeEmptyState {
  /** Feature benefits/highlights */
  benefits?: string[];
  /** Feature name */
  featureName: string;
  /** Whether feature is new */
  isNew?: boolean;
  type: 'feature';
}

/**
 * Offline empty state
 */
export interface FakeOfflineEmptyState extends FakeEmptyState {
  /** Last sync timestamp */
  lastSyncedAt?: Date;
  type: 'offline';
}

/**
 * No permissions empty state
 */
export interface FakeNoPermissionsEmptyState extends FakeEmptyState {
  /** Who to contact for access */
  requestAccessFrom?: string;
  /** Permission required */
  requiredPermission?: string;
  type: 'no-permissions';
}

/**
 * Coming soon empty state
 */
export interface FakeComingSoonEmptyState extends FakeEmptyState {
  /** Expected launch date */
  expectedDate?: Date;
  type: 'coming-soon';
  /** Features to expect */
  upcomingFeatures?: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Empty media variants
 */
export const EMPTY_MEDIA_VARIANTS: EmptyMediaVariant[] = ['default', 'icon'];

/**
 * Empty state types
 */
export const EMPTY_STATE_TYPES: EmptyStateType[] = [
  'coming-soon',
  'error',
  'feature',
  'no-data',
  'no-permissions',
  'no-results',
  'offline',
  'onboarding',
];

/**
 * Common empty state icons
 */
export const EMPTY_STATE_ICONS: EmptyStateIcon[] = [
  'AlertTriangle',
  'Archive',
  'Bell',
  'Calendar',
  'Clock',
  'Cloud',
  'CloudOff',
  'File',
  'FileQuestion',
  'FileX2',
  'Folder',
  'FolderOpen',
  'Heart',
  'Image',
  'Inbox',
  'Lock',
  'Mail',
  'MapPin',
  'MessageSquare',
  'Package',
  'Rocket',
  'Search',
  'SearchX',
  'Settings',
  'ShoppingCart',
  'Star',
  'Tag',
  'Users',
  'WifiOff',
];

/**
 * Common entity names for no-data states
 */
export const ENTITY_NAMES = [
  i18n.t('factory.empty.entityProjects', 'projects'),
  i18n.t('factory.empty.entityTasks', 'tasks'),
  i18n.t('factory.empty.entityUsers', 'users'),
  i18n.t('factory.empty.entityFiles', 'files'),
  i18n.t('factory.empty.entityMessages', 'messages'),
  i18n.t('factory.empty.entityNotifications', 'notifications'),
  i18n.t('factory.empty.entityOrders', 'orders'),
  i18n.t('factory.empty.entityProducts', 'products'),
  i18n.t('factory.empty.entityCustomers', 'customers'),
  i18n.t('factory.empty.entityInvoices', 'invoices'),
  i18n.t('factory.empty.entityAppointments', 'appointments'),
  i18n.t('factory.empty.entityEvents', 'events'),
  i18n.t('factory.empty.entityNotes', 'notes'),
  i18n.t('factory.empty.entityBookmarks', 'bookmarks'),
  i18n.t('factory.empty.entityFavorites', 'favorites'),
] as const;

/**
 * Icon mapping by state type
 */
export const ICONS_BY_STATE_TYPE: Record<EmptyStateType, EmptyStateIcon[]> = {
  'coming-soon': ['Rocket', 'Clock', 'Calendar'],
  error: ['AlertTriangle', 'FileX2', 'CloudOff'],
  feature: ['Rocket', 'Star', 'Package'],
  'no-data': ['Inbox', 'Folder', 'File', 'Archive'],
  'no-permissions': ['Lock', 'Users'],
  'no-results': ['SearchX', 'Search', 'FileQuestion'],
  offline: ['WifiOff', 'CloudOff', 'Cloud'],
  onboarding: ['Rocket', 'Star', 'Package'],
};

/**
 * Titles by state type
 */
export const TITLES_BY_STATE_TYPE: Record<EmptyStateType, string[]> = {
  'coming-soon': [
    i18n.t('factory.empty.comingSoon', 'Coming Soon'),
    i18n.t('factory.empty.stayTuned', 'Stay Tuned'),
    i18n.t('factory.empty.underConstruction', 'Under Construction'),
    i18n.t('factory.empty.inDevelopment', 'In Development'),
  ],
  error: [
    i18n.t('factory.empty.somethingWentWrong', 'Something went wrong'),
    i18n.t('factory.empty.oops', 'Oops!'),
    i18n.t('factory.empty.errorOccurred', 'Error occurred'),
    i18n.t('factory.empty.unableToLoad', 'Unable to load'),
  ],
  feature: [
    i18n.t('factory.empty.discoverThisFeature', 'Discover this feature'),
    i18n.t('factory.empty.newFeature', 'New Feature'),
    i18n.t('factory.empty.tryThisOut', 'Try this out'),
    i18n.t('factory.empty.unlockPotential', 'Unlock potential'),
  ],
  'no-data': [
    i18n.t('factory.empty.noItemsYet', 'No items yet'),
    i18n.t('factory.empty.nothingHere', 'Nothing here'),
    i18n.t('factory.empty.getStarted', 'Get started'),
    i18n.t('factory.empty.createYourFirstItem', 'Create your first item'),
  ],
  'no-permissions': [
    i18n.t('factory.empty.accessRestricted', 'Access restricted'),
    i18n.t('factory.empty.permissionRequired', 'Permission required'),
    i18n.t('factory.empty.unauthorized', 'Unauthorized'),
    i18n.t('factory.empty.noAccess', 'No access'),
  ],
  'no-results': [
    i18n.t('factory.empty.noResultsFound', 'No results found'),
    i18n.t('factory.empty.nothingMatches', 'Nothing matches'),
    i18n.t('factory.empty.noMatches', 'No matches'),
    i18n.t('factory.empty.tryDifferentKeywords', 'Try different keywords'),
  ],
  offline: [
    i18n.t('factory.empty.youreOffline2', "You're offline"),
    i18n.t('factory.empty.noConnection', 'No connection'),
    i18n.t('factory.empty.connectionLost', 'Connection lost'),
    i18n.t('factory.empty.offlineMode', 'Offline mode'),
  ],
  onboarding: [
    i18n.t('factory.empty.welcome', 'Welcome!'),
    i18n.t('factory.empty.letsGetStarted', "Let's get started"),
    i18n.t('factory.empty.firstSteps', 'First steps'),
    i18n.t('factory.empty.setUpYourAccount', 'Set up your account'),
  ],
};

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake empty state action
 */
export function createFakeEmptyAction(overrides?: Partial<FakeEmptyAction>): FakeEmptyAction {
  const type =
    overrides?.type ??
    faker.helpers.arrayElement<EmptyActionType>(['primary', 'secondary', 'link']);

  const labelsByType: Record<EmptyActionType, string[]> = {
    link: [
      i18n.t('factory.empty.learnMore', 'Learn more'),
      i18n.t('factory.empty.viewDocumentation', 'View documentation'),
      i18n.t('factory.empty.readGuide', 'Read guide'),
      i18n.t('factory.empty.getHelp', 'Get help'),
    ],
    primary: [
      i18n.t('factory.empty.createNew', 'Create new'),
      i18n.t('factory.empty.getStarted', 'Get started'),
      i18n.t('factory.empty.addItem', 'Add item'),
      i18n.t('factory.empty.tryAgain', 'Try again'),
      i18n.t('factory.empty.refresh', 'Refresh'),
    ],
    secondary: [
      i18n.t('factory.empty.import', 'Import'),
      i18n.t('factory.empty.learnMore', 'Learn more'),
      i18n.t('factory.empty.browseTemplates', 'Browse templates'),
      i18n.t('factory.empty.viewExamples', 'View examples'),
    ],
  };

  return {
    disabled: faker.helpers.maybe(() => true, { probability: 0.05 }),
    icon: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['Plus', 'ArrowRight', 'ExternalLink']),
      {
        probability: 0.3,
      }
    ),
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(labelsByType[type]),
    type,
    url: type === 'link' ? faker.internet.url() : undefined,
    ...overrides,
  };
}

/**
 * Creates a fake empty state configuration
 */
export function createFakeEmptyState(overrides?: Partial<FakeEmptyState>): FakeEmptyState {
  const type = overrides?.type ?? faker.helpers.arrayElement(EMPTY_STATE_TYPES);
  const icons = ICONS_BY_STATE_TYPE[type];
  const titles = TITLES_BY_STATE_TYPE[type];

  return {
    actions: faker.helpers.maybe(
      () => [
        createFakeEmptyAction({ type: 'primary' }),
        createFakeEmptyAction({ type: 'secondary' }),
      ],
      { probability: 0.7 }
    ),
    description: faker.lorem.sentence(),
    icon: faker.helpers.arrayElement(icons),
    id: faker.string.uuid(),
    mediaVariant: faker.helpers.arrayElement(EMPTY_MEDIA_VARIANTS),
    title: faker.helpers.arrayElement(titles),
    type,
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a no-data empty state
 */
export function createFakeNoDataEmptyState(
  entityName?: string,
  overrides?: Partial<FakeNoDataEmptyState>
): FakeNoDataEmptyState {
  const entity = entityName ?? faker.helpers.arrayElement([...ENTITY_NAMES]);

  return {
    ...createFakeEmptyState({ type: 'no-data' }),
    actions: [
      {
        id: 'create',
        label: i18n.t('factory.empty.createEntity', 'Create {{entity}}', {
          entity: entity.slice(0, -1),
        }),
        type: 'primary',
        icon: 'Plus',
      },
      { id: 'import', label: i18n.t('factory.empty.importData', 'Import data'), type: 'secondary' },
    ],
    description: i18n.t(
      'factory.empty.noEntityDescription',
      "You haven't created any {{entity}} yet. Get started by creating your first one.",
      { entity }
    ),
    entityName: entity,
    icon: faker.helpers.arrayElement<EmptyStateIcon>(['Inbox', 'Folder', 'File']),
    itemCount: 0,
    title: i18n.t('factory.empty.noEntityTitle', 'No {{entity}} yet', { entity }),
    type: 'no-data',
    ...overrides,
  };
}

/**
 * Creates a no-results empty state
 */
export function createFakeNoResultsEmptyState(
  searchQuery?: string,
  overrides?: Partial<FakeNoResultsEmptyState>
): FakeNoResultsEmptyState {
  const query = searchQuery ?? faker.word.words(2);
  const hasFilters = faker.datatype.boolean();

  return {
    ...createFakeEmptyState({ type: 'no-results' }),
    actions: [
      {
        id: 'clear',
        label: i18n.t('factory.empty.clearSearch', 'Clear search'),
        type: 'secondary',
      },
      ...(hasFilters
        ? [
            {
              id: 'clear-filters',
              label: i18n.t('factory.empty.clearFilters', 'Clear filters'),
              type: 'link' as const,
            },
          ]
        : []),
    ],
    appliedFilters: hasFilters
      ? faker.helpers.arrayElements(
          [
            i18n.t('factory.empty.category', 'Category'),
            i18n.t('factory.empty.date', 'Date'),
            i18n.t('factory.empty.status', 'Status'),
            i18n.t('factory.empty.tag', 'Tag'),
          ],
          { min: 1, max: 3 }
        )
      : undefined,
    description: i18n.t(
      'factory.empty.noResultsDescription',
      'We couldn\'t find anything matching "{{query}}". Try adjusting your search terms.',
      { query }
    ),
    icon: 'SearchX',
    resultCount: 0,
    searchQuery: query,
    showClearFilters: hasFilters,
    title: i18n.t('factory.empty.noResultsFound', 'No results found'),
    type: 'no-results',
    ...overrides,
  };
}

/**
 * Creates an error empty state
 */
export function createFakeErrorEmptyState(
  errorCode?: number,
  overrides?: Partial<FakeErrorEmptyState>
): FakeErrorEmptyState {
  const code = errorCode ?? faker.helpers.arrayElement([400, 403, 404, 500, 502, 503]);

  const errorMessages: Record<number, string> = {
    400: i18n.t('factory.empty.theRequestCouldNotBe', 'The request could not be understood.'),
    403: i18n.t(
      'factory.empty.youDontHavePermissionTo',
      "You don't have permission to access this resource."
    ),
    404: i18n.t('factory.empty.error404Message', "The page you're looking for doesn't exist."),
    500: i18n.t('factory.empty.somethingWentWrongOnOur', 'Something went wrong on our end.'),
    502: i18n.t('factory.empty.badGatewayPleaseTryAgain', 'Bad gateway. Please try again later.'),
    503: i18n.t('factory.empty.serviceTemporarilyUnavailable', 'Service temporarily unavailable.'),
  };

  return {
    ...createFakeEmptyState({ type: 'error' }),
    actions: [
      {
        id: 'retry',
        label: i18n.t('factory.empty.tryAgain2', 'Try again'),
        type: 'primary',
        icon: 'RefreshCw',
      },
      { id: 'home', label: i18n.t('factory.empty.goHome', 'Go home'), type: 'secondary' },
      {
        id: 'help',
        label: i18n.t('factory.empty.contactSupport', 'Contact support'),
        type: 'link',
      },
    ],
    description:
      errorMessages[code] ||
      i18n.t('factory.empty.anUnexpectedErrorOccurred', 'An unexpected error occurred.'),
    errorCode: code,
    errorMessage: errorMessages[code] || i18n.t('factory.empty.unknownError', 'Unknown error'),
    icon: 'AlertTriangle',
    retryAvailable: [500, 502, 503].includes(code),
    title: i18n.t('factory.empty.errorTitle', 'Error {{code}}', { code }),
    type: 'error',
    ...overrides,
  };
}

/**
 * Creates an onboarding empty state
 */
export function createFakeOnboardingEmptyState(
  currentStep: number = 1,
  totalSteps: number = 4,
  overrides?: Partial<FakeOnboardingEmptyState>
): FakeOnboardingEmptyState {
  return {
    ...createFakeEmptyState({ type: 'onboarding' }),
    actions: [
      {
        id: 'start',
        label: i18n.t('factory.empty.getStarted2', 'Get started'),
        type: 'primary',
        icon: 'ArrowRight',
      },
      { id: 'skip', label: i18n.t('factory.empty.skipForNow', 'Skip for now'), type: 'link' },
    ],
    currentStep,
    description: i18n.t(
      'factory.empty.completeAFewStepsTo',
      'Complete a few steps to set up your workspace and start being productive.'
    ),
    icon: 'Rocket',
    title: i18n.t('factory.empty.welcomeToYourWorkspace', 'Welcome to your workspace!'),
    totalSteps,
    type: 'onboarding',
    ...overrides,
  };
}

/**
 * Creates a feature discovery empty state
 */
export function createFakeFeatureEmptyState(
  featureName?: string,
  overrides?: Partial<FakeFeatureEmptyState>
): FakeFeatureEmptyState {
  const name = featureName ?? faker.word.words(2);

  return {
    ...createFakeEmptyState({ type: 'feature' }),
    actions: [
      { id: 'try', label: i18n.t('factory.empty.tryItNow', 'Try it now'), type: 'primary' },
      { id: 'learn', label: i18n.t('factory.empty.learnMore2', 'Learn more'), type: 'link' },
    ],
    benefits: [
      faker.lorem.sentence({ min: 4, max: 8 }),
      faker.lorem.sentence({ min: 4, max: 8 }),
      faker.lorem.sentence({ min: 4, max: 8 }),
    ],
    description: i18n.t(
      'factory.empty.featureDescription',
      'Discover how {{name}} can help you be more productive.',
      { name }
    ),
    featureName: name,
    icon: 'Rocket',
    isNew: faker.datatype.boolean(),
    title: i18n.t('factory.empty.introducingFeature', 'Introducing {{name}}', { name }),
    type: 'feature',
    ...overrides,
  };
}

/**
 * Creates an offline empty state
 */
export function createFakeOfflineEmptyState(
  overrides?: Partial<FakeOfflineEmptyState>
): FakeOfflineEmptyState {
  return {
    ...createFakeEmptyState({ type: 'offline' }),
    actions: [
      {
        id: 'retry',
        label: i18n.t('factory.empty.tryAgain', 'Try again'),
        type: 'primary',
        icon: 'RefreshCw',
      },
    ],
    description: i18n.t(
      'factory.empty.pleaseCheckYourInternetConnection',
      'Please check your internet connection and try again.'
    ),
    icon: 'WifiOff',
    lastSyncedAt: faker.date.recent({ days: 1 }),
    title: i18n.t('factory.empty.youreOffline', "You're offline"),
    type: 'offline',
    ...overrides,
  };
}

/**
 * Creates a no-permissions empty state
 */
export function createFakeNoPermissionsEmptyState(
  overrides?: Partial<FakeNoPermissionsEmptyState>
): FakeNoPermissionsEmptyState {
  return {
    ...createFakeEmptyState({ type: 'no-permissions' }),
    actions: [
      {
        id: 'request',
        label: i18n.t('factory.empty.requestAccess', 'Request access'),
        type: 'primary',
      },
      { id: 'back', label: i18n.t('factory.empty.goBack', 'Go back'), type: 'secondary' },
    ],
    description: i18n.t(
      'factory.empty.youDontHavePermissionTo2',
      "You don't have permission to view this content. Contact your administrator for access."
    ),
    icon: 'Lock',
    requestAccessFrom: faker.person.fullName(),
    requiredPermission: faker.helpers.arrayElement([
      i18n.t('factory.empty.permissionAdmin', 'admin'),
      i18n.t('factory.empty.permissionEditor', 'editor'),
      i18n.t('factory.empty.permissionViewer', 'viewer'),
    ]),
    title: i18n.t('factory.empty.accessRestricted', 'Access restricted'),
    type: 'no-permissions',
    ...overrides,
  };
}

/**
 * Creates a coming soon empty state
 */
export function createFakeComingSoonEmptyState(
  overrides?: Partial<FakeComingSoonEmptyState>
): FakeComingSoonEmptyState {
  return {
    ...createFakeEmptyState({ type: 'coming-soon' }),
    actions: [
      {
        id: 'notify',
        label: i18n.t('factory.empty.notifyMe', 'Notify me'),
        type: 'primary',
        icon: 'Bell',
      },
      { id: 'roadmap', label: i18n.t('factory.empty.viewRoadmap', 'View roadmap'), type: 'link' },
    ],
    description: i18n.t(
      'factory.empty.wereWorkingHardToBring',
      "We're working hard to bring you this feature. Stay tuned!"
    ),
    expectedDate: faker.date.future({ years: 1 }),
    icon: 'Rocket',
    title: i18n.t('factory.empty.comingSoon', 'Coming Soon'),
    type: 'coming-soon',
    upcomingFeatures: [
      faker.lorem.sentence({ min: 3, max: 6 }),
      faker.lorem.sentence({ min: 3, max: 6 }),
      faker.lorem.sentence({ min: 3, max: 6 }),
    ],
    ...overrides,
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple empty states
 */
export function createFakeEmptyStates(count: number): FakeEmptyState[] {
  return Array.from({ length: count }, () => createFakeEmptyState());
}

// ============================================================================
// DOMAIN-SPECIFIC FACTORIES
// ============================================================================

/**
 * Creates empty state for inbox/messages
 */
export function createFakeInboxEmptyState(): FakeNoDataEmptyState {
  return createFakeNoDataEmptyState(i18n.t('factory.empty.entityMessages', 'messages'), {
    description: i18n.t(
      'factory.empty.yourInboxIsEmptyWhen',
      "Your inbox is empty. When you receive messages, they'll appear here."
    ),
    icon: 'Inbox',
    title: i18n.t('factory.empty.noMessagesYet', 'No messages yet'),
  });
}

/**
 * Creates empty state for notifications
 */
export function createFakeNotificationsEmptyState(): FakeNoDataEmptyState {
  return createFakeNoDataEmptyState(i18n.t('factory.empty.entityNotifications', 'notifications'), {
    actions: [],
    description: i18n.t(
      'factory.empty.youreAllCaughtUpNew',
      "You're all caught up! New notifications will appear here."
    ),
    icon: 'Bell',
    title: i18n.t('factory.empty.noNotifications', 'No notifications'),
  });
}

/**
 * Creates empty state for shopping cart
 */
export function createFakeCartEmptyState(): FakeNoDataEmptyState {
  return createFakeNoDataEmptyState(i18n.t('factory.empty.entityItems', 'items'), {
    actions: [
      {
        id: 'shop',
        label: i18n.t('factory.empty.startShopping', 'Start shopping'),
        type: 'primary',
        icon: 'ShoppingCart',
      },
    ],
    description: i18n.t(
      'factory.empty.yourCartIsEmptyBrowse',
      'Your cart is empty. Browse our products and add items to your cart.'
    ),
    icon: 'ShoppingCart',
    title: i18n.t('factory.empty.yourCartIsEmpty', 'Your cart is empty'),
  });
}

/**
 * Creates empty state for favorites/bookmarks
 */
export function createFakeFavoritesEmptyState(): FakeNoDataEmptyState {
  return createFakeNoDataEmptyState(i18n.t('factory.empty.entityFavorites', 'favorites'), {
    actions: [
      { id: 'browse', label: i18n.t('factory.empty.browseItems', 'Browse items'), type: 'primary' },
    ],
    description: i18n.t(
      'factory.empty.itemsYouFavoriteWillAppear',
      'Items you favorite will appear here for quick access.'
    ),
    icon: 'Heart',
    title: i18n.t('factory.empty.noFavoritesYet', 'No favorites yet'),
  });
}

/**
 * Creates empty state for calendar/events
 */
export function createFakeCalendarEmptyState(): FakeNoDataEmptyState {
  return createFakeNoDataEmptyState(i18n.t('factory.empty.entityEvents', 'events'), {
    actions: [
      {
        id: 'create',
        label: i18n.t('factory.empty.createEvent', 'Create event'),
        type: 'primary',
        icon: 'Plus',
      },
    ],
    description: i18n.t(
      'factory.empty.noEventsScheduledCreateYour',
      'No events scheduled. Create your first event to get started.'
    ),
    icon: 'Calendar',
    title: i18n.t('factory.empty.noEvents', 'No events'),
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of empty states for visual testing
 */
export function createFakeEmptyStateMatrix(): Record<string, FakeEmptyState> {
  return {
    noData: createFakeNoDataEmptyState(i18n.t('factory.empty.entityProjects', 'projects')),
    noResults: createFakeNoResultsEmptyState(
      i18n.t('factory.empty.reactComponents', 'react components')
    ),
    error404: createFakeErrorEmptyState(404),
    error500: createFakeErrorEmptyState(500),
    onboarding: createFakeOnboardingEmptyState(),
    feature: createFakeFeatureEmptyState(
      i18n.t('factory.empty.analyticsDashboard', 'Analytics Dashboard')
    ),
    offline: createFakeOfflineEmptyState(),
    noPermissions: createFakeNoPermissionsEmptyState(),
    comingSoon: createFakeComingSoonEmptyState(),
    withIcon: createFakeEmptyState({ mediaVariant: 'icon' }),
    withoutIcon: createFakeEmptyState({ mediaVariant: 'default' }),
    withActions: createFakeEmptyState({
      actions: [
        createFakeEmptyAction({ type: 'primary' }),
        createFakeEmptyAction({ type: 'secondary' }),
        createFakeEmptyAction({ type: 'link' }),
      ],
    }),
    withoutActions: createFakeEmptyState({ actions: undefined }),
  };
}

/**
 * Creates a showcase of all domain-specific empty states
 */
export function createFakeEmptyStateShowcase(): Record<
  string,
  | FakeComingSoonEmptyState
  | FakeEmptyState
  | FakeErrorEmptyState
  | FakeFeatureEmptyState
  | FakeNoDataEmptyState
  | FakeNoPermissionsEmptyState
  | FakeNoResultsEmptyState
  | FakeOfflineEmptyState
  | FakeOnboardingEmptyState
> {
  return {
    generic: createFakeEmptyState(),
    noDataProjects: createFakeNoDataEmptyState(i18n.t('factory.empty.entityProjects', 'projects')),
    noDataTasks: createFakeNoDataEmptyState(i18n.t('factory.empty.entityTasks', 'tasks')),
    noDataUsers: createFakeNoDataEmptyState(i18n.t('factory.empty.entityUsers', 'users')),
    noResults: createFakeNoResultsEmptyState(i18n.t('factory.empty.searchTerm', 'search term')),
    error404: createFakeErrorEmptyState(404),
    error500: createFakeErrorEmptyState(500),
    onboarding: createFakeOnboardingEmptyState(1, 5),
    feature: createFakeFeatureEmptyState(
      i18n.t('factory.empty.smartRecommendations', 'Smart Recommendations')
    ),
    offline: createFakeOfflineEmptyState(),
    noPermissions: createFakeNoPermissionsEmptyState(),
    comingSoon: createFakeComingSoonEmptyState(),
    inbox: createFakeInboxEmptyState(),
    notifications: createFakeNotificationsEmptyState(),
    cart: createFakeCartEmptyState(),
    favorites: createFakeFavoritesEmptyState(),
    calendar: createFakeCalendarEmptyState(),
  };
}
