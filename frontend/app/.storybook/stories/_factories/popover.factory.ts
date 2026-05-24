import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// POPOVER FACTORY
// ============================================================================
// Comprehensive test data factories for the Popover component.
// Follows the Button factory pattern with type exports, constants, and
// specialized factories for different popover configurations.
// ============================================================================

// ============================================================================
// SHARED STRING CONSTANTS
// ============================================================================

const LABEL_SETTINGS = i18n.t('factory.popover.settings', 'Settings');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Popover content alignment options
 * @description Controls horizontal alignment relative to trigger
 */
export type PopoverAlign = 'center' | 'end' | 'start';

/**
 * Popover side/position options
 * @description Controls which side the popover appears on
 */
export type PopoverSide = 'bottom' | 'left' | 'right' | 'top';

/**
 * Popover trigger type
 * @description The type of trigger element
 */
export type PopoverTriggerType = 'button' | 'icon' | 'link' | 'text';

/**
 * Popover content type
 * @description The type of content displayed in the popover
 */
export type PopoverContentType =
  | 'custom'
  | 'form'
  | 'info'
  | 'list'
  | 'menu'
  | 'profile'
  | 'settings';

/**
 * Popover state
 * @description The current state of the popover
 */
export type PopoverState = 'closed' | 'closing' | 'open' | 'opening';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All alignment options
 */
export const POPOVER_ALIGNS: PopoverAlign[] = ['start', 'center', 'end'];

/**
 * All side/position options
 */
export const POPOVER_SIDES: PopoverSide[] = ['top', 'right', 'bottom', 'left'];

/**
 * All trigger types
 */
export const POPOVER_TRIGGER_TYPES: PopoverTriggerType[] = ['button', 'icon', 'text', 'link'];

/**
 * All content types
 */
export const POPOVER_CONTENT_TYPES: PopoverContentType[] = [
  'info',
  'form',
  'menu',
  'list',
  'profile',
  'settings',
  'custom',
];

/**
 * All popover states
 */
export const POPOVER_STATES: PopoverState[] = ['closed', 'opening', 'open', 'closing'];

/**
 * Common side offset values
 */
export const SIDE_OFFSET_OPTIONS = [0, 4, 8, 12, 16];

/**
 * Common align offset values
 */
export const ALIGN_OFFSET_OPTIONS = [-8, -4, 0, 4, 8];

/**
 * Common popover widths
 */
export const POPOVER_WIDTH_OPTIONS = [200, 250, 300, 350, 400, 'auto'];

/**
 * Common trigger labels
 */
const TRIGGER_LABELS = [
  i18n.t('factory.popover.openSettings', 'Open Settings'),
  i18n.t('factory.popover.moreOptions', 'More Options'),
  i18n.t('factory.popover.viewDetails', 'View Details'),
  i18n.t('factory.popover.edit', 'Edit'),
  i18n.t('factory.popover.share', 'Share'),
  i18n.t('factory.popover.help', 'Help'),
  i18n.t('factory.popover.info', 'Info'),
  i18n.t('factory.popover.actions', 'Actions'),
  i18n.t('factory.popover.menu', 'Menu'),
  i18n.t('factory.popover.profile', 'Profile'),
];

/**
 * Common info popover titles
 */
