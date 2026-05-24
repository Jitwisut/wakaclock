import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ TYPE DEFINITIONS ============

/** Scroll button variant */
export type ScrollButtonVariant = 'default' | 'ghost' | 'outline' | 'secondary';

/** Scroll button size */
export type ScrollButtonSize = 'default' | 'icon' | 'lg' | 'sm';

/** Interface for fake prompt scroll button */
export interface FakePromptScrollButton {
  /** Accessible label */
  ariaLabel: string;
  /** Unique identifier */
  id: string;
  /** Whether the button is visible */
  isVisible: boolean;
  /** Display label */
  label: string;
  /** Button size */
  size: ScrollButtonSize;
  /** Scroll threshold in pixels */
  threshold: number;
  /** Button variant */
  variant: ScrollButtonVariant;
}

/** Interface for scroll button config */
export interface FakeScrollButtonConfig {
  /** Accessible label */
  ariaLabel: string;
  /** Position CSS class */
  position: string;
  /** Button size */
  size: ScrollButtonSize;
  /** Scroll threshold */
  threshold: number;
  /** Button variant */
  variant: ScrollButtonVariant;
}

// ============ CONSTANTS FOR ITERATION ============

/** All scroll button variant options */
export const SCROLL_BUTTON_VARIANTS: ScrollButtonVariant[] = [
  'default',
  'ghost',
  'outline',
  'secondary',
];

/** All scroll button size options */
export const SCROLL_BUTTON_SIZES: ScrollButtonSize[] = ['default', 'icon', 'lg', 'sm'];

/** Common scroll threshold values */
export const SCROLL_THRESHOLDS = [50, 100, 150, 200, 300];

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake prompt scroll button
 * @param overrides - Optional partial overrides
 * @returns A fake prompt scroll button
 */
export function createFakePromptScrollButton(
  overrides?: Partial<FakePromptScrollButton>
): FakePromptScrollButton {
  return {
    id: faker.string.uuid(),
    label: i18n.t('factory.promptScrollButton.scrollToBottom', 'Scroll to bottom'),
    ariaLabel: i18n.t('factory.promptScrollButton.scrollToBottom', 'Scroll to bottom'),
    isVisible: faker.datatype.boolean(),
    variant: faker.helpers.arrayElement(SCROLL_BUTTON_VARIANTS),
    size: faker.helpers.arrayElement(SCROLL_BUTTON_SIZES),
    threshold: faker.helpers.arrayElement(SCROLL_THRESHOLDS),
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake prompt scroll buttons
 * @param count - Number of buttons to generate
 * @returns Array of fake prompt scroll buttons
 */
export function createFakePromptScrollButtons(count: number): FakePromptScrollButton[] {
  return Array.from({ length: count }, () => createFakePromptScrollButton());
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a visible scroll button
 * @returns A visible scroll button
 */
export function createFakeVisibleScrollButton(): FakePromptScrollButton {
  return createFakePromptScrollButton({
    isVisible: true,
    variant: 'outline',
  });
}

/**
 * Creates a hidden scroll button
 * @returns A hidden scroll button
 */
export function createFakeHiddenScrollButton(): FakePromptScrollButton {
  return createFakePromptScrollButton({
    isVisible: false,
  });
}

/**
 * Creates scroll buttons for all variants
 * @returns Array with one button per variant
 */
export function createFakeScrollButtonsByVariant(): FakePromptScrollButton[] {
  return SCROLL_BUTTON_VARIANTS.map((variant) =>
    createFakePromptScrollButton({
      id: `scroll-btn-${variant}`,
      variant,
      isVisible: true,
    })
  );
}

/**
 * Creates a scroll button configuration
 * @param scenario - Configuration scenario
 * @returns Scroll button configuration
 */
export function createFakeScrollButtonConfig(
  scenario: 'default' | 'large' | 'sensitive' = 'default'
): FakeScrollButtonConfig {
  const configs: Record<string, FakeScrollButtonConfig> = {
    default: {
      variant: 'outline',
      size: 'sm',
      threshold: 100,
      ariaLabel: i18n.t('factory.promptScrollButton.scrollToBottom', 'Scroll to bottom'),
      position: i18n.t(
        'factory.promptScrollButton.absoluteBottom4Right4',
        'absolute bottom-4 right-4'
      ),
    },
    large: {
      variant: 'default',
      size: 'default',
      threshold: 200,
      ariaLabel: i18n.t(
        'factory.promptScrollButton.scrollToLatestMessages',
        'Scroll to latest messages'
      ),
      position: i18n.t(
        'factory.promptScrollButton.absoluteBottom6Right6',
        'absolute bottom-6 right-6'
      ),
    },
    sensitive: {
      variant: 'ghost',
      size: 'icon',
      threshold: 50,
      ariaLabel: i18n.t('factory.promptScrollButton.jumpToBottom', 'Jump to bottom'),
      position: i18n.t(
        'factory.promptScrollButton.absoluteBottom2Right2',
        'absolute bottom-2 right-2'
      ),
    },
  };

  return configs[scenario];
}
