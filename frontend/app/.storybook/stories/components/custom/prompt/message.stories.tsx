import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import {
  AlertCircleIcon,
  CopyIcon,
  RefreshCwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from 'lucide-react';

import {
  promptMessageHandlers,
  promptMessageStatusHandlers,
} from '@/.storybook/stories/_handlers/prompt-message.handlers';
import { createFakeChatMessages } from '@/.storybook/stories/_factories/chat.factory';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import {
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
  MessageContent,
} from '@/components/ui/custom/prompt/message';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

type MessageDemoProps = {
  avatarFallback: string;
  avatarSrc: string;
  content: string;
  isUser: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onThumbsDown?: () => void;
  onThumbsUp?: () => void;
  showActions: boolean;
  showAvatar: boolean;
  useMarkdown: boolean;
};

function MessageDemo({
  content = 'Hello! How can I help you today?',
  isUser = false,
  showAvatar = true,
  showActions = true,
  useMarkdown = false,
  avatarSrc = '/images/avatars/05.png',
  avatarFallback = 'AI',
  onCopy,
  onRegenerate,
  onThumbsUp,
  onThumbsDown,
}: MessageDemoProps) {
  return (
    <div data-sb-message className="w-full max-w-2xl">
      <Message className={isUser ? 'justify-end' : ''}>
        {showAvatar && !isUser && (
          <MessageAvatar alt="Assistant" fallback={avatarFallback} src={avatarSrc} />
        )}
        <div className="space-y-2">
          <MessageContent
            markdown={useMarkdown}
            className={isUser ? 'bg-primary text-primary-foreground' : ''}
          >
            {content}
          </MessageContent>
          {showActions && !isUser && (
            <MessageActions>
              <MessageAction tooltip={i18n.t('message.story.copy', 'Copy')}>
                <Button
                  aria-label={i18n.t('message.story.copy', 'Copy')}
                  size="icon"
                  variant="ghost"
                  onClick={onCopy}
                >
                  <CopyIcon />
                </Button>
              </MessageAction>
              <MessageAction tooltip={i18n.t('message.story.regenerate', 'Regenerate')}>
                <Button
                  aria-label={i18n.t('message.story.regenerate', 'Regenerate')}
                  size="icon"
                  variant="ghost"
                  onClick={onRegenerate}
                >
                  <RefreshCwIcon />
                </Button>
              </MessageAction>
              <MessageAction tooltip={i18n.t('message.story.goodResponse', 'Good response')}>
                <Button
                  aria-label={i18n.t('message.story.goodResponse', 'Good response')}
                  size="icon"
                  variant="ghost"
                  onClick={onThumbsUp}
                >
                  <ThumbsUpIcon />
                </Button>
              </MessageAction>
              <MessageAction tooltip={i18n.t('message.story.badResponse', 'Bad response')}>
                <Button
                  aria-label={i18n.t('message.story.badResponse', 'Bad response')}
                  size="icon"
                  variant="ghost"
                  onClick={onThumbsDown}
                >
                  <ThumbsDownIcon />
                </Button>
              </MessageAction>
            </MessageActions>
          )}
        </div>
        {showAvatar && isUser && (
          <MessageAvatar alt="User" fallback="U" src="/images/avatars/01.png" />
        )}
      </Message>
    </div>
  );
}

// Error display component
interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

function MessageErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="message-error">
      <AlertCircleIcon className="size-4" />
      <AlertTitle>
        Error {error.status}: {error.code}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {error.message}
        {error.details && (
          <ul className="mt-2 list-disc pl-4 text-sm">
            {Object.entries(error.details).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCwIcon className="mr-2 size-4" />
          Retry
        </Button>
      )}
    </Alert>
  );
}

// Loading skeleton
function MessageLoadingSkeleton() {
  return (
    <div className="w-full max-w-2xl" data-state="loading" data-testid="message-loading">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Empty state
function MessageEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      data-state="empty"
      data-testid="message-empty"
    >
      <p className="text-muted-foreground">
        {i18n.t('message.story.noMessagesToDisplay', 'No messages to display')}
      </p>
    </div>
  );
}

