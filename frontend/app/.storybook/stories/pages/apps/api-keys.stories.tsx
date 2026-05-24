import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  appsApiKeysHandlers,
  appsMiscStatusHandlers,
} from '@/.storybook/stories/_handlers/apps-misc.handlers';
import {
  createFakeTableData,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';

import ApiCallsCard from '@/app/dashboard/(auth)/apps/api-keys/api-calls-card';
import CreateApiKeyDialog from '@/app/dashboard/(auth)/apps/api-keys/create-api-key-dialog';
import ApiKeysDataTable from '@/app/dashboard/(auth)/apps/api-keys/datatable';
import FailedConversionsCard from '@/app/dashboard/(auth)/apps/api-keys/failed-conversions-card';
import SuccessfulConversionsCard from '@/app/dashboard/(auth)/apps/api-keys/successful-conversions-card';
import UpgradePlanCard from '@/app/dashboard/(auth)/apps/api-keys/upgrade-plan-card';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Mock data for stories
const mockApiKeys = [
  {
    id: 1,
    name: i18n.t('apiKeys.story.productionApiKey', 'Production API Key'),
    api_key: 'sk-prod-1234567890abcdef1234567890abcdef',
    created_at: '2025-01-15',
    expired_at: '2026-01-15',
    status: 'active' as const,
  },
  {
    id: 2,
    name: i18n.t('apiKeys.story.developmentApiKey', 'Development API Key'),
    api_key: 'sk-dev-abcdef1234567890abcdef1234567890',
    created_at: '2025-01-10',
    expired_at: '2025-07-10',
    status: 'active' as const,
  },
  {
    id: 3,
    name: i18n.t('apiKeys.story.testingApiKey', 'Testing API Key'),
    api_key: 'sk-test-9876543210fedcba9876543210fedcba',
    created_at: '2024-12-01',
    expired_at: '2025-01-01',
    status: 'expired' as const,
  },
  {
    id: 4,
    name: i18n.t('apiKeys.story.stagingApiKey', 'Staging API Key'),
    api_key: 'sk-stage-fedcba0987654321fedcba0987654321',
    created_at: '2025-01-20',
    expired_at: '2026-01-20',
    status: 'inactive' as const,
  },
];

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function ApiKeysAppDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('apiKeys.story.apiKeysManagement', 'Api Keys Management')}
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <UpgradePlanCard />
        <SuccessfulConversionsCard />
        <FailedConversionsCard />
        <ApiCallsCard />
      </div>
      <ApiKeysDataTable data={mockApiKeys} />
    </div>
  );
}

function StatsCardsDemo() {
  return (
    <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
      <UpgradePlanCard />
      <SuccessfulConversionsCard />
      <FailedConversionsCard />
      <ApiCallsCard />
    </div>
  );
}

function DataTableDemo() {
  return (
    <div className="max-w-6xl p-4">
      <ApiKeysDataTable data={mockApiKeys} />
    </div>
  );
}

function CreateDialogDemo() {
  return (
    <div className="flex items-center justify-center p-8">
      <CreateApiKeyDialog />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Apps/API Keys',
  component: ApiKeysAppDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'API Keys Management - Manage API keys with stats cards (upgrade plan, successful/failed conversions, API calls), sortable/filterable data table, and key creation dialog.',
      },
    },
    msw: {
      handlers: appsApiKeysHandlers,
    },
  },
  argTypes: {},
} satisfies Meta<typeof ApiKeysAppDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('apiKeys.storyName.default', 'Full App'),
  render: () => <ApiKeysAppDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const StatsCardsStory: Story = {
  name: i18n.t('apiKeys.storyName.statsCardsStory', 'Stats Cards'),
  render: () => <StatsCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const DataTableStory: Story = {
  name: i18n.t('apiKeys.storyName.dataTableStory', 'Data Table'),
  render: () => <DataTableDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const CreateDialogStory: Story = {
  name: i18n.t('apiKeys.storyName.createDialogStory', 'Create API Key Dialog'),
  render: () => <CreateDialogDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('apiKeys.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <ApiKeysAppDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('apiKeys.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <ApiKeysAppDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('apiKeys.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <ApiKeysAppDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('apiKeys.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('apiKeys.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('apiKeys.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('apiKeys.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('apiKeys.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('apiKeys.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('apiKeys.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('apiKeys.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('apiKeys.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('apiKeys.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('apiKeys.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('apiKeys.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.networkError } },
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
  name: i18n.t('apiKeys.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('apiKeys.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
