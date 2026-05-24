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

// Arcjet configurations
const arcjetConfigs = [
  {
    name: 'aj',
    description: i18n.t('libArcjet.story.baseClientDesc', 'Base client with common protections'),
    rules: ['Shield (SQL injection, XSS)', 'Bot Detection (allow search engines)'],
    useCase: i18n.t('libArcjet.story.generalPagesUseCase', 'General pages and endpoints'),
  },
  {
    name: 'ajRateLimited',
    description: i18n.t(
      'libArcjet.story.rateLimitedClientDesc',
      'Rate-limited client for API routes'
    ),
    rules: ['Shield', 'Bot Detection', 'Token Bucket (100/60s)'],
    useCase: i18n.t('libArcjet.story.standardApiUseCase', 'Standard API endpoints'),
  },
  {
    name: 'ajStrictRateLimited',
    description: i18n.t(
      'libArcjet.story.strictRateLimitDesc',
      'Strict rate limiting for sensitive endpoints'
    ),
    rules: ['Shield', 'Bot Detection (no bots)', 'Token Bucket (5/60s)'],
    useCase: i18n.t('libArcjet.story.loginSignupUseCase', 'Login, signup, password reset'),
  },
];

// Demo component showcasing Arcjet configuration
function ArcjetConfigDemo() {
  return (
    <Card className="w-[600px]" data-testid="arcjet-config-demo">
      <CardHeader>
        <CardTitle>
          {i18n.t(
            'libArcjet.story.securityConfiguration',
            'lib/arcjet.ts - Security Configuration'
          )}
        </CardTitle>
        <CardDescription>
          {i18n.t(
            'libArcjet.story.arcjetSecurityMiddleware',
            'Arcjet security middleware for Next.js with bot detection and rate limiting'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {arcjetConfigs.map((config, index) => (
          <div
            key={config.name}
            className="bg-muted space-y-3 rounded-lg p-4"
            data-testid={`arcjet-config-${index}`}
          >
            <div className="flex items-center justify-between">
              <code className="font-mono text-sm font-semibold">{config.name}</code>
              <Badge variant="outline">{config.useCase}</Badge>
            </div>
            <p className="text-muted-foreground text-xs">{config.description}</p>
            <div className="flex flex-wrap gap-2">
              {config.rules.map((rule) => (
                <Badge key={rule} variant="secondary" className="text-xs">
                  {rule}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Usage demo
function ArcjetUsageDemo() {
  const { t } = useTranslation();
  return (
    <Card className="w-[600px]" data-testid="arcjet-usage-demo">
      <CardHeader>
        <CardTitle>{t('libArcjet.story.usageExamples', 'Usage Examples')}</CardTitle>
        <CardDescription>
          {t(
            'libArcjet.story.howToUseArcjetClientsInYourApiRoutes',
            'How to use Arcjet clients in your API routes'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="mb-2 text-xs font-medium">
            {t('libArcjet.story.basicProtection', 'Basic Protection (app/api/route.ts)')}
          </p>
          <pre className="overflow-x-auto text-xs">
            {`import { aj } from '@/lib/arcjet';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const decision = await aj.protect(req);

  if (decision.isDenied()) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  return NextResponse.json({ data: '...' });
}`}
          </pre>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="mb-2 text-xs font-medium">
            {t('libArcjet.story.rateLimitedApi', 'Rate Limited API')}
          </p>
          <pre className="overflow-x-auto text-xs">
            {`import { ajRateLimited } from '@/lib/arcjet';

export async function POST(req: NextRequest) {
  const decision = await ajRateLimited.protect(req);

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  // Process request...
}`}
          </pre>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="mb-2 text-xs font-medium">
            {t('libArcjet.story.sensitiveEndpoint', 'Sensitive Endpoint (Login)')}
          </p>
          <pre className="overflow-x-auto text-xs">
            {`import { ajStrictRateLimited } from '@/lib/arcjet';

export async function POST(req: NextRequest) {
  const decision = await ajStrictRateLimited.protect(req);

  // Only 5 attempts per minute allowed
  if (decision.isDenied()) {
    return NextResponse.json(
      { error: 'Too many login attempts' },
      { status: 429 }
    );
  }

  // Authenticate user...
}`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Wrapper for meta
function LibArcjetWrapper() {
  return <ArcjetConfigDemo />;
}

const meta = {
  title: 'Foundations/Lib Arcjet',
  component: LibArcjetWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## lib/arcjet.ts

Security middleware configuration using Arcjet for Next.js.

### Exported Clients

| Client | Rate Limit | Bots Allowed | Use Case |
|--------|------------|--------------|----------|
| \`aj\` | None | Search engines | General pages |
| \`ajRateLimited\` | 100/60s | Search engines | API endpoints |
| \`ajStrictRateLimited\` | 5/60s | None | Auth endpoints |

### Features

- **Shield**: Protection against SQL injection, XSS, and other attacks
- **Bot Detection**: Configurable bot allow/deny lists
- **Rate Limiting**: Token bucket algorithm with configurable limits
- **IP Tracking**: Requests tracked by source IP

### Environment

Requires \`ARCJET_KEY\` environment variable.

### Usage

\`\`\`tsx
import { aj, ajRateLimited, ajStrictRateLimited } from '@/lib/arcjet';

const decision = await aj.protect(request);
if (decision.isDenied()) {
  // Handle denied request
}
\`\`\`
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof LibArcjetWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ArcjetConfigDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify demo is rendered
    expect(canvas.getByTestId('arcjet-config-demo')).toBeInTheDocument();

    // Verify all configs are shown
    expect(canvas.getByTestId('arcjet-config-0')).toBeInTheDocument();
    expect(canvas.getByTestId('arcjet-config-1')).toBeInTheDocument();
    expect(canvas.getByTestId('arcjet-config-2')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const UsageExamples: Story = {
  render: () => <ArcjetUsageDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('arcjet-usage-demo')).toBeInTheDocument();
  },
};

export const AllSections: Story = {
  render: () => (
    <div className="space-y-6">
      <ArcjetConfigDemo />
      <ArcjetUsageDemo />
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
    expect(canvas.getByTestId('arcjet-config-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('arcjet-config-0')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('arcjet-config-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('arcjet-config-1')).toBeInTheDocument();
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

// ============ INDIVIDUAL CONFIGURATIONS ============

export const BaseProtection: Story = {
  render: () => (
    <Card className="w-[600px]" data-testid="arcjet-base-protection">
      <CardHeader>
        <CardTitle>{i18n.t('libArcjet.story.baseProtectionAj', 'Base Protection (aj)')}</CardTitle>
        <CardDescription>{arcjetConfigs[0].description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <code className="font-mono text-sm font-semibold">{arcjetConfigs[0].name}</code>
          <Badge variant="outline">{arcjetConfigs[0].useCase}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {arcjetConfigs[0].rules.map((rule) => (
            <Badge key={rule} variant="secondary" className="text-xs">
              {rule}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('arcjet-base-protection')).toBeInTheDocument();
    await expect(canvas.getByText('aj')).toBeInTheDocument();
    await expect(canvas.getByText('General pages and endpoints')).toBeInTheDocument();
  },
};

export const RateLimited: Story = {
  render: () => (
    <Card className="w-[600px]" data-testid="arcjet-rate-limited">
      <CardHeader>
        <CardTitle>
          {i18n.t('libArcjet.story.rateLimitedAjratelimited', 'Rate Limited (ajRateLimited)')}
        </CardTitle>
        <CardDescription>{arcjetConfigs[1].description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <code className="font-mono text-sm font-semibold">{arcjetConfigs[1].name}</code>
          <Badge variant="outline">{arcjetConfigs[1].useCase}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {arcjetConfigs[1].rules.map((rule) => (
            <Badge key={rule} variant="secondary" className="text-xs">
              {rule}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('arcjet-rate-limited')).toBeInTheDocument();
    await expect(canvas.getByText('ajRateLimited')).toBeInTheDocument();
    await expect(canvas.getByText('Token Bucket (100/60s)')).toBeInTheDocument();
  },
};

export const StrictRateLimited: Story = {
  render: () => (
    <Card className="w-[600px]" data-testid="arcjet-strict-rate-limited">
      <CardHeader>
        <CardTitle>
          {i18n.t(
            'libArcjet.story.strictRateLimitedAjstrictratelimited',
            'Strict Rate Limited (ajStrictRateLimited)'
          )}
        </CardTitle>
        <CardDescription>{arcjetConfigs[2].description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <code className="font-mono text-sm font-semibold">{arcjetConfigs[2].name}</code>
          <Badge variant="outline">{arcjetConfigs[2].useCase}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {arcjetConfigs[2].rules.map((rule) => (
            <Badge key={rule} variant="secondary" className="text-xs">
              {rule}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('arcjet-strict-rate-limited')).toBeInTheDocument();
    await expect(canvas.getByText('ajStrictRateLimited')).toBeInTheDocument();
    await expect(canvas.getByText('Login, signup, password reset')).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('libArcjet.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify semantic structure
    expect(canvas.getByTestId('arcjet-config-demo')).toBeInTheDocument();

    // Verify code elements are present
    const codeElements = canvasElement.querySelectorAll('code');
    expect(codeElements.length).not.toBe(0);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('libArcjet.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('libArcjet.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('libArcjet.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('libArcjet.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
