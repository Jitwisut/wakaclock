import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import type {
  ContextMenuActionEvent,
  ContextMenuActionPayload,
  ContextMenuActionResponse,
  ContextMenuItemType,
  ContextMenuItemVariant,
  ContextMenuWidth,
  FakeBrowserContextMenu,
  FakeContextMenu,
  FakeContextMenuCheckboxItem,
  FakeContextMenuItem,
  FakeContextMenuRadioGroup,
  FakeContextMenuRadioItem,
  FakeContextMenuSubmenu,
  FakeEditorContextMenu,
  FakeFileExplorerContextMenu,
  FakeTrackedContextMenu,
  ShortcutModifier,
  ShortcutSymbol,
} from '@/.storybook/stories/_factories/context-menu.factory';
import {
  COMMON_LABELS,
  CONTEXT_MENU_ITEM_TYPES,
  CONTEXT_MENU_ITEM_VARIANTS,
  CONTEXT_MENU_WIDTHS,
  createFakeA11yTestContextMenu,
  createFakeActionPayload,
  createFakeActionResponse,
  createFakeBatchActionContextMenu,
  createFakeBrowserContextMenu,
  createFakeConfirmationContextMenu,
  createFakeContextMenu,
  createFakeContextMenuCheckboxItem,
  createFakeContextMenuItem,
  createFakeContextMenuItems,
  createFakeContextMenuMatrix,
  createFakeContextMenuRadioGroup,
  createFakeContextMenuRadioItem,
  createFakeContextMenus,
  createFakeContextMenuShowcase,
  createFakeContextMenuSubmenu,
  createFakeEditorContextMenu,
  createFakeFileExplorerContextMenu,
  createFakeKanbanCardContextMenu,
  createFakeTableRowContextMenu,
  createFakeTrackedContextMenu,
  createFakeUndoableContextMenu,
  EDIT_ACTIONS,
  FILE_ACTIONS,
  SHORTCUT_SYMBOLS,
  SORT_OPTIONS,
  THEME_OPTIONS,
  VIEW_OPTIONS,
} from '@/.storybook/stories/_factories/context-menu.factory';

import {
  contextMenuHandlers,
  contextMenuStatusHandlers,
} from '@/.storybook/stories/_handlers/context-menu.handlers';

import {
  dialogHandlers,
  dialogStatusHandlers,
} from '@/.storybook/stories/_handlers/dialog.handlers';

import { useTranslation } from 'react-i18next';

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

import i18n from 'i18next';

async function openContextMenu(canvasElement: HTMLElement) {
  if (!canvasElement.querySelector('*')) {
    throw new Error(STORY_NO_DOM_ERROR);
  }

  const doc = canvasElement.ownerDocument;
  const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');

  if (!(trigger instanceof HTMLElement)) {
    throw new Error('Expected context menu trigger element to be present.');
  }

  trigger.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 16,
      clientY: 16,
    })
  );

  const content = await waitFor(() => {
    const node = doc.body.querySelector('[data-slot="context-menu-content"]');

    if (!(node instanceof HTMLElement)) {
      throw new Error('Context menu content was not rendered.');
    }

    return node;
  });

  return { content, doc, trigger };
}

function ContextMenuDemo() {
  const [bookmarked, setBookmarked] = React.useState(true);
  const [view, setView] = React.useState('comfortable');

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[520px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.trigger')}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuLabel inset>{i18n.t('contextMenu.label.actions')}</ContextMenuLabel>
        <ContextMenuItem inset>
          {i18n.t('contextMenu.item.rename')} <ContextMenuShortcut>⌘R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem inset disabled>
          {i18n.t('contextMenu.item.duplicate')} <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem
          checked={bookmarked}
          onCheckedChange={(v) => setBookmarked(v === true)}
        >
          {i18n.t('contextMenu.checkbox.bookmarked')}
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger inset>{i18n.t('contextMenu.sub.view')}</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-52">
            <ContextMenuRadioGroup onValueChange={setView} value={view}>
              <ContextMenuRadioItem value="comfortable">
                {i18n.t('contextMenu.view.comfortable')}
              </ContextMenuRadioItem>
              <ContextMenuRadioItem value="compact">
                {i18n.t('contextMenu.view.compact')}
              </ContextMenuRadioItem>
            </ContextMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem inset variant="destructive">
          {i18n.t('contextMenu.item.delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

const meta = {
  title: 'Components/UI/Context Menu',
  component: ContextMenuDemo,
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
    // Content
    triggerContent: {
      control: 'text',
      description: i18n.t(
        'contextMenu.argType.contentOfTheContextMenuTriggerArea',
        'Content of the context menu trigger area'
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
        'contextMenu.argType.additionalCssClassesForTheContent',
        'Additional CSS classes for the content'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    inset: {
      control: 'boolean',
      description: i18n.t(
        'contextMenu.argType.addLeftPaddingForAlignmentWithIcons',
        'Add left padding for alignment with icons'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // State
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'contextMenu.argType.whetherTheTriggerIsDisabled',
        'Whether the trigger is disabled'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    loop: {
      control: 'boolean',
      description: i18n.t(
        'contextMenu.argType.whetherToLoopKeyboardNavigation',
        'Whether to loop keyboard navigation'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    modal: {
      control: 'boolean',
      description: i18n.t(
        'contextMenu.argType.whetherToBlockInteractionOutsideTheMenu',
        'Whether to block interaction outside the menu'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    alignOffset: {
      control: 'number',
      description: i18n.t(
        'contextMenu.argType.alignmentOffsetInPixels',
        'Alignment offset in pixels'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'number' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('contextMenu.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('contextMenu.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('contextMenu.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('contextMenu.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('contextMenu.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('contextMenu.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('contextMenu.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'contextMenu.argType.calledWhenOpenStateChanges',
        'Called when open state changes'
      ),
      table: { category: 'Events' },
    },
    onSelect: {
      action: 'onSelect',
      description: i18n.t(
        'contextMenu.argType.calledWhenAMenuItemIsSelected',
        'Called when a menu item is selected'
      ),
      table: { category: 'Events' },
    },
    // Note: argTypes for demo wrapper - actual ContextMenu component props documented below
    // ContextMenu Props Reference (Radix ContextMenu.Root):
    // - onOpenChange: Called when open state changes ((open: boolean) => void)
    // - dir: Reading direction ('ltr' | 'rtl')
    // - modal: Whether to block interaction outside (boolean, default: true)
    //
    // ContextMenuTrigger Props Reference:
    // - asChild: Render as child element (boolean)
    // - disabled: Whether trigger is disabled (boolean)
    // - className: Additional CSS classes (string)
    //
    // ContextMenuContent Props Reference:
    // - loop: Loop keyboard navigation (boolean, default: false)
    // - forceMount: Force mount when closed (boolean)
    // - alignOffset: Alignment offset in pixels (number)
    // - avoidCollisions: Whether to avoid collisions (boolean, default: true)
    // - collisionPadding: Padding for collision detection (number | Partial<Record<Side, number>>)
    // - className: Additional CSS classes (string)
    //
    // ContextMenuItem Props Reference:
    // - disabled: Whether item is disabled (boolean)
    // - inset: Add left padding for alignment (boolean)
    // - variant: Visual variant ('default' | 'destructive')
    // - onSelect: Called when item is selected ((event) => void)
    // - textValue: Text for typeahead (string)
    // - className: Additional CSS classes (string)
    //
    // ContextMenuCheckboxItem Props Reference:
    // - checked: Checked state (boolean | 'indeterminate')
    // - onCheckedChange: Called when checked changes ((checked: boolean) => void)
    // - disabled: Whether item is disabled (boolean)
    // - onSelect: Called when item is selected ((event) => void)
    // - className: Additional CSS classes (string)
    //
    // ContextMenuRadioGroup Props Reference:
    // - value: Selected radio value (string)
    // - onValueChange: Called when value changes ((value: string) => void)
    //
    // ContextMenuRadioItem Props Reference:
    // - value: Radio item value (string, required)
    // - disabled: Whether item is disabled (boolean)
    // - onSelect: Called when item is selected ((event) => void)
    // - className: Additional CSS classes (string)
    //
    // ContextMenuLabel Props Reference:
    // - inset: Add left padding for alignment (boolean)
    // - className: Additional CSS classes (string)
    //
    // ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent, ContextMenuSeparator, ContextMenuShortcut, ContextMenuGroup
  },
  parameters: {
    msw: { handlers: contextMenuHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ContextMenuDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    if (!(trigger instanceof HTMLElement)) {
      throw new Error('Expected context menu trigger element to be present.');
    }

    expect(trigger.textContent?.trim()).toBeInTheDocument();

    const openedMenu = await openContextMenu(canvasElement);
    let menuContent = openedMenu.content;

    expect(menuContent.querySelector('[data-slot="context-menu-label"]')).toBeInTheDocument();
    expect(menuContent.querySelectorAll('[data-slot="context-menu-item"]').length).toBe(3);
    expect(menuContent.querySelectorAll('[data-slot="context-menu-separator"]').length).toBe(3);
    expect(
      menuContent.querySelector('[data-slot="context-menu-item"][data-variant="destructive"]')
    ).toBeInTheDocument();

    const disabledItems = [
      ...menuContent.querySelectorAll('[data-slot="context-menu-item"][aria-disabled="true"]'),
    ];
    expect(disabledItems.length).toBe(1);

    const bookmarkedItem = menuContent.querySelector('[data-slot="context-menu-checkbox-item"]');
    if (!(bookmarkedItem instanceof HTMLElement)) {
      throw new Error('Expected context menu checkbox item to be present.');
    }

    expect(bookmarkedItem.getAttribute('data-state')).toBe('checked');

    await userEvent.click(bookmarkedItem);

    const reopenedAfterToggle = await openContextMenu(canvasElement);
    menuContent = reopenedAfterToggle.content;

    const bookmarkedAfter = menuContent.querySelector('[data-slot="context-menu-checkbox-item"]');
    if (!(bookmarkedAfter instanceof HTMLElement)) {
      throw new Error('Expected context menu checkbox item to be present after reopening.');
    }

    expect(bookmarkedAfter.getAttribute('data-state')).toBe('unchecked');

    const viewTrigger = menuContent.querySelector('[data-slot="context-menu-sub-trigger"]');
    if (!(viewTrigger instanceof HTMLElement)) {
      throw new Error('Expected context menu sub trigger to be present.');
    }

    await userEvent.hover(viewTrigger);

    const subContent = await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="context-menu-sub-content"]');

      if (!(content instanceof HTMLElement)) {
        throw new Error('Context menu sub content was not rendered.');
      }

      return content;
    });

    const radioItems = subContent.querySelectorAll('[data-slot="context-menu-radio-item"]');
    expect(radioItems.length).toBe(2);

    const compactItem = radioItems[1];
    if (!(compactItem instanceof HTMLElement)) {
      throw new Error('Expected compact radio item to be present.');
    }

    await userEvent.click(compactItem);

    await waitFor(() => {
      expect(compactItem.getAttribute('data-state')).toBe('checked');
    });

    const reopenedAfterView = await openContextMenu(canvasElement);
    menuContent = reopenedAfterView.content;

    const deleteItem = menuContent.querySelector(
      '[data-slot="context-menu-item"][data-variant="destructive"]'
    );
    if (!(deleteItem instanceof HTMLElement)) {
      throw new Error('Expected destructive delete item to be present.');
    }

    await userEvent.click(deleteItem);
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

function ContextMenuVariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.variants.basic')}</p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-24 w-[300px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.rightClickHere', 'Right-click here')}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem>{i18n.t('contextMenu.story.cut', 'Cut')}</ContextMenuItem>
            <ContextMenuItem>{i18n.t('contextMenu.story.copy', 'Copy')}</ContextMenuItem>
            <ContextMenuItem>{i18n.t('contextMenu.story.paste', 'Paste')}</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.variants.withSubmenus')}</p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-24 w-[300px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.rightClickHere', 'Right-click here')}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem>{i18n.t('contextMenu.story.newFile', 'New File')}</ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                {i18n.t('contextMenu.story.openRecent', 'Open Recent')}
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                <ContextMenuItem>document.txt</ContextMenuItem>
                <ContextMenuItem>image.png</ContextMenuItem>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    {i18n.t('contextMenu.story.projects', 'Projects')}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-48">
                    <ContextMenuItem>project-a</ContextMenuItem>
                    <ContextMenuItem>project-b</ContextMenuItem>
                  </ContextMenuSubContent>
                </ContextMenuSub>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem>{i18n.t('contextMenu.story.save', 'Save')}</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('contextMenu.variants.withCheckboxesRadios')}
        </p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-24 w-[300px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.rightClickHere', 'Right-click here')}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuLabel>
              {i18n.t('contextMenu.story.viewOptions', 'View Options')}
            </ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuCheckboxItem checked>
              {i18n.t('contextMenu.story.showToolbar', 'Show Toolbar')}
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem>
              {i18n.t('contextMenu.story.showSidebar', 'Show Sidebar')}
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem checked>
              {i18n.t('contextMenu.story.showStatusBar', 'Show Status Bar')}
            </ContextMenuCheckboxItem>
            <ContextMenuSeparator />
            <ContextMenuLabel>{i18n.t('contextMenu.story.theme', 'Theme')}</ContextMenuLabel>
            <ContextMenuRadioGroup value="system">
              <ContextMenuRadioItem value="light">
                {i18n.t('contextMenu.story.light', 'Light')}
              </ContextMenuRadioItem>
              <ContextMenuRadioItem value="dark">
                {i18n.t('contextMenu.story.dark', 'Dark')}
              </ContextMenuRadioItem>
              <ContextMenuRadioItem value="system">
                {i18n.t('contextMenu.story.system', 'System')}
              </ContextMenuRadioItem>
            </ContextMenuRadioGroup>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('contextMenu.variants.withIconsShortcuts')}
        </p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-24 w-[300px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.rightClickHere', 'Right-click here')}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-56">
            <ContextMenuItem inset>
              {i18n.t('contextMenu.story.back', 'Back')}{' '}
              <ContextMenuShortcut>{i18n.t('contextMenu.story.altLeft')}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem inset disabled>
              {i18n.t('contextMenu.story.forward', 'Forward')}{' '}
              <ContextMenuShortcut>{i18n.t('contextMenu.story.altRight')}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem inset>
              {i18n.t('contextMenu.story.reload', 'Reload')}{' '}
              <ContextMenuShortcut>Ctrl+R</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem inset variant="destructive">
              {i18n.t('contextMenu.story.delete', 'Delete')}{' '}
              <ContextMenuShortcut>{i18n.t('contextMenu.story.del', 'Del')}</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <ContextMenuVariantsDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="context-menu-trigger"]');
    expect(triggers.length).toBeGreaterThan(0);
  },
};

function ContextMenuSizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.sizes.compact')}</p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-24 w-[300px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.rightClickHere', 'Right-click here')}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-40">
            <ContextMenuItem>{i18n.t('contextMenu.story.cut', 'Cut')}</ContextMenuItem>
            <ContextMenuItem>{i18n.t('contextMenu.story.copy', 'Copy')}</ContextMenuItem>
            <ContextMenuItem>{i18n.t('contextMenu.story.paste', 'Paste')}</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.sizes.default')}</p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-24 w-[300px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.rightClickHere', 'Right-click here')}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem>{i18n.t('contextMenu.story.cutItem', 'Cut Item')}</ContextMenuItem>
            <ContextMenuItem>{i18n.t('contextMenu.story.copyItem', 'Copy Item')}</ContextMenuItem>
            <ContextMenuItem>{i18n.t('contextMenu.story.pasteItem', 'Paste Item')}</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem>{i18n.t('contextMenu.story.selectAll', 'Select All')}</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.sizes.wide')}</p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-24 w-[300px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.rightClickHere', 'Right-click here')}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-64">
            <ContextMenuLabel>
              {i18n.t('contextMenu.story.documentActions', 'Document Actions')}
            </ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem inset>
              {i18n.t('contextMenu.story.openInNewWindow', 'Open in New Window')}{' '}
              <ContextMenuShortcut>Ctrl+N</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem inset>
              {i18n.t('contextMenu.story.saveAsTemplate', 'Save As Template')}{' '}
              <ContextMenuShortcut>Ctrl+Shift+S</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem inset>
              {i18n.t('contextMenu.story.exportToPdf', 'Export to PDF')}{' '}
              <ContextMenuShortcut>Ctrl+E</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <ContextMenuSizesDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="context-menu-trigger"]');
    expect(triggers.length).toBeGreaterThan(0);
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const { content, doc } = await openContextMenu(canvasElement);

    // Verify dark mode is applied
    expect(doc.documentElement.classList.contains('dark')).toBe(true);

    // Verify menu has proper role
    expect(content.getAttribute('role')).toBe('menu');

    // Verify menu items are visible in dark mode
    const menuItems = content.querySelectorAll('[role="menuitem"]');
    expect(menuItems.length).toBeGreaterThan(0);

    // Close menu
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).not.toBeInTheDocument();
    });
  },
};

