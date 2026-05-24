import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { expect, within } from 'storybook/test';
import { useState } from 'react';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { badgeHandlers } from '@/.storybook/stories/_handlers/badge.handlers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { cardHandlers } from '@/.storybook/stories/_handlers/card.handlers';
import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import { switchHandlers } from '@/.storybook/stories/_handlers/switch.handlers';
import { tableHandlers } from '@/.storybook/stories/_handlers/table.handlers';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createFakeTableData,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';
// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Mock pricing data
const pricingTiers = [
  {
    name: i18n.t('pricingTable.story.tierBasic', 'Basic'),
    monthlyPrice: 9.99,
    yearlyPrice: 99.99,
    features: {
      users: i18n.t('pricingTable.story.feature1User', '1 user'),
      storage: i18n.t('pricingTable.story.feature5GbStorage', '5GB storage'),
      support: i18n.t('pricingTable.story.featureBasicSupport', 'Basic support'),
      integrations: i18n.t('pricingTable.story.featureLimitedIntegrations', 'Limited integrations'),
      analytics: false,
      api: false,
    },
  },
  {
    name: i18n.t('pricingTable.story.tierPro', 'Pro'),
    monthlyPrice: 19.99,
    yearlyPrice: 199.99,
    features: {
      users: i18n.t('pricingTable.story.feature5Users', '5 users'),
      storage: i18n.t('pricingTable.story.feature50GbStorage', '50GB storage'),
      support: i18n.t('pricingTable.story.featurePrioritySupport', 'Priority support'),
      integrations: i18n.t(
        'pricingTable.story.featureAdvancedIntegrations',
        'Advanced integrations'
      ),
      analytics: true,
      api: false,
    },
  },
  {
    name: i18n.t('pricingTable.story.tierEnterprise', 'Enterprise'),
    monthlyPrice: 49.99,
    yearlyPrice: 499.99,
    features: {
      users: i18n.t('pricingTable.story.featureUnlimitedUsers', 'Unlimited users'),
      storage: i18n.t('pricingTable.story.feature500GbStorage', '500GB storage'),
      support: i18n.t('pricingTable.story.feature247PremiumSupport', '24/7 premium support'),
      integrations: i18n.t('pricingTable.story.featureCustomIntegrations', 'Custom integrations'),
      analytics: true,
      api: true,
    },
  },
];

function renderFeatureValue(value: boolean | string, translatedValue?: string): ReactNode {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="mx-auto text-green-500" />
    ) : (
      <X className="mx-auto text-red-500" />
    );
  }
  return translatedValue ?? value;
}

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

