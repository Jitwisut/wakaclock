import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Component catalog data - comprehensive analysis of _components folder
const componentsCatalog = [
  {
    name: 'AsyncWrapper',
    purpose:
      'Generic async data fetching wrapper for stories with loading, error, and empty states',
    props: [
      {
        name: 'children',
        type: '(data: T) => React.ReactNode',
        required: true,
        description: 'Render function for successful data',
      },
      {
        name: 'endpoint',
        type: 'string',
        required: true,
        description: 'API endpoint to fetch data from',
      },
      {
        name: 'loadingFallback',
        type: 'React.ReactNode',
        required: false,
        description: 'Custom loading fallback',
      },
      {
        name: 'errorFallback',
        type: '(error: Error, retry: () => void) => React.ReactNode',
        required: false,
        description: 'Custom error fallback',
      },
      {
        name: 'emptyFallback',
        type: 'React.ReactNode',
        required: false,
        description: 'Custom empty state fallback',
      },
      {
        name: 'skeletonVariant',
        type: "'card' | 'list' | 'table' | 'text'",
        required: false,
        description: 'Loading skeleton variant',
      },
      {
        name: 'skeletonRows',
        type: 'number',
        required: false,
        description: 'Number of skeleton rows',
      },
      {
        name: 'isEmpty',
        type: '(data: T) => boolean',
        required: false,
        description: 'Function to determine if data is empty',
      },
    ],
    storyCount: 26,
    features: [
      i18n.t('ssotComponents.story.mswIntegration', 'MSW integration'),
      i18n.t('ssotComponents.story.retryFunctionality', 'Retry functionality'),
      i18n.t('ssotComponents.story.httpErrorHandling', 'HTTP error handling'),
      i18n.t('ssotComponents.story.customFallbacks', 'Custom fallbacks'),
    ],
  },
  {
    name: 'EmptyState',
    purpose: 'Reusable empty/zero-state UI component with icon, title, description, and action',
    props: [
      { name: 'title', type: 'string', required: false, description: 'Title text for empty state' },
      { name: 'description', type: 'string', required: false, description: 'Description text' },
      {
        name: 'icon',
        type: 'React.ReactNode',
        required: false,
        description: 'Custom icon (defaults to Inbox)',
      },
      {
        name: 'action',
        type: '{ label: string; onClick: () => void }',
        required: false,
        description: 'Action button configuration',
      },
      { name: 'className', type: 'string', required: false, description: 'Additional CSS classes' },
    ],
    storyCount: 15,
    features: [
      i18n.t('ssotComponents.story.customIcons', 'Custom icons'),
      i18n.t('ssotComponents.story.actionButtons', 'Action buttons'),
      i18n.t('ssotComponents.story.sizeVariants', 'Size variants'),
      i18n.t('ssotComponents.story.accessible', 'Accessible'),
    ],
  },
  {
    name: 'ErrorDisplay',
    purpose: 'Reusable error display component with status code, message, details, and retry',
    props: [
      { name: 'message', type: 'string', required: true, description: 'Error message to display' },
      { name: 'status', type: 'number', required: false, description: 'HTTP status code' },
      { name: 'code', type: 'string', required: false, description: 'Error code identifier' },
      {
        name: 'details',
        type: 'Record<string, string>',
        required: false,
        description: 'Additional error details',
      },
      {
        name: 'onRetry',
        type: '() => void',
        required: false,
        description: 'Retry callback function',
      },
    ],
    storyCount: 24,
    features: [
      i18n.t('ssotComponents.story.httpStatusCodes', 'HTTP status codes'),
      i18n.t('ssotComponents.story.retryButton', 'Retry button'),
      i18n.t('ssotComponents.story.errorDetails', 'Error details'),
      i18n.t('ssotComponents.story.all4xx5xxCoverage', 'All 4xx/5xx coverage'),
    ],
  },
  {
    name: 'LoadingSkeleton',
    purpose: 'Animated loading skeleton with multiple layout variants',
    props: [
      {
        name: 'variant',
        type: "'card' | 'list' | 'table' | 'text'",
        required: false,
        description: 'Visual layout variant',
      },
      {
        name: 'rows',
        type: 'number',
        required: false,
        description: 'Number of skeleton rows (default: 3)',
      },
      {
        name: 'showHeader',
        type: 'boolean',
        required: false,
        description: 'Whether to show header skeleton',
      },
      { name: 'className', type: 'string', required: false, description: 'Additional CSS classes' },
    ],
    storyCount: 21,
    features: ['4 variants', 'Configurable rows', 'Header option', 'Pulse animation'],
  },
];

// Total stories across all components
const totalStories = componentsCatalog.reduce((sum, c) => sum + c.storyCount, 0);
const totalProps = componentsCatalog.reduce((sum, c) => sum + c.props.length, 0);

