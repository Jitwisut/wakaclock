import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// SEPARATOR FACTORY
// ============================================================================
// Comprehensive test data factories for the Separator component.
// Follows the Button factory pattern with type exports, constants, and
// specialized factories for different separator configurations.
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Separator orientation
 * @description Direction of the separator line
 */
export type SeparatorOrientation = 'horizontal' | 'vertical';

/**
 * Separator thickness
 * @description Visual thickness of the separator line
 */
export type SeparatorThickness = 'default' | 'thick' | 'thin';

/**
 * Separator style
 * @description Visual style of the separator
 */
export type SeparatorStyle = 'dashed' | 'dotted' | 'solid';

/**
 * Separator color
 * @description Color theme for the separator
 */
export type SeparatorColor =
  | 'accent'
  | 'border'
  | 'destructive'
  | 'muted'
  | 'primary'
  | 'secondary';

/**
 * Separator context/usage
 * @description Common use cases for separators
 */
export type SeparatorContext =
  | 'breadcrumb'
  | 'card'
  | 'form'
  | 'list'
  | 'navigation'
  | 'sidebar'
  | 'toolbar';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All separator orientations
 */
export const SEPARATOR_ORIENTATIONS: SeparatorOrientation[] = ['horizontal', 'vertical'];

/**
 * All thickness options
 */
export const SEPARATOR_THICKNESSES: SeparatorThickness[] = ['thin', 'default', 'thick'];

/**
 * All separator styles
 */
export const SEPARATOR_STYLES: SeparatorStyle[] = ['solid', 'dashed', 'dotted'];

/**
 * All separator colors
 */
export const SEPARATOR_COLORS: SeparatorColor[] = [
  'border',
  'muted',
  'primary',
  'secondary',
  'accent',
  'destructive',
];

/**
 * All separator contexts
 */
export const SEPARATOR_CONTEXTS: SeparatorContext[] = [
  'toolbar',
  'navigation',
  'sidebar',
  'card',
  'form',
  'list',
  'breadcrumb',
];

/**
 * Thickness to className mapping
 */
export const THICKNESS_CLASSES: Record<SeparatorThickness, string> = {
  thin: 'h-px',
  default: '',
  thick: 'h-1',
};

/**
 * Thickness to className mapping for vertical orientation
 */
export const VERTICAL_THICKNESS_CLASSES: Record<SeparatorThickness, string> = {
  thin: 'w-px',
  default: '',
  thick: 'w-1',
};

/**
 * Color to className mapping
 */
export const COLOR_CLASSES: Record<SeparatorColor, string> = {
  border: 'bg-border',
  muted: 'bg-muted',
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  accent: 'bg-accent',
  destructive: 'bg-destructive',
};

/**
 * Common vertical heights for separators
 */
export const VERTICAL_HEIGHTS = ['h-4', 'h-5', 'h-6', 'h-8', 'h-10', 'h-12', 'h-full'];

/**
 * Common spacing classes for separators
 */
export const SPACING_CLASSES = ['my-1', 'my-2', 'my-3', 'my-4', 'my-6', 'my-8'];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Separator configuration
 */
export interface FakeSeparator {
  /** ARIA label for non-decorative separators */
  ariaLabel?: string;
  /** Additional CSS classes */
  className?: string;
  /** Color class */
  color: SeparatorColor;
  /** Whether separator is decorative (no semantic meaning) */
  decorative: boolean;
  /** Unique identifier */
  id: string;
  /** Separator orientation */
  orientation: SeparatorOrientation;
  /** Thickness variant */
  thickness: SeparatorThickness;
}

/**
 * Separator with context
 */
export interface FakeSeparatorInContext extends FakeSeparator {
  /** Content after the separator */
  contentAfter?: string;
  /** Content before the separator */
  contentBefore?: string;
  /** Usage context */
  context: SeparatorContext;
}

/**
 * Toolbar configuration with separators
 */
export interface FakeToolbarWithSeparators {
  /** Tool groups separated by vertical separators */
  groups: FakeToolGroup[];
  /** Unique identifier */
  id: string;
}

/**
 * Tool group in toolbar
 */
export interface FakeToolGroup {
  /** Tools in this group */
  items: FakeToolItem[];
  /** Group label */
  label: string;
}

