import type { Meta, StoryObj } from '@storybook/react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { expect, fn, within } from 'storybook/test';
import type React from 'react';
import { useTranslation } from 'react-i18next';

import {
  progressHandlers,
  progressStatusHandlers,
} from '@/.storybook/stories/_handlers/progress.handlers';
import type {
  FakeCircularProgress,
  FakeMultiStepProgress,
  FakeProgress,
  FakeProgressStep,
  FakeProgressWithTime,
  FakeUploadProgress,
  ProgressAnimation,
  ProgressLabelPosition,
  ProgressSize,
  ProgressState,
  ProgressVariant,
} from '@/.storybook/stories/_factories/progress.factory';
import {
  createFakeCircularProgress,
  createFakeCompleteProgress,
  createFakeErrorProgress,
  createFakeIndeterminateProgress,
  createFakeMultiStepProgress,
  createFakePausedProgress,
  createFakeProgress,
  createFakeProgressItems,
  createFakeProgressPercentages,
  createFakeProgressStep,
  createFakeProgressWithTime,
  createFakeUploadProgress,
  createFakeZeroProgress,
  createProgressAnimationMatrix,
  createProgressShowcase,
  createProgressSizeMatrix,
  createProgressStateMatrix,
  createProgressTestData,
  createProgressVariantMatrix,
  createProgressVariantSizeMatrix,
  PROGRESS_ANIMATIONS,
  PROGRESS_LABEL_POSITIONS,
  PROGRESS_SIZES,
  PROGRESS_STATES,
  PROGRESS_VARIANTS,
  SIZE_HEIGHTS,
  VARIANT_COLORS,
} from '@/.storybook/stories/_factories/progress.factory';

import { Progress } from '@/components/ui/progress';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function I18nProgressDemo(args: React.ComponentProps<typeof Progress>) {
  const { t } = useTranslation();
  const primaryValue = typeof args.value === 'number' ? args.value : 0;

  return (
    <div className="w-[420px] space-y-4" data-testid="i18n-progress-demo">
      <Progress
        {...args}
        aria-label={t('progress.ariaLabel', { value: primaryValue })}
        data-progress-value={String(primaryValue)}
        value={primaryValue}
      />
      <Progress
        aria-label={t('progress.ariaLabel', { value: 75 })}
        data-progress-value="75"
        indicatorColor="bg-green-500"
        value={75}
      />
      <Progress
        aria-label={t('progress.ariaLabel', { value: 15 })}
        data-progress-value="15"
        indicatorColor="bg-red-500"
        value={15}
      />
    </div>
  );
}

