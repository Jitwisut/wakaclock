import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import type {
  FakeTextareaWithContentType,
  TextareaContentType,
  TextareaResize,
  TextareaSize,
  TextareaValidationState,
} from '@/.storybook/stories/_factories/textarea.factory';
import {
  createFakeAutoResizeTextarea,
  createFakeBioTextarea,
  createFakeCodeTextarea,
  createFakeCommentTextarea,
  createFakeDescriptionTextarea,
  createFakeDisabledTextarea,
  createFakeErrorTextarea,
  createFakeMessageTextarea,
  createFakeReadOnlyTextarea,
  createFakeRequiredTextarea,
  createFakeReviewTextarea,
  createFakeTextarea,
  createFakeTextareaByContentType,
  createFakeTextareaFormField,
  createFakeTextareas,
  createFakeTextareaWithCharCount,
  createFakeTextareaWithLabel,
  createTextareaContentTypeMatrix,
  createTextareaResizeMatrix,
  createTextareaShowcase,
  createTextareaSizeMatrix,
  createTextareaTestData,
  createTextareaValidationMatrix,
  TEXTAREA_CONTENT_TYPES,
  TEXTAREA_ERROR_MESSAGES,
  TEXTAREA_HELP_TEXT,
  TEXTAREA_LABELS,
  TEXTAREA_PLACEHOLDERS,
  TEXTAREA_RESIZE_OPTIONS,
  TEXTAREA_SAMPLE_CONTENT,
  TEXTAREA_SIZE_ROWS,
  TEXTAREA_SIZES,
  TEXTAREA_VALIDATION_STATES,
} from '@/.storybook/stories/_factories/textarea.factory';
import {
  textareaHandlers,
  textareaStatusHandlers,
} from '@/.storybook/stories/_handlers/textarea.handlers';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function I18nTextareaDemo(args: React.ComponentProps<typeof Textarea>) {
  const { t } = useTranslation();

  return (
    <div className="w-[420px] space-y-2">
      <Label htmlFor="message">{t('textarea.label')}</Label>
      <Textarea id="message" placeholder={t('textarea.placeholder')} {...args} />
    </div>
  );
}

