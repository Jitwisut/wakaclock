import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { LoaderIcon } from 'lucide-react';

import { formHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import {
  selectHandlers,
  selectStatusHandlers,
} from '@/.storybook/stories/_handlers/select.handlers';
import {
  createFakeOptionGroups,
  createFakeOptions,
  type FakeOption,
} from '@/.storybook/stories/_factories/form.factory';
import {
  COUNTRY_OPTIONS,
  createFakeSelectOptions,
  LANGUAGE_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
} from '@/.storybook/stories/_factories/select.factory';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type SelectDemoOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

type SelectDemoProps = {
  options?: SelectDemoOption[];
  placeholder?: string;
  value?: string;
};

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

const defaultOptions: SelectDemoOption[] = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Orange', value: 'orange' },
  { disabled: true, label: 'Disabled option', value: 'disabled' },
];

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function SelectDemo({
  options = defaultOptions,
  placeholder = 'Select a fruit',
  value = 'apple',
}: SelectDemoProps) {
  const [currentValue, setCurrentValue] = React.useState(value);

  return (
    <div data-select-demo data-select-value={currentValue}>
      <Select onValueChange={setCurrentValue} value={currentValue}>
        <SelectTrigger className="w-[240px]" data-select-trigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              data-select-item={option.value}
              disabled={option.disabled}
              key={option.value}
              value={option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function I18nSelectDemo() {
  const { t } = useTranslation();

  const options: SelectDemoOption[] = [
    { label: t('select.option.apple'), value: 'apple' },
    { label: t('select.option.banana'), value: 'banana' },
    { label: t('select.option.orange'), value: 'orange' },
    { disabled: true, label: t('select.option.disabled'), value: 'disabled' },
  ];

  return <SelectDemo options={options} placeholder={t('select.placeholder')} value="apple" />;
}

function PlaygroundSelect(args: React.ComponentProps<typeof Select> & SelectDemoProps) {
  const { t } = useTranslation();
  const [value, setValue] = React.useState(args.value ?? '');

  const options = args.options ?? [
    { label: t('select.option.apple'), value: 'apple' },
    { label: t('select.option.banana'), value: 'banana' },
    { label: t('select.option.orange'), value: 'orange' },
  ];

  return (
    <div data-select-demo data-select-value={value}>
      <Select value={value} onValueChange={setValue} {...args}>
        <SelectTrigger className="w-[240px]" data-select-trigger>
          <SelectValue placeholder={args.placeholder ?? t('select.placeholder')} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              data-select-item={option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================================
// META CONFIGURATION
// ============================================================================

const meta = {
  title: 'Components/UI/Select',
  component: SelectDemo,
  tags: ['autodocs'],
  args: {
    placeholder: 'Select a fruit',
    value: 'apple',
    onValueChange: fn(),
    onOpenChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: [...selectHandlers, ...formHandlers] },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    placeholder: {
      control: 'text',
      description: i18n.t(
        'select.argType.placeholderTextShownWhenNoOptionIsSelected',
        'Placeholder text shown when no option is selected'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    value: {
      control: 'select',
      options: ['apple', 'banana', 'orange'],
      description: i18n.t('select.argType.currentlySelectedValue', 'Currently selected value'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    options: {
      control: 'object',
      description: i18n.t('select.argType.arrayOfOptionsToDisplay', 'Array of options to display'),
      table: {
        category: 'Content',
        type: { summary: 'SelectDemoOption[]' },
      },
    },
    // State
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'select.argType.whetherTheSelectIsDisabled',
        'Whether the select is disabled'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    open: {
      control: 'boolean',
      description: i18n.t('select.argType.controlledOpenState', 'Controlled open state'),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
      },
    },
    defaultOpen: {
      control: 'boolean',
      description: i18n.t(
        'select.argType.defaultOpenStateUncontrolled',
        'Default open state (uncontrolled)'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
      },
    },
    required: {
      control: 'boolean',
      description: i18n.t(
        'select.argType.whetherTheSelectIsRequiredInAForm',
        'Whether the select is required in a form'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    position: {
      control: 'select',
      options: ['item-aligned', 'popper'],
      description: i18n.t(
        'select.argType.positioningModeOfTheContent',
        'Positioning mode of the content'
      ),
      table: {
        category: 'Layout',
        type: { summary: "'item-aligned' | 'popper'" },
        defaultValue: { summary: 'item-aligned' },
      },
    },
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
      description: i18n.t(
        'select.argType.preferredSideWhenPositionIsPopper',
        'Preferred side when position is popper'
      ),
      table: {
        category: 'Layout',
        type: { summary: "'top' | 'right' | 'bottom' | 'left'" },
        defaultValue: { summary: 'bottom' },
      },
    },
    sideOffset: {
      control: 'number',
      description: i18n.t('select.argType.distanceFromTriggerInPx', 'Distance from trigger in px'),
      table: {
        category: 'Layout',
        type: { summary: 'number' },
        defaultValue: { summary: '0' },
      },
    },
    // Appearance
    size: {
      control: 'select',
      options: ['default', 'sm'],
      description: i18n.t('select.argType.sizeOfTheSelectTrigger', 'Size of the select trigger'),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'default' },
        type: { summary: "'default' | 'sm'" },
      },
    },
    // Events
    onValueChange: {
      action: 'onValueChange',
      description: i18n.t('select.argType.calledWhenValueChanges', 'Called when value changes'),
      table: { category: 'Events' },
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'select.argType.calledWhenOpenStateChanges',
        'Called when open state changes'
      ),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('select.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('select.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('select.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// ============================================================================
// CORE STORIES
// ============================================================================

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    const demoRoot = canvasElement.querySelector('[data-select-demo]');

    if (!(demoRoot instanceof HTMLElement)) {
      throw new Error('Select demo root was not found.');
    }

    expect(demoRoot.getAttribute('data-select-value')).toBe('apple');

    const trigger = canvasElement.querySelector('[data-select-trigger]');

    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Select trigger was not found.');
    }

    expect(trigger).toBeEnabled();

    await userEvent.click(trigger);

    const getContent = () => doc.body.querySelector('[data-slot="select-content"]');

    const contentEl = await waitFor(() => {
      const el = getContent();
      if (!(el instanceof HTMLElement)) throw new Error('Select content was not found.');
      return el;
    });

    expect(contentEl.querySelector('[data-select-item="apple"]')).toBeInTheDocument();
    expect(contentEl.querySelector('[data-select-item="banana"]')).toBeInTheDocument();
    expect(contentEl.querySelector('[data-select-item="orange"]')).toBeInTheDocument();
    expect(contentEl.querySelector('[data-select-item="disabled"]')).toBeInTheDocument();

    const bananaItem = contentEl.querySelector('[data-select-item="banana"]');

    if (!(bananaItem instanceof HTMLElement)) {
      throw new Error('Banana select item was not found.');
    }

    await userEvent.click(bananaItem);

    await waitFor(() => expect(demoRoot.getAttribute('data-select-value')).toBe('banana'));

    await userEvent.click(trigger);

    const contentElAgain = await waitFor(() => {
      const el = getContent();
      if (!(el instanceof HTMLElement)) throw new Error('Select content was not found.');
      return el;
    });

    const disabledItem = contentElAgain.querySelector('[data-select-item="disabled"]');

    if (!(disabledItem instanceof HTMLElement)) {
      throw new Error('Disabled select item was not found.');
    }

    await userEvent.click(disabledItem);

    expect(demoRoot.getAttribute('data-select-value')).toBe('banana');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(getContent()).not.toBeInTheDocument();
    });
  },
};

export const Playground: Story = {
  render: (args) => <PlaygroundSelect {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-select-trigger]');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toBeEnabled();
  },
};

// ============================================================================
// VARIANT STORIES
// ============================================================================

function VariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      {/* Basic Select */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('select.variants.basic')}</p>
        <Select defaultValue="apple">
          <SelectTrigger className="w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">{i18n.t('select.story.apple', 'Apple')}</SelectItem>
            <SelectItem value="banana">{i18n.t('select.story.banana', 'Banana')}</SelectItem>
            <SelectItem value="orange">{i18n.t('select.story.orange', 'Orange')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* With Placeholder */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('select.variants.withPlaceholder')}</p>
        <Select>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder={i18n.t('select.story.selectAFruit', 'Select a fruit...')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">{i18n.t('select.story.apple', 'Apple')}</SelectItem>
            <SelectItem value="banana">{i18n.t('select.story.banana', 'Banana')}</SelectItem>
            <SelectItem value="orange">{i18n.t('select.story.orange', 'Orange')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Disabled */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('select.variants.disabled')}</p>
        <Select disabled defaultValue="apple">
          <SelectTrigger className="w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">{i18n.t('select.story.apple', 'Apple')}</SelectItem>
            <SelectItem value="banana">{i18n.t('select.story.banana', 'Banana')}</SelectItem>
            <SelectItem value="orange">{i18n.t('select.story.orange', 'Orange')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* With Groups */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('select.variants.withGroups')}</p>
        <Select defaultValue="apple">
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder={i18n.t('select.story.selectAFood', 'Select a food...')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{i18n.t('select.story.fruits', 'Fruits')}</SelectLabel>
              <SelectItem value="apple">{i18n.t('select.story.apple', 'Apple')}</SelectItem>
              <SelectItem value="banana">{i18n.t('select.story.banana', 'Banana')}</SelectItem>
              <SelectItem value="orange">{i18n.t('select.story.orange', 'Orange')}</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>{i18n.t('select.story.vegetables', 'Vegetables')}</SelectLabel>
              <SelectItem value="carrot">{i18n.t('select.story.carrot', 'Carrot')}</SelectItem>
              <SelectItem value="broccoli">
                {i18n.t('select.story.broccoli', 'Broccoli')}
              </SelectItem>
              <SelectItem value="spinach">{i18n.t('select.story.spinach', 'Spinach')}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export const Variants: Story = {
  tags: ['!test'],
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// SIZE STORIES
// ============================================================================

function SizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      {/* Small Size */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('select.sizes.small')}</p>
        <Select defaultValue="apple">
          <SelectTrigger className="w-[240px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">{t('select.story.apple', 'Apple')}</SelectItem>
            <SelectItem value="banana">{t('select.story.banana', 'Banana')}</SelectItem>
            <SelectItem value="orange">{t('select.story.orange', 'Orange')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Default Size */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('select.sizes.default')}</p>
        <Select defaultValue="apple">
          <SelectTrigger className="w-[240px]" size="default">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">{t('select.story.apple', 'Apple')}</SelectItem>
            <SelectItem value="banana">{t('select.story.banana', 'Banana')}</SelectItem>
            <SelectItem value="orange">{t('select.story.orange', 'Orange')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  tags: ['!test'],
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    // Verify both size variants are rendered
    const triggers = canvasElement.querySelectorAll('[data-slot="select-trigger"]');
    expect(triggers.length).toBe(2);

    // Verify size data attributes
    expect(canvasElement.querySelector('[data-size="sm"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-size="default"]')).toBeInTheDocument();
  },
};
// ============================================================================
// DARK MODE STORIES
// ============================================================================

export const Dark: Story = {
  ...Default,
  name: i18n.t('select.storyName.dark', 'Dark Mode'),
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-select-trigger]');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toBeEnabled();

    const demoRoot = canvasElement.querySelector('[data-select-demo]');
    expect(demoRoot?.getAttribute('data-select-value')).toBe('apple');
  },
};

function DarkModeShowcaseDemo() {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Select components adapt to dark mode with proper contrast and readability.
      </p>

      <div className="flex flex-wrap gap-4">
        {/* Basic Select */}
        <div className="space-y-2">
          <Label>{i18n.t('select.story.basicSelect', 'Basic Select')}</Label>
          <Select defaultValue="apple">
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apple">{i18n.t('select.story.apple', 'Apple')}</SelectItem>
              <SelectItem value="banana">{i18n.t('select.story.banana', 'Banana')}</SelectItem>
              <SelectItem value="orange">{i18n.t('select.story.orange', 'Orange')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Disabled */}
        <div className="space-y-2">
          <Label>{i18n.t('select.story.disabled', 'Disabled')}</Label>
          <Select disabled defaultValue="apple">
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apple">{i18n.t('select.story.apple', 'Apple')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Placeholder */}
        <div className="space-y-2">
          <Label>{i18n.t('select.story.withPlaceholder', 'With Placeholder')}</Label>
          <Select>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={i18n.t('select.story.selectOption', 'Select option...')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="opt1">Option 1</SelectItem>
              <SelectItem value="opt2">Option 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export const DarkModeShowcase: Story = {
  name: i18n.t('select.storyName.darkModeShowcase', 'Dark Mode Showcase'),
  globals: {
    theme: 'dark',
  },
  render: () => <DarkModeShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="select-trigger"]');
    expect(triggers.length).toBe(3);
  },
};

// ============================================================================
// ACCESSIBILITY STORIES
// ============================================================================

export const Accessibility: Story = {
  name: i18n.t('select.storyName.accessibility', 'Accessibility'),
  render: () => (
    <div className="space-y-2">
      <label htmlFor="a11y-select-trigger" id="a11y-select-label" className="text-sm font-medium">
        Select a fruit
      </label>
      <Select defaultValue="apple">
        <SelectTrigger
          id="a11y-select-trigger"
          className="w-[240px]"
          aria-labelledby="a11y-select-label"
          data-testid="a11y-select-trigger"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">{i18n.t('select.story.apple', 'Apple')}</SelectItem>
          <SelectItem value="banana">{i18n.t('select.story.banana', 'Banana')}</SelectItem>
          <SelectItem value="orange">{i18n.t('select.story.orange', 'Orange')}</SelectItem>
          <SelectItem value="disabled" disabled>
            Disabled option
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector(
      '[data-testid="a11y-select-trigger"]'
    ) as HTMLElement;

    // Verify trigger has proper ARIA attributes
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-labelledby')).toBe('a11y-select-label');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    // Tab to focus
    await userEvent.tab();
    expect(trigger).toHaveFocus();

    // Open with Enter key
    await userEvent.keyboard('{Enter}');

    const getContent = () => doc.body.querySelector('[data-slot="select-content"]');

    await waitFor(() => {
      expect(getContent()).toBeInTheDocument();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    // Verify listbox role in content
    const content = getContent() as HTMLElement;
    expect(content.getAttribute('role')).toBe('listbox');

    // Navigate with arrow keys
    await userEvent.keyboard('{ArrowDown}');

    // Close with Escape
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(getContent()).not.toBeInTheDocument();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  },
};

// ============================================================================
// KEYBOARD NAVIGATION STORIES
// ============================================================================

function KeyboardNavigationDemo() {
  const { t } = useTranslation();
  const [value, setValue] = React.useState('');
  const [lastAction, setLastAction] = React.useState('');

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('select.story.keyboardNavigation')}</p>

      <div className="space-y-2">
        <Label htmlFor="keyboard-select">{t('select.story.keyboardTest', 'Keyboard Test')}</Label>
        <Select
          value={value}
          onValueChange={(v) => {
            setValue(v);
            setLastAction(`Selected: ${v}`);
          }}
        >
          <SelectTrigger
            id="keyboard-select"
            className="w-[240px]"
            data-testid="keyboard-select-trigger"
          >
            <SelectValue
              placeholder={i18n.t(
                'select.story.useKeyboardToNavigate',
                'Use keyboard to navigate...'
              )}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple" data-testid="kb-item-apple">
              Apple
            </SelectItem>
            <SelectItem value="banana" data-testid="kb-item-banana">
              Banana
            </SelectItem>
            <SelectItem value="cherry" data-testid="kb-item-cherry">
              Cherry
            </SelectItem>
            <SelectItem value="date" data-testid="kb-item-date">
              Date
            </SelectItem>
            <SelectItem value="elderberry" data-testid="kb-item-elderberry">
              Elderberry
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-muted rounded-md p-3">
        <p className="text-muted-foreground text-xs">
          <strong>{t('select.story.keyboardShortcuts', 'Keyboard shortcuts:')}</strong>
        </p>
        <ul className="text-muted-foreground mt-1 list-inside list-disc text-xs">
          <li>
            <kbd className="bg-background rounded px-1">{t('select.story.enter', 'Enter')}</kbd> /{' '}
            <kbd className="bg-background rounded px-1">{t('select.story.space', 'Space')}</kbd> -
            Open dropdown
          </li>
          <li>
            <kbd className="bg-background rounded px-1">{t('select.story.arrowDownUp')}</kbd> -
            Navigate options
          </li>
          <li>
            <kbd className="bg-background rounded px-1">{t('select.story.home', 'Home')}</kbd> /{' '}
            <kbd className="bg-background rounded px-1">{t('select.story.end', 'End')}</kbd> - Jump
            to first/last
          </li>
          <li>
            <kbd className="bg-background rounded px-1">{t('select.story.escape', 'Escape')}</kbd> -
            Close dropdown
          </li>
          <li>
            <kbd className="bg-background rounded px-1">A-Z</kbd> - Type-ahead search
          </li>
        </ul>
      </div>

      {lastAction && (
        <p className="text-muted-foreground text-sm" data-testid="keyboard-action-log">
          Last action: {lastAction}
        </p>
      )}
    </div>
  );
}

export const KeyboardNavigation: Story = {
  name: i18n.t('select.storyName.keyboardNavigation', 'Keyboard Navigation'),
  render: () => <KeyboardNavigationDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector(
      '[data-testid="keyboard-select-trigger"]'
    ) as HTMLElement;

    // Tab to focus
    await userEvent.tab();
    expect(trigger).toHaveFocus();

    // Open with Space key
    await userEvent.keyboard(' ');

    const getContent = () => doc.body.querySelector('[data-slot="select-content"]');

    await waitFor(() => {
      expect(getContent()).toBeInTheDocument();
    });

    // Navigate down with arrow keys
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');

    // Select with Enter
    await userEvent.keyboard('{Enter}');

    // Verify selection was made
    await waitFor(() => {
      const actionLog = canvasElement.querySelector('[data-testid="keyboard-action-log"]');
      expect(actionLog).toBeInTheDocument();
    });

    // Re-open and test Escape
    await userEvent.keyboard(' ');
    await waitFor(() => expect(getContent()).toBeInTheDocument());

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(getContent()).not.toBeInTheDocument());
  },
};

function TypeAheadDemo() {
  const [value, setValue] = React.useState('');

  const options = [
    'Apple',
    'Apricot',
    'Avocado',
    'Banana',
    'Blackberry',
    'Blueberry',
    'Cherry',
    'Coconut',
    'Cranberry',
    'Date',
    'Dragonfruit',
  ];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Type characters to quickly jump to matching options (type-ahead search).
      </p>

      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-[240px]" data-testid="typeahead-trigger">
          <SelectValue
            placeholder={i18n.t('select.story.typeForBerries', "Type 'b' for berries...")}
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.toLowerCase()} value={opt.toLowerCase()}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value && (
        <p className="text-muted-foreground text-sm">
          Selected: <strong>{value}</strong>
        </p>
      )}
    </div>
  );
}

