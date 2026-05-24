import type { Meta, StoryObj } from '@storybook/react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, within } from 'storybook/test';

import {
  CONTROL_TYPE_INPUT_MAP,
  createFakeAddressForm,
  createFakeCheckboxField,
  createFakeCheckboxFields,
  createFakeContactForm,
  createFakeFormField,
  createFakeFormFieldControlTypeMatrix,
  createFakeFormFields,
  createFakeFormSection,
  createFakeFormSections,
  createFakeLabel,
  createFakeLabelA11yConfig,
  createFakeLabelContextMatrix,
  createFakeLabelForContext,
  createFakeLabelRequirementMatrix,
  createFakeLabels,
  createFakeLabelShowcase,
  createFakeLabelSizeMatrix,
  createFakeLabelStateMatrix,
  createFakeLoginForm,
  createFakePaymentForm,
  createFakeProfileForm,
  createFakeRadioGroup,
  createFakeRadioOption,
  createFakeRegistrationForm,
  createFakeSettingsPreferences,
  createFakeSwitchField,
  createFakeSwitchFields,
  LABEL_CONTEXTS,
  LABEL_CONTROL_TYPES,
  LABEL_POSITIONS,
  LABEL_REQUIREMENTS,
  LABEL_SIZE_CLASSES,
  LABEL_SIZES,
  LABEL_STATES,
  LABEL_TEXTS,
  REQUIRED_INDICATOR_STYLES,
} from '@/.storybook/stories/_factories/label.factory';
import type {
  FakeCheckboxField,
  FakeFormField,
  FakeFormSection,
  FakeLabel,
  FakeLabelA11yConfig,
  FakeRadioGroup,
  FakeRadioOption,
  FakeSwitchField,
  LabelContext,
  LabelControlType,
  LabelPosition,
  LabelRequirement,
  LabelSize,
  LabelState,
  RequiredIndicatorStyle,
} from '@/.storybook/stories/_factories/label.factory';
import { labelHandlers, labelStatusHandlers } from '@/.storybook/stories/_handlers/label.handlers';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function I18nLabelWithInputDemo() {
  const { t } = useTranslation();

  return (
    <div className="w-[360px] space-y-4" data-testid="label-with-input-demo">
      <div className="space-y-2">
        <Label htmlFor="email">{t('input.states.emailLabel')}</Label>
        <Input defaultValue="ada@example.com" id="email" type="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="disabled">{t('input.states.disabledLabel')}</Label>
        <Input disabled id="disabled" placeholder={t('input.states.disabledPlaceholder')} />
      </div>
    </div>
  );
}

function LabelWithRequiredDemo() {
  const { t } = useTranslation();
  return (
    <div className="w-[360px] space-y-2" data-testid="label-with-required-demo">
      <Label htmlFor="required">
        {t('label.story.emailAddress', 'Email Address')} <span className="text-destructive">*</span>
      </Label>
      <Input
        id="required"
        type="email"
        placeholder={i18n.t('label.story.emailPlaceholder', 'name@example.com')}
        required
      />
    </div>
  );
}

function LabelWithOptionalDemo() {
  const { t } = useTranslation();
  return (
    <div className="w-[360px] space-y-2" data-testid="label-with-optional-demo">
      <Label htmlFor="optional">
        {t('label.story.phoneNumber', 'Phone Number')}{' '}
        <span className="text-muted-foreground">({t('label.story.optional', 'optional')})</span>
      </Label>
      <Input
        id="optional"
        type="tel"
        placeholder={t('label.story.phonePlaceholder', '+1 (555) 000-0000')}
      />
    </div>
  );
}

function LabelWithDescriptionDemo() {
  const { t } = useTranslation();
  return (
    <div className="w-[360px] space-y-2" data-testid="label-with-description-demo">
      <Label htmlFor="username">{t('label.story.username', 'Username')}</Label>
      <Input id="username" placeholder={i18n.t('label.story.usernamePlaceholder', 'johndoe')} />
      <p className="text-muted-foreground text-sm">
        {t('label.story.thisIsYourPublicDisplayName.', 'This is your public display name.')}
      </p>
    </div>
  );
}

function LabelWithCheckboxDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2" data-testid="label-with-checkbox-demo">
      <Checkbox id="terms" />
      <Label htmlFor="terms">
        {t('label.story.acceptTermsAndConditions', 'Accept terms and conditions')}
      </Label>
    </div>
  );
}

function LabelWithSwitchDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2" data-testid="label-with-switch-demo">
      <Switch id="airplane" />
      <Label htmlFor="airplane">{t('label.story.airplaneMode', 'Airplane Mode')}</Label>
    </div>
  );
}

function DisabledLabelDemo() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4" data-testid="disabled-label-demo">
      <div className="flex items-center gap-2">
        <Checkbox id="disabled-checkbox" disabled />
        <Label htmlFor="disabled-checkbox" className="text-muted-foreground">
          {t('label.story.disabledLabel', 'Disabled checkbox')}
        </Label>
      </div>
      <div className="w-[360px] space-y-2">
        <Label htmlFor="disabled-input" className="text-muted-foreground">
          {t('label.story.disabledLabel', 'Disabled input')}
        </Label>
        <Input
          id="disabled-input"
          disabled
          placeholder={i18n.t('label.story.cannotEdit', 'Cannot edit')}
        />
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Label',
  component: Label,
  tags: ['autodocs'],
  args: {
    children: i18n.t('label.story.label', 'Label'),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // Content
    children: {
      control: 'text',
      description: i18n.t(
        'label.argType.labelContentTextOrReactNode',
        'Label content (text or React node)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    // HTML
    htmlFor: {
      control: 'text',
      description: i18n.t(
        'label.argType.idOfTheElementTheLabelIsFor',
        'ID of the element the label is for'
      ),
      table: {
        category: 'HTML',
        type: { summary: 'string' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t('label.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('label.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('label.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('label.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('label.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('label.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    // Layout
    asChild: {
      control: 'boolean',
      description: i18n.t(
        'label.argType.renderAsChildElementUsingSlotPattern',
        'Render as child element using Slot pattern'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
  },
  parameters: {
    msw: { handlers: labelHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => <Label {...args}>{args.children}</Label>,
  play: async ({ canvasElement }) => {
    const label = canvasElement.querySelector('[data-slot="label"]');
    expect(label).toBeInTheDocument();
  },
};

function LabelVariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('label.variants.basic')}</p>
        <Label>{i18n.t('label.story.standardLabelText', 'Standard label text')}</Label>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('label.variants.required')}</p>
        <Label>
          {i18n.t('label.story.emailAddress', 'Email Address')}{' '}
          <span className="text-destructive">*</span>
        </Label>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('label.variants.optional')}</p>
        <Label>
          {i18n.t('label.story.phoneNumber', 'Phone Number')}{' '}
          <span className="text-muted-foreground">
            ({i18n.t('label.story.optional', 'optional')})
          </span>
        </Label>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('label.variants.withInput')}</p>
        <div className="w-[280px] space-y-2">
          <Label htmlFor="variant-input">{i18n.t('label.story.username', 'Username')}</Label>
          <Input
            id="variant-input"
            placeholder={i18n.t('label.story.enterText', 'Enter username')}
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('label.variants.withCheckbox')}</p>
        <div className="flex items-center gap-2">
          <Checkbox id="variant-checkbox" />
          <Label htmlFor="variant-checkbox">
            {i18n.t('label.story.acceptTermsAndConditions', 'Accept terms and conditions')}
          </Label>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('label.variants.withSwitch')}</p>
        <div className="flex items-center gap-2">
          <Switch id="variant-switch" />
          <Label htmlFor="variant-switch">
            {i18n.t('label.story.enableNotifications', 'Enable notifications')}
          </Label>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('label.variants.disabled')}</p>
        <div className="flex items-center gap-2">
          <Checkbox id="variant-disabled" disabled />
          <Label htmlFor="variant-disabled" className="text-muted-foreground">
            Disabled option
          </Label>
        </div>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <LabelVariantsDemo />,
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);

    const requiredIndicator = canvasElement.querySelector('.text-destructive');
    expect(requiredIndicator?.textContent).toBe('*');

    const optionalIndicator = canvasElement.querySelector('.text-muted-foreground');
    expect(optionalIndicator?.textContent).toContain('optional');
  },
};

function LabelSizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('label.sizes.extraSmall')}</p>
        <Label className="text-xs">
          {i18n.t('label.story.extraSmallLabel', 'Extra small label')}
        </Label>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('label.sizes.small')}</p>
        <Label>{i18n.t('label.story.defaultSmallLabel', 'Default small label')}</Label>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('label.sizes.base')}</p>
        <Label className="text-base">
          {i18n.t('label.story.baseSizeLabel', 'Base size label')}
        </Label>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('label.sizes.large')}</p>
        <Label className="text-lg">{i18n.t('label.story.largeLabel', 'Large label')}</Label>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('label.sizes.withDifferentInputSizes')}</p>
        <div className="flex flex-col gap-4">
          <div className="w-[200px] space-y-1">
            <Label className="text-xs">{i18n.t('label.story.compactField', 'Compact field')}</Label>
            <Input
              className="h-8 text-xs"
              placeholder={i18n.t('label.story.smallInput', 'Small input')}
            />
          </div>
          <div className="w-[280px] space-y-2">
            <Label>{i18n.t('label.story.defaultField', 'Default field')}</Label>
            <Input placeholder={i18n.t('label.story.defaultInput', 'Default input')} />
          </div>
          <div className="w-[360px] space-y-2">
            <Label className="text-base">{i18n.t('label.story.largeField', 'Large field')}</Label>
            <Input
              className="h-12 text-base"
              placeholder={i18n.t('label.story.largeInput', 'Large input')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <LabelSizesDemo />,
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);

    const xsLabel = canvasElement.querySelector('.text-xs');
    expect(xsLabel).toBeInTheDocument();

    const lgLabel = canvasElement.querySelector('.text-lg');
    expect(lgLabel).toBeInTheDocument();
  },
};

