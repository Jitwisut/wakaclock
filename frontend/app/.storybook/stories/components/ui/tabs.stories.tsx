import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import { tabsHandlers, tabsStatusHandlers } from '@/.storybook/stories/_handlers/tabs.handlers';
import {
  createFakeAccessibleTabs,
  createFakeAccountSettingsTabs,
  createFakeAsyncTabs,
  createFakeDashboardTabs,
  createFakeEnterpriseTabsSet,
  createFakeFileBrowserTabs,
  createFakeKeyboardNavigationTabs,
  createFakeRTLTabs,
  createFakeTab,
  createFakeTabClosable,
  createFakeTabDisabled,
  createFakeTabLoading,
  createFakeTabs,
  createFakeTabsAllOrientations,
  createFakeTabsAllSizes,
  createFakeTabsAllVariants,
  createFakeTabsAllWithBadges,
  createFakeTabsAllWithIcons,
  createFakeTabsConfig,
  createFakeTabsConfigs,
  createFakeTabsVariantOrientationMatrix,
  createFakeTabsVariantSizeMatrix,
  createFakeTabsWithDisabled,
  createFakeTabWithBadge,
  createFakeTabWithIcon,
  createFakeVerticalNavTabs,
  createFakeWizardTabs,
  type FakeTab,
  type FakeTabsConfig,
  TAB_CONTENT_SAMPLES,
  TAB_ICONS,
  TAB_LABELS,
  TABS_ACTIVATION_MODES,
  TABS_ORIENTATIONS,
  TABS_SIZES,
  TABS_VARIANTS,
  type TabsActivationMode,
  type TabsOrientation,
  type TabsSize,
  type TabsVariant,
} from '@/.storybook/stories/_factories/tabs.factory';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useEffect, useState } from 'react';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============ ASYNC DATA DEMO COMPONENTS ============

interface TabsWithFakerDataProps {
  onBlur?: () => void;
  onClick?: () => void;
  onFocus?: () => void;
  onKeyDown?: () => void;
  onValueChange?: (value: string) => void;
  tabCount?: number;
}

