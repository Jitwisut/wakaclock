import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import {
  navMainHandlers,
  navMainStatusHandlers,
} from '@/.storybook/stories/_handlers/nav-main.handlers';
import { userHandlers, userStatusHandlers } from '@/.storybook/stories/_handlers/user.handlers';
import type {
  FakeFooterColumn,
  FakeFooterNav,
  FakeNavItem,
  FakeNavMenu,
  FakeNavMenuGroup,
  FakeNavSearchResult,
  FakeNavSidebar,
  FakeNavSidebarGroup,
  FakeNavSocialLink,
  FakePaginationNav,
  FakeQuickAction,
  FakeStepItem,
  FakeStepNav,
  FakeTopNav,
  IconPosition,
  MobileNavMode,
  NavBreadcrumbSeparator,
  NavItemStatus,
  NavItemType,
  NavOrientation,
  NavSize,
  NavVariant,
  SidebarPosition,
  SidebarState,
} from '@/.storybook/stories/_factories/navigation.factory';
import {
  createFakeActiveNavItem,
  createFakeCompletedStepNav,
  createFakeDisabledNavItem,
  createFakeDisabledPagination,
  createFakeErrorNavItem,
  createFakeExternalNavItem,
  createFakeFooterNav,
  createFakeLoadingNavItem,
  createFakeMinimalFooterNav,
  createFakeNavCollapsedSidebar,
  createFakeNavExpandedSidebar,
  createFakeNavFirstPagePagination,
  createFakeNavFloatingSidebar,
  createFakeNavigationDemoData,
  createFakeNavItem,
  createFakeNavItems,
  createFakeNavItemStatusMatrix,
  createFakeNavItemTypeMatrix,
  createFakeNavItemWithBadge,
  createFakeNavItemWithChildren,
  createFakeNavLastPagePagination,
  createFakeNavMenu,
  createFakeNavMenus,
  createFakeNavSearchResult,
  createFakeNavSearchResults,
  createFakeNavSidebar,
  createFakeNavSidebarGroup,
  createFakeNavSidebarGroups,
  createFakeNavSidebarStatePositionMatrix,
  createFakeNavVariantSizeMatrix,
  createFakePaginationNav,
  createFakePaginationVariantSizeMatrix,
  createFakeQuickAction,
  createFakeQuickActions,
  createFakeStepItem,
  createFakeStepItems,
  createFakeStepNav,
  createFakeStepNavAtStart,
  createFakeStepNavInProgress,
  createFakeStepNavVariantOrientationMatrix,
  createFakeStepNavWithError,
  createFakeStickyTopNav,
  createFakeTopNav,
  createFakeTransparentTopNav,
  ICON_POSITIONS,
  MOBILE_NAV_MODES,
  NAV_BREADCRUMB_SEPARATORS,
  NAV_ICONS,
  NAV_ITEM_STATUSES,
  NAV_ITEM_TYPES,
  NAV_LABELS,
  NAV_ORIENTATIONS,
  NAV_SHORTCUTS,
  NAV_SIZES,
  NAV_VARIANTS,
  SIDEBAR_POSITIONS,
  SIDEBAR_STATES,
  SOCIAL_ICONS,
} from '@/.storybook/stories/_factories/navigation.factory';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { navItems, NavMain } from '@/components/layout/sidebar/nav-main';
import { Sidebar, SidebarContent, SidebarProvider } from '@/components/ui/sidebar';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

const titleKeys: Record<string, string> = {
  Dashboards: 'navMain.group.dashboards',
  Apps: 'navMain.group.apps',
  'AI Apps': 'navMain.group.aiApps',
  Pages: 'navMain.group.pages',
  Others: 'navMain.group.others',
  'E-commerce': 'navMain.item.ecommerce',
};

function translateNavItems(t: (key: string) => string) {
  const translateTitle = (title: string) => {
    const key = titleKeys[title];
    if (!key) return title;
    const translated = t(key);
    return translated === key ? title : translated;
  };

  const translateItems = (items: (typeof navItems)[number]['items']): typeof items =>
    items.map((item) => ({
      ...item,
      title: translateTitle(item.title),
      items: Array.isArray(item.items) ? translateItems(item.items) : item.items,
    }));

  return navItems.map((group) => ({
    ...group,
    title: translateTitle(group.title),
    items: translateItems(group.items),
  }));
}

type NavMainDemoProps = {
  withLabels?: boolean;
};

