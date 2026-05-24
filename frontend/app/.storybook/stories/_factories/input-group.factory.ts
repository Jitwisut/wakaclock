/**
 * @fileoverview Factory functions for generating fake InputGroup component data
 * @module input-group.factory
 * @description Provides comprehensive test data generation for InputGroup components
 * including search boxes, URL inputs, currency fields, command palettes, and more.
 *
 * @example
 * ```typescript
 * import { createFakeInputGroup, createFakeSearchInputGroup } from './_factories/input-group.factory';
 *
 * // Create a random input group
 * const inputGroup = createFakeInputGroup();
 *
 * // Create a search-specific input group
 * const searchGroup = createFakeSearchInputGroup();
 * ```
 */

import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// SHARED STRING CONSTANTS
// ============================================================================

const LABEL_CTRL = i18n.t('factory.inputGroup.ctrl', 'Ctrl');
const LABEL_CLEAR = i18n.t('factory.inputGroup.clear', 'Clear');
const LABEL_PASSWORD = i18n.t('factory.inputGroup.password', 'Password');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Alignment options for InputGroupAddon
 * @description Controls the position of addon elements relative to the input
 */
export type InputGroupAddonAlign = 'block-end' | 'block-start' | 'inline-end' | 'inline-start';

/**
 * Size options for InputGroupButton
 * @description Controls the size of buttons within input group addons
 */
export type InputGroupButtonSize = 'icon-lg' | 'icon-sm' | 'icon-xs' | 'icon' | 'sm';

/**
 * Layout options for InputGroup
 * @description Controls the overall layout direction of the input group
 */
export type InputGroupLayout = 'horizontal' | 'vertical';

/**
 * State options for InputGroup
 * @description Represents the current state of the input group
 */
export type InputGroupState = 'default' | 'disabled' | 'error' | 'focused' | 'loading' | 'success';

/**
 * Width options for InputGroup
 * @description Controls the width behavior of the input group
 */
export type InputGroupWidth = 'auto' | 'fixed' | 'full';

/**
 * Input type options for InputGroupInput
 * @description HTML input types supported by InputGroupInput
 */
export type InputGroupInputType =
  | 'email'
  | 'number'
  | 'password'
  | 'search'
  | 'tel'
  | 'text'
  | 'url';

/**
 * Addon content type
 * @description Types of content that can be placed in an addon
 */
export type InputGroupAddonContentType = 'button' | 'icon' | 'kbd' | 'loading' | 'select' | 'text';

/**
 * Icon name type for common icons used in input groups
 */
export type InputGroupIconName =
  | 'Check'
  | 'ChevronDown'
  | 'Copy'
  | 'Eye'
  | 'EyeOff'
  | 'Globe'
  | 'Mail'
  | 'Phone'
  | 'Search'
  | 'X';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Alignment constant for inline-start position */
const ALIGN_INLINE_START: InputGroupAddonAlign = 'inline-start';

/** Alignment constant for inline-end position */
const ALIGN_INLINE_END: InputGroupAddonAlign = 'inline-end';

/** All available addon alignment options */
export const INPUT_GROUP_ADDON_ALIGNS: InputGroupAddonAlign[] = [
  ALIGN_INLINE_START,
  ALIGN_INLINE_END,
  'block-start',
  'block-end',
];

/** All available button sizes */
export const INPUT_GROUP_BUTTON_SIZES: InputGroupButtonSize[] = [
  'icon-xs',
  'icon-sm',
  'icon',
  'icon-lg',
  'sm',
];

/** All available layout options */
export const INPUT_GROUP_LAYOUTS: InputGroupLayout[] = ['horizontal', 'vertical'];

/** All available state options */
export const INPUT_GROUP_STATES: InputGroupState[] = [
  'default',
  'focused',
  'disabled',
  'error',
  'success',
  'loading',
];

/** All available width options */
export const INPUT_GROUP_WIDTHS: InputGroupWidth[] = ['auto', 'fixed', 'full'];

/** All available input types */
export const INPUT_GROUP_INPUT_TYPES: InputGroupInputType[] = [
  'text',
  'email',
  'password',
  'search',
  'tel',
  'url',
  'number',
];

/** All available addon content types */
export const INPUT_GROUP_ADDON_CONTENT_TYPES: InputGroupAddonContentType[] = [
  'icon',
  'text',
  'button',
  'kbd',
  'select',
  'loading',
];

/** Common icon names used in input groups */
export const INPUT_GROUP_ICONS: InputGroupIconName[] = [
  'Search',
  'X',
  'Mail',
  'Phone',
  'Globe',
  'Eye',
  'EyeOff',
  'Check',
  'Copy',
  'ChevronDown',
];

/** Common prefix texts */
export const INPUT_GROUP_PREFIX_TEXTS = [
  'https://',
  'http://',
  'www.',
  '@',
  '#',
  '$',
  '€',
  '£',
  '¥',
  '+1',
  '+44',
  '+81',
];

/** Common suffix texts */
export const INPUT_GROUP_SUFFIX_TEXTS = [
  '.com',
  '.org',
  '.net',
  '.io',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'kg',
  'lbs',
  '%',
  'px',
];

/** Common placeholder texts */
const PLACEHOLDER_SEARCH = i18n.t('factory.inputGroup.search2', 'Search...');
const PLACEHOLDER_EMAIL = i18n.t('factory.inputGroup.enterEmail', 'Enter email');
const PLACEHOLDER_PHONE = i18n.t('factory.inputGroup.enterPhoneNumber', 'Enter phone number');
const PLACEHOLDER_URL = 'example.com';
const PLACEHOLDER_AMOUNT = '0.00';
const PLACEHOLDER_COMMAND = i18n.t('factory.inputGroup.typeACommand', 'Type a command...');

export const INPUT_GROUP_PLACEHOLDERS = [
  PLACEHOLDER_SEARCH,
  PLACEHOLDER_EMAIL,
  PLACEHOLDER_PHONE,
  PLACEHOLDER_URL,
  PLACEHOLDER_AMOUNT,
  PLACEHOLDER_COMMAND,
  i18n.t('factory.inputGroup.enterText', 'Enter text...'),
  i18n.t('factory.inputGroup.typeHere', 'Type here...'),
];

/** Common aria-label values */
const ARIA_LABEL_SEARCH = i18n.t('factory.inputGroup.search', 'Search');
const ARIA_LABEL_EMAIL = i18n.t('factory.inputGroup.email', 'Email');
const ARIA_LABEL_PHONE = i18n.t('factory.inputGroup.phoneNumber', 'Phone number');
const ARIA_LABEL_URL = i18n.t('factory.inputGroup.websiteUrl', 'Website URL');
const ARIA_LABEL_AMOUNT = i18n.t('factory.inputGroup.amount', 'Amount');
const ARIA_LABEL_COMMAND = i18n.t('factory.inputGroup.command', 'Command');

export const INPUT_GROUP_ARIA_LABELS = [
  ARIA_LABEL_SEARCH,
  ARIA_LABEL_EMAIL,
  ARIA_LABEL_PHONE,
  ARIA_LABEL_URL,
  ARIA_LABEL_AMOUNT,
  ARIA_LABEL_COMMAND,
  i18n.t('factory.inputGroup.username', 'Username'),
  LABEL_PASSWORD,
];

