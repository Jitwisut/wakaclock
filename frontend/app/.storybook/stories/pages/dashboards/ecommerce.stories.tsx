import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardEcommerceHandlers,
  dashboardEcommerceStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-ecommerce.handlers';
import { useTranslation } from 'react-i18next';

import {
  EcommerceBestSellingProductsCard,
  EcommerceCustomerReviewsCard,
  EcommerceRecentOrdersCard,
  EcommerceReturnRateCard,
  EcommerceSalesByLocationCard,
  EcommerceTotalRevenueCard,
  EcommerceVisitBySourceCard,
  EcommerceWelcomeCard,
} from '@/app/dashboard/(auth)/ecommerce/components';
import StatCards from '@/app/dashboard/(auth)/ecommerce/components/stat-cards';
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

function EcommerceDashboardDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('ecommerceDashboard.story.title', 'E-Commerce Dashboard')}
        </h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <EcommerceWelcomeCard />
        <div className="md:col-span-12 lg:col-span-8">
          <StatCards />
        </div>
      </div>
      <div className="space-y-4 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0">
        <EcommerceTotalRevenueCard />
        <EcommerceReturnRateCard />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <EcommerceSalesByLocationCard />
        <EcommerceVisitBySourceCard />
        <EcommerceCustomerReviewsCard />
      </div>
      <div className="space-y-4 xl:grid xl:grid-cols-12 xl:gap-4 xl:space-y-0">
        <EcommerceRecentOrdersCard />
        <EcommerceBestSellingProductsCard />
      </div>
    </div>
  );
}

function EcommerceWelcomeCardDemo() {
  return (
    <div className="max-w-md p-4">
      <EcommerceWelcomeCard />
    </div>
  );
}

function StatCardsDemo() {
  return (
    <div className="max-w-4xl p-4">
      <StatCards />
    </div>
  );
}

function EcommerceTotalRevenueCardDemo() {
  return (
    <div className="max-w-2xl p-4">
      <EcommerceTotalRevenueCard />
    </div>
  );
}

function EcommerceReturnRateCardDemo() {
  return (
    <div className="max-w-2xl p-4">
      <EcommerceReturnRateCard />
    </div>
  );
}

function EcommerceSalesByLocationCardDemo() {
  return (
    <div className="max-w-md p-4">
      <EcommerceSalesByLocationCard />
    </div>
  );
}

function EcommerceVisitBySourceCardDemo() {
  return (
    <div className="max-w-md p-4">
      <EcommerceVisitBySourceCard />
    </div>
  );
}

function EcommerceCustomerReviewsCardDemo() {
  return (
    <div className="max-w-md p-4">
      <EcommerceCustomerReviewsCard />
    </div>
  );
}

function EcommerceRecentOrdersCardDemo() {
  return (
    <div className="max-w-4xl p-4">
      <EcommerceRecentOrdersCard />
    </div>
  );
}

function EcommerceBestSellingProductsCardDemo() {
  return (
    <div className="max-w-2xl p-4">
      <EcommerceBestSellingProductsCard />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Ecommerce',
  component: EcommerceDashboardDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardEcommerceHandlers },
    docs: {
      description: {
        component:
          'Ecommerce Dashboard - Online store management dashboard with revenue analytics, product sales, customer reviews, and order tracking.',
      },
    },
  },
  argTypes: {
    // No direct props - this is a page-level component
  },
} satisfies Meta<typeof EcommerceDashboardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

/**
 * The complete Ecommerce Dashboard page with all components.
 */
export const Default: Story = {
  name: i18n.t('ecommerce.storyName.default', 'Full Dashboard'),
  render: () => <EcommerceDashboardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify page renders
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

/**
 * Welcome Card - Personalized greeting with achievement highlight.
 */
export const WelcomeCardStory: Story = {
  name: i18n.t('ecommerce.storyName.welcomeCardStory', 'Welcome Card'),
  render: () => <EcommerceWelcomeCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Stat Cards - Key metrics including MRR, users, and growth.
 */
export const StatCardsStory: Story = {
  name: i18n.t('ecommerce.storyName.statCardsStory', 'Stat Cards'),
  render: () => <StatCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Total Revenue Card - Desktop vs Mobile revenue comparison chart.
 */
export const TotalRevenueCardStory: Story = {
  name: i18n.t('ecommerce.storyName.totalRevenueCardStory', 'Total Revenue Card'),
  render: () => <EcommerceTotalRevenueCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Return Rate Card - Product return analytics with line chart.
 */
export const ReturnRateCardStory: Story = {
  name: i18n.t('ecommerce.storyName.returnRateCardStory', 'Return Rate Card'),
  render: () => <EcommerceReturnRateCardDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Sales by Location Card - Geographic sales distribution.
 */
export const SalesByLocationCardStory: Story = {
  name: i18n.t('ecommerce.storyName.salesByLocationCardStory', 'Sales By Location Card'),
  render: () => <EcommerceSalesByLocationCardDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Visit by Source Card - Traffic source breakdown.
 */
export const VisitBySourceCardStory: Story = {
  name: i18n.t('ecommerce.storyName.visitBySourceCardStory', 'Visit By Source Card'),
  render: () => <EcommerceVisitBySourceCardDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Customer Reviews Card - Recent customer feedback.
 */
export const CustomerReviewsCardStory: Story = {
  name: i18n.t('ecommerce.storyName.customerReviewsCardStory', 'Customer Reviews Card'),
  render: () => <EcommerceCustomerReviewsCardDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Recent Orders Card - Order list with status tracking.
 */
export const RecentOrdersCardStory: Story = {
  name: i18n.t('ecommerce.storyName.recentOrdersCardStory', 'Recent Orders Card'),
  render: () => <EcommerceRecentOrdersCardDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Best Selling Products Card - Top products table with sorting.
 */
export const BestSellingProductsCardStory: Story = {
  name: i18n.t('ecommerce.storyName.bestSellingProductsCardStory', 'Best Selling Products Card'),
  render: () => <EcommerceBestSellingProductsCardDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Dark mode variant of the dashboard.
 */
export const Dark: Story = {
  name: i18n.t('ecommerce.storyName.dark', 'Dark Mode'),
  parameters: {
    themes: {
      themeOverride: 'dark',
    },
  },
  render: () => <EcommerceDashboardDemo />,
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
  name: i18n.t('ecommerce.storyName.japanese', 'Japanese'),
  parameters: {
    locale: 'ja',
  },
  render: () => <EcommerceDashboardDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * RTL layout variant.
 */
export const RTL: Story = {
  name: i18n.t('ecommerce.storyName.rTL', 'RTL'),
  parameters: {
    direction: 'rtl',
  },
  render: () => (
    <div dir="rtl">
      <EcommerceDashboardDemo />
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
  name: i18n.t('ecommerce.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardEcommerceStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('ecommerce.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardEcommerceStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('ecommerce.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardEcommerceStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('ecommerce.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: dashboardEcommerceStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('ecommerce.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: dashboardEcommerceStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('ecommerce.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardEcommerceStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('ecommerce.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardEcommerceStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('ecommerce.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardEcommerceStatusHandlers.emptyData } },
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
  name: i18n.t('ecommerce.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('ecommerce.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dashboardEcommerceStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