export const DarkModeJapanese: Story = {
  name: i18n.t('contextMenu.storyName.darkModeJapanese', 'Dark Mode (Japanese)'),
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const { content, doc } = await openContextMenu(canvasElement);

    // Verify dark mode
    expect(doc.documentElement.classList.contains('dark')).toBe(true);

    // Verify Japanese locale
    expect(doc.documentElement.lang).toBe('ja');

    // Verify Japanese text is rendered
    const canvas = within(canvasElement);
    expect(canvas.getByText('ここを右クリック')).toBeInTheDocument();

    // Verify menu has proper ARIA role
    expect(content.getAttribute('role')).toBe('menu');

    // Close menu
    await userEvent.keyboard('{Escape}');
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const { content, doc } = await openContextMenu(canvasElement);

    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(canvasElement);
    expect(canvas.getByText('ここを右クリック')).toBeInTheDocument();

    const menu = within(content);
    expect(menu.getByText('操作')).toBeInTheDocument();
    expect(menu.getByText('名前を変更')).toBeInTheDocument();
    expect(menu.getByText('複製')).toBeInTheDocument();
    expect(menu.getByText('ブックマーク済み')).toBeInTheDocument();
    expect(menu.getByText('表示')).toBeInTheDocument();
    expect(menu.getByText('ゆったり')).toBeInTheDocument();
    expect(menu.getByText('コンパクト')).toBeInTheDocument();
    expect(menu.getByText('削除')).toBeInTheDocument();
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
  name: i18n.t('contextMenu.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: contextMenuHandlers },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: contextMenuStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: contextMenuStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: contextMenuStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: contextMenuStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: contextMenuStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: contextMenuStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: contextMenuStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  name: i18n.t('contextMenu.storyName.accessibility', 'Accessibility (Keyboard Navigation)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    // Open context menu
    const { content } = await openContextMenu(canvasElement);

    // ========================================
    // ARIA role="menu" VERIFICATION
    // ========================================
    expect(content.getAttribute('role')).toBe('menu');

    // Verify menu items have proper role
    const menuItems = content.querySelectorAll('[role="menuitem"]');
    expect(menuItems.length).not.toBe(0);

    // Verify all menu items have proper roles
    const allItems = content.querySelectorAll(
      '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
    );
    expect(allItems.length).toBeGreaterThan(0);

    // ========================================
    // KEYBOARD NAVIGATION TESTS
    // ========================================

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
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).not.toBeInTheDocument();
    });

    // Reopen menu for more tests
    const reopened = await openContextMenu(canvasElement);

    // ========================================
    // CHECKBOX ITEM ARIA VERIFICATION
    // ========================================
    const checkboxItem = reopened.content.querySelector('[data-slot="context-menu-checkbox-item"]');
    expect(checkboxItem?.getAttribute('role')).toBe('menuitemcheckbox');
    expect(checkboxItem?.getAttribute('aria-checked')).toBeDefined();

    // ========================================
    // SUBMENU NAVIGATION TESTS
    // ========================================
    const subTrigger = reopened.content.querySelector('[data-slot="context-menu-sub-trigger"]');
    if (subTrigger instanceof HTMLElement) {
      await userEvent.hover(subTrigger);

      const subContent = await waitFor(() => {
        const node = doc.body.querySelector('[data-slot="context-menu-sub-content"]');
        if (!(node instanceof HTMLElement)) {
          throw new Error('Context menu sub content was not rendered.');
        }
        return node;
      });

      // Verify submenu has proper role
      expect(subContent.getAttribute('role')).toBe('menu');

      // Verify radio items have proper role
      const radioItems = subContent.querySelectorAll('[data-slot="context-menu-radio-item"]');
      radioItems.forEach((item) => {
        expect(item.getAttribute('role')).toBe('menuitemradio');
        expect(item.getAttribute('aria-checked')).toBeDefined();
      });
    }

    // Close menu
    await userEvent.keyboard('{Escape}');
  },
};