/** Common keyboard shortcuts */
export const INPUT_GROUP_SHORTCUTS = [
  ['⌘', 'K'],
  ['⌘', 'P'],
  ['⌘', 'F'],
  ['⌘', 'S'],
  [LABEL_CTRL, 'K'],
  [LABEL_CTRL, 'P'],
  [LABEL_CTRL, 'F'],
  [LABEL_CTRL, 'S'],
  ['/', ''],
  ['Esc', ''],
];

/** Currency options for select addons */
export const INPUT_GROUP_CURRENCIES = [
  { label: 'USD', value: 'USD' },
  { label: 'EUR', value: 'EUR' },
  { label: 'GBP', value: 'GBP' },
  { label: 'JPY', value: 'JPY' },
  { label: 'CAD', value: 'CAD' },
  { label: 'AUD', value: 'AUD' },
];

/** Country code options for phone inputs */
export const INPUT_GROUP_COUNTRY_CODES = [
  { code: '+1', country: 'US' },
  { code: '+44', country: 'UK' },
  { code: '+81', country: 'JP' },
  { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' },
  { code: '+86', country: 'CN' },
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Represents a fake InputGroup addon element
 */
export interface FakeInputGroupAddon {
  /** Alignment position of the addon */
  align: InputGroupAddonAlign;
  /** Button aria-label for icon buttons */
  buttonAriaLabel?: string;
  /** Button label if contentType is 'button' */
  buttonLabel?: string;
  /** Button size if contentType is 'button' */
  buttonSize?: InputGroupButtonSize;
  /** Additional CSS classes */
  className?: string;
  /** Type of content in the addon */
  contentType: InputGroupAddonContentType;
  /** Icon name if contentType is 'icon' */
  iconName?: InputGroupIconName;
  /** Unique identifier */
  id: string;
  /** Whether the addon is interactive */
  interactive: boolean;
  /** Selected value if contentType is 'select' */
  selectedValue?: string;
  /** Select options if contentType is 'select' */
  selectOptions?: Array<{ label: string; value: string }>;
  /** Keyboard shortcuts if contentType is 'kbd' */
  shortcuts?: string[];
  /** Text content if contentType is 'text' */
  text?: string;
}

/**
 * Represents a fake InputGroup input element
 */
export interface FakeInputGroupInput {
  /** Whether input has invalid value */
  ariaInvalid: boolean;
  /** Aria label for accessibility */
  ariaLabel: string;
  /** Autocomplete attribute */
  autocomplete?: string;
  /** Additional CSS classes */
  className?: string;
  /** Default value */
  defaultValue?: string;
  /** Whether input is disabled */
  disabled: boolean;
  /** Unique identifier */
  id: string;
  /** Maximum value for number inputs */
  max?: number;
  /** Maximum length */
  maxLength?: number;
  /** Minimum value for number inputs */
  min?: number;
  /** Minimum length */
  minLength?: number;
  /** Pattern for validation */
  pattern?: string;
  /** Placeholder text */
  placeholder: string;
  /** Whether input is required */
  required: boolean;
  /** Step value for number inputs */
  step?: number;
  /** Input type */
  type: InputGroupInputType;
}

/**
 * Represents a fake InputGroup textarea element
 */
export interface FakeInputGroupTextarea {
  /** Whether textarea has invalid value */
  ariaInvalid: boolean;
  /** Aria label for accessibility */
  ariaLabel: string;
  /** Additional CSS classes */
  className?: string;
  /** Default value */
  defaultValue?: string;
  /** Whether textarea is disabled */
  disabled: boolean;
  /** Unique identifier */
  id: string;
  /** Maximum length */
  maxLength?: number;
  /** Minimum length */
  minLength?: number;
  /** Placeholder text */
  placeholder: string;
  /** Resize behavior */
  resize?: 'both' | 'horizontal' | 'none' | 'vertical';
  /** Number of rows */
  rows?: number;
}

/**
 * Represents a complete fake InputGroup configuration
 */
export interface FakeInputGroup {
  /** Additional CSS classes for the container */
  className?: string;
  /** Description of the input group purpose */
  description?: string;
  /** Whether the group uses block addons */
  hasBlockAddons: boolean;
  /** Whether the input group has focus */
  hasFocus: boolean;
  /** Unique identifier */
  id: string;
  /** The main input element */
  input?: FakeInputGroupInput;
  /** Layout direction */
  layout: InputGroupLayout;
  /** Display name for the input group */
  name: string;
  /** Prefix addon (inline-start or block-start) */
  prefixAddon?: FakeInputGroupAddon;
  /** Current state of the input group */
  state: InputGroupState;
  /** Suffix addon (inline-end or block-end) */
  suffixAddon?: FakeInputGroupAddon;
  /** Test ID for automation */
  testId?: string;
  /** The textarea element (alternative to input) */
  textarea?: FakeInputGroupTextarea;
  /** Width behavior */
  width: InputGroupWidth;
}

/**
 * Represents a search input group configuration
 */
export interface FakeSearchInputGroup extends FakeInputGroup {
  /** Keyboard shortcut to activate search */
  activationShortcut?: string[];
  /** Whether search is in progress */
  isSearching: boolean;
  /** Search query value */
  query: string;
  /** Whether to show clear button */
  showClearButton: boolean;
}

/**
 * Represents a URL input group configuration
 */
export interface FakeUrlInputGroup extends FakeInputGroup {
  /** Domain value */
  domain: string;
  /** Whether URL is valid */
  isValid: boolean;
  /** Protocol prefix (https://, http://, etc.) */
  protocol: string;
  /** TLD suffix (.com, .org, etc.) */
  tld?: string;
}

/**
 * Represents a currency input group configuration
 */
export interface FakeCurrencyInputGroup extends FakeInputGroup {
  /** Amount value */
  amount: number;
  /** Available currencies */
  availableCurrencies: Array<{ label: string; value: string }>;
  /** Currency code (USD, EUR, etc.) */
  currency: string;
  /** Number of decimal places */
  decimals: number;
  /** Whether to show currency selector */
  showCurrencySelector: boolean;
}

/**
 * Represents a phone input group configuration
 */
export interface FakePhoneInputGroup extends FakeInputGroup {
  /** Available country codes */
  availableCountryCodes: Array<{ code: string; country: string }>;
  /** Country code (+1, +44, etc.) */
  countryCode: string;
  /** Phone number */
  phoneNumber: string;
  /** Whether to show country selector */
  showCountrySelector: boolean;
}

/**
 * Represents a command palette input group configuration
 */
export interface FakeCommandInputGroup extends FakeInputGroup {
  /** Command text */
  command: string;
  /** Whether in command mode */
  isCommandMode: boolean;
  /** Command prefix ($, >, etc.) */
  prefix: string;
  /** Keyboard shortcut hint */
  shortcutHint: string[];
}

/**
 * Represents an email input group configuration
 */
export interface FakeEmailInputGroup extends FakeInputGroup {
  /** Email address */
  email: string;
  /** Whether email is verified */
  isVerified: boolean;
  /** Whether to show verify button */
  showVerifyButton: boolean;
}

/**
 * Represents a password input group configuration
 */
export interface FakePasswordInputGroup extends FakeInputGroup {
  /** Whether password is visible */
  isVisible: boolean;
  /** Password value (for testing only) */
  password: string;
  /** Whether to show strength indicator */
  showStrengthIndicator: boolean;
  /** Password strength (0-100) */
  strength: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets the appropriate suffix addon for email input group
 * @param isVerified - Whether email is verified
 * @param showVerifyButton - Whether to show verify button
 * @returns The suffix addon configuration or undefined
 */
function getEmailSuffixAddon(
  isVerified: boolean,
  showVerifyButton: boolean | undefined
): FakeInputGroupAddon | undefined {
  if (isVerified) {
    return createFakeAddon(ALIGN_INLINE_END, 'icon', { iconName: 'Check' });
  }
  if (showVerifyButton) {
    return createFakeAddon(ALIGN_INLINE_END, 'button', {
      buttonLabel: i18n.t('factory.inputGroup.verify', 'Verify'),
      buttonSize: 'sm',
    });
  }
  return undefined;
}

/**
 * Gets the appropriate suffix addon for state matrix
 * @param state - The current input group state
 * @returns The suffix addon configuration
 */
function getStateSuffixAddon(state: InputGroupState): FakeInputGroupAddon {
  if (state === 'success') {
    return createFakeAddon(ALIGN_INLINE_END, 'icon', { iconName: 'Check' });
  }
  if (state === 'error') {
    return createFakeAddon(ALIGN_INLINE_END, 'icon', { iconName: 'X' });
  }
  return createFakeAddon(ALIGN_INLINE_END, 'button', {
    iconName: 'X',
    buttonAriaLabel: LABEL_CLEAR,
    buttonSize: 'icon-xs',
  });
}

/**
 * Gets the appropriate icon name for input type
 * @param inputType - The input type
 * @returns The icon name to use
 */
function getInputTypeIconName(inputType: InputGroupInputType): InputGroupIconName {
  if (inputType === 'search') {
    return 'Search';
  }
  if (inputType === 'email') {
    return 'Mail';
  }
  return 'Globe';
}

/**
 * Creates a fake addon configuration
 */
function createFakeAddon(
  align: InputGroupAddonAlign,
  contentType: InputGroupAddonContentType,
  overrides?: Partial<FakeInputGroupAddon>
): FakeInputGroupAddon {
  const base: FakeInputGroupAddon = {
    id: faker.string.uuid(),
    align,
    contentType,
    interactive: contentType === 'button' || contentType === 'select',
    className: faker.helpers.maybe(() => 'custom-addon-class', { probability: 0.1 }),
  };

  switch (contentType) {
    case 'icon': {
      base.iconName = faker.helpers.arrayElement(INPUT_GROUP_ICONS);
      break;
    }
    case 'text': {
      base.text = faker.helpers.arrayElement([
        ...INPUT_GROUP_PREFIX_TEXTS,
        ...INPUT_GROUP_SUFFIX_TEXTS,
      ]);
      break;
    }
    case 'button': {
      const isIconButton = faker.datatype.boolean();
      base.buttonSize = faker.helpers.arrayElement(INPUT_GROUP_BUTTON_SIZES);
      if (isIconButton) {
        base.iconName = faker.helpers.arrayElement(INPUT_GROUP_ICONS);
        base.buttonAriaLabel = faker.helpers.arrayElement([
          LABEL_CLEAR,
          i18n.t('factory.inputGroup.search', 'Search'),
          i18n.t('factory.inputGroup.submit', 'Submit'),
          i18n.t('factory.inputGroup.toggleVisibility', 'Toggle visibility'),
        ]);
      } else {
        base.buttonLabel = faker.helpers.arrayElement([
          i18n.t('factory.inputGroup.go', 'Go'),
          i18n.t('factory.inputGroup.submit', 'Submit'),
          i18n.t('factory.inputGroup.search', 'Search'),
          i18n.t('factory.inputGroup.send', 'Send'),
        ]);
      }
      break;
    }
    case 'kbd': {
      base.shortcuts = faker.helpers.arrayElement(INPUT_GROUP_SHORTCUTS);
      break;
    }
    case 'select': {
      base.selectOptions = INPUT_GROUP_CURRENCIES;
      base.selectedValue = faker.helpers.arrayElement(INPUT_GROUP_CURRENCIES).value;
      break;
    }
    case 'loading': {
      // Loading spinner, no additional config needed
      break;
    }
    default: {
      // All content types handled above
      break;
    }
  }

  return { ...base, ...overrides };
}

/**
 * Creates a fake input configuration
 */
function createFakeInput(
  type: InputGroupInputType,
  overrides?: Partial<FakeInputGroupInput>
): FakeInputGroupInput {
  const placeholderMap: Record<InputGroupInputType, string> = {
    text: i18n.t('factory.inputGroup.enterText', 'Enter text...'),
    email: PLACEHOLDER_EMAIL,
    password: i18n.t('factory.inputGroup.enterPassword', 'Enter password'),
    search: PLACEHOLDER_SEARCH,
    tel: PLACEHOLDER_PHONE,
    url: PLACEHOLDER_URL,
    number: PLACEHOLDER_AMOUNT,
  };

  const ariaLabelMap: Record<InputGroupInputType, string> = {
    text: i18n.t('factory.inputGroup.textInput', 'Text input'),
    email: ARIA_LABEL_EMAIL,
    password: LABEL_PASSWORD,
    search: ARIA_LABEL_SEARCH,
    tel: ARIA_LABEL_PHONE,
    url: ARIA_LABEL_URL,
    number: ARIA_LABEL_AMOUNT,
  };

  return {
    id: faker.string.uuid(),
    type,
    placeholder: placeholderMap[type],
    ariaLabel: ariaLabelMap[type],
    defaultValue: faker.helpers.maybe(() => faker.lorem.words(2), { probability: 0.3 }),
    disabled: faker.helpers.maybe(() => true, { probability: 0.1 }) ?? false,
    ariaInvalid: faker.helpers.maybe(() => true, { probability: 0.1 }) ?? false,
    required: faker.helpers.maybe(() => true, { probability: 0.3 }) ?? false,
    className: faker.helpers.maybe(() => 'custom-input-class', { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a fake textarea configuration
 */
function createFakeTextarea(overrides?: Partial<FakeInputGroupTextarea>): FakeInputGroupTextarea {
  return {
    id: faker.string.uuid(),
    placeholder: faker.helpers.arrayElement([
      i18n.t('factory.inputGroup.enterDescription', 'Enter description...'),
      i18n.t('factory.inputGroup.typeYourMessage', 'Type your message...'),
      i18n.t('factory.inputGroup.addNotes', 'Add notes...'),
      i18n.t('factory.inputGroup.writeComment', 'Write comment...'),
    ]),
    ariaLabel: faker.helpers.arrayElement([
      i18n.t('factory.inputGroup.description', 'Description'),
      i18n.t('factory.inputGroup.message', 'Message'),
      i18n.t('factory.inputGroup.notes', 'Notes'),
      i18n.t('factory.inputGroup.comment', 'Comment'),
    ]),
    defaultValue: faker.helpers.maybe(() => faker.lorem.paragraph(), { probability: 0.3 }),
    disabled: faker.helpers.maybe(() => true, { probability: 0.1 }) ?? false,
    ariaInvalid: faker.helpers.maybe(() => true, { probability: 0.1 }) ?? false,
    rows: faker.helpers.arrayElement([3, 4, 5, 6]),
    resize: faker.helpers.arrayElement(['none', 'vertical', 'horizontal', 'both']),
    className: faker.helpers.maybe(() => 'custom-textarea-class', { probability: 0.1 }),
    ...overrides,
  };
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a single fake InputGroup configuration
 * @param overrides - Optional partial object to override default values
 * @returns A fake InputGroup configuration
 */
export function createFakeInputGroup(overrides?: Partial<FakeInputGroup>): FakeInputGroup {
  const useTextarea = faker.helpers.maybe(() => true, { probability: 0.2 }) ?? false;
  const hasPrefix = faker.helpers.maybe(() => true, { probability: 0.6 }) ?? false;
  const hasSuffix = faker.helpers.maybe(() => true, { probability: 0.6 }) ?? false;
  const hasBlockAddons = faker.helpers.maybe(() => true, { probability: 0.2 }) ?? false;

  const inputType = faker.helpers.arrayElement(INPUT_GROUP_INPUT_TYPES);
  const prefixAlign: InputGroupAddonAlign = hasBlockAddons ? 'block-start' : ALIGN_INLINE_START;
  const suffixAlign: InputGroupAddonAlign = hasBlockAddons ? 'block-end' : ALIGN_INLINE_END;

  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement([
      i18n.t('factory.inputGroup.searchInput', 'Search Input'),
      i18n.t('factory.inputGroup.urlInput', 'URL Input'),
      i18n.t('factory.inputGroup.emailInput', 'Email Input'),
      i18n.t('factory.inputGroup.currencyInput', 'Currency Input'),
      i18n.t('factory.inputGroup.phoneInput', 'Phone Input'),
      i18n.t('factory.inputGroup.commandInput', 'Command Input'),
    ]),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    state: faker.helpers.arrayElement(INPUT_GROUP_STATES),
    layout: hasBlockAddons ? 'vertical' : 'horizontal',
    width: faker.helpers.arrayElement(INPUT_GROUP_WIDTHS),
    input: useTextarea ? undefined : createFakeInput(inputType),
    textarea: useTextarea ? createFakeTextarea() : undefined,
    prefixAddon: hasPrefix
      ? createFakeAddon(prefixAlign, faker.helpers.arrayElement(INPUT_GROUP_ADDON_CONTENT_TYPES))
      : undefined,
    suffixAddon: hasSuffix
      ? createFakeAddon(suffixAlign, faker.helpers.arrayElement(INPUT_GROUP_ADDON_CONTENT_TYPES))
      : undefined,
    hasFocus: faker.helpers.maybe(() => true, { probability: 0.2 }) ?? false,
    hasBlockAddons,
    className: faker.helpers.maybe(() => 'custom-group-class', { probability: 0.1 }),
    testId: `input-group-${faker.string.alphanumeric(8)}`,
    ...overrides,
  };
}

/**
 * Creates multiple fake InputGroup configurations
 * @param count - Number of configurations to create
 * @returns Array of fake InputGroup configurations
 */
export function createFakeInputGroups(count: number): FakeInputGroup[] {
  return Array.from({ length: count }, () => createFakeInputGroup());
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a search input group configuration
 * @param overrides - Optional partial object to override default values
 * @returns A search-specific InputGroup configuration
 */
export function createFakeSearchInputGroup(
  overrides?: Partial<FakeSearchInputGroup>
): FakeSearchInputGroup {
  const isSearching = faker.helpers.maybe(() => true, { probability: 0.3 }) ?? false;
  const hasQuery = faker.helpers.maybe(() => true, { probability: 0.5 }) ?? false;

  return {
    ...createFakeInputGroup({
      name: i18n.t('factory.inputGroup.searchInput', 'Search Input'),
      state: isSearching ? 'loading' : 'default',
      input: createFakeInput('search', {
        placeholder: PLACEHOLDER_SEARCH,
        ariaLabel: ARIA_LABEL_SEARCH,
        defaultValue: hasQuery ? faker.lorem.words(2) : undefined,
      }),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, 'icon', { iconName: 'Search' }),
      suffixAddon: isSearching
        ? createFakeAddon(ALIGN_INLINE_END, 'loading')
        : createFakeAddon(ALIGN_INLINE_END, 'button', {
            iconName: 'X',
            buttonAriaLabel: i18n.t('factory.inputGroup.clearSearch', 'Clear search'),
            buttonSize: 'icon-xs',
          }),
    }),
    query: hasQuery ? faker.lorem.words(2) : '',
    isSearching,
    showClearButton: hasQuery && !isSearching,
    activationShortcut: faker.helpers.maybe(
      () => faker.helpers.arrayElement(INPUT_GROUP_SHORTCUTS),
      { probability: 0.5 }
    ),
    ...overrides,
  };
}

/**
 * Creates a URL input group configuration
 * @param overrides - Optional partial object to override default values
 * @returns A URL-specific InputGroup configuration
 */
export function createFakeUrlInputGroup(overrides?: Partial<FakeUrlInputGroup>): FakeUrlInputGroup {
  const domain = faker.internet.domainWord();
  const tld = faker.helpers.arrayElement(['.com', '.org', '.net', '.io', '.dev']);
  const protocol = faker.helpers.arrayElement(['https://', 'http://']);
  const isValid = faker.helpers.maybe(() => true, { probability: 0.8 }) ?? false;

  return {
    ...createFakeInputGroup({
      name: i18n.t('factory.inputGroup.urlInput', 'URL Input'),
      state: isValid ? 'default' : 'error',
      input: createFakeInput('url', {
        placeholder: PLACEHOLDER_URL,
        ariaLabel: ARIA_LABEL_URL,
        defaultValue: domain,
        ariaInvalid: !isValid,
      }),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, 'text', { text: protocol }),
      suffixAddon: faker.helpers.maybe(
        () => createFakeAddon(ALIGN_INLINE_END, 'text', { text: tld }),
        { probability: 0.5 }
      ),
    }),
    protocol,
    domain,
    tld,
    isValid,
    ...overrides,
  };
}

/**
 * Creates a currency input group configuration
 * @param overrides - Optional partial object to override default values
 * @returns A currency-specific InputGroup configuration
 */
export function createFakeCurrencyInputGroup(
  overrides?: Partial<FakeCurrencyInputGroup>
): FakeCurrencyInputGroup {
  const currency = faker.helpers.arrayElement(INPUT_GROUP_CURRENCIES);
  const amount = faker.number.float({ min: 0, max: 10_000, fractionDigits: 2 });
  const showSelector = faker.helpers.maybe(() => true, { probability: 0.6 }) ?? false;

  return {
    ...createFakeInputGroup({
      name: i18n.t('factory.inputGroup.currencyInput', 'Currency Input'),
      input: createFakeInput('number', {
        placeholder: PLACEHOLDER_AMOUNT,
        ariaLabel: ARIA_LABEL_AMOUNT,
        defaultValue: amount.toFixed(2),
        min: 0,
        step: 0.01,
      }),
      prefixAddon: showSelector
        ? createFakeAddon(ALIGN_INLINE_START, 'select', {
            selectOptions: INPUT_GROUP_CURRENCIES,
            selectedValue: currency.value,
          })
        : createFakeAddon(ALIGN_INLINE_START, 'text', { text: '$' }),
      suffixAddon: createFakeAddon(ALIGN_INLINE_END, 'text', { text: currency.value }),
    }),
    currency: currency.value,
    amount,
    decimals: 2,
    showCurrencySelector: showSelector,
    availableCurrencies: INPUT_GROUP_CURRENCIES,
    ...overrides,
  };
}

/**
 * Creates a phone input group configuration
 * @param overrides - Optional partial object to override default values
 * @returns A phone-specific InputGroup configuration
 */
export function createFakePhoneInputGroup(
  overrides?: Partial<FakePhoneInputGroup>
): FakePhoneInputGroup {
  const countryCode = faker.helpers.arrayElement(INPUT_GROUP_COUNTRY_CODES);
  const phoneNumber = faker.phone.number();
  const showSelector = faker.helpers.maybe(() => true, { probability: 0.6 }) ?? false;

  return {
    ...createFakeInputGroup({
      name: i18n.t('factory.inputGroup.phoneInput', 'Phone Input'),
      input: createFakeInput('tel', {
        placeholder: PLACEHOLDER_PHONE,
        ariaLabel: ARIA_LABEL_PHONE,
        defaultValue: phoneNumber,
        pattern: '[0-9]{3}-[0-9]{3}-[0-9]{4}',
      }),
      prefixAddon: showSelector
        ? createFakeAddon(ALIGN_INLINE_START, 'select', {
            selectOptions: INPUT_GROUP_COUNTRY_CODES.map((c) => ({
              label: i18n.t('factory.inputGroup.countryCodeLabel', '{{country}} ({{code}})', {
                country: c.country,
                code: c.code,
              }),
              value: c.code,
            })),
            selectedValue: countryCode.code,
          })
        : createFakeAddon(ALIGN_INLINE_START, 'text', { text: countryCode.code }),
      suffixAddon: createFakeAddon(ALIGN_INLINE_END, 'icon', { iconName: 'Phone' }),
    }),
    countryCode: countryCode.code,
    phoneNumber,
    showCountrySelector: showSelector,
    availableCountryCodes: INPUT_GROUP_COUNTRY_CODES,
    ...overrides,
  };
}

/**
 * Creates a command palette input group configuration
 * @param overrides - Optional partial object to override default values
 * @returns A command-specific InputGroup configuration
 */
export function createFakeCommandInputGroup(
  overrides?: Partial<FakeCommandInputGroup>
): FakeCommandInputGroup {
  const prefix = faker.helpers.arrayElement(['$', '>', '/', ':']);
  const command = faker.helpers.maybe(() => faker.hacker.verb(), { probability: 0.5 }) ?? '';
  const shortcut = faker.helpers.arrayElement(INPUT_GROUP_SHORTCUTS);
  const isCommandMode = faker.helpers.maybe(() => true, { probability: 0.3 }) ?? false;

  return {
    ...createFakeInputGroup({
      name: i18n.t('factory.inputGroup.commandInput', 'Command Input'),
      state: isCommandMode ? 'focused' : 'default',
      input: createFakeInput('text', {
        placeholder: PLACEHOLDER_COMMAND,
        ariaLabel: ARIA_LABEL_COMMAND,
        defaultValue: command,
      }),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, 'text', { text: prefix }),
      suffixAddon: createFakeAddon(ALIGN_INLINE_END, 'kbd', { shortcuts: shortcut }),
    }),
    command,
    prefix,
    shortcutHint: shortcut,
    isCommandMode,
    ...overrides,
  };
}

/**
 * Creates an email input group configuration
 * @param overrides - Optional partial object to override default values
 * @returns An email-specific InputGroup configuration
 */
export function createFakeEmailInputGroup(
  overrides?: Partial<FakeEmailInputGroup>
): FakeEmailInputGroup {
  const email = faker.internet.email();
  const isVerified = faker.helpers.maybe(() => true, { probability: 0.5 }) ?? false;
  const showVerifyButton = !isVerified && faker.helpers.maybe(() => true, { probability: 0.7 });

  return {
    ...createFakeInputGroup({
      name: i18n.t('factory.inputGroup.emailInput', 'Email Input'),
      state: isVerified ? 'success' : 'default',
      input: createFakeInput('email', {
        placeholder: PLACEHOLDER_EMAIL,
        ariaLabel: ARIA_LABEL_EMAIL,
        defaultValue: email,
        autocomplete: 'email',
      }),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, 'icon', { iconName: 'Mail' }),
      suffixAddon: getEmailSuffixAddon(isVerified, showVerifyButton),
    }),
    email,
    isVerified,
    showVerifyButton: showVerifyButton ?? false,
    ...overrides,
  };
}

/**
 * Creates a password input group configuration
 * @param overrides - Optional partial object to override default values
 * @returns A password-specific InputGroup configuration
 */
export function createFakePasswordInputGroup(
  overrides?: Partial<FakePasswordInputGroup>
): FakePasswordInputGroup {
  const password = faker.internet.password({ length: 12, memorable: false });
  const isVisible = faker.helpers.maybe(() => true, { probability: 0.3 }) ?? false;
  const strength = faker.number.int({ min: 0, max: 100 });
  const showStrengthIndicator = faker.helpers.maybe(() => true, { probability: 0.5 }) ?? false;

  return {
    ...createFakeInputGroup({
      name: i18n.t('factory.inputGroup.passwordInput', 'Password Input'),
      input: createFakeInput('password', {
        placeholder: i18n.t('factory.inputGroup.enterPassword', 'Enter password'),
        ariaLabel: LABEL_PASSWORD,
        defaultValue: password,
        autocomplete: 'current-password',
        type: isVisible ? 'text' : 'password',
      }),
      suffixAddon: createFakeAddon(ALIGN_INLINE_END, 'button', {
        iconName: isVisible ? 'EyeOff' : 'Eye',
        buttonAriaLabel: isVisible
          ? i18n.t('factory.inputGroup.hidePassword', 'Hide password')
          : i18n.t('factory.inputGroup.showPassword', 'Show password'),
        buttonSize: 'icon-xs',
      }),
    }),
    password,
    isVisible,
    strength,
    showStrengthIndicator,
    ...overrides,
  };
}

/**
 * Creates a textarea input group configuration (for description/notes)
 * @param overrides - Optional partial object to override default values
 * @returns A textarea InputGroup configuration
 */
export function createFakeTextareaInputGroup(overrides?: Partial<FakeInputGroup>): FakeInputGroup {
  return createFakeInputGroup({
    name: i18n.t('factory.inputGroup.textareaInput', 'Textarea Input'),
    layout: 'vertical',
    hasBlockAddons: true,
    textarea: createFakeTextarea({
      placeholder: i18n.t('factory.inputGroup.enterDescription', 'Enter description...'),
      ariaLabel: i18n.t('factory.inputGroup.description', 'Description'),
      rows: 4,
    }),
    prefixAddon: createFakeAddon('block-start', 'text', {
      text: i18n.t('factory.inputGroup.description', 'Description'),
    }),
    suffixAddon: undefined,
    ...overrides,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of input groups by alignment combinations
 * @returns Matrix of InputGroup configurations for alignment testing
 */
export function createFakeInputGroupAlignmentMatrix(): FakeInputGroup[][] {
  return INPUT_GROUP_ADDON_ALIGNS.map((prefixAlign) =>
    INPUT_GROUP_ADDON_ALIGNS.filter(
      (suffixAlign) =>
        // Only allow valid combinations (inline + inline or block + block)
        (prefixAlign.startsWith('inline') && suffixAlign.startsWith('inline')) ||
        (prefixAlign.startsWith('block') && suffixAlign.startsWith('block'))
    ).map((suffixAlign) =>
      createFakeInputGroup({
        name: i18n.t('factory.inputGroup.alignmentCombination', '{{prefix}} + {{suffix}}', {
          prefix: prefixAlign,
          suffix: suffixAlign,
        }),
        prefixAddon: createFakeAddon(prefixAlign, 'icon', { iconName: 'Search' }),
        suffixAddon: createFakeAddon(suffixAlign, 'button', {
          iconName: 'X',
          buttonAriaLabel: LABEL_CLEAR,
          buttonSize: 'icon-xs',
        }),
        hasBlockAddons: prefixAlign.startsWith('block'),
        layout: prefixAlign.startsWith('block') ? 'vertical' : 'horizontal',
      })
    )
  );
}

/**
 * Creates a matrix of input groups by button sizes
 * @returns Matrix of InputGroup configurations for button size testing
 */
export function createFakeInputGroupButtonSizeMatrix(): FakeInputGroup[] {
  return INPUT_GROUP_BUTTON_SIZES.map((size) =>
    createFakeInputGroup({
      name: i18n.t('factory.inputGroup.buttonSizeName', 'Button Size: {{size}}', { size }),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, 'icon', { iconName: 'Search' }),
      suffixAddon: createFakeAddon(ALIGN_INLINE_END, 'button', {
        iconName: 'X',
        buttonAriaLabel: LABEL_CLEAR,
        buttonSize: size,
      }),
    })
  );
}

/**
 * Creates a matrix of input groups by state
 * @returns Matrix of InputGroup configurations for state testing
 */
export function createFakeInputGroupStateMatrix(): FakeInputGroup[] {
  return INPUT_GROUP_STATES.map((state) =>
    createFakeInputGroup({
      name: i18n.t('factory.inputGroup.stateName', 'State: {{state}}', { state }),
      state,
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, state === 'loading' ? 'loading' : 'icon', {
        iconName: 'Search',
      }),
      suffixAddon: getStateSuffixAddon(state),
      input: createFakeInput('text', {
        disabled: state === 'disabled',
        ariaInvalid: state === 'error',
      }),
    })
  );
}

/**
 * Creates a matrix of input groups by content type
 * @returns Matrix of InputGroup configurations for content type testing
 */
export function createFakeInputGroupContentTypeMatrix(): FakeInputGroup[] {
  return INPUT_GROUP_ADDON_CONTENT_TYPES.map((contentType) =>
    createFakeInputGroup({
      name: i18n.t('factory.inputGroup.contentName', 'Content: {{type}}', { type: contentType }),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, contentType),
      suffixAddon: createFakeAddon(ALIGN_INLINE_END, contentType),
    })
  );
}

/**
 * Creates a matrix of input groups by input type
 * @returns Matrix of InputGroup configurations for input type testing
 */
export function createFakeInputGroupInputTypeMatrix(): FakeInputGroup[] {
  return INPUT_GROUP_INPUT_TYPES.map((inputType) =>
    createFakeInputGroup({
      name: i18n.t('factory.inputGroup.inputName', 'Input: {{type}}', { type: inputType }),
      input: createFakeInput(inputType),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, 'icon', {
        iconName: getInputTypeIconName(inputType),
      }),
    })
  );
}

/**
 * Creates a comprehensive showcase of all input group types
 * @returns Record of categorized InputGroup configurations
 */
export function createFakeInputGroupShowcase(): Record<string, FakeInputGroup> {
  return {
    // Basic types
    basic: createFakeInputGroup({
      name: i18n.t('factory.inputGroup.basicInputGroup', 'Basic Input Group'),
    }),
    search: createFakeSearchInputGroup(),
    url: createFakeUrlInputGroup(),
    currency: createFakeCurrencyInputGroup(),
    phone: createFakePhoneInputGroup(),
    command: createFakeCommandInputGroup(),
    email: createFakeEmailInputGroup(),
    password: createFakePasswordInputGroup(),
    textarea: createFakeTextareaInputGroup(),

    // States
    stateDefault: createFakeInputGroup({
      state: 'default',
      name: i18n.t('factory.inputGroup.defaultState', 'Default State'),
    }),
    stateFocused: createFakeInputGroup({
      state: 'focused',
      name: i18n.t('factory.inputGroup.focusedState', 'Focused State'),
    }),
    stateDisabled: createFakeInputGroup({
      state: 'disabled',
      name: i18n.t('factory.inputGroup.disabledState', 'Disabled State'),
    }),
    stateError: createFakeInputGroup({
      state: 'error',
      name: i18n.t('factory.inputGroup.errorState', 'Error State'),
    }),
    stateSuccess: createFakeInputGroup({
      state: 'success',
      name: i18n.t('factory.inputGroup.successState', 'Success State'),
    }),
    stateLoading: createFakeInputGroup({
      state: 'loading',
      name: i18n.t('factory.inputGroup.loadingState', 'Loading State'),
    }),

    // Layouts
    layoutHorizontal: createFakeInputGroup({
      layout: 'horizontal',
      name: i18n.t('factory.inputGroup.horizontalLayout', 'Horizontal Layout'),
    }),
    layoutVertical: createFakeInputGroup({
      layout: 'vertical',
      hasBlockAddons: true,
      name: i18n.t('factory.inputGroup.verticalLayout', 'Vertical Layout'),
    }),

    // Widths
    widthAuto: createFakeInputGroup({
      width: 'auto',
      name: i18n.t('factory.inputGroup.autoWidth', 'Auto Width'),
    }),
    widthFixed: createFakeInputGroup({
      width: 'fixed',
      name: i18n.t('factory.inputGroup.fixedWidth', 'Fixed Width'),
    }),
    widthFull: createFakeInputGroup({
      width: 'full',
      name: i18n.t('factory.inputGroup.fullWidth', 'Full Width'),
    }),
  };
}

// ============================================================================
// FORM SET FACTORIES
// ============================================================================

/**
 * Creates a set of input groups for a typical registration form
 * @returns Array of InputGroup configurations for registration
 */
export function createFakeRegistrationInputGroups(): FakeInputGroup[] {
  return [
    createFakeInputGroup({
      name: i18n.t('factory.inputGroup.username', 'Username'),
      input: createFakeInput('text', {
        placeholder: i18n.t('factory.inputGroup.chooseAUsername', 'Choose a username'),
        ariaLabel: i18n.t('factory.inputGroup.username', 'Username'),
        autocomplete: 'username',
      }),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, 'text', { text: '@' }),
    }),
    createFakeEmailInputGroup(),
    createFakePasswordInputGroup({ name: LABEL_PASSWORD }),
    createFakePasswordInputGroup({
      name: i18n.t('factory.inputGroup.confirmPassword', 'Confirm Password'),
    }),
    createFakePhoneInputGroup(),
  ];
}

/**
 * Creates a set of input groups for a typical contact form
 * @returns Array of InputGroup configurations for contact form
 */
export function createFakeContactInputGroups(): FakeInputGroup[] {
  return [
    createFakeInputGroup({
      name: i18n.t('factory.inputGroup.fullName', 'Full Name'),
      input: createFakeInput('text', {
        placeholder: i18n.t('factory.inputGroup.enterYourFullName', 'Enter your full name'),
        ariaLabel: i18n.t('factory.inputGroup.fullName2', 'Full name'),
        autocomplete: 'name',
      }),
    }),
    createFakeEmailInputGroup(),
    createFakePhoneInputGroup(),
    createFakeUrlInputGroup({
      name: i18n.t('factory.inputGroup.websiteOptional', 'Website (optional)'),
    }),
    createFakeTextareaInputGroup({ name: i18n.t('factory.inputGroup.message', 'Message') }),
  ];
}

/**
 * Creates a set of input groups for a search with filters
 * @returns Array of InputGroup configurations for search form
 */
export function createFakeSearchFormInputGroups(): FakeInputGroup[] {
  return [
    createFakeSearchInputGroup(),
    createFakeInputGroup({
      name: i18n.t('factory.inputGroup.categoryFilter', 'Category Filter'),
      input: createFakeInput('text', {
        placeholder: i18n.t('factory.inputGroup.filterByCategory', 'Filter by category'),
        ariaLabel: i18n.t('factory.inputGroup.category', 'Category'),
      }),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, 'icon', { iconName: 'ChevronDown' }),
    }),
    createFakeCurrencyInputGroup({ name: i18n.t('factory.inputGroup.priceRange', 'Price Range') }),
  ];
}

/**
 * Creates a set of input groups for payment/checkout
 * @returns Array of InputGroup configurations for payment form
 */
export function createFakePaymentInputGroups(): FakeInputGroup[] {
  return [
    createFakeCurrencyInputGroup({
      name: i18n.t('factory.inputGroup.paymentAmount', 'Payment Amount'),
    }),
    createFakeInputGroup({
      name: i18n.t('factory.inputGroup.cardNumber', 'Card Number'),
      input: createFakeInput('text', {
        placeholder: '1234 5678 9012 3456',
        ariaLabel: i18n.t('factory.inputGroup.cardNumber2', 'Card number'),
        autocomplete: 'cc-number',
        maxLength: 19,
      }),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, 'icon', { iconName: 'Copy' }),
    }),
    createFakeInputGroup({
      name: i18n.t('factory.inputGroup.expiryDate', 'Expiry Date'),
      input: createFakeInput('text', {
        placeholder: 'MM/YY',
        ariaLabel: i18n.t('factory.inputGroup.expiryDate2', 'Expiry date'),
        autocomplete: 'cc-exp',
        maxLength: 5,
      }),
    }),
    createFakeInputGroup({
      name: i18n.t('factory.inputGroup.cvv', 'CVV'),
      input: createFakeInput('password', {
        placeholder: '123',
        ariaLabel: i18n.t('factory.inputGroup.cvv', 'CVV'),
        autocomplete: 'cc-csc',
        maxLength: 4,
      }),
      suffixAddon: createFakeAddon(ALIGN_INLINE_END, 'button', {
        iconName: 'Eye',
        buttonAriaLabel: i18n.t('factory.inputGroup.showCvv', 'Show CVV'),
        buttonSize: 'icon-xs',
      }),
    }),
  ];
}

