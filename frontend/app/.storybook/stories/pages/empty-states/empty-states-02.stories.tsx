import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import React from 'react';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { emptyHandlers, emptyStatusHandlers } from '@/.storybook/stories/_handlers/empty.handlers';
import {
  createFakeEmptyState,
  createFakeNoDataEmptyState,
} from '@/.storybook/stories/_factories/empty.factory';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarDays, ChevronRight, Megaphone, SquareTerminal } from 'lucide-react';

import { Card } from '@/components/ui/card';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// TEMPLATE CARD COMPONENT
// ============================================================================

interface TemplateCardProps {
  description: string;
  icon: React.ReactNode;
  iconBgColor: string;
  title: string;
}

function TemplateCard({ icon, iconBgColor, title, description }: TemplateCardProps) {
  return (
    <Card className="hover:bg-muted flex cursor-pointer flex-row items-center gap-4 p-4">
      <div className={`flex-shrink-0 rounded-full p-3 ${iconBgColor}`}>{icon}</div>
      <div className="flex-grow text-left">
        <h3 className="text-base font-medium">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <ChevronRight className="text-muted-foreground ml-auto size-4 shrink-0" />
    </Card>
  );
}

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function EmptyStates02Demo() {
  const { t } = useTranslation();

  return (
    <div className="flex h-[90vh] flex-col items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <header className="space-y-2">
          <h2 className="text-2xl font-bold">
            {t('emptyStates02.story.createFirstProject', 'Create your first project')}
          </h2>
          <p className="text-muted-foreground">
            {t(
              'pages.emptyStates.selectTemplate',
              'Start by selecting a template or begin with a blank canvas.'
            )}
          </p>
        </header>

        <div className="mt-8 space-y-4">
          <TemplateCard
            description={t(
              'pages.emptyStates.marketingDesc',
              'Plan and launch engaging campaigns to reach your audience.'
            )}
            icon={<Megaphone className="h-6 w-6 text-white" />}
            iconBgColor="bg-pink-500"
            title={t('emptyStates02.story.marketingCampaign', 'Marketing Campaign')}
          />
          <TemplateCard
            description={t(
              'pages.emptyStates.engineeringDesc',
              'Manage complex builds and bring your technical ideas to life.'
            )}
            icon={<SquareTerminal className="h-6 w-6 text-white" />}
            iconBgColor="bg-purple-500"
            title={t('emptyStates02.story.engineeringProject', 'Engineering Project')}
          />
          <TemplateCard
            description={t(
              'pages.emptyStates.eventDesc',
              'Organize and track events that matter — from meetups to conferences.'
            )}
            icon={<CalendarDays className="h-6 w-6 text-white" />}
            iconBgColor="bg-orange-500"
            title={t('emptyStates02.story.event', 'Event')}
          />
        </div>
        <div className="mt-8">
          <a
            className="text-primary inline-flex items-center text-sm font-medium hover:underline"
            href="/projects/new"
          >
            {t('emptyStates02.story.startFromEmpty', 'or start from an empty project')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

function TemplateCardsDemo() {
  const { t } = useTranslation();

  return (
    <div className="max-w-md space-y-4 p-4">
      <TemplateCard
        description={t(
          'pages.emptyStates.marketingDesc',
          'Plan and launch engaging campaigns to reach your audience.'
        )}
        icon={<Megaphone className="h-6 w-6 text-white" />}
        iconBgColor="bg-pink-500"
        title={t('emptyStates02.story.marketingCampaign', 'Marketing Campaign')}
      />
      <TemplateCard
        description={t(
          'pages.emptyStates.engineeringDesc',
          'Manage complex builds and bring your technical ideas to life.'
        )}
        icon={<SquareTerminal className="h-6 w-6 text-white" />}
        iconBgColor="bg-purple-500"
        title={t('emptyStates02.story.engineeringProject', 'Engineering Project')}
      />
      <TemplateCard
        description={t(
          'pages.emptyStates.eventDesc',
          'Organize and track events that matter — from meetups to conferences.'
        )}
        icon={<CalendarDays className="h-6 w-6 text-white" />}
        iconBgColor="bg-orange-500"
        title={t('emptyStates02.story.event', 'Event')}
      />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Empty States/Empty States 02',
  component: EmptyStates02Demo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...buttonHandlers, ...emptyHandlers] },
    docs: {
      description: {
        component:
          'Empty States 02 - An empty state with project template selection cards for Marketing Campaign, Engineering Project, and Event types.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof EmptyStates02Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('emptyStates02.storyName.default', 'Create Project'),
  render: () => <EmptyStates02Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 2 })).toBeInTheDocument();
  },
};

export const TemplateCards: Story = {
  name: i18n.t('emptyStates02.storyName.templateCards', 'Template Cards'),
  render: () => <TemplateCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('emptyStates02.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <EmptyStates02Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('emptyStates02.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <EmptyStates02Demo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('emptyStates02.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <EmptyStates02Demo />
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
  name: i18n.t('emptyStates02.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: emptyStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: emptyStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: emptyStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: emptyStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: emptyStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'emptyStates02.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: emptyStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: emptyStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'emptyStates02.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: emptyStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: emptyStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'emptyStates02.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: emptyStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: emptyStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: emptyStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: emptyStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('emptyStates02.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: emptyStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const emptyState = createFakeEmptyState();
  const noData = createFakeNoDataEmptyState();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ emptyState, noData }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('emptyStates02.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
