import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect, useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  ACCENT_COLORS,
  COLOR_MODES,
  CONTENT_LAYOUTS,
  createAccessibleThemeConfig,
  createCompactThemeConfig,
  createDarkThemeConfig,
  createDefaultThemeConfig,
  createFakeEnterpriseThemeConfig,
  createFakeEnterpriseThemeSet,
  createFakeThemeAccentColorModeMatrix,
  createFakeThemeColorModeScaleMatrix,
  createFakeThemeConfig,
  createFakeThemeConfigs,
  createFakeThemeConfigsWithAllAccents,
  createFakeThemeConfigsWithAllColorModes,
  createFakeThemeConfigsWithAllPresets,
  createFakeThemeConfigsWithAllRadii,
  createFakeThemeConfigsWithAllScales,
  createFakeThemeCustomization,
  createFakeThemeCustomizations,
  createFakeThemeExport,
  createFakeThemeExports,
  createFakeThemeHistories,
  createFakeThemeHistory,
  createFakeThemePreference,
  createFakeThemePreferences,
  createFakeThemePresetColorModeMatrix,
  createFakeThemePresetInfo,
  createFakeThemePresetRadiusMatrix,
  createFakeThemePresets,
  createFakeThemeShowcase,
  createLightThemeConfig,
  createSpaciousThemeConfig,
  FONT_FAMILIES,
  SIDEBAR_MODES,
  THEME_PRESET_IDS,
  THEME_PRESETS,
  THEME_RADII,
  THEME_SCALES,
  type ThemeConfig,
} from '@/.storybook/stories/_factories/theme.factory';
import { useTranslation } from 'react-i18next';
import {
  resetThemeHandlers,
  resetThemeStatusHandlers,
} from '@/.storybook/stories/_handlers/reset-theme.handlers';
import { ResetThemeButton } from '@/components/theme-customizer/reset-theme';

import i18n from 'i18next';

seedFaker();

// ============================================================================
// Frame Components
// ============================================================================

type ResetThemeButtonFrameProps = {
  label?: string;
  onClick?: () => void;
};

function ResetThemeButtonFrame({ label, onClick }: ResetThemeButtonFrameProps) {
  return (
    <ResetThemeButton
      labels={{
        text: label ?? i18n.t('resetThemeButton.text'),
      }}
      {...(onClick && { onClick })}
    />
  );
}

// ============================================================================
// Async Wrapper Component
// ============================================================================

type AsyncResetThemeButtonFrameProps = {
  label?: string;
  onClick?: () => void;
};

function AsyncResetThemeButtonFrame({ label, onClick }: AsyncResetThemeButtonFrameProps) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themeConfig, setThemeConfig] = useState<ReturnType<typeof createFakeThemeConfig> | null>(
    null
  );

  useEffect(() => {
    const fetchThemeConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/theme');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = (await response.json()) as ReturnType<typeof createFakeThemeConfig>;
        setThemeConfig(data);
        setError(null);
      } catch (error_) {
        setError(error_ instanceof Error ? error_.message : 'Failed to load theme');
      } finally {
        setLoading(false);
      }
    };

    fetchThemeConfig();
  }, []);

  if (loading) {
    return (
      <div
        className="flex h-20 items-center justify-center"
        data-testid="reset-theme-button-loading"
      >
        <div className="text-muted-foreground text-sm">
          {t('resetTheme.story.loadingThemeConfiguration', 'Loading theme configuration...')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-destructive/10 text-destructive rounded-md p-4"
        data-testid="reset-theme-button-error"
      >
        <p className="text-sm font-medium">
          {t('resetTheme.story.errorLoadingTheme', 'Error loading theme')}
        </p>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div data-testid="reset-theme-button-async-loaded" data-initial-preset={themeConfig?.preset}>
      <ResetThemeButton
        labels={{
          text: label ?? i18n.t('resetThemeButton.text'),
        }}
        {...(onClick && { onClick })}
      />
    </div>
  );
}

// ============================================================================
// Faker Data Component
// ============================================================================

function ResetThemeButtonWithFakerData() {
  const config = createFakeThemeConfig();

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-4">
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('resetTheme.story.generatedThemeConfig', 'Generated Theme Config')}
        </h3>
        <pre className="text-xs" data-testid="faker-config">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>
      <div
        data-theme-preset={config.preset}
        data-theme-radius={config.radius}
        data-theme-scale={config.scale}
        data-theme-content-layout={config.contentLayout}
      >
        <ResetThemeButtonFrame />
      </div>
    </div>
  );
}

