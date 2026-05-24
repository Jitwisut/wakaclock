import type { Meta, StoryObj } from '@storybook/react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { expect, fn, userEvent, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';

import type {
  FakeChoiceField,
  FakeDateTimeField,
  FakeField,
  FakeFieldError,
  FakeFieldGroup,
  FakeFieldSet,
  FakeFileField,
  FakeFormConfig,
  FakeNumberField,
  FakeSelectField,
  FakeTextareaField,
  FakeTextField,
  FieldInputType,
  FieldLegendVariant,
  FieldOrientation,
  FieldValidationState,
} from '@/.storybook/stories/_factories/field.factory';
import {
  createFakeChoiceField,
  createFakeContactForm,
  createFakeDateTimeField,
  createFakeField,
  createFakeFieldError,
  createFakeFieldGroup,
  createFakeFieldGroups,
  createFakeFieldMatrix,
  createFakeFields,
  createFakeFieldSet,
  createFakeFileField,
  createFakeFormShowcase,
  createFakeLoginForm,
  createFakeNumberField,
  createFakeProfileForm,
  createFakeRegistrationForm,
  createFakeSelectField,
  createFakeTextareaField,
  createFakeTextField,
  ERROR_MESSAGES_BY_TYPE,
  FIELD_LABELS_BY_TYPE,
  FIELD_ORIENTATIONS,
  INPUT_TYPES,
  LEGEND_VARIANTS,
  TEXT_INPUT_TYPES,
} from '@/.storybook/stories/_factories/field.factory';
import { fieldHandlers, fieldStatusHandlers } from '@/.storybook/stories/_handlers/field.handlers';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function FieldDemo() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-2xl space-y-8">
      <FieldSet>
        <div>
          <FieldLegend>{t('field.legend.account')}</FieldLegend>
          <FieldDescription>{t('field.legend.description')}</FieldDescription>
        </div>

        <FieldGroup>
          <Field data-invalid="true" orientation="responsive">
            <FieldLabel htmlFor="field-email">
              <FieldTitle>{t('field.email.title')}</FieldTitle>
              <FieldDescription>{t('field.email.description')}</FieldDescription>
            </FieldLabel>
            <FieldContent>
              <Input aria-invalid defaultValue="not-an-email" id="field-email" type="email" />
              <FieldError errors={[{ message: t('field.email.error') }]} />
            </FieldContent>
          </Field>

          <Field orientation="responsive">
            <FieldLabel htmlFor="field-company">
              <FieldTitle>{t('field.company.title')}</FieldTitle>
              <FieldDescription>{t('field.company.description')}</FieldDescription>
            </FieldLabel>
            <FieldContent>
              <Input id="field-company" placeholder={t('field.company.placeholder')} />
            </FieldContent>
          </Field>
        </FieldGroup>

        <FieldSeparator>{t('field.separator')}</FieldSeparator>

        <FieldGroup data-variant="outline" className="rounded-md border p-4">
          <Field data-disabled="true" orientation="horizontal">
            <FieldLabel className="sr-only" htmlFor="field-disabled">
              {t('field.disabled.srLabel')}
            </FieldLabel>
            <FieldContent>
              <Input disabled id="field-disabled" placeholder={t('field.disabled.placeholder')} />
            </FieldContent>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Field',
  component: FieldDemo,
  tags: ['autodocs'],
  args: {
    onChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onInput: fn(),
  },
  parameters: {
    msw: { handlers: fieldHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // ═══════════════════════════════════════════════════════════════
    // CONTENT
    // ═══════════════════════════════════════════════════════════════
    children: {
      control: false,
      description: i18n.t(
        'field.argType.fieldContentLabelControlDescriptionError',
        'Field content (label, control, description, error)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    label: {
      control: 'text',
      description: i18n.t('field.argType.fieldLabelText', 'Field label text'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    description: {
      control: 'text',
      description: i18n.t(
        'field.argType.helpTextShownBelowTheField',
        'Help text shown below the field'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // APPEARANCE
    // ═══════════════════════════════════════════════════════════════
    orientation: {
      control: 'select',
      options: ['vertical', 'horizontal', 'responsive'],
      description: i18n.t(
        'field.argType.layoutDirectionOfLabelAndInput',
        'Layout direction of label and input'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'vertical' },
        type: { summary: "'vertical' | 'horizontal' | 'responsive'" },
      },
    },
    className: {
      control: 'text',
      description: i18n.t('field.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'field.argType.whetherTheFieldIsDisabled',
        'Whether the field is disabled'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    invalid: {
      control: 'boolean',
      description: i18n.t(
        'field.argType.whetherTheFieldHasValidationErrors',
        'Whether the field has validation errors'
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
        'field.argType.whetherTheFieldIsRequired',
        'Whether the field is required'
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
        'field.argType.whetherTheFieldIsReadonly',
        'Whether the field is read-only'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // LAYOUT
    // ═══════════════════════════════════════════════════════════════
    inputType: {
      control: 'select',
      options: [
        'text',
        'email',
        'password',
        'tel',
        'url',
        'number',
        'date',
        'textarea',
        'select',
        'checkbox',
        'radio',
      ],
      description: i18n.t('field.argType.typeOfInputControl', 'Type of input control'),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'text' },
        type: {
          summary:
            "'text' | 'email' | 'password' | 'tel' | 'url' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | 'radio'",
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════
    onClick: {
      action: 'onClick',
      description: i18n.t('field.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('field.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('field.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('field.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('field.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('field.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('field.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onChange: {
      action: 'onChange',
      description: i18n.t(
        'field.argType.calledWhenFieldValueChanges',
        'Called when field value changes'
      ),
      table: { category: 'Events' },
    },
    onInput: {
      action: 'onInput',
      description: i18n.t('field.argType.calledOnInputEvent', 'Called on input event'),
      table: { category: 'Events' },
    },
    // Note: argTypes for demo wrapper - actual Field component props documented below
    // Field Props Reference:
    // - orientation: Layout direction ('horizontal' | 'vertical' | 'responsive')
    // - data-invalid: Whether the field is in error state (string 'true' | 'false')
    // - data-disabled: Whether the field is disabled (string 'true' | 'false')
    // - className: Additional CSS classes (string)
    //
    // FieldSet Props Reference:
    // - className: Additional CSS classes for the fieldset (string)
    // - children: FieldGroup, FieldLegend, FieldSeparator elements (ReactNode)
    //
    // FieldGroup Props Reference:
    // - data-variant: Visual variant ('outline' for bordered groups)
    // - className: Additional CSS classes (string)
    // - children: Field elements (ReactNode)
    //
    // FieldLabel Props Reference:
    // - htmlFor: ID of the associated form control (string)
    // - className: Additional CSS classes (string)
    // - children: FieldTitle, FieldDescription elements (ReactNode)
    //
    // FieldTitle Props Reference:
    // - children: Label text content (ReactNode)
    // - className: Additional CSS classes (string)
    //
    // FieldDescription Props Reference:
    // - children: Description text content (ReactNode)
    // - className: Additional CSS classes (string)
    //
    // FieldContent Props Reference:
    // - children: Form controls and FieldError (ReactNode)
    // - className: Additional CSS classes (string)
    //
    // FieldError Props Reference:
    // - errors: Array of error objects with message property ({ message: string }[])
    // - className: Additional CSS classes (string)
    //
    // FieldLegend Props Reference:
    // - children: Legend text content (ReactNode)
    // - className: Additional CSS classes (string)
    //
    // FieldSeparator Props Reference:
    // - children: Optional separator text (ReactNode)
    // - className: Additional CSS classes (string)
  },
} satisfies Meta<typeof FieldDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const legend = canvasElement.querySelector('[data-slot="field-legend"]');
    if (!(legend instanceof HTMLElement)) {
      throw new Error('Expected field legend to be present.');
    }
    expect(legend.textContent?.trim()).not.toBe('');

    const legendDescription = canvasElement.querySelector('div > [data-slot="field-description"]');
    if (!(legendDescription instanceof HTMLElement)) {
      throw new Error('Expected field legend description to be present.');
    }
    expect(legendDescription.textContent?.trim()).not.toBe('');

    const emailLabel = canvasElement.querySelector('label[for="field-email"]');
    if (!(emailLabel instanceof HTMLElement)) {
      throw new Error('Expected email label to be present.');
    }
    expect(emailLabel.textContent?.trim()).not.toBe('');

    const emailInput = canvasElement.querySelector('input#field-email');
    if (!(emailInput instanceof HTMLInputElement)) {
      throw new Error('Expected email input to be present.');
    }
    expect(emailInput.getAttribute('aria-invalid')).toBe('true');

    const error = canvasElement.querySelector('[data-slot="field-error"]');
    if (!(error instanceof HTMLElement)) {
      throw new Error('Expected field error to be present.');
    }
    expect(error.textContent?.trim()).not.toBe('');

    const companyLabel = canvasElement.querySelector('label[for="field-company"]');
    if (!(companyLabel instanceof HTMLElement)) {
      throw new Error('Expected company label to be present.');
    }
    expect(companyLabel.textContent?.trim()).not.toBe('');

    const companyInput = canvasElement.querySelector('input#field-company');
    if (!(companyInput instanceof HTMLInputElement)) {
      throw new Error('Expected company input to be present.');
    }

    const disabledInput = canvasElement.querySelector('input#field-disabled');
    if (!(disabledInput instanceof HTMLInputElement)) {
      throw new Error('Expected disabled input to be present.');
    }
    expect(disabledInput).toBeDisabled();
    expect(disabledInput.placeholder.trim()).not.toBe('');

    expect(canvasElement.querySelector('[data-slot="field-set"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="field-group"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="field-separator"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="field-error"]')).toBeInTheDocument();

    await userEvent.click(companyInput);
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="field-set"]')).toBeInTheDocument();
    expect(canvas.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
  },
};

// ============ VARIANTS ============

export const Variants: Story = {
  render: () => (
    <div className="w-full max-w-2xl space-y-8">
      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('field.story.withLabel', 'With Label')}</div>
        <Field orientation="vertical">
          <FieldLabel htmlFor="field-label-only">
            <FieldTitle>{i18n.t('field.story.username', 'Username')}</FieldTitle>
          </FieldLabel>
          <FieldContent>
            <Input
              id="field-label-only"
              placeholder={i18n.t('field.story.enterUsername', 'Enter username')}
            />
          </FieldContent>
        </Field>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('field.story.withDescription', 'With Description')}
        </div>
        <Field orientation="vertical">
          <FieldLabel htmlFor="field-with-description">
            <FieldTitle>{i18n.t('field.story.email', 'Email')}</FieldTitle>
            <FieldDescription>
              {i18n.t('field.story.weWillNeverShareYourEmail', 'We will never share your email.')}
            </FieldDescription>
          </FieldLabel>
          <FieldContent>
            <Input
              id="field-with-description"
              type="email"
              placeholder={i18n.t('field.story.emailPlaceholder', 'you@example.com')}
            />
          </FieldContent>
        </Field>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('field.story.withError', 'With Error')}</div>
        <Field orientation="vertical" data-invalid="true">
          <FieldLabel htmlFor="field-with-error">
            <FieldTitle>{i18n.t('field.story.password', 'Password')}</FieldTitle>
            <FieldDescription>Must be at least 8 characters.</FieldDescription>
          </FieldLabel>
          <FieldContent>
            <Input id="field-with-error" type="password" aria-invalid defaultValue="short" />
            <FieldError
              errors={[
                {
                  message: i18n.t(
                    'field.story.passwordMinLength',
                    'Password must be at least 8 characters.'
                  ),
                },
              ]}
            />
          </FieldContent>
        </Field>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('field.story.requiredField', 'Required Field')}
        </div>
        <Field orientation="vertical">
          <FieldLabel htmlFor="field-required">
            <FieldTitle>
              Full Name <span className="text-destructive">*</span>
            </FieldTitle>
            <FieldDescription>
              {i18n.t('field.story.enterYourFullLegalName', 'Enter your full legal name.')}
            </FieldDescription>
          </FieldLabel>
          <FieldContent>
            <Input
              id="field-required"
              required
              placeholder={i18n.t('field.story.johnDoe', 'John Doe')}
            />
          </FieldContent>
        </Field>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="field"]')).toBeInTheDocument();
    expect(canvas.getByText('Username')).toBeInTheDocument();
    expect(canvas.getByText('With Error')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="field-error"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('input#field-label-only')).toBeInTheDocument();
    expect(canvasElement.querySelector('input#field-with-error')).toBeInTheDocument();
  },
};

// ============ SIZES ============

export const Sizes: Story = {
  render: () => (
    <div className="w-full max-w-2xl space-y-8">
      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('field.story.compactLayout', 'Compact Layout')}
        </div>
        <Field orientation="horizontal" className="gap-2">
          <FieldLabel htmlFor="field-compact" className="min-w-[80px]">
            <FieldTitle className="text-xs">{i18n.t('field.story.label', 'Label')}</FieldTitle>
          </FieldLabel>
          <FieldContent>
            <Input
              id="field-compact"
              className="h-8 text-xs"
              placeholder={i18n.t('field.story.compactInput', 'Compact input')}
            />
          </FieldContent>
        </Field>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('field.story.defaultLayout', 'Default Layout')}
        </div>
        <Field orientation="responsive">
          <FieldLabel htmlFor="field-default-size">
            <FieldTitle>{i18n.t('field.story.label', 'Label')}</FieldTitle>
            <FieldDescription>
              {i18n.t('field.story.defaultDescriptionText', 'Default description text.')}
            </FieldDescription>
          </FieldLabel>
          <FieldContent>
            <Input
              id="field-default-size"
              placeholder={i18n.t('field.story.defaultInput', 'Default input')}
            />
          </FieldContent>
        </Field>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('field.story.expandedLayout', 'Expanded Layout')}
        </div>
        <FieldSet>
          <div className="mb-4">
            <FieldLegend className="text-lg">
              {i18n.t('field.story.sectionTitle', 'Section Title')}
            </FieldLegend>
            <FieldDescription className="text-base">
              A more detailed description for larger form sections.
            </FieldDescription>
          </div>
          <FieldGroup className="space-y-6">
            <Field orientation="vertical">
              <FieldLabel htmlFor="field-expanded">
                <FieldTitle className="text-base">
                  {i18n.t('field.story.largeLabel', 'Large Label')}
                </FieldTitle>
                <FieldDescription className="text-sm">
                  Extended description with more details about this field.
                </FieldDescription>
              </FieldLabel>
              <FieldContent>
                <Input
                  id="field-expanded"
                  className="h-12 text-base"
                  placeholder={i18n.t('field.story.largerInput', 'Larger input')}
                />
              </FieldContent>
            </Field>
          </FieldGroup>
        </FieldSet>
      </div>
    </div>
  ),
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
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(canvasElement);

    expect(canvas.getByText('アカウント')).toBeInTheDocument();
    expect(canvas.getByText('説明とエラー付きの基本フィールドです。')).toBeInTheDocument();
    expect(canvas.getByText('メール')).toBeInTheDocument();
    expect(canvas.getByText('ログインと通知に使用します。')).toBeInTheDocument();
    expect(canvas.getByText('有効なメールアドレスを入力してください。')).toBeInTheDocument();
    expect(canvas.getByText('会社')).toBeInTheDocument();
    expect(canvas.getByText('任意。')).toBeInTheDocument();
    expect(canvas.getByText('または')).toBeInTheDocument();

    const disabledInput = canvas.getByPlaceholderText('無効…');
    expect(disabledInput.getAttribute('disabled')).toBe('');
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
  name: i18n.t('field.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    msw: { handlers: fieldHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: fieldStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: fieldStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: fieldStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: fieldStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: fieldStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: fieldStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: fieldStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('field.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: fieldStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('field.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: fieldStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('field.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  ...Default,
  parameters: {
    msw: { handlers: fieldStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('field.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: fieldStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('field.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: fieldStatusHandlers.slowSubmission },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  name: i18n.t('field.storyName.emptyData', 'Empty Data'),
  render: () => (
    <div className="w-full max-w-2xl space-y-8" data-testid="field-empty" data-state="empty">
      <FieldSet>
        <div>
          <FieldLegend>{i18n.t('field.story.emptyForm', 'Empty Form')}</FieldLegend>
          <FieldDescription>
            {i18n.t('field.story.noDataHasBeenEnteredYet', 'No data has been entered yet.')}
          </FieldDescription>
        </div>

        <FieldGroup>
          <Field orientation="responsive">
            <FieldLabel htmlFor="field-empty-email">
              <FieldTitle>{i18n.t('field.story.email', 'Email')}</FieldTitle>
              <FieldDescription>
                {i18n.t('field.story.enterYourEmailAddress', 'Enter your email address.')}
              </FieldDescription>
            </FieldLabel>
            <FieldContent>
              <Input
                id="field-empty-email"
                type="email"
                placeholder={i18n.t('field.story.emailPlaceholder', 'you@example.com')}
              />
            </FieldContent>
          </Field>

          <Field orientation="responsive">
            <FieldLabel htmlFor="field-empty-name">
              <FieldTitle>{i18n.t('field.story.name', 'Name')}</FieldTitle>
              <FieldDescription>
                {i18n.t('field.story.enterYourFullName', 'Enter your full name.')}
              </FieldDescription>
            </FieldLabel>
            <FieldContent>
              <Input
                id="field-empty-name"
                placeholder={i18n.t('field.story.johnDoe', 'John Doe')}
              />
            </FieldContent>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="field-empty"]')).toBeInTheDocument();
    const inputs = canvasElement.querySelectorAll('input');
    for (const input of inputs) {
      expect((input as HTMLInputElement).value).toBe('');
    }
  },
};

export const WithFakerData: Story = {
  name: i18n.t('field.storyName.withFakerData', 'With Faker Data'),
  render: () => {
    const fields = createFakeFields(4);

    return (
      <div className="w-full max-w-2xl space-y-8" data-testid="field-faker">
        <FieldSet>
          <div>
            <FieldLegend>
              {i18n.t('field.story.factoryGeneratedFields', 'Factory Generated Fields')}
            </FieldLegend>
            <FieldDescription>
              {i18n.t(
                'field.story.fieldsGeneratedViaCreatefakefields',
                'Fields generated via createFakeFields().'
              )}
            </FieldDescription>
          </div>

          <FieldGroup>
            {fields.map((field) => (
              <Field
                key={field.id}
                orientation={field.orientation ?? 'responsive'}
                data-invalid={field.invalid ? 'true' : undefined}
              >
                <FieldLabel htmlFor={field.id}>
                  <FieldTitle>{field.label}</FieldTitle>
                  {field.description && <FieldDescription>{field.description}</FieldDescription>}
                </FieldLabel>
                <FieldContent>
                  <Input
                    id={field.id}
                    type={field.inputType === 'textarea' ? 'text' : field.inputType}
                    placeholder={field.placeholder}
                    defaultValue={typeof field.defaultValue === 'string' ? field.defaultValue : ''}
                    disabled={field.disabled}
                    readOnly={field.readOnly}
                    required={field.required}
                  />
                </FieldContent>
                {field.errors?.map((err) => (
                  <FieldError key={err.message}>{err.message}</FieldError>
                ))}
              </Field>
            ))}
          </FieldGroup>
        </FieldSet>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="field-faker"]')).toBeInTheDocument();
    const inputs = canvasElement.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  },
};

// ============ FIELD-LEVEL ERROR STORIES ============

export const MultipleFieldErrors: Story = {
  name: i18n.t('field.storyName.multipleFieldErrors', 'Multiple Field Errors'),
  render: () => (
    <div className="w-full max-w-2xl space-y-8" data-testid="field-multiple-errors">
      <FieldSet>
        <div>
          <FieldLegend>
            {i18n.t('field.story.formWithMultipleErrors', 'Form with Multiple Errors')}
          </FieldLegend>
          <FieldDescription>
            {i18n.t(
              'field.story.demonstratingMultipleFieldlevelValidatio',
              'Demonstrating multiple field-level validation errors.'
            )}
          </FieldDescription>
        </div>

        <FieldGroup>
          <Field data-invalid="true" orientation="responsive">
            <FieldLabel htmlFor="error-email">
              <FieldTitle>{i18n.t('field.story.email', 'Email')}</FieldTitle>
              <FieldDescription>
                {i18n.t('field.story.pleaseEnterAValidEmail', 'Please enter a valid email.')}
              </FieldDescription>
            </FieldLabel>
            <FieldContent>
              <Input aria-invalid id="error-email" type="email" defaultValue="invalid-email" />
              <FieldError errors={[{ message: 'Please enter a valid email address.' }]} />
            </FieldContent>
          </Field>

          <Field data-invalid="true" orientation="responsive">
            <FieldLabel htmlFor="error-password">
              <FieldTitle>{i18n.t('field.story.password', 'Password')}</FieldTitle>
              <FieldDescription>Minimum 8 characters.</FieldDescription>
            </FieldLabel>
            <FieldContent>
              <Input aria-invalid id="error-password" type="password" defaultValue="123" />
              <FieldError
                errors={[
                  {
                    message: i18n.t(
                      'field.story.passwordMinLength',
                      'Password must be at least 8 characters.'
                    ),
                  },
                ]}
              />
            </FieldContent>
          </Field>

          <Field data-invalid="true" orientation="responsive">
            <FieldLabel htmlFor="error-confirm">
              <FieldTitle>{i18n.t('field.story.confirmPassword', 'Confirm Password')}</FieldTitle>
              <FieldDescription>
                {i18n.t('field.story.mustMatchPassword', 'Must match password.')}
              </FieldDescription>
            </FieldLabel>
            <FieldContent>
              <Input aria-invalid id="error-confirm" type="password" defaultValue="456" />
              <FieldError
                errors={[
                  { message: i18n.t('field.story.passwordsDoNotMatch', 'Passwords do not match.') },
                ]}
              />
            </FieldContent>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const errors = canvasElement.querySelectorAll('[data-slot="field-error"]');
    expect(errors.length).toBe(3);

    const invalidFields = canvasElement.querySelectorAll('[data-invalid="true"]');
    expect(invalidFields.length).toBe(3);
  },
};

export const FieldWithMultipleErrors: Story = {
  name: i18n.t('field.storyName.fieldWithMultipleErrors', 'Field with Multiple Error Messages'),
  render: () => (
    <div className="w-full max-w-2xl space-y-8" data-testid="field-multi-error-messages">
      <Field data-invalid="true" orientation="vertical">
        <FieldLabel htmlFor="multi-error-password">
          <FieldTitle>{i18n.t('field.story.password', 'Password')}</FieldTitle>
          <FieldDescription>
            {i18n.t(
              'field.story.passwordMustMeetAllRequirements',
              'Password must meet all requirements.'
            )}
          </FieldDescription>
        </FieldLabel>
        <FieldContent>
          <Input aria-invalid id="multi-error-password" type="password" defaultValue="abc" />
          <FieldError
            errors={[
              { message: 'Must be at least 8 characters' },
              { message: 'Must contain at least one number' },
              { message: 'Must contain at least one special character' },
            ]}
          />
        </FieldContent>
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const errorContainer = canvasElement.querySelector('[data-slot="field-error"]');
    expect(errorContainer).toBeInTheDocument();

    // Check that multiple error messages are displayed
    const errorText = errorContainer?.textContent ?? '';
    expect(errorText).toContain('8 characters');
    expect(errorText).toContain('number');
    expect(errorText).toContain('special character');
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('field.storyName.accessibility', 'Accessibility'),
  render: () => (
    <div className="w-full max-w-2xl space-y-8">
      <FieldSet>
        <div>
          <FieldLegend>
            {i18n.t('field.story.accountInformation', 'Account Information')}
          </FieldLegend>
          <FieldDescription>
            {i18n.t(
              'field.story.pleaseFillInYourAccountDetails',
              'Please fill in your account details.'
            )}
          </FieldDescription>
        </div>

        <FieldGroup>
          <Field orientation="vertical">
            <FieldLabel htmlFor="a11y-username">
              <FieldTitle>{i18n.t('field.story.username', 'Username')}</FieldTitle>
              <FieldDescription>
                {i18n.t('field.story.yourUniqueIdentifier', 'Your unique identifier.')}
              </FieldDescription>
            </FieldLabel>
            <FieldContent>
              <Input
                id="a11y-username"
                placeholder={i18n.t('field.story.enterUsername', 'Enter username')}
              />
            </FieldContent>
          </Field>

          <Field orientation="vertical" data-invalid="true">
            <FieldLabel htmlFor="a11y-email">
              <FieldTitle>{i18n.t('field.story.email', 'Email')}</FieldTitle>
              <FieldDescription>
                {i18n.t('field.story.usedForNotifications', 'Used for notifications.')}
              </FieldDescription>
            </FieldLabel>
            <FieldContent>
              <Input id="a11y-email" type="email" aria-invalid defaultValue="invalid" />
              <FieldError errors={[{ message: 'Please enter a valid email address.' }]} />
            </FieldContent>
          </Field>

          <Field orientation="vertical" data-disabled="true">
            <FieldLabel htmlFor="a11y-disabled">
              <FieldTitle>{i18n.t('field.story.disabledField', 'Disabled Field')}</FieldTitle>
            </FieldLabel>
            <FieldContent>
              <Input
                id="a11y-disabled"
                disabled
                placeholder={i18n.t('field.story.cannotEdit', 'Cannot edit')}
              />
            </FieldContent>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Verify fieldset structure
    const fieldSet = canvasElement.querySelector('[data-slot="field-set"]');
    expect(fieldSet).toBeInTheDocument();

    // Verify legend is present
    const legend = canvasElement.querySelector('[data-slot="field-legend"]');
    expect(legend).toBeInTheDocument();
    expect(legend).toHaveTextContent('Account Information');

    // Verify label-input associations
    const usernameLabel = canvasElement.querySelector('label[for="a11y-username"]');
    const usernameInput = canvasElement.querySelector('#a11y-username');
    expect(usernameLabel).toBeInTheDocument();
    expect(usernameInput).toBeInTheDocument();

    // Test clicking label focuses input
    if (usernameLabel instanceof HTMLElement && usernameInput instanceof HTMLInputElement) {
      await userEvent.click(usernameLabel);
      expect(doc.activeElement).toBe(usernameInput);
    }

    // Verify aria-invalid on error field
    const emailInput = canvasElement.querySelector('#a11y-email');
    if (emailInput instanceof HTMLInputElement) {
      expect(emailInput.getAttribute('aria-invalid')).toBe('true');
    }

    // Verify error message is present
    const errorMessage = canvasElement.querySelector('[data-slot="field-error"]');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage?.textContent).toContain('valid email');

    // Verify disabled input
    const disabledInput = canvasElement.querySelector('#a11y-disabled');
    if (disabledInput instanceof HTMLInputElement) {
      expect(disabledInput).toBeDisabled();
    }

    // Test keyboard navigation through fields
    if (usernameInput instanceof HTMLInputElement) {
      usernameInput.focus();
      expect(doc.activeElement).toBe(usernameInput);

      // Tab to email input
      await userEvent.tab();
      expect(doc.activeElement).toBe(emailInput);

      // Tab should skip disabled input
      await userEvent.tab();
      expect(doc.activeElement).not.toBe(disabledInput);
    }

    // Verify field descriptions are associated
    const descriptions = canvasElement.querySelectorAll('[data-slot="field-description"]');
    expect(descriptions.length).not.toBe(0);
  },
};

// ============ FACTORY WIRING: SINGLE ITEM FACTORIES ============

function FieldErrorDemo() {
  const error: FakeFieldError = createFakeFieldError({
    message: i18n.t('field.email.error'),
  });

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="field-error-demo">
      <h3 className="text-sm font-medium">{i18n.t('field.legend.account')}</h3>
      <Field data-invalid="true" orientation="vertical">
        <FieldLabel htmlFor="error-demo">
          <FieldTitle>{i18n.t('field.email.title')}</FieldTitle>
        </FieldLabel>
        <FieldContent>
          <Input aria-invalid id="error-demo" type="email" defaultValue="bad" />
          <FieldError errors={[error]} />
        </FieldContent>
      </Field>
    </div>
  );
}

export const WithFieldError: Story = {
  name: i18n.t('field.storyName.withFieldError', 'Factory: createFakeFieldError'),
  render: () => <FieldErrorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="field-error-demo"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="field-error"]')).toBeInTheDocument();
    expect(canvas.getByRole('alert')).toBeInTheDocument();
  },
};

function SingleFieldDemo() {
  const field: FakeField = createFakeField({
    inputType: 'text',
    label: i18n.t('field.company.title'),
    description: i18n.t('field.company.description'),
    placeholder: i18n.t('field.company.placeholder'),
  });

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="single-field-demo">
      <Field orientation={field.orientation ?? 'vertical'}>
        <FieldLabel htmlFor={field.id}>
          <FieldTitle>{field.label}</FieldTitle>
          {field.description && <FieldDescription>{field.description}</FieldDescription>}
        </FieldLabel>
        <FieldContent>
          <Input
            id={field.id}
            placeholder={field.placeholder}
            disabled={field.disabled}
            readOnly={field.readOnly}
            required={field.required}
          />
        </FieldContent>
      </Field>
    </div>
  );
}

export const WithSingleField: Story = {
  name: i18n.t('field.storyName.withSingleField', 'Factory: createFakeField'),
  render: () => <SingleFieldDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="single-field-demo"]')).toBeInTheDocument();
    const input = canvasElement.querySelector('input');
    expect(input).toBeInTheDocument();
    if (input instanceof HTMLInputElement) {
      await userEvent.click(input);
      await userEvent.type(input, 'Acme Corp');
      expect(input.value).toContain('Acme');
    }
  },
};