const meta = {
  title: 'Components/UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  args: {
    placeholder: 'Write something…',
    disabled: false,
    rows: 3,
    onChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: textareaHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    placeholder: {
      control: 'text',
      description: i18n.t(
        'textarea.argType.placeholderTextShownWhenEmpty',
        'Placeholder text shown when empty'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    defaultValue: {
      control: 'text',
      description: i18n.t(
        'textarea.argType.initialValueForUncontrolledTextarea',
        'Initial value for uncontrolled textarea'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    value: {
      control: 'text',
      description: i18n.t(
        'textarea.argType.controlledValueOfTheTextarea',
        'Controlled value of the textarea'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Layout
    rows: {
      control: { type: 'number', min: 1, max: 20 },
      description: i18n.t(
        'textarea.argType.numberOfVisibleTextRows',
        'Number of visible text rows'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'number' },
      },
    },
    cols: {
      control: { type: 'number', min: 1, max: 100 },
      description: i18n.t(
        'textarea.argType.visibleWidthInAverageCharacterWidths',
        'Visible width in average character widths'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'number' },
      },
    },
    // State
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'textarea.argType.whetherTheTextareaIsDisabled',
        'Whether the textarea is disabled'
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
        'textarea.argType.whetherTheTextareaIsReadonly',
        'Whether the textarea is read-only'
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
        'textarea.argType.whetherTheTextareaIsRequired',
        'Whether the textarea is required'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Validation
    maxLength: {
      control: { type: 'number', min: 0, max: 10_000 },
      description: i18n.t(
        'textarea.argType.maximumNumberOfCharactersAllowed',
        'Maximum number of characters allowed'
      ),
      table: {
        category: 'Validation',
        type: { summary: 'number' },
      },
    },
    minLength: {
      control: { type: 'number', min: 0, max: 10_000 },
      description: i18n.t(
        'textarea.argType.minimumNumberOfCharactersRequired',
        'Minimum number of characters required'
      ),
      table: {
        category: 'Validation',
        type: { summary: 'number' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t(
        'textarea.argType.additionalCssClassesForCustomStyling',
        'Additional CSS classes for custom styling'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // HTML
    id: {
      control: 'text',
      description: i18n.t(
        'textarea.argType.uniqueIdentifierForTheTextarea',
        'Unique identifier for the textarea'
      ),
      table: {
        category: 'HTML',
        type: { summary: 'string' },
      },
    },
    name: {
      control: 'text',
      description: i18n.t(
        'textarea.argType.nameAttributeForFormSubmission',
        'Name attribute for form submission'
      ),
      table: {
        category: 'HTML',
        type: { summary: 'string' },
      },
    },
    autoComplete: {
      control: 'select',
      options: ['off', 'on'],
      description: i18n.t('textarea.argType.autocompleteBehavior', 'Autocomplete behavior'),
      table: {
        category: 'HTML',
        type: { summary: "'off' | 'on'" },
      },
    },
    // Accessibility
    'aria-label': {
      control: 'text',
      description: i18n.t(
        'textarea.argType.accessibleLabelForScreenReaders',
        'Accessible label for screen readers'
      ),
      table: {
        category: 'Accessibility',
        type: { summary: 'string' },
      },
    },
    'aria-describedby': {
      control: 'text',
      description: i18n.t(
        'textarea.argType.idOfElementDescribingTheTextarea',
        'ID of element describing the textarea'
      ),
      table: {
        category: 'Accessibility',
        type: { summary: 'string' },
      },
    },
    'aria-invalid': {
      control: 'boolean',
      description: i18n.t(
        'textarea.argType.whetherTheTextareaHasInvalidInput',
        'Whether the textarea has invalid input'
      ),
      table: {
        category: 'Accessibility',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Events
    onChange: {
      action: 'onChange',
      description: i18n.t('textarea.argType.calledWhenValueChanges', 'Called when value changes'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t(
        'textarea.argType.calledWhenTextareaReceivesFocus',
        'Called when textarea receives focus'
      ),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t(
        'textarea.argType.calledWhenTextareaLosesFocus',
        'Called when textarea loses focus'
      ),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('textarea.argType.calledOnKeyDown', 'Called on key down'),
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div className="w-[420px] space-y-2">
      <Label htmlFor="message">{i18n.t('textarea.story.message', 'Message')}</Label>
      <Textarea id="message" {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="textarea"]')).toBeInTheDocument();
    expect(canvas.getByText('Message')).toBeInTheDocument();
  },
};

function VariantsDemo() {
  return (
    <div className="w-[420px] space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('textarea.variants.default')}</p>
        <Textarea placeholder={i18n.t('textarea.story.defaultTextarea', 'Default textarea...')} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('textarea.variants.disabled')}</p>
        <Textarea
          disabled
          placeholder={i18n.t('textarea.story.disabledTextarea', 'Disabled textarea...')}
          defaultValue={i18n.t('textarea.story.disabledDefaultValue', 'This textarea is disabled')}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('textarea.variants.invalid')}</p>
        <Textarea
          aria-invalid
          placeholder={i18n.t('textarea.story.invalidTextarea', 'Invalid textarea...')}
          defaultValue={i18n.t('textarea.story.invalidDefaultValue', 'This content is invalid')}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('textarea.variants.readOnly')}</p>
        <Textarea
          readOnly
          defaultValue={i18n.t(
            'textarea.story.readOnlyDefaultValue',
            'This textarea is read-only and cannot be edited.'
          )}
        />
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify component rendered
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify all textareas exist (4 variants)
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(4);

    // Verify data-slot attributes exist
    for (const textarea of textareas) {
      expect(textarea.getAttribute('data-slot')).toBe('textarea');
    }

    // Verify disabled textarea
    const disabledTextarea = canvasElement.querySelector('textarea[disabled]');
    expect(disabledTextarea).toBeInTheDocument();

    // Verify invalid textarea
    const invalidTextarea = canvasElement.querySelector('textarea[aria-invalid]');
    expect(invalidTextarea).toBeInTheDocument();

    // Verify read-only textarea
    const readOnlyTextarea = canvasElement.querySelector('textarea[readonly]');
    expect(readOnlyTextarea).toBeInTheDocument();

    // Verify text content
    expect(canvas.getByDisplayValue('This textarea is disabled')).toBeInTheDocument();
  },
};

function SizesDemo() {
  return (
    <div className="w-[420px] space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('textarea.sizes.small')}</p>
        <Textarea
          rows={2}
          placeholder={i18n.t('textarea.story.smallTextarea', 'Small textarea...')}
          className="min-h-[60px]"
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('textarea.sizes.default')}</p>
        <Textarea
          rows={3}
          placeholder={i18n.t('textarea.story.defaultTextarea', 'Default textarea...')}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('textarea.sizes.large')}</p>
        <Textarea
          rows={6}
          placeholder={i18n.t('textarea.story.largeTextarea', 'Large textarea...')}
          className="min-h-[160px]"
        />
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    // Verify component rendered
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify all textareas exist (3 sizes)
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(3);

    // Verify data-slot attributes exist
    for (const textarea of textareas) {
      expect(textarea.getAttribute('data-slot')).toBe('textarea');
    }

    // Verify different row configurations
    const textareaElements = [...textareas] as HTMLTextAreaElement[];
    expect(textareaElements[0].rows).toBe(2); // Small
    expect(textareaElements[1].rows).toBe(3); // Default
    expect(textareaElements[2].rows).toBe(6); // Large

    // Verify placeholders exist
    for (const textarea of textareaElements) {
      expect(textarea.placeholder).toContain('textarea');
    }
  },
};

export const Invalid: Story = {
  render: () => (
    <div className="w-[420px] space-y-2">
      <Label htmlFor="invalid">{i18n.t('textarea.story.invalid', 'Invalid')}</Label>
      <Textarea
        aria-invalid
        defaultValue={i18n.t('textarea.story.thisIsInvalid', 'This is invalid.')}
        id="invalid"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify component rendered
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify textarea exists with data-slot
    const textarea = canvasElement.querySelector('[data-slot="textarea"]');
    expect(textarea).toBeInTheDocument();

    // Verify aria-invalid attribute
    expect(textarea?.getAttribute('aria-invalid')).toBe('true');

    // Verify label exists
    expect(canvas.getByText('Invalid')).toBeInTheDocument();

    // Verify default value
    expect(canvas.getByDisplayValue('This is invalid.')).toBeInTheDocument();

    // Verify textarea has correct id
    expect(textarea?.getAttribute('id')).toBe('invalid');
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const textarea = canvasElement.querySelector('#message');

    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('Textarea was not found.');
    }

    expect(textarea.getAttribute('data-slot')).toBe('textarea');

    await userEvent.click(textarea);

    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Hello from Storybook');

    expect(textarea.value).toBe('Hello from Storybook');
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('data-slot')).toBe('textarea');

    await userEvent.click(textarea);
    await userEvent.type(textarea, 'Dark mode text');
    expect(textarea).toHaveValue('Dark mode text');
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('data-slot')).toBe('textarea');

    await userEvent.click(textarea);
    await userEvent.type(textarea, 'RTL text input');
    expect(textarea).toHaveValue('RTL text input');
  },
};

export const Japanese: Story = {
  globals: {
    locale: 'ja',
  },
  render: (args) => <I18nTextareaDemo {...args} />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const textarea = context.canvasElement.querySelector('#message');
    expect(textarea?.getAttribute('placeholder')).toBe('入力してください…');

    const canvas = within(context.canvasElement);
    expect(canvas.getByText('メッセージ')).toBeInTheDocument();

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
  name: i18n.t('textarea.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
  name: i18n.t('textarea.storyName.accessibility', 'Accessibility'),
  render: () => (
    <div className="w-[420px] space-y-2">
      <Label htmlFor="a11y-textarea">{i18n.t('textarea.story.message', 'Message')}</Label>
      <Textarea
        id="a11y-textarea"
        aria-describedby="a11y-textarea-desc"
        placeholder={i18n.t('textarea.story.typeYourMessage', 'Type your message here...')}
      />
      <p id="a11y-textarea-desc" className="text-muted-foreground text-sm">
        {i18n.t('textarea.story.maxCharacters', 'Maximum 500 characters allowed.')}
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvasElement.querySelector('#a11y-textarea') as HTMLTextAreaElement;

    // Verify textarea element
    expect(textarea.tagName).toBe('TEXTAREA');

    // Verify label association
    const label = canvas.getByText('Message');
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe('a11y-textarea');

    // Verify aria-describedby
    expect(textarea.getAttribute('aria-describedby')).toBe('a11y-textarea-desc');

    // Tab to focus
    await userEvent.tab();
    expect(textarea).toHaveFocus();

    // Type text
    await userEvent.type(textarea, 'Hello, accessibility!');
    expect(textarea.value).toBe('Hello, accessibility!');

    // Clear and type again
    await userEvent.clear(textarea);
    expect(textarea.value).toBe('');

    // Verify placeholder is visible when empty
    expect(textarea.getAttribute('placeholder')).toBe('Type your message here...');
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: textareaHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('data-slot')).toBe('textarea');
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: textareaStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('data-slot')).toBe('textarea');
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: textareaStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('data-slot')).toBe('textarea');
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: textareaStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('data-slot')).toBe('textarea');
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: textareaStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('data-slot')).toBe('textarea');
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: textareaStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('data-slot')).toBe('textarea');
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: textareaStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('data-slot')).toBe('textarea');
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: textareaStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('data-slot')).toBe('textarea');
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  name: i18n.t('textarea.storyName.withFakerData', 'With Faker Data'),
  render: () => {
    const fakeTextareas = createFakeTextareas(3);

    return (
      <div className="flex flex-col gap-4" data-testid="textarea-faker">
        {fakeTextareas.map((t) => (
          <div key={t.id} className="space-y-2">
            <Label htmlFor={t.id}>{t.name}</Label>
            <Textarea
              id={t.id}
              placeholder={t.placeholder}
              rows={t.rows}
              disabled={t.disabled}
              readOnly={t.readOnly}
              required={t.required}
              defaultValue={t.value}
            />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="textarea-faker"]')).toBeInTheDocument();
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(3);
  },
};

// ============ FACTORY: createFakeTextarea ============

function FakeTextareaBasicDemo() {
  const fake = createFakeTextarea({ disabled: false, readOnly: false });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-textarea-basic">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.basic')}</p>
      <Label htmlFor={fake.id}>{fake.name}</Label>
      <Textarea
        id={fake.id}
        name={fake.name}
        placeholder={fake.placeholder}
        rows={fake.rows}
        required={fake.required}
      />
    </div>
  );
}

export const FactoryBasicTextarea: Story = {
  name: i18n.t('textarea.storyName.factoryBasicTextarea', 'Factory: Basic Textarea'),
  render: () => <FakeTextareaBasicDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-textarea-basic"]')).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('data-slot')).toBe('textarea');
    await userEvent.click(textarea);
    await userEvent.type(textarea, 'Factory basic test');
    expect(textarea).toHaveValue('Factory basic test');
  },
};

