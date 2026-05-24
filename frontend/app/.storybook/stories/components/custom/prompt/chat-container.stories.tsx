import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { faker } from '@faker-js/faker';
import { useEffect, useState } from 'react';

import {
  chatContainerHandlers,
  chatContainerStatusHandlers,
} from '@/.storybook/stories/_handlers/chat-container.handlers';
import { createFakeChatMessage } from '@/.storybook/stories/_factories/chat.factory';

import { ChatContainer } from '@/components/ui/custom/prompt/chat-container';
import { Message, MessageContent } from '@/components/ui/custom/prompt/message';
import { cn } from '@/lib/utils';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Simple chat message wrapper for demos
function ChatMessage({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <Message className={cn(isUser && 'justify-end')}>
      <MessageContent className={cn(isUser && 'bg-primary text-primary-foreground')}>
        {content}
      </MessageContent>
    </Message>
  );
}

// Demo component showing chat container with messages
function ChatContainerDemo({ messageCount = 5 }: { messageCount?: number }) {
  const messages = Array.from({ length: messageCount }, (_, i) => ({
    ...createFakeChatMessage(i % 2 === 0 ? 'user' : 'assistant'),
    id: `msg-${i}`,
  }));

  return (
    <div className="h-[400px] w-[500px] rounded-lg border">
      <ChatContainer
        className="h-full p-4"
        aria-label={i18n.t('chatContainer.story.chatMessages', 'Chat messages')}
      >
        {messages.map((msg) => (
          <ChatMessage key={msg.id} content={msg.content} isUser={msg.role === 'user'} />
        ))}
      </ChatContainer>
    </div>
  );
}

// Empty container demo
function EmptyContainerDemo() {
  return (
    <div className="h-[300px] w-[500px] rounded-lg border">
      <ChatContainer className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground">
          {i18n.t('chatContainer.story.noMessagesYet', 'No messages yet')}
        </p>
      </ChatContainer>
    </div>
  );
}