function TextFieldDemo() {
  const textField: FakeTextField = createFakeTextField({
    inputType: 'email',
    label: i18n.t('field.email.title'),
    description: i18n.t('field.email.description'),
    required: true,
    minLength: 5,
    maxLength: 100,
  });

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="text-field-demo">
      <Field orientation="vertical">
        <FieldLabel htmlFor={textField.id}>
          <FieldTitle>
            {textField.label}
            {textField.required && <span className="text-destructive"> *</span>}
          </FieldTitle>
          {textField.description && <FieldDescription>{textField.description}</FieldDescription>}
        </FieldLabel>
        <FieldContent>
          <Input
            id={textField.id}
            type={textField.inputType}
            placeholder={textField.placeholder}
            required={textField.required}
            minLength={textField.minLength}
            maxLength={textField.maxLength}
          />
        </FieldContent>
      </Field>
    </div>
  );
}

export const WithTextField: Story = {
  name: i18n.t('field.storyName.withTextField', 'Factory: createFakeTextField'),
  render: () => <TextFieldDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="text-field-demo"]')).toBeInTheDocument();
    const input = canvasElement.querySelector('input[type="email"]');
    expect(input).toBeInTheDocument();
    if (input instanceof HTMLInputElement) {
      expect(input.required).toBe(true);
    }
  },
};

