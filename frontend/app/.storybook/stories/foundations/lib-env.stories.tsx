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

// Environment variable categories
const envCategories = {
  server: [
    {
      name: 'NODE_ENV',
      type: 'enum',
      values: ['development', 'test', 'production'],
      required: false,
    },
    { name: 'DATABASE_URL', type: 'string (url)', required: false },
    { name: 'AUTH_SECRET', type: 'string (min 32)', required: false },
    { name: 'ARCJET_KEY', type: 'string', required: false },
    { name: 'POSTHOG_API_KEY', type: 'string', required: false },
  ],
  client: [
    { name: 'NEXT_PUBLIC_APP_URL', type: 'string (url)', required: false },
    { name: 'NEXT_PUBLIC_POSTHOG_KEY', type: 'string', required: false },
    { name: 'NEXT_PUBLIC_POSTHOG_HOST', type: 'string (url)', required: false },
    { name: 'NEXT_PUBLIC_GA_MEASUREMENT_ID', type: 'string', required: false },
  ],
};

// Demo component showcasing env configuration
function EnvConfigDemo() {
  const { t } = useTranslation();
  return (
    <Card className="w-[600px]" data-testid="env-config-demo">
      <CardHeader>
        <CardTitle>
          {t('libEnv.story.envConfiguration', 'lib/env.ts - Environment Configuration')}
        </CardTitle>
        <CardDescription>
          {t(
            'libEnv.story.typeSafeEnvVars',
            'Type-safe environment variables using @t3-oss/env-nextjs with Zod validation'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            {t('libEnv.story.serverSideVariables', 'Server-side Variables')}
            <Badge variant="secondary">{t('libEnv.story.serverOnly', 'Server Only')}</Badge>
          </h3>
          <div className="space-y-2">
            {envCategories.server.map((env) => (
              <div
                key={env.name}
                className="bg-muted flex items-center justify-between rounded-lg p-2"
                data-testid={`env-${env.name}`}
              >
                <code className="font-mono text-xs">{env.name}</code>
                <Badge variant="outline" className="text-xs">
                  {env.type}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            {t('libEnv.story.clientSideVariables', 'Client-side Variables')}
            <Badge variant="secondary">{t('libEnv.story.public', 'Public')}</Badge>
          </h3>
          <div className="space-y-2">
            {envCategories.client.map((env) => (
              <div
                key={env.name}
                className="bg-muted flex items-center justify-between rounded-lg p-2"
                data-testid={`env-${env.name}`}
              >
                <code className="font-mono text-xs">{env.name}</code>
                <Badge variant="outline" className="text-xs">
                  {env.type}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="overflow-x-auto text-xs">
            {`import { env } from '@/lib/env';

// Type-safe access
const dbUrl = env.DATABASE_URL;
const appUrl = env.NEXT_PUBLIC_APP_URL;

// Validation happens at build time
// Missing required vars will cause build errors`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Features demo
function EnvFeaturesDemo() {
  return (
    <Card className="w-[600px]" data-testid="env-features-demo">
      <CardHeader>
        <CardTitle>{i18n.t('libEnv.story.features', 'Features')}</CardTitle>
        <CardDescription>
          {i18n.t(
            'libEnv.story.keyFeaturesOfTheEnvironmentConfiguration',
            'Key features of the environment configuration'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="bg-muted rounded-lg p-3">
            <p className="mb-1 text-sm font-medium">
              {i18n.t('libEnv.story.typeSafety', 'Type Safety')}
            </p>
            <p className="text-muted-foreground text-xs">
              {i18n.t(
                'libEnv.story.fullTypeScriptSupport',
                'Full TypeScript support with Zod schema validation'
              )}
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="mb-1 text-sm font-medium">
              {i18n.t('libEnv.story.buildTimeValidation', 'Build-time Validation')}
            </p>
            <p className="text-muted-foreground text-xs">
              {i18n.t(
                'libEnv.story.missingOrInvalidEnvVars',
                'Missing or invalid env vars fail the build early'
              )}
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="mb-1 text-sm font-medium">
              {i18n.t('libEnv.story.serverClientSeparation', 'Server/Client Separation')}
            </p>
            <p className="text-muted-foreground text-xs">
              {i18n.t(
                'libEnv.story.serverVarsNeverLeakToClientBundle',
                'Server vars never leak to client bundle'
              )}
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="mb-1 text-sm font-medium">
              {i18n.t('libEnv.story.skipValidation', 'Skip Validation')}
            </p>
            <p className="text-muted-foreground text-xs">
              {i18n.t(
                'libEnv.story.skipEnvValidationDesc',
                'Set SKIP_ENV_VALIDATION=true to bypass validation'
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Wrapper for meta
function LibEnvWrapper() {
  return <EnvConfigDemo />;
}

const meta = {
  title: 'Foundations/Lib Env',
  component: LibEnvWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## lib/env.ts

Type-safe environment variable configuration using @t3-oss/env-nextjs.

### Usage

\`\`\`tsx
import { env } from '@/lib/env';

// Server-side
const dbUrl = env.DATABASE_URL;
const secret = env.AUTH_SECRET;

// Client-side (NEXT_PUBLIC_ prefix)
const appUrl = env.NEXT_PUBLIC_APP_URL;
\`\`\`

### Features

- **Type Safety**: Full TypeScript inference
- **Validation**: Zod schemas validate at build time
- **Separation**: Server vars protected from client bundle
- **Defaults**: NODE_ENV defaults to 'development'

### Server Variables

| Variable | Type | Description |
|----------|------|-------------|
| NODE_ENV | enum | development/test/production |
| DATABASE_URL | url | Database connection string |
| AUTH_SECRET | string | Auth.js secret (min 32 chars) |
| ARCJET_KEY | string | Arcjet security key |

### Client Variables

| Variable | Type | Description |
|----------|------|-------------|
| NEXT_PUBLIC_APP_URL | url | Public app URL |
| NEXT_PUBLIC_POSTHOG_KEY | string | PostHog project key |
| NEXT_PUBLIC_GA_MEASUREMENT_ID | string | Google Analytics ID |
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof LibEnvWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <EnvConfigDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify demo is rendered
    expect(canvas.getByTestId('env-config-demo')).toBeInTheDocument();

    // Verify server env vars are shown
    expect(canvas.getByTestId('env-NODE_ENV')).toBeInTheDocument();
    expect(canvas.getByTestId('env-DATABASE_URL')).toBeInTheDocument();

    // Verify client env vars are shown
    expect(canvas.getByTestId('env-NEXT_PUBLIC_APP_URL')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Features: Story = {
  render: () => <EnvFeaturesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('env-features-demo')).toBeInTheDocument();
  },
};

export const AllSections: Story = {
  render: () => (
    <div className="space-y-6">
      <EnvConfigDemo />
      <EnvFeaturesDemo />
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
    expect(canvas.getByTestId('env-config-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('env-NODE_ENV')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('env-config-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('env-NEXT_PUBLIC_APP_URL')).toBeInTheDocument();
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
  name: i18n.t('libEnv.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify semantic structure
    expect(canvas.getByTestId('env-config-demo')).toBeInTheDocument();

    // Verify code elements are present
    const codeElements = canvasElement.querySelectorAll('code');
    expect(codeElements.length).not.toBe(0);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('libEnv.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('libEnv.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('libEnv.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('libEnv.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
