import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { feedbackStatusHandlers } from '@/.storybook/stories/_handlers/feedback.handlers';

import {
  createFakeLoadingSkeleton,
  createFakeLoadingSkeletons,
  createFakeSkeletonForVariant,
  createFakeSkeletonManyRows,
  createFakeSkeletonSingleRow,
  createFakeSkeletonWithClassName,
  createFakeSkeletonWithHeader,
  createFakeSkeletonWithoutHeader,
  createLoadingSkeletonShowcase,
  createLoadingSkeletonTestData,
  createSkeletonRowMatrix,
  createSkeletonVariantHeaderMatrix,
  createSkeletonVariantMatrix,
  type FakeLoadingSkeleton,
  SKELETON_DEFAULT_ROWS,
  SKELETON_DEFAULT_VARIANT,
  SKELETON_ROW_COUNTS,
  SKELETON_VARIANTS,
  type SkeletonVariant,
} from '../_factories/loading-skeleton.factory';

import { LoadingSkeleton } from './LoadingSkeleton';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Factory type + constant references (F3.11-F3.13)
void SKELETON_DEFAULT_ROWS;
void SKELETON_DEFAULT_VARIANT;
void SKELETON_ROW_COUNTS;
const _typeCheck1: FakeLoadingSkeleton | undefined = undefined;
void _typeCheck1;
const _typeCheck2: SkeletonVariant | undefined = undefined;
void _typeCheck2;

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function AllVariantsDemo() {
  const { t } = useTranslation();
  const variantLabels: Record<string, string> = {
    card: t('loadingSkeleton.demo.cardVariant'),
    list: t('loadingSkeleton.demo.listVariant'),
    table: t('loadingSkeleton.demo.tableVariant'),
    text: t('loadingSkeleton.demo.textVariant'),
  };

  return (
    <div className="space-y-8" data-testid="all-variants-demo">
      {SKELETON_VARIANTS.map((variant) => (
        <div key={variant} className="space-y-2">
          <h3 className="text-sm font-medium">{variantLabels[variant]}</h3>
          <LoadingSkeleton variant={variant} rows={3} />
        </div>
      ))}
    </div>
  );
}

function CustomRowsDemo() {
  const { t } = useTranslation();
  const rowCounts = [1, 2, 3, 5, 7] as const;

  return (
    <div className="space-y-8" data-testid="custom-rows-demo">
      {rowCounts.map((count) => (
        <div key={count} className="space-y-2">
          <h3 className="text-sm font-medium">
            {t('loadingSkeleton.story.rowCount', '{{count}} Row(s)', { count })}
          </h3>
          <LoadingSkeleton variant="list" rows={count} />
        </div>
      ))}
    </div>
  );
}

function AccessibilityDemo() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6" data-testid="accessibility-demo">
      <div>
        <h3 className="mb-2 text-sm font-medium">{t('loadingSkeleton.demo.loadingStates')}</h3>
        <p className="text-muted-foreground mb-4 text-xs">
          {t('loadingSkeleton.demo.loadingStatesDesc')}
        </p>
        <LoadingSkeleton variant="card" rows={2} />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">
          {t('loadingSkeleton.demo.screenReaderAnnouncement')}
        </h3>
        <p className="text-muted-foreground mb-4 text-xs">
          {t('loadingSkeleton.demo.screenReaderDesc')}
        </p>
        <LoadingSkeleton variant="list" rows={3} showHeader />
      </div>
    </div>
  );
}

function JapaneseDemo() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6" data-testid="japanese-demo">
      <div>
        <h3 className="mb-2 text-sm font-medium">{t('loadingSkeleton.demo.listVariant')}</h3>
        <LoadingSkeleton variant="list" rows={3} showHeader />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">{t('loadingSkeleton.demo.cardVariant')}</h3>
        <LoadingSkeleton variant="card" rows={2} />
      </div>
    </div>
  );
}

function MobileDemo() {
  return (
    <div className="w-[320px]" data-testid="mobile-demo">
      <LoadingSkeleton variant="list" rows={3} showHeader />
    </div>
  );
}

