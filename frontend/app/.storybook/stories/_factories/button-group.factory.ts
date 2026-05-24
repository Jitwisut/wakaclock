import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ SHARED STRING CONSTANTS ============

const LABEL_COPY = i18n.t('factory.buttonGroup.copy', 'Copy');
const LABEL_PREVIOUS = i18n.t('factory.buttonGroup.previous', 'Previous');
const LABEL_NEXT = i18n.t('factory.buttonGroup.next', 'Next');

// ============ HELPER FUNCTIONS ============

/**
 * Gets the icon for a clipboard action
 * @param label - The label of the clipboard action
 * @returns The icon name or undefined
 */
function getClipboardIcon(label: string): string | undefined {
  if (label === 'Cut') return i18n.t('factory.buttonGroup.scissors', 'Scissors');
  if (label === 'Copy') return LABEL_COPY;
  return undefined;
}

/**
 * Gets the icon for a pagination action
 * @param label - The label of the pagination action
 * @returns The icon name
 */
function getPaginationIcon(label: string): string {
  if (label === i18n.t('factory.buttonGroup.first', 'First')) return 'ChevronsLeft';
  if (label === LABEL_PREVIOUS) return 'ChevronLeft';
  if (label === LABEL_NEXT) return 'ChevronRight';
  return 'ChevronsRight';
}

/**
 * Gets the icon for a zoom action
 * @param label - The label of the zoom action
 * @returns The icon name or undefined
 */
function getZoomIcon(label: string): string | undefined {
  if (label === i18n.t('factory.buttonGroup.zoomOut', 'Zoom Out')) return 'ZoomOut';
  if (label === i18n.t('factory.buttonGroup.zoomIn', 'Zoom In')) return 'ZoomIn';
  return undefined;
}

// ============ TYPE DEFINITIONS ============

/** Button group orientation */
export type ButtonGroupOrientation = 'horizontal' | 'vertical';

/** Button group item type */
export type ButtonGroupItemType = 'button' | 'separator' | 'text';

/** Button variant for items in the group */
export type ButtonGroupItemVariant =
  | 'default'
  | 'destructive'
  | 'ghost'
  | 'link'
  | 'outline'
  | 'secondary';

/** Button size for items in the group */
export type ButtonGroupItemSize = 'default' | 'icon-lg' | 'icon-sm' | 'icon' | 'lg' | 'sm' | 'xl';

/** Button group layout style */
export type ButtonGroupLayout = 'attached' | 'detached' | 'segmented';

/** Interface for fake button group item data */
export interface FakeButtonGroupItem {
  /** Whether button is disabled */
  disabled?: boolean;
  /** Icon name for icon buttons */
  icon?: string;
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Item size */
  size?: ButtonGroupItemSize;
  /** Item type */
  type: ButtonGroupItemType;
  /** Button variant */
  variant?: ButtonGroupItemVariant;
}

/** Interface for fake button group data */
export interface FakeButtonGroup {
  /** Unique identifier */
  id: string;
  /** Button group items */
  items: FakeButtonGroupItem[];
  /** Layout style */
  layout?: ButtonGroupLayout;
  /** Group label/name */
  name?: string;
  /** Orientation */
  orientation: ButtonGroupOrientation;
}

/** Interface for button group configuration */
export interface FakeButtonGroupConfig {
  /** Layout style */
  layout: ButtonGroupLayout;
  /** Maximum items */
  maxItems: number;
  /** Orientation */
  orientation: ButtonGroupOrientation;
  /** Whether to show separators */
  showSeparators: boolean;
  /** Uniform button size */
  size: ButtonGroupItemSize;
  /** Uniform button variant */
  variant: ButtonGroupItemVariant;
}

// ============ CONSTANTS FOR ITERATION ============

/** All button group orientation options */
export const BUTTON_GROUP_ORIENTATIONS: ButtonGroupOrientation[] = ['horizontal', 'vertical'];

/** All button group item types */
export const BUTTON_GROUP_ITEM_TYPES: ButtonGroupItemType[] = ['button', 'separator', 'text'];

/** All button variants for group items */
export const BUTTON_GROUP_ITEM_VARIANTS: ButtonGroupItemVariant[] = [
  'default',
  'destructive',
  'ghost',
  'link',
  'outline',
  'secondary',
];

