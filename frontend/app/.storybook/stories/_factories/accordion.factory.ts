import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/** Accordion selection type - single allows one item open, multiple allows many */
export type AccordionType = 'multiple' | 'single';

/** Accordion orientation for layout direction */
export type AccordionOrientation = 'horizontal' | 'vertical';

/** Text direction for RTL support */
export type AccordionDirection = 'ltr' | 'rtl';

/** Accordion width variants for different layouts */
export type AccordionWidth = 'compact' | 'default' | 'full';

/** Accordion item state for testing */
export type AccordionItemState = 'collapsed' | 'disabled' | 'expanded';

/** Accordion animation style */
export type AccordionAnimation = 'default' | 'fast' | 'none' | 'slow';

// ═══════════════════════════════════════════════════════════════
// INTERFACE (Shape of Generated Data)
// ═══════════════════════════════════════════════════════════════

/** Interface for fake accordion item data */
export interface FakeAccordionItem {
  /** Optional badge text */
  badge?: string;
  /** Content displayed when expanded */
  content: string;
  /** Created timestamp for sorting */
  createdAt?: Date;
  /** Whether the item should be open by default */
  defaultOpen?: boolean;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Optional icon name for the trigger */
  icon?: string;
  /** Unique identifier for the item */
  id: string;
  /** Custom metadata for testing */
  metadata?: Record<string, unknown>;
  /** Item state for testing */
  state?: AccordionItemState;
  /** Custom test ID */
  testId?: string;
  /** Title displayed in the trigger */
  title: string;
}

/** Interface for accordion configuration */
export interface FakeAccordionConfig {
  /** Animation style */
  animation?: AccordionAnimation;
  /** Whether items can all be collapsed (single type only) */
  collapsible: boolean;
  /** Default expanded value(s) */
  defaultValue?: string | string[];
  /** Text direction */
  dir: AccordionDirection;
  /** Whether the entire accordion is disabled */
  disabled: boolean;
  /** Layout orientation */
  orientation: AccordionOrientation;
  /** Custom test ID */
  testId?: string;
  /** Selection type */
  type: AccordionType;
  /** Width variant */
  width: AccordionWidth;
}

/** Interface for nested accordion structure */
export interface FakeNestedAccordion {
  children?: FakeNestedAccordion[];
  content?: string;
  id: string;
  level: number;
  title: string;
}

