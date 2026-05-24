import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { panelHandlers, panelStatusHandlers } from '@/.storybook/stories/_handlers/panel.handlers';
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

import { ThemeCustomizerPanel } from '@/components/theme-customizer/panel';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircleIcon, RefreshCwIcon } from 'lucide-react';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

// ============ FRAME COMPONENTS ============

type ThemeCustomizerPanelFrameProps = {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onThemeChange?: (theme: Partial<ThemeConfig>) => void;
  withLabels?: boolean;
};

function ThemeCustomizerPanelFrame({
  defaultOpen = false,
  withLabels = true,
  onOpenChange,
  onThemeChange,
}: ThemeCustomizerPanelFrameProps) {
  // Notify parent when panel state changes
  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      onOpenChange?.(open);
    },
    [onOpenChange]
  );

  // Track theme changes from child components
  React.useEffect(() => {
    const handleThemeUpdate = (event: CustomEvent<Partial<ThemeConfig>>) => {
      onThemeChange?.(event.detail);
    };
    window.addEventListener('theme-change', handleThemeUpdate as never);
    return () => {
      window.removeEventListener('theme-change', handleThemeUpdate as never);
    };
  }, [onThemeChange]);

  return (
    <SidebarProvider defaultOpen>
      <div data-sb-theme-customizer-panel className="flex items-center justify-center">
        <ThemeCustomizerPanel
          defaultOpen={defaultOpen}
          onOpenChange={handleOpenChange}
          labels={
            withLabels
              ? {
                  triggerAriaLabel: i18n.t('themeCustomizerPanel.triggerAriaLabel'),
                  colorModeSelector: {
                    label: i18n.t('colorModeSelector.label'),
                    light: i18n.t('colorModeSelector.light'),
                    dark: i18n.t('colorModeSelector.dark'),
                  },
                  contentLayoutSelector: {
                    label: i18n.t('contentLayoutSelector.label'),
                    full: i18n.t('contentLayoutSelector.full'),
                    centered: i18n.t('contentLayoutSelector.centered'),
                  },
                }
              : undefined
          }
        />
      </div>
    </SidebarProvider>
  );
}

// ============ ASYNC THEME LOADING COMPONENT ============

interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

function ThemePanelErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="theme-panel-error">
      <AlertCircleIcon className="size-4" />
      <AlertTitle>
        Error {error.status}: {error.code}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {error.message}
        {error.details && (
          <ul className="mt-2 list-disc pl-4 text-sm">
            {Object.entries(error.details).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCwIcon className="mr-2 size-4" />
          Retry
        </Button>
      )}
    </Alert>
  );
}

function ThemePanelLoadingSkeleton() {
  return (
    <div className="p-4" data-state="loading" data-testid="theme-panel-loading">
      <div className="flex items-center gap-2">
        <Skeleton className="size-9 rounded-md" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

function AsyncThemePanelFrame() {
  const { t } = useTranslation();
  const [themeConfig, setThemeConfig] = React.useState<ThemeConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchTheme = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/theme')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<ThemeConfig>;
      })
      .then((config) => {
        setThemeConfig(config);
        setLoading(false);
        return undefined;
      })
      .catch((error_: ApiError) => {
        setError(error_);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchTheme();
  }, [fetchTheme]);

  if (loading) {
    return <ThemePanelLoadingSkeleton />;
  }

  if (error) {
    return <ThemePanelErrorDisplay error={error} onRetry={fetchTheme} />;
  }

  return (
    <SidebarProvider defaultOpen>
      <div
        className="flex items-center justify-center"
        data-state="success"
        data-testid="theme-panel-success"
        data-theme-config={JSON.stringify(themeConfig)}
      >
        <ThemeCustomizerPanel
          defaultOpen
          labels={{
            triggerAriaLabel: t('themeCustomizerPanel.triggerAriaLabel'),
            colorModeSelector: {
              label: t('colorModeSelector.label'),
              light: t('colorModeSelector.light'),
              dark: t('colorModeSelector.dark'),
            },
            contentLayoutSelector: {
              label: t('contentLayoutSelector.label'),
              full: t('contentLayoutSelector.full'),
              centered: t('contentLayoutSelector.centered'),
            },
          }}
        />
      </div>
    </SidebarProvider>
  );
}

