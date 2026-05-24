import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/** Button visual variant */
export type ButtonVariant =
  | 'default'
  | 'destructive'
  | 'ghost'
  | 'info'
  | 'link'
  | 'outline'
  | 'secondary'
  | 'success'
  | 'warning';

/** Button size variant */
export type ButtonSize =
  | 'default'
  | 'icon-lg'
  | 'icon-sm'
  | 'icon-xl'
  | 'icon-xs'
  | 'icon'
  | 'lg'
  | 'sm'
  | 'xl'
  | 'xs';

/** Button interaction state */
export type ButtonState = 'disabled' | 'error' | 'idle' | 'loading' | 'pending' | 'success';

/** Button justify alignment */
export type ButtonJustify = 'between' | 'center' | 'end' | 'start';

// ═══════════════════════════════════════════════════════════════
// INTERFACE (Shape of Generated Data)
// ═══════════════════════════════════════════════════════════════

/** Badge position options */
export type BadgePosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

/** Button tooltip side options (re-uses TooltipSide from tooltip.factory) */
export type ButtonTooltipSide = 'bottom' | 'left' | 'right' | 'top';

/** Gradient direction options */
export type GradientDirection =
  | 'to-b'
  | 'to-bl'
  | 'to-br'
  | 'to-l'
  | 'to-r'
  | 'to-t'
  | 'to-tl'
  | 'to-tr';

/** Gradient configuration */
export interface GradientConfig {
  direction?: GradientDirection;
  from: string;
  to: string;
}

/** Confirmation dialog configuration */
export interface ConfirmConfig {
  cancelLabel?: string;
  confirmLabel?: string;
  description?: string;
  title?: string;
}

/** Context menu item */
export interface ContextMenuItem {
  destructive?: boolean;
  disabled?: boolean;
  icon?: string;
  label: string;
}

export interface FakeButton {
  announceStateChanges: boolean;
  ariaLabel?: string;
  autoResetMs: number;
  badge?: number | string;
  badgePosition?: BadgePosition;
  confirmAction?: boolean | ConfirmConfig;
  contextMenuItems?: ContextMenuItem[];
  createdAt: Date;
  debounceMs: number;
  disabled: boolean;
  error: boolean;
  errorAnnouncement?: string;
  fullWidth: boolean;
  glow: boolean;
  gradient?: boolean | GradientConfig;
  groupId?: string;
  groupValue?: string;
  hapticFeedback: boolean;
  hapticPattern: number | number[];
  icon?: string;
  id: string;
  justify: ButtonJustify;
  label: string;
  leftIcon?: string;
  loading: boolean;
  loadingAnnouncement?: string;
  longPressMs?: number;
  metadata?: Record<string, unknown>;
  pending: boolean;
  pressed?: boolean;
  // Enterprise features - Phase 1
  preventDoubleClick: boolean;
  pulse: boolean;
  respectReducedMotion: boolean;
  rightIcon?: string;
  ripple: boolean;
  rippleColor?: string;
  // Enterprise features - Phase 2
  shortcut?: string;
  showShortcut: boolean;
  size: ButtonSize;
  skeleton: boolean;
  soundDuration?: number;
  soundEnabled: boolean;
  soundFrequency?: number;
  state: ButtonState;
  success: boolean;
  successAnnouncement?: string;
  testId?: string;
  toggle: boolean;
  tooltip?: string;
  tooltipDelayMs?: number;
  tooltipSide?: ButtonTooltipSide;
  trackingData?: Record<string, unknown>;
  trackingId?: string;
  type: 'button' | 'reset' | 'submit';
  undoable: boolean;
  undoTimeoutMs?: number;
  variant: ButtonVariant;
}

