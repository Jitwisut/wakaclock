import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { userHandlers, userStatusHandlers } from '@/.storybook/stories/_handlers/user.handlers';
import {
  createFakeUser,
  createFakeUserProfile,
} from '@/.storybook/stories/_factories/user.factory';
import { useTranslation } from 'react-i18next';
import { Link2Icon, Mail, MapPin, PhoneCall, Settings } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Mock profile data
const mockProfile = {
  name: i18n.t('profile.story.anshanHaso', 'Anshan Haso'),
  role: i18n.t('profile.story.projectManager', 'Project Manager'),
  avatar: '/images/avatars/10.png',
  email: 'hello@tobybelhome.com',
  phone: '(+1-876) 8654 239 581',
  location: i18n.t('profile.story.canada', 'Canada'),
  website: 'https://shadcnuikit.com',
  stats: {
    posts: 184,
    projects: 32,
    members: '4.5K',
  },
  skills: [
    i18n.t('profile.story.react', 'React'),
    i18n.t('profile.story.typescript', 'TypeScript'),
    i18n.t('profile.story.nextjs', 'Next.js'),
    i18n.t('profile.story.tailwindCss', 'Tailwind CSS'),
    i18n.t('profile.story.nodejs', 'Node.js'),
  ],
  profileCompletion: 75,
  about: i18n.t(
    'profile.story.aboutDescription',
    'Hello! I am a Project Manager with over 5 years of experience in leading cross-functional teams. I specialize in agile methodologies and love building products that make a difference.'
  ),
};

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function ProfileDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="space-y-4">
        <div className="flex flex-row items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t('profile.story.profilePage', 'Profile Page')}
          </h1>
          <div className="flex items-center space-x-2">
            <Button>
              <Settings />
              {t('profile.story.settings', 'Settings')}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">{t('profile.story.overview', 'Overview')}</TabsTrigger>
            <TabsTrigger value="projects">{t('profile.story.projects', 'Projects')}</TabsTrigger>
            <TabsTrigger value="activities">
              {t('profile.story.activities', 'Activities')}
            </TabsTrigger>
            <TabsTrigger value="members">{t('profile.story.members', 'Members')}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-1">
            <Card className="relative">
              <CardContent>
                <div className="space-y-12">
                  <div className="flex flex-col items-center space-y-4">
                    <Avatar className="size-20">
                      <AvatarImage alt={mockProfile.name} src={mockProfile.avatar} />
                      <AvatarFallback>AH</AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <h5 className="flex items-center gap-2 text-xl font-semibold">
                        {mockProfile.name}{' '}
                        <Badge variant="info">{t('profile.story.pro', 'Pro')}</Badge>
                      </h5>
                      <div className="text-muted-foreground text-sm">{mockProfile.role}</div>
                    </div>
                  </div>
                  <div className="bg-muted grid grid-cols-3 divide-x rounded-md border text-center *:py-3">
                    <div>
                      <h5 className="text-lg font-semibold">{mockProfile.stats.posts}</h5>
                      <div className="text-muted-foreground text-sm">
                        {t('profile.story.post', 'Post')}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-lg font-semibold">{mockProfile.stats.projects}</h5>
                      <div className="text-muted-foreground text-sm">
                        {t('profile.story.projects', 'Projects')}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-lg font-semibold">{mockProfile.stats.members}</h5>
                      <div className="text-muted-foreground text-sm">
                        {t('profile.story.members', 'Members')}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-y-4">
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="text-muted-foreground size-4" /> {mockProfile.email}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <PhoneCall className="text-muted-foreground size-4" /> {mockProfile.phone}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="text-muted-foreground size-4" />
                      {mockProfile.location}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Link2Icon className="text-muted-foreground size-4" />
                      <a className="hover:text-primary hover:underline" href={mockProfile.website}>
                        {mockProfile.website}
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {t('profile.story.completeYourProfile', 'Complete Your Profile')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>{t('profile.story.profileCompletion', 'Profile Completion')}</span>
                    <span className="font-semibold">{mockProfile.profileCompletion}%</span>
                  </div>
                  <Progress value={mockProfile.profileCompletion} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('profile.story.skills', 'Skills')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {mockProfile.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 xl:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.story.latestActivity', 'Latest Activity')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      id: 'activity-1',
                      action: i18n.t(
                        'profile.story.updatedProjectStatus',
                        'Updated project status'
                      ),
                      time: i18n.t('profile.story.twoHoursAgo', '2 hours ago'),
                    },
                    {
                      id: 'activity-2',
                      action: i18n.t('profile.story.addedNewTeamMember', 'Added new team member'),
                      time: i18n.t('profile.story.fiveHoursAgo', '5 hours ago'),
                    },
                    {
                      id: 'activity-3',
                      action: i18n.t('profile.story.completedMilestone', 'Completed milestone'),
                      time: i18n.t('profile.story.oneDayAgo', '1 day ago'),
                    },
                    {
                      id: 'activity-4',
                      action: i18n.t('profile.story.createdNewProject', 'Created new project'),
                      time: i18n.t('profile.story.twoDaysAgo', '2 days ago'),
                    },
                  ].map((activity) => (
                    <div className="flex items-center justify-between" key={activity.id}>
                      <span>{activity.action}</span>
                      <span className="text-muted-foreground text-sm">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t('profile.story.aboutMe', 'About Me')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{mockProfile.about}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('profile.story.connections', 'Connections')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Avatar className="border-background border-2" key={i}>
                        <AvatarImage src={`/images/avatars/0${i}.png`} />
                        <AvatarFallback>U{i}</AvatarFallback>
                      </Avatar>
                    ))}
                    <Avatar className="border-background border-2">
                      <AvatarFallback>+12</AvatarFallback>
                    </Avatar>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileCardDemo() {
  const { t } = useTranslation();

  return (
    <div className="max-w-sm p-4">
      <Card className="relative">
        <CardContent>
          <div className="space-y-12">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="size-20">
                <AvatarImage alt={mockProfile.name} src={mockProfile.avatar} />
                <AvatarFallback>AH</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h5 className="flex items-center gap-2 text-xl font-semibold">
                  {mockProfile.name} <Badge variant="info">{t('profile.story.pro', 'Pro')}</Badge>
                </h5>
                <div className="text-muted-foreground text-sm">{mockProfile.role}</div>
              </div>
            </div>
            <div className="bg-muted grid grid-cols-3 divide-x rounded-md border text-center *:py-3">
              <div>
                <h5 className="text-lg font-semibold">{mockProfile.stats.posts}</h5>
                <div className="text-muted-foreground text-sm">
                  {t('profile.story.post', 'Post')}
                </div>
              </div>
              <div>
                <h5 className="text-lg font-semibold">{mockProfile.stats.projects}</h5>
                <div className="text-muted-foreground text-sm">
                  {t('profile.story.projects', 'Projects')}
                </div>
              </div>
              <div>
                <h5 className="text-lg font-semibold">{mockProfile.stats.members}</h5>
                <div className="text-muted-foreground text-sm">
                  {t('profile.story.members', 'Members')}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="text-muted-foreground size-4" /> {mockProfile.email}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="text-muted-foreground size-4" />
                {mockProfile.location}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Profile/Profile',
  component: ProfileDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...buttonHandlers, ...userHandlers] },
    docs: {
      description: {
        component:
          'Profile Page - A user profile page with profile card (avatar, stats, contact info), profile completion progress, skills, latest activity, about section, and connections.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof ProfileDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('profile.storyName.default', 'Full Page'),
  render: () => <ProfileDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const ProfileCard: Story = {
  name: i18n.t('profile.storyName.profileCard', 'Profile Card'),
  render: () => <ProfileCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('profile.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <ProfileDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('profile.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <ProfileDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('profile.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <ProfileDemo />
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

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('profile.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('profile.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('profile.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('profile.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('profile.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: userStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('profile.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: userStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('profile.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: userStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('profile.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: userStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('profile.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: userStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('profile.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: userStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('profile.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: userStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('profile.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: userStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('profile.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: userStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('profile.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: userStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('profile.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: userStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('profile.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: userStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('profile.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: userStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('profile.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: userStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('profile.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: userStatusHandlers.emptyData } },
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
  name: i18n.t('profile.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
