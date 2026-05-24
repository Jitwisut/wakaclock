import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  createFakeArrowKeys,
  createFakeFunctionKeys,
  createFakeKbd,
  createFakeKbdCategoryMatrix,
  createFakeKbdFromLabel,
  createFakeKbdGroup,
  createFakeKbdModifierMatrix,
  createFakeKbdPlatformMatrix,
  createFakeKbds,
  createFakeKbdShortcutCollection,
  createFakeKbdShortcutMatrix,
  createFakeKbdShowcase,
  createFakeKeyboardShortcut,
  createFakeMacModifiers,
  createFakeShortcutForAction,
  createFakeWindowsModifiers,
  KBD_ACTION_KEYS,
  KBD_ARROW_KEY_NAMES,
  KBD_ARROW_KEYS,
  KBD_COMMON_SHORTCUTS,
  KBD_FUNCTION_KEYS,
  KBD_KEY_CATEGORIES,
  KBD_LETTERS,
  KBD_MODIFIER_SYMBOLS,
  KBD_MODIFIERS,
  KBD_NAVIGATION_KEYS,
  KBD_NUMBERS,
  KBD_PLATFORMS,
  KBD_SHORTCUT_ACTIONS,
  KBD_SYMBOL_KEYS,
} from '@/.storybook/stories/_factories/kbd.factory';
import type {
  FakeKbd,
  FakeKbdGroup,
  FakeKbdShortcutCollection,
  FakeKeyboardShortcut,
  KbdKeyCategory,
  KbdPlatform,
  KbdShortcutAction,
} from '@/.storybook/stories/_factories/kbd.factory';
import { kbdHandlers, kbdStatusHandlers } from '@/.storybook/stories/_handlers/kbd.handlers';

import { useTranslation } from 'react-i18next';

import { Kbd, KbdGroup } from '@/components/ui/kbd';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function I18nKbdGroupDemo() {
  const { t } = useTranslation();

  return (
    <div className="text-sm">
      {t('kbd.group.prefix')}{' '}
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>{' '}
      {t('kbd.group.suffix')}
    </div>
  );
}

const meta = {
  title: 'Components/UI/Kbd',
  component: Kbd,
  tags: ['autodocs'],
  args: {
    children: '⌘K',
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('kbd.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('kbd.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('kbd.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('kbd.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('kbd.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('kbd.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('kbd.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    // Content
    children: {
      control: 'text',
      description: i18n.t(
        'kbd.argType.keyLabelContentTextSymbolOrIcon',
        'Key label content (text, symbol, or icon)'
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
        'kbd.argType.additionalCssClassesForCustomStyling',
        'Additional CSS classes for custom styling'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // HTML
    title: {
      control: 'text',
      description: i18n.t('kbd.argType.tooltipTextShownOnHover', 'Tooltip text shown on hover'),
      table: {
        category: 'HTML',
        type: { summary: 'string' },
      },
    },
  },
  parameters: {
    msw: { handlers: kbdHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => <Kbd {...args}>{args.children}</Kbd>,
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
    expect(kbd?.tagName).toBe('KBD');
  },
};

function KbdVariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('kbd.variants.singleKey')}</p>
        <Kbd>K</Kbd>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('kbd.variants.comboKeys')}</p>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('kbd.variants.withModifiers')}</p>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>P</Kbd>
        </KbdGroup>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('kbd.variants.styled')}</p>
        <Kbd className="bg-primary text-primary-foreground">
          {i18n.t('kbd.story.enter', 'Enter')}
        </Kbd>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <KbdVariantsDemo />,
  play: async ({ canvasElement }) => {
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBeGreaterThanOrEqual(4);
    const groups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(groups.length).toBeGreaterThanOrEqual(2);
  },
};

function KbdSizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('kbd.sizes.extraSmall')}</p>
        <Kbd className="px-1 py-0.5 text-[10px]">⌘K</Kbd>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('kbd.sizes.small')}</p>
        <Kbd className="px-1.5 py-0.5 text-xs">⌘K</Kbd>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('kbd.sizes.default')}</p>
        <Kbd>⌘K</Kbd>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('kbd.sizes.large')}</p>
        <Kbd className="px-2.5 py-1 text-base">⌘K</Kbd>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <KbdSizesDemo />,
  play: async ({ canvasElement }) => {
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(4);
  },
};

export const Single: Story = {
  render: () => <Kbd>⌘K</Kbd>,
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
    expect(kbd?.textContent?.trim()).toBe('⌘K');
  },
};

export const Group: Story = {
  render: () => <I18nKbdGroupDemo />,
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-slot="kbd-group"]');
    expect(group).toBeInTheDocument();
    const keys = group?.querySelectorAll('[data-slot="kbd"]');
    expect(keys?.length).toBe(2);
  },
};

export const CommonShortcuts: Story = {
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.copy', 'Copy')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>C</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.paste', 'Paste')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>V</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.cut', 'Cut')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>X</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.undo', 'Undo')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>Z</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.redo', 'Redo')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>Z</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.save', 'Save')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>S</Kbd>
        </KbdGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Copy')).toBeInTheDocument();
    expect(canvas.getByText('Save')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(groups.length).toBe(6);
  },
};

export const NavigationShortcuts: Story = {
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.search', 'Search')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.settings', 'Settings')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>,</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.goToFile', 'Go to File')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>P</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.commandPalette', 'Command Palette')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>P</Kbd>
        </KbdGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Search')).toBeInTheDocument();
    expect(canvas.getByText('Command Palette')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(groups.length).toBe(4);
  },
};

export const SingleKeys: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Kbd>{i18n.t('kbd.story.esc', 'Esc')}</Kbd>
      <Kbd>{i18n.t('kbd.story.tab', 'Tab')}</Kbd>
      <Kbd>{i18n.t('kbd.story.enter', 'Enter')}</Kbd>
      <Kbd>{i18n.t('kbd.story.space', 'Space')}</Kbd>
      <Kbd>{i18n.t('kbd.story.delete', 'Delete')}</Kbd>
      <Kbd>{i18n.t('kbd.story.backspace', 'Backspace')}</Kbd>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(6);
  },
};

export const ModifierKeys: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Kbd>⌘</Kbd>
      <Kbd>⌥</Kbd>
      <Kbd>⌃</Kbd>
      <Kbd>⇧</Kbd>
      <Kbd>Fn</Kbd>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(5);
  },
};

export const ArrowKeys: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-1">
      <Kbd>↑</Kbd>
      <div className="flex gap-1">
        <Kbd>←</Kbd>
        <Kbd>↓</Kbd>
        <Kbd>→</Kbd>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(4);
  },
};

export const FunctionKeys: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Kbd>F1</Kbd>
      <Kbd>F2</Kbd>
      <Kbd>F3</Kbd>
      <Kbd>F4</Kbd>
      <Kbd>F5</Kbd>
      <Kbd>F6</Kbd>
      <Kbd>F7</Kbd>
      <Kbd>F8</Kbd>
      <Kbd>F9</Kbd>
      <Kbd>F10</Kbd>
      <Kbd>F11</Kbd>
      <Kbd>F12</Kbd>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(12);
  },
};