/**
 * Tool item in toolbar
 */
export interface FakeToolItem {
  /** Tool icon name */
  icon: string;
  /** Tool label */
  label: string;
}

/**
 * Navigation with separators
 */
export interface FakeNavigationWithSeparators {
  /** Unique identifier */
  id: string;
  /** Navigation items */
  items: FakeNavItem[];
}

/**
 * Navigation item
 */
export interface FakeNavItem {
  /** Whether item is active */
  active?: boolean;
  /** Item href */
  href: string;
  /** Item label */
  label: string;
}

/**
 * Sidebar with separator groups
 */
export interface FakeSidebarWithSeparators {
  /** Sidebar groups */
  groups: FakeSidebarGroup[];
  /** Unique identifier */
  id: string;
}

/**
 * Sidebar group
 */
export interface FakeSidebarGroup {
  /** Items in group */
  items: FakeSidebarItem[];
  /** Group title (optional) */
  title?: string;
}

/**
 * Sidebar item
 */
export interface FakeSidebarItem {
  /** Item icon */
  icon?: string;
  /** Item label */
  label: string;
}

/**
 * Card with separator sections
 */
export interface FakeCardWithSeparators {
  /** Card description */
  description?: string;
  /** Footer content pairs */
  footer: Array<{ label: string; value: string }>;
  /** Unique identifier */
  id: string;
  /** Card title */
  title: string;
}

/**
 * Breadcrumb with separators
 */
export interface FakeBreadcrumbWithSeparators {
  /** Unique identifier */
  id: string;
  /** Breadcrumb items */
  items: FakeBreadcrumbItem[];
}

/**
 * Breadcrumb item
 */
