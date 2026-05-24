import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ TYPE DEFINITIONS ============

/** Collapsible state */
export type CollapsibleState = 'closed' | 'open';

/** Collapsible animation type */
export type CollapsibleAnimation = 'fade' | 'none' | 'scale' | 'slide';

/** Collapsible trigger variant */
export type CollapsibleTriggerVariant = 'button' | 'chevron' | 'icon' | 'link' | 'text';

/** Collapsible size variant */
export type CollapsibleSize = 'default' | 'lg' | 'sm';

/** Interface for fake collapsible section */
export interface FakeCollapsibleSection {
  /** Content body */
  content: string;
  /** Default open state */
  defaultOpen: boolean;
  /** Whether the section is disabled */
  disabled: boolean;
  /** Unique identifier */
  id: string;
  /** Section title */
  title: string;
}

/** Interface for collapsible with metadata */
export interface FakeCollapsibleWithMeta extends FakeCollapsibleSection {
  /** Icon name */
  icon?: string;
  /** Subtitle or description */
  subtitle?: string;
  /** Tag or badge text */
  tag?: string;
}

/** Interface for FAQ item */
export interface FakeFaqItem {
  /** Answer text */
  answer: string;
  /** FAQ category */
  category?: string;
  /** Unique identifier */
  id: string;
  /** Question text */
  question: string;
}

/** Interface for nested collapsible */
export interface FakeNestedCollapsible {
  /** Child sections */
  children?: FakeNestedCollapsible[];
  /** Content text */
  content?: string;
  /** Whether expanded by default */
  defaultOpen: boolean;
  /** Unique identifier */
  id: string;
  /** Nesting level (0 = root) */
  level: number;
  /** Section title */
  title: string;
}

/** Interface for settings section */
export interface FakeSettingsSection {
  /** Section description */
  description: string;
  /** Whether the section is expanded */
  expanded: boolean;
  /** Section icon */
  icon: string;
  /** Unique identifier */
  id: string;
  /** Settings items in this section */
  items: Array<{
    description?: string;
    id: string;
    label: string;
    type: 'checkbox' | 'input' | 'select' | 'toggle';
    value: boolean | string;
  }>;
  /** Section title */
  title: string;
}

/** Interface for collapsible panel */
export interface FakeCollapsiblePanel {
  /** Animation type */
  animation: CollapsibleAnimation;
  /** Panel content */
  content: string;
  /** Whether the panel is disabled */
  disabled: boolean;
  /** Footer content */
  footer?: string;
  /** Header content */
  header: string;
  /** Unique identifier */
  id: string;
  /** Initial open state */
  open: boolean;
  /** Panel size */
  size: CollapsibleSize;
}

/** Interface for code snippet collapsible */
export interface FakeCodeSnippetCollapsible {
  /** Code content */
  code: string;
  /** Default collapsed state */
  collapsed: boolean;
  /** File name */
  fileName: string;
  /** Unique identifier */
  id: string;
  /** Programming language */
  language: string;
  /** Line count */
  lineCount: number;
}

// ============ CONSTANTS FOR ITERATION ============

/** All collapsible states */
export const COLLAPSIBLE_STATES: CollapsibleState[] = ['closed', 'open'];

/** All animation types */
export const COLLAPSIBLE_ANIMATIONS: CollapsibleAnimation[] = ['fade', 'none', 'scale', 'slide'];

/** All trigger variants */
export const COLLAPSIBLE_TRIGGER_VARIANTS: CollapsibleTriggerVariant[] = [
  'button',
  'chevron',
  'icon',
  'link',
  'text',
];

/** All size variants */
export const COLLAPSIBLE_SIZES: CollapsibleSize[] = ['default', 'lg', 'sm'];