/** All button sizes for group items */
export const BUTTON_GROUP_ITEM_SIZES: ButtonGroupItemSize[] = [
  'default',
  'icon',
  'icon-lg',
  'icon-sm',
  'lg',
  'sm',
  'xl',
];

/** All button group layout options */
export const BUTTON_GROUP_LAYOUTS: ButtonGroupLayout[] = ['attached', 'detached', 'segmented'];

/** Common button group labels */
export const BUTTON_GROUP_LABELS = [
  i18n.t('factory.buttonGroup.actions', 'Actions'),
  i18n.t('factory.buttonGroup.alignment', 'Alignment'),
  i18n.t('factory.buttonGroup.editActions', 'Edit Actions'),
  i18n.t('factory.buttonGroup.fileActions', 'File Actions'),
  i18n.t('factory.buttonGroup.formatting', 'Formatting'),
  i18n.t('factory.buttonGroup.navigation', 'Navigation'),
  i18n.t('factory.buttonGroup.options', 'Options'),
  i18n.t('factory.buttonGroup.pagination', 'Pagination'),
  i18n.t('factory.buttonGroup.selection', 'Selection'),
  i18n.t('factory.buttonGroup.sorting', 'Sorting'),
  i18n.t('factory.buttonGroup.textAlignment', 'Text Alignment'),
  i18n.t('factory.buttonGroup.tools', 'Tools'),
  i18n.t('factory.buttonGroup.viewOptions', 'View Options'),
  i18n.t('factory.buttonGroup.zoom', 'Zoom'),
];

/** Common button labels for group items */
export const BUTTON_GROUP_ITEM_LABELS = [
  i18n.t('factory.buttonGroup.add', 'Add'),
  i18n.t('factory.buttonGroup.bold', 'Bold'),
  i18n.t('factory.buttonGroup.cancel', 'Cancel'),
  i18n.t('factory.buttonGroup.center', 'Center'),
  LABEL_COPY,
  i18n.t('factory.buttonGroup.cut', 'Cut'),
  i18n.t('factory.buttonGroup.delete', 'Delete'),
  i18n.t('factory.buttonGroup.edit', 'Edit'),
  i18n.t('factory.buttonGroup.first', 'First'),
  i18n.t('factory.buttonGroup.italic', 'Italic'),
  i18n.t('factory.buttonGroup.last', 'Last'),
  i18n.t('factory.buttonGroup.left', 'Left'),
  i18n.t('factory.buttonGroup.middle', 'Middle'),
  LABEL_NEXT,
  i18n.t('factory.buttonGroup.paste', 'Paste'),
  LABEL_PREVIOUS,
  i18n.t('factory.buttonGroup.redo', 'Redo'),
  i18n.t('factory.buttonGroup.remove', 'Remove'),
  i18n.t('factory.buttonGroup.right', 'Right'),
  i18n.t('factory.buttonGroup.save', 'Save'),
  i18n.t('factory.buttonGroup.second', 'Second'),
  i18n.t('factory.buttonGroup.third', 'Third'),
  i18n.t('factory.buttonGroup.underline', 'Underline'),
  i18n.t('factory.buttonGroup.undo', 'Undo'),
];

/** Icon options for button group items */
export const BUTTON_GROUP_ICONS = [
  'AlignCenter',
  'AlignJustify',
  'AlignLeft',
  'AlignRight',
  i18n.t('factory.buttonGroup.bold', 'Bold'),
  'ChevronLeft',
  'ChevronRight',
  LABEL_COPY,
  i18n.t('factory.buttonGroup.grid', 'Grid'),
  i18n.t('factory.buttonGroup.italic', 'Italic'),
  i18n.t('factory.buttonGroup.list', 'List'),
  i18n.t('factory.buttonGroup.minus', 'Minus'),
  i18n.t('factory.buttonGroup.plus', 'Plus'),
  i18n.t('factory.buttonGroup.redo', 'Redo'),
  i18n.t('factory.buttonGroup.scissors', 'Scissors'),
  i18n.t('factory.buttonGroup.trash', 'Trash'),
  i18n.t('factory.buttonGroup.underline', 'Underline'),
  i18n.t('factory.buttonGroup.undo', 'Undo'),
  'ZoomIn',
  'ZoomOut',
];

