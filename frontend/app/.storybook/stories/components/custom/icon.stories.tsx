import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn } from 'storybook/test';
import { faker } from '@faker-js/faker';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';

import { formHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import { iconHandlers, iconStatusHandlers } from '@/.storybook/stories/_handlers/icon.handlers';
import type {
  FakeIcon,
  FakeIconGroup,
  IconSize,
} from '@/.storybook/stories/_factories/icon.factory';
import {
  createFakeDecorativeIcon,
  createFakeIcon,
  createFakeIconGroup,
  createFakeIcons,
  createFakeIconsByName,
  createFakeInformativeIcon,
  ICON_NAMES,
  ICON_SIZE_CLASSES,
  ICON_SIZES,
} from '@/.storybook/stories/_factories/icon.factory';
import { Icon } from '@/components/icon';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

const meta = {
  title: 'Components/Custom/Icon',
  component: Icon,
  tags: ['autodocs'],
  args: {
    name: 'Activity',
    className: 'size-6',
    onClick: fn(),
  },
  argTypes: {
    // Content
    name: {
      control: { type: 'text' },
      description: i18n.t(
        'icon.argType.lucideIconNameEgActivityChevrondown',
        'Lucide icon name (e.g., "Activity", "ChevronDown")'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Appearance
    className: {
      control: { type: 'text' },
      description: i18n.t(
        'icon.argType.cssClassesForSizingAndStylingEgSize6',
        'CSS classes for sizing and styling (e.g., "size-6")'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t(
        'icon.argType.clickEventHandlerWhenIconIsInteractive',
        'Click event handler (when icon is interactive)'
      ),
      table: { category: 'Events' },
    },
    // Icon Props Reference (Lucide React wrapper):
    // - name: Lucide icon name (string, required)
    //   - Must match a valid Lucide icon name
    //   - Returns null if icon name not found
    // - className: CSS classes for styling (string)
    // - aria-label: Accessible label for decorative icons (string)
    // - ...rest: All other props passed to SVG element
    //
    // Default SVG Attributes:
    // - aria-hidden="true": Hidden from screen readers by default
    // - focusable="false": Prevents focus in older browsers
    //
    // Usage Notes:
    // - Uses lazy loading with React.lazy for bundle optimization
    // - Add aria-label for meaningful icons (removes aria-hidden)
    // - Missing icons gracefully return null (no error)
    // - Size controlled via className (e.g., "size-4", "size-6")
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

export const AccessibleLabel: Story = {
  name: i18n.t('icon.storyName.accessibleLabel', 'Accessible label (aria-label)'),
  args: {
    'aria-label': 'Activity',
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
    if (svg instanceof SVGElement) {
      expect(svg).toHaveAttribute('aria-label', 'Activity');
    }
  },
};

export const MissingName: Story = {
  args: { name: i18n.t('icon.storyName.missingName', 'ThisDoesNotExist') },
  render: (args) => (
    <div className="text-sm" data-testid="missing-icon-demo">
      <div className="mb-2">Missing icon returns `null`:</div>
      <Icon {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="missing-icon-demo"]')).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');

    expect(svg).toBeInTheDocument();

    if (!(svg instanceof SVGElement)) return;

    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

function IconVariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('icon.categories.actions')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Icon name="Plus" className="size-6" />
          <Icon name="Minus" className="size-6" />
          <Icon name="X" className="size-6" />
          <Icon name="Check" className="size-6" />
          <Icon name="Edit" className="size-6" />
          <Icon name="Trash2" className="size-6" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('icon.categories.navigation')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Icon name="ChevronLeft" className="size-6" />
          <Icon name="ChevronRight" className="size-6" />
          <Icon name="ChevronUp" className="size-6" />
          <Icon name="ChevronDown" className="size-6" />
          <Icon name="ArrowLeft" className="size-6" />
          <Icon name="ArrowRight" className="size-6" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('icon.categories.status')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Icon name="AlertCircle" className="text-destructive size-6" />
          <Icon name="AlertTriangle" className="size-6 text-yellow-500" />
          <Icon name="CheckCircle" className="size-6 text-green-500" />
          <Icon name="Info" className="size-6 text-blue-500" />
          <Icon name="HelpCircle" className="text-muted-foreground size-6" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('icon.categories.media')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Icon name="Play" className="size-6" />
          <Icon name="Pause" className="size-6" />
          <Icon name="SkipBack" className="size-6" />
          <Icon name="SkipForward" className="size-6" />
          <Icon name="Volume2" className="size-6" />
          <Icon name="VolumeX" className="size-6" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('icon.categories.communication')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Icon name="Mail" className="size-6" />
          <Icon name="MessageCircle" className="size-6" />
          <Icon name="Phone" className="size-6" />
          <Icon name="Bell" className="size-6" />
          <Icon name="Send" className="size-6" />
          <Icon name="Share2" className="size-6" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('icon.categories.filesData')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Icon name="File" className="size-6" />
          <Icon name="FileText" className="size-6" />
          <Icon name="Folder" className="size-6" />
          <Icon name="Download" className="size-6" />
          <Icon name="Upload" className="size-6" />
          <Icon name="Copy" className="size-6" />
        </div>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <IconVariantsDemo />,
  play: async ({ canvasElement }) => {
    const svgs = canvasElement.querySelectorAll('svg');
    expect(svgs.length).not.toBe(0);
  },
};

function IconSizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('icon.sizes.extraSmall')}</p>
        <div className="flex items-center gap-3">
          <Icon name="Activity" className="size-3" />
          <Icon name="Bell" className="size-3" />
          <Icon name="Settings" className="size-3" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('icon.sizes.small')}</p>
        <div className="flex items-center gap-3">
          <Icon name="Activity" className="size-4" />
          <Icon name="Bell" className="size-4" />
          <Icon name="Settings" className="size-4" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('icon.sizes.default')}</p>
        <div className="flex items-center gap-3">
          <Icon name="Activity" className="size-5" />
          <Icon name="Bell" className="size-5" />
          <Icon name="Settings" className="size-5" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('icon.sizes.medium')}</p>
        <div className="flex items-center gap-3">
          <Icon name="Activity" className="size-6" />
          <Icon name="Bell" className="size-6" />
          <Icon name="Settings" className="size-6" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('icon.sizes.large')}</p>
        <div className="flex items-center gap-3">
          <Icon name="Activity" className="size-8" />
          <Icon name="Bell" className="size-8" />
          <Icon name="Settings" className="size-8" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('icon.sizes.extraLarge')}</p>
        <div className="flex items-center gap-3">
          <Icon name="Activity" className="size-10" />
          <Icon name="Bell" className="size-10" />
          <Icon name="Settings" className="size-10" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('icon.sizes.hero')}</p>
        <div className="flex items-center gap-3">
          <Icon name="Activity" className="size-16" />
          <Icon name="Bell" className="size-16" />
          <Icon name="Settings" className="size-16" />
        </div>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <IconSizesDemo />,
  play: async ({ canvasElement }) => {
    const svgs = canvasElement.querySelectorAll('svg');
    expect(svgs.length).not.toBe(0);
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();

    if (!(svg instanceof SVGElement)) return;

    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
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
  name: i18n.t('icon.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
  name: i18n.t('icon.storyName.accessibility', 'Accessibility'),
  args: {
    name: 'Activity',
    'aria-label': 'Activity indicator',
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();

    if (!(svg instanceof SVGElement)) return;

    // Verify decorative icon attributes (default behavior)
    // When aria-label is provided, aria-hidden should be removed
    expect(svg).toHaveAttribute('aria-label', 'Activity indicator');

    // Verify focusable attribute prevents focus in older browsers
    expect(svg).toHaveAttribute('focusable', 'false');

    // Test that icon renders correctly
    expect(svg.tagName.toLowerCase()).toBe('svg');
  },
};

export const AccessibilityDecorative: Story = {
  name: i18n.t('icon.storyName.accessibilityDecorative', 'Accessibility (Decorative)'),
  args: {
    name: 'Activity',
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();

    if (!(svg instanceof SVGElement)) return;

    // Decorative icons should be hidden from screen readers
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const randomIcons = faker.helpers.shuffle([...ICON_NAMES]).slice(0, 5);
    return (
      <div className="flex gap-4">
        {randomIcons.map((name) => (
          <Icon key={name} name={name} className="size-6" />
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const svgs = canvasElement.querySelectorAll('svg');
    expect(svgs.length).not.toBe(0);
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formHandlers },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

// ============ MSW + STATUS STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: [...formHandlers, ...iconHandlers] },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: iconStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('icon.storyName.emptyData', 'Empty (missing icon)'),
  args: {
    name: 'NonExistentIcon',
  },
  render: (args) => (
    <div className="text-sm">
      <div className="mb-2">
        {i18n.t('icon.story.missingIconReturnsNull', 'Missing icon returns null:')}
      </div>
      <Icon {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  name: i18n.t('icon.storyName.error404NotFound', 'Error 404: Not Found'),
  ...Default,
  parameters: {
    msw: { handlers: iconStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('icon.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Default,
  parameters: {
    msw: { handlers: iconStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('icon.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Default,
  parameters: {
    msw: { handlers: iconStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('icon.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Default,
  parameters: {
    msw: { handlers: iconStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('icon.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: iconStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t('icon.storyName.error500InternalServerError', 'Error 500: Internal Server Error'),
  ...Default,
  parameters: {
    msw: { handlers: iconStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t('icon.storyName.error422UnprocessableEntity', 'Error 422: Unprocessable Entity'),
  ...Default,
  parameters: {
    msw: { handlers: iconStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

export const EmptyDataHandler: Story = {
  name: i18n.t('icon.storyName.emptyDataHandler', 'Handler: Empty Data'),
  ...Default,
  parameters: {
    msw: { handlers: iconStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

export const NoSearchResults: Story = {
  name: i18n.t('icon.storyName.noSearchResults', 'Handler: No Search Results'),
  ...Default,
  parameters: {
    msw: { handlers: iconStatusHandlers.noSearchResults },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

// ============ SPECIAL STATE STORIES ============

export const NetworkError: Story = {
  name: i18n.t('icon.storyName.networkError', 'Network Error'),
  ...Default,
  parameters: {
    msw: { handlers: iconStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

// ============ FACTORY DATA STORIES ============

function FakerIconDemo() {
  const fakerIcons = createFakeIconsByName();

  return (
    <div className="flex flex-wrap gap-4 p-4" data-testid="faker-icon-grid">
      {fakerIcons.map((icon) => (
        <div key={icon.id} className="flex flex-col items-center gap-1">
          <Icon name={icon.name} className={ICON_SIZE_CLASSES[icon.size]} />
          <span className="text-muted-foreground text-xs">{icon.name}</span>
        </div>
      ))}
    </div>
  );
}

export const WithFactoryData: Story = {
  render: () => <FakerIconDemo />,
  play: async ({ canvasElement }) => {
    const grid = canvasElement.querySelector('[data-testid="faker-icon-grid"]');
    expect(grid).toBeInTheDocument();

    const svgs = canvasElement.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY SHOWCASE ============

export const FactoryShowcase: Story = {
  render: () => {
    const icon: FakeIcon = createFakeIcon();
    const icons: FakeIcon[] = createFakeIcons(3);
    const decorative: FakeIcon = createFakeDecorativeIcon();
    const informative: FakeIcon = createFakeInformativeIcon();
    const group: FakeIconGroup = createFakeIconGroup();
    const allSizes: IconSize[] = [...ICON_SIZES];
    return (
      <div className="space-y-4 p-4">
        <h3 className="text-sm font-medium">Sizes: {allSizes.join(', ')}</h3>
        <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
          {JSON.stringify({ icon, icons, decorative, informative, group }, null, 2)}
        </pre>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes / Handler wiring
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('icon.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('icon.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('icon.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('icon.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
    // Icon component renders an SVG element
    expect(svg?.tagName.toLowerCase()).toBe('svg');
  },
};

export const StatusSuccess: Story = {
  ...Default,
  name: i18n.t('icon.storyName.statusSuccess', 'Handler: Success'),
  parameters: {
    msw: { handlers: iconStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg');
    expect(svg).toBeInTheDocument();
  },
};
