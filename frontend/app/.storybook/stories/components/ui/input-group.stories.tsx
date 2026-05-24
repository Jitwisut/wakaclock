import type { Meta, StoryObj } from '@storybook/react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  GlobeIcon,
  MailIcon,
  PhoneIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  createFakeAccessibleErrorInputGroup,
  createFakeAccessibleInputGroup,
  createFakeAccessibleInputGroupSet,
  createFakeCommandInputGroup,
  createFakeContactInputGroups,
  createFakeCurrencyInputGroup,
  createFakeEmailInputGroup,
  createFakeEnterpriseAutocompleteInputGroup,
  createFakeEnterpriseCharacterCountInputGroup,
  createFakeEnterpriseInputGroupSet,
  createFakeEnterpriseLoadingInputGroup,
  createFakeEnterpriseValidatingInputGroup,
  createFakeInputGroup,
  createFakeInputGroupAlignmentMatrix,
  createFakeInputGroupButtonSizeMatrix,
  createFakeInputGroupContentTypeMatrix,
  createFakeInputGroupInputTypeMatrix,
  createFakeInputGroups,
  createFakeInputGroupShowcase,
  createFakeInputGroupStateMatrix,
  createFakePasswordInputGroup,
  createFakePaymentInputGroups,
  createFakePhoneInputGroup,
  createFakeRegistrationInputGroups,
  createFakeSearchFormInputGroups,
  createFakeSearchInputGroup,
  createFakeTextareaInputGroup,
  createFakeUrlInputGroup,
  INPUT_GROUP_ADDON_ALIGNS,
  INPUT_GROUP_ADDON_CONTENT_TYPES,
  INPUT_GROUP_ARIA_LABELS,
  INPUT_GROUP_BUTTON_SIZES,
  INPUT_GROUP_COUNTRY_CODES,
  INPUT_GROUP_CURRENCIES,
  INPUT_GROUP_ICONS,
  INPUT_GROUP_INPUT_TYPES,
  INPUT_GROUP_LAYOUTS,
  INPUT_GROUP_PLACEHOLDERS,
  INPUT_GROUP_PREFIX_TEXTS,
  INPUT_GROUP_SHORTCUTS,
  INPUT_GROUP_STATES,
  INPUT_GROUP_SUFFIX_TEXTS,
  INPUT_GROUP_WIDTHS,
} from '@/.storybook/stories/_factories/input-group.factory';
import type {
  FakeAccessibleInputGroup,
  FakeCommandInputGroup,
  FakeCurrencyInputGroup,
  FakeEmailInputGroup,
  FakeEnterpriseInputGroup,
  FakeInputGroup,
  FakeInputGroupAddon,
  FakeInputGroupInput,
  FakeInputGroupTextarea,
  FakePasswordInputGroup,
  FakePhoneInputGroup,
  FakeSearchInputGroup,
  FakeUrlInputGroup,
  InputGroupAddonAlign,
  InputGroupAddonContentType,
  InputGroupButtonSize,
  InputGroupIconName,
  InputGroupInputType,
  InputGroupLayout,
  InputGroupState,
  InputGroupWidth,
} from '@/.storybook/stories/_factories/input-group.factory';
import {
  inputGroupHandlers,
  inputGroupStatusHandlers,
} from '@/.storybook/stories/_handlers/input-group.handlers';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function InputGroupDemo() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-xl space-y-6">
      <div className="space-y-2">
        <div className="text-sm font-medium">{t('inputGroup.section.inlineAddons')}</div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={t('inputGroup.search.ariaLabel')}
            id="input-group-search"
            placeholder={t('inputGroup.search.placeholder')}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label={t('inputGroup.search.clearAriaLabel')}
              id="input-group-clear"
              size="icon-xs"
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{t('inputGroup.section.helperShortcut')}</div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>{t('inputGroup.command.label')}</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label={t('inputGroup.command.label')}
            id="input-group-command"
            placeholder={t('inputGroup.command.placeholder')}
          />
          <InputGroupAddon align="inline-end">
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{t('inputGroup.section.textareaBlockAddon')}</div>
        <InputGroup className="items-stretch">
          <InputGroupAddon align="block-start" className="border-b">
            <InputGroupText>{t('inputGroup.description.label')}</InputGroupText>
          </InputGroupAddon>
          <InputGroupTextarea
            aria-label={t('inputGroup.description.label')}
            id="input-group-description"
            placeholder={t('inputGroup.description.placeholder')}
          />
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{t('inputGroup.section.invalid')}</div>
        <InputGroup>
          <InputGroupInput
            aria-invalid
            aria-label={t('inputGroup.invalid.ariaLabel')}
            defaultValue={t('inputGroup.invalid.defaultValue')}
            id="input-group-invalid"
          />
        </InputGroup>
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Input Group',
  component: InputGroupDemo,
  tags: ['autodocs'],
  args: {
    onChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onInput: fn(),
  },
  parameters: {
    msw: {
      handlers: inputGroupHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('inputGroup.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('inputGroup.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('inputGroup.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('inputGroup.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('inputGroup.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('inputGroup.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('inputGroup.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    // Note: argTypes for demo wrapper - actual InputGroup component props documented below
    // InputGroup Props Reference:
    // - className: Additional CSS classes for the container (string)
    // - children: InputGroupInput, InputGroupAddon, InputGroupButton elements (ReactNode)
    //
    // InputGroupInput Props Reference:
    // - All standard HTML input attributes
    // - aria-label: Accessible label for screen readers (string)
    // - aria-invalid: Whether the input has invalid value (boolean)
    // - placeholder: Placeholder text (string)
    // - disabled: Whether the input is disabled (boolean)
    // - id: Unique identifier (string)
    //
    // InputGroupTextarea Props Reference:
    // - All standard HTML textarea attributes
    // - aria-label: Accessible label for screen readers (string)
    // - placeholder: Placeholder text (string)
    // - disabled: Whether the textarea is disabled (boolean)
    //
    // InputGroupAddon Props Reference:
    // - align: Position of addon ('inline-start' | 'inline-end' | 'block-start' | 'block-end')
    // - className: Additional CSS classes (string)
    // - children: Addon content - icons, text, buttons (ReactNode)
    //
    // InputGroupButton Props Reference:
    // - size: Button size ('icon-xs' | 'icon-sm' | 'icon' | 'icon-lg')
    // - aria-label: Accessible label for icon buttons (string)
    // - All standard Button props
    //
    // InputGroupText Props Reference:
    // - children: Text content (ReactNode)
    // - className: Additional CSS classes (string)
  },
} satisfies Meta<typeof InputGroupDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    const sections = canvasElement.querySelectorAll('div.space-y-2');
    expect(sections.length).toBe(4);

    for (const section of sections) {
      const heading = section.querySelector('div.text-sm.font-medium');
      if (!(heading instanceof HTMLElement)) {
        throw new Error('Expected section heading to be present.');
      }
      expect(heading.textContent?.trim()).not.toBe('');
    }

    const searchInput = canvasElement.querySelector('#input-group-search');
    if (!(searchInput instanceof HTMLInputElement)) {
      throw new Error('Search input was not found.');
    }

    const clearButton = canvasElement.querySelector('#input-group-clear');
    if (!(clearButton instanceof HTMLButtonElement)) {
      throw new Error('Clear button was not found.');
    }

    expect(searchInput.getAttribute('aria-label')).not.toBe('');
    expect(clearButton.getAttribute('aria-label')).not.toBe('');
    expect(searchInput.placeholder.trim()).not.toBe('');

    const searchAddon = searchInput
      .closest('[data-slot="input-group"]')
      ?.querySelector('[data-slot="input-group-addon"][data-align="inline-start"]');

    if (!(searchAddon instanceof HTMLElement)) {
      throw new Error('Search addon was not found.');
    }

    await userEvent.click(searchAddon);
    expect(doc.activeElement).toBe(searchInput);

    await userEvent.type(searchInput, 'abc');
    await userEvent.click(clearButton);

    const commandInput = canvasElement.querySelector('#input-group-command');
    if (!(commandInput instanceof HTMLInputElement)) {
      throw new Error('Command input was not found.');
    }

    expect(commandInput.getAttribute('aria-label')).not.toBe('');
    expect(commandInput.placeholder.trim()).not.toBe('');

    const kbds = canvasElement.querySelectorAll('[data-slot="kbd"]');
    expect(kbds.length).toBe(2);
    expect(kbds[0]?.textContent?.trim()).toBe('⌘');
    expect(kbds[1]?.textContent?.trim()).toBe('K');

    await userEvent.type(commandInput, 'open');

    const descriptionTextarea = canvasElement.querySelector('#input-group-description');
    if (!(descriptionTextarea instanceof HTMLTextAreaElement)) {
      throw new Error('Description textarea was not found.');
    }

    expect(descriptionTextarea.getAttribute('aria-label')).not.toBe('');
    expect(descriptionTextarea.placeholder.trim()).not.toBe('');

    await userEvent.type(descriptionTextarea, 'Hello');
    expect(descriptionTextarea.value).toContain('Hello');

    const invalidInput = canvasElement.querySelector('#input-group-invalid');
    if (!(invalidInput instanceof HTMLInputElement)) {
      throw new Error('Invalid input was not found.');
    }
    expect(invalidInput.getAttribute('aria-invalid')).toBe('true');
    expect(invalidInput.value.trim()).not.toBe('');

    expect(
      canvasElement.querySelectorAll('[data-slot="input-group"]').length
    ).toBeGreaterThanOrEqual(4);
    expect(
      canvasElement.querySelectorAll('[data-slot="input-group-control"]').length
    ).toBeGreaterThanOrEqual(4);
  },
};

export const Playground: Story = {
  ...Default,
  play: async (context) => {
    await Default.play?.(context);
  },
};

// ============ VARIANTS ============

export const Variants: Story = {
  render: () => (
    <div className="w-full max-w-xl space-y-6">
      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.withPrefixText', 'With Prefix Text')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>https://</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.websiteUrl', 'Website URL')}
            placeholder={i18n.t('inputGroup.story.exampleDomain', 'example.com')}
          />
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.withSuffixIcon', 'With Suffix Icon')}
        </div>
        <InputGroup>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.search', 'Search')}
            placeholder={i18n.t('inputGroup.story.search', 'Search...')}
          />
          <InputGroupAddon align="inline-end">
            <SearchIcon className="text-muted-foreground size-4" />
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.withButtonAddon', 'With Button Addon')}
        </div>
        <InputGroup>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.email', 'Email')}
            type="email"
            placeholder={i18n.t('inputGroup.story.enterEmail', 'Enter email')}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="sm">
              {i18n.t('inputGroup.story.subscribe', 'Subscribe')}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.withSelectAddon', 'With Select Addon')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <select
              aria-label={i18n.t('inputGroup.story.currency', 'Currency')}
              className="h-full border-0 bg-transparent text-sm focus:outline-none"
            >
              <option>{i18n.t('inputGroup.story.usd', 'USD')}</option>
              <option>{i18n.t('inputGroup.story.eur', 'EUR')}</option>
              <option>{i18n.t('inputGroup.story.gbp', 'GBP')}</option>
            </select>
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.amount', 'Amount')}
            type="number"
            placeholder="0.00"
          />
        </InputGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const sections = canvasElement.querySelectorAll('div.space-y-2');
    expect(sections.length).toBe(4);

    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBe(4);

    const inputs = canvasElement.querySelectorAll('input[aria-label]');
    expect(inputs.length).toBe(4);

    const selectElement = canvasElement.querySelector('select[aria-label="Currency"]');
    expect(selectElement).toBeInTheDocument();

    const subscribeButton = canvasElement.querySelector('button');
    expect(subscribeButton?.textContent).toContain('Subscribe');
  },
};

