import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { Edit2, Plus } from 'lucide-react';

import {
  settingsHandlers,
  settingsStatusHandlers,
} from '@/.storybook/stories/_handlers/settings.handlers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import {
  createFakeInvoice,
  createFakeInvoices,
} from '@/.storybook/stories/_factories/table.factory';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Mock transaction data
type TransactionStatus = 'failed' | 'paid' | 'pending';

interface Transaction {
  amount: string;
  date: string;
  id: string;
  product: string;
  status: TransactionStatus;
}

const transactions: Transaction[] = [
  {
    id: '#36223',
    product: i18n.t('settingsBilling.story.mockPremiumPack', 'Mock premium pack'),
    status: 'pending',
    date: '12/10/2025',
    amount: '$39.90',
  },
  {
    id: '#34283',
    product: i18n.t(
      'settingsBilling.story.enterprisePlanSubscription',
      'Enterprise plan subscription'
    ),
    status: 'paid',
    date: '11/13/2025',
    amount: '$159.90',
  },
  {
    id: '#32234',
    product: i18n.t('settingsBilling.story.businessBoardProLicense', 'Business board pro license'),
    status: 'paid',
    date: '10/13/2025',
    amount: '$89.90',
  },
  {
    id: '#31354',
    product: i18n.t('settingsBilling.story.customIntegrationPackage', 'Custom integration package'),
    status: 'failed',
    date: '09/13/2025',
    amount: '$299.90',
  },
  {
    id: '#30254',
    product: i18n.t('settingsBilling.story.developerToolkitLicense', 'Developer toolkit license'),
    status: 'paid',
    date: '08/15/2025',
    amount: '$129.90',
  },
  {
    id: '#29876',
    product: i18n.t('settingsBilling.story.supportPackageRenewal', 'Support package renewal'),
    status: 'pending',
    date: '07/22/2025',
    amount: '$79.90',
  },
];

function getStatusVariant(status: TransactionStatus): 'destructive' | 'success' | 'warning' {
  if (status === 'paid') return 'success';
  if (status === 'failed') return 'destructive';
  return 'warning';
}

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function SettingsBillingDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="mx-auto max-w-(--breakpoint-lg)">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {t('settingsBilling.story.billing', 'Billing')}
          </h1>
          <p className="text-muted-foreground">
            {t('settingsBilling.story.manageBilling', 'Manage your billing and payment methods.')}
          </p>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('settingsBilling.story.billing', 'Billing')}</CardTitle>
              <CardDescription>
                {t(
                  'settingsBilling.story.billingMonthly',
                  'Billing monthly | Next payment on 02/09/2025 for'
                )}{' '}
                <span className="font-medium">$59.90</span>
              </CardDescription>
              <CardAction>
                <Button>{t('settingsBilling.story.changePlan', 'Change plan')}</Button>
              </CardAction>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settingsBilling.story.paymentMethod', 'Payment Method')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">
                      {t('settingsBilling.story.cardHolder0392', 'Carolyn Perkins •••• 0392')}
                    </div>
                    <Badge variant="info">{t('settingsBilling.story.primary', 'Primary')}</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {t('settingsBilling.story.expiredDec2025', 'Expired Dec 2025')}
                  </p>
                </div>
                <Button size="icon" variant="outline">
                  <Edit2 />
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-2">
                  <div className="font-medium">
                    {t('settingsBilling.story.cardHolder8461', 'Carolyn Perkins •••• 8461')}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {t('settingsBilling.story.expiredJun2025', 'Expired Jun 2025')}
                  </p>
                </div>
                <Button size="icon" variant="outline">
                  <Edit2 />
                </Button>
              </div>

              <Button className="w-full" variant="outline">
                <Plus />
                {t('settingsBilling.story.addPaymentMethod', 'Add payment method')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {t('settingsBilling.story.transactionHistory', 'Transaction History')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('settingsBilling.story.reference', 'Reference')}</TableHead>
                    <TableHead>{t('settingsBilling.story.product', 'Product')}</TableHead>
                    <TableHead>{t('settingsBilling.story.status', 'Status')}</TableHead>
                    <TableHead>{t('settingsBilling.story.date', 'Date')}</TableHead>
                    <TableHead className="text-right">
                      {t('settingsBilling.story.amount', 'Amount')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">{transaction.id}</TableCell>
                      <TableCell>
                        {t(
                          `settingsBilling.story.product.${transaction.id.replace('#', '')}`,
                          transaction.product
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(transaction.status)}>
                          {t(
                            `settingsBilling.story.status.${transaction.status}`,
                            transaction.status
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{transaction.date}</TableCell>
                      <TableCell className="text-right font-medium">{transaction.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PaymentMethodsDemo() {
  const { t } = useTranslation();

  return (
    <div className="max-w-lg p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('settingsBilling.story.paymentMethod', 'Payment Method')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="font-medium">
                  {t('settingsBilling.story.cardHolder0392', 'Carolyn Perkins •••• 0392')}
                </div>
                <Badge variant="info">{t('settingsBilling.story.primary', 'Primary')}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {t('settingsBilling.story.expiredDec2025', 'Expired Dec 2025')}
              </p>
            </div>
            <Button size="icon" variant="outline">
              <Edit2 />
            </Button>
          </div>
          <Button className="w-full" variant="outline">
            <Plus />
            {t('settingsBilling.story.addPaymentMethod', 'Add payment method')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Settings/Billing',
  component: SettingsBillingDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...settingsHandlers, ...buttonHandlers] },
    docs: {
      description: {
        component:
          'Settings Billing Page - Billing management with current plan info, payment methods (primary card, add new), and transaction history table with status badges.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof SettingsBillingDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('settingsBilling.storyName.default', 'Full Page'),
  render: () => <SettingsBillingDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const PaymentMethods: Story = {
  name: i18n.t('settingsBilling.storyName.paymentMethods', 'Payment Methods'),
  render: () => <PaymentMethodsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('settingsBilling.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <SettingsBillingDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const PaymentMethodsDark: Story = {
  name: i18n.t('settingsBilling.storyName.paymentMethodsDark', 'Payment Methods Dark'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <PaymentMethodsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const TransactionTable: Story = {
  name: i18n.t('settingsBilling.storyName.transactionTable', 'Transaction Table'),
  render: () => <SettingsBillingDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Verify table headers are present
    expect(
      canvas.getByText(i18n.t('settingsBilling.story.reference', 'Reference'))
    ).toBeInTheDocument();
    expect(
      canvas.getByText(i18n.t('settingsBilling.story.product', 'Product'))
    ).toBeInTheDocument();
    expect(canvas.getByText(i18n.t('settingsBilling.story.status', 'Status'))).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  name: i18n.t('settingsBilling.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <SettingsBillingDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('settingsBilling.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <SettingsBillingDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('settingsBilling.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('settingsBilling.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('settingsBilling.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('settingsBilling.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('settingsBilling.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: settingsStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('settingsBilling.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: settingsStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('settingsBilling.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: settingsStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('settingsBilling.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: settingsStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'settingsBilling.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: settingsStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'settingsBilling.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: settingsStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'settingsBilling.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: settingsStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('settingsBilling.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: settingsStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('settingsBilling.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: settingsStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('settingsBilling.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: settingsStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('settingsBilling.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: settingsStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const invoice = createFakeInvoice();
  const invoices = createFakeInvoices(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ invoice, invoices }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('settingsBilling.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
