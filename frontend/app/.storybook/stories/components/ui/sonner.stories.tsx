import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import {
  STORY_NO_DOM_ERROR,
  STORY_SONNER_TOASTER_NOT_FOUND,
} from '@/.storybook/stories/_utils/story-helpers';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

import {
  sonnerHandlers,
  sonnerStatusHandlers,
} from '@/.storybook/stories/_handlers/sonner.handlers';
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_TARGETS,
  createFakeActivities,
  createFakeActivity,
  createFakeActivityFeed,
  createFakeAllUnreadNotificationsResponse,
  createFakeBillingNotification,
  createFakeEmptyNotificationsResponse,
  createFakeEnterpriseNotificationSet,
  createFakeErrorNotification,
  createFakeInfoNotification,
  createFakeMessageNotification,
  createFakeErrorToast as createFakeNotifErrorToast,
  createFakeNotification,
  createFakeNotificationChannelStatusMatrix,
  createFakeNotificationGroup,
  createFakeNotificationGroups,
  createFakeNotificationPreferences,
  createFakeNotifications,
  createFakeNotificationShowcase,
  createFakeNotificationsResponse,
  createFakeNotificationsWithAllCategories,
  createFakeNotificationsWithAllPriorities,
  createFakeNotificationsWithAllTypes,
  createFakeNotificationTypeCategoryMatrix,
  createFakeNotificationTypePriorityMatrix,
  createFakeSuccessToast as createFakeNotifSuccessToast,
  createFakeToast as createFakeNotifToast,
  createFakeToasts as createFakeNotifToasts,
  createFakeToastsWithAllTypes as createFakeNotifToastsWithAllTypes,
  createFakeReadNotification,
  createFakeSecurityNotification,
  createFakeSuccessNotification,
  createFakeUnreadNotification,
  createFakeWarningNotification,
  TOAST_POSITIONS as NOTIF_TOAST_POSITIONS,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TITLES,
  NOTIFICATION_TYPES,
} from '@/.storybook/stories/_factories/notification.factory';
import type {
  FakeActivity,
  FakeActivityFeed,
  FakeNotification,
  FakeNotificationGroup,
  FakeNotificationPreferences,
  FakeNotificationsResponse,
  FakeToast as FakeNotifToast,
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from '@/.storybook/stories/_factories/notification.factory';
import type {
  FakeToast,
  FakeToastAction,
  FakeToasterConfig,
  FakeToastGroup,
  FakeToastPromise,
  FakeToastQueueItem,
  FakeToastSequence,
  ToastCategory,
  ToastPosition,
  ToastPriority,
  ToastTheme,
  ToastType,
} from '@/.storybook/stories/_factories/sonner.factory';
import {
  ACTION_LABELS,
  CANCEL_LABELS,
  CATEGORY_MESSAGES,
  createFakeAuthToast,
  createFakeCategoryToast,
  createFakeDefaultToast,
  createFakeErrorPromiseToast,
  createFakeErrorToast,
  createFakeFileToast,
  createFakeFormToast,
  createFakeInfoToast,
  createFakeLoadingToast,
  createFakeNetworkToast,
  createFakePaymentToast,
  createFakeRetryToast,
  createFakeSuccessPromiseToast,
  createFakeSuccessToast,
  createFakeToast,
  createFakeToasterConfig,
  createFakeToastGroup,
  createFakeToastGroupsByCategory,
  createFakeToastPromise,
  createFakeToastQueue,
  createFakeToasts,
  createFakeToastSequence,
  createFakeToastWithAction,
  createFakeUndoToast,
  createFakeWarningToast,
  createToastCategoryMatrix,
  createToastPositionMatrix,
  createToastPriorityMatrix,
  createToastShowcase,
  createToastTestData,
  createToastTypeMatrix,
  TOAST_CATEGORIES,
  TOAST_DESCRIPTIONS,
  TOAST_DURATIONS,
  TOAST_POSITIONS,
  TOAST_PRIORITIES,
  TOAST_THEMES,
  TOAST_TITLES,
  TOAST_TYPES,
} from '@/.storybook/stories/_factories/sonner.factory';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function SonnerDemo() {
  return (
    <div className="space-y-4" data-testid="sonner-demo">
      <Toaster position="top-center" richColors />
      <div className="flex flex-wrap gap-2">
        <Button
          data-sonner-trigger="default"
          onClick={() => toast('Saved', { description: 'Your changes have been saved.' })}
          variant="outline"
        >
          Default
        </Button>
        <Button
          data-sonner-trigger="success"
          onClick={() =>
            toast.success('Success', { description: 'Everything completed successfully.' })
          }
          variant="outline"
        >
          Success
        </Button>
        <Button
          data-sonner-trigger="error"
          onClick={() =>
            toast.error('Error', { description: 'Something went wrong. Please try again.' })
          }
          variant="outline"
        >
          Error
        </Button>
      </div>
    </div>
  );
}

function I18nSonnerDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4" data-testid="i18n-sonner-demo">
      <Toaster position="top-center" richColors />
      <div className="flex flex-wrap gap-2">
        <Button
          data-sonner-trigger="default"
          onClick={() =>
            toast(t('sonner.toast.saved.title'), {
              description: t('sonner.toast.saved.description'),
            })
          }
          variant="outline"
        >
          {t('sonner.trigger.default')}
        </Button>
        <Button
          data-sonner-trigger="success"
          onClick={() =>
            toast.success(t('sonner.toast.success.title'), {
              description: t('sonner.toast.success.description'),
            })
          }
          variant="outline"
        >
          {t('sonner.trigger.success')}
        </Button>
        <Button
          data-sonner-trigger="error"
          onClick={() =>
            toast.error(t('sonner.toast.error.title'), {
              description: t('sonner.toast.error.description'),
            })
          }
          variant="outline"
        >
          {t('sonner.trigger.error')}
        </Button>
      </div>
    </div>
  );
}

// ============ MSW + FAKER INTEGRATION ============