// ============ SIZES ============

export const Sizes: Story = {
  render: () => (
    <div className="w-full max-w-xl space-y-6">
      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('inputGroup.story.small', 'Small')}</div>
        <InputGroup className="h-8">
          <InputGroupAddon align="inline-start">
            <SearchIcon className="size-3" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.smallSearch', 'Small search')}
            placeholder={i18n.t('inputGroup.story.search', 'Search...')}
            className="h-8 text-xs"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton aria-label={i18n.t('inputGroup.story.clear', 'Clear')} size="icon-xs">
              <XIcon className="size-3" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('inputGroup.story.default', 'Default')}</div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.defaultSearch', 'Default search')}
            placeholder={i18n.t('inputGroup.story.search', 'Search...')}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton aria-label={i18n.t('inputGroup.story.clear', 'Clear')} size="icon-xs">
              <XIcon className="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{i18n.t('inputGroup.story.large', 'Large')}</div>
        <InputGroup className="h-12">
          <InputGroupAddon align="inline-start">
            <SearchIcon className="size-5" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.largeSearch', 'Large search')}
            placeholder={i18n.t('inputGroup.story.search', 'Search...')}
            className="h-12 text-base"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton aria-label={i18n.t('inputGroup.story.clear', 'Clear')} size="icon-sm">
              <XIcon className="size-5" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBe(3);

    const smallInput = canvasElement.querySelector('input[aria-label="Small search"]');
    const defaultInput = canvasElement.querySelector('input[aria-label="Default search"]');
    const largeInput = canvasElement.querySelector('input[aria-label="Large search"]');

    expect(smallInput).toBeInTheDocument();
    expect(defaultInput).toBeInTheDocument();
    expect(largeInput).toBeInTheDocument();

    const buttons = canvasElement.querySelectorAll('button[aria-label="Clear"]');
    expect(buttons.length).toBe(3);

    await userEvent.type(smallInput as HTMLInputElement, 'small');
    await userEvent.type(defaultInput as HTMLInputElement, 'default');
    await userEvent.type(largeInput as HTMLInputElement, 'large');

    expect((smallInput as HTMLInputElement).value).toBe('small');
    expect((defaultInput as HTMLInputElement).value).toBe('default');
    expect((largeInput as HTMLInputElement).value).toBe('large');
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.classList.contains('dark')).toBe(true);

    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();

    await userEvent.type(searchInput as HTMLInputElement, 'dark mode test');
    expect((searchInput as HTMLInputElement).value).toBe('dark mode test');
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

    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();

    await userEvent.type(searchInput as HTMLInputElement, 'rtl test');
    expect((searchInput as HTMLInputElement).value).toBe('rtl test');
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

    const canvas = within(canvasElement);

    expect(canvas.getByText('インラインアドオン')).toBeInTheDocument();
    expect(canvas.getByText('ヘルパーとショートカット')).toBeInTheDocument();
    expect(canvas.getByText('テキストエリアとブロックアドオン')).toBeInTheDocument();
    expect(canvas.getByText('無効')).toBeInTheDocument();
    expect(canvas.getByText('コマンド')).toBeInTheDocument();
    expect(canvas.getByText('説明')).toBeInTheDocument();

    const searchInput = canvasElement.querySelector('#input-group-search');
    if (!(searchInput instanceof HTMLInputElement)) {
      throw new Error('Search input was not found.');
    }
    expect(searchInput.getAttribute('aria-label')).toBe('検索');
    expect(searchInput.placeholder).toBe('検索…');

    const clearButton = canvasElement.querySelector('#input-group-clear');
    if (!(clearButton instanceof HTMLButtonElement)) {
      throw new Error('Clear button was not found.');
    }
    expect(clearButton.getAttribute('aria-label')).toBe('クリア');

    const invalidInput = canvasElement.querySelector('#input-group-invalid');
    if (!(invalidInput instanceof HTMLInputElement)) {
      throw new Error('Invalid input was not found.');
    }
    expect(invalidInput.getAttribute('aria-label')).toBe('無効な入力');
    expect(invalidInput.value).toBe('不正な値');

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
  name: i18n.t('inputGroup.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
// Note: InputGroup is a form composition component.
// These stories demonstrate MSW handlers for API-based search/autocomplete scenarios.

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: inputGroupHandlers,
    },
  },
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: inputGroupStatusHandlers.loading,
    },
  },
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: inputGroupStatusHandlers.internalServerError,
    },
  },
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: inputGroupStatusHandlers.serviceUnavailable,
    },
  },
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: inputGroupStatusHandlers.badRequest,
    },
  },
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: inputGroupStatusHandlers.unauthorized,
    },
  },
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: inputGroupStatusHandlers.forbidden,
    },
  },
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: inputGroupStatusHandlers.unprocessableEntity,
    },
  },
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: inputGroupStatusHandlers.networkError,
    },
  },
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('inputGroup.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: inputGroupStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('inputGroup.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: inputGroupStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('inputGroup.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: inputGroupStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('inputGroup.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: inputGroupStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const inputGroups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(inputGroups.length).toBeGreaterThanOrEqual(4);

    const searchInput = canvasElement.querySelector('#input-group-search');
    expect(searchInput).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  name: i18n.t('inputGroup.storyName.emptyData', 'Empty Data'),
  render: () => (
    <div className="w-full max-w-xl space-y-6" data-testid="input-group-empty" data-state="empty">
      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.emptySearch', 'Empty Search')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.search', 'Search')}
            placeholder={i18n.t('inputGroup.story.noResultsFound', 'No results found...')}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton aria-label={i18n.t('inputGroup.story.clear', 'Clear')} size="icon-xs">
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-muted-foreground text-sm">
          {i18n.t('inputGroup.story.noSearchResultsAvailable', 'No search results available.')}
        </p>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="input-group-empty"]')).toBeInTheDocument();
    const input = canvasElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('');
  },
};

export const WithFakerData: Story = {
  name: i18n.t('inputGroup.storyName.withFakerData', 'With Faker Data'),
  render: () => {
    const groups = createFakeInputGroups(3);

    return (
      <div className="w-full max-w-xl space-y-6" data-testid="input-group-faker">
        {groups.map((group) => (
          <div key={group.id} className="space-y-2">
            <div className="text-sm font-medium">{group.name}</div>
            <InputGroup>
              {group.prefixAddon && (
                <InputGroupAddon align={group.prefixAddon.align}>
                  {group.prefixAddon.text ? (
                    <InputGroupText>{group.prefixAddon.text}</InputGroupText>
                  ) : (
                    <SearchIcon />
                  )}
                </InputGroupAddon>
              )}
              <InputGroupInput
                aria-label={group.input?.ariaLabel ?? group.name}
                placeholder={group.input?.placeholder ?? 'Enter text...'}
                defaultValue={group.input?.defaultValue}
                disabled={group.input?.disabled}
              />
              {group.suffixAddon && (
                <InputGroupAddon align={group.suffixAddon.align}>
                  {group.suffixAddon.buttonLabel ? (
                    <InputGroupButton size="icon-xs">
                      {group.suffixAddon.buttonLabel}
                    </InputGroupButton>
                  ) : (
                    <XIcon className="size-4" />
                  )}
                </InputGroupAddon>
              )}
            </InputGroup>
            <p className="text-muted-foreground text-xs">State: {group.state}</p>
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="input-group-faker"]')).toBeInTheDocument();
    const inputs = canvasElement.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  },
};

// ============ PREFIX/SUFFIX LOADING STORIES ============

export const PrefixLoading: Story = {
  name: i18n.t('inputGroup.storyName.prefixLoading', 'Prefix Loading State'),
  render: () => (
    <div className="w-full max-w-xl space-y-6" data-testid="input-group-prefix-loading">
      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.loadingPrefix', 'Loading Prefix')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.search', 'Search')}
            placeholder={i18n.t('inputGroup.story.loading', 'Loading...')}
            disabled
          />
        </InputGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="input-group-prefix-loading"]')
    ).toBeInTheDocument();
    const spinner = canvasElement.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  },
};

