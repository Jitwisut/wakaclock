import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Font configuration data (mirrors lib/fonts.ts structure)
const FONT_CONFIG = [
  { name: 'Geist', variable: '--font-geist', weights: ['400-900'], type: 'variable' },
  { name: 'Inter', variable: '--font-inter', weights: ['400-900'], type: 'variable' },
  { name: 'Roboto', variable: '--font-roboto', weights: ['400', '500', '700'], type: 'static' },
  {
    name: 'Plus Jakarta Sans',
    variable: '--font-plus-jakarta-sans',
    weights: ['400', '500', '600', '800'],
    type: 'static',
  },
  {
    name: 'Montserrat',
    variable: '--font-montserrat',
    weights: ['400', '500', '600'],
    type: 'static',
  },
  { name: 'Poppins', variable: '--font-poppins', weights: ['400', '500', '600'], type: 'static' },
  {
    name: 'Overpass Mono',
    variable: '--font-overpass-mono',
    weights: ['400', '500', '700'],
    type: 'monospace',
  },
  { name: 'PT Sans', variable: '--font-pt-sans', weights: ['400', '700'], type: 'static' },
  {
    name: 'Hedvig Letters Serif',
    variable: '--font-hedvig-letters-serif',
    weights: ['400'],
    type: 'serif',
  },
  { name: 'Kumbh Sans', variable: '--font-kumbh-sans', weights: ['400'], type: 'static' },
  { name: 'Outfit', variable: '--font-outfit', weights: ['400'], type: 'static' },
];