// ============================================================================
// ENTERPRISE FEATURE FACTORIES
// ============================================================================

/**
 * Enterprise input group configuration interface
 * @description Extended configuration for enterprise-grade input groups
 */
export interface FakeEnterpriseInputGroup extends FakeInputGroup {
  /** Autocomplete delay in ms */
  autocompleteDelayMs?: number;
  /** Current character count */
  currentCharacters?: number;
  /** Whether to debounce input changes */
  debounceMs?: number;
  /** Whether input supports autocomplete suggestions */
  hasAutocomplete?: boolean;
  /** Whether input has real-time validation */
  hasRealTimeValidation?: boolean;
  /** Maximum characters for character count */
  maxCharacters?: number;
  /** Whether to show loading indicator in addon */
  showAddonLoading?: boolean;
  /** Whether input shows character count */
  showCharacterCount?: boolean;
  /** Custom test ID for E2E testing */
  testId?: string;
  /** Whether to track analytics on input */
  trackingEnabled?: boolean;
  /** Analytics tracking ID */
  trackingId?: string;
}

/**
 * Creates an enterprise input group with real-time validation
 * @param overrides - Optional partial object to override default values
 * @returns An enterprise InputGroup configuration with validation
 */
export function createFakeEnterpriseValidatingInputGroup(
  overrides?: Partial<FakeEnterpriseInputGroup>
): FakeEnterpriseInputGroup {
  return {
    ...createFakeInputGroup({
      name: i18n.t('factory.inputGroup.enterpriseValidatingInput', 'Enterprise Validating Input'),
      state: 'default',
      input: createFakeInput('email', {
        placeholder: i18n.t(
          'factory.inputGroup.enterEmailForValidation',
          'Enter email for validation'
        ),
        ariaLabel: i18n.t('factory.inputGroup.emailWithValidation', 'Email with validation'),
      }),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, 'icon', { iconName: 'Mail' }),
      suffixAddon: createFakeAddon(ALIGN_INLINE_END, 'loading'),
    }),
    hasRealTimeValidation: true,
    debounceMs: 300,
    trackingEnabled: true,
    trackingId: `input-${faker.string.alphanumeric(8)}`,
    testId: 'enterprise-validating-input',
    ...overrides,
  };
}

