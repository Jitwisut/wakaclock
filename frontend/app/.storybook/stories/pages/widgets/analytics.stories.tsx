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
import { AlertCircleIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createFakeChartData,
  createFakeChartStatsCards,
} from '@/.storybook/stories/_factories/chart.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function WidgetsAnalyticsDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex h-[90vh] items-center justify-center p-4">
      <div className="max-w-(--breakpoint-sm) space-y-4 lg:space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="mb-4 flex items-center gap-3">
              <svg
                className="size-6 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  fill="currentColor"
                />
              </svg>
              <h1 className="text-xl">
                {t('analytics.story.analyticsWidgets', 'Analytics Widgets')}
              </h1>
            </CardTitle>
            <CardDescription>
              {t(
                'pages.widgetsAnalytics.description',
                'Interactive components that display key metrics, charts, and insights within a dashboard interface.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="border-t pt-4">
            <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
              <AlertCircleIcon className="size-4 text-orange-400" />
              {t(
                'pages.widgetsAnalytics.underConstruction',
                'This page is currently under construction.'
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Widgets/Analytics',
  component: WidgetsAnalyticsDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...buttonHandlers, ...dashboardWidgetsHandlers] },
    docs: {
      description: {
        component:
          'Analytics Widgets - Coming soon placeholder page. This collection will feature interactive components that display key metrics, charts, and insights within a dashboard interface.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof WidgetsAnalyticsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('analytics.storyName.default', 'Coming Soon'),
  render: () => <WidgetsAnalyticsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('analytics.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <WidgetsAnalyticsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('analytics.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <WidgetsAnalyticsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('analytics.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <WidgetsAnalyticsDemo />
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

export const Mobile: Story = {
  name: i18n.t('analytics.storyName.mobile', 'Mobile'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <WidgetsAnalyticsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('analytics.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('analytics.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('analytics.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('analytics.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('analytics.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('analytics.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('analytics.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardWidgetsStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('analytics.storyName.emptyData', 'Handler: Empty Data'),
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
  const statsCards = createFakeChartStatsCards(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ chartData, statsCards }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('analytics.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