export const WithInput: Story = {
  render: () => <I18nLabelWithInputDemo />,
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBe(2);

    const emailInput = canvasElement.querySelector('input#email') as HTMLInputElement;
    expect(emailInput?.value).toBe('ada@example.com');

    const disabledInput = canvasElement.querySelector('input#disabled') as HTMLInputElement;
    expect(disabledInput).toBeDisabled();
  },
};

export const WithCheckbox: Story = {
  render: () => <LabelWithCheckboxDemo />,
  play: async ({ canvasElement }) => {
    const label = canvasElement.querySelector('label[for="terms"]');
    const checkbox = canvasElement.querySelector('#terms');

    expect(label?.getAttribute('data-slot')).toBe('label');
    expect(checkbox?.getAttribute('data-slot')).toBe('checkbox');

    // Click on label should toggle checkbox
    if (label) {
      await userEvent.click(label);
    }
    expect(checkbox?.getAttribute('data-state')).toBe('checked');
  },
};

export const WithSwitch: Story = {
  render: () => <LabelWithSwitchDemo />,
  play: async ({ canvasElement }) => {
    const label = canvasElement.querySelector('label[for="airplane"]');
    const switchElement = canvasElement.querySelector('#airplane');

    expect(label?.getAttribute('data-slot')).toBe('label');
    expect(switchElement?.getAttribute('data-slot')).toBe('switch');

    // Click on label should toggle switch
    if (label) {
      await userEvent.click(label);
    }
    expect(switchElement?.getAttribute('data-state')).toBe('checked');
  },
};

export const Required: Story = {
  render: () => <LabelWithRequiredDemo />,
  play: async ({ canvasElement }) => {
    const requiredIndicator = canvasElement.querySelector('.text-destructive');
    expect(requiredIndicator?.textContent).toBe('*');

    const input = canvasElement.querySelector('#required') as HTMLInputElement;
    expect(input).toBeRequired();
    expect(input?.type).toBe('email');
  },
};

export const Optional: Story = {
  render: () => <LabelWithOptionalDemo />,
  play: async ({ canvasElement }) => {
    const optionalIndicator = canvasElement.querySelector('.text-muted-foreground');
    expect(optionalIndicator?.textContent).toContain('optional');

    const input = canvasElement.querySelector('#optional') as HTMLInputElement;
    expect(input).not.toBeRequired();
    expect(input?.type).toBe('tel');
  },
};

export const WithDescription: Story = {
  render: () => <LabelWithDescriptionDemo />,
  play: async ({ canvasElement }) => {
    const label = canvasElement.querySelector('label[for="username"]');
    expect(label).toBeInTheDocument();

    const description = canvasElement.querySelector('.text-muted-foreground.text-sm');
    expect(description?.textContent).toBe('This is your public display name.');

    const input = canvasElement.querySelector('#username') as HTMLInputElement;
    expect(input?.placeholder).toBe('johndoe');
  },
};

