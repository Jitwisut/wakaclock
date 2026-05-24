import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { faker } from '@faker-js/faker';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  promptScrollButtonHandlers,
  promptScrollButtonStatusHandlers,
} from '@/.storybook/stories/_handlers/prompt-scroll-button.handlers';
import type {
  FakePromptScrollButton,
  FakeScrollButtonConfig,
  ScrollButtonSize,
  ScrollButtonVariant,
} from '@/.storybook/stories/_factories/prompt-scroll-button.factory';
import {
  createFakeHiddenScrollButton,
  createFakePromptScrollButton,
  createFakePromptScrollButtons,
  createFakeScrollButtonConfig,
  createFakeScrollButtonsByVariant,
  createFakeVisibleScrollButton,
  SCROLL_BUTTON_SIZES,
  SCROLL_BUTTON_VARIANTS,
  SCROLL_THRESHOLDS,
} from '@/.storybook/stories/_factories/prompt-scroll-button.factory';

import { PromptScrollButton } from '@/components/ui/custom/prompt/scroll-button';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

type PromptScrollButtonDemoProps = {
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  withAriaLabel?: boolean;
  withScrollAnchor?: boolean;
};

function PromptScrollButtonDemo({
  withScrollAnchor = true,
  withAriaLabel = true,
  onClick,
  onFocus,
  onBlur,
}: PromptScrollButtonDemoProps) {
  const messagesLabel = i18n.t('promptScrollButton.messagesAriaLabel');
  const scrollLabel = i18n.t('promptScrollButton.buttonAriaLabel');
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <div className="relative h-[260px] w-[420px] overflow-hidden rounded-xl border">
      <div aria-label={messagesLabel} className="h-full overflow-auto p-4" ref={containerRef}>
        <div className="space-y-3">
          {Array.from({ length: 40 }, (_, i) => (
            <div className="text-sm" key={i}>
              Message {i + 1}
            </div>
          ))}
          <div ref={withScrollAnchor ? scrollRef : undefined} />
        </div>
      </div>

      <div className="absolute right-3 bottom-3">
        <PromptScrollButton
          aria-label={withAriaLabel ? scrollLabel : undefined}
          containerRef={containerRef}
          scrollRef={scrollRef}
          onClick={onClick}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Prompt Scroll Button',
  component: PromptScrollButtonDemo,
  tags: ['autodocs'],
  args: {
    withAriaLabel: true,
    withScrollAnchor: true,
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
  },
  parameters: {
    msw: { handlers: promptScrollButtonHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // State
    withAriaLabel: {
      control: 'boolean',
      description: i18n.t(
        'promptScrollButton.argType.includeArialabelForAccessibilityDemoProp',
        'Include aria-label for accessibility (demo prop)'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    withScrollAnchor: {
      control: 'boolean',
      description: i18n.t(
        'promptScrollButton.argType.includeScrollAnchorElementDemoProp',
        'Include scroll anchor element (demo prop)'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('promptScrollButton.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('promptScrollButton.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('promptScrollButton.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    // PromptScrollButton Props Reference:
    // - containerRef: Ref to scrollable container (RefObject<HTMLElement>)
    // - scrollRef: Ref to scroll anchor element (RefObject<HTMLElement>)
    // - aria-label: Accessible label (string, default: 'Scroll to bottom')
    // - className: Additional CSS classes (string)
    //
    // Visibility Behavior:
    // - Hidden (opacity-0) when at bottom of scroll
    // - Visible (opacity-100) when scrolled up
    // - Smooth opacity transition
    //
    // Click Behavior:
    // - Scrolls to scrollRef element if provided
    // - Falls back to scrolling container to bottom
    // - Uses smooth scrolling behavior
    //
    // Usage Notes:
    // - Position absolutely in bottom-right of chat container
    // - Automatically shows/hides based on scroll position
    // - Place scroll anchor (empty div) at end of messages
    // - Great for chat interfaces with auto-scroll
  },
} satisfies Meta<typeof PromptScrollButtonDemo>;

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

    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();

    const canvas = within(canvasElement);
    const messages = canvas.getByLabelText('Messages');
    const button = canvas.getByLabelText('Scroll to bottom');

    messages.scrollTo({ top: 0 });
    messages.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      expect(button.className).toContain('opacity-100');
    });

    await userEvent.click(button);

    await waitFor(() => {
      expect(messages.scrollTop).not.toBe(0);
    });

    await waitFor(() => {
      expect(button.className).toContain('opacity-0');
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

export const WithoutScrollAnchor: Story = {
  ...Default,
  name: i18n.t('promptScrollButton.storyName.withoutScrollAnchor', 'Without scroll anchor'),
  args: {
    withScrollAnchor: false,
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByLabelText('Scroll to bottom')).toBeInTheDocument();
  },
};

export const FallbackAriaLabel: Story = {
  ...Default,
  name: i18n.t('promptScrollButton.storyName.fallbackAriaLabel', 'Fallback aria-label (no prop)'),
  args: {
    withAriaLabel: false,
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByLabelText('Messages')).toBeInTheDocument();
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
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByLabelText('Scroll to bottom')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByLabelText('Scroll to bottom')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('promptScrollButton.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByLabelText('メッセージ')).toBeInTheDocument();
    expect(canvas.getByLabelText('一番下へスクロール')).toBeInTheDocument();
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
  name: i18n.t(
    'promptScrollButton.storyName.pseudoStates',
    'Pseudo States (hover / focus / active)'
  ),
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

// ============ ENTERPRISE STORY EXPORTS ============

export const Variants: Story = {
  ...Default,
  name: i18n.t('promptScrollButton.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    () => (
      <div className="flex flex-col gap-8">
        <div>
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {i18n.t('promptScrollButton.story.withScrollAnchor', 'With Scroll Anchor')}
          </h3>
          <PromptScrollButtonDemo withScrollAnchor withAriaLabel />
        </div>
        <div>
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {i18n.t('promptScrollButton.story.withoutScrollAnchor', 'Without Scroll Anchor')}
          </h3>
          <PromptScrollButtonDemo withAriaLabel />
        </div>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('With Scroll Anchor')).toBeInTheDocument();
    expect(canvas.getByText('Without Scroll Anchor')).toBeInTheDocument();
    const buttons = canvasElement.querySelectorAll('[data-slot="prompt-scroll-button"]');
    expect(buttons.length).toBe(2);
  },
};

export const Sizes: Story = {
  ...Default,
  name: i18n.t('promptScrollButton.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-8">
        <div className="w-[300px]">
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {i18n.t('promptScrollButton.story.smallContainer', 'Small Container')}
          </h3>
          <Story />
        </div>
        <div className="w-[420px]">
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {i18n.t(
              'promptScrollButton.story.mediumContainerDefault',
              'Medium Container (Default)'
            )}
          </h3>
          <Story />
        </div>
        <div className="w-[600px]">
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {i18n.t('promptScrollButton.story.largeContainer', 'Large Container')}
          </h3>
          <Story />
        </div>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Small Container')).toBeInTheDocument();
    expect(canvas.getByText('Medium Container (Default)')).toBeInTheDocument();
    expect(canvas.getByText('Large Container')).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const messageCount = faker.number.int({ min: 30, max: 60 });
    return (
      <div className="relative h-[260px] w-[420px] overflow-hidden rounded-xl border">
        <div
          aria-label={i18n.t('promptScrollButton.story.messages', 'Messages')}
          className="h-full overflow-auto p-4"
        >
          <div className="space-y-3">
            {Array.from({ length: messageCount }, (_, i) => (
              <div className="text-sm" key={i}>
                {faker.lorem.sentence()}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[aria-label="Messages"]')).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptScrollButtonHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

// ============ MSW + STATUS STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptScrollButtonHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

const EmptyDataComponent = () => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  return (
    <div className="relative h-[260px] w-[420px] overflow-hidden rounded-xl border">
      <div
        aria-label={i18n.t('promptScrollButton.story.messages', 'Messages')}
        className="h-full overflow-auto p-4"
        ref={containerRef}
      >
        <div className="text-muted-foreground flex h-full items-center justify-center">
          No messages yet
        </div>
        <div ref={scrollRef} />
      </div>
      <div className="absolute right-3 bottom-3">
        <PromptScrollButton containerRef={containerRef} scrollRef={scrollRef} />
      </div>
    </div>
  );
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('promptScrollButton.storyName.emptyData', 'Empty (no messages)'),
  render: () => <EmptyDataComponent />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('No messages yet')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('promptScrollButton.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('promptScrollButton.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Default,
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('promptScrollButton.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Default,
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('promptScrollButton.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Default,
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('promptScrollButton.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'promptScrollButton.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  ...Default,
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('promptScrollButton.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t(
    'promptScrollButton.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  ...Default,
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('promptScrollButton.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

// ============ SPECIAL STATE STORIES ============

export const NetworkError: Story = {
  name: i18n.t('promptScrollButton.storyName.networkError', 'Network Error'),
  ...Default,
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-scroll-button"]')).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('promptScrollButton.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify scroll button has aria-label
    const button = canvas.getByLabelText('Scroll to bottom');
    expect(button).toBeInTheDocument();
    expect(button.getAttribute('aria-label')).toBe('Scroll to bottom');

    // Verify messages container has aria-label
    const messagesContainer = canvas.getByLabelText('Messages');
    expect(messagesContainer).toBeInTheDocument();

    // Test keyboard navigation
    messagesContainer.scrollTo({ top: 0 });
    messagesContainer.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      expect(button.className).toContain('opacity-100');
    });

    // Tab to the button
    await userEvent.tab();

    // Verify button is focusable
    await waitFor(() => {
      expect(button).toHaveFocus();
    });

    // Activate with keyboard (Enter)
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(messagesContainer.scrollTop).not.toBe(0);
    });

    // Verify data-slot attribute for testing
    expect(button.getAttribute('data-slot')).toBe('prompt-scroll-button');
  },
};

// ============ FACTORY DATA STORIES ============

function FakerScrollButtonDemo() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fakerButtons = createFakeScrollButtonsByVariant();

  return (
    <div className="space-y-4" data-testid="faker-scroll-demo">
      <p className="text-sm font-medium">Factory variants ({fakerButtons.length})</p>
      <div
        ref={containerRef}
        className="relative h-48 overflow-auto rounded-md border p-4"
        aria-label={i18n.t('promptScrollButton.story.scrollableContent', 'Scrollable content')}
      >
        <div className="space-y-2">
          {Array.from({ length: 20 }, (_, i) => (
            <p key={`line-${i}`} className="text-muted-foreground text-sm">
              Message line {i + 1}
            </p>
          ))}
          <div ref={scrollRef} />
        </div>
        <PromptScrollButton
          containerRef={containerRef}
          scrollRef={scrollRef}
          variant={fakerButtons[0]?.variant}
          aria-label={fakerButtons[0]?.ariaLabel}
          className="absolute right-2 bottom-2"
        />
      </div>
      <pre
        className="bg-muted max-h-32 overflow-auto rounded-md p-3 text-xs"
        data-testid="faker-json"
      >
        {JSON.stringify(fakerButtons, null, 2)}
      </pre>
    </div>
  );
}

export const WithFactoryData: Story = {
  render: () => <FakerScrollButtonDemo />,
  play: async ({ canvasElement }) => {
    const demo = canvasElement.querySelector('[data-testid="faker-scroll-demo"]');
    expect(demo).toBeInTheDocument();

    const json = canvasElement.querySelector('[data-testid="faker-json"]');
    expect(json).toBeInTheDocument();
    expect(json?.textContent).toContain('"variant"');
  },
};

// ============ FACTORY SHOWCASE ============

export const FactoryShowcase: Story = {
  render: () => {
    const button: FakePromptScrollButton = createFakePromptScrollButton();
    const buttons: FakePromptScrollButton[] = createFakePromptScrollButtons(3);
    const visible: FakePromptScrollButton = createFakeVisibleScrollButton();
    const hidden: FakePromptScrollButton = createFakeHiddenScrollButton();
    const config: FakeScrollButtonConfig = createFakeScrollButtonConfig();
    const allVariants: ScrollButtonVariant[] = [...SCROLL_BUTTON_VARIANTS];
    const allSizes: ScrollButtonSize[] = [...SCROLL_BUTTON_SIZES];
    return (
      <div className="space-y-4 p-4">
        <h3 className="text-sm font-medium">Variants: {allVariants.join(', ')}</h3>
        <p className="text-xs">Sizes: {allSizes.join(', ')}</p>
        <p className="text-xs">Thresholds: {SCROLL_THRESHOLDS.join(', ')}</p>
        <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
          {JSON.stringify({ button, buttons, visible, hidden, config }, null, 2)}
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
  name: i18n.t('promptScrollButton.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('promptScrollButton.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('promptScrollButton.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('promptScrollButton.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusSuccess: Story = {
  ...Default,
  name: i18n.t('promptScrollButton.storyName.statusSuccess', 'Handler: Success'),
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusNotFound: Story = {
  ...Default,
  name: i18n.t('promptScrollButton.storyName.statusNotFound', 'Handler: Not Found'),
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusConflict: Story = {
  ...Default,
  name: i18n.t('promptScrollButton.storyName.statusConflict', 'Handler: Conflict'),
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'promptScrollButton.storyName.error422UnprocessableEntity',
    'Error 422: Validation Error'
  ),
  parameters: {
    msw: { handlers: promptScrollButtonStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
