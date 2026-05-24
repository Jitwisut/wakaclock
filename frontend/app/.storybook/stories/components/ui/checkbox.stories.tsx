import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { CheckCircleIcon, LoaderIcon, XCircleIcon } from 'lucide-react';

import type {
  CheckboxGroupLayout,
  CheckboxLabelPosition,
  CheckboxSize,
  CheckboxState,
  CheckboxValidationState,
  FakeAccessibleCheckbox,
  FakeAsyncCheckbox,
  FakeCheckboxGroup,
  FakeCheckboxOption,
  FakeCheckboxTreeNode,
  FakeCheckboxWithValidation,
  FakeFilterCheckbox,
  FakePreferenceCheckbox,
  FakeTermsCheckbox,
  FakeTrackedCheckbox,
} from '@/.storybook/stories/_factories/checkbox.factory';
import {
  CHECKBOX_GROUP_LAYOUTS,
  CHECKBOX_LABEL_POSITIONS,
  CHECKBOX_LABELS,
  CHECKBOX_PREFERENCE_CATEGORIES,
  CHECKBOX_SIZE_CLASSES,
  CHECKBOX_SIZES,
  CHECKBOX_STATES,
  CHECKBOX_VALIDATION_STATES,
  createFakeAccessibleCheckbox,
  createFakeAsyncCheckbox,
  createFakeCheckboxGroup,
  createFakeCheckboxMatrix,
  createFakeCheckboxOption,
  createFakeCheckboxOptions,
  createFakeCheckboxShowcase,
  createFakeCheckboxTree,
  createFakeCheckboxValidationMatrix,
  createFakeCheckboxWithValidation,
  createFakeCookieConsent,
  createFakeEnterpriseCheckboxSet,
  createFakeFilterCheckbox,
  createFakeFilterCheckboxes,
  createFakeNewsletterForm,
  createFakePreferenceCheckbox,
  createFakePreferenceGroups,
  createFakeSelectAllGroup,
  createFakeTermsCheckbox,
  createFakeTrackedCheckbox,
} from '@/.storybook/stories/_factories/checkbox.factory';
import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import {
  checkboxHandlers,
  checkboxStatusHandlers,
} from '@/.storybook/stories/_handlers/checkbox.handlers';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function CheckboxControlledDemo() {
  const { t } = useTranslation();
  const [checked, setChecked] = React.useState<boolean>(true);
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        id="terms"
        onCheckedChange={(value) => setChecked(value === true)}
      />
      <Label htmlFor="terms">{t('checkbox.acceptTerms')}</Label>
    </div>
  );
}

function CheckboxDisabledDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <Checkbox defaultChecked disabled id="disabled" />
      <Label htmlFor="disabled">{t('checkbox.disabled')}</Label>
    </div>
  );
}

function CheckboxKeyboardInteractionDemo() {
  const { t } = useTranslation();

  const [checked, setChecked] = React.useState(false);
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {t('checkbox.story.tabToFocusSpaceToToggle', 'Tab to focus, Space to toggle')}
      </p>
      <div className="flex items-center gap-2">
        <Checkbox
          id="keyboard"
          checked={checked}
          onCheckedChange={(value) => setChecked(value === true)}
        />
        <Label htmlFor="keyboard">Checkbox is {checked ? 'checked' : 'unchecked'}</Label>
      </div>
    </div>
  );
}

function CheckboxIndeterminateDemo() {
  const [checked, setChecked] = React.useState<boolean | 'indeterminate'>('indeterminate');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="parent"
          checked={checked}
          onCheckedChange={(value) => setChecked(value === true)}
        />
        <Label htmlFor="parent">{i18n.t('checkbox.story.selectAll', 'Select All')}</Label>
      </div>
      <div className="ml-6 space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox id="child1" defaultChecked />
          <Label htmlFor="child1">{i18n.t('checkbox.story.item1', 'Item 1')}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="child2" />
          <Label htmlFor="child2">{i18n.t('checkbox.story.item2', 'Item 2')}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="child3" defaultChecked />
          <Label htmlFor="child3">{i18n.t('checkbox.story.item3', 'Item 3')}</Label>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  args: {
    disabled: false,
    onCheckedChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: [...formHandlers, ...checkboxHandlers] },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // State
    checked: {
      control: 'boolean',
      description: i18n.t('checkbox.argType.controlledCheckedState', 'Controlled checked state'),
      table: {
        category: 'State',
        type: { summary: 'boolean | "indeterminate"' },
      },
    },
    defaultChecked: {
      control: 'boolean',
      description: i18n.t(
        'checkbox.argType.defaultCheckedStateForUncontrolledUsage',
        'Default checked state for uncontrolled usage'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
      },
    },
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'checkbox.argType.whetherTheCheckboxIsDisabled',
        'Whether the checkbox is disabled'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    required: {
      control: 'boolean',
      description: i18n.t(
        'checkbox.argType.whetherTheCheckboxIsRequired',
        'Whether the checkbox is required'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // HTML
    name: {
      control: 'text',
      description: i18n.t(
        'checkbox.argType.nameAttributeForFormSubmission',
        'Name attribute for form submission'
      ),
      table: {
        category: 'HTML',
        type: { summary: 'string' },
      },
    },
    value: {
      control: 'text',
      description: i18n.t(
        'checkbox.argType.valueAttributeForFormSubmission',
        'Value attribute for form submission'
      ),
      table: {
        category: 'HTML',
        defaultValue: { summary: 'on' },
        type: { summary: 'string' },
      },
    },
    id: {
      control: 'text',
      description: i18n.t(
        'checkbox.argType.idAttributeForLabelAssociation',
        'ID attribute for label association'
      ),
      table: {
        category: 'HTML',
        type: { summary: 'string' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t('checkbox.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // Events
    onCheckedChange: {
      action: 'onCheckedChange',
      description: i18n.t(
        'checkbox.argType.calledWhenCheckedStateChanges',
        'Called when checked state changes'
      ),
      table: {
        category: 'Events',
        type: { summary: '(checked: boolean | "indeterminate") => void' },
      },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('checkbox.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('checkbox.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('checkbox.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="playground" />
      <Label htmlFor="playground">
        {i18n.t('checkbox.story.acceptTermsAndConditions', 'Accept terms and conditions')}
      </Label>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('#playground');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox?.getAttribute('role')).toBe('checkbox');
  },
};

function CheckboxVariantsDemo() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('checkbox.variants.states')}</p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox id="var-unchecked" />
            <Label htmlFor="var-unchecked">{i18n.t('checkbox.story.unchecked', 'Unchecked')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="var-checked" defaultChecked />
            <Label htmlFor="var-checked">{i18n.t('checkbox.story.checked', 'Checked')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="var-indeterminate" checked="indeterminate" />
            <Label htmlFor="var-indeterminate">
              {i18n.t('checkbox.story.indeterminate', 'Indeterminate')}
            </Label>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('checkbox.variants.disabledStates')}</p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox id="var-disabled" disabled />
            <Label htmlFor="var-disabled" className="text-muted-foreground">
              Disabled
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="var-disabled-checked" disabled defaultChecked />
            <Label htmlFor="var-disabled-checked" className="text-muted-foreground">
              Disabled Checked
            </Label>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('checkbox.variants.withDescription')}</p>
        <div className="items-top flex space-x-2">
          <Checkbox id="var-desc" />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="var-desc">{i18n.t('checkbox.story.acceptTerms', 'Accept terms')}</Label>
            <p className="text-muted-foreground text-sm">
              {i18n.t(
                'checkbox.story.youAgreeToOurTermsOfService',
                'You agree to our Terms of Service.'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <CheckboxVariantsDemo />,
  play: async ({ canvasElement }) => {
    const checkboxes = canvasElement.querySelectorAll('[role="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
  },
};

function CheckboxSizesDemo() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('checkbox.sizes.compact')}</p>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox id="size-sm" className="h-3.5 w-3.5" />
          <Label htmlFor="size-sm" className="text-sm">
            Small checkbox
          </Label>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('checkbox.sizes.default')}</p>
        <div className="flex items-center gap-2">
          <Checkbox id="size-default" />
          <Label htmlFor="size-default">
            {i18n.t('checkbox.story.defaultCheckbox', 'Default checkbox')}
          </Label>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('checkbox.sizes.large')}</p>
        <div className="flex items-center gap-3 text-lg">
          <Checkbox id="size-lg" className="h-5 w-5" />
          <Label htmlFor="size-lg" className="text-lg">
            Large checkbox
          </Label>
        </div>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <CheckboxSizesDemo />,
  play: async ({ canvasElement }) => {
    const checkboxes = canvasElement.querySelectorAll('[role="checkbox"]');
    expect(checkboxes.length).toBe(3);
  },
};

export const Controlled: Story = {
  render: () => <CheckboxControlledDemo />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('#terms');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox?.getAttribute('aria-checked')).toBe('true');
  },
};

export const Uncontrolled: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="uncontrolled" defaultChecked />
      <Label htmlFor="uncontrolled">
        {i18n.t('checkbox.story.defaultChecked', 'Default checked')}
      </Label>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('#uncontrolled');
    expect(checkbox?.getAttribute('data-state')).toBe('checked');
  },
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="checked" defaultChecked />
      <Label htmlFor="checked">
        {i18n.t('checkbox.story.checkedCheckbox', 'Checked checkbox')}
      </Label>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('#checked');
    expect(checkbox?.getAttribute('data-state')).toBe('checked');
    expect(checkbox?.getAttribute('aria-checked')).toBe('true');
  },
};

export const Unchecked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="unchecked" />
      <Label htmlFor="unchecked">
        {i18n.t('checkbox.story.uncheckedCheckbox', 'Unchecked checkbox')}
      </Label>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('#unchecked');
    expect(checkbox?.getAttribute('data-state')).toBe('unchecked');
    expect(checkbox?.getAttribute('aria-checked')).toBe('false');
  },
};

export const Indeterminate: Story = {
  render: () => <CheckboxIndeterminateDemo />,
  play: async ({ canvasElement }) => {
    const parentCheckbox = canvasElement.querySelector('#parent');
    expect(parentCheckbox?.getAttribute('data-state')).toBe('indeterminate');
    expect(parentCheckbox?.getAttribute('aria-checked')).toBe('mixed');
  },
};

export const Disabled: Story = {
  render: () => <CheckboxDisabledDemo />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('#disabled');
    expect(checkbox).toBeDisabled();
  },
};