export const SuffixLoading: Story = {
  name: i18n.t('inputGroup.storyName.suffixLoading', 'Suffix Loading State'),
  render: () => (
    <div className="w-full max-w-xl space-y-6" data-testid="input-group-suffix-loading">
      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.loadingSuffix', 'Loading Suffix')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.search', 'Search')}
            placeholder={i18n.t('inputGroup.story.searching', 'Searching...')}
          />
          <InputGroupAddon align="inline-end">
            <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="input-group-suffix-loading"]')
    ).toBeInTheDocument();
    const spinner = canvasElement.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  },
};

export const PrefixAndSuffixCombinations: Story = {
  name: i18n.t('inputGroup.storyName.prefixAndSuffixCombinations', 'Prefix/Suffix Combinations'),
  render: () => (
    <div className="w-full max-w-xl space-y-6" data-testid="input-group-combinations">
      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.iconPrefixButtonSuffix')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon className="text-muted-foreground size-4" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.search', 'Search')}
            placeholder={i18n.t('inputGroup.story.typeToSearch', 'Type to search...')}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="sm">{i18n.t('inputGroup.story.go', 'Go')}</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.textPrefixIconSuffix', 'Text Prefix + Icon Suffix')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>$</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.amount', 'Amount')}
            type="number"
            placeholder="0.00"
          />
          <InputGroupAddon align="inline-end">
            <span className="text-muted-foreground text-sm">
              {i18n.t('inputGroup.story.usd', 'USD')}
            </span>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.loadingPrefixClearButtonSuffix')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <div className="border-primary size-4 animate-spin rounded-full border-2 border-t-transparent" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.validating', 'Validating')}
            placeholder={i18n.t('inputGroup.story.validating', 'Validating...')}
            defaultValue="user@example.com"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label={i18n.t('inputGroup.story.clear', 'Clear')}
              size="icon-xs"
              variant="ghost"
            >
              <XIcon className="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.keyboardShortcutSuffix', 'Keyboard Shortcut Suffix')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon className="text-muted-foreground size-4" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.commandPalette', 'Command palette')}
            placeholder={i18n.t('inputGroup.story.typeACommand', 'Type a command...')}
          />
          <InputGroupAddon align="inline-end">
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="input-group-combinations"]')
    ).toBeInTheDocument();

    const spinners = canvasElement.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThanOrEqual(1);

    const buttons = canvasElement.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    const kbdGroups = canvasElement.querySelectorAll('[data-slot="kbd-group"]');
    expect(kbdGroups.length).toBe(1);
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('inputGroup.storyName.accessibility', 'Accessibility'),
  render: () => (
    <div className="w-full max-w-xl space-y-6">
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={i18n.t('inputGroup.story.search', 'Search')}
          id="a11y-search"
          placeholder={i18n.t('inputGroup.story.search', 'Search...')}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={i18n.t('inputGroup.story.clearSearch', 'Clear search')}
            id="a11y-clear"
            size="icon-xs"
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Verify search input has proper aria-label
    const searchInput = canvasElement.querySelector('#a11y-search');
    if (!(searchInput instanceof HTMLInputElement)) {
      throw new Error('Search input was not found.');
    }
    expect(searchInput.getAttribute('aria-label')).toBe('Search');

    // Verify clear button has proper aria-label
    const clearButton = canvasElement.querySelector('#a11y-clear');
    if (!(clearButton instanceof HTMLButtonElement)) {
      throw new Error('Clear button was not found.');
    }
    expect(clearButton.getAttribute('aria-label')).toBe('Clear search');

    // Test keyboard navigation - Tab to input
    await userEvent.tab();
    expect(doc.activeElement).toBe(searchInput);

    // Type in the search input
    await userEvent.type(searchInput, 'test query');
    expect(searchInput.value).toBe('test query');

    // Tab to the clear button
    await userEvent.tab();
    expect(doc.activeElement).toBe(clearButton);

    // Verify button is keyboard accessible (Enter key)
    await userEvent.keyboard('{Enter}');

    // Shift+Tab back to input
    await userEvent.tab({ shift: true });
    expect(doc.activeElement).toBe(searchInput);

    // Test focus visibility
    searchInput.focus();
    expect(doc.activeElement).toBe(searchInput);

    // Verify input group container has proper data-slot
    const inputGroup = canvasElement.querySelector('[data-slot="input-group"]');
    expect(inputGroup).toBeInTheDocument();

    // Verify addon click focuses input
    const addon = canvasElement.querySelector(
      '[data-slot="input-group-addon"][data-align="inline-start"]'
    );
    if (addon instanceof HTMLElement) {
      await userEvent.click(addon);
      expect(doc.activeElement).toBe(searchInput);
    }
  },
};

// ============ DARK MODE STORY ============

export const DarkMode: Story = {
  name: i18n.t('inputGroup.storyName.darkMode', 'Dark Mode'),
  globals: {
    theme: 'dark',
  },
  render: () => (
    <div className="w-full max-w-xl space-y-6" data-testid="dark-mode-demo">
      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.searchInputDark', 'Search Input (Dark)')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.search', 'Search')}
            data-testid="dark-search-input"
            placeholder={i18n.t('inputGroup.story.searchInDarkMode', 'Search in dark mode...')}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label={i18n.t('inputGroup.story.clear', 'Clear')}
              size="icon-xs"
              data-testid="dark-clear-btn"
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.urlInputWithPrefixDark', 'URL Input with Prefix (Dark)')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>https://</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.websiteUrl', 'Website URL')}
            data-testid="dark-url-input"
            placeholder={i18n.t('inputGroup.story.exampleDomain', 'example.com')}
          />
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.currencyInputDark', 'Currency Input (Dark)')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>$</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.amount', 'Amount')}
            data-testid="dark-amount-input"
            type="number"
            placeholder="0.00"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{i18n.t('inputGroup.story.usd', 'USD')}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.invalidStateDark', 'Invalid State (Dark)')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-invalid
            aria-label={i18n.t('inputGroup.story.invalidInput', 'Invalid input')}
            data-testid="dark-invalid-input"
            defaultValue="invalid value"
          />
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.withKeyboardShortcutDark', 'With Keyboard Shortcut (Dark)')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.commandPalette', 'Command palette')}
            data-testid="dark-command-input"
            placeholder={i18n.t('inputGroup.story.typeACommand', 'Type a command...')}
          />
          <InputGroupAddon align="inline-end">
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="dark-mode-demo"]')).toBeInTheDocument();

    // Verify all inputs render in dark mode
    const searchInput = canvasElement.querySelector('[data-testid="dark-search-input"]');
    const urlInput = canvasElement.querySelector('[data-testid="dark-url-input"]');
    const amountInput = canvasElement.querySelector('[data-testid="dark-amount-input"]');
    const invalidInput = canvasElement.querySelector('[data-testid="dark-invalid-input"]');
    const commandInput = canvasElement.querySelector('[data-testid="dark-command-input"]');

    expect(searchInput).toBeInTheDocument();
    expect(urlInput).toBeInTheDocument();
    expect(amountInput).toBeInTheDocument();
    expect(invalidInput).toBeInTheDocument();
    expect(commandInput).toBeInTheDocument();

    // Verify invalid input has aria-invalid
    expect(invalidInput?.getAttribute('aria-invalid')).toBe('true');

    // Verify dark mode class is applied to document
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.classList.contains('dark')).toBe(true);
  },
};

export const DarkModeJapanese: Story = {
  name: i18n.t('inputGroup.storyName.darkModeJapanese', 'Dark Mode (Japanese)'),
  globals: {
    theme: 'dark',
    locale: 'ja',
  },
  render: () => <InputGroupDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.classList.contains('dark')).toBe(true);
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(canvasElement);
    expect(canvas.getByText('インラインアドオン')).toBeInTheDocument();
  },
};

// ============ PREFIX/SUFFIX INTERACTION PLAY TESTS ============