const meta = {
  title: 'Components/UI/Progress',
  component: Progress,
  tags: ['autodocs'],
  args: {
    value: 40,
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: progressHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // ─────────────────────────────────────────────────────────────────────────
    // CONTENT CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: i18n.t(
        'progress.argType.currentProgressValue0100UseNullForIndeterminateState',
        'Current progress value (0-100). Use null for indeterminate state.'
      ),
      table: {
        category: 'Content',
        type: { summary: 'number | null' },
        defaultValue: { summary: '0' },
      },
    },
    max: {
      control: { type: 'number', min: 1, max: 1000, step: 1 },
      description: i18n.t('progress.argType.maximumProgressValue', 'Maximum progress value'),
      table: {
        category: 'Content',
        type: { summary: 'number' },
        defaultValue: { summary: '100' },
      },
    },
    getValueLabel: {
      control: false,
      description: i18n.t(
        'progress.argType.customValueLabelForAccessibility',
        'Custom value label for accessibility'
      ),
      table: {
        category: 'Content',
        type: { summary: '(value: number, max: number) => string' },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // APPEARANCE CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    indicatorColor: {
      control: 'text',
      description: i18n.t(
        'progress.argType.customColorClassForTheProgressIndicatorEgBggreen500',
        'Custom color class for the progress indicator (e.g., bg-green-500)'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
        defaultValue: { summary: 'bg-primary' },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STATE CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    'aria-label': {
      control: 'text',
      description: i18n.t(
        'progress.argType.accessibleLabelForTheProgressBar',
        'Accessible label for the progress bar'
      ),
      table: {
        category: 'State',
        type: { summary: 'string' },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LAYOUT CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    className: {
      control: 'text',
      description: i18n.t(
        'progress.argType.additionalCssClassesForCustomStylingAndSizing',
        'Additional CSS classes for custom styling and sizing'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'string' },
      },
    },
    asChild: {
      control: 'boolean',
      description: i18n.t(
        'progress.argType.renderAsChildElementUsingRadixSlot',
        'Render as child element using Radix Slot'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT HANDLERS
    // ─────────────────────────────────────────────────────────────────────────
    onClick: {
      action: 'onClick',
      description: i18n.t('progress.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('progress.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('progress.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('progress.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('progress.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('progress.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('progress.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    // Progress Props Reference (Radix Progress.Root):
    // - value: Current progress value 0-100 (number | null)
    // - max: Maximum progress value (number, default: 100)
    // - getValueLabel: Custom value label for accessibility ((value: number, max: number) => string)
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    //
    // Custom Props:
    // - indicatorColor: Custom color class for the indicator (string, e.g., 'bg-green-500')
    //
    // Accessibility:
    // - aria-valuenow: Current value (automatically set)
    // - aria-valuemin: Minimum value (automatically set to 0)
    // - aria-valuemax: Maximum value (automatically set to max)
    // - aria-label: Descriptive label (should be provided)
  },
} satisfies Meta<typeof Progress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => <I18nProgressDemo {...args} />,
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

function VariantsDemo() {
  return (
    <div className="flex w-[420px] flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('progress.variants.determinate')}</p>
        <Progress
          value={65}
          aria-label={i18n.t('progress.story.percentComplete', '65% complete')}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('progress.variants.indeterminate')}</p>
        <Progress
          value={null}
          aria-label={i18n.t('progress.story.loading', 'Loading...')}
          className="animate-pulse"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('progress.variants.withLabel')}</p>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{i18n.t('progress.story.uploadingFiles', 'Uploading files...')}</span>
            <span>45%</span>
          </div>
          <Progress value={45} aria-label={i18n.t('progress.story.uploading45', 'Uploading 45%')} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('progress.variants.colored')}</p>
        <div className="space-y-3">
          <Progress
            value={80}
            indicatorColor="bg-green-500"
            aria-label={i18n.t('progress.story.success80', 'Success - 80%')}
          />
          <Progress
            value={50}
            indicatorColor="bg-yellow-500"
            aria-label={i18n.t('progress.story.warning50', 'Warning - 50%')}
          />
          <Progress
            value={20}
            indicatorColor="bg-red-500"
            aria-label={i18n.t('progress.story.error20', 'Error - 20%')}
          />
          <Progress
            value={60}
            indicatorColor="bg-blue-500"
            aria-label={i18n.t('progress.story.info60', 'Info - 60%')}
          />
        </div>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

function SizesDemo() {
  return (
    <div className="flex w-[420px] flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('progress.sizes.thin')}</p>
        <Progress
          value={60}
          className="h-0.5"
          aria-label={i18n.t('progress.story.thinProgress', 'Thin progress')}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('progress.sizes.default')}</p>
        <Progress
          value={60}
          aria-label={i18n.t('progress.story.defaultProgress', 'Default progress')}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('progress.sizes.thick')}</p>
        <Progress
          value={60}
          className="h-4"
          aria-label={i18n.t('progress.story.thickProgress', 'Thick progress')}
        />
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const getIndicator = (progressbar: Element) => {
      const indicator = progressbar.querySelector('[data-slot="progress-indicator"]');
      if (!(indicator instanceof HTMLElement)) {
        throw new Error('Progress indicator was not found.');
      }
      return indicator;
    };

    const assertProgress = ({
      value,
      transform,
      indicatorClass,
    }: {
      indicatorClass?: string;
      transform: string;
      value: number;
    }) => {
      const progressbar = canvasElement.querySelector(
        `[data-slot="progress"][data-progress-value="${value}"]`
      );
      if (!(progressbar instanceof HTMLElement)) {
        throw new Error(`Expected progress bar for value ${value} to be present.`);
      }
      expect(progressbar.getAttribute('data-slot')).toBe('progress');
      expect(progressbar.getAttribute('aria-label')?.trim()).not.toBe('');
      expect(progressbar.getAttribute('aria-valuenow')).toBe(String(value));

      const indicator = getIndicator(progressbar);
      expect(indicator.getAttribute('data-slot')).toBe('progress-indicator');
      expect(indicator.style.transform).toBe(transform);

      if (indicatorClass) {
        expect(indicator).toHaveClass(indicatorClass);
      }
    };

    assertProgress({
      value: 40,
      transform: 'translateX(-60%)',
    });

    assertProgress({
      value: 75,
      transform: 'translateX(-25%)',
      indicatorClass: 'bg-green-500',
    });

    assertProgress({
      value: 15,
      transform: 'translateX(-85%)',
      indicatorClass: 'bg-red-500',
    });
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const progress40 = context.canvasElement.querySelector('[data-progress-value="40"]');
    if (!(progress40 instanceof HTMLElement)) {
      throw new Error('Expected progress bar for value 40 to be present.');
    }
    expect(progress40.getAttribute('aria-label')).toBe('進捗 40%');

    const progress75 = context.canvasElement.querySelector('[data-progress-value="75"]');
    if (!(progress75 instanceof HTMLElement)) {
      throw new Error('Expected progress bar for value 75 to be present.');
    }
    expect(progress75.getAttribute('aria-label')).toBe('進捗 75%');

    const progress15 = context.canvasElement.querySelector('[data-progress-value="15"]');
    if (!(progress15 instanceof HTMLElement)) {
      throw new Error('Expected progress bar for value 15 to be present.');
    }
    expect(progress15.getAttribute('aria-label')).toBe('進捗 15%');

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
  name: i18n.t('progress.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ MSW + FAKER STORIES ============

function FakerProgressDemo() {
  const { t } = useTranslation();
  const progressData = [
    createFakeProgress({ value: 25 }),
    createFakeProgress({ value: 50 }),
    createFakeProgress({ value: 75 }),
    createFakeProgress({ value: 100 }),
  ];

  return (
    <div className="w-[420px] space-y-4" data-testid="faker-progress-demo">
      {progressData.map((progress, index) => (
        <div key={progress.id} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{progress.label ?? `Task ${index + 1}`}</span>
            <span>{progress.value}%</span>
          </div>
          <Progress
            aria-label={t('progress.ariaLabel', { value: progress.value })}
            data-progress-value={String(progress.value)}
            value={progress.value}
            indicatorColor={(() => {
              if (progress.value === 100) return 'bg-green-500';
              if (progress.value >= 75) return 'bg-blue-500';
              if (progress.value >= 50) return 'bg-yellow-500';
              return 'bg-red-500';
            })()}
          />
        </div>
      ))}
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <FakerProgressDemo />,
  play: async ({ canvasElement }) => {
    // Verify faker-generated progress bars are present
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).toBe(4);

    // Verify each progress bar has proper value attributes
    expect(canvasElement.querySelector('[data-progress-value="25"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-progress-value="50"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-progress-value="75"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-progress-value="100"]')).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  ...WithFakerData,
  parameters: {
    msw: { handlers: progressHandlers },
  },
  play: async ({ canvasElement }) => {
    // Verify progress bars are rendered with async data handlers
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

// ============================================================================
// FACTORY & MSW STORIES
// ============================================================================

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressHandlers },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Complete: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.complete },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Stalled: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.stalled },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Failed: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.failed },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Error409Conflict: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: progressStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: progressStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);
  },
};

export const Accessibility: Story = {
  name: i18n.t('progress.storyName.accessibility', 'Accessibility'),
  render: (args) => <I18nProgressDemo {...args} />,
  play: async ({ canvasElement }) => {
    // Get all progress bars
    const progressBars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(progressBars.length).not.toBe(0);

    progressBars.forEach((progressBar) => {
      if (!(progressBar instanceof HTMLElement)) return;

      // Verify role="progressbar"
      expect(progressBar.getAttribute('role')).toBe('progressbar');

      // Verify aria-label is present
      expect(progressBar.getAttribute('aria-label')).not.toBe('');

      // Verify aria-valuenow is set
      expect(progressBar).toHaveAttribute('aria-valuenow');
      const valueNow = progressBar.getAttribute('aria-valuenow');

      // Verify aria-valuemin is set (should be 0)
      expect(progressBar.getAttribute('aria-valuemin')).toBe('0');

      // Verify aria-valuemax is set (should be 100)
      expect(progressBar.getAttribute('aria-valuemax')).toBe('100');

      // Verify value is within valid range
      const value = Number(valueNow);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });

    // Verify indicator is present
    const indicators = canvasElement.querySelectorAll('[data-slot="progress-indicator"]');
    expect(indicators.length).not.toBe(0);
  },
};

// ============ FACTORY WIRING STORIES ============
// Type-assertion helpers to ensure all factory types/interfaces/constants are referenced

function _assertFactoryTypes(): void {
  // Type references (compile-time only, no runtime cost)
  const _variant: ProgressVariant = 'default';
  const _size: ProgressSize = 'default';
  const _state: ProgressState = 'active';
  const _animation: ProgressAnimation = 'none';
  const _labelPos: ProgressLabelPosition = 'above';
  const _fp: FakeProgress = {} as FakeProgress;
  const _fpt: FakeProgressWithTime = {} as FakeProgressWithTime;
  const _fms: FakeMultiStepProgress = {} as FakeMultiStepProgress;
  const _fps: FakeProgressStep = {} as FakeProgressStep;
  const _fup: FakeUploadProgress = {} as FakeUploadProgress;
  const _fcp: FakeCircularProgress = {} as FakeCircularProgress;
  void [_variant, _size, _state, _animation, _labelPos, _fp, _fpt, _fms, _fps, _fup, _fcp];
}
// Call once at module level so the function is not tree-shaken
_assertFactoryTypes();

// ─── createFakeProgressItems ─────────────────────────────────────────────────

function ProgressItemsDemo() {
  const items = createFakeProgressItems(5, { variant: 'default' });

  return (
    <div className="w-[420px] space-y-3" data-testid="progress-items-demo">
      {items.map((item) => (
        <div key={item.id} className="space-y-1">
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>{item.label ?? i18n.t('progress.default')}</span>
            <span>{item.value}%</span>
          </div>
          <Progress
            aria-label={i18n.t('progress.ariaLabel', { value: item.value })}
            data-testid={`progress-item-${item.id}`}
            value={item.value}
          />
        </div>
      ))}
    </div>
  );
}

export const WithProgressItems: Story = {
  render: () => <ProgressItemsDemo />,
  play: async ({ canvasElement }) => {
    const bars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(bars.length).toBe(5);
  },
};

// ─── createFakeProgressWithTime ──────────────────────────────────────────────

function ProgressWithTimeDemo() {
  const items = Array.from({ length: 3 }, () => createFakeProgressWithTime());

  return (
    <div className="w-[420px] space-y-4" data-testid="progress-with-time-demo">
      {items.map((item) => {
        const remainingSec = item.estimatedTimeRemaining
          ? Math.ceil(item.estimatedTimeRemaining / 1000)
          : null;
        return (
          <div key={item.id} className="space-y-1">
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{item.label ?? i18n.t('progress.default')}</span>
              <span>
                {item.value}%{remainingSec !== null ? ` · ~${remainingSec}s left` : ''}
              </span>
            </div>
            <Progress
              aria-label={i18n.t('progress.ariaLabel', { value: item.value })}
              data-testid={`progress-time-${item.id}`}
              value={item.value}
            />
          </div>
        );
      })}
    </div>
  );
}

export const WithTimeTracking: Story = {
  render: () => <ProgressWithTimeDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="progress-with-time-demo"]');
    expect(demo).toBeInTheDocument();
    const bars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(bars.length).toBe(3);
  },
};

// ─── createFakeProgressStep + createFakeMultiStepProgress ────────────────────

function MultiStepProgressDemo() {
  const multiStep = createFakeMultiStepProgress(5, 2);
  // Also exercise createFakeProgressStep individually
  const singleStep = createFakeProgressStep(0, {
    label: i18n.t('progress.story.individualStep', 'Individual Step'),
    completed: false,
  });

  return (
    <div className="w-[420px] space-y-4" data-testid="multi-step-progress-demo">
      <p className="text-sm font-medium">{i18n.t('progress.section.states')}</p>
      <p className="text-muted-foreground text-xs">
        {i18n.t(
          'progress.story.overallStepOf',
          'Overall: {{overall}}% · Step {{current}} of {{total}}',
          {
            overall: multiStep.overallProgress,
            current: multiStep.currentStep + 1,
            total: multiStep.steps.length,
          }
        )}
      </p>
      {multiStep.steps.map((step) => (
        <div key={step.id} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>
              {step.label} ({step.state})
            </span>
            <span>{step.progress}%</span>
          </div>
          <Progress
            aria-label={i18n.t('progress.ariaLabel', { value: step.progress })}
            data-testid={`multi-step-${step.id}`}
            indicatorColor={step.completed ? 'bg-green-500' : undefined}
            value={step.progress}
          />
        </div>
      ))}
      <div className="border-t pt-2">
        <p className="text-muted-foreground text-xs">
          {i18n.t('progress.story.singleStep', 'Single step: {{label}} ({{progress}}%)', {
            label: singleStep.label,
            progress: singleStep.progress,
          })}
        </p>
        <Progress
          aria-label={i18n.t('progress.ariaLabel', { value: singleStep.progress })}
          data-testid="single-step-progress"
          value={singleStep.progress}
        />
      </div>
    </div>
  );
}

export const MultiStepProgress: Story = {
  render: () => <MultiStepProgressDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="multi-step-progress-demo"]');
    expect(demo).toBeInTheDocument();
    // 5 step bars + 1 single step bar = 6
    const bars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(bars.length).toBe(6);
    expect(canvasElement.querySelector('[data-testid="single-step-progress"]')).toBeInTheDocument();
  },
};

// ─── createFakeUploadProgress ────────────────────────────────────────────────

function UploadProgressDemo() {
  const uploads = Array.from({ length: 3 }, () => createFakeUploadProgress());

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }

  return (
    <div className="w-[420px] space-y-4" data-testid="upload-progress-demo">
      {uploads.map((upload) => (
        <div key={upload.id} className="space-y-1 rounded-md border p-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium">
              {upload.fileName} (.{upload.fileType})
            </span>
            <span>{upload.value}%</span>
          </div>
          <Progress
            aria-label={i18n.t('progress.ariaLabel', { value: upload.value })}
            data-testid={`upload-${upload.id}`}
            indicatorColor="bg-blue-500"
            value={upload.value}
          />
          <p className="text-muted-foreground text-xs">
            {formatBytes(upload.bytesUploaded)} / {formatBytes(upload.fileSize)}
            {upload.uploadSpeed ? ` · ${formatBytes(upload.uploadSpeed)}/s` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

export const UploadProgress: Story = {
  render: () => <UploadProgressDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="upload-progress-demo"]');
    expect(demo).toBeInTheDocument();
    const bars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(bars.length).toBe(3);
  },
};

// ─── createFakeCircularProgress ──────────────────────────────────────────────

function CircularProgressDemo() {
  const items = Array.from({ length: 4 }, () => createFakeCircularProgress());

  return (
    <div className="flex flex-wrap gap-6" data-testid="circular-progress-demo">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col items-center gap-2">
          <div
            className="relative flex items-center justify-center"
            data-testid={`circular-${item.id}`}
            style={{ width: item.size, height: item.size }}
          >
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r={50 - item.strokeWidth}
                fill="none"
                stroke="currentColor"
                strokeWidth={item.strokeWidth}
                className="text-muted-foreground/20"
              />
              <circle
                cx="50"
                cy="50"
                r={50 - item.strokeWidth}
                fill="none"
                stroke="currentColor"
                strokeWidth={item.strokeWidth}
                strokeDasharray={`${2 * Math.PI * (50 - item.strokeWidth)}`}
                strokeDashoffset={`${2 * Math.PI * (50 - item.strokeWidth) * (1 - item.value / 100)}`}
                className="text-primary transition-all"
                strokeLinecap="round"
              />
            </svg>
            {item.showValue && <span className="absolute text-xs font-medium">{item.value}%</span>}
          </div>
          <span className="text-muted-foreground text-xs">
            {item.label ?? i18n.t('progress.default')}
          </span>
        </div>
      ))}
    </div>
  );
}

export const CircularProgress: Story = {
  render: () => <CircularProgressDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="circular-progress-demo"]');
    expect(demo).toBeInTheDocument();
    const circles = canvasElement.querySelectorAll('svg');
    expect(circles.length).toBe(4);
  },
};