export interface FakeBreadcrumbItem {
  /** Item href (undefined for current page) */
  href?: string;
  /** Whether this is the current page */
  isCurrent?: boolean;
  /** Item label */
  label: string;
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake separator configuration
 * @param overrides - Optional property overrides
 * @returns A fake separator configuration
 */
export function createFakeSeparator(overrides?: Partial<FakeSeparator>): FakeSeparator {
  const decorative = faker.datatype.boolean({ probability: 0.8 });
  return {
    id: faker.string.uuid(),
    orientation: faker.helpers.arrayElement(SEPARATOR_ORIENTATIONS),
    decorative,
    thickness: faker.helpers.arrayElement(SEPARATOR_THICKNESSES),
    color: faker.helpers.arrayElement(SEPARATOR_COLORS),
    className: faker.helpers.maybe(
      () => faker.helpers.arrayElement([...SPACING_CLASSES, ...VERTICAL_HEIGHTS]),
      { probability: 0.3 }
    ),
    ariaLabel: decorative
      ? undefined
      : faker.helpers.maybe(() => i18n.t('factory.separator.sectionDivider', 'Section divider'), {
          probability: 0.5,
        }),
    ...overrides,
  };
}

/**
 * Creates multiple fake separators
 * @param count - Number of separators to create
 * @param overrides - Optional property overrides
 * @returns Array of fake separator configurations
 */
export function createFakeSeparators(
  count: number,
  overrides?: Partial<FakeSeparator>
): FakeSeparator[] {
  return Array.from({ length: count }, () => createFakeSeparator(overrides));
}

/**
 * Creates a fake separator with context
 * @param overrides - Optional property overrides
 * @returns A fake separator with context
 */
export function createFakeSeparatorInContext(
  overrides?: Partial<FakeSeparatorInContext>
): FakeSeparatorInContext {
  const base = createFakeSeparator();
  return {
    ...base,
    context: faker.helpers.arrayElement(SEPARATOR_CONTEXTS),
    contentBefore: faker.lorem.words(2),
    contentAfter: faker.lorem.words(2),
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED CONTEXT FACTORIES
// ============================================================================

/**
 * Creates a horizontal separator
 * @param overrides - Optional property overrides
 * @returns A horizontal separator
 */
export function createFakeHorizontalSeparator(overrides?: Partial<FakeSeparator>): FakeSeparator {
  return createFakeSeparator({
    orientation: 'horizontal',
    ...overrides,
  });
}

/**
 * Creates a vertical separator
 * @param overrides - Optional property overrides
 * @returns A vertical separator
 */
export function createFakeVerticalSeparator(overrides?: Partial<FakeSeparator>): FakeSeparator {
  return createFakeSeparator({
    orientation: 'vertical',
    className: faker.helpers.arrayElement(VERTICAL_HEIGHTS),
    ...overrides,
  });
}

/**
 * Creates a toolbar separator (vertical, thin)
 * @returns A toolbar separator
 */
export function createFakeToolbarSeparator(): FakeSeparator {
  return createFakeSeparator({
    orientation: 'vertical',
    thickness: 'thin',
    decorative: true,
    className: 'h-6',
  });
}

/**
 * Creates a navigation separator (vertical, thin)
 * @returns A navigation separator
 */
export function createFakeNavigationSeparator(): FakeSeparator {
  return createFakeSeparator({
    orientation: 'vertical',
    thickness: 'thin',
    decorative: true,
    className: 'h-4',
  });
}

/**
 * Creates a sidebar separator (horizontal)
 * @returns A sidebar separator
 */
export function createFakeSidebarSeparator(): FakeSeparator {
  return createFakeSeparator({
    orientation: 'horizontal',
    thickness: 'default',
    decorative: true,
    className: 'my-2',
  });
}

/**
 * Creates a card separator (horizontal)
 * @returns A card separator
 */
export function createFakeCardSeparator(): FakeSeparator {
  return createFakeSeparator({
    orientation: 'horizontal',
    thickness: 'default',
    decorative: true,
    className: 'my-4',
  });
}

/**
 * Creates a form separator (horizontal)
 * @returns A form separator
 */
export function createFakeFormSeparator(): FakeSeparator {
  return createFakeSeparator({
    orientation: 'horizontal',
    thickness: 'default',
    decorative: false,
    ariaLabel: i18n.t('factory.separator.formSectionDivider', 'Form section divider'),
    className: 'my-6',
  });
}

/**
 * Creates a breadcrumb separator (vertical, small)
 * @returns A breadcrumb separator
 */
export function createFakeBreadcrumbSeparator(): FakeSeparator {
  return createFakeSeparator({
    orientation: 'vertical',
    thickness: 'thin',
    decorative: true,
    className: i18n.t('factory.separator.h4Mx2', 'h-4 mx-2'),
  });
}

// ============================================================================
// COMPOUND STRUCTURE FACTORIES
// ============================================================================

/**
 * Creates a toolbar with separator groups
 * @param groupCount - Number of tool groups
 * @returns A toolbar configuration
 */
export function createFakeToolbarWithSeparators(groupCount: number = 3): FakeToolbarWithSeparators {
  const iconSets = [
    [
      i18n.t('factory.separator.edit', 'Edit'),
      i18n.t('factory.separator.copy', 'Copy'),
      i18n.t('factory.separator.trash', 'Trash'),
    ],
    [
      i18n.t('factory.separator.upload', 'Upload'),
      i18n.t('factory.separator.download', 'Download'),
      i18n.t('factory.separator.share', 'Share'),
    ],
    [
      i18n.t('factory.separator.undo', 'Undo'),
      i18n.t('factory.separator.redo', 'Redo'),
      i18n.t('factory.separator.save', 'Save'),
    ],
    [
      i18n.t('factory.separator.bold', 'Bold'),
      i18n.t('factory.separator.italic', 'Italic'),
      i18n.t('factory.separator.underline', 'Underline'),
    ],
    ['AlignLeft', 'AlignCenter', 'AlignRight'],
  ];

  const groups: FakeToolGroup[] = Array.from({ length: groupCount }, (_, i) => ({
    label: faker.helpers.arrayElement([
      i18n.t('factory.separator.edit', 'Edit'),
      i18n.t('factory.separator.file', 'File'),
      i18n.t('factory.separator.format', 'Format'),
      i18n.t('factory.separator.view', 'View'),
      i18n.t('factory.separator.tools', 'Tools'),
    ]),
    items: (iconSets[i % iconSets.length] || iconSets[0]).map((icon) => ({
      icon,
      label: icon,
    })),
  }));

  return {
    id: faker.string.uuid(),
    groups,
  };
}

/**
 * Creates a navigation with separators
 * @param itemCount - Number of navigation items
 * @returns A navigation configuration
 */
export function createFakeNavigationWithSeparators(
  itemCount: number = 4
): FakeNavigationWithSeparators {
  const navItems = [
    i18n.t('factory.separator.home', 'Home'),
    i18n.t('factory.separator.about', 'About'),
    i18n.t('factory.separator.products', 'Products'),
    i18n.t('factory.separator.services', 'Services'),
    i18n.t('factory.separator.contact', 'Contact'),
    i18n.t('factory.separator.blog', 'Blog'),
  ];
  const items: FakeNavItem[] = navItems.slice(0, itemCount).map((label, i) => ({
    label,
    href: `#${label.toLowerCase()}`,
    active: i === 0,
  }));

  return {
    id: faker.string.uuid(),
    items,
  };
}

/**
 * Creates a sidebar with separator groups
 * @param groupCount - Number of sidebar groups
 * @returns A sidebar configuration
 */
export function createFakeSidebarWithSeparators(groupCount: number = 2): FakeSidebarWithSeparators {
  const mainItems = [
    i18n.t('factory.separator.dashboard', 'Dashboard'),
    i18n.t('factory.separator.projects', 'Projects'),
    i18n.t('factory.separator.tasks', 'Tasks'),
    i18n.t('factory.separator.calendar', 'Calendar'),
    i18n.t('factory.separator.reports', 'Reports'),
  ];
  const settingsItems = [
    i18n.t('factory.separator.settings', 'Settings'),
    i18n.t('factory.separator.help', 'Help'),
    i18n.t('factory.separator.logout', 'Logout'),
  ];

  const groups: FakeSidebarGroup[] = [];

  if (groupCount >= 1) {
    groups.push({
      title: i18n.t('factory.separator.main', 'Main'),
      items: mainItems.map((label) => ({
        label,
        icon: label,
      })),
    });
  }

  if (groupCount >= 2) {
    groups.push({
      title: i18n.t('factory.separator.account', 'Account'),
      items: settingsItems.map((label) => ({
        label,
        icon: label,
      })),
    });
  }

  return {
    id: faker.string.uuid(),
    groups,
  };
}

/**
 * Creates a card with separator sections
 * @returns A card configuration
 */
export function createFakeCardWithSeparators(): FakeCardWithSeparators {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.words(3),
    description: faker.lorem.sentence(),
    footer: [
      {
        label: i18n.t('factory.separator.status', 'Status'),
        value: faker.helpers.arrayElement([
          i18n.t('factory.separator.active', 'Active'),
          i18n.t('factory.separator.pending', 'Pending'),
          i18n.t('factory.separator.completed', 'Completed'),
        ]),
      },
      {
        label: i18n.t('factory.separator.priority', 'Priority'),
        value: faker.helpers.arrayElement([
          i18n.t('factory.separator.high', 'High'),
          i18n.t('factory.separator.medium', 'Medium'),
          i18n.t('factory.separator.low', 'Low'),
        ]),
      },
      {
        label: i18n.t('factory.separator.updated', 'Updated'),
        value: faker.date.recent().toLocaleDateString(),
      },
    ],
  };
}

/**
 * Creates a breadcrumb with separators
 * @param depth - Breadcrumb depth
 * @returns A breadcrumb configuration
 */
export function createFakeBreadcrumbWithSeparators(
  depth: number = 4
): FakeBreadcrumbWithSeparators {
  const pathParts = [
    i18n.t('factory.separator.home', 'Home'),
    i18n.t('factory.separator.products', 'Products'),
    i18n.t('factory.separator.category', 'Category'),
    i18n.t('factory.separator.subcategory', 'Subcategory'),
    i18n.t('factory.separator.item', 'Item'),
  ];
  const items: FakeBreadcrumbItem[] = pathParts.slice(0, depth).map((label, i, arr) => ({
    label,
    href: i === arr.length - 1 ? undefined : `/${label.toLowerCase()}`,
    isCurrent: i === arr.length - 1,
  }));

  return {
    id: faker.string.uuid(),
    items,
  };
}

// ============================================================================
// SPECIALIZED STATE FACTORIES
// ============================================================================

/**
 * Creates a decorative separator (no semantic meaning)
 * @returns A decorative separator
 */
export function createFakeDecorativeSeparator(): FakeSeparator {
  return createFakeSeparator({
    decorative: true,
    ariaLabel: undefined,
  });
}

/**
 * Creates a semantic separator (has meaning for assistive tech)
 * @param ariaLabel - ARIA label
 * @returns A semantic separator
 */
export function createFakeSemanticSeparator(
  ariaLabel: string = i18n.t('factory.separator.sectionDivider', 'Section divider')
): FakeSeparator {
  return createFakeSeparator({
    decorative: false,
    ariaLabel,
  });
}

/**
 * Creates a thick separator
 * @returns A thick separator
 */
export function createFakeThickSeparator(): FakeSeparator {
  return createFakeSeparator({
    thickness: 'thick',
    className: 'h-1',
  });
}

/**
 * Creates a colored separator
 * @param color - Separator color
 * @returns A colored separator
 */
export function createFakeColoredSeparator(color: SeparatorColor): FakeSeparator {
  return createFakeSeparator({
    color,
    className: COLOR_CLASSES[color],
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of separators across orientations
 * @returns Grid of separators for each orientation
 */
export function createSeparatorOrientationMatrix(): FakeSeparator[] {
  return SEPARATOR_ORIENTATIONS.map((orientation) => createFakeSeparator({ orientation }));
}

/**
 * Creates a matrix of separators across thicknesses
 * @returns Grid of separators for each thickness
 */
export function createSeparatorThicknessMatrix(): FakeSeparator[] {
  return SEPARATOR_THICKNESSES.map((thickness) =>
    createFakeSeparator({
      thickness,
      orientation: 'horizontal',
    })
  );
}

/**
 * Creates a matrix of separators across colors
 * @returns Grid of separators for each color
 */
export function createSeparatorColorMatrix(): FakeSeparator[] {
  return SEPARATOR_COLORS.map((color) =>
    createFakeSeparator({
      color,
      orientation: 'horizontal',
    })
  );
}

/**
 * Creates a matrix of context-specific separators
 * @returns Grid of context separators
 */
export function createSeparatorContextMatrix(): FakeSeparatorInContext[] {
  return SEPARATOR_CONTEXTS.map((context) =>
    createFakeSeparatorInContext({
      context,
      orientation: context === 'toolbar' || context === 'navigation' ? 'vertical' : 'horizontal',
    })
  );
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all separator configurations
 * @returns Array of separator configs for showcase
 */
export function createSeparatorShowcase(): Array<{
  description: string;
  name: string;
  separator: FakeSeparator;
}> {
  return [
    {
      name: i18n.t('factory.separator.horizontal', 'Horizontal'),
      description: i18n.t(
        'factory.separator.standardHorizontalSeparator',
        'Standard horizontal separator'
      ),
      separator: createFakeHorizontalSeparator(),
    },
    {
      name: i18n.t('factory.separator.vertical', 'Vertical'),
      description: i18n.t(
        'factory.separator.standardVerticalSeparator',
        'Standard vertical separator'
      ),
      separator: createFakeVerticalSeparator(),
    },
    {
      name: i18n.t('factory.separator.toolbar', 'Toolbar'),
      description: i18n.t(
        'factory.separator.thinVerticalSeparatorForToolbars',
        'Thin vertical separator for toolbars'
      ),
      separator: createFakeToolbarSeparator(),
    },
    {
      name: i18n.t('factory.separator.navigation', 'Navigation'),
      description: i18n.t(
        'factory.separator.smallSeparatorForNavItems',
        'Small separator for nav items'
      ),
      separator: createFakeNavigationSeparator(),
    },
    {
      name: i18n.t('factory.separator.sidebar', 'Sidebar'),
      description: i18n.t(
        'factory.separator.horizontalSeparatorBetweenSidebarSections',
        'Horizontal separator between sidebar sections'
      ),
      separator: createFakeSidebarSeparator(),
    },
    {
      name: i18n.t('factory.separator.card', 'Card'),
      description: i18n.t(
        'factory.separator.contentDividerWithinCards',
        'Content divider within cards'
      ),
      separator: createFakeCardSeparator(),
    },
    {
      name: i18n.t('factory.separator.form', 'Form'),
      description: i18n.t(
        'factory.separator.semanticSeparatorBetweenFormSections',
        'Semantic separator between form sections'
      ),
      separator: createFakeFormSeparator(),
    },
    {
      name: i18n.t('factory.separator.breadcrumb', 'Breadcrumb'),
      description: i18n.t(
        'factory.separator.smallVerticalSeparatorForBreadcrumbs',
        'Small vertical separator for breadcrumbs'
      ),
      separator: createFakeBreadcrumbSeparator(),
    },
    {
      name: i18n.t('factory.separator.decorative', 'Decorative'),
      description: i18n.t(
        'factory.separator.purelyVisualNoSemanticMeaning',
        'Purely visual, no semantic meaning'
      ),
      separator: createFakeDecorativeSeparator(),
    },
    {
      name: i18n.t('factory.separator.semantic', 'Semantic'),
      description: i18n.t(
        'factory.separator.hasMeaningForAssistiveTechnology',
        'Has meaning for assistive technology'
      ),
      separator: createFakeSemanticSeparator(),
    },
    {
      name: i18n.t('factory.separator.thick', 'Thick'),
      description: i18n.t('factory.separator.thickerVisualWeight', 'Thicker visual weight'),
      separator: createFakeThickSeparator(),
    },
    {
      name: i18n.t('factory.separator.primaryColor', 'Primary Color'),
      description: i18n.t(
        'factory.separator.separatorWithPrimaryColor',
        'Separator with primary color'
      ),
      separator: createFakeColoredSeparator('primary'),
    },
  ];
}

// ============================================================================
// TEST DATA FACTORY
// ============================================================================

/**
 * Creates a complete test data set for separator testing
 * @returns Comprehensive test data
 */
export function createSeparatorTestData(): {
  breadcrumb: FakeBreadcrumbWithSeparators;
  breadcrumbSeparator: FakeSeparator;
  card: FakeCardWithSeparators;
  cardSeparator: FakeSeparator;
  colorMatrix: FakeSeparator[];
  contextMatrix: FakeSeparatorInContext[];
  decorativeSeparator: FakeSeparator;
  formSeparator: FakeSeparator;
  horizontalSeparator: FakeSeparator;
  navigation: FakeNavigationWithSeparators;
  navigationSeparator: FakeSeparator;
  orientationMatrix: FakeSeparator[];
  semanticSeparator: FakeSeparator;
  separators: FakeSeparator[];
  showcase: Array<{
    description: string;
    name: string;
    separator: FakeSeparator;
  }>;
  sidebar: FakeSidebarWithSeparators;
  sidebarSeparator: FakeSeparator;
  thicknessMatrix: FakeSeparator[];
  toolbar: FakeToolbarWithSeparators;
  toolbarSeparator: FakeSeparator;
  verticalSeparator: FakeSeparator;
} {
  return {
    separators: createFakeSeparators(5),
    horizontalSeparator: createFakeHorizontalSeparator(),
    verticalSeparator: createFakeVerticalSeparator(),
    toolbarSeparator: createFakeToolbarSeparator(),
    navigationSeparator: createFakeNavigationSeparator(),
    sidebarSeparator: createFakeSidebarSeparator(),
    cardSeparator: createFakeCardSeparator(),
    formSeparator: createFakeFormSeparator(),
    breadcrumbSeparator: createFakeBreadcrumbSeparator(),
    decorativeSeparator: createFakeDecorativeSeparator(),
    semanticSeparator: createFakeSemanticSeparator(),
    toolbar: createFakeToolbarWithSeparators(),
    navigation: createFakeNavigationWithSeparators(),
    sidebar: createFakeSidebarWithSeparators(),
    card: createFakeCardWithSeparators(),
    breadcrumb: createFakeBreadcrumbWithSeparators(),
    orientationMatrix: createSeparatorOrientationMatrix(),
    thicknessMatrix: createSeparatorThicknessMatrix(),
    colorMatrix: createSeparatorColorMatrix(),
    contextMatrix: createSeparatorContextMatrix(),
    showcase: createSeparatorShowcase(),
  };
}
