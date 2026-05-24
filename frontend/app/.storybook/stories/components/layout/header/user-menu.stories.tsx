import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { userHandlers, userStatusHandlers } from '@/.storybook/stories/_handlers/user.handlers';
import {
  userMenuHandlers,
  userMenuStatusHandlers,
} from '@/.storybook/stories/_handlers/user-menu.handlers';
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

import UserMenu, { type UserMenuLabels } from '@/components/layout/header/user-menu';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function UserMenuDemo({ labels: labelsOverride }: { labels?: UserMenuLabels }) {
  const labels = React.useMemo<UserMenuLabels>(
    () => ({
      triggerAriaLabel: i18n.t('userMenu.triggerAriaLabel'),
      avatarAlt: i18n.t('userMenu.avatarAlt'),
      upgradeToPro: i18n.t('userMenu.upgradeToPro'),
      account: i18n.t('userMenu.account'),
      billing: i18n.t('userMenu.billing'),
      notifications: i18n.t('userMenu.notifications'),
      logOut: i18n.t('userMenu.logOut'),
      creditsTitle: i18n.t('userMenu.creditsTitle'),
      creditsRemaining: i18n.t('userMenu.creditsRemaining'),
      creditsHelper: i18n.t('userMenu.creditsHelper'),
      ...(labelsOverride ?? {}),
    }),
    [labelsOverride]
  );

  return (
    <div data-sb-user-menu className="flex items-center justify-center">
      <UserMenu labels={labels} />
    </div>
  );
}

