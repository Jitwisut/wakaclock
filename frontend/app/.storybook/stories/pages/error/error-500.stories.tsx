import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { emptyHandlers, emptyStatusHandlers } from '@/.storybook/stories/_handlers/empty.handlers';
import {
  createFakeEmptyState,
  createFakeErrorEmptyState,
} from '@/.storybook/stories/_factories/empty.factory';
import { useTranslation } from 'react-i18next';
import { ArrowRight, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function Error500Demo() {
  const { t } = useTranslation();

  return (
    <div className="from-background to-secondary/10 flex h-[90vh] flex-col items-center justify-center bg-gradient-to-b p-4">
      <div className="w-full max-w-3xl space-y-4 lg:space-y-8">
        <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-lg border border-red-600/10 bg-red-500/5 sm:h-80">
          <div className="absolute inset-0 grid grid-cols-10 grid-rows-10 opacity-10">
            {Array.from({ length: 100 }, (_, i) => i).map((cellId) => (
              <div
                className="border border-red-600/30"
                key={`error-grid-${cellId}`}
                style={{
                  opacity: Math.random() * 0.5 + 0.5,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 text-center">
            <div className="mb-4 text-8xl font-black tracking-tighter text-red-600 sm:text-9xl">
              500
            </div>
            <div className="text-foreground text-xl font-medium sm:text-2xl">
              {t('error500.story.serverError', 'Server Error')}
            </div>
          </div>

          <div className="from-background/80 absolute right-0 bottom-0 left-0 h-1/3 bg-gradient-to-t to-transparent" />
        </div>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button className="group" size="lg" variant="outline">
            <RefreshCw />
            {t('error500.story.tryAgain', 'Try Again')}
          </Button>
          <Button asChild className="group" size="lg" variant="outline">
            <a href="/">
              {t('error500.story.backToHome', 'Back to Home')}
              <ArrowRight />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Error500CompactDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="mb-4 text-6xl font-black tracking-tighter text-red-600">500</div>
      <div className="text-foreground mb-4 text-xl font-medium">
        {t('error500.story.serverError', 'Server Error')}
      </div>
      <p className="text-muted-foreground mb-6 text-center text-sm">
        {t(
          'pages.error.500.description',
          'Something went wrong on our end. Please try again later.'
        )}
      </p>
      <div className="flex gap-4">
        <Button variant="outline">
          <RefreshCw />
          {t('error500.story.tryAgain', 'Try Again')}
        </Button>
        <Button variant="outline">
          {t('error500.story.backToHome', 'Back to Home')}
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Error/500',
  component: Error500Demo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...buttonHandlers, ...emptyHandlers] },
    docs: {
      description: {
        component:
          'Error 500 Page - Internal server error page with large red "500" text, decorative grid background with red theme, gradient fade, and "Try Again" / "Back to Home" buttons.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof Error500Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('error500.storyName.default', 'Full Page'),
  render: () => <Error500Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('500')).toBeInTheDocument();
  },
};

export const Compact: Story = {
  name: i18n.t('error500.storyName.compact', 'Compact'),
  render: () => <Error500CompactDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('error500.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <Error500Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('error500.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <Error500Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('error500.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <Error500Demo />
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
  ...Default,
  name: i18n.t('error500.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('error500.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('error500.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('error500.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('error500.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: emptyStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('error500.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: emptyStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('error500.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: emptyStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('error500.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: emptyStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('error500.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: emptyStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('error500.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: emptyStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('error500.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: emptyStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('error500.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: emptyStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('error500.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: emptyStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('error500.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: emptyStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('error500.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: emptyStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('error500.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: emptyStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('error500.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: emptyStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('error500.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: emptyStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const emptyState = createFakeEmptyState();
  const errorState = createFakeErrorEmptyState();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ emptyState, errorState }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('error500.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