/** Common button group patterns */
export const BUTTON_GROUP_PATTERNS = {
  alignment: [
    i18n.t('factory.buttonGroup.left', 'Left'),
    i18n.t('factory.buttonGroup.center', 'Center'),
    i18n.t('factory.buttonGroup.right', 'Right'),
    i18n.t('factory.buttonGroup.justify', 'Justify'),
  ],
  clipboard: [
    i18n.t('factory.buttonGroup.cut', 'Cut'),
    LABEL_COPY,
    i18n.t('factory.buttonGroup.paste', 'Paste'),
  ],
  formatting: [
    i18n.t('factory.buttonGroup.bold', 'Bold'),
    i18n.t('factory.buttonGroup.italic', 'Italic'),
    i18n.t('factory.buttonGroup.underline', 'Underline'),
  ],
  navigation: [LABEL_PREVIOUS, LABEL_NEXT],
  pagination: [
    i18n.t('factory.buttonGroup.first', 'First'),
    LABEL_PREVIOUS,
    LABEL_NEXT,
    i18n.t('factory.buttonGroup.last', 'Last'),
  ],
  textAlignment: [
    i18n.t('factory.buttonGroup.alignLeft', 'Align Left'),
    i18n.t('factory.buttonGroup.alignCenter', 'Align Center'),
    i18n.t('factory.buttonGroup.alignRight', 'Align Right'),
  ],
  undoRedo: [
    i18n.t('factory.buttonGroup.undo', 'Undo'),
    i18n.t('factory.buttonGroup.redo', 'Redo'),
  ],
  viewMode: [
    i18n.t('factory.buttonGroup.list', 'List'),
    i18n.t('factory.buttonGroup.grid', 'Grid'),
    i18n.t('factory.buttonGroup.cards', 'Cards'),
  ],
  zoom: [
    i18n.t('factory.buttonGroup.zoomOut', 'Zoom Out'),
    i18n.t('factory.buttonGroup.reset', 'Reset'),
    i18n.t('factory.buttonGroup.zoomIn', 'Zoom In'),
  ],
};

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake button group item
 * @param overrides - Optional partial overrides for the generated item
 * @returns A fake button group item
 */
