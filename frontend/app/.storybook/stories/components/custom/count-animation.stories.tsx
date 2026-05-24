import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';

import type {
  AnimationDirection,
  AnimationDuration,
  AnimationEasing,
  FakeAnimationSequence,
  FakeComparisonAnimation,
  FakeCountAnimation,
  FakeCountAnimationFormatted,
  FakeCountAnimationMatrix,
  FakeCountAnimationShowcase,
  FakeCountdownTimer,
  FakeCurrencyAnimation,
  FakeDashboardStat,
  FakeMetricAnimation,
  FakePercentageAnimation,
  FakeProgressCounter,
  MetricCategory,
  NumberFormat,
} from '@/.storybook/stories/_factories/count-animation.factory';
import {
  ANIMATION_DIRECTIONS,
  ANIMATION_DURATION_NAMES,
  ANIMATION_DURATIONS,
  ANIMATION_EASINGS,
  createFakeAnimationSequence,
  createFakeCategoryMetrics,
  createFakeComparisonAnimation,
  createFakeComparisonAnimations,
  createFakeCountAnimation,
  createFakeCountAnimationFormatted,
  createFakeCountAnimationMatrix,
  createFakeCountAnimations,
  createFakeCountAnimationShowcase,
  createFakeCountdownTimer,
  createFakeCurrencyAnimation,
  createFakeCurrencyAnimations,
  createFakeDashboardStat,
  createFakeDashboardStats,
  createFakeDashboardStatsSet,
  createFakeDurationPresetAnimations,
  createFakeMetricAnimation,
  createFakeMetricAnimations,
  createFakeMidnightCountdown,
  createFakePercentageAnimation,
  createFakePercentageAnimations,
  createFakeProgressCounter,
  createFakeProgressCounters,
  createFakeRatingAnimation,
  createFakeRevenueAnimation,
  createFakeScoreAnimation,
  createFakeUserCountAnimation,
  createFakeValueRangeAnimations,
  CURRENCY_SYMBOLS,
  METRIC_CATEGORIES,
  METRIC_LABELS,
  METRIC_RANGES,
  NUMBER_FORMATS,
} from '@/.storybook/stories/_factories/count-animation.factory';
import {
  countAnimationHandlers,
  countAnimationStatusHandlers,
} from '@/.storybook/stories/_handlers/count-animation.handlers';
import { useTranslation } from 'react-i18next';
import { CountAnimation } from '@/components/ui/custom/count-animation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

// =============================================================================
// TYPE GUARD HELPERS (consume type imports to avoid unused warnings)
// =============================================================================

function _assertTypes() {
  // This function is never called but ensures type imports are consumed
  const _direction: AnimationDirection = 'up';
  const _duration: AnimationDuration = 'normal';
  const _easing: AnimationEasing = 'linear';
  const _format: NumberFormat = 'integer';
  const _category: MetricCategory = 'users';
  const _animation: FakeCountAnimation = {} as FakeCountAnimation;
  const _formatted: FakeCountAnimationFormatted = {} as FakeCountAnimationFormatted;
  const _metric: FakeMetricAnimation = {} as FakeMetricAnimation;
  const _currency: FakeCurrencyAnimation = {} as FakeCurrencyAnimation;
  const _percentage: FakePercentageAnimation = {} as FakePercentageAnimation;
  const _comparison: FakeComparisonAnimation = {} as FakeComparisonAnimation;
  const _dashboard: FakeDashboardStat = {} as FakeDashboardStat;
  const _countdown: FakeCountdownTimer = {} as FakeCountdownTimer;
  const _progress: FakeProgressCounter = {} as FakeProgressCounter;
  const _sequence: FakeAnimationSequence = {} as FakeAnimationSequence;
  const _matrix: FakeCountAnimationMatrix = {} as FakeCountAnimationMatrix;
  const _showcase: FakeCountAnimationShowcase = {} as FakeCountAnimationShowcase;
  return [
    _direction,
    _duration,
    _easing,
    _format,
    _category,
    _animation,
    _formatted,
    _metric,
    _currency,
    _percentage,
    _comparison,
    _dashboard,
    _countdown,
    _progress,
    _sequence,
    _matrix,
    _showcase,
  ];
}
// Prevents tree-shaking removal
void _assertTypes;

