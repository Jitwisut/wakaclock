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
  scaleSelectorHandlers,
  scaleSelectorStatusHandlers,
} from '@/.storybook/stories/_handlers/scale-selector.handlers';
import { ThemeScaleSelector } from '@/components/theme-customizer/scale-selector';

import i18n from 'i18next';

seedFaker();

// ============================================================================
// Frame Components
// ============================================================================

type ThemeScaleSelectorFrameProps = {
  onValueChange?: (value: string) => void;
  withLabels?: boolean;
};

function ThemeScaleSelectorFrame({
  withLabels = true,
  onValueChange,
}: ThemeScaleSelectorFrameProps) {
  return (
    <ThemeScaleSelector
      labels={
        withLabels
          ? {
              label: i18n.t('scaleSelector.label'),
              none: i18n.t('scaleSelector.none'),
              xs: i18n.t('scaleSelector.xs'),
              lg: i18n.t('scaleSelector.lg'),
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

type AsyncScaleSelectorFrameProps = {
  onValueChange?: (value: string) => void;
  withLabels?: boolean;
};

function AsyncScaleSelectorFrame({
  withLabels = true,
  onValueChange,
}: AsyncScaleSelectorFrameProps) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<string | null>(null);

  useEffect(() => {
    const fetchThemeConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/theme');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = (await response.json()) as { scale: string };
        setScale(data.scale);
        setError(null);
      } catch (error_) {
        setError(error_ instanceof Error ? error_.message : 'Failed to load scale');
      } finally {
        setLoading(false);
      }
    };

    fetchThemeConfig();
  }, []);

  if (loading) {
    return (
      <div className="flex h-20 items-center justify-center" data-testid="scale-selector-loading">
        <div className="text-muted-foreground text-sm">
          {t('scaleSelector.story.loadingScalePreference', 'Loading scale preference...')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-destructive/10 text-destructive rounded-md p-4"
        data-testid="scale-selector-error"
      >
        <p className="text-sm font-medium">
          {t('scaleSelector.story.errorLoadingScale', 'Error loading scale')}
        </p>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div data-testid="scale-selector-async-loaded" data-initial-scale={scale}>
      <ThemeScaleSelector
        labels={
          withLabels
            ? {
                label: i18n.t('scaleSelector.label'),
                none: i18n.t('scaleSelector.none'),
                xs: i18n.t('scaleSelector.xs'),
                lg: i18n.t('scaleSelector.lg'),
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

function ScaleSelectorWithFakerData() {
  const config = createFakeThemeConfig();

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-4">
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('scaleSelector.story.generatedThemeConfig', 'Generated Theme Config')}
        </h3>
        <pre className="text-xs" data-testid="faker-config">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>
      <div data-theme-scale={config.scale}>
        <ThemeScaleSelectorFrame />
      </div>
    </div>
  );
}

// ============================================================================
// Meta Configuration
// ============================================================================

const meta = {
  title: 'Components/Theme Customizer/Scale Selector',
  component: ThemeScaleSelectorFrame,
  tags: ['autodocs'],
  args: {
    withLabels: true,
    onValueChange: fn(),
  },
  argTypes: {
    withLabels: {
      control: { type: 'boolean' },
      description: i18n.t(
        'scaleSelector.argType.whetherToUseLocalizedLabelsOrFallbackDefaults',
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
        'scaleSelector.argType.callbackWhenScaleSelectionChanges',
        'Callback when scale selection changes'
      ),
      table: {
        category: 'Events',
        type: { summary: '(value: string) => void' },
      },
    },
    // ThemeScaleSelector Props Reference:
    // Optional Props:
    // - labels: ThemeScaleSelectorLabels object
    //   - label: Section heading text (e.g., "Scale")
    //   - none: Default scale option label
    //   - xs: Extra small scale option label
    //   - lg: Large scale option label
    // - onValueChange: Callback when selection changes
    //
    // Scale Options:
    // - none: Default UI scale (100%)
    // - xs: Extra small scale (compact UI)
    // - sm: Small scale
    // - lg: Large scale (spacious UI)
    //
    // State Persistence:
    // - Saves preference to body data attribute
    // - data-theme-scale="none|xs|sm|lg"
    //
    // Use Case:
    // - Accessibility: Larger scale for vision impaired
    // - Density: Compact mode for power users
    // - Responsive: Different scales per device
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
    // - data-slot="scale-selector": Root container
    // - data-testid="scale-selector-label": Section label
    // - data-testid="scale-selector-none": Default scale button
    // - data-testid="scale-selector-xs": Extra small button
    // - data-testid="scale-selector-sm": Small button
    // - data-testid="scale-selector-lg": Large button
  },
  parameters: {
    msw: { handlers: scaleSelectorHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ThemeScaleSelectorFrame>;

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

    expect(canvasElement.querySelector('[data-slot="scale-selector"]')).toBeInTheDocument();

    const canvas = within(canvasElement);

    const label = canvas.getByTestId('scale-selector-label');
    expect(label.textContent).not.toBe('');

    const noneButton = canvas.getByTestId('scale-selector-none');
    const smallButton = canvas.getByTestId('scale-selector-sm');

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
  name: i18n.t('scaleSelector.storyName.fallbackLabels', 'Fallback labels (defaults)'),
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
          {i18n.t('scaleSelector.story.withLabels', 'With Labels')}
        </p>
        <ThemeScaleSelectorFrame withLabels />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('scaleSelector.story.withoutLabelsFallback', 'Without Labels (Fallback)')}
        </p>
        <ThemeScaleSelectorFrame withLabels={false} />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('scaleSelector.story.defaultScaleActive', 'Default Scale Active')}
        </p>
        <div data-theme-scale="none">
          <ThemeScaleSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('scaleSelector.story.extraSmallScaleActive', 'Extra Small Scale Active')}
        </p>
        <div data-theme-scale="xs">
          <ThemeScaleSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('scaleSelector.story.smallScaleActive', 'Small Scale Active')}
        </p>
        <div data-theme-scale="sm">
          <ThemeScaleSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('scaleSelector.story.largeScaleActive', 'Large Scale Active')}
        </p>
        <div data-theme-scale="lg">
          <ThemeScaleSelectorFrame withLabels />
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
          <ThemeScaleSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Medium Container (350px)</p>
        <div className="border-muted w-[350px] border border-dashed p-2">
          <ThemeScaleSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Wide Container (450px)</p>
        <div className="border-muted w-[450px] border border-dashed p-2">
          <ThemeScaleSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('scaleSelector.story.fullWidth', 'Full Width')}
        </p>
        <div className="border-muted w-full border border-dashed p-2">
          <ThemeScaleSelectorFrame withLabels />
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
  name: i18n.t('scaleSelector.storyName.japanese', 'Japanese'),
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
  name: i18n.t('scaleSelector.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('scaleSelector.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('scaleSelector.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// Data Stories
// ============================================================================

export const WithFakerData: Story = {
  render: () => <ScaleSelectorWithFakerData />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('faker-config')).toBeInTheDocument();
    });

    expect(canvasElement.querySelector('[data-slot="scale-selector"]')).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  render: (args) => <AsyncScaleSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: scaleSelectorHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // First check for loading state
    await waitFor(() => {
      const loading = canvas.queryByTestId('scale-selector-loading');
      const loaded = canvas.queryByTestId('scale-selector-async-loaded');
      expect(loading || loaded).toBeInTheDocument();
    });

    // Then wait for loaded state
    await waitFor(
      () => {
        expect(canvas.getByTestId('scale-selector-async-loaded')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="scale-selector"]')).toBeInTheDocument();
  },
};

// ============================================================================
// Loading & Error Stories
// ============================================================================

export const Loading: Story = {
  render: (args) => <AsyncScaleSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: scaleSelectorStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('scale-selector-loading')).toBeInTheDocument();
    });
  },
};

