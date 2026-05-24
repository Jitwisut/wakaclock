import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardCrmHandlers,
  dashboardCrmStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-crm.handlers';
import { useTranslation } from 'react-i18next';

import {
  LeadBySourceCard,
  LeadsCard,
  RecentTasks,
  SalesPipeline,
  TargetCard,
  TotalCustomersCard,
  TotalDeals,
  TotalRevenueCard,
} from '@/app/dashboard/(auth)/crm/components';
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

function CRMDashboardDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('crmDashboard.story.title', 'CRM Dashboard')}
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TargetCard />
        <TotalCustomersCard />
        <TotalDeals />
        <TotalRevenueCard />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <LeadBySourceCard />
        <RecentTasks />
        <SalesPipeline />
      </div>
      <LeadsCard />
    </div>
  );
}

function TargetCardDemo() {
  return (
    <div className="max-w-sm p-4">
      <TargetCard />
    </div>
  );
}

function TotalCustomersCardDemo() {
  return (
    <div className="max-w-sm p-4">
      <TotalCustomersCard />
    </div>
  );
}

function TotalDealsDemo() {
  return (
    <div className="max-w-sm p-4">
      <TotalDeals />
    </div>
  );
}

function TotalRevenueCardDemo() {
  return (
    <div className="max-w-sm p-4">
      <TotalRevenueCard />
    </div>
  );
}

function LeadBySourceCardDemo() {
  return (
    <div className="max-w-md p-4">
      <LeadBySourceCard />
    </div>
  );
}

function RecentTasksDemo() {
  return (
    <div className="max-w-md p-4">
      <RecentTasks />
    </div>
  );
}

function SalesPipelineDemo() {
  return (
    <div className="max-w-md p-4">
      <SalesPipeline />
    </div>
  );
}

function LeadsCardDemo() {
  return (
    <div className="max-w-4xl p-4">
      <LeadsCard />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/CRM',
  component: CRMDashboardDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardCrmHandlers },
    docs: {
      description: {
        component:
          'CRM Dashboard - Customer Relationship Management dashboard template. Displays sales targets, customer metrics, leads pipeline, and task management.',
      },
    },
  },
  argTypes: {
    // No direct props - this is a page-level component
  },
} satisfies Meta<typeof CRMDashboardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

/**
 * The complete CRM Dashboard page with all components.
 */
export const Default: Story = {
  name: i18n.t('crm.storyName.default', 'Full Dashboard'),
  render: () => <CRMDashboardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify page renders
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

/**
 * Target Card - Shows sales target progress with radial chart.
 */
export const TargetCardStory: Story = {
  name: i18n.t('crm.storyName.targetCardStory', 'Target Card'),
  render: () => <TargetCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Total Customers Card - Displays customer count with change indicator.
 */
export const TotalCustomersCardStory: Story = {
  name: i18n.t('crm.storyName.totalCustomersCardStory', 'Total Customers Card'),
  render: () => <TotalCustomersCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Total Deals Card - Shows deal count with change indicator.
 */
export const TotalDealsStory: Story = {
  name: i18n.t('crm.storyName.totalDealsStory', 'Total Deals'),
  render: () => <TotalDealsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Total Revenue Card - Displays revenue with change indicator.
 */
export const TotalRevenueCardStory: Story = {
  name: i18n.t('crm.storyName.totalRevenueCardStory', 'Total Revenue Card'),
  render: () => <TotalRevenueCardDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Leads by Source Card - Pie chart showing lead distribution.
 */
export const LeadBySourceCardStory: Story = {
  name: i18n.t('crm.storyName.leadBySourceCardStory', 'Lead By Source Card'),
  render: () => <LeadBySourceCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Recent Tasks - Task list with priorities and completion status.
 */
export const RecentTasksStory: Story = {
  name: i18n.t('crm.storyName.recentTasksStory', 'Recent Tasks'),
  render: () => <RecentTasksDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Sales Pipeline - Visual pipeline stages with progress indicators.
 */
export const SalesPipelineStory: Story = {
  name: i18n.t('crm.storyName.salesPipelineStory', 'Sales Pipeline'),
  render: () => <SalesPipelineDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Leads Card - Data table with sorting, filtering, and pagination.
 */
export const LeadsCardStory: Story = {
  name: i18n.t('crm.storyName.leadsCardStory', 'Leads Card'),
  render: () => <LeadsCardDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Dark mode variant of the dashboard.
 */
export const Dark: Story = {
  name: i18n.t('crm.storyName.dark', 'Dark Mode'),
  parameters: {
    themes: {
      themeOverride: 'dark',
    },
  },
  render: () => <CRMDashboardDemo />,
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
  name: i18n.t('crm.storyName.japanese', 'Japanese'),
  parameters: {
    locale: 'ja',
  },
  render: () => <CRMDashboardDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * RTL layout variant.
 */
export const RTL: Story = {
  name: i18n.t('crm.storyName.rTL', 'RTL'),
  parameters: {
    direction: 'rtl',
  },
  render: () => (
    <div dir="rtl">
      <CRMDashboardDemo />
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
  name: i18n.t('crm.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardCrmStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('crm.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardCrmStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('crm.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardCrmStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('crm.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: dashboardCrmStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('crm.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: dashboardCrmStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('crm.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardCrmStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('crm.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardCrmStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('crm.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardCrmStatusHandlers.emptyData } },
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
  name: i18n.t('crm.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('crm.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dashboardCrmStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