// ─── createFakeZeroProgress ──────────────────────────────────────────────────

function ZeroProgressDemo() {
  const zero = createFakeZeroProgress();

  return (
    <div className="w-[420px] space-y-1" data-testid="zero-progress-demo">
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>{zero.label}</span>
        <span>{zero.value}%</span>
      </div>
      <Progress
        aria-label={i18n.t('progress.ariaLabel', { value: zero.value })}
        data-testid="zero-progress"
        value={zero.value}
      />
    </div>
  );
}

export const ZeroProgress: Story = {
  render: () => <ZeroProgressDemo />,
  play: async ({ canvasElement }) => {
    const bar = canvasElement.querySelector('[data-testid="zero-progress"]');
    expect(bar).toBeInTheDocument();
    expect(bar?.getAttribute('aria-valuenow')).toBe('0');
  },
};

// ─── createFakeCompleteProgress ──────────────────────────────────────────────

function CompleteProgressDemo() {
  const complete = createFakeCompleteProgress();

  return (
    <div className="w-[420px] space-y-1" data-testid="complete-progress-demo">
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>{complete.label}</span>
        <span>{complete.value}%</span>
      </div>
      <Progress
        aria-label={i18n.t('progress.a11y.completeLabel')}
        data-testid="complete-progress"
        indicatorColor={VARIANT_COLORS[complete.variant]}
        value={complete.value}
      />
    </div>
  );
}