export const DisabledUnchecked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="disabled-unchecked" disabled />
      <Label htmlFor="disabled-unchecked" className="text-muted-foreground">
        Disabled unchecked
      </Label>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('#disabled-unchecked');
    expect(checkbox).toBeDisabled();
    expect(checkbox?.getAttribute('data-state')).toBe('unchecked');
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox id="label-right" />
        <Label htmlFor="label-right">
          {i18n.t('checkbox.story.labelOnTheRight', 'Label on the right')}
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="label-left">
          {i18n.t('checkbox.story.labelOnTheLeft', 'Label on the left')}
        </Label>
        <Checkbox id="label-left" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Label on the right')).toBeInTheDocument();
    expect(canvas.getByText('Label on the left')).toBeInTheDocument();
  },
};

export const WithDescription: Story = {
  render: () => (
    <div className="items-top flex space-x-2">
      <Checkbox id="terms-desc" />
      <div className="grid gap-1.5 leading-none">
        <Label htmlFor="terms-desc">
          {i18n.t('checkbox.story.acceptTermsAndConditions', 'Accept terms and conditions')}
        </Label>
        <p className="text-muted-foreground text-sm">
          You agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Accept terms and conditions')).toBeInTheDocument();
    expect(canvas.getByText(/Terms of Service and Privacy Policy/)).toBeInTheDocument();
  },
};

export const FormExample: Story = {
  render: () => (
    <form className="space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox id="newsletter" name="newsletter" />
        <Label htmlFor="newsletter">
          {i18n.t('checkbox.story.subscribeToNewsletter', 'Subscribe to newsletter')}
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="marketing" name="marketing" />
        <Label htmlFor="marketing">
          {i18n.t('checkbox.story.receiveMarketingEmails', 'Receive marketing emails')}
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="terms-form" name="terms" required />
        <Label htmlFor="terms-form">
          Accept terms <span className="text-destructive">*</span>
        </Label>
      </div>
    </form>
  ),
  play: async ({ canvasElement }) => {
    const checkboxes = canvasElement.querySelectorAll('[role="checkbox"]');
    expect(checkboxes.length).toBe(3);
    const termsCheckbox = canvasElement.querySelector('#terms-form');
    expect(termsCheckbox?.hasAttribute('required')).toBe(true);
  },
};

export const KeyboardInteraction: Story = {
  render: () => <CheckboxKeyboardInteractionDemo />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('#keyboard') as HTMLElement;

    // Tab to focus
    await userEvent.tab();
    expect(checkbox).toHaveFocus();
    expect(checkbox.getAttribute('aria-checked')).toBe('false');

    // Space toggles
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('true');
    });

    // Space toggles back
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('false');
    });
  },
};

export const DisabledKeyboardBehavior: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'checkbox.story.disabledCheckboxShouldNotReceiveFocus',
          'Disabled checkbox should not receive focus'
        )}
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox id="disabled-kb" disabled />
          <Label htmlFor="disabled-kb" className="text-muted-foreground">
            Disabled
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="enabled-kb" />
          <Label htmlFor="enabled-kb">{i18n.t('checkbox.story.enabled', 'Enabled')}</Label>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const enabledCheckbox = canvasElement.querySelector('#enabled-kb') as HTMLElement;

    // Tab should skip disabled and focus enabled
    await userEvent.tab();
    expect(enabledCheckbox).toHaveFocus();
  },
};

export const Default: Story = {
  ...Controlled,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const checkbox = canvasElement.querySelector('#terms');

    if (!(checkbox instanceof HTMLElement)) {
      throw new Error('Expected checkbox with id="#terms" to be present.');
    }

    expect(checkbox.getAttribute('data-slot')).toBe('checkbox');
    expect(checkbox.getAttribute('aria-checked')).toBe('true');

    const label = canvasElement.querySelector('label[for="terms"]');
    if (!(label instanceof HTMLLabelElement)) {
      throw new Error('Expected checkbox label with for="terms" to be present.');
    }

    expect(label.getAttribute('data-slot')).toBe('label');
    expect(label.textContent?.trim()).not.toBe('');

    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('false');
    });
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Japanese: Story = {
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
    expect(canvas.getByText('利用規約に同意する')).toBeInTheDocument();
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
  name: i18n.t('checkbox.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

export const AllStates: Story = {
  name: i18n.t('checkbox.storyName.allStates', 'All States Matrix'),
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox id="unchecked-state" />
          <Label htmlFor="unchecked-state">{i18n.t('checkbox.story.unchecked', 'Unchecked')}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="checked-state" defaultChecked />
          <Label htmlFor="checked-state">{i18n.t('checkbox.story.checked', 'Checked')}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="indeterminate-state" checked="indeterminate" />
          <Label htmlFor="indeterminate-state">
            {i18n.t('checkbox.story.indeterminate', 'Indeterminate')}
          </Label>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox id="disabled-unchecked-state" disabled />
          <Label htmlFor="disabled-unchecked-state" className="text-muted-foreground">
            Disabled Unchecked
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="disabled-checked-state" disabled defaultChecked />
          <Label htmlFor="disabled-checked-state" className="text-muted-foreground">
            Disabled Checked
          </Label>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const unchecked = canvasElement.querySelector('#unchecked-state');
    const checked = canvasElement.querySelector('#checked-state');
    const indeterminate = canvasElement.querySelector('#indeterminate-state');
    expect(unchecked?.getAttribute('data-state')).toBe('unchecked');
    expect(checked?.getAttribute('data-state')).toBe('checked');
    expect(indeterminate?.getAttribute('data-state')).toBe('indeterminate');
  },
};

export const Accessibility: Story = {
  name: i18n.t('checkbox.storyName.accessibility', 'Accessibility'),
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox id="a11y-checkbox" aria-describedby="a11y-desc" />
        <Label htmlFor="a11y-checkbox">
          {i18n.t('checkbox.story.accessibleCheckbox', 'Accessible checkbox')}
        </Label>
      </div>
      <p id="a11y-desc" className="text-muted-foreground text-sm">
        This checkbox demonstrates proper label association and ARIA attributes.
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvasElement.querySelector('#a11y-checkbox') as HTMLElement;

    // Verify checkbox has proper role
    expect(checkbox.getAttribute('role')).toBe('checkbox');

    // Verify label association
    const label = canvas.getByText('Accessible checkbox');
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe('a11y-checkbox');

    // Verify aria-describedby
    expect(checkbox.getAttribute('aria-describedby')).toBe('a11y-desc');

    // Verify initial unchecked state
    expect(checkbox.getAttribute('aria-checked')).toBe('false');

    // Test keyboard navigation - Tab to focus
    await userEvent.tab();
    expect(checkbox).toHaveFocus();

    // Test keyboard interaction - Space to toggle
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('true');
    });

    // Toggle back
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('false');
    });
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formHandlers },
  },
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[role="checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[role="checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[role="checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[role="checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[role="checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[role="checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[role="checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[role="checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

// ============ FAKER DATA STORIES ============

function FakerCheckboxList() {
  const options = React.useMemo(() => createFakeCheckboxOptions(5), []);

  return (
    <div className="space-y-4">
      {options.map((option) => (
        <div key={option.id} className="flex items-start space-x-2">
          <Checkbox id={option.id} defaultChecked={option.checked} disabled={option.disabled} />
          <div className="grid gap-1 leading-none">
            <Label htmlFor={option.id}>{option.label}</Label>
            {option.description && (
              <p className="text-muted-foreground text-sm">{option.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <FakerCheckboxList />,
  play: async ({ canvasElement }) => {
    const checkboxes = canvasElement.querySelectorAll('[role="checkbox"]');
    expect(checkboxes.length).toBe(5);
  },
};

// ============ ASYNC VALIDATION STORIES ============

function AsyncTermsAcceptance() {
  const [checked, setChecked] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [message, setMessage] = React.useState('');

  const validateTerms = async (isChecked: boolean) => {
    if (!isChecked) {
      setStatus('idle');
      setMessage('');
      return;
    }

    setStatus('validating');
    setMessage('');

    try {
      const response = await fetch('/api/form/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terms: isChecked }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message ?? 'Validation failed');
      }

      setStatus('valid');
      setMessage('Terms accepted successfully');
    } catch (error) {
      setStatus('invalid');
      setMessage(error instanceof Error ? error.message : 'Validation failed');
    }
  };

  const handleChange = (isChecked: boolean | 'indeterminate') => {
    if (typeof isChecked === 'boolean') {
      setChecked(isChecked);
      void validateTerms(isChecked);
    }
  };

  return (
    <div className="space-y-4" data-testid="async-terms-acceptance">
      <div className="flex items-start space-x-2">
        <Checkbox
          id="async-terms"
          checked={checked}
          onCheckedChange={handleChange}
          disabled={status === 'validating'}
          data-state={status}
          data-testid="terms-checkbox"
        />
        <div className="grid gap-1 leading-none">
          <Label htmlFor="async-terms" className="flex items-center gap-2">
            I accept the terms and conditions
            {status === 'validating' && (
              <LoaderIcon className="text-muted-foreground size-4 animate-spin" />
            )}
            {status === 'valid' && <CheckCircleIcon className="size-4 text-green-600" />}
            {status === 'invalid' && <XCircleIcon className="size-4 text-red-600" />}
          </Label>
          <p className="text-muted-foreground text-sm">
            You agree to our Terms of Service and Privacy Policy.
          </p>
          {message && (
            <p
              className={`text-sm ${status === 'valid' ? 'text-green-600' : 'text-red-600'}`}
              data-testid="validation-message"
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: formHandlers },
  },
  render: () => <AsyncTermsAcceptance />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="terms-checkbox"]') as HTMLElement;

    expect(checkbox.getAttribute('data-state')).toBe('idle');

    // Click to accept terms
    await userEvent.click(checkbox);

    // Should show validating state
    await waitFor(() => {
      expect(checkbox.getAttribute('data-state')).toBe('validating');
    });

    // Wait for validation to complete
    await waitFor(
      () => {
        const state = checkbox.getAttribute('data-state');
        expect(state === 'valid' || state === 'invalid').toBe(true);
      },
      { timeout: 3000 }
    );
  },
};

export const EmptyData: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox id="empty-checkbox" disabled />
        <Label htmlFor="empty-checkbox" className="text-muted-foreground">
          No options available
        </Label>
      </div>
      <p className="text-muted-foreground text-sm">
        {i18n.t('checkbox.story.noCheckboxOptionsToDisplay', 'No checkbox options to display.')}
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('#empty-checkbox');
    expect(checkbox).toBeDisabled();
  },
};

function SlowAsyncCheckbox() {
  const [checked, setChecked] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'validating' | 'valid'>('idle');

  const handleChange = async (isChecked: boolean | 'indeterminate') => {
    if (typeof isChecked === 'boolean') {
      setChecked(isChecked);
      if (isChecked) {
        setStatus('validating');
        // Simulate slow response (5 seconds)
        await new Promise((resolve) => setTimeout(resolve, 5000));
        setStatus('valid');
      } else {
        setStatus('idle');
      }
    }
  };

  return (
    <div className="space-y-4" data-testid="slow-checkbox-demo">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="slow-checkbox"
          checked={checked}
          onCheckedChange={handleChange}
          disabled={status === 'validating'}
          data-state={status}
          data-testid="slow-checkbox"
        />
        <Label htmlFor="slow-checkbox" className="flex items-center gap-2">
          {i18n.t('checkbox.story.slowValidation', 'Slow validation checkbox')}
          {status === 'validating' && <LoaderIcon className="size-4 animate-spin" />}
          {status === 'valid' && <CheckCircleIcon className="size-4 text-green-600" />}
        </Label>
      </div>
      {status === 'validating' && (
        <p className="text-muted-foreground text-sm">
          {i18n.t('checkbox.story.validatingMessage', 'Validating (this takes 5 seconds)...')}
        </p>
      )}
    </div>
  );
}

export const SlowResponse: Story = {
  name: i18n.t('checkbox.storyName.slowResponse', 'Slow Response (5s)'),
  render: () => <SlowAsyncCheckbox />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="slow-checkbox"]') as HTMLElement;

    await userEvent.click(checkbox);

    // Should show validating state
    expect(checkbox.getAttribute('data-state')).toBe('validating');
    expect(checkbox).toBeDisabled();

    // Wait for validation to complete (after 5+ seconds)
    await waitFor(
      () => {
        expect(checkbox.getAttribute('data-state')).toBe('valid');
      },
      { timeout: 7000 }
    );
  },
};

// ============ HTTP 5xx ERROR STORIES ============

export const Error502BadGateway: Story = {
  name: i18n.t('checkbox.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: formStatusHandlers.badGateway },
  },
  render: () => <AsyncTermsAcceptance />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="terms-checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('checkbox.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: formStatusHandlers.serviceUnavailable },
  },
  render: () => <AsyncTermsAcceptance />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="terms-checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('checkbox.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: formStatusHandlers.gatewayTimeout },
  },
  render: () => <AsyncTermsAcceptance />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="terms-checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('checkbox.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: formStatusHandlers.tooManyRequests },
  },
  render: () => <AsyncTermsAcceptance />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="terms-checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

// ============ COMBINED LOCALE + THEME STORIES ============

export const DarkModeJapanese: Story = {
  name: i18n.t('checkbox.storyName.darkModeJapanese', 'Dark Mode + Japanese'),
  ...Controlled,
  globals: {
    theme: 'dark',
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const checkbox = canvasElement.querySelector('[data-slot="checkbox"]');
    expect(checkbox).toBeInTheDocument();

    // Verify Japanese text is displayed
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText('利用規約に同意する')).toBeInTheDocument();
    });
  },
};

// ============ CHECKBOX-SPECIFIC PREFERENCE HANDLERS ============

export const CheckboxPreferenceSave: Story = {
  name: i18n.t('checkbox.storyName.checkboxPreferenceSave', 'Preference Save (Checkbox Handlers)'),
  parameters: {
    msw: { handlers: checkboxHandlers },
  },
  render: () => <AsyncTermsAcceptance />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="terms-checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const CheckboxValidationError: Story = {
  name: i18n.t('checkbox.storyName.checkboxValidationError', 'Checkbox Validation Error'),
  parameters: {
    msw: { handlers: checkboxStatusHandlers.validationError },
  },
  render: () => <AsyncTermsAcceptance />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="terms-checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const CheckboxServiceUnavailable: Story = {
  name: i18n.t('checkbox.storyName.checkboxServiceUnavailable', 'Checkbox Service Unavailable'),
  parameters: {
    msw: { handlers: checkboxStatusHandlers.serviceUnavailable },
  },
  render: () => <AsyncTermsAcceptance />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="terms-checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

// ============ COMPREHENSIVE CHECK/UNCHECK PLAY TESTS ============

function CheckUncheckDemo() {
  const [checked, setChecked] = React.useState(false);
  const [toggleCount, setToggleCount] = React.useState(0);

  const handleChange = (value: boolean | 'indeterminate') => {
    if (typeof value === 'boolean') {
      setChecked(value);
      setToggleCount((c) => c + 1);
    }
  };

  return (
    <div className="space-y-4" data-testid="check-uncheck-demo">
      <div className="flex items-center gap-2">
        <Checkbox
          id="toggle-checkbox"
          checked={checked}
          onCheckedChange={handleChange}
          data-testid="toggle-checkbox"
        />
        <Label htmlFor="toggle-checkbox">Toggle me (toggled {toggleCount} times)</Label>
      </div>
      <p className="text-muted-foreground text-sm" data-testid="checkbox-status">
        Status:{' '}
        {checked
          ? i18n.t('checkbox.story.checked', 'Checked')
          : i18n.t('checkbox.story.unchecked', 'Unchecked')}
      </p>
    </div>
  );
}

export const CheckUncheckInteraction: Story = {
  name: i18n.t('checkbox.storyName.checkUncheckInteraction', 'Check/Uncheck Interaction'),
  render: () => <CheckUncheckDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvasElement.querySelector('[data-testid="toggle-checkbox"]') as HTMLElement;
    const statusText = canvasElement.querySelector(
      '[data-testid="checkbox-status"]'
    ) as HTMLElement;

    // Initial state should be unchecked
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    expect(checkbox.getAttribute('data-state')).toBe('unchecked');
    expect(statusText.textContent).toContain('Unchecked');

    // Click to check
    await userEvent.click(checkbox);
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('true');
      expect(checkbox.getAttribute('data-state')).toBe('checked');
      expect(statusText.textContent).toContain('Checked');
    });

    // Click to uncheck
    await userEvent.click(checkbox);
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('false');
      expect(checkbox.getAttribute('data-state')).toBe('unchecked');
      expect(statusText.textContent).toContain('Unchecked');
    });

    // Verify toggle count updated

    const label = canvas.getByText(/toggled 2 times/);
    expect(label).toBeInTheDocument();
  },
};

