import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardAnalyticsHandlers,
  dashboardAnalyticsStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-analytics.handlers';
import { useTranslation } from 'react-i18next';

import {
  AverageDailySalesCard,
  EarningReportsCard,
  MonthlyCampaignStateCard,
  SaleOverviewCard,
  SalesByCountriesCard,
  TicketsCard,
  TotalEarningCard,
  WebsiteAnalyticsCard,
} from '@/app/dashboard/(auth)/website-analytics/components';
import StatCards from '@/app/dashboard/(auth)/website-analytics/components/stat-cards';
import { CalendarDateRangePicker } from '@/components/custom-date-range-picker';
import { Button } from '@/components/ui/button';
import {
  createFakeAnalyticsDashboard,
  createFakeChartData,
} from '@/.storybook/stories/_factories/chart.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function WebsiteAnalyticsDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="space-y-4">
        <div className="flex flex-row items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t('websiteAnalytics.story.title', 'Website Analytics')}
          </h1>
          <div className="flex items-center space-x-2">
            <div className="grow">
              <CalendarDateRangePicker />
            </div>
            <Button>{t('websiteAnalytics.story.download', 'Download')}</Button>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-12">
            <StatCards />
          </div>
          <div className="lg:col-span-12 xl:col-span-8">
            <EarningReportsCard />
          </div>
          <div className="lg:col-span-12 xl:col-span-4">
            <TicketsCard />
          </div>
          <div className="lg:col-span-4">
            <WebsiteAnalyticsCard />
          </div>
          <div className="lg:col-span-4">
            <AverageDailySalesCard />
          </div>
          <div className="lg:col-span-4">
            <SaleOverviewCard />
          </div>
          <div className="lg:col-span-4">
            <SalesByCountriesCard />
          </div>
          <div className="lg:col-span-4">
            <TotalEarningCard />
          </div>
          <div className="lg:col-span-4">
            <MonthlyCampaignStateCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCardsDemo() {
  return (
    <div className="p-4">
      <StatCards />
    </div>
  );
}

function EarningReportsDemo() {
  return (
    <div className="p-4">
      <EarningReportsCard />
    </div>
  );
}

function AnalyticsCardsDemo() {
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-3">
      <WebsiteAnalyticsCard />
      <AverageDailySalesCard />
      <SaleOverviewCard />
    </div>
  );
}

function SalesCardsDemo() {
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-3">
      <SalesByCountriesCard />
      <TotalEarningCard />
      <MonthlyCampaignStateCard />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Website Analytics',
  component: WebsiteAnalyticsDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardAnalyticsHandlers },
    docs: {
      description: {
        component:
          'Website Analytics Dashboard - An efficient and flexible tool for tracking website traffic data, user interactions, and performance analytics with a modern, responsive interface.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof WebsiteAnalyticsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('websiteAnalytics.storyName.default', 'Full Dashboard'),
  render: () => <WebsiteAnalyticsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const StatCardsStory: Story = {
  name: i18n.t('websiteAnalytics.storyName.statCardsStory', 'Stat Cards'),
  render: () => <StatCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const EarningReports: Story = {
  name: i18n.t('websiteAnalytics.storyName.earningReports', 'Earning Reports'),
  render: () => <EarningReportsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const AnalyticsCards: Story = {
  name: i18n.t('websiteAnalytics.storyName.analyticsCards', 'Analytics Cards'),
  render: () => <AnalyticsCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const SalesCards: Story = {
  name: i18n.t('websiteAnalytics.storyName.salesCards', 'Sales Cards'),
  render: () => <SalesCardsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('websiteAnalytics.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <WebsiteAnalyticsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('websiteAnalytics.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <WebsiteAnalyticsDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('websiteAnalytics.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <WebsiteAnalyticsDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('websiteAnalytics.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardAnalyticsStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('websiteAnalytics.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardAnalyticsStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('websiteAnalytics.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardAnalyticsStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'websiteAnalytics.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: dashboardAnalyticsStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'websiteAnalytics.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: dashboardAnalyticsStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('websiteAnalytics.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardAnalyticsStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('websiteAnalytics.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardAnalyticsStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('websiteAnalytics.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardAnalyticsStatusHandlers.emptyData } },
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
  const analyticsDashboard = createFakeAnalyticsDashboard();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ chartData, analyticsDashboard }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('websiteAnalytics.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('websiteAnalytics.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dashboardAnalyticsStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
