import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// PostHog functions
const posthogFunctions = [
  {
    name: 'initPostHog',
    description: i18n.t('libAnalytics.story.initPostHogDesc', 'Initialize PostHog client-side'),
    returns: 'void',
  },
  {
    name: 'captureEvent',
    description: i18n.t('libAnalytics.story.captureEventDesc', 'Capture a custom event'),
    returns: 'void',
  },
  {
    name: 'capturePageView',
    description: i18n.t('libAnalytics.story.capturePageViewDesc', 'Capture page view'),
    returns: 'void',
  },
  {
    name: 'identifyUser',
    description: i18n.t('libAnalytics.story.identifyUserDesc', 'Identify user with properties'),
    returns: 'void',
  },
  {
    name: 'resetUser',
    description: i18n.t('libAnalytics.story.resetUserDesc', 'Reset user identification (logout)'),
    returns: 'void',
  },
];

// Demo component showcasing PostHog
function PostHogDemo() {
  const { t } = useTranslation();
  return (
    <Card className="w-[600px]" data-testid="posthog-demo">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          lib/posthog.ts
          <Badge variant="secondary">{t('libAnalytics.story.analytics', 'Analytics')}</Badge>
        </CardTitle>
        <CardDescription>
          {t(
            'libAnalytics.story.posthogAnalyticsIntegration',
            'PostHog analytics integration for user tracking and product analytics'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t('libAnalytics.story.exportedFunctions', 'Exported Functions')}
          </p>
          {posthogFunctions.map((func) => (
            <div
              key={func.name}
              className="bg-muted flex items-center justify-between rounded-lg p-2"
              data-testid={`posthog-${func.name}`}
            >
              <div>
                <code className="font-mono text-xs">{func.name}()</code>
                <p className="text-muted-foreground text-xs">{func.description}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {func.returns}
              </Badge>
            </div>
          ))}
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="overflow-x-auto text-xs">
            {`import {
  initPostHog,
  captureEvent,
  capturePageView,
  identifyUser,
  resetUser
} from '@/lib/posthog';

// Initialize in app layout
initPostHog();

// Track events
captureEvent('button_clicked', { buttonId: 'signup' });

// Track page views
capturePageView('/dashboard');

// Identify users
identifyUser('user-123', { plan: 'pro' });

// On logout
resetUser();`}
          </pre>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-muted rounded-lg p-2">
            <p className="font-medium">
              {t('libAnalytics.story.environmentVariable', 'Environment Variable')}
            </p>
            <code className="text-muted-foreground">NEXT_PUBLIC_POSTHOG_KEY</code>
          </div>
          <div className="bg-muted rounded-lg p-2">
            <p className="font-medium">{t('libAnalytics.story.hostOptional', 'Host (optional)')}</p>
            <code className="text-muted-foreground">NEXT_PUBLIC_POSTHOG_HOST</code>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo component showcasing Google Analytics
function GoogleAnalyticsDemo() {
  return (
    <Card className="w-[600px]" data-testid="ga-demo">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          lib/ga.ts
          <Badge variant="secondary">{i18n.t('libAnalytics.story.analytics', 'Analytics')}</Badge>
        </CardTitle>
        <CardDescription>
          {i18n.t(
            'libAnalytics.story.ga4IntegrationComponent',
            'Google Analytics 4 integration component'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg p-3">
          <p className="mb-2 text-sm font-medium">
            {i18n.t(
              'libAnalytics.story.googleanalyticsinitComponent',
              'GoogleAnalyticsInit Component'
            )}
          </p>
          <p className="text-muted-foreground mb-3 text-xs">
            {i18n.t(
              'libAnalytics.story.clientComponentInitGA4',
              'Client component that initializes GA4 and sends initial pageview'
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">use client</Badge>
            <Badge variant="outline">react-ga4</Badge>
            <Badge variant="outline">useEffect</Badge>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="mb-2 text-xs font-medium">
            {i18n.t('libAnalytics.story.usageInLayout', 'Usage in Layout')}
          </p>
          <pre className="overflow-x-auto text-xs">
            {`import GoogleAnalyticsInit from '@/lib/ga';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <GoogleAnalyticsInit />
        {children}
      </body>
    </html>
  );
}`}
          </pre>
        </div>

        <div className="bg-muted rounded-lg p-2 text-xs">
          <p className="font-medium">
            {i18n.t('libAnalytics.story.environmentVariable', 'Environment Variable')}
          </p>
          <code className="text-muted-foreground">NEXT_PUBLIC_GA_MEASUREMENT_ID</code>
        </div>
      </CardContent>
    </Card>
  );
}

// Combined analytics demo
function AnalyticsCatalogDemo() {
  return (
    <div className="w-[650px]" data-testid="analytics-catalog">
      <Tabs defaultValue="posthog" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="posthog">PostHog</TabsTrigger>
          <TabsTrigger value="ga">
            {i18n.t('libAnalytics.story.googleAnalytics', 'Google Analytics')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="posthog" className="mt-4">
          <PostHogDemo />
        </TabsContent>
        <TabsContent value="ga" className="mt-4">
          <GoogleAnalyticsDemo />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Wrapper for meta
function LibAnalyticsWrapper() {
  return <AnalyticsCatalogDemo />;
}

const meta = {
  title: 'Foundations/Lib Analytics',
  component: LibAnalyticsWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## Analytics Configuration

The project includes two analytics integrations:

### PostHog (lib/posthog.ts)

Product analytics with user identification and event tracking.

\`\`\`tsx
import { initPostHog, captureEvent, identifyUser } from '@/lib/posthog';

// Initialize
initPostHog();

// Track events
captureEvent('signup_completed', { plan: 'free' });

// Identify users
identifyUser('user-123', { email: 'user@example.com' });
\`\`\`

### Google Analytics (lib/ga.ts)

GA4 integration via react-ga4.

\`\`\`tsx
import GoogleAnalyticsInit from '@/lib/ga';

// Add to layout
<GoogleAnalyticsInit />
\`\`\`

### Environment Variables

| Variable | Service | Required |
|----------|---------|----------|
| NEXT_PUBLIC_POSTHOG_KEY | PostHog | Yes |
| NEXT_PUBLIC_POSTHOG_HOST | PostHog | No |
| NEXT_PUBLIC_GA_MEASUREMENT_ID | GA4 | Yes |
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof LibAnalyticsWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <AnalyticsCatalogDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify catalog is rendered
    expect(canvas.getByTestId('analytics-catalog')).toBeInTheDocument();

    // Verify PostHog demo is shown (default tab)
    expect(canvas.getByTestId('posthog-demo')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PostHog: Story = {
  render: () => <PostHogDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('posthog-demo')).toBeInTheDocument();

    // Verify functions are documented
    expect(canvas.getByTestId('posthog-initPostHog')).toBeInTheDocument();
    expect(canvas.getByTestId('posthog-captureEvent')).toBeInTheDocument();
  },
};

export const GoogleAnalytics: Story = {
  render: () => <GoogleAnalyticsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('ga-demo')).toBeInTheDocument();
  },
};

export const AllAnalytics: Story = {
  render: () => (
    <div className="space-y-6">
      <PostHogDemo />
      <GoogleAnalyticsDemo />
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('analytics-catalog')).toBeInTheDocument();
    expect(canvas.getByTestId('posthog-demo')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('analytics-catalog')).toBeInTheDocument();
    const tabList = canvasElement.querySelector('[role="tablist"]');
    expect(tabList).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('libAnalytics.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Verify tabs are accessible
    const tabList = canvasElement.querySelector('[role="tablist"]');
    expect(tabList).toBeInTheDocument();

    // Verify tab panels
    const tabPanels = canvasElement.querySelectorAll('[role="tabpanel"]');
    expect(tabPanels.length).not.toBe(0);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('libAnalytics.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('libAnalytics.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('libAnalytics.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('libAnalytics.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
