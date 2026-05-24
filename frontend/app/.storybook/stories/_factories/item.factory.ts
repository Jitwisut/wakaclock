/**
 * @fileoverview Factory functions for generating fake Item component data
 * @module item.factory
 * @description Provides comprehensive test data generation for Item components
 * including list items, user items, product items, file items, and more.
 *
 * @example
 * ```typescript
 * import { createFakeItem, createFakeUserItem } from './_factories/item.factory';
 *
 * // Create a random item
 * const item = createFakeItem();
 *
 * // Create a user-specific item
 * const userItem = createFakeUserItem();
 * ```
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets the button variant for an item action
 * @param type - The action type
 * @param iconOnly - Whether the button is icon-only
 * @returns The button variant
 */
function getActionButtonVariant(
  type: ItemActionType,
  iconOnly: boolean
): 'default' | 'destructive' | 'ghost' | 'outline' | 'secondary' {
  if (type === 'delete') return 'destructive';
  if (iconOnly) return 'ghost';
  return 'outline';
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Item variant options
 * @description Visual style variants for items
 */
export type ItemVariant = 'default' | 'muted' | 'outline';

/**
 * Item size options
 * @description Size variants for items
 */
export type ItemSize = 'default' | 'sm';

/**
 * Item media variant options
 * @description Visual variants for item media
 */
export type ItemMediaVariant = 'default' | 'icon' | 'image';

/**
 * Item type options
 * @description Types of items based on content
 */
export type ItemType =
  | 'chat'
  | 'contact'
  | 'event'
  | 'file'
  | 'message'
  | 'note'
  | 'notification'
  | 'product'
  | 'task'
  | 'user';

/**
 * Item state options
 * @description Current state of the item
 */
export type ItemState = 'active' | 'completed' | 'default' | 'disabled' | 'selected';

/**
 * Item action type
 * @description Types of actions that can be performed on items
 */
export type ItemActionType =
  | 'archive'
  | 'delete'
  | 'download'
  | 'edit'
  | 'favorite'
  | 'message'
  | 'more'
  | 'share'
  | 'view';

/**
 * Item priority level
 * @description Priority levels for task/notification items
 */
export type ItemPriority = 'critical' | 'high' | 'low' | 'medium' | 'normal';

// ============================================================================
// CONSTANTS
// ============================================================================

/** All available item variants */
export const ITEM_VARIANTS: ItemVariant[] = ['default', 'outline', 'muted'];

/** All available item sizes */
export const ITEM_SIZES: ItemSize[] = ['default', 'sm'];

/** All available item media variants */
export const ITEM_MEDIA_VARIANTS: ItemMediaVariant[] = ['default', 'icon', 'image'];

/** All available item types */
export const ITEM_TYPES: ItemType[] = [
  'user',
  'product',
  'file',
  'task',
  'notification',
  'message',
  'event',
  'note',
  'contact',
  'chat',
];

/** All available item states */
export const ITEM_STATES: ItemState[] = ['default', 'selected', 'active', 'disabled', 'completed'];

/** All available action types */
export const ITEM_ACTION_TYPES: ItemActionType[] = [
  'view',
  'edit',
  'delete',
  'share',
  'download',
  'favorite',
  'archive',
  'more',
  'message',
];

/** All available priority levels */
export const ITEM_PRIORITIES: ItemPriority[] = ['low', 'normal', 'medium', 'high', 'critical'];

/** Common icon names for item media */
export const ITEM_ICONS = [
  i18n.t('factory.item.file', 'File'),
  'FileText',
  i18n.t('factory.item.image', 'Image'),
  i18n.t('factory.item.folder', 'Folder'),
  i18n.t('factory.item.user', 'User'),
  i18n.t('factory.item.mail', 'Mail'),
  i18n.t('factory.item.bell', 'Bell'),
  i18n.t('factory.item.calendar', 'Calendar'),
  i18n.t('factory.item.star', 'Star'),
  i18n.t('factory.item.heart', 'Heart'),
  i18n.t('factory.item.settings', 'Settings'),
  'CheckCircle',
];

/** Common action button labels */
const ACTION_VIEW = i18n.t('factory.item.view', 'View');
const ACTION_EDIT = i18n.t('factory.item.edit', 'Edit');
const ACTION_DELETE = i18n.t('factory.item.delete', 'Delete');
const ACTION_MORE = i18n.t('factory.item.moreOptions', 'More options');

export const ITEM_ACTION_LABELS = {
  archive: i18n.t('factory.item.archive', 'Archive'),
  delete: ACTION_DELETE,
  download: i18n.t('factory.item.download', 'Download'),
  edit: ACTION_EDIT,
  favorite: i18n.t('factory.item.favorite', 'Favorite'),
  message: i18n.t('factory.item.message', 'Message'),
  more: ACTION_MORE,
  share: i18n.t('factory.item.share', 'Share'),
  view: ACTION_VIEW,
};

/** Common aria labels for actions */
export const ITEM_ACTION_ARIA_LABELS: Record<ItemActionType, string> = {
  archive: i18n.t('factory.item.archiveItem', 'Archive item'),
  delete: i18n.t('factory.item.deleteItem', 'Delete item'),
  download: i18n.t('factory.item.downloadItem', 'Download item'),
  edit: i18n.t('factory.item.editItem', 'Edit item'),
  favorite: i18n.t('factory.item.addToFavorites', 'Add to favorites'),
  message: i18n.t('factory.item.sendMessage', 'Send message'),
  more: ACTION_MORE,
  share: i18n.t('factory.item.shareItem', 'Share item'),
  view: i18n.t('factory.item.viewItem', 'View item'),
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Represents an action button for an item
 */
export interface FakeItemAction {
  /** Aria label for accessibility */
  ariaLabel: string;
  /** Whether the action is disabled */
  disabled: boolean;
  /** Icon name */
  iconName?: string;
  /** Whether it's an icon-only button */
  iconOnly: boolean;
  /** Unique identifier */
  id: string;
  /** Button label */
  label: string;
  /** Button size */
  size: 'default' | 'icon' | 'sm';
  /** Action type */
  type: ItemActionType;
  /** Button variant */
  variant: 'default' | 'destructive' | 'ghost' | 'outline' | 'secondary';
}

/**
 * Represents item media configuration
 */
export interface FakeItemMedia {
  /** Avatar fallback color */
  avatarColor?: string;
  /** Icon name */
  iconName?: string;
  /** Unique identifier */
  id: string;
  /** Image alt text */
  imageAlt?: string;
  /** Image source URL */
  imageSrc?: string;
  /** Avatar initials */
  initials?: string;
  /** Media variant */
  variant: ItemMediaVariant;
}

/**
 * Represents item content configuration
 */
export interface FakeItemContent {
  /** Description text */
  description?: string;
  /** Whether description is truncated */
  descriptionTruncated: boolean;
  /** Maximum lines for description */
  maxLines: number;
  /** Title text */
  title: string;
  /** Whether title is truncated */
  titleTruncated: boolean;
}

/**
 * Represents a complete item configuration
 */
export interface FakeItem {
  /** Action buttons */
  actions: FakeItemAction[];
  /** Whether to render as child (asChild prop) */
  asChild: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Content configuration */
  content: FakeItemContent;
  /** Whether item has footer */
  hasFooter: boolean;
  /** Whether item has header */
  hasHeader: boolean;
  /** Whether item has separator after it */
  hasSeparator: boolean;
  /** Unique identifier */
  id: string;
  /** Media configuration */
  media?: FakeItemMedia;
  /** Item size */
  size: ItemSize;
  /** Current state */
  state: ItemState;
  /** Test ID */
  testId?: string;
  /** Item type */
  type: ItemType;
  /** Item variant */
  variant: ItemVariant;
}

/**
 * Represents a user item configuration
 */
export interface FakeUserItem extends FakeItem {
  /** Online status */
  isOnline: boolean;
  /** User's avatar URL */
  userAvatar: string;
  /** User's email */
  userEmail: string;
  /** User's initials */
  userInitials: string;
  /** User's full name */
  userName: string;
  /** User's role/position */
  userRole?: string;
}

/**
 * Represents a product item configuration
 */
export interface FakeProductItem extends FakeItem {
  /** Product category */
  category: string;
  /** Currency code */
  currency: string;
  /** Stock status */
  inStock: boolean;
  /** Product price */
  price: number;
  /** Product description */
  productDescription: string;
  /** Product image URL */
  productImage: string;
  /** Product name */
  productName: string;
}

/**
 * Represents a file item configuration
 */
export interface FakeFileItem extends FakeItem {
  /** File extension */
  fileExtension: string;
  /** File name */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** File type */
  fileType: string;
  /** Whether file is shared */
  isShared: boolean;
  /** Last modified date */
  lastModified: Date;
}

/**
 * Represents a task item configuration
 */
export interface FakeTaskItem extends FakeItem {
  /** Assignee name */
  assignee?: string;
  /** Due date */
  dueDate?: Date;
  /** Whether task is completed */
  isCompleted: boolean;
  /** Priority level */
  priority: ItemPriority;
  /** Project name */
  project?: string;
  /** Task description */
  taskDescription?: string;
  /** Task title */
  taskTitle: string;
}

/**
 * Represents a notification item configuration
 */
export interface FakeNotificationItem extends FakeItem {
  /** Whether notification is read */
  isRead: boolean;
  /** Link URL */
  link?: string;
  /** Notification message */
  message: string;
  /** Notification type */
  notificationType: 'error' | 'info' | 'success' | 'warning';
  /** Source/sender */
  source?: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Represents an event item configuration
 */
export interface FakeEventItem extends FakeItem {
  /** Attendee count */
  attendeeCount: number;
  /** End time */
  endTime?: Date;
  /** Event description */
  eventDescription?: string;
  /** Event title */
  eventTitle: string;
  /** Whether it's an all-day event */
  isAllDay: boolean;
  /** Location */
  location?: string;
  /** Start time */
  startTime: Date;
}

/**
 * Represents a message/chat item configuration
 */
export interface FakeMessageItem extends FakeItem {
  /** Whether message is unread */
  isUnread: boolean;
  /** Message preview */
  messagePreview: string;
  /** Sender avatar */
  senderAvatar: string;
  /** Sender name */
  senderName: string;
  /** Timestamp */
  timestamp: Date;
  /** Unread count */
  unreadCount: number;
}

/**
 * Represents an item group configuration
 */
export interface FakeItemGroup {
  /** Additional CSS classes */
  className?: string;
  /** Unique identifier */
  id: string;
  /** Items in the group */
  items: FakeItem[];
  /** Whether items have separators */
  showSeparators: boolean;
  /** Group title */
  title?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates a fake item action
 */
function createFakeAction(
  type: ItemActionType,
  overrides?: Partial<FakeItemAction>
): FakeItemAction {
  const iconOnly = type === 'more' || faker.datatype.boolean();

  return {
    id: faker.string.uuid(),
    type,
    label: ITEM_ACTION_LABELS[type],
    ariaLabel: ITEM_ACTION_ARIA_LABELS[type],
    iconName: type === 'more' ? 'MoreHorizontal' : faker.helpers.arrayElement(ITEM_ICONS),
    iconOnly,
    variant: getActionButtonVariant(type, iconOnly),
    size: iconOnly ? 'icon' : 'sm',
    disabled: faker.helpers.maybe(() => true, { probability: 0.1 }) ?? false,
    ...overrides,
  };
}

/**
 * Creates fake item media
 */
function createFakeMedia(
  variant: ItemMediaVariant,
  overrides?: Partial<FakeItemMedia>
): FakeItemMedia {
  const base: FakeItemMedia = {
    id: faker.string.uuid(),
    variant,
  };

  if (variant === 'image') {
    base.imageSrc = faker.image.urlPicsumPhotos({ width: 80, height: 80 });
    base.imageAlt = faker.lorem.words(2);
  } else if (variant === 'icon') {
    base.iconName = faker.helpers.arrayElement(ITEM_ICONS);
  } else {
    // Default variant - can be avatar or icon
    const useAvatar = faker.datatype.boolean();
    if (useAvatar) {
      base.imageSrc = faker.image.avatar();
      base.imageAlt = faker.person.fullName();
      base.initials = faker.string.alpha({ length: 2, casing: 'upper' });
    } else {
      base.iconName = faker.helpers.arrayElement(ITEM_ICONS);
    }
  }

  return { ...base, ...overrides };
}

/**
 * Creates fake item content
 */
function createFakeContent(overrides?: Partial<FakeItemContent>): FakeItemContent {
  return {
    title: faker.lorem.words({ min: 2, max: 5 }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.8 }),
    titleTruncated: faker.helpers.maybe(() => true, { probability: 0.2 }) ?? false,
    descriptionTruncated: true,
    maxLines: 2,
    ...overrides,
  };
}

/**
 * Gets random actions based on item type
 */
function getActionsForType(type: ItemType): FakeItemAction[] {
  const baseActions: FakeItemAction[] = [createFakeAction('more', { iconOnly: true })];

  switch (type) {
    case 'user': {
      return [createFakeAction('message'), ...baseActions];
    }
    case 'product': {
      return [createFakeAction('view'), createFakeAction('favorite'), ...baseActions];
    }
    case 'file': {
      return [createFakeAction('download'), createFakeAction('share'), ...baseActions];
    }
    case 'task': {
      return [createFakeAction('edit'), ...baseActions];
    }
    case 'notification': {
      return baseActions;
    }
    case 'message':
    case 'chat': {
      return baseActions;
    }
    case 'event': {
      return [createFakeAction('edit'), ...baseActions];
    }
    case 'note': {
      return [createFakeAction('edit'), createFakeAction('delete'), ...baseActions];
    }
    case 'contact': {
      return [createFakeAction('message'), createFakeAction('edit'), ...baseActions];
    }
    default: {
      return baseActions;
    }
  }
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a single fake Item configuration
 * @param overrides - Optional partial object to override default values
 * @returns A fake Item configuration
 */
export function createFakeItem(overrides?: Partial<FakeItem>): FakeItem {
  const type = faker.helpers.arrayElement(ITEM_TYPES);
  const variant = faker.helpers.arrayElement(ITEM_VARIANTS);
  const mediaVariant = faker.helpers.arrayElement(ITEM_MEDIA_VARIANTS);
  const hasMedia = faker.helpers.maybe(() => true, { probability: 0.8 }) ?? false;

  return {
    id: faker.string.uuid(),
    type,
    variant,
    size: faker.helpers.arrayElement(ITEM_SIZES),
    state: faker.helpers.arrayElement(ITEM_STATES),
    media: hasMedia ? createFakeMedia(mediaVariant) : undefined,
    content: createFakeContent(),
    actions: getActionsForType(type),
    hasHeader: faker.helpers.maybe(() => true, { probability: 0.2 }) ?? false,
    hasFooter: faker.helpers.maybe(() => true, { probability: 0.2 }) ?? false,
    hasSeparator: faker.helpers.maybe(() => true, { probability: 0.5 }) ?? false,
    asChild: faker.helpers.maybe(() => true, { probability: 0.5 }) ?? false,
    className: faker.helpers.maybe(() => 'custom-item', { probability: 0.1 }),
    testId: `item-${faker.string.alphanumeric(8)}`,
    ...overrides,
  };
}

/**
 * Creates multiple fake Item configurations
 * @param count - Number of configurations to create
 * @returns Array of fake Item configurations
 */
export function createFakeItems(count: number): FakeItem[] {
  return Array.from({ length: count }, () => createFakeItem());
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a user item configuration
 * @param overrides - Optional partial object to override default values
 * @returns A user-specific Item configuration
 */
export function createFakeUserItem(overrides?: Partial<FakeUserItem>): FakeUserItem {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const fullName = `${firstName} ${lastName}`;

  return {
    ...createFakeItem({
      type: 'user',
      content: createFakeContent({
        title: fullName,
        description: faker.person.jobTitle(),
      }),
      media: createFakeMedia('default', {
        imageSrc: faker.image.avatar(),
        imageAlt: fullName,
        initials: `${firstName[0]}${lastName[0]}`,
      }),
    }),
    userName: fullName,
    userEmail: faker.internet.email({ firstName, lastName }),
    userAvatar: faker.image.avatar(),
    userInitials: `${firstName[0]}${lastName[0]}`,
    userRole: faker.person.jobTitle(),
    isOnline: faker.helpers.maybe(() => true, { probability: 0.5 }) ?? false,
    ...overrides,
  };
}

/**
 * Creates a product item configuration
 * @param overrides - Optional partial object to override default values
 * @returns A product-specific Item configuration
 */
export function createFakeProductItem(overrides?: Partial<FakeProductItem>): FakeProductItem {
  const productName = faker.commerce.productName();
  const price = faker.number.float({ min: 10, max: 500, fractionDigits: 2 });

  return {
    ...createFakeItem({
      type: 'product',
      content: createFakeContent({
        title: productName,
        description: i18n.t('factory.item.priceAndDepartment', '${{price}} • {{department}}', {
          price: price.toFixed(2),
          department: faker.commerce.department(),
        }),
      }),
      media: createFakeMedia('image', {
        imageSrc: faker.image.urlPicsumPhotos({ width: 80, height: 80 }),
        imageAlt: productName,
      }),
    }),
    productName,
    productDescription: faker.commerce.productDescription(),
    productImage: faker.image.urlPicsumPhotos({ width: 200, height: 200 }),
    price,
    currency: faker.helpers.arrayElement(['USD', 'EUR', 'GBP']),
    inStock: faker.helpers.maybe(() => true, { probability: 0.8 }) ?? false,
    category: faker.commerce.department(),
    ...overrides,
  };
}

/**
 * Creates a file item configuration
 * @param overrides - Optional partial object to override default values
 * @returns A file-specific Item configuration
 */
export function createFakeFileItem(overrides?: Partial<FakeFileItem>): FakeFileItem {
  const extension = faker.helpers.arrayElement([
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'jpg',
    'png',
    'zip',
  ]);
  const fileName = `${faker.system.fileName().split('.')[0]}.${extension}`;
  const fileSize = faker.number.int({ min: 1024, max: 10_485_760 });
  const fileSizeFormatted =
    fileSize > 1_048_576
      ? i18n.t('factory.item.fileSizeMB', '{{size}} MB', {
          size: (fileSize / 1_048_576).toFixed(1),
        })
      : i18n.t('factory.item.fileSizeKB', '{{size}} KB', { size: (fileSize / 1024).toFixed(1) });

  return {
    ...createFakeItem({
      type: 'file',
      content: createFakeContent({
        title: fileName,
        description: i18n.t('factory.item.fileSizeModified', '{{size}} • Modified {{date}}', {
          size: fileSizeFormatted,
          date: faker.date.recent().toLocaleDateString(),
        }),
      }),
      media: createFakeMedia('icon', {
        iconName:
          extension === 'jpg' || extension === 'png'
            ? i18n.t('factory.item.image', 'Image')
            : 'FileText',
      }),
    }),
    fileName,
    fileExtension: extension,
    fileSize,
    fileType: extension,
    lastModified: faker.date.recent(),
    isShared: faker.helpers.maybe(() => true, { probability: 0.3 }) ?? false,
    ...overrides,
  };
}

/**
 * Creates a task item configuration
 * @param overrides - Optional partial object to override default values
 * @returns A task-specific Item configuration
 */
export function createFakeTaskItem(overrides?: Partial<FakeTaskItem>): FakeTaskItem {
  const taskTitle = faker.lorem.sentence({ min: 3, max: 8 });
  const isCompleted = faker.helpers.maybe(() => true, { probability: 0.3 }) ?? false;
  const priority = faker.helpers.arrayElement(ITEM_PRIORITIES);

  return {
    ...createFakeItem({
      type: 'task',
      state: isCompleted ? 'completed' : 'default',
      content: createFakeContent({
        title: taskTitle,
        description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.6 }),
      }),
      media: createFakeMedia('icon', {
        iconName: isCompleted ? 'CheckCircle' : i18n.t('factory.item.circle', 'Circle'),
      }),
    }),
    taskTitle,
    taskDescription: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    dueDate: faker.helpers.maybe(() => faker.date.soon({ days: 14 }), { probability: 0.7 }),
    priority,
    isCompleted,
    assignee: faker.helpers.maybe(() => faker.person.fullName(), { probability: 0.5 }),
    project: faker.helpers.maybe(() => faker.company.buzzPhrase(), { probability: 0.5 }),
    ...overrides,
  };
}

/**
 * Creates a notification item configuration
 * @param overrides - Optional partial object to override default values
 * @returns A notification-specific Item configuration
 */
export function createFakeNotificationItem(
  overrides?: Partial<FakeNotificationItem>
): FakeNotificationItem {
  const notificationType = faker.helpers.arrayElement([
    'info',
    'success',
    'warning',
    'error',
  ] as const);
  const isRead = faker.helpers.maybe(() => true, { probability: 0.5 }) ?? false;

  return {
    ...createFakeItem({
      type: 'notification',
      variant: isRead ? 'default' : 'muted',
      content: createFakeContent({
        title: faker.helpers.arrayElement([
          i18n.t('factory.item.newMessageReceived', 'New message received'),
          i18n.t('factory.item.taskCompleted', 'Task completed'),
          i18n.t('factory.item.meetingReminder', 'Meeting reminder'),
          i18n.t('factory.item.systemUpdate', 'System update'),
          i18n.t('factory.item.paymentProcessed', 'Payment processed'),
        ]),
        description: faker.lorem.sentence(),
      }),
      media: createFakeMedia('icon', {
        iconName:
          notificationType === 'error' ? 'AlertCircle' : i18n.t('factory.item.bell', 'Bell'),
      }),
    }),
    message: faker.lorem.sentence(),
    notificationType,
    timestamp: faker.date.recent(),
    isRead,
    source: faker.helpers.maybe(() => faker.person.fullName(), { probability: 0.5 }),
    link: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Creates an event item configuration
 * @param overrides - Optional partial object to override default values
 * @returns An event-specific Item configuration
 */
export function createFakeEventItem(overrides?: Partial<FakeEventItem>): FakeEventItem {
  const eventTitle = faker.lorem.words({ min: 2, max: 5 });
  const startTime = faker.date.soon({ days: 30 });
  const isAllDay = faker.helpers.maybe(() => true, { probability: 0.2 }) ?? false;

  return {
    ...createFakeItem({
      type: 'event',
      content: createFakeContent({
        title: eventTitle,
        description: i18n.t('factory.item.dateAtTime', '{{date}} at {{time}}', {
          date: startTime.toLocaleDateString(),
          time: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }),
      }),
      media: createFakeMedia('icon', {
        iconName: i18n.t('factory.item.calendar', 'Calendar'),
      }),
    }),
    eventTitle,
    eventDescription: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    startTime,
    endTime: faker.helpers.maybe(
      () => new Date(startTime.getTime() + faker.number.int({ min: 1, max: 4 }) * 3_600_000),
      { probability: 0.8 }
    ),
    location: faker.helpers.maybe(() => faker.location.streetAddress(), { probability: 0.5 }),
    isAllDay,
    attendeeCount: faker.number.int({ min: 0, max: 20 }),
    ...overrides,
  };
}

/**
 * Creates a message/chat item configuration
 * @param overrides - Optional partial object to override default values
 * @returns A message-specific Item configuration
 */
export function createFakeMessageItem(overrides?: Partial<FakeMessageItem>): FakeMessageItem {
  const senderName = faker.person.fullName();
  const isUnread = faker.helpers.maybe(() => true, { probability: 0.3 }) ?? false;
  const unreadCount = isUnread ? faker.number.int({ min: 1, max: 10 }) : 0;

  return {
    ...createFakeItem({
      type: 'message',
      variant: isUnread ? 'muted' : 'default',
      content: createFakeContent({
        title: senderName,
        description: faker.lorem.sentence(),
      }),
      media: createFakeMedia('default', {
        imageSrc: faker.image.avatar(),
        imageAlt: senderName,
        initials: senderName
          .split(' ')
          .map((n) => n[0])
          .join(''),
      }),
    }),
    senderName,
    senderAvatar: faker.image.avatar(),
    messagePreview: faker.lorem.sentence(),
    timestamp: faker.date.recent(),
    isUnread,
    unreadCount,
    ...overrides,
  };
}

/**
 * Creates an item group configuration
 * @param itemCount - Number of items in the group
 * @param overrides - Optional partial object to override default values
 * @returns An item group configuration
 */
export function createFakeItemGroup(
  itemCount: number = 5,
  overrides?: Partial<FakeItemGroup>
): FakeItemGroup {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.maybe(() => faker.lorem.words(2), { probability: 0.5 }),
    items: createFakeItems(itemCount),
    showSeparators: faker.helpers.maybe(() => true, { probability: 0.5 }) ?? false,
    className: faker.helpers.maybe(() => 'custom-group', { probability: 0.1 }),
    ...overrides,
  };
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of items by variant
 * @returns Array of Item configurations for variant testing
 */
export function createFakeItemVariantMatrix(): FakeItem[] {
  return ITEM_VARIANTS.map((variant) =>
    createFakeItem({
      variant,
      content: createFakeContent({
        title: i18n.t('factory.item.variantTitle', 'Variant: {{variant}}', { variant }),
      }),
    })
  );
}

/**
 * Creates a matrix of items by size
 * @returns Array of Item configurations for size testing
 */
export function createFakeItemSizeMatrix(): FakeItem[] {
  return ITEM_SIZES.map((size) =>
    createFakeItem({
      size,
      content: createFakeContent({
        title: i18n.t('factory.item.sizeTitle', 'Size: {{size}}', { size }),
      }),
    })
  );
}

/**
 * Creates a matrix of items by state
 * @returns Array of Item configurations for state testing
 */
export function createFakeItemStateMatrix(): FakeItem[] {
  return ITEM_STATES.map((state) =>
    createFakeItem({
      state,
      content: createFakeContent({
        title: i18n.t('factory.item.stateTitle', 'State: {{state}}', { state }),
      }),
    })
  );
}

/**
 * Creates a matrix of items by media variant
 * @returns Array of Item configurations for media variant testing
 */
export function createFakeItemMediaVariantMatrix(): FakeItem[] {
  return ITEM_MEDIA_VARIANTS.map((mediaVariant) =>
    createFakeItem({
      media: createFakeMedia(mediaVariant),
      content: createFakeContent({
        title: i18n.t('factory.item.mediaTitle', 'Media: {{variant}}', { variant: mediaVariant }),
      }),
    })
  );
}

/**
 * Creates a matrix of items by type
 * @returns Array of Item configurations for type testing
 */
export function createFakeItemTypeMatrix(): FakeItem[] {
  return ITEM_TYPES.map((type) =>
    createFakeItem({
      type,
      content: createFakeContent({
        title: i18n.t(`factory.item.type_${type}`, type.charAt(0).toUpperCase() + type.slice(1)),
      }),
    })
  );
}

/**
 * Creates a comprehensive showcase of all item types
 * @returns Record of categorized Item configurations
 */
export function createFakeItemShowcase(): Record<string, FakeItem> {
  return {
    // Basic types
    basic: createFakeItem({
      content: createFakeContent({ title: i18n.t('factory.item.basicItem', 'Basic Item') }),
    }),
    user: createFakeUserItem(),
    product: createFakeProductItem(),
    file: createFakeFileItem(),
    task: createFakeTaskItem(),
    notification: createFakeNotificationItem(),
    event: createFakeEventItem(),
    message: createFakeMessageItem(),

    // Variants
    variantDefault: createFakeItem({ variant: 'default' }),
    variantOutline: createFakeItem({ variant: 'outline' }),
    variantMuted: createFakeItem({ variant: 'muted' }),

    // Sizes
    sizeDefault: createFakeItem({ size: 'default' }),
    sizeSm: createFakeItem({ size: 'sm' }),

    // States
    stateDefault: createFakeItem({ state: 'default' }),
    stateSelected: createFakeItem({ state: 'selected' }),
    stateActive: createFakeItem({ state: 'active' }),
    stateDisabled: createFakeItem({ state: 'disabled' }),
    stateCompleted: createFakeItem({ state: 'completed' }),

    // Media variants
    mediaDefault: createFakeItem({ media: createFakeMedia('default') }),
    mediaIcon: createFakeItem({ media: createFakeMedia('icon') }),
    mediaImage: createFakeItem({ media: createFakeMedia('image') }),
    noMedia: createFakeItem({ media: undefined }),

    // Special
    withHeader: createFakeItem({ hasHeader: true }),
    withFooter: createFakeItem({ hasFooter: true }),
    withSeparator: createFakeItem({ hasSeparator: true }),
    asChild: createFakeItem({ asChild: true }),
  };
}

// ============================================================================
// LIST SET FACTORIES
// ============================================================================

/**
 * Creates a set of user items for a contact list
 * @param count - Number of users
 * @returns Array of user item configurations
 */
export function createFakeContactList(count: number = 10): FakeUserItem[] {
  return Array.from({ length: count }, () => createFakeUserItem());
}

/**
 * Creates a set of product items for a product list
 * @param count - Number of products
 * @returns Array of product item configurations
 */
export function createFakeProductList(count: number = 10): FakeProductItem[] {
  return Array.from({ length: count }, () => createFakeProductItem());
}

/**
 * Creates a set of file items for a file browser
 * @param count - Number of files
 * @returns Array of file item configurations
 */
export function createFakeFileList(count: number = 10): FakeFileItem[] {
  return Array.from({ length: count }, () => createFakeFileItem());
}

/**
 * Creates a set of task items for a todo list
 * @param count - Number of tasks
 * @returns Array of task item configurations
 */
export function createFakeTaskList(count: number = 10): FakeTaskItem[] {
  return Array.from({ length: count }, () => createFakeTaskItem());
}

/**
 * Creates a set of notification items for a notification center
 * @param count - Number of notifications
 * @returns Array of notification item configurations
 */
export function createFakeNotificationList(count: number = 10): FakeNotificationItem[] {
  return Array.from({ length: count }, () => createFakeNotificationItem());
}

/**
 * Creates a set of message items for a chat list
 * @param count - Number of messages
 * @returns Array of message item configurations
 */
export function createFakeMessageList(count: number = 10): FakeMessageItem[] {
  return Array.from({ length: count }, () => createFakeMessageItem());
}
