/**
 * Toggle Component Factory
 *
 * Generates fake data for Toggle component stories and tests.
 * Supports various variants, sizes, and icon configurations.
 *
 * @module toggle.factory
 */
import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Toggle variant options
 */
export type ToggleVariant = 'default' | 'outline';

/**
 * Toggle size options
 */
export type ToggleSize = 'default' | 'lg' | 'sm';

/**
 * Toggle state
 */
export type ToggleState = 'off' | 'on';

/**
 * Toggle icon type
 */
export type ToggleIconType =
  | 'align'
  | 'bookmark'
  | 'favorite'
  | 'format'
  | 'media'
  | 'notification'
  | 'view';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All toggle variants
 */
export const TOGGLE_VARIANTS: ToggleVariant[] = ['default', 'outline'];

/**
 * All toggle sizes
 */
export const TOGGLE_SIZES: ToggleSize[] = ['default', 'lg', 'sm'];

/**
 * All toggle states
 */
export const TOGGLE_STATES: ToggleState[] = ['off', 'on'];

/**
 * All toggle icon types
 */
export const TOGGLE_ICON_TYPES: ToggleIconType[] = [
  'align',
  'bookmark',
  'favorite',
  'format',
  'media',
  'notification',
  'view',
];

/**
 * Icons by type (icon names from Lucide)
 */
export const TOGGLE_ICONS: Record<ToggleIconType, string[]> = {
  align: ['AlignLeft', 'AlignCenter', 'AlignRight', 'AlignJustify'],
  bookmark: ['Bookmark', 'BookmarkCheck', 'BookmarkPlus', 'BookmarkMinus'],
  favorite: ['Heart', 'Star', 'ThumbsUp', 'Award'],
  format: ['Bold', 'Italic', 'Underline', 'Strikethrough'],
  media: ['Play', 'Pause', 'Volume2', 'VolumeX', 'Mic', 'MicOff', 'Video', 'VideoOff'],
  notification: ['Bell', 'BellOff', 'BellRing', 'BellDot'],
  view: ['Eye', 'EyeOff', 'Grid', 'List', 'LayoutGrid', 'LayoutList'],
};

/**
 * Aria labels by icon
 */
