import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ TYPE DEFINITIONS ============

/** Avatar size variant */
export type AvatarSize = 'lg' | 'md' | 'sm' | 'xl' | 'xs';

/** Avatar status for online/presence indicators */
export type AvatarStatus = 'away' | 'busy' | 'offline' | 'online';

/** Avatar indicator variant */
export type AvatarIndicatorVariant = 'danger' | 'success' | 'warning';

/** Avatar indicator position */
export type AvatarIndicatorPosition = 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';

/** Avatar shape variant */
export type AvatarShape = 'circle' | 'rounded' | 'square';

/** Interface for fake avatar data */
export interface FakeAvatar {
  /** Email address */
  email: string;
  /** Fallback initials */
  fallback: string;
  /** Unique identifier */
  id: string;
  /** Full name */
  name: string;
  /** Avatar shape */
  shape?: AvatarShape;
  /** Avatar size */
  size?: AvatarSize;
  /** Image source URL */
  src: string;
  /** Online status */
  status: AvatarStatus;
}

/** Interface for avatar group data */
export interface FakeAvatarGroup {
  /** Avatar items */
  avatars: FakeAvatar[];
  /** Unique identifier */
  id: string;
  /** Maximum to display before showing count */
  maxDisplay: number;
  /** Group name/title */
  name: string;
  /** Total count (may be more than avatars array) */
  total: number;
}

/** Interface for avatar configuration */
export interface FakeAvatarConfig {
  /** Indicator position */
  indicatorPosition: AvatarIndicatorPosition;
  /** Indicator variant */
  indicatorVariant?: AvatarIndicatorVariant;
  /** Avatar shape */
  shape: AvatarShape;
  /** Whether to show fallback delay */
  showFallbackDelay: boolean;
  /** Whether to show status indicator */
  showIndicator: boolean;
  /** Avatar size */
  size: AvatarSize;
}

// ============ CONSTANTS FOR ITERATION ============

/** Default indicator position */
const DEFAULT_INDICATOR_POSITION: AvatarIndicatorPosition = 'bottom-end';

/** All avatar size options */
export const AVATAR_SIZES: AvatarSize[] = ['lg', 'md', 'sm', 'xl', 'xs'];

/** All avatar status options */
export const AVATAR_STATUSES: AvatarStatus[] = ['away', 'busy', 'offline', 'online'];

/** All avatar indicator variants */
export const AVATAR_INDICATOR_VARIANTS: AvatarIndicatorVariant[] = ['danger', 'success', 'warning'];

/** All avatar indicator positions */
export const AVATAR_INDICATOR_POSITIONS: AvatarIndicatorPosition[] = [
  DEFAULT_INDICATOR_POSITION,
  'bottom-start',
  'top-end',
  'top-start',
];

/** All avatar shapes */
export const AVATAR_SHAPES: AvatarShape[] = ['circle', 'rounded', 'square'];

/** Size class mappings */
export const AVATAR_SIZE_CLASSES: Record<AvatarSize, string> = {
  lg: 'size-14',
  md: 'size-10',
  sm: 'size-8',
  xl: 'size-20',
  xs: 'size-6',
};

/** Status to indicator variant mapping */
export const AVATAR_STATUS_TO_INDICATOR: Record<AvatarStatus, AvatarIndicatorVariant | undefined> =
  {
    away: 'warning',
    busy: 'danger',
    offline: undefined,
    online: 'success',
  };

/** Common avatar image sources for deterministic tests */
export const AVATAR_IMAGE_SOURCES = [
  '/images/avatars/01.png',
  '/images/avatars/02.png',
  '/images/avatars/03.png',
  '/images/avatars/04.png',
  '/images/avatars/05.png',
  '/images/avatars/06.png',
  '/images/avatars/07.png',
  '/images/avatars/08.png',
];

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake avatar
 * @param overrides - Optional partial overrides for the generated avatar
 * @returns A fake avatar
 */