function FactoryVariantMatrixDemo() {
  const matrix = createSkeletonVariantMatrix();
  return (
    <div className="space-y-8" data-testid="factory-variant-matrix">
      {matrix.map(({ skeleton, variant }) => (
        <div key={variant} className="space-y-2">
          <h3 className="text-sm font-medium capitalize">{variant}</h3>
          <LoadingSkeleton
            variant={skeleton.variant}
            rows={skeleton.rows}
            showHeader={skeleton.showHeader}
            className={skeleton.className}
          />
        </div>
      ))}
    </div>
  );
}

function FactoryShowcaseDemo() {
  const { t } = useTranslation();
  const showcase = createLoadingSkeletonShowcase();
  const { testData } = showcase;
  return (
    <div className="space-y-8" data-testid="factory-showcase">
      <div>
        <h3 className="mb-2 text-sm font-medium">{t('loadingSkeleton.story.basic', 'Basic')}</h3>
        <LoadingSkeleton
          variant={testData.basic.variant}
          rows={testData.basic.rows}
          showHeader={testData.basic.showHeader}
        />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">
          {t('loadingSkeleton.story.withHeader', 'With Header')}
        </h3>
        <LoadingSkeleton
          variant={testData.withHeader.variant}
          rows={testData.withHeader.rows}
          showHeader={testData.withHeader.showHeader}
        />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">
          {t('loadingSkeleton.story.manyRows', 'Many Rows')}
        </h3>
        <LoadingSkeleton
          variant={testData.manyRows.variant}
          rows={testData.manyRows.rows}
          showHeader={testData.manyRows.showHeader}
        />
      </div>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Documentation/Components/LoadingSkeleton',
  component: LoadingSkeleton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
LoadingSkeleton is a reusable loading skeleton component for stories.
It displays animated skeletons with shimmer effects in various layouts.

## Features
- **Four variants**: text, list, card, and table layouts
- **Configurable rows**: Control the number of skeleton items
- **Optional header**: Show a header skeleton above content
- **Accessible**: Includes proper ARIA attributes for screen readers
- **Animated**: Smooth fade-in animation with consistent shimmer effect
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Appearance
    variant: {
      control: 'select',
      options: ['text', 'list', 'card', 'table'],
      description: i18n.t(
        'loadingSkeleton.argType.visualLayoutVariantOfTheSkeleton',
        'Visual layout variant of the skeleton'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'list' },
        type: { summary: "'text' | 'list' | 'card' | 'table'" },
      },
    },
    rows: {
      control: { type: 'number', min: 1, max: 10 },
      description: i18n.t(
        'loadingSkeleton.argType.numberOfSkeletonRowsToDisplay',
        'Number of skeleton rows to display'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: '3' },
        type: { summary: 'number' },
      },
    },
    showHeader: {
      control: 'boolean',
      description: i18n.t(
        'loadingSkeleton.argType.whetherToShowAHeaderSkeleton',
        'Whether to show a header skeleton'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    className: {
      control: 'text',
      description: i18n.t('loadingSkeleton.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
  },
} satisfies Meta<typeof LoadingSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============================================================================
// CORE STORIES
// ============================================================================

export const Default: Story = {
  args: {
    variant: 'list',
    rows: 3,
    showHeader: false,
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();

    expect(skeleton.getAttribute('role')).toBe('status');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(skeleton.getAttribute('aria-label')).toBe('Loading content');
    expect(skeleton.getAttribute('data-variant')).toBe('list');
    expect(skeleton.getAttribute('data-state')).toBe('loading');

    const skeletonItems = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletonItems.length).toBeGreaterThan(0);
  },
};

export const Playground: Story = {
  args: {
    variant: 'list',
    rows: 3,
    showHeader: false,
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const TextVariant: Story = {
  args: {
    variant: 'text',
    rows: 4,
    showHeader: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.getAttribute('data-variant')).toBe('text');

    const skeletonItems = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletonItems.length).toBe(4);
  },
};

export const ListVariant: Story = {
  args: {
    variant: 'list',
    rows: 3,
    showHeader: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.getAttribute('data-variant')).toBe('list');

    const skeletonItems = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletonItems.length).toBeGreaterThan(0);

    const avatarSkeletons = canvasElement.querySelectorAll('[data-slot="skeleton"].rounded-full');
    expect(avatarSkeletons.length).toBe(3);
  },
};