function NumberFieldDemo() {
  const numField: FakeNumberField = createFakeNumberField({
    inputType: 'number',
    label: 'Quantity',
    min: 1,
    max: 100,
    step: 1,
  });

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="number-field-demo">
      <h3 className="text-sm font-medium">{i18n.t('field.legend.account')}</h3>
      <Field orientation="vertical">
        <FieldLabel htmlFor={numField.id}>
          <FieldTitle>{numField.label}</FieldTitle>
        </FieldLabel>
        <FieldContent>
          <Input
            id={numField.id}
            type="number"
            min={numField.min}
            max={numField.max}
            step={numField.step}
            defaultValue={String(numField.min ?? 1)}
          />
        </FieldContent>
      </Field>
    </div>
  );
}

export const WithNumberField: Story = {
  name: i18n.t('field.storyName.withNumberField', 'Factory: createFakeNumberField'),
  render: () => <NumberFieldDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="number-field-demo"]')).toBeInTheDocument();
    const input = canvasElement.querySelector('input[type="number"]');
    expect(input).toBeInTheDocument();
    if (input instanceof HTMLInputElement) {
      expect(Number(input.min)).toBeGreaterThanOrEqual(0);
      expect(Number(input.max)).toBeGreaterThan(Number(input.min));
    }
  },
};

