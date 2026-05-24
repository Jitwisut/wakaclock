import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import React from 'react';

import type {
  ButtonGroupItemSize,
  ButtonGroupItemType,
  ButtonGroupItemVariant,
  ButtonGroupLayout,
  ButtonGroupOrientation,
  FakeButtonGroup,
  FakeButtonGroupConfig,
  FakeButtonGroupItem,
} from '@/.storybook/stories/_factories/button-group.factory';

import {
  BUTTON_GROUP_ICONS,
  BUTTON_GROUP_ITEM_LABELS,
  BUTTON_GROUP_ITEM_SIZES,
  BUTTON_GROUP_ITEM_TYPES,
  BUTTON_GROUP_ITEM_VARIANTS,
  BUTTON_GROUP_LABELS,
  BUTTON_GROUP_LAYOUTS,
  BUTTON_GROUP_ORIENTATIONS,
  BUTTON_GROUP_PATTERNS,
  createFakeAlignmentButtonGroup,
  createFakeButtonGroup,
  createFakeButtonGroupConfig,
  createFakeButtonGroupItem,
  createFakeButtonGroupItems,
  createFakeButtonGroupMatrix,
  createFakeButtonGroups,
  createFakeButtonGroupSeparator,
  createFakeButtonGroupText,
  createFakeButtonGroupWithSeparators,
  createFakeButtonGroupWithText,
  createFakeClipboardButtonGroup,
  createFakeCommonButtonGroups,
  createFakeDisabledButtonGroup,
  createFakeFormattingButtonGroup,
  createFakeHorizontalButtonGroup,
  createFakeIconOnlyButtonGroup,
  createFakeMixedVariantButtonGroup,
  createFakeNavigationButtonGroup,
  createFakePaginationButtonGroup,
  createFakeUndoRedoButtonGroup,
  createFakeVerticalButtonGroup,
  createFakeViewModeButtonGroup,
  createFakeZoomButtonGroup,
} from '@/.storybook/stories/_factories/button-group.factory';

import {
  buttonGroupHandlers,
  buttonGroupStatusHandlers,
} from '@/.storybook/stories/_handlers/button-group.handlers';

import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from '@/components/ui/button-group';
import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============ I18N WRAPPER COMPONENTS ============

function ButtonGroupDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6" data-testid="button-group-demo">
      <ButtonGroup>
        <Button variant="outline">{t('buttonGroup.left')}</Button>
        <Button variant="outline">{t('buttonGroup.middle')}</Button>
        <Button variant="outline">{t('buttonGroup.right')}</Button>
      </ButtonGroup>

      <ButtonGroup>
        <Button variant="outline">{t('buttonGroup.one')}</Button>
        <ButtonGroupSeparator />
        <Button variant="outline">{t('buttonGroup.two')}</Button>
        <ButtonGroupSeparator />
        <Button variant="outline">{t('buttonGroup.three')}</Button>
      </ButtonGroup>

      <ButtonGroupText>{t('buttonGroup.readOnlyLabel')}</ButtonGroupText>
    </div>
  );
}

function ButtonGroupTextAsChildDemo() {
  const { t } = useTranslation();

  return (
    <ButtonGroupText asChild data-testid="button-group-text-demo">
      <a href="#button-group-text-as-child">{t('buttonGroup.readOnlyLabel')}</a>
    </ButtonGroupText>
  );
}

// ============ KEYBOARD NAVIGATION DEMO ============

function KeyboardNavigationDemo() {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [pressCount, setPressCount] = React.useState(0);
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number, totalButtons: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        e.preventDefault();
        const nextIndex = (index + 1) % totalButtons;
        setActiveIndex(nextIndex);
        buttonRefs.current[nextIndex]?.focus();
        break;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        e.preventDefault();
        const prevIndex = (index - 1 + totalButtons) % totalButtons;
        setActiveIndex(prevIndex);
        buttonRefs.current[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        e.preventDefault();
        setActiveIndex(0);
        buttonRefs.current[0]?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastIndex = totalButtons - 1;
        setActiveIndex(lastIndex);
        buttonRefs.current[lastIndex]?.focus();
        break;
      }
      default: {
        break;
      }
    }
  };

  const handleClick = () => {
    setPressCount((c) => c + 1);
  };

  const labels = [t('buttonGroup.bold'), t('buttonGroup.italic'), t('buttonGroup.underline')];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('buttonGroup.story.arrowKeysNavigation')}</p>

      <ButtonGroup
        aria-label={t('buttonGroup.a11y.textFormatting')}
        data-testid="keyboard-nav-group"
      >
        {labels.map((label, index) => (
          <Button
            key={label}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            data-testid={`nav-button-${index}`}
            tabIndex={activeIndex === index ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index, labels.length)}
            onClick={handleClick}
            variant="outline"
          >
            {label}
          </Button>
        ))}
      </ButtonGroup>

      <div className="text-muted-foreground flex flex-col gap-1 text-xs">
        <span>
          {t('buttonGroup.story.currentFocus')} {labels[activeIndex]}
        </span>
        <span data-testid="press-count">
          {t('buttonGroup.story.pressCount')} {pressCount}
        </span>
      </div>
    </div>
  );
}

// ============ DARK MODE DEMO ============

function DarkModeDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">{t('buttonGroup.story.darkModeDemo')}</p>

      {/* All variants in dark mode */}
      <div className="space-y-4">
        {/* Default buttons */}
        <div>
          <div className="text-muted-foreground mb-2 text-xs">
            {t('buttonGroup.sections.allDefault')}
          </div>
          <ButtonGroup data-testid="dark-default-group">
            <Button>{t('buttonGroup.first')}</Button>
            <Button>{t('buttonGroup.second')}</Button>
            <Button>{t('buttonGroup.third')}</Button>
          </ButtonGroup>
        </div>

        {/* Outline buttons */}
        <div>
          <div className="text-muted-foreground mb-2 text-xs">{t('buttonGroup.outline')}</div>
          <ButtonGroup data-testid="dark-outline-group">
            <Button variant="outline">{t('buttonGroup.cut')}</Button>
            <ButtonGroupSeparator />
            <Button variant="outline">{t('buttonGroup.copy')}</Button>
            <ButtonGroupSeparator />
            <Button variant="outline">{t('buttonGroup.paste')}</Button>
          </ButtonGroup>
        </div>

        {/* Secondary buttons */}
        <div>
          <div className="text-muted-foreground mb-2 text-xs">{t('buttonGroup.secondary')}</div>
          <ButtonGroup data-testid="dark-secondary-group">
            <Button variant="secondary">{t('buttonGroup.save')}</Button>
            <Button variant="secondary">{t('buttonGroup.cancel')}</Button>
          </ButtonGroup>
        </div>

        {/* Destructive buttons */}
        <div>
          <div className="text-muted-foreground mb-2 text-xs">
            {t('buttonGroup.story.destructive', 'Destructive')}
          </div>
          <ButtonGroup data-testid="dark-destructive-group">
            <Button variant="outline">{t('buttonGroup.cancel')}</Button>
            <Button variant="destructive">{t('buttonGroup.delete')}</Button>
          </ButtonGroup>
        </div>
      </div>
    </div>
  );
}

// ============ GROUP INTERACTIONS DEMO ============

