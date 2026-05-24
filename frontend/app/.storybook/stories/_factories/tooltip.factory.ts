import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Tooltip positioning side relative to trigger element
 */
export type TooltipSide = 'bottom' | 'left' | 'right' | 'top';

/**
 * Tooltip alignment along the side axis
 */
export type TooltipAlign = 'center' | 'end' | 'start';

/**
 * Tooltip theme/style variant
 */
export type TooltipVariant = 'default' | 'error' | 'info' | 'success' | 'warning';

/**
 * Tooltip delay preset categories
 */
export type TooltipDelayPreset = 'fast' | 'instant' | 'normal' | 'slow';

/**
 * Tooltip content type categories
 */
export type TooltipContentType =
  | 'description'
  | 'error'
  | 'help'
  | 'hint'
  | 'info'
  | 'label'
  | 'shortcut'
  | 'status'
  | 'validation';

/**
 * Tooltip trigger type
 */
export type TooltipTriggerType = 'button' | 'icon' | 'image' | 'link' | 'text';

/**
 * Tooltip arrow visibility
 */
export type TooltipArrowMode = 'always' | 'auto' | 'never';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * All available tooltip sides
 */
export const TOOLTIP_SIDES: TooltipSide[] = ['bottom', 'left', 'right', 'top'];

/**
 * All available tooltip alignments
 */
export const TOOLTIP_ALIGNS: TooltipAlign[] = ['center', 'end', 'start'];

/**
 * All available tooltip variants
 */
export const TOOLTIP_VARIANTS: TooltipVariant[] = [
  'default',
  'error',
  'info',
  'success',
  'warning',
];

/**
 * Delay presets with values in milliseconds
 */
export const TOOLTIP_DELAY_PRESETS: Record<TooltipDelayPreset, number> = {
  fast: 200,
  instant: 0,
  normal: 400,
  slow: 700,
};

/**
 * All tooltip content types
 */
export const TOOLTIP_CONTENT_TYPES: TooltipContentType[] = [
  'description',
  'error',
  'help',
  'hint',
  'info',
  'label',
  'shortcut',
  'status',
  'validation',
];

/**
 * All tooltip trigger types
 */
export const TOOLTIP_TRIGGER_TYPES: TooltipTriggerType[] = [
  'button',
  'icon',
  'image',
  'link',
  'text',
];

/**
 * Arrow modes
 */
export const TOOLTIP_ARROW_MODES: TooltipArrowMode[] = ['always', 'auto', 'never'];

/**
 * Common help tooltip messages
 */
export const HELP_TOOLTIP_MESSAGES = [
  i18n.t('factory.tooltip.clickToLearnMoreAbout', 'Click to learn more about this feature'),
  i18n.t('factory.tooltip.thisFieldIsRequiredFor', 'This field is required for form submission'),
  i18n.t('factory.tooltip.dragAndDropFilesHere', 'Drag and drop files here to upload'),
  i18n.t('factory.tooltip.pressEnterToConfirmYour', 'Press Enter to confirm your selection'),
  i18n.t('factory.tooltip.useArrowKeysToNavigate', 'Use arrow keys to navigate options'),
  i18n.t('factory.tooltip.doubleclickToEditThisItem', 'Double-click to edit this item'),
  i18n.t('factory.tooltip.rightclickForMoreOptions', 'Right-click for more options'),
  i18n.t('factory.tooltip.hoverOverItemsToSee', 'Hover over items to see details'),
];

/**
 * Common keyboard shortcut hints
 */
export const SHORTCUT_TOOLTIPS = [
  { action: i18n.t('factory.tooltip.bold', 'Bold'), shortcut: '⌘+B' },
  { action: i18n.t('factory.tooltip.copy', 'Copy'), shortcut: '⌘+C' },
  { action: i18n.t('factory.tooltip.cut', 'Cut'), shortcut: '⌘+X' },
  { action: i18n.t('factory.tooltip.delete', 'Delete'), shortcut: 'Delete' },
  { action: i18n.t('factory.tooltip.find', 'Find'), shortcut: '⌘+F' },
  { action: i18n.t('factory.tooltip.italic', 'Italic'), shortcut: '⌘+I' },
  { action: i18n.t('factory.tooltip.new', 'New'), shortcut: '⌘+N' },
  { action: i18n.t('factory.tooltip.open', 'Open'), shortcut: '⌘+O' },
  { action: i18n.t('factory.tooltip.paste', 'Paste'), shortcut: '⌘+V' },
  { action: i18n.t('factory.tooltip.redo', 'Redo'), shortcut: '⌘+Shift+Z' },
  { action: i18n.t('factory.tooltip.save', 'Save'), shortcut: '⌘+S' },
  { action: i18n.t('factory.tooltip.selectAll', 'Select All'), shortcut: '⌘+A' },
  { action: i18n.t('factory.tooltip.underline', 'Underline'), shortcut: '⌘+U' },
  { action: i18n.t('factory.tooltip.undo', 'Undo'), shortcut: '⌘+Z' },
];

