import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { toast as showToast, useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';

import {
  createFakeAccessibleToast,
  createFakeErrorToast,
  createFakeFileOperationToast,
  createFakeFormValidationToast,
  createFakeInfoToast,
  createFakeLoadingToast,
  createFakeNetworkStatusToast,
  createFakePersistentToast,
  createFakePromiseToastSet,
  createFakeStackedToasts,
  createFakeSuccessToast,
  createFakeToast,
  createFakeToasterConfig,
  createFakeToastPositionMatrix,
  createFakeToastQueue,
  createFakeToasts,
  createFakeToastVariantMatrix,
  createFakeToastWithActionsMatrix,
  createFakeUndoToast,
  createFakeWarningToast,
  TOAST_ACTION_LABELS,
  TOAST_DESCRIPTIONS,
  TOAST_DURATIONS,
  TOAST_ICONS,
  TOAST_POSITIONS,
  TOAST_TITLES,
  TOAST_VARIANTS,
} from '@/.storybook/stories/_factories/toast.factory';
import type {
  ToastAction as FactoryToastAction,
  FakePromiseToastSet,
  FakeToast,
  FakeToasterConfig,
  FakeToastQueue,
  ToastActionStyle,
  ToastPosition,
  ToastVariant,
} from '@/.storybook/stories/_factories/toast.factory';
import { toastHandlers, toastStatusHandlers } from '@/.storybook/stories/_handlers/toast.handlers';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function ToastRenderer() {
  const { toasts } = useToast();

  return (
    <>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title ? <ToastTitle data-toast-title>{title}</ToastTitle> : null}
            {description ? (
              <ToastDescription data-toast-description>{description}</ToastDescription>
            ) : null}
          </div>
          {action}
          <ToastClose aria-label={i18n.t('toast.story.closeToast', 'Close toast')} />
        </Toast>
      ))}
      <ToastViewport
        aria-label={i18n.t('toast.story.notifications', 'Notifications')}
        data-toast-viewport
      />
    </>
  );
}