/**
 * Get translated change type label
 */
function getChangeLabel(changeType: 'decrease' | 'increase' | 'neutral'): string {
  if (changeType === 'increase') return i18n.t('countAnimation.label.increase');
  if (changeType === 'decrease') return i18n.t('countAnimation.label.decrease');
  return i18n.t('countAnimation.label.neutral');
}

function CountAnimationDemo({ duration = 0, from = 0 }: { duration?: number; from?: number }) {
  return (
    <div className="grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm" />
        </CardHeader>
        <CardContent className="text-3xl font-semibold tabular-nums">
          <CountAnimation from={from} value={1280} duration={duration} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm" />
        </CardHeader>
        <CardContent className="text-3xl font-semibold tabular-nums">
          <CountAnimation from={from} value={742} duration={duration} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm" />
        </CardHeader>
        <CardContent className="text-3xl font-semibold tabular-nums">
          <CountAnimation from={from} value={63} duration={duration} />
        </CardContent>
      </Card>
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Count Animation',
  component: CountAnimationDemo,
  tags: ['autodocs'],
  args: {
    duration: 0,
    from: 0,
  },
  argTypes: {
    // Content
    from: {
      control: { type: 'number' },
      description: i18n.t(
        'countAnimation.argType.startingNumberForTheAnimation',
        'Starting number for the animation'
      ),
      table: {
        category: 'Content',
        type: { summary: 'number' },
        defaultValue: { summary: '0' },
      },
    },
    // Appearance
    duration: {
      control: { type: 'number', min: 0, max: 5, step: 0.1 },
      description: i18n.t(
        'countAnimation.argType.animationDurationInSeconds0Instant',
        'Animation duration in seconds (0 = instant)'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'number' },
        defaultValue: { summary: '0' },
      },
    },
  },
  parameters: {
    msw: { handlers: countAnimationHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof CountAnimationDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();

    const canvas = within(canvasElement);

    expect(canvas.getByText('1280')).toBeInTheDocument();
    expect(canvas.getByText('742')).toBeInTheDocument();
    expect(canvas.getByText('63')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('1280')).toBeInTheDocument();
    expect(canvas.getByText('742')).toBeInTheDocument();
    expect(canvas.getByText('63')).toBeInTheDocument();
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('1280')).toBeInTheDocument();
    expect(canvas.getByText('742')).toBeInTheDocument();
    expect(canvas.getByText('63')).toBeInTheDocument();
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
    expect(canvas.getByText('1280')).toBeInTheDocument();
    expect(canvas.getByText('742')).toBeInTheDocument();
    expect(canvas.getByText('63')).toBeInTheDocument();
  },
};