// Demo: Sonner toasts triggered by API responses
function SonnerWithApiDemo() {
  const [loading, setLoading] = React.useState(false);

  const handleMarkAsRead = React.useCallback(async () => {
    setLoading(true);
    const toastId = toast.loading('Marking as read...');

    try {
      const response = await fetch('/api/notifications/1/read', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        toast.error('Failed', {
          id: toastId,
          description: errorData.message || 'Could not mark notification as read',
        });
        return;
      }

      toast.success('Done!', {
        id: toastId,
        description: 'Notification marked as read',
      });
    } catch {
      toast.error('Network Error', {
        id: toastId,
        description: 'Unable to connect to server',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMarkAllRead = React.useCallback(async () => {
    setLoading(true);
    const toastId = toast.loading('Marking all as read...');

    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        toast.error('Failed', {
          id: toastId,
          description: errorData.message || 'Could not mark all as read',
        });
        return;
      }

      const data = (await response.json()) as { count?: number };
      toast.success('All Caught Up!', {
        id: toastId,
        description: `${data.count ?? 0} notifications cleared`,
      });
    } catch {
      toast.error('Network Error', {
        id: toastId,
        description: 'Unable to connect to server',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = React.useCallback(async () => {
    setLoading(true);
    const toastId = toast.loading('Deleting...');

    try {
      const response = await fetch('/api/notifications/1', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        toast.error('Delete Failed', {
          id: toastId,
          description: errorData.message || 'Could not delete notification',
        });
        return;
      }

      toast.success('Deleted', {
        id: toastId,
        description: 'Notification removed',
      });
    } catch {
      toast.error('Network Error', {
        id: toastId,
        description: 'Unable to connect to server',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div
      className="space-y-4"
      data-testid="sonner-with-api-demo"
      data-state={loading ? 'loading' : 'idle'}
    >
      <Toaster position="top-center" richColors />
      <p className="text-muted-foreground text-sm">
        Click buttons to trigger API calls with Sonner toast feedback:
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          data-sonner-trigger="mark-read"
          onClick={handleMarkAsRead}
          disabled={loading}
          variant="outline"
        >
          {loading ? <Spinner className="mr-2 size-4" /> : null}
          Mark as Read
        </Button>
        <Button
          data-sonner-trigger="mark-all-read"
          onClick={handleMarkAllRead}
          disabled={loading}
          variant="outline"
        >
          {loading ? <Spinner className="mr-2 size-4" /> : null}
          Mark All Read
        </Button>
        <Button
          data-sonner-trigger="delete"
          onClick={handleDelete}
          disabled={loading}
          variant="outline"
        >
          {loading ? <Spinner className="mr-2 size-4" /> : null}
          Delete
        </Button>
      </div>
    </div>
  );
}

// Demo: Sonner toasts with Faker-generated content
function SonnerWithFakerDemo() {
  const { t } = useTranslation();

  const showFakeNotification = React.useCallback(() => {
    const notification = createFakeNotification();
    let toastFn: typeof toast.info;
    switch (notification.type) {
      case 'error': {
        toastFn = toast.error;
        break;
      }
      case 'warning': {
        toastFn = toast.warning;
        break;
      }
      case 'success': {
        toastFn = toast.success;
        break;
      }
      default: {
        toastFn = toast.info;
      }
    }

    toastFn(notification.title, {
      description: notification.description,
    });
  }, []);

  const showAllTypes = React.useCallback(() => {
    const types = [
      { fn: toast.info, label: 'Info' },
      { fn: toast.success, label: 'Success' },
      { fn: toast.warning, label: 'Warning' },
      { fn: toast.error, label: 'Error' },
    ];

    types.forEach(({ fn, label }, index) => {
      setTimeout(() => {
        const notification = createFakeNotification();
        fn(`${label}: ${notification.title}`, {
          description: notification.description,
        });
      }, index * 400);
    });
  }, []);

  const showPromiseToast = React.useCallback(() => {
    const fakePromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve({ message: 'Data loaded successfully!' });
      }, 1500);
    });

    toast.promise(fakePromise, {
      loading: 'Loading data...',
      success: 'Data loaded!',
      error: 'Failed to load data',
    });
  }, []);

  return (
    <div className="space-y-4" data-testid="sonner-with-faker-demo">
      <Toaster position="top-center" richColors />
      <p className="text-muted-foreground text-sm">
        {t(
          'sonner.story.sonnerToastsWithFakergeneratedContent',
          'Sonner toasts with Faker-generated content:'
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button data-sonner-trigger="faker-single" onClick={showFakeNotification} variant="outline">
          Random Notification
        </Button>
        <Button data-sonner-trigger="faker-all-types" onClick={showAllTypes} variant="outline">
          Show All Types
        </Button>
        <Button data-sonner-trigger="faker-promise" onClick={showPromiseToast} variant="outline">
          Promise Toast
        </Button>
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Sonner',
  component: SonnerDemo,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onDismiss: fn(),
    onAutoClose: fn(),
  },
  parameters: {
    msw: {
      handlers: sonnerHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('sonner.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('sonner.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('sonner.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('sonner.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('sonner.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('sonner.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('sonner.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onDismiss: {
      action: 'onDismiss',
      description: i18n.t(
        'sonner.argType.calledWhenToastIsDismissed',
        'Called when toast is dismissed'
      ),
      table: { category: 'Events' },
    },
    onAutoClose: {
      action: 'onAutoClose',
      description: i18n.t(
        'sonner.argType.calledWhenToastAutocloses',
        'Called when toast auto-closes'
      ),
      table: { category: 'Events' },
    },
    // Sonner Toast System (sonner library):
    //
    // toast() Function:
    // - toast(message, options): Default toast
    // - toast.success(message, options): Success toast
    // - toast.error(message, options): Error toast
    // - toast.warning(message, options): Warning toast
    // - toast.info(message, options): Info toast
    // - toast.loading(message, options): Loading toast
    // - toast.promise(promise, options): Promise-based toast
    // - toast.custom(component, options): Custom component toast
    // - toast.dismiss(id): Dismiss specific toast
    //
    // Toast Options:
    // - description: Toast description (string)
    // - duration: Auto-dismiss duration in ms (number, default: 4000)
    // - id: Unique toast ID (string | number)
    // - icon: Custom icon (ReactNode)
    // - action: Action button config ({ label: string, onClick: () => void })
    // - cancel: Cancel button config ({ label: string, onClick: () => void })
    // - onDismiss: Called when dismissed ((toast) => void)
    // - onAutoClose: Called when auto-closed ((toast) => void)
    // - dismissible: Can be dismissed by user (boolean, default: true)
    // - important: Mark as important (boolean)
    // - position: Override global position (Position)
    //
    // Toaster Props Reference:
    // - position: Toast position ('top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right')
    // - richColors: Enable semantic colors for types (boolean)
    // - expand: Expand toasts by default (boolean)
    // - duration: Default duration in ms (number, default: 4000)
    // - visibleToasts: Max visible toasts (number, default: 3)
    // - closeButton: Show close button (boolean)
    // - offset: Distance from edge in px (string | number)
    // - dir: Text direction ('ltr' | 'rtl' | 'auto')
    // - hotkey: Keyboard shortcut to focus (string[], default: ['altKey', 'KeyT'])
    // - invert: Invert colors (boolean)
    // - toastOptions: Default options for all toasts (ToastOptions)
    // - gap: Gap between toasts in px (number)
    // - loadingIcon: Custom loading icon (ReactNode)
    // - pauseWhenPageIsHidden: Pause on page hidden (boolean)
    // - cn: Custom class name function ((classNames) => string)
  },
} satisfies Meta<typeof SonnerDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Toasts: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sonner"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-sonner-trigger]');
    expect(triggers.length).toBe(3);
  },
};

export const Playground: Story = {
  ...Toasts,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sonner"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-sonner-trigger]');
    expect(triggers.length).toBe(3);
  },
};

function VariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <Toaster position="top-center" richColors />

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('sonner.variants.success')}</p>
        <Button
          onClick={() =>
            toast.success('Success', { description: 'Your action was completed successfully.' })
          }
          variant="outline"
        >
          Show Success Toast
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('sonner.variants.error')}</p>
        <Button
          onClick={() =>
            toast.error('Error', { description: 'Something went wrong. Please try again.' })
          }
          variant="outline"
        >
          Show Error Toast
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('sonner.variants.warning')}</p>
        <Button
          onClick={() =>
            toast.warning('Warning', {
              description: 'Please review your settings before continuing.',
            })
          }
          variant="outline"
        >
          Show Warning Toast
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('sonner.variants.info')}</p>
        <Button
          onClick={() =>
            toast.info('Info', { description: 'Here is some helpful information for you.' })
          }
          variant="outline"
        >
          Show Info Toast
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('sonner.variants.withAction')}</p>
        <Button
          onClick={() =>
            toast('Event Created', {
              description: 'Your event has been scheduled.',
              action: {
                label: 'Undo',
                onClick: () => {},
              },
            })
          }
          variant="outline"
        >
          Show Toast with Action
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('sonner.variants.descriptionOnly')}</p>
        <Button
          onClick={() => toast('File uploaded successfully to your cloud storage.')}
          variant="outline"
        >
          Show Simple Toast
        </Button>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('[data-slot="button"]');
    expect(buttons.length).toBe(6);
  },
};

function SizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <Toaster position="top-center" richColors />

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('sonner.sizes.compact')}</p>
        <Button onClick={() => toast.success('Saved!')} variant="outline">
          Show Compact Toast
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('sonner.sizes.default')}</p>
        <Button
          onClick={() =>
            toast.success('Changes Saved', {
              description: 'Your changes have been saved successfully.',
            })
          }
          variant="outline"
        >
          Show Default Toast
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('sonner.sizes.rich')}</p>
        <Button
          onClick={() =>
            toast.success('File Uploaded', {
              description: 'Your file "document.pdf" has been uploaded to the cloud storage.',
              action: {
                label: 'View File',
                onClick: () => {},
              },
              cancel: {
                label: 'Dismiss',
                onClick: () => {},
              },
            })
          }
          variant="outline"
        >
          Show Rich Toast
        </Button>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('[data-slot="button"]');
    expect(buttons.length).toBe(3);
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="sonner"]')).toBeInTheDocument();

    const getTrigger = (value: 'default' | 'success' | 'error') => {
      const trigger = canvasElement.querySelector(`[data-sonner-trigger="${value}"]`);
      if (!(trigger instanceof HTMLButtonElement)) {
        throw new Error(
          i18n.t('test.sonnerTriggerNotFound', 'Sonner trigger "{{value}}" was not found.', {
            value,
          })
        );
      }
      return trigger;
    };

    await userEvent.click(getTrigger('default'));

    await waitFor(() => {
      const toaster = canvasElement.querySelector('[data-sonner-toaster]');
      expect(toaster).toBeInTheDocument();

      if (!(toaster instanceof HTMLElement)) return;

      expect(toaster.getAttribute('data-y-position')).toBe('top');
      expect(toaster.getAttribute('data-x-position')).toBe('center');
    });

    const toaster = canvasElement.querySelector('[data-sonner-toaster]');

    if (!(toaster instanceof HTMLElement)) {
      throw new Error(STORY_SONNER_TOASTER_NOT_FOUND);
    }

    const findToastByType = (type: string) => {
      const toastElement = [...toaster.querySelectorAll('[data-sonner-toast]')].find(
        (element) => element instanceof HTMLElement && element.getAttribute('data-type') === type
      );

      return toastElement instanceof HTMLElement ? toastElement : null;
    };

    await waitFor(() => {
      expect(findToastByType('default')).toBeInTheDocument();
    });

    const defaultToast = findToastByType('default');
    if (!(defaultToast instanceof HTMLElement)) {
      throw new Error(i18n.t('test.defaultToastWasNotFound', 'Default toast was not found.'));
    }

    await waitFor(() => {
      const titleEl = defaultToast.querySelector('[data-title]');
      const descEl = defaultToast.querySelector('[data-description]');
      expect(titleEl).toBeInTheDocument();
      expect(descEl).toBeInTheDocument();
      expect(titleEl?.textContent?.trim()).not.toBe('');
      expect(descEl?.textContent?.trim()).not.toBe('');
    });

    await userEvent.click(getTrigger('success'));

    await waitFor(() => {
      expect(findToastByType('success')).toBeInTheDocument();
    });

    const successToast = findToastByType('success');
    if (!(successToast instanceof HTMLElement)) {
      throw new Error(i18n.t('test.successToastWasNotFound', 'Success toast was not found.'));
    }

    await waitFor(() => {
      const titleEl = successToast.querySelector('[data-title]');
      const descEl = successToast.querySelector('[data-description]');
      expect(titleEl).toBeInTheDocument();
      expect(descEl).toBeInTheDocument();
      expect(titleEl?.textContent?.trim()).not.toBe('');
      expect(descEl?.textContent?.trim()).not.toBe('');
    });

    await userEvent.click(getTrigger('error'));

    await waitFor(() => {
      expect(findToastByType('error')).toBeInTheDocument();
    });

    const errorToast = findToastByType('error');
    if (!(errorToast instanceof HTMLElement)) {
      throw new Error(i18n.t('test.errorToastWasNotFound', 'Error toast was not found.'));
    }

    await waitFor(() => {
      const titleEl = errorToast.querySelector('[data-title]');
      const descEl = errorToast.querySelector('[data-description]');
      expect(titleEl).toBeInTheDocument();
      expect(descEl).toBeInTheDocument();
      expect(titleEl?.textContent?.trim()).not.toBe('');
      expect(descEl?.textContent?.trim()).not.toBe('');
    });
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sonner"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-sonner-trigger]');
    expect(triggers.length).toBe(3);
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sonner"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-sonner-trigger]');
    expect(triggers.length).toBe(3);
  },
};

