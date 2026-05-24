import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { userHandlers, userStatusHandlers } from '@/.storybook/stories/_handlers/user.handlers';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  notificationHandlers,
  notificationStatusHandlers,
} from '@/.storybook/stories/_handlers/notification.handlers';
import {
  searchHandlers,
  searchStatusHandlers,
} from '@/.storybook/stories/_handlers/search.handlers';
import {
  siteHeaderHandlers,
  siteHeaderStatusHandlers,
} from '@/.storybook/stories/_handlers/site-header.handlers';
import { createFakeUser } from '@/.storybook/stories/_factories/user.factory';
import { createFakeNotifications } from '@/.storybook/stories/_factories/notification.factory';
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

import { SiteHeader } from '@/components/layout/header';
import { AppSidebar } from '@/components/layout/sidebar/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

function getSiteHeader(canvasElement: HTMLElement) {
  const header = canvasElement.querySelector<HTMLElement>('[data-testid="site-header"]');
  if (!header) {
    throw new Error('Site header not found.');
  }
  return header;
}

async function openSearchDialog(canvasElement: HTMLElement) {
  const doc = canvasElement.ownerDocument;
  const canvas = within(canvasElement);
  const header = getSiteHeader(canvasElement);

  const desktopInput = header.querySelector<HTMLInputElement>(
    '[data-testid="header-search-desktop-input"]'
  );

  if (desktopInput && desktopInput.offsetParent) {
    await userEvent.click(desktopInput);
  } else {
    await userEvent.click(canvas.getByTestId('header-search-mobile-trigger'));
  }

  const dialogContent = await waitFor(() => {
    const content = doc.querySelector<HTMLElement>('[data-slot="dialog-content"]');
    if (!content) {
      throw new Error('Dialog content not found.');
    }
    return content;
  });

  return {
    dialogContent,
    doc,
  };
}

async function openNotificationsMenu(canvasElement: HTMLElement) {
  const doc = canvasElement.ownerDocument;
  const canvas = within(canvasElement);

  await userEvent.click(canvas.getByTestId('header-notifications-trigger'));

  const content = await waitFor(() => {
    const element = doc.querySelector<HTMLElement>('[data-testid="header-notifications-content"]');
    if (!element) {
      throw new Error('Dropdown menu content not found.');
    }
    return element;
  });

  return {
    content,
    doc,
  };
}

