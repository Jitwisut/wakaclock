import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import type {
  FakeSkeleton,
  FakeSkeletonAvatar,
  FakeSkeletonCard,
  FakeSkeletonForm,
  FakeSkeletonFormField,
  FakeSkeletonList,
  FakeSkeletonListItem,
  FakeSkeletonParagraph,
  FakeSkeletonTable,
  FakeSkeletonTextLine,
  SkeletonAnimation,
  SkeletonContentType,
  SkeletonShape,
  SkeletonSize,
} from '@/.storybook/stories/_factories/skeleton.factory';
import {
  AVATAR_SIZES,
  createFakeCommentSkeleton,
  createFakePostSkeleton,
  createFakeProductSkeleton,
  createFakeProfileSkeleton,
  createFakeSkeleton,
  createFakeSkeletonAvatar,
  createFakeSkeletonCard,
  createFakeSkeletonForm,
  createFakeSkeletonFormField,
  createFakeSkeletonList,
  createFakeSkeletonListItem,
  createFakeSkeletonParagraph,
  createFakeSkeletons,
  createFakeSkeletonTable,
  createFakeSkeletonTextLine,
  createFakeSkeletonTextLines,
  createFakeStatsCardSkeleton,
  createSkeletonAvatarSizeMatrix,
  createSkeletonShapeMatrix,
  createSkeletonShowcase,
  createSkeletonSizeMatrix,
  createSkeletonTestData,
  SIZE_DIMENSIONS,
  SKELETON_ANIMATIONS,
  SKELETON_CONTENT_TYPES,
  SKELETON_SHAPES,
  SKELETON_SIZES,
  TEXT_LINE_HEIGHTS,
  TEXT_LINE_WIDTHS,
} from '@/.storybook/stories/_factories/skeleton.factory';
import {
  skeletonHandlers,
  skeletonStatusHandlers,
} from '@/.storybook/stories/_handlers/skeleton.handlers';

import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

/** Maps a form field type to a Tailwind height class */
function fieldTypeToHeightClass(type: string): string {
  if (type === 'textarea') return 'h-24';
  if (type === 'checkbox') return 'size-5';
  return 'h-10';
}

/** Maps a skeleton shape to a Tailwind border-radius class */
function shapeToRoundedClass(shape: string): string {
  if (shape === 'circle') return 'rounded-full';
  if (shape === 'rounded') return 'rounded-lg';
  return '';
}

