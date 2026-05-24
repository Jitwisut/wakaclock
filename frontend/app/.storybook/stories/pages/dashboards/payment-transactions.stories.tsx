import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon, DownloadIcon } from 'lucide-react';

import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  createFakeTableRow,
  createFakeTransactions,
} from '@/.storybook/stories/_factories/table.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DATA
// ============================================================================

const transactions = [
  {
    id: 1,
    date: '16 Aug 2025',
    description: i18n.t(
      'paymentTransactions.story.txWithdrawalJPMorgan0440',
      'Withdrawal to JP Morgan Chase (0440)'
    ),
    status: i18n.t('paymentTransactions.story.statusCompleted', 'Completed'),
    amount: '-1,275.79 USD',
    type: 'withdrawal' as const,
  },
  {
    id: 2,
    date: '5 Aug 2025',
    description: i18n.t(
      'paymentTransactions.story.txWithdrawalCitibank2290',
      'Withdrawal to Citibank (2290)'
    ),
    status: i18n.t('paymentTransactions.story.statusCompleted', 'Completed'),
    amount: '-202.99 USD',
    type: 'withdrawal' as const,
  },
  {
    id: 3,
    date: '5 Aug 2025',
    description: i18n.t(
      'paymentTransactions.story.txWithdrawalBankOfAmerica3311',
      'Withdrawal to Bank of America (3311)'
    ),
    status: i18n.t('paymentTransactions.story.statusCompleted', 'Completed'),
    amount: '-1,272.30 USD',
    type: 'withdrawal' as const,
  },
  {
    id: 4,
    date: '4 Aug 2025',
    description: i18n.t('paymentTransactions.story.txPaymentFromPaddle', 'Payment from Paddle'),
    status: i18n.t('paymentTransactions.story.statusCompleted', 'Completed'),
    amount: '+5,651.56 USD',
    type: 'payment' as const,
  },
  {
    id: 5,
    date: '4 Aug 2025',
    description: i18n.t(
      'paymentTransactions.story.txWithdrawalHSBC5522',
      'Withdrawal to HSBC (5522)'
    ),
    status: i18n.t('paymentTransactions.story.statusCompleted', 'Completed'),
    amount: '-1,679.35 USD',
    type: 'withdrawal' as const,
  },
  {
    id: 6,
    date: '20 Aug 2025',
    description: i18n.t(
      'paymentTransactions.story.txWithdrawalJPMorgan1133',
      'Withdrawal to JP Morgan Chase (1133)'
    ),
    status: i18n.t('paymentTransactions.story.statusCompleted', 'Completed'),
    amount: '-3,420.00 USD',
    type: 'withdrawal' as const,
  },
  {
    id: 7,
    date: '18 Aug 2025',
    description: i18n.t('paymentTransactions.story.txPaymentFromStripe', 'Payment from Stripe'),
    status: i18n.t('paymentTransactions.story.statusCompleted', 'Completed'),
    amount: '+2,345.75 USD',
    type: 'payment' as const,
  },
];

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function PaymentTransactionsDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
          {t('pages.paymentTransactions.title', 'Transactions')}
        </h1>
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline">
            {t('pages.paymentTransactions.dateRange', 'Aug 1 - Aug 31, 2025')}
          </Button>
          <Button size="icon">
            <DownloadIcon />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="latest">
        <TabsList className="mb-2">
          <TabsTrigger value="latest">
            {t('pages.paymentTransactions.latest', 'Latest')}
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            {t('pages.paymentTransactions.upcoming', 'Upcoming')}
          </TabsTrigger>
        </TabsList>

        <Card className="p-0">
          <CardContent className="p-0">
            <TabsContent value="latest">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-6">
                      {t('pages.paymentTransactions.date', 'Date')}
                    </TableHead>
                    <TableHead>
                      {t('pages.paymentTransactions.description', 'Description')}
                    </TableHead>
                    <TableHead className="pe-6 text-right">
                      {t('pages.paymentTransactions.amount', 'Amount')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="w-36 ps-6">{tx.date}</TableCell>
                      <TableCell>
                        <div>
                          <div className="text-foreground font-medium">{tx.description}</div>
                          <div className="text-muted-foreground text-sm">
                            <Badge variant={tx.status === 'Completed' ? 'secondary' : 'outline'}>
                              {tx.status}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="pe-6">
                        <div className="flex items-center justify-end space-x-4">
                          <span
                            className={tx.type === 'payment' ? 'text-green-600' : 'text-red-400'}
                          >
                            {tx.amount}
                          </span>
                          <Button size="sm" variant="outline">
                            <ChevronRightIcon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="upcoming">
              <p className="text-muted-foreground px-4 py-4 text-center text-sm lg:py-10">
                {t('pages.paymentTransactions.noUpcoming', 'Nothing to see here right now.')}
              </p>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Dashboards/Payment Transactions',
  component: PaymentTransactionsDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...formHandlers] },
    docs: {
      description: {
        component:
          'Payment Transactions Page - Transaction list with date range filter, download button, tabs for latest/upcoming, and a table of payment and withdrawal records.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof PaymentTransactionsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('paymentTransactions.storyName.default', 'Full Page'),
  render: () => <PaymentTransactionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify page title and key elements
    expect(canvas.getByText('Transactions')).toBeInTheDocument();
    expect(canvas.getByRole('tab', { name: /latest/i })).toBeInTheDocument();
    expect(canvas.getByRole('tab', { name: /upcoming/i })).toBeInTheDocument();

    // Verify transaction rows
    expect(canvas.getByText('Payment from Paddle')).toBeInTheDocument();
    expect(canvas.getByText('+5,651.56 USD')).toBeInTheDocument();
  },
};

export const Dark: Story = {
  name: i18n.t('paymentTransactions.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <PaymentTransactionsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('paymentTransactions.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <PaymentTransactionsDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('paymentTransactions.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <PaymentTransactionsDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Created: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.created', 'Handler: created'),
  parameters: { msw: { handlers: formStatusHandlers.created } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: formStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: formStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: formStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'paymentTransactions.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: formStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: formStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PayloadTooLarge: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.payloadTooLarge', 'Handler: payloadTooLarge'),
  parameters: { msw: { handlers: formStatusHandlers.payloadTooLarge } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: formStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: formStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'paymentTransactions.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: formStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: formStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'paymentTransactions.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: formStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: formStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: formStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowSubmission: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.slowSubmission', 'Handler: slowSubmission'),
  parameters: { msw: { handlers: formStatusHandlers.slowSubmission } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: formStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: formStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: formStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OtpExpired: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.otpExpired', 'Handler: otpExpired'),
  parameters: { msw: { handlers: formStatusHandlers.otpExpired } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const OtpMaxAttempts: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.otpMaxAttempts', 'Handler: otpMaxAttempts'),
  parameters: { msw: { handlers: formStatusHandlers.otpMaxAttempts } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmailTaken: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.emailTaken', 'Handler: emailTaken'),
  parameters: { msw: { handlers: formStatusHandlers.emailTaken } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmailAvailable: Story = {
  ...Default,
  name: i18n.t('paymentTransactions.storyName.emailAvailable', 'Handler: emailAvailable'),
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
  const transactions = createFakeTransactions(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ tableRow, transactions }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('paymentTransactions.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
