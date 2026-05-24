import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ TYPE DEFINITIONS ============

/** Notification status type */
export type FakeNotificationStatus = 'away' | 'busy' | 'offline' | 'online';

/** Notification type */
export type FakeNotificationType = 'confirm' | 'text';

/** Interface for fake notification data */
export interface FakeNotification {
  /** Avatar filename */
  avatar: string;
  /** Relative date string */
  date: string;
  /** Notification description */
  desc: string;
  /** Unique identifier */
  id: number;
  /** User role */
  role: string;
  /** User status */
  status: FakeNotificationStatus;
  /** Notification title */
  title: string;
  /** Notification type */
  type: FakeNotificationType;
  /** Whether there is an unread message */
  unreadMessage: boolean;
}

/** Interface for header data config */
export interface FakeHeaderDataConfig {
  /** Maximum notifications to display */
  maxItems: number;
  /** Whether to show unread count */
  showUnreadCount: boolean;
  /** Filter by type */
  typeFilter: FakeNotificationType | null;
}

// ============ CONSTANTS FOR ITERATION ============

/** All notification status options */
export const NOTIFICATION_STATUSES: FakeNotificationStatus[] = [
  'away',
  'busy',
  'offline',
  'online',
];

/** All notification type options */
export const NOTIFICATION_TYPES: FakeNotificationType[] = ['confirm', 'text'];

/** Common job roles for test data */
export const NOTIFICATION_ROLES = [
  i18n.t('factory.data.advertisingCopywriter', 'Advertising copywriter'),
  i18n.t('factory.data.buildingSurveyor', 'Building surveyor'),
  i18n.t('factory.data.dataScientist', 'Data scientist'),
  i18n.t('factory.data.designer', 'Designer'),
  i18n.t('factory.data.dietitian', 'Dietitian'),
  i18n.t('factory.data.frontendDeveloper', 'Frontend Developer'),
  i18n.t('factory.data.marketingExecutive', 'Marketing executive'),
  i18n.t('factory.data.townPlanner', 'Town planner'),
  i18n.t('factory.data.uiuxDesigner', 'UI/UX Designer'),
];

/** Sample avatar filenames */
export const NOTIFICATION_AVATARS = [
  '01.png',
  '02.png',
  '03.png',
  '04.png',
  '05.png',
  '06.png',
  '07.png',
  '08.png',
  '09.png',
  '10.png',
];

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake notification
 * @param overrides - Optional partial overrides
 * @returns A fake notification
 */
export function createFakeNotification(overrides?: Partial<FakeNotification>): FakeNotification {
  return {
    id: faker.number.int({ min: 1, max: 9999 }),
    title: faker.person.fullName(),
    role: faker.helpers.arrayElement(NOTIFICATION_ROLES),
    desc: faker.lorem.sentence(),
    avatar: faker.helpers.arrayElement(NOTIFICATION_AVATARS),
    status: faker.helpers.arrayElement(NOTIFICATION_STATUSES),
    unreadMessage: faker.datatype.boolean(),
    type: faker.helpers.arrayElement(NOTIFICATION_TYPES),
    date: faker.helpers.arrayElement(['2 days ago', '11 am', '12 pm', '1 pm', '3 pm', '7 pm']),
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake notifications
 * @param count - Number of notifications to generate
 * @returns Array of fake notifications
 */
export function createFakeNotifications(count: number): FakeNotification[] {
  return Array.from({ length: count }, (_, i) => createFakeNotification({ id: i + 1 }));
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates an unread notification
 * @returns An unread notification
 */
export function createFakeUnreadNotification(): FakeNotification {
  return createFakeNotification({
    unreadMessage: true,
    status: 'online',
  });
}

/**
 * Creates a confirm-type notification
 * @returns A confirm notification
 */
export function createFakeConfirmNotification(): FakeNotification {
  return createFakeNotification({
    type: 'confirm',
    desc: i18n.t('factory.data.requestingAccessPermission', 'Requesting access permission'),
    unreadMessage: true,
  });
}

/**
 * Creates notifications grouped by status
 * @returns Record of notifications by status
 */
export function createFakeNotificationsByStatus(): Record<
  FakeNotificationStatus,
  FakeNotification[]
> {
  return {
    away: Array.from({ length: 2 }, () => createFakeNotification({ status: 'away' })),
    busy: Array.from({ length: 2 }, () => createFakeNotification({ status: 'busy' })),
    offline: Array.from({ length: 2 }, () => createFakeNotification({ status: 'offline' })),
    online: Array.from({ length: 2 }, () => createFakeNotification({ status: 'online' })),
  };
}

/**
 * Creates header data configuration
 * @param scenario - Configuration scenario
 * @returns Header data configuration
 */
export function createFakeHeaderDataConfig(
  scenario: 'compact' | 'default' | 'unread' = 'default'
): FakeHeaderDataConfig {
  const configs: Record<string, FakeHeaderDataConfig> = {
    default: {
      maxItems: 10,
      showUnreadCount: true,
      typeFilter: null,
    },
    compact: {
      maxItems: 5,
      showUnreadCount: false,
      typeFilter: null,
    },
    unread: {
      maxItems: 10,
      showUnreadCount: true,
      typeFilter: 'text',
    },
  };

  return configs[scenario];
}
