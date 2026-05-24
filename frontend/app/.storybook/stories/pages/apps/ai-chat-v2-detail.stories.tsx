import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpIcon,
  BotIcon,
  CopyIcon,
  PaperclipIcon,
  SendIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  UserIcon,
} from 'lucide-react';

import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import {
  createFakeChatMessage,
  createFakeSuggestions,
} from '@/.storybook/stories/_factories/chat.factory';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DATA
// ============================================================================

// Conversation data keys (titles/dates resolved inside component via t())
const sidebarConversationKeys = [
  { id: '1', titleKey: 'helpWithReactHooks', dateKey: 'today' },
  { id: '2', titleKey: 'cssGridLayoutTips', dateKey: 'today' },
  { id: '3', titleKey: 'typescriptGenerics', dateKey: 'yesterday' },
  { id: '4', titleKey: 'databaseOptimization', dateKey: 'yesterday' },
  { id: '5', titleKey: 'apiDesignPatterns', dateKey: 'lastWeek' },
];

const messageKeys = [
  {
    id: '1',
    role: 'user' as const,
    contentKey: 'userMsg1',
    contentDefault: 'Can you explain how React hooks work?',
  },
  {
    id: '2',
    role: 'assistant' as const,
    contentKey: 'assistantMsg1',
    contentDefault:
      'React hooks are functions that let you use state and other React features in functional components. The most common hooks are `useState` for managing state and `useEffect` for side effects. They follow two rules: only call hooks at the top level and only call hooks from React functions.',
  },
  {
    id: '3',
    role: 'user' as const,
    contentKey: 'userMsg2',
    contentDefault: 'What about custom hooks?',
  },
  {
    id: '4',
    role: 'assistant' as const,
    contentKey: 'assistantMsg2',
    contentDefault:
      'Custom hooks are JavaScript functions whose name starts with "use" that can call other hooks. They let you extract component logic into reusable functions. For example, you might create a `useFetch` hook that handles data fetching with loading and error states.',
  },
];

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function AIChatV2DetailDemo() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  const titleMap: Record<string, string> = {
    helpWithReactHooks: t('aiChatV2Detail.story.helpWithReactHooks', 'Help with React hooks'),
    cssGridLayoutTips: t('aiChatV2Detail.story.cssGridLayoutTips', 'CSS Grid layout tips'),
    typescriptGenerics: t('aiChatV2Detail.story.typescriptGenerics', 'TypeScript generics'),
    databaseOptimization: t('aiChatV2Detail.story.databaseOptimization', 'Database optimization'),
    apiDesignPatterns: t('aiChatV2Detail.story.apiDesignPatterns', 'API design patterns'),
  };

  const dateMap: Record<string, string> = {
    today: t('aiChatV2Detail.story.today', 'Today'),
    yesterday: t('aiChatV2Detail.story.yesterday', 'Yesterday'),
    lastWeek: t('aiChatV2Detail.story.lastWeek', 'Last week'),
  };

  const sidebarConversations = sidebarConversationKeys.map((conv) => ({
    id: conv.id,
    title: titleMap[conv.titleKey],
    date: dateMap[conv.dateKey],
  }));

  const messages = messageKeys.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: t(`aiChatV2Detail.story.${msg.contentKey}`, msg.contentDefault),
  }));

  return (
    <div className="flex h-[90vh] flex-col p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('aiChatV2Detail.story.title', 'AI Chat V2')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t(
            'pages.aiChatV2Detail.description',
            'Chat with an AI assistant for messaging and assistance'
          )}
        </p>
      </div>
      <div className="relative flex flex-1 overflow-hidden rounded-md border">
        {/* Sidebar */}
        <div className="hidden w-64 flex-col border-r md:flex">
          <div className="flex items-center justify-between p-4">
            <span className="text-sm font-semibold">
              {t('aiChatV2Detail.story.conversations', 'Conversations')}
            </span>
            <Button size="icon" variant="ghost">
              <ArrowUpIcon className="h-4 w-4 rotate-45" />
            </Button>
          </div>
          <Separator />
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-2">
              {sidebarConversations.map((conv) => (
                <button
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    conv.id === '1' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                  }`}
                  key={conv.id}
                  type="button"
                >
                  <div className="truncate font-medium">{conv.title}</div>
                  <div className="text-muted-foreground text-xs">{conv.date}</div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2">
              <Select defaultValue="gpt4">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt4">{t('aiChatV2Detail.story.gpt4', 'GPT-4')}</SelectItem>
                  <SelectItem value="gpt35">
                    {t('aiChatV2Detail.story.gpt35', 'GPT-3.5')}
                  </SelectItem>
                  <SelectItem value="claude">
                    {t('aiChatV2Detail.story.claude', 'Claude')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="secondary">{t('aiChatV2Detail.story.pro', 'Pro')}</Badge>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="mx-auto max-w-2xl space-y-6">
              {messages.map((msg) => (
                <div
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                  key={msg.id}
                >
                  {msg.role === 'assistant' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <BotIcon className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg p-3 text-sm ${
                      msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    {msg.content}
                    {msg.role === 'assistant' && (
                      <div className="mt-2 flex gap-1">
                        <Button size="icon" variant="ghost">
                          <CopyIcon className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost">
                          <ThumbsUpIcon className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost">
                          <ThumbsDownIcon className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <UserIcon className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="border-t p-4">
            <div className="mx-auto flex max-w-2xl gap-2">
              <Button size="icon" variant="outline">
                <PaperclipIcon className="h-4 w-4" />
              </Button>
              <Input
                onChange={(e) => setInput(e.target.value)}
                placeholder={t(
                  'aiChatV2Detail.story.typeYourMessagePlaceholder',
                  'Type your message...'
                )}
                value={input}
              />
              <Button disabled={!input.trim()} size="icon">
                <SendIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatMessageListDemo() {
  const { t } = useTranslation();

  const messages = messageKeys.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: t(`aiChatV2Detail.story.${msg.contentKey}`, msg.contentDefault),
  }));

  return (
    <div className="max-w-2xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('aiChatV2Detail.story.chatMessages', 'Chat Messages')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.map((msg) => (
            <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`} key={msg.id}>
              {msg.role === 'assistant' && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    <BotIcon className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[80%] rounded-lg p-3 text-sm ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Apps/AI Chat V2 Detail',
  component: AIChatV2DetailDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...formHandlers] },
    docs: {
      description: {
        component:
          'AI Chat V2 Detail Page - Individual conversation view with sidebar, message history, model selector, and input area.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof AIChatV2DetailDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('aiChatV2Detail.storyName.default', 'Full Page'),
  render: () => <AIChatV2DetailDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify main layout elements
    expect(canvas.getByText('AI Chat V2')).toBeInTheDocument();
    expect(canvas.getByPlaceholderText(/type your message/i)).toBeInTheDocument();

    // Verify messages rendered
    expect(canvas.getByText(/React hooks are functions/)).toBeInTheDocument();
    expect(canvas.getByText(/custom hooks/i)).toBeInTheDocument();

    // Test typing a message
    const input = canvas.getByPlaceholderText(/type your message/i);
    await userEvent.type(input, 'Hello AI');
    expect(input).toHaveValue('Hello AI');
  },
};

export const MessageList: Story = {
  name: i18n.t('aiChatV2Detail.storyName.messageList', 'Message List'),
  render: () => <ChatMessageListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvas.getByText('Chat Messages')).toBeInTheDocument();
    expect(canvas.getByText(/React hooks are functions/)).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('aiChatV2Detail.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <AIChatV2DetailDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('aiChatV2Detail.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <AIChatV2DetailDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('aiChatV2Detail.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <AIChatV2DetailDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: formStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: formStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: formStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: formStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: formStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'aiChatV2Detail.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: formStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: formStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'aiChatV2Detail.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: formStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: formStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'aiChatV2Detail.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: formStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: formStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: formStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: formStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: formStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('aiChatV2Detail.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: formStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const message = createFakeChatMessage();
  const suggestions = createFakeSuggestions();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ message, suggestions }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('aiChatV2Detail.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
