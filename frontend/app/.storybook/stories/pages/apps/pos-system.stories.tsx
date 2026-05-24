import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  appsMiscStatusHandlers,
  appsPosHandlers,
} from '@/.storybook/stories/_handlers/apps-misc.handlers';
import {
  createFakeProducts,
  createFakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';

import type {
  Product,
  ProductCategory,
  Table,
  TableCategory,
} from '@/app/dashboard/(auth)/apps/pos-system/store';
import { PosSystemStoreProvider } from '@/app/dashboard/(auth)/apps/pos-system/store';
import PosSystemMenu from '@/app/dashboard/(auth)/apps/pos-system/pos-system-menu';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProductCategories: ProductCategory[] = [
  { id: 'coffee', name: i18n.t('posSystem.story.categoryCoffee', 'Coffee'), icon: '☕' },
  { id: 'tea', name: i18n.t('posSystem.story.categoryTea', 'Tea'), icon: '🍵' },
  { id: 'pastry', name: i18n.t('posSystem.story.categoryPastry', 'Pastry'), icon: '🥐' },
  { id: 'sandwich', name: i18n.t('posSystem.story.categorySandwich', 'Sandwich'), icon: '🥪' },
  { id: 'dessert', name: i18n.t('posSystem.story.categoryDessert', 'Dessert'), icon: '🍰' },
];

const mockProducts: Product[] = [
  {
    id: '1',
    name: i18n.t('posSystem.story.productAmericano', 'Americano'),
    price: 3.99,
    category: 'coffee',
    image: '/placeholder.svg',
  },
  {
    id: '2',
    name: i18n.t('posSystem.story.productLatte', 'Latte'),
    price: 4.49,
    category: 'coffee',
    image: '/placeholder.svg',
  },
  {
    id: '3',
    name: i18n.t('posSystem.story.productCappuccino', 'Cappuccino'),
    price: 4.29,
    category: 'coffee',
    image: '/placeholder.svg',
  },
  {
    id: '4',
    name: i18n.t('posSystem.story.productGreenTea', 'Green Tea'),
    price: 3.49,
    category: 'tea',
    image: '/placeholder.svg',
  },
  {
    id: '5',
    name: i18n.t('posSystem.story.productChaiLatte', 'Chai Latte'),
    price: 4.99,
    category: 'tea',
    image: '/placeholder.svg',
  },
  {
    id: '6',
    name: i18n.t('posSystem.story.productCroissant', 'Croissant'),
    price: 2.99,
    category: 'pastry',
    image: '/placeholder.svg',
  },
  {
    id: '7',
    name: i18n.t('posSystem.story.productBlueberryMuffin', 'Blueberry Muffin'),
    price: 3.29,
    category: 'pastry',
    image: '/placeholder.svg',
  },
  {
    id: '8',
    name: i18n.t('posSystem.story.productClubSandwich', 'Club Sandwich'),
    price: 7.99,
    category: 'sandwich',
    image: '/placeholder.svg',
  },
  {
    id: '9',
    name: i18n.t('posSystem.story.productCheesecake', 'Cheesecake'),
    price: 5.49,
    category: 'dessert',
    image: '/placeholder.svg',
  },
  {
    id: '10',
    name: i18n.t('posSystem.story.productEspresso', 'Espresso'),
    price: 2.99,
    category: 'coffee',
    image: '/placeholder.svg',
  },
];

const mockTableCategories: TableCategory[] = [
  { id: 'indoor', name: i18n.t('posSystem.story.tableCategoryIndoor', 'Indoor') },
  { id: 'outdoor', name: i18n.t('posSystem.story.tableCategoryOutdoor', 'Outdoor') },
  { id: 'vip', name: i18n.t('posSystem.story.tableCategoryVip', 'VIP') },
];

const mockTables: Table[] = [
  {
    id: 'table-1',
    name: i18n.t('posSystem.story.table1', 'Table 1'),
    status: 'available',
    category: 'indoor',
  },
  {
    id: 'table-2',
    name: i18n.t('posSystem.story.table2', 'Table 2'),
    status: 'occupied',
    category: 'indoor',
  },
  {
    id: 'table-3',
    name: i18n.t('posSystem.story.table3', 'Table 3'),
    status: 'available',
    category: 'indoor',
  },
  {
    id: 'table-4',
    name: i18n.t('posSystem.story.table4', 'Table 4'),
    status: 'reserved',
    category: 'outdoor',
  },
  {
    id: 'table-5',
    name: i18n.t('posSystem.story.table5', 'Table 5'),
    status: 'available',
    category: 'outdoor',
  },
  {
    id: 'table-6',
    name: i18n.t('posSystem.story.table6', 'Table 6'),
    status: 'available',
    category: 'vip',
  },
];

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function PosSystemAppDemo() {
  const { t } = useTranslation();

  return (
    <PosSystemStoreProvider>
      <div className="h-[90vh] p-4">
        <div className="mb-4">
          <p className="text-muted-foreground text-sm">
            {t(
              'pages.posSystem.description',
              'Point of Sale system with product management, cart, and table assignment'
            )}
          </p>
        </div>
        <PosSystemMenu
          productCategories={mockProductCategories}
          products={mockProducts}
          tableCategories={mockTableCategories}
          tables={mockTables}
        />
      </div>
    </PosSystemStoreProvider>
  );
}

function PosSystemInterfaceDemo() {
  return (
    <PosSystemStoreProvider>
      <div className="p-4">
        <PosSystemMenu
          productCategories={mockProductCategories}
          products={mockProducts}
          tableCategories={mockTableCategories}
          tables={mockTables}
        />
      </div>
    </PosSystemStoreProvider>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Apps/POS System',
  component: PosSystemAppDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'POS System App - Point of Sale with product categories, search filtering, shopping cart (desktop sidebar + mobile sheet), order creation with 5% tax calculation, and table assignment with status tracking (available/occupied/reserved).',
      },
    },
    msw: {
      handlers: appsPosHandlers,
    },
  },
  argTypes: {},
} satisfies Meta<typeof PosSystemAppDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// DEFAULT STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('posSystem.storyName.default', 'Full App'),
  render: () => <PosSystemAppDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify page renders with title
    expect(canvas.getByText('Pos System')).toBeInTheDocument();

    // Verify products are rendered
    expect(
      canvas.getByText(i18n.t('posSystem.story.productAmericano', 'Americano'))
    ).toBeInTheDocument();
    expect(canvas.getByText(i18n.t('posSystem.story.productLatte', 'Latte'))).toBeInTheDocument();
  },
};

export const PosInterface: Story = {
  name: i18n.t('posSystem.storyName.posInterface', 'POS Interface'),
  render: () => <PosSystemInterfaceDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify products component renders
    expect(
      canvas.getByText(i18n.t('posSystem.story.productAmericano', 'Americano'))
    ).toBeInTheDocument();
    expect(
      canvas.getByText(i18n.t('posSystem.story.productCroissant', 'Croissant'))
    ).toBeInTheDocument();
  },
};

// ============================================================================
// VARIANT STORIES (Dark, RTL, Japanese)
// ============================================================================

export const Dark: Story = {
  name: i18n.t('posSystem.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <PosSystemAppDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('posSystem.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <PosSystemAppDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('posSystem.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <PosSystemAppDemo />
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
  name: i18n.t('posSystem.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('posSystem.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('posSystem.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('posSystem.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// STATUS HANDLER STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('posSystem.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('posSystem.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('posSystem.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('posSystem.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('posSystem.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('posSystem.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('posSystem.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('posSystem.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: appsMiscStatusHandlers.networkError } },
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
  name: i18n.t('posSystem.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
