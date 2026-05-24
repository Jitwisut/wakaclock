import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/** Notification type variant */
export type NotificationType = 'error' | 'info' | 'success' | 'warning';

/** Notification priority */
export type NotificationPriority = 'critical' | 'high' | 'low' | 'medium' | 'urgent';

/** Notification category */
export type NotificationCategory =
  | 'account'
  | 'billing'
  | 'marketing'
  | 'mention'
  | 'message'
  | 'security'
  | 'social'
  | 'system'
  | 'update';

/** Notification delivery channel */
export type NotificationChannel = 'email' | 'in_app' | 'push' | 'sms';

/** Notification status */
export type NotificationStatus = 'delivered' | 'failed' | 'pending' | 'read' | 'unread';

// ═══════════════════════════════════════════════════════════════
// INTERFACE (Shape of Generated Data)
// ═══════════════════════════════════════════════════════════════

export interface FakeNotification {
  action?: {
    label: string;
    url: string;
  };
  avatar?: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  createdAt: string;
  description: string;
  expiresAt?: string;
  groupId?: string;
  id: string;
  metadata?: Record<string, unknown>;
  priority: NotificationPriority;
  read: boolean;
  readAt?: string;
  sender?: {
    avatar?: string;
    id: string;
    name: string;
  };
  status: NotificationStatus;
  title: string;
  type: NotificationType;
  updatedAt: string;
}

export interface FakeNotificationsResponse {
  hasMore: boolean;
  nextCursor?: string;
  notifications: FakeNotification[];
  total: number;
  unreadCount: number;
}

export interface FakeNotificationPreferences {
  categories: Record<NotificationCategory, boolean>;
  channels: Record<NotificationChannel, boolean>;
  digest: 'daily' | 'immediately' | 'none' | 'weekly';
  doNotDisturb: {
    enabled: boolean;
    end: string;
    start: string;
  };
  id: string;
  userId: string;
}

export interface FakeNotificationGroup {
  count: number;
  id: string;
  latestNotification: FakeNotification;
  notifications: FakeNotification[];
  title: string;
}

export interface FakeToast {
  action?: {
    label: string;
    onClick: () => void;
  };
  description?: string;
  dismissable: boolean;
  duration?: number;
  icon?: string;
  id: string;
  position:
    | 'bottom-center'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-center'
    | 'top-left'
    | 'top-right';
  title: string;
  type: NotificationType;
}

export interface FakeActivity {
  action: string;
  id: string;
  metadata?: Record<string, unknown>;
  target: string;
  targetType: string;
  timestamp: string;
  user: {
    avatar: string;
    id: string;
    name: string;
  };
}

export interface FakeActivityFeed {
  activities: FakeActivity[];
  hasMore: boolean;
  nextCursor?: string;
  total: number;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS (Used in Stories for Iteration)
// ═══════════════════════════════════════════════════════════════

export const NOTIFICATION_TYPES: NotificationType[] = ['info', 'success', 'warning', 'error'];

export const NOTIFICATION_PRIORITIES: NotificationPriority[] = [
  'low',
  'medium',
  'high',
  'urgent',
  'critical',
];

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'system',
  'message',
  'mention',
  'social',
  'billing',
  'security',
  'update',
  'marketing',
  'account',
];

export const NOTIFICATION_CHANNELS: NotificationChannel[] = ['in_app', 'email', 'push', 'sms'];

export const NOTIFICATION_STATUSES: NotificationStatus[] = [
  'pending',
  'delivered',
  'read',
  'unread',
  'failed',
];

export const TOAST_POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;