function ToastDemo() {
  return (
    <ToastProvider>
      <div className="flex flex-wrap gap-2">
        <Button
          data-toast-trigger="default"
          onClick={() =>
            showToast({
              title: i18n.t('toast.story.scheduled', 'Scheduled'),
              description: i18n.t(
                'toast.story.meetingBooked',
                'Your meeting is booked for tomorrow at 9:00 AM.'
              ),
              action: (
                <ToastAction altText={i18n.t('toast.story.undo', 'Undo')} data-toast-action>
                  {i18n.t('toast.story.undo', 'Undo')}
                </ToastAction>
              ),
            })
          }
          variant="outline"
        >
          {i18n.t('toast.story.default', 'Default')}
        </Button>
        <Button
          data-toast-trigger="destructive"
          onClick={() =>
            showToast({
              title: i18n.t('toast.story.error', 'Error'),
              description: i18n.t(
                'toast.story.somethingWentWrong',
                'Something went wrong. Please try again.'
              ),
              variant: 'destructive',
            })
          }
          variant="outline"
        >
          {i18n.t('toast.story.destructive', 'Destructive')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

function I18nToastDemo() {
  const { t } = useTranslation();

  return (
    <ToastProvider>
      <div className="flex flex-wrap gap-2">
        <Button
          data-toast-trigger="default"
          onClick={() =>
            showToast({
              title: t('toast.toast.default.title'),
              description: t('toast.toast.default.description'),
              action: (
                <ToastAction altText={t('toast.action.undo')} data-toast-action>
                  {t('toast.action.undo')}
                </ToastAction>
              ),
            })
          }
          variant="outline"
        >
          {t('toast.trigger.default')}
        </Button>
        <Button
          data-toast-trigger="destructive"
          onClick={() =>
            showToast({
              title: t('toast.toast.destructive.title'),
              description: t('toast.toast.destructive.description'),
              variant: 'destructive',
            })
          }
          variant="outline"
        >
          {t('toast.trigger.destructive')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

// ============ MSW + FAKER INTEGRATION ============

// Demo: Toast triggered by API response
function ToastWithApiDemo() {
  const [loading, setLoading] = React.useState(false);

  const handleMarkAsRead = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications/1/read', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        showToast({
          title: i18n.t('toast.story.error', 'Error'),
          description:
            errorData.message || i18n.t('toast.story.failedToMarkAsRead', 'Failed to mark as read'),
          variant: 'destructive',
        });
        return;
      }

      showToast({
        title: i18n.t('toast.story.success', 'Success'),
        description: i18n.t('toast.story.notificationMarkedAsRead', 'Notification marked as read'),
        action: (
          <ToastAction altText={i18n.t('toast.story.undo', 'Undo')} data-toast-action>
            {i18n.t('toast.story.undo', 'Undo')}
          </ToastAction>
        ),
      });
    } catch {
      showToast({
        title: i18n.t('toast.story.networkError', 'Network Error'),
        description: i18n.t('toast.story.unableToConnect', 'Unable to connect to server'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMarkAllRead = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        showToast({
          title: i18n.t('toast.story.error', 'Error'),
          description:
            errorData.message ||
            i18n.t('toast.story.failedToMarkAllAsRead', 'Failed to mark all as read'),
          variant: 'destructive',
        });
        return;
      }

      const data = (await response.json()) as { count?: number };
      showToast({
        title: i18n.t('toast.story.allCaughtUp', 'All Caught Up!'),
        description: i18n.t(
          'toast.story.notificationsMarkedAsRead',
          '{{count}} notifications marked as read',
          { count: data.count ?? 0 }
        ),
      });
    } catch {
      showToast({
        title: i18n.t('toast.story.networkError', 'Network Error'),
        description: i18n.t('toast.story.unableToConnect', 'Unable to connect to server'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications/1', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        showToast({
          title: i18n.t('toast.story.error', 'Error'),
          description:
            errorData.message ||
            i18n.t('toast.story.failedToDeleteNotification', 'Failed to delete notification'),
          variant: 'destructive',
        });
        return;
      }

      showToast({
        title: i18n.t('toast.story.deleted', 'Deleted'),
        description: i18n.t('toast.story.notificationRemoved', 'Notification has been removed'),
      });
    } catch {
      showToast({
        title: i18n.t('toast.story.networkError', 'Network Error'),
        description: i18n.t('toast.story.unableToConnect', 'Unable to connect to server'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <ToastProvider>
      <div className="space-y-4" data-state={loading ? 'loading' : 'idle'}>
        <p className="text-muted-foreground text-sm">
          {i18n.t(
            'toast.story.clickButtonsInstruction',
            'Click buttons to trigger API calls and see toast responses:'
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            data-toast-trigger="mark-read"
            onClick={handleMarkAsRead}
            disabled={loading}
            variant="outline"
          >
            {loading ? <Spinner className="mr-2 size-4" /> : null}
            {i18n.t('toast.story.markAsRead', 'Mark as Read')}
          </Button>
          <Button
            data-toast-trigger="mark-all-read"
            onClick={handleMarkAllRead}
            disabled={loading}
            variant="outline"
          >
            {loading ? <Spinner className="mr-2 size-4" /> : null}
            {i18n.t('toast.story.markAllRead', 'Mark All Read')}
          </Button>
          <Button
            data-toast-trigger="delete"
            onClick={handleDelete}
            disabled={loading}
            variant="outline"
          >
            {loading ? <Spinner className="mr-2 size-4" /> : null}
            {i18n.t('toast.story.delete', 'Delete')}
          </Button>
        </div>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

// Demo: Toast with Faker-generated content (uses toast.factory)
function ToastWithFakerDemo() {
  const { t } = useTranslation();

  const fakeToasts = React.useMemo(() => createFakeToasts(5), []);

  const showFakeToast = React.useCallback(() => {
    const fake = fakeToasts[Math.floor(Math.random() * fakeToasts.length)];
    showToast({
      title: fake.title,
      description: fake.description,
      variant: fake.variant === 'destructive' ? 'destructive' : 'default',
      action: fake.action ? (
        <ToastAction altText={fake.action.altText} data-toast-action>
          {fake.action.label}
        </ToastAction>
      ) : undefined,
    });
  }, [fakeToasts]);

  const showMultipleToasts = React.useCallback(() => {
    fakeToasts.slice(0, 4).forEach((fake, index) => {
      setTimeout(() => {
        showToast({
          title: fake.title,
          description: fake.description,
          variant: fake.variant === 'destructive' ? 'destructive' : 'default',
        });
      }, index * 500);
    });
  }, [fakeToasts]);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {t(
            'toast.story.showToastsWithFakergeneratedContent',
            'Show toasts with Faker-generated content:'
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button data-toast-trigger="faker-single" onClick={showFakeToast} variant="outline">
            Random Notification
          </Button>
          <Button
            data-toast-trigger="faker-multiple"
            onClick={showMultipleToasts}
            variant="outline"
          >
            Show Multiple Types
          </Button>
        </div>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

const meta = {
  title: 'Components/UI/Toast',
  component: ToastDemo,
  tags: ['autodocs'],
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onDismiss: fn(),
  },
  parameters: {
    msw: {
      handlers: toastHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('toast.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('toast.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('toast.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('toast.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('toast.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('toast.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('toast.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onDismiss: {
      action: 'onDismiss',
      description: i18n.t(
        'toast.argType.calledWhenToastIsDismissed',
        'Called when toast is dismissed'
      ),
      table: { category: 'Events' },
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'toast.argType.calledWhenOpenStateChanges',
        'Called when open state changes'
      ),
      table: { category: 'Events' },
    },
    // Toast System Overview:
    // Uses Radix Toast primitives with custom hook (useToast)
    //
    // toast() Function (from use-toast hook):
    // - title: Toast title (string)
    // - description: Toast description (string)
    // - action: Action button element (ReactNode, use ToastAction)
    // - variant: Visual variant ('default' | 'destructive')
    // - duration: Auto-dismiss duration in ms (number, default: 5000)
    // - onOpenChange: Called when open state changes ((open: boolean) => void)
    //
    // ToastProvider Props Reference (Radix Toast.Provider):
    // - duration: Default duration for all toasts in ms (number, default: 5000)
    // - swipeDirection: Swipe direction to dismiss ('right' | 'left' | 'up' | 'down')
    // - swipeThreshold: Swipe distance threshold in px (number, default: 50)
    // - label: Accessible label for toast region (string, default: 'Notification')
    //
    // Toast Props Reference (Radix Toast.Root):
    // - variant: Visual variant ('default' | 'destructive')
    // - open: Controlled open state (boolean)
    // - defaultOpen: Default open state (boolean, default: true)
    // - onOpenChange: Called when open state changes ((open: boolean) => void)
    // - duration: Auto-dismiss duration in ms (number)
    // - forceMount: Force mount when closed (boolean)
    // - type: ARIA live region type ('foreground' | 'background', default: 'foreground')
    //
    // ToastAction Props Reference (Radix Toast.Action):
    // - altText: Accessible label for the action (string, required)
    // - asChild: Render as child element (boolean)
    //
    // ToastClose Props Reference (Radix Toast.Close):
    // - aria-label: Accessible label (string, default: 'Close')
    //
    // ToastViewport Props Reference (Radix Toast.Viewport):
    // - hotkey: Keyboard shortcut to focus viewport (string[], default: ['F8'])
    // - label: Accessible label (string, default: 'Notifications ({hotkey})')
  },
} satisfies Meta<typeof ToastDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Toasts: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toast"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-toast-trigger]');
    expect(triggers.length).toBe(2);
  },
};

export const Playground: Story = {
  ...Toasts,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-toast-trigger]');
    expect(triggers.length).toBe(2);
    expect(canvasElement.querySelector('[data-slot="toast"]')).toBeInTheDocument();
  },
};

function VariantsDemo() {
  return (
    <ToastProvider>
      <div className="flex flex-col gap-6">
        <div>
          <p className="mb-2 text-sm font-medium">{i18n.t('toast.variants.default')}</p>
          <Button
            onClick={() =>
              showToast({
                title: i18n.t('toast.story.notification', 'Notification'),
                description: i18n.t(
                  'toast.story.defaultNotificationMessage',
                  'This is a default notification message.'
                ),
              })
            }
            variant="outline"
          >
            {i18n.t('toast.story.showDefaultToast', 'Show Default Toast')}
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{i18n.t('toast.variants.success')}</p>
          <Button
            onClick={() =>
              showToast({
                title: i18n.t('toast.story.success', 'Success'),
                description: i18n.t(
                  'toast.story.changesSavedSuccessfully',
                  'Your changes have been saved successfully.'
                ),
                action: (
                  <ToastAction altText={i18n.t('toast.story.view', 'View')}>
                    {i18n.t('toast.story.view', 'View')}
                  </ToastAction>
                ),
              })
            }
            variant="outline"
          >
            {i18n.t('toast.story.showSuccessToast', 'Show Success Toast')}
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{i18n.t('toast.variants.destructive')}</p>
          <Button
            onClick={() =>
              showToast({
                title: i18n.t('toast.story.error', 'Error'),
                description: i18n.t(
                  'toast.story.somethingWentWrong',
                  'Something went wrong. Please try again.'
                ),
                variant: 'destructive',
              })
            }
            variant="outline"
          >
            {i18n.t('toast.story.showErrorToast', 'Show Error Toast')}
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{i18n.t('toast.variants.withAction')}</p>
          <Button
            onClick={() =>
              showToast({
                title: i18n.t('toast.story.meetingScheduled', 'Meeting Scheduled'),
                description: i18n.t(
                  'toast.story.meetingBooked',
                  'Your meeting is booked for tomorrow at 9:00 AM.'
                ),
                action: (
                  <ToastAction altText={i18n.t('toast.story.undo', 'Undo')}>
                    {i18n.t('toast.story.undo', 'Undo')}
                  </ToastAction>
                ),
              })
            }
            variant="outline"
          >
            {i18n.t('toast.story.showToastWithAction', 'Show Toast with Action')}
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{i18n.t('toast.variants.descriptionOnly')}</p>
          <Button
            onClick={() =>
              showToast({
                description: i18n.t(
                  'toast.story.fileUploaded',
                  'Your file has been uploaded to the server.'
                ),
              })
            }
            variant="outline"
          >
            {i18n.t('toast.story.showDescriptionOnlyToast', 'Show Description-Only Toast')}
          </Button>
        </div>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('button');
    expect(buttons.length).toBe(5);
  },
};

function SizesDemo() {
  return (
    <ToastProvider>
      <div className="flex flex-col gap-6">
        <div>
          <p className="mb-2 text-sm font-medium">{i18n.t('toast.sizes.compact')}</p>
          <Button
            onClick={() =>
              showToast({
                title: 'Saved!',
              })
            }
            variant="outline"
          >
            Show Compact Toast
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{i18n.t('toast.sizes.default')}</p>
          <Button
            onClick={() =>
              showToast({
                title: 'Changes Saved',
                description: 'Your changes have been saved successfully.',
              })
            }
            variant="outline"
          >
            Show Default Toast
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{i18n.t('toast.sizes.rich')}</p>
          <Button
            onClick={() =>
              showToast({
                title: 'File Uploaded',
                description:
                  'Your file "document.pdf" has been uploaded to the cloud storage and is now available for sharing.',
                action: (
                  <ToastAction altText="View File">
                    {i18n.t('toast.story.viewFile', 'View File')}
                  </ToastAction>
                ),
              })
            }
            variant="outline"
          >
            Show Rich Toast
          </Button>
        </div>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('button');
    expect(buttons.length).toBe(3);
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="toast"]')).toBeInTheDocument();

    const viewport = canvasElement.querySelector('[data-toast-viewport]');
    if (!(viewport instanceof HTMLElement)) {
      throw new Error('Toast viewport was not found.');
    }

    // Defensive cleanup in case a previous story left an open toast mounted.
    const existingClose = viewport.querySelector('button[toast-close]');
    if (existingClose instanceof HTMLButtonElement) {
      await userEvent.click(existingClose);
      await waitFor(() =>
        expect(viewport.querySelector('li[data-state=\"open\"]')).not.toBeInTheDocument()
      );
    }

    const defaultTrigger = canvasElement.querySelector('[data-toast-trigger="default"]');
    if (!(defaultTrigger instanceof HTMLButtonElement)) {
      throw new Error('Default toast trigger was not found.');
    }

    await userEvent.click(defaultTrigger);

    const getOpenToast = () => viewport.querySelector('li[data-state="open"]');

    await waitFor(() => {
      expect(getOpenToast()).toBeInTheDocument();
    });

    const defaultToast = getOpenToast();
    if (!(defaultToast instanceof HTMLElement)) throw new Error('Default toast did not render.');

    const defaultTitle = defaultToast.querySelector('[data-toast-title]');
    expect(defaultTitle).toBeInTheDocument();
    expect(defaultTitle).toHaveTextContent(/.+/);
    const defaultDescription = defaultToast.querySelector('[data-toast-description]');
    expect(defaultDescription).toBeInTheDocument();
    expect(defaultDescription).toHaveTextContent(/.+/);
    expect(defaultToast.querySelector('[data-toast-action]')).toBeInTheDocument();
    expect(defaultToast.querySelector('button[toast-close]')).toBeInTheDocument();

    const closeDefault = defaultToast.querySelector('button[toast-close]');
    if (!(closeDefault instanceof HTMLButtonElement)) {
      throw new Error('Toast close button was not found.');
    }
    await userEvent.click(closeDefault);
    await waitFor(() => expect(getOpenToast()).not.toBeInTheDocument());

    const destructiveTrigger = canvasElement.querySelector('[data-toast-trigger="destructive"]');
    if (!(destructiveTrigger instanceof HTMLButtonElement)) {
      throw new Error('Destructive toast trigger was not found.');
    }

    await userEvent.click(destructiveTrigger);

    await waitFor(() => {
      expect(getOpenToast()).toBeInTheDocument();
    });

    const destructiveToast = getOpenToast();
    if (!(destructiveToast instanceof HTMLElement)) {
      throw new Error('Destructive toast did not render.');
    }

    const destructiveTitle = destructiveToast.querySelector('[data-toast-title]');
    expect(destructiveTitle).toBeInTheDocument();
    expect(destructiveTitle).toHaveTextContent(/.+/);
    const destructiveDescription = destructiveToast.querySelector('[data-toast-description]');
    expect(destructiveDescription).toBeInTheDocument();
    expect(destructiveDescription).toHaveTextContent(/.+/);
    expect(destructiveToast.querySelector('[data-toast-action]')).not.toBeInTheDocument();
    expect(destructiveToast.querySelector('button[toast-close]')).toBeInTheDocument();

    const closeDestructive = destructiveToast.querySelector('button[toast-close]');
    if (!(closeDestructive instanceof HTMLButtonElement)) {
      throw new Error('Toast close button was not found.');
    }
    await userEvent.click(closeDestructive);
    await waitFor(() => expect(getOpenToast()).not.toBeInTheDocument());
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toast"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-toast-trigger]');
    expect(triggers.length).toBe(2);
    expect(canvasElement.querySelector('[data-toast-viewport]')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toast"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-toast-trigger]');
    expect(triggers.length).toBe(2);
    expect(canvasElement.querySelector('[data-toast-viewport]')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  globals: {
    locale: 'ja',
  },
  render: () => <I18nToastDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    await Default.play?.(context);

    const viewport = context.canvasElement.querySelector('[data-toast-viewport]');
    if (!(viewport instanceof HTMLElement)) {
      throw new Error('Toast viewport was not found.');
    }

    expect(viewport.textContent ?? '').toContain('予定');
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
  name: i18n.t('toast.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ MSW + FAKER STORIES ============

export const WithFakerData: Story = {
  render: () => <ToastWithFakerDemo />,
  play: async ({ canvasElement }) => {
    const singleTrigger = canvasElement.querySelector('[data-toast-trigger="faker-single"]');
    expect(singleTrigger).toBeInTheDocument();

    const multipleTrigger = canvasElement.querySelector('[data-toast-trigger="faker-multiple"]');
    expect(multipleTrigger).toBeInTheDocument();
  },
};

export const WithApiResponse: Story = {
  parameters: {
    msw: {
      handlers: toastHandlers,
    },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    expect(markReadTrigger).toBeInTheDocument();

    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error401Unauthorized: Story = {
  parameters: {
    msw: {
      handlers: toastStatusHandlers.unauthorized,
    },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast?.textContent).toContain('Error');
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error404NotFound: Story = {
  parameters: {
    msw: {
      handlers: toastStatusHandlers.notFound,
    },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast?.textContent).toContain('Error');
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: toastStatusHandlers.unprocessableEntity },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast?.textContent).toContain('Error');
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error500InternalServerError: Story = {
  parameters: {
    msw: {
      handlers: toastStatusHandlers.internalServerError,
    },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast?.textContent).toContain('Error');
        },
        { timeout: 3000 }
      );
    }
  },
};

export const NetworkError: Story = {
  parameters: {
    msw: {
      handlers: toastStatusHandlers.networkError,
    },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast?.textContent).toContain('Network Error');
        },
        { timeout: 3000 }
      );
    }
  },
};

export const SlowResponse: Story = {
  parameters: {
    msw: {
      handlers: toastStatusHandlers.slowResponse,
    },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      // Check loading state appears
      await waitFor(() => {
        expect(canvasElement.querySelector('[data-state="loading"]')).toBeInTheDocument();
      });

      // Eventually completes
      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast).toBeInTheDocument();
        },
        { timeout: 7000 }
      );
    }
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toastHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toast"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-toast-trigger]');
    expect(triggers.length).toBe(2);
    expect(canvasElement.querySelector('[data-toast-viewport]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toastStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toast"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-toast-trigger]');
    expect(triggers.length).toBe(2);
    expect(canvasElement.querySelector('[data-toast-viewport]')).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('toast.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Verify toast viewport has correct aria-label
    const viewport = canvasElement.querySelector('[data-toast-viewport]');
    if (!(viewport instanceof HTMLElement)) {
      throw new Error('Toast viewport was not found.');
    }
    expect(viewport).toHaveAttribute('aria-label');

    // Trigger a toast
    const trigger = canvasElement.querySelector('[data-toast-trigger="default"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Toast trigger was not found.');
    }

    await userEvent.click(trigger);

    // Wait for toast to appear
    const toast = await waitFor(() => {
      const el = viewport.querySelector('li[data-state="open"]');
      if (!(el instanceof HTMLElement)) throw new Error('Toast was not rendered.');
      return el;
    });

    // Verify toast has appropriate ARIA live region behavior
    // Toasts should be announced to screen readers
    expect(toast).toHaveAttribute('role');

    // Verify title and description are present for screen readers
    const title = toast.querySelector('[data-toast-title]');
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent(/.+/);

    const description = toast.querySelector('[data-toast-description]');
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent(/.+/);

    // Verify close button has accessible label
    const closeButton = toast.querySelector('button[toast-close]');
    if (closeButton instanceof HTMLButtonElement) {
      expect(closeButton).toHaveAttribute('aria-label');

      // Test keyboard dismissal
      closeButton.focus();
      expect(doc.activeElement).toBe(closeButton);
      await userEvent.keyboard('{Enter}');
    }

    await waitFor(() => {
      expect(viewport.querySelector('li[data-state="open"]')).not.toBeInTheDocument();
    });
  },
};

// ============ QUEUE MANAGEMENT STORIES ============

function ToastQueueDemo() {
  const showMultipleToasts = React.useCallback(() => {
    const notifications = [
      { title: 'First Toast', description: 'This is the first notification in the queue.' },
      { title: 'Second Toast', description: 'This is the second notification in the queue.' },
      { title: 'Third Toast', description: 'This is the third notification in the queue.' },
      { title: 'Fourth Toast', description: 'This is the fourth notification in the queue.' },
      { title: 'Fifth Toast', description: 'This is the fifth notification in the queue.' },
    ];

    notifications.forEach((notification, index) => {
      setTimeout(() => {
        showToast({
          title: notification.title,
          description: notification.description,
        });
      }, index * 200);
    });
  }, []);

  const showRapidToasts = React.useCallback(() => {
    for (let i = 0; i < 10; i++) {
      showToast({
        title: `Rapid Toast ${i + 1}`,
        description: `Quickly queued notification #${i + 1}`,
      });
    }
  }, []);

  const showMixedPriorityToasts = React.useCallback(() => {
    showToast({
      title: 'Normal',
      description: 'This is a regular notification.',
    });
    showToast({
      title: 'Error',
      description: 'This is an error notification that requires attention.',
      variant: 'destructive',
    });
    showToast({
      title: 'Success',
      description: 'This is a success notification with an action.',
      action: (
        <ToastAction altText="View" data-toast-action>
          View
        </ToastAction>
      ),
    });
  }, []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t(
            'toast.story.testToastQueueManagementAndStacking',
            'Test toast queue management and stacking:'
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            data-toast-trigger="queue-sequential"
            onClick={showMultipleToasts}
            variant="outline"
          >
            Sequential Queue (5 toasts)
          </Button>
          <Button data-toast-trigger="queue-rapid" onClick={showRapidToasts} variant="outline">
            Rapid Fire (10 toasts)
          </Button>
          <Button
            data-toast-trigger="queue-mixed"
            onClick={showMixedPriorityToasts}
            variant="outline"
          >
            Mixed Priority
          </Button>
        </div>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const QueueManagement: Story = {
  render: () => <ToastQueueDemo />,
  play: async ({ canvasElement }) => {
    const sequentialTrigger = canvasElement.querySelector(
      '[data-toast-trigger="queue-sequential"]'
    );
    expect(sequentialTrigger).toBeInTheDocument();

    const rapidTrigger = canvasElement.querySelector('[data-toast-trigger="queue-rapid"]');
    expect(rapidTrigger).toBeInTheDocument();

    const mixedTrigger = canvasElement.querySelector('[data-toast-trigger="queue-mixed"]');
    expect(mixedTrigger).toBeInTheDocument();

    // Test rapid fire queue
    if (rapidTrigger instanceof HTMLButtonElement) {
      await userEvent.click(rapidTrigger);

      // Wait for toasts to appear
      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toasts = viewport?.querySelectorAll('li[data-state="open"]');
          expect(toasts?.length).not.toBe(0);
        },
        { timeout: 3000 }
      );
    }
  },
};

export const QueueStacking: Story = {
  render: () => {
    const showStackedToasts = () => {
      showToast({ title: 'Toast 1', description: 'First in stack' });
      showToast({ title: 'Toast 2', description: 'Second in stack' });
      showToast({ title: 'Toast 3', description: 'Third in stack' });
    };

    return (
      <ToastProvider>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {i18n.t(
              'toast.story.testHowMultipleToastsStackVisually',
              'Test how multiple toasts stack visually:'
            )}
          </p>
          <Button data-toast-trigger="stack" onClick={showStackedToasts} variant="outline">
            Show Stacked Toasts
          </Button>
        </div>
        <ToastRenderer />
      </ToastProvider>
    );
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-toast-trigger="stack"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toasts = viewport?.querySelectorAll('li');
          expect(toasts?.length ?? 0).toBeGreaterThanOrEqual(1);
        },
        { timeout: 3000 }
      );
    }
  },
};

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: toastHandlers },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    expect(markReadTrigger).toBeInTheDocument();

    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: toastStatusHandlers.emptyData },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-toast-trigger]');
    expect(triggers.length).toBe(3);
  },
};