export const CompleteProgress: Story = {
  render: () => <CompleteProgressDemo />,
  play: async ({ canvasElement }) => {
    const bar = canvasElement.querySelector('[data-testid="complete-progress"]');
    expect(bar).toBeInTheDocument();
    expect(bar?.getAttribute('aria-valuenow')).toBe('100');
  },
};

// ─── createFakeErrorProgress ─────────────────────────────────────────────────

function ErrorProgressDemo() {
  const error = createFakeErrorProgress();

  return (
    <div className="w-[420px] space-y-1" data-testid="error-progress-demo">
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>{error.label}</span>
        <span>{error.value}%</span>
      </div>
      <Progress
        aria-label={i18n.t('progress.ariaLabel', { value: error.value })}
        data-testid="error-progress"
        indicatorColor="bg-red-500"
        value={error.value}
      />
    </div>
  );
}

export const ErrorProgress: Story = {
  render: () => <ErrorProgressDemo />,
  play: async ({ canvasElement }) => {
    const bar = canvasElement.querySelector('[data-testid="error-progress"]');
    expect(bar).toBeInTheDocument();
    const value = Number(bar?.getAttribute('aria-valuenow'));
    expect(value).toBeGreaterThanOrEqual(20);
    expect(value).toBeLessThanOrEqual(80);
  },
};

