import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Handler catalog data
const handlerCatalog = [
  {
    name: 'accordion.handlers',
    exports: ['accordionHandlers', 'accordionStatusHandlers'],
    endpoints: ['/api/accordion'],
  },
  {
    name: 'alert.handlers',
    exports: ['alertHandlers', 'alertStatusHandlers'],
    endpoints: ['/api/alerts'],
  },
  {
    name: 'avatar.handlers',
    exports: ['avatarHandlers', 'avatarStatusHandlers'],
    endpoints: ['/api/avatars'],
  },
  {
    name: 'badge.handlers',
    exports: ['badgeHandlers', 'badgeStatusHandlers'],
    endpoints: ['/api/badges'],
  },
  {
    name: 'breadcrumb.handlers',
    exports: ['breadcrumbHandlers', 'breadcrumbStatusHandlers'],
    endpoints: ['/api/breadcrumbs'],
  },
  {
    name: 'calendar.handlers',
    exports: ['calendarHandlers', 'calendarStatusHandlers'],
    endpoints: ['/api/calendar'],
  },
  {
    name: 'card.handlers',
    exports: ['cardHandlers', 'cardStatusHandlers'],
    endpoints: ['/api/cards'],
  },
  {
    name: 'carousel.handlers',
    exports: ['carouselHandlers', 'carouselStatusHandlers'],
    endpoints: ['/api/carousel'],
  },
  {
    name: 'chart.handlers',
    exports: ['chartHandlers', 'chartStatusHandlers'],
    endpoints: ['/api/charts'],
  },
  {
    name: 'chat.handlers',
    exports: ['chatHandlers', 'chatStatusHandlers'],
    endpoints: ['/api/chat', '/api/messages'],
  },
  {
    name: 'dialog.handlers',
    exports: ['dialogHandlers', 'dialogStatusHandlers'],
    endpoints: ['/api/dialogs'],
  },
  {
    name: 'event.handlers',
    exports: ['eventHandlers', 'eventStatusHandlers'],
    endpoints: ['/api/events'],
  },
  {
    name: 'form.handlers',
    exports: ['formHandlers', 'formStatusHandlers'],
    endpoints: ['/api/form', '/api/submit'],
  },
  {
    name: 'kanban.handlers',
    exports: ['kanbanHandlers', 'kanbanStatusHandlers'],
    endpoints: ['/api/kanban'],
  },
  {
    name: 'menu.handlers',
    exports: ['menuHandlers', 'menuStatusHandlers'],
    endpoints: ['/api/menu'],
  },
  {
    name: 'navigation.handlers',
    exports: ['navigationHandlers', 'navigationStatusHandlers'],
    endpoints: ['/api/navigation'],
  },
  {
    name: 'notification.handlers',
    exports: ['notificationHandlers', 'notificationStatusHandlers'],
    endpoints: ['/api/notifications'],
  },
  {
    name: 'progress.handlers',
    exports: ['progressHandlers', 'progressStatusHandlers'],
    endpoints: ['/api/progress'],
  },
  {
    name: 'search.handlers',
    exports: ['searchHandlers', 'searchStatusHandlers'],
    endpoints: ['/api/search'],
  },
  {
    name: 'table.handlers',
    exports: ['tableHandlers', 'tableStatusHandlers'],
    endpoints: ['/api/table'],
  },
  {
    name: 'tabs.handlers',
    exports: ['tabsHandlers', 'tabsStatusHandlers'],
    endpoints: ['/api/tabs'],
  },
  {
    name: 'theme.handlers',
    exports: ['themeHandlers', 'themeStatusHandlers'],
    endpoints: ['/api/theme'],
  },
  {
    name: 'tooltip.handlers',
    exports: ['tooltipHandlers', 'tooltipStatusHandlers'],
    endpoints: ['/api/tooltips'],
  },
  {
    name: 'user.handlers',
    exports: ['userHandlers', 'userStatusHandlers'],
    endpoints: ['/api/users', '/api/profile'],
  },
];

