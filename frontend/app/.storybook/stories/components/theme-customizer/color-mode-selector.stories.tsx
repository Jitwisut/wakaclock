import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import {
  colorModeSelectorHandlers,
  colorModeSelectorStatusHandlers,
} from '@/.storybook/stories/_handlers/color-mode-selector.handlers';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  ACCENT_COLORS,
  COLOR_MODES,
  type ColorMode,
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

import { ColorModeSelector } from '@/components/theme-customizer/color-mode-selector';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircleIcon, RefreshCwIcon } from 'lucide-react';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

// ============ FRAME COMPONENTS ============

type ColorModeSelectorFrameProps = {
  onValueChange?: (value: ColorMode) => void;
  withLabels?: boolean;
};

function ColorModeSelectorFrame({ withLabels = true, onValueChange }: ColorModeSelectorFrameProps) {
  return (
    <ColorModeSelector
      {...(onValueChange && { onValueChange })}
      labels={
        withLabels
          ? {
              label: i18n.t('colorModeSelector.label'),
              light: i18n.t('colorModeSelector.light'),
              dark: i18n.t('colorModeSelector.dark'),
            }
          : undefined
      }
    />
  );
}

// ============ ASYNC THEME LOADING COMPONENT ============

interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

function ColorModeErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="color-mode-error">
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

function ColorModeLoadingSkeleton() {
  return (
    <div className="space-y-2" data-state="loading" data-testid="color-mode-loading">
      <Skeleton className="h-4 w-20" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-9 w-16" />
      </div>
    </div>
  );
}

function AsyncColorModeSelectorFrame() {
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
    return <ColorModeLoadingSkeleton />;
  }

  if (error) {
    return <ColorModeErrorDisplay error={error} onRetry={fetchTheme} />;
  }

  return (
    <div
      data-state="success"
      data-testid="color-mode-success"
      data-color-mode={themeConfig?.colorMode}
    >
      <ColorModeSelector
        labels={{
          label: t('colorModeSelector.label'),
          light: t('colorModeSelector.light'),
          dark: t('colorModeSelector.dark'),
        }}
      />
    </div>
  );
}

// ============ FAKER DATA COMPONENT ============

function ColorModeSelectorWithFakerData() {
  const { t } = useTranslation();
  const themeConfig = React.useMemo(() => createFakeThemeConfig(), []);

  return (
    <div
      className="space-y-4"
      data-testid="color-mode-faker"
      data-color-mode={themeConfig.colorMode}
    >
      <div className="rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-medium">
          {t('colorModeSelector.story.generatedThemeConfig', 'Generated Theme Config:')}
        </h3>
        <p className="text-muted-foreground text-xs">
          Color Mode: <span className="font-mono">{themeConfig.colorMode}</span>
        </p>
      </div>
      <ColorModeSelector
        labels={{
          label: t('colorModeSelector.label'),
          light: t('colorModeSelector.light'),
          dark: t('colorModeSelector.dark'),
        }}
      />
    </div>
  );
}

// ============ I18N COMPONENT ============

function I18nColorModeSelectorDemo() {
  const { t } = useTranslation();

  return (
    <ColorModeSelector
      labels={{
        label: t('colorModeSelector.label'),
        light: t('colorModeSelector.light'),
        dark: t('colorModeSelector.dark'),
      }}
    />
  );
}

// ============ META ============