// ─── createFakeIndeterminateProgress ─────────────────────────────────────────

function IndeterminateProgressDemo() {
  const indeterminate = createFakeIndeterminateProgress();

  return (
    <div className="w-[420px] space-y-1" data-testid="indeterminate-progress-demo">
      <p className="text-muted-foreground text-xs">{indeterminate.label}</p>
      <Progress
        aria-label={i18n.t('progress.a11y.indeterminateLabel')}
        className="animate-pulse"
        data-testid="indeterminate-progress"
        value={null}
      />
    </div>
  );
}

export const IndeterminateProgress: Story = {
  render: () => <IndeterminateProgressDemo />,
  play: async ({ canvasElement }) => {
    const bar = canvasElement.querySelector('[data-testid="indeterminate-progress"]');
    expect(bar).toBeInTheDocument();
  },
};

// ─── createFakePausedProgress ────────────────────────────────────────────────

function PausedProgressDemo() {
  const paused = createFakePausedProgress();

  return (
    <div className="w-[420px] space-y-1" data-testid="paused-progress-demo">
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>{paused.label}</span>
        <span>{paused.value}%</span>
      </div>
      <Progress
        aria-label={i18n.t('progress.ariaLabel', { value: paused.value })}
        data-testid="paused-progress"
        indicatorColor="bg-yellow-500"
        value={paused.value}
      />
    </div>
  );
}