export const KeyboardToggle: Story = {
  name: i18n.t('checkbox.storyName.keyboardToggle', 'Keyboard Toggle (Space Key)'),
  render: () => <CheckUncheckDemo />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="toggle-checkbox"]') as HTMLElement;

    // Tab to focus
    await userEvent.tab();
    expect(checkbox).toHaveFocus();
    expect(checkbox.getAttribute('aria-checked')).toBe('false');

    // Space to check
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('true');
    });

    // Space to uncheck
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('false');
    });

    // Multiple rapid toggles
    await userEvent.keyboard(' ');
    await userEvent.keyboard(' ');
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('true');
    });
  },
};

// ============ ARIA ATTRIBUTES VERIFICATION ============

function AriaAttributesDemo() {
  const [checked, setChecked] = React.useState<boolean | 'indeterminate'>(false);
  const [state, setState] = React.useState<'unchecked' | 'checked' | 'indeterminate'>('unchecked');

  const cycleState = () => {
    if (state === 'unchecked') {
      setChecked(true);
      setState('checked');
    } else if (state === 'checked') {
      setChecked('indeterminate');
      setState('indeterminate');
    } else {
      setChecked(false);
      setState('unchecked');
    }
  };

  return (
    <div className="space-y-4" data-testid="aria-demo">
      <div className="flex items-center gap-2">
        <Checkbox
          id="aria-checkbox"
          checked={checked}
          onCheckedChange={() => cycleState()}
          data-testid="aria-checkbox"
          aria-describedby="aria-desc"
        />
        <Label htmlFor="aria-checkbox">
          {i18n.t(
            'checkbox.story.ariaCheckboxClickToCycleStates',
            'ARIA Checkbox (click to cycle states)'
          )}
        </Label>
      </div>
      <p id="aria-desc" className="text-muted-foreground text-sm">
        Current state: {state}
      </p>
      <button
        type="button"
        onClick={cycleState}
        className="text-sm underline"
        data-testid="cycle-button"
      >
        Cycle State
      </button>
    </div>
  );
}

export const AriaAttributesVerification: Story = {
  name: i18n.t('checkbox.storyName.ariaAttributesVerification', 'ARIA Attributes Verification'),
  render: () => <AriaAttributesDemo />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="aria-checkbox"]') as HTMLElement;
    const cycleButton = canvasElement.querySelector('[data-testid="cycle-button"]') as HTMLElement;

    // Verify role
    expect(checkbox.getAttribute('role')).toBe('checkbox');

    // Initial state: unchecked
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    expect(checkbox.getAttribute('data-state')).toBe('unchecked');

    // Verify aria-describedby
    expect(checkbox.getAttribute('aria-describedby')).toBe('aria-desc');

    // Click to checked
    await userEvent.click(cycleButton);
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('true');
      expect(checkbox.getAttribute('data-state')).toBe('checked');
    });

    // Click to indeterminate
    await userEvent.click(cycleButton);
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('mixed');
      expect(checkbox.getAttribute('data-state')).toBe('indeterminate');
    });

    // Click back to unchecked
    await userEvent.click(cycleButton);
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('false');
      expect(checkbox.getAttribute('data-state')).toBe('unchecked');
    });
  },
};

// ============ DARK MODE VARIANTS ============

