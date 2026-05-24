import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { useState } from 'react';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import { useTranslation } from 'react-i18next';
import { Briefcase, Sparkles, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  createFakeFormData,
  createFakeFormField,
} from '@/.storybook/stories/_factories/form.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// INTEREST OPTIONS
// ============================================================================

const interestOptions = [
  {
    name: i18n.t('onboardingFlow.story.interestTechnology', 'Technology'),
    key: 'technology',
    emoji: '💻',
  },
  { name: i18n.t('onboardingFlow.story.interestDesign', 'Design'), key: 'design', emoji: '🎨' },
  {
    name: i18n.t('onboardingFlow.story.interestMarketing', 'Marketing'),
    key: 'marketing',
    emoji: '📈',
  },
  { name: i18n.t('onboardingFlow.story.interestFinance', 'Finance'), key: 'finance', emoji: '💰' },
  {
    name: i18n.t('onboardingFlow.story.interestHealthcare', 'Healthcare'),
    key: 'healthcare',
    emoji: '🏥',
  },
  {
    name: i18n.t('onboardingFlow.story.interestEducation', 'Education'),
    key: 'education',
    emoji: '📚',
  },
  { name: i18n.t('onboardingFlow.story.interestSports', 'Sports'), key: 'sports', emoji: '⚽' },
  { name: i18n.t('onboardingFlow.story.interestTravel', 'Travel'), key: 'travel', emoji: '✈️' },
  { name: i18n.t('onboardingFlow.story.interestFood', 'Food'), key: 'food', emoji: '🍕' },
  { name: i18n.t('onboardingFlow.story.interestMusic', 'Music'), key: 'music', emoji: '🎵' },
  { name: i18n.t('onboardingFlow.story.interestArt', 'Art'), key: 'art', emoji: '🖼️' },
  {
    name: i18n.t('onboardingFlow.story.interestPhotography', 'Photography'),
    key: 'photography',
    emoji: '📸',
  },
  { name: i18n.t('onboardingFlow.story.interestWriting', 'Writing'), key: 'writing', emoji: '✍️' },
  { name: i18n.t('onboardingFlow.story.interestGaming', 'Gaming'), key: 'gaming', emoji: '🎮' },
  { name: i18n.t('onboardingFlow.story.interestFitness', 'Fitness'), key: 'fitness', emoji: '💪' },
  { name: i18n.t('onboardingFlow.story.interestFashion', 'Fashion'), key: 'fashion', emoji: '👗' },
];

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function InterestsStepDemo() {
  const { t } = useTranslation();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    i18n.t('onboardingFlow.story.interestTechnology', 'Technology'),
    i18n.t('onboardingFlow.story.interestDesign', 'Design'),
  ]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  return (
    <div className="mx-auto max-w-3xl p-4 lg:pt-10">
      <div className="space-y-8">
        <div className="flex gap-3">
          <div className="bg-primary flex size-8 items-center justify-center rounded-full">
            <Sparkles className="text-primary-foreground size-4" />
          </div>
          <h1 className="text-2xl font-bold">
            {t('onboardingFlow.story.whatSparksInterest', 'What sparks your interest?')}
          </h1>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {interestOptions.map((interest) => (
              <div
                className={`hover:border-primary cursor-pointer rounded-md border px-4 py-6 ${
                  selectedInterests.includes(interest.name) ? 'bg-primary/10 border-primary' : ''
                }`}
                key={interest.name}
                onClick={() => toggleInterest(interest.name)}
              >
                <div className="space-y-2 text-center">
                  <div className="text-2xl">{interest.emoji}</div>
                  <div>{t(`onboardingFlow.story.interest.${interest.key}`, interest.name)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-end">
          <Button disabled={selectedInterests.length === 0} size="lg">
            {t('onboardingFlow.story.continueSelected', 'Continue ({{count}} selected)', {
              count: selectedInterests.length,
            })}
          </Button>
        </div>
      </div>
    </div>
  );
}

function WorkPreferencesStepDemo() {
  const { t } = useTranslation();
  const [workStyle, setWorkStyle] = useState('');

  const workStyles = [
    {
      id: 'remote',
      label: t('onboardingFlow.story.remote', 'Remote'),
      description: t('onboardingFlow.story.remoteDesc', 'Work from anywhere'),
    },
    {
      id: 'hybrid',
      label: t('onboardingFlow.story.hybrid', 'Hybrid'),
      description: t('onboardingFlow.story.hybridDesc', 'Mix of office and remote'),
    },
    {
      id: 'onsite',
      label: t('onboardingFlow.story.onSite', 'On-site'),
      description: t('onboardingFlow.story.onSiteDesc', 'Work at the office'),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl p-4 lg:pt-10">
      <div className="space-y-8">
        <div className="flex gap-3">
          <div className="bg-primary flex size-8 items-center justify-center rounded-full">
            <Briefcase className="text-primary-foreground size-4" />
          </div>
          <h1 className="text-2xl font-bold">
            {t('onboardingFlow.story.workPreferences', 'What are your work preferences?')}
          </h1>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            {t('onboardingFlow.story.workStyle', 'Work Style')}
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {workStyles.map((style) => (
              <Card
                className={`cursor-pointer p-4 ${workStyle === style.id ? 'border-primary bg-primary/10' : ''}`}
                key={style.id}
                onClick={() => setWorkStyle(style.id)}
              >
                <div className="text-center">
                  <div className="font-medium">{style.label}</div>
                  <div className="text-muted-foreground text-sm">{style.description}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline">{t('onboardingFlow.story.back', 'Back')}</Button>
          <Button disabled={!workStyle} size="lg">
            {t('onboardingFlow.story.continue', 'Continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AccountTypeStepDemo() {
  const { t } = useTranslation();
  const [accountType, setAccountType] = useState('');

  const accountTypes = [
    {
      id: 'individual',
      label: t('onboardingFlow.story.individual', 'Individual'),
      description: t('onboardingFlow.story.individualDesc', 'For personal use'),
    },
    {
      id: 'team',
      label: t('onboardingFlow.story.team', 'Team'),
      description: t('onboardingFlow.story.teamDesc', 'For small teams'),
    },
    {
      id: 'enterprise',
      label: t('onboardingFlow.story.enterprise', 'Enterprise'),
      description: t('onboardingFlow.story.enterpriseDesc', 'For large organizations'),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl p-4 lg:pt-10">
      <div className="space-y-8">
        <div className="flex gap-3">
          <div className="bg-primary flex size-8 items-center justify-center rounded-full">
            <User className="text-primary-foreground size-4" />
          </div>
          <h1 className="text-2xl font-bold">
            {t('onboardingFlow.story.chooseAccountType', 'Choose your account type')}
          </h1>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {accountTypes.map((type) => (
            <Card
              className={`cursor-pointer p-6 ${accountType === type.id ? 'border-primary bg-primary/10' : ''}`}
              key={type.id}
              onClick={() => setAccountType(type.id)}
            >
              <div className="text-center">
                <div className="text-lg font-medium">{type.label}</div>
                <div className="text-muted-foreground text-sm">{type.description}</div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-between">
          <Button variant="outline">{t('onboardingFlow.story.back', 'Back')}</Button>
          <Button disabled={!accountType} size="lg">
            {t('onboardingFlow.story.finishSetup', 'Finish Setup')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OnboardingFlowDemo() {
  const [step, setStep] = useState(0);

  const steps = [
    <InterestsStepDemo key="interests" />,
    <WorkPreferencesStepDemo key="work" />,
    <AccountTypeStepDemo key="account" />,
  ];

  return (
    <div className="h-[90vh] overflow-auto">
      <div className="mx-auto mb-4 flex max-w-3xl justify-center gap-2 pt-4">
        {[0, 1, 2].map((i) => (
          <button
            className={`h-2 w-16 rounded-full ${i === step ? 'bg-primary' : 'bg-muted'}`}
            key={i}
            onClick={() => setStep(i)}
          />
        ))}
      </div>
      {steps[step]}
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Onboarding/Onboarding Flow',
  component: OnboardingFlowDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...buttonHandlers, ...formHandlers] },
    docs: {
      description: {
        component:
          'Onboarding Flow - A step-by-step onboarding process with Interests, Work Preferences, and Account Type steps. Uses a store for state management.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof OnboardingFlowDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('onboardingFlow.storyName.default', 'Full Flow'),
  render: () => <OnboardingFlowDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const InterestsStep: Story = {
  name: i18n.t('onboardingFlow.storyName.interestsStep', 'Step 1: Interests'),
  render: () => <InterestsStepDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const WorkPreferencesStep: Story = {
  name: i18n.t('onboardingFlow.storyName.workPreferencesStep', 'Step 2: Work Preferences'),
  render: () => <WorkPreferencesStepDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const AccountTypeStep: Story = {
  name: i18n.t('onboardingFlow.storyName.accountTypeStep', 'Step 3: Account Type'),
  render: () => <AccountTypeStepDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('onboardingFlow.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <OnboardingFlowDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('onboardingFlow.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <OnboardingFlowDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('onboardingFlow.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <OnboardingFlowDemo />
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

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Created: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.created', 'Handler: created'),
  parameters: { msw: { handlers: formStatusHandlers.created } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: formStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: formStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: formStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'onboardingFlow.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: formStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: formStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PayloadTooLarge: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.payloadTooLarge', 'Handler: payloadTooLarge'),
  parameters: { msw: { handlers: formStatusHandlers.payloadTooLarge } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: formStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: formStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'onboardingFlow.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: formStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: formStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'onboardingFlow.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: formStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: formStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: formStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowSubmission: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.slowSubmission', 'Handler: slowSubmission'),
  parameters: { msw: { handlers: formStatusHandlers.slowSubmission } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: formStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: formStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: formStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OtpExpired: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.otpExpired', 'Handler: otpExpired'),
  parameters: { msw: { handlers: formStatusHandlers.otpExpired } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OtpMaxAttempts: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.otpMaxAttempts', 'Handler: otpMaxAttempts'),
  parameters: { msw: { handlers: formStatusHandlers.otpMaxAttempts } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmailTaken: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.emailTaken', 'Handler: emailTaken'),
  parameters: { msw: { handlers: formStatusHandlers.emailTaken } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmailAvailable: Story = {
  ...Default,
  name: i18n.t('onboardingFlow.storyName.emailAvailable', 'Handler: emailAvailable'),
  parameters: { msw: { handlers: formStatusHandlers.emailAvailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY DATA STORY
// ============================================================================

function FactoryDataDemo() {
  const { t } = useTranslation();
  const formField = createFakeFormField();
  const formData = createFakeFormData();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ formField, formData }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('onboardingFlow.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