export const PausedProgress: Story = {
  render: () => <PausedProgressDemo />,
  play: async ({ canvasElement }) => {
    const bar = canvasElement.querySelector('[data-testid="paused-progress"]');
    expect(bar).toBeInTheDocument();
    const value = Number(bar?.getAttribute('aria-valuenow'));
    expect(value).toBeGreaterThanOrEqual(30);
    expect(value).toBeLessThanOrEqual(70);
  },
};

// ─── createFakeProgressPercentages ───────────────────────────────────────────

function ProgressPercentagesDemo() {
  const percentages = createFakeProgressPercentages();

  return (
    <div className="w-[420px] space-y-3" data-testid="progress-percentages-demo">
      {percentages.map((item) => (
        <div key={item.id} className="space-y-1">
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>{item.state}</span>
            <span>{item.value}%</span>
          </div>
          <Progress
            aria-label={i18n.t('progress.ariaLabel', { value: item.value })}
            data-testid={`percentages-${item.value}`}
            value={item.value}
          />
        </div>
      ))}
    </div>
  );
}

export const ProgressPercentages: Story = {
  render: () => <ProgressPercentagesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="percentages-0"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="percentages-25"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="percentages-50"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="percentages-75"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="percentages-100"]')).toBeInTheDocument();
  },
};

// ─── createProgressVariantMatrix ─────────────────────────────────────────────

function VariantMatrixDemo() {
  const { t } = useTranslation();
  const matrix = createProgressVariantMatrix();

  return (
    <div className="w-[420px] space-y-3" data-testid="variant-matrix-demo">
      <p className="text-sm font-medium">{t('progress.section.variants')}</p>
      {matrix.map((item) => (
        <div key={item.id} className="space-y-1">
          <span className="text-muted-foreground text-xs">{item.variant}</span>
          <Progress
            aria-label={t('progress.ariaLabel', { value: item.value })}
            data-testid={`variant-${item.variant}`}
            indicatorColor={item.indicatorColor}
            value={item.value}
          />
        </div>
      ))}
    </div>
  );
}

export const VariantMatrix: Story = {
  render: () => <VariantMatrixDemo />,
  play: async ({ canvasElement }) => {
    for (const variant of PROGRESS_VARIANTS) {
      expect(canvasElement.querySelector(`[data-testid="variant-${variant}"]`)).toBeInTheDocument();
    }
  },
};

// ─── createProgressSizeMatrix ────────────────────────────────────────────────

function SizeMatrixDemo() {
  const { t } = useTranslation();
  const matrix = createProgressSizeMatrix();

  return (
    <div className="w-[420px] space-y-4" data-testid="size-matrix-demo">
      <p className="text-sm font-medium">{t('progress.section.sizes')}</p>
      {matrix.map((item, idx) => {
        const sizeName = PROGRESS_SIZES[idx];
        const heightClass = SIZE_HEIGHTS[sizeName];
        return (
          <div key={item.id} className="space-y-1">
            <span className="text-muted-foreground text-xs">
              {sizeName} ({heightClass})
            </span>
            <Progress
              aria-label={t('progress.ariaLabel', { value: item.value })}
              className={heightClass}
              data-testid={`size-${sizeName}`}
              value={item.value}
            />
          </div>
        );
      })}
    </div>
  );
}

export const SizeMatrix: Story = {
  render: () => <SizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    for (const size of PROGRESS_SIZES) {
      expect(canvasElement.querySelector(`[data-testid="size-${size}"]`)).toBeInTheDocument();
    }
  },
};

// ─── createProgressStateMatrix ───────────────────────────────────────────────

function StateMatrixDemo() {
  const { t } = useTranslation();
  const matrix = createProgressStateMatrix();

  return (
    <div className="w-[420px] space-y-3" data-testid="state-matrix-demo">
      <p className="text-sm font-medium">{t('progress.section.states')}</p>
      {matrix.map((item, idx) => {
        const stateName = PROGRESS_STATES[idx];
        return (
          <div key={item.id} className="space-y-1">
            <span className="text-muted-foreground text-xs">{stateName}</span>
            <Progress
              aria-label={t('progress.ariaLabel', { value: item.value })}
              className={stateName === 'indeterminate' ? 'animate-pulse' : undefined}
              data-testid={`state-${stateName}`}
              value={stateName === 'indeterminate' ? null : item.value}
            />
          </div>
        );
      })}
    </div>
  );
}

