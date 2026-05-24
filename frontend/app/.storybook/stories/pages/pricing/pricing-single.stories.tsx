import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { useState } from 'react';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { accordionHandlers } from '@/.storybook/stories/_handlers/accordion.handlers';
import { badgeHandlers } from '@/.storybook/stories/_handlers/badge.handlers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { cardHandlers } from '@/.storybook/stories/_handlers/card.handlers';
import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import { switchHandlers } from '@/.storybook/stories/_handlers/switch.handlers';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  createFakeCard,
  createFakePricingCard,
} from '@/.storybook/stories/_factories/card.factory';
import {
  createFakeFormData,
  createFakeFormField,
} from '@/.storybook/stories/_factories/form.factory';
// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Mock data
const features = [
  i18n.t('pricingSingle.story.featureUnlimitedAccess', 'Unlimited access to all courses'),
  i18n.t('pricingSingle.story.featurePersonalizedPaths', 'Personalized learning paths'),
  i18n.t('pricingSingle.story.featureProgressTracking', 'Progress tracking and analytics'),
  i18n.t('pricingSingle.story.featureOfflineViewing', 'Offline viewing on mobile app'),
  i18n.t('pricingSingle.story.featureCertificate', 'Certificate of completion'),
  i18n.t('pricingSingle.story.feature247Support', '24/7 customer support'),
];

