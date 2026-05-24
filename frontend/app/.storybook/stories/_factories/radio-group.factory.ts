import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// RADIO GROUP FACTORY
// ============================================================================
// Comprehensive test data factories for the RadioGroup component.
// Follows the Button factory pattern with type exports, constants, and
// specialized factories for different radio group configurations.
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Radio group orientation
 * @description Controls the layout direction of radio items
 */
export type RadioGroupOrientation = 'horizontal' | 'vertical';

/**
 * Radio group size variant
 * @description Controls the visual size of radio buttons
 */
export type RadioGroupSize = 'default' | 'lg' | 'sm';

/**
 * Radio item state
 * @description The current state of a radio item
 */
export type RadioItemState = 'checked' | 'default' | 'disabled' | 'error' | 'focus';

/**
 * Radio group variant
 * @description Visual style variant
 */
export type RadioGroupVariant = 'card' | 'default' | 'outline';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All orientation options
 */
export const RADIO_GROUP_ORIENTATIONS: RadioGroupOrientation[] = ['vertical', 'horizontal'];

/**
 * All size options
 */
export const RADIO_GROUP_SIZES: RadioGroupSize[] = ['sm', 'default', 'lg'];

/**
 * All item states
 */
export const RADIO_ITEM_STATES: RadioItemState[] = [
  'default',
  'checked',
  'disabled',
  'focus',
  'error',
];

/**
 * All variants
 */
export const RADIO_GROUP_VARIANTS: RadioGroupVariant[] = ['default', 'outline', 'card'];

/**
 * Common radio group labels for forms
 */
const GROUP_LABELS = [
  i18n.t('factory.radioGroup.selectAnOption', 'Select an option'),
  i18n.t('factory.radioGroup.chooseYourPreference', 'Choose your preference'),
  i18n.t('factory.radioGroup.pickOne', 'Pick one'),
  i18n.t('factory.radioGroup.howWouldYouLikeTo', 'How would you like to proceed?'),
  i18n.t('factory.radioGroup.selectCategory', 'Select category'),
  i18n.t('factory.radioGroup.notificationPreference', 'Notification preference'),
  i18n.t('factory.radioGroup.deliveryMethod', 'Delivery method'),
  i18n.t('factory.radioGroup.paymentMethod', 'Payment method'),
  i18n.t('factory.radioGroup.sizeSelection', 'Size selection'),
  i18n.t('factory.radioGroup.priorityLevel', 'Priority level'),
];

/**
 * Generic option sets for different contexts
 */
const OPTION_SETS = {
  yesNo: ['Yes', 'No'],
  yesNoMaybe: ['Yes', 'No', i18n.t('factory.radioGroup.maybe', 'Maybe')],
  priority: [
    'Low',
    i18n.t('factory.radioGroup.medium', 'Medium'),
    i18n.t('factory.radioGroup.high', 'High'),
    i18n.t('factory.radioGroup.critical', 'Critical'),
  ],
  frequency: [
    i18n.t('factory.radioGroup.never', 'Never'),
    i18n.t('factory.radioGroup.daily', 'Daily'),
    i18n.t('factory.radioGroup.weekly', 'Weekly'),
    i18n.t('factory.radioGroup.monthly', 'Monthly'),
  ],
  size: [
    i18n.t('factory.radioGroup.small', 'Small'),
    i18n.t('factory.radioGroup.medium', 'Medium'),
    i18n.t('factory.radioGroup.large', 'Large'),
    i18n.t('factory.radioGroup.extraLarge', 'Extra Large'),
  ],
  agreement: [
    i18n.t('factory.radioGroup.stronglyDisagree', 'Strongly Disagree'),
    i18n.t('factory.radioGroup.disagree', 'Disagree'),
    i18n.t('factory.radioGroup.neutral', 'Neutral'),
    i18n.t('factory.radioGroup.agree', 'Agree'),
    i18n.t('factory.radioGroup.stronglyAgree', 'Strongly Agree'),
  ],
  rating: [
    i18n.t('factory.radioGroup.poor', 'Poor'),
    i18n.t('factory.radioGroup.fair', 'Fair'),
    i18n.t('factory.radioGroup.good', 'Good'),
    i18n.t('factory.radioGroup.veryGood', 'Very Good'),
    i18n.t('factory.radioGroup.excellent', 'Excellent'),
  ],
  delivery: [
    i18n.t('factory.radioGroup.standard', 'Standard'),
    i18n.t('factory.radioGroup.express', 'Express'),
    i18n.t('factory.radioGroup.overnight', 'Overnight'),
    i18n.t('factory.radioGroup.sameDay', 'Same Day'),
  ],
  payment: [
    i18n.t('factory.radioGroup.creditCard', 'Credit Card'),
    'PayPal',
    i18n.t('factory.radioGroup.bankTransfer', 'Bank Transfer'),
    i18n.t('factory.radioGroup.cashOnDelivery', 'Cash on Delivery'),
  ],
};