const INFO_TITLES = [
  i18n.t('factory.popover.whatIsThis', 'What is this?'),
  i18n.t('factory.popover.featureInfo', 'Feature Info'),
  i18n.t('factory.popover.help', 'Help'),
  i18n.t('factory.popover.about', 'About'),
  i18n.t('factory.popover.details', 'Details'),
  i18n.t('factory.popover.quickTip', 'Quick Tip'),
  i18n.t('factory.popover.didYouKnow', 'Did you know?'),
  i18n.t('factory.popover.important', 'Important'),
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Popover trigger configuration
 */
export interface FakePopoverTrigger {
  /** Trigger element aria-label */
  ariaLabel?: string;
  /** Whether trigger is disabled */
  disabled?: boolean;
  /** Icon name for icon triggers */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Trigger display label */
  label: string;
  /** Trigger type */
  type: PopoverTriggerType;
}

/**
 * Form field within popover
 */
export interface FakePopoverFormField {
  /** Default value */
  defaultValue?: string;
  /** Unique identifier */
  id: string;
  /** Field label */
  label: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether field is required */
  required?: boolean;
  /** Field type */
  type: 'checkbox' | 'email' | 'number' | 'select' | 'text' | 'textarea';
}

/**
 * List item within popover
 */
export interface FakePopoverListItem {
  /** Description text */
  description?: string;
  /** Whether item is disabled */
  disabled?: boolean;
  /** Target URL for links */
  href?: string;
  /** Icon name */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Item label */
  label: string;
  /** Whether item is selected */
  selected?: boolean;
}

/**
 * Popover content configuration
 */
export interface FakePopoverContent {
  /** Submit button label (for forms) */
  buttonLabel?: string;
  /** Description text */
  description?: string;
  /** Form fields */
  fields?: FakePopoverFormField[];
  /** Unique identifier */
  id: string;
  /** List items */
  items?: FakePopoverListItem[];
  /** Content title */
  title?: string;
  /** Content type */
  type: PopoverContentType;
  /** Content width in pixels or 'auto' */
  width?: 'auto' | number;
}

/**
 * Complete popover configuration
 */
export interface FakePopover {
  /** Horizontal alignment */
  align: PopoverAlign;
  /** Alignment offset */
  alignOffset?: number;
  /** Whether popover closes on outside click */
  closeOnOutsideClick?: boolean;
  /** Content configuration */
  content: FakePopoverContent;
  /** Whether popover is open by default */
  defaultOpen?: boolean;
  /** Unique identifier */
  id: string;
  /** Whether popover uses modal mode */
  modal?: boolean;
  /** Side to display on */
  side: PopoverSide;
  /** Side offset in pixels */
  sideOffset?: number;
  /** Current state */
  state: PopoverState;
  /** Trigger configuration */
  trigger: FakePopoverTrigger;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get icon for trigger type
 */
function getIconForTriggerType(type: PopoverTriggerType): string {
  if (type === 'icon') return faker.helpers.arrayElement(['info', 'settings', 'more-horizontal']);
  return 'chevron-down';
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake popover trigger
 * @param overrides - Optional property overrides
 * @returns A fake popover trigger
 */
export function createFakePopoverTrigger(
  overrides?: Partial<FakePopoverTrigger>
): FakePopoverTrigger {
  const type = overrides?.type ?? faker.helpers.arrayElement(POPOVER_TRIGGER_TYPES);

  return {
    id: faker.string.uuid(),
    type,
    label: faker.helpers.arrayElement(TRIGGER_LABELS),
    icon: type === 'icon' ? getIconForTriggerType(type) : undefined,
    disabled: faker.datatype.boolean({ probability: 0.05 }),
    ariaLabel: faker.helpers.maybe(
      () => i18n.t('factory.popover.openLabel', 'Open {{label}}', { label: faker.lorem.words(2) }),
      { probability: 0.5 }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake form field for popover
 * @param overrides - Optional property overrides
 * @returns A fake form field
 */
export function createFakePopoverFormField(
  overrides?: Partial<FakePopoverFormField>
): FakePopoverFormField {
  const fieldType =
    overrides?.type ?? faker.helpers.arrayElement(['text', 'email', 'number', 'select']);
  const label =
    overrides?.label ??
    faker.helpers.arrayElement([
      i18n.t('factory.popover.name', 'Name'),
      i18n.t('factory.popover.email', 'Email'),
      i18n.t('factory.popover.width', 'Width'),
      i18n.t('factory.popover.height', 'Height'),
      i18n.t('factory.popover.count', 'Count'),
      i18n.t('factory.popover.description', 'Description'),
    ]);

  return {
    id: faker.string.uuid(),
    type: fieldType as FakePopoverFormField['type'],
    label,
    placeholder: faker.helpers.maybe(
      () =>
        i18n.t('factory.popover.enterPlaceholder', 'Enter {{label}}', {
          label: label.toLowerCase(),
        }),
      { probability: 0.7 }
    ),
    defaultValue: faker.helpers.maybe(
      () => {
        if (fieldType === 'number') return String(faker.number.int({ min: 1, max: 100 }));
        if (fieldType === 'email') return faker.internet.email();
        return faker.lorem.word();
      },
      { probability: 0.4 }
    ),
    required: faker.datatype.boolean({ probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake form fields
 * @param count - Number of fields to create
 * @param overrides - Optional property overrides
 * @returns Array of fake form fields
 */
export function createFakePopoverFormFields(
  count: number,
  overrides?: Partial<FakePopoverFormField>
): FakePopoverFormField[] {
  return Array.from({ length: count }, () => createFakePopoverFormField(overrides));
}

/**
 * Creates a fake list item for popover
 * @param overrides - Optional property overrides
 * @returns A fake list item
 */
export function createFakePopoverListItem(
  overrides?: Partial<FakePopoverListItem>
): FakePopoverListItem {
  return {
    id: faker.string.uuid(),
    label: faker.lorem.words(2),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 }),
    icon: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['check', 'star', 'heart', 'bookmark', 'flag']),
      { probability: 0.5 }
    ),
    href: faker.helpers.maybe(() => `/${faker.lorem.slug()}`, { probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.05 }),
    selected: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake list items
 * @param count - Number of items to create
 * @param overrides - Optional property overrides
 * @returns Array of fake list items
 */
export function createFakePopoverListItems(
  count: number,
  overrides?: Partial<FakePopoverListItem>
): FakePopoverListItem[] {
  return Array.from({ length: count }, () => createFakePopoverListItem(overrides));
}

/**
 * Creates fake popover content
 * @param type - Content type
 * @param overrides - Optional property overrides
 * @returns A fake popover content configuration
 */
export function createFakePopoverContent(
  type: PopoverContentType = 'info',
  overrides?: Partial<FakePopoverContent>
): FakePopoverContent {
  const baseContent: FakePopoverContent = {
    id: faker.string.uuid(),
    type,
    title: faker.helpers.maybe(() => faker.helpers.arrayElement(INFO_TITLES), {
      probability: 0.8,
    }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.7 }),
    width: faker.helpers.arrayElement([250, 300, 350, 'auto']),
    ...overrides,
  };

  // Add type-specific content
  if (type === 'form') {
    return {
      ...baseContent,
      fields: createFakePopoverFormFields(faker.number.int({ min: 2, max: 4 })),
      buttonLabel: faker.helpers.arrayElement([
        i18n.t('factory.popover.save', 'Save'),
        i18n.t('factory.popover.submit', 'Submit'),
        i18n.t('factory.popover.apply', 'Apply'),
        i18n.t('factory.popover.update', 'Update'),
      ]),
    };
  }

  if (type === 'list' || type === 'menu') {
    return {
      ...baseContent,
      items: createFakePopoverListItems(faker.number.int({ min: 3, max: 6 })),
    };
  }

  if (type === 'profile') {
    return {
      ...baseContent,
      title: faker.person.fullName(),
      description: faker.person.jobTitle(),
    };
  }

  if (type === 'settings') {
    return {
      ...baseContent,
      title: LABEL_SETTINGS,
      fields: createFakePopoverFormFields(3),
      buttonLabel: i18n.t('factory.popover.saveSettings', 'Save Settings'),
    };
  }

  return baseContent;
}

/**
 * Creates a complete fake popover configuration
 * @param overrides - Optional property overrides
 * @returns A fake popover configuration
 */
export function createFakePopover(overrides?: Partial<FakePopover>): FakePopover {
  const contentType = faker.helpers.arrayElement(POPOVER_CONTENT_TYPES);

  return {
    id: faker.string.uuid(),
    trigger: createFakePopoverTrigger(),
    content: createFakePopoverContent(contentType),
    side: faker.helpers.arrayElement(POPOVER_SIDES),
    align: faker.helpers.arrayElement(POPOVER_ALIGNS),
    sideOffset: faker.helpers.arrayElement(SIDE_OFFSET_OPTIONS),
    alignOffset: faker.helpers.maybe(() => faker.helpers.arrayElement(ALIGN_OFFSET_OPTIONS), {
      probability: 0.3,
    }),
    state: 'closed',
    defaultOpen: faker.datatype.boolean({ probability: 0.1 }),
    modal: faker.datatype.boolean({ probability: 0.2 }),
    closeOnOutsideClick: faker.datatype.boolean({ probability: 0.9 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake popover configurations
 * @param count - Number of popovers to create
 * @param overrides - Optional property overrides
 * @returns Array of fake popover configurations
 */
export function createFakePopovers(count: number, overrides?: Partial<FakePopover>): FakePopover[] {
  return Array.from({ length: count }, () => createFakePopover(overrides));
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates an info/tooltip style popover
 * @returns An info popover configuration
 */
export function createFakeInfoPopover(): FakePopover {
  return createFakePopover({
    trigger: createFakePopoverTrigger({
      type: 'icon',
      label: i18n.t('factory.popover.info', 'Info'),
      icon: 'info',
    }),
    content: createFakePopoverContent('info', {
      title: faker.helpers.arrayElement(INFO_TITLES),
      description: faker.lorem.sentences(2),
      width: 250,
    }),
    side: 'top',
    align: 'center',
  });
}

/**
 * Creates a form popover (like settings/edit)
 * @param fieldCount - Number of form fields
 * @returns A form popover configuration
 */
export function createFakeFormPopover(fieldCount: number = 3): FakePopover {
  return createFakePopover({
    trigger: createFakePopoverTrigger({
      type: 'button',
      label: i18n.t('factory.popover.editSettings', 'Edit Settings'),
    }),
    content: createFakePopoverContent('form', {
      title: LABEL_SETTINGS,
      description: i18n.t('factory.popover.configureYourPreferences', 'Configure your preferences'),
      fields: createFakePopoverFormFields(fieldCount),
      buttonLabel: i18n.t('factory.popover.save', 'Save'),
      width: 300,
    }),
    side: 'bottom',
    align: 'start',
  });
}

/**
 * Creates a menu/dropdown style popover
 * @param itemCount - Number of menu items
 * @returns A menu popover configuration
 */
export function createFakeMenuPopover(itemCount: number = 5): FakePopover {
  return createFakePopover({
    trigger: createFakePopoverTrigger({
      type: 'button',
      label: i18n.t('factory.popover.actions', 'Actions'),
      icon: 'more-horizontal',
    }),
    content: createFakePopoverContent('menu', {
      items: createFakePopoverListItems(itemCount),
      width: 200,
    }),
    side: 'bottom',
    align: 'end',
  });
}

/**
 * Creates a profile card popover
 * @returns A profile popover configuration
 */
export function createFakeProfilePopover(): FakePopover {
  return createFakePopover({
    trigger: createFakePopoverTrigger({
      type: 'icon',
      label: faker.person.firstName(),
      icon: 'user',
    }),
    content: {
      id: faker.string.uuid(),
      type: 'profile',
      title: faker.person.fullName(),
      description: faker.person.jobTitle(),
      width: 280,
    },
    side: 'bottom',
    align: 'start',
  });
}

/**
 * Creates a settings popover
 * @returns A settings popover configuration
 */
export function createFakeSettingsPopover(): FakePopover {
  return createFakePopover({
    trigger: createFakePopoverTrigger({
      type: 'icon',
      label: LABEL_SETTINGS,
      icon: 'settings',
    }),
    content: createFakePopoverContent('settings'),
    side: 'bottom',
    align: 'end',
  });
}

/**
 * Creates a controlled popover (for testing open states)
 * @param isOpen - Whether popover is open
 * @returns A controlled popover configuration
 */
export function createFakeControlledPopover(isOpen: boolean = false): FakePopover {
  return createFakePopover({
    state: isOpen ? 'open' : 'closed',
    defaultOpen: isOpen,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of popovers across all sides
 * @returns Grid of popover configs for each side
 */
export function createPopoverSideMatrix(): FakePopover[] {
  return POPOVER_SIDES.map((side) =>
    createFakePopover({
      side,
      trigger: createFakePopoverTrigger({
        label: i18n.t('factory.popover.sideLabel', 'Side: {{side}}', { side }),
      }),
    })
  );
}

/**
 * Creates a matrix of popovers across all alignments
 * @returns Grid of popover configs for each alignment
 */
export function createPopoverAlignMatrix(): FakePopover[] {
  return POPOVER_ALIGNS.map((align) =>
    createFakePopover({
      align,
      trigger: createFakePopoverTrigger({
        label: i18n.t('factory.popover.alignLabel', 'Align: {{align}}', { align }),
      }),
    })
  );
}

/**
 * Creates a matrix of popovers across content types
 * @returns Grid of popover configs for each content type
 */
export function createPopoverContentTypeMatrix(): FakePopover[] {
  return POPOVER_CONTENT_TYPES.map((type) =>
    createFakePopover({
      content: createFakePopoverContent(type),
      trigger: createFakePopoverTrigger({
        label: i18n.t('factory.popover.typeLabel', 'Type: {{type}}', { type }),
      }),
    })
  );
}

/**
 * Creates a matrix of popovers across trigger types
 * @returns Grid of popover configs for each trigger type
 */
export function createPopoverTriggerTypeMatrix(): FakePopover[] {
  return POPOVER_TRIGGER_TYPES.map((type) =>
    createFakePopover({
      trigger: createFakePopoverTrigger({ type }),
    })
  );
}

/**
 * Creates a full position matrix (side x align)
 * @returns Grid of all position combinations
 */
export function createPopoverPositionMatrix(): FakePopover[] {
  const popovers: FakePopover[] = [];

  for (const side of POPOVER_SIDES) {
    for (const align of POPOVER_ALIGNS) {
      popovers.push(
        createFakePopover({
          side,
          align,
          trigger: createFakePopoverTrigger({
            label: i18n.t('factory.popover.sideAlignLabel', '{{side}}-{{align}}', { side, align }),
          }),
        })
      );
    }
  }

  return popovers;
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all popover configurations
 * @returns Array of popover configs for showcase
 */
export function createPopoverShowcase(): Array<{
  description: string;
  name: string;
  popover: FakePopover;
}> {
  return [
    {
      name: i18n.t('factory.popover.infoPopover', 'Info Popover'),
      description: i18n.t(
        'factory.popover.simpleInformationalTooltipstylePopover',
        'Simple informational tooltip-style popover'
      ),
      popover: createFakeInfoPopover(),
    },
    {
      name: i18n.t('factory.popover.formPopover', 'Form Popover'),
      description: i18n.t(
        'factory.popover.popoverWithFormInputsFor',
        'Popover with form inputs for quick editing'
      ),
      popover: createFakeFormPopover(),
    },
    {
      name: i18n.t('factory.popover.menuPopover', 'Menu Popover'),
      description: i18n.t(
        'factory.popover.dropdownMenuStylePopoverWith',
        'Dropdown menu style popover with actions'
      ),
      popover: createFakeMenuPopover(),
    },
    {
      name: i18n.t('factory.popover.profileCard', 'Profile Card'),
      description: i18n.t(
        'factory.popover.userProfilePreviewPopover',
        'User profile preview popover'
      ),
      popover: createFakeProfilePopover(),
    },
    {
      name: LABEL_SETTINGS,
      description: i18n.t(
        'factory.popover.quickSettingsPanelPopover',
        'Quick settings panel popover'
      ),
      popover: createFakeSettingsPopover(),
    },
    {
      name: i18n.t('factory.popover.controlledOpen', 'Controlled Open'),
      description: i18n.t(
        'factory.popover.demonstratingControlledOpenState',
        'Demonstrating controlled open state'
      ),
      popover: createFakeControlledPopover(true),
    },
  ];
}

/**
 * Creates a complete test data set for popover testing
 * @returns Comprehensive test data
 */
export function createPopoverTestData(): {
  alignMatrix: FakePopover[];
  contentTypeMatrix: FakePopover[];
  formFields: FakePopoverFormField[];
  listItems: FakePopoverListItem[];
  popovers: FakePopover[];
  positionMatrix: FakePopover[];
  showcase: Array<{ description: string; name: string; popover: FakePopover }>;
  sideMatrix: FakePopover[];
  triggers: FakePopoverTrigger[];
  triggerTypeMatrix: FakePopover[];
} {
  return {
    popovers: createFakePopovers(5),
    triggers: Array.from({ length: 5 }, () => createFakePopoverTrigger()),
    formFields: createFakePopoverFormFields(5),
    listItems: createFakePopoverListItems(5),
    sideMatrix: createPopoverSideMatrix(),
    alignMatrix: createPopoverAlignMatrix(),
    contentTypeMatrix: createPopoverContentTypeMatrix(),
    triggerTypeMatrix: createPopoverTriggerTypeMatrix(),
    positionMatrix: createPopoverPositionMatrix(),
    showcase: createPopoverShowcase(),
  };
}

// ============================================================================
// ENTERPRISE FEATURE FACTORIES
// ============================================================================

/**
 * Popover analytics tracking data
 */
export interface PopoverTrackingData {
  campaign?: string;
  popoverId: string;
  source: string;
  timestamp: number;
  variant?: string;
}

/**
 * Popover with tracking/analytics
 */
export interface FakeTrackedPopover extends FakePopover {
  trackingData: PopoverTrackingData;
  trackingId: string;
}

/**
 * Creates a popover with analytics tracking
 * @param overrides - Optional property overrides
 * @returns A tracked popover configuration
 */
export function createFakeTrackedPopover(
  overrides?: Partial<FakeTrackedPopover>
): FakeTrackedPopover {
  const base = createFakePopover(overrides);
  const trackingId = `popover-${faker.string.alphanumeric(8)}`;

  return {
    ...base,
    trackingId,
    trackingData: {
      popoverId: trackingId,
      source: faker.helpers.arrayElement(['header', 'sidebar', 'footer', 'modal', 'inline']),
      timestamp: Date.now(),
      campaign: faker.helpers.maybe(() => faker.string.alphanumeric(6), { probability: 0.5 }),
      variant: faker.helpers.maybe(() => faker.helpers.arrayElement(['a', 'b', 'control']), {
        probability: 0.3,
      }),
    },
    ...overrides,
  };
}

/**
 * Creates a popover for onboarding/tutorial flows
 * @param step - Current step number
 * @param totalSteps - Total number of steps
 * @returns An onboarding popover configuration
 */
export function createFakeOnboardingPopover(step: number = 1, totalSteps: number = 5): FakePopover {
  return createFakePopover({
    trigger: createFakePopoverTrigger({
      type: 'icon',
      label: i18n.t('factory.popover.stepLabel', 'Step {{step}}', { step }),
      icon: 'help-circle',
    }),
    content: {
      id: faker.string.uuid(),
      type: 'info',
      title: i18n.t('factory.popover.stepOfTotal', 'Step {{step}} of {{total}}', {
        step,
        total: totalSteps,
      }),
      description: faker.lorem.sentence(),
      buttonLabel:
        step < totalSteps
          ? i18n.t('factory.popover.next', 'Next')
          : i18n.t('factory.popover.done', 'Done'),
      width: 280,
    },
    side: 'bottom',
    align: 'start',
    modal: true,
  });
}

/**
 * Creates a notification popover with badge count
 * @param count - Number of notifications
 * @returns A notification popover configuration
 */
export function createFakeNotificationPopover(count: number = 3): FakePopover {
  return createFakePopover({
    trigger: createFakePopoverTrigger({
      type: 'icon',
      label: i18n.t('factory.popover.notificationCount', '{{count}} notifications', { count }),
      icon: 'bell',
    }),
    content: {
      id: faker.string.uuid(),
      type: 'list',
      title: i18n.t('factory.popover.notifications', 'Notifications'),
      description: i18n.t(
        'factory.popover.unreadNotifications',
        'You have {{count}} unread notifications',
        { count }
      ),
      items: Array.from({ length: count }, () => ({
        id: faker.string.uuid(),
        label: faker.lorem.sentence({ min: 3, max: 6 }),
        description: faker.date.recent().toLocaleDateString(),
        icon: faker.helpers.arrayElement(['mail', 'message-circle', 'alert-circle', 'info']),
      })),
      width: 320,
    },
    side: 'bottom',
    align: 'end',
  });
}

/**
 * Creates a color picker popover
 * @returns A color picker popover configuration
 */
export function createFakeColorPickerPopover(): FakePopover {
  return createFakePopover({
    trigger: createFakePopoverTrigger({
      type: 'button',
      label: i18n.t('factory.popover.pickColor', 'Pick Color'),
      icon: 'palette',
    }),
    content: {
      id: faker.string.uuid(),
      type: 'custom',
      title: i18n.t('factory.popover.chooseColor', 'Choose Color'),
      width: 240,
    },
    side: 'bottom',
    align: 'start',
    sideOffset: 8,
  });
}

/**
 * Creates a date picker popover
 * @returns A date picker popover configuration
 */
export function createFakeDatePickerPopover(): FakePopover {
  return createFakePopover({
    trigger: createFakePopoverTrigger({
      type: 'button',
      label: faker.date.recent().toLocaleDateString(),
      icon: 'calendar',
    }),
    content: {
      id: faker.string.uuid(),
      type: 'custom',
      title: i18n.t('factory.popover.selectDate', 'Select Date'),
      width: 280,
    },
    side: 'bottom',
    align: 'start',
    sideOffset: 4,
  });
}

/**
 * Creates a user profile preview popover (hover card style)
 * @returns A user preview popover configuration
 */
export function createFakeUserPreviewPopover(): FakePopover {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return createFakePopover({
    trigger: createFakePopoverTrigger({
      type: 'text',
      label: `@${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    }),
    content: {
      id: faker.string.uuid(),
      type: 'profile',
      title: `${firstName} ${lastName}`,
      description: faker.person.jobTitle(),
      width: 300,
    },
    side: 'top',
    align: 'center',
    sideOffset: 8,
  });
}

/**
 * Creates a share/social popover
 * @returns A share popover configuration
 */
export function createFakeSharePopover(): FakePopover {
  return createFakePopover({
    trigger: createFakePopoverTrigger({
      type: 'button',
      label: i18n.t('factory.popover.share', 'Share'),
      icon: 'share-2',
    }),
    content: {
      id: faker.string.uuid(),
      type: 'list',
      title: i18n.t('factory.popover.share', 'Share'),
      items: [
        { id: '1', label: i18n.t('factory.popover.copyLink', 'Copy Link'), icon: 'link' },
        { id: '2', label: i18n.t('factory.popover.twitter', 'Twitter'), icon: 'twitter' },
        { id: '3', label: i18n.t('factory.popover.facebook', 'Facebook'), icon: 'facebook' },
        { id: '4', label: i18n.t('factory.popover.linkedin', 'LinkedIn'), icon: 'linkedin' },
        { id: '5', label: i18n.t('factory.popover.email', 'Email'), icon: 'mail' },
      ],
      width: 200,
    },
    side: 'bottom',
    align: 'end',
  });
}

/**
 * Creates all enterprise popover configurations for testing
 * @returns Array of enterprise popover configs
 */
export function createFakeEnterprisePopoverSet(): FakePopover[] {
  return [
    createFakeInfoPopover(),
    createFakeFormPopover(3),
    createFakeMenuPopover(5),
    createFakeProfilePopover(),
    createFakeSettingsPopover(),
    createFakeNotificationPopover(4),
    createFakeColorPickerPopover(),
    createFakeDatePickerPopover(),
    createFakeUserPreviewPopover(),
    createFakeSharePopover(),
  ];
}

/**
 * Creates a comprehensive enterprise showcase
 * @returns Array of enterprise popover showcase items
 */
export function createEnterprisePopoverShowcase(): Array<{
  category: string;
  description: string;
  name: string;
  popover: FakePopover;
}> {
  return [
    {
      category: i18n.t('factory.popover.information', 'Information'),
      name: i18n.t('factory.popover.infoTooltip', 'Info Tooltip'),
      description: i18n.t(
        'factory.popover.simpleInformationalPopoverForHelp',
        'Simple informational popover for help text'
      ),
      popover: createFakeInfoPopover(),
    },
    {
      category: i18n.t('factory.popover.forms', 'Forms'),
      name: i18n.t('factory.popover.quickEditForm', 'Quick Edit Form'),
      description: i18n.t(
        'factory.popover.inlineFormForQuickData',
        'Inline form for quick data editing'
      ),
      popover: createFakeFormPopover(3),
    },
    {
      category: i18n.t('factory.popover.navigation', 'Navigation'),
      name: i18n.t('factory.popover.actionMenu', 'Action Menu'),
      description: i18n.t(
        'factory.popover.contextMenuWithActionItems',
        'Context menu with action items'
      ),
      popover: createFakeMenuPopover(5),
    },
    {
      category: i18n.t('factory.popover.user', 'User'),
      name: i18n.t('factory.popover.profileCard', 'Profile Card'),
      description: i18n.t(
        'factory.popover.userProfilePreviewOnHover',
        'User profile preview on hover'
      ),
      popover: createFakeProfilePopover(),
    },
    {
      category: LABEL_SETTINGS,
      name: i18n.t('factory.popover.quickSettings', 'Quick Settings'),
      description: i18n.t('factory.popover.inlineSettingsPanel', 'Inline settings panel'),
      popover: createFakeSettingsPopover(),
    },
    {
      category: i18n.t('factory.popover.notifications', 'Notifications'),
      name: i18n.t('factory.popover.notificationCenter', 'Notification Center'),
      description: i18n.t(
        'factory.popover.listOfRecentNotifications',
        'List of recent notifications'
      ),
      popover: createFakeNotificationPopover(4),
    },
    {
      category: i18n.t('factory.popover.pickers', 'Pickers'),
      name: i18n.t('factory.popover.colorPicker', 'Color Picker'),
      description: i18n.t('factory.popover.colorSelectionInterface', 'Color selection interface'),
      popover: createFakeColorPickerPopover(),
    },
    {
      category: i18n.t('factory.popover.pickers', 'Pickers'),
      name: i18n.t('factory.popover.datePicker', 'Date Picker'),
      description: i18n.t('factory.popover.calendarDateSelection', 'Calendar date selection'),
      popover: createFakeDatePickerPopover(),
    },
    {
      category: i18n.t('factory.popover.social', 'Social'),
      name: i18n.t('factory.popover.userPreview', 'User Preview'),
      description: i18n.t(
        'factory.popover.hoverCardForUserMentions',
        'Hover card for user mentions'
      ),
      popover: createFakeUserPreviewPopover(),
    },
    {
      category: i18n.t('factory.popover.social', 'Social'),
      name: i18n.t('factory.popover.shareMenu', 'Share Menu'),
      description: i18n.t('factory.popover.socialSharingOptions', 'Social sharing options'),
      popover: createFakeSharePopover(),
    },
  ];
}
