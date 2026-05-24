import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import {
  contentLayoutSelectorHandlers,
  contentLayoutSelectorStatusHandlers,
} from '@/.storybook/stories/_handlers/content-layout-selector.handlers';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  ACCENT_COLORS,
  COLOR_MODES,
  CONTENT_LAYOUTS,
  type ContentLayout,
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

import { ContentLayoutSelector } from '@/components/theme-customizer/content-layout-selector';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircleIcon, RefreshCwIcon } from 'lucide-react';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

// ============ UTILITY FUNCTIONS ============

function isVisible(element: HTMLElement) {
  return element.getClientRects().length > 0;
}

// ============ FRAME COMPONENTS ============

type ContentLayoutSelectorFrameProps = {
  onValueChange?: (value: ContentLayout) => void;
  withLabels?: boolean;
};

function ContentLayoutSelectorFrame({
  withLabels = true,
  onValueChange,
}: ContentLayoutSelectorFrameProps) {
  return (
    <div className="p-6">
      <ContentLayoutSelector
        {...(onValueChange && { onValueChange })}
        labels={
          withLabels
            ? {
                label: i18n.t('contentLayoutSelector.label'),
                full: i18n.t('contentLayoutSelector.full'),
                centered: i18n.t('contentLayoutSelector.centered'),
              }
            : undefined
        }
      />
    </div>
  );
}

// ============ ASYNC THEME LOADING COMPONENT ============

interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

function ContentLayoutErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert
      variant="destructive"
      data-error-status={error.status}
      data-testid="content-layout-error"
    >
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

function ContentLayoutLoadingSkeleton() {
  return (
    <div className="space-y-2 p-6" data-state="loading" data-testid="content-layout-loading">
      <Skeleton className="h-4 w-24" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );
}

function AsyncContentLayoutSelectorFrame() {
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
    return <ContentLayoutLoadingSkeleton />;
  }

  if (error) {
    return <ContentLayoutErrorDisplay error={error} onRetry={fetchTheme} />;
  }

  return (
    <div
      className="p-6"
      data-state="success"
      data-testid="content-layout-success"
      data-content-layout={themeConfig?.contentLayout}
    >
      <ContentLayoutSelector
        labels={{
          label: t('contentLayoutSelector.label'),
          full: t('contentLayoutSelector.full'),
          centered: t('contentLayoutSelector.centered'),
        }}
      />
    </div>
  );
}

// ============ FAKER DATA COMPONENT ============

function ContentLayoutSelectorWithFakerData() {
  const { t } = useTranslation();
  const themeConfig = React.useMemo(() => createFakeThemeConfig(), []);

  return (
    <div
      className="space-y-4 p-6"
      data-testid="content-layout-faker"
      data-content-layout={themeConfig.contentLayout}
    >
      <div className="rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-medium">
          {t('contentLayoutSelector.story.generatedThemeConfig', 'Generated Theme Config:')}
        </h3>
        <p className="text-muted-foreground text-xs">
          Content Layout: <span className="font-mono">{themeConfig.contentLayout}</span>
        </p>
      </div>
      <ContentLayoutSelector
        labels={{
          label: t('contentLayoutSelector.label'),
          full: t('contentLayoutSelector.full'),
          centered: t('contentLayoutSelector.centered'),
        }}
      />
    </div>
  );
}

// ============ I18N COMPONENT ============

function I18nContentLayoutSelectorDemo() {
  const { t } = useTranslation();

  return (
    <div className="p-6">
      <ContentLayoutSelector
        labels={{
          label: t('contentLayoutSelector.label'),
          full: t('contentLayoutSelector.full'),
          centered: t('contentLayoutSelector.centered'),
        }}
      />
    </div>
  );
}

// ============ META ============