/**
 * Validation error tooltip messages
 */
export const VALIDATION_ERROR_MESSAGES = [
  i18n.t('factory.tooltip.emailAddressIsInvalid', 'Email address is invalid'),
  i18n.t('factory.tooltip.thisFieldCannotBeEmpty', 'This field cannot be empty'),
  i18n.t('factory.tooltip.passwordMustBeAtLeast', 'Password must be at least 8 characters'),
  i18n.t('factory.tooltip.passwordsDoNotMatch', 'Passwords do not match'),
  i18n.t('factory.tooltip.pleaseEnterAValidPhone', 'Please enter a valid phone number'),
  i18n.t('factory.tooltip.pleaseSelectAtLeastOne', 'Please select at least one option'),
  i18n.t('factory.tooltip.thisUsernameIsAlreadyTaken', 'This username is already taken'),
  i18n.t('factory.tooltip.valueMustBeAPositive', 'Value must be a positive number'),
];

/**
 * Status tooltip messages
 */
export const STATUS_TOOLTIP_MESSAGES = [
  {
    message: i18n.t('factory.tooltip.availableForNewProjects', 'Available for new projects'),
    status: 'available',
  },
  {
    message: i18n.t(
      'factory.tooltip.operationCompletedSuccessfully',
      'Operation completed successfully'
    ),
    status: 'success',
  },
  {
    message: i18n.t('factory.tooltip.processingYourRequest', 'Processing your request...'),
    status: 'pending',
  },
  {
    message: i18n.t(
      'factory.tooltip.actionFailedPleaseTryAgain',
      'Action failed. Please try again.'
    ),
    status: 'error',
  },
  {
    message: i18n.t('factory.tooltip.limitedAvailability', 'Limited availability'),
    status: 'warning',
  },
  { message: i18n.t('factory.tooltip.currentlyOffline', 'Currently offline'), status: 'offline' },
  { message: i18n.t('factory.tooltip.syncingChanges', 'Syncing changes...'), status: 'syncing' },
];

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Base tooltip data structure
 */
export interface FakeTooltip {
  align: TooltipAlign;
  content: string;
  delayDuration: number;
  id: string;
  side: TooltipSide;
  sideOffset: number;
}

/**
 * Tooltip with variant styling
 */
export interface FakeTooltipWithVariant extends FakeTooltip {
  variant: TooltipVariant;
}

/**
 * Tooltip with trigger element configuration
 */
export interface FakeTooltipWithTrigger extends FakeTooltip {
  triggerAriaLabel: string;
  triggerDisabled: boolean;
  triggerLabel: string;
  triggerType: TooltipTriggerType;
}

/**
 * Help tooltip with contextual information
 */
export interface FakeHelpTooltip extends FakeTooltip {
  helpUrl?: string;
  iconName: string;
  learnMoreText?: string;
}

/**
 * Shortcut tooltip showing keyboard combinations
 */
export interface FakeShortcutTooltip extends FakeTooltip {
  action: string;
  platform: 'mac' | 'windows';
  shortcut: string;
}

/**
 * Validation error tooltip for form fields
 */
export interface FakeValidationTooltip extends FakeTooltip {
  errorType: string;
  fieldName: string;
  variant: 'error';
}

/**
 * Status tooltip showing state information
 */
export interface FakeStatusTooltip extends FakeTooltip {
  statusColor: string;
  statusIcon: string;
  statusType: string;
}

/**
 * Rich tooltip with additional content
 */
export interface FakeRichTooltip extends FakeTooltip {
  description?: string;
  imageUrl?: string;
  linkText?: string;
  linkUrl?: string;
  title: string;
}

/**
 * Tooltip configuration for forms
 */
export interface FakeFormTooltipConfig {
  errorTooltip: FakeValidationTooltip;
  fieldId: string;
  fieldLabel: string;
  helpTooltip: FakeHelpTooltip;
}