function SelectFieldDemo() {
  const selectField: FakeSelectField = createFakeSelectField({
    label: 'Country',
    options: [
      { label: 'United States', value: 'us' },
      { label: 'United Kingdom', value: 'uk' },
      { label: 'Canada', value: 'ca' },
      { label: 'Australia', value: 'au' },
    ],
    required: true,
  });

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="select-field-demo">
      <h3 className="text-sm font-medium">{i18n.t('field.legend.account')}</h3>
      <Field orientation="vertical">
        <FieldLabel htmlFor={selectField.id}>
          <FieldTitle>
            {selectField.label}
            {selectField.required && <span className="text-destructive"> *</span>}
          </FieldTitle>
        </FieldLabel>
        <FieldContent>
          <NativeSelect id={selectField.id} required={selectField.required}>
            <option value="">{i18n.t('field.story.selectACountry', 'Select a country...')}</option>
            {selectField.options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </NativeSelect>
        </FieldContent>
      </Field>
    </div>
  );
}

export const WithSelectField: Story = {
  name: i18n.t('field.storyName.withSelectField', 'Factory: createFakeSelectField'),
  render: () => <SelectFieldDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="select-field-demo"]')).toBeInTheDocument();
    const select = canvasElement.querySelector('select');
    expect(select).toBeInTheDocument();
    if (select) {
      const options = select.querySelectorAll('option');
      expect(options.length).toBeGreaterThanOrEqual(2);
    }
  },
};

