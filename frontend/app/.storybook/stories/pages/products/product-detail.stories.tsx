import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { cardHandlers } from '@/.storybook/stories/_handlers/card.handlers';
import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import { progressHandlers } from '@/.storybook/stories/_handlers/progress.handlers';
import { tableHandlers } from '@/.storybook/stories/_handlers/table.handlers';
import { createFakeCard } from '@/.storybook/stories/_factories/card.factory';
import {
  createFakeProduct,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';
import { useTranslation } from 'react-i18next';
import {
  CircleDollarSign,
  Edit3Icon,
  HandCoinsIcon,
  HeartIcon,
  Layers2Icon,
  ShoppingCart,
  StarIcon,
  Trash2Icon,
  TruckIcon,
} from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Mock product data
const mockProduct = {
  name: i18n.t('productDetail.story.acmePrismTShirt', 'Acme Prism T-Shirt'),
  seller: i18n.t('productDetail.story.poeticFashion', 'Poetic Fashion'),
  published: '20 Oct, 2024',
  sku: i18n.t('productDetail.story.skuValue', 'WH1000XM4'),
  price: 120.4,
  orders: 250,
  stock: 2550,
  revenue: 45_938,
  description: i18n.t(
    'productDetail.story.productDescription',
    'Tommy Hilfiger men striped pink sweatshirt. Crafted with cotton. Material composition is 100% organic cotton.'
  ),
  features: [
    i18n.t('productDetail.story.featureNoiseCancellation', 'Industry-leading noise cancellation'),
    i18n.t('productDetail.story.featureBatteryLife', '30-hour battery life'),
    i18n.t('productDetail.story.featureTouchSensor', 'Touch sensor controls'),
    i18n.t('productDetail.story.featureSpeakToChat', 'Speak-to-chat technology'),
  ],
  specs: {
    [i18n.t('productDetail.story.specCategory', 'Category')]: i18n.t(
      'productDetail.story.specCategoryValue',
      'T-Shirt'
    ),
    [i18n.t('productDetail.story.specBrand', 'Brand')]: i18n.t(
      'productDetail.story.specBrandValue',
      'Tommy Hilfiger'
    ),
    [i18n.t('productDetail.story.specColor', 'Color')]: i18n.t(
      'productDetail.story.specColorValue',
      'Purple'
    ),
    [i18n.t('productDetail.story.specWeight', 'Weight')]: i18n.t(
      'productDetail.story.specWeightValue',
      '140 Gr'
    ),
  },
  images: ['/images/products/01.jpeg', '/images/products/02.jpeg', '/images/products/03.jpeg'],
};

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function ProductDetailDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="space-y-4">
        <div className="flex flex-row items-start justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-xl tracking-tight lg:text-2xl">{mockProduct.name}</h1>
            <div className="text-muted-foreground inline-flex flex-col gap-2 text-sm lg:flex-row lg:gap-4">
              <div>
                <span className="text-foreground font-semibold">
                  {t('productDetail.story.seller', 'Seller')} :
                </span>{' '}
                {mockProduct.seller}
              </div>
              <div>
                <span className="text-foreground font-semibold">
                  {t('productDetail.story.published', 'Published')} :
                </span>{' '}
                {mockProduct.published}
              </div>
              <div>
                <span className="text-foreground font-semibold">
                  {t('productDetail.story.sku', 'SKU')} :
                </span>{' '}
                {mockProduct.sku}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button>
              <Edit3Icon />
              <span className="hidden lg:inline">{t('productDetail.story.edit', 'Edit')}</span>
            </Button>
            <Button size="icon" variant="destructive">
              <Trash2Icon />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-1">
            <Card>
              <CardContent>
                <div className="space-y-4">
                  <Image
                    alt={mockProduct.name}
                    className="aspect-square w-full rounded-lg object-cover"
                    height={400}
                    src={mockProduct.images[0]}
                    unoptimized
                    width={400}
                  />
                  <div className="flex gap-2">
                    {mockProduct.images.map((img, idx) => (
                      <Image
                        alt={`${mockProduct.name} ${idx + 1}`}
                        className="h-16 w-16 cursor-pointer rounded-md object-cover"
                        height={64}
                        key={img}
                        src={img}
                        unoptimized
                        width={64}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 xl:col-span-2">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="hover:border-primary/30 bg-muted grid auto-cols-max grid-flow-col gap-4 rounded-lg border p-4">
                <CircleDollarSign className="size-6 opacity-40" />
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-sm">
                    {t('productDetail.story.price', 'Price')}
                  </span>
                  <span className="text-lg font-semibold">${mockProduct.price.toFixed(2)}</span>
                </div>
              </div>
              <div className="hover:border-primary/30 bg-muted grid auto-cols-max grid-flow-col gap-4 rounded-lg border p-4">
                <TruckIcon className="size-6 opacity-40" />
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-sm">
                    {t('productDetail.story.noOfOrders', 'No. of Orders')}
                  </span>
                  <span className="text-lg font-semibold">{mockProduct.orders}</span>
                </div>
              </div>
              <div className="hover:border-primary/30 bg-muted grid auto-cols-max grid-flow-col gap-4 rounded-lg border p-4">
                <Layers2Icon className="size-6 opacity-40" />
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-sm">
                    {t('productDetail.story.availableStocks', 'Available Stocks')}
                  </span>
                  <span className="text-lg font-semibold">
                    {mockProduct.stock.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="hover:border-primary/30 bg-muted grid auto-cols-max grid-flow-col gap-4 rounded-lg border p-4">
                <HandCoinsIcon className="size-6 opacity-40" />
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-sm">
                    {t('productDetail.story.totalRevenue', 'Total Revenue')}
                  </span>
                  <span className="text-lg font-semibold">
                    ${mockProduct.revenue.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <Card>
              <CardContent className="space-y-4">
                <div className="grid items-start gap-8 xl:grid-cols-3">
                  <div className="space-y-8 xl:col-span-2">
                    <div>
                      <h3 className="mb-2 font-semibold">
                        {t('productDetail.story.description', 'Description:')}
                      </h3>
                      <p className="text-muted-foreground">{mockProduct.description}</p>
                    </div>
                    <div>
                      <h3 className="mb-2 font-semibold">
                        {t('productDetail.story.keyFeatures', 'Key Features:')}
                      </h3>
                      <ul className="text-muted-foreground list-inside list-disc">
                        {mockProduct.features.map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="rounded-md border xl:col-span-1">
                    <Table>
                      <TableBody>
                        {Object.entries(mockProduct.specs).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className="font-semibold">{key}</TableCell>
                            <TableCell className="text-right">{value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="grid auto-cols-max grid-flow-row gap-8">
                  <div>
                    <div className="mb-4 font-semibold">
                      {t('productDetail.story.colors', 'Colors:')}
                    </div>
                    <RadioGroup className="flex gap-2" defaultValue="green">
                      <div>
                        <RadioGroupItem className="peer sr-only" id="green" value="green" />
                        <Label
                          className="border-muted peer-data-[state=checked]:ring-primary flex size-8 cursor-pointer rounded-full border bg-green-400 peer-data-[state=checked]:ring"
                          htmlFor="green"
                        />
                      </div>
                      <div>
                        <RadioGroupItem className="peer sr-only" id="indigo" value="indigo" />
                        <Label
                          className="border-muted peer-data-[state=checked]:ring-primary flex size-8 cursor-pointer rounded-full border bg-indigo-400 peer-data-[state=checked]:ring"
                          htmlFor="indigo"
                        />
                      </div>
                      <div>
                        <RadioGroupItem className="peer sr-only" id="purple" value="purple" />
                        <Label
                          className="border-muted peer-data-[state=checked]:ring-primary flex size-8 cursor-pointer rounded-full border bg-purple-400 peer-data-[state=checked]:ring"
                          htmlFor="purple"
                        />
                      </div>
                    </RadioGroup>
                  </div>
                  <div>
                    <div className="mb-4 font-semibold">
                      {t('productDetail.story.sizes', 'Sizes:')}
                    </div>
                    <RadioGroup className="flex gap-2" defaultValue="md">
                      {['sm', 'md', 'lg', 'xl', 'xxl'].map((item) => (
                        <div key={item}>
                          <RadioGroupItem className="peer sr-only" id={item} value={item} />
                          <Label
                            className="hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 flex size-10 cursor-pointer items-center justify-center rounded-md border text-xs uppercase"
                            htmlFor={item}
                          >
                            {item}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button>
                    <ShoppingCart /> {t('productDetail.story.addToCart', 'Add to Cart')}
                  </Button>
                  <Button variant="outline">
                    <HeartIcon /> {t('productDetail.story.wishlist', 'Wishlist')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('productDetail.story.reviews', 'Reviews')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border">
                  <div className="bg-muted flex items-center gap-4 p-4">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map((i) => (
                        <StarIcon
                          className="size-4 fill-orange-400 stroke-orange-400"
                          key={`filled-${i}`}
                        />
                      ))}
                      {[4, 5].map((i) => (
                        <StarIcon className="size-4 stroke-orange-400" key={`empty-${i}`} />
                      ))}
                    </div>
                    <span className="text-muted-foreground text-sm">4.3 (12 reviews)</span>
                  </div>
                  <div className="space-y-4 p-4">
                    {[
                      { stars: 5, value: 70 },
                      { stars: 4, value: 17 },
                      { stars: 3, value: 7 },
                      { stars: 2, value: 4 },
                      { stars: 1, value: 2 },
                    ].map((rating) => (
                      <div className="flex items-center gap-4 text-sm" key={rating.stars}>
                        <span className="w-20">
                          {rating.stars} {t('productDetail.story.stars', 'stars')}
                        </span>
                        <Progress className="flex-1" value={rating.value} />
                        <span>{rating.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductInfoDemo() {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl p-4">
      <Card>
        <CardContent className="space-y-4">
          <div>
            <h3 className="mb-2 font-semibold">
              {t('productDetail.story.description', 'Description:')}
            </h3>
            <p className="text-muted-foreground">{mockProduct.description}</p>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">
              {t('productDetail.story.keyFeatures', 'Key Features:')}
            </h3>
            <ul className="text-muted-foreground list-inside list-disc">
              {mockProduct.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
          <div className="flex gap-3 pt-4">
            <Button>
              <ShoppingCart /> {t('productDetail.story.addToCart', 'Add to Cart')}
            </Button>
            <Button variant="outline">
              <HeartIcon /> {t('productDetail.story.wishlist', 'Wishlist')}
            </Button>
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
  title: 'Pages/Products/Product Detail',
  component: ProductDetailDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        ...buttonHandlers,
        ...cardHandlers,
        ...formHandlers,
        ...progressHandlers,
        ...tableHandlers,
      ],
    },
    docs: {
      description: {
        component:
          'Product Detail Page - A product page with image gallery, stats (price, orders, stock, revenue), description, features, specs table, color/size selectors, and reviews section.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof ProductDetailDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('productDetail.storyName.default', 'Full Page'),
  render: () => <ProductDetailDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const ProductInfo: Story = {
  name: i18n.t('productDetail.storyName.productInfo', 'Product Info'),
  render: () => <ProductInfoDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('productDetail.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <ProductDetailDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('productDetail.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <ProductDetailDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('productDetail.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <ProductDetailDemo />
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
  name: i18n.t('productDetail.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: formStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: formStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: formStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'productDetail.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: formStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: formStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: formStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: formStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'productDetail.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: formStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: formStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'productDetail.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: formStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: formStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: formStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: formStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: formStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('productDetail.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: formStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const card = createFakeCard();
  const tableRow = createFakeTableRow();
  const product = createFakeProduct();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ card, tableRow, product }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('productDetail.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