export const CardVariant: Story = {
  args: {
    variant: 'card',
    rows: 3,
    showHeader: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.getAttribute('data-variant')).toBe('card');

    const skeletonItems = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletonItems.length).toBeGreaterThan(0);
  },
};

export const TableVariant: Story = {
  args: {
    variant: 'table',
    rows: 5,
    showHeader: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.getAttribute('data-variant')).toBe('table');

    const skeletonItems = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletonItems.length).toBe(20);
  },
};

export const AllVariants: Story = {
  render: () => <AllVariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const demo = canvas.getByTestId('all-variants-demo');
    expect(demo).toBeInTheDocument();

    const skeletonContainers = canvasElement.querySelectorAll('[data-testid="story-loading"]');
    expect(skeletonContainers.length).toBe(4);

    const variants = ['text', 'list', 'card', 'table'];
    for (const variant of variants) {
      const variantSkeleton = canvasElement.querySelector(`[data-variant="${variant}"]`);
      expect(variantSkeleton).toBeInTheDocument();
    }
  },
};

export const DataAttributes: Story = {
  name: i18n.t('loadingSkeleton.storyName.dataAttributes', 'Data Attributes'),
  args: {
    variant: 'list',
    rows: 3,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.getAttribute('data-slot')).toBe('loading-skeleton');
    expect(skeleton.getAttribute('data-testid')).toBe('story-loading');
    expect(skeleton.getAttribute('data-state')).toBe('loading');
    expect(skeleton.getAttribute('data-variant')).toBe('list');
  },
};

// ============================================================================
// HEADER VARIANTS
// ============================================================================

export const WithHeader: Story = {
  args: {
    variant: 'list',
    rows: 3,
    showHeader: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();

    const skeletonItems = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletonItems.length).toBeGreaterThan(9);
  },
};

export const TextWithHeader: Story = {
  args: {
    variant: 'text',
    rows: 3,
    showHeader: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();

    const skeletonItems = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletonItems.length).toBe(4);
  },
};

export const CardWithHeader: Story = {
  args: {
    variant: 'card',
    rows: 2,
    showHeader: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.getAttribute('data-variant')).toBe('card');
  },
};

export const TableWithHeader: Story = {
  args: {
    variant: 'table',
    rows: 4,
    showHeader: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();

    const skeletonItems = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletonItems.length).toBe(20);
  },
};

export const CustomRows: Story = {
  render: () => <CustomRowsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const demo = canvas.getByTestId('custom-rows-demo');
    expect(demo).toBeInTheDocument();

    const skeletonContainers = canvasElement.querySelectorAll('[data-testid="story-loading"]');
    expect(skeletonContainers.length).toBe(5);
  },
};

// ============================================================================
// ACCESSIBILITY
// ============================================================================

export const Accessibility: Story = {
  render: () => <AccessibilityDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const demo = canvas.getByTestId('accessibility-demo');
    expect(demo).toBeInTheDocument();

    const skeletonContainers = canvasElement.querySelectorAll('[data-testid="story-loading"]');
    expect(skeletonContainers.length).toBe(2);

    for (const container of skeletonContainers) {
      expect(container.getAttribute('role')).toBe('status');
      expect(container.getAttribute('aria-busy')).toBe('true');
      expect(container.getAttribute('aria-label')).toBe('Loading content');
    }

    const srOnlyText = canvasElement.querySelectorAll('.sr-only');
    expect(srOnlyText.length).toBe(2);
    for (const el of srOnlyText) {
      expect(el.textContent).toBe('Loading...');
    }

    const skeletonItems = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    for (const item of skeletonItems) {
      expect(item.getAttribute('aria-hidden')).toBe('true');
    }
  },
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the accessibility features of the LoadingSkeleton component:

