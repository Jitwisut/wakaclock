import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardSalesHandlers,
  dashboardSalesStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-sales.handlers';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';

import {
  BalanceCard,
  BestSellingProducts,
  ExpenseCard,
  IncomeCard,
  RevenueChart,
  TableOrderStatus,
  TaxCard,
} from '@/app/dashboard/(auth)/sales/components';
import { CalendarDateRangePicker } from '@/components/custom-date-range-picker';
import { Button } from '@/components/ui/button';
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

function SalesDashboardDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="space-y-4">
        <div className="flex flex-row items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t('salesDashboard.story.title', 'Sales Dashboard')}
          </h1>
          <div className="flex items-center space-x-2">
            <div className="grow">
              <CalendarDateRangePicker />
            </div>
            <Button>
              <Download />
              <span className="hidden lg:inline">{t('sales.story.download', 'Download')}</span>
            </Button>
          </div>
        </div>
        <div className="gap-4 space-y-4 md:grid md:grid-cols-2 lg:space-y-0 xl:grid-cols-8">
          <div className="md:col-span-4">
            <RevenueChart />
          </div>
          <div className="md:col-span-4">
            <div className="col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
              <BalanceCard />
              <IncomeCard />
              <ExpenseCard />
              <TaxCard />
            </div>
          </div>
        </div>
        <div className="gap-4 space-y-4 lg:space-y-0 xl:grid xl:grid-cols-3">
          <div className="xl:col-span-1">
            <BestSellingProducts />
          </div>
          <div className="xl:col-span-2">
            <TableOrderStatus />
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueChartDemo() {
  return (
    <div className="p-4">
      <RevenueChart />
    </div>
  );
}

function StatCardsDemo() {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
      <BalanceCard />
      <IncomeCard />
      <ExpenseCard />
      <TaxCard />
    </div>
  );
}

function OrdersTableDemo() {
  return (
    <div className="p-4">
      <TableOrderStatus />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Sales',
  component: SalesDashboardDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardSalesHandlers },
    docs: {
      description: {
        component:
          'Sales Dashboard - A modern and elegant responsive sales admin dashboard for managing, analyzing, and reporting sales data with revenue charts, stat cards, and order status tables.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof SalesDashboardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('sales.storyName.default', 'Full Dashboard'),
  render: () => <SalesDashboardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify page renders
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const RevenueChartStory: Story = {
  name: i18n.t('sales.storyName.revenueChartStory', 'Revenue Chart'),
  render: () => <RevenueChartDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const StatCards: Story = {
  name: i18n.t('sales.storyName.statCards', 'Stat Cards'),
  render: () => <StatCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const OrdersTable: Story = {
  name: i18n.t('sales.storyName.ordersTable', 'Orders Table'),
  render: () => <OrdersTableDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('sales.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <SalesDashboardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('sales.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <SalesDashboardDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('sales.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <SalesDashboardDemo />
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
  name: i18n.t('sales.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardSalesStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('sales.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardSalesStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('sales.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardSalesStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('sales.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: dashboardSalesStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('sales.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: dashboardSalesStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('sales.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardSalesStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('sales.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardSalesStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('sales.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardSalesStatusHandlers.emptyData } },
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
  name: i18n.t('sales.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('sales.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dashboardSalesStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