export const TypeAheadSearch: Story = {
  name: i18n.t('select.storyName.typeAheadSearch', 'Type-Ahead Search'),
  render: () => <TypeAheadDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-testid="typeahead-trigger"]') as HTMLElement;

    // Focus and open
    await userEvent.click(trigger);

    const getContent = () => doc.body.querySelector('[data-slot="select-content"]');
    await waitFor(() => expect(getContent()).toBeInTheDocument());

    // Type 'c' to jump to Cherry/Coconut/Cranberry
    await userEvent.keyboard('c');

    // Close
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(getContent()).not.toBeInTheDocument());
  },
};

// ============================================================================
// I18N STORIES
// ============================================================================

export const Japanese: Story = {
  ...Default,
  name: i18n.t('select.storyName.japanese', 'Japanese Locale'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: () => <I18nSelectDemo />,
  play: async (context) => {
    const root = context.canvasElement;

    if (!root.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(root.ownerDocument.documentElement.lang).toBe('ja');

    const demoRoot = root.querySelector('[data-select-demo]');

    if (!(demoRoot instanceof HTMLElement)) {
      throw new Error('Select demo root was not found.');
    }

    const trigger = root.querySelector('[data-select-trigger]');

    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Select trigger was not found.');
    }

    expect(demoRoot.getAttribute('data-select-value')).toBe('apple');
    expect(within(trigger).getByText('りんご')).toBeInTheDocument();

    await Default.play?.(context);
  },
};

export const DarkModeJapanese: Story = {
  name: i18n.t('select.storyName.darkModeJapanese', 'Dark Mode + Japanese'),
  globals: {
    theme: 'dark',
    locale: 'ja',
  },
  render: () => <I18nSelectDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.ownerDocument.documentElement.lang).toBe('ja');

    const trigger = canvasElement.querySelector('[data-select-trigger]');
    expect(trigger).toBeInTheDocument();

    // Verify Japanese text is displayed
    expect(within(trigger as HTMLElement).getByText('りんご')).toBeInTheDocument();
  },
};