// ============ FACTORY: createFakeTextareaWithLabel ============

function FakeTextareaWithLabelDemo() {
  const fake = createFakeTextareaWithLabel({ disabled: false, readOnly: false });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-textarea-with-label">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.withLabel')}</p>
      <Label htmlFor={fake.id}>{fake.label}</Label>
      <Textarea
        id={fake.id}
        name={fake.name}
        placeholder={fake.placeholder}
        rows={fake.rows}
        required={fake.required}
      />
      {fake.description ? (
        <p className="text-muted-foreground text-sm">{fake.description}</p>
      ) : null}
    </div>
  );
}

export const FactoryWithLabel: Story = {
  name: i18n.t('textarea.storyName.factoryWithLabel', 'Factory: With Label'),
  render: () => <FakeTextareaWithLabelDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="fake-textarea-with-label"]')
    ).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    const label = canvasElement.querySelector('label');
    expect(label).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeTextareaFormField ============

function FakeTextareaFormFieldDemo() {
  const fake = createFakeTextareaFormField({
    disabled: false,
    readOnly: false,
    validationState: 'error',
    errorMessage: 'This field is required',
  });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-textarea-form-field">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.formField')}</p>
      <Label htmlFor={fake.id}>{fake.label}</Label>
      <Textarea
        id={fake.id}
        name={fake.name}
        placeholder={fake.placeholder}
        rows={fake.rows}
        required={fake.required}
        aria-invalid={fake.validationState === 'error'}
      />
      {fake.errorMessage ? <p className="text-sm text-red-500">{fake.errorMessage}</p> : null}
      {fake.helpText ? <p className="text-muted-foreground text-sm">{fake.helpText}</p> : null}
    </div>
  );
}

