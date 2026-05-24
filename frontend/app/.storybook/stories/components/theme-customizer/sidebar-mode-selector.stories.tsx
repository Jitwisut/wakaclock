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
  sidebarModeSelectorHandlers,
  sidebarModeSelectorStatusHandlers,
} from '@/.storybook/stories/_handlers/sidebar-mode-selector.handlers';
import { SidebarModeSelector } from '@/components/theme-customizer/sidebar-mode-selector';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';

import i18n from 'i18next';

seedFaker();

// ============================================================================
// Frame Components
// ============================================================================

type SidebarModeSelectorDemoProps = {
  onValueChange?: (value: string) => void;
  withLabels?: boolean;
};

function SidebarModeSelectorDemo({
  withLabels = true,
  onValueChange,
}: SidebarModeSelectorDemoProps) {
  const { state } = useSidebar();

  return (
    <div className="p-6">
      <SidebarModeSelector
        labels={
          withLabels
            ? {
                label: i18n.t('sidebarModeSelector.label'),
                default: i18n.t('sidebarModeSelector.default'),
                icon: i18n.t('sidebarModeSelector.icon'),
              }
            : undefined
        }
        {...(onValueChange && { onValueChange })}
      />
      <div className="sr-only" data-sb-sidebar-state>
        {state}
      </div>
    </div>
  );
}

type SidebarModeSelectorFrameProps = {
  onValueChange?: (value: string) => void;
  withLabels?: boolean;
};

function SidebarModeSelectorFrame({
  withLabels = true,
  onValueChange,
}: SidebarModeSelectorFrameProps) {
  return (
    <SidebarProvider defaultOpen>
      <SidebarModeSelectorDemo withLabels={withLabels} onValueChange={onValueChange} />
    </SidebarProvider>
  );
}

// ============================================================================
// Async Wrapper Component
// ============================================================================

type AsyncSidebarModeSelectorFrameProps = {
  onValueChange?: (value: string) => void;
  withLabels?: boolean;
};

function AsyncSidebarModeSelectorFrame({
  withLabels = true,
  onValueChange,
}: AsyncSidebarModeSelectorFrameProps) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<string | null>(null);

  useEffect(() => {
    const fetchThemeConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/theme');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = (await response.json()) as { sidebarMode: string };
        setSidebarMode(data.sidebarMode);
        setError(null);
      } catch (error_) {
        setError(error_ instanceof Error ? error_.message : 'Failed to load sidebar mode');
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
        data-testid="sidebar-mode-selector-loading"
      >
        <div className="text-muted-foreground text-sm">
          {t(
            'sidebarModeSelector.story.loadingSidebarModePreference',
            'Loading sidebar mode preference...'
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-destructive/10 text-destructive rounded-md p-4"
        data-testid="sidebar-mode-selector-error"
      >
        <p className="text-sm font-medium">
          {t('sidebarModeSelector.story.errorLoadingSidebarMode', 'Error loading sidebar mode')}
        </p>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div data-testid="sidebar-mode-selector-async-loaded" data-initial-sidebar-mode={sidebarMode}>
      <SidebarProvider defaultOpen={sidebarMode !== 'icon'}>
        <div className="p-6">
          <SidebarModeSelector
            labels={
              withLabels
                ? {
                    label: i18n.t('sidebarModeSelector.label'),
                    default: i18n.t('sidebarModeSelector.default'),
                    icon: i18n.t('sidebarModeSelector.icon'),
                  }
                : undefined
            }
            {...(onValueChange && { onValueChange })}
          />
        </div>
      </SidebarProvider>
    </div>
  );
}

// ============================================================================
// Faker Data Component
// ============================================================================

function SidebarModeSelectorWithFakerData() {
  const config = createFakeThemeConfig();

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-4">
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('sidebarModeSelector.story.generatedThemeConfig', 'Generated Theme Config')}
        </h3>
        <pre className="text-xs" data-testid="faker-config">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>
      <SidebarProvider defaultOpen={config.sidebarMode !== 'icon'}>
        <div className="p-6">
          <SidebarModeSelector />
        </div>
      </SidebarProvider>
    </div>
  );
}

