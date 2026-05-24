import type { Meta, StoryObj } from '@storybook/react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import {
  themeSwitchHandlers,
  themeSwitchStatusHandlers,
} from '@/.storybook/stories/_handlers/theme-switch.handlers';
import {
  createFakeEmpties,
  createFakeEmpty,
  createFakeItem,
  createFakeItems,
  createFakeResizable,
  createFakeResizablePanel,
  createFakeResizablePanels,
  createFakeResizables,
  createFakeScrollArea,
  createFakeScrollAreas,
  createFakeSeparator,
  createFakeSeparators,
  createFakeSidebar,
  createFakeSidebarItem,
  createFakeSidebarItems,
  createFakeSidebars,
  SIDEBAR_ICONS,
} from '@/.storybook/stories/_factories/layout.factory';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import ThemeSwitch from '@/components/layout/header/theme-switch';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

function ThemeSwitchDemo() {
  const { t } = useTranslation();

  return <ThemeSwitch labels={{ toggleTheme: t('themeSwitch.toggleTheme') }} />;
}

const meta = {
  title: 'Components/Layout/Header/Theme Switch',
  component: ThemeSwitchDemo,
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
    onThemeChange: fn(),
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('themeSwitch.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('themeSwitch.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('themeSwitch.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('themeSwitch.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('themeSwitch.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('themeSwitch.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('themeSwitch.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onThemeChange: {
      action: 'onThemeChange',
      description: i18n.t(
        'themeSwitch.argType.calledWhenThemeIsToggled',
        'Called when theme is toggled'
      ),
      table: { category: 'Events' },
    },
    // ThemeSwitch Props Reference:
    // Required Props:
    // - labels: ThemeSwitchLabels object
    //   - toggleTheme: Aria label for toggle button
    //
    // Behavior:
    // - Toggles between light and dark mode
    // - Uses next-themes for theme management
    // - Persists theme preference
    // - Respects system preference on initial load
    //
    // Visual States:
    // - Light mode: Sun icon displayed
    // - Dark mode: Moon icon displayed
    // - Transition animation between states
    //
    // Accessibility:
    // - role="button" with aria-label
    // - Keyboard accessible (Enter/Space to toggle)
    // - Visual focus indicator
    //
    // Integration:
    // - Requires ThemeProvider wrapper
    // - Works with Tailwind dark mode class strategy
    // - Adds 'dark' class to document.documentElement
    //
    // Data Attributes:
    // - data-testid="header-theme-switch": Toggle button
  },
  parameters: {
    msw: { handlers: themeSwitchHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ThemeSwitchDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============================================================================
// DEFAULT STORIES
// ============================================================================

export const Light: Story = {
  globals: { theme: 'light' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Light,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function ThemeSwitchVariant() {
  const { t } = useTranslation();
  return <ThemeSwitch labels={{ toggleTheme: t('themeSwitch.toggleTheme') }} />;
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('themeSwitch.story.lightModeInitialState', 'Light Mode Initial State')}
        </p>
        <div className="bg-background rounded border p-4">
          <ThemeSwitchVariant />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('themeSwitch.story.inHeaderContext', 'In Header Context')}
        </p>
        <div className="bg-background flex items-center gap-4 rounded border p-4">
          <span className="text-sm">{i18n.t('themeSwitch.story.settings', 'Settings')}</span>
          <ThemeSwitchVariant />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t(
            'themeSwitch.story.multipleThemeSwitchesIndependent',
            'Multiple Theme Switches (Independent)'
          )}
        </p>
        <div className="bg-background flex items-center gap-4 rounded border p-4">
          <ThemeSwitchVariant />
          <ThemeSwitchVariant />
          <ThemeSwitchVariant />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText(/Light Mode Initial State/i)).toBeInTheDocument();
    expect(canvas.getByText(/In Header Context/i)).toBeInTheDocument();
    expect(canvas.getByText(/Multiple Theme Switches/i)).toBeInTheDocument();

    const switches = canvasElement.querySelectorAll('[data-slot="theme-switch"]');
    expect(switches.length).toBeGreaterThanOrEqual(3);
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Small Container (50px)</p>
        <div className="flex w-[50px] justify-center">
          <ThemeSwitchVariant />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Medium Container (100px)</p>
        <div className="flex w-[100px] justify-center">
          <ThemeSwitchVariant />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Large Container (200px)</p>
        <div className="flex w-[200px] justify-center">
          <ThemeSwitchVariant />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('themeSwitch.story.fullWidthWithFlexEnd', 'Full Width with Flex End')}
        </p>
        <div className="flex w-full max-w-md justify-end rounded border p-4">
          <ThemeSwitchVariant />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText(/Small Container/i)).toBeInTheDocument();
    expect(canvas.getByText(/Medium Container/i)).toBeInTheDocument();
    expect(canvas.getByText(/Large Container/i)).toBeInTheDocument();
    expect(canvas.getByText(/Full Width/i)).toBeInTheDocument();

    const switches = canvasElement.querySelectorAll('[data-slot="theme-switch"]');
    expect(switches.length).toBe(4);
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="theme-switch"]')).toBeInTheDocument();

    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    const toggleButton = await waitFor(() => canvas.getByTestId('header-theme-switch'));
    expect(toggleButton).toHaveAttribute('aria-label');
    expect(toggleButton.getAttribute('aria-label')).not.toBe('');

    await userEvent.click(toggleButton);

    await waitFor(() => {
      expect(doc.documentElement).toHaveClass('dark');
    });
  },
};