export const Japanese: Story = {
  globals: {
    locale: 'ja',
  },
  render: () => <I18nSonnerDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    await Default.play?.(context);

    const toaster = context.canvasElement.querySelector('[data-sonner-toaster]');
    if (!(toaster instanceof HTMLElement)) {
      throw new Error(STORY_SONNER_TOASTER_NOT_FOUND);
    }

    const titles = [...toaster.querySelectorAll('[data-title]')].map(
      (node) => node.textContent ?? ''
    );

    expect(titles.join(' ')).toContain('保存');
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
  name: i18n.t('sonner.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
  render: () => {
    const fakeToasts = createFakeToasts(5);

    return (
      <div className="space-y-4" data-testid="faker-sonner">
        <Toaster position="top-center" richColors />
        <p className="text-muted-foreground text-sm">
          Sonner toasts with factory-generated content:
        </p>
        <div className="flex flex-wrap gap-2">
          {fakeToasts.map((t) => (
            <Button
              key={t.id}
              data-sonner-trigger={`faker-${t.type}`}
              onClick={() => {
                const toastFnMap: Record<string, typeof toast.info> = {
                  error: toast.error,
                  info: toast.info,
                  success: toast.success,
                  warning: toast.warning,
                };
                const toastFn = toastFnMap[t.type] ?? toast.info;
                toastFn(t.title, { description: t.description });
              }}
              variant="outline"
            >
              {t.type}: {t.title}
            </Button>
          ))}
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="faker-sonner"]');
    expect(container).toBeInTheDocument();

    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(5);
  },
};

export const WithApiResponse: Story = {
  parameters: {
    msw: {
      handlers: sonnerHandlers,
    },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    expect(markReadTrigger).toBeInTheDocument();

    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const successToast = toaster?.querySelector('[data-type="success"]');
          expect(successToast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error401Unauthorized: Story = {
  parameters: {
    msw: {
      handlers: sonnerStatusHandlers.unauthorized,
    },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const errorToast = toaster?.querySelector('[data-type="error"]');
          expect(errorToast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error404NotFound: Story = {
  parameters: {
    msw: {
      handlers: sonnerStatusHandlers.notFound,
    },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const errorToast = toaster?.querySelector('[data-type="error"]');
          expect(errorToast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: sonnerStatusHandlers.unprocessableEntity },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const errorToast = toaster?.querySelector('[data-type="error"]');
          expect(errorToast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error500InternalServerError: Story = {
  parameters: {
    msw: {
      handlers: sonnerStatusHandlers.internalServerError,
    },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const errorToast = toaster?.querySelector('[data-type="error"]');
          expect(errorToast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const NetworkError: Story = {
  parameters: {
    msw: {
      handlers: sonnerStatusHandlers.networkError,
    },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const errorToast = toaster?.querySelector('[data-type="error"]');
          expect(errorToast?.textContent).toContain('Network Error');
        },
        { timeout: 3000 }
      );
    }
  },
};

export const PromiseToast: Story = {
  render: () => <SonnerWithFakerDemo />,
  play: async ({ canvasElement }) => {
    const promiseTrigger = canvasElement.querySelector('[data-sonner-trigger="faker-promise"]');
    if (promiseTrigger instanceof HTMLButtonElement) {
      await userEvent.click(promiseTrigger);

      // First shows loading
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        const loadingToast = toaster?.querySelector('[data-type="loading"]');
        expect(loadingToast).toBeInTheDocument();
      });

      // Then shows success
      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const successToast = toaster?.querySelector('[data-type="success"]');
          expect(successToast).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    }
  },
};

export const SlowResponse: Story = {
  parameters: {
    msw: {
      handlers: sonnerStatusHandlers.slowResponse,
    },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      // Check loading state appears
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        const loadingToast = toaster?.querySelector('[data-type="loading"]');
        expect(loadingToast).toBeInTheDocument();
      });

      // Eventually completes
      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const successToast = toaster?.querySelector('[data-type="success"]');
          expect(successToast).toBeInTheDocument();
        },
        { timeout: 7000 }
      );
    }
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sonnerHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sonner"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-sonner-trigger]');
    expect(triggers.length).toBe(3);
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sonnerStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sonner"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-sonner-trigger]');
    expect(triggers.length).toBe(3);
  },
};

export const Accessibility: Story = {
  name: i18n.t('sonner.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Verify Toaster component is present
    expect(canvasElement.querySelector('[data-slot="sonner"]')).toBeInTheDocument();

    // Trigger a toast
    const trigger = canvasElement.querySelector('[data-sonner-trigger="default"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error(i18n.t('test.sonnerTriggerWasNotFound', 'Sonner trigger was not found.'));
    }

    await userEvent.click(trigger);

    // Wait for toast to appear
    const toaster = await waitFor(() => {
      const el = canvasElement.querySelector('[data-sonner-toaster]');
      if (!(el instanceof HTMLElement)) {
        throw new Error(i18n.t('test.toasterWasNotFound', 'Toaster was not found.'));
      }
      return el;
    });

    // Verify toaster has accessible positioning
    expect(toaster).toHaveAttribute('data-y-position');
    expect(toaster).toHaveAttribute('data-x-position');

    // Find the toast
    const toastEl = await waitFor(() => {
      const el = toaster.querySelector('[data-sonner-toast]');
      if (!(el instanceof HTMLElement)) {
        throw new Error(i18n.t('test.toastWasNotRendered', 'Toast was not rendered.'));
      }
      return el;
    });

    // Verify toast has type information for semantics
    expect(toastEl).toHaveAttribute('data-type');

    // Verify title is present and accessible
    const title = toastEl.querySelector('[data-title]');
    expect(title).toBeInTheDocument();
    expect(title?.textContent?.trim()).not.toBe('');

    // Verify description is present and accessible
    const description = toastEl.querySelector('[data-description]');
    expect(description).toBeInTheDocument();
    expect(description?.textContent?.trim()).not.toBe('');

    // Verify close button is accessible
    const closeButton = toastEl.querySelector('[data-close-button]');
    if (closeButton instanceof HTMLButtonElement) {
      const hasAccessibleLabel =
        closeButton.getAttribute('aria-label') || closeButton.textContent?.trim();
      expect(hasAccessibleLabel).not.toBe('');
    }
  },
};

// ============ PROMISE HANDLING STORIES ============

function SonnerPromiseDemo() {
  const showSuccessPromise = React.useCallback(() => {
    const promise = new Promise((resolve) => {
      setTimeout(() => resolve({ message: 'Data loaded successfully!' }), 2000);
    });

    toast.promise(promise, {
      loading: 'Loading data...',
      success: 'Data loaded successfully!',
      error: 'Failed to load data',
    });
  }, []);

  const showErrorPromise = React.useCallback(() => {
    const promise = new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error('Connection failed')), 2000);
    });

    toast.promise(promise, {
      loading: 'Connecting to server...',
      success: 'Connected!',
      error: 'Connection failed',
    });
  }, []);

  const showRandomPromise = React.useCallback(() => {
    const promise = new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.5) {
          resolve({ data: 'Success!' });
        } else {
          reject(new Error('Random failure'));
        }
      }, 1500);
    });

    toast.promise(promise, {
      loading: 'Processing...',
      success: 'Operation completed!',
      error: 'Operation failed',
    });
  }, []);

  const showChainedPromises = React.useCallback(() => {
    const step1 = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return i18n.t('sonner.story.step1Complete', 'Step 1 complete');
    };

    const step2 = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return i18n.t('sonner.story.step2Complete', 'Step 2 complete');
    };

    const step3 = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return i18n.t('sonner.story.step3Complete', 'Step 3 complete');
    };

    toast.promise(step1(), {
      loading: i18n.t('sonner.story.step1Initializing', 'Step 1: Initializing...'),
      success: () => {
        toast.promise(step2(), {
          loading: i18n.t('sonner.story.step2Processing', 'Step 2: Processing...'),
          success: () => {
            toast.promise(step3(), {
              loading: i18n.t('sonner.story.step3Finalizing', 'Step 3: Finalizing...'),
              success: i18n.t('sonner.story.allStepsCompleted', 'All steps completed!'),
              error: i18n.t('sonner.story.step3Failed', 'Step 3 failed'),
            });
            return i18n.t('sonner.story.step2CompleteExcl', 'Step 2 complete!');
          },
          error: i18n.t('sonner.story.step2Failed', 'Step 2 failed'),
        });
        return i18n.t('sonner.story.step1CompleteExcl', 'Step 1 complete!');
      },
      error: i18n.t('sonner.story.step1Failed', 'Step 1 failed'),
    });
  }, []);

  return (
    <div className="space-y-4" data-testid="sonner-promise-demo">
      <Toaster position="top-center" richColors />
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.story.testPromisebasedToastPatterns', 'Test promise-based toast patterns:')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          data-sonner-trigger="promise-success"
          onClick={showSuccessPromise}
          variant="outline"
        >
          Success Promise
        </Button>
        <Button data-sonner-trigger="promise-error" onClick={showErrorPromise} variant="outline">
          Error Promise
        </Button>
        <Button data-sonner-trigger="promise-random" onClick={showRandomPromise} variant="outline">
          Random Outcome
        </Button>
        <Button
          data-sonner-trigger="promise-chained"
          onClick={showChainedPromises}
          variant="outline"
        >
          Chained Promises
        </Button>
      </div>
    </div>
  );
}

export const PromiseHandling: Story = {
  render: () => <SonnerPromiseDemo />,
  play: async ({ canvasElement }) => {
    const successTrigger = canvasElement.querySelector('[data-sonner-trigger="promise-success"]');
    expect(successTrigger).toBeInTheDocument();

    const errorTrigger = canvasElement.querySelector('[data-sonner-trigger="promise-error"]');
    expect(errorTrigger).toBeInTheDocument();

    const randomTrigger = canvasElement.querySelector('[data-sonner-trigger="promise-random"]');
    expect(randomTrigger).toBeInTheDocument();

    // Test success promise
    if (successTrigger instanceof HTMLButtonElement) {
      await userEvent.click(successTrigger);

      // Should show loading first
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        const loadingToast = toaster?.querySelector('[data-type="loading"]');
        expect(loadingToast).toBeInTheDocument();
      });

      // Then success
      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const successToast = toaster?.querySelector('[data-type="success"]');
          expect(successToast).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    }
  },
};

export const PromiseWithCustomMessages: Story = {
  render: () => {
    const showCustomPromise = () => {
      const fetchData = async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { items: 42 };
      };

      toast.promise(fetchData(), {
        loading: 'Fetching items from database...',
        success: (data) => `Loaded ${data.items} items!`,
        error: (err) => `Error: ${err.message || 'Unknown error'}`,
      });
    };

    return (
      <div className="space-y-4">
        <Toaster position="top-center" richColors />
        <p className="text-muted-foreground text-sm">
          {i18n.t(
            'sonner.story.promiseWithDynamicSuccessMessage',
            'Promise with dynamic success message:'
          )}
        </p>
        <Button data-sonner-trigger="promise-custom" onClick={showCustomPromise} variant="outline">
          Fetch Items
        </Button>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-sonner-trigger="promise-custom"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);

      // Wait for success
      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const successToast = toaster?.querySelector('[data-type="success"]');
          expect(successToast?.textContent).toContain('42');
        },
        { timeout: 5000 }
      );
    }
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error400BadRequest: Story = {
  parameters: {
    msw: {
      handlers: sonnerStatusHandlers.badRequest,
    },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const errorToast = toaster?.querySelector('[data-type="error"]');
          expect(errorToast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error403Forbidden: Story = {
  parameters: {
    msw: {
      handlers: sonnerStatusHandlers.forbidden,
    },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const errorToast = toaster?.querySelector('[data-type="error"]');
          expect(errorToast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error429RateLimit: Story = {
  parameters: {
    msw: {
      handlers: sonnerStatusHandlers.tooManyRequests,
    },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const errorToast = toaster?.querySelector('[data-type="error"]');
          expect(errorToast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error502BadGateway: Story = {
  parameters: {
    msw: {
      handlers: sonnerStatusHandlers.badGateway,
    },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const errorToast = toaster?.querySelector('[data-type="error"]');
          expect(errorToast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error503ServiceUnavailable: Story = {
  parameters: {
    msw: {
      handlers: sonnerStatusHandlers.serviceUnavailable,
    },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const errorToast = toaster?.querySelector('[data-type="error"]');
          expect(errorToast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const Error504GatewayTimeout: Story = {
  parameters: {
    msw: {
      handlers: sonnerStatusHandlers.gatewayTimeout,
    },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const errorToast = toaster?.querySelector('[data-type="error"]');
          expect(errorToast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: sonnerStatusHandlers.emptyData },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-sonner-trigger]');
    expect(triggers.length).toBe(3);
  },
};

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: sonnerHandlers },
  },
  render: () => <SonnerWithApiDemo />,
  play: async ({ canvasElement }) => {
    const markReadTrigger = canvasElement.querySelector('[data-sonner-trigger="mark-read"]');
    expect(markReadTrigger).toBeInTheDocument();

    if (markReadTrigger instanceof HTMLButtonElement) {
      await userEvent.click(markReadTrigger);

      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          const successToast = toaster?.querySelector('[data-type="success"]');
          expect(successToast).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

// ============ FACTORY-WIRED STORIES ============

// -- Type-specific factory stories --

function FactorySuccessToastDemo() {
  const fakeToast = createFakeSuccessToast();

  return (
    <div className="space-y-4" data-testid="factory-success-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.successToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.successToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-success"
        onClick={() => toast.success(fakeToast.title, { description: fakeToast.description })}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactorySuccessToast: Story = {
  render: () => <FactorySuccessToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-success-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-success"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        const successToast = toaster?.querySelector('[data-type="success"]');
        expect(successToast).toBeInTheDocument();
      });
    }
  },
};

function FactoryErrorToastDemo() {
  const fakeToast = createFakeErrorToast();

  return (
    <div className="space-y-4" data-testid="factory-error-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.errorToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.errorToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-error"
        onClick={() => toast.error(fakeToast.title, { description: fakeToast.description })}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryErrorToast: Story = {
  render: () => <FactoryErrorToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-error-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-error"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        const errorToast = toaster?.querySelector('[data-type="error"]');
        expect(errorToast).toBeInTheDocument();
      });
    }
  },
};

function FactoryWarningToastDemo() {
  const fakeToast = createFakeWarningToast();

  return (
    <div className="space-y-4" data-testid="factory-warning-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.warningToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.warningToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-warning"
        onClick={() => toast.warning(fakeToast.title, { description: fakeToast.description })}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryWarningToast: Story = {
  render: () => <FactoryWarningToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-warning-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-warning"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        const warningToast = toaster?.querySelector('[data-type="warning"]');
        expect(warningToast).toBeInTheDocument();
      });
    }
  },
};

function FactoryInfoToastDemo() {
  const fakeToast = createFakeInfoToast();

  return (
    <div className="space-y-4" data-testid="factory-info-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.infoToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.infoToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-info"
        onClick={() => toast.info(fakeToast.title, { description: fakeToast.description })}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryInfoToast: Story = {
  render: () => <FactoryInfoToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-info-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-info"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        const infoToast = toaster?.querySelector('[data-type="info"]');
        expect(infoToast).toBeInTheDocument();
      });
    }
  },
};

function FactoryLoadingToastDemo() {
  const fakeToast = createFakeLoadingToast();

  return (
    <div className="space-y-4" data-testid="factory-loading-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.loadingToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.loadingToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-loading"
        onClick={() => toast.loading(fakeToast.title, { description: fakeToast.description })}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryLoadingToast: Story = {
  render: () => <FactoryLoadingToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-loading-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-loading"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        const loadingToast = toaster?.querySelector('[data-type="loading"]');
        expect(loadingToast).toBeInTheDocument();
      });
    }
  },
};

function FactoryDefaultToastDemo() {
  const fakeToast = createFakeDefaultToast();

  return (
    <div className="space-y-4" data-testid="factory-default-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.defaultToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.defaultToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-default"
        onClick={() => toast(fakeToast.title, { description: fakeToast.description })}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryDefaultToast: Story = {
  render: () => <FactoryDefaultToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-default-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-default"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        const defaultToast = toaster?.querySelector('[data-sonner-toast]');
        expect(defaultToast).toBeInTheDocument();
      });
    }
  },
};

// -- Category-specific factory stories --

function FactoryAuthToastDemo() {
  const fakeToast = createFakeAuthToast();

  return (
    <div className="space-y-4" data-testid="factory-auth-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.authToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.authToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-auth"
        onClick={() => toast.info(fakeToast.title, { description: fakeToast.description })}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryAuthToast: Story = {
  render: () => <FactoryAuthToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-auth-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-auth"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-sonner-toast]')).toBeInTheDocument();
      });
    }
  },
};

