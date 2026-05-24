import type { Meta, StoryObj } from '@storybook/react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, within } from 'storybook/test';

import {
  createFakeCountrySelect,
  createFakeCurrencySelect,
  createFakeGroupedSelect,
  createFakeLanguageSelect,
  createFakeMonthSelect,
  createFakeMultiSelect,
  createFakeNativeSelect,
  createFakeNativeSelectCategoryMatrix,
  createFakeNativeSelectFormField,
  createFakeNativeSelectFormFields,
  createFakeNativeSelectOptGroup,
  createFakeNativeSelectOptGroups,
  createFakeNativeSelectOption,
  createFakeNativeSelectOptionFromCategory,
  createFakeNativeSelectOptions,
  createFakeNativeSelectOptionsFromCategory,
  createFakeNativeSelects,
  createFakeNativeSelectShowcase,
  createFakeNativeSelectSizeMatrix,
  createFakeNativeSelectStateMatrix,
  createFakePrioritySelect,
  createFakeStatusSelect,
  createFakeTimezoneSelect,
  NATIVE_SELECT_COLORS,
  NATIVE_SELECT_COUNTRIES,
  NATIVE_SELECT_CURRENCIES,
  NATIVE_SELECT_FRUITS,
  NATIVE_SELECT_LANGUAGES,
  NATIVE_SELECT_MONTHS,
  NATIVE_SELECT_OPTION_CATEGORIES,
  NATIVE_SELECT_OPTIONS_BY_CATEGORY,
  NATIVE_SELECT_PRIORITIES,
  NATIVE_SELECT_SIZE_CLASSES,
  NATIVE_SELECT_SIZES,
  NATIVE_SELECT_SIZES_OPTIONS,
  NATIVE_SELECT_STATES,
  NATIVE_SELECT_STATUSES,
  NATIVE_SELECT_TIMEZONES,
} from '@/.storybook/stories/_factories/native-select.factory';
import type {
  FakeNativeSelect,
  FakeNativeSelectFormField,
  FakeNativeSelectOptGroup,
  FakeNativeSelectOption,
  NativeSelectOptionCategory,
  NativeSelectSize,
  NativeSelectState,
} from '@/.storybook/stories/_factories/native-select.factory';
import {
  nativeSelectHandlers,
  nativeSelectStatusHandlers,
} from '@/.storybook/stories/_handlers/native-select.handlers';

import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function I18nNativeSelectDemo({ invalid = false }: { invalid?: boolean }) {
  const { t } = useTranslation();

  return (
    <NativeSelect
      aria-invalid={invalid ? true : undefined}
      aria-label={i18n.t('nativeSelect.story.selectAFruit', 'Select a fruit')}
      defaultValue="apple"
      className="w-[260px]"
    >
      <NativeSelectOption value="apple">
        {t('nativeSelect.story.apple', 'Apple')}
      </NativeSelectOption>
      <NativeSelectOption value="banana">
        {t('nativeSelect.story.banana', 'Banana')}
      </NativeSelectOption>
      <NativeSelectOption value="orange">
        {t('nativeSelect.story.orange', 'Orange')}
      </NativeSelectOption>
    </NativeSelect>
  );
}

