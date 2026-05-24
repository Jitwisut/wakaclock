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
  createFakeThemeConfig,
  createFakeThemePresetInfo,
} from '@/.storybook/stories/_factories/theme.factory';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function SettingsAppearanceDemo() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState('light');
  const [font, setFont] = useState('inter');

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="mx-auto max-w-(--breakpoint-md)">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {t('settingsAppearance.story.appearance', 'Appearance')}
          </h1>
          <p className="text-muted-foreground">
            {t(
              'pages.settings.appearance.description',
              'Customize the appearance of the app. Automatically switch between day and night themes.'
            )}
          </p>
        </div>

        <Card>
          <CardContent>
            <form className="space-y-8">
              <div className="space-y-2">
                <Label>{t('settingsAppearance.story.font', 'Font')}</Label>
                <Select onValueChange={setFont} value={font}>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t(
                        'settingsAppearance.story.selectFontPlaceholder',
                        'Select font'
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inter">
                      {t('settingsAppearance.story.inter', 'Inter')}
                    </SelectItem>
                    <SelectItem value="manrope">
                      {t('settingsAppearance.story.manrope', 'Manrope')}
                    </SelectItem>
                    <SelectItem value="system">
                      {t('settingsAppearance.story.system', 'System')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-sm">
                  {t(
                    'pages.settings.appearance.fontDescription',
                    'Set the font you want to use in the dashboard.'
                  )}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>{t('settingsAppearance.story.theme', 'Theme')}</Label>
                  <p className="text-muted-foreground text-sm">
                    {t(
                      'pages.settings.appearance.themeDescription',
                      'Select the theme for the dashboard.'
                    )}
                  </p>
                </div>
                <RadioGroup className="flex max-w-md gap-6" onValueChange={setTheme} value={theme}>
                  <div>
                    <RadioGroupItem className="peer sr-only" id="light" value="light" />
                    <Label
                      className="[&:has([data-state=checked])>div]:border-primary flex cursor-pointer flex-col"
                      htmlFor="light"
                    >
                      <div className="hover:border-accent items-center rounded-lg border-2 p-1">
                        <div className="space-y-2 rounded-lg bg-[#ecedef] p-2">
                          <div className="space-y-2 rounded-md bg-white p-2 shadow-xs">
                            <div className="h-2 w-[80px] rounded-lg bg-[#ecedef]" />
                            <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                          </div>
                          <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs">
                            <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
                            <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                          </div>
                          <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs">
                            <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
                            <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                          </div>
                        </div>
                      </div>
                      <span className="block w-full p-2 text-center font-normal">
                        {t('settingsAppearance.story.light', 'Light')}
                      </span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem className="peer sr-only" id="dark" value="dark" />
                    <Label
                      className="[&:has([data-state=checked])>div]:border-primary flex cursor-pointer flex-col"
                      htmlFor="dark"
                    >
                      <div className="bg-popover hover:bg-accent hover:text-accent-foreground items-center rounded-lg border-2 p-1">
                        <div className="space-y-2 rounded-lg bg-slate-950 p-2">
                          <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-xs">
                            <div className="h-2 w-[80px] rounded-lg bg-slate-400" />
                            <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
                          </div>
                          <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs">
                            <div className="h-4 w-4 rounded-full bg-slate-400" />
                            <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
                          </div>
                          <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs">
                            <div className="h-4 w-4 rounded-full bg-slate-400" />
                            <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
                          </div>
                        </div>
                      </div>
                      <span className="block w-full p-2 text-center font-normal">
                        {t('settingsAppearance.story.dark', 'Dark')}
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Button type="submit">
                {t('settingsAppearance.story.updatePreferences', 'Update preferences')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ThemeSelectorDemo() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState('light');

  return (
    <div className="max-w-md p-4">
      <Card>
        <CardContent>
          <div className="space-y-4">
            <Label>{t('settingsAppearance.story.theme', 'Theme')}</Label>
            <RadioGroup className="flex gap-6" onValueChange={setTheme} value={theme}>
              <div>
                <RadioGroupItem className="peer sr-only" id="theme-light" value="light" />
                <Label
                  className="[&:has([data-state=checked])>div]:border-primary flex cursor-pointer flex-col"
                  htmlFor="theme-light"
                >
                  <div className="items-center rounded-lg border-2 p-1">
                    <div className="space-y-2 rounded-lg bg-[#ecedef] p-2">
                      <div className="h-2 w-[80px] rounded-lg bg-white" />
                      <div className="h-2 w-[60px] rounded-lg bg-white" />
                    </div>
                  </div>
                  <span className="block p-2 text-center text-sm">
                    {t('settingsAppearance.story.light', 'Light')}
                  </span>
                </Label>
              </div>
              <div>
                <RadioGroupItem className="peer sr-only" id="theme-dark" value="dark" />
                <Label
                  className="[&:has([data-state=checked])>div]:border-primary flex cursor-pointer flex-col"
                  htmlFor="theme-dark"
                >
                  <div className="items-center rounded-lg border-2 p-1">
                    <div className="space-y-2 rounded-lg bg-slate-950 p-2">
                      <div className="h-2 w-[80px] rounded-lg bg-slate-600" />
                      <div className="h-2 w-[60px] rounded-lg bg-slate-600" />
                    </div>
                  </div>
                  <span className="block p-2 text-center text-sm">
                    {t('settingsAppearance.story.dark', 'Dark')}
                  </span>
                </Label>
              </div>
            </RadioGroup>
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
  title: 'Pages/Settings/Appearance',
  component: SettingsAppearanceDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...settingsHandlers, ...buttonHandlers, ...formHandlers] },
    docs: {
      description: {
        component:
          'Settings Appearance Page - Appearance settings with font selector and visual theme preview cards (light/dark) using RadioGroup with visual placeholders.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof SettingsAppearanceDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('settingsAppearance.storyName.default', 'Full Page'),
  render: () => <SettingsAppearanceDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const ThemeSelector: Story = {
  name: i18n.t('settingsAppearance.storyName.themeSelector', 'Theme Selector'),
  render: () => <ThemeSelectorDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('settingsAppearance.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <SettingsAppearanceDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const ThemeSelectorDark: Story = {
  name: i18n.t('settingsAppearance.storyName.themeSelectorDark', 'Theme Selector Dark'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <ThemeSelectorDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const FormElements: Story = {
  name: i18n.t('settingsAppearance.storyName.formElements', 'Form Elements'),
  render: () => <SettingsAppearanceDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Verify form elements are present
    expect(canvas.getByText('Font')).toBeInTheDocument();
    expect(canvas.getByText('Theme')).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /update preferences/i })).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  name: i18n.t('settingsAppearance.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <SettingsAppearanceDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('settingsAppearance.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <SettingsAppearanceDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('settingsAppearance.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('settingsAppearance.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('settingsAppearance.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('settingsAppearance.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('settingsAppearance.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: settingsStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('settingsAppearance.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: settingsStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('settingsAppearance.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: settingsStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('settingsAppearance.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: settingsStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'settingsAppearance.storyName.error422UnprocessableEntity',
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
    'settingsAppearance.storyName.error500InternalServerError',
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
    'settingsAppearance.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: settingsStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('settingsAppearance.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: settingsStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('settingsAppearance.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: settingsStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('settingsAppearance.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: settingsStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('settingsAppearance.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: settingsStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const themeConfig = createFakeThemeConfig();
  const preset = createFakeThemePresetInfo();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ themeConfig, preset }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('settingsAppearance.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
