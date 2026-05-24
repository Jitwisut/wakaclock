import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { useState } from 'react';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { accordionHandlers } from '@/.storybook/stories/_handlers/accordion.handlers';
import { badgeHandlers } from '@/.storybook/stories/_handlers/badge.handlers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { cardHandlers } from '@/.storybook/stories/_handlers/card.handlers';
import { formHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import {
  pricingHandlers,
  pricingStatusHandlers,
} from '@/.storybook/stories/_handlers/pricing.handlers';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  createFakePricingCard,
  createFakePricingTable,
} from '@/.storybook/stories/_factories/card.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Mock pricing data
const pricingTiers = [
  {
    name: i18n.t('pricingColumn.story.tierBasic', 'Basic'),
    description: i18n.t('pricingColumn.story.tierBasicDesc', 'Essential features for individuals'),
    monthlyPrice: 9.99,
    yearlyPrice: 99.99,
    features: [
      i18n.t('pricingColumn.story.feature1User', '1 user'),
      i18n.t('pricingColumn.story.feature5GbStorage', '5GB storage'),
      i18n.t('pricingColumn.story.featureBasicSupport', 'Basic support'),
      i18n.t('pricingColumn.story.featureLimitedIntegrations', 'Limited integrations'),
    ],
  },
  {
    name: i18n.t('pricingColumn.story.tierPro', 'Pro'),
    description: i18n.t('pricingColumn.story.tierProDesc', 'Advanced features for professionals'),
    monthlyPrice: 19.99,
    yearlyPrice: 199.99,
    features: [
      i18n.t('pricingColumn.story.feature5Users', '5 users'),
      i18n.t('pricingColumn.story.feature50GbStorage', '50GB storage'),
      i18n.t('pricingColumn.story.featurePrioritySupport', 'Priority support'),
      i18n.t('pricingColumn.story.featureAdvancedIntegrations', 'Advanced integrations'),
      i18n.t('pricingColumn.story.featureAnalytics', 'Analytics'),
    ],
  },
  {
    name: i18n.t('pricingColumn.story.tierEnterprise', 'Enterprise'),
    description: i18n.t(
      'pricingColumn.story.tierEnterpriseDesc',
      'Comprehensive solution for teams'
    ),
    monthlyPrice: 49.99,
    yearlyPrice: 499.99,
    features: [
      i18n.t('pricingColumn.story.featureUnlimitedUsers', 'Unlimited users'),
      i18n.t('pricingColumn.story.feature500GbStorage', '500GB storage'),
      i18n.t('pricingColumn.story.feature247PremiumSupport', '24/7 premium support'),
      i18n.t('pricingColumn.story.featureCustomIntegrations', 'Custom integrations'),
      i18n.t('pricingColumn.story.featureAdvancedAnalytics', 'Advanced analytics'),
      i18n.t('pricingColumn.story.featureApiAccess', 'API access'),
    ],
  },
];

const faqs = [
  {
    question: i18n.t(
      'pricingColumn.story.faqPaymentMethodsQ',
      'What payment methods do you accept?'
    ),
    answer: i18n.t(
      'pricingColumn.story.faqPaymentMethodsA',
      'We accept all major credit cards, including Visa, MasterCard, American Express, and Discover. We also support PayPal for your convenience.'
    ),
  },
  {
    question: i18n.t('pricingColumn.story.faqCancelQ', 'Can I cancel my subscription at any time?'),
    answer: i18n.t(
      'pricingColumn.story.faqCancelA',
      "Yes, you can cancel your subscription at any time. If you cancel, you'll continue to have access to the platform until the end of your current billing period."
    ),
  },
  {
    question: i18n.t('pricingColumn.story.faqFreeTrialQ', 'Do you offer a free trial?'),
    answer: i18n.t(
      'pricingColumn.story.faqFreeTrialA',
      'We offer a 7-day free trial for new users. This allows you to explore our platform and content before committing to a subscription.'
    ),
  },
];

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

