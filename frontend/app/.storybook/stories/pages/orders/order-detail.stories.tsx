import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { badgeHandlers } from '@/.storybook/stories/_handlers/badge.handlers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { cardHandlers } from '@/.storybook/stories/_handlers/card.handlers';
import { progressHandlers } from '@/.storybook/stories/_handlers/progress.handlers';
import { tableHandlers, tableStatusHandlers } from '@/.storybook/stories/_handlers/table.handlers';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  EditIcon,
  Package,
  Pencil,
  Printer,
  Truck,
} from 'lucide-react';
import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createFakeInvoice, createFakeOrder } from '@/.storybook/stories/_factories/table.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets the icon component for a delivery status step
 * @param step - The step key
 * @param stepIndex - The index of the step
 * @param currentStepIndex - The index of the current active step
 * @returns The appropriate icon component
 */
function getDeliveryStatusIcon(
  step: string,
  stepIndex: number,
  currentStepIndex: number
): React.ReactNode {
  const iconClass = 'size-4 lg:size-5';

  if (stepIndex < currentStepIndex) {
    return <CheckCircle className={iconClass} />;
  }
  if (step === 'processing') {
    return <Package className={iconClass} />;
  }
  if (step === 'shipped' || step === 'out-for-delivery') {
    return <Truck className={iconClass} />;
  }
  return <CheckCircle2 className={iconClass} />;
}

type OrderStatus = 'delivered' | 'out-for-delivery' | 'processing' | 'shipped';