const meta = {
  title: 'Components/Layout/Header/User Menu',
  component: UserMenuDemo,
  tags: ['autodocs'],
  args: {
    labels: {},
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
    // Content
    labels: {
      control: 'object',
      description: i18n.t(
        'userMenu.argType.localizationLabelsForUserMenuElements',
        'Localization labels for user menu elements'
      ),
      table: {
        category: 'Content',
        type: { summary: 'UserMenuLabels' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('userMenu.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('userMenu.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('userMenu.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('userMenu.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('userMenu.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('userMenu.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('userMenu.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onOpen: {
      action: 'onOpen',
      description: i18n.t(
        'userMenu.argType.calledWhenUserMenuOpens',
        'Called when user menu opens'
      ),
      table: { category: 'Events' },
    },
    onClose: {
      action: 'onClose',
      description: i18n.t(
        'userMenu.argType.calledWhenUserMenuCloses',
        'Called when user menu closes'
      ),
      table: { category: 'Events' },
    },
    onMenuItemClick: {
      action: 'onMenuItemClick',
      description: i18n.t(
        'userMenu.argType.calledWhenAMenuItemIsClicked',
        'Called when a menu item is clicked'
      ),
      table: { category: 'Events' },
    },
    onLogout: {
      action: 'onLogout',
      description: i18n.t(
        'userMenu.argType.calledWhenLogoutIsClicked',
        'Called when logout is clicked'
      ),
      table: { category: 'Events' },
    },
    // UserMenu Props Reference:
    // Required Props:
    // - labels: UserMenuLabels object
    //   - triggerAriaLabel: Aria label for menu trigger
    //   - avatarAlt: Alt text for user avatar
    //   - upgradeToPro: Upgrade CTA text
    //   - account: Account menu item label
    //   - billing: Billing menu item label
    //   - notifications: Notifications menu item label
    //   - logOut: Log out menu item label
    //   - creditsTitle: Credits section title
    //   - creditsRemaining: Credits remaining label
    //   - creditsHelper: Credits helper text
    //
    // Menu Sections:
    // - Upgrade Banner: Links to pricing page (external)
    // - Navigation: Account, Billing, Notifications
    // - Credits: Progress bar with remaining credits
    // - Actions: Log out button
    //
    // Visual Features:
    // - User avatar with fallback initials
    // - Sparkle icon on upgrade CTA
    // - Progress indicator for credits
    // - Separator between sections
    //
    // Data Attributes:
    // - data-testid="header-user-menu-trigger": Trigger button
    // - data-testid="header-user-menu-content": Dropdown content
    // - data-testid="header-user-menu-upgrade": Upgrade link
    // - data-testid="header-user-menu-account": Account link
    // - data-testid="header-user-menu-billing": Billing link
    // - data-testid="header-user-menu-notifications": Notifications link
    // - data-testid="header-user-menu-logout": Logout button
    // - data-testid="header-user-menu-credits": Credits section
    // - data-testid="header-user-menu-credits-progress": Credits progress bar
  },
  parameters: {
    msw: {
      handlers: userHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} as Meta;

export default meta;

type Story = StoryObj<typeof meta>;

async function openUserMenu(canvasElement: HTMLElement) {
  const doc = canvasElement.ownerDocument;
  const root = canvasElement.querySelector<HTMLElement>('[data-sb-user-menu]');

  if (!root) {
    throw new Error('User menu story root not found.');
  }

  const canvas = within(root);
  const trigger = canvas.getByTestId('header-user-menu-trigger');

  const triggerLabel = trigger.getAttribute('aria-label') ?? '';
  expect(triggerLabel.trim()).not.toBe('');

  await userEvent.click(trigger);

  const content = await waitFor(() => {
    const element = doc.querySelector<HTMLElement>('[data-testid="header-user-menu-content"]');
    if (!element) {
      throw new Error('Dropdown menu content not found.');
    }
    return element;
  });

  return {
    content,
    trigger,
  };
}

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Opened: Story = {
  ...Closed,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const { content, trigger } = await openUserMenu(canvasElement);
    expect(content).toBeInTheDocument();

    // Verify trigger has aria-expanded after opening
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  },
};

export const Playground: Story = {
  ...Closed,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="user-menu"]')).toBeInTheDocument();

    const { content, trigger } = await openUserMenu(canvasElement);
    expect(content).toBeInTheDocument();

    const menu = within(content);

    // Verify trigger has aria-label and aria-expanded
    const triggerLabel = trigger.getAttribute('aria-label') ?? '';
    expect(triggerLabel.trim()).not.toBe('');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const upgrade = menu.getByTestId('header-user-menu-upgrade');
    expect(upgrade).toBeInTheDocument();
    expect(upgrade).toHaveAttribute('href', 'https://shadcnuikit.com/pricing');
    expect(upgrade).toHaveAttribute('target', '_blank');

    expect(menu.getByTestId('header-user-menu-account')).toBeInTheDocument();
    expect(menu.getByTestId('header-user-menu-billing')).toBeInTheDocument();
    expect(menu.getByTestId('header-user-menu-notifications')).toBeInTheDocument();
    expect(menu.getByTestId('header-user-menu-logout')).toBeInTheDocument();

    const credits = menu.getByTestId('header-user-menu-credits');
    expect(credits).toBeInTheDocument();

    const creditsTitle = menu.getByTestId('header-user-menu-credits-title');
    expect(creditsTitle).toBeInTheDocument();
    expect(creditsTitle).toHaveTextContent(/.+/);

    const creditsRemaining = menu.getByTestId('header-user-menu-credits-remaining');
    expect(creditsRemaining).toBeInTheDocument();
    expect(creditsRemaining).toHaveTextContent(/.+/);

    const creditsHelper = menu.getByTestId('header-user-menu-credits-helper');
    expect(creditsHelper).toBeInTheDocument();
    expect(creditsHelper).toHaveTextContent(/.+/);

    expect(menu.getByTestId('header-user-menu-credits-progress')).toBeInTheDocument();

    // Test clicking logout button
    const logoutBtn = menu.getByTestId('header-user-menu-logout');
    await userEvent.click(logoutBtn);
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('userMenu.story.defaultClosedState', 'Default (Closed State)')}
        </p>
        <UserMenuDemo />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('userMenu.story.inHeaderRowContext', 'In Header Row Context')}
        </p>
        <div className="bg-background flex items-center justify-end gap-4 rounded border p-4">
          <span className="text-muted-foreground text-sm">
            {i18n.t('userMenu.story.welcomeBack', 'Welcome back!')}
          </span>
          <UserMenuDemo />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('userMenu.story.withOtherHeaderElements', 'With Other Header Elements')}
        </p>
        <div className="bg-background flex items-center justify-between gap-4 rounded border p-4">
          <span className="text-sm font-semibold">
            {i18n.t('userMenu.story.dashboard', 'Dashboard')}
          </span>
          <div className="flex items-center gap-2">
            <button className="text-muted-foreground hover:text-foreground text-sm">
              {i18n.t('userMenu.story.help', 'Help')}
            </button>
            <UserMenuDemo />
          </div>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Compact Container (100px)</p>
        <div className="flex w-[100px] justify-center">
          <UserMenuDemo />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Medium Container (200px)</p>
        <div className="flex w-[200px] justify-center">
          <UserMenuDemo />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Large Container (400px)</p>
        <div className="flex w-[400px] justify-end">
          <UserMenuDemo />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('userMenu.story.fullWidthContainer', 'Full Width Container')}
        </p>
        <div className="flex w-full max-w-xl justify-end rounded border p-4">
          <UserMenuDemo />
        </div>
      </div>
    </div>
  ),
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
  name: i18n.t('userMenu.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    await waitFor(() => {
      expect(doc.documentElement.lang).toBe('ja');
    });

    const { content, trigger } = await openUserMenu(canvasElement);
    expect(content).toBeInTheDocument();

    const menu = within(content);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(menu.getByTestId('header-user-menu-upgrade')).toBeInTheDocument();
    expect(menu.getByTestId('header-user-menu-account')).toBeInTheDocument();
    expect(menu.getByTestId('header-user-menu-billing')).toBeInTheDocument();
    expect(menu.getByTestId('header-user-menu-notifications')).toBeInTheDocument();
    expect(menu.getByTestId('header-user-menu-logout')).toBeInTheDocument();
    expect(menu.getByTestId('header-user-menu-credits')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.dataAttributes', 'Data Attributes'),
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
  name: i18n.t('userMenu.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        </div>
        <div className="text-sm">
          <p className="font-medium">{i18n.t('userMenu.story.profile', 'Profile')}</p>
          <p className="text-muted-foreground">Followers: {profile.followers}</p>
          <p className="text-muted-foreground">Location: {profile.location}</p>
        </div>
        <UserMenuDemo />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="user-menu"]')).toBeInTheDocument();
  },
};

