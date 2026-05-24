import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import {
  STORY_INPUT_LABEL_NOT_FOUND,
  STORY_INPUT_NOT_FOUND,
  STORY_NO_DOM_ERROR,
} from '@/.storybook/stories/_utils/story-helpers';
import {
  CheckCircleIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderIcon,
  MailIcon,
  SearchIcon,
  UserIcon,
  XCircleIcon,
  XIcon,
} from 'lucide-react';

import { inputHandlers, inputStatusHandlers } from '@/.storybook/stories/_handlers/input.handlers';
import type {
  FakeField,
  FakeFileInput,
  FakeFormInput,
  FakeInput,
  FakeInputGroup,
  FakeInputOtp,
  FakeInputWithIcon,
  FakeLabel,
  FakeNumberInput,
  FakePasswordInput,
  FakeSearchInput,
  FakeTextarea,
  InputAutocomplete,
  InputMode,
  InputSize,
  InputType,
  InputValidationState,
} from '@/.storybook/stories/_factories/input.factory';
import {
  COMMON_INPUT_TYPES,
  createFakeContactInputs,
  createFakeDateInput,
  createFakeEmailInput,
  createFakeField,
  createFakeFields,
  createFakeFileInput,
  createFakeInput,
  createFakeInputFormData,
  createFakeInputGroup,
  createFakeInputGroups,
  createFakeInputOtp,
  createFakeInputOtps,
  createFakeInputs,
  createFakeInputShowcase,
  createFakeInputSizeMatrix,
  createFakeInputTypeMatrix,
  createFakeInputValidationMatrix,
  createFakeInputWithIcon,
  createFakeLabel,
  createFakeLabels,
  createFakeLoginInputs,
  createFakeNumberInput,
  createFakePasswordInput,
  createFakePhoneInput,
  createFakeProfileInputs,
  createFakeRegistrationInputs,
  createFakeSearchInput,
  createFakeTextarea,
  createFakeTextareas,
  createFakeUrlInput,
  INPUT_ERRORS,
  INPUT_LABELS,
  INPUT_MODES,
  INPUT_PLACEHOLDERS,
  INPUT_SIZES,
  INPUT_TYPES,
  INPUT_VALIDATION_STATES,
} from '@/.storybook/stories/_factories/input.factory';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============ HELPER FUNCTIONS ============

function getValidationStateColor(state: 'error' | 'success' | 'warning'): string {
  if (state === 'error') return 'text-destructive';
  if (state === 'success') return 'text-green-600';
  if (state === 'warning') return 'text-yellow-600';
  return 'text-muted-foreground';
}

// ============ I18N WRAPPER COMPONENTS ============

type PlaygroundDemoProps = {
  placeholder?: string;
} & React.ComponentProps<typeof Input>;

function I18nInputPlaygroundDemo({ placeholder, ...args }: PlaygroundDemoProps) {
  const { t } = useTranslation();

  return (
    <div className="w-[360px] space-y-2">
      <Label htmlFor="input">{t('input.label')}</Label>
      <Input id="input" placeholder={placeholder ?? t('input.placeholder')} {...args} />
    </div>
  );
}

function InputKeyboardInteractionDemo() {
  const { t } = useTranslation();
  const [value, setValue] = React.useState('');
  return (
    <div className="w-[360px] space-y-4">
      <p className="text-muted-foreground text-sm">{t('input.story.tabToFocus')}</p>
      <div className="space-y-2">
        <Label htmlFor="keyboard-input">{t('input.label')}</Label>
        <Input
          id="keyboard-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('input.placeholder')}
          data-testid="keyboard-input"
        />
      </div>
      <p className="text-sm">
        {t('input.story.valueLabel')}: {value || t('input.story.emptyValue')}
      </p>
    </div>
  );
}

function I18nInputStatesDemo() {
  const { t } = useTranslation();

  return (
    <div className="w-[360px] space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t('input.states.emailLabel')}</Label>
        <Input defaultValue="ada@example.com" id="email" type="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invalid">{t('input.states.invalidLabel')}</Label>
        <Input aria-invalid defaultValue={t('input.states.invalidValue')} id="invalid" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="disabled">{t('input.states.disabledLabel')}</Label>
        <Input disabled id="disabled" placeholder={t('input.states.disabledPlaceholder')} />
      </div>
    </div>
  );
}

function PasswordInputDemo() {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="w-[360px] space-y-2">
      <Label htmlFor="password">{t('input.password.label')}</Label>
      <div className="relative">
        <Input
          id="password"
          type={showPassword ? 'text' : 'password'}
          placeholder={t('input.password.placeholder')}
          className="pr-10"
          data-testid="password-input"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? t('input.password.hide') : t('input.password.show')}
          data-testid="password-toggle"
        >
          {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function ClearableInputDemo() {
  const { t } = useTranslation();
  const [value, setValue] = React.useState('');

  return (
    <div className="w-[360px] space-y-2">
      <Label htmlFor="clearable-input">{t('input.clearable.label')}</Label>
      <div className="relative">
        <Input
          id="clearable-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('input.clearable.placeholder')}
          className="pr-10"
          data-testid="clearable-input"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => setValue('')}
            aria-label={t('input.clearable.clear')}
            data-testid="clear-button"
          >
            <XIcon className="size-4" />
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-sm" data-testid="value-display">
        {t('input.story.valueLabel')}: {value || t('input.story.emptyValue')}
      </p>
    </div>
  );
}

function ValidationDemoInput() {
  const { t } = useTranslation();
  const [value, setValue] = React.useState('');
  const [touched, setTouched] = React.useState(false);

  const isValid = value.length >= 3;
  const showError = touched && !isValid;

  return (
    <div className="w-[360px] space-y-2">
      <Label htmlFor="validation-input">
        {t('input.validation.usernameLabel')} <span className="text-destructive">*</span>
      </Label>
      <Input
        id="validation-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={t('input.validation.usernamePlaceholder')}
        required
        aria-required="true"
        aria-invalid={showError}
        aria-describedby={showError ? 'validation-error' : undefined}
        data-testid="validation-input"
      />
      {showError && (
        <p
          id="validation-error"
          className="text-destructive text-sm"
          role="alert"
          data-testid="validation-error"
        >
          {t('input.validation.minLength', { min: 3 })}
        </p>
      )}
      {touched && isValid && (
        <p className="text-sm text-green-600" data-testid="validation-success">
          {t('input.validation.valid')}
        </p>
      )}
    </div>
  );
}

function DarkModeInputDemo() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">{t('input.story.darkModeDemo')}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dark-text">{t('input.variants.standard')}</Label>
            <Input id="dark-text" placeholder={t('input.placeholder')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dark-disabled">{t('input.variants.disabled')}</Label>
            <Input id="dark-disabled" placeholder={t('input.placeholder')} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dark-invalid">{t('input.variants.invalid')}</Label>
            <Input id="dark-invalid" defaultValue="invalid" aria-invalid />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dark-readonly">{t('input.variants.readOnly')}</Label>
            <Input
              id="dark-readonly"
              defaultValue={i18n.t('input.story.readOnlyValue', 'Read only value')}
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InputAriaDemo() {
  const { t } = useTranslation();
  return (
    <div className="w-[400px] space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('input.a11y.requiredField')}</h3>
        <Label htmlFor="aria-required">
          {t('input.a11y.emailLabel')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="aria-required"
          type="email"
          required
          aria-required="true"
          placeholder={t('input.a11y.emailPlaceholder')}
          data-testid="aria-required-input"
        />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('input.a11y.invalidField')}</h3>
        <Label htmlFor="aria-invalid">{t('input.a11y.emailLabel')}</Label>
        <Input
          id="aria-invalid"
          type="email"
          aria-invalid="true"
          aria-describedby="aria-error"
          defaultValue="invalid-email"
          data-testid="aria-invalid-input"
        />
        <p id="aria-error" className="text-destructive text-sm" role="alert">
          {t('input.a11y.invalidEmailMessage')}
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('input.a11y.withDescription')}</h3>
        <Label htmlFor="aria-described">{t('input.a11y.passwordLabel')}</Label>
        <Input
          id="aria-described"
          type="password"
          aria-describedby="password-hint"
          placeholder={t('input.a11y.passwordPlaceholder')}
          data-testid="aria-described-input"
        />
        <p id="password-hint" className="text-muted-foreground text-sm">
          {t('input.a11y.passwordHint')}
        </p>
      </div>
    </div>
  );
}

