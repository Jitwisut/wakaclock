import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// SKELETON FACTORY
// ============================================================================
// Comprehensive test data factories for the Skeleton component.
// Follows the Button factory pattern with type exports, constants, and
// specialized factories for different skeleton configurations.
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Skeleton shape
 * @description Shape of the skeleton element
 */
export type SkeletonShape = 'circle' | 'rectangle' | 'rounded';

/**
 * Skeleton size preset
 * @description Common size configurations
 */
export type SkeletonSize = 'full' | 'lg' | 'md' | 'sm' | 'xl' | 'xs';

/**
 * Skeleton animation
 * @description Animation style
 */
export type SkeletonAnimation = 'none' | 'pulse' | 'shimmer' | 'wave';

/**
 * Skeleton content type
 * @description Common use cases for skeletons
 */
export type SkeletonContentType =
  | 'avatar'
  | 'button'
  | 'card'
  | 'form'
  | 'image'
  | 'list'
  | 'paragraph'
  | 'table'
  | 'text';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All skeleton shapes
 */
export const SKELETON_SHAPES: SkeletonShape[] = ['rectangle', 'rounded', 'circle'];

/**
 * All skeleton sizes
 */
export const SKELETON_SIZES: SkeletonSize[] = ['xs', 'sm', 'md', 'lg', 'xl', 'full'];

/**
 * All skeleton animations
 */
export const SKELETON_ANIMATIONS: SkeletonAnimation[] = ['pulse', 'shimmer', 'wave', 'none'];

/**
 * All content types
 */
export const SKELETON_CONTENT_TYPES: SkeletonContentType[] = [
  'text',
  'paragraph',
  'avatar',
  'button',
  'card',
  'list',
  'table',
  'form',
  'image',
];

/**
 * Size to dimension mapping
 */
export const SIZE_DIMENSIONS: Record<SkeletonSize, { height: string; width: string }> = {
  xs: { width: '50px', height: '12px' },
  sm: { width: '100px', height: '16px' },
  md: { width: '150px', height: '20px' },
  lg: { width: '200px', height: '24px' },
  xl: { width: '250px', height: '32px' },
  full: { width: '100%', height: '100%' },
};

/**
 * Common avatar sizes
 */
export const AVATAR_SIZES = {
  xs: { className: 'size-6', pixels: 24 },
  sm: { className: 'size-8', pixels: 32 },
  md: { className: 'size-10', pixels: 40 },
  lg: { className: 'size-12', pixels: 48 },
  xl: { className: 'size-16', pixels: 64 },
  full: { className: 'size-full', pixels: 100 },
};

/**
 * Common text line heights
 */
export const TEXT_LINE_HEIGHTS = ['h-3', 'h-4', 'h-5', 'h-6'];

/**
 * Common text line widths
 */
export const TEXT_LINE_WIDTHS = ['w-1/4', 'w-1/3', 'w-1/2', 'w-2/3', 'w-3/4', 'w-full'];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Skeleton configuration
 */
export interface FakeSkeleton {
  /** Animation type */
  animation: SkeletonAnimation;
  /** Additional CSS classes */
  className?: string;
  /** Content type this skeleton represents */
  contentType: SkeletonContentType;
  /** Height (CSS value or Tailwind class) */
  height: string;
  /** Unique identifier */
  id: string;
  /** Whether skeleton is currently loading */
  isLoading: boolean;
  /** Shape of the skeleton */
  shape: SkeletonShape;
  /** Size preset */
  size: SkeletonSize;
  /** Width (CSS value or Tailwind class) */
  width: string;
}

/**
 * Text line skeleton
 */
export interface FakeSkeletonTextLine {
  /** Height class */
  height: string;
  /** Unique identifier */
  id: string;
  /** Width class or percentage */
  width: string;
}

/**
 * Paragraph skeleton (multiple lines)
 */
export interface FakeSkeletonParagraph {
  /** Gap between lines */
  gap: string;
  /** Unique identifier */
  id: string;
  /** Number of lines */
  lineCount: number;
  /** Text lines */
  lines: FakeSkeletonTextLine[];
}

/**
 * Avatar skeleton
 */
export interface FakeSkeletonAvatar {
  /** Unique identifier */
  id: string;
  /** Size class */
  size: SkeletonSize;
  /** Size class name */
  sizeClass: string;
  /** Size in pixels */
  sizePixels: number;
}

/**
 * Card skeleton
 */
