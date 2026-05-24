import type { Meta, StoryObj } from '@storybook/react';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { expect, fn, waitFor, within } from 'storybook/test';

import {
  createFakeLogo,
  createFakeLogoAlt,
  createFakeLogos,
  createFakeLogoSrc,
} from '@/.storybook/stories/_factories/logo.factory';
import { logoHandlers, logoStatusHandlers } from '@/.storybook/stories/_handlers/logo.handlers';

import Logo, { type LogoProps } from '@/components/layout/logo';

import i18n from 'i18next';

seedFaker();

function LogoDemo(props: LogoProps) {
  const { t } = useTranslation();

  return <Logo {...props} alt={props.alt ?? t('logo.alt')} />;
}

const meta = {
  title: 'Components/Layout/Logo',
  component: LogoDemo,
  tags: ['autodocs'],
  args: {
    // Event handlers with fn() for Actions panel logging
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onLoad: fn(),
    onError: fn(),
  },
  argTypes: {
    // Content
    alt: {
      control: { type: 'text' },
      description: i18n.t('logo.argType.altTextForTheLogoImage', 'Alt text for the logo image'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
        defaultValue: { summary: 'shadcn ui kit logo' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('logo.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('logo.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('logo.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('logo.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('logo.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('logo.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('logo.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onLoad: {
      action: 'onLoad',
      description: i18n.t(
        'logo.argType.calledWhenLogoImageLoadsSuccessfully',
        'Called when logo image loads successfully'
      ),
      table: { category: 'Events' },
    },
    onError: {
      action: 'onError',
      description: i18n.t(
        'logo.argType.calledWhenLogoImageFailsToLoad',
        'Called when logo image fails to load'
      ),
      table: { category: 'Events' },
    },
    // Logo Props Reference:
    // Optional Props:
    // - alt: string - Alt text for accessibility (default: "shadcn ui kit logo")
    //
    // Image Details:
    // - Source: /images/logo.png
    // - Optimized with Next.js Image component
    // - Priority loading enabled
    // - Fixed dimensions for layout stability
    //
    // Accessibility:
    // - Alt text always provided (prop or fallback)
    // - Semantic img element
    //
    // Usage:
    // - Typically placed in sidebar header
    // - Can be wrapped in Link for navigation
    // - Supports localized alt text via i18n
    //
    // Data Attributes:
    // - data-testid="app-logo": Logo image element
  },
  parameters: {
    msw: { handlers: logoHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} as Meta;

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

    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();

    const canvas = within(canvasElement);
    const img = canvas.getByTestId('app-logo');

    if (!(img instanceof HTMLImageElement)) {
      throw new TypeError('Logo did not render an image element.');
    }

    expect(img).toHaveAttribute('alt', expect.stringMatching(/\S/));
    expect(img.src).toContain('logo.png');
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const FallbackAlt: Story = {
  render: () => <Logo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const img = canvas.getByTestId('app-logo');

    if (!(img instanceof HTMLImageElement)) {
      throw new TypeError('Logo did not render an image element.');
    }

    expect(img.getAttribute('alt')).toBe('shadcn ui kit logo');
    expect(img.src).toContain('logo.png');
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('logo.story.defaultLogo', 'Default Logo')}
        </p>
        <Logo />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('logo.story.withCustomAltText', 'With Custom Alt Text')}
        </p>
        <Logo alt={i18n.t('logo.story.customCompanyLogo', 'Custom company logo')} />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('logo.story.logoInLinkContext', 'Logo in Link Context')}
        </p>
        <a href="/home" className="inline-block">
          <Logo />
        </a>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText(/Default Logo/i)).toBeInTheDocument();
    expect(canvas.getByText(/With Custom Alt Text/i)).toBeInTheDocument();
    expect(canvas.getByText(/Logo in Link Context/i)).toBeInTheDocument();

    const logos = canvasElement.querySelectorAll('[data-slot="logo"]');
    expect(logos.length).toBe(3);
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('logo.story.smallContainer100px', 'Small Container (100px)')}
        </p>
        <div className="w-[100px]">
          <Logo />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('logo.story.mediumContainer200px', 'Medium Container (200px)')}
        </p>
        <div className="w-[200px]">
          <Logo />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('logo.story.largeContainer400px', 'Large Container (400px)')}
        </p>
        <div className="w-[400px]">
          <Logo />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('logo.story.fullWidthContainer', 'Full Width Container')}
        </p>
        <div className="w-full max-w-xl">
          <Logo />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const logos = canvasElement.querySelectorAll('[data-slot="logo"]');
    expect(logos.length).toBe(4);
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
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('logo.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;
    await waitFor(() => {
      expect(doc.documentElement.lang).toBe('ja');
    });

    const img = canvas.getByTestId('app-logo');

    if (!(img instanceof HTMLImageElement)) {
      throw new TypeError('Logo did not render an image element.');
    }

    expect(img).toHaveAttribute('alt', expect.stringMatching(/\S/));
    expect(img.src).toContain('logo.png');
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
  name: i18n.t('logo.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============================================================================
// FACTORY & MSW STORIES
// ============================================================================

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('logo.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify logo has proper structure
    const logo = canvasElement.querySelector('[data-slot="logo"]');
    expect(logo).toBeInTheDocument();

    // Get the logo image
    const img = canvas.getByTestId('app-logo');
    expect(img).toBeInTheDocument();

    // Verify image is actually an img element
    expect(img.tagName.toLowerCase()).toBe('img');

    // Verify alt text is present and meaningful
    expect(img).toHaveAttribute('alt');
    const altText = img.getAttribute('alt');
    expect(altText!.trim().length).not.toBe(0);

    // Verify alt text is not just "image" or "logo" (redundant)
    expect(altText!.trim()).not.toMatch(/^(?:image|logo|picture|photo|icon)$/i);

    // Test keyboard focusability when wrapped in link
    const links = canvasElement.querySelectorAll('a');
    links.forEach((link) => {
      link.focus();
      expect(canvasElement.ownerDocument.activeElement).toBe(link);
    });

    // Verify image has proper loading attributes
    // Next.js Image component may use either loading="eager" or fetchpriority="high" for priority images
    const loading = img.getAttribute('loading');
    const priority = img.getAttribute('fetchpriority');
    const hasPriorityLoading = loading === 'eager' || priority === 'high' || loading === null;
    expect(hasPriorityLoading).toBe(true);
  },
};

// ============================================================================
// Factory Data Stories
// ============================================================================

function FactoryDataDemo() {
  const logo = createFakeLogo();
  const logos = createFakeLogos(3);
  const alt = createFakeLogoAlt();
  const src = createFakeLogoSrc();

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-lg font-semibold">{i18n.t('logo.story.factoryData', 'Factory Data')}</h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-2 text-xs">
        {JSON.stringify({ logo, logos, alt, src }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Factory Data')).toBeInTheDocument();
  },
};

// ============================================================================
// STANDARD AUDIT STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('logo.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('logo.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('logo.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('logo.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// REMAINING STATUS HANDLER STORIES
// ============================================================================

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: logoStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="logo"]')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('logo.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: logoStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