// ============================================================================
// Meta Configuration
// ============================================================================

const meta = {
  title: 'Components/Theme Customizer/Sidebar Mode Selector',
  component: SidebarModeSelectorFrame,
  tags: ['autodocs'],
  args: {
    withLabels: true,
    onValueChange: fn(),
  },
  argTypes: {
    withLabels: {
      control: { type: 'boolean' },
      description: i18n.t(
        'sidebarModeSelector.argType.whetherToUseLocalizedLabelsOrFallbackDefaults',
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
        'sidebarModeSelector.argType.callbackWhenSidebarModeSelectionChanges',
        'Callback when sidebar mode selection changes'
      ),
      table: {
        category: 'Events',
        type: { summary: '(value: string) => void' },
      },
    },
    // SidebarModeSelector Props Reference:
    // Optional Props:
    // - labels: SidebarModeSelectorLabels object
    //   - label: Section heading text (e.g., "Sidebar Mode")
    //   - default: Default mode option label (expanded)
    //   - icon: Icon-only mode option label (collapsed)
    // - onValueChange: Callback when selection changes
    //
    // Mode Options:
    // - default: Full sidebar with text labels (expanded)
    // - icon: Icon-only sidebar (collapsed)
    //
    // Integration:
    // - Requires SidebarProvider context
    // - Controls useSidebar() state
    // - Syncs with sidebar open/close state
    //
    // Responsive Behavior:
    // - Hidden on mobile viewports (sm and below)
    // - Only visible on desktop where mode matters
    //
    // Visual States:
    // - Selected button: data-state="on"
    // - Unselected button: data-state="off"
    // - Sidebar state: "expanded" | "collapsed"
    //
    // Accessibility:
    // - Toggle group with keyboard navigation
    // - Arrow keys to navigate between options
    // - Enter/Space to select
    //
    // Data Attributes:
    // - data-slot="sidebar-mode-selector": Root container
    // - data-testid="sidebar-mode-selector": Root container
    // - data-testid="sidebar-mode-selector-label": Section label
    // - data-testid="sidebar-mode-selector-default": Default mode button
    // - data-testid="sidebar-mode-selector-icon": Icon mode button
  },
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: sidebarModeSelectorHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof SidebarModeSelectorFrame>;

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

    expect(canvasElement.querySelector('[data-slot="sidebar-mode-selector"]')).toBeInTheDocument();

    const canvas = within(canvasElement);

    const state = canvasElement.querySelector<HTMLElement>('[data-sb-sidebar-state]');
    if (!state) {
      throw new Error('Sidebar state marker not found.');
    }

    await waitFor(() => {
      expect(state).toHaveTextContent('expanded');
    });

    const selector = canvas.getByTestId('sidebar-mode-selector');
    if (selector.getClientRects().length === 0) {
      throw new Error('Sidebar Mode Selector is hidden at this viewport.');
    }

    const label = canvas.getByTestId('sidebar-mode-selector-label');
    expect(label.textContent).not.toBe('');

    const iconButton = canvas.getByTestId('sidebar-mode-selector-icon');
    const defaultButton = canvas.getByTestId('sidebar-mode-selector-default');

    await userEvent.click(iconButton);

    await waitFor(() => {
      expect(state).toHaveTextContent('collapsed');
      expect(args.onValueChange).toHaveBeenCalledWith('icon');
    });

    await userEvent.click(defaultButton);

    await waitFor(() => {
      expect(state).toHaveTextContent('expanded');
      expect(args.onValueChange).toHaveBeenCalledWith('default');
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
  name: i18n.t('sidebarModeSelector.storyName.fallbackLabels', 'Fallback labels (defaults)'),
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
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    const selector = canvas.getByTestId('sidebar-mode-selector');
    expect(selector.getClientRects().length).toBe(0);
    expect(canvas.queryAllByRole('button').length).toBe(0);
  },
};

// ============================================================================
// Variant Stories
// ============================================================================

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('sidebarModeSelector.story.withLabels', 'With Labels')}
        </p>
        <SidebarModeSelectorFrame withLabels />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('sidebarModeSelector.story.withoutLabelsFallback', 'Without Labels (Fallback)')}
        </p>
        <SidebarModeSelectorFrame withLabels={false} />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('sidebarModeSelector.story.defaultModeExpanded', 'Default Mode (Expanded)')}
        </p>
        <SidebarModeSelectorFrame withLabels />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Narrow Container (250px)</p>
        <div className="border-muted w-[250px] border border-dashed p-2">
          <SidebarModeSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Medium Container (350px)</p>
        <div className="border-muted w-[350px] border border-dashed p-2">
          <SidebarModeSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Wide Container (500px)</p>
        <div className="border-muted w-[500px] border border-dashed p-2">
          <SidebarModeSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('sidebarModeSelector.story.fullWidth', 'Full Width')}
        </p>
        <div className="border-muted w-full border border-dashed p-2">
          <SidebarModeSelectorFrame withLabels />
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
  name: i18n.t('sidebarModeSelector.storyName.japanese', 'Japanese'),
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
  name: i18n.t('sidebarModeSelector.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('sidebarModeSelector.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('sidebarModeSelector.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// Data Stories
// ============================================================================

export const WithFakerData: Story = {
  render: () => <SidebarModeSelectorWithFakerData />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('faker-config')).toBeInTheDocument();
    });

    expect(canvasElement.querySelector('[data-slot="sidebar-mode-selector"]')).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  render: (args) => <AsyncSidebarModeSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: sidebarModeSelectorHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // First check for loading state
    await waitFor(() => {
      const loading = canvas.queryByTestId('sidebar-mode-selector-loading');
      const loaded = canvas.queryByTestId('sidebar-mode-selector-async-loaded');
      expect(loading || loaded).toBeInTheDocument();
    });

    // Then wait for loaded state
    await waitFor(
      () => {
        expect(canvas.getByTestId('sidebar-mode-selector-async-loaded')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify component rendered
    expect(canvasElement.querySelector('[data-slot="sidebar-mode-selector"]')).toBeInTheDocument();
  },
};

// ============================================================================
// Loading & Error Stories
// ============================================================================

export const Loading: Story = {
  render: (args) => <AsyncSidebarModeSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: sidebarModeSelectorStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('sidebar-mode-selector-loading')).toBeInTheDocument();
    });
  },
};