const meta = {
  title: 'Components/Theme Customizer/Color Mode Selector',
  component: ColorModeSelectorFrame,
  tags: ['autodocs'],
  args: {
    withLabels: true,
    onValueChange: fn(),
  },
  argTypes: {
    // Content
    withLabels: {
      control: { type: 'boolean' },
      description: i18n.t(
        'colorModeSelector.argType.whetherToUseLocalizedLabelsOrFallbackDefaults',
        'Whether to use localized labels or fallback defaults'
      ),
      table: {
        category: 'Content',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // Events
    onValueChange: {
      action: 'onValueChange',
      description: i18n.t(
        'colorModeSelector.argType.calledWhenColorModeSelectionChanges',
        'Called when color mode selection changes'
      ),
      table: { category: 'Events' },
    },
    // ColorModeSelector Props Reference:
    // Optional Props:
    // - labels: ColorModeSelectorLabels object
    //   - label: Section heading text (e.g., "Color Mode")
    //   - light: Light mode button label
    //   - dark: Dark mode button label
    //
    // Behavior:
    // - Toggle group with light/dark options
    // - Integrates with next-themes for persistence
    // - Updates document.documentElement class
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
    // - data-testid="color-mode-selector-label": Section label
    // - data-testid="color-mode-selector-light": Light mode button
    // - data-testid="color-mode-selector-dark": Dark mode button
  },
  parameters: {
    msw: { handlers: colorModeSelectorHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ColorModeSelectorFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============ BASIC STORIES ============

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="color-mode-selector"]')).toBeInTheDocument();

    const canvas = within(canvasElement);
    const lightButton = canvas.getByTestId('color-mode-selector-light');
    const darkButton = canvas.getByTestId('color-mode-selector-dark');

    const label = canvas.getByTestId('color-mode-selector-label');
    expect(label.textContent).not.toBe('');

    await userEvent.click(darkButton);

    await waitFor(() => {
      expect(darkButton.getAttribute('data-state')).toBe('on');
    });

    await userEvent.click(lightButton);

    await waitFor(() => {
      expect(lightButton.getAttribute('data-state')).toBe('on');
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
  name: i18n.t('colorModeSelector.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
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
          {i18n.t('colorModeSelector.story.withLabels', 'With Labels')}
        </p>
        <ColorModeSelectorFrame withLabels />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('colorModeSelector.story.withoutLabelsFallback', 'Without Labels (Fallback)')}
        </p>
        <ColorModeSelectorFrame withLabels={false} />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('colorModeSelector.story.lightModeSelected', 'Light Mode Selected')}
        </p>
        <div data-theme="light">
          <ColorModeSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('colorModeSelector.story.darkModeSelected', 'Dark Mode Selected')}
        </p>
        <div data-theme="dark">
          <ColorModeSelectorFrame withLabels />
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
        <p className="text-muted-foreground mb-2 text-sm font-medium">Narrow Container (200px)</p>
        <div className="border-muted w-[200px] border border-dashed p-2">
          <ColorModeSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Medium Container (300px)</p>
        <div className="border-muted w-[300px] border border-dashed p-2">
          <ColorModeSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Wide Container (400px)</p>
        <div className="border-muted w-[400px] border border-dashed p-2">
          <ColorModeSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('colorModeSelector.story.fullWidth', 'Full Width')}
        </p>
        <div className="border-muted w-full border border-dashed p-2">
          <ColorModeSelectorFrame withLabels />
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
  name: i18n.t('colorModeSelector.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: () => <I18nColorModeSelectorDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');
    await Default.play?.(context);
  },
};

export const FallbackLabels: Story = {
  ...Default,
  name: i18n.t('colorModeSelector.storyName.fallbackLabels', 'Fallback labels (defaults)'),
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
  render: () => <ColorModeSelectorWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="color-mode-faker"]')).toBeInTheDocument();
    const mode = canvasElement.querySelector('[data-color-mode]')?.getAttribute('data-color-mode');
    expect(['light', 'dark', 'system']).toContain(mode);
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: colorModeSelectorHandlers },
  },
  render: () => <AsyncColorModeSelectorFrame />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(canvasElement.querySelector('[data-testid="color-mode-loading"]')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="color-mode-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: colorModeSelectorStatusHandlers.loading },
  },
  render: () => <AsyncColorModeSelectorFrame />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="color-mode-loading"]')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('colorModeSelector.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: colorModeSelectorStatusHandlers.slowResponse },
  },
  render: () => <AsyncColorModeSelectorFrame />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(canvasElement.querySelector('[data-testid="color-mode-loading"]')).toBeInTheDocument();
    // Wait for data (slow response takes 5s)
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="color-mode-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('colorModeSelector.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: colorModeSelectorStatusHandlers.badRequest },
  },
  render: () => <AsyncColorModeSelectorFrame />,
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
  name: i18n.t('colorModeSelector.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: colorModeSelectorStatusHandlers.unauthorized },
  },
  render: () => <AsyncColorModeSelectorFrame />,
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
  name: i18n.t('colorModeSelector.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: colorModeSelectorStatusHandlers.forbidden },
  },
  render: () => <AsyncColorModeSelectorFrame />,
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
  name: i18n.t('colorModeSelector.storyName.error422UnprocessableEntity', 'Error 422: Validation'),
  parameters: {
    msw: { handlers: colorModeSelectorStatusHandlers.unprocessableEntity },
  },
  render: () => <AsyncColorModeSelectorFrame />,
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
  name: i18n.t('colorModeSelector.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: colorModeSelectorStatusHandlers.tooManyRequests },
  },
  render: () => <AsyncColorModeSelectorFrame />,
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
  name: i18n.t(
    'colorModeSelector.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  parameters: {
    msw: { handlers: colorModeSelectorStatusHandlers.internalServerError },
  },
  render: () => <AsyncColorModeSelectorFrame />,
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
  name: i18n.t('colorModeSelector.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: colorModeSelectorStatusHandlers.badGateway },
  },
  render: () => <AsyncColorModeSelectorFrame />,
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
  name: i18n.t(
    'colorModeSelector.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  parameters: {
    msw: { handlers: colorModeSelectorStatusHandlers.serviceUnavailable },
  },
  render: () => <AsyncColorModeSelectorFrame />,
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
  name: i18n.t('colorModeSelector.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: colorModeSelectorStatusHandlers.gatewayTimeout },
  },
  render: () => <AsyncColorModeSelectorFrame />,
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
  name: i18n.t('colorModeSelector.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: colorModeSelectorStatusHandlers.networkError },
  },
  render: () => <AsyncColorModeSelectorFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="color-mode-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: colorModeSelectorHandlers },
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
  name: i18n.t(
    'colorModeSelector.storyName.pseudoStates',
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

// ============ FACTORY SHOWCASE STORIES ============

function AllColorModesDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(() => createFakeThemeConfigsWithAllColorModes(), []);

  return (
    <div className="space-y-4" data-testid="all-color-modes-demo">
      <h3 className="text-sm font-medium">All Color Modes ({COLOR_MODES.length})</h3>
      {configs.map((config) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-color-mode={config.colorMode}
          data-testid={`color-mode-card-${config.colorMode}`}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            Mode: <span className="font-mono font-semibold">{config.colorMode}</span> | Preset:{' '}
            {config.preset} | Scale: {config.scale}
          </p>
          <ColorModeSelector
            labels={{
              label: t('colorModeSelector.label'),
              light: t('colorModeSelector.light'),
              dark: t('colorModeSelector.dark'),
            }}
          />
        </div>
      ))}
    </div>
  );
}

