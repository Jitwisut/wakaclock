import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  dashboardFileManagerHandlers,
  dashboardFileManagerStatusHandlers,
} from '@/.storybook/stories/_handlers/dashboard-file-manager.handlers';
import { useTranslation } from 'react-i18next';

import {
  ChartFileTransfer,
  FileUploadDialog,
  FolderListCards,
  StorageStatusCard,
  SummaryCards,
  TableRecentFiles,
} from '@/app/dashboard/(auth)/file-manager/components';
import {
  createFakeTableData,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function FileManagerDashboardDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-4">
      <div className="mb-4 flex flex-row items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('fileManagerDashboard.story.title', 'File Manager')}
        </h1>
        <FileUploadDialog />
      </div>
      <SummaryCards />
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FolderListCards />
        </div>
        <StorageStatusCard />
      </div>
      <div className="gap-4 space-y-4 lg:grid lg:grid-cols-2 lg:space-y-0">
        <ChartFileTransfer />
        <TableRecentFiles />
      </div>
    </div>
  );
}

function SummaryCardsDemo() {
  return (
    <div className="max-w-6xl p-4">
      <SummaryCards />
    </div>
  );
}

function FolderListCardsDemo() {
  return (
    <div className="max-w-4xl p-4">
      <FolderListCards />
    </div>
  );
}

function StorageStatusCardDemo() {
  return (
    <div className="max-w-sm p-4">
      <StorageStatusCard />
    </div>
  );
}

function ChartFileTransferDemo() {
  return (
    <div className="max-w-2xl p-4">
      <ChartFileTransfer />
    </div>
  );
}

function TableRecentFilesDemo() {
  return (
    <div className="max-w-2xl p-4">
      <TableRecentFiles />
    </div>
  );
}

function FileUploadDialogDemo() {
  return (
    <div className="p-4">
      <FileUploadDialog />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/File Manager',
  component: FileManagerDashboardDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: dashboardFileManagerHandlers },
    docs: {
      description: {
        component:
          'File Manager Dashboard - File management system with storage monitoring, folder organization, file transfer analytics, and upload functionality.',
      },
    },
  },
  argTypes: {
    // No direct props - this is a page-level component
  },
} satisfies Meta<typeof FileManagerDashboardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

/**
 * The complete File Manager Dashboard page with all components.
 */
export const Default: Story = {
  name: i18n.t('fileManager.storyName.default', 'Full Dashboard'),
  render: () => <FileManagerDashboardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

/**
 * Summary Cards - File type statistics with usage progress.
 */
export const SummaryCardsStory: Story = {
  name: i18n.t('fileManager.storyName.summaryCardsStory', 'Summary Cards'),
  render: () => <SummaryCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Folder List Cards - Folder grid with actions and starring.
 */
export const FolderListCardsStory: Story = {
  name: i18n.t('fileManager.storyName.folderListCardsStory', 'Folder List Cards'),
  render: () => <FolderListCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Storage Status Card - Storage usage indicator with progress bar.
 */
export const StorageStatusCardStory: Story = {
  name: i18n.t('fileManager.storyName.storageStatusCardStory', 'Storage Status Card'),
  render: () => <StorageStatusCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Chart File Transfer - Monthly file transfer analytics.
 */
export const ChartFileTransferStory: Story = {
  name: i18n.t('fileManager.storyName.chartFileTransferStory', 'Chart File Transfer'),
  render: () => <ChartFileTransferDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Table Recent Files - Recently uploaded files list with actions.
 */
export const TableRecentFilesStory: Story = {
  name: i18n.t('fileManager.storyName.tableRecentFilesStory', 'Table Recent Files'),
  render: () => <TableRecentFilesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * File Upload Dialog - File upload modal trigger.
 */
export const FileUploadDialogStory: Story = {
  name: i18n.t('fileManager.storyName.fileUploadDialogStory', 'File Upload Dialog'),
  render: () => <FileUploadDialogDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * Dark mode variant of the dashboard.
 */
export const Dark: Story = {
  name: i18n.t('fileManager.storyName.dark', 'Dark Mode'),
  parameters: {
    themes: {
      themeOverride: 'dark',
    },
  },
  render: () => <FileManagerDashboardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

/**
 * Japanese locale variant.
 */
export const Japanese: Story = {
  name: i18n.t('fileManager.storyName.japanese', 'Japanese'),
  parameters: {
    locale: 'ja',
  },
  render: () => <FileManagerDashboardDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

/**
 * RTL layout variant.
 */
export const RTL: Story = {
  name: i18n.t('fileManager.storyName.rTL', 'RTL'),
  parameters: {
    direction: 'rtl',
  },
  render: () => (
    <div dir="rtl">
      <FileManagerDashboardDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('fileManager.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: dashboardFileManagerStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('fileManager.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: dashboardFileManagerStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('fileManager.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: dashboardFileManagerStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'fileManager.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: dashboardFileManagerStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'fileManager.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: dashboardFileManagerStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('fileManager.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: dashboardFileManagerStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('fileManager.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: dashboardFileManagerStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('fileManager.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: dashboardFileManagerStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StorageFull: Story = {
  ...Default,
  name: i18n.t('fileManager.storyName.storageFull', 'Handler: Storage Full'),
  parameters: { msw: { handlers: dashboardFileManagerStatusHandlers.storageFull } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY DATA STORY
// ============================================================================

function FactoryDataDemo() {
  const { t } = useTranslation();
  const tableRow = createFakeTableRow();
  const tableData = createFakeTableData(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ tableRow, tableData }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('fileManager.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('fileManager.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dashboardFileManagerStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