export const Disabled: Story = {
  render: () => <DisabledLabelDemo />,
  play: async ({ canvasElement }) => {
    const disabledCheckbox = canvasElement.querySelector('#disabled-checkbox');
    expect(disabledCheckbox).toBeDisabled();

    const disabledInput = canvasElement.querySelector('#disabled-input') as HTMLInputElement;
    expect(disabledInput).toBeDisabled();

    const labels = canvasElement.querySelectorAll('.text-muted-foreground');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const FormExample: Story = {
  render: () => (
    <form className="w-[360px] space-y-4">
      <div className="space-y-2">
        <Label htmlFor="form-name">
          Full Name <span className="text-destructive">*</span>
        </Label>
        <Input id="form-name" placeholder={i18n.t('label.story.johnDoe', 'John Doe')} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="form-email">
          Email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="form-email"
          type="email"
          placeholder={i18n.t('label.story.emailExample', 'john@example.com')}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="form-phone">
          Phone <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="form-phone"
          type="tel"
          placeholder={i18n.t('label.story.phonePlaceholder', '+1 (555) 000-0000')}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="form-terms" required />
        <Label htmlFor="form-terms">
          I accept the terms <span className="text-destructive">*</span>
        </Label>
      </div>
    </form>
  ),
  play: async ({ canvasElement }) => {
    const requiredInputs = canvasElement.querySelectorAll('input[required]');
    expect(requiredInputs.length).toBeGreaterThan(0);

    const nameInput = canvasElement.querySelector('#form-name') as HTMLInputElement;
    expect(nameInput).toBeRequired();

    const emailInput = canvasElement.querySelector('#form-email') as HTMLInputElement;
    expect(emailInput).toBeRequired();
    expect(emailInput?.type).toBe('email');

    const phoneInput = canvasElement.querySelector('#form-phone') as HTMLInputElement;
    expect(phoneInput).not.toBeRequired();

    const requiredIndicators = canvasElement.querySelectorAll('.text-destructive');
    expect(requiredIndicators.length).toBeGreaterThan(0);
  },
};

export const Default: Story = {
  ...WithInput,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBe(2);

    const emailLabel = canvasElement.querySelector('label[for="email"]');
    if (!(emailLabel instanceof HTMLElement)) {
      throw new Error('Email label was not found.');
    }
    expect(emailLabel.textContent?.trim()).not.toBe('');

    const emailInput = canvasElement.querySelector('input#email');
    if (!(emailInput instanceof HTMLInputElement)) {
      throw new Error('Email input was not found.');
    }

    expect(emailInput.type).toBe('email');
    expect(emailInput.value).toBe('ada@example.com');

    await userEvent.click(emailLabel);
    expect(doc.activeElement).toBe(emailInput);

    emailInput.setSelectionRange(emailInput.value.length, emailInput.value.length);
    await userEvent.type(emailInput, 'x');
    expect(emailInput.value).toBe('ada@example.comx');

    const disabledLabel = canvasElement.querySelector('label[for="disabled"]');
    if (!(disabledLabel instanceof HTMLElement)) {
      throw new Error('Disabled label was not found.');
    }
    expect(disabledLabel.textContent?.trim()).not.toBe('');

    const disabledInput = canvasElement.querySelector('input#disabled');
    if (!(disabledInput instanceof HTMLInputElement)) {
      throw new Error('Disabled input was not found.');
    }

    expect(disabledInput).toBeDisabled();
    expect(disabledInput.placeholder.trim()).not.toBe('');
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
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

    const emailLabel = canvasElement.querySelector('label[for="email"]');
    if (!(emailLabel instanceof HTMLElement)) {
      throw new Error('Email label was not found.');
    }
    expect(emailLabel.textContent?.trim()).toBe('メール');

    const disabledLabel = canvasElement.querySelector('label[for="disabled"]');
    if (!(disabledLabel instanceof HTMLElement)) {
      throw new Error('Disabled label was not found.');
    }
    expect(disabledLabel.textContent?.trim()).toBe('無効化');

    const disabledInput = canvasElement.querySelector('input#disabled');
    if (!(disabledInput instanceof HTMLInputElement)) {
      throw new Error('Disabled input was not found.');
    }
    expect(disabledInput.placeholder).toBe('無効…');

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
  name: i18n.t('label.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: labelHandlers },
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: labelStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: labelStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: labelStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: labelStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: labelStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: labelStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: labelStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('label.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: labelStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('label.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: labelStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('label.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  ...Default,
  parameters: {
    msw: { handlers: labelStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('label.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: labelStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const SlowResponse: Story = {
  name: i18n.t('label.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: labelStatusHandlers.slowSubmission },
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBeGreaterThan(0);
  },
};

export const EmptyData: Story = {
  name: i18n.t('label.storyName.emptyData', 'Empty Data'),
  render: () => (
    <div className="w-[360px] space-y-4" data-testid="label-empty" data-state="empty">
      <div className="space-y-2">
        <Label htmlFor="empty-email">{i18n.t('label.story.emailAddress', 'Email Address')}</Label>
        <Input
          id="empty-email"
          type="email"
          placeholder={i18n.t('label.story.noDataEntered', 'No data entered')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="empty-name">{i18n.t('label.story.name', 'Name')}</Label>
        <Input
          id="empty-name"
          placeholder={i18n.t('label.story.noDataEntered', 'No data entered')}
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="label-empty"]')).toBeInTheDocument();
    const inputs = canvasElement.querySelectorAll('input');
    for (const input of inputs) {
      expect((input as HTMLInputElement).value).toBe('');
    }
  },
};

export const WithFakerData: Story = {
  name: i18n.t('label.storyName.withFakerData', 'With Faker Data'),
  render: () => {
    const fakeLabels = createFakeLabels(5);

    return (
      <div className="w-[360px] space-y-4" data-testid="label-faker">
        {fakeLabels.map((lbl) => (
          <div key={lbl.id} className="space-y-2">
            <Label htmlFor={lbl.htmlFor}>{lbl.text}</Label>
            <Input id={lbl.htmlFor} placeholder={lbl.text} />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="label-faker"]')).toBeInTheDocument();
    const labels = canvasElement.querySelectorAll('label');
    expect(labels.length).toBe(5);
    labels.forEach((label) => {
      expect(label.textContent?.trim().length).not.toBe(0);
    });
  },
};

// ============ REQUIRED INDICATOR STORIES ============

export const RequiredWithAsterisk: Story = {
  name: i18n.t('label.storyName.requiredWithAsterisk', 'Required with Asterisk'),
  render: () => (
    <div className="w-[360px] space-y-4" data-testid="label-required-asterisk">
      <div className="space-y-2">
        <Label htmlFor="req-name">
          Full Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="req-name"
          required
          placeholder={i18n.t('label.story.requiredField', 'Required field')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="req-email">
          Email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="req-email"
          type="email"
          required
          placeholder={i18n.t('label.story.requiredField', 'Required field')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="opt-phone">
          Phone <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="opt-phone"
          type="tel"
          placeholder={i18n.t('label.story.optionalField', 'Optional field')}
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const requiredIndicators = canvasElement.querySelectorAll('.text-destructive');
    expect(requiredIndicators.length).toBe(2);

    const optionalIndicator = canvasElement.querySelector('.text-muted-foreground');
    expect(optionalIndicator?.textContent).toContain('optional');
  },
};

export const RequiredWithSrOnly: Story = {
  name: i18n.t('label.storyName.requiredWithSrOnly', 'Required with Screen Reader Only'),
  render: () => (
    <div className="w-[360px] space-y-4" data-testid="label-required-sr">
      <div className="space-y-2">
        <Label htmlFor="sr-name">
          Full Name
          <span className="sr-only"> (required)</span>
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        </Label>
        <Input
          id="sr-name"
          required
          placeholder={i18n.t('label.story.requiredField', 'Required field')}
          aria-required="true"
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const srOnly = canvasElement.querySelector('.sr-only');
    expect(srOnly?.textContent).toContain('required');

    const input = canvasElement.querySelector('#sr-name') as HTMLInputElement;
    expect(input).toBeRequired();
    expect(input.getAttribute('aria-required')).toBe('true');
  },
};

export const RequiredFieldGroup: Story = {
  name: i18n.t('label.storyName.requiredFieldGroup', 'Required Field Group'),
  render: () => (
    <form className="w-[360px] space-y-4" data-testid="label-required-form">
      <p className="text-muted-foreground text-sm">
        Fields marked with <span className="text-destructive">*</span> are required.
      </p>
      <div className="space-y-2">
        <Label htmlFor="form-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input id="form-name" required placeholder={i18n.t('label.story.johnDoe', 'John Doe')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="form-email">
          Email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="form-email"
          type="email"
          required
          placeholder={i18n.t('label.story.emailExample', 'john@example.com')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="form-bio">
          Bio <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="form-bio"
          placeholder={i18n.t('label.story.tellUsAboutYourself', 'Tell us about yourself')}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="form-terms" required />
        <Label htmlFor="form-terms">
          I accept the terms <span className="text-destructive">*</span>
        </Label>
      </div>
    </form>
  ),
  play: async ({ canvasElement }) => {
    const requiredInputs = canvasElement.querySelectorAll('input[required]');
    expect(requiredInputs.length).toBe(2);

    const requiredIndicators = canvasElement.querySelectorAll('.text-destructive');
    expect(requiredIndicators.length).toBe(4); // Including the explanation text
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('label.storyName.accessibility', 'Accessibility'),
  render: () => (
    <div className="w-[360px] space-y-6">
      <div className="space-y-2">
        <Label htmlFor="a11y-text">
          {i18n.t('label.story.textInputLabel', 'Text Input Label')}
        </Label>
        <Input id="a11y-text" placeholder={i18n.t('label.story.enterText', 'Enter text')} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="a11y-checkbox" />
        <Label htmlFor="a11y-checkbox">
          {i18n.t('label.story.checkboxLabel', 'Checkbox Label')}
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="a11y-switch" />
        <Label htmlFor="a11y-switch">{i18n.t('label.story.switchLabel', 'Switch Label')}</Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="a11y-required">
          Required Field <span className="text-destructive">*</span>
        </Label>
        <Input
          id="a11y-required"
          required
          placeholder={i18n.t('label.story.required', 'Required')}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="a11y-disabled" disabled />
        <Label htmlFor="a11y-disabled" className="text-muted-foreground">
          Disabled Label
        </Label>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Verify all labels have data-slot attribute
    const labels = canvasElement.querySelectorAll('[data-slot="label"]');
    expect(labels.length).toBe(5);

    // Test label-input association for text input
    const textLabel = canvasElement.querySelector('label[for="a11y-text"]');
    const textInput = canvasElement.querySelector('#a11y-text');
    expect(textLabel).toBeInTheDocument();
    expect(textInput).toBeInTheDocument();

    // Clicking label should focus input
    if (textLabel instanceof HTMLElement && textInput instanceof HTMLInputElement) {
      await userEvent.click(textLabel);
      expect(doc.activeElement).toBe(textInput);
    }

    // Test label-checkbox association
    const checkboxLabel = canvasElement.querySelector('label[for="a11y-checkbox"]');
    const checkbox = canvasElement.querySelector('#a11y-checkbox');
    expect(checkboxLabel).toBeInTheDocument();
    expect(checkbox).toBeInTheDocument();

    // Clicking label should toggle checkbox
    if (checkboxLabel instanceof HTMLElement) {
      await userEvent.click(checkboxLabel);
      expect(checkbox?.getAttribute('data-state')).toBe('checked');

      // Click again to uncheck
      await userEvent.click(checkboxLabel);
      expect(checkbox?.getAttribute('data-state')).toBe('unchecked');
    }

    // Test label-switch association
    const switchLabel = canvasElement.querySelector('label[for="a11y-switch"]');
    const switchElement = canvasElement.querySelector('#a11y-switch');
    expect(switchLabel).toBeInTheDocument();
    expect(switchElement).toBeInTheDocument();

    // Clicking label should toggle switch
    if (switchLabel instanceof HTMLElement) {
      await userEvent.click(switchLabel);
      expect(switchElement?.getAttribute('data-state')).toBe('checked');
    }

    // Verify required field has required attribute
    const requiredInput = canvasElement.querySelector('#a11y-required');
    if (requiredInput instanceof HTMLInputElement) {
      expect(requiredInput).toBeRequired();
    }

    // Verify disabled checkbox state
    const disabledCheckbox = canvasElement.querySelector('#a11y-disabled');
    if (disabledCheckbox instanceof HTMLButtonElement) {
      expect(disabledCheckbox).toBeDisabled();
    }

    // Test keyboard navigation
    if (textInput instanceof HTMLInputElement) {
      textInput.focus();
      expect(doc.activeElement).toBe(textInput);

      // Tab through interactive elements
      await userEvent.tab();
      expect(doc.activeElement).toBe(checkbox);

      await userEvent.tab();
      expect(doc.activeElement).toBe(switchElement);

      await userEvent.tab();
      expect(doc.activeElement).toBe(requiredInput);

      // Disabled checkbox should be skipped
      await userEvent.tab();
      expect(doc.activeElement).not.toBe(disabledCheckbox);
    }

    // Test Space key on checkbox
    if (checkbox instanceof HTMLElement) {
      checkbox.focus();
      await userEvent.keyboard(' ');
      expect(checkbox.getAttribute('data-state')).toBe('checked');
    }
  },
};

// ============ FACTORY: createFakeLabel ============

function CreateFakeLabelDemo() {
  const { t } = useTranslation();
  const label = createFakeLabel();

  return (
    <div className="w-[360px] space-y-2" data-testid="create-fake-label-demo">
      <p className="text-muted-foreground mb-2 text-sm">{t('label.variants.basic')}</p>
      <Label htmlFor={label.htmlFor} className={label.className}>
        {label.text}
        {label.requirement === 'required' && <span className="text-destructive"> *</span>}
      </Label>
      <Input id={label.htmlFor} placeholder={label.text} />
      <p className="text-muted-foreground text-xs">
        State: {label.state} | Size: {label.size} | ID: {label.id.slice(0, 8)}
      </p>
    </div>
  );
}

export const FactoryCreateFakeLabel: Story = {
  name: i18n.t('label.storyName.factoryCreateFakeLabel', 'Factory: createFakeLabel'),
  render: () => <CreateFakeLabelDemo />,
  play: async ({ canvasElement }) => {
    const container = within(canvasElement).getByTestId('create-fake-label-demo');
    expect(container).toBeInTheDocument();
    const label = container?.querySelector('[data-slot="label"]');
    expect(label).toBeInTheDocument();
    expect(label?.textContent?.trim().length).toBeGreaterThan(0);
    const input = container?.querySelector('input');
    expect(input).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeLabelForContext ============

function CreateFakeLabelForContextDemo() {
  const contexts: LabelContext[] = ['email', 'password', 'username', 'phone', 'bio'];
  const labels = contexts.map((ctx) => ({ ctx, label: createFakeLabelForContext(ctx) }));

  return (
    <div className="w-[400px] space-y-4" data-testid="label-for-context-demo">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('label.variants.basic')}</p>
      {labels.map(({ ctx, label }) => (
        <div key={ctx} className="space-y-1">
          <Label htmlFor={label.htmlFor}>
            {label.text}
            {label.requirement === 'required' && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={label.htmlFor}
            placeholder={i18n.t('label.story.enterPlaceholder', 'Enter {{ctx}}', { ctx })}
          />
        </div>
      ))}
    </div>
  );
}

export const FactoryCreateFakeLabelForContext: Story = {
  name: i18n.t(
    'label.storyName.factoryCreateFakeLabelForContext',
    'Factory: createFakeLabelForContext'
  ),
  render: () => <CreateFakeLabelForContextDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="label-for-context-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(5);
    const inputs = container?.querySelectorAll('input');
    expect(inputs?.length).toBe(5);
  },
};

// ============ FACTORY: createFakeFormField ============

function CreateFakeFormFieldDemo() {
  const field: FakeFormField = createFakeFormField();

  return (
    <div className="w-[360px] space-y-2" data-testid="form-field-demo">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('label.variants.withInput')}</p>
      <Label htmlFor={field.id}>
        {field.label.text}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={field.id}
        type={CONTROL_TYPE_INPUT_MAP[field.type] || 'text'}
        placeholder={field.placeholder}
        disabled={field.disabled}
        required={field.required}
        defaultValue={field.defaultValue}
      />
      {field.description && <p className="text-muted-foreground text-sm">{field.description}</p>}
      {field.errorMessage && <p className="text-destructive text-sm">{field.errorMessage}</p>}
    </div>
  );
}

export const FactoryCreateFakeFormField: Story = {
  name: i18n.t('label.storyName.factoryCreateFakeFormField', 'Factory: createFakeFormField'),
  render: () => <CreateFakeFormFieldDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="form-field-demo"]');
    expect(container).toBeInTheDocument();
    const label = container?.querySelector('[data-slot="label"]');
    expect(label).toBeInTheDocument();
    const input = container?.querySelector('input');
    expect(input).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeCheckboxField ============

function CreateFakeCheckboxFieldDemo() {
  const field: FakeCheckboxField = createFakeCheckboxField();

  return (
    <div className="space-y-2" data-testid="checkbox-field-demo">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('label.variants.withCheckbox')}</p>
      <div className="flex items-center gap-2">
        <Checkbox
          id={field.id}
          defaultChecked={field.checked}
          disabled={field.disabled}
          required={field.required}
        />
        <Label htmlFor={field.id} className={field.disabled ? 'text-muted-foreground' : ''}>
          {field.label.text}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
      </div>
    </div>
  );
}

export const FactoryCreateFakeCheckboxField: Story = {
  name: i18n.t(
    'label.storyName.factoryCreateFakeCheckboxField',
    'Factory: createFakeCheckboxField'
  ),
  render: () => <CreateFakeCheckboxFieldDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="checkbox-field-demo"]');
    expect(container).toBeInTheDocument();
    const checkbox = container?.querySelector('[data-slot="checkbox"]');
    expect(checkbox).toBeInTheDocument();
    const label = container?.querySelector('[data-slot="label"]');
    expect(label).toBeInTheDocument();
    expect(label?.textContent?.trim().length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: createFakeSwitchField ============

function CreateFakeSwitchFieldDemo() {
  const field: FakeSwitchField = createFakeSwitchField();

  return (
    <div className="space-y-2" data-testid="switch-field-demo">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('label.variants.withSwitch')}</p>
      <div className="flex items-center gap-2">
        <Switch id={field.id} defaultChecked={field.checked} disabled={field.disabled} />
        <Label htmlFor={field.id} className={field.disabled ? 'text-muted-foreground' : ''}>
          {field.label.text}
        </Label>
      </div>
    </div>
  );
}

export const FactoryCreateFakeSwitchField: Story = {
  name: i18n.t('label.storyName.factoryCreateFakeSwitchField', 'Factory: createFakeSwitchField'),
  render: () => <CreateFakeSwitchFieldDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="switch-field-demo"]');
    expect(container).toBeInTheDocument();
    const switchEl = container?.querySelector('[data-slot="switch"]');
    expect(switchEl).toBeInTheDocument();
    const label = container?.querySelector('[data-slot="label"]');
    expect(label).toBeInTheDocument();
    expect(label?.textContent?.trim().length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: createFakeRadioOption ============

function CreateFakeRadioOptionDemo() {
  const option: FakeRadioOption = createFakeRadioOption();

  return (
    <div className="space-y-2" data-testid="radio-option-demo">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('label.variants.basic')}</p>
      <RadioGroup defaultValue={option.value}>
        <div className="flex items-center gap-2">
          <RadioGroupItem id={option.id} value={option.value} disabled={option.disabled} />
          <Label htmlFor={option.id} className={option.disabled ? 'text-muted-foreground' : ''}>
            {option.label.text}
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}

export const FactoryCreateFakeRadioOption: Story = {
  name: i18n.t('label.storyName.factoryCreateFakeRadioOption', 'Factory: createFakeRadioOption'),
  render: () => <CreateFakeRadioOptionDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="radio-option-demo"]');
    expect(container).toBeInTheDocument();
    const label = container?.querySelector('[data-slot="label"]');
    expect(label).toBeInTheDocument();
    expect(label?.textContent?.trim().length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: createFakeRadioGroup ============

function CreateFakeRadioGroupDemo() {
  const group: FakeRadioGroup = createFakeRadioGroup(4);

  return (
    <div className="space-y-2" data-testid="radio-group-demo">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('label.variants.basic')}</p>
      <RadioGroup defaultValue={group.selectedValue} name={group.name}>
        {group.options.map((opt) => (
          <div key={opt.id} className="flex items-center gap-2">
            <RadioGroupItem id={opt.id} value={opt.value} disabled={opt.disabled} />
            <Label htmlFor={opt.id} className={opt.disabled ? 'text-muted-foreground' : ''}>
              {opt.label.text}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {group.required && (
        <p className="text-muted-foreground text-xs">
          {i18n.t('label.story.selectionIsRequired', 'Selection is required')}
        </p>
      )}
    </div>
  );
}

export const FactoryCreateFakeRadioGroup: Story = {
  name: i18n.t('label.storyName.factoryCreateFakeRadioGroup', 'Factory: createFakeRadioGroup'),
  render: () => <CreateFakeRadioGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="radio-group-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(4);
  },
};

// ============ FACTORY: createFakeFormSection ============

function CreateFakeFormSectionDemo() {
  const section: FakeFormSection = createFakeFormSection(3);

  return (
    <div className="w-[400px] space-y-4" data-testid="form-section-demo">
      <div>
        <h3 className="text-lg font-semibold">{section.title}</h3>
        {section.description && (
          <p className="text-muted-foreground text-sm">{section.description}</p>
        )}
      </div>
      <p className="text-muted-foreground text-xs">{i18n.t('label.variants.withInput')}</p>
      {section.fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label htmlFor={field.id}>
            {field.label.text}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={field.id}
            placeholder={field.placeholder}
            disabled={field.disabled}
            required={field.required}
          />
        </div>
      ))}
    </div>
  );
}

export const FactoryCreateFakeFormSection: Story = {
  name: i18n.t('label.storyName.factoryCreateFakeFormSection', 'Factory: createFakeFormSection'),
  render: () => <CreateFakeFormSectionDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="form-section-demo"]');
    expect(container).toBeInTheDocument();
    const heading = container?.querySelector('h3');
    expect(heading).toBeInTheDocument();
    expect(heading?.textContent?.trim().length).toBeGreaterThan(0);
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(3);
  },
};

// ============ FACTORY: createFakeLabelA11yConfig ============

function CreateFakeLabelA11yConfigDemo() {
  const config: FakeLabelA11yConfig = createFakeLabelA11yConfig({ srOnly: true });
  const normalConfig: FakeLabelA11yConfig = createFakeLabelA11yConfig({
    srOnly: false,
    useAriaLabel: false,
  });
  const ariaConfig: FakeLabelA11yConfig = createFakeLabelA11yConfig({ useAriaLabel: true });

  return (
    <div className="w-[400px] space-y-6" data-testid="a11y-config-demo">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('label.variants.basic')}</p>

      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('label.story.screenReaderOnlyLabel')}</p>
        <div className="space-y-1">
          {config.srOnly ? (
            <Label htmlFor="sr-config" className="sr-only">
              Search
            </Label>
          ) : (
            <Label htmlFor="sr-config">{i18n.t('label.story.search', 'Search')}</Label>
          )}
          <Input id="sr-config" placeholder={i18n.t('label.story.search', 'Search...')} />
          <p className="text-muted-foreground text-xs">
            srOnly: {String(config.srOnly)} | useAriaLabel: {String(config.useAriaLabel)}
            {config.ariaDescribedBy ? ` | describedBy: ${config.ariaDescribedBy}` : ''}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('label.story.visibleLabel', 'Visible label')}</p>
        <div className="space-y-1">
          <Label htmlFor="normal-config">{i18n.t('label.story.email', 'Email')}</Label>
          <Input
            id="normal-config"
            placeholder={i18n.t('label.story.emailPlaceholder', 'name@example.com')}
            aria-describedby={normalConfig.ariaDescribedBy}
          />
          <p className="text-muted-foreground text-xs">
            srOnly: {String(normalConfig.srOnly)} | useAriaLabel:{' '}
            {String(normalConfig.useAriaLabel)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('label.story.ariaLabelOnly')}</p>
        <div className="space-y-1">
          {ariaConfig.useAriaLabel ? (
            <Input
              id="aria-config"
              aria-label={i18n.t('label.story.username', 'Username')}
              placeholder={i18n.t('label.story.username', 'Username')}
            />
          ) : (
            <>
              <Label htmlFor="aria-config">{i18n.t('label.story.username', 'Username')}</Label>
              <Input id="aria-config" placeholder={i18n.t('label.story.username', 'Username')} />
            </>
          )}
          <p className="text-muted-foreground text-xs">
            useAriaLabel: {String(ariaConfig.useAriaLabel)}
          </p>
        </div>
      </div>
    </div>
  );
}

export const FactoryCreateFakeLabelA11yConfig: Story = {
  name: i18n.t(
    'label.storyName.factoryCreateFakeLabelA11yConfig',
    'Factory: createFakeLabelA11yConfig'
  ),
  render: () => <CreateFakeLabelA11yConfigDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="a11y-config-demo"]');
    expect(container).toBeInTheDocument();
    const srOnlyLabel = container?.querySelector('.sr-only');
    expect(srOnlyLabel).toBeInTheDocument();
    const inputs = container?.querySelectorAll('input');
    expect(inputs?.length).toBeGreaterThanOrEqual(2);
  },
};

// ============ FACTORY: createFakeFormFields (bulk) ============

function CreateFakeFormFieldsDemo() {
  const fields: FakeFormField[] = createFakeFormFields(4);

  return (
    <div className="w-[400px] space-y-4" data-testid="form-fields-bulk-demo">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('label.variants.withInput')}</p>
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label htmlFor={field.id}>
            {field.label.text}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={field.id}
            placeholder={field.placeholder}
            disabled={field.disabled}
            required={field.required}
          />
          {field.errorMessage && <p className="text-destructive text-sm">{field.errorMessage}</p>}
        </div>
      ))}
    </div>
  );
}

export const FactoryCreateFakeFormFields: Story = {
  name: i18n.t(
    'label.storyName.factoryCreateFakeFormFields',
    'Factory: createFakeFormFields (bulk)'
  ),
  render: () => <CreateFakeFormFieldsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="form-fields-bulk-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(4);
    const inputs = container?.querySelectorAll('input');
    expect(inputs?.length).toBe(4);
  },
};

// ============ FACTORY: createFakeCheckboxFields (bulk) ============

function CreateFakeCheckboxFieldsDemo() {
  const fields: FakeCheckboxField[] = createFakeCheckboxFields(5);

  return (
    <div className="space-y-3" data-testid="checkbox-fields-bulk-demo">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('label.variants.withCheckbox')}</p>
      {fields.map((field) => (
        <div key={field.id} className="flex items-center gap-2">
          <Checkbox id={field.id} defaultChecked={field.checked} disabled={field.disabled} />
          <Label htmlFor={field.id} className={field.disabled ? 'text-muted-foreground' : ''}>
            {field.label.text}
          </Label>
        </div>
      ))}
    </div>
  );
}

export const FactoryCreateFakeCheckboxFields: Story = {
  name: i18n.t(
    'label.storyName.factoryCreateFakeCheckboxFields',
    'Factory: createFakeCheckboxFields (bulk)'
  ),
  render: () => <CreateFakeCheckboxFieldsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="checkbox-fields-bulk-demo"]');
    expect(container).toBeInTheDocument();
    const checkboxes = container?.querySelectorAll('[data-slot="checkbox"]');
    expect(checkboxes?.length).toBe(5);
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(5);
  },
};