function DarkModeDemo() {
  const { t } = useTranslation();
  return (
    <div className="bg-background space-y-4 rounded-lg p-6">
      <h3 className="text-sm font-medium">{t('checkbox.variants.states')}</h3>
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Checkbox id="dark-unchecked" data-testid="dark-unchecked" />
          <Label htmlFor="dark-unchecked">{t('checkbox.story.unchecked', 'Unchecked')}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="dark-checked" defaultChecked data-testid="dark-checked" />
          <Label htmlFor="dark-checked">{t('checkbox.story.checked', 'Checked')}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="dark-indeterminate"
            checked="indeterminate"
            data-testid="dark-indeterminate"
          />
          <Label htmlFor="dark-indeterminate">
            {t('checkbox.story.indeterminate', 'Indeterminate')}
          </Label>
        </div>
      </div>
      <h3 className="text-sm font-medium">{t('checkbox.variants.disabledStates')}</h3>
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Checkbox id="dark-disabled" disabled data-testid="dark-disabled" />
          <Label htmlFor="dark-disabled" className="text-muted-foreground">
            Disabled
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="dark-disabled-checked"
            disabled
            defaultChecked
            data-testid="dark-disabled-checked"
          />
          <Label htmlFor="dark-disabled-checked" className="text-muted-foreground">
            Disabled Checked
          </Label>
        </div>
      </div>
    </div>
  );
}

export const DarkModeVariants: Story = {
  name: i18n.t('checkbox.storyName.darkModeVariants', 'Dark Mode Variants'),
  globals: {
    theme: 'dark',
  },
  render: () => <DarkModeDemo />,
  play: async ({ canvasElement }) => {
    // Verify all checkboxes render correctly in dark mode
    const unchecked = canvasElement.querySelector('[data-testid="dark-unchecked"]') as HTMLElement;
    const checked = canvasElement.querySelector('[data-testid="dark-checked"]') as HTMLElement;
    const indeterminate = canvasElement.querySelector(
      '[data-testid="dark-indeterminate"]'
    ) as HTMLElement;
    const disabled = canvasElement.querySelector('[data-testid="dark-disabled"]') as HTMLElement;

    expect(unchecked.getAttribute('data-state')).toBe('unchecked');
    expect(checked.getAttribute('data-state')).toBe('checked');
    expect(indeterminate.getAttribute('data-state')).toBe('indeterminate');
    expect(disabled).toBeDisabled();
  },
};

// ============ JAPANESE LOCALE VARIANTS ============

function JapaneseCheckboxDemo() {
  const [checked, setChecked] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="ja-checkbox"
          checked={checked}
          onCheckedChange={(value) => setChecked(value === true)}
          data-testid="ja-checkbox"
        />
        <Label htmlFor="ja-checkbox">{i18n.t('checkbox.acceptTerms')}</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="ja-disabled" disabled data-testid="ja-disabled" />
        <Label htmlFor="ja-disabled" className="text-muted-foreground">
          {i18n.t('checkbox.disabled')}
        </Label>
      </div>
      <p className="text-muted-foreground text-sm">
        {i18n.t('checkbox.variants.states')}: {checked ? '選択済み' : '未選択'}
      </p>
    </div>
  );
}

export const JapaneseLocale: Story = {
  name: i18n.t('checkbox.storyName.japaneseLocale', 'Japanese Locale'),
  globals: {
    locale: 'ja',
  },
  render: () => <JapaneseCheckboxDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(canvasElement);

    // Verify Japanese text is rendered
    await waitFor(() => {
      expect(canvas.getByText('利用規約に同意する')).toBeInTheDocument();
      expect(canvas.getByText('無効')).toBeInTheDocument();
    });

    // Verify checkbox functionality still works
    const checkbox = canvasElement.querySelector('[data-testid="ja-checkbox"]') as HTMLElement;
    await userEvent.click(checkbox);
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('true');
    });
  },
};

export const DarkJapanese: Story = {
  name: i18n.t('checkbox.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: {
    theme: 'dark',
    locale: 'ja',
  },
  render: () => <JapaneseCheckboxDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(canvasElement);

    // Verify Japanese text in dark mode
    await waitFor(() => {
      expect(canvas.getByText('利用規約に同意する')).toBeInTheDocument();
    });

    // Test interaction
    const checkbox = canvasElement.querySelector('[data-testid="ja-checkbox"]') as HTMLElement;
    expect(checkbox.getAttribute('data-slot')).toBe('checkbox');
  },
};

// ============ ENTERPRISE SELECT ALL PATTERN ============

function SelectAllDemo() {
  const [items, setItems] = React.useState([
    { id: '1', label: i18n.t('checkbox.story.option1', 'Option 1'), checked: true },
    { id: '2', label: i18n.t('checkbox.story.option2', 'Option 2'), checked: false },
    { id: '3', label: i18n.t('checkbox.story.option3', 'Option 3'), checked: true },
    { id: '4', label: i18n.t('checkbox.story.option4', 'Option 4'), checked: false },
  ]);

  const allChecked = items.every((item) => item.checked);
  const someChecked = items.some((item) => item.checked) && !allChecked;

  // Helper to determine checkbox state (avoids nested ternary)
  function getSelectAllState(): boolean | 'indeterminate' {
    if (allChecked) return true;
    if (someChecked) return 'indeterminate';
    return false;
  }

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      setItems(items.map((item) => ({ ...item, checked })));
    }
  };

  const handleItemChange = (id: string, checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      setItems(items.map((item) => (item.id === id ? { ...item, checked } : item)));
    }
  };

  return (
    <div className="space-y-4" data-testid="select-all-demo">
      <div className="flex items-center gap-2">
        <Checkbox
          id="select-all"
          checked={getSelectAllState()}
          onCheckedChange={handleSelectAll}
          data-testid="select-all-checkbox"
        />
        <Label htmlFor="select-all" className="font-medium">
          Select All ({items.filter((i) => i.checked).length}/{items.length})
        </Label>
      </div>
      <div className="ml-6 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Checkbox
              id={`item-${item.id}`}
              checked={item.checked}
              onCheckedChange={(checked) => handleItemChange(item.id, checked)}
              data-testid={`item-${item.id}-checkbox`}
            />
            <Label htmlFor={`item-${item.id}`}>{item.label}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}

export const SelectAllPattern: Story = {
  name: i18n.t('checkbox.storyName.selectAllPattern', 'Select All Pattern (Enterprise)'),
  render: () => <SelectAllDemo />,
  play: async ({ canvasElement }) => {
    const selectAll = canvasElement.querySelector(
      '[data-testid="select-all-checkbox"]'
    ) as HTMLElement;
    const item1 = canvasElement.querySelector('[data-testid="item-1-checkbox"]') as HTMLElement;
    const item2 = canvasElement.querySelector('[data-testid="item-2-checkbox"]') as HTMLElement;

    // Initial state: indeterminate (some checked)
    expect(selectAll.getAttribute('aria-checked')).toBe('mixed');
    expect(selectAll.getAttribute('data-state')).toBe('indeterminate');

    // Click select all to check all
    await userEvent.click(selectAll);
    await waitFor(() => {
      expect(selectAll.getAttribute('aria-checked')).toBe('true');
      expect(item1.getAttribute('aria-checked')).toBe('true');
      expect(item2.getAttribute('aria-checked')).toBe('true');
    });

    // Click select all to uncheck all
    await userEvent.click(selectAll);
    await waitFor(() => {
      expect(selectAll.getAttribute('aria-checked')).toBe('false');
      expect(item1.getAttribute('aria-checked')).toBe('false');
      expect(item2.getAttribute('aria-checked')).toBe('false');
    });

    // Check individual item to get indeterminate state
    await userEvent.click(item1);
    await waitFor(() => {
      expect(selectAll.getAttribute('aria-checked')).toBe('mixed');
    });
  },
};

// ============ ADDITIONAL MSW HANDLERS STORIES ============

export const CheckboxRateLimit: Story = {
  name: i18n.t('checkbox.storyName.checkboxRateLimit', 'Rate Limit (429)'),
  parameters: {
    msw: { handlers: checkboxStatusHandlers.tooManyRequests },
  },
  render: () => <AsyncTermsAcceptance />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="terms-checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const CheckboxBadGateway: Story = {
  name: i18n.t('checkbox.storyName.checkboxBadGateway', 'Bad Gateway (502)'),
  parameters: {
    msw: { handlers: checkboxStatusHandlers.badGateway },
  },
  render: () => <AsyncTermsAcceptance />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="terms-checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const CheckboxGatewayTimeout: Story = {
  name: i18n.t('checkbox.storyName.checkboxGatewayTimeout', 'Gateway Timeout (504)'),
  parameters: {
    msw: { handlers: checkboxStatusHandlers.gatewayTimeout },
  },
  render: () => <AsyncTermsAcceptance />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="terms-checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const CheckboxTermsSuccess: Story = {
  name: i18n.t('checkbox.storyName.checkboxTermsSuccess', 'Terms Acceptance Success'),
  parameters: {
    msw: { handlers: checkboxStatusHandlers.termsSuccess },
  },
  render: () => <AsyncTermsAcceptance />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="terms-checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

export const CheckboxCookieConsent: Story = {
  name: i18n.t('checkbox.storyName.checkboxCookieConsent', 'Cookie Consent Success'),
  parameters: {
    msw: { handlers: checkboxStatusHandlers.cookieConsentSuccess },
  },
  render: () => <AsyncTermsAcceptance />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="terms-checkbox"]');
    expect(checkbox).toBeInTheDocument();
  },
};

// ============ FACTORY: CONSTANTS ITERATION STORIES ============

function stateToChecked(state: CheckboxState): boolean | 'indeterminate' {
  if (state === 'checked') return true;
  if (state === 'indeterminate') return 'indeterminate';
  return false;
}

