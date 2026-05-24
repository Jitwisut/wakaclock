import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

import {
  activeThemeHandlers,
  activeThemeStatusHandlers,
} from '@/.storybook/stories/_handlers/active-theme.handlers';
import { themeHandlers, themeStatusHandlers } from '@/.storybook/stories/_handlers/theme.handlers';
import { THEME_PRESETS } from '@/.storybook/stories/_factories/theme.factory';
import type {
  ActiveThemeMode,
  ActiveThemePreset,
  ActiveThemeRadius,
  FakeActiveTheme,
  FakeActiveThemeConfig,
} from '@/.storybook/stories/_factories/active-theme.factory';
import {
  ACTIVE_THEME_COLORS,
  ACTIVE_THEME_MODES,
  ACTIVE_THEME_PRESETS,
  ACTIVE_THEME_RADII,
  createFakeActiveTheme,
  createFakeActiveThemeConfig,
  createFakeActiveThemes,
  createFakeActiveThemesByPreset,
  createFakeDarkTheme,
  createFakeLightTheme,
} from '@/.storybook/stories/_factories/active-theme.factory';

import { ActiveThemeProvider, useThemeConfig } from '@/components/active-theme';
import type { ThemeType } from '@/lib/themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Demo component that uses the hook
function ThemeConfigDemo() {
  const { t } = useTranslation();
  const { theme, setTheme } = useThemeConfig();

  const handlePresetChange = (preset: string) => {
    setTheme({ ...theme, preset: preset as typeof theme.preset });
  };

  const handleRadiusChange = (radius: string) => {
    setTheme({ ...theme, radius: radius as typeof theme.radius });
  };

  return (
    <Card className="w-[420px]" data-slot="active-theme-demo" data-testid="active-theme-demo">
      <CardHeader>
        <CardTitle>{t('activeTheme.story.themeConfiguration', 'Theme Configuration')}</CardTitle>
        <CardDescription>
          {t('activeTheme.story.customizeYourThemeSettings', 'Customize your theme settings')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t('activeTheme.story.currentPreset', 'Current Preset')}
          </p>
          <Badge data-testid="current-preset" variant="secondary">
            {theme.preset}
          </Badge>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t('activeTheme.story.availablePresets', 'Available Presets')}
          </p>
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                aria-label={t('theme.selectPreset', { preset: preset.name })}
                data-preset={preset.id}
                onClick={() => handlePresetChange(preset.id)}
                size="sm"
                variant={theme.preset === preset.id ? 'default' : 'outline'}
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t('activeTheme.story.borderRadius', 'Border Radius')}
          </p>
          <div className="flex flex-wrap gap-2">
            {(['none', 'sm', 'md', 'lg', 'xl'] as const).map((radius) => (
              <Button
                key={radius}
                aria-label={t('theme.selectRadius', { radius })}
                data-radius={radius}
                onClick={() => handleRadiusChange(radius)}
                size="sm"
                variant={theme.radius === radius ? 'default' : 'outline'}
              >
                {radius}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t('activeTheme.story.currentSettings', 'Current Settings')}
          </p>
          <pre className="bg-muted rounded-md p-3 text-xs" data-testid="theme-json">
            {JSON.stringify(theme, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Wrapper component for stories
function ActiveThemeDemo(props: { initialPreset?: string; initialRadius?: string }) {
  const initialTheme: ThemeType = {
    preset: props.initialPreset ?? 'default',
    radius: (props.initialRadius as ThemeType['radius']) ?? 'md',
    contentLayout: 'full',
    scale: 'none',
  };

  return (
    <ActiveThemeProvider initialTheme={initialTheme} persistToCookies={false}>
      <ThemeConfigDemo />
    </ActiveThemeProvider>
  );
}

// Default children wrapper for meta args
function DefaultChildren() {
  return <ThemeConfigDemo />;
}

const meta = {
  title: 'Components/Custom/Active Theme',
  component: ActiveThemeProvider,
  tags: ['autodocs'],
  args: {
    children: (<DefaultChildren />) as ReactNode,
    persistToCookies: false,
  },
  argTypes: {
    // Props
    initialTheme: {
      control: { type: 'object' },
      description: i18n.t(
        'activeTheme.argType.initialThemeConfiguration',
        'Initial theme configuration'
      ),
      table: {
        category: 'Props',
        type: { summary: 'ThemeType' },
      },
    },
    persistToCookies: {
      control: { type: 'boolean' },
      description: i18n.t(
        'activeTheme.argType.whetherToPersistThemeToCookies',
        'Whether to persist theme to cookies'
      ),
      table: {
        category: 'Props',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    children: {
      control: false,
      description: i18n.t(
        'activeTheme.argType.childComponentsThatCanAccessThemeContext',
        'Child components that can access theme context'
      ),
      table: {
        category: 'Props',
        type: { summary: 'ReactNode' },
      },
    },
    // ActiveThemeProvider Props Reference:
    // - initialTheme: Initial theme configuration (ThemeType)
    //   - preset: Theme preset name ('default' | 'underground' | 'midnight' | 'blossom' | 'forest' | 'ocean')
    //   - radius: Border radius ('none' | 'sm' | 'md' | 'lg' | 'xl')
    //   - scale: Size scale ('none' | 'xs' | 'sm' | 'lg')
    //   - contentLayout: Content layout ('full' | 'centered')
    // - persistToCookies: Save to cookies (boolean, default: true)
    // - children: Child components (ReactNode)
    //
    // useThemeConfig Hook:
    // - theme: Current theme configuration
    // - setTheme: Update theme configuration
    //
    // Usage Notes:
    // - Must wrap components that need theme access
    // - Hook throws if used outside provider
    // - Syncs theme to body dataset attributes
    // - Optionally persists to cookies for SSR
  },
  parameters: {
    msw: { handlers: themeHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ActiveThemeProvider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ActiveThemeDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify the demo component is rendered
    const demo = canvas.getByTestId('active-theme-demo');
    expect(demo).toBeInTheDocument();

    // Verify current preset is displayed
    const presetBadge = canvas.getByTestId('current-preset');
    expect(presetBadge).toBeInTheDocument();

    // Verify theme JSON is displayed
    const themeJson = canvas.getByTestId('theme-json');
    expect(themeJson).toBeInTheDocument();
    expect(themeJson.textContent).toContain('preset');
    expect(themeJson.textContent).toContain('radius');
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('current-preset')).toBeInTheDocument();
  },
};

export const WithPresetChange: Story = {
  ...Default,
  render: () => <ActiveThemeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click on a different preset button
    const forestButton = canvas.getByRole('button', { name: /forest/i });
    await userEvent.click(forestButton);

    // Verify the preset changed
    const presetBadge = canvas.getByTestId('current-preset');
    expect(presetBadge).toHaveTextContent('forest');

    // Verify the JSON updated
    const themeJson = canvas.getByTestId('theme-json');
    expect(themeJson.textContent).toContain('"preset": "forest"');
  },
};

export const WithRadiusChange: Story = {
  ...Default,
  render: () => <ActiveThemeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click on a different radius button
    const lgButton = canvas.getByRole('button', { name: /lg/i });
    await userEvent.click(lgButton);

    // Verify the JSON updated
    const themeJson = canvas.getByTestId('theme-json');
    expect(themeJson.textContent).toContain('"radius": "lg"');
  },
};

export const Variants: Story = {
  ...Default,
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('activeTheme.story.defaultPreset', 'Default Preset')}
        </p>
        <ActiveThemeDemo initialPreset="default" />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('activeTheme.story.midnightPreset', 'Midnight Preset')}
        </p>
        <ActiveThemeDemo initialPreset="midnight" />
      </div>
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  ...Default,
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('activeTheme.story.noRadius', 'No Radius')}
        </p>
        <ActiveThemeDemo initialRadius="none" />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('activeTheme.story.largeRadius', 'Large Radius')}
        </p>
        <ActiveThemeDemo initialRadius="lg" />
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
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('theme-json')).toBeInTheDocument();
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
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
    expect(canvas.getAllByRole('button').length).toBeGreaterThan(0);
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('current-preset')).toBeInTheDocument();
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
  name: i18n.t('activeTheme.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
          <div id="active">
            <StoryRenderer />
          </div>
        </div>
      );
    },
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover button'],
      focusVisible: ['#focus button'],
      active: ['#active button'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  ...Default,
  render: () => {
    const fakerTheme: ThemeType = {
      preset: 'underground',
      radius: 'lg',
      contentLayout: 'centered',
      scale: 'sm',
    };
    return (
      <ActiveThemeProvider initialTheme={fakerTheme} persistToCookies={false}>
        <ThemeConfigDemo />
      </ActiveThemeProvider>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('theme-json')).toBeInTheDocument();
  },
};