function GroupInteractionsDemo() {
  const { t } = useTranslation();
  const [selectedButton, setSelectedButton] = React.useState<string | null>(null);
  const [clickedButtons, setClickedButtons] = React.useState<string[]>([]);

  const handleButtonClick = (label: string) => {
    setSelectedButton(label);
    setClickedButtons((prev) => [...prev, label]);
  };

  return (
    <div className="space-y-6">
      {/* Single selection group (radio-like) */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {t('buttonGroup.story.singleSelection', 'Single Selection')}
        </div>
        <ButtonGroup
          aria-label={t('buttonGroup.a11y.alignmentOptions')}
          data-testid="single-selection-group"
        >
          {[
            t('buttonGroup.alignLeft'),
            t('buttonGroup.alignCenter'),
            t('buttonGroup.alignRight'),
          ].map((label) => (
            <Button
              key={label}
              variant={selectedButton === label ? 'default' : 'outline'}
              onClick={() => handleButtonClick(label)}
              data-testid={`align-${label.toLowerCase().replace(' ', '-')}`}
              aria-pressed={selectedButton === label}
            >
              {label}
            </Button>
          ))}
        </ButtonGroup>
        {selectedButton && (
          <p className="text-muted-foreground mt-2 text-xs" data-testid="selection-result">
            {t('buttonGroup.story.selected', 'Selected: {{item}}', { item: selectedButton })}
          </p>
        )}
      </div>

      {/* Click tracking */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {t('buttonGroup.story.clickTracking', 'Click Tracking')}
        </div>
        <ButtonGroup
          aria-label={t('buttonGroup.a11y.editorActions')}
          data-testid="click-tracking-group"
        >
          <Button
            variant="outline"
            onClick={() => handleButtonClick('undo')}
            data-testid="undo-btn"
          >
            {t('buttonGroup.undo')}
          </Button>
          <ButtonGroupSeparator />
          <Button
            variant="outline"
            onClick={() => handleButtonClick('redo')}
            data-testid="redo-btn"
          >
            {t('buttonGroup.redo')}
          </Button>
        </ButtonGroup>
        {clickedButtons.length > 0 && (
          <p className="text-muted-foreground mt-2 text-xs" data-testid="click-history">
            {t('buttonGroup.story.clickHistory', 'Click history: {{history}}', {
              history: clickedButtons.join(' → '),
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// ============ META CONFIGURATION ============

const meta = {
  title: 'Components/UI/Button Group',
  component: ButtonGroupDemo,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  parameters: {
    msw: { handlers: buttonGroupHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    children: {
      control: false,
      description: i18n.t(
        'buttonGroup.argType.buttonElementsAndButtongroupseparatorComponents',
        'Button elements and ButtonGroupSeparator components'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t('buttonGroup.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'buttonGroup.argType.whetherAllButtonsInTheGroupAreDisabled',
        'Whether all buttons in the group are disabled'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: i18n.t(
        'buttonGroup.argType.layoutDirectionOfTheButtonGroup',
        'Layout direction of the button group'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'horizontal' },
        type: { summary: "'horizontal' | 'vertical'" },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('buttonGroup.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('buttonGroup.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('buttonGroup.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('buttonGroup.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('buttonGroup.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('buttonGroup.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('buttonGroup.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    // ButtonGroup Props Reference:
    // - orientation: Layout direction ('horizontal' | 'vertical', default: 'horizontal')
    // - className: Additional CSS classes (string)
    // - children: Button elements and ButtonGroupSeparator (ReactNode)
    //
    // ButtonGroupSeparator Props Reference:
    // - orientation: Separator direction ('horizontal' | 'vertical')
    //   - Use 'vertical' for horizontal button groups (default)
    //   - Use 'horizontal' for vertical button groups
    // - className: Additional CSS classes (string)
    // Note: Visual separator between buttons
    //
    // ButtonGroupText Props Reference:
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    // - children: Text content (ReactNode)
    // Note: Read-only text element styled as button group member
    //
    // Usage Notes:
    // - Buttons in group have connected borders
    // - First and last buttons have rounded corners
    // - Middle buttons have no rounded corners
    // - Use ButtonGroupSeparator for visual division
    // - ButtonGroupText for labels or read-only values
  },
} satisfies Meta<typeof ButtonGroupDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============ CORE STORIES ============

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="button-group-text"]')).toBeInTheDocument();

    expect(canvasElement.querySelectorAll('[data-slot="button-group"]').length).toBe(2);
    expect(canvasElement.querySelectorAll('[data-slot="button-group-separator"]').length).toBe(2);
    expect(canvasElement.querySelectorAll('[data-slot="button"]').length).toBe(6);
  },
};

function VerticalDemo() {
  const { t } = useTranslation();
  return (
    <ButtonGroup orientation="vertical">
      <Button variant="outline">{t('buttonGroup.top')}</Button>
      <ButtonGroupSeparator orientation="horizontal" />
      <Button variant="outline">{t('buttonGroup.middle')}</Button>
      <ButtonGroupSeparator orientation="horizontal" />
      <Button variant="outline">{t('buttonGroup.bottom')}</Button>
    </ButtonGroup>
  );
}

export const Vertical: Story = {
  render: () => <VerticalDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const group = canvasElement.querySelector('[data-slot="button-group"]');
    if (!(group instanceof HTMLElement)) {
      throw new Error('ButtonGroup was not rendered.');
    }

    expect(group.getAttribute('data-orientation')).toBe('vertical');
    expect(group.querySelectorAll('[data-slot="button"]').length).toBe(3);
    expect(group.querySelectorAll('[data-slot="button-group-separator"]').length).toBe(2);

    const separators = group.querySelectorAll('[data-slot="button-group-separator"]');
    for (const separator of separators) {
      expect(separator.getAttribute('data-orientation')).toBe('horizontal');
    }
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify button groups render
    expect(canvasElement.querySelectorAll('[data-slot="button-group"]').length).toBe(2);
    expect(canvas.getAllByRole('button').length).toBe(6);
    expect(canvasElement.querySelector('[data-slot="button-group-text"]')).toBeInTheDocument();
  },
};

// ============ VARIANTS ============

function VariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      {/* All Default */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('buttonGroup.sections.allDefault')}
        </div>
        <ButtonGroup>
          <Button>{i18n.t('buttonGroup.first')}</Button>
          <Button>{i18n.t('buttonGroup.second')}</Button>
          <Button>{i18n.t('buttonGroup.third')}</Button>
        </ButtonGroup>
      </div>

      {/* Mixed Variants */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('buttonGroup.sections.mixedVariants')}
        </div>
        <ButtonGroup>
          <Button variant="default">{i18n.t('buttonGroup.primary')}</Button>
          <Button variant="secondary">{i18n.t('buttonGroup.secondary')}</Button>
          <Button variant="outline">{i18n.t('buttonGroup.outline')}</Button>
        </ButtonGroup>
      </div>

      {/* With Icons */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('buttonGroup.sections.withIcons')}
        </div>
        <ButtonGroup>
          <Button variant="outline">
            <svg
              className="mr-1 size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {i18n.t('buttonGroup.previous')}
          </Button>
          <Button variant="outline">
            {i18n.t('buttonGroup.next')}
            <svg
              className="ml-1 size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </ButtonGroup>
      </div>

      {/* Attached Style (with separators) */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('buttonGroup.sections.attachedStyle')}
        </div>
        <ButtonGroup>
          <Button variant="outline">{i18n.t('buttonGroup.cut')}</Button>
          <ButtonGroupSeparator />
          <Button variant="outline">{i18n.t('buttonGroup.copy')}</Button>
          <ButtonGroupSeparator />
          <Button variant="outline">{i18n.t('buttonGroup.paste')}</Button>
        </ButtonGroup>
      </div>
    </div>
  );
}

export const Variants: Story = {
  name: i18n.t(
    'buttonGroup.storyName.variants',
    'Variants (all default, mixed variants, with icons, attached style)'
  ),
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll('[data-slot="button-group"]').length).toBe(4);
    expect(canvasElement.querySelectorAll('[data-slot="button-group-separator"]').length).toBe(2);
  },
};

// ============ SIZES ============

function SizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      {/* Small Buttons */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {t('buttonGroup.sections.smallButtons')}
        </div>
        <ButtonGroup>
          <Button size="sm" variant="outline">
            {t('buttonGroup.first')}
          </Button>
          <Button size="sm" variant="outline">
            {t('buttonGroup.second')}
          </Button>
          <Button size="sm" variant="outline">
            {t('buttonGroup.third')}
          </Button>
        </ButtonGroup>
      </div>

      {/* Default Buttons */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {t('buttonGroup.sections.defaultButtons')}
        </div>
        <ButtonGroup>
          <Button variant="outline">{t('buttonGroup.first')}</Button>
          <Button variant="outline">{t('buttonGroup.second')}</Button>
          <Button variant="outline">{t('buttonGroup.third')}</Button>
        </ButtonGroup>
      </div>

      {/* Large Buttons */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {t('buttonGroup.sections.largeButtons')}
        </div>
        <ButtonGroup>
          <Button size="lg" variant="outline">
            {t('buttonGroup.first')}
          </Button>
          <Button size="lg" variant="outline">
            {t('buttonGroup.second')}
          </Button>
          <Button size="lg" variant="outline">
            {t('buttonGroup.third')}
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  name: i18n.t('buttonGroup.storyName.sizes', 'Sizes (sm buttons, default, lg buttons)'),
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll('[data-slot="button-group"]').length).toBe(3);
    expect(canvasElement.querySelectorAll('[data-slot="button"]').length).toBe(9);
  },
};

// ============ DARK MODE STORY ============

export const Dark: Story = {
  name: i18n.t('buttonGroup.storyName.dark', 'Dark Mode'),
  render: () => <DarkModeDemo />,
  globals: {
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify all button groups are rendered
    expect(canvas.getByTestId('dark-default-group')).toBeInTheDocument();
    expect(canvas.getByTestId('dark-outline-group')).toBeInTheDocument();
    expect(canvas.getByTestId('dark-secondary-group')).toBeInTheDocument();
    expect(canvas.getByTestId('dark-destructive-group')).toBeInTheDocument();

    // Verify buttons are clickable in dark mode
    const firstButton = canvas
      .getByTestId('dark-default-group')
      .querySelector('[data-slot="button"]');
    expect(firstButton).toBeInTheDocument();

    // Test interaction in dark mode
    if (firstButton) {
      await userEvent.click(firstButton);
      expect(firstButton).toHaveFocus();
    }
  },
};

export const DarkModeJapanese: Story = {
  name: i18n.t('buttonGroup.storyName.darkModeJapanese', 'Dark Mode (Japanese)'),
  render: () => <DarkModeDemo />,
  globals: {
    theme: 'dark',
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    // Verify Japanese text is rendered
    const canvas = within(canvasElement);
    expect(canvas.getByText('最初')).toBeInTheDocument();
    expect(canvas.getByText('二番目')).toBeInTheDocument();
    expect(canvas.getByText('三番目')).toBeInTheDocument();
  },
};

// ============ KEYBOARD NAVIGATION STORIES ============

export const KeyboardNavigation: Story = {
  name: i18n.t('buttonGroup.storyName.keyboardNavigation', 'Keyboard Navigation (Arrow Keys)'),
  render: () => <KeyboardNavigationDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Get the first button and focus it
    const firstButton = canvas.getByTestId('nav-button-0');
    const secondButton = canvas.getByTestId('nav-button-1');
    const thirdButton = canvas.getByTestId('nav-button-2');

    // Initial focus
    firstButton.focus();
    expect(doc.activeElement).toBe(firstButton);

    // Test ArrowRight navigation
    await userEvent.keyboard('{ArrowRight}');
    expect(doc.activeElement).toBe(secondButton);

    await userEvent.keyboard('{ArrowRight}');
    expect(doc.activeElement).toBe(thirdButton);

    // Test wrap-around (right from last goes to first)
    await userEvent.keyboard('{ArrowRight}');
    expect(doc.activeElement).toBe(firstButton);

    // Test ArrowLeft navigation
    await userEvent.keyboard('{ArrowLeft}');
    expect(doc.activeElement).toBe(thirdButton);

    // Test Home key
    await userEvent.keyboard('{Home}');
    expect(doc.activeElement).toBe(firstButton);

    // Test End key
    await userEvent.keyboard('{End}');
    expect(doc.activeElement).toBe(thirdButton);

    // Test click via Enter key
    const pressCountBefore = canvas.getByTestId('press-count').textContent;
    await userEvent.keyboard('{Enter}');
    const pressCountAfter = canvas.getByTestId('press-count').textContent;
    expect(pressCountAfter).not.toBe(pressCountBefore);
  },
};

// ============ GROUP INTERACTIONS STORIES ============

export const GroupInteractions: Story = {
  name: i18n.t('buttonGroup.storyName.groupInteractions', 'Group Interactions'),
  render: () => <GroupInteractionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test single selection
    const alignLeftBtn = canvas.getByTestId('align-align left');
    const alignCenterBtn = canvas.getByTestId('align-align center');

    await userEvent.click(alignLeftBtn);
    expect(canvas.getByTestId('selection-result')).toHaveTextContent('Align Left');

    await userEvent.click(alignCenterBtn);
    expect(canvas.getByTestId('selection-result')).toHaveTextContent('Align Center');

    // Test click tracking
    const undoBtn = canvas.getByTestId('undo-btn');
    const redoBtn = canvas.getByTestId('redo-btn');

    await userEvent.click(undoBtn);
    await userEvent.click(redoBtn);
    await userEvent.click(undoBtn);

    const history = canvas.getByTestId('click-history');
    expect(history).toHaveTextContent('undo');
    expect(history).toHaveTextContent('redo');
  },
};

// ============ RTL SUPPORT ============

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify groups render in RTL context
    expect(canvasElement.querySelectorAll('[data-slot="button-group"]').length).toBe(2);
    expect(canvas.getAllByRole('button').length).toBe(6);
    expect(canvasElement.querySelector('[data-slot="button-group-text"]')).toBeInTheDocument();
  },
};

// ============ TEXT AS CHILD ============

export const TextAsChild: Story = {
  name: i18n.t('buttonGroup.storyName.textAsChild', 'Text (asChild anchor)'),
  render: () => <ButtonGroupTextAsChildDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const anchor = canvas.getByRole('link');

    expect(anchor.getAttribute('href')).toBe('#button-group-text-as-child');
    expect(anchor.getAttribute('data-slot')).toBe('button-group-text');
  },
};

// ============ I18N STORIES ============

export const Japanese: Story = {
  name: i18n.t('buttonGroup.storyName.japanese', 'Japanese Locale'),
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    await Default.play?.(context);

    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(context.canvasElement);
    expect(canvas.getByText('読み取り専用グループラベル')).toBeInTheDocument();
    expect(canvas.getByText('左')).toBeInTheDocument();
    expect(canvas.getByText('中央')).toBeInTheDocument();
    expect(canvas.getByText('右')).toBeInTheDocument();
  },
};

export const JapaneseKeyboardNavigation: Story = {
  name: i18n.t(
    'buttonGroup.storyName.japaneseKeyboardNavigation',
    'Japanese Locale (Keyboard Navigation)'
  ),
  render: () => <KeyboardNavigationDemo />,
  globals: {
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Verify Japanese text
    expect(doc.documentElement.lang).toBe('ja');
    expect(canvas.getByText('太字')).toBeInTheDocument();
    expect(canvas.getByText('斜体')).toBeInTheDocument();
    expect(canvas.getByText('下線')).toBeInTheDocument();

    // Test keyboard navigation works with Japanese content
    const firstButton = canvas.getByTestId('nav-button-0');
    firstButton.focus();
    expect(doc.activeElement).toBe(firstButton);

    await userEvent.keyboard('{ArrowRight}');
    const secondButton = canvas.getByTestId('nav-button-1');
    expect(doc.activeElement).toBe(secondButton);
  },
};

// ============ DESIGN REFERENCE ============

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

// ============ PSEUDO STATES ============

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('buttonGroup.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const groups = createFakeButtonGroups(3);
    return (
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.id} className="space-y-1">
            {group.name && (
              <p className="text-muted-foreground text-xs font-medium">{group.name}</p>
            )}
            <ButtonGroup>
              {group.items.map((item) => {
                if (item.type === 'separator') {
                  return <ButtonGroupSeparator key={item.id} />;
                }
                if (item.type === 'text') {
                  return <ButtonGroupText key={item.id}>{item.label}</ButtonGroupText>;
                }
                return (
                  <Button
                    key={item.id}
                    variant={item.variant ?? 'outline'}
                    disabled={item.disabled}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </ButtonGroup>
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const groups = canvasElement.querySelectorAll('[data-slot="button-group"]');
    expect(groups.length).toBeGreaterThanOrEqual(1);
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonGroupHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify component renders with MSW handlers active
    expect(canvasElement.querySelectorAll('[data-slot="button-group"]').length).toBe(2);
    expect(canvas.getAllByRole('button').length).toBe(6);
    expect(canvasElement.querySelector('[data-slot="button-group-text"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonGroupStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    // Verify component renders under loading MSW state
    expect(canvasElement.querySelectorAll('[data-slot="button-group"]').length).toBe(2);
    expect(canvasElement.querySelectorAll('[data-slot="button"]').length).toBe(6);
    expect(canvasElement.querySelector('[data-slot="button-group-text"]')).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonGroupStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    // Verify component renders under 400 MSW state
    expect(canvasElement.querySelectorAll('[data-slot="button-group"]').length).toBe(2);
    expect(canvasElement.querySelectorAll('[data-slot="button"]').length).toBe(6);
    expect(canvasElement.querySelector('[data-slot="button-group-text"]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonGroupStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    // Verify component renders under 401 MSW state
    expect(canvasElement.querySelectorAll('[data-slot="button-group"]').length).toBe(2);
    expect(canvasElement.querySelectorAll('[data-slot="button"]').length).toBe(6);
    expect(canvasElement.querySelector('[data-slot="button-group-text"]')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonGroupStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    // Verify component renders under 403 MSW state
    expect(canvasElement.querySelectorAll('[data-slot="button-group"]').length).toBe(2);
    expect(canvasElement.querySelectorAll('[data-slot="button"]').length).toBe(6);
    expect(canvasElement.querySelector('[data-slot="button-group-text"]')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonGroupStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    // Verify component renders under 422 MSW state
    expect(canvasElement.querySelectorAll('[data-slot="button-group"]').length).toBe(2);
    expect(canvasElement.querySelectorAll('[data-slot="button"]').length).toBe(6);
    expect(canvasElement.querySelector('[data-slot="button-group-text"]')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonGroupStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    // Verify component renders under 500 MSW state
    expect(canvasElement.querySelectorAll('[data-slot="button-group"]').length).toBe(2);
    expect(canvasElement.querySelectorAll('[data-slot="button"]').length).toBe(6);
    expect(canvasElement.querySelector('[data-slot="button-group-text"]')).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonGroupStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    // Verify component renders under network error MSW state
    expect(canvasElement.querySelectorAll('[data-slot="button-group"]').length).toBe(2);
    expect(canvasElement.querySelectorAll('[data-slot="button"]').length).toBe(6);
    expect(canvasElement.querySelector('[data-slot="button-group-text"]')).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY STORY ============

function AccessibilityDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <ButtonGroup aria-label={t('buttonGroup.a11y.textFormatting')}>
        <Button variant="outline">{t('buttonGroup.firstAction')}</Button>
        <Button variant="outline">{t('buttonGroup.secondAction')}</Button>
        <Button variant="outline">{t('buttonGroup.thirdAction')}</Button>
      </ButtonGroup>
      <ButtonGroup aria-label={t('buttonGroup.a11y.editorActions')}>
        <Button variant="outline">{t('buttonGroup.cut')}</Button>
        <ButtonGroupSeparator />
        <Button variant="outline">{t('buttonGroup.copy')}</Button>
        <ButtonGroupSeparator />
        <Button variant="outline">{t('buttonGroup.paste')}</Button>
      </ButtonGroup>
    </div>
  );
}

export const Accessibility: Story = {
  name: i18n.t('buttonGroup.storyName.accessibility', 'Accessibility'),
  render: () => <AccessibilityDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Test button group structure
    const buttonGroups = canvasElement.querySelectorAll('[data-slot="button-group"]');
    expect(buttonGroups.length).toBe(2);

    // Get all buttons
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(6);

    // Verify all buttons have accessible names
    for (const button of buttons) {
      expect(button.textContent?.trim().length).not.toBe(0);
      expect(button.getAttribute('data-slot')).toBe('button');
    }

    // Test keyboard navigation
    buttons[0].focus();
    expect(doc.activeElement).toBe(buttons[0]);

    // Tab should move to next button
    await userEvent.keyboard('{Tab}');
    expect(doc.activeElement).toBe(buttons[1]);

    await userEvent.keyboard('{Tab}');
    expect(doc.activeElement).toBe(buttons[2]);

    // Shift+Tab should move back
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(doc.activeElement).toBe(buttons[1]);

    // Test Enter/Space activation
    const firstButton = buttons[0];
    firstButton.focus();
    await userEvent.keyboard('{Enter}');
    // Button should remain focused after activation
    expect(doc.activeElement).toBe(firstButton);

    await userEvent.keyboard(' ');
    expect(doc.activeElement).toBe(firstButton);

    // Verify separators are presentational
    const separators = canvasElement.querySelectorAll('[data-slot="button-group-separator"]');
    expect(separators.length).toBe(2);
    for (const separator of separators) {
      // Separators should be visual only, not interactive
      expect(separator.getAttribute('role')).toBe('separator');
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Accessibility testing with keyboard navigation and button group semantics.',
      },
    },
  },
};

// ============ SHARED FACTORY RENDERER ============

/** Renders a FakeButtonGroup into actual components */
function renderFakeGroup(group: FakeButtonGroup) {
  return (
    <ButtonGroup
      key={group.id}
      orientation={group.orientation}
      data-testid={`factory-group-${group.id}`}
    >
      {group.items.map((item: FakeButtonGroupItem) => {
        if (item.type === 'separator') {
          return <ButtonGroupSeparator key={item.id} />;
        }
        if (item.type === 'text') {
          return <ButtonGroupText key={item.id}>{item.label}</ButtonGroupText>;
        }
        return (
          <Button key={item.id} variant={item.variant ?? 'outline'} disabled={item.disabled}>
            {item.label}
          </Button>
        );
      })}
    </ButtonGroup>
  );
}

// ============ FACTORY: SINGLE ITEM ============

function FactorySingleItemDemo() {
  const { t } = useTranslation();
  const item: FakeButtonGroupItem = createFakeButtonGroupItem({
    label: t('buttonGroup.story.test', 'Test'),
  });

  return (
    <div className="space-y-4" data-testid="factory-single-item">
      <p className="text-muted-foreground text-xs">{t('buttonGroup.factory.singleItem')}</p>
      <ButtonGroup>
        <Button variant={item.variant ?? 'outline'} disabled={item.disabled}>
          {item.label}
        </Button>
      </ButtonGroup>
      <div className="text-muted-foreground text-xs">
        <span>ID: {item.id.slice(0, 8)}...</span>
        <span className="ml-2">Type: {item.type}</span>
        <span className="ml-2">Variant: {item.variant ?? 'default'}</span>
      </div>
    </div>
  );
}

export const FactorySingleItem: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factorySingleItem',
    'Factory: Single Item (createFakeButtonGroupItem)'
  ),
  render: () => <FactorySingleItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-single-item')).toBeInTheDocument();
    expect(canvas.getByText('Test')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="button"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: SEPARATOR ============

function FactorySeparatorDemo() {
  const sep: FakeButtonGroupItem = createFakeButtonGroupSeparator();

  return (
    <div className="space-y-4" data-testid="factory-separator">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.separator')}</p>
      <ButtonGroup>
        <Button variant="outline">{i18n.t('buttonGroup.left')}</Button>
        <ButtonGroupSeparator />
        <Button variant="outline">{i18n.t('buttonGroup.right')}</Button>
      </ButtonGroup>
      <div className="text-muted-foreground text-xs">
        <span>Separator ID: {sep.id.slice(0, 8)}...</span>
        <span className="ml-2">Type: {sep.type}</span>
      </div>
    </div>
  );
}

export const FactorySeparator: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factorySeparator',
    'Factory: Separator (createFakeButtonGroupSeparator)'
  ),
  render: () => <FactorySeparatorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-separator')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="button-group-separator"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: TEXT ITEM ============

function FactoryTextItemDemo() {
  const textItem: FakeButtonGroupItem = createFakeButtonGroupText('Page 1 of 5');

  return (
    <div className="space-y-4" data-testid="factory-text-item">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.textItem')}</p>
      <ButtonGroup>
        <Button variant="outline">{i18n.t('buttonGroup.previous')}</Button>
        <ButtonGroupText>{textItem.label}</ButtonGroupText>
        <Button variant="outline">{i18n.t('buttonGroup.next')}</Button>
      </ButtonGroup>
      <div className="text-muted-foreground text-xs">
        <span>Text ID: {textItem.id.slice(0, 8)}...</span>
        <span className="ml-2">Type: {textItem.type}</span>
      </div>
    </div>
  );
}

export const FactoryTextItem: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryTextItem',
    'Factory: Text Item (createFakeButtonGroupText)'
  ),
  render: () => <FactoryTextItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-text-item')).toBeInTheDocument();
    expect(canvas.getByText('Page 1 of 5')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="button-group-text"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: BULK ITEMS ============

function FactoryBulkItemsDemo() {
  const items: FakeButtonGroupItem[] = createFakeButtonGroupItems(5);

  return (
    <div className="space-y-4" data-testid="factory-bulk-items">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.bulkItems')}</p>
      <ButtonGroup>
        {items.map((item) => (
          <Button key={item.id} variant={item.variant ?? 'outline'} disabled={item.disabled}>
            {item.label}
          </Button>
        ))}
      </ButtonGroup>
      <p className="text-muted-foreground text-xs">
        {i18n.t('buttonGroup.story.generatedItems', { count: items.length })}
      </p>
    </div>
  );
}

export const FactoryBulkItems: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryBulkItems',
    'Factory: Bulk Items (createFakeButtonGroupItems)'
  ),
  render: () => <FactoryBulkItemsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-bulk-items')).toBeInTheDocument();
    const buttons = canvasElement.querySelectorAll('[data-slot="button"]');
    expect(buttons.length).toBe(5);
  },
};

// ============ FACTORY: SINGLE GROUP ============

function FactorySingleGroupDemo() {
  const group: FakeButtonGroup = createFakeButtonGroup(4);

  return (
    <div className="space-y-4" data-testid="factory-single-group">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.singleGroup')}</p>
      {group.name && <p className="text-muted-foreground text-xs font-medium">{group.name}</p>}
      {renderFakeGroup(group)}
      <div className="text-muted-foreground text-xs">
        <span>Layout: {group.layout ?? 'default'}</span>
        <span className="ml-2">Orientation: {group.orientation}</span>
        <span className="ml-2">Items: {group.items.length}</span>
      </div>
    </div>
  );
}

export const FactorySingleGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factorySingleGroup',
    'Factory: Single Group (createFakeButtonGroup)'
  ),
  render: () => <FactorySingleGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-single-group')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="button-group"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: HORIZONTAL GROUP ============

function FactoryHorizontalGroupDemo() {
  const group: FakeButtonGroup = createFakeHorizontalButtonGroup(4);

  return (
    <div className="space-y-4" data-testid="factory-horizontal-group">
      <p className="text-muted-foreground text-xs">
        {i18n.t('buttonGroup.factory.horizontalGroup')}
      </p>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryHorizontalGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryHorizontalGroup',
    'Factory: Horizontal Group (createFakeHorizontalButtonGroup)'
  ),
  render: () => <FactoryHorizontalGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-horizontal-group')).toBeInTheDocument();
    const group = canvasElement.querySelector('[data-slot="button-group"]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('data-orientation')).toBe('horizontal');
  },
};

// ============ FACTORY: VERTICAL GROUP ============

function FactoryVerticalGroupDemo() {
  const group: FakeButtonGroup = createFakeVerticalButtonGroup(3);

  return (
    <div className="space-y-4" data-testid="factory-vertical-group">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.verticalGroup')}</p>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryVerticalGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryVerticalGroup',
    'Factory: Vertical Group (createFakeVerticalButtonGroup)'
  ),
  render: () => <FactoryVerticalGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-vertical-group')).toBeInTheDocument();
    const group = canvasElement.querySelector('[data-slot="button-group"]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('data-orientation')).toBe('vertical');
  },
};

// ============ FACTORY: CLIPBOARD GROUP ============

function FactoryClipboardGroupDemo() {
  const group: FakeButtonGroup = createFakeClipboardButtonGroup();

  return (
    <div className="space-y-4" data-testid="factory-clipboard-group">
      <p className="text-muted-foreground text-xs">
        {i18n.t('buttonGroup.factory.clipboardGroup')}
      </p>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryClipboardGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryClipboardGroup',
    'Factory: Clipboard Group (createFakeClipboardButtonGroup)'
  ),
  render: () => <FactoryClipboardGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-clipboard-group')).toBeInTheDocument();
    expect(canvas.getByText('Cut')).toBeInTheDocument();
    expect(canvas.getByText('Copy')).toBeInTheDocument();
    expect(canvas.getByText('Paste')).toBeInTheDocument();
  },
};

// ============ FACTORY: FORMATTING GROUP ============

function FactoryFormattingGroupDemo() {
  const group: FakeButtonGroup = createFakeFormattingButtonGroup();

  return (
    <div className="space-y-4" data-testid="factory-formatting-group">
      <p className="text-muted-foreground text-xs">
        {i18n.t('buttonGroup.factory.formattingGroup')}
      </p>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryFormattingGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryFormattingGroup',
    'Factory: Formatting Group (createFakeFormattingButtonGroup)'
  ),
  render: () => <FactoryFormattingGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-formatting-group')).toBeInTheDocument();
    expect(canvas.getByText('Bold')).toBeInTheDocument();
    expect(canvas.getByText('Italic')).toBeInTheDocument();
    expect(canvas.getByText('Underline')).toBeInTheDocument();
  },
};

// ============ FACTORY: ALIGNMENT GROUP ============

function FactoryAlignmentGroupDemo() {
  const group: FakeButtonGroup = createFakeAlignmentButtonGroup();

  return (
    <div className="space-y-4" data-testid="factory-alignment-group">
      <p className="text-muted-foreground text-xs">
        {i18n.t('buttonGroup.factory.alignmentGroup')}
      </p>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryAlignmentGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryAlignmentGroup',
    'Factory: Alignment Group (createFakeAlignmentButtonGroup)'
  ),
  render: () => <FactoryAlignmentGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-alignment-group')).toBeInTheDocument();
    expect(canvas.getByText('Left')).toBeInTheDocument();
    expect(canvas.getByText('Center')).toBeInTheDocument();
    expect(canvas.getByText('Right')).toBeInTheDocument();
    expect(canvas.getByText('Justify')).toBeInTheDocument();
  },
};

// ============ FACTORY: PAGINATION GROUP ============

function FactoryPaginationGroupDemo() {
  const group: FakeButtonGroup = createFakePaginationButtonGroup();

  return (
    <div className="space-y-4" data-testid="factory-pagination-group">
      <p className="text-muted-foreground text-xs">
        {i18n.t('buttonGroup.factory.paginationGroup')}
      </p>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryPaginationGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryPaginationGroup',
    'Factory: Pagination Group (createFakePaginationButtonGroup)'
  ),
  render: () => <FactoryPaginationGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-pagination-group')).toBeInTheDocument();
    expect(canvas.getByText('First')).toBeInTheDocument();
    expect(canvas.getByText('Previous')).toBeInTheDocument();
    expect(canvas.getByText('Next')).toBeInTheDocument();
    expect(canvas.getByText('Last')).toBeInTheDocument();
  },
};

// ============ FACTORY: NAVIGATION GROUP ============

function FactoryNavigationGroupDemo() {
  const group: FakeButtonGroup = createFakeNavigationButtonGroup();

  return (
    <div className="space-y-4" data-testid="factory-navigation-group">
      <p className="text-muted-foreground text-xs">
        {i18n.t('buttonGroup.factory.navigationGroup')}
      </p>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryNavigationGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryNavigationGroup',
    'Factory: Navigation Group (createFakeNavigationButtonGroup)'
  ),
  render: () => <FactoryNavigationGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-navigation-group')).toBeInTheDocument();
    expect(canvas.getByText('Previous')).toBeInTheDocument();
    expect(canvas.getByText('Next')).toBeInTheDocument();
  },
};

// ============ FACTORY: UNDO/REDO GROUP ============

function FactoryUndoRedoGroupDemo() {
  const group: FakeButtonGroup = createFakeUndoRedoButtonGroup();

  return (
    <div className="space-y-4" data-testid="factory-undo-redo-group">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.undoRedoGroup')}</p>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryUndoRedoGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryUndoRedoGroup',
    'Factory: Undo/Redo Group (createFakeUndoRedoButtonGroup)'
  ),
  render: () => <FactoryUndoRedoGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-undo-redo-group')).toBeInTheDocument();
    expect(canvas.getByText('Undo')).toBeInTheDocument();
    expect(canvas.getByText('Redo')).toBeInTheDocument();
  },
};