// ============================================================================
// RTL STORIES
// ============================================================================

export const RTL: Story = {
  ...Default,
  name: i18n.t('select.storyName.rTL', 'RTL Support'),
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-select-trigger]');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toBeEnabled();

    const demoRoot = canvasElement.querySelector('[data-select-demo]');
    expect(demoRoot).toBeInTheDocument();
    expect(demoRoot?.getAttribute('data-select-value')).toBe('apple');
  },
};

// ============================================================================
// PSEUDO STATES STORIES
// ============================================================================

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('select.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============================================================================
// DOMAIN-SPECIFIC SELECT STORIES
// ============================================================================

function CountrySelectDemo() {
  const [value, setValue] = React.useState('us');

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t('select.story.countrySelectorWithFlagEmojis', 'Country selector with flag emojis.')}
      </p>

      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-[280px]" data-testid="country-select-trigger">
          <SelectValue placeholder={i18n.t('select.story.selectACountry', 'Select a country...')} />
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_OPTIONS.map((country) => (
            <SelectItem key={country.value} value={country.value}>
              {country.emoji} {country.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const CountrySelect: Story = {
  name: i18n.t('select.storyName.countrySelect', 'Country Select'),
  render: () => <CountrySelectDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector(
      '[data-testid="country-select-trigger"]'
    ) as HTMLElement;

    await userEvent.click(trigger);

    const getContent = () => doc.body.querySelector('[data-slot="select-content"]');
    await waitFor(() => expect(getContent()).toBeInTheDocument());

    // Verify country options are present
    const content = getContent() as HTMLElement;
    expect(content.textContent).toContain('United States');
    expect(content.textContent).toContain('Japan');

    await userEvent.keyboard('{Escape}');
  },
};

function LanguageSelectDemo() {
  const [value, setValue] = React.useState('en');
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'select.story.languageSelectorWithNativeLanguageNames',
          'Language selector with native language names.'
        )}
      </p>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-[280px]" data-testid="language-select-trigger">
          <SelectValue
            placeholder={i18n.t('select.story.selectALanguage', 'Select a language...')}
          />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGE_OPTIONS.map((lang) => (
            <SelectItem key={lang.value} value={lang.value}>
              {lang.label} ({lang.native})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const LanguageSelect: Story = {
  name: i18n.t('select.storyName.languageSelect', 'Language Select'),
  render: () => <LanguageSelectDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector(
      '[data-testid="language-select-trigger"]'
    ) as HTMLElement;

    await userEvent.click(trigger);

    const getContent = () => doc.body.querySelector('[data-slot="select-content"]');
    await waitFor(() => expect(getContent()).toBeInTheDocument());

    const content = getContent() as HTMLElement;
    expect(content.textContent).toContain('English');
    expect(content.textContent).toContain('日本語');

    await userEvent.keyboard('{Escape}');
  },
};

function StatusSelectDemo() {
  const [value, setValue] = React.useState('pending');

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t('select.story.statusSelectorForWorkflows', 'Status selector for workflows.')}
      </p>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-[200px]" data-testid="status-select-trigger">
          <SelectValue placeholder={i18n.t('select.story.selectStatus', 'Select status...')} />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              <span
                className="mr-2 inline-block size-2 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const StatusSelect: Story = {
  name: i18n.t('select.storyName.statusSelect', 'Status Select'),
  render: () => <StatusSelectDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector(
      '[data-testid="status-select-trigger"]'
    ) as HTMLElement;

    await userEvent.click(trigger);

    const getContent = () => doc.body.querySelector('[data-slot="select-content"]');
    await waitFor(() => expect(getContent()).toBeInTheDocument());

    const content = getContent() as HTMLElement;
    expect(content.textContent).toContain('Pending');
    expect(content.textContent).toContain('Approved');

    await userEvent.keyboard('{Escape}');
  },
};

function PrioritySelectDemo() {
  const [value, setValue] = React.useState('medium');

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'select.story.prioritySelectorForTaskManagement',
          'Priority selector for task management.'
        )}
      </p>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-[200px]" data-testid="priority-select-trigger">
          <SelectValue placeholder={i18n.t('select.story.selectPriority', 'Select priority...')} />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((priority) => (
            <SelectItem key={priority.value} value={priority.value}>
              <span
                className="mr-2 inline-block size-2 rounded-full"
                style={{ backgroundColor: priority.color }}
              />
              {priority.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const PrioritySelect: Story = {
  name: i18n.t('select.storyName.prioritySelect', 'Priority Select'),
  render: () => <PrioritySelectDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector(
      '[data-testid="priority-select-trigger"]'
    ) as HTMLElement;

    await userEvent.click(trigger);

    const getContent = () => doc.body.querySelector('[data-slot="select-content"]');
    await waitFor(() => expect(getContent()).toBeInTheDocument());

    const content = getContent() as HTMLElement;
    expect(content.textContent).toContain('Medium');
    expect(content.textContent).toContain('High');

    await userEvent.keyboard('{Escape}');
  },
};

// ============================================================================
// GROUPED SELECT STORIES
// ============================================================================

function GroupedSelectDemo() {
  const [value, setValue] = React.useState('');

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'select.story.selectWithGroupedOptionsAndSeparators',
          'Select with grouped options and separators.'
        )}
      </p>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-[280px]" data-testid="grouped-select-trigger">
          <SelectValue placeholder={i18n.t('select.story.selectFood', 'Select food...')} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{i18n.t('select.story.fruits', 'Fruits')}</SelectLabel>
            <SelectItem value="apple">{i18n.t('select.story.apple', 'Apple')}</SelectItem>
            <SelectItem value="banana">{i18n.t('select.story.banana', 'Banana')}</SelectItem>
            <SelectItem value="cherry">{i18n.t('select.story.cherry', 'Cherry')}</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>{i18n.t('select.story.vegetables', 'Vegetables')}</SelectLabel>
            <SelectItem value="carrot">{i18n.t('select.story.carrot', 'Carrot')}</SelectItem>
            <SelectItem value="broccoli">{i18n.t('select.story.broccoli', 'Broccoli')}</SelectItem>
            <SelectItem value="spinach">{i18n.t('select.story.spinach', 'Spinach')}</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>{i18n.t('select.story.proteins', 'Proteins')}</SelectLabel>
            <SelectItem value="chicken">{i18n.t('select.story.chicken', 'Chicken')}</SelectItem>
            <SelectItem value="beef">{i18n.t('select.story.beef', 'Beef')}</SelectItem>
            <SelectItem value="fish">{i18n.t('select.story.fish', 'Fish')}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export const GroupedSelect: Story = {
  name: i18n.t('select.storyName.groupedSelect', 'Grouped Options'),
  render: () => <GroupedSelectDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector(
      '[data-testid="grouped-select-trigger"]'
    ) as HTMLElement;

    await userEvent.click(trigger);

    const getContent = () => doc.body.querySelector('[data-slot="select-content"]');
    await waitFor(() => expect(getContent()).toBeInTheDocument());

    const content = getContent() as HTMLElement;

    // Verify group labels are present
    expect(content.textContent).toContain('Fruits');
    expect(content.textContent).toContain('Vegetables');
    expect(content.textContent).toContain('Proteins');

    // Verify separators are rendered
    const separators = content.querySelectorAll('[data-slot="select-separator"]');
    expect(separators.length).toBe(2);

    await userEvent.keyboard('{Escape}');
  },
};

