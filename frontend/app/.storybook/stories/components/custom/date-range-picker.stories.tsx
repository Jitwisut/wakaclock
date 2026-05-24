import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  customDateRangePickerHandlers,
  customDateRangePickerStatusHandlers,
} from '@/.storybook/stories/_handlers/custom-date-range-picker.handlers';
import {
  dateRangePickerHandlers,
  dateRangePickerStatusHandlers,
} from '@/.storybook/stories/_handlers/date-range-picker.handlers';
import type {
  DateRangePickerState,
  FakeDateRange,
  FakeDateRangePickerLabels,
  FakeDateRangePickerShowcase,
  FakeDateRangePicker as FakeDateRangePickerType,
  FakeDateRangePreset,
  FakeDateRangeSelection,
  FakeDateRangeValidation,
  PresetKey,
} from '@/.storybook/stories/_factories/date-range-picker.factory';
import {
  createFakeAllPresets,
  createFakeAnalyticsPicker,
  createFakeDateRange,
  createFakeDateRangeForPreset,
  createFakeDateRangePicker,
  createFakeDateRangePickerDisabled,
  createFakeDateRangePickerEmpty,
  createFakeDateRangePickerError,
  createFakeDateRangePickerLabelsEn,
  createFakeDateRangePickerLabelsJa,
  createFakeDateRangePickerLoading,
  createFakeDateRangePickerOpen,
  createFakeDateRangePickers,
  createFakeDateRangePickerShowcase,
  createFakeDateRangePreset,
  createFakeDateRanges,
  createFakeDateRangeSelection,
  createFakeDateRangeSelections,
  createFakeDateRangeValidation,
  createFakeFilterPicker,
  createFakeReportPicker,
  DATE_RANGE_PICKER_STATES,
  PRESET_KEYS,
  PRESET_LABELS_EN,
  PRESET_LABELS_JA,
} from '@/.storybook/stories/_factories/date-range-picker.factory';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDateRangePicker } from '@/components/custom-date-range-picker';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

type CalendarDateRangePickerProps = ComponentProps<typeof CalendarDateRangePicker>;

const FIXED_NOW = new Date(2024, 0, 10, 12, 0, 0);

function I18nCalendarDateRangePicker(props: CalendarDateRangePickerProps) {
  const { t } = useTranslation();

  return (
    <CalendarDateRangePicker
      {...props}
      labels={{
        placeholder: t('dateRangePicker.placeholder'),
        selectAriaLabel: t('dateRangePicker.selectAriaLabel'),
        selectPlaceholder: t('dateRangePicker.selectPlaceholder'),
        presets: {
          today: t('dateRangePicker.presets.today'),
          yesterday: t('dateRangePicker.presets.yesterday'),
          thisWeek: t('dateRangePicker.presets.thisWeek'),
          last7Days: t('dateRangePicker.presets.last7Days'),
          last28Days: t('dateRangePicker.presets.last28Days'),
          thisMonth: t('dateRangePicker.presets.thisMonth'),
          lastMonth: t('dateRangePicker.presets.lastMonth'),
          thisYear: t('dateRangePicker.presets.thisYear'),
        },
      }}
    />
  );
}