const meta = {
  title: 'Components/Theme Customizer/Content Layout Selector',
  component: ContentLayoutSelectorFrame,
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
        'contentLayoutSelector.argType.whetherToUseLocalizedLabelsOrFallbackDefaults',
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
        'contentLayoutSelector.argType.calledWhenContentLayoutSelectionChanges',
        'Called when content layout selection changes'
      ),
      table: { category: 'Events' },
    },
    // ContentLayoutSelector Props Reference:
    // Optional Props:
    // - labels: ContentLayoutSelectorLabels object
    //   - label: Section heading text (e.g., "Content Layout")
    //   - full: Full width option label
    //   - centered: Centered option label
    //
    // Layout Options:
    // - full: Content spans full width
    // - centered: Content has max-width constraint
    //
    // Responsive Behavior:
    // - Hidden on mobile viewports (sm and below)
    // - Only visible on desktop where layout matters
    //
    // State Persistence:
    // - Saves preference to body data attribute
    // - data-theme-content-layout="full|centered"
    //
    // Data Attributes:
    // - data-testid="content-layout-selector-label": Section label
    // - data-testid="content-layout-selector-full": Full width button
    // - data-testid="content-layout-selector-centered": Centered button
  },
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: contentLayoutSelectorHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ContentLayoutSelectorFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============ BASIC STORIES ============

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(
      canvasElement.querySelector('[data-slot="content-layout-selector"]')
    ).toBeInTheDocument();

    const canvas = within(canvasElement);

    const label = canvas.getByTestId('content-layout-selector-label');
    expect(label.textContent).not.toBe('');

    const centeredButton = canvas.queryByTestId('content-layout-selector-centered');
    const fullButton = canvas.queryByTestId('content-layout-selector-full');

    if (!centeredButton || !fullButton) {
      throw new Error('Toggle buttons not found (component may be hidden at this viewport).');
    }

    if (!isVisible(centeredButton) || !isVisible(fullButton)) {
      throw new Error('Toggle buttons are not visible (component may be hidden at this viewport).');
    }

    await userEvent.click(centeredButton);

    await waitFor(() => {
      expect(centeredButton.getAttribute('data-state')).toBe('on');
    });

    await userEvent.click(fullButton);

    await waitFor(() => {
      expect(fullButton.getAttribute('data-state')).toBe('on');
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
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    const fullButton = canvas.queryByTestId('content-layout-selector-full');
    const centeredButton = canvas.queryByTestId('content-layout-selector-centered');

    if (fullButton && isVisible(fullButton)) {
      throw new Error('Full button should not be visible at the mobile viewport.');
    }

    if (centeredButton && isVisible(centeredButton)) {
      throw new Error('Centered button should not be visible at the mobile viewport.');
    }
  },
};