/**
 * Creates an enterprise input group with character counting
 * @param maxCharacters - Maximum character limit
 * @param overrides - Optional partial object to override default values
 * @returns An enterprise InputGroup configuration with character count
 */
export function createFakeEnterpriseCharacterCountInputGroup(
  maxCharacters = 280,
  overrides?: Partial<FakeEnterpriseInputGroup>
): FakeEnterpriseInputGroup {
  const currentCharacters = faker.number.int({ min: 0, max: maxCharacters });

  return {
    ...createFakeInputGroup({
      name: i18n.t('factory.inputGroup.characterCountInput', 'Character Count Input'),
      input: createFakeInput('text', {
        placeholder: i18n.t('factory.inputGroup.typeYourMessage', 'Type your message...'),
        ariaLabel: i18n.t(
          'factory.inputGroup.messageWithCharacterLimit',
          'Message with character limit'
        ),
        maxLength: maxCharacters,
        defaultValue: faker.lorem.words(faker.number.int({ min: 1, max: 10 })),
      }),
      suffixAddon: createFakeAddon(ALIGN_INLINE_END, 'text', {
        text: i18n.t('factory.inputGroup.characterCount', '{{current}}/{{max}}', {
          current: currentCharacters,
          max: maxCharacters,
        }),
      }),
    }),
    showCharacterCount: true,
    maxCharacters,
    currentCharacters,
    testId: 'enterprise-character-count-input',
    ...overrides,
  };
}