/** Common section titles */
export const COLLAPSIBLE_TITLES = [
  i18n.t('factory.collapsible.accountSettings', 'Account Settings'),
  i18n.t('factory.collapsible.additionalInformation', 'Additional Information'),
  i18n.t('factory.collapsible.advancedOptions', 'Advanced Options'),
  i18n.t('factory.collapsible.contactDetails', 'Contact Details'),
  i18n.t('factory.collapsible.frequentlyAskedQuestions', 'Frequently Asked Questions'),
  i18n.t('factory.collapsible.moreDetails', 'More Details'),
  i18n.t('factory.collapsible.privacySettings', 'Privacy Settings'),
  i18n.t('factory.collapsible.seeMore', 'See More'),
  i18n.t('factory.collapsible.showDetails', 'Show Details'),
  i18n.t('factory.collapsible.technicalSpecifications', 'Technical Specifications'),
];

/** FAQ categories */
export const FAQ_CATEGORIES = [
  i18n.t('factory.collapsible.account', 'Account'),
  i18n.t('factory.collapsible.billing', 'Billing'),
  i18n.t('factory.collapsible.general', 'General'),
  i18n.t('factory.collapsible.privacy', 'Privacy'),
  i18n.t('factory.collapsible.security', 'Security'),
  i18n.t('factory.collapsible.shipping', 'Shipping'),
  i18n.t('factory.collapsible.technical', 'Technical'),
];

/** Settings section icons */
export const SETTINGS_ICONS = [
  i18n.t('factory.collapsible.bell', 'Bell'),
  i18n.t('factory.collapsible.globe', 'Globe'),
  i18n.t('factory.collapsible.lock', 'Lock'),
  i18n.t('factory.collapsible.palette', 'Palette'),
  i18n.t('factory.collapsible.settings', 'Settings'),
  i18n.t('factory.collapsible.shield', 'Shield'),
  i18n.t('factory.collapsible.user', 'User'),
];

/** Programming languages for code snippets */
export const CODE_LANGUAGES = ['css', 'html', 'javascript', 'json', 'python', 'rust', 'typescript'];

/** Map language to file extension */
function getFileExtension(lang: string): string {
  if (lang === 'typescript') return 'ts';
  if (lang === 'javascript') return 'js';
  return lang;
}

// ============ SINGLE ITEM FACTORIES ============

/**
 * Creates a single collapsible section
 * @param overrides - Optional partial overrides
 * @returns A collapsible section
 */
export function createFakeCollapsibleSection(
  overrides?: Partial<FakeCollapsibleSection>
): FakeCollapsibleSection {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement(COLLAPSIBLE_TITLES),
    content: faker.lorem.paragraphs({ min: 1, max: 3 }),
    defaultOpen: faker.datatype.boolean({ probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a collapsible section with metadata
 * @param overrides - Optional overrides
 * @returns A collapsible section with metadata
 */
export function createFakeCollapsibleWithMeta(
  overrides?: Partial<FakeCollapsibleWithMeta>
): FakeCollapsibleWithMeta {
  return {
    ...createFakeCollapsibleSection(overrides),
    subtitle: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(SETTINGS_ICONS), {
      probability: 0.4,
    }),
    tag: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.collapsible.new', 'New'),
          i18n.t('factory.collapsible.beta', 'Beta'),
          i18n.t('factory.collapsible.updated', 'Updated'),
          i18n.t('factory.collapsible.popular', 'Popular'),
        ]),
      { probability: 0.2 }
    ),
    ...overrides,
  };
}

/**
 * Creates a FAQ item
 * @param overrides - Optional overrides
 * @returns A FAQ item
 */