function SiteHeaderDemo() {
  const hintPrefix = i18n.t('siteHeader.shortcutHint.prefix');
  const hintSuffix = i18n.t('siteHeader.shortcutHint.suffix');

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader
          notificationsLabels={{
            title: i18n.t('headerNotifications.title'),
            viewAll: i18n.t('headerNotifications.viewAll'),
            accept: i18n.t('headerNotifications.accept'),
            decline: i18n.t('headerNotifications.decline'),
          }}
          searchLabels={{
            inputPlaceholder: i18n.t('headerSearch.inputPlaceholder'),
            desktopInputAriaLabel: i18n.t('headerSearch.desktopInputAriaLabel'),
            mobileButtonAriaLabel: i18n.t('headerSearch.mobileButtonAriaLabel'),
            dialogTitle: i18n.t('headerSearch.dialogTitle'),
            dialogDescription: i18n.t('headerSearch.dialogDescription'),
            dialogInputPlaceholder: i18n.t('headerSearch.dialogInputPlaceholder'),
            emptyState: i18n.t('headerSearch.emptyState'),
          }}
          sidebarToggleAriaLabel={i18n.t('siteHeader.sidebarToggleAriaLabel')}
        />
        <div className="p-6">
          <div className="text-sm font-medium">{i18n.t('siteHeader.pageContentTitle')}</div>
          <div className="text-muted-foreground mt-2 text-sm">
            {hintPrefix}
            {hintPrefix ? ' ' : null}
            <kbd className="rounded border px-1 py-0.5 font-mono text-xs">⌘</kbd>+
            <kbd className="rounded border px-1 py-0.5 font-mono text-xs">K</kbd>
            {hintSuffix ? ' ' : null}
            {hintSuffix}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

const meta = {
  title: 'Components/Layout/Header/Site Header',
  component: SiteHeaderDemo,
  tags: ['autodocs'],
  args: {
    // Event handlers
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onSidebarToggle: fn(),
    onSearchOpen: fn(),
    onSearchClose: fn(),
    onNotificationClick: fn(),
    onThemeChange: fn(),
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('siteHeader.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('siteHeader.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('siteHeader.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('siteHeader.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('siteHeader.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('siteHeader.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('siteHeader.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onSidebarToggle: {
      action: 'onSidebarToggle',
      description: i18n.t(
        'siteHeader.argType.calledWhenSidebarToggleIsClicked',
        'Called when sidebar toggle is clicked'
      ),
      table: { category: 'Events' },
    },
    onSearchOpen: {
      action: 'onSearchOpen',
      description: i18n.t(
        'siteHeader.argType.calledWhenSearchDialogOpens',
        'Called when search dialog opens'
      ),
      table: { category: 'Events' },
    },
    onSearchClose: {
      action: 'onSearchClose',
      description: i18n.t(
        'siteHeader.argType.calledWhenSearchDialogCloses',
        'Called when search dialog closes'
      ),
      table: { category: 'Events' },
    },
    onNotificationClick: {
      action: 'onNotificationClick',
      description: i18n.t(
        'siteHeader.argType.calledWhenANotificationIsClicked',
        'Called when a notification is clicked'
      ),
      table: { category: 'Events' },
    },
    onThemeChange: {
      action: 'onThemeChange',
      description: i18n.t(
        'siteHeader.argType.calledWhenThemeIsChanged',
        'Called when theme is changed'
      ),
      table: { category: 'Events' },
    },
    // SiteHeader Props Reference:
    // Main Layout Component:
    // - Combines Notifications, Search, ThemeSwitch, and sidebar toggle
    // - Responsive design with mobile/desktop variants
    // - Integrates with SidebarProvider for toggle functionality
    //
    // Composite Props (passed to child components):
    // - notificationsLabels: NotificationsLabels object
    //   - title: Dropdown header text
    //   - viewAll: Link text for viewing all notifications
    //   - accept: Accept button label for confirm-type notifications
    //   - decline: Decline button label for confirm-type notifications
    //
    // - searchLabels: SearchLabels object
    //   - inputPlaceholder: Desktop input placeholder
    //   - desktopInputAriaLabel: Aria label for desktop search input
    //   - mobileButtonAriaLabel: Aria label for mobile search button
    //   - dialogTitle: Search dialog title (visually hidden)
    //   - dialogDescription: Search dialog description
    //   - dialogInputPlaceholder: Dialog input placeholder
    //   - emptyState: Message when no results found
    //
    // - sidebarToggleAriaLabel: Aria label for sidebar toggle button
    //
    // Features:
    // - Keyboard shortcut: Cmd/Ctrl+K to open search
    // - Sidebar toggle with state persistence
    // - Responsive notifications dropdown
    // - Theme switching capability
    //
    // Data Attributes:
    // - data-testid="site-header": Root header element
    // - data-testid="site-header-sidebar-toggle": Sidebar toggle button
  },
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...userHandlers, ...notificationHandlers, ...searchHandlers] },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof SiteHeaderDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="site-header"]')).toBeInTheDocument();

    const canvas = within(canvasElement);

    expect(getSiteHeader(canvasElement)).toBeInTheDocument();
    const sidebarToggle = canvas.getByTestId('site-header-sidebar-toggle');
    expect(sidebarToggle).toBeInTheDocument();

    const sidebar = canvasElement.querySelector<HTMLElement>('[data-slot="sidebar"]');
    if (!sidebar) {
      throw new Error('Sidebar not found.');
    }

    const initialSidebarState = sidebar.getAttribute('data-state');
    if (initialSidebarState !== 'expanded' && initialSidebarState !== 'collapsed') {
      throw new Error('Sidebar state attribute not found.');
    }

    const toggledSidebarState = initialSidebarState === 'expanded' ? 'collapsed' : 'expanded';

    await userEvent.click(sidebarToggle);
    await waitFor(() => {
      expect(sidebar.getAttribute('data-state')).toBe(toggledSidebarState);
    });

    await userEvent.click(sidebarToggle);
    await waitFor(() => {
      expect(sidebar.getAttribute('data-state')).toBe(initialSidebarState);
    });

    const { doc, dialogContent } = await openSearchDialog(canvasElement);
    expect(dialogContent).toBeInTheDocument();

    // Verify search input is accessible
    const searchInput = dialogContent.querySelector('[data-testid="header-search-command-input"]');
    expect(searchInput).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.querySelector('[data-slot="dialog-content"]')).not.toBeInTheDocument();
    });

    const { content } = await openNotificationsMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const dropdown = within(content);

    const viewAll = dropdown.getByTestId('header-notifications-view-all');
    expect(viewAll).toBeInTheDocument();
    expect(viewAll).toHaveAttribute('href', '#');

    // Verify notifications trigger has aria-expanded after opening
    const notificationsTrigger = canvas.getByTestId('header-notifications-trigger');
    expect(notificationsTrigger).toHaveAttribute('aria-expanded', 'true');
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const header = getSiteHeader(canvasElement);
    const desktopInput = header.querySelector<HTMLElement>(
      '[data-testid="header-search-desktop-input"]'
    );

    expect(desktopInput?.offsetParent ?? null).toBeNull();

    const { dialogContent, doc } = await openSearchDialog(canvasElement);
    expect(dialogContent).toBeInTheDocument();

    // Verify dialog has proper aria attributes
    expect(dialogContent).toHaveAttribute('role', 'dialog');

    // Close and verify it closes properly
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.querySelector('[data-slot="dialog-content"]')).not.toBeInTheDocument();
    });
  },
};