export const WindowsKeys: Story = {
  name: i18n.t('kbd.storyName.windowsKeys', 'Windows Keys'),
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.copy', 'Copy')}</span>
        <KbdGroup>
          <Kbd>{i18n.t('kbd.story.ctrl', 'Ctrl')}</Kbd>
          <Kbd>C</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.paste', 'Paste')}</span>
        <KbdGroup>
          <Kbd>{i18n.t('kbd.story.ctrl', 'Ctrl')}</Kbd>
          <Kbd>V</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.undo', 'Undo')}</span>
        <KbdGroup>
          <Kbd>{i18n.t('kbd.story.ctrl', 'Ctrl')}</Kbd>
          <Kbd>Z</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-8">
        <span className="text-sm">{i18n.t('kbd.story.taskManager', 'Task Manager')}</span>
        <KbdGroup>
          <Kbd>{i18n.t('kbd.story.ctrl', 'Ctrl')}</Kbd>
          <Kbd>{i18n.t('kbd.story.shift', 'Shift')}</Kbd>
          <Kbd>{i18n.t('kbd.story.esc', 'Esc')}</Kbd>
        </KbdGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Copy')).toBeInTheDocument();
    expect(canvas.getByText('Task Manager')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(groups.length).toBe(4);
  },
};

export const InlineWithText: Story = {
  render: () => (
    <div className="space-y-4 text-sm">
      <p>
        Press <Kbd>⌘</Kbd> + <Kbd>K</Kbd> to open the command palette.
      </p>
      <p>
        Use <Kbd>{i18n.t('kbd.story.tab', 'Tab')}</Kbd> to navigate between elements and{' '}
        <Kbd>{i18n.t('kbd.story.enter', 'Enter')}</Kbd> to select.
      </p>
      <p>
        Press <Kbd>{i18n.t('kbd.story.esc', 'Esc')}</Kbd> to close any modal or popover.
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBeGreaterThanOrEqual(4);
  },
};

