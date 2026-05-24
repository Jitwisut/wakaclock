import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { alertHandlers, alertStatusHandlers } from '@/.storybook/stories/_handlers/alert.handlers';
import type {
  AlertAnimation,
  AlertIconType,
  AlertPosition,
  AlertSize,
  AlertType,
  AlertVariant,
  FakeAlert,
  FakeAlertAction,
  FakeAlertConfig,
  FakeAlertWithActions,
} from '@/.storybook/stories/_factories/alert.factory';
import {
  ALERT_ANIMATIONS,
  ALERT_DESCRIPTIONS,
  ALERT_ICONS,
  ALERT_POSITIONS,
  ALERT_SIZES,
  ALERT_TITLES,
  ALERT_TYPES,
  ALERT_VARIANTS,
  AUTO_CLOSE_DURATIONS,
  createFakeAccessibleAlert,
  createFakeAlert,
  createFakeAlertConfig,
  createFakeAlertMatrix,
  createFakeAlerts,
  createFakeAlertsBySizes,
  createFakeAlertsByType,
  createFakeAlertsByVariant,
  createFakeAlertTypeMatrix,
  createFakeAlertWithActions,
  createFakeAutoCloseAlert,
  createFakeCompactAlert,
  createFakeDismissibleAlert,
  createFakeEnterpriseAlertSet,
  createFakeErrorAlert,
  createFakeFullWidthAlert,
  createFakeHighPriorityAlert,
  createFakeInfoAlert,
  createFakeSuccessAlert,
  createFakeSystemAlert,
  createFakeToastAlert,
  createFakeWarningAlert,
} from '@/.storybook/stories/_factories/alert.factory';

import { useEffect, useState } from 'react';
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  Loader2Icon,
  XIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============ I18N WRAPPER COMPONENTS ============

function I18nAlert({ variant }: { variant: AlertVariant }) {
  const { t } = useTranslation();

  const titleKey = variant === 'destructive' ? 'alert.destructive.title' : 'alert.default.title';
  const descriptionKey =
    variant === 'destructive' ? 'alert.destructive.description' : 'alert.default.description';

  return (
    <Alert className="w-[460px]" variant={variant}>
      <AlertCircleIcon />
      <AlertTitle>{t(titleKey)}</AlertTitle>
      <AlertDescription>{t(descriptionKey)}</AlertDescription>
    </Alert>
  );
}

function I18nAlertPlayground({ variant }: { variant: AlertVariant }) {
  return (
    <Alert className="w-[460px]" variant={variant} data-testid="playground-alert">
      <AlertCircleIcon />
      <AlertTitle />
      <AlertDescription />
    </Alert>
  );
}

// ============ DISMISSIBLE ALERT COMPONENTS ============

function DismissibleAlert({
  title,
  description,
  variant = 'default',
  icon,
  onDismiss,
}: {
  description: string;
  icon?: React.ReactNode;
  onDismiss?: () => void;
  title: string;
  variant?: AlertVariant;
}) {
  const [visible, setVisible] = useState(true);
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = async () => {
    setDismissing(true);
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  return (
    <Alert className="relative w-[460px]" variant={variant} data-testid="dismissible-alert">
      {icon || <AlertCircleIcon />}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      <button
        type="button"
        className="hover:bg-muted absolute top-2 right-2 rounded-full p-1 transition-colors"
        onClick={handleDismiss}
        disabled={dismissing}
        aria-label={i18n.t('alert.story.dismissAlert', 'Dismiss alert')}
        data-testid="dismiss-button"
      >
        {dismissing ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <XIcon className="size-4" />
        )}
      </button>
    </Alert>
  );
}

// ============ ASYNC ALERTS COMPONENT ============

