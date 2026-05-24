import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ TYPE DEFINITIONS ============

/** Icon size option */
export type IconSize = 'lg' | 'md' | 'sm' | 'xl' | 'xs';

/** Interface for fake icon data */
export interface FakeIcon {
  /** Optional aria-label for informative icons */
  ariaLabel?: string;
  /** CSS class name */
  className: string;
  /** Unique identifier */
  id: string;
  /** Lucide icon name */
  name: string;
  /** Size class */
  size: IconSize;
  /** Optional title for tooltip */
  title?: string;
}

/** Interface for icon group config */
export interface FakeIconGroup {
  /** Category label */
  category: string;
  /** Icons in this group */
  icons: FakeIcon[];
}

// ============ CONSTANTS FOR ITERATION ============

/** All icon size options */
export const ICON_SIZES: IconSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

/** Size to class mapping */
export const ICON_SIZE_CLASSES: Record<IconSize, string> = {
  lg: 'size-6',
  md: 'size-5',
  sm: 'size-4',
  xl: 'size-8',
  xs: 'size-3',
};

/** Common Lucide icon names for test data */
export const ICON_NAMES = [
  'AlertCircle',
  'ArrowRight',
  i18n.t('factory.icon.check', 'Check'),
  'ChevronDown',
  i18n.t('factory.icon.copy', 'Copy'),
  i18n.t('factory.icon.download', 'Download'),
  i18n.t('factory.icon.edit', 'Edit'),
  'Eye',
  i18n.t('factory.icon.file', 'File'),
  i18n.t('factory.icon.heart', 'Heart'),
  i18n.t('factory.icon.home', 'Home'),
  i18n.t('factory.icon.info', 'Info'),
  i18n.t('factory.icon.mail', 'Mail'),
  i18n.t('factory.icon.plus', 'Plus'),
  i18n.t('factory.icon.search', 'Search'),
  i18n.t('factory.icon.settings', 'Settings'),
  i18n.t('factory.icon.star', 'Star'),
  i18n.t('factory.icon.trash', 'Trash'),
  i18n.t('factory.icon.upload', 'Upload'),
  i18n.t('factory.icon.user', 'User'),
];

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake icon
 * @param overrides - Optional partial overrides
 * @returns A fake icon
 */
export function createFakeIcon(overrides?: Partial<FakeIcon>): FakeIcon {
  const size = faker.helpers.arrayElement(ICON_SIZES);

  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement(ICON_NAMES),
    size,
    className: ICON_SIZE_CLASSES[size],
    ariaLabel: faker.helpers.maybe(() => faker.lorem.words(2), { probability: 0.3 }),
    title: faker.helpers.maybe(() => faker.lorem.words(3), { probability: 0.2 }),
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake icons
 * @param count - Number of icons to generate
 * @returns Array of fake icons
 */
export function createFakeIcons(count: number): FakeIcon[] {
  return Array.from({ length: count }, () => createFakeIcon());
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a decorative icon (no aria-label)
 * @param name - Icon name
 * @returns A decorative icon
 */
export function createFakeDecorativeIcon(name?: string): FakeIcon {
  return createFakeIcon({
    name: name ?? faker.helpers.arrayElement(ICON_NAMES),
    ariaLabel: undefined,
    title: undefined,
  });
}

/**
 * Creates an informative icon (with aria-label)
 * @param name - Icon name
 * @param label - Accessible label
 * @returns An informative icon
 */
export function createFakeInformativeIcon(name?: string, label?: string): FakeIcon {
  const iconName = name ?? faker.helpers.arrayElement(ICON_NAMES);

  return createFakeIcon({
    name: iconName,
    ariaLabel: label ?? iconName.replaceAll(/([A-Z])/g, ' $1').trim(),
  });
}

/**
 * Creates icons for all common names
 * @returns Array with one icon per name
 */
export function createFakeIconsByName(): FakeIcon[] {
  return ICON_NAMES.map((name) =>
    createFakeIcon({
      id: `icon-${name.toLowerCase()}`,
      name,
      size: 'md',
    })
  );
}

/**
 * Creates an icon group by category
 * @param category - Category label
 * @param names - Icon names in the group
 * @returns An icon group
 */
export function createFakeIconGroup(category?: string, names?: string[]): FakeIconGroup {
  const iconNames = names ?? faker.helpers.arrayElements(ICON_NAMES, 4);

  return {
    category: category ?? faker.lorem.word(),
    icons: iconNames.map((name) => createFakeIcon({ name })),
  };
}