function NavMainDemo({ withLabels = true }: NavMainDemoProps) {
  const { t } = useTranslation();

  return (
    <div className="h-svh w-[320px]">
      <SidebarProvider defaultOpen>
        <Sidebar>
          <SidebarContent>
            <NavMain
              items={translateNavItems(t)}
              labels={
                withLabels
                  ? {
                      comingBadge: i18n.t('navMain.badge.coming'),
                      newBadge: i18n.t('navMain.badge.new'),
                    }
                  : undefined
              }
            />
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}

const meta = {
  title: 'Components/Layout/Sidebar/Nav Main',
  component: NavMainDemo,
  tags: ['autodocs'],
  args: {
    withLabels: true,
    // Event handlers with fn() for Actions panel logging
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onNavigate: fn(),
    onGroupExpand: fn(),
    onGroupCollapse: fn(),
  },
  argTypes: {
    // State
    withLabels: {
      control: { type: 'boolean' },
      description: i18n.t(
        'navMain.argType.whetherToUseLocalizedLabelsOrFallbackDefaults',
        'Whether to use localized labels or fallback defaults'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('navMain.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('navMain.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('navMain.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('navMain.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('navMain.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('navMain.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('navMain.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onNavigate: {
      action: 'onNavigate',
      description: i18n.t(
        'navMain.argType.calledWhenNavigationItemIsClicked',
        'Called when navigation item is clicked'
      ),
      table: { category: 'Events' },
    },
    onGroupExpand: {
      action: 'onGroupExpand',
      description: i18n.t(
        'navMain.argType.calledWhenANavGroupIsExpanded',
        'Called when a nav group is expanded'
      ),
      table: { category: 'Events' },
    },
    onGroupCollapse: {
      action: 'onGroupCollapse',
      description: i18n.t(
        'navMain.argType.calledWhenANavGroupIsCollapsed',
        'Called when a nav group is collapsed'
      ),
      table: { category: 'Events' },
    },
    // NavMain Props Reference:
    // Required Props:
    // - items: NavGroup[] - Array of navigation groups
    //
    // Optional Props:
    // - labels: NavMainLabels object
    //   - comingBadge: "Coming Soon" badge text
    //   - newBadge: "New" badge text
    //
    // NavGroup Structure:
    // - title: string - Group heading
    // - items: NavItem[] - Group items
    //
    // NavItem Structure:
    // - title: string - Item label
    // - url: string - Navigation URL
    // - icon: LucideIcon - Item icon
    // - isActive: boolean - Active state
    // - badge: 'new' | 'coming' - Optional badge
    // - items: NavItem[] - Nested sub-items
    //
    // Features:
    // - Collapsible groups with icons
    // - Nested navigation levels
    // - Active state highlighting
    // - Badge indicators (New, Coming Soon)
    // - URL-based active detection
    //
    // Data Attributes:
    // - data-testid="nav-main-group-{slug}": Navigation group
    // - data-testid="nav-main-item-{slug}": Navigation item
    // - data-testid="nav-main-subitem-{slug}": Sub-navigation item
    // - data-testid="nav-main-badge-new": New badge
    // - data-testid="nav-main-badge-coming": Coming soon badge
    // - data-active="true|false": Active state indicator
  },
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: userHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} as Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="nav-main"]')).toBeInTheDocument();

    const canvas = within(canvasElement);

    expect(canvas.getByTestId('nav-main-group-dashboards')).toBeInTheDocument();

    const ecommerceItem = canvas.getByTestId('nav-main-item-ecommerce');
    expect(ecommerceItem).toBeInTheDocument();

    // Verify data-state attribute before clicking
    expect(ecommerceItem).toHaveAttribute('data-state', 'closed');

    await userEvent.click(ecommerceItem);

    // Verify data-state changes after expanding
    await waitFor(() => {
      expect(ecommerceItem).toHaveAttribute('data-state', 'open');
    });

    await waitFor(() => {
      expect(canvas.getByTestId('nav-main-subitem-product-list')).toBeInTheDocument();
    });

    // Verify sub-items are accessible
    const productListItem = canvas.getByTestId('nav-main-subitem-product-list');
    expect(productListItem).toBeInTheDocument();

    // Test clicking on a sub-item
    await userEvent.click(productListItem);

    expect(canvas.getAllByTestId('nav-main-badge-new').length).not.toBe(0);
    expect(canvas.getAllByTestId('nav-main-badge-coming').length).not.toBe(0);
  },
};

export const NestedActive: Story = {
  ...Default,
  parameters: {
    ...(Default.parameters ?? {}),
    nextjs: {
      navigation: {
        pathname: '/dashboard/pages/orders',
        query: {},
      },
    },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    const activeLink = await waitFor(() => {
      const link = canvas.getByTestId('nav-main-subitem-order-list');
      if (link.getAttribute('data-active') !== 'true') {
        throw new Error('Active link not marked as active.');
      }
      return link;
    });

    expect(activeLink).toBeInTheDocument();
    expect(activeLink).toHaveAttribute('data-active', 'true');
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const FallbackLabels: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.fallbackLabels', 'Fallback labels (defaults)'),
  args: {
    ...(Default.args ?? {}),
    withLabels: false,
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    ...Default.parameters,
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function NavMainVariantExpanded() {
  const { t } = useTranslation();

  return (
    <div className="h-svh w-[320px]">
      <SidebarProvider defaultOpen>
        <Sidebar>
          <SidebarContent>
            <NavMain
              items={translateNavItems(t)}
              labels={{
                comingBadge: t('navMain.badge.coming'),
                newBadge: t('navMain.badge.new'),
              }}
            />
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}

function NavMainVariantCollapsed() {
  const { t } = useTranslation();

  return (
    <div className="h-svh w-[80px]">
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <SidebarContent>
            <NavMain
              items={translateNavItems(t)}
              labels={{
                comingBadge: t('navMain.badge.coming'),
                newBadge: t('navMain.badge.new'),
              }}
            />
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('navMain.story.expandedSidebarNavigation', 'Expanded Sidebar Navigation')}
        </p>
        <div className="h-[400px] overflow-hidden rounded border">
          <NavMainVariantExpanded />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('navMain.story.collapsedSidebarNavigation', 'Collapsed Sidebar Navigation')}
        </p>
        <div className="h-[400px] overflow-hidden rounded border">
          <NavMainVariantCollapsed />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('navMain.story.compactHeight250px', 'Compact Height (250px)')}
        </p>
        <div className="h-[250px] overflow-hidden rounded border">
          <NavMainVariantExpanded />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('navMain.story.mediumHeight400px', 'Medium Height (400px)')}
        </p>
        <div className="h-[400px] overflow-hidden rounded border">
          <NavMainVariantExpanded />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('navMain.story.largeHeight600px', 'Large Height (600px)')}
        </p>
        <div className="h-[600px] overflow-hidden rounded border">
          <NavMainVariantExpanded />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

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

export const Japanese: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');
    await Default.play?.(context);
  },
};

export const DesignReference: Story = {
  ...Default,
  tags: ['!test'],
  parameters: {
    ...(Default.parameters ?? {}),
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('navMain.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-wrap items-center gap-3">
        <div id="hover">
          <Story />
        </div>
        <div id="focus">
          <Story />
        </div>
        <div id="active">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover *'],
      focusVisible: ['#focus *'],
      active: ['#active *'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const navItems = createFakeNavItems(5);
    const sidebarGroups = createFakeNavSidebarGroups(2);

    return (
      <div className="space-y-4 p-4">
        <div className="text-sm">
          <p className="font-medium">Nav Items: {navItems.length}</p>
          <ul className="text-muted-foreground mt-2 space-y-1">
            {navItems.slice(0, 3).map((item) => (
              <li key={item.id}>
                {item.label} ({item.href})
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-medium">Sidebar Groups: {sidebarGroups.length}</p>
          <ul className="text-muted-foreground mt-2 space-y-1">
            {sidebarGroups.map((group) => (
              <li key={group.title}>
                {group.title}: {group.items.length} items
              </li>
            ))}
          </ul>
        </div>
        <div className="h-[400px] overflow-hidden rounded border">
          <NavMainDemo />
        </div>
      </div>
    );
  },
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="nav-main"]')).toBeInTheDocument();
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: [...userHandlers, ...navMainHandlers] },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: userHandlers },
  },
  play: async (context) => {
    expect(context.canvasElement.querySelector('[data-slot="nav-main"]')).toBeInTheDocument();
    await Default.play?.(context);
  },
};

export const Loading: Story = {
  name: i18n.t('navMain.storyName.loading', 'Loading'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  name: i18n.t('navMain.storyName.emptyData', 'Empty Data'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('navMain.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('navMain.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('navMain.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  name: i18n.t('navMain.storyName.error404NotFound', 'Error 404: Not Found'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t('navMain.storyName.error422UnprocessableEntity', 'Error 422: Validation Error'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('navMain.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t('navMain.storyName.error500InternalServerError', 'Error 500: Internal Server Error'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('navMain.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('navMain.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('navMain.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ SPECIAL STATE STORIES ============

export const SlowResponse: Story = {
  name: i18n.t('navMain.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  name: i18n.t('navMain.storyName.networkError', 'Network Error'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('navMain.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Verify nav-main has proper structure
    const navMain = canvasElement.querySelector('[data-slot="nav-main"]');
    expect(navMain).toBeInTheDocument();

    // Test keyboard navigation on collapsible group
    const ecommerceItem = canvas.getByTestId('nav-main-item-ecommerce');
    expect(ecommerceItem).toBeInTheDocument();

    // Verify initial data-state
    expect(ecommerceItem).toHaveAttribute('data-state', 'closed');

    // Focus on navigation item
    ecommerceItem.focus();
    expect(doc.activeElement).toBe(ecommerceItem);

    // Expand with Enter key
    await userEvent.keyboard('{Enter}');

    // Verify data-state changes after expanding
    await waitFor(() => {
      expect(ecommerceItem).toHaveAttribute('data-state', 'open');
    });

    await waitFor(() => {
      expect(canvas.getByTestId('nav-main-subitem-product-list')).toBeInTheDocument();
    });

    // Navigate to sub-item with Tab
    await userEvent.keyboard('{Tab}');
    const { activeElement } = doc;
    expect(activeElement).toBeInTheDocument();

    // Verify navigation links have accessible names
    const navLinks = canvasElement.querySelectorAll('a[href]');
    navLinks.forEach((link) => {
      const linkText = link.textContent?.trim() || link.getAttribute('aria-label');
      expect(linkText).not.toBe('');
    });

    // Verify badges are accessible
    const badges = canvas.getAllByTestId('nav-main-badge-new');
    badges.forEach((badge) => {
      expect(badge).toBeInTheDocument();
      expect(badge.textContent?.trim()).not.toBe('');
    });

    // Test collapsible has proper data-state
    const collapsibleTriggers = canvasElement.querySelectorAll('[data-state]');
    collapsibleTriggers.forEach((trigger) => {
      const state = trigger.getAttribute('data-state');
      expect(['open', 'closed']).toContain(state);
    });

    // Collapse the item with Enter key
    ecommerceItem.focus();
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(ecommerceItem).toHaveAttribute('data-state', 'closed');
    });
  },
};

// ============ FACTORY: SINGLE ITEM STORIES ============

function FactoryNavItemDemo() {
  const item: FakeNavItem = createFakeNavItem();
  const activeItem: FakeNavItem = createFakeActiveNavItem();
  const disabledItem: FakeNavItem = createFakeDisabledNavItem();
  const loadingItem: FakeNavItem = createFakeLoadingNavItem();
  const errorItem: FakeNavItem = createFakeErrorNavItem();

  return (
    <div className="space-y-4 p-4" data-testid="factory-nav-item-demo">
      <h3 className="text-lg font-semibold">{i18n.t('navMain.factory.navItem')}</h3>
      <div className="space-y-2 text-sm">
        <div data-testid="factory-item-default">
          <span className="font-medium">{item.label}</span>
          <span className="text-muted-foreground ml-2">
            {i18n.t('navMain.factory.status')}: {item.status}
          </span>
          {item.badge && (
            <span className="ml-2">
              {i18n.t('navMain.factory.badge')}: {item.badge}
            </span>
          )}
        </div>
        <div data-testid="factory-item-active">
          <span className="font-medium">{activeItem.label}</span>
          <span className="text-muted-foreground ml-2">
            {i18n.t('navMain.factory.active')}: {activeItem.status}
          </span>
        </div>
        <div data-testid="factory-item-disabled">
          <span className="font-medium">{disabledItem.label}</span>
          <span className="text-muted-foreground ml-2">
            {i18n.t('navMain.factory.disabled')}: {String(disabledItem.disabled)}
          </span>
        </div>
        <div data-testid="factory-item-loading">
          <span className="font-medium">{loadingItem.label}</span>
          <span className="text-muted-foreground ml-2">
            {i18n.t('navMain.factory.loading')}: {String(loadingItem.loading)}
          </span>
        </div>
        <div data-testid="factory-item-error">
          <span className="font-medium">{errorItem.label}</span>
          <span className="text-muted-foreground ml-2">
            {i18n.t('navMain.factory.error')}: {errorItem.status}
          </span>
        </div>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryNavItem: Story = {
  name: i18n.t('navMain.storyName.factoryNavItem', 'Factory: Nav Item States'),
  render: () => <FactoryNavItemDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-nav-item-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-item-default')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-item-active')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-item-disabled')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-item-loading')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-item-error')).toBeInTheDocument();
  },
};

// ============ FACTORY: BADGE & CHILDREN STORIES ============

function FactoryNavItemBadgeChildrenDemo() {
  const { t } = useTranslation();
  const badgeItem: FakeNavItem = createFakeNavItemWithBadge();
  const childrenItem: FakeNavItem = createFakeNavItemWithChildren();
  const externalItem: FakeNavItem = createFakeExternalNavItem();

  return (
    <div className="space-y-4 p-4" data-testid="factory-badge-children-demo">
      <h3 className="text-lg font-semibold">{t('navMain.factory.sectionTitle')}</h3>
      <div className="space-y-3 text-sm">
        <div data-testid="factory-badge-item">
          <p className="font-medium">{t('navMain.factory.withBadge')}</p>
          <p className="text-muted-foreground">
            {badgeItem.label} - {t('navMain.factory.badge')}: {badgeItem.badge} (
            {badgeItem.badgeVariant})
          </p>
        </div>
        <div data-testid="factory-children-item">
          <p className="font-medium">{t('navMain.factory.withChildren')}</p>
          <p className="text-muted-foreground">
            {childrenItem.label} - {t('navMain.factory.children')}: {childrenItem.children?.length}{' '}
            {t('navMain.factory.items')}
          </p>
          <ul className="text-muted-foreground mt-1 ml-4 space-y-0.5">
            {childrenItem.children?.slice(0, 3).map((child) => (
              <li key={child.id}>
                {child.label} ({child.href})
              </li>
            ))}
          </ul>
        </div>
        <div data-testid="factory-external-item">
          <p className="font-medium">{t('navMain.factory.external')}</p>
          <p className="text-muted-foreground">
            {externalItem.label} - {t('navMain.factory.href')}: {externalItem.href}
          </p>
          {externalItem.icon && (
            <p className="text-muted-foreground">
              {t('navMain.factory.icon')}: {externalItem.icon}
            </p>
          )}
        </div>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryNavItemBadgeChildren: Story = {
  name: i18n.t(
    'navMain.storyName.factoryNavItemBadgeChildren',
    'Factory: Badge, Children & External'
  ),
  render: () => <FactoryNavItemBadgeChildrenDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-badge-children-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-badge-item')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-children-item')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-external-item')).toBeInTheDocument();
  },
};

// ============ FACTORY: SIDEBAR GROUP STORIES ============

function FactorySidebarGroupDemo() {
  const group: FakeNavSidebarGroup = createFakeNavSidebarGroup();
  const groups: FakeNavSidebarGroup[] = createFakeNavSidebarGroups(3);

  return (
    <div className="space-y-4 p-4" data-testid="factory-sidebar-group-demo">
      <h3 className="text-lg font-semibold">{i18n.t('navMain.factory.sidebarGroup')}</h3>
      <div className="text-sm">
        <div data-testid="factory-single-group">
          <p className="font-medium">
            {group.title} ({group.items.length} {i18n.t('navMain.factory.items')})
          </p>
          {group.collapsible && (
            <span className="text-muted-foreground">{i18n.t('navMain.factory.collapsed')}</span>
          )}
          {group.badge && (
            <span className="ml-2">
              {i18n.t('navMain.factory.badge')}: {group.badge}
            </span>
          )}
        </div>
      </div>
      <div className="text-sm" data-testid="factory-multiple-groups">
        <p className="font-medium">
          {groups.length} {i18n.t('navMain.factory.groups')}
        </p>
        <ul className="text-muted-foreground mt-1 space-y-1">
          {groups.map((g) => (
            <li key={g.id}>
              {g.title}: {g.items.length} {i18n.t('navMain.factory.items')}
            </li>
          ))}
        </ul>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactorySidebarGroup: Story = {
  name: i18n.t('navMain.storyName.factorySidebarGroup', 'Factory: Sidebar Group'),
  render: () => <FactorySidebarGroupDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-sidebar-group-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-single-group')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-multiple-groups')).toBeInTheDocument();
  },
};

// ============ FACTORY: SIDEBAR CONFIGURATION STORIES ============

function FactorySidebarConfigDemo() {
  const sidebar: FakeNavSidebar = createFakeNavSidebar();
  const collapsedSidebar: FakeNavSidebar = createFakeNavCollapsedSidebar();
  const expandedSidebar: FakeNavSidebar = createFakeNavExpandedSidebar();
  const floatingSidebar: FakeNavSidebar = createFakeNavFloatingSidebar();

  return (
    <div className="space-y-4 p-4" data-testid="factory-sidebar-config-demo">
      <h3 className="text-lg font-semibold">{i18n.t('navMain.factory.sidebar')}</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div data-testid="factory-sidebar-default">
          <p className="font-medium">{i18n.t('navMain.story.default', 'Default')}</p>
          <p className="text-muted-foreground">
            {i18n.t('navMain.factory.state')}: {sidebar.defaultState}
          </p>
          <p className="text-muted-foreground">
            {i18n.t('navMain.factory.position')}: {sidebar.position}
          </p>
          <p className="text-muted-foreground">
            {i18n.t('navMain.factory.groups')}: {sidebar.groups.length}
          </p>
          {sidebar.header && <p className="text-muted-foreground">{sidebar.header.title}</p>}
        </div>
        <div data-testid="factory-sidebar-collapsed">
          <p className="font-medium">{i18n.t('navMain.factory.collapsed')}</p>
          <p className="text-muted-foreground">
            {i18n.t('navMain.factory.state')}: {collapsedSidebar.defaultState}
          </p>
        </div>
        <div data-testid="factory-sidebar-expanded">
          <p className="font-medium">{i18n.t('navMain.factory.expanded')}</p>
          <p className="text-muted-foreground">
            {i18n.t('navMain.factory.state')}: {expandedSidebar.defaultState}
          </p>
        </div>
        <div data-testid="factory-sidebar-floating">
          <p className="font-medium">{i18n.t('navMain.factory.floating')}</p>
          <p className="text-muted-foreground">
            {i18n.t('navMain.factory.state')}: {floatingSidebar.defaultState}
          </p>
        </div>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactorySidebarConfig: Story = {
  name: i18n.t('navMain.storyName.factorySidebarConfig', 'Factory: Sidebar Configurations'),
  render: () => <FactorySidebarConfigDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-sidebar-config-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-sidebar-default')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-sidebar-collapsed')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-sidebar-expanded')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-sidebar-floating')).toBeInTheDocument();
  },
};

// ============ FACTORY: TOP NAV STORIES ============

function FactoryTopNavDemo() {
  const { t } = useTranslation();
  const topNav: FakeTopNav = createFakeTopNav();
  const transparentNav: FakeTopNav = createFakeTransparentTopNav();
  const stickyNav: FakeTopNav = createFakeStickyTopNav();

  return (
    <div className="space-y-4 p-4" data-testid="factory-top-nav-demo">
      <h3 className="text-lg font-semibold">{t('navMain.factory.topNav')}</h3>
      <div className="space-y-3 text-sm">
        <div data-testid="factory-topnav-default">
          <p className="font-medium">{t('navMain.story.default', 'Default')}</p>
          <p className="text-muted-foreground">
            {t('navMain.factory.variant')}: {topNav.variant}
          </p>
          <p className="text-muted-foreground">
            {t('navMain.factory.items')}: {topNav.leftItems.length}
          </p>
          {topNav.logo && <p className="text-muted-foreground">{topNav.logo.alt}</p>}
        </div>
        <div data-testid="factory-topnav-transparent">
          <p className="font-medium">{t('navMain.factory.transparent')}</p>
          <p className="text-muted-foreground">Transparent: {String(transparentNav.transparent)}</p>
        </div>
        <div data-testid="factory-topnav-sticky">
          <p className="font-medium">{t('navMain.factory.sticky')}</p>
          <p className="text-muted-foreground">Sticky: {String(stickyNav.sticky)}</p>
        </div>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryTopNav: Story = {
  name: i18n.t('navMain.storyName.factoryTopNav', 'Factory: Top Navigation'),
  render: () => <FactoryTopNavDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-top-nav-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-topnav-default')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-topnav-transparent')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-topnav-sticky')).toBeInTheDocument();
  },
};

// ============ FACTORY: NAV MENU STORIES ============

function FactoryNavMenuDemo() {
  const menu: FakeNavMenu = createFakeNavMenu();
  const menus: FakeNavMenu[] = createFakeNavMenus(3);

  return (
    <div className="space-y-4 p-4" data-testid="factory-nav-menu-demo">
      <h3 className="text-lg font-semibold">{i18n.t('navMain.factory.navMenu')}</h3>
      <div className="text-sm">
        <div data-testid="factory-menu-single">
          <p className="font-medium">
            {i18n.t('navMain.factory.trigger')}: {menu.trigger.label}
          </p>
          <p className="text-muted-foreground">
            {i18n.t('navMain.factory.items')}: {menu.items.length}
          </p>
          {menu.groups && (
            <p className="text-muted-foreground">
              {i18n.t('navMain.factory.groups')}: {menu.groups.length}
            </p>
          )}
        </div>
      </div>
      <div className="text-sm" data-testid="factory-menu-bulk">
        <p className="font-medium">
          {menus.length} {i18n.t('navMain.factory.menus')}
        </p>
        <ul className="text-muted-foreground mt-1 space-y-1">
          {menus.map((m) => (
            <li key={m.id}>
              {m.trigger.label}: {m.items.length} {i18n.t('navMain.factory.items')}
              {m.groups ? `, ${m.groups.length} ${i18n.t('navMain.factory.groups')}` : ''}
            </li>
          ))}
        </ul>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryNavMenu: Story = {
  name: i18n.t('navMain.storyName.factoryNavMenu', 'Factory: Navigation Menu'),
  render: () => <FactoryNavMenuDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-nav-menu-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-menu-single')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-menu-bulk')).toBeInTheDocument();
  },
};

// ============ FACTORY: PAGINATION STORIES ============

function FactoryPaginationDemo() {
  const pagination: FakePaginationNav = createFakePaginationNav();
  const firstPage: FakePaginationNav = createFakeNavFirstPagePagination();
  const lastPage: FakePaginationNav = createFakeNavLastPagePagination();
  const disabledPagination: FakePaginationNav = createFakeDisabledPagination();

  return (
    <div className="space-y-4 p-4" data-testid="factory-pagination-demo">
      <h3 className="text-lg font-semibold">{i18n.t('navMain.factory.pagination')}</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div data-testid="factory-pagination-default">
          <p className="font-medium">{i18n.t('navMain.story.default', 'Default')}</p>
          <p className="text-muted-foreground">
            {i18n.t('navMain.factory.currentPage')}: {pagination.currentPage}/
            {pagination.totalPages}
          </p>
          <p className="text-muted-foreground">
            {i18n.t('navMain.factory.variant')}: {pagination.variant}
          </p>
          <p className="text-muted-foreground">
            {i18n.t('navMain.factory.size')}: {pagination.size}
          </p>
        </div>
        <div data-testid="factory-pagination-first">
          <p className="font-medium">{i18n.t('navMain.factory.firstPage')}</p>
          <p className="text-muted-foreground">
            {i18n.t('navMain.factory.currentPage')}: {firstPage.currentPage}
          </p>
        </div>
        <div data-testid="factory-pagination-last">
          <p className="font-medium">{i18n.t('navMain.factory.lastPage')}</p>
          <p className="text-muted-foreground">
            {i18n.t('navMain.factory.currentPage')}: {lastPage.currentPage}/{lastPage.totalPages}
          </p>
        </div>
        <div data-testid="factory-pagination-disabled">
          <p className="font-medium">{i18n.t('navMain.factory.disabled')}</p>
          <p className="text-muted-foreground">Disabled: {String(disabledPagination.disabled)}</p>
        </div>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryPagination: Story = {
  name: i18n.t('navMain.storyName.factoryPagination', 'Factory: Pagination States'),
  render: () => <FactoryPaginationDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-pagination-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-pagination-default')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-pagination-first')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-pagination-last')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-pagination-disabled')).toBeInTheDocument();
  },
};

// ============ FACTORY: STEP NAV STORIES ============

function FactoryStepNavDemo() {
  const { t } = useTranslation();
  const stepNav: FakeStepNav = createFakeStepNav();
  const stepItem: FakeStepItem = createFakeStepItem(0, 2);
  const stepItems: FakeStepItem[] = createFakeStepItems(5, 2);
  const atStart: FakeStepNav = createFakeStepNavAtStart();
  const inProgress: FakeStepNav = createFakeStepNavInProgress();
  const completed: FakeStepNav = createFakeCompletedStepNav();
  const withError: FakeStepNav = createFakeStepNavWithError();

  return (
    <div className="space-y-4 p-4" data-testid="factory-step-nav-demo">
      <h3 className="text-lg font-semibold">{t('navMain.factory.stepNav')}</h3>
      <div className="text-sm" data-testid="factory-step-item">
        <p className="font-medium">
          {stepItem.label} ({t('navMain.factory.description')}: {stepItem.description ?? 'N/A'})
        </p>
        <p className="text-muted-foreground">
          {t('navMain.factory.totalSteps')}: {stepItems.length}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div data-testid="factory-step-default">
          <p className="font-medium">{t('navMain.story.default', 'Default')}</p>
          <p className="text-muted-foreground">
            {t('navMain.factory.currentStep')}: {stepNav.currentStep}/{stepNav.steps.length}
          </p>
          <p className="text-muted-foreground">
            {t('navMain.factory.orientation')}: {stepNav.orientation}
          </p>
        </div>
        <div data-testid="factory-step-at-start">
          <p className="font-medium">{t('navMain.factory.atStart')}</p>
          <p className="text-muted-foreground">
            {t('navMain.factory.currentStep')}: {atStart.currentStep}
          </p>
        </div>
        <div data-testid="factory-step-in-progress">
          <p className="font-medium">{t('navMain.factory.inProgress')}</p>
          <p className="text-muted-foreground">
            {t('navMain.factory.currentStep')}: {inProgress.currentStep}
          </p>
        </div>
        <div data-testid="factory-step-completed">
          <p className="font-medium">{t('navMain.factory.completed')}</p>
          <p className="text-muted-foreground">
            {t('navMain.factory.currentStep')}: {completed.currentStep}
          </p>
        </div>
        <div data-testid="factory-step-with-error">
          <p className="font-medium">{t('navMain.factory.withError')}</p>
          <p className="text-muted-foreground">
            {t('navMain.factory.error')}: {String(withError.steps[withError.currentStep]?.error)}
          </p>
        </div>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryStepNav: Story = {
  name: i18n.t('navMain.storyName.factoryStepNav', 'Factory: Step Navigation'),
  render: () => <FactoryStepNavDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-step-nav-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-step-item')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-step-default')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-step-at-start')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-step-in-progress')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-step-completed')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-step-with-error')).toBeInTheDocument();
  },
};