export const FactoryFormField: Story = {
  name: i18n.t('textarea.storyName.factoryFormField', 'Factory: Form Field'),
  render: () => <FakeTextareaFormFieldDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="fake-textarea-form-field"]')
    ).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(canvas.getByText('This field is required')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeTextareaByContentType ============

function FakeTextareaByContentTypeDemo() {
  const fake: FakeTextareaWithContentType = createFakeTextareaByContentType('feedback', {
    disabled: false,
    readOnly: false,
    validationState: 'none',
  });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-textarea-content-type">
      <p className="text-sm font-medium">
        {i18n.t('textarea.factory.contentType')}: {fake.contentType}
      </p>
      <Label htmlFor={fake.id}>{fake.label}</Label>
      <Textarea
        id={fake.id}
        name={fake.name}
        placeholder={fake.placeholder}
        rows={fake.rows}
        defaultValue={fake.sampleContent}
      />
    </div>
  );
}

export const FactoryByContentType: Story = {
  name: i18n.t('textarea.storyName.factoryByContentType', 'Factory: By Content Type'),
  render: () => <FakeTextareaByContentTypeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="fake-textarea-content-type"]')
    ).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect((textarea as HTMLTextAreaElement).value.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: createFakeMessageTextarea ============

function FakeMessageTextareaDemo() {
  const fake = createFakeMessageTextarea({
    disabled: false,
    readOnly: false,
    validationState: 'none',
  });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-message-textarea">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.message')}</p>
      <Label htmlFor={fake.id}>{fake.label}</Label>
      <Textarea
        id={fake.id}
        placeholder={fake.placeholder}
        rows={fake.rows}
        defaultValue={fake.sampleContent}
      />
    </div>
  );
}

export const FactoryMessageTextarea: Story = {
  name: i18n.t('textarea.storyName.factoryMessageTextarea', 'Factory: Message Textarea'),
  render: () => <FakeMessageTextareaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="fake-message-textarea"]')
    ).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(canvas.getByText('Message')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeCommentTextarea ============

function FakeCommentTextareaDemo() {
  const fake = createFakeCommentTextarea({
    disabled: false,
    readOnly: false,
    validationState: 'none',
  });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-comment-textarea">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.comment')}</p>
      <Label htmlFor={fake.id}>{fake.label}</Label>
      <Textarea
        id={fake.id}
        placeholder={fake.placeholder}
        rows={fake.rows}
        defaultValue={fake.sampleContent}
      />
    </div>
  );
}

export const FactoryCommentTextarea: Story = {
  name: i18n.t('textarea.storyName.factoryCommentTextarea', 'Factory: Comment Textarea'),
  render: () => <FakeCommentTextareaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="fake-comment-textarea"]')
    ).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(canvas.getByText('Comment')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeDescriptionTextarea ============

function FakeDescriptionTextareaDemo() {
  const fake = createFakeDescriptionTextarea({
    disabled: false,
    readOnly: false,
    validationState: 'none',
  });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-description-textarea">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.description')}</p>
      <Label htmlFor={fake.id}>{fake.label}</Label>
      <Textarea
        id={fake.id}
        placeholder={fake.placeholder}
        rows={fake.rows}
        defaultValue={fake.sampleContent}
      />
    </div>
  );
}

export const FactoryDescriptionTextarea: Story = {
  name: i18n.t('textarea.storyName.factoryDescriptionTextarea', 'Factory: Description Textarea'),
  render: () => <FakeDescriptionTextareaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="fake-description-textarea"]')
    ).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(canvas.getByText('Description')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeBioTextarea ============

function FakeBioTextareaDemo() {
  const fake = createFakeBioTextarea({
    disabled: false,
    readOnly: false,
    validationState: 'none',
  });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-bio-textarea">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.bio')}</p>
      <Label htmlFor={fake.id}>{fake.label}</Label>
      <Textarea
        id={fake.id}
        placeholder={fake.placeholder}
        rows={fake.rows}
        defaultValue={fake.sampleContent}
      />
    </div>
  );
}

export const FactoryBioTextarea: Story = {
  name: i18n.t('textarea.storyName.factoryBioTextarea', 'Factory: Bio Textarea'),
  render: () => <FakeBioTextareaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-bio-textarea"]')).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(canvas.getByText('Bio')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeCodeTextarea ============

function FakeCodeTextareaDemo() {
  const fake = createFakeCodeTextarea({
    disabled: false,
    readOnly: false,
    validationState: 'none',
  });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-code-textarea">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.code')}</p>
      <Label htmlFor={fake.id}>{fake.label}</Label>
      <Textarea
        id={fake.id}
        placeholder={fake.placeholder}
        rows={fake.rows}
        className={fake.className}
        spellCheck={fake.spellCheck}
        defaultValue={fake.sampleContent}
      />
    </div>
  );
}