// Component catalog demo
function ComponentCatalogDemo() {
  return (
    <Card className="w-[800px]" data-testid="component-catalog-demo">
      <CardHeader>
        <CardTitle>
          {i18n.t(
            'ssotComponents.story.ssotInfrastructureComponents',
            'SSOT Infrastructure Components'
          )}
        </CardTitle>
        <CardDescription>
          {componentsCatalog.length} shared components with {totalStories} stories
          <br />({totalProps} total props, reusable across all story files)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {componentsCatalog.map((component, index) => (
              <div
                key={component.name}
                className="bg-muted rounded-lg p-4"
                data-testid={`component-${index}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <code className="text-primary font-mono text-lg font-semibold">
                    {component.name}
                  </code>
                  <Badge variant="secondary">{component.storyCount} stories</Badge>
                </div>

                <p className="text-muted-foreground mb-3 text-sm">{component.purpose}</p>

                {/* Features */}
                <div className="mb-3 flex flex-wrap gap-1">
                  {component.features.map((feature) => (
                    <Badge key={feature} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>

                {/* Props table */}
                <div className="text-xs">
                  <div className="text-muted-foreground mb-1 font-medium">Props:</div>
                  <div className="space-y-1">
                    {component.props.map((prop) => (
                      <div key={prop.name} className="flex items-start gap-2 pl-2">
                        <code className="shrink-0 text-green-600 dark:text-green-400">
                          {prop.name}
                          {prop.required && <span className="text-red-500">*</span>}
                        </code>
                        <code className="shrink-0 text-blue-600 dark:text-blue-400">
                          {prop.type}
                        </code>
                        <span className="text-muted-foreground truncate">- {prop.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Usage patterns demo
function UsagePatternsDemo() {
  return (
    <Card className="w-[700px]" data-testid="usage-patterns-demo">
      <CardHeader>
        <CardTitle>{i18n.t('ssotComponents.story.usagePatterns', 'Usage Patterns')}</CardTitle>
        <CardDescription>
          {i18n.t(
            'ssotComponents.story.howToUseInfrastructureComponentsInStorie',
            'How to use infrastructure components in stories'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg p-3">
          <div className="mb-2 text-sm font-medium">
            {i18n.t('ssotComponents.story.importPattern', 'Import Pattern')}
          </div>
          <pre className="bg-background overflow-x-auto rounded p-2 text-xs">
            {`import {
  AsyncWrapper,
  EmptyState,
  ErrorDisplay,
  LoadingSkeleton,
} from '@/.storybook/stories/_components';`}
          </pre>
        </div>

        <div className="bg-muted rounded-lg p-3">
          <div className="mb-2 text-sm font-medium">
            {i18n.t('ssotComponents.story.asyncwrapperExample', 'AsyncWrapper Example')}
          </div>
          <pre className="bg-background overflow-x-auto rounded p-2 text-xs">
            {`<AsyncWrapper<User[]>
  endpoint="/api/users"
  skeletonVariant="list"
  skeletonRows={5}
  isEmpty={(data) => data.length === 0}
>
  {(users) => (
    <UserList users={users} />
  )}
</AsyncWrapper>`}
          </pre>
        </div>

        <div className="bg-muted rounded-lg p-3">
          <div className="mb-2 text-sm font-medium">
            {i18n.t('ssotComponents.story.emptystateExample', 'EmptyState Example')}
          </div>
          <pre className="bg-background overflow-x-auto rounded p-2 text-xs">
            {`<EmptyState
  title="${i18n.t('ssotComponents.story.noItemsFound', 'No items found')}"
  description="${i18n.t('ssotComponents.story.startByAddingYourFirstItem', 'Start by adding your first item.')}"
  icon={<PackageIcon className="size-5" />}
  action={{
    label: '${i18n.t('ssotComponents.story.addItem', 'Add Item')}',
    onClick: () => console.log('Add clicked'),
  }}
/>`}
          </pre>
        </div>

        <div className="bg-muted rounded-lg p-3">
          <div className="mb-2 text-sm font-medium">
            {i18n.t('ssotComponents.story.errordisplayExample', 'ErrorDisplay Example')}
          </div>
          <pre className="bg-background overflow-x-auto rounded p-2 text-xs">
            {`<ErrorDisplay
  message="Failed to load data"
  status={500}
  code="INTERNAL_SERVER_ERROR"
  details={{ requestId: 'abc-123' }}
  onRetry={() => refetch()}
/>`}
          </pre>
        </div>

        <div className="bg-muted rounded-lg p-3">
          <div className="mb-2 text-sm font-medium">
            {i18n.t('ssotComponents.story.loadingskeletonExample', 'LoadingSkeleton Example')}
          </div>
          <pre className="bg-background overflow-x-auto rounded p-2 text-xs">
            {`<LoadingSkeleton
  variant="card"
  rows={3}
  showHeader
/>`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Data attributes demo
function DataAttributesDemo() {
  return (
    <Card className="w-[700px]" data-testid="data-attributes-demo">
      <CardHeader>
        <CardTitle>{i18n.t('ssotComponents.story.dataAttributes', 'Data Attributes')}</CardTitle>
        <CardDescription>
          {i18n.t(
            'ssotComponents.story.standardAttributesUsedForTestingAndStyli',
            'Standard attributes used for testing and styling'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="bg-muted rounded-lg p-3">
            <code className="text-primary font-mono text-sm">data-testid</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Element targeting for assertions (e.g., &quot;story-empty&quot;,
              &quot;empty-action-button&quot;)
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="text-primary font-mono text-sm">data-slot</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Semantic component parts (e.g., &quot;empty-state&quot;, &quot;empty-title&quot;,
              &quot;empty-icon&quot;)
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="text-primary font-mono text-sm">data-state</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Current component state (e.g., &quot;loading&quot;, &quot;success&quot;,
              &quot;error&quot;, &quot;empty&quot;)
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="text-primary font-mono text-sm">data-variant</code>
            <p className="text-muted-foreground mt-1 text-xs">
              Component variant type (e.g., &quot;card&quot;, &quot;list&quot;, &quot;table&quot;,
              &quot;text&quot;)
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <code className="text-primary font-mono text-sm">data-error-status</code>
            <p className="text-muted-foreground mt-1 text-xs">
              HTTP status code for error displays (e.g., &quot;404&quot;, &quot;500&quot;)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Combined catalog view
function ComponentsCatalogView() {
  return (
    <div className="w-[800px]" data-testid="components-catalog">
      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="catalog">
            {i18n.t('ssotComponents.story.componentCatalog', 'Component Catalog')}
          </TabsTrigger>
          <TabsTrigger value="usage">
            {i18n.t('ssotComponents.story.usagePatterns', 'Usage Patterns')}
          </TabsTrigger>
          <TabsTrigger value="attributes">
            {i18n.t('ssotComponents.story.dataAttributes', 'Data Attributes')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="mt-4">
          <ComponentCatalogDemo />
        </TabsContent>
        <TabsContent value="usage" className="mt-4">
          <UsagePatternsDemo />
        </TabsContent>
        <TabsContent value="attributes" className="mt-4">
          <DataAttributesDemo />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Wrapper for meta
function SsotComponentsWrapper() {
  return <ComponentsCatalogView />;
}

const meta = {
  title: 'Documentation/SSOT Components',
  component: SsotComponentsWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## SSOT _components Directory

Reusable infrastructure components for Storybook story development.

### Components (4 total)

| Component | Purpose | Stories |
|-----------|---------|---------|
| \`AsyncWrapper\` | Generic async data fetching wrapper | 26 |
| \`EmptyState\` | Zero-state UI component | 15 |
| \`ErrorDisplay\` | Error display with retry | 24 |
| \`LoadingSkeleton\` | Loading skeleton variants | 21 |

### Features

- **MSW Integration**: Works with Mock Service Worker for API mocking
- **HTTP Error Coverage**: All 4xx and 5xx status codes supported
- **Accessibility**: ARIA attributes, keyboard navigation, screen readers
- **Theme Support**: Dark mode and RTL variants
- **Testing**: data-testid attributes for E2E testing

### Usage

\`\`\`tsx
import {
  AsyncWrapper,
  EmptyState,
  ErrorDisplay,
  LoadingSkeleton,
} from '@/.storybook/stories/_components';

// In your story
<AsyncWrapper endpoint="/api/data">
  {(data) => <YourComponent data={data} />}
</AsyncWrapper>
\`\`\`
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof SsotComponentsWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ComponentsCatalogView />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify catalog is rendered
    expect(canvas.getByTestId('components-catalog')).toBeInTheDocument();

    // Verify component catalog is shown (default tab)
    expect(canvas.getByTestId('component-catalog-demo')).toBeInTheDocument();

    // Verify all components are listed
    expect(canvas.getByTestId('component-0')).toBeInTheDocument();
    expect(canvas.getByTestId('component-1')).toBeInTheDocument();
    expect(canvas.getByTestId('component-2')).toBeInTheDocument();
    expect(canvas.getByTestId('component-3')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Catalog: Story = {
  render: () => <ComponentCatalogDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('component-catalog-demo')).toBeInTheDocument();
  },
};

export const UsagePatterns: Story = {
  render: () => <UsagePatternsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('usage-patterns-demo')).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  render: () => <DataAttributesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('data-attributes-demo')).toBeInTheDocument();
  },
};

export const AllSections: Story = {
  render: () => (
    <div className="space-y-6">
      <ComponentCatalogDemo />
      <UsagePatternsDemo />
      <DataAttributesDemo />
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
  name: i18n.t('ssotComponents.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Verify tabs are accessible
    const tabList = canvasElement.querySelector('[role="tablist"]');
    expect(tabList).toBeInTheDocument();

    // Verify code elements are present
    const codeElements = canvasElement.querySelectorAll('code');
    expect(codeElements.length).not.toBe(0);

    // Verify badges are present
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).not.toBe(0);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('ssotComponents.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('ssotComponents.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('ssotComponents.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