/**
 * Tooltip group for toolbar or action bar
 */
export interface FakeTooltipToolbar {
  id: string;
  name: string;
  tooltips: FakeShortcutTooltip[];
}

/**
 * Tooltip matrix for visual testing
 */
export interface FakeTooltipMatrix {
  combinations: Array<{
    align: TooltipAlign;
    content: string;
    side: TooltipSide;
  }>;
}

/**
 * Tooltip showcase collection
 */
export interface FakeTooltipShowcase {
  helpTooltips: FakeHelpTooltip[];
  richTooltips: FakeRichTooltip[];
  shortcutTooltips: FakeShortcutTooltip[];
  statusTooltips: FakeStatusTooltip[];
  validationTooltips: FakeValidationTooltip[];
}

// =============================================================================
// FACTORY FUNCTIONS - Basic
// =============================================================================

/**
 * Create a basic fake tooltip
 */
export function createFakeTooltip(overrides?: Partial<FakeTooltip>): FakeTooltip {
  return {
    align: faker.helpers.arrayElement(TOOLTIP_ALIGNS),
    content: faker.lorem.sentence({ max: 8, min: 3 }),
    delayDuration: faker.helpers.arrayElement(Object.values(TOOLTIP_DELAY_PRESETS)),
    id: faker.string.uuid(),
    side: faker.helpers.arrayElement(TOOLTIP_SIDES),
    sideOffset: faker.helpers.arrayElement([4, 6, 8, 10]),
    ...overrides,
  };
}

/**
 * Create multiple fake tooltips
 */
export function createFakeTooltips(count: number): FakeTooltip[] {
  return Array.from({ length: count }, () => createFakeTooltip());
}

/**
 * Create a tooltip with variant styling
 */