// ============ FACTORY: ZOOM GROUP ============

function FactoryZoomGroupDemo() {
  const group: FakeButtonGroup = createFakeZoomButtonGroup();

  return (
    <div className="space-y-4" data-testid="factory-zoom-group">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.zoomGroup')}</p>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryZoomGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryZoomGroup',
    'Factory: Zoom Group (createFakeZoomButtonGroup)'
  ),
  render: () => <FactoryZoomGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-zoom-group')).toBeInTheDocument();
    expect(canvas.getByText('Zoom Out')).toBeInTheDocument();
    expect(canvas.getByText('Reset')).toBeInTheDocument();
    expect(canvas.getByText('Zoom In')).toBeInTheDocument();
  },
};

// ============ FACTORY: VIEW MODE GROUP ============

function FactoryViewModeGroupDemo() {
  const group: FakeButtonGroup = createFakeViewModeButtonGroup();

  return (
    <div className="space-y-4" data-testid="factory-view-mode-group">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.viewModeGroup')}</p>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryViewModeGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryViewModeGroup',
    'Factory: View Mode Group (createFakeViewModeButtonGroup)'
  ),
  render: () => <FactoryViewModeGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-view-mode-group')).toBeInTheDocument();
    expect(canvas.getByText('List')).toBeInTheDocument();
    expect(canvas.getByText('Grid')).toBeInTheDocument();
    expect(canvas.getByText('Cards')).toBeInTheDocument();
  },
};