function TabsWithFakerData({
  tabCount = 4,
  onValueChange,
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
}: TabsWithFakerDataProps) {
  const fakeTabs = createFakeTabs(tabCount);
  const defaultTab = fakeTabs[0]?.id ?? 'tab-0';

  return (
    <Tabs
      className="w-[500px]"
      defaultValue={defaultTab}
      onValueChange={onValueChange}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <TabsList className="w-full">
        {fakeTabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            data-tabs-trigger={tab.id}
          >
            {tab.label}
            {tab.badge && (
              <span className="bg-primary/20 ml-1.5 rounded-full px-1.5 text-xs">{tab.badge}</span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {fakeTabs.map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          className="rounded-md border p-4 text-sm"
          data-tabs-content={tab.id}
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

interface TabsWithAsyncDataProps {
  apiEndpoint?: string;
  onBlur?: () => void;
  onClick?: () => void;
  onFocus?: () => void;
  onKeyDown?: () => void;
  onValueChange?: (value: string) => void;
}

function TabsWithAsyncData({
  apiEndpoint = '/api/tabs',
  onValueChange,
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
}: TabsWithAsyncDataProps) {
  const { t } = useTranslation();
  const [tabs, setTabs] = useState<FakeTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTabs = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${apiEndpoint}?count=4`);
        if (!response.ok) {
          const errorData = (await response.json()) as { message?: string };
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as { tabs?: FakeTab[] };
        setTabs(data.tabs || []);
      } catch (error_) {
        setError(
          error_ instanceof Error
            ? error_.message
            : t('tabs.story.failedToLoadTabs', 'Failed to load tabs')
        );
      } finally {
        setLoading(false);
      }
    };
    fetchTabs();
  }, [apiEndpoint, t]);

  if (loading) {
    return (
      <div className="w-[500px] space-y-2" data-testid="tabs-loading">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="w-[500px]" data-testid="tabs-error">
        <AlertTitle>{t('tabs.story.error', 'Error')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (tabs.length === 0) {
    return (
      <div
        className="text-muted-foreground w-[500px] rounded-md border p-8 text-center"
        data-testid="tabs-empty"
      >
        {t('tabs.story.noTabsAvailable', 'No tabs available')}
      </div>
    );
  }

  return (
    <Tabs
      className="w-[500px]"
      defaultValue={tabs[0]?.id}
      onValueChange={onValueChange}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      data-testid="tabs-async"
    >
      <TabsList className="w-full">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            data-tabs-trigger={tab.id}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          className="rounded-md border p-4 text-sm"
          data-tabs-content={tab.id}
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function TabsDemo() {
  return (
    <Tabs className="w-[420px]" defaultValue="account">
      <TabsList className="w-full">
        <TabsTrigger data-tabs-trigger="account" value="account">
          {i18n.t('tabs.story.account', 'Account')}
        </TabsTrigger>
        <TabsTrigger data-tabs-trigger="password" value="password">
          {i18n.t('tabs.story.password', 'Password')}
        </TabsTrigger>
        <TabsTrigger data-tabs-trigger="billing" value="billing">
          {i18n.t('tabs.story.billing', 'Billing')}
        </TabsTrigger>
      </TabsList>
      <TabsContent
        className="rounded-md border p-4 text-sm"
        data-tabs-content="account"
        value="account"
      >
        {i18n.t('tabs.story.accountSettingsContent', 'Account settings content.')}
      </TabsContent>
      <TabsContent
        className="rounded-md border p-4 text-sm"
        data-tabs-content="password"
        value="password"
      >
        {i18n.t('tabs.story.passwordSettingsContent', 'Password settings content.')}
      </TabsContent>
      <TabsContent
        className="rounded-md border p-4 text-sm"
        data-tabs-content="billing"
        value="billing"
      >
        {i18n.t('tabs.story.billingSettingsContent', 'Billing settings content.')}
      </TabsContent>
    </Tabs>
  );
}

function I18nTabsDemo() {
  const { t } = useTranslation();

  return (
    <Tabs className="w-[420px]" defaultValue="account">
      <TabsList className="w-full">
        <TabsTrigger data-tabs-trigger="account" value="account">
          {t('tabs.account')}
        </TabsTrigger>
        <TabsTrigger data-tabs-trigger="password" value="password">
          {t('tabs.password')}
        </TabsTrigger>
        <TabsTrigger data-tabs-trigger="billing" value="billing">
          {t('tabs.billing')}
        </TabsTrigger>
      </TabsList>
      <TabsContent
        className="rounded-md border p-4 text-sm"
        data-tabs-content="account"
        value="account"
      >
        {t('tabs.content.account')}
      </TabsContent>
      <TabsContent
        className="rounded-md border p-4 text-sm"
        data-tabs-content="password"
        value="password"
      >
        {t('tabs.content.password')}
      </TabsContent>
      <TabsContent
        className="rounded-md border p-4 text-sm"
        data-tabs-content="billing"
        value="billing"
      >
        {t('tabs.content.billing')}
      </TabsContent>
    </Tabs>
  );
}

const meta = {
  title: 'Components/UI/Tabs',
  component: TabsDemo,
  tags: ['autodocs'],
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('tabs.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('tabs.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('tabs.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('tabs.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('tabs.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('tabs.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('tabs.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onValueChange: {
      action: 'onValueChange',
      description: i18n.t(
        'tabs.argType.calledWhenActiveTabChanges',
        'Called when active tab changes'
      ),
      table: { category: 'Events' },
    },
    // Note: argTypes for demo wrapper - actual Tabs component props documented below
    // Tabs Props Reference (Radix Tabs.Root):
    // - value: Controlled active tab value (string)
    // - defaultValue: Default active tab for uncontrolled usage (string)
    // - onValueChange: Called when active tab changes ((value: string) => void)
    // - orientation: Layout orientation ('horizontal' | 'vertical')
    // - dir: Reading direction ('ltr' | 'rtl')
    // - activationMode: How tabs are activated ('automatic' | 'manual')
    // - className: Additional CSS classes (string)
    //
    // TabsList Props Reference:
    // - loop: Whether keyboard navigation loops (boolean, default: true)
    // - className: Additional CSS classes (string)
    // - children: TabsTrigger elements (ReactNode)
    //
    // TabsTrigger Props Reference:
    // - value: Unique value identifying this tab (string, required)
    // - disabled: Whether the trigger is disabled (boolean)
    // - className: Additional CSS classes (string)
    // - children: Trigger content (ReactNode)
    //
    // TabsContent Props Reference:
    // - value: Value matching a TabsTrigger (string, required)
    // - forceMount: Force content to render even when inactive (boolean)
    // - className: Additional CSS classes (string)
    // - children: Tab panel content (ReactNode)
  },
  parameters: {
    msw: { handlers: tabsHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof TabsDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const tabsRoot = canvasElement.querySelector('[data-slot="tabs"]');
    if (!(tabsRoot instanceof HTMLElement)) {
      throw new Error('Tabs root was not found.');
    }

    const accountTab = canvasElement.querySelector('[data-tabs-trigger="account"]');
    const passwordTab = canvasElement.querySelector('[data-tabs-trigger="password"]');
    const billingTab = canvasElement.querySelector('[data-tabs-trigger="billing"]');

    if (!(accountTab instanceof HTMLElement)) throw new Error('Account tab was not found.');
    if (!(passwordTab instanceof HTMLElement)) throw new Error('Password tab was not found.');
    if (!(billingTab instanceof HTMLElement)) throw new Error('Billing tab was not found.');

    const accountContent = canvasElement.querySelector('[data-tabs-content="account"]');
    const passwordContent = canvasElement.querySelector('[data-tabs-content="password"]');
    const billingContent = canvasElement.querySelector('[data-tabs-content="billing"]');

    if (!(accountContent instanceof HTMLElement)) throw new Error('Account content was not found.');
    if (!(passwordContent instanceof HTMLElement)) {
      throw new Error('Password content was not found.');
    }
    if (!(billingContent instanceof HTMLElement)) throw new Error('Billing content was not found.');

    expect(accountTab.getAttribute('data-slot')).toBe('tabs-trigger');
    expect(accountTab.getAttribute('aria-selected')).toBe('true');
    expect(accountTab.getAttribute('data-state')).toBe('active');
    expect(passwordTab.getAttribute('aria-selected')).toBe('false');
    expect(passwordTab.getAttribute('data-state')).toBe('inactive');
    expect(billingTab.getAttribute('aria-selected')).toBe('false');
    expect(billingTab.getAttribute('data-state')).toBe('inactive');

    expect(accountContent.getAttribute('data-state')).toBe('active');
    expect(accountContent.textContent?.trim()).toBeInTheDocument();

    await userEvent.click(passwordTab);

    await waitFor(() => {
      expect(passwordTab.getAttribute('aria-selected')).toBe('true');
      expect(passwordTab.getAttribute('data-state')).toBe('active');
    });

    expect(accountTab.getAttribute('aria-selected')).toBe('false');
    expect(accountTab.getAttribute('data-state')).toBe('inactive');
    expect(passwordContent.getAttribute('data-state')).toBe('active');
    expect(passwordContent.textContent?.trim()).toBeInTheDocument();

    await userEvent.click(billingTab);

    await waitFor(() => {
      expect(billingTab.getAttribute('aria-selected')).toBe('true');
      expect(billingTab.getAttribute('data-state')).toBe('active');
    });

    expect(passwordTab.getAttribute('aria-selected')).toBe('false');
    expect(passwordTab.getAttribute('data-state')).toBe('inactive');
    expect(billingContent.getAttribute('data-state')).toBe('active');
    expect(billingContent.textContent?.trim()).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabsRoot = canvasElement.querySelector('[data-slot="tabs"]');
    expect(tabsRoot).toBeInTheDocument();
    const tabList = canvas.getByRole('tablist');
    expect(tabList).toBeInTheDocument();
    const tabs = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(tabs.length).toBe(3);
    const accountTab = canvasElement.querySelector('[data-tabs-trigger="account"]');
    expect(accountTab).toBeInTheDocument();
    expect(accountTab?.getAttribute('aria-selected')).toBe('true');
  },
};

// ============ VARIANTS ============

function VariantsDemo() {
  return (
    <div className="flex w-[500px] flex-col gap-8">
      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('tabs.variants.default')}</div>
        <Tabs defaultValue="tab1">
          <TabsList className="w-full">
            <TabsTrigger value="tab1">{i18n.t('tabs.story.overview', 'Overview')}</TabsTrigger>
            <TabsTrigger value="tab2">{i18n.t('tabs.story.analytics', 'Analytics')}</TabsTrigger>
            <TabsTrigger value="tab3">{i18n.t('tabs.story.reports', 'Reports')}</TabsTrigger>
          </TabsList>
          <TabsContent className="rounded-md border p-4 text-sm" value="tab1">
            Overview content
          </TabsContent>
          <TabsContent className="rounded-md border p-4 text-sm" value="tab2">
            Analytics content
          </TabsContent>
          <TabsContent className="rounded-md border p-4 text-sm" value="tab3">
            Reports content
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('tabs.variants.withIcons')}</div>
        <Tabs defaultValue="home">
          <TabsList className="w-full">
            <TabsTrigger value="home" className="gap-1.5">
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Home
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Settings
            </TabsTrigger>
          </TabsList>
          <TabsContent className="rounded-md border p-4 text-sm" value="home">
            Home content
          </TabsContent>
          <TabsContent className="rounded-md border p-4 text-sm" value="settings">
            Settings content
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('tabs.variants.underlineStyle')}</div>
        <Tabs defaultValue="details" className="border-b">
          <TabsList className="h-auto w-full rounded-none border-b-0 bg-transparent p-0">
            <TabsTrigger
              value="details"
              className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Details
            </TabsTrigger>
            <TabsTrigger
              value="specs"
              className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Specifications
            </TabsTrigger>
            <TabsTrigger
              value="reviews"
              className="data-[state=active]:border-primary rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Reviews
            </TabsTrigger>
          </TabsList>
          <TabsContent className="pt-4 text-sm" value="details">
            Product details content
          </TabsContent>
          <TabsContent className="pt-4 text-sm" value="specs">
            Specifications content
          </TabsContent>
          <TabsContent className="pt-4 text-sm" value="reviews">
            Reviews content
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('tabs.variants.withDisabledTab')}</div>
        <Tabs defaultValue="enabled1">
          <TabsList className="w-full">
            <TabsTrigger value="enabled1">{i18n.t('tabs.story.enabled', 'Enabled')}</TabsTrigger>
            <TabsTrigger value="disabled" disabled>
              Disabled
            </TabsTrigger>
            <TabsTrigger value="enabled2">{i18n.t('tabs.story.enabled', 'Enabled')}</TabsTrigger>
          </TabsList>
          <TabsContent className="rounded-md border p-4 text-sm" value="enabled1">
            First enabled tab content
          </TabsContent>
          <TabsContent className="rounded-md border p-4 text-sm" value="disabled">
            Disabled tab content
          </TabsContent>
          <TabsContent className="rounded-md border p-4 text-sm" value="enabled2">
            Second enabled tab content
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabsRoots = canvasElement.querySelectorAll('[data-slot="tabs"]');
    expect(tabsRoots.length).toBe(4);
    expect(canvas.getByText('Overview')).toBeInTheDocument();
    expect(canvas.getByText('Analytics')).toBeInTheDocument();
    expect(canvas.getByText('Reports')).toBeInTheDocument();
    expect(canvas.getByText('Home')).toBeInTheDocument();
    expect(canvas.getByText('Settings')).toBeInTheDocument();
    expect(canvas.getByText('Details')).toBeInTheDocument();
    expect(canvas.getByText('Specifications')).toBeInTheDocument();
    expect(canvas.getByText('Reviews')).toBeInTheDocument();
  },
};

// ============ SIZES ============

function SizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex w-[500px] flex-col gap-8">
      <div className="space-y-2">
        <div className="text-sm font-medium">{t('tabs.sizes.compact')}</div>
        <Tabs defaultValue="tab1">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="tab1" className="px-2 py-1 text-xs">
              Tab 1
            </TabsTrigger>
            <TabsTrigger value="tab2" className="px-2 py-1 text-xs">
              Tab 2
            </TabsTrigger>
            <TabsTrigger value="tab3" className="px-2 py-1 text-xs">
              Tab 3
            </TabsTrigger>
          </TabsList>
          <TabsContent className="rounded-md border p-3 text-xs" value="tab1">
            Compact tab content
          </TabsContent>
          <TabsContent className="rounded-md border p-3 text-xs" value="tab2">
            Compact tab content
          </TabsContent>
          <TabsContent className="rounded-md border p-3 text-xs" value="tab3">
            Compact tab content
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{t('tabs.sizes.default')}</div>
        <Tabs defaultValue="tab1">
          <TabsList className="w-full">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent className="rounded-md border p-4 text-sm" value="tab1">
            Default size tab content
          </TabsContent>
          <TabsContent className="rounded-md border p-4 text-sm" value="tab2">
            Default size tab content
          </TabsContent>
          <TabsContent className="rounded-md border p-4 text-sm" value="tab3">
            Default size tab content
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{t('tabs.sizes.large')}</div>
        <Tabs defaultValue="tab1">
          <TabsList className="h-12 w-full">
            <TabsTrigger value="tab1" className="px-6 py-3 text-base">
              Tab 1
            </TabsTrigger>
            <TabsTrigger value="tab2" className="px-6 py-3 text-base">
              Tab 2
            </TabsTrigger>
            <TabsTrigger value="tab3" className="px-6 py-3 text-base">
              Tab 3
            </TabsTrigger>
          </TabsList>
          <TabsContent className="rounded-md border p-6 text-base" value="tab1">
            Large tab content
          </TabsContent>
          <TabsContent className="rounded-md border p-6 text-base" value="tab2">
            Large tab content
          </TabsContent>
          <TabsContent className="rounded-md border p-6 text-base" value="tab3">
            Large tab content
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabsRoots = canvasElement.querySelectorAll('[data-slot="tabs"]');
    expect(tabsRoots.length).toBe(3);
    expect(canvas.getByText(/Compact/i)).toBeInTheDocument();
    expect(canvas.getByText(/Default/i)).toBeInTheDocument();
    expect(canvas.getByText(/Large/i)).toBeInTheDocument();
    const tabLists = canvasElement.querySelectorAll('[data-slot="tabs-list"]');
    expect(tabLists.length).toBe(3);
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabsRoot = canvasElement.querySelector('[data-slot="tabs"]');
    expect(tabsRoot).toBeInTheDocument();
    const tabList = canvas.getByRole('tablist');
    expect(tabList).toBeInTheDocument();
    const tabs = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(tabs.length).toBe(3);
    const accountTab = canvasElement.querySelector('[data-tabs-trigger="account"]');
    expect(accountTab).toBeInTheDocument();
    expect(accountTab?.getAttribute('data-state')).toBe('active');
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabsRoot = canvasElement.querySelector('[data-slot="tabs"]');
    expect(tabsRoot).toBeInTheDocument();
    const tabList = canvas.getByRole('tablist');
    expect(tabList).toBeInTheDocument();
    const tabs = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(tabs.length).toBe(3);
    const passwordTab = canvasElement.querySelector('[data-tabs-trigger="password"]');
    expect(passwordTab).toBeInTheDocument();
    await userEvent.click(passwordTab!);
    await waitFor(() => {
      expect(passwordTab?.getAttribute('aria-selected')).toBe('true');
      expect(passwordTab?.getAttribute('data-state')).toBe('active');
    });
    const passwordContent = canvasElement.querySelector('[data-tabs-content="password"]');
    expect(passwordContent).toBeInTheDocument();
    expect(passwordContent?.getAttribute('data-state')).toBe('active');
  },
};

export const Japanese: Story = {
  globals: {
    locale: 'ja',
  },
  render: () => <I18nTabsDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    await Default.play?.(context);

    const canvas = within(context.canvasElement);
    expect(canvas.getByText('アカウント')).toBeInTheDocument();
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
  name: i18n.t('tabs.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ FAKER DATA STORIES ============

export const WithFakerData: Story = {
  render: (args) => <TabsWithFakerData {...args} tabCount={4} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="tabs"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(4);
  },
};

export const WithAsyncData: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsHandlers },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="tabs-async"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP 4xx ERROR STORIES ============

export const Error400BadRequest: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="tabs-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error401Unauthorized: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="tabs-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="tabs-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error404NotFound: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="tabs-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="tabs-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP 5xx ERROR STORIES ============

export const Error422UnprocessableEntity: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="tabs-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error500InternalServerError: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="tabs-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="tabs-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="tabs-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="tabs-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ SPECIAL STATE STORIES ============

export const Loading: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-testid="tabs-loading"]')).toBeInTheDocument();
    });
  },
};

export const EmptyData: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="tabs-empty"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const SlowResponse: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="tabs-loading"]')).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  render: (args) => <TabsWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: tabsStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="tabs-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  name: i18n.t('tabs.storyName.accessibility', 'Accessibility (Keyboard Navigation)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const tabsRoot = canvasElement.querySelector('[data-slot="tabs"]');
    if (!(tabsRoot instanceof HTMLElement)) {
      throw new Error('Tabs root was not found.');
    }

    // Verify ARIA roles
    const tabList = canvasElement.querySelector('[role="tablist"]');
    expect(tabList).toBeInTheDocument();

    const tabs = canvasElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).not.toBe(0);

    const tabPanels = canvasElement.querySelectorAll('[role="tabpanel"]');
    expect(tabPanels.length).not.toBe(0);

    // Get tab triggers
    const accountTab = canvasElement.querySelector('[data-tabs-trigger="account"]');
    const passwordTab = canvasElement.querySelector('[data-tabs-trigger="password"]');
    const billingTab = canvasElement.querySelector('[data-tabs-trigger="billing"]');

    if (!(accountTab instanceof HTMLElement)) throw new Error('Account tab was not found.');
    if (!(passwordTab instanceof HTMLElement)) throw new Error('Password tab was not found.');
    if (!(billingTab instanceof HTMLElement)) throw new Error('Billing tab was not found.');

    // Focus on first tab
    accountTab.focus();
    expect(canvasElement.ownerDocument.activeElement).toBe(accountTab);

    // Test Arrow Right navigation
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(canvasElement.ownerDocument.activeElement).toBe(passwordTab);
    });

    // Test Arrow Right again
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(canvasElement.ownerDocument.activeElement).toBe(billingTab);
    });

    // Test Arrow Left navigation
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(canvasElement.ownerDocument.activeElement).toBe(passwordTab);
    });

    // Test Enter key to activate tab
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(passwordTab.getAttribute('aria-selected')).toBe('true');
      expect(passwordTab.getAttribute('data-state')).toBe('active');
    });

    // Test Home key to go to first tab
    await userEvent.keyboard('{Home}');
    await waitFor(() => {
      expect(canvasElement.ownerDocument.activeElement).toBe(accountTab);
    });

    // Test End key to go to last tab
    await userEvent.keyboard('{End}');
    await waitFor(() => {
      expect(canvasElement.ownerDocument.activeElement).toBe(billingTab);
    });

    // Verify aria-controls attribute links tab to tabpanel
    const ariaControls = accountTab.getAttribute('aria-controls');
    expect(ariaControls).toBeInTheDocument();

    const linkedPanel = canvasElement.querySelector(`#${ariaControls}`);
    expect(linkedPanel).toBeInTheDocument();
    expect(linkedPanel?.getAttribute('role')).toBe('tabpanel');
  },
};

// ============ HELPER: Render FakeTab[] ============

function RenderFakeTabs({ tabs, orientation }: { orientation?: TabsOrientation; tabs: FakeTab[] }) {
  const defaultTab = tabs[0]?.id ?? 'tab-0';

  return (
    <Tabs
      className={orientation === 'vertical' ? 'flex w-[600px] gap-4' : 'w-[500px]'}
      defaultValue={defaultTab}
      orientation={orientation}
      data-testid="factory-tabs"
    >
      <TabsList className={orientation === 'vertical' ? 'flex-col' : 'w-full'}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            data-tabs-trigger={tab.id}
          >
            {tab.label}
            {tab.badge != null && (
              <span className="bg-primary/20 ml-1.5 rounded-full px-1.5 text-xs">{tab.badge}</span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          className="rounded-md border p-4 text-sm"
          data-tabs-content={tab.id}
        >
          {tab.loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            tab.content
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

// ============ HELPER: Render FakeTabsConfig ============

function RenderFakeTabsConfig({ config }: { config: FakeTabsConfig }) {
  const defaultTab = config.defaultValue ?? config.tabs[0]?.id ?? 'tab-0';

  return (
    <Tabs
      className={config.orientation === 'vertical' ? 'flex w-[600px] gap-4' : 'w-[500px]'}
      defaultValue={defaultTab}
      orientation={config.orientation}
      data-testid="factory-tabs-config"
    >
      <TabsList className={config.orientation === 'vertical' ? 'flex-col' : 'w-full'}>
        {config.tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            data-tabs-trigger={tab.id}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {config.tabs.map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          className="rounded-md border p-4 text-sm"
          data-tabs-content={tab.id}
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

// ============ FACTORY: SINGLE ITEM FACTORIES ============

function FactorySingleTabDemo() {
  const { t } = useTranslation();
  const tab = createFakeTab();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{t('tabs.factory.singleTab')}</div>
      <RenderFakeTabs tabs={[tab]} />
    </div>
  );
}

export const FactorySingleTab: Story = {
  render: () => <FactorySingleTabDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(1);
  },
};

function FactorySingleTabDisabledDemo() {
  const tab = createFakeTabDisabled();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.singleTabDisabled')}</div>
      <RenderFakeTabs tabs={[tab]} />
    </div>
  );
}

export const FactorySingleTabDisabled: Story = {
  render: () => <FactorySingleTabDisabledDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-slot="tabs-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.getAttribute('disabled')).toBeDefined();
  },
};

function FactorySingleTabWithIconDemo() {
  const tab = createFakeTabWithIcon('Star');

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.singleTabWithIcon')}</div>
      <RenderFakeTabs tabs={[tab]} />
    </div>
  );
}

export const FactorySingleTabWithIcon: Story = {
  render: () => <FactorySingleTabWithIconDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(1);
  },
};

function FactorySingleTabWithBadgeDemo() {
  const tab = createFakeTabWithBadge(42);

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.singleTabWithBadge')}</div>
      <RenderFakeTabs tabs={[tab]} />
    </div>
  );
}

export const FactorySingleTabWithBadge: Story = {
  render: () => <FactorySingleTabWithBadgeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    expect(canvas.getByText('42')).toBeInTheDocument();
  },
};

function FactorySingleTabClosableDemo() {
  const tab = createFakeTabClosable();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.singleTabClosable')}</div>
      <RenderFakeTabs tabs={[tab]} />
    </div>
  );
}

export const FactorySingleTabClosable: Story = {
  render: () => <FactorySingleTabClosableDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(1);
  },
};

function FactorySingleTabLoadingDemo() {
  const tab = createFakeTabLoading();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.singleTabLoading')}</div>
      <RenderFakeTabs tabs={[tab]} />
    </div>
  );
}

export const FactorySingleTabLoading: Story = {
  render: () => <FactorySingleTabLoadingDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(1);
  },
};

// ============ FACTORY: TABS CONFIG ============

function FactoryTabsConfigDemo() {
  const config = createFakeTabsConfig();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.tabsConfig')}</div>
      <RenderFakeTabsConfig config={config} />
    </div>
  );
}

export const FactoryTabsConfig: Story = {
  render: () => <FactoryTabsConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs-config')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBeGreaterThanOrEqual(3);
  },
};