// ============================================================================
// MSW + FAKER STORIES
// ============================================================================

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: [...selectHandlers, ...formHandlers] },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-select-trigger]');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toBeEnabled();

    const demoRoot = canvasElement.querySelector('[data-select-demo]');
    expect(demoRoot?.getAttribute('data-select-value')).toBe('apple');
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: selectStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-select-trigger]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: selectStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-select-trigger]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: selectStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-select-trigger]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: selectStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-select-trigger]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: selectStatusHandlers.validationError },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-select-trigger]');
    expect(trigger).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: selectStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-select-trigger]');
    expect(trigger).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: selectStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-select-trigger]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============================================================================
// FAKER DATA STORIES
// ============================================================================

function WithFakerDataComponent() {
  const options = React.useMemo(() => createFakeOptions(6), []);
  const [value, setValue] = React.useState(options[0]?.value ?? '');

  return (
    <div className="w-[300px]" data-testid="faker-select">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder={i18n.t('select.story.selectAnOption', 'Select an option...')} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <WithFakerDataComponent />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger?.textContent?.trim().length).not.toBe(0);
  },
};

function WithFakerGroupsComponent() {
  const groups = React.useMemo(() => createFakeOptionGroups(3, 4), []);
  const [value, setValue] = React.useState('');

  return (
    <div className="w-[300px]">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue
            placeholder={i18n.t('select.story.selectFromGroups', 'Select from groups...')}
          />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group, groupIndex) => (
            <React.Fragment key={group.label}>
              <SelectGroup>
                <SelectLabel>{group.label}</SelectLabel>
                {group.options.map((option) => (
                  <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              {groupIndex < groups.length - 1 && <SelectSeparator />}
            </React.Fragment>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const WithFakerGroups: Story = {
  render: () => <WithFakerGroupsComponent />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-slot="select-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toBeEnabled();
  },
};

// ============================================================================
// ASYNC OPTION LOADING STORIES
// ============================================================================

interface AsyncSelectState {
  data: FakeOption[];
  error: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
}

function AsyncSelectDemo() {
  const [state, setState] = React.useState<AsyncSelectState>({
    status: 'idle',
    data: [],
    error: null,
  });
  const [value, setValue] = React.useState('');

  const fetchOptions = React.useCallback(async () => {
    setState({ status: 'loading', data: [], error: null });

    try {
      // Simulated API call - in real scenario this would be an actual endpoint
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const options = createFakeOptions(8);
      setState({ status: 'success', data: options, error: null });
    } catch {
      setState({ status: 'error', data: [], error: 'Failed to load options' });
    }
  }, []);

  React.useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  if (state.status === 'loading') {
    return (
      <div className="w-[300px]" data-testid="select-loading" data-state="loading">
        <Skeleton className="h-9 w-full" />
        <p className="text-muted-foreground mt-2 text-sm">
          {i18n.t('select.story.loadingOptions', 'Loading options...')}
        </p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="w-[300px]" data-testid="select-error" data-state="error">
        <p className="text-destructive text-sm">{state.error}</p>
        <button className="text-sm underline" onClick={() => void fetchOptions()}>
          Retry
        </button>
      </div>
    );
  }

  if (state.data.length === 0) {
    return (
      <div className="w-[300px]" data-testid="select-empty" data-state="empty">
        <Select disabled>
          <SelectTrigger>
            <SelectValue
              placeholder={i18n.t('select.story.noOptionsAvailable', 'No options available')}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="empty" disabled>
              No options
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="w-[300px]" data-testid="select-success" data-state="success">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder={i18n.t('select.story.selectAnOption', 'Select an option...')} />
        </SelectTrigger>
        <SelectContent>
          {state.data.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: selectHandlers },
  },
  render: () => <AsyncSelectDemo />,
  play: async ({ canvasElement }) => {
    // Wait for loading to appear
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-testid="select-loading"]')).toBeInTheDocument();
    });

    // Wait for success
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="select-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const EmptyData: Story = {
  render: () => (
    <div className="w-[300px]" data-testid="select-empty">
      <Select disabled>
        <SelectTrigger>
          <SelectValue
            placeholder={i18n.t('select.story.noOptionsAvailable', 'No options available')}
          />
        </SelectTrigger>
        <SelectContent>
          <div className="text-muted-foreground p-4 text-center text-sm">
            {i18n.t('select.story.noOptionsToDisplay', 'No options to display')}
          </div>
        </SelectContent>
      </Select>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('button');
    expect(trigger).toBeDisabled();
  },
};

function SlowAsyncSelectDemo() {
  const [state, setState] = React.useState<AsyncSelectState>({
    status: 'loading',
    data: [],
    error: null,
  });
  const [value, setValue] = React.useState('');

  React.useEffect(() => {
    const loadOptions = async () => {
      // Simulate slow response (5 seconds)
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const options = createFakeOptions(5);
      setState({ status: 'success', data: options, error: null });
    };
    void loadOptions();
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="w-[300px] space-y-2" data-testid="select-slow-loading" data-state="loading">
        <div className="flex items-center gap-2">
          <LoaderIcon className="size-4 animate-spin" />
          <span className="text-muted-foreground text-sm">
            {i18n.t('select.story.loadingOptionsSlow', 'Loading options (slow)...')}
          </span>
        </div>
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  return (
    <div className="w-[300px]" data-testid="select-slow-success" data-state="success">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder={i18n.t('select.story.selectAnOption', 'Select an option...')} />
        </SelectTrigger>
        <SelectContent>
          {state.data.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const SlowResponse: Story = {
  name: i18n.t('select.storyName.slowResponse', 'Slow Response (5s)'),
  render: () => <SlowAsyncSelectDemo />,
  play: async ({ canvasElement }) => {
    // Should start loading
    expect(canvasElement.querySelector('[data-testid="select-slow-loading"]')).toBeInTheDocument();

    // Wait for success (after 5+ seconds)
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="select-slow-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

// ============================================================================
// HTTP 5xx ERROR STORIES
// ============================================================================

export const Error502BadGateway: Story = {
  name: i18n.t('select.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: selectStatusHandlers.badGateway },
  },
  render: () => <AsyncSelectDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('select.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: selectStatusHandlers.serviceUnavailable },
  },
  render: () => <AsyncSelectDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('select.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: selectStatusHandlers.gatewayTimeout },
  },
  render: () => <AsyncSelectDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('select.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: selectStatusHandlers.tooManyRequests },
  },
  render: () => <AsyncSelectDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// DESIGN REFERENCE
// ============================================================================

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

// ============================================================================
// SCROLLABLE LONG LIST STORIES
// ============================================================================

function ScrollableLongListDemo() {
  const [value, setValue] = React.useState('');
  const options = React.useMemo(() => createFakeSelectOptions(30), []);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Long lists automatically show scroll buttons and are keyboard navigable.
      </p>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-[280px]" data-testid="scrollable-select-trigger">
          <SelectValue
            placeholder={i18n.t(
              'select.story.selectFromManyOptions',
              'Select from many options...'
            )}
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const ScrollableLongList: Story = {
  name: i18n.t('select.storyName.scrollableLongList', 'Scrollable Long List'),
  render: () => <ScrollableLongListDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector(
      '[data-testid="scrollable-select-trigger"]'
    ) as HTMLElement;

    await userEvent.click(trigger);

    const getContent = () => doc.body.querySelector('[data-slot="select-content"]');
    await waitFor(() => expect(getContent()).toBeInTheDocument());

    // Verify scroll buttons are present
    const scrollDownButton = doc.body.querySelector('[data-slot="select-scroll-down-button"]');
    expect(scrollDownButton).toBeInTheDocument();

    // Navigate with keyboard (Home to go to first, End to go to last)
    await userEvent.keyboard('{End}');
    await userEvent.keyboard('{Home}');
    await userEvent.keyboard('{Escape}');
  },
};

// ============================================================================
// CONTROLLED VS UNCONTROLLED STORIES
// ============================================================================

function ControlledSelectDemo() {
  const [value, setValue] = React.useState('banana');

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Controlled select - value is managed by React state.
      </p>

      <div className="flex gap-4">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-[200px]" data-testid="controlled-select-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">{i18n.t('select.story.apple', 'Apple')}</SelectItem>
            <SelectItem value="banana">{i18n.t('select.story.banana', 'Banana')}</SelectItem>
            <SelectItem value="orange">{i18n.t('select.story.orange', 'Orange')}</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <button
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-3 py-1 text-sm"
            onClick={() => setValue('apple')}
          >
            Set Apple
          </button>
          <button
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-3 py-1 text-sm"
            onClick={() => setValue('orange')}
          >
            Set Orange
          </button>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        Current value: <strong data-testid="controlled-value">{value}</strong>
      </p>
    </div>
  );
}

export const ControlledSelect: Story = {
  name: i18n.t('select.storyName.controlledSelect', 'Controlled Select'),
  render: () => <ControlledSelectDemo />,
  play: async ({ canvasElement }) => {
    const valueDisplay = canvasElement.querySelector('[data-testid="controlled-value"]');
    expect(valueDisplay?.textContent).toBe('banana');

    // Click external button to change value
    const setAppleButton = canvasElement.querySelector('button:not([data-testid])');
    if (setAppleButton) {
      await userEvent.click(setAppleButton);
      await waitFor(() => expect(valueDisplay?.textContent).toBe('apple'));
    }
  },
};

function UncontrolledSelectDemo() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Uncontrolled select - value is managed internally with defaultValue.
      </p>

      <Select defaultValue="banana">
        <SelectTrigger className="w-[200px]" data-testid="uncontrolled-select-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">{i18n.t('select.story.apple', 'Apple')}</SelectItem>
          <SelectItem value="banana">{i18n.t('select.story.banana', 'Banana')}</SelectItem>
          <SelectItem value="orange">{i18n.t('select.story.orange', 'Orange')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export const UncontrolledSelect: Story = {
  name: i18n.t('select.storyName.uncontrolledSelect', 'Uncontrolled Select'),
  render: () => <UncontrolledSelectDemo />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector(
      '[data-testid="uncontrolled-select-trigger"]'
    ) as HTMLElement;

    // Verify default value is shown
    expect(trigger.textContent).toContain('Banana');
  },
};

// ============================================================================
// FORM INTEGRATION STORIES
// ============================================================================

function FormIntegrationDemo() {
  const [formData, setFormData] = React.useState({
    fruit: '',
    country: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // eslint-disable-next-line no-alert
    window.alert(`Submitted: ${JSON.stringify(formData)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'select.story.selectComponentsIntegratedInAForm',
          'Select components integrated in a form.'
        )}
      </p>

      <div className="space-y-2">
        <Label htmlFor="fruit-select">Favorite Fruit *</Label>
        <Select
          value={formData.fruit}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, fruit: value }))}
          required
        >
          <SelectTrigger id="fruit-select" className="w-[280px]" data-testid="form-fruit-select">
            <SelectValue placeholder={i18n.t('select.story.selectAFruit', 'Select a fruit...')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">{i18n.t('select.story.apple', 'Apple')}</SelectItem>
            <SelectItem value="banana">{i18n.t('select.story.banana', 'Banana')}</SelectItem>
            <SelectItem value="orange">{i18n.t('select.story.orange', 'Orange')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="country-select">{i18n.t('select.story.country', 'Country')}</Label>
        <Select
          value={formData.country}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, country: value }))}
        >
          <SelectTrigger
            id="country-select"
            className="w-[280px]"
            data-testid="form-country-select"
          >
            <SelectValue
              placeholder={i18n.t(
                'select.story.selectACountryOptional',
                'Select a country (optional)...'
              )}
            />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_OPTIONS.slice(0, 5).map((country) => (
              <SelectItem key={country.value} value={country.value}>
                {country.emoji} {country.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <button
        type="submit"
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
        data-testid="form-submit"
      >
        Submit
      </button>
    </form>
  );
}

export const FormIntegration: Story = {
  name: i18n.t('select.storyName.formIntegration', 'Form Integration'),
  render: () => <FormIntegrationDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Open fruit select and make selection
    const fruitTrigger = canvasElement.querySelector(
      '[data-testid="form-fruit-select"]'
    ) as HTMLElement;
    await userEvent.click(fruitTrigger);

    const getContent = () => doc.body.querySelector('[data-slot="select-content"]');
    await waitFor(() => expect(getContent()).toBeInTheDocument());

    // Select banana
    const bananaOption = doc.body.querySelector('[data-slot="select-item"]:nth-child(2)');
    if (bananaOption) {
      await userEvent.click(bananaOption);
    }

    // Verify selection was made
    await waitFor(() => expect(fruitTrigger.textContent).toContain('Banana'));
  },
};

// ============================================================================
// FACTORY CATALOG REFERENCE
// Available factory functions for additional story coverage:
//   createFakeSelectOptionGroup
//   createFakeSelectOptionGroups
//   createFakeSelects
//   createFakeCountryOptions
//   createFakeCountrySelect
//   createFakeLanguageOptions
//   createFakeLanguageSelect
//   createFakeCurrencyOptions
//   createFakeCurrencySelect
//   createFakeTimezoneOptions
//   createFakeTimezoneSelect
//   createFakePrioritySelect
//   createFakeStatusSelect
//   createFakeColorSelect
//   createFakeFoodGroupedSelect
//   createFakeTimezoneGroupedSelect
//   createFakeDisabledSelect
//   createFakeRequiredSelect
//   createFakeErrorSelect
//   createFakeSuccessSelect
//   createFakeSmallSelect
//   createSelectSizeMatrix
//   createSelectValidationMatrix
//   createSelectDomainMatrix
//   createSelectShowcase
//   createSelectTestData
//   createFakeNativeSelect
//   createFakeNativeSelects
//   createFakeRadioOption
//   createFakeRadioOptions
//   createFakeRadioGroup
//   createFakeRadioGroups
//   createFakeCheckbox
//   createFakeCheckboxes
//   createFakeCheckboxGroup
//   createFakeCheckboxGroups
// ============================================================================

// ============================================================================
// CROSS-CUTTING CONCERN STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('select.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('select.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('select.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('select.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('select.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: selectStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('select.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: selectStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('select.storyName.handlerUnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: selectStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('select.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: selectStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('select.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: selectStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyOptions: Story = {
  ...Default,
  name: i18n.t('select.storyName.handlerEmptyOptions', 'Handler: Empty Options'),
  parameters: { msw: { handlers: selectStatusHandlers.emptyOptions } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSingleOption: Story = {
  ...Default,
  name: i18n.t('select.storyName.handlerSingleOption', 'Handler: Single Option'),
  parameters: { msw: { handlers: selectStatusHandlers.singleOption } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerManyOptions: Story = {
  ...Default,
  name: i18n.t('select.storyName.handlerManyOptions', 'Handler: Many Options'),
  parameters: { msw: { handlers: selectStatusHandlers.manyOptions } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerDisabledOptions: Story = {
  ...Default,
  name: i18n.t('select.storyName.handlerDisabledOptions', 'Handler: Disabled Options'),
  parameters: { msw: { handlers: selectStatusHandlers.disabledOptions } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