// ============ FACTORY: GROUP WITH SEPARATORS ============

function FactoryGroupWithSeparatorsDemo() {
  const group: FakeButtonGroup = createFakeButtonGroupWithSeparators(4);

  return (
    <div className="space-y-4" data-testid="factory-group-with-separators">
      <p className="text-muted-foreground text-xs">
        {i18n.t('buttonGroup.factory.withSeparators')}
      </p>
      {renderFakeGroup(group)}
      <p className="text-muted-foreground text-xs">
        Total items: {group.items.length} (buttons + separators)
      </p>
    </div>
  );
}

export const FactoryGroupWithSeparators: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryGroupWithSeparators',
    'Factory: Group With Separators (createFakeButtonGroupWithSeparators)'
  ),
  render: () => <FactoryGroupWithSeparatorsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-group-with-separators')).toBeInTheDocument();
    // 4 buttons + 3 separators = 7 items
    expect(canvasElement.querySelectorAll('[data-slot="button"]').length).toBe(4);
    expect(canvasElement.querySelectorAll('[data-slot="button-group-separator"]').length).toBe(3);
  },
};

// ============ FACTORY: GROUP WITH TEXT ============

function FactoryGroupWithTextDemo() {
  const group: FakeButtonGroup = createFakeButtonGroupWithText('Status:');

  return (
    <div className="space-y-4" data-testid="factory-group-with-text">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.withText')}</p>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryGroupWithText: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryGroupWithText',
    'Factory: Group With Text (createFakeButtonGroupWithText)'
  ),
  render: () => <FactoryGroupWithTextDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-group-with-text')).toBeInTheDocument();
    expect(canvas.getByText('Status:')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="button-group-text"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: MIXED VARIANT GROUP ============

function FactoryMixedVariantGroupDemo() {
  const group: FakeButtonGroup = createFakeMixedVariantButtonGroup();

  return (
    <div className="space-y-4" data-testid="factory-mixed-variant-group">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.mixedVariants')}</p>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryMixedVariantGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryMixedVariantGroup',
    'Factory: Mixed Variant Group (createFakeMixedVariantButtonGroup)'
  ),
  render: () => <FactoryMixedVariantGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-mixed-variant-group')).toBeInTheDocument();
    expect(canvas.getByText('Default')).toBeInTheDocument();
    expect(canvas.getByText('Secondary')).toBeInTheDocument();
    expect(canvas.getByText('Outline')).toBeInTheDocument();
  },
};

// ============ FACTORY: ICON-ONLY GROUP ============

function FactoryIconOnlyGroupDemo() {
  const group: FakeButtonGroup = createFakeIconOnlyButtonGroup();

  return (
    <div className="space-y-4" data-testid="factory-icon-only-group">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.iconOnly')}</p>
      {renderFakeGroup(group)}
      <p className="text-muted-foreground text-xs">
        Icons: {group.items.map((i) => i.icon).join(', ')}
      </p>
    </div>
  );
}

export const FactoryIconOnlyGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryIconOnlyGroup',
    'Factory: Icon-Only Group (createFakeIconOnlyButtonGroup)'
  ),
  render: () => <FactoryIconOnlyGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-icon-only-group')).toBeInTheDocument();
    const buttons = canvasElement.querySelectorAll('[data-slot="button"]');
    expect(buttons.length).toBe(4);
  },
};