export const NOTIFICATION_TITLES = [
  i18n.t('factory.notification.newMessageReceived', 'New message received'),
  i18n.t('factory.notification.yourOrderHasBeenShipped', 'Your order has been shipped'),
  i18n.t('factory.notification.paymentSuccessful', 'Payment successful'),
  i18n.t('factory.notification.passwordChanged', 'Password changed'),
  i18n.t('factory.notification.securityAlert', 'Security alert'),
  i18n.t('factory.notification.newFollower', 'New follower'),
  i18n.t('factory.notification.commentOnYourPost', 'Comment on your post'),
  i18n.t('factory.notification.subscriptionRenewed', 'Subscription renewed'),
  i18n.t('factory.notification.systemMaintenance', 'System maintenance'),
  i18n.t('factory.notification.featureUpdateAvailable', 'Feature update available'),
  i18n.t('factory.notification.teamInvitation', 'Team invitation'),
  i18n.t('factory.notification.fileSharedWithYou', 'File shared with you'),
  i18n.t('factory.notification.meetingReminder', 'Meeting reminder'),
  i18n.t('factory.notification.weeklyReportReady', 'Weekly report ready'),
  i18n.t('factory.notification.accountVerificationNeeded', 'Account verification needed'),
];

export const ACTIVITY_ACTIONS = [
  'created',
  'updated',
  'deleted',
  i18n.t('factory.notification.commentedOn', 'commented on'),
  'assigned',
  'completed',
  'archived',
  'shared',
  i18n.t('factory.notification.mentionedYouIn', 'mentioned you in'),
  'liked',
  'followed',
  'uploaded',
  'approved',
  'rejected',
];

export const ACTIVITY_TARGETS = [
  'task',
  'document',
  'project',
  'file',
  'comment',
  'issue',
  'milestone',
  'post',
  'invoice',
  'report',
];

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getStatusFromRead(isRead: boolean): NotificationStatus {
  if (isRead) return 'read';
  return 'unread';
}

// ═══════════════════════════════════════════════════════════════
// SINGLE ITEM FACTORY
// ═══════════════════════════════════════════════════════════════