export interface FakeSkeletonCard {
  /** Has action buttons */
  hasActions?: boolean;
  /** Has description */
  hasDescription?: boolean;
  /** Has footer */
  hasFooter?: boolean;
  /** Has header */
  hasHeader?: boolean;
  /** Has image */
  hasImage?: boolean;
  /** Card height */
  height: string;
  /** Unique identifier */
  id: string;
  /** Card width */
  width: string;
}

/**
 * List item skeleton
 */
export interface FakeSkeletonListItem {
  /** Has action */
  hasAction?: boolean;
  /** Has avatar */
  hasAvatar?: boolean;
  /** Has description */
  hasDescription?: boolean;
  /** Unique identifier */
  id: string;
}

/**
 * List skeleton
 */
export interface FakeSkeletonList {
  /** Gap between items */
  gap: string;
  /** Unique identifier */
  id: string;
  /** Number of items */
  itemCount: number;
  /** List items */
  items: FakeSkeletonListItem[];
}

/**
 * Table skeleton
 */
export interface FakeSkeletonTable {
  /** Column count */
  columns: number;
  /** Has header */
  hasHeader: boolean;
  /** Unique identifier */
  id: string;
  /** Row count */
  rows: number;
}

/**
 * Form skeleton
 */
export interface FakeSkeletonForm {
  /** Fields */
  fields: FakeSkeletonFormField[];
  /** Has submit button */
  hasSubmitButton: boolean;
  /** Unique identifier */
  id: string;
}

/**
 * Form field skeleton
 */
export interface FakeSkeletonFormField {
  /** Has label */
  hasLabel: boolean;
  /** Unique identifier */
  id: string;
  /** Field type */
  type: 'checkbox' | 'input' | 'select' | 'textarea';
}

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake skeleton configuration
 * @param overrides - Optional property overrides
 * @returns A fake skeleton configuration
 */
export function createFakeSkeleton(overrides?: Partial<FakeSkeleton>): FakeSkeleton {
  const size = overrides?.size ?? faker.helpers.arrayElement(SKELETON_SIZES);
  const dimensions = SIZE_DIMENSIONS[size];

  return {
    id: faker.string.uuid(),
    shape: faker.helpers.arrayElement(SKELETON_SHAPES),
    size,
    width: dimensions.width,
    height: dimensions.height,
    animation: faker.helpers.arrayElement(SKELETON_ANIMATIONS),
    contentType: faker.helpers.arrayElement(SKELETON_CONTENT_TYPES),
    isLoading: true,
    className: faker.helpers.maybe(() => faker.helpers.arrayElement(['rounded-md', 'rounded-lg']), {
      probability: 0.3,
    }),
    ...overrides,
  };
}

/**
 * Creates multiple fake skeletons
 * @param count - Number of skeletons to create
 * @param overrides - Optional property overrides
 * @returns Array of fake skeleton configurations
 */
export function createFakeSkeletons(
  count: number,
  overrides?: Partial<FakeSkeleton>
): FakeSkeleton[] {
  return Array.from({ length: count }, () => createFakeSkeleton(overrides));
}

/**
 * Creates a fake text line skeleton
 * @param overrides - Optional property overrides
 * @returns A fake text line skeleton
 */
export function createFakeSkeletonTextLine(
  overrides?: Partial<FakeSkeletonTextLine>
): FakeSkeletonTextLine {
  return {
    id: faker.string.uuid(),
    width: faker.helpers.arrayElement(TEXT_LINE_WIDTHS),
    height: faker.helpers.arrayElement(TEXT_LINE_HEIGHTS),
    ...overrides,
  };
}

/**
 * Creates multiple fake text line skeletons
 * @param count - Number of lines to create
 * @returns Array of fake text line skeletons
 */
export function createFakeSkeletonTextLines(count: number): FakeSkeletonTextLine[] {
  return Array.from({ length: count }, (_, i) => {
    // Last line is usually shorter
    const isLastLine = i === count - 1;
    return createFakeSkeletonTextLine({
      width: isLastLine ? faker.helpers.arrayElement(['w-1/4', 'w-1/3', 'w-1/2']) : 'w-full',
    });
  });
}

/**
 * Creates a fake paragraph skeleton
 * @param lineCount - Number of lines
 * @param overrides - Optional property overrides
 * @returns A fake paragraph skeleton
 */
export function createFakeSkeletonParagraph(
  lineCount: number = 4,
  overrides?: Partial<FakeSkeletonParagraph>
): FakeSkeletonParagraph {
  return {
    id: faker.string.uuid(),
    lineCount,
    lines: createFakeSkeletonTextLines(lineCount),
    gap: faker.helpers.arrayElement(['space-y-2', 'space-y-3', 'space-y-4']),
    ...overrides,
  };
}