function CheckboxStatesDemo() {
  const states: CheckboxState[] = CHECKBOX_STATES;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.states')}</h3>
      <div className="flex items-center gap-6">
        {states.map((state) => (
          <div key={state} className="flex items-center gap-2">
            <Checkbox
              id={`state-${state}`}
              checked={stateToChecked(state)}
              data-testid={`state-${state}`}
            />
            <Label htmlFor={`state-${state}`}>{state}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryCheckboxStates: Story = {
  name: i18n.t('checkbox.storyName.factoryCheckboxStates', 'Factory: CHECKBOX_STATES'),
  render: () => <CheckboxStatesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const state of CHECKBOX_STATES) {
      const el = canvasElement.querySelector(`[data-testid="state-${state}"]`) as HTMLElement;
      expect(el).toBeInTheDocument();
      if (state === 'checked') {
        expect(el.getAttribute('data-state')).toBe('checked');
      } else if (state === 'indeterminate') {
        expect(el.getAttribute('data-state')).toBe('indeterminate');
      } else {
        expect(el.getAttribute('data-state')).toBe('unchecked');
      }
    }
    expect(canvas.getByText('checked')).toBeInTheDocument();
  },
};

function CheckboxSizesFactoryDemo() {
  const { t } = useTranslation();
  const sizes: CheckboxSize[] = CHECKBOX_SIZES;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">{t('checkbox.section.sizes')}</h3>
      <div className="flex items-center gap-6">
        {sizes.map((size) => (
          <div key={size} className="flex items-center gap-2">
            <Checkbox
              id={`size-factory-${size}`}
              className={CHECKBOX_SIZE_CLASSES[size]}
              defaultChecked
              data-testid={`size-factory-${size}`}
            />
            <Label htmlFor={`size-factory-${size}`}>
              {size} ({CHECKBOX_SIZE_CLASSES[size]})
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryCheckboxSizes: Story = {
  name: i18n.t('checkbox.storyName.factoryCheckboxSizes', 'Factory: CHECKBOX_SIZES + SIZE_CLASSES'),
  render: () => <CheckboxSizesFactoryDemo />,
  play: async ({ canvasElement }) => {
    for (const size of CHECKBOX_SIZES) {
      const el = canvasElement.querySelector(`[data-testid="size-factory-${size}"]`);
      expect(el).toBeInTheDocument();
    }
    expect(canvasElement.querySelectorAll('[role="checkbox"]').length).toBe(CHECKBOX_SIZES.length);
  },
};

function CheckboxLabelPositionsDemo() {
  const positions: CheckboxLabelPosition[] = CHECKBOX_LABEL_POSITIONS;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.variants')}</h3>
      {positions.map((pos) => (
        <div key={pos} className="flex items-center gap-2">
          {pos === 'left' && <Label htmlFor={`pos-${pos}`}>Label on {pos}</Label>}
          <Checkbox id={`pos-${pos}`} data-testid={`pos-${pos}`} defaultChecked />
          {pos === 'right' && <Label htmlFor={`pos-${pos}`}>Label on {pos}</Label>}
        </div>
      ))}
    </div>
  );
}

export const FactoryLabelPositions: Story = {
  name: i18n.t('checkbox.storyName.factoryLabelPositions', 'Factory: CHECKBOX_LABEL_POSITIONS'),
  render: () => <CheckboxLabelPositionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const pos of CHECKBOX_LABEL_POSITIONS) {
      const el = canvasElement.querySelector(`[data-testid="pos-${pos}"]`);
      expect(el).toBeInTheDocument();
      expect(canvas.getByText(`Label on ${pos}`)).toBeInTheDocument();
    }
  },
};

function CheckboxValidationStatesDemo() {
  const states: CheckboxValidationState[] = CHECKBOX_VALIDATION_STATES;

  const stateColors: Record<CheckboxValidationState, string> = {
    default: 'text-foreground',
    error: 'text-red-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.states')}</h3>
      {states.map((state) => (
        <div key={state} className="flex items-center gap-2">
          <Checkbox
            id={`val-${state}`}
            defaultChecked={state === 'success'}
            data-testid={`val-${state}`}
          />
          <Label htmlFor={`val-${state}`} className={stateColors[state]}>
            {state} validation
          </Label>
        </div>
      ))}
    </div>
  );
}

export const FactoryValidationStates: Story = {
  name: i18n.t('checkbox.storyName.factoryValidationStates', 'Factory: CHECKBOX_VALIDATION_STATES'),
  render: () => <CheckboxValidationStatesDemo />,
  play: async ({ canvasElement }) => {
    for (const state of CHECKBOX_VALIDATION_STATES) {
      const el = canvasElement.querySelector(`[data-testid="val-${state}"]`);
      expect(el).toBeInTheDocument();
    }
    expect(canvasElement.querySelectorAll('[role="checkbox"]').length).toBe(
      CHECKBOX_VALIDATION_STATES.length
    );
  },
};

function CheckboxGroupLayoutsDemo() {
  const layouts: CheckboxGroupLayout[] = CHECKBOX_GROUP_LAYOUTS;

  const layoutClasses: Record<CheckboxGroupLayout, string> = {
    vertical: 'flex flex-col gap-2',
    horizontal: 'flex flex-row gap-4',
    grid: 'grid grid-cols-2 gap-2',
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.groups')}</h3>
      {layouts.map((layout) => (
        <div key={layout}>
          <p className="mb-2 text-sm font-medium capitalize">{layout} layout</p>
          <div className={layoutClasses[layout]} data-testid={`layout-${layout}`}>
            {[
              i18n.t('checkbox.story.optionA', 'Option A'),
              i18n.t('checkbox.story.optionB', 'Option B'),
              i18n.t('checkbox.story.optionC', 'Option C'),
            ].map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox id={`${layout}-${opt}`} />
                <Label htmlFor={`${layout}-${opt}`}>{opt}</Label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryGroupLayouts: Story = {
  name: i18n.t('checkbox.storyName.factoryGroupLayouts', 'Factory: CHECKBOX_GROUP_LAYOUTS'),
  render: () => <CheckboxGroupLayoutsDemo />,
  play: async ({ canvasElement }) => {
    for (const layout of CHECKBOX_GROUP_LAYOUTS) {
      const el = canvasElement.querySelector(`[data-testid="layout-${layout}"]`);
      expect(el).toBeInTheDocument();
    }
    // 3 layouts x 3 options each = 9 checkboxes
    expect(canvasElement.querySelectorAll('[role="checkbox"]').length).toBe(9);
  },
};

function CheckboxLabelsDemo() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.variants')}</h3>
      {CHECKBOX_LABELS.map((label) => (
        <div key={label} className="flex items-center gap-2">
          <Checkbox id={`label-${label.replaceAll(' ', '-').toLowerCase()}`} />
          <Label htmlFor={`label-${label.replaceAll(' ', '-').toLowerCase()}`}>{label}</Label>
        </div>
      ))}
    </div>
  );
}

export const FactoryCheckboxLabels: Story = {
  name: i18n.t('checkbox.storyName.factoryCheckboxLabels', 'Factory: CHECKBOX_LABELS'),
  render: () => <CheckboxLabelsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of CHECKBOX_LABELS) {
      expect(canvas.getByText(label)).toBeInTheDocument();
    }
    expect(canvasElement.querySelectorAll('[role="checkbox"]').length).toBe(CHECKBOX_LABELS.length);
  },
};

function CheckboxPreferenceCategoriesDemo() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.groups')}</h3>
      {CHECKBOX_PREFERENCE_CATEGORIES.map((cat) => (
        <div key={cat} className="flex items-center gap-2">
          <Checkbox id={`cat-${cat.toLowerCase()}`} data-testid={`cat-${cat.toLowerCase()}`} />
          <Label htmlFor={`cat-${cat.toLowerCase()}`}>{cat}</Label>
        </div>
      ))}
    </div>
  );
}

export const FactoryPreferenceCategories: Story = {
  name: i18n.t(
    'checkbox.storyName.factoryPreferenceCategories',
    'Factory: CHECKBOX_PREFERENCE_CATEGORIES'
  ),
  render: () => <CheckboxPreferenceCategoriesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const cat of CHECKBOX_PREFERENCE_CATEGORIES) {
      expect(canvas.getByText(cat)).toBeInTheDocument();
    }
    expect(canvasElement.querySelectorAll('[role="checkbox"]').length).toBe(
      CHECKBOX_PREFERENCE_CATEGORIES.length
    );
  },
};

// ============ FACTORY: SINGLE ITEM FACTORIES ============

function FactoryCheckboxOptionDemo() {
  const option: FakeCheckboxOption = React.useMemo(() => createFakeCheckboxOption(), []);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.variants')}</h3>
      <div className="flex items-start gap-2">
        <Checkbox
          id={option.id}
          defaultChecked={option.checked}
          disabled={option.disabled}
          required={option.required}
          name={option.name}
          value={option.value}
          data-testid="factory-option"
        />
        <div className="grid gap-1 leading-none">
          <Label htmlFor={option.id}>{option.label}</Label>
          {option.description && (
            <p className="text-muted-foreground text-sm">{option.description}</p>
          )}
        </div>
      </div>
      <div className="text-muted-foreground space-y-1 text-xs">
        <p>ID: {option.id}</p>
        <p>Name: {option.name}</p>
        <p>Value: {option.value}</p>
        <p>Required: {String(option.required)}</p>
      </div>
    </div>
  );
}

export const FactoryCheckboxOption: Story = {
  name: i18n.t('checkbox.storyName.factoryCheckboxOption', 'Factory: createFakeCheckboxOption'),
  render: () => <FactoryCheckboxOptionDemo />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="factory-option"]');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox?.getAttribute('role')).toBe('checkbox');
  },
};

function FactoryCheckboxWithValidationDemo() {
  const item: FakeCheckboxWithValidation = React.useMemo(
    () => createFakeCheckboxWithValidation({ validationState: 'error' }),
    []
  );

  const stateColors: Record<CheckboxValidationState, string> = {
    default: '',
    error: 'text-red-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.states')}</h3>
      <div className="flex items-start gap-2">
        <Checkbox
          id={item.id}
          defaultChecked={item.checked}
          disabled={item.disabled}
          data-testid="factory-validation"
        />
        <div className="grid gap-1 leading-none">
          <Label htmlFor={item.id}>{item.label}</Label>
          {item.helperText && <p className="text-muted-foreground text-sm">{item.helperText}</p>}
          {item.errorMessage && (
            <p className={`text-sm ${stateColors[item.validationState]}`} data-testid="error-msg">
              {item.errorMessage}
            </p>
          )}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">Validation: {item.validationState}</p>
    </div>
  );
}

export const FactoryCheckboxWithValidation: Story = {
  name: i18n.t(
    'checkbox.storyName.factoryCheckboxWithValidation',
    'Factory: createFakeCheckboxWithValidation'
  ),
  render: () => <FactoryCheckboxWithValidationDemo />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="factory-validation"]');
    expect(checkbox).toBeInTheDocument();
    const errorMsg = canvasElement.querySelector('[data-testid="error-msg"]');
    expect(errorMsg).toBeInTheDocument();
  },
};