function calculateYearlySavings(monthlyPrice: number, yearlyPrice: number): string {
  const yearlyCost = monthlyPrice * 12;
  const savings = yearlyCost - yearlyPrice;
  const savingsPercentage = (savings / yearlyCost) * 100;
  return savingsPercentage.toFixed(0);
}

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function PricingColumnDemo() {
  const { t } = useTranslation();
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="mx-auto max-w-(--breakpoint-lg) lg:py-16">
        <div className="mb-6 flex flex-col items-start justify-between space-y-2 lg:flex-row lg:items-center">
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
            {t('pricingColumn.story.chooseYourPlan', 'Choose Your Plan')}
          </h1>
          <div className="flex items-start justify-center space-x-4 lg:items-center">
            <span className={`text-sm ${!isYearly ? 'font-bold' : ''}`}>
              {t('pricingColumn.story.monthly', 'Monthly')}
            </span>
            <Switch
              aria-label={t('pricingColumn.story.toggleYearlyPricing', 'Toggle yearly pricing')}
              checked={isYearly}
              onCheckedChange={setIsYearly}
            />
            <span className={`text-sm ${isYearly ? 'font-bold' : ''}`}>
              {t('pricingColumn.story.yearly', 'Yearly')}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {pricingTiers.map((tier) => (
            <Card className="relative flex flex-col" key={`tier-${tier.name}`}>
              <CardHeader>
                <CardTitle>{tier.name}</CardTitle>
                <CardDescription>
                  {t(`pricingColumn.story.tierDesc.${tier.name}`, tier.description)}
                </CardDescription>
              </CardHeader>
              <CardContent className="grow">
                <div className="mb-4">
                  <p className="font-display text-4xl">
                    {isYearly ? formatPrice(tier.yearlyPrice) : formatPrice(tier.monthlyPrice)}
                    <span className="text-sm font-normal">
                      /
                      {isYearly
                        ? t('pricingColumn.story.year', 'year')
                        : t('pricingColumn.story.month', 'month')}
                    </span>
                  </p>
                  {isYearly && (
                    <Badge className="absolute end-4 top-4" variant="success">
                      {t('pricingColumn.story.savePercent', 'Save {{percent}}%', {
                        percent: calculateYearlySavings(tier.monthlyPrice, tier.yearlyPrice),
                      })}
                    </Badge>
                  )}
                </div>
                <ul className="space-y-2">
                  {tier.features.map((feature) => (
                    <li className="flex items-center" key={`${tier.name}-${feature}`}>
                      <Check className="mr-2 h-4 w-4 text-green-500" />
                      <span>
                        {t(
                          `pricingColumn.story.feature.${feature.replaceAll(/[\s/]+/g, '_')}`,
                          feature
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full">
                  {t('pricingColumn.story.choosePlan', 'Choose {{name}}', { name: tier.name })}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-10 max-w-(--breakpoint-sm) space-y-10">
          <div>
            <h2 className="mb-4 text-xl font-semibold">
              {t('pricingColumn.story.frequentlyAskedQuestions', 'Frequently Asked Questions')}
            </h2>
            <Card>
              <CardContent>
                <Accordion className="w-full" collapsible type="single">
                  {faqs.map((faq, index) => (
                    <AccordionItem key={`faq-${faq.question}`} value={`faq-${faq.question}`}>
                      <AccordionTrigger>
                        {t(`pricingColumn.story.faq.q${index + 1}`, faq.question)}
                      </AccordionTrigger>
                      <AccordionContent>
                        {t(`pricingColumn.story.faq.a${index + 1}`, faq.answer)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingCardsDemo() {
  const { t } = useTranslation();
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-center space-x-4">
        <span className={`text-sm ${!isYearly ? 'font-bold' : ''}`}>
          {t('pricingColumn.story.monthly', 'Monthly')}
        </span>
        <Switch checked={isYearly} onCheckedChange={setIsYearly} />
        <span className={`text-sm ${isYearly ? 'font-bold' : ''}`}>
          {t('pricingColumn.story.yearly', 'Yearly')}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {pricingTiers.map((tier) => (
          <Card className="relative flex flex-col" key={`tier-${tier.name}`}>
            <CardHeader>
              <CardTitle>{tier.name}</CardTitle>
              <CardDescription>
                {t(`pricingColumn.story.tierDesc.${tier.name}`, tier.description)}
              </CardDescription>
            </CardHeader>
            <CardContent className="grow">
              <div className="mb-4">
                <p className="font-display text-4xl">
                  {isYearly ? formatPrice(tier.yearlyPrice) : formatPrice(tier.monthlyPrice)}
                  <span className="text-sm font-normal">
                    /
                    {isYearly
                      ? t('pricingColumn.story.year', 'year')
                      : t('pricingColumn.story.month', 'month')}
                  </span>
                </p>
              </div>
              <ul className="space-y-2">
                {tier.features.map((feature) => (
                  <li className="flex items-center" key={`${tier.name}-${feature}`}>
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    <span>
                      {t(
                        `pricingColumn.story.feature.${feature.replaceAll(/[\s/]+/g, '_')}`,
                        feature
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full">
                {t('pricingColumn.story.choosePlan', 'Choose {{name}}', { name: tier.name })}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Pricing/Pricing Column',
  component: PricingColumnDemo,
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
        ...pricingHandlers,
        ...switchHandlers,
      ],
    },
    docs: {
      description: {
        component:
          'Pricing Column Page - A 3-column pricing layout with Basic, Pro, and Enterprise tiers, monthly/yearly toggle, feature lists, and FAQ accordion.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof PricingColumnDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('pricingColumn.storyName.default', 'Full Page'),
  render: () => <PricingColumnDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const PricingCards: Story = {
  name: i18n.t('pricingColumn.storyName.pricingCards', 'Pricing Cards'),
  render: () => <PricingCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('pricingColumn.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <PricingColumnDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('pricingColumn.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <PricingColumnDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('pricingColumn.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <PricingColumnDemo />
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

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: pricingStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: pricingStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: pricingStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: pricingStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: pricingStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'pricingColumn.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: pricingStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: pricingStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'pricingColumn.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: pricingStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: pricingStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'pricingColumn.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: pricingStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: pricingStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: pricingStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: pricingStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: pricingStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PlansSuccess: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.plansSuccess', 'Handler: plansSuccess'),
  parameters: { msw: { handlers: pricingStatusHandlers.plansSuccess } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PlansEmpty: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.plansEmpty', 'Handler: plansEmpty'),
  parameters: { msw: { handlers: pricingStatusHandlers.plansEmpty } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PlansError: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.plansError', 'Handler: plansError'),
  parameters: { msw: { handlers: pricingStatusHandlers.plansError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const CheckoutSuccess: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.checkoutSuccess', 'Handler: checkoutSuccess'),
  parameters: { msw: { handlers: pricingStatusHandlers.checkoutSuccess } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const CheckoutFailed: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.checkoutFailed', 'Handler: checkoutFailed'),
  parameters: { msw: { handlers: pricingStatusHandlers.checkoutFailed } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PaymentRequired: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.paymentRequired', 'Handler: paymentRequired'),
  parameters: { msw: { handlers: pricingStatusHandlers.paymentRequired } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SubscriptionCancelled: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.subscriptionCancelled', 'Handler: subscriptionCancelled'),
  parameters: { msw: { handlers: pricingStatusHandlers.subscriptionCancelled } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SubscriptionUpgraded: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.subscriptionUpgraded', 'Handler: subscriptionUpgraded'),
  parameters: { msw: { handlers: pricingStatusHandlers.subscriptionUpgraded } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SubscriptionDowngraded: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.subscriptionDowngraded', 'Handler: subscriptionDowngraded'),
  parameters: { msw: { handlers: pricingStatusHandlers.subscriptionDowngraded } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const CouponValid: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.couponValid', 'Handler: couponValid'),
  parameters: { msw: { handlers: pricingStatusHandlers.couponValid } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const CouponInvalid: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.couponInvalid', 'Handler: couponInvalid'),
  parameters: { msw: { handlers: pricingStatusHandlers.couponInvalid } },
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
  const pricingTable = createFakePricingTable();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ pricingCard, pricingTable }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('pricingColumn.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerPricingSuccess: Story = {
  ...Default,
  name: i18n.t('pricingColumn.storyName.handlerPricingSuccess', 'Handler: Pricing Success'),
  parameters: { msw: { handlers: pricingStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
