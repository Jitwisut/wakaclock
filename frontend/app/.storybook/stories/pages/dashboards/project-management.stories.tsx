import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardProjectHandlers,
  dashboardProjectStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-project.handlers';
import { useTranslation } from 'react-i18next';

import {
  AchievementByYear,
  ChartProjectEfficiency,
  ChartProjectOverview,
  Reminders,
  Reports,
  SuccessMetrics,
  SummaryCards,
  TableRecentProjects,
} from '@/app/dashboard/(auth)/project-management/components';
import { ExportButton } from '@/components/CardActionMenus';
import { CalendarDateRangePicker } from '@/components/custom-date-range-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  createFakeTableData,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';
import {
  createFakeKanbanBoard,
  createFakeKanbanCard,
} from '@/.storybook/stories/_factories/kanban.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function ProjectManagementDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="mb-4 flex flex-row items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('projectDashboard.story.title', 'Project Dashboard')}
        </h1>
        <div className="flex items-center space-x-2">
          <CalendarDateRangePicker />
          <ExportButton />
        </div>
      </div>

      <Tabs className="space-y-4" defaultValue="overview">
        <TabsList className="z-10">
          <TabsTrigger value="overview">
            {t('projectDashboard.story.overview', 'Overview')}
          </TabsTrigger>
          <TabsTrigger value="reports">
            {t('projectDashboard.story.reports', 'Reports')}
          </TabsTrigger>
          <TabsTrigger disabled value="activities">
            {t('projectDashboard.story.activities', 'Activities')}
          </TabsTrigger>
        </TabsList>
        <TabsContent className="space-y-4" value="overview">
          <SummaryCards />
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ChartProjectOverview />
            </div>
            <SuccessMetrics />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
            <Reminders />
            <AchievementByYear />
            <ChartProjectEfficiency />
          </div>
          <TableRecentProjects />
        </TabsContent>
        <TabsContent value="reports">
          <Reports />
        </TabsContent>
        <TabsContent value="activities">...</TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTabDemo() {
  return (
    <div className="space-y-4 p-4">
      <SummaryCards />
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartProjectOverview />
        </div>
        <SuccessMetrics />
      </div>
    </div>
  );
}

function ChartsDemo() {
  return (
    <div className="grid gap-4 p-4 xl:grid-cols-2 2xl:grid-cols-4">
      <Reminders />
      <AchievementByYear />
      <ChartProjectEfficiency />
    </div>
  );
}

function ReportsTabDemo() {
  return (
    <div className="p-4">
      <Reports />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Project Management',
  component: ProjectManagementDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardProjectHandlers },
    docs: {
      description: {
        component:
          'Project Management Dashboard - A powerful interface for tracking tasks, deadlines, and team progress with tabbed views for Overview and Reports, featuring charts, metrics, and project tables.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof ProjectManagementDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('projectManagement.storyName.default', 'Full Dashboard'),
  render: () => <ProjectManagementDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const OverviewTab: Story = {
  name: i18n.t('projectManagement.storyName.overviewTab', 'Overview Tab'),
  render: () => <OverviewTabDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Charts: Story = {
  name: i18n.t('projectManagement.storyName.charts', 'Charts Section'),
  render: () => <ChartsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const ReportsTab: Story = {
  name: i18n.t('projectManagement.storyName.reportsTab', 'Reports Tab'),
  render: () => <ReportsTabDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('projectManagement.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <ProjectManagementDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('projectManagement.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <ProjectManagementDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('projectManagement.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <ProjectManagementDemo />
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
  name: i18n.t('projectManagement.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('projectManagement.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('projectManagement.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'projectManagement.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'projectManagement.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('projectManagement.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('projectManagement.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('projectManagement.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY DATA STORY
// ============================================================================

function FactoryDataDemo() {
  const { t } = useTranslation();
  const tableRow = createFakeTableRow();
  const tableData = createFakeTableData(3);
  const kanbanBoard = createFakeKanbanBoard();
  const kanbanCard = createFakeKanbanCard();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ tableRow, tableData, kanbanBoard, kanbanCard }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('projectManagement.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('projectManagement.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