/**
 * Common option labels
 */
const OPTION_LABELS = [
  i18n.t('factory.radioGroup.optionA', 'Option A'),
  i18n.t('factory.radioGroup.optionB', 'Option B'),
  i18n.t('factory.radioGroup.optionC', 'Option C'),
  i18n.t('factory.radioGroup.optionD', 'Option D'),
  i18n.t('factory.radioGroup.default', 'Default'),
  i18n.t('factory.radioGroup.comfortable', 'Comfortable'),
  i18n.t('factory.radioGroup.compact', 'Compact'),
  i18n.t('factory.radioGroup.standard', 'Standard'),
  i18n.t('factory.radioGroup.premium', 'Premium'),
  i18n.t('factory.radioGroup.basic', 'Basic'),
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Individual radio item configuration
 */
export interface FakeRadioItem {
  /** Description text below the label */
  description?: string;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Item state */
  state?: RadioItemState;
  /** Item value */
  value: string;
}

/**
 * Complete radio group configuration
 */
export interface FakeRadioGroup {
  /** Default/initial value */
  defaultValue?: string;
  /** Group description */
  description?: string;
  /** Error message when invalid */
  errorMessage?: string;
  /** Unique identifier */
  id: string;
  /** Whether the group is disabled */
  isDisabled?: boolean;
  /** Whether selection is required */
  isRequired?: boolean;
  /** Radio items */
  items: FakeRadioItem[];
  /** Group label */
  label: string;
  /** Group name for form submission */
  name: string;
  /** Layout orientation */
  orientation: RadioGroupOrientation;
  /** Size variant */
  size?: RadioGroupSize;
  /** Currently selected value */
  value?: string;
  /** Visual variant */
  variant?: RadioGroupVariant;
}

/**
 * Radio group with card-style items
 */
export interface FakeRadioCardGroup extends FakeRadioGroup {
  /** Items with extended card properties */
  items: FakeRadioCardItem[];
}

/**
 * Card-style radio item with extended properties
 */
export interface FakeRadioCardItem extends FakeRadioItem {
  /** Icon name */
  icon?: string;
  /** Price or value display */
  price?: string;
  /** Subtitle text */
  subtitle?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique value from label
 */
function valueFromLabel(label: string): string {
  return label.toLowerCase().replaceAll(/\s+/g, '-');
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake radio item
 * @param overrides - Optional property overrides
 * @returns A fake radio item
 */
export function createFakeRadioItem(overrides?: Partial<FakeRadioItem>): FakeRadioItem {
  const label = overrides?.label ?? faker.helpers.arrayElement(OPTION_LABELS);
  const value = overrides?.value ?? valueFromLabel(label);

  return {
    id: faker.string.uuid(),
    value,
    label,
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    state: faker.helpers.arrayElement(RADIO_ITEM_STATES),
    ...overrides,
  };
}

/**
 * Creates multiple fake radio items
 * @param count - Number of items to create
 * @param overrides - Optional property overrides
 * @returns Array of fake radio items
 */
export function createFakeRadioItems(
  count: number,
  overrides?: Partial<FakeRadioItem>
): FakeRadioItem[] {
  return Array.from({ length: count }, (_, index) =>
    createFakeRadioItem({
      label: i18n.t('factory.radioGroup.optionLabel', 'Option {{number}}', { number: index + 1 }),
      ...overrides,
    })
  );
}

/**
 * Creates fake radio items from a predefined option set
 * @param setName - Name of the option set
 * @returns Array of fake radio items
 */
export function createFakeRadioItemsFromSet(setName: keyof typeof OPTION_SETS): FakeRadioItem[] {
  return OPTION_SETS[setName].map((label) =>
    createFakeRadioItem({
      label,
      value: valueFromLabel(label),
    })
  );
}

/**
 * Creates a fake card-style radio item
 * @param overrides - Optional property overrides
 * @returns A fake card radio item
 */
export function createFakeRadioCardItem(overrides?: Partial<FakeRadioCardItem>): FakeRadioCardItem {
  const baseItem = createFakeRadioItem(overrides);

  return {
    ...baseItem,
    subtitle: faker.helpers.maybe(() => faker.lorem.words({ min: 2, max: 4 }), {
      probability: 0.5,
    }),
    icon: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['check', 'star', 'zap', 'shield', 'award']),
      { probability: 0.5 }
    ),
    price: faker.helpers.maybe(() => faker.commerce.price({ min: 0, max: 100, symbol: '$' }), {
      probability: 0.3,
    }),
    ...overrides,
  };
}

/**
 * Creates a fake radio group configuration
 * @param overrides - Optional property overrides
 * @returns A fake radio group configuration
 */
export function createFakeRadioGroup(overrides?: Partial<FakeRadioGroup>): FakeRadioGroup {
  const itemCount = faker.number.int({ min: 2, max: 5 });
  const items = overrides?.items ?? createFakeRadioItems(itemCount);
  const defaultValue = overrides?.defaultValue ?? items[0]?.value;

  return {
    id: faker.string.uuid(),
    name: faker.lorem.slug(2),
    label: faker.helpers.arrayElement(GROUP_LABELS),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 }),
    items,
    orientation: faker.helpers.arrayElement(RADIO_GROUP_ORIENTATIONS),
    size: faker.helpers.arrayElement(RADIO_GROUP_SIZES),
    variant: faker.helpers.arrayElement(RADIO_GROUP_VARIANTS),
    defaultValue,
    value: defaultValue,
    isRequired: faker.datatype.boolean({ probability: 0.3 }),
    isDisabled: faker.datatype.boolean({ probability: 0.05 }),
    errorMessage: faker.helpers.maybe(
      () => i18n.t('factory.radioGroup.pleaseSelectAnOption', 'Please select an option'),
      { probability: 0.1 }
    ),
    ...overrides,
  };
}