/**
 * Creates an enterprise input group with autocomplete
 * @param overrides - Optional partial object to override default values
 * @returns An enterprise InputGroup configuration with autocomplete
 */
export function createFakeEnterpriseAutocompleteInputGroup(
  overrides?: Partial<FakeEnterpriseInputGroup>
): FakeEnterpriseInputGroup {
  return {
    ...createFakeSearchInputGroup({
      name: i18n.t('factory.inputGroup.autocompleteSearch', 'Autocomplete Search'),
    }),
    hasAutocomplete: true,
    autocompleteDelayMs: 200,
    debounceMs: 150,
    trackingEnabled: true,
    trackingId: `autocomplete-${faker.string.alphanumeric(6)}`,
    testId: 'enterprise-autocomplete-input',
    ...overrides,
  };
}

/**
 * Creates an enterprise input group with loading addon state
 * @param overrides - Optional partial object to override default values
 * @returns An enterprise InputGroup configuration with loading addon
 */
export function createFakeEnterpriseLoadingInputGroup(
  overrides?: Partial<FakeEnterpriseInputGroup>
): FakeEnterpriseInputGroup {
  return {
    ...createFakeInputGroup({
      name: i18n.t('factory.inputGroup.loadingInput', 'Loading Input'),
      state: 'loading',
      input: createFakeInput('text', {
        placeholder: i18n.t('factory.inputGroup.validating', 'Validating...'),
        ariaLabel: i18n.t('factory.inputGroup.inputBeingValidated', 'Input being validated'),
        disabled: true,
      }),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, 'loading'),
      suffixAddon: undefined,
    }),
    showAddonLoading: true,
    testId: 'enterprise-loading-input',
    ...overrides,
  };
}

