import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { CircleUserRoundIcon, Trash2Icon } from 'lucide-react';

import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import {
  createFakeFormField,
  createFakeSettingsFormData,
} from '@/.storybook/stories/_factories/form.factory';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function SettingsMainDemo() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('shadcn');
  const [bio, setBio] = useState('I own a computer.');
  const [urls, setUrls] = useState(['https://shadcn.com', 'https://twitter.com/shadcn']);
  const [avatarSrc] = useState('');

  const addUrl = () => {
    setUrls([...urls, '']);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('settingsMain.story.profileSettings', 'Profile Settings')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t(
            'pages.settingsMain.description',
            'Manage your account settings and public profile information.'
          )}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-8 pt-6">
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 align-top">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarSrc} />
                <AvatarFallback>
                  <CircleUserRoundIcon className="opacity-45" />
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <Button type="button">{t('settingsMain.story.uploadImage', 'Upload image')}</Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">{t('settingsMain.story.username', 'Username')}</Label>
            <Input
              id="username"
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('settingsMain.story.usernamePlaceholder', 'shadcn')}
              value={username}
            />
            <p className="text-muted-foreground text-sm">
              {t(
                'pages.settingsMain.usernameHelp',
                'This is your public display name. It can be your real name or a pseudonym.'
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-select">{t('settingsMain.story.email', 'Email')}</Label>
            <Select defaultValue="m@example.com">
              <SelectTrigger className="w-full" id="email-select">
                <SelectValue
                  placeholder={t(
                    'settingsMain.story.selectVerifiedEmailPlaceholder',
                    'Select a verified email'
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="m@example.com">m@example.com</SelectItem>
                <SelectItem value="m@google.com">m@google.com</SelectItem>
                <SelectItem value="m@support.com">m@support.com</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-sm">
              {t(
                'pages.settingsMain.emailHelp',
                'You can manage verified email addresses in your email settings.'
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">{t('settingsMain.story.bio', 'Bio')}</Label>
            <Textarea
              className="resize-none"
              id="bio"
              onChange={(e) => setBio(e.target.value)}
              placeholder={t(
                'settingsMain.story.bioPlaceholder',
                'Tell us a little bit about yourself'
              )}
              value={bio}
            />
            <p className="text-muted-foreground text-sm">
              {t(
                'pages.settingsMain.bioHelp',
                'You can @mention other users and organizations to link to them.'
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('settingsMain.story.urls', 'URLs')}</Label>
            <p className="text-muted-foreground text-sm">
              {t(
                'pages.settingsMain.urlsHelp',
                'Add links to your website, blog, or social media profiles.'
              )}
            </p>
            {urls.map((url, urlIndex) => (
              <div className="flex items-center gap-2" key={url}>
                <Input
                  onChange={(e) => {
                    const newUrls = [...urls];
                    newUrls[urlIndex] = e.target.value;
                    setUrls(newUrls);
                  }}
                  placeholder={t('settingsMain.story.urlPlaceholder', 'https://example.com')}
                  value={url}
                />
                <Button
                  onClick={() => setUrls(urls.filter((_, i) => i !== urlIndex))}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button onClick={addUrl} size="sm" type="button" variant="outline">
              {t('settingsMain.story.addUrl', 'Add URL')}
            </Button>
          </div>

          <Button type="button">{t('settingsMain.story.updateProfile', 'Update profile')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Settings/Settings Main',
  component: SettingsMainDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...formHandlers] },
    docs: {
      description: {
        component:
          'Settings Main Page - Profile settings form with avatar upload, username, email select, bio textarea, and URL management.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof SettingsMainDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('settingsMain.storyName.default', 'Full Page'),
  render: () => <SettingsMainDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify key form elements
    const usernameInput = canvas.getByLabelText(/username/i);
    const bioInput = canvas.getByLabelText(/bio/i);
    const updateButton = canvas.getByRole('button', { name: /update profile/i });

    expect(usernameInput).toBeInTheDocument();
    expect(bioInput).toBeInTheDocument();
    expect(updateButton).toBeInTheDocument();

    // Test typing into username
    await userEvent.clear(usernameInput);
    await userEvent.type(usernameInput, 'newuser');
    expect(usernameInput).toHaveValue('newuser');
  },
};

export const Dark: Story = {
  name: i18n.t('settingsMain.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <SettingsMainDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('settingsMain.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <SettingsMainDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('settingsMain.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <SettingsMainDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: formStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: formStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: formStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'settingsMain.storyName.error422UnprocessableEntity',
    'Handler: Unprocessable Entity'
  ),
  parameters: { msw: { handlers: formStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: formStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: formStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: formStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'settingsMain.storyName.error500InternalServerError',
    'Handler: Internal Server Error'
  ),
  parameters: { msw: { handlers: formStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: formStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: formStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: formStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: formStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: formStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: formStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('settingsMain.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: formStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const field = createFakeFormField();
  const settingsData = createFakeSettingsFormData();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ field, settingsData }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('settingsMain.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