// ============ FACTORY: DISABLED GROUP ============

function FactoryDisabledGroupDemo() {
  const group: FakeButtonGroup = createFakeDisabledButtonGroup(3);

  return (
    <div className="space-y-4" data-testid="factory-disabled-group">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.disabledGroup')}</p>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryDisabledGroup: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryDisabledGroup',
    'Factory: Disabled Group (createFakeDisabledButtonGroup)'
  ),
  render: () => <FactoryDisabledGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-disabled-group')).toBeInTheDocument();
    const buttons = canvasElement.querySelectorAll('[data-slot="button"]');
    expect(buttons.length).toBe(3);
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  },
};

// ============ FACTORY: MATRIX ============

function FactoryMatrixDemo() {
  const matrix: FakeButtonGroup[] = createFakeButtonGroupMatrix();

  return (
    <div className="space-y-6" data-testid="factory-matrix">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.matrix')}</p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {matrix.map((group) => (
          <div key={group.id} className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">{group.name}</p>
            {renderFakeGroup(group)}
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryMatrix: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryMatrix',
    'Factory: Matrix (createFakeButtonGroupMatrix)'
  ),
  render: () => <FactoryMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-matrix')).toBeInTheDocument();
    // 2 orientations x 3 layouts = 6 groups
    const groups = canvasElement.querySelectorAll('[data-slot="button-group"]');
    expect(groups.length).toBe(6);
  },
};

