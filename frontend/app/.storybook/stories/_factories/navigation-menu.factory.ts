import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// NAVIGATION MENU FACTORY
// ============================================================================
// Comprehensive test data factories for the NavigationMenu component.
// Follows the Button factory pattern with type exports, constants, and
// specialized factories for different navigation menu configurations.
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Navigation menu orientation options
 * @description Controls the layout direction of the menu
 */
export type NavigationMenuOrientation = 'horizontal' | 'vertical';

/**
 * Navigation menu content layout types
 * @description Defines how content is structured within dropdowns
 */
export type NavigationMenuContentLayout =
  | 'cards'
  | 'featured'
  | 'grid'
  | 'list'
  | 'mega'
  | 'simple';

/**
 * Navigation menu item type
 * @description Distinguishes between different item behaviors
 */
export type NavigationMenuItemType = 'group' | 'link' | 'trigger';

/**
 * Navigation menu link style variants
 * @description Controls visual presentation of links
 */
export type NavigationMenuLinkStyle = 'callout' | 'card' | 'default' | 'minimal';

/**
 * Navigation menu content position
 * @description Controls where content panel appears
 */
export type NavigationMenuContentPosition = 'center' | 'full' | 'left' | 'right';

/**
 * Navigation menu state
 * @description Represents the current interaction state
 */
export type NavigationMenuState = 'active' | 'default' | 'disabled' | 'hover';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All available orientations
 */
export const NAVIGATION_MENU_ORIENTATIONS: NavigationMenuOrientation[] = ['horizontal', 'vertical'];

/**
 * All content layout types
 */
export const NAVIGATION_MENU_CONTENT_LAYOUTS: NavigationMenuContentLayout[] = [
  'grid',
  'list',
  'featured',
  'mega',
  'simple',
  'cards',
];

/**
 * All item types
 */
export const NAVIGATION_MENU_ITEM_TYPES: NavigationMenuItemType[] = ['link', 'trigger', 'group'];

/**
 * All link style variants
 */
export const NAVIGATION_MENU_LINK_STYLES: NavigationMenuLinkStyle[] = [
  'default',
  'callout',
  'card',
  'minimal',
];

/**
 * All content positions
 */
export const NAVIGATION_MENU_CONTENT_POSITIONS: NavigationMenuContentPosition[] = [
  'left',
  'center',
  'right',
  'full',
];

/**
 * All interaction states
 */
export const NAVIGATION_MENU_STATES: NavigationMenuState[] = [
  'default',
  'hover',
  'active',
  'disabled',
];

/**
 * Common navigation menu labels for top-level items
 */
const NAVIGATION_LABELS = [
  i18n.t('factory.navigationMenu.products', 'Products'),
  i18n.t('factory.navigationMenu.solutions', 'Solutions'),
  i18n.t('factory.navigationMenu.resources', 'Resources'),
  i18n.t('factory.navigationMenu.pricing', 'Pricing'),
  i18n.t('factory.navigationMenu.company', 'Company'),
  i18n.t('factory.navigationMenu.developers', 'Developers'),
  i18n.t('factory.navigationMenu.support', 'Support'),
  i18n.t('factory.navigationMenu.documentation', 'Documentation'),
  i18n.t('factory.navigationMenu.blog', 'Blog'),
  i18n.t('factory.navigationMenu.about', 'About'),
  i18n.t('factory.navigationMenu.contact', 'Contact'),
  i18n.t('factory.navigationMenu.features', 'Features'),
  i18n.t('factory.navigationMenu.integrations', 'Integrations'),
  i18n.t('factory.navigationMenu.enterprise', 'Enterprise'),
  i18n.t('factory.navigationMenu.partners', 'Partners'),
];

/**
 * Product category labels
 */
const PRODUCT_LABELS = [
  i18n.t('factory.navigationMenu.analyticsPlatform', 'Analytics Platform'),
  i18n.t('factory.navigationMenu.dataPipeline', 'Data Pipeline'),
  i18n.t('factory.navigationMenu.mlToolkit', 'ML Toolkit'),
  i18n.t('factory.navigationMenu.apiGateway', 'API Gateway'),
  i18n.t('factory.navigationMenu.cloudStorage', 'Cloud Storage'),
  i18n.t('factory.navigationMenu.securitySuite', 'Security Suite'),
  i18n.t('factory.navigationMenu.devopsTools', 'DevOps Tools'),
  i18n.t('factory.navigationMenu.monitoring', 'Monitoring'),
  i18n.t('factory.navigationMenu.collaboration', 'Collaboration'),
  i18n.t('factory.navigationMenu.automation', 'Automation'),
];

