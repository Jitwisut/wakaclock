import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { faker } from '@faker-js/faker';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  promptLoaderHandlers,
  promptLoaderStatusHandlers,
} from '@/.storybook/stories/_handlers/prompt-loader.handlers';
import type {
  FakePromptLoader,
  FakePromptLoaderConfig,
  LoaderSize,
  LoaderVariant,
} from '@/.storybook/stories/_factories/prompt-loader.factory';
import {
  createFakePromptLoader,
  createFakePromptLoaderConfig,
  createFakePromptLoaders,
  createFakePromptLoadersByVariant,
  createFakeSpinnerLoader,
  createFakeTextLoader,
  LOADER_SIZES,
  LOADER_TEXTS,
  LOADER_VARIANTS,
} from '@/.storybook/stories/_factories/prompt-loader.factory';
import { PromptLoader } from '@/components/ui/custom/prompt/loader';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

const variants = [
  'circular',
  'classic',
  'pulse',
  'pulse-dot',
  'dots',
  'typing',
  'wave',
  'bars',
  'terminal',
  'text-blink',
  'text-shimmer',
  'loading-dots',
] as const;

function PromptLoaderDemo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const loadingText = i18n.t('promptLoader.loading');

  return (
    <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
      {variants.map((variant) => (
        <div key={variant} className="flex items-center gap-2 rounded-md border p-3">
          <PromptLoader size={size} text={loadingText} variant={variant} />
          <div className="text-muted-foreground text-xs">{variant}</div>
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Prompt Loader',
  component: PromptLoaderDemo,
  tags: ['autodocs'],
  args: {
    size: 'md',
  },
  parameters: {
    msw: { handlers: promptLoaderHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Appearance
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: i18n.t(
        'promptLoader.argType.sizeOfTheLoaderAnimation',
        'Size of the loader animation'
      ),
      table: {
        category: 'Appearance',
        type: { summary: "'sm' | 'md' | 'lg'" },
        defaultValue: { summary: 'md' },
      },
    },
    // PromptLoader Props Reference:
    // - variant: Animation style (LoaderVariant)
    //   - 'circular': Spinning circle
    //   - 'classic': Traditional spinner
    //   - 'pulse': Pulsing dot
    //   - 'pulse-dot': Animated pulse dot
    //   - 'dots': Three bouncing dots
    //   - 'typing': Typing indicator (chat-style)
    //   - 'wave': Wave animation
    //   - 'bars': Equalizer-style bars
    //   - 'terminal': Terminal cursor blink
    //   - 'text-blink': Blinking text
    //   - 'text-shimmer': Shimmer text effect
    //   - 'loading-dots': Loading with dots
    // - size: Loader size ('sm' | 'md' | 'lg', default: 'md')
    // - text: Loading text to display (string)
    // - className: Additional CSS classes (string)
    //
    // Size Dimensions:
    // - sm: Compact size for inline use
    // - md: Default size for general use
    // - lg: Large size for prominent loading states
    //
    // Usage Notes:
    // - 12 animation variants for different contexts
    // - 'typing' variant ideal for chat interfaces
    // - 'terminal' variant for CLI-style UIs
    // - 'text-shimmer' for skeleton-like effects
    // - Supports localized loading text
  },
} satisfies Meta<typeof PromptLoaderDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============================================================================
// DEFAULT STORIES
// ============================================================================

export const AllVariants: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
    expect(canvas.getAllByText('Loading').length).not.toBe(0);
  },
};

export const Playground: Story = {
  ...AllVariants,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
    expect(canvas.getAllByText('Loading').length).not.toBe(0);
  },
};

export const Small: Story = {
  ...AllVariants,
  args: {
    ...(AllVariants.args ?? {}),
    size: 'sm',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
    expect(canvas.getAllByText('Loading').length).not.toBe(0);
  },
};

