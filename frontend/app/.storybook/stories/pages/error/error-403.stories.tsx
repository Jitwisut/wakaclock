import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { emptyHandlers, emptyStatusHandlers } from '@/.storybook/stories/_handlers/empty.handlers';
import {
  createFakeEmptyState,
  createFakeNoPermissionsEmptyState,
} from '@/.storybook/stories/_factories/empty.factory';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';

import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function Error403Demo() {
  const { t } = useTranslation();

  return (
    <div className="flex h-[90vh] items-center justify-center">
      <div className="text-center">
        <figure className="m-auto w-40 lg:w-60">
          <Image
            alt="403 Error"
            className="w-full"
            height={200}
            src="/403.svg"
            unoptimized
            width={300}
          />
        </figure>
        <div className="mt-6 space-y-4 lg:mt-8">
          <h1 className="text-3xl font-bold tracking-tight lg:text-5xl">
            {t('error403.story.noAuthorization', 'No Authorization')}
          </h1>
          <p className="text-muted-foreground">
            {t(
              'pages.error403.description',
              'You do not appear to have permission to access this page'
            )}
          </p>
        </div>
        <div className="mt-6 lg:mt-8">
          <Button size="lg">{t('error-403.story.goToHome', 'Go to home')}</Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Error/Error 403',
  component: Error403Demo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...buttonHandlers, ...emptyHandlers] },
    docs: {
      description: {
        component:
          'Error 403 Page - An unauthorized access error page with illustration, title, description, and home button.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof Error403Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('error403.storyName.default', 'Unauthorized'),
  render: () => <Error403Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('error403.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <Error403Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('error403.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <Error403Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('error403.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <Error403Demo />
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const Mobile: Story = {
  name: i18n.t('error403.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <Error403Demo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('error403.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('error403.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('error403.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('error403.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: emptyStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('error403.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: emptyStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('error403.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: emptyStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('error403.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: emptyStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('error403.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: emptyStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('error403.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: emptyStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('error403.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: emptyStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('error403.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: emptyStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('error403.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: emptyStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('error403.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: emptyStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('error403.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: emptyStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('error403.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: emptyStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('error403.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: emptyStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('error403.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: emptyStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const emptyState = createFakeEmptyState();
  const noPermissions = createFakeNoPermissionsEmptyState();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ emptyState, noPermissions }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('error403.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