// Demo with Faker data (static, no API)
function MessageWithFakerData() {
  const messages = React.useMemo(() => createFakeChatMessages(4), []);

  return (
    <div className="w-full max-w-2xl space-y-4">
      {messages.map((msg) => (
        <Message key={msg.id} className={msg.role === 'user' ? 'justify-end' : ''}>
          {msg.role === 'assistant' && (
            <MessageAvatar alt="Assistant" fallback="AI" src="/images/avatars/05.png" />
          )}
          <div className="space-y-2">
            <MessageContent
              markdown={msg.role === 'assistant'}
              className={msg.role === 'user' ? 'bg-primary text-primary-foreground' : ''}
            >
              {msg.content}
            </MessageContent>
            {msg.role === 'assistant' && (
              <MessageActions>
                <MessageAction tooltip={i18n.t('message.story.copy', 'Copy')}>
                  <Button
                    aria-label={i18n.t('message.story.copy', 'Copy')}
                    size="icon"
                    variant="ghost"
                  >
                    <CopyIcon />
                  </Button>
                </MessageAction>
                <MessageAction tooltip={i18n.t('message.story.like', 'Like')}>
                  <Button
                    aria-label={i18n.t('message.story.like', 'Like')}
                    size="icon"
                    variant="ghost"
                  >
                    <ThumbsUpIcon />
                  </Button>
                </MessageAction>
              </MessageActions>
            )}
          </div>
          {msg.role === 'user' && (
            <MessageAvatar alt="User" fallback="U" src="/images/avatars/01.png" />
          )}
        </Message>
      ))}
    </div>
  );
}

// Demo component with async data fetching via MSW
function MessageWithAsyncData() {
  const [messages, setMessages] = React.useState<ReturnType<typeof createFakeChatMessages>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/chat/messages')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<{ messages: ReturnType<typeof createFakeChatMessages> }>;
      })
      .then((json) => {
        setMessages(json.messages);
        setLoading(false);
        return undefined;
      })
      .catch((error_: ApiError) => {
        setError(error_);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <MessageLoadingSkeleton />;
  }

  if (error) {
    return <MessageErrorDisplay error={error} onRetry={fetchData} />;
  }

  if (messages.length === 0) {
    return <MessageEmptyState />;
  }

  return (
    <div className="w-full max-w-2xl space-y-4" data-state="success" data-testid="message-success">
      {messages.map((msg) => (
        <Message key={msg.id} className={msg.role === 'user' ? 'justify-end' : ''}>
          {msg.role === 'assistant' && (
            <MessageAvatar alt="Assistant" fallback="AI" src="/images/avatars/05.png" />
          )}
          <div className="space-y-2">
            <MessageContent
              markdown={msg.role === 'assistant'}
              className={msg.role === 'user' ? 'bg-primary text-primary-foreground' : ''}
            >
              {msg.content}
            </MessageContent>
            {msg.role === 'assistant' && (
              <MessageActions>
                <MessageAction tooltip={i18n.t('message.story.copy', 'Copy')}>
                  <Button
                    aria-label={i18n.t('message.story.copy', 'Copy')}
                    size="icon"
                    variant="ghost"
                  >
                    <CopyIcon />
                  </Button>
                </MessageAction>
                <MessageAction tooltip={i18n.t('message.story.like', 'Like')}>
                  <Button
                    aria-label={i18n.t('message.story.like', 'Like')}
                    size="icon"
                    variant="ghost"
                  >
                    <ThumbsUpIcon />
                  </Button>
                </MessageAction>
              </MessageActions>
            )}
          </div>
          {msg.role === 'user' && (
            <MessageAvatar alt="User" fallback="U" src="/images/avatars/01.png" />
          )}
        </Message>
      ))}
    </div>
  );
}