// ============================================================================
// Meta Configuration
// ============================================================================

const meta = {
  title: 'Components/Theme Customizer/Reset Theme Button',
  component: ResetThemeButtonFrame,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
  },
  argTypes: {
    label: {
      control: { type: 'text' },
      description: i18n.t(
        'resetTheme.argType.customButtonTextOverridesLocalizedDefault',
        'Custom button text (overrides localized default)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
        defaultValue: { summary: 't("resetThemeButton.text")' },
      },
    },
    onClick: {
      action: 'clicked',
      description: i18n.t(
        'resetTheme.argType.callbackWhenResetButtonIsClicked',
        'Callback when reset button is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
    // ResetThemeButton Props Reference:
    // Optional Props:
    // - labels: ResetThemeButtonLabels object
    //   - text: Button text (e.g., "Reset theme")
    // - onClick: Callback when button is clicked
    //
    // Behavior:
    // - Resets all theme customizations to defaults
    // - Clears: preset, radius, scale selections
    // - Resets content layout to "full"
    //
    // Theme Attributes Cleared:
    // - data-theme-preset: Removed (uses default palette)
    // - data-theme-radius: Removed (uses default radius)
    // - data-theme-scale: Removed (uses default scale)
    // - data-theme-content-layout: Reset to "full"
    //
    // Visual Features:
    // - Ghost variant button
    // - Destructive styling to indicate reset action
    // - Hover/focus states for interaction feedback
    //
    // Accessibility:
    // - Standard button semantics
    // - Keyboard accessible (Tab, Enter/Space)
    // - Clear action label for screen readers
    //
    // Data Attributes:
    // - data-slot="reset-theme": Root container
    // - data-testid="reset-theme-button": Reset button element
  },
  parameters: {
    msw: { handlers: resetThemeHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ResetThemeButtonFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============================================================================
// Core Stories
// ============================================================================

export const Default: Story = {
  globals: {
    preset: 'underground',
    radius: 'xl',
    scale: 'lg',
    contentLayout: 'centered',
  },
  play: async ({ canvasElement, args }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="reset-theme"]')).toBeInTheDocument();

    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(doc.body.dataset.themePreset).toBe('underground');
      expect(doc.body.dataset.themeRadius).toBe('xl');
      expect(doc.body.dataset.themeScale).toBe('lg');
      expect(doc.body.dataset.themeContentLayout).toBe('centered');
    });

    const button = canvas.getByTestId('reset-theme-button');

    await userEvent.click(button);

    await waitFor(() => {
      expect(doc.body.dataset.themePreset).toBeUndefined();
      expect(doc.body.dataset.themeRadius).toBeUndefined();
      expect(doc.body.dataset.themeScale).toBeUndefined();
      expect(doc.body.dataset.themeContentLayout).toBe('full');
      expect(args.onClick).toHaveBeenCalled();
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// Variant Stories
// ============================================================================

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('resetTheme.story.defaultLabel', 'Default Label')}
        </p>
        <ResetThemeButtonFrame />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('resetTheme.story.customLabelShort', 'Custom Label - Short')}
        </p>
        <ResetThemeButtonFrame label={i18n.t('resetTheme.story.reset', 'Reset')} />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('resetTheme.story.customLabelLong', 'Custom Label - Long')}
        </p>
        <ResetThemeButtonFrame
          label={i18n.t('resetTheme.story.resetAllThemeSettings', 'Reset All Theme Settings')}
        />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          With Active Theme (Before Reset)
        </p>
        <div data-theme-preset="underground" data-theme-radius="xl">
          <ResetThemeButtonFrame />
        </div>
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
        <p className="text-muted-foreground mb-2 text-sm font-medium">Narrow Container (150px)</p>
        <div className="border-muted w-[150px] border border-dashed p-2">
          <ResetThemeButtonFrame />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Medium Container (250px)</p>
        <div className="border-muted w-[250px] border border-dashed p-2">
          <ResetThemeButtonFrame />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Wide Container (350px)</p>
        <div className="border-muted w-[350px] border border-dashed p-2">
          <ResetThemeButtonFrame />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('resetTheme.story.fullWidth', 'Full Width')}
        </p>
        <div className="border-muted w-full border border-dashed p-2">
          <ResetThemeButtonFrame />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const CustomLabel: Story = {
  ...Default,
  args: {
    ...(Default.args ?? {}),
    label: i18n.t('resetTheme.story.resetNow', 'Reset now'),
  },
  play: async (context) => {
    if (!context.canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(context.canvasElement);
    const button = canvas.getByTestId('reset-theme-button');

    await waitFor(() => {
      expect(button).toHaveTextContent('Reset now');
    });
  },
};

// ============================================================================
// Theme Stories
// ============================================================================

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
  name: i18n.t('resetTheme.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');
    await Default.play?.(context);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('resetTheme.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('resetTheme.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('resetTheme.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// Data Stories
// ============================================================================

export const WithFakerData: Story = {
  render: () => <ResetThemeButtonWithFakerData />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('faker-config')).toBeInTheDocument();
    });

    expect(canvasElement.querySelector('[data-slot="reset-theme"]')).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  render: (args) => <AsyncResetThemeButtonFrame {...args} />,
  parameters: {
    msw: { handlers: resetThemeHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // First check for loading state
    await waitFor(() => {
      const loading = canvas.queryByTestId('reset-theme-button-loading');
      const loaded = canvas.queryByTestId('reset-theme-button-async-loaded');
      expect(loading || loaded).toBeInTheDocument();
    });

    // Then wait for loaded state
    await waitFor(
      () => {
        expect(canvas.getByTestId('reset-theme-button-async-loaded')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="reset-theme"]')).toBeInTheDocument();
  },
};

// ============================================================================
// Loading & Error Stories
// ============================================================================

export const Loading: Story = {
  render: (args) => <AsyncResetThemeButtonFrame {...args} />,
  parameters: {
    msw: { handlers: resetThemeStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('reset-theme-button-loading')).toBeInTheDocument();
    });
  },
};

export const SlowResponse: Story = {
  render: (args) => <AsyncResetThemeButtonFrame {...args} />,
  parameters: {
    msw: { handlers: resetThemeStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Starts in loading state
    await waitFor(() => {
      expect(canvas.getByTestId('reset-theme-button-loading')).toBeInTheDocument();
    });

    // Eventually loads
    await waitFor(
      () => {
        expect(canvas.getByTestId('reset-theme-button-async-loaded')).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
  },
};

// ============================================================================
// HTTP 4xx Error Stories
// ============================================================================

export const Error400BadRequest: Story = {
  render: (args) => <AsyncResetThemeButtonFrame {...args} />,
  parameters: {
    msw: { handlers: resetThemeStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('reset-theme-button-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(canvas.getByText(/Error loading theme/i)).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  render: (args) => <AsyncResetThemeButtonFrame {...args} />,
  parameters: {
    msw: { handlers: resetThemeStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('reset-theme-button-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  render: (args) => <AsyncResetThemeButtonFrame {...args} />,
  parameters: {
    msw: { handlers: resetThemeStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('reset-theme-button-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error422UnprocessableEntity: Story = {
  render: (args) => <AsyncResetThemeButtonFrame {...args} />,
  parameters: {
    msw: { handlers: resetThemeStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('reset-theme-button-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  render: (args) => <AsyncResetThemeButtonFrame {...args} />,
  parameters: {
    msw: { handlers: resetThemeStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('reset-theme-button-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============================================================================
// HTTP 5xx Error Stories
// ============================================================================

export const Error500InternalServerError: Story = {
  render: (args) => <AsyncResetThemeButtonFrame {...args} />,
  parameters: {
    msw: { handlers: resetThemeStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('reset-theme-button-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  render: (args) => <AsyncResetThemeButtonFrame {...args} />,
  parameters: {
    msw: { handlers: resetThemeStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('reset-theme-button-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  render: (args) => <AsyncResetThemeButtonFrame {...args} />,
  parameters: {
    msw: { handlers: resetThemeStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('reset-theme-button-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  render: (args) => <AsyncResetThemeButtonFrame {...args} />,
  parameters: {
    msw: { handlers: resetThemeStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('reset-theme-button-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const NetworkError: Story = {
  render: (args) => <AsyncResetThemeButtonFrame {...args} />,
  parameters: {
    msw: { handlers: resetThemeStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('reset-theme-button-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============================================================================
// Design & Debug Stories
// ============================================================================

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: resetThemeHandlers },
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
  name: i18n.t('resetTheme.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
// Factory Showcase Stories
// ============================================================================

function EnterpriseThemeSetDemo() {
  const configs = React.useMemo(() => createFakeEnterpriseThemeSet(), []);

  return (
    <div className="space-y-4" data-testid="enterprise-theme-set-demo">
      <h3 className="text-sm font-medium">Enterprise Theme Set ({configs.length} configs)</h3>
      {configs.map((config, index) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-testid={`enterprise-config-${index}`}
          data-theme-preset={config.preset}
          data-theme-radius={config.radius}
          data-theme-scale={config.scale}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            #{index + 1} | Preset: {config.preset} | Mode: {config.colorMode} | Radius:{' '}
            {config.radius} | Scale: {config.scale}
          </p>
          <ResetThemeButtonFrame />
        </div>
      ))}
    </div>
  );
}

export const EnterpriseThemeSet: Story = {
  render: () => <EnterpriseThemeSetDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('enterprise-theme-set-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('enterprise-config-0')).toBeInTheDocument();
    expect(canvas.getByTestId('enterprise-config-5')).toBeInTheDocument();
  },
};

function ThemeShowcaseDemo() {
  const showcase = React.useMemo(() => createFakeThemeShowcase(), []);
  const preference = React.useMemo(() => createFakeThemePreference(), []);
  const customization = React.useMemo(() => createFakeThemeCustomization(), []);
  const themeExport = React.useMemo(() => createFakeThemeExport(), []);
  const history = React.useMemo(() => createFakeThemeHistory(), []);
  const presetInfo = React.useMemo(() => createFakeThemePresetInfo({ id: 'sunset' }), []);

  return (
    <div className="space-y-6" data-testid="theme-showcase-demo">
      <div>
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('resetTheme.story.showcaseDefaultConfig', 'Showcase - Default Config')}
        </h3>
        <div
          className="rounded-lg border p-3"
          data-testid="showcase-default"
          data-theme-preset={showcase.default.preset}
          data-theme-radius={showcase.default.radius}
        >
          <p className="text-muted-foreground text-xs">
            Preset: {showcase.default.preset} | Mode: {showcase.default.colorMode} | Radius:{' '}
            {showcase.default.radius}
          </p>
          <ResetThemeButtonFrame />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('resetTheme.story.showcaseAccessibleConfig', 'Showcase - Accessible Config')}
        </h3>
        <div
          className="rounded-lg border p-3"
          data-testid="showcase-accessible"
          data-theme-preset={showcase.accessible.preset}
        >
          <p className="text-muted-foreground text-xs">
            High Contrast: {String(showcase.accessible.highContrast)} | Reduced Motion:{' '}
            {String(showcase.accessible.reducedMotion)}
          </p>
          <ResetThemeButtonFrame />
        </div>
      </div>
      <div className="rounded-lg border p-3" data-testid="showcase-meta">
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('resetTheme.story.associatedFactoryData', 'Associated Factory Data')}
        </h3>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>
            Preset Info: {presetInfo.name} - {presetInfo.description}
          </li>
          <li>
            Preference: light={preference.preferredLightPreset}, dark=
            {preference.preferredDarkPreset}
          </li>
          <li>
            Customization: {customization.name} (borderRadius: {customization.borderRadius}px)
          </li>
          <li>
            Export: {themeExport.name} ({themeExport.exportFormat}) v{themeExport.version}
          </li>
          <li>
            History: {history.action} on {history.configSnapshot.preset}
          </li>
        </ul>
      </div>
    </div>
  );
}

export const ThemeShowcase: Story = {
  render: () => <ThemeShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('theme-showcase-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-default')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-accessible')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-meta')).toBeInTheDocument();
  },
};

function BulkConfigsDemo() {
  const configs = React.useMemo(() => createFakeThemeConfigs(5), []);
  const presets = React.useMemo(() => createFakeThemePresets(4), []);
  const customizations = React.useMemo(() => createFakeThemeCustomizations(3), []);
  const exports = React.useMemo(() => createFakeThemeExports(2), []);
  const histories = React.useMemo(() => createFakeThemeHistories(3), []);
  const preferences = React.useMemo(() => createFakeThemePreferences(2), []);

  return (
    <div className="space-y-6" data-testid="bulk-configs-demo">
      <div>
        <h3 className="mb-2 text-sm font-medium">Bulk Configs ({configs.length})</h3>
        {configs.map((config) => (
          <div key={config.id} className="border-b py-1">
            <p className="text-muted-foreground text-xs">
              {config.preset} / {config.colorMode} / {config.radius} / {config.scale}
            </p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Presets ({presets.length})</h3>
        {presets.map((p) => (
          <div key={p.id} className="border-b py-1">
            <p className="text-muted-foreground text-xs">
              {p.name}: {p.description}
            </p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Customizations ({customizations.length})</h3>
        {customizations.map((c) => (
          <p key={c.id} className="text-muted-foreground text-xs">
            {c.name} - borderRadius: {c.borderRadius}px
          </p>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Exports ({exports.length})</h3>
        {exports.map((e) => (
          <p key={e.id} className="text-muted-foreground text-xs">
            {e.name} ({e.exportFormat})
          </p>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">History ({histories.length})</h3>
        {histories.map((h) => (
          <p key={h.id} className="text-muted-foreground text-xs">
            {h.action} at {h.timestamp}
          </p>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Preferences ({preferences.length})</h3>

        {preferences.map((pref) => (
          <p key={pref.id} className="text-muted-foreground text-xs">
            Light: {pref.preferredLightPreset}, Dark: {pref.preferredDarkPreset}
          </p>
        ))}
      </div>
    </div>
  );
}

export const BulkFactoryData: Story = {
  render: () => <BulkConfigsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('bulk-configs-demo')).toBeInTheDocument();
  },
};

function SpecializedConfigsDemo() {
  const defaultConfig = React.useMemo(() => createDefaultThemeConfig(), []);
  const darkConfig = React.useMemo(() => createDarkThemeConfig(), []);
  const lightConfig = React.useMemo(() => createLightThemeConfig(), []);
  const accessibleConfig = React.useMemo(() => createAccessibleThemeConfig(), []);
  const compactConfig = React.useMemo(() => createCompactThemeConfig(), []);
  const spaciousConfig = React.useMemo(() => createSpaciousThemeConfig(), []);
  const enterpriseConfig = React.useMemo(() => createFakeEnterpriseThemeConfig(), []);
  const allPresetConfigs = React.useMemo(() => createFakeThemeConfigsWithAllPresets(), []);
  const allRadiiConfigs = React.useMemo(() => createFakeThemeConfigsWithAllRadii(), []);
  const allScaleConfigs = React.useMemo(() => createFakeThemeConfigsWithAllScales(), []);
  const allAccentConfigs = React.useMemo(() => createFakeThemeConfigsWithAllAccents(), []);
  const allColorModeConfigs = React.useMemo(() => createFakeThemeConfigsWithAllColorModes(), []);
  const presetRadiusMatrix = React.useMemo(() => createFakeThemePresetRadiusMatrix(), []);
  const presetColorModeMatrix = React.useMemo(() => createFakeThemePresetColorModeMatrix(), []);
  const colorModeScaleMatrix = React.useMemo(() => createFakeThemeColorModeScaleMatrix(), []);
  const accentColorModeMatrix = React.useMemo(() => createFakeThemeAccentColorModeMatrix(), []);

  const namedConfigs: Array<{ config: ThemeConfig; label: string }> = [
    { label: 'Default', config: defaultConfig },
    { label: 'Dark', config: darkConfig },
    { label: 'Light', config: lightConfig },
    { label: 'Accessible', config: accessibleConfig },
    { label: 'Compact', config: compactConfig },
    { label: 'Spacious', config: spaciousConfig },
    { label: 'Enterprise', config: enterpriseConfig },
  ];

  return (
    <div className="space-y-6" data-testid="specialized-configs-demo">
      <h3 className="text-sm font-medium">
        {i18n.t('resetTheme.story.specializedThemeConfigs', 'Specialized Theme Configs')}
      </h3>
      {namedConfigs.map(({ config, label }) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-testid={`specialized-${label.toLowerCase()}`}
          data-theme-preset={config.preset}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            <span className="font-semibold">{label}:</span> preset={config.preset}, mode=
            {config.colorMode}, radius={config.radius}, scale={config.scale}
          </p>
          <ResetThemeButtonFrame />
        </div>
      ))}
      <div className="rounded-lg border p-3" data-testid="all-variants-summary">
        <h4 className="mb-1 text-xs font-semibold">
          Presets: {allPresetConfigs.length} | Radii: {allRadiiConfigs.length} | Scales:{' '}
          {allScaleConfigs.length} | Accents: {allAccentConfigs.length} | Color Modes:{' '}
          {allColorModeConfigs.length}
        </h4>
        <p className="text-muted-foreground text-xs">
          Matrices: Preset x Radius={presetRadiusMatrix.length}, Preset x ColorMode=
          {presetColorModeMatrix.length}, ColorMode x Scale={colorModeScaleMatrix.length}, Accent x
          ColorMode={accentColorModeMatrix.length}
        </p>
        <p className="text-muted-foreground text-xs">
          Fonts: {FONT_FAMILIES.join(', ')} | Sidebars: {SIDEBAR_MODES.join(', ')}
        </p>
        <p className="text-muted-foreground text-xs">
          Accents: {ACCENT_COLORS.length} | Layouts: {CONTENT_LAYOUTS.join(', ')} | Modes:{' '}
          {COLOR_MODES.join(', ')}
        </p>
        <p className="text-muted-foreground text-xs">
          Preset IDs: {THEME_PRESET_IDS.join(', ')} | Presets: {THEME_PRESETS.length} | Radii:{' '}
          {THEME_RADII.join(', ')} | Scales: {THEME_SCALES.join(', ')}
        </p>
      </div>
    </div>
  );
}

export const SpecializedConfigs: Story = {
  render: () => <SpecializedConfigsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('specialized-configs-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('specialized-default')).toBeInTheDocument();
    expect(canvas.getByTestId('specialized-accessible')).toBeInTheDocument();
    expect(canvas.getByTestId('specialized-enterprise')).toBeInTheDocument();
    expect(canvas.getByTestId('all-variants-summary')).toBeInTheDocument();
  },
};

// ============================================================================
// Accessibility Story
// ============================================================================

export const Accessibility: Story = {
  name: i18n.t('resetTheme.storyName.accessibility', 'Accessibility'),
  globals: {
    preset: 'underground',
    radius: 'xl',
    scale: 'lg',
    contentLayout: 'centered',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const button = canvas.getByTestId('reset-theme-button');

    // Test that button is keyboard focusable
    button.focus();
    await waitFor(() => {
      expect(doc.activeElement).toBe(button);
    });

    // Verify button has accessible name
    expect(button.textContent).not.toBe('');

    // Verify button has proper role (implicit for button element)
    expect(button.tagName.toLowerCase()).toBe('button');

    // Test activation with Enter key
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(doc.body.dataset.themePreset).toBeUndefined();
      expect(doc.body.dataset.themeRadius).toBeUndefined();
      expect(doc.body.dataset.themeScale).toBeUndefined();
      expect(doc.body.dataset.themeContentLayout).toBe('full');
    });
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('resetTheme.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: resetThemeStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('resetTheme.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: resetThemeStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('resetTheme.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: resetThemeStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('resetTheme.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: resetThemeStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