export const StateMatrix: Story = {
  render: () => <StateMatrixDemo />,
  play: async ({ canvasElement }) => {
    for (const state of PROGRESS_STATES) {
      expect(canvasElement.querySelector(`[data-testid="state-${state}"]`)).toBeInTheDocument();
    }
  },
};

// ─── createProgressAnimationMatrix ───────────────────────────────────────────

function AnimationMatrixDemo() {
  const { t } = useTranslation();
  const matrix = createProgressAnimationMatrix();

  return (
    <div className="w-[420px] space-y-3" data-testid="animation-matrix-demo">
      <p className="text-sm font-medium">{t('progress.section.animations')}</p>
      {matrix.map((item, idx) => {
        const animationName = PROGRESS_ANIMATIONS[idx];
        const shouldPulse = animationName === 'pulse' || animationName === 'indeterminate';
        return (
          <div key={item.id} className="space-y-1">
            <span className="text-muted-foreground text-xs">{animationName}</span>
            <Progress
              aria-label={t('progress.ariaLabel', { value: item.value })}
              className={shouldPulse ? 'animate-pulse' : undefined}
              data-testid={`animation-${animationName}`}
              value={animationName === 'indeterminate' ? null : item.value}
            />
          </div>
        );
      })}
    </div>
  );
}

export const AnimationMatrix: Story = {
  render: () => <AnimationMatrixDemo />,
  play: async ({ canvasElement }) => {
    for (const animation of PROGRESS_ANIMATIONS) {
      expect(
        canvasElement.querySelector(`[data-testid="animation-${animation}"]`)
      ).toBeInTheDocument();
    }
  },
};

// ─── createProgressVariantSizeMatrix ─────────────────────────────────────────

