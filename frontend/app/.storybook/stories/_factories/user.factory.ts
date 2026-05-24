import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/** User role variant */
export type UserRole = 'admin' | 'editor' | 'guest' | 'manager' | 'moderator' | 'user' | 'viewer';

/** User status variant */
export type UserStatus = 'active' | 'banned' | 'inactive' | 'pending' | 'suspended';

/** User verification level */
export type UserVerification = 'basic' | 'enhanced' | 'none' | 'verified';

/** User subscription tier */
export type UserTier = 'enterprise' | 'free' | 'premium' | 'pro';

/** User avatar size */
export type UserAvatarSize = 'lg' | 'md' | 'sm' | 'xl' | 'xs';

/** User presence status */
export type PresenceStatus = 'away' | 'busy' | 'dnd' | 'offline' | 'online';

// ═══════════════════════════════════════════════════════════════
// INTERFACE (Shape of Generated Data)
// ═══════════════════════════════════════════════════════════════

export interface FakeUser {
  avatar: string;
  avatarFallback: string;
  bio: string;
  createdAt: string;
  department: string;
  email: string;
  emailVerified: boolean;
  id: string;
  isOnline: boolean;
  lastActiveAt: string;
  locale: string;
  metadata?: Record<string, unknown>;
  name: string;
  phone: string;
  presence: PresenceStatus;
  role: UserRole;
  status: UserStatus;
  tier: UserTier;
  timezone: string;
  twoFactorEnabled: boolean;
  updatedAt: string;
  username: string;
  verification: UserVerification;
}

export interface FakeUserSession {
  deviceId: string;
  expiresAt: string;
  ipAddress: string;
  lastRefreshedAt: string;
  refreshToken: string;
  sessionId: string;
  token: string;
  user: FakeUser;
  userAgent: string;
}

export interface FakeUserProfile extends FakeUser {
  coverImage: string;
  followers: number;
  following: number;
  isFollowing: boolean;
  isVerified: boolean;
  joinedAt: string;
  location: string;
  posts: number;
  pronouns: string;
  socialLinks: FakeSocialLink[];
  website: string;
}

export interface FakeSocialLink {
  platform: string;
  url: string;
  username: string;
}

export interface FakeUserNotificationSettings {
  email: boolean;
  marketing: boolean;
  push: boolean;
  security: boolean;
  sms: boolean;
  userId: string;
  weekly: boolean;
}

export interface FakeUserPermissions {
  canComment: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canInvite: boolean;
  canManageUsers: boolean;
  canPublish: boolean;
  canViewAnalytics: boolean;
  role: UserRole;
  userId: string;
}

export interface FakeUserActivity {
  action: string;
  id: string;
  ipAddress: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  userId: string;
}