/**
 * Resource type labels
 */
const RESOURCE_LABELS = [
  i18n.t('factory.navigationMenu.documentation', 'Documentation'),
  i18n.t('factory.navigationMenu.apiReference', 'API Reference'),
  i18n.t('factory.navigationMenu.tutorials', 'Tutorials'),
  i18n.t('factory.navigationMenu.caseStudies', 'Case Studies'),
  i18n.t('factory.navigationMenu.whitepapers', 'Whitepapers'),
  i18n.t('factory.navigationMenu.webinars', 'Webinars'),
  i18n.t('factory.navigationMenu.blogPosts', 'Blog Posts'),
  i18n.t('factory.navigationMenu.communityForum', 'Community Forum'),
  i18n.t('factory.navigationMenu.helpCenter', 'Help Center'),
  i18n.t('factory.navigationMenu.statusPage', 'Status Page'),
];

/**
 * Industry labels for mega menus
 */
const INDUSTRY_LABELS = [
  i18n.t('factory.navigationMenu.healthcare', 'Healthcare'),
  i18n.t('factory.navigationMenu.finance', 'Finance'),
  'E-commerce',
  i18n.t('factory.navigationMenu.education', 'Education'),
  i18n.t('factory.navigationMenu.manufacturing', 'Manufacturing'),
  i18n.t('factory.navigationMenu.technology', 'Technology'),
  i18n.t('factory.navigationMenu.media', 'Media'),
  i18n.t('factory.navigationMenu.realEstate', 'Real Estate'),
  i18n.t('factory.navigationMenu.logistics', 'Logistics'),
  i18n.t('factory.navigationMenu.government', 'Government'),
];

/**
 * Common icon names for navigation items
 */