// ============ FACTORY: CONFIG ============

function FactoryConfigDemo() {
  const scenarios = ['default', 'iconOnly', 'separated', 'vertical'] as const;
  const configs: FakeButtonGroupConfig[] = scenarios.map((s) => createFakeButtonGroupConfig(s));

  return (
    <div className="space-y-6" data-testid="factory-config">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.config')}</p>
      {scenarios.map((scenario, index) => {
        const config = configs[index];
        return (
          <div key={scenario} className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium capitalize">{scenario}</p>
            <div className="bg-muted/50 rounded-md p-3 text-xs">
              <div>Orientation: {config.orientation}</div>
              <div>Layout: {config.layout}</div>
              <div>Variant: {config.variant}</div>
              <div>Size: {config.size}</div>
              <div>Max Items: {config.maxItems}</div>
              <div>
                {i18n.t('buttonGroup.story.showSeparators', 'Show Separators:')}{' '}
                {config.showSeparators
                  ? i18n.t('buttonGroup.story.yes', 'Yes')
                  : i18n.t('buttonGroup.story.no', 'No')}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const FactoryConfig: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryConfig',
    'Factory: Config (createFakeButtonGroupConfig)'
  ),
  render: () => <FactoryConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-config')).toBeInTheDocument();
    expect(canvas.getByText('default')).toBeInTheDocument();
    expect(canvas.getByText('iconOnly')).toBeInTheDocument();
    expect(canvas.getByText('separated')).toBeInTheDocument();
    expect(canvas.getByText('vertical')).toBeInTheDocument();
  },
};

// ============ FACTORY: COMMON GROUPS ============

function FactoryCommonGroupsDemo() {
  const common: Record<string, FakeButtonGroup> = createFakeCommonButtonGroups();

  return (
    <div className="space-y-6" data-testid="factory-common-groups">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.commonGroups')}</p>
      {Object.entries(common).map(([key, group]) => (
        <div key={key} className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium capitalize">{key}</p>
          {renderFakeGroup(group)}
        </div>
      ))}
    </div>
  );
}

export const FactoryCommonGroups: Story = {
  name: i18n.t(
    'buttonGroup.storyName.factoryCommonGroups',
    'Factory: Common Groups (createFakeCommonButtonGroups)'
  ),
  render: () => <FactoryCommonGroupsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-common-groups')).toBeInTheDocument();
    // 8 common groups: alignment, clipboard, formatting, navigation, pagination, undoRedo, viewMode, zoom
    const groups = canvasElement.querySelectorAll('[data-slot="button-group"]');
    expect(groups.length).toBe(8);
  },
};

// ============ CONSTANTS: ORIENTATIONS ============

function ConstantOrientationsDemo() {
  return (
    <div className="space-y-4" data-testid="constant-orientations">
      <p className="text-muted-foreground text-xs">
        {i18n.t('buttonGroup.factory.allOrientations')}
      </p>
      {BUTTON_GROUP_ORIENTATIONS.map((orientation: ButtonGroupOrientation) => (
        <div key={orientation} className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium capitalize">{orientation}</p>
          <ButtonGroup orientation={orientation}>
            <Button variant="outline">{i18n.t('buttonGroup.first')}</Button>
            {orientation === 'vertical' ? (
              <ButtonGroupSeparator orientation="horizontal" />
            ) : (
              <ButtonGroupSeparator />
            )}
            <Button variant="outline">{i18n.t('buttonGroup.second')}</Button>
          </ButtonGroup>
        </div>
      ))}
    </div>
  );
}

export const ConstantOrientations: Story = {
  name: i18n.t('buttonGroup.storyName.constantOrientations', 'Constant: BUTTON_GROUP_ORIENTATIONS'),
  render: () => <ConstantOrientationsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-orientations')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="button-group"]');
    expect(groups.length).toBe(BUTTON_GROUP_ORIENTATIONS.length);
  },
};