// ============ FAKER DATA COMPONENT ============

function ThemePanelWithFakerData() {
  const { t } = useTranslation();
  const themeConfig = React.useMemo(() => createFakeThemeConfig(), []);

  return (
    <SidebarProvider defaultOpen>
      <div
        className="flex flex-col gap-4"
        data-testid="theme-panel-faker"
        data-theme-config={JSON.stringify(themeConfig)}
      >
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 text-sm font-medium">
            {t('panel.story.generatedThemeConfig', 'Generated Theme Config:')}
          </h3>
          <pre className="text-muted-foreground bg-muted overflow-auto rounded p-2 text-xs">
            {JSON.stringify(themeConfig, null, 2)}
          </pre>
        </div>
        <ThemeCustomizerPanel
          defaultOpen
          labels={{
            triggerAriaLabel: t('themeCustomizerPanel.triggerAriaLabel'),
            colorModeSelector: {
              label: t('colorModeSelector.label'),
              light: t('colorModeSelector.light'),
              dark: t('colorModeSelector.dark'),
            },
            contentLayoutSelector: {
              label: t('contentLayoutSelector.label'),
              full: t('contentLayoutSelector.full'),
              centered: t('contentLayoutSelector.centered'),
            },
          }}
        />
      </div>
    </SidebarProvider>
  );
}

// ============ I18N COMPONENT ============

function I18nThemePanelDemo() {
  const { t } = useTranslation();

  return (
    <SidebarProvider defaultOpen>
      <div className="flex items-center justify-center">
        <ThemeCustomizerPanel
          defaultOpen
          labels={{
            triggerAriaLabel: t('themeCustomizerPanel.triggerAriaLabel'),
            colorModeSelector: {
              label: t('colorModeSelector.label'),
              light: t('colorModeSelector.light'),
              dark: t('colorModeSelector.dark'),
            },
            contentLayoutSelector: {
              label: t('contentLayoutSelector.label'),
              full: t('contentLayoutSelector.full'),
              centered: t('contentLayoutSelector.centered'),
            },
          }}
        />
      </div>
    </SidebarProvider>
  );
}

// ============ META ============