function FactoryTermsCheckboxDemo() {
  const terms: FakeTermsCheckbox = React.useMemo(() => createFakeTermsCheckbox(), []);
  const [checked, setChecked] = React.useState(terms.checked);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.variants')}</h3>
      <div className="flex items-start gap-2">
        <Checkbox
          id={terms.id}
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
          required={terms.required}
          data-testid="factory-terms"
        />
        <div className="grid gap-1 leading-none">
          <Label htmlFor={terms.id}>{terms.text}</Label>
          <p className="text-muted-foreground text-xs">
            <a href={terms.termsUrl} className="underline">
              Terms
            </a>{' '}
            |{' '}
            <a href={terms.privacyUrl} className="underline">
              Privacy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export const FactoryTermsCheckbox: Story = {
  name: i18n.t('checkbox.storyName.factoryTermsCheckbox', 'Factory: createFakeTermsCheckbox'),
  render: () => <FactoryTermsCheckboxDemo />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="factory-terms"]') as HTMLElement;
    expect(checkbox).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Terms')).toBeInTheDocument();
    expect(canvas.getByText('Privacy')).toBeInTheDocument();
    // Toggle the checkbox
    await userEvent.click(checkbox);
    await waitFor(() => {
      expect(checkbox.getAttribute('aria-checked')).toBe('true');
    });
  },
};

function FactoryPreferenceCheckboxDemo() {
  const pref: FakePreferenceCheckbox = React.useMemo(() => createFakePreferenceCheckbox(), []);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.variants')}</h3>
      <div className="flex items-start gap-2">
        <Checkbox id={pref.id} defaultChecked={pref.checked} data-testid="factory-preference" />
        <div className="grid gap-1 leading-none">
          <Label htmlFor={pref.id}>{pref.label}</Label>
          <p className="text-muted-foreground text-sm">{pref.description}</p>
          <span className="bg-muted rounded px-1.5 py-0.5 text-xs">{pref.category}</span>
        </div>
      </div>
    </div>
  );
}

export const FactoryPreferenceCheckbox: Story = {
  name: i18n.t(
    'checkbox.storyName.factoryPreferenceCheckbox',
    'Factory: createFakePreferenceCheckbox'
  ),
  render: () => <FactoryPreferenceCheckboxDemo />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="factory-preference"]');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox?.getAttribute('role')).toBe('checkbox');
  },
};

function FactoryFilterCheckboxDemo() {
  const filter: FakeFilterCheckbox = React.useMemo(() => createFakeFilterCheckbox(), []);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.variants')}</h3>
      <div className="flex items-center gap-2">
        <Checkbox id={filter.id} defaultChecked={filter.checked} data-testid="factory-filter" />
        <Label htmlFor={filter.id} className="flex items-center gap-2">
          {filter.label}
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
            {filter.count}
          </span>
        </Label>
      </div>
    </div>
  );
}

export const FactoryFilterCheckbox: Story = {
  name: i18n.t('checkbox.storyName.factoryFilterCheckbox', 'Factory: createFakeFilterCheckbox'),
  render: () => <FactoryFilterCheckboxDemo />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="factory-filter"]');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox?.getAttribute('role')).toBe('checkbox');
  },
};

// ============ FACTORY: BULK FACTORIES ============

