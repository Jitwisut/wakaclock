import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ TYPE DEFINITIONS ============

/** Checkbox state */
export type CheckboxState = 'checked' | 'indeterminate' | 'unchecked';

/** Checkbox size variant */
export type CheckboxSize = 'default' | 'lg' | 'sm';

/** Checkbox label position */
export type CheckboxLabelPosition = 'left' | 'right';

/** Checkbox validation state */
export type CheckboxValidationState = 'default' | 'error' | 'success' | 'warning';

/** Checkbox group layout */
export type CheckboxGroupLayout = 'grid' | 'horizontal' | 'vertical';

/** Interface for fake checkbox option */
export interface FakeCheckboxOption {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Option description */
  description?: string;
  /** Whether the checkbox is disabled */
  disabled: boolean;
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Name for form submission */
  name: string;
  /** Whether the checkbox is required */
  required: boolean;
  /** Form submission value */
  value: string;
}

/** Interface for checkbox with validation */
export interface FakeCheckboxWithValidation extends FakeCheckboxOption {
  /** Error message */
  errorMessage?: string;
  /** Helper text */
  helperText?: string;
  /** Validation state */
  validationState: CheckboxValidationState;
}

/** Interface for checkbox group */
export interface FakeCheckboxGroup {
  /** Group description */
  description?: string;
  /** Whether the group is disabled */
  disabled: boolean;
  /** Error message */
  errorMessage?: string;
  /** Unique identifier */
  id: string;
  /** Group label */
  label: string;
  /** Group layout */
  layout: CheckboxGroupLayout;
  /** Checkbox options */
  options: FakeCheckboxOption[];
  /** Whether the group is required */
  required: boolean;
}

/** Interface for terms and conditions checkbox */
export interface FakeTermsCheckbox {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** HTML content for terms text */
  htmlContent?: string;
  /** Unique identifier */
  id: string;
  /** Privacy policy link */
  privacyUrl: string;
  /** Whether the checkbox is required */
  required: boolean;
  /** Terms and conditions link */
  termsUrl: string;
  /** Display text */
  text: string;
}

/** Interface for preference checkbox */
export interface FakePreferenceCheckbox {
  /** Preference category */
  category: string;
  /** Whether the preference is enabled */
  checked: boolean;
  /** Preference description */
  description: string;
  /** Unique identifier */
  id: string;
  /** Preference label */
  label: string;
}

/** Interface for filter checkbox */
export interface FakeFilterCheckbox {
  /** Whether the filter is active */
  checked: boolean;
  /** Number of items matching this filter */
  count: number;
  /** Unique identifier */
  id: string;
  /** Filter label */
  label: string;
}

/** Interface for checkbox tree node */
export interface FakeCheckboxTreeNode {
  /** Child nodes */
  children?: FakeCheckboxTreeNode[];
  /** Whether the node is expanded */
  expanded?: boolean;
  /** Unique identifier */
  id: string;
  /** Whether the node is indeterminate */
  indeterminate?: boolean;
  /** Node label */
  label: string;
  /** Whether the node is selected */
  selected: boolean;
}

// ============ CONSTANTS FOR ITERATION ============

/** All checkbox states */
export const CHECKBOX_STATES: CheckboxState[] = ['checked', 'indeterminate', 'unchecked'];

/** All checkbox sizes */
export const CHECKBOX_SIZES: CheckboxSize[] = ['default', 'lg', 'sm'];

/** All label positions */
export const CHECKBOX_LABEL_POSITIONS: CheckboxLabelPosition[] = ['left', 'right'];

/** All validation states */
export const CHECKBOX_VALIDATION_STATES: CheckboxValidationState[] = [
  'default',
  'error',
  'success',
  'warning',
];

/** All group layouts */
export const CHECKBOX_GROUP_LAYOUTS: CheckboxGroupLayout[] = ['grid', 'horizontal', 'vertical'];

/** Common checkbox labels */
export const CHECKBOX_LABELS = [
  i18n.t('factory.checkbox.acceptTermsAndConditions', 'Accept terms and conditions'),
  i18n.t('factory.checkbox.emailNotifications', 'Email notifications'),
  i18n.t('factory.checkbox.enableDarkMode', 'Enable dark mode'),
  i18n.t('factory.checkbox.marketingEmails', 'Marketing emails'),
  i18n.t('factory.checkbox.pushNotifications', 'Push notifications'),
  i18n.t('factory.checkbox.rememberMe', 'Remember me'),
  i18n.t('factory.checkbox.smsAlerts', 'SMS alerts'),
  i18n.t('factory.checkbox.subscribeToNewsletter', 'Subscribe to newsletter'),
  i18n.t('factory.checkbox.twofactorAuthentication', 'Two-factor authentication'),
  i18n.t('factory.checkbox.weeklyDigest', 'Weekly digest'),
];