export interface FakeButtonGroup {
  buttons: FakeButton[];
  id: string;
  orientation: 'horizontal' | 'vertical';
  spacing: 'lg' | 'md' | 'none' | 'sm';
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS (Used in Stories for Iteration)
// ═══════════════════════════════════════════════════════════════

export const BUTTON_VARIANTS: ButtonVariant[] = [
  'default',
  'secondary',
  'outline',
  'ghost',
  'link',
  'destructive',
  'warning',
  'success',
  'info',
];

export const BUTTON_SIZES: ButtonSize[] = [
  'xs',
  'sm',
  'default',
  'lg',
  'xl',
  'icon-xs',
  'icon-sm',
  'icon',
  'icon-lg',
  'icon-xl',
];

export const BUTTON_TEXT_SIZES: ButtonSize[] = ['xs', 'sm', 'default', 'lg', 'xl'];

export const BUTTON_ICON_SIZES: ButtonSize[] = ['icon-xs', 'icon-sm', 'icon', 'icon-lg', 'icon-xl'];

export const BUTTON_STATES: ButtonState[] = [
  'idle',
  'loading',
  'pending',
  'disabled',
  'error',
  'success',
];

export const BUTTON_JUSTIFY: ButtonJustify[] = ['start', 'center', 'end', 'between'];

export const BUTTON_TYPES: Array<'button' | 'reset' | 'submit'> = ['button', 'submit', 'reset'];

export const BUTTON_ICONS = [
  i18n.t('factory.button.plus', 'Plus'),
  i18n.t('factory.button.minus', 'Minus'),
  i18n.t('factory.button.check', 'Check'),
  'X',
  'ChevronRight',
  'ChevronLeft',
  'ChevronDown',
  'ChevronUp',
  i18n.t('factory.button.settings', 'Settings'),
  i18n.t('factory.button.user', 'User'),
  i18n.t('factory.button.mail', 'Mail'),
  i18n.t('factory.button.search', 'Search'),
  i18n.t('factory.button.heart', 'Heart'),
  i18n.t('factory.button.star', 'Star'),
  i18n.t('factory.button.trash', 'Trash'),
  i18n.t('factory.button.edit', 'Edit'),
  i18n.t('factory.button.copy', 'Copy'),
  i18n.t('factory.button.download', 'Download'),
  i18n.t('factory.button.upload', 'Upload'),
  i18n.t('factory.button.share', 'Share'),
  'ExternalLink',
  'MoreHorizontal',
  'MoreVertical',
  i18n.t('factory.button.refresh', 'Refresh'),
  i18n.t('factory.button.loader', 'Loader'),
];

export const BUTTON_LABELS = [
  i18n.t('factory.button.submit', 'Submit'),
  i18n.t('factory.button.cancel', 'Cancel'),
  i18n.t('factory.button.save', 'Save'),
  i18n.t('factory.button.delete', 'Delete'),
  i18n.t('factory.button.edit', 'Edit'),
  'Add',
  i18n.t('factory.button.remove', 'Remove'),
  i18n.t('factory.button.continue', 'Continue'),
  i18n.t('factory.button.back', 'Back'),
  i18n.t('factory.button.next', 'Next'),
  i18n.t('factory.button.confirm', 'Confirm'),
  i18n.t('factory.button.close', 'Close'),
  i18n.t('factory.button.open', 'Open'),
  i18n.t('factory.button.send', 'Send'),
  i18n.t('factory.button.download', 'Download'),
  i18n.t('factory.button.upload', 'Upload'),
  i18n.t('factory.button.share', 'Share'),
  i18n.t('factory.button.copy', 'Copy'),
  i18n.t('factory.button.refresh', 'Refresh'),
  i18n.t('factory.button.retry', 'Retry'),
];

// ═══════════════════════════════════════════════════════════════
// SINGLE ITEM FACTORY
// ═══════════════════════════════════════════════════════════════

/** Common keyboard shortcuts */
export const KEYBOARD_SHORTCUTS = [
  'mod+s',
  'mod+k',
  'mod+enter',
  'mod+shift+s',
  'escape',
  'mod+d',
  'mod+p',
  'mod+n',
];

/** Gradient presets */
export const GRADIENT_PRESETS: GradientConfig[] = [
  { from: '#667eea', to: '#764ba2', direction: 'to-r' },
  { from: '#f093fb', to: '#f5576c', direction: 'to-r' },
  { from: '#4facfe', to: '#00f2fe', direction: 'to-r' },
  { from: '#ffecd2', to: '#fcb69f', direction: 'to-br' },
  { from: '#a8edea', to: '#fed6e3', direction: 'to-r' },
  { from: '#ff9a9e', to: '#fecfef', direction: 'to-t' },
];

export function createFakeButton(overrides?: Partial<FakeButton>): FakeButton {
  const state = overrides?.state ?? faker.helpers.arrayElement(BUTTON_STATES);
  const size = overrides?.size ?? faker.helpers.arrayElement(BUTTON_SIZES);
  const isIconOnly = size.startsWith('icon');

  return {
    id: faker.string.uuid(),
    label: isIconOnly ? '' : faker.helpers.arrayElement(BUTTON_LABELS),
    variant: faker.helpers.arrayElement(BUTTON_VARIANTS),
    size,
    state,
    disabled: state === 'disabled',
    loading: state === 'loading',
    pending: state === 'pending',
    success: state === 'success',
    error: state === 'error',
    fullWidth: faker.datatype.boolean({ probability: 0.2 }),
    justify: faker.helpers.arrayElement(BUTTON_JUSTIFY),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(BUTTON_ICONS), {
      probability: 0.3,
    }),
    leftIcon: faker.helpers.maybe(() => faker.helpers.arrayElement(BUTTON_ICONS), {
      probability: 0.2,
    }),
    rightIcon: faker.helpers.maybe(() => faker.helpers.arrayElement(BUTTON_ICONS), {
      probability: 0.2,
    }),
    ariaLabel: isIconOnly ? faker.helpers.arrayElement(BUTTON_LABELS) : undefined,
    type: faker.helpers.arrayElement(BUTTON_TYPES),
    createdAt: faker.date.recent(),
    metadata: faker.datatype.boolean() ? { source: faker.word.noun() } : undefined,
    // Enterprise features - Phase 1
    preventDoubleClick: faker.datatype.boolean({ probability: 0.1 }),
    debounceMs: faker.helpers.arrayElement([200, 300, 500, 1000]),
    hapticFeedback: faker.datatype.boolean({ probability: 0.05 }),
    hapticPattern: faker.helpers.arrayElement([10, 20, [10, 50, 10], [20, 100, 20]]),
    trackingId: faker.helpers.maybe(() => faker.string.alphanumeric(8), { probability: 0.3 }),
    trackingData: faker.helpers.maybe(
      () => ({
        source: faker.helpers.arrayElement(['hero', 'nav', 'footer', 'modal', 'form']),
        campaign: faker.helpers.maybe(() => faker.string.alphanumeric(6), { probability: 0.5 }),
      }),
      { probability: 0.2 }
    ),
    autoResetMs: faker.helpers.arrayElement([1000, 2000, 3000, 5000]),
    // Enterprise features - Phase 2
    shortcut: faker.helpers.maybe(() => faker.helpers.arrayElement(KEYBOARD_SHORTCUTS), {
      probability: 0.1,
    }),
    showShortcut: faker.datatype.boolean({ probability: 0.05 }),
    ripple: faker.datatype.boolean({ probability: 0.1 }),
    rippleColor: faker.helpers.maybe(() => faker.color.rgb({ format: 'css' }), {
      probability: 0.05,
    }),
    respectReducedMotion: true,
    announceStateChanges: faker.datatype.boolean({ probability: 0.1 }),
    loadingAnnouncement: faker.helpers.maybe(() => i18n.t('factory.button.loading', 'Loading...'), {
      probability: 0.1,
    }),
    successAnnouncement: faker.helpers.maybe(() => i18n.t('factory.button.success', 'Success!'), {
      probability: 0.1,
    }),
    errorAnnouncement: faker.helpers.maybe(
      () => i18n.t('factory.button.errorOccurred', 'Error occurred'),
      { probability: 0.1 }
    ),
    tooltip: faker.helpers.maybe(() => faker.lorem.sentence(4), { probability: 0.15 }),
    tooltipSide: faker.helpers.maybe(
      () => faker.helpers.arrayElement<ButtonTooltipSide>(['top', 'right', 'bottom', 'left']),
      { probability: 0.1 }
    ),
    tooltipDelayMs: faker.helpers.maybe(() => faker.helpers.arrayElement([300, 500, 700, 1000]), {
      probability: 0.05,
    }),
    confirmAction: faker.helpers.maybe(
      () =>
        faker.datatype.boolean()
          ? true
          : {
              title: i18n.t('factory.button.confirmAction', 'Confirm Action'),
              description: i18n.t('factory.button.areYouSure', 'Are you sure?'),
              confirmLabel: i18n.t('factory.button.yes', 'Yes'),
              cancelLabel: i18n.t('factory.button.no', 'No'),
            },
      { probability: 0.05 }
    ),
    testId: `button-${faker.string.alphanumeric(6)}`,
    soundEnabled: faker.datatype.boolean({ probability: 0.03 }),
    soundFrequency: faker.helpers.maybe(() => faker.number.int({ min: 200, max: 1200 }), {
      probability: 0.03,
    }),
    soundDuration: faker.helpers.maybe(() => faker.number.int({ min: 30, max: 200 }), {
      probability: 0.03,
    }),
    contextMenuItems: faker.helpers.maybe(
      () => [
        { label: i18n.t('factory.button.edit', 'Edit'), icon: 'Edit' },
        { label: i18n.t('factory.button.delete', 'Delete'), icon: 'Trash', destructive: true },
      ],
      { probability: 0.05 }
    ),
    undoable: faker.datatype.boolean({ probability: 0.05 }),
    undoTimeoutMs: faker.helpers.maybe(() => faker.helpers.arrayElement([3000, 5000, 10_000]), {
      probability: 0.05,
    }),
    badge: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 99 }), { probability: 0.1 }),
    badgePosition: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement<BadgePosition>([
          'top-right',
          'top-left',
          'bottom-right',
          'bottom-left',
        ]),
      { probability: 0.05 }
    ),
    toggle: faker.datatype.boolean({ probability: 0.05 }),
    pressed: faker.helpers.maybe(() => faker.datatype.boolean(), { probability: 0.05 }),
    groupId: faker.helpers.maybe(() => `group-${faker.string.alphanumeric(4)}`, {
      probability: 0.03,
    }),
    groupValue: faker.helpers.maybe(() => faker.string.alphanumeric(4), { probability: 0.03 }),
    skeleton: faker.datatype.boolean({ probability: 0.02 }),
    pulse: faker.datatype.boolean({ probability: 0.03 }),
    glow: faker.datatype.boolean({ probability: 0.03 }),
    gradient: faker.helpers.maybe(
      () => (faker.datatype.boolean() ? true : faker.helpers.arrayElement(GRADIENT_PRESETS)),
      { probability: 0.05 }
    ),
    longPressMs: faker.helpers.maybe(() => faker.helpers.arrayElement([500, 800, 1000]), {
      probability: 0.05,
    }),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// BULK FACTORY (For Lists/Tables)
