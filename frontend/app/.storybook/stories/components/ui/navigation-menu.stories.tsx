import type { Meta, StoryObj } from '@storybook/react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useEffect, useState } from 'react';

import { type FakeMenuItem } from '@/.storybook/stories/_factories/menu.factory';
import {
  createFakeDisabledItemsNavigation,
  createFakeDocsNavigation,
  createFakeEcommerceNavigation,
  createFakeFeaturedItem,
  createFakeIconNavigation,
  createFakeMegaMenuNavigation,
  createFakeNavigationMenu,
  createFakeNavigationMenuContent,
  createFakeNavigationMenuGroup,
  createFakeNavigationMenuItem,
  createFakeNavigationMenuItems,
  createFakeNavigationMenuLink,
  createFakeNavigationMenuLinks,
  createFakeSimpleLinkNavigation,
  createFakeVerticalNavigation,
  createNavigationMenuContentLayoutMatrix,
  createNavigationMenuLinkStyleMatrix,
  createNavigationMenuOrientationMatrix,
  createNavigationMenuShowcase,
  createNavigationMenuTestData,
  type FakeNavigationMenu,
  type FakeNavigationMenuContent,
  type FakeNavigationMenuFeaturedItem,
  type FakeNavigationMenuGroup,
  type FakeNavigationMenuItem,
  type FakeNavigationMenuLink,
  NAVIGATION_MENU_CONTENT_LAYOUTS,
  NAVIGATION_MENU_CONTENT_POSITIONS,
  NAVIGATION_MENU_ITEM_TYPES,
  NAVIGATION_MENU_LINK_STYLES,
  NAVIGATION_MENU_ORIENTATIONS,
  NAVIGATION_MENU_STATES,
  type NavigationMenuContentLayout,
  type NavigationMenuContentPosition,
  type NavigationMenuItemType,
  type NavigationMenuLinkStyle,
  type NavigationMenuOrientation,
  type NavigationMenuState,
} from '@/.storybook/stories/_factories/navigation-menu.factory';
import {
  navigationMenuHandlers,
  navigationMenuStatusHandlers,
} from '@/.storybook/stories/_handlers/navigation-menu.handlers';
import { navigationStatusHandlers } from '@/.storybook/stories/_handlers/navigation.handlers';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============ ASYNC DATA DEMO COMPONENTS ============

interface NavigationMenuWithAsyncDataProps {
  apiEndpoint?: string;
  onBlur?: () => void;
  onClick?: () => void;
  onFocus?: () => void;
  onKeyDown?: () => void;
  onValueChange?: (value: string) => void;
}

