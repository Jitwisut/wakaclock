import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardDefaultHandlers,
  dashboardDefaultStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-default.handlers';
import { useTranslation } from 'react-i18next';

import {
  ChatWidget,
  ExerciseMinutes,
  LatestPayments,
  PaymentMethodCard,
  SubscriptionsCard,
  TeamMembersCard,
  TotalRevenueCard,
} from '@/app/dashboard/(auth)/default/components';
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

function DefaultDashboardDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('defaultDashboard.story.title', 'Dashboard')}
        </h1>
      </div>
      <div className="gap-4 space-y-4 lg:grid lg:grid-cols-3 lg:space-y-0">
        <TeamMembersCard />
        <SubscriptionsCard />
        <TotalRevenueCard />
        <ChatWidget />
        <div className="lg:col-span-2">
          <ExerciseMinutes />
        </div>
        <div className="lg:col-span-2">
          <LatestPayments />
        </div>
        <PaymentMethodCard />
      </div>
    </div>
  );
}

function TeamMembersCardDemo() {
  return (
    <div className="max-w-md p-4">
      <TeamMembersCard />
    </div>
  );
}

function SubscriptionsCardDemo() {
  return (
    <div className="max-w-sm p-4">
      <SubscriptionsCard />
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

function ChatWidgetDemo() {
  return (
    <div className="max-w-md p-4">
      <ChatWidget />
    </div>
  );
}

function ExerciseMinutesDemo() {
  return (
    <div className="max-w-2xl p-4">
      <ExerciseMinutes />
    </div>
  );
}

function LatestPaymentsDemo() {
  return (
    <div className="max-w-4xl p-4">
      <LatestPayments />
    </div>
  );
}

function PaymentMethodCardDemo() {
  return (
    <div className="max-w-md p-4">
      <PaymentMethodCard />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Default',
  component: DefaultDashboardDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardDefaultHandlers },
    docs: {
      description: {
        component:
          'Default Dashboard - Admin dashboard template with team management, subscription metrics, revenue tracking, chat widget, and payment processing.',
      },
    },
  },
  argTypes: {
    // No direct props - this is a page-level component
  },
} satisfies Meta<typeof DefaultDashboardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

/**
 * The complete Default Dashboard page with all components.
 */
export const Default: Story = {
  name: i18n.t('default.storyName.default', 'Full Dashboard'),
  render: () => <DefaultDashboardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify dashboard title renders
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();

    // Verify dashboard cards are present
    expect(canvasElement.querySelector('[class*="card"]')).toBeInTheDocument();
  },
};

/**
 * Team Members Card - Manage team members with role assignment.
 */
export const TeamMembersCardStory: Story = {
  name: i18n.t('default.storyName.teamMembersCardStory', 'Team Members Card'),
  render: () => <TeamMembersCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Subscriptions Card - Display subscription metrics with bar chart.
 */
export const SubscriptionsCardStory: Story = {
  name: i18n.t('default.storyName.subscriptionsCardStory', 'Subscriptions Card'),
  render: () => <SubscriptionsCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Total Revenue Card - Revenue metrics with line chart.
 */
export const TotalRevenueCardStory: Story = {
  name: i18n.t('default.storyName.totalRevenueCardStory', 'Total Revenue Card'),
  render: () => <TotalRevenueCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Chat Widget - Interactive chat interface with message dialog.
 */
export const ChatWidgetStory: Story = {
  name: i18n.t('default.storyName.chatWidgetStory', 'Chat Widget'),
  render: () => <ChatWidgetDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Exercise Minutes - Activity tracking with comparison chart.
 */
export const ExerciseMinutesStory: Story = {
  name: i18n.t('default.storyName.exerciseMinutesStory', 'Exercise Minutes'),
  render: () => <ExerciseMinutesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Latest Payments - Data table with filtering, selection, and bulk actions.
 */
export const LatestPaymentsStory: Story = {
  name: i18n.t('default.storyName.latestPaymentsStory', 'Latest Payments'),
  render: () => <LatestPaymentsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Payment Method Card - Payment method selection with form inputs.
 */
export const PaymentMethodCardStory: Story = {
  name: i18n.t('default.storyName.paymentMethodCardStory', 'Payment Method Card'),
  render: () => <PaymentMethodCardDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Dark mode variant of the dashboard.
 */
export const Dark: Story = {
  name: i18n.t('default.storyName.dark', 'Dark Mode'),
  parameters: {
    themes: {
      themeOverride: 'dark',
    },
  },
  render: () => <DefaultDashboardDemo />,
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
  name: i18n.t('default.storyName.japanese', 'Japanese'),
  parameters: {
    locale: 'ja',
  },
  render: () => <DefaultDashboardDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * RTL layout variant.
 */
export const RTL: Story = {
  name: i18n.t('default.storyName.rTL', 'RTL'),
  parameters: {
    direction: 'rtl',
  },
  render: () => (
    <div dir="rtl">
      <DefaultDashboardDemo />
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
  name: i18n.t('default.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardDefaultStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('default.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardDefaultStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('default.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardDefaultStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('default.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: dashboardDefaultStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('default.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: dashboardDefaultStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('default.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardDefaultStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('default.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardDefaultStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('default.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardDefaultStatusHandlers.emptyData } },
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
  name: i18n.t('default.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('default.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dashboardDefaultStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