// ═══════════════════════════════════════════════════════════════

export function createFakeButtons(count: number, overrides?: Partial<FakeButton>): FakeButton[] {
  return Array.from({ length: count }, () => createFakeButton(overrides));
}

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED FACTORIES (For Specific Scenarios)
// ═══════════════════════════════════════════════════════════════

/** Create a button in loading state */
export function createFakeButtonLoading(): FakeButton {
  return createFakeButton({ state: 'loading', loading: true, pending: false });
}

/** Create a button in pending state (React 19 transition) */
export function createFakeButtonPending(): FakeButton {
  return createFakeButton({ state: 'pending', loading: false, pending: true });
}

/** Create a disabled button */
export function createFakeButtonDisabled(): FakeButton {
  return createFakeButton({ state: 'disabled', disabled: true });
}

/** Create a button with error state */
export function createFakeButtonError(): FakeButton {
  return createFakeButton({ state: 'error' });
}

/** Create a button with success state */
export function createFakeButtonSuccess(): FakeButton {
  return createFakeButton({ state: 'success', variant: 'success' });
}

/** Create buttons for all variants */
export function createFakeButtonWithAllVariants(): FakeButton[] {
  return BUTTON_VARIANTS.map((variant) =>
    createFakeButton({ variant, state: 'idle', size: 'default' })
  );
}

