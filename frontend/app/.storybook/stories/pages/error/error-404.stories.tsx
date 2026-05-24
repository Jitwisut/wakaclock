import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { emptyHandlers } from '@/.storybook/stories/_handlers/empty.handlers';
import { errorStatusHandlers } from '@/.storybook/stories/_handlers/error.handlers';
import {
  createFakeEmptyState,
  createFakeNoResultsEmptyState,
} from '@/.storybook/stories/_factories/empty.factory';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function Error404Demo() {
  const { t } = useTranslation();

  return (
    <div className="from-background to-secondary/10 flex h-[90vh] flex-col items-center justify-center bg-gradient-to-b p-4">
      <div className="w-full max-w-3xl space-y-4 lg:space-y-8">
        <div className="bg-primary/5 border-primary/10 relative flex h-64 items-center justify-center overflow-hidden rounded-lg border sm:h-80">
          <div className="absolute inset-0 grid grid-cols-10 grid-rows-10 opacity-10">
            {Array.from({ length: 100 }, (_, i) => i).map((cellId) => (
              <div
                className="border-primary/30 border"
                key={`grid-cell-${cellId}`}
                style={{
                  opacity: Math.random() * 0.5 + 0.5,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 text-center">
            <div className="text-primary mb-4 text-8xl font-black tracking-tighter sm:text-9xl">
              404
            </div>
            <div className="text-foreground text-xl font-medium sm:text-2xl">
              {t('error404.story.pageNotFound', 'Page Not Found')}
            </div>
          </div>

          <div className="from-background/80 absolute right-0 bottom-0 left-0 h-1/3 bg-gradient-to-t to-transparent" />
        </div>

        <div className="flex justify-center">
          <Button asChild className="group" size="lg" variant="outline">
            <a href="/">
              {t('error404.story.backToHome', 'Back to Home')}
              <ArrowRight />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Error404CompactDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="text-primary mb-4 text-6xl font-black tracking-tighter">404</div>
      <div className="text-foreground mb-4 text-xl font-medium">
        {t('error404.story.pageNotFound', 'Page Not Found')}
      </div>
      <p className="text-muted-foreground mb-6 text-center text-sm">
        {t(
          'pages.error.404.description',
          "The page you're looking for doesn't exist or has been moved."
        )}
      </p>
      <Button variant="outline">
        {t('error404.story.backToHome', 'Back to Home')}
        <ArrowRight />
      </Button>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Error/404',
  component: Error404Demo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...buttonHandlers, ...emptyHandlers] },
    docs: {
      description: {
        component:
          'Error 404 Page - Page not found error page with large "404" text, decorative grid background with random opacity cells, gradient fade, and "Back to Home" button.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof Error404Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('error404.storyName.default', 'Full Page'),
  render: () => <Error404Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('404')).toBeInTheDocument();
  },
};

export const Compact: Story = {
  name: i18n.t('error404.storyName.compact', 'Compact'),
  render: () => <Error404CompactDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('error404.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <Error404Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('error404.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <Error404Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('error404.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <Error404Demo />
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
  name: i18n.t('error404.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('error404.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('error404.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('error404.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// ERROR STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: errorStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// ERROR STATUS HANDLER STORIES (ADDITIONAL)
// ============================================================================

export const ErrorSuccess: Story = {
  ...Default,
  name: i18n.t('error404.storyName.errorSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: errorStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const Error404PageData: Story = {
  ...Default,
  name: i18n.t('error404.storyName.error404PageData', 'Handler: 404 Page Data'),
  parameters: { msw: { handlers: errorStatusHandlers.error404PageData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const Error500PageData: Story = {
  ...Default,
  name: i18n.t('error404.storyName.error500PageData', 'Handler: 500 Page Data'),
  parameters: { msw: { handlers: errorStatusHandlers.error500PageData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const ErrorFeedbackSuccess: Story = {
  ...Default,
  name: i18n.t('error404.storyName.errorFeedbackSuccess', 'Handler: Feedback Success'),
  parameters: { msw: { handlers: errorStatusHandlers.errorFeedbackSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const ErrorFeedbackFailed: Story = {
  ...Default,
  name: i18n.t('error404.storyName.errorFeedbackFailed', 'Handler: Feedback Failed'),
  parameters: { msw: { handlers: errorStatusHandlers.errorFeedbackFailed } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const ErrorLogSuccess: Story = {
  ...Default,
  name: i18n.t('error404.storyName.errorLogSuccess', 'Handler: Log Success'),
  parameters: { msw: { handlers: errorStatusHandlers.errorLogSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const ErrorLogFailed: Story = {
  ...Default,
  name: i18n.t('error404.storyName.errorLogFailed', 'Handler: Log Failed'),
  parameters: { msw: { handlers: errorStatusHandlers.errorLogFailed } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const ErrorMaintenanceMode: Story = {
  ...Default,
  name: i18n.t('error404.storyName.errorMaintenanceMode', 'Handler: Maintenance Mode'),
  parameters: { msw: { handlers: errorStatusHandlers.maintenanceMode } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const emptyState = createFakeEmptyState();
  const noResults = createFakeNoResultsEmptyState();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ emptyState, noResults }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('error404.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