// ============ FACTORY: createFakeSwitchFields (bulk) ============

function CreateFakeSwitchFieldsDemo() {
  const fields: FakeSwitchField[] = createFakeSwitchFields(4);

  return (
    <div className="space-y-3" data-testid="switch-fields-bulk-demo">
      <p className="text-muted-foreground mb-2 text-sm">{i18n.t('label.variants.withSwitch')}</p>
      {fields.map((field) => (
        <div key={field.id} className="flex items-center gap-2">
          <Switch id={field.id} defaultChecked={field.checked} disabled={field.disabled} />
          <Label htmlFor={field.id} className={field.disabled ? 'text-muted-foreground' : ''}>
            {field.label.text}
          </Label>
        </div>
      ))}
    </div>
  );
}

export const FactoryCreateFakeSwitchFields: Story = {
  name: i18n.t(
    'label.storyName.factoryCreateFakeSwitchFields',
    'Factory: createFakeSwitchFields (bulk)'
  ),
  render: () => <CreateFakeSwitchFieldsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="switch-fields-bulk-demo"]');
    expect(container).toBeInTheDocument();
    const switches = container?.querySelectorAll('[data-slot="switch"]');
    expect(switches?.length).toBe(4);
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(4);
  },
};

// ============ FACTORY: createFakeFormSections (bulk) ============