/** Create buttons for all text sizes */
export function createFakeButtonWithAllTextSizes(): FakeButton[] {
  return BUTTON_TEXT_SIZES.map((size) => createFakeButton({ size, state: 'idle' }));
}

/** Create buttons for all icon sizes */
export function createFakeButtonWithAllIconSizes(): FakeButton[] {
  return BUTTON_ICON_SIZES.map((size) =>
    createFakeButton({
      size,
      state: 'idle',
      icon: i18n.t('factory.button.heart', 'Heart'),
      ariaLabel: i18n.t('factory.button.like', 'Like'),
      label: '',
    })
  );
}

/** Create buttons for all sizes (text + icon) */
export function createFakeButtonWithAllSizes(): FakeButton[] {
  return BUTTON_SIZES.map((size) => createFakeButton({ size }));
}

/** Create a full-width button */
export function createFakeButtonFullWidth(): FakeButton {
  return createFakeButton({ fullWidth: true, size: 'default' });
}

/** Create a button with left icon */
export function createFakeButtonWithLeftIcon(): FakeButton {
  return createFakeButton({ leftIcon: faker.helpers.arrayElement(BUTTON_ICONS) });
}

/** Create a button with right icon */
export function createFakeButtonWithRightIcon(): FakeButton {
  return createFakeButton({ rightIcon: faker.helpers.arrayElement(BUTTON_ICONS) });
}