function KeyboardInteractionDemo() {
  const { t } = useTranslation();

  const [clickedAction, setClickedAction] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Press Tab to navigate between action buttons, Enter or Space to activate
      </p>
      <p className="text-muted-foreground text-sm">
        Last clicked: <strong>{clickedAction ?? i18n.t('message.story.none', 'None')}</strong>
      </p>
      <div className="w-full max-w-2xl">
        <Message>
          <MessageAvatar alt="Assistant" fallback="AI" src="/images/avatars/05.png" />
          <div className="space-y-2">
            <MessageContent>
              {t(
                'message.story.navigateTheActionsUsingKeyboard',
                'Navigate the actions using keyboard.'
              )}
            </MessageContent>
            <MessageActions>
              <MessageAction tooltip={i18n.t('message.story.copy', 'Copy')}>
                <Button
                  aria-label={i18n.t('message.story.copy', 'Copy')}
                  size="icon"
                  variant="ghost"
                  onClick={() => setClickedAction('Copy')}
                >
                  <CopyIcon />
                </Button>
              </MessageAction>
              <MessageAction tooltip={i18n.t('message.story.regenerate', 'Regenerate')}>
                <Button
                  aria-label={i18n.t('message.story.regenerate', 'Regenerate')}
                  size="icon"
                  variant="ghost"
                  onClick={() => setClickedAction('Regenerate')}
                >
                  <RefreshCwIcon />
                </Button>
              </MessageAction>
              <MessageAction tooltip={i18n.t('message.story.like', 'Like')}>
                <Button
                  aria-label={i18n.t('message.story.like', 'Like')}
                  size="icon"
                  variant="ghost"
                  onClick={() => setClickedAction('Like')}
                >
                  <ThumbsUpIcon />
                </Button>
              </MessageAction>
              <MessageAction tooltip={i18n.t('message.story.dislike', 'Dislike')}>
                <Button
                  aria-label={i18n.t('message.story.dislike', 'Dislike')}
                  size="icon"
                  variant="ghost"
                  onClick={() => setClickedAction('Dislike')}
                >
                  <ThumbsDownIcon />
                </Button>
              </MessageAction>
            </MessageActions>
          </div>
        </Message>
      </div>
    </div>
  );
}