/**
 * Creates a fake avatar skeleton
 * @param size - Avatar size
 * @param overrides - Optional property overrides
 * @returns A fake avatar skeleton
 */
export function createFakeSkeletonAvatar(
  size: SkeletonSize = 'md',
  overrides?: Partial<FakeSkeletonAvatar>
): FakeSkeletonAvatar {
  const avatarSize = AVATAR_SIZES[size] || AVATAR_SIZES.md;
  return {
    id: faker.string.uuid(),
    size,
    sizeClass: avatarSize.className,
    sizePixels: avatarSize.pixels,
    ...overrides,
  };
}

/**
 * Creates a fake card skeleton
 * @param overrides - Optional property overrides
 * @returns A fake card skeleton
 */
export function createFakeSkeletonCard(overrides?: Partial<FakeSkeletonCard>): FakeSkeletonCard {
  return {
    id: faker.string.uuid(),
    width: faker.helpers.arrayElement(['w-[300px]', 'w-[350px]', 'w-full']),
    height: faker.helpers.arrayElement(['h-auto', 'h-[200px]', 'h-[250px]']),
    hasImage: faker.datatype.boolean({ probability: 0.6 }),
    hasHeader: faker.datatype.boolean({ probability: 0.8 }),
    hasDescription: faker.datatype.boolean({ probability: 0.7 }),
    hasFooter: faker.datatype.boolean({ probability: 0.5 }),
    hasActions: faker.datatype.boolean({ probability: 0.4 }),
    ...overrides,
  };
}

/**
 * Creates a fake list item skeleton
 * @param overrides - Optional property overrides
 * @returns A fake list item skeleton
 */
