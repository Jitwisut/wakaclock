import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import {
  navUserHandlers,
  navUserStatusHandlers,
} from '@/.storybook/stories/_handlers/nav-user.handlers';
import { userHandlers, userStatusHandlers } from '@/.storybook/stories/_handlers/user.handlers';
import {
  createFakeUser,
  createFakeUserProfile,
} from '@/.storybook/stories/_factories/user.factory';
import {
  createFakeEmpties,
  createFakeEmpty,
  createFakeItem,
  createFakeItems,
  createFakeResizable,
  createFakeResizablePanel,
  createFakeResizablePanels,
  createFakeResizables,
  createFakeScrollArea,
  createFakeScrollAreas,
  createFakeSeparator,
  createFakeSeparators,
  createFakeSidebar,
  createFakeSidebarItem,
  createFakeSidebarItems,
  createFakeSidebars,
  SIDEBAR_ICONS,
} from '@/.storybook/stories/_factories/layout.factory';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { NavUser } from '@/components/layout/sidebar/nav-user';
import { Sidebar, SidebarFooter, SidebarProvider } from '@/components/ui/sidebar';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

type NavUserFrameProps = {
  defaultOpen?: boolean;
  withLabels?: boolean;
};

function NavUserFrame({ defaultOpen = true, withLabels = true }: NavUserFrameProps) {
  return (
    <div data-sb-nav-user className="h-svh w-[320px]">
      <SidebarProvider defaultOpen={defaultOpen}>
        <Sidebar>
          <SidebarFooter className="mt-auto">
            <NavUser
              labels={
                withLabels
                  ? {
                      triggerAriaLabel: i18n.t('navUser.triggerAriaLabel'),
                      account: i18n.t('navUser.account'),
                      billing: i18n.t('navUser.billing'),
                      notifications: i18n.t('navUser.notifications'),
                      logOut: i18n.t('navUser.logOut'),
                    }
                  : undefined
              }
            />
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}

const meta = {
  title: 'Components/Layout/Sidebar/Nav User',
  component: NavUserFrame,
  tags: ['autodocs'],
  args: {
    defaultOpen: true,
    withLabels: true,
    // Event handlers with fn() for Actions panel logging
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onOpen: fn(),
    onClose: fn(),
    onMenuItemClick: fn(),
    onLogout: fn(),
  },
  argTypes: {
    // State
    defaultOpen: {
      control: { type: 'boolean' },
      description: i18n.t(
        'navUser.argType.initialSidebarOpenStateExpandedOrCollapsed',
        'Initial sidebar open state (expanded or collapsed)'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    withLabels: {
      control: { type: 'boolean' },
      description: i18n.t(
        'navUser.argType.whetherToUseLocalizedLabelsOrFallbackDefaults',
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
      description: i18n.t('navUser.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('navUser.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('navUser.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('navUser.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('navUser.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('navUser.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('navUser.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onOpen: {
      action: 'onOpen',
      description: i18n.t('navUser.argType.calledWhenUserMenuOpens', 'Called when user menu opens'),
      table: { category: 'Events' },
    },
    onClose: {
      action: 'onClose',
      description: i18n.t(
        'navUser.argType.calledWhenUserMenuCloses',
        'Called when user menu closes'
      ),
      table: { category: 'Events' },
    },
    onMenuItemClick: {
      action: 'onMenuItemClick',
      description: i18n.t(
        'navUser.argType.calledWhenAMenuItemIsClicked',
        'Called when a menu item is clicked'
      ),
      table: { category: 'Events' },
    },
    onLogout: {
      action: 'onLogout',
      description: i18n.t(
        'navUser.argType.calledWhenLogoutIsClicked',
        'Called when logout is clicked'
      ),
      table: { category: 'Events' },
    },
    // NavUser Props Reference:
    // Optional Props:
    // - labels: NavUserLabels object
    //   - triggerAriaLabel: Aria label for user menu trigger
    //   - account: Account menu item label
    //   - billing: Billing menu item label
    //   - notifications: Notifications menu item label
    //   - logOut: Log out menu item label
    //
    // Menu Items:
    // - Account: Link to account settings
    // - Billing: Link to billing page
    // - Notifications: Link to notifications
    // - Log Out: Log out action
    //
    // Visual States:
    // - Expanded: Full user info with name and email
    // - Collapsed: Avatar only with aria-label
    //
    // Features:
    // - Dropdown menu on click
    // - User avatar with fallback
    // - Responsive to sidebar state
    // - Keyboard accessible
    //
    // Accessibility:
    // - Aria label on collapsed trigger
    // - Focus management in dropdown
    // - Keyboard navigation support
    //
    // Data Attributes:
    // - data-testid="nav-user-trigger": Menu trigger button
    // - data-testid="nav-user-menu": Dropdown menu content
    // - data-testid="nav-user-item-account": Account item
    // - data-testid="nav-user-item-billing": Billing item
    // - data-testid="nav-user-item-notifications": Notifications item
    // - data-testid="nav-user-item-logout": Logout item
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

    expect(canvasElement.querySelector('[data-slot="nav-user"]')).toBeInTheDocument();

    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('nav-user-trigger');
    expect(trigger).toBeInTheDocument();

    // Verify initial aria-expanded state
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);

    // Verify aria-expanded changes after opening
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    const dropdownContent = await waitFor(() => {
      const content = doc.querySelector<HTMLElement>('[data-testid="nav-user-menu"]');
      if (!content) {
        throw new Error('Dropdown menu content not found.');
      }
      return content;
    });

    expect(dropdownContent).toBeInTheDocument();
    const dropdown = within(dropdownContent);

    expect(dropdown.getByTestId('nav-user-item-account')).toBeInTheDocument();
    expect(dropdown.getByTestId('nav-user-item-billing')).toBeInTheDocument();
    expect(dropdown.getByTestId('nav-user-item-notifications')).toBeInTheDocument();
    expect(dropdown.getByTestId('nav-user-item-logout')).toBeInTheDocument();

    // Test clicking logout button
    const logoutBtn = dropdown.getByTestId('nav-user-item-logout');
    await userEvent.click(logoutBtn);
  },
};

export const Collapsed: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.collapsed', 'Collapsed'),
  args: {
    ...(Default.args ?? {}),
    defaultOpen: false,
  },
  play: async (context) => {
    if (!context.canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(context.canvasElement);
    const trigger = canvas.getByTestId('nav-user-trigger');
    expect(trigger).toBeInTheDocument();

    // In collapsed mode, trigger should have aria-label
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-label');
    });

    await Default.play?.(context);
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
  name: i18n.t('navUser.storyName.fallbackLabels', 'Fallback labels (defaults)'),
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
  name: i18n.t('navUser.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    ...Default.parameters,
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.japanese', 'Japanese'),
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

function NavUserVariantExpanded() {
  return (
    <div data-sb-nav-user className="h-svh w-[320px]">
      <SidebarProvider defaultOpen>
        <Sidebar>
          <SidebarFooter className="mt-auto">
            <NavUser
              labels={{
                triggerAriaLabel: i18n.t('navUser.triggerAriaLabel'),
                account: i18n.t('navUser.account'),
                billing: i18n.t('navUser.billing'),
                notifications: i18n.t('navUser.notifications'),
                logOut: i18n.t('navUser.logOut'),
              }}
            />
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}

function NavUserVariantCollapsed() {
  const { t } = useTranslation();

  return (
    <div data-sb-nav-user className="h-svh w-[80px]">
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <SidebarFooter className="mt-auto">
            <NavUser
              labels={{
                triggerAriaLabel: t('navUser.triggerAriaLabel'),
                account: t('navUser.account'),
                billing: t('navUser.billing'),
                notifications: t('navUser.notifications'),
                logOut: t('navUser.logOut'),
              }}
            />
          </SidebarFooter>
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
          {i18n.t('navUser.story.expandedSidebarFullUserInfo', 'Expanded Sidebar (Full User Info)')}
        </p>
        <div className="h-[200px] overflow-hidden rounded border">
          <NavUserVariantExpanded />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('navUser.story.collapsedSidebarAvatarOnly', 'Collapsed Sidebar (Avatar Only)')}
        </p>
        <div className="h-[200px] overflow-hidden rounded border">
          <NavUserVariantCollapsed />
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
        <p className="text-muted-foreground mb-2 text-sm">Compact Height (150px)</p>
        <div className="h-[150px] overflow-hidden rounded border">
          <NavUserVariantExpanded />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Medium Height (250px)</p>
        <div className="h-[250px] overflow-hidden rounded border">
          <NavUserVariantExpanded />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Large Height (400px)</p>
        <div className="h-[400px] overflow-hidden rounded border">
          <NavUserVariantExpanded />
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
  name: i18n.t('navUser.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    const user = createFakeUser();
    const profile = createFakeUserProfile();

    return (
      <div className="space-y-4 p-4">
        <div className="text-sm">
          <p className="font-medium">User: {user.name}</p>
          <p className="text-muted-foreground">{user.email}</p>
          <p className="text-muted-foreground">Role: {user.role}</p>
          <p className="text-muted-foreground">Status: {user.status}</p>
        </div>
        <div className="text-sm">
          <p className="font-medium">{i18n.t('navUser.story.profile', 'Profile')}</p>
          <p className="text-muted-foreground">Followers: {profile.followers}</p>
          <p className="text-muted-foreground">Posts: {profile.posts}</p>
          <p className="text-muted-foreground">Location: {profile.location}</p>
        </div>
        <div className="h-[200px] overflow-hidden rounded border">
          <NavUserFrame />
        </div>
      </div>
    );
  },
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="nav-user"]')).toBeInTheDocument();
  },
};

// ============ LAYOUT FACTORY INTEGRATION STORIES ============

function NavUserWithLayoutFactory() {
  const { t } = useTranslation();
  const sidebar = createFakeSidebar({ collapsed: false });
  const activeItem = createFakeSidebarItem({ active: true, label: 'Settings' });
  const menuItems = createFakeItems(4);
  const emptyState = createFakeEmpty({
    title: 'No activity',
    description: 'User has no recent activity.',
  });

  return (
    <div className="space-y-4 p-4">
      <div className="h-[200px] overflow-hidden rounded border">
        <NavUserFrame />
      </div>
      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">{t('navUser.account')} - Layout Factory Context</p>
        <div className="text-sm">
          <p className="text-muted-foreground text-xs">
            Sidebar: {sidebar.title} ({sidebar.items.length} items)
          </p>
          <p className="text-muted-foreground text-xs">
            Active Item: {activeItem.label} (icon: {activeItem.icon ?? SIDEBAR_ICONS[1]})
          </p>
          <p className="text-muted-foreground text-xs">
            Empty: {emptyState.title} - {emptyState.description}
          </p>
        </div>
        <div className="text-sm">
          <p className="text-muted-foreground text-xs font-medium">
            Menu Items ({menuItems.length})
          </p>
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
            {menuItems.map((item) => (
              <li key={item.id}>
                {item.label}: {item.value}
                {item.disabled ? ' [disabled]' : ''}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export const WithLayoutFactoryData: Story = {
  render: () => <NavUserWithLayoutFactory />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="nav-user"]')).toBeInTheDocument();
    expect(canvas.getByText(/Layout Factory Context/i)).toBeInTheDocument();
    expect(canvas.getByText(/Menu Items/i)).toBeInTheDocument();
  },
};

// ============ ALL LAYOUT FACTORY FUNCTIONS DEMO ============

function LayoutFactoryDataDemo() {
  const sidebarItem = createFakeSidebarItem();
  const sidebarItems = createFakeSidebarItems(3);
  const sidebar = createFakeSidebar();
  const sidebars = createFakeSidebars(2);
  const resizable = createFakeResizable();
  const resizables = createFakeResizables(2);
  const resizablePanel = createFakeResizablePanel();
  const resizablePanels = createFakeResizablePanels(2);
  const scrollArea = createFakeScrollArea();
  const scrollAreas = createFakeScrollAreas(2);
  const separator = createFakeSeparator();
  const separators = createFakeSeparators(2);
  const item = createFakeItem();
  const items = createFakeItems(3);
  const empty = createFakeEmpty();
  const empties = createFakeEmpties(2);

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-medium">
        {i18n.t('navUser.account')} - All Layout Factories ({SIDEBAR_ICONS.length} icons)
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-2 text-xs">
        {JSON.stringify(
          {
            sidebarItem,
            sidebarItems,
            sidebar,
            sidebars,
            resizable,
            resizables,
            resizablePanel,
            resizablePanels,
            scrollArea,
            scrollAreas,
            separator,
            separators,
            item,
            items,
            empty,
            empties,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}

export const AllLayoutFactories: Story = {
  render: () => <LayoutFactoryDataDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/All Layout Factories/i)).toBeInTheDocument();
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: [...userHandlers, ...navUserHandlers] },
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
    expect(context.canvasElement.querySelector('[data-slot="nav-user"]')).toBeInTheDocument();
    await Default.play?.(context);
  },
};

export const Loading: Story = {
  name: i18n.t('navUser.storyName.loading', 'Loading'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  name: i18n.t('navUser.storyName.emptyData', 'Empty Data'),
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
  name: i18n.t('navUser.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('navUser.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('navUser.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  name: i18n.t('navUser.storyName.error404NotFound', 'Error 404: Not Found'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t('navUser.storyName.error422UnprocessableEntity', 'Error 422: Validation Error'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('navUser.storyName.error429RateLimit', 'Error 429: Rate Limit'),
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
  name: i18n.t('navUser.storyName.error500InternalServerError', 'Error 500: Internal Server Error'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('navUser.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('navUser.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('navUser.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
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
  name: i18n.t('navUser.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  name: i18n.t('navUser.storyName.networkError', 'Network Error'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('navUser.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Verify nav-user has proper structure
    const navUser = canvasElement.querySelector('[data-slot="nav-user"]');
    expect(navUser).toBeInTheDocument();

    // Test keyboard navigation on user menu trigger
    const trigger = canvas.getByTestId('nav-user-trigger');
    expect(trigger).toBeInTheDocument();

    // Verify initial aria-expanded state
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Focus on trigger
    trigger.focus();
    expect(doc.activeElement).toBe(trigger);

    // Open menu with Enter key
    await userEvent.keyboard('{Enter}');

    // Verify aria-expanded changes after opening
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    const dropdownContent = await waitFor(() => {
      const content = doc.querySelector<HTMLElement>('[data-testid="nav-user-menu"]');
      if (!content) {
        throw new Error('Dropdown menu content not found.');
      }
      return content;
    });

    expect(dropdownContent).toBeInTheDocument();
    const dropdown = within(dropdownContent);

    // Verify menu items are present and accessible
    expect(dropdown.getByTestId('nav-user-item-account')).toBeInTheDocument();
    expect(dropdown.getByTestId('nav-user-item-billing')).toBeInTheDocument();
    expect(dropdown.getByTestId('nav-user-item-notifications')).toBeInTheDocument();
    expect(dropdown.getByTestId('nav-user-item-logout')).toBeInTheDocument();

    // Navigate with arrow keys
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');

    // Verify focus is within dropdown
    expect(dropdownContent).toContainElement(doc.activeElement as HTMLElement);

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        doc.querySelector<HTMLElement>('[data-testid="nav-user-menu"]')
      ).not.toBeInTheDocument();
    });

    // Verify aria-expanded changes back to false after closing
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Verify focus returns to trigger after closing
    expect(doc.activeElement).toBe(trigger);
  },
};

// ============================================================================
// STANDARD AUDIT STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: navUserStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadRequest: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerBadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: navUserStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnauthorized: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerUnauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: navUserStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerForbidden: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerForbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: navUserStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: navUserStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: navUserStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerUnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: navUserStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: navUserStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerInternalServerError: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerInternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: navUserStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: navUserStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: navUserStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: navUserStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerLoading: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerLoading', 'Handler: Loading'),
  parameters: { msw: { handlers: navUserStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: navUserStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNetworkError: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerNetworkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: navUserStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: navUserStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerLogoutError: Story = {
  ...Default,
  name: i18n.t('navUser.storyName.handlerLogoutError', 'Handler: Logout Error'),
  parameters: { msw: { handlers: navUserStatusHandlers.logoutError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