function SiteHeaderVariant() {
  const { t } = useTranslation();

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader
          notificationsLabels={{
            title: t('headerNotifications.title'),
            viewAll: t('headerNotifications.viewAll'),
            accept: t('headerNotifications.accept'),
            decline: t('headerNotifications.decline'),
          }}
          searchLabels={{
            inputPlaceholder: t('headerSearch.inputPlaceholder'),
            desktopInputAriaLabel: t('headerSearch.desktopInputAriaLabel'),
            mobileButtonAriaLabel: t('headerSearch.mobileButtonAriaLabel'),
            dialogTitle: t('headerSearch.dialogTitle'),
            dialogDescription: t('headerSearch.dialogDescription'),
            dialogInputPlaceholder: t('headerSearch.dialogInputPlaceholder'),
            emptyState: t('headerSearch.emptyState'),
          }}
          sidebarToggleAriaLabel={t('siteHeader.sidebarToggleAriaLabel')}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}

function SiteHeaderVariantCollapsed() {
  const { t } = useTranslation();

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader
          notificationsLabels={{
            title: t('headerNotifications.title'),
            viewAll: t('headerNotifications.viewAll'),
            accept: t('headerNotifications.accept'),
            decline: t('headerNotifications.decline'),
          }}
          searchLabels={{
            inputPlaceholder: t('headerSearch.inputPlaceholder'),
            desktopInputAriaLabel: t('headerSearch.desktopInputAriaLabel'),
            mobileButtonAriaLabel: t('headerSearch.mobileButtonAriaLabel'),
            dialogTitle: t('headerSearch.dialogTitle'),
            dialogDescription: t('headerSearch.dialogDescription'),
            dialogInputPlaceholder: t('headerSearch.dialogInputPlaceholder'),
            emptyState: t('headerSearch.emptyState'),
          }}
          sidebarToggleAriaLabel={t('siteHeader.sidebarToggleAriaLabel')}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('siteHeader.story.sidebarExpanded', 'Sidebar Expanded')}
        </p>
        <div className="h-[300px] overflow-hidden rounded border">
          <SiteHeaderVariant />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('siteHeader.story.sidebarCollapsed', 'Sidebar Collapsed')}
        </p>
        <div className="h-[300px] overflow-hidden rounded border">
          <SiteHeaderVariantCollapsed />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
  play: async ({ canvasElement }) => {
    const headers = canvasElement.querySelectorAll('[data-slot="site-header"]');
    expect(headers.length).toBe(2);
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Compact Height (250px)</p>
        <div className="h-[250px] overflow-hidden rounded border">
          <SiteHeaderVariant />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Medium Height (400px)</p>
        <div className="h-[400px] overflow-hidden rounded border">
          <SiteHeaderVariant />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Large Height (600px)</p>
        <div className="h-[600px] overflow-hidden rounded border">
          <SiteHeaderVariant />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
  play: async ({ canvasElement }) => {
    const headers = canvasElement.querySelectorAll('[data-slot="site-header"]');
    expect(headers.length).toBe(3);
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
  name: i18n.t('siteHeader.storyName.japanese', 'Japanese'),
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

    const { dialogContent } = await openSearchDialog(canvasElement);
    const dialog = within(dialogContent);

    const commandInput = dialog.getByTestId('header-search-command-input') as HTMLInputElement;
    const placeholder = commandInput.getAttribute('placeholder') ?? '';
    expect(placeholder.trim()).not.toBe('');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.querySelector('[data-slot="dialog-content"]')).not.toBeInTheDocument();
    });

    const { content } = await openNotificationsMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const dropdown = within(content);

    expect(dropdown.getByTestId('header-notifications-view-all')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.dataAttributes', 'Data Attributes'),
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
  name: i18n.t('siteHeader.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    const notifications = createFakeNotifications(5);

    return (
      <div className="space-y-4 p-4">
        <div className="text-sm">
          <p className="font-medium">User: {user.name}</p>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
        <div className="text-sm">
          <p className="font-medium">Notifications: {notifications.length}</p>
          <p className="text-muted-foreground">
            Unread: {notifications.filter((n) => !n.read).length}
          </p>
        </div>
        <SiteHeaderDemo />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="site-header"]')).toBeInTheDocument();
  },
};