export const FactoryCodeTextarea: Story = {
  name: i18n.t('textarea.storyName.factoryCodeTextarea', 'Factory: Code Textarea'),
  render: () => <FakeCodeTextareaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-code-textarea"]')).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toContain('function');
    expect(canvas.getByText('Code')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeReviewTextarea ============

function FakeReviewTextareaDemo() {
  const fake = createFakeReviewTextarea({
    disabled: false,
    readOnly: false,
    validationState: 'none',
  });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-review-textarea">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.review')}</p>
      <Label htmlFor={fake.id}>{fake.label}</Label>
      <Textarea
        id={fake.id}
        placeholder={fake.placeholder}
        rows={fake.rows}
        minLength={fake.minLength}
        defaultValue={fake.sampleContent}
      />
    </div>
  );
}

export const FactoryReviewTextarea: Story = {
  name: i18n.t('textarea.storyName.factoryReviewTextarea', 'Factory: Review Textarea'),
  render: () => <FakeReviewTextareaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-review-textarea"]')).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.rows).toBe(5);
    expect(canvas.getByText('Review')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeTextareaWithCharCount ============

function FakeTextareaCharCountDemo() {
  const fake = createFakeTextareaWithCharCount({
    disabled: false,
    readOnly: false,
    maxLength: 200,
  });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-textarea-char-count">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.charCount')}</p>
      <Label htmlFor={fake.id}>{fake.name}</Label>
      <Textarea
        id={fake.id}
        placeholder={fake.placeholder}
        rows={fake.rows}
        maxLength={fake.maxLength}
        defaultValue={fake.value}
      />
      <p className="text-muted-foreground text-sm" data-testid="char-count-display">
        {fake.currentLength} {i18n.t('textarea.factory.of')} {fake.maxLength}{' '}
        {i18n.t('textarea.factory.characters')}
      </p>
    </div>
  );
}

export const FactoryCharCount: Story = {
  name: i18n.t('textarea.storyName.factoryCharCount', 'Factory: Character Count'),
  render: () => <FakeTextareaCharCountDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="fake-textarea-char-count"]')
    ).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.maxLength).toBe(200);
    expect(canvasElement.querySelector('[data-testid="char-count-display"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeAutoResizeTextarea ============

function FakeAutoResizeTextareaDemo() {
  const fake = createFakeAutoResizeTextarea({
    disabled: false,
    readOnly: false,
    minRows: 2,
    maxRows: 8,
  });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-auto-resize-textarea">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.autoResize')}</p>
      <Label htmlFor={fake.id}>{fake.name}</Label>
      <Textarea
        id={fake.id}
        placeholder={fake.placeholder}
        rows={fake.minRows}
        data-min-rows={fake.minRows}
        data-max-rows={fake.maxRows}
      />
      <p className="text-muted-foreground text-sm">
        {i18n.t('textarea.factory.rows')}: {fake.minRows} - {fake.maxRows}
      </p>
    </div>
  );
}

export const FactoryAutoResize: Story = {
  name: i18n.t('textarea.storyName.factoryAutoResize', 'Factory: Auto Resize'),
  render: () => <FakeAutoResizeTextareaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="fake-auto-resize-textarea"]')
    ).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.rows).toBe(2);
    expect(textarea.getAttribute('data-min-rows')).toBe('2');
    expect(textarea.getAttribute('data-max-rows')).toBe('8');
  },
};

// ============ FACTORY: createFakeDisabledTextarea ============

function FakeDisabledTextareaDemo() {
  const fake = createFakeDisabledTextarea();

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-disabled-textarea">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.disabled')}</p>
      <Label htmlFor={fake.id}>{fake.name}</Label>
      <Textarea
        id={fake.id}
        placeholder={fake.placeholder}
        rows={fake.rows}
        disabled={fake.disabled}
        defaultValue={fake.value}
      />
    </div>
  );
}

export const FactoryDisabled: Story = {
  name: i18n.t('textarea.storyName.factoryDisabled', 'Factory: Disabled'),
  render: () => <FakeDisabledTextareaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="fake-disabled-textarea"]')
    ).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.disabled).toBe(true);
  },
};

// ============ FACTORY: createFakeReadOnlyTextarea ============

function FakeReadOnlyTextareaDemo() {
  const fake = createFakeReadOnlyTextarea();

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-readonly-textarea">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.readOnly')}</p>
      <Label htmlFor={fake.id}>{fake.name}</Label>
      <Textarea
        id={fake.id}
        placeholder={fake.placeholder}
        rows={fake.rows}
        readOnly={fake.readOnly}
        defaultValue={fake.value}
      />
    </div>
  );
}

export const FactoryReadOnly: Story = {
  name: i18n.t('textarea.storyName.factoryReadOnly', 'Factory: Read Only'),
  render: () => <FakeReadOnlyTextareaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="fake-readonly-textarea"]')
    ).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.readOnly).toBe(true);
  },
};

// ============ FACTORY: createFakeErrorTextarea ============

function FakeErrorTextareaDemo() {
  const fake = createFakeErrorTextarea({ disabled: false, readOnly: false });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-error-textarea">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.error')}</p>
      <Label htmlFor={fake.id}>{fake.label}</Label>
      <Textarea
        id={fake.id}
        placeholder={fake.placeholder}
        rows={fake.rows}
        aria-invalid={fake.ariaInvalid}
      />
      {fake.errorMessage ? (
        <p className="text-sm text-red-500" data-testid="error-message">
          {fake.errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export const FactoryError: Story = {
  name: i18n.t('textarea.storyName.factoryError', 'Factory: Error State'),
  render: () => <FakeErrorTextareaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-error-textarea"]')).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(canvasElement.querySelector('[data-testid="error-message"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeRequiredTextarea ============

function FakeRequiredTextareaDemo() {
  const fake = createFakeRequiredTextarea({ disabled: false, readOnly: false });

  return (
    <div className="w-[420px] space-y-2" data-testid="fake-required-textarea">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.required')}</p>
      <Label htmlFor={fake.id}>
        {fake.name} <span className="text-red-500">*</span>
      </Label>
      <Textarea
        id={fake.id}
        placeholder={fake.placeholder}
        rows={fake.rows}
        required={fake.required}
      />
    </div>
  );
}

export const FactoryRequired: Story = {
  name: i18n.t('textarea.storyName.factoryRequired', 'Factory: Required'),
  render: () => <FakeRequiredTextareaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="fake-required-textarea"]')
    ).toBeInTheDocument();
    const textarea = canvas.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.required).toBe(true);
  },
};

// ============ FACTORY: createTextareaSizeMatrix ============

function TextareaSizeMatrixDemo() {
  const matrix = createTextareaSizeMatrix();

  return (
    <div className="w-[420px] space-y-6" data-testid="textarea-size-matrix">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.sizeMatrix')}</p>
      {matrix.map((item) => (
        <div key={item.size} className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {item.size} ({i18n.t('textarea.factory.rows')}: {item.rows})
          </p>
          <Textarea placeholder={`${item.size} size...`} rows={item.rows} data-size={item.size} />
        </div>
      ))}
    </div>
  );
}

export const FactorySizeMatrix: Story = {
  name: i18n.t('textarea.storyName.factorySizeMatrix', 'Factory: Size Matrix'),
  render: () => <TextareaSizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="textarea-size-matrix"]')).toBeInTheDocument();
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(TEXTAREA_SIZES.length);
    const sizes: TextareaSize[] = [...textareas].map(
      (el) => el.getAttribute('data-size') as TextareaSize
    );
    for (const s of TEXTAREA_SIZES) {
      expect(sizes).toContain(s);
    }
  },
};

