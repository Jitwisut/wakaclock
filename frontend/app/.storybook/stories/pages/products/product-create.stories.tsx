import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { cardHandlers } from '@/.storybook/stories/_handlers/card.handlers';
import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import { switchHandlers } from '@/.storybook/stories/_handlers/switch.handlers';
import {
  createFakeFormData,
  createFakeFormField,
} from '@/.storybook/stories/_factories/form.factory';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, CirclePlusIcon, ImageIcon, UploadIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function ProductCreateDemo() {
  const { t } = useTranslation();

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="mx-auto max-w-(--breakpoint-lg)">
        <div className="space-y-4">
          <div className="mb-4 flex flex-col justify-between space-y-4 lg:flex-row lg:items-center lg:space-y-2">
            <div className="flex items-center gap-4">
              <Button variant="outline">
                <ChevronLeft />
              </Button>
              <h1 className="text-2xl font-bold tracking-tight">
                {t('productCreate.story.addProducts', 'Add Products')}
              </h1>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary">
                {t('productCreate.story.discard', 'Discard')}
              </Button>
              <Button type="button" variant="outline">
                {t('productCreate.story.saveDraft', 'Save Draft')}
              </Button>
              <Button type="submit">{t('productCreate.story.publish', 'Publish')}</Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-6">
            <div className="space-y-4 lg:col-span-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {t('productCreate.story.productDetails', 'Product Details')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('productCreate.story.name', 'Name')}</Label>
                      <Input
                        placeholder={t(
                          'productCreate.story.productNamePlaceholder',
                          'Product name'
                        )}
                      />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t('productCreate.story.sku', 'SKU')}</Label>
                        <Input placeholder={t('productCreate.story.sku', 'SKU')} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('productCreate.story.barcode', 'Barcode')}</Label>
                        <Input placeholder={t('productCreate.story.barcode', 'Barcode')} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>
                        {t('productCreate.story.descriptionOptional', 'Description (Optional)')}
                      </Label>
                      <Textarea
                        placeholder={t(
                          'productCreate.story.productDescriptionPlaceholder',
                          'Product description'
                        )}
                      />
                      <p className="text-muted-foreground text-sm">
                        {t(
                          'pages.productCreate.descriptionHint',
                          'Set a description to the product for better visibility.'
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('productCreate.story.productImages', 'Product Images')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-input flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed p-4">
                    <div className="bg-background mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border">
                      <ImageIcon className="size-4 opacity-60" />
                    </div>
                    <p className="mb-1.5 text-sm font-medium">
                      {t('productCreate.story.dropImagesHere', 'Drop your images here')}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t('productCreate.story.imageFormats', 'PNG or JPG (max. 5MB)')}
                    </p>
                    <Button className="mt-4" type="button" variant="outline">
                      <UploadIcon className="-ms-1 opacity-60" />
                      {t('productCreate.story.selectImages', 'Select images')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="pb-0">
                <CardHeader>
                  <CardTitle>{t('productCreate.story.variants', 'Variants')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-4 lg:grid-flow-col">
                      <div className="space-y-2">
                        <Label>{t('productCreate.story.options', 'Options')}</Label>
                        <Select>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={t('productCreate.story.selectStatus', 'Select a status')}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="size">
                                {t('productCreate.story.size', 'Size')}
                              </SelectItem>
                              <SelectItem value="color">
                                {t('productCreate.story.color', 'Color')}
                              </SelectItem>
                              <SelectItem value="weight">
                                {t('productCreate.story.weight', 'Weight')}
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('productCreate.story.value', 'Value')}</Label>
                        <Input placeholder={t('productCreate.story.value', 'Value')} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('productCreate.story.price', 'Price')}</Label>
                        <Input placeholder={t('productCreate.story.price', 'Price')} />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="justify-center border-t p-0!">
                  <Button
                    className="w-full rounded-tl-none rounded-tr-none"
                    type="button"
                    variant="ghost"
                  >
                    <CirclePlusIcon /> {t('productCreate.story.addVariant', 'Add Variant')}
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t('productCreate.story.pricing', 'Pricing')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('productCreate.story.basePrice', 'Base Price')}</Label>
                      <Input placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('productCreate.story.discountedPrice', 'Discounted Price')}</Label>
                      <Input placeholder="0.00" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="tax" />
                      <label className="text-sm leading-none font-medium" htmlFor="tax">
                        {t('productCreate.story.chargeTax', 'Charge tax on this product')}
                      </label>
                    </div>
                    <hr />
                    <div className="flex items-center space-x-2">
                      <Switch checked id="in-stock" />
                      <Label htmlFor="in-stock">
                        {t('productCreate.story.inStock', 'In stock')}
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('productCreate.story.status', 'Status')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select defaultValue="draft">
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={t('productCreate.story.selectStatus', 'Select a status')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="draft">
                          <span className="size-2 rounded-full bg-orange-400" />{' '}
                          {t('productCreate.story.draft', 'Draft')}
                        </SelectItem>
                        <SelectItem value="active">
                          <span className="size-2 rounded-full bg-green-400" />{' '}
                          {t('productCreate.story.active', 'Active')}
                        </SelectItem>
                        <SelectItem value="archived">
                          <span className="size-2 rounded-full bg-indigo-400" />{' '}
                          {t('productCreate.story.archived', 'Archived')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {t('productCreate.story.setProductStatus', 'Set the product status.')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('productCreate.story.categories', 'Categories')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Select>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t('productCreate.story.selectCategory', 'Select a category')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="electronics">
                            {t('productCreate.story.electronics', 'Electronics')}
                          </SelectItem>
                          <SelectItem value="clothing">
                            {t('productCreate.story.clothing', 'Clothing')}
                          </SelectItem>
                          <SelectItem value="accessories">
                            {t('productCreate.story.accessories', 'Accessories')}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Select>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t(
                            'productCreate.story.selectSubCategory',
                            'Select a sub category'
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="toys">
                            {t('productCreate.story.toys', 'Toys')}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductFormDemo() {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('productCreate.story.productDetails', 'Product Details')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('productCreate.story.name', 'Name')}</Label>
              <Input
                placeholder={t('productCreate.story.productNamePlaceholder', 'Product name')}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('productCreate.story.sku', 'SKU')}</Label>
                <Input placeholder={t('productCreate.story.sku', 'SKU')} />
              </div>
              <div className="space-y-2">
                <Label>{t('productCreate.story.barcode', 'Barcode')}</Label>
                <Input placeholder={t('productCreate.story.barcode', 'Barcode')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                {t('productCreate.story.descriptionOptional', 'Description (Optional)')}
              </Label>
              <Textarea
                placeholder={t(
                  'productCreate.story.productDescriptionPlaceholder',
                  'Product description'
                )}
              />
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
  title: 'Pages/Products/Product Create',
  component: ProductCreateDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...buttonHandlers, ...cardHandlers, ...formHandlers, ...switchHandlers] },
    docs: {
      description: {
        component:
          'Product Create Page - A form for adding new products with sections for product details, images upload, variants, pricing, status, and categories.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof ProductCreateDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('productCreate.storyName.default', 'Full Form'),
  render: () => <ProductCreateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const ProductForm: Story = {
  name: i18n.t('productCreate.storyName.productForm', 'Product Form'),
  render: () => <ProductFormDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('productCreate.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <ProductCreateDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('productCreate.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <ProductCreateDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('productCreate.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <ProductCreateDemo />
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
  name: i18n.t('productCreate.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: formStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: formStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: formStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'productCreate.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: formStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: formStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: formStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: formStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'productCreate.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: formStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: formStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'productCreate.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: formStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: formStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: formStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: formStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: formStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('productCreate.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: formStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const field = createFakeFormField();
  const formData = createFakeFormData();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ field, formData }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('productCreate.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