// ============ VARIANT STORIES ============

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('contentLayoutSelector.story.withLabels', 'With Labels')}
        </p>
        <ContentLayoutSelectorFrame withLabels />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('contentLayoutSelector.story.withoutLabelsFallback', 'Without Labels (Fallback)')}
        </p>
        <ContentLayoutSelectorFrame withLabels={false} />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('contentLayoutSelector.story.fullWidthSelected', 'Full Width Selected')}
        </p>
        <div data-theme-content-layout="full">
          <ContentLayoutSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('contentLayoutSelector.story.centeredSelected', 'Centered Selected')}
        </p>
        <div data-theme-content-layout="centered">
          <ContentLayoutSelectorFrame withLabels />
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
    <div className="flex flex-col gap-6 p-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Narrow Container (250px)</p>
        <div className="border-muted w-[250px] border border-dashed p-2">
          <ContentLayoutSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Medium Container (350px)</p>
        <div className="border-muted w-[350px] border border-dashed p-2">
          <ContentLayoutSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Wide Container (500px)</p>
        <div className="border-muted w-[500px] border border-dashed p-2">
          <ContentLayoutSelectorFrame withLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('contentLayoutSelector.story.fullWidth', 'Full Width')}
        </p>
        <div className="border-muted w-full border border-dashed p-2">
          <ContentLayoutSelectorFrame withLabels />
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
  name: i18n.t('contentLayoutSelector.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: () => <I18nContentLayoutSelectorDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');
    await Default.play?.(context);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('contentLayoutSelector.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('contentLayoutSelector.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('contentLayoutSelector.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const FallbackLabels: Story = {
  ...Default,
  name: i18n.t('contentLayoutSelector.storyName.fallbackLabels', 'Fallback labels (defaults)'),
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
  render: () => <ContentLayoutSelectorWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="content-layout-faker"]')).toBeInTheDocument();
    const layout = canvasElement
      .querySelector('[data-content-layout]')
      ?.getAttribute('data-content-layout');
    expect(['full', 'centered']).toContain(layout);
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: contentLayoutSelectorHandlers },
  },
  render: () => <AsyncContentLayoutSelectorFrame />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(
      canvasElement.querySelector('[data-testid="content-layout-loading"]')
    ).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="content-layout-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: contentLayoutSelectorStatusHandlers.loading },
  },
  render: () => <AsyncContentLayoutSelectorFrame />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(
      canvasElement.querySelector('[data-testid="content-layout-loading"]')
    ).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('contentLayoutSelector.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: contentLayoutSelectorStatusHandlers.slowResponse },
  },
  render: () => <AsyncContentLayoutSelectorFrame />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(
      canvasElement.querySelector('[data-testid="content-layout-loading"]')
    ).toBeInTheDocument();
    // Wait for data (slow response takes 5s)
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="content-layout-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('contentLayoutSelector.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: contentLayoutSelectorStatusHandlers.badRequest },
  },
  render: () => <AsyncContentLayoutSelectorFrame />,
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
  name: i18n.t('contentLayoutSelector.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: contentLayoutSelectorStatusHandlers.unauthorized },
  },
  render: () => <AsyncContentLayoutSelectorFrame />,
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
  name: i18n.t('contentLayoutSelector.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: contentLayoutSelectorStatusHandlers.forbidden },
  },
  render: () => <AsyncContentLayoutSelectorFrame />,
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
  name: i18n.t(
    'contentLayoutSelector.storyName.error422UnprocessableEntity',
    'Error 422: Validation'
  ),
  parameters: {
    msw: { handlers: contentLayoutSelectorStatusHandlers.unprocessableEntity },
  },
  render: () => <AsyncContentLayoutSelectorFrame />,
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
  name: i18n.t('contentLayoutSelector.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: contentLayoutSelectorStatusHandlers.tooManyRequests },
  },
  render: () => <AsyncContentLayoutSelectorFrame />,
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
    'contentLayoutSelector.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  parameters: {
    msw: { handlers: contentLayoutSelectorStatusHandlers.internalServerError },
  },
  render: () => <AsyncContentLayoutSelectorFrame />,
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
  name: i18n.t('contentLayoutSelector.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: contentLayoutSelectorStatusHandlers.badGateway },
  },
  render: () => <AsyncContentLayoutSelectorFrame />,
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
    'contentLayoutSelector.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  parameters: {
    msw: { handlers: contentLayoutSelectorStatusHandlers.serviceUnavailable },
  },
  render: () => <AsyncContentLayoutSelectorFrame />,
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
  name: i18n.t(
    'contentLayoutSelector.storyName.error504GatewayTimeout',
    'Error 504: Gateway Timeout'
  ),
  parameters: {
    msw: { handlers: contentLayoutSelectorStatusHandlers.gatewayTimeout },
  },
  render: () => <AsyncContentLayoutSelectorFrame />,
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
  name: i18n.t('contentLayoutSelector.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: contentLayoutSelectorStatusHandlers.networkError },
  },
  render: () => <AsyncContentLayoutSelectorFrame />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="content-layout-error"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: contentLayoutSelectorHandlers },
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
    'contentLayoutSelector.storyName.pseudoStates',
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

