import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  notificationHandlers,
  notificationStatusHandlers,
} from '@/.storybook/stories/_handlers/notification.handlers';
import {
  createFakeNotifications,
  type FakeNotification,
} from '@/.storybook/stories/_factories/notification.factory';
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

import Notifications, { type NotificationsLabels } from '@/components/layout/header/notifications';
import { notifications } from '@/components/layout/header/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircleIcon, BellIcon, RefreshCwIcon } from 'lucide-react';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

function NotificationsDemo({ labels: labelsOverride }: { labels?: NotificationsLabels }) {
  const labels = React.useMemo<NotificationsLabels>(
    () => ({
      accept: i18n.t('headerNotifications.accept'),
      decline: i18n.t('headerNotifications.decline'),
      title: i18n.t('headerNotifications.title'),
      viewAll: i18n.t('headerNotifications.viewAll'),
      ...(labelsOverride ?? {}),
    }),
    [labelsOverride]
  );

  return (
    <div data-sb-notifications className="flex items-center justify-center">
      <Notifications labels={labels} />
    </div>
  );
}

// Error display component
interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

function NotificationsErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="notifications-error">
      <AlertCircleIcon className="size-4" />
      <AlertTitle>
        Error {error.status}: {error.code}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {error.message}
        {error.details && (
          <ul className="mt-2 list-disc pl-4 text-sm">
            {Object.entries(error.details).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCwIcon className="mr-2 size-4" />
          Retry
        </Button>
      )}
    </Alert>
  );
}

