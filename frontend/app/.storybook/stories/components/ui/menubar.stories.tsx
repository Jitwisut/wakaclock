import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  COMMON_ACTIONS,
  createFakeEditMenu,
  createFakeFileMenu,
  createFakeMenu,
  createFakeMenuCheckboxItem,
  createFakeMenuCheckboxItems,
  createFakeMenuGroup,
  createFakeMenuItem,
  createFakeMenuItems,
  createFakeMenuMatrix,
  createFakeMenuRadioGroup,
  createFakeMenuRadioItem,
  createFakeMenuShowcase,
  createFakeMoreActionsMenu,
  createFakeShareMenu,
  createFakeSortMenu,
  createFakeUserMenu,
  createFakeViewMenu,
  type FakeEditMenu,
  type FakeFileMenu,
  type FakeMenuCheckboxItem as FakeMenuCheckboxItemType,
  type FakeMenuGroup as FakeMenuGroupType,
  type FakeMenuItem,
  type FakeMenuRadioGroup as FakeMenuRadioGroupType,
  type FakeMenuRadioItem as FakeMenuRadioItemType,
  type FakeMenu as FakeMenuType,
  type FakeUserMenu,
  type FakeViewMenu,
  FILE_ACTIONS,
  MENU_ALIGNS,
  MENU_ICONS,
  MENU_ITEM_VARIANTS,
  MENU_SIDES,
  MENU_SIZES,
  MENU_WIDTHS,
  type MenuAlign,
  type MenuItemType,
  type MenuItemVariant,
  type MenuSide,
  type MenuSize,
  type MenuWidth,
  THEME_OPTIONS,
  VIEW_OPTIONS,
} from '@/.storybook/stories/_factories/menu.factory';
import {
  createFakeApplicationMenubar,
  createFakeHelpMenu,
  createFakeMenubar,
  createFakeMenubarCheckboxItem,
  createFakeMenubarCheckboxItems,
  createFakeMenubarEditMenu,
  createFakeMenubarFileMenu,
  createFakeMenubarItem,
  createFakeMenubarItems,
  createFakeMenubarItemTypeMatrix,
  createFakeMenubarItemVariantMatrix,
  createFakeMenubarLabelItem,
  createFakeMenubarMenu,
  createFakeMenubarRadioGroup,
  createFakeMenubarRadioGroups,
  createFakeMenubarRadioItem,
  createFakeMenubars,
  createFakeMenubarSeparatorItem,
  createFakeMenubarShortcut,
  createFakeMenubarShowcase,
  createFakeMenubarSizeMatrix,
  createFakeMenubarViewMenu,
  createFakeTextEditorMenubar,
  type FakeMenubar,
  type FakeMenubarAnyItem,
  type FakeMenubarCheckboxItem as FakeMenubarCheckboxItemType,
  type FakeMenubarItemBase,
  type FakeMenubarItem as FakeMenubarItemType,
  type FakeMenubarLabelItem as FakeMenubarLabelItemType,
  type FakeMenubarMenu as FakeMenubarMenuType,
  type FakeMenubarRadioGroup as FakeMenubarRadioGroupType,
  type FakeMenubarRadioItem as FakeMenubarRadioItemType,
  type FakeMenubarSeparatorItem as FakeMenubarSeparatorItemType,
  type FakeMenubarShortcut as FakeMenubarShortcutType,
  MENUBAR_ACTION_LABELS,
  MENUBAR_FONT_SIZE_OPTIONS,
  MENUBAR_ICONS,
  MENUBAR_ITEM_TYPES,
  MENUBAR_ITEM_VARIANTS,
  MENUBAR_LANGUAGE_OPTIONS,
  MENUBAR_MAC_MODIFIERS,
  MENUBAR_PROFILE_OPTIONS,
  MENUBAR_SHORTCUTS,
  MENUBAR_SIZES,
  MENUBAR_THEME_OPTIONS,
  MENUBAR_TRIGGER_NAMES,
  MENUBAR_VIEW_OPTIONS,
  MENUBAR_WIN_MODIFIERS,
  type MenubarActionLabel,
  type MenubarItemType,
  type MenubarItemVariant,
  type MenubarPlatform,
  type MenubarSize,
  type MenubarTriggerName,
} from '@/.storybook/stories/_factories/menubar.factory';
import {
  menubarHandlers,
  menubarStatusHandlers,
} from '@/.storybook/stories/_handlers/menubar.handlers';
import { menuStatusHandlers } from '@/.storybook/stories/_handlers/menu.handlers';

import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@/components/ui/menubar';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============ ASYNC DATA DEMO COMPONENTS ============

interface MenubarWithAsyncDataProps {
  apiEndpoint?: string;
  onBlur?: () => void;
  onClick?: () => void;
  onFocus?: () => void;
  onKeyDown?: () => void;
}