export function createFakeAvatar(overrides?: Partial<FakeAvatar>): FakeAvatar {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const name = `${firstName} ${lastName}`;

  return {
    id: faker.string.uuid(),
    name,
    email: faker.internet.email({ firstName, lastName }),
    src: faker.helpers.arrayElement(AVATAR_IMAGE_SOURCES),
    fallback: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
    status: faker.helpers.arrayElement(AVATAR_STATUSES),
    size: faker.helpers.maybe(() => faker.helpers.arrayElement(AVATAR_SIZES), { probability: 0.5 }),
    shape: faker.helpers.maybe(() => faker.helpers.arrayElement(AVATAR_SHAPES), {
      probability: 0.3,
    }),
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake avatars
 * @param count - Number of avatars to generate
 * @returns Array of fake avatars
 */
export function createFakeAvatars(count: number): FakeAvatar[] {
  return Array.from({ length: count }, () => createFakeAvatar());
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates an online user avatar
 * @param name - Optional user name
 * @returns An online user avatar
 */
export function createFakeOnlineAvatar(name?: string): FakeAvatar {
  const firstName = name?.split(' ')[0] ?? faker.person.firstName();
  const lastName = name?.split(' ')[1] ?? faker.person.lastName();

  return createFakeAvatar({
    name: name ?? `${firstName} ${lastName}`,
    status: 'online',
    fallback: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
  });
}

/**
 * Creates an away user avatar
 * @returns An away user avatar
 */
export function createFakeAwayAvatar(): FakeAvatar {
  return createFakeAvatar({ status: 'away' });
}

/**
 * Creates a busy user avatar
 * @returns A busy user avatar
 */
export function createFakeBusyAvatar(): FakeAvatar {
  return createFakeAvatar({ status: 'busy' });
}

/**
 * Creates an offline user avatar
 * @returns An offline user avatar
 */
export function createFakeOfflineAvatar(): FakeAvatar {
  return createFakeAvatar({ status: 'offline' });
}

/**
 * Creates a fallback-only avatar (no image)
 * @param initials - Custom initials
 * @returns A fallback-only avatar
 */
export function createFakeFallbackAvatar(initials?: string): FakeAvatar {
  return createFakeAvatar({
    src: '', // Empty source forces fallback
    fallback: initials ?? faker.string.alpha({ length: 2, casing: 'upper' }),
  });
}

/**
 * Creates avatars for all status types
 * @returns Array with one avatar for each status
 */
export function createFakeAvatarsByStatus(): FakeAvatar[] {
  return AVATAR_STATUSES.map((status) =>
    createFakeAvatar({
      status,
      name: `${status.charAt(0).toUpperCase() + status.slice(1)} User`,
    })
  );
}

/**
 * Creates an avatar group
 * @param count - Number of avatars in the group
 * @param maxDisplay - Maximum to display before showing count
 * @returns An avatar group
 */
export function createFakeAvatarGroup(count = 8, maxDisplay = 4): FakeAvatarGroup {
  const avatars = createFakeAvatars(count);

  return {
    id: faker.string.uuid(),
    name: `${faker.company.name()} Team`,
    avatars: avatars.slice(0, maxDisplay),
    total: count,
    maxDisplay,
  };
}

/**
 * Creates a team member list with specific roles
 * @returns Array of avatars with team roles
 */
export function createFakeTeamAvatars(): ({ role: string } & FakeAvatar)[] {
  const roles = [
    i18n.t('factory.avatar.teamLead', 'Team Lead'),
    i18n.t('factory.avatar.developer', 'Developer'),
    i18n.t('factory.avatar.designer', 'Designer'),
    i18n.t('factory.avatar.qaEngineer', 'QA Engineer'),
    i18n.t('factory.avatar.productManager', 'Product Manager'),
  ];

  return roles.map((role) => ({
    ...createFakeAvatar({ status: faker.helpers.arrayElement(['online', 'away']) }),
    role,
  }));
}

/**
 * Creates avatars for a mention/selection list
 * @param count - Number of avatars
 * @returns Array of avatars suitable for selection
 */
export function createFakeMentionAvatars(count = 10): FakeAvatar[] {
  return Array.from({ length: count }, (_, i) => ({
    ...createFakeAvatar(),
    src: AVATAR_IMAGE_SOURCES[i % AVATAR_IMAGE_SOURCES.length],
  }));
}

// ============ MATRIX FACTORY ============

/**
 * Creates a matrix of avatars for visual regression testing
 * across all size and status combinations
 * @returns 2D array of avatars [size][status]
 */
export function createFakeAvatarMatrix(): FakeAvatar[][] {
  return AVATAR_SIZES.map((size) =>
    AVATAR_STATUSES.map((status) => ({
      id: `${size}-${status}`,
      name: `${size.toUpperCase()} ${status}`,
      email: faker.internet.email(),
      src: faker.helpers.arrayElement(AVATAR_IMAGE_SOURCES),
      fallback: `${size.charAt(0).toUpperCase()}${status.charAt(0).toUpperCase()}`,
      status,
      size,
    }))
  );
}

/**
 * Creates avatar configuration for different scenarios
 * @param scenario - Scenario name
 * @returns Avatar configuration
 */
export function createFakeAvatarConfig(
  scenario: 'default' | 'group' | 'withIndicator' | 'withoutImage' = 'default'
): FakeAvatarConfig {
  const configs: Record<string, FakeAvatarConfig> = {
    default: {
      size: 'md',
      shape: 'circle',
      showIndicator: false,
      indicatorPosition: DEFAULT_INDICATOR_POSITION,
      showFallbackDelay: false,
    },
    withIndicator: {
      size: 'md',
      shape: 'circle',
      showIndicator: true,
      indicatorPosition: DEFAULT_INDICATOR_POSITION,
      indicatorVariant: 'success',
      showFallbackDelay: false,
    },
    group: {
      size: 'md',
      shape: 'circle',
      showIndicator: false,
      indicatorPosition: DEFAULT_INDICATOR_POSITION,
      showFallbackDelay: false,
    },
    withoutImage: {
      size: 'md',
      shape: 'circle',
      showIndicator: false,
      indicatorPosition: DEFAULT_INDICATOR_POSITION,
      showFallbackDelay: true,
    },
  };

  return configs[scenario];
}
