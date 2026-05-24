import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// SHEET FACTORY
// ============================================================================
// Comprehensive test data factories for the Sheet component.
// Follows the Button factory pattern with type exports, constants, and
// specialized factories for different sheet configurations.
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Sheet side/position
 * @description The edge from which the sheet slides in
 */
export type SheetSide = 'bottom' | 'left' | 'right' | 'top';

/**
 * Sheet size
 * @description Common width/height presets
 */
export type SheetSize = 'default' | 'full' | 'lg' | 'sm' | 'xl';

/**
 * Sheet content type
 * @description Common use cases for sheets
 */
export type SheetContentType =
  | 'cart'
  | 'comments'
  | 'confirmation'
  | 'details'
  | 'filters'
  | 'form'
  | 'menu'
  | 'navigation'
  | 'notifications'
  | 'settings';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All sheet sides
 */
export const SHEET_SIDES: SheetSide[] = ['right', 'left', 'top', 'bottom'];

/**
 * All sheet sizes
 */
export const SHEET_SIZES: SheetSize[] = ['sm', 'default', 'lg', 'xl', 'full'];

/**
 * All content types
 */
export const SHEET_CONTENT_TYPES: SheetContentType[] = [
  'form',
  'settings',
  'navigation',
  'filters',
  'details',
  'notifications',
  'cart',
  'menu',
  'comments',
  'confirmation',
];

/**
 * Size to className mapping (for right/left sheets)
 */
export const SIZE_CLASSES_HORIZONTAL: Record<SheetSize, string> = {
  sm: i18n.t('factory.sheet.w64Smmaxw64', 'w-64 sm:max-w-64'),
  default: i18n.t('factory.sheet.w34Smmaxwsm', 'w-3/4 sm:max-w-sm'),
  lg: i18n.t('factory.sheet.w34Smmaxwlg', 'w-3/4 sm:max-w-lg'),
  xl: i18n.t('factory.sheet.w34Smmaxwxl', 'w-3/4 sm:max-w-xl'),
  full: 'w-full',
};

/**
 * Size to className mapping (for top/bottom sheets)
 */
export const SIZE_CLASSES_VERTICAL: Record<SheetSize, string> = {
  sm: 'h-32',
  default: 'h-auto',
  lg: 'h-1/2',
  xl: 'h-3/4',
  full: 'h-full',
};

/**
 * Common sheet titles
 */
export const SHEET_TITLES = [
  i18n.t('factory.sheet.settings', 'Settings'),
  i18n.t('factory.sheet.editProfile', 'Edit Profile'),
  i18n.t('factory.sheet.filters', 'Filters'),
  i18n.t('factory.sheet.navigation', 'Navigation'),
  i18n.t('factory.sheet.quickActions', 'Quick Actions'),
  i18n.t('factory.sheet.details', 'Details'),
  i18n.t('factory.sheet.notifications', 'Notifications'),
  i18n.t('factory.sheet.shoppingCart', 'Shopping Cart'),
  i18n.t('factory.sheet.comments', 'Comments'),
  i18n.t('factory.sheet.confirmation', 'Confirmation'),
];

/**
 * Common action labels
 */