export const InMenuItems: Story = {
  render: () => (
    <div className="bg-popover text-popover-foreground w-[200px] rounded-lg border p-1">
      <div className="hover:bg-accent flex items-center justify-between rounded-sm px-2 py-1.5 text-sm">
        <span>{i18n.t('kbd.story.newFile', 'New File')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>N</Kbd>
        </KbdGroup>
      </div>
      <div className="hover:bg-accent flex items-center justify-between rounded-sm px-2 py-1.5 text-sm">
        <span>{i18n.t('kbd.story.open', 'Open')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>O</Kbd>
        </KbdGroup>
      </div>
      <div className="hover:bg-accent flex items-center justify-between rounded-sm px-2 py-1.5 text-sm">
        <span>{i18n.t('kbd.story.save', 'Save')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>S</Kbd>
        </KbdGroup>
      </div>
      <div className="bg-border my-1 h-px" />
      <div className="hover:bg-accent flex items-center justify-between rounded-sm px-2 py-1.5 text-sm">
        <span>{i18n.t('kbd.story.quit', 'Quit')}</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>Q</Kbd>
        </KbdGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('New File')).toBeInTheDocument();
    expect(canvas.getByText('Quit')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(groups.length).toBe(4);
  },
};

export const InTooltip: Story = {
  name: i18n.t('kbd.storyName.inTooltip', 'In Tooltip Context'),
  render: () => (
    <div className="bg-primary text-primary-foreground inline-flex rounded-md px-3 py-2 text-sm">
      Search{' '}
      <span className="ml-2">
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-slot="kbd-group"]');
    expect(group).toBeInTheDocument();
  },
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Kbd title={i18n.t('kbd.story.command', 'Command')}>
        <svg
          className="size-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
        </svg>
      </Kbd>
      <span className="text-sm">+</span>
      <Kbd>K</Kbd>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(2);
  },
};

export const ShortcutHelpPanel: Story = {
  name: i18n.t('kbd.storyName.shortcutHelpPanel', 'Shortcut Help Panel'),
  render: () => (
    <div className="w-[400px] space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">
        {i18n.t('kbd.story.keyboardShortcuts', 'Keyboard Shortcuts')}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-muted-foreground text-sm font-medium">
            {i18n.t('kbd.story.general', 'General')}
          </h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span>{i18n.t('kbd.story.search', 'Search')}</span>
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>{i18n.t('kbd.story.settings', 'Settings')}</span>
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>,</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>{i18n.t('kbd.story.help', 'Help')}</span>
              <Kbd>?</Kbd>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="text-muted-foreground text-sm font-medium">
            {i18n.t('kbd.story.navigation', 'Navigation')}
          </h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span>{i18n.t('kbd.story.next', 'Next')}</span>
              <Kbd>J</Kbd>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>{i18n.t('kbd.story.previous', 'Previous')}</span>
              <Kbd>K</Kbd>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>{i18n.t('kbd.story.open', 'Open')}</span>
              <Kbd>{i18n.t('kbd.story.enter', 'Enter')}</Kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(canvas.getByText('General')).toBeInTheDocument();
    expect(canvas.getByText('Navigation')).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText('⌘K')).toBeInTheDocument();

    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    if (!(kbd instanceof HTMLElement)) {
      throw new Error('Kbd element was not found.');
    }

    expect(kbd.tagName).toBe('KBD');
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Group,
  globals: {
    ...(Group.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    expect(doc.documentElement.lang).toBe('ja');
    expect(canvas.getByText('検索するには')).toBeInTheDocument();
    expect(canvas.getByText('を押してください')).toBeInTheDocument();

    const group = canvasElement.querySelector('[data-slot="kbd-group"]');
    if (!(group instanceof HTMLElement)) {
      throw new Error('KbdGroup element was not found.');
    }

    const keys = group.querySelectorAll('[data-slot="kbd"]');
    expect(keys.length).toBe(2);
    expect(keys[0]?.textContent?.trim()).toBe('⌘');
    expect(keys[1]?.textContent?.trim()).toBe('K');
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
  name: i18n.t('kbd.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-8">
        <span id="search-label" className="text-sm">
          Search
        </span>
        <KbdGroup aria-labelledby="search-label">
          <Kbd aria-label={i18n.t('kbd.story.commandKey', 'Command key')}>⌘</Kbd>
          <Kbd aria-label={i18n.t('kbd.story.kKey', 'K key')}>K</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-8">
        <span id="save-label" className="text-sm">
          Save
        </span>
        <KbdGroup aria-labelledby="save-label">
          <Kbd aria-label={i18n.t('kbd.story.commandKey', 'Command key')}>⌘</Kbd>
          <Kbd aria-label={i18n.t('kbd.story.sKey', 'S key')}>S</Kbd>
        </KbdGroup>
      </div>
      <p className="text-sm">
        Press <Kbd title={i18n.t('kbd.story.commandK', 'Command + K')}>⌘K</Kbd> to open the command
        palette.
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find kbd elements
    const kbdElements = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbdElements.length).toBe(5);

    // Verify kbd groups have proper associations
    const kbdGroups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(kbdGroups.length).toBe(2);

    // Check first group is labeled by search-label
    const searchGroup = kbdGroups[0];
    expect(searchGroup?.getAttribute('aria-labelledby')).toBe('search-label');

    // Find the text content
    expect(canvas.getByText('Search')).toBeInTheDocument();
    expect(canvas.getByText('Save')).toBeInTheDocument();

    // Verify title attribute on inline kbd
    const inlineKbd = canvas.getByTitle('Command + K');
    expect(inlineKbd).toBeInTheDocument();
  },
};

// ============ MSW Handler Stories ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdHandlers },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

// ============ COMBO KEY STORIES ============

export const ComboTwoKeys: Story = {
  name: i18n.t('kbd.storyName.comboTwoKeys', 'Combo - Two Keys'),
  render: () => (
    <div className="space-y-4">
      <div className="flex w-[300px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.copy', 'Copy')}</span>
        <KbdGroup data-testid="combo-copy">
          <Kbd>⌘</Kbd>
          <Kbd>C</Kbd>
        </KbdGroup>
      </div>
      <div className="flex w-[300px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.paste', 'Paste')}</span>
        <KbdGroup data-testid="combo-paste">
          <Kbd>⌘</Kbd>
          <Kbd>V</Kbd>
        </KbdGroup>
      </div>
      <div className="flex w-[300px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.selectAll', 'Select All')}</span>
        <KbdGroup data-testid="combo-select-all">
          <Kbd>⌘</Kbd>
          <Kbd>A</Kbd>
        </KbdGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const comboCopy = canvasElement.querySelector('[data-testid="combo-copy"]');
    expect(comboCopy).toBeInTheDocument();

    const keys = comboCopy?.querySelectorAll('[data-slot="kbd"]');
    expect(keys).toHaveLength(2);
  },
};

export const ComboThreeKeys: Story = {
  name: i18n.t('kbd.storyName.comboThreeKeys', 'Combo - Three Keys'),
  render: () => (
    <div className="space-y-4">
      <div className="flex w-[300px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.redo', 'Redo')}</span>
        <KbdGroup data-testid="combo-redo">
          <Kbd>⌘</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>Z</Kbd>
        </KbdGroup>
      </div>
      <div className="flex w-[300px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.commandPalette', 'Command Palette')}</span>
        <KbdGroup data-testid="combo-palette">
          <Kbd>⌘</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>P</Kbd>
        </KbdGroup>
      </div>
      <div className="flex w-[300px] items-center justify-between">
        <span className="text-sm">
          {i18n.t('kbd.story.screenshotSelection', 'Screenshot Selection')}
        </span>
        <KbdGroup data-testid="combo-screenshot">
          <Kbd>⌘</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>4</Kbd>
        </KbdGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const comboRedo = canvasElement.querySelector('[data-testid="combo-redo"]');
    expect(comboRedo).toBeInTheDocument();

    const keys = comboRedo?.querySelectorAll('[data-slot="kbd"]');
    expect(keys).toHaveLength(3);
  },
};

export const ComboFourKeys: Story = {
  name: i18n.t('kbd.storyName.comboFourKeys', 'Combo - Four Keys'),
  render: () => (
    <div className="space-y-4">
      <div className="flex w-[350px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.forceQuitDialog', 'Force Quit Dialog')}</span>
        <KbdGroup data-testid="combo-force-quit">
          <Kbd>⌘</Kbd>
          <Kbd>⌥</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>{i18n.t('kbd.story.esc', 'Esc')}</Kbd>
        </KbdGroup>
      </div>
      <div className="flex w-[350px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.developerTools', 'Developer Tools')}</span>
        <KbdGroup data-testid="combo-dev-tools">
          <Kbd>⌘</Kbd>
          <Kbd>⌥</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>I</Kbd>
        </KbdGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const comboForceQuit = canvasElement.querySelector('[data-testid="combo-force-quit"]');
    expect(comboForceQuit).toBeInTheDocument();

    const keys = comboForceQuit?.querySelectorAll('[data-slot="kbd"]');
    expect(keys).toHaveLength(4);
  },
};

export const ComboWithArrowKeys: Story = {
  name: i18n.t('kbd.storyName.comboWithArrowKeys', 'Combo - With Arrow Keys'),
  render: () => (
    <div className="space-y-4">
      <div className="flex w-[300px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.switchTabLeft', 'Switch Tab Left')}</span>
        <KbdGroup data-testid="combo-tab-left">
          <Kbd>⌘</Kbd>
          <Kbd>⌥</Kbd>
          <Kbd>←</Kbd>
        </KbdGroup>
      </div>
      <div className="flex w-[300px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.switchTabRight', 'Switch Tab Right')}</span>
        <KbdGroup data-testid="combo-tab-right">
          <Kbd>⌘</Kbd>
          <Kbd>⌥</Kbd>
          <Kbd>→</Kbd>
        </KbdGroup>
      </div>
      <div className="flex w-[300px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.moveLineUp', 'Move Line Up')}</span>
        <KbdGroup>
          <Kbd>⌥</Kbd>
          <Kbd>↑</Kbd>
        </KbdGroup>
      </div>
      <div className="flex w-[300px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.moveLineDown', 'Move Line Down')}</span>
        <KbdGroup>
          <Kbd>⌥</Kbd>
          <Kbd>↓</Kbd>
        </KbdGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const comboTabLeft = canvasElement.querySelector('[data-testid="combo-tab-left"]');
    expect(comboTabLeft).toBeInTheDocument();
  },
};

export const ComboSequence: Story = {
  name: i18n.t('kbd.storyName.comboSequence', 'Combo - Sequential (Then)'),
  render: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Sequential key combinations (press one after another)
      </p>
      <div className="flex w-[350px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.gitCommit', 'Git Commit')}</span>
        <div className="flex items-center gap-1">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
          <span className="text-muted-foreground text-xs">then</span>
          <Kbd>C</Kbd>
        </div>
      </div>
      <div className="flex w-[350px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.gitPush', 'Git Push')}</span>
        <div className="flex items-center gap-1">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
          <span className="text-muted-foreground text-xs">then</span>
          <Kbd>P</Kbd>
        </div>
      </div>
      <div className="flex w-[350px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.foldAll', 'Fold All')}</span>
        <div className="flex items-center gap-1">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
          <span className="text-muted-foreground text-xs">then</span>
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>0</Kbd>
          </KbdGroup>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Git Commit')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(groups.length).toBeGreaterThanOrEqual(3);
  },
};

export const ComboOr: Story = {
  name: i18n.t('kbd.storyName.comboOr', 'Combo - Alternative (Or)'),
  render: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'kbd.story.alternativeShortcutsForTheSameAction',
          'Alternative shortcuts for the same action'
        )}
      </p>
      <div className="flex w-[350px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.undo', 'Undo')}</span>
        <div className="flex items-center gap-2">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>Z</Kbd>
          </KbdGroup>
          <span className="text-muted-foreground text-xs">or</span>
          <KbdGroup>
            <Kbd>{i18n.t('kbd.story.ctrl', 'Ctrl')}</Kbd>
            <Kbd>Z</Kbd>
          </KbdGroup>
        </div>
      </div>
      <div className="flex w-[350px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.selectAll', 'Select All')}</span>
        <div className="flex items-center gap-2">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>A</Kbd>
          </KbdGroup>
          <span className="text-muted-foreground text-xs">or</span>
          <KbdGroup>
            <Kbd>{i18n.t('kbd.story.ctrl', 'Ctrl')}</Kbd>
            <Kbd>A</Kbd>
          </KbdGroup>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Undo')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(groups.length).toBe(4);
  },
};