export const PrefixInteraction: Story = {
  name: i18n.t('inputGroup.storyName.prefixInteraction', 'Prefix Interaction'),
  render: () => (
    <div className="w-full max-w-xl space-y-6" data-testid="prefix-interaction-demo">
      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.clickPrefixToFocusInput', 'Click prefix to focus input')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start" data-testid="prefix-addon">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.search', 'Search')}
            data-testid="prefix-search-input"
            placeholder={i18n.t('inputGroup.story.clickIconToFocus', 'Click the icon to focus...')}
          />
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.textPrefixInteraction', 'Text prefix interaction')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start" data-testid="text-prefix-addon">
            <InputGroupText>https://</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.websiteUrl', 'Website URL')}
            data-testid="prefix-url-input"
            placeholder={i18n.t('inputGroup.story.exampleDomain', 'example.com')}
          />
        </InputGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Test icon prefix click focuses input
    const prefixAddon = canvasElement.querySelector('[data-testid="prefix-addon"]');
    const searchInput = canvasElement.querySelector(
      '[data-testid="prefix-search-input"]'
    ) as HTMLInputElement;

    expect(prefixAddon).toBeInTheDocument();
    expect(searchInput).toBeInTheDocument();

    if (prefixAddon instanceof HTMLElement) {
      await userEvent.click(prefixAddon);
      expect(doc.activeElement).toBe(searchInput);
    }

    // Type in the input
    await userEvent.type(searchInput, 'test search');
    expect(searchInput.value).toBe('test search');

    // Test text prefix click focuses input
    const textPrefixAddon = canvasElement.querySelector('[data-testid="text-prefix-addon"]');
    const urlInput = canvasElement.querySelector(
      '[data-testid="prefix-url-input"]'
    ) as HTMLInputElement;

    if (textPrefixAddon instanceof HTMLElement) {
      await userEvent.click(textPrefixAddon);
      expect(doc.activeElement).toBe(urlInput);
    }

    await userEvent.type(urlInput, 'example.com');
    expect(urlInput.value).toBe('example.com');
  },
};

function SuffixInteractionDemo() {
  const [inputValue, setInputValue] = React.useState('test value');
  const [clickCount, setClickCount] = React.useState(0);

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="suffix-interaction-demo">
      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.clearButtonSuffix', 'Clear button suffix')}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.search', 'Search')}
            data-testid="suffix-search-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={i18n.t('inputGroup.story.typeSomething', 'Type something...')}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label={i18n.t('inputGroup.story.clear', 'Clear')}
              data-testid="suffix-clear-btn"
              size="icon-xs"
              onClick={() => {
                setInputValue('');
                setClickCount((c) => c + 1);
              }}
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-muted-foreground text-xs" data-testid="click-count">
          Clear button clicks: {clickCount}
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.actionButtonSuffix', 'Action button suffix')}
        </div>
        <InputGroup>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.email', 'Email')}
            data-testid="suffix-email-input"
            type="email"
            placeholder={i18n.t('inputGroup.story.enterEmail', 'Enter email')}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton data-testid="suffix-submit-btn" size="sm">
              Subscribe
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  );
}

export const SuffixInteraction: Story = {
  name: i18n.t('inputGroup.storyName.suffixInteraction', 'Suffix Interaction'),
  render: () => <SuffixInteractionDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Verify initial state
    const searchInput = canvasElement.querySelector(
      '[data-testid="suffix-search-input"]'
    ) as HTMLInputElement;
    const clearBtn = canvasElement.querySelector('[data-testid="suffix-clear-btn"]');

    expect(searchInput).toBeInTheDocument();
    expect(clearBtn).toBeInTheDocument();
    expect(searchInput.value).toBe('test value');

    // Click clear button
    if (clearBtn instanceof HTMLButtonElement) {
      await userEvent.click(clearBtn);
      expect(searchInput.value).toBe('');
    }

    // Verify click count updated
    expect(canvasElement.textContent).toContain('Clear button clicks: 1');

    // Test keyboard interaction with suffix button
    const emailInput = canvasElement.querySelector(
      '[data-testid="suffix-email-input"]'
    ) as HTMLInputElement;
    const submitBtn = canvasElement.querySelector('[data-testid="suffix-submit-btn"]');

    // Tab to email input
    await userEvent.click(emailInput);
    expect(doc.activeElement).toBe(emailInput);

    // Type email
    await userEvent.type(emailInput, 'user@example.com');
    expect(emailInput.value).toBe('user@example.com');

    // Tab to submit button
    await userEvent.tab();
    expect(doc.activeElement).toBe(submitBtn);

    // Press Enter on submit button
    await userEvent.keyboard('{Enter}');
  },
};

function PrefixSuffixCombinedDemo() {
  const [amount, setAmount] = React.useState('');
  const [currency, setCurrency] = React.useState('USD');

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="combined-demo">
      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t(
            'inputGroup.story.currencyInputWithSelectPrefixAndTextSuff',
            'Currency input with select prefix and text suffix'
          )}
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <select
              aria-label={i18n.t('inputGroup.story.currency', 'Currency')}
              data-testid="currency-select"
              className="h-full border-0 bg-transparent text-sm focus:outline-none"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="USD">{i18n.t('inputGroup.story.usd', 'USD')}</option>
              <option value="EUR">{i18n.t('inputGroup.story.eur', 'EUR')}</option>
              <option value="GBP">{i18n.t('inputGroup.story.gbp', 'GBP')}</option>
              <option value="JPY">{i18n.t('inputGroup.story.jpy', 'JPY')}</option>
            </select>
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.amount', 'Amount')}
            data-testid="amount-input"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText data-testid="currency-suffix">{currency}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-muted-foreground text-xs" data-testid="amount-display">
          Amount: {amount || '0.00'} {currency}
        </p>
      </div>
    </div>
  );
}

export const PrefixSuffixCombined: Story = {
  name: i18n.t('inputGroup.storyName.prefixSuffixCombined', 'Prefix + Suffix Combined'),
  render: () => <PrefixSuffixCombinedDemo />,
  play: async ({ canvasElement }) => {
    const currencySelect = canvasElement.querySelector(
      '[data-testid="currency-select"]'
    ) as HTMLSelectElement;
    const amountInput = canvasElement.querySelector(
      '[data-testid="amount-input"]'
    ) as HTMLInputElement;
    const currencySuffix = canvasElement.querySelector('[data-testid="currency-suffix"]');

    expect(currencySelect).toBeInTheDocument();
    expect(amountInput).toBeInTheDocument();
    expect(currencySuffix).toBeInTheDocument();

    // Verify initial currency
    expect(currencySelect.value).toBe('USD');
    expect(currencySuffix?.textContent).toBe('USD');

    // Change currency
    await userEvent.selectOptions(currencySelect, 'EUR');
    expect(currencySelect.value).toBe('EUR');
    expect(currencySuffix?.textContent).toBe('EUR');

    // Enter amount
    await userEvent.click(amountInput);
    await userEvent.type(amountInput, '100.50');
    expect(amountInput.value).toBe('100.50');

    // Verify display updates
    expect(canvasElement.textContent).toContain('Amount: 100.50 EUR');
  },
};

// ============ ADDON ACCESSIBILITY STORIES ============

export const AddonAccessibility: Story = {
  name: i18n.t('inputGroup.storyName.addonAccessibility', 'Addon Accessibility'),
  render: () => (
    <div className="w-full max-w-xl space-y-6" data-testid="addon-a11y-demo">
      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.iconAddonWithAriahidden', 'Icon addon with aria-hidden')}
        </div>
        <InputGroup aria-label={i18n.t('inputGroup.story.searchInputGroup', 'Search input group')}>
          <InputGroupAddon align="inline-start">
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.search', 'Search')}
            data-testid="a11y-search-input"
            placeholder={i18n.t('inputGroup.story.iconsAreDecorative', 'Icons are decorative...')}
          />
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.buttonAddonWithArialabel', 'Button addon with aria-label')}
        </div>
        <InputGroup aria-label={i18n.t('inputGroup.story.searchWithClear', 'Search with clear')}>
          <InputGroupAddon align="inline-start">
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.searchQuery', 'Search query')}
            data-testid="a11y-query-input"
            placeholder={i18n.t('inputGroup.story.typeToSearch', 'Type to search...')}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label={i18n.t('inputGroup.story.clearSearchQuery', 'Clear search query')}
              data-testid="a11y-clear-btn"
              size="icon-xs"
            >
              <XIcon aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t(
            'inputGroup.story.textAddonWithSemanticMeaning',
            'Text addon with semantic meaning'
          )}
        </div>
        <InputGroup
          aria-label={i18n.t(
            'inputGroup.story.priceInputWithCurrency',
            'Price input with currency'
          )}
        >
          <InputGroupAddon align="inline-start">
            <InputGroupText
              aria-label={i18n.t('inputGroup.story.currencySymbol', 'Currency symbol')}
            >
              $
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.priceInUsDollars', 'Price in US dollars')}
            data-testid="a11y-price-input"
            type="number"
            placeholder="0.00"
            min="0"
            step="0.01"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText aria-label={i18n.t('inputGroup.story.currencyCode', 'Currency code')}>
              USD
            </InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t('inputGroup.story.disabledStateAccessibility', 'Disabled state accessibility')}
        </div>
        <InputGroup
          aria-label={i18n.t('inputGroup.story.disabledSearch', 'Disabled search')}
          data-disabled="true"
        >
          <InputGroupAddon align="inline-start">
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.disabledSearchInput', 'Disabled search input')}
            aria-disabled="true"
            data-testid="a11y-disabled-input"
            placeholder={i18n.t('inputGroup.story.thisInputIsDisabled', 'This input is disabled')}
            disabled
          />
        </InputGroup>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">
          {i18n.t(
            'inputGroup.story.errorStateWithAriadescribedby',
            'Error state with aria-describedby'
          )}
        </div>
        <InputGroup aria-label={i18n.t('inputGroup.story.emailWithError', 'Email with error')}>
          <InputGroupAddon align="inline-start">
            <InputGroupText>@</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label={i18n.t('inputGroup.story.emailAddress', 'Email address')}
            aria-invalid="true"
            aria-describedby="email-error"
            data-testid="a11y-error-input"
            defaultValue="invalid-email"
          />
        </InputGroup>
        <p id="email-error" className="text-destructive text-sm" role="alert">
          Please enter a valid email address
        </p>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Verify all inputs have aria-label
    const inputs = canvasElement.querySelectorAll('input[aria-label]');
    expect(inputs.length).toBeGreaterThanOrEqual(5);

    // Verify icon buttons have aria-label
    const clearBtn = canvasElement.querySelector('[data-testid="a11y-clear-btn"]');
    expect(clearBtn?.getAttribute('aria-label')).toBe('Clear search query');

    // Verify disabled input has proper attributes
    const disabledInput = canvasElement.querySelector('[data-testid="a11y-disabled-input"]');
    expect(disabledInput?.getAttribute('aria-disabled')).toBe('true');
    expect(disabledInput).toBeDisabled();

    // Verify error input has aria-describedby
    const errorInput = canvasElement.querySelector('[data-testid="a11y-error-input"]');
    expect(errorInput?.getAttribute('aria-invalid')).toBe('true');
    expect(errorInput?.getAttribute('aria-describedby')).toBe('email-error');

    // Verify error message exists and has role="alert"
    const errorMessage = canvasElement.querySelector('#email-error');
    expect(errorMessage?.getAttribute('role')).toBe('alert');

    // Test keyboard navigation through all inputs
    const searchInput = canvasElement.querySelector('[data-testid="a11y-search-input"]');
    await userEvent.click(searchInput as HTMLElement);
    expect(doc.activeElement).toBe(searchInput);

    // Tab through to clear button
    await userEvent.tab();
    await userEvent.tab();
    expect(doc.activeElement).toBe(clearBtn);

    // Verify button is keyboard accessible
    await userEvent.keyboard(' ');
  },
};