function FactoryFileToastDemo() {
  const fakeToast = createFakeFileToast();

  return (
    <div className="space-y-4" data-testid="factory-file-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.fileToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.fileToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-file"
        onClick={() => toast.success(fakeToast.title, { description: fakeToast.description })}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryFileToast: Story = {
  render: () => <FactoryFileToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-file-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-file"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-type="success"]')).toBeInTheDocument();
      });
    }
  },
};

function FactoryPaymentToastDemo() {
  const fakeToast = createFakePaymentToast();

  return (
    <div className="space-y-4" data-testid="factory-payment-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.paymentToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.paymentToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-payment"
        onClick={() => toast.success(fakeToast.title, { description: fakeToast.description })}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryPaymentToast: Story = {
  render: () => <FactoryPaymentToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-payment-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-payment"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-type="success"]')).toBeInTheDocument();
      });
    }
  },
};

function FactoryNetworkToastDemo() {
  const fakeToast = createFakeNetworkToast();

  return (
    <div className="space-y-4" data-testid="factory-network-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.networkToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.networkToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-network"
        onClick={() => toast.warning(fakeToast.title, { description: fakeToast.description })}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryNetworkToast: Story = {
  render: () => <FactoryNetworkToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-network-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-network"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-type="warning"]')).toBeInTheDocument();
      });
    }
  },
};

function FactoryFormToastDemo() {
  const fakeToast = createFakeFormToast();

  return (
    <div className="space-y-4" data-testid="factory-form-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.formToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.formToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-form"
        onClick={() => toast.success(fakeToast.title, { description: fakeToast.description })}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryFormToast: Story = {
  render: () => <FactoryFormToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-form-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-form"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-type="success"]')).toBeInTheDocument();
      });
    }
  },
};

function FactoryCategoryToastDemo() {
  const categories: ToastCategory[] = TOAST_CATEGORIES;

  return (
    <div className="space-y-4" data-testid="factory-category-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.categoryToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.categoryToast.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const fakeToast = createFakeCategoryToast(category);
          return (
            <Button
              key={category}
              data-sonner-trigger={`factory-category-${category}`}
              onClick={() => toast.info(fakeToast.title, { description: fakeToast.description })}
              variant="outline"
            >
              {category}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export const FactoryCategoryToast: Story = {
  render: () => <FactoryCategoryToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-category-toast"]');
    expect(container).toBeInTheDocument();
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(TOAST_CATEGORIES.length);
  },
};

// -- Action toast factory stories --

function FactoryActionToastDemo() {
  const fakeToast = createFakeToastWithAction();

  return (
    <div className="space-y-4" data-testid="factory-action-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.actionToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.actionToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-action"
        onClick={() =>
          toast(fakeToast.title, {
            description: fakeToast.description,
            action: fakeToast.action
              ? { label: fakeToast.action.label, onClick: fakeToast.action.onClick }
              : undefined,
          })
        }
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryActionToast: Story = {
  render: () => <FactoryActionToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-action-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-action"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-sonner-toast]')).toBeInTheDocument();
      });
    }
  },
};

function FactoryUndoToastDemo() {
  const fakeToast = createFakeUndoToast();

  return (
    <div className="space-y-4" data-testid="factory-undo-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.undoToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.undoToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-undo"
        onClick={() =>
          toast(fakeToast.title, {
            description: fakeToast.description,
            action: fakeToast.action
              ? { label: fakeToast.action.label, onClick: fakeToast.action.onClick }
              : undefined,
          })
        }
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryUndoToast: Story = {
  render: () => <FactoryUndoToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-undo-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-undo"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        const toastEl = toaster?.querySelector('[data-sonner-toast]');
        expect(toastEl).toBeInTheDocument();
        expect(toastEl?.textContent).toContain('Undo');
      });
    }
  },
};

function FactoryRetryToastDemo() {
  const fakeToast = createFakeRetryToast();

  return (
    <div className="space-y-4" data-testid="factory-retry-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.retryToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.retryToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-retry"
        onClick={() =>
          toast.error(fakeToast.title, {
            description: fakeToast.description,
            action: fakeToast.action
              ? { label: fakeToast.action.label, onClick: fakeToast.action.onClick }
              : undefined,
          })
        }
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryRetryToast: Story = {
  render: () => <FactoryRetryToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-retry-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-retry"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        const toastEl = toaster?.querySelector('[data-type="error"]');
        expect(toastEl).toBeInTheDocument();
        expect(toastEl?.textContent).toContain('Retry');
      });
    }
  },
};

// -- Promise factory stories --

function FactoryPromiseToastDemo() {
  return (
    <div className="space-y-4" data-testid="factory-promise-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.promiseToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.promiseToast.description')}
      </p>
      <Button
        data-sonner-trigger="factory-promise"
        onClick={() => {
          const promiseData = createFakeToastPromise();
          toast.promise(promiseData.promise, {
            loading: promiseData.loadingMessage,
            success: promiseData.successMessage,
            error: promiseData.errorMessage,
          });
        }}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryPromiseToast: Story = {
  render: () => <FactoryPromiseToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-promise-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-promise"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-sonner-toast]')).toBeInTheDocument();
      });
    }
  },
};

function FactorySuccessPromiseDemo() {
  return (
    <div className="space-y-4" data-testid="factory-success-promise">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.successPromise.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.successPromise.description')}
      </p>
      <Button
        data-sonner-trigger="factory-success-promise"
        onClick={() => {
          const promiseData = createFakeSuccessPromiseToast(1500);
          toast.promise(promiseData.promise, {
            loading: promiseData.loadingMessage,
            success: promiseData.successMessage,
            error: promiseData.errorMessage,
          });
        }}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactorySuccessPromise: Story = {
  render: () => <FactorySuccessPromiseDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-success-promise"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-success-promise"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-type="loading"]')).toBeInTheDocument();
      });
      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          expect(toaster?.querySelector('[data-type="success"]')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    }
  },
};

function FactoryErrorPromiseDemo() {
  return (
    <div className="space-y-4" data-testid="factory-error-promise">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.errorPromise.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.errorPromise.description')}
      </p>
      <Button
        data-sonner-trigger="factory-error-promise"
        onClick={() => {
          const promiseData = createFakeErrorPromiseToast(1500);
          toast.promise(promiseData.promise, {
            loading: promiseData.loadingMessage,
            success: promiseData.successMessage,
            error: promiseData.errorMessage,
          });
        }}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryErrorPromise: Story = {
  render: () => <FactoryErrorPromiseDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-error-promise"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-error-promise"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-type="loading"]')).toBeInTheDocument();
      });
      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          expect(toaster?.querySelector('[data-type="error"]')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    }
  },
};

// -- Toaster config factory story --

