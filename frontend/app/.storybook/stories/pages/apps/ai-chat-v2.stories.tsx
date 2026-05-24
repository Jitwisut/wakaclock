import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  appsAiChatHandlers,
  appsAiChatStatusHandlers,
} from '@/.storybook/stories/_handlers/apps-ai-chat.handlers';
import {
  createFakeChatConversation,
  createFakeChatMessages,
} from '@/.storybook/stories/_factories/chat.factory';

import AIChatInterface from '@/app/dashboard/(auth)/apps/ai-chat-v2/components/ai-chat-interface';
import AIChatSidebar from '@/app/dashboard/(auth)/apps/ai-chat-v2/components/ai-chat-sidebar';
import { AIUpgradePricingModal } from '@/app/dashboard/(auth)/apps/ai-chat-v2/components/ai-upgrade-modal';
import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function AIChatV2AppDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex h-[90vh] flex-col p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('aiChatV2.story.heading', 'AI Chat V2')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t('aiChatV2.story.description', 'Advanced AI chatbot with conversation history')}
        </p>
      </div>
      <div className="relative flex flex-1 rounded-md border">
        <AIChatSidebar />
        <div className="flex w-full grow flex-col">
          <AIChatInterface />
        </div>
      </div>
    </div>
  );
}

function ChatInterfaceDemo() {
  return (
    <div className="flex h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <AIChatInterface />
      </div>
    </div>
  );
}

function SidebarDemo() {
  return (
    <div className="h-[80vh] w-80 p-4">
      <AIChatSidebar />
    </div>
  );
}

function UpgradeModalDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center p-8">
      <AIUpgradePricingModal>
        <Button>{t('aiChatV2.story.openUpgradeModal', 'Open Upgrade Modal')}</Button>
      </AIUpgradePricingModal>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Apps/AI Chat V2',
  component: AIChatV2AppDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'AI Chat V2 - Advanced AI chatbot interface with conversation history sidebar, model selection (Claude, GPT-4o, Gemini), voice input, message actions, category-based suggestions, and upgrade pricing modal.',
      },
    },
    msw: {
      handlers: appsAiChatHandlers,
    },
  },
  argTypes: {},
} satisfies Meta<typeof AIChatV2AppDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('aiChatV2.storyName.default', 'Full App'),
  render: () => <AIChatV2AppDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify page renders with heading
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const ChatInterfaceStory: Story = {
  name: i18n.t('aiChatV2.storyName.chatInterfaceStory', 'Chat Interface'),
  render: () => <ChatInterfaceDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const SidebarStory: Story = {
  name: i18n.t('aiChatV2.storyName.sidebarStory', 'Sidebar'),
  render: () => <SidebarDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const UpgradeModalStory: Story = {
  name: i18n.t('aiChatV2.storyName.upgradeModalStory', 'Upgrade Modal'),
  render: () => <UpgradeModalDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('aiChatV2.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <AIChatV2AppDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('aiChatV2.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <AIChatV2AppDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('aiChatV2.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <AIChatV2AppDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('aiChatV2.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('aiChatV2.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('aiChatV2.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('aiChatV2.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('aiChatV2.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: appsAiChatStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('aiChatV2.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: appsAiChatStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('aiChatV2.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: appsAiChatStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('aiChatV2.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: appsAiChatStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('aiChatV2.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: appsAiChatStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('aiChatV2.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: appsAiChatStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('aiChatV2.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: appsAiChatStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('aiChatV2.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: appsAiChatStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('aiChatV2.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: appsAiChatStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const conversation = createFakeChatConversation();
  const messages = createFakeChatMessages(5);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ conversation, messages }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('aiChatV2.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
