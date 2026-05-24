import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardCryptoHandlers,
  dashboardCryptoStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-crypto.handlers';
import { useTranslation } from 'react-i18next';

import {
  BalanceSummeryChart,
  DigitalWallets,
  OverviewCard,
  RecentActivities,
  TradingCard,
} from '@/app/dashboard/(auth)/crypto/components';
import {
  createFakeChartData,
  createFakeTimeSeriesData,
} from '@/.storybook/stories/_factories/chart.factory';
import {
  createFakeTableData,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function CryptoDashboardDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('cryptoDashboard.story.title', 'Crypto Dashboard')}
        </h1>
      </div>
      <div className="gap-4 space-y-4 lg:grid lg:grid-cols-6 lg:space-y-0">
        <div className="lg:col-span-12 xl:col-span-2">
          <OverviewCard />
        </div>
        <div className="lg:col-span-6 xl:col-span-2">
          <DigitalWallets />
        </div>
        <div className="lg:col-span-6 xl:col-span-2">
          <TradingCard />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <RecentActivities />
        </div>
        <div className="xl:col-span-2">
          <BalanceSummeryChart />
        </div>
      </div>
    </div>
  );
}

function OverviewCardDemo() {
  return (
    <div className="max-w-md p-4">
      <OverviewCard />
    </div>
  );
}

function DigitalWalletsDemo() {
  return (
    <div className="max-w-sm p-4">
      <DigitalWallets />
    </div>
  );
}

function TradingCardDemo() {
  return (
    <div className="max-w-md p-4">
      <TradingCard />
    </div>
  );
}

function RecentActivitiesDemo() {
  return (
    <div className="max-w-md p-4">
      <RecentActivities />
    </div>
  );
}

function BalanceSummeryChartDemo() {
  return (
    <div className="max-w-4xl p-4">
      <BalanceSummeryChart />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Crypto',
  component: CryptoDashboardDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardCryptoHandlers },
    docs: {
      description: {
        component:
          'Crypto Dashboard - Cryptocurrency portfolio management dashboard. Displays balance overview, digital wallets, trading interface, recent activities, and balance summary charts.',
      },
    },
  },
  argTypes: {
    // No direct props - this is a page-level component
  },
} satisfies Meta<typeof CryptoDashboardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

/**
 * The complete Crypto Dashboard page with all components.
 */
export const Default: Story = {
  name: i18n.t('crypto.storyName.default', 'Full Dashboard'),
  render: () => <CryptoDashboardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

/**
 * Overview Card - Balance and transaction summary with gradient background.
 */
export const OverviewCardStory: Story = {
  name: i18n.t('crypto.storyName.overviewCardStory', 'Overview Card'),
  render: () => <OverviewCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Digital Wallets - List of cryptocurrency wallets with balances.
 */
export const DigitalWalletsStory: Story = {
  name: i18n.t('crypto.storyName.digitalWalletsStory', 'Digital Wallets'),
  render: () => <DigitalWalletsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Trading Card - Buy/Sell crypto interface with coin selection.
 */
export const TradingCardStory: Story = {
  name: i18n.t('crypto.storyName.tradingCardStory', 'Trading Card'),
  render: () => <TradingCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Recent Activities - Transaction history with activity types.
 */
export const RecentActivitiesStory: Story = {
  name: i18n.t('crypto.storyName.recentActivitiesStory', 'Recent Activities'),
  render: () => <RecentActivitiesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Balance Summary Chart - Line chart showing received, sent, and withdrawn amounts.
 */
export const BalanceSummeryChartStory: Story = {
  name: i18n.t('crypto.storyName.balanceSummeryChartStory', 'Balance Summary Chart'),
  render: () => <BalanceSummeryChartDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Dark mode variant of the dashboard.
 */
export const Dark: Story = {
  name: i18n.t('crypto.storyName.dark', 'Dark Mode'),
  parameters: {
    themes: {
      themeOverride: 'dark',
    },
  },
  render: () => <CryptoDashboardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Japanese locale variant.
 */
export const Japanese: Story = {
  name: i18n.t('crypto.storyName.japanese', 'Japanese'),
  parameters: {
    locale: 'ja',
  },
  render: () => <CryptoDashboardDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * RTL layout variant.
 */
export const RTL: Story = {
  name: i18n.t('crypto.storyName.rTL', 'RTL'),
  parameters: {
    direction: 'rtl',
  },
  render: () => (
    <div dir="rtl">
      <CryptoDashboardDemo />
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
  name: i18n.t('crypto.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardCryptoStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('crypto.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardCryptoStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('crypto.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardCryptoStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('crypto.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: dashboardCryptoStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('crypto.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: dashboardCryptoStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('crypto.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardCryptoStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('crypto.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardCryptoStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('crypto.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardCryptoStatusHandlers.emptyData } },
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
  const tableRow = createFakeTableRow();
  const tableData = createFakeTableData(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ chartData, timeSeries, tableRow, tableData }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('crypto.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('crypto.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dashboardCryptoStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