const NAVIGATION_ICONS = [
  'home',
  'settings',
  'users',
  'file',
  'chart',
  'calendar',
  'inbox',
  'bell',
  'search',
  'folder',
  'star',
  'heart',
  'bookmark',
  'tag',
  'flag',
  'globe',
  'lock',
  'code',
  'database',
  'cloud',
  'shield',
  'zap',
  'layers',
  'grid',
  'box',
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base link item within navigation menu content
 */
export interface FakeNavigationMenuLink {
  /** Optional badge count */
  badge?: number;
  /** Longer description text */
  description?: string;
  /** Whether the link is disabled */
  disabled?: boolean;
  /** Target URL or route */
  href: string;
  /** Icon identifier */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Whether this is a new/featured item */
  isNew?: boolean;
  /** Display label */
  label: string;
  /** Visual style variant */
  style?: NavigationMenuLinkStyle;
}

/**
 * Featured/callout item for mega menus
 */
export interface FakeNavigationMenuFeaturedItem {
  /** Background color/gradient for the callout */
  background?: string;
  /** Call-to-action button label */
  ctaLabel?: string;
  /** Longer description */
  description: string;
  /** Target URL */
  href: string;
  /** Icon identifier */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Image URL for visual callouts */
  imageUrl?: string;
  /** Display title */
  title: string;
}

/**
 * Group of links within content
 */
export interface FakeNavigationMenuGroup {
  /** Unique identifier */
  id: string;
  /** Links within the group */
  links: FakeNavigationMenuLink[];
  /** Group heading */
  title: string;
}

/**
 * Content configuration for trigger items
 */
export interface FakeNavigationMenuContent {
  /** Featured/callout items */
  featuredItems?: FakeNavigationMenuFeaturedItem[];
  /** Grouped links */
  groups?: FakeNavigationMenuGroup[];
  /** Unique identifier */
  id: string;
  /** Layout style */
  layout: NavigationMenuContentLayout;
  /** Ungrouped links */
  links?: FakeNavigationMenuLink[];
  /** Content panel position */
  position?: NavigationMenuContentPosition;
  /** Content width class */
  width?: string;
}

/**
 * Navigation menu item (can be link or trigger with content)
 */
export interface FakeNavigationMenuItem {
  /** Content configuration for trigger items */
  content?: FakeNavigationMenuContent;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Target URL for direct links */
  href?: string;
  /** Icon identifier */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Item type */
  type: NavigationMenuItemType;
}

/**
 * Complete navigation menu configuration
 */
export interface FakeNavigationMenu {
  /** Current active/open item ID */
  activeItemId?: string;
  /** Unique identifier */
  id: string;
  /** Menu items */
  items: FakeNavigationMenuItem[];
  /** Menu orientation */
  orientation: NavigationMenuOrientation;
  /** Whether to show the indicator */
  showIndicator?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get icon for a navigation label
 */
function getIconForLabel(label: string): string {
  const labelLower = label.toLowerCase();
  if (labelLower.includes('product')) return 'box';
  if (labelLower.includes('solution')) return 'layers';
  if (labelLower.includes('resource')) return 'folder';
  if (labelLower.includes('pricing')) return 'tag';
  if (labelLower.includes('company') || labelLower.includes('about')) return 'users';
  if (labelLower.includes('developer') || labelLower.includes('api')) return 'code';
  if (labelLower.includes('support') || labelLower.includes('help')) return 'bell';
  if (labelLower.includes('doc')) return 'file';
  if (labelLower.includes('blog')) return 'bookmark';
  if (labelLower.includes('contact')) return 'inbox';
  if (labelLower.includes('security')) return 'shield';
  if (labelLower.includes('cloud')) return 'cloud';
  if (labelLower.includes('data') || labelLower.includes('analytics')) return 'chart';
  return faker.helpers.arrayElement(NAVIGATION_ICONS);
}

/**
 * Get content width class based on layout
 */
function getWidthForLayout(layout: NavigationMenuContentLayout): string {
  if (layout === 'mega') {
    return i18n.t('factory.navigationMenu.wscreenMaxw4xl', 'w-screen max-w-4xl');
  }
  if (layout === 'featured') return 'w-[500px]';
  if (layout === 'grid') return 'w-[400px]';
  if (layout === 'cards') return 'w-[600px]';
  if (layout === 'list') return 'w-[300px]';
  return 'w-[200px]';
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake navigation menu link
 * @param overrides - Optional property overrides
 * @returns A fake navigation menu link
 */
export function createFakeNavigationMenuLink(
  overrides?: Partial<FakeNavigationMenuLink>
): FakeNavigationMenuLink {
  const label =
    overrides?.label ??
    faker.helpers.arrayElement([...PRODUCT_LABELS, ...RESOURCE_LABELS, ...INDUSTRY_LABELS]);

  return {
    id: faker.string.uuid(),
    label,
    href: `/${faker.lorem.slug()}`,
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.6 }),
    icon: faker.helpers.maybe(() => getIconForLabel(label), { probability: 0.5 }),
    disabled: faker.datatype.boolean({ probability: 0.05 }),
    isNew: faker.datatype.boolean({ probability: 0.1 }),
    badge: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 99 }), {
      probability: 0.1,
    }),
    style: faker.helpers.maybe(() => faker.helpers.arrayElement(NAVIGATION_MENU_LINK_STYLES), {
      probability: 0.3,
    }),
    ...overrides,
  };
}

/**
 * Creates multiple fake navigation menu links
 * @param count - Number of links to create
 * @param overrides - Optional property overrides applied to all links
 * @returns Array of fake navigation menu links
 */
export function createFakeNavigationMenuLinks(
  count: number,
  overrides?: Partial<FakeNavigationMenuLink>
): FakeNavigationMenuLink[] {
  return Array.from({ length: count }, () => createFakeNavigationMenuLink(overrides));
}

/**
 * Creates a fake featured item for mega menus
 * @param overrides - Optional property overrides
 * @returns A fake featured item
 */
