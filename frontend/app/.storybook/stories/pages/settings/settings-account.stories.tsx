import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { useState } from 'react';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { CalendarIcon, CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import { format } from 'date-fns';

import {
  settingsHandlers,
  settingsStatusHandlers,
} from '@/.storybook/stories/_handlers/settings.handlers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { formHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import { inputHandlers } from '@/.storybook/stories/_handlers/input.handlers';
import {
  createFakeFormField,
  createFakeProfileFormData,
} from '@/.storybook/stories/_factories/form.factory';
import { createFakeUser } from '@/.storybook/stories/_factories/user.factory';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Language value list (labels resolved inside component via t())
const languageValues = ['en', 'fr', 'de', 'es', 'pt', 'ru', 'ja', 'ko', 'zh'] as const;

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function SettingsAccountDemo() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | undefined>();
  const [language, setLanguage] = useState('');
  const [open, setOpen] = useState(false);

  const languageLabelMap: Record<string, string> = {
    en: t('settingsAccount.story.langEnglish', 'English'),
    fr: t('settingsAccount.story.langFrench', 'French'),
    de: t('settingsAccount.story.langGerman', 'German'),
    es: t('settingsAccount.story.langSpanish', 'Spanish'),
    pt: t('settingsAccount.story.langPortuguese', 'Portuguese'),
    ru: t('settingsAccount.story.langRussian', 'Russian'),
    ja: t('settingsAccount.story.langJapanese', 'Japanese'),
    ko: t('settingsAccount.story.langKorean', 'Korean'),
    zh: t('settingsAccount.story.langChinese', 'Chinese'),
  };

  const languages = languageValues.map((value) => ({ value, label: languageLabelMap[value] }));

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="mx-auto max-w-(--breakpoint-md)">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {t('settingsAccount.story.accountSettings', 'Account Settings')}
          </h1>
          <p className="text-muted-foreground">
            {t('settingsAccount.story.updateYourAccountSettings', 'Update your account settings.')}
          </p>
        </div>

        <Card>
          <CardContent>
            <form className="space-y-8">
              <div className="space-y-2">
                <Label>{t('settingsAccount.story.name', 'Name')}</Label>
                <Input
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('settingsAccount.story.yourNamePlaceholder', 'Your name')}
                  value={name}
                />
                <p className="text-muted-foreground text-sm">
                  {t(
                    'pages.settings.account.nameDescription',
                    'This is the name that will be displayed on your profile and in emails.'
                  )}
                </p>
              </div>

              <div className="flex flex-col space-y-2">
                <Label>{t('settingsAccount.story.dateOfBirth', 'Date of birth')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !dob && 'text-muted-foreground'
                      )}
                      variant="outline"
                    >
                      {dob ? (
                        format(dob, 'PPP')
                      ) : (
                        <span>{t('settingsAccount.story.pickADate', 'Pick a date')}</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="max-h-[--radix-popover-content-available-height] w-[--radix-popover-trigger-width] p-0"
                  >
                    <Calendar
                      disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                      initialFocus
                      mode="single"
                      onSelect={setDob}
                      selected={dob}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-muted-foreground text-sm">
                  {t(
                    'pages.settings.account.dobDescription',
                    'Your date of birth is used to calculate your age.'
                  )}
                </p>
              </div>

              <div className="flex flex-col space-y-2">
                <Label>{t('settingsAccount.story.language', 'Language')}</Label>
                <Popover onOpenChange={setOpen} open={open}>
                  <PopoverTrigger asChild>
                    <Button
                      className={cn('w-full justify-between', !language && 'text-muted-foreground')}
                      role="combobox"
                      variant="outline"
                    >
                      {language
                        ? languages.find((l) => l.value === language)?.label
                        : t('settingsAccount.story.selectLanguage', 'Select language')}
                      <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-0">
                    <Command>
                      <CommandInput
                        placeholder={t(
                          'settingsAccount.story.searchLanguagePlaceholder',
                          'Search language...'
                        )}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {t('settingsAccount.story.noLanguageFound', 'No language found.')}
                        </CommandEmpty>
                        <CommandGroup>
                          {languages.map((lang) => (
                            <CommandItem
                              key={lang.value}
                              onSelect={() => {
                                setLanguage(lang.value);
                                setOpen(false);
                              }}
                              value={lang.label}
                            >
                              <CheckIcon
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  lang.value === language ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {lang.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-muted-foreground text-sm">
                  {t(
                    'pages.settings.account.languageDescription',
                    'This is the language that will be used in the dashboard.'
                  )}
                </p>
              </div>

              <Button type="submit">
                {t('settingsAccount.story.updateAccount', 'Update account')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AccountFormDemo() {
  const { t } = useTranslation();
  const [name, setName] = useState('John Doe');

  return (
    <div className="max-w-md p-4">
      <Card>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settingsAccount.story.name', 'Name')}</Label>
              <Input
                onChange={(e) => setName(e.target.value)}
                placeholder={t('settingsAccount.story.yourNamePlaceholder', 'Your name')}
                value={name}
              />
              <p className="text-muted-foreground text-sm">
                {t(
                  'pages.settings.account.nameDescription',
                  'This is the name that will be displayed on your profile.'
                )}
              </p>
            </div>
            <Button>{t('settingsAccount.story.updateAccount', 'Update account')}</Button>
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
  title: 'Pages/Settings/Account',
  component: SettingsAccountDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...settingsHandlers, ...buttonHandlers, ...formHandlers, ...inputHandlers] },
    docs: {
      description: {
        component:
          'Settings Account Page - Account settings form with name input, date of birth calendar picker, and language combobox selector with form validation.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof SettingsAccountDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('settingsAccount.storyName.default', 'Full Page'),
  render: () => <SettingsAccountDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const AccountForm: Story = {
  name: i18n.t('settingsAccount.storyName.accountForm', 'Account Form'),
  render: () => <AccountFormDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('settingsAccount.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <SettingsAccountDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const AccountFormDark: Story = {
  name: i18n.t('settingsAccount.storyName.accountFormDark', 'Account Form Dark'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <AccountFormDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const FormElements: Story = {
  name: i18n.t('settingsAccount.storyName.formElements', 'Form Elements'),
  render: () => <SettingsAccountDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Verify form elements are present
    expect(canvas.getByText('Name')).toBeInTheDocument();
    expect(canvas.getByPlaceholderText('Your name')).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /update account/i })).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  name: i18n.t('settingsAccount.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <SettingsAccountDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('settingsAccount.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <SettingsAccountDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('settingsAccount.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('settingsAccount.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('settingsAccount.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('settingsAccount.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('settingsAccount.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: settingsStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('settingsAccount.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: settingsStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('settingsAccount.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: settingsStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('settingsAccount.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: settingsStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'settingsAccount.storyName.error422UnprocessableEntity',
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
    'settingsAccount.storyName.error500InternalServerError',
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
    'settingsAccount.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: settingsStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('settingsAccount.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: settingsStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('settingsAccount.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: settingsStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('settingsAccount.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: settingsStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('settingsAccount.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: settingsStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const field = createFakeFormField();
  const profileData = createFakeProfileFormData();
  const user = createFakeUser();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ field, profileData, user }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('settingsAccount.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