export function createFakeButtonGroupItem(
  overrides?: Partial<FakeButtonGroupItem>
): FakeButtonGroupItem {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement(BUTTON_GROUP_ITEM_LABELS),
    type: 'button',
    variant: faker.helpers.arrayElement(BUTTON_GROUP_ITEM_VARIANTS),
    size: faker.helpers.maybe(() => faker.helpers.arrayElement(BUTTON_GROUP_ITEM_SIZES), {
      probability: 0.3,
    }),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(BUTTON_GROUP_ICONS), {
      probability: 0.2,
    }),
    disabled: faker.helpers.maybe(() => true, { probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates a separator item
 * @returns A separator item
 */
export function createFakeButtonGroupSeparator(): FakeButtonGroupItem {
  return {
    id: faker.string.uuid(),
    label: '',
    type: 'separator',
  };
}

/**
 * Creates a text item
 * @param label - Text label
 * @returns A text item
 */
export function createFakeButtonGroupText(label?: string): FakeButtonGroupItem {
  return {
    id: faker.string.uuid(),
    label: label ?? faker.lorem.word(),
    type: 'text',
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake button group items
 * @param count - Number of items to generate
 * @returns Array of fake button group items
 */
export function createFakeButtonGroupItems(count: number): FakeButtonGroupItem[] {
  return Array.from({ length: count }, () => createFakeButtonGroupItem());
}

/**
 * Creates a button group with items
 * @param itemCount - Number of buttons in the group
 * @param overrides - Optional partial overrides
 * @returns A fake button group
 */
export function createFakeButtonGroup(
  itemCount = 3,
  overrides?: Partial<FakeButtonGroup>
): FakeButtonGroup {
  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement(BUTTON_GROUP_LABELS),
    orientation: 'horizontal',
    layout: faker.helpers.arrayElement(BUTTON_GROUP_LAYOUTS),
    items: createFakeButtonGroupItems(itemCount),
    ...overrides,
  };
}

/**
 * Creates multiple button groups
 * @param count - Number of groups to generate
 * @returns Array of fake button groups
 */
export function createFakeButtonGroups(count: number): FakeButtonGroup[] {
  return Array.from({ length: count }, () => createFakeButtonGroup());
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a horizontal button group
 * @param itemCount - Number of buttons
 * @returns A horizontal button group
 */
export function createFakeHorizontalButtonGroup(itemCount = 3): FakeButtonGroup {
  return createFakeButtonGroup(itemCount, { orientation: 'horizontal' });
}

/**
 * Creates a vertical button group
 * @param itemCount - Number of buttons
 * @returns A vertical button group
 */
export function createFakeVerticalButtonGroup(itemCount = 3): FakeButtonGroup {
  return createFakeButtonGroup(itemCount, { orientation: 'vertical' });
}

/**
 * Creates a clipboard action button group (Cut, Copy, Paste)
 * @returns A clipboard button group
 */
export function createFakeClipboardButtonGroup(): FakeButtonGroup {
  return {
    id: faker.string.uuid(),
    name: i18n.t('factory.buttonGroup.clipboardActions', 'Clipboard Actions'),
    orientation: 'horizontal',
    layout: 'attached',
    items: BUTTON_GROUP_PATTERNS.clipboard.map((label, index) => ({
      id: `clipboard-${index}`,
      label,
      type: 'button' as ButtonGroupItemType,
      variant: 'outline' as ButtonGroupItemVariant,
      icon: getClipboardIcon(label),
    })),
  };
}

/**
 * Creates a text formatting button group (Bold, Italic, Underline)
 * @returns A formatting button group
 */
export function createFakeFormattingButtonGroup(): FakeButtonGroup {
  return {
    id: faker.string.uuid(),
    name: i18n.t('factory.buttonGroup.textFormatting', 'Text Formatting'),
    orientation: 'horizontal',
    layout: 'attached',
    items: BUTTON_GROUP_PATTERNS.formatting.map((label, index) => ({
      id: `format-${index}`,
      label,
      type: 'button' as ButtonGroupItemType,
      variant: 'outline' as ButtonGroupItemVariant,
      icon: label,
    })),
  };
}

/**
 * Creates a text alignment button group
 * @returns An alignment button group
 */
export function createFakeAlignmentButtonGroup(): FakeButtonGroup {
  const alignmentIcons = ['AlignLeft', 'AlignCenter', 'AlignRight', 'AlignJustify'];

  return {
    id: faker.string.uuid(),
    name: i18n.t('factory.buttonGroup.textAlignment', 'Text Alignment'),
    orientation: 'horizontal',
    layout: 'segmented',
    items: BUTTON_GROUP_PATTERNS.alignment.map((label, index) => ({
      id: `align-${index}`,
      label,
      type: 'button' as ButtonGroupItemType,
      variant: 'outline' as ButtonGroupItemVariant,
      icon: alignmentIcons[index],
    })),
  };
}

/**
 * Creates a pagination button group (First, Previous, Next, Last)
 * @returns A pagination button group
 */
export function createFakePaginationButtonGroup(): FakeButtonGroup {
  return {
    id: faker.string.uuid(),
    name: i18n.t('factory.buttonGroup.pagination', 'Pagination'),
    orientation: 'horizontal',
    layout: 'detached',
    items: BUTTON_GROUP_PATTERNS.pagination.map((label, index) => ({
      id: `page-${index}`,
      label,
      type: 'button' as ButtonGroupItemType,
      variant: 'outline' as ButtonGroupItemVariant,
      icon: getPaginationIcon(label),
    })),
  };
}

/**
 * Creates a navigation button group (Previous, Next)
 * @returns A navigation button group
 */
export function createFakeNavigationButtonGroup(): FakeButtonGroup {
  return {
    id: faker.string.uuid(),
    name: i18n.t('factory.buttonGroup.navigation', 'Navigation'),
    orientation: 'horizontal',
    layout: 'attached',
    items: BUTTON_GROUP_PATTERNS.navigation.map((label, index) => ({
      id: `nav-${index}`,
      label,
      type: 'button' as ButtonGroupItemType,
      variant: 'outline' as ButtonGroupItemVariant,
      icon: label === LABEL_PREVIOUS ? 'ChevronLeft' : 'ChevronRight',
    })),
  };
}

/**
 * Creates an undo/redo button group
 * @returns An undo/redo button group
 */
export function createFakeUndoRedoButtonGroup(): FakeButtonGroup {
  return {
    id: faker.string.uuid(),
    name: i18n.t('factory.buttonGroup.undoRedo', 'Undo/Redo'),
    orientation: 'horizontal',
    layout: 'attached',
    items: BUTTON_GROUP_PATTERNS.undoRedo.map((label, index) => ({
      id: `history-${index}`,
      label,
      type: 'button' as ButtonGroupItemType,
      variant: 'outline' as ButtonGroupItemVariant,
      icon: label,
    })),
  };
}

/**
 * Creates a zoom control button group
 * @returns A zoom button group
 */
export function createFakeZoomButtonGroup(): FakeButtonGroup {
  return {
    id: faker.string.uuid(),
    name: i18n.t('factory.buttonGroup.zoomControls', 'Zoom Controls'),
    orientation: 'horizontal',
    layout: 'attached',
    items: BUTTON_GROUP_PATTERNS.zoom.map((label, index) => ({
      id: `zoom-${index}`,
      label,
      type: 'button' as ButtonGroupItemType,
      variant: 'outline' as ButtonGroupItemVariant,
      icon: getZoomIcon(label),
    })),
  };
}

/**
 * Creates a view mode button group (List, Grid, Cards)
 * @returns A view mode button group
 */
export function createFakeViewModeButtonGroup(): FakeButtonGroup {
  return {
    id: faker.string.uuid(),
    name: i18n.t('factory.buttonGroup.viewMode', 'View Mode'),
    orientation: 'horizontal',
    layout: 'segmented',
    items: BUTTON_GROUP_PATTERNS.viewMode.map((label, index) => ({
      id: `view-${index}`,
      label,
      type: 'button' as ButtonGroupItemType,
      variant: 'outline' as ButtonGroupItemVariant,
      icon: label,
    })),
  };
}

/**
 * Creates a button group with separators between items
 * @param itemCount - Number of buttons
 * @returns A button group with separators
 */
export function createFakeButtonGroupWithSeparators(itemCount = 3): FakeButtonGroup {
  const buttons = createFakeButtonGroupItems(itemCount);
  const items: FakeButtonGroupItem[] = [];

  buttons.forEach((button, index) => {
    items.push(button);
    if (index < buttons.length - 1) {
      items.push(createFakeButtonGroupSeparator());
    }
  });

  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement(BUTTON_GROUP_LABELS),
    orientation: 'horizontal',
    layout: 'attached',
    items,
  };
}

/**
 * Creates a button group with a text label
 * @param label - Text label
 * @returns A button group with text
 */
export function createFakeButtonGroupWithText(label?: string): FakeButtonGroup {
  return {
    id: faker.string.uuid(),
    name: i18n.t('factory.buttonGroup.labeledGroup', 'Labeled Group'),
    orientation: 'horizontal',
    layout: 'attached',
    items: [
      createFakeButtonGroupText(label ?? i18n.t('factory.buttonGroup.label', 'Label:')),
      ...createFakeButtonGroupItems(2),
    ],
  };
}

/**
 * Creates a button group with mixed variants
 * @returns A button group with different variants
 */
export function createFakeMixedVariantButtonGroup(): FakeButtonGroup {
  const variants: ButtonGroupItemVariant[] = ['default', 'secondary', 'outline'];

  return {
    id: faker.string.uuid(),
    name: i18n.t('factory.buttonGroup.mixedVariants', 'Mixed Variants'),
    orientation: 'horizontal',
    layout: 'attached',
    items: variants.map((variant, index) => ({
      id: `mixed-${index}`,
      label: variant.charAt(0).toUpperCase() + variant.slice(1),
      type: 'button' as ButtonGroupItemType,
      variant,
    })),
  };
}

/**
 * Creates a button group with icon-only buttons
 * @param icons - Array of icon names
 * @returns An icon-only button group
 */
export function createFakeIconOnlyButtonGroup(icons?: string[]): FakeButtonGroup {
  const buttonIcons = icons ?? [
    i18n.t('factory.buttonGroup.plus', 'Plus'),
    i18n.t('factory.buttonGroup.minus', 'Minus'),
    i18n.t('factory.buttonGroup.grid', 'Grid'),
    i18n.t('factory.buttonGroup.list', 'List'),
  ];

  return {
    id: faker.string.uuid(),
    name: i18n.t('factory.buttonGroup.iconActions', 'Icon Actions'),
    orientation: 'horizontal',
    layout: 'attached',
    items: buttonIcons.map((icon, index) => ({
      id: `icon-${index}`,
      label: '',
      type: 'button' as ButtonGroupItemType,
      variant: 'outline' as ButtonGroupItemVariant,
      size: 'icon' as ButtonGroupItemSize,
      icon,
    })),
  };
}

/**
 * Creates a disabled button group
 * @param itemCount - Number of buttons
 * @returns A button group with all items disabled
 */
export function createFakeDisabledButtonGroup(itemCount = 3): FakeButtonGroup {
  return {
    id: faker.string.uuid(),
    name: i18n.t('factory.buttonGroup.disabledGroup', 'Disabled Group'),
    orientation: 'horizontal',
    layout: 'attached',
    items: Array.from({ length: itemCount }, (_, index) => ({
      id: `disabled-${index}`,
      label: faker.helpers.arrayElement(BUTTON_GROUP_ITEM_LABELS),
      type: 'button' as ButtonGroupItemType,
      variant: 'outline' as ButtonGroupItemVariant,
      disabled: true,
    })),
  };
}

// ============ MATRIX FACTORY ============

/**
 * Creates a matrix of button groups for visual regression testing
 * across all orientation and layout combinations
 * @returns Array of button groups with different configurations
 */
export function createFakeButtonGroupMatrix(): FakeButtonGroup[] {
  const matrix: FakeButtonGroup[] = [];

  for (const orientation of BUTTON_GROUP_ORIENTATIONS) {
    for (const layout of BUTTON_GROUP_LAYOUTS) {
      matrix.push({
        id: `${orientation}-${layout}`,
        name: `${orientation} / ${layout}`,
        orientation,
        layout,
        items: createFakeButtonGroupItems(3).map((item) => ({
          ...item,
          variant: 'outline' as ButtonGroupItemVariant,
        })),
      });
    }
  }

  return matrix;
}

/**
 * Creates button group configuration for different scenarios
 * @param scenario - Scenario name
 * @returns Button group configuration
 */
export function createFakeButtonGroupConfig(
  scenario: 'default' | 'iconOnly' | 'separated' | 'vertical' = 'default'
): FakeButtonGroupConfig {
  const configs: Record<string, FakeButtonGroupConfig> = {
    default: {
      orientation: 'horizontal',
      layout: 'attached',
      variant: 'outline',
      size: 'default',
      maxItems: 5,
      showSeparators: false,
    },
    iconOnly: {
      orientation: 'horizontal',
      layout: 'attached',
      variant: 'outline',
      size: 'icon',
      maxItems: 4,
      showSeparators: false,
    },
    separated: {
      orientation: 'horizontal',
      layout: 'attached',
      variant: 'outline',
      size: 'default',
      maxItems: 5,
      showSeparators: true,
    },
    vertical: {
      orientation: 'vertical',
      layout: 'attached',
      variant: 'outline',
      size: 'default',
      maxItems: 4,
      showSeparators: true,
    },
  };

  return configs[scenario];
}

/**
 * Creates a set of common UI button groups
 * @returns Object with common button group presets
 */
export function createFakeCommonButtonGroups(): Record<string, FakeButtonGroup> {
  return {
    alignment: createFakeAlignmentButtonGroup(),
    clipboard: createFakeClipboardButtonGroup(),
    formatting: createFakeFormattingButtonGroup(),
    navigation: createFakeNavigationButtonGroup(),
    pagination: createFakePaginationButtonGroup(),
    undoRedo: createFakeUndoRedoButtonGroup(),
    viewMode: createFakeViewModeButtonGroup(),
    zoom: createFakeZoomButtonGroup(),
  };
}