const meta = {
  title: 'Components/Theme Customizer/Panel',
  component: ThemeCustomizerPanelFrame,
  tags: ['autodocs'],
  args: {
    defaultOpen: false,
    withLabels: true,
    onOpenChange: fn(),
    onThemeChange: fn(),
  },
  argTypes: {
    // State
    defaultOpen: {
      control: { type: 'boolean' },
      description: i18n.t(
        'panel.argType.whetherThePanelIsOpenByDefault',
        'Whether the panel is open by default'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    // Content
    withLabels: {
      control: { type: 'boolean' },
      description: i18n.t(
        'panel.argType.whetherToUseLocalizedLabelsOrFallbackDefaults',
        'Whether to use localized labels or fallback defaults'
      ),
      table: {
        category: 'Content',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // Events
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'panel.argType.calledWhenThePanelOpenStateChanges',
        'Called when the panel open state changes'
      ),
      table: { category: 'Events' },
    },
    onThemeChange: {
      action: 'onThemeChange',
      description: i18n.t(
        'panel.argType.calledWhenThemeSettingsAreModified',
        'Called when theme settings are modified'
      ),
      table: { category: 'Events' },
    },
    // ThemeCustomizerPanel Props Reference:
    // Optional Props:
    // - defaultOpen: boolean - Initial open state (default: false)
    // - labels: ThemeCustomizerPanelLabels object
    //   - triggerAriaLabel: Aria label for settings button
    //   - colorModeSelector: ColorModeSelectorLabels
    //   - contentLayoutSelector: ContentLayoutSelectorLabels
    //
    // Panel Contents:
    // - ColorModeSelector: Light/Dark toggle
    // - ContentLayoutSelector: Full/Centered toggle
    // - Additional theme options can be added
    //
    // Trigger:
    // - Settings gear icon button
    // - Opens dropdown menu with theme options
    //
    // Integration:
    // - Requires SidebarProvider context
    // - Works with theme customizer components
    //
    // Data Attributes:
    // - data-testid="theme-customizer-panel-trigger": Trigger button
    // - data-testid="theme-customizer-panel-menu": Dropdown menu
  },
  parameters: {
    msw: { handlers: panelHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ThemeCustomizerPanelFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============ BASIC STORIES ============

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Opened: Story = {
  args: {
    ...(Closed.args ?? {}),
    defaultOpen: true,
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Closed,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="theme-customizer-panel"]')).toBeInTheDocument();

    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('theme-customizer-panel-trigger');

    await userEvent.click(trigger);

    const content = await waitFor(() => {
      const element = doc.querySelector<HTMLElement>('[data-testid="theme-customizer-panel-menu"]');
      if (!element) {
        throw new Error('Dropdown menu content not found.');
      }
      return element;
    });

    const menu = within(content);

    const label = menu.getByTestId('color-mode-selector-label');
    expect(label.textContent).not.toBe('');
    expect(menu.getByTestId('color-mode-selector-light')).toBeInTheDocument();
    expect(menu.getByTestId('color-mode-selector-dark')).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ VARIANT STORIES ============

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('panel.story.closedState', 'Closed State')}
        </p>
        <ThemeCustomizerPanelFrame defaultOpen={false} withLabels />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('panel.story.openState', 'Open State')}
        </p>
        <ThemeCustomizerPanelFrame defaultOpen withLabels />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('panel.story.withoutLabelsFallback', 'Without Labels (Fallback)')}
        </p>
        <ThemeCustomizerPanelFrame defaultOpen withLabels={false} />
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
        <p className="text-muted-foreground mb-2 text-sm font-medium">Compact Container (200px)</p>
        <div className="border-muted w-[200px] border border-dashed p-2">
          <ThemeCustomizerPanelFrame defaultOpen={false} withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Medium Container (300px)</p>
        <div className="border-muted w-[300px] border border-dashed p-2">
          <ThemeCustomizerPanelFrame defaultOpen={false} withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Wide Container (400px)</p>
        <div className="border-muted w-[400px] border border-dashed p-2">
          <ThemeCustomizerPanelFrame defaultOpen={false} withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('panel.story.fullWidth', 'Full Width')}
        </p>
        <div className="border-muted w-full border border-dashed p-2">
          <ThemeCustomizerPanelFrame defaultOpen={false} withLabels />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ THEME STORIES ============

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
  name: i18n.t('panel.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: () => <I18nThemePanelDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');
    await Default.play?.(context);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('panel.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('panel.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('panel.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const FallbackLabels: Story = {
  ...Default,
  name: i18n.t('panel.storyName.fallbackLabels', 'Fallback labels (defaults)'),
  args: {
    ...(Default.args ?? {}),
    withLabels: false,
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => <ThemePanelWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="theme-panel-faker"]')).toBeInTheDocument();
    const configEl = canvasElement.querySelector('[data-theme-config]');
    expect(configEl).toBeInTheDocument();
    const config = JSON.parse(configEl?.getAttribute('data-theme-config') ?? '{}') as {
      colorMode?: string;
      preset?: string;
    };
    expect(config.preset).not.toBe('');
    expect(config.colorMode).not.toBe('');
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: panelHandlers },
  },
  render: () => <AsyncThemePanelFrame />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(canvasElement.querySelector('[data-testid="theme-panel-loading"]')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="theme-panel-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: panelStatusHandlers.loading },
  },
  render: () => <AsyncThemePanelFrame />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="theme-panel-loading"]')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('panel.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: panelStatusHandlers.slowResponse },
  },
  render: () => <AsyncThemePanelFrame />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(canvasElement.querySelector('[data-testid="theme-panel-loading"]')).toBeInTheDocument();
    // Wait for data (slow response takes 5s)
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="theme-panel-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('panel.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: panelStatusHandlers.badRequest },
  },
  render: () => <AsyncThemePanelFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="400"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('panel.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: panelStatusHandlers.unauthorized },
  },
  render: () => <AsyncThemePanelFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="401"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('panel.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: panelStatusHandlers.forbidden },
  },
  render: () => <AsyncThemePanelFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="403"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t('panel.storyName.error422UnprocessableEntity', 'Error 422: Validation'),
  parameters: {
    msw: { handlers: panelStatusHandlers.unprocessableEntity },
  },
  render: () => <AsyncThemePanelFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="422"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('panel.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: panelStatusHandlers.tooManyRequests },
  },
  render: () => <AsyncThemePanelFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="429"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t('panel.storyName.error500InternalServerError', 'Error 500: Internal Server Error'),
  parameters: {
    msw: { handlers: panelStatusHandlers.internalServerError },
  },
  render: () => <AsyncThemePanelFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="500"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('panel.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: panelStatusHandlers.badGateway },
  },
  render: () => <AsyncThemePanelFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="502"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('panel.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: panelStatusHandlers.serviceUnavailable },
  },
  render: () => <AsyncThemePanelFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="503"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('panel.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: panelStatusHandlers.gatewayTimeout },
  },
  render: () => <AsyncThemePanelFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="504"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ SPECIAL STATE STORIES ============