function CreateFakeFormSectionsDemo() {
  const sections: FakeFormSection[] = createFakeFormSections(2);

  return (
    <div className="w-[400px] space-y-8" data-testid="form-sections-bulk-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('label.variants.withInput')}</p>
      {sections.map((section) => (
        <div key={section.title} className="space-y-4 rounded-lg border p-4">
          <div>
            <h3 className="text-lg font-semibold">{section.title}</h3>
            {section.description && (
              <p className="text-muted-foreground text-sm">{section.description}</p>
            )}
          </div>
          {section.fields.map((field) => (
            <div key={field.id} className="space-y-1">
              <Label htmlFor={field.id}>
                {field.label.text}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
              <Input id={field.id} placeholder={field.placeholder} disabled={field.disabled} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export const FactoryCreateFakeFormSections: Story = {
  name: i18n.t(
    'label.storyName.factoryCreateFakeFormSections',
    'Factory: createFakeFormSections (bulk)'
  ),
  render: () => <CreateFakeFormSectionsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="form-sections-bulk-demo"]');
    expect(container).toBeInTheDocument();
    const headings = container?.querySelectorAll('h3');
    expect(headings?.length).toBe(2);
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBeGreaterThanOrEqual(2);
  },
};

// ============ FACTORY: createFakeRegistrationForm ============

function RegistrationFormDemo() {
  const fields: FakeFormField[] = createFakeRegistrationForm();

  return (
    <form className="w-[400px] space-y-4" data-testid="registration-form-demo">
      <h3 className="text-lg font-semibold">{i18n.t('label.variants.withInput')}: Registration</h3>
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label htmlFor={field.id}>
            {field.label.text}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={field.id}
            type={CONTROL_TYPE_INPUT_MAP[field.type] || 'text'}
            placeholder={field.placeholder}
            required={field.required}
          />
        </div>
      ))}
    </form>
  );
}

export const FactoryRegistrationForm: Story = {
  name: i18n.t('label.storyName.factoryRegistrationForm', 'Factory: Registration Form'),
  render: () => <RegistrationFormDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="registration-form-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(6); // email, username, password, confirmPassword, firstName, lastName
    const requiredInputs = container?.querySelectorAll('input[required]');
    expect(requiredInputs?.length).toBeGreaterThanOrEqual(4);
  },
};

// ============ FACTORY: createFakeLoginForm ============

function LoginFormDemo() {
  const fields: FakeFormField[] = createFakeLoginForm();

  return (
    <form className="w-[360px] space-y-4" data-testid="login-form-demo">
      <h3 className="text-lg font-semibold">{i18n.t('label.variants.withInput')}: Login</h3>
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label htmlFor={field.id}>
            {field.label.text}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={field.id}
            type={CONTROL_TYPE_INPUT_MAP[field.type] || 'text'}
            placeholder={field.placeholder}
            required={field.required}
          />
        </div>
      ))}
    </form>
  );
}