// ============ MSW + STATUS STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: [...themeHandlers, ...activeThemeHandlers] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('current-preset')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeStatusHandlers.emptyPresets },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: themeStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('activeTheme.storyName.accessibility', 'Accessibility'),
  render: () => <ActiveThemeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify all preset buttons are accessible
    const presetButtons = canvas.getAllByRole('button');
    expect(presetButtons.length).not.toBe(0);

    // Verify each button has an accessible label
    for (const button of presetButtons) {
      expect(button).toHaveAccessibleName();
    }

    // Test keyboard navigation
    const firstButton = presetButtons[0];
    if (firstButton) {
      firstButton.focus();
      expect(document.activeElement).toBe(firstButton);
    }
  },
};

// ============ FACTORY SHOWCASE ============

export const FactoryShowcase: Story = {
  render: () => {
    const single: FakeActiveTheme = createFakeActiveTheme();
    const themes: FakeActiveTheme[] = createFakeActiveThemes(3);
    const dark: FakeActiveTheme = createFakeDarkTheme();
    const light: FakeActiveTheme = createFakeLightTheme();
    const byPreset: FakeActiveTheme[] = createFakeActiveThemesByPreset();
    const config: FakeActiveThemeConfig = createFakeActiveThemeConfig();
    const allPresets: ActiveThemePreset[] = [...ACTIVE_THEME_PRESETS];
    const allRadii: ActiveThemeRadius[] = [...ACTIVE_THEME_RADII];
    const allModes: ActiveThemeMode[] = [...ACTIVE_THEME_MODES];
    return (
      <div className="space-y-4 p-4">
        <h3 className="text-sm font-medium">Presets: {allPresets.join(', ')}</h3>
        <p className="text-xs">Radii: {allRadii.join(', ')}</p>
        <p className="text-xs">Modes: {allModes.join(', ')}</p>
        <p className="text-xs">Colors: {Object.keys(ACTIVE_THEME_COLORS).length}</p>
        <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
          {JSON.stringify({ single, themes, dark, light, byPreset, config }, null, 2)}
        </pre>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ COMBINED GLOBALS ============

export const DarkRTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('current-preset')).toBeInTheDocument();
    expect(canvas.getByTestId('theme-json')).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('current-preset')).toBeInTheDocument();
  },
};

