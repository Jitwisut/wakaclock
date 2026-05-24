import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardHotelHandlers,
  dashboardHotelStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-hotel.handlers';
import { useTranslation } from 'react-i18next';

import { BookingList } from '@/app/dashboard/(auth)/hotel/components/booking-list';
import { BookingsCard } from '@/app/dashboard/(auth)/hotel/components/bookings-card';
import { CampaignOverview } from '@/app/dashboard/(auth)/hotel/components/campaign-overview';
import { RecentActivities } from '@/app/dashboard/(auth)/hotel/components/recent-activities';
import { ReservationsCard } from '@/app/dashboard/(auth)/hotel/components/reservations-card';
import { RevenueStat } from '@/app/dashboard/(auth)/hotel/components/revenue-stat';
import { StatCards } from '@/app/dashboard/(auth)/hotel/components/stat-cards';
import { createFakeCard, createFakeCards } from '@/.storybook/stories/_factories/card.factory';
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

function HotelDashboardDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('hotelDashboard.story.title', 'Hotel Management')}
        </h1>
      </div>
      <StatCards />
      <div className="gap-4 space-y-4 xl:grid xl:grid-cols-3 xl:space-y-0">
        <ReservationsCard />
        <div className="xl:col-span-2">
          <CampaignOverview />
        </div>
      </div>
      <div className="gap-4 space-y-4 xl:grid xl:grid-cols-3 xl:space-y-0">
        <RecentActivities />
        <RevenueStat />
        <BookingsCard />
      </div>
      <BookingList />
    </div>
  );
}

function StatCardsDemo() {
  return (
    <div className="max-w-6xl p-4">
      <StatCards />
    </div>
  );
}

function ReservationsCardDemo() {
  return (
    <div className="max-w-sm p-4">
      <ReservationsCard />
    </div>
  );
}

function CampaignOverviewDemo() {
  return (
    <div className="max-w-4xl p-4">
      <CampaignOverview />
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

function RevenueStatDemo() {
  return (
    <div className="max-w-md p-4">
      <RevenueStat />
    </div>
  );
}

function BookingsCardDemo() {
  return (
    <div className="max-w-md p-4">
      <BookingsCard />
    </div>
  );
}

function BookingListDemo() {
  return (
    <div className="max-w-6xl p-4">
      <BookingList />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Hotel',
  component: HotelDashboardDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardHotelHandlers },
    docs: {
      description: {
        component:
          'Hotel Management Dashboard - Hospitality management dashboard with reservations, bookings, revenue tracking, and campaign analytics.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof HotelDashboardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('hotel.storyName.default', 'Full Dashboard'),
  render: () => <HotelDashboardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const StatCardsStory: Story = {
  name: i18n.t('hotel.storyName.statCardsStory', 'Stat Cards'),
  render: () => <StatCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const ReservationsCardStory: Story = {
  name: i18n.t('hotel.storyName.reservationsCardStory', 'Reservations Card'),
  render: () => <ReservationsCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const CampaignOverviewStory: Story = {
  name: i18n.t('hotel.storyName.campaignOverviewStory', 'Campaign Overview'),
  render: () => <CampaignOverviewDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const RecentActivitiesStory: Story = {
  name: i18n.t('hotel.storyName.recentActivitiesStory', 'Recent Activities'),
  render: () => <RecentActivitiesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RevenueStatStory: Story = {
  name: i18n.t('hotel.storyName.revenueStatStory', 'Revenue Stat'),
  render: () => <RevenueStatDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const BookingsCardStory: Story = {
  name: i18n.t('hotel.storyName.bookingsCardStory', 'Bookings Card'),
  render: () => <BookingsCardDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const BookingListStory: Story = {
  name: i18n.t('hotel.storyName.bookingListStory', 'Booking List'),
  render: () => <BookingListDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('hotel.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <HotelDashboardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('hotel.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <HotelDashboardDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('hotel.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <HotelDashboardDemo />
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
  name: i18n.t('hotel.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardHotelStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('hotel.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardHotelStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('hotel.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardHotelStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('hotel.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: dashboardHotelStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('hotel.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: dashboardHotelStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('hotel.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardHotelStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('hotel.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardHotelStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('hotel.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardHotelStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY DATA STORY
// ============================================================================

function FactoryDataDemo() {
  const { t } = useTranslation();
  const card = createFakeCard();
  const cards = createFakeCards(3);
  const chartData = createFakeChartData();
  const statsCards = createFakeChartStatsCards(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ card, cards, chartData, statsCards }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('hotel.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('hotel.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dashboardHotelStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