export const FactoryLoginForm: Story = {
  name: i18n.t('label.storyName.factoryLoginForm', 'Factory: Login Form'),
  render: () => <LoginFormDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="login-form-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(2); // email, password
    const inputs = container?.querySelectorAll('input');
    expect(inputs?.length).toBe(2);
    for (const input of inputs!) {
      expect(input).toBeRequired();
    }
  },
};

// ============ FACTORY: createFakeContactForm ============

function ContactFormDemo() {
  const fields: FakeFormField[] = createFakeContactForm();

  return (
    <form className="w-[400px] space-y-4" data-testid="contact-form-demo">
      <h3 className="text-lg font-semibold">{i18n.t('label.variants.withInput')}: Contact</h3>
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label htmlFor={field.id}>
            {field.label.text}
            {field.required && <span className="text-destructive"> *</span>}
            {!field.required && <span className="text-muted-foreground"> (optional)</span>}
          </Label>
          {field.type === 'textarea' ? (
            <Textarea id={field.id} placeholder={field.placeholder} required={field.required} />
          ) : (
            <Input
              id={field.id}
              type={CONTROL_TYPE_INPUT_MAP[field.type] || 'text'}
              placeholder={field.placeholder}
              required={field.required}
            />
          )}
        </div>
      ))}
    </form>
  );
}

export const FactoryContactForm: Story = {
  name: i18n.t('label.storyName.factoryContactForm', 'Factory: Contact Form'),
  render: () => <ContactFormDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="contact-form-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(5); // fullName, email, phone, subject, message
    // Phone should be optional
    const optionalIndicators = container?.querySelectorAll('.text-muted-foreground');
    expect(optionalIndicators?.length).toBeGreaterThanOrEqual(1);
  },
};

// ============ FACTORY: createFakeAddressForm ============

function AddressFormDemo() {
  const fields: FakeFormField[] = createFakeAddressForm();

  return (
    <form className="w-[400px] space-y-4" data-testid="address-form-demo">
      <h3 className="text-lg font-semibold">{i18n.t('label.variants.withInput')}: Address</h3>
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label htmlFor={field.id}>
            {field.label.text}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
          {field.type === 'select' ? (
            <Select>
              <SelectTrigger id={field.id}>
                <SelectValue placeholder={field.placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option-1">Option 1</SelectItem>
                <SelectItem value="option-2">Option 2</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input id={field.id} placeholder={field.placeholder} required={field.required} />
          )}
        </div>
      ))}
    </form>
  );
}

export const FactoryAddressForm: Story = {
  name: i18n.t('label.storyName.factoryAddressForm', 'Factory: Address Form'),
  render: () => <AddressFormDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="address-form-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(5); // address, city, state, postalCode, country
    const requiredIndicators = container?.querySelectorAll('.text-destructive');
    expect(requiredIndicators?.length).toBe(5); // all required
  },
};

// ============ FACTORY: createFakeProfileForm ============

function ProfileFormDemo() {
  const fields: FakeFormField[] = createFakeProfileForm();

  return (
    <form className="w-[400px] space-y-4" data-testid="profile-form-demo">
      <h3 className="text-lg font-semibold">{i18n.t('label.variants.withInput')}: Profile</h3>
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label htmlFor={field.id}>
            {field.label.text}
            {field.required && <span className="text-destructive"> *</span>}
            {!field.required && <span className="text-muted-foreground"> (optional)</span>}
          </Label>
          {field.type === 'textarea' ? (
            <Textarea id={field.id} placeholder={field.placeholder} required={field.required} />
          ) : (
            <Input
              id={field.id}
              type={CONTROL_TYPE_INPUT_MAP[field.type] || 'text'}
              placeholder={field.placeholder}
              required={field.required}
            />
          )}
        </div>
      ))}
    </form>
  );
}

export const FactoryProfileForm: Story = {
  name: i18n.t('label.storyName.factoryProfileForm', 'Factory: Profile Form'),
  render: () => <ProfileFormDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="profile-form-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(8); // firstName, lastName, email, phone, company, title, bio, url
    // firstName, lastName, email are required
    const requiredIndicators = container?.querySelectorAll('.text-destructive');
    expect(requiredIndicators?.length).toBe(3);
  },
};

// ============ FACTORY: createFakePaymentForm ============

function PaymentFormDemo() {
  const fields: FakeFormField[] = createFakePaymentForm();

  return (
    <form className="w-[400px] space-y-4" data-testid="payment-form-demo">
      <h3 className="text-lg font-semibold">{i18n.t('label.variants.withInput')}: Payment</h3>
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label htmlFor={field.id}>
            {field.label.text}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={field.id}
            type={CONTROL_TYPE_INPUT_MAP[field.type] || 'text'}
            placeholder={field.placeholder}
            required={field.required}
          />
        </div>
      ))}
    </form>
  );
}

export const FactoryPaymentForm: Story = {
  name: i18n.t('label.storyName.factoryPaymentForm', 'Factory: Payment Form'),
  render: () => <PaymentFormDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="payment-form-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(4); // cardholder, card number, expiry, cvv
    const inputs = container?.querySelectorAll('input');
    expect(inputs?.length).toBe(4);
    for (const input of inputs!) {
      expect(input).toBeRequired();
    }
  },
};

// ============ FACTORY: createFakeSettingsPreferences ============

function SettingsPreferencesDemo() {
  const prefs: FakeSwitchField[] = createFakeSettingsPreferences();

  return (
    <div className="w-[400px] space-y-4" data-testid="settings-prefs-demo">
      <h3 className="text-lg font-semibold">{i18n.t('label.variants.withSwitch')}: Preferences</h3>
      {prefs.map((pref) => (
        <div key={pref.id} className="flex items-center justify-between gap-4 border-b pb-3">
          <Label htmlFor={pref.id} className={pref.disabled ? 'text-muted-foreground' : ''}>
            {pref.label.text}
          </Label>
          <Switch id={pref.id} defaultChecked={pref.checked} disabled={pref.disabled} />
        </div>
      ))}
    </div>
  );
}

export const FactorySettingsPreferences: Story = {
  name: i18n.t('label.storyName.factorySettingsPreferences', 'Factory: Settings Preferences'),
  render: () => <SettingsPreferencesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="settings-prefs-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(8);
    const switches = container?.querySelectorAll('[data-slot="switch"]');
    expect(switches?.length).toBe(8);
  },
};

// ============ FACTORY: createFakeLabelSizeMatrix ============

function LabelSizeMatrixDemo() {
  const labels: FakeLabel[] = createFakeLabelSizeMatrix();

  return (
    <div className="space-y-4" data-testid="size-matrix-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('label.sizes.base')}: Size Matrix</p>
      {labels.map((lbl) => (
        <div key={lbl.id} className="flex items-center gap-4">
          <span className="text-muted-foreground w-16 text-xs">{lbl.size}</span>
          <Label className={lbl.className}>{lbl.text}</Label>
        </div>
      ))}
    </div>
  );
}

export const FactoryLabelSizeMatrix: Story = {
  name: i18n.t('label.storyName.factoryLabelSizeMatrix', 'Factory: Label Size Matrix'),
  render: () => <LabelSizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="size-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(5); // xs, sm, base, lg, xl
  },
};

// ============ FACTORY: createFakeLabelStateMatrix ============

function LabelStateMatrixDemo() {
  const labels: FakeLabel[] = createFakeLabelStateMatrix();

  const stateClasses: Record<string, string> = {
    default: '',
    focused: 'text-primary',
    disabled: 'text-muted-foreground',
    error: 'text-destructive',
    success: 'text-green-600',
  };

  return (
    <div className="space-y-4" data-testid="state-matrix-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('label.variants.basic')}: State Matrix
      </p>
      {labels.map((lbl) => (
        <div key={lbl.id} className="flex items-center gap-4">
          <span className="text-muted-foreground w-20 text-xs">{lbl.state}</span>
          <Label className={stateClasses[lbl.state] || ''} data-label-state={lbl.state}>
            {lbl.text}
          </Label>
        </div>
      ))}
    </div>
  );
}

