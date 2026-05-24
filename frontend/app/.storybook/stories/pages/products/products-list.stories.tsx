import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { badgeHandlers } from '@/.storybook/stories/_handlers/badge.handlers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { cardHandlers, cardStatusHandlers } from '@/.storybook/stories/_handlers/card.handlers';
import { tableHandlers } from '@/.storybook/stories/_handlers/table.handlers';
import {
  createFakeProducts,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@radix-ui/react-icons';
import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

// Mock products data
const mockProducts = [
  {
    id: 1,
    name: i18n.t('productsList.story.nameWirelessHeadphones', 'Wireless Headphones'),
    sku: i18n.t('productsList.story.skuWH1000XM4', 'WH1000XM4'),
    price: '$249.99',
    stock: 150,
    status: 'active',
    image: '/images/products/01.jpeg',
    category: i18n.t('productsList.story.categoryElectronics', 'Electronics'),
  },
  {
    id: 2,
    name: i18n.t('productsList.story.nameBluetoothSpeaker', 'Bluetooth Speaker'),
    sku: i18n.t('productsList.story.skuBS500', 'BS500'),
    price: '$89.99',
    stock: 75,
    status: 'active',
    image: '/images/products/02.jpeg',
    category: i18n.t('productsList.story.categoryElectronics', 'Electronics'),
  },
  {
    id: 3,
    name: i18n.t('productsList.story.nameSmartwatch', 'Smartwatch'),
    sku: i18n.t('productsList.story.skuSW200', 'SW200'),
    price: '$199.99',
    stock: 0,
    status: 'out_of_stock',
    image: '/images/products/03.jpeg',
    category: i18n.t('productsList.story.categoryElectronics', 'Electronics'),
  },
  {
    id: 4,
    name: i18n.t('productsList.story.nameLaptopStand', 'Laptop Stand'),
    sku: i18n.t('productsList.story.skuLS100', 'LS100'),
    price: '$49.99',
    stock: 200,
    status: 'active',
    image: '/images/products/04.jpeg',
    category: i18n.t('productsList.story.categoryAccessories', 'Accessories'),
  },
  {
    id: 5,
    name: i18n.t('productsList.story.nameUSBHub', 'USB Hub'),
    sku: i18n.t('productsList.story.skuUH300', 'UH300'),
    price: '$29.99',
    stock: 50,
    status: 'draft',
    image: '/images/products/05.jpeg',
    category: i18n.t('productsList.story.categoryAccessories', 'Accessories'),
  },
];

function getStatusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' {
  if (status === 'active') return 'success';
  if (status === 'out_of_stock') return 'destructive';
  if (status === 'draft') return 'warning';
  return 'secondary';
}

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function ProductsListDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {t('productsList.story.products', 'Products')}
          </h1>
          <Button>
            <PlusIcon /> {t('productsList.story.addProduct', 'Add Product')}
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>{t('productsList.story.totalSales', 'Total Sales')}</CardDescription>
              <CardTitle className="font-display text-2xl lg:text-3xl">$30,230</CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <span className="text-green-600">+20.1%</span>
                </Badge>
              </CardAction>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>
                {t('productsList.story.numberOfSales', 'Number of Sales')}
              </CardDescription>
              <CardTitle className="font-display text-2xl lg:text-3xl">982</CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <span className="text-green-600">+5.02</span>
                </Badge>
              </CardAction>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>{t('productsList.story.affiliate', 'Affiliate')}</CardDescription>
              <CardTitle className="font-display text-2xl lg:text-3xl">$4,530</CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <span className="text-green-600">+3.1%</span>
                </Badge>
              </CardAction>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>{t('productsList.story.discounts', 'Discounts')}</CardDescription>
              <CardTitle className="font-display text-2xl lg:text-3xl">$2,230</CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <span className="text-red-600">-3.58%</span>
                </Badge>
              </CardAction>
            </CardHeader>
          </Card>
        </div>
        <div className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('productsList.story.product', 'Product')}</TableHead>
                <TableHead>{t('productsList.story.sku', 'SKU')}</TableHead>
                <TableHead>{t('productsList.story.category', 'Category')}</TableHead>
                <TableHead>{t('productsList.story.price', 'Price')}</TableHead>
                <TableHead>{t('productsList.story.stock', 'Stock')}</TableHead>
                <TableHead>{t('productsList.story.status', 'Status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Image
                        alt={product.name}
                        className="h-10 w-10 rounded-md object-cover"
                        height={40}
                        src={product.image}
                        unoptimized
                        width={40}
                      />
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>{product.price}</TableCell>
                  <TableCell>{product.stock}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(product.status)}>
                      {product.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function StatCardsDemo() {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>{t('productsList.story.totalSales', 'Total Sales')}</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">$30,230</CardTitle>
          <CardAction>
            <Badge variant="outline">
              <span className="text-green-600">+20.1%</span>
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>
            {t('productsList.story.numberOfSales', 'Number of Sales')}
          </CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">982</CardTitle>
          <CardAction>
            <Badge variant="outline">
              <span className="text-green-600">+5.02</span>
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>{t('productsList.story.affiliate', 'Affiliate')}</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">$4,530</CardTitle>
          <CardAction>
            <Badge variant="outline">
              <span className="text-green-600">+3.1%</span>
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>{t('productsList.story.discounts', 'Discounts')}</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">$2,230</CardTitle>
          <CardAction>
            <Badge variant="outline">
              <span className="text-red-600">-3.58%</span>
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Products/Products List',
  component: ProductsListDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...badgeHandlers, ...buttonHandlers, ...cardHandlers, ...tableHandlers] },
    docs: {
      description: {
        component:
          'Products List Page - Product management page with stat cards (Total Sales, Number of Sales, Affiliate, Discounts) and a data table showing products with filtering.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof ProductsListDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('productsList.storyName.default', 'Full Page'),
  render: () => <ProductsListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const StatCards: Story = {
  name: i18n.t('productsList.storyName.statCards', 'Stat Cards'),
  render: () => <StatCardsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('productsList.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <ProductsListDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('productsList.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <ProductsListDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('productsList.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <ProductsListDemo />
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

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: cardStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: cardStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: cardStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: cardStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: cardStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'productsList.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: cardStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: cardStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'productsList.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: cardStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: cardStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: cardStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: cardStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: cardStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: cardStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: cardStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('productsList.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: cardStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const row = createFakeTableRow();
  const products = createFakeProducts(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ row, products }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('productsList.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