// Loading skeleton
function NotificationsLoadingSkeleton() {
  return (
    <div
      className="w-80 space-y-4 rounded-lg border p-4"
      data-state="loading"
      data-testid="notifications-loading"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={`notification-skeleton-${String(i)}`} className="flex gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty state
function NotificationsEmptyState() {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      data-state="empty"
      data-testid="notifications-empty"
    >
      <BellIcon className="text-muted-foreground mb-2 size-8" />
      <p className="text-muted-foreground">
        {t('notifications.story.noNotifications', 'No notifications')}
      </p>
    </div>
  );
}

// Custom notifications component with async data fetching
function NotificationsWithAsyncData() {
  const { t } = useTranslation();
  const [data, setData] = React.useState<FakeNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [unreadCount, setUnreadCount] = React.useState(0);

  const fetchNotifications = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/notifications')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<{ notifications: FakeNotification[]; unreadCount: number }>;
      })
      .then((json) => {
        setData(json.notifications);
        setUnreadCount(json.unreadCount);
        setLoading(false);
        return undefined;
      })
      .catch((error_: ApiError) => {
        setError(error_);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  if (loading) {
    return <NotificationsLoadingSkeleton />;
  }

  if (error) {
    return <NotificationsErrorDisplay error={error} onRetry={fetchNotifications} />;
  }

  if (data.length === 0) {
    return <NotificationsEmptyState />;
  }

  return (
    <div
      className="w-80 space-y-4 rounded-lg border p-4"
      data-state="success"
      data-testid="notifications-success"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('headerNotifications.title')}</h3>
        {unreadCount > 0 && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
            {unreadCount}
          </span>
        )}
      </div>
      <div className="max-h-60 space-y-3 overflow-y-auto">
        {data.slice(0, 5).map((notification) => (
          <div
            key={notification.id}
            className={`flex gap-3 rounded-md p-2 ${notification.read ? '' : 'bg-muted/50'}`}
          >
            <div className="flex-1">
              <p className="text-sm font-medium">{notification.title}</p>
              <p className="text-muted-foreground text-xs">{notification.description}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {new Date(notification.createdAt).toLocaleDateString()}
              </p>
            </div>
            {!notification.read && <div className="size-2 rounded-full bg-blue-500" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// Static demo with Faker data (no API)
function NotificationsWithFakerData() {
  const { t } = useTranslation();
  const data = React.useMemo(() => createFakeNotifications(5), []);
  const unreadCount = data.filter((n) => !n.read).length;

  return (
    <div className="w-80 space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('headerNotifications.title')}</h3>
        {unreadCount > 0 && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
            {unreadCount}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {data.map((notification) => (
          <div
            key={notification.id}
            className={`flex gap-3 rounded-md p-2 ${notification.read ? '' : 'bg-muted/50'}`}
          >
            <div className="flex-1">
              <p className="text-sm font-medium">{notification.title}</p>
              <p className="text-muted-foreground text-xs">{notification.description}</p>
            </div>
            {!notification.read && <div className="size-2 rounded-full bg-blue-500" />}
          </div>
        ))}
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/Layout/Header/Notifications',
  component: NotificationsDemo,
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
    onNotificationClick: fn(),
    onAccept: fn(),
    onDecline: fn(),
  },
  parameters: {
    msw: {
      handlers: notificationHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    labels: {
      control: 'object',
      description: i18n.t(
        'notifications.argType.localizationLabelsForNotificationElements',
        'Localization labels for notification elements'
      ),
      table: {
        category: 'Content',
        type: { summary: 'NotificationsLabels' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('notifications.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('notifications.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('notifications.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('notifications.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('notifications.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t(
        'notifications.argType.mouseenterEventHandler',
        'MouseEnter event handler'
      ),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t(
        'notifications.argType.mouseleaveEventHandler',
        'MouseLeave event handler'
      ),
      table: { category: 'Events' },
    },
    onOpen: {
      action: 'onOpen',
      description: i18n.t(
        'notifications.argType.calledWhenNotificationsDropdownOpens',
        'Called when notifications dropdown opens'
      ),
      table: { category: 'Events' },
    },
    onClose: {
      action: 'onClose',
      description: i18n.t(
        'notifications.argType.calledWhenNotificationsDropdownCloses',
        'Called when notifications dropdown closes'
      ),
      table: { category: 'Events' },
    },
    onNotificationClick: {
      action: 'onNotificationClick',
      description: i18n.t(
        'notifications.argType.calledWhenANotificationIsClicked',
        'Called when a notification is clicked'
      ),
      table: { category: 'Events' },
    },
    onAccept: {
      action: 'onAccept',
      description: i18n.t(
        'notifications.argType.calledWhenAcceptButtonIsClickedOnConfirmtypeNotification',
        'Called when accept button is clicked on confirm-type notification'
      ),
      table: { category: 'Events' },
    },
    onDecline: {
      action: 'onDecline',
      description: i18n.t(
        'notifications.argType.calledWhenDeclineButtonIsClickedOnConfirmtypeNotification',
        'Called when decline button is clicked on confirm-type notification'
      ),
      table: { category: 'Events' },
    },
    // Notifications Props Reference:
    // Required Props:
    // - labels: NotificationsLabels object
    //   - title: Dropdown header text (e.g., "Notifications")
    //   - viewAll: Link text (e.g., "View All")
    //   - accept: Accept button label for confirm-type notifications
    //   - decline: Decline button label for confirm-type notifications
    //
    // Notification Types:
    // - default: Standard notification with avatar, title, description, time
    // - confirm: Notification with accept/decline action buttons
    //
    // Visual Features:
    // - Badge indicator showing notification count
    // - Unread message indicators
    // - User avatars
    // - Relative time display
    // - Scrollable notification list
    //
    // Accessibility:
    // - aria-label on trigger button matches title
    // - Keyboard navigable dropdown
    // - Focus management on open/close
    //
    // Data Attributes:
    // - data-testid="header-notifications-trigger": Trigger button
    // - data-testid="header-notifications-content": Dropdown content
    // - data-testid="header-notifications-title": Dropdown title
    // - data-testid="header-notifications-view-all": View all link
    // - data-testid="header-notifications-accept-{id}": Accept button
    // - data-testid="header-notifications-decline-{id}": Decline button
    // - data-testid="header-notifications-unread-{id}": Unread indicator
  },
} as Meta;

export default meta;

type Story = StoryObj<typeof meta>;

async function openNotificationsMenu(canvasElement: HTMLElement) {
  const doc = canvasElement.ownerDocument;
  const root = canvasElement.querySelector<HTMLElement>('[data-sb-notifications]');

  if (!root) {
    throw new Error('Notifications story root not found.');
  }

  const canvas = within(root);
  const trigger = canvas.getByTestId('header-notifications-trigger');

  await userEvent.click(trigger);

  const content = await waitFor(() => {
    const element = doc.querySelector<HTMLElement>('[data-testid="header-notifications-content"]');
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

    const { content, trigger } = await openNotificationsMenu(canvasElement);
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

    expect(canvasElement.querySelector('[data-slot="notifications"]')).toBeInTheDocument();

    const { content, trigger } = await openNotificationsMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const menu = within(content);

    // Verify trigger has aria-label and aria-expanded
    expect(trigger).toHaveAttribute('aria-label');
    const triggerLabel = trigger.getAttribute('aria-label');
    expect(triggerLabel?.trim()).not.toBe('');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const title = menu.getByTestId('header-notifications-title');
    expect(title).toBeInTheDocument();
    expect(title.textContent?.trim()).not.toBe('');
    expect(triggerLabel).toBe(title.textContent?.trim());

    const viewAllLink = menu.getByTestId('header-notifications-view-all');
    expect(viewAllLink).toBeInTheDocument();
    expect(viewAllLink).toHaveAttribute('href', '#');

    expect(menu.getByText(notifications[0].title)).toBeInTheDocument();

    const confirm = notifications.find((item) => item.type === 'confirm');
    if (confirm) {
      const acceptBtn = menu.getByTestId(`header-notifications-accept-${confirm.id}`);
      const declineBtn = menu.getByTestId(`header-notifications-decline-${confirm.id}`);
      expect(acceptBtn).toBeInTheDocument();
      expect(declineBtn).toBeInTheDocument();

      // Verify action buttons are clickable
      await userEvent.click(acceptBtn);
    }

    const unread = notifications.find((item) => item.unread_message);
    if (unread) {
      expect(menu.getByTestId(`header-notifications-unread-${unread.id}`)).toBeInTheDocument();
    }
  },
};

export const Mobile: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    await openNotificationsMenu(canvasElement);

    await waitFor(() => {
      const content = doc.querySelector<HTMLElement>(
        '[data-testid="header-notifications-content"]'
      );
      if (!content) {
        throw new Error('Dropdown menu content not found.');
      }
      expect(content.getAttribute('data-align')).toBe('center');
    });
  },
};

function NotificationsVariantWithLabels({
  customLabels,
}: {
  customLabels?: Partial<NotificationsLabels>;
}) {
  const labels = React.useMemo<NotificationsLabels>(
    () => ({
      accept: i18n.t('headerNotifications.accept'),
      decline: i18n.t('headerNotifications.decline'),
      title: i18n.t('headerNotifications.title'),
      viewAll: i18n.t('headerNotifications.viewAll'),
      ...(customLabels ?? {}),
    }),
    [customLabels]
  );

  return (
    <div data-sb-notifications className="flex items-center justify-center">
      <Notifications labels={labels} />
    </div>
  );
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t(
            'notifications.story.defaultNotificationsClosed',
            'Default Notifications (Closed)'
          )}
        </p>
        <NotificationsVariantWithLabels />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('notifications.story.loadingState', 'Loading State')}
        </p>
        <NotificationsLoadingSkeleton />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('notifications.story.emptyState', 'Empty State')}
        </p>
        <NotificationsEmptyState />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('notifications.story.withFakerGeneratedData', 'With Faker Generated Data')}
        </p>
        <NotificationsWithFakerData />
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
        <p className="text-muted-foreground mb-2 text-sm">Compact Container (200px)</p>
        <div className="w-[200px]">
          <NotificationsVariantWithLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Medium Container (320px)</p>
        <div className="w-[320px]">
          <NotificationsVariantWithLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Large Container (480px)</p>
        <div className="w-[480px]">
          <NotificationsVariantWithLabels />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('notifications.story.fullWidthContainer', 'Full Width Container')}
        </p>
        <div className="w-full max-w-xl">
          <NotificationsVariantWithLabels />
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
  name: i18n.t('notifications.storyName.japanese', 'Japanese'),
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

    const { content, trigger } = await openNotificationsMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const menu = within(content);

    expect(trigger).toHaveAttribute('aria-label');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(menu.getByTestId('header-notifications-title')).toBeInTheDocument();
    expect(menu.getByTestId('header-notifications-view-all')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('notifications.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('notifications.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('notifications.storyName.dataAttributes', 'Data Attributes'),
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
  name: i18n.t('notifications.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ LAYOUT FACTORY INTEGRATION STORIES ============

function NotificationsWithLayoutFactory() {
  const { t } = useTranslation();
  const emptyState = createFakeEmpty({
    title: 'No notifications',
    description: 'You are all caught up.',
  });
  const menuItems = createFakeItems(4);
  const activeSidebarItem = createFakeSidebarItem({ active: true, disabled: false });

  return (
    <div className="space-y-6 p-4">
      <div data-sb-notifications className="flex items-center justify-center">
        <Notifications
          labels={{
            accept: t('headerNotifications.accept'),
            decline: t('headerNotifications.decline'),
            title: t('headerNotifications.title'),
            viewAll: t('headerNotifications.viewAll'),
          }}
        />
      </div>
      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">
          {t('notifications.story.layoutFactoryContext', 'Layout Factory Context')}
        </p>
        <div className="text-sm">
          <p className="text-muted-foreground text-xs">
            Empty State: {emptyState.title} ({emptyState.icon ?? 'no icon'})
          </p>
          <p className="text-muted-foreground text-xs">
            Active Nav: {activeSidebarItem.label} (icon:{' '}
            {activeSidebarItem.icon ?? SIDEBAR_ICONS[0]})
          </p>
        </div>
        <div className="text-sm">
          <p className="text-muted-foreground text-xs font-medium">
            Quick Items ({menuItems.length})
          </p>
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
            {menuItems.map((item) => (
              <li key={item.id}>
                {item.label}: {item.value}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export const WithLayoutFactoryData: Story = {
  render: () => <NotificationsWithLayoutFactory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Layout Factory Context/i)).toBeInTheDocument();
    expect(canvas.getByText(/Quick Items/i)).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="notifications"]')).toBeInTheDocument();
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
        {i18n.t('headerNotifications.title')} - All Layout Factories ({SIDEBAR_ICONS.length} icons)
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

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: notificationHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => <NotificationsWithFakerData />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('.rounded-lg');
    expect(container).toBeInTheDocument();
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: notificationHandlers },
  },
  render: () => <NotificationsWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(
      canvasElement.querySelector('[data-testid="notifications-loading"]')
    ).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="notifications-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: notificationStatusHandlers.loading },
  },
  render: () => <NotificationsWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(
      canvasElement.querySelector('[data-testid="notifications-loading"]')
    ).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: notificationStatusHandlers.empty },
  },
  render: () => <NotificationsWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="notifications-empty"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('notifications.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: notificationStatusHandlers.badRequest },
  },
  render: () => <NotificationsWithAsyncData />,
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
  name: i18n.t('notifications.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: notificationStatusHandlers.unauthorized },
  },
  render: () => <NotificationsWithAsyncData />,
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
  name: i18n.t('notifications.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: notificationStatusHandlers.forbidden },
  },
  render: () => <NotificationsWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="403"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('notifications.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: notificationStatusHandlers.tooManyRequests },
  },
  render: () => <NotificationsWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="429"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'notifications.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  parameters: {
    msw: { handlers: notificationStatusHandlers.internalServerError },
  },
  render: () => <NotificationsWithAsyncData />,
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
  name: i18n.t('notifications.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: notificationStatusHandlers.badGateway },
  },
  render: () => <NotificationsWithAsyncData />,
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
    'notifications.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  parameters: {
    msw: { handlers: notificationStatusHandlers.serviceUnavailable },
  },
  render: () => <NotificationsWithAsyncData />,
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
  name: i18n.t('notifications.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: notificationStatusHandlers.gatewayTimeout },
  },
  render: () => <NotificationsWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="504"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ SPECIAL STATE STORIES ============

export const SlowResponse: Story = {
  name: i18n.t('notifications.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: notificationStatusHandlers.slowResponse },
  },
  render: () => <NotificationsWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(
      canvasElement.querySelector('[data-testid="notifications-loading"]')
    ).toBeInTheDocument();
    // Wait for data (slow response takes 5s)
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="notifications-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('notifications.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: notificationStatusHandlers.networkError },
  },
  render: () => <NotificationsWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="notifications-error"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const ManyUnread: Story = {
  name: i18n.t('notifications.storyName.manyUnread', 'Many Unread (25+)'),
  parameters: {
    msw: { handlers: notificationStatusHandlers.manyUnread },
  },
  render: () => <NotificationsWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="notifications-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const AllRead: Story = {
  name: i18n.t('notifications.storyName.allRead', 'All Read'),
  parameters: {
    msw: { handlers: notificationStatusHandlers.allRead },
  },
  render: () => <NotificationsWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="notifications-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Accessibility: Story = {
  name: i18n.t('notifications.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const root = canvasElement.querySelector<HTMLElement>('[data-sb-notifications]');

    if (!root) {
      throw new Error('Notifications story root not found.');
    }

    const canvas = within(root);
    const trigger = canvas.getByTestId('header-notifications-trigger');
    expect(trigger).toBeInTheDocument();

    // Test trigger has aria-label
    expect(trigger).toHaveAttribute('aria-label');
    expect(trigger.getAttribute('aria-label')?.trim()).not.toBe('');

    // Verify initial aria-expanded state
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Test keyboard navigation - trigger should be focusable
    trigger.focus();
    expect(doc.activeElement).toBe(trigger);

    // Test Enter key opens menu
    await userEvent.keyboard('{Enter}');

    // Verify aria-expanded changes after opening
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    const content = await waitFor(() => {
      const element = doc.querySelector<HTMLElement>(
        '[data-testid="header-notifications-content"]'
      );
      if (!element) {
        throw new Error('Dropdown menu content not found.');
      }
      return element;
    });

    expect(content).toBeInTheDocument();

    const menu = within(content);

    // Test title is accessible
    const title = menu.getByTestId('header-notifications-title');
    expect(title).toBeInTheDocument();
    expect(title.textContent?.trim()).not.toBe('');

    // Test view all link has href
    const viewAll = menu.getByTestId('header-notifications-view-all');
    expect(viewAll).toBeInTheDocument();
    expect(viewAll).toHaveAttribute('href', '#');

    // Test keyboard navigation within menu
    await userEvent.tab();

    // Test Escape key closes menu
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        doc.querySelector('[data-testid="header-notifications-content"]')
      ).not.toBeInTheDocument();
    });

    // Verify aria-expanded changes back to false after closing
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Verify focus returns to trigger
    expect(doc.activeElement).toBe(trigger);
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('notifications.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: notificationStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('notifications.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: notificationStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'notifications.storyName.handlerUnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: notificationStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('notifications.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: notificationStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