/**
 * Creates multiple fake radio groups
 * @param count - Number of groups to create
 * @param overrides - Optional property overrides
 * @returns Array of fake radio group configurations
 */
export function createFakeRadioGroups(
  count: number,
  overrides?: Partial<FakeRadioGroup>
): FakeRadioGroup[] {
  return Array.from({ length: count }, () => createFakeRadioGroup(overrides));
}

/**
 * Creates a fake card-style radio group
 * @param overrides - Optional property overrides
 * @returns A fake card radio group configuration
 */
export function createFakeRadioCardGroup(
  overrides?: Partial<FakeRadioCardGroup>
): FakeRadioCardGroup {
  const itemCount = faker.number.int({ min: 3, max: 5 });
  const items = Array.from({ length: itemCount }, () => createFakeRadioCardItem());
  const baseGroup = createFakeRadioGroup({ ...overrides, variant: 'card' });

  return {
    ...baseGroup,
    items,
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a yes/no radio group
 * @returns A yes/no radio group configuration
 */
export function createFakeYesNoRadioGroup(): FakeRadioGroup {
  return createFakeRadioGroup({
    label: i18n.t('factory.radioGroup.wouldYouLikeToContinue', 'Would you like to continue?'),
    items: createFakeRadioItemsFromSet('yesNo'),
    orientation: 'horizontal',
  });
}

/**
 * Creates a priority selection radio group
 * @returns A priority radio group configuration
 */
export function createFakePriorityRadioGroup(): FakeRadioGroup {
  return createFakeRadioGroup({
    label: i18n.t('factory.radioGroup.selectPriorityLevel', 'Select priority level'),
    items: createFakeRadioItemsFromSet('priority'),
    orientation: 'vertical',
  });
}

/**
 * Creates a size selection radio group
 * @returns A size radio group configuration
 */
export function createFakeSizeRadioGroup(): FakeRadioGroup {
  return createFakeRadioGroup({
    label: i18n.t('factory.radioGroup.selectSize', 'Select size'),
    items: createFakeRadioItemsFromSet('size'),
    orientation: 'horizontal',
  });
}

/**
 * Creates a rating/satisfaction radio group
 * @returns A rating radio group configuration
 */
export function createFakeRatingRadioGroup(): FakeRadioGroup {
  return createFakeRadioGroup({
    label: i18n.t('factory.radioGroup.howWouldYouRateThis', 'How would you rate this experience?'),
    items: createFakeRadioItemsFromSet('rating'),
    orientation: 'horizontal',
  });
}

/**
 * Creates a delivery method radio group
 * @returns A delivery method radio group configuration
 */
export function createFakeDeliveryRadioGroup(): FakeRadioGroup {
  const items = OPTION_SETS.delivery.map((label, index) =>
    createFakeRadioItem({
      label,
      description: faker.helpers.arrayElement([
        '3-5 business days',
        '2-3 business days',
        i18n.t('factory.radioGroup.nextBusinessDay', 'Next business day'),
        i18n.t('factory.radioGroup.within4Hours', 'Within 4 hours'),
      ]),
      value: valueFromLabel(label),
      disabled: index === 3, // Same day often unavailable
    })
  );

  return createFakeRadioGroup({
    label: i18n.t('factory.radioGroup.selectDeliveryMethod', 'Select delivery method'),
    items,
    orientation: 'vertical',
    variant: 'outline',
  });
}

/**
 * Creates a payment method radio group
 * @returns A payment method radio group configuration
 */
export function createFakePaymentRadioGroup(): FakeRadioGroup {
  return createFakeRadioGroup({
    label: i18n.t('factory.radioGroup.selectPaymentMethod', 'Select payment method'),
    items: createFakeRadioItemsFromSet('payment'),
    orientation: 'vertical',
    variant: 'card',
  });
}

/**
 * Creates a disabled radio group
 * @returns A disabled radio group configuration
 */
export function createFakeDisabledRadioGroup(): FakeRadioGroup {
  return createFakeRadioGroup({
    isDisabled: true,
    label: i18n.t('factory.radioGroup.disabledSelection', 'Disabled selection'),
  });
}

/**
 * Creates a radio group with error state
 * @returns A radio group with error configuration
 */
export function createFakeErrorRadioGroup(): FakeRadioGroup {
  return createFakeRadioGroup({
    value: undefined,
    defaultValue: undefined,
    isRequired: true,
    errorMessage: i18n.t(
      'factory.radioGroup.pleaseSelectAnOptionTo',
      'Please select an option to continue'
    ),
  });
}

/**
 * Creates a radio group with descriptions on each item
 * @returns A radio group with item descriptions
 */
export function createFakeDescriptiveRadioGroup(): FakeRadioGroup {
  const items: FakeRadioItem[] = [
    {
      id: faker.string.uuid(),
      value: 'free',
      label: i18n.t('factory.radioGroup.freePlan', 'Free Plan'),
      description: i18n.t(
        'factory.radioGroup.basicFeaturesForPersonalUse',
        'Basic features for personal use'
      ),
    },
    {
      id: faker.string.uuid(),
      value: 'pro',
      label: i18n.t('factory.radioGroup.proPlan', 'Pro Plan'),
      description: i18n.t(
        'factory.radioGroup.advancedFeaturesForProfessionals',
        'Advanced features for professionals'
      ),
    },
    {
      id: faker.string.uuid(),
      value: 'enterprise',
      label: i18n.t('factory.radioGroup.enterprisePlan', 'Enterprise Plan'),
      description: i18n.t(
        'factory.radioGroup.fullAccessWithDedicatedSupport',
        'Full access with dedicated support'
      ),
    },
  ];

  return createFakeRadioGroup({
    label: i18n.t('factory.radioGroup.selectAPlan', 'Select a plan'),
    items,
    orientation: 'vertical',
    variant: 'card',
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of radio groups across orientations
 * @returns Grid of radio groups for each orientation
 */
export function createRadioGroupOrientationMatrix(): FakeRadioGroup[] {
  return RADIO_GROUP_ORIENTATIONS.map((orientation) =>
    createFakeRadioGroup({
      orientation,
      label: i18n.t('factory.radioGroup.orientationLayout', '{{orientation}} layout', {
        orientation: orientation.charAt(0).toUpperCase() + orientation.slice(1),
      }),
    })
  );
}

/**
 * Creates a matrix of radio groups across sizes
 * @returns Grid of radio groups for each size
 */
export function createRadioGroupSizeMatrix(): FakeRadioGroup[] {
  return RADIO_GROUP_SIZES.map((size) =>
    createFakeRadioGroup({
      size,
      label: i18n.t('factory.radioGroup.sizeLabel', '{{size}} size', {
        size: size.charAt(0).toUpperCase() + size.slice(1),
      }),
    })
  );
}

/**
 * Creates a matrix of radio groups across variants
 * @returns Grid of radio groups for each variant
 */
export function createRadioGroupVariantMatrix(): FakeRadioGroup[] {
  return RADIO_GROUP_VARIANTS.map((variant) =>
    createFakeRadioGroup({
      variant,
      label: i18n.t('factory.radioGroup.variantLabel', '{{variant}} variant', {
        variant: variant.charAt(0).toUpperCase() + variant.slice(1),
      }),
    })
  );
}

/**
 * Creates a matrix of radio items across states
 * @returns Grid of radio items for each state
 */
export function createRadioItemStateMatrix(): FakeRadioItem[] {
  return RADIO_ITEM_STATES.map((state) =>
    createFakeRadioItem({
      state,
      label: i18n.t('factory.radioGroup.stateLabel', '{{state}} state', {
        state: state.charAt(0).toUpperCase() + state.slice(1),
      }),
      disabled: state === 'disabled',
    })
  );
}

/**
 * Creates a full orientation x variant matrix
 * @returns Grid of all orientation/variant combinations
 */
export function createRadioGroupOrientationVariantMatrix(): FakeRadioGroup[][] {
  return RADIO_GROUP_ORIENTATIONS.map((orientation) =>
    RADIO_GROUP_VARIANTS.map((variant) =>
      createFakeRadioGroup({
        orientation,
        variant,
        label: i18n.t(
          'factory.radioGroup.orientationVariantLabel',
          '{{orientation}} / {{variant}}',
          { orientation, variant }
        ),
      })
    )
  );
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all radio group configurations
 * @returns Array of radio group configs for showcase
 */
export function createRadioGroupShowcase(): Array<{
  description: string;
  group: FakeRadioGroup;
  name: string;
}> {
  return [
    {
      name: i18n.t('factory.radioGroup.default', 'Default'),
      description: i18n.t(
        'factory.radioGroup.standardRadioGroupWithVertical',
        'Standard radio group with vertical layout'
      ),
      group: createFakeRadioGroup({ orientation: 'vertical' }),
    },
    {
      name: i18n.t('factory.radioGroup.horizontal', 'Horizontal'),
      description: i18n.t(
        'factory.radioGroup.radioGroupWithHorizontalLayout',
        'Radio group with horizontal layout'
      ),
      group: createFakeRadioGroup({ orientation: 'horizontal' }),
    },
    {
      name: i18n.t('factory.radioGroup.yesNo', 'Yes/No'),
      description: i18n.t('factory.radioGroup.simpleBinaryChoice', 'Simple binary choice'),
      group: createFakeYesNoRadioGroup(),
    },
    {
      name: i18n.t('factory.radioGroup.priority', 'Priority'),
      description: i18n.t('factory.radioGroup.priorityLevelSelection', 'Priority level selection'),
      group: createFakePriorityRadioGroup(),
    },
    {
      name: i18n.t('factory.radioGroup.rating', 'Rating'),
      description: i18n.t(
        'factory.radioGroup.satisfactionRatingScale',
        'Satisfaction rating scale'
      ),
      group: createFakeRatingRadioGroup(),
    },
    {
      name: i18n.t('factory.radioGroup.delivery', 'Delivery'),
      description: i18n.t(
        'factory.radioGroup.deliveryMethodWithDescriptions',
        'Delivery method with descriptions'
      ),
      group: createFakeDeliveryRadioGroup(),
    },
    {
      name: i18n.t('factory.radioGroup.payment', 'Payment'),
      description: i18n.t('factory.radioGroup.paymentMethodSelection', 'Payment method selection'),
      group: createFakePaymentRadioGroup(),
    },
    {
      name: i18n.t('factory.radioGroup.descriptive', 'Descriptive'),
      description: i18n.t(
        'factory.radioGroup.planSelectionWithDetailedDescriptions',
        'Plan selection with detailed descriptions'
      ),
      group: createFakeDescriptiveRadioGroup(),
    },
    {
      name: i18n.t('factory.radioGroup.disabled', 'Disabled'),
      description: i18n.t('factory.radioGroup.disabledRadioGroup', 'Disabled radio group'),
      group: createFakeDisabledRadioGroup(),
    },
    {
      name: i18n.t('factory.radioGroup.error', 'Error'),
      description: i18n.t(
        'factory.radioGroup.radioGroupWithValidationError',
        'Radio group with validation error'
      ),
      group: createFakeErrorRadioGroup(),
    },
  ];
}

/**
 * Creates a complete test data set for radio group testing
 * @returns Comprehensive test data
 */
export function createRadioGroupTestData(): {
  cardGroups: FakeRadioCardGroup[];
  cardItems: FakeRadioCardItem[];
  groups: FakeRadioGroup[];
  items: FakeRadioItem[];
  orientationMatrix: FakeRadioGroup[];
  orientationVariantMatrix: FakeRadioGroup[][];
  showcase: Array<{ description: string; group: FakeRadioGroup; name: string }>;
  sizeMatrix: FakeRadioGroup[];
  stateMatrix: FakeRadioItem[];
  variantMatrix: FakeRadioGroup[];
} {
  return {
    items: createFakeRadioItems(5),
    cardItems: Array.from({ length: 4 }, () => createFakeRadioCardItem()),
    groups: createFakeRadioGroups(5),
    cardGroups: Array.from({ length: 3 }, () => createFakeRadioCardGroup()),
    orientationMatrix: createRadioGroupOrientationMatrix(),
    sizeMatrix: createRadioGroupSizeMatrix(),
    variantMatrix: createRadioGroupVariantMatrix(),
    stateMatrix: createRadioItemStateMatrix(),
    orientationVariantMatrix: createRadioGroupOrientationVariantMatrix(),
    showcase: createRadioGroupShowcase(),
  };
}