export const NetworkError: Story = {
  name: i18n.t('panel.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: panelStatusHandlers.networkError },
  },
  render: () => <AsyncThemePanelFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="theme-panel-error"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: panelHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ DESIGN REFERENCE ============

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
  name: i18n.t('panel.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ FACTORY SHOWCASE STORIES ============

function EnterpriseThemeSetDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(() => createFakeEnterpriseThemeSet(), []);

  return (
    <div className="space-y-4" data-testid="enterprise-theme-set-demo">
      <h3 className="text-sm font-medium">Enterprise Theme Set ({configs.length} configs)</h3>
      {configs.map((config, index) => (
        <SidebarProvider key={config.id} defaultOpen>
          <div
            className="rounded-lg border p-3"
            data-testid={`enterprise-config-${index}`}
            data-theme-config={JSON.stringify({
              preset: config.preset,
              colorMode: config.colorMode,
            })}
          >
            <p className="text-muted-foreground mb-1 text-xs">
              #{index + 1} | Preset: {config.preset} | Mode: {config.colorMode} | Scale:{' '}
              {config.scale} | Radius: {config.radius}
            </p>
            <ThemeCustomizerPanel
              defaultOpen={false}
              labels={{
                triggerAriaLabel: t('themeCustomizerPanel.triggerAriaLabel'),
                colorModeSelector: {
                  label: t('colorModeSelector.label'),
                  light: t('colorModeSelector.light'),
                  dark: t('colorModeSelector.dark'),
                },
                contentLayoutSelector: {
                  label: t('contentLayoutSelector.label'),
                  full: t('contentLayoutSelector.full'),
                  centered: t('contentLayoutSelector.centered'),
                },
              }}
            />
          </div>
        </SidebarProvider>
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
  const presetInfo = React.useMemo(() => createFakeThemePresetInfo({ id: 'forest' }), []);

  return (
    <div className="space-y-6" data-testid="theme-showcase-demo">
      <div>
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('panel.story.showcaseDefaultConfig', 'Showcase - Default Config')}
        </h3>
        <div
          className="rounded-lg border p-3"
          data-testid="showcase-default"
          data-theme-config={JSON.stringify(showcase.default)}
        >
          <p className="text-muted-foreground text-xs">
            Preset: {showcase.default.preset} | Mode: {showcase.default.colorMode} | Layout:{' '}
            {showcase.default.contentLayout}
          </p>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('panel.story.showcaseAccessibleConfig', 'Showcase - Accessible Config')}
        </h3>
        <div
          className="rounded-lg border p-3"
          data-testid="showcase-accessible"
          data-theme-config={JSON.stringify(showcase.accessible)}
        >
          <p className="text-muted-foreground text-xs">
            High Contrast: {String(showcase.accessible.highContrast)} | Reduced Motion:{' '}
            {String(showcase.accessible.reducedMotion)} | Scale: {showcase.accessible.scale}
          </p>
        </div>
      </div>
      <div className="rounded-lg border p-3" data-testid="showcase-meta">
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('panel.story.associatedFactoryData', 'Associated Factory Data')}
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
  const presets = React.useMemo(() => createFakeThemePresets(6), []);
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
              {config.preset} / {config.colorMode} / {config.contentLayout} / {config.scale}
            </p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Presets ({presets.length})</h3>
        {presets.map((p) => (
          <div key={p.id} className="border-b py-1">
            <p className="text-muted-foreground text-xs">
              {p.name}: {p.description} ({p.isDark ? 'dark' : 'light'})
            </p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Customizations ({customizations.length})</h3>
        {customizations.map((c) => (
          <p key={c.id} className="text-muted-foreground text-xs">
            {c.name} - borderRadius: {c.borderRadius}, fontScale: {c.fontScale}
          </p>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Exports ({exports.length})</h3>
        {exports.map((e) => (
          <p key={e.id} className="text-muted-foreground text-xs">
            {e.name} ({e.exportFormat}) v{e.version}
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
        {i18n.t('panel.story.specializedThemeConfigs', 'Specialized Theme Configs')}
      </h3>
      {namedConfigs.map(({ config, label }) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-testid={`specialized-${label.toLowerCase()}`}
        >
          <p className="text-muted-foreground text-xs">
            <span className="font-semibold">{label}:</span> preset={config.preset}, mode=
            {config.colorMode}, layout={config.contentLayout}, radius={config.radius}, scale=
            {config.scale}
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
          Constants: Fonts={FONT_FAMILIES.join(', ')} | Sidebars={SIDEBAR_MODES.join(', ')} |
          Accents={ACCENT_COLORS.length} | Layouts={CONTENT_LAYOUTS.join(', ')} | Modes=
          {COLOR_MODES.join(', ')}
        </p>
        <p className="text-muted-foreground text-xs">
          Preset IDs: {THEME_PRESET_IDS.join(', ')} | Built-in presets: {THEME_PRESETS.length}
        </p>
        <p className="text-muted-foreground text-xs">
          Radii: {THEME_RADII.join(', ')} | Scales: {THEME_SCALES.join(', ')}
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

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('panel.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('theme-customizer-panel-trigger');

    // Test that trigger button is keyboard focusable
    trigger.focus();
    await waitFor(() => {
      expect(doc.activeElement).toBe(trigger);
    });

    // Verify trigger has accessible name (aria-label)
    expect(trigger.getAttribute('aria-label') || trigger.textContent).not.toBe('');

    // Test opening with Enter key
    await userEvent.keyboard('{Enter}');

    const content = await waitFor(() => {
      const element = doc.querySelector<HTMLElement>('[data-testid="theme-customizer-panel-menu"]');
      if (!element) {
        throw new Error('Dropdown menu content not found.');
      }
      return element;
    });

    // Verify menu has proper ARIA attributes
    expect(content).toBeInTheDocument();

    // Test keyboard navigation within menu
    const menu = within(content);
    const lightButton = menu.getByTestId('color-mode-selector-light');
    const darkButton = menu.getByTestId('color-mode-selector-dark');

    lightButton.focus();
    await waitFor(() => {
      expect(doc.activeElement).toBe(lightButton);
    });

    // Test arrow key navigation
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(doc.activeElement).toBe(darkButton);
    });

    // Test Escape key closes menu
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      const menuAfterEsc = doc.querySelector<HTMLElement>(
        '[data-testid="theme-customizer-panel-menu"]'
      );
      expect(menuAfterEsc).not.toBeInTheDocument();
    });
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('panel.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: panelStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('panel.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: panelStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('panel.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: panelStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('panel.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: panelStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