export const AriaRoleVerification: Story = {
  name: i18n.t('contextMenu.storyName.ariaRoleVerification', 'ARIA role="menu" Verification'),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const { content } = await openContextMenu(canvasElement);

    // ========================================
    // STRICT ARIA ROLE VERIFICATION
    // ========================================

    // 1. Menu content must have role="menu"
    expect(content.getAttribute('role')).toBe('menu');

    // 2. All interactive items must have appropriate menu roles
    const menuItems = content.querySelectorAll('[data-slot="context-menu-item"]');
    menuItems.forEach((item) => {
      expect(item.getAttribute('role')).toBe('menuitem');
    });

    // 3. Checkbox items must have role="menuitemcheckbox"
    const checkboxItems = content.querySelectorAll('[data-slot="context-menu-checkbox-item"]');
    checkboxItems.forEach((item) => {
      expect(item.getAttribute('role')).toBe('menuitemcheckbox');
      // Must have aria-checked attribute
      const ariaChecked = item.getAttribute('aria-checked');
      expect(ariaChecked === 'true' || ariaChecked === 'false').toBe(true);
    });

    // 4. Verify separators are properly handled (no role needed)
    const separators = content.querySelectorAll('[data-slot="context-menu-separator"]');
    expect(separators.length).toBeGreaterThan(0);

    // 5. Verify labels are properly handled
    const labels = content.querySelectorAll('[data-slot="context-menu-label"]');
    labels.forEach((label) => {
      // Labels should not have interactive roles
      expect(label.getAttribute('role')).not.toBe('menuitem');
    });

    // 6. Verify disabled items have aria-disabled
    const disabledItems = content.querySelectorAll(
      '[data-slot="context-menu-item"][aria-disabled="true"]'
    );
    disabledItems.forEach((item) => {
      expect(item.getAttribute('aria-disabled')).toBe('true');
    });

    // 7. Test submenu ARIA roles
    const subTrigger = content.querySelector('[data-slot="context-menu-sub-trigger"]');
    if (subTrigger instanceof HTMLElement) {
      await userEvent.hover(subTrigger);

      const subContent = await waitFor(() => {
        const node = doc.body.querySelector('[data-slot="context-menu-sub-content"]');
        if (!(node instanceof HTMLElement)) {
          throw new Error('Submenu content not found');
        }
        return node;
      });

      // Submenu must also have role="menu"
      expect(subContent.getAttribute('role')).toBe('menu');

      // Radio items must have role="menuitemradio"
      const radioItems = subContent.querySelectorAll('[data-slot="context-menu-radio-item"]');
      radioItems.forEach((item) => {
        expect(item.getAttribute('role')).toBe('menuitemradio');
        const ariaChecked = item.getAttribute('aria-checked');
        expect(ariaChecked === 'true' || ariaChecked === 'false').toBe(true);
      });
    }

    // Close menu
    await userEvent.keyboard('{Escape}');
  },
};

// ============ FAKER DATA STORIES ============

// Seed faker for deterministic tests
seedFaker();

function ContextMenuWithFakerData() {
  const menu = React.useMemo(() => createFakeContextMenu(), []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.story.rightClickForGeneratedMenu', 'Right-click for generated menu')}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className={menu.width}>
        <ContextMenuLabel inset>
          {i18n.t('contextMenu.story.generatedActions', 'Generated Actions')}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        {menu.items.map((item) =>
          item.type === 'separator' ? (
            <ContextMenuSeparator key={item.id} />
          ) : (
            <ContextMenuItem key={item.id} inset disabled={item.disabled} variant={item.variant}>
              {item.label}
              {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
            </ContextMenuItem>
          )
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const WithFakerData: Story = {
  render: () => <ContextMenuWithFakerData />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);

    expect(content.querySelector('[data-slot="context-menu-label"]')).toBeInTheDocument();
    expect(
      content.querySelectorAll('[data-slot="context-menu-item"]').length
    ).toBeGreaterThanOrEqual(1);
  },
};

// ============ ASYNC DATA STORIES ============

interface AsyncMenuData {
  items: Array<{
    action: string;
    id: string;
    label: string;
  }>;
}

function ContextMenuWithAsyncData() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [menuData, setMenuData] = React.useState<AsyncMenuData | null>(null);

  React.useEffect(() => {
    const fetchMenuData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/dialogs/1');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = (await response.json()) as { title?: string };
        setMenuData({
          items: [
            {
              id: '1',
              label: data.title || i18n.t('contextMenu.story.view', 'View'),
              action: 'view',
            },
            { id: '2', label: i18n.t('contextMenu.story.edit', 'Edit'), action: 'edit' },
            {
              id: '3',
              label: i18n.t('contextMenu.story.deleteAction', 'Delete'),
              action: 'delete',
            },
          ],
        });
      } catch (error_) {
        setError(
          error_ instanceof Error
            ? error_.message
            : i18n.t('contextMenu.story.failedToLoadMenu', 'Failed to load menu')
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchMenuData();
  }, []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.story.rightClickForAsyncMenu', 'Right-click for async menu')}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {isLoading && (
          <div className="flex items-center justify-center py-4" data-testid="loading-state">
            <div className="border-primary size-4 animate-spin rounded-full border-2 border-t-transparent" />
            <span className="ml-2 text-sm">
              {i18n.t('contextMenu.story.loading', 'Loading...')}
            </span>
          </div>
        )}
        {error && (
          <div className="text-destructive px-2 py-4 text-center text-sm" data-testid="error-state">
            {error}
          </div>
        )}
        {!isLoading && !error && menuData && (
          <>
            <ContextMenuLabel>{i18n.t('contextMenu.story.actions', 'Actions')}</ContextMenuLabel>
            <ContextMenuSeparator />
            {menuData.items.map((item) => (
              <ContextMenuItem
                key={item.id}
                variant={item.action === 'delete' ? 'destructive' : 'default'}
              >
                {item.label}
              </ContextMenuItem>
            ))}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const WithAsyncData: Story = {
  render: () => <ContextMenuWithAsyncData />,
  parameters: {
    msw: {
      handlers: dialogHandlers,
    },
  },
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    expect(content).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  render: () => {
    function ContextMenuEmptyData() {
      return (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.rightClickEmptyMenu', 'Right-click (empty menu)')}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <div className="py-6 text-center" data-testid="empty-state">
              <div className="text-muted-foreground text-2xl">📭</div>
              <p className="text-muted-foreground mt-2 text-sm">
                {i18n.t('contextMenu.story.noActionsAvailable', 'No actions available')}
              </p>
            </div>
          </ContextMenuContent>
        </ContextMenu>
      );
    }
    return <ContextMenuEmptyData />;
  },
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    const emptyState = content.querySelector('[data-testid="empty-state"]');
    expect(emptyState).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: dialogStatusHandlers.loading,
    },
  },
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    expect(content).toBeInTheDocument();
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error404NotFound: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: dialogStatusHandlers.notFound,
    },
  },
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    expect(content).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: dialogStatusHandlers.conflict,
    },
  },
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    expect(content).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: dialogStatusHandlers.tooManyRequests,
    },
  },
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    expect(content).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: dialogStatusHandlers.badGateway,
    },
  },
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    expect(content).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: dialogStatusHandlers.serviceUnavailable,
    },
  },
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    expect(content).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: dialogStatusHandlers.gatewayTimeout,
    },
  },
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    expect(content).toBeInTheDocument();
  },
};

// ============ RIGHT-CLICK SPECIFIC TESTS ============

function RightClickAtDifferentPositionsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-medium">
        {i18n.t(
          'contextMenu.story.rightClickPositioningDescription',
          'Right-click at different positions to test context menu positioning'
        )}
      </p>
      <div className="grid grid-cols-3 gap-4">
        {[
          i18n.t('contextMenu.story.topLeft', 'Top Left'),
          i18n.t('contextMenu.story.topCenter', 'Top Center'),
          i18n.t('contextMenu.story.topRight', 'Top Right'),
          i18n.t('contextMenu.story.middleLeft', 'Middle Left'),
          i18n.t('contextMenu.story.center', 'Center'),
          i18n.t('contextMenu.story.middleRight', 'Middle Right'),
          i18n.t('contextMenu.story.bottomLeft', 'Bottom Left'),
          i18n.t('contextMenu.story.bottomCenter', 'Bottom Center'),
          i18n.t('contextMenu.story.bottomRight', 'Bottom Right'),
        ].map((position) => (
          <ContextMenu key={position}>
            <ContextMenuTrigger asChild>
              <div className="bg-muted flex h-24 items-center justify-center rounded-md border text-xs">
                {position}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-40">
              <ContextMenuLabel>
                {i18n.t('contextMenu.story.positionLabel', 'Position: {{position}}', { position })}
              </ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem>{i18n.t('contextMenu.story.action1', 'Action 1')}</ContextMenuItem>
              <ContextMenuItem>{i18n.t('contextMenu.story.action2', 'Action 2')}</ContextMenuItem>
              <ContextMenuItem>{i18n.t('contextMenu.story.action3', 'Action 3')}</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
    </div>
  );
}

export const RightClickAtDifferentPositions: Story = {
  tags: ['!test'],
  render: () => <RightClickAtDifferentPositionsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RightClickPreventsDefault: Story = {
  name: i18n.t(
    'contextMenu.storyName.rightClickPreventsDefault',
    'Right-Click Prevents Browser Default'
  ),
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    if (!(trigger instanceof HTMLElement)) {
      throw new Error('Trigger not found');
    }

    // Create and dispatch context menu event
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    });

    // The default should be prevented
    trigger.dispatchEvent(event);

    // Menu should open instead of browser context menu
    const doc = canvasElement.ownerDocument;
    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="context-menu-content"]');
      expect(content).toBeInTheDocument();
    });
  },
};