function FactoryToasterConfigDemo() {
  const config = createFakeToasterConfig();

  return (
    <div className="space-y-4" data-testid="factory-toaster-config">
      <Toaster
        position={config.position}
        richColors={config.richColors}
        closeButton={config.closeButton}
        expand={config.expand}
        duration={config.duration}
        visibleToasts={config.visibleToasts}
      />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.toasterConfig.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.toasterConfig.description')}
      </p>
      <div className="text-muted-foreground space-y-1 text-xs">
        <p>Position: {config.position}</p>
        <p>Theme: {config.theme}</p>
        <p>{i18n.t('sonner.story.durationMs', { duration: config.duration })}</p>
        <p>Visible Toasts: {config.visibleToasts}</p>
        <p>Rich Colors: {String(config.richColors)}</p>
        <p>Close Button: {String(config.closeButton)}</p>
        <p>Expand: {String(config.expand)}</p>
        <p>Invert: {String(config.invert)}</p>
        <p>Direction: {config.dir}</p>
        <p>{i18n.t('sonner.story.gapPx', { gap: config.gap })}</p>
        <p>Offset: {String(config.offset)}</p>
      </div>
      <Button
        data-sonner-trigger="factory-config"
        onClick={() => toast('Config Test', { description: 'Toast with factory config.' })}
        variant="outline"
      >
        {i18n.t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryToasterConfig: Story = {
  render: () => <FactoryToasterConfigDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-toaster-config"]');
    expect(container).toBeInTheDocument();
    expect(container?.textContent).toContain('Position:');
    expect(container?.textContent).toContain('Theme:');
    expect(container?.textContent).toContain('Duration:');
  },
};

// -- Matrix factory stories --

function FactoryTypeMatrixDemo() {
  const matrix = createToastTypeMatrix();

  return (
    <div className="space-y-4" data-testid="factory-type-matrix">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.typeMatrix.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.typeMatrix.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        {matrix.map(({ type, toast: toastData }) => {
          const toastFnMap: Record<string, typeof toast.info> = {
            error: toast.error,
            info: toast.info,
            success: toast.success,
            warning: toast.warning,
          };
          return (
            <Button
              key={type}
              data-sonner-trigger={`type-matrix-${type}`}
              onClick={() => {
                const fn = toastFnMap[type];
                if (fn) {
                  fn(toastData.title, { description: toastData.description });
                } else if (type === 'loading') {
                  toast.loading(toastData.title, { description: toastData.description });
                } else {
                  toast(toastData.title, { description: toastData.description });
                }
              }}
              variant="outline"
            >
              {type}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export const FactoryTypeMatrix: Story = {
  render: () => <FactoryTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-type-matrix"]');
    expect(container).toBeInTheDocument();
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(TOAST_TYPES.length);
  },
};

function FactoryPositionMatrixDemo() {
  const matrix = createToastPositionMatrix();

  return (
    <div className="space-y-4" data-testid="factory-position-matrix">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.positionMatrix.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.positionMatrix.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        {matrix.map(({ position, toast: toastData }) => (
          <Button
            key={position}
            data-sonner-trigger={`pos-matrix-${position}`}
            onClick={() =>
              toast(toastData.title, {
                description: toastData.description,
                position,
              })
            }
            variant="outline"
          >
            {position}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const FactoryPositionMatrix: Story = {
  render: () => <FactoryPositionMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-position-matrix"]');
    expect(container).toBeInTheDocument();
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(TOAST_POSITIONS.length);
  },
};

function FactoryPriorityMatrixDemo() {
  const matrix = createToastPriorityMatrix();

  return (
    <div className="space-y-4" data-testid="factory-priority-matrix">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.priorityMatrix.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.priorityMatrix.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        {matrix.map(({ priority, toast: toastData }) => (
          <Button
            key={priority}
            data-sonner-trigger={`priority-matrix-${priority}`}
            onClick={() =>
              toast(toastData.title, {
                description: `${toastData.description} [Priority: ${priority}]`,
                duration: priority === 'critical' || priority === 'high' ? 10_000 : 4000,
              })
            }
            variant="outline"
          >
            {priority}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const FactoryPriorityMatrix: Story = {
  render: () => <FactoryPriorityMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-priority-matrix"]');
    expect(container).toBeInTheDocument();
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(TOAST_PRIORITIES.length);
  },
};

function FactoryCategoryMatrixDemo() {
  const matrix = createToastCategoryMatrix();

  return (
    <div className="space-y-4" data-testid="factory-category-matrix">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.categoryMatrix.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.categoryMatrix.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        {matrix.map(({ category, toast: toastData }) => (
          <Button
            key={category}
            data-sonner-trigger={`cat-matrix-${category}`}
            onClick={() => toast.info(toastData.title, { description: toastData.description })}
            variant="outline"
          >
            {category}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const FactoryCategoryMatrix: Story = {
  render: () => <FactoryCategoryMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-category-matrix"]');
    expect(container).toBeInTheDocument();
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(TOAST_CATEGORIES.length);
  },
};

// -- Queue & sequence factory stories --

function FactoryQueueDemo() {
  return (
    <div className="space-y-4" data-testid="factory-queue">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.queue.title')}</p>
      <p className="text-muted-foreground text-sm">{i18n.t('sonner.factory.queue.description')}</p>
      <Button
        data-sonner-trigger="factory-queue"
        onClick={() => {
          const queue = createFakeToastQueue(4);
          queue.forEach((item: FakeToastQueueItem) => {
            setTimeout(() => {
              toast(item.title, { description: item.description });
            }, item.delay);
          });
        }}
        variant="outline"
      >
        {i18n.t('sonner.factory.showAll')}
      </Button>
    </div>
  );
}

export const FactoryQueue: Story = {
  render: () => <FactoryQueueDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-queue"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-queue"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          expect(toaster?.querySelector('[data-sonner-toast]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

function FactorySequenceDemo() {
  return (
    <div className="space-y-4" data-testid="factory-sequence">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.sequence.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.sequence.description')}
      </p>
      <Button
        data-sonner-trigger="factory-sequence"
        onClick={() => {
          const sequence = createFakeToastSequence(3);
          sequence.toasts.forEach((item: FakeToast, index: number) => {
            setTimeout(() => {
              toast(item.title, { description: item.description });
            }, index * sequence.delay);
          });
        }}
        variant="outline"
      >
        {i18n.t('sonner.factory.showAll')}
      </Button>
    </div>
  );
}

export const FactorySequence: Story = {
  render: () => <FactorySequenceDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-sequence"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-sequence"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          expect(toaster?.querySelector('[data-sonner-toast]')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    }
  },
};

// -- Group factory stories --

function FactoryGroupDemo() {
  return (
    <div className="space-y-4" data-testid="factory-group">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.group.title')}</p>
      <p className="text-muted-foreground text-sm">{i18n.t('sonner.factory.group.description')}</p>
      <Button
        data-sonner-trigger="factory-group"
        onClick={() => {
          const group = createFakeToastGroup('payment', 3);
          group.toasts.forEach((item: FakeToast, index: number) => {
            setTimeout(() => {
              toast.success(item.title, { description: item.description });
            }, index * 300);
          });
        }}
        variant="outline"
      >
        {i18n.t('sonner.factory.showAll')}
      </Button>
    </div>
  );
}

export const FactoryGroup: Story = {
  render: () => <FactoryGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-group"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-group"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(
        () => {
          const toaster = canvasElement.querySelector('[data-sonner-toaster]');
          expect(toaster?.querySelector('[data-type="success"]')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    }
  },
};

function FactoryGroupsByCategoryDemo() {
  return (
    <div className="space-y-4" data-testid="factory-groups-by-category">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.groupsByCategory.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.groupsByCategory.description')}
      </p>
      <Button
        data-sonner-trigger="factory-groups-by-category"
        onClick={() => {
          const groups = createFakeToastGroupsByCategory(1);
          groups.forEach((group: FakeToastGroup, groupIndex: number) => {
            group.toasts.forEach((item: FakeToast, toastIndex: number) => {
              setTimeout(
                () => {
                  toast.info(`[${group.category}] ${item.title}`, {
                    description: item.description,
                  });
                },
                (groupIndex * 2 + toastIndex) * 300
              );
            });
          });
        }}
        variant="outline"
      >
        {i18n.t('sonner.factory.showAll')}
      </Button>
    </div>
  );
}

export const FactoryGroupsByCategory: Story = {
  render: () => <FactoryGroupsByCategoryDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-groups-by-category"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector(
      '[data-sonner-trigger="factory-groups-by-category"]'
    );
    expect(trigger).toBeInTheDocument();
  },
};

// -- Comprehensive test data & showcase stories --

function FactoryTestDataDemo() {
  const testData = createToastTestData();

  return (
    <div className="space-y-4" data-testid="factory-test-data">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.testData.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.testData.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          data-sonner-trigger="test-data-success"
          onClick={() =>
            toast.success(testData.success.title, { description: testData.success.description })
          }
          variant="outline"
        >
          Success
        </Button>
        <Button
          data-sonner-trigger="test-data-error"
          onClick={() =>
            toast.error(testData.error.title, { description: testData.error.description })
          }
          variant="outline"
        >
          Error
        </Button>
        <Button
          data-sonner-trigger="test-data-warning"
          onClick={() =>
            toast.warning(testData.warning.title, { description: testData.warning.description })
          }
          variant="outline"
        >
          Warning
        </Button>
        <Button
          data-sonner-trigger="test-data-info"
          onClick={() =>
            toast.info(testData.info.title, { description: testData.info.description })
          }
          variant="outline"
        >
          Info
        </Button>
        <Button
          data-sonner-trigger="test-data-auth"
          onClick={() =>
            toast.info(testData.auth.title, { description: testData.auth.description })
          }
          variant="outline"
        >
          Auth
        </Button>
        <Button
          data-sonner-trigger="test-data-file"
          onClick={() =>
            toast.success(testData.file.title, { description: testData.file.description })
          }
          variant="outline"
        >
          File
        </Button>
        <Button
          data-sonner-trigger="test-data-payment"
          onClick={() =>
            toast.success(testData.payment.title, { description: testData.payment.description })
          }
          variant="outline"
        >
          Payment
        </Button>
        <Button
          data-sonner-trigger="test-data-network"
          onClick={() =>
            toast.warning(testData.network.title, { description: testData.network.description })
          }
          variant="outline"
        >
          Network
        </Button>
      </div>
    </div>
  );
}

export const FactoryTestData: Story = {
  render: () => <FactoryTestDataDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-test-data"]');
    expect(container).toBeInTheDocument();
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(8);
  },
};

function FactoryShowcaseDemo() {
  const showcase = createToastShowcase();

  return (
    <div className="space-y-6" data-testid="factory-showcase">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.factory.showcase.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.factory.showcase.description')}
      </p>

      <div className="space-y-2">
        <p className="text-xs font-medium">Type Matrix ({showcase.typeMatrix.length} types)</p>
        <div className="flex flex-wrap gap-1">
          {showcase.typeMatrix.map(({ type }) => (
            <span
              key={type}
              className="bg-muted rounded px-2 py-0.5 text-xs"
              data-factory-type={type}
            >
              {type}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">
          Position Matrix ({showcase.positionMatrix.length} positions)
        </p>
        <div className="flex flex-wrap gap-1">
          {showcase.positionMatrix.map(({ position }) => (
            <span
              key={position}
              className="bg-muted rounded px-2 py-0.5 text-xs"
              data-factory-position={position}
            >
              {position}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">
          Priority Matrix ({showcase.priorityMatrix.length} priorities)
        </p>
        <div className="flex flex-wrap gap-1">
          {showcase.priorityMatrix.map(({ priority }) => (
            <span
              key={priority}
              className="bg-muted rounded px-2 py-0.5 text-xs"
              data-factory-priority={priority}
            >
              {priority}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">
          Category Matrix ({showcase.categoryMatrix.length} categories)
        </p>
        <div className="flex flex-wrap gap-1">
          {showcase.categoryMatrix.map(({ category }) => (
            <span
              key={category}
              className="bg-muted rounded px-2 py-0.5 text-xs"
              data-factory-category={category}
            >
              {category}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">Groups ({showcase.groups.length} groups)</p>
        <p className="text-xs font-medium">Queue ({showcase.queue.length} items)</p>
      </div>
    </div>
  );
}

export const FactoryShowcase: Story = {
  render: () => <FactoryShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-showcase"]');
    expect(container).toBeInTheDocument();

    // Verify type matrix
    const types = container!.querySelectorAll('[data-factory-type]');
    expect(types.length).toBe(TOAST_TYPES.length);

    // Verify position matrix
    const positions = container!.querySelectorAll('[data-factory-position]');
    expect(positions.length).toBe(TOAST_POSITIONS.length);

    // Verify priority matrix
    const priorities = container!.querySelectorAll('[data-factory-priority]');
    expect(priorities.length).toBe(TOAST_PRIORITIES.length);

    // Verify category matrix
    const categories = container!.querySelectorAll('[data-factory-category]');
    expect(categories.length).toBe(TOAST_CATEGORIES.length);
  },
};

// -- Constants & types usage stories --

function FactoryConstantsDemo() {
  // Use all constants to demonstrate coverage
  const allTypes: ToastType[] = TOAST_TYPES;
  const allPositions: ToastPosition[] = TOAST_POSITIONS;
  const allThemes: ToastTheme[] = TOAST_THEMES;
  const allPriorities: ToastPriority[] = TOAST_PRIORITIES;
  const allCategories: ToastCategory[] = TOAST_CATEGORIES;
  const durations = TOAST_DURATIONS;
  const titles = TOAST_TITLES;
  const descriptions = TOAST_DESCRIPTIONS;
  const categoryMessages = CATEGORY_MESSAGES;
  const actionLabels = ACTION_LABELS;
  const cancelLabels = CANCEL_LABELS;

  // Use interfaces as type annotations for demonstration
  const sampleActionOnClick = () => {};
  const sampleAction: FakeToastAction = { label: actionLabels[0], onClick: sampleActionOnClick };
  const sampleToast: FakeToast = createFakeToast();
  const samplePromise: FakeToastPromise = createFakeToastPromise();
  const sampleQueueItem: FakeToastQueueItem = createFakeToastQueue(1)[0];
  const sampleConfig: FakeToasterConfig = createFakeToasterConfig();
  const sampleSequence: FakeToastSequence = createFakeToastSequence(1);
  const sampleGroup: FakeToastGroup = createFakeToastGroup('system');

  return (
    <div className="space-y-4" data-testid="factory-constants">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">
        {i18n.t('sonner.factory.showcase.title')}: Constants & Types
      </p>

      <div className="space-y-2 text-xs">
        <p data-factory-stat="types">Types: {allTypes.join(', ')}</p>
        <p data-factory-stat="positions">Positions: {allPositions.join(', ')}</p>
        <p data-factory-stat="themes">Themes: {allThemes.join(', ')}</p>
        <p data-factory-stat="priorities">Priorities: {allPriorities.join(', ')}</p>
        <p data-factory-stat="categories">Categories: {allCategories.join(', ')}</p>
        <p data-factory-stat="durations">
          Durations:{' '}
          {Object.entries(durations)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}
        </p>
        <p data-factory-stat="title-count">Title groups: {Object.keys(titles).length}</p>
        <p data-factory-stat="desc-count">Description groups: {Object.keys(descriptions).length}</p>
        <p data-factory-stat="category-msg-count">
          Category message groups: {Object.keys(categoryMessages).length}
        </p>
        <p data-factory-stat="action-labels">Action labels: {actionLabels.join(', ')}</p>
        <p data-factory-stat="cancel-labels">Cancel labels: {cancelLabels.join(', ')}</p>
      </div>

      <div className="space-y-2 text-xs">
        <p data-factory-stat="sample-action">
          Action: {sampleAction.label} (onClick: {typeof sampleAction.onClick})
        </p>
        <p data-factory-stat="sample-toast">
          Toast: {sampleToast.title} ({sampleToast.type})
        </p>
        <p data-factory-stat="sample-promise">Promise: {samplePromise.loadingMessage}</p>
        <p data-factory-stat="sample-queue">
          Queue: index={sampleQueueItem.index}, delay={sampleQueueItem.delay}
        </p>
        <p data-factory-stat="sample-config">Config: position={sampleConfig.position}</p>
        <p data-factory-stat="sample-sequence">
          {i18n.t('sonner.story.sequenceToasts', { count: sampleSequence.toasts.length })}
        </p>
        <p data-factory-stat="sample-group">
          Group: {sampleGroup.category} ({sampleGroup.toasts.length} toasts)
        </p>
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  render: () => <FactoryConstantsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-constants"]');
    expect(container).toBeInTheDocument();

    // Verify all constant sections render
    expect(container!.querySelector('[data-factory-stat="types"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-factory-stat="positions"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-factory-stat="themes"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-factory-stat="priorities"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-factory-stat="categories"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-factory-stat="durations"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-factory-stat="action-labels"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-factory-stat="cancel-labels"]')).toBeInTheDocument();

    // Verify interface-typed samples render
    expect(container!.querySelector('[data-factory-stat="sample-action"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-factory-stat="sample-toast"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-factory-stat="sample-promise"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-factory-stat="sample-queue"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-factory-stat="sample-config"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-factory-stat="sample-sequence"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-factory-stat="sample-group"]')).toBeInTheDocument();
  },
};

// -- createFakeToast base factory story --

function FactoryBaseToastDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4" data-testid="factory-base-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{t('sonner.factory.showButton')}: Base Toast Factory</p>
      <p className="text-muted-foreground text-sm">
        Uses createFakeToast() with random type assignment.
      </p>
      <Button
        data-sonner-trigger="factory-base"
        onClick={() => {
          const fakeToast = createFakeToast();
          const toastFnMap: Record<string, typeof toast.info> = {
            error: toast.error,
            info: toast.info,
            success: toast.success,
            warning: toast.warning,
          };
          const fn = toastFnMap[fakeToast.type];
          if (fn) {
            fn(fakeToast.title, { description: fakeToast.description });
          } else if (fakeToast.type === 'loading') {
            toast.loading(fakeToast.title, { description: fakeToast.description });
          } else {
            toast(fakeToast.title, { description: fakeToast.description });
          }
        }}
        variant="outline"
      >
        {t('sonner.factory.showButton')}
      </Button>
    </div>
  );
}

export const FactoryBaseToast: Story = {
  render: () => <FactoryBaseToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-base-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="factory-base"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-sonner-toast]')).toBeInTheDocument();
      });
    }
  },
};

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION FACTORY WIRED STORIES
// ═══════════════════════════════════════════════════════════════

// -- Bulk notifications --

function NotifFactoryBulkDemo() {
  const notifications = createFakeNotifications(5);

  return (
    <div className="space-y-4" data-testid="notif-factory-bulk">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.bulkNotifications.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.bulkNotifications.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        {notifications.map((n: FakeNotification, i: number) => (
          <Button
            key={n.id}
            data-sonner-trigger={`notif-bulk-${i}`}
            onClick={() => {
              const fnMap: Record<string, typeof toast.info> = {
                error: toast.error,
                info: toast.info,
                success: toast.success,
                warning: toast.warning,
              };
              (fnMap[n.type] ?? toast.info)(n.title, { description: n.description });
            }}
            variant="outline"
          >
            {n.type}: {n.title.slice(0, 20)}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const NotifFactoryBulk: Story = {
  render: () => <NotifFactoryBulkDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-bulk"]');
    expect(container).toBeInTheDocument();
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(5);
    if (buttons[0] instanceof HTMLButtonElement) {
      await userEvent.click(buttons[0]);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-sonner-toast]')).toBeInTheDocument();
      });
    }
  },
};

// -- Info notification --

function NotifFactoryInfoDemo() {
  const notification = createFakeInfoNotification();

  return (
    <div className="space-y-4" data-testid="notif-factory-info">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.infoNotification.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.infoNotification.description')}
      </p>
      <Button
        data-sonner-trigger="notif-info"
        onClick={() => toast.info(notification.title, { description: notification.description })}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showButton')}
      </Button>
    </div>
  );
}

export const NotifFactoryInfo: Story = {
  render: () => <NotifFactoryInfoDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-info"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="notif-info"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-type="info"]')).toBeInTheDocument();
      });
    }
  },
};

// -- Success notification --

function NotifFactorySuccessDemo() {
  const notification = createFakeSuccessNotification();

  return (
    <div className="space-y-4" data-testid="notif-factory-success">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">
        {i18n.t('sonner.notifFactory.successNotification.title')}
      </p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.successNotification.description')}
      </p>
      <Button
        data-sonner-trigger="notif-success"
        onClick={() => toast.success(notification.title, { description: notification.description })}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showButton')}
      </Button>
    </div>
  );
}

export const NotifFactorySuccess: Story = {
  render: () => <NotifFactorySuccessDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-success"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="notif-success"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-type="success"]')).toBeInTheDocument();
      });
    }
  },
};

// -- Warning notification --

function NotifFactoryWarningDemo() {
  const notification = createFakeWarningNotification();

  return (
    <div className="space-y-4" data-testid="notif-factory-warning">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">
        {i18n.t('sonner.notifFactory.warningNotification.title')}
      </p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.warningNotification.description')}
      </p>
      <Button
        data-sonner-trigger="notif-warning"
        onClick={() => toast.warning(notification.title, { description: notification.description })}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showButton')}
      </Button>
    </div>
  );
}

export const NotifFactoryWarning: Story = {
  render: () => <NotifFactoryWarningDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-warning"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="notif-warning"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-type="warning"]')).toBeInTheDocument();
      });
    }
  },
};

// -- Error notification --

function NotifFactoryErrorDemo() {
  const notification = createFakeErrorNotification();

  return (
    <div className="space-y-4" data-testid="notif-factory-error">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.errorNotification.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.errorNotification.description')}
      </p>
      <Button
        data-sonner-trigger="notif-error"
        onClick={() => toast.error(notification.title, { description: notification.description })}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showButton')}
      </Button>
    </div>
  );
}

export const NotifFactoryError: Story = {
  render: () => <NotifFactoryErrorDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-error"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="notif-error"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-type="error"]')).toBeInTheDocument();
      });
    }
  },
};

// -- Unread notification --

function NotifFactoryUnreadDemo() {
  const notification = createFakeUnreadNotification();

  return (
    <div className="space-y-4" data-testid="notif-factory-unread">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">
        {i18n.t('sonner.notifFactory.unreadNotification.title')}
      </p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.unreadNotification.description')}
      </p>
      <p className="text-xs" data-notif-read={String(notification.read)}>
        Read: {String(notification.read)} | Status: {notification.status}
      </p>
      <Button
        data-sonner-trigger="notif-unread"
        onClick={() => toast.info(notification.title, { description: notification.description })}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showButton')}
      </Button>
    </div>
  );
}

export const NotifFactoryUnread: Story = {
  render: () => <NotifFactoryUnreadDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-unread"]');
    expect(container).toBeInTheDocument();
    const readEl = container!.querySelector('[data-notif-read="false"]');
    expect(readEl).toBeInTheDocument();
    expect(readEl?.textContent).toContain('unread');
  },
};

// -- Read notification --

function NotifFactoryReadDemo() {
  const notification = createFakeReadNotification();

  return (
    <div className="space-y-4" data-testid="notif-factory-read">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.readNotification.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.readNotification.description')}
      </p>
      <p className="text-xs" data-notif-read={String(notification.read)}>
        Read: {String(notification.read)} | Status: {notification.status}
      </p>
      <Button
        data-sonner-trigger="notif-read"
        onClick={() => toast.info(notification.title, { description: notification.description })}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showButton')}
      </Button>
    </div>
  );
}

export const NotifFactoryRead: Story = {
  render: () => <NotifFactoryReadDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-read"]');
    expect(container).toBeInTheDocument();
    const readEl = container!.querySelector('[data-notif-read="true"]');
    expect(readEl).toBeInTheDocument();
    expect(readEl?.textContent).toContain('read');
  },
};

// -- Security notification --

function NotifFactorySecurityDemo() {
  const notification = createFakeSecurityNotification();

  return (
    <div className="space-y-4" data-testid="notif-factory-security">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">
        {i18n.t('sonner.notifFactory.securityNotification.title')}
      </p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.securityNotification.description')}
      </p>
      <Button
        data-sonner-trigger="notif-security"
        onClick={() => toast.warning(notification.title, { description: notification.description })}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showButton')}
      </Button>
    </div>
  );
}

export const NotifFactorySecurity: Story = {
  render: () => <NotifFactorySecurityDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-security"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="notif-security"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-type="warning"]')).toBeInTheDocument();
      });
    }
  },
};

// -- Message notification --

function NotifFactoryMessageDemo() {
  const notification = createFakeMessageNotification();

  return (
    <div className="space-y-4" data-testid="notif-factory-message">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">
        {i18n.t('sonner.notifFactory.messageNotification.title')}
      </p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.messageNotification.description')}
      </p>
      <p className="text-xs" data-notif-sender={notification.sender?.name}>
        From: {notification.sender?.name ?? i18n.t('sonner.story.unknown', 'Unknown')}
      </p>
      <Button
        data-sonner-trigger="notif-message"
        onClick={() => toast.info(notification.title, { description: notification.description })}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showButton')}
      </Button>
    </div>
  );
}

export const NotifFactoryMessage: Story = {
  render: () => <NotifFactoryMessageDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-message"]');
    expect(container).toBeInTheDocument();
    const senderEl = container!.querySelector('[data-notif-sender]');
    expect(senderEl).toBeInTheDocument();
    expect(senderEl?.textContent).toContain('From:');
  },
};

// -- Billing notification --

function NotifFactoryBillingDemo() {
  const notification = createFakeBillingNotification();

  return (
    <div className="space-y-4" data-testid="notif-factory-billing">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">
        {i18n.t('sonner.notifFactory.billingNotification.title')}
      </p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.billingNotification.description')}
      </p>
      <Button
        data-sonner-trigger="notif-billing"
        onClick={() => toast.info(notification.title, { description: notification.description })}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showButton')}
      </Button>
    </div>
  );
}

export const NotifFactoryBilling: Story = {
  render: () => <NotifFactoryBillingDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-billing"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="notif-billing"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-sonner-toast]')).toBeInTheDocument();
      });
    }
  },
};

