import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  DEFAULT_THEME,
  type ThemeContentLayout,
  type ThemeRadius,
  THEMES,
  type ThemeScale,
} from '@/lib/themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Demo component showcasing DEFAULT_THEME
function DefaultThemeDemo() {
  const { t } = useTranslation();
  return (
    <Card className="w-[500px]" data-testid="default-theme-demo">
      <CardHeader>
        <CardTitle>DEFAULT_THEME</CardTitle>
        <CardDescription>
          {t(
            'libThemes.story.theDefaultThemeConfigurationUsedWhenNoTh',
            'The default theme configuration used when no theme is set'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted flex items-center justify-between rounded-lg p-3">
            <span className="text-sm font-medium">preset</span>
            <Badge variant="secondary" data-testid="default-preset">
              {DEFAULT_THEME.preset}
            </Badge>
          </div>
          <div className="bg-muted flex items-center justify-between rounded-lg p-3">
            <span className="text-sm font-medium">radius</span>
            <Badge variant="secondary" data-testid="default-radius">
              {DEFAULT_THEME.radius}
            </Badge>
          </div>
          <div className="bg-muted flex items-center justify-between rounded-lg p-3">
            <span className="text-sm font-medium">scale</span>
            <Badge variant="secondary" data-testid="default-scale">
              {DEFAULT_THEME.scale}
            </Badge>
          </div>
          <div className="bg-muted flex items-center justify-between rounded-lg p-3">
            <span className="text-sm font-medium">contentLayout</span>
            <Badge variant="secondary" data-testid="default-layout">
              {DEFAULT_THEME.contentLayout}
            </Badge>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="overflow-x-auto text-xs" data-testid="default-theme-json">
            {JSON.stringify(DEFAULT_THEME, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo component showcasing THEMES array
function ThemesArrayDemo() {
  return (
    <Card className="w-[600px]" data-testid="themes-array-demo">
      <CardHeader>
        <CardTitle>{i18n.t('libThemes.story.themesArray', 'THEMES Array')}</CardTitle>
        <CardDescription>
          {i18n.t(
            'libThemes.story.availableThemePresetsWithTheirColorDefin',
            'Available theme presets with their color definitions'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {THEMES.map((theme, index) => (
            <div
              key={theme.value}
              className="bg-muted flex items-center gap-4 rounded-lg p-3"
              data-testid={`theme-${index}`}
            >
              <div
                className="border-background h-10 w-10 rounded-full border-2 shadow-sm"
                style={{ backgroundColor: theme.colors[0] }}
                aria-label={`${theme.name} color swatch`}
              />
              <div className="flex-1">
                <p className="font-medium">{theme.name}</p>
                <p className="text-muted-foreground font-mono text-xs">value: "{theme.value}"</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground font-mono text-xs">{theme.colors[0]}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-muted-foreground text-xs">
          Total themes: <Badge variant="outline">{THEMES.length}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo component showcasing ThemeType structure
function ThemeTypeDemo() {
  const radiusOptions: ThemeRadius[] = ['none', 'sm', 'md', 'default', 'lg', 'xl'];
  const scaleOptions: ThemeScale[] = ['none', 'sm', 'lg'];
  const layoutOptions: ThemeContentLayout[] = ['full', 'centered'];

  return (
    <Card className="w-[500px]" data-testid="theme-type-demo">
      <CardHeader>
        <CardTitle>{i18n.t('libThemes.story.themetypeStructure', 'ThemeType Structure')}</CardTitle>
        <CardDescription>
          {i18n.t(
            'libThemes.story.typescriptTypeDefinitionForThemeConfigur',
            'TypeScript type definition for theme configuration'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <p className="mb-2 text-sm font-medium">
              {i18n.t('libThemes.story.themeradiusOptions', 'ThemeRadius options:')}
            </p>
            <div className="flex flex-wrap gap-2">
              {radiusOptions.map((radius) => (
                <Badge key={radius} variant="outline" data-testid={`radius-${radius}`}>
                  {radius}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              {i18n.t('libThemes.story.themescaleOptions', 'ThemeScale options:')}
            </p>
            <div className="flex flex-wrap gap-2">
              {scaleOptions.map((scale) => (
                <Badge key={scale} variant="outline" data-testid={`scale-${scale}`}>
                  {scale}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              {i18n.t('libThemes.story.themecontentlayoutOptions', 'ThemeContentLayout options:')}
            </p>
            <div className="flex flex-wrap gap-2">
              {layoutOptions.map((layout) => (
                <Badge key={layout} variant="outline" data-testid={`layout-${layout}`}>
                  {layout}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="overflow-x-auto text-xs">
            {`type ThemeType = {
  preset: ThemePreset;      // string (theme name)
  radius: ThemeRadius;      // 'none' | 'sm' | 'md' | 'default' | 'lg' | 'xl'
  scale: ThemeScale;        // 'none' | 'sm' | 'lg'
  contentLayout: ThemeContentLayout; // 'full' | 'centered'
};`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Combined demo
function ThemesDemo() {
  return (
    <div className="space-y-6">
      <DefaultThemeDemo />
      <ThemesArrayDemo />
      <ThemeTypeDemo />
    </div>
  );
}

// Wrapper for meta
function LibThemesWrapper() {
  return <DefaultThemeDemo />;
}

const meta = {
  title: 'Foundations/Lib Themes',
  component: LibThemesWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## lib/themes.ts

Theme configuration constants and types for the design system.

### DEFAULT_THEME

The default theme configuration object:

\`\`\`tsx
const DEFAULT_THEME = {
  preset: 'default',
  radius: 'default',
  scale: 'none',
  contentLayout: 'full',
} as const;
\`\`\`

### THEMES Array

Available theme presets with color definitions:

\`\`\`tsx
THEMES.map(theme => ({
  name: theme.name,     // Display name
  value: theme.value,   // Preset ID
  colors: theme.colors, // OKLCH color values
}));
\`\`\`

### ThemeType

TypeScript type for theme configuration:

\`\`\`tsx
type ThemeType = {
  preset: ThemePreset;
  radius: ThemeRadius;
  scale: ThemeScale;
  contentLayout: ThemeContentLayout;
};
\`\`\`
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof LibThemesWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <DefaultThemeDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify default theme demo is rendered
    expect(canvas.getByTestId('default-theme-demo')).toBeInTheDocument();

    // Verify default values
    expect(canvas.getByTestId('default-preset')).toHaveTextContent('default');
    expect(canvas.getByTestId('default-radius')).toHaveTextContent('default');
    expect(canvas.getByTestId('default-scale')).toHaveTextContent('none');
    expect(canvas.getByTestId('default-layout')).toHaveTextContent('full');
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DefaultTheme: Story = {
  render: () => <DefaultThemeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('default-theme-demo')).toBeInTheDocument();

    // Verify JSON representation
    const jsonElement = canvas.getByTestId('default-theme-json');
    expect(jsonElement.textContent).toContain('"preset": "default"');
  },
};

export const ThemesArray: Story = {
  render: () => <ThemesArrayDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('themes-array-demo')).toBeInTheDocument();

    // Verify first theme (Default)
    expect(canvas.getByTestId('theme-0')).toBeInTheDocument();

    // Verify theme count matches THEMES.length
    const themeElements = canvasElement.querySelectorAll('[data-testid^="theme-"]');
    expect(themeElements.length).toBe(THEMES.length);
  },
};

export const ThemeTypeStructure: Story = {
  render: () => <ThemeTypeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('theme-type-demo')).toBeInTheDocument();

    // Verify radius options
    expect(canvas.getByTestId('radius-none')).toBeInTheDocument();
    expect(canvas.getByTestId('radius-lg')).toBeInTheDocument();

    // Verify scale options
    expect(canvas.getByTestId('scale-none')).toBeInTheDocument();

    // Verify layout options
    expect(canvas.getByTestId('layout-full')).toBeInTheDocument();
    expect(canvas.getByTestId('layout-centered')).toBeInTheDocument();
  },
};

export const AllThemeExports: Story = {
  render: () => <ThemesDemo />,
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
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('libThemes.storyName.accessibility', 'Accessibility'),
  render: () => <ThemesArrayDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('themes-array-demo')).toBeInTheDocument();

    // Verify color swatches have aria-labels
    const swatches = canvasElement.querySelectorAll('[aria-label*="color swatch"]');
    expect(swatches.length).toBe(THEMES.length);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('libThemes.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('libThemes.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('libThemes.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('libThemes.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