// ============ FACTORY: createTextareaValidationMatrix ============

function TextareaValidationMatrixDemo() {
  const matrix = createTextareaValidationMatrix();

  return (
    <div className="w-[420px] space-y-6" data-testid="textarea-validation-matrix">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.validationMatrix')}</p>
      {matrix.map((item) => (
        <div key={item.state} className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {i18n.t('textarea.factory.validation')}: {item.state}
          </p>
          <Label htmlFor={item.textarea.id}>{item.textarea.label}</Label>
          <Textarea
            id={item.textarea.id}
            placeholder={item.textarea.placeholder}
            rows={item.textarea.rows}
            aria-invalid={item.state === 'error'}
            data-validation={item.state}
          />
          {item.textarea.errorMessage ? (
            <p className="text-sm text-red-500">{item.textarea.errorMessage}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export const FactoryValidationMatrix: Story = {
  name: i18n.t('textarea.storyName.factoryValidationMatrix', 'Factory: Validation Matrix'),
  render: () => <TextareaValidationMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="textarea-validation-matrix"]')
    ).toBeInTheDocument();
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(TEXTAREA_VALIDATION_STATES.length);
    const states: TextareaValidationState[] = [...textareas].map(
      (el) => el.getAttribute('data-validation') as TextareaValidationState
    );
    for (const st of TEXTAREA_VALIDATION_STATES) {
      expect(states).toContain(st);
    }
  },
};

// ============ FACTORY: createTextareaContentTypeMatrix ============

function TextareaContentTypeMatrixDemo() {
  const { t } = useTranslation();
  const matrix = createTextareaContentTypeMatrix();

  return (
    <div className="w-[420px] space-y-6" data-testid="textarea-content-type-matrix">
      <p className="text-sm font-medium">{t('textarea.factory.contentTypeMatrix')}</p>
      {matrix.map((item) => (
        <div key={item.contentType} className="space-y-2">
          <Label htmlFor={item.textarea.id}>{item.textarea.label}</Label>
          <Textarea
            id={item.textarea.id}
            placeholder={item.textarea.placeholder}
            rows={item.textarea.rows}
            defaultValue={item.textarea.sampleContent}
            data-content-type={item.contentType}
          />
        </div>
      ))}
    </div>
  );
}

export const FactoryContentTypeMatrix: Story = {
  name: i18n.t('textarea.storyName.factoryContentTypeMatrix', 'Factory: Content Type Matrix'),
  render: () => <TextareaContentTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="textarea-content-type-matrix"]')
    ).toBeInTheDocument();
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(TEXTAREA_CONTENT_TYPES.length);
    const types: TextareaContentType[] = [...textareas].map(
      (el) => el.getAttribute('data-content-type') as TextareaContentType
    );
    for (const ct of TEXTAREA_CONTENT_TYPES) {
      expect(types).toContain(ct);
    }
  },
};

// ============ FACTORY: createTextareaResizeMatrix ============

function TextareaResizeMatrixDemo() {
  const matrix = createTextareaResizeMatrix();

  return (
    <div className="w-[420px] space-y-6" data-testid="textarea-resize-matrix">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.resizeMatrix')}</p>
      {matrix.map((item) => (
        <div key={item.resize} className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {i18n.t('textarea.factory.resize')}: {item.resize}
          </p>
          <Textarea
            placeholder={`Resize: ${item.resize}`}
            rows={item.textarea.rows}
            style={{ resize: item.resize }}
            data-resize={item.resize}
          />
        </div>
      ))}
    </div>
  );
}

export const FactoryResizeMatrix: Story = {
  name: i18n.t('textarea.storyName.factoryResizeMatrix', 'Factory: Resize Matrix'),
  render: () => <TextareaResizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="textarea-resize-matrix"]')
    ).toBeInTheDocument();
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(TEXTAREA_RESIZE_OPTIONS.length);
    const resizeValues: TextareaResize[] = [...textareas].map(
      (el) => el.getAttribute('data-resize') as TextareaResize
    );
    for (const r of TEXTAREA_RESIZE_OPTIONS) {
      expect(resizeValues).toContain(r);
    }
  },
};

// ============ FACTORY: createTextareaTestData ============

function TextareaTestDataDemo() {
  const data = createTextareaTestData();

  return (
    <div className="w-[420px] space-y-6" data-testid="textarea-test-data">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.testData')}</p>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">{i18n.t('textarea.factory.basic')}</p>
        <Textarea placeholder={data.basic.placeholder} rows={data.basic.rows} />
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">{i18n.t('textarea.factory.disabled')}</p>
        <Textarea
          placeholder={data.disabled.placeholder}
          rows={data.disabled.rows}
          disabled={data.disabled.disabled}
          defaultValue={data.disabled.value}
        />
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">{i18n.t('textarea.factory.readOnly')}</p>
        <Textarea
          placeholder={data.readOnly.placeholder}
          rows={data.readOnly.rows}
          readOnly={data.readOnly.readOnly}
          defaultValue={data.readOnly.value}
        />
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">{i18n.t('textarea.factory.error')}</p>
        <Textarea placeholder={data.error.placeholder} rows={data.error.rows} aria-invalid />
        {data.error.errorMessage ? (
          <p className="text-sm text-red-500">{data.error.errorMessage}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">{i18n.t('textarea.factory.code')}</p>
        <Textarea
          placeholder={data.code.placeholder}
          rows={data.code.rows}
          defaultValue={data.code.sampleContent}
          className="font-mono"
        />
      </div>
    </div>
  );
}

export const FactoryTestData: Story = {
  name: i18n.t('textarea.storyName.factoryTestData', 'Factory: Test Data'),
  render: () => <TextareaTestDataDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="textarea-test-data"]')).toBeInTheDocument();
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(5);
    // Verify disabled textarea
    const disabledTextarea = canvasElement.querySelector('textarea[disabled]');
    expect(disabledTextarea).toBeInTheDocument();
    // Verify read-only textarea
    const readonlyTextarea = canvasElement.querySelector('textarea[readonly]');
    expect(readonlyTextarea).toBeInTheDocument();
    // Verify invalid textarea
    const invalidTextarea = canvasElement.querySelector('textarea[aria-invalid]');
    expect(invalidTextarea).toBeInTheDocument();
  },
};