export const Error400BadRequest: Story = {
  parameters: {
    msw: { handlers: toastStatusHandlers.badRequest },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast?.textContent).toContain('Error');
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error403Forbidden: Story = {
  parameters: {
    msw: { handlers: toastStatusHandlers.forbidden },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast?.textContent).toContain('Error');
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error429RateLimit: Story = {
  parameters: {
    msw: { handlers: toastStatusHandlers.tooManyRequests },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast?.textContent).toContain('Error');
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error502BadGateway: Story = {
  parameters: {
    msw: { handlers: toastStatusHandlers.badGateway },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error503ServiceUnavailable: Story = {
  parameters: {
    msw: { handlers: toastStatusHandlers.serviceUnavailable },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error504GatewayTimeout: Story = {
  parameters: {
    msw: { handlers: toastStatusHandlers.gatewayTimeout },
  },
  render: () => <ToastWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-toast-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

// ============ FACTORY-WIRED STORIES ============

// --- Single Toast Factory ---
function FactorySingleToastDemo() {
  const fakeToast: FakeToast = React.useMemo(() => createFakeToast(), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.singleToast.description')}
        </p>
        <div data-factory-single className="rounded-md border p-4">
          <p className="text-sm font-medium" data-factory-title>
            {fakeToast.title}
          </p>
          {fakeToast.description ? (
            <p className="text-muted-foreground text-sm" data-factory-description>
              {fakeToast.description}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Variant: <span data-factory-variant>{fakeToast.variant}</span> | Duration:{' '}
            {fakeToast.duration}ms | Closable: {String(fakeToast.closable)}
          </p>
        </div>
        <Button
          data-toast-trigger="factory-single"
          onClick={() =>
            showToast({
              title: fakeToast.title,
              description: fakeToast.description,
              variant: fakeToast.variant === 'destructive' ? 'destructive' : 'default',
            })
          }
          variant="outline"
        >
          {i18n.t('toast.factory.singleToast')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactorySingleToast: Story = {
  render: () => <FactorySingleToastDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-single]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-factory-title]')).toHaveTextContent(/.+/);
    expect(canvasElement.querySelector('[data-factory-variant]')).toHaveTextContent(/.+/);

    const trigger = canvasElement.querySelector('[data-toast-trigger="factory-single"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          expect(viewport?.querySelector('li[data-state="open"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

// --- Variant Matrix Factory ---
function FactoryVariantMatrixDemo() {
  const variantMatrix = React.useMemo(() => createFakeToastVariantMatrix(), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.variantMatrix.description')}
        </p>
        <div className="space-y-2" data-factory-variant-matrix>
          {variantMatrix.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-md border p-3">
              <span className="w-24 text-xs font-medium" data-variant-label>
                {item.variant}
              </span>
              <span className="text-sm">{item.title}</span>
              {item.icon ? (
                <span className="text-muted-foreground text-xs">({item.icon})</span>
              ) : null}
            </div>
          ))}
        </div>
        <Button
          data-toast-trigger="variant-matrix"
          onClick={() => {
            variantMatrix.forEach((item, index) => {
              setTimeout(() => {
                showToast({
                  title: item.title,
                  description: item.description,
                  variant: item.variant === 'destructive' ? 'destructive' : 'default',
                });
              }, index * 300);
            });
          }}
          variant="outline"
        >
          {i18n.t('toast.factory.variantMatrix')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryVariantMatrix: Story = {
  render: () => <FactoryVariantMatrixDemo />,
  play: async ({ canvasElement }) => {
    const matrix = canvasElement.querySelector('[data-factory-variant-matrix]');
    expect(matrix).toBeInTheDocument();
    const labels = canvasElement.querySelectorAll('[data-variant-label]');
    expect(labels.length).toBe(TOAST_VARIANTS.length);

    const trigger = canvasElement.querySelector('[data-toast-trigger="variant-matrix"]');
    expect(trigger).toBeInTheDocument();
  },
};

// --- Position Matrix Factory ---
function FactoryPositionMatrixDemo() {
  const positionMatrix: FakeToasterConfig[] = React.useMemo(
    () => createFakeToastPositionMatrix(),
    []
  );

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.positionMatrix.description')}
        </p>
        <div className="grid grid-cols-3 gap-2" data-factory-position-matrix>
          {positionMatrix.map((config) => (
            <div key={config.position} className="rounded-md border p-3 text-center">
              <p className="text-sm font-medium" data-position-label>
                {config.position}
              </p>
              <p className="text-muted-foreground text-xs">
                Theme: {config.theme} | Rich: {String(config.richColors)}
              </p>
            </div>
          ))}
        </div>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryPositionMatrix: Story = {
  render: () => <FactoryPositionMatrixDemo />,
  play: async ({ canvasElement }) => {
    const matrix = canvasElement.querySelector('[data-factory-position-matrix]');
    expect(matrix).toBeInTheDocument();
    const labels = canvasElement.querySelectorAll('[data-position-label]');
    expect(labels.length).toBe(TOAST_POSITIONS.length);
  },
};

// --- Actions Matrix Factory ---
function FactoryActionsMatrixDemo() {
  const actionsMatrix = React.useMemo(() => createFakeToastWithActionsMatrix(), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.actionsMatrix.description')}
        </p>
        <div className="space-y-2" data-factory-actions-matrix>
          {actionsMatrix.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-md border p-3">
              <span className="w-24 text-xs font-medium" data-action-variant>
                {item.variant}
              </span>
              <span className="text-sm">{item.title}</span>
              {item.action ? (
                <span className="text-xs text-blue-600" data-action-label>
                  [{item.action.label}]
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <Button
          data-toast-trigger="actions-matrix"
          onClick={() => {
            actionsMatrix.forEach((item, index) => {
              setTimeout(() => {
                showToast({
                  title: item.title,
                  description: item.description,
                  variant: item.variant === 'destructive' ? 'destructive' : 'default',
                  action: item.action ? (
                    <ToastAction altText={item.action.altText} data-toast-action>
                      {item.action.label}
                    </ToastAction>
                  ) : undefined,
                });
              }, index * 300);
            });
          }}
          variant="outline"
        >
          {i18n.t('toast.factory.actionsMatrix')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryActionsMatrix: Story = {
  render: () => <FactoryActionsMatrixDemo />,
  play: async ({ canvasElement }) => {
    const matrix = canvasElement.querySelector('[data-factory-actions-matrix]');
    expect(matrix).toBeInTheDocument();
    const variants = canvasElement.querySelectorAll('[data-action-variant]');
    expect(variants.length).toBe(TOAST_VARIANTS.length);

    const trigger = canvasElement.querySelector('[data-toast-trigger="actions-matrix"]');
    expect(trigger).toBeInTheDocument();
  },
};

// --- Success Toast Factory ---
function FactorySuccessToastDemo() {
  const successToast = React.useMemo(() => createFakeSuccessToast(), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.successToast.description')}
        </p>
        <div
          className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950"
          data-factory-success
        >
          <p className="text-sm font-medium" data-success-title>
            {successToast.title}
          </p>
          {successToast.description ? (
            <p className="text-muted-foreground text-sm">{successToast.description}</p>
          ) : null}
        </div>
        <Button
          data-toast-trigger="factory-success"
          onClick={() =>
            showToast({
              title: successToast.title,
              description: successToast.description,
            })
          }
          variant="outline"
        >
          {i18n.t('toast.factory.successToast')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactorySuccessToast: Story = {
  render: () => <FactorySuccessToastDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-success]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-success-title]')).toHaveTextContent('Success!');

    const trigger = canvasElement.querySelector('[data-toast-trigger="factory-success"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          expect(viewport?.querySelector('li[data-state="open"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

// --- Error Toast Factory ---
function FactoryErrorToastDemo() {
  const errorToast = React.useMemo(() => createFakeErrorToast(), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.errorToast.description')}
        </p>
        <div
          className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950"
          data-factory-error
        >
          <p className="text-sm font-medium" data-error-title>
            {errorToast.title}
          </p>
          {errorToast.description ? (
            <p className="text-muted-foreground text-sm">{errorToast.description}</p>
          ) : null}
          {errorToast.action ? (
            <p className="text-xs text-red-600" data-error-action>
              Action: {errorToast.action.label} (style: {errorToast.action.style})
            </p>
          ) : null}
        </div>
        <Button
          data-toast-trigger="factory-error"
          onClick={() =>
            showToast({
              title: errorToast.title,
              description: errorToast.description,
              variant: 'destructive',
              action: errorToast.action ? (
                <ToastAction altText={errorToast.action.altText} data-toast-action>
                  {errorToast.action.label}
                </ToastAction>
              ) : undefined,
            })
          }
          variant="outline"
        >
          {i18n.t('toast.factory.errorToast')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryErrorToast: Story = {
  render: () => <FactoryErrorToastDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-error]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-error-title]')).toHaveTextContent('Error');
    expect(canvasElement.querySelector('[data-error-action]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-toast-trigger="factory-error"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          expect(viewport?.querySelector('li[data-state="open"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

// --- Warning Toast Factory ---
function FactoryWarningToastDemo() {
  const warningToast = React.useMemo(() => createFakeWarningToast(), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.warningToast.description')}
        </p>
        <div
          className="rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950"
          data-factory-warning
        >
          <p className="text-sm font-medium" data-warning-title>
            {warningToast.title}
          </p>
          {warningToast.description ? (
            <p className="text-muted-foreground text-sm">{warningToast.description}</p>
          ) : null}
        </div>
        <Button
          data-toast-trigger="factory-warning"
          onClick={() =>
            showToast({
              title: warningToast.title,
              description: warningToast.description,
            })
          }
          variant="outline"
        >
          {i18n.t('toast.factory.warningToast')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryWarningToast: Story = {
  render: () => <FactoryWarningToastDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-warning]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-warning-title]')).toHaveTextContent('Warning');

    const trigger = canvasElement.querySelector('[data-toast-trigger="factory-warning"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          expect(viewport?.querySelector('li[data-state="open"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

// --- Info Toast Factory ---
function FactoryInfoToastDemo() {
  const infoToast = React.useMemo(() => createFakeInfoToast(), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.infoToast.description')}
        </p>
        <div
          className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950"
          data-factory-info
        >
          <p className="text-sm font-medium" data-info-title>
            {infoToast.title}
          </p>
          {infoToast.description ? (
            <p className="text-muted-foreground text-sm">{infoToast.description}</p>
          ) : null}
        </div>
        <Button
          data-toast-trigger="factory-info"
          onClick={() =>
            showToast({
              title: infoToast.title,
              description: infoToast.description,
            })
          }
          variant="outline"
        >
          {i18n.t('toast.factory.infoToast')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryInfoToast: Story = {
  render: () => <FactoryInfoToastDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-info]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-info-title]')).toHaveTextContent('Information');

    const trigger = canvasElement.querySelector('[data-toast-trigger="factory-info"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          expect(viewport?.querySelector('li[data-state="open"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

// --- Undo Toast Factory ---
function FactoryUndoToastDemo() {
  const undoToast = React.useMemo(() => createFakeUndoToast('Item deleted'), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.undoToast.description')}
        </p>
        <div className="rounded-md border p-4" data-factory-undo>
          <p className="text-sm font-medium" data-undo-title>
            {undoToast.title}
          </p>
          {undoToast.description ? (
            <p className="text-muted-foreground text-sm">{undoToast.description}</p>
          ) : null}
          {undoToast.action ? (
            <p className="text-xs" data-undo-action>
              Action: {undoToast.action.label} (duration: {undoToast.duration}ms)
            </p>
          ) : null}
        </div>
        <Button
          data-toast-trigger="factory-undo"
          onClick={() =>
            showToast({
              title: undoToast.title,
              description: undoToast.description,
              action: undoToast.action ? (
                <ToastAction altText={undoToast.action.altText} data-toast-action>
                  {undoToast.action.label}
                </ToastAction>
              ) : undefined,
            })
          }
          variant="outline"
        >
          {i18n.t('toast.factory.undoToast')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryUndoToast: Story = {
  render: () => <FactoryUndoToastDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-undo]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-undo-title]')).toHaveTextContent('Item deleted');
    expect(canvasElement.querySelector('[data-undo-action]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-toast-trigger="factory-undo"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          expect(viewport?.querySelector('li[data-state="open"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

// --- Persistent Toast Factory ---
function FactoryPersistentToastDemo() {
  const persistentToast = React.useMemo(() => createFakePersistentToast(), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.persistentToast.description')}
        </p>
        <div className="rounded-md border p-4" data-factory-persistent>
          <p className="text-sm font-medium" data-persistent-title>
            {persistentToast.title}
          </p>
          {persistentToast.description ? (
            <p className="text-muted-foreground text-sm">{persistentToast.description}</p>
          ) : null}
          <p className="text-muted-foreground text-xs" data-persistent-duration>
            Duration:{' '}
            {persistentToast.duration === Infinity
              ? 'Infinite (persistent)'
              : `${persistentToast.duration}ms`}
          </p>
        </div>
        <Button
          data-toast-trigger="factory-persistent"
          onClick={() =>
            showToast({
              title: persistentToast.title,
              description: persistentToast.description,
              action: persistentToast.action ? (
                <ToastAction altText={persistentToast.action.altText} data-toast-action>
                  {persistentToast.action.label}
                </ToastAction>
              ) : undefined,
            })
          }
          variant="outline"
        >
          {i18n.t('toast.factory.persistentToast')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryPersistentToast: Story = {
  render: () => <FactoryPersistentToastDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-persistent]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-persistent-duration]')).toHaveTextContent(/Infinite/);

    const trigger = canvasElement.querySelector('[data-toast-trigger="factory-persistent"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          expect(viewport?.querySelector('li[data-state="open"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

// --- Loading Toast Factory ---
function FactoryLoadingToastDemo() {
  const loadingToast = React.useMemo(() => createFakeLoadingToast(), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.loadingToast.description')}
        </p>
        <div className="rounded-md border p-4" data-factory-loading>
          <div className="flex items-center gap-2">
            <Spinner className="size-4" />
            <p className="text-sm font-medium" data-loading-title>
              {loadingToast.title}
            </p>
          </div>
          {loadingToast.description ? (
            <p className="text-muted-foreground text-sm">{loadingToast.description}</p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Icon: {loadingToast.icon ?? 'none'} | Closable: {String(loadingToast.closable)}
          </p>
        </div>
        <Button
          data-toast-trigger="factory-loading"
          onClick={() =>
            showToast({
              title: loadingToast.title,
              description: loadingToast.description,
            })
          }
          variant="outline"
        >
          {i18n.t('toast.factory.loadingToast')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryLoadingToast: Story = {
  render: () => <FactoryLoadingToastDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-loading]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-loading-title]')).toHaveTextContent('Loading...');

    const trigger = canvasElement.querySelector('[data-toast-trigger="factory-loading"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          expect(viewport?.querySelector('li[data-state="open"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

// --- Promise Toast Set Factory ---
function FactoryPromiseToastSetDemo() {
  const promiseSet: FakePromiseToastSet = React.useMemo(
    () => createFakePromiseToastSet('Uploading'),
    []
  );
  const [phase, setPhase] = React.useState<'error' | 'idle' | 'loading' | 'success'>('idle');

  const simulatePromise = React.useCallback(() => {
    setPhase('loading');
    showToast({
      title: promiseSet.loading.title,
      description: promiseSet.loading.description,
    });

    setTimeout(() => {
      setPhase('success');
      showToast({
        title: promiseSet.success.title,
        description: promiseSet.success.description,
      });
    }, 2000);
  }, [promiseSet]);

  const simulateError = React.useCallback(() => {
    setPhase('loading');
    showToast({
      title: promiseSet.loading.title,
      description: promiseSet.loading.description,
    });

    setTimeout(() => {
      setPhase('error');
      showToast({
        title: promiseSet.error.title,
        description: promiseSet.error.description,
        variant: 'destructive',
      });
    }, 2000);
  }, [promiseSet]);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.promiseToastSet.description')}
        </p>
        <div className="space-y-2 rounded-md border p-4" data-factory-promise>
          <div>
            <p className="text-xs font-medium text-gray-500">Loading:</p>
            <p className="text-sm" data-promise-loading>
              {promiseSet.loading.title}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-green-500">Success:</p>
            <p className="text-sm" data-promise-success>
              {promiseSet.success.title}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-red-500">Error:</p>
            <p className="text-sm" data-promise-error>
              {promiseSet.error.title}
            </p>
          </div>
          <p className="text-muted-foreground text-xs" data-promise-phase>
            Current phase: {phase}
          </p>
        </div>
        <div className="flex gap-2">
          <Button data-toast-trigger="promise-success" onClick={simulatePromise} variant="outline">
            Simulate Success
          </Button>
          <Button data-toast-trigger="promise-error" onClick={simulateError} variant="outline">
            Simulate Error
          </Button>
        </div>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryPromiseToastSet: Story = {
  render: () => <FactoryPromiseToastSetDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-promise]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-promise-loading]')).toHaveTextContent(/Uploading/);
    expect(canvasElement.querySelector('[data-promise-success]')).toHaveTextContent(/Complete/);
    expect(canvasElement.querySelector('[data-promise-error]')).toHaveTextContent(/Failed/);

    const trigger = canvasElement.querySelector('[data-toast-trigger="promise-success"]');
    expect(trigger).toBeInTheDocument();
  },
};

// --- Toaster Config Factory ---
function FactoryToasterConfigDemo() {
  const config: FakeToasterConfig = React.useMemo(() => createFakeToasterConfig(), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.toasterConfig.description')}
        </p>
        <div className="space-y-1 rounded-md border p-4 font-mono text-xs" data-factory-config>
          <p data-config-position>position: {config.position}</p>
          <p data-config-theme>theme: {config.theme}</p>
          <p>richColors: {String(config.richColors)}</p>
          <p>expand: {String(config.expand)}</p>
          <p>duration: {config.duration}ms</p>
          <p>gap: {config.gap}px</p>
          <p>visibleToasts: {config.visibleToasts}</p>
          <p>closeButton: {String(config.closeButton)}</p>
          <p>offset: {String(config.offset)}</p>
          <p>hotkey: [{config.hotkey.join(', ')}]</p>
          <p>pauseWhenPageIsHidden: {String(config.pauseWhenPageIsHidden)}</p>
        </div>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryToasterConfig: Story = {
  render: () => <FactoryToasterConfigDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-config]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-config-position]')).toHaveTextContent(/.+/);
    expect(canvasElement.querySelector('[data-config-theme]')).toHaveTextContent(/.+/);
  },
};

// --- Toast Queue Factory ---
function FactoryToastQueueDemo() {
  const { t } = useTranslation();
  const queue: FakeToastQueue = React.useMemo(() => createFakeToastQueue(), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">{t('toast.factory.toastQueue.description')}</p>
        <div className="space-y-2 rounded-md border p-4" data-factory-queue>
          <p className="text-xs font-medium" data-queue-meta>
            Queue: {queue.id.slice(0, 8)}... | Position: {queue.position} | Max: {queue.maxToasts}
          </p>
          {queue.toasts.map((item) => (
            <div key={item.id} className="rounded border p-2" data-queue-item>
              <p className="text-sm font-medium">{item.title}</p>
              {item.description ? (
                <p className="text-muted-foreground text-xs">{item.description}</p>
              ) : null}
            </div>
          ))}
        </div>
        <Button
          data-toast-trigger="factory-queue"
          onClick={() => {
            queue.toasts.forEach((item, index) => {
              setTimeout(() => {
                showToast({
                  title: item.title,
                  description: item.description,
                  variant: item.variant === 'destructive' ? 'destructive' : 'default',
                });
              }, index * 300);
            });
          }}
          variant="outline"
        >
          {t('toast.factory.toastQueue')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryToastQueue: Story = {
  render: () => <FactoryToastQueueDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-queue]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-queue-meta]')).toHaveTextContent(/Position:/);
    const queueItems = canvasElement.querySelectorAll('[data-queue-item]');
    expect(queueItems.length).toBeGreaterThanOrEqual(1);

    const trigger = canvasElement.querySelector('[data-toast-trigger="factory-queue"]');
    expect(trigger).toBeInTheDocument();
  },
};

// --- Accessible Toast Factory ---
function FactoryAccessibleToastDemo() {
  const accessibleToast = React.useMemo(() => createFakeAccessibleToast(), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.accessibleToast.description')}
        </p>
        <div className="rounded-md border p-4" data-factory-accessible>
          <p className="text-sm font-medium" data-accessible-title>
            {accessibleToast.title}
          </p>
          {accessibleToast.description ? (
            <p className="text-muted-foreground text-sm">{accessibleToast.description}</p>
          ) : null}
          {accessibleToast.action ? (
            <p className="text-xs" data-accessible-action>
              Action: {accessibleToast.action.label} | Alt: {accessibleToast.action.altText}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Closable: {String(accessibleToast.closable)}
          </p>
        </div>
        <Button
          data-toast-trigger="factory-accessible"
          onClick={() =>
            showToast({
              title: accessibleToast.title,
              description: accessibleToast.description,
              action: accessibleToast.action ? (
                <ToastAction altText={accessibleToast.action.altText} data-toast-action>
                  {accessibleToast.action.label}
                </ToastAction>
              ) : undefined,
            })
          }
          variant="outline"
        >
          {i18n.t('toast.factory.accessibleToast')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryAccessibleToast: Story = {
  render: () => <FactoryAccessibleToastDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-accessible]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-accessible-title]')).toHaveTextContent(
      'Accessible Notification'
    );

    const trigger = canvasElement.querySelector('[data-toast-trigger="factory-accessible"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          const toast = viewport?.querySelector('li[data-state="open"]');
          expect(toast).toBeInTheDocument();
          // Verify action button is accessible
          const action = toast?.querySelector('[data-toast-action]');
          expect(action).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

// --- Form Validation Toast Factory ---
function FactoryFormValidationDemo() {
  const singleError = React.useMemo(
    () =>
      createFakeFormValidationToast([i18n.t('toast.story.emailIsRequired', 'Email is required')]),
    []
  );
  const multipleErrors = React.useMemo(
    () =>
      createFakeFormValidationToast([
        i18n.t('toast.story.emailIsRequired', 'Email is required'),
        i18n.t('toast.story.passwordTooShort', 'Password too short'),
        i18n.t('toast.story.nameIsEmpty', 'Name is empty'),
      ]),
    []
  );

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.formValidation.description')}
        </p>
        <div className="space-y-2" data-factory-form-validation>
          <div className="rounded-md border border-red-200 p-3">
            <p className="text-sm font-medium" data-validation-single>
              Single: {singleError.description}
            </p>
          </div>
          <div className="rounded-md border border-red-200 p-3">
            <p className="text-sm font-medium" data-validation-multiple>
              Multiple: {multipleErrors.description}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            data-toast-trigger="validation-single"
            onClick={() =>
              showToast({
                title: singleError.title,
                description: singleError.description,
                variant: 'destructive',
              })
            }
            variant="outline"
          >
            Single Error
          </Button>
          <Button
            data-toast-trigger="validation-multiple"
            onClick={() =>
              showToast({
                title: multipleErrors.title,
                description: multipleErrors.description,
                variant: 'destructive',
              })
            }
            variant="outline"
          >
            Multiple Errors
          </Button>
        </div>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryFormValidation: Story = {
  render: () => <FactoryFormValidationDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-form-validation]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-validation-single]')).toHaveTextContent(
      i18n.t('toast.story.emailIsRequired', 'Email is required')
    );
    expect(canvasElement.querySelector('[data-validation-multiple]')).toHaveTextContent(
      '3 fields have errors'
    );

    const trigger = canvasElement.querySelector('[data-toast-trigger="validation-single"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          expect(viewport?.querySelector('li[data-state="open"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

// --- Network Status Toast Factory ---
function FactoryNetworkStatusDemo() {
  const onlineToast = React.useMemo(() => createFakeNetworkStatusToast(true), []);
  const offlineToast = React.useMemo(() => createFakeNetworkStatusToast(false), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.networkStatus.description')}
        </p>
        <div className="space-y-2" data-factory-network>
          <div className="rounded-md border border-green-200 p-3">
            <p className="text-sm font-medium" data-network-online>
              Online: {onlineToast.title} - {onlineToast.description}
            </p>
          </div>
          <div className="rounded-md border border-red-200 p-3">
            <p className="text-sm font-medium" data-network-offline>
              Offline: {offlineToast.title} - {offlineToast.description}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            data-toast-trigger="network-online"
            onClick={() =>
              showToast({
                title: onlineToast.title,
                description: onlineToast.description,
              })
            }
            variant="outline"
          >
            Go Online
          </Button>
          <Button
            data-toast-trigger="network-offline"
            onClick={() =>
              showToast({
                title: offlineToast.title,
                description: offlineToast.description,
                variant: 'destructive',
              })
            }
            variant="outline"
          >
            Go Offline
          </Button>
        </div>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryNetworkStatus: Story = {
  render: () => <FactoryNetworkStatusDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-network]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-network-online]')).toHaveTextContent('Back Online');
    expect(canvasElement.querySelector('[data-network-offline]')).toHaveTextContent(
      'Connection Lost'
    );

    const onlineTrigger = canvasElement.querySelector('[data-toast-trigger="network-online"]');
    expect(onlineTrigger).toBeInTheDocument();
    const offlineTrigger = canvasElement.querySelector('[data-toast-trigger="network-offline"]');
    expect(offlineTrigger).toBeInTheDocument();
  },
};

// --- File Operation Toast Factory ---
function FactoryFileOperationDemo() {
  const uploadSuccess = React.useMemo(
    () => createFakeFileOperationToast('upload', true, 'report.pdf'),
    []
  );
  const downloadFail = React.useMemo(
    () => createFakeFileOperationToast('download', false, 'data.csv'),
    []
  );
  const deleteSuccess = React.useMemo(
    () => createFakeFileOperationToast('delete', true, 'old-backup.zip'),
    []
  );

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.fileOperation.description')}
        </p>
        <div className="space-y-2" data-factory-file-operation>
          <div className="rounded-md border p-3">
            <p className="text-sm" data-file-upload>
              {uploadSuccess.title}: {uploadSuccess.description}
            </p>
          </div>
          <div className="rounded-md border border-red-200 p-3">
            <p className="text-sm" data-file-download>
              {downloadFail.title}: {downloadFail.description}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-sm" data-file-delete>
              {deleteSuccess.title}: {deleteSuccess.description}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            data-toast-trigger="file-upload"
            onClick={() =>
              showToast({
                title: uploadSuccess.title,
                description: uploadSuccess.description,
              })
            }
            variant="outline"
          >
            Upload
          </Button>
          <Button
            data-toast-trigger="file-download"
            onClick={() =>
              showToast({
                title: downloadFail.title,
                description: downloadFail.description,
                variant: 'destructive',
              })
            }
            variant="outline"
          >
            Download (fail)
          </Button>
          <Button
            data-toast-trigger="file-delete"
            onClick={() =>
              showToast({
                title: deleteSuccess.title,
                description: deleteSuccess.description,
              })
            }
            variant="outline"
          >
            Delete
          </Button>
        </div>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryFileOperation: Story = {
  render: () => <FactoryFileOperationDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-file-operation]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-file-upload]')).toHaveTextContent('report.pdf');
    expect(canvasElement.querySelector('[data-file-download]')).toHaveTextContent('data.csv');
    expect(canvasElement.querySelector('[data-file-delete]')).toHaveTextContent('old-backup.zip');

    const uploadTrigger = canvasElement.querySelector('[data-toast-trigger="file-upload"]');
    if (uploadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(uploadTrigger);
      await waitFor(
        () => {
          const viewport = canvasElement.querySelector('[data-toast-viewport]');
          expect(viewport?.querySelector('li[data-state="open"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

// --- Stacked Toasts Factory ---
function getVariantColor(variant: ToastVariant): string {
  const colorMap: Record<ToastVariant, string> = {
    success: '#22c55e',
    destructive: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    default: '#6b7280',
  };
  return colorMap[variant];
}

function FactoryStackedToastsDemo() {
  const stackedToasts = React.useMemo(() => createFakeStackedToasts(), []);

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.stackedToasts.description')}
        </p>
        <div className="space-y-2" data-factory-stacked>
          {stackedToasts.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-md border p-2">
              <span
                className="inline-block size-2 rounded-full"
                data-stacked-variant={item.variant}
                style={{
                  backgroundColor: getVariantColor(item.variant),
                }}
              />
              <span className="text-sm">{item.title}</span>
              {item.description ? (
                <span className="text-muted-foreground text-xs">- {item.description}</span>
              ) : null}
            </div>
          ))}
        </div>
        <Button
          data-toast-trigger="factory-stacked"
          onClick={() => {
            stackedToasts.forEach((item, index) => {
              setTimeout(() => {
                showToast({
                  title: item.title,
                  description: item.description,
                  variant: item.variant === 'destructive' ? 'destructive' : 'default',
                });
              }, index * 400);
            });
          }}
          variant="outline"
        >
          {i18n.t('toast.factory.stackedToasts')}
        </Button>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryStackedToasts: Story = {
  render: () => <FactoryStackedToastsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-stacked]')).toBeInTheDocument();
    const stackedItems = canvasElement.querySelectorAll('[data-stacked-variant]');
    expect(stackedItems.length).toBe(4);

    const trigger = canvasElement.querySelector('[data-toast-trigger="factory-stacked"]');
    expect(trigger).toBeInTheDocument();
  },
};

// --- Constants Reference Factory ---
function FactoryConstantsReferenceDemo() {
  // Use all constant arrays to demonstrate their values
  const variantsList: ToastVariant[] = TOAST_VARIANTS;
  const positionsList: ToastPosition[] = TOAST_POSITIONS;
  const durationsList = TOAST_DURATIONS;
  const iconsList = TOAST_ICONS;
  const titlesList = TOAST_TITLES;
  const descriptionsList = TOAST_DESCRIPTIONS;
  const actionLabelsList = TOAST_ACTION_LABELS;

  // Use the ToastActionStyle type to annotate styles
  const actionStyles: ToastActionStyle[] = ['default', 'destructive', 'outline'];

  // Use the FactoryToastAction interface for a sample action shape
  const sampleAction: FactoryToastAction = {
    label: 'Sample',
    altText: 'Sample action for display',
    style: 'default',
  };

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {i18n.t('toast.factory.constants.description')}
        </p>
        <div className="space-y-3 rounded-md border p-4 font-mono text-xs" data-factory-constants>
          <div>
            <p className="mb-1 font-sans text-sm font-medium">
              TOAST_VARIANTS ({variantsList.length})
            </p>
            <p data-const-variants>{variantsList.join(', ')}</p>
          </div>
          <div>
            <p className="mb-1 font-sans text-sm font-medium">
              TOAST_POSITIONS ({positionsList.length})
            </p>
            <p data-const-positions>{positionsList.join(', ')}</p>
          </div>
          <div>
            <p className="mb-1 font-sans text-sm font-medium">
              TOAST_DURATIONS ({durationsList.length})
            </p>
            <p data-const-durations>
              {durationsList.map((d) => (d === Infinity ? 'Infinity' : `${d}ms`)).join(', ')}
            </p>
          </div>
          <div>
            <p className="mb-1 font-sans text-sm font-medium">TOAST_ICONS</p>
            <div data-const-icons>
              {Object.entries(iconsList).map(([variant, icon]) => (
                <p key={variant}>
                  {variant}: {icon}
                </p>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 font-sans text-sm font-medium">TOAST_TITLES</p>
            <div data-const-titles>
              {Object.entries(titlesList).map(([variant, titles]) => (
                <p key={variant}>
                  {variant}: {titles.join(' | ')}
                </p>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 font-sans text-sm font-medium">TOAST_DESCRIPTIONS</p>
            <div data-const-descriptions>
              {Object.entries(descriptionsList).map(([variant, descs]) => (
                <p key={variant}>
                  {variant}: {descs.length} descriptions
                </p>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 font-sans text-sm font-medium">
              TOAST_ACTION_LABELS ({actionLabelsList.length})
            </p>
            <p data-const-action-labels>{actionLabelsList.join(', ')}</p>
          </div>
          <div>
            <p className="mb-1 font-sans text-sm font-medium">
              {i18n.t('toast.story.toastactionstyleTypes', 'ToastActionStyle types')}
            </p>
            <p data-const-action-styles>{actionStyles.join(', ')}</p>
          </div>
          <div>
            <p className="mb-1 font-sans text-sm font-medium">
              {i18n.t('toast.story.factorytoastactionSample', 'FactoryToastAction (sample)')}
            </p>
            <p data-const-sample-action>
              label: {sampleAction.label} | altText: {sampleAction.altText} | style:{' '}
              {sampleAction.style ?? 'none'}
            </p>
          </div>
        </div>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryConstantsReference: Story = {
  render: () => <FactoryConstantsReferenceDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-constants]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-const-variants]')).toHaveTextContent('default');
    expect(canvasElement.querySelector('[data-const-positions]')).toHaveTextContent('top-left');
    expect(canvasElement.querySelector('[data-const-durations]')).toHaveTextContent('3000ms');
    expect(canvasElement.querySelector('[data-const-icons]')).toHaveTextContent('Bell');
    expect(canvasElement.querySelector('[data-const-titles]')).toHaveTextContent('Notification');
    expect(canvasElement.querySelector('[data-const-descriptions]')).toHaveTextContent('default');
    expect(canvasElement.querySelector('[data-const-action-labels]')).toHaveTextContent('Undo');
    expect(canvasElement.querySelector('[data-const-action-styles]')).toHaveTextContent(
      'default, destructive, outline'
    );
  },
};

// --- Type Annotations Usage (ToastVariant, ToastPosition in iteration) ---
function FactoryTypeAnnotationsDemo() {
  const { t } = useTranslation();

  // Explicitly use the type imports in typed iteration
  const renderVariant = (variant: ToastVariant) => {
    const toast = createFakeToast({ variant });
    return (
      <div key={toast.id} className="rounded-md border p-2">
        <span className="text-xs font-medium" data-typed-variant>
          {variant}
        </span>
        : {toast.title}
      </div>
    );
  };

  const renderPosition = (position: ToastPosition) => {
    const config = createFakeToasterConfig({ position });
    return (
      <div key={position} className="rounded-md border p-2">
        <span className="text-xs font-medium" data-typed-position>
          {position}
        </span>
        (theme: {config.theme})
      </div>
    );
  };

  return (
    <ToastProvider>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Factory types used as explicit type annotations in iteration.
        </p>
        <div className="space-y-1" data-factory-typed-variants>
          <p className="text-sm font-medium">{t('toast.factory.variantMatrix')}</p>
          {TOAST_VARIANTS.map(renderVariant)}
        </div>
        <div className="space-y-1" data-factory-typed-positions>
          <p className="text-sm font-medium">{t('toast.factory.positionMatrix')}</p>
          {TOAST_POSITIONS.map(renderPosition)}
        </div>
      </div>
      <ToastRenderer />
    </ToastProvider>
  );
}

export const FactoryTypeAnnotations: Story = {
  render: () => <FactoryTypeAnnotationsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-factory-typed-variants]')).toBeInTheDocument();
    const typedVariants = canvasElement.querySelectorAll('[data-typed-variant]');
    expect(typedVariants.length).toBe(TOAST_VARIANTS.length);

    expect(canvasElement.querySelector('[data-factory-typed-positions]')).toBeInTheDocument();
    const typedPositions = canvasElement.querySelectorAll('[data-typed-position]');
    expect(typedPositions.length).toBe(TOAST_POSITIONS.length);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('toast.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('toast.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('toast.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('toast.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   conflict
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('toast.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: toastStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('toast.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: toastStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