export function createFakeNotification(overrides?: Partial<FakeNotification>): FakeNotification {
  const hasAction = faker.datatype.boolean({ probability: 0.3 });
  const hasSender = faker.datatype.boolean({ probability: 0.5 });
  const read = overrides?.read ?? faker.datatype.boolean();
  const type = overrides?.type ?? faker.helpers.arrayElement(NOTIFICATION_TYPES);

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement(NOTIFICATION_TITLES),
    description: faker.lorem.sentence({ min: 5, max: 15 }),
    type,
    priority: faker.helpers.arrayElement(NOTIFICATION_PRIORITIES),
    category: faker.helpers.arrayElement(NOTIFICATION_CATEGORIES),
    channel: faker.helpers.arrayElement(NOTIFICATION_CHANNELS),
    status: getStatusFromRead(read),
    read,
    readAt: read ? faker.date.recent().toISOString() : undefined,
    createdAt: faker.date.recent({ days: 7 }).toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    expiresAt: faker.helpers.maybe(() => faker.date.future().toISOString(), { probability: 0.2 }),
    action: hasAction
      ? {
          label: faker.helpers.arrayElement([
            i18n.t('factory.notification.view', 'View'),
            i18n.t('factory.notification.open', 'Open'),
            i18n.t('factory.notification.details', 'Details'),
            i18n.t('factory.notification.learnMore', 'Learn more'),
            i18n.t('factory.notification.dismiss', 'Dismiss'),
          ]),
          url: `/${faker.lorem.slug()}`,
        }
      : undefined,
    sender: hasSender
      ? {
          id: faker.string.uuid(),
          name: faker.person.fullName(),
          avatar: faker.image.avatar(),
        }
      : undefined,
    avatar: faker.helpers.maybe(() => faker.image.avatar(), { probability: 0.3 }),
    groupId: faker.helpers.maybe(() => `group-${faker.string.alphanumeric(6)}`, {
      probability: 0.2,
    }),
    metadata: faker.helpers.maybe(
      () => ({
        source: faker.helpers.arrayElement(['web', 'mobile', 'api', 'system']),
        version: faker.system.semver(),
      }),
      { probability: 0.3 }
    ),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// BULK FACTORY (For Lists/Tables)
// ═══════════════════════════════════════════════════════════════

export function createFakeNotifications(
  count: number,
  overrides?: Partial<FakeNotification>
): FakeNotification[] {
  return Array.from({ length: count }, () => createFakeNotification(overrides));
}

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED FACTORIES (For Specific Scenarios)
// ═══════════════════════════════════════════════════════════════

/** Create an info notification */
export function createFakeInfoNotification(): FakeNotification {
  return createFakeNotification({
    type: 'info',
    priority: 'low',
    category: 'system',
  });
}

/** Create a success notification */
export function createFakeSuccessNotification(): FakeNotification {
  return createFakeNotification({
    type: 'success',
    priority: 'medium',
  });
}

/** Create a warning notification */
export function createFakeWarningNotification(): FakeNotification {
  return createFakeNotification({
    type: 'warning',
    priority: 'high',
  });
}

/** Create an error notification */
export function createFakeErrorNotification(): FakeNotification {
  return createFakeNotification({
    type: 'error',
    priority: 'urgent',
    category: 'system',
  });
}

/** Create an unread notification */
export function createFakeUnreadNotification(): FakeNotification {
  return createFakeNotification({
    read: false,
    status: 'unread',
  });
}

/** Create a read notification */
export function createFakeReadNotification(): FakeNotification {
  return createFakeNotification({
    read: true,
    status: 'read',
    readAt: faker.date.recent().toISOString(),
  });
}

/** Create a security notification */
export function createFakeSecurityNotification(): FakeNotification {
  return createFakeNotification({
    type: 'warning',
    priority: 'critical',
    category: 'security',
    title: faker.helpers.arrayElement([
      i18n.t(
        'factory.notification.securityAlertNewLoginDetected',
        'Security alert: New login detected'
      ),
      i18n.t('factory.notification.passwordChangeRequested', 'Password change requested'),
      i18n.t(
        'factory.notification.twofactorAuthenticationEnabled',
        'Two-factor authentication enabled'
      ),
      i18n.t('factory.notification.unusualActivityDetected', 'Unusual activity detected'),
      i18n.t('factory.notification.sessionExpired', 'Session expired'),
    ]),
  });
}

/** Create a message notification */
export function createFakeMessageNotification(): FakeNotification {
  return createFakeNotification({
    type: 'info',
    category: 'message',
    title: i18n.t('factory.notification.newMessageReceived', 'New message received'),
    sender: {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      avatar: faker.image.avatar(),
    },
  });
}

/** Create a billing notification */
export function createFakeBillingNotification(): FakeNotification {
  return createFakeNotification({
    type: faker.helpers.arrayElement(['info', 'success', 'warning']),
    category: 'billing',
    title: faker.helpers.arrayElement([
      i18n.t('factory.notification.paymentSuccessful', 'Payment successful'),
      i18n.t('factory.notification.invoiceReady', 'Invoice ready'),
      i18n.t('factory.notification.subscriptionRenewed', 'Subscription renewed'),
      i18n.t('factory.notification.paymentFailed', 'Payment failed'),
      i18n.t('factory.notification.cardExpiringSoon', 'Card expiring soon'),
    ]),
  });
}

/** Create notifications with all types */
export function createFakeNotificationsWithAllTypes(): FakeNotification[] {
  return NOTIFICATION_TYPES.map((type) => createFakeNotification({ type }));
}

/** Create notifications with all priorities */
export function createFakeNotificationsWithAllPriorities(): FakeNotification[] {
  return NOTIFICATION_PRIORITIES.map((priority) => createFakeNotification({ priority }));
}

/** Create notifications with all categories */
export function createFakeNotificationsWithAllCategories(): FakeNotification[] {
  return NOTIFICATION_CATEGORIES.map((category) => createFakeNotification({ category }));
}

// ═══════════════════════════════════════════════════════════════
// RESPONSE FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeNotificationsResponse(
  count?: number,
  unreadRatio: number = 0.4
): FakeNotificationsResponse {
  const notifications = createFakeNotifications(count ?? faker.number.int({ min: 3, max: 15 }));
  const unreadCount = Math.floor(notifications.length * unreadRatio);

  // Mark first N as unread
  notifications.forEach((n, i) => {
    n.read = i >= unreadCount;
    n.status = n.read ? 'read' : 'unread';
    if (n.read) {
      n.readAt = faker.date.recent().toISOString();
    }
  });

  return {
    notifications,
    unreadCount,
    total: notifications.length,
    hasMore: faker.datatype.boolean({ probability: 0.3 }),
    nextCursor: faker.helpers.maybe(() => faker.string.alphanumeric(16), { probability: 0.3 }),
  };
}