// ============ FACTORY: createTextareaShowcase ============

function TextareaShowcaseDemo() {
  const showcase = createTextareaShowcase();

  return (
    <div className="w-[520px] space-y-8" data-testid="textarea-showcase">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.showcase')}</p>

      <section>
        <h3 className="mb-3 text-sm font-semibold">{i18n.t('textarea.factory.sizeMatrix')}</h3>
        <div className="space-y-3">
          {showcase.sizeMatrix.map((item) => (
            <Textarea
              key={item.size}
              placeholder={`${item.size} size`}
              rows={item.rows}
              data-showcase-section="size"
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">
          {i18n.t('textarea.factory.validationMatrix')}
        </h3>
        <div className="space-y-3">
          {showcase.validationMatrix.map((item) => (
            <div key={item.state} className="space-y-1">
              <Textarea
                placeholder={`${item.state} state`}
                rows={item.textarea.rows}
                aria-invalid={item.state === 'error'}
                data-showcase-section="validation"
              />
              {item.textarea.errorMessage ? (
                <p className="text-sm text-red-500">{item.textarea.errorMessage}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">{i18n.t('textarea.factory.resizeMatrix')}</h3>
        <div className="space-y-3">
          {showcase.resizeMatrix.map((item) => (
            <Textarea
              key={item.resize}
              placeholder={`Resize: ${item.resize}`}
              rows={item.textarea.rows}
              style={{ resize: item.resize }}
              data-showcase-section="resize"
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export const FactoryShowcase: Story = {
  name: i18n.t('textarea.storyName.factoryShowcase', 'Factory: Showcase'),
  render: () => <TextareaShowcaseDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="textarea-showcase"]')).toBeInTheDocument();
    const sizeTextareas = canvasElement.querySelectorAll('[data-showcase-section="size"]');
    expect(sizeTextareas.length).toBe(TEXTAREA_SIZES.length);
    const validationTextareas = canvasElement.querySelectorAll(
      '[data-showcase-section="validation"]'
    );
    expect(validationTextareas.length).toBe(TEXTAREA_VALIDATION_STATES.length);
    const resizeTextareas = canvasElement.querySelectorAll('[data-showcase-section="resize"]');
    expect(resizeTextareas.length).toBe(TEXTAREA_RESIZE_OPTIONS.length);
  },
};

// ============ CONSTANTS: TEXTAREA_SIZE_ROWS ============

function TextareaSizeRowsDemo() {
  return (
    <div className="w-[420px] space-y-6" data-testid="textarea-size-rows">
      <p className="text-sm font-medium">
        {i18n.t('textarea.factory.sizeMatrix')} - TEXTAREA_SIZE_ROWS
      </p>
      {(Object.entries(TEXTAREA_SIZE_ROWS) as [TextareaSize, number][]).map(([size, rows]) => (
        <div key={size} className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {size}: {rows} {i18n.t('textarea.factory.rows')}
          </p>
          <Textarea placeholder={`${size} (${rows} rows)`} rows={rows} data-size-row={size} />
        </div>
      ))}
    </div>
  );
}

export const ConstantSizeRows: Story = {
  name: i18n.t('textarea.storyName.constantSizeRows', 'Constant: Size Rows'),
  render: () => <TextareaSizeRowsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="textarea-size-rows"]')).toBeInTheDocument();
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(Object.keys(TEXTAREA_SIZE_ROWS).length);
  },
};

// ============ CONSTANTS: TEXTAREA_PLACEHOLDERS ============

function TextareaPlaceholdersDemo() {
  return (
    <div className="w-[420px] space-y-4" data-testid="textarea-placeholders">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.contentType')} - Placeholders</p>
      {(Object.entries(TEXTAREA_PLACEHOLDERS) as [TextareaContentType, string][]).map(
        ([contentType, placeholder]) => (
          <div key={contentType} className="space-y-1">
            <p className="text-muted-foreground text-xs">{contentType}</p>
            <Textarea placeholder={placeholder} rows={2} data-placeholder-type={contentType} />
          </div>
        )
      )}
    </div>
  );
}

export const ConstantPlaceholders: Story = {
  name: i18n.t('textarea.storyName.constantPlaceholders', 'Constant: Placeholders'),
  render: () => <TextareaPlaceholdersDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="textarea-placeholders"]')
    ).toBeInTheDocument();
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(Object.keys(TEXTAREA_PLACEHOLDERS).length);
    for (const textarea of textareas) {
      expect((textarea as HTMLTextAreaElement).placeholder.length).toBeGreaterThan(0);
    }
  },
};

// ============ CONSTANTS: TEXTAREA_LABELS ============

function TextareaLabelsDemo() {
  return (
    <div className="w-[420px] space-y-4" data-testid="textarea-labels">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.label')} - TEXTAREA_LABELS</p>
      {(Object.entries(TEXTAREA_LABELS) as [TextareaContentType, string][]).map(
        ([contentType, label]) => (
          <div key={contentType} className="space-y-1">
            <Label>{label}</Label>
            <Textarea placeholder={TEXTAREA_PLACEHOLDERS[contentType]} rows={2} />
          </div>
        )
      )}
    </div>
  );
}

export const ConstantLabels: Story = {
  name: i18n.t('textarea.storyName.constantLabels', 'Constant: Labels'),
  render: () => <TextareaLabelsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="textarea-labels"]')).toBeInTheDocument();
    const labels = canvasElement.querySelectorAll('label');
    expect(labels.length).toBe(Object.keys(TEXTAREA_LABELS).length);
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(Object.keys(TEXTAREA_LABELS).length);
  },
};

// ============ CONSTANTS: TEXTAREA_SAMPLE_CONTENT ============

function TextareaSampleContentDemo() {
  return (
    <div className="w-[420px] space-y-4" data-testid="textarea-sample-content">
      <p className="text-sm font-medium">
        {i18n.t('textarea.factory.contentType')} - Sample Content
      </p>
      {(Object.entries(TEXTAREA_SAMPLE_CONTENT) as [TextareaContentType, () => string][]).map(
        ([contentType, contentFn]) => (
          <div key={contentType} className="space-y-1">
            <p className="text-muted-foreground text-xs">{TEXTAREA_LABELS[contentType]}</p>
            <Textarea rows={3} defaultValue={contentFn()} readOnly data-sample-type={contentType} />
          </div>
        )
      )}
    </div>
  );
}

export const ConstantSampleContent: Story = {
  name: i18n.t('textarea.storyName.constantSampleContent', 'Constant: Sample Content'),
  render: () => <TextareaSampleContentDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="textarea-sample-content"]')
    ).toBeInTheDocument();
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(Object.keys(TEXTAREA_SAMPLE_CONTENT).length);
    for (const textarea of textareas) {
      expect((textarea as HTMLTextAreaElement).value.length).toBeGreaterThan(0);
    }
  },
};

// ============ CONSTANTS: TEXTAREA_ERROR_MESSAGES ============

function TextareaErrorMessagesDemo() {
  return (
    <div className="w-[420px] space-y-4" data-testid="textarea-error-messages">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.error')} - Error Messages</p>
      {TEXTAREA_ERROR_MESSAGES.map((message, index) => (
        <div key={message} className="space-y-1">
          <Textarea
            placeholder={i18n.t('textarea.story.typeSomething', 'Type something...')}
            rows={2}
            aria-invalid
            data-error-index={index}
          />
          <p className="text-sm text-red-500" data-testid={`error-msg-${index}`}>
            {message}
          </p>
        </div>
      ))}
    </div>
  );
}

export const ConstantErrorMessages: Story = {
  name: i18n.t('textarea.storyName.constantErrorMessages', 'Constant: Error Messages'),
  render: () => <TextareaErrorMessagesDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="textarea-error-messages"]')
    ).toBeInTheDocument();
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(TEXTAREA_ERROR_MESSAGES.length);
    for (let i = 0; i < TEXTAREA_ERROR_MESSAGES.length; i++) {
      const errorEl = canvasElement.querySelector(`[data-testid="error-msg-${i}"]`);
      expect(errorEl).toBeInTheDocument();
      expect(errorEl?.textContent).toBe(TEXTAREA_ERROR_MESSAGES[i]);
    }
  },
};

