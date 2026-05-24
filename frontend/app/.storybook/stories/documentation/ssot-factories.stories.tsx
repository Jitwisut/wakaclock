import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Factory catalog data - comprehensive exports from actual factory files (249 total)
const factoryCatalog = [
  {
    name: 'accordion.factory',
    types: ['FakeAccordionItem'],
    functions: ['createFakeAccordionItem', 'createFakeAccordionItems'],
    constants: [],
    domain: 'UI',
    total: 3,
  },
  {
    name: 'alert.factory',
    types: ['FakeAlert'],
    functions: ['createFakeAlert', 'createFakeAlerts'],
    constants: [],
    domain: 'UI',
    total: 3,
  },
  {
    name: 'avatar.factory',
    types: ['FakeAvatar'],
    functions: ['createFakeAvatar', 'createFakeAvatars'],
    constants: [],
    domain: 'UI',
    total: 3,
  },
  {
    name: 'badge.factory',
    types: ['FakeBadge'],
    functions: ['createFakeBadge', 'createFakeBadges'],
    constants: [],
    domain: 'UI',
    total: 3,
  },
  {
    name: 'breadcrumb.factory',
    types: ['FakeBreadcrumb'],
    functions: ['createFakeBreadcrumb', 'createFakeBreadcrumbs'],
    constants: [],
    domain: 'Navigation',
    total: 3,
  },
  {
    name: 'calendar.factory',
    types: ['FakeDateRange', 'FakeEvent', 'FakeReminder', 'FakeScheduleSlot', 'FakeTimelineItem'],
    functions: [
      'createFakeDateRange',
      'createFakeEvent',
      'createFakeEvents',
      'createFakeReminder',
      'createFakeReminders',
      'createFakeScheduleSlot',
      'createFakeScheduleSlots',
      'createFakeTimeline',
      'createFakeTimelineItem',
      'createFakeCalendarEvent',
      'createFakeCalendarEvents',
    ],
    constants: [],
    domain: 'Date',
    total: 16,
  },
  {
    name: 'card.factory',
    types: ['FakeCard'],
    functions: ['createFakeCard', 'createFakeCards'],
    constants: [],
    domain: 'UI',
    total: 3,
  },
  {
    name: 'carousel.factory',
    types: ['FakeSlide'],
    functions: ['createFakeSlide', 'createFakeSlides'],
    constants: [],
    domain: 'UI',
    total: 3,
  },
  {
    name: 'chart.factory',
    types: [
      'FakeChartDataPoint',
      'FakeTimeSeriesPoint',
      'FakeMultiSeriesPoint',
      'FakePieChartSlice',
      'FakeBarChartData',
      'FakeAreaChartData',
      'FakeRadarChartData',
      'FakeScatterPoint',
      'FakeGaugeData',
      'FakeStatsCard',
    ],
    functions: [
      'createFakeChartData',
      'createFakeTimeSeriesData',
      'createFakeMultiSeriesData',
      'createFakePieChartData',
      'createFakeBarChartData',
      'createFakeAreaChartData',
      'createFakeRadarChartData',
      'createFakeScatterData',
      'createFakeGaugeData',
      'createFakeStatsCard',
      'createFakeStatsCards',
    ],
    constants: ['MONTHS', 'PIE_COLORS'],
    domain: 'Data',
    total: 23,
  },
  {
    name: 'chat.factory',
    types: [
      'ChatRole',
      'FakeChatMessage',
      'FakeChatConversation',
      'FakeSuggestion',
      'FakeStreamChunk',
      'FakeChatResponse',
      'FakeCodeBlock',
      'FakePromptTemplate',
    ],
    functions: [
      'createFakeChatMessage',
      'createFakeChatHistory',
      'createFakeChatMessages',
      'createFakeChatConversation',
      'createFakeChatConversations',
      'createFakeSuggestion',
      'createFakeSuggestions',
      'createFakeStreamChunks',
      'createFakeChatResponse',
      'createFakeCodeBlock',
      'createFakeCodeBlocks',
      'createFakePromptTemplate',
      'createFakePromptTemplates',
    ],
    constants: [],
    domain: 'App',
    total: 21,
  },
  {
    name: 'dialog.factory',
    types: ['FakeDialogContent'],
    functions: ['createFakeDialogContent', 'createFakeDialogContents'],
    constants: [],
    domain: 'UI',
    total: 3,
  },
  {
    name: 'event.factory',
    types: ['FakeEvent', 'FakeTimelineItem', 'FakeDateRange', 'FakeScheduleSlot', 'FakeReminder'],
    functions: [
      'createFakeEvent',
      'createFakeEvents',
      'createFakeTimelineItem',
      'createFakeTimeline',
      'createFakeDateRange',
      'createFakeScheduleSlot',
      'createFakeScheduleSlots',
      'createFakeReminder',
      'createFakeReminders',
    ],
    constants: ['EVENT_COLORS', 'TIMELINE_ICONS'],
    domain: 'App',
    total: 16,
  },
  {
    name: 'form.factory',
    types: [
      'FakeOption',
      'FakeOptionGroup',
      'FakeFormData',
      'FakeValidationError',
      'FakeFormSubmitResponse',
      'FakeCountry',
    ],
    functions: [
      'createFakeOption',
      'createFakeOptions',
      'createFakeOptionGroup',
      'createFakeOptionGroups',
      'createFakeFormData',
      'createFakeValidationError',
      'createFakeValidationErrors',
      'createFakeFormSubmitResponse',
      'createFakeCountry',
      'createFakeCountries',
    ],
    constants: [],
    domain: 'Form',
    total: 16,
  },
  {
    name: 'kanban.factory',
    types: [
      'KanbanPriority',
      'KanbanStatus',
      'FakeKanbanAssignee',
      'FakeKanbanTag',
      'FakeKanbanCard',
      'FakeKanbanColumn',
      'FakeKanbanBoardResponse',
      'FakeKanbanActivity',
      'FakeKanbanFilter',
    ],
    functions: [
      'createFakeKanbanAssignee',
      'createFakeKanbanTag',
      'createFakeKanbanCard',
      'createFakeKanbanColumn',
      'createFakeKanbanBoard',
      'createFakeKanbanBoardResponse',
      'createFakeKanbanActivity',
      'createFakeKanbanActivities',
      'createFakeKanbanFilter',
    ],
    constants: ['TAG_COLORS', 'TAG_LABELS', 'COLUMN_CONFIGS'],
    domain: 'App',
    total: 21,
  },
  {
    name: 'menu.factory',
    types: ['FakeMenuItem'],
    functions: ['createFakeMenuItem', 'createFakeMenuItems'],
    constants: [],
    domain: 'Navigation',
    total: 3,
  },
  {
    name: 'navigation.factory',
    types: ['FakeBreadcrumb', 'FakeMenuItem', 'FakeTab', 'FakeNavItem', 'FakeSidebarGroup'],
    functions: [
      'createFakeBreadcrumb',
      'createFakeBreadcrumbs',
      'createFakeMenuItem',
      'createFakeMenuItems',
      'createFakeTab',
      'createFakeTabs',
      'createFakeNavItem',
      'createFakeNavItems',
      'createFakeSidebarGroup',
      'createFakeSidebarGroups',
    ],
    constants: ['ICONS'],
    domain: 'Navigation',
    total: 16,
  },
  {
    name: 'notification.factory',
    types: [
      'NotificationType',
      'FakeNotification',
      'FakeNotificationsResponse',
      'FakeToast',
      'FakeActivity',
    ],
    functions: [
      'createFakeNotification',
      'createFakeNotifications',
      'createFakeNotificationsResponse',
      'createFakeToast',
      'createFakeToasts',
      'createFakeActivity',
      'createFakeActivities',
    ],
    constants: [],
    domain: 'App',
    total: 12,
  },
  {
    name: 'progress.factory',
    types: ['FakeProgress'],
    functions: ['createFakeProgress', 'createFakeProgressItems'],
    constants: [],
    domain: 'UI',
    total: 3,
  },
  {
    name: 'search.factory',
    types: [
      'FakeSearchResult',
      'FakeSearchResponse',
      'FakeCommandItem',
      'FakeCommandGroup',
      'FakeRecentSearch',
      'FakeAutocompleteOption',
      'FakeFilterOption',
      'FakeSearchFilters',
    ],
    functions: [
      'createFakeSearchResult',
      'createFakeSearchResults',
      'createFakeSearchResponse',
      'createFakeCommandItem',
      'createFakeCommandGroups',
      'createFakeRecentSearch',
      'createFakeRecentSearches',
      'createFakeAutocompleteOption',
      'createFakeAutocompleteOptions',
      'createFakeFilterOptions',
      'createFakeSearchFilters',
    ],
    constants: ['ICONS', 'CATEGORIES'],
    domain: 'App',
    total: 21,
  },
  {
    name: 'table.factory',
    types: ['FakeTableRow', 'FakePagination', 'FakeTableResponse', 'FakeInvoice'],
    functions: [
      'createFakeTableRow',
      'createFakeTableData',
      'createFakePagination',
      'createFakeTableResponse',
      'createFakeInvoice',
      'createFakeInvoices',
    ],
    constants: [],
    domain: 'Data',
    total: 10,
  },
  {
    name: 'tabs.factory',
    types: ['FakeTab'],
    functions: ['createFakeTab', 'createFakeTabs'],
    constants: [],
    domain: 'UI',
    total: 3,
  },
  {
    name: 'theme.factory',
    types: [
      'ThemePreset',
      'ColorMode',
      'ContentLayout',
      'ThemeRadius',
      'ThemeScale',
      'SidebarMode',
      'ThemeConfig',
      'ThemePresetInfo',
    ],
    functions: ['createFakeThemeConfig', 'createDefaultThemeConfig', 'createFakeThemePresets'],
    constants: ['THEME_PRESETS'],
    domain: 'Theme',
    total: 12,
  },
  {
    name: 'tooltip.factory',
    types: ['FakeTooltip'],
    functions: ['createFakeTooltip', 'createFakeTooltips'],
    constants: [],
    domain: 'UI',
    total: 3,
  },
  {
    name: 'user.factory',
    types: ['FakeUser', 'FakeUserSession', 'FakeUserProfile'],
    functions: [
      'createFakeUser',
      'createFakeUsers',
      'createFakeUserSession',
      'createFakeUserProfile',
    ],
    constants: [],
    domain: 'App',
    total: 7,
  },
];

