import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardPaymentHandlers,
  dashboardPaymentStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-payment.handlers';
import { useTranslation } from 'react-i18next';

import { BalanceOverview } from '@/app/dashboard/(auth)/payment/components/balance-overview';
import { ExchangeRates } from '@/app/dashboard/(auth)/payment/components/exchange-rates';
import { NotificationBanner } from '@/app/dashboard/(auth)/payment/components/notification-banner';
import { TransactionHistory } from '@/app/dashboard/(auth)/payment/components/transaction-history';
import {
  createFakeChartData,
  createFakeChartStatsCards,
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

function PaymentDashboardDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('paymentDashboard.story.title', 'Payment Dashboard')}
        </h1>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <BalanceOverview />
          <TransactionHistory />
        </div>
        <div className="space-y-4">
          <ExchangeRates />
        </div>
      </div>
    </div>
  );
}

function BalanceOverviewDemo() {
  return (
    <div className="max-w-4xl p-4">
      <BalanceOverview />
    </div>
  );
}

function ExchangeRatesDemo() {
  return (
    <div className="max-w-md p-4">
      <ExchangeRates />
    </div>
  );
}

function TransactionHistoryDemo() {
  return (
    <div className="max-w-4xl p-4">
      <TransactionHistory />
    </div>
  );
}

function NotificationBannerDemo() {
  return (
    <div className="max-w-4xl p-4">
      <NotificationBanner />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Payment',
  component: PaymentDashboardDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardPaymentHandlers },
    docs: {
      description: {
        component:
          'Payment Dashboard - Payment management system with multi-currency balances, exchange rate charts, transaction history, and notification banners.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof PaymentDashboardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('payment.storyName.default', 'Full Dashboard'),
  render: () => <PaymentDashboardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const BalanceOverviewStory: Story = {
  name: i18n.t('payment.storyName.balanceOverviewStory', 'Balance Overview'),
  render: () => <BalanceOverviewDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const ExchangeRatesStory: Story = {
  name: i18n.t('payment.storyName.exchangeRatesStory', 'Exchange Rates'),
  render: () => <ExchangeRatesDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const TransactionHistoryStory: Story = {
  name: i18n.t('payment.storyName.transactionHistoryStory', 'Transaction History'),
  render: () => <TransactionHistoryDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const NotificationBannerStory: Story = {
  name: i18n.t('payment.storyName.notificationBannerStory', 'Notification Banner'),
  render: () => <NotificationBannerDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('payment.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <PaymentDashboardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('payment.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <PaymentDashboardDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('payment.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <PaymentDashboardDemo />
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
  name: i18n.t('payment.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardPaymentStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('payment.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardPaymentStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('payment.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardPaymentStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('payment.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: dashboardPaymentStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('payment.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: dashboardPaymentStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('payment.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardPaymentStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('payment.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardPaymentStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('payment.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardPaymentStatusHandlers.emptyData } },
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
  const tableRow = createFakeTableRow();
  const tableData = createFakeTableData(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ chartData, statsCards, tableRow, tableData }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('payment.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('payment.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dashboardPaymentStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