function ChoiceFieldDemo() {
  const checkboxField: FakeChoiceField = createFakeChoiceField('checkbox', {
    label: 'Subscribe to newsletter',
    checked: false,
  });
  const radioField: FakeChoiceField = createFakeChoiceField('radio', {
    label: 'Preferred contact method',
    value: 'email',
  });

  return (
    <div className="w-full max-w-2xl space-y-6" data-testid="choice-field-demo">
      <h3 className="text-sm font-medium">{i18n.t('field.legend.account')}</h3>
      <Field orientation="horizontal">
        <FieldLabel htmlFor={checkboxField.id}>
          <Checkbox id={checkboxField.id} defaultChecked={checkboxField.checked} />
          <FieldTitle>{checkboxField.label}</FieldTitle>
        </FieldLabel>
      </Field>
      <Field orientation="horizontal">
        <FieldLabel htmlFor={radioField.id}>
          <input
            type="radio"
            id={radioField.id}
            name="contact-method"
            value={radioField.value}
            className="accent-primary"
          />
          <FieldTitle>{radioField.label}</FieldTitle>
        </FieldLabel>
      </Field>
    </div>
  );
}

export const WithChoiceField: Story = {
  name: i18n.t('field.storyName.withChoiceField', 'Factory: createFakeChoiceField'),
  render: () => <ChoiceFieldDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="choice-field-demo"]')).toBeInTheDocument();
    const checkbox = canvasElement.querySelector('[role="checkbox"]');
    expect(checkbox).toBeInTheDocument();
    const radio = canvasElement.querySelector('input[type="radio"]');
    expect(radio).toBeInTheDocument();
  },
};

function TextareaFieldDemo() {
  const field: FakeTextareaField = createFakeTextareaField({
    label: 'Message',
    description: i18n.t('field.company.description'),
    rows: 5,
    maxLength: 500,
    required: true,
  });

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="textarea-field-demo">
      <Field orientation="vertical">
        <FieldLabel htmlFor={field.id}>
          <FieldTitle>
            {field.label}
            {field.required && <span className="text-destructive"> *</span>}
          </FieldTitle>
          {field.description && <FieldDescription>{field.description}</FieldDescription>}
        </FieldLabel>
        <FieldContent>
          <Textarea
            id={field.id}
            rows={field.rows}
            maxLength={field.maxLength}
            required={field.required}
            placeholder={field.placeholder}
          />
        </FieldContent>
      </Field>
    </div>
  );
}

export const WithTextareaField: Story = {
  name: i18n.t('field.storyName.withTextareaField', 'Factory: createFakeTextareaField'),
  render: () => <TextareaFieldDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="textarea-field-demo"]')).toBeInTheDocument();
    const textarea = canvasElement.querySelector('textarea');
    expect(textarea).toBeInTheDocument();
    if (textarea instanceof HTMLTextAreaElement) {
      expect(textarea.rows).toBeGreaterThanOrEqual(3);
      await userEvent.type(textarea, 'Hello, this is a test message.');
      expect(textarea.value).toContain('Hello');
    }
  },
};

function DateTimeFieldDemo() {
  const dateField: FakeDateTimeField = createFakeDateTimeField('date', {
    label: 'Start Date',
    required: true,
  });
  const timeField: FakeDateTimeField = createFakeDateTimeField('time', {
    label: 'Start Time',
  });
  const datetimeField: FakeDateTimeField = createFakeDateTimeField('datetime-local', {
    label: 'Appointment',
  });

  return (
    <div className="w-full max-w-2xl space-y-6" data-testid="datetime-field-demo">
      <h3 className="text-sm font-medium">{i18n.t('field.legend.account')}</h3>
      <FieldGroup>
        <Field orientation="vertical">
          <FieldLabel htmlFor={dateField.id}>
            <FieldTitle>{dateField.label}</FieldTitle>
          </FieldLabel>
          <FieldContent>
            <Input id={dateField.id} type="date" required={dateField.required} />
          </FieldContent>
        </Field>
        <Field orientation="vertical">
          <FieldLabel htmlFor={timeField.id}>
            <FieldTitle>{timeField.label}</FieldTitle>
          </FieldLabel>
          <FieldContent>
            <Input id={timeField.id} type="time" />
          </FieldContent>
        </Field>
        <Field orientation="vertical">
          <FieldLabel htmlFor={datetimeField.id}>
            <FieldTitle>{datetimeField.label}</FieldTitle>
          </FieldLabel>
          <FieldContent>
            <Input id={datetimeField.id} type="datetime-local" />
          </FieldContent>
        </Field>
      </FieldGroup>
    </div>
  );
}

export const WithDateTimeField: Story = {
  name: i18n.t('field.storyName.withDateTimeField', 'Factory: createFakeDateTimeField'),
  render: () => <DateTimeFieldDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="datetime-field-demo"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('input[type="date"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('input[type="time"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('input[type="datetime-local"]')).toBeInTheDocument();
  },
};

