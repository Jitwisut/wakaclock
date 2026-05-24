import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { DEFAULT_FAKER_SEED, seedFaker } from '@/.storybook/stories/_utils/faker-seed';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';

import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Demo component showcasing faker-seed utils
function FakerSeedDemo() {
  const { t } = useTranslation();
  return (
    <Card className="w-full" data-testid="faker-seed-demo">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          faker-seed.ts
          <Badge variant="secondary">
            {t('ssotUtils.story.deterministicTesting', 'Deterministic Testing')}
          </Badge>
        </CardTitle>
        <CardDescription>
          {t(
            'ssotUtils.story.utilitiesForSeedingFakerjsForReproducibl',
            'Utilities for seeding Faker.js for reproducible test data'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <div className="bg-muted rounded-lg p-3">
            <code className="font-mono text-sm">DEFAULT_FAKER_SEED</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Constant seed value: <code>{DEFAULT_FAKER_SEED}</code>
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="font-mono text-sm">seedFaker(seed?)</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Seeds faker with custom or default seed
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="font-mono text-sm">resetFaker()</code>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('ssotUtils.story.resetsFakerToDefaultSeed', 'Resets faker to default seed')}
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="font-mono text-sm">withFakerSeed(seed, fn)</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Runs function with specific seed, then resets
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="font-mono text-sm">fakerSeedDecorator</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Storybook decorator that seeds faker before each story
            </p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="overflow-x-auto text-xs">
            {`import { seedFaker, DEFAULT_FAKER_SEED } from '@/.storybook/stories/_utils/faker-seed';

// At top of story file
seedFaker();

// Or with custom seed
seedFaker(54321);

// Deterministic data generation
const name = faker.person.fullName(); // Always same value`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo component showcasing http-status utils
function HttpStatusDemo() {
  const statusCategories = [
    { range: '2xx', label: i18n.t('ssotUtils.story.success'), codes: ['200', '201', '204'] },
    {
      range: '4xx',
      label: i18n.t('ssotUtils.story.clientError'),
      codes: ['400', '401', '403', '404', '429'],
    },
    {
      range: '5xx',
      label: i18n.t('ssotUtils.story.serverError'),
      codes: ['500', '502', '503', '504'],
    },
  ];

  return (
    <Card className="w-full" data-testid="http-status-demo">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          http-status.ts
          <Badge variant="secondary">
            {i18n.t('ssotUtils.story.httpUtilities', 'HTTP Utilities')}
          </Badge>
        </CardTitle>
        <CardDescription>
          {i18n.t(
            'ssotUtils.story.httpStatusCodeConstantsAndErrorHandlingU',
            'HTTP status code constants and error handling utilities'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">HTTP_STATUS Constants</p>
          <div className="grid grid-cols-3 gap-3">
            {statusCategories.map((cat) => (
              <div key={cat.range} className="bg-muted rounded-lg p-2">
                <p className="mb-1 text-xs font-medium">
                  {cat.range} {cat.label}
                </p>
                <div className="flex flex-wrap gap-1">
                  {cat.codes.map((code) => (
                    <Badge key={code} variant="outline" className="text-xs">
                      {code}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="bg-muted rounded-lg p-3">
            <code className="font-mono text-sm">HTTP_STATUS</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Object with all HTTP status codes (OK, BAD_REQUEST, etc.)
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="font-mono text-sm">createApiError(status, message?, details?)</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Creates standardized API error object
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="font-mono text-sm">isClientError(status) / isServerError(status)</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Type guards for 4xx/5xx status codes
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="font-mono text-sm">getErrorMessage(status)</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Returns user-friendly error message for status
            </p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="overflow-x-auto text-xs">
            {`import { HTTP_STATUS, createApiError, getErrorMessage } from '@/.storybook/stories/_utils/http-status';

// Create an error response
const error = createApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
// { status: 404, message: 'User not found', ... }

// Get user-friendly message
const msg = getErrorMessage(HTTP_STATUS.INTERNAL_SERVER_ERROR);
// 'An unexpected error occurred. Please try again later.'`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo component showcasing normalize-decorators
function NormalizeDecoratorsDemo() {
  return (
    <Card className="w-full" data-testid="normalize-decorators-demo">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          normalize-decorators.ts
          <Badge variant="secondary">
            {i18n.t('ssotUtils.story.storyHelpers', 'Story Helpers')}
          </Badge>
        </CardTitle>
        <CardDescription>
          {i18n.t(
            'ssotUtils.story.utilityForSafelyHandlingStoryDecorators',
            'Utility for safely handling story decorators'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg p-3">
          <code className="font-mono text-sm">normalizeDecorators(decorators)</code>
          <p className="text-muted-foreground mt-1 text-xs">
            Converts undefined/single decorator to array for spreading
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="overflow-x-auto text-xs">
            {`import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';

export const Variant: Story = {
  ...Default,
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => <Wrapper><Story /></Wrapper>,
  ],
};`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo component showcasing story-helpers
function StoryHelpersDemo() {
  return (
    <Card className="w-full" data-testid="story-helpers-demo">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          story-helpers.ts
          <Badge variant="secondary">
            {i18n.t('ssotUtils.story.storyUtilities', 'Story Utilities')}
          </Badge>
        </CardTitle>
        <CardDescription>
          Helper functions for creating stories with events and HTTP error states
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <div className="bg-muted rounded-lg p-3">
            <code className="font-mono text-sm">createEventArgs()</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Creates default args with fn() for common event handlers
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="font-mono text-sm">createEventArgTypes()</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Creates argTypes for event handlers with Actions panel integration
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="font-mono text-sm">createHttpErrorStories(baseStory, handlers)</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Generates stories for all HTTP error states (400-504)
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="font-mono text-sm">createSpecialStateStories(baseStory, states)</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Generates stories for loading, empty, and error states
            </p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="overflow-x-auto text-xs">
            {`import { createEventArgs, createEventArgTypes, createHttpErrorStories } from '@/.storybook/stories/_utils/story-helpers';

const meta = {
  args: {
    ...createEventArgs(),
    // onClick, onFocus, onBlur, etc. already defined with fn()
  },
  argTypes: {
    ...createEventArgTypes(),
    // Event handlers with action logging
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// Generate HTTP error stories
const { Error400, Error404, Error500 } = createHttpErrorStories(Default, statusHandlers);`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Combined utils catalog
function UtilsCatalogDemo() {
  return (
    <div className="w-[700px]" data-testid="utils-catalog">
      <Tabs defaultValue="faker" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="faker">
            {i18n.t('ssotUtils.story.fakerSeed', 'Faker Seed')}
          </TabsTrigger>
          <TabsTrigger value="http">HTTP Status</TabsTrigger>
          <TabsTrigger value="decorators">
            {i18n.t('ssotUtils.story.decorators', 'Decorators')}
          </TabsTrigger>
          <TabsTrigger value="helpers">{i18n.t('ssotUtils.story.helpers', 'Helpers')}</TabsTrigger>
        </TabsList>
        <TabsContent value="faker" className="mt-4">
          <FakerSeedDemo />
        </TabsContent>
        <TabsContent value="http" className="mt-4">
          <HttpStatusDemo />
        </TabsContent>
        <TabsContent value="decorators" className="mt-4">
          <NormalizeDecoratorsDemo />
        </TabsContent>
        <TabsContent value="helpers" className="mt-4">
          <StoryHelpersDemo />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Wrapper for meta
function SsotUtilsWrapper() {
  return <UtilsCatalogDemo />;
}

const meta = {
  title: 'Documentation/SSOT Utils',
  component: SsotUtilsWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## SSOT _utils Directory

Utility functions for Storybook story development.

### faker-seed.ts
- \`seedFaker(seed?)\` - Seeds faker for deterministic data
- \`resetFaker()\` - Resets to default seed
- \`withFakerSeed(seed, fn)\` - Runs function with specific seed
- \`fakerSeedDecorator\` - Storybook decorator for seeding

### http-status.ts
- \`HTTP_STATUS\` - Object with all HTTP status codes
- \`createApiError(status, message?, details?)\` - Creates error objects
- \`isClientError(status)\` / \`isServerError(status)\` - Type guards
- \`getErrorMessage(status)\` - User-friendly error messages

### normalize-decorators.ts
- \`normalizeDecorators(decorators)\` - Safe decorator array handling

### story-helpers.ts
- \`createEventArgs()\` - Creates args with fn() event handlers
- \`createEventArgTypes()\` - Creates argTypes for events
- \`createHttpErrorStories(base, handlers)\` - Generates error stories
- \`createSpecialStateStories(base, states)\` - Generates state stories

### Usage

\`\`\`tsx
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { HTTP_STATUS, createApiError } from '@/.storybook/stories/_utils/http-status';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { createEventArgs } from '@/.storybook/stories/_utils/story-helpers';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

// Seed faker at top of story
seedFaker();

// Create error response
const error = createApiError(HTTP_STATUS.NOT_FOUND, 'Not found');

// Spread decorators safely
decorators: [...normalizeDecorators(Default.decorators), myDecorator]

// Add event handlers to args
args: { ...createEventArgs() }
\`\`\`
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof SsotUtilsWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <UtilsCatalogDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify catalog is rendered
    expect(canvas.getByTestId('utils-catalog')).toBeInTheDocument();

    // Verify faker demo is shown (default tab)
    expect(canvas.getByTestId('faker-seed-demo')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const FakerSeed: Story = {
  render: () => <FakerSeedDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('faker-seed-demo')).toBeInTheDocument();
  },
};

export const HttpStatus: Story = {
  render: () => <HttpStatusDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('http-status-demo')).toBeInTheDocument();
  },
};

export const NormalizeDecorators: Story = {
  render: () => <NormalizeDecoratorsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('normalize-decorators-demo')).toBeInTheDocument();
  },
};

export const StoryHelpers: Story = {
  render: () => <StoryHelpersDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('story-helpers-demo')).toBeInTheDocument();
  },
};

export const AllUtils: Story = {
  render: () => (
    <div className="space-y-6">
      <FakerSeedDemo />
      <HttpStatusDemo />
      <NormalizeDecoratorsDemo />
      <StoryHelpersDemo />
    </div>
  ),
  tags: ['!test'],
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
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('ssotUtils.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Verify tabs are accessible
    const tabList = canvasElement.querySelector('[role="tablist"]');
    expect(tabList).toBeInTheDocument();

    // Verify code elements
    const codeElements = canvasElement.querySelectorAll('code');
    expect(codeElements.length).not.toBe(0);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('ssotUtils.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('ssotUtils.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('ssotUtils.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('ssotUtils.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