/** Interface for accordion group (for visual testing) */
export interface FakeAccordionGroup {
  config: FakeAccordionConfig;
  id: string;
  items: FakeAccordionItem[];
  name: string;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS (Used in Stories for Iteration)
// ═══════════════════════════════════════════════════════════════

/** All accordion type options */
export const ACCORDION_TYPES: AccordionType[] = ['single', 'multiple'];

/** All accordion orientation options */
export const ACCORDION_ORIENTATIONS: AccordionOrientation[] = ['horizontal', 'vertical'];

/** All accordion direction options */
export const ACCORDION_DIRECTIONS: AccordionDirection[] = ['ltr', 'rtl'];

/** All accordion width variants */
export const ACCORDION_WIDTHS: AccordionWidth[] = ['compact', 'default', 'full'];

/** All accordion item states */
export const ACCORDION_ITEM_STATES: AccordionItemState[] = ['collapsed', 'expanded', 'disabled'];

/** All accordion animation styles */
export const ACCORDION_ANIMATIONS: AccordionAnimation[] = ['none', 'fast', 'default', 'slow'];

/** Common accordion trigger titles for realistic test data */
export const ACCORDION_TITLES = [
  i18n.t('factory.accordion.isItAccessible', 'Is it accessible?'),
  i18n.t('factory.accordion.isItKeyboardNavigable', 'Is it keyboard navigable?'),
  i18n.t('factory.accordion.canIStyleIt', 'Can I style it?'),
  i18n.t('factory.accordion.whatBrowsersAreSupported', 'What browsers are supported?'),
  i18n.t('factory.accordion.howDoIInstallIt', 'How do I install it?'),
  i18n.t('factory.accordion.isThereDocumentation', 'Is there documentation?'),
  i18n.t('factory.accordion.canIUseItWith', 'Can I use it with TypeScript?'),
  i18n.t('factory.accordion.areThereAnyDependencies', 'Are there any dependencies?'),
  i18n.t('factory.accordion.isItProductionReady', 'Is it production ready?'),
  i18n.t('factory.accordion.howDoIContribute', 'How do I contribute?'),
];

/** Action-oriented titles for settings/menus */
export const ACCORDION_ACTION_TITLES = [
  i18n.t('factory.accordion.generalSettings', 'General Settings'),
  i18n.t('factory.accordion.appearance', 'Appearance'),
  i18n.t('factory.accordion.notifications', 'Notifications'),
  i18n.t('factory.accordion.privacySecurity', 'Privacy & Security'),
  i18n.t('factory.accordion.advancedOptions', 'Advanced Options'),
  i18n.t('factory.accordion.accountSettings', 'Account Settings'),
  i18n.t('factory.accordion.dataStorage', 'Data & Storage'),
  i18n.t('factory.accordion.accessibility', 'Accessibility'),
  i18n.t('factory.accordion.languageRegion', 'Language & Region'),
  i18n.t('factory.accordion.helpSupport', 'Help & Support'),
];

/** FAQ-style question titles */
export const ACCORDION_FAQ_TITLES = [
  i18n.t('factory.accordion.howDoIGetStarted', 'How do I get started?'),
  i18n.t('factory.accordion.whatPaymentMethodsAreAccepted', 'What payment methods are accepted?'),
  i18n.t('factory.accordion.canICancelMySubscription', 'Can I cancel my subscription?'),
  i18n.t('factory.accordion.howDoIContactSupport', 'How do I contact support?'),
  i18n.t('factory.accordion.whatIsYourRefundPolicy', 'What is your refund policy?'),
  i18n.t('factory.accordion.howDoIResetMy', 'How do I reset my password?'),
  i18n.t('factory.accordion.areThereAnyHiddenFees', 'Are there any hidden fees?'),
  i18n.t('factory.accordion.howLongDoesShippingTake', 'How long does shipping take?'),
  i18n.t('factory.accordion.doYouOfferBulkDiscounts', 'Do you offer bulk discounts?'),
  i18n.t('factory.accordion.isMyDataSecure', 'Is my data secure?'),
];

/** Common accordion content samples */
export const ACCORDION_CONTENTS = [
  i18n.t('factory.accordion.yesItAdheresToThe', 'Yes. It adheres to the WAI-ARIA design pattern.'),
  i18n.t(
    'factory.accordion.yesFullKeyboardNavigationIs',
    'Yes. Full keyboard navigation is supported.'
  ),
  i18n.t(
    'factory.accordion.yesItShipsWithDefault',
    'Yes. It ships with default styles that matches the other components.'
  ),
  i18n.t('factory.accordion.itWorksInAllModern', 'It works in all modern browsers.'),
  i18n.t(
    'factory.accordion.installItFromNpmUsing',
    'Install it from npm using your preferred package manager.'
  ),
  i18n.t(
    'factory.accordion.yesComprehensiveDocumentationIsAvailable',
    'Yes. Comprehensive documentation is available.'
  ),
  i18n.t(
    'factory.accordion.yesItHasFullTypescript',
    'Yes. It has full TypeScript support with exported types.'
  ),
  i18n.t(
    'factory.accordion.itHasMinimalDependenciesFor',
    'It has minimal dependencies for a small bundle size.'
  ),
  i18n.t(
    'factory.accordion.yesItIsBeingUsed',
    'Yes. It is being used in production by many companies.'
  ),
  i18n.t(
    'factory.accordion.contributionsAreWelcomeCheckThe',
    'Contributions are welcome! Check the contributing guide.'
  ),
];

/** Icon options for accordion triggers */
export const ACCORDION_ICONS = [
  'HelpCircle',
  i18n.t('factory.accordion.info', 'Info'),
  i18n.t('factory.accordion.settings', 'Settings'),
  'FileText',
  i18n.t('factory.accordion.code', 'Code'),
  'BookOpen',
  i18n.t('factory.accordion.terminal', 'Terminal'),
  i18n.t('factory.accordion.package', 'Package'),
  'CheckCircle',
  i18n.t('factory.accordion.users', 'Users'),
  i18n.t('factory.accordion.bell', 'Bell'),
  i18n.t('factory.accordion.shield', 'Shield'),
  i18n.t('factory.accordion.globe', 'Globe'),
  i18n.t('factory.accordion.database', 'Database'),
  'Zap',
];

/** Badge options for accordion items */
export const ACCORDION_BADGES = [
  i18n.t('factory.accordion.new', 'New'),
  i18n.t('factory.accordion.beta', 'Beta'),
  i18n.t('factory.accordion.pro', 'Pro'),
  i18n.t('factory.accordion.updated', 'Updated'),
  i18n.t('factory.accordion.deprecated', 'Deprecated'),
  i18n.t('factory.accordion.comingSoon', 'Coming Soon'),
];

// ═══════════════════════════════════════════════════════════════
// SINGLE ITEM FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a single fake accordion item
 * @param overrides - Optional partial overrides for the generated item
 * @returns A fake accordion item
 */
export function createFakeAccordionItem(overrides?: Partial<FakeAccordionItem>): FakeAccordionItem {
  const index = faker.number.int({ min: 0, max: ACCORDION_TITLES.length - 1 });
  const disabled = overrides?.disabled ?? faker.helpers.maybe(() => true, { probability: 0.1 });
  const defaultOpen =
    overrides?.defaultOpen ?? faker.helpers.maybe(() => true, { probability: 0.2 });

  // Determine state based on disabled and defaultOpen
  let state: AccordionItemState = 'collapsed';
  if (disabled) {
    state = 'disabled';
  } else if (defaultOpen) {
    state = 'expanded';
  }

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement(ACCORDION_TITLES),
    content: faker.helpers.arrayElement(ACCORDION_CONTENTS),
    disabled,
    defaultOpen,
    state,
    icon: faker.helpers.maybe(() => ACCORDION_ICONS[index], { probability: 0.3 }),
    badge: faker.helpers.maybe(() => faker.helpers.arrayElement(ACCORDION_BADGES), {
      probability: 0.15,
    }),
    testId: `accordion-item-${faker.string.alphanumeric(6)}`,
    createdAt: faker.date.recent(),
    metadata: faker.helpers.maybe(
      () => ({
        source: faker.word.noun(),
        category: faker.helpers.arrayElement(['general', 'settings', 'faq', 'help']),
      }),
      { probability: 0.2 }
    ),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// BULK FACTORY (For Lists/Tables)
// ═══════════════════════════════════════════════════════════════

/**
 * Creates multiple fake accordion items
 * @param count - Number of items to generate
 * @param overrides - Optional partial overrides applied to all items
 * @returns Array of fake accordion items
 */
export function createFakeAccordionItems(
  count: number,
  overrides?: Partial<FakeAccordionItem>
): FakeAccordionItem[] {
  return Array.from({ length: count }, () => createFakeAccordionItem(overrides));
}

/**
 * Creates accordion items with unique titles (no duplicates)
 * @param count - Number of items to generate (max: ACCORDION_TITLES.length)
 * @returns Array of items with unique titles
 */
export function createFakeAccordionItemsUnique(count: number): FakeAccordionItem[] {
  const titles = faker.helpers.shuffle([...ACCORDION_TITLES]).slice(0, count);
  return titles.map((title, index) =>
    createFakeAccordionItem({
      title,
      id: `item-${String(index + 1)}`,
    })
  );
}

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED FACTORIES (For Specific Scenarios)
// ═══════════════════════════════════════════════════════════════

/**
 * Creates accordion items for FAQ section
 * @param count - Number of FAQ items (default: 5)
 * @returns Array of FAQ-style accordion items
 */
export function createFakeFAQItems(count = 5): FakeAccordionItem[] {
  const questions = faker.helpers.shuffle([...ACCORDION_FAQ_TITLES]).slice(0, count);
  return questions.map((title, i) => ({
    id: `faq-${String(i + 1)}`,
    title,
    content: faker.lorem.paragraph({ min: 2, max: 4 }),
    disabled: false,
    defaultOpen: i === 0, // First item open by default
    state: i === 0 ? 'expanded' : 'collapsed',
    testId: `faq-item-${String(i + 1)}`,
  }));
}

/**
 * Creates accordion items for a settings panel
 * @returns Array of settings-style accordion items
 */
export function createFakeSettingsItems(): FakeAccordionItem[] {
  const settings = [
    { title: i18n.t('factory.accordion.generalSettings', 'General Settings'), icon: 'Settings' },
    { title: i18n.t('factory.accordion.appearance', 'Appearance'), icon: 'Palette' },
    { title: i18n.t('factory.accordion.notifications', 'Notifications'), icon: 'Bell' },
    { title: i18n.t('factory.accordion.privacyAndSecurity', 'Privacy & Security'), icon: 'Shield' },
    { title: i18n.t('factory.accordion.advanced', 'Advanced'), icon: 'Wrench' },
  ];

  return settings.map((setting, i) => ({
    id: `setting-${String(i + 1)}`,
    title: setting.title,
    content: faker.lorem.paragraph({ min: 2, max: 3 }),
    icon: setting.icon,
    disabled: false,
    defaultOpen: false,
    state: 'collapsed' as AccordionItemState,
    testId: `setting-item-${String(i + 1)}`,
  }));
}

/**
 * Creates accordion items with mixed disabled states
 * @param count - Number of items to generate
 * @returns Array with some disabled items
 */
export function createFakeAccordionWithDisabled(count = 5): FakeAccordionItem[] {
  return Array.from({ length: count }, (_, i) => {
    const isDisabled = i === 1 || i === 3; // 2nd and 4th items disabled
    return {
      id: `item-${String(i + 1)}`,
      title: i18n.t('factory.accordion.itemTitle', 'Item {{number}}', { number: String(i + 1) }),
      content: faker.lorem.paragraph({ min: 1, max: 2 }),
      disabled: isDisabled,
      defaultOpen: false,
      state: isDisabled ? 'disabled' : 'collapsed',
      testId: `mixed-item-${String(i + 1)}`,
    };
  });
}

/**
 * Creates nested accordion structure (items with sub-items)
 * @returns Array of items suitable for nested accordion demo
 */
export function createFakeNestedAccordionItems(): FakeAccordionItem[] {
  return [
    {
      id: 'parent-1',
      title: i18n.t('factory.accordion.documentation', 'Documentation'),
      content: i18n.t(
        'factory.accordion.gettingStartedinstallationconfigurationapiReference',
        'Getting Started|Installation|Configuration|API Reference'
      ),
      disabled: false,
      defaultOpen: true,
      state: 'expanded',
    },
    {
      id: 'parent-2',
      title: i18n.t('factory.accordion.components', 'Components'),
      content: i18n.t(
        'factory.accordion.buttonsformsnavigationdataDisplay',
        'Buttons|Forms|Navigation|Data Display'
      ),
      disabled: false,
      defaultOpen: false,
      state: 'collapsed',
    },
    {
      id: 'parent-3',
      title: i18n.t('factory.accordion.examples', 'Examples'),
      content: i18n.t(
        'factory.accordion.basicUsageadvancedPatternsintegrations',
        'Basic Usage|Advanced Patterns|Integrations'
      ),
      disabled: false,
      defaultOpen: false,
      state: 'collapsed',
    },
  ];
}

/** Create an accordion item in expanded state */
export function createFakeAccordionItemExpanded(): FakeAccordionItem {
  return createFakeAccordionItem({
    defaultOpen: true,
    state: 'expanded',
    disabled: false,
  });
}

/** Create an accordion item in disabled state */
export function createFakeAccordionItemDisabled(): FakeAccordionItem {
  return createFakeAccordionItem({
    disabled: true,
    state: 'disabled',
    defaultOpen: false,
  });
}

/** Create accordion items for all states (collapsed, expanded, disabled) */
export function createFakeAccordionWithAllStates(): FakeAccordionItem[] {
  return ACCORDION_ITEM_STATES.map((state) => {
    const isDisabled = state === 'disabled';
    const isExpanded = state === 'expanded';
    return createFakeAccordionItem({
      id: `state-${state}`,
      title: i18n.t('factory.accordion.stateItem', '{{state}} Item', {
        state: state.charAt(0).toUpperCase() + state.slice(1),
      }),
      disabled: isDisabled,
      defaultOpen: isExpanded,
      state,
    });
  });
}

/** Create accordion items with all badge types */
export function createFakeAccordionWithBadges(): FakeAccordionItem[] {
  return ACCORDION_BADGES.map((badge) =>
    createFakeAccordionItem({
      id: `badge-${badge.toLowerCase().replaceAll(/\s+/g, '-')}`,
      title: i18n.t('factory.accordion.itemWithBadge', 'Item with {{badge}} badge', { badge }),
      badge,
      disabled: false,
      defaultOpen: false,
    })
  );
}

/** Create accordion items with icons */
export function createFakeAccordionWithIcons(): FakeAccordionItem[] {
  return ACCORDION_ICONS.slice(0, 5).map((icon) =>
    createFakeAccordionItem({
      id: `icon-${icon.toLowerCase()}`,
      title: faker.helpers.arrayElement(ACCORDION_ACTION_TITLES),
      icon,
      disabled: false,
      defaultOpen: false,
    })
  );
}

// ═══════════════════════════════════════════════════════════════
// MATRIX FACTORIES (For Visual Regression)
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a matrix of accordion items for visual regression testing
 * across all type and width combinations
 * @returns 2D array of accordion items [type][width]
 */
export function createFakeAccordionMatrix(): FakeAccordionItem[][] {
  return ACCORDION_TYPES.map((type) =>
    ACCORDION_WIDTHS.map((width) => ({
      id: `${type}-${width}`,
      title: i18n.t('factory.accordion.typeWidth', '{{type}} ({{width}})', {
        type: type.charAt(0).toUpperCase() + type.slice(1),
        width,
      }),
      content: i18n.t(
        'factory.accordion.typeWidthContent',
        'Content for {{type}} accordion at {{width}} width.',
        { type, width }
      ),
      disabled: false,
      defaultOpen: type === 'single',
      state: type === 'single' ? 'expanded' : 'collapsed',
    }))
  );
}

/**
 * Creates state × type matrix for visual testing
 * @returns 2D array of items [state][type]
 */
export function createFakeAccordionStateMatrix(): FakeAccordionItem[][] {
  return ACCORDION_ITEM_STATES.map((state) =>
    ACCORDION_TYPES.map((type) => {
      const isDisabled = state === 'disabled';
      const isExpanded = state === 'expanded';
      return createFakeAccordionItem({
        id: `${state}-${type}`,
        title: i18n.t('factory.accordion.stateType', '{{state}} ({{type}})', { state, type }),
        disabled: isDisabled,
        defaultOpen: isExpanded,
        state,
      });
    })
  );
}

/**
 * Creates accordion configuration for different scenarios
 * @param scenario - Scenario name
 * @returns Accordion configuration
 */
export function createFakeAccordionConfig(
  scenario: 'default' | 'disabled' | 'horizontal' | 'multiple' | 'rtl' = 'default'
): FakeAccordionConfig {
  const configs: Record<string, FakeAccordionConfig> = {
    default: {
      type: 'single',
      collapsible: true,
      dir: 'ltr',
      orientation: 'vertical',
      width: 'default',
      disabled: false,
      animation: 'default',
      testId: 'accordion-default',
    },
    rtl: {
      type: 'single',
      collapsible: true,
      dir: 'rtl',
      orientation: 'vertical',
      width: 'default',
      disabled: false,
      animation: 'default',
      testId: 'accordion-rtl',
    },
    disabled: {
      type: 'single',
      collapsible: false,
      dir: 'ltr',
      orientation: 'vertical',
      width: 'default',
      disabled: true,
      animation: 'none',
      testId: 'accordion-disabled',
    },
    horizontal: {
      type: 'multiple',
      collapsible: true,
      dir: 'ltr',
      orientation: 'horizontal',
      width: 'full',
      disabled: false,
      animation: 'default',
      testId: 'accordion-horizontal',
    },
    multiple: {
      type: 'multiple',
      collapsible: true,
      dir: 'ltr',
      orientation: 'vertical',
      width: 'default',
      disabled: false,
      animation: 'default',
      testId: 'accordion-multiple',
    },
  };

  return configs[scenario];
}

// ═══════════════════════════════════════════════════════════════
// ACCORDION GROUP FACTORIES
// ═══════════════════════════════════════════════════════════════

/**
 * Creates an accordion group for testing
 * @param overrides - Optional partial overrides
 * @returns Accordion group with config and items
 */
export function createFakeAccordionGroup(
  overrides?: Partial<FakeAccordionGroup>
): FakeAccordionGroup {
  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement([
      i18n.t('factory.accordion.faq', 'FAQ'),
      i18n.t('factory.accordion.settings', 'Settings'),
      i18n.t('factory.accordion.documentation', 'Documentation'),
      i18n.t('factory.accordion.help', 'Help'),
    ]),
    items: createFakeAccordionItems(faker.number.int({ min: 3, max: 7 })),
    config: createFakeAccordionConfig('default'),
    ...overrides,
  };
}

/**
 * Creates multiple accordion groups
 * @param count - Number of groups to create
 * @returns Array of accordion groups
 */
export function createFakeAccordionGroups(count: number): FakeAccordionGroup[] {
  return Array.from({ length: count }, () => createFakeAccordionGroup());
}

// ═══════════════════════════════════════════════════════════════
// NESTED ACCORDION FACTORIES
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a nested accordion structure (for tree-like UIs)
 * @param depth - Maximum depth of nesting
 * @param breadth - Number of items at each level
 * @returns Nested accordion structure
 */
export function createFakeNestedAccordion(
  depth = 3,
  breadth = 3,
  currentLevel = 1
): FakeNestedAccordion[] {
  if (currentLevel > depth) {
    return [];
  }

  return Array.from({ length: breadth }, (_, i) => ({
    id: `level-${currentLevel}-item-${i + 1}`,
    title: i18n.t('factory.accordion.nestedTitle', 'Level {{level}} - Item {{number}}', {
      level: currentLevel,
      number: i + 1,
    }),
    content: currentLevel === depth ? faker.lorem.paragraph() : undefined,
    level: currentLevel,
    children:
      currentLevel < depth
        ? createFakeNestedAccordion(depth, Math.max(1, breadth - 1), currentLevel + 1)
        : undefined,
  }));
}

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE FEATURE FACTORIES
// ═══════════════════════════════════════════════════════════════

/**
 * Creates accordion items for documentation/help sections
 * @param sections - Number of documentation sections
 * @returns Array of documentation-style accordion items
 */
export function createFakeDocumentationAccordion(sections = 5): FakeAccordionItem[] {
  const docSections = [
    { title: i18n.t('factory.accordion.gettingStarted', 'Getting Started'), icon: 'BookOpen' },
    { title: i18n.t('factory.accordion.installation', 'Installation'), icon: 'Terminal' },
    { title: i18n.t('factory.accordion.configuration', 'Configuration'), icon: 'Settings' },
    { title: i18n.t('factory.accordion.apiReference', 'API Reference'), icon: 'Code' },
    { title: i18n.t('factory.accordion.troubleshooting', 'Troubleshooting'), icon: 'HelpCircle' },
    { title: i18n.t('factory.accordion.migrationGuide', 'Migration Guide'), icon: 'FileText' },
    { title: i18n.t('factory.accordion.bestPractices', 'Best Practices'), icon: 'CheckCircle' },
  ];

  return docSections.slice(0, sections).map((section, index) => ({
    id: `doc-${section.title.toLowerCase().replaceAll(/\s+/g, '-')}`,
    title: section.title,
    content: faker.lorem.paragraphs({ min: 2, max: 4 }),
    icon: section.icon,
    disabled: false,
    defaultOpen: index === 0,
    state: index === 0 ? 'expanded' : 'collapsed',
    testId: `doc-section-${String(index + 1)}`,
  }));
}

/**
 * Creates accordion items for a pricing/features comparison
 * @returns Array of pricing-style accordion items
 */
export function createFakePricingAccordion(): FakeAccordionItem[] {
  const tiers = [
    {
      title: i18n.t('factory.accordion.freePlan', 'Free Plan'),
      badge: i18n.t('factory.accordion.popular', 'Popular'),
    },
    {
      title: i18n.t('factory.accordion.proPlan', 'Pro Plan'),
      badge: i18n.t('factory.accordion.recommended', 'Recommended'),
    },
    {
      title: i18n.t('factory.accordion.enterprisePlan', 'Enterprise Plan'),
      badge: i18n.t('factory.accordion.custom', 'Custom'),
    },
  ];

  return tiers.map((tier, index) => ({
    id: `pricing-${tier.title.toLowerCase().replaceAll(/\s+/g, '-')}`,
    title: tier.title,
    content: faker.lorem.paragraph({ min: 2, max: 3 }),
    badge: tier.badge,
    disabled: false,
    defaultOpen: index === 1, // Pro plan open by default
    state: index === 1 ? 'expanded' : 'collapsed',
    testId: `pricing-tier-${String(index + 1)}`,
  }));
}

/**
 * Creates the ultimate test accordion with all features
 * @returns Complete accordion configuration for comprehensive testing
 */
export function createFakeUltimateAccordion(): {
  config: FakeAccordionConfig;
  items: FakeAccordionItem[];
} {
  return {
    config: {
      type: 'single',
      collapsible: true,
      dir: 'ltr',
      orientation: 'vertical',
      width: 'default',
      disabled: false,
      animation: 'default',
      defaultValue: 'ultimate-1',
      testId: 'ultimate-accordion',
    },
    items: [
      {
        id: 'ultimate-1',
        title: i18n.t('factory.accordion.expandedItemWithBadge', 'Expanded Item with Badge'),
        content: i18n.t(
          'factory.accordion.thisItemIsExpandedBy',
          'This item is expanded by default and has a badge.'
        ),
        badge: i18n.t('factory.accordion.featured', 'Featured'),
        icon: i18n.t('factory.accordion.star', 'Star'),
        disabled: false,
        defaultOpen: true,
        state: 'expanded',
        testId: 'ultimate-item-1',
      },
      {
        id: 'ultimate-2',
        title: i18n.t('factory.accordion.collapsedItemWithIcon', 'Collapsed Item with Icon'),
        content: i18n.t(
          'factory.accordion.thisItemHasAnIcon',
          'This item has an icon but is collapsed.'
        ),
        icon: i18n.t('factory.accordion.settings', 'Settings'),
        disabled: false,
        defaultOpen: false,
        state: 'collapsed',
        testId: 'ultimate-item-2',
      },
      {
        id: 'ultimate-3',
        title: i18n.t('factory.accordion.disabledItem', 'Disabled Item'),
        content: i18n.t(
          'factory.accordion.thisItemIsDisabledAnd',
          'This item is disabled and cannot be interacted with.'
        ),
        disabled: true,
        defaultOpen: false,
        state: 'disabled',
        testId: 'ultimate-item-3',
      },
      {
        id: 'ultimate-4',
        title: i18n.t('factory.accordion.plainItem', 'Plain Item'),
        content: i18n.t(
          'factory.accordion.aSimpleItemWithoutAny',
          'A simple item without any special features.'
        ),
        disabled: false,
        defaultOpen: false,
        state: 'collapsed',
        testId: 'ultimate-item-4',
      },
    ],
  };
}