// -- All types --

function NotifFactoryAllTypesDemo() {
  const notifications = createFakeNotificationsWithAllTypes();

  return (
    <div className="space-y-4" data-testid="notif-factory-all-types">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.allTypes.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.allTypes.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        {notifications.map((n: FakeNotification) => (
          <Button
            key={n.id}
            data-sonner-trigger={`notif-type-${n.type}`}
            onClick={() => {
              const fnMap: Record<string, typeof toast.info> = {
                error: toast.error,
                info: toast.info,
                success: toast.success,
                warning: toast.warning,
              };
              (fnMap[n.type] ?? toast.info)(n.title, { description: n.description });
            }}
            variant="outline"
          >
            {n.type}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const NotifFactoryAllTypes: Story = {
  render: () => <NotifFactoryAllTypesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-all-types"]');
    expect(container).toBeInTheDocument();
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(NOTIFICATION_TYPES.length);
  },
};

// -- All priorities --

function NotifFactoryAllPrioritiesDemo() {
  const notifications = createFakeNotificationsWithAllPriorities();

  return (
    <div className="space-y-4" data-testid="notif-factory-all-priorities">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.allPriorities.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.allPriorities.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        {notifications.map((n: FakeNotification) => (
          <Button
            key={n.id}
            data-sonner-trigger={`notif-priority-${n.priority}`}
            onClick={() => toast(`[${n.priority}] ${n.title}`, { description: n.description })}
            variant="outline"
          >
            {n.priority}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const NotifFactoryAllPriorities: Story = {
  render: () => <NotifFactoryAllPrioritiesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-all-priorities"]');
    expect(container).toBeInTheDocument();
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(NOTIFICATION_PRIORITIES.length);
  },
};

// -- All categories --

function NotifFactoryAllCategoriesDemo() {
  const notifications = createFakeNotificationsWithAllCategories();

  return (
    <div className="space-y-4" data-testid="notif-factory-all-categories">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.allCategories.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.allCategories.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        {notifications.map((n: FakeNotification) => (
          <Button
            key={n.id}
            data-sonner-trigger={`notif-category-${n.category}`}
            onClick={() => toast.info(`[${n.category}] ${n.title}`, { description: n.description })}
            variant="outline"
          >
            {n.category}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const NotifFactoryAllCategories: Story = {
  render: () => <NotifFactoryAllCategoriesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-all-categories"]');
    expect(container).toBeInTheDocument();
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(NOTIFICATION_CATEGORIES.length);
  },
};

// -- Notifications response --

function NotifFactoryResponseDemo() {
  const response: FakeNotificationsResponse = createFakeNotificationsResponse(5);

  return (
    <div className="space-y-4" data-testid="notif-factory-response">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.response.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.response.description')}
      </p>
      <div className="text-xs" data-notif-response>
        <p data-response-stat="total">Total: {response.total}</p>
        <p data-response-stat="unread">Unread: {response.unreadCount}</p>
        <p data-response-stat="hasMore">Has More: {String(response.hasMore)}</p>
      </div>
      <Button
        data-sonner-trigger="notif-response"
        onClick={() => {
          response.notifications.forEach((n, i) => {
            setTimeout(() => {
              toast.info(n.title, { description: n.description });
            }, i * 300);
          });
        }}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showAll')}
      </Button>
    </div>
  );
}

export const NotifFactoryResponse: Story = {
  render: () => <NotifFactoryResponseDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-response"]');
    expect(container).toBeInTheDocument();
    expect(container!.querySelector('[data-response-stat="total"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-response-stat="unread"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-response-stat="hasMore"]')).toBeInTheDocument();
  },
};

// -- Empty notifications response --

function NotifFactoryEmptyResponseDemo() {
  const response: FakeNotificationsResponse = createFakeEmptyNotificationsResponse();

  return (
    <div className="space-y-4" data-testid="notif-factory-empty-response">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.emptyResponse.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.emptyResponse.description')}
      </p>
      <div className="text-xs" data-notif-empty-response>
        <p data-empty-stat="total">Total: {response.total}</p>
        <p data-empty-stat="unread">Unread: {response.unreadCount}</p>
        <p data-empty-stat="count">Notifications: {response.notifications.length}</p>
      </div>
    </div>
  );
}

export const NotifFactoryEmptyResponse: Story = {
  render: () => <NotifFactoryEmptyResponseDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-empty-response"]');
    expect(container).toBeInTheDocument();
    const totalEl = container!.querySelector('[data-empty-stat="total"]');
    expect(totalEl?.textContent).toContain('0');
    const countEl = container!.querySelector('[data-empty-stat="count"]');
    expect(countEl?.textContent).toContain('0');
  },
};

// -- All unread response --

function NotifFactoryAllUnreadDemo() {
  const response: FakeNotificationsResponse = createFakeAllUnreadNotificationsResponse(4);

  return (
    <div className="space-y-4" data-testid="notif-factory-all-unread">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.allUnread.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.allUnread.description')}
      </p>
      <div className="text-xs" data-notif-unread-response>
        <p data-unread-stat="total">Total: {response.total}</p>
        <p data-unread-stat="unread">Unread: {response.unreadCount}</p>
      </div>
      <Button
        data-sonner-trigger="notif-all-unread"
        onClick={() => {
          response.notifications.forEach((n, i) => {
            setTimeout(() => {
              toast.info(`[Unread] ${n.title}`, { description: n.description });
            }, i * 300);
          });
        }}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showAll')}
      </Button>
    </div>
  );
}

export const NotifFactoryAllUnread: Story = {
  render: () => <NotifFactoryAllUnreadDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-all-unread"]');
    expect(container).toBeInTheDocument();
    const totalEl = container!.querySelector('[data-unread-stat="total"]');
    expect(totalEl?.textContent).toContain('4');
    const unreadEl = container!.querySelector('[data-unread-stat="unread"]');
    expect(unreadEl?.textContent).toContain('4');
  },
};

// -- Notification preferences --

function NotifFactoryPreferencesDemo() {
  const prefs: FakeNotificationPreferences = createFakeNotificationPreferences();

  return (
    <div className="space-y-4" data-testid="notif-factory-preferences">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.preferences.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.preferences.description')}
      </p>
      <div className="space-y-1 text-xs" data-notif-prefs>
        <p data-pref="digest">Digest: {prefs.digest}</p>
        <p data-pref="dnd">DND: {String(prefs.doNotDisturb.enabled)}</p>
        <p data-pref="channels">
          Channels:{' '}
          {Object.entries(prefs.channels)
            .map(([k, v]) => `${k}=${String(v)}`)
            .join(', ')}
        </p>
        <p data-pref="categories">
          Categories:{' '}
          {Object.entries(prefs.categories)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(', ')}
        </p>
      </div>
    </div>
  );
}

export const NotifFactoryPreferences: Story = {
  render: () => <NotifFactoryPreferencesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-preferences"]');
    expect(container).toBeInTheDocument();
    expect(container!.querySelector('[data-pref="digest"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-pref="dnd"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-pref="channels"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-pref="categories"]')).toBeInTheDocument();
  },
};

// -- Notification group --

function NotifFactoryGroupDemo() {
  const { t } = useTranslation();
  const group: FakeNotificationGroup = createFakeNotificationGroup();

  return (
    <div className="space-y-4" data-testid="notif-factory-group">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{t('sonner.notifFactory.group.title')}</p>
      <p className="text-muted-foreground text-sm">{t('sonner.notifFactory.group.description')}</p>
      <div className="text-xs" data-notif-group>
        <p data-group-stat="title">Group: {group.title}</p>
        <p data-group-stat="count">Count: {group.count}</p>
      </div>
      <Button
        data-sonner-trigger="notif-group"
        onClick={() => {
          group.notifications.forEach((n, i) => {
            setTimeout(() => {
              toast.info(`[${group.title}] ${n.title}`, { description: n.description });
            }, i * 300);
          });
        }}
        variant="outline"
      >
        {t('sonner.notifFactory.showAll')}
      </Button>
    </div>
  );
}

export const NotifFactoryGroup: Story = {
  render: () => <NotifFactoryGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-group"]');
    expect(container).toBeInTheDocument();
    expect(container!.querySelector('[data-group-stat="title"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-group-stat="count"]')).toBeInTheDocument();
  },
};

// -- Multiple notification groups --

function NotifFactoryGroupsDemo() {
  const groups: FakeNotificationGroup[] = createFakeNotificationGroups(3);

  return (
    <div className="space-y-4" data-testid="notif-factory-groups">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.groups.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.groups.description')}
      </p>
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.id} className="text-xs" data-notif-group-item={g.id}>
            <span data-group-title>{g.title}</span> ({g.count} notifications)
          </div>
        ))}
      </div>
    </div>
  );
}

export const NotifFactoryGroups: Story = {
  render: () => <NotifFactoryGroupsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-groups"]');
    expect(container).toBeInTheDocument();
    const groupItems = container!.querySelectorAll('[data-notif-group-item]');
    expect(groupItems.length).toBe(3);
  },
};

// -- Notification toast (from notification.factory) --

function NotifFactoryToastDemo() {
  const notifToast: FakeNotifToast = createFakeNotifToast();

  return (
    <div className="space-y-4" data-testid="notif-factory-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.notifToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.notifToast.description')}
      </p>
      <p className="text-xs" data-notif-toast-type={notifToast.type}>
        Type: {notifToast.type} | Dismissable: {String(notifToast.dismissable)}
      </p>
      <Button
        data-sonner-trigger="notif-toast"
        onClick={() => {
          const fnMap: Record<string, typeof toast.info> = {
            error: toast.error,
            info: toast.info,
            success: toast.success,
            warning: toast.warning,
          };
          (fnMap[notifToast.type] ?? toast.info)(notifToast.title, {
            description: notifToast.description,
          });
        }}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showButton')}
      </Button>
    </div>
  );
}

export const NotifFactoryToast: Story = {
  render: () => <NotifFactoryToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-toast"]');
    expect(container).toBeInTheDocument();
    expect(container!.querySelector('[data-notif-toast-type]')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="notif-toast"]');
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-sonner-toast]')).toBeInTheDocument();
      });
    }
  },
};

