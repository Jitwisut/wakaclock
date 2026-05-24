import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import type {
  AspectRatioContentType,
  AspectRatioPreset,
  AspectRatioSize,
  FakeAspectRatio,
  FakeAspectRatioConfig,
} from '@/.storybook/stories/_factories/aspect-ratio.factory';

import {
  ASPECT_RATIO_CONTENT_TYPES,
  ASPECT_RATIO_LABELS,
  ASPECT_RATIO_PRESETS,
  ASPECT_RATIO_SIZE_WIDTHS,
  ASPECT_RATIO_SIZES,
  ASPECT_RATIO_USE_CASES,
  ASPECT_RATIO_VALUES,
  createFakeAspectRatio,
  createFakeAspectRatioConfig,
  createFakeAspectRatioMatrix,
  createFakeAspectRatios,
  createFakeAspectRatiosByPreset,
  createFakeImageGallery,
  createFakePortraitAspectRatio,
  createFakeSquareAspectRatio,
  createFakeUltrawideAspectRatio,
  createFakeVideoAspectRatio,
  createFakeWidescreenAspectRatio,
} from '@/.storybook/stories/_factories/aspect-ratio.factory';

import {
  aspectRatioHandlers,
  aspectRatioStatusHandlers,
} from '@/.storybook/stories/_handlers/aspect-ratio.handlers';

import { AspectRatio } from '@/components/ui/aspect-ratio';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

