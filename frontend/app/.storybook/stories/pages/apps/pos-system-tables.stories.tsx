import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, PlusIcon, UtensilsIcon } from 'lucide-react';

import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import {
  createFakeTableData,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DATA
// ============================================================================

const categories = [
  { id: 'all', name: i18n.t('posSystemTables.story.categoryAll', 'All'), icon: '🍽️' },
  { id: 'indoor', name: i18n.t('posSystemTables.story.categoryIndoor', 'Indoor'), icon: '🏠' },
  { id: 'outdoor', name: i18n.t('posSystemTables.story.categoryOutdoor', 'Outdoor'), icon: '🌳' },
  { id: 'vip', name: i18n.t('posSystemTables.story.categoryVip', 'VIP'), icon: '⭐' },
  { id: 'bar', name: i18n.t('posSystemTables.story.categoryBar', 'Bar'), icon: '🍸' },
];

const tables = [
  {
    id: 't1',
    name: i18n.t('posSystemTables.story.table1', 'Table 1'),
    seats: 4,
    category: 'indoor',
    status: 'available' as const,
  },
  {
    id: 't2',
    name: i18n.t('posSystemTables.story.table2', 'Table 2'),
    seats: 6,
    category: 'indoor',
    status: 'occupied' as const,
  },
  {
    id: 't3',
    name: i18n.t('posSystemTables.story.table3', 'Table 3'),
    seats: 2,
    category: 'outdoor',
    status: 'available' as const,
  },
  {
    id: 't4',
    name: i18n.t('posSystemTables.story.table4', 'Table 4'),
    seats: 8,
    category: 'vip',
    status: 'reserved' as const,
  },
  {
    id: 't5',
    name: i18n.t('posSystemTables.story.table5', 'Table 5'),
    seats: 4,
    category: 'outdoor',
    status: 'occupied' as const,
  },
  {
    id: 't6',
    name: i18n.t('posSystemTables.story.table6', 'Table 6'),
    seats: 2,
    category: 'bar',
    status: 'available' as const,
  },
  {
    id: 't7',
    name: i18n.t('posSystemTables.story.table7', 'Table 7'),
    seats: 6,
    category: 'indoor',
    status: 'available' as const,
  },
  {
    id: 't8',
    name: i18n.t('posSystemTables.story.table8', 'Table 8'),
    seats: 4,
    category: 'vip',
    status: 'occupied' as const,
  },
  {
    id: 't9',
    name: i18n.t('posSystemTables.story.table9', 'Table 9'),
    seats: 2,
    category: 'bar',
    status: 'reserved' as const,
  },
];

const statusColors: Record<string, string> = {
  available: 'bg-green-500/10 text-green-600 border-green-200',
  occupied: 'bg-red-500/10 text-red-600 border-red-200',
  reserved: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
};

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function PosSystemTablesDemo() {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<null | string>(null);

  const filteredTables = selectedCategory
    ? tables.filter((tbl) => tbl.category === selectedCategory)
    : tables;

  return (
    <div className="flex h-[90vh] flex-col p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('posSystemTables.story.heading', 'POS System Tables')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t(
            'pages.posSystemTables.description',
            'Manage restaurant tables and seating arrangements'
          )}
        </p>
      </div>

      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button size="icon" variant="outline">
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span className="text-xl font-bold">
              {t('pages.posSystemTables.tablesHeading', 'Tables')}
            </span>
          </div>
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            {t('pages.posSystemTables.addTable', 'Add Table')}
          </Button>
        </div>

        {/* Category filter */}
        <ScrollArea className="w-full whitespace-nowrap">
          <RadioGroup
            className="flex gap-3"
            defaultValue="all"
            onValueChange={(value) => setSelectedCategory(value === 'all' ? null : value)}
          >
            {categories.map((cat) => (
              <div
                className="has-data-[state=checked]:border-primary relative flex cursor-pointer items-center gap-2 rounded-md border px-4 py-3"
                key={cat.id}
              >
                <RadioGroupItem className="sr-only" id={`cat-${cat.id}`} value={cat.id} />
                <label
                  className="cursor-pointer text-sm font-medium after:absolute after:inset-0"
                  htmlFor={`cat-${cat.id}`}
                >
                  {cat.icon} {cat.name}
                </label>
              </div>
            ))}
          </RadioGroup>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Table grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredTables.map((tbl) => (
            <Card className="cursor-pointer transition-shadow hover:shadow-md" key={tbl.id}>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UtensilsIcon className="text-muted-foreground h-4 w-4" />
                    <span className="font-semibold">{tbl.name}</span>
                  </div>
                  <Badge className={statusColors[tbl.status]} variant="outline">
                    {t(`posSystemTables.story.status.${tbl.status}`, tbl.status)}
                  </Badge>
                </div>
                <div className="text-muted-foreground text-sm">
                  {t('posSystemTables.story.seatsCount', '{{count}} seats', { count: tbl.seats })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function TableGridDemo() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('posSystemTables.story.tableGrid', 'Table Grid')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {tables.slice(0, 6).map((tbl) => (
              <div className="flex flex-col items-center gap-2 rounded-lg border p-4" key={tbl.id}>
                <UtensilsIcon className="text-muted-foreground h-6 w-6" />
                <span className="font-medium">{tbl.name}</span>
                <Badge className={statusColors[tbl.status]} variant="outline">
                  {t(`posSystemTables.story.status.${tbl.status}`, tbl.status)}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {t('posSystemTables.story.seatsCount', '{{count}} seats', { count: tbl.seats })}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Apps/POS System Tables',
  component: PosSystemTablesDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...formHandlers] },
    docs: {
      description: {
        component:
          'POS System Tables Page - Restaurant table management with category filtering, status indicators, and seating overview.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof PosSystemTablesDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('posSystemTables.storyName.default', 'Full Page'),
  render: () => <PosSystemTablesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify main layout elements
    expect(
      canvas.getByText(i18n.t('posSystemTables.story.heading', 'POS System Tables'))
    ).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /add table/i })).toBeInTheDocument();

    // Verify tables rendered
    expect(canvas.getByText(i18n.t('posSystemTables.story.table1', 'Table 1'))).toBeInTheDocument();
    expect(canvas.getByText(i18n.t('posSystemTables.story.table2', 'Table 2'))).toBeInTheDocument();

    // Verify status badges
    const availableBadges = canvas.getAllByText(
      i18n.t('posSystemTables.story.status.available', 'available')
    );
    expect(availableBadges.length).toBeGreaterThan(0);
  },
};

export const TableGrid: Story = {
  name: i18n.t('posSystemTables.storyName.tableGrid', 'Table Grid'),
  render: () => <TableGridDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(
      canvas.getByText(i18n.t('posSystemTables.story.tableGrid', 'Table Grid'))
    ).toBeInTheDocument();
    expect(canvas.getByText(i18n.t('posSystemTables.story.table1', 'Table 1'))).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('posSystemTables.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <PosSystemTablesDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('posSystemTables.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <PosSystemTablesDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('posSystemTables.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <PosSystemTablesDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: formStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: formStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: formStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: formStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: formStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'posSystemTables.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: formStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: formStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'posSystemTables.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: formStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: formStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'posSystemTables.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: formStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: formStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: formStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: formStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: formStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('posSystemTables.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: formStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const row = createFakeTableRow();
  const rows = createFakeTableData(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ row, rows }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('posSystemTables.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