const meta = {
  title: 'Components/Custom/Date Range Picker',
  component: CalendarDateRangePicker,
  tags: ['autodocs'],
  args: {
    defaultOpen: false,
    defaultPreset: 'last28Days',
    // Event handlers with fn() for Actions panel logging
    onChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // Content
    defaultPreset: {
      control: { type: 'select' },
      options: [
        'today',
        'yesterday',
        'thisWeek',
        'last7Days',
        'last28Days',
        'thisMonth',
        'lastMonth',
        'thisYear',
      ],
      description: i18n.t(
        'dateRangePicker.argType.initialPresetSelection',
        'Initial preset selection'
      ),
      table: {
        category: 'Content',
        type: { summary: 'PresetKey' },
        defaultValue: { summary: 'last28Days' },
      },
    },
    labels: {
      control: false,
      description: i18n.t(
        'dateRangePicker.argType.localizationLabelsForPresetsAndUiElements',
        'Localization labels for presets and UI elements'
      ),
      table: {
        category: 'Content',
        type: { summary: 'Labels' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t('dateRangePicker.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    defaultOpen: {
      control: { type: 'boolean' },
      description: i18n.t(
        'dateRangePicker.argType.whetherThePopoverIsOpenByDefault',
        'Whether the popover is open by default'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    defaultDateRange: {
      control: false,
      description: i18n.t(
        'dateRangePicker.argType.initialDateRangeSelection',
        'Initial date range selection'
      ),
      table: {
        category: 'State',
        type: { summary: 'DateRange | null' },
      },
    },
    // Events
    onChange: {
      action: 'onChange',
      description: i18n.t(
        'dateRangePicker.argType.calledWhenDateRangeChanges',
        'Called when date range changes'
      ),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('dateRangePicker.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('dateRangePicker.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('dateRangePicker.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t(
        'dateRangePicker.argType.mouseenterEventHandler',
        'MouseEnter event handler'
      ),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t(
        'dateRangePicker.argType.mouseleaveEventHandler',
        'MouseLeave event handler'
      ),
      table: { category: 'Events' },
    },
    // CalendarDateRangePicker Props Reference:
    // - defaultOpen: Initial popover open state (boolean)
    // - defaultPreset: Initial preset selection (PresetKey)
    // - defaultDateRange: Initial date range (DateRange | null)
    // - now: Current date reference for presets (Date)
    // - onChange: Called when date range changes ((range: DateRange) => void)
    // - labels: Localization labels object (Labels)
    //   - placeholder: Button placeholder text (string)
    //   - selectAriaLabel: Select accessible label (string)
    //   - selectPlaceholder: Select placeholder (string)
    //   - presets: Object with preset labels
    //     - today, yesterday, thisWeek, last7Days, last28Days
    //     - thisMonth, lastMonth, thisYear
    //
    // PresetKey Options:
    // - 'today': Current day
    // - 'yesterday': Previous day
    // - 'thisWeek': Current week (Mon-Sun)
    // - 'last7Days': Past 7 days
    // - 'last28Days': Past 28 days
    // - 'thisMonth': Current month
    // - 'lastMonth': Previous month
    // - 'thisYear': Current year
    //
    // Usage Notes:
    // - Uses react-day-picker for calendar
    // - Supports range selection mode
    // - Presets provide quick date range selection
    // - Pass 'now' prop for deterministic date calculations
  },
  parameters: {
    msw: { handlers: dateRangePickerHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof CalendarDateRangePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[360px]">
      <CalendarDateRangePicker {...args} now={FIXED_NOW} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    const trigger = canvas.getByRole('button');
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
    expect(doc.body.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument();

    await userEvent.click(trigger);
    expect(doc.activeElement).toBe(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Popover content was not rendered.');
      }
      return node;
    });

    const popover = within(content);
    expect(popover.getByRole('radio', { name: 'Today' })).toBeInTheDocument();

    await userEvent.click(trigger);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
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
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
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
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Open: Story = {
  ...Default,
  name: i18n.t('dateRangePicker.storyName.open', 'Open (popover)'),
  args: {
    ...(Default.args ?? {}),
    defaultOpen: true,
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement;

    if (!root.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const content = document.querySelector('[data-slot="popover-content"]');

    if (!(content instanceof HTMLElement)) {
      throw new TypeError('Popover content was not rendered.');
    }
  },
};

export const Empty: Story = {
  ...Default,
  name: i18n.t('dateRangePicker.storyName.empty', 'Empty (no selection)'),
  args: {
    ...(Default.args ?? {}),
    defaultDateRange: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    // With null date range, button should still render with placeholder text
    expect(trigger.textContent).not.toBe('');
  },
};

export const MobileOpen: Story = {
  ...Open,
  name: i18n.t('dateRangePicker.storyName.mobileOpen', 'Mobile (open)'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('dateRangePicker.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  args: {
    ...(Default.args ?? {}),
    defaultDateRange: null,
  },
  render: (args) => (
    <div className="w-[360px]">
      <I18nCalendarDateRangePicker {...args} now={FIXED_NOW} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
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
  name: i18n.t('dateRangePicker.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ VARIANTS & SIZES ============

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t(
            'dateRangePicker.story.withDefaultPresetLast28Days',
            'With default preset (last28Days)'
          )}
        </p>
        <div className="w-[360px]">
          <CalendarDateRangePicker now={FIXED_NOW} defaultPreset="last28Days" />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('dateRangePicker.story.withTodayPreset', 'With today preset')}
        </p>
        <div className="w-[360px]">
          <CalendarDateRangePicker now={FIXED_NOW} defaultPreset="today" />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('dateRangePicker.story.emptyNoSelection', 'Empty (no selection)')}
        </p>
        <div className="w-[360px]">
          <CalendarDateRangePicker now={FIXED_NOW} defaultDateRange={null} />
        </div>
      </div>
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('dateRangePicker.story.smallContainer', 'Small Container')}
        </p>
        <div className="w-[200px]">
          <CalendarDateRangePicker now={FIXED_NOW} defaultPreset="last28Days" />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('dateRangePicker.story.mediumContainer', 'Medium Container')}
        </p>
        <div className="w-[360px]">
          <CalendarDateRangePicker now={FIXED_NOW} defaultPreset="last28Days" />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('dateRangePicker.story.largeContainer', 'Large Container')}
        </p>
        <div className="w-[500px]">
          <CalendarDateRangePicker now={FIXED_NOW} defaultPreset="last28Days" />
        </div>
      </div>
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  name: i18n.t('dateRangePicker.storyName.accessibility', 'Accessibility'),
  render: (args) => (
    <div className="w-[360px]">
      <CalendarDateRangePicker {...args} now={FIXED_NOW} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Verify trigger button is accessible
    const trigger = canvas.getByRole('button');
    expect(trigger).toHaveAttribute('data-slot', 'popover-trigger');

    // Test keyboard navigation - open with Enter
    trigger.focus();
    expect(doc.activeElement).toBe(trigger);

    await userEvent.keyboard('{Enter}');
    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="popover-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Popover content was not rendered.');
      }
      return node;
    });

    const popover = within(content);

    // Verify preset radio buttons have accessible names
    const todayRadio = popover.getByRole('radio', { name: 'Today' });
    expect(todayRadio).toBeInTheDocument();

    // Verify radio group is navigable
    const radioGroup = content.querySelector('[role="radiogroup"]');
    expect(radioGroup).toBeInTheDocument();

    // Test keyboard navigation within popover - select a preset
    await userEvent.click(todayRadio);
    expect(todayRadio).toBeChecked();

    // Close popover with Escape
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const picker = createFakeDateRangePicker({ state: 'idle' });
    const preset = picker.defaultPreset === 'custom' ? 'last7Days' : picker.defaultPreset;
    return (
      <div className="w-[360px]">
        <CalendarDateRangePicker now={FIXED_NOW} defaultPreset={preset} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="popover-trigger"]')).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="popover-trigger"]')).toBeInTheDocument();
  },
};

// ============ MSW + STATUS STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: [...dateRangePickerHandlers, ...customDateRangePickerHandlers] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('dateRangePicker.storyName.emptyData', 'Empty (no selection)'),
  args: {
    ...(Default.args ?? {}),
    defaultDateRange: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    // Check for placeholder text when no date selected
    expect(trigger.textContent).not.toBe('');
  },
};