function ConversationDemo() {
  const messages = [
    { role: 'assistant', content: 'Hello! How can I help you today?' },
    { role: 'user', content: 'Can you explain what React hooks are?' },
    {
      role: 'assistant',
      content: `React Hooks are functions that let you use state and other React features in functional components.

**Common Hooks:**
- \`useState\` - State management
- \`useEffect\` - Side effects
- \`useContext\` - Context API
- \`useRef\` - Mutable references`,
      markdown: true,
    },
    { role: 'user', content: 'Thanks! That helps a lot.' },
  ];

  return (
    <div className="w-full max-w-2xl space-y-4">
      {messages.map((msg) => (
        <Message
          key={`${msg.role}-${msg.content.slice(0, 20)}`}
          className={msg.role === 'user' ? 'justify-end' : ''}
        >
          {msg.role === 'assistant' && (
            <MessageAvatar alt="Assistant" fallback="AI" src="/images/avatars/05.png" />
          )}
          <div className="space-y-2">
            <MessageContent
              markdown={msg.markdown}
              className={msg.role === 'user' ? 'bg-primary text-primary-foreground' : ''}
            >
              {msg.content}
            </MessageContent>
            {msg.role === 'assistant' && (
              <MessageActions>
                <MessageAction tooltip={i18n.t('message.story.copy', 'Copy')}>
                  <Button
                    aria-label={i18n.t('message.story.copy', 'Copy')}
                    size="icon"
                    variant="ghost"
                  >
                    <CopyIcon />
                  </Button>
                </MessageAction>
                <MessageAction tooltip={i18n.t('message.story.like', 'Like')}>
                  <Button
                    aria-label={i18n.t('message.story.like', 'Like')}
                    size="icon"
                    variant="ghost"
                  >
                    <ThumbsUpIcon />
                  </Button>
                </MessageAction>
              </MessageActions>
            )}
          </div>
          {msg.role === 'user' && (
            <MessageAvatar alt="User" fallback="U" src="/images/avatars/01.png" />
          )}
        </Message>
      ))}
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Prompt/Message',
  component: MessageDemo,
  tags: ['autodocs'],
  args: {
    content: 'Hello! How can I help you today?',
    isUser: false,
    showAvatar: true,
    showActions: true,
    useMarkdown: false,
    avatarSrc: '/images/avatars/05.png',
    avatarFallback: 'AI',
    onCopy: fn(),
    onRegenerate: fn(),
    onThumbsUp: fn(),
    onThumbsDown: fn(),
  },
  parameters: {
    msw: {
      handlers: promptMessageHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    content: {
      control: 'text',
      description: i18n.t('message.argType.messageContentText', 'Message content text'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    useMarkdown: {
      control: 'boolean',
      description: i18n.t('message.argType.renderContentAsMarkdown', 'Render content as markdown'),
      table: {
        category: 'Content',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    // Appearance
    isUser: {
      control: 'boolean',
      description: i18n.t(
        'message.argType.displayAsUserMessageRightalignedDifferentStyle',
        'Display as user message (right-aligned, different style)'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    showAvatar: {
      control: 'boolean',
      description: i18n.t('message.argType.showTheAvatar', 'Show the avatar'),
      table: {
        category: 'Appearance',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    showActions: {
      control: 'boolean',
      description: i18n.t(
        'message.argType.showActionButtonsCopyRegenerateEtc',
        'Show action buttons (copy, regenerate, etc.)'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    avatarSrc: {
      control: 'text',
      description: i18n.t('message.argType.avatarImageSourceUrl', 'Avatar image source URL'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    avatarFallback: {
      control: 'text',
      description: i18n.t(
        'message.argType.avatarFallbackTextWhenImageFails',
        'Avatar fallback text when image fails'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
        defaultValue: { summary: 'AI' },
      },
    },
    // Events
    onCopy: {
      action: 'onCopy',
      description: i18n.t(
        'message.argType.calledWhenCopyButtonIsClicked',
        'Called when copy button is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
    onRegenerate: {
      action: 'onRegenerate',
      description: i18n.t(
        'message.argType.calledWhenRegenerateButtonIsClicked',
        'Called when regenerate button is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
    onThumbsUp: {
      action: 'onThumbsUp',
      description: i18n.t(
        'message.argType.calledWhenThumbsUpButtonIsClicked',
        'Called when thumbs up button is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
    onThumbsDown: {
      action: 'onThumbsDown',
      description: i18n.t(
        'message.argType.calledWhenThumbsDownButtonIsClicked',
        'Called when thumbs down button is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
  },
} satisfies Meta<typeof MessageDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const root = canvasElement.querySelector<HTMLElement>('[data-sb-message]');
    if (!root) throw new Error('Message root not found.');

    // Verify data-testid
    const message = root.querySelector('[data-testid="message"]');
    expect(message).toBeInTheDocument();

    // Verify actions
    const actions = root.querySelector('[data-testid="message-actions"]');
    expect(actions).toBeInTheDocument();

    // Verify action buttons have aria-labels
    const canvas = within(root);
    const copyButton = canvas.getByRole('button', { name: /copy/i });
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveAttribute('aria-label');
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('message.story.assistantMessage', 'Assistant Message')}
        </p>
        <Message>
          <MessageAvatar alt="Assistant" fallback="AI" src="/images/avatars/05.png" />
          <MessageContent>Hello! I&apos;m an AI assistant.</MessageContent>
        </Message>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('message.story.userMessage', 'User Message')}
        </p>
        <Message className="justify-end">
          <MessageContent className="bg-primary text-primary-foreground">
            Hi there! I have a question.
          </MessageContent>
          <MessageAvatar alt="User" fallback="U" src="/images/avatars/01.png" />
        </Message>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('message.story.withMarkdownContent', 'With Markdown Content')}
        </p>
        <Message>
          <MessageAvatar alt="Assistant" fallback="AI" src="/images/avatars/05.png" />
          <MessageContent markdown>
            Here's some **bold** and *italic* text with `inline code`.
          </MessageContent>
        </Message>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('message.story.withActions', 'With Actions')}
        </p>
        <Message>
          <MessageAvatar alt="Assistant" fallback="AI" src="/images/avatars/05.png" />
          <div className="space-y-2">
            <MessageContent>
              {i18n.t(
                'message.story.thisMessageHasActionButtons',
                'This message has action buttons.'
              )}
            </MessageContent>
            <MessageActions>
              <MessageAction tooltip={i18n.t('message.story.copy', 'Copy')}>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={i18n.t('message.story.copy', 'Copy')}
                >
                  <CopyIcon />
                </Button>
              </MessageAction>
              <MessageAction tooltip={i18n.t('message.story.regenerate', 'Regenerate')}>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={i18n.t('message.story.regenerate', 'Regenerate')}
                >
                  <RefreshCwIcon />
                </Button>
              </MessageAction>
              <MessageAction tooltip={i18n.t('message.story.like', 'Like')}>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={i18n.t('message.story.like', 'Like')}
                >
                  <ThumbsUpIcon />
                </Button>
              </MessageAction>
            </MessageActions>
          </div>
        </Message>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('message.story.avatarFallback', 'Avatar Fallback')}
        </p>
        <Message>
          <MessageAvatar alt="Bot" fallback="BOT" src="/invalid-image.png" />
          <MessageContent>
            {i18n.t('message.story.thisShowsTheFallbackAvatar', 'This shows the fallback avatar.')}
          </MessageContent>
        </Message>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('message.story.compactMessage', 'Compact Message')}
        </p>
        <div className="w-[400px]">
          <Message>
            <MessageAvatar
              alt="AI"
              fallback="AI"
              src="/images/avatars/05.png"
              className="h-6 w-6"
            />
            <MessageContent className="px-3 py-2 text-sm">
              {i18n.t('message.story.shortMessage', 'Short message.')}
            </MessageContent>
          </Message>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('message.story.defaultMessage', 'Default Message')}
        </p>
        <div className="w-[500px]">
          <Message>
            <MessageAvatar alt="AI" fallback="AI" src="/images/avatars/05.png" />
            <MessageContent>
              {i18n.t(
                'message.story.thisIsANormalsizedMessageWithStandardPad',
                'This is a normal-sized message with standard padding.'
              )}
            </MessageContent>
          </Message>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('message.story.largeMessage', 'Large Message')}
        </p>
        <div className="w-full max-w-2xl">
          <Message>
            <MessageAvatar
              alt="AI"
              fallback="AI"
              src="/images/avatars/05.png"
              className="h-10 w-10"
            />
            <MessageContent className="p-5 text-base">
              This is a larger message with more padding and bigger text. It demonstrates how the
              component scales.
            </MessageContent>
          </Message>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Conversation: Story = {
  render: () => <ConversationDemo />,
  play: async ({ canvasElement }) => {
    const messages = canvasElement.querySelectorAll('[data-testid="message"]');
    expect(messages.length).toBe(4);

    // Verify mix of user and assistant messages
    const actions = canvasElement.querySelectorAll('[data-testid="message-actions"]');
    expect(actions.length).toBe(2); // Only assistant messages have actions
  },
};

export const KeyboardInteraction: Story = {
  render: () => <KeyboardInteractionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Get action buttons
    const copyButton = canvas.getByRole('button', { name: /copy/i });
    const regenerateButton = canvas.getByRole('button', { name: /regenerate/i });
    const likeButton = canvas.getByRole('button', { name: /like/i });

    // Tab to first button
    await userEvent.tab();
    expect(copyButton).toHaveFocus();

    // Press Enter to click
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(canvasElement.textContent).toContain('Copy');
    });

    // Tab to next button
    await userEvent.tab();
    expect(regenerateButton).toHaveFocus();

    // Press Space to click
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(canvasElement.textContent).toContain('Regenerate');
    });

    // Tab to like button
    await userEvent.tab();
    expect(likeButton).toHaveFocus();
  },
};

export const AccessibilityTest: Story = {
  args: {
    showAvatar: true,
    showActions: true,
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-sb-message]');
    if (!root) throw new Error('Message root not found.');

    const canvas = within(root);

    // All action buttons should have aria-labels
    const buttons = canvas.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('aria-label');
    });

    // Avatar should have alt text
    const avatar = root.querySelector('img');
    if (avatar) {
      expect(avatar).toHaveAttribute('alt');
    }

    // Data attributes for testing
    expect(root.querySelector('[data-testid="message"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="message-actions"]')).toBeInTheDocument();
  },
};

export const MarkdownContent: Story = {
  args: {
    content: `This is a **bold** message with:

- List item 1
- List item 2
- List item 3

And some \`inline code\` too.`,
    useMarkdown: true,
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-sb-message]');
    if (!root) throw new Error('Message root not found.');

    // Verify markdown is rendered
    await waitFor(() => {
      expect(root.querySelector('strong')).toBeInTheDocument();
      expect(root.querySelector('ul')).toBeInTheDocument();
      expect(root.querySelector('li')).toBeInTheDocument();
      expect(root.querySelector('code')).toBeInTheDocument();
    });
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('message.storyName.japanese', 'Japanese'),
  args: {
    content: 'こんにちは！今日はどのようにお手伝いできますか？',
  },
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    await waitFor(() => {
      expect(doc.documentElement.lang).toBe('ja');
    });

    expect(canvasElement.querySelector('[data-testid="message"]')).toBeInTheDocument();
    expect(canvasElement.textContent).toContain('こんにちは');
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
  name: i18n.t('message.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => <MessageWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="message"]')).toBeInTheDocument();
    const messages = canvasElement.querySelectorAll('[data-testid="message"]');
    expect(messages.length).toBe(4);
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: promptMessageHandlers },
  },
  render: () => <MessageWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(canvasElement.querySelector('[data-testid="message-loading"]')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="message-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify messages rendered
    expect(canvasElement.querySelector('[data-testid="message"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.loading },
  },
  render: () => <MessageWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="message-loading"]')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  render: () => <MessageEmptyState />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="message-empty"]')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('message.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.badRequest },
  },
  render: () => <MessageWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="400"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('message.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.unauthorized },
  },
  render: () => <MessageWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="401"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('message.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.forbidden },
  },
  render: () => <MessageWithAsyncData />,
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
  name: i18n.t('message.storyName.error422UnprocessableEntity', 'Error 422: Validation Error'),
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.unprocessableEntity },
  },
  render: () => <MessageWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="422"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('message.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.tooManyRequests },
  },
  render: () => <MessageWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="429"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t('message.storyName.error500InternalServerError', 'Error 500: Internal Server Error'),
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.internalServerError },
  },
  render: () => <MessageWithAsyncData />,
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
  name: i18n.t('message.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.badGateway },
  },
  render: () => <MessageWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="502"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('message.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.serviceUnavailable },
  },
  render: () => <MessageWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="503"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('message.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.gatewayTimeout },
  },
  render: () => <MessageWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="504"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ SPECIAL STATE STORIES ============

