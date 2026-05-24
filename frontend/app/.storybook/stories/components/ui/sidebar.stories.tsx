import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { HomeIcon, SettingsIcon, UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { createFakeSidebarMenuItems } from '@/.storybook/stories/_factories/sidebar.factory';
import {
  sidebarHandlers,
  sidebarStatusHandlers,
} from '@/.storybook/stories/_handlers/sidebar.handlers';

import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

type SidebarDemoProps = {
  contentDescription?: string;
  contentTitle?: string;
  menuHome?: string;
  menuSettings?: string;
  menuUsers?: string;
  upgradeLabel?: string;
  workspaceTitle?: string;
};

function SidebarDemo({
  workspaceTitle = 'Workspace',
  menuHome = 'Home',
  menuUsers = 'Users',
  menuSettings = 'Settings',
  upgradeLabel = 'Upgrade',
  contentTitle = 'Content',
  contentDescription = 'Toggle the sidebar using the trigger.',
}: SidebarDemoProps) {
  return (
    <SidebarProvider data-sidebar-demo defaultOpen>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold" data-sidebar-workspace-title>
              {workspaceTitle}
            </div>
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton data-sidebar-menu-item="home" isActive tooltip={menuHome}>
                <HomeIcon />
                <span data-sidebar-menu-label="home">{menuHome}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton data-sidebar-menu-item="users" tooltip={menuUsers}>
                <UsersIcon />
                <span data-sidebar-menu-label="users">{menuUsers}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton data-sidebar-menu-item="settings" tooltip={menuSettings}>
                <SettingsIcon />
                <span data-sidebar-menu-label="settings">{menuSettings}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <Button className="w-full" data-sidebar-upgrade size="sm" variant="outline">
            {upgradeLabel}
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="p-6">
          <div className="text-sm font-medium" data-sidebar-content-title>
            {contentTitle}
          </div>
          <div className="text-muted-foreground mt-2 text-sm" data-sidebar-content-description>
            {contentDescription}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function I18nSidebarDemo() {
  const { t } = useTranslation();

  return (
    <SidebarDemo
      contentDescription={t('sidebar.contentDescription')}
      contentTitle={t('sidebar.contentTitle')}
      menuHome={t('sidebar.menu.home')}
      menuSettings={t('sidebar.menu.settings')}
      menuUsers={t('sidebar.menu.users')}
      upgradeLabel={t('sidebar.upgrade')}
      workspaceTitle={t('sidebar.workspaceTitle')}
    />
  );
}

const meta = {
  title: 'Components/UI/Sidebar',
  component: SidebarDemo,
  tags: ['autodocs'],
  args: {
    workspaceTitle: 'Workspace',
    menuHome: 'Home',
    menuUsers: 'Users',
    menuSettings: 'Settings',
    upgradeLabel: 'Upgrade',
    contentTitle: 'Content',
    contentDescription: 'Toggle the sidebar using the trigger.',
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onOpenChange: fn(),
  },
  argTypes: {
    // Content
    workspaceTitle: {
      control: 'text',
      description: i18n.t(
        'sidebar.argType.titleDisplayedInSidebarHeader',
        'Title displayed in sidebar header'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    menuHome: {
      control: 'text',
      description: i18n.t('sidebar.argType.homeMenuItemLabel', 'Home menu item label'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    menuUsers: {
      control: 'text',
      description: i18n.t('sidebar.argType.usersMenuItemLabel', 'Users menu item label'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    menuSettings: {
      control: 'text',
      description: i18n.t('sidebar.argType.settingsMenuItemLabel', 'Settings menu item label'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    upgradeLabel: {
      control: 'text',
      description: i18n.t('sidebar.argType.upgradeButtonLabel', 'Upgrade button label'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    contentTitle: {
      control: 'text',
      description: i18n.t('sidebar.argType.mainContentTitle', 'Main content title'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    contentDescription: {
      control: 'text',
      description: i18n.t('sidebar.argType.mainContentDescription', 'Main content description'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Appearance
    side: {
      control: 'select',
      options: ['left', 'right'],
      description: i18n.t(
        'sidebar.argType.sidebarPositionOnTheViewport',
        'Sidebar position on the viewport'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'left' },
        type: { summary: "'left' | 'right'" },
      },
    },
    variant: {
      control: 'select',
      options: ['sidebar', 'floating', 'inset'],
      description: i18n.t(
        'sidebar.argType.visualStyleVariantOfTheSidebar',
        'Visual style variant of the sidebar'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'sidebar' },
        type: { summary: "'sidebar' | 'floating' | 'inset'" },
      },
    },
    className: {
      control: 'text',
      description: i18n.t(
        'sidebar.argType.additionalCssClassesForCustomStyling',
        'Additional CSS classes for custom styling'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    defaultOpen: {
      control: 'boolean',
      description: i18n.t(
        'sidebar.argType.defaultOpenStateOfTheSidebar',
        'Default open state of the sidebar'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    open: {
      control: 'boolean',
      description: i18n.t(
        'sidebar.argType.controlledOpenStateOfTheSidebar',
        'Controlled open state of the sidebar'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
      },
    },
    // Layout
    collapsible: {
      control: 'select',
      options: ['offcanvas', 'icon', 'none'],
      description: i18n.t(
        'sidebar.argType.howTheSidebarCollapsesWhenToggled',
        'How the sidebar collapses when toggled'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'offcanvas' },
        type: { summary: "'offcanvas' | 'icon' | 'none'" },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('sidebar.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('sidebar.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('sidebar.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('sidebar.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('sidebar.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('sidebar.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('sidebar.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'sidebar.argType.calledWhenSidebarOpenStateChanges',
        'Called when sidebar open state changes'
      ),
      table: { category: 'Events' },
    },
    // Actual Sidebar component props documented below
    // SidebarProvider Props Reference:
    // - defaultOpen: Default open state (boolean, default: true)
    // - open: Controlled open state (boolean)
    // - onOpenChange: Called when open state changes ((open: boolean) => void)
    //
    // Sidebar Props Reference:
    // - side: Sidebar position ('left' | 'right', default: 'left')
    // - variant: Visual variant ('sidebar' | 'floating' | 'inset')
    // - collapsible: Collapse mode ('offcanvas' | 'icon' | 'none')
    // - className: Additional CSS classes (string)
    //
    // SidebarHeader, SidebarContent, SidebarFooter Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Section content (ReactNode)
    //
    // SidebarMenu, SidebarMenuItem Props Reference:
    // - className: Additional CSS classes (string)
    //
    // SidebarMenuButton Props Reference:
    // - isActive: Whether button is active (boolean)
    // - tooltip: Tooltip text shown when collapsed (string | TooltipContent)
    // - variant: Visual variant ('default' | 'outline')
    // - size: Button size ('default' | 'sm' | 'lg')
    //
    // SidebarTrigger Props Reference:
    // - className: Additional CSS classes (string)
    // - Toggles sidebar open/closed state
    //
    // SidebarInset, SidebarSeparator, SidebarGroup, SidebarGroupLabel, SidebarGroupContent
  },
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: sidebarHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    const demoRoot = canvasElement.querySelector('[data-sidebar-demo]');

    if (!(demoRoot instanceof HTMLElement)) {
      throw new Error('Sidebar demo root was not found.');
    }

    const workspaceTitle = demoRoot.querySelector('[data-sidebar-workspace-title]');

    if (!(workspaceTitle instanceof HTMLElement)) {
      throw new Error('Sidebar workspace title was not found.');
    }

    const contentTitle = demoRoot.querySelector('[data-sidebar-content-title]');

    if (!(contentTitle instanceof HTMLElement)) {
      throw new Error('Sidebar content title was not found.');
    }

    expect(workspaceTitle.textContent?.trim().length).not.toBe(0);
    expect(contentTitle.textContent?.trim().length).not.toBe(0);

    const trigger = demoRoot.querySelector('[data-slot="sidebar-trigger"]');

    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Sidebar trigger was not found.');
    }

    const sidebar = demoRoot.querySelector('[data-slot="sidebar"][data-state]');

    if (!(sidebar instanceof HTMLElement)) {
      throw new Error('Sidebar root was not found.');
    }

    const menuButtons = demoRoot.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);
    expect(menuButtons[0]?.getAttribute('data-active')).toBe('true');
    expect(menuButtons[1]?.getAttribute('data-active')).toBe('false');
    expect(menuButtons[2]?.getAttribute('data-active')).toBe('false');

    expect(sidebar.getAttribute('data-state')).toBe('expanded');
    expect(sidebar.getAttribute('data-collapsible')).toBe('');

    await userEvent.click(trigger);

    await waitFor(() => {
      expect(sidebar.getAttribute('data-state')).toBe('collapsed');
    });

    expect(sidebar.getAttribute('data-collapsible')).toBe('icon');
    expect(doc.cookie).toContain('sidebar_state=false');

    await userEvent.click(trigger);

    await waitFor(() => {
      expect(sidebar.getAttribute('data-state')).toBe('expanded');
    });

    expect(sidebar.getAttribute('data-collapsible')).toBe('');
    expect(doc.cookie).toContain('sidebar_state=true');
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    expect(canvasElement.querySelector('[data-slot="sidebar-header"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="sidebar-content"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="sidebar-footer"]')).toBeInTheDocument();
  },
};

// ============ VARIANTS ============

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {/* Expanded */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('sidebar.story.expandedDefault', 'Expanded (default)')}
        </p>
        <div className="h-[300px] overflow-hidden rounded-lg border">
          <SidebarProvider defaultOpen>
            <Sidebar collapsible="icon" variant="inset">
              <SidebarHeader>
                <div className="text-sm font-semibold">
                  {i18n.t('sidebar.story.expanded', 'Expanded')}
                </div>
              </SidebarHeader>
              <SidebarSeparator />
              <SidebarContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive tooltip={i18n.t('sidebar.story.home', 'Home')}>
                      <HomeIcon />
                      <span>{i18n.t('sidebar.story.home', 'Home')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip={i18n.t('sidebar.story.users', 'Users')}>
                      <UsersIcon />
                      <span>{i18n.t('sidebar.story.users', 'Users')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarContent>
            </Sidebar>
            <SidebarInset>
              <div className="p-4 text-sm">
                {i18n.t('sidebar.story.mainContentArea', 'Main content area')}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      </div>

      {/* With Footer */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('sidebar.story.withFooter', 'With Footer')}
        </p>
        <div className="h-[300px] overflow-hidden rounded-lg border">
          <SidebarProvider defaultOpen>
            <Sidebar collapsible="icon" variant="inset">
              <SidebarHeader>
                <div className="text-sm font-semibold">
                  {i18n.t('sidebar.story.withFooter', 'With Footer')}
                </div>
              </SidebarHeader>
              <SidebarSeparator />
              <SidebarContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive tooltip={i18n.t('sidebar.story.home', 'Home')}>
                      <HomeIcon />
                      <span>{i18n.t('sidebar.story.home', 'Home')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarContent>
              <SidebarFooter>
                <Button className="w-full" size="sm" variant="outline">
                  Upgrade
                </Button>
              </SidebarFooter>
            </Sidebar>
            <SidebarInset>
              <div className="p-4 text-sm">
                {i18n.t('sidebar.story.mainContentArea', 'Main content area')}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    // Verify multiple sidebar instances exist for different variants
    const sidebars = canvasElement.querySelectorAll('[data-slot="sidebar"]');
    expect(sidebars.length).toBe(2);

    // Verify sidebar headers exist
    const sidebarHeaders = canvasElement.querySelectorAll('[data-slot="sidebar-header"]');
    expect(sidebarHeaders.length).toBe(2);

    // Verify variant labels are present
    expect(canvas.getByText('Expanded (default)')).toBeInTheDocument();
    expect(canvas.getByText('With Footer')).toBeInTheDocument();

    // Verify sidebar menu buttons exist
    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBeGreaterThan(0);

    // Verify sidebar content exists
    const sidebarContents = canvasElement.querySelectorAll('[data-slot="sidebar-content"]');
    expect(sidebarContents.length).toBe(2);
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {/* Narrow */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">Narrow (w-48)</p>
        <div className="h-[250px] overflow-hidden rounded-lg border">
          <SidebarProvider defaultOpen>
            <Sidebar collapsible="icon" variant="inset" className="w-48">
              <SidebarHeader>
                <div className="text-xs font-semibold">
                  {i18n.t('sidebar.story.narrow', 'Narrow')}
                </div>
              </SidebarHeader>
              <SidebarSeparator />
              <SidebarContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive
                      tooltip={i18n.t('sidebar.story.home', 'Home')}
                      className="text-xs"
                    >
                      <HomeIcon className="h-4 w-4" />
                      <span>{i18n.t('sidebar.story.home', 'Home')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip={i18n.t('sidebar.story.users', 'Users')}
                      className="text-xs"
                    >
                      <UsersIcon className="h-4 w-4" />
                      <span>{i18n.t('sidebar.story.users', 'Users')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarContent>
            </Sidebar>
            <SidebarInset>
              <div className="p-4 text-sm">{i18n.t('sidebar.story.content', 'Content')}</div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      </div>

      {/* Default */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('sidebar.story.default', 'Default')}
        </p>
        <div className="h-[250px] overflow-hidden rounded-lg border">
          <SidebarProvider defaultOpen>
            <Sidebar collapsible="icon" variant="inset">
              <SidebarHeader>
                <div className="text-sm font-semibold">
                  {i18n.t('sidebar.story.default', 'Default')}
                </div>
              </SidebarHeader>
              <SidebarSeparator />
              <SidebarContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive tooltip={i18n.t('sidebar.story.home', 'Home')}>
                      <HomeIcon />
                      <span>{i18n.t('sidebar.story.home', 'Home')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip={i18n.t('sidebar.story.users', 'Users')}>
                      <UsersIcon />
                      <span>{i18n.t('sidebar.story.users', 'Users')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarContent>
            </Sidebar>
            <SidebarInset>
              <div className="p-4 text-sm">{i18n.t('sidebar.story.content', 'Content')}</div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      </div>

      {/* Wide */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">Wide (w-80)</p>
        <div className="h-[250px] overflow-hidden rounded-lg border">
          <SidebarProvider defaultOpen>
            <Sidebar collapsible="icon" variant="inset" className="w-80">
              <SidebarHeader>
                <div className="text-base font-semibold">
                  {i18n.t('sidebar.story.wide', 'Wide')}
                </div>
              </SidebarHeader>
              <SidebarSeparator />
              <SidebarContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive
                      tooltip={i18n.t('sidebar.story.home', 'Home')}
                      className="py-3 text-base"
                    >
                      <HomeIcon className="h-5 w-5" />
                      <span>{i18n.t('sidebar.story.home', 'Home')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip={i18n.t('sidebar.story.users', 'Users')}
                      className="py-3 text-base"
                    >
                      <UsersIcon className="h-5 w-5" />
                      <span>{i18n.t('sidebar.story.users', 'Users')}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarContent>
            </Sidebar>
            <SidebarInset>
              <div className="p-4 text-sm">{i18n.t('sidebar.story.content', 'Content')}</div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    // Verify multiple sidebar instances exist for different sizes
    const sidebars = canvasElement.querySelectorAll('[data-slot="sidebar"]');
    expect(sidebars.length).toBe(3);

    // Verify sidebar headers exist
    const sidebarHeaders = canvasElement.querySelectorAll('[data-slot="sidebar-header"]');
    expect(sidebarHeaders.length).toBe(3);

    // Verify size labels are present
    expect(canvas.getByText('Narrow (w-48)')).toBeInTheDocument();
    expect(canvas.getByText('Default')).toBeInTheDocument();
    expect(canvas.getByText('Wide (w-80)')).toBeInTheDocument();

    // Verify sidebar menu buttons exist
    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBeGreaterThan(0);

    // Verify sidebar content exists
    const sidebarContents = canvasElement.querySelectorAll('[data-slot="sidebar-content"]');
    expect(sidebarContents.length).toBe(3);
  },
};

export const VariantExpanded: Story = {
  name: i18n.t('sidebar.storyName.variantExpanded', 'Variant: Expanded'),
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">
              {i18n.t('sidebar.story.expandedView', 'Expanded View')}
            </div>
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive tooltip={i18n.t('sidebar.story.home', 'Home')}>
                <HomeIcon />
                <span>{i18n.t('sidebar.story.home', 'Home')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={i18n.t('sidebar.story.users', 'Users')}>
                <UsersIcon />
                <span>{i18n.t('sidebar.story.users', 'Users')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={i18n.t('sidebar.story.settings', 'Settings')}>
                <SettingsIcon />
                <span>{i18n.t('sidebar.story.settings', 'Settings')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="p-6">
          <div className="text-sm font-medium">
            {i18n.t('sidebar.story.mainContent', 'Main Content')}
          </div>
          <div className="text-muted-foreground mt-2 text-sm">
            {i18n.t('sidebar.story.sidebarIsExpandedByDefault', 'Sidebar is expanded by default.')}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);
    expect(menuButtons[0]?.getAttribute('data-active')).toBe('true');

    expect(canvas.getByText('Expanded View')).toBeInTheDocument();
    expect(canvas.getByText('Main Content')).toBeInTheDocument();
  },
};

export const VariantCollapsed: Story = {
  name: i18n.t('sidebar.storyName.variantCollapsed', 'Variant: Collapsed'),
  render: () => (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive tooltip={i18n.t('sidebar.story.home', 'Home')}>
                <HomeIcon />
                <span>{i18n.t('sidebar.story.home', 'Home')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={i18n.t('sidebar.story.users', 'Users')}>
                <UsersIcon />
                <span>{i18n.t('sidebar.story.users', 'Users')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={i18n.t('sidebar.story.settings', 'Settings')}>
                <SettingsIcon />
                <span>{i18n.t('sidebar.story.settings', 'Settings')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="p-6">
          <div className="text-sm font-medium">
            {i18n.t('sidebar.story.mainContent', 'Main Content')}
          </div>
          <div className="text-muted-foreground mt-2 text-sm">
            Sidebar is collapsed by default. Hover icons for tooltips.
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar?.getAttribute('data-state')).toBe('collapsed');
    expect(sidebar?.getAttribute('data-collapsible')).toBe('icon');

    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    const trigger = canvasElement.querySelector('[data-slot="sidebar-trigger"]');
    expect(trigger).toBeInTheDocument();

    // Toggle sidebar open
    await userEvent.click(trigger as HTMLElement);
    await waitFor(() => {
      expect(sidebar?.getAttribute('data-state')).toBe('expanded');
    });
  },
};

export const VariantWithNestedItems: Story = {
  name: i18n.t('sidebar.storyName.variantWithNestedItems', 'Variant: With Nested Items'),
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <div className="text-sm font-semibold">
            {i18n.t('sidebar.story.nestedNavigation', 'Nested Navigation')}
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive tooltip={i18n.t('sidebar.story.dashboard', 'Dashboard')}>
                <HomeIcon />
                <span>{i18n.t('sidebar.story.dashboard', 'Dashboard')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={i18n.t('sidebar.story.users', 'Users')}>
                <UsersIcon />
                <span>{i18n.t('sidebar.story.users', 'Users')}</span>
              </SidebarMenuButton>
              <SidebarMenu className="mt-1 ml-4 border-l pl-2">
                <SidebarMenuItem>
                  <SidebarMenuButton className="text-sm">
                    <span>{i18n.t('sidebar.story.allUsers', 'All Users')}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton className="text-sm">
                    <span>{i18n.t('sidebar.story.active', 'Active')}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton className="text-sm">
                    <span>{i18n.t('sidebar.story.inactive', 'Inactive')}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={i18n.t('sidebar.story.settings', 'Settings')}>
                <SettingsIcon />
                <span>{i18n.t('sidebar.story.settings', 'Settings')}</span>
              </SidebarMenuButton>
              <SidebarMenu className="mt-1 ml-4 border-l pl-2">
                <SidebarMenuItem>
                  <SidebarMenuButton className="text-sm">
                    <span>{i18n.t('sidebar.story.general', 'General')}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton className="text-sm">
                    <span>{i18n.t('sidebar.story.security', 'Security')}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="p-6">
          <div className="text-sm font-medium">
            {i18n.t('sidebar.story.mainContent', 'Main Content')}
          </div>
          <div className="text-muted-foreground mt-2 text-sm">
            {i18n.t('sidebar.story.sidebarWithNestedMenuItems', 'Sidebar with nested menu items.')}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    expect(canvas.getByText('Nested Navigation')).toBeInTheDocument();

    // Verify top-level menu buttons (Dashboard, Users, Settings)
    expect(canvas.getByText('Dashboard')).toBeInTheDocument();
    expect(canvas.getByText('Users')).toBeInTheDocument();
    expect(canvas.getByText('Settings')).toBeInTheDocument();

    // Verify nested items under Users
    expect(canvas.getByText('All Users')).toBeInTheDocument();
    expect(canvas.getByText('Active')).toBeInTheDocument();
    expect(canvas.getByText('Inactive')).toBeInTheDocument();

    // Verify nested items under Settings
    expect(canvas.getByText('General')).toBeInTheDocument();
    expect(canvas.getByText('Security')).toBeInTheDocument();

    // Verify nested menus exist (3 total: 1 top-level + 2 nested)
    const menus = canvasElement.querySelectorAll('[data-slot="sidebar-menu"]');
    expect(menus.length).toBe(3);
  },
};

export const VariantWithFooter: Story = {
  name: i18n.t('sidebar.storyName.variantWithFooter', 'Variant: With Footer'),
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">{i18n.t('sidebar.story.myApp', 'My App')}</div>
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive tooltip={i18n.t('sidebar.story.home', 'Home')}>
                <HomeIcon />
                <span>{i18n.t('sidebar.story.home', 'Home')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={i18n.t('sidebar.story.users', 'Users')}>
                <UsersIcon />
                <span>{i18n.t('sidebar.story.users', 'Users')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={i18n.t('sidebar.story.settings', 'Settings')}>
                <SettingsIcon />
                <span>{i18n.t('sidebar.story.settings', 'Settings')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 px-2">
              <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium">
                JD
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {i18n.t('sidebar.story.johnDoe', 'John Doe')}
                </div>
                <div className="text-muted-foreground truncate text-xs">john@example.com</div>
              </div>
            </div>
            <Button className="mt-3 w-full" size="sm" variant="outline">
              Sign Out
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="p-6">
          <div className="text-sm font-medium">
            {i18n.t('sidebar.story.mainContent', 'Main Content')}
          </div>
          <div className="text-muted-foreground mt-2 text-sm">
            Sidebar with user info and actions in footer.
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    expect(canvas.getByText('My App')).toBeInTheDocument();

    // Verify footer content
    const footer = canvasElement.querySelector('[data-slot="sidebar-footer"]');
    expect(footer).toBeInTheDocument();
    expect(canvas.getByText('John Doe')).toBeInTheDocument();
    expect(canvas.getByText('john@example.com')).toBeInTheDocument();
    expect(canvas.getByText('JD')).toBeInTheDocument();
    expect(canvas.getByText('Sign Out')).toBeInTheDocument();

    // Verify menu buttons
    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    // Verify trigger exists
    expect(canvasElement.querySelector('[data-slot="sidebar-trigger"]')).toBeInTheDocument();
  },
};

// ============ SIZES ============

export const SizeNarrowWidth: Story = {
  name: i18n.t('sidebar.storyName.sizeNarrowWidth', 'Size: Narrow Width'),
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="inset" className="w-48">
        <SidebarHeader>
          <div className="text-xs font-semibold">{i18n.t('sidebar.story.narrow', 'Narrow')}</div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive
                tooltip={i18n.t('sidebar.story.home', 'Home')}
                className="text-xs"
              >
                <HomeIcon className="h-4 w-4" />
                <span>{i18n.t('sidebar.story.home', 'Home')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={i18n.t('sidebar.story.users', 'Users')}
                className="text-xs"
              >
                <UsersIcon className="h-4 w-4" />
                <span>{i18n.t('sidebar.story.users', 'Users')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={i18n.t('sidebar.story.settings', 'Settings')}
                className="text-xs"
              >
                <SettingsIcon className="h-4 w-4" />
                <span>{i18n.t('sidebar.story.settings', 'Settings')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="p-6">
          <div className="text-sm font-medium">
            {i18n.t('sidebar.story.mainContent', 'Main Content')}
          </div>
          <div className="text-muted-foreground mt-2 text-sm">Narrow sidebar width (w-48).</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    expect(canvas.getByText('Narrow')).toBeInTheDocument();

    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    expect(canvasElement.querySelector('[data-slot="sidebar-content"]')).toBeInTheDocument();
  },
};

export const SizeDefault: Story = {
  name: i18n.t('sidebar.storyName.sizeDefault', 'Size: Default'),
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <div className="text-sm font-semibold">
            {i18n.t('sidebar.story.defaultWidth', 'Default Width')}
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive tooltip={i18n.t('sidebar.story.home', 'Home')}>
                <HomeIcon />
                <span>{i18n.t('sidebar.story.home', 'Home')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={i18n.t('sidebar.story.users', 'Users')}>
                <UsersIcon />
                <span>{i18n.t('sidebar.story.users', 'Users')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={i18n.t('sidebar.story.settings', 'Settings')}>
                <SettingsIcon />
                <span>{i18n.t('sidebar.story.settings', 'Settings')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="p-6">
          <div className="text-sm font-medium">
            {i18n.t('sidebar.story.mainContent', 'Main Content')}
          </div>
          <div className="text-muted-foreground mt-2 text-sm">
            {i18n.t('sidebar.story.defaultSidebarWidth', 'Default sidebar width.')}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    expect(canvas.getByText('Default Width')).toBeInTheDocument();

    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    expect(canvasElement.querySelector('[data-slot="sidebar-content"]')).toBeInTheDocument();
  },
};

export const SizeWideWidth: Story = {
  name: i18n.t('sidebar.storyName.sizeWideWidth', 'Size: Wide Width'),
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="inset" className="w-80">
        <SidebarHeader>
          <div className="text-base font-semibold">
            {i18n.t('sidebar.story.wideSidebar', 'Wide Sidebar')}
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive
                tooltip={i18n.t('sidebar.story.home', 'Home')}
                className="py-3 text-base"
              >
                <HomeIcon className="h-5 w-5" />
                <span>{i18n.t('sidebar.story.home', 'Home')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={i18n.t('sidebar.story.users', 'Users')}
                className="py-3 text-base"
              >
                <UsersIcon className="h-5 w-5" />
                <span>{i18n.t('sidebar.story.users', 'Users')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={i18n.t('sidebar.story.settings', 'Settings')}
                className="py-3 text-base"
              >
                <SettingsIcon className="h-5 w-5" />
                <span>{i18n.t('sidebar.story.settings', 'Settings')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <Button className="w-full" size="lg" variant="outline">
            Upgrade to Pro
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="p-6">
          <div className="text-sm font-medium">
            {i18n.t('sidebar.story.mainContent', 'Main Content')}
          </div>
          <div className="text-muted-foreground mt-2 text-sm">Wide sidebar width (w-80).</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    expect(canvas.getByText('Wide Sidebar')).toBeInTheDocument();

    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    // Verify footer with upgrade button
    expect(canvasElement.querySelector('[data-slot="sidebar-footer"]')).toBeInTheDocument();
    expect(canvas.getByText('Upgrade to Pro')).toBeInTheDocument();
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    // Verify sidebar has expected state
    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    // Verify sidebar menu buttons exist
    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    // Verify dark theme is applied by checking document
    expect(canvasElement.ownerDocument.documentElement.classList.contains('dark')).toBe(true);

    // Verify sidebar content exists
    expect(canvasElement.querySelector('[data-slot="sidebar-content"]')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    // Verify sidebar has expected state
    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    // Verify sidebar menu buttons exist
    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    // Verify RTL direction is applied
    expect(canvasElement.ownerDocument.documentElement.getAttribute('dir')).toBe('rtl');

    // Verify sidebar content exists
    expect(canvasElement.querySelector('[data-slot="sidebar-content"]')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: () => <I18nSidebarDemo />,
  play: async (context) => {
    const root = context.canvasElement;

    if (!root.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(root.ownerDocument.documentElement.lang).toBe('ja');

    const workspaceTitle = root.querySelector('[data-sidebar-workspace-title]');

    if (!(workspaceTitle instanceof HTMLElement)) {
      throw new Error('Sidebar workspace title was not found.');
    }

    expect(within(workspaceTitle).getByText('ワークスペース')).toBeInTheDocument();

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
  name: i18n.t('sidebar.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar
        collapsible="icon"
        variant="inset"
        aria-label={i18n.t('sidebar.story.mainNavigation', 'Main navigation')}
      >
        <SidebarHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">
              {i18n.t('sidebar.story.accessibleSidebar', 'Accessible Sidebar')}
            </div>
            <SidebarTrigger aria-label={i18n.t('sidebar.story.toggleSidebar', 'Toggle sidebar')} />
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <nav aria-label={i18n.t('sidebar.story.primaryNavigation', 'Primary navigation')}>
            <SidebarMenu role="menubar">
              <SidebarMenuItem role="none">
                <SidebarMenuButton
                  isActive
                  tooltip={i18n.t('sidebar.story.home', 'Home')}
                  role="menuitem"
                  aria-current="page"
                >
                  <HomeIcon aria-hidden="true" />
                  <span>{i18n.t('sidebar.story.home', 'Home')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem role="none">
                <SidebarMenuButton tooltip={i18n.t('sidebar.story.users', 'Users')} role="menuitem">
                  <UsersIcon aria-hidden="true" />
                  <span>{i18n.t('sidebar.story.users', 'Users')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem role="none">
                <SidebarMenuButton
                  tooltip={i18n.t('sidebar.story.settings', 'Settings')}
                  role="menuitem"
                >
                  <SettingsIcon aria-hidden="true" />
                  <span>{i18n.t('sidebar.story.settings', 'Settings')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </nav>
        </SidebarContent>
        <SidebarFooter>
          <Button className="w-full" size="sm" variant="outline">
            Upgrade
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <main aria-label={i18n.t('sidebar.story.mainContent', 'Main content')}>
          <div className="p-6">
            <h1 className="text-sm font-medium">
              {i18n.t('sidebar.story.mainContent', 'Main Content')}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Sidebar navigation is accessible via keyboard.
            </p>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find the sidebar
    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar?.getAttribute('aria-label')).toBe('Main navigation');

    // Find the navigation
    const nav = canvas.getByRole('navigation', { name: 'Primary navigation' });
    expect(nav).toBeInTheDocument();

    // Find menu items
    const homeButton = canvas.getByRole('menuitem', { name: /Home/ });
    const usersButton = canvas.getByRole('menuitem', { name: /Users/ });
    const settingsButton = canvas.getByRole('menuitem', { name: /Settings/ });

    expect(homeButton).toBeInTheDocument();
    expect(usersButton).toBeInTheDocument();
    expect(settingsButton).toBeInTheDocument();

    // Verify active item has aria-current
    expect(homeButton.getAttribute('aria-current')).toBe('page');

    // Find the toggle trigger
    const trigger = canvas.getByRole('button', { name: 'Toggle sidebar' });
    expect(trigger).toBeInTheDocument();

    // Test keyboard navigation
    await userEvent.tab();
    await userEvent.tab();

    // Test sidebar toggle with keyboard
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(sidebar?.getAttribute('data-state')).toBe('collapsed');
    });
  },
};

// ============ MSW + FAKER STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const menuItems = createFakeSidebarMenuItems(5);

    return (
      <SidebarProvider data-testid="faker-sidebar-provider">
        <Sidebar>
          <SidebarHeader>
            <div className="p-2 text-sm font-semibold">
              {i18n.t('sidebar.story.fakerSidebar', 'Faker Sidebar')}
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton asChild>
                    <a data-sidebar-faker-item href={item.href ?? '#'}>
                      <span>{item.label}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <div className="text-muted-foreground p-2 text-xs">
              {i18n.t('sidebar.story.factoryGeneratedItems')}
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <div className="p-4">{i18n.t('sidebar.story.mainContentArea', 'Main content area')}</div>
        </SidebarInset>
      </SidebarProvider>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    const menuButtons = canvasElement.querySelectorAll('[data-sidebar-faker-item]');
    expect(menuButtons.length).toBe(5);
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: sidebarHandlers,
    },
  },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    // Verify sidebar has expected state
    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    // Verify sidebar menu buttons exist
    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    // Verify sidebar header exists
    expect(canvasElement.querySelector('[data-slot="sidebar-header"]')).toBeInTheDocument();

    // Verify sidebar content exists
    expect(canvasElement.querySelector('[data-slot="sidebar-content"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: sidebarStatusHandlers.loading,
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    expect(canvasElement.querySelector('[data-slot="sidebar-header"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="sidebar-content"]')).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sidebarStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    expect(canvasElement.querySelector('[data-slot="sidebar-content"]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sidebarStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    expect(canvasElement.querySelector('[data-slot="sidebar-content"]')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sidebarStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    expect(canvasElement.querySelector('[data-slot="sidebar-content"]')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sidebarStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    expect(canvasElement.querySelector('[data-slot="sidebar-content"]')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sidebarStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    expect(canvasElement.querySelector('[data-slot="sidebar-content"]')).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sidebarStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeInTheDocument();

    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    const menuButtons = canvasElement.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(menuButtons.length).toBe(3);

    expect(canvasElement.querySelector('[data-slot="sidebar-content"]')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY CATALOG REFERENCE
// Available factory functions for additional story coverage:
//   createFakeSidebarSubItem
//   createFakeSidebarSubItems
//   createFakeSidebarMenuItemWithSubmenu
//   createFakeSidebarGroup
//   createFakeSidebarGroups
//   createFakeSidebarUser
//   createFakeSidebarWorkspace
//   createFakeSidebars
//   createFakeAppSidebar
//   createFakeMinimalSidebar
//   createFakeFloatingSidebar
//   createFakeRightSidebar
//   createFakeSidebarWithSubmenus
//   createFakeSidebarWithBadges
//   createSidebarVariantMatrix
//   createSidebarCollapsibleMatrix
//   createSidebarSideMatrix
//   createSidebarShowcase
//   createSidebarTestData
// ============================================================================

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   notFound
//   conflict
//   tooManyRequests
//   badGateway
//   serviceUnavailable
//   gatewayTimeout
//   slowResponse
//   emptyData
//   favorites
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: sidebarStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: sidebarStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: sidebarStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: sidebarStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: sidebarStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: sidebarStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: sidebarStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: sidebarStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('sidebar.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: sidebarStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