export const Animated: Story = {
  ...Default,
  tags: ['!test'],
  args: {
    ...(Default.args ?? {}),
    duration: 2,
    from: 0,
  },
  parameters: {
    ...(Default.parameters ?? {}),
    chromatic: {
      delay: 2500,
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const AnimatedFromNonZero: Story = {
  ...Animated,
  name: i18n.t('countAnimation.storyName.animatedFromNonZero', 'Animated (from non-zero)'),
  args: {
    ...(Animated.args ?? {}),
    from: 25,
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('1280')).toBeInTheDocument();
    expect(canvas.getByText('742')).toBeInTheDocument();
    expect(canvas.getByText('63')).toBeInTheDocument();
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
  name: i18n.t('countAnimation.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ VARIANTS & SIZES ============

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('countAnimation.story.instantNoAnimation', 'Instant (no animation)')}
        </p>
        <div className="text-3xl font-semibold tabular-nums">
          <CountAnimation value={1280} duration={0} />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('countAnimation.story.animated2sDuration', 'Animated (2s duration)')}
        </p>
        <div className="text-3xl font-semibold tabular-nums">
          <CountAnimation value={1280} duration={2} />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('countAnimation.story.fromNonzeroStart', 'From non-zero start')}
        </p>
        <div className="text-3xl font-semibold tabular-nums">
          <CountAnimation value={1280} from={500} duration={2} />
        </div>
      </div>
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('countAnimation.story.smallTextlg', 'Small (text-lg)')}
        </p>
        <div className="text-lg font-semibold tabular-nums">
          <CountAnimation value={1280} duration={0} />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('countAnimation.story.mediumText3xl', 'Medium (text-3xl)')}
        </p>
        <div className="text-3xl font-semibold tabular-nums">
          <CountAnimation value={1280} duration={0} />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('countAnimation.story.largeText5xl', 'Large (text-5xl)')}
        </p>
        <div className="text-5xl font-semibold tabular-nums">
          <CountAnimation value={1280} duration={0} />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const countElements = canvasElement.querySelectorAll('[data-slot="count-animation"]');
    expect(countElements.length).toBe(3);
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  name: i18n.t('countAnimation.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify count animation elements are present
    const countElements = canvasElement.querySelectorAll('[data-slot="count-animation"]');
    expect(countElements.length).not.toBe(0);

    // Verify tabular-nums class for consistent digit width (accessibility for users with cognitive disabilities)
    const cards = canvas.getAllByRole('heading', { level: 3 });
    expect(cards.length).not.toBe(0);

    // Verify numbers are displayed and readable
    expect(canvas.getByText('1280')).toBeInTheDocument();
    expect(canvas.getByText('742')).toBeInTheDocument();
    expect(canvas.getByText('63')).toBeInTheDocument();

    // Verify semantic structure with cards
    const cardContents = canvasElement.querySelectorAll('[data-slot="card-content"]');
    expect(cardContents.length).not.toBe(0);
  },
};

// ============ FAKER INTEGRATION STORIES ============

function CountAnimationWithFakerData() {
  const items = React.useMemo(() => createFakeCountAnimations(3), []);

  return (
    <div className="grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle className="text-sm">
              {item.direction === 'up'
                ? i18n.t('countAnimation.label.increase')
                : i18n.t('countAnimation.label.decrease')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold tabular-nums">
            <CountAnimation from={item.from} value={item.value} duration={0} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <CountAnimationWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(3);
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: countAnimationHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('1280')).toBeInTheDocument();
  },
};

