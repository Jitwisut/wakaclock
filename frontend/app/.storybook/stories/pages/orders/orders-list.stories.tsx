import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { badgeHandlers } from '@/.storybook/stories/_handlers/badge.handlers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { tableHandlers, tableStatusHandlers } from '@/.storybook/stories/_handlers/table.handlers';
import { tabsHandlers } from '@/.storybook/stories/_handlers/tabs.handlers';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@radix-ui/react-icons';
import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  createFakeOrders,
  createFakeTableData,
} from '@/.storybook/stories/_factories/table.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Mock orders data
const mockOrders = [
  {
    id: 12_342,
    customer: {
      name: i18n.t('ordersList.story.customerLiamJohnson', 'Liam Johnson'),
      email: 'liam@example.com',
    },
    price: '$200',
    type: i18n.t('ordersList.story.typeSale', 'Sale'),
    status: 'pending',
    date: i18n.t('ordersList.story.dateJun23', 'Jun 23, 2023'),
    image: '/images/products/01.jpeg',
    product_name: i18n.t('ordersList.story.productWirelessHeadphones', 'Wireless Headphones'),
  },
  {
    id: 24_342,
    customer: {
      name: i18n.t('ordersList.story.customerEmmaBrown', 'Emma Brown'),
      email: 'emma@example.com',
    },
    price: '$150',
    type: i18n.t('ordersList.story.typeSale', 'Sale'),
    status: 'completed',
    date: i18n.t('ordersList.story.dateJul11', 'Jul 11, 2023'),
    image: '/images/products/02.jpeg',
    product_name: i18n.t('ordersList.story.productBluetoothSpeaker', 'Bluetooth Speaker'),
  },
  {
    id: 32_183,
    customer: {
      name: i18n.t('ordersList.story.customerNoahWilliams', 'Noah Williams'),
      email: 'noah@example.com',
    },
    price: '$250',
    type: i18n.t('ordersList.story.typeReturn', 'Return'),
    status: 'pending',
    date: i18n.t('ordersList.story.dateAug03', 'Aug 03, 2023'),
    image: '/images/products/03.jpeg',
    product_name: i18n.t('ordersList.story.productSmartwatch', 'Smartwatch'),
  },
  {
    id: 45_542,
    customer: {
      name: i18n.t('ordersList.story.customerOliviaGarcia', 'Olivia Garcia'),
      email: 'olivia@example.com',
    },
    price: '$320',
    type: i18n.t('ordersList.story.typeSale', 'Sale'),
    status: 'shipped',
    date: i18n.t('ordersList.story.dateSep15', 'Sep 15, 2023'),
    image: '/images/products/04.jpeg',
    product_name: i18n.t('ordersList.story.productLaptopStand', 'Laptop Stand'),
  },
  {
    id: 54_345,
    customer: {
      name: i18n.t('ordersList.story.customerElijahJones', 'Elijah Jones'),
      email: 'elijah@example.com',
    },
    price: '$80',
    type: i18n.t('ordersList.story.typeSale', 'Sale'),
    status: 'delivered',
    date: i18n.t('ordersList.story.dateOct09', 'Oct 09, 2023'),
    image: '/images/products/05.jpeg',
    product_name: i18n.t('ordersList.story.productPortableCharger', 'Portable Charger'),
  },
];

// Status variant helper
function getStatusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' {
  if (status === 'completed' || status === 'delivered') return 'success';
  if (status === 'shipped') return 'info';
  if (status === 'pending') return 'warning';
  return 'secondary';
}

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function OrdersListDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="space-y-4">
        <div className="flex flex-row items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t('pages.orders.title', 'Orders')}
          </h1>
          <Button>
            <PlusIcon /> {t('pages.orders.createOrder', 'Create Order')}
          </Button>
        </div>
        <Tabs className="space-y-4" defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">{t('ordersList.story.all', 'All')}</TabsTrigger>
            <TabsTrigger value="completed">
              {t('pages.orders.tabs.completed', 'Completed')}
            </TabsTrigger>
            <TabsTrigger value="processed">
              {t('pages.orders.tabs.processed', 'Processed')}
            </TabsTrigger>
            <TabsTrigger value="returned">
              {t('pages.orders.tabs.returned', 'Returned')}
            </TabsTrigger>
            <TabsTrigger value="canceled">
              {t('pages.orders.tabs.canceled', 'Canceled')}
            </TabsTrigger>
          </TabsList>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ordersList.story.order', 'Order')}</TableHead>
                <TableHead>{t('ordersList.story.product', 'Product')}</TableHead>
                <TableHead>{t('ordersList.story.customer', 'Customer')}</TableHead>
                <TableHead>{t('ordersList.story.date', 'Date')}</TableHead>
                <TableHead>{t('ordersList.story.price', 'Price')}</TableHead>
                <TableHead>{t('ordersList.story.status', 'Status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">#{order.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Image
                        alt={order.product_name}
                        className="h-10 w-10 rounded-md object-cover"
                        height={40}
                        src={order.image}
                        unoptimized
                        width={40}
                      />
                      <span>{order.product_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.customer.name}</div>
                      <div className="text-muted-foreground text-sm">{order.customer.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{order.date}</TableCell>
                  <TableCell>{order.price}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Tabs>
      </div>
    </div>
  );
}

function OrdersTableDemo() {
  return (
    <div className="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('ordersList.story.order', 'Order')}</TableHead>
            <TableHead>{i18n.t('ordersList.story.product', 'Product')}</TableHead>
            <TableHead>{i18n.t('ordersList.story.customer', 'Customer')}</TableHead>
            <TableHead>{i18n.t('ordersList.story.date', 'Date')}</TableHead>
            <TableHead>{i18n.t('ordersList.story.price', 'Price')}</TableHead>
            <TableHead>{i18n.t('ordersList.story.status', 'Status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockOrders.slice(0, 3).map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">#{order.id}</TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Image
                    alt={order.product_name}
                    className="h-10 w-10 rounded-md object-cover"
                    height={40}
                    src={order.image}
                    unoptimized
                    width={40}
                  />
                  <span>{order.product_name}</span>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{order.customer.name}</div>
                  <div className="text-muted-foreground text-sm">{order.customer.email}</div>
                </div>
              </TableCell>
              <TableCell>{order.date}</TableCell>
              <TableCell>{order.price}</TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Orders/Orders List',
  component: OrdersListDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...badgeHandlers, ...buttonHandlers, ...tableHandlers, ...tabsHandlers] },
    docs: {
      description: {
        component:
          'Orders List - A list of orders with tabs for filtering by status (All, Completed, Processed, Returned, Canceled) and a data table showing order details.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof OrdersListDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('ordersList.storyName.default', 'Full Page'),
  render: () => <OrdersListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const OrdersTable: Story = {
  name: i18n.t('ordersList.storyName.ordersTable', 'Orders Table'),
  render: () => <OrdersTableDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('ordersList.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <OrdersListDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('ordersList.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <OrdersListDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('ordersList.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <OrdersListDemo />
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
  name: i18n.t('ordersList.storyName.created', 'Handler: created'),
  parameters: { msw: { handlers: tableStatusHandlers.created } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: tableStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: tableStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: tableStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: tableStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: tableStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: tableStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: tableStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'ordersList.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: tableStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: tableStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: tableStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: tableStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: tableStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: tableStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: tableStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: tableStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PartialData: Story = {
  ...Default,
  name: i18n.t('ordersList.storyName.partialData', 'Handler: partialData'),
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
  const orders = createFakeOrders(3);
  const tableData = createFakeTableData(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ orders, tableData }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('ordersList.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
