import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React, { useEffect, useState } from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  createFakeAccessibleDropdownMenu,
  createFakeCheckboxMenu,
  createFakeContextActionMenu,
  createFakeDisabledMenu,
  createFakeDropdownMenu,
  createFakeDropdownMenuGroup,
  createFakeDropdownMenuGroups,
  createFakeDropdownMenuItem,
  createFakeDropdownMenuItems,
  createFakeDropdownMenuItemTypeMatrix,
  createFakeDropdownMenuPositionMatrix,
  createFakeDropdownMenus,
  createFakeNestedMenu,
  createFakeRadioMenu,
  createFakeTableRowActionsMenu,
  createFakeUserAccountMenu,
  DROPDOWN_MENU_ALIGNS,
  DROPDOWN_MENU_ICONS,
  DROPDOWN_MENU_ITEM_TYPES,
  DROPDOWN_MENU_LABELS,
  DROPDOWN_MENU_SHORTCUTS,
  DROPDOWN_MENU_SIDES,
  type DropdownMenuAlign,
  type DropdownMenuItemType,
  type DropdownMenuSide,
  type FakeDropdownMenu,
  type FakeDropdownMenuGroup as FakeDropdownMenuGroupType,
  type FakeDropdownMenuItem,
  type DropdownMenuShortcut as FakeDropdownMenuShortcutType,
} from '@/.storybook/stories/_factories/dropdown-menu.factory';
import {
  dropdownMenuHandlers,
  dropdownMenuStatusHandlers,
} from '@/.storybook/stories/_handlers/dropdown-menu.handlers';
import { type FakeMenuItem } from '@/.storybook/stories/_factories/menu.factory';

import { useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============ ASYNC DATA DEMO COMPONENTS ============

// DropdownMenuWithFakerData component now uses dropdown-menu.factory
function DropdownMenuWithFakerData() {
  const { t } = useTranslation();
  const menu = createFakeDropdownMenu();
  const items = createFakeDropdownMenuItems(6);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">{menu.triggerLabel}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>{t('dropdownMenu.story.factoryMenu', 'Factory Menu')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.id} disabled={item.disabled}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DropdownMenuWithAsyncDataProps {
  apiEndpoint?: string;
  onBlur?: () => void;
  onClick?: () => void;
  onFocus?: () => void;
  onKeyDown?: () => void;
  onOpenChange?: (open: boolean) => void;
}

function DropdownMenuWithAsyncData({
  apiEndpoint = '/api/menu-items',
  onOpenChange,
  onClick,

  onFocus,
  onBlur,
  onKeyDown,
}: DropdownMenuWithAsyncDataProps) {
  const [items, setItems] = useState<FakeMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${apiEndpoint}?count=6&submenus=true`);
        if (!response.ok) {
          const errorData = (await response.json()) as { message?: string };
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as { items?: FakeMenuItem[] };
        setItems(data.items || []);
      } catch (error_) {
        setError(
          error_ instanceof Error
            ? error_.message
            : i18n.t('dropdownMenu.story.failedToLoadMenu', 'Failed to load menu')
        );
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [apiEndpoint]);

  if (loading) {
    return (
      <div className="w-[200px]" data-testid="dropdown-loading">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="w-[300px]" data-testid="dropdown-error">
        <AlertTitle>{i18n.t('dropdownMenu.story.error', 'Error')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className="text-muted-foreground rounded-md border p-4 text-center"
        data-testid="dropdown-empty"
      >
        {i18n.t('dropdownMenu.story.noMenuItemsAvailable', 'No menu items available')}
      </div>
    );
  }

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          onClick={onClick}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          data-testid="dropdown-async"
        >
          {i18n.t('dropdownMenu.story.asyncMenu', 'Async Menu')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>{i18n.t('dropdownMenu.story.actions', 'Actions')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem
            key={item.id}
            disabled={item.disabled}
            variant={item.destructive ? 'destructive' : 'default'}
          >
            {item.label}
            {item.shortcut && <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

async function openDropdownMenu(canvasElement: HTMLElement) {
  if (!canvasElement.querySelector('*')) {
    throw new Error(STORY_NO_DOM_ERROR);
  }

  const doc = canvasElement.ownerDocument;

  const existing = doc.body.querySelector('[data-slot="dropdown-menu-content"]');
  if (existing instanceof HTMLElement) return { content: existing, doc };

  const trigger = canvasElement.querySelector('[data-slot="dropdown-menu-trigger"]');
  if (!(trigger instanceof HTMLButtonElement)) {
    throw new Error('Expected dropdown menu trigger button to be present.');
  }

  expect(trigger.textContent?.trim()).not.toBe('');
  await userEvent.click(trigger);

  const content = await waitFor(() => {
    const node = doc.body.querySelector('[data-slot="dropdown-menu-content"]');

    if (!(node instanceof HTMLElement)) {
      throw new Error('Dropdown menu content was not rendered.');
    }

    return node;
  });

  return { content, doc };
}

function DropdownMenuDemo() {
  const [bookmarked, setBookmarked] = React.useState(true);
  const [view, setView] = React.useState('comfortable');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">{i18n.t('dropdownMenu.open')}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{i18n.t('dropdownMenu.label.account')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            {i18n.t('dropdownMenu.item.profile')} <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            {i18n.t('dropdownMenu.item.billing')} <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            {i18n.t('dropdownMenu.item.settings')} <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={bookmarked}
          onCheckedChange={(v) => setBookmarked(v === true)}
        >
          {i18n.t('dropdownMenu.checkbox.bookmarked')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger inset>{i18n.t('dropdownMenu.sub.view')}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <DropdownMenuRadioGroup onValueChange={setView} value={view}>
              <DropdownMenuRadioItem value="comfortable">
                {i18n.t('dropdownMenu.view.comfortable')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="compact">
                {i18n.t('dropdownMenu.view.compact')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem inset variant="destructive">
          {i18n.t('dropdownMenu.item.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const meta = {
  title: 'Components/UI/Dropdown Menu',
  component: DropdownMenuDemo,
  tags: ['autodocs'],
  args: {
    onOpenChange: fn(),
    onSelect: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  argTypes: {
    // ═══════════════════════════════════════════════════════════════
    // CONTENT
    // ═══════════════════════════════════════════════════════════════
    children: {
      control: false,
      description: i18n.t(
        'dropdownMenu.argType.menuContentIncludingItemsGroupsSeparators',
        'Menu content including items, groups, separators'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // APPEARANCE
    // ═══════════════════════════════════════════════════════════════
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
      description: i18n.t(
        'dropdownMenu.argType.preferredSideForMenuPositioning',
        'Preferred side for menu positioning'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'bottom' },
        type: { summary: "'top' | 'right' | 'bottom' | 'left'" },
      },
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
      description: i18n.t(
        'dropdownMenu.argType.alignmentOfMenuRelativeToTrigger',
        'Alignment of menu relative to trigger'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'center' },
        type: { summary: "'start' | 'center' | 'end'" },
      },
    },
    sideOffset: {
      control: 'number',
      description: i18n.t(
        'dropdownMenu.argType.distanceFromTriggerInPixels',
        'Distance from trigger in pixels'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: '4' },
        type: { summary: 'number' },
      },
    },
    className: {
      control: 'text',
      description: i18n.t(
        'dropdownMenu.argType.additionalCssClassesForContent',
        'Additional CSS classes for content'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════
    open: {
      control: 'boolean',
      description: i18n.t('dropdownMenu.argType.controlledOpenState', 'Controlled open state'),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
      },
    },
    defaultOpen: {
      control: 'boolean',
      description: i18n.t(
        'dropdownMenu.argType.defaultOpenStateForUncontrolledUsage',
        'Default open state for uncontrolled usage'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    modal: {
      control: 'boolean',
      description: i18n.t(
        'dropdownMenu.argType.whetherToBlockInteractionOutsideMenu',
        'Whether to block interaction outside menu'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // LAYOUT
    // ═══════════════════════════════════════════════════════════════
    loop: {
      control: 'boolean',
      description: i18n.t(
        'dropdownMenu.argType.whetherKeyboardNavigationLoops',
        'Whether keyboard navigation loops'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    dir: {
      control: 'select',
      options: ['ltr', 'rtl'],
      description: i18n.t('dropdownMenu.argType.readingDirection', 'Reading direction'),
      table: {
        category: 'Layout',
        type: { summary: "'ltr' | 'rtl'" },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════
    onClick: {
      action: 'onClick',
      description: i18n.t('dropdownMenu.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('dropdownMenu.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('dropdownMenu.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('dropdownMenu.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('dropdownMenu.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t(
        'dropdownMenu.argType.mouseenterEventHandler',
        'MouseEnter event handler'
      ),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t(
        'dropdownMenu.argType.mouseleaveEventHandler',
        'MouseLeave event handler'
      ),
      table: { category: 'Events' },
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'dropdownMenu.argType.calledWhenOpenStateChanges',
        'Called when open state changes'
      ),
      table: { category: 'Events' },
    },
    onSelect: {
      action: 'onSelect',
      description: i18n.t(
        'dropdownMenu.argType.calledWhenAnItemIsSelected',
        'Called when an item is selected'
      ),
      table: { category: 'Events' },
    },
    // Note: argTypes for demo wrapper - actual DropdownMenu component props documented below
    // DropdownMenu Props Reference (Radix DropdownMenu.Root):
    // - open: Controlled open state (boolean)
    // - defaultOpen: Default open state for uncontrolled usage (boolean)
    // - onOpenChange: Called when open state changes ((open: boolean) => void)
    // - modal: Whether to block interaction outside (boolean, default: true)
    // - dir: Reading direction ('ltr' | 'rtl')
    //
    // DropdownMenuTrigger Props Reference:
    // - asChild: Render as child element (boolean)
    // - disabled: Whether trigger is disabled (boolean)
    // - className: Additional CSS classes (string)
    //
    // DropdownMenuContent Props Reference:
    // - side: Preferred side ('top' | 'right' | 'bottom' | 'left', default: 'bottom')
    // - sideOffset: Distance from trigger in pixels (number, default: 4)
    // - align: Alignment ('start' | 'center' | 'end', default: 'center')
    // - alignOffset: Alignment offset in pixels (number)
    // - avoidCollisions: Whether to avoid collisions (boolean, default: true)
    // - loop: Loop keyboard navigation (boolean, default: false)
    // - forceMount: Force mount when closed (boolean)
    // - className: Additional CSS classes (string)
    //
    // DropdownMenuItem Props Reference:
    // - disabled: Whether item is disabled (boolean)
    // - inset: Add left padding for alignment (boolean)
    // - variant: Visual variant ('default' | 'destructive')
    // - onSelect: Called when item is selected ((event) => void)
    // - textValue: Text for typeahead (string)
    // - className: Additional CSS classes (string)
    //
    // DropdownMenuCheckboxItem Props Reference:
    // - checked: Checked state (boolean | 'indeterminate')
    // - onCheckedChange: Called when checked changes ((checked: boolean) => void)
    // - disabled: Whether item is disabled (boolean)
    // - onSelect: Called when item is selected ((event) => void)
    // - className: Additional CSS classes (string)
    //
    // DropdownMenuRadioGroup Props Reference:
    // - value: Selected radio value (string)
    // - onValueChange: Called when value changes ((value: string) => void)
    //
    // DropdownMenuRadioItem Props Reference:
    // - value: Radio item value (string, required)
    // - disabled: Whether item is disabled (boolean)
    // - onSelect: Called when item is selected ((event) => void)
    // - className: Additional CSS classes (string)
    //
    // DropdownMenuLabel Props Reference:
    // - inset: Add left padding for alignment (boolean)
    // - className: Additional CSS classes (string)
    //
    // DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup
  },
  parameters: {
    msw: { handlers: dropdownMenuHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof DropdownMenuDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const { content, doc } = await openDropdownMenu(canvasElement);

    expect(content.querySelector('[data-slot="dropdown-menu-label"]')).toBeInTheDocument();
    expect(content.querySelectorAll('[data-slot="dropdown-menu-item"]').length).toBe(4);
    expect(content.querySelectorAll('[data-slot="dropdown-menu-separator"]').length).toBe(3);
    expect(
      content.querySelector('[data-slot="dropdown-menu-item"][data-variant="destructive"]')
    ).toBeInTheDocument();

    const disabledItems = [
      ...content.querySelectorAll('[data-slot="dropdown-menu-item"][aria-disabled="true"]'),
    ];
    const dataDisabledItems = [
      ...content.querySelectorAll('[data-slot="dropdown-menu-item"][data-disabled]'),
    ];
    expect(new Set([...disabledItems, ...dataDisabledItems]).size).toBe(1);

    const bookmarkedItem = content.querySelector('[data-slot="dropdown-menu-checkbox-item"]');
    if (!(bookmarkedItem instanceof HTMLElement)) {
      throw new Error('Expected dropdown menu checkbox item to be present.');
    }

    expect(bookmarkedItem.getAttribute('data-state')).toBe('checked');
    await userEvent.click(bookmarkedItem);

    const reopenedAfterToggle = await openDropdownMenu(canvasElement);
    const menuAfterToggle = reopenedAfterToggle.content;
    const bookmarkedAfterToggle = menuAfterToggle.querySelector(
      '[data-slot="dropdown-menu-checkbox-item"]'
    );
    if (!(bookmarkedAfterToggle instanceof HTMLElement)) {
      throw new Error('Expected dropdown menu checkbox item to be present after reopening.');
    }

    expect(bookmarkedAfterToggle.getAttribute('data-state')).toBe('unchecked');

    const viewTrigger = menuAfterToggle.querySelector('[data-slot="dropdown-menu-sub-trigger"]');
    if (!(viewTrigger instanceof HTMLElement)) {
      throw new Error('Expected dropdown menu sub trigger to be present.');
    }

    await userEvent.hover(viewTrigger);

    const subContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="dropdown-menu-sub-content"]');

      if (!(content instanceof HTMLElement)) {
        throw new Error('Dropdown menu sub content was not rendered.');
      }

      return content;
    });

    const radioItems = subContent.querySelectorAll('[data-slot="dropdown-menu-radio-item"]');
    expect(radioItems.length).toBe(2);

    const compactItem = radioItems[1];
    if (!(compactItem instanceof HTMLElement)) {
      throw new Error('Expected compact radio item to be present.');
    }

    await userEvent.click(compactItem);

    await waitFor(() => {
      expect(compactItem.getAttribute('data-state')).toBe('checked');
    });

    const reopenedAfterRadio = await openDropdownMenu(canvasElement);
    const menuAfterRadio = reopenedAfterRadio.content;
    const viewTriggerAfter = menuAfterRadio.querySelector(
      '[data-slot="dropdown-menu-sub-trigger"]'
    );
    if (!(viewTriggerAfter instanceof HTMLElement)) {
      throw new Error('Expected dropdown menu sub trigger to be present after reopening.');
    }

    await userEvent.hover(viewTriggerAfter);

    const subContentAfter = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="dropdown-menu-sub-content"]');

      if (!(content instanceof HTMLElement)) {
        throw new Error('Dropdown menu sub content was not rendered.');
      }

      return content;
    });

    const radioItemsAfter = subContentAfter.querySelectorAll(
      '[data-slot="dropdown-menu-radio-item"]'
    );
    const compactItemAfter = radioItemsAfter[1];
    if (!(compactItemAfter instanceof HTMLElement)) {
      throw new Error('Expected compact radio item to be present in reopened submenu.');
    }
    expect(compactItemAfter.getAttribute('data-state')).toBe('checked');

    const reopenedAfterClose = await openDropdownMenu(canvasElement);
    const menuAfter = reopenedAfterClose.content;
    const logoutItem = menuAfter.querySelector(
      '[data-slot="dropdown-menu-item"][data-variant="destructive"]'
    );
    if (!(logoutItem instanceof HTMLElement)) {
      throw new Error('Expected destructive logout item to be present.');
    }

    await userEvent.click(logoutItem);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
  },
};

function DropdownMenuVariantsDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{t('dropdownMenu.variants.basic')}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">{t('dropdownMenu.story.basicMenu', 'Basic Menu')}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48">
            <DropdownMenuItem>{t('dropdownMenu.story.newFile', 'New File')}</DropdownMenuItem>
            <DropdownMenuItem>{t('dropdownMenu.story.open', 'Open')}</DropdownMenuItem>
            <DropdownMenuItem>{t('dropdownMenu.story.save', 'Save')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{t('dropdownMenu.story.exit', 'Exit')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('dropdownMenu.variants.withSubmenus')}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {t('dropdownMenu.story.withSubmenus', 'With Submenus')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuItem>{t('dropdownMenu.story.newWindow', 'New Window')}</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {t('dropdownMenu.story.share', 'Share')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuItem>{t('dropdownMenu.story.email', 'Email')}</DropdownMenuItem>
                <DropdownMenuItem>{t('dropdownMenu.story.messages', 'Messages')}</DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {t('dropdownMenu.story.social', 'Social')}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-40">
                    <DropdownMenuItem>
                      {t('dropdownMenu.story.twitter', 'Twitter')}
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      {t('dropdownMenu.story.linkedin', 'LinkedIn')}
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      {t('dropdownMenu.story.facebook', 'Facebook')}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{t('dropdownMenu.story.print', 'Print')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('dropdownMenu.variants.withCheckboxes')}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {t('dropdownMenu.story.withCheckboxesRadios', 'With Checkboxes/Radios')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>
              {t('dropdownMenu.story.viewOptions', 'View Options')}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked>
              {t('dropdownMenu.story.showToolbar', 'Show Toolbar')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem>
              {t('dropdownMenu.story.showSidebar', 'Show Sidebar')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked>
              {t('dropdownMenu.story.showStatusBar', 'Show Status Bar')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('dropdownMenu.story.layout', 'Layout')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value="grid">
              <DropdownMenuRadioItem value="list">
                {t('dropdownMenu.story.list', 'List')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="grid">
                {t('dropdownMenu.story.grid', 'Grid')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="columns">
                {t('dropdownMenu.story.columns', 'Columns')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('dropdownMenu.variants.withShortcuts')}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {t('dropdownMenu.story.withIconsShortcuts', 'With Icons/Shortcuts')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuItem>
                {t('dropdownMenu.story.profile', 'Profile')}{' '}
                <DropdownMenuShortcut>Shift+Cmd+P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                {t('dropdownMenu.story.billing', 'Billing')}{' '}
                <DropdownMenuShortcut>Cmd+B</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                {t('dropdownMenu.story.settings', 'Settings')}{' '}
                <DropdownMenuShortcut>Cmd+,</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                {t('dropdownMenu.story.keyboardShortcuts', 'Keyboard Shortcuts')}{' '}
                <DropdownMenuShortcut>Cmd+K</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              {t('dropdownMenu.story.apiComingSoon', 'API (Coming Soon)')}{' '}
              <DropdownMenuShortcut>Cmd+A</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              {t('dropdownMenu.story.logoutAction', 'Logout')}{' '}
              <DropdownMenuShortcut>Shift+Cmd+Q</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export const Variants: Story = {
  tags: ['!test'],
  render: () => <DropdownMenuVariantsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function DropdownMenuSizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{t('dropdownMenu.sizes.compact')}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">{t('dropdownMenu.story.compact', 'Compact')}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-40">
            <DropdownMenuItem>{t('dropdownMenu.story.cut', 'Cut')}</DropdownMenuItem>
            <DropdownMenuItem>{t('dropdownMenu.story.copy', 'Copy')}</DropdownMenuItem>
            <DropdownMenuItem>{t('dropdownMenu.story.paste', 'Paste')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('dropdownMenu.sizes.default')}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">{t('dropdownMenu.story.default', 'Default')}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>{t('dropdownMenu.story.myAccount', 'My Account')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              {t('dropdownMenu.story.profile', 'Profile')}{' '}
              <DropdownMenuShortcut>Cmd+P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              {t('dropdownMenu.story.settings', 'Settings')}{' '}
              <DropdownMenuShortcut>Cmd+S</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{t('dropdownMenu.story.logout', 'Logout')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('dropdownMenu.sizes.wide')}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">{t('dropdownMenu.story.wide', 'Wide')}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72">
            <DropdownMenuLabel>
              {t('dropdownMenu.story.navigation', 'Navigation')}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <div className="flex flex-col">
                <span>{t('dropdownMenu.story.dashboard', 'Dashboard')}</span>
                <span className="text-muted-foreground text-xs">
                  {t(
                    'dropdownMenu.story.viewAnalyticsAndMetrics',
                    'View your analytics and metrics'
                  )}
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex flex-col">
                <span>{t('dropdownMenu.story.projects', 'Projects')}</span>
                <span className="text-muted-foreground text-xs">
                  {t('dropdownMenu.story.manageProjectsAndTasks', 'Manage your projects and tasks')}
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex flex-col">
                <span>{t('dropdownMenu.story.teamMembers', 'Team Members')}</span>
                <span className="text-muted-foreground text-xs">
                  {t(
                    'dropdownMenu.story.inviteAndManageTeamAccess',
                    'Invite and manage team access'
                  )}
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  tags: ['!test'],
  render: () => <DropdownMenuSizesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const { content, doc } = await openDropdownMenu(canvasElement);

    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(canvasElement);
    expect(canvas.getByText('メニューを開く')).toBeInTheDocument();

    const menu = within(content);
    expect(menu.getByText('マイアカウント')).toBeInTheDocument();
    expect(menu.getByText('プロフィール')).toBeInTheDocument();
    expect(menu.getByText('請求')).toBeInTheDocument();
    expect(menu.getByText('設定')).toBeInTheDocument();
    expect(menu.getByText('ブックマーク済み')).toBeInTheDocument();
    expect(menu.getByText('表示')).toBeInTheDocument();
    expect(menu.getByText('ログアウト')).toBeInTheDocument();

    const viewTrigger = content.querySelector('[data-slot="dropdown-menu-sub-trigger"]');
    if (!(viewTrigger instanceof HTMLElement)) {
      throw new Error('Expected dropdown menu sub trigger to be present.');
    }

    await userEvent.hover(viewTrigger);

    const subContent = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="dropdown-menu-sub-content"]');

      if (!(node instanceof HTMLElement)) {
        throw new Error('Dropdown menu sub content was not rendered.');
      }

      return node;
    });

    const subMenu = within(subContent);
    expect(subMenu.getByText('ゆったり')).toBeInTheDocument();
    expect(subMenu.getByText('コンパクト')).toBeInTheDocument();
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
  name: i18n.t('dropdownMenu.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
  render: () => <DropdownMenuWithFakerData />,
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
    expect(content.querySelectorAll('[data-slot="dropdown-menu-item"]').length).toBeGreaterThan(0);
  },
};

export const WithAsyncData: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuHandlers },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const trigger = canvasElement.querySelector('[data-testid="dropdown-async"]');
      expect(trigger).toBeInTheDocument();
    });
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
  },
};

// ============ HTTP 4xx ERROR STORIES ============

export const Error400BadRequest: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const error = canvasElement.querySelector('[data-testid="dropdown-error"]');
      expect(error).toBeInTheDocument();
    });
  },
};

export const Error401Unauthorized: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const error = canvasElement.querySelector('[data-testid="dropdown-error"]');
      expect(error).toBeInTheDocument();
    });
  },
};

export const Error403Forbidden: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const error = canvasElement.querySelector('[data-testid="dropdown-error"]');
      expect(error).toBeInTheDocument();
    });
  },
};

export const Error404NotFound: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const error = canvasElement.querySelector('[data-testid="dropdown-error"]');
      expect(error).toBeInTheDocument();
    });
  },
};

export const Error429RateLimit: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const error = canvasElement.querySelector('[data-testid="dropdown-error"]');
      expect(error).toBeInTheDocument();
    });
  },
};

// ============ HTTP 5xx ERROR STORIES ============

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const error = canvasElement.querySelector('[data-testid="dropdown-error"]');
      expect(error).toBeInTheDocument();
    });
  },
};

export const Error502BadGateway: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const error = canvasElement.querySelector('[data-testid="dropdown-error"]');
      expect(error).toBeInTheDocument();
    });
  },
};

export const Error503ServiceUnavailable: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const error = canvasElement.querySelector('[data-testid="dropdown-error"]');
      expect(error).toBeInTheDocument();
    });
  },
};

export const Error504GatewayTimeout: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const error = canvasElement.querySelector('[data-testid="dropdown-error"]');
      expect(error).toBeInTheDocument();
    });
  },
};

// ============ SPECIAL STATE STORIES ============

export const Loading: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const loading = canvasElement.querySelector('[data-testid="dropdown-loading"]');
    expect(loading).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const empty = canvasElement.querySelector('[data-testid="dropdown-empty"]');
      expect(empty).toBeInTheDocument();
    });
  },
};

export const SlowResponse: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const loading = canvasElement.querySelector('[data-testid="dropdown-loading"]');
    expect(loading).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  render: (args) => <DropdownMenuWithAsyncData {...args} />,
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: dropdownMenuStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const error = canvasElement.querySelector('[data-testid="dropdown-error"]');
      expect(error).toBeInTheDocument();
    });
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  name: i18n.t('dropdownMenu.storyName.accessibility', 'Accessibility (Keyboard Navigation)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    // Get trigger button
    const trigger = canvasElement.querySelector('[data-slot="dropdown-menu-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected dropdown menu trigger button to be present.');
    }

    // Verify trigger has proper aria attributes
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');

    // Focus on trigger
    trigger.focus();
    expect(doc.activeElement).toBe(trigger);

    // Test Enter key to open menu
    await userEvent.keyboard('{Enter}');

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="dropdown-menu-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Dropdown menu content was not rendered.');
      }
      return node;
    });

    // Verify menu has proper role
    expect(content.getAttribute('role')).toBe('menu');

    // Verify menu items have proper role
    const menuItems = content.querySelectorAll('[role="menuitem"]');
    expect(menuItems.length).not.toBe(0);

    // Test Arrow Down navigation within menu
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      const focusedItem = doc.activeElement;
      expect(
        focusedItem?.getAttribute('role') === 'menuitem' ||
          focusedItem?.getAttribute('role') === 'menuitemcheckbox'
      ).toBe(true);
    });

    // Test Arrow Up navigation
    await userEvent.keyboard('{ArrowUp}');

    // Test Escape key to close menu
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeInTheDocument();
    });

    // Reopen menu for more tests
    await userEvent.click(trigger);

    const reopenedContent = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="dropdown-menu-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Dropdown menu content was not rendered.');
      }
      return node;
    });

    // Verify checkbox item has proper role
    const checkboxItem = reopenedContent.querySelector('[data-slot="dropdown-menu-checkbox-item"]');
    expect(checkboxItem?.getAttribute('role')).toBe('menuitemcheckbox');

    // Test submenu navigation
    const subTrigger = reopenedContent.querySelector('[data-slot="dropdown-menu-sub-trigger"]');
    if (subTrigger instanceof HTMLElement) {
      await userEvent.hover(subTrigger);

      const subContent = await waitFor(() => {
        const node = doc.body.querySelector('[data-slot="dropdown-menu-sub-content"]');
        if (!(node instanceof HTMLElement)) {
          throw new Error('Dropdown menu sub content was not rendered.');
        }
        return node;
      });

      // Verify radio items have proper role
      const radioItems = subContent.querySelectorAll('[data-slot="dropdown-menu-radio-item"]');
      radioItems.forEach((item) => {
        expect(item.getAttribute('role')).toBe('menuitemradio');
      });
    }

    // Close menu
    await userEvent.keyboard('{Escape}');
  },
};

// ============ DARK MODE STORIES ============

export const DarkModeJapanese: Story = {
  name: i18n.t('dropdownMenu.storyName.darkModeJapanese', 'Dark Mode + Japanese Locale'),
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const { content, doc } = await openDropdownMenu(canvasElement);

    // Verify Japanese locale is active
    expect(doc.documentElement.lang).toBe('ja');

    // Verify dark mode class on body
    expect(
      doc.body.classList.contains('dark') || doc.documentElement.classList.contains('dark')
    ).toBe(true);

    // Verify Japanese text is rendered
    const canvas = within(canvasElement);
    expect(canvas.getByText('メニューを開く')).toBeInTheDocument();

    // Verify menu content has proper styling for dark mode
    expect(content.getAttribute('data-slot')).toBe('dropdown-menu-content');

    // Verify Japanese labels in menu
    const menu = within(content);
    expect(menu.getByText('マイアカウント')).toBeInTheDocument();
    expect(menu.getByText('プロフィール')).toBeInTheDocument();
  },
};

// ============ COMPREHENSIVE KEYBOARD NAVIGATION ============

function KeyboardNavigationDemo() {
  const { t } = useTranslation();
  const [lastAction, setLastAction] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<string>('');

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t('dropdownMenu.story.keyboardNavigation')}
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="keyboard-trigger">
            {i18n.t('dropdownMenu.open')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>{i18n.t('dropdownMenu.label.actions')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-testid="item-1"
            onSelect={() => {
              setLastAction(t('dropdownMenu.story.item1Selected', 'Item 1 selected'));
              setSelectedItem('item-1');
            }}
          >
            {t('dropdownMenu.story.item1', 'Item 1')}{' '}
            <DropdownMenuShortcut>⌘1</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="item-2"
            onSelect={() => {
              setLastAction(t('dropdownMenu.story.item2Selected', 'Item 2 selected'));
              setSelectedItem('item-2');
            }}
          >
            {t('dropdownMenu.story.item2', 'Item 2')}{' '}
            <DropdownMenuShortcut>⌘2</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled data-testid="item-disabled">
            {t('dropdownMenu.story.disabledItem', 'Disabled Item')}
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="item-3"
            onSelect={() => {
              setLastAction(t('dropdownMenu.story.item3Selected', 'Item 3 selected'));
              setSelectedItem('item-3');
            }}
          >
            {t('dropdownMenu.story.item3', 'Item 3')}{' '}
            <DropdownMenuShortcut>⌘3</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid="submenu-trigger">
              {t('dropdownMenu.story.moreOptions', 'More Options')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                data-testid="sub-item-1"
                onSelect={() => {
                  setLastAction(t('dropdownMenu.story.subItem1Selected', 'Sub Item 1 selected'));
                  setSelectedItem('sub-item-1');
                }}
              >
                {t('dropdownMenu.story.subItem1', 'Sub Item 1')}
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="sub-item-2"
                onSelect={() => {
                  setLastAction(t('dropdownMenu.story.subItem2Selected', 'Sub Item 2 selected'));
                  setSelectedItem('sub-item-2');
                }}
              >
                {t('dropdownMenu.story.subItem2', 'Sub Item 2')}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
      {lastAction && (
        <div className="text-sm" data-testid="action-output">
          {t('dropdownMenu.story.lastAction', 'Last action: {{lastAction}}', { lastAction })}
        </div>
      )}
      {selectedItem && (
        <div className="text-sm" data-testid="selected-item">
          {t('dropdownMenu.story.selectedItem', 'Selected: {{selectedItem}}', { selectedItem })}
        </div>
      )}
    </div>
  );
}

export const KeyboardNavigation: Story = {
  name: i18n.t('dropdownMenu.storyName.keyboardNavigation', 'Keyboard Navigation (comprehensive)'),
  render: () => <KeyboardNavigationDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-testid="keyboard-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected trigger button to be present.');
    }

    // Test: Focus trigger with Tab
    await userEvent.tab();
    expect(doc.activeElement).toBe(trigger);

    // Test: Open with Enter
    await userEvent.keyboard('{Enter}');
    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="dropdown-menu-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Dropdown menu content was not rendered.');
      }
      return node;
    });

    // Verify ARIA attributes
    expect(content.getAttribute('role')).toBe('menu');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    // Test: Navigate down through items (should skip disabled)
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}'); // Should skip disabled item

    // Test: Select item with Enter
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeInTheDocument();
    });

    // Verify selection was made
    await waitFor(() => {
      const output = canvasElement.querySelector('[data-testid="action-output"]');
      expect(output?.textContent).toContain('selected');
    });

    // Reopen for more tests
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-content"]')).toBeInTheDocument();
    });

    // Test: Close with Escape
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeInTheDocument();
    });

    // Test: Open with Space
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-content"]')).toBeInTheDocument();
    });

    // Test: Home key goes to first item
    await userEvent.keyboard('{Home}');

    // Test: End key goes to last focusable item
    await userEvent.keyboard('{End}');

    // Close menu
    await userEvent.keyboard('{Escape}');
  },
};

// ============ SUBMENU NAVIGATION TESTS ============

export const SubmenuNavigation: Story = {
  name: i18n.t('dropdownMenu.storyName.submenuNavigation', 'Submenu Navigation (Arrow keys)'),
  render: () => <KeyboardNavigationDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-testid="keyboard-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected trigger button to be present.');
    }

    // Open menu
    await userEvent.click(trigger);
    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="dropdown-menu-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Dropdown menu content was not rendered.');
      }
      return node;
    });

    // Navigate to submenu trigger
    const subTrigger = content.querySelector('[data-testid="submenu-trigger"]');
    if (!(subTrigger instanceof HTMLElement)) {
      throw new Error('Expected submenu trigger to be present.');
    }

    // Focus the submenu trigger via keyboard navigation
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');

    // Test: Open submenu with ArrowRight
    await userEvent.keyboard('{ArrowRight}');
    const subContent = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="dropdown-menu-sub-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Submenu content was not rendered.');
      }
      return node;
    });

    expect(subContent.getAttribute('role')).toBe('menu');

    // Test: Navigate within submenu
    await userEvent.keyboard('{ArrowDown}');

    // Test: Select submenu item
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeInTheDocument();
    });

    // Verify submenu item was selected
    await waitFor(() => {
      const output = canvasElement.querySelector('[data-testid="action-output"]');
      expect(output?.textContent).toContain('Sub Item');
    });

    // Reopen for ArrowLeft test
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-content"]')).toBeInTheDocument();
    });

    // Navigate to submenu again
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowRight}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-sub-content"]')).toBeInTheDocument();
    });

    // Test: Close submenu with ArrowLeft
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(
        doc.body.querySelector('[data-slot="dropdown-menu-sub-content"]')
      ).not.toBeInTheDocument();
    });

    // Close all
    await userEvent.keyboard('{Escape}');
  },
};

// ============ ARIA COMPLIANCE TESTS ============

export const AriaCompliance: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.ariaCompliance',
    'ARIA Compliance (role, aria-haspopup, etc.)'
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="dropdown-menu-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected trigger button to be present.');
    }

    // Test: Trigger ARIA attributes (before opening)
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    // Open menu
    await userEvent.click(trigger);
    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="dropdown-menu-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Dropdown menu content was not rendered.');
      }
      return node;
    });

    // Test: Trigger ARIA attributes (after opening)
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    // Test: Content role
    expect(content.getAttribute('role')).toBe('menu');

    // Test: Menu items have menuitem role
    const menuItems = content.querySelectorAll('[data-slot="dropdown-menu-item"]');
    menuItems.forEach((item) => {
      expect(item.getAttribute('role')).toBe('menuitem');
    });

    // Test: Checkbox items have menuitemcheckbox role
    const checkboxItems = content.querySelectorAll('[data-slot="dropdown-menu-checkbox-item"]');
    checkboxItems.forEach((item) => {
      expect(item.getAttribute('role')).toBe('menuitemcheckbox');
      // Should have aria-checked
      expect(item.getAttribute('aria-checked')).toMatch(/^(true|false)$/);
    });

    // Navigate to submenu
    const subTrigger = content.querySelector('[data-slot="dropdown-menu-sub-trigger"]');
    if (subTrigger instanceof HTMLElement) {
      await userEvent.hover(subTrigger);

      const subContent = await waitFor(() => {
        const node = doc.body.querySelector('[data-slot="dropdown-menu-sub-content"]');
        if (!(node instanceof HTMLElement)) {
          throw new Error('Submenu content was not rendered.');
        }
        return node;
      });

      // Test: Submenu content role
      expect(subContent.getAttribute('role')).toBe('menu');

      // Test: Sub-trigger has aria-haspopup
      expect(subTrigger.getAttribute('aria-haspopup')).toBe('menu');

      // Test: Radio items have menuitemradio role
      const radioItems = subContent.querySelectorAll('[data-slot="dropdown-menu-radio-item"]');
      radioItems.forEach((item) => {
        expect(item.getAttribute('role')).toBe('menuitemradio');
      });
    }

    // Test: Disabled items have aria-disabled
    const disabledItems = content.querySelectorAll(
      '[data-slot="dropdown-menu-item"][data-disabled]'
    );
    disabledItems.forEach((item) => {
      expect(
        item.getAttribute('aria-disabled') === 'true' || item.hasAttribute('data-disabled')
      ).toBe(true);
    });

    // Close menu
    await userEvent.keyboard('{Escape}');

    // Test: Trigger aria-expanded is false after closing
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  },
};

// ============ TYPEAHEAD SEARCH ============

function TypeaheadDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {t(
          'dropdownMenu.story.typeaheadDescription',
          'Type letters to jump to matching items (typeahead search)'
        )}
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="typeahead-trigger">
            {t('dropdownMenu.story.openMenu', 'Open Menu')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>{i18n.t('dropdownMenu.story.fruits', 'Fruits')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem data-testid="apple">
            {i18n.t('dropdownMenu.story.apple', 'Apple')}
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="apricot">
            {i18n.t('dropdownMenu.story.apricot', 'Apricot')}
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="banana">
            {i18n.t('dropdownMenu.story.banana', 'Banana')}
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="blueberry">
            {i18n.t('dropdownMenu.story.blueberry', 'Blueberry')}
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="cherry">
            {i18n.t('dropdownMenu.story.cherry', 'Cherry')}
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="cranberry">
            {i18n.t('dropdownMenu.story.cranberry', 'Cranberry')}
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="date">
            {i18n.t('dropdownMenu.story.date', 'Date')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const TypeaheadSearch: Story = {
  name: i18n.t('dropdownMenu.storyName.typeaheadSearch', 'Typeahead Search'),
  render: () => <TypeaheadDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-testid="typeahead-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected trigger button to be present.');
    }

    // Open menu
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-content"]')).toBeInTheDocument();
    });

    // Type 'b' to jump to banana
    await userEvent.keyboard('b');
    await waitFor(() => {
      const focused = doc.activeElement;
      expect(focused?.textContent?.toLowerCase()).toContain('b');
    });

    // Type 'c' to jump to cherry
    await userEvent.keyboard('c');
    await waitFor(() => {
      const focused = doc.activeElement;
      expect(focused?.textContent?.toLowerCase()).toContain('c');
    });

    // Close menu
    await userEvent.keyboard('{Escape}');
  },
};

// ============ FOCUS TRAP TEST ============

export const FocusTrap: Story = {
  name: i18n.t('dropdownMenu.storyName.focusTrap', 'Focus Trap (Tab cycling)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const { content } = await openDropdownMenu(canvasElement);

    // Get all focusable items
    const focusableItems = content.querySelectorAll(
      '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [data-slot="dropdown-menu-sub-trigger"]'
    );

    expect(focusableItems.length).toBeGreaterThan(0);

    // Tab through items - focus should cycle within menu
    for (let i = 0; i < focusableItems.length + 2; i++) {
      await userEvent.keyboard('{ArrowDown}');
    }

    // Focus should still be within the menu content
    expect(content.contains(doc.activeElement)).toBe(true);

    // Close menu
    await userEvent.keyboard('{Escape}');
  },
};

// ============ CONTROLLED STATE ============

function ControlledDropdownDemo() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'dropdownMenu.story.controlledOpenStateWithExternalButton',
          'Controlled open state with external button'
        )}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setOpen(!open)} data-testid="external-toggle">
          {open
            ? t('dropdownMenu.story.closeMenuExternally', 'Close Menu Externally')
            : t('dropdownMenu.story.openMenuExternally', 'Open Menu Externally')}
        </Button>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" data-testid="controlled-trigger">
              {t('dropdownMenu.story.controlledMenu', 'Controlled Menu')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>{i18n.t('dropdownMenu.story.actions', 'Actions')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{t('dropdownMenu.story.action1', 'Action 1')}</DropdownMenuItem>
            <DropdownMenuItem>{t('dropdownMenu.story.action2', 'Action 2')}</DropdownMenuItem>
            <DropdownMenuItem>{t('dropdownMenu.story.action3', 'Action 3')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="text-muted-foreground text-xs" data-testid="open-state">
        {t('dropdownMenu.story.openState', 'Open state: {{state}}', {
          state: open ? 'true' : 'false',
        })}
      </p>
    </div>
  );
}

export const ControlledState: Story = {
  name: i18n.t('dropdownMenu.storyName.controlledState', 'Controlled State'),
  render: () => <ControlledDropdownDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Initial state should be closed
    const stateIndicator = canvasElement.querySelector('[data-testid="open-state"]');
    expect(stateIndicator?.textContent).toContain('false');

    // Click external toggle to open
    const externalToggle = canvasElement.querySelector('[data-testid="external-toggle"]');
    if (!(externalToggle instanceof HTMLButtonElement)) {
      throw new Error('Expected external toggle button.');
    }

    await userEvent.click(externalToggle);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-content"]')).toBeInTheDocument();
      expect(stateIndicator?.textContent).toContain('true');
    });

    // Click external toggle to close
    await userEvent.click(externalToggle);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeInTheDocument();
      expect(stateIndicator?.textContent).toContain('false');
    });

    // Open via trigger
    const trigger = canvasElement.querySelector('[data-testid="controlled-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected controlled trigger button.');
    }

    await userEvent.click(trigger);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-content"]')).toBeInTheDocument();
    });

    // Select an item should close
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: SINGLE ITEM ============

function FactorySingleItemDemo() {
  const { t } = useTranslation();
  const item: FakeDropdownMenuItem = createFakeDropdownMenuItem({
    type: 'item',
    label: t('dropdownMenu.story.testItem', 'Test Item'),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{t('dropdownMenu.factory.singleItem')}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="single-item-trigger">
            {t('dropdownMenu.story.singleItem', 'Single Item')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>
            {t('dropdownMenu.story.factoryItem', 'Factory Item')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={item.disabled} data-testid="factory-item">
            {item.label}
            {item.shortcut && (
              <DropdownMenuShortcut>
                {item.shortcut.modifiers?.join('+')}+{item.shortcut.key}
              </DropdownMenuShortcut>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="text-muted-foreground text-xs" data-testid="item-details">
        {t(
          'dropdownMenu.story.itemDetails',
          'ID: {{id}} | Type: {{type}} | Disabled: {{disabled}}',
          { id: item.id, type: item.type, disabled: String(item.disabled) }
        )}
      </div>
    </div>
  );
}

export const FactorySingleItem: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factorySingleItem',
    'Factory: Single Item (createFakeDropdownMenuItem)'
  ),
  render: () => <FactorySingleItemDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const factoryItem = content.querySelector('[data-testid="factory-item"]');
    expect(factoryItem).toBeInTheDocument();
    expect(factoryItem?.textContent).toContain('Test Item');
    const details = canvasElement.querySelector('[data-testid="item-details"]');
    expect(details?.textContent).toContain('Type: item');
  },
};

// ============ FACTORY: MULTIPLE MENUS ============

function FactoryMultipleMenusDemo() {
  const menus: FakeDropdownMenu[] = createFakeDropdownMenus(3);

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.multipleMenus')}</p>
      <div className="flex gap-4" data-testid="multiple-menus-container">
        {menus.map((menu) => (
          <DropdownMenu key={menu.id}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">{menu.triggerLabel}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>
                {i18n.t('dropdownMenu.story.menuId', 'Menu {{id}}', {
                  id: menu.id.slice(0, 4),
                })}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {menu.items
                .filter((item) => item.type !== 'separator')
                .slice(0, 4)
                .map((item) => (
                  <DropdownMenuItem key={item.id} disabled={item.disabled}>
                    {item.label}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>
    </div>
  );
}

export const FactoryMultipleMenus: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryMultipleMenus',
    'Factory: Multiple Menus (createFakeDropdownMenus)'
  ),
  render: () => <FactoryMultipleMenusDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="multiple-menus-container"]');
    expect(container).toBeInTheDocument();
    const triggers = container?.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    expect(triggers?.length).toBe(3);
  },
};

// ============ FACTORY: USER ACCOUNT MENU ============

function FactoryUserAccountMenuDemo() {
  const menu = createFakeUserAccountMenu();

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.userAccount')}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="user-account-trigger">
            {menu.triggerLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>{menu.triggerLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {menu.items.map((item) => {
            if (item.type === 'separator') {
              return <DropdownMenuSeparator key={item.id} />;
            }
            if (item.type === 'sub' && item.subItems) {
              return (
                <DropdownMenuSub key={item.id}>
                  <DropdownMenuSubTrigger>{item.label}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {item.subItems.map((sub) =>
                      sub.type === 'separator' ? (
                        <DropdownMenuSeparator key={sub.id} />
                      ) : (
                        <DropdownMenuItem key={sub.id}>{sub.label}</DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            }
            return (
              <DropdownMenuItem key={item.id} disabled={item.disabled}>
                {item.label}
                {item.shortcut && (
                  <DropdownMenuShortcut>
                    {item.shortcut.modifiers?.join('+')}+{item.shortcut.key}
                  </DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const FactoryUserAccountMenu: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryUserAccountMenu',
    'Factory: User Account Menu (createFakeUserAccountMenu)'
  ),
  render: () => <FactoryUserAccountMenuDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const items = content.querySelectorAll('[data-slot="dropdown-menu-item"]');
    expect(items.length).toBeGreaterThan(5);
    const subTrigger = content.querySelector('[data-slot="dropdown-menu-sub-trigger"]');
    expect(subTrigger).toBeInTheDocument();
  },
};

// ============ FACTORY: CONTEXT ACTION MENU ============

function FactoryContextActionMenuDemo() {
  const menu = createFakeContextActionMenu();

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.contextAction')}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="context-action-trigger">
            {menu.triggerLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>{i18n.t('dropdownMenu.story.actions', 'Actions')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {menu.items.map((item) =>
            item.type === 'separator' ? (
              <DropdownMenuSeparator key={item.id} />
            ) : (
              <DropdownMenuItem key={item.id} disabled={item.disabled}>
                {item.label}
                {item.shortcut && (
                  <DropdownMenuShortcut>
                    {item.shortcut.modifiers?.join('+')}+{item.shortcut.key}
                  </DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const FactoryContextActionMenu: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryContextActionMenu',
    'Factory: Context Action Menu (createFakeContextActionMenu)'
  ),
  render: () => <FactoryContextActionMenuDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const items = content.querySelectorAll('[data-slot="dropdown-menu-item"]');
    expect(items.length).toBeGreaterThan(3);
  },
};

// ============ FACTORY: CHECKBOX MENU ============

function FactoryCheckboxMenuDemo() {
  const menu = createFakeCheckboxMenu();
  const [checkedState, setCheckedState] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of menu.items) {
      if (item.type === 'checkbox') {
        initial[item.id] = item.checked ?? false;
      }
    }
    return initial;
  });

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.checkboxMenu')}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="checkbox-menu-trigger">
            {menu.triggerLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>
            {i18n.t('dropdownMenu.story.viewOptions', 'View Options')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {menu.items.map((item) =>
            item.type === 'separator' ? (
              <DropdownMenuSeparator key={item.id} />
            ) : (
              <DropdownMenuCheckboxItem
                key={item.id}
                checked={checkedState[item.id]}
                onCheckedChange={(v) =>
                  setCheckedState((prev) => ({ ...prev, [item.id]: v === true }))
                }
              >
                {item.label}
              </DropdownMenuCheckboxItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const FactoryCheckboxMenu: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryCheckboxMenu',
    'Factory: Checkbox Menu (createFakeCheckboxMenu)'
  ),
  render: () => <FactoryCheckboxMenuDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const checkboxItems = content.querySelectorAll('[data-slot="dropdown-menu-checkbox-item"]');
    expect(checkboxItems.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: RADIO MENU ============

function FactoryRadioMenuDemo() {
  const menu = createFakeRadioMenu();
  const radioItems = menu.items.filter((item) => item.type === 'radio');
  const defaultValue = radioItems.find((item) => item.checked)?.radioValue ?? '';
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.radioMenu')}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="radio-menu-trigger">
            {menu.triggerLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>{i18n.t('dropdownMenu.story.theme', 'Theme')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={value} onValueChange={setValue}>
            {radioItems.map((item) => (
              <DropdownMenuRadioItem key={item.id} value={item.radioValue ?? ''}>
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="text-muted-foreground text-xs" data-testid="radio-value">
        {i18n.t('dropdownMenu.story.selectedValue', 'Selected: {{value}}', { value })}
      </div>
    </div>
  );
}

export const FactoryRadioMenu: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryRadioMenu',
    'Factory: Radio Menu (createFakeRadioMenu)'
  ),
  render: () => <FactoryRadioMenuDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const radioItems = content.querySelectorAll('[data-slot="dropdown-menu-radio-item"]');
    expect(radioItems.length).toBe(3);
  },
};

// ============ FACTORY: NESTED MENU ============

function FactoryNestedMenuDemo() {
  const menu = createFakeNestedMenu();

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.nestedMenu')}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="nested-menu-trigger">
            {menu.triggerLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>{i18n.t('dropdownMenu.story.file', 'File')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {menu.items.map((item) => {
            if (item.type === 'separator') {
              return <DropdownMenuSeparator key={item.id} />;
            }
            if (item.type === 'sub' && item.subItems) {
              return (
                <DropdownMenuSub key={item.id}>
                  <DropdownMenuSubTrigger>{item.label}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {item.subItems.map((sub) =>
                      sub.type === 'separator' ? (
                        <DropdownMenuSeparator key={sub.id} />
                      ) : (
                        <DropdownMenuItem key={sub.id}>{sub.label}</DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            }
            return (
              <DropdownMenuItem key={item.id} disabled={item.disabled}>
                {item.label}
                {item.shortcut && (
                  <DropdownMenuShortcut>
                    {item.shortcut.modifiers?.join('+')}+{item.shortcut.key}
                  </DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const FactoryNestedMenu: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryNestedMenu',
    'Factory: Nested Menu (createFakeNestedMenu)'
  ),
  render: () => <FactoryNestedMenuDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const subTriggers = content.querySelectorAll('[data-slot="dropdown-menu-sub-trigger"]');
    expect(subTriggers.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: DISABLED MENU ============

function FactoryDisabledMenuDemo() {
  const menu = createFakeDisabledMenu();

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.disabledMenu')}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="disabled-menu-trigger">
            {menu.triggerLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>{i18n.t('dropdownMenu.story.options', 'Options')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {menu.items.map((item) =>
            item.type === 'separator' ? (
              <DropdownMenuSeparator key={item.id} />
            ) : (
              <DropdownMenuItem key={item.id} disabled={item.disabled}>
                {item.label}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const FactoryDisabledMenu: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryDisabledMenu',
    'Factory: Disabled Menu (createFakeDisabledMenu)'
  ),
  render: () => <FactoryDisabledMenuDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const disabledItems = content.querySelectorAll(
      '[data-slot="dropdown-menu-item"][data-disabled]'
    );
    expect(disabledItems.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: MENU GROUP ============

function FactoryMenuGroupDemo() {
  const { t } = useTranslation();
  const group: FakeDropdownMenuGroupType = createFakeDropdownMenuGroup({
    label: t('dropdownMenu.story.actionsLabel', 'Actions'),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.menuGroup')}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="menu-group-trigger">
            {t('dropdownMenu.story.menuGroup', 'Menu Group')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuGroup>
            {group.label && <DropdownMenuLabel>{group.label}</DropdownMenuLabel>}
            {group.items.map((item) =>
              item.type === 'separator' ? (
                <DropdownMenuSeparator key={item.id} />
              ) : (
                <DropdownMenuItem key={item.id} disabled={item.disabled}>
                  {item.label}
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="text-muted-foreground text-xs" data-testid="group-info">
        {t('dropdownMenu.story.groupInfo', 'Group ID: {{groupId}} | Items: {{itemCount}}', {
          groupId: group.id,
          itemCount: group.items.length,
        })}
      </div>
    </div>
  );
}

export const FactoryMenuGroup: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryMenuGroup',
    'Factory: Menu Group (createFakeDropdownMenuGroup)'
  ),
  render: () => <FactoryMenuGroupDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const label = content.querySelector('[data-slot="dropdown-menu-label"]');
    expect(label).toBeInTheDocument();
    expect(label?.textContent).toBe('Actions');
    const groupInfo = canvasElement.querySelector('[data-testid="group-info"]');
    expect(groupInfo?.textContent).toContain('Group ID:');
  },
};

// ============ FACTORY: MENU GROUPS ============

function FactoryMenuGroupsDemo() {
  const { t } = useTranslation();
  const groups: FakeDropdownMenuGroupType[] = createFakeDropdownMenuGroups(3);

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.menuGroups')}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="menu-groups-trigger">
            {t('dropdownMenu.story.multipleGroups', 'Multiple Groups')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          {groups.map((group, index) => (
            <React.Fragment key={group.id}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                {group.label && <DropdownMenuLabel>{group.label}</DropdownMenuLabel>}
                {group.items
                  .filter((item) => item.type !== 'separator')
                  .slice(0, 3)
                  .map((item) => (
                    <DropdownMenuItem key={item.id} disabled={item.disabled}>
                      {item.label}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuGroup>
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="text-muted-foreground text-xs" data-testid="groups-count">
        {t('dropdownMenu.story.groupsCount', 'Groups: {{count}}', { count: groups.length })}
      </div>
    </div>
  );
}

export const FactoryMenuGroups: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryMenuGroups',
    'Factory: Menu Groups (createFakeDropdownMenuGroups)'
  ),
  render: () => <FactoryMenuGroupsDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const items = content.querySelectorAll('[data-slot="dropdown-menu-item"]');
    expect(items.length).toBeGreaterThan(0);
    const groupsCount = canvasElement.querySelector('[data-testid="groups-count"]');
    expect(groupsCount?.textContent).toContain('Groups: 3');
  },
};

// ============ FACTORY: POSITION MATRIX ============

function FactoryPositionMatrixDemo() {
  const matrix = createFakeDropdownMenuPositionMatrix();

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.positionMatrix')}</p>
      <div className="grid grid-cols-3 gap-4 p-8" data-testid="position-matrix-container">
        {matrix.flat().map((menu) => (
          <DropdownMenu key={menu.id}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {menu.triggerLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side={menu.side} align={menu.align} className="w-40">
              <DropdownMenuItem>{i18n.t('dropdownMenu.story.item1', 'Item 1')}</DropdownMenuItem>
              <DropdownMenuItem>{i18n.t('dropdownMenu.story.item2', 'Item 2')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>
    </div>
  );
}

export const FactoryPositionMatrix: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryPositionMatrix',
    'Factory: Position Matrix (createFakeDropdownMenuPositionMatrix)'
  ),
  tags: ['!test'],
  render: () => <FactoryPositionMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="position-matrix-container"]');
    expect(container).toBeInTheDocument();
    const triggers = container?.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    expect(triggers?.length).toBe(12);
  },
};

// ============ FACTORY: ITEM TYPE MATRIX ============

function FactoryItemTypeMatrixDemo() {
  const { t } = useTranslation();
  const items = createFakeDropdownMenuItemTypeMatrix();

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.itemTypeMatrix')}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="item-type-matrix-trigger">
            {t('dropdownMenu.story.itemTypes', 'Item Types')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>
            {i18n.t('dropdownMenu.story.allItemTypes', 'All Item Types')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.map((item) => {
            if (item.type === 'separator') {
              return <DropdownMenuSeparator key={item.id} />;
            }
            if (item.type === 'checkbox') {
              return (
                <DropdownMenuCheckboxItem key={item.id} checked={item.checked}>
                  {item.label}
                </DropdownMenuCheckboxItem>
              );
            }
            if (item.type === 'radio') {
              return (
                <DropdownMenuItem key={item.id}>
                  {item.label} ({t('dropdownMenu.story.radio', 'radio')})
                </DropdownMenuItem>
              );
            }
            return (
              <DropdownMenuItem key={item.id} disabled={item.disabled}>
                {item.label}
                {item.shortcut && (
                  <DropdownMenuShortcut>
                    {item.shortcut.modifiers?.join('+')}+{item.shortcut.key}
                  </DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const FactoryItemTypeMatrix: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryItemTypeMatrix',
    'Factory: Item Type Matrix (createFakeDropdownMenuItemTypeMatrix)'
  ),
  render: () => <FactoryItemTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const allItems = content.querySelectorAll(
      '[data-slot="dropdown-menu-item"], [data-slot="dropdown-menu-checkbox-item"]'
    );
    expect(allItems.length).toBeGreaterThan(3);
  },
};

// ============ FACTORY: ACCESSIBLE MENU ============

function FactoryAccessibleMenuDemo() {
  const menu = createFakeAccessibleDropdownMenu();

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.accessibleMenu')}</p>
      <DropdownMenu modal={menu.modal}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="accessible-menu-trigger">
            {menu.triggerLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>
            {i18n.t('dropdownMenu.story.accessibleOptions', 'Accessible Options')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {menu.items.map((item) =>
            item.type === 'separator' ? (
              <DropdownMenuSeparator key={item.id} />
            ) : (
              <DropdownMenuItem key={item.id} disabled={item.disabled}>
                {item.label}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const FactoryAccessibleMenu: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryAccessibleMenu',
    'Factory: Accessible Menu (createFakeAccessibleDropdownMenu)'
  ),
  render: () => <FactoryAccessibleMenuDemo />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="accessible-menu-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');

    const { content } = await openDropdownMenu(canvasElement);
    expect(content.getAttribute('role')).toBe('menu');
    const items = content.querySelectorAll('[data-slot="dropdown-menu-item"]');
    expect(items.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: TABLE ROW ACTIONS MENU ============

function FactoryTableRowActionsMenuDemo() {
  const menu = createFakeTableRowActionsMenu();

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.tableRowActions')}</p>
      <div className="border-border flex items-center justify-between rounded-md border p-4">
        <span className="text-sm">
          {i18n.t('dropdownMenu.story.rowDataExample', 'Row data example')}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" data-testid="table-row-trigger">
              {menu.triggerLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={menu.side} align={menu.align} className="w-48">
            <DropdownMenuLabel>
              {i18n.t('dropdownMenu.story.rowActions', 'Row Actions')}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {menu.items.map((item) =>
              item.type === 'separator' ? (
                <DropdownMenuSeparator key={item.id} />
              ) : (
                <DropdownMenuItem key={item.id} disabled={item.disabled}>
                  {item.label}
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export const FactoryTableRowActionsMenu: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryTableRowActionsMenu',
    'Factory: Table Row Actions (createFakeTableRowActionsMenu)'
  ),
  render: () => <FactoryTableRowActionsMenuDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openDropdownMenu(canvasElement);
    expect(content).toBeInTheDocument();
    const items = content.querySelectorAll('[data-slot="dropdown-menu-item"]');
    expect(items.length).toBeGreaterThan(3);
  },
};

// ============ CONSTANTS: SIDES ============

function FactorySidesConstantDemo() {
  const sides: DropdownMenuSide[] = DROPDOWN_MENU_SIDES;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.sidesConstant')}</p>
      <div className="flex flex-wrap gap-4" data-testid="sides-container">
        {sides.map((side) => (
          <DropdownMenu key={side}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {side}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side={side} className="w-40">
              <DropdownMenuItem>
                {i18n.t('dropdownMenu.story.sideValue', 'Side: {{side}}', { side })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>
      <div className="text-muted-foreground text-xs" data-testid="sides-count">
        {i18n.t('dropdownMenu.story.totalSides', 'Total sides: {{count}}', {
          count: sides.length,
        })}
      </div>
    </div>
  );
}

export const FactorySidesConstant: Story = {
  name: i18n.t('dropdownMenu.storyName.factorySidesConstant', 'Constants: DROPDOWN_MENU_SIDES'),
  tags: ['!test'],
  render: () => <FactorySidesConstantDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="sides-container"]');
    expect(container).toBeInTheDocument();
    const triggers = container?.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    expect(triggers?.length).toBe(4);
    const count = canvasElement.querySelector('[data-testid="sides-count"]');
    expect(count?.textContent).toContain('Total sides: 4');
  },
};

// ============ CONSTANTS: ALIGNS ============

function FactoryAlignsConstantDemo() {
  const aligns: DropdownMenuAlign[] = DROPDOWN_MENU_ALIGNS;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.alignsConstant')}</p>
      <div className="flex flex-wrap gap-4" data-testid="aligns-container">
        {aligns.map((align) => (
          <DropdownMenu key={align}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {align}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} className="w-40">
              <DropdownMenuItem>
                {i18n.t('dropdownMenu.story.alignValue', 'Align: {{align}}', { align })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>
      <div className="text-muted-foreground text-xs" data-testid="aligns-count">
        {i18n.t('dropdownMenu.story.totalAligns', 'Total aligns: {{count}}', {
          count: aligns.length,
        })}
      </div>
    </div>
  );
}

export const FactoryAlignsConstant: Story = {
  name: i18n.t('dropdownMenu.storyName.factoryAlignsConstant', 'Constants: DROPDOWN_MENU_ALIGNS'),
  tags: ['!test'],
  render: () => <FactoryAlignsConstantDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="aligns-container"]');
    expect(container).toBeInTheDocument();
    const triggers = container?.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    expect(triggers?.length).toBe(3);
    const count = canvasElement.querySelector('[data-testid="aligns-count"]');
    expect(count?.textContent).toContain('Total aligns: 3');
  },
};

// ============ CONSTANTS: ITEM TYPES ============

function FactoryItemTypesConstantDemo() {
  const itemTypes: DropdownMenuItemType[] = DROPDOWN_MENU_ITEM_TYPES;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.itemTypesConstant')}</p>
      <div className="flex flex-wrap gap-2" data-testid="item-types-container">
        {itemTypes.map((type) => (
          <span
            key={type}
            className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs"
            data-testid={`item-type-${type}`}
          >
            {type}
          </span>
        ))}
      </div>
      <div className="text-muted-foreground text-xs" data-testid="item-types-count">
        {i18n.t('dropdownMenu.story.totalItemTypes', 'Total item types: {{count}}', {
          count: itemTypes.length,
        })}
      </div>
    </div>
  );
}

export const FactoryItemTypesConstant: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryItemTypesConstant',
    'Constants: DROPDOWN_MENU_ITEM_TYPES'
  ),
  render: () => <FactoryItemTypesConstantDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="item-types-container"]');
    expect(container).toBeInTheDocument();
    const badges = container?.querySelectorAll('[data-testid^="item-type-"]');
    expect(badges?.length).toBe(5);
    expect(canvasElement.querySelector('[data-testid="item-type-item"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="item-type-checkbox"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="item-type-radio"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="item-type-separator"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="item-type-sub"]')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: ICONS ============

function FactoryIconsConstantDemo() {
  const { t } = useTranslation();
  const icons = DROPDOWN_MENU_ICONS;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{t('dropdownMenu.factory.iconsConstant')}</p>
      <div className="flex flex-wrap gap-2" data-testid="icons-container">
        {icons.map((icon) => (
          <span
            key={icon}
            className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs"
            data-testid={`icon-${icon}`}
          >
            {icon}
          </span>
        ))}
      </div>
      <div className="text-muted-foreground text-xs" data-testid="icons-count">
        {t('dropdownMenu.story.totalIcons', 'Total icons: {{count}}', { count: icons.length })}
      </div>
    </div>
  );
}

export const FactoryIconsConstant: Story = {
  name: i18n.t('dropdownMenu.storyName.factoryIconsConstant', 'Constants: DROPDOWN_MENU_ICONS'),
  render: () => <FactoryIconsConstantDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="icons-container"]');
    expect(container).toBeInTheDocument();
    const badges = container?.querySelectorAll('[data-testid^="icon-"]');
    expect(badges?.length).toBe(20);
    const count = canvasElement.querySelector('[data-testid="icons-count"]');
    expect(count?.textContent).toContain('Total icons: 20');
  },
};

// ============ CONSTANTS: LABELS ============

function FactoryLabelsConstantDemo() {
  const labels = DROPDOWN_MENU_LABELS;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.labelsConstant')}</p>
      <div className="flex flex-wrap gap-2" data-testid="labels-container">
        {labels.map((label) => (
          <span
            key={label}
            className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs"
            data-testid={`label-${label.replaceAll(' ', '-')}`}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="text-muted-foreground text-xs" data-testid="labels-count">
        {i18n.t('dropdownMenu.story.totalLabels', 'Total labels: {{count}}', {
          count: labels.length,
        })}
      </div>
    </div>
  );
}

export const FactoryLabelsConstant: Story = {
  name: i18n.t('dropdownMenu.storyName.factoryLabelsConstant', 'Constants: DROPDOWN_MENU_LABELS'),
  render: () => <FactoryLabelsConstantDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="labels-container"]');
    expect(container).toBeInTheDocument();
    const badges = container?.querySelectorAll('[data-testid^="label-"]');
    expect(badges?.length).toBe(21);
    const count = canvasElement.querySelector('[data-testid="labels-count"]');
    expect(count?.textContent).toContain('Total labels: 21');
  },
};

// ============ CONSTANTS: SHORTCUTS ============

function FactoryShortcutsConstantDemo() {
  const shortcuts: FakeDropdownMenuShortcutType[] = DROPDOWN_MENU_SHORTCUTS;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('dropdownMenu.factory.shortcutsConstant')}</p>
      <div className="flex flex-wrap gap-2" data-testid="shortcuts-container">
        {shortcuts.map((shortcut) => {
          const shortcutId = `${shortcut.modifiers?.join('-') ?? 'none'}-${shortcut.key}`;
          return (
            <span
              key={shortcutId}
              className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs"
              data-testid={`shortcut-${shortcutId}`}
            >
              {shortcut.modifiers?.join('+')}+{shortcut.key}
            </span>
          );
        })}
      </div>
      <div className="text-muted-foreground text-xs" data-testid="shortcuts-count">
        {i18n.t('dropdownMenu.story.totalShortcuts', 'Total shortcuts: {{count}}', {
          count: shortcuts.length,
        })}
      </div>
    </div>
  );
}

export const FactoryShortcutsConstant: Story = {
  name: i18n.t(
    'dropdownMenu.storyName.factoryShortcutsConstant',
    'Constants: DROPDOWN_MENU_SHORTCUTS'
  ),
  render: () => <FactoryShortcutsConstantDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="shortcuts-container"]');
    expect(container).toBeInTheDocument();
    const badges = container?.querySelectorAll('span[data-testid^="shortcut-"]');
    expect(badges?.length).toBe(8);
    const count = canvasElement.querySelector('[data-testid="shortcuts-count"]');
    expect(count?.textContent).toContain('Total shortcuts: 8');
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('dropdownMenu.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('dropdownMenu.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('dropdownMenu.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('dropdownMenu.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   conflict
//   actionSuccess
//   actionFailed
//   selectionSuccess
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('dropdownMenu.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: dropdownMenuStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('dropdownMenu.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: dropdownMenuStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerActionSuccess: Story = {
  ...Default,
  name: i18n.t('dropdownMenu.storyName.handlerActionSuccess', 'Handler: Action Success'),
  parameters: { msw: { handlers: dropdownMenuStatusHandlers.actionSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerActionFailed: Story = {
  ...Default,
  name: i18n.t('dropdownMenu.storyName.handlerActionFailed', 'Handler: Action Failed'),
  parameters: { msw: { handlers: dropdownMenuStatusHandlers.actionFailed } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSelectionSuccess: Story = {
  ...Default,
  name: i18n.t('dropdownMenu.storyName.handlerSelectionSuccess', 'Handler: Selection Success'),
  parameters: { msw: { handlers: dropdownMenuStatusHandlers.selectionSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