export function createFakeFaqItem(overrides?: Partial<FakeFaqItem>): FakeFaqItem {
  return {
    id: faker.string.uuid(),
    question: faker.helpers.arrayElement([
      i18n.t('factory.collapsible.howDoIResetMy', 'How do I reset my password?'),
      i18n.t('factory.collapsible.whatPaymentMethodsDoYou', 'What payment methods do you accept?'),
      i18n.t('factory.collapsible.howLongDoesShippingTake', 'How long does shipping take?'),
      i18n.t('factory.collapsible.canICancelMySubscription', 'Can I cancel my subscription?'),
      i18n.t('factory.collapsible.howDoIContactSupport', 'How do I contact support?'),
      i18n.t('factory.collapsible.whatIsYourRefundPolicy', 'What is your refund policy?'),
      i18n.t('factory.collapsible.howDoIUpdateMy', 'How do I update my account information?'),
      i18n.t('factory.collapsible.isMyDataSecure', 'Is my data secure?'),
    ]),
    answer: faker.lorem.paragraphs({ min: 1, max: 2 }),
    category: faker.helpers.arrayElement(FAQ_CATEGORIES),
    ...overrides,
  };
}

/**
 * Creates a collapsible panel
 * @param overrides - Optional overrides
 * @returns A collapsible panel
 */