export function createFakeFeaturedItem(
  overrides?: Partial<FakeNavigationMenuFeaturedItem>
): FakeNavigationMenuFeaturedItem {
  return {
    id: faker.string.uuid(),
    title: faker.company.catchPhrase(),
    description: faker.lorem.sentences(2),
    href: `/${faker.lorem.slug()}`,
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(NAVIGATION_ICONS), {
      probability: 0.5,
    }),
    imageUrl: faker.helpers.maybe(() => faker.image.urlPicsumPhotos({ width: 400, height: 200 }), {
      probability: 0.3,
    }),
    ctaLabel: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.navigationMenu.learnMore', 'Learn More'),
          i18n.t('factory.navigationMenu.getStarted', 'Get Started'),
          i18n.t('factory.navigationMenu.tryFree', 'Try Free'),
          i18n.t('factory.navigationMenu.explore', 'Explore'),
        ]),
      { probability: 0.5 }
    ),
    background: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t(
            'factory.navigationMenu.bggradienttobrFromprimary10Toprimary5',
            'bg-gradient-to-br from-primary/10 to-primary/5'
          ),
          i18n.t(
            'factory.navigationMenu.bggradienttobrFromblue50010Topurple5005',
            'bg-gradient-to-br from-blue-500/10 to-purple-500/5'
          ),
          i18n.t(
            'factory.navigationMenu.bggradienttobrFromgreen50010Toteal5005',
            'bg-gradient-to-br from-green-500/10 to-teal-500/5'
          ),
          'bg-muted',
        ]),
      { probability: 0.4 }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake navigation menu group
 * @param linkCount - Number of links in the group
 * @param overrides - Optional property overrides
 * @returns A fake navigation menu group
 */
export function createFakeNavigationMenuGroup(
  linkCount: number = 4,
  overrides?: Partial<FakeNavigationMenuGroup>
): FakeNavigationMenuGroup {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.navigationMenu.gettingStarted', 'Getting Started'),
      i18n.t('factory.navigationMenu.coreFeatures', 'Core Features'),
      i18n.t('factory.navigationMenu.advanced', 'Advanced'),
      i18n.t('factory.navigationMenu.resources', 'Resources'),
      i18n.t('factory.navigationMenu.byIndustry', 'By Industry'),
      i18n.t('factory.navigationMenu.byUseCase', 'By Use Case'),
      i18n.t('factory.navigationMenu.popular', 'Popular'),
      i18n.t('factory.navigationMenu.recent', 'Recent'),
    ]),
    links: createFakeNavigationMenuLinks(linkCount),
    ...overrides,
  };
}

/**
 * Creates fake navigation menu content
 * @param layout - Content layout type
 * @param overrides - Optional property overrides
 * @returns A fake navigation menu content configuration
 */
export function createFakeNavigationMenuContent(
  layout: NavigationMenuContentLayout = 'grid',
  overrides?: Partial<FakeNavigationMenuContent>
): FakeNavigationMenuContent {
  const baseContent: FakeNavigationMenuContent = {
    id: faker.string.uuid(),
    layout,
    width: getWidthForLayout(layout),
    position: faker.helpers.arrayElement(NAVIGATION_MENU_CONTENT_POSITIONS),
    ...overrides,
  };

  // Add appropriate content based on layout
  if (layout === 'mega') {
    return {
      ...baseContent,
      featuredItems: [createFakeFeaturedItem()],
      groups: Array.from({ length: 3 }, () =>
        createFakeNavigationMenuGroup(faker.number.int({ min: 3, max: 5 }))
      ),
    };
  }

  if (layout === 'featured') {
    return {
      ...baseContent,
      featuredItems: [createFakeFeaturedItem()],
      links: createFakeNavigationMenuLinks(faker.number.int({ min: 4, max: 6 })),
    };
  }

  if (layout === 'grid') {
    return {
      ...baseContent,
      groups: Array.from({ length: 2 }, () =>
        createFakeNavigationMenuGroup(faker.number.int({ min: 3, max: 4 }))
      ),
    };
  }

  if (layout === 'cards') {
    return {
      ...baseContent,
      links: createFakeNavigationMenuLinks(faker.number.int({ min: 4, max: 6 })).map((link) => ({
        ...link,
        style: 'card' as NavigationMenuLinkStyle,
        description: faker.lorem.sentence(),
      })),
    };
  }

  // Simple or list layout
  return {
    ...baseContent,
    links: createFakeNavigationMenuLinks(faker.number.int({ min: 4, max: 8 })),
  };
}

/**
 * Creates a fake navigation menu item
 * @param type - Item type (link or trigger)
 * @param overrides - Optional property overrides
 * @returns A fake navigation menu item
 */