export const FactoryLabelStateMatrix: Story = {
  name: i18n.t('label.storyName.factoryLabelStateMatrix', 'Factory: Label State Matrix'),
  render: () => <LabelStateMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="state-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(5); // default, focused, disabled, error, success
    // Verify each state is represented
    const stateAttrs = container?.querySelectorAll('[data-label-state]');
    expect(stateAttrs?.length).toBe(5);
  },
};

// ============ FACTORY: createFakeLabelRequirementMatrix ============

function LabelRequirementMatrixDemo() {
  const labels: FakeLabel[] = createFakeLabelRequirementMatrix();

  return (
    <div className="space-y-4" data-testid="requirement-matrix-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('label.variants.required')}: Requirement Matrix
      </p>
      {labels.map((lbl) => (
        <div key={lbl.id} className="flex items-center gap-4">
          <span className="text-muted-foreground w-20 text-xs">{lbl.requirement}</span>
          <Label>
            {lbl.text}
            {lbl.requirement === 'required' && <span className="text-destructive"> *</span>}
            {lbl.requirement === 'optional' && (
              <span className="text-muted-foreground"> (optional)</span>
            )}
          </Label>
        </div>
      ))}
    </div>
  );
}

export const FactoryLabelRequirementMatrix: Story = {
  name: i18n.t(
    'label.storyName.factoryLabelRequirementMatrix',
    'Factory: Label Requirement Matrix'
  ),
  render: () => <LabelRequirementMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="requirement-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(2); // required, optional
    const requiredIndicator = container?.querySelector('.text-destructive');
    expect(requiredIndicator).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeLabelContextMatrix ============

function LabelContextMatrixDemo() {
  const labels: FakeLabel[] = createFakeLabelContextMatrix();

  return (
    <div className="grid grid-cols-2 gap-3" data-testid="context-matrix-demo">
      <p className="text-muted-foreground col-span-2 text-sm">
        {i18n.t('label.variants.basic')}: Context Matrix ({labels.length} contexts)
      </p>
      {labels.map((lbl) => (
        <div key={lbl.id} className="space-y-1">
          <Label htmlFor={lbl.htmlFor}>
            {lbl.text}
            {lbl.requirement === 'required' && <span className="text-destructive"> *</span>}
          </Label>
          <Input id={lbl.htmlFor} placeholder={lbl.text} className="h-8 text-xs" />
        </div>
      ))}
    </div>
  );
}

export const FactoryLabelContextMatrix: Story = {
  name: i18n.t('label.storyName.factoryLabelContextMatrix', 'Factory: Label Context Matrix'),
  render: () => <LabelContextMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="context-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(24); // all 24 contexts
  },
};

// ============ FACTORY: createFakeFormFieldControlTypeMatrix ============

