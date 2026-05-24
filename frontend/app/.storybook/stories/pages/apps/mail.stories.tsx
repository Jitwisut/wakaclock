import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  appsMailHandlers,
  appsMailStatusHandlers,
} from '@/.storybook/stories/_handlers/apps-mail.handlers';
import {
  createFakeTableData,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';

import { Mail } from '@/app/dashboard/(auth)/apps/mail/components/mail';
import { accounts, mails } from '@/app/dashboard/(auth)/apps/mail/data';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function MailAppDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex h-[90vh] flex-col p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('mail.story.mail', 'Mail')}</h1>
        <p className="text-muted-foreground text-sm">
          {t('mail.story.organizeIncomingOutgoing', 'Organize incoming and outgoing mail')}
        </p>
      </div>
      <div className="h-full rounded-md border">
        <Mail
          accounts={accounts}
          defaultCollapsed={false}
          defaultLayout={[20, 32, 48]}
          mails={mails}
          navCollapsedSize={4}
        />
      </div>
    </div>
  );
}

function MailInterfaceDemo() {
  return (
    <div className="h-[85vh] rounded-md border">
      <Mail
        accounts={accounts}
        defaultCollapsed={false}
        defaultLayout={[20, 32, 48]}
        mails={mails}
        navCollapsedSize={4}
      />
    </div>
  );
}

function MailCollapsedDemo() {
  return (
    <div className="h-[85vh] rounded-md border">
      <Mail
        accounts={accounts}
        defaultCollapsed
        defaultLayout={[4, 40, 56]}
        mails={mails}
        navCollapsedSize={4}
      />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Apps/Mail',
  component: MailAppDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Mail App - Email client with resizable 3-panel layout (navigation, mail list, mail display), search, all/unread tabs, and responsive mobile views.',
      },
    },
    msw: {
      handlers: appsMailHandlers,
    },
  },
  argTypes: {},
} satisfies Meta<typeof MailAppDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('mail.storyName.default', 'Full App'),
  render: () => <MailAppDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify page renders with heading
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const MailInterface: Story = {
  name: i18n.t('mail.storyName.mailInterface', 'Mail Interface'),
  render: () => <MailInterfaceDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const CollapsedNav: Story = {
  name: i18n.t('mail.storyName.collapsedNav', 'Collapsed Navigation'),
  render: () => <MailCollapsedDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('mail.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <MailAppDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('mail.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <MailAppDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('mail.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <MailAppDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('mail.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('mail.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('mail.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('mail.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('mail.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: appsMailStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('mail.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: appsMailStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('mail.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: appsMailStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('mail.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: appsMailStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('mail.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: appsMailStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('mail.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: appsMailStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('mail.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: appsMailStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('mail.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: appsMailStatusHandlers.emptyData } },
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
  name: i18n.t('mail.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('mail.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: appsMailStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