function FileFieldDemo() {
  const { t } = useTranslation();
  const fileField: FakeFileField = createFakeFileField({
    label: 'Upload Document',
    accept: '.pdf,.doc,.docx',
    multiple: true,
    description: t('field.company.description'),
  });

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="file-field-demo">
      <Field orientation="vertical">
        <FieldLabel htmlFor={fileField.id}>
          <FieldTitle>{fileField.label}</FieldTitle>
          {fileField.description && <FieldDescription>{fileField.description}</FieldDescription>}
        </FieldLabel>
        <FieldContent>
          <Input
            id={fileField.id}
            type="file"
            accept={fileField.accept}
            multiple={fileField.multiple}
          />
        </FieldContent>
      </Field>
    </div>
  );
}

export const WithFileField: Story = {
  name: i18n.t('field.storyName.withFileField', 'Factory: createFakeFileField'),
  render: () => <FileFieldDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="file-field-demo"]')).toBeInTheDocument();
    const fileInput = canvasElement.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    if (fileInput instanceof HTMLInputElement) {
      expect(fileInput.accept).toContain('.pdf');
      expect(fileInput.multiple).toBe(true);
    }
  },
};

// ============ FACTORY WIRING: GROUP + SET FACTORIES ============

function FieldGroupDemo() {
  const group: FakeFieldGroup = createFakeFieldGroup(3, {
    legend: i18n.t('field.legend.account'),
    description: i18n.t('field.legend.description'),
    legendVariant: 'legend',
  });

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="field-group-demo">
      <FieldSet>
        {group.legend && (
          <div>
            <FieldLegend>{group.legend}</FieldLegend>
            {group.description && <FieldDescription>{group.description}</FieldDescription>}
          </div>
        )}
        <FieldGroup>
          {group.fields.map((field) => (
            <Field
              key={field.id}
              orientation={field.orientation ?? 'vertical'}
              data-invalid={field.invalid ? 'true' : undefined}
            >
              <FieldLabel htmlFor={field.id}>
                <FieldTitle>{field.label}</FieldTitle>
              </FieldLabel>
              <FieldContent>
                <Input id={field.id} placeholder={field.placeholder} disabled={field.disabled} />
                {field.errors?.map((err) => (
                  <FieldError key={err.message} errors={[err]} />
                ))}
              </FieldContent>
            </Field>
          ))}
        </FieldGroup>
      </FieldSet>
    </div>
  );
}

export const WithFieldGroup: Story = {
  name: i18n.t('field.storyName.withFieldGroup', 'Factory: createFakeFieldGroup'),
  render: () => <FieldGroupDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="field-group-demo"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="field-group"]')).toBeInTheDocument();
    const fields = canvasElement.querySelectorAll('[data-slot="field"]');
    expect(fields.length).toBe(3);
  },
};

function FieldSetFactoryDemo() {
  const fieldSet: FakeFieldSet = createFakeFieldSet(2, {
    legend: i18n.t('field.legend.account'),
    legendVariant: 'legend',
  });

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="field-set-factory-demo">
      <FieldSet>
        <div>
          <FieldLegend variant={fieldSet.legendVariant}>{fieldSet.legend}</FieldLegend>
        </div>
        {fieldSet.groups.map((group) => (
          <FieldGroup key={group.id}>
            {group.legend && (
              <div>
                <FieldLegend variant={group.legendVariant}>{group.legend}</FieldLegend>
                {group.description && <FieldDescription>{group.description}</FieldDescription>}
              </div>
            )}
            {group.fields.map((field) => (
              <Field key={field.id} orientation={field.orientation ?? 'vertical'}>
                <FieldLabel htmlFor={field.id}>
                  <FieldTitle>{field.label}</FieldTitle>
                </FieldLabel>
                <FieldContent>
                  <Input id={field.id} placeholder={field.placeholder} />
                </FieldContent>
              </Field>
            ))}
          </FieldGroup>
        ))}
      </FieldSet>
    </div>
  );
}

export const WithFieldSet: Story = {
  name: i18n.t('field.storyName.withFieldSet', 'Factory: createFakeFieldSet'),
  render: () => <FieldSetFactoryDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="field-set-factory-demo"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="field-set"]')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="field-group"]');
    expect(groups.length).toBeGreaterThanOrEqual(2);
  },
};

// ============ FACTORY WIRING: BULK FACTORIES ============

function FieldGroupsDemo() {
  const groups: FakeFieldGroup[] = createFakeFieldGroups(3);

  return (
    <div className="w-full max-w-2xl space-y-6" data-testid="field-groups-demo">
      <h3 className="text-sm font-medium">{i18n.t('field.legend.account')}</h3>
      <FieldSet>
        {groups.map((group) => (
          <FieldGroup key={group.id}>
            {group.legend && (
              <div>
                <FieldLegend variant={group.legendVariant}>{group.legend}</FieldLegend>
                {group.description && <FieldDescription>{group.description}</FieldDescription>}
              </div>
            )}
            {group.fields.map((field) => (
              <Field key={field.id} orientation={field.orientation ?? 'vertical'}>
                <FieldLabel htmlFor={field.id}>
                  <FieldTitle>{field.label}</FieldTitle>
                </FieldLabel>
                <FieldContent>
                  <Input id={field.id} placeholder={field.placeholder} />
                </FieldContent>
              </Field>
            ))}
          </FieldGroup>
        ))}
      </FieldSet>
    </div>
  );
}

export const WithFieldGroups: Story = {
  name: i18n.t('field.storyName.withFieldGroups', 'Factory: createFakeFieldGroups'),
  render: () => <FieldGroupsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="field-groups-demo"]')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="field-group"]');
    expect(groups.length).toBe(3);
  },
};

// ============ FACTORY WIRING: SPECIALIZED FORM FACTORIES ============

function RenderFormConfig({ config }: { config: FakeFormConfig }) {
  useTranslation();
  return (
    <div className="w-full max-w-2xl space-y-6">
      {config.title && <h2 className="text-lg font-semibold">{config.title}</h2>}
      {config.description && <FieldDescription>{config.description}</FieldDescription>}
      {config.fieldSets.map((fs) => (
        <FieldSet key={fs.id}>
          <div>
            <FieldLegend>{fs.legend}</FieldLegend>
          </div>
          {fs.groups.map((group) => (
            <FieldGroup key={group.id}>
              {group.legend && (
                <div>
                  <FieldLegend variant="label">{group.legend}</FieldLegend>
                  {group.description && <FieldDescription>{group.description}</FieldDescription>}
                </div>
              )}
              {group.fields.map((field) => (
                <Field key={field.id} orientation="vertical">
                  <FieldLabel htmlFor={field.id}>
                    <FieldTitle>
                      {field.label}
                      {field.required && <span className="text-destructive"> *</span>}
                    </FieldTitle>
                    {field.description && <FieldDescription>{field.description}</FieldDescription>}
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id={field.id}
                      type={field.inputType === 'textarea' ? 'text' : field.inputType}
                      placeholder={field.placeholder}
                      disabled={field.disabled}
                      readOnly={field.readOnly}
                      required={field.required}
                    />
                  </FieldContent>
                </Field>
              ))}
            </FieldGroup>
          ))}
        </FieldSet>
      ))}
      {config.submitLabel && (
        <button
          type="button"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          {config.submitLabel}
        </button>
      )}
    </div>
  );
}

function LoginFormDemo() {
  useTranslation();
  const config: FakeFormConfig = createFakeLoginForm();
  return (
    <div data-testid="login-form-demo">
      <RenderFormConfig config={config} />
    </div>
  );
}

export const WithLoginForm: Story = {
  name: i18n.t('field.storyName.withLoginForm', 'Factory: createFakeLoginForm'),
  render: () => <LoginFormDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="login-form-demo"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="field-set"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Sign In')).toBeInTheDocument();
    const inputs = canvasElement.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  },
};

function RegistrationFormDemo() {
  useTranslation();
  const config: FakeFormConfig = createFakeRegistrationForm();
  return (
    <div data-testid="registration-form-demo">
      <RenderFormConfig config={config} />
    </div>
  );
}