function FactoryCheckboxGroupDemo() {
  const group: FakeCheckboxGroup = React.useMemo(
    () => createFakeCheckboxGroup({ layout: 'vertical' }),
    []
  );

  return (
    <div className="space-y-3" data-testid="factory-group">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.groups')}</h3>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{group.label}</legend>
        {group.description && <p className="text-muted-foreground text-sm">{group.description}</p>}
        <div className="flex flex-col gap-2">
          {group.options.map((opt) => (
            <div key={opt.id} className="flex items-start gap-2">
              <Checkbox
                id={opt.id}
                defaultChecked={opt.checked}
                disabled={group.disabled || opt.disabled}
              />
              <div className="grid gap-1 leading-none">
                <Label htmlFor={opt.id}>{opt.label}</Label>
                {opt.description && (
                  <p className="text-muted-foreground text-xs">{opt.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        {group.errorMessage && <p className="text-sm text-red-600">{group.errorMessage}</p>}
      </fieldset>
      <p className="text-muted-foreground text-xs">
        Layout: {group.layout} | Required: {String(group.required)} | ID: {group.id}
      </p>
    </div>
  );
}

export const FactoryCheckboxGroup: Story = {
  name: i18n.t('checkbox.storyName.factoryCheckboxGroup', 'Factory: createFakeCheckboxGroup'),
  render: () => <FactoryCheckboxGroupDemo />,
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('[data-testid="factory-group"]');
    expect(group).toBeInTheDocument();
    const checkboxes = canvasElement.querySelectorAll('[role="checkbox"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(3);
  },
};

function FactoryFilterCheckboxesDemo() {
  const filters: FakeFilterCheckbox[] = React.useMemo(() => createFakeFilterCheckboxes(6), []);

  return (
    <div className="space-y-3" data-testid="factory-filters">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.groups')}</h3>
      <div className="space-y-2">
        {filters.map((filter) => (
          <div key={filter.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox id={filter.id} defaultChecked={filter.checked} />
              <Label htmlFor={filter.id}>{filter.label}</Label>
            </div>
            <span className="text-muted-foreground text-xs">({filter.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryFilterCheckboxes: Story = {
  name: i18n.t('checkbox.storyName.factoryFilterCheckboxes', 'Factory: createFakeFilterCheckboxes'),
  render: () => <FactoryFilterCheckboxesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-filters"]');
    expect(container).toBeInTheDocument();
    const checkboxes = canvasElement.querySelectorAll('[role="checkbox"]');
    expect(checkboxes.length).toBe(6);
  },
};

function FactoryPreferenceGroupsDemo() {
  const groups: Record<string, FakePreferenceCheckbox[]> = React.useMemo(
    () => createFakePreferenceGroups(),
    []
  );

  return (
    <div className="space-y-6" data-testid="factory-pref-groups">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.groups')}</h3>
      {Object.entries(groups).map(([category, prefs]) => (
        <div key={category}>
          <h4 className="mb-2 text-sm font-medium">{category}</h4>
          <div className="ml-2 space-y-2">
            {prefs.map((pref) => (
              <div key={pref.id} className="flex items-start gap-2">
                <Checkbox id={pref.id} defaultChecked={pref.checked} />
                <div className="grid gap-1 leading-none">
                  <Label htmlFor={pref.id}>{pref.label}</Label>
                  <p className="text-muted-foreground text-xs">{pref.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryPreferenceGroups: Story = {
  name: i18n.t('checkbox.storyName.factoryPreferenceGroups', 'Factory: createFakePreferenceGroups'),
  render: () => <FactoryPreferenceGroupsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-pref-groups"]');
    expect(container).toBeInTheDocument();
    const checkboxes = canvasElement.querySelectorAll('[role="checkbox"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(CHECKBOX_PREFERENCE_CATEGORIES.length);
  },
};

// ============ FACTORY: SPECIALIZED FACTORIES ============

function TreeNodeComponent({ node }: { node: FakeCheckboxTreeNode }) {
  return (
    <div className="ml-4">
      <div className="flex items-center gap-2">
        <Checkbox id={node.id} checked={node.indeterminate ? 'indeterminate' : node.selected} />
        <Label htmlFor={node.id}>{node.label}</Label>
      </div>
      {node.expanded &&
        node.children?.map((child) => <TreeNodeComponent key={child.id} node={child} />)}
    </div>
  );
}

function FactoryCheckboxTreeDemo() {
  const { t } = useTranslation();
  const tree: FakeCheckboxTreeNode = React.useMemo(() => createFakeCheckboxTree(2, 3), []);

  return (
    <div className="space-y-3" data-testid="factory-tree">
      <h3 className="text-sm font-medium">{t('checkbox.section.groups')}</h3>
      <TreeNodeComponent node={tree} />
    </div>
  );
}

export const FactoryCheckboxTree: Story = {
  name: i18n.t('checkbox.storyName.factoryCheckboxTree', 'Factory: createFakeCheckboxTree'),
  render: () => <FactoryCheckboxTreeDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-tree"]');
    expect(container).toBeInTheDocument();
    const checkboxes = canvasElement.querySelectorAll('[role="checkbox"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(1);
  },
};

function FactoryNewsletterFormDemo() {
  const newsletter = React.useMemo(() => createFakeNewsletterForm(), []);

  return (
    <div className="space-y-6" data-testid="factory-newsletter">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.groups')}</h3>
      <div>
        <h4 className="mb-2 text-sm font-medium">
          {i18n.t('checkbox.story.categories', 'Categories')}
        </h4>
        <div className="space-y-2">
          {newsletter.categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2">
              <Checkbox id={`nl-${cat.id}`} defaultChecked={cat.checked} />
              <Label htmlFor={`nl-${cat.id}`}>{cat.label}</Label>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-medium">
          {i18n.t('checkbox.story.frequency', 'Frequency')}
        </h4>
        <div className="space-y-2">
          {newsletter.frequency.map((freq) => (
            <div key={freq.id} className="flex items-center gap-2">
              <Checkbox id={`nl-${freq.id}`} defaultChecked={freq.checked} />
              <Label htmlFor={`nl-${freq.id}`}>{freq.label}</Label>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id="nl-terms"
          defaultChecked={newsletter.terms.checked}
          required={newsletter.terms.required}
          data-testid="nl-terms"
        />
        <Label htmlFor="nl-terms">{newsletter.terms.text}</Label>
      </div>
    </div>
  );
}

export const FactoryNewsletterForm: Story = {
  name: i18n.t('checkbox.storyName.factoryNewsletterForm', 'Factory: createFakeNewsletterForm'),
  render: () => <FactoryNewsletterFormDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-newsletter"]');
    expect(container).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Categories')).toBeInTheDocument();
    expect(canvas.getByText('Frequency')).toBeInTheDocument();
    // 4 categories + 3 frequency + 1 terms = 8
    expect(canvasElement.querySelectorAll('[role="checkbox"]').length).toBe(8);
  },
};

function FactoryCookieConsentDemo() {
  const cookies: FakeCheckboxOption[] = React.useMemo(() => createFakeCookieConsent(), []);

  return (
    <div className="space-y-4" data-testid="factory-cookies">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.variants')}</h3>
      <div className="rounded-lg border p-4">
        <h4 className="mb-3 font-medium">
          {i18n.t('checkbox.story.cookiePreferences', 'Cookie Preferences')}
        </h4>
        <div className="space-y-3">
          {cookies.map((cookie) => (
            <div key={cookie.id} className="flex items-start gap-2">
              <Checkbox
                id={cookie.id}
                defaultChecked={cookie.checked}
                disabled={cookie.disabled}
                data-testid={`cookie-${cookie.id}`}
              />
              <div className="grid gap-1 leading-none">
                <Label htmlFor={cookie.id}>{cookie.label}</Label>
                {cookie.description && (
                  <p className="text-muted-foreground text-xs">{cookie.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryCookieConsent: Story = {
  name: i18n.t('checkbox.storyName.factoryCookieConsent', 'Factory: createFakeCookieConsent'),
  render: () => <FactoryCookieConsentDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-cookies"]');
    expect(container).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Essential cookies')).toBeInTheDocument();
    expect(canvas.getByText('Analytics cookies')).toBeInTheDocument();
    // Essential is disabled
    const essential = canvasElement.querySelector('[data-testid="cookie-essential"]');
    expect(essential).toBeDisabled();
    expect(canvasElement.querySelectorAll('[role="checkbox"]').length).toBe(4);
  },
};

function FactorySelectAllGroupDemo() {
  const data = React.useMemo(() => createFakeSelectAllGroup(4), []);
  const [items, setItems] = React.useState(data.children.map((c) => ({ ...c })));
  const [parent, setParent] = React.useState(data.parent);

  const updateParent = (newItems: FakeCheckboxOption[]) => {
    const checkedCount = newItems.filter((c) => c.checked).length;
    const allChecked = checkedCount === newItems.length;
    const someChecked = checkedCount > 0 && checkedCount < newItems.length;
    setParent((p) => ({
      ...p,
      checked: allChecked,
      indeterminate: someChecked,
    }));
  };

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      const newItems = items.map((item) => ({ ...item, checked }));
      setItems(newItems);
      updateParent(newItems);
    }
  };

  const handleItemChange = (id: string, checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      const newItems = items.map((item) => (item.id === id ? { ...item, checked } : item));
      setItems(newItems);
      updateParent(newItems);
    }
  };

  function getParentState(): boolean | 'indeterminate' {
    if (parent.indeterminate) return 'indeterminate';
    return parent.checked;
  }

  return (
    <div className="space-y-3" data-testid="factory-select-all">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.groups')}</h3>
      <div className="flex items-center gap-2">
        <Checkbox
          id="factory-parent"
          checked={getParentState()}
          onCheckedChange={handleSelectAll}
          data-testid="factory-parent-cb"
        />
        <Label htmlFor="factory-parent" className="font-medium">
          {parent.label} ({items.filter((i) => i.checked).length}/{items.length})
        </Label>
      </div>
      <div className="ml-6 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Checkbox
              id={`fsa-${item.id}`}
              checked={item.checked}
              onCheckedChange={(c) => handleItemChange(item.id, c)}
            />
            <Label htmlFor={`fsa-${item.id}`}>{item.label}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactorySelectAllGroup: Story = {
  name: i18n.t('checkbox.storyName.factorySelectAllGroup', 'Factory: createFakeSelectAllGroup'),
  render: () => <FactorySelectAllGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-select-all"]');
    expect(container).toBeInTheDocument();
    const parentCb = canvasElement.querySelector(
      '[data-testid="factory-parent-cb"]'
    ) as HTMLElement;
    expect(parentCb).toBeInTheDocument();
    // parent + 4 children = 5
    expect(canvasElement.querySelectorAll('[role="checkbox"]').length).toBe(5);
    // Click select all
    await userEvent.click(parentCb);
    await waitFor(() => {
      expect(parentCb.getAttribute('aria-checked')).toBe('true');
    });
  },
};

// ============ FACTORY: MATRIX FACTORIES ============

function FactoryCheckboxMatrixDemo() {
  const { t } = useTranslation();
  const matrix = React.useMemo(() => createFakeCheckboxMatrix(), []);

  return (
    <div className="space-y-3" data-testid="factory-matrix">
      <h3 className="text-sm font-medium">{t('checkbox.section.states')}</h3>
      <div className="overflow-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left">{t('checkbox.story.state', 'State')}</th>
              <th className="p-2 text-left">{t('checkbox.story.size', 'Size')}</th>
              <th className="p-2 text-left">{t('checkbox.story.disabled', 'Disabled')}</th>
              <th className="p-2 text-left">{t('checkbox.story.checkbox', 'Checkbox')}</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => {
              const key = `${row.state}-${row.size}-${String(row.disabled)}`;
              return (
                <tr key={key}>
                  <td className="p-2">{row.state}</td>
                  <td className="p-2">{row.size}</td>
                  <td className="p-2">{String(row.disabled)}</td>
                  <td className="p-2">
                    <Checkbox
                      id={`matrix-${key}`}
                      className={CHECKBOX_SIZE_CLASSES[row.size]}
                      checked={stateToChecked(row.state)}
                      disabled={row.disabled}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const FactoryCheckboxMatrix: Story = {
  name: i18n.t('checkbox.storyName.factoryCheckboxMatrix', 'Factory: createFakeCheckboxMatrix'),
  render: () => <FactoryCheckboxMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-matrix"]');
    expect(container).toBeInTheDocument();
    // 3 states x 3 sizes x 2 disabled = 18
    expect(canvasElement.querySelectorAll('[role="checkbox"]').length).toBe(18);
  },
};

function FactoryValidationMatrixDemo() {
  const items: FakeCheckboxWithValidation[] = React.useMemo(
    () => createFakeCheckboxValidationMatrix(),
    []
  );

  const stateColors: Record<CheckboxValidationState, string> = {
    default: '',
    error: 'text-red-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
  };

  return (
    <div className="space-y-4" data-testid="factory-val-matrix">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.states')}</h3>
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-2">
          <Checkbox id={item.id} defaultChecked={item.checked} disabled={item.disabled} />
          <div className="grid gap-1 leading-none">
            <Label htmlFor={item.id} className={stateColors[item.validationState]}>
              {item.label}
            </Label>
            {item.helperText && <p className="text-muted-foreground text-xs">{item.helperText}</p>}
            {item.errorMessage && (
              <p className={`text-xs ${stateColors[item.validationState]}`}>{item.errorMessage}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryValidationMatrix: Story = {
  name: i18n.t(
    'checkbox.storyName.factoryValidationMatrix',
    'Factory: createFakeCheckboxValidationMatrix'
  ),
  render: () => <FactoryValidationMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-val-matrix"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[role="checkbox"]').length).toBe(
      CHECKBOX_VALIDATION_STATES.length
    );
  },
};

// ============ FACTORY: SHOWCASE ============

function FactoryShowcaseDemo() {
  const showcase = React.useMemo(() => createFakeCheckboxShowcase(), []);

  return (
    <div className="space-y-8" data-testid="factory-showcase">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.variants')}</h3>

      {/* Single */}
      <section>
        <h4 className="mb-2 text-sm font-medium">
          {i18n.t('checkbox.story.singleOption', 'Single Option')}
        </h4>
        <div className="flex items-center gap-2">
          <Checkbox id={showcase.single.id} defaultChecked={showcase.single.checked} />
          <Label htmlFor={showcase.single.id}>{showcase.single.label}</Label>
        </div>
      </section>

      {/* Group */}
      <section>
        <h4 className="mb-2 text-sm font-medium">Group: {showcase.group.label}</h4>
        <div className="space-y-2">
          {showcase.group.options.slice(0, 3).map((opt) => (
            <div key={opt.id} className="flex items-center gap-2">
              <Checkbox id={`sc-${opt.id}`} defaultChecked={opt.checked} />
              <Label htmlFor={`sc-${opt.id}`}>{opt.label}</Label>
            </div>
          ))}
        </div>
      </section>

      {/* Terms */}
      <section>
        <h4 className="mb-2 text-sm font-medium">{i18n.t('checkbox.story.terms', 'Terms')}</h4>
        <div className="flex items-center gap-2">
          <Checkbox id={showcase.terms.id} defaultChecked={showcase.terms.checked} />
          <Label htmlFor={showcase.terms.id}>{showcase.terms.text}</Label>
        </div>
      </section>

      {/* Filter list */}
      <section>
        <h4 className="mb-2 text-sm font-medium">{i18n.t('checkbox.story.filters', 'Filters')}</h4>
        <div className="space-y-1">
          {showcase.filterList.slice(0, 4).map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <Checkbox id={`sc-f-${f.id}`} defaultChecked={f.checked} />
              <Label htmlFor={`sc-f-${f.id}`}>
                {f.label} ({f.count})
              </Label>
            </div>
          ))}
        </div>
      </section>

      {/* Cookie consent */}
      <section>
        <h4 className="mb-2 text-sm font-medium">
          {i18n.t('checkbox.story.cookieConsent', 'Cookie Consent')}
        </h4>
        <div className="space-y-1">
          {showcase.cookieConsent.slice(0, 3).map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <Checkbox id={`sc-c-${c.id}`} defaultChecked={c.checked} disabled={c.disabled} />
              <Label htmlFor={`sc-c-${c.id}`}>{c.label}</Label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export const FactoryCheckboxShowcase: Story = {
  name: i18n.t('checkbox.storyName.factoryCheckboxShowcase', 'Factory: createFakeCheckboxShowcase'),
  render: () => <FactoryShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-showcase"]');
    expect(container).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Single Option')).toBeInTheDocument();
    expect(canvas.getByText('Terms')).toBeInTheDocument();
    expect(canvas.getByText('Filters')).toBeInTheDocument();
    const checkboxes = canvasElement.querySelectorAll('[role="checkbox"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(5);
  },
};

// ============ FACTORY: ENTERPRISE FEATURES ============

function FactoryAsyncCheckboxDemo() {
  const asyncCb: FakeAsyncCheckbox = React.useMemo(
    () => createFakeAsyncCheckbox({ asyncStatus: 'idle' }),
    []
  );
  const [status, setStatus] = React.useState(asyncCb.asyncStatus);
  const [checked, setChecked] = React.useState(asyncCb.checked);

  const handleChange = async (value: boolean | 'indeterminate') => {
    if (typeof value === 'boolean') {
      setStatus('loading');
      setChecked(value);
      await new Promise((resolve) => setTimeout(resolve, 800));
      setStatus('success');
    }
  };

  return (
    <div className="space-y-3" data-testid="factory-async">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.variants')}</h3>
      <div className="flex items-start gap-2">
        <Checkbox
          id={asyncCb.id}
          checked={checked}
          onCheckedChange={handleChange}
          disabled={status === 'loading'}
          data-testid="factory-async-cb"
        />
        <div className="grid gap-1 leading-none">
          <Label htmlFor={asyncCb.id} className="flex items-center gap-2">
            {asyncCb.label}
            {status === 'loading' && (
              <LoaderIcon className="text-muted-foreground size-3 animate-spin" />
            )}
            {status === 'success' && <CheckCircleIcon className="size-3 text-green-600" />}
            {status === 'error' && <XCircleIcon className="size-3 text-red-600" />}
          </Label>
          <p className="text-muted-foreground text-xs">Status: {status}</p>
          {asyncCb.asyncError && status === 'error' && (
            <p className="text-xs text-red-600">{asyncCb.asyncError}</p>
          )}
          {asyncCb.retryCount !== undefined && (
            <p className="text-muted-foreground text-xs">Retries: {asyncCb.retryCount}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export const FactoryAsyncCheckbox: Story = {
  name: i18n.t('checkbox.storyName.factoryAsyncCheckbox', 'Factory: createFakeAsyncCheckbox'),
  render: () => <FactoryAsyncCheckboxDemo />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector('[data-testid="factory-async-cb"]') as HTMLElement;
    expect(checkbox).toBeInTheDocument();
    // Click to trigger async
    await userEvent.click(checkbox);
    // Should be loading
    await waitFor(() => {
      expect(checkbox).toBeDisabled();
    });
    // Wait for success
    await waitFor(
      () => {
        expect(checkbox).not.toBeDisabled();
      },
      { timeout: 2000 }
    );
  },
};

function FactoryTrackedCheckboxDemo() {
  const tracked: FakeTrackedCheckbox = React.useMemo(() => createFakeTrackedCheckbox(), []);
  const [events, setEvents] = React.useState<string[]>([]);

  const handleChange = (value: boolean | 'indeterminate') => {
    if (typeof value === 'boolean') {
      setEvents((prev) => [
        ...prev,
        `${tracked.eventName} - ${value ? 'checked' : 'unchecked'} (${tracked.trackingId})`,
      ]);
    }
  };

  return (
    <div className="space-y-3" data-testid="factory-tracked">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.variants')}</h3>
      <div className="flex items-start gap-2">
        <Checkbox
          id={tracked.id}
          defaultChecked={tracked.checked}
          onCheckedChange={handleChange}
          data-testid="factory-tracked-cb"
        />
        <div className="grid gap-1 leading-none">
          <Label htmlFor={tracked.id}>{tracked.label}</Label>
          <p className="text-muted-foreground text-xs">
            Tracking: {tracked.trackingId} | Event: {tracked.eventName}
          </p>
          {tracked.trackingMeta && (
            <p className="text-muted-foreground text-xs">
              Meta: {JSON.stringify(tracked.trackingMeta)}
            </p>
          )}
        </div>
      </div>
      {events.length > 0 && (
        <div className="space-y-1" data-testid="tracked-events">
          <p className="text-xs font-medium">Events:</p>
          {events.map((evt) => (
            <p key={evt} className="text-muted-foreground text-xs">
              {evt}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export const FactoryTrackedCheckbox: Story = {
  name: i18n.t('checkbox.storyName.factoryTrackedCheckbox', 'Factory: createFakeTrackedCheckbox'),
  render: () => <FactoryTrackedCheckboxDemo />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector(
      '[data-testid="factory-tracked-cb"]'
    ) as HTMLElement;
    expect(checkbox).toBeInTheDocument();
    // Click to generate event
    await userEvent.click(checkbox);
    await waitFor(() => {
      const events = canvasElement.querySelector('[data-testid="tracked-events"]');
      expect(events).toBeInTheDocument();
    });
  },
};

function FactoryAccessibleCheckboxDemo() {
  const accessible: FakeAccessibleCheckbox = React.useMemo(
    () =>
      createFakeAccessibleCheckbox({
        announceChanges: true,
        changeAnnouncement: 'Setting updated',
      }),
    []
  );
  const [announcement, setAnnouncement] = React.useState<string>('');

  const handleChange = (value: boolean | 'indeterminate') => {
    if (typeof value === 'boolean' && accessible.announceChanges && accessible.changeAnnouncement) {
      setAnnouncement(accessible.changeAnnouncement);
    }
  };

  return (
    <div className="space-y-3" data-testid="factory-accessible">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.a11y.label')}</h3>
      <div className="flex items-start gap-2">
        <Checkbox
          id={accessible.id}
          defaultChecked={accessible.checked}
          aria-label={accessible.ariaLabel}
          aria-describedby={accessible.ariaDescription ? `desc-${accessible.id}` : undefined}
          onCheckedChange={handleChange}
          data-testid="factory-accessible-cb"
        />
        <div className="grid gap-1 leading-none">
          <Label htmlFor={accessible.id}>{accessible.label}</Label>
          {accessible.ariaDescription && (
            <p id={`desc-${accessible.id}`} className="text-muted-foreground text-xs">
              {accessible.ariaDescription}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Announces: {String(accessible.announceChanges)}
          </p>
        </div>
      </div>
      {announcement && (
        <div role="status" aria-live="polite" data-testid="a11y-announcement" className="text-xs">
          {announcement}
        </div>
      )}
    </div>
  );
}

export const FactoryAccessibleCheckbox: Story = {
  name: i18n.t(
    'checkbox.storyName.factoryAccessibleCheckbox',
    'Factory: createFakeAccessibleCheckbox'
  ),
  render: () => <FactoryAccessibleCheckboxDemo />,
  play: async ({ canvasElement }) => {
    const checkbox = canvasElement.querySelector(
      '[data-testid="factory-accessible-cb"]'
    ) as HTMLElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.getAttribute('role')).toBe('checkbox');
    // Click to trigger announcement
    await userEvent.click(checkbox);
    await waitFor(() => {
      const announcement = canvasElement.querySelector('[data-testid="a11y-announcement"]');
      expect(announcement).toBeInTheDocument();
    });
  },
};

function FactoryEnterpriseSetDemo() {
  const set = React.useMemo(() => createFakeEnterpriseCheckboxSet(), []);

  return (
    <div className="space-y-6" data-testid="factory-enterprise">
      <h3 className="text-sm font-medium">{i18n.t('checkbox.section.variants')}</h3>

      {/* Async */}
      <section>
        <h4 className="mb-2 text-sm font-medium">
          {i18n.t('checkbox.story.asyncCheckbox', 'Async Checkbox')}
        </h4>
        <div className="flex items-start gap-2">
          <Checkbox
            id={set.async.id}
            defaultChecked={set.async.checked}
            data-testid="enterprise-async"
          />
          <div className="grid gap-1 leading-none">
            <Label htmlFor={set.async.id}>{set.async.label}</Label>
            <p className="text-muted-foreground text-xs">Status: {set.async.asyncStatus}</p>
          </div>
        </div>
      </section>

      {/* Tracked */}
      <section>
        <h4 className="mb-2 text-sm font-medium">
          {i18n.t('checkbox.story.trackedCheckbox', 'Tracked Checkbox')}
        </h4>
        <div className="flex items-start gap-2">
          <Checkbox
            id={set.tracked.id}
            defaultChecked={set.tracked.checked}
            data-testid="enterprise-tracked"
          />
          <div className="grid gap-1 leading-none">
            <Label htmlFor={set.tracked.id}>{set.tracked.label}</Label>
            <p className="text-muted-foreground text-xs">
              Event: {set.tracked.eventName} | Tracking: {set.tracked.trackingId}
            </p>
          </div>
        </div>
      </section>

      {/* Accessible */}
      <section>
        <h4 className="mb-2 text-sm font-medium">
          {i18n.t('checkbox.story.accessibleCheckbox1', 'Accessible Checkbox')}
        </h4>
        <div className="flex items-start gap-2">
          <Checkbox
            id={set.accessible.id}
            defaultChecked={set.accessible.checked}
            aria-label={set.accessible.ariaLabel}
            data-testid="enterprise-accessible"
          />
          <div className="grid gap-1 leading-none">
            <Label htmlFor={set.accessible.id}>{set.accessible.label}</Label>
            <p className="text-muted-foreground text-xs">
              Announces: {String(set.accessible.announceChanges)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export const FactoryEnterpriseSet: Story = {
  name: i18n.t(
    'checkbox.storyName.factoryEnterpriseSet',
    'Factory: createFakeEnterpriseCheckboxSet'
  ),
  render: () => <FactoryEnterpriseSetDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="factory-enterprise"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="enterprise-async"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="enterprise-tracked"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-testid="enterprise-accessible"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[role="checkbox"]').length).toBe(3);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS STORIES (auto-wired)
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: checkboxStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadRequest: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerBadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: checkboxStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnauthorized: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerUnauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: checkboxStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerForbidden: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerForbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: checkboxStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: checkboxStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: checkboxStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerUnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: checkboxStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerInternalServerError: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerInternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: checkboxStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerLoading: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerLoading', 'Handler: Loading'),
  parameters: { msw: { handlers: checkboxStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: checkboxStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerVerySlowResponse: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerVerySlowResponse', 'Handler: Very Slow Response'),
  parameters: { msw: { handlers: checkboxStatusHandlers.verySlowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNetworkError: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerNetworkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: checkboxStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTermsRequired: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerTermsRequired', 'Handler: Terms Required'),
  parameters: { msw: { handlers: checkboxStatusHandlers.termsRequired } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTermsExpired: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerTermsExpired', 'Handler: Terms Expired'),
  parameters: { msw: { handlers: checkboxStatusHandlers.termsExpired } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCookieConsentRequired: Story = {
  ...Default,
  name: i18n.t(
    'checkbox.storyName.handlerCookieConsentRequired',
    'Handler: Cookie Consent Required'
  ),
  parameters: { msw: { handlers: checkboxStatusHandlers.cookieConsentRequired } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBulkUpdateSuccess: Story = {
  ...Default,
  name: i18n.t('checkbox.storyName.handlerBulkUpdateSuccess', 'Handler: Bulk Update Success'),
  parameters: { msw: { handlers: checkboxStatusHandlers.bulkUpdateSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBulkUpdatePartialFailure: Story = {
  ...Default,
  name: i18n.t(
    'checkbox.storyName.handlerBulkUpdatePartialFailure',
    'Handler: Bulk Update Partial Failure'
  ),
  parameters: { msw: { handlers: checkboxStatusHandlers.bulkUpdatePartialFailure } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