const meta = {
  title: 'Components/UI/Native Select',
  component: NativeSelect,
  tags: ['autodocs'],
  args: {
    disabled: false,
    onChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
  },
  parameters: {
    msw: { handlers: nativeSelectHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    defaultValue: {
      control: 'text',
      description: i18n.t(
        'nativeSelect.argType.defaultSelectedValueForUncontrolledUsage',
        'Default selected value for uncontrolled usage'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    value: {
      control: 'text',
      description: i18n.t(
        'nativeSelect.argType.controlledSelectedValue',
        'Controlled selected value'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    children: {
      control: false,
      description: i18n.t(
        'nativeSelect.argType.nativeselectoptionOrNativeselectoptgroupElements',
        'NativeSelectOption or NativeSelectOptGroup elements'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    // State
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'nativeSelect.argType.whetherTheSelectIsDisabled',
        'Whether the select is disabled'
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
        'nativeSelect.argType.whetherASelectionIsRequired',
        'Whether a selection is required'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    multiple: {
      control: 'boolean',
      description: i18n.t(
        'nativeSelect.argType.whetherMultipleOptionsCanBeSelected',
        'Whether multiple options can be selected'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t(
        'nativeSelect.argType.additionalCssClassesForCustomStyling',
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
        'nativeSelect.argType.uniqueIdentifierForTheSelect',
        'Unique identifier for the select'
      ),
      table: {
        category: 'HTML',
        type: { summary: 'string' },
      },
    },
    name: {
      control: 'text',
      description: i18n.t(
        'nativeSelect.argType.nameAttributeForFormSubmission',
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
      description: i18n.t('nativeSelect.argType.autocompleteBehavior', 'Autocomplete behavior'),
      table: {
        category: 'HTML',
        type: { summary: "'off' | 'on'" },
      },
    },
    // Accessibility
    'aria-label': {
      control: 'text',
      description: i18n.t(
        'nativeSelect.argType.accessibleLabelForScreenReaders',
        'Accessible label for screen readers'
      ),
      table: {
        category: 'Accessibility',
        type: { summary: 'string' },
      },
    },
    'aria-labelledby': {
      control: 'text',
      description: i18n.t(
        'nativeSelect.argType.idOfElementLabelingTheSelect',
        'ID of element labeling the select'
      ),
      table: {
        category: 'Accessibility',
        type: { summary: 'string' },
      },
    },
    'aria-invalid': {
      control: 'boolean',
      description: i18n.t(
        'nativeSelect.argType.whetherTheSelectHasInvalidInput',
        'Whether the select has invalid input'
      ),
      table: {
        category: 'Accessibility',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    size: {
      control: 'number',
      description: i18n.t(
        'nativeSelect.argType.numberOfVisibleOptionsInTheDropdown',
        'Number of visible options in the dropdown'
      ),
      table: {
        category: 'Layout',
        type: { summary: 'number' },
      },
    },
    // Events
    onChange: {
      action: 'onChange',
      description: i18n.t(
        'nativeSelect.argType.calledWhenSelectionChanges',
        'Called when selection changes'
      ),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t(
        'nativeSelect.argType.calledWhenSelectReceivesFocus',
        'Called when select receives focus'
      ),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t(
        'nativeSelect.argType.calledWhenSelectLosesFocus',
        'Called when select loses focus'
      ),
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof NativeSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <I18nNativeSelectDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    const select = canvasElement.querySelector('[data-slot="native-select"]');
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Select element was not found.');
    }

    expect(select.getAttribute('data-slot')).toBe('native-select');
    expect(select.getAttribute('aria-label')?.trim()).not.toBe('');
    expect(select.value).toBe('apple');
    expect(select.getAttribute('aria-invalid')).toBeNull();
    expect(canvasElement.querySelector('[data-slot="native-select-icon"]')).toBeInTheDocument();

    const optionValues = [...select.options].map((option) => option.value);
    expect(optionValues).toEqual(['apple', 'banana', 'orange']);

    await userEvent.click(select);
    expect(doc.activeElement).toBe(select);

    await userEvent.selectOptions(select, 'banana');
    expect(select.value).toBe('banana');
  },
};

export const Invalid: Story = {
  render: () => <I18nNativeSelectDemo invalid />,
  play: async ({ canvasElement }) => {
    // Verify select element rendered
    const select = canvasElement.querySelector('[data-slot="native-select"]');
    expect(select).toBeInTheDocument();

    // Verify aria-invalid attribute is set
    expect(select).toHaveAttribute('aria-invalid', 'true');

    // Verify native select icon exists
    expect(canvasElement.querySelector('[data-slot="native-select-icon"]')).toBeInTheDocument();

    // Verify select has options
    const { options } = select as HTMLSelectElement;
    expect(options.length).toBe(3);
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const select = canvasElement.querySelector('[data-slot="native-select"]');
    expect(select).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="native-select-icon"]')).toBeInTheDocument();
  },
};

export const Variants: Story = {
  tags: ['!test'],
  render: () => (
    <div className="flex flex-col gap-6">
      {/* Default */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('nativeSelect.story.default', 'Default')}</p>
        <NativeSelect
          aria-label={i18n.t('nativeSelect.story.selectAFruit', 'Select a fruit')}
          defaultValue="apple"
          className="w-[260px]"
        >
          <NativeSelectOption value="apple">
            {i18n.t('nativeSelect.story.apple', 'Apple')}
          </NativeSelectOption>
          <NativeSelectOption value="banana">
            {i18n.t('nativeSelect.story.banana', 'Banana')}
          </NativeSelectOption>
          <NativeSelectOption value="orange">
            {i18n.t('nativeSelect.story.orange', 'Orange')}
          </NativeSelectOption>
        </NativeSelect>
      </div>

      {/* Disabled */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('nativeSelect.story.disabled', 'Disabled')}</p>
        <NativeSelect
          aria-label={i18n.t('nativeSelect.story.disabledSelect', 'Disabled select')}
          defaultValue="apple"
          disabled
          className="w-[260px]"
        >
          <NativeSelectOption value="apple">
            {i18n.t('nativeSelect.story.apple', 'Apple')}
          </NativeSelectOption>
          <NativeSelectOption value="banana">
            {i18n.t('nativeSelect.story.banana', 'Banana')}
          </NativeSelectOption>
          <NativeSelectOption value="orange">
            {i18n.t('nativeSelect.story.orange', 'Orange')}
          </NativeSelectOption>
        </NativeSelect>
      </div>

      {/* With Placeholder */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t('nativeSelect.story.withPlaceholder', 'With Placeholder')}
        </p>
        <NativeSelect
          aria-label={i18n.t('nativeSelect.story.selectWithPlaceholder', 'Select with placeholder')}
          defaultValue=""
          className="w-[260px]"
        >
          <NativeSelectOption value="" disabled>
            Select a fruit...
          </NativeSelectOption>
          <NativeSelectOption value="apple">
            {i18n.t('nativeSelect.story.apple', 'Apple')}
          </NativeSelectOption>
          <NativeSelectOption value="banana">
            {i18n.t('nativeSelect.story.banana', 'Banana')}
          </NativeSelectOption>
          <NativeSelectOption value="orange">
            {i18n.t('nativeSelect.story.orange', 'Orange')}
          </NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify all select elements rendered
    const selects = canvasElement.querySelectorAll('[data-slot="native-select"]');
    expect(selects.length).toBe(3);

    // Verify text content exists
    expect(canvas.getByText('Default')).toBeInTheDocument();
    expect(canvas.getByText('Disabled')).toBeInTheDocument();
    expect(canvas.getByText('With Placeholder')).toBeInTheDocument();

    // Verify disabled select has disabled attribute
    const disabledSelect = selects[1] as HTMLSelectElement;
    expect(disabledSelect).toBeDisabled();

    // Verify native select icons exist
    const icons = canvasElement.querySelectorAll('[data-slot="native-select-icon"]');
    expect(icons.length).toBe(3);
  },
};

export const NativeSelectSizes: Story = {
  name: i18n.t('nativeSelect.storyName.nativeSelectSizes', 'Sizes'),
  tags: ['!test'],
  render: () => (
    <div className="flex flex-col gap-6">
      {/* Small Width */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t('nativeSelect.story.smallWidth', 'Small Width')}
        </p>
        <NativeSelect
          aria-label={i18n.t('nativeSelect.story.smallSelect', 'Small select')}
          defaultValue="apple"
          className="w-[160px]"
        >
          <NativeSelectOption value="apple">
            {i18n.t('nativeSelect.story.apple', 'Apple')}
          </NativeSelectOption>
          <NativeSelectOption value="banana">
            {i18n.t('nativeSelect.story.banana', 'Banana')}
          </NativeSelectOption>
          <NativeSelectOption value="orange">
            {i18n.t('nativeSelect.story.orange', 'Orange')}
          </NativeSelectOption>
        </NativeSelect>
      </div>

      {/* Default Width */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t('nativeSelect.story.defaultWidth', 'Default Width')}
        </p>
        <NativeSelect
          aria-label={i18n.t('nativeSelect.story.defaultSelect', 'Default select')}
          defaultValue="apple"
          className="w-[260px]"
        >
          <NativeSelectOption value="apple">
            {i18n.t('nativeSelect.story.apple', 'Apple')}
          </NativeSelectOption>
          <NativeSelectOption value="banana">
            {i18n.t('nativeSelect.story.banana', 'Banana')}
          </NativeSelectOption>
          <NativeSelectOption value="orange">
            {i18n.t('nativeSelect.story.orange', 'Orange')}
          </NativeSelectOption>
        </NativeSelect>
      </div>

      {/* Full Width */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t('nativeSelect.story.fullWidth', 'Full Width')}
        </p>
        <NativeSelect
          aria-label={i18n.t('nativeSelect.story.fullWidthSelect', 'Full width select')}
          defaultValue="apple"
          className="w-full"
        >
          <NativeSelectOption value="apple">
            {i18n.t('nativeSelect.story.apple', 'Apple')}
          </NativeSelectOption>
          <NativeSelectOption value="banana">
            {i18n.t('nativeSelect.story.banana', 'Banana')}
          </NativeSelectOption>
          <NativeSelectOption value="orange">
            {i18n.t('nativeSelect.story.orange', 'Orange')}
          </NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify all select elements rendered
    const selects = canvasElement.querySelectorAll('[data-slot="native-select"]');
    expect(selects.length).toBe(3);

    // Verify text content exists
    expect(canvas.getByText('Small Width')).toBeInTheDocument();
    expect(canvas.getByText('Default Width')).toBeInTheDocument();
    expect(canvas.getByText('Full Width')).toBeInTheDocument();

    // Verify all selects have Apple as default value
    selects.forEach((select) => {
      expect((select as HTMLSelectElement).value).toBe('apple');
    });

    // Verify native select icons exist
    const icons = canvasElement.querySelectorAll('[data-slot="native-select-icon"]');
    expect(icons.length).toBe(3);
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
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

    const select = canvasElement.querySelector('[data-slot="native-select"]');
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Select element was not found.');
    }

    expect(select.getAttribute('aria-label')?.trim()).toBe('値を選択');

    const optionLabels = [...select.options].map((option) => option.textContent?.trim() ?? '');
    expect(optionLabels).toEqual(['りんご', 'バナナ', 'オレンジ']);

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
  name: i18n.t('nativeSelect.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
  name: i18n.t('nativeSelect.storyName.accessibility', 'Accessibility'),
  render: () => (
    <div className="space-y-2">
      <label id="a11y-native-label" htmlFor="a11y-native-select" className="text-sm font-medium">
        Select a fruit
      </label>
      <NativeSelect
        id="a11y-native-select"
        aria-labelledby="a11y-native-label"
        aria-describedby="a11y-native-desc"
        defaultValue="apple"
        className="w-[260px]"
      >
        <NativeSelectOption value="apple">
          {i18n.t('nativeSelect.story.apple', 'Apple')}
        </NativeSelectOption>
        <NativeSelectOption value="banana">
          {i18n.t('nativeSelect.story.banana', 'Banana')}
        </NativeSelectOption>
        <NativeSelectOption value="orange">
          {i18n.t('nativeSelect.story.orange', 'Orange')}
        </NativeSelectOption>
        <NativeSelectOption value="disabled" disabled>
          Disabled option
        </NativeSelectOption>
      </NativeSelect>
      <p id="a11y-native-desc" className="text-muted-foreground text-sm">
        Use arrow keys to navigate options.
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const select = canvasElement.querySelector('#a11y-native-select') as HTMLSelectElement;
    const canvas = within(canvasElement);

    // Verify select element
    expect(select.tagName).toBe('SELECT');

    // Verify label association
    const label = canvas.getByText('Select a fruit');
    expect(label.getAttribute('for')).toBe('a11y-native-select');

    // Verify aria-describedby
    expect(select.getAttribute('aria-describedby')).toBe('a11y-native-desc');

    // Verify initial value
    expect(select.value).toBe('apple');

    // Tab to focus
    await userEvent.tab();
    expect(select).toHaveFocus();

    // Change selection
    await userEvent.selectOptions(select, 'banana');
    expect(select.value).toBe('banana');

    // Verify disabled option
    const disabledOption = select.querySelector('option[value="disabled"]');
    expect(disabledOption).toHaveAttribute('disabled');
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('nativeSelect.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('nativeSelect.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t(
    'nativeSelect.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('nativeSelect.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('nativeSelect.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  name: i18n.t('nativeSelect.storyName.emptyData', 'Empty Data'),
  ...Default,
  parameters: {
    msw: { handlers: nativeSelectStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('select') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

// ============ FAKER DATA STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const fakeSelects = createFakeNativeSelects(3);

    return (
      <div className="flex flex-col gap-4" data-testid="native-select-faker">
        {fakeSelects.map((sel) => (
          <NativeSelect
            key={sel.id}
            aria-label={sel.ariaLabel}
            disabled={sel.disabled}
            className="w-[260px]"
            defaultValue={sel.defaultValue}
          >
            {sel.placeholder && (
              <NativeSelectOption value="" disabled>
                {sel.placeholder}
              </NativeSelectOption>
            )}
            {sel.options.map((opt) => (
              <NativeSelectOption key={opt.id} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="native-select-faker"]');
    expect(container).toBeInTheDocument();
    const selects = canvasElement.querySelectorAll('select');
    expect(selects.length).toBe(3);
    selects.forEach((select) => {
      expect(select.options.length).toBeGreaterThan(0);
    });
  },
};

// ============ FACTORY: SINGLE ITEM STORIES ============

function SingleOptionDemo() {
  const option: FakeNativeSelectOption = createFakeNativeSelectOption();

  return (
    <div className="space-y-2" data-testid="single-option-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        defaultValue={option.value}
        className="w-[260px]"
      >
        <NativeSelectOption value={option.value} disabled={option.disabled}>
          {option.label}
        </NativeSelectOption>
      </NativeSelect>
    </div>
  );
}

export const FactorySingleOption: Story = {
  name: i18n.t('nativeSelect.storyName.factorySingleOption', 'Factory: Single Option'),
  render: () => <SingleOptionDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="single-option-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(1);
  },
};

function OptionFromCategoryDemo() {
  const category: NativeSelectOptionCategory = 'fruits';
  const option: FakeNativeSelectOption = createFakeNativeSelectOptionFromCategory(category);

  return (
    <div className="space-y-2" data-testid="option-from-category-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        defaultValue={option.value}
        className="w-[260px]"
      >
        <NativeSelectOption value={option.value}>{option.label}</NativeSelectOption>
      </NativeSelect>
    </div>
  );
}

export const FactoryOptionFromCategory: Story = {
  name: i18n.t('nativeSelect.storyName.factoryOptionFromCategory', 'Factory: Option From Category'),
  render: () => <OptionFromCategoryDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="option-from-category-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(1);
  },
};

function OptGroupDemo() {
  const group: FakeNativeSelectOptGroup = createFakeNativeSelectOptGroup();

  return (
    <div className="space-y-2" data-testid="optgroup-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect aria-label={i18n.t('nativeSelect.ariaLabel')} className="w-[260px]">
        <NativeSelectOptGroup label={group.label} disabled={group.disabled}>
          {group.options.map((opt) => (
            <NativeSelectOption key={opt.id} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelectOptGroup>
      </NativeSelect>
    </div>
  );
}

export const FactoryOptGroup: Story = {
  name: i18n.t('nativeSelect.storyName.factoryOptGroup', 'Factory: OptGroup'),
  render: () => <OptGroupDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="optgroup-demo"]');
    expect(container).toBeInTheDocument();
    const optgroup = canvasElement.querySelector('optgroup');
    expect(optgroup).toBeInTheDocument();
    expect(optgroup?.getAttribute('label')).toBeTruthy();
  },
};

function SingleSelectDemo() {
  const fakeSelect: FakeNativeSelect = createFakeNativeSelect();

  return (
    <div className="space-y-2" data-testid="single-select-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={fakeSelect.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
        disabled={fakeSelect.disabled}
        required={fakeSelect.required}
        className={NATIVE_SELECT_SIZE_CLASSES[fakeSelect.size]}
        defaultValue={fakeSelect.defaultValue}
        aria-invalid={fakeSelect.invalid ? true : undefined}
      >
        {fakeSelect.placeholder && (
          <NativeSelectOption value="" disabled>
            {fakeSelect.placeholder}
          </NativeSelectOption>
        )}
        {fakeSelect.options.map((opt) => (
          <NativeSelectOption key={opt.id} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const FactorySingleSelect: Story = {
  name: i18n.t('nativeSelect.storyName.factorySingleSelect', 'Factory: Single Select'),
  render: () => <SingleSelectDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="single-select-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBeGreaterThan(0);
  },
};

function FormFieldDemo() {
  const field: FakeNativeSelectFormField = createFakeNativeSelectFormField();

  return (
    <div className="space-y-2" data-testid="form-field-demo">
      <label htmlFor={field.id} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      <NativeSelect
        id={field.id}
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        disabled={field.select.disabled}
        required={field.select.required}
        aria-invalid={field.select.invalid ? true : undefined}
        className="w-[260px]"
        defaultValue={field.select.defaultValue}
      >
        {field.select.placeholder && (
          <NativeSelectOption value="" disabled>
            {field.select.placeholder}
          </NativeSelectOption>
        )}
        {field.select.options.map((opt) => (
          <NativeSelectOption key={opt.id} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {field.description && <p className="text-muted-foreground text-sm">{field.description}</p>}
      {field.errorMessage && <p className="text-destructive text-sm">{field.errorMessage}</p>}
    </div>
  );
}

export const FactoryFormField: Story = {
  name: i18n.t('nativeSelect.storyName.factoryFormField', 'Factory: Form Field'),
  render: () => <FormFieldDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="form-field-demo"]');
    expect(container).toBeInTheDocument();
    const label = canvasElement.querySelector('label');
    expect(label).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: BULK STORIES ============

function BulkOptionsDemo() {
  const options: FakeNativeSelectOption[] = createFakeNativeSelectOptions(5);

  return (
    <div className="space-y-2" data-testid="bulk-options-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect aria-label={i18n.t('nativeSelect.ariaLabel')} className="w-[260px]">
        {options.map((opt) => (
          <NativeSelectOption key={opt.id} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const FactoryBulkOptions: Story = {
  name: i18n.t('nativeSelect.storyName.factoryBulkOptions', 'Factory: Bulk Options'),
  render: () => <BulkOptionsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="bulk-options-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(5);
  },
};

function OptionsFromCategoryDemo() {
  const options: FakeNativeSelectOption[] = createFakeNativeSelectOptionsFromCategory(
    'countries',
    5
  );

  return (
    <div className="space-y-2" data-testid="options-from-category-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect aria-label={i18n.t('nativeSelect.ariaLabel')} className="w-[260px]">
        {options.map((opt) => (
          <NativeSelectOption key={opt.id} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const FactoryOptionsFromCategory: Story = {
  name: i18n.t(
    'nativeSelect.storyName.factoryOptionsFromCategory',
    'Factory: Options From Category'
  ),
  render: () => <OptionsFromCategoryDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="options-from-category-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(5);
  },
};

function BulkOptGroupsDemo() {
  const groups: FakeNativeSelectOptGroup[] = createFakeNativeSelectOptGroups(3);

  return (
    <div className="space-y-2" data-testid="bulk-optgroups-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect aria-label={i18n.t('nativeSelect.ariaLabel')} className="w-[260px]">
        {groups.map((group) => (
          <NativeSelectOptGroup key={group.id} label={group.label} disabled={group.disabled}>
            {group.options.map((opt) => (
              <NativeSelectOption key={opt.id} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>
    </div>
  );
}

export const FactoryBulkOptGroups: Story = {
  name: i18n.t('nativeSelect.storyName.factoryBulkOptGroups', 'Factory: Bulk OptGroups'),
  render: () => <BulkOptGroupsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="bulk-optgroups-demo"]');
    expect(container).toBeInTheDocument();
    const optgroups = canvasElement.querySelectorAll('optgroup');
    expect(optgroups.length).toBe(3);
    optgroups.forEach((og) => {
      expect(og.getAttribute('label')).toBeTruthy();
    });
  },
};

function BulkFormFieldsDemo() {
  const fields: FakeNativeSelectFormField[] = createFakeNativeSelectFormFields(3);

  return (
    <div className="flex flex-col gap-4" data-testid="bulk-form-fields-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.validation')}</p>
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <label htmlFor={field.id} className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <NativeSelect
            id={field.id}
            aria-label={i18n.t('nativeSelect.ariaLabel')}
            disabled={field.select.disabled}
            required={field.select.required}
            aria-invalid={field.select.invalid ? true : undefined}
            className="w-[260px]"
            defaultValue={field.select.defaultValue}
          >
            {field.select.placeholder && (
              <NativeSelectOption value="" disabled>
                {field.select.placeholder}
              </NativeSelectOption>
            )}
            {field.select.options.map((opt) => (
              <NativeSelectOption key={opt.id} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {field.description && (
            <p className="text-muted-foreground text-xs">{field.description}</p>
          )}
          {field.errorMessage && <p className="text-destructive text-xs">{field.errorMessage}</p>}
        </div>
      ))}
    </div>
  );
}

export const FactoryBulkFormFields: Story = {
  name: i18n.t('nativeSelect.storyName.factoryBulkFormFields', 'Factory: Bulk Form Fields'),
  render: () => <BulkFormFieldsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="bulk-form-fields-demo"]');
    expect(container).toBeInTheDocument();
    const selects = canvasElement.querySelectorAll('select');
    expect(selects.length).toBe(3);
    const labels = canvasElement.querySelectorAll('label');
    expect(labels.length).toBe(3);
  },
};

// ============ FACTORY: SPECIALIZED SELECT STORIES ============

function CountrySelectDemo() {
  const countrySelect: FakeNativeSelect = createFakeCountrySelect();

  return (
    <div className="space-y-2" data-testid="country-select-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={countrySelect.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={countrySelect.defaultValue}
        name={countrySelect.name}
      >
        {countrySelect.placeholder && (
          <NativeSelectOption value="" disabled>
            {countrySelect.placeholder}
          </NativeSelectOption>
        )}
        {countrySelect.options.map((opt) => (
          <NativeSelectOption key={opt.id} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const FactoryCountrySelect: Story = {
  name: i18n.t('nativeSelect.storyName.factoryCountrySelect', 'Factory: Country Select'),
  render: () => <CountrySelectDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="country-select-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.name).toBe('country');
    expect(select.options.length).toBeGreaterThan(0);
  },
};

function LanguageSelectDemo() {
  const langSelect: FakeNativeSelect = createFakeLanguageSelect();

  return (
    <div className="space-y-2" data-testid="language-select-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={langSelect.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={langSelect.defaultValue}
        name={langSelect.name}
      >
        {langSelect.placeholder && (
          <NativeSelectOption value="" disabled>
            {langSelect.placeholder}
          </NativeSelectOption>
        )}
        {langSelect.options.map((opt) => (
          <NativeSelectOption key={opt.id} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const FactoryLanguageSelect: Story = {
  name: i18n.t('nativeSelect.storyName.factoryLanguageSelect', 'Factory: Language Select'),
  render: () => <LanguageSelectDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="language-select-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.name).toBe('language');
    expect(select.options.length).toBeGreaterThan(0);
  },
};

function CurrencySelectDemo() {
  const currencySelect: FakeNativeSelect = createFakeCurrencySelect();

  return (
    <div className="space-y-2" data-testid="currency-select-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={currencySelect.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={currencySelect.defaultValue}
        name={currencySelect.name}
      >
        {currencySelect.placeholder && (
          <NativeSelectOption value="" disabled>
            {currencySelect.placeholder}
          </NativeSelectOption>
        )}
        {currencySelect.options.map((opt) => (
          <NativeSelectOption key={opt.id} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const FactoryCurrencySelect: Story = {
  name: i18n.t('nativeSelect.storyName.factoryCurrencySelect', 'Factory: Currency Select'),
  render: () => <CurrencySelectDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="currency-select-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.name).toBe('currency');
    expect(select.options.length).toBeGreaterThan(0);
  },
};

function TimezoneSelectDemo() {
  const tzSelect: FakeNativeSelect = createFakeTimezoneSelect();

  return (
    <div className="space-y-2" data-testid="timezone-select-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={tzSelect.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={tzSelect.defaultValue}
        name={tzSelect.name}
      >
        {tzSelect.placeholder && (
          <NativeSelectOption value="" disabled>
            {tzSelect.placeholder}
          </NativeSelectOption>
        )}
        {tzSelect.options.map((opt) => (
          <NativeSelectOption key={opt.id} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const FactoryTimezoneSelect: Story = {
  name: i18n.t('nativeSelect.storyName.factoryTimezoneSelect', 'Factory: Timezone Select'),
  render: () => <TimezoneSelectDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="timezone-select-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.name).toBe('timezone');
    expect(select.options.length).toBeGreaterThan(0);
  },
};

function PrioritySelectDemo() {
  const prioritySelect: FakeNativeSelect = createFakePrioritySelect();

  return (
    <div className="space-y-2" data-testid="priority-select-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={prioritySelect.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={prioritySelect.defaultValue}
        name={prioritySelect.name}
      >
        {prioritySelect.placeholder && (
          <NativeSelectOption value="" disabled>
            {prioritySelect.placeholder}
          </NativeSelectOption>
        )}
        {prioritySelect.options.map((opt) => (
          <NativeSelectOption key={opt.id} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const FactoryPrioritySelect: Story = {
  name: i18n.t('nativeSelect.storyName.factoryPrioritySelect', 'Factory: Priority Select'),
  render: () => <PrioritySelectDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="priority-select-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.name).toBe('priority');
    expect(select.options.length).toBeGreaterThan(0);
  },
};

function StatusSelectDemo() {
  const statusSelect: FakeNativeSelect = createFakeStatusSelect();

  return (
    <div className="space-y-2" data-testid="status-select-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.states')}</p>
      <NativeSelect
        aria-label={statusSelect.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={statusSelect.defaultValue}
        name={statusSelect.name}
      >
        {statusSelect.placeholder && (
          <NativeSelectOption value="" disabled>
            {statusSelect.placeholder}
          </NativeSelectOption>
        )}
        {statusSelect.options.map((opt) => (
          <NativeSelectOption key={opt.id} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const FactoryStatusSelect: Story = {
  name: i18n.t('nativeSelect.storyName.factoryStatusSelect', 'Factory: Status Select'),
  render: () => <StatusSelectDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="status-select-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.name).toBe('status');
    expect(select.options.length).toBeGreaterThan(0);
  },
};

function MonthSelectDemo() {
  const monthSelect: FakeNativeSelect = createFakeMonthSelect();

  return (
    <div className="space-y-2" data-testid="month-select-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={monthSelect.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={monthSelect.defaultValue}
        name={monthSelect.name}
      >
        {monthSelect.placeholder && (
          <NativeSelectOption value="" disabled>
            {monthSelect.placeholder}
          </NativeSelectOption>
        )}
        {monthSelect.options.map((opt) => (
          <NativeSelectOption key={opt.id} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const FactoryMonthSelect: Story = {
  name: i18n.t('nativeSelect.storyName.factoryMonthSelect', 'Factory: Month Select'),
  render: () => <MonthSelectDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="month-select-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.name).toBe('month');
    expect(select.options.length).toBeGreaterThan(0);
  },
};

function GroupedSelectDemo() {
  const groupedSelect: FakeNativeSelect = createFakeGroupedSelect();

  return (
    <div className="space-y-2" data-testid="grouped-select-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={groupedSelect.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        name={groupedSelect.name}
      >
        {groupedSelect.placeholder && (
          <NativeSelectOption value="" disabled>
            {groupedSelect.placeholder}
          </NativeSelectOption>
        )}
        {groupedSelect.optGroups?.map((group) => (
          <NativeSelectOptGroup key={group.id} label={group.label} disabled={group.disabled}>
            {group.options.map((opt) => (
              <NativeSelectOption key={opt.id} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>
    </div>
  );
}

export const FactoryGroupedSelect: Story = {
  name: i18n.t('nativeSelect.storyName.factoryGroupedSelect', 'Factory: Grouped Select'),
  render: () => <GroupedSelectDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="grouped-select-demo"]');
    expect(container).toBeInTheDocument();
    const optgroups = canvasElement.querySelectorAll('optgroup');
    expect(optgroups.length).toBe(2);
    expect(optgroups[0].getAttribute('label')).toBe('Popular');
    expect(optgroups[1].getAttribute('label')).toBe('Other');
  },
};

function MultiSelectDemo() {
  const multiSelect: FakeNativeSelect = createFakeMultiSelect('colors');

  return (
    <div className="space-y-2" data-testid="multi-select-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={multiSelect.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        multiple={multiSelect.multiple}
        name={multiSelect.name}
        size={4}
      >
        {multiSelect.options.map((opt) => (
          <NativeSelectOption key={opt.id} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const FactoryMultiSelect: Story = {
  name: i18n.t('nativeSelect.storyName.factoryMultiSelect', 'Factory: Multi Select'),
  render: () => <MultiSelectDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="multi-select-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.multiple).toBe(true);
    expect(select.name).toBe('multi-colors');
  },
};

// ============ FACTORY: MATRIX STORIES ============

function SizeMatrixDemo() {
  const sizes: NativeSelectSize[] = [...NATIVE_SELECT_SIZES];
  const sizeMatrix: FakeNativeSelect[] = createFakeNativeSelectSizeMatrix();

  return (
    <div className="flex flex-col gap-4" data-testid="size-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.sizes')}</p>
      {sizeMatrix.map((sel, i) => (
        <div key={sel.id} className="space-y-1">
          <p className="text-muted-foreground text-xs">{sizes[i]}</p>
          <NativeSelect
            aria-label={sel.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
            className={NATIVE_SELECT_SIZE_CLASSES[sel.size]}
            defaultValue={sel.defaultValue}
          >
            {sel.options.map((opt) => (
              <NativeSelectOption key={opt.id} value={opt.value}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ))}
    </div>
  );
}

export const FactorySizeMatrix: Story = {
  name: i18n.t('nativeSelect.storyName.factorySizeMatrix', 'Factory: Size Matrix'),
  render: () => <SizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="size-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const selects = canvasElement.querySelectorAll('select');
    expect(selects.length).toBe(NATIVE_SELECT_SIZES.length);
  },
};

function StateMatrixDemo() {
  const states: NativeSelectState[] = [...NATIVE_SELECT_STATES];
  const stateMatrix: FakeNativeSelect[] = createFakeNativeSelectStateMatrix();

  return (
    <div className="flex flex-col gap-4" data-testid="state-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.states')}</p>
      {stateMatrix.map((sel, i) => (
        <div key={sel.id} className="space-y-1">
          <p className="text-muted-foreground text-xs">{states[i]}</p>
          <NativeSelect
            aria-label={sel.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
            className="w-[260px]"
            disabled={sel.disabled}
            aria-invalid={sel.invalid ? true : undefined}
            defaultValue={sel.defaultValue}
          >
            {sel.options.map((opt) => (
              <NativeSelectOption key={opt.id} value={opt.value}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ))}
    </div>
  );
}

export const FactoryStateMatrix: Story = {
  name: i18n.t('nativeSelect.storyName.factoryStateMatrix', 'Factory: State Matrix'),
  render: () => <StateMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="state-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const selects = canvasElement.querySelectorAll('select');
    expect(selects.length).toBe(NATIVE_SELECT_STATES.length);

    // Verify the disabled state select is disabled
    const disabledSelect = selects[2] as HTMLSelectElement;
    expect(disabledSelect).toBeDisabled();

    // Verify error state select has aria-invalid
    const errorSelect = selects[3] as HTMLSelectElement;
    expect(errorSelect).toHaveAttribute('aria-invalid', 'true');
  },
};

function CategoryMatrixDemo() {
  const categories: NativeSelectOptionCategory[] = [...NATIVE_SELECT_OPTION_CATEGORIES];
  const categoryMatrix: FakeNativeSelect[] = createFakeNativeSelectCategoryMatrix();

  return (
    <div className="flex flex-col gap-4" data-testid="category-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      {categoryMatrix.map((sel, i) => (
        <div key={sel.id} className="space-y-1">
          <p className="text-muted-foreground text-xs">{categories[i]}</p>
          <NativeSelect
            aria-label={sel.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
            className="w-[260px]"
            defaultValue={sel.defaultValue}
            name={sel.name}
          >
            {sel.options.map((opt) => (
              <NativeSelectOption key={opt.id} value={opt.value}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ))}
    </div>
  );
}

export const FactoryCategoryMatrix: Story = {
  name: i18n.t('nativeSelect.storyName.factoryCategoryMatrix', 'Factory: Category Matrix'),
  render: () => <CategoryMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="category-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const selects = canvasElement.querySelectorAll('select');
    expect(selects.length).toBe(NATIVE_SELECT_OPTION_CATEGORIES.length);
  },
};

// ============ FACTORY: CONSTANT-BASED STORIES ============

function FruitsConstDemo() {
  return (
    <div className="space-y-2" data-testid="fruits-const-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={NATIVE_SELECT_FRUITS[0].value}
      >
        {NATIVE_SELECT_FRUITS.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const ConstantFruits: Story = {
  name: i18n.t('nativeSelect.storyName.constantFruits', 'Constant: Fruits'),
  render: () => <FruitsConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="fruits-const-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(NATIVE_SELECT_FRUITS.length);
    expect(select.value).toBe('apple');
  },
};

function ColorsConstDemo() {
  return (
    <div className="space-y-2" data-testid="colors-const-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={NATIVE_SELECT_COLORS[0].value}
      >
        {NATIVE_SELECT_COLORS.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const ConstantColors: Story = {
  name: i18n.t('nativeSelect.storyName.constantColors', 'Constant: Colors'),
  render: () => <ColorsConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="colors-const-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(NATIVE_SELECT_COLORS.length);
    expect(select.value).toBe('red');
  },
};

function CountriesConstDemo() {
  return (
    <div className="space-y-2" data-testid="countries-const-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={NATIVE_SELECT_COUNTRIES[0].value}
      >
        {NATIVE_SELECT_COUNTRIES.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const ConstantCountries: Story = {
  name: i18n.t('nativeSelect.storyName.constantCountries', 'Constant: Countries'),
  render: () => <CountriesConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="countries-const-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(NATIVE_SELECT_COUNTRIES.length);
    expect(select.value).toBe('us');
  },
};

function LanguagesConstDemo() {
  return (
    <div className="space-y-2" data-testid="languages-const-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={NATIVE_SELECT_LANGUAGES[0].value}
      >
        {NATIVE_SELECT_LANGUAGES.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const ConstantLanguages: Story = {
  name: i18n.t('nativeSelect.storyName.constantLanguages', 'Constant: Languages'),
  render: () => <LanguagesConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="languages-const-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(NATIVE_SELECT_LANGUAGES.length);
    expect(select.value).toBe('en');
  },
};

function CurrenciesConstDemo() {
  return (
    <div className="space-y-2" data-testid="currencies-const-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={NATIVE_SELECT_CURRENCIES[0].value}
      >
        {NATIVE_SELECT_CURRENCIES.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const ConstantCurrencies: Story = {
  name: i18n.t('nativeSelect.storyName.constantCurrencies', 'Constant: Currencies'),
  render: () => <CurrenciesConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="currencies-const-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(NATIVE_SELECT_CURRENCIES.length);
    expect(select.value).toBe('usd');
  },
};

function MonthsConstDemo() {
  return (
    <div className="space-y-2" data-testid="months-const-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={NATIVE_SELECT_MONTHS[0].value}
      >
        {NATIVE_SELECT_MONTHS.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const ConstantMonths: Story = {
  name: i18n.t('nativeSelect.storyName.constantMonths', 'Constant: Months'),
  render: () => <MonthsConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="months-const-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(NATIVE_SELECT_MONTHS.length);
    expect(select.value).toBe('01');
  },
};

function PrioritiesConstDemo() {
  return (
    <div className="space-y-2" data-testid="priorities-const-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={NATIVE_SELECT_PRIORITIES[0].value}
      >
        {NATIVE_SELECT_PRIORITIES.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const ConstantPriorities: Story = {
  name: i18n.t('nativeSelect.storyName.constantPriorities', 'Constant: Priorities'),
  render: () => <PrioritiesConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="priorities-const-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(NATIVE_SELECT_PRIORITIES.length);
    expect(select.value).toBe('low');
  },
};

function StatusesConstDemo() {
  return (
    <div className="space-y-2" data-testid="statuses-const-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.states')}</p>
      <NativeSelect
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={NATIVE_SELECT_STATUSES[0].value}
      >
        {NATIVE_SELECT_STATUSES.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const ConstantStatuses: Story = {
  name: i18n.t('nativeSelect.storyName.constantStatuses', 'Constant: Statuses'),
  render: () => <StatusesConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="statuses-const-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(NATIVE_SELECT_STATUSES.length);
    expect(select.value).toBe('draft');
  },
};

function SizesOptionsConstDemo() {
  return (
    <div className="space-y-2" data-testid="sizes-options-const-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.sizes')}</p>
      <NativeSelect
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={NATIVE_SELECT_SIZES_OPTIONS[0].value}
      >
        {NATIVE_SELECT_SIZES_OPTIONS.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const ConstantSizesOptions: Story = {
  name: i18n.t('nativeSelect.storyName.constantSizesOptions', 'Constant: Sizes Options'),
  render: () => <SizesOptionsConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="sizes-options-const-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(NATIVE_SELECT_SIZES_OPTIONS.length);
    expect(select.value).toBe('xs');
  },
};

function TimezonesConstDemo() {
  return (
    <div className="space-y-2" data-testid="timezones-const-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.section.variants')}</p>
      <NativeSelect
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        className="w-[320px]"
        defaultValue={NATIVE_SELECT_TIMEZONES[0].value}
      >
        {NATIVE_SELECT_TIMEZONES.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const ConstantTimezones: Story = {
  name: i18n.t('nativeSelect.storyName.constantTimezones', 'Constant: Timezones'),
  render: () => <TimezonesConstDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="timezones-const-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(NATIVE_SELECT_TIMEZONES.length);
    expect(select.value).toBe('America/Los_Angeles');
  },
};

function OptionsByCategoryDemo() {
  const categories = Object.keys(NATIVE_SELECT_OPTIONS_BY_CATEGORY) as NativeSelectOptionCategory[];
  const firstCategory = categories[0];
  const options = NATIVE_SELECT_OPTIONS_BY_CATEGORY[firstCategory];

  return (
    <div className="space-y-2" data-testid="options-by-category-demo">
      <p className="text-sm font-medium">
        {i18n.t('nativeSelect.section.variants')}: {firstCategory}
      </p>
      <NativeSelect
        aria-label={i18n.t('nativeSelect.ariaLabel')}
        className="w-[260px]"
        defaultValue={options[0].value}
      >
        {options.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export const ConstantOptionsByCategory: Story = {
  name: i18n.t('nativeSelect.storyName.constantOptionsByCategory', 'Constant: Options By Category'),
  render: () => <OptionsByCategoryDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="options-by-category-demo"]');
    expect(container).toBeInTheDocument();
    const select = canvasElement.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBeGreaterThan(0);
  },
};

// ============ FACTORY: SHOWCASE STORY ============

function ShowcaseDemo() {
  const showcase = createFakeNativeSelectShowcase();
  const singleSelect = showcase.select as FakeNativeSelect;
  const countrySelectData = showcase.countrySelect as FakeNativeSelect;
  const selectWithGroups = showcase.selectWithGroups as FakeNativeSelect;
  const multiSelectColors = showcase.multiSelectColors as FakeNativeSelect;
  const sizeMatrix = showcase.sizeMatrix as FakeNativeSelect[];

  return (
    <div className="flex flex-col gap-6" data-testid="showcase-demo">
      <p className="text-sm font-medium">{i18n.t('nativeSelect.story.description')}</p>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">{i18n.t('nativeSelect.default')}</p>
        <NativeSelect
          aria-label={singleSelect.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
          className="w-[260px]"
          defaultValue={singleSelect.defaultValue}
        >
          {singleSelect.options.map((opt) => (
            <NativeSelectOption key={opt.id} value={opt.value}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          {i18n.t('nativeSelect.story.country', 'Country')}
        </p>
        <NativeSelect
          aria-label={countrySelectData.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
          className="w-[260px]"
          defaultValue={countrySelectData.defaultValue}
        >
          {countrySelectData.options.map((opt) => (
            <NativeSelectOption key={opt.id} value={opt.value}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          {i18n.t('nativeSelect.story.grouped', 'Grouped')}
        </p>
        <NativeSelect
          aria-label={selectWithGroups.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
          className="w-[260px]"
        >
          {selectWithGroups.optGroups?.map((group) => (
            <NativeSelectOptGroup key={group.id} label={group.label}>
              {group.options.map((opt) => (
                <NativeSelectOption key={opt.id} value={opt.value}>
                  {opt.label}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          {i18n.t('nativeSelect.story.multiSelect', 'Multi Select')}
        </p>
        <NativeSelect
          aria-label={multiSelectColors.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
          className="w-[260px]"
          multiple
          size={4}
        >
          {multiSelectColors.options.map((opt) => (
            <NativeSelectOption key={opt.id} value={opt.value}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">{i18n.t('nativeSelect.section.sizes')}</p>
        <div className="flex flex-col gap-2">
          {sizeMatrix.map((sel) => (
            <NativeSelect
              key={sel.id}
              aria-label={sel.ariaLabel ?? i18n.t('nativeSelect.ariaLabel')}
              className={NATIVE_SELECT_SIZE_CLASSES[sel.size]}
              defaultValue={sel.defaultValue}
            >
              {sel.options.map((opt) => (
                <NativeSelectOption key={opt.id} value={opt.value}>
                  {opt.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryShowcase: Story = {
  name: i18n.t('nativeSelect.storyName.factoryShowcase', 'Factory: Showcase'),
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="showcase-demo"]');
    expect(container).toBeInTheDocument();
    const selects = canvasElement.querySelectorAll('select');
    // single + country + grouped + multi + 4 sizes = 8
    expect(selects.length).toBeGreaterThanOrEqual(7);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('nativeSelect.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('nativeSelect.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('nativeSelect.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('nativeSelect.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// ADDITIONAL HANDLER STATUS STORIES
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('nativeSelect.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: nativeSelectStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('nativeSelect.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: nativeSelectStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('nativeSelect.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: nativeSelectStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