/** Create a button with both icons */
export function createFakeButtonWithBothIcons(): FakeButton {
  return createFakeButton({
    leftIcon: faker.helpers.arrayElement(BUTTON_ICONS),
    rightIcon: faker.helpers.arrayElement(BUTTON_ICONS),
  });
}

/** Create submit button for forms */
export function createFakeSubmitButton(): FakeButton {
  return createFakeButton({
    type: 'submit',
    label: i18n.t('factory.button.submit', 'Submit'),
    variant: 'default',
  });
}

/** Create reset button for forms */
export function createFakeResetButton(): FakeButton {
  return createFakeButton({
    type: 'reset',
    label: i18n.t('factory.button.reset', 'Reset'),
    variant: 'outline',
  });
}

// ═══════════════════════════════════════════════════════════════
// BUTTON GROUP FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeButtonGroup(overrides?: Partial<FakeButtonGroup>): FakeButtonGroup {
  return {
    id: faker.string.uuid(),
    orientation: faker.helpers.arrayElement(['horizontal', 'vertical']),
    spacing: faker.helpers.arrayElement(['none', 'sm', 'md', 'lg']),
    buttons: createFakeButtons(faker.number.int({ min: 2, max: 5 })),
    ...overrides,
  };
}

export function createFakeButtonGroups(count: number): FakeButtonGroup[] {
  return Array.from({ length: count }, () => createFakeButtonGroup());
}

// ═══════════════════════════════════════════════════════════════
// FORM BUTTON SET FACTORY
// ═══════════════════════════════════════════════════════════════

export interface FakeFormButtons {
  cancel: FakeButton;
  reset: FakeButton;
  submit: FakeButton;
}

export function createFakeFormButtons(): FakeFormButtons {
  return {
    submit: createFakeButton({
      type: 'submit',
      label: i18n.t('factory.button.submit', 'Submit'),
      variant: 'default',
      state: 'idle',
    }),
    reset: createFakeButton({
      type: 'reset',
      label: i18n.t('factory.button.reset', 'Reset'),
      variant: 'outline',
      state: 'idle',
    }),
    cancel: createFakeButton({
      type: 'button',
      label: i18n.t('factory.button.cancel', 'Cancel'),
      variant: 'ghost',
      state: 'idle',
    }),
  };
}

// ═══════════════════════════════════════════════════════════════
// MATRIX FACTORIES (For Visual Regression)
// ═══════════════════════════════════════════════════════════════

/** Create variant × size matrix for visual testing */
export function createFakeButtonMatrix(): FakeButton[][] {
  return BUTTON_VARIANTS.map((variant) =>
    BUTTON_TEXT_SIZES.map((size) => createFakeButton({ variant, size, state: 'idle' }))
  );
}

/** Create state × variant matrix for visual testing */
export function createFakeButtonStateMatrix(): FakeButton[][] {
  return BUTTON_STATES.map((state) =>
    BUTTON_VARIANTS.map((variant) => createFakeButton({ variant, state, size: 'default' }))
  );
}

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE FEATURE FACTORIES
// ═══════════════════════════════════════════════════════════════

/** Create a payment button with double-click prevention */
export function createFakePaymentButton(amount?: number): FakeButton {
  return createFakeButton({
    label: i18n.t('factory.button.payAmount', 'Pay ${{amount}}', {
      amount: amount ?? faker.commerce.price({ min: 10, max: 500 }),
    }),
    variant: 'default',
    state: 'idle',
    preventDoubleClick: true,
    debounceMs: 500,
    trackingId: `payment-${faker.string.alphanumeric(6)}`,
    trackingData: {
      type: 'payment',
      amount: amount ?? faker.number.float({ min: 10, max: 500, fractionDigits: 2 }),
    },
  });
}

/** Create a mobile-optimized button with haptic feedback */
export function createFakeMobileButton(): FakeButton {
  return createFakeButton({
    hapticFeedback: true,
    hapticPattern: [10, 50, 10],
    size: 'lg',
  });
}