const faqs = [
  {
    question: i18n.t(
      'pricingSingle.story.faqPaymentMethodsQ',
      'What payment methods do you accept?'
    ),
    answer: i18n.t(
      'pricingSingle.story.faqPaymentMethodsA',
      'We accept all major credit cards, including Visa, MasterCard, American Express, and Discover. We also support PayPal.'
    ),
  },
  {
    question: i18n.t('pricingSingle.story.faqCancelQ', 'Can I cancel my subscription at any time?'),
    answer: i18n.t(
      'pricingSingle.story.faqCancelA',
      "Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period."
    ),
  },
  {
    question: i18n.t('pricingSingle.story.faqFreeTrialQ', 'Do you offer a free trial?'),
    answer: i18n.t(
      'pricingSingle.story.faqFreeTrialA',
      'We offer a 7-day free trial for new users. No credit card is required for the trial.'
    ),
  },
];

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function PricingSingleDemo() {
  const { t } = useTranslation();
  const [isAnnual, setIsAnnual] = useState(false);

  const monthlyPrice = 14.99;
  const annualPrice = 149.99;
  const currentPrice = isAnnual ? annualPrice : monthlyPrice;
  const savings = (((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12)) * 100).toFixed(0);

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="lg:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 space-y-2 lg:mb-6">
            <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
              {t('pricingSingle.story.chooseYourLearningJourney', 'Choose Your Learning Journey')}
            </h1>
            <p className="text-muted-foreground">
              {t(
                'pages.pricing.unlockWorld',
                'Unlock a world of knowledge with our comprehensive e-learning platform'
              )}
            </p>
          </div>
          <Card>
            <CardContent className="relative">
              <div className="flex flex-col lg:flex-row">
                <div className="lg:w-2/3">
                  <h2 className="mb-2 text-2xl font-bold">
                    {t('pricingSingle.story.proPlan', 'Pro Plan')}
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    {t(
                      'pages.pricing.everythingYouNeed',
                      'Everything you need to master new skills'
                    )}
                  </p>

                  <div className="block space-y-4 lg:hidden">
                    <div>
                      <span className="text-4xl font-bold">${currentPrice}</span>
                      <span className="text-muted-foreground ml-2">
                        /
                        {isAnnual
                          ? t('pricingSingle.story.year', 'year')
                          : t('pricingSingle.story.month', 'month')}
                      </span>
                    </div>
                    <div className="mb-6 flex items-start justify-start space-x-4">
                      <span
                        className={`text-sm font-medium ${!isAnnual ? 'font-bold' : 'text-muted-foreground'}`}
                      >
                        {t('pricingSingle.story.monthly', 'Monthly')}
                      </span>
                      <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
                      <span
                        className={`text-sm font-medium ${isAnnual ? 'font-bold' : 'text-muted-foreground'}`}
                      >
                        {t('pricingSingle.story.annual', 'Annual')}
                      </span>
                    </div>
                  </div>

                  <ul className="mb-6 space-y-3">
                    {features.map((feature, index) => (
                      <li className="flex items-center" key={`feature-${feature}`}>
                        <Check className="mr-2 size-5 shrink-0 text-green-600" />
                        <span>{t(`pricingSingle.story.feature.f${index + 1}`, feature)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground text-sm">
                    {t(
                      'pages.pricing.guarantee',
                      'All subscriptions come with a 30-day money-back guarantee. Cancel anytime.'
                    )}
                  </p>
                </div>

                <div className="flex flex-col justify-center space-y-6 md:w-1/3 lg:relative lg:border-s lg:ps-6">
                  <div className="hidden space-y-4 lg:block">
                    <div className="text-center">
                      <span className="font-display text-4xl">${currentPrice}</span>
                      <span className="text-muted-foreground ml-2">
                        /
                        {isAnnual
                          ? t('pricingSingle.story.year', 'year')
                          : t('pricingSingle.story.month', 'month')}
                      </span>
                    </div>
                    <div className="mb-6 flex items-center justify-center space-x-4">
                      <span
                        className={`text-sm font-medium ${!isAnnual ? 'font-bold' : 'text-muted-foreground'}`}
                      >
                        {t('pricingSingle.story.monthly', 'Monthly')}
                      </span>
                      <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
                      <span
                        className={`text-sm font-medium ${isAnnual ? 'font-bold' : 'text-muted-foreground'}`}
                      >
                        {t('pricingSingle.story.annual', 'Annual')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 lg:mt-0">
                    <Button className="w-full">
                      {t('pricingSingle.story.startPlan', 'Start Plan')}
                    </Button>
                    {isAnnual && (
                      <Badge className="absolute end-4 top-2" variant="success">
                        {t('pricingSingle.story.savePercent', 'Save {{percent}}%', {
                          percent: savings,
                        })}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>
                {t('pricingSingle.story.frequentlyAskedQuestions', 'Frequently Asked Questions')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion className="w-full" collapsible type="single">
                {faqs.map((faq, index) => (
                  <AccordionItem key={`faq-${faq.question}`} value={`faq-${faq.question}`}>
                    <AccordionTrigger className="text-start">
                      {t(`pricingSingle.story.faq.q${index + 1}`, faq.question)}
                    </AccordionTrigger>
                    <AccordionContent>
                      {t(`pricingSingle.story.faq.a${index + 1}`, faq.answer)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SinglePlanCardDemo() {
  const { t } = useTranslation();
  const [isAnnual, setIsAnnual] = useState(false);
  const currentPrice = isAnnual ? 149.99 : 14.99;

  return (
    <div className="max-w-2xl p-4">
      <Card>
        <CardContent className="relative">
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-2/3">
              <h2 className="mb-2 text-2xl font-bold">
                {t('pricingSingle.story.proPlan', 'Pro Plan')}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t(
                  'pricingSingle.story.everythingYouNeedToMasterNewSkills',
                  'Everything you need to master new skills'
                )}
              </p>
              <ul className="mb-6 space-y-3">
                {features.map((feature, index) => (
                  <li className="flex items-center" key={`feature-${feature}`}>
                    <Check className="mr-2 size-5 shrink-0 text-green-600" />
                    <span>{t(`pricingSingle.story.feature.f${index + 1}`, feature)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-center space-y-6 md:w-1/3 lg:border-s lg:ps-6">
              <div className="text-center">
                <span className="font-display text-4xl">${currentPrice}</span>
                <span className="text-muted-foreground ml-2">
                  /
                  {isAnnual
                    ? t('pricingSingle.story.year', 'year')
                    : t('pricingSingle.story.month', 'month')}
                </span>
              </div>
              <div className="flex items-center justify-center space-x-4">
                <span className="text-sm">{t('pricingSingle.story.monthly', 'Monthly')}</span>
                <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
                <span className="text-sm">{t('pricingSingle.story.annual', 'Annual')}</span>
              </div>
              <Button className="w-full">{t('pricingSingle.story.startPlan', 'Start Plan')}</Button>
            </div>
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
  title: 'Pages/Pricing/Pricing Single',
  component: PricingSingleDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        ...accordionHandlers,
        ...badgeHandlers,
        ...buttonHandlers,
        ...cardHandlers,
        ...formHandlers,
        ...switchHandlers,
      ],
    },
    docs: {
      description: {
        component:
          'Pricing Single Page - A single Pro Plan pricing card with monthly/annual toggle, feature list, and FAQ accordion.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof PricingSingleDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('pricingSingle.storyName.default', 'Full Page'),
  render: () => <PricingSingleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const SinglePlanCard: Story = {
  name: i18n.t('pricingSingle.storyName.singlePlanCard', 'Single Plan Card'),
  render: () => <SinglePlanCardDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('pricingSingle.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <PricingSingleDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('pricingSingle.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <PricingSingleDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('pricingSingle.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <PricingSingleDemo />
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
  name: i18n.t('pricingSingle.storyName.created', 'Handler: created'),
  parameters: { msw: { handlers: formStatusHandlers.created } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: formStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: formStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: formStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'pricingSingle.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: formStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: formStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PayloadTooLarge: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.payloadTooLarge', 'Handler: payloadTooLarge'),
  parameters: { msw: { handlers: formStatusHandlers.payloadTooLarge } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: formStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: formStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'pricingSingle.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: formStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: formStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'pricingSingle.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: formStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: formStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: formStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowSubmission: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.slowSubmission', 'Handler: slowSubmission'),
  parameters: { msw: { handlers: formStatusHandlers.slowSubmission } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: formStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: formStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: formStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OtpExpired: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.otpExpired', 'Handler: otpExpired'),
  parameters: { msw: { handlers: formStatusHandlers.otpExpired } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OtpMaxAttempts: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.otpMaxAttempts', 'Handler: otpMaxAttempts'),
  parameters: { msw: { handlers: formStatusHandlers.otpMaxAttempts } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmailTaken: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.emailTaken', 'Handler: emailTaken'),
  parameters: { msw: { handlers: formStatusHandlers.emailTaken } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmailAvailable: Story = {
  ...Default,
  name: i18n.t('pricingSingle.storyName.emailAvailable', 'Handler: emailAvailable'),
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
  const pricingCard = createFakePricingCard();
  const card = createFakeCard();
  const formField = createFakeFormField();
  const formData = createFakeFormData();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ pricingCard, card, formField, formData }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('pricingSingle.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