function AsyncAlerts({
  endpoint = '/api/alerts',
  limit = 5,
}: {
  endpoint?: string;
  limit?: number;
}) {
  const { t } = useTranslation();

  const [alerts, setAlerts] = useState<
    Array<{
      description: string;
      dismissible: boolean;
      id: string;
      title: string;
      variant: AlertVariant;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAlerts() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${endpoint}?limit=${limit}`);

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data = (await response.json()) as {
          alerts?: Array<{
            description: string;
            dismissible: boolean;
            id: string;
            title: string;
            variant: AlertVariant;
          }>;
        };
        if (!cancelled) {
          setAlerts(data.alerts || []);
        }
      } catch (error_) {
        if (!cancelled) {
          setError(error_ instanceof Error ? error_.message : 'Failed to fetch alerts');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchAlerts();
    return () => {
      cancelled = true;
    };
  }, [endpoint, limit]);

  const handleDismiss = async (id: string) => {
    try {
      const response = await fetch(`/api/alerts/${id}/dismiss`, { method: 'POST' });
      if (response.ok) {
        setAlerts((prev) => prev.filter((alert) => alert.id !== id));
      }
    } catch {
      // Handle error silently for demo
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2" data-testid="loading-state">
        <Loader2Icon className="size-4 animate-spin" />
        <span className="text-muted-foreground text-sm">
          {t('alert.story.loadingAlerts', 'Loading alerts...')}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive text-sm" data-testid="error-state">
        Error: {error}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-muted-foreground text-sm" data-testid="empty-state">
        {i18n.t('alert.story.noAlertsFound', 'No alerts found.')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="alerts-container">
      {alerts.map((alert) => (
        <DismissibleAlert
          key={alert.id}
          title={alert.title}
          description={alert.description}
          variant={alert.variant}
          onDismiss={() => handleDismiss(alert.id)}
        />
      ))}
    </div>
  );
}

// ============ DEMO COMPONENTS ============

function AlertVariantsDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{t('alert.variants.default')}</p>
        <Alert className="w-[460px]">
          <AlertCircleIcon />
          <AlertTitle>{t('alert.default.title')}</AlertTitle>
          <AlertDescription>{t('alert.variants.defaultDescription')}</AlertDescription>
        </Alert>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('alert.variants.destructive')}</p>
        <Alert className="w-[460px]" variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t('alert.variants.errorTitle')}</AlertTitle>
          <AlertDescription>{t('alert.variants.errorDescription')}</AlertDescription>
        </Alert>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('alert.variants.success')}</p>
        <Alert className="w-[460px] border-green-500 bg-green-50 text-green-900 dark:border-green-600 dark:bg-green-950 dark:text-green-100">
          <CheckCircleIcon className="text-green-600 dark:text-green-400" />
          <AlertTitle>{t('alert.variants.successTitle')}</AlertTitle>
          <AlertDescription>{t('alert.variants.successDescription')}</AlertDescription>
        </Alert>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('alert.variants.warning')}</p>
        <Alert className="w-[460px] border-yellow-500 bg-yellow-50 text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-100">
          <AlertTriangleIcon className="text-yellow-600 dark:text-yellow-400" />
          <AlertTitle>{t('alert.variants.warningTitle')}</AlertTitle>
          <AlertDescription>{t('alert.variants.warningDescription')}</AlertDescription>
        </Alert>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('alert.variants.info')}</p>
        <Alert className="w-[460px] border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-100">
          <InfoIcon className="text-blue-600 dark:text-blue-400" />
          <AlertTitle>{t('alert.variants.infoTitle')}</AlertTitle>
          <AlertDescription>{t('alert.variants.infoDescription')}</AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

function AlertSizesDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{t('alert.sizes.compact')}</p>
        <Alert className="w-[360px] py-2">
          <AlertTitle className="mb-0 text-sm">{t('alert.sizes.quickNotice')}</AlertTitle>
        </Alert>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('alert.sizes.default')}</p>
        <Alert className="w-[460px]">
          <AlertCircleIcon />
          <AlertTitle>{t('alert.default.title')}</AlertTitle>
          <AlertDescription>{t('alert.sizes.standardDescription')}</AlertDescription>
        </Alert>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('alert.sizes.withIcon')}</p>
        <Alert className="w-[460px]">
          <AlertCircleIcon />
          <AlertTitle>{t('alert.sizes.iconNoDescription')}</AlertTitle>
        </Alert>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('alert.sizes.fullWidth')}</p>
        <Alert className="w-full">
          <AlertCircleIcon />
          <AlertTitle>{t('alert.sizes.fullWidthTitle')}</AlertTitle>
          <AlertDescription>{t('alert.sizes.fullWidthDescription')}</AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

function KeyboardInteractionDemo() {
  const { t } = useTranslation();
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('alert.story.tabToFocus')}</p>
      <div className="flex flex-col gap-3">
        <Alert
          className="w-[460px]"
          tabIndex={0}
          onFocus={() => setFocusedIndex(0)}
          onBlur={() => setFocusedIndex(null)}
          data-testid="focusable-alert-1"
        >
          <AlertCircleIcon />
          <AlertTitle>
            {i18n.t('alert.story.firstAlert', 'First Alert')} {focusedIndex === 0 && '(focused)'}
          </AlertTitle>
          <AlertDescription>
            {t(
              'alert.story.pressTabToNavigateBetweenAlerts',
              'Press Tab to navigate between alerts.'
            )}
          </AlertDescription>
        </Alert>
        <Alert
          className="w-[460px]"
          tabIndex={0}
          onFocus={() => setFocusedIndex(1)}
          onBlur={() => setFocusedIndex(null)}
          data-testid="focusable-alert-2"
        >
          <AlertCircleIcon />
          <AlertTitle>
            {i18n.t('alert.story.secondAlert', 'Second Alert')} {focusedIndex === 1 && '(focused)'}
          </AlertTitle>
          <AlertDescription>
            {t('alert.story.alertsCanBeKeyboardNavigable', 'Alerts can be keyboard navigable.')}
          </AlertDescription>
        </Alert>
        <DismissibleAlert
          title={i18n.t('alert.story.dismissibleAlert', 'Dismissible Alert')}
          description={i18n.t(
            'alert.story.pressTabToDismiss',
            'Press Tab to focus the dismiss button, then Enter or Space to dismiss.'
          )}
        />
      </div>
    </div>
  );
}

function DataAttributesDemo() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'alert.story.dataAttributesDescription',
          'All alerts expose data-* attributes for CSS targeting and testing'
        )}
      </p>
      <div className="flex flex-col gap-3">
        <Alert className="w-[460px]" data-testid="attr-default">
          <AlertCircleIcon />
          <AlertTitle>{i18n.t('alert.story.defaultAlert', 'Default Alert')}</AlertTitle>
          <AlertDescription>
            data-slot=&quot;alert&quot; data-variant=&quot;default&quot;
          </AlertDescription>
        </Alert>
        <Alert className="w-[460px]" variant="destructive" data-testid="attr-destructive">
          <AlertCircleIcon />
          <AlertTitle>{i18n.t('alert.story.destructiveAlert', 'Destructive Alert')}</AlertTitle>

          <AlertDescription>
            data-slot=&quot;alert&quot; data-variant=&quot;destructive&quot;
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

function AllTypesDemo() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'alert.story.allTypesDescription',
          'All semantic alert types with appropriate icons and styling'
        )}
      </p>
      <div className="flex flex-col gap-3">
        <Alert className="w-[460px]">
          <InfoIcon />
          <AlertTitle>{i18n.t('alert.story.information', 'Information')}</AlertTitle>
          <AlertDescription>
            {i18n.t(
              'alert.story.thisIsAnInformationalMessage',
              'This is an informational message.'
            )}
          </AlertDescription>
        </Alert>
        <Alert className="w-[460px] border-green-500 bg-green-50 text-green-900 dark:border-green-600 dark:bg-green-950 dark:text-green-100">
          <CheckCircleIcon className="text-green-600 dark:text-green-400" />
          <AlertTitle>{i18n.t('alert.story.success', 'Success')}</AlertTitle>
          <AlertDescription>
            {i18n.t(
              'alert.story.operationCompletedSuccessfully',
              'Operation completed successfully.'
            )}
          </AlertDescription>
        </Alert>
        <Alert className="w-[460px] border-yellow-500 bg-yellow-50 text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-100">
          <AlertTriangleIcon className="text-yellow-600 dark:text-yellow-400" />
          <AlertTitle>{i18n.t('alert.story.warning', 'Warning')}</AlertTitle>
          <AlertDescription>
            {i18n.t('alert.story.pleaseProceedWithCaution', 'Please proceed with caution.')}
          </AlertDescription>
        </Alert>
        <Alert className="w-[460px]" variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{i18n.t('alert.story.error', 'Error')}</AlertTitle>
          <AlertDescription>
            {i18n.t('alert.story.somethingWentWrong', 'Something went wrong.')}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

// ============ META CONFIGURATION ============

const meta = {
  title: 'Components/UI/Alert',
  component: Alert,
  tags: ['autodocs'],
  args: {
    variant: 'default',
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // Appearance
    variant: {
      control: 'select',
      options: ['default', 'destructive'],
      description: i18n.t('alert.argType.visualVariantOfTheAlert', 'Visual variant of the alert'),
      table: {
        category: 'Appearance',
        type: { summary: "'default' | 'destructive'" },
        defaultValue: { summary: 'default' },
      },
    },
    className: {
      control: 'text',
      description: i18n.t('alert.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // Content
    children: {
      control: false,
      description: i18n.t(
        'alert.argType.alertContentIncludingIconTitleDescription',
        'Alert content including icon, title, description'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    // Testing
    testId: {
      control: 'text',
      description: i18n.t('alert.argType.customTestIdForTesting', 'Custom test ID for testing'),
      table: {
        category: 'Testing',
        type: { summary: 'string' },
        defaultValue: { summary: 'alert' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('alert.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('alert.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('alert.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('alert.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('alert.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('alert.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('alert.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
  },
  parameters: {
    msw: { handlers: alertHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============ CORE STORIES ============

export const Playground: Story = {
  render: (args) => <I18nAlertPlayground variant={args.variant ?? 'default'} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByTestId('playground-alert');
    expect(alert).toBeInTheDocument();
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.getAttribute('data-slot')).toBe('alert');
  },
};

export const Default: Story = {
  render: (args) => <I18nAlert variant={args.variant ?? 'default'} />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    const alert = canvas.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.getAttribute('data-slot')).toBe('alert');

    const title = alert.querySelector('[data-slot="alert-title"]');
    if (!(title instanceof HTMLElement)) {
      throw new Error('Alert title was not rendered.');
    }
    expect(title.textContent?.trim()).toBe('Heads up!');

    const description = alert.querySelector('[data-slot="alert-description"]');
    if (!(description instanceof HTMLElement)) {
      throw new Error('Alert description was not rendered.');
    }
    expect(description.textContent).toContain(
      'This is an alert. It supports an optional icon, title, and description.'
    );
  },
};

export const Destructive: Story = {
  args: { variant: 'destructive' },
  render: (args) => <I18nAlert variant={args.variant ?? 'default'} />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');

    // Verify variant attribute
    expect(alert.getAttribute('data-variant')).toBe('destructive');

    // Verify aria-live is assertive for destructive alerts
    expect(alert.getAttribute('aria-live')).toBe('assertive');

    const title = alert.querySelector('[data-slot="alert-title"]');
    if (!(title instanceof HTMLElement)) {
      throw new Error('Alert title was not rendered.');
    }

    expect(title.textContent?.trim()).toBe('Something went wrong');
  },
};

export const Variants: Story = {
  render: () => <AlertVariantsDemo />,
  play: async ({ canvasElement }) => {
    const alerts = canvasElement.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(5);
  },
};

export const Sizes: Story = {
  render: () => <AlertSizesDemo />,
  play: async ({ canvasElement }) => {
    const alerts = canvasElement.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(4);
  },
};

export const AllTypes: Story = {
  name: i18n.t('alert.storyName.allTypes', 'All Semantic Types'),
  render: () => <AllTypesDemo />,
  play: async ({ canvasElement }) => {
    const alerts = canvasElement.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(4);
  },
};

// ============ DATA ATTRIBUTES STORIES ============

export const DataAttributes: Story = {
  name: i18n.t('alert.storyName.dataAttributes', 'Data Attributes'),
  render: () => <DataAttributesDemo />,
  play: async ({ canvasElement }) => {
    const defaultAlert = canvasElement.querySelector('[data-testid="attr-default"]');
    const destructiveAlert = canvasElement.querySelector('[data-testid="attr-destructive"]');

    // Verify data-slot
    expect(defaultAlert?.getAttribute('data-slot')).toBe('alert');
    expect(destructiveAlert?.getAttribute('data-slot')).toBe('alert');

    // Verify data-variant
    expect(defaultAlert?.getAttribute('data-variant')).toBeNull(); // default variant may not set attribute
    expect(destructiveAlert?.getAttribute('data-variant')).toBe('destructive');

    // Verify role
    expect(defaultAlert?.getAttribute('role')).toBe('alert');
    expect(destructiveAlert?.getAttribute('role')).toBe('alert');
  },
};

// ============ DISMISSIBLE STORIES ============

export const DismissibleBasic: Story = {
  name: i18n.t('alert.storyName.dismissibleBasic', 'Dismissible: Basic'),
  render: () => (
    <DismissibleAlert
      title={i18n.t('alert.story.notification', 'Notification')}
      description={i18n.t(
        'alert.story.dismissDescription',
        'This alert can be dismissed by clicking the X button.'
      )}
      onDismiss={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify alert is present
    const alert = canvas.getByTestId('dismissible-alert');
    expect(alert).toBeInTheDocument();

    // Verify dismiss button is present
    const dismissButton = canvas.getByTestId('dismiss-button');
    expect(dismissButton).toBeInTheDocument();
    expect(dismissButton.getAttribute('aria-label')).toBe('Dismiss alert');
  },
};

export const DismissibleWithAction: Story = {
  name: i18n.t('alert.storyName.dismissibleWithAction', 'Dismissible: With Action'),
  render: () => {
    const onDismiss = fn();
    return (
      <div className="flex flex-col gap-4">
        <DismissibleAlert
          title={i18n.t('alert.story.infoAlert', 'Info Alert')}
          description={i18n.t(
            'alert.story.clickToDismissInfo',
            'Click the X to dismiss this informational alert.'
          )}
          onDismiss={onDismiss}
        />
        <DismissibleAlert
          title={i18n.t('alert.story.errorAlert', 'Error Alert')}
          description={i18n.t(
            'alert.story.destructiveCanDismiss',
            'This destructive alert can also be dismissed.'
          )}
          variant="destructive"
          onDismiss={onDismiss}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify both alerts are present
    const alerts = canvas.getAllByTestId('dismissible-alert');
    expect(alerts.length).toBe(2);

    // Dismiss the first alert
    const dismissButtons = canvas.getAllByTestId('dismiss-button');
    await userEvent.click(dismissButtons[0]);

    // Wait for dismiss animation
    await waitFor(() => {
      const remainingAlerts = canvas.getAllByTestId('dismissible-alert');
      expect(remainingAlerts.length).toBe(1);
    });
  },
};

export const DismissibleAllVariants: Story = {
  name: i18n.t('alert.storyName.dismissibleAllVariants', 'Dismissible: All Variants'),
  render: () => {
    const onDismiss = fn();
    return (
      <div className="flex flex-col gap-4">
        <DismissibleAlert
          title={i18n.t('alert.story.defaultAlertTitle', 'Default Alert')}
          description={i18n.t('alert.story.dismissibleDefaultDesc', 'A dismissible default alert.')}
          variant="default"
          icon={<AlertCircleIcon />}
          onDismiss={onDismiss}
        />
        <DismissibleAlert
          title={i18n.t('alert.story.destructiveAlertTitle', 'Destructive Alert')}
          description={i18n.t(
            'alert.story.dismissibleDestructiveDesc',
            'A dismissible destructive alert for errors.'
          )}
          variant="destructive"
          icon={<AlertCircleIcon />}
          onDismiss={onDismiss}
        />
        <Alert className="relative w-[460px] border-green-500 bg-green-50 text-green-900 dark:border-green-600 dark:bg-green-950 dark:text-green-100">
          <CheckCircleIcon className="text-green-600 dark:text-green-400" />
          <AlertTitle>{i18n.t('alert.story.successAlert', 'Success Alert')}</AlertTitle>
          <AlertDescription>
            {i18n.t('alert.story.successCustomStyling', 'A success alert with custom styling.')}
          </AlertDescription>
          <button
            type="button"
            className="absolute top-2 right-2 rounded-full p-1 transition-colors hover:bg-green-200 dark:hover:bg-green-800"
            aria-label={i18n.t('alert.story.dismissAlert', 'Dismiss alert')}
          >
            <XIcon className="size-4" />
          </button>
        </Alert>
        <Alert className="relative w-[460px] border-yellow-500 bg-yellow-50 text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-100">
          <AlertTriangleIcon className="text-yellow-600 dark:text-yellow-400" />
          <AlertTitle>{i18n.t('alert.story.warningAlert', 'Warning Alert')}</AlertTitle>
          <AlertDescription>
            {i18n.t('alert.story.warningCustomStyling', 'A warning alert with custom styling.')}
          </AlertDescription>

          <button
            type="button"
            className="absolute top-2 right-2 rounded-full p-1 transition-colors hover:bg-yellow-200 dark:hover:bg-yellow-800"
            aria-label={i18n.t('alert.story.dismissAlert', 'Dismiss alert')}
          >
            <XIcon className="size-4" />
          </button>
        </Alert>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const dismissButtons = canvasElement.querySelectorAll('[aria-label="Dismiss alert"]');
    expect(dismissButtons.length).toBe(4);
  },
};

export const DismissibleAnimated: Story = {
  name: i18n.t('alert.storyName.dismissibleAnimated', 'Dismissible: Animated'),
  render: () => {
    const AnimatedDismissibleAlert = () => {
      const [visible, setVisible] = useState(true);
      const [exiting, setExiting] = useState(false);

      const handleDismiss = () => {
        setExiting(true);
        setTimeout(() => setVisible(false), 300);
      };

      if (!visible) {
        return (
          <button
            type="button"
            className="text-primary text-sm underline"
            onClick={() => {
              setVisible(true);
              setExiting(false);
            }}
          >
            {i18n.t('alert.story.showAlertAgain', 'Show alert again')}
          </button>
        );
      }

      return (
        <Alert
          className={`relative w-[460px] transition-all duration-300 ${
            exiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
          }`}
          data-testid="animated-alert"
        >
          <AlertCircleIcon />
          <AlertTitle>{i18n.t('alert.story.animatedDismissal', 'Animated Dismissal')}</AlertTitle>
          <AlertDescription>
            {i18n.t(
              'alert.story.thisAlertSlidesOutWhenDismissed',
              'This alert slides out when dismissed.'
            )}
          </AlertDescription>
          <button
            type="button"
            className="hover:bg-muted absolute top-2 right-2 rounded-full p-1 transition-colors"
            onClick={handleDismiss}
            aria-label={i18n.t('alert.story.dismissAlert', 'Dismiss alert')}
            data-testid="dismiss-animated"
          >
            <XIcon className="size-4" />
          </button>
        </Alert>
      );
    };

    return <AnimatedDismissibleAlert />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify alert is present
    const alert = canvas.getByTestId('animated-alert');
    expect(alert).toBeInTheDocument();

    // Click dismiss
    const dismissButton = canvas.getByTestId('dismiss-animated');
    await userEvent.click(dismissButton);

    // Wait for animation and verify alert is gone
    await waitFor(
      () => {
        expect(canvas.queryByTestId('animated-alert')).not.toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Verify "show again" button appears
    expect(canvas.getByText('Show alert again')).toBeInTheDocument();
  },
};

export const DismissibleAutoClose: Story = {
  name: i18n.t('alert.storyName.dismissibleAutoClose', 'Dismissible: Auto Close'),
  render: () => {
    const AutoCloseAlert = ({ duration = 5000 }: { duration?: number }) => {
      const [visible, setVisible] = useState(true);
      const [progress, setProgress] = useState(100);

      useEffect(() => {
        if (!visible) return;

        const interval = setInterval(() => {
          setProgress((prev) => {
            const newProgress = prev - 100 / (duration / 100);
            if (newProgress <= 0) {
              setVisible(false);
              return 0;
            }
            return newProgress;
          });
        }, 100);

        return () => clearInterval(interval);
      }, [visible, duration]);

      if (!visible) {
        return (
          <div className="text-muted-foreground text-sm" data-testid="alert-dismissed">
            {i18n.t(
              'alert.story.alertAutoDismissed',
              'Alert was automatically dismissed after {{seconds}} seconds.',
              { seconds: duration / 1000 }
            )}
          </div>
        );
      }

      return (
        <div className="relative" data-testid="auto-close-alert">
          <Alert className="w-[460px] overflow-hidden">
            <AlertCircleIcon />
            <AlertTitle>{i18n.t('alert.story.autoClosingAlert', 'Auto-closing Alert')}</AlertTitle>
            <AlertDescription>
              {i18n.t(
                'alert.story.alertWillCloseIn',
                'This alert will close in {{seconds}} seconds.',
                { seconds: Math.ceil(progress / 20) }
              )}
            </AlertDescription>
            <button
              type="button"
              className="hover:bg-muted absolute top-2 right-2 rounded-full p-1 transition-colors"
              onClick={() => setVisible(false)}
              aria-label={i18n.t('alert.story.dismissAlert', 'Dismiss alert')}
            >
              <XIcon className="size-4" />
            </button>
            <div
              className="bg-primary/20 absolute bottom-0 left-0 h-1 transition-all duration-100"
              style={{ width: `${progress}%` }}
              data-testid="progress-bar"
            />
          </Alert>
        </div>
      );
    };

    return <AutoCloseAlert duration={5000} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify alert is present with progress bar
    const alert = canvas.getByTestId('auto-close-alert');
    expect(alert).toBeInTheDocument();

    const progressBar = canvas.getByTestId('progress-bar');
    expect(progressBar).toBeInTheDocument();
  },
};

// ============ KEYBOARD INTERACTION STORIES ============

export const KeyboardInteraction: Story = {
  name: i18n.t('alert.storyName.keyboardInteraction', 'Keyboard Interaction'),
  render: () => <KeyboardInteractionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Tab to first focusable alert
    await userEvent.tab();
    const firstAlert = canvas.getByTestId('focusable-alert-1');
    expect(firstAlert).toHaveFocus();

    // Tab to second alert
    await userEvent.tab();
    const secondAlert = canvas.getByTestId('focusable-alert-2');
    expect(secondAlert).toHaveFocus();

    // Tab to dismiss button
    await userEvent.tab();
    const dismissButton = canvas.getByTestId('dismiss-button');
    expect(dismissButton).toHaveFocus();

    // Activate dismiss with keyboard
    await userEvent.keyboard('{Enter}');

    // Verify alert was dismissed
    await waitFor(() => {
      expect(canvas.queryByTestId('dismissible-alert')).not.toBeInTheDocument();
    });
  },
};

// ============ FAKER DATA STORIES ============

export const WithFakerData: Story = {
  name: i18n.t('alert.storyName.withFakerData', 'With Faker Data'),
  render: () => {
    const alerts = createFakeAlerts(4);
    return (
      <div className="flex flex-col gap-4">
        {alerts.map((alert) => (
          <DismissibleAlert
            key={alert.id}
            title={alert.title}
            description={alert.description}
            variant={alert.variant}
            onDismiss={fn()}
          />
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const alerts = canvasElement.querySelectorAll('[data-testid="dismissible-alert"]');
    expect(alerts.length).toBe(4);
  },
};

export const WithFakerDataSingle: Story = {
  name: i18n.t('alert.storyName.withFakerDataSingle', 'With Faker Data (Single)'),
  render: () => {
    const alert = createFakeAlert();
    return (
      <Alert className="w-[460px]" variant={alert.variant}>
        <AlertCircleIcon />
        <AlertTitle>{alert.title}</AlertTitle>
        <AlertDescription>{alert.description}</AlertDescription>
      </Alert>
    );
  },
  play: async ({ canvasElement }) => {
    const alert = canvasElement.querySelector('[data-slot="alert"]');
    expect(alert).toBeInTheDocument();
  },
};

export const WithFakerDataByType: Story = {
  name: i18n.t('alert.storyName.withFakerDataByType', 'With Faker Data (By Type)'),
  render: () => {
    const alerts = createFakeAlertsByType();
    const iconMap: Record<string, React.ReactNode> = {
      info: <InfoIcon />,
      alertCircle: <AlertCircleIcon />,
      checkCircle: <CheckCircleIcon className="text-green-600" />,
      alertTriangle: <AlertTriangleIcon className="text-yellow-600" />,
    };

    return (
      <div className="flex flex-col gap-4">
        {alerts.map((alert) => (
          <Alert key={alert.id} className="w-[460px]" variant={alert.variant}>
            {alert.icon && iconMap[alert.icon]}
            <AlertTitle>{alert.title}</AlertTitle>
            <AlertDescription>{alert.description}</AlertDescription>
          </Alert>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const alerts = canvasElement.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(5);
  },
};

// ============ ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  name: i18n.t('alert.storyName.withAsyncData', 'With Async Data'),
  render: () => <AsyncAlerts limit={4} />,
  parameters: {
    msw: { handlers: alertHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Should show loading initially
    await waitFor(() => {
      expect(canvas.getByTestId('loading-state')).toBeInTheDocument();
    });

    // Wait for alerts to load
    await waitFor(
      () => {
        expect(canvas.getByTestId('alerts-container')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  },
};

// ============ THEME STORIES ============

export const Dark: Story = {
  name: i18n.t('alert.storyName.dark', 'Dark Mode'),
  render: () => <I18nAlert variant="default" />,
  globals: {
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    expect(alert).toBeInTheDocument();
  },
};

export const DarkDestructive: Story = {
  name: i18n.t('alert.storyName.darkDestructive', 'Dark Mode (Destructive)'),
  render: () => <I18nAlert variant="destructive" />,
  globals: {
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.getAttribute('data-variant')).toBe('destructive');
  },
};

export const DarkAllVariants: Story = {
  name: i18n.t('alert.storyName.darkAllVariants', 'Dark Mode (All Variants)'),
  render: () => <AlertVariantsDemo />,
  globals: {
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const alerts = canvasElement.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(5);
  },
};

export const RTL: Story = {
  name: i18n.t('alert.storyName.rTL', 'RTL Support'),
  render: () => <I18nAlert variant="default" />,
  globals: {
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ I18N STORIES ============

export const Japanese: Story = {
  name: i18n.t('alert.storyName.japanese', 'Japanese Locale'),
  globals: {
    locale: 'ja',
  },
  render: () => <I18nAlert variant="default" />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');

    const title = alert.querySelector('[data-slot="alert-title"]');
    if (!(title instanceof HTMLElement)) {
      throw new Error('Alert title was not rendered.');
    }

    expect(title.textContent?.trim()).toBe('注意!');
  },
};

export const JapaneseDestructive: Story = {
  name: i18n.t('alert.storyName.japaneseDestructive', 'Japanese Locale (Destructive)'),
  globals: {
    locale: 'ja',
  },
  render: () => <I18nAlert variant="destructive" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');

    const title = alert.querySelector('[data-slot="alert-title"]');
    if (!(title instanceof HTMLElement)) {
      throw new Error('Alert title was not rendered.');
    }

    expect(title.textContent?.trim()).toBe('問題が発生しました');
  },
};

export const DarkModeJapanese: Story = {
  name: i18n.t('alert.storyName.darkModeJapanese', 'Dark Mode + Japanese'),
  globals: {
    locale: 'ja',
    theme: 'dark',
  },
  render: () => <I18nAlert variant="default" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    expect(alert).toBeInTheDocument();

    const title = alert.querySelector('[data-slot="alert-title"]');
    expect(title?.textContent?.trim()).toBe('注意!');
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('alert.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('alert.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('alert.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ PSEUDO STATES STORIES ============

export const PseudoStates: Story = {
  name: i18n.t('alert.storyName.pseudoStates', 'Pseudo States (hover / focus)'),
  tags: ['!test'],
  render: () => <I18nAlert variant="default" />,
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

export const DesignReference: Story = {
  tags: ['!test'],
  render: () => <I18nAlert variant="default" />,
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ MSW HANDLER STORIES ============

export const WithMswHandlers: Story = {
  render: () => <I18nAlert variant="default" />,
  parameters: {
    msw: { handlers: alertHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  render: () => <AsyncAlerts />,
  parameters: {
    msw: { handlers: alertStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('loading-state')).toBeInTheDocument();
    });

    expect(canvas.getByText('Loading alerts...')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  render: () => <AsyncAlerts />,
  parameters: {
    msw: { handlers: alertStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('empty-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText('No alerts found.')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  render: () => <AsyncAlerts />,
  parameters: {
    msw: { handlers: alertStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Should show loading initially
    await waitFor(() => {
      expect(canvas.getByTestId('loading-state')).toBeInTheDocument();
    });

    // Eventually loads
    await waitFor(
      () => {
        expect(canvas.getByTestId('alerts-container')).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
  },
};

// ============ HTTP 4xx ERROR STORIES ============

export const Error400BadRequest: Story = {
  render: () => <AsyncAlerts />,
  parameters: {
    msw: { handlers: alertStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/Invalid query parameters/i)).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  render: () => <AsyncAlerts />,
  parameters: {
    msw: { handlers: alertStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/Authentication required/i)).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  render: () => <AsyncAlerts />,
  parameters: {
    msw: { handlers: alertStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/Access denied/i)).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  render: () => <AsyncAlerts />,
  parameters: {
    msw: { handlers: alertStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/rate limit/i)).toBeInTheDocument();
  },
};

// ============ HTTP 5xx ERROR STORIES ============

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: alertStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  render: () => <AsyncAlerts />,
  parameters: {
    msw: { handlers: alertStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/Failed to fetch alert data/i)).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  render: () => <AsyncAlerts />,
  parameters: {
    msw: { handlers: alertStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/unavailable/i)).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  render: () => <AsyncAlerts />,
  parameters: {
    msw: { handlers: alertStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/maintenance/i)).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  render: () => <AsyncAlerts />,
  parameters: {
    msw: { handlers: alertStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/timed out/i)).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  render: () => <AsyncAlerts />,
  parameters: {
    msw: { handlers: alertStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/Error:/i)).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY STORIES ============

export const Accessibility: Story = {
  name: i18n.t('alert.storyName.accessibility', 'Accessibility Testing'),
  args: { variant: 'default' },
  render: () => (
    <div className="flex flex-col gap-4">
      <Alert className="w-[460px]">
        <AlertCircleIcon />
        <AlertTitle>{i18n.t('alert.story.accessibleAlert', 'Accessible Alert')}</AlertTitle>
        <AlertDescription>
          {i18n.t(
            'alert.story.alertRoleDescription',
            'This alert uses role="alert" for screen reader announcements.'
          )}
        </AlertDescription>
      </Alert>
      <Alert className="w-[460px]" variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>{i18n.t('alert.story.errorAlert', 'Error Alert')}</AlertTitle>
        <AlertDescription>
          {i18n.t(
            'alert.story.destructiveAlertsDescription',
            'Destructive alerts communicate critical information with proper semantics.'
          )}
        </AlertDescription>
      </Alert>
      <DismissibleAlert
        title={i18n.t('alert.story.dismissibleAccessibleAlert', 'Dismissible Accessible Alert')}
        description={i18n.t(
          'alert.story.dismissAccessibleDescription',
          'The dismiss button has a proper aria-label for screen readers.'
        )}
        onDismiss={fn()}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test alert role is present
    const alerts = canvas.getAllByRole('alert');
    expect(alerts.length).toBe(3);

    // Verify data-slot attributes
    for (const alert of alerts) {
      expect(alert.getAttribute('data-slot')).toBe('alert');

      // Check for title and description
      const title = alert.querySelector('[data-slot="alert-title"]');
      expect(title).toBeInTheDocument();

      const description = alert.querySelector('[data-slot="alert-description"]');
      expect(description).toBeInTheDocument();
    }

    // Verify the alert is accessible to screen readers
    const firstAlert = alerts[0];
    expect(firstAlert.getAttribute('role')).toBe('alert');
    expect(firstAlert.getAttribute('aria-live')).toBe('polite');
    expect(firstAlert.getAttribute('aria-atomic')).toBe('true');

    // Verify destructive alert has assertive aria-live
    const destructiveAlert = alerts[1];
    expect(destructiveAlert.getAttribute('aria-live')).toBe('assertive');

    // Check dismiss button has proper aria-label
    const dismissButton = canvas.getByTestId('dismiss-button');
    expect(dismissButton.getAttribute('aria-label')).toBe('Dismiss alert');

    // Test keyboard accessibility
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(dismissButton).toHaveFocus();

    // Activate with keyboard
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(canvas.queryByTestId('dismissible-alert')).not.toBeInTheDocument();
    });
  },
  parameters: {
    docs: {
      description: {
        story: 'Accessibility testing with ARIA role validation and screen reader compatibility.',
      },
    },
  },
};

// ============ FACTORY HELPER ============

const ICON_MAP: Record<AlertIconType, React.ReactNode> = {
  info: <InfoIcon />,
  alertCircle: <AlertCircleIcon />,
  checkCircle: <CheckCircleIcon className="text-green-600 dark:text-green-400" />,
  alertTriangle: <AlertTriangleIcon className="text-yellow-600 dark:text-yellow-400" />,
  xCircle: <AlertCircleIcon className="text-red-600 dark:text-red-400" />,
};

function renderAlertIcon(icon?: AlertIconType): React.ReactNode {
  if (!icon) return <AlertCircleIcon />;
  return ICON_MAP[icon] || <AlertCircleIcon />;
}

function getSizeClassName(size?: string): string {
  if (size === 'fullWidth') return 'w-full';
  if (size === 'compact') return 'w-[360px] py-2';
  return 'w-[460px]';
}

export const AccessibilityAriaLive: Story = {
  name: i18n.t('alert.storyName.accessibilityAriaLive', 'ARIA Live Regions'),
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t('alert.story.defaultAriaLivePolite', 'Default (aria-live="polite")')}
        </p>
        <Alert className="w-[460px]">
          <InfoIcon />
          <AlertTitle>{i18n.t('alert.story.politeAnnouncement', 'Polite Announcement')}</AlertTitle>
          <AlertDescription>
            {i18n.t(
              'alert.story.politeAlertDescription',
              'This alert waits for the user to finish their current task before announcing.'
            )}
          </AlertDescription>
        </Alert>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t(
            'alert.story.destructiveAriaLiveAssertive',
            'Destructive (aria-live="assertive")'
          )}
        </p>
        <Alert className="w-[460px]" variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>
            {i18n.t('alert.story.assertiveAnnouncement', 'Assertive Announcement')}
          </AlertTitle>
          <AlertDescription>
            {i18n.t(
              'alert.story.assertiveAlertDescription',
              'This alert interrupts the user immediately with critical information.'
            )}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const alerts = canvasElement.querySelectorAll('[role="alert"]');
    expect(alerts.length).toBe(2);

    // First alert should be polite
    expect(alerts[0].getAttribute('aria-live')).toBe('polite');

    // Second alert should be assertive
    expect(alerts[1].getAttribute('aria-live')).toBe('assertive');

    // Both should have aria-atomic
    expect(alerts[0].getAttribute('aria-atomic')).toBe('true');
    expect(alerts[1].getAttribute('aria-atomic')).toBe('true');
  },
};

// ============ FACTORY: CONSTANTS STORIES ============

function FactoryAllVariantsDemo() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4" data-testid="factory-all-variants">
      <h3 className="text-sm font-medium">{t('alert.factory.allVariants')}</h3>
      <div className="flex flex-col gap-3">
        {ALERT_VARIANTS.map((variant) => (
          <Alert
            key={variant}
            className="w-[460px]"
            variant={variant}
            data-testid={`variant-${variant}`}
          >
            <AlertCircleIcon />
            <AlertTitle>
              {t('alert.factory.variant')}: {variant}
            </AlertTitle>
            <AlertDescription>
              Alert rendered with variant &quot;{variant}&quot; from ALERT_VARIANTS constant.
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}

export const FactoryAllVariants: Story = {
  name: i18n.t('alert.storyName.factoryAllVariants', 'Factory: ALERT_VARIANTS'),
  render: () => <FactoryAllVariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-all-variants');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(ALERT_VARIANTS.length);
    expect(canvas.getByTestId('variant-default')).toBeInTheDocument();
    expect(canvas.getByTestId('variant-destructive')).toBeInTheDocument();
  },
};

function FactoryAllTypesDemo() {
  return (
    <div className="space-y-4" data-testid="factory-all-types">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.allTypes')}</h3>
      <div className="flex flex-col gap-3">
        {ALERT_TYPES.map((type) => (
          <Alert
            key={type}
            className="w-[460px]"
            variant={type === 'destructive' ? 'destructive' : 'default'}
            data-testid={`type-${type}`}
          >
            <AlertCircleIcon />
            <AlertTitle>
              {i18n.t('alert.factory.type')}: {type}
            </AlertTitle>
            <AlertDescription>
              Alert of semantic type &quot;{type}&quot; from ALERT_TYPES constant.
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}

export const FactoryAllTypes: Story = {
  name: i18n.t('alert.storyName.factoryAllTypes', 'Factory: ALERT_TYPES'),
  render: () => <FactoryAllTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-all-types');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(ALERT_TYPES.length);
    for (const type of ALERT_TYPES) {
      expect(canvas.getByTestId(`type-${type}`)).toBeInTheDocument();
    }
  },
};

function FactoryAllSizesDemo() {
  return (
    <div className="space-y-4" data-testid="factory-all-sizes">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.allSizes')}</h3>
      <div className="flex flex-col gap-3">
        {ALERT_SIZES.map((size) => (
          <Alert key={size} className={getSizeClassName(size)} data-testid={`size-${size}`}>
            <AlertCircleIcon />
            <AlertTitle>
              {i18n.t('alert.factory.size')}: {size}
            </AlertTitle>
            <AlertDescription>
              Alert at &quot;{size}&quot; size from ALERT_SIZES constant.
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}

export const FactoryAllSizes: Story = {
  name: i18n.t('alert.storyName.factoryAllSizes', 'Factory: ALERT_SIZES'),
  render: () => <FactoryAllSizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-all-sizes');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(ALERT_SIZES.length);
    for (const size of ALERT_SIZES) {
      expect(canvas.getByTestId(`size-${size}`)).toBeInTheDocument();
    }
  },
};

function FactoryAllIconsDemo() {
  return (
    <div className="space-y-4" data-testid="factory-all-icons">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.allIcons')}</h3>
      <div className="flex flex-col gap-3">
        {ALERT_ICONS.map((icon) => (
          <Alert key={icon} className="w-[460px]" data-testid={`icon-${icon}`}>
            {renderAlertIcon(icon)}
            <AlertTitle>
              {i18n.t('alert.factory.icon')}: {icon}
            </AlertTitle>
            <AlertDescription>
              Alert with &quot;{icon}&quot; icon from ALERT_ICONS constant.
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}

export const FactoryAllIcons: Story = {
  name: i18n.t('alert.storyName.factoryAllIcons', 'Factory: ALERT_ICONS'),
  render: () => <FactoryAllIconsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-all-icons');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(ALERT_ICONS.length);
    for (const icon of ALERT_ICONS) {
      expect(canvas.getByTestId(`icon-${icon}`)).toBeInTheDocument();
    }
  },
};

function FactoryAllPositionsDemo() {
  return (
    <div className="space-y-4" data-testid="factory-all-positions">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.allPositions')}</h3>
      <div className="flex flex-col gap-3">
        {ALERT_POSITIONS.map((position) => (
          <Alert key={position} className="w-[460px]" data-testid={`position-${position}`}>
            <AlertCircleIcon />
            <AlertTitle>
              {i18n.t('alert.factory.position')}: {position}
            </AlertTitle>
            <AlertDescription>
              Toast position &quot;{position}&quot; from ALERT_POSITIONS constant.
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}

export const FactoryAllPositions: Story = {
  name: i18n.t('alert.storyName.factoryAllPositions', 'Factory: ALERT_POSITIONS'),
  render: () => <FactoryAllPositionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-all-positions');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(ALERT_POSITIONS.length);
    for (const position of ALERT_POSITIONS) {
      expect(canvas.getByTestId(`position-${position}`)).toBeInTheDocument();
    }
  },
};

function FactoryAllAnimationsDemo() {
  return (
    <div className="space-y-4" data-testid="factory-all-animations">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.allAnimations')}</h3>
      <div className="flex flex-col gap-3">
        {ALERT_ANIMATIONS.map((animation) => (
          <Alert key={animation} className="w-[460px]" data-testid={`animation-${animation}`}>
            <AlertCircleIcon />
            <AlertTitle>
              {i18n.t('alert.factory.animation')}: {animation}
            </AlertTitle>
            <AlertDescription>
              Animation type &quot;{animation}&quot; from ALERT_ANIMATIONS constant.
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}

export const FactoryAllAnimations: Story = {
  name: i18n.t('alert.storyName.factoryAllAnimations', 'Factory: ALERT_ANIMATIONS'),
  render: () => <FactoryAllAnimationsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-all-animations');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(ALERT_ANIMATIONS.length);
    for (const animation of ALERT_ANIMATIONS) {
      expect(canvas.getByTestId(`animation-${animation}`)).toBeInTheDocument();
    }
  },
};

function FactoryAlertTitlesDemo() {
  return (
    <div className="space-y-4" data-testid="factory-alert-titles">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.titles')}</h3>
      <div className="flex flex-col gap-2">
        {ALERT_TITLES.map((title) => (
          <Alert
            key={title}
            className="w-[460px]"
            data-testid={`title-${title.replaceAll(' ', '-').toLowerCase()}`}
          >
            <AlertCircleIcon />
            <AlertTitle>{title}</AlertTitle>
          </Alert>
        ))}
      </div>
    </div>
  );
}

export const FactoryAlertTitles: Story = {
  name: i18n.t('alert.storyName.factoryAlertTitles', 'Factory: ALERT_TITLES'),
  render: () => <FactoryAlertTitlesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-alert-titles');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(ALERT_TITLES.length);
    // Verify first and last titles render
    expect(canvas.getByTestId('title-heads-up!')).toBeInTheDocument();
    expect(canvas.getByTestId('title-attention')).toBeInTheDocument();
  },
};

function FactoryAlertDescriptionsDemo() {
  return (
    <div className="space-y-4" data-testid="factory-alert-descriptions">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.descriptions')}</h3>
      <div className="flex flex-col gap-2">
        {ALERT_DESCRIPTIONS.map((description) => (
          <Alert
            key={description}
            className="w-[460px]"
            data-testid={`desc-${description.slice(0, 20).replaceAll(' ', '-').toLowerCase()}`}
          >
            <AlertCircleIcon />
            <AlertTitle>{description.slice(0, 30)}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}

export const FactoryAlertDescriptions: Story = {
  name: i18n.t('alert.storyName.factoryAlertDescriptions', 'Factory: ALERT_DESCRIPTIONS'),
  render: () => <FactoryAlertDescriptionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-alert-descriptions');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(ALERT_DESCRIPTIONS.length);
    // Verify at least some descriptions render
    const firstDesc = container.querySelector('[data-slot="alert"]');
    expect(firstDesc).toBeInTheDocument();
  },
};

function FactoryAutoCloseDurationsDemo() {
  return (
    <div className="space-y-4" data-testid="factory-auto-close-durations">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.autoCloseDurations')}</h3>
      <div className="flex flex-col gap-2">
        {AUTO_CLOSE_DURATIONS.map((duration) => (
          <Alert key={duration} className="w-[460px]" data-testid={`duration-${duration}`}>
            <AlertCircleIcon />
            <AlertTitle>
              {i18n.t('alert.factory.duration')}:{' '}
              {duration === 0 ? 'No auto-close' : `${duration}ms`}
            </AlertTitle>
            <AlertDescription>
              Auto-close after {duration === 0 ? 'never' : `${duration / 1000} seconds`}.
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}

export const FactoryAutoCloseDurations: Story = {
  name: i18n.t('alert.storyName.factoryAutoCloseDurations', 'Factory: AUTO_CLOSE_DURATIONS'),
  render: () => <FactoryAutoCloseDurationsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-auto-close-durations');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(AUTO_CLOSE_DURATIONS.length);
    expect(canvas.getByTestId(`duration-${AUTO_CLOSE_DURATIONS[0]}`)).toBeInTheDocument();
  },
};

// ============ FACTORY: SPECIALIZED FUNCTION STORIES ============

function FactoryErrorAlertDemo() {
  const alert = createFakeErrorAlert();
  return (
    <div className="space-y-4" data-testid="factory-error-alert">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.errorAlert')}</h3>
      <Alert className="w-[460px]" variant={alert.variant} data-testid="error-alert-item">
        {renderAlertIcon(alert.icon)}
        <AlertTitle>{alert.title}</AlertTitle>
        <AlertDescription>{alert.description}</AlertDescription>
      </Alert>
      <p className="text-muted-foreground text-xs">
        {i18n.t('alert.factory.priority')}: {alert.priority} | {i18n.t('alert.factory.type')}:{' '}
        {alert.type}
      </p>
    </div>
  );
}

export const FactoryErrorAlert: Story = {
  name: i18n.t('alert.storyName.factoryErrorAlert', 'Factory: createFakeErrorAlert'),
  render: () => <FactoryErrorAlertDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-error-alert');
    expect(container).toBeInTheDocument();
    const alert = canvas.getByTestId('error-alert-item');
    expect(alert).toBeInTheDocument();
    expect(alert.getAttribute('data-variant')).toBe('destructive');
  },
};

function FactorySuccessAlertDemo() {
  const alert = createFakeSuccessAlert();
  return (
    <div className="space-y-4" data-testid="factory-success-alert">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.successAlert')}</h3>
      <Alert
        className="w-[460px] border-green-500 bg-green-50 text-green-900 dark:border-green-600 dark:bg-green-950 dark:text-green-100"
        data-testid="success-alert-item"
      >
        {renderAlertIcon(alert.icon)}
        <AlertTitle>{alert.title}</AlertTitle>
        <AlertDescription>{alert.description}</AlertDescription>
      </Alert>
      <p className="text-muted-foreground text-xs">
        {i18n.t('alert.factory.priority')}: {alert.priority} | Auto-close: {alert.autoCloseMs}ms
      </p>
    </div>
  );
}

export const FactorySuccessAlert: Story = {
  name: i18n.t('alert.storyName.factorySuccessAlert', 'Factory: createFakeSuccessAlert'),
  render: () => <FactorySuccessAlertDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-success-alert');
    expect(container).toBeInTheDocument();
    const alert = canvas.getByTestId('success-alert-item');
    expect(alert).toBeInTheDocument();
  },
};

function FactoryWarningAlertDemo() {
  const alert = createFakeWarningAlert();
  return (
    <div className="space-y-4" data-testid="factory-warning-alert">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.warningAlert')}</h3>
      <Alert
        className="w-[460px] border-yellow-500 bg-yellow-50 text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-100"
        data-testid="warning-alert-item"
      >
        {renderAlertIcon(alert.icon)}
        <AlertTitle>{alert.title}</AlertTitle>
        <AlertDescription>{alert.description}</AlertDescription>
      </Alert>
      <p className="text-muted-foreground text-xs">
        {i18n.t('alert.factory.priority')}: {alert.priority} | {i18n.t('alert.factory.dismissible')}
        : {String(alert.dismissible)}
      </p>
    </div>
  );
}

export const FactoryWarningAlert: Story = {
  name: i18n.t('alert.storyName.factoryWarningAlert', 'Factory: createFakeWarningAlert'),
  render: () => <FactoryWarningAlertDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-warning-alert');
    expect(container).toBeInTheDocument();
    const alert = canvas.getByTestId('warning-alert-item');
    expect(alert).toBeInTheDocument();
  },
};

function FactoryInfoAlertDemo() {
  const alert = createFakeInfoAlert();
  return (
    <div className="space-y-4" data-testid="factory-info-alert">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.infoAlert')}</h3>
      <Alert
        className="w-[460px] border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-100"
        data-testid="info-alert-item"
      >
        {renderAlertIcon(alert.icon)}
        <AlertTitle>{alert.title}</AlertTitle>
        <AlertDescription>{alert.description}</AlertDescription>
      </Alert>
      <p className="text-muted-foreground text-xs">
        {i18n.t('alert.factory.priority')}: {alert.priority} | {i18n.t('alert.factory.type')}:{' '}
        {alert.type}
      </p>
    </div>
  );
}

export const FactoryInfoAlert: Story = {
  name: i18n.t('alert.storyName.factoryInfoAlert', 'Factory: createFakeInfoAlert'),
  render: () => <FactoryInfoAlertDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-info-alert');
    expect(container).toBeInTheDocument();
    const alert = canvas.getByTestId('info-alert-item');
    expect(alert).toBeInTheDocument();
  },
};

function FactorySystemAlertDemo() {
  const alert = createFakeSystemAlert();
  return (
    <div className="space-y-4" data-testid="factory-system-alert">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.systemAlert')}</h3>
      <Alert className="w-[460px]" variant={alert.variant} data-testid="system-alert-item">
        {renderAlertIcon(alert.icon)}
        <AlertTitle>{alert.title}</AlertTitle>
        <AlertDescription>{alert.description}</AlertDescription>
      </Alert>
      <p className="text-muted-foreground text-xs">
        Source: {(alert.metadata as Record<string, string>)?.source} | Auto-close:{' '}
        {alert.autoCloseMs}ms
      </p>
    </div>
  );
}

export const FactorySystemAlert: Story = {
  name: i18n.t('alert.storyName.factorySystemAlert', 'Factory: createFakeSystemAlert'),
  render: () => <FactorySystemAlertDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-system-alert');
    expect(container).toBeInTheDocument();
    const alert = canvas.getByTestId('system-alert-item');
    expect(alert).toBeInTheDocument();
  },
};

function FactoryDismissibleAlertDemo() {
  const alert = createFakeDismissibleAlert();
  return (
    <div className="space-y-4" data-testid="factory-dismissible-alert">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.dismissibleAlert')}</h3>
      <DismissibleAlert
        title={alert.title}
        description={alert.description}
        variant={alert.variant}
        onDismiss={fn()}
      />
      <p className="text-muted-foreground text-xs">
        {i18n.t('alert.factory.dismissible')}: {String(alert.dismissible)} | Auto-close:{' '}
        {alert.autoCloseMs}ms
      </p>
    </div>
  );
}

export const FactoryDismissibleAlertStory: Story = {
  name: i18n.t(
    'alert.storyName.factoryDismissibleAlertStory',
    'Factory: createFakeDismissibleAlert'
  ),
  render: () => <FactoryDismissibleAlertDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-dismissible-alert');
    expect(container).toBeInTheDocument();
    const alert = canvas.getByTestId('dismissible-alert');
    expect(alert).toBeInTheDocument();
    const dismissButton = canvas.getByTestId('dismiss-button');
    expect(dismissButton).toBeInTheDocument();
  },
};

function FactoryAutoCloseAlertDemo() {
  const alert = createFakeAutoCloseAlert(8000);
  return (
    <div className="space-y-4" data-testid="factory-autoclose-alert">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.autoCloseAlert')}</h3>
      <Alert className="w-[460px]" variant={alert.variant} data-testid="autoclose-alert-item">
        {renderAlertIcon(alert.icon)}
        <AlertTitle>{alert.title}</AlertTitle>
        <AlertDescription>{alert.description}</AlertDescription>
      </Alert>
      <p className="text-muted-foreground text-xs">
        Auto-close: {alert.autoCloseMs}ms | {i18n.t('alert.factory.animation')}: {alert.animation} |
        Show progress: {String(alert.showProgress)}
      </p>
    </div>
  );
}

export const FactoryAutoCloseAlert: Story = {
  name: i18n.t('alert.storyName.factoryAutoCloseAlert', 'Factory: createFakeAutoCloseAlert'),
  render: () => <FactoryAutoCloseAlertDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-autoclose-alert');
    expect(container).toBeInTheDocument();
    const alert = canvas.getByTestId('autoclose-alert-item');
    expect(alert).toBeInTheDocument();
  },
};

function FactoryCompactAlertDemo() {
  const alert = createFakeCompactAlert();
  return (
    <div className="space-y-4" data-testid="factory-compact-alert">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.compactAlert')}</h3>
      <Alert className="w-[360px] py-2" data-testid="compact-alert-item">
        <AlertTitle className="mb-0 text-sm">{alert.title}</AlertTitle>
      </Alert>
      <p className="text-muted-foreground text-xs">
        {i18n.t('alert.factory.size')}: {alert.size} | {i18n.t('alert.factory.dismissible')}:{' '}
        {String(alert.dismissible)}
      </p>
    </div>
  );
}

export const FactoryCompactAlert: Story = {
  name: i18n.t('alert.storyName.factoryCompactAlert', 'Factory: createFakeCompactAlert'),
  render: () => <FactoryCompactAlertDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-compact-alert');
    expect(container).toBeInTheDocument();
    const alert = canvas.getByTestId('compact-alert-item');
    expect(alert).toBeInTheDocument();
  },
};

function FactoryFullWidthAlertDemo() {
  const alert = createFakeFullWidthAlert();
  return (
    <div className="space-y-4" data-testid="factory-fullwidth-alert">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.fullWidthAlert')}</h3>
      <Alert className="w-full" variant={alert.variant} data-testid="fullwidth-alert-item">
        {renderAlertIcon(alert.icon)}
        <AlertTitle>{alert.title}</AlertTitle>
        <AlertDescription>{alert.description}</AlertDescription>
      </Alert>
      <p className="text-muted-foreground text-xs">
        {i18n.t('alert.factory.size')}: {alert.size} | {i18n.t('alert.factory.dismissible')}:{' '}
        {String(alert.dismissible)}
      </p>
    </div>
  );
}

export const FactoryFullWidthAlert: Story = {
  name: i18n.t('alert.storyName.factoryFullWidthAlert', 'Factory: createFakeFullWidthAlert'),
  render: () => <FactoryFullWidthAlertDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-fullwidth-alert');
    expect(container).toBeInTheDocument();
    const alert = canvas.getByTestId('fullwidth-alert-item');
    expect(alert).toBeInTheDocument();
  },
};

// ============ FACTORY: BULK/COLLECTION FUNCTION STORIES ============

function FactoryAlertsByVariantDemo() {
  const alerts = createFakeAlertsByVariant();
  return (
    <div className="space-y-4" data-testid="factory-by-variant">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.byVariant')}</h3>
      <div className="flex flex-col gap-3">
        {alerts.map((alert) => (
          <Alert
            key={alert.id}
            className="w-[460px]"
            variant={alert.variant}
            data-testid={`by-variant-${alert.variant}`}
          >
            {renderAlertIcon(alert.icon)}
            <AlertTitle>{alert.title}</AlertTitle>
            <AlertDescription>{alert.description}</AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}

export const FactoryByVariant: Story = {
  name: i18n.t('alert.storyName.factoryByVariant', 'Factory: createFakeAlertsByVariant'),
  render: () => <FactoryAlertsByVariantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-by-variant');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(ALERT_VARIANTS.length);
  },
};

function FactoryAlertsBySizesDemo() {
  const alerts = createFakeAlertsBySizes();
  return (
    <div className="space-y-4" data-testid="factory-by-sizes">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.bySizes')}</h3>
      <div className="flex flex-col gap-3">
        {alerts.map((alert) => (
          <Alert
            key={alert.id}
            className={getSizeClassName(alert.size)}
            variant={alert.variant}
            data-testid={`by-size-${alert.size}`}
          >
            {renderAlertIcon(alert.icon)}
            <AlertTitle>{alert.title}</AlertTitle>
            <AlertDescription>{alert.description}</AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}

export const FactoryBySizes: Story = {
  name: i18n.t('alert.storyName.factoryBySizes', 'Factory: createFakeAlertsBySizes'),
  render: () => <FactoryAlertsBySizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-by-sizes');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(ALERT_SIZES.length);
  },
};

// ============ FACTORY: ALERT WITH ACTIONS STORY ============

function FactoryAlertWithActionsDemo() {
  const alertWithActions: FakeAlertWithActions = createFakeAlertWithActions(3);
  return (
    <div className="space-y-4" data-testid="factory-with-actions">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.withActions')}</h3>
      <Alert
        className="w-[460px]"
        variant={alertWithActions.variant}
        data-testid="actions-alert-item"
      >
        {renderAlertIcon(alertWithActions.icon)}
        <AlertTitle>{alertWithActions.title}</AlertTitle>
        <AlertDescription>{alertWithActions.description}</AlertDescription>
        {alertWithActions.actions && (
          <div className="mt-3 flex gap-2" data-testid="alert-actions">
            {alertWithActions.actions.map((action: FakeAlertAction) => (
              <button
                key={action.label}
                type="button"
                className={`rounded px-3 py-1 text-sm ${
                  action.primary
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
                data-testid={`action-${action.label.toLowerCase().replaceAll(' ', '-')}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </Alert>
      <p className="text-muted-foreground text-xs">
        {i18n.t('alert.factory.actions')}: {alertWithActions.actions?.length ?? 0}
      </p>
    </div>
  );
}

export const FactoryWithActions: Story = {
  name: i18n.t('alert.storyName.factoryWithActions', 'Factory: createFakeAlertWithActions'),
  render: () => <FactoryAlertWithActionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-with-actions');
    expect(container).toBeInTheDocument();
    const alert = canvas.getByTestId('actions-alert-item');
    expect(alert).toBeInTheDocument();
    const actionsContainer = canvas.getByTestId('alert-actions');
    expect(actionsContainer).toBeInTheDocument();
    expect(canvas.getByTestId('action-dismiss')).toBeInTheDocument();
    expect(canvas.getByTestId('action-learn-more')).toBeInTheDocument();
    expect(canvas.getByTestId('action-undo')).toBeInTheDocument();
  },
};

// ============ FACTORY: MATRIX STORIES ============

function FactoryAlertMatrixDemo() {
  const matrix = createFakeAlertMatrix();
  return (
    <div className="space-y-6" data-testid="factory-matrix">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.matrix')}</h3>
      {matrix.map((row, rowIndex) => (
        <div key={ALERT_VARIANTS[rowIndex]} className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium">
            {i18n.t('alert.factory.variant')}: {ALERT_VARIANTS[rowIndex]}
          </p>
          <div className="flex flex-col gap-2">
            {row.map((alert) => (
              <Alert
                key={alert.id}
                className={getSizeClassName(alert.size)}
                variant={alert.variant}
                data-testid={`matrix-${alert.id}`}
              >
                {renderAlertIcon(alert.icon as AlertIconType)}
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>{alert.description}</AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryAlertMatrix: Story = {
  name: i18n.t('alert.storyName.factoryAlertMatrix', 'Factory: createFakeAlertMatrix'),
  render: () => <FactoryAlertMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-matrix');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    // Matrix is ALERT_VARIANTS.length * ALERT_SIZES.length
    expect(alerts.length).toBe(ALERT_VARIANTS.length * ALERT_SIZES.length);
    // Check first and last cells
    expect(canvas.getByTestId('matrix-default-compact')).toBeInTheDocument();
    expect(canvas.getByTestId('matrix-destructive-fullWidth')).toBeInTheDocument();
  },
};

function FactoryAlertTypeMatrixDemo() {
  const matrix = createFakeAlertTypeMatrix();
  return (
    <div className="space-y-6" data-testid="factory-type-matrix">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.typeMatrix')}</h3>
      {matrix.map((row, rowIndex) => (
        <div key={ALERT_TYPES[rowIndex]} className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium">
            {i18n.t('alert.factory.type')}: {ALERT_TYPES[rowIndex]}
          </p>
          <div className="flex flex-col gap-2">
            {row.map((alert, colIndex) => (
              <Alert
                key={alert.id}
                className="w-[460px]"
                variant={alert.variant}
                data-testid={`type-matrix-${ALERT_TYPES[rowIndex]}-${colIndex}`}
              >
                {renderAlertIcon(alert.icon)}
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>{alert.description}</AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryAlertTypeMatrix: Story = {
  name: i18n.t('alert.storyName.factoryAlertTypeMatrix', 'Factory: createFakeAlertTypeMatrix'),
  render: () => <FactoryAlertTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-type-matrix');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    // Matrix is ALERT_TYPES.length * 2 (dismissible true/false)
    expect(alerts.length).toBe(ALERT_TYPES.length * 2);
    // Check a specific cell
    expect(canvas.getByTestId('type-matrix-default-0')).toBeInTheDocument();
    expect(canvas.getByTestId('type-matrix-destructive-1')).toBeInTheDocument();
  },
};

// ============ FACTORY: CONFIGURATION STORY ============

function FactoryAlertConfigDemo() {
  const scenarios = ['default', 'dismissible', 'autoClose', 'compact', 'toast'] as const;
  return (
    <div className="space-y-6" data-testid="factory-config">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.config')}</h3>
      {scenarios.map((scenario) => {
        const config: FakeAlertConfig = createFakeAlertConfig(scenario);
        return (
          <div key={scenario} className="space-y-2" data-testid={`config-${scenario}`}>
            <p className="text-muted-foreground text-xs font-medium">
              {i18n.t('alert.factory.scenario')}: {scenario}
            </p>
            <Alert className={getSizeClassName(config.size)} variant={config.variant}>
              <AlertCircleIcon />
              <AlertTitle>{scenario.charAt(0).toUpperCase() + scenario.slice(1)} Config</AlertTitle>
              <AlertDescription>
                {i18n.t('alert.factory.size')}: {config.size} | {i18n.t('alert.factory.animation')}:{' '}
                {config.animation} | {i18n.t('alert.factory.position')}: {config.position}
              </AlertDescription>
            </Alert>
          </div>
        );
      })}
    </div>
  );
}

export const FactoryAlertConfig: Story = {
  name: i18n.t('alert.storyName.factoryAlertConfig', 'Factory: createFakeAlertConfig'),
  render: () => <FactoryAlertConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-config');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(5);
    expect(canvas.getByTestId('config-default')).toBeInTheDocument();
    expect(canvas.getByTestId('config-dismissible')).toBeInTheDocument();
    expect(canvas.getByTestId('config-autoClose')).toBeInTheDocument();
    expect(canvas.getByTestId('config-compact')).toBeInTheDocument();
    expect(canvas.getByTestId('config-toast')).toBeInTheDocument();
  },
};

// ============ FACTORY: ENTERPRISE FEATURE STORIES ============

function FactoryToastAlertDemo() {
  const { t } = useTranslation();
  const positions: AlertPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  return (
    <div className="space-y-4" data-testid="factory-toast-alert">
      <h3 className="text-sm font-medium">{t('alert.factory.toastAlert')}</h3>
      <div className="flex flex-col gap-3">
        {positions.map((position) => {
          const alert = createFakeToastAlert(position);
          return (
            <Alert
              key={position}
              className="w-[460px]"
              variant={alert.variant}
              data-testid={`toast-${position}`}
            >
              {renderAlertIcon(alert.icon)}
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription>
                {t('alert.factory.position')}: {position} | {t('alert.factory.animation')}:{' '}
                {alert.animation}
              </AlertDescription>
            </Alert>
          );
        })}
      </div>
    </div>
  );
}

export const FactoryToastAlert: Story = {
  name: i18n.t('alert.storyName.factoryToastAlert', 'Factory: createFakeToastAlert'),
  render: () => <FactoryToastAlertDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-toast-alert');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(4);
    expect(canvas.getByTestId('toast-top-left')).toBeInTheDocument();
    expect(canvas.getByTestId('toast-bottom-right')).toBeInTheDocument();
  },
};

function FactoryHighPriorityAlertDemo() {
  const alert = createFakeHighPriorityAlert();
  return (
    <div className="space-y-4" data-testid="factory-high-priority-alert">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.highPriorityAlert')}</h3>
      <Alert className="w-[460px]" variant={alert.variant} data-testid="high-priority-alert-item">
        {renderAlertIcon(alert.icon)}
        <AlertTitle>{alert.title}</AlertTitle>
        <AlertDescription>{alert.description}</AlertDescription>
      </Alert>
      <p className="text-muted-foreground text-xs">
        {i18n.t('alert.factory.priority')}: {alert.priority} | {i18n.t('alert.factory.dismissible')}
        : {String(alert.dismissible)}
      </p>
    </div>
  );
}

export const FactoryHighPriorityAlert: Story = {
  name: i18n.t('alert.storyName.factoryHighPriorityAlert', 'Factory: createFakeHighPriorityAlert'),
  render: () => <FactoryHighPriorityAlertDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-high-priority-alert');
    expect(container).toBeInTheDocument();
    const alert = canvas.getByTestId('high-priority-alert-item');
    expect(alert).toBeInTheDocument();
    expect(alert.getAttribute('data-variant')).toBe('destructive');
  },
};

function FactoryAccessibleAlertDemo() {
  const alert = createFakeAccessibleAlert();
  return (
    <div className="space-y-4" data-testid="factory-accessible-alert">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.accessibleAlert')}</h3>
      <Alert className="w-[460px]" variant={alert.variant} data-testid="accessible-alert-item">
        {renderAlertIcon(alert.icon)}
        <AlertTitle>{alert.title}</AlertTitle>
        <AlertDescription>{alert.description}</AlertDescription>
      </Alert>
      <p className="text-muted-foreground text-xs">
        testId: {alert.testId} | ARIA metadata: {JSON.stringify(alert.metadata)}
      </p>
    </div>
  );
}

export const FactoryAccessibleAlert: Story = {
  name: i18n.t('alert.storyName.factoryAccessibleAlert', 'Factory: createFakeAccessibleAlert'),
  render: () => <FactoryAccessibleAlertDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-accessible-alert');
    expect(container).toBeInTheDocument();
    const alert = canvas.getByTestId('accessible-alert-item');
    expect(alert).toBeInTheDocument();
    expect(alert.getAttribute('role')).toBe('alert');
  },
};

function FactoryEnterpriseAlertSetDemo() {
  const alerts = createFakeEnterpriseAlertSet();
  return (
    <div className="space-y-4" data-testid="factory-enterprise-set">
      <h3 className="text-sm font-medium">{i18n.t('alert.factory.enterpriseSet')}</h3>
      <div className="flex flex-col gap-3">
        {alerts.map((alert, index) => (
          <Alert
            key={alert.id}
            className="w-[460px]"
            variant={alert.variant}
            data-testid={`enterprise-${index}`}
          >
            {renderAlertIcon(alert.icon)}
            <AlertTitle>{alert.title}</AlertTitle>
            <AlertDescription>{alert.description}</AlertDescription>
          </Alert>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {i18n.t('alert.story.totalEnterpriseAlerts', { count: alerts.length })}
      </p>
    </div>
  );
}

export const FactoryEnterpriseAlertSet: Story = {
  name: i18n.t(
    'alert.storyName.factoryEnterpriseAlertSet',
    'Factory: createFakeEnterpriseAlertSet'
  ),
  render: () => <FactoryEnterpriseAlertSetDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('factory-enterprise-set');
    expect(container).toBeInTheDocument();
    const alerts = container.querySelectorAll('[data-slot="alert"]');
    expect(alerts.length).toBe(10);
    expect(canvas.getByTestId('enterprise-0')).toBeInTheDocument();
    expect(canvas.getByTestId('enterprise-9')).toBeInTheDocument();
  },
};

// ============ TYPE ASSERTION HELPERS (ensure type imports are used) ============

// These demonstrate the type exports from the factory are correctly typed
const _typeAssertVariant: AlertVariant = 'default';
const _typeAssertType: AlertType = 'info';
const _typeAssertSize: AlertSize = 'compact';
const _typeAssertIconType: AlertIconType = 'info';
const _typeAssertPosition: AlertPosition = 'top-right';
const _typeAssertAnimation: AlertAnimation = 'fade';
const _typeAssertFakeAlert: FakeAlert = createFakeAlert();
const _typeAssertFakeAlertConfig: FakeAlertConfig = createFakeAlertConfig('default');
const _typeAssertFakeAlertAction: FakeAlertAction = { label: 'Test', primary: true };
const _typeAssertFakeAlertWithActions: FakeAlertWithActions = createFakeAlertWithActions(1);

// Avoid unused variable warnings by void-referencing them
void _typeAssertVariant;
void _typeAssertType;
void _typeAssertSize;
void _typeAssertIconType;
void _typeAssertPosition;
void _typeAssertAnimation;
void _typeAssertFakeAlert;
void _typeAssertFakeAlertConfig;
void _typeAssertFakeAlertAction;
void _typeAssertFakeAlertWithActions;

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   notFound
//   conflict
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('alert.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: alertStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('alert.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: alertStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('alert.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: alertStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