// ============ KEYBOARD NAVIGATION STORY ============

export const KeyboardNavigation: Story = {
  name: i18n.t('inputGroup.storyName.keyboardNavigation', 'Keyboard Navigation'),
  render: () => (
    <div className="w-full max-w-xl space-y-6" data-testid="keyboard-nav-demo">
      <p className="text-muted-foreground text-sm">
        Press Tab to navigate between focusable elements. Press Enter or Space to activate buttons.
      </p>

      <InputGroup>
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={i18n.t('inputGroup.story.firstInput', 'First input')}
          data-testid="kb-input-1"
          placeholder={i18n.t('inputGroup.story.firstInputTab', 'First input (Tab here first)')}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={i18n.t('inputGroup.story.clearFirst', 'Clear first')}
            data-testid="kb-btn-1"
            size="icon-xs"
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText>$</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          aria-label={i18n.t('inputGroup.story.secondInput', 'Second input')}
          data-testid="kb-input-2"
          type="number"
          placeholder={i18n.t('inputGroup.story.secondInput', 'Second input')}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton data-testid="kb-btn-2" size="sm">
            {i18n.t('inputGroup.story.submit', 'Submit')}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupInput
          aria-label={i18n.t('inputGroup.story.thirdInput', 'Third input')}
          data-testid="kb-input-3"
          placeholder={i18n.t('inputGroup.story.thirdInput', 'Third input (no prefix)')}
        />
        <InputGroupAddon align="inline-end">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    const input1 = canvasElement.querySelector('[data-testid="kb-input-1"]') as HTMLInputElement;
    const btn1 = canvasElement.querySelector('[data-testid="kb-btn-1"]') as HTMLButtonElement;
    const input2 = canvasElement.querySelector('[data-testid="kb-input-2"]') as HTMLInputElement;
    const btn2 = canvasElement.querySelector('[data-testid="kb-btn-2"]') as HTMLButtonElement;
    const input3 = canvasElement.querySelector('[data-testid="kb-input-3"]') as HTMLInputElement;

    // Tab to first input
    await userEvent.tab();
    expect(doc.activeElement).toBe(input1);

    // Type in first input
    await userEvent.type(input1, 'test');
    expect(input1.value).toBe('test');

    // Tab to first button
    await userEvent.tab();
    expect(doc.activeElement).toBe(btn1);

    // Press Enter on button
    await userEvent.keyboard('{Enter}');

    // Tab to second input
    await userEvent.tab();
    expect(doc.activeElement).toBe(input2);

    // Tab to second button
    await userEvent.tab();
    expect(doc.activeElement).toBe(btn2);

    // Press Space on button
    await userEvent.keyboard(' ');

    // Tab to third input
    await userEvent.tab();
    expect(doc.activeElement).toBe(input3);

    // Shift+Tab back through all elements
    await userEvent.tab({ shift: true });
    expect(doc.activeElement).toBe(btn2);

    await userEvent.tab({ shift: true });
    expect(doc.activeElement).toBe(input2);
  },
};

// ============ FACTORY: ICON MAP HELPER ============

const ICON_MAP: Record<InputGroupIconName, React.ComponentType<{ className?: string }>> = {
  Check: CheckIcon,
  ChevronDown: ChevronDownIcon,
  Copy: CopyIcon,
  Eye: EyeIcon,
  EyeOff: EyeOffIcon,
  Globe: GlobeIcon,
  Mail: MailIcon,
  Phone: PhoneIcon,
  Search: SearchIcon,
  X: XIcon,
};

function renderAddon(addon: FakeInputGroupAddon | undefined) {
  if (!addon) return null;
  const Icon = addon.iconName ? ICON_MAP[addon.iconName] : null;

  return (
    <InputGroupAddon align={addon.align}>
      {addon.contentType === 'icon' && Icon && <Icon className="size-4" />}
      {addon.contentType === 'text' && <InputGroupText>{addon.text}</InputGroupText>}
      {addon.contentType === 'button' && (
        <InputGroupButton
          aria-label={addon.buttonAriaLabel ?? addon.buttonLabel}
          size={(addon.buttonSize ?? 'icon-xs') as 'icon-xs' | 'icon-sm' | 'sm' | 'xs'}
        >
          {Icon ? <Icon className="size-4" /> : addon.buttonLabel}
        </InputGroupButton>
      )}
      {addon.contentType === 'kbd' && addon.shortcuts && (
        <KbdGroup>
          {addon.shortcuts.filter(Boolean).map((k) => (
            <Kbd key={k}>{k}</Kbd>
          ))}
        </KbdGroup>
      )}
      {addon.contentType === 'select' && addon.selectOptions && (
        <select
          aria-label={i18n.t('inputGroup.story.select', 'Select')}
          className="h-full border-0 bg-transparent text-sm focus:outline-none"
          defaultValue={addon.selectedValue}
        >
          {addon.selectOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {addon.contentType === 'loading' && (
        <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
    </InputGroupAddon>
  );
}

function renderFakeGroup(group: FakeInputGroup) {
  return (
    <div key={group.id} className="space-y-2">
      <div className="text-sm font-medium">{group.name}</div>
      {group.description && <p className="text-muted-foreground text-xs">{group.description}</p>}
      <InputGroup>
        {renderAddon(group.prefixAddon)}
        {group.textarea ? (
          <InputGroupTextarea
            aria-label={group.textarea.ariaLabel}
            defaultValue={group.textarea.defaultValue}
            disabled={group.textarea.disabled}
            placeholder={group.textarea.placeholder}
            rows={group.textarea.rows}
          />
        ) : (
          <InputGroupInput
            aria-invalid={group.input?.ariaInvalid || undefined}
            aria-label={group.input?.ariaLabel ?? group.name}
            defaultValue={group.input?.defaultValue}
            disabled={group.input?.disabled}
            placeholder={group.input?.placeholder ?? 'Enter text...'}
            type={group.input?.type}
          />
        )}
        {renderAddon(group.suffixAddon)}
      </InputGroup>
    </div>
  );
}

// ============ FACTORY: createFakeInputGroup ============

function FactoryInputGroupDemo() {
  const { t } = useTranslation();
  const group: FakeInputGroup = createFakeInputGroup();

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-input-group">
      <div className="text-sm font-medium">
        {t('inputGroup.section.inlineAddons')}: {group.name}
      </div>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryInputGroup: Story = {
  name: i18n.t('inputGroup.storyName.factoryInputGroup', 'Factory: createFakeInputGroup'),
  render: () => <FactoryInputGroupDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-input-group"]')).toBeInTheDocument();
    const inputGroup = canvasElement.querySelector('[data-slot="input-group"]');
    expect(inputGroup).toBeInTheDocument();
    const control = canvasElement.querySelector('[data-slot="input-group-control"]');
    expect(control).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSearchInputGroup ============

function FactorySearchDemo() {
  const group: FakeSearchInputGroup = createFakeSearchInputGroup();

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-search">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.search.ariaLabel')}: {group.name}
      </div>
      {renderFakeGroup(group)}
      <p className="text-muted-foreground text-xs">
        Query: &quot;{group.query}&quot; | Searching: {String(group.isSearching)} | Clear:{' '}
        {String(group.showClearButton)}
      </p>
    </div>
  );
}

export const FactorySearch: Story = {
  name: i18n.t('inputGroup.storyName.factorySearch', 'Factory: createFakeSearchInputGroup'),
  render: () => <FactorySearchDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-search"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="input-group"]')).toBeInTheDocument();
    expect(canvasElement.textContent).toContain('Query:');
    expect(canvasElement.textContent).toContain('Searching:');
  },
};

// ============ FACTORY: createFakeUrlInputGroup ============

function FactoryUrlDemo() {
  const { t } = useTranslation();
  const group: FakeUrlInputGroup = createFakeUrlInputGroup();

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-url">
      <div className="text-sm font-medium">
        {t('inputGroup.dark.urlPlaceholder')}: {group.name}
      </div>
      {renderFakeGroup(group)}
      <p className="text-muted-foreground text-xs">
        Protocol: {group.protocol} | Domain: {group.domain} | Valid: {String(group.isValid)}
      </p>
    </div>
  );
}

export const FactoryUrl: Story = {
  name: i18n.t('inputGroup.storyName.factoryUrl', 'Factory: createFakeUrlInputGroup'),
  render: () => <FactoryUrlDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-url"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="input-group"]')).toBeInTheDocument();
    expect(canvasElement.textContent).toContain('Protocol:');
    expect(canvasElement.textContent).toContain('Domain:');
  },
};

// ============ FACTORY: createFakeCurrencyInputGroup ============

function FactoryCurrencyDemo() {
  const { t } = useTranslation();
  const group: FakeCurrencyInputGroup = createFakeCurrencyInputGroup();

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-currency">
      <div className="text-sm font-medium">
        {t('inputGroup.dark.amountPlaceholder')}: {group.name}
      </div>
      {renderFakeGroup(group)}
      <p className="text-muted-foreground text-xs">
        Amount: {group.amount.toFixed(group.decimals)} {group.currency} | Selector:{' '}
        {String(group.showCurrencySelector)}
      </p>
    </div>
  );
}

export const FactoryCurrency: Story = {
  name: i18n.t('inputGroup.storyName.factoryCurrency', 'Factory: createFakeCurrencyInputGroup'),
  render: () => <FactoryCurrencyDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-currency"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="input-group"]')).toBeInTheDocument();
    expect(canvasElement.textContent).toContain('Amount:');
  },
};

// ============ FACTORY: createFakePhoneInputGroup ============

function FactoryPhoneDemo() {
  const { t } = useTranslation();
  const group: FakePhoneInputGroup = createFakePhoneInputGroup();

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-phone">
      <div className="text-sm font-medium">
        {t('inputGroup.button.submit')}: {group.name}
      </div>
      {renderFakeGroup(group)}
      <p className="text-muted-foreground text-xs">
        Code: {group.countryCode} | Number: {group.phoneNumber}
      </p>
    </div>
  );
}