export function createFakeTooltipWithVariant(
  overrides?: Partial<FakeTooltipWithVariant>
): FakeTooltipWithVariant {
  return {
    ...createFakeTooltip(),
    variant: faker.helpers.arrayElement(TOOLTIP_VARIANTS),
    ...overrides,
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Trigger Configurations
// =============================================================================

/**
 * Create a tooltip with trigger element configuration
 */
export function createFakeTooltipWithTrigger(
  overrides?: Partial<FakeTooltipWithTrigger>
): FakeTooltipWithTrigger {
  const triggerType = faker.helpers.arrayElement(TOOLTIP_TRIGGER_TYPES);
  const triggerLabels: Record<TooltipTriggerType, string> = {
    button: faker.helpers.arrayElement([
      i18n.t('factory.tooltip.submit', 'Submit'),
      i18n.t('factory.tooltip.cancel', 'Cancel'),
      i18n.t('factory.tooltip.save', 'Save'),
      i18n.t('factory.tooltip.delete', 'Delete'),
      i18n.t('factory.tooltip.edit', 'Edit'),
    ]),
    icon: faker.helpers.arrayElement([
      i18n.t('factory.tooltip.settings', 'Settings'),
      i18n.t('factory.tooltip.help', 'Help'),
      i18n.t('factory.tooltip.info', 'Info'),
      i18n.t('factory.tooltip.close', 'Close'),
      i18n.t('factory.tooltip.menu', 'Menu'),
    ]),
    image: faker.helpers.arrayElement([
      i18n.t('factory.tooltip.profilePhoto', 'Profile photo'),
      i18n.t('factory.tooltip.productImage', 'Product image'),
      i18n.t('factory.tooltip.thumbnail', 'Thumbnail'),
      i18n.t('factory.tooltip.avatar', 'Avatar'),
    ]),
    link: faker.helpers.arrayElement([
      i18n.t('factory.tooltip.learnMore', 'Learn more'),
      i18n.t('factory.tooltip.viewDetails', 'View details'),
      i18n.t('factory.tooltip.readDocumentation', 'Read documentation'),
      i18n.t('factory.tooltip.visitWebsite', 'Visit website'),
    ]),
    text: faker.helpers.arrayElement([
      i18n.t('factory.tooltip.highlightedTerm', 'Highlighted term'),
      i18n.t('factory.tooltip.definition', 'Definition'),
      i18n.t('factory.tooltip.abbreviation', 'Abbreviation'),
      i18n.t('factory.tooltip.reference', 'Reference'),
    ]),
  };

  return {
    ...createFakeTooltip(),
    triggerAriaLabel: i18n.t('factory.tooltip.triggerAriaLabel', '{{label}} tooltip', {
      label: triggerLabels[triggerType],
    }),
    triggerDisabled: faker.datatype.boolean({ probability: 0.1 }),
    triggerLabel: triggerLabels[triggerType],
    triggerType,
    ...overrides,
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Specialized Tooltips
// =============================================================================

/**
 * Create a help tooltip with contextual information
 */
export function createFakeHelpTooltip(overrides?: Partial<FakeHelpTooltip>): FakeHelpTooltip {
  return {
    ...createFakeTooltip({
      content: faker.helpers.arrayElement(HELP_TOOLTIP_MESSAGES),
    }),
    helpUrl: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.3 }),
    iconName: faker.helpers.arrayElement([
      'HelpCircle',
      i18n.t('factory.tooltip.info', 'Info'),
      'QuestionMarkCircle',
      i18n.t('factory.tooltip.lightbulb', 'Lightbulb'),
    ]),
    learnMoreText: faker.helpers.maybe(() => i18n.t('factory.tooltip.learnMore', 'Learn more'), {
      probability: 0.4,
    }),
    ...overrides,
  };
}

/**
 * Create multiple help tooltips
 */
export function createFakeHelpTooltips(count: number): FakeHelpTooltip[] {
  return Array.from({ length: count }, () => createFakeHelpTooltip());
}

/**
 * Create a keyboard shortcut tooltip
 */
export function createFakeShortcutTooltip(
  overrides?: Partial<FakeShortcutTooltip>
): FakeShortcutTooltip {
  const shortcutData = faker.helpers.arrayElement(SHORTCUT_TOOLTIPS);
  const platform = faker.helpers.arrayElement(['mac', 'windows']) as 'mac' | 'windows';
  const shortcut =
    platform === 'windows' ? shortcutData.shortcut.replace('⌘', 'Ctrl') : shortcutData.shortcut;

  return {
    ...createFakeTooltip({
      content: i18n.t('factory.tooltip.actionShortcut', '{{action}} ({{shortcut}})', {
        action: shortcutData.action,
        shortcut,
      }),
    }),
    action: shortcutData.action,
    platform,
    shortcut,
    ...overrides,
  };
}

/**
 * Create multiple shortcut tooltips
 */
export function createFakeShortcutTooltips(count: number): FakeShortcutTooltip[] {
  return SHORTCUT_TOOLTIPS.slice(0, count).map((shortcutData) =>
    createFakeShortcutTooltip({
      action: shortcutData.action,
      content: i18n.t('factory.tooltip.actionShortcut', '{{action}} ({{shortcut}})', {
        action: shortcutData.action,
        shortcut: shortcutData.shortcut,
      }),
      shortcut: shortcutData.shortcut,
    })
  );
}

/**
 * Create a validation error tooltip
 */
export function createFakeValidationTooltip(
  overrides?: Partial<FakeValidationTooltip>
): FakeValidationTooltip {
  const errorMessage = faker.helpers.arrayElement(VALIDATION_ERROR_MESSAGES);

  return {
    ...createFakeTooltip({
      content: errorMessage,
      side: 'right',
    }),
    errorType: faker.helpers.arrayElement(['required', 'format', 'length', 'match', 'unique']),
    fieldName: faker.helpers.arrayElement(['email', 'password', 'username', 'phone', 'name']),
    variant: 'error',
    ...overrides,
  };
}

/**
 * Create multiple validation tooltips
 */
export function createFakeValidationTooltips(count: number): FakeValidationTooltip[] {
  return Array.from({ length: count }, () => createFakeValidationTooltip());
}

/**
 * Create a status tooltip
 */
export function createFakeStatusTooltip(overrides?: Partial<FakeStatusTooltip>): FakeStatusTooltip {
  const statusData = faker.helpers.arrayElement(STATUS_TOOLTIP_MESSAGES);
  const statusColors: Record<string, string> = {
    available: 'green',
    error: 'red',
    offline: 'gray',
    pending: 'yellow',
    success: 'green',
    syncing: 'blue',
    warning: 'orange',
  };
  const statusIcons: Record<string, string> = {
    available: 'CheckCircle',
    error: 'XCircle',
    offline: 'WifiOff',
    pending: i18n.t('factory.tooltip.clock', 'Clock'),
    success: i18n.t('factory.tooltip.check', 'Check'),
    syncing: 'RefreshCw',
    warning: 'AlertTriangle',
  };

  return {
    ...createFakeTooltip({
      content: statusData.message,
    }),
    statusColor: statusColors[statusData.status] || 'gray',
    statusIcon: statusIcons[statusData.status] || i18n.t('factory.tooltip.circle', 'Circle'),
    statusType: statusData.status,
    ...overrides,
  };
}

/**
 * Create multiple status tooltips
 */
export function createFakeStatusTooltips(count: number): FakeStatusTooltip[] {
  return Array.from({ length: count }, () => createFakeStatusTooltip());
}

/**
 * Create a rich tooltip with additional content
 */
export function createFakeRichTooltip(overrides?: Partial<FakeRichTooltip>): FakeRichTooltip {
  return {
    ...createFakeTooltip(),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.7 }),
    imageUrl: faker.helpers.maybe(() => faker.image.url({ height: 80, width: 120 }), {
      probability: 0.3,
    }),
    linkText: faker.helpers.maybe(() => i18n.t('factory.tooltip.learnMore', 'Learn more'), {
      probability: 0.5,
    }),
    linkUrl: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.5 }),
    title: faker.lorem.words({ max: 4, min: 2 }),
    ...overrides,
  };
}