export const ACTION_LABELS = {
  cancel: [
    i18n.t('factory.sheet.cancel', 'Cancel'),
    i18n.t('factory.sheet.close', 'Close'),
    i18n.t('factory.sheet.dismiss', 'Dismiss'),
    i18n.t('factory.sheet.back', 'Back'),
  ],
  confirm: [
    i18n.t('factory.sheet.save', 'Save'),
    i18n.t('factory.sheet.apply', 'Apply'),
    i18n.t('factory.sheet.confirm', 'Confirm'),
    i18n.t('factory.sheet.submit', 'Submit'),
    i18n.t('factory.sheet.update', 'Update'),
    i18n.t('factory.sheet.done', 'Done'),
  ],
  destructive: [
    i18n.t('factory.sheet.delete', 'Delete'),
    i18n.t('factory.sheet.remove', 'Remove'),
    i18n.t('factory.sheet.clear', 'Clear'),
    i18n.t('factory.sheet.reset', 'Reset'),
  ],
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Sheet configuration
 */
export interface FakeSheet {
  /** Cancel button label */
  cancelLabel: string;
  /** Confirm button label */
  confirmLabel: string;
  /** Sheet body content */
  content: string;
  /** Whether default open */
  defaultOpen: boolean;
  /** Description text */
  description: string;
  /** Whether action is destructive */
  destructive: boolean;
  /** Unique identifier */
  id: string;
  /** Whether modal (blocks outside interaction) */
  modal: boolean;
  /** Sheet side */
  side: SheetSide;
  /** Sheet size */
  size: SheetSize;
  /** Title text */
  title: string;
  /** Trigger button label */
  triggerLabel: string;
}

/**
 * Sheet with form fields
 */
export interface FakeSheetWithForm extends FakeSheet {
  /** Content type */
  contentType: 'form';
  /** Form fields */
  fields: FakeSheetFormField[];
}

/**
 * Sheet form field
 */
export interface FakeSheetFormField {
  /** Default value */
  defaultValue?: string;
  /** Unique identifier */
  id: string;
  /** Field label */
  label: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether required */
  required?: boolean;
  /** Field type */
  type: 'email' | 'password' | 'select' | 'text' | 'textarea';
}

/**
 * Sheet with navigation items
 */
export interface FakeSheetWithNavigation extends FakeSheet {
  /** Content type */
  contentType: 'navigation';
  /** Navigation items */
  items: FakeSheetNavItem[];
}

/**
 * Navigation item
 */
export interface FakeSheetNavItem {
  /** Whether active */
  active?: boolean;
  /** Item href */
  href: string;
  /** Icon name */
  icon?: string;
  /** Item label */
  label: string;
}

/**
 * Sheet with filter options
 */
export interface FakeSheetWithFilters extends FakeSheet {
  /** Content type */
  contentType: 'filters';
  /** Filter sections */
  sections: FakeSheetFilterSection[];
}

/**
 * Filter section
 */
export interface FakeSheetFilterSection {
  /** Filter options */
  options: FakeSheetFilterOption[];
  /** Section title */
  title: string;
}

/**
 * Filter option
 */
export interface FakeSheetFilterOption {
  /** Whether checked */
  checked?: boolean;
  /** Option label */
  label: string;
  /** Option value */
  value: string;
}

/**
 * Sheet with notification items
 */
export interface FakeSheetWithNotifications extends FakeSheet {
  /** Content type */
  contentType: 'notifications';
  /** Notification items */
  notifications: FakeSheetNotification[];
}

/**
 * Notification item
 */
export interface FakeSheetNotification {
  /** Unique identifier */
  id: string;
  /** Notification message */
  message: string;
  /** Whether read */
  read: boolean;
  /** Timestamp */
  timestamp: Date;
  /** Notification title */
  title: string;
  /** Notification type */
  type: 'error' | 'info' | 'success' | 'warning';
}

/**
 * Sheet with cart items
 */
export interface FakeSheetWithCart extends FakeSheet {
  /** Cart items */
  cartItems: FakeSheetCartItem[];
  /** Content type */
  contentType: 'cart';
  /** Total amount */
  total: number;
}

/**
 * Cart item
 */
export interface FakeSheetCartItem {
  /** Unique identifier */
  id: string;
  /** Item image URL */
  image?: string;
  /** Item name */
  name: string;
  /** Item price */
  price: number;
  /** Quantity */
  quantity: number;
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake sheet configuration
 * @param overrides - Optional property overrides
 * @returns A fake sheet configuration
 */
export function createFakeSheet(overrides?: Partial<FakeSheet>): FakeSheet {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement(SHEET_TITLES),
    description: faker.lorem.sentence(),
    content: faker.lorem.paragraph(),
    side: faker.helpers.arrayElement(SHEET_SIDES),
    size: faker.helpers.arrayElement(SHEET_SIZES),
    triggerLabel: i18n.t('factory.sheet.openLabel', 'Open {{panel}}', {
      panel: faker.helpers.arrayElement([
        i18n.t('factory.sheet.sheet', 'Sheet'),
        i18n.t('factory.sheet.panel', 'Panel'),
        i18n.t('factory.sheet.sidebar', 'Sidebar'),
        i18n.t('factory.sheet.menu', 'Menu'),
      ]),
    }),
    cancelLabel: faker.helpers.arrayElement(ACTION_LABELS.cancel),
    confirmLabel: faker.helpers.arrayElement(ACTION_LABELS.confirm),
    destructive: faker.datatype.boolean({ probability: 0.1 }),
    defaultOpen: false,
    modal: true,
    ...overrides,
  };
}

/**
 * Creates multiple fake sheets
 * @param count - Number of sheets to create
 * @param overrides - Optional property overrides
 * @returns Array of fake sheet configurations
 */
export function createFakeSheets(count: number, overrides?: Partial<FakeSheet>): FakeSheet[] {
  return Array.from({ length: count }, () => createFakeSheet(overrides));
}

/**
 * Creates a fake form field
 * @param overrides - Optional property overrides
 * @returns A fake form field
 */
export function createFakeSheetFormField(
  overrides?: Partial<FakeSheetFormField>
): FakeSheetFormField {
  const type = overrides?.type ?? faker.helpers.arrayElement(['text', 'email', 'textarea']);
  const label = faker.helpers.arrayElement([
    i18n.t('factory.sheet.name', 'Name'),
    i18n.t('factory.sheet.email', 'Email'),
    i18n.t('factory.sheet.phone', 'Phone'),
    i18n.t('factory.sheet.address', 'Address'),
    i18n.t('factory.sheet.bio', 'Bio'),
    i18n.t('factory.sheet.notes', 'Notes'),
  ]);

  return {
    id: faker.string.uuid(),
    label,
    type,
    placeholder: i18n.t('factory.sheet.enterPlaceholder', 'Enter {{label}}...', {
      label: label.toLowerCase(),
    }),
    defaultValue: faker.helpers.maybe(() => faker.person.fullName(), { probability: 0.3 }),
    required: faker.datatype.boolean({ probability: 0.4 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake form fields
 * @param count - Number of fields to create
 * @returns Array of fake form fields
 */
export function createFakeSheetFormFields(count: number): FakeSheetFormField[] {
  const commonFields: Array<Partial<FakeSheetFormField>> = [
    {
      label: i18n.t('factory.sheet.name', 'Name'),
      type: 'text',
      placeholder: i18n.t('factory.sheet.enterYourName', 'Enter your name'),
    },
    {
      label: i18n.t('factory.sheet.email', 'Email'),
      type: 'email',
      placeholder: i18n.t('factory.sheet.enterYourEmail', 'Enter your email'),
    },
    {
      label: i18n.t('factory.sheet.bio', 'Bio'),
      type: 'textarea',
      placeholder: i18n.t('factory.sheet.tellUsAboutYourself', 'Tell us about yourself'),
    },
  ];

  return Array.from({ length: count }, (_, i) =>
    createFakeSheetFormField(commonFields[i % commonFields.length])
  );
}

/**
 * Creates a fake navigation item
 * @param overrides - Optional property overrides
 * @returns A fake navigation item
 */
export function createFakeSheetNavItem(overrides?: Partial<FakeSheetNavItem>): FakeSheetNavItem {
  const label = faker.helpers.arrayElement([
    i18n.t('factory.sheet.dashboard', 'Dashboard'),
    i18n.t('factory.sheet.projects', 'Projects'),
    i18n.t('factory.sheet.team', 'Team'),
    i18n.t('factory.sheet.calendar', 'Calendar'),
    i18n.t('factory.sheet.documents', 'Documents'),
    i18n.t('factory.sheet.reports', 'Reports'),
    i18n.t('factory.sheet.settings', 'Settings'),
  ]);

  return {
    label,
    href: `/${label.toLowerCase()}`,
    icon: label,
    active: faker.datatype.boolean({ probability: 0.15 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake navigation items
 * @param count - Number of items to create
 * @returns Array of fake navigation items
 */
export function createFakeSheetNavItems(count: number): FakeSheetNavItem[] {
  const navLabels = [
    i18n.t('factory.sheet.dashboard', 'Dashboard'),
    i18n.t('factory.sheet.projects', 'Projects'),
    i18n.t('factory.sheet.team', 'Team'),
    i18n.t('factory.sheet.calendar', 'Calendar'),
    i18n.t('factory.sheet.documents', 'Documents'),
    i18n.t('factory.sheet.reports', 'Reports'),
    i18n.t('factory.sheet.settings', 'Settings'),
  ];
  return navLabels.slice(0, count).map((label, i) => ({
    label,
    href: `/${label.toLowerCase()}`,
    icon: label,
    active: i === 0,
  }));
}

/**
 * Creates a fake notification
 * @param overrides - Optional property overrides
 * @returns A fake notification
 */
export function createFakeSheetNotification(
  overrides?: Partial<FakeSheetNotification>
): FakeSheetNotification {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.sheet.newMessage', 'New message'),
      i18n.t('factory.sheet.taskCompleted', 'Task completed'),
      i18n.t('factory.sheet.meetingReminder', 'Meeting reminder'),
      i18n.t('factory.sheet.systemUpdate', 'System update'),
      i18n.t('factory.sheet.paymentReceived', 'Payment received'),
    ]),
    message: faker.lorem.sentence(),
    type: faker.helpers.arrayElement(['info', 'success', 'warning', 'error']),
    timestamp: faker.date.recent({ days: 7 }),
    read: faker.datatype.boolean({ probability: 0.4 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake notifications
 * @param count - Number of notifications to create
 * @returns Array of fake notifications
 */
export function createFakeSheetNotifications(count: number): FakeSheetNotification[] {
  return Array.from({ length: count }, () => createFakeSheetNotification());
}

/**
 * Creates a fake cart item
 * @param overrides - Optional property overrides
 * @returns A fake cart item
 */
export function createFakeSheetCartItem(overrides?: Partial<FakeSheetCartItem>): FakeSheetCartItem {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    price: Number.parseFloat(faker.commerce.price({ min: 10, max: 200 })),
    quantity: faker.number.int({ min: 1, max: 5 }),
    image: faker.helpers.maybe(() => faker.image.urlPicsumPhotos({ width: 80, height: 80 }), {
      probability: 0.7,
    }),
    ...overrides,
  };
}

/**
 * Creates multiple fake cart items
 * @param count - Number of items to create
 * @returns Array of fake cart items
 */
export function createFakeSheetCartItems(count: number): FakeSheetCartItem[] {
  return Array.from({ length: count }, () => createFakeSheetCartItem());
}

// ============================================================================
// SPECIALIZED CONTENT TYPE FACTORIES
// ============================================================================

/**
 * Creates a sheet with form content
 * @param fieldCount - Number of form fields
 * @param overrides - Optional property overrides
 * @returns A sheet with form
 */
export function createFakeSheetWithForm(
  fieldCount: number = 3,
  overrides?: Partial<FakeSheetWithForm>
): FakeSheetWithForm {
  const base = createFakeSheet({
    title: i18n.t('factory.sheet.editProfile', 'Edit Profile'),
    description: i18n.t(
      'factory.sheet.makeChangesToYourProfile',
      'Make changes to your profile here.'
    ),
    side: 'right',
  });

  return {
    ...base,
    contentType: 'form',
    fields: createFakeSheetFormFields(fieldCount),
    ...overrides,
  };
}

/**
 * Creates a sheet with navigation content
 * @param itemCount - Number of nav items
 * @param overrides - Optional property overrides
 * @returns A sheet with navigation
 */
export function createFakeSheetWithNavigation(
  itemCount: number = 6,
  overrides?: Partial<FakeSheetWithNavigation>
): FakeSheetWithNavigation {
  const base = createFakeSheet({
    title: i18n.t('factory.sheet.navigation', 'Navigation'),
    description: i18n.t(
      'factory.sheet.navigateToDifferentSections',
      'Navigate to different sections.'
    ),
    side: 'left',
  });

  return {
    ...base,
    contentType: 'navigation',
    items: createFakeSheetNavItems(itemCount),
    ...overrides,
  };
}

/**
 * Creates a sheet with filters content
 * @param overrides - Optional property overrides
 * @returns A sheet with filters
 */
export function createFakeSheetWithFilters(
  overrides?: Partial<FakeSheetWithFilters>
): FakeSheetWithFilters {
  const base = createFakeSheet({
    title: i18n.t('factory.sheet.filters', 'Filters'),
    description: i18n.t('factory.sheet.refineYourSearchResults', 'Refine your search results.'),
    side: 'right',
    confirmLabel: i18n.t('factory.sheet.applyFilters', 'Apply Filters'),
    cancelLabel: i18n.t('factory.sheet.reset', 'Reset'),
  });

  const sections: FakeSheetFilterSection[] = [
    {
      title: i18n.t('factory.sheet.category', 'Category'),
      options: [
        {
          label: i18n.t('factory.sheet.electronics', 'Electronics'),
          value: 'electronics',
          checked: false,
        },
        { label: i18n.t('factory.sheet.clothing', 'Clothing'), value: 'clothing', checked: true },
        {
          label: i18n.t('factory.sheet.homeAndGarden', 'Home & Garden'),
          value: 'home',
          checked: false,
        },
        { label: i18n.t('factory.sheet.sports', 'Sports'), value: 'sports', checked: false },
      ],
    },
    {
      title: i18n.t('factory.sheet.priceRange', 'Price Range'),
      options: [
        { label: i18n.t('factory.sheet.under25', 'Under $25'), value: 'under-25', checked: false },
        { label: i18n.t('factory.sheet.price2550', '$25 - $50'), value: '25-50', checked: true },
        {
          label: i18n.t('factory.sheet.price50100', '$50 - $100'),
          value: '50-100',
          checked: false,
        },
        { label: i18n.t('factory.sheet.over100', 'Over $100'), value: 'over-100', checked: false },
      ],
    },
    {
      title: i18n.t('factory.sheet.rating', 'Rating'),
      options: [
        {
          label: i18n.t('factory.sheet.fourStarsUp', '4 stars & up'),
          value: '4-up',
          checked: true,
        },
        {
          label: i18n.t('factory.sheet.threeStarsUp', '3 stars & up'),
          value: '3-up',
          checked: false,
        },
        {
          label: i18n.t('factory.sheet.twoStarsUp', '2 stars & up'),
          value: '2-up',
          checked: false,
        },
      ],
    },
  ];

  return {
    ...base,
    contentType: 'filters',
    sections,
    ...overrides,
  };
}

/**
 * Creates a sheet with notifications content
 * @param notificationCount - Number of notifications
 * @param overrides - Optional property overrides
 * @returns A sheet with notifications
 */
export function createFakeSheetWithNotifications(
  notificationCount: number = 5,
  overrides?: Partial<FakeSheetWithNotifications>
): FakeSheetWithNotifications {
  const base = createFakeSheet({
    title: i18n.t('factory.sheet.notifications', 'Notifications'),
    description: i18n.t(
      'factory.sheet.notificationDescription',
      'You have {{count}} new notifications.',
      { count: notificationCount }
    ),
    side: 'right',
    confirmLabel: i18n.t('factory.sheet.markAllRead', 'Mark All Read'),
    cancelLabel: i18n.t('factory.sheet.close', 'Close'),
  });

  return {
    ...base,
    contentType: 'notifications',
    notifications: createFakeSheetNotifications(notificationCount),
    ...overrides,
  };
}

/**
 * Creates a sheet with cart content
 * @param itemCount - Number of cart items
 * @param overrides - Optional property overrides
 * @returns A sheet with cart
 */
export function createFakeSheetWithCart(
  itemCount: number = 3,
  overrides?: Partial<FakeSheetWithCart>
): FakeSheetWithCart {
  const cartItems = createFakeSheetCartItems(itemCount);
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const base = createFakeSheet({
    title: i18n.t('factory.sheet.shoppingCart', 'Shopping Cart'),
    description: i18n.t('factory.sheet.itemsInCart', '{{count}} items in your cart', {
      count: itemCount,
    }),
    side: 'right',
    confirmLabel: i18n.t('factory.sheet.checkout', 'Checkout'),
    cancelLabel: i18n.t('factory.sheet.continueShopping', 'Continue Shopping'),
  });

  return {
    ...base,
    contentType: 'cart',
    cartItems,
    total: Math.round(total * 100) / 100,
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED SIDE FACTORIES
// ============================================================================

/**
 * Creates a right-side sheet
 * @param overrides - Optional property overrides
 * @returns A right-side sheet
 */
export function createFakeRightSheet(overrides?: Partial<FakeSheet>): FakeSheet {
  return createFakeSheet({
    side: 'right',
    ...overrides,
  });
}

/**
 * Creates a left-side sheet (navigation style)
 * @param overrides - Optional property overrides
 * @returns A left-side sheet
 */
export function createFakeLeftSheet(overrides?: Partial<FakeSheet>): FakeSheet {
  return createFakeSheet({
    side: 'left',
    title: i18n.t('factory.sheet.menu', 'Menu'),
    ...overrides,
  });
}

/**
 * Creates a top sheet (notification bar style)
 * @param overrides - Optional property overrides
 * @returns A top sheet
 */
export function createFakeTopSheet(overrides?: Partial<FakeSheet>): FakeSheet {
  return createFakeSheet({
    side: 'top',
    title: i18n.t('factory.sheet.announcement', 'Announcement'),
    size: 'sm',
    ...overrides,
  });
}

/**
 * Creates a bottom sheet (action sheet style)
 * @param overrides - Optional property overrides
 * @returns A bottom sheet
 */
export function createFakeBottomSheet(overrides?: Partial<FakeSheet>): FakeSheet {
  return createFakeSheet({
    side: 'bottom',
    title: i18n.t('factory.sheet.actions', 'Actions'),
    ...overrides,
  });
}

// ============================================================================
// SPECIALIZED SIZE FACTORIES
// ============================================================================

/**
 * Creates a small sheet
 * @param overrides - Optional property overrides
 * @returns A small sheet
 */
export function createFakeSmallSheet(overrides?: Partial<FakeSheet>): FakeSheet {
  return createFakeSheet({
    size: 'sm',
    ...overrides,
  });
}

/**
 * Creates a large sheet
 * @param overrides - Optional property overrides
 * @returns A large sheet
 */
export function createFakeLargeSheet(overrides?: Partial<FakeSheet>): FakeSheet {
  return createFakeSheet({
    size: 'lg',
    ...overrides,
  });
}

/**
 * Creates a full-width/height sheet
 * @param overrides - Optional property overrides
 * @returns A full-size sheet
 */
export function createFakeFullSheet(overrides?: Partial<FakeSheet>): FakeSheet {
  return createFakeSheet({
    size: 'full',
    ...overrides,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of sheets across sides
 * @returns Grid of sheets for each side
 */
export function createSheetSideMatrix(): FakeSheet[] {
  return SHEET_SIDES.map((side) =>
    createFakeSheet({
      side,
      title: i18n.t('factory.sheet.sideSheet', '{{side}} Sheet', {
        side: side.charAt(0).toUpperCase() + side.slice(1),
      }),
    })
  );
}

/**
 * Creates a matrix of sheets across sizes
 * @returns Grid of sheets for each size
 */
export function createSheetSizeMatrix(): FakeSheet[] {
  return SHEET_SIZES.map((size) =>
    createFakeSheet({
      size,
      title: i18n.t('factory.sheet.sizeLabel', '{{size}} Size', {
        size: size.charAt(0).toUpperCase() + size.slice(1),
      }),
    })
  );
}

/**
 * Creates a matrix of sheets across content types
 * @returns Grid of sheets for each content type
 */
export function createSheetContentTypeMatrix(): Array<
  | FakeSheet
  | FakeSheetWithCart
  | FakeSheetWithFilters
  | FakeSheetWithForm
  | FakeSheetWithNavigation
  | FakeSheetWithNotifications
> {
  return [
    createFakeSheetWithForm(),
    createFakeSheetWithNavigation(),
    createFakeSheetWithFilters(),
    createFakeSheetWithNotifications(),
    createFakeSheetWithCart(),
  ];
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all sheet configurations
 * @returns Array of sheet configs for showcase
 */
export function createSheetShowcase(): Array<{
  description: string;
  name: string;
  sheet:
    | FakeSheet
    | FakeSheetWithCart
    | FakeSheetWithFilters
    | FakeSheetWithForm
    | FakeSheetWithNavigation
    | FakeSheetWithNotifications;
}> {
  return [
    {
      name: i18n.t('factory.sheet.basicRight', 'Basic Right'),
      description: i18n.t('factory.sheet.standardRightsideSheet', 'Standard right-side sheet'),
      sheet: createFakeRightSheet(),
    },
    {
      name: i18n.t('factory.sheet.navigationLeft', 'Navigation Left'),
      description: i18n.t('factory.sheet.leftsideNavigationMenu', 'Left-side navigation menu'),
      sheet: createFakeSheetWithNavigation(),
    },
    {
      name: i18n.t('factory.sheet.topNotification', 'Top Notification'),
      description: i18n.t('factory.sheet.topSheetForAnnouncements', 'Top sheet for announcements'),
      sheet: createFakeTopSheet(),
    },
    {
      name: i18n.t('factory.sheet.bottomActions', 'Bottom Actions'),
      description: i18n.t('factory.sheet.bottomSheetForActions', 'Bottom sheet for actions'),
      sheet: createFakeBottomSheet(),
    },
    {
      name: i18n.t('factory.sheet.editForm', 'Edit Form'),
      description: i18n.t('factory.sheet.sheetWithFormFields', 'Sheet with form fields'),
      sheet: createFakeSheetWithForm(),
    },
    {
      name: i18n.t('factory.sheet.filters', 'Filters'),
      description: i18n.t('factory.sheet.filterPanelWithOptions', 'Filter panel with options'),
      sheet: createFakeSheetWithFilters(),
    },
    {
      name: i18n.t('factory.sheet.notifications', 'Notifications'),
      description: i18n.t('factory.sheet.notificationCenter', 'Notification center'),
      sheet: createFakeSheetWithNotifications(),
    },
    {
      name: i18n.t('factory.sheet.shoppingCart', 'Shopping Cart'),
      description: i18n.t('factory.sheet.ecommerceCartSheet', 'E-commerce cart sheet'),
      sheet: createFakeSheetWithCart(),
    },
    {
      name: i18n.t('factory.sheet.small', 'Small'),
      description: i18n.t('factory.sheet.compactSheet', 'Compact sheet'),
      sheet: createFakeSmallSheet(),
    },
    {
      name: i18n.t('factory.sheet.large', 'Large'),
      description: i18n.t('factory.sheet.wideSheet', 'Wide sheet'),
      sheet: createFakeLargeSheet(),
    },
    {
      name: i18n.t('factory.sheet.full', 'Full'),
      description: i18n.t('factory.sheet.fullsizeOverlay', 'Full-size overlay'),
      sheet: createFakeFullSheet(),
    },
  ];
}

// ============================================================================
// TEST DATA FACTORY
// ============================================================================

/**
 * Creates a complete test data set for sheet testing
 * @returns Comprehensive test data
 */
export function createSheetTestData(): {
  basicSheet: FakeSheet;
  bottomSheet: FakeSheet;
  cartItems: FakeSheetCartItem[];
  cartSheet: FakeSheetWithCart;
  contentTypeMatrix: Array<
    | FakeSheet
    | FakeSheetWithCart
    | FakeSheetWithFilters
    | FakeSheetWithForm
    | FakeSheetWithNavigation
    | FakeSheetWithNotifications
  >;
  filtersSheet: FakeSheetWithFilters;
  formFields: FakeSheetFormField[];
  formSheet: FakeSheetWithForm;
  fullSheet: FakeSheet;
  largeSheet: FakeSheet;
  leftSheet: FakeSheet;
  navigationSheet: FakeSheetWithNavigation;
  navItems: FakeSheetNavItem[];
  notifications: FakeSheetNotification[];
  notificationsSheet: FakeSheetWithNotifications;
  rightSheet: FakeSheet;
  sheets: FakeSheet[];
  showcase: Array<{
    description: string;
    name: string;
    sheet:
      | FakeSheet
      | FakeSheetWithCart
      | FakeSheetWithFilters
      | FakeSheetWithForm
      | FakeSheetWithNavigation
      | FakeSheetWithNotifications;
  }>;
  sideMatrix: FakeSheet[];
  sizeMatrix: FakeSheet[];
  smallSheet: FakeSheet;
  topSheet: FakeSheet;
} {
  return {
    sheets: createFakeSheets(5),
    basicSheet: createFakeSheet(),
    rightSheet: createFakeRightSheet(),
    leftSheet: createFakeLeftSheet(),
    topSheet: createFakeTopSheet(),
    bottomSheet: createFakeBottomSheet(),
    smallSheet: createFakeSmallSheet(),
    largeSheet: createFakeLargeSheet(),
    fullSheet: createFakeFullSheet(),
    formSheet: createFakeSheetWithForm(),
    navigationSheet: createFakeSheetWithNavigation(),
    filtersSheet: createFakeSheetWithFilters(),
    notificationsSheet: createFakeSheetWithNotifications(),
    cartSheet: createFakeSheetWithCart(),
    formFields: createFakeSheetFormFields(5),
    navItems: createFakeSheetNavItems(7),
    notifications: createFakeSheetNotifications(10),
    cartItems: createFakeSheetCartItems(5),
    sideMatrix: createSheetSideMatrix(),
    sizeMatrix: createSheetSizeMatrix(),
    contentTypeMatrix: createSheetContentTypeMatrix(),
    showcase: createSheetShowcase(),
  };
}

// ============================================================================
// ARIA/ACCESSIBILITY FACTORIES
// ============================================================================

/**
 * ARIA configuration for sheet dialog pattern
 */
export interface SheetAriaConfig {
  /** Whether aria-modal is true */
  ariaModal: boolean;
  /** ID for aria-describedby */
  descriptionId: string;
  /** Initial focus element selector */
  initialFocus?: string;
  /** Whether to restore focus on close */
  restoreFocus: boolean;
  /** The dialog role */
  role: 'alertdialog' | 'dialog';
  /** ID for aria-labelledby */
  titleId: string;
}

/**
 * Creates an ARIA configuration for a sheet
 * @param overrides - Optional property overrides
 * @returns ARIA configuration
 */
export function createFakeSheetAriaConfig(overrides?: Partial<SheetAriaConfig>): SheetAriaConfig {
  const id = faker.string.alphanumeric(8);
  return {
    role: 'dialog',
    ariaModal: true,
    titleId: `sheet-title-${id}`,
    descriptionId: `sheet-description-${id}`,
    initialFocus: faker.helpers.maybe(() => '[data-autofocus]', { probability: 0.5 }),
    restoreFocus: true,
    ...overrides,
  };
}

// ============================================================================
// ANIMATION FACTORIES
// ============================================================================

/**
 * Sheet animation configuration
 */
export interface SheetAnimationConfig {
  /** Close animation duration in ms */
  closeDuration: number;
  /** Easing function */
  easing: 'ease-in-out' | 'ease-in' | 'ease-out' | 'ease' | 'linear';
  /** Open animation duration in ms */
  openDuration: number;
  /** Slide animation type */
  slideType:
    | 'slide-in-from-bottom'
    | 'slide-in-from-left'
    | 'slide-in-from-right'
    | 'slide-in-from-top';
}

/**
 * Creates an animation configuration for a sheet
 * @param side - The side from which the sheet slides
 * @param overrides - Optional property overrides
 * @returns Animation configuration
 */
export function createFakeSheetAnimationConfig(
  side: SheetSide = 'right',
  overrides?: Partial<SheetAnimationConfig>
): SheetAnimationConfig {
  const slideTypes: Record<SheetSide, SheetAnimationConfig['slideType']> = {
    right: 'slide-in-from-right',
    left: 'slide-in-from-left',
    top: 'slide-in-from-top',
    bottom: 'slide-in-from-bottom',
  };

  return {
    slideType: slideTypes[side],
    openDuration: 500,
    closeDuration: 300,
    easing: 'ease-in-out',
    ...overrides,
  };
}

// ============================================================================
// OVERLAY FACTORIES
// ============================================================================

/**
 * Sheet overlay configuration
 */
export interface SheetOverlayConfig {
  /** Overlay background opacity (0-100) */
  backgroundOpacity: number;
  /** Whether clicking overlay closes sheet */
  closeOnClick: boolean;
  /** Whether ESC key closes sheet */
  closeOnEscape: boolean;
  /** Whether overlay has blur effect */
  hasBlur: boolean;
  /** Overlay z-index */
  zIndex: number;
}

/**
 * Creates an overlay configuration for a sheet
 * @param overrides - Optional property overrides
 * @returns Overlay configuration
 */
export function createFakeSheetOverlayConfig(
  overrides?: Partial<SheetOverlayConfig>
): SheetOverlayConfig {
  return {
    backgroundOpacity: 50,
    closeOnClick: true,
    closeOnEscape: true,
    hasBlur: faker.datatype.boolean({ probability: 0.3 }),
    zIndex: 50,
    ...overrides,
  };
}

// ============================================================================
// FOCUS TRAP FACTORIES
// ============================================================================

/**
 * Focusable element in sheet
 */
export interface SheetFocusableElement {
  /** Whether auto-focused on open */
  autoFocus?: boolean;
  /** HTML element type */
  element: 'button' | 'input' | 'select' | 'textarea';
  /** Element label */
  label: string;
  /** Tab index */
  tabIndex: number;
  /** Test ID */
  testId: string;
}

/**
 * Creates a list of focusable elements for focus trap testing
 * @param count - Number of elements to create
 * @returns Array of focusable elements
 */
export function createFakeSheetFocusableElements(count: number = 5): SheetFocusableElement[] {
  const elements: SheetFocusableElement['element'][] = [
    'input',
    'input',
    'textarea',
    'button',
    'button',
  ];
  const labels = [
    i18n.t('factory.sheet.firstName', 'First Name'),
    i18n.t('factory.sheet.email', 'Email'),
    i18n.t('factory.sheet.message', 'Message'),
    i18n.t('factory.sheet.cancel', 'Cancel'),
    i18n.t('factory.sheet.submit', 'Submit'),
  ];

  return Array.from({ length: Math.min(count, elements.length) }, (_, i) => ({
    element: elements[i],
    label: labels[i],
    testId: `focus-element-${i + 1}`,
    tabIndex: 0,
    autoFocus: i === 0,
  }));
}

// ============================================================================
// DARK MODE FACTORIES
// ============================================================================

/**
 * Sheet dark mode configuration
 */
export interface SheetDarkModeConfig {
  /** Background color in dark mode */
  backgroundColor: string;
  /** Border color in dark mode */
  borderColor: string;
  /** Whether dark mode is enabled */
  enabled: boolean;
  /** Overlay color in dark mode */
  overlayColor: string;
  /** Text color in dark mode */
  textColor: string;
}

/**
 * Creates a dark mode configuration for a sheet
 * @param enabled - Whether dark mode is enabled
 * @returns Dark mode configuration
 */
export function createFakeSheetDarkModeConfig(enabled: boolean = true): SheetDarkModeConfig {
  return {
    enabled,
    backgroundColor: enabled ? 'hsl(var(--background))' : 'white',
    textColor: enabled ? 'hsl(var(--foreground))' : 'black',
    borderColor: enabled ? 'hsl(240 3.7% 15.9%)' : 'hsl(240 5.9% 90%)',
    overlayColor: enabled ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
  };
}

// ============================================================================
// COMPREHENSIVE SHEET CONFIG
// ============================================================================

/**
 * Comprehensive sheet configuration combining all aspects
 */
export interface ComprehensiveSheetConfig {
  /** Animation configuration */
  animation: SheetAnimationConfig;
  /** ARIA configuration */
  aria: SheetAriaConfig;
  /** Base sheet configuration */
  base: FakeSheet;
  /** Dark mode configuration */
  darkMode: SheetDarkModeConfig;
  /** Focusable elements */
  focusableElements: SheetFocusableElement[];
  /** Overlay configuration */
  overlay: SheetOverlayConfig;
}

/**
 * Creates a comprehensive sheet configuration for testing
 * @param side - The side from which the sheet slides
 * @param isDarkMode - Whether dark mode is enabled
 * @returns Comprehensive configuration
 */
export function createComprehensiveSheetConfig(
  side: SheetSide = 'right',
  isDarkMode: boolean = false
): ComprehensiveSheetConfig {
  return {
    base: createFakeSheet({ side }),
    aria: createFakeSheetAriaConfig(),
    animation: createFakeSheetAnimationConfig(side),
    overlay: createFakeSheetOverlayConfig(),
    focusableElements: createFakeSheetFocusableElements(5),
    darkMode: createFakeSheetDarkModeConfig(isDarkMode),
  };
}

/**
 * Creates comprehensive sheet configs for all sides
 * @param isDarkMode - Whether dark mode is enabled
 * @returns Array of comprehensive configs for each side
 */
export function createComprehensiveSheetConfigMatrix(
  isDarkMode: boolean = false
): ComprehensiveSheetConfig[] {
  return SHEET_SIDES.map((side) => createComprehensiveSheetConfig(side, isDarkMode));
}
