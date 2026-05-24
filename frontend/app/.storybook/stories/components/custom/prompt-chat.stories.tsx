import type { Meta, StoryObj } from '@storybook/react';
import { faker } from '@faker-js/faker';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { AlertCircleIcon, CopyIcon, SendIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { chatHandlers, chatStatusHandlers } from '@/.storybook/stories/_handlers/chat.handlers';
import { promptChatStatusHandlers } from '@/.storybook/stories/_handlers/prompt-chat.handlers';
import type {
  ChatMessageRole,
  ChatMessageStatus,
  FakeChatUser,
} from '@/.storybook/stories/_factories/prompt-chat.factory';
import {
  CHAT_ASSISTANT_RESPONSES,
  CHAT_MESSAGE_ROLES,
  CHAT_MESSAGE_STATUSES,
  CHAT_USER_MESSAGES,
  createFakeAssistantMessage,
  createFakeChatThread,
  createFakeChatUser,
  createFakeUserMessage,
} from '@/.storybook/stories/_factories/prompt-chat.factory';
import {
  type ChatRole,
  createFakeChatConversation,
  createFakeChatConversations,
  createFakeChatHistory,
  createFakeChatMessage,
  createFakeChatMessages,
  createFakeChatResponse,
  createFakeCodeBlock,
  createFakeCodeBlocks,
  createFakePromptTemplate,
  createFakePromptTemplates,
  createFakeStreamChunks,
  createFakeSuggestion,
  createFakeSuggestions,
  type FakeChatConversation,
  type FakeChatMessage,
  type FakeChatResponse,
  type FakeCodeBlock,
  type FakePromptTemplate,
  type FakeStreamChunk,
  type FakeSuggestion,
} from '@/.storybook/stories/_factories/chat.factory';

import { Button } from '@/components/ui/button';
import { ChatContainer } from '@/components/ui/custom/prompt/chat-container';
import {
  Input as PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/custom/prompt/input';
import { PromptLoader } from '@/components/ui/custom/prompt/loader';
import { Markdown } from '@/components/ui/custom/prompt/markdown';
import {
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
  MessageContent,
} from '@/components/ui/custom/prompt/message';
import { Suggestion } from '@/components/ui/custom/prompt/suggestion';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

type ChatMessage = {
  content: string;
  id: string;
  markdown?: boolean;
  role: 'assistant' | 'user';
};

function PromptChatDemo() {
  const { t } = useTranslation();
  const initialMessages = React.useMemo<ChatMessage[]>(
    () => [
      {
        id: 'm1',
        role: 'assistant',
        markdown: true,
        content: t('promptChat.initial.assistantIntro'),
      },
      { id: 'm2', role: 'user', content: t('promptChat.initial.userShowStyles') },
      {
        id: 'm3',
        role: 'assistant',
        markdown: true,
        content: t('promptChat.initial.assistantMarkdownNote'),
      },
    ],
    [t]
  );

  const idCounterRef = React.useRef(3);
  const responseTimeoutRef = React.useRef<number | null>(null);

  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [value, setValue] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    setMessages(initialMessages);
    idCounterRef.current = 3;
  }, [initialMessages]);

  React.useEffect(
    () => () => {
      if (responseTimeoutRef.current === null) return;
      window.clearTimeout(responseTimeoutRef.current);
    },
    []
  );

  const submit = () => {
    const next = value.trim();
    if (!next || isLoading) return;

    idCounterRef.current += 1;
    const userId = `u-${idCounterRef.current}`;

    setMessages((prev) => [...prev, { id: userId, role: 'user', content: next }]);
    setValue('');
    setIsLoading(true);

    if (responseTimeoutRef.current !== null) {
      window.clearTimeout(responseTimeoutRef.current);
    }

    responseTimeoutRef.current = window.setTimeout(() => {
      idCounterRef.current += 1;
      const assistantId = `a-${idCounterRef.current}`;

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          markdown: true,
          content: t('promptChat.response.echo', { message: next }),
        },
      ]);
      setIsLoading(false);
      responseTimeoutRef.current = null;
    }, 200);
  };

  return (
    <div className="w-full max-w-3xl space-y-3">
      <div className="h-[380px] rounded-xl border p-4">
        <ChatContainer className="h-full gap-5">
          {messages.map((m) => (
            <Message className={m.role === 'user' ? 'justify-end' : 'justify-start'} key={m.id}>
              {m.role === 'assistant' ? (
                <MessageAvatar
                  alt={t('promptChat.avatar.assistant')}
                  fallback="AI"
                  src="/images/avatars/05.png"
                />
              ) : null}

              <div className="max-w-[80%] space-y-2">
                {m.markdown ? (
                  <MessageContent markdown className="prose-sm">
                    {m.content}
                  </MessageContent>
                ) : (
                  <MessageContent
                    className={m.role === 'user' ? 'bg-primary text-primary-foreground' : undefined}
                  >
                    {m.content}
                  </MessageContent>
                )}

                {m.role === 'assistant' ? (
                  <MessageActions className="pl-1">
                    <MessageAction tooltip={t('promptChat.action.copyTooltip')}>
                      <Button
                        aria-label={t('promptChat.action.copyMessage')}
                        onClick={() =>
                          void navigator.clipboard?.writeText(m.content)?.catch(() => {})
                        }
                        size="icon"
                        variant="ghost"
                      >
                        <CopyIcon />
                      </Button>
                    </MessageAction>
                  </MessageActions>
                ) : null}
              </div>

              {m.role === 'user' ? (
                <MessageAvatar
                  alt={t('promptChat.avatar.user')}
                  fallback="U"
                  src="/images/avatars/01.png"
                />
              ) : null}
            </Message>
          ))}

          {isLoading ? (
            <Message className="justify-start">
              <MessageAvatar alt="Assistant" fallback="AI" src="/images/avatars/05.png" />
              <div className="bg-secondary rounded-lg p-4">
                <PromptLoader variant="typing" />
              </div>
            </Message>
          ) : null}
        </ChatContainer>
      </div>

      <div className="flex flex-wrap gap-2">
        <Suggestion onClick={() => setValue(t('promptChat.suggestion.summarizePrompt'))}>
          {t('promptChat.suggestion.summarize')}
        </Suggestion>
        <Suggestion
          highlight="theme"
          onClick={() => setValue(t('promptChat.suggestion.explainThemePrompt'))}
        >
          {t('promptChat.suggestion.explainTheme')}
        </Suggestion>
        <Suggestion onClick={() => setValue(t('promptChat.suggestion.listComponentsPrompt'))}>
          {t('promptChat.suggestion.listComponents')}
        </Suggestion>
      </div>

      <PromptInput isLoading={isLoading} onSubmit={submit} onValueChange={setValue} value={value}>
        <PromptInputTextarea disabled={isLoading} placeholder={t('promptChat.input.placeholder')} />
        <PromptInputActions className="justify-end">
          <PromptInputAction tooltip={t('promptChat.action.send')}>
            <Button
              aria-label={t('promptChat.action.send')}
              disabled={!value.trim() || isLoading}
              onClick={submit}
              size="icon"
              type="button"
            >
              <SendIcon />
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>

      <div className="text-muted-foreground text-xs">
        {t('promptChat.markdownDemo.label')}
        <Markdown className="mt-2 rounded-md border p-3" id="markdown-demo">
          {t('promptChat.markdownDemo.content')}
        </Markdown>
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Prompt Chat',
  component: PromptChatDemo,
  tags: ['autodocs'],
  args: {
    onSend: fn(),
    onSuggestionClick: fn(),
    onCopyMessage: fn(),
  },
  parameters: {
    msw: {
      handlers: chatHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Events
    onSend: {
      action: 'onSend',
      description: i18n.t(
        'promptChat.argType.calledWhenAMessageIsSent',
        'Called when a message is sent'
      ),
      table: { category: 'Events' },
    },
    onSuggestionClick: {
      action: 'onSuggestionClick',
      description: i18n.t(
        'promptChat.argType.calledWhenASuggestionIsClicked',
        'Called when a suggestion is clicked'
      ),
      table: { category: 'Events' },
    },
    onCopyMessage: {
      action: 'onCopyMessage',
      description: i18n.t(
        'promptChat.argType.calledWhenAMessageIsCopied',
        'Called when a message is copied'
      ),
      table: { category: 'Events' },
    },
    // Prompt Chat System Props Reference:
    //
    // ChatContainer Props:
    // - className: Additional CSS classes (string)
    // - children: Message components (ReactNode)
    // Note: Scrollable container for chat messages
    //
    // PromptInput Props:
    // - value: Current input value (string)
    // - onValueChange: Value change handler ((value: string) => void)
    // - onSubmit: Submit handler (() => void)
    // - isLoading: Disable input during loading (boolean)
    // - children: PromptInputTextarea and PromptInputActions (ReactNode)
    //
    // PromptInputTextarea Props:
    // - placeholder: Placeholder text (string)
    // - disabled: Disable input (boolean)
    // - ...rest: Standard textarea props
    //
    // PromptInputActions / PromptInputAction Props:
    // - tooltip: Tooltip text for action button (string)
    // - className: Additional CSS classes (string)
    //
    // Message Props:
    // - className: Additional CSS classes (string)
    // - children: MessageAvatar, MessageContent, MessageActions (ReactNode)
    //
    // MessageContent Props:
    // - markdown: Render content as markdown (boolean)
    // - className: Additional CSS classes (string)
    // - children: Message text content (ReactNode)
    //
    // MessageAvatar Props:
    // - src: Avatar image URL (string)
    // - alt: Avatar alt text (string)
    // - fallback: Fallback text when image fails (string)
    //
    // MessageActions / MessageAction Props:
    // - tooltip: Tooltip text for action (string)
    // - className: Additional CSS classes (string)
    //
    // Suggestion Props:
    // - onClick: Click handler (() => void)
    // - highlight: Text to highlight in suggestion (string)
    // - children: Suggestion text (ReactNode)
    //
    // Markdown Props:
    // - className: Additional CSS classes (string)
    // - children: Markdown content string (string)
    // Note: Renders markdown with syntax highlighting
    //
    // Usage Notes:
    // - Complete chat UI with messages, input, and suggestions
    // - Supports markdown rendering for AI responses
    // - Message actions for copy, regenerate, etc.
    // - Suggestion chips for quick prompts
    // - Loading state with PromptLoader
  },
} satisfies Meta<typeof PromptChatDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============================================================================
// DEFAULT STORIES
// ============================================================================

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const root = within(document.body);

    expect(canvas.getByText('Ask me anything.')).toBeInTheDocument();

    const textarea = canvas.getByPlaceholderText('Type a message…');
    await userEvent.type(textarea, 'Hello from Storybook');

    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    expect(canvas.getByRole('button', { name: 'Send' })).toBeDisabled();

    await waitFor(() => {
      expect(canvas.getByText('Hello from Storybook')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(canvas.getByText('You said:')).toBeInTheDocument();
    });

    const copyButtons = canvas.getAllByRole('button', { name: 'Copy message' });
    await userEvent.hover(copyButtons[0]);
    expect(await root.findByText('Copy')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByPlaceholderText('Type a message…')).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('promptChat.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText('何でも聞いてください。')).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: '送信' })).toBeInTheDocument();
    expect(canvas.getByText('Markdown レンダラーのデモ:')).toBeInTheDocument();
  },
};

// ============================================================================
// VARIANT STORIES (Dark, RTL, Japanese)
// ============================================================================

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Ask me anything.')).toBeInTheDocument();
    expect(canvas.getByPlaceholderText('Type a message…')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Ask me anything.')).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  },
};

export const DesignReference: Story = {
  ...Default,
  tags: ['!test'],
  parameters: {
    ...(Default.parameters ?? {}),
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('promptChat.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-wrap items-center gap-3">
        <div id="hover">
          <Story />
        </div>
        <div id="focus">
          <Story />
        </div>
        <div id="active">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover *'],
      focusVisible: ['#focus *'],
      active: ['#active *'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ MSW + FAKER STORIES ============

// Demo component that uses API for chat history
function ChatWithApiDemo() {
  const [messages, setMessages] = React.useState<FakeChatMessage[]>([]);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<{ message: string; status: number } | null>(null);
  const [value, setValue] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([fetch('/api/chat/history'), fetch('/api/chat/suggestions')])
      .then(async ([historyRes, suggestionsRes]) => {
        if (!historyRes.ok) {
          const err = (await historyRes.json()) as { message?: string; status?: number };
          const error = new Error(err.message ?? 'Failed to load chat');
          (error as { status: number } & Error).status = historyRes.status;
          throw error;
        }
        const historyData = (await historyRes.json()) as { messages: FakeChatMessage[] };
        const suggestionsData = suggestionsRes.ok
          ? ((await suggestionsRes.json()) as { suggestions: { text: string }[] })
          : { suggestions: [] };

        setMessages(historyData.messages);
        setSuggestions(suggestionsData.suggestions.map((s) => s.text));
        setLoading(false);
        return undefined;
      })
      .catch((error_: { status?: number } & Error) => {
        setError({ message: error_.message, status: error_.status ?? 500 });
        setLoading(false);
      });
  }, []);

  const handleSend = async () => {
    if (!value.trim() || isSending) return;

    const userMessage: FakeChatMessage = {
      id: faker.string.uuid(),
      role: 'user',
      content: value,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setValue('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: value }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message ?? 'Failed to send message');
      }

      const data = (await response.json()) as FakeChatMessage;
      setMessages((prev) => [...prev, data]);
    } catch (error_) {
      setMessages((prev) => [
        ...prev,
        {
          id: faker.string.uuid(),
          role: 'assistant',
          content: `Error: ${error_ instanceof Error ? error_.message : 'Unknown error'}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-3xl space-y-3" data-state="loading">
        <div className="flex h-[380px] items-center justify-center rounded-xl border p-4">
          <PromptLoader variant="typing" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="w-full max-w-3xl space-y-3"
        data-state="error"
        data-error-status={error.status}
      >
        <div className="flex h-[380px] items-center justify-center rounded-xl border p-4">
          <div className="space-y-2 text-center">
            <AlertCircleIcon className="text-destructive mx-auto size-8" />
            <p className="text-destructive font-medium">
              {i18n.t('promptChat.story.error', 'Error')} {error.status}
            </p>
            <p className="text-muted-foreground text-sm">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl space-y-3" data-state="success">
      <div className="h-[380px] rounded-xl border p-4">
        <ChatContainer className="h-full gap-5">
          {messages.map((m) => (
            <Message className={m.role === 'user' ? 'justify-end' : 'justify-start'} key={m.id}>
              {m.role === 'assistant' && (
                <MessageAvatar alt="Assistant" fallback="AI" src="/images/avatars/05.png" />
              )}
              <div className="max-w-[80%] space-y-2">
                <MessageContent
                  className={m.role === 'user' ? 'bg-primary text-primary-foreground' : undefined}
                >
                  {m.content}
                </MessageContent>
                {m.role === 'assistant' && (
                  <MessageActions className="pl-1">
                    <MessageAction tooltip={i18n.t('promptChat.story.copy', 'Copy')}>
                      <Button
                        aria-label={i18n.t('promptChat.story.copyMessage', 'Copy message')}
                        onClick={() =>
                          void navigator.clipboard?.writeText(m.content)?.catch(() => {})
                        }
                        size="icon"
                        variant="ghost"
                      >
                        <CopyIcon />
                      </Button>
                    </MessageAction>
                  </MessageActions>
                )}
              </div>
              {m.role === 'user' && (
                <MessageAvatar alt="User" fallback="U" src="/images/avatars/01.png" />
              )}
            </Message>
          ))}
          {isSending && (
            <Message className="justify-start">
              <MessageAvatar alt="Assistant" fallback="AI" src="/images/avatars/05.png" />
              <div className="bg-secondary rounded-lg p-4">
                <PromptLoader variant="typing" />
              </div>
            </Message>
          )}
        </ChatContainer>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <Suggestion key={s} onClick={() => setValue(s)}>
              {s}
            </Suggestion>
          ))}
        </div>
      )}

      <PromptInput
        isLoading={isSending}
        onSubmit={handleSend}
        onValueChange={setValue}
        value={value}
      >
        <PromptInputTextarea
          disabled={isSending}
          placeholder={i18n.t('promptChat.story.typeAMessage', 'Type a message…')}
        />
        <PromptInputActions className="justify-end">
          <PromptInputAction tooltip={i18n.t('promptChat.story.send', 'Send')}>
            <Button
              aria-label={i18n.t('promptChat.story.send', 'Send')}
              disabled={!value.trim() || isSending}
              onClick={handleSend}
              size="icon"
              type="button"
            >
              <SendIcon />
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    </div>
  );
}

// Demo component with Faker-generated static data
function ChatWithFakerDemo() {
  const messages = React.useMemo(() => createFakeChatHistory(6), []);
  const suggestions = React.useMemo(() => createFakeSuggestions(3), []);

  return (
    <div className="w-full max-w-3xl space-y-3">
      <div className="h-[380px] rounded-xl border p-4">
        <ChatContainer className="h-full gap-5">
          {messages.map((m) => (
            <Message className={m.role === 'user' ? 'justify-end' : 'justify-start'} key={m.id}>
              {m.role === 'assistant' && (
                <MessageAvatar alt="Assistant" fallback="AI" src="/images/avatars/05.png" />
              )}
              <div className="max-w-[80%] space-y-2">
                <MessageContent
                  className={m.role === 'user' ? 'bg-primary text-primary-foreground' : undefined}
                >
                  {m.content}
                </MessageContent>
              </div>
              {m.role === 'user' && (
                <MessageAvatar alt="User" fallback="U" src="/images/avatars/01.png" />
              )}
            </Message>
          ))}
        </ChatContainer>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <Suggestion key={s.id} onClick={() => {}}>
            {s.text}
          </Suggestion>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// FACTORY & MSW STORIES
// ============================================================================

export const WithFakerData: Story = {
  render: () => <ChatWithFakerDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const messages = canvasElement.querySelectorAll('[data-slot="message"]');
      expect(messages.length).not.toBe(0);
    });
  },
};

export const WithApiData: Story = {
  parameters: {
    msw: {
      handlers: chatHandlers,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-state="success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: chatStatusHandlers.loading,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-state="loading"]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  parameters: {
    msw: {
      handlers: chatStatusHandlers.unauthorized,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="401"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  parameters: {
    msw: {
      handlers: chatStatusHandlers.tooManyRequests,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="429"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error500InternalServerError: Story = {
  parameters: {
    msw: {
      handlers: chatStatusHandlers.internalServerError,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="500"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  parameters: {
    msw: {
      handlers: chatStatusHandlers.serviceUnavailable,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="503"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const EmptyHistory: Story = {
  parameters: {
    msw: {
      handlers: chatStatusHandlers.emptyHistory,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-state="success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    const messages = canvasElement.querySelectorAll('[data-slot="message"]');
    expect(messages.length).toBe(0);
  },
};

export const LongConversation: Story = {
  parameters: {
    msw: {
      handlers: chatStatusHandlers.longConversation,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const messages = canvasElement.querySelectorAll('[data-slot="message"]');
        expect(messages.length).toBeGreaterThan(10);
      },
      { timeout: 3000 }
    );
  },
};

// ============ ENTERPRISE STORY EXPORTS ============

export const Variants: Story = {
  ...Default,
  name: i18n.t('promptChat.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-8">
        <div>
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {i18n.t('promptChat.story.defaultChat', 'Default Chat')}
          </h3>
          <Story />
        </div>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Default Chat')).toBeInTheDocument();
    expect(canvas.getByPlaceholderText('Type a message…')).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  ...Default,
  name: i18n.t('promptChat.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-8">
        <div className="max-w-sm">
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {i18n.t('promptChat.story.smallContainer', 'Small Container')}
          </h3>
          <Story />
        </div>
        <div className="max-w-2xl">
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {i18n.t('promptChat.story.mediumContainer', 'Medium Container')}
          </h3>
          <Story />
        </div>
        <div className="max-w-4xl">
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {i18n.t('promptChat.story.largeContainer', 'Large Container')}
          </h3>
          <Story />
        </div>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Small Container')).toBeInTheDocument();
    expect(canvas.getByText('Medium Container')).toBeInTheDocument();
    expect(canvas.getByText('Large Container')).toBeInTheDocument();
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Ask me anything.')).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  parameters: {
    msw: {
      handlers: chatStatusHandlers.networkError,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-state="success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Accessibility: Story = {
  name: i18n.t('promptChat.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test keyboard navigation to textarea
    const textarea = canvas.getByPlaceholderText('Type a message…');
    expect(textarea).toBeInTheDocument();
    await userEvent.tab();

    // Verify send button has accessible name
    const sendButton = canvas.getByRole('button', { name: 'Send' });
    expect(sendButton).toBeInTheDocument();
    expect(sendButton.getAttribute('aria-label')).toBe('Send');

    // Verify copy buttons have accessible names
    const copyButtons = canvas.getAllByRole('button', { name: 'Copy message' });
    expect(copyButtons.length).not.toBe(0);
    copyButtons.forEach((button) => {
      expect(button).toHaveAttribute('aria-label');
    });

    // Test keyboard navigation through suggestions
    const suggestions = canvas.getAllByTestId('prompt-suggestion');
    expect(suggestions.length).not.toBe(0);

    // Verify avatars have alt text
    const avatarImages = canvasElement.querySelectorAll('img[alt]');
    avatarImages.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });

    // Verify markdown demo has id for aria-describedby
    expect(canvas.getByText('Markdown renderer demo:')).toBeInTheDocument();
  },
};

// ============ ADDITIONAL MSW STATUS STORIES ============

export const EmptyData: Story = {
  name: i18n.t('promptChat.storyName.emptyData', 'Empty (no messages)'),
  parameters: {
    msw: {
      handlers: chatStatusHandlers.emptyHistory,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-state="success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const SlowResponse: Story = {
  name: i18n.t('promptChat.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: {
      handlers: chatStatusHandlers.slowResponse,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-state="loading"]')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('promptChat.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: {
      handlers: chatStatusHandlers.badRequest,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="400"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('promptChat.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: {
      handlers: chatStatusHandlers.forbidden,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="403"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t('promptChat.storyName.error422UnprocessableEntity', 'Error 422: Validation Error'),
  parameters: {
    msw: {
      handlers: chatStatusHandlers.unprocessableEntity,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="422"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerErrorAlt: Story = {
  name: i18n.t(
    'promptChat.storyName.error500InternalServerErrorAlt',
    'Error 500: Internal Error (Alt)'
  ),
  parameters: {
    msw: {
      handlers: chatStatusHandlers.internalServerError,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="500"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('promptChat.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: {
      handlers: chatStatusHandlers.badGateway,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="502"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('promptChat.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: {
      handlers: chatStatusHandlers.gatewayTimeout,
    },
  },
  render: () => <ChatWithApiDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="504"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ FACTORY COVERAGE STORIES ============

// Helper to get avatar fallback without nested ternaries
function getRoleFallback(role: ChatRole): string {
  const fallbacks: Record<ChatRole, string> = { user: 'U', assistant: 'AI', system: 'S' };
  return fallbacks[role];
}

// Demo: Single message with ChatRole and metadata
function SingleMessageDemo() {
  const roles: ChatRole[] = ['user', 'assistant', 'system'];
  const messages = React.useMemo(
    () => roles.map((role) => createFakeChatMessage(role)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="w-full max-w-3xl space-y-4" data-testid="single-message-demo">
      <h3 className="text-sm font-medium">{i18n.t('promptChat.singleMessage.title')}</h3>
      <ChatContainer className="gap-4">
        {messages.map((m: FakeChatMessage) => (
          <Message className={m.role === 'user' ? 'justify-end' : 'justify-start'} key={m.id}>
            <MessageAvatar
              alt={m.role}
              fallback={getRoleFallback(m.role as ChatRole)}
              src={m.role === 'user' ? '/images/avatars/01.png' : '/images/avatars/05.png'}
            />
            <div className="max-w-[80%] space-y-1">
              <p className="text-muted-foreground text-xs">
                {i18n.t('promptChat.message.role')}:{' '}
                {m.role === 'system' ? i18n.t('promptChat.message.system') : m.role}
              </p>
              <MessageContent>{m.content}</MessageContent>
              {m.metadata ? (
                <div className="text-muted-foreground flex gap-3 text-xs">
                  <span>
                    {i18n.t('promptChat.metadata.model')}: {m.metadata.model}
                  </span>
                  <span>
                    {i18n.t('promptChat.metadata.tokens')}: {m.metadata.tokens}
                  </span>
                  <span>
                    {i18n.t('promptChat.metadata.latency')}: {m.metadata.latency}ms
                  </span>
                </div>
              ) : null}
            </div>
          </Message>
        ))}
      </ChatContainer>
    </div>
  );
}

export const SingleMessage: Story = {
  name: i18n.t('promptChat.storyName.singleMessage', 'Single Message (ChatRole)'),
  render: () => <SingleMessageDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('single-message-demo')).toBeInTheDocument();
    // Verify all three roles rendered
    const messages = canvasElement.querySelectorAll('[data-slot="message"]');
    expect(messages.length).toBe(3);
  },
};

// Demo: Chat messages alias (createFakeChatMessages)
function ChatMessagesAliasDemo() {
  const messages = React.useMemo(() => createFakeChatMessages(4), []);

  return (
    <div className="w-full max-w-3xl space-y-3" data-testid="chat-messages-alias-demo">
      <h3 className="text-sm font-medium">
        {i18n.t('promptChat.conversationList.title')} ({messages.length})
      </h3>
      <div className="h-[300px] rounded-xl border p-4">
        <ChatContainer className="h-full gap-4">
          {messages.map((m: FakeChatMessage) => (
            <Message className={m.role === 'user' ? 'justify-end' : 'justify-start'} key={m.id}>
              <MessageAvatar
                alt={m.role}
                fallback={m.role === 'user' ? 'U' : 'AI'}
                src={m.role === 'user' ? '/images/avatars/01.png' : '/images/avatars/05.png'}
              />
              <div className="max-w-[80%]">
                <MessageContent
                  className={m.role === 'user' ? 'bg-primary text-primary-foreground' : undefined}
                >
                  {m.content}
                </MessageContent>
              </div>
            </Message>
          ))}
        </ChatContainer>
      </div>
    </div>
  );
}

export const WithChatMessagesAlias: Story = {
  name: i18n.t('promptChat.storyName.withChatMessagesAlias', 'Chat Messages (alias)'),
  render: () => <ChatMessagesAliasDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chat-messages-alias-demo')).toBeInTheDocument();
    const messages = canvasElement.querySelectorAll('[data-slot="message"]');
    expect(messages.length).toBe(4);
  },
};

// Demo: Single suggestion
function SingleSuggestionDemo() {
  const suggestion: FakeSuggestion = React.useMemo(() => createFakeSuggestion(), []);
  const [value, setValue] = React.useState('');

  return (
    <div className="w-full max-w-3xl space-y-3" data-testid="single-suggestion-demo">
      <h3 className="text-sm font-medium">{i18n.t('promptChat.suggestion.summarize')}</h3>
      <div className="flex items-center gap-2">
        <Suggestion onClick={() => setValue(suggestion.text)}>{suggestion.text}</Suggestion>
        <span className="text-muted-foreground text-xs">({suggestion.category})</span>
      </div>
      {value ? (
        <p className="text-muted-foreground text-sm" data-testid="selected-suggestion">
          {value}
        </p>
      ) : null}
    </div>
  );
}

export const WithSingleSuggestion: Story = {
  name: i18n.t('promptChat.storyName.withSingleSuggestion', 'Single Suggestion'),
  render: () => <SingleSuggestionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('single-suggestion-demo')).toBeInTheDocument();
    const suggestion = canvasElement.querySelector('[data-testid="prompt-suggestion"]');
    expect(suggestion).toBeInTheDocument();
    if (suggestion) {
      await userEvent.click(suggestion);
    }
    await waitFor(() => {
      expect(canvas.getByTestId('selected-suggestion')).toBeInTheDocument();
    });
  },
};

// Demo: Conversation detail
function ConversationDetailDemo() {
  const conversation: FakeChatConversation = React.useMemo(() => createFakeChatConversation(4), []);

  return (
    <div className="w-full max-w-3xl space-y-3" data-testid="conversation-detail-demo">
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold">{i18n.t('promptChat.conversation.title')}</h3>
        <p className="text-sm">{conversation.title}</p>
        <div className="text-muted-foreground mt-2 space-y-1 text-xs">
          <p>
            {i18n.t('promptChat.conversation.model')}: {conversation.model}
          </p>
          <p>
            {i18n.t('promptChat.conversation.messageCount', {
              count: conversation.messages.length,
            })}
          </p>
          <p>
            {i18n.t('promptChat.conversation.created')}:{' '}
            {new Date(conversation.createdAt).toLocaleDateString()}
          </p>
          <p>
            {i18n.t('promptChat.conversation.updated')}:{' '}
            {new Date(conversation.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="h-[250px] rounded-xl border p-4">
        <ChatContainer className="h-full gap-4">
          {conversation.messages.map((m: FakeChatMessage) => (
            <Message className={m.role === 'user' ? 'justify-end' : 'justify-start'} key={m.id}>
              <MessageAvatar
                alt={m.role}
                fallback={m.role === 'user' ? 'U' : 'AI'}
                src={m.role === 'user' ? '/images/avatars/01.png' : '/images/avatars/05.png'}
              />
              <div className="max-w-[80%]">
                <MessageContent>{m.content}</MessageContent>
              </div>
            </Message>
          ))}
        </ChatContainer>
      </div>
    </div>
  );
}

export const WithConversationDetail: Story = {
  name: i18n.t('promptChat.storyName.withConversationDetail', 'Conversation Detail'),
  render: () => <ConversationDetailDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('conversation-detail-demo')).toBeInTheDocument();
    expect(canvas.getByText(/Model:/i)).toBeInTheDocument();
    const messages = canvasElement.querySelectorAll('[data-slot="message"]');
    expect(messages.length).toBe(4);
  },
};

// Demo: Conversation list
function ConversationListDemo() {
  const conversations: FakeChatConversation[] = React.useMemo(
    () => createFakeChatConversations(3),
    []
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="w-full max-w-3xl space-y-3" data-testid="conversation-list-demo">
      <h3 className="text-sm font-medium">{i18n.t('promptChat.conversationList.title')}</h3>
      <div className="space-y-2">
        {conversations.map((c) => (
          <button
            className="hover:bg-accent w-full rounded-lg border p-3 text-left transition-colors"
            data-testid="conversation-item"
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            type="button"
          >
            <p className="text-sm font-medium">{c.title}</p>
            <p className="text-muted-foreground text-xs">
              {c.model} -{' '}
              {i18n.t('promptChat.conversation.messageCount', { count: c.messages.length })}
            </p>
          </button>
        ))}
      </div>
      {selected ? (
        <div className="h-[200px] rounded-xl border p-4" data-testid="conversation-preview">
          <ChatContainer className="h-full gap-3">
            {selected.messages.slice(0, 3).map((m: FakeChatMessage) => (
              <Message className={m.role === 'user' ? 'justify-end' : 'justify-start'} key={m.id}>
                <div className="max-w-[80%]">
                  <MessageContent>{m.content}</MessageContent>
                </div>
              </Message>
            ))}
          </ChatContainer>
        </div>
      ) : null}
    </div>
  );
}

export const WithConversationList: Story = {
  name: i18n.t('promptChat.storyName.withConversationList', 'Conversation List'),
  render: () => <ConversationListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('conversation-list-demo')).toBeInTheDocument();
    const items = canvas.getAllByTestId('conversation-item');
    expect(items.length).toBe(3);
    // Click first conversation
    await userEvent.click(items[0]);
    await waitFor(() => {
      expect(canvas.getByTestId('conversation-preview')).toBeInTheDocument();
    });
  },
};

// Demo: Stream chunks
function StreamChunksDemo() {
  const sampleText = i18n.t('promptChat.story.sampleStreamingText');
  const chunks: FakeStreamChunk[] = React.useMemo(
    () => createFakeStreamChunks(sampleText),
    [sampleText]
  );
  const [visibleChunks, setVisibleChunks] = React.useState(0);
  const [isStreaming, setIsStreaming] = React.useState(false);

  const startStream = React.useCallback(() => {
    setVisibleChunks(0);
    setIsStreaming(true);
    let i = 0;
    const interval = window.setInterval(() => {
      i += 1;
      setVisibleChunks(i);
      if (i >= chunks.length) {
        window.clearInterval(interval);
        setIsStreaming(false);
      }
    }, 150);
  }, [chunks.length]);

  const displayedText = chunks
    .slice(0, visibleChunks)
    .map((c) => c.delta)
    .join('');
  const lastChunk = visibleChunks > 0 ? chunks[visibleChunks - 1] : null;

  return (
    <div className="w-full max-w-3xl space-y-3" data-testid="stream-chunks-demo">
      <h3 className="text-sm font-medium">{i18n.t('promptChat.stream.title')}</h3>
      <Button onClick={startStream} disabled={isStreaming} size="sm" variant="outline">
        {isStreaming
          ? i18n.t('promptChat.stream.receiving')
          : i18n.t('promptChat.story.startStream')}
      </Button>
      <div className="min-h-[80px] rounded-lg border p-4">
        <Message className="justify-start">
          <MessageAvatar alt="Assistant" fallback="AI" src="/images/avatars/05.png" />
          <div className="max-w-[80%]">
            <MessageContent>{displayedText || '...'}</MessageContent>
          </div>
        </Message>
      </div>
      <div className="text-muted-foreground text-xs">
        {i18n.t('promptChat.stream.chunk', { index: visibleChunks })}/{chunks.length}
        {' - '}
        {lastChunk?.done
          ? i18n.t('promptChat.stream.complete')
          : i18n.t('promptChat.stream.receiving')}
      </div>
    </div>
  );
}

export const WithStreamChunks: Story = {
  name: i18n.t('promptChat.storyName.withStreamChunks', 'Stream Chunks'),
  render: () => <StreamChunksDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('stream-chunks-demo')).toBeInTheDocument();
    // Click start stream
    const startButton = canvas.getByRole('button', { name: /start stream/i });
    expect(startButton).toBeInTheDocument();
    await userEvent.click(startButton);
    // Wait for streaming to complete
    await waitFor(
      () => {
        expect(canvas.getByText(/Complete/)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  },
};

// Demo: Chat response
function ChatResponseDemo() {
  const response: FakeChatResponse = React.useMemo(() => createFakeChatResponse('conv-123'), []);

  return (
    <div className="w-full max-w-3xl space-y-3" data-testid="chat-response-demo">
      <h3 className="text-sm font-medium">{i18n.t('promptChat.response.title')}</h3>
      <div className="rounded-lg border p-4">
        <div className="text-muted-foreground mb-3 space-y-1 text-xs">
          <p>
            {i18n.t('promptChat.response.conversationId')}: {response.conversationId}
          </p>
          <p>
            {i18n.t('promptChat.response.messageId')}: {response.id}
          </p>
        </div>
        <Message className="justify-start">
          <MessageAvatar alt="Assistant" fallback="AI" src="/images/avatars/05.png" />
          <div className="max-w-[80%] space-y-1">
            <MessageContent>{response.message.content}</MessageContent>
            {response.message.metadata ? (
              <div className="text-muted-foreground flex gap-3 text-xs">
                <span>
                  {i18n.t('promptChat.metadata.model')}: {response.message.metadata.model}
                </span>
                <span>
                  {i18n.t('promptChat.metadata.tokens')}: {response.message.metadata.tokens}
                </span>
                <span>
                  {i18n.t('promptChat.metadata.latency')}: {response.message.metadata.latency}ms
                </span>
              </div>
            ) : null}
          </div>
        </Message>
      </div>
    </div>
  );
}

export const WithChatResponse: Story = {
  name: i18n.t('promptChat.storyName.withChatResponse', 'Chat Response'),
  render: () => <ChatResponseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chat-response-demo')).toBeInTheDocument();
    expect(canvas.getByText(/Conversation ID:/)).toBeInTheDocument();
    expect(canvas.getByText(/conv-123/)).toBeInTheDocument();
  },
};

// Demo: Code blocks
function CodeBlocksDemo() {
  const singleBlock: FakeCodeBlock = React.useMemo(() => createFakeCodeBlock('typescript'), []);
  const multipleBlocks: FakeCodeBlock[] = React.useMemo(() => createFakeCodeBlocks(3), []);

  return (
    <div className="w-full max-w-3xl space-y-4" data-testid="code-blocks-demo">
      <h3 className="text-sm font-medium">{i18n.t('promptChat.codeBlock.title')}</h3>

      {/* Single code block */}
      <div className="rounded-lg border p-4">
        <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs">
          <span>
            {i18n.t('promptChat.codeBlock.language')}: {singleBlock.language}
          </span>
          <span>
            {i18n.t('promptChat.codeBlock.filename')}:{' '}
            {singleBlock.filename ?? i18n.t('promptChat.codeBlock.noFilename')}
          </span>
        </div>
        <Markdown>{'```' + singleBlock.language + '\n' + singleBlock.code + '\n```'}</Markdown>
      </div>

      {/* Multiple code blocks */}
      <div className="space-y-3">
        {multipleBlocks.map((block, index) => (
          <div
            className="rounded-lg border p-3"
            data-testid="code-block-item"
            key={block.language + String(index)}
          >
            <div className="text-muted-foreground mb-2 flex items-center justify-between text-xs">
              <span>
                {block.language} {block.filename ? `(${block.filename})` : ''}
              </span>
              <Button
                aria-label={i18n.t('promptChat.codeBlock.copyCode')}
                onClick={() => void navigator.clipboard?.writeText(block.code)?.catch(() => {})}
                size="sm"
                variant="ghost"
              >
                <CopyIcon className="mr-1 size-3" />
                {i18n.t('promptChat.codeBlock.copyCode')}
              </Button>
            </div>
            <Markdown>{'```' + block.language + '\n' + block.code + '\n```'}</Markdown>
          </div>
        ))}
      </div>
    </div>
  );
}

export const WithCodeBlocks: Story = {
  name: i18n.t('promptChat.storyName.withCodeBlocks', 'Code Blocks'),
  render: () => <CodeBlocksDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('code-blocks-demo')).toBeInTheDocument();
    const blocks = canvas.getAllByTestId('code-block-item');
    expect(blocks.length).toBe(3);
    // Verify copy button
    const copyButtons = canvas.getAllByRole('button', { name: /copy code/i });
    expect(copyButtons.length).toBeGreaterThan(0);
  },
};

// Demo: Prompt templates
function PromptTemplatesDemo() {
  const singleTemplate: FakePromptTemplate = React.useMemo(() => createFakePromptTemplate(), []);
  const templates: FakePromptTemplate[] = React.useMemo(() => createFakePromptTemplates(3), []);
  const [selectedTemplate, setSelectedTemplate] = React.useState<FakePromptTemplate | null>(null);

  return (
    <div className="w-full max-w-3xl space-y-4" data-testid="prompt-templates-demo">
      <h3 className="text-sm font-medium">{i18n.t('promptChat.template.title')}</h3>

      {/* Single template highlight */}
      <div className="rounded-lg border bg-gradient-to-r from-blue-50 to-purple-50 p-4 dark:from-blue-950 dark:to-purple-950">
        <p className="text-sm font-semibold">{singleTemplate.name}</p>
        <p className="text-muted-foreground text-xs">{singleTemplate.description}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {i18n.t('promptChat.template.category')}: {singleTemplate.category}
        </p>
      </div>

      {/* Template list */}
      <div className="space-y-2">
        {templates.map((tmpl) => (
          <button
            className="hover:bg-accent w-full rounded-lg border p-3 text-left transition-colors"
            data-testid="template-item"
            key={tmpl.id}
            onClick={() => setSelectedTemplate(tmpl)}
            type="button"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{tmpl.name}</p>
                <p className="text-muted-foreground text-xs">{tmpl.description}</p>
              </div>
              <span className="bg-secondary rounded-full px-2 py-1 text-xs">{tmpl.category}</span>
            </div>
            <div className="mt-2 flex gap-1">
              {tmpl.variables.map((v) => (
                <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs" key={v}>
                  {'{{'}
                  {v}
                  {'}}'}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Selected template preview */}
      {selectedTemplate ? (
        <div className="rounded-lg border p-4" data-testid="template-preview">
          <h4 className="text-sm font-medium">{i18n.t('promptChat.template.preview')}</h4>
          <p className="text-muted-foreground mt-1 text-xs">
            {i18n.t('promptChat.template.name')}: {selectedTemplate.name}
          </p>
          <pre className="bg-muted mt-2 overflow-x-auto rounded p-3 text-xs">
            {selectedTemplate.template}
          </pre>
          <p className="text-muted-foreground mt-2 text-xs">
            {i18n.t('promptChat.template.variables')}: {selectedTemplate.variables.join(', ')}
          </p>
          <Button className="mt-2" size="sm" variant="outline">
            {i18n.t('promptChat.template.useTemplate')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export const WithPromptTemplates: Story = {
  name: i18n.t('promptChat.storyName.withPromptTemplates', 'Prompt Templates'),
  render: () => <PromptTemplatesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('prompt-templates-demo')).toBeInTheDocument();
    const items = canvas.getAllByTestId('template-item');
    expect(items.length).toBe(3);
    // Click first template to show preview
    await userEvent.click(items[0]);
    await waitFor(() => {
      expect(canvas.getByTestId('template-preview')).toBeInTheDocument();
    });
    expect(canvas.getByText(/Use Template/)).toBeInTheDocument();
  },
};

// ============ FACTORY SHOWCASE ============

export const FactoryShowcase: Story = {
  render: () => {
    const user: FakeChatUser = createFakeChatUser();
    const userMsg = createFakeUserMessage();
    const assistantMsg = createFakeAssistantMessage();
    const thread = createFakeChatThread();
    const allRoles: ChatMessageRole[] = [...CHAT_MESSAGE_ROLES];
    const allStatuses: ChatMessageStatus[] = [...CHAT_MESSAGE_STATUSES];
    return (
      <div className="space-y-4 p-4">
        <h3 className="text-sm font-medium">Roles: {allRoles.join(', ')}</h3>
        <p className="text-xs">Statuses: {allStatuses.join(', ')}</p>
        <p className="text-xs">User Messages: {CHAT_USER_MESSAGES.length}</p>
        <p className="text-xs">Assistant Responses: {CHAT_ASSISTANT_RESPONSES.length}</p>
        <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
          {JSON.stringify({ user, userMsg, assistantMsg, thread }, null, 2)}
        </pre>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// GOLD-STANDARD AUDIT STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('promptChat.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('promptChat.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('promptChat.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('promptChat.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// PROMPT CHAT STATUS HANDLER STORIES
// ============================================================================

export const PromptChatError400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptChatStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PromptChatError401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptChatStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PromptChatError403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptChatStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PromptChatError404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptChatStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PromptChatError429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptChatStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PromptChatError500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptChatStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PromptChatError503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptChatStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PromptChatLoading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptChatStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PromptChatSlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptChatStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PromptChatNetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptChatStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PromptChatEmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptChatStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('promptChat.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: chatStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('promptChat.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: chatStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerStreaming: Story = {
  ...Default,
  name: i18n.t('promptChat.storyName.handlerStreaming', 'Handler: Streaming'),
  parameters: { msw: { handlers: chatStatusHandlers.streaming } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerPromptChatSuccess: Story = {
  ...Default,
  name: i18n.t('promptChat.storyName.handlerPromptChatSuccess', 'Handler: Prompt Chat Success'),
  parameters: { msw: { handlers: promptChatStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