/** Create an empty notifications response */
export function createFakeEmptyNotificationsResponse(): FakeNotificationsResponse {
  return {
    notifications: [],
    unreadCount: 0,
    total: 0,
    hasMore: false,
  };
}

/** Create notifications response with all unread */
export function createFakeAllUnreadNotificationsResponse(
  count: number = 5
): FakeNotificationsResponse {
  const notifications = createFakeNotifications(count, { read: false, status: 'unread' });
  return {
    notifications,
    unreadCount: count,
    total: count,
    hasMore: false,
  };
}

// ═══════════════════════════════════════════════════════════════
// PREFERENCES FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeNotificationPreferences(
  overrides?: Partial<FakeNotificationPreferences>
): FakeNotificationPreferences {
  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    channels: {
      in_app: true,
      email: faker.datatype.boolean({ probability: 0.8 }),
      push: faker.datatype.boolean({ probability: 0.6 }),
      sms: faker.datatype.boolean({ probability: 0.3 }),
    },
    categories: {
      system: true,
      message: true,
      mention: true,
      social: faker.datatype.boolean({ probability: 0.7 }),
      billing: true,
      security: true,
      update: faker.datatype.boolean({ probability: 0.8 }),
      marketing: faker.datatype.boolean({ probability: 0.4 }),
      account: true,
    },
    digest: faker.helpers.arrayElement(['immediately', 'daily', 'weekly', 'none']),
    doNotDisturb: {
      enabled: faker.datatype.boolean({ probability: 0.3 }),
      start: faker.helpers.arrayElement(['22:00', '23:00', '00:00']),
      end: faker.helpers.arrayElement(['06:00', '07:00', '08:00']),
    },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// GROUP FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeNotificationGroup(
  overrides?: Partial<FakeNotificationGroup>
): FakeNotificationGroup {
  const count = overrides?.count ?? faker.number.int({ min: 2, max: 10 });
  const notifications = createFakeNotifications(count);

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.notification.newComments', 'New comments'),
      i18n.t('factory.notification.unreadMessages', 'Unread messages'),
      i18n.t('factory.notification.teamUpdates', 'Team updates'),
      i18n.t('factory.notification.systemAlerts', 'System alerts'),
    ]),
    count,
    notifications,
    latestNotification: notifications[0],
    ...overrides,
  };
}

export function createFakeNotificationGroups(count: number): FakeNotificationGroup[] {
  return Array.from({ length: count }, () => createFakeNotificationGroup());
}

// ═══════════════════════════════════════════════════════════════
// TOAST FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeToast(overrides?: Partial<FakeToast>): FakeToast {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.notification.success', 'Success!'),
      i18n.t('factory.notification.errorOccurred', 'Error occurred'),
      i18n.t('factory.notification.warning', 'Warning'),
      i18n.t('factory.notification.info', 'Info'),
      i18n.t('factory.notification.saved', 'Saved'),
      i18n.t('factory.notification.deleted', 'Deleted'),
      i18n.t('factory.notification.updated', 'Updated'),
    ]),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.6 }),
    type: faker.helpers.arrayElement(NOTIFICATION_TYPES),
    duration: faker.helpers.arrayElement([3000, 5000, 7000, undefined]),
    dismissable: faker.datatype.boolean({ probability: 0.9 }),
    position: faker.helpers.arrayElement(TOAST_POSITIONS),
    icon: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['check', 'x', 'alert-triangle', 'info']),
      { probability: 0.5 }
    ),
    ...overrides,
  };
}

export function createFakeToasts(count: number): FakeToast[] {
  return Array.from({ length: count }, () => createFakeToast());
}

/** Create toast for all types */
export function createFakeToastsWithAllTypes(): FakeToast[] {
  return NOTIFICATION_TYPES.map((type) => createFakeToast({ type }));
}

/** Create a success toast */
export function createFakeSuccessToast(): FakeToast {
  return createFakeToast({
    type: 'success',
    title: i18n.t('factory.notification.success', 'Success!'),
    description: i18n.t(
      'factory.notification.operationCompletedSuccessfully',
      'Operation completed successfully.'
    ),
  });
}