/**
 * Creates a set of enterprise input groups for testing
 * @returns Array of enterprise InputGroup configurations
 */
export function createFakeEnterpriseInputGroupSet(): FakeEnterpriseInputGroup[] {
  return [
    createFakeEnterpriseValidatingInputGroup(),
    createFakeEnterpriseCharacterCountInputGroup(),
    createFakeEnterpriseAutocompleteInputGroup(),
    createFakeEnterpriseLoadingInputGroup(),
  ];
}

// ============================================================================
// ACCESSIBILITY-FOCUSED FACTORIES
// ============================================================================

/**
 * Accessibility configuration for input groups
 */
export interface FakeAccessibleInputGroup extends FakeInputGroup {
  /** Detailed aria-describedby ID */
  ariaDescribedBy?: string;
  /** Error message ID for aria-errormessage */
  ariaErrorMessage?: string;
  /** Error text for invalid state */
  errorText?: string;
  /** Help text for the input */
  helpText?: string;
  /** Whether icons should be aria-hidden */
  hideIconsFromAria?: boolean;
  /** Live region politeness for validation messages */
  liveRegionPoliteness?: 'assertive' | 'off' | 'polite';
}

/**
 * Creates an accessible input group with all ARIA attributes
 * @param overrides - Optional partial object to override default values
 * @returns An accessible InputGroup configuration
 */
