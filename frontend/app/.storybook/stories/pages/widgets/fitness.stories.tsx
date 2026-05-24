import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import {
  dashboardWidgetsHandlers,
  dashboardWidgetsStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-widgets.handlers';
import { useTranslation } from 'react-i18next';

import { ActiveCard } from '@/app/dashboard/(auth)/widgets/fitness/components/active-card';
import { BodyWeightCard } from '@/app/dashboard/(auth)/widgets/fitness/components/body-weight-card';
import { DailyActivityCard } from '@/app/dashboard/(auth)/widgets/fitness/components/daily-activity-card';
import { DistanceCard } from '@/app/dashboard/(auth)/widgets/fitness/components/distance-card';
import { FriendsCard } from '@/app/dashboard/(auth)/widgets/fitness/components/friends-card';
import { HeartRateCard } from '@/app/dashboard/(auth)/widgets/fitness/components/heart-rate-card';
import { HeroCard } from '@/app/dashboard/(auth)/widgets/fitness/components/hero-card';
import { NutritionCard } from '@/app/dashboard/(auth)/widgets/fitness/components/nutrition-card';
import { SleepCard } from '@/app/dashboard/(auth)/widgets/fitness/components/sleep-card';
import { TrackingCard } from '@/app/dashboard/(auth)/widgets/fitness/components/tracking-card';
import { WorkoutsCard } from '@/app/dashboard/(auth)/widgets/fitness/components/workouts-card';
import {
  createFakeChartData,
  createFakeTimeSeriesData,
} from '@/.storybook/stories/_factories/chart.factory';
import {
  createFakeMultiStepProgress,
  createFakeProgress,
} from '@/.storybook/stories/_factories/progress.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function WidgetsFitnessDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('fitnessWidgets.story.heading', 'Fitness Widgets')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t(
            'pages.widgetsFitness.description',
            'UI components that display fitness data such as workouts, progress, and health metrics within a dashboard.'
          )}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-4">
          <HeroCard />
          <HeartRateCard />
          <div className="grid gap-4 2xl:grid-cols-2">
            <SleepCard />
            <ActiveCard />
          </div>
          <TrackingCard />
        </div>

        <div className="space-y-4">
          <DailyActivityCard />
          <WorkoutsCard />
        </div>

        <div className="space-y-4">
          <BodyWeightCard />
          <DistanceCard />
          <NutritionCard />
          <FriendsCard />
        </div>
      </div>
    </div>
  );
}

function HeroSectionDemo() {
  return (
    <div className="max-w-md space-y-4 p-4">
      <HeroCard />
      <HeartRateCard />
    </div>
  );
}

function HealthMetricsDemo() {
  return (
    <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
      <SleepCard />
      <ActiveCard />
      <DistanceCard />
      <NutritionCard />
    </div>
  );
}

function ActivityCardsDemo() {
  return (
    <div className="grid max-w-2xl gap-4 p-4 md:grid-cols-2">
      <DailyActivityCard />
      <WorkoutsCard />
    </div>
  );
}

function ProgressCardsDemo() {
  return (
    <div className="grid max-w-2xl gap-4 p-4 md:grid-cols-2">
      <BodyWeightCard />
      <TrackingCard />
    </div>
  );
}

function SocialCardsDemo() {
  return (
    <div className="max-w-md p-4">
      <FriendsCard />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Widgets/Fitness',
  component: WidgetsFitnessDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...buttonHandlers, ...dashboardWidgetsHandlers] },
    docs: {
      description: {
        component:
          'Fitness Widgets - A collection of 11 fitness dashboard cards including HeroCard, HeartRateCard, SleepCard, ActiveCard, DailyActivityCard, WorkoutsCard, BodyWeightCard, DistanceCard, NutritionCard, TrackingCard, and FriendsCard.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof WidgetsFitnessDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('fitness.storyName.default', 'Full Dashboard'),
  render: () => <WidgetsFitnessDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const HeroSection: Story = {
  name: i18n.t('fitness.storyName.heroSection', 'Hero Section'),
  render: () => <HeroSectionDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const HealthMetrics: Story = {
  name: i18n.t('fitness.storyName.healthMetrics', 'Health Metrics'),
  render: () => <HealthMetricsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const ActivityCards: Story = {
  name: i18n.t('fitness.storyName.activityCards', 'Activity Cards'),
  render: () => <ActivityCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const ProgressCards: Story = {
  name: i18n.t('fitness.storyName.progressCards', 'Progress Cards'),
  render: () => <ProgressCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const SocialCards: Story = {
  name: i18n.t('fitness.storyName.socialCards', 'Social Cards'),
  render: () => <SocialCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('fitness.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <WidgetsFitnessDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('fitness.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <WidgetsFitnessDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('fitness.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <WidgetsFitnessDemo />
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('fitness.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('fitness.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('fitness.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('fitness.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('fitness.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('fitness.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('fitness.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('fitness.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY DATA STORY
// ============================================================================

function FactoryDataDemo() {
  const { t } = useTranslation();
  const chartData = createFakeChartData();
  const timeSeries = createFakeTimeSeriesData(7);
  const progress = createFakeProgress();
  const multiStep = createFakeMultiStepProgress();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ chartData, timeSeries, progress, multiStep }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('fitness.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