// ============ LAYOUT FACTORY INTEGRATION STORIES ============

function UserMenuWithLayoutFactory() {
  const { t } = useTranslation();
  const sidebarItems = createFakeSidebarItems(5);
  const quickActions = createFakeItems(3);
  const emptyState = createFakeEmpty({
    title: 'No recent activity',
    description: 'Your activity log is empty.',
  });

  return (
    <div className="space-y-4 p-4">
      <div data-sb-user-menu className="flex items-center justify-center">
        <UserMenu
          labels={{
            triggerAriaLabel: t('userMenu.triggerAriaLabel'),
            avatarAlt: t('userMenu.avatarAlt'),
            upgradeToPro: t('userMenu.upgradeToPro'),
            account: t('userMenu.account'),
            billing: t('userMenu.billing'),
            notifications: t('userMenu.notifications'),
            logOut: t('userMenu.logOut'),
            creditsTitle: t('userMenu.creditsTitle'),
            creditsRemaining: t('userMenu.creditsRemaining'),
            creditsHelper: t('userMenu.creditsHelper'),
          }}
        />
      </div>
      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">
          {t('userMenu.story.layoutFactoryContext', 'Layout Factory Context')}
        </p>
        <div className="text-sm">
          <p className="text-muted-foreground text-xs font-medium">
            Sidebar Navigation ({sidebarItems.length} items)
          </p>
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
            {sidebarItems.map((item) => (
              <li key={item.id} className="flex items-center gap-1">
                <span>{item.icon ?? SIDEBAR_ICONS[0]}</span>
                <span className={item.active ? 'font-semibold' : ''}>{item.label}</span>
                {item.badge ? <span className="text-red-500">({item.badge})</span> : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <p className="text-muted-foreground text-xs font-medium">
            Quick Actions ({quickActions.length})
          </p>
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
            {quickActions.map((item) => (
              <li key={item.id}>
                {item.label}: {item.value}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <p className="text-muted-foreground text-xs">
            Empty: {emptyState.title} - {emptyState.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export const WithLayoutFactoryData: Story = {
  render: () => <UserMenuWithLayoutFactory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="user-menu"]')).toBeInTheDocument();
    expect(canvas.getByText(/Layout Factory Context/i)).toBeInTheDocument();
    expect(canvas.getByText(/Sidebar Navigation/i)).toBeInTheDocument();
    expect(canvas.getByText(/Quick Actions/i)).toBeInTheDocument();
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
        {i18n.t('userMenu.account')} - All Layout Factories ({SIDEBAR_ICONS.length} icons)
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/All Layout Factories/i)).toBeInTheDocument();
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: [...userHandlers, ...userMenuHandlers] },
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
    const { canvasElement } = context;
    expect(canvasElement.querySelector('[data-slot="user-menu"]')).toBeInTheDocument();
    await Default.play?.(context);
  },
};

export const Loading: Story = {
  name: i18n.t('userMenu.storyName.loading', 'Loading'),
  ...Closed,
  parameters: {
    msw: { handlers: userStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  name: i18n.t('userMenu.storyName.emptyData', 'Empty Data'),
  ...Closed,
  parameters: {
    msw: { handlers: userStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('userMenu.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('userMenu.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('userMenu.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  name: i18n.t('userMenu.storyName.error404NotFound', 'Error 404: Not Found'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t('userMenu.storyName.error422UnprocessableEntity', 'Error 422: Validation Error'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('userMenu.storyName.error429RateLimit', 'Error 429: Rate Limit'),
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
  name: i18n.t(
    'userMenu.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('userMenu.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('userMenu.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('userMenu.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
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
  name: i18n.t('userMenu.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  name: i18n.t('userMenu.storyName.networkError', 'Network Error'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('userMenu.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const root = canvasElement.querySelector<HTMLElement>('[data-sb-user-menu]');

    if (!root) {
      throw new Error('User menu story root not found.');
    }

    const canvas = within(root);

    // Test user menu has proper data-slot
    expect(canvasElement.querySelector('[data-slot="user-menu"]')).toBeInTheDocument();

    // Test trigger has aria-label
    const trigger = canvas.getByTestId('header-user-menu-trigger');
    expect(trigger).toBeInTheDocument();
    const triggerLabel = trigger.getAttribute('aria-label') ?? '';
    expect(triggerLabel.trim()).not.toBe('');

    // Verify initial aria-expanded state
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Test keyboard focus on trigger
    trigger.focus();
    expect(doc.activeElement).toBe(trigger);

    // Test Enter key opens menu
    await userEvent.keyboard('{Enter}');

    // Verify aria-expanded changes after opening
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    const content = await waitFor(() => {
      const element = doc.querySelector<HTMLElement>('[data-testid="header-user-menu-content"]');
      if (!element) {
        throw new Error('Dropdown menu content not found.');
      }
      return element;
    });

    expect(content).toBeInTheDocument();

    const menu = within(content);

    // Test upgrade link has proper attributes
    const upgrade = menu.getByTestId('header-user-menu-upgrade');
    expect(upgrade).toBeInTheDocument();
    expect(upgrade).toHaveAttribute('href', 'https://shadcnuikit.com/pricing');
    expect(upgrade).toHaveAttribute('target', '_blank');
    // External links should have rel for security
    expect(upgrade.getAttribute('rel')).toContain('noopener');

    // Test all menu items are accessible
    expect(menu.getByTestId('header-user-menu-account')).toBeInTheDocument();
    expect(menu.getByTestId('header-user-menu-billing')).toBeInTheDocument();
    expect(menu.getByTestId('header-user-menu-notifications')).toBeInTheDocument();
    expect(menu.getByTestId('header-user-menu-logout')).toBeInTheDocument();

    // Test credits section is accessible
    const creditsTitle = menu.getByTestId('header-user-menu-credits-title');
    expect(creditsTitle).toBeInTheDocument();
    expect(creditsTitle).toHaveTextContent(/.+/);

    // Test keyboard navigation through menu items
    await userEvent.tab();
    await userEvent.tab();

    // Test Escape closes menu
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.querySelector('[data-testid="header-user-menu-content"]')).not.toBeInTheDocument();
    });

    // Verify aria-expanded changes back to false after closing
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Verify focus returns to trigger after closing
    expect(doc.activeElement).toBe(trigger);
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: userMenuStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadRequest: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerBadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: userMenuStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnauthorized: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerUnauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: userMenuStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerForbidden: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerForbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: userMenuStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: userMenuStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: userMenuStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerUnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: userMenuStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: userMenuStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerInternalServerError: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerInternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: userMenuStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: userMenuStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: userMenuStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: userMenuStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerLoading: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerLoading', 'Handler: Loading'),
  parameters: { msw: { handlers: userMenuStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: userMenuStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNetworkError: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerNetworkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: userMenuStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: userMenuStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerLogoutError: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerLogoutError', 'Handler: Logout Error'),
  parameters: { msw: { handlers: userMenuStatusHandlers.logoutError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCreated: Story = {
  ...Default,
  name: i18n.t('userMenu.storyName.handlerCreated', 'Handler: Created'),
  parameters: { msw: { handlers: userStatusHandlers.created } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