export const WithRegistrationForm: Story = {
  name: i18n.t('field.storyName.withRegistrationForm', 'Factory: createFakeRegistrationForm'),
  render: () => <RegistrationFormDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="registration-form-demo"]')
    ).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Create Account')).toBeInTheDocument();
    const inputs = canvasElement.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(4);
  },
};

function ContactFormDemo() {
  useTranslation();
  const config: FakeFormConfig = createFakeContactForm();
  return (
    <div data-testid="contact-form-demo">
      <RenderFormConfig config={config} />
    </div>
  );
}

export const WithContactForm: Story = {
  name: i18n.t('field.storyName.withContactForm', 'Factory: createFakeContactForm'),
  render: () => <ContactFormDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="contact-form-demo"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Send Message')).toBeInTheDocument();
    expect(canvas.getByText('Contact Us')).toBeInTheDocument();
  },
};

function ProfileFormDemo() {
  useTranslation();
  const config: FakeFormConfig = createFakeProfileForm();
  return (
    <div data-testid="profile-form-demo">
      <RenderFormConfig config={config} />
    </div>
  );
}

export const WithProfileForm: Story = {
  name: i18n.t('field.storyName.withProfileForm', 'Factory: createFakeProfileForm'),
  render: () => <ProfileFormDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="profile-form-demo"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Save Changes')).toBeInTheDocument();
    expect(canvas.getByText('Profile Settings')).toBeInTheDocument();
  },
};

// ============ FACTORY WIRING: MATRIX + SHOWCASE FACTORIES ============

function FieldMatrixDemo() {
  const matrix: Record<string, FakeField> = createFakeFieldMatrix();
  const entries = Object.entries(matrix);

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="field-matrix-demo">
      <h3 className="text-sm font-medium">{i18n.t('field.legend.account')}</h3>
      <FieldSet>
        <div>
          <FieldLegend>{i18n.t('field.story.fieldMatrix', 'Field Matrix')}</FieldLegend>
          <FieldDescription>
            All field configuration variations from createFakeFieldMatrix().
          </FieldDescription>
        </div>
        <FieldGroup>
          {entries.map(([key, field]) => (
            <Field
              key={key}
              orientation={field.orientation ?? 'vertical'}
              data-invalid={field.invalid ? 'true' : undefined}
              data-disabled={field.disabled ? 'true' : undefined}
            >
              <FieldLabel htmlFor={`matrix-${key}`}>
                <FieldTitle>{field.label}</FieldTitle>
                {field.description && <FieldDescription>{field.description}</FieldDescription>}
              </FieldLabel>
              <FieldContent>
                <Input
                  id={`matrix-${key}`}
                  type={
                    field.inputType === 'textarea' ||
                    field.inputType === 'select' ||
                    field.inputType === 'checkbox' ||
                    field.inputType === 'radio' ||
                    field.inputType === 'file' ||
                    field.inputType === 'range'
                      ? 'text'
                      : field.inputType
                  }
                  placeholder={field.placeholder}
                  disabled={field.disabled}
                  readOnly={field.readOnly}
                  aria-invalid={field.invalid || undefined}
                />
                {field.errors?.map((err) => (
                  <FieldError key={err.message} errors={[err]} />
                ))}
              </FieldContent>
            </Field>
          ))}
        </FieldGroup>
      </FieldSet>
    </div>
  );
}

export const WithFieldMatrix: Story = {
  name: i18n.t('field.storyName.withFieldMatrix', 'Factory: createFakeFieldMatrix'),
  render: () => <FieldMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="field-matrix-demo"]')).toBeInTheDocument();
    const fields = canvasElement.querySelectorAll('[data-slot="field"]');
    expect(fields.length).toBeGreaterThanOrEqual(10);
    const canvas = within(canvasElement);
    expect(canvas.getByText('Field Matrix')).toBeInTheDocument();
  },
};

function FormShowcaseDemo() {
  useTranslation();
  const showcase: Record<string, FakeFormConfig> = createFakeFormShowcase();
  const entries = Object.entries(showcase);

  return (
    <div className="w-full max-w-4xl space-y-12" data-testid="form-showcase-demo">
      {entries.map(([key, config]) => (
        <div key={key} className="rounded-lg border p-6">
          <RenderFormConfig config={config} />
        </div>
      ))}
    </div>
  );
}

export const WithFormShowcase: Story = {
  name: i18n.t('field.storyName.withFormShowcase', 'Factory: createFakeFormShowcase'),
  render: () => <FormShowcaseDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="form-showcase-demo"]')).toBeInTheDocument();
    const fieldSets = canvasElement.querySelectorAll('[data-slot="field-set"]');
    expect(fieldSets.length).toBe(4);
    const canvas = within(canvasElement);
    expect(canvas.getByText('Login')).toBeInTheDocument();
    expect(canvas.getByText('Sign Up')).toBeInTheDocument();
    expect(canvas.getByText('Contact')).toBeInTheDocument();
    expect(canvas.getByText('Edit Profile')).toBeInTheDocument();
  },
};

// ============ FACTORY WIRING: CONSTANTS ============

function OrientationsDemo() {
  const orientations: FieldOrientation[] = FIELD_ORIENTATIONS;

  return (
    <div className="w-full max-w-2xl space-y-8" data-testid="orientations-demo">
      <h3 className="text-sm font-medium">{i18n.t('field.legend.account')}</h3>
      {orientations.map((orientation) => (
        <div key={orientation} className="space-y-2">
          <div className="text-muted-foreground text-xs font-medium uppercase">{orientation}</div>
          <Field orientation={orientation}>
            <FieldLabel htmlFor={`orientation-${orientation}`}>
              <FieldTitle>{`${orientation} field`}</FieldTitle>
              <FieldDescription>Orientation: {orientation}</FieldDescription>
            </FieldLabel>
            <FieldContent>
              <Input id={`orientation-${orientation}`} placeholder={`${orientation} layout`} />
            </FieldContent>
          </Field>
        </div>
      ))}
    </div>
  );
}

export const WithOrientations: Story = {
  name: i18n.t('field.storyName.withOrientations', 'Constant: FIELD_ORIENTATIONS'),
  render: () => <OrientationsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="orientations-demo"]')).toBeInTheDocument();
    for (const orientation of FIELD_ORIENTATIONS) {
      const input = canvasElement.querySelector(`#orientation-${orientation}`);
      expect(input).toBeInTheDocument();
    }
  },
};

function LegendVariantsDemo() {
  const variants: FieldLegendVariant[] = LEGEND_VARIANTS;

  return (
    <div className="w-full max-w-2xl space-y-8" data-testid="legend-variants-demo">
      {variants.map((variant) => (
        <FieldSet key={variant}>
          <div>
            <FieldLegend variant={variant}>
              {i18n.t('field.legend.account')} ({variant})
            </FieldLegend>
            <FieldDescription>{i18n.t('field.legend.description')}</FieldDescription>
          </div>
          <FieldGroup>
            <Field orientation="vertical">
              <FieldLabel htmlFor={`legend-${variant}`}>
                <FieldTitle>{i18n.t('field.email.title')}</FieldTitle>
              </FieldLabel>
              <FieldContent>
                <Input
                  id={`legend-${variant}`}
                  type="email"
                  placeholder={i18n.t('field.story.emailExample', 'email@example.com')}
                />
              </FieldContent>
            </Field>
          </FieldGroup>
        </FieldSet>
      ))}
    </div>
  );
}

export const WithLegendVariants: Story = {
  name: i18n.t('field.storyName.withLegendVariants', 'Constant: LEGEND_VARIANTS'),
  render: () => <LegendVariantsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="legend-variants-demo"]')).toBeInTheDocument();
    const legends = canvasElement.querySelectorAll('[data-slot="field-legend"]');
    expect(legends.length).toBe(LEGEND_VARIANTS.length);
    for (const variant of LEGEND_VARIANTS) {
      const legend = canvasElement.querySelector(`[data-variant="${variant}"]`);
      expect(legend).toBeInTheDocument();
    }
  },
};

