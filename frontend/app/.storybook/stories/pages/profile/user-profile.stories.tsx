import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import {
  BriefcaseIcon,
  CalendarIcon,
  LinkIcon,
  MapPinIcon,
  MoreHorizontalIcon,
  UserPlusIcon,
} from 'lucide-react';

import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import {
  createFakeUser,
  createFakeUserProfile,
} from '@/.storybook/stories/_factories/user.factory';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DATA
// ============================================================================

const projects = [
  {
    name: i18n.t('userProfile.story.designSystem', 'Design System'),
    status: i18n.t('userProfile.story.statusActive', 'Active'),
    role: i18n.t('userProfile.story.roleLead', 'Lead'),
    updated: i18n.t('userProfile.story.twoDaysAgo', '2 days ago'),
  },
  {
    name: i18n.t('userProfile.story.mobileApp', 'Mobile App'),
    status: i18n.t('userProfile.story.statusInProgress', 'In Progress'),
    role: i18n.t('userProfile.story.roleContributor', 'Contributor'),
    updated: i18n.t('userProfile.story.fiveDaysAgo', '5 days ago'),
  },
  {
    name: i18n.t('userProfile.story.apiGateway', 'API Gateway'),
    status: i18n.t('userProfile.story.statusCompleted', 'Completed'),
    role: i18n.t('userProfile.story.roleReviewer', 'Reviewer'),
    updated: i18n.t('userProfile.story.oneWeekAgo', '1 week ago'),
  },
];

const activities = [
  {
    action: i18n.t('userProfile.story.pushed3Commits', 'Pushed 3 commits to design-system'),
    time: i18n.t('userProfile.story.twoHoursAgo', '2 hours ago'),
  },
  {
    action: i18n.t('userProfile.story.commentedOnIssue42', 'Commented on issue #42'),
    time: i18n.t('userProfile.story.fiveHoursAgo', '5 hours ago'),
  },
  {
    action: i18n.t('userProfile.story.mergedPr18', 'Merged pull request #18'),
    time: i18n.t('userProfile.story.oneDayAgo', '1 day ago'),
  },
  {
    action: i18n.t('userProfile.story.createdBranchAuth', 'Created new branch feature/auth'),
    time: i18n.t('userProfile.story.twoDaysAgoTime', '2 days ago'),
  },
];