function AllContentLayoutsDemo() {
  const { t } = useTranslation();
  const configs = React.useMemo(
    () => CONTENT_LAYOUTS.map((layout) => createFakeThemeConfig({ contentLayout: layout })),
    []
  );

  return (
    <div className="space-y-4 p-6" data-testid="all-content-layouts-demo">
      <h3 className="text-sm font-medium">All Content Layouts ({CONTENT_LAYOUTS.length})</h3>
      {configs.map((config) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-content-layout={config.contentLayout}
          data-testid={`layout-card-${config.contentLayout}`}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            Layout: <span className="font-mono font-semibold">{config.contentLayout}</span> |
            Preset: {config.preset} | Mode: {config.colorMode}
          </p>
          <ContentLayoutSelector
            labels={{
              label: t('contentLayoutSelector.label'),
              full: t('contentLayoutSelector.full'),
              centered: t('contentLayoutSelector.centered'),
            }}
          />
        </div>
      ))}
    </div>
  );
}

export const AllContentLayouts: Story = {
  render: () => <AllContentLayoutsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('all-content-layouts-demo')).toBeInTheDocument();
    for (const layout of CONTENT_LAYOUTS) {
      expect(canvas.getByTestId(`layout-card-${layout}`)).toBeInTheDocument();
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
          data-content-layout={config.contentLayout}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            #{index + 1} | Layout: {config.contentLayout} | Mode: {config.colorMode} | Scale:{' '}
            {config.scale}
          </p>
          <ContentLayoutSelector
            labels={{
              label: i18n.t('contentLayoutSelector.label'),
              full: i18n.t('contentLayoutSelector.full'),
              centered: i18n.t('contentLayoutSelector.centered'),
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
    <div className="space-y-6 p-6" data-testid="theme-showcase-demo">
      <div>
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('contentLayoutSelector.story.showcaseCompactConfig', 'Showcase - Compact Config')}
        </h3>
        <div
          className="rounded-lg border p-3"
          data-content-layout={showcase.compact.contentLayout}
          data-testid="showcase-compact"
        >
          <p className="text-muted-foreground text-xs">
            Layout: {showcase.compact.contentLayout} | Scale: {showcase.compact.scale}
          </p>
          <ContentLayoutSelector
            labels={{
              label: i18n.t('contentLayoutSelector.label'),
              full: i18n.t('contentLayoutSelector.full'),
              centered: i18n.t('contentLayoutSelector.centered'),
            }}
          />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t(
            'contentLayoutSelector.story.showcaseSpaciousConfig',
            'Showcase - Spacious Config'
          )}
        </h3>
        <div
          className="rounded-lg border p-3"
          data-content-layout={showcase.spacious.contentLayout}
          data-testid="showcase-spacious"
        >
          <p className="text-muted-foreground text-xs">
            Layout: {showcase.spacious.contentLayout} | Scale: {showcase.spacious.scale}
          </p>
          <ContentLayoutSelector
            labels={{
              label: i18n.t('contentLayoutSelector.label'),
              full: i18n.t('contentLayoutSelector.full'),
              centered: i18n.t('contentLayoutSelector.centered'),
            }}
          />
        </div>
      </div>
      <div className="rounded-lg border p-3" data-testid="showcase-meta">
        <h3 className="mb-2 text-sm font-medium">
          {i18n.t('contentLayoutSelector.story.associatedFactoryData', 'Associated Factory Data')}
        </h3>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>
            Preference: light={preference.preferredLightPreset}, dark=
            {preference.preferredDarkPreset}
          </li>
          <li>
            Customization: {customization.name} (spacing: {customization.spacing})
          </li>
          <li>
            Export: {themeExport.name} ({themeExport.exportFormat})
          </li>
          <li>
            History: {history.action} - layout={history.configSnapshot.contentLayout}
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
  const presetInfo = React.useMemo(() => createFakeThemePresetInfo({ id: 'ocean' }), []);
  const customizations = React.useMemo(() => createFakeThemeCustomizations(3), []);
  const exports = React.useMemo(() => createFakeThemeExports(2), []);
  const histories = React.useMemo(() => createFakeThemeHistories(3), []);
  const preferences = React.useMemo(() => createFakeThemePreferences(2), []);

  return (
    <div className="space-y-6 p-6" data-testid="bulk-configs-demo">
      <div>
        <h3 className="mb-2 text-sm font-medium">Bulk Configs ({configs.length})</h3>
        {configs.map((config) => (
          <div key={config.id} className="border-b py-1" data-content-layout={config.contentLayout}>
            <p className="text-muted-foreground text-xs">
              {config.preset} / {config.contentLayout} / {config.colorMode}
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
      <div data-testid="preset-info-ocean">
        <h3 className="mb-2 text-sm font-medium">Preset Info: {presetInfo.name}</h3>
        <p className="text-muted-foreground text-xs">
          Primary: {presetInfo.colors.primary} | Accent: {presetInfo.colors.accent}
        </p>
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
    expect(canvas.getByTestId('preset-info-ocean')).toBeInTheDocument();
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
        {i18n.t('contentLayoutSelector.story.specializedThemeConfigs', 'Specialized Theme Configs')}
      </h3>
      {namedConfigs.map(({ config, label }) => (
        <div
          key={config.id}
          className="rounded-lg border p-3"
          data-testid={`specialized-${label.toLowerCase()}`}
          data-content-layout={config.contentLayout}
        >
          <p className="text-muted-foreground mb-1 text-xs">
            <span className="font-semibold">{label}:</span> layout={config.contentLayout}, mode=
            {config.colorMode}, scale={config.scale}
          </p>
        </div>
      ))}
      <div className="rounded-lg border p-3" data-testid="all-variants-summary">
        <h4 className="mb-1 text-xs font-semibold">
          All Presets: {allPresetConfigs.length} | All Radii: {allRadiiConfigs.length} | All Scales:{' '}
          {allScaleConfigs.length} | All Accents: {allAccentConfigs.length} | All Color Modes:{' '}
          {allColorModeConfigs.length}
        </h4>
        <p className="text-muted-foreground text-xs">
          Preset x Radius: {presetRadiusMatrix.length} rows | Preset x ColorMode:{' '}
          {presetColorModeMatrix.length} rows | ColorMode x Scale: {colorModeScaleMatrix.length}{' '}
          rows | Accent x ColorMode: {accentColorModeMatrix.length} rows
        </p>
        <p className="text-muted-foreground text-xs">
          Font families: {FONT_FAMILIES.join(', ')} | Sidebar modes: {SIDEBAR_MODES.join(', ')}
        </p>
        <p className="text-muted-foreground text-xs">
          Accent colors: {ACCENT_COLORS.length} | Color modes: {COLOR_MODES.join(', ')}
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
    expect(canvas.getByTestId('specialized-compact')).toBeInTheDocument();
    expect(canvas.getByTestId('specialized-enterprise')).toBeInTheDocument();
    expect(canvas.getByTestId('all-variants-summary')).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('contentLayoutSelector.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fullButton = canvas.queryByTestId('content-layout-selector-full');
    const centeredButton = canvas.queryByTestId('content-layout-selector-centered');

    if (!fullButton || !centeredButton || !isVisible(fullButton)) {
      // Component may be hidden at mobile viewport
      return;
    }

    // Test that buttons are keyboard focusable
    fullButton.focus();
    await waitFor(() => {
      expect(document.activeElement).toBe(fullButton);
    });

    // Test keyboard navigation with arrow keys
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(document.activeElement).toBe(centeredButton);
    });

    // Test selection with Enter key
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(centeredButton.getAttribute('data-state')).toBe('on');
    });

    // Test navigation back with arrow keys
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(document.activeElement).toBe(fullButton);
    });

    // Test selection with Space key
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(fullButton.getAttribute('data-state')).toBe('on');
    });

    // Verify ARIA attributes - toggle group should have proper role
    const toggleGroup = canvasElement.querySelector('[role="group"]');
    expect(toggleGroup).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('contentLayoutSelector.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: contentLayoutSelectorStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('contentLayoutSelector.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: contentLayoutSelectorStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('contentLayoutSelector.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: contentLayoutSelectorStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('contentLayoutSelector.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: contentLayoutSelectorStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