export const TOGGLE_ARIA_LABELS: Record<string, string> = {
  AlignCenter: i18n.t('factory.toggle.alignCenter', 'Align center'),
  AlignJustify: i18n.t('factory.toggle.justify', 'Justify'),
  AlignLeft: i18n.t('factory.toggle.alignLeft', 'Align left'),
  AlignRight: i18n.t('factory.toggle.alignRight', 'Align right'),
  Bell: i18n.t('factory.toggle.enableNotifications', 'Enable notifications'),
  BellDot: i18n.t('factory.toggle.notificationIndicator', 'Notification indicator'),
  BellOff: i18n.t('factory.toggle.disableNotifications', 'Disable notifications'),
  BellRing: i18n.t('factory.toggle.alertNotifications', 'Alert notifications'),
  Bold: i18n.t('factory.toggle.toggleBold', 'Toggle bold'),
  Bookmark: i18n.t('factory.toggle.toggleBookmark', 'Toggle bookmark'),
  BookmarkCheck: i18n.t('factory.toggle.bookmarked', 'Bookmarked'),
  BookmarkMinus: i18n.t('factory.toggle.removeBookmark', 'Remove bookmark'),
  BookmarkPlus: i18n.t('factory.toggle.addBookmark', 'Add bookmark'),
  Eye: i18n.t('factory.toggle.show', 'Show'),
  EyeOff: i18n.t('factory.toggle.hide', 'Hide'),
  Grid: i18n.t('factory.toggle.gridView', 'Grid view'),
  Heart: i18n.t('factory.toggle.toggleFavorite', 'Toggle favorite'),
  Italic: i18n.t('factory.toggle.toggleItalic', 'Toggle italic'),
  LayoutGrid: i18n.t('factory.toggle.gridLayout', 'Grid layout'),
  LayoutList: i18n.t('factory.toggle.listLayout', 'List layout'),
  List: i18n.t('factory.toggle.listView', 'List view'),
  Mic: i18n.t('factory.toggle.unmuteMicrophone', 'Unmute microphone'),
  MicOff: i18n.t('factory.toggle.muteMicrophone', 'Mute microphone'),
  Pause: i18n.t('factory.toggle.pause', 'Pause'),
  Play: i18n.t('factory.toggle.play', 'Play'),
  Star: i18n.t('factory.toggle.toggleStar', 'Toggle star'),
  Strikethrough: i18n.t('factory.toggle.toggleStrikethrough', 'Toggle strikethrough'),
  ThumbsUp: i18n.t('factory.toggle.like', 'Like'),
  Underline: i18n.t('factory.toggle.toggleUnderline', 'Toggle underline'),
  Video: i18n.t('factory.toggle.enableVideo', 'Enable video'),
  VideoOff: i18n.t('factory.toggle.disableVideo', 'Disable video'),
  Volume2: i18n.t('factory.toggle.unmute', 'Unmute'),
  VolumeX: i18n.t('factory.toggle.mute', 'Mute'),
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base toggle configuration
 */
export interface FakeToggle {
  ariaLabel: string;
  className?: string;
  defaultPressed?: boolean;
  disabled: boolean;
  icon: string;
  iconType: ToggleIconType;
  id: string;
  pressed: boolean;
  size: ToggleSize;
  testId: string;
  variant: ToggleVariant;
}

/**
 * Toggle with label
 */
export interface FakeToggleWithLabel extends FakeToggle {
  label: string;
  showLabel: boolean;
}

/**
 * Toggle in a group
 */
export interface FakeToggleGroupItem extends FakeToggle {
  groupId: string;
  index: number;
  value: string;
}

/**
 * Formatting toggle group
 */
export interface FakeFormattingToggleGroup {
  id: string;
  toggles: FakeToggle[];
  type: 'multiple' | 'single';
}

/**
 * View toggle pair
 */
export interface FakeViewTogglePair {
  activeView: 'grid' | 'list';
  gridToggle: FakeToggle;
  id: string;
  listToggle: FakeToggle;
}

/**
 * Media control toggle
 */
export interface FakeMediaToggle extends FakeToggle {
  offIcon: string;
  offLabel: string;
  onIcon: string;
  onLabel: string;
}

// ============================================================================
// BASE FACTORIES
// ============================================================================

/**
 * Create a basic fake toggle
 */
export function createFakeToggle(overrides?: Partial<FakeToggle>): FakeToggle {
  const iconType = overrides?.iconType ?? faker.helpers.arrayElement(TOGGLE_ICON_TYPES);
  const icon = overrides?.icon ?? faker.helpers.arrayElement(TOGGLE_ICONS[iconType]);
  const pressed = overrides?.pressed ?? faker.datatype.boolean();

  return {
    ariaLabel:
      overrides?.ariaLabel ?? TOGGLE_ARIA_LABELS[icon] ?? i18n.t('factory.toggle.toggle', 'Toggle'),
    className: faker.helpers.maybe(() => 'custom-toggle', { probability: 0.2 }),
    defaultPressed: faker.helpers.maybe(() => pressed, { probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    icon,
    iconType,
    id: `toggle-${faker.string.alphanumeric(8)}`,
    pressed,
    size: faker.helpers.arrayElement(TOGGLE_SIZES),
    testId: `toggle-${faker.string.alphanumeric(8)}`,
    variant: faker.helpers.arrayElement(TOGGLE_VARIANTS),
    ...overrides,
  };
}

/**
 * Create multiple fake toggles
 */
export function createFakeToggles(count: number, overrides?: Partial<FakeToggle>): FakeToggle[] {
  return Array.from({ length: count }, () => createFakeToggle(overrides));
}

// ============================================================================
// TYPE-SPECIFIC FACTORIES
// ============================================================================

/**
 * Create a formatting toggle (bold, italic, etc.)
 */
export function createFakeFormattingToggle(
  formatType: 'Bold' | 'Italic' | 'Strikethrough' | 'Underline' = 'Bold',
  overrides?: Partial<FakeToggle>
): FakeToggle {
  return createFakeToggle({
    icon: formatType,
    iconType: 'format',
    ariaLabel: i18n.t('factory.toggle.toggleAriaLabel', 'Toggle {{type}}', {
      type: formatType.toLowerCase(),
    }),
    variant: 'outline',
    ...overrides,
  });
}

/**
 * Create a favorite/like toggle
 */
export function createFakeFavoriteToggle(overrides?: Partial<FakeToggle>): FakeToggle {
  const icon = faker.helpers.arrayElement(['Heart', 'Star', 'ThumbsUp']);
  return createFakeToggle({
    icon,
    iconType: 'favorite',
    ariaLabel: TOGGLE_ARIA_LABELS[icon],
    ...overrides,
  });
}

/**
 * Create a bookmark toggle
 */
export function createFakeBookmarkToggle(overrides?: Partial<FakeToggle>): FakeToggle {
  return createFakeToggle({
    icon: 'Bookmark',
    iconType: 'bookmark',
    ariaLabel: i18n.t('factory.toggle.toggleBookmark', 'Toggle bookmark'),
    ...overrides,
  });
}

/**
 * Create a notification toggle
 */
export function createFakeNotificationToggle(overrides?: Partial<FakeToggle>): FakeToggle {
  const pressed = overrides?.pressed ?? faker.datatype.boolean();
  return createFakeToggle({
    icon: pressed ? 'Bell' : 'BellOff',
    iconType: 'notification',
    ariaLabel: pressed
      ? i18n.t('factory.toggle.disableNotifications', 'Disable notifications')
      : i18n.t('factory.toggle.enableNotifications', 'Enable notifications'),
    pressed,
    ...overrides,
  });
}

// ============================================================================
// LABELED TOGGLE FACTORIES
// ============================================================================

/**
 * Create a toggle with label
 */
export function createFakeToggleWithLabel(
  overrides?: Partial<FakeToggleWithLabel>
): FakeToggleWithLabel {
  const toggle = createFakeToggle(overrides);

  return {
    ...toggle,
    label: overrides?.label ?? toggle.ariaLabel,
    showLabel: overrides?.showLabel ?? faker.datatype.boolean({ probability: 0.5 }),
    ...overrides,
  };
}

// ============================================================================
// GROUP FACTORIES
// ============================================================================

/**
 * Create a formatting toggle group
 */
export function createFakeFormattingToggleGroup(
  overrides?: Partial<FakeFormattingToggleGroup>
): FakeFormattingToggleGroup {
  const formats: ('Bold' | 'Italic' | 'Strikethrough' | 'Underline')[] = [
    'Bold',
    'Italic',
    'Underline',
    'Strikethrough',
  ];

  return {
    id: faker.string.uuid(),
    toggles: formats.map((format) =>
      createFakeFormattingToggle(format, {
        pressed: faker.datatype.boolean({ probability: 0.3 }),
      })
    ),
    type: 'multiple',
    ...overrides,
  };
}

/**
 * Create an alignment toggle group
 */
export function createFakeAlignmentToggleGroup(): FakeFormattingToggleGroup {
  const alignments = ['AlignLeft', 'AlignCenter', 'AlignRight', 'AlignJustify'];
  const activeIndex = faker.number.int({ min: 0, max: 3 });

  return {
    id: faker.string.uuid(),
    toggles: alignments.map((icon, index) =>
      createFakeToggle({
        icon,
        iconType: 'align',
        ariaLabel: TOGGLE_ARIA_LABELS[icon],
        variant: 'outline',
        pressed: index === activeIndex,
      })
    ),
    type: 'single',
  };
}

/**
 * Create a view toggle pair (grid/list)
 */
export function createFakeViewTogglePair(
  overrides?: Partial<FakeViewTogglePair>
): FakeViewTogglePair {
  const activeView =
    overrides?.activeView ?? faker.helpers.arrayElement<'grid' | 'list'>(['grid', 'list']);

  return {
    activeView,
    gridToggle: createFakeToggle({
      icon: 'Grid',
      iconType: 'view',
      ariaLabel: i18n.t('factory.toggle.gridView', 'Grid view'),
      pressed: activeView === 'grid',
      variant: 'outline',
    }),
    id: faker.string.uuid(),
    listToggle: createFakeToggle({
      icon: 'List',
      iconType: 'view',
      ariaLabel: i18n.t('factory.toggle.listView', 'List view'),
      pressed: activeView === 'list',
      variant: 'outline',
    }),
    ...overrides,
  };
}

// ============================================================================
// MEDIA TOGGLE FACTORIES
// ============================================================================

/**
 * Create a media control toggle
 */
export function createFakeMediaToggle(
  type: 'mic' | 'playPause' | 'video' | 'volume' = 'playPause',
  overrides?: Partial<FakeMediaToggle>
): FakeMediaToggle {
  const configs: Record<
    string,
    { offIcon: string; offLabel: string; onIcon: string; onLabel: string }
  > = {
    mic: {
      offIcon: 'MicOff',
      offLabel: i18n.t('factory.toggle.unmute', 'Unmute'),
      onIcon: 'Mic',
      onLabel: i18n.t('factory.toggle.mute', 'Mute'),
    },
    playPause: {
      offIcon: 'Play',
      offLabel: i18n.t('factory.toggle.play', 'Play'),
      onIcon: 'Pause',
      onLabel: i18n.t('factory.toggle.pause', 'Pause'),
    },
    video: {
      offIcon: 'VideoOff',
      offLabel: i18n.t('factory.toggle.enableVideo', 'Enable video'),
      onIcon: 'Video',
      onLabel: i18n.t('factory.toggle.disableVideo', 'Disable video'),
    },
    volume: {
      offIcon: 'VolumeX',
      offLabel: i18n.t('factory.toggle.unmute', 'Unmute'),
      onIcon: 'Volume2',
      onLabel: i18n.t('factory.toggle.mute', 'Mute'),
    },
  };

  const config = configs[type];
  const pressed = overrides?.pressed ?? faker.datatype.boolean();

  return {
    ...createFakeToggle({
      icon: pressed ? config.onIcon : config.offIcon,
      iconType: 'media',
      ariaLabel: pressed ? config.onLabel : config.offLabel,
      pressed,
      ...overrides,
    }),
    offIcon: config.offIcon,
    offLabel: config.offLabel,
    onIcon: config.onIcon,
    onLabel: config.onLabel,
    ...overrides,
  };
}

/**
 * Create a play/pause toggle
 */
export function createFakePlayPauseToggle(overrides?: Partial<FakeMediaToggle>): FakeMediaToggle {
  return createFakeMediaToggle('playPause', overrides);
}

/**
 * Create a mute toggle
 */
export function createFakeMuteToggle(overrides?: Partial<FakeMediaToggle>): FakeMediaToggle {
  return createFakeMediaToggle('volume', overrides);
}

/**
 * Create a microphone toggle
 */
export function createFakeMicToggle(overrides?: Partial<FakeMediaToggle>): FakeMediaToggle {
  return createFakeMediaToggle('mic', overrides);
}

/**
 * Create a video toggle
 */
export function createFakeVideoToggle(overrides?: Partial<FakeMediaToggle>): FakeMediaToggle {
  return createFakeMediaToggle('video', overrides);
}

// ============================================================================
// STATE-SPECIFIC FACTORIES
// ============================================================================

/**
 * Create a pressed toggle
 */
export function createFakePressedToggle(overrides?: Partial<FakeToggle>): FakeToggle {
  return createFakeToggle({ pressed: true, ...overrides });
}

/**
 * Create an unpressed toggle
 */
export function createFakeUnpressedToggle(overrides?: Partial<FakeToggle>): FakeToggle {
  return createFakeToggle({ pressed: false, ...overrides });
}

/**
 * Create a disabled toggle
 */
export function createFakeDisabledToggle(overrides?: Partial<FakeToggle>): FakeToggle {
  return createFakeToggle({ disabled: true, ...overrides });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Create a matrix of toggles by variant
 */
export function createToggleVariantMatrix(): { toggle: FakeToggle; variant: ToggleVariant }[] {
  return TOGGLE_VARIANTS.map((variant) => ({
    toggle: createFakeToggle({ variant }),
    variant,
  }));
}

/**
 * Create a matrix of toggles by size
 */
export function createToggleSizeMatrix(): { size: ToggleSize; toggle: FakeToggle }[] {
  return TOGGLE_SIZES.map((size) => ({
    size,
    toggle: createFakeToggle({ size }),
  }));
}

/**
 * Create a matrix of toggles by state
 */
export function createToggleStateMatrix(): { state: ToggleState; toggle: FakeToggle }[] {
  return TOGGLE_STATES.map((state) => ({
    state,
    toggle: createFakeToggle({ pressed: state === 'on' }),
  }));
}

/**
 * Create a matrix of toggles by icon type
 */
export function createToggleIconTypeMatrix(): { iconType: ToggleIconType; toggle: FakeToggle }[] {
  return TOGGLE_ICON_TYPES.map((iconType) => ({
    iconType,
    toggle: createFakeToggle({ iconType }),
  }));
}

// ============================================================================
// SHOWCASE FACTORIES
// ============================================================================

/**
 * Create comprehensive toggle test data
 */
export function createToggleTestData(): {
  alignment: FakeFormattingToggleGroup;
  basic: FakeToggle;
  bookmark: FakeToggle;
  disabled: FakeToggle;
  favorite: FakeToggle;
  formatting: FakeFormattingToggleGroup;
  large: FakeToggle;
  mic: FakeMediaToggle;
  mute: FakeMediaToggle;
  notification: FakeToggle;
  outline: FakeToggle;
  playPause: FakeMediaToggle;
  pressed: FakeToggle;
  small: FakeToggle;
  unpressed: FakeToggle;
  video: FakeMediaToggle;
  viewPair: FakeViewTogglePair;
  withLabel: FakeToggleWithLabel;
} {
  return {
    alignment: createFakeAlignmentToggleGroup(),
    basic: createFakeToggle(),
    bookmark: createFakeBookmarkToggle(),
    disabled: createFakeDisabledToggle(),
    favorite: createFakeFavoriteToggle(),
    formatting: createFakeFormattingToggleGroup(),
    large: createFakeToggle({ size: 'lg' }),
    mic: createFakeMicToggle(),
    mute: createFakeMuteToggle(),
    notification: createFakeNotificationToggle(),
    outline: createFakeToggle({ variant: 'outline' }),
    playPause: createFakePlayPauseToggle(),
    pressed: createFakePressedToggle(),
    small: createFakeToggle({ size: 'sm' }),
    unpressed: createFakeUnpressedToggle(),
    video: createFakeVideoToggle(),
    viewPair: createFakeViewTogglePair(),
    withLabel: createFakeToggleWithLabel(),
  };
}

/**
 * Create a showcase of all toggle variants
 */
export function createToggleShowcase(): {
  iconTypeMatrix: ReturnType<typeof createToggleIconTypeMatrix>;
  sizeMatrix: ReturnType<typeof createToggleSizeMatrix>;
  stateMatrix: ReturnType<typeof createToggleStateMatrix>;
  testData: ReturnType<typeof createToggleTestData>;
  variantMatrix: ReturnType<typeof createToggleVariantMatrix>;
} {
  return {
    iconTypeMatrix: createToggleIconTypeMatrix(),
    sizeMatrix: createToggleSizeMatrix(),
    stateMatrix: createToggleStateMatrix(),
    testData: createToggleTestData(),
    variantMatrix: createToggleVariantMatrix(),
  };
}