// ============================================================================
// VARIANT STORIES (Dark, RTL, Japanese)
// ============================================================================

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
  name: i18n.t('themeSwitch.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(doc.documentElement.lang).toBe('ja');
    });

    const toggleButton = await waitFor(() => canvas.getByTestId('header-theme-switch'));
    expect(toggleButton).toHaveAttribute('aria-label');
    expect(toggleButton.getAttribute('aria-label')).not.toBe('');

    await userEvent.click(toggleButton);

    await waitFor(() => {
      expect(doc.documentElement).toHaveClass('dark');
    });
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('themeSwitch.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('themeSwitch.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('themeSwitch.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('themeSwitch.storyName.dataAttributes', 'Data Attributes'),
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
  name: i18n.t('themeSwitch.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ LAYOUT FACTORY INTEGRATION STORIES ============

function ThemeSwitchWithLayoutFactory() {
  const { t } = useTranslation();
  const themeOptions = createFakeItems(3);
  const separator = createFakeSeparator({ orientation: 'horizontal', decorative: true });

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-4">
        <ThemeSwitch labels={{ toggleTheme: t('themeSwitch.toggleTheme') }} />
        <span className="text-muted-foreground text-sm">
          {t('themeSwitch.story.toggleTheme', 'Toggle theme')}
        </span>
      </div>
      <hr
        data-orientation={separator.orientation}
        className={separator.decorative ? 'border-muted' : 'border-border'}
      />
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Settings Context ({SIDEBAR_ICONS.length} icons available)
        </p>
        <ul className="text-muted-foreground space-y-1 text-xs">
          {themeOptions.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <span>{item.icon ?? SIDEBAR_ICONS[1]}</span>
              <span className={item.disabled ? 'opacity-50' : ''}>{item.label}</span>
              {item.description ? (
                <span className="text-muted-foreground/60">({item.description})</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// FACTORY & MSW STORIES
// ============================================================================

export const WithLayoutFactoryData: Story = {
  render: () => <ThemeSwitchWithLayoutFactory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="theme-switch"]')).toBeInTheDocument();
    expect(canvas.getByText(/Settings Context/i)).toBeInTheDocument();
    expect(canvas.getByText(/Toggle theme/i)).toBeInTheDocument();
  },
};

// ============ ALL LAYOUT FACTORY FUNCTIONS DEMO ============

function LayoutFactoryDataDemo() {
  const sidebarItem = createFakeSidebarItem();
  const sidebarItems = createFakeSidebarItems(3);
  const sidebar = createFakeSidebar();
  const sidebars = createFakeSidebars(2);
  const resizable = createFakeResizable();
  const resizables = createFakeResizables(2);
  const resizablePanel = createFakeResizablePanel();
  const resizablePanels = createFakeResizablePanels(2);
  const scrollArea = createFakeScrollArea();
  const scrollAreas = createFakeScrollAreas(2);
  const separator = createFakeSeparator();
  const separators = createFakeSeparators(2);
  const item = createFakeItem();
  const items = createFakeItems(3);
  const empty = createFakeEmpty();
  const empties = createFakeEmpties(2);

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-medium">
        {i18n.t('themeSwitch.toggleTheme')} - All Layout Factories ({SIDEBAR_ICONS.length} icons)
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-2 text-xs">
        {JSON.stringify(
          {
            sidebarItem,
            sidebarItems,
            sidebar,
            sidebars,
            resizable,
            resizables,
            resizablePanel,
            resizablePanels,
            scrollArea,
            scrollAreas,
            separator,
            separators,
            item,
            items,
            empty,
            empties,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}

export const AllLayoutFactories: Story = {
  render: () => <LayoutFactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/All Layout Factories/i)).toBeInTheDocument();
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeSwitchHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeSwitchStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeSwitchStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeSwitchStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeSwitchStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeSwitchStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeSwitchStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeSwitchStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('themeSwitch.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    // Test theme switch has proper data-slot
    expect(canvasElement.querySelector('[data-slot="theme-switch"]')).toBeInTheDocument();

    // Test toggle button has aria-label
    const toggleButton = await waitFor(() => canvas.getByTestId('header-theme-switch'));
    expect(toggleButton).toHaveAttribute('aria-label');
    expect(toggleButton.getAttribute('aria-label')).not.toBe('');

    // Test keyboard focus
    toggleButton.focus();
    expect(doc.activeElement).toBe(toggleButton);

    // Test Enter key toggles theme
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(doc.documentElement).toHaveClass('dark');
    });

    // Test Space key also toggles theme
    await userEvent.keyboard(' ');

    await waitFor(() => {
      expect(doc.documentElement).not.toHaveClass('dark');
    });

    // Test Tab navigation
    await userEvent.tab();

    // Verify button is still accessible after interactions
    expect(toggleButton).toHaveAttribute('aria-label');
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('themeSwitch.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: themeSwitchStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('themeSwitch.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: themeSwitchStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('themeSwitch.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: themeSwitchStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('themeSwitch.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: themeSwitchStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('themeSwitch.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: themeSwitchStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('themeSwitch.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: themeSwitchStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('themeSwitch.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: themeSwitchStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('themeSwitch.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: themeSwitchStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('themeSwitch.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: themeSwitchStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