// ============ CONSTANTS: TEXTAREA_HELP_TEXT ============

function TextareaHelpTextDemo() {
  return (
    <div className="w-[420px] space-y-4" data-testid="textarea-help-text">
      <p className="text-sm font-medium">{i18n.t('textarea.factory.contentType')} - Help Text</p>
      {(Object.entries(TEXTAREA_HELP_TEXT) as [TextareaContentType, string][]).map(
        ([contentType, helpText]) => (
          <div key={contentType} className="space-y-1">
            <Label>{TEXTAREA_LABELS[contentType]}</Label>
            <Textarea
              placeholder={TEXTAREA_PLACEHOLDERS[contentType]}
              rows={2}
              data-help-type={contentType}
            />
            <p className="text-muted-foreground text-sm">{helpText}</p>
          </div>
        )
      )}
    </div>
  );
}

export const ConstantHelpText: Story = {
  name: i18n.t('textarea.storyName.constantHelpText', 'Constant: Help Text'),
  render: () => <TextareaHelpTextDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="textarea-help-text"]')).toBeInTheDocument();
    const textareas = canvasElement.querySelectorAll('[data-slot="textarea"]');
    expect(textareas.length).toBe(Object.keys(TEXTAREA_HELP_TEXT).length);
    for (const contentType of Object.keys(TEXTAREA_HELP_TEXT)) {
      const el = canvasElement.querySelector(`[data-help-type="${contentType}"]`);
      expect(el).toBeInTheDocument();
    }
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// ADDITIONAL HANDLER STATUS STORIES
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: textareaStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerValidationError: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerValidationError', 'Handler: Validation Error'),
  parameters: { msw: { handlers: textareaStatusHandlers.validationError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: textareaStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: textareaStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerPayloadTooLarge: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerPayloadTooLarge', 'Handler: Payload Too Large'),
  parameters: { msw: { handlers: textareaStatusHandlers.payloadTooLarge } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: textareaStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerAutosaveError: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerAutosaveError', 'Handler: Autosave Error'),
  parameters: { msw: { handlers: textareaStatusHandlers.autosaveError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: textareaStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: textareaStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: textareaStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowSave: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerSlowSave', 'Handler: Slow Save'),
  parameters: { msw: { handlers: textareaStatusHandlers.slowSave } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: textareaStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNoSuggestions: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerNoSuggestions', 'Handler: No Suggestions'),
  parameters: { msw: { handlers: textareaStatusHandlers.noSuggestions } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSuggestionError: Story = {
  ...Default,
  name: i18n.t('textarea.storyName.handlerSuggestionError', 'Handler: Suggestion Error'),
  parameters: { msw: { handlers: textareaStatusHandlers.suggestionError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