// Auto-scroll demo with streaming messages
function AutoScrollDemo() {
  const [messages, setMessages] = useState<Array<{ content: string; id: string; isUser: boolean }>>(
    [{ content: 'Hello! How can I help you today?', id: '1', isUser: false }]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setMessages((prev) => {
        if (prev.length >= 10) {
          clearInterval(interval);
          return prev;
        }
        const isUser = prev.length % 2 !== 0;
        return [
          ...prev,
          {
            content: faker.lorem.sentence(),
            id: `msg-${prev.length + 1}`,
            isUser,
          },
        ];
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-[300px] w-[500px] rounded-lg border">
      <ChatContainer className="h-full p-4" autoScroll>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} content={msg.content} isUser={msg.isUser} />
        ))}
      </ChatContainer>
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Prompt/Chat Container',
  component: ChatContainer,
  tags: ['autodocs'],
  args: {
    children: null,
    autoScroll: true,
    // Event handlers with fn() for Actions panel logging
    onScroll: fn(),
    onFocus: fn(),
    onBlur: fn(),
  },
  argTypes: {
    // Content
    children: {
      control: false,
      description: i18n.t(
        'chatContainer.argType.chatMessagesToRenderInsideTheContainer',
        'Chat messages to render inside the container'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    // Appearance
    className: {
      control: { type: 'text' },
      description: i18n.t('chatContainer.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // Behavior
    autoScroll: {
      control: { type: 'boolean' },
      description: i18n.t(
        'chatContainer.argType.enableAutomaticScrollingToBottomWhenNewMessagesArrive',
        'Enable automatic scrolling to bottom when new messages arrive'
      ),
      table: {
        category: 'Behavior',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    scrollToRef: {
      control: false,
      description: i18n.t(
        'chatContainer.argType.optionalRefToControlScrollBehaviorExternally',
        'Optional ref to control scroll behavior externally'
      ),
      table: {
        category: 'Behavior',
        type: { summary: 'RefObject<HTMLDivElement>' },
      },
    },
    // Events
    onScroll: {
      action: 'onScroll',
      description: i18n.t('chatContainer.argType.scrollEventHandler', 'Scroll event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('chatContainer.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('chatContainer.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
  },
  parameters: {
    msw: { handlers: chatContainerHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ChatContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ChatContainerDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify chat container is rendered
    const container = canvas.getByTestId('chat-container');
    expect(container).toBeInTheDocument();

    // Verify accessibility attributes
    expect(container).toHaveAttribute('role', 'log');
    expect(container).toHaveAttribute('aria-live', 'polite');
    expect(container).toHaveAttribute('aria-label');
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const WithAutoScroll: Story = {
  render: () => <AutoScrollDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SingleMessage: Story = {
  render: () => (
    <div className="h-[300px] w-[500px] rounded-lg border">
      <ChatContainer className="h-full p-4">
        <ChatMessage content={i18n.t('chatContainer.story.helloWorld', 'Hello, world!')} isUser />
      </ChatContainer>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyContainer: Story = {
  render: () => <EmptyContainerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('chat-container');
    expect(container).toBeInTheDocument();
  },
};

export const ManyMessages: Story = {
  render: () => <ChatContainerDemo messageCount={20} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('chat-container');
    expect(container).toBeInTheDocument();

    // Verify scrollable
    expect(container.scrollHeight).toBeGreaterThan(container.clientHeight);
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('chatContainer.story.defaultWithAutoscroll', 'Default (with auto-scroll)')}
        </p>
        <ChatContainerDemo messageCount={3} />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('chatContainer.story.disabledAutoscroll', 'Disabled auto-scroll')}
        </p>
        <div className="h-[200px] w-[500px] rounded-lg border">
          <ChatContainer className="h-full p-4" autoScroll={false}>
            {Array.from({ length: 3 }, (_, i) => (
              <ChatMessage
                key={`variant-${i}`}
                content={faker.lorem.sentence()}
                isUser={i % 2 === 0}
              />
            ))}
          </ChatContainer>
        </div>
      </div>
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('chatContainer.story.small200px', 'Small (200px)')}
        </p>
        <div className="h-[200px] w-[300px] rounded-lg border">
          <ChatContainer className="h-full p-2">
            <ChatMessage content={i18n.t('chatContainer.story.hello', 'Hello!')} isUser />
            <ChatMessage
              content={i18n.t('chatContainer.story.hiThere', 'Hi there!')}
              isUser={false}
            />
          </ChatContainer>
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('chatContainer.story.large500px', 'Large (500px)')}
        </p>
        <div className="h-[500px] w-[600px] rounded-lg border">
          <ChatContainer className="h-full p-4">
            <ChatMessage
              content={i18n.t(
                'chatContainer.story.helloLargerContainer',
                'Hello! This is a larger container.'
              )}
              isUser
            />
            <ChatMessage
              content={i18n.t(
                'chatContainer.story.moreSpaceForConversation',
                'Great! More space for conversation.'
              )}
              isUser={false}
            />
          </ChatContainer>
        </div>
      </div>
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
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
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
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
  name: i18n.t('chatContainer.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (storyFn) => {
      const StoryRenderer = storyFn;
      return (
        <div className="flex flex-wrap items-start gap-3">
          <div id="hover">
            <StoryRenderer />
          </div>
          <div id="focus">
            <StoryRenderer />
          </div>
        </div>
      );
    },
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover [data-slot="chat-container"]'],
      focusVisible: ['#focus [data-slot="chat-container"]'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => <ChatContainerDemo messageCount={8} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chat-container')).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ MSW + STATUS STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('chatContainer.storyName.accessibility', 'Accessibility'),
  render: () => <ChatContainerDemo messageCount={5} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify container is accessible
    const container = canvas.getByTestId('chat-container');
    expect(container).toBeInTheDocument();

    // Verify role for screen readers
    expect(container).toHaveAttribute('role', 'log');

    // Verify aria-live for dynamic updates
    expect(container).toHaveAttribute('aria-live', 'polite');

    // Verify aria-label is present
    expect(container).toHaveAttribute('aria-label');
  },
};

// ============================================================================
// GOLD-STANDARD AUDIT STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('chatContainer.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('chatContainer.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('chatContainer.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('chatContainer.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusSuccess: Story = {
  ...Default,
  name: i18n.t('chatContainer.storyName.statusSuccess', 'Handler: Success'),
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusNotFound: Story = {
  ...Default,
  name: i18n.t('chatContainer.storyName.statusNotFound', 'Handler: Not Found'),
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusConflict: Story = {
  ...Default,
  name: i18n.t('chatContainer.storyName.statusConflict', 'Handler: Conflict'),
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'chatContainer.storyName.error422UnprocessableEntity',
    'Error 422: Validation Error'
  ),
  parameters: {
    msw: { handlers: chatContainerStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