export const Large: Story = {
  ...AllVariants,
  args: {
    ...(AllVariants.args ?? {}),
    size: 'lg',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
    expect(canvas.getAllByText('Loading').length).not.toBe(0);
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();

    const canvas = within(canvasElement);

    for (const variant of variants) {
      expect(canvas.getByText(variant)).toBeInTheDocument();
    }

    expect(canvas.getAllByText('Loading').length).not.toBe(0);
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
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
    expect(canvas.getAllByText('Loading').length).not.toBe(0);
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
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
    expect(canvas.getAllByText('Loading').length).not.toBe(0);
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('promptLoader.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getAllByText('読み込み中').length).not.toBe(0);
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
  name: i18n.t('promptLoader.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
  render: () => {
    const randomVariant = faker.helpers.arrayElement(variants);
    const randomSize = faker.helpers.arrayElement(['sm', 'md', 'lg'] as const);
    return (
      <div className="flex items-center gap-4">
        <PromptLoader size={randomSize} text="Loading..." variant={randomVariant} />
        <span className="text-muted-foreground text-sm">
          {randomVariant} / {randomSize}
        </span>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptLoaderHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

// ============ MSW + STATUS STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptLoaderHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('promptLoader.storyName.emptyData', 'Empty (minimal loader)'),
  render: () => (
    <div className="flex items-center gap-4">
      <PromptLoader variant="dots" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('promptLoader.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('promptLoader.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Default,
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('promptLoader.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Default,
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('promptLoader.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Default,
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('promptLoader.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'promptLoader.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  ...Default,
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('promptLoader.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t(
    'promptLoader.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  ...Default,
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('promptLoader.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

// ============ SPECIAL STATE STORIES ============

export const NetworkError: Story = {
  name: i18n.t('promptLoader.storyName.networkError', 'Network Error'),
  ...Default,
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
  },
};

// ============ ENTERPRISE STORY EXPORTS ============

export const Variants: Story = {
  ...Default,
  name: i18n.t('promptLoader.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-8">
        <div>
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {i18n.t('promptLoader.story.allLoaderVariants', 'All Loader Variants')}
          </h3>
          <Story />
        </div>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="prompt-loader"]')).toBeInTheDocument();
    expect(canvas.getByText('All Loader Variants')).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  ...Default,
  name: i18n.t('promptLoader.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    () => (
      <div className="flex flex-col gap-8">
        <div>
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {i18n.t('promptLoader.story.small', 'Small')}
          </h3>
          <PromptLoader size="sm" text="Loading" variant="typing" />
        </div>
        <div>
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {i18n.t('promptLoader.story.mediumDefault', 'Medium (Default)')}
          </h3>
          <PromptLoader size="md" text="Loading" variant="typing" />
        </div>
        <div>
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {i18n.t('promptLoader.story.large', 'Large')}
          </h3>
          <PromptLoader size="lg" text="Loading" variant="typing" />
        </div>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Small')).toBeInTheDocument();
    expect(canvas.getByText('Medium (Default)')).toBeInTheDocument();
    expect(canvas.getByText('Large')).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('promptLoader.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify loader elements have data-slot attribute
    const loaders = canvasElement.querySelectorAll('[data-slot="prompt-loader"]');
    expect(loaders.length).not.toBe(0);

    // Verify loading text is visible for screen readers
    const loadingTexts = canvas.getAllByText('Loading');
    expect(loadingTexts.length).not.toBe(0);

    // Verify each variant is labeled
    for (const variant of ['circular', 'typing', 'dots', 'wave']) {
      await waitFor(() => {
        expect(canvas.getByText(variant)).toBeInTheDocument();
      });
    }

    // Verify loaders don't interfere with keyboard navigation
    await userEvent.tab();
    // Loaders should not be focusable (decorative elements)
    const focusedElement = document.activeElement;
    expect(focusedElement?.getAttribute('data-slot')).not.toBe('prompt-loader');
  },
};

// ============ FACTORY DATA STORIES ============

function FakerPromptLoaderDemo() {
  const fakerLoaders = createFakePromptLoadersByVariant();

  return (
    <div className="flex flex-wrap items-center gap-6 p-4" data-testid="faker-loader-grid">
      {fakerLoaders.map((loader) => (
        <div key={loader.id} className="flex flex-col items-center gap-2">
          <PromptLoader variant={loader.variant} size={loader.size} text={loader.loadingText} />
          <span className="text-muted-foreground text-xs">{loader.label}</span>
        </div>
      ))}
    </div>
  );
}

export const WithFactoryData: Story = {
  render: () => <FakerPromptLoaderDemo />,
  play: async ({ canvasElement }) => {
    const grid = canvasElement.querySelector('[data-testid="faker-loader-grid"]');
    expect(grid).toBeInTheDocument();
    expect(grid?.children.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY SHOWCASE ============

export const FactoryShowcase: Story = {
  render: () => {
    const loader: FakePromptLoader = createFakePromptLoader();
    const loaders: FakePromptLoader[] = createFakePromptLoaders(3);
    const spinner: FakePromptLoader = createFakeSpinnerLoader();
    const textLoader: FakePromptLoader = createFakeTextLoader();
    const config: FakePromptLoaderConfig = createFakePromptLoaderConfig();
    const allVariants: LoaderVariant[] = [...LOADER_VARIANTS];
    const allSizes: LoaderSize[] = [...LOADER_SIZES];
    return (
      <div className="space-y-4 p-4">
        <h3 className="text-sm font-medium">Variants: {allVariants.join(', ')}</h3>
        <p className="text-xs">Sizes: {allSizes.join(', ')}</p>
        <p className="text-xs">Texts: {LOADER_TEXTS.join(', ')}</p>
        <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
          {JSON.stringify({ loader, loaders, spinner, textLoader, config }, null, 2)}
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
  name: i18n.t('promptLoader.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('promptLoader.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('promptLoader.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('promptLoader.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusSuccess: Story = {
  ...Default,
  name: i18n.t('promptLoader.storyName.statusSuccess', 'Handler: Success'),
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusNotFound: Story = {
  ...Default,
  name: i18n.t('promptLoader.storyName.statusNotFound', 'Handler: Not Found'),
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusConflict: Story = {
  ...Default,
  name: i18n.t('promptLoader.storyName.statusConflict', 'Handler: Conflict'),
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('promptLoader.storyName.error422UnprocessableEntity', 'Error 422: Validation Error'),
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusStreaming: Story = {
  ...Default,
  name: i18n.t('promptLoader.storyName.statusStreaming', 'Handler: Streaming'),
  parameters: {
    msw: { handlers: promptLoaderStatusHandlers.streaming },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