interface Order {
  customer: {
    address: string;
    email: string;
    name: string;
  };
  date: string;
  id: string;
  items: {
    id: number;
    image: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  shipping: number;
  status: OrderStatus;
  subtotal: number;
  total: number;
}

// Mock order data
const mockOrder: Order = {
  id: i18n.t('orderDetail.story.orderId', 'ORD-12345'),
  date: '2025-04-15',
  status: 'shipped',
  customer: {
    name: i18n.t('orderDetail.story.customerName', 'Alice Johnson'),
    email: 'alice@example.com',
    address: '123 Main St, Anytown, AN 12345',
  },
  items: [
    {
      id: 1,
      name: i18n.t('orderDetail.story.wirelessHeadphones', 'Wireless Headphones'),
      image: '/images/products/01.jpeg',
      quantity: 2,
      price: 25.99,
    },
    {
      id: 2,
      name: i18n.t('orderDetail.story.bluetoothSpeaker', 'Bluetooth Speaker'),
      image: '/images/products/02.jpeg',
      quantity: 1,
      price: 49.99,
    },
  ],
  subtotal: 101.97,
  shipping: 10,
  total: 111.97,
};

const statusSteps: Record<OrderStatus, string> = {
  processing: i18n.t('orderDetail.story.processing', 'Processing'),
  shipped: i18n.t('orderDetail.story.shipped', 'Shipped'),
  'out-for-delivery': i18n.t('orderDetail.story.outForDelivery', 'Out for Delivery'),
  delivered: i18n.t('orderDetail.story.delivered', 'Delivered'),
};

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function OrderDetailDemo() {
  const { t } = useTranslation();

  const order = mockOrder;
  const currentStep = statusSteps[order.status];
  const currentStepIndex = Object.keys(statusSteps).indexOf(order.status);

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="mx-auto max-w-screen-lg space-y-4 lg:mt-10">
        <div className="flex items-center justify-between">
          <Button variant="outline">
            <ChevronLeft />
          </Button>
          <div className="flex gap-2">
            <Button variant="outline">
              <Printer />
              {t('orderDetail.story.print', 'Print')}
            </Button>
            <Button>
              <Pencil />
              {t('orderDetail.story.edit', 'Edit')}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                {t('orderDetail.story.orderLabel', 'Order')} {order.id}
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                {t('orderDetail.story.placedOn', 'Placed on')} {order.date}
              </p>
            </CardHeader>
            <CardContent>
              <Separator className="mb-4" />
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">
                    {t('orderDetail.story.customerInformation', 'Customer Information')}
                  </h3>
                  <p className="text-muted-foreground text-sm">{order.customer.name}</p>
                  <p className="text-muted-foreground text-sm">{order.customer.email}</p>
                  <p className="text-muted-foreground text-sm">{order.customer.address}</p>
                </div>
                <div className="bg-muted flex items-center justify-between space-y-2 rounded-md border p-4">
                  <div className="space-y-1">
                    <h4 className="font-medium">
                      {t('orderDetail.story.paymentMethod', 'Payment Method')}
                    </h4>
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <CreditCard className="size-4" />{' '}
                      {t('orderDetail.story.visaEnding', 'Visa ending in **** 1234')}
                    </div>
                  </div>
                  <Button variant="outline">
                    <EditIcon />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('orderDetail.story.orderSummary', 'Order Summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>{t('orderDetail.story.subtotal', 'Subtotal')}</span>
                <span>${order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('orderDetail.story.shipping', 'Shipping')}</span>
                <span>${order.shipping.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>{t('orderDetail.story.total', 'Total')}</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {t('orderDetail.story.deliveryStatusLabel', 'Delivery Status')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-6 pt-1">
              <div className="mb-2 flex items-center justify-between">
                {Object.keys(statusSteps).map((step) => {
                  const stepIndex = Object.keys(statusSteps).indexOf(step);
                  return (
                    <div className="text-center" key={`status-${step}`}>
                      <div
                        className={`mx-auto flex size-10 items-center justify-center rounded-full text-lg lg:size-12 ${stepIndex <= currentStepIndex ? 'bg-green-500 text-white dark:bg-green-900' : 'bg-muted border'} `}
                      >
                        {getDeliveryStatusIcon(step, stepIndex, currentStepIndex)}
                      </div>
                      <div className="mt-2 text-xs">{statusSteps[step as OrderStatus]}</div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-6">
                <Progress
                  className="w-full"
                  value={(currentStepIndex / (Object.keys(statusSteps).length - 1)) * 100}
                />
                <div className="text-muted-foreground text-xs">
                  <Badge className="me-1" variant="info">
                    {currentStep}
                  </Badge>{' '}
                  {t('orderDetail.story.onDecember232024', 'on December 23, 2024')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('orderDetail.story.orderItems', 'Order Items')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('orderDetail.story.product', 'Product')}</TableHead>
                  <TableHead className="text-center">
                    {t('orderDetail.story.quantity', 'Quantity')}
                  </TableHead>
                  <TableHead className="text-center">
                    {t('orderDetail.story.price', 'Price')}
                  </TableHead>
                  <TableHead className="text-end">
                    {t('orderDetail.story.total', 'Total')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <Image
                          alt=""
                          className="h-10 w-10 rounded-md lg:h-16 lg:w-16"
                          height={60}
                          src={item.image}
                          unoptimized
                          width={60}
                        />
                        <span>{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-center">${item.price.toFixed(2)}</TableCell>
                    <TableCell className="text-end">
                      ${(item.quantity * item.price).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DeliveryStatusDemo() {
  const currentStepIndex = 1; // Shipped

  return (
    <div className="max-w-2xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>{i18n.t('orderDetail.story.deliveryStatus', 'Delivery Status')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-6 pt-1">
            <div className="mb-2 flex items-center justify-between">
              {Object.keys(statusSteps).map((step) => {
                const stepIndex = Object.keys(statusSteps).indexOf(step);
                return (
                  <div className="text-center" key={`status-${step}`}>
                    <div
                      className={`mx-auto flex size-10 items-center justify-center rounded-full text-lg lg:size-12 ${stepIndex <= currentStepIndex ? 'bg-green-500 text-white dark:bg-green-900' : 'bg-muted border'} `}
                    >
                      {getDeliveryStatusIcon(step, stepIndex, currentStepIndex)}
                    </div>
                    <div className="mt-2 text-xs">{statusSteps[step as OrderStatus]}</div>
                  </div>
                );
              })}
            </div>
            <Progress
              className="w-full"
              value={(currentStepIndex / (Object.keys(statusSteps).length - 1)) * 100}
            />
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
  title: 'Pages/Orders/Order Detail',
  component: OrderDetailDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        ...badgeHandlers,
        ...buttonHandlers,
        ...cardHandlers,
        ...progressHandlers,
        ...tableHandlers,
      ],
    },
    docs: {
      description: {
        component:
          'Order Detail Page - View and track order details with customer information, order summary, delivery status progress, and order items table.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof OrderDetailDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('orderDetail.storyName.default', 'Full Page'),
  render: () => <OrderDetailDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const DeliveryStatus: Story = {
  name: i18n.t('orderDetail.storyName.deliveryStatus', 'Delivery Status'),
  render: () => <DeliveryStatusDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('orderDetail.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <OrderDetailDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('orderDetail.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <OrderDetailDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('orderDetail.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <OrderDetailDemo />
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
  name: i18n.t('orderDetail.storyName.created', 'Handler: created'),
  parameters: { msw: { handlers: tableStatusHandlers.created } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: tableStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: tableStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: tableStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: tableStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: tableStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'orderDetail.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: tableStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: tableStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'orderDetail.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: tableStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: tableStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: tableStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: tableStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: tableStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: tableStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: tableStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: tableStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PartialData: Story = {
  ...Default,
  name: i18n.t('orderDetail.storyName.partialData', 'Handler: partialData'),
  parameters: { msw: { handlers: tableStatusHandlers.partialData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY DATA STORY
// ============================================================================

function FactoryDataDemo() {
  const { t } = useTranslation();
  const order = createFakeOrder();
  const invoice = createFakeInvoice();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ order, invoice }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('orderDetail.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