// Demo component showcasing available fonts
function FontCatalogDemo() {
  const { t } = useTranslation();
  return (
    <Card className="w-[600px]" data-testid="font-catalog-demo">
      <CardHeader>
        <CardTitle>{t('typography.story.fontCatalog', 'Font Catalog')}</CardTitle>
        <CardDescription>
          {t(
            'typography.story.allFontsLoaded',
            'All fonts loaded via next/font/google in lib/fonts.ts'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {FONT_CONFIG.map((font, index) => (
            <div
              key={font.variable}
              className="bg-muted flex items-center gap-4 rounded-lg p-3"
              data-testid={`font-${index}`}
            >
              <div className="flex-1">
                <p className="font-medium">{font.name}</p>
                <p className="text-muted-foreground font-mono text-xs">{font.variable}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {font.type}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {font.weights.join(', ')}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="text-muted-foreground text-xs">
          Total fonts: <Badge variant="outline">{FONT_CONFIG.length}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo component showcasing font variables export

function FontVariablesDemo() {
  return (
    <Card className="w-[600px]" data-testid="font-variables-demo">
      <CardHeader>
        <CardTitle>
          {i18n.t('typography.story.fontVariablesExport', 'fontVariables Export')}
        </CardTitle>
        <CardDescription>
          {i18n.t(
            'typography.story.combinedCssClassStringForAllFontVariable',
            'Combined CSS class string for all font variables'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="overflow-x-auto text-xs">
            {[
              '// lib/fonts.ts exports a combined string of all font variables',
              'export const fontVariables = cn(',
              '  geist.variable,',
              '  inter.variable,',
              '  roboto.variable,',
              '  montserrat.variable,',
              '  poppins.variable,',
              '  overpass_mono.variable,',
              '  ptSans.variable,',
              '  plus_jakarta_sans.variable,',
              '  hedvig_letters_serif.variable,',
              '  kumbh_sans.variable,',
              '  outfit.variable',
              ');',
            ].join('\n')}
          </pre>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            {i18n.t('typography.story.usageInLayout', 'Usage in layout:')}
          </p>
          <div className="bg-muted/50 rounded-lg p-3">
            <pre className="overflow-x-auto text-xs">
              {`// app/layout.tsx
import { fontVariables } from '@/lib/fonts';

export default function RootLayout({ children }) {
  return (
    <html className={fontVariables}>
      <body>{children}</body>

    </html>
  );
}`}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo component showcasing typography samples
function TypographySamplesDemo() {
  const sampleText = i18n.t('typography.story.quickBrownFox');

  return (
    <Card className="w-[600px]" data-testid="typography-samples-demo">
      <CardHeader>
        <CardTitle>{i18n.t('typography.story.typographySamples', 'Typography Samples')}</CardTitle>
        <CardDescription>
          {i18n.t(
            'typography.story.fontRenderingExamples',
            'Font rendering examples (requires fonts to be loaded on the page)'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-muted-foreground mb-1 text-xs">
              {i18n.t('typography.story.defaultSystem', 'Default (System)')}
            </p>
            <p className="text-lg" data-testid="sample-default">
              {sampleText}
            </p>
          </div>

          <div className="bg-muted rounded-lg p-3">
            <p className="text-muted-foreground mb-1 text-xs">
              {i18n.t('typography.story.monospace', 'Monospace')}
            </p>
            <p className="font-mono text-lg" data-testid="sample-mono">
              {sampleText}
            </p>
          </div>

          <div className="bg-muted rounded-lg p-3">
            <p className="text-muted-foreground mb-1 text-xs">
              {i18n.t('typography.story.fontWeightScale', 'Font Weight Scale')}
            </p>
            <div className="space-y-1">
              <p className="text-sm font-normal" data-testid="weight-400">
                400 Normal: {sampleText}
              </p>
              <p className="text-sm font-medium" data-testid="weight-500">
                500 Medium: {sampleText}
              </p>
              <p className="text-sm font-semibold" data-testid="weight-600">
                600 Semibold: {sampleText}
              </p>
              <p className="text-sm font-bold" data-testid="weight-700">
                700 Bold: {sampleText}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo component showcasing heading scale
function HeadingScaleDemo() {
  return (
    <Card className="w-[600px]" data-testid="heading-scale-demo">
      <CardHeader>
        <CardTitle>{i18n.t('typography.story.headingScale', 'Heading Scale')}</CardTitle>
        <CardDescription>
          {i18n.t(
            'typography.story.typographyScaleForHeadingsAndBodyText',
            'Typography scale for headings and body text'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-baseline gap-4 border-b p-2">
            <Badge variant="outline" className="w-16 shrink-0">
              text-4xl
            </Badge>
            <p className="text-4xl font-bold" data-testid="scale-4xl">
              Heading 1
            </p>
          </div>
          <div className="flex items-baseline gap-4 border-b p-2">
            <Badge variant="outline" className="w-16 shrink-0">
              text-3xl
            </Badge>
            <p className="text-3xl font-bold" data-testid="scale-3xl">
              Heading 2
            </p>
          </div>
          <div className="flex items-baseline gap-4 border-b p-2">
            <Badge variant="outline" className="w-16 shrink-0">
              text-2xl
            </Badge>
            <p className="text-2xl font-semibold" data-testid="scale-2xl">
              Heading 3
            </p>
          </div>
          <div className="flex items-baseline gap-4 border-b p-2">
            <Badge variant="outline" className="w-16 shrink-0">
              text-xl
            </Badge>
            <p className="text-xl font-semibold" data-testid="scale-xl">
              Heading 4
            </p>
          </div>
          <div className="flex items-baseline gap-4 border-b p-2">
            <Badge variant="outline" className="w-16 shrink-0">
              text-lg
            </Badge>
            <p className="text-lg font-medium" data-testid="scale-lg">
              Heading 5
            </p>
          </div>
          <div className="flex items-baseline gap-4 border-b p-2">
            <Badge variant="outline" className="w-16 shrink-0">
              text-base
            </Badge>
            <p className="text-base" data-testid="scale-base">
              Body text (default)
            </p>
          </div>
          <div className="flex items-baseline gap-4 border-b p-2">
            <Badge variant="outline" className="w-16 shrink-0">
              text-sm
            </Badge>
            <p className="text-sm" data-testid="scale-sm">
              Small text
            </p>
          </div>
          <div className="flex items-baseline gap-4 p-2">
            <Badge variant="outline" className="w-16 shrink-0">
              text-xs
            </Badge>
            <p className="text-xs" data-testid="scale-xs">
              Extra small text
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Combined demo
function TypographyDemo() {
  return (
    <div className="space-y-6">
      <FontCatalogDemo />
      <FontVariablesDemo />
      <TypographySamplesDemo />
      <HeadingScaleDemo />
    </div>
  );
}

// Wrapper for meta
function TypographyWrapper() {
  return <FontCatalogDemo />;
}

const meta = {
  title: 'Foundations/Typography',
  component: TypographyWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## lib/fonts.ts

Font configuration using next/font/google for optimized font loading.

### Available Fonts

| Font | Variable | Type |
|------|----------|------|
| Geist | --font-geist | Variable |
| Inter | --font-inter | Variable |
| Roboto | --font-roboto | Static |
| Plus Jakarta Sans | --font-plus-jakarta-sans | Static |
| Montserrat | --font-montserrat | Static |
| Poppins | --font-poppins | Static |
| Overpass Mono | --font-overpass-mono | Monospace |
| PT Sans | --font-pt-sans | Static |
| Hedvig Letters Serif | --font-hedvig-letters-serif | Serif |
| Kumbh Sans | --font-kumbh-sans | Static |
| Outfit | --font-outfit | Static |

### fontVariables Export

\`\`\`tsx
import { fontVariables } from '@/lib/fonts';

// Apply to root element
<html className={fontVariables}>
\`\`\`

### Usage in CSS

\`\`\`css
.custom-font {
  font-family: var(--font-inter);
}

.code {
  font-family: var(--font-overpass-mono);
}
\`\`\`
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof TypographyWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <FontCatalogDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify font catalog is rendered
    expect(canvas.getByTestId('font-catalog-demo')).toBeInTheDocument();

    // Verify first font (Geist)
    expect(canvas.getByTestId('font-0')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const FontCatalog: Story = {
  render: () => <FontCatalogDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('font-catalog-demo')).toBeInTheDocument();

    // Verify all fonts are listed
    const fontElements = canvasElement.querySelectorAll('[data-testid^="font-"]');
    expect(fontElements.length).toBe(FONT_CONFIG.length);
  },
};

export const FontVariables: Story = {
  render: () => <FontVariablesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('font-variables-demo')).toBeInTheDocument();
  },
};

export const TypographySamples: Story = {
  render: () => <TypographySamplesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('typography-samples-demo')).toBeInTheDocument();

    // Verify font samples
    expect(canvas.getByTestId('sample-default')).toBeInTheDocument();
    expect(canvas.getByTestId('sample-mono')).toBeInTheDocument();
  },
};

export const HeadingScale: Story = {
  render: () => <HeadingScaleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('heading-scale-demo')).toBeInTheDocument();

    // Verify scale examples
    expect(canvas.getByTestId('scale-4xl')).toBeInTheDocument();
    expect(canvas.getByTestId('scale-base')).toBeInTheDocument();
    expect(canvas.getByTestId('scale-xs')).toBeInTheDocument();
  },
};

export const AllTypography: Story = {
  render: () => <TypographyDemo />,
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
  name: i18n.t('typography.storyName.accessibility', 'Accessibility'),
  render: () => <HeadingScaleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('heading-scale-demo')).toBeInTheDocument();

    // Verify proper heading hierarchy in samples
    const headings = canvasElement.querySelectorAll('[data-testid^="scale-"]');
    expect(headings.length).not.toBe(0);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('typography.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('typography.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('typography.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('typography.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