// -- Multiple notification toasts --

function NotifFactoryToastsDemo() {
  const notifToasts: FakeNotifToast[] = createFakeNotifToasts(4);

  return (
    <div className="space-y-4" data-testid="notif-factory-toasts">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.notifToasts.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.notifToasts.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        {notifToasts.map((nt, i) => (
          <Button
            key={nt.id}
            data-sonner-trigger={`notif-toasts-${i}`}
            onClick={() => toast.info(nt.title, { description: nt.description })}
            variant="outline"
          >
            {nt.title.slice(0, 15)}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const NotifFactoryToasts: Story = {
  render: () => <NotifFactoryToastsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-toasts"]');
    expect(container).toBeInTheDocument();
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(4);
  },
};

// -- Notification toasts with all types --

function NotifFactoryToastsAllTypesDemo() {
  const notifToasts: FakeNotifToast[] = createFakeNotifToastsWithAllTypes();

  return (
    <div className="space-y-4" data-testid="notif-factory-toasts-all-types">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">
        {i18n.t('sonner.notifFactory.notifToastsAllTypes.title')}
      </p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.notifToastsAllTypes.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        {notifToasts.map((nt) => (
          <Button
            key={nt.id}
            data-sonner-trigger={`notif-toast-type-${nt.type}`}
            onClick={() => {
              const fnMap: Record<string, typeof toast.info> = {
                error: toast.error,
                info: toast.info,
                success: toast.success,
                warning: toast.warning,
              };
              (fnMap[nt.type] ?? toast.info)(nt.title, { description: nt.description });
            }}
            variant="outline"
          >
            {nt.type}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const NotifFactoryToastsAllTypes: Story = {
  render: () => <NotifFactoryToastsAllTypesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-toasts-all-types"]');
    expect(container).toBeInTheDocument();
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(NOTIFICATION_TYPES.length);
  },
};

// -- Notification success toast --

function NotifFactorySuccessToastDemo() {
  const notifToast: FakeNotifToast = createFakeNotifSuccessToast();

  return (
    <div className="space-y-4" data-testid="notif-factory-success-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.notifSuccessToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.notifSuccessToast.description')}
      </p>
      <Button
        data-sonner-trigger="notif-success-toast"
        onClick={() => toast.success(notifToast.title, { description: notifToast.description })}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showButton')}
      </Button>
    </div>
  );
}

export const NotifFactorySuccessToast: Story = {
  render: () => <NotifFactorySuccessToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-success-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="notif-success-toast"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-type="success"]')).toBeInTheDocument();
      });
    }
  },
};

// -- Notification error toast --

function NotifFactoryErrorToastDemo() {
  const notifToast: FakeNotifToast = createFakeNotifErrorToast();

  return (
    <div className="space-y-4" data-testid="notif-factory-error-toast">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.notifErrorToast.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.notifErrorToast.description')}
      </p>
      <Button
        data-sonner-trigger="notif-error-toast"
        onClick={() => toast.error(notifToast.title, { description: notifToast.description })}
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showButton')}
      </Button>
    </div>
  );
}

export const NotifFactoryErrorToast: Story = {
  render: () => <NotifFactoryErrorToastDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-error-toast"]');
    expect(container).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-sonner-trigger="notif-error-toast"]');
    expect(trigger).toBeInTheDocument();
    if (trigger instanceof HTMLButtonElement) {
      await userEvent.click(trigger);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-type="error"]')).toBeInTheDocument();
      });
    }
  },
};

// -- Activity --

function NotifFactoryActivityDemo() {
  const activity: FakeActivity = createFakeActivity();

  return (
    <div className="space-y-4" data-testid="notif-factory-activity">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.activity.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.activity.description')}
      </p>
      <div className="text-xs" data-activity-item>
        <p data-activity-user>{activity.user.name}</p>
        <p data-activity-action>
          {activity.action} {activity.target}
        </p>
        <p data-activity-type>Type: {activity.targetType}</p>
      </div>
      <Button
        data-sonner-trigger="notif-activity"
        onClick={() =>
          toast.info(`${activity.user.name} ${activity.action}`, {
            description: `${activity.target} (${activity.targetType})`,
          })
        }
        variant="outline"
      >
        {i18n.t('sonner.notifFactory.showButton')}
      </Button>
    </div>
  );
}

export const NotifFactoryActivity: Story = {
  render: () => <NotifFactoryActivityDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-activity"]');
    expect(container).toBeInTheDocument();
    expect(container!.querySelector('[data-activity-user]')).toBeInTheDocument();
    expect(container!.querySelector('[data-activity-action]')).toBeInTheDocument();
    expect(container!.querySelector('[data-activity-type]')).toBeInTheDocument();
  },
};

// -- Activities --