export function createFakeNavigationMenuItem(
  type: NavigationMenuItemType = 'trigger',
  overrides?: Partial<FakeNavigationMenuItem>
): FakeNavigationMenuItem {
  const label = overrides?.label ?? faker.helpers.arrayElement(NAVIGATION_LABELS);

  const baseItem: FakeNavigationMenuItem = {
    id: faker.string.uuid(),
    label,
    type,
    icon: faker.helpers.maybe(() => getIconForLabel(label), { probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.05 }),
    ...overrides,
  };

  if (type === 'link') {
    return {
      ...baseItem,
      href: `/${faker.lorem.slug()}`,
    };
  }

  // Trigger type gets content
  return {
    ...baseItem,
    content: createFakeNavigationMenuContent(
      faker.helpers.arrayElement(NAVIGATION_MENU_CONTENT_LAYOUTS)
    ),
  };
}

/**
 * Creates multiple fake navigation menu items
 * @param count - Number of items to create
 * @param overrides - Optional property overrides applied to all items
 * @returns Array of fake navigation menu items
 */
export function createFakeNavigationMenuItems(
  count: number,
  overrides?: Partial<FakeNavigationMenuItem>
): FakeNavigationMenuItem[] {
  return Array.from({ length: count }, (_, index) => {
    // Mix of links and triggers
    const type: NavigationMenuItemType = index === count - 1 ? 'link' : 'trigger';
    return createFakeNavigationMenuItem(type, overrides);
  });
}

/**
 * Creates a complete fake navigation menu
 * @param itemCount - Number of menu items
 * @param overrides - Optional property overrides
 * @returns A fake navigation menu configuration
 */
export function createFakeNavigationMenu(
  itemCount: number = 5,
  overrides?: Partial<FakeNavigationMenu>
): FakeNavigationMenu {
  return {
    id: faker.string.uuid(),
    orientation: faker.helpers.arrayElement(NAVIGATION_MENU_ORIENTATIONS),
    items: createFakeNavigationMenuItems(itemCount),
    showIndicator: faker.datatype.boolean({ probability: 0.7 }),
    activeItemId: undefined,
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a fake mega menu navigation (enterprise-style with rich content)
 * @returns A navigation menu optimized for mega menu display
 */
export function createFakeMegaMenuNavigation(): FakeNavigationMenu {
  const labels = [
    i18n.t('factory.navigationMenu.products', 'Products'),
    i18n.t('factory.navigationMenu.solutions', 'Solutions'),
    i18n.t('factory.navigationMenu.resources', 'Resources'),
    i18n.t('factory.navigationMenu.company', 'Company'),
  ];

  return {
    id: faker.string.uuid(),
    orientation: 'horizontal',
    showIndicator: true,
    items: labels.map((label, index) => ({
      id: faker.string.uuid(),
      label,
      type: 'trigger' as NavigationMenuItemType,
      icon: getIconForLabel(label),
      content: createFakeNavigationMenuContent(index === 0 ? 'mega' : 'featured'),
    })),
  };
}

/**
 * Creates a simple link-only navigation menu
 * @param labels - Optional array of labels
 * @returns A navigation menu with only simple links
 */
export function createFakeSimpleLinkNavigation(labels?: string[]): FakeNavigationMenu {
  const navLabels = labels ?? [
    i18n.t('factory.navigationMenu.home', 'Home'),
    i18n.t('factory.navigationMenu.about', 'About'),
    i18n.t('factory.navigationMenu.services', 'Services'),
    i18n.t('factory.navigationMenu.blog', 'Blog'),
    i18n.t('factory.navigationMenu.contact', 'Contact'),
  ];

  return {
    id: faker.string.uuid(),
    orientation: 'horizontal',
    showIndicator: false,
    items: navLabels.map((label) => ({
      id: faker.string.uuid(),
      label,
      type: 'link' as NavigationMenuItemType,
      href: `/${label.toLowerCase().replaceAll(/\s+/g, '-')}`,
    })),
  };
}

/**
 * Creates a documentation-style navigation menu
 * @returns A navigation menu optimized for documentation sites
 */
export function createFakeDocsNavigation(): FakeNavigationMenu {
  return {
    id: faker.string.uuid(),
    orientation: 'horizontal',
    showIndicator: true,
    items: [
      {
        id: faker.string.uuid(),
        label: i18n.t('factory.navigationMenu.gettingStarted', 'Getting Started'),
        type: 'trigger',
        icon: 'zap',
        content: {
          id: faker.string.uuid(),
          layout: 'list',
          width: 'w-[250px]',
          links: [
            {
              id: faker.string.uuid(),
              label: i18n.t('factory.navigationMenu.introduction', 'Introduction'),
              href: '/docs/intro',
              icon: 'file',
            },
            {
              id: faker.string.uuid(),
              label: i18n.t('factory.navigationMenu.installation', 'Installation'),
              href: '/docs/installation',
              icon: 'code',
            },
            {
              id: faker.string.uuid(),
              label: i18n.t('factory.navigationMenu.quickStart', 'Quick Start'),
              href: '/docs/quickstart',
              icon: 'zap',
            },
            {
              id: faker.string.uuid(),
              label: i18n.t('factory.navigationMenu.configuration', 'Configuration'),
              href: '/docs/config',
              icon: 'settings',
            },
          ],
        },
      },
      {
        id: faker.string.uuid(),
        label: i18n.t('factory.navigationMenu.components', 'Components'),
        type: 'trigger',
        icon: 'layers',
        content: {
          id: faker.string.uuid(),
          layout: 'grid',
          width: 'w-[400px]',
          groups: [
            {
              id: faker.string.uuid(),
              title: i18n.t('factory.navigationMenu.layout', 'Layout'),
              links: [
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.container', 'Container'),
                  href: '/docs/container',
                },
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.grid', 'Grid'),
                  href: '/docs/grid',
                },
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.stack', 'Stack'),
                  href: '/docs/stack',
                },
              ],
            },
            {
              id: faker.string.uuid(),
              title: i18n.t('factory.navigationMenu.forms', 'Forms'),
              links: [
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.input', 'Input'),
                  href: '/docs/input',
                },
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.select', 'Select'),
                  href: '/docs/select',
                },
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.checkbox', 'Checkbox'),
                  href: '/docs/checkbox',
                },
              ],
            },
          ],
        },
      },
      {
        id: faker.string.uuid(),
        label: i18n.t('factory.navigationMenu.apiReference', 'API Reference'),
        type: 'link',
        href: '/api',
        icon: 'code',
      },
      {
        id: faker.string.uuid(),
        label: i18n.t('factory.navigationMenu.examples', 'Examples'),
        type: 'link',
        href: '/examples',
        icon: 'star',
      },
    ],
  };
}

