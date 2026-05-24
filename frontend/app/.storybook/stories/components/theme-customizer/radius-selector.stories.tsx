import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  radiusSelectorHandlers,
  radiusSelectorStatusHandlers,
} from '@/.storybook/stories/_handlers/radius-selector.handlers';
import { ThemeRadiusSelector } from '@/components/theme-customizer/radius-selector';

import i18n from 'i18next';

seedFaker();

// ============================================================================
// Frame Components
// ============================================================================

type ThemeRadiusSelectorFrameProps = {
  onValueChange?: (value: string) => void;
  withLabels?: boolean;
};

function ThemeRadiusSelectorFrame({
  withLabels = true,
  onValueChange,
}: ThemeRadiusSelectorFrameProps) {
  return (
    <ThemeRadiusSelector
      labels={
        withLabels
          ? {
              label: i18n.t('radiusSelector.label'),
              none: i18n.t('radiusSelector.none'),
              sm: i18n.t('radiusSelector.sm'),
              md: i18n.t('radiusSelector.md'),
              lg: i18n.t('radiusSelector.lg'),
              xl: i18n.t('radiusSelector.xl'),
            }
          : undefined
      }
      {...(onValueChange && { onValueChange })}
    />
  );
}

// ============================================================================
// Async Wrapper Component
// ============================================================================

type AsyncRadiusSelectorFrameProps = {
  onValueChange?: (value: string) => void;
  withLabels?: boolean;
};

function AsyncRadiusSelectorFrame({
  withLabels = true,
  onValueChange,
}: AsyncRadiusSelectorFrameProps) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState<string | null>(null);

  useEffect(() => {
    const fetchThemeConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/theme');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = (await response.json()) as { radius: string };
        setRadius(data.radius);
        setError(null);
      } catch (error_) {
        setError(error_ instanceof Error ? error_.message : 'Failed to load radius');
      } finally {
        setLoading(false);
      }
    };

    fetchThemeConfig();
  }, []);

  if (loading) {
    return (
      <div className="flex h-20 items-center justify-center" data-testid="radius-selector-loading">
        <div className="text-muted-foreground text-sm">
          {t('radiusSelector.story.loadingRadiusPreference', 'Loading radius preference...')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-destructive/10 text-destructive rounded-md p-4"
        data-testid="radius-selector-error"
      >
        <p className="text-sm font-medium">
          {t('radiusSelector.story.errorLoadingRadius', 'Error loading radius')}
        </p>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div data-testid="radius-selector-async-loaded" data-initial-radius={radius}>
      <ThemeRadiusSelector
        labels={
          withLabels
            ? {
                label: i18n.t('radiusSelector.label'),
                none: i18n.t('radiusSelector.none'),
                sm: i18n.t('radiusSelector.sm'),
                md: i18n.t('radiusSelector.md'),
                lg: i18n.t('radiusSelector.lg'),
                xl: i18n.t('radiusSelector.xl'),
              }
            : undefined
        }
        {...(onValueChange && { onValueChange })}
      />
    </div>
  );
}

// ============================================================================
// Faker Data Component
// ============================================================================

function RadiusSelectorWithFakerData() {
  const config = createFakeThemeConfig();

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-4">
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('radiusSelector.story.generatedThemeConfig', 'Generated Theme Config')}
        </h3>
        <pre className="text-xs" data-testid="faker-config">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>
      <div data-theme-radius={config.radius}>
        <ThemeRadiusSelectorFrame />
      </div>
    </div>
  );
}

// ============================================================================
// Meta Configuration
// ============================================================================