function VariantSizeMatrixDemo() {
  const { t } = useTranslation();
  const matrix = createProgressVariantSizeMatrix();

  return (
    <div className="space-y-6" data-testid="variant-size-matrix-demo">
      {matrix.map((row, rowIdx) => {
        const variant = PROGRESS_VARIANTS[rowIdx];
        return (
          <div key={variant} className="space-y-2">
            <p className="text-xs font-semibold capitalize">{variant}</p>
            <div className="space-y-2">
              {row.map((item, colIdx) => {
                const size = PROGRESS_SIZES[colIdx];
                return (
                  <Progress
                    key={item.id}
                    aria-label={t('progress.ariaLabel', { value: item.value })}
                    className={SIZE_HEIGHTS[size]}
                    data-testid={`vs-${variant}-${size}`}
                    indicatorColor={item.indicatorColor}
                    value={item.value}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const VariantSizeMatrix: Story = {
  render: () => <VariantSizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="variant-size-matrix-demo"]');
    expect(demo).toBeInTheDocument();
    // 5 variants * 5 sizes = 25 bars
    const bars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(bars.length).toBe(25);
  },
};

// ─── createProgressShowcase ──────────────────────────────────────────────────

function ShowcaseDemo() {
  const showcase = createProgressShowcase();

  return (
    <div className="w-[420px] space-y-4" data-testid="showcase-demo">
      {showcase.map((entry) => {
        const value = 'value' in entry.progress ? (entry.progress.value as number) : 0;
        return (
          <div key={entry.name} className="space-y-1 rounded-md border p-2">
            <p className="text-sm font-medium">{entry.name}</p>
            <p className="text-muted-foreground text-xs">{entry.description}</p>
            <Progress
              aria-label={i18n.t('progress.ariaLabel', { value })}
              data-testid={`showcase-${entry.name.toLowerCase().replaceAll(/\s+/g, '-')}`}
              value={value}
            />
          </div>
        );
      })}
    </div>
  );
}

export const Showcase: Story = {
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="showcase-demo"]');
    expect(demo).toBeInTheDocument();
    // 8 showcase entries
    const bars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(bars.length).toBe(8);
  },
};

// ─── createProgressTestData ──────────────────────────────────────────────────

function TestDataDemo() {
  const data = createProgressTestData();

  return (
    <div className="w-[480px] space-y-6" data-testid="test-data-demo">
      <div>
        <p className="text-xs font-semibold">progressItems ({data.progressItems.length})</p>
        {data.progressItems.map((item) => (
          <Progress
            key={item.id}
            aria-label={i18n.t('progress.ariaLabel', { value: item.value })}
            className="my-1"
            value={item.value}
          />
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold">withTime ({data.withTime.length})</p>
        {data.withTime.map((item) => (
          <Progress
            key={item.id}
            aria-label={i18n.t('progress.ariaLabel', { value: item.value })}
            className="my-1"
            value={item.value}
          />
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold">percentages ({data.percentages.length})</p>
        {data.percentages.map((item) => (
          <Progress
            key={item.id}
            aria-label={i18n.t('progress.ariaLabel', { value: item.value })}
            className="my-1"
            value={item.value}
          />
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold">variantMatrix ({data.variantMatrix.length})</p>
        {data.variantMatrix.map((item) => (
          <Progress
            key={item.id}
            aria-label={i18n.t('progress.ariaLabel', { value: item.value })}
            className="my-1"
            indicatorColor={item.indicatorColor}
            value={item.value}
          />
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold">sizeMatrix ({data.sizeMatrix.length})</p>
        {data.sizeMatrix.map((item, idx) => (
          <Progress
            key={item.id}
            aria-label={i18n.t('progress.ariaLabel', { value: item.value })}
            className={`my-1 ${SIZE_HEIGHTS[PROGRESS_SIZES[idx]]}`}
            value={item.value}
          />
        ))}
      </div>
    </div>
  );
}

export const TestData: Story = {
  render: () => <TestDataDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="test-data-demo"]');
    expect(demo).toBeInTheDocument();
    // 5 + 3 + 5 + 5 + 5 = 23 bars
    const bars = canvasElement.querySelectorAll('[data-slot="progress"]');
    expect(bars.length).toBe(23);
  },
};

// ─── PROGRESS_LABEL_POSITIONS constant usage ─────────────────────────────────

function LabelPositionsDemo() {
  return (
    <div className="w-[420px] space-y-4" data-testid="label-positions-demo">
      {PROGRESS_LABEL_POSITIONS.map((position) => (
        <div key={position} className="space-y-1">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span>label position: {position}</span>
          </div>
          {position === 'above' && (
            <div className="flex justify-between text-xs">
              <span>{i18n.t('progress.default')}</span>
              <span>60%</span>
            </div>
          )}
          <Progress
            aria-label={i18n.t('progress.ariaLabel', { value: 60 })}
            data-testid={`label-pos-${position}`}
            value={60}
          />
          {position === 'below' && (
            <div className="flex justify-between text-xs">
              <span>{i18n.t('progress.default')}</span>
              <span>60%</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export const LabelPositions: Story = {
  render: () => <LabelPositionsDemo />,
  play: async ({ canvasElement }) => {
    for (const position of PROGRESS_LABEL_POSITIONS) {
      expect(
        canvasElement.querySelector(`[data-testid="label-pos-${position}"]`)
      ).toBeInTheDocument();
    }
  },
};

// ─── VARIANT_COLORS constant usage ───────────────────────────────────────────

function VariantColorsDemo() {
  const { t } = useTranslation();

  return (
    <div className="w-[420px] space-y-3" data-testid="variant-colors-demo">
      {PROGRESS_VARIANTS.map((variant) => (
        <div key={variant} className="space-y-1">
          <span className="text-muted-foreground text-xs">
            {variant}: {VARIANT_COLORS[variant]}
          </span>
          <Progress
            aria-label={t('progress.ariaLabel', { value: 65 })}
            data-testid={`color-${variant}`}
            indicatorColor={VARIANT_COLORS[variant]}
            value={65}
          />
        </div>
      ))}
    </div>
  );
}

export const VariantColors: Story = {
  render: () => <VariantColorsDemo />,
  play: async ({ canvasElement }) => {
    for (const variant of PROGRESS_VARIANTS) {
      const bar = canvasElement.querySelector(`[data-testid="color-${variant}"]`);
      expect(bar).toBeInTheDocument();
      const indicator = bar?.querySelector('[data-slot="progress-indicator"]');
      expect(indicator).toHaveClass(VARIANT_COLORS[variant]);
    }
  },
};

// ─── SIZE_HEIGHTS constant usage ─────────────────────────────────────────────

function SizeHeightsDemo() {
  return (
    <div className="w-[420px] space-y-4" data-testid="size-heights-demo">
      {PROGRESS_SIZES.map((size) => (
        <div key={size} className="space-y-1">
          <span className="text-muted-foreground text-xs">
            {size}: {SIZE_HEIGHTS[size]}
          </span>
          <Progress
            aria-label={i18n.t('progress.ariaLabel', { value: 55 })}
            className={SIZE_HEIGHTS[size]}
            data-testid={`height-${size}`}
            value={55}
          />
        </div>
      ))}
    </div>
  );
}

export const SizeHeights: Story = {
  render: () => <SizeHeightsDemo />,
  play: async ({ canvasElement }) => {
    for (const size of PROGRESS_SIZES) {
      expect(canvasElement.querySelector(`[data-testid="height-${size}"]`)).toBeInTheDocument();
    }
  },
};

// ============================================================================
// CROSS-CUTTING CONCERN STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('progress.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('progress.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('progress.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('progress.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('progress.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: progressStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
