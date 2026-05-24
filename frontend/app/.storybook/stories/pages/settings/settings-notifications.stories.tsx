import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { useState } from 'react';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  settingsHandlers,
  settingsStatusHandlers,
} from '@/.storybook/stories/_handlers/settings.handlers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { formHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import {
  createFakeNotification,
  createFakeNotifications,
} from '@/.storybook/stories/_factories/notification.factory';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function SettingsNotificationsDemo() {
  const { t } = useTranslation();
  const [notifyType, setNotifyType] = useState('all');
  const [communicationEmails, setCommunicationEmails] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [socialEmails, setSocialEmails] = useState(true);
  const [securityEmails] = useState(true);
  const [mobileSettings, setMobileSettings] = useState(false);

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="mx-auto max-w-(--breakpoint-md)">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {t('settingsNotifications.story.notifications', 'Notifications')}
          </h1>
          <p className="text-muted-foreground">
            {t(
              'pages.settings.notifications.description',
              'Configure how you receive notifications.'
            )}
          </p>
        </div>

        <Card>
          <CardContent>
            <form className="space-y-8">
              <div className="space-y-3">
                <Label>
                  {t('settingsNotifications.story.notifyMeAbout', 'Notify me about...')}
                </Label>
                <RadioGroup
                  className="flex flex-col space-y-1"
                  onValueChange={setNotifyType}
                  value={notifyType}
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem id="all" value="all" />
                    <Label className="font-normal" htmlFor="all">
                      {t('settingsNotifications.story.allNewMessages', 'All new messages')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem id="mentions" value="mentions" />
                    <Label className="font-normal" htmlFor="mentions">
                      {t(
                        'pages.settings.notifications.directMentions',
                        'Direct messages and mentions'
                      )}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem id="none" value="none" />
                    <Label className="font-normal" htmlFor="none">
                      {t('settingsNotifications.story.nothing', 'Nothing')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <h3 className="mb-4 text-lg font-medium">
                  {t('settingsNotifications.story.emailNotifications', 'Email Notifications')}
                </h3>
                <div className="space-y-4">
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">
                        {t(
                          'pages.settings.notifications.communicationEmails',
                          'Communication emails'
                        )}
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        {t(
                          'pages.settings.notifications.communicationDescription',
                          'Receive emails about your account activity.'
                        )}
                      </p>
                    </div>
                    <Switch
                      checked={communicationEmails}
                      onCheckedChange={setCommunicationEmails}
                    />
                  </div>

                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">
                        {t('settingsNotifications.story.marketingEmails', 'Marketing emails')}
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        {t(
                          'pages.settings.notifications.marketingDescription',
                          'Receive emails about new products, features, and more.'
                        )}
                      </p>
                    </div>
                    <Switch checked={marketingEmails} onCheckedChange={setMarketingEmails} />
                  </div>

                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">
                        {t('settingsNotifications.story.socialEmails', 'Social emails')}
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        {t(
                          'pages.settings.notifications.socialDescription',
                          'Receive emails for friend requests, follows, and more.'
                        )}
                      </p>
                    </div>
                    <Switch checked={socialEmails} onCheckedChange={setSocialEmails} />
                  </div>

                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">
                        {t('settingsNotifications.story.securityEmails', 'Security emails')}
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        {t(
                          'pages.settings.notifications.securityDescription',
                          'Receive emails about your account activity and security.'
                        )}
                      </p>
                    </div>
                    <Switch aria-readonly checked={securityEmails} disabled />
                  </div>
                </div>
              </div>

              <div className="flex flex-row items-start space-x-3">
                <Checkbox
                  checked={mobileSettings}
                  id="mobile"
                  onCheckedChange={(checked) => setMobileSettings(checked as boolean)}
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="mobile">
                    {t(
                      'pages.settings.notifications.mobileSettings',
                      'Use different settings for my mobile devices'
                    )}
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    {t(
                      'pages.settings.notifications.mobileDescription',
                      'You can manage your mobile notifications in the mobile settings page.'
                    )}
                  </p>
                </div>
              </div>

              <Button type="submit">
                {t('settingsNotifications.story.updateNotifications', 'Update notifications')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmailNotificationsDemo() {
  const { t } = useTranslation();
  const [communicationEmails, setCommunicationEmails] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  return (
    <div className="max-w-lg p-4">
      <Card>
        <CardContent>
          <div className="space-y-4">
            <h3 className="text-lg font-medium">
              {t('settingsNotifications.story.emailNotifications', 'Email Notifications')}
            </h3>
            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">
                  {t('settingsNotifications.story.communicationEmails', 'Communication emails')}
                </Label>
                <p className="text-muted-foreground text-sm">
                  {t(
                    'pages.settings.notifications.communicationDescription',
                    'Receive emails about your account activity.'
                  )}
                </p>
              </div>
              <Switch checked={communicationEmails} onCheckedChange={setCommunicationEmails} />
            </div>
            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">
                  {t('settingsNotifications.story.marketingEmails', 'Marketing emails')}
                </Label>
                <p className="text-muted-foreground text-sm">
                  {t(
                    'pages.settings.notifications.marketingDescription',
                    'Receive emails about new products and features.'
                  )}
                </p>
              </div>
              <Switch checked={marketingEmails} onCheckedChange={setMarketingEmails} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Settings/Notifications',
  component: SettingsNotificationsDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...settingsHandlers, ...buttonHandlers, ...formHandlers] },
    docs: {
      description: {
        component:
          'Settings Notifications Page - Notification preferences with RadioGroup for message types, Switch toggles for email notifications (communication, marketing, social, security), and checkbox for mobile settings.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof SettingsNotificationsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('settingsNotifications.storyName.default', 'Full Page'),
  render: () => <SettingsNotificationsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const EmailNotifications: Story = {
  name: i18n.t('settingsNotifications.storyName.emailNotifications', 'Email Notifications'),
  render: () => <EmailNotificationsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('settingsNotifications.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <SettingsNotificationsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const EmailNotificationsDark: Story = {
  name: i18n.t(
    'settingsNotifications.storyName.emailNotificationsDark',
    'Email Notifications Dark'
  ),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <EmailNotificationsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const NotificationOptions: Story = {
  name: i18n.t('settingsNotifications.storyName.notificationOptions', 'Notification Options'),
  render: () => <SettingsNotificationsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Verify notification options are present
    expect(canvas.getByText('All new messages')).toBeInTheDocument();
    expect(canvas.getByText('Communication emails')).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /update notifications/i })).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  name: i18n.t('settingsNotifications.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <SettingsNotificationsDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('settingsNotifications.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <SettingsNotificationsDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('settingsNotifications.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('settingsNotifications.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('settingsNotifications.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('settingsNotifications.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('settingsNotifications.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: settingsStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('settingsNotifications.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: settingsStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('settingsNotifications.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: settingsStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('settingsNotifications.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: settingsStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'settingsNotifications.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: settingsStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'settingsNotifications.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: settingsStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'settingsNotifications.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: settingsStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('settingsNotifications.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: settingsStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('settingsNotifications.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: settingsStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('settingsNotifications.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: settingsStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('settingsNotifications.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: settingsStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const notification = createFakeNotification();
  const notifications = createFakeNotifications(3);
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ notification, notifications }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('settingsNotifications.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};

export const HandlerSettingsSuccess: Story = {
  ...Default,
  name: i18n.t(
    'settingsNotifications.storyName.handlerSettingsSuccess',
    'Handler: Settings Success'
  ),
  parameters: { msw: { handlers: settingsStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