/**
 * Creates an e-commerce style navigation menu
 * @returns A navigation menu optimized for e-commerce sites
 */
export function createFakeEcommerceNavigation(): FakeNavigationMenu {
  return {
    id: faker.string.uuid(),
    orientation: 'horizontal',
    showIndicator: true,
    items: [
      {
        id: faker.string.uuid(),
        label: i18n.t('factory.navigationMenu.shop', 'Shop'),
        type: 'trigger',
        content: {
          id: faker.string.uuid(),
          layout: 'mega',
          width: i18n.t('factory.navigationMenu.wscreenMaxw4xl', 'w-screen max-w-4xl'),
          featuredItems: [
            {
              id: faker.string.uuid(),
              title: i18n.t('factory.navigationMenu.newArrivals', 'New Arrivals'),
              description: i18n.t(
                'factory.navigationMenu.checkOutOurLatestCollection',
                'Check out our latest collection'
              ),
              href: '/new-arrivals',
              imageUrl: faker.image.urlPicsumPhotos({ width: 400, height: 200 }),
              ctaLabel: i18n.t('factory.navigationMenu.shopNow', 'Shop Now'),
              background: i18n.t(
                'factory.navigationMenu.bggradienttobrFrompink50010Topurple5005',
                'bg-gradient-to-br from-pink-500/10 to-purple-500/5'
              ),
            },
          ],
          groups: [
            {
              id: faker.string.uuid(),
              title: i18n.t('factory.navigationMenu.categories', 'Categories'),
              links: [
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.electronics', 'Electronics'),
                  href: '/shop/electronics',
                },
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.clothing', 'Clothing'),
                  href: '/shop/clothing',
                },
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.homeAndGarden', 'Home & Garden'),
                  href: '/shop/home',
                },
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.sports', 'Sports'),
                  href: '/shop/sports',
                },
              ],
            },
            {
              id: faker.string.uuid(),
              title: i18n.t('factory.navigationMenu.collections', 'Collections'),
              links: [
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.summerSale', 'Summer Sale'),
                  href: '/collections/summer',
                },
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.bestSellers', 'Best Sellers'),
                  href: '/collections/best-sellers',
                },
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.giftGuide', 'Gift Guide'),
                  href: '/collections/gifts',
                },
                {
                  id: faker.string.uuid(),
                  label: i18n.t('factory.navigationMenu.clearance', 'Clearance'),
                  href: '/collections/clearance',
                },
              ],
            },
          ],
        },
      },
      {
        id: faker.string.uuid(),
        label: i18n.t('factory.navigationMenu.deals', 'Deals'),
        type: 'trigger',
        content: {
          id: faker.string.uuid(),
          layout: 'list',
          width: 'w-[250px]',
          links: [
            {
              id: faker.string.uuid(),
              label: i18n.t('factory.navigationMenu.dailyDeals', 'Daily Deals'),
              href: '/deals/daily',
              badge: 12,
              isNew: true,
            },
            {
              id: faker.string.uuid(),
              label: i18n.t('factory.navigationMenu.flashSales', 'Flash Sales'),
              href: '/deals/flash',
            },
            {
              id: faker.string.uuid(),
              label: i18n.t('factory.navigationMenu.clearanceDeals', 'Clearance'),
              href: '/deals/clearance',
            },
            {
              id: faker.string.uuid(),
              label: i18n.t('factory.navigationMenu.coupons', 'Coupons'),
              href: '/deals/coupons',
            },
          ],
        },
      },
      {
        id: faker.string.uuid(),
        label: i18n.t('factory.navigationMenu.brands', 'Brands'),
        type: 'link',
        href: '/brands',
      },
      {
        id: faker.string.uuid(),
        label: i18n.t('factory.navigationMenu.giftCards', 'Gift Cards'),
        type: 'link',
        href: '/gift-cards',
      },
    ],
  };
}