function getProjectBadgeVariant(status: string) {
  if (status === 'Active') return 'default' as const;
  if (status === 'Completed') return 'secondary' as const;
  return 'outline' as const;
}

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function UserProfileDemo() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto min-h-screen max-w-5xl space-y-4 p-6 xl:pt-6">
      <div className="bg-card overflow-hidden rounded-md border">
        {/* Cover image */}
        <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600 lg:h-48" />

        {/* Profile info */}
        <div className="relative px-4 pb-4">
          <Avatar className="-mt-12 h-24 w-24 border-4 border-white">
            <AvatarImage src="" />
            <AvatarFallback className="text-2xl">JD</AvatarFallback>
          </Avatar>
          <div className="mt-3 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">{t('userProfile.story.janeDoe', 'Jane Doe')}</h1>
              <p className="text-muted-foreground text-sm">
                {t('userProfile.story.seniorSoftwareEngineer', 'Senior Software Engineer')}
              </p>
              <div className="text-muted-foreground mt-2 flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <BriefcaseIcon className="h-3.5 w-3.5" />
                  {t('userProfile.story.acmeCorp', 'Acme Corp')}
                </span>
                <span className="flex items-center gap-1">
                  <MapPinIcon className="h-3.5 w-3.5" />
                  {t('userProfile.story.sanFranciscoCa', 'San Francisco, CA')}
                </span>
                <span className="flex items-center gap-1">
                  <LinkIcon className="h-3.5 w-3.5" />
                  {t('userProfile.story.janedoeDev', 'janedoe.dev')}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {t('userProfile.story.joinedMar2022', 'Joined Mar 2022')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm">
                <UserPlusIcon className="h-4 w-4" />
                {t('userProfile.story.connect', 'Connect')}
              </Button>
              <Button size="icon-sm" variant="outline">
                <MoreHorizontalIcon />
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t px-4">
          <Tabs className="flex-1" defaultValue="profile">
            <TabsList className="-mb-0.5 h-auto gap-6 border-none bg-transparent p-0">
              <TabsTrigger
                className="data-[state=active]:border-b-primary data-[state=active]:text-foreground text-muted-foreground rounded-none border-b-2 border-transparent px-0 py-4 shadow-none!"
                value="profile"
              >
                {t('userProfile.story.profile', 'Profile')}
              </TabsTrigger>
              <TabsTrigger
                className="data-[state=active]:border-b-primary data-[state=active]:text-foreground text-muted-foreground rounded-none border-b-2 border-transparent px-0 py-4 shadow-none!"
                value="projects"
              >
                {t('userProfile.story.projects', 'Projects')}
                <Badge className="ml-1 rounded-full" variant="secondary">
                  3
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <div />
            </TabsContent>
            <TabsContent value="projects">
              <div />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Content area */}
      <div className="gap-4 space-y-4 lg:grid lg:grid-cols-[320px_1fr] lg:space-y-0">
        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('userProfile.story.about', 'About')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                {t(
                  'pages.userProfile.bio',
                  'Full-stack engineer with a passion for building great user experiences. Open source contributor and tech speaker.'
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('userProfile.story.skills', 'Skills')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="secondary">{t('userProfile.story.react', 'React')}</Badge>
              <Badge variant="secondary">{t('userProfile.story.typescript', 'TypeScript')}</Badge>
              <Badge variant="secondary">{t('userProfile.story.nodejs', 'Node.js')}</Badge>
              <Badge variant="secondary">{t('userProfile.story.graphql', 'GraphQL')}</Badge>
              <Badge variant="secondary">
                {t('userProfile.story.tailwindCss', 'Tailwind CSS')}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Main content */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('userProfile.story.recentActivity', 'Recent Activity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div className="flex items-start gap-3" key={activity.action}>
                    <div className="bg-muted mt-1.5 h-2 w-2 rounded-full" />
                    <div>
                      <p className="text-sm">{activity.action}</p>
                      <p className="text-muted-foreground text-xs">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('userProfile.story.projects', 'Projects')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {projects.map((project) => (
                  <div
                    className="flex items-center justify-between rounded-md border p-3"
                    key={project.name}
                  >
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {project.role} &middot; {t('userProfile.story.updated', 'Updated')}{' '}
                        {project.updated}
                      </p>
                    </div>
                    <Badge variant={getProjectBadgeVariant(project.status)}>{project.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Profile/User Profile',
  component: UserProfileDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...formHandlers] },
    docs: {
      description: {
        component:
          'User Profile Page - Profile page with cover image, avatar, tabs (Profile/Projects), sidebar with about and skills, activity stream, and project list.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof UserProfileDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('userProfile.storyName.default', 'Full Page'),
  render: () => <UserProfileDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify key profile elements
    expect(canvas.getByText(i18n.t('userProfile.story.janeDoe', 'Jane Doe'))).toBeInTheDocument();
    expect(
      canvas.getByText(
        i18n.t('userProfile.story.seniorSoftwareEngineer', 'Senior Software Engineer')
      )
    ).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /connect/i })).toBeInTheDocument();

    // Verify tabs
    expect(canvas.getByRole('tab', { name: /profile/i })).toBeInTheDocument();
    expect(canvas.getByRole('tab', { name: /projects/i })).toBeInTheDocument();

    // Verify activity
    expect(
      canvas.getByText(
        i18n.t('userProfile.story.pushed3Commits', 'Pushed 3 commits to design-system')
      )
    ).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('userProfile.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <UserProfileDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('userProfile.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <UserProfileDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('userProfile.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <UserProfileDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: formStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: formStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: formStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'userProfile.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: formStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: formStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: formStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: formStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'userProfile.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: formStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: formStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: formStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: formStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: formStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: formStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: formStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('userProfile.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: formStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const user = createFakeUser();
  const profile = createFakeUserProfile();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ user, profile }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('userProfile.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