const meta = {
  title: 'Components/Theme Customizer/Radius Selector',
  component: ThemeRadiusSelectorFrame,
  tags: ['autodocs'],
  args: {
    withLabels: true,
    onValueChange: fn(),
  },
  argTypes: {
    withLabels: {
      control: { type: 'boolean' },
      description: i18n.t(
        'radiusSelector.argType.whetherToUseLocalizedLabelsOrFallbackDefaults',
        'Whether to use localized labels or fallback defaults'
      ),
      table: {
        category: 'Content',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    onValueChange: {
      action: 'valueChanged',
      description: i18n.t(
        'radiusSelector.argType.callbackWhenRadiusSelectionChanges',
        'Callback when radius selection changes'
      ),
      table: {
        category: 'Events',
        type: { summary: '(value: string) => void' },
      },
    },
    // ThemeRadiusSelector Props Reference:
    // Optional Props:
    // - labels: ThemeRadiusSelectorLabels object
    //   - label: Section heading text (e.g., "Radius")
    //   - none: No radius option label
    //   - sm: Small radius option label
    //   - md: Medium radius option label
    //   - lg: Large radius option label
    //   - xl: Extra large radius option label
    // - onValueChange: Callback when selection changes
    //
    // Radius Options:
    // - none: No border radius (sharp corners)
    // - sm: Small border radius (subtle rounding)
    // - md: Medium border radius (default)
    // - lg: Large border radius (rounded)
    // - xl: Extra large border radius (pill-like)
    //
    // State Persistence:
    // - Saves preference to body data attribute
    // - data-theme-radius="none|sm|md|lg|xl"
    //
    // Visual States:
    // - Selected button: data-state="on"
    // - Unselected button: data-state="off"
    //
    // Accessibility:
    // - Toggle group with keyboard navigation
    // - Arrow keys to navigate between options
    // - Enter/Space to select
    //
    // Data Attributes:
    // - data-slot="radius-selector": Root container
    // - data-testid="radius-selector-label": Section label
    // - data-testid="radius-selector-none": None button
    // - data-testid="radius-selector-sm": Small button
    // - data-testid="radius-selector-md": Medium button
    // - data-testid="radius-selector-lg": Large button
    // - data-testid="radius-selector-xl": Extra large button
  },
  parameters: {
    msw: { handlers: radiusSelectorHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ThemeRadiusSelectorFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============================================================================
// Core Stories
// ============================================================================

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="radius-selector"]')).toBeInTheDocument();

    const canvas = within(canvasElement);

    const label = canvas.getByTestId('radius-selector-label');
    expect(label.textContent).not.toBe('');

    const noneButton = canvas.getByTestId('radius-selector-none');
    const smallButton = canvas.getByTestId('radius-selector-sm');

    await userEvent.click(smallButton);

    await waitFor(() => {
      expect(smallButton.getAttribute('data-state')).toBe('on');
      expect(args.onValueChange).toHaveBeenCalledWith('sm');
    });

    await userEvent.click(noneButton);

    await waitFor(() => {
      expect(noneButton.getAttribute('data-state')).toBe('on');
      expect(args.onValueChange).toHaveBeenCalledWith('none');
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const FallbackLabels: Story = {
  ...Default,
  name: i18n.t('radiusSelector.storyName.fallbackLabels', 'Fallback labels (defaults)'),
  args: {
    ...(Default.args ?? {}),
    withLabels: false,
  },
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
          {i18n.t('radiusSelector.story.withLabels', 'With Labels')}
        </p>
        <ThemeRadiusSelectorFrame withLabels />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('radiusSelector.story.withoutLabelsFallback', 'Without Labels (Fallback)')}
        </p>
        <ThemeRadiusSelectorFrame withLabels={false} />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('radiusSelector.story.noneRadiusActive', 'None Radius Active')}
        </p>
        <div data-theme-radius="none">
          <ThemeRadiusSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('radiusSelector.story.smallRadiusActive', 'Small Radius Active')}
        </p>
        <div data-theme-radius="sm">
          <ThemeRadiusSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('radiusSelector.story.mediumRadiusActive', 'Medium Radius Active')}
        </p>
        <div data-theme-radius="md">
          <ThemeRadiusSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('radiusSelector.story.largeRadiusActive', 'Large Radius Active')}
        </p>
        <div data-theme-radius="lg">
          <ThemeRadiusSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('radiusSelector.story.extraLargeRadiusActive', 'Extra Large Radius Active')}
        </p>
        <div data-theme-radius="xl">
          <ThemeRadiusSelectorFrame withLabels />
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
        <p className="text-muted-foreground mb-2 text-sm font-medium">Narrow Container (250px)</p>
        <div className="border-muted w-[250px] border border-dashed p-2">
          <ThemeRadiusSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Medium Container (350px)</p>
        <div className="border-muted w-[350px] border border-dashed p-2">
          <ThemeRadiusSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Wide Container (450px)</p>
        <div className="border-muted w-[450px] border border-dashed p-2">
          <ThemeRadiusSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('radiusSelector.story.fullWidth', 'Full Width')}
        </p>
        <div className="border-muted w-full border border-dashed p-2">
          <ThemeRadiusSelectorFrame withLabels />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
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
  name: i18n.t('radiusSelector.storyName.japanese', 'Japanese'),
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
  name: i18n.t('radiusSelector.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('radiusSelector.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('radiusSelector.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// Data Stories
// ============================================================================

export const WithFakerData: Story = {
  render: () => <RadiusSelectorWithFakerData />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('faker-config')).toBeInTheDocument();
    });

    expect(canvasElement.querySelector('[data-slot="radius-selector"]')).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  render: (args) => <AsyncRadiusSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: radiusSelectorHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // First check for loading state
    await waitFor(() => {
      const loading = canvas.queryByTestId('radius-selector-loading');
      const loaded = canvas.queryByTestId('radius-selector-async-loaded');
      expect(loading || loaded).toBeInTheDocument();
    });

    // Then wait for loaded state
    await waitFor(
      () => {
        expect(canvas.getByTestId('radius-selector-async-loaded')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="radius-selector"]')).toBeInTheDocument();
  },
};