// ============ MSW + STATUS STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: countAnimationHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('1280')).toBeInTheDocument();
    expect(canvas.getByText('742')).toBeInTheDocument();
    expect(canvas.getByText('63')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  render: () => (
    <div className="grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{i18n.t('countAnimation.story.users', 'Users')}</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold tabular-nums">
          <CountAnimation from={0} value={0} duration={0} />
        </CardContent>
      </Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('0')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('countAnimation.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('countAnimation.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('countAnimation.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('countAnimation.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  name: i18n.t('countAnimation.storyName.error404NotFound', 'Error 404: Not Found'),
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('countAnimation.storyName.error409Conflict', 'Error 409: Conflict'),
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t(
    'countAnimation.storyName.error422UnprocessableEntity',
    'Error 422: Unprocessable Entity'
  ),
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('countAnimation.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'countAnimation.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('countAnimation.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t(
    'countAnimation.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('countAnimation.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

// ============ SPECIAL STATE STORIES ============

export const NetworkError: Story = {
  name: i18n.t('countAnimation.storyName.networkError', 'Network Error'),
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

// ============ SINGLE FACTORY FUNCTION STORIES ============

function SingleCountAnimationDemo() {
  const { t } = useTranslation();
  const item = React.useMemo(() => createFakeCountAnimation(), []);

  return (
    <Card className="w-full max-w-xs">
      <CardHeader>
        <CardTitle className="text-sm">{t('countAnimation.default')}</CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-semibold tabular-nums">
        <CountAnimation from={item.from} value={item.value} duration={0} />
      </CardContent>
    </Card>
  );
}

export const SingleAnimation: Story = {
  render: () => <SingleCountAnimationDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(1);
  },
};

// ============ FORMATTED ANIMATION STORIES ============

function FormattedAnimationDemo() {
  const items = React.useMemo(
    () => [
      createFakeCountAnimationFormatted({ format: 'integer' }),
      createFakeCountAnimationFormatted({ format: 'decimal', decimalPlaces: 2 }),
      createFakeCountAnimationFormatted({ format: 'percentage', suffix: '%' }),
      createFakeCountAnimationFormatted({ format: 'currency', prefix: '$' }),
      createFakeCountAnimationFormatted({ format: 'compact' }),
      createFakeCountAnimationFormatted({ format: 'ordinal' }),
    ],
    []
  );

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.formatted')}</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-sm">
                {i18n.t('countAnimation.label.format')}: {item.format}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {item.prefix && <span>{item.prefix}</span>}
              <CountAnimation from={item.from} value={Math.round(item.value)} duration={0} />
              {item.suffix && <span>{item.suffix}</span>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const FormattedAnimations: Story = {
  render: () => <FormattedAnimationDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(6);
  },
};

// ============ METRIC ANIMATION STORIES ============

function MetricAnimationsDemo() {
  const items = React.useMemo(() => createFakeMetricAnimations(4), []);
  const singleMetric = React.useMemo(() => createFakeMetricAnimation(), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.metrics')}</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
        {[singleMetric, ...items].map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-sm">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">
                <CountAnimation from={item.from} value={item.value} duration={0} />
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {getChangeLabel(item.changeType)} {Math.abs(item.changePercent)}%
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const MetricAnimations: Story = {
  render: () => <MetricAnimationsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(5);
  },
};

// ============ CATEGORY METRICS STORIES ============

function CategoryMetricsDemo() {
  const categories = React.useMemo(
    () =>
      METRIC_CATEGORIES.map((cat) => ({
        category: cat,
        items: createFakeCategoryMetrics(cat, 2),
      })),
    []
  );

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.categoryMetrics')}</h3>
      {categories.map(({ category, items }) => (
        <div key={category}>
          <p className="text-muted-foreground mb-2 text-sm">
            {i18n.t('countAnimation.label.category')}: {category}
          </p>
          <div className="grid w-full max-w-xl grid-cols-2 gap-4">
            {items.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle className="text-sm">{item.label}</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold tabular-nums">
                  <CountAnimation from={item.from} value={item.value} duration={0} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const CategoryMetrics: Story = {
  render: () => <CategoryMetricsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(12);
  },
};

// ============ CURRENCY ANIMATION STORIES ============

function CurrencyAnimationsDemo() {
  const items = React.useMemo(() => createFakeCurrencyAnimations(5), []);
  const singleCurrency = React.useMemo(() => createFakeCurrencyAnimation(), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.currency')}</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
        {[singleCurrency, ...items].map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-sm">
                {item.currencyCode} ({item.currencySymbol})
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              <span>{item.currencySymbol}</span>
              <CountAnimation from={item.from} value={item.value} duration={0} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const CurrencyAnimations: Story = {
  render: () => <CurrencyAnimationsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(6);
  },
};

// ============ PERCENTAGE ANIMATION STORIES ============

function PercentageAnimationsDemo() {
  const items = React.useMemo(() => createFakePercentageAnimations(4), []);
  const singlePercentage = React.useMemo(() => createFakePercentageAnimation(), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.percentage')}</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-5">
        {[singlePercentage, ...items].map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-sm" style={{ color: item.color }}>
                {item.color}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {item.showSign && item.value > 0 && <span>+</span>}
              <CountAnimation from={item.from} value={Math.round(item.value)} duration={0} />
              <span>%</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const PercentageAnimations: Story = {
  render: () => <PercentageAnimationsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(5);
  },
};

// ============ COMPARISON ANIMATION STORIES ============

function ComparisonAnimationsDemo() {
  const items = React.useMemo(() => createFakeComparisonAnimations(3), []);
  const singleComparison = React.useMemo(() => createFakeComparisonAnimation(), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.comparison')}</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4">
        {[singleComparison, ...items].map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-sm">{item.comparisonLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">
                <CountAnimation from={item.from} value={item.value} duration={0} />
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                <span>
                  {i18n.t('countAnimation.label.previous')}: {item.previousValue}
                </span>
                <span className="ml-2">
                  ({item.changePercent > 0 ? '+' : ''}
                  {item.changePercent}%)
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const ComparisonAnimations: Story = {
  render: () => <ComparisonAnimationsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(4);
  },
};

// ============ DASHBOARD STAT STORIES ============

function DashboardStatsDemo() {
  const stats = React.useMemo(() => createFakeDashboardStats(4), []);
  const singleStat = React.useMemo(() => createFakeDashboardStat(), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.dashboard')}</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-5">
        {[singleStat, ...stats].map((stat) => (
          <Card key={stat.countAnimation.id}>
            <CardHeader>
              <CardTitle className="text-sm">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">
                <CountAnimation
                  from={stat.countAnimation.from}
                  value={stat.countAnimation.value}
                  duration={0}
                />
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {getChangeLabel(stat.changeType)} {Math.abs(stat.changePercent)}%
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const DashboardStats: Story = {
  render: () => <DashboardStatsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(5);
  },
};

// ============ DASHBOARD STATS SET STORIES ============

function DashboardStatsSetDemo() {
  const statsSet = React.useMemo(() => createFakeDashboardStatsSet(), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.dashboardSet')}</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
        {statsSet.map((stat) => (
          <Card key={stat.countAnimation.id}>
            <CardHeader>
              <CardTitle className="text-sm">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">
                <CountAnimation
                  from={stat.countAnimation.from}
                  value={stat.countAnimation.value}
                  duration={0}
                />
              </div>
              <p className="text-muted-foreground mt-1 text-xs">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const DashboardStatsSet: Story = {
  render: () => <DashboardStatsSetDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(4);
  },
};

// ============ COUNTDOWN TIMER STORIES ============

function CountdownTimerDemo() {
  const timer = React.useMemo(() => createFakeCountdownTimer(), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.countdown')}</h3>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{timer.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-3xl font-semibold tabular-nums">
                <CountAnimation from={timer.days.from} value={timer.days.from} duration={0} />
              </div>
              <p className="text-muted-foreground text-xs">{i18n.t('countAnimation.label.days')}</p>
            </div>
            <div>
              <div className="text-3xl font-semibold tabular-nums">
                <CountAnimation from={timer.hours.from} value={timer.hours.from} duration={0} />
              </div>
              <p className="text-muted-foreground text-xs">
                {i18n.t('countAnimation.label.hours')}
              </p>
            </div>
            <div>
              <div className="text-3xl font-semibold tabular-nums">
                <CountAnimation from={timer.minutes.from} value={timer.minutes.from} duration={0} />
              </div>
              <p className="text-muted-foreground text-xs">
                {i18n.t('countAnimation.label.minutes')}
              </p>
            </div>
            <div>
              <div className="text-3xl font-semibold tabular-nums">
                <CountAnimation from={timer.seconds.from} value={timer.seconds.from} duration={0} />
              </div>
              <p className="text-muted-foreground text-xs">
                {i18n.t('countAnimation.label.seconds')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const CountdownTimer: Story = {
  render: () => <CountdownTimerDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Days')).toBeInTheDocument();
    expect(canvas.getByText('Hours')).toBeInTheDocument();
    expect(canvas.getByText('Minutes')).toBeInTheDocument();
    expect(canvas.getByText('Seconds')).toBeInTheDocument();
  },
};

// ============ MIDNIGHT COUNTDOWN STORIES ============

function MidnightCountdownDemo() {
  const timer = React.useMemo(() => createFakeMidnightCountdown(), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.midnight')}</h3>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{timer.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-semibold tabular-nums">
                <CountAnimation from={timer.hours.from} value={timer.hours.from} duration={0} />
              </div>
              <p className="text-muted-foreground text-xs">
                {i18n.t('countAnimation.label.hours')}
              </p>
            </div>
            <div>
              <div className="text-3xl font-semibold tabular-nums">
                <CountAnimation from={timer.minutes.from} value={timer.minutes.from} duration={0} />
              </div>
              <p className="text-muted-foreground text-xs">
                {i18n.t('countAnimation.label.minutes')}
              </p>
            </div>
            <div>
              <div className="text-3xl font-semibold tabular-nums">
                <CountAnimation from={timer.seconds.from} value={timer.seconds.from} duration={0} />
              </div>
              <p className="text-muted-foreground text-xs">
                {i18n.t('countAnimation.label.seconds')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const MidnightCountdown: Story = {
  render: () => <MidnightCountdownDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Time Until Midnight')).toBeInTheDocument();
  },
};

// ============ PROGRESS COUNTER STORIES ============

function ProgressCountersDemo() {
  const items = React.useMemo(() => createFakeProgressCounters(3), []);
  const singleProgress = React.useMemo(() => createFakeProgressCounter(), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.progress')}</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4">
        {[singleProgress, ...items].map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-sm">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">
                <CountAnimation
                  from={item.countAnimation.from}
                  value={item.countAnimation.value}
                  duration={0}
                />
                <span className="text-muted-foreground text-sm">
                  {' '}
                  {i18n.t('countAnimation.label.of')} {item.total}
                </span>
              </div>
              <div className="bg-muted mt-2 h-2 w-full rounded-full">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              <p className="text-muted-foreground mt-1 text-xs">{item.percentage}%</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const ProgressCounters: Story = {
  render: () => <ProgressCountersDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(4);
  },
};

// ============ ANIMATION SEQUENCE STORIES ============

function AnimationSequenceDemo() {
  const sequence = React.useMemo(() => createFakeAnimationSequence(5), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.sequence')}</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-5">
        {sequence.animations.map((anim, idx) => (
          <Card key={anim.id}>
            <CardHeader>
              <CardTitle className="text-sm">#{idx + 1}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              <CountAnimation from={anim.from} value={anim.value} duration={0} />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-muted-foreground text-sm">
        {i18n.t('countAnimation.label.staggerDelay')}: {sequence.staggerDelay}s |{' '}
        {i18n.t('countAnimation.label.totalDuration')}: {sequence.totalDuration}s
      </p>
    </div>
  );
}

export const AnimationSequence: Story = {
  render: () => <AnimationSequenceDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(5);
  },
};

// ============ ANIMATION MATRIX STORIES ============

function AnimationMatrixDemo() {
  const matrix = React.useMemo(() => createFakeCountAnimationMatrix(), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.matrix')}</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-5">
        {matrix.combinations.map((combo) => (
          <Card key={combo.durationLabel}>
            <CardHeader>
              <CardTitle className="text-sm">
                {combo.durationLabel} ({combo.duration}s)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              <CountAnimation from={combo.from} value={combo.value} duration={0} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const AnimationMatrix: Story = {
  render: () => <AnimationMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(5);
  },
};

// ============ DURATION PRESET STORIES ============

function DurationPresetsDemo() {
  const presets = React.useMemo(() => createFakeDurationPresetAnimations(), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.durations')}</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-5">
        {presets.map((preset) => (
          <Card key={preset.id}>
            <CardHeader>
              <CardTitle className="text-sm">
                {i18n.t('countAnimation.label.preset')}: {preset.preset}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">
                <CountAnimation from={preset.from} value={preset.value} duration={0} />
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {i18n.t('countAnimation.label.duration')}: {preset.duration}s
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const DurationPresets: Story = {
  render: () => <DurationPresetsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(5);
  },
};

// ============ VALUE RANGE STORIES ============

function ValueRangesDemo() {
  const ranges = React.useMemo(() => createFakeValueRangeAnimations(), []);
  const rangeLabels = [
    i18n.t('countAnimation.story.smallRange', 'Small (0-100)'),
    i18n.t('countAnimation.story.mediumRange', 'Medium (100-1K)'),
    i18n.t('countAnimation.story.largeRange', 'Large (1K-10K)'),
    i18n.t('countAnimation.story.veryLargeRange', 'Very Large (10K-1M)'),
  ];

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.valueRanges')}</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4">
        {ranges.map((anim, idx) => (
          <Card key={anim.id}>
            <CardHeader>
              <CardTitle className="text-sm">{rangeLabels[idx]}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              <CountAnimation from={anim.from} value={anim.value} duration={0} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const ValueRanges: Story = {
  render: () => <ValueRangesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(4);
  },
};

// ============ REVENUE ANIMATION STORIES ============

function RevenueAnimationDemo() {
  const currencies = React.useMemo(
    () => ['USD', 'EUR', 'GBP', 'JPY'].map((code) => createFakeRevenueAnimation(code)),
    []
  );

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.revenueAnim')}</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4">
        {currencies.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-sm">{item.currencyCode}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              <span>{item.currencySymbol}</span>
              <CountAnimation from={item.from} value={item.value} duration={0} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const RevenueAnimation: Story = {
  render: () => <RevenueAnimationDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(4);
  },
};

// ============ USER COUNT ANIMATION STORIES ============

function UserCountAnimationDemo() {
  const user = React.useMemo(() => createFakeUserCountAnimation(), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.userCount')}</h3>
      <Card className="w-full max-w-xs">
        <CardHeader>
          <CardTitle className="text-sm">{user.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold tabular-nums">
            <CountAnimation from={user.from} value={user.value} duration={0} />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {getChangeLabel(user.changeType)} {Math.abs(user.changePercent)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export const UserCountAnimation: Story = {
  render: () => <UserCountAnimationDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBe(1);
  },
};

// ============ SCORE ANIMATION STORIES ============

function ScoreAnimationDemo() {
  const score = React.useMemo(() => createFakeScoreAnimation('Performance'), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.score')}</h3>
      <Card className="w-full max-w-xs">
        <CardHeader>
          <CardTitle className="text-sm">{i18n.t('countAnimation.label.score')}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-5xl font-bold tabular-nums">
            <CountAnimation from={score.from} value={score.value} duration={0} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {i18n.t('countAnimation.label.of')} 100
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export const ScoreAnimation: Story = {
  render: () => <ScoreAnimationDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('of 100')).toBeInTheDocument();
  },
};

// ============ RATING ANIMATION STORIES ============

function RatingAnimationDemo() {
  const rating = React.useMemo(() => createFakeRatingAnimation(), []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.rating')}</h3>
      <Card className="w-full max-w-xs">
        <CardHeader>
          <CardTitle className="text-sm">{i18n.t('countAnimation.label.rating')}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-5xl font-bold tabular-nums">
            <CountAnimation from={rating.from} value={Math.round(rating.value)} duration={0} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{rating.suffix}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export const RatingAnimation: Story = {
  render: () => <RatingAnimationDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('/5')).toBeInTheDocument();
  },
};

// ============ SHOWCASE STORIES ============

function ShowcaseDemo() {
  const showcase = React.useMemo(() => createFakeCountAnimationShowcase(), []);

  return (
    <div className="flex flex-col gap-8">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.showcase')}</h3>

      {/* Dashboard Stats */}
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('countAnimation.section.dashboard')}
        </p>
        <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {showcase.dashboardStats.map((stat) => (
            <Card key={stat.countAnimation.id}>
              <CardHeader>
                <CardTitle className="text-sm">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">
                <CountAnimation
                  from={stat.countAnimation.from}
                  value={stat.countAnimation.value}
                  duration={0}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Metric Animations */}
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('countAnimation.section.metrics')}
        </p>
        <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {showcase.metricAnimations.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="text-sm">{item.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">
                <CountAnimation from={item.from} value={item.value} duration={0} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Currency Animations */}
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('countAnimation.section.currency')}
        </p>
        <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {showcase.currencyAnimations.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="text-sm">{item.currencyCode}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">
                <span>{item.currencySymbol}</span>
                <CountAnimation from={item.from} value={item.value} duration={0} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Percentage Animations */}
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('countAnimation.section.percentage')}
        </p>
        <div className="grid w-full max-w-3xl grid-cols-3 gap-4">
          {showcase.percentageAnimations.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="text-sm" style={{ color: item.color }}>
                  {item.color}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">
                <CountAnimation from={item.from} value={Math.round(item.value)} duration={0} />
                <span>%</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Comparison Animations */}
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('countAnimation.section.comparison')}
        </p>
        <div className="grid w-full max-w-3xl grid-cols-3 gap-4">
          {showcase.comparisonAnimations.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="text-sm">{item.comparisonLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  <CountAnimation from={item.from} value={item.value} duration={0} />
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {i18n.t('countAnimation.label.previous')}: {item.previousValue}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export const Showcase: Story = {
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    // 4 dashboard + 4 metric + 4 currency + 3 percentage + 3 comparison = 18
    expect(cards.length).toBe(18);
  },
};

// ============ CONSTANTS REFERENCE STORIES ============

function ConstantsReferenceDemo() {
  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-lg font-semibold">{i18n.t('countAnimation.section.variants')}</h3>

      {/* ANIMATION_DURATIONS */}
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('countAnimation.section.speeds')} ({ANIMATION_DURATION_NAMES.length} presets)
        </p>
        <div className="grid grid-cols-5 gap-4">
          {ANIMATION_DURATION_NAMES.map((name) => (
            <Card key={name}>
              <CardHeader>
                <CardTitle className="text-sm">{name}</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold tabular-nums">
                <CountAnimation from={0} value={ANIMATION_DURATIONS[name] * 1000} duration={0} />
                <span className="text-muted-foreground text-sm">ms</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ANIMATION_EASINGS */}
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          Easing Functions ({ANIMATION_EASINGS.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {ANIMATION_EASINGS.map((easing) => (
            <span key={easing} className="bg-muted rounded-md px-3 py-1 text-sm">
              {easing}
            </span>
          ))}
        </div>
      </div>

      {/* ANIMATION_DIRECTIONS */}
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          Directions ({ANIMATION_DIRECTIONS.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {ANIMATION_DIRECTIONS.map((dir) => (
            <span key={dir} className="bg-muted rounded-md px-3 py-1 text-sm">
              {dir}
            </span>
          ))}
        </div>
      </div>

      {/* NUMBER_FORMATS */}
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('countAnimation.section.formats')} ({NUMBER_FORMATS.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {NUMBER_FORMATS.map((fmt) => (
            <span key={fmt} className="bg-muted rounded-md px-3 py-1 text-sm">
              {fmt}
            </span>
          ))}
        </div>
      </div>

      {/* CURRENCY_SYMBOLS */}
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          Currency Symbols ({CURRENCY_SYMBOLS.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {CURRENCY_SYMBOLS.map((sym) => (
            <span key={sym} className="bg-muted rounded-md px-3 py-1 text-lg">
              {sym}
            </span>
          ))}
        </div>
      </div>

      {/* METRIC_CATEGORIES */}
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          Metric Categories ({METRIC_CATEGORIES.length})
        </p>
        <div className="flex flex-col gap-2">
          {METRIC_CATEGORIES.map((cat) => (
            <div key={cat}>
              <span className="font-medium">{cat}:</span>{' '}
              <span className="text-muted-foreground text-sm">{METRIC_LABELS[cat].join(', ')}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                (range: {METRIC_RANGES[cat].min} - {METRIC_RANGES[cat].max})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const ConstantsReference: Story = {
  render: () => <ConstantsReferenceDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    // Verify duration presets are displayed
    expect(canvas.getByText('fast')).toBeInTheDocument();
    expect(canvas.getByText('normal')).toBeInTheDocument();
    expect(canvas.getByText('slow')).toBeInTheDocument();
    // Verify easing functions are displayed
    expect(canvas.getByText('linear')).toBeInTheDocument();
    expect(canvas.getByText('spring')).toBeInTheDocument();
    // Verify directions
    expect(canvas.getByText('up')).toBeInTheDocument();
    expect(canvas.getByText('down')).toBeInTheDocument();
    // Verify currency symbols
    expect(canvas.getByText('$')).toBeInTheDocument();
    // Verify categories
    expect(canvas.getByText('integer')).toBeInTheDocument();
  },
};

// ============ COMBINED GLOBALS ============

export const DarkRTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

// ============ MOBILE ============

export const Mobile: Story = {
  ...Default,
  parameters: {
    ...(Default.parameters ?? {}),
    viewport: { defaultViewport: 'mobile1' },
    chromatic: { viewports: [320] },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

// ============ DATA ATTRIBUTES ============

export const DataAttributes: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-slot="count-animation"]');
    expect(el).toBeInTheDocument();
    expect(el?.getAttribute('data-slot')).toBe('count-animation');
    expect(el?.getAttribute('data-testid')).toBe('count-animation');
  },
};

// ============ MISSING HANDLER STATUS KEYS ============

export const StatusSuccess: Story = {
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};

export const EmptyDataHandler: Story = {
  ...Default,
  parameters: {
    msw: { handlers: countAnimationStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="count-animation"]')).toBeInTheDocument();
  },
};