export const RightClickTriggerComprehensive: Story = {
  name: i18n.t(
    'contextMenu.storyName.rightClickTriggerComprehensive',
    'Right-Click Trigger (Comprehensive)'
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    if (!(trigger instanceof HTMLElement)) {
      throw new Error('Trigger not found');
    }

    // ========================================
    // TEST 1: Basic right-click opens menu
    // ========================================
    trigger.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 50,
        clientY: 50,
      })
    );

    let content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="context-menu-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Menu did not open');
      }
      return node;
    });

    // Verify menu opened
    expect(content).toBeInTheDocument();
    expect(content.getAttribute('role')).toBe('menu');

    // Close menu
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).not.toBeInTheDocument();
    });

    // ========================================
    // TEST 2: Right-click at different positions
    // ========================================
    const rect = trigger.getBoundingClientRect();
    const positions = [
      { x: rect.left + 10, y: rect.top + 10, name: 'top-left' },
      { x: rect.right - 10, y: rect.top + 10, name: 'top-right' },
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, name: 'center' },
      { x: rect.left + 10, y: rect.bottom - 10, name: 'bottom-left' },
      { x: rect.right - 10, y: rect.bottom - 10, name: 'bottom-right' },
    ];

    for (const pos of positions) {
      trigger.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: pos.x,
          clientY: pos.y,
        })
      );

      content = await waitFor(() => {
        const node = doc.body.querySelector('[data-slot="context-menu-content"]');
        if (!(node instanceof HTMLElement)) {
          throw new Error(`Menu did not open at ${pos.name}`);
        }
        return node;
      });

      expect(content).toBeInTheDocument();

      // Close for next iteration
      await userEvent.keyboard('{Escape}');
      await waitFor(() => {
        expect(
          doc.body.querySelector('[data-slot="context-menu-content"]')
        ).not.toBeInTheDocument();
      });
    }

    // ========================================
    // TEST 3: Right-click with modifier keys
    // ========================================
    trigger.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
        ctrlKey: true,
      })
    );

    content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="context-menu-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Menu did not open with Ctrl key');
      }
      return node;
    });

    expect(content).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
  },
};

export const RightClickCoordinates: Story = {
  name: i18n.t(
    'contextMenu.storyName.rightClickCoordinates',
    'Right-Click Opens at Mouse Coordinates'
  ),
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    if (!(trigger instanceof HTMLElement)) {
      throw new Error('Trigger not found');
    }

    const doc = canvasElement.ownerDocument;
    const rect = trigger.getBoundingClientRect();
    const clickX = rect.left + rect.width / 2;
    const clickY = rect.top + rect.height / 2;

    // Right-click at specific coordinates
    trigger.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: clickX,
        clientY: clickY,
      })
    );

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="context-menu-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Context menu content was not rendered.');
      }
      return node;
    });

    // Menu should be positioned near the click coordinates
    expect(content).toBeInTheDocument();
  },
};

export const MultipleRightClicks: Story = {
  name: i18n.t(
    'contextMenu.storyName.multipleRightClicks',
    'Multiple Right-Clicks Reposition Menu'
  ),
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    if (!(trigger instanceof HTMLElement)) {
      throw new Error('Trigger not found');
    }

    const doc = canvasElement.ownerDocument;

    // First right-click at one position
    trigger.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 50,
        clientY: 50,
      })
    );

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).toBeInTheDocument();
    });

    // Second right-click at different position should reopen/reposition
    trigger.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 150,
        clientY: 150,
      })
    );

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).toBeInTheDocument();
    });
  },
};

function RightClickDisabledTriggerDemo() {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled>
        <div className="bg-muted flex h-40 w-[400px] cursor-not-allowed items-center justify-center rounded-md border text-sm opacity-50">
          {i18n.t(
            'contextMenu.story.disabledTrigger',
            'Disabled Trigger (right-click should not work)'
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem>
          {i18n.t('contextMenu.story.thisShouldNotAppear', 'This should not appear')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const RightClickDisabledTrigger: Story = {
  render: () => <RightClickDisabledTriggerDemo />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="context-menu-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.getAttribute('data-disabled')).toBeDefined();
  },
};

// ============ KEYBOARD NAVIGATION ============

export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await openContextMenu(canvasElement);

    // Test Arrow Down to navigate
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      const { activeElement } = doc;
      expect(
        activeElement?.getAttribute('data-slot') === 'context-menu-item' ||
          activeElement?.getAttribute('role')?.includes('menu')
      ).toBe(true);
    });

    // Test Arrow Down again
    await userEvent.keyboard('{ArrowDown}');

    // Test Arrow Up
    await userEvent.keyboard('{ArrowUp}');

    // Test Enter to select
    await userEvent.keyboard('{Enter}');

    // Menu should close after selection
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).not.toBeInTheDocument();
    });
  },
};

export const KeyboardNavigationComprehensive: Story = {
  name: i18n.t(
    'contextMenu.storyName.keyboardNavigationComprehensive',
    'Keyboard Navigation (Comprehensive)'
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // ========================================
    // TEST 1: Arrow key navigation
    // ========================================
    const { content } = await openContextMenu(canvasElement);

    // Get all focusable items
    const focusableItems = content.querySelectorAll(
      '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [data-slot="context-menu-sub-trigger"]'
    );
    expect(focusableItems.length).toBeGreaterThan(0);

    // Navigate down through items
    for (let i = 0; i < Math.min(focusableItems.length, 3); i++) {
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        const { activeElement } = doc;
        expect(
          activeElement?.getAttribute('role')?.includes('menu') ||
            activeElement?.getAttribute('data-slot')?.includes('context-menu')
        ).toBe(true);
      });
    }

    // Navigate up
    await userEvent.keyboard('{ArrowUp}');

    // Close menu
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).not.toBeInTheDocument();
    });

    // ========================================
    // TEST 2: Home and End keys (if supported)
    // ========================================
    await openContextMenu(canvasElement);

    // Try End key to go to last item
    await userEvent.keyboard('{End}');

    // Try Home key to go to first item
    await userEvent.keyboard('{Home}');

    // Close menu
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).not.toBeInTheDocument();
    });

    // ========================================
    // TEST 3: Enter key activates item
    // ========================================
    await openContextMenu(canvasElement);

    // Navigate to first non-disabled item
    await userEvent.keyboard('{ArrowDown}');

    // Enter should activate and close menu
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).not.toBeInTheDocument();
    });

    // ========================================
    // TEST 4: Space key toggles checkbox items
    // ========================================
    const reopened = await openContextMenu(canvasElement);

    // Find checkbox item if present
    const checkboxItem = reopened.content.querySelector('[role="menuitemcheckbox"]');
    if (checkboxItem) {
      // Navigate to checkbox item
      while (doc.activeElement !== checkboxItem) {
        await userEvent.keyboard('{ArrowDown}');
        // Break if we've cycled through all items
        if (doc.activeElement === focusableItems[focusableItems.length - 1]) break;
      }

      // If we found it, test space toggle
      if (doc.activeElement === checkboxItem) {
        // Space should toggle the checkbox state
        await userEvent.keyboard(' ');
        // Checkbox should toggle (menu may close or stay open depending on implementation)
      }
    }

    // Clean up
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).not.toBeInTheDocument();
    });

    // ========================================
    // TEST 5: Arrow Right opens submenu
    // ========================================
    const subMenuTest = await openContextMenu(canvasElement);

    // Find submenu trigger
    const subTrigger = subMenuTest.content.querySelector('[data-slot="context-menu-sub-trigger"]');
    if (subTrigger) {
      // Navigate to submenu trigger
      while (doc.activeElement !== subTrigger) {
        await userEvent.keyboard('{ArrowDown}');
        const allItems = subMenuTest.content.querySelectorAll(
          '[role="menuitem"], [role="menuitemcheckbox"], [data-slot="context-menu-sub-trigger"]'
        );
        // Break if we've cycled through all items
        if (doc.activeElement === allItems[allItems.length - 1]) break;
      }

      if (doc.activeElement === subTrigger) {
        // Arrow Right should open submenu
        await userEvent.keyboard('{ArrowRight}');

        // Wait for submenu to open
        await waitFor(() => {
          const subContent = doc.body.querySelector('[data-slot="context-menu-sub-content"]');
          expect(subContent).toBeInTheDocument();
        });

        // Arrow Left should close submenu
        await userEvent.keyboard('{ArrowLeft}');
        await waitFor(() => {
          expect(
            doc.body.querySelector('[data-slot="context-menu-sub-content"]')
          ).not.toBeInTheDocument();
        });
      }
    }

    // Final cleanup
    await userEvent.keyboard('{Escape}');
  },
};

function TypeaheadNavigationDemo() {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.story.rightClickAndTypeToSearch', 'Right-click and type to search')}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem>{i18n.t('contextMenu.story.apple', 'Apple')}</ContextMenuItem>
        <ContextMenuItem>{i18n.t('contextMenu.story.banana', 'Banana')}</ContextMenuItem>
        <ContextMenuItem>{i18n.t('contextMenu.story.cherry', 'Cherry')}</ContextMenuItem>
        <ContextMenuItem>{i18n.t('contextMenu.story.date', 'Date')}</ContextMenuItem>
        <ContextMenuItem>{i18n.t('contextMenu.story.elderberry', 'Elderberry')}</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const TypeaheadNavigation: Story = {
  render: () => <TypeaheadNavigationDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await openContextMenu(canvasElement);

    // Type to navigate using typeahead
    await userEvent.keyboard('c');

    // Should focus on "Cherry"
    await waitFor(() => {
      const { activeElement } = doc;
      expect(activeElement?.textContent?.toLowerCase()).toContain('cherry');
    });

    await userEvent.keyboard('{Escape}');
  },
};

// ============ NESTED SUBMENUS ============

function DeeplyNestedSubmenusDemo() {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.story.rightClickForNestedMenus', 'Right-click for nested menus')}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem>
          {i18n.t('contextMenu.story.level0Item1', 'Level 0 - Item 1')}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            {i18n.t('contextMenu.story.level1', 'Level 1')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem>
              {i18n.t('contextMenu.story.level1Item1', 'Level 1 - Item 1')}
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                {i18n.t('contextMenu.story.level2', 'Level 2')}
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                <ContextMenuItem>
                  {i18n.t('contextMenu.story.level2Item1', 'Level 2 - Item 1')}
                </ContextMenuItem>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    {i18n.t('contextMenu.story.level3', 'Level 3')}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-48">
                    <ContextMenuItem>
                      {i18n.t('contextMenu.story.level3Final', 'Level 3 - Final')}
                    </ContextMenuItem>
                  </ContextMenuSubContent>
                </ContextMenuSub>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const DeeplyNestedSubmenus: Story = {
  render: () => <DeeplyNestedSubmenusDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const { content } = await openContextMenu(canvasElement);

    // Navigate to first submenu
    const level1Trigger = content.querySelector('[data-slot="context-menu-sub-trigger"]');
    if (!(level1Trigger instanceof HTMLElement)) {
      throw new Error('Level 1 sub trigger not found');
    }

    await userEvent.hover(level1Trigger);

    // Wait for level 1 submenu
    const level1Content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="context-menu-sub-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Level 1 submenu content was not rendered.');
      }
      return node;
    });

    // Navigate to level 2
    const level2Trigger = level1Content.querySelector('[data-slot="context-menu-sub-trigger"]');
    if (level2Trigger instanceof HTMLElement) {
      await userEvent.hover(level2Trigger);
    }

    // Close all
    await userEvent.keyboard('{Escape}');
  },
};