export const FactoryPhone: Story = {
  name: i18n.t('inputGroup.storyName.factoryPhone', 'Factory: createFakePhoneInputGroup'),
  render: () => <FactoryPhoneDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-phone"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="input-group"]')).toBeInTheDocument();
    expect(canvasElement.textContent).toContain('Code:');
    expect(canvasElement.textContent).toContain('Number:');
  },
};

// ============ FACTORY: createFakeCommandInputGroup ============

function FactoryCommandDemo() {
  const { t } = useTranslation();
  const group: FakeCommandInputGroup = createFakeCommandInputGroup();

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-command">
      <div className="text-sm font-medium">
        {t('inputGroup.command.label')}: {group.name}
      </div>
      {renderFakeGroup(group)}
      <p className="text-muted-foreground text-xs">
        Prefix: {group.prefix} | Command: &quot;{group.command}&quot; | Mode:{' '}
        {String(group.isCommandMode)}
      </p>
    </div>
  );
}

export const FactoryCommand: Story = {
  name: i18n.t('inputGroup.storyName.factoryCommand', 'Factory: createFakeCommandInputGroup'),
  render: () => <FactoryCommandDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-command"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="input-group"]')).toBeInTheDocument();
    expect(canvasElement.textContent).toContain('Prefix:');
    expect(canvasElement.textContent).toContain('Command:');
  },
};

// ============ FACTORY: createFakeEmailInputGroup ============

function FactoryEmailDemo() {
  const { t } = useTranslation();
  const group: FakeEmailInputGroup = createFakeEmailInputGroup();

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-email">
      <div className="text-sm font-medium">
        {t('inputGroup.button.subscribe')}: {group.name}
      </div>
      {renderFakeGroup(group)}
      <p className="text-muted-foreground text-xs">
        Email: {group.email} | Verified: {String(group.isVerified)} | Show Verify:{' '}
        {String(group.showVerifyButton)}
      </p>
    </div>
  );
}

export const FactoryEmail: Story = {
  name: i18n.t('inputGroup.storyName.factoryEmail', 'Factory: createFakeEmailInputGroup'),
  render: () => <FactoryEmailDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-email"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="input-group"]')).toBeInTheDocument();
    expect(canvasElement.textContent).toContain('Email:');
    expect(canvasElement.textContent).toContain('Verified:');
  },
};

// ============ FACTORY: createFakePasswordInputGroup ============

function FactoryPasswordDemo() {
  const { t } = useTranslation();
  const group: FakePasswordInputGroup = createFakePasswordInputGroup();

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-password">
      <div className="text-sm font-medium">
        {t('inputGroup.section.inlineAddons')}: {group.name}
      </div>
      {renderFakeGroup(group)}
      <p className="text-muted-foreground text-xs">
        Visible: {String(group.isVisible)} | Strength: {group.strength}/100 | Indicator:{' '}
        {String(group.showStrengthIndicator)}
      </p>
    </div>
  );
}

export const FactoryPassword: Story = {
  name: i18n.t('inputGroup.storyName.factoryPassword', 'Factory: createFakePasswordInputGroup'),
  render: () => <FactoryPasswordDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-password"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="input-group"]')).toBeInTheDocument();
    expect(canvasElement.textContent).toContain('Strength:');
    expect(canvasElement.textContent).toContain('Visible:');
  },
};

// ============ FACTORY: createFakeTextareaInputGroup ============

function FactoryTextareaDemo() {
  const { t } = useTranslation();
  const group: FakeInputGroup = createFakeTextareaInputGroup();

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-textarea">
      <div className="text-sm font-medium">
        {t('inputGroup.section.textareaBlockAddon')}: {group.name}
      </div>
      {renderFakeGroup(group)}
    </div>
  );
}

export const FactoryTextarea: Story = {
  name: i18n.t('inputGroup.storyName.factoryTextarea', 'Factory: createFakeTextareaInputGroup'),
  render: () => <FactoryTextareaDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-textarea"]')).toBeInTheDocument();
    const textarea = canvasElement.querySelector('textarea');
    expect(textarea).toBeInTheDocument();
    if (textarea) {
      await userEvent.type(textarea, 'test text');
      expect(textarea.value).toContain('test text');
    }
  },
};

// ============ FACTORY: createFakeInputGroupAlignmentMatrix ============

function FactoryAlignmentMatrixDemo() {
  const matrix: FakeInputGroup[][] = createFakeInputGroupAlignmentMatrix();
  const _aligns: InputGroupAddonAlign[] = INPUT_GROUP_ADDON_ALIGNS;

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="factory-alignment-matrix">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.section.inlineAddons')}: Alignment Matrix ({_aligns.length} aligns)
      </div>
      {matrix.flat().map((group) => renderFakeGroup(group))}
    </div>
  );
}

export const FactoryAlignmentMatrix: Story = {
  name: i18n.t('inputGroup.storyName.factoryAlignmentMatrix', 'Factory: Alignment Matrix'),
  render: () => <FactoryAlignmentMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-alignment-matrix"]')
    ).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(groups.length).toBeGreaterThanOrEqual(2);
  },
};

// ============ FACTORY: createFakeInputGroupButtonSizeMatrix ============

function FactoryButtonSizeMatrixDemo() {
  const items: FakeInputGroup[] = createFakeInputGroupButtonSizeMatrix();
  const _sizes: InputGroupButtonSize[] = INPUT_GROUP_BUTTON_SIZES;

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="factory-button-size-matrix">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.button.go')}: Button Sizes ({_sizes.length})
      </div>
      {items.map((group) => renderFakeGroup(group))}
    </div>
  );
}

export const FactoryButtonSizeMatrix: Story = {
  name: i18n.t('inputGroup.storyName.factoryButtonSizeMatrix', 'Factory: Button Size Matrix'),
  render: () => <FactoryButtonSizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-button-size-matrix"]')
    ).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(groups.length).toBe(INPUT_GROUP_BUTTON_SIZES.length);
  },
};

// ============ FACTORY: createFakeInputGroupStateMatrix ============

function FactoryStateMatrixDemo() {
  const items: FakeInputGroup[] = createFakeInputGroupStateMatrix();
  const _states: InputGroupState[] = INPUT_GROUP_STATES;

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="factory-state-matrix">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.section.invalid')}: States ({_states.length})
      </div>
      {items.map((group) => renderFakeGroup(group))}
    </div>
  );
}

export const FactoryStateMatrix: Story = {
  name: i18n.t('inputGroup.storyName.factoryStateMatrix', 'Factory: State Matrix'),
  render: () => <FactoryStateMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-state-matrix"]')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(groups.length).toBe(INPUT_GROUP_STATES.length);
  },
};

// ============ FACTORY: createFakeInputGroupContentTypeMatrix ============

function FactoryContentTypeMatrixDemo() {
  const items: FakeInputGroup[] = createFakeInputGroupContentTypeMatrix();
  const _types: InputGroupAddonContentType[] = INPUT_GROUP_ADDON_CONTENT_TYPES;

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="factory-content-type-matrix">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.section.helperShortcut')}: Content Types ({_types.length})
      </div>
      {items.map((group) => renderFakeGroup(group))}
    </div>
  );
}