function NotifFactoryActivitiesDemo() {
  const activities: FakeActivity[] = createFakeActivities(5);

  return (
    <div className="space-y-4" data-testid="notif-factory-activities">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.activities.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.activities.description')}
      </p>
      <div className="space-y-1">
        {activities.map((a) => (
          <div key={a.id} className="text-xs" data-activity-feed-item={a.id}>
            <span>{a.user.name}</span> {a.action} <span>{a.target}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const NotifFactoryActivities: Story = {
  render: () => <NotifFactoryActivitiesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-activities"]');
    expect(container).toBeInTheDocument();
    const items = container!.querySelectorAll('[data-activity-feed-item]');
    expect(items.length).toBe(5);
  },
};

// -- Activity feed --

function NotifFactoryActivityFeedDemo() {
  const feed: FakeActivityFeed = createFakeActivityFeed(6);

  return (
    <div className="space-y-4" data-testid="notif-factory-activity-feed">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.activityFeed.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.activityFeed.description')}
      </p>
      <div className="text-xs" data-feed-stats>
        <p data-feed-stat="total">Total: {feed.total}</p>
        <p data-feed-stat="hasMore">Has More: {String(feed.hasMore)}</p>
      </div>
      <div className="space-y-1">
        {feed.activities.map((a) => (
          <div key={a.id} className="text-xs" data-feed-activity={a.id}>
            {a.user.name} {a.action} {a.target}
          </div>
        ))}
      </div>
    </div>
  );
}

export const NotifFactoryActivityFeed: Story = {
  render: () => <NotifFactoryActivityFeedDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-activity-feed"]');
    expect(container).toBeInTheDocument();
    expect(container!.querySelector('[data-feed-stat="total"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-feed-stat="hasMore"]')).toBeInTheDocument();
    const activities = container!.querySelectorAll('[data-feed-activity]');
    expect(activities.length).toBe(6);
  },
};

// -- Type x Priority Matrix --

function NotifFactoryTypePriorityMatrixDemo() {
  const matrix: FakeNotification[][] = createFakeNotificationTypePriorityMatrix();

  return (
    <div className="space-y-4" data-testid="notif-factory-type-priority-matrix">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">
        {i18n.t('sonner.notifFactory.typePriorityMatrix.title')}
      </p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.typePriorityMatrix.description')}
      </p>
      <div className="space-y-2">
        {matrix.map((row, ri) => (
          <div key={NOTIFICATION_TYPES[ri]} className="flex gap-1">
            {row.map((n) => (
              <span
                key={n.id}
                className="bg-muted rounded px-2 py-0.5 text-xs"
                data-matrix-cell={`${n.type}-${n.priority}`}
              >
                {n.type}/{n.priority}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const NotifFactoryTypePriorityMatrix: Story = {
  render: () => <NotifFactoryTypePriorityMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector(
      '[data-testid="notif-factory-type-priority-matrix"]'
    );
    expect(container).toBeInTheDocument();
    const cells = container!.querySelectorAll('[data-matrix-cell]');
    expect(cells.length).toBe(NOTIFICATION_TYPES.length * NOTIFICATION_PRIORITIES.length);
  },
};

// -- Type x Category Matrix --

function NotifFactoryTypeCategoryMatrixDemo() {
  const matrix: FakeNotification[][] = createFakeNotificationTypeCategoryMatrix();

  return (
    <div className="space-y-4" data-testid="notif-factory-type-category-matrix">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">
        {i18n.t('sonner.notifFactory.typeCategoryMatrix.title')}
      </p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.typeCategoryMatrix.description')}
      </p>
      <div className="space-y-2">
        {matrix.map((row, ri) => (
          <div key={NOTIFICATION_TYPES[ri]} className="flex flex-wrap gap-1">
            {row.map((n) => (
              <span
                key={n.id}
                className="bg-muted rounded px-2 py-0.5 text-xs"
                data-tc-cell={`${n.type}-${n.category}`}
              >
                {n.type}/{n.category}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const NotifFactoryTypeCategoryMatrix: Story = {
  render: () => <NotifFactoryTypeCategoryMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector(
      '[data-testid="notif-factory-type-category-matrix"]'
    );
    expect(container).toBeInTheDocument();
    const cells = container!.querySelectorAll('[data-tc-cell]');
    expect(cells.length).toBe(NOTIFICATION_TYPES.length * NOTIFICATION_CATEGORIES.length);
  },
};

// -- Channel x Status Matrix --

function NotifFactoryChannelStatusMatrixDemo() {
  const matrix: FakeNotification[][] = createFakeNotificationChannelStatusMatrix();

  return (
    <div className="space-y-4" data-testid="notif-factory-channel-status-matrix">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">
        {i18n.t('sonner.notifFactory.channelStatusMatrix.title')}
      </p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.channelStatusMatrix.description')}
      </p>
      <div className="space-y-2">
        {matrix.map((row, ri) => (
          <div key={NOTIFICATION_CHANNELS[ri]} className="flex flex-wrap gap-1">
            {row.map((n) => (
              <span
                key={n.id}
                className="bg-muted rounded px-2 py-0.5 text-xs"
                data-cs-cell={`${n.channel}-${n.status}`}
              >
                {n.channel}/{n.status}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const NotifFactoryChannelStatusMatrix: Story = {
  render: () => <NotifFactoryChannelStatusMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector(
      '[data-testid="notif-factory-channel-status-matrix"]'
    );
    expect(container).toBeInTheDocument();
    const cells = container!.querySelectorAll('[data-cs-cell]');
    expect(cells.length).toBe(NOTIFICATION_CHANNELS.length * NOTIFICATION_STATUSES.length);
  },
};

// -- Enterprise notification set --

function NotifFactoryEnterpriseSetDemo() {
  const set: FakeNotification[] = createFakeEnterpriseNotificationSet();

  return (
    <div className="space-y-4" data-testid="notif-factory-enterprise-set">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.enterpriseSet.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.enterpriseSet.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        {set.map((n, i) => (
          <Button
            key={n.id}
            data-sonner-trigger={`enterprise-${i}`}
            onClick={() => {
              const fnMap: Record<string, typeof toast.info> = {
                error: toast.error,
                info: toast.info,
                success: toast.success,
                warning: toast.warning,
              };
              (fnMap[n.type] ?? toast.info)(n.title, { description: n.description });
            }}
            variant="outline"
          >
            {n.type}/{n.category}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const NotifFactoryEnterpriseSet: Story = {
  render: () => <NotifFactoryEnterpriseSetDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-enterprise-set"]');
    expect(container).toBeInTheDocument();
    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(8);
    if (buttons[0] instanceof HTMLButtonElement) {
      await userEvent.click(buttons[0]);
      await waitFor(() => {
        const toaster = canvasElement.querySelector('[data-sonner-toaster]');
        expect(toaster?.querySelector('[data-sonner-toast]')).toBeInTheDocument();
      });
    }
  },
};

// -- Notification showcase --

function NotifFactoryShowcaseDemo() {
  const showcase = createFakeNotificationShowcase();

  return (
    <div className="space-y-6" data-testid="notif-factory-showcase">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.showcase.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.showcase.description')}
      </p>

      <div className="space-y-2">
        <p className="text-xs font-medium" data-showcase-section="types">
          Types ({showcase.allTypes.length})
        </p>
        <div className="flex flex-wrap gap-1">
          {showcase.allTypes.map((n: FakeNotification) => (
            <span key={n.id} className="bg-muted rounded px-2 py-0.5 text-xs" data-showcase-type>
              {n.type}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium" data-showcase-section="priorities">
          Priorities ({showcase.allPriorities.length})
        </p>
        <div className="flex flex-wrap gap-1">
          {showcase.allPriorities.map((n: FakeNotification) => (
            <span
              key={n.id}
              className="bg-muted rounded px-2 py-0.5 text-xs"
              data-showcase-priority
            >
              {n.priority}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium" data-showcase-section="categories">
          Categories ({showcase.allCategories.length})
        </p>
        <div className="flex flex-wrap gap-1">
          {showcase.allCategories.map((n: FakeNotification) => (
            <span
              key={n.id}
              className="bg-muted rounded px-2 py-0.5 text-xs"
              data-showcase-category
            >
              {n.category}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium" data-showcase-section="toasts">
          Toasts ({showcase.toasts.length})
        </p>
        <p className="text-xs font-medium" data-showcase-section="activities">
          Activities ({showcase.activities.length})
        </p>
        <p className="text-xs font-medium" data-showcase-section="preferences">
          Preferences: digest={showcase.preferences.digest}
        </p>
        <p className="text-xs font-medium" data-showcase-section="response">
          Response: total={showcase.response.total}, unread={showcase.response.unreadCount}
        </p>
      </div>
    </div>
  );
}

export const NotifFactoryShowcase: Story = {
  render: () => <NotifFactoryShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-showcase"]');
    expect(container).toBeInTheDocument();
    expect(container!.querySelector('[data-showcase-section="types"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-showcase-section="priorities"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-showcase-section="categories"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-showcase-section="toasts"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-showcase-section="activities"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-showcase-section="preferences"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-showcase-section="response"]')).toBeInTheDocument();
    const types = container!.querySelectorAll('[data-showcase-type]');
    expect(types.length).toBe(NOTIFICATION_TYPES.length);
    const priorities = container!.querySelectorAll('[data-showcase-priority]');
    expect(priorities.length).toBe(NOTIFICATION_PRIORITIES.length);
    const categories = container!.querySelectorAll('[data-showcase-category]');
    expect(categories.length).toBe(NOTIFICATION_CATEGORIES.length);
  },
};

// -- Notification constants & types --

function NotifFactoryConstantsDemo() {
  const allTypes: NotificationType[] = NOTIFICATION_TYPES;
  const allPriorities: NotificationPriority[] = NOTIFICATION_PRIORITIES;
  const allCategories: NotificationCategory[] = NOTIFICATION_CATEGORIES;
  const allChannels: NotificationChannel[] = NOTIFICATION_CHANNELS;
  const allStatuses: NotificationStatus[] = NOTIFICATION_STATUSES;
  const toastPositions = NOTIF_TOAST_POSITIONS;
  const titles = NOTIFICATION_TITLES;
  const activityActions = ACTIVITY_ACTIONS;
  const activityTargets = ACTIVITY_TARGETS;

  return (
    <div className="space-y-4" data-testid="notif-factory-constants">
      <Toaster position="top-center" richColors />
      <p className="text-sm font-medium">{i18n.t('sonner.notifFactory.constants.title')}</p>
      <p className="text-muted-foreground text-sm">
        {i18n.t('sonner.notifFactory.constants.description')}
      </p>

      <div className="space-y-2 text-xs">
        <p data-notif-const="types">Types: {allTypes.join(', ')}</p>
        <p data-notif-const="priorities">Priorities: {allPriorities.join(', ')}</p>
        <p data-notif-const="categories">Categories: {allCategories.join(', ')}</p>
        <p data-notif-const="channels">Channels: {allChannels.join(', ')}</p>
        <p data-notif-const="statuses">Statuses: {allStatuses.join(', ')}</p>
        <p data-notif-const="toast-positions">Toast Positions: {toastPositions.join(', ')}</p>
        <p data-notif-const="titles">
          Titles ({titles.length}): {titles.slice(0, 3).join(', ')}...
        </p>
        <p data-notif-const="activity-actions">
          Activity Actions ({activityActions.length}): {activityActions.slice(0, 3).join(', ')}...
        </p>
        <p data-notif-const="activity-targets">
          Activity Targets ({activityTargets.length}): {activityTargets.slice(0, 3).join(', ')}...
        </p>
      </div>
    </div>
  );
}

export const NotifFactoryConstants: Story = {
  render: () => <NotifFactoryConstantsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="notif-factory-constants"]');
    expect(container).toBeInTheDocument();
    expect(container!.querySelector('[data-notif-const="types"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-notif-const="priorities"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-notif-const="categories"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-notif-const="channels"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-notif-const="statuses"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-notif-const="toast-positions"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-notif-const="titles"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-notif-const="activity-actions"]')).toBeInTheDocument();
    expect(container!.querySelector('[data-notif-const="activity-targets"]')).toBeInTheDocument();

    // Verify content includes expected values
    const typesEl = container!.querySelector('[data-notif-const="types"]');
    expect(typesEl?.textContent).toContain('info');
    expect(typesEl?.textContent).toContain('error');

    const channelsEl = container!.querySelector('[data-notif-const="channels"]');
    expect(channelsEl?.textContent).toContain('email');
    expect(channelsEl?.textContent).toContain('push');
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('sonner.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('sonner.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('sonner.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('sonner.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   conflict
//   history
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('sonner.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: sonnerStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('sonner.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: sonnerStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