export interface FakeUserGroup {
  description: string;
  id: string;
  memberCount: number;
  members: FakeUser[];
  name: string;
  ownerId: string;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS (Used in Stories for Iteration)
// ═══════════════════════════════════════════════════════════════

export const USER_ROLES: UserRole[] = [
  'admin',
  'manager',
  'moderator',
  'editor',
  'user',
  'viewer',
  'guest',
];

export const USER_STATUSES: UserStatus[] = ['active', 'inactive', 'pending', 'suspended', 'banned'];

export const USER_VERIFICATIONS: UserVerification[] = ['none', 'basic', 'verified', 'enhanced'];

export const USER_TIERS: UserTier[] = ['free', 'pro', 'premium', 'enterprise'];

export const USER_AVATAR_SIZES: UserAvatarSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

export const PRESENCE_STATUSES: PresenceStatus[] = ['online', 'away', 'busy', 'dnd', 'offline'];

export const USER_DEPARTMENTS = [
  i18n.t('factory.user.engineering', 'Engineering'),
  i18n.t('factory.user.design', 'Design'),
  i18n.t('factory.user.marketing', 'Marketing'),
  i18n.t('factory.user.sales', 'Sales'),
  i18n.t('factory.user.support', 'Support'),
  'HR',
  i18n.t('factory.user.finance', 'Finance'),
  i18n.t('factory.user.legal', 'Legal'),
  i18n.t('factory.user.operations', 'Operations'),
  i18n.t('factory.user.product', 'Product'),
];

export const SOCIAL_PLATFORMS = [
  i18n.t('factory.user.twitter', 'Twitter'),
  'LinkedIn',
  'GitHub',
  i18n.t('factory.user.instagram', 'Instagram'),
  i18n.t('factory.user.facebook', 'Facebook'),
  'YouTube',
  'TikTok',
  i18n.t('factory.user.dribbble', 'Dribbble'),
  i18n.t('factory.user.behance', 'Behance'),
];

export const USER_ACTIONS = [
  'login',
  'logout',
  'password_change',
  'profile_update',
  'settings_change',
  'file_upload',
  'post_create',
  'comment_add',
  'subscription_change',
];

// ═══════════════════════════════════════════════════════════════
// SINGLE ITEM FACTORY
// ═══════════════════════════════════════════════════════════════

export function createFakeUser(overrides?: Partial<FakeUser>): FakeUser {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const name = `${firstName} ${lastName}`;

  return {
    id: faker.string.uuid(),
    name,
    username: faker.internet.username({ firstName, lastName }).toLowerCase(),
    email: faker.internet.email({ firstName, lastName }),
    emailVerified: faker.datatype.boolean({ probability: 0.8 }),
    avatar: faker.image.avatar(),
    avatarFallback: `${firstName[0]}${lastName[0]}`,
    role: faker.helpers.arrayElement(USER_ROLES),
    status: faker.helpers.arrayElement(USER_STATUSES),
    verification: faker.helpers.arrayElement(USER_VERIFICATIONS),
    tier: faker.helpers.arrayElement(USER_TIERS),
    presence: faker.helpers.arrayElement(PRESENCE_STATUSES),
    isOnline: faker.datatype.boolean({ probability: 0.4 }),
    department: faker.helpers.arrayElement(USER_DEPARTMENTS),
    phone: faker.phone.number(),
    bio: faker.lorem.sentence({ min: 5, max: 15 }),
    timezone: faker.location.timeZone(),
    locale: faker.helpers.arrayElement(['en-US', 'en-GB', 'ja-JP', 'de-DE', 'fr-FR', 'es-ES']),
    twoFactorEnabled: faker.datatype.boolean({ probability: 0.3 }),
    createdAt: faker.date.past({ years: 3 }).toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    lastActiveAt: faker.date.recent({ days: 7 }).toISOString(),
    metadata: faker.helpers.maybe(
      () => ({
        source: faker.helpers.arrayElement(['signup', 'invite', 'import', 'sso']),
        campaign: faker.helpers.maybe(() => faker.string.alphanumeric(8), { probability: 0.3 }),
      }),
      { probability: 0.2 }
    ),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// BULK FACTORY (For Lists/Tables)
// ═══════════════════════════════════════════════════════════════

export function createFakeUsers(count: number, overrides?: Partial<FakeUser>): FakeUser[] {
  return Array.from({ length: count }, () => createFakeUser(overrides));
}

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED FACTORIES (For Specific Scenarios)
// ═══════════════════════════════════════════════════════════════

/** Create an admin user */
export function createFakeAdminUser(): FakeUser {
  return createFakeUser({
    role: 'admin',
    status: 'active',
    verification: 'enhanced',
    tier: 'enterprise',
    twoFactorEnabled: true,
    emailVerified: true,
  });
}

/** Create a guest user */
export function createFakeGuestUser(): FakeUser {
  return createFakeUser({
    role: 'guest',
    status: 'active',
    verification: 'none',
    tier: 'free',
    twoFactorEnabled: false,
    emailVerified: false,
  });
}

/** Create a pending user (awaiting verification) */
export function createFakePendingUser(): FakeUser {
  return createFakeUser({
    status: 'pending',
    emailVerified: false,
    verification: 'none',
  });
}

/** Create a suspended user */
export function createFakeSuspendedUser(): FakeUser {
  return createFakeUser({
    status: 'suspended',
    isOnline: false,
    presence: 'offline',
  });
}

/** Create a banned user */
export function createFakeBannedUser(): FakeUser {
  return createFakeUser({
    status: 'banned',
    isOnline: false,
    presence: 'offline',
  });
}

/** Create an online user */
export function createFakeOnlineUser(): FakeUser {
  return createFakeUser({
    isOnline: true,
    presence: 'online',
    status: 'active',
    lastActiveAt: new Date().toISOString(),
  });
}

/** Create an offline user */
export function createFakeOfflineUser(): FakeUser {
  return createFakeUser({
    isOnline: false,
    presence: 'offline',
    lastActiveAt: faker.date.past({ years: 1 }).toISOString(),
  });
}

/** Create a premium user */
export function createFakePremiumUser(): FakeUser {
  return createFakeUser({
    tier: 'premium',
    status: 'active',
    verification: 'verified',
    emailVerified: true,
  });
}

/** Create an enterprise user */
export function createFakeEnterpriseUser(): FakeUser {
  return createFakeUser({
    tier: 'enterprise',
    role: 'manager',
    status: 'active',
    verification: 'enhanced',
    twoFactorEnabled: true,
    emailVerified: true,
  });
}

/** Create users with all roles */
export function createFakeUsersWithAllRoles(): FakeUser[] {
  return USER_ROLES.map((role) => createFakeUser({ role, status: 'active' }));
}

/** Create users with all statuses */
export function createFakeUsersWithAllStatuses(): FakeUser[] {
  return USER_STATUSES.map((status) => createFakeUser({ status }));
}

/** Create users with all tiers */
export function createFakeUsersWithAllTiers(): FakeUser[] {
  return USER_TIERS.map((tier) => createFakeUser({ tier, status: 'active' }));
}

/** Create users with all presence statuses */
export function createFakeUsersWithAllPresence(): FakeUser[] {
  return PRESENCE_STATUSES.map((presence) =>
    createFakeUser({ presence, isOnline: presence === 'online' })
  );
}

// ═══════════════════════════════════════════════════════════════
// SESSION FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeUserSession(overrides?: Partial<FakeUserSession>): FakeUserSession {
  return {
    user: createFakeUser(),
    sessionId: faker.string.uuid(),
    token: faker.string.alphanumeric(64),
    refreshToken: faker.string.alphanumeric(128),
    expiresAt: faker.date.future().toISOString(),
    lastRefreshedAt: faker.date.recent().toISOString(),
    deviceId: faker.string.uuid(),
    userAgent: faker.internet.userAgent(),
    ipAddress: faker.internet.ip(),
    ...overrides,
  };
}

export function createFakeUserSessions(count: number): FakeUserSession[] {
  return Array.from({ length: count }, () => createFakeUserSession());
}

/** Create an expired session */
export function createFakeExpiredSession(): FakeUserSession {
  return createFakeUserSession({
    expiresAt: faker.date.past().toISOString(),
  });
}

/** Create a fresh session */
export function createFakeFreshSession(): FakeUserSession {
  return createFakeUserSession({
    expiresAt: faker.date.future({ years: 1 }).toISOString(),
    lastRefreshedAt: new Date().toISOString(),
  });
}

// ═══════════════════════════════════════════════════════════════
// PROFILE FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeSocialLink(overrides?: Partial<FakeSocialLink>): FakeSocialLink {
  const platform = faker.helpers.arrayElement(SOCIAL_PLATFORMS);
  return {
    platform,
    username: faker.internet.username(),
    url: faker.internet.url(),
    ...overrides,
  };
}

export function createFakeSocialLinks(count: number): FakeSocialLink[] {
  return Array.from({ length: count }, () => createFakeSocialLink());
}

export function createFakeUserProfile(overrides?: Partial<FakeUserProfile>): FakeUserProfile {
  return {
    ...createFakeUser(),
    followers: faker.number.int({ min: 0, max: 100_000 }),
    following: faker.number.int({ min: 0, max: 5000 }),
    posts: faker.number.int({ min: 0, max: 1000 }),
    location: `${faker.location.city()}, ${faker.location.country()}`,
    website: faker.internet.url(),
    joinedAt: faker.date.past({ years: 5 }).toISOString(),
    coverImage: faker.image.urlPicsumPhotos({ width: 1200, height: 400 }),
    isFollowing: faker.datatype.boolean(),
    isVerified: faker.datatype.boolean({ probability: 0.2 }),
    pronouns: faker.helpers.arrayElement(['he/him', 'she/her', 'they/them', '']),
    socialLinks: createFakeSocialLinks(faker.number.int({ min: 0, max: 4 })),
    ...overrides,
  };
}

export function createFakeUserProfiles(count: number): FakeUserProfile[] {
  return Array.from({ length: count }, () => createFakeUserProfile());
}

/** Create a popular user profile */
export function createFakePopularUserProfile(): FakeUserProfile {
  return createFakeUserProfile({
    followers: faker.number.int({ min: 50_000, max: 1_000_000 }),
    posts: faker.number.int({ min: 500, max: 5000 }),
    isVerified: true,
    tier: 'premium',
    verification: 'verified',
  });
}

/** Create a new user profile */
export function createFakeNewUserProfile(): FakeUserProfile {
  return createFakeUserProfile({
    followers: faker.number.int({ min: 0, max: 50 }),
    following: faker.number.int({ min: 0, max: 100 }),
    posts: faker.number.int({ min: 0, max: 5 }),
    joinedAt: faker.date.recent({ days: 30 }).toISOString(),
    socialLinks: [],
  });
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeUserNotificationSettings(
  overrides?: Partial<FakeUserNotificationSettings>
): FakeUserNotificationSettings {
  return {
    userId: faker.string.uuid(),
    email: faker.datatype.boolean({ probability: 0.8 }),
    push: faker.datatype.boolean({ probability: 0.6 }),
    sms: faker.datatype.boolean({ probability: 0.3 }),
    marketing: faker.datatype.boolean({ probability: 0.4 }),
    security: true,
    weekly: faker.datatype.boolean({ probability: 0.5 }),
    ...overrides,
  };
}

export function createFakeUserPermissions(
  overrides?: Partial<FakeUserPermissions>
): FakeUserPermissions {
  const role = overrides?.role ?? faker.helpers.arrayElement(USER_ROLES);
  const isAdmin = role === 'admin';
  const isManager = role === 'admin' || role === 'manager';
  const isEditor = isManager || role === 'editor' || role === 'moderator';

  return {
    userId: faker.string.uuid(),
    role,
    canCreate: isEditor,
    canEdit: isEditor,
    canDelete: isManager,
    canPublish: isEditor,
    canComment: role !== 'guest',
    canInvite: isManager,
    canManageUsers: isAdmin,
    canViewAnalytics: isManager,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeUserActivity(overrides?: Partial<FakeUserActivity>): FakeUserActivity {
  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    action: faker.helpers.arrayElement(USER_ACTIONS),
    timestamp: faker.date.recent().toISOString(),
    ipAddress: faker.internet.ip(),
    metadata: faker.helpers.maybe(
      () => ({
        browser: faker.internet.userAgent(),
        country: faker.location.country(),
      }),
      { probability: 0.5 }
    ),
    ...overrides,
  };
}

export function createFakeUserActivities(count: number): FakeUserActivity[] {
  return Array.from({ length: count }, () => createFakeUserActivity());
}

// ═══════════════════════════════════════════════════════════════
// GROUP FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeUserGroup(overrides?: Partial<FakeUserGroup>): FakeUserGroup {
  const memberCount = overrides?.memberCount ?? faker.number.int({ min: 2, max: 20 });
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    description: faker.company.catchPhrase(),
    ownerId: faker.string.uuid(),
    memberCount,
    members: createFakeUsers(Math.min(memberCount, 5)),
    ...overrides,
  };
}

export function createFakeUserGroups(count: number): FakeUserGroup[] {
  return Array.from({ length: count }, () => createFakeUserGroup());
}

// ═══════════════════════════════════════════════════════════════
// MATRIX FACTORIES (For Visual Regression)
// ═══════════════════════════════════════════════════════════════

/** Create role × status matrix for visual testing */
export function createFakeUserRoleStatusMatrix(): FakeUser[][] {
  return USER_ROLES.map((role) => USER_STATUSES.map((status) => createFakeUser({ role, status })));
}

/** Create role × tier matrix for visual testing */
export function createFakeUserRoleTierMatrix(): FakeUser[][] {
  return USER_ROLES.map((role) => USER_TIERS.map((tier) => createFakeUser({ role, tier })));
}

/** Create status × presence matrix for visual testing */
export function createFakeUserStatusPresenceMatrix(): FakeUser[][] {
  return USER_STATUSES.map((status) =>
    PRESENCE_STATUSES.map((presence) =>
      createFakeUser({ status, presence, isOnline: presence === 'online' })
    )
  );
}

/** Create verification × tier matrix for visual testing */
export function createFakeUserVerificationTierMatrix(): FakeUser[][] {
  return USER_VERIFICATIONS.map((verification) =>
    USER_TIERS.map((tier) => createFakeUser({ verification, tier }))
  );
}

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE FEATURE FACTORIES
// ═══════════════════════════════════════════════════════════════

/** Create a fully featured enterprise user with all bells and whistles */
export function createFakeUltimateEnterpriseUser(): FakeUser {
  return createFakeUser({
    role: 'admin',
    status: 'active',
    verification: 'enhanced',
    tier: 'enterprise',
    presence: 'online',
    isOnline: true,
    twoFactorEnabled: true,
    emailVerified: true,
    metadata: {
      source: 'enterprise_sso',
      ssoProvider: 'okta',
      department: i18n.t('factory.user.executive', 'Executive'),
      employeeId: faker.string.alphanumeric(8),
    },
  });
}

/** Create all enterprise feature combinations for testing */
export function createFakeEnterpriseUserSet(): FakeUser[] {
  return [
    createFakeAdminUser(),
    createFakeEnterpriseUser(),
    createFakePremiumUser(),
    createFakeOnlineUser(),
    createFakePendingUser(),
    createFakeSuspendedUser(),
  ];
}

/** Create a team with diverse user roles */
export function createFakeTeam(size: number = 10): FakeUser[] {
  const team: FakeUser[] = [
    createFakeUser({ role: 'admin', status: 'active' }),
    createFakeUser({ role: 'manager', status: 'active' }),
  ];

  const remainingSize = Math.max(0, size - 2);
  for (let i = 0; i < remainingSize; i++) {
    team.push(
      createFakeUser({
        role: faker.helpers.arrayElement(['editor', 'user', 'viewer']),
        status: 'active',
      })
    );
  }

  return team;
}
