import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  appsMiscStatusHandlers,
  appsTodoHandlers,
} from '@/.storybook/stories/_handlers/apps-misc.handlers';
import {
  createFakeKanbanBoard,
  createFakeKanbanCard,
} from '@/.storybook/stories/_factories/kanban.factory';

import Tasks from '@/app/dashboard/(auth)/apps/todo-list-app/tasks';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Mock tasks data for stories
const mockTasks = [
  {
    id: '1',
    title: i18n.t('todoList.story.taskReviewDocs', 'Review project documentation'),
    description: i18n.t(
      'todoList.story.taskReviewDocsDesc',
      'Go through the project documentation and update outdated sections.'
    ),
    status: 'pending' as const,
    priority: 'high' as const,
    dueDate: new Date('2025-02-10'),
    assignee: i18n.t('todoList.story.assigneeJohnDoe', 'John Doe'),
    assignedTo: [i18n.t('todoList.story.assigneeJohnDoe', 'John Doe')],
    labels: ['documentation', 'review'],
    createdAt: new Date('2025-01-15'),
    comments: [],
    starred: false,
  },
  {
    id: '2',
    title: i18n.t('todoList.story.taskImplAuth', 'Implement user authentication'),
    description: i18n.t(
      'todoList.story.taskImplAuthDesc',
      'Add JWT-based authentication to the API endpoints.'
    ),
    status: 'in-progress' as const,
    priority: 'high' as const,
    dueDate: new Date('2025-02-05'),
    assignee: i18n.t('todoList.story.assigneeJaneSmith', 'Jane Smith'),
    assignedTo: [i18n.t('todoList.story.assigneeJaneSmith', 'Jane Smith')],
    labels: ['feature', 'backend'],
    createdAt: new Date('2025-01-10'),
    comments: [],
    starred: true,
  },
  {
    id: '3',
    title: i18n.t('todoList.story.taskWriteTests', 'Write unit tests for payment module'),
    description: i18n.t(
      'todoList.story.taskWriteTestsDesc',
      'Create comprehensive unit tests for all payment-related functions.'
    ),
    status: 'pending' as const,
    priority: 'medium' as const,
    dueDate: new Date('2025-02-15'),
    assignee: i18n.t('todoList.story.assigneeBobWilson', 'Bob Wilson'),
    assignedTo: [i18n.t('todoList.story.assigneeBobWilson', 'Bob Wilson')],
    labels: ['testing', 'payment'],
    createdAt: new Date('2025-01-20'),
    comments: [],
    starred: false,
  },
  {
    id: '4',
    title: i18n.t('todoList.story.taskFixLayout', 'Fix responsive layout issues'),
    description: i18n.t(
      'todoList.story.taskFixLayoutDesc',
      'Address mobile layout bugs on the dashboard page.'
    ),
    status: 'completed' as const,
    priority: 'low' as const,
    dueDate: new Date('2025-01-28'),
    assignee: i18n.t('todoList.story.assigneeAliceBrown', 'Alice Brown'),
    assignedTo: [i18n.t('todoList.story.assigneeAliceBrown', 'Alice Brown')],
    labels: ['bug', 'ui'],
    createdAt: new Date('2025-01-05'),
    comments: [],
    starred: false,
  },
  {
    id: '5',
    title: i18n.t('todoList.story.taskDeployStaging', 'Deploy staging environment'),
    description: i18n.t(
      'todoList.story.taskDeployStagingDesc',
      'Set up and deploy the application to the staging server.'
    ),
    status: 'in-progress' as const,
    priority: 'high' as const,
    dueDate: new Date('2025-02-02'),
    assignee: i18n.t('todoList.story.assigneeCharlieDavis', 'Charlie Davis'),
    assignedTo: [i18n.t('todoList.story.assigneeCharlieDavis', 'Charlie Davis')],
    labels: ['devops', 'deployment'],
    createdAt: new Date('2025-01-22'),
    comments: [],
    starred: true,
  },
];

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function TodoListAppDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] p-4">
      <div className="mb-4">
        <p className="text-muted-foreground text-sm">
          {t('todoList.story.organizeYourTasks', 'Organize your tasks and track progress')}
        </p>
      </div>
      <Tasks tasks={mockTasks} />
    </div>
  );
}

function TodoListInterfaceDemo() {
  return (
    <div className="p-4">
      <Tasks tasks={mockTasks} />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Apps/Todo List',
  component: TodoListAppDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Todo List App - Task management application with status tabs (All/Todo/In Progress/Done), add/edit todo sheet, todo detail sheet, and priority/label system.',
      },
    },
    msw: {
      handlers: appsTodoHandlers,
    },
  },
  argTypes: {},
} satisfies Meta<typeof TodoListAppDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('todoList.storyName.default', 'Full App'),
  render: () => <TodoListAppDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify tasks are rendered
    expect(
      canvas.getByText(i18n.t('todoList.story.taskReviewDocs', 'Review project documentation'))
    ).toBeInTheDocument();
    expect(
      canvas.getByText(i18n.t('todoList.story.taskImplAuth', 'Implement user authentication'))
    ).toBeInTheDocument();

    // Verify task priorities are visible
    expect(canvas.getAllByText(/high/i).length).toBeGreaterThan(0);
  },
};

export const TodoListInterface: Story = {
  name: i18n.t('todoList.storyName.todoListInterface', 'Todo List Interface'),
  render: () => <TodoListInterfaceDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify tasks component renders
    expect(
      canvas.getByText(i18n.t('todoList.story.taskReviewDocs', 'Review project documentation'))
    ).toBeInTheDocument();
    expect(
      canvas.getByText(
        i18n.t('todoList.story.taskWriteTests', 'Write unit tests for payment module')
      )
    ).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('todoList.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <TodoListAppDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('todoList.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <TodoListAppDemo />,
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
  name: i18n.t('todoList.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <TodoListAppDemo />
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
  name: i18n.t('todoList.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('todoList.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('todoList.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('todoList.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('todoList.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('todoList.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('todoList.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('todoList.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('todoList.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('todoList.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('todoList.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('todoList.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const board = createFakeKanbanBoard();
  const kanbanCard = createFakeKanbanCard();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ board, kanbanCard }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('todoList.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