/** Create an error toast */
export function createFakeErrorToast(): FakeToast {
  return createFakeToast({
    type: 'error',
    title: i18n.t('factory.notification.error', 'Error'),
    description: i18n.t(
      'factory.notification.somethingWentWrongPleaseTry',
      'Something went wrong. Please try again.'
    ),
  });
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeActivity(overrides?: Partial<FakeActivity>): FakeActivity {
  const targetType = faker.helpers.arrayElement(ACTIVITY_TARGETS);
  return {
    id: faker.string.uuid(),
    user: {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      avatar: faker.image.avatar(),
    },
    action: faker.helpers.arrayElement(ACTIVITY_ACTIONS),
    target: faker.lorem.words(2),
    targetType,
    timestamp: faker.date.recent().toISOString(),
    metadata: faker.helpers.maybe(
      () => ({
        url: `/${targetType}s/${faker.string.uuid()}`,
        previousValue: faker.lorem.word(),
        newValue: faker.lorem.word(),
      }),
      { probability: 0.3 }
    ),
    ...overrides,
  };
}

export function createFakeActivities(count: number): FakeActivity[] {
  return Array.from({ length: count }, () => createFakeActivity());
}

export function createFakeActivityFeed(count?: number): FakeActivityFeed {
  const activities = createFakeActivities(count ?? faker.number.int({ min: 5, max: 20 }));
  return {
    activities,
    total: activities.length,
    hasMore: faker.datatype.boolean({ probability: 0.4 }),
    nextCursor: faker.helpers.maybe(() => faker.string.alphanumeric(16), { probability: 0.4 }),
  };
}

// ═══════════════════════════════════════════════════════════════
// MATRIX FACTORIES (For Visual Regression)
// ═══════════════════════════════════════════════════════════════

/** Create type × priority matrix for visual testing */
export function createFakeNotificationTypePriorityMatrix(): FakeNotification[][] {
  return NOTIFICATION_TYPES.map((type) =>
    NOTIFICATION_PRIORITIES.map((priority) => createFakeNotification({ type, priority }))
  );
}

/** Create type × category matrix for visual testing */
export function createFakeNotificationTypeCategoryMatrix(): FakeNotification[][] {
  return NOTIFICATION_TYPES.map((type) =>
    NOTIFICATION_CATEGORIES.map((category) => createFakeNotification({ type, category }))
  );
}

/** Create channel × status matrix for visual testing */
export function createFakeNotificationChannelStatusMatrix(): FakeNotification[][] {
  return NOTIFICATION_CHANNELS.map((channel) =>
    NOTIFICATION_STATUSES.map((status) =>
      createFakeNotification({ channel, status, read: status === 'read' })
    )
  );
}

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE FEATURE FACTORIES
// ═══════════════════════════════════════════════════════════════

/** Create all enterprise notification combinations for testing */
export function createFakeEnterpriseNotificationSet(): FakeNotification[] {
  return [
    createFakeInfoNotification(),
    createFakeSuccessNotification(),
    createFakeWarningNotification(),
    createFakeErrorNotification(),
    createFakeSecurityNotification(),
    createFakeMessageNotification(),
    createFakeBillingNotification(),
    createFakeUnreadNotification(),
  ];
}

/** Create a comprehensive notification showcase */
export function createFakeNotificationShowcase(): {
  activities: FakeActivity[];
  allCategories: FakeNotification[];
  allPriorities: FakeNotification[];
  allTypes: FakeNotification[];
  preferences: FakeNotificationPreferences;
  response: FakeNotificationsResponse;
  toasts: FakeToast[];
} {
  return {
    response: createFakeNotificationsResponse(10),
    allTypes: createFakeNotificationsWithAllTypes(),
    allPriorities: createFakeNotificationsWithAllPriorities(),
    allCategories: createFakeNotificationsWithAllCategories(),
    toasts: createFakeToastsWithAllTypes(),
    activities: createFakeActivities(5),
    preferences: createFakeNotificationPreferences(),
  };
}