export const FactoryContentTypeMatrix: Story = {
  name: i18n.t('inputGroup.storyName.factoryContentTypeMatrix', 'Factory: Content Type Matrix'),
  render: () => <FactoryContentTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-content-type-matrix"]')
    ).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(groups.length).toBe(INPUT_GROUP_ADDON_CONTENT_TYPES.length);
  },
};

// ============ FACTORY: createFakeInputGroupInputTypeMatrix ============

function FactoryInputTypeMatrixDemo() {
  const items: FakeInputGroup[] = createFakeInputGroupInputTypeMatrix();
  const _inputTypes: InputGroupInputType[] = INPUT_GROUP_INPUT_TYPES;

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="factory-input-type-matrix">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.section.inlineAddons')}: Input Types ({_inputTypes.length})
      </div>
      {items.map((group) => renderFakeGroup(group))}
    </div>
  );
}

export const FactoryInputTypeMatrix: Story = {
  name: i18n.t('inputGroup.storyName.factoryInputTypeMatrix', 'Factory: Input Type Matrix'),
  render: () => <FactoryInputTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-input-type-matrix"]')
    ).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(groups.length).toBe(INPUT_GROUP_INPUT_TYPES.length);
  },
};

// ============ FACTORY: createFakeInputGroupShowcase ============

function FactoryShowcaseDemo() {
  const showcase: Record<string, FakeInputGroup> = createFakeInputGroupShowcase();
  const entries = Object.entries(showcase);

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="factory-showcase">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.section.inlineAddons')}: Showcase ({entries.length} variants)
      </div>
      {entries.map(([key, group]) => (
        <div key={key}>{renderFakeGroup(group)}</div>
      ))}
    </div>
  );
}

export const FactoryShowcase: Story = {
  name: i18n.t('inputGroup.storyName.factoryShowcase', 'Factory: Showcase'),
  render: () => <FactoryShowcaseDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-showcase"]')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(groups.length).toBeGreaterThanOrEqual(15);
  },
};

// ============ FACTORY: createFakeRegistrationInputGroups ============

function FactoryRegistrationDemo() {
  const groups: FakeInputGroup[] = createFakeRegistrationInputGroups();

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="factory-registration">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.button.subscribe')}: Registration Form ({groups.length} fields)
      </div>
      {groups.map((group) => renderFakeGroup(group))}
    </div>
  );
}

export const FactoryRegistration: Story = {
  name: i18n.t('inputGroup.storyName.factoryRegistration', 'Factory: Registration Form'),
  render: () => <FactoryRegistrationDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-registration"]')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(groups.length).toBe(5);
  },
};

// ============ FACTORY: createFakeContactInputGroups ============

function FactoryContactDemo() {
  const groups: FakeInputGroup[] = createFakeContactInputGroups();

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="factory-contact">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.button.submit')}: Contact Form ({groups.length} fields)
      </div>
      {groups.map((group) => renderFakeGroup(group))}
    </div>
  );
}

export const FactoryContact: Story = {
  name: i18n.t('inputGroup.storyName.factoryContact', 'Factory: Contact Form'),
  render: () => <FactoryContactDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-contact"]')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(groups.length).toBe(5);
    // Contact form includes a textarea
    const textarea = canvasElement.querySelector('textarea');
    expect(textarea).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSearchFormInputGroups ============

function FactorySearchFormDemo() {
  const groups: FakeInputGroup[] = createFakeSearchFormInputGroups();

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="factory-search-form">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.search.ariaLabel')}: Search Form ({groups.length} fields)
      </div>
      {groups.map((group) => renderFakeGroup(group))}
    </div>
  );
}

export const FactorySearchForm: Story = {
  name: i18n.t('inputGroup.storyName.factorySearchForm', 'Factory: Search Form'),
  render: () => <FactorySearchFormDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-search-form"]')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(groups.length).toBe(3);
  },
};

// ============ FACTORY: createFakePaymentInputGroups ============

function FactoryPaymentDemo() {
  const groups: FakeInputGroup[] = createFakePaymentInputGroups();

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="factory-payment">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.dark.amountPlaceholder')}: Payment Form ({groups.length} fields)
      </div>
      {groups.map((group) => renderFakeGroup(group))}
    </div>
  );
}

export const FactoryPayment: Story = {
  name: i18n.t('inputGroup.storyName.factoryPayment', 'Factory: Payment Form'),
  render: () => <FactoryPaymentDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-payment"]')).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(groups.length).toBe(4);
  },
};

// ============ FACTORY: Enterprise Validating ============

function FactoryEnterpriseValidatingDemo() {
  const group: FakeEnterpriseInputGroup = createFakeEnterpriseValidatingInputGroup();

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-enterprise-validating">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.error.invalidEmail')}: {group.name}
      </div>
      {renderFakeGroup(group)}
      <p className="text-muted-foreground text-xs">
        Validation: {String(group.hasRealTimeValidation)} | Debounce: {group.debounceMs}ms |
        Tracking: {group.trackingId}
      </p>
    </div>
  );
}

export const FactoryEnterpriseValidating: Story = {
  name: i18n.t(
    'inputGroup.storyName.factoryEnterpriseValidating',
    'Factory: Enterprise Validating'
  ),
  render: () => <FactoryEnterpriseValidatingDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-enterprise-validating"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="input-group"]')).toBeInTheDocument();
    expect(canvasElement.textContent).toContain('Validation:');
    expect(canvasElement.textContent).toContain('Debounce:');
  },
};

// ============ FACTORY: Enterprise Character Count ============

function FactoryEnterpriseCharCountDemo() {
  const { t } = useTranslation();
  const group: FakeEnterpriseInputGroup = createFakeEnterpriseCharacterCountInputGroup(280);

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-enterprise-charcount">
      <div className="text-sm font-medium">
        {t('inputGroup.command.placeholder')}: {group.name}
      </div>
      {renderFakeGroup(group)}
      <p className="text-muted-foreground text-xs">
        Characters: {group.currentCharacters}/{group.maxCharacters} | Show Count:{' '}
        {String(group.showCharacterCount)}
      </p>
    </div>
  );
}

export const FactoryEnterpriseCharCount: Story = {
  name: i18n.t(
    'inputGroup.storyName.factoryEnterpriseCharCount',
    'Factory: Enterprise Character Count'
  ),
  render: () => <FactoryEnterpriseCharCountDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-enterprise-charcount"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="input-group"]')).toBeInTheDocument();
    expect(canvasElement.textContent).toContain('Characters:');
  },
};

// ============ FACTORY: Enterprise Autocomplete ============

function FactoryEnterpriseAutocompleteDemo() {
  const { t } = useTranslation();
  const group: FakeEnterpriseInputGroup = createFakeEnterpriseAutocompleteInputGroup();

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-enterprise-autocomplete">
      <div className="text-sm font-medium">
        {t('inputGroup.search.placeholder')}: {group.name}
      </div>
      {renderFakeGroup(group)}
      <p className="text-muted-foreground text-xs">
        Autocomplete: {String(group.hasAutocomplete)} | Delay: {group.autocompleteDelayMs}ms |
        Debounce: {group.debounceMs}ms
      </p>
    </div>
  );
}

export const FactoryEnterpriseAutocomplete: Story = {
  name: i18n.t(
    'inputGroup.storyName.factoryEnterpriseAutocomplete',
    'Factory: Enterprise Autocomplete'
  ),
  render: () => <FactoryEnterpriseAutocompleteDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-enterprise-autocomplete"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="input-group"]')).toBeInTheDocument();
    expect(canvasElement.textContent).toContain('Autocomplete:');
    expect(canvasElement.textContent).toContain('Delay:');
  },
};

// ============ FACTORY: Enterprise Loading ============

function FactoryEnterpriseLoadingDemo() {
  const { t } = useTranslation();
  const group: FakeEnterpriseInputGroup = createFakeEnterpriseLoadingInputGroup();

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-enterprise-loading">
      <div className="text-sm font-medium">
        {t('inputGroup.section.helperShortcut')}: {group.name}
      </div>
      {renderFakeGroup(group)}
      <p className="text-muted-foreground text-xs">
        Loading Addon: {String(group.showAddonLoading)} | Test ID: {group.testId}
      </p>
    </div>
  );
}

export const FactoryEnterpriseLoading: Story = {
  name: i18n.t('inputGroup.storyName.factoryEnterpriseLoading', 'Factory: Enterprise Loading'),
  render: () => <FactoryEnterpriseLoadingDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-enterprise-loading"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="input-group"]')).toBeInTheDocument();
    expect(canvasElement.textContent).toContain('Loading Addon:');
  },
};

// ============ FACTORY: Enterprise Set ============

function FactoryEnterpriseSetDemo() {
  const { t } = useTranslation();
  const groups: FakeEnterpriseInputGroup[] = createFakeEnterpriseInputGroupSet();

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="factory-enterprise-set">
      <div className="text-sm font-medium">
        {t('inputGroup.section.inlineAddons')}: Enterprise Set ({groups.length})
      </div>
      {groups.map((group) => (
        <div key={group.id}>
          {renderFakeGroup(group)}
          <p className="text-muted-foreground text-xs">Test ID: {group.testId}</p>
        </div>
      ))}
    </div>
  );
}

export const FactoryEnterpriseSet: Story = {
  name: i18n.t('inputGroup.storyName.factoryEnterpriseSet', 'Factory: Enterprise Set'),
  render: () => <FactoryEnterpriseSetDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-enterprise-set"]')
    ).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(groups.length).toBe(4);
  },
};

// ============ FACTORY: Accessible Input Group ============