export const ComboMacVsWindows: Story = {
  name: i18n.t('kbd.storyName.comboMacVsWindows', 'Combo - Mac vs Windows'),
  render: () => (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium">macOS</p>
        <div className="space-y-2">
          <div className="flex w-[250px] items-center justify-between">
            <span className="text-sm">{i18n.t('kbd.story.copy', 'Copy')}</span>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>C</Kbd>
            </KbdGroup>
          </div>
          <div className="flex w-[250px] items-center justify-between">
            <span className="text-sm">{i18n.t('kbd.story.paste', 'Paste')}</span>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>V</Kbd>
            </KbdGroup>
          </div>
          <div className="flex w-[250px] items-center justify-between">
            <span className="text-sm">{i18n.t('kbd.story.redo', 'Redo')}</span>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>⇧</Kbd>
              <Kbd>Z</Kbd>
            </KbdGroup>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('kbd.story.windowsLinux')}</p>
        <div className="space-y-2">
          <div className="flex w-[250px] items-center justify-between">
            <span className="text-sm">{i18n.t('kbd.story.copy', 'Copy')}</span>
            <KbdGroup>
              <Kbd>{i18n.t('kbd.story.ctrl', 'Ctrl')}</Kbd>
              <Kbd>C</Kbd>
            </KbdGroup>
          </div>
          <div className="flex w-[250px] items-center justify-between">
            <span className="text-sm">{i18n.t('kbd.story.paste', 'Paste')}</span>
            <KbdGroup>
              <Kbd>{i18n.t('kbd.story.ctrl', 'Ctrl')}</Kbd>
              <Kbd>V</Kbd>
            </KbdGroup>
          </div>
          <div className="flex w-[250px] items-center justify-between">
            <span className="text-sm">{i18n.t('kbd.story.redo', 'Redo')}</span>
            <KbdGroup>
              <Kbd>{i18n.t('kbd.story.ctrl', 'Ctrl')}</Kbd>
              <Kbd>Y</Kbd>
            </KbdGroup>
          </div>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('macOS')).toBeInTheDocument();
    expect(canvas.getByText(i18n.t('kbd.story.windowsLinux'))).toBeInTheDocument();
  },
};

export const ComboApplicationSpecific: Story = {
  name: i18n.t('kbd.storyName.comboApplicationSpecific', 'Combo - Application Specific'),
  render: () => (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('kbd.story.vsCode', 'VS Code')}</p>
        <div className="space-y-2">
          <div className="flex w-[300px] items-center justify-between">
            <span className="text-sm">{i18n.t('kbd.story.quickOpen', 'Quick Open')}</span>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>P</Kbd>
            </KbdGroup>
          </div>
          <div className="flex w-[300px] items-center justify-between">
            <span className="text-sm">
              {i18n.t('kbd.story.goToDefinition', 'Go to Definition')}
            </span>
            <Kbd>F12</Kbd>
          </div>
          <div className="flex w-[300px] items-center justify-between">
            <span className="text-sm">{i18n.t('kbd.story.peekDefinition', 'Peek Definition')}</span>
            <KbdGroup>
              <Kbd>⌥</Kbd>
              <Kbd>F12</Kbd>
            </KbdGroup>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('kbd.story.chromeDevtools', 'Chrome DevTools')}
        </p>
        <div className="space-y-2">
          <div className="flex w-[300px] items-center justify-between">
            <span className="text-sm">{i18n.t('kbd.story.openDevtools', 'Open DevTools')}</span>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>⌥</Kbd>
              <Kbd>I</Kbd>
            </KbdGroup>
          </div>
          <div className="flex w-[300px] items-center justify-between">
            <span className="text-sm">{i18n.t('kbd.story.openConsole', 'Open Console')}</span>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>⌥</Kbd>
              <Kbd>J</Kbd>
            </KbdGroup>
          </div>
          <div className="flex w-[300px] items-center justify-between">
            <span className="text-sm">{i18n.t('kbd.story.inspectElement', 'Inspect Element')}</span>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>⇧</Kbd>
              <Kbd>C</Kbd>
            </KbdGroup>
          </div>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('VS Code')).toBeInTheDocument();
    expect(canvas.getByText('Chrome DevTools')).toBeInTheDocument();
  },
};

export const ComboWithHold: Story = {
  name: i18n.t('kbd.storyName.comboWithHold', 'Combo - Hold Key'),
  render: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'kbd.story.holdAKeyWhilePerformingAnAction',
          'Hold a key while performing an action'
        )}
      </p>
      <div className="flex w-[350px] items-center justify-between">
        <span className="text-sm">
          {i18n.t('kbd.story.duplicateSelection', 'Duplicate Selection')}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-xs">{i18n.t('kbd.story.hold', 'Hold')}</span>
          <Kbd>⌥</Kbd>
          <span className="text-muted-foreground text-xs">+ Drag</span>
        </div>
      </div>
      <div className="flex w-[350px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.slowScroll', 'Slow Scroll')}</span>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-xs">{i18n.t('kbd.story.hold', 'Hold')}</span>
          <Kbd>⇧</Kbd>
          <span className="text-muted-foreground text-xs">+ Scroll</span>
        </div>
      </div>
      <div className="flex w-[350px] items-center justify-between">
        <span className="text-sm">{i18n.t('kbd.story.fineTuneSlider')}</span>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-xs">{i18n.t('kbd.story.hold', 'Hold')}</span>
          <Kbd>⌥</Kbd>
          <span className="text-muted-foreground text-xs">+ Drag slider</span>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Duplicate Selection')).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBeGreaterThanOrEqual(2);
  },
};

