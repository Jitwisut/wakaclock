import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardAcademyHandlers,
  dashboardAcademyStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-academy.handlers';
import { useTranslation } from 'react-i18next';

import {
  ChartMostActivity,
  CourseProgressByMonth,
  CoursesListTable,
  LeaderboardCard,
  LearningPathCard,
  ProgressStatisticsCard,
  StudentSuccessCard,
  WelcomeCard,
} from '@/app/dashboard/(auth)/academy/components';
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

function AcademyDashboardDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('academy.story.academy', 'Academy')}
        </h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-12 xl:col-span-6">
          <WelcomeCard />
        </div>
        <div className="lg:col-span-6 xl:col-span-3">
          <LearningPathCard />
        </div>
        <div className="lg:col-span-6 xl:col-span-3">
          <LeaderboardCard />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <StudentSuccessCard
          currentSuccessRate={88}
          passingStudents={1320}
          previousSuccessRate={85}
          totalStudents={1500}
        />
        <ProgressStatisticsCard />
        <ChartMostActivity />
      </div>
      <div className="mt-4 gap-4 space-y-4 xl:grid xl:grid-cols-2 xl:space-y-0">
        <CourseProgressByMonth />
        <CoursesListTable />
      </div>
    </div>
  );
}

function StudentSuccessCardDemo({
  currentSuccessRate = 88,
  passingStudents = 1320,
  previousSuccessRate = 85,
  totalStudents = 1500,
}: {
  currentSuccessRate?: number;
  passingStudents?: number;
  previousSuccessRate?: number;
  totalStudents?: number;
}) {
  return (
    <div className="max-w-md p-4">
      <StudentSuccessCard
        currentSuccessRate={currentSuccessRate}
        passingStudents={passingStudents}
        previousSuccessRate={previousSuccessRate}
        totalStudents={totalStudents}
      />
    </div>
  );
}

function WelcomeCardDemo() {
  return (
    <div className="max-w-2xl p-4">
      <WelcomeCard />
    </div>
  );
}

function LearningPathCardDemo() {
  return (
    <div className="max-w-sm p-4">
      <LearningPathCard />
    </div>
  );
}

function LeaderboardCardDemo() {
  return (
    <div className="max-w-sm p-4">
      <LeaderboardCard />
    </div>
  );
}

function ProgressStatisticsCardDemo() {
  return (
    <div className="max-w-md p-4">
      <ProgressStatisticsCard />
    </div>
  );
}

function ChartMostActivityDemo() {
  return (
    <div className="max-w-md p-4">
      <ChartMostActivity />
    </div>
  );
}

function CourseProgressByMonthDemo() {
  return (
    <div className="max-w-2xl p-4">
      <CourseProgressByMonth />
    </div>
  );
}

function CoursesListTableDemo() {
  return (
    <div className="max-w-2xl p-4">
      <CoursesListTable />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Academy',
  component: AcademyDashboardDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardAcademyHandlers },
    docs: {
      description: {
        component:
          'Academy Dashboard - Admin dashboard template for schools and educational institutions. Displays student success rates, course progress, leaderboards, and learning analytics.',
      },
    },
  },
  argTypes: {
    // No direct props - this is a page-level component
  },
} satisfies Meta<typeof AcademyDashboardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

/**
 * The complete Academy Dashboard page with all components.
 */
export const Default: Story = {
  name: i18n.t('academy.storyName.default', 'Full Dashboard'),
  render: () => <AcademyDashboardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify page renders
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

/**
 * Welcome Card - Personalized greeting with CTA.
 */
export const WelcomeCardStory: Story = {
  name: i18n.t('academy.storyName.welcomeCardStory', 'Welcome Card'),
  render: () => <WelcomeCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Student Success Card - Shows success rate metrics.
 */
export const StudentSuccessCardStory: Story = {
  name: i18n.t('academy.storyName.studentSuccessCardStory', 'Student Success Card'),
  render: () => <StudentSuccessCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Student Success Card with custom values.
 */
export const StudentSuccessCardCustom: Story = {
  name: i18n.t('academy.storyName.studentSuccessCardCustom', 'Student Success Card (Custom)'),
  render: () => (
    <StudentSuccessCardDemo
      currentSuccessRate={92}
      passingStudents={460}
      previousSuccessRate={88}
      totalStudents={500}
    />
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Student Success Card showing negative change.
 */
export const StudentSuccessCardNegative: Story = {
  name: i18n.t(
    'academy.storyName.studentSuccessCardNegative',
    'Student Success Card (Negative Change)'
  ),
  render: () => (
    <StudentSuccessCardDemo
      currentSuccessRate={78}
      passingStudents={780}
      previousSuccessRate={85}
      totalStudents={1000}
    />
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Learning Path Card - Shows course progress.
 */
export const LearningPathCardStory: Story = {
  name: i18n.t('academy.storyName.learningPathCardStory', 'Learning Path Card'),
  render: () => <LearningPathCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Leaderboard Card - Top performers.
 */
export const LeaderboardCardStory: Story = {
  name: i18n.t('academy.storyName.leaderboardCardStory', 'Leaderboard Card'),
  render: () => <LeaderboardCardDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Progress Statistics Card - Circular progress indicators.
 */
export const ProgressStatisticsCardStory: Story = {
  name: i18n.t('academy.storyName.progressStatisticsCardStory', 'Progress Statistics Card'),
  render: () => <ProgressStatisticsCardDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Chart Most Activity - Activity distribution chart.
 */
export const ChartMostActivityStory: Story = {
  name: i18n.t('academy.storyName.chartMostActivityStory', 'Chart Most Activity'),
  render: () => <ChartMostActivityDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Course Progress By Month - Monthly progress chart.
 */
export const CourseProgressByMonthStory: Story = {
  name: i18n.t('academy.storyName.courseProgressByMonthStory', 'Course Progress By Month'),
  render: () => <CourseProgressByMonthDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Courses List Table - Table of courses.
 */
export const CoursesListTableStory: Story = {
  name: i18n.t('academy.storyName.coursesListTableStory', 'Courses List Table'),
  render: () => <CoursesListTableDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Dark mode variant of the dashboard.
 */
export const Dark: Story = {
  name: i18n.t('academy.storyName.dark', 'Dark Mode'),
  parameters: {
    themes: {
      themeOverride: 'dark',
    },
  },
  render: () => <AcademyDashboardDemo />,
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
  name: i18n.t('academy.storyName.japanese', 'Japanese'),
  parameters: {
    locale: 'ja',
  },
  render: () => <AcademyDashboardDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * RTL layout variant.
 */
export const RTL: Story = {
  name: i18n.t('academy.storyName.rTL', 'RTL'),
  parameters: {
    direction: 'rtl',
  },
  render: () => (
    <div dir="rtl">
      <AcademyDashboardDemo />
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
  name: i18n.t('academy.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardAcademyStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('academy.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardAcademyStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('academy.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardAcademyStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('academy.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: dashboardAcademyStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('academy.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: dashboardAcademyStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('academy.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardAcademyStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('academy.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardAcademyStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('academy.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardAcademyStatusHandlers.emptyData } },
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
  name: i18n.t('academy.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('academy.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dashboardAcademyStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