/**
 * Creates a vertical sidebar-style navigation menu
 * @returns A vertical navigation menu for sidebars
 */
export function createFakeVerticalNavigation(): FakeNavigationMenu {
  return createFakeNavigationMenu(6, {
    orientation: 'vertical',
    showIndicator: false,
  });
}

/**
 * Creates a minimal navigation menu with icons only
 * @returns A compact navigation menu
 */
export function createFakeIconNavigation(): FakeNavigationMenu {
  const items: FakeNavigationMenuItem[] = [
    {
      id: faker.string.uuid(),
      label: i18n.t('factory.navigationMenu.home', 'Home'),
      type: 'link',
      href: '/',
      icon: 'home',
    },
    {
      id: faker.string.uuid(),
      label: i18n.t('factory.navigationMenu.search', 'Search'),
      type: 'link',
      href: '/search',
      icon: 'search',
    },
    {
      id: faker.string.uuid(),
      label: i18n.t('factory.navigationMenu.profile', 'Profile'),
      type: 'link',
      href: '/profile',
      icon: 'users',
    },
    {
      id: faker.string.uuid(),
      label: i18n.t('factory.navigationMenu.settings', 'Settings'),
      type: 'link',
      href: '/settings',
      icon: 'settings',
    },
  ];

  return {
    id: faker.string.uuid(),
    orientation: 'horizontal',
    showIndicator: false,
    items,
  };
}

/**
 * Creates a navigation menu with disabled items
 * @returns A navigation menu demonstrating disabled states
 */