function FactoryMultipleConfigsDemo() {
  const configs = createFakeTabsConfigs(3);

  return (
    <div className="flex w-[600px] flex-col gap-8">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.multipleConfigs')}</div>
      {configs.map((config) => (
        <RenderFakeTabsConfig key={config.id} config={config} />
      ))}
    </div>
  );
}

export const FactoryMultipleConfigs: Story = {
  render: () => <FactoryMultipleConfigsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabsRoots = canvasElement.querySelectorAll('[data-testid="factory-tabs-config"]');
    expect(tabsRoots.length).toBe(3);
    expect(canvas.getByText(/Multiple Tabs Configurations|複数タブ設定/)).toBeInTheDocument();
  },
};

// ============ FACTORY: SCENARIO-BASED TAB SETS ============

function FactoryAccountSettingsDemo() {
  const tabs = createFakeAccountSettingsTabs();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.accountSettings')}</div>
      <RenderFakeTabs tabs={tabs} />
    </div>
  );
}

export const FactoryAccountSettings: Story = {
  render: () => <FactoryAccountSettingsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(5);
    expect(canvasElement.querySelector('[data-tabs-trigger="account"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="security"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="notifications"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="billing"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="integrations"]')).toBeInTheDocument();
  },
};

function FactoryDashboardDemo() {
  const { t } = useTranslation();
  const tabs = createFakeDashboardTabs();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{t('tabs.factory.dashboard')}</div>
      <RenderFakeTabs tabs={tabs} />
    </div>
  );
}