export const CombosInTable: Story = {
  name: i18n.t('kbd.storyName.combosInTable', 'Combo - Reference Table'),
  render: () => (
    <div className="w-[500px] rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-3 text-left font-medium">{i18n.t('kbd.story.action', 'Action')}</th>
            <th className="p-3 text-left font-medium">macOS</th>
            <th className="p-3 text-left font-medium">{i18n.t('kbd.story.windows', 'Windows')}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="p-3">{i18n.t('kbd.story.cut', 'Cut')}</td>
            <td className="p-3">
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>X</Kbd>
              </KbdGroup>
            </td>
            <td className="p-3">
              <KbdGroup>
                <Kbd>{i18n.t('kbd.story.ctrl', 'Ctrl')}</Kbd>
                <Kbd>X</Kbd>
              </KbdGroup>
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-3">{i18n.t('kbd.story.copy', 'Copy')}</td>
            <td className="p-3">
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>C</Kbd>
              </KbdGroup>
            </td>
            <td className="p-3">
              <KbdGroup>
                <Kbd>{i18n.t('kbd.story.ctrl', 'Ctrl')}</Kbd>
                <Kbd>C</Kbd>
              </KbdGroup>
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-3">{i18n.t('kbd.story.paste', 'Paste')}</td>
            <td className="p-3">
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>V</Kbd>
              </KbdGroup>
            </td>
            <td className="p-3">
              <KbdGroup>
                <Kbd>{i18n.t('kbd.story.ctrl', 'Ctrl')}</Kbd>
                <Kbd>V</Kbd>
              </KbdGroup>
            </td>
          </tr>
          <tr>
            <td className="p-3">{i18n.t('kbd.story.find', 'Find')}</td>
            <td className="p-3">
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>F</Kbd>
              </KbdGroup>
            </td>
            <td className="p-3">
              <KbdGroup>
                <Kbd>{i18n.t('kbd.story.ctrl', 'Ctrl')}</Kbd>
                <Kbd>F</Kbd>
              </KbdGroup>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Cut')).toBeInTheDocument();
    expect(canvas.getByText('Find')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(groups.length).toBe(8);
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const WithFakerData: Story = {
  render: () => {
    const fakeKeys = createFakeKbds(5);

    return (
      <div className="flex flex-wrap items-center gap-3" data-testid="kbd-faker">
        {fakeKeys.map((key) => (
          <Kbd key={key.id}>{key.label}</Kbd>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="kbd-faker"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(5);
    kbds.forEach((kbd) => {
      expect(kbd.textContent?.trim().length).not.toBe(0);
    });
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdHandlers },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

// ============ MISSING HANDLER STORIES ============

export const SuccessResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  parameters: {
    msw: { handlers: kbdStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    const kbd = canvasElement.querySelector('[data-slot="kbd"]');
    expect(kbd).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeKbd ============

function CreateFakeKbdDemo() {
  const singleKey = createFakeKbd();
  const letterKey = createFakeKbd({ label: 'A', category: 'letter' });
  const modifierKey = createFakeKbd({ label: '⌘', category: 'modifier', isModifier: true });

  return (
    <div className="space-y-4" data-testid="create-fake-kbd">
      <p className="text-sm font-medium">{i18n.t('kbd.story.description')}</p>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Random:</span>
          <Kbd data-testid="kbd-random">{singleKey.label}</Kbd>
          <span className="text-muted-foreground text-xs">({singleKey.category})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Letter:</span>
          <Kbd data-testid="kbd-letter">{letterKey.label}</Kbd>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Modifier:</span>
          <Kbd data-testid="kbd-modifier">{modifierKey.label}</Kbd>
        </div>
      </div>
    </div>
  );
}

export const FactoryCreateFakeKbd: Story = {
  render: () => <CreateFakeKbdDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="create-fake-kbd"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="kbd-random"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="kbd-letter"]')?.textContent?.trim()).toBe(
      'A'
    );
    expect(canvasElement.querySelector('[data-testid="kbd-modifier"]')?.textContent?.trim()).toBe(
      '⌘'
    );
  },
};

// ============ FACTORY: createFakeKbdFromLabel ============

function CreateFakeKbdFromLabelDemo() {
  const { t } = useTranslation();
  const labels = ['⌘', 'A', 'F1', 'Enter', '↑', 'Home', '+'];
  const keys = labels.map((label) => createFakeKbdFromLabel(label));

  return (
    <div className="space-y-4" data-testid="from-label">
      <p className="text-sm font-medium">{t('kbd.section.variants')}</p>
      <div className="flex flex-wrap gap-2">
        {keys.map((key) => (
          <div key={key.id} className="flex flex-col items-center gap-1">
            <Kbd>{key.label}</Kbd>
            <span className="text-muted-foreground text-[10px]">{key.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryCreateFakeKbdFromLabel: Story = {
  render: () => <CreateFakeKbdFromLabelDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="from-label"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(7);
  },
};

// ============ FACTORY: createFakeKeyboardShortcut ============

function CreateFakeKeyboardShortcutDemo() {
  const shortcut = createFakeKeyboardShortcut();

  return (
    <div className="space-y-4" data-testid="keyboard-shortcut">
      <p className="text-sm font-medium">{i18n.t('kbd.section.combinations')}</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-8">
          <span className="text-sm">{shortcut.description}</span>
          <KbdGroup data-testid="shortcut-group">
            {shortcut.keys.map((key) => (
              <Kbd key={key.id}>{key.label}</Kbd>
            ))}
          </KbdGroup>
        </div>
        <p className="text-muted-foreground text-xs">
          Platform: {shortcut.platform} | Formatted: {shortcut.formatted}
        </p>
      </div>
    </div>
  );
}

export const FactoryCreateFakeKeyboardShortcut: Story = {
  render: () => <CreateFakeKeyboardShortcutDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="keyboard-shortcut"]');
    expect(container).toBeInTheDocument();
    const group = canvasElement.querySelector('[data-testid="shortcut-group"]');
    expect(group).toBeInTheDocument();
    const kbds = group?.querySelectorAll('[data-slot="kbd"]');
    expect(kbds?.length).toBeGreaterThanOrEqual(1);
  },
};

// ============ FACTORY: createFakeShortcutForAction ============

function CreateFakeShortcutForActionDemo() {
  const actions: KbdShortcutAction[] = ['save', 'copy', 'paste', 'undo', 'redo', 'find'];
  const shortcuts = actions.map((action) => createFakeShortcutForAction(action, 'mac'));

  return (
    <div className="space-y-4" data-testid="shortcut-for-action">
      <p className="text-sm font-medium">{i18n.t('kbd.section.combinations')}</p>
      <div className="space-y-2">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.id} className="flex items-center justify-between gap-8">
            <span className="text-sm">{shortcut.description}</span>
            <KbdGroup>
              {shortcut.keys.map((key) => (
                <Kbd key={key.id}>{key.label}</Kbd>
              ))}
            </KbdGroup>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryCreateFakeShortcutForAction: Story = {
  render: () => <CreateFakeShortcutForActionDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="shortcut-for-action"]');
    expect(container).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Save')).toBeInTheDocument();
    expect(canvas.getByText('Copy')).toBeInTheDocument();
    expect(canvas.getByText('Find')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(groups.length).toBe(6);
  },
};

// ============ FACTORY: createFakeKbdGroup ============

function CreateFakeKbdGroupDemo() {
  const groupCmdK = createFakeKbdGroup(['⌘', 'K']);
  const groupCtrlAltDel = createFakeKbdGroup([
    i18n.t('kbd.story.ctrl', 'Ctrl'),
    i18n.t('kbd.story.alt', 'Alt'),
    i18n.t('kbd.story.delete', 'Delete'),
  ]);
  const randomGroup = createFakeKbdGroup();

  return (
    <div className="space-y-4" data-testid="kbd-group-factory">
      <p className="text-sm font-medium">{i18n.t('kbd.section.combinations')}</p>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Cmd+K:</span>
          <KbdGroup data-testid="group-cmdk">
            {groupCmdK.keys.map((key) => (
              <Kbd key={key.id}>{key.label}</Kbd>
            ))}
          </KbdGroup>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Ctrl+Alt+Del:</span>
          <KbdGroup data-testid="group-cad">
            {groupCtrlAltDel.keys.map((key) => (
              <Kbd key={key.id}>{key.label}</Kbd>
            ))}
          </KbdGroup>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Random:</span>
          <KbdGroup data-testid="group-random">
            {randomGroup.keys.map((key) => (
              <Kbd key={key.id}>{key.label}</Kbd>
            ))}
          </KbdGroup>
        </div>
      </div>
    </div>
  );
}

export const FactoryCreateFakeKbdGroup: Story = {
  render: () => <CreateFakeKbdGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="kbd-group-factory"]');
    expect(container).toBeInTheDocument();
    const cmdkGroup = canvasElement.querySelector('[data-testid="group-cmdk"]');
    expect(cmdkGroup?.querySelectorAll('[data-slot="kbd"]').length).toBe(2);
    const cadGroup = canvasElement.querySelector('[data-testid="group-cad"]');
    expect(cadGroup?.querySelectorAll('[data-slot="kbd"]').length).toBe(3);
    const randomGroup = canvasElement.querySelector('[data-testid="group-random"]');
    expect(randomGroup?.querySelectorAll('[data-slot="kbd"]').length).toBeGreaterThanOrEqual(2);
  },
};

// ============ FACTORY: createFakeKbdShortcutCollection ============

function CreateFakeKbdShortcutCollectionDemo() {
  const collection = createFakeKbdShortcutCollection({ title: 'Editing' });

  return (
    <div className="space-y-4" data-testid="shortcut-collection">
      <p className="text-sm font-medium">{i18n.t('kbd.section.combinations')}</p>
      <div className="w-[400px] rounded-lg border p-4">
        <h3 className="mb-3 font-semibold" data-testid="collection-title">
          {collection.title}
        </h3>
        {collection.description && (
          <p className="text-muted-foreground mb-3 text-xs">{collection.description}</p>
        )}
        <p className="text-muted-foreground mb-2 text-xs">Platform: {collection.platform}</p>
        <div className="space-y-2">
          {collection.shortcuts.map((shortcut) => (
            <div key={shortcut.id} className="flex items-center justify-between text-sm">
              <span>{shortcut.description}</span>
              <KbdGroup>
                {shortcut.keys.map((key) => (
                  <Kbd key={key.id}>{key.label}</Kbd>
                ))}
              </KbdGroup>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryCreateFakeKbdShortcutCollection: Story = {
  render: () => <CreateFakeKbdShortcutCollectionDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="shortcut-collection"]');
    expect(container).toBeInTheDocument();
    const title = canvasElement.querySelector('[data-testid="collection-title"]');
    expect(title?.textContent?.trim()).toBe('Editing');
    const groups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(groups.length).toBeGreaterThanOrEqual(4);
  },
};

// ============ FACTORY: createFakeKbdCategoryMatrix ============

function CreateFakeKbdCategoryMatrixDemo() {
  const matrix = createFakeKbdCategoryMatrix();

  return (
    <div className="space-y-4" data-testid="category-matrix">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex flex-wrap gap-3">
        {matrix.map((key) => (
          <div key={key.id} className="flex flex-col items-center gap-1">
            <Kbd>{key.label}</Kbd>
            <span className="text-muted-foreground text-[10px]">{key.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryCreateFakeKbdCategoryMatrix: Story = {
  render: () => <CreateFakeKbdCategoryMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="category-matrix"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(8);
  },
};

// ============ FACTORY: createFakeKbdPlatformMatrix ============

function CreateFakeKbdPlatformMatrixDemo() {
  const matrix = createFakeKbdPlatformMatrix('copy');

  return (
    <div className="space-y-4" data-testid="platform-matrix">
      <p className="text-sm font-medium">{i18n.t('kbd.section.combinations')}</p>
      <div className="space-y-3">
        {matrix.map((shortcut) => (
          <div key={shortcut.id} className="flex items-center justify-between gap-8">
            <span className="text-sm">
              {shortcut.description} ({shortcut.platform})
            </span>
            <KbdGroup>
              {shortcut.keys.map((key) => (
                <Kbd key={key.id}>{key.label}</Kbd>
              ))}
            </KbdGroup>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryCreateFakeKbdPlatformMatrix: Story = {
  render: () => <CreateFakeKbdPlatformMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="platform-matrix"]');
    expect(container).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(groups.length).toBe(3);
  },
};

// ============ FACTORY: createFakeKbdShortcutMatrix ============

function CreateFakeKbdShortcutMatrixDemo() {
  const matrix = createFakeKbdShortcutMatrix('mac');

  return (
    <div className="space-y-4" data-testid="shortcut-matrix">
      <p className="text-sm font-medium">{i18n.t('kbd.section.combinations')}</p>
      <div className="space-y-2">
        {matrix.map((shortcut) => (
          <div key={shortcut.id} className="flex items-center justify-between gap-8">
            <span className="text-sm">{shortcut.description}</span>
            <KbdGroup>
              {shortcut.keys.map((key) => (
                <Kbd key={key.id}>{key.label}</Kbd>
              ))}
            </KbdGroup>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryCreateFakeKbdShortcutMatrix: Story = {
  render: () => <CreateFakeKbdShortcutMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="shortcut-matrix"]');
    expect(container).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Save')).toBeInTheDocument();
    expect(canvas.getByText('Delete')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(groups.length).toBe(14);
  },
};

// ============ FACTORY: createFakeKbdModifierMatrix ============

function CreateFakeKbdModifierMatrixDemo() {
  const macModifiers = createFakeKbdModifierMatrix('mac');
  const winModifiers = createFakeKbdModifierMatrix('windows');

  return (
    <div className="space-y-4" data-testid="modifier-matrix">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="space-y-3">
        <div>
          <p className="text-muted-foreground mb-1 text-xs">macOS</p>
          <div className="flex gap-2" data-testid="modifier-mac">
            {macModifiers.map((key) => (
              <Kbd key={key.id}>{key.label}</Kbd>
            ))}
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">
            {i18n.t('kbd.story.windows', 'Windows')}
          </p>
          <div className="flex gap-2" data-testid="modifier-win">
            {winModifiers.map((key) => (
              <Kbd key={key.id}>{key.label}</Kbd>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const FactoryCreateFakeKbdModifierMatrix: Story = {
  render: () => <CreateFakeKbdModifierMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="modifier-matrix"]');
    expect(container).toBeInTheDocument();
    const macRow = canvasElement.querySelector('[data-testid="modifier-mac"]');
    expect(macRow?.querySelectorAll('[data-slot="kbd"]').length).toBe(5);
    const winRow = canvasElement.querySelector('[data-testid="modifier-win"]');
    expect(winRow?.querySelectorAll('[data-slot="kbd"]').length).toBe(4);
  },
};

// ============ FACTORY: createFakeKbdShowcase ============

function CreateFakeKbdShowcaseDemo() {
  const showcase = createFakeKbdShowcase();
  const letterKey = showcase.letterKey as FakeKbd;
  const numberKey = showcase.numberKey as FakeKbd;
  const cmdKey = showcase.cmdKey as FakeKbd;
  const groupCmdK = showcase.groupCmdK as FakeKbdGroup;
  const shortcutSaveMac = showcase.shortcutSaveMac as FakeKeyboardShortcut;
  const editingShortcuts = showcase.editingShortcuts as FakeKbdShortcutCollection;
  const categoryMatrix = showcase.categoryMatrix as FakeKbd[];

  return (
    <div className="space-y-6" data-testid="kbd-showcase">
      <p className="text-sm font-medium">{i18n.t('kbd.story.description')}</p>
      <div className="space-y-4">
        <div>
          <p className="text-muted-foreground mb-1 text-xs">
            {i18n.t('kbd.story.basicKeys', 'Basic Keys')}
          </p>
          <div className="flex gap-2">
            <Kbd>{letterKey.label}</Kbd>
            <Kbd>{numberKey.label}</Kbd>
            <Kbd>{cmdKey.label}</Kbd>
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">{i18n.t('kbd.story.group', 'Group')}</p>
          <KbdGroup data-testid="showcase-group">
            {groupCmdK.keys.map((key) => (
              <Kbd key={key.id}>{key.label}</Kbd>
            ))}
          </KbdGroup>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">
            {i18n.t('kbd.story.shortcut', 'Shortcut')}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm">{shortcutSaveMac.description}</span>
            <KbdGroup>
              {shortcutSaveMac.keys.map((key) => (
                <Kbd key={key.id}>{key.label}</Kbd>
              ))}
            </KbdGroup>
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">Collection: {editingShortcuts.title}</p>
          <div className="space-y-1">
            {editingShortcuts.shortcuts.slice(0, 3).map((shortcut) => (
              <div key={shortcut.id} className="flex items-center justify-between text-sm">
                <span>{shortcut.description}</span>
                <KbdGroup>
                  {shortcut.keys.map((key) => (
                    <Kbd key={key.id}>{key.label}</Kbd>
                  ))}
                </KbdGroup>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">
            {i18n.t('kbd.story.categoryMatrix', 'Category Matrix')}
          </p>
          <div className="flex gap-2" data-testid="showcase-matrix">
            {categoryMatrix.map((key) => (
              <Kbd key={key.id}>{key.label}</Kbd>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const FactoryCreateFakeKbdShowcase: Story = {
  render: () => <CreateFakeKbdShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="kbd-showcase"]');
    expect(container).toBeInTheDocument();
    const showcaseGroup = canvasElement.querySelector('[data-testid="showcase-group"]');
    expect(showcaseGroup?.querySelectorAll('[data-slot="kbd"]').length).toBe(2);
    const matrix = canvasElement.querySelector('[data-testid="showcase-matrix"]');
    expect(matrix?.querySelectorAll('[data-slot="kbd"]').length).toBe(8);
  },
};

// ============ FACTORY: createFakeMacModifiers ============

function CreateFakeMacModifiersDemo() {
  const modifiers = createFakeMacModifiers();

  return (
    <div className="space-y-4" data-testid="mac-modifiers">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex gap-2">
        {modifiers.map((key) => (
          <div key={key.id} className="flex flex-col items-center gap-1">
            <Kbd>{key.label}</Kbd>
            <span className="text-muted-foreground text-[10px]">
              {key.isModifier ? 'modifier' : key.category}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryCreateFakeMacModifiers: Story = {
  render: () => <CreateFakeMacModifiersDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="mac-modifiers"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(4);
  },
};

// ============ FACTORY: createFakeWindowsModifiers ============

function CreateFakeWindowsModifiersDemo() {
  const modifiers = createFakeWindowsModifiers();

  return (
    <div className="space-y-4" data-testid="windows-modifiers">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex gap-2">
        {modifiers.map((key) => (
          <div key={key.id} className="flex flex-col items-center gap-1">
            <Kbd>{key.label}</Kbd>
            <span className="text-muted-foreground text-[10px]">
              {key.isModifier ? 'modifier' : key.category}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryCreateFakeWindowsModifiers: Story = {
  render: () => <CreateFakeWindowsModifiersDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="windows-modifiers"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(4);
  },
};

// ============ FACTORY: createFakeArrowKeys ============

function CreateFakeArrowKeysDemo() {
  const arrowKeys = createFakeArrowKeys();

  return (
    <div className="space-y-4" data-testid="arrow-keys-factory">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex flex-col items-center gap-1">
        <Kbd>{arrowKeys[0]?.label}</Kbd>
        <div className="flex gap-1">
          <Kbd>{arrowKeys[2]?.label}</Kbd>
          <Kbd>{arrowKeys[1]?.label}</Kbd>
          <Kbd>{arrowKeys[3]?.label}</Kbd>
        </div>
      </div>
    </div>
  );
}

export const FactoryCreateFakeArrowKeys: Story = {
  render: () => <CreateFakeArrowKeysDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="arrow-keys-factory"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(4);
  },
};

// ============ FACTORY: createFakeFunctionKeys ============

function CreateFakeFunctionKeysDemo() {
  const functionKeys = createFakeFunctionKeys();

  return (
    <div className="space-y-4" data-testid="function-keys-factory">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex flex-wrap gap-2">
        {functionKeys.map((key) => (
          <Kbd key={key.id}>{key.label}</Kbd>
        ))}
      </div>
    </div>
  );
}

export const FactoryCreateFakeFunctionKeys: Story = {
  render: () => <CreateFakeFunctionKeysDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="function-keys-factory"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(12);
  },
};

// ============ CONSTANTS: KBD_KEY_CATEGORIES ============

function KbdKeyCategoriesDemo() {
  return (
    <div className="space-y-4" data-testid="key-categories">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex flex-wrap gap-2">
        {KBD_KEY_CATEGORIES.map((category: KbdKeyCategory) => (
          <span key={category} className="bg-muted rounded px-2 py-1 text-xs">
            {category}
          </span>
        ))}
      </div>
    </div>
  );
}

export const ConstantKbdKeyCategories: Story = {
  render: () => <KbdKeyCategoriesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="key-categories"]');
    expect(container).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('modifier')).toBeInTheDocument();
    expect(canvas.getByText('letter')).toBeInTheDocument();
    expect(canvas.getByText('arrow')).toBeInTheDocument();
    expect(canvas.getByText('action')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: KBD_PLATFORMS ============

function KbdPlatformsDemo() {
  return (
    <div className="space-y-4" data-testid="platforms">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex gap-2">
        {KBD_PLATFORMS.map((platform: KbdPlatform) => (
          <span key={platform} className="bg-muted rounded px-2 py-1 text-xs">
            {platform}
          </span>
        ))}
      </div>
    </div>
  );
}

export const ConstantKbdPlatforms: Story = {
  render: () => <KbdPlatformsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="platforms"]');
    expect(container).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('mac')).toBeInTheDocument();
    expect(canvas.getByText('windows')).toBeInTheDocument();
    expect(canvas.getByText('linux')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: KBD_SHORTCUT_ACTIONS ============

function KbdShortcutActionsDemo() {
  return (
    <div className="space-y-4" data-testid="shortcut-actions">
      <p className="text-sm font-medium">{i18n.t('kbd.section.combinations')}</p>
      <div className="flex flex-wrap gap-2">
        {KBD_SHORTCUT_ACTIONS.map((action: KbdShortcutAction) => (
          <span key={action} className="bg-muted rounded px-2 py-1 text-xs">
            {action}
          </span>
        ))}
      </div>
    </div>
  );
}

export const ConstantKbdShortcutActions: Story = {
  render: () => <KbdShortcutActionsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="shortcut-actions"]');
    expect(container).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('save')).toBeInTheDocument();
    expect(canvas.getByText('copy')).toBeInTheDocument();
    expect(canvas.getByText('paste')).toBeInTheDocument();
    expect(canvas.getByText('undo')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: KBD_MODIFIERS ============

function KbdModifiersDemo() {
  return (
    <div className="space-y-4" data-testid="modifiers-constant">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      {(Object.keys(KBD_MODIFIERS) as KbdPlatform[]).map((platform) => (
        <div key={platform}>
          <p className="text-muted-foreground mb-1 text-xs">{platform}</p>
          <div className="flex gap-2">
            {KBD_MODIFIERS[platform].map((mod) => (
              <Kbd key={mod}>{mod}</Kbd>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const ConstantKbdModifiers: Story = {
  render: () => <KbdModifiersDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="modifiers-constant"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    // mac: 5, windows: 4, linux: 4 = 13
    expect(kbds.length).toBe(13);
  },
};

// ============ CONSTANTS: KBD_MODIFIER_SYMBOLS ============

function KbdModifierSymbolsDemo() {
  const entries = Object.entries(KBD_MODIFIER_SYMBOLS);

  return (
    <div className="space-y-4" data-testid="modifier-symbols">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="space-y-2">
        {entries.map(([name, symbol]) => (
          <div key={name} className="flex items-center gap-3">
            <span className="text-muted-foreground w-12 text-xs">{name}</span>
            <Kbd>{symbol}</Kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantKbdModifierSymbols: Story = {
  render: () => <KbdModifierSymbolsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="modifier-symbols"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(6);
  },
};

// ============ CONSTANTS: KBD_LETTERS ============

function KbdLettersDemo() {
  return (
    <div className="space-y-4" data-testid="letters-constant">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex flex-wrap gap-1">
        {KBD_LETTERS.map((letter) => (
          <Kbd key={letter}>{letter}</Kbd>
        ))}
      </div>
    </div>
  );
}

export const ConstantKbdLetters: Story = {
  render: () => <KbdLettersDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="letters-constant"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(26);
  },
};

// ============ CONSTANTS: KBD_NUMBERS ============

function KbdNumbersDemo() {
  return (
    <div className="space-y-4" data-testid="numbers-constant">
      <p className="text-sm font-medium">{i18n.t('kbd.section.sizes')}</p>
      <div className="flex flex-wrap gap-1">
        {KBD_NUMBERS.map((num) => (
          <Kbd key={num}>{num}</Kbd>
        ))}
      </div>
    </div>
  );
}

export const ConstantKbdNumbers: Story = {
  render: () => <KbdNumbersDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="numbers-constant"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(10);
  },
};

// ============ CONSTANTS: KBD_FUNCTION_KEYS ============

function KbdFunctionKeysDemo() {
  return (
    <div className="space-y-4" data-testid="function-keys-constant">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex flex-wrap gap-1">
        {KBD_FUNCTION_KEYS.map((fk) => (
          <Kbd key={fk}>{fk}</Kbd>
        ))}
      </div>
    </div>
  );
}

export const ConstantKbdFunctionKeys: Story = {
  render: () => <KbdFunctionKeysDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="function-keys-constant"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(12);
  },
};

// ============ CONSTANTS: KBD_NAVIGATION_KEYS ============

function KbdNavigationKeysDemo() {
  return (
    <div className="space-y-4" data-testid="navigation-keys-constant">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex flex-wrap gap-1">
        {KBD_NAVIGATION_KEYS.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </div>
    </div>
  );
}

export const ConstantKbdNavigationKeys: Story = {
  render: () => <KbdNavigationKeysDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="navigation-keys-constant"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(6);
  },
};

// ============ CONSTANTS: KBD_ARROW_KEYS ============

function KbdArrowKeysDemo() {
  return (
    <div className="space-y-4" data-testid="arrow-keys-constant">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex gap-1">
        {KBD_ARROW_KEYS.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </div>
    </div>
  );
}

export const ConstantKbdArrowKeys: Story = {
  render: () => <KbdArrowKeysDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="arrow-keys-constant"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(4);
  },
};

// ============ CONSTANTS: KBD_ARROW_KEY_NAMES ============

function KbdArrowKeyNamesDemo() {
  return (
    <div className="space-y-4" data-testid="arrow-key-names-constant">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex gap-1">
        {KBD_ARROW_KEY_NAMES.map((name) => (
          <Kbd key={name}>{name}</Kbd>
        ))}
      </div>
    </div>
  );
}

export const ConstantKbdArrowKeyNames: Story = {
  render: () => <KbdArrowKeyNamesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="arrow-key-names-constant"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(4);
    const canvas = within(canvasElement);
    expect(canvas.getByText('Up')).toBeInTheDocument();
    expect(canvas.getByText('Down')).toBeInTheDocument();
    expect(canvas.getByText('Left')).toBeInTheDocument();
    expect(canvas.getByText('Right')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: KBD_ACTION_KEYS ============

function KbdActionKeysDemo() {
  return (
    <div className="space-y-4" data-testid="action-keys-constant">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex flex-wrap gap-1">
        {KBD_ACTION_KEYS.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </div>
    </div>
  );
}

export const ConstantKbdActionKeys: Story = {
  render: () => <KbdActionKeysDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="action-keys-constant"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(9);
  },
};

// ============ CONSTANTS: KBD_SYMBOL_KEYS ============

function KbdSymbolKeysDemo() {
  return (
    <div className="space-y-4" data-testid="symbol-keys-constant">
      <p className="text-sm font-medium">{i18n.t('kbd.section.variants')}</p>
      <div className="flex flex-wrap gap-1">
        {KBD_SYMBOL_KEYS.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </div>
    </div>
  );
}

export const ConstantKbdSymbolKeys: Story = {
  render: () => <KbdSymbolKeysDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="symbol-keys-constant"]');
    expect(container).toBeInTheDocument();
    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(12);
  },
};

// ============ CONSTANTS: KBD_COMMON_SHORTCUTS ============

function KbdCommonShortcutsDemo() {
  const actions = Object.keys(KBD_COMMON_SHORTCUTS) as KbdShortcutAction[];

  return (
    <div className="space-y-4" data-testid="common-shortcuts-constant">
      <p className="text-sm font-medium">{i18n.t('kbd.section.combinations')}</p>
      <div className="space-y-2">
        {actions.slice(0, 6).map((action) => {
          const shortcut = KBD_COMMON_SHORTCUTS[action];
          return (
            <div key={action} className="flex items-center justify-between gap-8">
              <span className="text-sm">{shortcut.description}</span>
              <KbdGroup>
                {shortcut.keys.mac.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </KbdGroup>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ConstantKbdCommonShortcuts: Story = {
  render: () => <KbdCommonShortcutsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="common-shortcuts-constant"]');
    expect(container).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(groups.length).toBe(6);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('kbd.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('kbd.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('kbd.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('kbd.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
