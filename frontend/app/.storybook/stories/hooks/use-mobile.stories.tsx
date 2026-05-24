import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Demo component showing responsive hooks
function ResponsiveHooksDemo() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  return (
    <div className="space-y-6">
      <Card className="w-[400px]" data-testid="responsive-hooks-demo">
        <CardHeader>
          <CardTitle>{t('useMobile.story.responsiveHooksDemo', 'Responsive Hooks Demo')}</CardTitle>
          <CardDescription>
            {t(
              'useMobile.story.resizeViewportDesc',
              'Resize the viewport to see the hooks update in real-time'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">{t('useMobile.story.useIsMobile', 'useIsMobile()')}</span>
            <Badge data-testid="is-mobile" variant={isMobile ? 'default' : 'secondary'}>
              {isMobile ? 'true' : 'false'}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {t(
              'useMobile.story.returnsTrueWhenViewportLt768',
              'Returns true when viewport < 768px'
            )}
          </p>

          <div className="my-4 border-t" />

          <div className="flex items-center justify-between">
            <span className="font-medium">{t('useMobile.story.useIsTablet', 'useIsTablet()')}</span>
            <Badge data-testid="is-tablet" variant={isTablet ? 'default' : 'secondary'}>
              {isTablet ? 'true' : 'false'}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {t(
              'useMobile.story.returnsTrueWhenViewportLt1200',
              'Returns true when viewport < 1200px'
            )}
          </p>

          <div className="my-4 border-t" />

          <div className="bg-muted rounded-lg p-4">
            <p className="mb-2 text-sm font-medium">
              {t('useMobile.story.currentDeviceType', 'Current Device Type:')}
            </p>
            <p className="text-lg font-bold" data-testid="device-type">
              {(() => {
                if (isMobile) return t('useMobile.story.mobile', 'Mobile');
                if (isTablet) return t('useMobile.story.tablet', 'Tablet');
                return t('useMobile.story.desktop', 'Desktop');
              })()}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>
            {t('useMobile.story.breakpointsReference', 'Breakpoints Reference')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">{t('useMobile.story.hook', 'Hook')}</th>
                <th className="py-2 text-left">{t('useMobile.story.breakpoint', 'Breakpoint')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 font-mono">useIsMobile()</td>
                <td className="py-2">&lt; 768px</td>
              </tr>
              <tr>
                <td className="py-2 font-mono">useIsTablet()</td>
                <td className="py-2">&lt; 1200px</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// Wrapper for meta component
function HookWrapper() {
  return <ResponsiveHooksDemo />;
}

const meta = {
  title: 'Hooks/useIsMobile & useIsTablet',
  component: HookWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## useIsMobile & useIsTablet

Responsive design hooks for detecting viewport breakpoints.

### Usage

\`\`\`tsx
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';

function MyComponent() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  return (
    <div>
      {isMobile ? <MobileView /> : <DesktopView />}
    </div>
  );
}
\`\`\`

### Breakpoints

- **useIsMobile()**: Returns \`true\` when viewport width < 768px
- **useIsTablet()**: Returns \`true\` when viewport width < 1200px

### Features

- Uses \`window.matchMedia\` for efficient updates
- Automatically cleans up event listeners
- SSR-safe (returns \`undefined\` initially)
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof HookWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ResponsiveHooksDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify demo is rendered
    const demo = canvas.getByTestId('responsive-hooks-demo');
    expect(demo).toBeInTheDocument();

    // Verify badges are present
    expect(canvas.getByTestId('is-mobile')).toBeInTheDocument();
    expect(canvas.getByTestId('is-tablet')).toBeInTheDocument();
    expect(canvas.getByTestId('device-type')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MobileViewport: Story = {
  ...Default,
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const TabletViewport: Story = {
  ...Default,
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DesktopViewport: Story = {
  ...Default,
  parameters: {
    viewport: {
      defaultViewport: 'responsive',
    },
  },
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
    expect(canvas.getByTestId('responsive-hooks-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('is-mobile')).toBeInTheDocument();
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
    expect(canvas.getByTestId('responsive-hooks-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('is-tablet')).toBeInTheDocument();
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
    expect(canvas.getByTestId('responsive-hooks-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('device-type')).toBeInTheDocument();
  },
  tags: ['!test'],
};

// ============ COMBINED VARIANTS ============

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('useMobile.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('useMobile.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MobileStory: Story = {
  ...Default,
  name: i18n.t('useMobile.storyName.mobileStory', 'Mobile Viewport (Combined)'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('useMobile.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('useMobile.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify semantic structure
    const demo = canvas.getByTestId('responsive-hooks-demo');
    expect(demo).toBeInTheDocument();

    // Verify badges have text content
    const mobileBadge = canvas.getByTestId('is-mobile');
    expect(mobileBadge.textContent).toMatch(/true|false/);

    const tabletBadge = canvas.getByTestId('is-tablet');
    expect(tabletBadge.textContent).toMatch(/true|false/);
  },
};