/** Create a tracked CTA button for analytics */
export function createFakeTrackedCTAButton(ctaName: string): FakeButton {
  return createFakeButton({
    label: ctaName,
    variant: 'default',
    state: 'idle',
    trackingId: `cta-${ctaName.toLowerCase().replaceAll(/\s+/g, '-')}`,
    trackingData: {
      source: faker.helpers.arrayElement(['hero', 'banner', 'modal', 'sidebar']),
      campaign: faker.string.alphanumeric(8),
      timestamp: Date.now(),
    },
  });
}

/** Create a button with success feedback */
export function createFakeSuccessFeedbackButton(): FakeButton {
  return createFakeButton({
    state: 'success',
    success: true,
    variant: 'success',
    autoResetMs: 2000,
  });
}

/** Create a button with error feedback */
export function createFakeErrorFeedbackButton(): FakeButton {
  return createFakeButton({
    state: 'error',
    error: true,
    variant: 'destructive',
    autoResetMs: 3000,
  });
}

/** Create an A/B test button pair */
export interface FakeABTestButtons {
  testId: string;
  variantA: FakeButton;
  variantB: FakeButton;
}

export function createFakeABTestButtons(ctaText: string): FakeABTestButtons {
  const testId = faker.string.alphanumeric(8);
  return {
    testId,
    variantA: createFakeButton({
      label: ctaText,
      variant: 'default',
      trackingId: `ab-${testId}-a`,
      trackingData: { variant: 'a', testId },
    }),
    variantB: createFakeButton({
      label: ctaText,
      variant: 'secondary',
      trackingId: `ab-${testId}-b`,
      trackingData: { variant: 'b', testId },
    }),
  };
}

/** Create all enterprise feature combinations for testing */
export function createFakeEnterpriseButtonSet(): FakeButton[] {
  return [
    createFakePaymentButton(99.99),
    createFakeMobileButton(),
    createFakeTrackedCTAButton(i18n.t('factory.button.getStarted', 'Get Started')),
    createFakeSuccessFeedbackButton(),
    createFakeErrorFeedbackButton(),
  ];
}

// ═══════════════════════════════════════════════════════════════
// PHASE 2 ENTERPRISE FACTORIES
// ═══════════════════════════════════════════════════════════════

/** Create a button with keyboard shortcut */
export function createFakeShortcutButton(label: string, shortcut: string): FakeButton {
  return createFakeButton({
    label,
    shortcut,
    showShortcut: true,
    state: 'idle',
    variant: 'default',
  });
}

/** Create a toggle button (for toolbar/formatting) */
export function createFakeToggleButton(label: string, pressed = false): FakeButton {
  return createFakeButton({
    label,
    toggle: true,
    pressed,
    variant: pressed ? 'default' : 'ghost',
    size: 'icon-sm',
    ariaLabel: label,
  });
}

/** Create a button with ripple effect */
export function createFakeRippleButton(rippleColor?: string): FakeButton {
  return createFakeButton({
    ripple: true,
    rippleColor: rippleColor ?? 'rgba(255, 255, 255, 0.4)',
    variant: 'default',
    state: 'idle',
  });
}

/** Create a gradient button */
export function createFakeGradientButton(gradient?: GradientConfig): FakeButton {
  return createFakeButton({
    gradient: gradient ?? faker.helpers.arrayElement(GRADIENT_PRESETS),
    state: 'idle',
    glow: true,
  });
}

/** Create a button with badge */
export function createFakeBadgeButton(
  badgeValue: number | string,
  position: BadgePosition = 'top-right'
): FakeButton {
  return createFakeButton({
    badge: badgeValue,
    badgePosition: position,
    state: 'idle',
  });
}

/** Create a skeleton button */
export function createFakeSkeletonButton(size: ButtonSize = 'default'): FakeButton {
  return createFakeButton({
    skeleton: true,
    size,
    state: 'idle',
  });
}

/** Create a long press button (for destructive actions) */
export function createFakeLongPressButton(longPressMs = 800): FakeButton {
  return createFakeButton({
    variant: 'destructive',
    longPressMs,
    hapticFeedback: true,
    state: 'idle',
  });
}