function ControlTypeField({ field }: { field: FakeFormField }) {
  useTranslation();
  if (field.type === 'textarea') {
    return (
      <Textarea
        id={field.id}
        placeholder={i18n.t('label.story.controlPlaceholder', '{{type}} control', {
          type: field.type,
        })}
        className="h-16"
      />
    );
  }
  if (field.type === 'select') {
    return (
      <Select>
        <SelectTrigger id={field.id}>
          <SelectValue
            placeholder={i18n.t('label.story.controlPlaceholder', '{{type}} control', {
              type: field.type,
            })}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">{i18n.t('label.story.optionA', 'Option A')}</SelectItem>
          <SelectItem value="b">{i18n.t('label.story.optionB', 'Option B')}</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (field.type === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <Checkbox id={field.id} />
        <span className="text-muted-foreground text-xs">{field.type}</span>
      </div>
    );
  }
  if (field.type === 'switch') {
    return (
      <div className="flex items-center gap-2">
        <Switch id={field.id} />
        <span className="text-muted-foreground text-xs">{field.type}</span>
      </div>
    );
  }
  if (field.type === 'radio') {
    return (
      <RadioGroup>
        <div className="flex items-center gap-2">
          <RadioGroupItem id={field.id} value="radio-val" />
          <span className="text-muted-foreground text-xs">radio option</span>
        </div>
      </RadioGroup>
    );
  }
  return (
    <Input
      id={field.id}
      type={CONTROL_TYPE_INPUT_MAP[field.type] || 'text'}
      placeholder={i18n.t('label.story.controlPlaceholder', '{{type}} control', {
        type: field.type,
      })}
    />
  );
}

function FormFieldControlTypeMatrixDemo() {
  const { t } = useTranslation();
  const fields: FakeFormField[] = createFakeFormFieldControlTypeMatrix();

  return (
    <div className="w-[500px] space-y-4" data-testid="control-type-matrix-demo">
      <p className="text-muted-foreground text-sm">
        {t('label.variants.withInput')}: Control Types
      </p>
      {fields.map((field) => (
        <div key={field.id} className="space-y-1" data-control-type={field.type}>
          <Label htmlFor={field.id}>{field.label.text}</Label>
          <ControlTypeField field={field} />
        </div>
      ))}
    </div>
  );
}

export const FactoryFormFieldControlTypeMatrix: Story = {
  name: i18n.t('label.storyName.factoryFormFieldControlTypeMatrix', 'Factory: Control Type Matrix'),
  render: () => <FormFieldControlTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="control-type-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const labels = container?.querySelectorAll('[data-slot="label"]');
    expect(labels?.length).toBe(17); // all 17 control types
    // Check some specific control types exist
    expect(container?.querySelector('[data-control-type="text"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-control-type="email"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-control-type="checkbox"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeLabelShowcase ============

function LabelShowcaseDemo() {
  const { t } = useTranslation();
  const showcase = createFakeLabelShowcase();
  const keys = Object.keys(showcase);

  return (
    <div className="w-[500px] space-y-4" data-testid="showcase-demo">
      <h3 className="text-lg font-semibold">{t('label.variants.basic')}: Full Showcase</h3>
      <p className="text-muted-foreground text-sm">Total sections: {keys.length}</p>
      <div className="space-y-2">
        {keys.map((key) => (
          <div key={key} className="rounded border px-3 py-2" data-showcase-key={key}>
            <span className="font-mono text-xs">{key}</span>
            <span className="text-muted-foreground ml-2 text-xs">
              {Array.isArray(showcase[key])
                ? `Array(${(showcase[key] as unknown[]).length})`
                : typeof showcase[key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryLabelShowcase: Story = {
  name: i18n.t('label.storyName.factoryLabelShowcase', 'Factory: Label Showcase'),
  render: () => <LabelShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="showcase-demo"]');
    expect(container).toBeInTheDocument();
    // Verify known keys exist
    expect(container?.querySelector('[data-showcase-key="label"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-showcase-key="formField"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-showcase-key="registrationForm"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-showcase-key="loginForm"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-showcase-key="sizeMatrix"]')).toBeInTheDocument();
    const allKeys = container?.querySelectorAll('[data-showcase-key]');
    expect(allKeys?.length).toBeGreaterThanOrEqual(20);
  },
};

// ============ CONSTANTS: LABEL_SIZES ============

function LabelSizesConstantDemo() {
  const _sizes: LabelSize[] = LABEL_SIZES;

  return (
    <div className="space-y-4" data-testid="label-sizes-constant-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('label.sizes.base')}: LABEL_SIZES</p>
      {_sizes.map((size) => (
        <div key={size} className="flex items-center gap-4" data-size={size}>
          <span className="text-muted-foreground w-12 font-mono text-xs">{size}</span>
          <Label className={LABEL_SIZE_CLASSES[size]}>Label at size &quot;{size}&quot;</Label>
        </div>
      ))}
    </div>
  );
}

export const ConstantLabelSizes: Story = {
  name: i18n.t('label.storyName.constantLabelSizes', 'Constant: LABEL_SIZES + LABEL_SIZE_CLASSES'),
  render: () => <LabelSizesConstantDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="label-sizes-constant-demo"]');
    expect(container).toBeInTheDocument();
    expect(container?.querySelector('[data-size="xs"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-size="sm"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-size="base"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-size="lg"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-size="xl"]')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: LABEL_REQUIREMENTS ============

function LabelRequirementsConstantDemo() {
  const { t } = useTranslation();
  const _requirements: LabelRequirement[] = LABEL_REQUIREMENTS;

  return (
    <div className="space-y-4" data-testid="label-requirements-constant-demo">
      <p className="text-muted-foreground text-sm">
        {t('label.variants.required')}: LABEL_REQUIREMENTS
      </p>
      {_requirements.map((req) => (
        <div key={req} className="flex items-center gap-4" data-requirement={req}>
          <span className="text-muted-foreground w-20 font-mono text-xs">{req}</span>
          <Label>
            Field Label
            {req === 'required' && <span className="text-destructive"> *</span>}
            {req === 'optional' && <span className="text-muted-foreground"> (optional)</span>}
          </Label>
        </div>
      ))}
    </div>
  );
}

export const ConstantLabelRequirements: Story = {
  name: i18n.t('label.storyName.constantLabelRequirements', 'Constant: LABEL_REQUIREMENTS'),
  render: () => <LabelRequirementsConstantDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector(
      '[data-testid="label-requirements-constant-demo"]'
    );
    expect(container).toBeInTheDocument();
    expect(container?.querySelector('[data-requirement="required"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-requirement="optional"]')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: LABEL_STATES ============

function LabelStatesConstantDemo() {
  const _states: LabelState[] = LABEL_STATES;

  const stateStyles: Record<string, string> = {
    default: '',
    focused: 'text-primary font-semibold',
    disabled: 'text-muted-foreground opacity-50',
    error: 'text-destructive',
    success: 'text-green-600',
  };

  return (
    <div className="space-y-4" data-testid="label-states-constant-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('label.variants.basic')}: LABEL_STATES
      </p>
      {_states.map((state) => (
        <div key={state} className="flex items-center gap-4" data-state-item={state}>
          <span className="text-muted-foreground w-20 font-mono text-xs">{state}</span>
          <Label className={stateStyles[state] || ''}>
            {i18n.t('label.story.labelInState', { state })}
          </Label>
        </div>
      ))}
    </div>
  );
}

export const ConstantLabelStates: Story = {
  name: i18n.t('label.storyName.constantLabelStates', 'Constant: LABEL_STATES'),
  render: () => <LabelStatesConstantDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="label-states-constant-demo"]');
    expect(container).toBeInTheDocument();
    expect(container?.querySelector('[data-state-item="default"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-state-item="focused"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-state-item="disabled"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-state-item="error"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-state-item="success"]')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: LABEL_CONTROL_TYPES + CONTROL_TYPE_INPUT_MAP ============

function LabelControlTypesConstantDemo() {
  const { t } = useTranslation();
  const _types: LabelControlType[] = LABEL_CONTROL_TYPES;

  return (
    <div className="space-y-3" data-testid="label-control-types-constant-demo">
      <p className="text-muted-foreground text-sm">
        {t('label.variants.basic')}: LABEL_CONTROL_TYPES
      </p>
      <div className="grid grid-cols-3 gap-2">
        {_types.map((type) => (
          <div key={type} className="rounded border px-3 py-2 text-center" data-control-item={type}>
            <span className="font-mono text-xs">{type}</span>
            <span className="text-muted-foreground block text-xs">
              → {CONTROL_TYPE_INPUT_MAP[type]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantLabelControlTypes: Story = {
  name: i18n.t(
    'label.storyName.constantLabelControlTypes',
    'Constant: LABEL_CONTROL_TYPES + CONTROL_TYPE_INPUT_MAP'
  ),
  render: () => <LabelControlTypesConstantDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector(
      '[data-testid="label-control-types-constant-demo"]'
    );
    expect(container).toBeInTheDocument();
    const items = container?.querySelectorAll('[data-control-item]');
    expect(items?.length).toBe(17);
    expect(container?.querySelector('[data-control-item="text"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-control-item="email"]')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: LABEL_CONTEXTS + LABEL_TEXTS ============

function LabelContextsConstantDemo() {
  const _contexts: LabelContext[] = LABEL_CONTEXTS;

  return (
    <div className="space-y-3" data-testid="label-contexts-constant-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('label.variants.basic')}: LABEL_CONTEXTS + LABEL_TEXTS
      </p>
      <div className="grid grid-cols-2 gap-2">
        {_contexts.map((ctx) => (
          <div key={ctx} className="rounded border px-3 py-2" data-context-item={ctx}>
            <span className="font-mono text-xs">{ctx}</span>
            <span className="text-muted-foreground ml-2 text-xs">→ {LABEL_TEXTS[ctx]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantLabelContexts: Story = {
  name: i18n.t('label.storyName.constantLabelContexts', 'Constant: LABEL_CONTEXTS + LABEL_TEXTS'),
  render: () => <LabelContextsConstantDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="label-contexts-constant-demo"]');
    expect(container).toBeInTheDocument();
    const items = container?.querySelectorAll('[data-context-item]');
    expect(items?.length).toBe(24);
    expect(container?.querySelector('[data-context-item="email"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-context-item="password"]')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: LABEL_POSITIONS ============

function LabelPositionsConstantDemo() {
  const _positions: LabelPosition[] = LABEL_POSITIONS;

  return (
    <div className="w-[400px] space-y-6" data-testid="label-positions-constant-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('label.variants.basic')}: LABEL_POSITIONS
      </p>
      {_positions.map((pos) => (
        <div key={pos} data-position-item={pos}>
          <p className="mb-2 font-mono text-xs">Position: {pos}</p>
          {pos === 'top' && (
            <div className="space-y-1">
              <Label htmlFor={`pos-${pos}`}>{i18n.t('label.story.labelTop', 'Label (top)')}</Label>
              <Input
                id={`pos-${pos}`}
                placeholder={i18n.t('label.story.inputBelowLabel', 'Input below label')}
              />
            </div>
          )}
          {pos === 'before' && (
            <div className="flex items-center gap-2">
              <Label htmlFor={`pos-${pos}`}>
                {i18n.t('label.story.labelBefore', 'Label (before)')}
              </Label>
              <Input
                id={`pos-${pos}`}
                placeholder={i18n.t('label.story.inputAfterLabel', 'Input after label')}
                className="flex-1"
              />
            </div>
          )}
          {pos === 'after' && (
            <div className="flex items-center gap-2">
              <Input
                id={`pos-${pos}`}
                placeholder={i18n.t('label.story.inputBeforeLabel', 'Input before label')}
                className="flex-1"
              />
              <Label htmlFor={`pos-${pos}`}>
                {i18n.t('label.story.labelAfter', 'Label (after)')}
              </Label>
            </div>
          )}
          {pos === 'inside' && (
            <div className="relative">
              <Label
                htmlFor={`pos-${pos}`}
                className="text-muted-foreground absolute top-1 left-3 text-xs"
              >
                Label (inside)
              </Label>
              <Input id={`pos-${pos}`} placeholder="" className="pt-5" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export const ConstantLabelPositions: Story = {
  name: i18n.t('label.storyName.constantLabelPositions', 'Constant: LABEL_POSITIONS'),
  render: () => <LabelPositionsConstantDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="label-positions-constant-demo"]');
    expect(container).toBeInTheDocument();
    expect(container?.querySelector('[data-position-item="top"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-position-item="before"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-position-item="after"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-position-item="inside"]')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: REQUIRED_INDICATOR_STYLES ============

function RequiredIndicatorStylesDemo() {
  const { t } = useTranslation();
  const _styles: RequiredIndicatorStyle[] = REQUIRED_INDICATOR_STYLES;

  return (
    <div className="w-[400px] space-y-6" data-testid="required-indicator-styles-demo">
      <p className="text-muted-foreground text-sm">
        {t('label.variants.required')}: REQUIRED_INDICATOR_STYLES
      </p>
      {_styles.map((style) => (
        <div key={style} className="space-y-1" data-indicator-style={style}>
          <p className="font-mono text-xs">Style: {style}</p>
          <Label htmlFor={`ind-${style}`}>
            Email Address
            {style === 'asterisk' && <span className="text-destructive"> *</span>}
            {style === 'text' && <span className="text-destructive"> (required)</span>}
            {style === 'badge' && (
              <span className="bg-destructive text-destructive-foreground ml-1 inline-block rounded px-1 text-xs">
                Required
              </span>
            )}
          </Label>
          <Input
            id={`ind-${style}`}
            type="email"
            placeholder={i18n.t('label.story.emailPlaceholder', 'name@example.com')}
          />
        </div>
      ))}
    </div>
  );
}

export const ConstantRequiredIndicatorStyles: Story = {
  name: i18n.t(
    'label.storyName.constantRequiredIndicatorStyles',
    'Constant: REQUIRED_INDICATOR_STYLES'
  ),
  render: () => <RequiredIndicatorStylesDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="required-indicator-styles-demo"]');
    expect(container).toBeInTheDocument();
    expect(container?.querySelector('[data-indicator-style="asterisk"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-indicator-style="text"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-indicator-style="badge"]')).toBeInTheDocument();
    expect(container?.querySelector('[data-indicator-style="none"]')).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   conflict
//   notFound
//   emptyLabels
//   slowResponse
//   emptyData
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('label.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: labelStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('label.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: labelStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('label.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: labelStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyLabels: Story = {
  ...Default,
  name: i18n.t('label.storyName.handlerEmptyLabels', 'Handler: Empty Labels'),
  parameters: { msw: { handlers: labelStatusHandlers.emptyLabels } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('label.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: labelStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('label.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: labelStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
