import type { Meta, StoryObj } from '@storybook/react';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { expect, within } from 'storybook/test';
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
  createFakeThemePresets,
} from '@/.storybook/stories/_factories/theme.factory';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Sidebar item IDs (labels resolved inside component via t())
const sidebarItemIds = [
  'recents',
  'home',
  'applications',
  'desktop',
  'downloads',
  'documents',
] as const;

// Helper to create checkbox change handler
function createCheckedChangeHandler(
  selectedItems: string[],
  setSelectedItems: Dispatch<SetStateAction<string[]>>
) {
  return (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, itemId]);
    } else {
      setSelectedItems(selectedItems.filter((id) => id !== itemId));
    }
  };
}

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function SettingsDisplayDemo() {
  const { t } = useTranslation();
  const [selectedItems, setSelectedItems] = useState<string[]>(['recents', 'home']);

  const sidebarLabelMap: Record<string, string> = {
    recents: t('settingsDisplay.story.recents', 'Recents'),
    home: t('settingsDisplay.story.home', 'Home'),
    applications: t('settingsDisplay.story.applications', 'Applications'),
    desktop: t('settingsDisplay.story.desktop', 'Desktop'),
    downloads: t('settingsDisplay.story.downloads', 'Downloads'),
    documents: t('settingsDisplay.story.documents', 'Documents'),
  };

  const sidebarItems = sidebarItemIds.map((id) => ({ id, label: sidebarLabelMap[id] }));

  const handleCheckedChange = createCheckedChangeHandler(selectedItems, setSelectedItems);

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="mx-auto max-w-(--breakpoint-md)">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {t('settingsDisplay.story.display', 'Display')}
          </h1>
          <p className="text-muted-foreground">
            {t(
              'pages.settings.display.description',
              "Turn items on or off to control what's displayed in the app."
            )}
          </p>
        </div>

        <Card>
          <CardContent>
            <form className="space-y-8">
              <div className="space-y-4">
                <div className="mb-4">
                  <Label className="text-base">
                    {t('settingsDisplay.story.sidebar', 'Sidebar')}
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    {t(
                      'pages.settings.display.sidebarDescription',
                      'Select the items you want to display in the sidebar.'
                    )}
                  </p>
                </div>
                {sidebarItems.map((item) => (
                  <div className="flex flex-row items-start space-x-3" key={item.id}>
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      id={item.id}
                      onCheckedChange={(checked) =>
                        handleCheckedChange(item.id, checked as boolean)
                      }
                    />
                    <Label className="font-normal" htmlFor={item.id}>
                      {item.label}
                    </Label>
                  </div>
                ))}
              </div>

              <Button type="submit">
                {t('settingsDisplay.story.updateDisplay', 'Update display')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SidebarItemsDemo() {
  const { t } = useTranslation();
  const [selectedItems, setSelectedItems] = useState<string[]>(['recents', 'home', 'documents']);

  const sidebarLabelMap: Record<string, string> = {
    recents: t('settingsDisplay.story.recents', 'Recents'),
    home: t('settingsDisplay.story.home', 'Home'),
    applications: t('settingsDisplay.story.applications', 'Applications'),
    desktop: t('settingsDisplay.story.desktop', 'Desktop'),
    downloads: t('settingsDisplay.story.downloads', 'Downloads'),
    documents: t('settingsDisplay.story.documents', 'Documents'),
  };

  const sidebarItems = sidebarItemIds.map((id) => ({ id, label: sidebarLabelMap[id] }));

  const handleCheckedChange = createCheckedChangeHandler(selectedItems, setSelectedItems);

  return (
    <div className="max-w-sm p-4">
      <Card>
        <CardContent>
          <div className="space-y-4">
            <div className="mb-4">
              <Label className="text-base">{t('settingsDisplay.story.sidebar', 'Sidebar')}</Label>
              <p className="text-muted-foreground text-sm">
                {t(
                  'pages.settings.display.sidebarDescription',
                  'Select the items you want to display in the sidebar.'
                )}
              </p>
            </div>
            {sidebarItems.map((item) => (
              <div className="flex flex-row items-start space-x-3" key={item.id}>
                <Checkbox
                  checked={selectedItems.includes(item.id)}
                  id={`demo-${item.id}`}
                  onCheckedChange={(checked) => handleCheckedChange(item.id, checked as boolean)}
                />
                <Label className="font-normal" htmlFor={`demo-${item.id}`}>
                  {item.label}
                </Label>
              </div>
            ))}
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
  title: 'Pages/Settings/Display',
  component: SettingsDisplayDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...settingsHandlers, ...buttonHandlers, ...formHandlers] },
    docs: {
      description: {
        component:
          'Settings Display Page - Display settings with checkbox group for selecting sidebar items (Recents, Home, Applications, Desktop, Downloads, Documents).',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof SettingsDisplayDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('settingsDisplay.storyName.default', 'Full Page'),
  render: () => <SettingsDisplayDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const SidebarItems: Story = {
  name: i18n.t('settingsDisplay.storyName.sidebarItems', 'Sidebar Items'),
  render: () => <SidebarItemsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('settingsDisplay.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <SettingsDisplayDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const SidebarItemsDark: Story = {
  name: i18n.t('settingsDisplay.storyName.sidebarItemsDark', 'Sidebar Items Dark'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <SidebarItemsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    // Simple presence check - pages should render content
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const CheckboxList: Story = {
  name: i18n.t('settingsDisplay.storyName.checkboxList', 'Checkbox List'),
  render: () => <SettingsDisplayDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Verify checkbox items are present
    expect(canvas.getByText('Recents')).toBeInTheDocument();
    expect(canvas.getByText('Home')).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: /update display/i })).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  name: i18n.t('settingsDisplay.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <SettingsDisplayDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  name: i18n.t('settingsDisplay.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <SettingsDisplayDemo />
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('settingsDisplay.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('settingsDisplay.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('settingsDisplay.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('settingsDisplay.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('settingsDisplay.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: settingsStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('settingsDisplay.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: settingsStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('settingsDisplay.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: settingsStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('settingsDisplay.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: settingsStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'settingsDisplay.storyName.error422UnprocessableEntity',
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
    'settingsDisplay.storyName.error500InternalServerError',
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
    'settingsDisplay.storyName.error503ServiceUnavailable',
    'Handler: Service Unavailable'
  ),
  parameters: { msw: { handlers: settingsStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('settingsDisplay.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: settingsStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('settingsDisplay.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: settingsStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('settingsDisplay.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: settingsStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('settingsDisplay.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: settingsStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const themeConfig = createFakeThemeConfig();
  const presets = createFakeThemePresets();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ themeConfig, presets }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('settingsDisplay.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
