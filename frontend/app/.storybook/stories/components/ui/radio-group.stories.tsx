import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { CheckCircleIcon, LoaderIcon, XCircleIcon } from 'lucide-react';

import type {
  FakeRadioCardGroup,
  FakeRadioCardItem,
  FakeRadioGroup,
  FakeRadioItem,
  RadioGroupOrientation,
  RadioGroupSize,
  RadioGroupVariant,
  RadioItemState,
} from '@/.storybook/stories/_factories/radio-group.factory';
import {
  createFakeDeliveryRadioGroup,
  createFakeDescriptiveRadioGroup,
  createFakeDisabledRadioGroup,
  createFakeErrorRadioGroup,
  createFakePaymentRadioGroup,
  createFakePriorityRadioGroup,
  createFakeRadioCardGroup,
  createFakeRadioCardItem,
  createFakeRadioGroup,
  createFakeRadioGroups,
  createFakeRadioItem,
  createFakeRadioItems,
  createFakeRadioItemsFromSet,
  createFakeRatingRadioGroup,
  createFakeSizeRadioGroup,
  createFakeYesNoRadioGroup,
  createRadioGroupOrientationMatrix,
  createRadioGroupOrientationVariantMatrix,
  createRadioGroupShowcase,
  createRadioGroupSizeMatrix,
  createRadioGroupTestData,
  createRadioGroupVariantMatrix,
  createRadioItemStateMatrix,
  RADIO_GROUP_ORIENTATIONS,
  RADIO_GROUP_SIZES,
  RADIO_GROUP_VARIANTS,
  RADIO_ITEM_STATES,
} from '@/.storybook/stories/_factories/radio-group.factory';
import {
  radioGroupHandlers,
  radioGroupStatusHandlers,
} from '@/.storybook/stories/_handlers/radio-group.handlers';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function RadioGroupDemo() {
  const { t } = useTranslation();
  const [value, setValue] = React.useState('default');

  return (
    <RadioGroup
      aria-label={t('radioGroup.ariaLabel')}
      data-radio-group
      data-testid="radio-group-demo"
      onValueChange={setValue}
      value={value}
    >
      <div className="flex items-center gap-2">
        <RadioGroupItem data-radio-option="default" id="r1" value="default" />
        <Label data-radio-label="default" htmlFor="r1">
          {t('radioGroup.option.default')}
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem data-radio-option="comfortable" id="r2" value="comfortable" />
        <Label data-radio-label="comfortable" htmlFor="r2">
          {t('radioGroup.option.comfortable')}
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem data-radio-option="disabled" disabled id="r3" value="disabled" />
        <Label data-radio-label="disabled" htmlFor="r3">
          {t('radioGroup.option.disabled')}
        </Label>
      </div>
    </RadioGroup>
  );
}

