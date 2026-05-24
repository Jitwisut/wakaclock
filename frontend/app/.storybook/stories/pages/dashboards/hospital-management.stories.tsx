import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardHospitalHandlers,
  dashboardHospitalStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-hospital.handlers';
import { useTranslation } from 'react-i18next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import Notes from '@/app/dashboard/(auth)/hospital-management/components/notes';
import PatientVisitsChart from '@/app/dashboard/(auth)/hospital-management/components/patient-visits-chart';
import PatientsByDepartmentChart from '@/app/dashboard/(auth)/hospital-management/components/patients-by-department-chart';
import PatientsWithLastProcedure from '@/app/dashboard/(auth)/hospital-management/components/patients-with-last-procedure';
import PlannedCalendar from '@/app/dashboard/(auth)/hospital-management/components/planned-calendar';
import HospitalReports from '@/app/dashboard/(auth)/hospital-management/components/reports';
import SummaryCards from '@/app/dashboard/(auth)/hospital-management/components/summary-cards';
import UpcomingAppointments from '@/app/dashboard/(auth)/hospital-management/components/upcoming-appointments';
import {
  createFakeTableData,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';
import { createFakeUser, createFakeUsers } from '@/.storybook/stories/_factories/user.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function HospitalManagementDashboardDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('hospitalManagement.story.title', 'Hospital Management')}
        </h1>
      </div>
      <Tabs className="space-y-4" defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            {t('hospitalManagement.story.overview', 'Overview')}
          </TabsTrigger>
          <TabsTrigger value="reports">
            {t('hospitalManagement.story.reports', 'Reports')}
          </TabsTrigger>
          <TabsTrigger disabled value="notifications">
            {t('hospitalManagement.story.activities', 'Activities')}
          </TabsTrigger>
        </TabsList>
        <TabsContent className="space-y-4" value="overview">
          <SummaryCards />
          <div className="gap-4 space-y-4 md:grid-cols-2 lg:grid lg:grid-cols-7 lg:space-y-0">
            <PatientVisitsChart />
            <PatientsByDepartmentChart />
          </div>
          <div className="gap-4 space-y-4 md:grid-cols-2 lg:grid lg:grid-cols-7 lg:space-y-0">
            <UpcomingAppointments />
            <PatientsWithLastProcedure />
          </div>
          <div className="gap-4 space-y-4 md:grid-cols-2 lg:grid lg:grid-cols-2 lg:space-y-0">
            <PlannedCalendar />
            <Notes />
          </div>
        </TabsContent>
        <TabsContent className="space-y-4" value="reports">
          <HospitalReports />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCardsDemo() {
  return (
    <div className="max-w-6xl p-4">
      <SummaryCards />
    </div>
  );
}

function PatientVisitsChartDemo() {
  return (
    <div className="max-w-2xl p-4">
      <PatientVisitsChart />
    </div>
  );
}

function PatientsByDepartmentChartDemo() {
  return (
    <div className="max-w-md p-4">
      <PatientsByDepartmentChart />
    </div>
  );
}

function UpcomingAppointmentsDemo() {
  return (
    <div className="max-w-2xl p-4">
      <UpcomingAppointments />
    </div>
  );
}

function PatientsWithLastProcedureDemo() {
  return (
    <div className="max-w-md p-4">
      <PatientsWithLastProcedure />
    </div>
  );
}

function PlannedCalendarDemo() {
  return (
    <div className="max-w-2xl p-4">
      <PlannedCalendar />
    </div>
  );
}

function NotesDemo() {
  return (
    <div className="max-w-md p-4">
      <Notes />
    </div>
  );
}

function HospitalReportsDemo() {
  return (
    <div className="max-w-6xl p-4">
      <HospitalReports />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Hospital Management',
  component: HospitalManagementDashboardDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardHospitalHandlers },
    docs: {
      description: {
        component:
          'Hospital Management Dashboard - Healthcare administration dashboard with patient visits, department analytics, appointments, and medical reports.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof HospitalManagementDashboardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('hospitalManagement.storyName.default', 'Full Dashboard'),
  render: () => <HospitalManagementDashboardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const SummaryCardsStory: Story = {
  name: i18n.t('hospitalManagement.storyName.summaryCardsStory', 'Summary Cards'),
  render: () => <SummaryCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const PatientVisitsChartStory: Story = {
  name: i18n.t('hospitalManagement.storyName.patientVisitsChartStory', 'Patient Visits Chart'),
  render: () => <PatientVisitsChartDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const PatientsByDepartmentChartStory: Story = {
  name: i18n.t(
    'hospitalManagement.storyName.patientsByDepartmentChartStory',
    'Patients By Department Chart'
  ),
  render: () => <PatientsByDepartmentChartDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const UpcomingAppointmentsStory: Story = {
  name: i18n.t('hospitalManagement.storyName.upcomingAppointmentsStory', 'Upcoming Appointments'),
  render: () => <UpcomingAppointmentsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PatientsWithLastProcedureStory: Story = {
  name: i18n.t(
    'hospitalManagement.storyName.patientsWithLastProcedureStory',
    'Patients With Last Procedure'
  ),
  render: () => <PatientsWithLastProcedureDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PlannedCalendarStory: Story = {
  name: i18n.t('hospitalManagement.storyName.plannedCalendarStory', 'Planned Calendar'),
  render: () => <PlannedCalendarDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NotesStory: Story = {
  name: i18n.t('hospitalManagement.storyName.notesStory', 'Notes'),
  render: () => <NotesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HospitalReportsStory: Story = {
  name: i18n.t('hospitalManagement.storyName.hospitalReportsStory', 'Hospital Reports'),
  render: () => <HospitalReportsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('hospitalManagement.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <HospitalManagementDashboardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('hospitalManagement.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <HospitalManagementDashboardDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('hospitalManagement.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <HospitalManagementDashboardDemo />
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
  name: i18n.t('hospitalManagement.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardHospitalStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('hospitalManagement.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardHospitalStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('hospitalManagement.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardHospitalStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'hospitalManagement.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: dashboardHospitalStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'hospitalManagement.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: dashboardHospitalStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('hospitalManagement.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardHospitalStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('hospitalManagement.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardHospitalStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('hospitalManagement.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardHospitalStatusHandlers.emptyData } },
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
  const user = createFakeUser();
  const users = createFakeUsers(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ tableRow, tableData, user, users }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('hospitalManagement.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('hospitalManagement.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dashboardHospitalStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