export const SlowResponse: Story = {
  name: i18n.t('dateRangePicker.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('dateRangePicker.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('dateRangePicker.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('dateRangePicker.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error404NotFound: Story = {
  name: i18n.t('dateRangePicker.storyName.error404NotFound', 'Error 404: Not Found'),
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('dateRangePicker.storyName.error409Conflict', 'Error 409: Conflict'),
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t(
    'dateRangePicker.storyName.error422UnprocessableEntity',
    'Error 422: Unprocessable Entity'
  ),
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('dateRangePicker.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'dateRangePicker.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('dateRangePicker.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t(
    'dateRangePicker.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('dateRangePicker.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// ============ SPECIAL STATE STORIES ============

export const NetworkError: Story = {
  name: i18n.t('dateRangePicker.storyName.networkError', 'Network Error'),
  ...Default,
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// ============ FACTORY INTEGRATION STORIES ============

// -- Type/Interface usage helpers (ensure type imports are exercised) --
const _typeCheck: {
  dateRangePickerState: DateRangePickerState;
  fakeDateRange: FakeDateRange;
  fakeDateRangePicker: FakeDateRangePickerType;
  fakeDateRangePickerLabels: FakeDateRangePickerLabels;
  fakeDateRangePickerShowcase: FakeDateRangePickerShowcase;
  fakeDateRangePreset: FakeDateRangePreset;
  fakeDateRangeSelection: FakeDateRangeSelection;
  fakeDateRangeValidation: FakeDateRangeValidation;
  presetKey: PresetKey;
} = {
  dateRangePickerState: 'idle',
  fakeDateRange: { from: new Date(), to: new Date() },
  fakeDateRangePicker: createFakeDateRangePicker(),
  fakeDateRangePickerLabels: createFakeDateRangePickerLabelsEn(),
  fakeDateRangePickerShowcase: createFakeDateRangePickerShowcase(),
  fakeDateRangePreset: createFakeDateRangePreset(),
  fakeDateRangeSelection: createFakeDateRangeSelection(),
  fakeDateRangeValidation: createFakeDateRangeValidation(),
  presetKey: 'today',
};

// Prevent unused variable warning
void _typeCheck;

// -- PRESET_KEYS & PRESET_LABELS_EN: All Presets Story --

function AllPresetsDemo() {
  const { t } = useTranslation();
  const presets = createFakeAllPresets(FIXED_NOW);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{t('dateRangePicker.section.presets')}</h3>
      <p className="text-muted-foreground text-xs">
        {PRESET_KEYS.length} presets available ({DATE_RANGE_PICKER_STATES.length} states)
      </p>
      <div className="flex flex-col gap-3">
        {presets.map((preset: FakeDateRangePreset) => (
          <div key={preset.key} className="w-[360px]">
            <p className="text-muted-foreground mb-1 text-xs">{PRESET_LABELS_EN[preset.key]}</p>
            <CalendarDateRangePicker
              now={FIXED_NOW}
              defaultPreset={preset.key === 'custom' ? 'last7Days' : preset.key}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const AllPresets: Story = {
  name: i18n.t('dateRangePicker.storyName.allPresets', 'All Presets (factory)'),
  render: () => <AllPresetsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const triggers = canvas.getAllByRole('button');
    expect(triggers.length).toBeGreaterThan(0);
    for (const trigger of triggers) {
      expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
    }
  },
};

// -- PRESET_LABELS_JA: Japanese Labels Story --

function JapaneseLabelsDemo() {
  const labelsJa = createFakeDateRangePickerLabelsJa();

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.presets')}</h3>
      <div className="space-y-2">
        {PRESET_KEYS.filter((k) => k !== 'custom').map((key) => (
          <p key={key} className="text-muted-foreground text-xs">
            {PRESET_LABELS_JA[key]} ({labelsJa.presets[key]})
          </p>
        ))}
      </div>
      <div className="w-[360px]">
        <CalendarDateRangePicker now={FIXED_NOW} defaultPreset="last28Days" labels={labelsJa} />
      </div>
    </div>
  );
}

export const JapaneseLabels: Story = {
  name: i18n.t('dateRangePicker.storyName.japaneseLabels', 'Japanese Labels (factory)'),
  render: () => <JapaneseLabelsDemo />,
  globals: { locale: 'ja' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// -- createFakeDateRange & createFakeDateRanges: Date Ranges Story --

function DateRangesDemo() {
  const singleRange: FakeDateRange = createFakeDateRange();
  const multipleRanges = createFakeDateRanges(3);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.variants')}</h3>
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          Single range: {singleRange.from.toLocaleDateString()} -{' '}
          {singleRange.to.toLocaleDateString()}
        </p>
        {multipleRanges.map((range) => {
          const rangeKey = `${range.from.getTime()}-${range.to.getTime()}`;
          return (
            <p key={rangeKey} className="text-muted-foreground text-xs">
              {range.from.toLocaleDateString()} - {range.to.toLocaleDateString()}
            </p>
          );
        })}
      </div>
      <div className="w-[360px]">
        <CalendarDateRangePicker
          now={FIXED_NOW}
          defaultPreset="last7Days"
          defaultDateRange={{ from: singleRange.from, to: singleRange.to }}
        />
      </div>
    </div>
  );
}

export const DateRanges: Story = {
  name: i18n.t('dateRangePicker.storyName.dateRanges', 'Date Ranges (factory)'),
  render: () => <DateRangesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
    expect(trigger.textContent).not.toBe('');
  },
};

// -- createFakeDateRangeForPreset: Preset Date Range Story --

function PresetDateRangesDemo() {
  const presetKeys: PresetKey[] = ['today', 'yesterday', 'thisWeek', 'last7Days', 'last28Days'];

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.presets')}</h3>
      <div className="space-y-3">
        {presetKeys.map((key) => {
          const range = createFakeDateRangeForPreset(key, FIXED_NOW);
          return (
            <div key={key}>
              <p className="text-muted-foreground mb-1 text-xs">
                {PRESET_LABELS_EN[key]}: {range.from.toLocaleDateString()} -{' '}
                {range.to.toLocaleDateString()}
              </p>
              <div className="w-[360px]">
                <CalendarDateRangePicker
                  now={FIXED_NOW}
                  defaultPreset={key as Exclude<PresetKey, 'custom'>}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const PresetDateRanges: Story = {
  name: i18n.t('dateRangePicker.storyName.presetDateRanges', 'Preset Date Ranges (factory)'),
  render: () => <PresetDateRangesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const triggers = canvas.getAllByRole('button');
    expect(triggers.length).toBe(5);
    for (const trigger of triggers) {
      expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
    }
  },
};

// -- createFakeDateRangePickers: Multiple Pickers Story --

function MultiplePickersDemo() {
  const pickers = createFakeDateRangePickers(4);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.variants')}</h3>
      <div className="space-y-3">
        {pickers.map((picker) => {
          const preset = picker.defaultPreset === 'custom' ? 'last7Days' : picker.defaultPreset;
          return (
            <div key={picker.id} className="w-[360px]">
              <p className="text-muted-foreground mb-1 text-xs">
                Picker {picker.id.slice(0, 8)} - State: {picker.state}
              </p>
              <CalendarDateRangePicker now={FIXED_NOW} defaultPreset={preset} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const MultiplePickers: Story = {
  name: i18n.t('dateRangePicker.storyName.multiplePickers', 'Multiple Pickers (factory)'),
  render: () => <MultiplePickersDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const triggers = canvas.getAllByRole('button');
    expect(triggers.length).toBe(4);
    for (const trigger of triggers) {
      expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
    }
  },
};

// -- createFakeDateRangePickerOpen: Open State Story --

function OpenStateDemo() {
  const picker = createFakeDateRangePickerOpen();
  const preset = picker.defaultPreset === 'custom' ? 'last7Days' : picker.defaultPreset;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.story.playground')}</h3>
      <p className="text-muted-foreground text-xs">State: {picker.state}</p>
      <div className="w-[360px]">
        <CalendarDateRangePicker
          now={FIXED_NOW}
          defaultPreset={preset}
          defaultOpen={picker.defaultOpen}
        />
      </div>
    </div>
  );
}

export const FactoryOpenState: Story = {
  name: i18n.t('dateRangePicker.storyName.factoryOpenState', 'Open State (factory)'),
  render: () => <OpenStateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// -- createFakeDateRangePickerLoading: Loading State Story --

function LoadingStateDemo() {
  const picker = createFakeDateRangePickerLoading();
  const preset = picker.defaultPreset === 'custom' ? 'last28Days' : picker.defaultPreset;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.validation')}</h3>
      <p className="text-muted-foreground text-xs">State: {picker.state}</p>
      <div className="w-[360px]">
        <CalendarDateRangePicker now={FIXED_NOW} defaultPreset={preset} />
      </div>
    </div>
  );
}

export const FactoryLoadingState: Story = {
  name: i18n.t('dateRangePicker.storyName.factoryLoadingState', 'Loading State (factory)'),
  render: () => <LoadingStateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// -- createFakeDateRangePickerError: Error State Story --

function ErrorStateDemo() {
  const picker = createFakeDateRangePickerError();
  const preset = picker.defaultPreset === 'custom' ? 'last28Days' : picker.defaultPreset;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.validation')}</h3>
      <p className="text-muted-foreground text-xs">State: {picker.state}</p>
      <div className="w-[360px]">
        <CalendarDateRangePicker now={FIXED_NOW} defaultPreset={preset} />
      </div>
    </div>
  );
}

export const FactoryErrorState: Story = {
  name: i18n.t('dateRangePicker.storyName.factoryErrorState', 'Error State (factory)'),
  render: () => <ErrorStateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// -- createFakeDateRangePickerDisabled: Disabled State Story --

function DisabledStateDemo() {
  const picker = createFakeDateRangePickerDisabled();
  const preset = picker.defaultPreset === 'custom' ? 'last28Days' : picker.defaultPreset;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.disabled')}</h3>
      <p className="text-muted-foreground text-xs">State: {picker.state}</p>
      <div className="w-[360px]">
        <CalendarDateRangePicker now={FIXED_NOW} defaultPreset={preset} />
      </div>
    </div>
  );
}

export const FactoryDisabledState: Story = {
  name: i18n.t('dateRangePicker.storyName.factoryDisabledState', 'Disabled State (factory)'),
  render: () => <DisabledStateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// -- createFakeDateRangePickerEmpty: Empty State Story --

function EmptyStateDemo() {
  const picker = createFakeDateRangePickerEmpty();
  const preset = picker.defaultPreset === 'custom' ? 'last28Days' : picker.defaultPreset;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.placeholder')}</h3>
      <p className="text-muted-foreground text-xs">
        Date range: {picker.dateRange ? 'set' : 'null (empty)'}
      </p>
      <div className="w-[360px]">
        <CalendarDateRangePicker now={FIXED_NOW} defaultPreset={preset} defaultDateRange={null} />
      </div>
    </div>
  );
}

export const FactoryEmptyState: Story = {
  name: i18n.t('dateRangePicker.storyName.factoryEmptyState', 'Empty State (factory)'),
  render: () => <EmptyStateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).not.toBe('');
  },
};

// -- createFakeDateRangePreset: Single Preset Story --

function SinglePresetDemo() {
  const preset = createFakeDateRangePreset({ key: 'thisMonth' });

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.presets')}</h3>
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs">Key: {preset.key}</p>
        <p className="text-muted-foreground text-xs">Label: {preset.label}</p>
        {preset.description ? (
          <p className="text-muted-foreground text-xs">Description: {preset.description}</p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Range: {preset.dateRange.from.toLocaleDateString()} -{' '}
          {preset.dateRange.to.toLocaleDateString()}
        </p>
      </div>
      <div className="w-[360px]">
        <CalendarDateRangePicker now={FIXED_NOW} defaultPreset="thisMonth" />
      </div>
    </div>
  );
}

export const SinglePreset: Story = {
  name: i18n.t('dateRangePicker.storyName.singlePreset', 'Single Preset (factory)'),
  render: () => <SinglePresetDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// -- createFakeDateRangeSelection & createFakeDateRangeSelections: Selections Story --

function SelectionsDemo() {
  const singleSelection: FakeDateRangeSelection = createFakeDateRangeSelection();
  const multipleSelections = createFakeDateRangeSelections(3);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.variants')}</h3>
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          Single selection: {singleSelection.preset ?? 'custom'} (ID:{' '}
          {singleSelection.id.slice(0, 8)})
        </p>
        <p className="text-muted-foreground text-xs">
          Range: {singleSelection.dateRange.from.toLocaleDateString()}
          {' - '}
          {singleSelection.dateRange.to.toLocaleDateString()}
        </p>
        <p className="text-muted-foreground mt-2 text-xs font-medium">
          Multiple selections ({multipleSelections.length}):
        </p>
        {multipleSelections.map((sel) => (
          <p key={sel.id} className="text-muted-foreground text-xs">
            {sel.preset ?? 'custom'}: {sel.dateRange.from.toLocaleDateString()} -{' '}
            {sel.dateRange.to.toLocaleDateString()}
          </p>
        ))}
      </div>
      <div className="w-[360px]">
        <CalendarDateRangePicker
          now={FIXED_NOW}
          defaultPreset={
            singleSelection.preset && singleSelection.preset !== 'custom'
              ? singleSelection.preset
              : 'last7Days'
          }
        />
      </div>
    </div>
  );
}

export const Selections: Story = {
  name: i18n.t('dateRangePicker.storyName.selections', 'Selections (factory)'),
  render: () => <SelectionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// -- createFakeDateRangeValidation: Validation Story --

function ValidationDemo() {
  const validResult: FakeDateRangeValidation = createFakeDateRangeValidation({ isValid: true });
  const invalidResult = createFakeDateRangeValidation({
    errors: [
      i18n.t(
        'dateRangePicker.story.startDateMustBeBeforeEndDate',
        'Start date must be before end date'
      ),
    ],
    isValid: false,
  });

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.validation')}</h3>
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-green-600">
            {i18n.t('dateRangePicker.story.validRange', 'Valid Range')}
          </p>
          <p className="text-muted-foreground text-xs">
            {validResult.range.from.toLocaleDateString()} -{' '}
            {validResult.range.to.toLocaleDateString()}
          </p>
          <p className="text-muted-foreground text-xs">Errors: {validResult.errors.length}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-red-600">
            {i18n.t('dateRangePicker.story.invalidRange', 'Invalid Range')}
          </p>
          <p className="text-muted-foreground text-xs">
            {invalidResult.range.from.toLocaleDateString()} -{' '}
            {invalidResult.range.to.toLocaleDateString()}
          </p>
          {invalidResult.errors.map((err) => (
            <p key={err} className="text-xs text-red-500">
              {err}
            </p>
          ))}
        </div>
      </div>
      <div className="w-[360px]">
        <CalendarDateRangePicker now={FIXED_NOW} defaultPreset="last28Days" />
      </div>
    </div>
  );
}

export const Validation: Story = {
  name: i18n.t('dateRangePicker.storyName.validation', 'Validation (factory)'),
  render: () => <ValidationDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
    // Verify validation text rendered
    expect(canvasElement.textContent).toContain('Valid Range');
    expect(canvasElement.textContent).toContain('Invalid Range');
  },
};

// -- createFakeDateRangePickerShowcase: Showcase Story --

function ShowcaseDemo() {
  const showcase: FakeDateRangePickerShowcase = createFakeDateRangePickerShowcase();

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.story.description')}</h3>
      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium">
          Pickers ({showcase.pickers.length})
        </p>
        <div className="space-y-3">
          {showcase.pickers.map((picker) => {
            const preset = picker.defaultPreset === 'custom' ? 'last7Days' : picker.defaultPreset;
            return (
              <div key={picker.id} className="w-[360px]">
                <p className="text-muted-foreground mb-1 text-xs">
                  {picker.state} - {PRESET_LABELS_EN[picker.defaultPreset]}
                </p>
                <CalendarDateRangePicker now={FIXED_NOW} defaultPreset={preset} />
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium">
          Presets ({showcase.presets.length})
        </p>
        {showcase.presets.map((preset) => (
          <p key={preset.key} className="text-muted-foreground text-xs">
            {preset.label}: {preset.dateRange.from.toLocaleDateString()} -{' '}
            {preset.dateRange.to.toLocaleDateString()}
          </p>
        ))}
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium">
          Selections ({showcase.selections.length})
        </p>
        {showcase.selections.map((sel) => (
          <p key={sel.id} className="text-muted-foreground text-xs">
            {sel.preset ?? 'custom'}: {sel.dateRange.from.toLocaleDateString()}
          </p>
        ))}
      </div>
    </div>
  );
}

export const Showcase: Story = {
  name: i18n.t('dateRangePicker.storyName.showcase', 'Showcase (factory)'),
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const triggers = canvas.getAllByRole('button');
    expect(triggers.length).toBeGreaterThan(0);
    for (const trigger of triggers) {
      expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
    }
  },
};

// -- createFakeAnalyticsPicker: Analytics Picker Story --

function AnalyticsPickerDemo() {
  const picker = createFakeAnalyticsPicker();
  const preset = picker.defaultPreset === 'custom' ? 'last28Days' : picker.defaultPreset;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.variants')}</h3>
      <p className="text-muted-foreground text-xs">
        Analytics picker - Placeholder: {picker.labels.placeholder}
      </p>
      <div className="w-[360px]">
        <CalendarDateRangePicker now={FIXED_NOW} defaultPreset={preset} labels={picker.labels} />
      </div>
    </div>
  );
}

export const AnalyticsPicker: Story = {
  name: i18n.t('dateRangePicker.storyName.analyticsPicker', 'Analytics Picker (factory)'),
  render: () => <AnalyticsPickerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// -- createFakeReportPicker: Report Picker Story --

function ReportPickerDemo() {
  const picker = createFakeReportPicker();
  const preset = picker.defaultPreset === 'custom' ? 'lastMonth' : picker.defaultPreset;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.variants')}</h3>
      <p className="text-muted-foreground text-xs">
        Report picker - Placeholder: {picker.labels.placeholder}
      </p>
      <div className="w-[360px]">
        <CalendarDateRangePicker now={FIXED_NOW} defaultPreset={preset} labels={picker.labels} />
      </div>
    </div>
  );
}

export const ReportPicker: Story = {
  name: i18n.t('dateRangePicker.storyName.reportPicker', 'Report Picker (factory)'),
  render: () => <ReportPickerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// -- createFakeFilterPicker: Filter Picker Story --

function FilterPickerDemo() {
  const picker = createFakeFilterPicker();
  const preset = picker.defaultPreset === 'custom' ? 'last7Days' : picker.defaultPreset;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.variants')}</h3>
      <p className="text-muted-foreground text-xs">
        Filter picker - Placeholder: {picker.labels.placeholder}
      </p>
      <div className="w-[360px]">
        <CalendarDateRangePicker now={FIXED_NOW} defaultPreset={preset} labels={picker.labels} />
      </div>
    </div>
  );
}

export const FilterPicker: Story = {
  name: i18n.t('dateRangePicker.storyName.filterPicker', 'Filter Picker (factory)'),
  render: () => <FilterPickerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// -- createFakeDateRangePickerLabelsEn: English Labels Story --

function EnglishLabelsDemo() {
  const labels: FakeDateRangePickerLabels = createFakeDateRangePickerLabelsEn();

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.presets')}</h3>
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs">Placeholder: {labels.placeholder}</p>
        <p className="text-muted-foreground text-xs">Select Aria Label: {labels.selectAriaLabel}</p>
        <p className="text-muted-foreground text-xs">
          Select Placeholder: {labels.selectPlaceholder}
        </p>
      </div>
      <div className="w-[360px]">
        <CalendarDateRangePicker now={FIXED_NOW} defaultPreset="last28Days" labels={labels} />
      </div>
    </div>
  );
}

export const EnglishLabels: Story = {
  name: i18n.t('dateRangePicker.storyName.englishLabels', 'English Labels (factory)'),
  render: () => <EnglishLabelsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// -- DATE_RANGE_PICKER_STATES: All States Story --

function AllStatesDemo() {
  const stateEntries: DateRangePickerState[] = [...DATE_RANGE_PICKER_STATES];

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.section.variants')}</h3>
      <div className="space-y-3">
        {stateEntries.map((state) => {
          const picker = createFakeDateRangePicker({ state });
          const preset = picker.defaultPreset === 'custom' ? 'last28Days' : picker.defaultPreset;
          return (
            <div key={state} className="w-[360px]">
              <p className="text-muted-foreground mb-1 text-xs font-medium capitalize">{state}</p>
              <CalendarDateRangePicker now={FIXED_NOW} defaultPreset={preset} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const AllStates: Story = {
  name: i18n.t('dateRangePicker.storyName.allStates', 'All States (factory)'),
  render: () => <AllStatesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const triggers = canvas.getAllByRole('button');
    expect(triggers.length).toBe(DATE_RANGE_PICKER_STATES.length);
    for (const trigger of triggers) {
      expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
    }
  },
};

// -- Combined: Kitchen Sink with all factory functions --

function KitchenSinkDemo() {
  const labelsEn = createFakeDateRangePickerLabelsEn();
  const analyticsPicker = createFakeAnalyticsPicker();
  const reportPicker = createFakeReportPicker();
  const filterPicker = createFakeFilterPicker();
  const allPresets = createFakeAllPresets(FIXED_NOW);

  const pickerConfigs = [
    { label: 'Analytics', picker: analyticsPicker },
    { label: 'Report', picker: reportPicker },
    { label: 'Filter', picker: filterPicker },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-sm font-medium">{i18n.t('dateRangePicker.story.description')}</h3>
      <p className="text-muted-foreground text-xs">
        {allPresets.length} presets | Labels: {labelsEn.placeholder}
      </p>
      <div className="space-y-4">
        {pickerConfigs.map(({ label, picker }) => {
          const preset = picker.defaultPreset === 'custom' ? 'last28Days' : picker.defaultPreset;
          return (
            <div key={label} className="w-[360px]">
              <p className="text-muted-foreground mb-1 text-xs font-medium">{label}</p>
              <CalendarDateRangePicker
                now={FIXED_NOW}
                defaultPreset={preset}
                labels={picker.labels}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const KitchenSink: Story = {
  name: i18n.t('dateRangePicker.storyName.kitchenSink', 'Kitchen Sink (all factories)'),
  render: () => <KitchenSinkDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const triggers = canvas.getAllByRole('button');
    expect(triggers.length).toBe(3);
    for (const trigger of triggers) {
      expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
    }
    // Verify content rendered
    expect(canvasElement.textContent).toContain('Analytics');
    expect(canvasElement.textContent).toContain('Report');
    expect(canvasElement.textContent).toContain('Filter');
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / DataAttributes / Handler wiring
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('dateRangePicker.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
    expect(
      document.documentElement.getAttribute('dir') ??
        canvasElement.closest('[dir]')?.getAttribute('dir') ??
        'ltr'
    ).toBeDefined();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('dateRangePicker.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('dateRangePicker.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');

    await userEvent.click(trigger);
    const content = await waitFor(() => {
      const node = canvasElement.ownerDocument.body.querySelector('[data-slot="popover-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Popover content was not rendered.');
      }
      return node;
    });
    expect(content.getAttribute('data-slot')).toBe('popover-content');

    const radios = content.querySelectorAll('[role="radio"]');
    expect(radios.length).toBeGreaterThan(0);
  },
};

export const StatusSuccess: Story = {
  ...Default,
  name: i18n.t('dateRangePicker.storyName.statusSuccess', 'Handler: Success'),
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const EmptyDataHandler: Story = {
  ...Default,
  name: i18n.t('dateRangePicker.storyName.emptyDataHandler', 'Handler: Empty Data'),
  parameters: {
    msw: { handlers: dateRangePickerStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// ============================================================================
// CUSTOM DATE RANGE PICKER STATUS HANDLER STORIES
// ============================================================================

export const HandlerInvalidRange: Story = {
  ...Default,
  name: i18n.t('dateRangePicker.storyName.handlerInvalidRange', 'Handler: Invalid Range'),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.invalidRange } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const HandlerNoAvailability: Story = {
  ...Default,
  name: i18n.t('dateRangePicker.storyName.handlerNoAvailability', 'Handler: No Availability'),
  parameters: { msw: { handlers: dateRangePickerStatusHandlers.noAvailability } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerPastDatesOnly: Story = {
  ...Default,
  name: i18n.t('dateRangePicker.storyName.handlerPastDatesOnly', 'Handler: Past Dates Only'),
  parameters: { msw: { handlers: dateRangePickerStatusHandlers.pastDatesOnly } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerSuccess: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerSuccess',
    'Handler: Custom Date Range Picker Success'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerBadRequest: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerBadRequest',
    'Handler: Custom Date Range Picker Bad Request'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerUnauthorized: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerUnauthorized',
    'Handler: Custom Date Range Picker Unauthorized'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerForbidden: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerForbidden',
    'Handler: Custom Date Range Picker Forbidden'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerNotFound: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerNotFound',
    'Handler: Custom Date Range Picker Not Found'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerConflict: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerConflict',
    'Handler: Custom Date Range Picker Conflict'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerUnprocessableEntity: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerUnprocessableEntity',
    'Handler: Custom Date Range Picker Unprocessable Entity'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerTooManyRequests: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerTooManyRequests',
    'Handler: Custom Date Range Picker Too Many Requests'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerInternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerInternalServerError',
    'Handler: Custom Date Range Picker Internal Server Error'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerLoading: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerLoading',
    'Handler: Custom Date Range Picker Loading'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerBadGateway: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerBadGateway',
    'Handler: Custom Date Range Picker Bad Gateway'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerServiceUnavailable',
    'Handler: Custom Date Range Picker Service Unavailable'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerGatewayTimeout',
    'Handler: Custom Date Range Picker Gateway Timeout'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerSlowResponse: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerSlowResponse',
    'Handler: Custom Date Range Picker Slow Response'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerNetworkError: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerNetworkError',
    'Handler: Custom Date Range Picker Network Error'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCustomDateRangePickerEmptyData: Story = {
  ...Default,
  name: i18n.t(
    'dateRangePicker.storyName.handlerCustomDateRangePickerEmptyData',
    'Handler: Custom Date Range Picker Empty Data'
  ),
  parameters: { msw: { handlers: customDateRangePickerStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