function NavigationMenuWithAsyncData({
  apiEndpoint = '/api/menu-items',
  onValueChange,
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
}: NavigationMenuWithAsyncDataProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<FakeMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${apiEndpoint}?count=4&submenus=true`);
        if (!response.ok) {
          const errorData = (await response.json()) as { message?: string };
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as { items?: FakeMenuItem[] };
        setItems(data.items || []);
      } catch (error_) {
        setError(error_ instanceof Error ? error_.message : 'Failed to load menu');
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [apiEndpoint]);

  if (loading) {
    return (
      <div className="flex gap-4" data-testid="nav-menu-loading">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="w-[400px]" data-testid="nav-menu-error">
        <AlertTitle>{t('navigationMenu.story.error', 'Error')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className="text-muted-foreground rounded-md border p-8 text-center"
        data-testid="nav-menu-empty"
      >
        No menu items available
      </div>
    );
  }

  return (
    <NavigationMenu
      onValueChange={onValueChange}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      data-testid="nav-menu-async"
    >
      <NavigationMenuList>
        {items.map((item) => (
          <NavigationMenuItem key={item.id}>
            {item.submenu && item.submenu.length > 0 ? (
              <>
                <NavigationMenuTrigger data-nav-trigger={item.id}>
                  {item.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent data-nav-content={item.id}>
                  <div className="grid gap-2 p-4 md:w-[400px]">
                    {item.submenu.map((subItem) => (
                      <NavigationMenuLink
                        key={subItem.id}
                        data-nav-link={subItem.id}
                        href="#"
                        onClick={(e) => e.preventDefault()}
                      >
                        <div className="font-medium">{subItem.label}</div>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </>
            ) : (
              <NavigationMenuLink
                data-nav-link={item.id}
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                {item.label}
              </NavigationMenuLink>
            )}
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
      <NavigationMenuIndicator />
    </NavigationMenu>
  );
}

function NavigationMenuDemo() {
  const { t } = useTranslation();

  return (
    <NavigationMenu data-testid="navigation-menu-demo">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger data-nav-trigger="getting-started">
            {t('navigationMenu.section.gettingStarted')}
          </NavigationMenuTrigger>
          <NavigationMenuContent data-nav-content="getting-started">
            <div className="grid gap-2 p-2 md:w-[400px]">
              <NavigationMenuLink
                data-nav-link="introduction"
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                <div className="font-medium" data-nav-title="introduction">
                  {t('navigationMenu.item.introduction.title')}
                </div>
                <div className="text-muted-foreground text-sm" data-nav-description="introduction">
                  {t('navigationMenu.item.introduction.description')}
                </div>
              </NavigationMenuLink>
              <NavigationMenuLink
                data-nav-link="installation"
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                <div className="font-medium" data-nav-title="installation">
                  {t('navigationMenu.item.installation.title')}
                </div>
                <div className="text-muted-foreground text-sm" data-nav-description="installation">
                  {t('navigationMenu.item.installation.description')}
                </div>
              </NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger data-nav-trigger="components">
            {t('navigationMenu.section.components')}
          </NavigationMenuTrigger>
          <NavigationMenuContent data-nav-content="components">
            <div className="grid gap-2 p-2 md:w-[400px]">
              <NavigationMenuLink
                data-nav-link="buttons"
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                <div className="font-medium" data-nav-title="buttons">
                  {t('navigationMenu.item.buttons.title')}
                </div>
                <div className="text-muted-foreground text-sm" data-nav-description="buttons">
                  {t('navigationMenu.item.buttons.description')}
                </div>
              </NavigationMenuLink>
              <NavigationMenuLink
                data-nav-link="forms"
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                <div className="font-medium" data-nav-title="forms">
                  {t('navigationMenu.item.forms.title')}
                </div>
                <div className="text-muted-foreground text-sm" data-nav-description="forms">
                  {t('navigationMenu.item.forms.description')}
                </div>
              </NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
      <NavigationMenuIndicator />
    </NavigationMenu>
  );
}

const meta = {
  title: 'Components/UI/Navigation Menu',
  component: NavigationMenuDemo,
  tags: ['autodocs'],
  args: {
    onValueChange: fn(),
    onSelect: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  argTypes: {
    // Content
    children: {
      control: false,
      description: i18n.t(
        'navigationMenu.argType.navigationmenulistAndNavigationmenuindicatorElements',
        'NavigationMenuList and NavigationMenuIndicator elements'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t(
        'navigationMenu.argType.additionalCssClassesForCustomStyling',
        'Additional CSS classes for custom styling'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    value: {
      control: 'text',
      description: i18n.t(
        'navigationMenu.argType.controlledActiveMenuValue',
        'Controlled active menu value'
      ),
      table: {
        category: 'State',
        type: { summary: 'string' },
      },
    },
    defaultValue: {
      control: 'text',
      description: i18n.t(
        'navigationMenu.argType.defaultActiveMenuForUncontrolledUsage',
        'Default active menu for uncontrolled usage'
      ),
      table: {
        category: 'State',
        type: { summary: 'string' },
      },
    },
    delayDuration: {
      control: 'number',
      description: i18n.t(
        'navigationMenu.argType.delayBeforeOpeningOnHoverMs',
        'Delay before opening on hover (ms)'
      ),
      table: {
        category: 'State',
        type: { summary: 'number' },
        defaultValue: { summary: '200' },
      },
    },
    skipDelayDuration: {
      control: 'number',
      description: i18n.t(
        'navigationMenu.argType.delayBeforeSkippingSubsequentDelaysMs',
        'Delay before skipping subsequent delays (ms)'
      ),
      table: {
        category: 'State',
        type: { summary: 'number' },
        defaultValue: { summary: '300' },
      },
    },
    // Layout
    dir: {
      control: 'radio',
      options: ['ltr', 'rtl'],
      description: i18n.t(
        'navigationMenu.argType.readingDirectionForTheNavigationMenu',
        'Reading direction for the navigation menu'
      ),
      table: {
        category: 'Layout',
        type: { summary: "'ltr' | 'rtl'" },
        defaultValue: { summary: 'ltr' },
      },
    },
    orientation: {
      control: 'radio',
      options: ['horizontal', 'vertical'],
      description: i18n.t(
        'navigationMenu.argType.navigationMenuOrientation',
        'Navigation menu orientation'
      ),
      table: {
        category: 'Layout',
        type: { summary: "'horizontal' | 'vertical'" },
        defaultValue: { summary: 'horizontal' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('navigationMenu.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('navigationMenu.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('navigationMenu.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('navigationMenu.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('navigationMenu.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t(
        'navigationMenu.argType.mouseenterEventHandler',
        'MouseEnter event handler'
      ),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t(
        'navigationMenu.argType.mouseleaveEventHandler',
        'MouseLeave event handler'
      ),
      table: { category: 'Events' },
    },
    onValueChange: {
      action: 'onValueChange',
      description: i18n.t(
        'navigationMenu.argType.calledWhenActiveMenuChanges',
        'Called when active menu changes'
      ),
      table: { category: 'Events' },
    },
    // Note: argTypes for demo wrapper - actual NavigationMenu component props documented below
    // NavigationMenu Props Reference (Radix NavigationMenu.Root):
    // - value: Controlled active menu value (string)
    // - defaultValue: Default active menu for uncontrolled usage (string)
    // - onValueChange: Called when active menu changes ((value: string) => void)
    // - delayDuration: Delay before opening on hover (number, ms)
    // - skipDelayDuration: Delay before skipping subsequent delays (number, ms)
    // - dir: Reading direction ('ltr' | 'rtl')
    // - orientation: Menu orientation ('horizontal' | 'vertical')
    // - className: Additional CSS classes (string)
    //
    // NavigationMenuList Props Reference:
    // - className: Additional CSS classes (string)
    // - children: NavigationMenuItem elements (ReactNode)
    //
    // NavigationMenuItem Props Reference:
    // - value: Unique value for this menu item (string)
    // - className: Additional CSS classes (string)
    // - children: NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink (ReactNode)
    //
    // NavigationMenuTrigger Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Trigger text content (ReactNode)
    // - Displays chevron icon automatically
    //
    // NavigationMenuContent Props Reference:
    // - forceMount: Force content to render even when closed (boolean)
    // - className: Additional CSS classes (string)
    // - children: Menu content (ReactNode)
    //
    // NavigationMenuLink Props Reference:
    // - href: Link destination URL (string)
    // - active: Whether link is active (boolean)
    // - onSelect: Called when link is selected ((event) => void)
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    //
    // NavigationMenuIndicator Props Reference:
    // - forceMount: Force indicator to render (boolean)
    // - className: Additional CSS classes (string)
  },
  parameters: {
    msw: { handlers: navigationMenuHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof NavigationMenuDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu-list"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="navigation-menu-indicator"]')
    ).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="navigation-menu-viewport"]')
    ).toBeInTheDocument();

    const getTrigger = (id: string) => {
      const trigger = canvasElement.querySelector(
        `[data-slot="navigation-menu-trigger"][data-nav-trigger="${id}"]`
      );
      if (!(trigger instanceof HTMLElement)) {
        throw new Error(`Navigation menu trigger was not found: ${id}`);
      }
      expect(trigger.textContent?.trim()).not.toBe('');
      return trigger;
    };

    const getOpenContent = (id: string) => {
      const content = canvasElement.querySelector(
        `[data-slot="navigation-menu-content"][data-nav-content="${id}"]`
      );
      if (!(content instanceof HTMLElement)) return null;
      const state = content.getAttribute('data-state');
      if (state && state !== 'open') return null;
      return content;
    };

    const openMenu = async (id: string) => {
      const trigger = getTrigger(id);
      const existing = getOpenContent(id);
      if (existing) return { content: existing, trigger };

      await userEvent.click(trigger);
      expect(doc.activeElement).toBe(trigger);

      await waitFor(() => {
        if (trigger.getAttribute('data-state') !== 'open') {
          throw new Error('Navigation menu trigger did not open.');
        }
      });

      const content = await waitFor(() => {
        const next = getOpenContent(id);
        if (!next) {
          throw new Error('Navigation menu content was not open.');
        }
        return next;
      });

      return { content, trigger };
    };

    const assertLink = (content: HTMLElement, id: string) => {
      const link = content.querySelector(
        `[data-slot="navigation-menu-link"][data-nav-link="${id}"]`
      );
      if (!(link instanceof HTMLAnchorElement)) {
        throw new Error(`Navigation menu link was not found: ${id}`);
      }

      const title = link.querySelector(`[data-nav-title="${id}"]`);
      if (!(title instanceof HTMLElement)) {
        throw new Error(`Navigation menu title was not found: ${id}`);
      }
      expect(title.textContent?.trim()).not.toBe('');

      const description = link.querySelector(`[data-nav-description="${id}"]`);
      if (!(description instanceof HTMLElement)) {
        throw new Error(`Navigation menu description was not found: ${id}`);
      }
      expect(description.textContent?.trim()).not.toBe('');
    };

    const gettingStarted = await openMenu('getting-started');
    assertLink(gettingStarted.content, 'introduction');
    assertLink(gettingStarted.content, 'installation');

    const components = await openMenu('components');
    assertLink(components.content, 'buttons');
    assertLink(components.content, 'forms');
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu-list"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="navigation-menu-indicator"]')
    ).toBeInTheDocument();
  },
};

// ============ VARIANTS ============

export const Variants: Story = {
  tags: ['!test'],
  render: () => (
    <div className="flex flex-col gap-8">
      {/* Horizontal with Dropdowns */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('navigationMenu.story.withDropdownMenus', 'With Dropdown Menus')}
        </p>
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>
                {i18n.t('navigationMenu.story.products', 'Products')}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[300px] gap-2 p-4">
                  <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                    <div className="font-medium">
                      {i18n.t('navigationMenu.story.analytics', 'Analytics')}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {i18n.t('navigationMenu.story.trackMetrics', 'Track metrics')}
                    </div>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger>
                {i18n.t('navigationMenu.story.solutions', 'Solutions')}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[300px] gap-2 p-4">
                  <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                    <div className="font-medium">
                      {i18n.t('navigationMenu.story.enterprise', 'Enterprise')}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {i18n.t('navigationMenu.story.forLargeOrgs', 'For large orgs')}
                    </div>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
          <NavigationMenuIndicator />
        </NavigationMenu>
      </div>

      {/* Simple Links Only */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('navigationMenu.story.simpleLinksOnly', 'Simple Links Only')}
        </p>
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                Home
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                About
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                Contact
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify navigation menus rendered
    const navMenus = canvasElement.querySelectorAll('[data-slot="navigation-menu"]');
    expect(navMenus.length).toBe(2);

    // Verify text content exists
    expect(canvas.getByText('With Dropdown Menus')).toBeInTheDocument();
    expect(canvas.getByText('Simple Links Only')).toBeInTheDocument();

    // Verify triggers exist in dropdown variant
    expect(canvas.getByText('Products')).toBeInTheDocument();
    expect(canvas.getByText('Solutions')).toBeInTheDocument();

    // Verify simple links exist
    expect(canvas.getByText('Home')).toBeInTheDocument();
    expect(canvas.getByText('About')).toBeInTheDocument();
    expect(canvas.getByText('Contact')).toBeInTheDocument();

    // Verify navigation menu lists exist
    const menuLists = canvasElement.querySelectorAll('[data-slot="navigation-menu-list"]');
    expect(menuLists.length).toBe(2);
  },
};

export const Sizes: Story = {
  tags: ['!test'],
  render: () => (
    <div className="flex flex-col gap-8">
      {/* Compact */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('navigationMenu.story.compact', 'Compact')}
        </p>
        <NavigationMenu>
          <NavigationMenuList className="gap-1">
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-8 px-2 text-xs">
                {i18n.t('navigationMenu.story.products', 'Products')}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[200px] gap-1 p-2">
                  <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                    <div className="text-xs font-medium">
                      {i18n.t('navigationMenu.story.analytics', 'Analytics')}
                    </div>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-8 px-2 text-xs">
                {i18n.t('navigationMenu.story.solutions', 'Solutions')}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[200px] gap-1 p-2">
                  <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                    <div className="text-xs font-medium">
                      {i18n.t('navigationMenu.story.enterprise', 'Enterprise')}
                    </div>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
          <NavigationMenuIndicator />
        </NavigationMenu>
      </div>

      {/* Default */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('navigationMenu.story.default', 'Default')}
        </p>
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>
                {i18n.t('navigationMenu.story.products', 'Products')}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[300px] gap-2 p-4">
                  <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                    <div className="font-medium">
                      {i18n.t('navigationMenu.story.analytics', 'Analytics')}
                    </div>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger>
                {i18n.t('navigationMenu.story.solutions', 'Solutions')}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[300px] gap-2 p-4">
                  <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                    <div className="font-medium">
                      {i18n.t('navigationMenu.story.enterprise', 'Enterprise')}
                    </div>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
          <NavigationMenuIndicator />
        </NavigationMenu>
      </div>

      {/* Large */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('navigationMenu.story.large', 'Large')}
        </p>
        <NavigationMenu>
          <NavigationMenuList className="gap-4">
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-12 px-6 text-lg">
                {i18n.t('navigationMenu.story.products', 'Products')}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[400px] gap-4 p-6">
                  <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                    <div className="text-lg font-medium">
                      {i18n.t('navigationMenu.story.analytics', 'Analytics')}
                    </div>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-12 px-6 text-lg">
                {i18n.t('navigationMenu.story.solutions', 'Solutions')}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[400px] gap-4 p-6">
                  <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                    <div className="text-lg font-medium">
                      {i18n.t('navigationMenu.story.enterprise', 'Enterprise')}
                    </div>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
          <NavigationMenuIndicator />
        </NavigationMenu>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify navigation menus rendered
    const navMenus = canvasElement.querySelectorAll('[data-slot="navigation-menu"]');
    expect(navMenus.length).toBe(3);

    // Verify text content exists
    expect(canvas.getByText('Compact')).toBeInTheDocument();
    expect(canvas.getByText('Default')).toBeInTheDocument();
    expect(canvas.getByText('Large')).toBeInTheDocument();

    // Verify triggers exist for each size (6 total - 2 per nav menu)
    const triggers = canvasElement.querySelectorAll('[data-slot="navigation-menu-trigger"]');
    expect(triggers.length).toBe(6);

    // Verify navigation menu lists exist
    const menuLists = canvasElement.querySelectorAll('[data-slot="navigation-menu-list"]');
    expect(menuLists.length).toBe(3);

    // Verify indicators exist
    const indicators = canvasElement.querySelectorAll('[data-slot="navigation-menu-indicator"]');
    expect(indicators.length).toBe(3);
  },
};

export const VariantHorizontal: Story = {
  name: i18n.t('navigationMenu.storyName.variantHorizontal', 'Variant: Horizontal'),
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>
            {i18n.t('navigationMenu.story.products', 'Products')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[400px] gap-2 p-4">
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="font-medium">
                  {i18n.t('navigationMenu.story.analytics', 'Analytics')}
                </div>
                <div className="text-muted-foreground text-sm">
                  {i18n.t('navigationMenu.story.trackYourMetrics', 'Track your metrics')}
                </div>
              </NavigationMenuLink>
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="font-medium">
                  {i18n.t('navigationMenu.story.automation', 'Automation')}
                </div>
                <div className="text-muted-foreground text-sm">
                  {i18n.t('navigationMenu.story.automateYourWorkflows', 'Automate your workflows')}
                </div>
              </NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>
            {i18n.t('navigationMenu.story.solutions', 'Solutions')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[400px] gap-2 p-4">
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="font-medium">
                  {i18n.t('navigationMenu.story.enterprise', 'Enterprise')}
                </div>
                <div className="text-muted-foreground text-sm">
                  {i18n.t('navigationMenu.story.forLargeOrganizations', 'For large organizations')}
                </div>
              </NavigationMenuLink>
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="font-medium">
                  {i18n.t('navigationMenu.story.startups', 'Startups')}
                </div>
                <div className="text-muted-foreground text-sm">
                  {i18n.t('navigationMenu.story.forGrowingTeams', 'For growing teams')}
                </div>
              </NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>
            {i18n.t('navigationMenu.story.resources', 'Resources')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[400px] gap-2 p-4">
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="font-medium">
                  {i18n.t('navigationMenu.story.documentation', 'Documentation')}
                </div>
                <div className="text-muted-foreground text-sm">
                  {i18n.t('navigationMenu.story.learnHowToUse', 'Learn how to use')}
                </div>
              </NavigationMenuLink>
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="font-medium">{i18n.t('navigationMenu.story.blog', 'Blog')}</div>
                <div className="text-muted-foreground text-sm">
                  {i18n.t('navigationMenu.story.readOurLatestPosts', 'Read our latest posts')}
                </div>
              </NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
      <NavigationMenuIndicator />
    </NavigationMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify navigation menu rendered
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu-list"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="navigation-menu-indicator"]')
    ).toBeInTheDocument();

    // Verify triggers exist
    expect(canvas.getByText('Products')).toBeInTheDocument();
    expect(canvas.getByText('Solutions')).toBeInTheDocument();
    expect(canvas.getByText('Resources')).toBeInTheDocument();

    // Verify 3 triggers total
    const triggers = canvasElement.querySelectorAll('[data-slot="navigation-menu-trigger"]');
    expect(triggers.length).toBe(3);
  },
};

export const VariantWithDropdownPanels: Story = {
  name: i18n.t(
    'navigationMenu.storyName.variantWithDropdownPanels',
    'Variant: With Dropdown Panels'
  ),
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>
            {i18n.t('navigationMenu.story.features', 'Features')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[500px] grid-cols-2 gap-3 p-4">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">
                  {i18n.t('navigationMenu.story.development', 'Development')}
                </h4>
                <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                  <div className="text-sm">
                    {i18n.t('navigationMenu.story.apiReference', 'API Reference')}
                  </div>
                </NavigationMenuLink>
                <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                  <div className="text-sm">
                    {i18n.t('navigationMenu.story.sdksLibraries', 'SDKs & Libraries')}
                  </div>
                </NavigationMenuLink>
                <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                  <div className="text-sm">
                    {i18n.t('navigationMenu.story.webhooks', 'Webhooks')}
                  </div>
                </NavigationMenuLink>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">
                  {i18n.t('navigationMenu.story.platform', 'Platform')}
                </h4>
                <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                  <div className="text-sm">
                    {i18n.t('navigationMenu.story.dashboard', 'Dashboard')}
                  </div>
                </NavigationMenuLink>
                <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                  <div className="text-sm">
                    {i18n.t('navigationMenu.story.integrations', 'Integrations')}
                  </div>
                </NavigationMenuLink>
                <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                  <div className="text-sm">
                    {i18n.t('navigationMenu.story.security', 'Security')}
                  </div>
                </NavigationMenuLink>
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>
            {i18n.t('navigationMenu.story.pricing', 'Pricing')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[600px] grid-cols-3 gap-3 p-4">
              <div className="rounded-lg border p-3">
                <h4 className="font-semibold">{i18n.t('navigationMenu.story.free', 'Free')}</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  {i18n.t('navigationMenu.story.forIndividuals', 'For individuals')}
                </p>
                <div className="mt-2 text-2xl font-bold">$0</div>
              </div>
              <div className="border-primary rounded-lg border p-3">
                <h4 className="font-semibold">{i18n.t('navigationMenu.story.pro', 'Pro')}</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  {i18n.t('navigationMenu.story.forTeams', 'For teams')}
                </p>
                <div className="mt-2 text-2xl font-bold">$29</div>
              </div>
              <div className="rounded-lg border p-3">
                <h4 className="font-semibold">
                  {i18n.t('navigationMenu.story.enterprise', 'Enterprise')}
                </h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  {i18n.t('navigationMenu.story.customSolutions', 'Custom solutions')}
                </p>
                <div className="mt-2 text-2xl font-bold">
                  {i18n.t('navigationMenu.story.custom', 'Custom')}
                </div>
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
      <NavigationMenuIndicator />
    </NavigationMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify navigation menu rendered
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu-list"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="navigation-menu-indicator"]')
    ).toBeInTheDocument();

    // Verify triggers exist
    expect(canvas.getByText('Features')).toBeInTheDocument();
    expect(canvas.getByText('Pricing')).toBeInTheDocument();

    // Verify dropdown content structure
    expect(canvas.getByText('Development')).toBeInTheDocument();
    expect(canvas.getByText('Platform')).toBeInTheDocument();
    expect(canvas.getByText('Free')).toBeInTheDocument();
    expect(canvas.getByText('Pro')).toBeInTheDocument();
    expect(canvas.getByText('Enterprise')).toBeInTheDocument();

    // Verify 2 triggers total
    const triggers = canvasElement.querySelectorAll('[data-slot="navigation-menu-trigger"]');
    expect(triggers.length).toBe(2);
  },
};

export const VariantSimpleLinksOnly: Story = {
  name: i18n.t('navigationMenu.storyName.variantSimpleLinksOnly', 'Variant: Simple Links Only'),
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
            Home
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
            About
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
            Products
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
            Contact
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify navigation menu rendered
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu-list"]')).toBeInTheDocument();

    // Verify links exist
    expect(canvas.getByText('Home')).toBeInTheDocument();
    expect(canvas.getByText('About')).toBeInTheDocument();
    expect(canvas.getByText('Products')).toBeInTheDocument();
    expect(canvas.getByText('Contact')).toBeInTheDocument();

    // Verify 4 links total
    const links = canvasElement.querySelectorAll('[data-slot="navigation-menu-link"]');
    expect(links.length).toBe(4);

    // Verify no triggers (simple links variant)
    const triggers = canvasElement.querySelectorAll('[data-slot="navigation-menu-trigger"]');
    expect(triggers.length).toBe(0);
  },
};

// ============ SIZES ============

export const SizeCompactText: Story = {
  name: i18n.t('navigationMenu.storyName.sizeCompactText', 'Size: Compact Text'),
  render: () => (
    <NavigationMenu>
      <NavigationMenuList className="gap-1">
        <NavigationMenuItem>
          <NavigationMenuTrigger className="h-8 px-2 text-xs">
            {i18n.t('navigationMenu.story.products', 'Products')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[280px] gap-1 p-2">
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="text-xs font-medium">
                  {i18n.t('navigationMenu.story.analytics', 'Analytics')}
                </div>
                <div className="text-muted-foreground text-xs">
                  {i18n.t('navigationMenu.story.trackMetrics', 'Track metrics')}
                </div>
              </NavigationMenuLink>
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="text-xs font-medium">
                  {i18n.t('navigationMenu.story.automation', 'Automation')}
                </div>
                <div className="text-muted-foreground text-xs">
                  {i18n.t('navigationMenu.story.automateWorkflows', 'Automate workflows')}
                </div>
              </NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="h-8 px-2 text-xs">
            {i18n.t('navigationMenu.story.solutions', 'Solutions')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[280px] gap-1 p-2">
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="text-xs font-medium">
                  {i18n.t('navigationMenu.story.enterprise', 'Enterprise')}
                </div>
                <div className="text-muted-foreground text-xs">
                  {i18n.t('navigationMenu.story.largeOrganizations', 'Large organizations')}
                </div>
              </NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
      <NavigationMenuIndicator />
    </NavigationMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify navigation menu rendered
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu-list"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="navigation-menu-indicator"]')
    ).toBeInTheDocument();

    // Verify triggers exist
    expect(canvas.getByText('Products')).toBeInTheDocument();
    expect(canvas.getByText('Solutions')).toBeInTheDocument();

    // Verify 2 triggers total
    const triggers = canvasElement.querySelectorAll('[data-slot="navigation-menu-trigger"]');
    expect(triggers.length).toBe(2);
  },
};

export const SizeDefault: Story = {
  name: i18n.t('navigationMenu.storyName.sizeDefault', 'Size: Default'),
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>
            {i18n.t('navigationMenu.story.products', 'Products')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[400px] gap-2 p-4">
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="font-medium">
                  {i18n.t('navigationMenu.story.analytics', 'Analytics')}
                </div>
                <div className="text-muted-foreground text-sm">
                  {i18n.t('navigationMenu.story.trackYourMetrics', 'Track your metrics')}
                </div>
              </NavigationMenuLink>
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="font-medium">
                  {i18n.t('navigationMenu.story.automation', 'Automation')}
                </div>
                <div className="text-muted-foreground text-sm">
                  {i18n.t('navigationMenu.story.automateYourWorkflows', 'Automate your workflows')}
                </div>
              </NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>
            {i18n.t('navigationMenu.story.solutions', 'Solutions')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[400px] gap-2 p-4">
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="font-medium">
                  {i18n.t('navigationMenu.story.enterprise', 'Enterprise')}
                </div>
                <div className="text-muted-foreground text-sm">
                  {i18n.t('navigationMenu.story.forLargeOrganizations', 'For large organizations')}
                </div>
              </NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
      <NavigationMenuIndicator />
    </NavigationMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify navigation menu rendered
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu-list"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="navigation-menu-indicator"]')
    ).toBeInTheDocument();

    // Verify triggers exist
    expect(canvas.getByText('Products')).toBeInTheDocument();
    expect(canvas.getByText('Solutions')).toBeInTheDocument();

    // Verify 2 triggers total
    const triggers = canvasElement.querySelectorAll('[data-slot="navigation-menu-trigger"]');
    expect(triggers.length).toBe(2);
  },
};

export const SizeLargeText: Story = {
  name: i18n.t('navigationMenu.storyName.sizeLargeText', 'Size: Large Text'),
  render: () => (
    <NavigationMenu>
      <NavigationMenuList className="gap-4">
        <NavigationMenuItem>
          <NavigationMenuTrigger className="h-12 px-6 text-lg">
            {i18n.t('navigationMenu.story.products', 'Products')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[500px] gap-4 p-6">
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="text-lg font-medium">
                  {i18n.t('navigationMenu.story.analytics', 'Analytics')}
                </div>
                <div className="text-muted-foreground">
                  {i18n.t(
                    'navigationMenu.story.trackYourMetricsAndPerformance',
                    'Track your metrics and performance'
                  )}
                </div>
              </NavigationMenuLink>
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="text-lg font-medium">
                  {i18n.t('navigationMenu.story.automation', 'Automation')}
                </div>
                <div className="text-muted-foreground">
                  {i18n.t(
                    'navigationMenu.story.automateYourWorkflowsAndProcesses',
                    'Automate your workflows and processes'
                  )}
                </div>
              </NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="h-12 px-6 text-lg">
            {i18n.t('navigationMenu.story.solutions', 'Solutions')}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[500px] gap-4 p-6">
              <NavigationMenuLink href="#" onClick={(e) => e.preventDefault()}>
                <div className="text-lg font-medium">
                  {i18n.t('navigationMenu.story.enterprise', 'Enterprise')}
                </div>
                <div className="text-muted-foreground">
                  Tailored solutions for large organizations
                </div>
              </NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
      <NavigationMenuIndicator />
    </NavigationMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify navigation menu rendered
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu-list"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="navigation-menu-indicator"]')
    ).toBeInTheDocument();

    // Verify triggers exist
    expect(canvas.getByText('Products')).toBeInTheDocument();
    expect(canvas.getByText('Solutions')).toBeInTheDocument();

    // Verify 2 triggers total
    const triggers = canvasElement.querySelectorAll('[data-slot="navigation-menu-trigger"]');
    expect(triggers.length).toBe(2);
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu-list"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="navigation-menu-indicator"]')
    ).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    expect(doc.dir).toBe('rtl');

    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu-list"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="navigation-menu-indicator"]')
    ).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const gettingStartedTrigger = canvasElement.querySelector(
      '[data-slot="navigation-menu-trigger"][data-nav-trigger="getting-started"]'
    );
    if (!(gettingStartedTrigger instanceof HTMLElement)) {
      throw new Error('Getting started trigger was not found.');
    }
    expect(gettingStartedTrigger.textContent?.trim()).toBe('はじめに');

    const componentsTrigger = canvasElement.querySelector(
      '[data-slot="navigation-menu-trigger"][data-nav-trigger="components"]'
    );
    if (!(componentsTrigger instanceof HTMLElement)) {
      throw new Error('Components trigger was not found.');
    }
    expect(componentsTrigger.textContent?.trim()).toBe('コンポーネント');

    await userEvent.click(gettingStartedTrigger);

    const gettingStartedContent = await waitFor(() => {
      const content = canvasElement.querySelector(
        '[data-slot="navigation-menu-content"][data-nav-content="getting-started"]'
      );
      if (!(content instanceof HTMLElement)) {
        throw new Error('Getting started content was not rendered.');
      }
      const state = content.getAttribute('data-state');
      if (state && state !== 'open') {
        throw new Error('Getting started content was not open.');
      }
      return content;
    });

    const introTitle = gettingStartedContent.querySelector('[data-nav-title="introduction"]');
    if (!(introTitle instanceof HTMLElement)) {
      throw new Error('Introduction title was not found.');
    }
    expect(introTitle.textContent?.trim()).toBe('イントロダクション');

    const installTitle = gettingStartedContent.querySelector('[data-nav-title="installation"]');
    if (!(installTitle instanceof HTMLElement)) {
      throw new Error('Installation title was not found.');
    }
    expect(installTitle.textContent?.trim()).toBe('インストール');

    await userEvent.click(componentsTrigger);

    const componentsContent = await waitFor(() => {
      const content = canvasElement.querySelector(
        '[data-slot="navigation-menu-content"][data-nav-content="components"]'
      );
      if (!(content instanceof HTMLElement)) {
        throw new Error('Components content was not rendered.');
      }
      const state = content.getAttribute('data-state');
      if (state && state !== 'open') {
        throw new Error('Components content was not open.');
      }
      return content;
    });

    const buttonsTitle = componentsContent.querySelector('[data-nav-title="buttons"]');
    if (!(buttonsTitle instanceof HTMLElement)) {
      throw new Error('Buttons title was not found.');
    }
    expect(buttonsTitle.textContent?.trim()).toBe('ボタン');

    await Default.play?.(context);
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
  name: i18n.t('navigationMenu.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
  render: () => {
    const fakeNav = createFakeNavigationMenu(4);

    return (
      <NavigationMenu data-testid="nav-menu-faker">
        <NavigationMenuList>
          {fakeNav.items.map((item) => (
            <NavigationMenuItem key={item.id}>
              {item.type === 'link' ? (
                <NavigationMenuLink href={item.href ?? '#'} onClick={(e) => e.preventDefault()}>
                  {item.label}
                </NavigationMenuLink>
              ) : (
                <>
                  <NavigationMenuTrigger>{item.label}</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="grid gap-2 p-4 md:w-[400px]">
                      {item.content?.links?.map((link) => (
                        <NavigationMenuLink
                          key={link.id}
                          href={link.href}
                          onClick={(e) => e.preventDefault()}
                        >
                          <div className="font-medium">{link.label}</div>
                          {link.description && (
                            <div className="text-muted-foreground text-xs">{link.description}</div>
                          )}
                        </NavigationMenuLink>
                      ))}
                      {item.content?.groups?.map((group) => (
                        <div key={group.id}>
                          <div className="mb-1 text-sm font-semibold">{group.title}</div>
                          {group.links.map((link) => (
                            <NavigationMenuLink
                              key={link.id}
                              href={link.href}
                              onClick={(e) => e.preventDefault()}
                            >
                              {link.label}
                            </NavigationMenuLink>
                          ))}
                        </div>
                      ))}
                    </div>
                  </NavigationMenuContent>
                </>
              )}
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
        <NavigationMenuIndicator />
      </NavigationMenu>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="nav-menu-faker"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu-list"]')).toBeInTheDocument();

    const menuItems = canvasElement.querySelectorAll('[data-slot="navigation-menu-item"]');
    expect(menuItems.length).toBe(4);
  },
};

export const WithAsyncData: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuHandlers },
  },
  play: async ({ canvasElement }) => {
    // Wait for loading to complete
    await waitFor(
      () => {
        const loading = canvasElement.querySelector('[data-testid="nav-menu-loading"]');
        if (loading) {
          throw new Error('Navigation menu is still loading');
        }
      },
      { timeout: 3000 }
    );

    // Verify async data rendered successfully
    const navMenu = canvasElement.querySelector('[data-testid="nav-menu-async"]');
    expect(navMenu).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu-list"]')).toBeInTheDocument();
  },
};

// ============ HTTP 4xx ERROR STORIES ============

export const Error400BadRequest: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    // Wait for loading to complete
    await waitFor(
      () => {
        const loading = canvasElement.querySelector('[data-testid="nav-menu-loading"]');
        if (loading) {
          throw new Error('Navigation menu is still loading');
        }
      },
      { timeout: 3000 }
    );

    // Verify error state rendered
    const errorAlert = canvasElement.querySelector('[data-testid="nav-menu-error"]');
    expect(errorAlert).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    // Wait for loading to complete
    await waitFor(
      () => {
        const loading = canvasElement.querySelector('[data-testid="nav-menu-loading"]');
        if (loading) {
          throw new Error('Navigation menu is still loading');
        }
      },
      { timeout: 3000 }
    );

    // Verify error state rendered
    const errorAlert = canvasElement.querySelector('[data-testid="nav-menu-error"]');
    expect(errorAlert).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    // Wait for loading to complete
    await waitFor(
      () => {
        const loading = canvasElement.querySelector('[data-testid="nav-menu-loading"]');
        if (loading) {
          throw new Error('Navigation menu is still loading');
        }
      },
      { timeout: 3000 }
    );

    // Verify error state rendered
    const errorAlert = canvasElement.querySelector('[data-testid="nav-menu-error"]');
    expect(errorAlert).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    // Wait for loading to complete
    await waitFor(
      () => {
        const loading = canvasElement.querySelector('[data-testid="nav-menu-loading"]');
        if (loading) {
          throw new Error('Navigation menu is still loading');
        }
      },
      { timeout: 3000 }
    );

    // Verify error state rendered
    const errorAlert = canvasElement.querySelector('[data-testid="nav-menu-error"]');
    expect(errorAlert).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    // Wait for loading to complete
    await waitFor(
      () => {
        const loading = canvasElement.querySelector('[data-testid="nav-menu-loading"]');
        if (loading) {
          throw new Error('Navigation menu is still loading');
        }
      },
      { timeout: 3000 }
    );

    // Verify error state rendered
    const errorAlert = canvasElement.querySelector('[data-testid="nav-menu-error"]');
    expect(errorAlert).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

// ============ HTTP 5xx ERROR STORIES ============

export const Error422UnprocessableEntity: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    // Wait for loading to complete
    await waitFor(
      () => {
        const loading = canvasElement.querySelector('[data-testid="nav-menu-loading"]');
        if (loading) {
          throw new Error('Navigation menu is still loading');
        }
      },
      { timeout: 3000 }
    );

    // Verify error state rendered
    const errorAlert = canvasElement.querySelector('[data-testid="nav-menu-error"]');
    expect(errorAlert).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    // Wait for loading to complete
    await waitFor(
      () => {
        const loading = canvasElement.querySelector('[data-testid="nav-menu-loading"]');
        if (loading) {
          throw new Error('Navigation menu is still loading');
        }
      },
      { timeout: 3000 }
    );

    // Verify error state rendered
    const errorAlert = canvasElement.querySelector('[data-testid="nav-menu-error"]');
    expect(errorAlert).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    // Wait for loading to complete
    await waitFor(
      () => {
        const loading = canvasElement.querySelector('[data-testid="nav-menu-loading"]');
        if (loading) {
          throw new Error('Navigation menu is still loading');
        }
      },
      { timeout: 3000 }
    );

    // Verify error state rendered
    const errorAlert = canvasElement.querySelector('[data-testid="nav-menu-error"]');
    expect(errorAlert).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ SPECIAL STATE STORIES ============

export const Loading: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  render: (args) => <NavigationMenuWithAsyncData {...args} />,
  args: {
    onValueChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: navigationMenuStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  name: i18n.t('navigationMenu.storyName.accessibility', 'Accessibility (Keyboard Navigation)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    // Verify navigation menu root exists
    const navMenu = canvasElement.querySelector('[data-slot="navigation-menu"]');
    expect(navMenu).toBeInTheDocument();

    // Verify ARIA roles
    const navList = canvasElement.querySelector('[data-slot="navigation-menu-list"]');
    expect(navList).toBeInTheDocument();

    // Get triggers
    const gettingStartedTrigger = canvasElement.querySelector(
      '[data-slot="navigation-menu-trigger"][data-nav-trigger="getting-started"]'
    );
    const componentsTrigger = canvasElement.querySelector(
      '[data-slot="navigation-menu-trigger"][data-nav-trigger="components"]'
    );

    if (!(gettingStartedTrigger instanceof HTMLElement)) {
      throw new Error('Getting started trigger was not found.');
    }
    if (!(componentsTrigger instanceof HTMLElement)) {
      throw new Error('Components trigger was not found.');
    }

    // Focus on first trigger
    gettingStartedTrigger.focus();
    expect(doc.activeElement).toBe(gettingStartedTrigger);

    // Test Enter key to open menu
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(gettingStartedTrigger.getAttribute('data-state')).toBe('open');
    });

    // Verify content is displayed
    const content = await waitFor(() => {
      const c = canvasElement.querySelector(
        '[data-slot="navigation-menu-content"][data-nav-content="getting-started"]'
      );
      if (!(c instanceof HTMLElement)) {
        throw new Error('Navigation menu content was not rendered.');
      }
      return c;
    });
    expect(content).toBeInTheDocument();

    // Test Escape key to close menu
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      const closedContent = canvasElement.querySelector(
        '[data-slot="navigation-menu-content"][data-nav-content="getting-started"][data-state="open"]'
      );
      expect(closedContent).not.toBeInTheDocument();
    });

    // Test Arrow Right navigation between triggers
    gettingStartedTrigger.focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(doc.activeElement).toBe(componentsTrigger);
    });

    // Test Arrow Left navigation
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(doc.activeElement).toBe(gettingStartedTrigger);
    });

    // Verify links have proper roles
    await userEvent.click(gettingStartedTrigger);
    await waitFor(() => {
      const links = canvasElement.querySelectorAll('[data-slot="navigation-menu-link"]');
      expect(links.length).not.toBe(0);
    });
  },
};

// ============ FACTORY: SINGLE ITEM FACTORIES ============

function FactorySingleLinkDemo() {
  const link: FakeNavigationMenuLink = createFakeNavigationMenuLink({
    label: i18n.t('navigationMenu.item.introduction.title'),
    description: i18n.t('navigationMenu.item.introduction.description'),
  });

  return (
    <div data-testid="factory-single-link" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.content')}</p>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink href={link.href} onClick={(e) => e.preventDefault()}>
              <div className="font-medium" data-testid="link-label">
                {link.label}
              </div>
              {link.description && (
                <div className="text-muted-foreground text-xs" data-testid="link-description">
                  {link.description}
                </div>
              )}
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}

export const FactorySingleLink: Story = {
  name: i18n.t('navigationMenu.storyName.factorySingleLink', 'Factory: Single Link'),
  render: () => <FactorySingleLinkDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="factory-single-link"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="link-label"]')).toBeInTheDocument();
    expect(canvas.getByText('Introduction')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
  },
};

function FactoryMultipleLinksDemo() {
  const links: FakeNavigationMenuLink[] = createFakeNavigationMenuLinks(5);

  return (
    <div data-testid="factory-multiple-links" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.layouts')}</p>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>
              {i18n.t('navigationMenu.section.components')}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="grid gap-2 p-4 md:w-[400px]">
                {links.map((link) => (
                  <NavigationMenuLink
                    key={link.id}
                    href={link.href}
                    onClick={(e) => e.preventDefault()}
                  >
                    <div className="font-medium">{link.label}</div>
                    {link.description && (
                      <div className="text-muted-foreground text-xs">{link.description}</div>
                    )}
                  </NavigationMenuLink>
                ))}
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
        <NavigationMenuIndicator />
      </NavigationMenu>
    </div>
  );
}

export const FactoryMultipleLinks: Story = {
  name: i18n.t('navigationMenu.storyName.factoryMultipleLinks', 'Factory: Multiple Links'),
  render: () => <FactoryMultipleLinksDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-multiple-links"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="navigation-menu-trigger"]');
    expect(triggers.length).toBe(1);
  },
};

function FactoryFeaturedItemDemo() {
  const featured: FakeNavigationMenuFeaturedItem = createFakeFeaturedItem({
    title: i18n.t('navigationMenu.item.buttons.title'),
    description: i18n.t('navigationMenu.item.buttons.description'),
  });

  return (
    <div data-testid="factory-featured-item" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.content')}</p>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>
              {i18n.t('navigationMenu.story.featured', 'Featured')}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="p-4 md:w-[500px]">
                <div
                  className={`rounded-lg p-4 ${featured.background ?? 'bg-muted'}`}
                  data-testid="featured-card"
                >
                  <div className="text-lg font-bold" data-testid="featured-title">
                    {featured.title}
                  </div>
                  <div className="text-muted-foreground text-sm" data-testid="featured-description">
                    {featured.description}
                  </div>
                  {featured.ctaLabel && (
                    <NavigationMenuLink
                      href={featured.href}
                      onClick={(e) => e.preventDefault()}
                      data-testid="featured-cta"
                    >
                      {featured.ctaLabel}
                    </NavigationMenuLink>
                  )}
                </div>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
        <NavigationMenuIndicator />
      </NavigationMenu>
    </div>
  );
}

export const FactoryFeaturedItem: Story = {
  name: i18n.t('navigationMenu.storyName.factoryFeaturedItem', 'Factory: Featured Item'),
  render: () => <FactoryFeaturedItemDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-featured-item"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="featured-title"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="featured-description"]')).toBeInTheDocument();
  },
};

function FactoryGroupDemo() {
  const { t } = useTranslation();
  const group: FakeNavigationMenuGroup = createFakeNavigationMenuGroup(4);

  return (
    <div data-testid="factory-group" className="space-y-2">
      <p className="text-muted-foreground text-sm">{t('navigationMenu.section.layouts')}</p>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>{group.title}</NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="p-4 md:w-[400px]">
                <div className="mb-2 text-sm font-semibold" data-testid="group-title">
                  {group.title}
                </div>
                {group.links.map((link) => (
                  <NavigationMenuLink
                    key={link.id}
                    href={link.href}
                    onClick={(e) => e.preventDefault()}
                  >
                    <div className="font-medium">{link.label}</div>
                  </NavigationMenuLink>
                ))}
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
        <NavigationMenuIndicator />
      </NavigationMenu>
    </div>
  );
}

export const FactoryGroup: Story = {
  name: i18n.t('navigationMenu.storyName.factoryGroup', 'Factory: Group'),
  render: () => <FactoryGroupDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-group"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="group-title"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="navigation-menu-trigger"]');
    expect(triggers.length).toBe(1);
  },
};

function FactoryContentDemo() {
  const content: FakeNavigationMenuContent = createFakeNavigationMenuContent('grid');

  return (
    <div data-testid="factory-content" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.layouts')}</p>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>
              {i18n.t('navigationMenu.section.components')}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className={`p-4 ${content.width ?? 'md:w-[400px]'}`}>
                {content.groups?.map((group) => (
                  <div key={group.id} className="mb-3">
                    <div className="mb-1 text-sm font-semibold">{group.title}</div>
                    {group.links.map((link) => (
                      <NavigationMenuLink
                        key={link.id}
                        href={link.href}
                        onClick={(e) => e.preventDefault()}
                      >
                        <div className="font-medium">{link.label}</div>
                      </NavigationMenuLink>
                    ))}
                  </div>
                ))}
                {content.links?.map((link) => (
                  <NavigationMenuLink
                    key={link.id}
                    href={link.href}
                    onClick={(e) => e.preventDefault()}
                  >
                    <div className="font-medium">{link.label}</div>
                  </NavigationMenuLink>
                ))}
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
        <NavigationMenuIndicator />
      </NavigationMenu>
    </div>
  );
}

export const FactoryContent: Story = {
  name: i18n.t('navigationMenu.storyName.factoryContent', 'Factory: Content'),
  render: () => <FactoryContentDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-content"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="navigation-menu-trigger"]');
    expect(triggers.length).toBe(1);
  },
};

function FactorySingleItemDemo() {
  const item: FakeNavigationMenuItem = createFakeNavigationMenuItem('trigger');

  return (
    <div data-testid="factory-single-item" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.content')}</p>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            {item.type === 'link' ? (
              <NavigationMenuLink href={item.href ?? '#'} onClick={(e) => e.preventDefault()}>
                {item.label}
              </NavigationMenuLink>
            ) : (
              <>
                <NavigationMenuTrigger>{item.label}</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid gap-2 p-4 md:w-[400px]">
                    {item.content?.links?.map((link) => (
                      <NavigationMenuLink
                        key={link.id}
                        href={link.href}
                        onClick={(e) => e.preventDefault()}
                      >
                        <div className="font-medium">{link.label}</div>
                      </NavigationMenuLink>
                    ))}
                    {item.content?.groups?.map((group) => (
                      <div key={group.id}>
                        <div className="mb-1 text-sm font-semibold">{group.title}</div>
                        {group.links.map((link) => (
                          <NavigationMenuLink
                            key={link.id}
                            href={link.href}
                            onClick={(e) => e.preventDefault()}
                          >
                            {link.label}
                          </NavigationMenuLink>
                        ))}
                      </div>
                    ))}
                  </div>
                </NavigationMenuContent>
              </>
            )}
          </NavigationMenuItem>
        </NavigationMenuList>
        <NavigationMenuIndicator />
      </NavigationMenu>
    </div>
  );
}

export const FactorySingleItem: Story = {
  name: i18n.t('navigationMenu.storyName.factorySingleItem', 'Factory: Single Item'),
  render: () => <FactorySingleItemDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-single-item"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="navigation-menu-item"]');
    expect(items.length).toBe(1);
  },
};

function FactoryMultipleItemsDemo() {
  const items: FakeNavigationMenuItem[] = createFakeNavigationMenuItems(5);

  return (
    <div data-testid="factory-multiple-items" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.variants')}</p>
      <NavigationMenu>
        <NavigationMenuList>
          {items.map((item) => (
            <NavigationMenuItem key={item.id}>
              {item.type === 'link' ? (
                <NavigationMenuLink href={item.href ?? '#'} onClick={(e) => e.preventDefault()}>
                  {item.label}
                </NavigationMenuLink>
              ) : (
                <>
                  <NavigationMenuTrigger>{item.label}</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="grid gap-2 p-4 md:w-[400px]">
                      {item.content?.links?.map((link) => (
                        <NavigationMenuLink
                          key={link.id}
                          href={link.href}
                          onClick={(e) => e.preventDefault()}
                        >
                          <div className="font-medium">{link.label}</div>
                        </NavigationMenuLink>
                      ))}
                    </div>
                  </NavigationMenuContent>
                </>
              )}
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
        <NavigationMenuIndicator />
      </NavigationMenu>
    </div>
  );
}

export const FactoryMultipleItems: Story = {
  name: i18n.t('navigationMenu.storyName.factoryMultipleItems', 'Factory: Multiple Items'),
  render: () => <FactoryMultipleItemsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-multiple-items"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="navigation-menu-item"]');
    expect(items.length).toBe(5);
  },
};

// ============ FACTORY: SPECIALIZED NAVIGATIONS ============

function FactoryMegaMenuDemo() {
  const nav: FakeNavigationMenu = createFakeMegaMenuNavigation();

  return (
    <div data-testid="factory-mega-menu" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.variants')}</p>
      <NavigationMenu>
        <NavigationMenuList>
          {nav.items.map((item) => (
            <NavigationMenuItem key={item.id}>
              {item.type === 'link' ? (
                <NavigationMenuLink href={item.href ?? '#'} onClick={(e) => e.preventDefault()}>
                  {item.label}
                </NavigationMenuLink>
              ) : (
                <>
                  <NavigationMenuTrigger>{item.label}</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className={`p-4 ${item.content?.width ?? 'md:w-[400px]'}`}>
                      {item.content?.featuredItems?.map((fi) => (
                        <div
                          key={fi.id}
                          className={`mb-3 rounded-lg p-3 ${fi.background ?? 'bg-muted'}`}
                        >
                          <div className="font-bold">{fi.title}</div>
                          <div className="text-muted-foreground text-sm">{fi.description}</div>
                        </div>
                      ))}
                      {item.content?.groups?.map((group) => (
                        <div key={group.id} className="mb-2">
                          <div className="mb-1 text-sm font-semibold">{group.title}</div>
                          {group.links.map((link) => (
                            <NavigationMenuLink
                              key={link.id}
                              href={link.href}
                              onClick={(e) => e.preventDefault()}
                            >
                              {link.label}
                            </NavigationMenuLink>
                          ))}
                        </div>
                      ))}
                      {item.content?.links?.map((link) => (
                        <NavigationMenuLink
                          key={link.id}
                          href={link.href}
                          onClick={(e) => e.preventDefault()}
                        >
                          {link.label}
                        </NavigationMenuLink>
                      ))}
                    </div>
                  </NavigationMenuContent>
                </>
              )}
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
        {nav.showIndicator && <NavigationMenuIndicator />}
      </NavigationMenu>
    </div>
  );
}

export const FactoryMegaMenu: Story = {
  name: i18n.t('navigationMenu.storyName.factoryMegaMenu', 'Factory: Mega Menu'),
  render: () => <FactoryMegaMenuDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-mega-menu"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="navigation-menu-item"]');
    expect(items.length).toBe(4);
    const triggers = canvasElement.querySelectorAll('[data-slot="navigation-menu-trigger"]');
    expect(triggers.length).toBe(4);
  },
};

function FactorySimpleLinkNavDemo() {
  const nav: FakeNavigationMenu = createFakeSimpleLinkNavigation();

  return (
    <div data-testid="factory-simple-link-nav" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.variants')}</p>
      <NavigationMenu>
        <NavigationMenuList>
          {nav.items.map((item) => (
            <NavigationMenuItem key={item.id}>
              <NavigationMenuLink href={item.href ?? '#'} onClick={(e) => e.preventDefault()}>
                {item.label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}

export const FactorySimpleLinkNav: Story = {
  name: i18n.t('navigationMenu.storyName.factorySimpleLinkNav', 'Factory: Simple Link Navigation'),
  render: () => <FactorySimpleLinkNavDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="factory-simple-link-nav"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvas.getByText('Home')).toBeInTheDocument();
    expect(canvas.getByText('About')).toBeInTheDocument();
    expect(canvas.getByText('Contact')).toBeInTheDocument();
    const links = canvasElement.querySelectorAll('[data-slot="navigation-menu-link"]');
    expect(links.length).toBe(5);
    const triggers = canvasElement.querySelectorAll('[data-slot="navigation-menu-trigger"]');
    expect(triggers.length).toBe(0);
  },
};

function FactoryDocsNavDemo() {
  const nav: FakeNavigationMenu = createFakeDocsNavigation();

  return (
    <div data-testid="factory-docs-nav" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.layouts')}</p>
      <NavigationMenu>
        <NavigationMenuList>
          {nav.items.map((item) => (
            <NavigationMenuItem key={item.id}>
              {item.type === 'link' ? (
                <NavigationMenuLink href={item.href ?? '#'} onClick={(e) => e.preventDefault()}>
                  {item.label}
                </NavigationMenuLink>
              ) : (
                <>
                  <NavigationMenuTrigger>{item.label}</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className={`p-4 ${item.content?.width ?? 'md:w-[400px]'}`}>
                      {item.content?.groups?.map((group) => (
                        <div key={group.id} className="mb-2">
                          <div className="mb-1 text-sm font-semibold">{group.title}</div>
                          {group.links.map((link) => (
                            <NavigationMenuLink
                              key={link.id}
                              href={link.href}
                              onClick={(e) => e.preventDefault()}
                            >
                              {link.label}
                            </NavigationMenuLink>
                          ))}
                        </div>
                      ))}
                      {item.content?.links?.map((link) => (
                        <NavigationMenuLink
                          key={link.id}
                          href={link.href}
                          onClick={(e) => e.preventDefault()}
                        >
                          {link.label}
                        </NavigationMenuLink>
                      ))}
                    </div>
                  </NavigationMenuContent>
                </>
              )}
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
        {nav.showIndicator && <NavigationMenuIndicator />}
      </NavigationMenu>
    </div>
  );
}

export const FactoryDocsNav: Story = {
  name: i18n.t('navigationMenu.storyName.factoryDocsNav', 'Factory: Docs Navigation'),
  render: () => <FactoryDocsNavDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="factory-docs-nav"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvas.getByText('Getting Started')).toBeInTheDocument();
    expect(canvas.getByText('Components')).toBeInTheDocument();
    expect(canvas.getByText('API Reference')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="navigation-menu-item"]');
    expect(items.length).toBe(4);
  },
};

function FactoryEcommerceNavDemo() {
  const nav: FakeNavigationMenu = createFakeEcommerceNavigation();

  return (
    <div data-testid="factory-ecommerce-nav" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.variants')}</p>
      <NavigationMenu>
        <NavigationMenuList>
          {nav.items.map((item) => (
            <NavigationMenuItem key={item.id}>
              {item.type === 'link' ? (
                <NavigationMenuLink href={item.href ?? '#'} onClick={(e) => e.preventDefault()}>
                  {item.label}
                </NavigationMenuLink>
              ) : (
                <>
                  <NavigationMenuTrigger>{item.label}</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className={`p-4 ${item.content?.width ?? 'md:w-[400px]'}`}>
                      {item.content?.featuredItems?.map((fi) => (
                        <div
                          key={fi.id}
                          className={`mb-3 rounded-lg p-3 ${fi.background ?? 'bg-muted'}`}
                        >
                          <div className="font-bold">{fi.title}</div>
                          <div className="text-muted-foreground text-sm">{fi.description}</div>
                        </div>
                      ))}
                      {item.content?.groups?.map((group) => (
                        <div key={group.id} className="mb-2">
                          <div className="mb-1 text-sm font-semibold">{group.title}</div>
                          {group.links.map((link) => (
                            <NavigationMenuLink
                              key={link.id}
                              href={link.href}
                              onClick={(e) => e.preventDefault()}
                            >
                              {link.label}
                            </NavigationMenuLink>
                          ))}
                        </div>
                      ))}
                      {item.content?.links?.map((link) => (
                        <NavigationMenuLink
                          key={link.id}
                          href={link.href}
                          onClick={(e) => e.preventDefault()}
                        >
                          <div className="font-medium">{link.label}</div>
                          {link.badge && (
                            <span className="bg-primary text-primary-foreground ml-2 rounded-full px-2 text-xs">
                              {link.badge}
                            </span>
                          )}
                        </NavigationMenuLink>
                      ))}
                    </div>
                  </NavigationMenuContent>
                </>
              )}
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
        {nav.showIndicator && <NavigationMenuIndicator />}
      </NavigationMenu>
    </div>
  );
}

export const FactoryEcommerceNav: Story = {
  name: i18n.t('navigationMenu.storyName.factoryEcommerceNav', 'Factory: E-commerce Navigation'),
  render: () => <FactoryEcommerceNavDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="factory-ecommerce-nav"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvas.getByText('Shop')).toBeInTheDocument();
    expect(canvas.getByText('Deals')).toBeInTheDocument();
    expect(canvas.getByText('Brands')).toBeInTheDocument();
    expect(canvas.getByText('Gift Cards')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="navigation-menu-item"]');
    expect(items.length).toBe(4);
  },
};

function FactoryVerticalNavDemo() {
  const nav: FakeNavigationMenu = createFakeVerticalNavigation();

  return (
    <div data-testid="factory-vertical-nav" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.variants')}</p>
      <NavigationMenu orientation="vertical" className="items-start">
        <NavigationMenuList className="flex-col">
          {nav.items.map((item) => (
            <NavigationMenuItem key={item.id}>
              {item.type === 'link' ? (
                <NavigationMenuLink href={item.href ?? '#'} onClick={(e) => e.preventDefault()}>
                  {item.label}
                </NavigationMenuLink>
              ) : (
                <>
                  <NavigationMenuTrigger>{item.label}</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="grid gap-2 p-4 md:w-[400px]">
                      {item.content?.links?.map((link) => (
                        <NavigationMenuLink
                          key={link.id}
                          href={link.href}
                          onClick={(e) => e.preventDefault()}
                        >
                          {link.label}
                        </NavigationMenuLink>
                      ))}
                    </div>
                  </NavigationMenuContent>
                </>
              )}
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}

export const FactoryVerticalNav: Story = {
  name: i18n.t('navigationMenu.storyName.factoryVerticalNav', 'Factory: Vertical Navigation'),
  render: () => <FactoryVerticalNavDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-vertical-nav"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="navigation-menu-item"]');
    expect(items.length).toBe(6);
  },
};

function FactoryIconNavDemo() {
  const nav: FakeNavigationMenu = createFakeIconNavigation();

  return (
    <div data-testid="factory-icon-nav" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.variants')}</p>
      <NavigationMenu>
        <NavigationMenuList>
          {nav.items.map((item) => (
            <NavigationMenuItem key={item.id}>
              <NavigationMenuLink href={item.href ?? '#'} onClick={(e) => e.preventDefault()}>
                {item.icon && <span className="mr-1">({item.icon})</span>}
                {item.label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}

export const FactoryIconNav: Story = {
  name: i18n.t('navigationMenu.storyName.factoryIconNav', 'Factory: Icon Navigation'),
  render: () => <FactoryIconNavDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="factory-icon-nav"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    expect(canvas.getByText(/Home/)).toBeInTheDocument();
    expect(canvas.getByText(/Search/)).toBeInTheDocument();
    expect(canvas.getByText(/Profile/)).toBeInTheDocument();
    expect(canvas.getByText(/Settings/)).toBeInTheDocument();
    const links = canvasElement.querySelectorAll('[data-slot="navigation-menu-link"]');
    expect(links.length).toBe(4);
  },
};

function FactoryDisabledItemsNavDemo() {
  const nav: FakeNavigationMenu = createFakeDisabledItemsNavigation();

  return (
    <div data-testid="factory-disabled-nav" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.disabled')}</p>
      <NavigationMenu>
        <NavigationMenuList>
          {nav.items.map((item) => (
            <NavigationMenuItem key={item.id}>
              {item.type === 'link' ? (
                <NavigationMenuLink
                  href={item.href ?? '#'}
                  onClick={(e) => e.preventDefault()}
                  className={item.disabled ? 'pointer-events-none opacity-50' : ''}
                  data-disabled={item.disabled || undefined}
                >
                  {item.label}
                </NavigationMenuLink>
              ) : (
                <>
                  <NavigationMenuTrigger
                    disabled={item.disabled}
                    className={item.disabled ? 'pointer-events-none opacity-50' : ''}
                  >
                    {item.label}
                  </NavigationMenuTrigger>
                  {!item.disabled && (
                    <NavigationMenuContent>
                      <div className="grid gap-2 p-4 md:w-[400px]">
                        {item.content?.links?.map((link) => (
                          <NavigationMenuLink
                            key={link.id}
                            href={link.href}
                            onClick={(e) => e.preventDefault()}
                            className={link.disabled ? 'pointer-events-none opacity-50' : ''}
                          >
                            {link.label}
                          </NavigationMenuLink>
                        ))}
                      </div>
                    </NavigationMenuContent>
                  )}
                </>
              )}
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
        <NavigationMenuIndicator />
      </NavigationMenu>
    </div>
  );
}

export const FactoryDisabledItemsNav: Story = {
  name: i18n.t(
    'navigationMenu.storyName.factoryDisabledItemsNav',
    'Factory: Disabled Items Navigation'
  ),
  render: () => <FactoryDisabledItemsNavDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-disabled-nav"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
    const items = canvasElement.querySelectorAll('[data-slot="navigation-menu-item"]');
    expect(items.length).toBe(5);
    // Verify at least one disabled trigger exists
    const disabledTriggers = canvasElement.querySelectorAll(
      '[data-slot="navigation-menu-trigger"][disabled]'
    );
    expect(disabledTriggers.length).toBeGreaterThanOrEqual(1);
  },
};

// ============ FACTORY: MATRIX FACTORIES ============

function FactoryOrientationMatrixDemo() {
  const menus: FakeNavigationMenu[] = createNavigationMenuOrientationMatrix();
  const orientationLabels: NavigationMenuOrientation[] = NAVIGATION_MENU_ORIENTATIONS;

  return (
    <div data-testid="factory-orientation-matrix" className="space-y-8">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.sizes')}</p>
      {menus.map((menu, index) => (
        <div key={menu.id} className="space-y-2">
          <p className="text-sm font-medium" data-testid={`orientation-label-${index}`}>
            {orientationLabels[index]}
          </p>
          <NavigationMenu
            orientation={menu.orientation}
            className={menu.orientation === 'vertical' ? 'items-start' : ''}
          >
            <NavigationMenuList className={menu.orientation === 'vertical' ? 'flex-col' : ''}>
              {menu.items.map((item) => (
                <NavigationMenuItem key={item.id}>
                  {item.type === 'link' ? (
                    <NavigationMenuLink href={item.href ?? '#'} onClick={(e) => e.preventDefault()}>
                      {item.label}
                    </NavigationMenuLink>
                  ) : (
                    <NavigationMenuTrigger>{item.label}</NavigationMenuTrigger>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      ))}
    </div>
  );
}

export const FactoryOrientationMatrix: Story = {
  name: i18n.t('navigationMenu.storyName.factoryOrientationMatrix', 'Factory: Orientation Matrix'),
  render: () => <FactoryOrientationMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-orientation-matrix"]')
    ).toBeInTheDocument();
    const navMenus = canvasElement.querySelectorAll('[data-slot="navigation-menu"]');
    expect(navMenus.length).toBe(2);
    expect(canvasElement.querySelector('[data-testid="orientation-label-0"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="orientation-label-1"]')).toBeInTheDocument();
  },
};

function FactoryContentLayoutMatrixDemo() {
  const contents: FakeNavigationMenuContent[] = createNavigationMenuContentLayoutMatrix();
  const layoutLabels: NavigationMenuContentLayout[] = NAVIGATION_MENU_CONTENT_LAYOUTS;

  return (
    <div data-testid="factory-content-layout-matrix" className="space-y-8">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.layouts')}</p>
      {contents.map((content, index) => (
        <div key={content.id} className="space-y-2">
          <p className="text-sm font-medium" data-testid={`layout-label-${index}`}>
            {layoutLabels[index]} ({content.width})
          </p>
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>{layoutLabels[index]}</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className={`p-4 ${content.width ?? ''}`}>
                    {content.featuredItems?.map((fi) => (
                      <div
                        key={fi.id}
                        className={`mb-2 rounded-lg p-3 ${fi.background ?? 'bg-muted'}`}
                      >
                        <div className="font-bold">{fi.title}</div>
                        <div className="text-muted-foreground text-sm">{fi.description}</div>
                      </div>
                    ))}
                    {content.groups?.map((group) => (
                      <div key={group.id} className="mb-2">
                        <div className="mb-1 text-sm font-semibold">{group.title}</div>
                        {group.links.map((link) => (
                          <NavigationMenuLink
                            key={link.id}
                            href={link.href}
                            onClick={(e) => e.preventDefault()}
                          >
                            {link.label}
                          </NavigationMenuLink>
                        ))}
                      </div>
                    ))}
                    {content.links?.map((link) => (
                      <NavigationMenuLink
                        key={link.id}
                        href={link.href}
                        onClick={(e) => e.preventDefault()}
                      >
                        <div className="font-medium">{link.label}</div>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
            <NavigationMenuIndicator />
          </NavigationMenu>
        </div>
      ))}
    </div>
  );
}

export const FactoryContentLayoutMatrix: Story = {
  name: i18n.t(
    'navigationMenu.storyName.factoryContentLayoutMatrix',
    'Factory: Content Layout Matrix'
  ),
  render: () => <FactoryContentLayoutMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-content-layout-matrix"]')
    ).toBeInTheDocument();
    const navMenus = canvasElement.querySelectorAll('[data-slot="navigation-menu"]');
    expect(navMenus.length).toBe(6);
    // Verify all 6 layout labels exist
    for (let i = 0; i < 6; i++) {
      expect(canvasElement.querySelector(`[data-testid="layout-label-${i}"]`)).toBeInTheDocument();
    }
  },
};

function getLinkStyleClassName(style?: NavigationMenuLinkStyle): string {
  const styleMap: Record<string, string> = {
    card: 'rounded-lg border p-3',
    callout: 'bg-muted rounded-lg p-3',
    minimal: 'text-sm',
    default: '',
  };
  return styleMap[style ?? 'default'] ?? '';
}

function FactoryLinkStyleMatrixDemo() {
  const links: FakeNavigationMenuLink[] = createNavigationMenuLinkStyleMatrix();
  const styleLabels: NavigationMenuLinkStyle[] = NAVIGATION_MENU_LINK_STYLES;

  return (
    <div data-testid="factory-link-style-matrix" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.variants')}</p>
      {links.map((link, index) => (
        <div key={link.id} className="space-y-1">
          <p className="text-xs font-medium" data-testid={`style-label-${index}`}>
            Style: {styleLabels[index]}
          </p>
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink
                  href={link.href}
                  onClick={(e) => e.preventDefault()}
                  className={getLinkStyleClassName(link.style)}
                >
                  <div className="font-medium">{link.label}</div>
                  {link.description && (
                    <div className="text-muted-foreground text-xs">{link.description}</div>
                  )}
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      ))}
    </div>
  );
}

export const FactoryLinkStyleMatrix: Story = {
  name: i18n.t('navigationMenu.storyName.factoryLinkStyleMatrix', 'Factory: Link Style Matrix'),
  render: () => <FactoryLinkStyleMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-link-style-matrix"]')
    ).toBeInTheDocument();
    const navMenus = canvasElement.querySelectorAll('[data-slot="navigation-menu"]');
    expect(navMenus.length).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(canvasElement.querySelector(`[data-testid="style-label-${i}"]`)).toBeInTheDocument();
    }
  },
};

// ============ FACTORY: SHOWCASE & TEST DATA ============

function FactoryShowcaseDemo() {
  const showcase = createNavigationMenuShowcase();

  return (
    <div data-testid="factory-showcase" className="space-y-8">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.variants')}</p>
      {showcase.map((entry, index) => (
        <div key={entry.name} className="space-y-2">
          <div>
            <p className="text-sm font-medium" data-testid={`showcase-name-${index}`}>
              {entry.name}
            </p>
            <p className="text-muted-foreground text-xs">{entry.description}</p>
          </div>
          <NavigationMenu
            orientation={entry.menu.orientation}
            className={entry.menu.orientation === 'vertical' ? 'items-start' : ''}
          >
            <NavigationMenuList className={entry.menu.orientation === 'vertical' ? 'flex-col' : ''}>
              {entry.menu.items.map((item) => (
                <NavigationMenuItem key={item.id}>
                  {item.type === 'link' ? (
                    <NavigationMenuLink
                      href={item.href ?? '#'}
                      onClick={(e) => e.preventDefault()}
                      className={item.disabled ? 'pointer-events-none opacity-50' : ''}
                    >
                      {item.label}
                    </NavigationMenuLink>
                  ) : (
                    <NavigationMenuTrigger
                      disabled={item.disabled}
                      className={item.disabled ? 'pointer-events-none opacity-50' : ''}
                    >
                      {item.label}
                    </NavigationMenuTrigger>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
            {entry.menu.showIndicator && <NavigationMenuIndicator />}
          </NavigationMenu>
        </div>
      ))}
    </div>
  );
}

export const FactoryShowcase: Story = {
  name: i18n.t('navigationMenu.storyName.factoryShowcase', 'Factory: Showcase'),
  render: () => <FactoryShowcaseDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-showcase"]')).toBeInTheDocument();
    const navMenus = canvasElement.querySelectorAll('[data-slot="navigation-menu"]');
    expect(navMenus.length).toBe(7);
    // Verify showcase entry names are rendered
    expect(canvasElement.querySelector('[data-testid="showcase-name-0"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="showcase-name-6"]')).toBeInTheDocument();
  },
};

function FactoryTestDataDemo() {
  const testData = createNavigationMenuTestData();

  return (
    <div data-testid="factory-test-data" className="space-y-6">
      <p className="text-muted-foreground text-sm">{i18n.t('navigationMenu.section.content')}</p>

      <div className="space-y-2">
        <p className="text-xs font-semibold" data-testid="test-data-links-label">
          Links ({testData.links.length})
        </p>
        <NavigationMenu>
          <NavigationMenuList>
            {testData.links.slice(0, 4).map((link) => (
              <NavigationMenuItem key={link.id}>
                <NavigationMenuLink href={link.href} onClick={(e) => e.preventDefault()}>
                  {link.label}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold" data-testid="test-data-menus-label">
          Menus ({testData.menus.length}) | Orientations ({testData.orientations.length}) | Layouts
          ({testData.contentLayouts.length}) | Styles ({testData.linkStyles.length}) | Groups (
          {testData.groups.length}) | Featured ({testData.featuredItems.length}) | Items (
          {testData.items.length}) | Showcase ({testData.showcase.length})
        </p>
      </div>
    </div>
  );
}

export const FactoryTestData: Story = {
  name: i18n.t('navigationMenu.storyName.factoryTestData', 'Factory: Test Data'),
  render: () => <FactoryTestDataDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-test-data"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-testid="test-data-links-label"]')
    ).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-testid="test-data-menus-label"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="navigation-menu"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: CONSTANTS COVERAGE ============

function FactoryConstantsDemo() {
  const { t } = useTranslation();

  const orientations: NavigationMenuOrientation[] = NAVIGATION_MENU_ORIENTATIONS;
  const contentLayouts: NavigationMenuContentLayout[] = NAVIGATION_MENU_CONTENT_LAYOUTS;
  const itemTypes: NavigationMenuItemType[] = NAVIGATION_MENU_ITEM_TYPES;
  const linkStyles: NavigationMenuLinkStyle[] = NAVIGATION_MENU_LINK_STYLES;
  const contentPositions: NavigationMenuContentPosition[] = NAVIGATION_MENU_CONTENT_POSITIONS;
  const states: NavigationMenuState[] = NAVIGATION_MENU_STATES;

  return (
    <div data-testid="factory-constants" className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('navigationMenu.section.content')}</p>

      <div className="space-y-1">
        <p className="text-xs font-semibold">
          {t('navigationMenu.story.orientations', 'Orientations')}
        </p>
        <div className="flex gap-2" data-testid="constants-orientations">
          {orientations.map((o) => (
            <span key={o} className="bg-muted rounded px-2 py-1 text-xs">
              {o}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold">
          {t('navigationMenu.story.contentLayouts', 'Content Layouts')}
        </p>
        <div className="flex flex-wrap gap-2" data-testid="constants-layouts">
          {contentLayouts.map((l) => (
            <span key={l} className="bg-muted rounded px-2 py-1 text-xs">
              {l}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold">{t('navigationMenu.story.itemTypes', 'Item Types')}</p>
        <div className="flex gap-2" data-testid="constants-item-types">
          {itemTypes.map((t) => (
            <span key={t} className="bg-muted rounded px-2 py-1 text-xs">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold">
          {t('navigationMenu.story.linkStyles', 'Link Styles')}
        </p>
        <div className="flex gap-2" data-testid="constants-link-styles">
          {linkStyles.map((s) => (
            <span key={s} className="bg-muted rounded px-2 py-1 text-xs">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold">
          {t('navigationMenu.story.contentPositions', 'Content Positions')}
        </p>
        <div className="flex gap-2" data-testid="constants-positions">
          {contentPositions.map((p) => (
            <span key={p} className="bg-muted rounded px-2 py-1 text-xs">
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold">{t('navigationMenu.story.states', 'States')}</p>
        <div className="flex gap-2" data-testid="constants-states">
          {states.map((s) => (
            <span key={s} className="bg-muted rounded px-2 py-1 text-xs">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  name: i18n.t('navigationMenu.storyName.factoryConstants', 'Factory: Constants'),
  render: () => <FactoryConstantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="factory-constants"]')).toBeInTheDocument();

    // Verify orientations
    const orientationsEl = canvasElement.querySelector('[data-testid="constants-orientations"]');
    expect(orientationsEl).toBeInTheDocument();
    expect(canvas.getByText('horizontal')).toBeInTheDocument();
    expect(canvas.getByText('vertical')).toBeInTheDocument();

    // Verify content layouts
    const layoutsEl = canvasElement.querySelector('[data-testid="constants-layouts"]');
    expect(layoutsEl).toBeInTheDocument();
    expect(canvas.getByText('grid')).toBeInTheDocument();
    expect(canvas.getByText('mega')).toBeInTheDocument();

    // Verify item types
    const itemTypesEl = canvasElement.querySelector('[data-testid="constants-item-types"]');
    expect(itemTypesEl).toBeInTheDocument();
    expect(canvas.getByText('link')).toBeInTheDocument();
    expect(canvas.getByText('trigger')).toBeInTheDocument();
    expect(canvas.getByText('group')).toBeInTheDocument();

    // Verify link styles
    const linkStylesEl = canvasElement.querySelector('[data-testid="constants-link-styles"]');
    expect(linkStylesEl).toBeInTheDocument();
    expect(canvas.getByText('callout')).toBeInTheDocument();
    expect(canvas.getByText('card')).toBeInTheDocument();
    expect(canvas.getByText('minimal')).toBeInTheDocument();

    // Verify content positions
    const positionsEl = canvasElement.querySelector('[data-testid="constants-positions"]');
    expect(positionsEl).toBeInTheDocument();
    expect(canvas.getByText('left')).toBeInTheDocument();
    expect(canvas.getByText('center')).toBeInTheDocument();
    expect(canvas.getByText('right')).toBeInTheDocument();
    expect(canvas.getByText('full')).toBeInTheDocument();

    // Verify states
    const statesEl = canvasElement.querySelector('[data-testid="constants-states"]');
    expect(statesEl).toBeInTheDocument();
    expect(canvas.getByText('hover')).toBeInTheDocument();
    expect(canvas.getByText('active')).toBeInTheDocument();
    expect(canvas.getByText('disabled')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// NAVIGATION STATUS HANDLER STORIES
// ============================================================================

export const NavError400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavError401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavError403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavError404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavError422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavError429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavError500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavError502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavError503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavError504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavLoading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavSlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavNetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavEmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: navigationStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NavSuccess: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.navSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: navigationStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const NavSingleItem: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.navSingleItem', 'Handler: Single Item'),
  parameters: { msw: { handlers: navigationStatusHandlers.singleItem } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const NavDeepNesting: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.navDeepNesting', 'Handler: Deep Nesting'),
  parameters: { msw: { handlers: navigationStatusHandlers.deepNesting } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const NavLongBreadcrumb: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.navLongBreadcrumb', 'Handler: Long Breadcrumb'),
  parameters: { msw: { handlers: navigationStatusHandlers.longBreadcrumb } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const NavManyTabs: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.navManyTabs', 'Handler: Many Tabs'),
  parameters: { msw: { handlers: navigationStatusHandlers.manyTabs } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const NavDisabledItems: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.navDisabledItems', 'Handler: Disabled Items'),
  parameters: { msw: { handlers: navigationStatusHandlers.disabledItems } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const NavWithBadges: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.navWithBadges', 'Handler: With Badges'),
  parameters: { msw: { handlers: navigationStatusHandlers.withBadges } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const NavCollapsedSidebar: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.navCollapsedSidebar', 'Handler: Collapsed Sidebar'),
  parameters: { msw: { handlers: navigationStatusHandlers.collapsedSidebar } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: navigationMenuStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('navigationMenu.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: navigationMenuStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