/** Common preference categories */
export const CHECKBOX_PREFERENCE_CATEGORIES = [
  i18n.t('factory.checkbox.accessibility', 'Accessibility'),
  i18n.t('factory.checkbox.account', 'Account'),
  i18n.t('factory.checkbox.appearance', 'Appearance'),
  i18n.t('factory.checkbox.communication', 'Communication'),
  i18n.t('factory.checkbox.notifications', 'Notifications'),
  i18n.t('factory.checkbox.privacy', 'Privacy'),
  i18n.t('factory.checkbox.security', 'Security'),
];

/** Size-based class names */
export const CHECKBOX_SIZE_CLASSES: Record<CheckboxSize, string> = {
  default: 'h-4 w-4',
  lg: 'h-5 w-5',
  sm: 'h-3.5 w-3.5',
};

// ============ SINGLE ITEM FACTORIES ============

/**
 * Creates a single checkbox option
 * @param overrides - Optional partial overrides
 * @returns A checkbox option
 */
export function createFakeCheckboxOption(
  overrides?: Partial<FakeCheckboxOption>
): FakeCheckboxOption {
  const label = overrides?.label ?? faker.helpers.arrayElement(CHECKBOX_LABELS);
  const id = overrides?.id ?? faker.string.alphanumeric(8);

  return {
    id,
    name: id,
    label,
    value: faker.string.alphanumeric(6),
    checked: faker.datatype.boolean({ probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    required: faker.datatype.boolean({ probability: 0.2 }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 }),
    ...overrides,
  };
}

/**
 * Creates a checkbox with validation
 * @param overrides - Optional overrides
 * @returns A checkbox with validation state
 */
export function createFakeCheckboxWithValidation(
  overrides?: Partial<FakeCheckboxWithValidation>
): FakeCheckboxWithValidation {
  const validationState =
    overrides?.validationState ?? faker.helpers.arrayElement(CHECKBOX_VALIDATION_STATES);

  let errorMessage: string | undefined;
  if (validationState === 'error') {
    errorMessage = faker.helpers.arrayElement([
      i18n.t('factory.checkbox.thisFieldIsRequired', 'This field is required'),
      i18n.t('factory.checkbox.youMustAcceptTheTerms', 'You must accept the terms to continue'),
      i18n.t('factory.checkbox.pleaseCheckAtLeastOne', 'Please check at least one option'),
    ]);
  }

  return {
    ...createFakeCheckboxOption(overrides),
    validationState,
    errorMessage,
    helperText: faker.helpers.maybe(() => faker.lorem.sentence({ min: 3, max: 8 }), {
      probability: 0.3,
    }),
    ...overrides,
  };
}

/**
 * Creates a terms and conditions checkbox
 * @param overrides - Optional overrides
 * @returns A terms checkbox
 */
export function createFakeTermsCheckbox(overrides?: Partial<FakeTermsCheckbox>): FakeTermsCheckbox {
  return {
    id: faker.string.uuid(),
    text: faker.helpers.arrayElement([
      i18n.t(
        'factory.checkbox.iAgreeToTheTerms',
        'I agree to the Terms of Service and Privacy Policy'
      ),
      i18n.t(
        'factory.checkbox.iHaveReadAndAccept',
        'I have read and accept the Terms and Conditions'
      ),
      i18n.t(
        'factory.checkbox.iConsentToTheProcessing',
        'I consent to the processing of my personal data'
      ),
      i18n.t('factory.checkbox.iAcceptTheEndUser', 'I accept the End User License Agreement'),
    ]),
    termsUrl: '/terms',
    privacyUrl: '/privacy',
    required: true,
    checked: false,
    htmlContent: faker.helpers.maybe(
      () =>
        i18n.t(
          'factory.checkbox.termsAndPrivacy',
          'I agree to the <a href="/terms" class="underline">Terms of Service</a> and <a href="/privacy" class="underline">Privacy Policy</a>'
        ),
      { probability: 0.5 }
    ),
    ...overrides,
  };
}

/**
 * Creates a preference checkbox
 * @param overrides - Optional overrides
 * @returns A preference checkbox
 */
export function createFakePreferenceCheckbox(
  overrides?: Partial<FakePreferenceCheckbox>
): FakePreferenceCheckbox {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.checkbox.emailNotifications', 'Email notifications'),
      i18n.t('factory.checkbox.pushNotifications', 'Push notifications'),
      i18n.t('factory.checkbox.smsAlerts', 'SMS alerts'),
      i18n.t('factory.checkbox.weeklyDigest', 'Weekly digest'),
      i18n.t('factory.checkbox.marketingCommunications', 'Marketing communications'),
    ]),
    description: faker.lorem.sentence({ min: 5, max: 12 }),
    category: faker.helpers.arrayElement(CHECKBOX_PREFERENCE_CATEGORIES),
    checked: faker.datatype.boolean({ probability: 0.5 }),
    ...overrides,
  };
}