function JapaneseInputDemo() {
  const { t } = useTranslation();
  return (
    <div className="w-[360px] space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ja-input">{t('input.label')}</Label>
        <Input id="ja-input" placeholder={t('input.placeholder')} data-testid="ja-input" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ja-email">{t('input.states.emailLabel')}</Label>
        <Input
          id="ja-email"
          type="email"
          placeholder={i18n.t('input.story.emailPlaceholder', 'example@example.com')}
          data-testid="ja-email-input"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ja-disabled">{t('input.states.disabledLabel')}</Label>
        <Input
          id="ja-disabled"
          disabled
          placeholder={t('input.states.disabledPlaceholder')}
          data-testid="ja-disabled-input"
        />
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Input',
  component: Input,
  tags: ['autodocs'],
  args: {
    placeholder: i18n.t('input.story.enterText', 'Enter text...'),
    disabled: false,
    type: 'text',
    // Event handlers with fn() for Actions panel logging
    onChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onInput: fn(),
  },
  parameters: {
    msw: { handlers: inputHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    placeholder: {
      control: 'text',
      description: i18n.t(
        'input.argType.placeholderTextShownWhenInputIsEmpty',
        'Placeholder text shown when input is empty'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    defaultValue: {
      control: 'text',
      description: i18n.t(
        'input.argType.defaultValueForUncontrolledInput',
        'Default value for uncontrolled input'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    value: {
      control: 'text',
      description: i18n.t('input.argType.controlledValue', 'Controlled value'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Appearance
    type: {
      control: 'select',
      options: [
        'text',
        'email',
        'password',
        'number',
        'tel',
        'url',
        'search',
        'date',
        'time',
        'file',
      ],
      description: i18n.t('input.argType.htmlInputType', 'HTML input type'),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'text' },
        type: { summary: 'string' },
      },
    },
    className: {
      control: 'text',
      description: i18n.t('input.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'input.argType.whetherTheInputIsDisabled',
        'Whether the input is disabled'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    readOnly: {
      control: 'boolean',
      description: i18n.t(
        'input.argType.whetherTheInputIsReadonly',
        'Whether the input is read-only'
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
        'input.argType.whetherTheInputIsRequired',
        'Whether the input is required'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    'aria-invalid': {
      control: 'boolean',
      description: i18n.t(
        'input.argType.whetherTheInputHasInvalidState',
        'Whether the input has invalid state'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    'aria-required': {
      control: 'boolean',
      description: i18n.t(
        'input.argType.ariaRequiredAttributeForAccessibility',
        'ARIA required attribute for accessibility'
      ),
      table: {
        category: 'Accessibility',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    'aria-describedby': {
      control: 'text',
      description: i18n.t(
        'input.argType.idOfElementThatDescribesThisInput',
        'ID of element that describes this input'
      ),
      table: {
        category: 'Accessibility',
        type: { summary: 'string' },
      },
    },
    // Events
    onChange: {
      action: 'onChange',
      description: i18n.t('input.argType.changeEventHandler', 'Change event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('input.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('input.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('input.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('input.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============ CORE STORIES ============

export const Playground: Story = {
  render: (args) => <I18nInputPlaygroundDemo {...args} />,
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('#input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('data-slot', 'input');
  },
};

function InputVariantsDemo() {
  return (
    <div className="w-[400px] space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('input.variants.standard')}</p>
        <Input
          placeholder={i18n.t('input.story.standardInput', 'Standard input')}
          data-testid="standard-input"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('input.variants.withIcon')}</p>
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder={i18n.t('input.story.searchPlaceholder', 'Search...')}
            className="pl-9"
            data-testid="icon-input"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('input.variants.disabled')}</p>
        <Input
          placeholder={i18n.t('input.story.disabledInput', 'Disabled input')}
          disabled
          data-testid="disabled-input"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('input.variants.invalid')}</p>
        <Input
          placeholder={i18n.t('input.story.invalidInput', 'Invalid input')}
          aria-invalid
          defaultValue="invalid-email"
          data-testid="invalid-input"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('input.variants.readOnly')}</p>
        <Input
          defaultValue={i18n.t('input.story.readOnlyValue', 'Read only value')}
          readOnly
          data-testid="readonly-input"
        />
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <InputVariantsDemo />,
  play: async ({ canvasElement }) => {
    // Verify all variant inputs are rendered
    expect(canvasElement.querySelector('[data-testid="standard-input"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="icon-input"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="disabled-input"]')).toBeDisabled();
    expect(canvasElement.querySelector('[data-testid="invalid-input"]')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(canvasElement.querySelector('[data-testid="readonly-input"]')).toHaveAttribute(
      'readonly'
    );
  },
};

function InputSizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">{t('input.sizes.small')}</p>
        <Input placeholder={t('input.story.smallWidth', 'Small width')} className="w-48" />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('input.sizes.default')}</p>
        <Input placeholder={t('input.story.defaultWidth', 'Default width')} className="w-72" />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('input.sizes.large')}</p>
        <Input placeholder={t('input.story.largeWidth', 'Large width')} className="w-96" />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('input.sizes.fullWidth')}</p>
        <Input placeholder={t('input.story.fullWidth', 'Full width')} className="w-full" />
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <InputSizesDemo />,
  play: async ({ canvasElement }) => {
    const inputs = canvasElement.querySelectorAll('input');
    expect(inputs.length).toBe(4);
  },
};

export const States: Story = {
  render: () => <I18nInputStatesDemo />,
  play: async ({ canvasElement }) => {
    const emailInput = canvasElement.querySelector('#email');
    expect(emailInput).toHaveValue('ada@example.com');

    const invalidInput = canvasElement.querySelector('#invalid');
    expect(invalidInput).toHaveAttribute('aria-invalid', 'true');

    const disabledInput = canvasElement.querySelector('#disabled');
    expect(disabledInput).toBeDisabled();
  },
};

export const Types: Story = {
  render: () => (
    <div className="w-[360px] space-y-4">
      <div className="space-y-2">
        <Label htmlFor="text">{i18n.t('input.story.text', 'Text')}</Label>
        <Input
          id="text"
          type="text"
          placeholder={i18n.t('input.story.enterText', 'Enter text')}
          data-testid="type-text"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-type">{i18n.t('input.story.email', 'Email')}</Label>
        <Input
          id="email-type"
          type="email"
          placeholder={i18n.t('input.story.emailExample', 'email@example.com')}
          data-testid="type-email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password-type">{i18n.t('input.story.password', 'Password')}</Label>
        <Input
          id="password-type"
          type="password"
          placeholder={i18n.t('input.story.enterPassword', 'Enter password')}
          data-testid="type-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="number">{i18n.t('input.story.number', 'Number')}</Label>
        <Input id="number" type="number" placeholder="0" data-testid="type-number" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="search">{i18n.t('input.story.search', 'Search')}</Label>
        <Input
          id="search"
          type="search"
          placeholder={i18n.t('input.story.searchPlaceholder', 'Search...')}
          data-testid="type-search"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="date">{i18n.t('input.story.date', 'Date')}</Label>
        <Input id="date" type="date" data-testid="type-date" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="file">{i18n.t('input.story.file', 'File')}</Label>
        <Input id="file" type="file" data-testid="type-file" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Verify all type inputs have correct type attribute
    expect(canvasElement.querySelector('[data-testid="type-text"]')).toHaveAttribute(
      'type',
      'text'
    );
    expect(canvasElement.querySelector('[data-testid="type-email"]')).toHaveAttribute(
      'type',
      'email'
    );
    expect(canvasElement.querySelector('[data-testid="type-password"]')).toHaveAttribute(
      'type',
      'password'
    );
    expect(canvasElement.querySelector('[data-testid="type-number"]')).toHaveAttribute(
      'type',
      'number'
    );
    expect(canvasElement.querySelector('[data-testid="type-search"]')).toHaveAttribute(
      'type',
      'search'
    );
    expect(canvasElement.querySelector('[data-testid="type-date"]')).toHaveAttribute(
      'type',
      'date'
    );
    expect(canvasElement.querySelector('[data-testid="type-file"]')).toHaveAttribute(
      'type',
      'file'
    );
  },
};

export const WithIcons: Story = {
  render: () => (
    <div className="w-[360px] space-y-4">
      <div className="space-y-2">
        <Label htmlFor="search-icon">{i18n.t('input.story.search', 'Search')}</Label>
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id="search-icon"
            placeholder={i18n.t('input.story.searchPlaceholder', 'Search...')}
            className="pl-9"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-icon">{i18n.t('input.story.email', 'Email')}</Label>
        <div className="relative">
          <MailIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id="email-icon"
            type="email"
            placeholder={i18n.t('input.story.emailExample', 'email@example.com')}
            className="pl-9"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="username-icon">{i18n.t('input.story.username', 'Username')}</Label>
        <div className="relative">
          <UserIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id="username-icon"
            placeholder={i18n.t('input.story.enterUsername', 'Enter username')}
            className="pl-9"
          />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const inputs = canvasElement.querySelectorAll('input');
    expect(inputs.length).toBe(3);

    const searchInput = canvasElement.querySelector('#search-icon');
    expect(searchInput).toHaveClass('pl-9');

    const emailInput = canvasElement.querySelector('#email-icon');
    expect(emailInput).toHaveAttribute('type', 'email');
  },
};

// ============ INTERACTION STORIES ============

export const Password: Story = {
  render: () => <PasswordInputDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('password-input');
    const toggleButton = canvas.getByTestId('password-toggle');

    // Initially password type
    expect(input.getAttribute('type')).toBe('password');

    // Toggle to show password
    await userEvent.click(toggleButton);
    expect(input.getAttribute('type')).toBe('text');

    // Toggle back to hide
    await userEvent.click(toggleButton);
    expect(input.getAttribute('type')).toBe('password');
  },
};

export const Clearable: Story = {
  name: i18n.t('input.storyName.clearable', 'Clearable Input'),
  render: () => <ClearableInputDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('clearable-input');

    // Type text
    await userEvent.type(input, 'Hello World');
    expect(input).toHaveValue('Hello World');

    // Clear button should appear
    const clearButton = canvas.getByTestId('clear-button');
    expect(clearButton).toBeInTheDocument();

    // Click clear button
    await userEvent.click(clearButton);
    expect(input).toHaveValue('');

    // Clear button should disappear
    expect(canvas.queryByTestId('clear-button')).not.toBeInTheDocument();
  },
};

export const Validation: Story = {
  name: i18n.t('input.storyName.validation', 'Validation States'),
  render: () => <ValidationDemoInput />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('validation-input');

    // Initially no error
    expect(canvas.queryByTestId('validation-error')).not.toBeInTheDocument();

    // Blur without valid input
    await userEvent.click(input);
    await userEvent.tab();

    // Should show error
    await waitFor(() => {
      expect(canvas.getByTestId('validation-error')).toBeInTheDocument();
    });

    // Verify aria-invalid is set
    expect(input).toHaveAttribute('aria-invalid', 'true');

    // Type valid input
    await userEvent.type(input, 'abc');
    await userEvent.tab();

    // Should show success
    await waitFor(() => {
      expect(canvas.getByTestId('validation-success')).toBeInTheDocument();
    });

    // Verify aria-invalid is removed
    expect(input).toHaveAttribute('aria-invalid', 'false');
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: i18n.t('input.story.disabledInput', 'Disabled input'),
  },
  render: (args) => (
    <div className="w-[360px] space-y-2">
      <Label htmlFor="disabled-input">{i18n.t('input.story.disabled', 'Disabled')}</Label>
      <Input id="disabled-input" {...args} data-testid="disabled-test-input" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('[data-testid="disabled-test-input"]');
    expect(input).toBeDisabled();

    // Try to type - should not work
    await userEvent.type(input as HTMLInputElement, 'test');
    expect(input).toHaveValue('');
  },
};

export const ReadOnly: Story = {
  args: {
    readOnly: true,
    defaultValue: i18n.t('input.story.readOnlyText', 'This is read-only text'),
  },
  render: (args) => (
    <div className="w-[360px] space-y-2">
      <Label htmlFor="readonly-input">{i18n.t('input.story.readOnly', 'Read Only')}</Label>
      <Input id="readonly-input" {...args} data-testid="readonly-test-input" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('[data-testid="readonly-test-input"]');
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveValue('This is read-only text');
  },
};

export const Invalid: Story = {
  args: {
    'aria-invalid': true,
    defaultValue: 'invalid-email',
  },
  render: (args) => (
    <div className="w-[360px] space-y-2">
      <Label htmlFor="invalid-input">{i18n.t('input.story.emailInvalid', 'Email (Invalid)')}</Label>
      <Input id="invalid-input" type="email" {...args} data-testid="invalid-test-input" />
      <p className="text-destructive text-sm">
        {i18n.t('input.story.pleaseEnterAValidEmailAddress', 'Please enter a valid email address')}
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('[data-testid="invalid-test-input"]');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  },
};

export const Required: Story = {
  args: {
    required: true,
    placeholder: i18n.t('input.story.thisFieldIsRequired', 'This field is required'),
  },
  render: (args) => (
    <div className="w-[360px] space-y-2">
      <Label htmlFor="required-input">
        {i18n.t('input.story.requiredField', 'Required Field')}{' '}
        <span className="text-destructive">*</span>
      </Label>
      <Input id="required-input" {...args} data-testid="required-test-input" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('[data-testid="required-test-input"]');
    expect(input).toHaveAttribute('required');
    expect(input).toHaveAttribute('aria-required', 'true');
  },
};

// ============ KEYBOARD INTERACTION STORIES ============

export const KeyboardInteraction: Story = {
  name: i18n.t('input.storyName.keyboardInteraction', 'Keyboard Interaction'),
  render: () => <InputKeyboardInteractionDemo />,
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('[data-testid="keyboard-input"]') as HTMLInputElement;

    // Tab to focus
    await userEvent.tab();
    expect(input).toHaveFocus();

    // Type text
    await userEvent.type(input, 'Hello World');
    expect(input.value).toBe('Hello World');

    // Backspace deletes
    await userEvent.keyboard('{Backspace}{Backspace}');
    expect(input.value).toBe('Hello Wor');

    // Select all and delete
    await userEvent.keyboard('{Control>}a{/Control}');
    await userEvent.keyboard('{Delete}');
    expect(input.value).toBe('');
  },
};

export const TabNavigation: Story = {
  name: i18n.t('input.storyName.tabNavigation', 'Tab Navigation'),
  render: () => (
    <div className="w-[360px] space-y-4">
      <div className="space-y-2">
        <Label htmlFor="first-input">{i18n.t('input.story.firstInput', 'First Input')}</Label>
        <Input
          id="first-input"
          placeholder={i18n.t('input.story.tabHereFirst', 'Tab here first')}
          data-testid="first-input"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="second-input">{i18n.t('input.story.secondInput', 'Second Input')}</Label>
        <Input
          id="second-input"
          placeholder={i18n.t('input.story.tabHereSecond', 'Tab here second')}
          data-testid="second-input"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="third-input">{i18n.t('input.story.thirdInput', 'Third Input')}</Label>
        <Input
          id="third-input"
          placeholder={i18n.t('input.story.tabHereThird', 'Tab here third')}
          data-testid="third-input"
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const firstInput = canvasElement.querySelector('[data-testid="first-input"]');
    const secondInput = canvasElement.querySelector('[data-testid="second-input"]');
    const thirdInput = canvasElement.querySelector('[data-testid="third-input"]');

    // Tab to first input
    await userEvent.tab();
    expect(firstInput).toHaveFocus();

    // Tab to second input
    await userEvent.tab();
    expect(secondInput).toHaveFocus();

    // Tab to third input
    await userEvent.tab();
    expect(thirdInput).toHaveFocus();

    // Shift+Tab back to second
    await userEvent.tab({ shift: true });
    expect(secondInput).toHaveFocus();
  },
};

export const FocusStates: Story = {
  name: i18n.t('input.storyName.focusStates', 'Focus States'),
  render: () => (
    <div className="w-[360px] space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'input.story.focusRingDescription',
          'Focus the input to see the focus ring. The focus ring should be visible and meet WCAG contrast requirements.'
        )}
      </p>
      <div className="space-y-2">
        <Label htmlFor="focus-input">{i18n.t('input.story.focusMe', 'Focus me')}</Label>
        <Input
          id="focus-input"
          placeholder={i18n.t('input.story.clickOrTabToFocus', 'Click or tab to focus')}
          data-testid="focus-test-input"
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('[data-testid="focus-test-input"]');

    // Focus the input
    await userEvent.click(input as HTMLInputElement);
    expect(input).toHaveFocus();

    // Check that data-slot is present for styling
    expect(input).toHaveAttribute('data-slot', 'input');
  },
};

// ============ ACCESSIBILITY STORIES ============

export const AriaAttributes: Story = {
  name: i18n.t('input.storyName.ariaAttributes', 'ARIA Attributes'),
  render: () => <InputAriaDemo />,
  play: async ({ canvasElement }) => {
    // Test: Required input has aria-required
    const requiredInput = canvasElement.querySelector('[data-testid="aria-required-input"]');
    expect(requiredInput).toHaveAttribute('aria-required', 'true');
    expect(requiredInput).toHaveAttribute('required');

    // Test: Invalid input has aria-invalid and aria-describedby
    const invalidInput = canvasElement.querySelector('[data-testid="aria-invalid-input"]');
    expect(invalidInput).toHaveAttribute('aria-invalid', 'true');
    expect(invalidInput).toHaveAttribute('aria-describedby', 'aria-error');

    // Test: Error message has role="alert"
    const errorMessage = canvasElement.querySelector('#aria-error');
    expect(errorMessage).toHaveAttribute('role', 'alert');

    // Test: Described input has aria-describedby
    const describedInput = canvasElement.querySelector('[data-testid="aria-described-input"]');
    expect(describedInput).toHaveAttribute('aria-describedby', 'password-hint');
  },
};

export const Accessibility: Story = {
  name: i18n.t('input.storyName.accessibility', 'Accessibility Testing'),
  render: () => (
    <div className="w-[400px] space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          {i18n.t('input.story.properlyLabeledInput', 'Properly Labeled Input')}
        </h3>
        <Label htmlFor="a11y-labeled">{i18n.t('input.story.emailAddress', 'Email Address')}</Label>
        <Input
          id="a11y-labeled"
          type="email"
          placeholder={i18n.t('input.story.emailExample', 'email@example.com')}
          data-testid="a11y-labeled"
        />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          {i18n.t('input.story.requiredField', 'Required Field')}
        </h3>
        <Label htmlFor="a11y-required">
          {i18n.t('input.story.username', 'Username')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="a11y-required"
          required
          placeholder={i18n.t('input.story.enterUsername', 'Enter username')}
          aria-required="true"
          data-testid="a11y-required"
        />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          {i18n.t('input.story.invalidStateWithError', 'Invalid State with Error Message')}
        </h3>
        <Label htmlFor="a11y-invalid">{i18n.t('input.story.email', 'Email')}</Label>
        <Input
          id="a11y-invalid"
          type="email"
          aria-invalid="true"
          aria-describedby="a11y-error"
          defaultValue="invalid-email"
          data-testid="a11y-invalid"
        />
        <p id="a11y-error" className="text-destructive text-sm" role="alert">
          {i18n.t('input.story.pleaseEnterValidEmail', 'Please enter a valid email address')}
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          {i18n.t('input.story.disabledField', 'Disabled Field')}
        </h3>
        <Label htmlFor="a11y-disabled">
          {i18n.t('input.story.disabledField', 'Disabled Field')}
        </Label>
        <Input
          id="a11y-disabled"
          disabled
          placeholder={i18n.t('input.story.cannotEdit', 'Cannot edit')}
          data-testid="a11y-disabled"
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test: All inputs have associated labels
    const inputs = canvasElement.querySelectorAll('input');
    inputs.forEach((input) => {
      const id = input.getAttribute('id');
      if (id) {
        const label = canvasElement.querySelector(`label[for="${id}"]`);
        expect(label).toBeInTheDocument();
      }
    });

    // Test: Required input has aria-required
    const requiredInput = canvasElement.querySelector('[data-testid="a11y-required"]');
    expect(requiredInput).toHaveAttribute('aria-required', 'true');

    // Test: Invalid input has aria-invalid and aria-describedby
    const invalidInput = canvasElement.querySelector('[data-testid="a11y-invalid"]');
    expect(invalidInput).toHaveAttribute('aria-invalid', 'true');
    expect(invalidInput).toHaveAttribute('aria-describedby', 'a11y-error');

    // Test: Error message has role="alert"
    const errorMessage = canvasElement.querySelector('#a11y-error');
    expect(errorMessage).toHaveAttribute('role', 'alert');

    // Test: Disabled input is properly disabled
    const disabledInput = canvasElement.querySelector('[data-testid="a11y-disabled"]');
    expect(disabledInput).toBeDisabled();

    // Test: Keyboard navigation works
    const labeledInput = canvas.getByLabelText('Email Address');
    await userEvent.tab();
    expect(labeledInput).toHaveFocus();

    // Test: Can type in focused input
    await userEvent.type(labeledInput, 'test@example.com');
    expect(labeledInput).toHaveValue('test@example.com');
  },
  parameters: {
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
};

export const AccessibilityWithDescriptions: Story = {
  name: i18n.t('input.storyName.accessibilityWithDescriptions', 'Input with Help Text'),
  render: () => (
    <div className="w-[400px] space-y-6">
      <div className="space-y-2">
        <Label htmlFor="password-help">{i18n.t('input.story.password', 'Password')}</Label>
        <Input
          id="password-help"
          type="password"
          aria-describedby="password-requirements"
          placeholder={i18n.t('input.story.createPassword', 'Create a password')}
          data-testid="password-help-input"
        />
        <p id="password-requirements" className="text-muted-foreground text-sm">
          {i18n.t(
            'input.story.passwordRequirements',
            'Must be at least 8 characters with one uppercase, one lowercase, and one number.'
          )}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="username-help">{i18n.t('input.story.username', 'Username')}</Label>
        <Input
          id="username-help"
          aria-describedby="username-hint"
          placeholder={i18n.t('input.story.chooseUsername', 'Choose a username')}
          data-testid="username-help-input"
        />
        <p id="username-hint" className="text-muted-foreground text-sm">
          {i18n.t(
            'input.story.usernameHint',
            'Letters, numbers, and underscores only. 3-20 characters.'
          )}
        </p>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Test: Inputs have aria-describedby pointing to help text
    const passwordInput = canvasElement.querySelector('[data-testid="password-help-input"]');
    expect(passwordInput).toHaveAttribute('aria-describedby', 'password-requirements');

    const usernameInput = canvasElement.querySelector('[data-testid="username-help-input"]');
    expect(usernameInput).toHaveAttribute('aria-describedby', 'username-hint');

    // Test: Help text elements exist
    expect(canvasElement.querySelector('#password-requirements')).toBeInTheDocument();
    expect(canvasElement.querySelector('#username-hint')).toBeInTheDocument();
  },
};

// ============ VISUAL / THEME STORIES ============

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    const label = canvasElement.querySelector('label[for="input"]');
    if (!(label instanceof HTMLLabelElement)) {
      throw new Error(STORY_INPUT_LABEL_NOT_FOUND);
    }
    expect(label.textContent?.trim().length).not.toBe(0);

    const input = canvasElement.querySelector('#input');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error(STORY_INPUT_NOT_FOUND);
    }

    expect(input.getAttribute('data-slot')).toBe('input');
    expect(input).not.toBeDisabled();
    expect(input.placeholder.trim().length).not.toBe(0);

    await userEvent.click(input);
    expect(doc.activeElement).toBe(input);

    await userEvent.type(input, 'abc');
    expect(input.value).toBe('abc');
  },
};

export const Dark: Story = {
  name: i18n.t('input.storyName.dark', 'Dark Mode'),
  render: () => <DarkModeInputDemo />,
  globals: {
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    // Verify inputs are rendered in dark mode
    const inputs = canvasElement.querySelectorAll('input');
    expect(inputs.length).toBe(4);

    // Check disabled state
    const disabledInput = canvasElement.querySelector('#dark-disabled');
    expect(disabledInput).toBeDisabled();

    // Check invalid state
    const invalidInput = canvasElement.querySelector('#dark-invalid');
    expect(invalidInput).toHaveAttribute('aria-invalid', 'true');

    // Check readonly state
    const readonlyInput = canvasElement.querySelector('#dark-readonly');
    expect(readonlyInput).toHaveAttribute('readonly');
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.dir).toBe('rtl');

    const input = canvasElement.querySelector('#input');
    expect(input).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  name: i18n.t('input.storyName.japanese', 'Japanese Locale'),
  globals: {
    locale: 'ja',
  },
  render: () => <JapaneseInputDemo />,
  play: async ({ canvasElement }) => {
    // Verify Japanese text is rendered
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const label = canvasElement.querySelector('label[for="ja-input"]');
    if (!(label instanceof HTMLLabelElement)) {
      throw new Error(STORY_INPUT_LABEL_NOT_FOUND);
    }
    expect(label.textContent?.trim()).toBe('ラベル');

    const input = canvasElement.querySelector('[data-testid="ja-input"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error(STORY_INPUT_NOT_FOUND);
    }
    expect(input.placeholder).toBe('ここに入力…');

    // Verify we can type in Japanese input
    await userEvent.type(input, 'テスト');
    expect(input.value).toBe('テスト');
  },
};

export const DarkModeJapanese: Story = {
  name: i18n.t('input.storyName.darkModeJapanese', 'Dark Mode + Japanese'),
  globals: {
    locale: 'ja',
    theme: 'dark',
  },
  render: () => <JapaneseInputDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const inputs = canvasElement.querySelectorAll('input');
    expect(inputs.length).toBe(3);
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
  name: i18n.t('input.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    msw: { handlers: inputHandlers },
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('#input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('data-slot', 'input');
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: inputStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('#input');
    expect(input).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: inputStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('#input');
    expect(input).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: inputStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('#input');
    expect(input).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: inputStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('#input');
    expect(input).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: inputStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('#input');
    expect(input).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: inputStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('#input');
    expect(input).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: inputStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('#input');
    expect(input).toBeInTheDocument();
  },
};

// ============ FAKER DATA STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const fakeInputs = createFakeInputs(4);
    return (
      <div className="w-[400px] space-y-4">
        {fakeInputs.map((fakeInput) => (
          <div key={fakeInput.id} className="space-y-2">
            <Label htmlFor={fakeInput.id}>
              {fakeInput.label}
              {fakeInput.required && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id={fakeInput.id}
              type={fakeInput.type}
              placeholder={fakeInput.placeholder}
              disabled={fakeInput.disabled}
              required={fakeInput.required}
              defaultValue={fakeInput.defaultValue}
            />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const inputs = canvasElement.querySelectorAll('input');
    expect(inputs.length).toBe(4);
  },
};

export const WithFakerFormData: Story = {
  render: () => {
    const fakeData = createFakeInputFormData();
    return (
      <div className="w-[400px] space-y-4">
        <div className="space-y-2">
          <Label htmlFor="faker-name">{i18n.t('input.story.fullName', 'Full Name')}</Label>
          <Input id="faker-name" defaultValue={fakeData.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="faker-email">{i18n.t('input.story.email', 'Email')}</Label>
          <Input id="faker-email" type="email" defaultValue={fakeData.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="faker-phone">{i18n.t('input.story.phone', 'Phone')}</Label>
          <Input id="faker-phone" type="tel" defaultValue={fakeData.phone} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="faker-address">{i18n.t('input.story.address', 'Address')}</Label>
          <Input id="faker-address" defaultValue={fakeData.address} />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const inputs = canvasElement.querySelectorAll('input');
    expect(inputs.length).toBe(4);
    inputs.forEach((input) => {
      expect((input as HTMLInputElement).value.length).not.toBe(0);
    });
  },
};

// ============ ASYNC VALIDATION STORIES ============

function AsyncEmailValidation() {
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [message, setMessage] = React.useState('');

  const validateEmail = async (value: string) => {
    if (!value || !value.includes('@')) {
      setStatus('idle');
      setMessage('');
      return;
    }

    setStatus('validating');
    setMessage('');

    try {
      const response = await fetch('/api/validate/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });

      const data = (await response.json()) as { available?: boolean; message?: string };
      setStatus(data.available ? 'valid' : 'invalid');
      setMessage(data.message ?? '');
    } catch {
      setStatus('invalid');
      setMessage(i18n.t('input.async.validationFailed'));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setEmail(value);
    void validateEmail(value);
  };

  return (
    <div className="w-[400px] space-y-2" data-testid="async-email-validation">
      <Label htmlFor="async-email">{i18n.t('input.async.emailLabel')}</Label>
      <div className="relative">
        <Input
          id="async-email"
          type="email"
          value={email}
          onChange={handleChange}
          placeholder={i18n.t('input.async.emailPlaceholder')}
          className="pr-10"
          aria-invalid={status === 'invalid'}
          data-state={status}
          data-testid="email-input"
        />
        {status === 'validating' && (
          <LoaderIcon className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
        )}
        {status === 'valid' && (
          <CheckCircleIcon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-green-600" />
        )}
        {status === 'invalid' && (
          <XCircleIcon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-red-600" />
        )}
      </div>
      {message && (
        <p
          className={`text-sm ${status === 'valid' ? 'text-green-600' : 'text-red-600'}`}
          data-testid="validation-message"
        >
          {message}
        </p>
      )}
    </div>
  );
}

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: inputHandlers },
  },
  render: () => <AsyncEmailValidation />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const emailInput = canvas.getByTestId('email-input');

    expect(emailInput.getAttribute('data-state')).toBe('idle');

    // Type an email to trigger validation
    await userEvent.type(emailInput, 'test@example.com');

    // Should show validating state
    await waitFor(() => {
      expect(emailInput.getAttribute('data-state')).toBe('validating');
    });

    // Wait for validation to complete
    await waitFor(
      () => {
        const state = emailInput.getAttribute('data-state');
        expect(state).toMatch(/^(valid|invalid)$/);
      },
      { timeout: 3000 }
    );
  },
};

export const EmptyData: Story = {
  render: () => (
    <div className="w-[400px] space-y-4">
      <div className="space-y-2">
        <Label htmlFor="empty-input">{i18n.t('input.story.emptyInput', 'Empty Input')}</Label>
        <Input
          id="empty-input"
          placeholder={i18n.t('input.story.thisFieldIsEmpty', 'This field is empty')}
        />
        <p className="text-muted-foreground text-sm">
          {i18n.t('input.story.noDataToDisplay', 'No data to display.')}
        </p>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('#empty-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('');
  },
};

export const SlowResponse: Story = {
  name: i18n.t('input.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: inputStatusHandlers.slowSubmission },
  },
  render: () => <AsyncEmailValidation />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const emailInput = canvas.getByTestId('email-input');

    await userEvent.type(emailInput, 'slow@example.com');

    // Should show validating state for a while
    await waitFor(() => {
      expect(emailInput.getAttribute('data-state')).toBe('validating');
    });
  },
};

// ============ HTTP 5xx ERROR STORIES ============

export const Error502BadGateway: Story = {
  name: i18n.t('input.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: inputStatusHandlers.badGateway },
  },
  render: () => <AsyncEmailValidation />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="async-email-validation"]');
    expect(container).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('input.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: inputStatusHandlers.serviceUnavailable },
  },
  render: () => <AsyncEmailValidation />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="async-email-validation"]');
    expect(container).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('input.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: inputStatusHandlers.gatewayTimeout },
  },
  render: () => <AsyncEmailValidation />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="async-email-validation"]');
    expect(container).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('input.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: inputStatusHandlers.tooManyRequests },
  },
  render: () => <AsyncEmailValidation />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="async-email-validation"]');
    expect(container).toBeInTheDocument();
  },
};

// ============ ENTERPRISE FEATURE STORIES ============

export const ValidationMatrix: Story = {
  name: i18n.t('input.storyName.validationMatrix', 'Validation State Matrix'),
  render: () => {
    const matrix = createFakeInputValidationMatrix();
    return (
      <div className="w-[400px] space-y-4">
        {Object.entries(matrix).map(([state, input]) => (
          <div key={state} className="space-y-2">
            <p className="text-sm font-medium capitalize">{state}</p>
            <Input
              placeholder={input.placeholder}
              defaultValue={input.defaultValue}
              aria-invalid={state === 'error'}
              className={state === 'error' ? 'border-destructive' : ''}
            />
            {input.error && (
              <p
                className={`text-sm ${getValidationStateColor(state as 'error' | 'success' | 'warning')}`}
              >
                {input.error}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const inputs = canvasElement.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThan(0);

    const errorInput = [...inputs].find((input) =>
      input.hasAttribute('aria-invalid')
    ) as HTMLInputElement;
    if (errorInput) {
      expect(errorInput).toHaveAttribute('aria-invalid', 'true');
    }
  },
};

export const AllInputTypes: Story = {
  name: i18n.t('input.storyName.allInputTypes', 'All Input Types Matrix'),
  render: () => {
    const commonTypes = ['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date'];
    return (
      <div className="w-[400px] space-y-4">
        {commonTypes.map((type) => {
          const fakeInput = createFakeInput({ type: type as InputType });
          return (
            <div key={type} className="space-y-2">
              <Label htmlFor={`type-${type}`}>
                {fakeInput.label} <span className="text-muted-foreground">({type})</span>
              </Label>
              <Input id={`type-${type}`} type={type} placeholder={fakeInput.placeholder} />
            </div>
          );
        })}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const inputs = canvasElement.querySelectorAll('input');
    expect(inputs.length).toBe(8);

    const textInput = canvasElement.querySelector('#type-text');
    expect(textInput).toHaveAttribute('type', 'text');

    const emailInput = canvasElement.querySelector('#type-email');
    expect(emailInput).toHaveAttribute('type', 'email');

    const passwordInput = canvasElement.querySelector('#type-password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const numberInput = canvasElement.querySelector('#type-number');
    expect(numberInput).toHaveAttribute('type', 'number');
  },
};

export const DataAttributes: Story = {
  name: i18n.t('input.storyName.dataAttributes', 'Data Attributes'),
  render: () => (
    <div className="w-[400px] space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'input.story.dataAttributesDescription',
          'All inputs expose data-* attributes for CSS targeting and testing'
        )}
      </p>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="data-default">{i18n.t('input.story.default', 'Default')}</Label>
          <Input
            id="data-default"
            placeholder={i18n.t('input.story.defaultInput', 'Default input')}
            data-testid="data-default"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data-custom">
            {i18n.t('input.story.customTestId', 'Custom Test ID')}
          </Label>
          <Input
            id="data-custom"
            placeholder={i18n.t('input.story.customTestIdPlaceholder', 'Custom testId')}
            testId="my-custom-input"
            data-testid="data-custom"
          />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Verify data-slot attribute
    const defaultInput = canvasElement.querySelector('[data-testid="data-default"]');
    expect(defaultInput).toHaveAttribute('data-slot', 'input');

    // Verify custom testId
    const customInput = canvasElement.querySelector('[data-testid="my-custom-input"]');
    expect(customInput).toBeInTheDocument();
  },
};

// ============ FACTORY WIRING STORIES ============
// The following stories wire ALL remaining exports from input.factory.ts

function getSizeClassName(size: InputSize): string {
  if (size === 'sm') return 'h-8 text-xs';
  if (size === 'lg') return 'h-11 text-lg';
  return '';
}

function getGroupInputClassName(
  hasPrefix: boolean,
  hasSuffix: boolean,
  idx: number,
  total: number
): string {
  if (!hasPrefix && idx === 0) return 'rounded-r-none';
  if (!hasSuffix && idx === total - 1) return 'rounded-l-none';
  return 'rounded-none';
}

// --- Constants: INPUT_TYPES, COMMON_INPUT_TYPES ---

function FactoryInputTypesDemo() {
  return (
    <div className="w-[500px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.typeMatrixTitle')}</h3>
      <p className="text-muted-foreground text-sm">
        {i18n.t('input.factory.allTypesDesc', { count: INPUT_TYPES.length })}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {INPUT_TYPES.map((type) => (
          <div key={type} className="space-y-1">
            <Label htmlFor={`factory-type-${type}`} className="text-xs capitalize">
              {type}
            </Label>
            <Input
              id={`factory-type-${type}`}
              type={type}
              placeholder={INPUT_PLACEHOLDERS[type]?.[0] ?? 'Enter...'}
              data-testid={`factory-type-${type}`}
            />
          </div>
        ))}
      </div>
      <div className="border-t pt-3">
        <p className="text-muted-foreground text-xs">
          Common types: {COMMON_INPUT_TYPES.join(', ')}
        </p>
      </div>
    </div>
  );
}

export const FactoryInputTypes: Story = {
  name: i18n.t('input.storyName.factoryInputTypes', 'Factory: All Input Types'),
  render: () => <FactoryInputTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Verify all INPUT_TYPES rendered
    for (const type of INPUT_TYPES) {
      const input = canvasElement.querySelector(`[data-testid="factory-type-${type}"]`);
      expect(input).toBeInTheDocument();
    }
    // Verify COMMON_INPUT_TYPES text displayed
    expect(canvas.getByText(/Common types:/)).toBeInTheDocument();
  },
};

// --- Constants: INPUT_SIZES, INPUT_VALIDATION_STATES, INPUT_MODES ---

function FactoryInputSizesConstDemo() {
  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.sizeMatrixTitle')}</h3>
      <p className="text-muted-foreground text-sm">{i18n.t('input.factory.allSizesDesc')}</p>
      {INPUT_SIZES.map((size) => (
        <div key={size} className="space-y-1">
          <Label htmlFor={`size-const-${size}`} className="text-xs capitalize">
            {size}
          </Label>
          <Input
            id={`size-const-${size}`}
            placeholder={`Size: ${size}`}
            className={getSizeClassName(size)}
            data-testid={`size-const-${size}`}
          />
        </div>
      ))}
      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium">
          {i18n.t('input.story.validationStates', 'Validation States')}
        </p>
        <div className="flex gap-2">
          {INPUT_VALIDATION_STATES.map((state) => (
            <span
              key={state}
              className={`inline-block rounded px-2 py-0.5 text-xs ${getValidationStateColor(state)}`}
              data-testid={`validation-badge-${state}`}
            >
              {state}
            </span>
          ))}
        </div>
      </div>
      <div className="border-t pt-3">
        <p className="text-xs font-medium">{i18n.t('input.story.inputModes', 'Input Modes')}</p>
        <p className="text-muted-foreground text-xs">{INPUT_MODES.join(', ')}</p>
      </div>
    </div>
  );
}

export const FactoryInputSizesConst: Story = {
  name: i18n.t(
    'input.storyName.factoryInputSizesConst',
    'Factory: Sizes, Validation States & Modes'
  ),
  render: () => <FactoryInputSizesConstDemo />,
  play: async ({ canvasElement }) => {
    for (const size of INPUT_SIZES) {
      const input = canvasElement.querySelector(`[data-testid="size-const-${size}"]`);
      expect(input).toBeInTheDocument();
    }
    for (const state of INPUT_VALIDATION_STATES) {
      const badge = canvasElement.querySelector(`[data-testid="validation-badge-${state}"]`);
      expect(badge).toBeInTheDocument();
    }
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Input Modes/)).toBeInTheDocument();
  },
};

// --- Constants: INPUT_PLACEHOLDERS, INPUT_LABELS, INPUT_ERRORS ---

function FactoryPlaceholdersLabelsErrorsDemo() {
  // Show a subset of types to keep it visually manageable
  const displayTypes: InputType[] = ['text', 'email', 'password', 'number', 'tel', 'url'];
  return (
    <div className="w-[500px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.showcaseTitle')}</h3>
      {displayTypes.map((type) => {
        const labels = INPUT_LABELS[type];
        const placeholders = INPUT_PLACEHOLDERS[type];
        const errors = INPUT_ERRORS[type];
        return (
          <div key={type} className="space-y-2 rounded border p-3">
            <p className="text-xs font-medium capitalize">{type}</p>
            <div className="space-y-1">
              <Label htmlFor={`ple-${type}`}>{labels[0]}</Label>
              <Input
                id={`ple-${type}`}
                type={type}
                placeholder={placeholders[0]}
                aria-invalid={!!errors[0]}
                data-testid={`ple-${type}`}
              />
              {errors[0] && (
                <p className="text-destructive text-xs" data-testid={`ple-error-${type}`}>
                  {errors[0]}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const FactoryPlaceholdersLabelsErrors: Story = {
  name: i18n.t(
    'input.storyName.factoryPlaceholdersLabelsErrors',
    'Factory: Placeholders, Labels & Errors'
  ),
  render: () => <FactoryPlaceholdersLabelsErrorsDemo />,
  play: async ({ canvasElement }) => {
    const types = ['text', 'email', 'password', 'number', 'tel', 'url'];
    for (const type of types) {
      const input = canvasElement.querySelector(`[data-testid="ple-${type}"]`);
      expect(input).toBeInTheDocument();
    }
    // Verify at least one error message is shown
    const errorEl = canvasElement.querySelector('[data-testid^="ple-error-"]');
    expect(errorEl).toBeInTheDocument();
  },
};

// --- Function: createFakePasswordInput, Interface: FakePasswordInput ---

function FactoryPasswordInputDemo() {
  const fakePassword: FakePasswordInput = createFakePasswordInput({
    showToggle: true,
    required: true,
  });
  const [showPw, setShowPw] = React.useState(false);

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.passwordTitle')}</h3>
      <div className="space-y-2">
        <Label htmlFor={fakePassword.id}>{fakePassword.label}</Label>
        <div className="relative">
          <Input
            id={fakePassword.id}
            type={showPw ? 'text' : 'password'}
            placeholder={fakePassword.placeholder}
            required={fakePassword.required}
            disabled={fakePassword.disabled}
            className="pr-10"
            data-testid="factory-password-input"
          />
          {fakePassword.showToggle && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              onClick={() => setShowPw(!showPw)}
              data-testid="factory-password-toggle"
            >
              {showPw ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </Button>
          )}
        </div>
      </div>
      {fakePassword.requirements && (
        <div className="space-y-1" data-testid="factory-password-requirements">
          <p className="text-xs font-medium">{i18n.t('input.factory.passwordRequirements')}</p>
          <ul className="text-muted-foreground list-disc pl-4 text-xs">
            <li>
              {i18n.t('input.factory.passwordMinLength', {
                min: fakePassword.requirements.minLength,
              })}
            </li>
            {fakePassword.requirements.requireUppercase && (
              <li>{i18n.t('input.factory.passwordUppercase')}</li>
            )}
            {fakePassword.requirements.requireLowercase && (
              <li>{i18n.t('input.factory.passwordLowercase')}</li>
            )}
            {fakePassword.requirements.requireNumber && (
              <li>{i18n.t('input.factory.passwordNumber')}</li>
            )}
            {fakePassword.requirements.requireSpecial && (
              <li>{i18n.t('input.factory.passwordSpecial')}</li>
            )}
          </ul>
        </div>
      )}
      {fakePassword.confirmField && (
        <div className="space-y-2" data-testid="factory-password-confirm">
          <Label htmlFor={fakePassword.confirmField.id}>
            {i18n.t('input.factory.passwordConfirmLabel')}
          </Label>
          <Input
            id={fakePassword.confirmField.id}
            type="password"
            placeholder={fakePassword.confirmField.placeholder}
            data-testid="factory-password-confirm-input"
          />
        </div>
      )}
    </div>
  );
}

export const FactoryPasswordInput: Story = {
  name: i18n.t('input.storyName.factoryPasswordInput', 'Factory: Password Input'),
  render: () => <FactoryPasswordInputDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('factory-password-input');
    expect(input).toBeInTheDocument();
    expect(input.getAttribute('type')).toBe('password');

    // Toggle password visibility
    const toggleBtn = canvas.getByTestId('factory-password-toggle');
    await userEvent.click(toggleBtn);
    expect(input.getAttribute('type')).toBe('text');

    // Verify requirements displayed
    const reqs = canvas.getByTestId('factory-password-requirements');
    expect(reqs).toBeInTheDocument();
  },
};

// --- Function: createFakeSearchInput, Interface: FakeSearchInput ---

function FactorySearchInputDemo() {
  const fakeSearch: FakeSearchInput = createFakeSearchInput({
    clearable: true,
    suggestions: [
      i18n.t('input.story.products', 'Products'),
      i18n.t('input.story.users', 'Users'),
      i18n.t('input.story.documents', 'Documents'),
    ],
  });
  const [value, setValue] = React.useState('');

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.searchTitle')}</h3>
      <div className="space-y-2">
        <Label htmlFor={fakeSearch.id}>{fakeSearch.label}</Label>
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id={fakeSearch.id}
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={fakeSearch.placeholder}
            className="pr-10 pl-9"
            data-testid="factory-search-input"
          />
          {fakeSearch.clearable && value && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              onClick={() => setValue('')}
              data-testid="factory-search-clear"
            >
              <XIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {fakeSearch.suggestions && (
        <div data-testid="factory-search-suggestions">
          <p className="text-xs font-medium">{i18n.t('input.factory.searchSuggestions')}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {fakeSearch.suggestions.map((s) => (
              <span key={s} className="bg-muted rounded px-2 py-0.5 text-xs">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const FactorySearchInput: Story = {
  name: i18n.t('input.storyName.factorySearchInput', 'Factory: Search Input'),
  render: () => <FactorySearchInputDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('factory-search-input');
    expect(input).toBeInTheDocument();

    // Type and verify clear button appears
    await userEvent.type(input, 'test');
    expect(input).toHaveValue('test');
    const clearBtn = canvas.getByTestId('factory-search-clear');
    expect(clearBtn).toBeInTheDocument();
    await userEvent.click(clearBtn);
    expect(input).toHaveValue('');

    // Verify suggestions displayed
    const suggestions = canvas.getByTestId('factory-search-suggestions');
    expect(suggestions).toBeInTheDocument();
  },
};

// --- Function: createFakeNumberInput, Interface: FakeNumberInput ---

function FactoryNumberInputDemo() {
  const fakeNumber: FakeNumberInput = createFakeNumberInput({
    min: 0,
    max: 1000,
    step: 10,
    currency: '$',
    unit: 'USD',
  });

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.numberTitle')}</h3>
      <div className="space-y-2">
        <Label htmlFor={fakeNumber.id}>{fakeNumber.label}</Label>
        <div className="relative">
          {fakeNumber.currency && (
            <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
              {fakeNumber.currency}
            </span>
          )}
          <Input
            id={fakeNumber.id}
            type="number"
            placeholder={fakeNumber.placeholder}
            min={fakeNumber.min}
            max={fakeNumber.max}
            step={fakeNumber.step}
            className={fakeNumber.currency ? 'pl-7' : ''}
            data-testid="factory-number-input"
          />
          {fakeNumber.unit && (
            <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-xs">
              {fakeNumber.unit}
            </span>
          )}
        </div>
      </div>
      <div className="text-muted-foreground space-y-1 text-xs" data-testid="factory-number-meta">
        {fakeNumber.min !== undefined && fakeNumber.max !== undefined && (
          <p>{i18n.t('input.factory.numberRange', { min: fakeNumber.min, max: fakeNumber.max })}</p>
        )}
        {fakeNumber.step !== undefined && (
          <p>{i18n.t('input.factory.numberStep', { step: fakeNumber.step })}</p>
        )}
        {fakeNumber.currency && (
          <p>
            {i18n.t('input.factory.numberCurrency')}: {fakeNumber.currency}
          </p>
        )}
        {fakeNumber.unit && (
          <p>
            {i18n.t('input.factory.numberUnit')}: {fakeNumber.unit}
          </p>
        )}
      </div>
    </div>
  );
}

export const FactoryNumberInput: Story = {
  name: i18n.t('input.storyName.factoryNumberInput', 'Factory: Number Input'),
  render: () => <FactoryNumberInputDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('factory-number-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '1000');
    expect(input).toHaveAttribute('step', '10');

    const meta = canvas.getByTestId('factory-number-meta');
    expect(meta).toBeInTheDocument();
  },
};

// --- Function: createFakeFileInput, Interface: FakeFileInput ---

function FactoryFileInputDemo() {
  const fakeFile: FakeFileInput = createFakeFileInput({
    accept: 'image/*',
    multiple: true,
  });

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.fileTitle')}</h3>
      <div className="space-y-2">
        <Label htmlFor={fakeFile.id}>{fakeFile.label}</Label>
        <Input
          id={fakeFile.id}
          type="file"
          accept={fakeFile.accept}
          multiple={fakeFile.multiple}
          data-testid="factory-file-input"
        />
      </div>
      <div className="text-muted-foreground text-xs" data-testid="factory-file-meta">
        {fakeFile.accept && (
          <p>{i18n.t('input.factory.fileAccepts', { types: fakeFile.accept })}</p>
        )}
        {fakeFile.multiple && <p>{i18n.t('input.factory.fileMultiple')}</p>}
      </div>
    </div>
  );
}

export const FactoryFileInput: Story = {
  name: i18n.t('input.storyName.factoryFileInput', 'Factory: File Input'),
  render: () => <FactoryFileInputDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('factory-file-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).toHaveAttribute('multiple');

    const meta = canvas.getByTestId('factory-file-meta');
    expect(meta).toBeInTheDocument();
  },
};

// --- Function: createFakeTextarea, createFakeTextareas, Interface: FakeTextarea ---

function FactoryTextareaDemo() {
  const fakeTextarea: FakeTextarea = createFakeTextarea({
    label: i18n.t('input.story.description', 'Description'),
    placeholder: i18n.t('input.story.enterDescription', 'Enter description...'),
    rows: 4,
    maxLength: 200,
    showCount: true,
  });
  const fakeTextareas: FakeTextarea[] = createFakeTextareas(2);
  const [value, setValue] = React.useState(fakeTextarea.defaultValue ?? '');

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.textareaTitle')}</h3>
      <div className="space-y-2">
        <Label htmlFor={fakeTextarea.id}>{fakeTextarea.label}</Label>
        <textarea
          id={fakeTextarea.id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={fakeTextarea.placeholder}
          rows={fakeTextarea.rows}
          maxLength={fakeTextarea.maxLength}
          disabled={fakeTextarea.disabled}
          readOnly={fakeTextarea.readOnly}
          required={fakeTextarea.required}
          className="border-input placeholder:text-muted-foreground w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs"
          data-testid="factory-textarea"
        />
        {fakeTextarea.showCount && fakeTextarea.maxLength && (
          <p
            className="text-muted-foreground text-right text-xs"
            data-testid="factory-textarea-count"
          >
            {i18n.t('input.factory.textareaCharCount', {
              count: value.length,
              max: fakeTextarea.maxLength,
            })}
          </p>
        )}
      </div>
      <div className="space-y-3 border-t pt-3">
        <p className="text-xs font-medium">
          {i18n.t(
            'input.story.additionalTextareasCreatefaketextareas',
            'Additional Textareas (createFakeTextareas)'
          )}
        </p>
        {fakeTextareas.map((ta) => (
          <div key={ta.id} className="space-y-1">
            <Label htmlFor={ta.id} className="text-xs">
              {ta.label}
            </Label>
            <textarea
              id={ta.id}
              placeholder={ta.placeholder}
              rows={ta.rows}
              disabled={ta.disabled}
              className="border-input placeholder:text-muted-foreground w-full rounded-md border bg-transparent px-3 py-2 text-xs shadow-xs"
              data-testid={`factory-textarea-${ta.id}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryTextarea: Story = {
  name: i18n.t('input.storyName.factoryTextarea', 'Factory: Textarea'),
  render: () => <FactoryTextareaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByTestId('factory-textarea');
    expect(textarea).toBeInTheDocument();

    // Type and verify char count
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Hello');
    const count = canvas.getByTestId('factory-textarea-count');
    expect(count.textContent).toContain('5');
  },
};

// --- Function: createFakeField, createFakeFields, Interface: FakeField ---

function FactoryFieldDemo() {
  const fakeField: FakeField = createFakeField({
    label: i18n.t('input.story.email', 'Email'),
    description: i18n.t('input.story.neverShareEmail', 'We will never share your email.'),
    required: true,
  });
  const fakeFields: FakeField[] = createFakeFields(3);

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.fieldTitle')}</h3>
      <div className="space-y-2" data-testid="factory-field-primary">
        <Label htmlFor={fakeField.id}>
          {fakeField.label} {fakeField.required && <span className="text-destructive">*</span>}
        </Label>
        <Input id={fakeField.id} required={fakeField.required} data-testid="factory-field-input" />
        {fakeField.description && (
          <p className="text-muted-foreground text-xs">{fakeField.description}</p>
        )}
        {fakeField.error && <p className="text-destructive text-xs">{fakeField.error}</p>}
      </div>
      <div className="space-y-3 border-t pt-3">
        <p className="text-xs font-medium">
          {i18n.t(
            'input.story.multipleFieldsCreatefakefields',
            'Multiple Fields (createFakeFields)'
          )}
        </p>
        {fakeFields.map((field) => (
          <div key={field.id} className="space-y-1">
            <Label htmlFor={field.id} className="text-xs">
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.id}
              required={field.required}
              data-testid={`factory-field-${field.id}`}
            />
            {field.description && (
              <p className="text-muted-foreground text-xs">{field.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryField: Story = {
  name: i18n.t('input.storyName.factoryField', 'Factory: Form Field'),
  render: () => <FactoryFieldDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const primary = canvas.getByTestId('factory-field-primary');
    expect(primary).toBeInTheDocument();

    const input = canvas.getByTestId('factory-field-input');
    expect(input).toHaveAttribute('required');

    // Verify 3 additional fields rendered
    const allInputs = canvasElement.querySelectorAll('input');
    expect(allInputs.length).toBeGreaterThanOrEqual(4);
  },
};

// --- Function: createFakeLabel, createFakeLabels, Interface: FakeLabel ---

function FactoryLabelDemo() {
  const fakeLabel: FakeLabel = createFakeLabel({
    text: i18n.t('input.story.fullName', 'Full Name'),
    required: true,
  });
  const fakeLabels: FakeLabel[] = createFakeLabels(4);

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.labelTitle')}</h3>
      <div className="space-y-2" data-testid="factory-label-primary">
        <Label htmlFor={fakeLabel.htmlFor} id={fakeLabel.id}>
          {fakeLabel.text} {fakeLabel.required && <span className="text-destructive">*</span>}
        </Label>
        <Input id={fakeLabel.htmlFor} data-testid="factory-label-input" />
      </div>
      <div className="space-y-3 border-t pt-3">
        <p className="text-xs font-medium">
          {i18n.t(
            'input.story.multipleLabelsCreatefakelabels',
            'Multiple Labels (createFakeLabels)'
          )}
        </p>
        {fakeLabels.map((label) => (
          <div key={label.id} className="space-y-1">
            <Label htmlFor={label.htmlFor} id={label.id} className="text-xs">
              {label.text} {label.required && <span className="text-destructive">*</span>}
            </Label>
            <Input id={label.htmlFor} data-testid={`factory-label-${label.id}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryLabel: Story = {
  name: i18n.t('input.storyName.factoryLabel', 'Factory: Label'),
  render: () => <FactoryLabelDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const primary = canvas.getByTestId('factory-label-primary');
    expect(primary).toBeInTheDocument();

    const input = canvas.getByTestId('factory-label-input');
    expect(input).toBeInTheDocument();

    // All labels + inputs rendered (1 primary + 4 from createFakeLabels)
    const allInputs = canvasElement.querySelectorAll('input');
    expect(allInputs.length).toBe(5);
  },
};

// --- Function: createFakeInputGroup, createFakeInputGroups, Interface: FakeInputGroup ---

function FactoryInputGroupDemo() {
  const fakeGroup: FakeInputGroup = createFakeInputGroup({
    prefix: 'https://',
    suffix: '.com',
  });
  const fakeGroups: FakeInputGroup[] = createFakeInputGroups(2);

  return (
    <div className="w-[500px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.inputGroupTitle')}</h3>
      <div className="space-y-2" data-testid="factory-group-primary">
        <div className="flex items-center gap-0">
          {fakeGroup.prefix && (
            <span
              className="bg-muted border-input flex h-9 items-center rounded-l-md border border-r-0 px-3 text-sm"
              data-testid="factory-group-prefix"
            >
              {fakeGroup.prefix}
            </span>
          )}
          <div className="flex-1">
            {fakeGroup.inputs.map((input, idx) => (
              <Input
                key={input.id}
                id={input.id}
                type={input.type}
                placeholder={input.placeholder}
                className={getGroupInputClassName(
                  !!fakeGroup.prefix,
                  !!fakeGroup.suffix,
                  idx,
                  fakeGroup.inputs.length
                )}
                data-testid={`factory-group-input-${idx}`}
              />
            ))}
          </div>
          {fakeGroup.suffix && (
            <span
              className="bg-muted border-input flex h-9 items-center rounded-r-md border border-l-0 px-3 text-sm"
              data-testid="factory-group-suffix"
            >
              {fakeGroup.suffix}
            </span>
          )}
        </div>
      </div>
      <div className="space-y-3 border-t pt-3">
        <p className="text-xs font-medium">
          {i18n.t(
            'input.story.multipleGroupsCreatefakeinputgroups',
            'Multiple Groups (createFakeInputGroups)'
          )}
        </p>
        {fakeGroups.map((group) => (
          <div key={group.id} className="flex items-center gap-0">
            {group.prefix && (
              <span className="bg-muted border-input flex h-9 items-center rounded-l-md border border-r-0 px-3 text-xs">
                {group.prefix}
              </span>
            )}
            {group.inputs.map((input) => (
              <Input
                key={input.id}
                type={input.type}
                placeholder={input.placeholder}
                className="rounded-none text-xs"
                data-testid={`factory-group-multi-${input.id}`}
              />
            ))}
            {group.suffix && (
              <span className="bg-muted border-input flex h-9 items-center rounded-r-md border border-l-0 px-3 text-xs">
                {group.suffix}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryInputGroup: Story = {
  name: i18n.t('input.storyName.factoryInputGroup', 'Factory: Input Group'),
  render: () => <FactoryInputGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const primary = canvas.getByTestId('factory-group-primary');
    expect(primary).toBeInTheDocument();

    const prefix = canvas.getByTestId('factory-group-prefix');
    expect(prefix.textContent).toBe('https://');

    const suffix = canvas.getByTestId('factory-group-suffix');
    expect(suffix.textContent).toBe('.com');

    const firstInput = canvas.getByTestId('factory-group-input-0');
    expect(firstInput).toBeInTheDocument();
  },
};

// --- Function: createFakeInputOtp, createFakeInputOtps, Interface: FakeInputOtp ---

function FactoryOtpInputDemo() {
  const fakeOtp: FakeInputOtp = createFakeInputOtp({
    length: 6,
    masked: false,
  });
  const fakeOtps: FakeInputOtp[] = createFakeInputOtps(2);
  const [otpValue, setOtpValue] = React.useState('');

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.otpTitle')}</h3>
      <p className="text-muted-foreground text-xs">
        {i18n.t('input.factory.otpDigits', { length: fakeOtp.length })}
      </p>
      <div className="flex gap-2" data-testid="factory-otp-primary">
        {Array.from({ length: fakeOtp.length }, (_, i) => (
          <React.Fragment key={i}>
            <Input
              maxLength={1}
              className="h-12 w-12 text-center text-lg"
              type={fakeOtp.masked ? 'password' : 'text'}
              value={otpValue[i] ?? ''}
              onChange={(e) => {
                const newVal = [...otpValue];
                newVal[i] = e.target.value.slice(-1);
                setOtpValue(newVal.join(''));
              }}
              data-testid={`factory-otp-digit-${i}`}
            />
            {fakeOtp.separator && i < fakeOtp.length - 1 && i % 3 === 2 && (
              <span className="flex items-center text-lg">{fakeOtp.separator}</span>
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="space-y-3 border-t pt-3">
        <p className="text-xs font-medium">
          {i18n.t(
            'input.story.multipleOtpConfigsCreatefakeinputotps',
            'Multiple OTP Configs (createFakeInputOtps)'
          )}
        </p>
        {fakeOtps.map((otp) => (
          <div key={otp.id} className="space-y-1">
            <p className="text-muted-foreground text-xs">
              {i18n.t('input.factory.otpDigits', { length: otp.length })}
              {otp.masked && ` - ${i18n.t('input.factory.otpMasked')}`}
            </p>
            <div className="flex gap-1">
              {Array.from({ length: otp.length }, (_, i) => (
                <Input
                  key={i}
                  maxLength={1}
                  className="h-8 w-8 text-center text-xs"
                  type={otp.masked ? 'password' : 'text'}
                  disabled={otp.disabled}
                  defaultValue={otp.value?.[i] ?? ''}
                  data-testid={`factory-otp-multi-${otp.id}-${i}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryOtpInput: Story = {
  name: i18n.t('input.storyName.factoryOtpInput', 'Factory: OTP Input'),
  render: () => <FactoryOtpInputDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const primary = canvas.getByTestId('factory-otp-primary');
    expect(primary).toBeInTheDocument();

    // 6 digit slots
    for (let i = 0; i < 6; i++) {
      const digit = canvas.getByTestId(`factory-otp-digit-${i}`);
      expect(digit).toBeInTheDocument();
    }

    // Type into first digit
    const firstDigit = canvas.getByTestId('factory-otp-digit-0');
    await userEvent.type(firstDigit, '1');
    expect(firstDigit).toHaveValue('1');
  },
};

// --- Function: createFakeInputWithIcon, Interface: FakeInputWithIcon ---

function FactoryInputWithIconDemo() {
  const fakeIconInput: FakeInputWithIcon = createFakeInputWithIcon({
    icon: 'mail',
    iconPosition: 'left',
    type: 'email',
    placeholder: i18n.t('input.story.emailPlaceholder', 'email@example.com'),
  });

  const iconMap: Record<string, React.ReactNode> = {
    mail: <MailIcon className="size-4" />,
    search: <SearchIcon className="size-4" />,
    user: <UserIcon className="size-4" />,
  };

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.iconInputTitle')}</h3>
      <div className="space-y-2">
        <Label htmlFor={fakeIconInput.id}>{fakeIconInput.label}</Label>
        <div className="relative">
          {fakeIconInput.iconPosition === 'left' && (
            <span
              className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
              data-testid="factory-icon-left"
            >
              {iconMap[fakeIconInput.icon] ?? <MailIcon className="size-4" />}
            </span>
          )}
          <Input
            id={fakeIconInput.id}
            type={fakeIconInput.type}
            placeholder={fakeIconInput.placeholder}
            className={fakeIconInput.iconPosition === 'left' ? 'pl-9' : 'pr-9'}
            data-testid="factory-icon-input"
          />
          {fakeIconInput.iconPosition === 'right' && (
            <span
              className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2"
              data-testid="factory-icon-right"
            >
              {iconMap[fakeIconInput.icon] ?? <MailIcon className="size-4" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export const FactoryInputWithIcon: Story = {
  name: i18n.t('input.storyName.factoryInputWithIcon', 'Factory: Input with Icon'),
  render: () => <FactoryInputWithIconDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('factory-icon-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'email');

    const icon = canvas.getByTestId('factory-icon-left');
    expect(icon).toBeInTheDocument();
  },
};

// --- Function: createFakeEmailInput ---

function FactoryEmailInputDemo() {
  const fakeEmail: FakeInput = createFakeEmailInput();

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.emailTitle')}</h3>
      <div className="space-y-2">
        <Label htmlFor={fakeEmail.id}>{fakeEmail.label}</Label>
        <div className="relative">
          <MailIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id={fakeEmail.id}
            type={fakeEmail.type}
            placeholder={fakeEmail.placeholder}
            required={fakeEmail.required}
            autoComplete={fakeEmail.autocomplete}
            className="pl-9"
            data-testid="factory-email-input"
          />
        </div>
      </div>
    </div>
  );
}

export const FactoryEmailInput: Story = {
  name: i18n.t('input.storyName.factoryEmailInput', 'Factory: Email Input'),
  render: () => <FactoryEmailInputDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('factory-email-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'email');

    await userEvent.type(input, 'test@example.com');
    expect(input).toHaveValue('test@example.com');
  },
};

// --- Function: createFakePhoneInput ---

function FactoryPhoneInputDemo() {
  const fakePhone: FakeInput = createFakePhoneInput();

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.phoneTitle')}</h3>
      <div className="space-y-2">
        <Label htmlFor={fakePhone.id}>{fakePhone.label}</Label>
        <Input
          id={fakePhone.id}
          type={fakePhone.type}
          placeholder={fakePhone.placeholder}
          autoComplete={fakePhone.autocomplete}
          inputMode={fakePhone.inputMode}
          data-testid="factory-phone-input"
        />
      </div>
    </div>
  );
}

export const FactoryPhoneInput: Story = {
  name: i18n.t('input.storyName.factoryPhoneInput', 'Factory: Phone Input'),
  render: () => <FactoryPhoneInputDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('factory-phone-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'tel');

    await userEvent.type(input, '5551234567');
    expect(input).toHaveValue('5551234567');
  },
};

// --- Function: createFakeUrlInput ---

function FactoryUrlInputDemo() {
  const fakeUrl: FakeInput = createFakeUrlInput();

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.urlTitle')}</h3>
      <div className="space-y-2">
        <Label htmlFor={fakeUrl.id}>{fakeUrl.label}</Label>
        <Input
          id={fakeUrl.id}
          type={fakeUrl.type}
          placeholder={fakeUrl.placeholder}
          inputMode={fakeUrl.inputMode}
          data-testid="factory-url-input"
        />
      </div>
    </div>
  );
}

export const FactoryUrlInput: Story = {
  name: i18n.t('input.storyName.factoryUrlInput', 'Factory: URL Input'),
  render: () => <FactoryUrlInputDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('factory-url-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'url');

    await userEvent.type(input, 'https://example.com');
    expect(input).toHaveValue('https://example.com');
  },
};

// --- Function: createFakeDateInput ---

function FactoryDateInputDemo() {
  const fakeDate: FakeInput = createFakeDateInput();

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.dateTitle')}</h3>
      <div className="space-y-2">
        <Label htmlFor={fakeDate.id}>{fakeDate.label}</Label>
        <Input id={fakeDate.id} type={fakeDate.type} data-testid="factory-date-input" />
      </div>
    </div>
  );
}

export const FactoryDateInput: Story = {
  name: i18n.t('input.storyName.factoryDateInput', 'Factory: Date Input'),
  render: () => <FactoryDateInputDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId('factory-date-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'date');
  },
};

// --- Function: createFakeLoginInputs ---

function FactoryLoginFormDemo() {
  const loginInputs = createFakeLoginInputs();

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.loginTitle')}</h3>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={loginInputs.email.id}>{loginInputs.email.label}</Label>
          <Input
            id={loginInputs.email.id}
            type={loginInputs.email.type}
            placeholder={loginInputs.email.placeholder}
            required={loginInputs.email.required}
            data-testid="factory-login-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={loginInputs.password.id}>{loginInputs.password.label}</Label>
          <Input
            id={loginInputs.password.id}
            type="password"
            placeholder={loginInputs.password.placeholder}
            required={loginInputs.password.required}
            data-testid="factory-login-password"
          />
        </div>
        <Button type="submit" className="w-full" data-testid="factory-login-submit">
          {i18n.t('input.factory.loginSubmit')}
        </Button>
      </div>
    </div>
  );
}

export const FactoryLoginForm: Story = {
  name: i18n.t('input.storyName.factoryLoginForm', 'Factory: Login Form'),
  render: () => <FactoryLoginFormDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = canvas.getByTestId('factory-login-email');
    const password = canvas.getByTestId('factory-login-password');
    const submit = canvas.getByTestId('factory-login-submit');

    expect(email).toBeInTheDocument();
    expect(email).toHaveAttribute('type', 'email');
    expect(password).toBeInTheDocument();
    expect(password).toHaveAttribute('type', 'password');
    expect(submit).toBeInTheDocument();

    await userEvent.type(email, 'user@test.com');
    await userEvent.type(password, 'password123');
    expect(email).toHaveValue('user@test.com');
    expect(password).toHaveValue('password123');
  },
};

// --- Function: createFakeRegistrationInputs ---

function FactoryRegistrationFormDemo() {
  const { t } = useTranslation();
  const regInputs = createFakeRegistrationInputs();

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{t('input.factory.registrationTitle')}</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={regInputs.firstName.id}>{regInputs.firstName.label}</Label>
            <Input
              id={regInputs.firstName.id}
              placeholder={regInputs.firstName.placeholder}
              required={regInputs.firstName.required}
              data-testid="factory-reg-first"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={regInputs.lastName.id}>{regInputs.lastName.label}</Label>
            <Input
              id={regInputs.lastName.id}
              placeholder={regInputs.lastName.placeholder}
              required={regInputs.lastName.required}
              data-testid="factory-reg-last"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={regInputs.email.id}>{regInputs.email.label}</Label>
          <Input
            id={regInputs.email.id}
            type={regInputs.email.type}
            placeholder={regInputs.email.placeholder}
            data-testid="factory-reg-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={regInputs.password.id}>{regInputs.password.label}</Label>
          <Input
            id={regInputs.password.id}
            type="password"
            placeholder={regInputs.password.placeholder}
            data-testid="factory-reg-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={regInputs.confirmPassword.id}>{regInputs.confirmPassword.label}</Label>
          <Input
            id={regInputs.confirmPassword.id}
            type="password"
            placeholder={regInputs.confirmPassword.placeholder}
            data-testid="factory-reg-confirm"
          />
        </div>
        <Button type="submit" className="w-full" data-testid="factory-reg-submit">
          {t('input.factory.registrationSubmit')}
        </Button>
      </div>
    </div>
  );
}

export const FactoryRegistrationForm: Story = {
  name: i18n.t('input.storyName.factoryRegistrationForm', 'Factory: Registration Form'),
  render: () => <FactoryRegistrationFormDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-reg-first')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-reg-last')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-reg-email')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-reg-password')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-reg-confirm')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-reg-submit')).toBeInTheDocument();

    await userEvent.type(canvas.getByTestId('factory-reg-first'), 'John');
    expect(canvas.getByTestId('factory-reg-first')).toHaveValue('John');
  },
};

// --- Function: createFakeContactInputs ---

function FactoryContactFormDemo() {
  const { t } = useTranslation();
  const contactInputs = createFakeContactInputs();

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{t('input.factory.contactTitle')}</h3>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={contactInputs.name.id}>{contactInputs.name.label}</Label>
          <Input
            id={contactInputs.name.id}
            placeholder={contactInputs.name.placeholder}
            required={contactInputs.name.required}
            data-testid="factory-contact-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={contactInputs.email.id}>{contactInputs.email.label}</Label>
          <Input
            id={contactInputs.email.id}
            type={contactInputs.email.type}
            placeholder={contactInputs.email.placeholder}
            data-testid="factory-contact-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={contactInputs.phone.id}>{contactInputs.phone.label}</Label>
          <Input
            id={contactInputs.phone.id}
            type={contactInputs.phone.type}
            placeholder={contactInputs.phone.placeholder}
            data-testid="factory-contact-phone"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={contactInputs.subject.id}>{contactInputs.subject.label}</Label>
          <Input
            id={contactInputs.subject.id}
            placeholder={contactInputs.subject.placeholder}
            required={contactInputs.subject.required}
            data-testid="factory-contact-subject"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={contactInputs.message.id}>{contactInputs.message.label}</Label>
          <textarea
            id={contactInputs.message.id}
            placeholder={contactInputs.message.placeholder}
            rows={contactInputs.message.rows}
            required={contactInputs.message.required}
            className="border-input placeholder:text-muted-foreground w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            data-testid="factory-contact-message"
          />
        </div>
        <Button type="submit" className="w-full" data-testid="factory-contact-submit">
          {t('input.factory.contactSubmit')}
        </Button>
      </div>
    </div>
  );
}

export const FactoryContactForm: Story = {
  name: i18n.t('input.storyName.factoryContactForm', 'Factory: Contact Form'),
  render: () => <FactoryContactFormDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-contact-name')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-contact-email')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-contact-phone')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-contact-subject')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-contact-message')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-contact-submit')).toBeInTheDocument();

    await userEvent.type(canvas.getByTestId('factory-contact-name'), 'Jane');
    expect(canvas.getByTestId('factory-contact-name')).toHaveValue('Jane');
  },
};

// --- Function: createFakeProfileInputs ---

function FactoryProfileFormDemo() {
  const { t } = useTranslation();
  const profileInputs = createFakeProfileInputs();

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{t('input.factory.profileTitle')}</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={profileInputs.firstName.id}>{profileInputs.firstName.label}</Label>
            <Input
              id={profileInputs.firstName.id}
              placeholder={profileInputs.firstName.placeholder}
              data-testid="factory-profile-first"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={profileInputs.lastName.id}>{profileInputs.lastName.label}</Label>
            <Input
              id={profileInputs.lastName.id}
              placeholder={profileInputs.lastName.placeholder}
              data-testid="factory-profile-last"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={profileInputs.email.id}>{profileInputs.email.label}</Label>
          <Input
            id={profileInputs.email.id}
            type={profileInputs.email.type}
            placeholder={profileInputs.email.placeholder}
            data-testid="factory-profile-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={profileInputs.phone.id}>{profileInputs.phone.label}</Label>
          <Input
            id={profileInputs.phone.id}
            type={profileInputs.phone.type}
            placeholder={profileInputs.phone.placeholder}
            data-testid="factory-profile-phone"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={profileInputs.company.id}>{profileInputs.company.label}</Label>
          <Input
            id={profileInputs.company.id}
            placeholder={profileInputs.company.placeholder}
            data-testid="factory-profile-company"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={profileInputs.website.id}>{profileInputs.website.label}</Label>
          <Input
            id={profileInputs.website.id}
            type={profileInputs.website.type}
            placeholder={profileInputs.website.placeholder}
            data-testid="factory-profile-website"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={profileInputs.bio.id}>{profileInputs.bio.label}</Label>
          <textarea
            id={profileInputs.bio.id}
            placeholder={profileInputs.bio.placeholder}
            rows={profileInputs.bio.rows}
            maxLength={profileInputs.bio.maxLength}
            className="border-input placeholder:text-muted-foreground w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            data-testid="factory-profile-bio"
          />
        </div>
        <Button type="submit" className="w-full" data-testid="factory-profile-submit">
          {t('input.factory.profileSubmit')}
        </Button>
      </div>
    </div>
  );
}

export const FactoryProfileForm: Story = {
  name: i18n.t('input.storyName.factoryProfileForm', 'Factory: Profile Form'),
  render: () => <FactoryProfileFormDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-profile-first')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-profile-last')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-profile-email')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-profile-phone')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-profile-company')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-profile-website')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-profile-bio')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-profile-submit')).toBeInTheDocument();

    await userEvent.type(canvas.getByTestId('factory-profile-first'), 'Alice');
    expect(canvas.getByTestId('factory-profile-first')).toHaveValue('Alice');
  },
};

// --- Function: createFakeInputTypeMatrix ---

function FactoryTypeMatrixDemo() {
  const { t } = useTranslation();
  const typeMatrix = createFakeInputTypeMatrix();

  return (
    <div className="w-[500px] space-y-4">
      <h3 className="text-sm font-medium">{t('input.factory.typeMatrixTitle')}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.entries(typeMatrix) as [InputType, FakeInput][]).map(([type, input]) => (
          <div key={type} className="space-y-1">
            <Label htmlFor={input.id} className="text-xs">
              {input.label} <span className="text-muted-foreground">({type})</span>
            </Label>
            <Input
              id={input.id}
              type={type}
              placeholder={input.placeholder}
              disabled={input.disabled}
              data-testid={`factory-matrix-type-${type}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryTypeMatrix: Story = {
  name: i18n.t('input.storyName.factoryTypeMatrix', 'Factory: Type Matrix'),
  render: () => <FactoryTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    // Verify at least text, email, password are rendered
    expect(
      canvasElement.querySelector('[data-testid="factory-matrix-type-text"]')
    ).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-testid="factory-matrix-type-email"]')
    ).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-testid="factory-matrix-type-password"]')
    ).toBeInTheDocument();

    const allInputs = canvasElement.querySelectorAll('[data-testid^="factory-matrix-type-"]');
    expect(allInputs.length).toBeGreaterThanOrEqual(10);
  },
};

// --- Function: createFakeInputSizeMatrix ---

function FactorySizeMatrixDemo() {
  const sizeMatrix = createFakeInputSizeMatrix();

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.sizeMatrixTitle')}</h3>
      {(Object.entries(sizeMatrix) as [InputSize, FakeInput][]).map(([size, input]) => (
        <div key={size} className="space-y-1">
          <Label htmlFor={input.id} className="text-xs capitalize">
            {size}
          </Label>
          <Input
            id={input.id}
            placeholder={input.placeholder}
            className={getSizeClassName(size)}
            data-testid={`factory-matrix-size-${size}`}
          />
        </div>
      ))}
    </div>
  );
}

export const FactorySizeMatrix: Story = {
  name: i18n.t('input.storyName.factorySizeMatrix', 'Factory: Size Matrix'),
  render: () => <FactorySizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    for (const size of INPUT_SIZES) {
      const input = canvasElement.querySelector(`[data-testid="factory-matrix-size-${size}"]`);
      expect(input).toBeInTheDocument();
    }
  },
};

// --- Function: createFakeInputShowcase ---

function FactoryShowcaseDemo() {
  const showcase = createFakeInputShowcase();

  return (
    <div className="w-[500px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.showcaseTitle')}</h3>
      <p className="text-muted-foreground text-xs">{i18n.t('input.factory.showcaseDesc')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(showcase).map(([key, input]) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={input.id} className="text-xs">
              {input.label} <span className="text-muted-foreground">({key})</span>
            </Label>
            <Input
              id={input.id}
              type={input.type}
              placeholder={input.placeholder}
              disabled={input.disabled}
              data-testid={`factory-showcase-${key}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryShowcase: Story = {
  name: i18n.t('input.storyName.factoryShowcase', 'Factory: Input Showcase'),
  render: () => <FactoryShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const showcaseKeys = [
      'text',
      'email',
      'password',
      'number',
      'search',
      'phone',
      'url',
      'date',
      'file',
    ];
    for (const key of showcaseKeys) {
      const input = canvasElement.querySelector(`[data-testid="factory-showcase-${key}"]`);
      expect(input).toBeInTheDocument();
    }
  },
};

// --- Type-only exports usage: ensure all type aliases and interfaces are referenced ---
// FakeFormInput, InputAutocomplete, InputMode, InputValidationState are used as type annotations below

function FactoryFormInputDemo() {
  const formInput: FakeFormInput = {
    label: i18n.t('input.story.username', 'Username'),
    input: createFakeInput({
      type: 'text',
      label: i18n.t('input.story.username', 'Username'),
      placeholder: i18n.t('input.story.enterUsername', 'Enter username'),
    }),
    required: true,
    description: i18n.t('input.story.chooseUniqueUsername', 'Choose a unique username'),
  };

  const autocompleteValues: InputAutocomplete[] = ['email', 'name', 'tel', 'username'];
  const inputModes: InputMode[] = ['text', 'email', 'numeric', 'tel'];
  const validationStates: InputValidationState[] = INPUT_VALIDATION_STATES;

  return (
    <div className="w-[400px] space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('input.factory.fieldTitle')}</h3>
      <div className="space-y-2" data-testid="factory-form-input">
        <Label htmlFor={formInput.input.id}>
          {formInput.label} {formInput.required && <span className="text-destructive">*</span>}
        </Label>
        <Input
          id={formInput.input.id}
          type={formInput.input.type}
          placeholder={formInput.input.placeholder}
          required={formInput.required}
          disabled={formInput.disabled}
          data-testid="factory-form-input-field"
        />
        {formInput.description && (
          <p className="text-muted-foreground text-xs">{formInput.description}</p>
        )}
        {formInput.error && <p className="text-destructive text-xs">{formInput.error}</p>}
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium">
          {i18n.t('input.story.autocompleteValues', 'Autocomplete Values')}
        </p>
        <div className="flex flex-wrap gap-1" data-testid="factory-autocomplete-values">
          {autocompleteValues.map((ac) => (
            <span key={ac} className="bg-muted rounded px-2 py-0.5 text-xs">
              {ac}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium">{i18n.t('input.story.inputModes', 'Input Modes')}</p>
        <div className="flex flex-wrap gap-1" data-testid="factory-input-modes">
          {inputModes.map((mode) => (
            <span key={mode} className="bg-muted rounded px-2 py-0.5 text-xs">
              {mode}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium">
          {i18n.t('input.story.validationStates', 'Validation States')}
        </p>
        <div className="flex flex-wrap gap-1" data-testid="factory-validation-states">
          {validationStates.map((vs) => (
            <span key={vs} className={`rounded px-2 py-0.5 text-xs ${getValidationStateColor(vs)}`}>
              {vs}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryFormInput: Story = {
  name: i18n.t('input.storyName.factoryFormInput', 'Factory: Form Input & Type Aliases'),
  render: () => <FactoryFormInputDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-form-input')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-form-input-field')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-autocomplete-values')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-input-modes')).toBeInTheDocument();
    expect(canvas.getByTestId('factory-validation-states')).toBeInTheDocument();

    const input = canvas.getByTestId('factory-form-input-field');
    await userEvent.type(input, 'testuser');
    expect(input).toHaveValue('testuser');
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   notFound
//   conflict
//   validationError
//   slowResponse
//   emptyAutocomplete
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('input.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: inputStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('input.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: inputStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('input.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: inputStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerValidationError: Story = {
  ...Default,
  name: i18n.t('input.storyName.handlerValidationError', 'Handler: Validation Error'),
  parameters: { msw: { handlers: inputStatusHandlers.validationError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('input.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: inputStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyAutocomplete: Story = {
  ...Default,
  name: i18n.t('input.storyName.handlerEmptyAutocomplete', 'Handler: Empty Autocomplete'),
  parameters: { msw: { handlers: inputStatusHandlers.emptyAutocomplete } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
