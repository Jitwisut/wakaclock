import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardFinanceHandlers,
  dashboardFinanceStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-finance.handlers';
import { useTranslation } from 'react-i18next';

import KPICards from '@/app/dashboard/(auth)/finance/components/kpi-cards';
import MonthlyExpenses from '@/app/dashboard/(auth)/finance/components/monthly-expenses';
import CreditCards from '@/app/dashboard/(auth)/finance/components/my-wallet';
import Revenue from '@/app/dashboard/(auth)/finance/components/revenue';
import SavingGoal from '@/app/dashboard/(auth)/finance/components/saving-goal';
import Summary from '@/app/dashboard/(auth)/finance/components/summary';
import Transactions from '@/app/dashboard/(auth)/finance/components/transactions';
import {
  createFakeChartData,
  createFakeFinancialData,
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

function FinanceDashboardDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('financeDashboard.story.title', 'Finance Dashboard')}
        </h1>
      </div>
      <KPICards />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Revenue />
        <MonthlyExpenses />
        <Summary />
      </div>
      <div className="grid-cols-2 gap-4 space-y-4 lg:grid lg:space-y-0">
        <Transactions />
        <div className="space-y-4">
          <SavingGoal />
          <CreditCards />
        </div>
      </div>
    </div>
  );
}

function KPICardsDemo() {
  return (
    <div className="max-w-6xl p-4">
      <KPICards />
    </div>
  );
}

function RevenueDemo() {
  return (
    <div className="max-w-md p-4">
      <Revenue />
    </div>
  );
}

function MonthlyExpensesDemo() {
  return (
    <div className="max-w-md p-4">
      <MonthlyExpenses />
    </div>
  );
}

function SummaryDemo() {
  return (
    <div className="max-w-md p-4">
      <Summary />
    </div>
  );
}

function TransactionsDemo() {
  return (
    <div className="max-w-2xl p-4">
      <Transactions />
    </div>
  );
}

function SavingGoalDemo() {
  return (
    <div className="max-w-md p-4">
      <SavingGoal />
    </div>
  );
}

function CreditCardsDemo() {
  return (
    <div className="max-w-md p-4">
      <CreditCards />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Finance',
  component: FinanceDashboardDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardFinanceHandlers },
    docs: {
      description: {
        component:
          'Finance Dashboard - Financial management dashboard with KPIs, revenue tracking, expense analysis, transactions, and savings goals.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof FinanceDashboardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('finance.storyName.default', 'Full Dashboard'),
  render: () => <FinanceDashboardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify page renders
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const KPICardsStory: Story = {
  name: i18n.t('finance.storyName.kPICardsStory', 'KPI Cards'),
  render: () => <KPICardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const RevenueStory: Story = {
  name: i18n.t('finance.storyName.revenueStory', 'Revenue'),
  render: () => <RevenueDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const MonthlyExpensesStory: Story = {
  name: i18n.t('finance.storyName.monthlyExpensesStory', 'Monthly Expenses'),
  render: () => <MonthlyExpensesDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const SummaryStory: Story = {
  name: i18n.t('finance.storyName.summaryStory', 'Summary'),
  render: () => <SummaryDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const TransactionsStory: Story = {
  name: i18n.t('finance.storyName.transactionsStory', 'Transactions'),
  render: () => <TransactionsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SavingGoalStory: Story = {
  name: i18n.t('finance.storyName.savingGoalStory', 'Saving Goal'),
  render: () => <SavingGoalDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const CreditCardsStory: Story = {
  name: i18n.t('finance.storyName.creditCardsStory', 'Credit Cards / My Wallet'),
  render: () => <CreditCardsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('finance.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <FinanceDashboardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('finance.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <FinanceDashboardDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('finance.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <FinanceDashboardDemo />
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
  name: i18n.t('finance.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardFinanceStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('finance.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardFinanceStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('finance.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardFinanceStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('finance.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: dashboardFinanceStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('finance.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: dashboardFinanceStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('finance.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardFinanceStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('finance.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardFinanceStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('finance.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardFinanceStatusHandlers.emptyData } },
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
  const financialData = createFakeFinancialData();
  const tableRow = createFakeTableRow();
  const tableData = createFakeTableData(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ chartData, financialData, tableRow, tableData }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('finance.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('finance.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dashboardFinanceStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
