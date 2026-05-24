import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardProjectHandlers,
  dashboardProjectStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-project.handlers';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  createFakeTableData,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';
import { createFakeCard, createFakeCards } from '@/.storybook/stories/_factories/card.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Mock project data for stories
const mockProjects = [
  {
    id: 1,
    title: i18n.t('projectList.story.mobileApp', 'Mobile App'),
    subtitle: i18n.t('projectList.story.prototyping', 'Prototyping'),
    progress: 78,
    timeLeft: i18n.t('projectList.story.oneWeekLeft', '1 week left'),
    date: i18n.t('projectList.story.dateMay012021', 'May 01, 2021'),
    progressColor: 'bg-orange-500',
    badgeColor: 'bg-orange-500',
    team: [
      { id: 1, avatar: '/images/avatars/01.png' },
      { id: 2, avatar: '/images/avatars/02.png' },
      { id: 3, avatar: '/images/avatars/03.png' },
    ],
  },
  {
    id: 2,
    title: i18n.t(
      'projectList.story.designLearnManagementSystem',
      'Design Learn Management System'
    ),
    subtitle: i18n.t('projectList.story.uiUxDesign', 'UI/UX Design'),
    progress: 32,
    timeLeft: i18n.t('projectList.story.twoWeekLeft', '2 week left'),
    date: i18n.t('projectList.story.dateJune042021', 'June 04, 2021'),
    progressColor: 'bg-blue-500',
    badgeColor: 'bg-blue-500',
    team: [
      { id: 1, avatar: '/images/avatars/03.png' },
      { id: 2, avatar: '/images/avatars/04.png' },
    ],
  },
  {
    id: 3,
    title: i18n.t('projectList.story.chatMobileApp', 'Chat Mobile App'),
    subtitle: i18n.t('projectList.story.prototyping', 'Prototyping'),
    progress: 64,
    timeLeft: i18n.t('projectList.story.sixWeekLeft', '6 week left'),
    date: i18n.t('projectList.story.dateOct272021', 'Oct 27, 2021'),
    progressColor: 'bg-pink-500',
    badgeColor: 'bg-pink-500',
    team: [
      { id: 1, avatar: '/images/avatars/05.png' },
      { id: 2, avatar: '/images/avatars/06.png' },
      { id: 3, avatar: '/images/avatars/07.png' },
      { id: 4, avatar: '/images/avatars/08.png' },
    ],
  },
  {
    id: 4,
    title: i18n.t('projectList.story.storeDashboard', 'Store Dashboard'),
    subtitle: i18n.t('projectList.story.uiUxDesign', 'UI/UX Design'),
    progress: 45,
    timeLeft: i18n.t('projectList.story.threeWeekLeft', '3 week left'),
    date: i18n.t('projectList.story.dateSep162021', 'Sep 16, 2021'),
    progressColor: 'bg-green-500',
    badgeColor: 'bg-green-500',
    team: [
      { id: 1, avatar: '/images/avatars/01.png' },
      { id: 2, avatar: '/images/avatars/02.png' },
      { id: 3, avatar: '/images/avatars/03.png' },
    ],
  },
];

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function ProjectListDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] p-4">
      <div className="mb-4 flex flex-row items-center justify-between space-y-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {t('projectList.story.projects', 'Projects')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('projectList.story.listOfOngoingProjects', 'List of your ongoing projects')}
          </p>
        </div>
        <Button>
          <Plus />
          {t('projectList.story.newProject', 'New Project')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {mockProjects.map((project) => (
          <Card key={project.id} className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>{project.title}</CardTitle>
              <CardDescription>{project.subtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground mb-4 text-sm">{project.date}</div>

              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm opacity-90">
                    {t('projectList.story.progress', 'Progress')}
                  </span>
                  <span className="text-sm font-semibold">{project.progress}%</span>
                </div>
                <Progress indicatorColor={project.progressColor} value={project.progress} />
              </div>

              <div className="flex items-center justify-between">
                <div className="*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2">
                  {project.team.map((member) => (
                    <Avatar key={`${project.id}-member-${member.id}`}>
                      <AvatarImage alt={`${member.id}`} src={member.avatar} />
                      <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                  ))}
                </div>

                <Badge className={`${project.badgeColor} border-0 text-white`}>
                  {project.timeLeft}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProjectCardsDemo() {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
      {mockProjects.slice(0, 2).map((project) => (
        <Card key={project.id} className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle>{project.title}</CardTitle>
            <CardDescription>{project.subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground mb-4 text-sm">{project.date}</div>
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm opacity-90">
                  {t('projectList.story.progress', 'Progress')}
                </span>
                <span className="text-sm font-semibold">{project.progress}%</span>
              </div>
              <Progress indicatorColor={project.progressColor} value={project.progress} />
            </div>
            <div className="flex items-center justify-between">
              <div className="*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2">
                {project.team.map((member) => (
                  <Avatar key={`${project.id}-member-${member.id}`}>
                    <AvatarImage alt={`${member.id}`} src={member.avatar} />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <Badge className={`${project.badgeColor} border-0 text-white`}>
                {project.timeLeft}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Project List',
  component: ProjectListDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardProjectHandlers },
    docs: {
      description: {
        component:
          'Project List - An organized overview of projects with key details including progress bars, team avatars, deadline badges, and status indicators.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof ProjectListDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('projectList.storyName.default', 'Full Page'),
  render: () => <ProjectListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const ProjectCards: Story = {
  name: i18n.t('projectList.storyName.projectCards', 'Project Cards'),
  render: () => <ProjectCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('projectList.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <ProjectListDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('projectList.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <ProjectListDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('projectList.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <ProjectListDemo />
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('projectList.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('projectList.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('projectList.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'projectList.storyName.error422UnprocessableEntity',
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
    'projectList.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('projectList.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('projectList.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardProjectStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('projectList.storyName.emptyData', 'Handler: Empty Data'),
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
  const card = createFakeCard();
  const cards = createFakeCards(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ tableRow, tableData, card, cards }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('projectList.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
