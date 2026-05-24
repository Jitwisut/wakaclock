import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ═══════════════════════════════════════════════════════════════
// SHARED STRING CONSTANTS
// ═══════════════════════════════════════════════════════════════

const LABEL_LIST = i18n.t('factory.toggleGroup.list', 'List');

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/** Toggle group type - single or multiple selection */
export type ToggleGroupType = 'multiple' | 'single';

/** Toggle group visual variant */
export type ToggleGroupVariant = 'default' | 'outline';

/** Toggle group size */
export type ToggleGroupSize = 'default' | 'lg' | 'sm';

/** Toggle group orientation */
export type ToggleGroupOrientation = 'horizontal' | 'vertical';

// ═══════════════════════════════════════════════════════════════
// INTERFACE (Shape of Generated Data)
// ═══════════════════════════════════════════════════════════════

/** Individual toggle item within a group */
export interface FakeToggleGroupItem {
  ariaLabel?: string;
  disabled: boolean;
  icon?: string;
  id: string;
  label?: string;
  value: string;
}

/** Toggle group configuration */
export interface FakeToggleGroup {
  className?: string;
  defaultValue?: string | string[];
  disabled: boolean;
  id: string;
  items: FakeToggleGroupItem[];
  loop: boolean;
  orientation: ToggleGroupOrientation;
  rovingFocus: boolean;
  size: ToggleGroupSize;
  type: ToggleGroupType;
  value?: string | string[];
  variant: ToggleGroupVariant;
}