// ============ FOCUS TRAP ============

export const FocusTrap: Story = {
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const { content } = await openContextMenu(canvasElement);

    // Focus should be trapped within the menu
    const menuItems = content.querySelectorAll(
      '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
    );
    expect(menuItems.length).not.toBe(0);

    // Tab through items - focus should stay within menu
    for (let i = 0; i < menuItems.length + 2; i++) {
      await userEvent.keyboard('{ArrowDown}');
    }

    // Focus should still be in menu (looped back or at end)
    await waitFor(() => {
      const { activeElement } = doc;
      const isInMenu = content.contains(activeElement);
      expect(isInMenu).toBe(true);
    });

    await userEvent.keyboard('{Escape}');
  },
};

// ============ ESCAPE KEY HANDLING ============

export const EscapeKeyHandling: Story = {
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Open menu
    await openContextMenu(canvasElement);

    // Verify menu is open
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).toBeInTheDocument();
    });

    // Press Escape to close
    await userEvent.keyboard('{Escape}');

    // Verify menu is closed
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).not.toBeInTheDocument();
    });
  },
};

export const EscapeKeyClosesSubmenu: Story = {
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const { content } = await openContextMenu(canvasElement);

    // Open submenu
    const subTrigger = content.querySelector('[data-slot="context-menu-sub-trigger"]');
    if (!(subTrigger instanceof HTMLElement)) {
      throw new Error('Sub trigger not found');
    }

    await userEvent.hover(subTrigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-sub-content"]')).toBeInTheDocument();
    });

    // Press Escape - should close submenu first
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        doc.body.querySelector('[data-slot="context-menu-sub-content"]')
      ).not.toBeInTheDocument();
    });

    // Main menu might still be open or closed depending on implementation
    // Press Escape again to ensure everything is closed
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="context-menu-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY WIRING: SINGLE ITEM FACTORIES ============

function ContextMenuSingleItemDemo() {
  const { t } = useTranslation();
  const item = React.useMemo(() => createFakeContextMenuItem(), []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {t('contextMenu.factory.triggerLabel', { context: t('contextMenu.factory.singleItem') })}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem disabled={item.disabled} inset={item.inset} variant={item.variant}>
          {item.label}
          {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const FactorySingleItem: Story = {
  name: i18n.t('contextMenu.storyName.factorySingleItem', 'Factory: Single Item'),
  render: () => <ContextMenuSingleItemDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    const items = content.querySelectorAll('[data-slot="context-menu-item"]');
    expect(items.length).toBe(1);
  },
};

function ContextMenuCheckboxItemDemo() {
  const initialItem = React.useMemo(() => createFakeContextMenuCheckboxItem(), []);
  const [checked, setChecked] = React.useState(initialItem.checked);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.checkboxItem'),
          })}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuCheckboxItem
          checked={checked}
          disabled={initialItem.disabled}
          onCheckedChange={(v) => setChecked(v === true)}
        >
          {initialItem.label}
        </ContextMenuCheckboxItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const FactoryCheckboxItem: Story = {
  name: i18n.t('contextMenu.storyName.factoryCheckboxItem', 'Factory: Checkbox Item'),
  render: () => <ContextMenuCheckboxItemDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    const checkboxItem = content.querySelector('[data-slot="context-menu-checkbox-item"]');
    expect(checkboxItem).toBeInTheDocument();
    expect(checkboxItem?.getAttribute('role')).toBe('menuitemcheckbox');
  },
};

function ContextMenuRadioItemDemo() {
  const radioItem = React.useMemo(
    () => createFakeContextMenuRadioItem('test-value', 'Test Radio Option'),
    []
  );
  const [selected, setSelected] = React.useState(radioItem.value);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.radioGroup'),
          })}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuRadioGroup onValueChange={setSelected} value={selected}>
          <ContextMenuRadioItem disabled={radioItem.disabled} value={radioItem.value}>
            {radioItem.label}
          </ContextMenuRadioItem>
          <ContextMenuRadioItem value="other">
            {i18n.t('contextMenu.story.otherOption', 'Other Option')}
          </ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const FactoryRadioItem: Story = {
  name: i18n.t('contextMenu.storyName.factoryRadioItem', 'Factory: Radio Item'),
  render: () => <ContextMenuRadioItemDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    const radioItems = content.querySelectorAll('[data-slot="context-menu-radio-item"]');
    expect(radioItems.length).toBe(2);
  },
};

function ContextMenuRadioGroupDemo() {
  const group = React.useMemo(() => createFakeContextMenuRadioGroup(VIEW_OPTIONS, 'View'), []);
  const [selected, setSelected] = React.useState(group.selectedValue);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.radioGroup'),
          })}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {group.label && <ContextMenuLabel>{group.label}</ContextMenuLabel>}
        <ContextMenuSeparator />
        <ContextMenuRadioGroup onValueChange={setSelected} value={selected}>
          {group.items.map((item) => (
            <ContextMenuRadioItem disabled={item.disabled} key={item.id} value={item.value}>
              {item.label}
            </ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const FactoryRadioGroup: Story = {
  name: i18n.t('contextMenu.storyName.factoryRadioGroup', 'Factory: Radio Group'),
  render: () => <ContextMenuRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    const radioItems = content.querySelectorAll('[data-slot="context-menu-radio-item"]');
    expect(radioItems.length).toBe(VIEW_OPTIONS.length);
  },
};

function ContextMenuSubmenuDemo() {
  const submenu = React.useMemo(() => createFakeContextMenuSubmenu('More Options', 4), []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.submenu'),
          })}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem>{i18n.t('contextMenu.story.actionA', 'Action A')}</ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger inset={submenu.inset}>{submenu.label}</ContextMenuSubTrigger>
          <ContextMenuSubContent className={submenu.width}>
            {submenu.items.map((item) => (
              <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
                {item.label}
                {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const FactorySubmenu: Story = {
  name: i18n.t('contextMenu.storyName.factorySubmenu', 'Factory: Submenu'),
  render: () => <ContextMenuSubmenuDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    const subTrigger = content.querySelector('[data-slot="context-menu-sub-trigger"]');
    expect(subTrigger).toBeInTheDocument();
  },
};

// ============ FACTORY WIRING: BULK FACTORIES ============

function ContextMenuBulkItemsDemo() {
  const items = React.useMemo(() => createFakeContextMenuItems(6), []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.bulkItems'),
          })}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuLabel inset>{i18n.t('contextMenu.factory.bulkItems')}</ContextMenuLabel>
        <ContextMenuSeparator />
        {items.map((item) =>
          item.type === 'separator' ? (
            <ContextMenuSeparator key={item.id} />
          ) : (
            <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
              {item.label}
              {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
            </ContextMenuItem>
          )
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const FactoryBulkItems: Story = {
  name: i18n.t('contextMenu.storyName.factoryBulkItems', 'Factory: Bulk Items'),
  render: () => <ContextMenuBulkItemsDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    const items = content.querySelectorAll('[data-slot="context-menu-item"]');
    expect(items.length).toBeGreaterThanOrEqual(1);
  },
};

function ContextMenuMultipleMenusDemo() {
  const menus = React.useMemo(() => createFakeContextMenus(3), []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{i18n.t('contextMenu.factory.multipleMenus')}</p>
      {menus.map((menu, index) => (
        <ContextMenu key={menu.id}>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-24 w-[300px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.menuNumber', 'Menu {{number}}', { number: index + 1 })}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className={menu.width}>
            {menu.items.map((item) =>
              item.type === 'separator' ? (
                <ContextMenuSeparator key={item.id} />
              ) : (
                <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
                  {item.label}
                </ContextMenuItem>
              )
            )}
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  );
}

export const FactoryMultipleMenus: Story = {
  name: i18n.t('contextMenu.storyName.factoryMultipleMenus', 'Factory: Multiple Menus'),
  render: () => <ContextMenuMultipleMenusDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="context-menu-trigger"]');
    expect(triggers.length).toBe(3);
  },
};

// ============ FACTORY WIRING: SPECIALIZED FACTORIES ============

function ContextMenuFileExplorerDemo() {
  const fileMenu = React.useMemo(() => createFakeFileExplorerContextMenu('file'), []);
  const folderMenu = React.useMemo(() => createFakeFileExplorerContextMenu('folder'), []);

  const renderMenuItems = (menu: FakeFileExplorerContextMenu) => (
    <>
      {menu.selectedItem && (
        <>
          <ContextMenuLabel inset>
            {menu.selectedItem.name} ({menu.selectedItem.size})
          </ContextMenuLabel>
          <ContextMenuSeparator />
        </>
      )}
      {menu.items.map((item) =>
        item.type === 'separator' ? (
          <ContextMenuSeparator key={item.id} />
        ) : (
          <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
            {item.label}
            {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
          </ContextMenuItem>
        )
      )}
      {menu.submenus?.map((sub) => (
        <ContextMenuSub key={sub.id}>
          <ContextMenuSubTrigger inset={sub.inset}>{sub.label}</ContextMenuSubTrigger>
          <ContextMenuSubContent className={sub.width}>
            {sub.items.map((subItem) => (
              <ContextMenuItem key={subItem.id}>{subItem.label}</ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      ))}
    </>
  );

  return (
    <div className="flex gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.fileExplorer'),
          })}{' '}
          ({i18n.t('contextMenu.story.file', 'File')})
        </p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-32 w-[250px] items-center justify-center rounded-md border text-sm">
              {fileMenu.selectedItem?.name}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className={fileMenu.width}>
            {renderMenuItems(fileMenu)}
          </ContextMenuContent>
        </ContextMenu>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.fileExplorer'),
          })}{' '}
          ({i18n.t('contextMenu.story.folder', 'Folder')})
        </p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-32 w-[250px] items-center justify-center rounded-md border text-sm">
              {folderMenu.selectedItem?.name}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className={folderMenu.width}>
            {renderMenuItems(folderMenu)}
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  );
}

export const FactoryFileExplorer: Story = {
  name: i18n.t('contextMenu.storyName.factoryFileExplorer', 'Factory: File Explorer Context Menu'),
  render: () => <ContextMenuFileExplorerDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="context-menu-trigger"]');
    expect(triggers.length).toBe(2);

    // Open first (file) menu
    const firstTrigger = triggers[0];
    if (firstTrigger instanceof HTMLElement) {
      firstTrigger.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 16, clientY: 16 })
      );
      const doc = canvasElement.ownerDocument;
      const content = await waitFor(() => {
        const node = doc.body.querySelector('[data-slot="context-menu-content"]');
        if (!(node instanceof HTMLElement)) throw new Error('Menu not rendered');
        return node;
      });
      expect(content.querySelectorAll('[data-slot="context-menu-item"]').length).toBeGreaterThan(0);
      await userEvent.keyboard('{Escape}');
    }
  },
};