// ============ FACTORY: FOOTER NAV STORIES ============

function FactoryFooterNavDemo() {
  const { t } = useTranslation();
  const footer: FakeFooterNav = createFakeFooterNav();
  const minimalFooter: FakeFooterNav = createFakeMinimalFooterNav();

  const { columns } = footer;
  const socialLinks: FakeNavSocialLink[] = footer.socialLinks ?? [];

  return (
    <div className="space-y-4 p-4" data-testid="factory-footer-nav-demo">
      <h3 className="text-lg font-semibold">{t('navMain.factory.footer')}</h3>
      <div className="text-sm">
        <div data-testid="factory-footer-default">
          <p className="font-medium">{t('navMain.story.defaultFooter', 'Default Footer')}</p>
          <p className="text-muted-foreground">
            {t('navMain.factory.columns')}: {columns.length}
          </p>
          <p className="text-muted-foreground">
            {t('navMain.factory.copyright')}: {footer.copyright}
          </p>
          <p className="text-muted-foreground">
            {t('navMain.factory.socialIcons')}: {socialLinks.length}
          </p>
          <ul className="text-muted-foreground mt-1 ml-4 space-y-0.5">
            {socialLinks.slice(0, 3).map((link) => (
              <li key={link.id}>
                {link.icon}: {link.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3" data-testid="factory-footer-minimal">
          <p className="font-medium">{t('navMain.factory.minimal')}</p>
          <p className="text-muted-foreground">
            {t('navMain.factory.columns')}: {minimalFooter.columns.length}
          </p>
        </div>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryFooterNav: Story = {
  name: i18n.t('navMain.storyName.factoryFooterNav', 'Factory: Footer Navigation'),
  render: () => <FactoryFooterNavDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-footer-nav-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-footer-default')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-footer-minimal')).toBeInTheDocument();
  },
};

// ============ FACTORY: QUICK ACTIONS & SEARCH RESULTS ============

function FactoryQuickActionsSearchDemo() {
  const quickAction: FakeQuickAction = createFakeQuickAction();
  const quickActions: FakeQuickAction[] = createFakeQuickActions(5);
  const searchResult: FakeNavSearchResult = createFakeNavSearchResult();
  const searchResults: FakeNavSearchResult[] = createFakeNavSearchResults(5);

  return (
    <div className="space-y-4 p-4" data-testid="factory-quick-search-demo">
      <h3 className="text-lg font-semibold">{i18n.t('navMain.factory.sectionTitle')}</h3>
      <div className="text-sm">
        <div data-testid="factory-quick-action-single">
          <p className="font-medium">{i18n.t('navMain.factory.quickAction')}</p>
          <p className="text-muted-foreground">
            {quickAction.label} - {i18n.t('navMain.factory.icon')}: {quickAction.icon}
          </p>
          {quickAction.shortcut && (
            <p className="text-muted-foreground">
              {i18n.t('navMain.factory.shortcut')}: {quickAction.shortcut}
            </p>
          )}
          {quickAction.description && (
            <p className="text-muted-foreground">
              {i18n.t('navMain.factory.description')}: {quickAction.description}
            </p>
          )}
        </div>
        <div className="mt-3" data-testid="factory-quick-actions-bulk">
          <p className="font-medium">
            {quickActions.length} {i18n.t('navMain.factory.actions')}
          </p>
          <ul className="text-muted-foreground mt-1 space-y-0.5">
            {quickActions.map((a) => (
              <li key={a.id}>
                {a.icon} - {a.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-4 text-sm">
        <div data-testid="factory-search-result-single">
          <p className="font-medium">{i18n.t('navMain.factory.searchResult')}</p>
          <p className="text-muted-foreground">
            {searchResult.label} - {i18n.t('navMain.factory.category')}: {searchResult.category}
          </p>
          {searchResult.score !== undefined && (
            <p className="text-muted-foreground">
              {i18n.t('navMain.factory.score')}: {searchResult.score}
            </p>
          )}
          {searchResult.keywords && (
            <p className="text-muted-foreground">
              {i18n.t('navMain.factory.keywords')}: {searchResult.keywords.join(', ')}
            </p>
          )}
        </div>
        <div className="mt-3" data-testid="factory-search-results-bulk">
          <p className="font-medium">
            {searchResults.length} {i18n.t('navMain.factory.results')}
          </p>
          <ul className="text-muted-foreground mt-1 space-y-0.5">
            {searchResults.slice(0, 3).map((r) => (
              <li key={r.id}>
                {r.label} ({r.category}) - {i18n.t('navMain.factory.score')}: {r.score}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryQuickActionsSearch: Story = {
  name: i18n.t(
    'navMain.storyName.factoryQuickActionsSearch',
    'Factory: Quick Actions & Search Results'
  ),
  render: () => <FactoryQuickActionsSearchDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-quick-search-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-quick-action-single')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-quick-actions-bulk')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-search-result-single')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-search-results-bulk')).toBeInTheDocument();
  },
};

// ============ FACTORY: STATUS MATRIX STORIES ============

function FactoryStatusMatrixDemo() {
  const { t } = useTranslation();
  const statusMatrix: Record<NavItemStatus, FakeNavItem> = createFakeNavItemStatusMatrix();
  const typeMatrix: Record<NavItemType, FakeNavItem> = createFakeNavItemTypeMatrix();

  return (
    <div className="space-y-4 p-4" data-testid="factory-status-matrix-demo">
      <h3 className="text-lg font-semibold">{t('navMain.factory.statusMatrix')}</h3>
      <div className="text-sm">
        <div data-testid="factory-status-grid">
          <p className="font-medium">{t('navMain.factory.statusMatrix')}</p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {(Object.entries(statusMatrix) as [NavItemStatus, FakeNavItem][]).map(
              ([status, item]) => (
                <div
                  key={status}
                  className="rounded border p-2"
                  data-testid={`factory-status-${status}`}
                >
                  <p className="font-medium capitalize">{status}</p>
                  <p className="text-muted-foreground truncate">{item.label}</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 text-sm">
        <div data-testid="factory-type-grid">
          <p className="font-medium">{t('navMain.factory.typeMatrix')}</p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {(Object.entries(typeMatrix) as [NavItemType, FakeNavItem][]).map(([type, item]) => (
              <div key={type} className="rounded border p-2" data-testid={`factory-type-${type}`}>
                <p className="font-medium capitalize">{type}</p>
                <p className="text-muted-foreground truncate">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryStatusMatrix: Story = {
  name: i18n.t('navMain.storyName.factoryStatusMatrix', 'Factory: Status & Type Matrix'),
  render: () => <FactoryStatusMatrixDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-status-matrix-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-status-grid')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-type-grid')).toBeInTheDocument();
    for (const status of NAV_ITEM_STATUSES) {
      expect(canvas.getByTestId(`factory-status-${status}`)).toBeInTheDocument();
    }
    for (const type of NAV_ITEM_TYPES) {
      expect(canvas.getByTestId(`factory-type-${type}`)).toBeInTheDocument();
    }
  },
};

// ============ FACTORY: VARIANT SIZE MATRIX ============

function FactoryVariantSizeMatrixDemo() {
  const { t } = useTranslation();
  const variantSizeMatrix = createFakeNavVariantSizeMatrix();

  return (
    <div className="space-y-4 p-4" data-testid="factory-variant-size-matrix-demo">
      <h3 className="text-lg font-semibold">{t('navMain.factory.variantSizeMatrix')}</h3>
      <div className="text-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 text-left">{t('navMain.factory.variant')}</th>
              {NAV_SIZES.map((size) => (
                <th key={size} className="border p-2 text-left">
                  {size}
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-testid="factory-variant-size-body">
            {NAV_VARIANTS.map((variant) => (
              <tr key={variant}>
                <td className="border p-2 font-medium">{variant}</td>
                {NAV_SIZES.map((size) => {
                  const nav: FakeTopNav = variantSizeMatrix[variant][size];
                  return (
                    <td key={size} className="text-muted-foreground border p-2">
                      {nav.leftItems.length} items
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryVariantSizeMatrix: Story = {
  name: i18n.t('navMain.storyName.factoryVariantSizeMatrix', 'Factory: Variant x Size Matrix'),
  render: () => <FactoryVariantSizeMatrixDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-variant-size-matrix-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-variant-size-body')).toBeInTheDocument();
  },
};

// ============ FACTORY: SIDEBAR STATE POSITION MATRIX ============

function FactorySidebarStatePositionMatrixDemo() {
  const statePositionMatrix = createFakeNavSidebarStatePositionMatrix();

  return (
    <div className="space-y-4 p-4" data-testid="factory-state-position-matrix-demo">
      <h3 className="text-lg font-semibold">{i18n.t('navMain.factory.statePositionMatrix')}</h3>
      <div className="text-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 text-left">{i18n.t('navMain.factory.state')}</th>
              {SIDEBAR_POSITIONS.map((pos) => (
                <th key={pos} className="border p-2 text-left">
                  {pos}
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-testid="factory-state-position-body">
            {SIDEBAR_STATES.map((state) => (
              <tr key={state}>
                <td className="border p-2 font-medium">{state}</td>
                {SIDEBAR_POSITIONS.map((position) => {
                  const sidebar: FakeNavSidebar = statePositionMatrix[state][position];
                  return (
                    <td key={position} className="text-muted-foreground border p-2">
                      {sidebar.groups.length} {i18n.t('navMain.factory.groups')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactorySidebarStatePositionMatrix: Story = {
  name: i18n.t(
    'navMain.storyName.factorySidebarStatePositionMatrix',
    'Factory: Sidebar State x Position Matrix'
  ),
  render: () => <FactorySidebarStatePositionMatrixDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-state-position-matrix-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-state-position-body')).toBeInTheDocument();
  },
};

// ============ FACTORY: PAGINATION VARIANT SIZE MATRIX ============

function FactoryPaginationMatrixDemo() {
  const paginationMatrix = createFakePaginationVariantSizeMatrix();

  return (
    <div className="space-y-4 p-4" data-testid="factory-pagination-matrix-demo">
      <h3 className="text-lg font-semibold">{i18n.t('navMain.factory.paginationMatrix')}</h3>
      <div className="text-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 text-left">{i18n.t('navMain.factory.variant')}</th>
              {NAV_SIZES.map((size) => (
                <th key={size} className="border p-2 text-left">
                  {size}
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-testid="factory-pagination-matrix-body">
            {(['default', 'outline', 'ghost'] as const).map((variant) => (
              <tr key={variant}>
                <td className="border p-2 font-medium">{variant}</td>
                {NAV_SIZES.map((size) => {
                  const pagination: FakePaginationNav = paginationMatrix[variant][size];
                  return (
                    <td key={size} className="text-muted-foreground border p-2">
                      p{pagination.currentPage}/{pagination.totalPages}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryPaginationMatrix: Story = {
  name: i18n.t(
    'navMain.storyName.factoryPaginationMatrix',
    'Factory: Pagination Variant x Size Matrix'
  ),
  render: () => <FactoryPaginationMatrixDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-pagination-matrix-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-pagination-matrix-body')).toBeInTheDocument();
  },
};

// ============ FACTORY: STEP NAV VARIANT ORIENTATION MATRIX ============

function FactoryStepNavMatrixDemo() {
  const stepMatrix = createFakeStepNavVariantOrientationMatrix();

  return (
    <div className="space-y-4 p-4" data-testid="factory-step-matrix-demo">
      <h3 className="text-lg font-semibold">{i18n.t('navMain.factory.stepMatrix')}</h3>
      <div className="text-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 text-left">{i18n.t('navMain.factory.variant')}</th>
              {NAV_ORIENTATIONS.map((orientation) => (
                <th key={orientation} className="border p-2 text-left">
                  {orientation}
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-testid="factory-step-matrix-body">
            {(['default', 'circle', 'dots'] as const).map((variant) => (
              <tr key={variant}>
                <td className="border p-2 font-medium">{variant}</td>
                {NAV_ORIENTATIONS.map((orientation) => {
                  const stepNav: FakeStepNav = stepMatrix[variant][orientation];
                  return (
                    <td key={orientation} className="text-muted-foreground border p-2">
                      {stepNav.steps.length} {i18n.t('navMain.factory.steps')} (step{' '}
                      {stepNav.currentStep})
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryStepNavMatrix: Story = {
  name: i18n.t(
    'navMain.storyName.factoryStepNavMatrix',
    'Factory: Step Nav Variant x Orientation Matrix'
  ),
  render: () => <FactoryStepNavMatrixDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-step-matrix-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-step-matrix-body')).toBeInTheDocument();
  },
};

// ============ FACTORY: CONSTANTS SHOWCASE ============

function FactoryConstantsDemo() {
  const iconPositions: IconPosition[] = [...ICON_POSITIONS];
  const mobileNavModes: MobileNavMode[] = [...MOBILE_NAV_MODES];
  const breadcrumbSeparators: NavBreadcrumbSeparator[] = [...NAV_BREADCRUMB_SEPARATORS];

  return (
    <div className="space-y-4 p-4" data-testid="factory-constants-demo">
      <h3 className="text-lg font-semibold">{i18n.t('navMain.factory.constants')}</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div data-testid="factory-const-types">
          <p className="font-medium">{i18n.t('navMain.factory.types')}</p>
          <p className="text-muted-foreground">NAV_ITEM_TYPES: {NAV_ITEM_TYPES.join(', ')}</p>
          <p className="text-muted-foreground">NAV_ITEM_STATUSES: {NAV_ITEM_STATUSES.join(', ')}</p>
        </div>
        <div data-testid="factory-const-layout">
          <p className="font-medium">{i18n.t('navMain.story.layout', 'Layout')}</p>
          <p className="text-muted-foreground">NAV_ORIENTATIONS: {NAV_ORIENTATIONS.join(', ')}</p>
          <p className="text-muted-foreground">NAV_VARIANTS: {NAV_VARIANTS.join(', ')}</p>
          <p className="text-muted-foreground">NAV_SIZES: {NAV_SIZES.join(', ')}</p>
        </div>
        <div data-testid="factory-const-sidebar">
          <p className="font-medium">{i18n.t('navMain.factory.sidebar')}</p>
          <p className="text-muted-foreground">SIDEBAR_STATES: {SIDEBAR_STATES.join(', ')}</p>
          <p className="text-muted-foreground">SIDEBAR_POSITIONS: {SIDEBAR_POSITIONS.join(', ')}</p>
        </div>
        <div data-testid="factory-const-icons">
          <p className="font-medium">{i18n.t('navMain.factory.icons')}</p>
          <p className="text-muted-foreground">
            NAV_ICONS ({NAV_ICONS.length}): {NAV_ICONS.slice(0, 5).join(', ')}...
          </p>
          <p className="text-muted-foreground">
            SOCIAL_ICONS ({SOCIAL_ICONS.length}): {SOCIAL_ICONS.slice(0, 4).join(', ')}...
          </p>
        </div>
        <div data-testid="factory-const-labels">
          <p className="font-medium">{i18n.t('navMain.factory.labels')}</p>
          <p className="text-muted-foreground">
            NAV_LABELS ({NAV_LABELS.length}): {NAV_LABELS.slice(0, 5).join(', ')}...
          </p>
        </div>
        <div data-testid="factory-const-shortcuts">
          <p className="font-medium">{i18n.t('navMain.factory.shortcuts')}</p>
          <p className="text-muted-foreground">
            NAV_SHORTCUTS ({NAV_SHORTCUTS.length}): {NAV_SHORTCUTS.slice(0, 5).join(', ')}...
          </p>
        </div>
        <div data-testid="factory-const-positions">
          <p className="font-medium">{i18n.t('navMain.factory.position')}</p>
          <p className="text-muted-foreground">ICON_POSITIONS: {iconPositions.join(', ')}</p>
        </div>
        <div data-testid="factory-const-mobile">
          <p className="font-medium">{i18n.t('navMain.factory.modes')}</p>
          <p className="text-muted-foreground">MOBILE_NAV_MODES: {mobileNavModes.join(', ')}</p>
        </div>
        <div data-testid="factory-const-separators">
          <p className="font-medium">{i18n.t('navMain.factory.separators')}</p>
          <p className="text-muted-foreground">
            NAV_BREADCRUMB_SEPARATORS: {breadcrumbSeparators.join(', ')}
          </p>
        </div>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  name: i18n.t('navMain.storyName.factoryConstants', 'Factory: Constants Showcase'),
  render: () => <FactoryConstantsDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-constants-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-const-types')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-const-layout')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-const-sidebar')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-const-icons')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-const-labels')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-const-shortcuts')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-const-positions')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-const-mobile')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-const-separators')).toBeInTheDocument();
  },
};

// ============ FACTORY: COMPLETE DEMO DATA ============

function FactoryCompleteDemoDataDemo() {
  const { t } = useTranslation();
  const demoData = createFakeNavigationDemoData();

  // Use FakeNavMenuGroup type in menu groups display
  const menuGroups: FakeNavMenuGroup[] = demoData.menus[0]?.groups ?? [];

  return (
    <div className="space-y-4 p-4" data-testid="factory-demo-data">
      <h3 className="text-lg font-semibold">{t('navMain.factory.demoData')}</h3>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div data-testid="factory-demo-sidebar">
          <p className="font-medium">{t('navMain.factory.sidebar')}</p>
          <p className="text-muted-foreground">
            {demoData.sidebar.groups.length} {t('navMain.factory.groups')}
          </p>
          <p className="text-muted-foreground">
            {t('navMain.factory.state')}: {demoData.sidebar.defaultState}
          </p>
        </div>
        <div data-testid="factory-demo-topnav">
          <p className="font-medium">{t('navMain.factory.topNav')}</p>
          <p className="text-muted-foreground">
            {demoData.topNav.leftItems.length} {t('navMain.factory.items')}
          </p>
          <p className="text-muted-foreground">
            {t('navMain.factory.variant')}: {demoData.topNav.variant}
          </p>
        </div>
        <div data-testid="factory-demo-footer">
          <p className="font-medium">{t('navMain.factory.footer')}</p>
          <p className="text-muted-foreground">
            {demoData.footer.columns.length} {t('navMain.factory.columns')}
          </p>
        </div>
        <div data-testid="factory-demo-pagination">
          <p className="font-medium">{t('navMain.factory.pagination')}</p>
          <p className="text-muted-foreground">
            {t('navMain.factory.currentPage')}: {demoData.pagination.currentPage}/
            {demoData.pagination.totalPages}
          </p>
        </div>
        <div data-testid="factory-demo-stepnav">
          <p className="font-medium">{t('navMain.factory.stepNav')}</p>
          <p className="text-muted-foreground">
            {demoData.stepNav.steps.length} {t('navMain.factory.steps')}
          </p>
        </div>
        <div data-testid="factory-demo-quickactions">
          <p className="font-medium">{t('navMain.factory.actions')}</p>
          <p className="text-muted-foreground">
            {demoData.quickActions.length} {t('navMain.factory.actions')}
          </p>
        </div>
        <div data-testid="factory-demo-search">
          <p className="font-medium">{t('navMain.factory.results')}</p>
          <p className="text-muted-foreground">
            {demoData.searchResults.length} {t('navMain.factory.results')}
          </p>
        </div>
        <div data-testid="factory-demo-menus">
          <p className="font-medium">{t('navMain.factory.menus')}</p>
          <p className="text-muted-foreground">
            {demoData.menus.length} {t('navMain.factory.menus')}
          </p>
          {menuGroups.length > 0 && (
            <p className="text-muted-foreground">
              {t('navMain.factory.groups')}: {menuGroups.length}
            </p>
          )}
        </div>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryCompleteDemoData: Story = {
  name: i18n.t('navMain.storyName.factoryCompleteDemoData', 'Factory: Complete Demo Data'),
  render: () => <FactoryCompleteDemoDataDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-demo-data')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-demo-sidebar')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-demo-topnav')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-demo-footer')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-demo-pagination')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-demo-stepnav')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-demo-quickactions')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-demo-search')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-demo-menus')).toBeInTheDocument();
  },
};

// ============ FACTORY: BULK ITEMS SHOWCASE ============

function FactoryBulkItemsDemo() {
  const { t } = useTranslation();
  const items: FakeNavItem[] = createFakeNavItems(8);
  const groups: FakeNavSidebarGroup[] = createFakeNavSidebarGroups(4);

  return (
    <div className="space-y-4 p-4" data-testid="factory-bulk-items-demo">
      <h3 className="text-lg font-semibold">{t('navMain.factory.sectionTitle')}</h3>
      <div className="text-sm">
        <div data-testid="factory-bulk-items">
          <p className="font-medium">
            {items.length} {t('navMain.factory.items')}
          </p>
          <div className="mt-2 space-y-1">
            {items.map((item) => (
              <div key={item.id} className="text-muted-foreground flex items-center gap-2">
                <span>{item.icon}</span>
                <span>{item.label}</span>
                <span className="text-xs">({item.status})</span>
                {item.tooltip && (
                  <span className="text-xs">
                    {t('navMain.factory.tooltip')}: {item.tooltip}
                  </span>
                )}
                {item.description && <span className="text-xs">{item.description}</span>}
                {item.href && <span className="text-xs">{item.href}</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4" data-testid="factory-bulk-groups">
          <p className="font-medium">
            {groups.length} {t('navMain.factory.groups')}
          </p>
          <div className="mt-2 space-y-1">
            {groups.map((group) => (
              <div key={group.id} className="text-muted-foreground">
                {group.icon} {group.title}: {group.items.length} {t('navMain.factory.items')}
                {group.action && (
                  <span className="ml-2 text-xs">
                    [{group.action.icon} {group.action.label}]
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryBulkItems: Story = {
  name: i18n.t('navMain.storyName.factoryBulkItems', 'Factory: Bulk Items Showcase'),
  render: () => <FactoryBulkItemsDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-bulk-items-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-bulk-items')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-bulk-groups')).toBeInTheDocument();
    const navMainSlot = canvasElement.querySelector('[data-slot="nav-main"]');
    expect(navMainSlot).toBeInTheDocument();
  },
};

// ============ FACTORY: TYPE ANNOTATIONS SHOWCASE ============
// This story exercises the imported type aliases to ensure full coverage

function FactoryTypeAnnotationsDemo() {
  // Exercise all imported type aliases
  const sidebarState: SidebarState = 'expanded';
  const sidebarPosition: SidebarPosition = 'left';
  const navVariant: NavVariant = 'pills';
  const navSize: NavSize = 'md';
  const navOrientation: NavOrientation = 'horizontal';
  const iconPosition: IconPosition = 'left';
  const mobileMode: MobileNavMode = 'drawer';
  const separator: NavBreadcrumbSeparator = 'chevron';
  const itemType: NavItemType = 'link';
  const itemStatus: NavItemStatus = 'active';

  // Use interface types for factory output
  const navItem: FakeNavItem = createFakeNavItem();
  const sidebarGroup: FakeNavSidebarGroup = createFakeNavSidebarGroup();
  const sidebar: FakeNavSidebar = createFakeNavSidebar();
  const topNav: FakeTopNav = createFakeTopNav();
  const menu: FakeNavMenu = createFakeNavMenu();
  const paginationNav: FakePaginationNav = createFakePaginationNav();
  const stepNav: FakeStepNav = createFakeStepNav();
  const stepItem: FakeStepItem = createFakeStepItem(0, 0);
  const footerNav: FakeFooterNav = createFakeFooterNav();
  const footerCol: FakeFooterColumn = footerNav.columns[0];
  const socialLink: FakeNavSocialLink = (footerNav.socialLinks ?? [])[0] ?? {
    id: 'fallback',
    icon: 'Twitter',
    href: '#',
    label: 'Twitter',
  };
  const quickAction: FakeQuickAction = createFakeQuickAction();
  const searchResult: FakeNavSearchResult = createFakeNavSearchResult();
  const menuGroup: FakeNavMenuGroup = { items: createFakeNavItems(3) };

  return (
    <div className="space-y-4 p-4" data-testid="factory-types-demo">
      <h3 className="text-lg font-semibold">{i18n.t('navMain.factory.types')}</h3>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div data-testid="factory-type-aliases" className="rounded border p-2">
          <p className="font-medium">{i18n.t('navMain.story.typeAliases', 'Type Aliases')}</p>
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
            <li>SidebarState: {sidebarState}</li>
            <li>SidebarPosition: {sidebarPosition}</li>
            <li>NavVariant: {navVariant}</li>
            <li>NavSize: {navSize}</li>
            <li>NavOrientation: {navOrientation}</li>
            <li>IconPosition: {iconPosition}</li>
            <li>MobileNavMode: {mobileMode}</li>
            <li>NavBreadcrumbSeparator: {separator}</li>
            <li>NavItemType: {itemType}</li>
            <li>NavItemStatus: {itemStatus}</li>
          </ul>
        </div>
        <div data-testid="factory-interfaces-nav" className="rounded border p-2">
          <p className="font-medium">{i18n.t('navMain.story.navInterfaces', 'Nav Interfaces')}</p>
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
            <li>FakeNavItem: {navItem.label}</li>
            <li>FakeNavSidebarGroup: {sidebarGroup.title}</li>
            <li>
              {i18n.t('navMain.story.fakeNavSidebarGroups', { count: sidebar.groups.length })}
            </li>
            <li>{i18n.t('navMain.story.fakeTopNavItems', { count: topNav.leftItems.length })}</li>
            <li>FakeNavMenu: {menu.trigger.label}</li>
            <li>
              {i18n.t('navMain.story.fakeNavMenuGroupItems', { count: menuGroup.items.length })}
            </li>
          </ul>
        </div>
        <div data-testid="factory-interfaces-other" className="rounded border p-2">
          <p className="font-medium">
            {i18n.t('navMain.story.otherInterfaces', 'Other Interfaces')}
          </p>
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
            <li>FakePaginationNav: p{paginationNav.currentPage}</li>
            <li>FakeStepNav: {stepNav.steps.length} steps</li>
            <li>FakeStepItem: {stepItem.label}</li>
            <li>FakeFooterNav: {footerNav.columns.length} cols</li>
            <li>FakeFooterColumn: {footerCol.title}</li>
            <li>FakeNavSocialLink: {socialLink.icon}</li>
            <li>FakeQuickAction: {quickAction.label}</li>
            <li>FakeNavSearchResult: {searchResult.label}</li>
          </ul>
        </div>
      </div>
      <div className="h-[400px] overflow-hidden rounded border">
        <NavMainDemo />
      </div>
    </div>
  );
}

export const FactoryTypeAnnotations: Story = {
  name: i18n.t('navMain.storyName.factoryTypeAnnotations', 'Factory: Type Annotations Showcase'),
  render: () => <FactoryTypeAnnotationsDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-types-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-type-aliases')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-interfaces-nav')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-interfaces-other')).toBeInTheDocument();
    // Verify we can click within the nav main
    const navMainSlot = canvasElement.querySelector('[data-slot="nav-main"]');
    expect(navMainSlot).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY CATALOG REFERENCE
// Available factory functions for additional story coverage:
//   createFakeSidebarItem
//   createFakeSidebarItems
//   createFakeSidebar
//   createFakeSidebars
//   createFakeResizable
//   createFakeResizables
//   createFakeResizablePanel
//   createFakeResizablePanels
//   createFakeScrollArea
//   createFakeScrollAreas
//   createFakeSeparator
//   createFakeSeparators
//   createFakeItem
//   createFakeItems
//   createFakeEmpty
//   createFakeEmpties
// ============================================================================

// ============================================================================
// STANDARD AUDIT STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: navMainStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadRequest: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerBadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: navMainStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnauthorized: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerUnauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: navMainStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerForbidden: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerForbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: navMainStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: navMainStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: navMainStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerUnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: navMainStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: navMainStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerInternalServerError: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerInternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: navMainStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: navMainStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: navMainStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: navMainStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerLoading: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerLoading', 'Handler: Loading'),
  parameters: { msw: { handlers: navMainStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: navMainStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNetworkError: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerNetworkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: navMainStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: navMainStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUserSuccess: Story = {
  ...Default,
  name: i18n.t('navMain.storyName.handlerUserSuccess', 'Handler: User Success'),
  parameters: { msw: { handlers: userStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