export const SlowResponse: Story = {
  name: i18n.t('message.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.slowResponse },
  },
  render: () => <MessageWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(canvasElement.querySelector('[data-testid="message-loading"]')).toBeInTheDocument();
    // Wait for data (slow response takes 8s)
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="message-success"]')).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('message.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.networkError },
  },
  render: () => <MessageWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="message-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptMessageHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY STORY ============

// ============ COMBINED MODE STORIES ============

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('message.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('message.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('message.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('message.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ UNWIRED HANDLER STATUS STORIES ============

export const Error404NotFound: Story = {
  name: i18n.t('message.storyName.error404NotFound', 'Error 404: Not Found'),
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.notFound },
  },
  render: () => <MessageWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="404"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('message.storyName.error409Conflict', 'Error 409: Conflict'),
  parameters: {
    msw: { handlers: promptMessageStatusHandlers.conflict },
  },
  render: () => <MessageWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="409"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('message.storyName.accessibility', 'Accessibility'),
  args: {
    showAvatar: true,
    showActions: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvasElement.querySelector<HTMLElement>('[data-sb-message]');
    if (!root) throw new Error('Message root not found.');

    // Verify data-testid attributes
    expect(root.querySelector('[data-testid="message"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="message-actions"]')).toBeInTheDocument();

    // Verify all action buttons have aria-labels
    const buttons = canvas.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('aria-label');
    });

    // Verify specific action buttons exist with proper labels
    const copyButton = canvas.getByRole('button', { name: /copy/i });
    const regenerateButton = canvas.getByRole('button', { name: /regenerate/i });
    const thumbsUpButton = canvas.getByRole('button', { name: /good response/i });
    const thumbsDownButton = canvas.getByRole('button', { name: /bad response/i });

    expect(copyButton).toBeInTheDocument();
    expect(regenerateButton).toBeInTheDocument();
    expect(thumbsUpButton).toBeInTheDocument();
    expect(thumbsDownButton).toBeInTheDocument();

    // Verify avatar has alt text
    const avatar = root.querySelector('img');
    if (avatar) {
      expect(avatar).toHaveAttribute('alt');
    }

    // Test keyboard navigation through action buttons
    await userEvent.tab();
    expect(copyButton).toHaveFocus();

    await userEvent.tab();
    expect(regenerateButton).toHaveFocus();

    await userEvent.tab();
    expect(thumbsUpButton).toHaveFocus();

    await userEvent.tab();
    expect(thumbsDownButton).toHaveFocus();

    // Test keyboard activation (Enter key)
    copyButton.focus();
    await userEvent.keyboard('{Enter}');

    // Test keyboard activation (Space key)
    regenerateButton.focus();
    await userEvent.keyboard(' ');

    // Verify Shift+Tab navigation
    await userEvent.tab({ shift: true });
    expect(thumbsUpButton).toHaveFocus();
  },
};

export const HandlerPromptMessageSuccess: Story = {
  ...Default,
  name: i18n.t('message.storyName.handlerPromptMessageSuccess', 'Handler: Prompt Message Success'),
  parameters: { msw: { handlers: promptMessageStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