/** Create a button with confirmation dialog */
export function createFakeConfirmButton(config?: ConfirmConfig): FakeButton {
  return createFakeButton({
    variant: 'destructive',
    confirmAction: config ?? {
      title: i18n.t('factory.button.confirmAction', 'Confirm Action'),
      description: i18n.t(
        'factory.button.thisActionCannotBeUndone',
        'This action cannot be undone.'
      ),
      confirmLabel: i18n.t('factory.button.yesProceed', 'Yes, proceed'),
      cancelLabel: i18n.t('factory.button.cancel', 'Cancel'),
    },
    state: 'idle',
  });
}

/** Create a button with tooltip */
export function createFakeTooltipButton(
  tooltip: string,
  side: ButtonTooltipSide = 'top'
): FakeButton {
  return createFakeButton({
    tooltip,
    tooltipSide: side,
    tooltipDelayMs: 700,
    state: 'idle',
  });
}

/** Create a button with sound effect */
export function createFakeSoundButton(frequency = 800, duration = 50): FakeButton {
  return createFakeButton({
    soundEnabled: true,
    soundFrequency: frequency,
    soundDuration: duration,
    state: 'idle',
  });
}

/** Create an undoable action button */
export function createFakeUndoableButton(): FakeButton {
  return createFakeButton({
    undoable: true,
    undoTimeoutMs: 5000,
    variant: 'outline',
    state: 'idle',
  });
}

/** Create a pulse/glow CTA button */
export function createFakeCTAButton(label: string): FakeButton {
  return createFakeButton({
    label,
    pulse: true,
    glow: true,
    variant: 'default',
    size: 'lg',
    state: 'idle',
  });
}

/** Create a button with screen reader announcements */
export function createFakeAccessibleButton(): FakeButton {
  return createFakeButton({
    announceStateChanges: true,
    loadingAnnouncement: i18n.t(
      'factory.button.processingYourRequest',
      'Processing your request...'
    ),
    successAnnouncement: i18n.t(
      'factory.button.operationCompletedSuccessfully',
      'Operation completed successfully!'
    ),
    errorAnnouncement: i18n.t(
      'factory.button.anErrorOccurredPleaseTry',
      'An error occurred. Please try again.'
    ),
    respectReducedMotion: true,
    state: 'idle',
  });
}

/** Create all Phase 2 enterprise buttons for testing */
export function createFakeEnterprisePhase2ButtonSet(): FakeButton[] {
  return [
    createFakeShortcutButton(i18n.t('factory.button.save', 'Save'), 'mod+s'),
    createFakeToggleButton(i18n.t('factory.button.bold', 'Bold'), false),
    createFakeRippleButton(),
    createFakeGradientButton(),
    createFakeBadgeButton(5),
    createFakeSkeletonButton(),
    createFakeLongPressButton(),
    createFakeConfirmButton(),
    createFakeTooltipButton(
      i18n.t('factory.button.clickToPerformAction', 'Click to perform action')
    ),
    createFakeSoundButton(),
    createFakeUndoableButton(),
    createFakeCTAButton(i18n.t('factory.button.getStartedFree', 'Get Started Free')),
    createFakeAccessibleButton(),
  ];
}

/** Create the ultimate enterprise button with all features */
export function createFakeUltimateEnterpriseButton(): FakeButton {
  return createFakeButton({
    label: i18n.t('factory.button.ultimateEnterpriseButton', 'Ultimate Enterprise Button'),
    variant: 'default',
    size: 'xl',
    fullWidth: true,
    state: 'idle',
    // Phase 1
    preventDoubleClick: true,
    debounceMs: 500,
    hapticFeedback: true,
    hapticPattern: [10],
    trackingId: 'ultimate-enterprise-button',
    trackingData: { version: 'phase2', experiment: 'showcase' },
    autoResetMs: 3000,
    // Phase 2
    shortcut: 'mod+enter',
    showShortcut: true,
    ripple: true,
    rippleColor: 'rgba(255,255,255,0.3)',
    respectReducedMotion: true,
    announceStateChanges: true,
    loadingAnnouncement: i18n.t('factory.button.processing', 'Processing...'),
    successAnnouncement: i18n.t('factory.button.success', 'Success!'),
    errorAnnouncement: i18n.t('factory.button.errorOccurred', 'Error occurred'),
    glow: true,
    gradient: { from: '#667eea', to: '#764ba2', direction: 'to-r' },
    soundEnabled: true,
    soundFrequency: 660,
    soundDuration: 50,
    badge: 'NEW',
    badgePosition: 'top-right',
    testId: 'ultimate-enterprise-button',
  });
}