- **role="status"**: Indicates a live region with status information
- **aria-busy="true"**: Signals that the region is currently being updated
- **aria-label="Loading content"**: Provides a descriptive label for screen readers
- **aria-hidden="true"**: Individual skeleton elements are hidden from assistive technology
- **sr-only text**: Hidden "Loading..." text for screen reader announcements
        `,
      },
    },
  },
};

// ============================================================================
// THEME / VISUAL
// ============================================================================

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();

    const skeletonItems = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletonItems.length).toBeGreaterThan(0);
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();

    const skeletonItems = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletonItems.length).toBeGreaterThan(0);
  },
};

export const DarkRTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('loadingSkeleton.storyName.pseudoStates', 'Pseudo States (animation states)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('loadingSkeleton.story.loadingState', 'Loading State')}
          </p>
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    docs: {
      description: {
        story: 'Shows the skeleton in its animated loading state.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
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

// ============================================================================
// I18N STORIES
// ============================================================================

export const Japanese: Story = {
  name: i18n.t('loadingSkeleton.storyName.japanese', 'Japanese Locale'),
  render: () => <JapaneseDemo />,
  globals: {
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('japanese-demo');
    expect(container).toBeInTheDocument();

    const skeletons = container.querySelectorAll('[data-testid="story-loading"]');
    expect(skeletons.length).toBe(2);
  },
};

export const DarkJapanese: Story = {
  name: i18n.t('loadingSkeleton.storyName.darkJapanese', 'Dark + Japanese'),
  render: () => <JapaneseDemo />,
  globals: {
    locale: 'ja',
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// EDGE CASES
// ============================================================================

export const SingleRow: Story = {
  args: {
    variant: 'list',
    rows: 1,
    showHeader: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();
  },
};

export const ManyRows: Story = {
  args: {
    variant: 'list',
    rows: 10,
    showHeader: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();

    const skeletonItems = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletonItems.length).toBeGreaterThan(20);
  },
};

export const WithCustomClassName: Story = {
  args: {
    variant: 'card',
    rows: 2,
    showHeader: false,
    className: 'max-w-md mx-auto p-4 border rounded-lg',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();

    expect(skeleton.className).toContain('max-w-md');
    expect(skeleton.className).toContain('mx-auto');
    expect(skeleton.className).toContain('p-4');
    expect(skeleton.className).toContain('border');
    expect(skeleton.className).toContain('rounded-lg');
  },
};

export const AnimationState: Story = {
  args: {
    variant: 'list',
    rows: 3,
    showHeader: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();

    expect(skeleton.className).toContain('animate-in');
    expect(skeleton.className).toContain('fade-in');

    const skeletonItems = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    for (const item of skeletonItems) {
      expect(item.className).toContain('animate-pulse');
    }
  },
};

// ============================================================================
// MOBILE
// ============================================================================

export const Mobile: Story = {
  name: i18n.t('loadingSkeleton.storyName.mobile', 'Mobile Viewport (320px)'),
  render: () => <MobileDemo />,
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('mobile-demo');
    expect(container).toBeInTheDocument();

    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY STORIES
// ============================================================================

export const FactoryData: Story = {
  name: i18n.t('loadingSkeleton.storyName.factoryData', 'Factory: Random Skeleton'),
  render: () => {
    const skeleton = createFakeLoadingSkeleton();
    return (
      <div data-testid="factory-data-demo">
        <LoadingSkeleton
          variant={skeleton.variant}
          rows={skeleton.rows}
          showHeader={skeleton.showHeader}
          className={skeleton.className}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-data-demo');
    expect(container).toBeInTheDocument();

    const skeleton = canvas.getByTestId('story-loading');
    expect(skeleton).toBeInTheDocument();
  },
};

export const FactoryVariantMatrix: Story = {
  name: i18n.t('loadingSkeleton.storyName.factoryVariantMatrix', 'Factory: Variant Matrix'),
  render: () => <FactoryVariantMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-variant-matrix');
    expect(container).toBeInTheDocument();

    const skeletons = container.querySelectorAll('[data-testid="story-loading"]');
    expect(skeletons.length).toBe(4);
  },
};

export const FactoryShowcase: Story = {
  name: i18n.t('loadingSkeleton.storyName.factoryShowcase', 'Factory: Showcase'),
  render: () => <FactoryShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-showcase');
    expect(container).toBeInTheDocument();

    const skeletons = container.querySelectorAll('[data-testid="story-loading"]');
    expect(skeletons.length).toBe(3);
  },
};

export const FactoryBulk: Story = {
  name: i18n.t('loadingSkeleton.storyName.factoryBulk', 'Factory: Bulk Skeletons'),
  render: () => {
    const skeletons = createFakeLoadingSkeletons(4);
    return (
      <div className="space-y-6" data-testid="factory-bulk">
        {skeletons.map((skeleton) => (
          <div key={skeleton.id} className="space-y-2">
            <p className="text-sm font-medium capitalize">{skeleton.variant}</p>
            <LoadingSkeleton
              variant={skeleton.variant}
              rows={skeleton.rows}
              showHeader={skeleton.showHeader}
            />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-bulk');
    expect(container).toBeInTheDocument();

    const skeletons = container.querySelectorAll('[data-testid="story-loading"]');
    expect(skeletons.length).toBe(4);
  },
};

export const FactoryStates: Story = {
  name: i18n.t('loadingSkeleton.storyName.factoryStates', 'Factory: With/Without Header'),
  render: () => {
    const withHeader = createFakeSkeletonWithHeader();
    const withoutHeader = createFakeSkeletonWithoutHeader();
    const manyRows = createFakeSkeletonManyRows();
    const singleRow = createFakeSkeletonSingleRow();
    const withClassName = createFakeSkeletonWithClassName();
    return (
      <div className="space-y-8" data-testid="factory-states">
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('loadingSkeleton.story.withHeader', 'With Header')}
          </p>
          <LoadingSkeleton
            variant={withHeader.variant}
            rows={withHeader.rows}
            showHeader={withHeader.showHeader}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('loadingSkeleton.story.withoutHeader', 'Without Header')}
          </p>
          <LoadingSkeleton
            variant={withoutHeader.variant}
            rows={withoutHeader.rows}
            showHeader={withoutHeader.showHeader}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('loadingSkeleton.story.manyRows', 'Many Rows')}
          </p>
          <LoadingSkeleton
            variant={manyRows.variant}
            rows={manyRows.rows}
            showHeader={manyRows.showHeader}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('loadingSkeleton.story.singleRow', 'Single Row')}
          </p>
          <LoadingSkeleton
            variant={singleRow.variant}
            rows={singleRow.rows}
            showHeader={singleRow.showHeader}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('loadingSkeleton.story.customClass', 'Custom Class')}
          </p>
          <LoadingSkeleton
            variant={withClassName.variant}
            rows={withClassName.rows}
            showHeader={withClassName.showHeader}
            className={withClassName.className}
          />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-states');
    expect(container).toBeInTheDocument();

    const skeletons = container.querySelectorAll('[data-testid="story-loading"]');
    expect(skeletons.length).toBe(5);
  },
};

export const FactoryRowMatrix: Story = {
  name: i18n.t('loadingSkeleton.storyName.factoryRowMatrix', 'Factory: Row Matrix'),
  render: () => {
    const matrix = createSkeletonRowMatrix('list');
    return (
      <div className="space-y-6" data-testid="factory-row-matrix">
        {matrix.map(({ rows, skeleton }) => (
          <div key={rows} className="space-y-2">
            <p className="text-sm font-medium">
              {i18n.t('loadingSkeleton.story.rowCount', '{{count}} Row(s)', { count: rows })}
            </p>
            <LoadingSkeleton
              variant={skeleton.variant}
              rows={skeleton.rows}
              showHeader={skeleton.showHeader}
            />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-row-matrix');
    expect(container).toBeInTheDocument();

    const skeletons = container.querySelectorAll('[data-testid="story-loading"]');
    expect(skeletons.length).toBe(6);
  },
};

export const FactoryVariantHeaderMatrix: Story = {
  name: i18n.t(
    'loadingSkeleton.storyName.factoryVariantHeaderMatrix',
    'Factory: Variant x Header Matrix'
  ),
  render: () => {
    const matrix = createSkeletonVariantHeaderMatrix();
    return (
      <div className="space-y-6" data-testid="factory-variant-header-matrix">
        {matrix.map(({ showHeader, skeleton, variant }) => (
          <div key={`${variant}-${String(showHeader)}`} className="space-y-2">
            <p className="text-sm font-medium capitalize">
              {variant} {showHeader ? i18n.t('loadingSkeleton.story.plusHeader', '+ Header') : ''}
            </p>
            <LoadingSkeleton
              variant={skeleton.variant}
              rows={skeleton.rows}
              showHeader={skeleton.showHeader}
            />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-variant-header-matrix');
    expect(container).toBeInTheDocument();

    const skeletons = container.querySelectorAll('[data-testid="story-loading"]');
    expect(skeletons.length).toBe(8);
  },
};

export const FactoryForVariant: Story = {
  name: i18n.t('loadingSkeleton.storyName.factoryForVariant', 'Factory: Specific Variant'),
  render: () => {
    const card = createFakeSkeletonForVariant('card');
    const table = createFakeSkeletonForVariant('table');
    return (
      <div className="space-y-6" data-testid="factory-for-variant">
        <div>
          <p className="mb-2 text-sm font-medium">{i18n.t('loadingSkeleton.story.card', 'Card')}</p>
          <LoadingSkeleton variant={card.variant} rows={card.rows} showHeader={card.showHeader} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('loadingSkeleton.story.table', 'Table')}
          </p>
          <LoadingSkeleton
            variant={table.variant}
            rows={table.rows}
            showHeader={table.showHeader}
          />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-for-variant');
    expect(container).toBeInTheDocument();

    const skeletons = container.querySelectorAll('[data-testid="story-loading"]');
    expect(skeletons.length).toBe(2);
  },
};

export const FactoryTestData: Story = {
  name: i18n.t('loadingSkeleton.storyName.factoryTestData', 'Factory: Test Data'),
  render: () => {
    const testData = createLoadingSkeletonTestData();
    return (
      <div className="space-y-6" data-testid="factory-test-data">
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('loadingSkeleton.story.basic', 'Basic')}
          </p>
          <LoadingSkeleton
            variant={testData.basic.variant}
            rows={testData.basic.rows}
            showHeader={testData.basic.showHeader}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('loadingSkeleton.story.singleRow', 'Single Row')}
          </p>
          <LoadingSkeleton
            variant={testData.singleRow.variant}
            rows={testData.singleRow.rows}
            showHeader={testData.singleRow.showHeader}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('loadingSkeleton.story.withClassname', 'With ClassName')}
          </p>
          <LoadingSkeleton
            variant={testData.withClassName.variant}
            rows={testData.withClassName.rows}
            showHeader={testData.withClassName.showHeader}
            className={testData.withClassName.className}
          />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-test-data');
    expect(container).toBeInTheDocument();

    const skeletons = container.querySelectorAll('[data-testid="story-loading"]');
    expect(skeletons.length).toBe(3);
  },
};

// ============================================================================
// FEEDBACK STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const FeedbackLoading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const FeedbackSlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const FeedbackNetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const FeedbackEmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: feedbackStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerFeedbackSuccess: Story = {
  ...Default,
  name: i18n.t('loadingSkeleton.storyName.handlerFeedbackSuccess', 'Handler: Feedback Success'),
  parameters: { msw: { handlers: feedbackStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