export const FactoryDashboard: Story = {
  render: () => <FactoryDashboardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(4);
    expect(canvasElement.querySelector('[data-tabs-trigger="overview"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="analytics"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="reports"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="activity"]')).toBeInTheDocument();
  },
};

function FactoryFileBrowserDemo() {
  const { t } = useTranslation();
  const tabs = createFakeFileBrowserTabs();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{t('tabs.factory.fileBrowser')}</div>
      <RenderFakeTabs tabs={tabs} />
    </div>
  );
}

export const FactoryFileBrowser: Story = {
  render: () => <FactoryFileBrowserDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(3);
    expect(canvasElement.querySelector('[data-tabs-trigger="file1"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="file2"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="file3"]')).toBeInTheDocument();
  },
};

function FactoryTabsWithDisabledDemo() {
  const tabs = createFakeTabsWithDisabled();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.disabledItems')}</div>
      <RenderFakeTabs tabs={tabs} />
    </div>
  );
}

export const FactoryTabsWithDisabled: Story = {
  render: () => <FactoryTabsWithDisabledDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(4);
    const disabledTriggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"][disabled]');
    expect(disabledTriggers.length).toBe(2);
  },
};

function FactoryTabsAllWithIconsDemo() {
  const tabs = createFakeTabsAllWithIcons();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.allWithIcons')}</div>
      <RenderFakeTabs tabs={tabs} />
    </div>
  );
}