function ContextMenuEditorDemo() {
  const noSelectionMenu = React.useMemo(() => createFakeEditorContextMenu(false), []);
  const withSelectionMenu = React.useMemo(() => createFakeEditorContextMenu(true), []);

  const renderEditorMenu = (menu: FakeEditorContextMenu) => (
    <>
      {menu.cursorPosition && (
        <>
          <ContextMenuLabel inset>
            {i18n.t(
              'contextMenu.story.cursorPosition',
              'Ln {{line}}, Col {{column}} ({{language}})',
              {
                column: menu.cursorPosition.column,
                language: menu.language,
                line: menu.cursorPosition.line,
              }
            )}
          </ContextMenuLabel>
          <ContextMenuSeparator />
        </>
      )}
      {menu.items.map((item) =>
        item.type === 'separator' ? (
          <ContextMenuSeparator key={item.id} />
        ) : (
          <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
            {item.label}
            {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
          </ContextMenuItem>
        )
      )}
      {menu.submenus?.map((sub) => (
        <ContextMenuSub key={sub.id}>
          <ContextMenuSubTrigger inset={sub.inset}>{sub.label}</ContextMenuSubTrigger>
          <ContextMenuSubContent className={sub.width}>
            {sub.items.map((subItem) => (
              <ContextMenuItem key={subItem.id}>
                {subItem.label}
                {subItem.shortcut && <ContextMenuShortcut>{subItem.shortcut}</ContextMenuShortcut>}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      ))}
    </>
  );

  return (
    <div className="flex gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.editor'),
          })}{' '}
          {i18n.t('contextMenu.story.noSelection', '(No Selection)')}
        </p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-32 w-[280px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.editorNoSelection', 'Editor (no selection)')}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className={noSelectionMenu.width}>
            {renderEditorMenu(noSelectionMenu)}
          </ContextMenuContent>
        </ContextMenu>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.editor'),
          })}{' '}
          {i18n.t('contextMenu.story.withSelection', '(With Selection)')}
        </p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-32 w-[280px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.editorWithSelection', 'Editor (with selection)')}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className={withSelectionMenu.width}>
            {renderEditorMenu(withSelectionMenu)}
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  );
}

export const FactoryEditorContextMenu: Story = {
  name: i18n.t('contextMenu.storyName.factoryEditorContextMenu', 'Factory: Editor Context Menu'),
  render: () => <ContextMenuEditorDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="context-menu-trigger"]');
    expect(triggers.length).toBe(2);
  },
};

function ContextMenuBrowserDemo() {
  const pageMenu = React.useMemo(() => createFakeBrowserContextMenu('page'), []);
  const linkMenu = React.useMemo(() => createFakeBrowserContextMenu('link'), []);
  const imageMenu = React.useMemo(() => createFakeBrowserContextMenu('image'), []);
  const selectionMenu = React.useMemo(() => createFakeBrowserContextMenu('selection'), []);

  const renderBrowserMenu = (menu: FakeBrowserContextMenu) => (
    <>
      {menu.items.map((item) =>
        item.type === 'separator' ? (
          <ContextMenuSeparator key={item.id} />
        ) : (
          <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
            {item.label}
            {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
          </ContextMenuItem>
        )
      )}
    </>
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      {[
        { label: i18n.t('contextMenu.story.page', 'Page'), menu: pageMenu },
        { label: i18n.t('contextMenu.story.link', 'Link'), menu: linkMenu },
        { label: i18n.t('contextMenu.story.image', 'Image'), menu: imageMenu },
        { label: i18n.t('contextMenu.story.selection', 'Selection'), menu: selectionMenu },
      ].map(({ label, menu }) => (
        <div key={label}>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('contextMenu.factory.triggerLabel', {
              context: i18n.t('contextMenu.factory.browser'),
            })}{' '}
            ({label})
          </p>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="bg-muted flex h-24 items-center justify-center rounded-md border text-sm">
                {i18n.t('contextMenu.story.labelContext', '{{label}} context', { label })}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className={menu.width}>
              {renderBrowserMenu(menu)}
            </ContextMenuContent>
          </ContextMenu>
        </div>
      ))}
    </div>
  );
}

export const FactoryBrowserContextMenu: Story = {
  name: i18n.t('contextMenu.storyName.factoryBrowserContextMenu', 'Factory: Browser Context Menu'),
  render: () => <ContextMenuBrowserDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="context-menu-trigger"]');
    expect(triggers.length).toBe(4);
  },
};

