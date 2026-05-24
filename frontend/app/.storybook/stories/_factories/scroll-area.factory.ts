import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// SCROLL AREA FACTORY
// ============================================================================
// Comprehensive test data factories for the ScrollArea component.
// Follows the Button factory pattern with type exports, constants, and
// specialized factories for different scroll area configurations.
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Scrollbar orientation
 * @description Direction of the scrollbar
 */
export type ScrollbarOrientation = 'both' | 'horizontal' | 'vertical';

/**
 * Scroll area content type
 * @description The type of content within the scroll area
 */
export type ScrollAreaContentType =
  | 'cards'
  | 'code'
  | 'gallery'
  | 'list'
  | 'messages'
  | 'table'
  | 'text';

/**
 * Scroll area size preset
 * @description Common size configurations
 */
export type ScrollAreaSizePreset = 'auto' | 'lg' | 'md' | 'sm' | 'xl';

/**
 * Scrollbar visibility
 * @description When to show the scrollbar
 */
export type ScrollbarVisibility = 'always' | 'auto' | 'hover' | 'scroll';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All scrollbar orientations
 */
export const SCROLLBAR_ORIENTATIONS: ScrollbarOrientation[] = ['vertical', 'horizontal', 'both'];

/**
 * All content types
 */
export const SCROLL_AREA_CONTENT_TYPES: ScrollAreaContentType[] = [
  'list',
  'text',
  'code',
  'cards',
  'messages',
  'gallery',
  'table',
];

/**
 * All size presets
 */
export const SCROLL_AREA_SIZE_PRESETS: ScrollAreaSizePreset[] = ['sm', 'md', 'lg', 'xl', 'auto'];

/**
 * All scrollbar visibility options
 */
export const SCROLLBAR_VISIBILITY_OPTIONS: ScrollbarVisibility[] = [
  'auto',
  'always',
  'hover',
  'scroll',
];

/**
 * Size preset dimensions
 */
export const SIZE_DIMENSIONS: Record<ScrollAreaSizePreset, { height: string; width: string }> = {
  sm: { width: '200px', height: '150px' },
  md: { width: '300px', height: '200px' },
  lg: { width: '400px', height: '300px' },
  xl: { width: '500px', height: '400px' },
  auto: { width: '100%', height: '100%' },
};

/**
 * Common list item prefixes
 */
const LIST_ITEM_PREFIXES = [
  i18n.t('factory.scrollArea.item', 'Item'),
  i18n.t('factory.scrollArea.option', 'Option'),
  i18n.t('factory.scrollArea.element', 'Element'),
  i18n.t('factory.scrollArea.entry', 'Entry'),
  i18n.t('factory.scrollArea.record', 'Record'),
  'Row',
  i18n.t('factory.scrollArea.line', 'Line'),
  i18n.t('factory.scrollArea.file', 'File'),
  i18n.t('factory.scrollArea.document', 'Document'),
  i18n.t('factory.scrollArea.message', 'Message'),
];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Scroll area list item
 */
export interface FakeScrollItem {
  /** Item content/text */
  content: string;
  /** Unique identifier */
  id: string;
  /** Item index */
  index: number;
  /** Whether item is selected */
  isSelected?: boolean;
}

/**
 * Scroll area message item (for chat-like scrolling)
 */
export interface FakeScrollMessage {
  /** Message avatar URL */
  avatar?: string;
  /** Message content */
  content: string;
  /** Unique identifier */
  id: string;
  /** Whether from current user */
  isOwn: boolean;
  /** Sender name */
  sender: string;
  /** Message timestamp */
  timestamp: Date;
}

/**
 * Scroll area card item
 */
export interface FakeScrollCard {
  /** Card description */
  description?: string;
  /** Unique identifier */
  id: string;
  /** Card image URL */
  imageUrl?: string;
  /** Card title */
  title: string;
}

/**
 * Scroll area configuration
 */
export interface FakeScrollArea {
  /** Content items (generic) */
  content: FakeScrollItem[];
  /** Content type */
  contentType: ScrollAreaContentType;
  /** Height dimension */
  height: string;
  /** Unique identifier */
  id: string;
  /** Scrollbar orientation */
  orientation: ScrollbarOrientation;
  /** Scrollbar visibility */
  scrollbarVisibility: ScrollbarVisibility;
  /** Size preset */
  sizePreset: ScrollAreaSizePreset;
  /** Total scroll height (for progress calculation) */
  totalContentHeight?: number;
  /** Width dimension */
  width: string;
}

/**
 * Scroll area with list content
 */