export const FactoryTabsAllWithIcons: Story = {
  render: () => <FactoryTabsAllWithIconsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(5);
  },
};

function FactoryTabsAllWithBadgesDemo() {
  const tabs = createFakeTabsAllWithBadges();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.allWithBadges')}</div>
      <RenderFakeTabs tabs={tabs} />
    </div>
  );
}

export const FactoryTabsAllWithBadges: Story = {
  render: () => <FactoryTabsAllWithBadgesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(4);
    const badges = canvasElement.querySelectorAll('.rounded-full');
    expect(badges.length).toBe(4);
  },
};

// ============ FACTORY: MATRIX FACTORIES ============

function FactoryVariantSizeMatrixDemo() {
  const matrix = createFakeTabsVariantSizeMatrix();

  return (
    <div className="flex w-[700px] flex-col gap-8">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.variantSizeMatrix')}</div>
      {matrix.map((row, rowIndex) => (
        <div key={TABS_VARIANTS[rowIndex]} className="space-y-4">
          <div className="text-muted-foreground text-xs font-semibold uppercase">
            Variant: {TABS_VARIANTS[rowIndex]}
          </div>
          {row.map((config, colIndex) => (
            <div key={config.id} className="space-y-1">
              <div className="text-muted-foreground text-xs">Size: {TABS_SIZES[colIndex]}</div>
              <RenderFakeTabsConfig config={config} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export const FactoryVariantSizeMatrix: Story = {
  render: () => <FactoryVariantSizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabsRoots = canvasElement.querySelectorAll('[data-testid="factory-tabs-config"]');
    expect(tabsRoots.length).toBe(TABS_VARIANTS.length * TABS_SIZES.length);
    expect(canvas.getByText(/Variant: default/)).toBeInTheDocument();
  },
};

function FactoryVariantOrientationMatrixDemo() {
  const matrix = createFakeTabsVariantOrientationMatrix();

  return (
    <div className="flex w-[700px] flex-col gap-8">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.variantOrientationMatrix')}</div>
      {matrix.map((row, rowIndex) => (
        <div key={TABS_VARIANTS[rowIndex]} className="space-y-4">
          <div className="text-muted-foreground text-xs font-semibold uppercase">
            Variant: {TABS_VARIANTS[rowIndex]}
          </div>
          {row.map((config) => (
            <div key={config.id} className="space-y-1">
              <div className="text-muted-foreground text-xs">Orientation: {config.orientation}</div>
              <RenderFakeTabsConfig config={config} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export const FactoryVariantOrientationMatrix: Story = {
  render: () => <FactoryVariantOrientationMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabsRoots = canvasElement.querySelectorAll('[data-testid="factory-tabs-config"]');
    expect(tabsRoots.length).toBe(TABS_VARIANTS.length * TABS_ORIENTATIONS.length);
    expect(canvas.getByText(/Variant: default/)).toBeInTheDocument();
  },
};

function FactoryAllVariantsDemo() {
  const configs = createFakeTabsAllVariants();

  return (
    <div className="flex w-[600px] flex-col gap-8">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.allVariants')}</div>
      {configs.map((config, index) => (
        <div key={config.id} className="space-y-1">
          <div className="text-muted-foreground text-xs">Variant: {TABS_VARIANTS[index]}</div>
          <RenderFakeTabsConfig config={config} />
        </div>
      ))}
    </div>
  );
}

export const FactoryAllVariants: Story = {
  render: () => <FactoryAllVariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabsRoots = canvasElement.querySelectorAll('[data-testid="factory-tabs-config"]');
    expect(tabsRoots.length).toBe(TABS_VARIANTS.length);
    expect(canvas.getByText(/All Variants|全バリアント/)).toBeInTheDocument();
  },
};

function FactoryAllSizesDemo() {
  const configs = createFakeTabsAllSizes();

  return (
    <div className="flex w-[600px] flex-col gap-8">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.allSizes')}</div>
      {configs.map((config, index) => (
        <div key={config.id} className="space-y-1">
          <div className="text-muted-foreground text-xs">Size: {TABS_SIZES[index]}</div>
          <RenderFakeTabsConfig config={config} />
        </div>
      ))}
    </div>
  );
}

export const FactoryAllSizes: Story = {
  render: () => <FactoryAllSizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabsRoots = canvasElement.querySelectorAll('[data-testid="factory-tabs-config"]');
    expect(tabsRoots.length).toBe(TABS_SIZES.length);
    expect(canvas.getByText(/All Sizes|全サイズ/)).toBeInTheDocument();
  },
};

function FactoryAllOrientationsDemo() {
  const configs = createFakeTabsAllOrientations();

  return (
    <div className="flex w-[700px] flex-col gap-8">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.allOrientations')}</div>
      {configs.map((config, index) => (
        <div key={config.id} className="space-y-1">
          <div className="text-muted-foreground text-xs">
            Orientation: {TABS_ORIENTATIONS[index]}
          </div>
          <RenderFakeTabsConfig config={config} />
        </div>
      ))}
    </div>
  );
}

export const FactoryAllOrientations: Story = {
  render: () => <FactoryAllOrientationsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabsRoots = canvasElement.querySelectorAll('[data-testid="factory-tabs-config"]');
    expect(tabsRoots.length).toBe(TABS_ORIENTATIONS.length);
    expect(canvas.getByText(/All Orientations|全方向/)).toBeInTheDocument();
  },
};

// ============ FACTORY: ENTERPRISE FEATURES ============

function FactoryAccessibleTabsDemo() {
  const config = createFakeAccessibleTabs();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.accessible')}</div>
      <RenderFakeTabsConfig config={config} />
    </div>
  );
}

export const FactoryAccessibleTabs: Story = {
  render: () => <FactoryAccessibleTabsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs-config')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(3);
    expect(canvasElement.querySelector('[data-tabs-trigger="tab1"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="tab2"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="tab3"]')).toBeInTheDocument();
  },
};

function FactoryAsyncTabsDemo() {
  const asyncTabs = createFakeAsyncTabs();
  const [loadedContent, setLoadedContent] = useState<Record<string, string>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, string>>({});

  useEffect(() => {
    for (const tab of asyncTabs) {
      if (tab.asyncContent) {
        setLoadingStates((prev) => ({ ...prev, [tab.id]: 'loading' }));
        tab
          .asyncContent()
          .then((content) => {
            setLoadedContent((prev) => ({ ...prev, [tab.id]: content }));
            setLoadingStates((prev) => ({ ...prev, [tab.id]: 'success' }));
            return undefined;
          })
          .catch(() => {
            setLoadingStates((prev) => ({ ...prev, [tab.id]: 'error' }));
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.async')}</div>
      <Tabs className="w-[500px]" defaultValue={asyncTabs[0]?.id} data-testid="factory-async-tabs">
        <TabsList className="w-full">
          {asyncTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} data-tabs-trigger={tab.id}>
              {tab.label}
              {loadingStates[tab.id] === 'loading' && (
                <span className="text-muted-foreground ml-1 text-xs">...</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {asyncTabs.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            className="rounded-md border p-4 text-sm"
            data-tabs-content={tab.id}
          >
            {loadingStates[tab.id] === 'loading' && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}
            {loadingStates[tab.id] === 'success' && loadedContent[tab.id]}
            {loadingStates[tab.id] === 'error' && (
              <Alert variant="destructive">
                <AlertTitle>{i18n.t('tabs.story.error', 'Error')}</AlertTitle>
                <AlertDescription>
                  {i18n.t('tabs.story.failedToLoadContent', 'Failed to load content.')}
                </AlertDescription>
              </Alert>
            )}
            {!loadingStates[tab.id] && tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export const FactoryAsyncTabs: Story = {
  render: () => <FactoryAsyncTabsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-async-tabs')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(3);
  },
};

function FactoryKeyboardNavTabsDemo() {
  const config = createFakeKeyboardNavigationTabs();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.keyboardNav')}</div>
      <RenderFakeTabsConfig config={config} />
    </div>
  );
}

export const FactoryKeyboardNavTabs: Story = {
  render: () => <FactoryKeyboardNavTabsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs-config')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(5);
    const firstTrigger = canvasElement.querySelector('[data-tabs-trigger="nav-tab-0"]');
    expect(firstTrigger).toBeInTheDocument();
    if (firstTrigger instanceof HTMLElement) {
      firstTrigger.focus();
      await userEvent.keyboard('{ArrowRight}');
      await waitFor(() => {
        const secondTrigger = canvasElement.querySelector('[data-tabs-trigger="nav-tab-1"]');
        expect(canvasElement.ownerDocument.activeElement).toBe(secondTrigger);
      });
    }
  },
};

function FactoryWizardTabsDemo() {
  const tabs = createFakeWizardTabs();

  return (
    <div className="w-[500px] space-y-2">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.wizard')}</div>
      <RenderFakeTabs tabs={tabs} />
    </div>
  );
}

export const FactoryWizardTabs: Story = {
  render: () => <FactoryWizardTabsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(4);
    expect(canvasElement.querySelector('[data-tabs-trigger="step1"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="step2"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="step3"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="step4"]')).toBeInTheDocument();
    expect(canvas.getByText('1')).toBeInTheDocument();
    expect(canvas.getByText('2')).toBeInTheDocument();
    expect(canvas.getByText('3')).toBeInTheDocument();
    expect(canvas.getByText('4')).toBeInTheDocument();
  },
};

function FactoryVerticalNavTabsDemo() {
  const { t } = useTranslation();
  const config = createFakeVerticalNavTabs();

  return (
    <div className="w-[700px] space-y-2">
      <div className="text-sm font-medium">{t('tabs.factory.verticalNav')}</div>
      <RenderFakeTabsConfig config={config} />
    </div>
  );
}

export const FactoryVerticalNavTabs: Story = {
  render: () => <FactoryVerticalNavTabsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs-config')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(5);
    expect(canvasElement.querySelector('[data-tabs-trigger="home"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="profile"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="settings"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="notifications"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="logout"]')).toBeInTheDocument();
  },
};

function FactoryRTLTabsDemo() {
  const { t } = useTranslation();
  const config = createFakeRTLTabs();

  return (
    <div className="w-[500px] space-y-2" dir="rtl">
      <div className="text-sm font-medium">{t('tabs.factory.rtl')}</div>
      <RenderFakeTabsConfig config={config} />
    </div>
  );
}

export const FactoryRTLTabs: Story = {
  render: () => <FactoryRTLTabsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-tabs-config')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(3);
    expect(canvasElement.querySelector('[data-tabs-trigger="rtl1"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="rtl2"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-tabs-trigger="rtl3"]')).toBeInTheDocument();
  },
};

function FactoryEnterpriseTabsSetDemo() {
  const configs = createFakeEnterpriseTabsSet();

  return (
    <div className="flex w-[700px] flex-col gap-8">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.enterprise')}</div>
      {configs.map((config) => (
        <div key={config.id} className="space-y-1">
          <div className="text-muted-foreground text-xs">
            {config.variant} / {config.orientation}
          </div>
          <RenderFakeTabsConfig config={config} />
        </div>
      ))}
    </div>
  );
}

export const FactoryEnterpriseTabsSet: Story = {
  render: () => <FactoryEnterpriseTabsSetDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabsRoots = canvasElement.querySelectorAll('[data-testid="factory-tabs-config"]');
    expect(tabsRoots.length).toBe(5);
    expect(canvas.getByText(/Enterprise Tabs Set|エンタープライズタブセット/)).toBeInTheDocument();
  },
};

// ============ FACTORY: CONSTANTS SHOWCASE ============

function FactoryConstantsDemo() {
  return (
    <div className="flex w-[600px] flex-col gap-6">
      <div className="text-sm font-medium">{i18n.t('tabs.factory.allVariants')}</div>
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs font-semibold uppercase">
          TABS_VARIANTS ({TABS_VARIANTS.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS_VARIANTS.map((v: TabsVariant) => (
            <span key={v} className="bg-muted rounded px-2 py-1 text-xs">
              {v}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs font-semibold uppercase">
          TABS_SIZES ({TABS_SIZES.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS_SIZES.map((s: TabsSize) => (
            <span key={s} className="bg-muted rounded px-2 py-1 text-xs">
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs font-semibold uppercase">
          TABS_ORIENTATIONS ({TABS_ORIENTATIONS.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS_ORIENTATIONS.map((o: TabsOrientation) => (
            <span key={o} className="bg-muted rounded px-2 py-1 text-xs">
              {o}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs font-semibold uppercase">
          TABS_ACTIVATION_MODES ({TABS_ACTIVATION_MODES.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS_ACTIVATION_MODES.map((m: TabsActivationMode) => (
            <span key={m} className="bg-muted rounded px-2 py-1 text-xs">
              {m}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs font-semibold uppercase">
          TAB_ICONS ({TAB_ICONS.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {TAB_ICONS.map((icon) => (
            <span key={icon} className="bg-muted rounded px-2 py-1 text-xs">
              {icon}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs font-semibold uppercase">
          TAB_LABELS ({TAB_LABELS.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {TAB_LABELS.map((label) => (
            <span key={label} className="bg-muted rounded px-2 py-1 text-xs">
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs font-semibold uppercase">
          TAB_CONTENT_SAMPLES ({TAB_CONTENT_SAMPLES.length})
        </div>
        <div className="flex flex-col gap-1">
          {TAB_CONTENT_SAMPLES.map((content) => (
            <span key={content} className="text-muted-foreground text-xs">
              {content}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  render: () => <FactoryConstantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(`TABS_VARIANTS (${TABS_VARIANTS.length})`)).toBeInTheDocument();
    expect(canvas.getByText(`TABS_SIZES (${TABS_SIZES.length})`)).toBeInTheDocument();
    expect(canvas.getByText(`TABS_ORIENTATIONS (${TABS_ORIENTATIONS.length})`)).toBeInTheDocument();
    expect(
      canvas.getByText(`TABS_ACTIVATION_MODES (${TABS_ACTIVATION_MODES.length})`)
    ).toBeInTheDocument();
    expect(canvas.getByText(`TAB_ICONS (${TAB_ICONS.length})`)).toBeInTheDocument();
    expect(canvas.getByText(`TAB_LABELS (${TAB_LABELS.length})`)).toBeInTheDocument();
    expect(
      canvas.getByText(`TAB_CONTENT_SAMPLES (${TAB_CONTENT_SAMPLES.length})`)
    ).toBeInTheDocument();
    expect(canvas.getByText('default')).toBeInTheDocument();
    expect(canvas.getByText('pills')).toBeInTheDocument();
    expect(canvas.getByText('Home')).toBeInTheDocument();
    expect(canvas.getByText('Overview')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('tabs.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('tabs.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('tabs.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('tabs.storyName.dataAttributes', 'Data Attributes'),
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
  name: i18n.t('tabs.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: tabsStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('tabs.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: tabsStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