const meta = {
  title: 'Components/UI/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  parameters: {
    msw: {
      handlers: skeletonHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    children: {
      control: false,
      description: i18n.t(
        'skeleton.argType.skeletonDoesNotRenderChildrenPresentationalOnly',
        'Skeleton does not render children (presentational only)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'never' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t(
        'skeleton.argType.cssClassesToControlSizeAndShapeOfSkeleton',
        'CSS classes to control size and shape of skeleton'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    'aria-hidden': {
      control: 'boolean',
      description: i18n.t(
        'skeleton.argType.whetherTheSkeletonIsHiddenFromAssistiveTechnology',
        'Whether the skeleton is hidden from assistive technology'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    style: {
      control: 'object',
      description: i18n.t(
        'skeleton.argType.inlineStylesForCustomDimensions',
        'Inline styles for custom dimensions'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'React.CSSProperties' },
      },
    },
    // Accessibility
    'aria-label': {
      control: 'text',
      description: i18n.t(
        'skeleton.argType.accessibleLabelForScreenReaders',
        'Accessible label for screen readers'
      ),
      table: {
        category: 'Accessibility',
        type: { summary: 'string' },
      },
    },
    role: {
      control: 'text',
      description: i18n.t(
        'skeleton.argType.ariaRoleForTheSkeletonElement',
        'ARIA role for the skeleton element'
      ),
      table: {
        category: 'Accessibility',
        defaultValue: { summary: 'presentation' },
        type: { summary: 'string' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('skeleton.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('skeleton.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('skeleton.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('skeleton.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('skeleton.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('skeleton.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('skeleton.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => <Skeleton className="h-4 w-[200px]" />,
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify skeleton has animate-pulse class
    const skeleton = canvasElement.querySelector('[data-slot="skeleton"]');
    expect(skeleton?.className).toContain('animate-pulse');
  },
};

function SkeletonVariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('skeleton.variants.text')}</p>
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[180px]" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('skeleton.variants.avatar')}</p>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-3 w-[100px]" />
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('skeleton.variants.card')}</p>
        <div className="w-[300px] space-y-3 rounded-xl border p-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('skeleton.variants.tableRow')}</p>
        <div className="w-full space-y-3">
          <div className="flex gap-4 border-b pb-3">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[80px]" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[80px]" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[80px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <SkeletonVariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify multiple skeleton elements are rendered
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);

    // Verify text content for section labels exists
    expect(canvas.getByText(/Text/i)).toBeInTheDocument();
    expect(canvas.getByText(/Avatar/i)).toBeInTheDocument();
    expect(canvas.getByText(/Card/i)).toBeInTheDocument();
    expect(canvas.getByText(/Table Row/i)).toBeInTheDocument();

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

function SkeletonSizesDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{t('skeleton.sizes.thin')}</p>
        <div className="space-y-2">
          <Skeleton className="h-0.5 w-[250px]" />
          <Skeleton className="h-0.5 w-[200px]" />
          <Skeleton className="h-0.5 w-[180px]" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('skeleton.sizes.default')}</p>
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[180px]" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('skeleton.sizes.thick')}</p>
        <div className="space-y-2">
          <Skeleton className="h-8 w-[250px]" />
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-8 w-[180px]" />
        </div>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SkeletonSizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify multiple skeleton elements are rendered (3 per size group * 3 groups = 9)
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(9);

    // Verify size labels exist
    expect(canvas.getByText(/Thin/i)).toBeInTheDocument();
    expect(canvas.getByText(/Default/i)).toBeInTheDocument();
    expect(canvas.getByText(/Thick/i)).toBeInTheDocument();

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

function SkeletonShapesDemo() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">{t('skeleton.shapes.rectangle')}</p>
        <Skeleton className="h-4 w-[200px]" />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('skeleton.shapes.circle')}</p>
        <Skeleton className="size-12 rounded-full" />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('skeleton.shapes.rounded')}</p>
        <Skeleton className="h-10 w-[200px] rounded-md" />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('skeleton.shapes.fullWidth')}</p>
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}

export const Shapes: Story = {
  render: () => <SkeletonShapesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify multiple skeleton elements are rendered (4 shape variants)
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(4);

    // Verify shape labels exist
    expect(canvas.getByText(/Rectangle/i)).toBeInTheDocument();
    expect(canvas.getByText(/Circle/i)).toBeInTheDocument();
    expect(canvas.getByText(/Rounded/i)).toBeInTheDocument();
    expect(canvas.getByText(/Full Width/i)).toBeInTheDocument();

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const TextSkeleton: Story = {
  render: () => (
    <div className="space-y-2">
      <Skeleton className="h-4 w-[250px]" />
      <Skeleton className="h-4 w-[200px]" />
      <Skeleton className="h-4 w-[180px]" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify 3 text skeleton elements are rendered
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(3);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const AvatarSkeleton: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Skeleton className="size-10 rounded-full" />
      <Skeleton className="size-12 rounded-full" />
      <Skeleton className="size-14 rounded-full" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify 3 avatar skeleton elements are rendered
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(3);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const CardLoading: Story = {
  render: () => (
    <div className="w-[420px] space-y-3 rounded-xl border p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[180px]" />
          <Skeleton className="h-4 w-[120px]" />
        </div>
      </div>
      <Skeleton className="h-24 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify 6 skeleton elements are rendered (avatar + 2 text + content + 2 buttons)
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const ProfileSkeleton: Story = {
  render: () => (
    <div className="flex items-start gap-4">
      <Skeleton className="size-20 rounded-full" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-5 w-[180px]" />
        <Skeleton className="h-4 w-[250px]" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-4 w-[80px]" />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify 6 skeleton elements are rendered (avatar + name + bio + 3 stats)
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const TableSkeleton: Story = {
  render: () => (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex gap-4 border-b pb-4">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-4 w-[150px]" />
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-4 w-[80px]" />
      </div>
      {/* Rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`table-row-${String(i)}`} className="flex gap-4">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-[150px]" />
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-[80px]" />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify 24 skeleton elements are rendered (4 header + 4*5 rows)
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(24);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const ListSkeleton: Story = {
  render: () => (
    <div className="w-[300px] space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={`list-item-${String(i)}`}
          className="flex items-center gap-3 rounded-lg border p-3"
        >
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify 12 skeleton elements are rendered (4 items * 3 skeletons each)
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(12);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const FormSkeleton: Story = {
  render: () => (
    <div className="w-[360px] space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-[80px]" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-[120px]" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify 7 skeleton elements are rendered (3 labels + 3 inputs + 1 button)
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(7);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const DashboardSkeleton: Story = {
  render: () => (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`stat-${String(i)}`} className="rounded-lg border p-4">
            <Skeleton className="mb-2 h-4 w-[100px]" />
            <Skeleton className="h-8 w-[80px]" />
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="rounded-lg border p-4">
        <Skeleton className="mb-4 h-4 w-[150px]" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify 8 skeleton elements are rendered (3 stats * 2 + chart title + chart)
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(8);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

function SkeletonWithActualContentDemo() {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('skeleton.states.loading')}</p>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-3 w-[100px]" />
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('skeleton.states.loaded')}</p>
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="font-medium">{i18n.t('skeleton.story.johnDoe', 'John Doe')}</p>
            <p className="text-muted-foreground text-sm">john@example.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const WithActualContent: Story = {
  name: i18n.t('skeleton.storyName.withActualContent', 'Loading to Content Transition'),
  render: () => <SkeletonWithActualContentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify loading state has skeletons
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(3);

    // Verify state labels exist
    expect(canvas.getByText(/Loading/i)).toBeInTheDocument();
    expect(canvas.getByText(/Loaded/i)).toBeInTheDocument();

    // Verify actual content in loaded state
    expect(canvas.getByText('John Doe')).toBeInTheDocument();
    expect(canvas.getByText('john@example.com')).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...CardLoading,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');

    expect(skeletons.length).toBe(6);

    for (const element of skeletons) {
      if (!(element instanceof HTMLElement)) {
        throw new Error('Skeleton element was not an HTMLElement.');
      }

      expect(element.className).toContain('animate-pulse');
    }
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify skeleton elements are rendered
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify skeleton elements are rendered
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('skeleton.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    const root = context.canvasElement;

    if (!root.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(root.ownerDocument.documentElement.lang).toBe('ja');

    await Default.play?.(context);
  },
};

export const DesignReference: Story = {
  ...Default,
  tags: ['!test'],
  parameters: {
    ...(Default.parameters ?? {}),
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('skeleton.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-wrap items-center gap-3">
        <div id="hover">
          <Story />
        </div>
        <div id="focus">
          <Story />
        </div>
        <div id="active">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover *'],
      focusVisible: ['#focus *'],
      active: ['#active *'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  render: () => (
    <div
      className="space-y-4"
      role="status"
      aria-label={i18n.t('skeleton.story.loadingContent', 'Loading content')}
      aria-busy="true"
    >
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" aria-hidden="true" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" aria-hidden="true" />
          <Skeleton className="h-4 w-[200px]" aria-hidden="true" />
        </div>
      </div>
      <p className="sr-only">
        {i18n.t(
          'skeleton.story.loadingUserProfileInformation',
          'Loading user profile information...'
        )}
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find the status container
    const statusContainer = canvas.getByRole('status');
    expect(statusContainer).toBeInTheDocument();
    expect(statusContainer.getAttribute('aria-busy')).toBe('true');
    expect(statusContainer.getAttribute('aria-label')).toBe('Loading content');

    // Find skeletons
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(3);

    // Verify skeletons are hidden from assistive technology
    skeletons.forEach((skeleton) => {
      expect(skeleton.getAttribute('aria-hidden')).toBe('true');
    });

    // Find screen reader only text
    const srOnlyText = canvasElement.querySelector('.sr-only');
    expect(srOnlyText).toBeInTheDocument();
    expect(srOnlyText).toHaveTextContent('Loading user profile information...');
  },
};

// ============ MSW + FAKER STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const skeletons = createFakeSkeletons(5);

    return (
      <div className="space-y-4" data-testid="faker-skeleton">
        {skeletons.map((skel) => (
          <Skeleton
            key={skel.id}
            className={`${skel.shape === 'circle' ? 'h-12 w-12 rounded-full' : 'h-4 rounded-md'} ${skel.width === '100%' ? 'w-full' : 'w-3/4'}`}
          />
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="faker-skeleton"]');
    expect(container).toBeInTheDocument();

    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(5);
  },
};

export const WithMswHandlers: Story = {
  ...CardLoading,
  parameters: {
    msw: {
      handlers: skeletonHandlers,
    },
  },
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify skeleton elements are rendered
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const Loading: Story = {
  ...CardLoading,
  parameters: {
    msw: {
      handlers: skeletonStatusHandlers.loading,
    },
  },
  play: async ({ canvasElement }) => {
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).not.toBe(0);

    for (const element of skeletons) {
      expect(element.className).toContain('animate-pulse');
    }
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify skeleton elements are rendered
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify skeleton elements are rendered
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify skeleton elements are rendered
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify skeleton elements are rendered
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify skeleton elements are rendered
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();

    // Verify skeleton elements are rendered
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);

    // Verify skeletons have animate-pulse class
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const Error409Conflict: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const Error429TooManyRequests: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const SuccessHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: skeletonStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

// ============ FACTORY-DRIVEN STORIES ============

function FactorySingleSkeletonDemo() {
  const skeleton: FakeSkeleton = createFakeSkeleton({ shape: 'rounded', size: 'md' });

  return (
    <div className="space-y-4" data-testid="factory-single-skeleton">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.singleSkeleton')}</p>
      <Skeleton
        className={`${skeleton.shape === 'circle' ? 'rounded-full' : 'rounded-md'}`}
        style={{ width: skeleton.width, height: skeleton.height }}
      />
      <p className="text-muted-foreground text-xs">
        ID: {skeleton.id.slice(0, 8)} | Shape: {skeleton.shape} | Size: {skeleton.size} | Animation:{' '}
        {skeleton.animation}
      </p>
    </div>
  );
}

export const FactorySingleSkeleton: Story = {
  render: () => <FactorySingleSkeletonDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-single-skeleton')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    const info = canvasElement.querySelector('[data-testid="factory-single-skeleton"] .text-xs');
    expect(info).toBeInTheDocument();
    expect(info?.textContent).toContain('Shape:');
    expect(info?.textContent).toContain('Size:');
  },
};

function FactoryTextLineDemo() {
  const line: FakeSkeletonTextLine = createFakeSkeletonTextLine({ width: 'w-3/4', height: 'h-4' });

  return (
    <div className="space-y-4" data-testid="factory-text-line">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.textLine')}</p>
      <Skeleton className={`${line.height} ${line.width}`} />
      <p className="text-muted-foreground text-xs">
        Width: {line.width} | Height: {line.height}
      </p>
    </div>
  );
}

export const FactoryTextLine: Story = {
  render: () => <FactoryTextLineDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-text-line')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    const info = canvasElement.querySelector('[data-testid="factory-text-line"] .text-xs');
    expect(info).toBeInTheDocument();
    expect(info?.textContent).toContain('Width:');
  },
};

function FactoryTextLinesDemo() {
  const lines: FakeSkeletonTextLine[] = createFakeSkeletonTextLines(5);

  return (
    <div className="space-y-4" data-testid="factory-text-lines">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.textLines')}</p>
      <div className="space-y-2">
        {lines.map((line) => (
          <Skeleton key={line.id} className={`${line.height} ${line.width}`} />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{lines.length} lines generated</p>
    </div>
  );
}

export const FactoryTextLines: Story = {
  render: () => <FactoryTextLinesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-text-lines')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(5);
    expect(canvas.getByText(/5 lines generated/)).toBeInTheDocument();
  },
};

function FactoryParagraphDemo() {
  const paragraph: FakeSkeletonParagraph = createFakeSkeletonParagraph(4);

  return (
    <div className="space-y-4" data-testid="factory-paragraph">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.paragraph')}</p>
      <div className={paragraph.gap}>
        {paragraph.lines.map((line) => (
          <Skeleton key={line.id} className={`${line.height} ${line.width}`} />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Lines: {paragraph.lineCount} | Gap: {paragraph.gap}
      </p>
    </div>
  );
}

export const FactoryParagraph: Story = {
  render: () => <FactoryParagraphDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-paragraph')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(4);
    const info = canvasElement.querySelector('[data-testid="factory-paragraph"] .text-xs');
    expect(info?.textContent).toContain('Lines: 4');
  },
};

function FactoryAvatarDemo() {
  const avatar: FakeSkeletonAvatar = createFakeSkeletonAvatar('lg');

  return (
    <div className="space-y-4" data-testid="factory-avatar">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.avatar')}</p>
      <Skeleton className={`${avatar.sizeClass} rounded-full`} />
      <p className="text-muted-foreground text-xs">
        Size: {avatar.size} | Class: {avatar.sizeClass} | Pixels: {avatar.sizePixels}px
      </p>
    </div>
  );
}

export const FactoryAvatar: Story = {
  render: () => <FactoryAvatarDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-avatar')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    const info = canvasElement.querySelector('[data-testid="factory-avatar"] .text-xs');
    expect(info?.textContent).toContain('Size: lg');
    expect(info?.textContent).toContain('Pixels:');
  },
};

function FactoryCardDemo() {
  const card: FakeSkeletonCard = createFakeSkeletonCard({
    hasImage: true,
    hasHeader: true,
    hasDescription: true,
    hasFooter: true,
  });

  return (
    <div className="space-y-4" data-testid="factory-card">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.card')}</p>
      <div className={`${card.width} space-y-3 rounded-xl border p-4`}>
        {card.hasImage && <Skeleton className="h-32 w-full rounded-lg" />}
        {card.hasHeader && <Skeleton className="h-5 w-3/4" />}
        {card.hasDescription && <Skeleton className="h-4 w-full" />}
        {card.hasFooter && (
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        Image: {String(card.hasImage)} | Header: {String(card.hasHeader)} | Description:{' '}
        {String(card.hasDescription)} | Footer: {String(card.hasFooter)}
      </p>
    </div>
  );
}

export const FactoryCard: Story = {
  render: () => <FactoryCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-card')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
    const info = canvasElement.querySelector('[data-testid="factory-card"] .text-xs');
    expect(info?.textContent).toContain('Image: true');
  },
};

function FactoryListItemDemo() {
  const item: FakeSkeletonListItem = createFakeSkeletonListItem({
    hasAvatar: true,
    hasDescription: true,
    hasAction: true,
  });

  return (
    <div className="space-y-4" data-testid="factory-list-item">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.listItem')}</p>
      <div className="flex items-center gap-3 rounded-lg border p-3">
        {item.hasAvatar && <Skeleton className="size-10 rounded-full" />}
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          {item.hasDescription && <Skeleton className="h-3 w-1/2" />}
        </div>
        {item.hasAction && <Skeleton className="h-8 w-16" />}
      </div>
      <p className="text-muted-foreground text-xs">
        Avatar: {String(item.hasAvatar)} | Description: {String(item.hasDescription)} | Action:{' '}
        {String(item.hasAction)}
      </p>
    </div>
  );
}

export const FactoryListItem: Story = {
  render: () => <FactoryListItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-list-item')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
    const info = canvasElement.querySelector('[data-testid="factory-list-item"] .text-xs');
    expect(info?.textContent).toContain('Avatar: true');
  },
};

function FactoryListDemo() {
  const list: FakeSkeletonList = createFakeSkeletonList(4);

  return (
    <div className="space-y-4" data-testid="factory-list">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.list')}</p>
      <div className={`w-[300px] ${list.gap}`}>
        {list.items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
            {item.hasAvatar && <Skeleton className="size-10 rounded-full" />}
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              {item.hasDescription && <Skeleton className="h-3 w-1/2" />}
            </div>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Items: {list.itemCount} | Gap: {list.gap}
      </p>
    </div>
  );
}

export const FactoryList: Story = {
  render: () => <FactoryListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-list')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
    const info = canvasElement.querySelector('[data-testid="factory-list"] .text-xs');
    expect(info?.textContent).toContain('Items: 4');
  },
};

function FactoryTableDemo() {
  const table: FakeSkeletonTable = createFakeSkeletonTable(4, 3);

  return (
    <div className="space-y-4" data-testid="factory-table">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.table')}</p>
      <div className="w-full space-y-3">
        {table.hasHeader && (
          <div className="flex gap-4 border-b pb-3">
            {Array.from({ length: table.columns }).map((_, c) => (
              <Skeleton key={`header-${String(c)}`} className="h-4 flex-1" />
            ))}
          </div>
        )}
        {Array.from({ length: table.rows }).map((_, r) => (
          <div key={`row-${String(r)}`} className="flex gap-4">
            {Array.from({ length: table.columns }).map((_, c) => (
              <Skeleton key={`cell-${String(r)}-${String(c)}`} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Rows: {table.rows} | Columns: {table.columns} | Header: {String(table.hasHeader)}
      </p>
    </div>
  );
}

export const FactoryTable: Story = {
  render: () => <FactoryTableDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-table')).toBeInTheDocument();
    // 3 header cells + 4 rows * 3 cells = 15
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(15);
    const info = canvasElement.querySelector('[data-testid="factory-table"] .text-xs');
    expect(info?.textContent).toContain('Rows: 4');
    expect(info?.textContent).toContain('Columns: 3');
  },
};

function FactoryFormFieldDemo() {
  const field: FakeSkeletonFormField = createFakeSkeletonFormField({
    type: 'input',
    hasLabel: true,
  });

  return (
    <div className="space-y-4" data-testid="factory-form-field">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.formField')}</p>
      <div className="w-[300px] space-y-2">
        {field.hasLabel && <Skeleton className="h-4 w-[80px]" />}
        <Skeleton className={`w-full ${fieldTypeToHeightClass(field.type)}`} />
      </div>
      <p className="text-muted-foreground text-xs">
        Type: {field.type} | Has Label: {String(field.hasLabel)}
      </p>
    </div>
  );
}

export const FactoryFormField: Story = {
  render: () => <FactoryFormFieldDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-form-field')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(2);
    const info = canvasElement.querySelector('[data-testid="factory-form-field"] .text-xs');
    expect(info?.textContent).toContain('Type: input');
  },
};

function FactoryFormDemo() {
  const form: FakeSkeletonForm = createFakeSkeletonForm(3);

  return (
    <div className="space-y-4" data-testid="factory-form">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.form')}</p>
      <div className="w-[360px] space-y-4">
        {form.fields.map((field) => (
          <div key={field.id} className="space-y-2">
            {field.hasLabel && <Skeleton className="h-4 w-[80px]" />}
            <Skeleton className={`w-full ${fieldTypeToHeightClass(field.type)}`} />
          </div>
        ))}
        {form.hasSubmitButton && <Skeleton className="h-10 w-full" />}
      </div>
      <p className="text-muted-foreground text-xs">
        Fields: {form.fields.length} | Submit: {String(form.hasSubmitButton)}
      </p>
    </div>
  );
}

export const FactoryForm: Story = {
  render: () => <FactoryFormDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-form')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
    const info = canvasElement.querySelector('[data-testid="factory-form"] .text-xs');
    expect(info?.textContent).toContain('Fields: 3');
    expect(info?.textContent).toContain('Submit: true');
  },
};

function FactoryProfileDemo() {
  const profile = createFakeProfileSkeleton();

  return (
    <div className="space-y-4" data-testid="factory-profile">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.profile')}</p>
      <div className="flex items-center gap-4">
        <Skeleton className={`${profile.avatar.sizeClass} rounded-full`} />
        <div className="space-y-2">
          <Skeleton className={`${profile.name.height} ${profile.name.width}`} />
          <Skeleton className={`${profile.description.height} ${profile.description.width}`} />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Avatar: {profile.avatar.size} | Name width: {profile.name.width}
      </p>
    </div>
  );
}

export const FactoryProfile: Story = {
  render: () => <FactoryProfileDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-profile')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(3);
    const info = canvasElement.querySelector('[data-testid="factory-profile"] .text-xs');
    expect(info?.textContent).toContain('Avatar: lg');
  },
};

function FactoryPostDemo() {
  const post = createFakePostSkeleton();

  return (
    <div className="space-y-4" data-testid="factory-post">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.post')}</p>
      <div className="w-[350px] space-y-3">
        <Skeleton className={`${post.image.height} ${post.image.width} rounded-lg`} />
        <Skeleton className={`${post.title.height} ${post.title.width}`} />
        <div className={post.paragraph.gap}>
          {post.paragraph.lines.map((line) => (
            <Skeleton key={line.id} className={`${line.height} ${line.width}`} />
          ))}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">Paragraph lines: {post.paragraph.lineCount}</p>
    </div>
  );
}

export const FactoryPost: Story = {
  render: () => <FactoryPostDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-post')).toBeInTheDocument();
    // image + title + 3 paragraph lines = 5
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(5);
    const info = canvasElement.querySelector('[data-testid="factory-post"] .text-xs');
    expect(info?.textContent).toContain('Paragraph lines: 3');
  },
};

function FactoryCommentDemo() {
  const comment = createFakeCommentSkeleton();

  return (
    <div className="space-y-4" data-testid="factory-comment">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.comment')}</p>
      <div className="flex gap-3">
        <Skeleton className={`${comment.avatar.sizeClass} rounded-full`} />
        <div className="flex-1 space-y-2">
          <Skeleton className={`${comment.username.height} ${comment.username.width}`} />
          <div className={comment.text.gap}>
            {comment.text.lines.map((line) => (
              <Skeleton key={line.id} className={`${line.height} ${line.width}`} />
            ))}
          </div>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Avatar: {comment.avatar.size} | Text lines: {comment.text.lineCount}
      </p>
    </div>
  );
}

export const FactoryComment: Story = {
  render: () => <FactoryCommentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-comment')).toBeInTheDocument();
    // avatar + username + 2 text lines = 4
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(4);
    const info = canvasElement.querySelector('[data-testid="factory-comment"] .text-xs');
    expect(info?.textContent).toContain('Text lines: 2');
  },
};

function FactoryProductDemo() {
  const product = createFakeProductSkeleton();

  return (
    <div className="space-y-4" data-testid="factory-product">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.product')}</p>
      <div className="w-[280px] space-y-3 rounded-xl border p-4">
        <Skeleton className={`${product.image.height} ${product.image.width} rounded-lg`} />
        <Skeleton className={`${product.title.height} ${product.title.width}`} />
        <Skeleton className={`${product.description.height} ${product.description.width}`} />
        <div className="flex items-center justify-between">
          <Skeleton className={`${product.price.height} ${product.price.width}`} />
          <Skeleton className={`${product.rating.height} ${product.rating.width} rounded-md`} />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        {i18n.t(
          'skeleton.story.productSkeletonWithImageDetailsPrice',
          'Product skeleton with image, details, price'
        )}
      </p>
    </div>
  );
}

export const FactoryProduct: Story = {
  render: () => <FactoryProductDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-product')).toBeInTheDocument();
    // image + title + description + price + rating = 5
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(5);
  },
};

function FactoryStatsCardDemo() {
  const stats = createFakeStatsCardSkeleton();

  return (
    <div className="space-y-4" data-testid="factory-stats-card">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.statsCard')}</p>
      <div className="w-[200px] space-y-2 rounded-lg border p-4">
        <Skeleton className={`${stats.label.height} ${stats.label.width}`} />
        <Skeleton className={`${stats.value.height} ${stats.value.width}`} />
        <Skeleton className={`${stats.change.height} ${stats.change.width}`} />
      </div>
      <p className="text-muted-foreground text-xs">
        {i18n.t('skeleton.story.labelValueAndChangeIndicator')}
      </p>
    </div>
  );
}

export const FactoryStatsCard: Story = {
  render: () => <FactoryStatsCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-stats-card')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(3);
  },
};

function FactoryShapeMatrixDemo() {
  const shapes: FakeSkeleton[] = createSkeletonShapeMatrix();

  return (
    <div className="space-y-4" data-testid="factory-shape-matrix">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.shapeMatrix')}</p>
      <div className="flex items-center gap-4">
        {shapes.map((s) => (
          <div key={s.id} className="text-center">
            <Skeleton className={`h-12 w-24 ${shapeToRoundedClass(s.shape)}`} />
            <p className="text-muted-foreground mt-1 text-xs">{s.shape}</p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{shapes.length} shapes in matrix</p>
    </div>
  );
}

export const FactoryShapeMatrix: Story = {
  render: () => <FactoryShapeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-shape-matrix')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(3);
    expect(canvas.getByText('rectangle')).toBeInTheDocument();
    expect(canvas.getByText('rounded')).toBeInTheDocument();
    expect(canvas.getByText('circle')).toBeInTheDocument();
  },
};

function FactorySizeMatrixDemo() {
  const sizes: FakeSkeleton[] = createSkeletonSizeMatrix();

  return (
    <div className="space-y-4" data-testid="factory-size-matrix">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.sizeMatrix')}</p>
      <div className="space-y-3">
        {sizes.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <span className="text-muted-foreground w-10 text-xs">{s.size}</span>
            <Skeleton style={{ width: s.width, height: s.height }} className="rounded-md" />
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{sizes.length} sizes in matrix</p>
    </div>
  );
}

export const FactorySizeMatrix: Story = {
  render: () => <FactorySizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-size-matrix')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(6);
    expect(canvas.getByText('xs')).toBeInTheDocument();
    expect(canvas.getByText('xl')).toBeInTheDocument();
  },
};

function FactoryAvatarSizeMatrixDemo() {
  const avatars: FakeSkeletonAvatar[] = createSkeletonAvatarSizeMatrix();

  return (
    <div className="space-y-4" data-testid="factory-avatar-size-matrix">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.avatarSizeMatrix')}</p>
      <div className="flex items-end gap-4">
        {avatars.map((a) => (
          <div key={a.id} className="text-center">
            <Skeleton className={`${a.sizeClass} rounded-full`} />
            <p className="text-muted-foreground mt-1 text-xs">
              {a.size} ({a.sizePixels}px)
            </p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{avatars.length} avatar sizes</p>
    </div>
  );
}

export const FactoryAvatarSizeMatrix: Story = {
  render: () => <FactoryAvatarSizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-avatar-size-matrix')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(5);
    expect(canvas.getByText(/xs/)).toBeInTheDocument();
    expect(canvas.getByText(/xl/)).toBeInTheDocument();
  },
};

function FactoryShowcaseDemo() {
  const showcase = createSkeletonShowcase();

  return (
    <div className="space-y-6" data-testid="factory-showcase">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.showcase')}</p>
      {showcase.map((item) => (
        <div key={item.name} className="space-y-2 rounded-lg border p-4">
          <p className="text-sm font-medium">{item.name}</p>
          <p className="text-muted-foreground text-xs">{item.description}</p>
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

export const FactoryShowcase: Story = {
  render: () => <FactoryShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-showcase')).toBeInTheDocument();
    expect(canvas.getByText('Text Line')).toBeInTheDocument();
    expect(canvas.getByText('Paragraph')).toBeInTheDocument();
    expect(canvas.getByText('Avatar')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(9);
  },
};

function FactoryTestDataDemo() {
  const testData = createSkeletonTestData();

  return (
    <div className="space-y-6" data-testid="factory-test-data">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.testData')}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-medium">
            {i18n.t('skeleton.story.basicSkeleton', 'Basic Skeleton')}
          </p>
          <Skeleton className="h-4 w-full" />
          <p className="text-muted-foreground text-xs">Shape: {testData.basicSkeleton.shape}</p>
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-medium">Skeletons ({testData.skeletons.length})</p>
          {testData.skeletons.slice(0, 2).map((s) => (
            <Skeleton key={s.id} className="h-3 w-full" />
          ))}
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-medium">Text Lines ({testData.textLines.length})</p>
          {testData.textLines.slice(0, 2).map((l) => (
            <Skeleton key={l.id} className={`${l.height} ${l.width}`} />
          ))}
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-medium">{i18n.t('skeleton.story.profile', 'Profile')}</p>
          <Skeleton className={`${testData.profile.avatar.sizeClass} rounded-full`} />
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-medium">Shape Matrix ({testData.shapeMatrix.length})</p>
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-medium">Size Matrix ({testData.sizeMatrix.length})</p>
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-medium">Avatar Matrix ({testData.avatarSizeMatrix.length})</p>
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-medium">Showcase ({testData.showcase.length})</p>
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  );
}

export const FactoryTestData: Story = {
  render: () => <FactoryTestDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-test-data')).toBeInTheDocument();
    expect(canvas.getByText('Basic Skeleton')).toBeInTheDocument();
    expect(canvas.getByText(/Profile/)).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(5);
  },
};

// ============ CONSTANTS STORIES ============

function FactoryConstantsShapesDemo() {
  const _shapes: SkeletonShape[] = SKELETON_SHAPES;

  return (
    <div className="space-y-4" data-testid="factory-constants-shapes">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.shapes')}</p>
      <div className="flex gap-4">
        {_shapes.map((shape) => (
          <div key={shape} className="text-center">
            <Skeleton className={`h-12 w-24 ${shapeToRoundedClass(shape)}`} />
            <p className="text-muted-foreground mt-1 text-xs">{shape}</p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{_shapes.length} shapes available</p>
    </div>
  );
}

export const FactoryConstantsShapes: Story = {
  render: () => <FactoryConstantsShapesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-constants-shapes')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(SKELETON_SHAPES.length);
    expect(canvas.getByText('rectangle')).toBeInTheDocument();
    expect(canvas.getByText('circle')).toBeInTheDocument();
  },
};

function FactoryConstantsSizesDemo() {
  const _sizes: SkeletonSize[] = SKELETON_SIZES;

  return (
    <div className="space-y-4" data-testid="factory-constants-sizes">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.sizes')}</p>
      <div className="space-y-3">
        {_sizes.map((size) => {
          const dims = SIZE_DIMENSIONS[size];
          return (
            <div key={size} className="flex items-center gap-3">
              <span className="text-muted-foreground w-10 text-xs">{size}</span>
              <Skeleton style={{ width: dims.width, height: dims.height }} className="rounded" />
              <span className="text-muted-foreground text-xs">
                {dims.width} x {dims.height}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const FactoryConstantsSizes: Story = {
  render: () => <FactoryConstantsSizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-constants-sizes')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(SKELETON_SIZES.length);
    expect(canvas.getByText('xs')).toBeInTheDocument();
    expect(canvas.getByText('full')).toBeInTheDocument();
  },
};

function FactoryConstantsAnimationsDemo() {
  const _animations: SkeletonAnimation[] = SKELETON_ANIMATIONS;

  return (
    <div className="space-y-4" data-testid="factory-constants-animations">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.animations')}</p>
      <div className="space-y-3">
        {_animations.map((animation) => (
          <div key={animation} className="flex items-center gap-3">
            <span className="text-muted-foreground w-16 text-xs">{animation}</span>
            <Skeleton className={`h-4 w-[200px] ${animation === 'none' ? '' : 'animate-pulse'}`} />
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{_animations.length} animations</p>
    </div>
  );
}

export const FactoryConstantsAnimations: Story = {
  render: () => <FactoryConstantsAnimationsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-constants-animations')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(SKELETON_ANIMATIONS.length);
    expect(canvas.getByText('pulse')).toBeInTheDocument();
    expect(canvas.getByText('none')).toBeInTheDocument();
  },
};

function FactoryConstantsContentTypesDemo() {
  const _contentTypes: SkeletonContentType[] = SKELETON_CONTENT_TYPES;

  return (
    <div className="space-y-4" data-testid="factory-constants-content-types">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.contentTypes')}</p>
      <div className="flex flex-wrap gap-2">
        {_contentTypes.map((type) => (
          <div key={type} className="space-y-1 rounded border p-2 text-center">
            <Skeleton className="h-6 w-16" />
            <p className="text-muted-foreground text-xs">{type}</p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{_contentTypes.length} content types</p>
    </div>
  );
}

export const FactoryConstantsContentTypes: Story = {
  render: () => <FactoryConstantsContentTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-constants-content-types')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(SKELETON_CONTENT_TYPES.length);
    expect(canvas.getByText('text')).toBeInTheDocument();
    expect(canvas.getByText('table')).toBeInTheDocument();
  },
};

function FactoryConstantsAvatarSizesDemo() {
  return (
    <div className="space-y-4" data-testid="factory-constants-avatar-sizes">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.avatarSizes')}</p>
      <div className="flex items-end gap-4">
        {(Object.entries(AVATAR_SIZES) as [string, { className: string; pixels: number }][]).map(
          ([key, val]) => (
            <div key={key} className="text-center">
              <Skeleton className={`${val.className} rounded-full`} />
              <p className="text-muted-foreground mt-1 text-xs">
                {key} ({val.pixels}px)
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export const FactoryConstantsAvatarSizes: Story = {
  render: () => <FactoryConstantsAvatarSizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-constants-avatar-sizes')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(Object.keys(AVATAR_SIZES).length);
    expect(canvas.getByText(/xs/)).toBeInTheDocument();
    expect(canvas.getByText(/xl/)).toBeInTheDocument();
  },
};

function FactoryConstantsTextLineHeightsDemo() {
  return (
    <div className="space-y-4" data-testid="factory-constants-text-line-heights">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.textLineHeights')}</p>
      <div className="space-y-3">
        {TEXT_LINE_HEIGHTS.map((h) => (
          <div key={h} className="flex items-center gap-3">
            <span className="text-muted-foreground w-10 text-xs">{h}</span>
            <Skeleton className={`${h} w-[200px]`} />
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{TEXT_LINE_HEIGHTS.length} line heights</p>
    </div>
  );
}

export const FactoryConstantsTextLineHeights: Story = {
  render: () => <FactoryConstantsTextLineHeightsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-constants-text-line-heights')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(TEXT_LINE_HEIGHTS.length);
    expect(canvas.getByText('h-3')).toBeInTheDocument();
    expect(canvas.getByText('h-6')).toBeInTheDocument();
  },
};

function FactoryConstantsTextLineWidthsDemo() {
  return (
    <div className="space-y-4" data-testid="factory-constants-text-line-widths">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.textLineWidths')}</p>
      <div className="space-y-3">
        {TEXT_LINE_WIDTHS.map((w) => (
          <div key={w} className="flex items-center gap-3">
            <span className="text-muted-foreground w-12 text-xs">{w}</span>
            <Skeleton className={`h-4 ${w}`} />
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{TEXT_LINE_WIDTHS.length} line widths</p>
    </div>
  );
}

export const FactoryConstantsTextLineWidths: Story = {
  render: () => <FactoryConstantsTextLineWidthsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-constants-text-line-widths')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(TEXT_LINE_WIDTHS.length);
    expect(canvas.getByText('w-1/4')).toBeInTheDocument();
    expect(canvas.getByText('w-full')).toBeInTheDocument();
  },
};

function FactoryConstantsSizeDimensionsDemo() {
  return (
    <div className="space-y-4" data-testid="factory-constants-size-dimensions">
      <p className="text-sm font-medium">{i18n.t('skeleton.factory.sizeDimensions')}</p>
      <div className="space-y-3">
        {(Object.entries(SIZE_DIMENSIONS) as [string, { height: string; width: string }][]).map(
          ([key, dims]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-muted-foreground w-10 text-xs">{key}</span>
              <Skeleton style={{ width: dims.width, height: dims.height }} className="rounded" />
              <span className="text-muted-foreground text-xs">
                {dims.width} x {dims.height}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export const FactoryConstantsSizeDimensions: Story = {
  render: () => <FactoryConstantsSizeDimensionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-constants-size-dimensions')).toBeInTheDocument();
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(Object.keys(SIZE_DIMENSIONS).length);
    expect(canvas.getByText('xs')).toBeInTheDocument();
    expect(canvas.getByText('full')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('skeleton.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('skeleton.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('skeleton.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('skeleton.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