const meta = {
  title: 'Components/UI/Radio Group',
  component: RadioGroupDemo,
  tags: ['autodocs'],
  args: {
    onValueChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
  },
  parameters: {
    msw: { handlers: radioGroupHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // ─────────────────────────────────────────────────────────────────────────
    // CONTENT CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    value: {
      control: 'text',
      description: i18n.t(
        'radioGroup.argType.controlledSelectedValue',
        'Controlled selected value'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    defaultValue: {
      control: 'text',
      description: i18n.t(
        'radioGroup.argType.initialValueForUncontrolledUsage',
        'Initial value for uncontrolled usage'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    name: {
      control: 'text',
      description: i18n.t(
        'radioGroup.argType.nameAttributeForFormSubmission',
        'Name attribute for form submission'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // APPEARANCE CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: i18n.t(
        'radioGroup.argType.layoutOrientationOfRadioItems',
        'Layout orientation of radio items'
      ),
      table: {
        category: 'Appearance',
        type: { summary: "'horizontal' | 'vertical'" },
        defaultValue: { summary: "'vertical'" },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STATE CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'radioGroup.argType.whetherAllRadioItemsAreDisabled',
        'Whether all radio items are disabled'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    required: {
      control: 'boolean',
      description: i18n.t(
        'radioGroup.argType.whetherSelectionIsRequired',
        'Whether selection is required'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LAYOUT CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    className: {
      control: 'text',
      description: i18n.t(
        'radioGroup.argType.additionalCssClassesForLayoutCustomization',
        'Additional CSS classes for layout customization'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'string' },
      },
    },
    loop: {
      control: 'boolean',
      description: i18n.t(
        'radioGroup.argType.whetherKeyboardNavigationLoopsAround',
        'Whether keyboard navigation loops around'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    dir: {
      control: 'select',
      options: ['ltr', 'rtl'],
      description: i18n.t(
        'radioGroup.argType.readingDirectionForKeyboardNavigation',
        'Reading direction for keyboard navigation'
      ),
      table: {
        category: 'Layout',
        type: { summary: "'ltr' | 'rtl'" },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT HANDLERS
    // ─────────────────────────────────────────────────────────────────────────
    onClick: {
      action: 'onClick',
      description: i18n.t('radioGroup.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('radioGroup.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('radioGroup.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('radioGroup.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('radioGroup.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('radioGroup.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('radioGroup.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onValueChange: {
      action: 'onValueChange',
      description: i18n.t(
        'radioGroup.argType.calledWhenSelectedValueChanges',
        'Called when selected value changes'
      ),
      table: { category: 'Events' },
    },
    // Note: argTypes for demo wrapper - actual RadioGroup component props documented below
    // RadioGroup Props Reference:
    // - value: Controlled selected value (string)
    // - defaultValue: Initial value for uncontrolled usage (string)
    // - onValueChange: Called when value changes ((value: string) => void)
    // - disabled: Whether all items are disabled (boolean)
    // - required: Whether selection is required (boolean)
    // - orientation: Layout orientation ('horizontal' | 'vertical')
    // - dir: Reading direction ('ltr' | 'rtl')
    // - loop: Whether keyboard navigation loops (boolean, default: true)
    // - name: Name attribute for form submission (string)
    // - className: Additional CSS classes (string)
    // - aria-label: Accessible label for screen readers (string)
    // - aria-labelledby: ID of element labeling the group (string)
    //
    // RadioGroupItem Props Reference:
    // - value: Value of the radio item (string, required)
    // - disabled: Whether this item is disabled (boolean)
    // - required: Whether this item is required (boolean)
    // - id: Unique identifier for the item (string)
    // - className: Additional CSS classes (string)
  },
} satisfies Meta<typeof RadioGroupDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    const group = canvasElement.querySelector('[data-radio-group]');
    if (!(group instanceof HTMLElement)) {
      throw new Error('Radio group root was not found.');
    }

    expect(group.getAttribute('data-slot')).toBe('radio-group');
    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')?.trim()).not.toBe('');

    const radios = canvasElement.querySelectorAll('[data-slot="radio-group-item"]');
    expect(radios.length).toBe(3);

    const getChecked = (radio: HTMLElement) => {
      const dataState = radio.getAttribute('data-state');
      if (dataState === 'checked') return true;
      if (dataState === 'unchecked') return false;

      const ariaChecked = radio.getAttribute('aria-checked');
      if (ariaChecked === 'true') return true;
      if (ariaChecked === 'false') return false;

      throw new Error('Radio item did not expose a checked state.');
    };

    const defaultRadio = canvasElement.querySelector('[data-radio-option="default"]');
    const comfortableRadio = canvasElement.querySelector('[data-radio-option="comfortable"]');
    const disabledRadio = canvasElement.querySelector('[data-radio-option="disabled"]');

    if (!(defaultRadio instanceof HTMLButtonElement)) {
      throw new Error('Default radio item was not found.');
    }

    if (!(comfortableRadio instanceof HTMLButtonElement)) {
      throw new Error('Comfortable radio item was not found.');
    }

    if (!(disabledRadio instanceof HTMLButtonElement)) {
      throw new Error('Disabled radio item was not found.');
    }

    const comfortableLabel = canvasElement.querySelector('[data-radio-label="comfortable"]');
    if (!(comfortableLabel instanceof HTMLLabelElement)) {
      throw new Error('Comfortable label was not found.');
    }
    expect(comfortableLabel.textContent?.trim()).not.toBe('');

    const disabledLabel = canvasElement.querySelector('[data-radio-label="disabled"]');
    if (!(disabledLabel instanceof HTMLLabelElement)) {
      throw new Error('Disabled label was not found.');
    }
    expect(disabledLabel.textContent?.trim()).not.toBe('');

    expect(defaultRadio.getAttribute('data-slot')).toBe('radio-group-item');
    expect(comfortableRadio.getAttribute('data-slot')).toBe('radio-group-item');
    expect(disabledRadio.getAttribute('data-slot')).toBe('radio-group-item');

    expect(defaultRadio).not.toBeDisabled();
    expect(comfortableRadio).not.toBeDisabled();
    expect(disabledRadio).toBeDisabled();

    expect(getChecked(defaultRadio)).toBe(true);
    expect(getChecked(comfortableRadio)).toBe(false);
    expect(getChecked(disabledRadio)).toBe(false);

    await userEvent.click(comfortableLabel);
    expect(doc.activeElement).toBe(comfortableRadio);

    expect(getChecked(defaultRadio)).toBe(false);
    expect(getChecked(comfortableRadio)).toBe(true);

    await userEvent.click(disabledLabel);

    expect(getChecked(comfortableRadio)).toBe(true);
    expect(getChecked(disabledRadio)).toBe(false);
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-radio-group]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('role')).toBe('radiogroup');
  },
};

function VariantsDemo() {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.variants.vertical')}</p>
        <RadioGroup defaultValue="option-1">
          <div className="flex items-center gap-2">
            <RadioGroupItem id="v1" value="option-1" />
            <Label htmlFor="v1">Option 1</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="v2" value="option-2" />
            <Label htmlFor="v2">Option 2</Label>
          </div>
        </RadioGroup>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.variants.horizontal')}</p>
        <RadioGroup defaultValue="h1" className="flex gap-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem id="h1" value="h1" />
            <Label htmlFor="h1">{i18n.t('radioGroup.story.optionA', 'Option A')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="h2" value="h2" />
            <Label htmlFor="h2">{i18n.t('radioGroup.story.optionB', 'Option B')}</Label>
          </div>
        </RadioGroup>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.variants.withDisabled')}</p>
        <RadioGroup defaultValue="d1">
          <div className="flex items-center gap-2">
            <RadioGroupItem id="d1" value="d1" />
            <Label htmlFor="d1">{i18n.t('radioGroup.story.enabled', 'Enabled')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="d2" value="d2" disabled />
            <Label htmlFor="d2" className="text-muted-foreground">
              Disabled
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBeGreaterThan(0);
  },
};

function SizesDemo() {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.sizes.compact')}</p>
        <RadioGroup defaultValue="sm1" className="text-sm">
          <div className="flex items-center gap-1.5">
            <RadioGroupItem id="sm1" value="sm1" className="h-3.5 w-3.5" />
            <Label htmlFor="sm1" className="text-sm">
              Small
            </Label>
          </div>
        </RadioGroup>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.sizes.default')}</p>
        <RadioGroup defaultValue="md1">
          <div className="flex items-center gap-2">
            <RadioGroupItem id="md1" value="md1" />
            <Label htmlFor="md1">{i18n.t('radioGroup.story.default', 'Default')}</Label>
          </div>
        </RadioGroup>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.sizes.large')}</p>
        <RadioGroup defaultValue="lg1" className="text-lg">
          <div className="flex items-center gap-3">
            <RadioGroupItem id="lg1" value="lg1" className="h-5 w-5" />
            <Label htmlFor="lg1" className="text-lg">
              Large
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBeGreaterThan(0);
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-radio-group]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('role')).toBe('radiogroup');
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-radio-group]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('role')).toBe('radiogroup');
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const group = context.canvasElement.querySelector('[data-radio-group]');
    if (!(group instanceof HTMLElement)) {
      throw new Error('Radio group root was not found.');
    }
    expect(group.getAttribute('aria-label')).toBe('ラジオオプション');

    const defaultLabel = context.canvasElement.querySelector('[data-radio-label="default"]');
    if (!(defaultLabel instanceof HTMLLabelElement)) {
      throw new Error('Default label was not found.');
    }
    expect(defaultLabel.textContent?.trim()).toBe('デフォルト');

    const comfortableLabel = context.canvasElement.querySelector(
      '[data-radio-label="comfortable"]'
    );
    if (!(comfortableLabel instanceof HTMLLabelElement)) {
      throw new Error('Comfortable label was not found.');
    }
    expect(comfortableLabel.textContent?.trim()).toBe('快適');

    const disabledLabel = context.canvasElement.querySelector('[data-radio-label="disabled"]');
    if (!(disabledLabel instanceof HTMLLabelElement)) {
      throw new Error('Disabled label was not found.');
    }
    expect(disabledLabel.textContent?.trim()).toBe('無効');

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
  name: i18n.t('radioGroup.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

export const Accessibility: Story = {
  name: i18n.t('radioGroup.storyName.accessibility', 'Accessibility'),
  render: () => (
    <RadioGroup
      aria-label={i18n.t('radioGroup.story.selectYourPreference', 'Select your preference')}
      defaultValue="option-1"
      data-testid="a11y-radio-group"
    >
      <div className="flex items-center gap-2">
        <RadioGroupItem id="a11y-r1" value="option-1" />
        <Label htmlFor="a11y-r1">Option 1</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem id="a11y-r2" value="option-2" />
        <Label htmlFor="a11y-r2">Option 2</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem id="a11y-r3" value="option-3" disabled />
        <Label htmlFor="a11y-r3" className="text-muted-foreground">
          Option 3 (disabled)
        </Label>
      </div>
    </RadioGroup>
  ),
  play: async ({ canvasElement }) => {
    const radioGroup = canvasElement.querySelector(
      '[data-testid="a11y-radio-group"]'
    ) as HTMLElement;
    const radio1 = canvasElement.querySelector('#a11y-r1') as HTMLElement;
    const radio2 = canvasElement.querySelector('#a11y-r2') as HTMLElement;
    const radio3 = canvasElement.querySelector('#a11y-r3') as HTMLElement;

    // Verify radiogroup role
    expect(radioGroup.getAttribute('role')).toBe('radiogroup');
    expect(radioGroup.getAttribute('aria-label')).toBe('Select your preference');

    // Verify radio items have proper role
    expect(radio1.getAttribute('role')).toBe('radio');
    expect(radio2.getAttribute('role')).toBe('radio');
    expect(radio3.getAttribute('role')).toBe('radio');

    // Verify initial checked state
    expect(radio1.getAttribute('data-state')).toBe('checked');
    expect(radio2.getAttribute('data-state')).toBe('unchecked');

    // Verify disabled state
    expect(radio3).toBeDisabled();

    // Test keyboard navigation - Tab to focus
    await userEvent.tab();
    expect(radio1).toHaveFocus();

    // Arrow down to next option
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(radio2).toHaveFocus();
      expect(radio2.getAttribute('data-state')).toBe('checked');
    });

    // Arrow down should skip disabled and wrap
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(radio1).toHaveFocus();
      expect(radio1.getAttribute('data-state')).toBe('checked');
    });
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: radioGroupHandlers },
  },
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-radio-group]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('role')).toBe('radiogroup');
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: radioGroupStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-radio-group]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('role')).toBe('radiogroup');
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: radioGroupStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-radio-group]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('role')).toBe('radiogroup');
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: radioGroupStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-radio-group]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('role')).toBe('radiogroup');
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: radioGroupStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-radio-group]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('role')).toBe('radiogroup');
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: radioGroupStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-radio-group]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('role')).toBe('radiogroup');
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: radioGroupStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-radio-group]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('role')).toBe('radiogroup');
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: radioGroupStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-radio-group]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('role')).toBe('radiogroup');
  },
};

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: radioGroupStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-radio-group]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('role')).toBe('radiogroup');
  },
};

