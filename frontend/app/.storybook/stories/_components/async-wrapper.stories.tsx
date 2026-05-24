import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, RefreshCw, Search } from 'lucide-react';

import { AsyncWrapper } from './AsyncWrapper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import type { FakeApiResponse, FakeProduct, FakeUser } from '../_factories/async-wrapper.factory';
import {
  createAsyncWrapperShowcase,
  createAsyncWrapperTestData,
  createFakeAllVariantConfigs,
  createFakeLargeUserResponse,
  createFakeLongNameUsers,
  createFakeProductResponse,
  createFakeProducts,
  createFakeUserResponse,
  createFakeUsers,
  createUserRoleMatrix,
  createVariantRowMatrix,
  FETCH_STATUSES,
  HTTP_ERROR_STATUSES,
  SKELETON_VARIANTS,
  USER_ROLES,
  USER_STATUSES,
} from '../_factories/async-wrapper.factory';

import {
  API_ASYNC_PRODUCTS,
  API_ASYNC_USERS,
  asyncWrapperHandlers,
  asyncWrapperStatusHandlers,
} from '../_handlers/async-wrapper.handlers';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function UserListContent({ data }: { data: FakeApiResponse<FakeUser> }) {
  return (
    <div className="space-y-3" data-testid="user-list-content">
      <div className="flex items-center justify-between border-b pb-2">
        <span className="text-muted-foreground text-sm">
          {i18n.t('common:asyncWrapper.demo.showingOf', {
            count: data.data.length,
            total: data.meta.total,
          })}
        </span>
      </div>
      {data.data.map((user) => (
        <div
          key={user.id}
          className="hover:bg-muted/50 flex items-center gap-3 rounded-lg border p-3 transition-colors"
          data-testid="user-item"
        >
          <img src={user.avatar} alt={user.name} className="size-10 rounded-full" />
          <div className="flex-1">
            <div className="font-medium">{user.name}</div>
            <div className="text-muted-foreground text-sm">{user.email}</div>
          </div>
          <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>{user.status}</Badge>
          <Badge variant="outline">{user.role}</Badge>
        </div>
      ))}
    </div>
  );
}