const meta = {
  title: 'Components/UI/Aspect Ratio',
  component: AspectRatio,
  tags: ['autodocs'],
  args: {
    ratio: 16 / 9,
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // Content
    children: {
      control: false,
      description: i18n.t(
        'aspectRatio.argType.contentToDisplayInsideTheAspectRatioContainer',
        'Content to display inside the aspect ratio container'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t('aspectRatio.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    asChild: {
      control: 'boolean',
      description: i18n.t(
        'aspectRatio.argType.renderAsChildElementUsingRadixSlot',
        'Render as child element (using Radix Slot)'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    ratio: {
      control: { type: 'number', min: 0.1, max: 5, step: 0.1 },
      description: i18n.t(
        'aspectRatio.argType.aspectRatioWidthHeight',
        'Aspect ratio (width / height)'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'number' },
        defaultValue: { summary: '1' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('aspectRatio.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('aspectRatio.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('aspectRatio.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('aspectRatio.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('aspectRatio.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('aspectRatio.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('aspectRatio.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    // AspectRatio Props Reference (Radix AspectRatio.Root):
    // - ratio: Width to height ratio (number, default: 1)
    //   - 16/9 = 1.78 (widescreen video)
    //   - 4/3 = 1.33 (traditional TV)
    //   - 1/1 = 1 (square)
    //   - 3/2 = 1.5 (classic 35mm photo)
    //   - 21/9 = 2.33 (ultrawide)
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    //
    // Usage Notes:
    // - Container maintains ratio regardless of content
    // - Set width on parent, height is auto-calculated
    // - Great for responsive images, videos, embeds
    // - Children fill the container completely
  },
  parameters: {
    msw: { handlers: aspectRatioHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof AspectRatio>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[520px]">
      <AspectRatio {...args}>
        <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
          16:9
        </div>
      </AspectRatio>
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Square: Story = {
  args: { ratio: 1 },
  render: (args) => (
    <div className="w-[320px]">
      <AspectRatio {...args}>
        <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
          1:1
        </div>
      </AspectRatio>
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText('1:1')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

function AspectRatioVariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('aspectRatio.variants.widescreen')}</p>
        <div className="w-[400px]">
          <AspectRatio ratio={16 / 9}>
            <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
              {i18n.t('aspectRatio.labels.videoYoutube')}
            </div>
          </AspectRatio>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('aspectRatio.variants.square')}</p>
        <div className="w-[200px]">
          <AspectRatio ratio={1}>
            <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
              {i18n.t('aspectRatio.labels.avatarInstagram')}
            </div>
          </AspectRatio>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('aspectRatio.variants.classicTv')}</p>
        <div className="w-[320px]">
          <AspectRatio ratio={4 / 3}>
            <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
              {i18n.t('aspectRatio.labels.classicTv')}
            </div>
          </AspectRatio>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('aspectRatio.variants.photo')}</p>
        <div className="w-[300px]">
          <AspectRatio ratio={3 / 2}>
            <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
              {i18n.t('aspectRatio.labels.photo35mm')}
            </div>
          </AspectRatio>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('aspectRatio.variants.ultrawide')}</p>
        <div className="w-[500px]">
          <AspectRatio ratio={21 / 9}>
            <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
              {i18n.t('aspectRatio.labels.cinematic')}
            </div>
          </AspectRatio>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('aspectRatio.variants.portrait')}</p>
        <div className="w-[180px]">
          <AspectRatio ratio={9 / 16}>
            <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
              {i18n.t('aspectRatio.labels.mobileStories')}
            </div>
          </AspectRatio>
        </div>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <AspectRatioVariantsDemo />,
  play: async ({ canvasElement }) => {
    const aspectRatios = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(aspectRatios.length).toBe(6);

    const canvas = within(canvasElement);
    expect(canvas.getByText(/16:9/)).toBeInTheDocument();
    expect(canvas.getByText(/1:1/)).toBeInTheDocument();
    expect(canvas.getByText(/4:3/)).toBeInTheDocument();
  },
};

function AspectRatioSizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('aspectRatio.sizes.thumbnail')}</p>
        <div className="w-[120px]">
          <AspectRatio ratio={16 / 9}>
            <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-xs">
              120px
            </div>
          </AspectRatio>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('aspectRatio.sizes.small')}</p>
        <div className="w-[240px]">
          <AspectRatio ratio={16 / 9}>
            <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
              240px
            </div>
          </AspectRatio>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('aspectRatio.sizes.medium')}</p>
        <div className="w-[400px]">
          <AspectRatio ratio={16 / 9}>
            <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
              400px
            </div>
          </AspectRatio>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('aspectRatio.sizes.large')}</p>
        <div className="w-[600px]">
          <AspectRatio ratio={16 / 9}>
            <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
              600px
            </div>
          </AspectRatio>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('aspectRatio.sizes.fullWidth')}</p>
        <div className="w-full max-w-[800px]">
          <AspectRatio ratio={16 / 9}>
            <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
              {i18n.t('aspectRatio.labels.fullWidthMax')}
            </div>
          </AspectRatio>
        </div>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <AspectRatioSizesDemo />,
  play: async ({ canvasElement }) => {
    const aspectRatios = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(aspectRatios.length).toBe(5);

    const canvas = within(canvasElement);
    expect(canvas.getByText('120px')).toBeInTheDocument();
    expect(canvas.getByText('240px')).toBeInTheDocument();
    expect(canvas.getByText('400px')).toBeInTheDocument();
    expect(canvas.getByText('600px')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
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
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('aspectRatio.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('aspectRatio.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('aspectRatio.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('aspectRatio.storyName.dataAttributes', 'Data Attributes'),
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
  name: i18n.t('aspectRatio.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  render: () => (
    <div className="w-[400px] space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-medium">
          {i18n.t('aspectRatio.story.imageWithAltText', 'Image with Alt Text')}
        </h4>
        <AspectRatio ratio={16 / 9} className="bg-muted overflow-hidden rounded-md">
          <img
            src="/images/products/01.jpeg"
            alt={i18n.t(
              'aspectRatio.story.scenicLandscapeAlt',
              'A scenic landscape view demonstrating proper alt text for accessibility'
            )}
            className="h-full w-full object-cover"
          />
        </AspectRatio>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-medium">
          {i18n.t('aspectRatio.story.decorativeImage', 'Decorative Image')}
        </h4>
        <AspectRatio ratio={16 / 9} className="bg-muted overflow-hidden rounded-md">
          <img
            src="/images/products/02.jpeg"
            alt=""
            role="presentation"
            className="h-full w-full object-cover"
          />
        </AspectRatio>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find aspect ratio containers
    const aspectRatios = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(aspectRatios.length).toBe(2);

    // Find image with alt text
    const accessibleImage = canvas.getByAltText(
      'A scenic landscape view demonstrating proper alt text for accessibility'
    );
    expect(accessibleImage).toBeInTheDocument();

    // Find decorative image (should have empty alt and presentation role)
    const decorativeImage = canvasElement.querySelector('img[role="presentation"]');
    expect(decorativeImage).toBeInTheDocument();
    expect(decorativeImage?.getAttribute('alt')).toBe('');
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const items = createFakeAspectRatios(5);
    return (
      <div className="flex flex-wrap gap-4">
        {items.map((item) => (
          <div key={item.id} className="w-[200px]">
            <AspectRatio ratio={item.ratio}>
              <div className="bg-muted flex h-full w-full items-center justify-center rounded-md text-sm">
                {item.label}
              </div>
            </AspectRatio>
            <p className="text-muted-foreground mt-1 text-xs">{item.description}</p>
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const elements = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  },
};

// ============ MSW Handler Stories ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Error429TooManyRequests: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: aspectRatioStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('16:9')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeAspectRatio (single item) ============

function SingleFakeAspectRatioDemo() {
  const item: FakeAspectRatio = createFakeAspectRatio();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.story.description')}</p>
      <div style={{ width: item.width ?? 300 }}>
        <AspectRatio ratio={item.ratio}>
          <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
            {item.label}
          </div>
        </AspectRatio>
      </div>
      <p className="text-muted-foreground text-xs">
        {item.preset} &mdash; {item.description}
      </p>
    </div>
  );
}

export const WithSingleFakeItem: Story = {
  render: () => <SingleFakeAspectRatioDemo />,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('[data-slot="aspect-ratio"]');
    expect(el).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeWidescreenAspectRatio ============

function WidescreenAspectRatioDemo() {
  const item: FakeAspectRatio = createFakeWidescreenAspectRatio();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.variants.widescreen')}</p>
      <div className="w-[480px]">
        <AspectRatio ratio={item.ratio}>
          <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
            {item.label}
          </div>
        </AspectRatio>
      </div>
      <p className="text-muted-foreground text-xs">{item.description}</p>
    </div>
  );
}

export const WidescreenFactory: Story = {
  render: () => <WidescreenAspectRatioDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Widescreen/)).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSquareAspectRatio ============

function SquareAspectRatioDemo() {
  const item: FakeAspectRatio = createFakeSquareAspectRatio();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.variants.square')}</p>
      <div className="w-[240px]">
        <AspectRatio ratio={item.ratio}>
          <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
            {item.label}
          </div>
        </AspectRatio>
      </div>
      <p className="text-muted-foreground text-xs">{item.description}</p>
    </div>
  );
}

export const SquareFactory: Story = {
  render: () => <SquareAspectRatioDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Square/)).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakePortraitAspectRatio ============

function PortraitAspectRatioDemo() {
  const item: FakeAspectRatio = createFakePortraitAspectRatio();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.variants.portrait')}</p>
      <div className="w-[180px]">
        <AspectRatio ratio={item.ratio}>
          <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
            {item.label}
          </div>
        </AspectRatio>
      </div>
      <p className="text-muted-foreground text-xs">{item.description}</p>
    </div>
  );
}

export const PortraitFactory: Story = {
  render: () => <PortraitAspectRatioDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Portrait/)).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeUltrawideAspectRatio ============

function UltrawideAspectRatioDemo() {
  const item: FakeAspectRatio = createFakeUltrawideAspectRatio();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.variants.ultrawide')}</p>
      <div className="w-[560px]">
        <AspectRatio ratio={item.ratio}>
          <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
            {item.label}
          </div>
        </AspectRatio>
      </div>
      <p className="text-muted-foreground text-xs">{item.description}</p>
    </div>
  );
}

export const UltrawideFactory: Story = {
  render: () => <UltrawideAspectRatioDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Ultrawide/)).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeAspectRatiosByPreset ============

function AllPresetsDemo() {
  const items: FakeAspectRatio[] = createFakeAspectRatiosByPreset();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.section.variants')}</p>
      <div className="flex flex-wrap gap-4">
        {items.map((item) => (
          <div key={item.id} className="w-[200px]">
            <AspectRatio ratio={item.ratio}>
              <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-xs">
                {item.label}
              </div>
            </AspectRatio>
            <p className="text-muted-foreground mt-1 text-xs">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const AllPresets: Story = {
  render: () => <AllPresetsDemo />,
  play: async ({ canvasElement }) => {
    const elements = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(elements.length).toBe(ASPECT_RATIO_PRESETS.length);
  },
};

// ============ FACTORY: createFakeImageGallery ============

function ImageGalleryDemo() {
  const items: FakeAspectRatio[] = createFakeImageGallery(8);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.section.media')}</p>
      <div className="flex flex-wrap gap-4">
        {items.map((item) => (
          <div key={item.id} style={{ width: item.width ?? 240 }}>
            <AspectRatio ratio={item.ratio}>
              <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-xs">
                {item.label}
              </div>
            </AspectRatio>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ImageGallery: Story = {
  render: () => <ImageGalleryDemo />,
  play: async ({ canvasElement }) => {
    const elements = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(elements.length).toBe(8);
  },
};

// ============ FACTORY: createFakeVideoAspectRatio ============

function VideoAspectRatioDemo() {
  const widescreenVideo: FakeAspectRatio = createFakeVideoAspectRatio('widescreen');
  const cinematicVideo: FakeAspectRatio = createFakeVideoAspectRatio('cinematic');
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.section.media')}</p>
      <div className="flex flex-col gap-4">
        <div style={{ width: widescreenVideo.width ?? 640 }}>
          <AspectRatio ratio={widescreenVideo.ratio}>
            <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
              {widescreenVideo.label} ({widescreenVideo.preset})
            </div>
          </AspectRatio>
        </div>
        <div style={{ width: cinematicVideo.width ?? 640 }}>
          <AspectRatio ratio={cinematicVideo.ratio}>
            <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-sm">
              {cinematicVideo.label} ({cinematicVideo.preset})
            </div>
          </AspectRatio>
        </div>
      </div>
    </div>
  );
}

export const VideoPlayer: Story = {
  render: () => <VideoAspectRatioDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Video Player \(widescreen\)/)).toBeInTheDocument();
    expect(canvas.getByText(/Video Player \(cinematic\)/)).toBeInTheDocument();
    const elements = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(elements.length).toBe(2);
  },
};

// ============ FACTORY: createFakeAspectRatioMatrix ============

function AspectRatioMatrixDemo() {
  const matrix: FakeAspectRatio[][] = createFakeAspectRatioMatrix();
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.section.responsive')}</p>
      {matrix.map((row, rowIndex) => (
        <div key={ASPECT_RATIO_PRESETS[rowIndex]} className="flex flex-col gap-2">
          <p className="text-xs font-medium">
            {ASPECT_RATIO_LABELS[ASPECT_RATIO_PRESETS[rowIndex]]}
          </p>
          <div className="flex flex-wrap items-start gap-3">
            {row.map((item) => (
              <div key={item.id} style={{ width: item.width ?? 200 }}>
                <AspectRatio ratio={item.ratio}>
                  <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-[10px]">
                    {item.label}
                  </div>
                </AspectRatio>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const Matrix: Story = {
  render: () => <AspectRatioMatrixDemo />,
  play: async ({ canvasElement }) => {
    const elements = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(elements.length).toBe(ASPECT_RATIO_PRESETS.length * ASPECT_RATIO_SIZES.length);
  },
};

// ============ FACTORY: createFakeAspectRatioConfig ============

function AspectRatioConfigDemo() {
  const scenarios = ['default', 'image', 'video', 'rounded'] as const;
  const configs: FakeAspectRatioConfig[] = scenarios.map((s) => createFakeAspectRatioConfig(s));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.story.description')}</p>
      {configs.map((config, index) => {
        const sizeWidth = ASPECT_RATIO_SIZE_WIDTHS[config.size];
        const widthPx = sizeWidth === 'full' ? 600 : sizeWidth;
        return (
          <div key={scenarios[index]} className="flex flex-col gap-1">
            <p className="text-xs font-medium">
              {scenarios[index]} (size: {config.size}, content:{' '}
              {config.contentType as AspectRatioContentType}, rounded: {String(config.rounded)})
            </p>
            <div style={{ width: widthPx }}>
              <AspectRatio ratio={16 / 9}>
                <div
                  className={`bg-muted flex h-full w-full items-center justify-center border text-xs ${config.rounded ? 'rounded-lg' : ''}`}
                >
                  {scenarios[index]}
                </div>
              </AspectRatio>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const ConfigScenarios: Story = {
  render: () => <AspectRatioConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('default')).toBeInTheDocument();
    expect(canvas.getByText('image')).toBeInTheDocument();
    expect(canvas.getByText('video')).toBeInTheDocument();
    expect(canvas.getByText('rounded')).toBeInTheDocument();
    const elements = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(elements.length).toBe(4);
  },
};

// ============ CONSTANT: ASPECT_RATIO_PRESETS ============

function PresetsConstantDemo() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.section.variants')}</p>
      <div className="flex flex-wrap gap-3">
        {ASPECT_RATIO_PRESETS.map((preset: AspectRatioPreset) => (
          <div key={preset} className="w-[160px]">
            <AspectRatio ratio={ASPECT_RATIO_VALUES[preset]}>
              <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-xs">
                {preset}
              </div>
            </AspectRatio>
          </div>
        ))}
      </div>
    </div>
  );
}

export const PresetsConstant: Story = {
  render: () => <PresetsConstantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const preset of ASPECT_RATIO_PRESETS) {
      expect(canvas.getByText(preset)).toBeInTheDocument();
    }
    const elements = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(elements.length).toBe(ASPECT_RATIO_PRESETS.length);
  },
};

// ============ CONSTANT: ASPECT_RATIO_SIZES ============

function SizesConstantDemo() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.section.sizes')}</p>
      {ASPECT_RATIO_SIZES.map((size: AspectRatioSize) => {
        const widthVal = ASPECT_RATIO_SIZE_WIDTHS[size];
        const widthPx = widthVal === 'full' ? 700 : widthVal;
        return (
          <div key={size} className="flex flex-col gap-1">
            <p className="text-xs font-medium">
              {size} ({String(widthVal)}px)
            </p>
            <div style={{ width: widthPx }}>
              <AspectRatio ratio={16 / 9}>
                <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-xs">
                  {size}
                </div>
              </AspectRatio>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const SizesConstant: Story = {
  render: () => <SizesConstantDemo />,
  play: async ({ canvasElement }) => {
    const elements = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(elements.length).toBe(ASPECT_RATIO_SIZES.length);
  },
};

// ============ CONSTANT: ASPECT_RATIO_CONTENT_TYPES ============

function ContentTypesConstantDemo() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.section.media')}</p>
      <div className="flex flex-wrap gap-3">
        {ASPECT_RATIO_CONTENT_TYPES.map((contentType: AspectRatioContentType) => (
          <div key={contentType} className="w-[180px]">
            <AspectRatio ratio={16 / 9}>
              <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-xs">
                {contentType}
              </div>
            </AspectRatio>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ContentTypesConstant: Story = {
  render: () => <ContentTypesConstantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const ct of ASPECT_RATIO_CONTENT_TYPES) {
      expect(canvas.getByText(ct)).toBeInTheDocument();
    }
    const elements = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(elements.length).toBe(ASPECT_RATIO_CONTENT_TYPES.length);
  },
};

// ============ CONSTANT: ASPECT_RATIO_VALUES ============

function ValuesConstantDemo() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.section.variants')}</p>
      <div className="flex flex-wrap gap-3">
        {ASPECT_RATIO_PRESETS.map((preset: AspectRatioPreset) => {
          const ratio = ASPECT_RATIO_VALUES[preset];
          return (
            <div key={preset} className="w-[180px]">
              <AspectRatio ratio={ratio}>
                <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-xs">
                  {ratio.toFixed(2)}
                </div>
              </AspectRatio>
              <p className="text-muted-foreground mt-1 text-xs">{preset}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ValuesConstant: Story = {
  render: () => <ValuesConstantDemo />,
  play: async ({ canvasElement }) => {
    const elements = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(elements.length).toBe(ASPECT_RATIO_PRESETS.length);
    // Check a known value renders
    const canvas = within(canvasElement);
    expect(canvas.getByText(ASPECT_RATIO_VALUES.square.toFixed(2))).toBeInTheDocument();
  },
};

// ============ CONSTANT: ASPECT_RATIO_LABELS ============

function LabelsConstantDemo() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.section.variants')}</p>
      <div className="flex flex-wrap gap-3">
        {ASPECT_RATIO_PRESETS.map((preset: AspectRatioPreset) => (
          <div key={preset} className="w-[220px]">
            <AspectRatio ratio={ASPECT_RATIO_VALUES[preset]}>
              <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-xs">
                {ASPECT_RATIO_LABELS[preset]}
              </div>
            </AspectRatio>
          </div>
        ))}
      </div>
    </div>
  );
}

export const LabelsConstant: Story = {
  render: () => <LabelsConstantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(ASPECT_RATIO_LABELS.square)).toBeInTheDocument();
    expect(canvas.getByText(ASPECT_RATIO_LABELS.widescreen)).toBeInTheDocument();
    const elements = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(elements.length).toBe(ASPECT_RATIO_PRESETS.length);
  },
};

// ============ CONSTANT: ASPECT_RATIO_SIZE_WIDTHS ============

function SizeWidthsConstantDemo() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.section.sizes')}</p>
      {ASPECT_RATIO_SIZES.map((size: AspectRatioSize) => {
        const width = ASPECT_RATIO_SIZE_WIDTHS[size];
        const widthPx = width === 'full' ? 700 : width;
        return (
          <div key={size} className="flex flex-col gap-1">
            <p className="text-xs font-medium">
              {size}: {String(width)}
              {width !== 'full' ? 'px' : ''}
            </p>
            <div style={{ width: widthPx }}>
              <AspectRatio ratio={16 / 9}>
                <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border text-xs">
                  {String(width)}
                </div>
              </AspectRatio>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const SizeWidthsConstant: Story = {
  render: () => <SizeWidthsConstantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('120')).toBeInTheDocument();
    expect(canvas.getByText('full')).toBeInTheDocument();
    const elements = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(elements.length).toBe(ASPECT_RATIO_SIZES.length);
  },
};

// ============ CONSTANT: ASPECT_RATIO_USE_CASES ============

function UseCasesConstantDemo() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{i18n.t('aspectRatio.section.responsive')}</p>
      {ASPECT_RATIO_USE_CASES.map((entry) => (
        <div key={entry.preset} className="flex flex-col gap-1">
          <p className="text-xs font-medium">{ASPECT_RATIO_LABELS[entry.preset]}</p>
          <div className="w-[260px]">
            <AspectRatio ratio={ASPECT_RATIO_VALUES[entry.preset]}>
              <div className="bg-muted flex h-full w-full items-center justify-center rounded-md border p-2 text-center text-[10px]">
                {entry.useCase}
              </div>
            </AspectRatio>
          </div>
        </div>
      ))}
    </div>
  );
}

export const UseCasesConstant: Story = {
  render: () => <UseCasesConstantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/YouTube videos/)).toBeInTheDocument();
    expect(canvas.getByText(/Instagram posts/)).toBeInTheDocument();
    expect(canvas.getByText(/TikTok/)).toBeInTheDocument();
    const elements = canvasElement.querySelectorAll('[data-slot="aspect-ratio"]');
    expect(elements.length).toBe(ASPECT_RATIO_USE_CASES.length);
  },
};

// ============================================================================
// ADDITIONAL HANDLER STATUS STORIES
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('aspectRatio.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: aspectRatioStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCorruptedImage: Story = {
  ...Default,
  name: i18n.t('aspectRatio.storyName.handlerCorruptedImage', 'Handler: Corrupted Image'),
  parameters: { msw: { handlers: aspectRatioStatusHandlers.corruptedImage } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnsupportedFormat: Story = {
  ...Default,
  name: i18n.t('aspectRatio.storyName.handlerUnsupportedFormat', 'Handler: Unsupported Format'),
  parameters: { msw: { handlers: aspectRatioStatusHandlers.unsupportedFormat } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerDimensionsTooLarge: Story = {
  ...Default,
  name: i18n.t('aspectRatio.storyName.handlerDimensionsTooLarge', 'Handler: Dimensions Too Large'),
  parameters: { msw: { handlers: aspectRatioStatusHandlers.dimensionsTooLarge } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