/**
 * Creates a filter checkbox
 * @param overrides - Optional overrides
 * @returns A filter checkbox
 */
export function createFakeFilterCheckbox(
  overrides?: Partial<FakeFilterCheckbox>
): FakeFilterCheckbox {
  return {
    id: faker.string.uuid(),
    label: faker.commerce.department(),
    count: faker.number.int({ min: 0, max: 999 }),
    checked: faker.datatype.boolean({ probability: 0.2 }),
    ...overrides,
  };
}

// ============ BULK FACTORIES ============

/**
 * Creates multiple checkbox options
 * @param count - Number of options
 * @returns Array of checkbox options
 */
export function createFakeCheckboxOptions(count: number = 5): FakeCheckboxOption[] {
  const usedLabels = new Set<string>();

  return Array.from({ length: count }, () => {
    let label = faker.helpers.arrayElement(CHECKBOX_LABELS);
    while (usedLabels.has(label)) {
      label = faker.lorem.words({ min: 2, max: 4 });
    }
    usedLabels.add(label);

    return createFakeCheckboxOption({ label });
  });
}

/**
 * Creates a checkbox group
 * @param overrides - Optional overrides
 * @returns A checkbox group
 */
export function createFakeCheckboxGroup(overrides?: Partial<FakeCheckboxGroup>): FakeCheckboxGroup {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.checkbox.selectYourPreferences', 'Select your preferences'),
      i18n.t('factory.checkbox.chooseFeatures', 'Choose features'),
      i18n.t('factory.checkbox.notificationSettings', 'Notification settings'),
      i18n.t('factory.checkbox.selectOptions', 'Select options'),
      i18n.t('factory.checkbox.availableFilters', 'Available filters'),
    ]),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    options: createFakeCheckboxOptions(faker.number.int({ min: 3, max: 6 })),
    layout: faker.helpers.arrayElement(CHECKBOX_GROUP_LAYOUTS),
    required: faker.datatype.boolean({ probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    errorMessage: undefined,
    ...overrides,
  };
}

/**
 * Creates multiple filter checkboxes
 * @param count - Number of filters
 * @returns Array of filter checkboxes
 */
export function createFakeFilterCheckboxes(count: number = 8): FakeFilterCheckbox[] {
  const departments = [
    i18n.t('factory.checkbox.electronics', 'Electronics'),
    i18n.t('factory.checkbox.clothing', 'Clothing'),
    i18n.t('factory.checkbox.homeGarden', 'Home & Garden'),
    i18n.t('factory.checkbox.sports', 'Sports'),
    i18n.t('factory.checkbox.books', 'Books'),
    i18n.t('factory.checkbox.toys', 'Toys'),
    i18n.t('factory.checkbox.health', 'Health'),
    i18n.t('factory.checkbox.beauty', 'Beauty'),
    i18n.t('factory.checkbox.automotive', 'Automotive'),
    i18n.t('factory.checkbox.office', 'Office'),
  ];

  return departments.slice(0, count).map((dept) =>
    createFakeFilterCheckbox({
      label: dept,
      id: dept.toLowerCase().replaceAll(/\s+/g, '-'),
    })
  );
}

/**
 * Creates grouped preferences
 * @returns Object with preferences grouped by category
 */