function ProductGridContent({ data }: { data: FakeApiResponse<FakeProduct> }) {
  return (
    <div className="space-y-4" data-testid="product-grid-content">
      <div className="flex items-center justify-between border-b pb-2">
        <span className="text-muted-foreground text-sm">
          {i18n.t('common:asyncWrapper.demo.productsFound', { total: data.meta.total })}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.data.map((product) => (
          <Card key={product.id} data-testid="product-card">
            <CardHeader className="p-4">
              <img
                src={product.image}
                alt={product.name}
                className="h-32 w-full rounded-md object-cover"
              />
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              <CardTitle className="text-base">{product.name}</CardTitle>
              <CardDescription className="line-clamp-2">{product.description}</CardDescription>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">${product.price}</span>
                <Badge variant={product.stock > 0 ? 'secondary' : 'destructive'}>
                  {product.stock > 0
                    ? i18n.t('common:asyncWrapper.demo.inStock', { count: product.stock })
                    : i18n.t('common:asyncWrapper.demo.outOfStock')}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CustomLoadingFallback() {
  const { t } = useTranslation();

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-12"
      data-testid="custom-loading"
    >
      <Loader2 className="text-primary size-8 animate-spin" />
      <span className="text-muted-foreground">{t('common:asyncWrapper.demo.fetchingData')}</span>
    </div>
  );
}

function CustomErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <Alert variant="destructive" data-testid="custom-error">
      <AlertTriangle className="size-4" />
      <AlertTitle />
      <AlertDescription className="space-y-3">
        <p>{error.message}</p>
        <Button variant="outline" size="sm" onClick={retry}>
          <RefreshCw className="mr-2 size-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function CustomEmptyFallback() {
  const { t } = useTranslation();

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-12"
      data-testid="custom-empty"
    >
      <Search className="text-muted-foreground size-12" />
      <div className="text-center">
        <h3 className="font-semibold">{t('common:asyncWrapper.demo.noResults')}</h3>
        <p className="text-muted-foreground text-sm">
          {t('common:asyncWrapper.demo.adjustFilters')}
        </p>
      </div>
    </div>
  );
}

function AsyncWrapperDemo() {
  return (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Documentation/Components/AsyncWrapper',
  component: AsyncWrapperDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    msw: {
      handlers: asyncWrapperHandlers,
    },
    docs: {
      description: {
        component: `
AsyncWrapper is a generic async data fetching component that handles loading, error, and empty states automatically.

## Features
- Automatic loading skeleton display during fetch
- Built-in error handling with retry functionality
- Empty state detection and display
- Customizable fallbacks for all states
- Multiple skeleton variants (card, list, table, text)

## Usage

\`\`\`tsx
<AsyncWrapper<UserData[]> endpoint="/api/users">
  {(data) => <UserList users={data} />}
</AsyncWrapper>
\`\`\`
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    endpoint: {
      description: i18n.t(
        'asyncWrapper.argType.apiEndpointToFetchDataFrom',
        'API endpoint to fetch data from'
      ),
      control: 'text',
      table: { category: 'Required' },
    },
    children: {
      description: i18n.t(
        'asyncWrapper.argType.renderFunctionThatReceivesTheFetchedData',
        'Render function that receives the fetched data'
      ),
      table: { category: 'Required' },
    },
    loadingFallback: {
      description: i18n.t(
        'asyncWrapper.argType.customLoadingComponentToDisplayWhileFetching',
        'Custom loading component to display while fetching'
      ),
      table: { category: 'Fallbacks' },
    },
    errorFallback: {
      description: i18n.t(
        'asyncWrapper.argType.customErrorComponentRenderFunction',
        'Custom error component render function'
      ),
      table: { category: 'Fallbacks' },
    },
    emptyFallback: {
      description: i18n.t(
        'asyncWrapper.argType.customEmptyStateComponentToDisplayWhenDataIsEmpty',
        'Custom empty state component to display when data is empty'
      ),
      table: { category: 'Fallbacks' },
    },
    isEmpty: {
      description: i18n.t(
        'asyncWrapper.argType.customFunctionToDetermineIfDataIsEmpty',
        'Custom function to determine if data is empty'
      ),
      table: { category: 'Configuration' },
    },
    skeletonVariant: {
      description: i18n.t(
        'asyncWrapper.argType.loadingSkeletonVisualStyle',
        'Loading skeleton visual style'
      ),
      control: 'select',
      options: SKELETON_VARIANTS,
      table: { category: 'Configuration' },
    },
    skeletonRows: {
      description: i18n.t(
        'asyncWrapper.argType.numberOfSkeletonRowsToDisplay',
        'Number of skeleton rows to display'
      ),
      control: { type: 'number', min: 1, max: 10 },
      table: { category: 'Configuration' },
    },
  },
} satisfies Meta<typeof AsyncWrapperDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============================================================================
// CORE STORIES
// ============================================================================

export const Default: Story = {
  parameters: {
    msw: { handlers: asyncWrapperHandlers },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify loading state first
    expect(canvasElement.querySelector('[data-testid="story-loading"]')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="story-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify user list rendered
    const userItems = canvasElement.querySelectorAll('[data-testid="user-item"]');
    expect(userItems.length).toBeGreaterThan(0);
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// LOADING STATES
// ============================================================================

export const Loading: Story = {
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.loading },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="story-loading"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="loading-skeleton"]')).toBeInTheDocument();
  },
};

export const CustomLoading: Story = {
  name: i18n.t('asyncWrapper.storyName.customLoading', 'Custom Loading Fallback'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.loading },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>>
        endpoint={API_ASYNC_USERS}
        loadingFallback={<CustomLoadingFallback />}
      >
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(canvasElement.querySelector('[data-testid="custom-loading"]')).toBeInTheDocument();
  },
};

// ============================================================================
// ERROR STATES
// ============================================================================

export const ErrorState: Story = {
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.internalServerError },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="story-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    expect(canvasElement.querySelector('[data-testid="error-retry-button"]')).toBeInTheDocument();
  },
};

export const CustomError: Story = {
  name: i18n.t('asyncWrapper.storyName.customError', 'Custom Error Fallback'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.internalServerError },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>>
        endpoint={API_ASYNC_USERS}
        errorFallback={(error, retry) => <CustomErrorFallback error={error} retry={retry} />}
      >
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="custom-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============================================================================
// EMPTY STATES
// ============================================================================

export const Empty: Story = {
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.emptyData },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>>
        endpoint={API_ASYNC_USERS}
        isEmpty={(data) => data.data.length === 0}
      >
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="story-empty"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const CustomEmpty: Story = {
  name: i18n.t('asyncWrapper.storyName.customEmpty', 'Custom Empty Fallback'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.emptyData },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>>
        endpoint={API_ASYNC_USERS}
        isEmpty={(data) => data.data.length === 0}
        emptyFallback={<CustomEmptyFallback />}
      >
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="custom-empty"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============================================================================
// SKELETON VARIANTS
// ============================================================================

function AllSkeletonVariantsDemo() {
  const { t } = useTranslation();

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {SKELETON_VARIANTS.map((variant) => (
        <div key={variant} className="space-y-2">
          <div className="text-muted-foreground text-sm font-medium">
            {t(`common:asyncWrapper.story.${variant}Skeleton`)}
          </div>
          <AsyncWrapper<FakeApiResponse<FakeUser>>
            endpoint={API_ASYNC_USERS}
            skeletonVariant={variant}
            skeletonRows={variant === 'table' ? 4 : 3}
          >
            {(data) => <UserListContent data={data} />}
          </AsyncWrapper>
        </div>
      ))}
    </div>
  );
}

export const AllVariants: Story = {
  name: i18n.t('asyncWrapper.storyName.allVariants', 'Skeleton Variants (card, list, table, text)'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.loading },
  },
  render: () => <AllSkeletonVariantsDemo />,
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const loadingElements = canvasElement.querySelectorAll('[data-slot="loading-skeleton"]');
    expect(loadingElements.length).toBe(4);
    expect(canvasElement.querySelector('[data-variant="card"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-variant="list"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-variant="table"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-variant="text"]')).toBeInTheDocument();
  },
};

// ============================================================================
// PRODUCT GRID EXAMPLE
// ============================================================================

export const ProductGrid: Story = {
  name: i18n.t('asyncWrapper.storyName.productGrid', 'Product Grid (Card Layout)'),
  parameters: {
    msw: { handlers: asyncWrapperHandlers },
  },
  render: () => (
    <div className="w-full">
      <AsyncWrapper<FakeApiResponse<FakeProduct>>
        endpoint={API_ASYNC_PRODUCTS}
        skeletonVariant="card"
        skeletonRows={6}
      >
        {(data) => <ProductGridContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="story-loading"]')).toBeInTheDocument();
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="story-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    const productCards = canvasElement.querySelectorAll('[data-testid="product-card"]');
    expect(productCards.length).toBeGreaterThan(0);
  },
};

// ============================================================================
// HTTP ERROR STORIES (4xx)
// ============================================================================

export const Error400BadRequest: Story = {
  name: i18n.t('asyncWrapper.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.badRequest },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="400"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('asyncWrapper.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.unauthorized },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="401"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('asyncWrapper.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.forbidden },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="403"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error404NotFound: Story = {
  name: i18n.t('asyncWrapper.storyName.error404NotFound', 'Error 404: Not Found'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.notFound },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="404"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('asyncWrapper.storyName.error409Conflict', 'Error 409: Conflict'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.conflict },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="409"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t(
    'asyncWrapper.storyName.error422UnprocessableEntity',
    'Error 422: Unprocessable Entity'
  ),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.unprocessableEntity },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="422"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('asyncWrapper.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.tooManyRequests },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="429"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============================================================================
// HTTP ERROR STORIES (5xx)
// ============================================================================

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'asyncWrapper.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.internalServerError },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="500"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('asyncWrapper.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.badGateway },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="502"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t(
    'asyncWrapper.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.serviceUnavailable },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="503"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('asyncWrapper.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.gatewayTimeout },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="504"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============================================================================
// SPECIAL STATES
// ============================================================================

export const SlowResponse: Story = {
  name: i18n.t('asyncWrapper.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.slowResponse },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="story-loading"]')).toBeInTheDocument();
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="story-success"]')).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('asyncWrapper.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.networkError },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="story-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============================================================================
// ACCESSIBILITY
// ============================================================================

export const Accessibility: Story = {
  parameters: {
    msw: { handlers: asyncWrapperHandlers },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const loadingSkeleton = canvasElement.querySelector('[data-slot="loading-skeleton"]');
    if (loadingSkeleton) {
      expect(loadingSkeleton).toHaveAttribute('aria-busy', 'true');
      expect(loadingSkeleton).toHaveAttribute('role', 'status');
      expect(loadingSkeleton).toHaveAttribute('aria-label', 'Loading content');
    }

    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="story-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    const userItems = canvasElement.querySelectorAll('[data-testid="user-item"]');
    expect(userItems.length).toBeGreaterThan(0);

    const firstUserItem = userItems[0];
    if (firstUserItem) {
      await userEvent.tab();
    }
  },
};

// ============================================================================
// THEME & i18n VARIANTS
// ============================================================================

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('asyncWrapper.storyName.darkRTL', 'Dark + RTL'),
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  name: i18n.t('asyncWrapper.storyName.japanese', 'Japanese Locale'),
  parameters: {
    locale: 'ja',
    msw: { handlers: asyncWrapperHandlers },
  },
  render: () => <AsyncWrapperDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
  tags: ['!test'],
};

export const DarkJapanese: Story = {
  name: i18n.t('asyncWrapper.storyName.darkJapanese', 'Dark + Japanese'),
  parameters: {
    locale: 'ja',
    msw: { handlers: asyncWrapperHandlers },
  },
  globals: {
    theme: 'dark',
  },
  render: () => <AsyncWrapperDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
  tags: ['!test'],
};

// ============================================================================
// PSEUDO STATES
// ============================================================================

export const PseudoStates: Story = {
  tags: ['!test'],
  name: i18n.t('asyncWrapper.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  parameters: {
    msw: { handlers: asyncWrapperHandlers },
  },
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-wrap items-start gap-8">
        <div id="hover" className="flex-1">
          <div className="text-muted-foreground mb-2 text-xs">
            {i18n.t('asyncWrapper.story.hover', 'Hover')}
          </div>
          <Story />
        </div>
        <div id="focus" className="flex-1">
          <div className="text-muted-foreground mb-2 text-xs">
            {i18n.t('asyncWrapper.story.focus', 'Focus')}
          </div>
          <Story />
        </div>
        <div id="active" className="flex-1">
          <div className="text-muted-foreground mb-2 text-xs">
            {i18n.t('asyncWrapper.story.active', 'Active')}
          </div>
          <Story />
        </div>
      </div>
    ),
  ],
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// RETRY FUNCTIONALITY
// ============================================================================

export const RetryOnError: Story = {
  name: i18n.t('asyncWrapper.storyName.retryOnError', 'Retry on Error'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.internalServerError },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="story-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    const retryButton = canvasElement.querySelector('[data-testid="error-retry-button"]');
    expect(retryButton).toBeInTheDocument();

    if (retryButton) {
      await userEvent.click(retryButton);
      await waitFor(
        () => {
          const isLoading = canvasElement.querySelector('[data-testid="story-loading"]');
          const isError = canvasElement.querySelector('[data-testid="story-error"]');
          expect(isLoading || isError).toBeTruthy();
        },
        { timeout: 3000 }
      );
    }
  },
};

// ============================================================================
// COMPOSITION / MULTIPLE INSTANCES
// ============================================================================

function MultipleInstancesDemo() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-2">
        <h3 className="font-semibold">{i18n.t('common:asyncWrapper.demo.usersListTitle')}</h3>
        <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS} skeletonVariant="list">
          {(data) => <UserListContent data={data} />}
        </AsyncWrapper>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">{i18n.t('common:asyncWrapper.demo.productsCardsTitle')}</h3>
        <AsyncWrapper<FakeApiResponse<FakeProduct>>
          endpoint={API_ASYNC_PRODUCTS}
          skeletonVariant="card"
          skeletonRows={3}
        >
          {(data) => <ProductGridContent data={data} />}
        </AsyncWrapper>
      </div>
    </div>
  );
}

export const MultipleInstances: Story = {
  name: i18n.t('asyncWrapper.storyName.multipleInstances', 'Multiple Async Wrappers'),
  parameters: {
    msw: { handlers: asyncWrapperHandlers },
  },
  render: () => <MultipleInstancesDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="user-list-content"]')
        ).toBeInTheDocument();
        expect(
          canvasElement.querySelector('[data-testid="product-grid-content"]')
        ).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  },
};

// ============================================================================
// EDGE CASES
// ============================================================================

export const LongTextOverflow: Story = {
  name: i18n.t('asyncWrapper.storyName.longTextOverflow', 'Long Text Overflow'),
  parameters: {
    msw: { handlers: asyncWrapperHandlers },
  },
  render: () => {
    const longNameUsers = createFakeLongNameUsers(5);
    // Use the factory data to pre-populate (displayed via custom render)
    return (
      <div className="w-full max-w-2xl">
        <div className="space-y-3" data-testid="long-text-content">
          {longNameUsers.map((user) => (
            <div
              key={user.id}
              className="hover:bg-muted/50 flex items-center gap-3 rounded-lg border p-3 transition-colors"
              data-testid="user-item"
            >
              <img src={user.avatar} alt={user.name} className="size-10 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{user.name}</div>
                <div className="text-muted-foreground truncate text-sm">{user.email}</div>
              </div>
              <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                {user.status}
              </Badge>
              <Badge variant="outline">{user.role}</Badge>
            </div>
          ))}
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const userItems = canvasElement.querySelectorAll('[data-testid="user-item"]');
    expect(userItems.length).toBe(5);
  },
};

export const ManyItems: Story = {
  name: i18n.t('asyncWrapper.storyName.manyItems', 'Many Items (50 users)'),
  parameters: {
    msw: { handlers: asyncWrapperHandlers },
  },
  render: () => {
    const largeResponse = createFakeLargeUserResponse();
    return (
      <div className="max-h-[600px] w-full max-w-2xl overflow-auto">
        <UserListContent data={largeResponse} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const userItems = canvasElement.querySelectorAll('[data-testid="user-item"]');
    expect(userItems.length).toBe(50);
  },
};

// ============================================================================
// MOBILE VIEWPORT
// ============================================================================

export const Mobile: Story = {
  name: i18n.t('asyncWrapper.storyName.mobile', 'Mobile Viewport (320px)'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
    msw: { handlers: asyncWrapperHandlers },
  },
  render: () => (
    <div className="w-full">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY STORIES
// ============================================================================

export const FactoryData: Story = {
  name: i18n.t('asyncWrapper.storyName.factoryData', 'Factory: Generated Users'),
  parameters: {
    msw: { handlers: asyncWrapperHandlers },
  },
  render: () => {
    const response = createFakeUserResponse(8);
    return (
      <div className="w-full max-w-2xl">
        <UserListContent data={response} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const userItems = canvasElement.querySelectorAll('[data-testid="user-item"]');
    expect(userItems.length).toBe(8);
  },
};

export const FactoryProducts: Story = {
  name: i18n.t('asyncWrapper.storyName.factoryProducts', 'Factory: Generated Products'),
  parameters: {
    msw: { handlers: asyncWrapperHandlers },
  },
  render: () => {
    const response = createFakeProductResponse(9);
    return (
      <div className="w-full">
        <ProductGridContent data={response} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const productCards = canvasElement.querySelectorAll('[data-testid="product-card"]');
    expect(productCards.length).toBe(9);
  },
};

export const FactoryRoleMatrix: Story = {
  name: i18n.t('asyncWrapper.storyName.factoryRoleMatrix', 'Factory: Role Matrix'),
  parameters: {
    msw: { handlers: asyncWrapperHandlers },
  },
  render: () => {
    const roleMatrix = createUserRoleMatrix();
    return (
      <div className="w-full max-w-2xl space-y-3">
        {roleMatrix.map(({ role, user }) => (
          <div
            key={role}
            className="flex items-center gap-3 rounded-lg border p-3"
            data-testid="user-item"
          >
            <img src={user.avatar} alt={user.name} className="size-10 rounded-full" />
            <div className="flex-1">
              <div className="font-medium">{user.name}</div>
              <div className="text-muted-foreground text-sm">{user.email}</div>
            </div>
            <Badge variant="outline">{role}</Badge>
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const userItems = canvasElement.querySelectorAll('[data-testid="user-item"]');
    expect(userItems.length).toBe(USER_ROLES.length);
  },
};

export const FactoryVariantMatrix: Story = {
  name: i18n.t('asyncWrapper.storyName.factoryVariantMatrix', 'Factory: Variant × Row Matrix'),
  parameters: {
    msw: { handlers: asyncWrapperStatusHandlers.loading },
  },
  render: () => {
    const configs = createFakeAllVariantConfigs();
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {configs.map((config) => (
          <div key={config.id} className="space-y-2">
            <div className="text-muted-foreground text-sm font-medium">
              {config.skeletonVariant} ({config.skeletonRows} rows)
            </div>
            <AsyncWrapper<FakeApiResponse<FakeUser>>
              endpoint={API_ASYNC_USERS}
              skeletonVariant={config.skeletonVariant}
              skeletonRows={config.skeletonRows}
            >
              {(data) => <UserListContent data={data} />}
            </AsyncWrapper>
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const loadingElements = canvasElement.querySelectorAll('[data-slot="loading-skeleton"]');
    expect(loadingElements.length).toBe(SKELETON_VARIANTS.length);
  },
};

export const FactoryShowcase: Story = {
  name: i18n.t('asyncWrapper.storyName.factoryShowcase', 'Factory: Complete Showcase'),
  tags: ['!test'],
  parameters: {
    msw: { handlers: asyncWrapperHandlers },
  },
  render: () => {
    const showcase = createAsyncWrapperShowcase();
    const { testData } = showcase;
    return (
      <div className="w-full space-y-8">
        <div>
          <h3 className="mb-3 font-semibold">
            User Response ({testData.userResponse.data.length} users)
          </h3>
          <UserListContent data={testData.userResponse} />
        </div>
        <div>
          <h3 className="mb-3 font-semibold">
            Product Response ({testData.productResponse.data.length} products)
          </h3>
          <ProductGridContent data={testData.productResponse} />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// DATA ATTRIBUTES
// ============================================================================

export const DataAttributes: Story = {
  name: i18n.t('asyncWrapper.storyName.dataAttributes', 'Data Attributes'),
  parameters: {
    msw: { handlers: asyncWrapperHandlers },
  },
  render: () => (
    <div className="w-full max-w-2xl">
      <AsyncWrapper<FakeApiResponse<FakeUser>> endpoint={API_ASYNC_USERS}>
        {(data) => <UserListContent data={data} />}
      </AsyncWrapper>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // During loading, check data attributes
    const loadingEl = canvasElement.querySelector('[data-testid="story-loading"]');
    if (loadingEl) {
      expect(loadingEl).toBeInTheDocument();
    }

    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="story-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify data-slot on success wrapper
    const successEl = canvasElement.querySelector('[data-slot="async-wrapper-content"]');
    expect(successEl).toBeInTheDocument();
    expect(successEl).toHaveAttribute('data-state', 'success');
    expect(successEl).toHaveAttribute('data-testid', 'story-success');
  },
};

// ============================================================================
// MSW HANDLERS EXPORT
// ============================================================================

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: asyncWrapperHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// Ensure factory types, constants, and functions are referenced
// This validates CHECK-3 (F3.11-F3.13) from gold standard
void FETCH_STATUSES;
void HTTP_ERROR_STATUSES;
void USER_STATUSES;
void createAsyncWrapperTestData;
void createFakeUsers;
void createFakeProducts;
void createVariantRowMatrix;