export const SlowResponse: Story = {
  render: (args) => <AsyncScaleSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: scaleSelectorStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Starts in loading state
    await waitFor(() => {
      expect(canvas.getByTestId('scale-selector-loading')).toBeInTheDocument();
    });

    // Eventually loads
    await waitFor(
      () => {
        expect(canvas.getByTestId('scale-selector-async-loaded')).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
  },
};

// ============================================================================
// HTTP 4xx Error Stories
// ============================================================================

export const Error400BadRequest: Story = {
  render: (args) => <AsyncScaleSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: scaleSelectorStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('scale-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(canvas.getByText(/Error loading scale/i)).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  render: (args) => <AsyncScaleSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: scaleSelectorStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('scale-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  render: (args) => <AsyncScaleSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: scaleSelectorStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('scale-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error422UnprocessableEntity: Story = {
  render: (args) => <AsyncScaleSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: scaleSelectorStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('scale-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  render: (args) => <AsyncScaleSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: scaleSelectorStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('scale-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============================================================================
// HTTP 5xx Error Stories
// ============================================================================

export const Error500InternalServerError: Story = {
  render: (args) => <AsyncScaleSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: scaleSelectorStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('scale-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  render: (args) => <AsyncScaleSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: scaleSelectorStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('scale-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  render: (args) => <AsyncScaleSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: scaleSelectorStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('scale-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  render: (args) => <AsyncScaleSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: scaleSelectorStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('scale-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const NetworkError: Story = {
  render: (args) => <AsyncScaleSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: scaleSelectorStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('scale-selector-error')).toBeInTheDocument();
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
    msw: { handlers: scaleSelectorHandlers },
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
  name: i18n.t('scaleSelector.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

function AllScalesDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(() => createFakeThemeConfigsWithAllScales(), []);

  return (
    <div className="space-y-4" data-testid="all-scales-demo">
      <h3 className="text-sm font-medium">All Scales ({THEME_SCALES.length})</h3>
      {configs.map((config) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-theme-scale={config.scale}
          data-testid={`scale-card-${config.scale}`}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            Scale: <span className="font-mono font-semibold">{config.scale}</span> | Preset:{' '}
            {config.preset} | Radius: {config.radius}
          </p>
          <ThemeScaleSelector
            labels={{
              label: t('scaleSelector.label'),
              none: t('scaleSelector.none'),
              xs: t('scaleSelector.xs'),
              lg: t('scaleSelector.lg'),
            }}
          />
        </div>
      ))}
    </div>
  );
}

export const AllScales: Story = {
  render: () => <AllScalesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('all-scales-demo')).toBeInTheDocument();
    for (const scale of THEME_SCALES) {
      expect(canvas.getByTestId(`scale-card-${scale}`)).toBeInTheDocument();
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
          data-theme-scale={config.scale}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            #{index + 1} | Scale: {config.scale} | Mode: {config.colorMode} | Radius:{' '}
            {config.radius}
          </p>
          <ThemeScaleSelector
            labels={{
              label: t('scaleSelector.label'),
              none: t('scaleSelector.none'),
              xs: t('scaleSelector.xs'),
              lg: t('scaleSelector.lg'),
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
  const presetInfo = React.useMemo(() => createFakeThemePresetInfo({ id: 'underground' }), []);

  return (
    <div className="space-y-6" data-testid="theme-showcase-demo">
      <div>
        <h3 className="mb-2 text-sm font-medium">
          Showcase - Compact (scale: {showcase.compact.scale})
        </h3>
        <div
          className="rounded-lg border p-3"
          data-testid="showcase-compact"
          data-theme-scale={showcase.compact.scale}
        >
          <p className="text-muted-foreground text-xs">
            Radius: {showcase.compact.radius} | Layout: {showcase.compact.contentLayout}
          </p>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">
          Showcase - Spacious (scale: {showcase.spacious.scale})
        </h3>
        <div
          className="rounded-lg border p-3"
          data-testid="showcase-spacious"
          data-theme-scale={showcase.spacious.scale}
        >
          <p className="text-muted-foreground text-xs">
            Radius: {showcase.spacious.radius} | Layout: {showcase.spacious.contentLayout}
          </p>
        </div>
      </div>
      <div className="rounded-lg border p-3" data-testid="showcase-meta">
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('scaleSelector.story.associatedFactoryData', 'Associated Factory Data')}
        </h3>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>
            Preset Info: {presetInfo.name} - {presetInfo.description}
          </li>
          <li>
            Preference: schedule {preference.darkScheduleStart}-{preference.darkScheduleEnd}
          </li>
          <li>
            Customization: {customization.name} (fontScale: {customization.fontScale})
          </li>
          <li>
            Export: {themeExport.name} ({themeExport.exportFormat}) v{themeExport.version}
          </li>
          <li>
            History: {history.action} - scale={history.configSnapshot.scale}
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

function ColorModeScaleMatrixDemo() {
  const matrix = React.useMemo(() => createFakeThemeColorModeScaleMatrix(), []);

  return (
    <div className="space-y-6" data-testid="color-mode-scale-matrix-demo">
      <h3 className="text-sm font-medium">
        Color Mode x Scale Matrix ({COLOR_MODES.length} x {THEME_SCALES.length})
      </h3>
      {matrix.map((row, rowIndex) => (
        <div key={COLOR_MODES[rowIndex]} className="space-y-2">
          <p className="text-xs font-semibold uppercase">{COLOR_MODES[rowIndex]}</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {row.map((config) => (
              <div
                key={config.id}
                className="rounded border p-2"
                data-testid={`matrix-${config.colorMode}-${config.scale}`}
              >
                <p className="text-muted-foreground text-xs">Scale: {config.scale}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const ColorModeScaleMatrix: Story = {
  render: () => <ColorModeScaleMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('color-mode-scale-matrix-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('matrix-light-compact')).toBeInTheDocument();
    expect(canvas.getByTestId('matrix-dark-default')).toBeInTheDocument();
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
          <div key={config.id} className="border-b py-1" data-theme-scale={config.scale}>
            <p className="text-muted-foreground text-xs">
              {config.preset} / scale={config.scale} / {config.colorMode}
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
            {c.name} - fontScale: {c.fontScale}, spacing: {c.spacing}
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
  const allAccentConfigs = React.useMemo(() => createFakeThemeConfigsWithAllAccents(), []);
  const allColorModeConfigs = React.useMemo(() => createFakeThemeConfigsWithAllColorModes(), []);
  const presetRadiusMatrix = React.useMemo(() => createFakeThemePresetRadiusMatrix(), []);
  const presetColorModeMatrix = React.useMemo(() => createFakeThemePresetColorModeMatrix(), []);
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
        {i18n.t('scaleSelector.story.specializedThemeConfigs', 'Specialized Theme Configs')}
      </h3>
      {namedConfigs.map(({ config, label }) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-testid={`specialized-${label.toLowerCase()}`}
          data-theme-scale={config.scale}
        >
          <p className="text-muted-foreground text-xs">
            <span className="font-semibold">{label}:</span> scale={config.scale}, preset=
            {config.preset}, mode={config.colorMode}, radius={config.radius}
          </p>
        </div>
      ))}
      <div className="rounded-lg border p-3" data-testid="all-variants-summary">
        <h4 className="mb-1 text-xs font-semibold">
          Presets: {allPresetConfigs.length} | Radii: {allRadiiConfigs.length} | Accents:{' '}
          {allAccentConfigs.length} | Color Modes: {allColorModeConfigs.length}
        </h4>
        <p className="text-muted-foreground text-xs">
          Matrices: Preset x Radius={presetRadiusMatrix.length}, Preset x ColorMode=
          {presetColorModeMatrix.length}, Accent x ColorMode={accentColorModeMatrix.length}
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
  name: i18n.t('scaleSelector.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const noneButton = canvas.getByTestId('scale-selector-none');
    const xsButton = canvas.getByTestId('scale-selector-xs');
    const smButton = canvas.getByTestId('scale-selector-sm');
    const lgButton = canvas.getByTestId('scale-selector-lg');

    // Test that buttons are keyboard focusable
    noneButton.focus();
    await waitFor(() => {
      expect(document.activeElement).toBe(noneButton);
    });

    // Test keyboard navigation with arrow keys through all options
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(document.activeElement).toBe(xsButton);
    });

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(document.activeElement).toBe(smButton);
    });

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(document.activeElement).toBe(lgButton);
    });

    // Test selection with Enter key
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(lgButton.getAttribute('data-state')).toBe('on');
    });

    // Test navigation back with arrow keys
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(document.activeElement).toBe(smButton);
    });

    // Test selection with Space key
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(smButton.getAttribute('data-state')).toBe('on');
    });

    // Verify ARIA attributes - toggle group should have proper role
    const toggleGroup = canvasElement.querySelector('[role="group"]');
    expect(toggleGroup).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('scaleSelector.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: scaleSelectorStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('scaleSelector.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: scaleSelectorStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('scaleSelector.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: scaleSelectorStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('scaleSelector.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: scaleSelectorStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
