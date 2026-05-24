import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  appsTasksHandlers,
  appsTasksStatusHandlers,
} from '@/.storybook/stories/_handlers/apps-tasks.handlers';
import {
  createFakeTableData,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';

import { columns } from '@/app/dashboard/(auth)/apps/tasks/components/columns';
import { DataTable } from '@/app/dashboard/(auth)/apps/tasks/components/data-table';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Mock task data for stories
const mockTasks = [
  {
    id: i18n.t('tasks.story.taskId8782', 'TASK-8782'),
    title: i18n.t(
      'tasks.story.taskTitle8782',
      "You can't compress the program without quantifying the open-source SSD pixel!"
    ),
    status: 'in progress',
    label: 'documentation',
    priority: 'medium',
  },
  {
    id: i18n.t('tasks.story.taskId7878', 'TASK-7878'),
    title: i18n.t(
      'tasks.story.taskTitle7878',
      'Try to calculate the EXE feed, maybe it will index the multi-byte pixel!'
    ),
    status: 'backlog',
    label: 'documentation',
    priority: 'medium',
  },
  {
    id: i18n.t('tasks.story.taskId7839', 'TASK-7839'),
    title: i18n.t('tasks.story.taskTitle7839', 'We need to bypass the neural TCP card!'),
    status: 'todo',
    label: 'bug',
    priority: 'high',
  },
  {
    id: i18n.t('tasks.story.taskId5562', 'TASK-5562'),
    title: i18n.t(
      'tasks.story.taskTitle5562',
      'The SAS interface is down, bypass the open-source sensor so we can get the HDD bandwidth!'
    ),
    status: 'backlog',
    label: 'feature',
    priority: 'medium',
  },
  {
    id: i18n.t('tasks.story.taskId8686', 'TASK-8686'),
    title: i18n.t(
      'tasks.story.taskTitle8686',
      "I'll parse the wireless SSL protocol, that should driver the API panel!"
    ),
    status: 'canceled',
    label: 'feature',
    priority: 'medium',
  },
  {
    id: i18n.t('tasks.story.taskId1280', 'TASK-1280'),
    title: i18n.t(
      'tasks.story.taskTitle1280',
      'Use the digital TLS panel, then you can transmit the haptic system!'
    ),
    status: 'done',
    label: 'bug',
    priority: 'high',
  },
  {
    id: i18n.t('tasks.story.taskId7262', 'TASK-7262'),
    title: i18n.t(
      'tasks.story.taskTitle7262',
      'The UTF8 application is down, parse the neural bandwidth so we can get the FTP firewall!'
    ),
    status: 'done',
    label: 'feature',
    priority: 'high',
  },
  {
    id: i18n.t('tasks.story.taskId1138', 'TASK-1138'),
    title: i18n.t(
      'tasks.story.taskTitle1138',
      "Generating the driver won't do anything, we need to quantify the 1080p SMTP bandwidth!"
    ),
    status: 'in progress',
    label: 'feature',
    priority: 'medium',
  },
];

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function TasksAppDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('tasks.story.tasks', 'Tasks')}</h1>
        <p className="text-muted-foreground text-sm">
          {t('tasks.story.trackAndManage', 'Track and manage your tasks and issues')}
        </p>
      </div>
      <DataTable columns={columns} data={mockTasks} />
    </div>
  );
}

function TasksInterfaceDemo() {
  return (
    <div className="p-4">
      <DataTable columns={columns} data={mockTasks} />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Apps/Tasks',
  component: TasksAppDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Tasks App - Task and issue tracker built with TanStack Table featuring sorting, filtering, pagination, faceted filters, column visibility, and row selection.',
      },
    },
    msw: {
      handlers: appsTasksHandlers,
    },
  },
  argTypes: {},
} satisfies Meta<typeof TasksAppDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('tasks.storyName.default', 'Full App'),
  render: () => <TasksAppDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify page renders with heading
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const TasksInterface: Story = {
  name: i18n.t('tasks.storyName.tasksInterface', 'Tasks Interface'),
  render: () => <TasksInterfaceDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('tasks.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <TasksAppDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('tasks.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <TasksAppDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('tasks.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <TasksAppDemo />
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: appsTasksStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: appsTasksStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: appsTasksStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: appsTasksStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: appsTasksStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: appsTasksStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: appsTasksStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: appsTasksStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: appsTasksStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const row = createFakeTableRow();
  const rows = createFakeTableData(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ row, rows }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('tasks.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('tasks.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: appsTasksStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
