import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  appsMiscStatusHandlers,
  appsSocialHandlers,
} from '@/.storybook/stories/_handlers/apps-misc.handlers';
import { createFakeUser, createFakeUsers } from '@/.storybook/stories/_factories/user.factory';

import { AsideRight } from '@/app/dashboard/(auth)/apps/social-media/components/aside-right';
import { PostItem } from '@/app/dashboard/(auth)/apps/social-media/components/post-item';
import { SocialMediaSidebar } from '@/app/dashboard/(auth)/apps/social-media/components/social-media-sidebar';
import { SocialMediaStories } from '@/app/dashboard/(auth)/apps/social-media/components/social-media-stories';
import { postsData } from '@/app/dashboard/(auth)/apps/social-media/data';
import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function SocialMediaAppDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('socialMedia.story.socialMedia', 'Social Media')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t('socialMedia.story.connectShareInteract', 'Connect, share and interact with users')}
        </p>
      </div>
      <div className="grid h-[calc(100%-4rem)] flex-1 gap-4 overflow-hidden md:grid-cols-[280px_auto] lg:grid-cols-[280px_auto_280px]">
        <SocialMediaSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto lg:max-w-xl">
            <div className="space-y-4">
              <SocialMediaStories />
              <div className="space-y-4 divide-y lg:space-y-6 [&>div]:py-4">
                {postsData.slice(0, 3).map((post) => (
                  <PostItem key={post.id} post={post} />
                ))}
                <div className="text-center">
                  <Button variant="outline">
                    {t('socialMedia.story.morePosts', 'More posts')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
        <AsideRight />
      </div>
    </div>
  );
}

function StoriesDemo() {
  return (
    <div className="max-w-xl p-4">
      <SocialMediaStories />
    </div>
  );
}

function PostsDemo() {
  return (
    <div className="max-w-xl space-y-4 p-4">
      {postsData.slice(0, 2).map((post) => (
        <PostItem key={post.id} post={post} />
      ))}
    </div>
  );
}

function SidebarDemo() {
  return (
    <div className="h-[80vh] w-72 p-4">
      <SocialMediaSidebar />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Apps/Social Media',
  component: SocialMediaAppDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Social Media App - Social networking interface with 3-column layout including sidebar navigation, stories carousel, post feed, and aside panel for suggestions.',
      },
    },
    msw: {
      handlers: appsSocialHandlers,
    },
  },
  argTypes: {},
} satisfies Meta<typeof SocialMediaAppDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('socialMedia.storyName.default', 'Full App'),
  render: () => <SocialMediaAppDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const StoriesStory: Story = {
  name: i18n.t('socialMedia.storyName.storiesStory', 'Stories'),
  render: () => <StoriesDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const PostsStory: Story = {
  name: i18n.t('socialMedia.storyName.postsStory', 'Posts'),
  render: () => <PostsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const SidebarStory: Story = {
  name: i18n.t('socialMedia.storyName.sidebarStory', 'Sidebar'),
  render: () => <SidebarDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('socialMedia.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <SocialMediaAppDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('socialMedia.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <SocialMediaAppDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('socialMedia.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <SocialMediaAppDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('socialMedia.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('socialMedia.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('socialMedia.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('socialMedia.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('socialMedia.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('socialMedia.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('socialMedia.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'socialMedia.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: appsMiscStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('socialMedia.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'socialMedia.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: appsMiscStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('socialMedia.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('socialMedia.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const user = createFakeUser();
  const users = createFakeUsers(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ user, users }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('socialMedia.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