export function createFakeCollapsiblePanel(
  overrides?: Partial<FakeCollapsiblePanel>
): FakeCollapsiblePanel {
  return {
    id: faker.string.uuid(),
    header: faker.helpers.arrayElement(COLLAPSIBLE_TITLES),
    content: faker.lorem.paragraphs({ min: 1, max: 3 }),
    footer: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    open: faker.datatype.boolean({ probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    animation: faker.helpers.arrayElement(COLLAPSIBLE_ANIMATIONS),
    size: faker.helpers.arrayElement(COLLAPSIBLE_SIZES),
    ...overrides,
  };
}

/**
 * Creates a code snippet collapsible
 * @param overrides - Optional overrides
 * @returns A code snippet collapsible
 */
export function createFakeCodeSnippetCollapsible(
  overrides?: Partial<FakeCodeSnippetCollapsible>
): FakeCodeSnippetCollapsible {
  const language = overrides?.language ?? faker.helpers.arrayElement(CODE_LANGUAGES);
  const lineCount = overrides?.lineCount ?? faker.number.int({ min: 5, max: 50 });

  const codeTemplates: Record<string, string> = {
    javascript: `function ${faker.word.verb()}() {\n  const data = ${faker.datatype.boolean()};\n  return data;\n}`,
    typescript: `interface ${faker.word.noun().charAt(0).toUpperCase() + faker.word.noun().slice(1)} {\n  id: string;\n  name: string;\n}`,
    python: `def ${faker.word.verb()}_data():\n    result = []\n    return result`,
    rust: `fn ${faker.word.verb()}() -> Result<(), Error> {\n    Ok(())\n}`,
    css: `.${faker.word.adjective()} {\n  display: flex;\n  padding: 1rem;\n}`,
    html: `<div class="${faker.word.adjective()}">\n  <p>Content</p>\n</div>`,
    json: `{\n  "id": "${faker.string.uuid()}",\n  "name": "${faker.person.fullName()}"\n}`,
  };

  return {
    id: faker.string.uuid(),
    fileName: `${faker.word.noun()}.${getFileExtension(language)}`,
    language,
    code: codeTemplates[language] ?? '// Code snippet',
    lineCount,
    collapsed: faker.datatype.boolean({ probability: 0.7 }),
    ...overrides,
  };
}

// ============ BULK FACTORIES ============

/**
 * Creates multiple collapsible sections
 * @param count - Number of sections
 * @returns Array of collapsible sections
 */
export function createFakeCollapsibleSections(count: number = 5): FakeCollapsibleSection[] {
  return Array.from({ length: count }, () => createFakeCollapsibleSection());
}

/**
 * Creates multiple FAQ items
 * @param count - Number of FAQs
 * @returns Array of FAQ items
 */
export function createFakeFaqItems(count: number = 8): FakeFaqItem[] {
  const questions = [
    i18n.t('factory.collapsible.howDoIResetMy', 'How do I reset my password?'),
    i18n.t('factory.collapsible.whatPaymentMethodsDoYou', 'What payment methods do you accept?'),
    i18n.t('factory.collapsible.howLongDoesShippingTake', 'How long does shipping take?'),
    i18n.t('factory.collapsible.canICancelMySubscription', 'Can I cancel my subscription?'),
    i18n.t('factory.collapsible.howDoIContactSupport', 'How do I contact support?'),
    i18n.t('factory.collapsible.whatIsYourRefundPolicy', 'What is your refund policy?'),
    i18n.t('factory.collapsible.howDoIUpdateMy', 'How do I update my account information?'),
    i18n.t('factory.collapsible.isMyDataSecure', 'Is my data secure?'),
    i18n.t(
      'factory.collapsible.doYouOfferInternationalShipping',
      'Do you offer international shipping?'
    ),
    i18n.t('factory.collapsible.howCanITrackMy', 'How can I track my order?'),
  ];

  return questions.slice(0, count).map((question) => createFakeFaqItem({ question }));
}

/**
 * Creates FAQ items grouped by category
 * @returns FAQs grouped by category
 */
export function createFakeFaqByCategory(): Record<string, FakeFaqItem[]> {
  const groups: Record<string, FakeFaqItem[]> = {};

  for (const category of FAQ_CATEGORIES) {
    groups[category] = Array.from({ length: faker.number.int({ min: 2, max: 4 }) }, () =>
      createFakeFaqItem({ category })
    );
  }

  return groups;
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a nested collapsible structure
 * @param maxDepth - Maximum nesting depth
 * @param maxChildren - Maximum children per node
 * @returns Root nested collapsible
 */
export function createFakeNestedCollapsible(
  maxDepth: number = 3,
  maxChildren: number = 3
): FakeNestedCollapsible {
  function createNode(level: number): FakeNestedCollapsible {
    const hasChildren = level < maxDepth && faker.datatype.boolean({ probability: 0.6 });
    const childCount = hasChildren ? faker.number.int({ min: 1, max: maxChildren }) : 0;

    return {
      id: faker.string.uuid(),
      title: faker.helpers.arrayElement([
        i18n.t('factory.collapsible.levelSection', 'Level {{level}} Section', { level: level + 1 }),
        faker.lorem.words({ min: 2, max: 4 }),
      ]),
      content: hasChildren ? undefined : faker.lorem.paragraph(),
      level,
      defaultOpen: level === 0 || faker.datatype.boolean({ probability: 0.3 }),
      children: hasChildren
        ? Array.from({ length: childCount }, () => createNode(level + 1))
        : undefined,
    };
  }

  return createNode(0);
}

/**
 * Creates settings sections with expandable panels
 * @param count - Number of sections
 * @returns Array of settings sections
 */
export function createFakeSettingsSections(count: number = 4): FakeSettingsSection[] {
  const sections = [
    {
      title: i18n.t('factory.collapsible.account', 'Account'),
      icon: i18n.t('factory.collapsible.user', 'User'),
      items: [
        {
          id: 'name',
          label: i18n.t('factory.collapsible.displayName', 'Display Name'),
          type: 'input' as const,
          value: faker.person.fullName(),
        },
        {
          id: 'email',
          label: i18n.t('factory.collapsible.email', 'Email'),
          type: 'input' as const,
          value: faker.internet.email(),
        },
      ],
    },
    {
      title: i18n.t('factory.collapsible.notifications', 'Notifications'),
      icon: i18n.t('factory.collapsible.bell', 'Bell'),
      items: [
        {
          id: 'email-notif',
          label: i18n.t('factory.collapsible.emailNotifications', 'Email Notifications'),
          type: 'toggle' as const,
          value: true,
        },
        {
          id: 'push-notif',
          label: i18n.t('factory.collapsible.pushNotifications', 'Push Notifications'),
          type: 'toggle' as const,
          value: false,
        },
      ],
    },
    {
      title: i18n.t('factory.collapsible.privacy', 'Privacy'),
      icon: i18n.t('factory.collapsible.lock', 'Lock'),
      items: [
        {
          id: 'profile-visibility',
          label: i18n.t('factory.collapsible.profileVisibility', 'Profile Visibility'),
          type: 'select' as const,
          value: 'public',
        },
        {
          id: 'activity-status',
          label: i18n.t('factory.collapsible.showActivityStatus', 'Show Activity Status'),
          type: 'toggle' as const,
          value: true,
        },
      ],
    },
    {
      title: i18n.t('factory.collapsible.appearance', 'Appearance'),
      icon: i18n.t('factory.collapsible.palette', 'Palette'),
      items: [
        {
          id: 'theme',
          label: i18n.t('factory.collapsible.theme', 'Theme'),
          type: 'select' as const,
          value: 'system',
        },
        {
          id: 'compact-mode',
          label: i18n.t('factory.collapsible.compactMode', 'Compact Mode'),
          type: 'toggle' as const,
          value: false,
        },
      ],
    },
    {
      title: i18n.t('factory.collapsible.security', 'Security'),
      icon: i18n.t('factory.collapsible.shield', 'Shield'),
      items: [
        {
          id: '2fa',
          label: i18n.t('factory.collapsible.twoFactorAuthentication', 'Two-Factor Authentication'),
          type: 'toggle' as const,
          value: false,
        },
        {
          id: 'sessions',
          label: i18n.t('factory.collapsible.activeSessions', 'Active Sessions'),
          type: 'input' as const,
          value: i18n.t('factory.collapsible.threeDevices', '3 devices'),
        },
      ],
    },
  ];

  return sections.slice(0, count).map((section, index) => ({
    id: faker.string.uuid(),
    title: section.title,
    icon: section.icon,
    description: faker.lorem.sentence(),
    expanded: index === 0,
    items: section.items.map((item) => ({
      ...item,
      description: faker.helpers.maybe(() => faker.lorem.sentence({ min: 3, max: 8 }), {
        probability: 0.3,
      }),
    })),
  }));
}

/**
 * Creates accordion-style collapsible group (only one open at a time)
 * @param count - Number of items
 * @returns Accordion configuration
 */
export function createFakeAccordionGroup(count: number = 5): {
  activeId: null | string;
  items: FakeCollapsibleSection[];
} {
  const items = createFakeCollapsibleSections(count);
  const activeIndex = faker.helpers.maybe(() => faker.number.int({ min: 0, max: count - 1 }), {
    probability: 0.7,
  });

  return {
    items,
    activeId: activeIndex !== undefined ? items[activeIndex].id : null,
  };
}

/**
 * Creates a documentation page structure with collapsible sections
 * @returns Documentation structure
 */
export function createFakeDocumentationPage(): {
  codeExamples: FakeCodeSnippetCollapsible[];
  sections: FakeCollapsibleWithMeta[];
  title: string;
} {
  return {
    title: faker.helpers.arrayElement([
      i18n.t('factory.collapsible.gettingStarted', 'Getting Started'),
      i18n.t('factory.collapsible.apiReference', 'API Reference'),
      i18n.t('factory.collapsible.componentGuide', 'Component Guide'),
      i18n.t('factory.collapsible.installation', 'Installation'),
      i18n.t('factory.collapsible.configuration', 'Configuration'),
    ]),
    sections: Array.from({ length: faker.number.int({ min: 3, max: 6 }) }, () =>
      createFakeCollapsibleWithMeta()
    ),
    codeExamples: Array.from({ length: faker.number.int({ min: 2, max: 4 }) }, () =>
      createFakeCodeSnippetCollapsible()
    ),
  };
}

/**
 * Creates a product details collapsible structure
 * @returns Product details sections
 */
export function createFakeProductDetails(): FakeCollapsibleSection[] {
  return [
    {
      id: 'description',
      title: i18n.t('factory.collapsible.productDescription', 'Product Description'),
      content: faker.commerce.productDescription(),
      defaultOpen: true,
      disabled: false,
    },
    {
      id: 'specifications',
      title: i18n.t('factory.collapsible.technicalSpecifications', 'Technical Specifications'),
      content: i18n.t(
        'factory.collapsible.productSpecs',
        '• Material: {{material}}\n• Dimensions: {{width}}cm x {{height}}cm\n• Weight: {{weight}}kg',
        {
          material: faker.commerce.productMaterial(),
          width: faker.number.int({ min: 10, max: 50 }),
          height: faker.number.int({ min: 10, max: 50 }),
          weight: faker.number.float({ min: 0.1, max: 5, fractionDigits: 1 }),
        }
      ),
      defaultOpen: false,
      disabled: false,
    },
    {
      id: 'shipping',
      title: i18n.t('factory.collapsible.shippingReturns', 'Shipping & Returns'),
      content: i18n.t(
        'factory.collapsible.freeShippingOnOrdersOver',
        'Free shipping on orders over $50. 30-day return policy with full refund.'
      ),
      defaultOpen: false,
      disabled: false,
    },
    {
      id: 'reviews',
      title: i18n.t('factory.collapsible.customerReviews', 'Customer Reviews ({{count}})', {
        count: faker.number.int({ min: 10, max: 500 }),
      }),
      content: faker.lorem.paragraphs(2),
      defaultOpen: false,
      disabled: false,
    },
  ];
}

// ============ MATRIX FACTORY ============

/**
 * Creates a matrix of collapsible configurations for visual testing
 * @returns Matrix of state × animation × size combinations
 */
export function createFakeCollapsibleMatrix(): Array<{
  animation: CollapsibleAnimation;
  disabled: boolean;
  size: CollapsibleSize;
  state: CollapsibleState;
}> {
  const matrix: Array<{
    animation: CollapsibleAnimation;
    disabled: boolean;
    size: CollapsibleSize;
    state: CollapsibleState;
  }> = [];

  for (const state of COLLAPSIBLE_STATES) {
    for (const animation of COLLAPSIBLE_ANIMATIONS) {
      for (const size of COLLAPSIBLE_SIZES) {
        matrix.push({ state, animation, size, disabled: false });
      }
    }
  }

  return matrix;
}

/**
 * Creates showcase of all collapsible patterns
 * @returns Object with different collapsible use cases
 */
export function createFakeCollapsibleShowcase(): {
  accordion: ReturnType<typeof createFakeAccordionGroup>;
  documentation: ReturnType<typeof createFakeDocumentationPage>;
  faq: FakeFaqItem[];
  faqByCategory: Record<string, FakeFaqItem[]>;
  nested: FakeNestedCollapsible;
  panels: FakeCollapsiblePanel[];
  productDetails: FakeCollapsibleSection[];
  settings: FakeSettingsSection[];
  simple: FakeCollapsibleSection[];
  withMeta: FakeCollapsibleWithMeta[];
} {
  return {
    simple: createFakeCollapsibleSections(3),
    withMeta: Array.from({ length: 3 }, () => createFakeCollapsibleWithMeta()),
    faq: createFakeFaqItems(5),
    faqByCategory: createFakeFaqByCategory(),
    nested: createFakeNestedCollapsible(),
    settings: createFakeSettingsSections(),
    accordion: createFakeAccordionGroup(),
    panels: Array.from({ length: 3 }, () => createFakeCollapsiblePanel()),
    documentation: createFakeDocumentationPage(),
    productDetails: createFakeProductDetails(),
  };
}

// ═══════════════════════════════════════════════════════════════
// TEST HELPER FACTORIES (Enterprise Documentation)
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a collapsible section in expanded state for testing
 * @returns An expanded collapsible section
 */
export function createFakeCollapsibleExpanded(): FakeCollapsibleSection {
  return createFakeCollapsibleSection({
    defaultOpen: true,
    disabled: false,
    title: i18n.t('factory.collapsible.expandedSection', 'Expanded Section'),
    content: i18n.t(
      'factory.collapsible.thisSectionIsExpandedBy',
      'This section is expanded by default for testing purposes.'
    ),
  });
}

/**
 * Creates a collapsible section in collapsed state for testing
 * @returns A collapsed collapsible section
 */
export function createFakeCollapsibleCollapsed(): FakeCollapsibleSection {
  return createFakeCollapsibleSection({
    defaultOpen: false,
    disabled: false,
    title: i18n.t('factory.collapsible.collapsedSection', 'Collapsed Section'),
    content: i18n.t(
      'factory.collapsible.thisSectionIsCollapsedBy',
      'This section is collapsed by default for testing purposes.'
    ),
  });
}

/**
 * Creates a disabled collapsible section for testing
 * @returns A disabled collapsible section
 */
export function createFakeCollapsibleDisabled(): FakeCollapsibleSection {
  return createFakeCollapsibleSection({
    defaultOpen: false,
    disabled: true,
    title: i18n.t('factory.collapsible.disabledSection', 'Disabled Section'),
    content: i18n.t(
      'factory.collapsible.thisSectionCannotBeToggled',
      'This section cannot be toggled.'
    ),
  });
}

/**
 * Creates a pair of collapsibles for testing toggle interactions
 * @returns Array with one expanded and one collapsed section
 */
export function createFakeCollapsibleTogglePair(): FakeCollapsibleSection[] {
  return [createFakeCollapsibleExpanded(), createFakeCollapsibleCollapsed()];
}

/**
 * Creates collapsible sections for testing keyboard navigation
 * @param count - Number of sections (default: 3)
 * @returns Array of collapsible sections for keyboard nav testing
 */
export function createFakeCollapsibleKeyboardTestSections(
  count: number = 3
): FakeCollapsibleSection[] {
  return Array.from({ length: count }, (_, index) =>
    createFakeCollapsibleSection({
      defaultOpen: index === 0, // Only first is open
      disabled: false,
      title: i18n.t('factory.collapsible.sectionTitle', 'Section {{number}}', {
        number: index + 1,
      }),
      content: i18n.t(
        'factory.collapsible.sectionContent',
        'Content for section {{number}}. Use keyboard to navigate.',
        { number: index + 1 }
      ),
    })
  );
}

/**
 * Creates collapsible data for dark mode testing
 * @returns Collapsible section configured for dark mode testing
 */
export function createFakeCollapsibleDarkMode(): FakeCollapsibleWithMeta {
  return createFakeCollapsibleWithMeta({
    defaultOpen: false,
    disabled: false,
    title: i18n.t('factory.collapsible.darkModeSection', 'Dark Mode Section'),
    content: i18n.t(
      'factory.collapsible.thisContentAdaptsToDark',
      'This content adapts to dark theme automatically.'
    ),
    subtitle: i18n.t(
      'factory.collapsible.verifyVisualAppearanceInDark',
      'Verify visual appearance in dark mode'
    ),
    icon: i18n.t('factory.collapsible.moon', 'Moon'),
    tag: i18n.t('factory.collapsible.theme', 'Theme'),
  });
}

/**
 * Creates collapsible data for animation testing
 * @param animation - Animation type
 * @returns Collapsible panel with specified animation
 */
export function createFakeCollapsibleWithAnimation(
  animation: CollapsibleAnimation = 'slide'
): FakeCollapsiblePanel {
  return createFakeCollapsiblePanel({
    animation,
    open: false,
    disabled: false,
    header: i18n.t('factory.collapsible.animationHeader', '{{animation}} Animation', {
      animation: animation.charAt(0).toUpperCase() + animation.slice(1),
    }),
    content: i18n.t(
      'factory.collapsible.animationContent',
      'This collapsible uses {{animation}} animation when toggling.',
      { animation }
    ),
  });
}

/**
 * Creates collapsible panels for all animation types
 * @returns Array of panels with different animations
 */
export function createFakeCollapsibleAllAnimations(): FakeCollapsiblePanel[] {
  return COLLAPSIBLE_ANIMATIONS.map((animation) => createFakeCollapsibleWithAnimation(animation));
}