export function createFakeAccessibleInputGroup(
  overrides?: Partial<FakeAccessibleInputGroup>
): FakeAccessibleInputGroup {
  const inputId = `input-${faker.string.alphanumeric(6)}`;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;

  return {
    ...createFakeInputGroup({
      name: i18n.t('factory.inputGroup.accessibleInput', 'Accessible Input'),
      input: createFakeInput('text', {
        id: inputId,
        ariaLabel: i18n.t('factory.inputGroup.accessibleTextInput', 'Accessible text input'),
        placeholder: i18n.t('factory.inputGroup.enterValue', 'Enter value...'),
      }),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, 'icon', { iconName: 'Search' }),
    }),
    ariaDescribedBy: helpId,
    ariaErrorMessage: errorId,
    hideIconsFromAria: true,
    liveRegionPoliteness: 'polite',
    helpText: i18n.t('factory.inputGroup.enterAtLeast3Characters', 'Enter at least 3 characters'),
    errorText: undefined,
    testId: `accessible-${inputId}`,
    ...overrides,
  };
}

/**
 * Creates an accessible input group in error state
 * @param errorMessage - The error message to display
 * @param overrides - Optional partial object to override default values
 * @returns An accessible InputGroup configuration with error
 */
export function createFakeAccessibleErrorInputGroup(
  errorMessage = i18n.t('factory.inputGroup.thisFieldIsRequired', 'This field is required'),
  overrides?: Partial<FakeAccessibleInputGroup>
): FakeAccessibleInputGroup {
  const inputId = `input-${faker.string.alphanumeric(6)}`;
  const errorId = `${inputId}-error`;

  return {
    ...createFakeInputGroup({
      name: i18n.t('factory.inputGroup.errorInput', 'Error Input'),
      state: 'error',
      input: createFakeInput('text', {
        id: inputId,
        ariaLabel: i18n.t('factory.inputGroup.inputWithError', 'Input with error'),
        ariaInvalid: true,
        placeholder: i18n.t('factory.inputGroup.invalidValue', 'Invalid value'),
        defaultValue: i18n.t('factory.inputGroup.badInput', 'bad input'),
      }),
      prefixAddon: createFakeAddon(ALIGN_INLINE_START, 'icon', { iconName: 'X' }),
    }),
    ariaErrorMessage: errorId,
    hideIconsFromAria: true,
    liveRegionPoliteness: 'assertive',
    errorText: errorMessage,
    testId: `error-${inputId}`,
    ...overrides,
  };
}