export interface FakeScrollAreaList extends FakeScrollArea {
  /** List items */
  items: FakeScrollItem[];
}

/**
 * Scroll area with message content
 */
export interface FakeScrollAreaMessages extends FakeScrollArea {
  /** Message items */
  messages: FakeScrollMessage[];
}

/**
 * Scroll area with card content
 */
export interface FakeScrollAreaCards extends FakeScrollArea {
  /** Card items */
  cards: FakeScrollCard[];
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake scroll item
 * @param index - Item index
 * @param overrides - Optional property overrides
 * @returns A fake scroll item
 */
export function createFakeScrollItem(
  index: number,
  overrides?: Partial<FakeScrollItem>
): FakeScrollItem {
  const prefix = faker.helpers.arrayElement(LIST_ITEM_PREFIXES);
  return {
    id: faker.string.uuid(),
    index,
    content: `${prefix} ${index + 1}`,
    isSelected: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Creates multiple fake scroll items
 * @param count - Number of items to create
 * @param overrides - Optional property overrides
 * @returns Array of fake scroll items
 */
export function createFakeScrollItems(
  count: number,
  overrides?: Partial<FakeScrollItem>
): FakeScrollItem[] {
  return Array.from({ length: count }, (_, index) => createFakeScrollItem(index, overrides));
}

/**
 * Creates a fake scroll message
 * @param isOwn - Whether message is from current user
 * @param overrides - Optional property overrides
 * @returns A fake scroll message
 */
export function createFakeScrollMessage(
  isOwn: boolean = false,
  overrides?: Partial<FakeScrollMessage>
): FakeScrollMessage {
  return {
    id: faker.string.uuid(),
    sender: isOwn ? 'You' : faker.person.firstName(),
    content: faker.lorem.sentence(),
    timestamp: faker.date.recent({ days: 1 }),
    isOwn,
    avatar: isOwn ? undefined : faker.image.avatar(),
    ...overrides,
  };
}

/**
 * Creates multiple fake scroll messages
 * @param count - Number of messages to create
 * @returns Array of fake scroll messages
 */
export function createFakeScrollMessages(count: number): FakeScrollMessage[] {
  return Array.from({ length: count }, () =>
    createFakeScrollMessage(faker.datatype.boolean({ probability: 0.4 }))
  );
}

/**
 * Creates a fake scroll card
 * @param overrides - Optional property overrides
 * @returns A fake scroll card
 */
export function createFakeScrollCard(overrides?: Partial<FakeScrollCard>): FakeScrollCard {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.words({ min: 2, max: 4 }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.7 }),
    imageUrl: faker.helpers.maybe(() => faker.image.urlPicsumPhotos({ width: 200, height: 150 }), {
      probability: 0.5,
    }),
    ...overrides,
  };
}

/**
 * Creates multiple fake scroll cards
 * @param count - Number of cards to create
 * @param overrides - Optional property overrides
 * @returns Array of fake scroll cards
 */
export function createFakeScrollCards(
  count: number,
  overrides?: Partial<FakeScrollCard>
): FakeScrollCard[] {
  return Array.from({ length: count }, () => createFakeScrollCard(overrides));
}

/**
 * Creates a fake scroll area configuration
 * @param overrides - Optional property overrides
 * @returns A fake scroll area configuration
 */
export function createFakeScrollArea(overrides?: Partial<FakeScrollArea>): FakeScrollArea {
  const sizePreset = overrides?.sizePreset ?? faker.helpers.arrayElement(SCROLL_AREA_SIZE_PRESETS);
  const dimensions = SIZE_DIMENSIONS[sizePreset];
  const itemCount = faker.number.int({ min: 20, max: 100 });

  return {
    id: faker.string.uuid(),
    sizePreset,
    width: dimensions.width,
    height: dimensions.height,
    orientation: faker.helpers.arrayElement(SCROLLBAR_ORIENTATIONS),
    contentType: faker.helpers.arrayElement(SCROLL_AREA_CONTENT_TYPES),
    scrollbarVisibility: faker.helpers.arrayElement(SCROLLBAR_VISIBILITY_OPTIONS),
    content: createFakeScrollItems(itemCount),
    totalContentHeight: itemCount * 30, // Approximate content height
    ...overrides,
  };
}

/**
 * Creates multiple fake scroll areas
 * @param count - Number of scroll areas to create
 * @param overrides - Optional property overrides
 * @returns Array of fake scroll area configurations
 */
export function createFakeScrollAreas(
  count: number,
  overrides?: Partial<FakeScrollArea>
): FakeScrollArea[] {
  return Array.from({ length: count }, () => createFakeScrollArea(overrides));
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a vertical list scroll area
 * @param itemCount - Number of list items
 * @returns A vertical list scroll area
 */
export function createFakeVerticalListScrollArea(itemCount: number = 50): FakeScrollAreaList {
  const base = createFakeScrollArea({
    orientation: 'vertical',
    contentType: 'list',
    sizePreset: 'md',
  });

  return {
    ...base,
    items: createFakeScrollItems(itemCount),
    content: createFakeScrollItems(itemCount),
  };
}

/**
 * Creates a horizontal scroll area (gallery style)
 * @param cardCount - Number of cards
 * @returns A horizontal scroll area
 */
export function createFakeHorizontalScrollArea(cardCount: number = 10): FakeScrollAreaCards {
  const base = createFakeScrollArea({
    orientation: 'horizontal',
    contentType: 'gallery',
    height: '200px',
    width: '100%',
  });

  return {
    ...base,
    cards: createFakeScrollCards(cardCount),
    content: createFakeScrollItems(cardCount),
  };
}

/**
 * Creates a chat/message scroll area
 * @param messageCount - Number of messages
 * @returns A message scroll area
 */
export function createFakeMessageScrollArea(messageCount: number = 30): FakeScrollAreaMessages {
  const base = createFakeScrollArea({
    orientation: 'vertical',
    contentType: 'messages',
    sizePreset: 'lg',
  });

  return {
    ...base,
    messages: createFakeScrollMessages(messageCount),
    content: createFakeScrollItems(messageCount),
  };
}

/**
 * Creates a code scroll area
 * @param lineCount - Number of code lines
 * @returns A code scroll area
 */
export function createFakeCodeScrollArea(lineCount: number = 100): FakeScrollArea {
  const lines = Array.from({ length: lineCount }, (_, i) =>
    createFakeScrollItem(i, {
      content: `${String(i + 1).padStart(3, ' ')} | ${faker.hacker.phrase()}`,
    })
  );

  return createFakeScrollArea({
    orientation: 'both',
    contentType: 'code',
    sizePreset: 'lg',
    content: lines,
  });
}

/**
 * Creates a small scroll area
 * @param itemCount - Number of items
 * @returns A small scroll area
 */
export function createFakeSmallScrollArea(itemCount: number = 20): FakeScrollArea {
  return createFakeScrollArea({
    sizePreset: 'sm',
    content: createFakeScrollItems(itemCount),
  });
}

/**
 * Creates a large scroll area
 * @param itemCount - Number of items
 * @returns A large scroll area
 */
export function createFakeLargeScrollArea(itemCount: number = 200): FakeScrollArea {
  return createFakeScrollArea({
    sizePreset: 'xl',
    content: createFakeScrollItems(itemCount),
  });
}

/**
 * Creates a scroll area with always-visible scrollbars
 * @returns A scroll area with always-visible scrollbars
 */
export function createFakeAlwaysVisibleScrollbarArea(): FakeScrollArea {
  return createFakeScrollArea({
    scrollbarVisibility: 'always',
  });
}

/**
 * Creates a scroll area with both scrollbars
 * @param width - Content width
 * @param height - Content height
 * @returns A scroll area with both scrollbars
 */
export function createFakeBothScrollbarsArea(
  _width: number = 1000,
  height: number = 1000
): FakeScrollArea {
  return createFakeScrollArea({
    orientation: 'both',
    totalContentHeight: height,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of scroll areas across orientations
 * @returns Grid of scroll areas for each orientation
 */
export function createScrollAreaOrientationMatrix(): FakeScrollArea[] {
  return SCROLLBAR_ORIENTATIONS.map((orientation) => createFakeScrollArea({ orientation }));
}

/**
 * Creates a matrix of scroll areas across size presets
 * @returns Grid of scroll areas for each size
 */
export function createScrollAreaSizeMatrix(): FakeScrollArea[] {
  return SCROLL_AREA_SIZE_PRESETS.map((sizePreset) => createFakeScrollArea({ sizePreset }));
}

/**
 * Creates a matrix of scroll areas across content types
 * @returns Grid of scroll areas for each content type
 */
export function createScrollAreaContentTypeMatrix(): FakeScrollArea[] {
  return SCROLL_AREA_CONTENT_TYPES.map((contentType) => createFakeScrollArea({ contentType }));
}

/**
 * Creates a matrix of scroll areas across visibility options
 * @returns Grid of scroll areas for each visibility option
 */
export function createScrollAreaVisibilityMatrix(): FakeScrollArea[] {
  return SCROLLBAR_VISIBILITY_OPTIONS.map((scrollbarVisibility) =>
    createFakeScrollArea({ scrollbarVisibility })
  );
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all scroll area configurations
 * @returns Array of scroll area configs for showcase
 */
export function createScrollAreaShowcase(): Array<{
  description: string;
  name: string;
  scrollArea: FakeScrollArea | FakeScrollAreaCards | FakeScrollAreaList | FakeScrollAreaMessages;
}> {
  return [
    {
      name: i18n.t('factory.scrollArea.verticalList', 'Vertical List'),
      description: i18n.t(
        'factory.scrollArea.standardVerticalScrollingList',
        'Standard vertical scrolling list'
      ),
      scrollArea: createFakeVerticalListScrollArea(),
    },
    {
      name: i18n.t('factory.scrollArea.horizontalGallery', 'Horizontal Gallery'),
      description: i18n.t(
        'factory.scrollArea.horizontalScrollingCardGallery',
        'Horizontal scrolling card gallery'
      ),
      scrollArea: createFakeHorizontalScrollArea(),
    },
    {
      name: i18n.t('factory.scrollArea.chatMessages', 'Chat Messages'),
      description: i18n.t(
        'factory.scrollArea.chatstyleMessageScrollArea',
        'Chat-style message scroll area'
      ),
      scrollArea: createFakeMessageScrollArea(),
    },
    {
      name: i18n.t('factory.scrollArea.codeBlock', 'Code Block'),
      description: i18n.t(
        'factory.scrollArea.codeEditorWithLineNumbers',
        'Code editor with line numbers'
      ),
      scrollArea: createFakeCodeScrollArea(),
    },
    {
      name: i18n.t('factory.scrollArea.small', 'Small'),
      description: i18n.t('factory.scrollArea.compactScrollArea', 'Compact scroll area'),
      scrollArea: createFakeSmallScrollArea(),
    },
    {
      name: i18n.t('factory.scrollArea.large', 'Large'),
      description: i18n.t(
        'factory.scrollArea.largeScrollAreaWithMany',
        'Large scroll area with many items'
      ),
      scrollArea: createFakeLargeScrollArea(),
    },
    {
      name: i18n.t('factory.scrollArea.bothScrollbars', 'Both Scrollbars'),
      description: i18n.t(
        'factory.scrollArea.bothVerticalAndHorizontalScrolling',
        'Both vertical and horizontal scrolling'
      ),
      scrollArea: createFakeBothScrollbarsArea(),
    },
    {
      name: i18n.t('factory.scrollArea.alwaysVisible', 'Always Visible'),
      description: i18n.t(
        'factory.scrollArea.scrollbarsAlwaysVisible',
        'Scrollbars always visible'
      ),
      scrollArea: createFakeAlwaysVisibleScrollbarArea(),
    },
  ];
}

/**
 * Creates a complete test data set for scroll area testing
 * @returns Comprehensive test data
 */
export function createScrollAreaTestData(): {
  cards: FakeScrollCard[];
  codeScrollArea: FakeScrollArea;
  contentTypeMatrix: FakeScrollArea[];
  horizontalScrollArea: FakeScrollAreaCards;
  items: FakeScrollItem[];
  messages: FakeScrollMessage[];
  messageScrollArea: FakeScrollAreaMessages;
  orientationMatrix: FakeScrollArea[];
  scrollAreas: FakeScrollArea[];
  showcase: Array<{
    description: string;
    name: string;
    scrollArea: FakeScrollArea | FakeScrollAreaCards | FakeScrollAreaList | FakeScrollAreaMessages;
  }>;
  sizeMatrix: FakeScrollArea[];
  verticalListScrollArea: FakeScrollAreaList;
  visibilityMatrix: FakeScrollArea[];
} {
  return {
    items: createFakeScrollItems(50),
    messages: createFakeScrollMessages(20),
    cards: createFakeScrollCards(10),
    scrollAreas: createFakeScrollAreas(5),
    verticalListScrollArea: createFakeVerticalListScrollArea(),
    horizontalScrollArea: createFakeHorizontalScrollArea(),
    messageScrollArea: createFakeMessageScrollArea(),
    codeScrollArea: createFakeCodeScrollArea(),
    orientationMatrix: createScrollAreaOrientationMatrix(),
    sizeMatrix: createScrollAreaSizeMatrix(),
    contentTypeMatrix: createScrollAreaContentTypeMatrix(),
    visibilityMatrix: createScrollAreaVisibilityMatrix(),
    showcase: createScrollAreaShowcase(),
  };
}