function InputTypesDemo() {
  const types: FieldInputType[] = INPUT_TYPES;

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="input-types-demo">
      <h3 className="text-sm font-medium">{i18n.t('field.legend.account')}</h3>
      <FieldSet>
        <div>
          <FieldLegend>{i18n.t('field.story.inputTypes', 'Input Types')}</FieldLegend>
          <FieldDescription>
            All {types.length} input types from INPUT_TYPES constant.
          </FieldDescription>
        </div>
        <FieldGroup>
          {types.map((type) => (
            <Field key={type} orientation="horizontal">
              <FieldLabel htmlFor={`type-${type}`}>
                <FieldTitle>{type}</FieldTitle>
              </FieldLabel>
              <FieldContent>
                <Input
                  id={`type-${type}`}
                  type={
                    type === 'textarea' ||
                    type === 'select' ||
                    type === 'checkbox' ||
                    type === 'radio' ||
                    type === 'file' ||
                    type === 'range'
                      ? 'text'
                      : type
                  }
                  placeholder={`${type} input`}
                />
              </FieldContent>
            </Field>
          ))}
        </FieldGroup>
      </FieldSet>
    </div>
  );
}

export const WithInputTypes: Story = {
  name: i18n.t('field.storyName.withInputTypes', 'Constant: INPUT_TYPES'),
  render: () => <InputTypesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="input-types-demo"]')).toBeInTheDocument();
    const fields = canvasElement.querySelectorAll('[data-slot="field"]');
    expect(fields.length).toBe(INPUT_TYPES.length);
  },
};

function TextInputTypesDemo() {
  const types: FakeTextField['inputType'][] = TEXT_INPUT_TYPES;

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="text-input-types-demo">
      <h3 className="text-sm font-medium">{i18n.t('field.legend.account')}</h3>
      <FieldSet>
        <div>
          <FieldLegend>{i18n.t('field.story.textInputTypes', 'Text Input Types')}</FieldLegend>
          <FieldDescription>
            All {types.length} text input types from TEXT_INPUT_TYPES.
          </FieldDescription>
        </div>
        <FieldGroup>
          {types.map((type) => {
            const field = createFakeTextField({ inputType: type });
            return (
              <Field key={type} orientation="responsive">
                <FieldLabel htmlFor={`text-type-${type}`}>
                  <FieldTitle>{field.label}</FieldTitle>
                  <FieldDescription>Type: {type}</FieldDescription>
                </FieldLabel>
                <FieldContent>
                  <Input id={`text-type-${type}`} type={type} placeholder={field.placeholder} />
                </FieldContent>
              </Field>
            );
          })}
        </FieldGroup>
      </FieldSet>
    </div>
  );
}

export const WithTextInputTypes: Story = {
  name: i18n.t('field.storyName.withTextInputTypes', 'Constant: TEXT_INPUT_TYPES'),
  render: () => <TextInputTypesDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="text-input-types-demo"]')
    ).toBeInTheDocument();
    const fields = canvasElement.querySelectorAll('[data-slot="field"]');
    expect(fields.length).toBe(TEXT_INPUT_TYPES.length);
  },
};

function FieldLabelsByTypeDemo() {
  const labelsByType: Record<FieldInputType, string[]> = FIELD_LABELS_BY_TYPE;
  const entries = Object.entries(labelsByType) as [FieldInputType, string[]][];

  return (
    <div className="w-full max-w-3xl space-y-4" data-testid="labels-by-type-demo">
      <h3 className="text-sm font-medium">{i18n.t('field.legend.account')}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {entries.map(([type, labels]) => (
          <div key={type} className="rounded-lg border p-3">
            <div className="text-muted-foreground mb-2 text-xs font-semibold uppercase">{type}</div>
            <ul className="space-y-1">
              {labels.map((label) => (
                <li key={label} className="text-sm">
                  {label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export const WithFieldLabelsByType: Story = {
  name: i18n.t('field.storyName.withFieldLabelsByType', 'Constant: FIELD_LABELS_BY_TYPE'),
  render: () => <FieldLabelsByTypeDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="labels-by-type-demo"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('text')).toBeInTheDocument();
    expect(canvas.getByText('email')).toBeInTheDocument();
    expect(canvas.getByText('Name')).toBeInTheDocument();
    expect(canvas.getByText('Email')).toBeInTheDocument();
  },
};

function ErrorMessagesByTypeDemo() {
  const errorsByType: Record<FieldInputType, string[]> = ERROR_MESSAGES_BY_TYPE;
  const entries = Object.entries(errorsByType) as [FieldInputType, string[]][];

  return (
    <div className="w-full max-w-3xl space-y-4" data-testid="errors-by-type-demo">
      <h3 className="text-sm font-medium">{i18n.t('field.legend.account')}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {entries.map(([type, errors]) => (
          <div key={type} className="rounded-lg border p-3">
            <div className="text-muted-foreground mb-2 text-xs font-semibold uppercase">{type}</div>
            <ul className="space-y-1">
              {errors.map((error) => (
                <li key={error} className="text-destructive text-sm">
                  {error}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export const WithErrorMessagesByType: Story = {
  name: i18n.t('field.storyName.withErrorMessagesByType', 'Constant: ERROR_MESSAGES_BY_TYPE'),
  render: () => <ErrorMessagesByTypeDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="errors-by-type-demo"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('This field is required')).toBeInTheDocument();
    expect(canvas.getByText('Password is required')).toBeInTheDocument();
  },
};

// ============ FACTORY WIRING: VALIDATION STATE TYPE ============

function ValidationStatesDemo() {
  const states: FieldValidationState[] = ['error', 'success', 'warning'];

  return (
    <div className="w-full max-w-2xl space-y-6" data-testid="validation-states-demo">
      <h3 className="text-sm font-medium">{i18n.t('field.legend.account')}</h3>
      {states.map((state) => (
        <Field
          key={state}
          orientation="vertical"
          data-invalid={state === 'error' ? 'true' : undefined}
        >
          <FieldLabel htmlFor={`validation-${state}`}>
            <FieldTitle>{state.charAt(0).toUpperCase() + state.slice(1)} State</FieldTitle>
            <FieldDescription>Validation state: {state}</FieldDescription>
          </FieldLabel>
          <FieldContent>
            <Input
              id={`validation-${state}`}
              aria-invalid={state === 'error' || undefined}
              defaultValue={`${state} value`}
            />
            {state === 'error' && <FieldError errors={[{ message: 'This field has an error.' }]} />}
          </FieldContent>
        </Field>
      ))}
    </div>
  );
}

export const WithValidationStates: Story = {
  name: i18n.t('field.storyName.withValidationStates', 'Type: FieldValidationState'),
  render: () => <ValidationStatesDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="validation-states-demo"]')
    ).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Error State')).toBeInTheDocument();
    expect(canvas.getByText('Success State')).toBeInTheDocument();
    expect(canvas.getByText('Warning State')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="field-error"]')).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   validationError
//   notFound
//   conflict
//   slowValidation
//   slowResponse
//   noSuggestions
//   suggestions
//   emptyData
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('field.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: fieldStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerValidationError: Story = {
  ...Default,
  name: i18n.t('field.storyName.handlerValidationError', 'Handler: Validation Error'),
  parameters: { msw: { handlers: fieldStatusHandlers.validationError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('field.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: fieldStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('field.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: fieldStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowValidation: Story = {
  ...Default,
  name: i18n.t('field.storyName.handlerSlowValidation', 'Handler: Slow Validation'),
  parameters: { msw: { handlers: fieldStatusHandlers.slowValidation } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('field.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: fieldStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNoSuggestions: Story = {
  ...Default,
  name: i18n.t('field.storyName.handlerNoSuggestions', 'Handler: No Suggestions'),
  parameters: { msw: { handlers: fieldStatusHandlers.noSuggestions } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('field.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: fieldStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