/**
 * Create multiple rich tooltips
 */
export function createFakeRichTooltips(count: number): FakeRichTooltip[] {
  return Array.from({ length: count }, () => createFakeRichTooltip());
}

// =============================================================================
// FACTORY FUNCTIONS - Form Integration
// =============================================================================

/**
 * Create a form tooltip configuration
 */
export function createFakeFormTooltipConfig(
  overrides?: Partial<FakeFormTooltipConfig>
): FakeFormTooltipConfig {
  const fieldNames = ['email', 'password', 'username', 'phone', 'address'];
  const fieldName = faker.helpers.arrayElement(fieldNames);

  return {
    errorTooltip: createFakeValidationTooltip({ fieldName }),
    fieldId: `field-${faker.string.alphanumeric(8)}`,
    fieldLabel: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
    helpTooltip: createFakeHelpTooltip(),
    ...overrides,
  };
}

/**
 * Create multiple form tooltip configurations
 */
export function createFakeFormTooltipConfigs(count: number): FakeFormTooltipConfig[] {
  return Array.from({ length: count }, () => createFakeFormTooltipConfig());
}

// =============================================================================
// FACTORY FUNCTIONS - Toolbar Integration
// =============================================================================

/**
 * Create a tooltip toolbar configuration
 */
export function createFakeTooltipToolbar(
  overrides?: Partial<FakeTooltipToolbar>
): FakeTooltipToolbar {
  const toolbarTypes = [
    {
      name: i18n.t('factory.tooltip.textFormatting', 'Text Formatting'),
      shortcuts: ['Bold', 'Italic', 'Underline'],
    },
    {
      name: i18n.t('factory.tooltip.fileOperations', 'File Operations'),
      shortcuts: ['Save', 'Open', 'New'],
    },
    {
      name: i18n.t('factory.tooltip.editActions', 'Edit Actions'),
      shortcuts: ['Undo', 'Redo', 'Cut', 'Copy', 'Paste'],
    },
    { name: i18n.t('factory.tooltip.selection', 'Selection'), shortcuts: ['Select All', 'Find'] },
  ];

  const toolbarType = faker.helpers.arrayElement(toolbarTypes);

  return {
    id: faker.string.uuid(),
    name: toolbarType.name,
    tooltips: toolbarType.shortcuts.map((action) => {
      const shortcutData = SHORTCUT_TOOLTIPS.find((s) => s.action === action);
      return createFakeShortcutTooltip({
        action,
        content: i18n.t('factory.tooltip.actionShortcut', '{{action}} ({{shortcut}})', {
          action,
          shortcut: shortcutData?.shortcut || '⌘+?',
        }),
        shortcut: shortcutData?.shortcut || '⌘+?',
      });
    }),
    ...overrides,
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Matrix & Visual Testing
// =============================================================================

/**
 * Create a tooltip matrix for visual testing (all side/align combinations)
 */
export function createFakeTooltipMatrix(): FakeTooltipMatrix {
  const combinations: FakeTooltipMatrix['combinations'] = [];

  for (const side of TOOLTIP_SIDES) {
    for (const align of TOOLTIP_ALIGNS) {
      combinations.push({
        align,
        content: i18n.t('factory.tooltip.sideAlignLabel', '{{side}} / {{align}}', { side, align }),
        side,
      });
    }
  }

  return { combinations };
}

/**
 * Create a tooltip variant matrix
 */
export function createFakeTooltipVariantMatrix(): FakeTooltipWithVariant[] {
  return TOOLTIP_VARIANTS.map((variant) => {
    const capitalizedVariant = variant.charAt(0).toUpperCase() + variant.slice(1);
    return createFakeTooltipWithVariant({
      content: i18n.t('factory.tooltip.variantTooltip', '{{variant}} tooltip', {
        variant: capitalizedVariant,
      }),
      variant,
    });
  });
}

/**
 * Create a tooltip delay matrix
 */
export function createFakeTooltipDelayMatrix(): Array<{ preset: string } & FakeTooltip> {
  return Object.entries(TOOLTIP_DELAY_PRESETS).map(([preset, delayDuration]) => ({
    ...createFakeTooltip({ delayDuration }),
    preset,
  }));
}

// =============================================================================
// FACTORY FUNCTIONS - Showcase
// =============================================================================

/**
 * Create a comprehensive tooltip showcase
 */
export function createFakeTooltipShowcase(): FakeTooltipShowcase {
  return {
    helpTooltips: createFakeHelpTooltips(4),
    richTooltips: createFakeRichTooltips(3),
    shortcutTooltips: createFakeShortcutTooltips(6),
    statusTooltips: createFakeStatusTooltips(4),
    validationTooltips: createFakeValidationTooltips(3),
  };
}

/**
 * Create tooltips for all positions (for position demo)
 */
export function createFakePositionTooltips(): FakeTooltip[] {
  return TOOLTIP_SIDES.map((side) =>
    createFakeTooltip({
      content: i18n.t('factory.tooltip.tooltipOnSide', 'Tooltip on {{side}}', { side }),
      side,
    })
  );
}

/**
 * Create tooltips with all trigger types
 */
export function createFakeTriggerTypeTooltips(): FakeTooltipWithTrigger[] {
  return TOOLTIP_TRIGGER_TYPES.map((triggerType) =>
    createFakeTooltipWithTrigger({
      content: i18n.t('factory.tooltip.triggeredBy', 'Triggered by {{triggerType}}', {
        triggerType,
      }),
      triggerType,
    })
  );
}

// =============================================================================
// FACTORY FUNCTIONS - Specific Use Cases
// =============================================================================

/**
 * Create a tooltip for icon button
 */
export function createFakeIconButtonTooltip(_iconName: string, action: string): FakeTooltip {
  return createFakeTooltip({
    content: action,
    delayDuration: TOOLTIP_DELAY_PRESETS.fast,
    side: 'bottom',
  });
}

/**
 * Create a tooltip for truncated text
 */
export function createFakeTruncatedTextTooltip(fullText: string): FakeTooltip {
  return createFakeTooltip({
    content: fullText,
    delayDuration: TOOLTIP_DELAY_PRESETS.normal,
    side: 'top',
  });
}

/**
 * Create a tooltip for disabled element
 */
export function createFakeDisabledTooltip(reason: string): FakeTooltip {
  return createFakeTooltip({
    content: reason,
    delayDuration: TOOLTIP_DELAY_PRESETS.instant,
    side: 'top',
  });
}

/**
 * Create a tooltip for image preview
 */
export function createFakeImagePreviewTooltip(imageUrl: string, imageAlt: string): FakeRichTooltip {
  return createFakeRichTooltip({
    description: imageAlt,
    imageUrl,
    title: i18n.t('factory.tooltip.imagePreview', 'Image Preview'),
  });
}

/**
 * Create a tooltip for user avatar
 */
export function createFakeAvatarTooltip(userName: string, status?: string): FakeTooltip {
  const content = status
    ? i18n.t('factory.tooltip.userNameStatus', '{{userName}} - {{status}}', { userName, status })
    : userName;
  return createFakeTooltip({
    content,
    delayDuration: TOOLTIP_DELAY_PRESETS.fast,
    side: 'top',
  });
}

/**
 * Create tooltip for navigation item
 */
export function createFakeNavTooltip(navLabel: string, shortcut?: string): FakeTooltip {
  const content = shortcut
    ? i18n.t('factory.tooltip.navLabelShortcut', '{{navLabel}} ({{shortcut}})', {
        navLabel,
        shortcut,
      })
    : navLabel;
  return createFakeTooltip({
    content,
    delayDuration: TOOLTIP_DELAY_PRESETS.normal,
    side: 'right',
  });
}