export function createFakePreferenceGroups(): Record<string, FakePreferenceCheckbox[]> {
  const groups: Record<string, FakePreferenceCheckbox[]> = {};

  for (const category of CHECKBOX_PREFERENCE_CATEGORIES) {
    groups[category] = Array.from({ length: faker.number.int({ min: 2, max: 4 }) }, () =>
      createFakePreferenceCheckbox({ category })
    );
  }

  return groups;
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a checkbox tree structure
 * @param depth - Maximum depth
 * @param breadth - Maximum children per node
 * @returns Root node of the tree
 */
export function createFakeCheckboxTree(
  depth: number = 3,
  breadth: number = 3
): FakeCheckboxTreeNode {
  function createNode(currentDepth: number): FakeCheckboxTreeNode {
    const hasChildren = currentDepth < depth && faker.datatype.boolean({ probability: 0.7 });
    const childCount = hasChildren ? faker.number.int({ min: 1, max: breadth }) : 0;

    const children = hasChildren
      ? Array.from({ length: childCount }, () => createNode(currentDepth + 1))
      : undefined;

    const allChildrenSelected = children?.every((c) => c.selected) ?? false;
    const someChildrenSelected = children?.some((c) => c.selected || c.indeterminate) ?? false;

    return {
      id: faker.string.uuid(),
      label: faker.lorem.words({ min: 1, max: 3 }),
      selected: hasChildren ? allChildrenSelected : faker.datatype.boolean({ probability: 0.3 }),
      indeterminate: hasChildren ? someChildrenSelected && !allChildrenSelected : false,
      expanded: faker.datatype.boolean({ probability: 0.5 }),
      children,
    };
  }

  return createNode(0);
}

/**
 * Creates a newsletter subscription form
 * @returns Newsletter form checkboxes
 */
export function createFakeNewsletterForm(): {
  categories: FakeCheckboxOption[];
  frequency: FakeCheckboxOption[];
  terms: FakeTermsCheckbox;
} {
  return {
    categories: [
      {
        id: 'tech',
        name: 'newsletter',
        label: i18n.t('factory.checkbox.technology', 'Technology'),
        value: 'tech',
        checked: true,
        disabled: false,
        required: false,
      },
      {
        id: 'design',
        name: 'newsletter',
        label: i18n.t('factory.checkbox.design', 'Design'),
        value: 'design',
        checked: false,
        disabled: false,
        required: false,
      },
      {
        id: 'business',
        name: 'newsletter',
        label: i18n.t('factory.checkbox.business', 'Business'),
        value: 'business',
        checked: false,
        disabled: false,
        required: false,
      },
      {
        id: 'lifestyle',
        name: 'newsletter',
        label: i18n.t('factory.checkbox.lifestyle', 'Lifestyle'),
        value: 'lifestyle',
        checked: false,
        disabled: false,
        required: false,
      },
    ],
    frequency: [
      {
        id: 'daily',
        name: 'frequency',
        label: i18n.t('factory.checkbox.dailyDigest', 'Daily digest'),
        value: 'daily',
        checked: false,
        disabled: false,
        required: false,
      },
      {
        id: 'weekly',
        name: 'frequency',
        label: i18n.t('factory.checkbox.weeklyRoundup', 'Weekly roundup'),
        value: 'weekly',
        checked: true,
        disabled: false,
        required: false,
      },
      {
        id: 'monthly',
        name: 'frequency',
        label: i18n.t('factory.checkbox.monthlyHighlights', 'Monthly highlights'),
        value: 'monthly',
        checked: false,
        disabled: false,
        required: false,
      },
    ],
    terms: createFakeTermsCheckbox(),
  };
}

/**
 * Creates cookie consent checkboxes
 * @returns Cookie consent options
 */
export function createFakeCookieConsent(): FakeCheckboxOption[] {
  return [
    {
      id: 'essential',
      name: 'cookies',
      label: i18n.t('factory.checkbox.essentialCookies', 'Essential cookies'),
      value: 'essential',
      description: i18n.t(
        'factory.checkbox.requiredForTheWebsiteTo',
        'Required for the website to function properly'
      ),
      checked: true,
      disabled: true,
      required: true,
    },
    {
      id: 'analytics',
      name: 'cookies',
      label: i18n.t('factory.checkbox.analyticsCookies', 'Analytics cookies'),
      value: 'analytics',
      description: i18n.t(
        'factory.checkbox.helpUsUnderstandHowVisitors',
        'Help us understand how visitors interact with our website'
      ),
      checked: false,
      disabled: false,
      required: false,
    },
    {
      id: 'marketing',
      name: 'cookies',
      label: i18n.t('factory.checkbox.marketingCookies', 'Marketing cookies'),
      value: 'marketing',
      description: i18n.t(
        'factory.checkbox.usedToDeliverPersonalizedAdvertisements',
        'Used to deliver personalized advertisements'
      ),
      checked: false,
      disabled: false,
      required: false,
    },
    {
      id: 'preferences',
      name: 'cookies',
      label: i18n.t('factory.checkbox.preferenceCookies', 'Preference cookies'),
      value: 'preferences',
      description: i18n.t(
        'factory.checkbox.rememberYourSettingsAndPreferences',
        'Remember your settings and preferences'
      ),
      checked: false,
      disabled: false,
      required: false,
    },
  ];
}

/**
 * Creates a "Select All" checkbox with children
 * @param count - Number of child items
 * @returns Select all structure
 */
export function createFakeSelectAllGroup(count: number = 5): {
  children: FakeCheckboxOption[];
  parent: { indeterminate: boolean } & FakeCheckboxOption;
} {
  const children = createFakeCheckboxOptions(count);
  const checkedCount = children.filter((c) => c.checked).length;
  const allChecked = checkedCount === count;
  const someChecked = checkedCount > 0 && checkedCount < count;

  return {
    parent: {
      id: 'select-all',
      name: 'select-all',
      label: i18n.t('factory.checkbox.selectAll', 'Select All'),
      value: 'all',
      checked: allChecked,
      indeterminate: someChecked,
      disabled: false,
      required: false,
    },
    children,
  };
}

// ============ MATRIX FACTORY ============

/**
 * Creates a matrix of checkbox states for visual testing
 * @returns Matrix of state × size × disabled combinations
 */
export function createFakeCheckboxMatrix(): Array<{
  disabled: boolean;
  size: CheckboxSize;
  state: CheckboxState;
}> {
  const matrix: Array<{
    disabled: boolean;
    size: CheckboxSize;
    state: CheckboxState;
  }> = [];

  for (const state of CHECKBOX_STATES) {
    for (const size of CHECKBOX_SIZES) {
      for (const disabled of [false, true]) {
        matrix.push({ state, size, disabled });
      }
    }
  }

  return matrix;
}

/**
 * Creates validation state examples
 * @returns All validation states with sample data
 */
export function createFakeCheckboxValidationMatrix(): FakeCheckboxWithValidation[] {
  return CHECKBOX_VALIDATION_STATES.map((validationState) =>
    createFakeCheckboxWithValidation({
      validationState,
      label: i18n.t(
        `factory.checkbox.validationState_${validationState}`,
        `${validationState.charAt(0).toUpperCase() + validationState.slice(1)} state`
      ),
    })
  );
}

/**
 * Creates showcase of all checkbox patterns
 * @returns Object with different checkbox use cases
 */
export function createFakeCheckboxShowcase(): {
  cookieConsent: FakeCheckboxOption[];
  filterList: FakeFilterCheckbox[];
  group: FakeCheckboxGroup;
  newsletter: ReturnType<typeof createFakeNewsletterForm>;
  preferences: Record<string, FakePreferenceCheckbox[]>;
  selectAll: ReturnType<typeof createFakeSelectAllGroup>;
  single: FakeCheckboxOption;
  terms: FakeTermsCheckbox;
  tree: FakeCheckboxTreeNode;
  validationMatrix: FakeCheckboxWithValidation[];
} {
  return {
    single: createFakeCheckboxOption(),
    group: createFakeCheckboxGroup(),
    terms: createFakeTermsCheckbox(),
    preferences: createFakePreferenceGroups(),
    filterList: createFakeFilterCheckboxes(8),
    tree: createFakeCheckboxTree(),
    newsletter: createFakeNewsletterForm(),
    cookieConsent: createFakeCookieConsent(),
    selectAll: createFakeSelectAllGroup(),
    validationMatrix: createFakeCheckboxValidationMatrix(),
  };
}

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE FEATURE FACTORIES
// ═══════════════════════════════════════════════════════════════

/** Interface for async checkbox with loading state */
export interface FakeAsyncCheckbox extends FakeCheckboxOption {
  /** Error message from async operation */
  asyncError?: string;
  /** Async operation status */
  asyncStatus: 'error' | 'idle' | 'loading' | 'success';
  /** Retry count for failed operations */
  retryCount?: number;
}

/**
 * Creates a checkbox for async validation scenarios
 * @param overrides - Optional overrides
 * @returns An async checkbox
 */
export function createFakeAsyncCheckbox(overrides?: Partial<FakeAsyncCheckbox>): FakeAsyncCheckbox {
  return {
    ...createFakeCheckboxOption(overrides),
    asyncStatus: faker.helpers.arrayElement(['idle', 'loading', 'success', 'error']),
    asyncError: faker.helpers.maybe(
      () =>
        i18n.t(
          'factory.checkbox.validationFailedPleaseTryAgain',
          'Validation failed. Please try again.'
        ),
      {
        probability: 0.2,
      }
    ),
    retryCount: faker.helpers.maybe(() => faker.number.int({ min: 0, max: 3 }), {
      probability: 0.3,
    }),
    ...overrides,
  };
}

/** Interface for tracked checkbox with analytics */
export interface FakeTrackedCheckbox extends FakeCheckboxOption {
  /** Analytics event name */
  eventName: string;
  /** Tracking ID for analytics */
  trackingId: string;
  /** Additional tracking metadata */
  trackingMeta?: Record<string, unknown>;
}

/**
 * Creates a checkbox with analytics tracking
 * @param overrides - Optional overrides
 * @returns A tracked checkbox
 */
export function createFakeTrackedCheckbox(
  overrides?: Partial<FakeTrackedCheckbox>
): FakeTrackedCheckbox {
  return {
    ...createFakeCheckboxOption(overrides),
    trackingId: `chk_${faker.string.alphanumeric(8)}`,
    eventName: faker.helpers.arrayElement([
      'checkbox_toggle',
      'preference_change',
      'consent_update',
      'filter_toggle',
    ]),
    trackingMeta: faker.helpers.maybe(
      () => ({
        source: faker.helpers.arrayElement(['form', 'settings', 'modal', 'sidebar']),
        category: faker.helpers.arrayElement(['user', 'system', 'marketing']),
        timestamp: Date.now(),
      }),
      { probability: 0.5 }
    ),
    ...overrides,
  };
}

/** Interface for checkbox with accessibility enhancements */
export interface FakeAccessibleCheckbox extends FakeCheckboxOption {
  /** Whether to announce state changes */
  announceChanges: boolean;
  /** Additional ARIA description */
  ariaDescription?: string;
  /** ARIA label override */
  ariaLabel?: string;
  /** Announcement for screen readers on change */
  changeAnnouncement?: string;
}

/**
 * Creates a checkbox with enhanced accessibility
 * @param overrides - Optional overrides
 * @returns An accessible checkbox
 */
export function createFakeAccessibleCheckbox(
  overrides?: Partial<FakeAccessibleCheckbox>
): FakeAccessibleCheckbox {
  const baseCheckbox = createFakeCheckboxOption(overrides);
  return {
    ...baseCheckbox,
    announceChanges: faker.datatype.boolean({ probability: 0.7 }),
    ariaLabel: faker.helpers.maybe(
      () =>
        i18n.t('factory.checkbox.toggleAriaLabel', 'Toggle {{label}}', {
          label: baseCheckbox.label,
        }),
      { probability: 0.3 }
    ),
    ariaDescription: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 }),
    changeAnnouncement: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.checkbox.settingUpdated', 'Setting updated'),
          i18n.t('factory.checkbox.preferenceSaved', 'Preference saved'),
          i18n.t('factory.checkbox.optionToggled', 'Option toggled'),
          i18n.t('factory.checkbox.selectionChanged', 'Selection changed'),
        ]),
      { probability: 0.5 }
    ),
    ...overrides,
  };
}

/**
 * Creates all enterprise checkbox types for testing
 * @returns Array of enterprise checkbox types
 */
export function createFakeEnterpriseCheckboxSet(): {
  accessible: FakeAccessibleCheckbox;
  async: FakeAsyncCheckbox;
  tracked: FakeTrackedCheckbox;
} {
  return {
    async: createFakeAsyncCheckbox({
      label: i18n.t(
        'factory.checkbox.acceptTermsAsyncValidation',
        'Accept terms (async validation)'
      ),
      asyncStatus: 'idle',
    }),
    tracked: createFakeTrackedCheckbox({
      label: i18n.t(
        'factory.checkbox.subscribeToNewsletterTracked',
        'Subscribe to newsletter (tracked)'
      ),
      eventName: 'newsletter_subscribe',
    }),
    accessible: createFakeAccessibleCheckbox({
      label: i18n.t(
        'factory.checkbox.enableNotificationsAccessible',
        'Enable notifications (accessible)'
      ),
      announceChanges: true,
      changeAnnouncement: i18n.t(
        'factory.checkbox.notificationSettingUpdated',
        'Notification setting updated'
      ),
    }),
  };
}