function PricingTableDemo() {
  const { t } = useTranslation();
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="mx-auto max-w-(--breakpoint-lg) lg:py-16">
        <div className="mb-6 flex flex-col items-start justify-between space-y-2 lg:flex-row lg:items-center">
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
            {t('pricingTable.story.chooseYourPlan', 'Choose Your Plan')}
          </h1>
          <div className="flex items-start justify-center space-x-4 lg:items-center">
            <span className={`text-sm ${!isYearly ? 'font-bold' : ''}`}>
              {t('pricingTable.story.monthly', 'Monthly')}
            </span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} />
            <span className={`text-sm ${isYearly ? 'font-bold' : ''}`}>
              {t('pricingTable.story.yearly', 'Yearly')}
            </span>
          </div>
        </div>

        <Card>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">
                      {t('pricingTable.story.features', 'Features')}
                    </TableHead>
                    {pricingTiers.map((tier) => (
                      <TableHead className="text-center" key={`header-${tier.name}`}>
                        {tier.name}
                        {isYearly && (
                          <Badge className="ms-2" variant="success">
                            {t('pricingTable.story.savePercent', 'Save {{percent}}%', {
                              percent: calculateYearlySavings(tier.monthlyPrice, tier.yearlyPrice),
                            })}
                          </Badge>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      {t('pricingTable.story.price', 'Price')}
                    </TableCell>
                    {pricingTiers.map((tier) => (
                      <TableCell className="text-center" key={`price-${tier.name}`}>
                        <div className="font-display text-2xl">
                          {isYearly
                            ? formatPrice(tier.yearlyPrice)
                            : formatPrice(tier.monthlyPrice)}
                          <span className="text-sm font-normal">
                            /
                            {isYearly
                              ? t('pricingTable.story.year', 'year')
                              : t('pricingTable.story.month', 'month')}
                          </span>
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                  {(
                    Object.keys(pricingTiers[0].features) as Array<
                      keyof (typeof pricingTiers)[0]['features']
                    >
                  ).map((feature) => (
                    <TableRow key={feature}>
                      <TableCell className="font-medium capitalize">
                        {t(`pricingTable.story.featureLabel.${feature}`, feature)}
                      </TableCell>
                      {pricingTiers.map((tier) => (
                        <TableCell className="text-center" key={`${feature}-${tier.name}`}>
                          {renderFeatureValue(
                            tier.features[feature],
                            typeof tier.features[feature] === 'string'
                              ? t(
                                  `pricingTable.story.featureValue.${tier.name}.${feature}`,
                                  tier.features[feature] as string
                                )
                              : undefined
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell />
                    {pricingTiers.map((tier) => (
                      <TableCell className="text-center" key={`button-${tier.name}`}>
                        <Button>
                          {t('pricingTable.story.choosePlan', 'Choose {{name}}', {
                            name: tier.name,
                          })}
                        </Button>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="my-6 lg:my-12">
          <h2 className="mb-4 text-xl font-semibold">
            {t('pricingTable.story.whyChooseOurPlatform', 'Why Choose Our Platform?')}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="gap-2">
              <CardHeader>
                <CardTitle className="lg:text-xl">
                  {t('pricingTable.story.comprehensiveLibrary', 'Comprehensive Library')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t(
                    'pricingTable.story.comprehensiveLibraryDesc',
                    'Access thousands of courses across various disciplines'
                  )}
                </p>
              </CardContent>
            </Card>
            <Card className="gap-2">
              <CardHeader>
                <CardTitle className="lg:text-xl">
                  {t('pricingTable.story.expertInstructors', 'Expert Instructors')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t(
                    'pricingTable.story.expertInstructorsDesc',
                    'Learn from industry professionals and thought leaders'
                  )}
                </p>
              </CardContent>
            </Card>
            <Card className="gap-2">
              <CardHeader>
                <CardTitle className="lg:text-xl">
                  {t('pricingTable.story.flexibleLearning', 'Flexible Learning')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t(
                    'pricingTable.story.flexibleLearningDesc',
                    'Study at your own pace, anytime and anywhere'
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonTableDemo() {
  const { t } = useTranslation();
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-center space-x-4">
        <span className={`text-sm ${!isYearly ? 'font-bold' : ''}`}>
          {t('pricingTable.story.monthly', 'Monthly')}
        </span>
        <Switch checked={isYearly} onCheckedChange={setIsYearly} />
        <span className={`text-sm ${isYearly ? 'font-bold' : ''}`}>
          {t('pricingTable.story.yearly', 'Yearly')}
        </span>
      </div>
      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">
                    {t('pricingTable.story.features', 'Features')}
                  </TableHead>
                  {pricingTiers.map((tier) => (
                    <TableHead className="text-center" key={`header-${tier.name}`}>
                      {tier.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">
                    {t('pricingTable.story.price', 'Price')}
                  </TableCell>
                  {pricingTiers.map((tier) => (
                    <TableCell className="text-center" key={`price-${tier.name}`}>
                      <div className="font-display text-2xl">
                        {isYearly ? formatPrice(tier.yearlyPrice) : formatPrice(tier.monthlyPrice)}
                        <span className="text-sm font-normal">
                          /
                          {isYearly
                            ? t('pricingTable.story.year', 'year')
                            : t('pricingTable.story.month', 'month')}
                        </span>
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
                {(
                  Object.keys(pricingTiers[0].features) as Array<
                    keyof (typeof pricingTiers)[0]['features']
                  >
                ).map((feature) => (
                  <TableRow key={feature}>
                    <TableCell className="font-medium capitalize">
                      {t(`pricingTable.story.featureLabel.${feature}`, feature)}
                    </TableCell>
                    {pricingTiers.map((tier) => (
                      <TableCell className="text-center" key={`${feature}-${tier.name}`}>
                        {renderFeatureValue(
                          tier.features[feature],
                          typeof tier.features[feature] === 'string'
                            ? t(
                                `pricingTable.story.featureValue.${tier.name}.${feature}`,
                                tier.features[feature] as string
                              )
                            : undefined
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
  title: 'Pages/Pricing/Pricing Table',
  component: PricingTableDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        ...badgeHandlers,
        ...buttonHandlers,
        ...cardHandlers,
        ...formHandlers,
        ...switchHandlers,
        ...tableHandlers,
      ],
    },
    docs: {
      description: {
        component:
          'Pricing Table Page - A comparison table layout showing Basic, Pro, and Enterprise tiers with feature checkmarks and monthly/yearly toggle.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof PricingTableDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('pricingTable.storyName.default', 'Full Page'),
  render: () => <PricingTableDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const ComparisonTable: Story = {
  name: i18n.t('pricingTable.storyName.comparisonTable', 'Comparison Table'),
  render: () => <ComparisonTableDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('pricingTable.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <PricingTableDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('pricingTable.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <PricingTableDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('pricingTable.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <PricingTableDemo />
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
  name: i18n.t('pricingTable.storyName.created', 'Handler: created'),
  parameters: { msw: { handlers: formStatusHandlers.created } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: formStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: formStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: formStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'pricingTable.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: formStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: formStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PayloadTooLarge: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.payloadTooLarge', 'Handler: payloadTooLarge'),
  parameters: { msw: { handlers: formStatusHandlers.payloadTooLarge } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: formStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: formStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'pricingTable.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: formStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: formStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: formStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: formStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: formStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowSubmission: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.slowSubmission', 'Handler: slowSubmission'),
  parameters: { msw: { handlers: formStatusHandlers.slowSubmission } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: formStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: formStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: formStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OtpExpired: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.otpExpired', 'Handler: otpExpired'),
  parameters: { msw: { handlers: formStatusHandlers.otpExpired } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OtpMaxAttempts: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.otpMaxAttempts', 'Handler: otpMaxAttempts'),
  parameters: { msw: { handlers: formStatusHandlers.otpMaxAttempts } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmailTaken: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.emailTaken', 'Handler: emailTaken'),
  parameters: { msw: { handlers: formStatusHandlers.emailTaken } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmailAvailable: Story = {
  ...Default,
  name: i18n.t('pricingTable.storyName.emailAvailable', 'Handler: emailAvailable'),
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
  name: i18n.t('pricingTable.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