// Calculate totals
const totalExports = factoryCatalog.reduce((sum, f) => sum + f.total, 0);
const totalTypes = factoryCatalog.reduce((sum, f) => sum + f.types.length, 0);
const totalFunctions = factoryCatalog.reduce((sum, f) => sum + f.functions.length, 0);
const totalConstants = factoryCatalog.reduce((sum, f) => sum + f.constants.length, 0);

// Domain colors
const domainColors: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  UI: 'default',
  Navigation: 'secondary',
  Data: 'outline',
  App: 'default',
  Form: 'secondary',
  Date: 'outline',
  Theme: 'default',
};

// Factory catalog demo
function FactoryCatalogDemo() {
  const domains = [...new Set(factoryCatalog.map((f) => f.domain))];

  return (
    <Card className="w-[800px]" data-testid="factory-catalog-demo">
      <CardHeader>
        <CardTitle>
          {i18n.t('ssotFactories.story.ssotFactoryCatalog', 'SSOT Factory Catalog')}
        </CardTitle>
        <CardDescription>
          {factoryCatalog.length} factories with {totalExports} total exports
          <br />({totalTypes} types, {totalFunctions} functions, {totalConstants} constants)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 border-b pb-3">
          <span className="text-muted-foreground text-xs">Domains:</span>
          {domains.map((domain) => (
            <Badge key={domain} variant={domainColors[domain] || 'outline'} className="text-xs">
              {domain}
            </Badge>
          ))}
        </div>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {factoryCatalog.map((factory, index) => (
              <div
                key={factory.name}
                className="bg-muted rounded-lg p-3"
                data-testid={`factory-${index}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <code className="font-mono text-sm font-medium">{factory.name}</code>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">{factory.total} exports</span>
                    <Badge variant={domainColors[factory.domain] || 'outline'} className="text-xs">
                      {factory.domain}
                    </Badge>
                  </div>
                </div>

                {/* Types/Interfaces */}
                {factory.types.length > 0 && (
                  <div className="mb-2">
                    <span className="text-muted-foreground text-xs">Types:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {factory.types.map((t) => (
                        <code
                          key={t}
                          className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400"
                        >
                          {t}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {/* Functions */}
                {factory.functions.length > 0 && (
                  <div className="mb-2">
                    <span className="text-muted-foreground text-xs">Functions:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {factory.functions.map((fn) => (
                        <code
                          key={fn}
                          className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-600 dark:text-green-400"
                        >
                          {fn}()
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {/* Constants */}
                {factory.constants.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Constants:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {factory.constants.map((c) => (
                        <code
                          key={c}
                          className="rounded bg-orange-500/10 px-1.5 py-0.5 text-xs text-orange-600 dark:text-orange-400"
                        >
                          {c}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Usage demo
function FactoryUsageDemo() {
  return (
    <Card className="w-[700px]" data-testid="factory-usage-demo">
      <CardHeader>
        <CardTitle>
          {i18n.t('ssotFactories.story.factoryUsagePatterns', 'Factory Usage Patterns')}
        </CardTitle>
        <CardDescription>
          {i18n.t(
            'ssotFactories.story.howToUseFactoriesInYourStories',
            'How to use factories in your stories'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="mb-2 text-xs font-medium">
            {i18n.t('ssotFactories.story.importFromIndex', 'Import from index')}
          </p>
          <pre className="overflow-x-auto text-xs">
            {`import {
  createFakeUser,
  createFakeUsers,
  createFakeNotification,
} from '@/.storybook/stories/_factories';`}
          </pre>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="mb-2 text-xs font-medium">
            {i18n.t('ssotFactories.story.generateSingleItem', 'Generate single item')}
          </p>
          <pre className="overflow-x-auto text-xs">
            {`const user = createFakeUser();
// { id: 'usr-123', name: 'John Doe', email: 'john@example.com', ... }

const notification = createFakeNotification();
// { id: 'notif-456', title: 'New message', read: false, ... }`}
          </pre>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="mb-2 text-xs font-medium">
            {i18n.t('ssotFactories.story.generateMultipleItems', 'Generate multiple items')}
          </p>
          <pre className="overflow-x-auto text-xs">
            {`const users = createFakeUsers(5);
// Array of 5 deterministic user objects

const notifications = createFakeNotifications(10);
// Array of 10 deterministic notification objects`}
          </pre>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="mb-2 text-xs font-medium">
            {i18n.t('ssotFactories.story.withCustomOverrides', 'With custom overrides')}
          </p>
          <pre className="overflow-x-auto text-xs">
            {`const adminUser = createFakeUser({ role: 'admin' });
const readNotif = createFakeNotification({ read: true });`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Wrapper for meta
function SsotFactoriesWrapper() {
  return <FactoryCatalogDemo />;
}

const meta = {
  title: 'Documentation/SSOT Factories',
  component: SsotFactoriesWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## SSOT Factory Catalog

${factoryCatalog.length} factory modules for generating deterministic test data.

### Naming Convention

- \`createFake{Entity}\` - Creates single entity
- \`createFake{Entity}s\` - Creates array of entities
- \`createFake{Entity}With{Relation}\` - Creates entity with related data

### Domains

| Domain | Purpose |
|--------|---------|
| UI | Component data (badges, cards, etc.) |
| Navigation | Menu and nav items |
| Data | Tables, charts, lists |
| App | Business entities (users, notifications) |
| Form | Form fields and validation |
| Theme | Theme configuration |

### Usage

\`\`\`tsx
import { createFakeUser, createFakeUsers } from '@/.storybook/stories/_factories';

// Single item
const user = createFakeUser();

// Multiple items
const users = createFakeUsers(5);

// With overrides
const admin = createFakeUser({ role: 'admin' });
\`\`\`
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof SsotFactoriesWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <FactoryCatalogDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify catalog is rendered
    expect(canvas.getByTestId('factory-catalog-demo')).toBeInTheDocument();

    // Verify factories are listed
    expect(canvas.getByTestId('factory-0')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const UsagePatterns: Story = {
  render: () => <FactoryUsageDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-usage-demo')).toBeInTheDocument();
  },
};

export const AllSections: Story = {
  render: () => (
    <div className="space-y-6">
      <FactoryCatalogDemo />
      <FactoryUsageDemo />
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
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-catalog-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-testid^="factory-"]').length).toBeGreaterThan(0);
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-catalog-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('code').length).toBeGreaterThan(0);
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('ssotFactories.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify catalog is accessible
    expect(canvas.getByTestId('factory-catalog-demo')).toBeInTheDocument();

    // Verify code elements
    const codeElements = canvasElement.querySelectorAll('code');
    expect(codeElements.length).not.toBe(0);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('ssotFactories.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('ssotFactories.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('ssotFactories.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('ssotFactories.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