// ============ MOBILE ============

export const Mobile: Story = {
  ...Default,
  parameters: {
    ...(Default.parameters ?? {}),
    viewport: { defaultViewport: 'mobile1' },
    chromatic: { viewports: [320] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  },
};

// ============ DATA ATTRIBUTES ============

export const DataAttributes: Story = {
  ...Default,
  render: () => <ActiveThemeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('active-theme-demo');
    expect(demo).toBeInTheDocument();
    expect(demo.getAttribute('data-slot')).toBe('active-theme-demo');

    // Verify preset buttons have data-preset attributes
    const presetButtons = canvasElement.querySelectorAll('[data-preset]');
    expect(presetButtons.length).toBeGreaterThan(0);

    // Verify radius buttons have data-radius attributes
    const radiusButtons = canvasElement.querySelectorAll('[data-radius]');
    expect(radiusButtons.length).toBeGreaterThan(0);
  },
};

// ============ ACTIVE THEME STATUS HANDLERS ============

export const ActiveThemeHandlersSuccess: Story = {
  ...Default,
  parameters: {
    msw: { handlers: activeThemeStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: activeThemeStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const ActiveThemeLoading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: activeThemeStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const ActiveThemeNetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: activeThemeStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const ActiveThemeSlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: activeThemeStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const ActiveThemeEmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: activeThemeStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const ActiveThemeBadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: activeThemeStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const ActiveThemeUnauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: activeThemeStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const ActiveThemeForbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: activeThemeStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const ActiveThemeNotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: activeThemeStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const ActiveThemeInternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: activeThemeStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('active-theme-demo')).toBeInTheDocument();
  },
};

export const HandlerThemeUnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'activeTheme.storyName.handlerThemeUnprocessableEntity',
    'Handler: Theme Unprocessable Entity'
  ),
  parameters: { msw: { handlers: themeStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerThemeResetSuccess: Story = {
  ...Default,
  name: i18n.t('activeTheme.storyName.handlerThemeResetSuccess', 'Handler: Theme Reset Success'),
  parameters: { msw: { handlers: themeStatusHandlers.resetSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerThemeResetFailed: Story = {
  ...Default,
  name: i18n.t('activeTheme.storyName.handlerThemeResetFailed', 'Handler: Theme Reset Failed'),
  parameters: { msw: { handlers: themeStatusHandlers.resetFailed } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('activeTheme.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: themeStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