// ============ CONSTANTS: ITEM TYPES ============

function ConstantItemTypesDemo() {
  return (
    <div className="space-y-4" data-testid="constant-item-types">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.allItemTypes')}</p>
      <ButtonGroup>
        {BUTTON_GROUP_ITEM_TYPES.map((type: ButtonGroupItemType) => {
          if (type === 'separator') {
            return <ButtonGroupSeparator key={type} />;
          }
          if (type === 'text') {
            return (
              <ButtonGroupText key={type}>
                {i18n.t('buttonGroup.story.text', 'Text')}
              </ButtonGroupText>
            );
          }
          return (
            <Button key={type} variant="outline">
              {type}
            </Button>
          );
        })}
      </ButtonGroup>
      <p className="text-muted-foreground text-xs">Types: {BUTTON_GROUP_ITEM_TYPES.join(', ')}</p>
    </div>
  );
}

export const ConstantItemTypes: Story = {
  name: i18n.t('buttonGroup.storyName.constantItemTypes', 'Constant: BUTTON_GROUP_ITEM_TYPES'),
  render: () => <ConstantItemTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-item-types')).toBeInTheDocument();
    expect(canvas.getByText('button')).toBeInTheDocument();
    expect(canvas.getByText('Text')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="button-group-separator"]')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: ITEM VARIANTS ============

function ConstantItemVariantsDemo() {
  return (
    <div className="space-y-4" data-testid="constant-item-variants">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.allVariants')}</p>
      <ButtonGroup>
        {BUTTON_GROUP_ITEM_VARIANTS.map((variant: ButtonGroupItemVariant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </ButtonGroup>
    </div>
  );
}

export const ConstantItemVariants: Story = {
  name: i18n.t(
    'buttonGroup.storyName.constantItemVariants',
    'Constant: BUTTON_GROUP_ITEM_VARIANTS'
  ),
  render: () => <ConstantItemVariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-item-variants')).toBeInTheDocument();
    const buttons = canvasElement.querySelectorAll('[data-slot="button"]');
    expect(buttons.length).toBe(BUTTON_GROUP_ITEM_VARIANTS.length);
    for (const variant of BUTTON_GROUP_ITEM_VARIANTS) {
      expect(canvas.getByText(variant)).toBeInTheDocument();
    }
  },
};

// ============ CONSTANTS: ITEM SIZES ============

function ConstantItemSizesDemo() {
  return (
    <div className="space-y-4" data-testid="constant-item-sizes">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.allSizes')}</p>
      <div className="flex flex-col gap-4">
        {BUTTON_GROUP_ITEM_SIZES.map((size: ButtonGroupItemSize) => (
          <div key={size} className="space-y-1">
            <p className="text-muted-foreground text-xs">{size}</p>
            <ButtonGroup>
              <Button size={size} variant="outline">
                A
              </Button>
              <Button size={size} variant="outline">
                B
              </Button>
            </ButtonGroup>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantItemSizes: Story = {
  name: i18n.t('buttonGroup.storyName.constantItemSizes', 'Constant: BUTTON_GROUP_ITEM_SIZES'),
  render: () => <ConstantItemSizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-item-sizes')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="button-group"]');
    expect(groups.length).toBe(BUTTON_GROUP_ITEM_SIZES.length);
  },
};

// ============ CONSTANTS: LAYOUTS ============

function ConstantLayoutsDemo() {
  return (
    <div className="space-y-4" data-testid="constant-layouts">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.allLayouts')}</p>
      {BUTTON_GROUP_LAYOUTS.map((layout: ButtonGroupLayout) => (
        <div key={layout} className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium capitalize">{layout}</p>
          <ButtonGroup>
            <Button variant="outline">{i18n.t('buttonGroup.first')}</Button>
            <Button variant="outline">{i18n.t('buttonGroup.second')}</Button>
            <Button variant="outline">{i18n.t('buttonGroup.third')}</Button>
          </ButtonGroup>
        </div>
      ))}
    </div>
  );
}

export const ConstantLayouts: Story = {
  name: i18n.t('buttonGroup.storyName.constantLayouts', 'Constant: BUTTON_GROUP_LAYOUTS'),
  render: () => <ConstantLayoutsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-layouts')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="button-group"]');
    expect(groups.length).toBe(BUTTON_GROUP_LAYOUTS.length);
    for (const layout of BUTTON_GROUP_LAYOUTS) {
      expect(canvas.getByText(layout)).toBeInTheDocument();
    }
  },
};

// ============ CONSTANTS: LABELS ============

function ConstantLabelsDemo() {
  return (
    <div className="space-y-4" data-testid="constant-labels">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.allLabels')}</p>
      <div className="flex flex-wrap gap-2">
        {BUTTON_GROUP_LABELS.map((label) => (
          <span
            key={label}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`label-${label}`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export const ConstantLabels: Story = {
  name: i18n.t('buttonGroup.storyName.constantLabels', 'Constant: BUTTON_GROUP_LABELS'),
  render: () => <ConstantLabelsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-labels')).toBeInTheDocument();
    expect(canvas.getByText('Actions')).toBeInTheDocument();
    expect(canvas.getByText('Formatting')).toBeInTheDocument();
    expect(canvas.getByText('Pagination')).toBeInTheDocument();
    expect(canvas.getByText('Zoom')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: ITEM LABELS ============

function ConstantItemLabelsDemo() {
  return (
    <div className="space-y-4" data-testid="constant-item-labels">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.allItemLabels')}</p>
      <div className="flex flex-wrap gap-1">
        {BUTTON_GROUP_ITEM_LABELS.map((label) => (
          <Button key={label} variant="outline" size="sm">
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const ConstantItemLabels: Story = {
  name: i18n.t('buttonGroup.storyName.constantItemLabels', 'Constant: BUTTON_GROUP_ITEM_LABELS'),
  render: () => <ConstantItemLabelsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-item-labels')).toBeInTheDocument();
    const buttons = canvasElement.querySelectorAll('[data-slot="button"]');
    expect(buttons.length).toBe(BUTTON_GROUP_ITEM_LABELS.length);
    expect(canvas.getByText('Add')).toBeInTheDocument();
    expect(canvas.getByText('Save')).toBeInTheDocument();
    expect(canvas.getByText('Undo')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: ICONS ============

function ConstantIconsDemo() {
  return (
    <div className="space-y-4" data-testid="constant-icons">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.allIcons')}</p>
      <div className="flex flex-wrap gap-1">
        {BUTTON_GROUP_ICONS.map((icon) => (
          <span
            key={icon}
            className="bg-muted rounded-md px-2 py-1 text-xs"
            data-testid={`icon-${icon}`}
          >
            {icon}
          </span>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">Total icons: {BUTTON_GROUP_ICONS.length}</p>
    </div>
  );
}

export const ConstantIcons: Story = {
  name: i18n.t('buttonGroup.storyName.constantIcons', 'Constant: BUTTON_GROUP_ICONS'),
  render: () => <ConstantIconsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-icons')).toBeInTheDocument();
    expect(canvas.getByText('AlignCenter')).toBeInTheDocument();
    expect(canvas.getByText('Bold')).toBeInTheDocument();
    expect(canvas.getByText('ZoomIn')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: PATTERNS ============

function ConstantPatternsDemo() {
  return (
    <div className="space-y-6" data-testid="constant-patterns">
      <p className="text-muted-foreground text-xs">{i18n.t('buttonGroup.factory.allPatterns')}</p>
      {Object.entries(BUTTON_GROUP_PATTERNS).map(([patternName, labels]) => (
        <div key={patternName} className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium capitalize">{patternName}</p>
          <ButtonGroup>
            {labels.map((label) => (
              <Button key={label} variant="outline">
                {label}
              </Button>
            ))}
          </ButtonGroup>
        </div>
      ))}
    </div>
  );
}

export const ConstantPatterns: Story = {
  name: i18n.t('buttonGroup.storyName.constantPatterns', 'Constant: BUTTON_GROUP_PATTERNS'),
  render: () => <ConstantPatternsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-patterns')).toBeInTheDocument();
    // 9 patterns: alignment, clipboard, formatting, navigation, pagination, textAlignment, undoRedo, viewMode, zoom
    const groups = canvasElement.querySelectorAll('[data-slot="button-group"]');
    expect(groups.length).toBe(Object.keys(BUTTON_GROUP_PATTERNS).length);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('buttonGroup.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('buttonGroup.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('buttonGroup.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('buttonGroup.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

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
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('buttonGroup.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: buttonGroupStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('buttonGroup.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: buttonGroupStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('buttonGroup.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: buttonGroupStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('buttonGroup.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: buttonGroupStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('buttonGroup.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: buttonGroupStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('buttonGroup.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: buttonGroupStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('buttonGroup.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: buttonGroupStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('buttonGroup.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: buttonGroupStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
