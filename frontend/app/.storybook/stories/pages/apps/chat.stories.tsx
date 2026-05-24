import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  appsChatHandlers,
  appsChatStatusHandlers,
} from '@/.storybook/stories/_handlers/apps-chat.handlers';
import {
  createFakeChatConversations,
  createFakeChatMessage,
} from '@/.storybook/stories/_factories/chat.factory';

import { ChatContent, ChatSidebar } from '@/app/dashboard/(auth)/apps/chat/components';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Mock chat data for stories
const mockChats = [
  {
    id: 1,
    user_id: 1,
    user: {
      id: 1,
      name: i18n.t('chat.story.userJohnDoe', 'John Doe'),
      avatar: 'https://i.pravatar.cc/150?u=1',
      status: 'online' as const,
      email: 'john@example.com',
      phone: '+1 234 567 890',
    },
    last_message: i18n.t('chat.story.messageHowAreYou', 'Hey, how are you doing?'),
    last_message_time: '2:30 PM',
    unread_count: 2,
    messages: [],
  },
  {
    id: 2,
    user_id: 2,
    user: {
      id: 2,
      name: i18n.t('chat.story.userJaneSmith', 'Jane Smith'),
      avatar: 'https://i.pravatar.cc/150?u=2',
      status: 'offline' as const,
      email: 'jane@example.com',
      phone: '+1 234 567 891',
    },
    last_message: i18n.t('chat.story.messageSeeYouTomorrow', 'See you tomorrow!'),
    last_message_time: i18n.t('chat.story.timeYesterday', 'Yesterday'),
    unread_count: 0,
    messages: [],
  },
  {
    id: 3,
    user_id: 3,
    user: {
      id: 3,
      name: i18n.t('chat.story.userBobWilson', 'Bob Wilson'),
      avatar: 'https://i.pravatar.cc/150?u=3',
      status: 'away' as const,
      email: 'bob@example.com',
      phone: '+1 234 567 892',
    },
    last_message: i18n.t('chat.story.messageProjectReady', 'The project is ready for review'),
    last_message_time: i18n.t('chat.story.timeMonday', 'Monday'),
    unread_count: 5,
    messages: [],
  },
];

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function ChatAppDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex h-[90vh] flex-col p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('chat.story.chatApp', 'Chat App')}</h1>
        <p className="text-muted-foreground text-sm">
          {t('chat.story.messagingPlatform', 'Messaging and communication platform')}
        </p>
      </div>
      <div className="flex flex-1 overflow-hidden rounded-md border">
        <ChatSidebar chats={mockChats} />
        <div className="grow">
          <ChatContent />
        </div>
      </div>
    </div>
  );
}

function SidebarDemo() {
  return (
    <div className="h-[80vh] w-80 p-4">
      <ChatSidebar chats={mockChats} />
    </div>
  );
}

function ContentDemo() {
  return (
    <div className="flex h-[80vh] items-center justify-center p-4">
      <div className="h-full w-full max-w-2xl rounded-md border">
        <ChatContent />
      </div>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Apps/Chat',
  component: ChatAppDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Chat App - Full-featured messaging application with contact sidebar, message threads, chat bubbles, user detail sheets, audio/video call dialogs, and real-time status indicators.',
      },
    },
    msw: {
      handlers: appsChatHandlers,
    },
  },
  argTypes: {},
} satisfies Meta<typeof ChatAppDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('chat.storyName.default', 'Full App'),
  render: () => <ChatAppDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify page renders with heading
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const SidebarStory: Story = {
  name: i18n.t('chat.storyName.sidebarStory', 'Chat Sidebar'),
  render: () => <SidebarDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const ContentStory: Story = {
  name: i18n.t('chat.storyName.contentStory', 'Chat Content'),
  render: () => <ContentDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('chat.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <ChatAppDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('chat.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <ChatAppDemo />,
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
  name: i18n.t('chat.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <ChatAppDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('chat.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('chat.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('chat.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('chat.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('chat.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: appsChatStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('chat.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: appsChatStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('chat.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: appsChatStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('chat.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: appsChatStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('chat.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: appsChatStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('chat.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: appsChatStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('chat.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: appsChatStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('chat.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: appsChatStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const message = createFakeChatMessage();
  const conversations = createFakeChatConversations(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ message, conversations }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('chat.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('chat.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: appsChatStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