export function createFakeDisabledItemsNavigation(): FakeNavigationMenu {
  const menu = createFakeNavigationMenu(5);
  menu.items[2].disabled = true;
  if (menu.items[0].content?.links) {
    menu.items[0].content.links[1].disabled = true;
  }
  return menu;
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of navigation menus across orientations
 * @returns Grid of navigation menus for visual testing
 */
export function createNavigationMenuOrientationMatrix(): FakeNavigationMenu[] {
  return NAVIGATION_MENU_ORIENTATIONS.map((orientation) =>
    createFakeNavigationMenu(4, { orientation })
  );
}

/**
 * Creates a matrix of content layouts
 * @returns Grid of content configurations for visual testing
 */
export function createNavigationMenuContentLayoutMatrix(): FakeNavigationMenuContent[] {
  return NAVIGATION_MENU_CONTENT_LAYOUTS.map((layout) => createFakeNavigationMenuContent(layout));
}

/**
 * Creates a matrix of link styles
 * @returns Grid of link items with different styles
 */
export function createNavigationMenuLinkStyleMatrix(): FakeNavigationMenuLink[] {
  return NAVIGATION_MENU_LINK_STYLES.map((style) =>
    createFakeNavigationMenuLink({
      style,
      label: `${style.charAt(0).toUpperCase()}${style.slice(1)} Style`,
      description: i18n.t(
        'factory.navigationMenu.linkStyleDescription',
        'Example of {{style}} link style',
        { style }
      ),
    })
  );
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all navigation menu variants
 * @returns Array of specialized navigation menus for showcase
 */
export function createNavigationMenuShowcase(): Array<{
  description: string;
  menu: FakeNavigationMenu;
  name: string;
}> {
  return [
    {
      name: i18n.t('factory.navigationMenu.megaMenu', 'Mega Menu'),
      description: i18n.t(
        'factory.navigationMenu.enterprisestyleNavigationWithRichContent',
        'Enterprise-style navigation with rich content panels'
      ),
      menu: createFakeMegaMenuNavigation(),
    },
    {
      name: i18n.t('factory.navigationMenu.simpleLinks', 'Simple Links'),
      description: i18n.t(
        'factory.navigationMenu.cleanNavigationWithDirectLinks',
        'Clean navigation with direct links only'
      ),
      menu: createFakeSimpleLinkNavigation(),
    },
    {
      name: i18n.t('factory.navigationMenu.documentation', 'Documentation'),
      description: i18n.t(
        'factory.navigationMenu.optimizedForDocumentationSites',
        'Optimized for documentation sites'
      ),
      menu: createFakeDocsNavigation(),
    },
    {
      name: i18n.t('factory.navigationMenu.ecommerce', 'E-commerce'),
      description: i18n.t(
        'factory.navigationMenu.shoppingfocusedNavigationWithDealsAnd',
        'Shopping-focused navigation with deals and categories'
      ),
      menu: createFakeEcommerceNavigation(),
    },
    {
      name: i18n.t('factory.navigationMenu.vertical', 'Vertical'),
      description: i18n.t(
        'factory.navigationMenu.sidebarstyleVerticalNavigation',
        'Sidebar-style vertical navigation'
      ),
      menu: createFakeVerticalNavigation(),
    },
    {
      name: i18n.t('factory.navigationMenu.iconOnly', 'Icon Only'),
      description: i18n.t(
        'factory.navigationMenu.compactNavigationWithIcons',
        'Compact navigation with icons'
      ),
      menu: createFakeIconNavigation(),
    },
    {
      name: i18n.t('factory.navigationMenu.withDisabled', 'With Disabled'),
      description: i18n.t(
        'factory.navigationMenu.demonstratingDisabledItemStates',
        'Demonstrating disabled item states'
      ),
      menu: createFakeDisabledItemsNavigation(),
    },
  ];
}

/**
 * Creates a complete test data set for navigation menu testing
 * @returns Comprehensive test data
 */
export function createNavigationMenuTestData(): {
  contentLayouts: FakeNavigationMenuContent[];
  featuredItems: FakeNavigationMenuFeaturedItem[];
  groups: FakeNavigationMenuGroup[];
  items: FakeNavigationMenuItem[];
  links: FakeNavigationMenuLink[];
  linkStyles: FakeNavigationMenuLink[];
  menus: FakeNavigationMenu[];
  orientations: FakeNavigationMenu[];
  showcase: Array<{ description: string; menu: FakeNavigationMenu; name: string }>;
} {
  return {
    links: createFakeNavigationMenuLinks(10),
    items: createFakeNavigationMenuItems(8),
    groups: Array.from({ length: 4 }, () => createFakeNavigationMenuGroup()),
    featuredItems: Array.from({ length: 3 }, () => createFakeFeaturedItem()),
    menus: Array.from({ length: 5 }, () => createFakeNavigationMenu()),
    orientations: createNavigationMenuOrientationMatrix(),
    contentLayouts: createNavigationMenuContentLayoutMatrix(),
    linkStyles: createNavigationMenuLinkStyleMatrix(),
    showcase: createNavigationMenuShowcase(),
  };
}