export const Error409Conflict: Story = {
  ...Default,
  parameters: {
    msw: { handlers: radioGroupStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-radio-group]');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('role')).toBe('radiogroup');
  },
};

// ============ FAKER DATA STORIES ============

function FakerRadioGroupDemo() {
  const fakeGroup = createFakeRadioGroup({ items: undefined, orientation: 'vertical' });
  const { items } = fakeGroup;
  const [value, setValue] = React.useState(items[0]?.value ?? '');

  return (
    <RadioGroup value={value} onValueChange={setValue} data-testid="faker-radio-group-demo">
      {items.map((item) => (
        <div key={item.id} className="flex items-start space-x-2">
          <RadioGroupItem id={item.id} value={item.value} disabled={item.disabled} />
          <div className="grid gap-1 leading-none">
            <Label htmlFor={item.id} className={item.disabled ? 'text-muted-foreground' : ''}>
              {item.label}
            </Label>
            {item.description && (
              <p className="text-muted-foreground text-sm">{item.description}</p>
            )}
          </div>
        </div>
      ))}
    </RadioGroup>
  );
}

export const WithFakerData: Story = {
  render: () => <FakerRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const radioGroup = canvasElement.querySelector('[data-testid="faker-radio-group-demo"]');
    expect(radioGroup).toBeInTheDocument();
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBeGreaterThan(0);
  },
};

// ============ ASYNC SELECTION STORIES ============

interface FakeRadioOption {
  description?: string;
  disabled?: boolean;
  id: string;
  label: string;
  value: string;
}

interface AsyncRadioState {
  data: FakeRadioOption[];
  error: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
}

function AsyncRadioGroupDemo() {
  const [state, setState] = React.useState<AsyncRadioState>({
    status: 'idle',
    data: [],
    error: null,
  });
  const [selectedValue, setSelectedValue] = React.useState('');
  const [submitStatus, setSubmitStatus] = React.useState<
    'idle' | 'submitting' | 'submitted' | 'error'
  >('idle');

  const fetchOptions = React.useCallback(async () => {
    setState({ status: 'loading', data: [], error: null });

    try {
      // Simulated API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const options: FakeRadioOption[] = [
        {
          id: 'async-radio-0',
          value: 'async-001',
          label: 'Standard Shipping',
          description: 'Delivery in 5-7 business days',
          disabled: false,
        },
        {
          id: 'async-radio-1',
          value: 'async-002',
          label: 'Express Shipping',
          description: 'Delivery in 2-3 business days',
          disabled: false,
        },
        {
          id: 'async-radio-2',
          value: 'async-003',
          label: 'Overnight Shipping',
          description: 'Next day delivery guaranteed',
          disabled: false,
        },
        {
          id: 'async-radio-3',
          value: 'async-004',
          label: 'Store Pickup',
          description: 'Available within 1 hour',
          disabled: false,
        },
      ];
      setState({ status: 'success', data: options, error: null });
      setSelectedValue(options[0]?.value ?? '');
    } catch {
      setState({ status: 'error', data: [], error: 'Failed to load options' });
    }
  }, []);

  React.useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  const handleSubmit = async () => {
    setSubmitStatus('submitting');

    try {
      const response = await fetch('/api/form/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selection: selectedValue }),
      });

      if (!response.ok) {
        throw new Error('Submission failed');
      }

      setSubmitStatus('submitted');
    } catch {
      setSubmitStatus('error');
    }
  };

  if (state.status === 'loading') {
    return (
      <div className="space-y-3" data-testid="radio-loading" data-state="loading">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`skeleton-${String(i)}`} className="flex items-center space-x-2">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
        <p className="text-muted-foreground text-sm">
          {i18n.t('radioGroup.story.loadingOptions', 'Loading options...')}
        </p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="space-y-2" data-testid="radio-error" data-state="error">
        <p className="text-destructive text-sm">{state.error}</p>
        <button className="text-sm underline" onClick={() => void fetchOptions()}>
          Retry
        </button>
      </div>
    );
  }

  if (state.data.length === 0) {
    return (
      <div data-testid="radio-empty" data-state="empty">
        <p className="text-muted-foreground text-sm">
          {i18n.t('radioGroup.story.noOptionsAvailable', 'No options available.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="async-radio-group-demo" data-state="success">
      <RadioGroup
        value={selectedValue}
        onValueChange={setSelectedValue}
        disabled={submitStatus === 'submitting'}
      >
        {state.data.map((option) => (
          <div key={option.id} className="flex items-start space-x-2">
            <RadioGroupItem id={option.id} value={option.value} disabled={option.disabled} />
            <div className="grid gap-1 leading-none">
              <Label htmlFor={option.id}>{option.label}</Label>
              {option.description && (
                <p className="text-muted-foreground text-sm">{option.description}</p>
              )}
            </div>
          </div>
        ))}
      </RadioGroup>

      <div className="flex items-center gap-2">
        <button
          className="bg-primary text-primary-foreground rounded px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={() => void handleSubmit()}
          disabled={submitStatus === 'submitting'}
          data-testid="submit-selection"
        >
          {submitStatus === 'submitting' && (
            <LoaderIcon className="mr-1 inline size-3 animate-spin" />
          )}
          Submit Selection
        </button>
        {submitStatus === 'submitted' && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircleIcon className="size-4" />
            Submitted
          </span>
        )}
        {submitStatus === 'error' && (
          <span className="flex items-center gap-1 text-sm text-red-600">
            <XCircleIcon className="size-4" />
            Failed
          </span>
        )}
      </div>
    </div>
  );
}

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: radioGroupHandlers },
  },
  render: () => <AsyncRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    // Wait for loading to appear
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-testid="radio-loading"]')).toBeInTheDocument();
    });

    // Wait for success
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="async-radio-group-demo"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify radios are present
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(4);
  },
};