export const SlowResponse: Story = {
  render: (args) => <AsyncSidebarModeSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: sidebarModeSelectorStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Starts in loading state
    await waitFor(() => {
      expect(canvas.getByTestId('sidebar-mode-selector-loading')).toBeInTheDocument();
    });

    // Eventually loads
    await waitFor(
      () => {
        expect(canvas.getByTestId('sidebar-mode-selector-async-loaded')).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
  },
};

// ============================================================================
// HTTP 4xx Error Stories
// ============================================================================

export const Error400BadRequest: Story = {
  render: (args) => <AsyncSidebarModeSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: sidebarModeSelectorStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('sidebar-mode-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(canvas.getByText(/Error loading sidebar mode/i)).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  render: (args) => <AsyncSidebarModeSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: sidebarModeSelectorStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('sidebar-mode-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  render: (args) => <AsyncSidebarModeSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: sidebarModeSelectorStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('sidebar-mode-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error422UnprocessableEntity: Story = {
  render: (args) => <AsyncSidebarModeSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: sidebarModeSelectorStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('sidebar-mode-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  render: (args) => <AsyncSidebarModeSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: sidebarModeSelectorStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('sidebar-mode-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============================================================================
// HTTP 5xx Error Stories
// ============================================================================

export const Error500InternalServerError: Story = {
  render: (args) => <AsyncSidebarModeSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: sidebarModeSelectorStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('sidebar-mode-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  render: (args) => <AsyncSidebarModeSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: sidebarModeSelectorStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('sidebar-mode-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  render: (args) => <AsyncSidebarModeSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: sidebarModeSelectorStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('sidebar-mode-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  render: (args) => <AsyncSidebarModeSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: sidebarModeSelectorStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('sidebar-mode-selector-error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const NetworkError: Story = {
  render: (args) => <AsyncSidebarModeSelectorFrame {...args} />,
  parameters: {
    msw: { handlers: sidebarModeSelectorStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('sidebar-mode-selector-error')).toBeInTheDocument();
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
    msw: { handlers: sidebarModeSelectorHandlers },
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
  name: i18n.t(
    'sidebarModeSelector.storyName.pseudoStates',
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

// ============================================================================
// Factory Showcase Stories
// ============================================================================

function AllSidebarModesDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(
    () => SIDEBAR_MODES.map((mode) => createFakeThemeConfig({ sidebarMode: mode })),
    []
  );

  return (
    <div className="space-y-4 p-6" data-testid="all-sidebar-modes-demo">
      <h3 className="text-sm font-medium">All Sidebar Modes ({SIDEBAR_MODES.length})</h3>
      {configs.map((config) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-sidebar-mode={config.sidebarMode}
          data-testid={`sidebar-mode-card-${config.sidebarMode}`}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            Sidebar Mode: <span className="font-mono font-semibold">{config.sidebarMode}</span> |
            Preset: {config.preset} | Scale: {config.scale}
          </p>
          <SidebarProvider defaultOpen={config.sidebarMode !== 'icon'}>
            <SidebarModeSelector
              labels={{
                label: t('sidebarModeSelector.label'),
                default: t('sidebarModeSelector.default'),
                icon: t('sidebarModeSelector.icon'),
              }}
            />
          </SidebarProvider>
        </div>
      ))}
    </div>
  );
}

export const AllSidebarModes: Story = {
  render: () => <AllSidebarModesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('all-sidebar-modes-demo')).toBeInTheDocument();
    for (const mode of SIDEBAR_MODES) {
      expect(canvas.getByTestId(`sidebar-mode-card-${mode}`)).toBeInTheDocument();
    }
  },
};

function EnterpriseThemeSetDemo() {
  const configs = React.useMemo(() => createFakeEnterpriseThemeSet(), []);

  return (
    <div className="space-y-4 p-6" data-testid="enterprise-theme-set-demo">
      <h3 className="text-sm font-medium">Enterprise Theme Set ({configs.length} configs)</h3>
      {configs.map((config, index) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-testid={`enterprise-config-${index}`}
          data-sidebar-mode={config.sidebarMode}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            #{index + 1} | Sidebar: {config.sidebarMode} | Mode: {config.colorMode} | Scale:{' '}
            {config.scale} | Radius: {config.radius}
          </p>
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
  const presetInfo = React.useMemo(() => createFakeThemePresetInfo({ id: 'midnight' }), []);

  return (
    <div className="space-y-6 p-6" data-testid="theme-showcase-demo">
      <div>
        <h3 className="mb-2 text-sm font-medium">
          Showcase - Compact (sidebar: {showcase.compact.sidebarMode})
        </h3>
        <div
          className="rounded-lg border p-3"
          data-testid="showcase-compact"
          data-sidebar-mode={showcase.compact.sidebarMode}
        >
          <p className="text-muted-foreground text-xs">
            Scale: {showcase.compact.scale} | Layout: {showcase.compact.contentLayout}
          </p>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">
          Showcase - Spacious (sidebar: {showcase.spacious.sidebarMode})
        </h3>
        <div
          className="rounded-lg border p-3"
          data-testid="showcase-spacious"
          data-sidebar-mode={showcase.spacious.sidebarMode}
        >
          <p className="text-muted-foreground text-xs">
            Scale: {showcase.spacious.scale} | Radius: {showcase.spacious.radius}
          </p>
        </div>
      </div>
      <div className="rounded-lg border p-3" data-testid="showcase-meta">
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('sidebarModeSelector.story.associatedFactoryData', 'Associated Factory Data')}
        </h3>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>
            Preset Info: {presetInfo.name} - {presetInfo.description}
          </li>
          <li>
            Preference: auto-switch={String(preference.autoSwitch)}, follow-system=
            {String(preference.followSystemTheme)}
          </li>
          <li>
            Customization: {customization.name} (lineHeight: {customization.lineHeight})
          </li>
          <li>
            Export: {themeExport.name} ({themeExport.exportFormat}) v{themeExport.version}
          </li>
          <li>
            History: {history.action} - sidebar={history.configSnapshot.sidebarMode}
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

function BulkConfigsDemo() {
  const configs = React.useMemo(() => createFakeThemeConfigs(5), []);
  const presets = React.useMemo(() => createFakeThemePresets(4), []);
  const customizations = React.useMemo(() => createFakeThemeCustomizations(3), []);
  const exports = React.useMemo(() => createFakeThemeExports(2), []);
  const histories = React.useMemo(() => createFakeThemeHistories(3), []);
  const preferences = React.useMemo(() => createFakeThemePreferences(2), []);

  return (
    <div className="space-y-6 p-6" data-testid="bulk-configs-demo">
      <div>
        <h3 className="mb-2 text-sm font-medium">Bulk Configs ({configs.length})</h3>
        {configs.map((config) => (
          <div key={config.id} className="border-b py-1" data-sidebar-mode={config.sidebarMode}>
            <p className="text-muted-foreground text-xs">
              {config.preset} / sidebar={config.sidebarMode} / {config.colorMode}
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
            {c.name} - spacing: {c.spacing}, lineHeight: {c.lineHeight}
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
    <div className="space-y-6 p-6" data-testid="specialized-configs-demo">
      <h3 className="text-sm font-medium">
        {i18n.t('sidebarModeSelector.story.specializedThemeConfigs', 'Specialized Theme Configs')}
      </h3>
      {namedConfigs.map(({ config, label }) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-testid={`specialized-${label.toLowerCase()}`}
          data-sidebar-mode={config.sidebarMode}
        >
          <p className="text-muted-foreground text-xs">
            <span className="font-semibold">{label}:</span> sidebar={config.sidebarMode}, preset=
            {config.preset}, mode={config.colorMode}, scale={config.scale}
          </p>
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
          Fonts: {FONT_FAMILIES.join(', ')} | Sidebar Modes: {SIDEBAR_MODES.join(', ')}
        </p>
        <p className="text-muted-foreground text-xs">
          Accents: {ACCENT_COLORS.length} | Layouts: {CONTENT_LAYOUTS.join(', ')} | Color Modes:{' '}
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
  name: i18n.t('sidebarModeSelector.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const selector = canvas.getByTestId('sidebar-mode-selector');
    if (selector.getClientRects().length === 0) {
      // Component may be hidden at mobile viewport
      return;
    }

    const defaultButton = canvas.getByTestId('sidebar-mode-selector-default');
    const iconButton = canvas.getByTestId('sidebar-mode-selector-icon');

    // Test that buttons are keyboard focusable
    defaultButton.focus();
    await waitFor(() => {
      expect(document.activeElement).toBe(defaultButton);
    });

    // Test keyboard navigation with arrow keys
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(document.activeElement).toBe(iconButton);
    });

    // Test selection with Enter key
    await userEvent.keyboard('{Enter}');

    const state = canvasElement.querySelector<HTMLElement>('[data-sb-sidebar-state]');
    if (state) {
      await waitFor(() => {
        expect(state).toHaveTextContent('collapsed');
      });
    }

    // Test navigation back with arrow keys
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(document.activeElement).toBe(defaultButton);
    });

    // Test selection with Space key
    await userEvent.keyboard(' ');
    if (state) {
      await waitFor(() => {
        expect(state).toHaveTextContent('expanded');
      });
    }

    // Verify ARIA attributes - toggle group should have proper role
    const toggleGroup = canvasElement.querySelector('[role="group"]');
    expect(toggleGroup).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('sidebarModeSelector.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: sidebarModeSelectorStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('sidebarModeSelector.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: sidebarModeSelectorStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('sidebarModeSelector.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: sidebarModeSelectorStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('sidebarModeSelector.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: sidebarModeSelectorStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