// Status handler structure
const statusHandlerStructure = [
  { name: 'success', description: 'Returns success response (200)', status: '2xx' },
  { name: 'loading', description: 'Delays response to simulate loading', status: 'delay' },
  { name: 'slowResponse', description: 'Extended delay (2-5s)', status: 'delay' },
  { name: 'emptyData', description: 'Returns empty array/null', status: '200' },
  { name: 'emptyHistory', description: 'Returns empty history state', status: '200' },
  { name: 'badRequest', description: 'Returns 400 error', status: '400' },
  { name: 'unauthorized', description: 'Returns 401 error', status: '401' },
  { name: 'forbidden', description: 'Returns 403 error', status: '403' },
  { name: 'notFound', description: 'Returns 404 error', status: '404' },
  { name: 'tooManyRequests', description: 'Returns 429 error', status: '429' },
  { name: 'internalServerError', description: 'Returns 500 error', status: '500' },
  { name: 'badGateway', description: 'Returns 502 error', status: '502' },
  { name: 'serviceUnavailable', description: 'Returns 503 error', status: '503' },
  { name: 'gatewayTimeout', description: 'Returns 504 error', status: '504' },
  { name: 'networkError', description: 'Simulates network failure', status: 'error' },
];

// Handler catalog demo
function HandlerCatalogDemo() {
  const { t } = useTranslation();
  return (
    <Card className="w-[700px]" data-testid="handler-catalog-demo">
      <CardHeader>
        <CardTitle>{t('ssotHandlers.story.ssotHandlerCatalog', 'SSOT Handler Catalog')}</CardTitle>
        <CardDescription>
          {handlerCatalog.length} MSW handler modules for API mocking
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {handlerCatalog.map((handler, index) => (
              <div
                key={handler.name}
                className="bg-muted rounded-lg p-3"
                data-testid={`handler-${index}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <code className="font-mono text-sm font-medium">{handler.name}</code>
                  <div className="flex gap-1">
                    {handler.endpoints.map((ep) => (
                      <Badge key={ep} variant="outline" className="font-mono text-xs">
                        {ep}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {handler.exports.map((exp) => (
                    <code key={exp} className="bg-background rounded px-1.5 py-0.5 text-xs">
                      {exp}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Status handlers demo
function StatusHandlersDemo() {
  return (
    <Card className="w-[700px]" data-testid="status-handlers-demo">
      <CardHeader>
        <CardTitle>
          {i18n.t('ssotHandlers.story.statushandlersStructure', 'StatusHandlers Structure')}
        </CardTitle>
        <CardDescription>{i18n.t('ssotHandlers.story.statusHandlersDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[350px] pr-4">
          <div className="grid gap-2">
            {statusHandlerStructure.map((status) => (
              <div
                key={status.name}
                className="bg-muted flex items-center justify-between rounded-lg p-2"
                data-testid={`status-${status.name}`}
              >
                <div>
                  <code className="font-mono text-xs">.{status.name}</code>
                  <p className="text-muted-foreground text-xs">{status.description}</p>
                </div>
                <Badge
                  variant={(() => {
                    if (status.status.startsWith('2')) return 'default';
                    if (status.status.startsWith('4')) return 'secondary';
                    if (status.status.startsWith('5')) return 'destructive';
                    return 'outline';
                  })()}
                  className="text-xs"
                >
                  {status.status}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Usage demo
function HandlerUsageDemo() {
  return (
    <Card className="w-[700px]" data-testid="handler-usage-demo">
      <CardHeader>
        <CardTitle>
          {i18n.t('ssotHandlers.story.handlerUsagePatterns', 'Handler Usage Patterns')}
        </CardTitle>
        <CardDescription>
          {i18n.t(
            'ssotHandlers.story.howToUseMswHandlersInYourStories',
            'How to use MSW handlers in your stories'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="mb-2 text-xs font-medium">
            {i18n.t('ssotHandlers.story.defaultSuccessHandlers', 'Default success handlers')}
          </p>
          <pre className="overflow-x-auto text-xs">
            {[
              "import { userHandlers } from '@/.storybook/stories/_handlers';",
              '',
              'export const Default: Story = {',
              '  parameters: {',
              '    msw: { handlers: userHandlers },',
              '  },',
              '};',
            ].join('\n')}
          </pre>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="mb-2 text-xs font-medium">Status-specific handlers</p>
          <pre className="overflow-x-auto text-xs">
            {[
              "import { userStatusHandlers } from '@/.storybook/stories/_handlers';",
              '',
              'export const Loading: Story = {',
              '  parameters: {',
              '    msw: { handlers: userStatusHandlers.loading },',
              '  },',
              '};',
              '',
              'export const Error500: Story = {',
              '  parameters: {',
              '    msw: { handlers: userStatusHandlers.internalServerError },',
              '  },',
              '};',
            ].join('\n')}
          </pre>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="mb-2 text-xs font-medium">
            {i18n.t('ssotHandlers.story.combinedHandlers', 'Combined handlers')}
          </p>
          <pre className="overflow-x-auto text-xs">
            {[
              "import { allHandlers } from '@/.storybook/stories/_handlers';",
              '',
              '// In preview.tsx',
              'export const parameters = {',
              '  msw: { handlers: allHandlers },',
              '};',
            ].join('\n')}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Combined demo
function HandlersCatalogTabs() {
  return (
    <div className="w-[750px]" data-testid="handlers-catalog">
      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="catalog">
            {i18n.t('ssotHandlers.story.catalog', 'Catalog')}
          </TabsTrigger>
          <TabsTrigger value="status">
            {i18n.t('ssotHandlers.story.statusHandlers', 'Status Handlers')}
          </TabsTrigger>
          <TabsTrigger value="usage">{i18n.t('ssotHandlers.story.usage', 'Usage')}</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="mt-4">
          <HandlerCatalogDemo />
        </TabsContent>
        <TabsContent value="status" className="mt-4">
          <StatusHandlersDemo />
        </TabsContent>
        <TabsContent value="usage" className="mt-4">
          <HandlerUsageDemo />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Wrapper for meta
function SsotHandlersWrapper() {
  return <HandlersCatalogTabs />;
}

const meta = {
  title: 'Documentation/SSOT Handlers',
  component: SsotHandlersWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## SSOT Handler Catalog

${handlerCatalog.length} MSW handler modules for comprehensive API mocking.

### Handler Types

| Export | Purpose |
|--------|---------|
| \`*Handlers\` | Default success handlers |
| \`*StatusHandlers\` | All HTTP status scenarios |
| \`allHandlers\` | Combined success handlers |

### StatusHandlers Structure

Each StatusHandlers object provides:
- success, loading, slowResponse
- emptyData, emptyHistory
- badRequest (400), unauthorized (401), forbidden (403)
- notFound (404), tooManyRequests (429)
- internalServerError (500), badGateway (502)
- serviceUnavailable (503), gatewayTimeout (504)
- networkError

### Usage

\`\`\`tsx
import { userHandlers, userStatusHandlers } from '@/.storybook/stories/_handlers';

// Success story
parameters: { msw: { handlers: userHandlers } }

// Error story
parameters: { msw: { handlers: userStatusHandlers.unauthorized } }
\`\`\`
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof SsotHandlersWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <HandlersCatalogTabs />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify catalog is rendered
    expect(canvas.getByTestId('handlers-catalog')).toBeInTheDocument();

    // Verify handler catalog tab is shown
    expect(canvas.getByTestId('handler-catalog-demo')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Catalog: Story = {
  render: () => <HandlerCatalogDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('handler-catalog-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('handler-0')).toBeInTheDocument();
  },
};

export const StatusHandlers: Story = {
  render: () => <StatusHandlersDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('status-handlers-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('status-success')).toBeInTheDocument();
    expect(canvas.getByTestId('status-unauthorized')).toBeInTheDocument();
  },
};

export const UsagePatterns: Story = {
  render: () => <HandlerUsageDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('handler-usage-demo')).toBeInTheDocument();
  },
};

export const AllSections: Story = {
  render: () => (
    <div className="space-y-6">
      <HandlerCatalogDemo />
      <StatusHandlersDemo />
      <HandlerUsageDemo />
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

export const Japanese: Story = {
  ...Default,
  globals: {
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerCount: Story = {
  render: () => <HandlerCatalogDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusStructure: Story = {
  render: () => <StatusHandlersDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const UsageGuide: Story = {
  render: () => <HandlerUsageDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('ssotHandlers.storyName.accessibility', 'Accessibility'),
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
  name: i18n.t('ssotHandlers.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('ssotHandlers.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('ssotHandlers.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('ssotHandlers.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