export const EmptyData: Story = {
  render: () => (
    <div data-testid="radio-empty">
      <RadioGroup disabled>
        <p className="text-muted-foreground text-sm">
          {i18n.t('radioGroup.story.noOptionsAvailableToSelect', 'No options available to select.')}
        </p>
      </RadioGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const emptyContainer = canvasElement.querySelector('[data-testid="radio-empty"]');
    expect(emptyContainer).toBeInTheDocument();
  },
};

function SlowAsyncRadioDemo() {
  const [state, setState] = React.useState<AsyncRadioState>({
    status: 'loading',
    data: [],
    error: null,
  });
  const [value, setValue] = React.useState('');

  React.useEffect(() => {
    const loadOptions = async () => {
      // Simulate slow response (5 seconds)
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const options: FakeRadioOption[] = [
        {
          id: 'slow-radio-0',
          value: 'slow-001',
          label: 'Basic Plan',
          disabled: false,
        },
        {
          id: 'slow-radio-1',
          value: 'slow-002',
          label: 'Professional Plan',
          disabled: false,
        },
        {
          id: 'slow-radio-2',
          value: 'slow-003',
          label: 'Enterprise Plan',
          disabled: false,
        },
      ];
      setState({ status: 'success', data: options, error: null });
      setValue(options[0]?.value ?? '');
    };
    void loadOptions();
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="space-y-3" data-testid="radio-slow-loading" data-state="loading">
        <div className="flex items-center gap-2">
          <LoaderIcon className="size-4 animate-spin" />
          <span className="text-muted-foreground text-sm">
            {i18n.t('radioGroup.story.loadingOptionsSlow', 'Loading options (slow)...')}
          </span>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`skeleton-${String(i)}`} className="flex items-center space-x-2">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div data-testid="slow-async-radio-demo" data-state="success">
      <RadioGroup value={value} onValueChange={setValue}>
        {state.data.map((option) => (
          <div key={option.id} className="flex items-center space-x-2">
            <RadioGroupItem id={option.id} value={option.value} />
            <Label htmlFor={option.id}>{option.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export const SlowResponse: Story = {
  name: i18n.t('radioGroup.storyName.slowResponse', 'Slow Response (5s)'),
  render: () => <SlowAsyncRadioDemo />,
  play: async ({ canvasElement }) => {
    // Should start loading
    expect(canvasElement.querySelector('[data-testid="radio-slow-loading"]')).toBeInTheDocument();

    // Wait for success (after 5+ seconds)
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="slow-async-radio-demo"]')
        ).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

// ============ GROUP INTERACTION STORIES ============

function DependentRadioGroups() {
  const [category, setCategory] = React.useState('electronics');
  const [product, setProduct] = React.useState('');

  const productOptions: Record<string, FakeRadioOption[]> = {
    electronics: [
      { id: 'laptop', value: 'laptop', label: 'Laptop', disabled: false },
      { id: 'phone', value: 'phone', label: 'Smartphone', disabled: false },
      { id: 'tablet', value: 'tablet', label: 'Tablet', disabled: false },
    ],
    clothing: [
      { id: 'shirt', value: 'shirt', label: 'Shirt', disabled: false },
      { id: 'pants', value: 'pants', label: 'Pants', disabled: false },
      { id: 'shoes', value: 'shoes', label: 'Shoes', disabled: true },
    ],
    home: [
      { id: 'furniture', value: 'furniture', label: 'Furniture', disabled: false },
      { id: 'decor', value: 'decor', label: 'Decor', disabled: false },
    ],
  };

  React.useEffect(() => {
    // Reset product when category changes
    setProduct('');
  }, [category]);

  return (
    <div className="space-y-6" data-testid="dependent-radio-groups">
      <div className="space-y-3">
        <p className="text-sm font-medium">
          {i18n.t('radioGroup.story.selectCategory', 'Select Category')}
        </p>
        <RadioGroup
          value={category}
          onValueChange={setCategory}
          className="flex gap-4"
          data-testid="category-radio-group"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem id="electronics" value="electronics" />
            <Label htmlFor="electronics">
              {i18n.t('radioGroup.story.electronics', 'Electronics')}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem id="clothing" value="clothing" />
            <Label htmlFor="clothing">{i18n.t('radioGroup.story.clothing', 'Clothing')}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem id="home" value="home" />
            <Label htmlFor="home">{i18n.t('radioGroup.story.home', 'Home')}</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">
          {i18n.t('radioGroup.story.selectProduct', 'Select Product')}
        </p>
        <RadioGroup value={product} onValueChange={setProduct} data-testid="product-radio-group">
          {productOptions[category]?.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <RadioGroupItem id={option.id} value={option.value} disabled={option.disabled} />
              <Label htmlFor={option.id} className={option.disabled ? 'text-muted-foreground' : ''}>
                {option.label}
                {option.disabled && ' (Out of stock)'}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {product && (
        <p className="text-sm" data-testid="selection-summary">
          Selected: <strong>{category}</strong> &rarr; <strong>{product}</strong>
        </p>
      )}
    </div>
  );
}

export const GroupInteraction: Story = {
  name: i18n.t('radioGroup.storyName.groupInteraction', 'Dependent Radio Groups'),
  render: () => <DependentRadioGroups />,
  play: async ({ canvasElement }) => {
    // Initial state: electronics category
    const electronicsRadio = canvasElement.querySelector('#electronics') as HTMLElement;
    expect(electronicsRadio.getAttribute('data-state')).toBe('checked');

    // Should show electronics products
    expect(canvasElement.querySelector('#laptop')).toBeInTheDocument();

    // Select a product
    const laptopRadio = canvasElement.querySelector('#laptop') as HTMLElement;
    await userEvent.click(laptopRadio);

    // Verify selection summary appears
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-testid="selection-summary"]')).toBeInTheDocument();
    });

    // Switch category to clothing
    const clothingRadio = canvasElement.querySelector('#clothing') as HTMLElement;
    await userEvent.click(clothingRadio);

    // Product selection should be reset and new products shown
    await waitFor(() => {
      expect(canvasElement.querySelector('#shirt')).toBeInTheDocument();
      expect(canvasElement.querySelector('#laptop')).not.toBeInTheDocument();
    });
  },
};

// ============ HTTP 5xx ERROR STORIES ============

export const Error502BadGateway: Story = {
  name: i18n.t('radioGroup.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: radioGroupStatusHandlers.badGateway },
  },
  render: () => <AsyncRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const errorElement = canvasElement.querySelector('[data-testid="radio-error"]');
      expect(errorElement).toBeInTheDocument();
    });
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('radioGroup.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: radioGroupStatusHandlers.serviceUnavailable },
  },
  render: () => <AsyncRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const errorElement = canvasElement.querySelector('[data-testid="radio-error"]');
      expect(errorElement).toBeInTheDocument();
    });
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('radioGroup.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: radioGroupStatusHandlers.gatewayTimeout },
  },
  render: () => <AsyncRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const errorElement = canvasElement.querySelector('[data-testid="radio-error"]');
      expect(errorElement).toBeInTheDocument();
    });
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('radioGroup.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: radioGroupStatusHandlers.tooManyRequests },
  },
  render: () => <AsyncRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const errorElement = canvasElement.querySelector('[data-testid="radio-error"]');
      expect(errorElement).toBeInTheDocument();
    });
  },
};