/**
 * Creates all accessibility test input groups
 * @returns Array of accessible InputGroup configurations for testing
 */
export function createFakeAccessibleInputGroupSet(): FakeAccessibleInputGroup[] {
  return [
    createFakeAccessibleInputGroup(),
    createFakeAccessibleErrorInputGroup(
      i18n.t('factory.inputGroup.pleaseEnterAValidValue', 'Please enter a valid value')
    ),
    createFakeAccessibleInputGroup({
      name: i18n.t('factory.inputGroup.disabledAccessibleInput', 'Disabled Accessible Input'),
      state: 'disabled',
      input: createFakeInput('text', {
        disabled: true,
        ariaLabel: i18n.t('factory.inputGroup.disabledInput', 'Disabled input'),
        placeholder: i18n.t('factory.inputGroup.thisInputIsDisabled', 'This input is disabled'),
      }),
    }),
    createFakeAccessibleInputGroup({
      name: i18n.t('factory.inputGroup.requiredAccessibleInput', 'Required Accessible Input'),
      input: createFakeInput('text', {
        required: true,
        ariaLabel: i18n.t('factory.inputGroup.requiredInput', 'Required input'),
        placeholder: i18n.t('factory.inputGroup.requiredField', 'Required field'),
      }),
      helpText: i18n.t('factory.inputGroup.thisFieldIsRequired', 'This field is required'),
    }),
  ];
}