/** Text formatting toolbar configuration */
export interface FakeTextFormattingToolbar {
  alignment: FakeToggleGroup;
  formatting: FakeToggleGroup;
  id: string;
  list: FakeToggleGroup;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS (Used in Stories for Iteration)
// ═══════════════════════════════════════════════════════════════

export const TOGGLE_GROUP_TYPES: ToggleGroupType[] = ['single', 'multiple'];

export const TOGGLE_GROUP_VARIANTS: ToggleGroupVariant[] = ['default', 'outline'];

export const TOGGLE_GROUP_SIZES: ToggleGroupSize[] = ['sm', 'default', 'lg'];

export const TOGGLE_GROUP_ORIENTATIONS: ToggleGroupOrientation[] = ['horizontal', 'vertical'];

/** Common toggle group icons */
export const TOGGLE_GROUP_ICONS = {
  alignment: ['AlignLeft', 'AlignCenter', 'AlignRight', 'AlignJustify'],
  formatting: [
    i18n.t('factory.toggleGroup.bold', 'Bold'),
    i18n.t('factory.toggleGroup.italic', 'Italic'),
    i18n.t('factory.toggleGroup.underline', 'Underline'),
    i18n.t('factory.toggleGroup.strikethrough', 'Strikethrough'),
  ],
  list: [LABEL_LIST, 'ListOrdered', 'ListTodo'],
  view: [
    i18n.t('factory.toggleGroup.grid', 'Grid'),
    LABEL_LIST,
    'LayoutGrid',
    i18n.t('factory.toggleGroup.columns', 'Columns'),
  ],
  media: [
    i18n.t('factory.toggleGroup.play', 'Play'),
    i18n.t('factory.toggleGroup.pause', 'Pause'),
    'SkipBack',
    'SkipForward',
  ],
  zoom: [
    'ZoomIn',
    'ZoomOut',
    i18n.t('factory.toggleGroup.maximize', 'Maximize'),
    i18n.t('factory.toggleGroup.minimize', 'Minimize'),
  ],
};

/** Common toggle group labels */
export const TOGGLE_GROUP_LABELS = {
  alignment: [
    i18n.t('factory.toggleGroup.left', 'Left'),
    i18n.t('factory.toggleGroup.center', 'Center'),
    i18n.t('factory.toggleGroup.right', 'Right'),
    i18n.t('factory.toggleGroup.justify', 'Justify'),
  ],
  formatting: [
    i18n.t('factory.toggleGroup.bold', 'Bold'),
    i18n.t('factory.toggleGroup.italic', 'Italic'),
    i18n.t('factory.toggleGroup.underline', 'Underline'),
    i18n.t('factory.toggleGroup.strikethrough', 'Strikethrough'),
  ],
  list: [
    i18n.t('factory.toggleGroup.bulletList', 'Bullet List'),
    i18n.t('factory.toggleGroup.numberedList', 'Numbered List'),
    i18n.t('factory.toggleGroup.checklist', 'Checklist'),
  ],
  view: [
    i18n.t('factory.toggleGroup.gridView', 'Grid View'),
    i18n.t('factory.toggleGroup.listView', 'List View'),
    i18n.t('factory.toggleGroup.compactView', 'Compact View'),
    i18n.t('factory.toggleGroup.expandedView', 'Expanded View'),
  ],
  media: [
    i18n.t('factory.toggleGroup.play', 'Play'),
    i18n.t('factory.toggleGroup.pause', 'Pause'),
    i18n.t('factory.toggleGroup.previous', 'Previous'),
    i18n.t('factory.toggleGroup.next', 'Next'),
  ],
};

// ═══════════════════════════════════════════════════════════════
// SINGLE ITEM FACTORY
// ═══════════════════════════════════════════════════════════════

/** Create a fake toggle group item */
export function createFakeToggleGroupItem(
  overrides?: Partial<FakeToggleGroupItem>
): FakeToggleGroupItem {
  const hasIcon = faker.datatype.boolean({ probability: 0.7 });
  const iconCategory = faker.helpers.arrayElement(
    Object.keys(TOGGLE_GROUP_ICONS)
  ) as keyof typeof TOGGLE_GROUP_ICONS;

  return {
    id: faker.string.uuid(),
    value: faker.string.alphanumeric(8),
    label: hasIcon
      ? faker.helpers.maybe(() => faker.word.verb(), { probability: 0.3 })
      : faker.word.verb(),
    icon: hasIcon ? faker.helpers.arrayElement(TOGGLE_GROUP_ICONS[iconCategory]) : undefined,
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    ariaLabel: hasIcon ? faker.lorem.words(2) : undefined,
    ...overrides,
  };
}

/** Create a fake toggle group */
export function createFakeToggleGroup(overrides?: Partial<FakeToggleGroup>): FakeToggleGroup {
  const type = overrides?.type ?? faker.helpers.arrayElement(TOGGLE_GROUP_TYPES);
  const items =
    overrides?.items ?? createFakeToggleGroupItems(faker.number.int({ min: 2, max: 5 }));
  const defaultValue =
    type === 'single'
      ? faker.helpers.maybe(() => items[0]?.value, { probability: 0.5 })
      : faker.helpers.maybe(
          () => items.slice(0, faker.number.int({ min: 1, max: 2 })).map((i) => i.value),
          { probability: 0.5 }
        );

  return {
    id: faker.string.uuid(),
    type,
    variant: faker.helpers.arrayElement(TOGGLE_GROUP_VARIANTS),
    size: faker.helpers.arrayElement(TOGGLE_GROUP_SIZES),
    orientation: faker.helpers.arrayElement(TOGGLE_GROUP_ORIENTATIONS),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    loop: faker.datatype.boolean({ probability: 0.8 }),
    rovingFocus: true,
    items,
    defaultValue,
    className: faker.helpers.maybe(() => 'gap-1', { probability: 0.3 }),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// BULK FACTORY (For Lists/Tables)
// ═══════════════════════════════════════════════════════════════

/** Create multiple toggle group items */
export function createFakeToggleGroupItems(
  count: number,
  overrides?: Partial<FakeToggleGroupItem>
): FakeToggleGroupItem[] {
  return Array.from({ length: count }, () => createFakeToggleGroupItem(overrides));
}

/** Create multiple toggle groups */
export function createFakeToggleGroups(
  count: number,
  overrides?: Partial<FakeToggleGroup>
): FakeToggleGroup[] {
  return Array.from({ length: count }, () => createFakeToggleGroup(overrides));
}

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED FACTORIES (For Specific Scenarios)
// ═══════════════════════════════════════════════════════════════

/** Create a text alignment toggle group */
export function createFakeAlignmentToggleGroup(): FakeToggleGroup {
  return createFakeToggleGroup({
    type: 'single',
    variant: 'outline',
    size: 'sm',
    items: [
      {
        id: '1',
        value: 'left',
        icon: 'AlignLeft',
        ariaLabel: i18n.t('factory.toggleGroup.alignLeft', 'Align left'),
        disabled: false,
      },
      {
        id: '2',
        value: 'center',
        icon: 'AlignCenter',
        ariaLabel: i18n.t('factory.toggleGroup.alignCenter', 'Align center'),
        disabled: false,
      },
      {
        id: '3',
        value: 'right',
        icon: 'AlignRight',
        ariaLabel: i18n.t('factory.toggleGroup.alignRight', 'Align right'),
        disabled: false,
      },
      {
        id: '4',
        value: 'justify',
        icon: 'AlignJustify',
        ariaLabel: i18n.t('factory.toggleGroup.justify', 'Justify'),
        disabled: false,
      },
    ],
    defaultValue: 'left',
  });
}

/** Create a text formatting toggle group (bold, italic, underline) */
export function createFakeFormattingToggleGroup(): FakeToggleGroup {
  return createFakeToggleGroup({
    type: 'multiple',
    variant: 'outline',
    size: 'sm',
    items: [
      {
        id: '1',
        value: 'bold',
        icon: 'Bold',
        ariaLabel: i18n.t('factory.toggleGroup.toggleBold', 'Toggle bold'),
        disabled: false,
      },
      {
        id: '2',
        value: 'italic',
        icon: 'Italic',
        ariaLabel: i18n.t('factory.toggleGroup.toggleItalic', 'Toggle italic'),
        disabled: false,
      },
      {
        id: '3',
        value: 'underline',
        icon: i18n.t('factory.toggleGroup.underline', 'Underline'),
        ariaLabel: i18n.t('factory.toggleGroup.toggleUnderline', 'Toggle underline'),
        disabled: false,
      },
      {
        id: '4',
        value: 'strikethrough',
        icon: i18n.t('factory.toggleGroup.strikethrough', 'Strikethrough'),
        ariaLabel: i18n.t('factory.toggleGroup.toggleStrikethrough', 'Toggle strikethrough'),
        disabled: false,
      },
    ],
    defaultValue: ['bold'],
  });
}

/** Create a list type toggle group */
export function createFakeListToggleGroup(): FakeToggleGroup {
  return createFakeToggleGroup({
    type: 'single',
    variant: 'outline',
    size: 'sm',
    items: [
      {
        id: '1',
        value: 'bullet',
        icon: 'List',
        ariaLabel: i18n.t('factory.toggleGroup.bulletList', 'Bullet list'),
        disabled: false,
      },
      {
        id: '2',
        value: 'numbered',
        icon: 'ListOrdered',
        ariaLabel: i18n.t('factory.toggleGroup.numberedList2', 'Numbered list'),
        disabled: false,
      },
      {
        id: '3',
        value: 'checklist',
        icon: 'ListTodo',
        ariaLabel: i18n.t('factory.toggleGroup.checklist', 'Checklist'),
        disabled: false,
      },
    ],
  });
}

/** Create a view mode toggle group */
export function createFakeViewModeToggleGroup(): FakeToggleGroup {
  return createFakeToggleGroup({
    type: 'single',
    variant: 'default',
    size: 'default',
    items: [
      {
        id: '1',
        value: 'grid',
        icon: i18n.t('factory.toggleGroup.grid', 'Grid'),
        label: i18n.t('factory.toggleGroup.grid', 'Grid'),
        ariaLabel: i18n.t('factory.toggleGroup.gridView2', 'Grid view'),
        disabled: false,
      },
      {
        id: '2',
        value: 'list',
        icon: LABEL_LIST,
        label: LABEL_LIST,
        ariaLabel: i18n.t('factory.toggleGroup.listView2', 'List view'),
        disabled: false,
      },
    ],
    defaultValue: 'grid',
  });
}

/** Create a media player controls toggle group */
export function createFakeMediaControlsToggleGroup(): FakeToggleGroup {
  return createFakeToggleGroup({
    type: 'multiple',
    variant: 'outline',
    size: 'default',
    items: [
      {
        id: '1',
        value: 'shuffle',
        icon: 'Shuffle',
        ariaLabel: i18n.t('factory.toggleGroup.shuffle', 'Shuffle'),
        disabled: false,
      },
      {
        id: '2',
        value: 'repeat',
        icon: 'Repeat',
        ariaLabel: i18n.t('factory.toggleGroup.repeat', 'Repeat'),
        disabled: false,
      },
    ],
    defaultValue: [],
  });
}

/** Create a zoom controls toggle group */
export function createFakeZoomToggleGroup(): FakeToggleGroup {
  return createFakeToggleGroup({
    type: 'single',
    variant: 'outline',
    size: 'sm',
    items: [
      {
        id: '1',
        value: 'fit',
        icon: 'Maximize',
        ariaLabel: i18n.t('factory.toggleGroup.fitToScreen', 'Fit to screen'),
        disabled: false,
      },
      {
        id: '2',
        value: '100',
        label: '100%',
        ariaLabel: i18n.t('factory.toggleGroup.zoom100', '100% zoom'),
        disabled: false,
      },
      {
        id: '3',
        value: '150',
        label: '150%',
        ariaLabel: i18n.t('factory.toggleGroup.zoom150', '150% zoom'),
        disabled: false,
      },
      {
        id: '4',
        value: '200',
        label: '200%',
        ariaLabel: i18n.t('factory.toggleGroup.zoom200', '200% zoom'),
        disabled: false,
      },
    ],
    defaultValue: '100',
  });
}

/** Create a full text formatting toolbar */
export function createFakeTextFormattingToolbar(): FakeTextFormattingToolbar {
  return {
    id: faker.string.uuid(),
    formatting: createFakeFormattingToggleGroup(),
    alignment: createFakeAlignmentToggleGroup(),
    list: createFakeListToggleGroup(),
  };
}

/** Create a disabled toggle group */
export function createFakeDisabledToggleGroup(): FakeToggleGroup {
  return createFakeToggleGroup({
    disabled: true,
    items: [
      {
        id: '1',
        value: 'a',
        label: i18n.t('factory.toggleGroup.optionA', 'Option A'),
        disabled: false,
      },
      {
        id: '2',
        value: 'b',
        label: i18n.t('factory.toggleGroup.optionB', 'Option B'),
        disabled: false,
      },
      {
        id: '3',
        value: 'c',
        label: i18n.t('factory.toggleGroup.optionC', 'Option C'),
        disabled: false,
      },
    ],
  });
}

/** Create a toggle group with some disabled items */
export function createFakePartiallyDisabledToggleGroup(): FakeToggleGroup {
  return createFakeToggleGroup({
    items: [
      {
        id: '1',
        value: 'a',
        label: i18n.t('factory.toggleGroup.enabled', 'Enabled'),
        disabled: false,
      },
      {
        id: '2',
        value: 'b',
        label: i18n.t('factory.toggleGroup.disabled', 'Disabled'),
        disabled: true,
      },
      {
        id: '3',
        value: 'c',
        label: i18n.t('factory.toggleGroup.enabled', 'Enabled'),
        disabled: false,
      },
    ],
  });
}

/** Create a vertical toggle group */
export function createFakeVerticalToggleGroup(): FakeToggleGroup {
  return createFakeToggleGroup({
    orientation: 'vertical',
    items: [
      {
        id: '1',
        value: 'item1',
        label: i18n.t('factory.toggleGroup.firstItem', 'First Item'),
        icon: 'Circle',
        disabled: false,
      },
      {
        id: '2',
        value: 'item2',
        label: i18n.t('factory.toggleGroup.secondItem', 'Second Item'),
        icon: 'Circle',
        disabled: false,
      },
      {
        id: '3',
        value: 'item3',
        label: i18n.t('factory.toggleGroup.thirdItem', 'Third Item'),
        icon: 'Circle',
        disabled: false,
      },
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// MATRIX FACTORIES (For Visual Regression)
// ═══════════════════════════════════════════════════════════════

/** Create variant × size matrix for visual testing */
export function createFakeToggleGroupVariantSizeMatrix(): FakeToggleGroup[][] {
  return TOGGLE_GROUP_VARIANTS.map((variant) =>
    TOGGLE_GROUP_SIZES.map((size) =>
      createFakeToggleGroup({
        variant,
        size,
        items: [
          {
            id: '1',
            value: 'a',
            icon: 'Bold',
            ariaLabel: i18n.t('factory.toggleGroup.optionA', 'Option A'),
            disabled: false,
          },
          {
            id: '2',
            value: 'b',
            icon: 'Italic',
            ariaLabel: i18n.t('factory.toggleGroup.optionB', 'Option B'),
            disabled: false,
          },
          {
            id: '3',
            value: 'c',
            icon: 'Underline',
            ariaLabel: i18n.t('factory.toggleGroup.optionC', 'Option C'),
            disabled: false,
          },
        ],
      })
    )
  );
}

/** Create type × orientation matrix for visual testing */
export function createFakeToggleGroupTypeOrientationMatrix(): FakeToggleGroup[][] {
  return TOGGLE_GROUP_TYPES.map((type) =>
    TOGGLE_GROUP_ORIENTATIONS.map((orientation) =>
      createFakeToggleGroup({
        type,
        orientation,
        items: [
          { id: '1', value: 'a', label: 'A', disabled: false },
          { id: '2', value: 'b', label: 'B', disabled: false },
          { id: '3', value: 'c', label: 'C', disabled: false },
        ],
      })
    )
  );
}

/** Create all sizes for a single variant */
export function createFakeToggleGroupSizeMatrix(
  variant: ToggleGroupVariant = 'default'
): FakeToggleGroup[] {
  return TOGGLE_GROUP_SIZES.map((size) =>
    createFakeToggleGroup({
      variant,
      size,
      items: [
        {
          id: '1',
          value: 'a',
          label: i18n.t('factory.toggleGroup.small', 'Small'),
          disabled: false,
        },
        {
          id: '2',
          value: 'b',
          label: i18n.t('factory.toggleGroup.medium', 'Medium'),
          disabled: false,
        },
        {
          id: '3',
          value: 'c',
          label: i18n.t('factory.toggleGroup.large', 'Large'),
          disabled: false,
        },
      ],
    })
  );
}

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE FEATURE FACTORIES
// ═══════════════════════════════════════════════════════════════

/** Create an accessible toggle group with proper ARIA */
export function createFakeAccessibleToggleGroup(): FakeToggleGroup {
  return createFakeToggleGroup({
    type: 'single',
    variant: 'outline',
    rovingFocus: true,
    loop: true,
    items: [
      {
        id: '1',
        value: 'option1',
        label: i18n.t('factory.toggleGroup.firstOption', 'First Option'),
        ariaLabel: i18n.t('factory.toggleGroup.selectFirstOption', 'Select first option'),
        disabled: false,
      },
      {
        id: '2',
        value: 'option2',
        label: i18n.t('factory.toggleGroup.secondOption', 'Second Option'),
        ariaLabel: i18n.t('factory.toggleGroup.selectSecondOption', 'Select second option'),
        disabled: false,
      },
      {
        id: '3',
        value: 'option3',
        label: i18n.t('factory.toggleGroup.thirdOption', 'Third Option'),
        ariaLabel: i18n.t('factory.toggleGroup.selectThirdOption', 'Select third option'),
        disabled: false,
      },
    ],
  });
}

/** Create a toggle group for filter chips */
export function createFakeFilterToggleGroup(filters: string[]): FakeToggleGroup {
  return createFakeToggleGroup({
    type: 'multiple',
    variant: 'outline',
    size: 'sm',
    items: filters.map((filter, index) => ({
      id: String(index + 1),
      value: filter.toLowerCase().replaceAll(/\s+/g, '-'),
      label: filter,
      disabled: false,
    })),
    defaultValue: [],
  });
}

/** Create a segmented control style toggle group */
export function createFakeSegmentedControl(
  segments: string[],
  defaultValue?: string
): FakeToggleGroup {
  return createFakeToggleGroup({
    type: 'single',
    variant: 'outline',
    size: 'default',
    className: 'rounded-lg p-1 bg-muted',
    items: segments.map((segment, index) => ({
      id: String(index + 1),
      value: segment.toLowerCase().replaceAll(/\s+/g, '-'),
      label: segment,
      disabled: false,
    })),
    defaultValue: defaultValue ?? segments[0]?.toLowerCase().replaceAll(/\s+/g, '-'),
  });
}

/** Create a tab-style toggle group */
export function createFakeTabToggleGroup(
  tabs: Array<{ icon?: string; label: string }>
): FakeToggleGroup {
  return createFakeToggleGroup({
    type: 'single',
    variant: 'default',
    size: 'default',
    items: tabs.map((tab, index) => ({
      id: String(index + 1),
      value: tab.label.toLowerCase().replaceAll(/\s+/g, '-'),
      label: tab.label,
      icon: tab.icon,
      disabled: false,
    })),
    defaultValue: tabs[0]?.label.toLowerCase().replaceAll(/\s+/g, '-'),
  });
}

/** Create color mode toggle group */
export function createFakeColorModeToggleGroup(): FakeToggleGroup {
  return createFakeToggleGroup({
    type: 'single',
    variant: 'outline',
    size: 'sm',
    items: [
      {
        id: '1',
        value: 'light',
        icon: 'Sun',
        ariaLabel: i18n.t('factory.toggleGroup.lightMode', 'Light mode'),
        disabled: false,
      },
      {
        id: '2',
        value: 'dark',
        icon: 'Moon',
        ariaLabel: i18n.t('factory.toggleGroup.darkMode', 'Dark mode'),
        disabled: false,
      },
      {
        id: '3',
        value: 'system',
        icon: i18n.t('factory.toggleGroup.monitor', 'Monitor'),
        ariaLabel: i18n.t('factory.toggleGroup.systemPreference', 'System preference'),
        disabled: false,
      },
    ],
    defaultValue: 'system',
  });
}

/** Create language selector toggle group */
export function createFakeLanguageToggleGroup(): FakeToggleGroup {
  return createFakeToggleGroup({
    type: 'single',
    variant: 'outline',
    size: 'sm',
    items: [
      {
        id: '1',
        value: 'en',
        label: 'EN',
        ariaLabel: i18n.t('factory.toggleGroup.english', 'English'),
        disabled: false,
      },
      {
        id: '2',
        value: 'ja',
        label: '日本語',
        ariaLabel: i18n.t('factory.toggleGroup.japanese', 'Japanese'),
        disabled: false,
      },
      {
        id: '3',
        value: 'zh',
        label: '中文',
        ariaLabel: i18n.t('factory.toggleGroup.chinese', 'Chinese'),
        disabled: false,
      },
    ],
    defaultValue: 'en',
  });
}