// ============ FACTORY-WIRED STORIES ============

// --- Single Item Factory ---

function FakeRadioItemDemo() {
  const item: FakeRadioItem = createFakeRadioItem({ label: 'Factory Item', value: 'factory-item' });
  const [value, setValue] = React.useState(item.value);

  return (
    <div data-testid="fake-radio-item-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.states')}</p>
      <RadioGroup value={value} onValueChange={setValue}>
        <div className="flex items-center gap-2">
          <RadioGroupItem id={item.id} value={item.value} disabled={item.disabled} />
          <Label htmlFor={item.id}>{item.label}</Label>
        </div>
      </RadioGroup>
    </div>
  );
}

export const SingleFakeItem: Story = {
  name: i18n.t('radioGroup.storyName.singleFakeItem', 'Factory: Single Radio Item'),
  render: () => <FakeRadioItemDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-radio-item-demo"]');
    expect(container).toBeInTheDocument();
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(1);
  },
};

// --- Multiple Items Factory ---

function FakeRadioItemsDemo() {
  const items: FakeRadioItem[] = createFakeRadioItems(4);
  const [value, setValue] = React.useState(items[0]?.value ?? '');

  return (
    <div data-testid="fake-radio-items-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.variants')}</p>
      <RadioGroup value={value} onValueChange={setValue}>
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <RadioGroupItem id={item.id} value={item.value} disabled={item.disabled} />
            <Label htmlFor={item.id}>{item.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export const MultipleFakeItems: Story = {
  name: i18n.t('radioGroup.storyName.multipleFakeItems', 'Factory: Multiple Radio Items'),
  render: () => <FakeRadioItemsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-radio-items-demo"]');
    expect(container).toBeInTheDocument();
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(4);
  },
};

// --- Items From Set Factory ---

function FakeRadioItemsFromSetDemo() {
  const items: FakeRadioItem[] = createFakeRadioItemsFromSet('priority');
  const [value, setValue] = React.useState(items[0]?.value ?? '');

  return (
    <div data-testid="fake-radio-items-from-set-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.variants')}</p>
      <RadioGroup value={value} onValueChange={setValue}>
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <RadioGroupItem id={item.id} value={item.value} disabled={item.disabled} />
            <Label htmlFor={item.id}>{item.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export const ItemsFromSet: Story = {
  name: i18n.t('radioGroup.storyName.itemsFromSet', 'Factory: Items From Predefined Set'),
  render: () => <FakeRadioItemsFromSetDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-radio-items-from-set-demo"]');
    expect(container).toBeInTheDocument();
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(4); // priority set has 4 items
    const labels = canvasElement.querySelectorAll('label');
    const labelTexts = [...labels].map((l) => l.textContent?.trim());
    expect(labelTexts).toContain('Low');
    expect(labelTexts).toContain('Critical');
  },
};

// --- Card Item Factory ---

function FakeRadioCardItemDemo() {
  const cardItem: FakeRadioCardItem = createFakeRadioCardItem({
    label: 'Card Item',
    value: 'card-item',
    subtitle: 'Premium feature',
    price: '$9.99',
  });
  const [value, setValue] = React.useState(cardItem.value);

  return (
    <div data-testid="fake-radio-card-item-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.variants')}</p>
      <RadioGroup value={value} onValueChange={setValue}>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem id={cardItem.id} value={cardItem.value} />
            <div>
              <Label htmlFor={cardItem.id}>{cardItem.label}</Label>
              {cardItem.subtitle && (
                <p className="text-muted-foreground text-xs">{cardItem.subtitle}</p>
              )}
              {cardItem.price && (
                <p className="text-sm font-semibold" data-testid="card-price">
                  {cardItem.price}
                </p>
              )}
            </div>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}

export const CardItem: Story = {
  name: i18n.t('radioGroup.storyName.cardItem', 'Factory: Card Radio Item'),
  render: () => <FakeRadioCardItemDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-radio-card-item-demo"]');
    expect(container).toBeInTheDocument();
    const price = canvasElement.querySelector('[data-testid="card-price"]');
    expect(price).toBeInTheDocument();
    expect(price?.textContent).toBe('$9.99');
  },
};

// --- Multiple Groups Factory ---

function FakeRadioGroupsDemo() {
  const groups: FakeRadioGroup[] = createFakeRadioGroups(3);

  return (
    <div className="space-y-6" data-testid="fake-radio-groups-demo">
      <p className="text-sm font-medium">{i18n.t('radioGroup.section.layouts')}</p>
      {groups.map((group) => (
        <div key={group.id} className="space-y-2">
          <p className="text-sm font-medium">{group.label}</p>
          <RadioGroup defaultValue={group.defaultValue} disabled={group.isDisabled}>
            {group.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <RadioGroupItem id={item.id} value={item.value} disabled={item.disabled} />
                <Label htmlFor={item.id}>{item.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      ))}
    </div>
  );
}

export const MultipleGroups: Story = {
  name: i18n.t('radioGroup.storyName.multipleGroups', 'Factory: Multiple Radio Groups'),
  render: () => <FakeRadioGroupsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-radio-groups-demo"]');
    expect(container).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[role="radiogroup"]');
    expect(groups.length).toBe(3);
  },
};

// --- Card Group Factory ---

function FakeRadioCardGroupDemo() {
  const cardGroup: FakeRadioCardGroup = createFakeRadioCardGroup({
    label: 'Select a plan',
  });
  const [value, setValue] = React.useState(cardGroup.items[0]?.value ?? '');

  return (
    <div data-testid="fake-radio-card-group-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.variants')}</p>
      <p className="mb-2 text-sm">{cardGroup.label}</p>
      <RadioGroup value={value} onValueChange={setValue}>
        <div className="grid gap-3">
          {cardGroup.items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <RadioGroupItem id={item.id} value={item.value} />
                <div>
                  <Label htmlFor={item.id}>{item.label}</Label>
                  {item.subtitle && (
                    <p className="text-muted-foreground text-xs">{item.subtitle}</p>
                  )}
                  {item.price && <p className="text-xs font-semibold">{item.price}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </RadioGroup>
    </div>
  );
}

export const CardGroup: Story = {
  name: i18n.t('radioGroup.storyName.cardGroup', 'Factory: Card Radio Group'),
  render: () => <FakeRadioCardGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-radio-card-group-demo"]');
    expect(container).toBeInTheDocument();
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBeGreaterThanOrEqual(3);
  },
};

// --- Yes/No Factory ---

function FakeYesNoRadioGroupDemo() {
  const group: FakeRadioGroup = createFakeYesNoRadioGroup();
  const [value, setValue] = React.useState(group.items[0]?.value ?? '');

  return (
    <div data-testid="fake-yes-no-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.variants')}</p>
      <p className="mb-2 text-sm">{group.label}</p>
      <RadioGroup value={value} onValueChange={setValue} className="flex gap-4">
        {group.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <RadioGroupItem id={item.id} value={item.value} />
            <Label htmlFor={item.id}>{item.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export const YesNoGroup: Story = {
  name: i18n.t('radioGroup.storyName.yesNoGroup', 'Factory: Yes/No Radio Group'),
  render: () => <FakeYesNoRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-yes-no-demo"]');
    expect(container).toBeInTheDocument();
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(2);
    const labels = canvasElement.querySelectorAll('label');
    const labelTexts = [...labels].map((l) => l.textContent?.trim());
    expect(labelTexts).toContain('Yes');
    expect(labelTexts).toContain('No');
  },
};

// --- Priority Factory ---

function FakePriorityRadioGroupDemo() {
  const group: FakeRadioGroup = createFakePriorityRadioGroup();
  const [value, setValue] = React.useState(group.items[0]?.value ?? '');

  return (
    <div data-testid="fake-priority-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.states')}</p>
      <p className="mb-2 text-sm">{group.label}</p>
      <RadioGroup value={value} onValueChange={setValue}>
        {group.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <RadioGroupItem id={item.id} value={item.value} />
            <Label htmlFor={item.id}>{item.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export const PriorityGroup: Story = {
  name: i18n.t('radioGroup.storyName.priorityGroup', 'Factory: Priority Radio Group'),
  render: () => <FakePriorityRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-priority-demo"]');
    expect(container).toBeInTheDocument();
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(4);
    const labels = canvasElement.querySelectorAll('label');
    const labelTexts = [...labels].map((l) => l.textContent?.trim());
    expect(labelTexts).toContain('Low');
    expect(labelTexts).toContain('High');
  },
};

// --- Size Selection Factory ---

function FakeSizeRadioGroupDemo() {
  const group: FakeRadioGroup = createFakeSizeRadioGroup();
  const [value, setValue] = React.useState(group.items[0]?.value ?? '');

  return (
    <div data-testid="fake-size-selection-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.sizes')}</p>
      <p className="mb-2 text-sm">{group.label}</p>
      <RadioGroup value={value} onValueChange={setValue} className="flex gap-4">
        {group.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <RadioGroupItem id={item.id} value={item.value} />
            <Label htmlFor={item.id}>{item.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export const SizeSelectionGroup: Story = {
  name: i18n.t('radioGroup.storyName.sizeSelectionGroup', 'Factory: Size Selection Radio Group'),
  render: () => <FakeSizeRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-size-selection-demo"]');
    expect(container).toBeInTheDocument();
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(4);
    const labels = canvasElement.querySelectorAll('label');
    const labelTexts = [...labels].map((l) => l.textContent?.trim());
    expect(labelTexts).toContain('Small');
    expect(labelTexts).toContain('Extra Large');
  },
};

// --- Rating Factory ---

function FakeRatingRadioGroupDemo() {
  const group: FakeRadioGroup = createFakeRatingRadioGroup();
  const [value, setValue] = React.useState(group.items[0]?.value ?? '');

  return (
    <div data-testid="fake-rating-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.variants')}</p>
      <p className="mb-2 text-sm">{group.label}</p>
      <RadioGroup value={value} onValueChange={setValue} className="flex gap-4">
        {group.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <RadioGroupItem id={item.id} value={item.value} />
            <Label htmlFor={item.id}>{item.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export const RatingGroup: Story = {
  name: i18n.t('radioGroup.storyName.ratingGroup', 'Factory: Rating Radio Group'),
  render: () => <FakeRatingRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-rating-demo"]');
    expect(container).toBeInTheDocument();
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(5);
    const labels = canvasElement.querySelectorAll('label');
    const labelTexts = [...labels].map((l) => l.textContent?.trim());
    expect(labelTexts).toContain('Poor');
    expect(labelTexts).toContain('Excellent');
  },
};

// --- Delivery Factory ---

function FakeDeliveryRadioGroupDemo() {
  const group: FakeRadioGroup = createFakeDeliveryRadioGroup();
  const [value, setValue] = React.useState(group.items[0]?.value ?? '');

  return (
    <div data-testid="fake-delivery-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.variants')}</p>
      <p className="mb-2 text-sm">{group.label}</p>
      <RadioGroup value={value} onValueChange={setValue}>
        {group.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2">
            <RadioGroupItem id={item.id} value={item.value} disabled={item.disabled} />
            <div>
              <Label htmlFor={item.id} className={item.disabled ? 'text-muted-foreground' : ''}>
                {item.label}
              </Label>
              {item.description && (
                <p className="text-muted-foreground text-xs">{item.description}</p>
              )}
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export const DeliveryGroup: Story = {
  name: i18n.t('radioGroup.storyName.deliveryGroup', 'Factory: Delivery Radio Group'),
  render: () => <FakeDeliveryRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-delivery-demo"]');
    expect(container).toBeInTheDocument();
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(4);
    // Last item (Same Day) should be disabled
    const lastRadio = radios[3] as HTMLElement;
    expect(lastRadio).toBeDisabled();
  },
};

// --- Payment Factory ---

function FakePaymentRadioGroupDemo() {
  const group: FakeRadioGroup = createFakePaymentRadioGroup();
  const [value, setValue] = React.useState(group.items[0]?.value ?? '');

  return (
    <div data-testid="fake-payment-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.variants')}</p>
      <p className="mb-2 text-sm">{group.label}</p>
      <RadioGroup value={value} onValueChange={setValue}>
        {group.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <RadioGroupItem id={item.id} value={item.value} />
            <Label htmlFor={item.id}>{item.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export const PaymentGroup: Story = {
  name: i18n.t('radioGroup.storyName.paymentGroup', 'Factory: Payment Radio Group'),
  render: () => <FakePaymentRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-payment-demo"]');
    expect(container).toBeInTheDocument();
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(4);
    const labels = canvasElement.querySelectorAll('label');
    const labelTexts = [...labels].map((l) => l.textContent?.trim());
    expect(labelTexts).toContain('Credit Card');
    expect(labelTexts).toContain('PayPal');
  },
};

// --- Disabled Factory ---

function FakeDisabledRadioGroupDemo() {
  const group: FakeRadioGroup = createFakeDisabledRadioGroup();

  return (
    <div data-testid="fake-disabled-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.disabled')}</p>
      <RadioGroup defaultValue={group.defaultValue} disabled={group.isDisabled}>
        {group.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <RadioGroupItem id={item.id} value={item.value} />
            <Label htmlFor={item.id} className="text-muted-foreground">
              {item.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export const DisabledGroup: Story = {
  name: i18n.t('radioGroup.storyName.disabledGroup', 'Factory: Disabled Radio Group'),
  render: () => <FakeDisabledRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-disabled-demo"]');
    expect(container).toBeInTheDocument();
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBeGreaterThan(0);
    // All radios should be disabled
    for (const radio of radios) {
      expect(radio).toBeDisabled();
    }
  },
};

// --- Error Factory ---

function FakeErrorRadioGroupDemo() {
  const group: FakeRadioGroup = createFakeErrorRadioGroup();

  return (
    <div data-testid="fake-error-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.states')}</p>
      <RadioGroup required={group.isRequired}>
        {group.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <RadioGroupItem id={item.id} value={item.value} />
            <Label htmlFor={item.id}>{item.label}</Label>
          </div>
        ))}
      </RadioGroup>
      {group.errorMessage && (
        <p className="text-destructive mt-1 text-sm" data-testid="error-message">
          {group.errorMessage}
        </p>
      )}
    </div>
  );
}

export const ErrorGroup: Story = {
  name: i18n.t('radioGroup.storyName.errorGroup', 'Factory: Error Radio Group'),
  render: () => <FakeErrorRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-error-demo"]');
    expect(container).toBeInTheDocument();
    const errorMsg = canvasElement.querySelector('[data-testid="error-message"]');
    expect(errorMsg).toBeInTheDocument();
    expect(errorMsg?.textContent).toBe('Please select an option to continue');
  },
};

// --- Descriptive Factory ---

function FakeDescriptiveRadioGroupDemo() {
  const group: FakeRadioGroup = createFakeDescriptiveRadioGroup();
  const [value, setValue] = React.useState(group.items[0]?.value ?? '');

  return (
    <div data-testid="fake-descriptive-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.variants')}</p>
      <p className="mb-2 text-sm">{group.label}</p>
      <RadioGroup value={value} onValueChange={setValue}>
        {group.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2 rounded-lg border p-3">
            <RadioGroupItem id={item.id} value={item.value} className="mt-0.5" />
            <div>
              <Label htmlFor={item.id}>{item.label}</Label>
              {item.description && (
                <p className="text-muted-foreground text-xs">{item.description}</p>
              )}
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export const DescriptiveGroup: Story = {
  name: i18n.t('radioGroup.storyName.descriptiveGroup', 'Factory: Descriptive Radio Group'),
  render: () => <FakeDescriptiveRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fake-descriptive-demo"]');
    expect(container).toBeInTheDocument();
    const radios = canvasElement.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(3);
    const labels = canvasElement.querySelectorAll('label');
    const labelTexts = [...labels].map((l) => l.textContent?.trim());
    expect(labelTexts).toContain('Free Plan');
    expect(labelTexts).toContain('Pro Plan');
    expect(labelTexts).toContain('Enterprise Plan');
  },
};

// --- Orientation Matrix Factory ---

function OrientationMatrixDemo() {
  const orientations: RadioGroupOrientation[] = [...RADIO_GROUP_ORIENTATIONS];
  const matrix: FakeRadioGroup[] = createRadioGroupOrientationMatrix();

  return (
    <div className="space-y-6" data-testid="orientation-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('radioGroup.section.layouts')}</p>
      {matrix.map((group, idx) => (
        <div key={group.id} className="space-y-2">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            {orientations[idx]}
          </p>
          <RadioGroup
            defaultValue={group.defaultValue}
            className={group.orientation === 'horizontal' ? 'flex gap-4' : ''}
          >
            {group.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <RadioGroupItem id={item.id} value={item.value} />
                <Label htmlFor={item.id}>{item.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      ))}
    </div>
  );
}

export const OrientationMatrix: Story = {
  name: i18n.t('radioGroup.storyName.orientationMatrix', 'Factory: Orientation Matrix'),
  render: () => <OrientationMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="orientation-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[role="radiogroup"]');
    expect(groups.length).toBe(RADIO_GROUP_ORIENTATIONS.length);
  },
};

// --- Size Matrix Factory ---

function SizeMatrixDemo() {
  const sizes: RadioGroupSize[] = [...RADIO_GROUP_SIZES];
  const matrix: FakeRadioGroup[] = createRadioGroupSizeMatrix();

  return (
    <div className="space-y-6" data-testid="size-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('radioGroup.section.sizes')}</p>
      {matrix.map((group, idx) => (
        <div key={group.id} className="space-y-2">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">{sizes[idx]}</p>
          <RadioGroup defaultValue={group.defaultValue}>
            {group.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <RadioGroupItem id={item.id} value={item.value} />
                <Label htmlFor={item.id}>{item.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      ))}
    </div>
  );
}

export const SizeMatrix: Story = {
  name: i18n.t('radioGroup.storyName.sizeMatrix', 'Factory: Size Matrix'),
  render: () => <SizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="size-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[role="radiogroup"]');
    expect(groups.length).toBe(RADIO_GROUP_SIZES.length);
  },
};

// --- Variant Matrix Factory ---

function VariantMatrixDemo() {
  const variants: RadioGroupVariant[] = [...RADIO_GROUP_VARIANTS];
  const matrix: FakeRadioGroup[] = createRadioGroupVariantMatrix();

  return (
    <div className="space-y-6" data-testid="variant-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('radioGroup.section.variants')}</p>
      {matrix.map((group, idx) => (
        <div key={group.id} className="space-y-2">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">{variants[idx]}</p>
          <RadioGroup defaultValue={group.defaultValue}>
            {group.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <RadioGroupItem id={item.id} value={item.value} />
                <Label htmlFor={item.id}>{item.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      ))}
    </div>
  );
}

export const VariantMatrix: Story = {
  name: i18n.t('radioGroup.storyName.variantMatrix', 'Factory: Variant Matrix'),
  render: () => <VariantMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="variant-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[role="radiogroup"]');
    expect(groups.length).toBe(RADIO_GROUP_VARIANTS.length);
  },
};

// --- Item State Matrix Factory ---

function ItemStateMatrixDemo() {
  const states: RadioItemState[] = [...RADIO_ITEM_STATES];
  const matrix: FakeRadioItem[] = createRadioItemStateMatrix();

  return (
    <div data-testid="item-state-matrix-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.states')}</p>
      <div className="space-y-3">
        {matrix.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-3">
            <span className="text-muted-foreground w-20 text-xs tracking-wide uppercase">
              {states[idx]}
            </span>
            <RadioGroup defaultValue={item.state === 'checked' ? item.value : undefined}>
              <div className="flex items-center gap-2">
                <RadioGroupItem id={item.id} value={item.value} disabled={item.disabled} />
                <Label htmlFor={item.id} className={item.disabled ? 'text-muted-foreground' : ''}>
                  {item.label}
                </Label>
              </div>
            </RadioGroup>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ItemStateMatrix: Story = {
  name: i18n.t('radioGroup.storyName.itemStateMatrix', 'Factory: Item State Matrix'),
  render: () => <ItemStateMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="item-state-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[role="radiogroup"]');
    expect(groups.length).toBe(RADIO_ITEM_STATES.length);
  },
};

// --- Orientation x Variant Matrix Factory ---

function OrientationVariantMatrixDemo() {
  const matrix: FakeRadioGroup[][] = createRadioGroupOrientationVariantMatrix();

  return (
    <div className="space-y-8" data-testid="orientation-variant-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('radioGroup.section.layouts')}</p>
      {matrix.map((row, rowIdx) => (
        <div key={RADIO_GROUP_ORIENTATIONS[rowIdx]} className="space-y-4">
          <p className="text-xs font-semibold tracking-wide uppercase">
            {RADIO_GROUP_ORIENTATIONS[rowIdx]}
          </p>
          <div className="grid grid-cols-3 gap-4">
            {row.map((group, colIdx) => (
              <div key={group.id} className="space-y-1">
                <p className="text-muted-foreground text-xs">{RADIO_GROUP_VARIANTS[colIdx]}</p>
                <RadioGroup
                  defaultValue={group.defaultValue}
                  className={group.orientation === 'horizontal' ? 'flex gap-3' : ''}
                >
                  {group.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <RadioGroupItem id={item.id} value={item.value} />
                      <Label htmlFor={item.id} className="text-xs">
                        {item.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const OrientationVariantMatrix: Story = {
  name: i18n.t(
    'radioGroup.storyName.orientationVariantMatrix',
    'Factory: Orientation x Variant Matrix'
  ),
  render: () => <OrientationVariantMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector(
      '[data-testid="orientation-variant-matrix-demo"]'
    );
    expect(container).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[role="radiogroup"]');
    expect(groups.length).toBe(RADIO_GROUP_ORIENTATIONS.length * RADIO_GROUP_VARIANTS.length);
  },
};

// --- Showcase Factory ---

function ShowcaseDemo() {
  const showcase = createRadioGroupShowcase();

  return (
    <div className="space-y-8" data-testid="showcase-demo">
      <p className="text-sm font-medium">{i18n.t('radioGroup.story.description')}</p>
      {showcase.map((entry) => (
        <div key={entry.name} className="space-y-2 border-b pb-4">
          <p className="text-sm font-semibold">{entry.name}</p>
          <p className="text-muted-foreground text-xs">{entry.description}</p>
          <RadioGroup
            defaultValue={entry.group.defaultValue}
            disabled={entry.group.isDisabled}
            className={entry.group.orientation === 'horizontal' ? 'flex gap-4' : ''}
          >
            {entry.group.items.map((item) => (
              <div key={item.id} className="flex items-start gap-2">
                <RadioGroupItem id={item.id} value={item.value} disabled={item.disabled} />
                <div>
                  <Label htmlFor={item.id} className={item.disabled ? 'text-muted-foreground' : ''}>
                    {item.label}
                  </Label>
                  {item.description && (
                    <p className="text-muted-foreground text-xs">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>
      ))}
    </div>
  );
}

export const Showcase: Story = {
  name: i18n.t('radioGroup.storyName.showcase', 'Factory: Showcase'),
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="showcase-demo"]');
    expect(container).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[role="radiogroup"]');
    // Showcase creates 10 entries
    expect(groups.length).toBe(10);
  },
};

// --- Test Data Factory ---

function TestDataDemo() {
  const testData = createRadioGroupTestData();

  return (
    <div className="space-y-6" data-testid="test-data-demo">
      <p className="text-sm font-medium">{i18n.t('radioGroup.story.playground')}</p>

      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide uppercase">
          Items ({testData.items.length})
        </p>
        <RadioGroup defaultValue={testData.items[0]?.value}>
          {testData.items.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <RadioGroupItem id={item.id} value={item.value} disabled={item.disabled} />
              <Label htmlFor={item.id}>{item.label}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide uppercase">
          Card Items ({testData.cardItems.length})
        </p>
        <RadioGroup defaultValue={testData.cardItems[0]?.value}>
          {testData.cardItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded border p-2">
              <RadioGroupItem id={item.id} value={item.value} />
              <div>
                <Label htmlFor={item.id}>{item.label}</Label>
                {item.subtitle && <p className="text-muted-foreground text-xs">{item.subtitle}</p>}
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide uppercase">
          Groups ({testData.groups.length})
        </p>
        {testData.groups.slice(0, 2).map((group) => (
          <RadioGroup key={group.id} defaultValue={group.defaultValue}>
            {group.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <RadioGroupItem id={item.id} value={item.value} />
                <Label htmlFor={item.id}>{item.label}</Label>
              </div>
            ))}
          </RadioGroup>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide uppercase">
          Showcase ({testData.showcase.length} entries)
        </p>
        <p className="text-muted-foreground text-xs">
          Orientation matrix: {testData.orientationMatrix.length}, Size matrix:{' '}
          {testData.sizeMatrix.length}, Variant matrix: {testData.variantMatrix.length}, State
          matrix: {testData.stateMatrix.length}, OxV matrix:{' '}
          {testData.orientationVariantMatrix.length}x
          {testData.orientationVariantMatrix[0]?.length ?? 0}
        </p>
      </div>
    </div>
  );
}

export const TestData: Story = {
  name: i18n.t('radioGroup.storyName.testData', 'Factory: Complete Test Data'),
  render: () => <TestDataDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="test-data-demo"]');
    expect(container).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[role="radiogroup"]');
    // items group + cardItems group + 2 sliced groups = 4
    expect(groups.length).toBe(4);
  },
};

// --- Constants Stories ---

function ConstantsOrientationsDemo() {
  const orientations: RadioGroupOrientation[] = [...RADIO_GROUP_ORIENTATIONS];

  return (
    <div data-testid="constants-orientations-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.layouts')}</p>
      <ul className="space-y-1">
        {orientations.map((o) => (
          <li key={o} className="text-sm" data-orientation={o}>
            {o}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ConstantsOrientations: Story = {
  name: i18n.t('radioGroup.storyName.constantsOrientations', 'Factory: Constants - Orientations'),
  render: () => <ConstantsOrientationsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="constants-orientations-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-orientation="vertical"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-orientation="horizontal"]')).toBeInTheDocument();
  },
};

function ConstantsSizesDemo() {
  const sizes: RadioGroupSize[] = [...RADIO_GROUP_SIZES];

  return (
    <div data-testid="constants-sizes-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.sizes')}</p>
      <ul className="space-y-1">
        {sizes.map((s) => (
          <li key={s} className="text-sm" data-size={s}>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ConstantsSizes: Story = {
  name: i18n.t('radioGroup.storyName.constantsSizes', 'Factory: Constants - Sizes'),
  render: () => <ConstantsSizesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="constants-sizes-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-size="sm"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-size="default"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-size="lg"]')).toBeInTheDocument();
  },
};

function ConstantsVariantsDemo() {
  const variants: RadioGroupVariant[] = [...RADIO_GROUP_VARIANTS];

  return (
    <div data-testid="constants-variants-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.variants')}</p>
      <ul className="space-y-1">
        {variants.map((v) => (
          <li key={v} className="text-sm" data-variant={v}>
            {v}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ConstantsVariants: Story = {
  name: i18n.t('radioGroup.storyName.constantsVariants', 'Factory: Constants - Variants'),
  render: () => <ConstantsVariantsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="constants-variants-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-variant="default"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-variant="outline"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-variant="card"]')).toBeInTheDocument();
  },
};

function ConstantsItemStatesDemo() {
  const itemStates: RadioItemState[] = [...RADIO_ITEM_STATES];

  return (
    <div data-testid="constants-item-states-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('radioGroup.section.states')}</p>
      <ul className="space-y-1">
        {itemStates.map((s) => (
          <li key={s} className="text-sm" data-item-state={s}>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ConstantsItemStates: Story = {
  name: i18n.t('radioGroup.storyName.constantsItemStates', 'Factory: Constants - Item States'),
  render: () => <ConstantsItemStatesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="constants-item-states-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-item-state="default"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-item-state="checked"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-item-state="disabled"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-item-state="focus"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-item-state="error"]')).toBeInTheDocument();
  },
};

// ============================================================================
// CROSS-CUTTING CONCERN STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('radioGroup.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('radioGroup.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('radioGroup.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('radioGroup.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('radioGroup.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: radioGroupStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('radioGroup.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: radioGroupStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('radioGroup.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: radioGroupStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