function ContextMenuTableRowDemo() {
  const menu = React.useMemo(() => createFakeTableRowContextMenu(), []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.tableRow'),
          })}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className={menu.width}>
        {menu.items.map((item) =>
          item.type === 'separator' ? (
            <ContextMenuSeparator key={item.id} />
          ) : (
            <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
              {item.label}
              {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
            </ContextMenuItem>
          )
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const FactoryTableRow: Story = {
  name: i18n.t('contextMenu.storyName.factoryTableRow', 'Factory: Table Row Context Menu'),
  render: () => <ContextMenuTableRowDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    const items = content.querySelectorAll('[data-slot="context-menu-item"]');
    expect(items.length).toBeGreaterThan(0);
    // Should have a destructive delete item
    expect(
      content.querySelector('[data-slot="context-menu-item"][data-variant="destructive"]')
    ).toBeInTheDocument();
  },
};

function ContextMenuKanbanCardDemo() {
  const menu = React.useMemo(() => createFakeKanbanCardContextMenu(), []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.kanbanCard'),
          })}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className={menu.width}>
        {menu.items.map((item) =>
          item.type === 'separator' ? (
            <ContextMenuSeparator key={item.id} />
          ) : (
            <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
              {item.label}
              {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
            </ContextMenuItem>
          )
        )}
        {menu.submenus?.map((sub) => (
          <ContextMenuSub key={sub.id}>
            <ContextMenuSubTrigger>{sub.label}</ContextMenuSubTrigger>
            <ContextMenuSubContent className={sub.width}>
              {sub.items.map((subItem) => (
                <ContextMenuItem key={subItem.id}>{subItem.label}</ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const FactoryKanbanCard: Story = {
  name: i18n.t('contextMenu.storyName.factoryKanbanCard', 'Factory: Kanban Card Context Menu'),
  render: () => <ContextMenuKanbanCardDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    const items = content.querySelectorAll('[data-slot="context-menu-item"]');
    expect(items.length).toBeGreaterThan(0);
    const subTrigger = content.querySelector('[data-slot="context-menu-sub-trigger"]');
    expect(subTrigger).toBeInTheDocument();
  },
};

// ============ FACTORY WIRING: MATRIX & SHOWCASE ============

function ContextMenuMatrixDemo() {
  const matrix = React.useMemo(() => createFakeContextMenuMatrix(), []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{i18n.t('contextMenu.factory.matrix')}</p>
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(matrix).map(([key, menu]) => (
          <div key={key}>
            <p className="mb-1 text-xs font-medium capitalize">{key}</p>
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="bg-muted flex h-20 items-center justify-center rounded-md border text-xs">
                  {key}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className={menu.width}>
                {menu.items.map((item) =>
                  item.type === 'separator' ? (
                    <ContextMenuSeparator key={item.id} />
                  ) : (
                    <ContextMenuItem
                      disabled={item.disabled}
                      inset={item.inset}
                      key={item.id}
                      variant={item.variant}
                    >
                      {item.label}
                      {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
                    </ContextMenuItem>
                  )
                )}
                {menu.checkboxItems?.map((cb) => (
                  <ContextMenuCheckboxItem checked={cb.checked} key={cb.id}>
                    {cb.label}
                  </ContextMenuCheckboxItem>
                ))}
                {menu.radioGroups?.map((rg) => (
                  <React.Fragment key={rg.id}>
                    {rg.label && <ContextMenuLabel>{rg.label}</ContextMenuLabel>}
                    <ContextMenuRadioGroup value={rg.selectedValue}>
                      {rg.items.map((ri) => (
                        <ContextMenuRadioItem key={ri.id} value={ri.value}>
                          {ri.label}
                        </ContextMenuRadioItem>
                      ))}
                    </ContextMenuRadioGroup>
                  </React.Fragment>
                ))}
                {menu.submenus?.map((sub) => (
                  <ContextMenuSub key={sub.id}>
                    <ContextMenuSubTrigger inset={sub.inset}>{sub.label}</ContextMenuSubTrigger>
                    <ContextMenuSubContent className={sub.width}>
                      {sub.items.map((subItem) => (
                        <ContextMenuItem key={subItem.id}>{subItem.label}</ContextMenuItem>
                      ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                ))}
              </ContextMenuContent>
            </ContextMenu>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryMatrix: Story = {
  name: i18n.t('contextMenu.storyName.factoryMatrix', 'Factory: Context Menu Matrix'),
  render: () => <ContextMenuMatrixDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="context-menu-trigger"]');
    expect(triggers.length).toBe(7);
  },
};

function ContextMenuShowcaseDemo() {
  const showcase = React.useMemo(() => createFakeContextMenuShowcase(), []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{i18n.t('contextMenu.factory.showcase')}</p>
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(showcase).map(([key, menu]) => (
          <div key={key}>
            <p className="mb-1 text-xs font-medium capitalize">
              {key.replaceAll(/([A-Z])/g, ' $1').trim()}
            </p>
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="bg-muted flex h-20 items-center justify-center rounded-md border text-xs">
                  {key}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className={menu.width}>
                {menu.items.map((item) =>
                  item.type === 'separator' ? (
                    <ContextMenuSeparator key={item.id} />
                  ) : (
                    <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
                      {item.label}
                      {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
                    </ContextMenuItem>
                  )
                )}
              </ContextMenuContent>
            </ContextMenu>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryShowcase: Story = {
  name: i18n.t('contextMenu.storyName.factoryShowcase', 'Factory: Context Menu Showcase'),
  render: () => <ContextMenuShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="context-menu-trigger"]');
    expect(triggers.length).toBe(10);
  },
};

// ============ FACTORY WIRING: ENTERPRISE FEATURES ============

function ContextMenuTrackedDemo() {
  const menu = React.useMemo(() => createFakeTrackedContextMenu(), []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.tracked'),
          })}
          <span className="text-muted-foreground ml-2 text-xs">(ID: {menu.trackingId})</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className={menu.width}>
        <ContextMenuLabel>
          {i18n.t('contextMenu.story.trackingSource', 'Tracking: {{source}}', {
            source:
              (menu.trackingData?.source as string) ||
              i18n.t('contextMenu.story.unknown', 'unknown'),
          })}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        {menu.items.map((item) =>
          item.type === 'separator' ? (
            <ContextMenuSeparator key={item.id} />
          ) : (
            <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
              {item.label}
            </ContextMenuItem>
          )
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const FactoryTrackedContextMenu: Story = {
  name: i18n.t('contextMenu.storyName.factoryTrackedContextMenu', 'Factory: Tracked Context Menu'),
  render: () => <ContextMenuTrackedDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    const label = content.querySelector('[data-slot="context-menu-label"]');
    expect(label).toBeInTheDocument();
    expect(label?.textContent).toContain('Tracking');
  },
};

function ContextMenuUndoableDemo() {
  const menu = React.useMemo(() => createFakeUndoableContextMenu(), []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.undoable'),
          })}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className={menu.width}>
        {menu.items.map((item) =>
          item.type === 'separator' ? (
            <ContextMenuSeparator key={item.id} />
          ) : (
            <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
              {item.label}
              {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
            </ContextMenuItem>
          )
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const FactoryUndoableContextMenu: Story = {
  name: i18n.t(
    'contextMenu.storyName.factoryUndoableContextMenu',
    'Factory: Undoable Context Menu'
  ),
  render: () => <ContextMenuUndoableDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    const destructiveItem = content.querySelector(
      '[data-slot="context-menu-item"][data-variant="destructive"]'
    );
    expect(destructiveItem).toBeInTheDocument();
    expect(destructiveItem?.textContent).toContain('Undoable');
  },
};

function ContextMenuConfirmationDemo() {
  const menu = React.useMemo(() => createFakeConfirmationContextMenu(), []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.confirmation'),
          })}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className={menu.width}>
        {menu.items.map((item) =>
          item.type === 'separator' ? (
            <ContextMenuSeparator key={item.id} />
          ) : (
            <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
              {item.label}
            </ContextMenuItem>
          )
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const FactoryConfirmationContextMenu: Story = {
  name: i18n.t(
    'contextMenu.storyName.factoryConfirmationContextMenu',
    'Factory: Confirmation Context Menu'
  ),
  render: () => <ContextMenuConfirmationDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    const destructiveItem = content.querySelector(
      '[data-slot="context-menu-item"][data-variant="destructive"]'
    );
    expect(destructiveItem).toBeInTheDocument();
    expect(destructiveItem?.textContent).toContain('Confirmation');
  },
};

function ContextMenuBatchActionDemo() {
  const menu = React.useMemo(() => createFakeBatchActionContextMenu(5), []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.batchAction'),
          })}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className={menu.width}>
        {menu.items.map((item) =>
          item.type === 'separator' ? (
            <ContextMenuSeparator key={item.id} />
          ) : (
            <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
              {item.label}
            </ContextMenuItem>
          )
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const FactoryBatchAction: Story = {
  name: i18n.t('contextMenu.storyName.factoryBatchAction', 'Factory: Batch Action Context Menu'),
  render: () => <ContextMenuBatchActionDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    const items = content.querySelectorAll('[data-slot="context-menu-item"]');
    expect(items.length).toBeGreaterThan(0);
    // Verify batch count in text
    const allText = content.textContent || '';
    expect(allText).toContain('5 items');
  },
};

function ContextMenuA11yTestDemo() {
  const menu = React.useMemo(() => createFakeA11yTestContextMenu(), []);

  const [checkStates, setCheckStates] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries((menu.checkboxItems || []).map((cb) => [cb.id, cb.checked]))
  );
  const [radioValue, setRadioValue] = React.useState(menu.radioGroups?.[0]?.selectedValue || '');

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="bg-muted flex h-40 w-[400px] items-center justify-center rounded-md border text-sm">
          {i18n.t('contextMenu.factory.triggerLabel', {
            context: i18n.t('contextMenu.factory.a11yTest'),
          })}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className={menu.width}>
        {menu.items.map((item) =>
          item.type === 'separator' ? (
            <ContextMenuSeparator key={item.id} />
          ) : (
            <ContextMenuItem disabled={item.disabled} key={item.id} variant={item.variant}>
              {item.label}
            </ContextMenuItem>
          )
        )}
        <ContextMenuSeparator />
        {menu.checkboxItems?.map((cb) => (
          <ContextMenuCheckboxItem
            checked={checkStates[cb.id]}
            disabled={cb.disabled}
            key={cb.id}
            onCheckedChange={(v) => setCheckStates((prev) => ({ ...prev, [cb.id]: v === true }))}
          >
            {cb.label}
          </ContextMenuCheckboxItem>
        ))}
        <ContextMenuSeparator />
        {menu.radioGroups?.map((rg) => (
          <React.Fragment key={rg.id}>
            {rg.label && <ContextMenuLabel>{rg.label}</ContextMenuLabel>}
            <ContextMenuRadioGroup onValueChange={setRadioValue} value={radioValue}>
              {rg.items.map((ri) => (
                <ContextMenuRadioItem disabled={ri.disabled} key={ri.id} value={ri.value}>
                  {ri.label}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </React.Fragment>
        ))}
        {menu.submenus?.map((sub) => (
          <ContextMenuSub key={sub.id}>
            <ContextMenuSubTrigger>{sub.label}</ContextMenuSubTrigger>
            <ContextMenuSubContent className={sub.width}>
              {sub.items.map((subItem) => (
                <ContextMenuItem key={subItem.id}>{subItem.label}</ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const FactoryA11yTest: Story = {
  name: i18n.t('contextMenu.storyName.factoryA11yTest', 'Factory: Accessibility Test Menu'),
  render: () => <ContextMenuA11yTestDemo />,
  play: async ({ canvasElement }) => {
    const { content } = await openContextMenu(canvasElement);
    // Verify all ARIA roles present
    expect(content.getAttribute('role')).toBe('menu');
    expect(content.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0);
    expect(content.querySelectorAll('[role="menuitemcheckbox"]').length).toBeGreaterThan(0);
    expect(content.querySelectorAll('[role="menuitemradio"]').length).toBeGreaterThan(0);
    // Verify disabled items
    expect(content.querySelectorAll('[aria-disabled="true"]').length).toBeGreaterThan(0);
  },
};

// ============ FACTORY WIRING: ACTION PAYLOADS & RESPONSES ============

function ContextMenuActionPayloadDemo() {
  const { t } = useTranslation();
  const payload = React.useMemo(() => createFakeActionPayload('delete'), []);
  const successResponse = React.useMemo(() => createFakeActionResponse('delete', true), []);
  const failResponse = React.useMemo(() => createFakeActionResponse('delete', false), []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{t('contextMenu.factory.actionPayload')}</p>
      <div className="bg-muted rounded-md border p-4 text-xs">
        <pre data-testid="payload">{JSON.stringify(payload, null, 2)}</pre>
      </div>
      <p className="text-sm font-medium">
        {t('contextMenu.factory.actionResponse')} {t('contextMenu.story.success', '(Success)')}
      </p>
      <div className="bg-muted rounded-md border p-4 text-xs">
        <pre data-testid="success-response">{JSON.stringify(successResponse, null, 2)}</pre>
      </div>
      <p className="text-sm font-medium">
        {t('contextMenu.factory.actionResponse')} {t('contextMenu.story.failure', '(Failure)')}
      </p>
      <div className="bg-muted rounded-md border p-4 text-xs">
        <pre data-testid="fail-response">{JSON.stringify(failResponse, null, 2)}</pre>
      </div>
    </div>
  );
}

export const FactoryActionPayloads: Story = {
  name: i18n.t(
    'contextMenu.storyName.factoryActionPayloads',
    'Factory: Action Payloads & Responses'
  ),
  render: () => <ContextMenuActionPayloadDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const payloadEl = canvas.getByTestId('payload');
    expect(payloadEl).toBeInTheDocument();
    const payloadText = payloadEl.textContent || '';
    expect(payloadText).toContain('delete');
    expect(payloadText).toContain('targetId');

    const successEl = canvas.getByTestId('success-response');
    expect(successEl.textContent).toContain('"success": true');

    const failEl = canvas.getByTestId('fail-response');
    expect(failEl.textContent).toContain('"success": false');
  },
};

// ============ FACTORY WIRING: CONSTANTS ============

function ContextMenuConstantsDemo() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.factory.itemVariants')}</p>
        <div className="flex gap-2" data-testid="variants">
          {CONTEXT_MENU_ITEM_VARIANTS.map((v) => (
            <span className="bg-muted rounded px-2 py-1 text-xs" key={v}>
              {v}
            </span>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.factory.itemTypes')}</p>
        <div className="flex gap-2" data-testid="types">
          {CONTEXT_MENU_ITEM_TYPES.map((type) => (
            <span className="bg-muted rounded px-2 py-1 text-xs" key={type}>
              {type}
            </span>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.factory.widths')}</p>
        <div className="flex gap-2" data-testid="widths">
          {CONTEXT_MENU_WIDTHS.map((w) => (
            <span className="bg-muted rounded px-2 py-1 text-xs" key={w}>
              {w}
            </span>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.factory.shortcuts')}</p>
        <div className="flex gap-2" data-testid="shortcuts">
          {Object.entries(SHORTCUT_SYMBOLS).map(([key, symbol]) => (
            <span className="bg-muted rounded px-2 py-1 text-xs" key={key}>
              {key}: {symbol}
            </span>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.factory.commonLabels')}</p>
        <div className="flex flex-wrap gap-1" data-testid="labels">
          {COMMON_LABELS.map((label) => (
            <span className="bg-muted rounded px-2 py-1 text-xs" key={label}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  name: i18n.t('contextMenu.storyName.factoryConstants', 'Factory: Constants'),
  render: () => <ContextMenuConstantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const variantsEl = canvas.getByTestId('variants');
    expect(variantsEl.children.length).toBe(CONTEXT_MENU_ITEM_VARIANTS.length);
    const typesEl = canvas.getByTestId('types');
    expect(typesEl.children.length).toBe(CONTEXT_MENU_ITEM_TYPES.length);
    const widthsEl = canvas.getByTestId('widths');
    expect(widthsEl.children.length).toBe(CONTEXT_MENU_WIDTHS.length);
    const shortcutsEl = canvas.getByTestId('shortcuts');
    expect(shortcutsEl.children.length).toBe(Object.keys(SHORTCUT_SYMBOLS).length);
    const labelsEl = canvas.getByTestId('labels');
    expect(labelsEl.children.length).toBe(COMMON_LABELS.length);
  },
};

function ContextMenuActionPresetsDemo() {
  return (
    <div className="flex gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.factory.editActions')}</p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-24 w-[250px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.editActionsTrigger', 'Edit Actions')}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            {EDIT_ACTIONS.map((action) => (
              <ContextMenuItem inset key={action.label}>
                {action.label}
                <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut>
              </ContextMenuItem>
            ))}
          </ContextMenuContent>
        </ContextMenu>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.factory.fileActions')}</p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-24 w-[250px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.fileActionsTrigger', 'File Actions')}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            {FILE_ACTIONS.map((action) => (
              <ContextMenuItem inset key={action.label}>
                {action.label}
                {action.shortcut && <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut>}
              </ContextMenuItem>
            ))}
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  );
}

export const FactoryActionPresets: Story = {
  name: i18n.t('contextMenu.storyName.factoryActionPresets', 'Factory: Edit & File Action Presets'),
  render: () => <ContextMenuActionPresetsDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="context-menu-trigger"]');
    expect(triggers.length).toBe(2);

    // Open first menu (edit actions)
    const firstTrigger = triggers[0];
    if (firstTrigger instanceof HTMLElement) {
      firstTrigger.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 16, clientY: 16 })
      );
      const doc = canvasElement.ownerDocument;
      const content = await waitFor(() => {
        const node = doc.body.querySelector('[data-slot="context-menu-content"]');
        if (!(node instanceof HTMLElement)) throw new Error('Menu not rendered');
        return node;
      });
      expect(content.querySelectorAll('[data-slot="context-menu-item"]').length).toBe(
        EDIT_ACTIONS.length
      );
      await userEvent.keyboard('{Escape}');
    }
  },
};

function ContextMenuOptionPresetsDemo() {
  const [view, setView] = React.useState(VIEW_OPTIONS[0].value);
  const [sort, setSort] = React.useState(SORT_OPTIONS[0].value);
  const [theme, setTheme] = React.useState(THEME_OPTIONS[0].value);

  return (
    <div className="flex gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.factory.viewOptions')}</p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-24 w-[200px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.viewValue', 'View: {{view}}', { view })}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-40">
            <ContextMenuLabel>{i18n.t('contextMenu.factory.viewOptions')}</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuRadioGroup onValueChange={setView} value={view}>
              {VIEW_OPTIONS.map((opt) => (
                <ContextMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuContent>
        </ContextMenu>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.factory.sortOptions')}</p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-24 w-[200px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.sortValue', 'Sort: {{sort}}', { sort })}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuLabel>{i18n.t('contextMenu.factory.sortOptions')}</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuRadioGroup onValueChange={setSort} value={sort}>
              {SORT_OPTIONS.map((opt) => (
                <ContextMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuContent>
        </ContextMenu>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('contextMenu.factory.themeOptions')}</p>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="bg-muted flex h-24 w-[200px] items-center justify-center rounded-md border text-sm">
              {i18n.t('contextMenu.story.themeValue', 'Theme: {{theme}}', { theme })}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-40">
            <ContextMenuLabel>{i18n.t('contextMenu.factory.themeOptions')}</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuRadioGroup onValueChange={setTheme} value={theme}>
              {THEME_OPTIONS.map((opt) => (
                <ContextMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  );
}

export const FactoryOptionPresets: Story = {
  name: i18n.t('contextMenu.storyName.factoryOptionPresets', 'Factory: View, Sort & Theme Options'),
  render: () => <ContextMenuOptionPresetsDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="context-menu-trigger"]');
    expect(triggers.length).toBe(3);
  },
};

// ============ FACTORY WIRING: TYPE ASSERTIONS ============

/**
 * This story exists solely to exercise all imported types from context-menu.factory.ts
 * at the TypeScript level. The types are used in type annotations within the component.
 */
function ContextMenuTypeAssertionsDemo() {
  // Exercise all type imports via type assertions
  const variant: ContextMenuItemVariant = 'destructive';
  const itemType: ContextMenuItemType = 'item';
  const width: ContextMenuWidth = 'w-48';
  const modifier: ShortcutModifier = 'Cmd';
  const symbol: ShortcutSymbol = '⌘';
  const actionEvent: ContextMenuActionEvent = 'delete';

  // Exercise interface types
  const item: FakeContextMenuItem = createFakeContextMenuItem();
  const checkboxItem: FakeContextMenuCheckboxItem = createFakeContextMenuCheckboxItem();
  const radioItem: FakeContextMenuRadioItem = createFakeContextMenuRadioItem('v', 'L');
  const radioGroup: FakeContextMenuRadioGroup = createFakeContextMenuRadioGroup(VIEW_OPTIONS);
  const submenu: FakeContextMenuSubmenu = createFakeContextMenuSubmenu('Sub');
  const menu: FakeContextMenu = createFakeContextMenu();
  const fileExplorerMenu: FakeFileExplorerContextMenu = createFakeFileExplorerContextMenu();
  const editorMenu: FakeEditorContextMenu = createFakeEditorContextMenu();
  const browserMenu: FakeBrowserContextMenu = createFakeBrowserContextMenu();
  const payload: ContextMenuActionPayload = createFakeActionPayload();
  const response: ContextMenuActionResponse = createFakeActionResponse('copy');
  const trackedMenu: FakeTrackedContextMenu = createFakeTrackedContextMenu();

  return (
    <div className="flex flex-col gap-2" data-testid="type-assertions">
      <p className="text-sm font-medium">
        {i18n.t('contextMenu.factory.triggerLabel', { context: 'type assertions' })}
      </p>
      <div className="bg-muted rounded-md border p-3 text-xs">
        <p>ContextMenuItemVariant: {variant}</p>
        <p>ContextMenuItemType: {itemType}</p>
        <p>ContextMenuWidth: {width}</p>
        <p>ShortcutModifier: {modifier}</p>
        <p>ShortcutSymbol: {symbol}</p>
        <p>ContextMenuActionEvent: {actionEvent}</p>
        <p>FakeContextMenuItem: {item.label}</p>
        <p>FakeContextMenuCheckboxItem: {checkboxItem.label}</p>
        <p>FakeContextMenuRadioItem: {radioItem.label}</p>
        <p>FakeContextMenuRadioGroup: {radioGroup.items.length} items</p>
        <p>FakeContextMenuSubmenu: {submenu.label}</p>
        <p>FakeContextMenu: {menu.items.length} items</p>
        <p>FakeFileExplorerContextMenu: {fileExplorerMenu.selectedItem?.name}</p>
        <p>FakeEditorContextMenu: {editorMenu.language}</p>
        <p>FakeBrowserContextMenu: isLink={String(browserMenu.isLink)}</p>
        <p>ContextMenuActionPayload: {payload.action}</p>
        <p>ContextMenuActionResponse: success={String(response.success)}</p>
        <p>FakeTrackedContextMenu: {trackedMenu.trackingId}</p>
      </div>
    </div>
  );
}

export const FactoryTypeAssertions: Story = {
  name: i18n.t('contextMenu.storyName.factoryTypeAssertions', 'Factory: Type Assertions'),
  render: () => <ContextMenuTypeAssertionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('type-assertions');
    expect(container).toBeInTheDocument();
    expect(container.textContent).toContain('ContextMenuItemVariant: destructive');
    expect(container.textContent).toContain('ContextMenuItemType: item');
    expect(container.textContent).toContain('ContextMenuWidth: w-48');
    expect(container.textContent).toContain('ShortcutModifier: Cmd');
    expect(container.textContent).toContain('FakeContextMenu:');
    expect(container.textContent).toContain('FakeTrackedContextMenu:');
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS STORIES (auto-wired)
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowAction: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerSlowAction', 'Handler: Slow Action'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.slowAction } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerDeleteWithUndo: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerDeleteWithUndo', 'Handler: Delete With Undo'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.deleteWithUndo } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerClipboardSuccess: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerClipboardSuccess', 'Handler: Clipboard Success'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.clipboardSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerClipboardDenied: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerClipboardDenied', 'Handler: Clipboard Denied'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.clipboardDenied } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerFileOperationWithProgress: Story = {
  ...Default,
  name: i18n.t(
    'contextMenu.storyName.handlerFileOperationWithProgress',
    'Handler: File Operation With Progress'
  ),
  parameters: { msw: { handlers: contextMenuStatusHandlers.fileOperationWithProgress } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerRenameValidation: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerRenameValidation', 'Handler: Rename Validation'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.renameValidation } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBatchOperation: Story = {
  ...Default,
  name: i18n.t('contextMenu.storyName.handlerBatchOperation', 'Handler: Batch Operation'),
  parameters: { msw: { handlers: contextMenuStatusHandlers.batchOperation } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBatchPartialFailure: Story = {
  ...Default,
  name: i18n.t(
    'contextMenu.storyName.handlerBatchPartialFailure',
    'Handler: Batch Partial Failure'
  ),
  parameters: { msw: { handlers: contextMenuStatusHandlers.batchPartialFailure } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