export function createFakeSkeletonListItem(
  overrides?: Partial<FakeSkeletonListItem>
): FakeSkeletonListItem {
  return {
    id: faker.string.uuid(),
    hasAvatar: faker.datatype.boolean({ probability: 0.6 }),
    hasDescription: faker.datatype.boolean({ probability: 0.5 }),
    hasAction: faker.datatype.boolean({ probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Creates a fake list skeleton
 * @param itemCount - Number of items
 * @param overrides - Optional property overrides
 * @returns A fake list skeleton
 */
export function createFakeSkeletonList(
  itemCount: number = 5,
  overrides?: Partial<FakeSkeletonList>
): FakeSkeletonList {
  return {
    id: faker.string.uuid(),
    itemCount,
    items: Array.from({ length: itemCount }, () => createFakeSkeletonListItem()),
    gap: faker.helpers.arrayElement(['space-y-2', 'space-y-3', 'space-y-4']),
    ...overrides,
  };
}

/**
 * Creates a fake table skeleton
 * @param rows - Number of rows
 * @param columns - Number of columns
 * @param overrides - Optional property overrides
 * @returns A fake table skeleton
 */
export function createFakeSkeletonTable(
  rows: number = 5,
  columns: number = 4,
  overrides?: Partial<FakeSkeletonTable>
): FakeSkeletonTable {
  return {
    id: faker.string.uuid(),
    rows,
    columns,
    hasHeader: true,
    ...overrides,
  };
}

/**
 * Creates a fake form field skeleton
 * @param overrides - Optional property overrides
 * @returns A fake form field skeleton
 */
export function createFakeSkeletonFormField(
  overrides?: Partial<FakeSkeletonFormField>
): FakeSkeletonFormField {
  return {
    id: faker.string.uuid(),
    type: faker.helpers.arrayElement(['input', 'textarea', 'select', 'checkbox']),
    hasLabel: faker.datatype.boolean({ probability: 0.9 }),
    ...overrides,
  };
}

/**
 * Creates a fake form skeleton
 * @param fieldCount - Number of fields
 * @param overrides - Optional property overrides
 * @returns A fake form skeleton
 */
export function createFakeSkeletonForm(
  fieldCount: number = 4,
  overrides?: Partial<FakeSkeletonForm>
): FakeSkeletonForm {
  return {
    id: faker.string.uuid(),
    fields: Array.from({ length: fieldCount }, () => createFakeSkeletonFormField()),
    hasSubmitButton: true,
    ...overrides,
  };
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a profile skeleton (avatar + name + description)
 * @returns Profile skeleton configuration
 */
export function createFakeProfileSkeleton(): {
  avatar: FakeSkeletonAvatar;
  description: FakeSkeletonTextLine;
  id: string;
  name: FakeSkeletonTextLine;
} {
  return {
    id: faker.string.uuid(),
    avatar: createFakeSkeletonAvatar('lg'),
    name: createFakeSkeletonTextLine({ width: 'w-32', height: 'h-5' }),
    description: createFakeSkeletonTextLine({ width: 'w-24', height: 'h-4' }),
  };
}

/**
 * Creates a post skeleton (image + title + paragraph)
 * @returns Post skeleton configuration
 */
export function createFakePostSkeleton(): {
  id: string;
  image: FakeSkeleton;
  paragraph: FakeSkeletonParagraph;
  title: FakeSkeletonTextLine;
} {
  return {
    id: faker.string.uuid(),
    image: createFakeSkeleton({
      shape: 'rounded',
      width: 'w-full',
      height: 'h-48',
      contentType: 'image',
    }),
    title: createFakeSkeletonTextLine({ width: 'w-3/4', height: 'h-6' }),
    paragraph: createFakeSkeletonParagraph(3),
  };
}

/**
 * Creates a comment skeleton (avatar + text)
 * @returns Comment skeleton configuration
 */
export function createFakeCommentSkeleton(): {
  avatar: FakeSkeletonAvatar;
  id: string;
  text: FakeSkeletonParagraph;
  username: FakeSkeletonTextLine;
} {
  return {
    id: faker.string.uuid(),
    avatar: createFakeSkeletonAvatar('sm'),
    username: createFakeSkeletonTextLine({ width: 'w-20', height: 'h-4' }),
    text: createFakeSkeletonParagraph(2),
  };
}

/**
 * Creates a product skeleton (image + details)
 * @returns Product skeleton configuration
 */
export function createFakeProductSkeleton(): {
  description: FakeSkeletonTextLine;
  id: string;
  image: FakeSkeleton;
  price: FakeSkeletonTextLine;
  rating: FakeSkeleton;
  title: FakeSkeletonTextLine;
} {
  return {
    id: faker.string.uuid(),
    image: createFakeSkeleton({
      shape: 'rounded',
      width: 'w-full',
      height: 'h-40',
      contentType: 'image',
    }),
    title: createFakeSkeletonTextLine({ width: 'w-3/4', height: 'h-5' }),
    description: createFakeSkeletonTextLine({ width: 'w-full', height: 'h-4' }),
    price: createFakeSkeletonTextLine({ width: 'w-16', height: 'h-6' }),
    rating: createFakeSkeleton({ width: 'w-24', height: 'h-4', shape: 'rounded' }),
  };
}

/**
 * Creates a stats card skeleton
 * @returns Stats card skeleton configuration
 */
export function createFakeStatsCardSkeleton(): {
  change: FakeSkeletonTextLine;
  id: string;
  label: FakeSkeletonTextLine;
  value: FakeSkeletonTextLine;
} {
  return {
    id: faker.string.uuid(),
    label: createFakeSkeletonTextLine({ width: 'w-20', height: 'h-4' }),
    value: createFakeSkeletonTextLine({ width: 'w-16', height: 'h-8' }),
    change: createFakeSkeletonTextLine({ width: 'w-12', height: 'h-4' }),
  };
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of skeletons across shapes
 * @returns Grid of skeletons for each shape
 */
export function createSkeletonShapeMatrix(): FakeSkeleton[] {
  return SKELETON_SHAPES.map((shape) =>
    createFakeSkeleton({
      shape,
      size: 'md',
    })
  );
}

/**
 * Creates a matrix of skeletons across sizes
 * @returns Grid of skeletons for each size
 */
export function createSkeletonSizeMatrix(): FakeSkeleton[] {
  return SKELETON_SIZES.map((size) =>
    createFakeSkeleton({
      size,
    })
  );
}

/**
 * Creates a matrix of avatar skeletons across sizes
 * @returns Grid of avatar skeletons for each size
 */
export function createSkeletonAvatarSizeMatrix(): FakeSkeletonAvatar[] {
  return (['xs', 'sm', 'md', 'lg', 'xl'] as SkeletonSize[]).map((size) =>
    createFakeSkeletonAvatar(size)
  );
}

// ============================================================================
// SHOWCASE FACTORY
// ============================================================================

/**
 * Creates a comprehensive showcase of all skeleton configurations
 * @returns Array of skeleton configs for showcase
 */
export function createSkeletonShowcase(): Array<{
  description: string;
  name: string;
  skeleton:
    | FakeSkeleton
    | FakeSkeletonAvatar
    | FakeSkeletonCard
    | FakeSkeletonForm
    | FakeSkeletonList
    | FakeSkeletonParagraph
    | FakeSkeletonTable;
}> {
  return [
    {
      name: i18n.t('factory.skeleton.textLine', 'Text Line'),
      description: i18n.t('factory.skeleton.singleLineOfText', 'Single line of text'),
      skeleton: createFakeSkeleton({ contentType: 'text', width: 'w-48', height: 'h-4' }),
    },
    {
      name: i18n.t('factory.skeleton.paragraph', 'Paragraph'),
      description: i18n.t('factory.skeleton.multipleLinesOfText', 'Multiple lines of text'),
      skeleton: createFakeSkeletonParagraph(4),
    },
    {
      name: i18n.t('factory.skeleton.avatar', 'Avatar'),
      description: i18n.t('factory.skeleton.circularUserAvatar', 'Circular user avatar'),
      skeleton: createFakeSkeletonAvatar('md'),
    },
    {
      name: i18n.t('factory.skeleton.card', 'Card'),
      description: i18n.t(
        'factory.skeleton.cardWithImageAndContent',
        'Card with image and content'
      ),
      skeleton: createFakeSkeletonCard({ hasImage: true, hasHeader: true, hasDescription: true }),
    },
    {
      name: i18n.t('factory.skeleton.list', 'List'),
      description: i18n.t('factory.skeleton.verticalListOfItems', 'Vertical list of items'),
      skeleton: createFakeSkeletonList(5),
    },
    {
      name: i18n.t('factory.skeleton.table', 'Table'),
      description: i18n.t(
        'factory.skeleton.dataTableWithRowsAnd',
        'Data table with rows and columns'
      ),
      skeleton: createFakeSkeletonTable(5, 4),
    },
    {
      name: i18n.t('factory.skeleton.form', 'Form'),
      description: i18n.t('factory.skeleton.formWithInputFields', 'Form with input fields'),
      skeleton: createFakeSkeletonForm(4),
    },
    {
      name: i18n.t('factory.skeleton.small', 'Small'),
      description: i18n.t('factory.skeleton.extraSmallSkeleton', 'Extra small skeleton'),
      skeleton: createFakeSkeleton({ size: 'xs' }),
    },
    {
      name: i18n.t('factory.skeleton.large', 'Large'),
      description: i18n.t('factory.skeleton.largeSkeleton', 'Large skeleton'),
      skeleton: createFakeSkeleton({ size: 'lg' }),
    },
  ];
}

// ============================================================================
// TEST DATA FACTORY
// ============================================================================

/**
 * Creates a complete test data set for skeleton testing
 * @returns Comprehensive test data
 */
export function createSkeletonTestData(): {
  avatars: FakeSkeletonAvatar[];
  avatarSizeMatrix: FakeSkeletonAvatar[];
  basicSkeleton: FakeSkeleton;
  card: FakeSkeletonCard;
  comment: ReturnType<typeof createFakeCommentSkeleton>;
  form: FakeSkeletonForm;
  list: FakeSkeletonList;
  paragraph: FakeSkeletonParagraph;
  post: ReturnType<typeof createFakePostSkeleton>;
  product: ReturnType<typeof createFakeProductSkeleton>;
  profile: ReturnType<typeof createFakeProfileSkeleton>;
  shapeMatrix: FakeSkeleton[];
  showcase: Array<{
    description: string;
    name: string;
    skeleton:
      | FakeSkeleton
      | FakeSkeletonAvatar
      | FakeSkeletonCard
      | FakeSkeletonForm
      | FakeSkeletonList
      | FakeSkeletonParagraph
      | FakeSkeletonTable;
  }>;
  sizeMatrix: FakeSkeleton[];
  skeletons: FakeSkeleton[];
  statsCard: ReturnType<typeof createFakeStatsCardSkeleton>;
  table: FakeSkeletonTable;
  textLines: FakeSkeletonTextLine[];
} {
  return {
    skeletons: createFakeSkeletons(5),
    basicSkeleton: createFakeSkeleton(),
    textLines: createFakeSkeletonTextLines(5),
    paragraph: createFakeSkeletonParagraph(4),
    avatars: (['xs', 'sm', 'md', 'lg', 'xl'] as SkeletonSize[]).map((size) =>
      createFakeSkeletonAvatar(size)
    ),
    card: createFakeSkeletonCard(),
    list: createFakeSkeletonList(),
    table: createFakeSkeletonTable(),
    form: createFakeSkeletonForm(),
    profile: createFakeProfileSkeleton(),
    post: createFakePostSkeleton(),
    comment: createFakeCommentSkeleton(),
    product: createFakeProductSkeleton(),
    statsCard: createFakeStatsCardSkeleton(),
    shapeMatrix: createSkeletonShapeMatrix(),
    sizeMatrix: createSkeletonSizeMatrix(),
    avatarSizeMatrix: createSkeletonAvatarSizeMatrix(),
    showcase: createSkeletonShowcase(),
  };
}