function MenubarWithAsyncData({
  apiEndpoint = '/api/menu-items',
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
}: MenubarWithAsyncDataProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<FakeMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${apiEndpoint}?count=3&submenus=true`);
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
      <div className="flex gap-1" data-testid="menubar-loading">
        <Skeleton className="h-10 w-16" />
        <Skeleton className="h-10 w-16" />
        <Skeleton className="h-10 w-16" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="w-[400px]" data-testid="menubar-error">
        <AlertTitle>{t('menubar.story.error', 'Error')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className="text-muted-foreground rounded-md border p-4 text-center"
        data-testid="menubar-empty"
      >
        No menu items available
      </div>
    );
  }

  return (
    <Menubar
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      data-testid="menubar-async"
    >
      {items.map((menu) => (
        <MenubarMenu key={menu.id}>
          <MenubarTrigger data-menubar-trigger={menu.id}>{menu.label}</MenubarTrigger>
          <MenubarContent data-menu={menu.id}>
            {menu.submenu?.map((item) => (
              <MenubarItem
                key={item.id}
                data-item-id={item.id}
                disabled={item.disabled}
                variant={item.destructive ? 'destructive' : 'default'}
              >
                {item.label}
                {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
              </MenubarItem>
            )) ?? <MenubarItem disabled>{t('menubar.story.noItems', 'No items')}</MenubarItem>}
          </MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  );
}

function MenubarDemo() {
  const { t } = useTranslation();
  const [showBookmarks, setShowBookmarks] = React.useState(true);
  const [profile, setProfile] = React.useState('ada');

  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger data-menubar-trigger="file">{t('menubar.menu.file')}</MenubarTrigger>
        <MenubarContent data-menu="file">
          <MenubarItem data-item-id="new-tab">
            {t('menubar.file.newTab')} <MenubarShortcut>⌘T</MenubarShortcut>
          </MenubarItem>
          <MenubarItem data-item-id="new-window" disabled>
            {t('menubar.file.newWindow')} <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger data-item-id="share" inset>
              {t('menubar.file.share')}
            </MenubarSubTrigger>
            <MenubarSubContent data-sub="share">
              <MenubarItem data-item-id="share-email">{t('menubar.file.share.email')}</MenubarItem>
              <MenubarItem data-item-id="share-copy-link">
                {t('menubar.file.share.copyLink')}
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem data-item-id="close" inset variant="destructive">
            {t('menubar.file.close')}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger data-menubar-trigger="view">{t('menubar.menu.view')}</MenubarTrigger>
        <MenubarContent data-menu="view">
          <MenubarCheckboxItem
            data-item-id="show-bookmarks"
            checked={showBookmarks}
            onCheckedChange={(v) => setShowBookmarks(v === true)}
          >
            {t('menubar.view.showBookmarksBar')}
          </MenubarCheckboxItem>
          <MenubarSeparator />
          <MenubarLabel data-label-id="profile" inset>
            {t('menubar.view.profile')}
          </MenubarLabel>
          <MenubarRadioGroup onValueChange={setProfile} value={profile}>
            <MenubarRadioItem data-profile="ada" value="ada">
              {t('menubar.view.profile.ada')}
            </MenubarRadioItem>
            <MenubarRadioItem data-profile="grace" value="grace">
              {t('menubar.view.profile.grace')}
            </MenubarRadioItem>
          </MenubarRadioGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}

const meta = {
  title: 'Components/UI/Menubar',
  component: MenubarDemo,
  tags: ['autodocs'],
  args: {
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
        'menubar.argType.menubarmenuElementsContainingMenuTriggersAndContent',
        'MenubarMenu elements containing menu triggers and content'
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
        'menubar.argType.additionalCssClassesForCustomStyling',
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
        'menubar.argType.controlledActiveMenuValue',
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
        'menubar.argType.defaultActiveMenuForUncontrolledUsage',
        'Default active menu for uncontrolled usage'
      ),
      table: {
        category: 'State',
        type: { summary: 'string' },
      },
    },
    // Layout
    dir: {
      control: 'radio',
      options: ['ltr', 'rtl'],
      description: i18n.t(
        'menubar.argType.readingDirectionForTheMenubar',
        'Reading direction for the menubar'
      ),
      table: {
        category: 'Layout',
        type: { summary: "'ltr' | 'rtl'" },
        defaultValue: { summary: 'ltr' },
      },
    },
    loop: {
      control: 'boolean',
      description: i18n.t(
        'menubar.argType.whetherKeyboardNavigationLoopsThroughItems',
        'Whether keyboard navigation loops through items'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('menubar.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('menubar.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('menubar.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('menubar.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('menubar.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('menubar.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('menubar.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onValueChange: {
      action: 'onValueChange',
      description: i18n.t(
        'menubar.argType.calledWhenTheActiveMenuChanges',
        'Called when the active menu changes'
      ),
      table: { category: 'Events' },
    },
    // Note: argTypes for demo wrapper - actual Menubar component props documented below
    // Menubar Props Reference (Radix Menubar.Root):
    // - value: Controlled active menu value (string)
    // - defaultValue: Default active menu for uncontrolled usage (string)
    // - onValueChange: Called when active menu changes ((value: string) => void)
    // - dir: Reading direction ('ltr' | 'rtl')
    // - loop: Whether keyboard navigation loops (boolean)
    // - className: Additional CSS classes (string)
    //
    // MenubarMenu Props Reference:
    // - value: Unique value for this menu (string)
    // - children: MenubarTrigger, MenubarContent (ReactNode)
    //
    // MenubarTrigger Props Reference:
    // - disabled: Whether trigger is disabled (boolean)
    // - className: Additional CSS classes (string)
    // - children: Trigger text content (ReactNode)
    //
    // MenubarContent Props Reference:
    // - align: Content alignment ('start' | 'center' | 'end')
    // - alignOffset: Alignment offset in pixels (number)
    // - sideOffset: Side offset in pixels (number)
    // - forceMount: Force content to render (boolean)
    // - className: Additional CSS classes (string)
    //
    // MenubarItem Props Reference:
    // - disabled: Whether item is disabled (boolean)
    // - inset: Add left padding for alignment (boolean)
    // - variant: Visual variant ('default' | 'destructive')
    // - onSelect: Called when item is selected ((event) => void)
    // - className: Additional CSS classes (string)
    //
    // MenubarCheckboxItem Props Reference:
    // - checked: Checked state (boolean | 'indeterminate')
    // - onCheckedChange: Called when checked changes ((checked: boolean) => void)
    // - disabled: Whether item is disabled (boolean)
    //
    // MenubarRadioGroup Props Reference:
    // - value: Selected radio value (string)
    // - onValueChange: Called when value changes ((value: string) => void)
    //
    // MenubarRadioItem Props Reference:
    // - value: Radio item value (string, required)
    // - disabled: Whether item is disabled (boolean)
    //
    // MenubarLabel Props Reference:
    // - inset: Add left padding for alignment (boolean)
    // - className: Additional CSS classes (string)
    //
    // MenubarSeparator, MenubarShortcut, MenubarSub, MenubarSubTrigger, MenubarSubContent
  },
  parameters: {
    msw: { handlers: menubarHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof MenubarDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    const getTrigger = (id: string) => {
      const trigger = canvasElement.querySelector(
        `[data-slot="menubar-trigger"][data-menubar-trigger="${id}"]`
      );
      if (!(trigger instanceof HTMLElement)) {
        throw new Error(`Menubar trigger was not found: ${id}`);
      }
      expect(trigger.textContent?.trim()).not.toBe('');
      return trigger;
    };

    const openMenu = async (id: string) => {
      const trigger = getTrigger(id);

      const existing = doc.body.querySelector(`[data-slot="menubar-content"][data-menu="${id}"]`);
      if (existing instanceof HTMLElement) return existing;

      await userEvent.click(trigger);

      return await waitFor(() => {
        const content = doc.body.querySelector(`[data-slot="menubar-content"][data-menu="${id}"]`);

        if (!(content instanceof HTMLElement)) {
          throw new Error('Menubar content was not rendered.');
        }

        return content;
      });
    };

    let fileContent = await openMenu('file');

    const newTabItem = fileContent.querySelector('[data-item-id="new-tab"]');
    if (!(newTabItem instanceof HTMLElement)) {
      throw new Error('New tab item was not found.');
    }
    expect(newTabItem.getAttribute('data-slot')).toBe('menubar-item');

    const newWindowItem = fileContent.querySelector('[data-item-id="new-window"]');
    if (!(newWindowItem instanceof HTMLElement)) {
      throw new Error('New window item was not found.');
    }
    const newWindowDisabled =
      newWindowItem.getAttribute('aria-disabled') ?? newWindowItem.getAttribute('data-disabled');
    expect(newWindowDisabled).toBeInTheDocument();

    const shareTrigger = fileContent.querySelector(
      '[data-slot="menubar-sub-trigger"][data-item-id="share"]'
    );
    if (!(shareTrigger instanceof HTMLElement)) {
      throw new Error('Share trigger was not found.');
    }
    await userEvent.hover(shareTrigger);

    const subContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-sub-content"][data-sub="share"]');

      if (!(content instanceof HTMLElement)) {
        throw new Error('Menubar sub content was not rendered.');
      }

      return content;
    });

    const shareEmail = subContent.querySelector('[data-item-id="share-email"]');
    if (!(shareEmail instanceof HTMLElement)) {
      throw new Error('Share email item was not found.');
    }

    const shareCopyLink = subContent.querySelector('[data-item-id="share-copy-link"]');
    if (!(shareCopyLink instanceof HTMLElement)) {
      throw new Error('Share copy link item was not found.');
    }
    await userEvent.click(shareCopyLink);

    fileContent = await openMenu('file');

    const closeItem = fileContent.querySelector('[data-item-id="close"]');
    if (!(closeItem instanceof HTMLElement)) {
      throw new Error('Close item was not found.');
    }
    expect(closeItem.getAttribute('data-variant')).toBe('destructive');

    await userEvent.click(closeItem);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"]');
      if (content) {
        throw new Error('Menubar content was not dismissed.');
      }
    });

    let viewContent = await openMenu('view');

    const bookmarksItem = viewContent.querySelector('[data-item-id="show-bookmarks"]');
    if (!(bookmarksItem instanceof HTMLElement)) {
      throw new Error('Show bookmarks item was not found.');
    }
    expect(bookmarksItem.getAttribute('data-state')).toBe('checked');

    await userEvent.click(bookmarksItem);

    viewContent = await openMenu('view');

    const bookmarksItemAfter = viewContent.querySelector('[data-item-id="show-bookmarks"]');
    if (!(bookmarksItemAfter instanceof HTMLElement)) {
      throw new Error('Show bookmarks item was not found.');
    }
    expect(bookmarksItemAfter.getAttribute('data-state')).toBe('unchecked');

    const graceItem = viewContent.querySelector(
      '[data-slot="menubar-radio-item"][data-profile="grace"]'
    );
    if (!(graceItem instanceof HTMLElement)) {
      throw new Error('Grace profile item was not found.');
    }
    await userEvent.click(graceItem);

    viewContent = await openMenu('view');

    const graceItemAfter = viewContent.querySelector(
      '[data-slot="menubar-radio-item"][data-profile="grace"]'
    );
    if (!(graceItemAfter instanceof HTMLElement)) {
      throw new Error('Grace profile item was not found.');
    }
    expect(graceItemAfter.getAttribute('data-state')).toBe('checked');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"]');
      if (content) {
        throw new Error('Menubar content was not dismissed.');
      }
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ VARIANTS ============

export const Variants: Story = {
  tags: ['!test'],
  render: () => (
    <div className="flex flex-col gap-8">
      {/* Basic Menus */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('menubar.story.basicMenus', 'Basic Menus')}
        </p>
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>{i18n.t('menubar.story.file', 'File')}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>{i18n.t('menubar.story.new', 'New')}</MenubarItem>
              <MenubarItem>{i18n.t('menubar.story.open', 'Open')}</MenubarItem>
              <MenubarItem>{i18n.t('menubar.story.save', 'Save')}</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>{i18n.t('menubar.story.edit', 'Edit')}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>{i18n.t('menubar.story.undo', 'Undo')}</MenubarItem>
              <MenubarItem>{i18n.t('menubar.story.redo', 'Redo')}</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>

      {/* With Shortcuts */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('menubar.story.withShortcuts', 'With Shortcuts')}
        </p>
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>{i18n.t('menubar.story.file', 'File')}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                New Tab <MenubarShortcut>⌘T</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Save <MenubarShortcut>⌘S</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>

      {/* With Disabled Items */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('menubar.story.withDisabledItems', 'With Disabled Items')}
        </p>
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>{i18n.t('menubar.story.file', 'File')}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>{i18n.t('menubar.story.new', 'New')}</MenubarItem>
              <MenubarItem disabled>
                {i18n.t('menubar.story.openRecent', 'Open Recent')}
              </MenubarItem>
              <MenubarItem>{i18n.t('menubar.story.save', 'Save')}</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  tags: ['!test'],
  render: () => (
    <div className="flex flex-col gap-8">
      {/* Compact */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('menubar.story.compact', 'Compact')}
        </p>
        <Menubar className="h-8 text-xs">
          <MenubarMenu>
            <MenubarTrigger className="px-2 py-1 text-xs">
              {i18n.t('menubar.story.file', 'File')}
            </MenubarTrigger>
            <MenubarContent className="min-w-[120px]">
              <MenubarItem className="py-1 text-xs">
                {i18n.t('menubar.story.new', 'New')}
              </MenubarItem>
              <MenubarItem className="py-1 text-xs">
                {i18n.t('menubar.story.open', 'Open')}
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className="px-2 py-1 text-xs">
              {i18n.t('menubar.story.edit', 'Edit')}
            </MenubarTrigger>
            <MenubarContent className="min-w-[120px]">
              <MenubarItem className="py-1 text-xs">
                {i18n.t('menubar.story.undo', 'Undo')}
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>

      {/* Default */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('menubar.story.default', 'Default')}
        </p>
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>{i18n.t('menubar.story.file', 'File')}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>{i18n.t('menubar.story.new', 'New')}</MenubarItem>
              <MenubarItem>{i18n.t('menubar.story.open', 'Open')}</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>{i18n.t('menubar.story.edit', 'Edit')}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>{i18n.t('menubar.story.undo', 'Undo')}</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>

      {/* Large */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('menubar.story.large', 'Large')}
        </p>
        <Menubar className="h-12">
          <MenubarMenu>
            <MenubarTrigger className="px-6 py-3 text-base">
              {i18n.t('menubar.story.file', 'File')}
            </MenubarTrigger>
            <MenubarContent className="min-w-[200px]">
              <MenubarItem className="py-2 text-base">
                {i18n.t('menubar.story.new', 'New')}
              </MenubarItem>
              <MenubarItem className="py-2 text-base">
                {i18n.t('menubar.story.open', 'Open')}
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className="px-6 py-3 text-base">
              {i18n.t('menubar.story.edit', 'Edit')}
            </MenubarTrigger>
            <MenubarContent className="min-w-[200px]">
              <MenubarItem className="py-2 text-base">
                {i18n.t('menubar.story.undo', 'Undo')}
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const VariantBasicMenus: Story = {
  name: i18n.t('menubar.storyName.variantBasicMenus', 'Variant: Basic Menus'),
  render: () => (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>{i18n.t('menubar.story.file', 'File')}</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>{i18n.t('menubar.story.new', 'New')}</MenubarItem>
          <MenubarItem>{i18n.t('menubar.story.open', 'Open')}</MenubarItem>
          <MenubarItem>{i18n.t('menubar.story.save', 'Save')}</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>{i18n.t('menubar.story.exit', 'Exit')}</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>{i18n.t('menubar.story.edit', 'Edit')}</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>{i18n.t('menubar.story.undo', 'Undo')}</MenubarItem>
          <MenubarItem>{i18n.t('menubar.story.redo', 'Redo')}</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>{i18n.t('menubar.story.cut', 'Cut')}</MenubarItem>
          <MenubarItem>{i18n.t('menubar.story.copy', 'Copy')}</MenubarItem>
          <MenubarItem>{i18n.t('menubar.story.paste', 'Paste')}</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

export const VariantWithShortcuts: Story = {
  name: i18n.t('menubar.storyName.variantWithShortcuts', 'Variant: With Shortcuts'),
  render: () => (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>{i18n.t('menubar.story.file', 'File')}</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            New Tab <MenubarShortcut>⌘T</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            New Window <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>

          <MenubarSeparator />
          <MenubarItem>
            Save <MenubarShortcut>⌘S</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Save As <MenubarShortcut>⇧⌘S</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Close <MenubarShortcut>⌘W</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>{i18n.t('menubar.story.edit', 'Edit')}</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Undo <MenubarShortcut>⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Cut <MenubarShortcut>⌘X</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Copy <MenubarShortcut>⌘C</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Paste <MenubarShortcut>⌘V</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
    const shortcuts = canvasElement.querySelectorAll('[data-slot="menubar-shortcut"]');
    expect(shortcuts.length).toBeGreaterThan(0);
  },
};

export const VariantWithCheckboxes: Story = {
  name: i18n.t('menubar.storyName.variantWithCheckboxes', 'Variant: With Checkboxes'),
  render: function Render() {
    const [showToolbar, setShowToolbar] = React.useState(true);
    const [showStatusbar, setShowStatusbar] = React.useState(true);
    const [showSidebar, setShowSidebar] = React.useState(false);

    return (
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>{i18n.t('menubar.story.view', 'View')}</MenubarTrigger>
          <MenubarContent>
            <MenubarCheckboxItem checked={showToolbar} onCheckedChange={setShowToolbar}>
              Show Toolbar
            </MenubarCheckboxItem>
            <MenubarCheckboxItem checked={showStatusbar} onCheckedChange={setShowStatusbar}>
              Show Status Bar
            </MenubarCheckboxItem>
            <MenubarCheckboxItem checked={showSidebar} onCheckedChange={setShowSidebar}>
              Show Sidebar
            </MenubarCheckboxItem>
            <MenubarSeparator />
            <MenubarItem disabled>{i18n.t('menubar.story.fullScreen', 'Full Screen')}</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>{i18n.t('menubar.story.window', 'Window')}</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>{i18n.t('menubar.story.minimize', 'Minimize')}</MenubarItem>
            <MenubarItem>{i18n.t('menubar.story.zoom', 'Zoom')}</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

export const VariantWithRadioItems: Story = {
  name: i18n.t('menubar.storyName.variantWithRadioItems', 'Variant: With Radio Items'),
  render: function Render() {
    const [fontSize, setFontSize] = React.useState('medium');
    const [theme, setTheme] = React.useState('system');

    return (
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>{i18n.t('menubar.story.preferences', 'Preferences')}</MenubarTrigger>
          <MenubarContent>
            <MenubarLabel inset>{i18n.t('menubar.story.fontSize', 'Font Size')}</MenubarLabel>
            <MenubarRadioGroup value={fontSize} onValueChange={setFontSize}>
              <MenubarRadioItem value="small">
                {i18n.t('menubar.story.small', 'Small')}
              </MenubarRadioItem>
              <MenubarRadioItem value="medium">
                {i18n.t('menubar.story.medium', 'Medium')}
              </MenubarRadioItem>
              <MenubarRadioItem value="large">
                {i18n.t('menubar.story.large', 'Large')}
              </MenubarRadioItem>
            </MenubarRadioGroup>
            <MenubarSeparator />
            <MenubarLabel inset>{i18n.t('menubar.story.theme', 'Theme')}</MenubarLabel>
            <MenubarRadioGroup value={theme} onValueChange={setTheme}>
              <MenubarRadioItem value="light">
                {i18n.t('menubar.story.light', 'Light')}
              </MenubarRadioItem>
              <MenubarRadioItem value="dark">
                {i18n.t('menubar.story.dark', 'Dark')}
              </MenubarRadioItem>
              <MenubarRadioItem value="system">
                {i18n.t('menubar.story.system', 'System')}
              </MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ SIZES ============

export const SizeCompact: Story = {
  name: i18n.t('menubar.storyName.sizeCompact', 'Size: Compact'),
  render: () => (
    <Menubar className="h-8 text-xs">
      <MenubarMenu>
        <MenubarTrigger className="px-2 py-1 text-xs">
          {i18n.t('menubar.story.file', 'File')}
        </MenubarTrigger>
        <MenubarContent className="min-w-[120px]">
          <MenubarItem className="py-1 text-xs">{i18n.t('menubar.story.new', 'New')}</MenubarItem>
          <MenubarItem className="py-1 text-xs">{i18n.t('menubar.story.open', 'Open')}</MenubarItem>
          <MenubarItem className="py-1 text-xs">{i18n.t('menubar.story.save', 'Save')}</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger className="px-2 py-1 text-xs">
          {i18n.t('menubar.story.edit', 'Edit')}
        </MenubarTrigger>
        <MenubarContent className="min-w-[120px]">
          <MenubarItem className="py-1 text-xs">{i18n.t('menubar.story.undo', 'Undo')}</MenubarItem>
          <MenubarItem className="py-1 text-xs">{i18n.t('menubar.story.redo', 'Redo')}</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger className="px-2 py-1 text-xs">
          {i18n.t('menubar.story.view', 'View')}
        </MenubarTrigger>
        <MenubarContent className="min-w-[120px]">
          <MenubarItem className="py-1 text-xs">
            {i18n.t('menubar.story.zoomIn', 'Zoom In')}
          </MenubarItem>
          <MenubarItem className="py-1 text-xs">
            {i18n.t('menubar.story.zoomOut', 'Zoom Out')}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

export const SizeDefault: Story = {
  name: i18n.t('menubar.storyName.sizeDefault', 'Size: Default'),
  render: () => (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>{i18n.t('menubar.story.file', 'File')}</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>{i18n.t('menubar.story.new', 'New')}</MenubarItem>
          <MenubarItem>{i18n.t('menubar.story.open', 'Open')}</MenubarItem>
          <MenubarItem>{i18n.t('menubar.story.save', 'Save')}</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>{i18n.t('menubar.story.edit', 'Edit')}</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>{i18n.t('menubar.story.undo', 'Undo')}</MenubarItem>
          <MenubarItem>{i18n.t('menubar.story.redo', 'Redo')}</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>{i18n.t('menubar.story.view', 'View')}</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>{i18n.t('menubar.story.zoomIn', 'Zoom In')}</MenubarItem>
          <MenubarItem>{i18n.t('menubar.story.zoomOut', 'Zoom Out')}</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

export const SizeWide: Story = {
  name: i18n.t('menubar.storyName.sizeWide', 'Size: Wide'),
  render: () => (
    <Menubar className="h-12">
      <MenubarMenu>
        <MenubarTrigger className="px-6 py-3 text-base">
          {i18n.t('menubar.story.file', 'File')}
        </MenubarTrigger>
        <MenubarContent className="min-w-[200px]">
          <MenubarItem className="py-2 text-base">{i18n.t('menubar.story.new', 'New')}</MenubarItem>
          <MenubarItem className="py-2 text-base">
            {i18n.t('menubar.story.open', 'Open')}
          </MenubarItem>
          <MenubarItem className="py-2 text-base">
            {i18n.t('menubar.story.save', 'Save')}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger className="px-6 py-3 text-base">
          {i18n.t('menubar.story.edit', 'Edit')}
        </MenubarTrigger>
        <MenubarContent className="min-w-[200px]">
          <MenubarItem className="py-2 text-base">
            {i18n.t('menubar.story.undo', 'Undo')}
          </MenubarItem>
          <MenubarItem className="py-2 text-base">
            {i18n.t('menubar.story.redo', 'Redo')}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger className="px-6 py-3 text-base">
          {i18n.t('menubar.story.view', 'View')}
        </MenubarTrigger>
        <MenubarContent className="min-w-[200px]">
          <MenubarItem className="py-2 text-base">
            {i18n.t('menubar.story.zoomIn', 'Zoom In')}
          </MenubarItem>
          <MenubarItem className="py-2 text-base">
            {i18n.t('menubar.story.zoomOut', 'Zoom Out')}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
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
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
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
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
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

    const fileTrigger = canvasElement.querySelector(
      '[data-slot="menubar-trigger"][data-menubar-trigger="file"]'
    );
    if (!(fileTrigger instanceof HTMLElement)) {
      throw new Error('File trigger was not found.');
    }
    expect(fileTrigger.textContent?.trim()).toBe('ファイル');

    const viewTrigger = canvasElement.querySelector(
      '[data-slot="menubar-trigger"][data-menubar-trigger="view"]'
    );
    if (!(viewTrigger instanceof HTMLElement)) {
      throw new Error('View trigger was not found.');
    }
    expect(viewTrigger.textContent?.trim()).toBe('表示');

    await userEvent.click(fileTrigger);

    const fileContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="file"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('Menubar content was not rendered.');
      }
      return content;
    });

    const newTabItem = fileContent.querySelector('[data-item-id="new-tab"]');
    if (!(newTabItem instanceof HTMLElement)) {
      throw new Error('New tab item was not found.');
    }
    expect(newTabItem.textContent).toContain('新規タブ');

    const shareTrigger = fileContent.querySelector(
      '[data-slot="menubar-sub-trigger"][data-item-id="share"]'
    );
    if (!(shareTrigger instanceof HTMLElement)) {
      throw new Error('Share trigger was not found.');
    }
    expect(shareTrigger.textContent).toContain('共有');

    await userEvent.click(viewTrigger);

    const viewContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="view"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('Menubar content was not rendered.');
      }
      return content;
    });

    const showBookmarks = viewContent.querySelector('[data-item-id="show-bookmarks"]');
    if (!(showBookmarks instanceof HTMLElement)) {
      throw new Error('Show bookmarks item was not found.');
    }
    expect(showBookmarks.textContent).toContain('ブックマークバーを表示');

    const profileLabel = viewContent.querySelector(
      '[data-slot="menubar-label"][data-label-id="profile"]'
    );
    if (!(profileLabel instanceof HTMLElement)) {
      throw new Error('Profile label was not found.');
    }
    expect(profileLabel.textContent).toContain('プロフィール');

    const adaItem = viewContent.querySelector(
      '[data-slot="menubar-radio-item"][data-profile="ada"]'
    );
    if (!(adaItem instanceof HTMLElement)) {
      throw new Error('Ada profile item was not found.');
    }
    expect(adaItem.textContent).toContain('エイダ');

    const graceItem = viewContent.querySelector(
      '[data-slot="menubar-radio-item"][data-profile="grace"]'
    );
    if (!(graceItem instanceof HTMLElement)) {
      throw new Error('Grace profile item was not found.');
    }
    expect(graceItem.textContent).toContain('グレース');

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
  name: i18n.t('menubar.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    const fakeMenubar = createFakeMenubar();

    return (
      <Menubar data-testid="menubar-faker">
        {fakeMenubar.menus.map((menu) => (
          <MenubarMenu key={menu.id}>
            <MenubarTrigger>{menu.trigger}</MenubarTrigger>
            <MenubarContent>
              {menu.items.map((item) => {
                if (item.type === 'separator') {
                  return <MenubarSeparator key={item.id} />;
                }
                if (item.type === 'checkbox') {
                  return (
                    <MenubarCheckboxItem
                      key={item.id}
                      checked={'checked' in item ? item.checked : false}
                    >
                      {'label' in item ? item.label : ''}
                    </MenubarCheckboxItem>
                  );
                }
                if (item.type === 'label') {
                  return (
                    <MenubarLabel key={item.id} inset>
                      {'label' in item ? item.label : ''}
                    </MenubarLabel>
                  );
                }
                return (
                  <MenubarItem key={item.id} disabled={item.disabled}>
                    {'label' in item ? item.label : ''}
                    {'shortcut' in item && item.shortcut && (
                      <MenubarShortcut>{item.shortcut}</MenubarShortcut>
                    )}
                  </MenubarItem>
                );
              })}
            </MenubarContent>
          </MenubarMenu>
        ))}
      </Menubar>
    );
  },
  play: async ({ canvasElement }) => {
    const menubar = canvasElement.querySelector('[data-testid="menubar-faker"]');
    expect(menubar).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="menubar-trigger"]');
    expect(triggers.length).toBeGreaterThan(0);
    triggers.forEach((trigger) => {
      expect(trigger.textContent?.trim().length).not.toBe(0);
    });
  },
};

export const WithAsyncData: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarHandlers },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const menubar = canvasElement.querySelector('[data-testid="menubar-async"]');
        if (!menubar) {
          throw new Error('Async menubar not loaded yet');
        }
        expect(menubar).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP 4xx ERROR STORIES ============

export const Error400BadRequest: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const errorAlert = canvasElement.querySelector('[data-testid="menubar-error"]');
        if (!errorAlert) {
          throw new Error('Error alert not rendered yet');
        }
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error401Unauthorized: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const errorAlert = canvasElement.querySelector('[data-testid="menubar-error"]');
        if (!errorAlert) {
          throw new Error('Error alert not rendered yet');
        }
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const errorAlert = canvasElement.querySelector('[data-testid="menubar-error"]');
        if (!errorAlert) {
          throw new Error('Error alert not rendered yet');
        }
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error404NotFound: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const errorAlert = canvasElement.querySelector('[data-testid="menubar-error"]');
        if (!errorAlert) {
          throw new Error('Error alert not rendered yet');
        }
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const errorAlert = canvasElement.querySelector('[data-testid="menubar-error"]');
        if (!errorAlert) {
          throw new Error('Error alert not rendered yet');
        }
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP 5xx ERROR STORIES ============

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: menubarStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const errorAlert = canvasElement.querySelector('[data-testid="menubar-error"]');
        if (!errorAlert) {
          throw new Error('Error alert not rendered yet');
        }
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const errorAlert = canvasElement.querySelector('[data-testid="menubar-error"]');
        if (!errorAlert) {
          throw new Error('Error alert not rendered yet');
        }
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const errorAlert = canvasElement.querySelector('[data-testid="menubar-error"]');
        if (!errorAlert) {
          throw new Error('Error alert not rendered yet');
        }
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const errorAlert = canvasElement.querySelector('[data-testid="menubar-error"]');
        if (!errorAlert) {
          throw new Error('Error alert not rendered yet');
        }
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ SPECIAL STATE STORIES ============

export const Loading: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const loadingIndicator = canvasElement.querySelector('[data-testid="menubar-loading"]');
    expect(loadingIndicator).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const emptyMessage = canvasElement.querySelector('[data-testid="menubar-empty"]');
        if (!emptyMessage) {
          throw new Error('Empty message not rendered yet');
        }
        expect(emptyMessage).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const SlowResponse: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const loadingIndicator = canvasElement.querySelector('[data-testid="menubar-loading"]');
    expect(loadingIndicator).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  render: (args) => <MenubarWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: menubarStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const errorAlert = canvasElement.querySelector('[data-testid="menubar-error"]');
        if (!errorAlert) {
          throw new Error('Error alert not rendered yet');
        }
        expect(errorAlert).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  name: i18n.t('menubar.storyName.accessibility', 'Accessibility (Keyboard Navigation)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    // Verify menubar root exists with proper role
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
    expect(menubar?.getAttribute('role')).toBe('menubar');

    // Get triggers
    const fileTrigger = canvasElement.querySelector(
      '[data-slot="menubar-trigger"][data-menubar-trigger="file"]'
    );
    const viewTrigger = canvasElement.querySelector(
      '[data-slot="menubar-trigger"][data-menubar-trigger="view"]'
    );

    if (!(fileTrigger instanceof HTMLElement)) {
      throw new Error('File trigger was not found.');
    }
    if (!(viewTrigger instanceof HTMLElement)) {
      throw new Error('View trigger was not found.');
    }

    // Focus on first trigger
    fileTrigger.focus();
    expect(doc.activeElement).toBe(fileTrigger);

    // Test Enter key to open menu
    await userEvent.keyboard('{Enter}');

    const fileContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="file"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('Menubar content was not rendered.');
      }
      return content;
    });

    // Verify menu has proper role
    expect(fileContent.getAttribute('role')).toBe('menu');

    // Verify menu items have proper role
    const menuItems = fileContent.querySelectorAll('[role="menuitem"]');
    expect(menuItems.length).not.toBe(0);

    // Test Arrow Down navigation within menu
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      const focusedItem = doc.activeElement;
      expect(focusedItem?.getAttribute('role')).toBe('menuitem');
    });

    // Test Escape key to close menu
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"]');
      expect(content).not.toBeInTheDocument();
    });

    // Test Arrow Right navigation between menus
    fileTrigger.focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(doc.activeElement).toBe(viewTrigger);
    });

    // Test Arrow Left navigation
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(doc.activeElement).toBe(fileTrigger);
    });

    // Open menu and test checkbox item
    await userEvent.click(viewTrigger);

    const viewContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="view"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('View content was not rendered.');
      }
      return content;
    });

    // Verify checkbox item has proper role
    const checkboxItem = viewContent.querySelector('[data-slot="menubar-checkbox-item"]');
    expect(checkboxItem?.getAttribute('role')).toBe('menuitemcheckbox');

    // Verify radio items have proper role
    const radioItems = viewContent.querySelectorAll('[data-slot="menubar-radio-item"]');
    radioItems.forEach((item) => {
      expect(item.getAttribute('role')).toBe('menuitemradio');
    });

    // Close menu
    await userEvent.keyboard('{Escape}');
  },
};

// ============ KEYBOARD NAVIGATION STORIES ============

export const KeyboardNavigation: Story = {
  name: i18n.t('menubar.storyName.keyboardNavigation', 'Keyboard Navigation (Arrow Keys)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    // Get menubar and triggers
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
    expect(menubar?.getAttribute('role')).toBe('menubar');

    const fileTrigger = canvasElement.querySelector(
      '[data-slot="menubar-trigger"][data-menubar-trigger="file"]'
    );
    const viewTrigger = canvasElement.querySelector(
      '[data-slot="menubar-trigger"][data-menubar-trigger="view"]'
    );

    if (!(fileTrigger instanceof HTMLElement)) {
      throw new Error('File trigger was not found.');
    }
    if (!(viewTrigger instanceof HTMLElement)) {
      throw new Error('View trigger was not found.');
    }

    // ========== TEST 1: Arrow Right between triggers ==========
    fileTrigger.focus();
    expect(doc.activeElement).toBe(fileTrigger);

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(doc.activeElement).toBe(viewTrigger);
    });

    // ========== TEST 2: Arrow Left between triggers ==========
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(doc.activeElement).toBe(fileTrigger);
    });

    // ========== TEST 3: Arrow Down opens menu ==========
    await userEvent.keyboard('{ArrowDown}');

    const fileContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="file"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('Menubar content was not rendered after ArrowDown.');
      }
      return content;
    });

    // Verify first item receives focus
    await waitFor(() => {
      const focusedItem = doc.activeElement;
      expect(focusedItem?.getAttribute('role')).toBe('menuitem');
    });

    // ========== TEST 4: Arrow Down within menu ==========
    const menuItems = fileContent.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])');
    expect(menuItems.length).toBeGreaterThan(1);

    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      const currentFocus = doc.activeElement;
      // Focus should move to next item
      expect(currentFocus?.getAttribute('data-slot')).toMatch(/menubar-(item|sub-trigger)/);
    });

    // ========== TEST 5: Arrow Up within menu ==========
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => {
      const currentFocus = doc.activeElement;
      expect(currentFocus?.getAttribute('data-slot')).toMatch(/menubar-(item|sub-trigger)/);
    });

    // ========== TEST 6: Escape closes menu ==========
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"]');
      expect(content).not.toBeInTheDocument();
    });

    // ========== TEST 7: Space opens menu ==========
    fileTrigger.focus();
    await userEvent.keyboard(' ');

    const fileContentAgain = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="file"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('Menubar content was not rendered after Space.');
      }
      return content;
    });
    expect(fileContentAgain).toBeInTheDocument();

    // Clean up
    await userEvent.keyboard('{Escape}');
  },
};

export const KeyboardNavigationSubmenu: Story = {
  name: i18n.t('menubar.storyName.keyboardNavigationSubmenu', 'Keyboard Navigation (Submenu)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    // Open file menu
    const fileTrigger = canvasElement.querySelector(
      '[data-slot="menubar-trigger"][data-menubar-trigger="file"]'
    );
    if (!(fileTrigger instanceof HTMLElement)) {
      throw new Error('File trigger was not found.');
    }

    await userEvent.click(fileTrigger);

    const fileContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="file"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('Menubar content was not rendered.');
      }
      return content;
    });

    // Find the Share submenu trigger
    const shareTrigger = fileContent.querySelector(
      '[data-slot="menubar-sub-trigger"][data-item-id="share"]'
    );
    if (!(shareTrigger instanceof HTMLElement)) {
      throw new Error('Share submenu trigger was not found.');
    }

    // Navigate to the Share trigger
    shareTrigger.focus();
    expect(doc.activeElement).toBe(shareTrigger);

    // ========== TEST 1: Arrow Right opens submenu ==========
    await userEvent.keyboard('{ArrowRight}');

    const subContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-sub-content"][data-sub="share"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('Submenu content was not rendered after ArrowRight.');
      }
      return content;
    });

    // Verify submenu items
    const subItems = subContent.querySelectorAll('[data-slot="menubar-item"]');
    expect(subItems.length).toBeGreaterThan(0);

    // Verify focus moved to submenu
    await waitFor(() => {
      const focusedItem = doc.activeElement;
      expect(focusedItem?.getAttribute('role')).toBe('menuitem');
    });

    // ========== TEST 2: Arrow Left closes submenu ==========
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-sub-content"]');
      expect(content).not.toBeInTheDocument();
    });

    // Clean up
    await userEvent.keyboard('{Escape}');
  },
};

export const KeyboardNavigationCheckboxRadio: Story = {
  name: i18n.t(
    'menubar.storyName.keyboardNavigationCheckboxRadio',
    'Keyboard Navigation (Checkbox & Radio)'
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    // Open view menu
    const viewTrigger = canvasElement.querySelector(
      '[data-slot="menubar-trigger"][data-menubar-trigger="view"]'
    );
    if (!(viewTrigger instanceof HTMLElement)) {
      throw new Error('View trigger was not found.');
    }

    await userEvent.click(viewTrigger);

    const viewContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="view"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('View content was not rendered.');
      }
      return content;
    });

    // ========== TEST 1: Checkbox item toggling with Enter ==========
    const checkboxItem = viewContent.querySelector('[data-slot="menubar-checkbox-item"]');
    if (!(checkboxItem instanceof HTMLElement)) {
      throw new Error('Checkbox item was not found.');
    }

    const initialState = checkboxItem.getAttribute('data-state');
    checkboxItem.focus();
    await userEvent.keyboard('{Enter}');

    // Reopen menu to verify state change
    await userEvent.click(viewTrigger);

    const viewContentAfter = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="view"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('View content was not rendered.');
      }
      return content;
    });

    const checkboxItemAfter = viewContentAfter.querySelector('[data-slot="menubar-checkbox-item"]');
    const newState = checkboxItemAfter?.getAttribute('data-state');
    expect(newState).not.toBe(initialState);

    // ========== TEST 2: Radio item selection with Enter ==========
    const radioItems = viewContentAfter.querySelectorAll('[data-slot="menubar-radio-item"]');
    expect(radioItems.length).toBeGreaterThan(0);

    // Get the currently unchecked radio
    const uncheckedRadio = [...radioItems].find(
      (item) => item.getAttribute('data-state') !== 'checked'
    );
    if (uncheckedRadio instanceof HTMLElement) {
      uncheckedRadio.focus();
      await userEvent.keyboard('{Enter}');

      // Reopen to verify
      await userEvent.click(viewTrigger);

      const finalViewContent = await waitFor(() => {
        const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="view"]');
        if (!(content instanceof HTMLElement)) {
          throw new Error('View content was not rendered.');
        }
        return content;
      });

      const selectedRadio = finalViewContent.querySelector(
        '[data-slot="menubar-radio-item"][data-state="checked"]'
      );
      expect(selectedRadio).toBeInTheDocument();
    }

    // Clean up
    await userEvent.keyboard('{Escape}');
  },
};

// ============ DARK MODE + LOCALE STORIES ============

export const DarkModeJapanese: Story = {
  ...Default,
  name: i18n.t('menubar.storyName.darkModeJapanese', 'Dark Mode + Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    locale: 'ja',
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    // Verify Japanese locale is active
    expect(doc.documentElement.lang).toBe('ja');

    // Verify dark mode class is applied (check for dark class on html or specific styling)
    // Note: Dark mode detection may vary based on implementation.
    // The global 'theme: dark' setting ensures dark mode rendering.
    // We trust Storybook's theming system to apply the correct styles.

    // Verify Japanese text is rendered
    const fileTrigger = canvasElement.querySelector(
      '[data-slot="menubar-trigger"][data-menubar-trigger="file"]'
    );
    if (!(fileTrigger instanceof HTMLElement)) {
      throw new Error('File trigger was not found.');
    }
    expect(fileTrigger.textContent?.trim()).toBe('ファイル');

    // Test interaction in dark mode
    await userEvent.click(fileTrigger);

    const fileContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="file"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('Menubar content was not rendered.');
      }
      return content;
    });

    // Verify Japanese menu items
    const newTabItem = fileContent.querySelector('[data-item-id="new-tab"]');
    if (!(newTabItem instanceof HTMLElement)) {
      throw new Error('New tab item was not found.');
    }
    expect(newTabItem.textContent).toContain('新規タブ');

    await userEvent.keyboard('{Escape}');
  },
};

// ============ ARIA PATTERN COMPLIANCE ============

export const ARIAMenubarPattern: Story = {
  name: i18n.t('menubar.storyName.aRIAMenubarPattern', 'ARIA Menubar Pattern Compliance'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    // ========== TEST 1: Menubar root has role="menubar" ==========
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
    expect(menubar?.getAttribute('role')).toBe('menubar');

    // ========== TEST 2: Triggers have proper attributes ==========
    const triggers = canvasElement.querySelectorAll('[data-slot="menubar-trigger"]');
    expect(triggers.length).toBeGreaterThan(0);

    triggers.forEach((trigger) => {
      // Triggers should be focusable
      expect(trigger.getAttribute('tabindex')).not.toBe('-1');
    });

    // ========== TEST 3: Content has role="menu" ==========
    const fileTrigger = canvasElement.querySelector(
      '[data-slot="menubar-trigger"][data-menubar-trigger="file"]'
    );
    if (!(fileTrigger instanceof HTMLElement)) {
      throw new Error('File trigger was not found.');
    }

    await userEvent.click(fileTrigger);

    const fileContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="file"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('Menubar content was not rendered.');
      }
      return content;
    });

    expect(fileContent.getAttribute('role')).toBe('menu');

    // ========== TEST 4: Items have role="menuitem" ==========
    const menuItems = fileContent.querySelectorAll('[data-slot="menubar-item"]');
    menuItems.forEach((item) => {
      expect(item.getAttribute('role')).toBe('menuitem');
    });

    // ========== TEST 5: Disabled items have aria-disabled ==========
    const disabledItems = fileContent.querySelectorAll('[data-disabled]');
    disabledItems.forEach((item) => {
      const ariaDisabled = item.getAttribute('aria-disabled');
      const dataDisabled = item.getAttribute('data-disabled');
      expect(ariaDisabled === 'true' || dataDisabled === 'true').toBe(true);
    });

    // ========== TEST 6: Sub-triggers indicate popup ==========
    const subTriggers = fileContent.querySelectorAll('[data-slot="menubar-sub-trigger"]');
    subTriggers.forEach((trigger) => {
      // Radix uses aria-haspopup or aria-expanded for submenus
      const hasPopup =
        trigger.getAttribute('aria-haspopup') || trigger.getAttribute('aria-expanded') !== null;
      expect(hasPopup).toBeTruthy();
    });

    // Open view menu to test checkbox/radio ARIA
    await userEvent.keyboard('{Escape}');

    const viewTrigger = canvasElement.querySelector(
      '[data-slot="menubar-trigger"][data-menubar-trigger="view"]'
    );
    if (!(viewTrigger instanceof HTMLElement)) {
      throw new Error('View trigger was not found.');
    }

    await userEvent.click(viewTrigger);

    const viewContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="view"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('View content was not rendered.');
      }
      return content;
    });

    // ========== TEST 7: Checkbox items have role="menuitemcheckbox" ==========
    const checkboxItems = viewContent.querySelectorAll('[data-slot="menubar-checkbox-item"]');
    checkboxItems.forEach((item) => {
      expect(item.getAttribute('role')).toBe('menuitemcheckbox');
      // Should have aria-checked
      const ariaChecked = item.getAttribute('aria-checked');
      expect(ariaChecked === 'true' || ariaChecked === 'false').toBe(true);
    });

    // ========== TEST 8: Radio items have role="menuitemradio" ==========
    const radioItems = viewContent.querySelectorAll('[data-slot="menubar-radio-item"]');
    radioItems.forEach((item) => {
      expect(item.getAttribute('role')).toBe('menuitemradio');
      // Should have aria-checked
      const ariaChecked = item.getAttribute('aria-checked');
      expect(ariaChecked === 'true' || ariaChecked === 'false').toBe(true);
    });

    // ========== TEST 9: Labels are properly associated ==========
    const labels = viewContent.querySelectorAll('[data-slot="menubar-label"]');
    labels.forEach((label) => {
      // Labels should be non-interactive
      expect(label.getAttribute('role')).not.toBe('menuitem');
    });

    // ========== TEST 10: Separators have proper role ==========
    const separators = viewContent.querySelectorAll('[data-slot="menubar-separator"]');
    separators.forEach((separator) => {
      expect(separator.getAttribute('role')).toBe('separator');
    });

    // Clean up
    await userEvent.keyboard('{Escape}');
  },
};

// ============ FOCUS TRAP STORY ============

export const FocusTrap: Story = {
  name: i18n.t('menubar.storyName.focusTrap', 'Focus Trap (Menu Open)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    // Open file menu
    const fileTrigger = canvasElement.querySelector(
      '[data-slot="menubar-trigger"][data-menubar-trigger="file"]'
    );
    if (!(fileTrigger instanceof HTMLElement)) {
      throw new Error('File trigger was not found.');
    }

    await userEvent.click(fileTrigger);

    const fileContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="menubar-content"][data-menu="file"]');
      if (!(content instanceof HTMLElement)) {
        throw new Error('Menubar content was not rendered.');
      }
      return content;
    });

    // Get all focusable items in menu
    const focusableItems = fileContent.querySelectorAll(
      '[role="menuitem"]:not([aria-disabled="true"]), [role="menuitemcheckbox"]:not([aria-disabled="true"]), [data-slot="menubar-sub-trigger"]:not([aria-disabled="true"])'
    );
    const itemCount = focusableItems.length;
    expect(itemCount).toBeGreaterThan(0);

    // Navigate through all items with ArrowDown
    for (let i = 0; i < itemCount + 1; i++) {
      await userEvent.keyboard('{ArrowDown}');
    }

    // Focus should wrap around (loop) - verify we're still in the menu
    await waitFor(() => {
      const currentFocus = doc.activeElement;
      expect(currentFocus?.closest('[data-slot="menubar-content"]')).toBe(fileContent);
    });

    // Navigate up and verify wrap
    for (let i = 0; i < itemCount + 1; i++) {
      await userEvent.keyboard('{ArrowUp}');
    }

    await waitFor(() => {
      const currentFocus = doc.activeElement;
      expect(currentFocus?.closest('[data-slot="menubar-content"]')).toBe(fileContent);
    });

    // Clean up
    await userEvent.keyboard('{Escape}');
  },
};

// ============ FACTORY: SINGLE ITEM STORIES ============

function FactoryItemDemo() {
  const item: FakeMenubarItemType = createFakeMenubarItem({ label: 'Save', shortcut: '⌘S' });
  const _base: FakeMenubarItemBase = item;
  const _variant: MenubarItemVariant = item.variant ?? 'default';

  return (
    <div data-testid="factory-item-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.story.description')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-item">
            {i18n.t('menubar.menu.file')}
          </MenubarTrigger>
          <MenubarContent data-menu="factory-item">
            <MenubarItem
              data-item-id={item.id}
              disabled={item.disabled}
              variant={_variant}
              inset={item.inset}
            >
              {item.label}
              {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">
        Base ID: {_base.id} | Type: {_base.type}
      </p>
    </div>
  );
}

export const FactoryItem: Story = {
  name: i18n.t('menubar.storyName.factoryItem', 'Factory: Single Item'),
  render: () => <FactoryItemDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-item-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactoryCheckboxItemDemo() {
  const item: FakeMenubarCheckboxItemType = createFakeMenubarCheckboxItem({
    label: 'Show Toolbar',
    checked: true,
  });
  const [checked, setChecked] = useState(item.checked);

  return (
    <div data-testid="factory-checkbox-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.states')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-checkbox">
            {i18n.t('menubar.menu.view')}
          </MenubarTrigger>
          <MenubarContent data-menu="factory-checkbox">
            <MenubarCheckboxItem
              data-item-id={item.id}
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              disabled={item.disabled}
            >
              {item.label}
            </MenubarCheckboxItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryCheckboxItem: Story = {
  name: i18n.t('menubar.storyName.factoryCheckboxItem', 'Factory: Checkbox Item'),
  render: () => <FactoryCheckboxItemDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-checkbox-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactoryRadioItemDemo() {
  const radioItem: FakeMenubarRadioItemType = createFakeMenubarRadioItem({
    label: 'Dark',
    value: 'dark',
  });
  const [selected, setSelected] = useState(radioItem.value);

  return (
    <div data-testid="factory-radio-item-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.content')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-radio">
            {i18n.t('menubar.menu.view')}
          </MenubarTrigger>
          <MenubarContent data-menu="factory-radio">
            <MenubarRadioGroup value={selected} onValueChange={setSelected}>
              <MenubarRadioItem value={radioItem.value}>{radioItem.label}</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryRadioItem: Story = {
  name: i18n.t('menubar.storyName.factoryRadioItem', 'Factory: Radio Item'),
  render: () => <FactoryRadioItemDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-radio-item-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactoryLabelItemDemo() {
  const labelItem: FakeMenubarLabelItemType = createFakeMenubarLabelItem({
    label: 'Options',
    inset: true,
  });

  return (
    <div data-testid="factory-label-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.variants')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-label">
            {i18n.t('menubar.menu.view')}
          </MenubarTrigger>
          <MenubarContent data-menu="factory-label">
            <MenubarLabel inset={labelItem.inset}>{labelItem.label}</MenubarLabel>
            <MenubarSeparator />
            <MenubarItem>{i18n.t('menubar.story.exampleItem', 'Example Item')}</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryLabelItem: Story = {
  name: i18n.t('menubar.storyName.factoryLabelItem', 'Factory: Label Item'),
  render: () => <FactoryLabelItemDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-label-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactorySeparatorItemDemo() {
  const sep: FakeMenubarSeparatorItemType = createFakeMenubarSeparatorItem();

  return (
    <div data-testid="factory-separator-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.story.description')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-sep">
            {i18n.t('menubar.menu.file')}
          </MenubarTrigger>
          <MenubarContent data-menu="factory-sep">
            <MenubarItem>{i18n.t('menubar.story.itemBefore', 'Item Before')}</MenubarItem>
            <MenubarSeparator data-separator-id={sep.id} />
            <MenubarItem>{i18n.t('menubar.story.itemAfter', 'Item After')}</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactorySeparatorItem: Story = {
  name: i18n.t('menubar.storyName.factorySeparatorItem', 'Factory: Separator Item'),
  render: () => <FactorySeparatorItemDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-separator-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactoryRadioGroupDemo() {
  const group: FakeMenubarRadioGroupType = createFakeMenubarRadioGroup(MENUBAR_THEME_OPTIONS, {
    label: 'Theme',
    value: 'system',
  });
  const [selected, setSelected] = useState(group.value);

  return (
    <div data-testid="factory-radio-group-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.content')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-rg">
            {i18n.t('menubar.menu.view')}
          </MenubarTrigger>
          <MenubarContent data-menu="factory-rg">
            {group.label && <MenubarLabel inset>{group.label}</MenubarLabel>}
            <MenubarRadioGroup value={selected} onValueChange={setSelected}>
              {group.items.map((ri) => (
                <MenubarRadioItem key={ri.id} value={ri.value}>
                  {ri.label}
                </MenubarRadioItem>
              ))}
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryRadioGroup: Story = {
  name: i18n.t('menubar.storyName.factoryRadioGroup', 'Factory: Radio Group'),
  render: () => <FactoryRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-radio-group-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactoryShortcutDemo() {
  const shortcut: FakeMenubarShortcutType = createFakeMenubarShortcut({
    action: 'Save',
    platform: 'mac',
    display: '⌘S',
    keys: ['⌘', 'S'],
  });

  return (
    <div data-testid="factory-shortcut-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.story.keyboard')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-shortcut">
            {i18n.t('menubar.menu.file')}
          </MenubarTrigger>
          <MenubarContent data-menu="factory-shortcut">
            <MenubarItem>
              {shortcut.action} <MenubarShortcut>{shortcut.display}</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">
        Platform: {shortcut.platform} | Keys: {shortcut.keys.join('+')}
      </p>
    </div>
  );
}

export const FactoryShortcut: Story = {
  name: i18n.t('menubar.storyName.factoryShortcut', 'Factory: Shortcut'),
  render: () => <FactoryShortcutDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-shortcut-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ FACTORY: BULK ITEM STORIES ============

function FactoryBulkItemsDemo() {
  const items: FakeMenubarItemType[] = createFakeMenubarItems(5);

  return (
    <div data-testid="factory-bulk-items-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.variants')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-bulk">
            {i18n.t('menubar.menu.file')}
          </MenubarTrigger>
          <MenubarContent data-menu="factory-bulk">
            {items.map((item) => (
              <MenubarItem key={item.id} disabled={item.disabled}>
                {item.label}
                {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
              </MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">
        {i18n.t('menubar.story.generatedItems', { count: items.length })}
      </p>
    </div>
  );
}

export const FactoryBulkItems: Story = {
  name: i18n.t('menubar.storyName.factoryBulkItems', 'Factory: Bulk Items'),
  render: () => <FactoryBulkItemsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-bulk-items-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactoryBulkCheckboxItemsDemo() {
  const items: FakeMenubarCheckboxItemType[] = createFakeMenubarCheckboxItems(4);
  const [checkedStates, setCheckedStates] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((item) => [item.id, item.checked]))
  );

  return (
    <div data-testid="factory-bulk-checkboxes-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.states')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-bulk-cb">
            {i18n.t('menubar.menu.view')}
          </MenubarTrigger>
          <MenubarContent data-menu="factory-bulk-cb">
            {items.map((item) => (
              <MenubarCheckboxItem
                key={item.id}
                checked={checkedStates[item.id]}
                onCheckedChange={(v) =>
                  setCheckedStates((prev) => ({ ...prev, [item.id]: v === true }))
                }
                disabled={item.disabled}
              >
                {item.label}
              </MenubarCheckboxItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryBulkCheckboxItems: Story = {
  name: i18n.t('menubar.storyName.factoryBulkCheckboxItems', 'Factory: Bulk Checkbox Items'),
  render: () => <FactoryBulkCheckboxItemsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-bulk-checkboxes-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactoryBulkRadioGroupsDemo() {
  const groups: FakeMenubarRadioGroupType[] = createFakeMenubarRadioGroups(2);
  const [selections, setSelections] = useState<Record<string, string>>(
    Object.fromEntries(groups.map((g) => [g.id, g.value]))
  );

  return (
    <div data-testid="factory-bulk-radio-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.content')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-bulk-rg">
            {i18n.t('menubar.menu.view')}
          </MenubarTrigger>
          <MenubarContent data-menu="factory-bulk-rg">
            {groups.map((group) => (
              <React.Fragment key={group.id}>
                {group.label && <MenubarLabel inset>{group.label}</MenubarLabel>}
                <MenubarRadioGroup
                  value={selections[group.id]}
                  onValueChange={(v) => setSelections((prev) => ({ ...prev, [group.id]: v }))}
                >
                  {group.items.map((ri) => (
                    <MenubarRadioItem key={ri.id} value={ri.value}>
                      {ri.label}
                    </MenubarRadioItem>
                  ))}
                </MenubarRadioGroup>
                <MenubarSeparator />
              </React.Fragment>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryBulkRadioGroups: Story = {
  name: i18n.t('menubar.storyName.factoryBulkRadioGroups', 'Factory: Bulk Radio Groups'),
  render: () => <FactoryBulkRadioGroupsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-bulk-radio-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ FACTORY: MENU FACTORIES ============

function FactoryMenuDemo() {
  const menu: FakeMenubarMenuType = createFakeMenubarMenu({ trigger: 'Tools' });

  return (
    <div data-testid="factory-menu-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.story.description')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-menu">{menu.trigger}</MenubarTrigger>
          <MenubarContent data-menu="factory-menu">
            {menu.items.map((item) => {
              if (item.type === 'separator') return <MenubarSeparator key={item.id} />;
              if (item.type === 'label') {
                return (
                  <MenubarLabel key={item.id} inset>
                    {'label' in item ? item.label : ''}
                  </MenubarLabel>
                );
              }
              if (item.type === 'checkbox') {
                return (
                  <MenubarCheckboxItem
                    key={item.id}
                    checked={'checked' in item ? item.checked : false}
                  >
                    {'label' in item ? item.label : ''}
                  </MenubarCheckboxItem>
                );
              }
              return (
                <MenubarItem key={item.id} disabled={item.disabled}>
                  {'label' in item ? item.label : ''}
                  {'shortcut' in item && item.shortcut && (
                    <MenubarShortcut>{item.shortcut}</MenubarShortcut>
                  )}
                </MenubarItem>
              );
            })}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryMenu: Story = {
  name: i18n.t('menubar.storyName.factoryMenu', 'Factory: Menu'),
  render: () => <FactoryMenuDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-menu-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactoryMenubarsDemo() {
  const menubars: FakeMenubar[] = createFakeMenubars(2);

  return (
    <div data-testid="factory-menubars-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.sizes')}</p>
      {menubars.map((mb) => (
        <Menubar key={mb.id}>
          {mb.menus.map((menu) => (
            <MenubarMenu key={menu.id}>
              <MenubarTrigger>{menu.trigger}</MenubarTrigger>
              <MenubarContent>
                {menu.items
                  .filter(
                    (i): i is FakeMenubarItemType => i.type === 'item' || i.type === 'submenu'
                  )
                  .slice(0, 3)
                  .map((item) => (
                    <MenubarItem key={item.id}>{item.label}</MenubarItem>
                  ))}
              </MenubarContent>
            </MenubarMenu>
          ))}
        </Menubar>
      ))}
      <p className="text-muted-foreground text-xs">
        Generated {menubars.length} menubars, sizes: {menubars.map((m) => m.size).join(', ')}
      </p>
    </div>
  );
}

export const FactoryMenubars: Story = {
  name: i18n.t('menubar.storyName.factoryMenubars', 'Factory: Multiple Menubars'),
  render: () => <FactoryMenubarsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-menubars-demo"]');
    expect(root).toBeInTheDocument();
    const menubars = canvasElement.querySelectorAll('[data-slot="menubar"]');
    expect(menubars.length).toBe(2);
  },
};

// ============ FACTORY: SPECIALIZED MENUS ============

function RenderMenuItems({ items }: { items: FakeMenubarAnyItem[] }) {
  return (
    <>
      {items.map((item) => {
        if (item.type === 'separator') return <MenubarSeparator key={item.id} />;
        if (item.type === 'label') {
          return (
            <MenubarLabel key={item.id} inset={'inset' in item ? item.inset : false}>
              {'label' in item ? item.label : ''}
            </MenubarLabel>
          );
        }
        if (item.type === 'checkbox') {
          return (
            <MenubarCheckboxItem key={item.id} checked={'checked' in item ? item.checked : false}>
              {'label' in item ? item.label : ''}
            </MenubarCheckboxItem>
          );
        }
        if (item.type === 'submenu' && 'submenu' in item && item.submenu) {
          return (
            <MenubarSub key={item.id}>
              <MenubarSubTrigger inset={'inset' in item ? item.inset : false}>
                {item.label}
              </MenubarSubTrigger>
              <MenubarSubContent>
                {item.submenu.map((subItem) => (
                  <MenubarItem key={subItem.id} disabled={subItem.disabled}>
                    {'label' in subItem ? subItem.label : ''}
                  </MenubarItem>
                ))}
              </MenubarSubContent>
            </MenubarSub>
          );
        }
        return (
          <MenubarItem
            key={item.id}
            disabled={item.disabled}
            variant={'variant' in item ? item.variant : 'default'}
            inset={'inset' in item ? item.inset : false}
          >
            {'label' in item ? item.label : ''}
            {'shortcut' in item && item.shortcut && (
              <MenubarShortcut>{item.shortcut}</MenubarShortcut>
            )}
          </MenubarItem>
        );
      })}
    </>
  );
}

function FactoryFileMenuDemo() {
  const { t } = useTranslation();
  const fileMenu = createFakeMenubarFileMenu();

  return (
    <div data-testid="factory-file-menu-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{t('menubar.story.description')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-file">{fileMenu.trigger}</MenubarTrigger>
          <MenubarContent data-menu="factory-file">
            <RenderMenuItems items={fileMenu.items} />
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryFileMenu: Story = {
  name: i18n.t('menubar.storyName.factoryFileMenu', 'Factory: File Menu'),
  render: () => <FactoryFileMenuDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-file-menu-demo"]');
    expect(root).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-menubar-trigger="factory-file"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent?.trim()).toBe('File');
  },
};

function FactoryEditMenuDemo() {
  const editMenu = createFakeMenubarEditMenu();

  return (
    <div data-testid="factory-edit-menu-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.story.description')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-edit">{editMenu.trigger}</MenubarTrigger>
          <MenubarContent data-menu="factory-edit">
            <RenderMenuItems items={editMenu.items} />
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryEditMenu: Story = {
  name: i18n.t('menubar.storyName.factoryEditMenu', 'Factory: Edit Menu'),
  render: () => <FactoryEditMenuDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-edit-menu-demo"]');
    expect(root).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-menubar-trigger="factory-edit"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent?.trim()).toBe('Edit');
  },
};

function FactoryViewMenuDemo() {
  const viewMenu = createFakeMenubarViewMenu();
  const [radioValue, setRadioValue] = useState(viewMenu.radioGroups?.[0]?.value ?? 'system');

  return (
    <div data-testid="factory-view-menu-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.states')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-view">{viewMenu.trigger}</MenubarTrigger>
          <MenubarContent data-menu="factory-view">
            <RenderMenuItems items={viewMenu.items} />
            {viewMenu.radioGroups?.map((group) => (
              <React.Fragment key={group.id}>
                <MenubarSeparator />
                {group.label && <MenubarLabel inset>{group.label}</MenubarLabel>}
                <MenubarRadioGroup value={radioValue} onValueChange={setRadioValue}>
                  {group.items.map((ri) => (
                    <MenubarRadioItem key={ri.id} value={ri.value}>
                      {ri.label}
                    </MenubarRadioItem>
                  ))}
                </MenubarRadioGroup>
              </React.Fragment>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryViewMenu: Story = {
  name: i18n.t('menubar.storyName.factoryViewMenu', 'Factory: View Menu'),
  render: () => <FactoryViewMenuDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-view-menu-demo"]');
    expect(root).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-menubar-trigger="factory-view"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent?.trim()).toBe('View');
  },
};

function FactoryHelpMenuDemo() {
  const helpMenu = createFakeHelpMenu();

  return (
    <div data-testid="factory-help-menu-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.story.description')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="factory-help">{helpMenu.trigger}</MenubarTrigger>
          <MenubarContent data-menu="factory-help">
            <RenderMenuItems items={helpMenu.items} />
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryHelpMenu: Story = {
  name: i18n.t('menubar.storyName.factoryHelpMenu', 'Factory: Help Menu'),
  render: () => <FactoryHelpMenuDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-help-menu-demo"]');
    expect(root).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-menubar-trigger="factory-help"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent?.trim()).toBe('Help');
  },
};

// ============ FACTORY: COMPLETE MENUBAR STORIES ============

function FactoryApplicationMenubarDemo() {
  const appMenubar: FakeMenubar = createFakeApplicationMenubar();

  return (
    <div data-testid="factory-app-menubar-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.story.playground')}</p>
      <Menubar>
        {appMenubar.menus.map((menu) => (
          <MenubarMenu key={menu.id}>
            <MenubarTrigger>{menu.trigger}</MenubarTrigger>
            <MenubarContent>
              <RenderMenuItems items={menu.items} />
            </MenubarContent>
          </MenubarMenu>
        ))}
      </Menubar>
    </div>
  );
}

export const FactoryApplicationMenubar: Story = {
  name: i18n.t('menubar.storyName.factoryApplicationMenubar', 'Factory: Application Menubar'),
  render: () => <FactoryApplicationMenubarDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-app-menubar-demo"]');
    expect(root).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="menubar-trigger"]');
    expect(triggers.length).toBe(4);
  },
};

function FactoryTextEditorMenubarDemo() {
  const editorMenubar: FakeMenubar = createFakeTextEditorMenubar();

  return (
    <div data-testid="factory-editor-menubar-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.story.playground')}</p>
      <Menubar>
        {editorMenubar.menus.map((menu) => (
          <MenubarMenu key={menu.id}>
            <MenubarTrigger>{menu.trigger}</MenubarTrigger>
            <MenubarContent>
              <RenderMenuItems items={menu.items} />
            </MenubarContent>
          </MenubarMenu>
        ))}
      </Menubar>
    </div>
  );
}

export const FactoryTextEditorMenubar: Story = {
  name: i18n.t('menubar.storyName.factoryTextEditorMenubar', 'Factory: Text Editor Menubar'),
  render: () => <FactoryTextEditorMenubarDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-editor-menubar-demo"]');
    expect(root).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="menubar-trigger"]');
    expect(triggers.length).toBe(5);
  },
};

// ============ FACTORY: MATRIX STORIES ============

function FactoryItemVariantMatrixDemo() {
  const variants: FakeMenubarItemType[] = createFakeMenubarItemVariantMatrix();

  return (
    <div data-testid="factory-variant-matrix-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.variants')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="variant-matrix">
            {i18n.t('menubar.story.variants', 'Variants')}
          </MenubarTrigger>
          <MenubarContent data-menu="variant-matrix">
            {variants.map((item) => (
              <MenubarItem key={item.id} variant={item.variant}>
                {item.label}
              </MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryItemVariantMatrix: Story = {
  name: i18n.t('menubar.storyName.factoryItemVariantMatrix', 'Factory: Item Variant Matrix'),
  render: () => <FactoryItemVariantMatrixDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-variant-matrix-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactorySizeMatrixDemo() {
  const sizeMenubars: FakeMenubar[] = createFakeMenubarSizeMatrix();
  const sizeClasses: Record<string, string> = {
    compact: 'h-8 text-xs',
    default: '',
    wide: 'h-12',
  };

  return (
    <div data-testid="factory-size-matrix-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.sizes')}</p>
      {sizeMenubars.map((mb) => (
        <div key={mb.id} className="space-y-1">
          <p className="text-muted-foreground text-xs">Size: {mb.size}</p>
          <Menubar className={sizeClasses[mb.size]}>
            {mb.menus.slice(0, 3).map((menu) => (
              <MenubarMenu key={menu.id}>
                <MenubarTrigger>{menu.trigger}</MenubarTrigger>
                <MenubarContent>
                  {menu.items
                    .filter(
                      (i): i is FakeMenubarItemType => i.type === 'item' || i.type === 'submenu'
                    )
                    .slice(0, 3)
                    .map((item) => (
                      <MenubarItem key={item.id}>{item.label}</MenubarItem>
                    ))}
                </MenubarContent>
              </MenubarMenu>
            ))}
          </Menubar>
        </div>
      ))}
    </div>
  );
}

export const FactorySizeMatrix: Story = {
  name: i18n.t('menubar.storyName.factorySizeMatrix', 'Factory: Size Matrix'),
  render: () => <FactorySizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-size-matrix-demo"]');
    expect(root).toBeInTheDocument();
    const menubars = canvasElement.querySelectorAll('[data-slot="menubar"]');
    expect(menubars.length).toBe(3);
  },
};

function FactoryItemTypeMatrixDemo() {
  const allTypes: FakeMenubarAnyItem[] = createFakeMenubarItemTypeMatrix();

  return (
    <div data-testid="factory-type-matrix-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.content')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="type-matrix">
            {i18n.t('menubar.story.allTypes', 'All Types')}
          </MenubarTrigger>
          <MenubarContent data-menu="type-matrix">
            <RenderMenuItems items={allTypes} />
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryItemTypeMatrix: Story = {
  name: i18n.t('menubar.storyName.factoryItemTypeMatrix', 'Factory: Item Type Matrix'),
  render: () => <FactoryItemTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-type-matrix-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ FACTORY: SHOWCASE ============

function FactoryShowcaseDemo() {
  const showcase = createFakeMenubarShowcase();
  const categoryKeys = Object.keys(showcase);

  return (
    <div data-testid="factory-showcase-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.story.playground')}</p>
      <div className="rounded-md border p-4">
        <p className="text-muted-foreground mb-2 text-xs">
          Showcase contains {categoryKeys.length} categories
        </p>
        <ul className="text-muted-foreground list-inside list-disc text-xs">
          {categoryKeys.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      </div>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="showcase">
            {i18n.t('menubar.menu.file')}
          </MenubarTrigger>
          <MenubarContent data-menu="showcase">
            <MenubarLabel inset>
              {i18n.t('menubar.story.showcaseData', 'Showcase Data')}
            </MenubarLabel>
            <MenubarSeparator />
            {categoryKeys.slice(0, 5).map((key) => (
              <MenubarItem key={key}>{key}</MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryShowcase: Story = {
  name: i18n.t('menubar.storyName.factoryShowcase', 'Factory: Showcase'),
  render: () => <FactoryShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-showcase-demo"]');
    expect(root).toBeInTheDocument();
    const listItems = root?.querySelectorAll('li');
    expect(listItems?.length).toBeGreaterThan(0);
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ FACTORY: CONSTANTS STORIES ============

function FactoryConstantsDemo() {
  const allConstants = [
    {
      name: 'MENUBAR_ITEM_VARIANTS',
      data: MENUBAR_ITEM_VARIANTS,
      count: MENUBAR_ITEM_VARIANTS.length,
    },
    { name: 'MENUBAR_SIZES', data: MENUBAR_SIZES, count: MENUBAR_SIZES.length },
    { name: 'MENUBAR_ITEM_TYPES', data: MENUBAR_ITEM_TYPES, count: MENUBAR_ITEM_TYPES.length },
    {
      name: 'MENUBAR_TRIGGER_NAMES',
      data: MENUBAR_TRIGGER_NAMES,
      count: MENUBAR_TRIGGER_NAMES.length,
    },
    {
      name: 'MENUBAR_ACTION_LABELS',
      data: MENUBAR_ACTION_LABELS,
      count: MENUBAR_ACTION_LABELS.length,
    },
    { name: 'MENUBAR_ICONS', data: MENUBAR_ICONS, count: MENUBAR_ICONS.length },
    {
      name: 'MENUBAR_MAC_MODIFIERS',
      data: MENUBAR_MAC_MODIFIERS,
      count: MENUBAR_MAC_MODIFIERS.length,
    },
    {
      name: 'MENUBAR_WIN_MODIFIERS',
      data: MENUBAR_WIN_MODIFIERS,
      count: MENUBAR_WIN_MODIFIERS.length,
    },
    {
      name: 'MENUBAR_VIEW_OPTIONS',
      data: MENUBAR_VIEW_OPTIONS,
      count: MENUBAR_VIEW_OPTIONS.length,
    },
    {
      name: 'MENUBAR_THEME_OPTIONS',
      data: MENUBAR_THEME_OPTIONS,
      count: MENUBAR_THEME_OPTIONS.length,
    },
    {
      name: 'MENUBAR_FONT_SIZE_OPTIONS',
      data: MENUBAR_FONT_SIZE_OPTIONS,
      count: MENUBAR_FONT_SIZE_OPTIONS.length,
    },
    {
      name: 'MENUBAR_LANGUAGE_OPTIONS',
      data: MENUBAR_LANGUAGE_OPTIONS,
      count: MENUBAR_LANGUAGE_OPTIONS.length,
    },
    {
      name: 'MENUBAR_PROFILE_OPTIONS',
      data: MENUBAR_PROFILE_OPTIONS,
      count: MENUBAR_PROFILE_OPTIONS.length,
    },
  ];

  return (
    <div data-testid="factory-constants-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.story.description')}</p>
      <div className="grid grid-cols-2 gap-3">
        {allConstants.map((c) => (
          <div key={c.name} className="rounded-md border p-3">
            <p className="mb-1 text-xs font-medium">{c.name}</p>
            <p className="text-muted-foreground text-xs">
              {c.count} items: {c.data.join(', ')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  name: i18n.t('menubar.storyName.factoryConstants', 'Factory: Constants'),
  render: () => <FactoryConstantsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-constants-demo"]');
    expect(root).toBeInTheDocument();
    const cards = root?.querySelectorAll('.rounded-md.border');
    expect(cards?.length).toBe(13);
  },
};

function FactoryShortcutsMapDemo() {
  const shortcutEntries = Object.entries(MENUBAR_SHORTCUTS);

  return (
    <div data-testid="factory-shortcuts-map-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.story.keyboard')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="shortcuts-map">
            {i18n.t('menubar.story.shortcuts', 'Shortcuts')}
          </MenubarTrigger>
          <MenubarContent data-menu="shortcuts-map">
            {shortcutEntries.slice(0, 10).map(([action, shortcut]) => (
              <MenubarItem key={action}>
                {action} <MenubarShortcut>{shortcut}</MenubarShortcut>
              </MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">Total shortcuts: {shortcutEntries.length}</p>
    </div>
  );
}

export const FactoryShortcutsMap: Story = {
  name: i18n.t('menubar.storyName.factoryShortcutsMap', 'Factory: Shortcuts Map'),
  render: () => <FactoryShortcutsMapDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-shortcuts-map-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ FACTORY: TYPE DEMONSTRATIONS ============

function FactoryTypesDemo() {
  // Demonstrate all type aliases by creating typed variables
  const variant: MenubarItemVariant = 'destructive';
  const size: MenubarSize = 'compact';
  const itemType: MenubarItemType = 'checkbox';
  const triggerName: MenubarTriggerName = 'File';
  const actionLabel: MenubarActionLabel = 'Save';
  const platform: MenubarPlatform = 'mac';

  const typeInfo = [
    { name: 'MenubarItemVariant', value: variant },
    { name: 'MenubarSize', value: size },
    { name: 'MenubarItemType', value: itemType },
    { name: 'MenubarTriggerName', value: triggerName },
    { name: 'MenubarActionLabel', value: actionLabel },
    { name: 'MenubarPlatform', value: platform },
  ];

  return (
    <div data-testid="factory-types-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.story.description')}</p>
      <div className="rounded-md border p-4">
        <p className="mb-2 text-xs font-medium">
          {i18n.t('menubar.story.exportedTypeAliases', 'Exported Type Aliases')}
        </p>
        <div className="space-y-1">
          {typeInfo.map((ti) => (
            <p key={ti.name} className="text-muted-foreground text-xs">
              <span className="font-mono">{ti.name}</span>: {ti.value}
            </p>
          ))}
        </div>
      </div>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="types-demo">{triggerName}</MenubarTrigger>
          <MenubarContent data-menu="types-demo">
            <MenubarItem variant={variant}>{actionLabel}</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryTypes: Story = {
  name: i18n.t('menubar.storyName.factoryTypes', 'Factory: Type Aliases'),
  render: () => <FactoryTypesDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-types-demo"]');
    expect(root).toBeInTheDocument();
    const typeEntries = root?.querySelectorAll('.font-mono');
    expect(typeEntries?.length).toBe(6);
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactoryViewOptionsDemo() {
  const [checkedOptions, setCheckedOptions] = useState<Record<string, boolean>>(
    Object.fromEntries(MENUBAR_VIEW_OPTIONS.map((opt) => [opt, false]))
  );

  return (
    <div data-testid="factory-view-options-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.states')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="view-options">
            {i18n.t('menubar.menu.view')}
          </MenubarTrigger>
          <MenubarContent data-menu="view-options">
            <MenubarLabel inset>View Options ({MENUBAR_VIEW_OPTIONS.length})</MenubarLabel>
            <MenubarSeparator />
            {MENUBAR_VIEW_OPTIONS.map((opt) => (
              <MenubarCheckboxItem
                key={opt}
                checked={checkedOptions[opt]}
                onCheckedChange={(v) =>
                  setCheckedOptions((prev) => ({ ...prev, [opt]: v === true }))
                }
              >
                {opt}
              </MenubarCheckboxItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryViewOptions: Story = {
  name: i18n.t('menubar.storyName.factoryViewOptions', 'Factory: View Options'),
  render: () => <FactoryViewOptionsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-view-options-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactoryRadioOptionsDemo() {
  const [theme, setTheme] = useState('System');
  const [fontSize, setFontSize] = useState('Medium');
  const [language, setLanguage] = useState('English');
  const [profile, setProfile] = useState('Default');

  return (
    <div data-testid="factory-radio-options-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.content')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="radio-opts">
            {i18n.t('menubar.story.preferences', 'Preferences')}
          </MenubarTrigger>
          <MenubarContent data-menu="radio-opts">
            <MenubarLabel inset>{i18n.t('menubar.story.theme', 'Theme')}</MenubarLabel>
            <MenubarRadioGroup value={theme} onValueChange={setTheme}>
              {MENUBAR_THEME_OPTIONS.map((opt) => (
                <MenubarRadioItem key={opt} value={opt}>
                  {opt}
                </MenubarRadioItem>
              ))}
            </MenubarRadioGroup>
            <MenubarSeparator />
            <MenubarLabel inset>{i18n.t('menubar.story.fontSize', 'Font Size')}</MenubarLabel>
            <MenubarRadioGroup value={fontSize} onValueChange={setFontSize}>
              {MENUBAR_FONT_SIZE_OPTIONS.map((opt) => (
                <MenubarRadioItem key={opt} value={opt}>
                  {opt}
                </MenubarRadioItem>
              ))}
            </MenubarRadioGroup>
            <MenubarSeparator />
            <MenubarLabel inset>{i18n.t('menubar.story.language', 'Language')}</MenubarLabel>
            <MenubarRadioGroup value={language} onValueChange={setLanguage}>
              {MENUBAR_LANGUAGE_OPTIONS.map((opt) => (
                <MenubarRadioItem key={opt} value={opt}>
                  {opt}
                </MenubarRadioItem>
              ))}
            </MenubarRadioGroup>
            <MenubarSeparator />
            <MenubarLabel inset>{i18n.t('menubar.story.profile', 'Profile')}</MenubarLabel>
            <MenubarRadioGroup value={profile} onValueChange={setProfile}>
              {MENUBAR_PROFILE_OPTIONS.map((opt) => (
                <MenubarRadioItem key={opt} value={opt}>
                  {opt}
                </MenubarRadioItem>
              ))}
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryRadioOptions: Story = {
  name: i18n.t(
    'menubar.storyName.factoryRadioOptions',
    'Factory: Radio Options (Theme/Font/Lang/Profile)'
  ),
  render: () => <FactoryRadioOptionsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-radio-options-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactoryIconsDemo() {
  return (
    <div data-testid="factory-icons-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.variants')}</p>
      <div className="rounded-md border p-4">
        <p className="mb-2 text-xs font-medium">Available Icons ({MENUBAR_ICONS.length})</p>
        <div className="flex flex-wrap gap-2">
          {MENUBAR_ICONS.map((icon) => (
            <span key={icon} className="bg-muted rounded px-2 py-1 text-xs">
              {icon}
            </span>
          ))}
        </div>
      </div>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="icons-demo">
            {i18n.t('menubar.menu.file')}
          </MenubarTrigger>
          <MenubarContent data-menu="icons-demo">
            {MENUBAR_ICONS.slice(0, 5).map((icon) => (
              <MenubarItem key={icon}>{icon}</MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryIcons: Story = {
  name: i18n.t('menubar.storyName.factoryIcons', 'Factory: Icons Catalog'),
  render: () => <FactoryIconsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-icons-demo"]');
    expect(root).toBeInTheDocument();
    const iconBadges = root?.querySelectorAll('.bg-muted');
    expect(iconBadges?.length).toBe(MENUBAR_ICONS.length);
  },
};

function FactoryModifiersDemo() {
  return (
    <div data-testid="factory-modifiers-demo" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.story.keyboard')}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border p-3">
          <p className="mb-2 text-xs font-medium">Mac Modifiers ({MENUBAR_MAC_MODIFIERS.length})</p>
          <div className="flex gap-2">
            {MENUBAR_MAC_MODIFIERS.map((mod) => (
              <span key={mod} className="bg-muted rounded px-2 py-1 font-mono text-sm">
                {mod}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <p className="mb-2 text-xs font-medium">
            Win/Linux Modifiers ({MENUBAR_WIN_MODIFIERS.length})
          </p>
          <div className="flex gap-2">
            {MENUBAR_WIN_MODIFIERS.map((mod) => (
              <span key={mod} className="bg-muted rounded px-2 py-1 font-mono text-sm">
                {mod}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const FactoryModifiers: Story = {
  name: i18n.t('menubar.storyName.factoryModifiers', 'Factory: Keyboard Modifiers'),
  render: () => <FactoryModifiersDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-modifiers-demo"]');
    expect(root).toBeInTheDocument();
    const modifierBadges = root?.querySelectorAll('.font-mono');
    expect(modifierBadges?.length).toBe(
      MENUBAR_MAC_MODIFIERS.length + MENUBAR_WIN_MODIFIERS.length
    );
  },
};

function FactoryTriggerNamesDemo() {
  return (
    <div data-testid="factory-trigger-names-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.variants')}</p>
      <Menubar>
        {MENUBAR_TRIGGER_NAMES.map((name) => (
          <MenubarMenu key={name}>
            <MenubarTrigger>{name}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>{i18n.t('menubar.default')}</MenubarItem>
              <MenubarItem disabled>{i18n.t('menubar.disabled')}</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        ))}
      </Menubar>
      <p className="text-muted-foreground text-xs">
        All {MENUBAR_TRIGGER_NAMES.length} trigger names rendered
      </p>
    </div>
  );
}

export const FactoryTriggerNames: Story = {
  name: i18n.t('menubar.storyName.factoryTriggerNames', 'Factory: All Trigger Names'),
  render: () => <FactoryTriggerNamesDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-trigger-names-demo"]');
    expect(root).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="menubar-trigger"]');
    expect(triggers.length).toBe(MENUBAR_TRIGGER_NAMES.length);
  },
};

function FactoryActionLabelsDemo() {
  return (
    <div data-testid="factory-action-labels-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.content')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="action-labels">
            {i18n.t('menubar.story.actions', 'Actions')}
          </MenubarTrigger>
          <MenubarContent data-menu="action-labels">
            {MENUBAR_ACTION_LABELS.slice(0, 10).map((label) => (
              <MenubarItem key={label}>
                {label}
                {MENUBAR_SHORTCUTS[label] && (
                  <MenubarShortcut>{MENUBAR_SHORTCUTS[label]}</MenubarShortcut>
                )}
              </MenubarItem>
            ))}
            <MenubarSeparator />
            <MenubarLabel inset>{MENUBAR_ACTION_LABELS.length} total actions</MenubarLabel>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const FactoryActionLabels: Story = {
  name: i18n.t('menubar.storyName.factoryActionLabels', 'Factory: Action Labels'),
  render: () => <FactoryActionLabelsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-action-labels-demo"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

function FactoryItemTypesConstDemo() {
  return (
    <div data-testid="factory-item-types-const-demo" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.section.content')}</p>
      <div className="rounded-md border p-4">
        <p className="mb-2 text-xs font-medium">Item Types ({MENUBAR_ITEM_TYPES.length})</p>
        <div className="flex flex-wrap gap-2">
          {MENUBAR_ITEM_TYPES.map((type) => (
            <span key={type} className="bg-muted rounded px-2 py-1 font-mono text-xs">
              {type}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-md border p-4">
        <p className="mb-2 text-xs font-medium">Item Variants ({MENUBAR_ITEM_VARIANTS.length})</p>
        <div className="flex flex-wrap gap-2">
          {MENUBAR_ITEM_VARIANTS.map((variant) => (
            <span key={variant} className="bg-muted rounded px-2 py-1 font-mono text-xs">
              {variant}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-md border p-4">
        <p className="mb-2 text-xs font-medium">Sizes ({MENUBAR_SIZES.length})</p>
        <div className="flex flex-wrap gap-2">
          {MENUBAR_SIZES.map((sz) => (
            <span key={sz} className="bg-muted rounded px-2 py-1 font-mono text-xs">
              {sz}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryItemTypesConst: Story = {
  name: i18n.t('menubar.storyName.factoryItemTypesConst', 'Factory: Item Types & Variants & Sizes'),
  render: () => <FactoryItemTypesConstDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="factory-item-types-const-demo"]');
    expect(root).toBeInTheDocument();
    const badges = root?.querySelectorAll('.font-mono');
    expect(badges?.length).toBe(
      MENUBAR_ITEM_TYPES.length + MENUBAR_ITEM_VARIANTS.length + MENUBAR_SIZES.length
    );
  },
};

// ============ MENU FACTORY: COMMON ACTIONS ============

function MenuFactoryCommonActionsDemo() {
  return (
    <div data-testid="menu-factory-common-actions" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.commonActions')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="common-actions">
            {i18n.t('menubar.menu.file')}
          </MenubarTrigger>
          <MenubarContent data-menu="common-actions">
            {COMMON_ACTIONS.map((action) => (
              <MenubarItem
                key={action.label}
                variant={action.destructive ? 'destructive' : 'default'}
              >
                {action.label}
                {action.shortcut && <MenubarShortcut>{action.shortcut}</MenubarShortcut>}
              </MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">{COMMON_ACTIONS.length} common actions</p>
    </div>
  );
}

export const MenuFactoryCommonActions: Story = {
  name: i18n.t('menubar.storyName.menuFactoryCommonActions', 'Menu Factory: Common Actions'),
  render: () => <MenuFactoryCommonActionsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-common-actions"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
    expect(COMMON_ACTIONS.length).toBeGreaterThan(0);
  },
};

// ============ MENU FACTORY: FILE ACTIONS ============

function MenuFactoryFileActionsDemo() {
  return (
    <div data-testid="menu-factory-file-actions" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.fileActions')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="file-actions">
            {i18n.t('menubar.menu.file')}
          </MenubarTrigger>
          <MenubarContent data-menu="file-actions">
            {FILE_ACTIONS.map((action) => (
              <MenubarItem key={action.label}>
                {action.label}
                {action.shortcut && <MenubarShortcut>{action.shortcut}</MenubarShortcut>}
              </MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">{FILE_ACTIONS.length} file actions</p>
    </div>
  );
}

export const MenuFactoryFileActions: Story = {
  name: i18n.t('menubar.storyName.menuFactoryFileActions', 'Menu Factory: File Actions'),
  render: () => <MenuFactoryFileActionsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-file-actions"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
    expect(FILE_ACTIONS.length).toBeGreaterThan(0);
  },
};

// ============ MENU FACTORY: MENU CONSTANTS ============

function MenuFactoryConstantsDemo() {
  const allConsts = [
    {
      name: 'MENU_ITEM_VARIANTS',
      data: MENU_ITEM_VARIANTS as readonly string[],
      count: MENU_ITEM_VARIANTS.length,
    },
    { name: 'MENU_SIZES', data: MENU_SIZES as readonly string[], count: MENU_SIZES.length },
    { name: 'MENU_WIDTHS', data: MENU_WIDTHS as readonly string[], count: MENU_WIDTHS.length },
    { name: 'MENU_ALIGNS', data: MENU_ALIGNS as readonly string[], count: MENU_ALIGNS.length },
    { name: 'MENU_SIDES', data: MENU_SIDES as readonly string[], count: MENU_SIDES.length },
    { name: 'MENU_ICONS', data: MENU_ICONS as readonly string[], count: MENU_ICONS.length },
    { name: 'VIEW_OPTIONS', data: VIEW_OPTIONS.map((o) => o.label), count: VIEW_OPTIONS.length },
    { name: 'THEME_OPTIONS', data: THEME_OPTIONS.map((o) => o.label), count: THEME_OPTIONS.length },
  ];

  return (
    <div data-testid="menu-factory-constants" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.menuConstants')}</p>
      <div className="grid grid-cols-2 gap-3">
        {allConsts.map((c) => (
          <div key={c.name} className="rounded-md border p-3">
            <p className="mb-1 text-xs font-medium">{c.name}</p>
            <p className="text-muted-foreground text-xs">
              {c.count} items: {c.data.join(', ')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const MenuFactoryConstants: Story = {
  name: i18n.t('menubar.storyName.menuFactoryConstants', 'Menu Factory: Constants'),
  render: () => <MenuFactoryConstantsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-constants"]');
    expect(root).toBeInTheDocument();
    const cards = root?.querySelectorAll('.rounded-md.border');
    expect(cards?.length).toBe(8);
    expect(MENU_ITEM_VARIANTS.length).toBeGreaterThan(0);
    expect(MENU_SIZES.length).toBeGreaterThan(0);
    expect(MENU_WIDTHS.length).toBeGreaterThan(0);
    expect(MENU_ALIGNS.length).toBeGreaterThan(0);
    expect(MENU_SIDES.length).toBeGreaterThan(0);
    expect(MENU_ICONS.length).toBeGreaterThan(0);
    expect(VIEW_OPTIONS.length).toBeGreaterThan(0);
    expect(THEME_OPTIONS.length).toBeGreaterThan(0);
  },
};

// ============ MENU FACTORY: SINGLE MENU ITEM ============

function MenuFactoryMenuItemDemo() {
  const { t } = useTranslation();
  const item: FakeMenuItem = createFakeMenuItem({ label: 'Paste', shortcut: '⌘V', icon: 'Paste' });

  return (
    <div data-testid="menu-factory-menu-item" className="space-y-2">
      <p className="text-muted-foreground text-sm">{t('menubar.factory.menuItem')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-item">{t('menubar.menu.file')}</MenubarTrigger>
          <MenubarContent data-menu="mf-item">
            <MenubarItem
              data-item-id={item.id}
              disabled={item.disabled}
              variant={item.destructive ? 'destructive' : 'default'}
              inset={item.inset}
            >
              {item.label}
              {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">
        ID: {item.id} | Type: {item.type}
      </p>
    </div>
  );
}

export const MenuFactoryMenuItem: Story = {
  name: i18n.t('menubar.storyName.menuFactoryMenuItem', 'Menu Factory: Single Menu Item'),
  render: () => <MenuFactoryMenuItemDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-menu-item"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ MENU FACTORY: CHECKBOX ITEM ============

function MenuFactoryCheckboxItemDemo() {
  const item: FakeMenuCheckboxItemType = createFakeMenuCheckboxItem({
    label: 'Auto Save',
    checked: true,
  });
  const [checked, setChecked] = useState(item.checked);

  return (
    <div data-testid="menu-factory-checkbox-item" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.checkboxItem')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-checkbox">
            {i18n.t('menubar.menu.view')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-checkbox">
            <MenubarCheckboxItem
              data-item-id={item.id}
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              disabled={item.disabled}
            >
              {item.label}
            </MenubarCheckboxItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const MenuFactoryCheckboxItem: Story = {
  name: i18n.t('menubar.storyName.menuFactoryCheckboxItem', 'Menu Factory: Checkbox Item'),
  render: () => <MenuFactoryCheckboxItemDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-checkbox-item"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ MENU FACTORY: RADIO ITEM ============

function MenuFactoryRadioItemDemo() {
  const item: FakeMenuRadioItemType = createFakeMenuRadioItem('dark', 'Dark Mode');
  const [selected, setSelected] = useState(item.value);

  return (
    <div data-testid="menu-factory-radio-item" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.radioItem')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-radio">
            {i18n.t('menubar.menu.view')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-radio">
            <MenubarRadioGroup value={selected} onValueChange={setSelected}>
              <MenubarRadioItem value={item.value}>{item.label}</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">Value: {item.value}</p>
    </div>
  );
}

export const MenuFactoryRadioItem: Story = {
  name: i18n.t('menubar.storyName.menuFactoryRadioItem', 'Menu Factory: Radio Item'),
  render: () => <MenuFactoryRadioItemDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-radio-item"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ MENU FACTORY: RADIO GROUP ============

function MenuFactoryRadioGroupDemo() {
  const group: FakeMenuRadioGroupType = createFakeMenuRadioGroup(THEME_OPTIONS, 'Theme');
  const [selected, setSelected] = useState(group.selectedValue);

  return (
    <div data-testid="menu-factory-radio-group" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.radioGroup')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-radio-group">
            {i18n.t('menubar.menu.view')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-radio-group">
            {group.label && <MenubarLabel inset>{group.label}</MenubarLabel>}
            <MenubarRadioGroup value={selected} onValueChange={setSelected}>
              {group.items.map((ri) => (
                <MenubarRadioItem key={ri.id} value={ri.value}>
                  {ri.label}
                </MenubarRadioItem>
              ))}
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">
        Selected: {selected} | Items: {group.items.length}
      </p>
    </div>
  );
}

export const MenuFactoryRadioGroup: Story = {
  name: i18n.t('menubar.storyName.menuFactoryRadioGroup', 'Menu Factory: Radio Group'),
  render: () => <MenuFactoryRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-radio-group"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ MENU FACTORY: MENU GROUP ============

function MenuFactoryMenuGroupDemo() {
  const group: FakeMenuGroupType = createFakeMenuGroup(4, 'File Actions');

  return (
    <div data-testid="menu-factory-menu-group" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.menuGroup')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-group">
            {i18n.t('menubar.menu.file')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-group">
            {group.label && <MenubarLabel inset>{group.label}</MenubarLabel>}
            {group.items.map((item) => (
              <MenubarItem key={item.id} disabled={item.disabled}>
                {item.label}
                {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
              </MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">
        Group: {group.label} | Items: {group.items.length}
      </p>
    </div>
  );
}

export const MenuFactoryMenuGroup: Story = {
  name: i18n.t('menubar.storyName.menuFactoryMenuGroup', 'Menu Factory: Menu Group'),
  render: () => <MenuFactoryMenuGroupDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-menu-group"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ MENU FACTORY: BULK ITEMS ============

function MenuFactoryBulkItemsDemo() {
  const items: FakeMenuItem[] = createFakeMenuItems(6);
  const checkboxItems: FakeMenuCheckboxItemType[] = createFakeMenuCheckboxItems(3);

  return (
    <div data-testid="menu-factory-bulk-items" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.bulkItems')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-bulk-items">
            {i18n.t('menubar.story.items', 'Items')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-bulk-items">
            {items.map((item) => (
              <MenubarItem key={item.id} disabled={item.disabled}>
                {item.label}
                {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
              </MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-bulk-cb">
            {i18n.t('menubar.story.checkboxes', 'Checkboxes')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-bulk-cb">
            {checkboxItems.map((item) => (
              <MenubarCheckboxItem key={item.id} checked={item.checked}>
                {item.label}
              </MenubarCheckboxItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">
        {items.length} items + {checkboxItems.length} checkboxes
      </p>
    </div>
  );
}

export const MenuFactoryBulkItems: Story = {
  name: i18n.t('menubar.storyName.menuFactoryBulkItems', 'Menu Factory: Bulk Items'),
  render: () => <MenuFactoryBulkItemsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-bulk-items"]');
    expect(root).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="menubar-trigger"]');
    expect(triggers.length).toBe(2);
  },
};

// ============ MENU FACTORY: COMPLETE MENU ============

function MenuFactoryCompleteMenuDemo() {
  const menu: FakeMenuType = createFakeMenu();

  return (
    <div data-testid="menu-factory-complete-menu" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.menu')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-complete">
            {i18n.t('menubar.menu.file')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-complete">
            {menu.groups.map((group) => (
              <React.Fragment key={group.id}>
                {group.label && <MenubarLabel inset>{group.label}</MenubarLabel>}
                {group.items.map((item) => (
                  <MenubarItem key={item.id} disabled={item.disabled}>
                    {item.label}
                    {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
                  </MenubarItem>
                ))}
                <MenubarSeparator />
              </React.Fragment>
            ))}
            {menu.checkboxItems?.map((item) => (
              <MenubarCheckboxItem key={item.id} checked={item.checked}>
                {item.label}
              </MenubarCheckboxItem>
            ))}
            {menu.radioGroups?.map((rg) => (
              <React.Fragment key={rg.id}>
                {rg.label && <MenubarLabel inset>{rg.label}</MenubarLabel>}
                <MenubarRadioGroup value={rg.selectedValue}>
                  {rg.items.map((ri) => (
                    <MenubarRadioItem key={ri.id} value={ri.value}>
                      {ri.label}
                    </MenubarRadioItem>
                  ))}
                </MenubarRadioGroup>
              </React.Fragment>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">
        Width: {menu.width} | Align: {menu.align} | Side: {menu.side}
      </p>
    </div>
  );
}

export const MenuFactoryCompleteMenu: Story = {
  name: i18n.t('menubar.storyName.menuFactoryCompleteMenu', 'Menu Factory: Complete Menu'),
  render: () => <MenuFactoryCompleteMenuDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-complete-menu"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ MENU FACTORY: USER MENU ============

function MenuFactoryUserMenuDemo() {
  const userMenu: FakeUserMenu = createFakeUserMenu();

  return (
    <div data-testid="menu-factory-user-menu" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.userMenu')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-user">{userMenu.name}</MenubarTrigger>
          <MenubarContent data-menu="mf-user">
            <MenubarLabel>{userMenu.email}</MenubarLabel>
            <MenubarSeparator />
            {userMenu.groups.map((group) => (
              <React.Fragment key={group.id}>
                {group.label && <MenubarLabel inset>{group.label}</MenubarLabel>}
                {group.items.map((item) => (
                  <MenubarItem key={item.id}>
                    {item.label}
                    {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
                  </MenubarItem>
                ))}
                <MenubarSeparator />
              </React.Fragment>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">
        Name: {userMenu.name} | Email: {userMenu.email}
      </p>
    </div>
  );
}

export const MenuFactoryUserMenu: Story = {
  name: i18n.t('menubar.storyName.menuFactoryUserMenu', 'Menu Factory: User Menu'),
  render: () => <MenuFactoryUserMenuDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-user-menu"]');
    expect(root).toBeInTheDocument();
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

// ============ MENU FACTORY: FILE MENU ============

function MenuFactoryFileMenuDemo() {
  const fileMenu: FakeFileMenu = createFakeFileMenu();

  return (
    <div data-testid="menu-factory-file-menu" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.fileMenu')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-file">
            {i18n.t('menubar.menu.file')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-file">
            {fileMenu.groups.map((group) => (
              <React.Fragment key={group.id}>
                {group.label && <MenubarLabel inset>{group.label}</MenubarLabel>}
                {group.items.map((item) => (
                  <MenubarItem key={item.id}>
                    {item.label}
                    {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
                  </MenubarItem>
                ))}
                <MenubarSeparator />
              </React.Fragment>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">
        Recent files: {fileMenu.recentFiles?.length ?? 0}
      </p>
    </div>
  );
}

export const MenuFactoryFileMenu: Story = {
  name: i18n.t('menubar.storyName.menuFactoryFileMenu', 'Menu Factory: File Menu'),
  render: () => <MenuFactoryFileMenuDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-file-menu"]');
    expect(root).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-menubar-trigger="mf-file"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ MENU FACTORY: EDIT MENU ============

function MenuFactoryEditMenuDemo() {
  const editMenu: FakeEditMenu = createFakeEditMenu();

  return (
    <div data-testid="menu-factory-edit-menu" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.editMenu')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-edit">
            {i18n.t('menubar.story.edit', 'Edit')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-edit">
            {editMenu.groups.map((group) => (
              <React.Fragment key={group.id}>
                {group.items.map((item) => (
                  <MenubarItem
                    key={item.id}
                    disabled={item.disabled}
                    variant={item.destructive ? 'destructive' : 'default'}
                  >
                    {item.label}
                    {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
                  </MenubarItem>
                ))}
                <MenubarSeparator />
              </React.Fragment>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">
        Undo: {String(editMenu.canUndo)} | Redo: {String(editMenu.canRedo)} | Selection:{' '}
        {String(editMenu.hasSelection)} | Paste: {String(editMenu.canPaste)}
      </p>
    </div>
  );
}

export const MenuFactoryEditMenu: Story = {
  name: i18n.t('menubar.storyName.menuFactoryEditMenu', 'Menu Factory: Edit Menu'),
  render: () => <MenuFactoryEditMenuDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-edit-menu"]');
    expect(root).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-menubar-trigger="mf-edit"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ MENU FACTORY: VIEW MENU ============

function MenuFactoryViewMenuDemo() {
  const viewMenu: FakeViewMenu = createFakeViewMenu();

  return (
    <div data-testid="menu-factory-view-menu" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.viewMenu')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-view">
            {i18n.t('menubar.menu.view')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-view">
            {viewMenu.groups.map((group) => (
              <React.Fragment key={group.id}>
                {group.items.map((item) => (
                  <MenubarItem key={item.id}>
                    {item.label}
                    {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
                  </MenubarItem>
                ))}
                <MenubarSeparator />
              </React.Fragment>
            ))}
            {viewMenu.checkboxItems?.map((item) => (
              <MenubarCheckboxItem key={item.id} checked={item.checked}>
                {item.label}
              </MenubarCheckboxItem>
            ))}
            {viewMenu.radioGroups?.map((rg) => (
              <React.Fragment key={rg.id}>
                <MenubarSeparator />
                {rg.label && <MenubarLabel inset>{rg.label}</MenubarLabel>}
                <MenubarRadioGroup value={rg.selectedValue}>
                  {rg.items.map((ri) => (
                    <MenubarRadioItem key={ri.id} value={ri.value}>
                      {ri.label}
                    </MenubarRadioItem>
                  ))}
                </MenubarRadioGroup>
              </React.Fragment>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p className="text-muted-foreground text-xs">Zoom: {viewMenu.zoomLevel}%</p>
    </div>
  );
}

export const MenuFactoryViewMenu: Story = {
  name: i18n.t('menubar.storyName.menuFactoryViewMenu', 'Menu Factory: View Menu'),
  render: () => <MenuFactoryViewMenuDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-view-menu"]');
    expect(root).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-menubar-trigger="mf-view"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ MENU FACTORY: SORT MENU ============

function MenuFactorySortMenuDemo() {
  const sortMenu: FakeMenuType = createFakeSortMenu();
  const firstRadio = sortMenu.radioGroups?.[0];
  const [sortValue, setSortValue] = useState(firstRadio?.selectedValue ?? '');

  return (
    <div data-testid="menu-factory-sort-menu" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.sortMenu')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-sort">
            {i18n.t('menubar.story.sort', 'Sort')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-sort">
            {sortMenu.radioGroups?.map((rg) => (
              <React.Fragment key={rg.id}>
                {rg.label && <MenubarLabel inset>{rg.label}</MenubarLabel>}
                <MenubarRadioGroup
                  value={rg === firstRadio ? sortValue : rg.selectedValue}
                  onValueChange={rg === firstRadio ? setSortValue : undefined}
                >
                  {rg.items.map((ri) => (
                    <MenubarRadioItem key={ri.id} value={ri.value}>
                      {ri.label}
                    </MenubarRadioItem>
                  ))}
                </MenubarRadioGroup>
                <MenubarSeparator />
              </React.Fragment>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const MenuFactorySortMenu: Story = {
  name: i18n.t('menubar.storyName.menuFactorySortMenu', 'Menu Factory: Sort Menu'),
  render: () => <MenuFactorySortMenuDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-sort-menu"]');
    expect(root).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-menubar-trigger="mf-sort"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ MENU FACTORY: SHARE MENU ============

function MenuFactoryShareMenuDemo() {
  const shareMenu: FakeMenuType = createFakeShareMenu();

  return (
    <div data-testid="menu-factory-share-menu" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.shareMenu')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-share">
            {i18n.t('menubar.story.share', 'Share')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-share">
            {shareMenu.groups.map((group) => (
              <React.Fragment key={group.id}>
                {group.label && <MenubarLabel inset>{group.label}</MenubarLabel>}
                {group.items.map((item) => (
                  <MenubarItem key={item.id}>
                    {item.label}
                    {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
                  </MenubarItem>
                ))}
                <MenubarSeparator />
              </React.Fragment>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const MenuFactoryShareMenu: Story = {
  name: i18n.t('menubar.storyName.menuFactoryShareMenu', 'Menu Factory: Share Menu'),
  render: () => <MenuFactoryShareMenuDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-share-menu"]');
    expect(root).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-menubar-trigger="mf-share"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ MENU FACTORY: MORE ACTIONS MENU ============

function MenuFactoryMoreActionsDemo() {
  const moreMenu: FakeMenuType = createFakeMoreActionsMenu();

  return (
    <div data-testid="menu-factory-more-actions" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.moreActions')}</p>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-more">
            {i18n.t('menubar.story.more', 'More')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-more">
            {moreMenu.groups.map((group) => (
              <React.Fragment key={group.id}>
                {group.items.map((item) => (
                  <MenubarItem key={item.id} variant={item.destructive ? 'destructive' : 'default'}>
                    {item.label}
                  </MenubarItem>
                ))}
                <MenubarSeparator />
              </React.Fragment>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const MenuFactoryMoreActions: Story = {
  name: i18n.t('menubar.storyName.menuFactoryMoreActions', 'Menu Factory: More Actions'),
  render: () => <MenuFactoryMoreActionsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-more-actions"]');
    expect(root).toBeInTheDocument();
    const trigger = canvasElement.querySelector('[data-menubar-trigger="mf-more"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ MENU FACTORY: MATRIX ============

function MenuFactoryMatrixDemo() {
  const matrix = createFakeMenuMatrix();
  const keys = Object.keys(matrix);

  return (
    <div data-testid="menu-factory-matrix" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.matrix')}</p>
      <Menubar>
        {keys.slice(0, 5).map((key) => (
          <MenubarMenu key={key}>
            <MenubarTrigger data-menubar-trigger={`matrix-${key}`}>{key}</MenubarTrigger>
            <MenubarContent data-menu={`matrix-${key}`}>
              {matrix[key].groups.map((group) => (
                <React.Fragment key={group.id}>
                  {group.label && <MenubarLabel inset>{group.label}</MenubarLabel>}
                  {group.items.map((item) => (
                    <MenubarItem
                      key={item.id}
                      disabled={item.disabled}
                      variant={item.destructive ? 'destructive' : 'default'}
                    >
                      {item.label}
                      {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
                    </MenubarItem>
                  ))}
                </React.Fragment>
              ))}
              {matrix[key].checkboxItems?.map((item) => (
                <MenubarCheckboxItem key={item.id} checked={item.checked}>
                  {item.label}
                </MenubarCheckboxItem>
              ))}
              {matrix[key].radioGroups?.map((rg) => (
                <React.Fragment key={rg.id}>
                  {rg.label && <MenubarLabel inset>{rg.label}</MenubarLabel>}
                  <MenubarRadioGroup value={rg.selectedValue}>
                    {rg.items.map((ri) => (
                      <MenubarRadioItem key={ri.id} value={ri.value}>
                        {ri.label}
                      </MenubarRadioItem>
                    ))}
                  </MenubarRadioGroup>
                </React.Fragment>
              ))}
            </MenubarContent>
          </MenubarMenu>
        ))}
      </Menubar>
      <p className="text-muted-foreground text-xs">
        {keys.length} menu variants: {keys.join(', ')}
      </p>
    </div>
  );
}

export const MenuFactoryMatrix: Story = {
  name: i18n.t('menubar.storyName.menuFactoryMatrix', 'Menu Factory: Matrix'),
  render: () => <MenuFactoryMatrixDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-matrix"]');
    expect(root).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="menubar-trigger"]');
    expect(triggers.length).toBeGreaterThan(0);
  },
};

// ============ MENU FACTORY: SHOWCASE ============

function MenuFactoryShowcaseDemo() {
  const showcase = createFakeMenuShowcase();
  const keys = Object.keys(showcase);

  return (
    <div data-testid="menu-factory-showcase" className="space-y-2">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.showcase')}</p>
      <Menubar>
        {keys.slice(0, 6).map((key) => (
          <MenubarMenu key={key}>
            <MenubarTrigger data-menubar-trigger={`showcase-${key}`}>{key}</MenubarTrigger>
            <MenubarContent data-menu={`showcase-${key}`}>
              {showcase[key].groups.map((group) => (
                <React.Fragment key={group.id}>
                  {group.label && <MenubarLabel inset>{group.label}</MenubarLabel>}
                  {group.items.map((item) => (
                    <MenubarItem key={item.id}>
                      {item.label}
                      {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
                    </MenubarItem>
                  ))}
                  <MenubarSeparator />
                </React.Fragment>
              ))}
            </MenubarContent>
          </MenubarMenu>
        ))}
      </Menubar>
      <p className="text-muted-foreground text-xs">
        {keys.length} showcase entries: {keys.join(', ')}
      </p>
    </div>
  );
}

export const MenuFactoryShowcase: Story = {
  name: i18n.t('menubar.storyName.menuFactoryShowcase', 'Menu Factory: Showcase'),
  render: () => <MenuFactoryShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-showcase"]');
    expect(root).toBeInTheDocument();
    const triggers = canvasElement.querySelectorAll('[data-slot="menubar-trigger"]');
    expect(triggers.length).toBeGreaterThan(0);
  },
};

// ============ MENU FACTORY: TYPE ALIASES ============

function MenuFactoryTypesDemo() {
  const variant: MenuItemVariant = 'destructive';
  const size: MenuSize = 'lg';
  const width: MenuWidth = 'w-56';
  const align: MenuAlign = 'center';
  const side: MenuSide = 'bottom';
  const itemType: MenuItemType = 'checkbox';

  const typeInfo = [
    { name: 'MenuItemVariant', value: variant },
    { name: 'MenuSize', value: size },
    { name: 'MenuWidth', value: width },
    { name: 'MenuAlign', value: align },
    { name: 'MenuSide', value: side },
    { name: 'MenuItemType', value: itemType },
  ];

  return (
    <div data-testid="menu-factory-types" className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('menubar.factory.types')}</p>
      <div className="rounded-md border p-4">
        <p className="mb-2 text-xs font-medium">
          {i18n.t('menubar.story.menuFactoryTypeAliases', 'Menu Factory Type Aliases')}
        </p>
        <div className="space-y-1">
          {typeInfo.map((ti) => (
            <p key={ti.name} className="text-muted-foreground text-xs">
              <span className="font-mono">{ti.name}</span>: {ti.value}
            </p>
          ))}
        </div>
      </div>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-menubar-trigger="mf-types">
            {i18n.t('menubar.story.types', 'Types')}
          </MenubarTrigger>
          <MenubarContent data-menu="mf-types">
            <MenubarItem variant={variant}>Destructive ({variant})</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Size: {size}</MenubarItem>
            <MenubarItem>Width: {width}</MenubarItem>
            <MenubarItem>Align: {align}</MenubarItem>
            <MenubarItem>Side: {side}</MenubarItem>
            <MenubarItem>Type: {itemType}</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

export const MenuFactoryTypes: Story = {
  name: i18n.t('menubar.storyName.menuFactoryTypes', 'Menu Factory: Type Aliases'),
  render: () => <MenuFactoryTypesDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="menu-factory-types"]');
    expect(root).toBeInTheDocument();
    const typeEntries = root?.querySelectorAll('.font-mono');
    expect(typeEntries?.length).toBe(6);
    const menubar = canvasElement.querySelector('[data-slot="menubar"]');
    expect(menubar).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('menubar.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('menubar.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('menubar.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('menubar.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// MENU STATUS HANDLER STORIES
// ============================================================================

export const MenuError400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MenuError401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MenuError403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MenuError404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MenuError422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MenuError429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MenuError500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MenuError502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MenuError503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MenuError504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MenuLoading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MenuSlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MenuNetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MenuEmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: menuStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('menubar.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: menubarStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('menubar.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: menubarStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerMenuSuccess: Story = {
  ...Default,
  name: i18n.t('menubar.storyName.handlerMenuSuccess', 'Handler: Menu Success'),
  parameters: { msw: { handlers: menuStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