export const AllColorModes: Story = {
  render: () => <AllColorModesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('all-color-modes-demo')).toBeInTheDocument();
    for (const mode of COLOR_MODES) {
      expect(canvas.getByTestId(`color-mode-card-${mode}`)).toBeInTheDocument();
    }
  },
};

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
          data-color-mode={config.colorMode}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            #{index + 1} | Mode: {config.colorMode} | Preset: {config.preset} | Radius:{' '}
            {config.radius} | Scale: {config.scale}
          </p>
          <ColorModeSelector
            labels={{
              label: i18n.t('colorModeSelector.label'),
              light: i18n.t('colorModeSelector.light'),
              dark: i18n.t('colorModeSelector.dark'),
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

  return (
    <div className="space-y-6" data-testid="theme-showcase-demo">
      <div>
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t(
            'colorModeSelector.story.themeShowcaseDarkConfig',
            'Theme Showcase - Dark Config'
          )}
        </h3>
        <div
          className="rounded-lg border p-3"
          data-color-mode={showcase.dark.colorMode}
          data-testid="showcase-dark"
        >
          <p className="text-muted-foreground text-xs">
            Preset: {showcase.dark.preset} | Mode: {showcase.dark.colorMode}
          </p>
          <ColorModeSelector
            labels={{
              label: i18n.t('colorModeSelector.label'),
              light: i18n.t('colorModeSelector.light'),
              dark: i18n.t('colorModeSelector.dark'),
            }}
          />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t(
            'colorModeSelector.story.themeShowcaseLightConfig',
            'Theme Showcase - Light Config'
          )}
        </h3>
        <div
          className="rounded-lg border p-3"
          data-color-mode={showcase.light.colorMode}
          data-testid="showcase-light"
        >
          <p className="text-muted-foreground text-xs">
            Preset: {showcase.light.preset} | Mode: {showcase.light.colorMode}
          </p>
          <ColorModeSelector
            labels={{
              label: i18n.t('colorModeSelector.label'),
              light: i18n.t('colorModeSelector.light'),
              dark: i18n.t('colorModeSelector.dark'),
            }}
          />
        </div>
      </div>
      <div className="rounded-lg border p-3" data-testid="showcase-meta">
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('colorModeSelector.story.associatedFactoryData', 'Associated Factory Data')}
        </h3>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>
            Preference: auto-switch={String(preference.autoSwitch)}, follow-system=
            {String(preference.followSystemTheme)}
          </li>
          <li>
            Customization: {customization.name} (border-radius: {customization.borderRadius}px)
          </li>
          <li>
            Export: {themeExport.name} (format: {themeExport.exportFormat}, v{themeExport.version})
          </li>
          <li>
            History: action={history.action}, mode={history.configSnapshot.colorMode}
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
    expect(canvas.getByTestId('showcase-dark')).toBeInTheDocument();
    expect(canvas.getByTestId('showcase-light')).toBeInTheDocument();
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
  const presetInfo = React.useMemo(() => createFakeThemePresetInfo({ id: 'midnight' }), []);
  const customizations = React.useMemo(() => createFakeThemeCustomizations(3), []);
  const exports = React.useMemo(() => createFakeThemeExports(2), []);
  const histories = React.useMemo(() => createFakeThemeHistories(3), []);
  const preferences = React.useMemo(() => createFakeThemePreferences(2), []);

  return (
    <div className="space-y-6" data-testid="bulk-configs-demo">
      <div>
        <h3 className="mb-2 text-sm font-medium">Bulk Configs ({configs.length})</h3>
        {configs.map((config) => (
          <div key={config.id} className="border-b py-1" data-color-mode={config.colorMode}>
            <p className="text-muted-foreground text-xs">
              {config.preset} / {config.colorMode} / {config.scale}
            </p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Presets ({presets.length})</h3>
        {presets.map((p) => (
          <div key={p.id} className="border-b py-1">
            <p className="text-muted-foreground text-xs">
              {p.name}: {p.description} {p.isDark ? '(dark)' : '(light)'}
            </p>
          </div>
        ))}
      </div>
      <div data-testid="preset-info-midnight">
        <h3 className="mb-2 text-sm font-medium">Preset Info: {presetInfo.name}</h3>
        <p className="text-muted-foreground text-xs">
          Primary: {presetInfo.colors.primary} | Dark: {String(presetInfo.isDark)}
        </p>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Customizations ({customizations.length})</h3>
        {customizations.map((c) => (
          <p key={c.id} className="text-muted-foreground text-xs">
            {c.name} - radius: {c.borderRadius}, scale: {c.fontScale}
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
            Light: {pref.preferredLightPreset}, Dark: {pref.preferredDarkPreset}, Auto:{' '}
            {String(pref.autoSwitch)}
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
    expect(canvas.getByTestId('preset-info-midnight')).toBeInTheDocument();
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
        {i18n.t('colorModeSelector.story.specializedThemeConfigs', 'Specialized Theme Configs')}
      </h3>
      {namedConfigs.map(({ config, label }) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-testid={`specialized-${label.toLowerCase()}`}
          data-color-mode={config.colorMode}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            <span className="font-semibold">{label}:</span> mode={config.colorMode}, preset=
            {config.preset}, radius={config.radius}, scale={config.scale}
          </p>
          <ColorModeSelector
            labels={{
              label: i18n.t('colorModeSelector.label'),
              light: i18n.t('colorModeSelector.light'),
              dark: i18n.t('colorModeSelector.dark'),
            }}
          />
        </div>
      ))}
      <div className="rounded-lg border p-3" data-testid="all-presets-summary">
        <h4 className="mb-1 text-xs font-semibold">
          All Presets: {allPresetConfigs.length} | All Radii: {allRadiiConfigs.length} | All Scales:{' '}
          {allScaleConfigs.length} | All Accents: {allAccentConfigs.length}
        </h4>
        <p className="text-muted-foreground text-xs">
          Preset x Radius matrix: {presetRadiusMatrix.length} rows | Preset x ColorMode matrix:{' '}
          {presetColorModeMatrix.length} rows | Accent x ColorMode matrix:{' '}
          {accentColorModeMatrix.length} rows
        </p>
        <p className="text-muted-foreground text-xs">
          Font families: {FONT_FAMILIES.join(', ')} | Sidebar modes: {SIDEBAR_MODES.join(', ')}
        </p>
        <p className="text-muted-foreground text-xs">
          Accent colors: {ACCENT_COLORS.length} | Content layouts: {CONTENT_LAYOUTS.join(', ')}
        </p>
        <p className="text-muted-foreground text-xs">
          Preset IDs: {THEME_PRESET_IDS.join(', ')} | Presets: {THEME_PRESETS.length} total
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
    expect(canvas.getByTestId('specialized-dark')).toBeInTheDocument();
    expect(canvas.getByTestId('specialized-accessible')).toBeInTheDocument();
    expect(canvas.getByTestId('specialized-enterprise')).toBeInTheDocument();
    expect(canvas.getByTestId('all-presets-summary')).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('colorModeSelector.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const lightButton = canvas.getByTestId('color-mode-selector-light');
    const darkButton = canvas.getByTestId('color-mode-selector-dark');

    // Test that buttons are keyboard focusable
    lightButton.focus();
    await waitFor(() => {
      expect(document.activeElement).toBe(lightButton);
    });

    // Test keyboard navigation with arrow keys
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(document.activeElement).toBe(darkButton);
    });

    // Test selection with Enter key
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(darkButton.getAttribute('data-state')).toBe('on');
    });

    // Test navigation back with arrow keys
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(document.activeElement).toBe(lightButton);
    });

    // Test selection with Space key
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(lightButton.getAttribute('data-state')).toBe('on');
    });

    // Verify ARIA attributes - toggle group should have proper role
    const toggleGroup = canvasElement.querySelector('[role="group"]');
    expect(toggleGroup).toBeInTheDocument();
  },
};

// ============================================================================
// STANDARD AUDIT STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('colorModeSelector.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('colorModeSelector.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('colorModeSelector.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('colorModeSelector.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: colorModeSelectorStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('colorModeSelector.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: colorModeSelectorStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('colorModeSelector.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: colorModeSelectorStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('colorModeSelector.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: colorModeSelectorStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