function FactoryAccessibleDemo() {
  const group: FakeAccessibleInputGroup = createFakeAccessibleInputGroup();

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-accessible">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.a11y.prefixIcon')}: {group.name}
      </div>
      {renderFakeGroup(group)}
      {group.helpText && (
        <p className="text-muted-foreground text-xs" id={group.ariaDescribedBy}>
          {group.helpText}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Live Region: {group.liveRegionPoliteness} | Icons Hidden: {String(group.hideIconsFromAria)}
      </p>
    </div>
  );
}

export const FactoryAccessible: Story = {
  name: i18n.t('inputGroup.storyName.factoryAccessible', 'Factory: Accessible Input Group'),
  render: () => <FactoryAccessibleDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-accessible"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="input-group"]')).toBeInTheDocument();
    expect(canvasElement.textContent).toContain('Live Region:');
  },
};

// ============ FACTORY: Accessible Error Input Group ============

function FactoryAccessibleErrorDemo() {
  const { t } = useTranslation();
  const group: FakeAccessibleInputGroup = createFakeAccessibleErrorInputGroup(
    t('inputGroup.error.invalidEmail')
  );

  return (
    <div className="w-full max-w-xl space-y-4" data-testid="factory-accessible-error">
      <div className="text-sm font-medium">
        {t('inputGroup.section.invalid')}: {group.name}
      </div>
      {renderFakeGroup(group)}
      {group.errorText && (
        <p className="text-destructive text-sm" id={group.ariaErrorMessage} role="alert">
          {group.errorText}
        </p>
      )}
    </div>
  );
}

export const FactoryAccessibleError: Story = {
  name: i18n.t('inputGroup.storyName.factoryAccessibleError', 'Factory: Accessible Error'),
  render: () => <FactoryAccessibleErrorDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-accessible-error"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="input-group"]')).toBeInTheDocument();
    const alert = canvasElement.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
  },
};

// ============ FACTORY: Accessible Set ============

function FactoryAccessibleSetDemo() {
  const groups: FakeAccessibleInputGroup[] = createFakeAccessibleInputGroupSet();

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="factory-accessible-set">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.a11y.clearSearch')}: A11y Set ({groups.length})
      </div>
      {groups.map((group) => (
        <div key={group.id}>
          {renderFakeGroup(group)}
          {group.helpText && <p className="text-muted-foreground text-xs">{group.helpText}</p>}
          {group.errorText && (
            <p className="text-destructive text-xs" role="alert">
              {group.errorText}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export const FactoryAccessibleSet: Story = {
  name: i18n.t('inputGroup.storyName.factoryAccessibleSet', 'Factory: Accessible Set'),
  render: () => <FactoryAccessibleSetDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="factory-accessible-set"]')
    ).toBeInTheDocument();
    const groups = canvasElement.querySelectorAll('[data-slot="input-group"]');
    expect(groups.length).toBe(4);
  },
};

// ============ FACTORY: Constants Showcase ============

function FactoryConstantsDemo() {
  const _layouts: InputGroupLayout[] = INPUT_GROUP_LAYOUTS;
  const _widths: InputGroupWidth[] = INPUT_GROUP_WIDTHS;
  const _icons: InputGroupIconName[] = INPUT_GROUP_ICONS;
  const _prefixes = INPUT_GROUP_PREFIX_TEXTS;
  const _suffixes = INPUT_GROUP_SUFFIX_TEXTS;
  const _placeholders = INPUT_GROUP_PLACEHOLDERS;
  const _ariaLabels = INPUT_GROUP_ARIA_LABELS;
  const _shortcuts = INPUT_GROUP_SHORTCUTS;
  const _currencies = INPUT_GROUP_CURRENCIES;
  const _countryCodes = INPUT_GROUP_COUNTRY_CODES;

  // Reference interfaces used as type annotations
  const _inputConfig: FakeInputGroupInput | null = null;
  const _textareaConfig: FakeInputGroupTextarea | null = null;

  void _inputConfig;
  void _textareaConfig;

  return (
    <div className="w-full max-w-xl space-y-6" data-testid="factory-constants">
      <div className="text-sm font-medium">
        {i18n.t('inputGroup.section.helperShortcut')}: Constants Reference
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium">Layouts ({_layouts.length})</div>
        <div className="flex flex-wrap gap-1">
          {_layouts.map((l) => (
            <span key={l} className="bg-muted rounded px-2 py-0.5 text-xs">
              {l}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium">Widths ({_widths.length})</div>
        <div className="flex flex-wrap gap-1">
          {_widths.map((w) => (
            <span key={w} className="bg-muted rounded px-2 py-0.5 text-xs">
              {w}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium">Icons ({_icons.length})</div>
        <div className="flex flex-wrap gap-2">
          {_icons.map((iconName) => {
            const Icon = ICON_MAP[iconName];
            return (
              <div key={iconName} className="flex items-center gap-1">
                <Icon className="size-4" />
                <span className="text-xs">{iconName}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium">Prefix Texts ({_prefixes.length})</div>
        <div className="flex flex-wrap gap-1">
          {_prefixes.map((p) => (
            <span key={p} className="bg-muted rounded px-2 py-0.5 text-xs">
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium">Suffix Texts ({_suffixes.length})</div>
        <div className="flex flex-wrap gap-1">
          {_suffixes.map((s) => (
            <span key={s} className="bg-muted rounded px-2 py-0.5 text-xs">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium">Placeholders ({_placeholders.length})</div>
        <div className="flex flex-wrap gap-1">
          {_placeholders.map((p) => (
            <span key={p} className="bg-muted rounded px-2 py-0.5 text-xs">
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium">ARIA Labels ({_ariaLabels.length})</div>
        <div className="flex flex-wrap gap-1">
          {_ariaLabels.map((a) => (
            <span key={a} className="bg-muted rounded px-2 py-0.5 text-xs">
              {a}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium">Shortcuts ({_shortcuts.length})</div>
        <div className="flex flex-wrap gap-2">
          {_shortcuts.map((shortcut) => (
            <KbdGroup key={shortcut.join('-')}>
              {shortcut.filter(Boolean).map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </KbdGroup>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium">Currencies ({_currencies.length})</div>
        <div className="flex flex-wrap gap-1">
          {_currencies.map((c) => (
            <span key={c.value} className="bg-muted rounded px-2 py-0.5 text-xs">
              {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium">Country Codes ({_countryCodes.length})</div>
        <div className="flex flex-wrap gap-1">
          {_countryCodes.map((cc) => (
            <span key={cc.code} className="bg-muted rounded px-2 py-0.5 text-xs">
              {cc.country} ({cc.code})
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  name: i18n.t('inputGroup.storyName.factoryConstants', 'Factory: Constants Showcase'),
  render: () => <FactoryConstantsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="factory-constants"]')).toBeInTheDocument();
    // Verify constants are rendered
    expect(canvasElement.textContent).toContain('Layouts');
    expect(canvasElement.textContent).toContain('Widths');
    expect(canvasElement.textContent).toContain('Icons');
    expect(canvasElement.textContent).toContain('Prefix Texts');
    expect(canvasElement.textContent).toContain('Suffix Texts');
    expect(canvasElement.textContent).toContain('Placeholders');
    expect(canvasElement.textContent).toContain('ARIA Labels');
    expect(canvasElement.textContent).toContain('Shortcuts');
    expect(canvasElement.textContent).toContain('Currencies');
    expect(canvasElement.textContent).toContain('Country Codes');
    // Verify specific values
    expect(canvasElement.textContent).toContain('horizontal');
    expect(canvasElement.textContent).toContain('vertical');
    expect(canvasElement.textContent).toContain('USD');
    expect(canvasElement.textContent).toContain('https://');
    expect(canvasElement.textContent).toContain('.com');
    expect(canvasElement.textContent).toContain('+1');
  },
};

// ============ DARK RTL STORY ============

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ MOBILE STORY ============

export const Mobile: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ DATA ATTRIBUTES STORY ============

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS STORIES (auto-wired)
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: inputGroupStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerValidationError: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.handlerValidationError', 'Handler: Validation Error'),
  parameters: { msw: { handlers: inputGroupStatusHandlers.validationError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: inputGroupStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: inputGroupStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: inputGroupStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowSearch: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.handlerSlowSearch', 'Handler: Slow Search'),
  parameters: { msw: { handlers: inputGroupStatusHandlers.slowSearch } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNoResults: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.handlerNoResults', 'Handler: No Results'),
  parameters: { msw: { handlers: inputGroupStatusHandlers.noResults } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerPrefixValidation: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.handlerPrefixValidation', 'Handler: Prefix Validation'),
  parameters: { msw: { handlers: inputGroupStatusHandlers.prefixValidation } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSuffixClearAction: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.handlerSuffixClearAction', 'Handler: Suffix Clear Action'),
  parameters: { msw: { handlers: inputGroupStatusHandlers.suffixClearAction } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerAutocompleteSearch: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.handlerAutocompleteSearch', 'Handler: Autocomplete Search'),
  parameters: { msw: { handlers: inputGroupStatusHandlers.autocompleteSearch } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerInputFocusTracker: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.handlerInputFocusTracker', 'Handler: Input Focus Tracker'),
  parameters: { msw: { handlers: inputGroupStatusHandlers.inputFocusTracker } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerAddonInteraction: Story = {
  ...Default,
  name: i18n.t('inputGroup.storyName.handlerAddonInteraction', 'Handler: Addon Interaction'),
  parameters: { msw: { handlers: inputGroupStatusHandlers.addonInteraction } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