// ============ LAYOUT FACTORY INTEGRATION STORIES ============

function SiteHeaderWithLayoutFactory() {
  const { t } = useTranslation();
  const sidebar = createFakeSidebar({ collapsed: false });
  const sidebarItems = createFakeSidebarItems(6);
  const quickAccessItems = createFakeItems(4);

  return (
    <div className="space-y-4">
      <SiteHeaderDemo />
      <div className="space-y-3 p-4">
        <div className="text-sm">
          <p className="font-medium">{t('siteHeader.pageContentTitle')}</p>
          <p className="text-muted-foreground text-xs">
            Sidebar: {sidebar.title} ({sidebar.items.length} items,{' '}
            {sidebar.collapsed ? 'collapsed' : 'expanded'})
          </p>
        </div>
        <div className="text-sm">
          <p className="font-medium">Navigation Items ({sidebarItems.length})</p>
          <ul className="text-muted-foreground mt-1 space-y-1 text-xs">
            {sidebarItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span>{item.icon ?? SIDEBAR_ICONS[0]}</span>
                <span className={item.disabled ? 'line-through opacity-50' : ''}>{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-red-100 px-1.5 text-[10px] text-red-700">
                    {item.badge}
                  </span>
                ) : null}
                {item.active ? <span className="text-green-600">*</span> : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-medium">Quick Access ({quickAccessItems.length})</p>
          <ul className="text-muted-foreground mt-1 space-y-1 text-xs">
            {quickAccessItems.map((item) => (
              <li key={item.id}>
                {item.label} {item.description ? `- ${item.description}` : ''}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export const WithLayoutFactoryData: Story = {
  render: () => <SiteHeaderWithLayoutFactory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="site-header"]')).toBeInTheDocument();
    expect(canvas.getByText(/Navigation Items/i)).toBeInTheDocument();
    expect(canvas.getByText(/Quick Access/i)).toBeInTheDocument();
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
        {i18n.t('siteHeader.pageContentTitle')} - All Layout Factories ({SIDEBAR_ICONS.length}{' '}
        icons)
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
    msw: {
      handlers: [
        ...userHandlers,
        ...notificationHandlers,
        ...searchHandlers,
        ...siteHeaderHandlers,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: [...userHandlers, ...notificationHandlers, ...searchHandlers] },
  },
  play: async (context) => {
    const { canvasElement } = context;
    expect(canvasElement.querySelector('[data-slot="site-header"]')).toBeInTheDocument();
    await Default.play?.(context);
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: [
        ...userStatusHandlers.loading,
        ...notificationStatusHandlers.loading,
        ...searchStatusHandlers.loading,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: [
        ...userStatusHandlers.emptyData,
        ...notificationStatusHandlers.empty,
        ...searchStatusHandlers.empty,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('siteHeader.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Default,
  parameters: {
    msw: {
      handlers: [
        ...userStatusHandlers.badRequest,
        ...notificationStatusHandlers.badRequest,
        ...searchStatusHandlers.badRequest,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('siteHeader.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Default,
  parameters: {
    msw: {
      handlers: [
        ...userStatusHandlers.unauthorized,
        ...notificationStatusHandlers.unauthorized,
        ...searchStatusHandlers.unauthorized,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('siteHeader.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Default,
  parameters: {
    msw: {
      handlers: [
        ...userStatusHandlers.forbidden,
        ...notificationStatusHandlers.forbidden,
        ...searchStatusHandlers.forbidden,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('siteHeader.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: {
      handlers: [
        ...userStatusHandlers.tooManyRequests,
        ...notificationStatusHandlers.tooManyRequests,
        ...searchStatusHandlers.tooManyRequests,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'siteHeader.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  ...Default,
  parameters: {
    msw: {
      handlers: [
        ...userStatusHandlers.internalServerError,
        ...notificationStatusHandlers.internalServerError,
        ...searchStatusHandlers.internalServerError,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('siteHeader.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: {
      handlers: [
        ...userStatusHandlers.badGateway,
        ...notificationStatusHandlers.badGateway,
        ...searchStatusHandlers.badGateway,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('siteHeader.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  ...Default,
  parameters: {
    msw: {
      handlers: [
        ...userStatusHandlers.serviceUnavailable,
        ...notificationStatusHandlers.serviceUnavailable,
        ...searchStatusHandlers.serviceUnavailable,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('siteHeader.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: {
      handlers: [
        ...userStatusHandlers.gatewayTimeout,
        ...notificationStatusHandlers.gatewayTimeout,
        ...searchStatusHandlers.gatewayTimeout,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ SPECIAL STATE STORIES ============

export const SlowResponse: Story = {
  name: i18n.t('siteHeader.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: {
      handlers: [
        ...userStatusHandlers.slowResponse,
        ...notificationStatusHandlers.slowResponse,
        ...searchStatusHandlers.slowResponse,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  name: i18n.t('siteHeader.storyName.networkError', 'Network Error'),
  ...Default,
  parameters: {
    msw: {
      handlers: [
        ...userStatusHandlers.networkError,
        ...notificationStatusHandlers.networkError,
        ...searchStatusHandlers.networkError,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('siteHeader.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    // Test site header exists with proper data-slot
    expect(canvasElement.querySelector('[data-slot="site-header"]')).toBeInTheDocument();

    // Test sidebar toggle has aria-label
    const sidebarToggle = canvas.getByTestId('site-header-sidebar-toggle');
    expect(sidebarToggle).toBeInTheDocument();
    const toggleAriaLabel = sidebarToggle.getAttribute('aria-label');
    expect(toggleAriaLabel?.trim()).not.toBe('');

    // Test keyboard navigation - sidebar toggle should be focusable
    sidebarToggle.focus();
    expect(doc.activeElement).toBe(sidebarToggle);

    // Test Enter key toggles sidebar
    const sidebar = canvasElement.querySelector<HTMLElement>('[data-slot="sidebar"]');
    if (!sidebar) {
      throw new Error('Sidebar not found.');
    }

    const initialState = sidebar.getAttribute('data-state');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(sidebar.getAttribute('data-state')).not.toBe(initialState);
    });

    // Test notifications trigger is accessible
    const notificationsTrigger = canvas.getByTestId('header-notifications-trigger');
    expect(notificationsTrigger).toBeInTheDocument();
    const notificationsAriaLabel = notificationsTrigger.getAttribute('aria-label');
    expect(notificationsAriaLabel?.trim()).not.toBe('');

    // Test opening notifications with keyboard
    notificationsTrigger.focus();
    expect(doc.activeElement).toBe(notificationsTrigger);
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(notificationsTrigger).toHaveAttribute('aria-expanded', 'true');
    });

    const notificationsContent = await waitFor(() => {
      const content = doc.querySelector<HTMLElement>(
        '[data-testid="header-notifications-content"]'
      );
      if (!content) {
        throw new Error('Notifications content not found.');
      }
      return content;
    });
    expect(notificationsContent).toBeInTheDocument();

    // Close notifications with Escape
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        doc.querySelector('[data-testid="header-notifications-content"]')
      ).not.toBeInTheDocument();
    });

    // Test theme switch is accessible
    const themeSwitch = canvas.getByTestId('header-theme-switch');
    expect(themeSwitch).toBeInTheDocument();
    const themeAriaLabel = themeSwitch.getAttribute('aria-label');
    expect(themeAriaLabel?.trim()).not.toBe('');

    // Test Tab navigation through header elements
    await userEvent.tab();
    await userEvent.tab();

    // Verify focus is moving through interactive elements
    expect(doc.activeElement).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadRequest: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerBadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnauthorized: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerUnauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerForbidden: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerForbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerUnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerInternalServerError: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerInternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerLoading: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerLoading', 'Handler: Loading'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNetworkError: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerNetworkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('siteHeader.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: siteHeaderStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