// ============================================================================
// Loading & Error Stories
// ============================================================================

export const Loading: Story = {
  render: (args) => <AsyncRadiusSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: radiusSelectorStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('radius-selector-loading')).toBeInTheDocument();
    });
  },
};

export const SlowResponse: Story = {
  render: (args) => <AsyncRadiusSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: radiusSelectorStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Starts in loading state
    await waitFor(() => {
      expect(canvas.getByTestId('radius-selector-loading')).toBeInTheDocument();
    });

    // Eventually loads
    await waitFor(
      () => {
        expect(canvas.getByTestId('radius-selector-async-loaded')).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
  },
};

// ============================================================================
// HTTP 4xx Error Stories
// ============================================================================

export const Error400BadRequest: Story = {
  render: (args) => <AsyncRadiusSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: radiusSelectorStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('radius-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(canvas.getByText(/Error loading radius/i)).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  render: (args) => <AsyncRadiusSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: radiusSelectorStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('radius-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  render: (args) => <AsyncRadiusSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: radiusSelectorStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('radius-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error422UnprocessableEntity: Story = {
  render: (args) => <AsyncRadiusSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: radiusSelectorStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('radius-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  render: (args) => <AsyncRadiusSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: radiusSelectorStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('radius-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============================================================================
// HTTP 5xx Error Stories
// ============================================================================

export const Error500InternalServerError: Story = {
  render: (args) => <AsyncRadiusSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: radiusSelectorStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('radius-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  render: (args) => <AsyncRadiusSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: radiusSelectorStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('radius-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  render: (args) => <AsyncRadiusSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: radiusSelectorStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('radius-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  render: (args) => <AsyncRadiusSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: radiusSelectorStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('radius-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const NetworkError: Story = {
  render: (args) => <AsyncRadiusSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: radiusSelectorStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('radius-selector-error')).toBeInTheDocument();
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
    msw: { handlers: radiusSelectorHandlers },
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
  name: i18n.t('radiusSelector.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

function AllRadiiDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(() => createFakeThemeConfigsWithAllRadii(), []);

  return (
    <div className="space-y-4" data-testid="all-radii-demo">
      <h3 className="text-sm font-medium">All Radii ({THEME_RADII.length})</h3>
      {configs.map((config) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-theme-radius={config.radius}
          data-testid={`radius-card-${config.radius}`}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            Radius: <span className="font-mono font-semibold">{config.radius}</span> | Preset:{' '}
            {config.preset} | Mode: {config.colorMode}
          </p>
          <ThemeRadiusSelector
            labels={{
              label: t('radiusSelector.label'),
              none: t('radiusSelector.none'),
              sm: t('radiusSelector.sm'),
              md: t('radiusSelector.md'),
              lg: t('radiusSelector.lg'),
              xl: t('radiusSelector.xl'),
            }}
          />
        </div>
      ))}
    </div>
  );
}

export const AllRadii: Story = {
  render: () => <AllRadiiDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('all-radii-demo')).toBeInTheDocument();
    for (const radius of THEME_RADII) {
      expect(canvas.getByTestId(`radius-card-${radius}`)).toBeInTheDocument();
    }
  },
};

function EnterpriseThemeSetDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(() => createFakeEnterpriseThemeSet(), []);

  return (
    <div className="space-y-4" data-testid="enterprise-theme-set-demo">
      <h3 className="text-sm font-medium">Enterprise Theme Set ({configs.length} configs)</h3>
      {configs.map((config, index) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-testid={`enterprise-config-${index}`}
          data-theme-radius={config.radius}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            #{index + 1} | Radius: {config.radius} | Mode: {config.colorMode} | Scale:{' '}
            {config.scale}
          </p>
          <ThemeRadiusSelector
            labels={{
              label: t('radiusSelector.label'),
              none: t('radiusSelector.none'),
              sm: t('radiusSelector.sm'),
              md: t('radiusSelector.md'),
              lg: t('radiusSelector.lg'),
              xl: t('radiusSelector.xl'),
            }}
          />
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
  const presetInfo = React.useMemo(() => createFakeThemePresetInfo({ id: 'blossom' }), []);

  return (
    <div className="space-y-6" data-testid="theme-showcase-demo">
      <div>
        <h3 className="mb-2 text-sm font-medium">
          Showcase - Compact (radius: {showcase.compact.radius})
        </h3>
        <div
          className="rounded-lg border p-3"
          data-testid="showcase-compact"
          data-theme-radius={showcase.compact.radius}
        >
          <p className="text-muted-foreground text-xs">
            Scale: {showcase.compact.scale} | Sidebar: {showcase.compact.sidebarMode}
          </p>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">
          Showcase - Spacious (radius: {showcase.spacious.radius})
        </h3>
        <div
          className="rounded-lg border p-3"
          data-testid="showcase-spacious"
          data-theme-radius={showcase.spacious.radius}
        >
          <p className="text-muted-foreground text-xs">
            Scale: {showcase.spacious.scale} | Layout: {showcase.spacious.contentLayout}
          </p>
        </div>
      </div>
      <div className="rounded-lg border p-3" data-testid="showcase-meta">
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('radiusSelector.story.associatedFactoryData', 'Associated Factory Data')}
        </h3>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>
            Preset Info: {presetInfo.name} - {presetInfo.description}
          </li>
          <li>
            Preference: auto-switch={String(preference.autoSwitch)}, schedule=
            {preference.darkScheduleStart}-{preference.darkScheduleEnd}
          </li>
          <li>
            Customization: {customization.name} (borderRadius: {customization.borderRadius}px)
          </li>
          <li>
            Export: {themeExport.name} ({themeExport.exportFormat}) v{themeExport.version}
          </li>
          <li>
            History: {history.action} - radius={history.configSnapshot.radius}
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
    expect(canvas.getByTestId('showcase-compact')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-spacious')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-meta')).toBeInTheDocument();
  },
};

function PresetRadiusMatrixDemo() {
  const matrix = React.useMemo(() => createFakeThemePresetRadiusMatrix(), []);

  return (
    <div className="space-y-6" data-testid="preset-radius-matrix-demo">
      <h3 className="text-sm font-medium">
        Preset x Radius Matrix ({THEME_PRESET_IDS.length} x {THEME_RADII.length})
      </h3>
      {matrix.map((row, rowIndex) => (
        <div key={THEME_PRESET_IDS[rowIndex]} className="space-y-2">
          <p className="text-xs font-semibold uppercase">{THEME_PRESET_IDS[rowIndex]}</p>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {row.map((config) => (
              <div
                key={config.id}
                className="rounded border p-2"
                data-testid={`matrix-${config.preset}-${config.radius}`}
              >
                <p className="text-muted-foreground text-xs">{config.radius}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const PresetRadiusMatrix: Story = {
  render: () => <PresetRadiusMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('preset-radius-matrix-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('matrix-default-none')).toBeInTheDocument();
    expect(canvas.getByTestId('matrix-midnight-md')).toBeInTheDocument();
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
          <div key={config.id} className="border-b py-1" data-theme-radius={config.radius}>
            <p className="text-muted-foreground text-xs">
              {config.preset} / radius={config.radius} / {config.colorMode}
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
            {c.name} - borderRadius: {c.borderRadius}px, spacing: {c.spacing}
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
  const allScaleConfigs = React.useMemo(() => createFakeThemeConfigsWithAllScales(), []);
  const allAccentConfigs = React.useMemo(() => createFakeThemeConfigsWithAllAccents(), []);
  const allColorModeConfigs = React.useMemo(() => createFakeThemeConfigsWithAllColorModes(), []);
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
        {i18n.t('radiusSelector.story.specializedThemeConfigs', 'Specialized Theme Configs')}
      </h3>
      {namedConfigs.map(({ config, label }) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-testid={`specialized-${label.toLowerCase()}`}
          data-theme-radius={config.radius}
        >
          <p className="text-muted-foreground text-xs">
            <span className="font-semibold">{label}:</span> radius={config.radius}, preset=
            {config.preset}, mode={config.colorMode}, scale={config.scale}
          </p>
        </div>
      ))}
      <div className="rounded-lg border p-3" data-testid="all-variants-summary">
        <h4 className="mb-1 text-xs font-semibold">
          Presets: {allPresetConfigs.length} | Scales: {allScaleConfigs.length} | Accents:{' '}
          {allAccentConfigs.length} | Color Modes: {allColorModeConfigs.length}
        </h4>
        <p className="text-muted-foreground text-xs">
          Matrices: Preset x ColorMode={presetColorModeMatrix.length}, ColorMode x Scale=
          {colorModeScaleMatrix.length}, Accent x ColorMode={accentColorModeMatrix.length}
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
    expect(canvas.getByTestId('specialized-compact')).toBeInTheDocument();
    expect(canvas.getByTestId('specialized-enterprise')).toBeInTheDocument();
    expect(canvas.getByTestId('all-variants-summary')).toBeInTheDocument();
  },
};

// ============================================================================
// Accessibility Story
// ============================================================================

export const Accessibility: Story = {
  name: i18n.t('radiusSelector.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const noneButton = canvas.getByTestId('radius-selector-none');
    const smButton = canvas.getByTestId('radius-selector-sm');
    const mdButton = canvas.getByTestId('radius-selector-md');
    const lgButton = canvas.getByTestId('radius-selector-lg');
    const xlButton = canvas.getByTestId('radius-selector-xl');

    // Test that buttons are keyboard focusable
    noneButton.focus();
    await waitFor(() => {
      expect(document.activeElement).toBe(noneButton);
    });

    // Test keyboard navigation with arrow keys through all options
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(document.activeElement).toBe(smButton);
    });

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(document.activeElement).toBe(mdButton);
    });

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(document.activeElement).toBe(lgButton);
    });

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(document.activeElement).toBe(xlButton);
    });

    // Test selection with Enter key
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(xlButton.getAttribute('data-state')).toBe('on');
    });

    // Test navigation back with arrow keys
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(document.activeElement).toBe(lgButton);
    });

    // Test selection with Space key
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(lgButton.getAttribute('data-state')).toBe('on');
    });

    // Verify ARIA attributes - toggle group should have proper role
    const toggleGroup = canvasElement.querySelector('[role="group"]');
    expect(toggleGroup).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('radiusSelector.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: radiusSelectorStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('radiusSelector.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: radiusSelectorStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('radiusSelector.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: radiusSelectorStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('radiusSelector.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: radiusSelectorStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
