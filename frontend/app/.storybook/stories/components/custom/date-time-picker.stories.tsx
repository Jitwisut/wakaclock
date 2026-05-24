import type { Meta, StoryObj } from '@storybook/react';
import type {
  DateTimePickerState,
  DisplayFormat,
  FakeDateTimePicker,
  FakeDateTimePickerLabels,
  FakeDateTimePickerShowcase,
  FakeDateTimeSelection,
  FakeDateTimeValidation,
  FakeDateTimeValue,
  FakeTimeSlot,
  FakeTimeValue,
  TimeGranularity,
  TimePeriod,
} from '@/.storybook/stories/_factories/date-time-picker.factory';

import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  createFakeAppointmentPicker,
  createFakeDateTimePicker,
  createFakeDateTimePicker24Hour,
  createFakeDateTimePickerDisabled,
  createFakeDateTimePickerEmpty,
  createFakeDateTimePickerError,
  createFakeDateTimePickerLabelsEn,
  createFakeDateTimePickerLabelsJa,
  createFakeDateTimePickerLoading,
  createFakeDateTimePickerOpen,
  createFakeDateTimePickers,
  createFakeDateTimePickerShowcase,
  createFakeDateTimePickerWithSeconds,
  createFakeDateTimeSelection,
  createFakeDateTimeSelections,
  createFakeDateTimeValidation,
  createFakeDateTimeValue,
  createFakeDeadlinePicker,
  createFakeMeetingPicker,
  createFakeSchedulingPicker,
  createFakeTimeSlot,
  createFakeTimeSlotsForDay,
  createFakeTimeValue,
  createFakeTimeValues,
  DATE_TIME_PICKER_STATES,
  DISPLAY_FORMATS,
  FORMAT_STRINGS,
  HOURS_12,
  HOURS_24,
  MINUTE_INTERVALS,
  MINUTES,
  PLACEHOLDER_STRINGS,
  TIME_GRANULARITIES,
  TIME_PERIODS,
} from '@/.storybook/stories/_factories/date-time-picker.factory';
import {
  dateTimePickerHandlers,
  dateTimePickerStatusHandlers,
} from '@/.storybook/stories/_handlers/date-time-picker.handlers';
import { useTranslation } from 'react-i18next';

import { DateTimePicker } from '@/components/date-time-picker';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

// =============================================================================
// TYPE GUARDS (use imported types in value positions for TS erasure compliance)
// =============================================================================

function _assertTypes(): void {
  // This function is never called at runtime. It exists solely to ensure the
  // imported types are referenced in value-position so TS doesn't elide them
  // and ESLint doesn't flag them as unused.
  const _tp: TimePeriod = 'AM';
  const _dps: DateTimePickerState = 'idle';
  const _df: DisplayFormat = '12-hour';
  const _tg: TimeGranularity = 'hour';
  const _ftv: FakeTimeValue = { hour: 0, minute: 0 };
  const _fdtv: FakeDateTimeValue = { date: new Date(), formatted: '', time: _ftv };
  const _fl: FakeDateTimePickerLabels = {
    amLabel: '',
    hourLabel: '',
    minuteLabel: '',
    placeholder: '',
    pmLabel: '',
  };
  const _fp: FakeDateTimePicker = {
    dateTime: undefined,
    defaultOpen: false,
    displayFormat: '',
    id: '',
    labels: _fl,
    minuteInterval: 1,
    placeholder: '',
    showSeconds: false,
    state: _dps,
    use24Hour: false,
  };
  const _fs: FakeDateTimeSelection = { dateTime: new Date(), id: '', timestamp: new Date() };
  const _fv: FakeDateTimeValidation = { dateTime: new Date(), errors: [], isValid: true };
  const _fts: FakeTimeSlot = { available: true, endTime: '', label: '', startTime: '' };
  const _fsc: FakeDateTimePickerShowcase = { pickers: [_fp], selections: [_fs], timeSlots: [_fts] };
  void [_tp, _dps, _df, _tg, _ftv, _fdtv, _fl, _fp, _fs, _fv, _fts, _fsc];
}
void _assertTypes;

type DateTimePickerDemoProps = {
  onDateChange?: (date: Date | undefined) => void;
  startEmpty?: boolean;
} & Omit<React.ComponentProps<typeof DateTimePicker>, 'date' | 'setDate'>;

function DateTimePickerDemo({
  startEmpty = false,
  onDateChange,
  ...props
}: DateTimePickerDemoProps) {
  const [date, setDate] = React.useState<Date | undefined>(() =>
    startEmpty ? undefined : new Date(2024, 0, 1, 9, 0, 0)
  );

  const handleDateChange = React.useCallback(
    (newDate: Date | undefined) => {
      setDate(newDate);
      onDateChange?.(newDate);
    },
    [onDateChange]
  );

  return (
    <div className="w-[360px]">
      <DateTimePicker {...props} date={date} setDate={handleDateChange} />
    </div>
  );
}

function I18nDateTimePickerDemo(props: DateTimePickerDemoProps) {
  return (
    <DateTimePickerDemo
      {...props}
      displayFormat={i18n.t('dateTimePicker.displayFormat')}
      placeholder={i18n.t('dateTimePicker.placeholder')}
    />
  );
}

const meta = {
  title: 'Components/Custom/Date Time Picker',
  component: DateTimePickerDemo,
  tags: ['autodocs'],
  args: {
    defaultOpen: false,
    displayFormat: 'MM/dd/yyyy hh:mm aa',
    placeholder: 'MM/DD/YYYY hh:mm aa',
    startEmpty: false,
    // Event handlers with fn() for Actions panel logging
    onDateChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // Content
    placeholder: {
      control: { type: 'text' },
      description: i18n.t(
        'dateTimePicker.argType.placeholderTextWhenNoDateIsSelected',
        'Placeholder text when no date is selected'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
        defaultValue: { summary: 'MM/DD/YYYY hh:mm aa' },
      },
    },
    // Appearance
    displayFormat: {
      control: { type: 'text' },
      description: i18n.t(
        'dateTimePicker.argType.datefnsFormatStringForDisplayingTheSelectedDate',
        'Date-fns format string for displaying the selected date'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
        defaultValue: { summary: 'MM/dd/yyyy hh:mm aa' },
      },
    },
    className: {
      control: 'text',
      description: i18n.t('dateTimePicker.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    defaultOpen: {
      control: { type: 'boolean' },
      description: i18n.t(
        'dateTimePicker.argType.whetherThePopoverIsOpenByDefault',
        'Whether the popover is open by default'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    startEmpty: {
      control: { type: 'boolean' },
      description: i18n.t(
        'dateTimePicker.argType.startWithNoDateSelectedDemoProp',
        'Start with no date selected (demo prop)'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    // Events
    onDateChange: {
      action: 'onDateChange',
      description: i18n.t(
        'dateTimePicker.argType.calledWhenDatetimeChanges',
        'Called when date/time changes'
      ),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('dateTimePicker.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('dateTimePicker.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('dateTimePicker.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t(
        'dateTimePicker.argType.mouseenterEventHandler',
        'MouseEnter event handler'
      ),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t(
        'dateTimePicker.argType.mouseleaveEventHandler',
        'MouseLeave event handler'
      ),
      table: { category: 'Events' },
    },
    // DateTimePicker Props Reference:
    // - date: Selected date value (Date | undefined)
    // - setDate: Date change handler ((date: Date | undefined) => void)
    // - defaultOpen: Initial popover open state (boolean)
    // - displayFormat: date-fns format for display (string)
    //   - Default: 'MM/dd/yyyy hh:mm aa'
    //   - Examples: 'yyyy-MM-dd HH:mm', 'PPpp' (localized)
    // - placeholder: Placeholder when no date selected (string)
    //
    // Time Selection:
    // - Hour selection (1-12)
    // - Minute selection (0-59)
    // - AM/PM toggle
    // - Uses ScrollArea for scrollable time lists
    //
    // Usage Notes:
    // - Combines calendar date picker with time selection
    // - Uses react-day-picker for calendar
    // - Uses date-fns for date formatting
    // - Controlled component (date + setDate required)
    // - Time displayed in 12-hour format with AM/PM
  },
  parameters: {
    msw: { handlers: dateTimePickerHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof DateTimePickerDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
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

    expect(popover.getByRole('button', { name: 'AM' })).toBeInTheDocument();
    expect(popover.getByRole('button', { name: 'PM' })).toBeInTheDocument();
    expect(popover.getByRole('button', { name: '12' })).toBeInTheDocument();
    expect(popover.getByRole('button', { name: '0' })).toBeInTheDocument();

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
  name: i18n.t('dateTimePicker.storyName.open', 'Open (popover)'),
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
  name: i18n.t('dateTimePicker.storyName.empty', 'Empty (no selection)'),
  args: {
    ...(Default.args ?? {}),
    startEmpty: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('dateTimePicker.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  args: {
    ...(Default.args ?? {}),
    startEmpty: true,
  },
  render: (args) => <I18nDateTimePickerDemo {...args} />,
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
  name: i18n.t('dateTimePicker.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
  render: () => <VariantsDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function VariantsDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-lg font-semibold">{t('dateTimePicker.section.variants')}</h3>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {t('dateTimePicker.story.withDateSelected', 'With date selected')}
        </p>
        <DateTimePickerDemo startEmpty={false} />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {t('dateTimePicker.story.emptyPlaceholder', 'Empty (placeholder)')}
        </p>
        <DateTimePickerDemo startEmpty />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {t('dateTimePicker.story.customFormatIso', 'Custom format (ISO)')}
        </p>
        <DateTimePickerDemo
          startEmpty={false}
          displayFormat="yyyy-MM-dd HH:mm"
          placeholder={i18n.t('dateTimePicker.story.dateTimePlaceholder', 'YYYY-MM-DD HH:mm')}
        />
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function SizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-lg font-semibold">{t('dateTimePicker.section.sizes')}</h3>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {t('dateTimePicker.story.smallContainer', 'Small Container')}
        </p>
        <div className="w-[200px]">
          <DateTimePicker date={new Date(2024, 0, 1, 9, 0, 0)} setDate={() => {}} />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {t('dateTimePicker.story.mediumContainer', 'Medium Container')}
        </p>
        <div className="w-[360px]">
          <DateTimePicker date={new Date(2024, 0, 1, 9, 0, 0)} setDate={() => {}} />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {t('dateTimePicker.story.largeContainer', 'Large Container')}
        </p>
        <div className="w-[500px]">
          <DateTimePicker date={new Date(2024, 0, 1, 9, 0, 0)} setDate={() => {}} />
        </div>
      </div>
    </div>
  );
}

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  name: i18n.t('dateTimePicker.storyName.accessibility', 'Accessibility'),
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

    // Verify time selection buttons have accessible names
    const amButton = popover.getByRole('button', { name: 'AM' });
    const pmButton = popover.getByRole('button', { name: 'PM' });
    expect(amButton).toBeInTheDocument();
    expect(pmButton).toBeInTheDocument();

    // Verify hour and minute buttons are present and accessible
    const hour12Button = popover.getByRole('button', { name: '12' });
    const minute0Button = popover.getByRole('button', { name: '0' });
    expect(hour12Button).toBeInTheDocument();
    expect(minute0Button).toBeInTheDocument();

    // Test keyboard interaction with AM/PM buttons
    await userEvent.click(pmButton);

    // Close popover with Escape
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FAKER INTEGRATION STORIES ============

function FakerDataComponent() {
  const { t } = useTranslation();
  const pickers = createFakeDateTimePickers(3);
  const [dates, setDates] = React.useState<Record<string, Date | undefined>>(
    Object.fromEntries(pickers.map((p) => [p.id, p.dateTime]))
  );
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('dateTimePicker.factory.picker')}</h3>
      {pickers.map((picker) => (
        <div key={picker.id} className="w-[280px]">
          <p className="text-muted-foreground mb-1 text-xs">
            {picker.use24Hour ? '24h' : '12h'} &middot; {picker.state}
          </p>
          <DateTimePicker
            date={dates[picker.id]}
            setDate={(d) => setDates((prev) => ({ ...prev, [picker.id]: d }))}
          />
        </div>
      ))}
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <FakerDataComponent />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="popover-trigger"]')).toBeInTheDocument();
  },
};

// ============ MSW + STATUS STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerHandlers },
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
    msw: { handlers: dateTimePickerStatusHandlers.loading },
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
  name: i18n.t('dateTimePicker.storyName.emptyData', 'Empty (no selection)'),
  args: {
    ...(Default.args ?? {}),
    startEmpty: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('dateTimePicker.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.slowResponse },
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
  name: i18n.t('dateTimePicker.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('dateTimePicker.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('dateTimePicker.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error404NotFound: Story = {
  name: i18n.t('dateTimePicker.storyName.error404NotFound', 'Error 404: Not Found'),
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('dateTimePicker.storyName.error409Conflict', 'Error 409: Conflict'),
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.conflict },
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
    'dateTimePicker.storyName.error422UnprocessableEntity',
    'Error 422: Unprocessable Entity'
  ),
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('dateTimePicker.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.tooManyRequests },
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
    'dateTimePicker.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('dateTimePicker.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.badGateway },
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
    'dateTimePicker.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('dateTimePicker.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.gatewayTimeout },
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
  name: i18n.t('dateTimePicker.storyName.networkError', 'Network Error'),
  ...Default,
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

// ============ FACTORY: LABELS ============

function LabelsEnDemo() {
  const labels = createFakeDateTimePickerLabelsEn();

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.labelsEn')}</h3>
      <dl className="text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{i18n.t('dateTimePicker.factory.hour')}:</dt>
          <dd data-testid="hour-label">{labels.hourLabel}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{i18n.t('dateTimePicker.factory.minute')}:</dt>
          <dd data-testid="minute-label">{labels.minuteLabel}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">AM:</dt>
          <dd data-testid="am-label">{labels.amLabel}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">PM:</dt>
          <dd data-testid="pm-label">{labels.pmLabel}</dd>
        </div>
        {labels.secondLabel && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{i18n.t('dateTimePicker.factory.second')}:</dt>
            <dd data-testid="second-label">{labels.secondLabel}</dd>
          </div>
        )}
      </dl>
      <DateTimePickerDemo startEmpty placeholder={labels.placeholder} />
    </div>
  );
}

export const FactoryLabelsEn: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryLabelsEn', 'Factory: Labels (English)'),
  render: () => <LabelsEnDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('hour-label')).toHaveTextContent('Hour');
    expect(canvas.getByTestId('minute-label')).toHaveTextContent('Minute');
    expect(canvas.getByTestId('am-label')).toHaveTextContent('AM');
    expect(canvas.getByTestId('pm-label')).toHaveTextContent('PM');
    expect(canvas.getByTestId('second-label')).toHaveTextContent('Second');
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function LabelsJaDemo() {
  const labels = createFakeDateTimePickerLabelsJa();

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.labelsJa')}</h3>
      <dl className="text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{i18n.t('dateTimePicker.factory.hour')}:</dt>
          <dd data-testid="hour-label">{labels.hourLabel}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{i18n.t('dateTimePicker.factory.minute')}:</dt>
          <dd data-testid="minute-label">{labels.minuteLabel}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">AM:</dt>
          <dd data-testid="am-label">{labels.amLabel}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">PM:</dt>
          <dd data-testid="pm-label">{labels.pmLabel}</dd>
        </div>
      </dl>
      <DateTimePickerDemo startEmpty placeholder={labels.placeholder} />
    </div>
  );
}

export const FactoryLabelsJa: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryLabelsJa', 'Factory: Labels (Japanese)'),
  render: () => <LabelsJaDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('am-label')).toBeInTheDocument();
    expect(canvas.getByTestId('pm-label')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: TIME VALUES ============

function TimeValueDemo() {
  const timeValue = createFakeTimeValue();

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.timeValue')}</h3>
      <div className="text-sm" data-testid="time-value">
        <span>{timeValue.hour}</span>:<span>{String(timeValue.minute).padStart(2, '0')}</span>
        {timeValue.period && <span className="ml-1">{timeValue.period}</span>}
      </div>
      <DateTimePickerDemo startEmpty={false} />
    </div>
  );
}

export const FactoryTimeValue: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryTimeValue', 'Factory: Time Value'),
  render: () => <TimeValueDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('time-value')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function TimeValuesDemo() {
  const timeValues = createFakeTimeValues(5);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.timeValues')}</h3>
      <ul className="space-y-1 text-sm" data-testid="time-values-list">
        {timeValues.map((tv) => (
          <li key={`${tv.hour}-${tv.minute}-${tv.period ?? 'none'}`}>
            {tv.hour}:{String(tv.minute).padStart(2, '0')} {tv.period ?? ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const FactoryTimeValues: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryTimeValues', 'Factory: Multiple Time Values'),
  render: () => <TimeValuesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByTestId('time-values-list');
    expect(list.querySelectorAll('li').length).toBe(5);
  },
};

// ============ FACTORY: DATE TIME VALUE ============

function DateTimeValueDemo() {
  const dtValue = createFakeDateTimeValue();

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.dateTimeValue')}</h3>
      <dl className="text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Date:</dt>
          <dd data-testid="date-value">{dtValue.date.toLocaleDateString()}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Formatted:</dt>
          <dd data-testid="formatted-value">{dtValue.formatted}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Time:</dt>
          <dd data-testid="time-display">
            {dtValue.time.hour}:{String(dtValue.time.minute).padStart(2, '0')}{' '}
            {dtValue.time.period ?? ''}
          </dd>
        </div>
      </dl>
      <DateTimePickerDemo startEmpty={false} />
    </div>
  );
}

export const FactoryDateTimeValue: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryDateTimeValue', 'Factory: Date Time Value'),
  render: () => <DateTimeValueDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('date-value')).toBeInTheDocument();
    expect(canvas.getByTestId('formatted-value')).toBeInTheDocument();
    expect(canvas.getByTestId('time-display')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: SINGLE PICKER ============

function SinglePickerDemo() {
  const picker = createFakeDateTimePicker();
  const [date, setDate] = React.useState<Date | undefined>(picker.dateTime);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.picker')}</h3>
      <p className="text-muted-foreground text-xs">
        State: {picker.state} | Format: {picker.use24Hour ? '24h' : '12h'} |{' '}
        {i18n.t('dateTimePicker.factory.interval', { interval: picker.minuteInterval })}
      </p>
      <div className="w-[360px]">
        <DateTimePicker
          date={date}
          setDate={setDate}
          displayFormat={picker.displayFormat}
          placeholder={picker.placeholder}
        />
      </div>
    </div>
  );
}

export const FactorySinglePicker: Story = {
  name: i18n.t('dateTimePicker.storyName.factorySinglePicker', 'Factory: Single Picker'),
  render: () => <SinglePickerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: PICKER STATES ============

function PickerOpenDemo() {
  const picker = createFakeDateTimePickerOpen();
  const [date, setDate] = React.useState<Date | undefined>(picker.dateTime);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.pickerOpen')}</h3>
      <div className="w-[360px]">
        <DateTimePicker
          date={date}
          setDate={setDate}
          defaultOpen={picker.defaultOpen}
          placeholder={picker.placeholder}
        />
      </div>
    </div>
  );
}

export const FactoryPickerOpen: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryPickerOpen', 'Factory: Open State'),
  render: () => <PickerOpenDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function PickerLoadingDemo() {
  const picker = createFakeDateTimePickerLoading();

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.pickerLoading')}</h3>
      <p className="text-muted-foreground text-xs" data-testid="loading-state">
        State: {picker.state}
      </p>
      <div className="w-[360px]">
        <DateTimePicker
          date={picker.dateTime}
          setDate={() => {}}
          placeholder={picker.placeholder}
        />
      </div>
    </div>
  );
}

export const FactoryPickerLoading: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryPickerLoading', 'Factory: Loading State'),
  render: () => <PickerLoadingDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('loading-state')).toHaveTextContent('loading');
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function PickerErrorDemo() {
  const picker = createFakeDateTimePickerError();

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.pickerError')}</h3>
      <p className="text-muted-foreground text-xs" data-testid="error-state">
        State: {picker.state}
      </p>
      <div className="w-[360px]">
        <DateTimePicker
          date={picker.dateTime}
          setDate={() => {}}
          placeholder={picker.placeholder}
        />
      </div>
    </div>
  );
}

export const FactoryPickerError: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryPickerError', 'Factory: Error State'),
  render: () => <PickerErrorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('error-state')).toHaveTextContent('error');
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function PickerDisabledDemo() {
  const picker = createFakeDateTimePickerDisabled();

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.pickerDisabled')}</h3>
      <p className="text-muted-foreground text-xs" data-testid="disabled-state">
        State: {picker.state}
      </p>
      <div className="w-[360px]">
        <DateTimePicker
          date={picker.dateTime}
          setDate={() => {}}
          placeholder={picker.placeholder}
        />
      </div>
    </div>
  );
}

export const FactoryPickerDisabled: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryPickerDisabled', 'Factory: Disabled State'),
  render: () => <PickerDisabledDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('disabled-state')).toHaveTextContent('disabled');
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function PickerEmptyDemo() {
  const picker = createFakeDateTimePickerEmpty();
  const [date, setDate] = React.useState<Date | undefined>(picker.dateTime);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.pickerEmpty')}</h3>
      <div className="w-[360px]">
        <DateTimePicker date={date} setDate={setDate} placeholder={picker.placeholder} />
      </div>
    </div>
  );
}

export const FactoryPickerEmpty: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryPickerEmpty', 'Factory: Empty State'),
  render: () => <PickerEmptyDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function Picker24HourDemo() {
  const picker = createFakeDateTimePicker24Hour();
  const [date, setDate] = React.useState<Date | undefined>(picker.dateTime);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.picker24Hour')}</h3>
      <p className="text-muted-foreground text-xs" data-testid="format-info">
        {i18n.t('dateTimePicker.factory.format24')} | Format: {picker.displayFormat}
      </p>
      <div className="w-[360px]">
        <DateTimePicker
          date={date}
          setDate={setDate}
          displayFormat={picker.displayFormat}
          placeholder={picker.placeholder}
        />
      </div>
    </div>
  );
}

export const FactoryPicker24Hour: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryPicker24Hour', 'Factory: 24-Hour Format'),
  render: () => <Picker24HourDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('format-info')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function PickerWithSecondsDemo() {
  const picker = createFakeDateTimePickerWithSeconds();
  const [date, setDate] = React.useState<Date | undefined>(picker.dateTime);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">
        {i18n.t('dateTimePicker.factory.pickerWithSeconds')}
      </h3>
      <p className="text-muted-foreground text-xs" data-testid="seconds-info">
        Show seconds: {String(picker.showSeconds)}
      </p>
      <div className="w-[360px]">
        <DateTimePicker date={date} setDate={setDate} placeholder={picker.placeholder} />
      </div>
    </div>
  );
}

export const FactoryPickerWithSeconds: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryPickerWithSeconds', 'Factory: With Seconds'),
  render: () => <PickerWithSecondsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('seconds-info')).toHaveTextContent('true');
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: SELECTIONS ============

function SelectionDemo() {
  const selection = createFakeDateTimeSelection();

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.selection')}</h3>
      <dl className="text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">ID:</dt>
          <dd data-testid="selection-id">{selection.id}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Date:</dt>
          <dd data-testid="selection-date">{selection.dateTime.toLocaleString()}</dd>
        </div>
        {selection.previousDateTime && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{i18n.t('dateTimePicker.factory.previous')}:</dt>
            <dd data-testid="selection-prev">{selection.previousDateTime.toLocaleString()}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Timestamp:</dt>
          <dd data-testid="selection-ts">{selection.timestamp.toISOString()}</dd>
        </div>
      </dl>
    </div>
  );
}

export const FactorySelection: Story = {
  name: i18n.t('dateTimePicker.storyName.factorySelection', 'Factory: Selection Event'),
  render: () => <SelectionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('selection-id')).toBeInTheDocument();
    expect(canvas.getByTestId('selection-date')).toBeInTheDocument();
    expect(canvas.getByTestId('selection-ts')).toBeInTheDocument();
  },
};

function SelectionsDemo() {
  const selections = createFakeDateTimeSelections(4);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.selections')}</h3>
      <ul className="space-y-2 text-sm" data-testid="selections-list">
        {selections.map((sel) => (
          <li key={sel.id} className="border-border rounded border p-2">
            <span className="text-muted-foreground text-xs">{sel.id.slice(0, 8)}</span>
            <br />
            {sel.dateTime.toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const FactorySelections: Story = {
  name: i18n.t('dateTimePicker.storyName.factorySelections', 'Factory: Multiple Selections'),
  render: () => <SelectionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByTestId('selections-list');
    expect(list.querySelectorAll('li').length).toBe(4);
  },
};

// ============ FACTORY: VALIDATION ============

function ValidationDemo() {
  const validResult = createFakeDateTimeValidation({ isValid: true });
  const invalidResult = createFakeDateTimeValidation({ isValid: false });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.section.validation')}</h3>
      <div className="space-y-2">
        <h4 className="text-sm font-medium">{i18n.t('dateTimePicker.factory.validationValid')}</h4>
        <div className="rounded border border-green-500 p-3 text-sm" data-testid="valid-result">
          <p>Valid: {String(validResult.isValid)}</p>
          <p>{i18n.t('dateTimePicker.factory.noErrors')}</p>
          <p>Date: {validResult.dateTime.toLocaleString()}</p>
          {validResult.minDateTime && (
            <p>
              {i18n.t('dateTimePicker.factory.minMax')}: {validResult.minDateTime.toLocaleString()}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-medium">
          {i18n.t('dateTimePicker.factory.validationInvalid')}
        </h4>
        <div className="rounded border border-red-500 p-3 text-sm" data-testid="invalid-result">
          <p>Valid: {String(invalidResult.isValid)}</p>
          <p>
            {i18n.t('dateTimePicker.factory.errors')}: {invalidResult.errors.join(', ')}
          </p>
        </div>
      </div>
    </div>
  );
}

export const FactoryValidation: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryValidation', 'Factory: Validation Results'),
  render: () => <ValidationDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('valid-result')).toHaveTextContent('true');
    expect(canvas.getByTestId('invalid-result')).toHaveTextContent('false');
  },
};

// ============ FACTORY: TIME SLOTS ============

function TimeSlotDemo() {
  const slot = createFakeTimeSlot();

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.timeSlot')}</h3>
      <div className="text-sm" data-testid="time-slot">
        <p>{slot.label}</p>
        <p>
          {slot.startTime} - {slot.endTime}
        </p>
        <p className={slot.available ? 'text-green-600' : 'text-red-600'}>
          {slot.available
            ? i18n.t('dateTimePicker.factory.available')
            : i18n.t('dateTimePicker.factory.unavailable')}
        </p>
      </div>
    </div>
  );
}

export const FactoryTimeSlot: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryTimeSlot', 'Factory: Time Slot'),
  render: () => <TimeSlotDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('time-slot')).toBeInTheDocument();
  },
};

function TimeSlotsForDayDemo() {
  const slots = createFakeTimeSlotsForDay(9, 17);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.timeSlotsForDay')}</h3>
      <div className="grid grid-cols-2 gap-2" data-testid="day-slots">
        {slots.map((slot) => (
          <div
            key={`${slot.startTime}-${slot.endTime}`}
            className={`rounded border p-2 text-xs ${
              slot.available
                ? 'border-green-300 bg-green-50 dark:bg-green-950'
                : 'border-red-300 bg-red-50 dark:bg-red-950'
            }`}
          >
            <p className="font-medium">{slot.label}</p>
            <p>
              {slot.available
                ? i18n.t('dateTimePicker.factory.available')
                : i18n.t('dateTimePicker.factory.unavailable')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryTimeSlotsForDay: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryTimeSlotsForDay', 'Factory: Day Schedule'),
  render: () => <TimeSlotsForDayDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const slotsContainer = canvas.getByTestId('day-slots');
    expect(slotsContainer.children.length).toBe(8);
  },
};

// ============ FACTORY: SHOWCASE ============

function ShowcaseDemo() {
  const showcase = createFakeDateTimePickerShowcase();
  const [dates, setDates] = React.useState<Record<string, Date | undefined>>(
    Object.fromEntries(showcase.pickers.map((p) => [p.id, p.dateTime]))
  );

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.showcase')}</h3>

      <div className="space-y-3">
        <h4 className="text-sm font-medium">Pickers ({showcase.pickers.length})</h4>
        <div className="grid gap-4" data-testid="showcase-pickers">
          {showcase.pickers.map((picker) => (
            <div key={picker.id} className="w-[320px]">
              <p className="text-muted-foreground mb-1 text-xs">
                {picker.state} | {picker.use24Hour ? '24h' : '12h'} | {picker.minuteInterval}min
              </p>
              <DateTimePicker
                date={dates[picker.id]}
                setDate={(d) => setDates((prev) => ({ ...prev, [picker.id]: d }))}
                displayFormat={picker.displayFormat}
                placeholder={picker.placeholder}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium">
          {i18n.t('dateTimePicker.section.selections')} ({showcase.selections.length})
        </h4>
        <ul className="text-sm" data-testid="showcase-selections">
          {showcase.selections.map((sel) => (
            <li key={sel.id}>{sel.dateTime.toLocaleString()}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium">
          {i18n.t('dateTimePicker.section.timeSlots')} ({showcase.timeSlots.length})
        </h4>
        <div className="flex flex-wrap gap-1" data-testid="showcase-slots">
          {showcase.timeSlots.map((slot) => (
            <span
              key={`${slot.startTime}-${slot.endTime}`}
              className={`rounded px-2 py-1 text-xs ${
                slot.available ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
              }`}
            >
              {slot.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryShowcase: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryShowcase', 'Factory: Showcase'),
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('showcase-pickers').children.length).toBeGreaterThanOrEqual(1);
    expect(canvas.getByTestId('showcase-selections').querySelectorAll('li').length).toBe(5);
    expect(canvas.getByTestId('showcase-slots').children.length).toBeGreaterThanOrEqual(1);
  },
};

// ============ FACTORY: USE CASES ============

function AppointmentPickerDemo() {
  const picker = createFakeAppointmentPicker();
  const [date, setDate] = React.useState<Date | undefined>(picker.dateTime);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.appointment')}</h3>
      <p className="text-muted-foreground text-xs" data-testid="appointment-info">
        {i18n.t('dateTimePicker.factory.interval', { interval: picker.minuteInterval })}
      </p>
      <div className="w-[360px]">
        <DateTimePicker
          date={date}
          setDate={setDate}
          displayFormat={picker.displayFormat}
          placeholder={picker.labels.placeholder}
        />
      </div>
    </div>
  );
}

export const FactoryAppointmentPicker: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryAppointmentPicker', 'Factory: Appointment Picker'),
  render: () => <AppointmentPickerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('appointment-info')).toHaveTextContent('15');
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function MeetingPickerDemo() {
  const picker = createFakeMeetingPicker();
  const [date, setDate] = React.useState<Date | undefined>(picker.dateTime);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.meeting')}</h3>
      <p className="text-muted-foreground text-xs" data-testid="meeting-info">
        {i18n.t('dateTimePicker.factory.interval', { interval: picker.minuteInterval })}
      </p>
      <div className="w-[360px]">
        <DateTimePicker
          date={date}
          setDate={setDate}
          displayFormat={picker.displayFormat}
          placeholder={picker.labels.placeholder}
        />
      </div>
    </div>
  );
}

export const FactoryMeetingPicker: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryMeetingPicker', 'Factory: Meeting Picker'),
  render: () => <MeetingPickerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('meeting-info')).toHaveTextContent('30');
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DeadlinePickerDemo() {
  const picker = createFakeDeadlinePicker();
  const [date, setDate] = React.useState<Date | undefined>(picker.dateTime);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.deadline')}</h3>
      <p className="text-muted-foreground text-xs" data-testid="deadline-info">
        {i18n.t('dateTimePicker.factory.format24')} |{' '}
        {i18n.t('dateTimePicker.factory.interval', { interval: picker.minuteInterval })}
      </p>
      <div className="w-[360px]">
        <DateTimePicker
          date={date}
          setDate={setDate}
          displayFormat={picker.displayFormat}
          placeholder={picker.labels.placeholder}
        />
      </div>
    </div>
  );
}

export const FactoryDeadlinePicker: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryDeadlinePicker', 'Factory: Deadline Picker'),
  render: () => <DeadlinePickerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('deadline-info')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function SchedulingPickerDemo() {
  const picker = createFakeSchedulingPicker();
  const [date, setDate] = React.useState<Date | undefined>(picker.dateTime);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.factory.scheduling')}</h3>
      <p className="text-muted-foreground text-xs" data-testid="scheduling-info">
        {i18n.t('dateTimePicker.factory.interval', { interval: picker.minuteInterval })}
      </p>
      <div className="w-[360px]">
        <DateTimePicker
          date={date}
          setDate={setDate}
          displayFormat={picker.displayFormat}
          placeholder={picker.labels.placeholder}
        />
      </div>
    </div>
  );
}

export const FactorySchedulingPicker: Story = {
  name: i18n.t('dateTimePicker.storyName.factorySchedulingPicker', 'Factory: Scheduling Picker'),
  render: () => <SchedulingPickerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('scheduling-info')).toHaveTextContent('15');
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: CONSTANTS ============

function ConstantsDemo() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.section.constants')}</h3>

      <div>
        <h4 className="text-sm font-medium">TIME_PERIODS</h4>
        <p className="text-sm" data-testid="time-periods">
          {TIME_PERIODS.join(', ')}
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium">DATE_TIME_PICKER_STATES</h4>
        <p className="text-sm" data-testid="picker-states">
          {DATE_TIME_PICKER_STATES.join(', ')}
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium">DISPLAY_FORMATS</h4>
        <p className="text-sm" data-testid="display-formats">
          {DISPLAY_FORMATS.join(', ')}
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium">TIME_GRANULARITIES</h4>
        <p className="text-sm" data-testid="time-granularities">
          {TIME_GRANULARITIES.join(', ')}
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium">HOURS_12</h4>
        <p className="text-sm" data-testid="hours-12">
          {HOURS_12.join(', ')}
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium">HOURS_24</h4>
        <p className="text-sm" data-testid="hours-24">
          {HOURS_24.join(', ')}
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium">MINUTES</h4>
        <p className="text-sm" data-testid="minutes-count">
          {MINUTES.length} values (0-59)
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium">MINUTE_INTERVALS</h4>
        <p className="text-sm" data-testid="minute-intervals">
          {MINUTE_INTERVALS.join(', ')}
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium">FORMAT_STRINGS</h4>
        <dl className="text-sm" data-testid="format-strings">
          {Object.entries(FORMAT_STRINGS).map(([key, val]) => (
            <div key={key} className="flex gap-2">
              <dt className="text-muted-foreground">{key}:</dt>
              <dd>{val}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h4 className="text-sm font-medium">PLACEHOLDER_STRINGS</h4>
        <dl className="text-sm" data-testid="placeholder-strings">
          {Object.entries(PLACEHOLDER_STRINGS).map(([key, val]) => (
            <div key={key} className="flex gap-2">
              <dt className="text-muted-foreground">{key}:</dt>
              <dd>{val}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryConstants', 'Factory: Constants'),
  render: () => <ConstantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('time-periods')).toHaveTextContent('AM, PM');
    expect(canvas.getByTestId('picker-states')).toHaveTextContent(
      'disabled, error, idle, loading, open'
    );
    expect(canvas.getByTestId('display-formats')).toHaveTextContent(
      '12-hour, 24-hour, iso, localized'
    );
    expect(canvas.getByTestId('time-granularities')).toHaveTextContent('hour, minute, second');
    expect(canvas.getByTestId('hours-12')).toHaveTextContent(
      '1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12'
    );
    expect(canvas.getByTestId('hours-24')).toBeInTheDocument();
    expect(canvas.getByTestId('minutes-count')).toHaveTextContent('60 values (0-59)');
    expect(canvas.getByTestId('minute-intervals')).toHaveTextContent('1, 5, 10, 15, 30');
    expect(canvas.getByTestId('format-strings')).toBeInTheDocument();
    expect(canvas.getByTestId('placeholder-strings')).toBeInTheDocument();
  },
};

// ============ FACTORY: DISPLAY FORMATS ============

const FORMAT_LABEL_KEYS: Record<DisplayFormat, string> = {
  '12-hour': 'dateTimePicker.factory.format12',
  '24-hour': 'dateTimePicker.factory.format24',
  iso: 'dateTimePicker.factory.formatISO',
  localized: 'dateTimePicker.factory.formatLocalized',
};

function DisplayFormatsDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('dateTimePicker.section.formats')}</h3>
      {DISPLAY_FORMATS.map((fmt) => (
        <div key={fmt}>
          <p className="text-muted-foreground mb-1 text-sm">{t(FORMAT_LABEL_KEYS[fmt])}</p>
          <DateTimePickerDemo
            startEmpty={false}
            displayFormat={FORMAT_STRINGS[fmt]}
            placeholder={PLACEHOLDER_STRINGS[fmt]}
          />
        </div>
      ))}
    </div>
  );
}

export const FactoryDisplayFormats: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryDisplayFormats', 'Factory: Display Formats'),
  render: () => <DisplayFormatsDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers.length).toBe(4);
  },
};

// ============ FACTORY: TIME GRANULARITIES ============

const GRANULARITY_LABEL_KEYS: Record<TimeGranularity, string> = {
  hour: 'dateTimePicker.factory.granularityHour',
  minute: 'dateTimePicker.factory.granularityMinute',
  second: 'dateTimePicker.factory.granularitySecond',
};

function TimeGranularitiesDemo() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.section.timeValues')}</h3>
      <div className="space-y-2" data-testid="granularities">
        {TIME_GRANULARITIES.map((g) => (
          <div key={g} className="flex items-center gap-2 text-sm">
            <span className="bg-muted rounded px-2 py-1 font-mono text-xs">{g}</span>
            <span className="text-muted-foreground">{i18n.t(GRANULARITY_LABEL_KEYS[g])}</span>
          </div>
        ))}
      </div>
      <DateTimePickerDemo startEmpty={false} />
    </div>
  );
}

export const FactoryTimeGranularities: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryTimeGranularities', 'Factory: Time Granularities'),
  render: () => <TimeGranularitiesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const granularities = canvas.getByTestId('granularities');
    expect(granularities.children.length).toBe(3);
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: ALL USE CASES COMBINED ============

function AllUseCasesDemo() {
  const appointmentPicker = createFakeAppointmentPicker();
  const meetingPicker = createFakeMeetingPicker();
  const deadlinePicker = createFakeDeadlinePicker();
  const schedulingPicker = createFakeSchedulingPicker();

  const useCases = [
    { label: i18n.t('dateTimePicker.factory.appointment'), picker: appointmentPicker },
    { label: i18n.t('dateTimePicker.factory.meeting'), picker: meetingPicker },
    { label: i18n.t('dateTimePicker.factory.deadline'), picker: deadlinePicker },
    { label: i18n.t('dateTimePicker.factory.scheduling'), picker: schedulingPicker },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{i18n.t('dateTimePicker.section.useCases')}</h3>
      <div className="grid gap-4" data-testid="use-cases">
        {useCases.map((uc) => (
          <div key={uc.label}>
            <p className="mb-1 text-sm font-medium">{uc.label}</p>
            <p className="text-muted-foreground mb-1 text-xs">
              {i18n.t('dateTimePicker.factory.interval', { interval: uc.picker.minuteInterval })} |{' '}
              {uc.picker.use24Hour ? '24h' : '12h'}
            </p>
            <DateTimePickerDemo
              startEmpty
              displayFormat={uc.picker.displayFormat}
              placeholder={uc.picker.labels.placeholder}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryAllUseCases: Story = {
  name: i18n.t('dateTimePicker.storyName.factoryAllUseCases', 'Factory: All Use Cases'),
  render: () => <AllUseCasesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const useCases = canvas.getByTestId('use-cases');
    expect(useCases.children.length).toBe(4);
    const triggers = canvasElement.querySelectorAll('[data-slot="popover-trigger"]');
    expect(triggers.length).toBe(4);
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / DataAttributes / Handler wiring
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('dateTimePicker.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('dateTimePicker.storyName.darkJapanese', 'Dark Mode + Japanese'),
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
  name: i18n.t('dateTimePicker.storyName.dataAttributes', 'Data Attributes'),
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
  },
};

export const StatusSuccess: Story = {
  ...Default,
  name: i18n.t('dateTimePicker.storyName.statusSuccess', 'Handler: Success'),
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.success },
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
  name: i18n.t('dateTimePicker.storyName.emptyDataHandler', 'Handler: Empty Data'),
  parameters: {
    msw: { handlers: dateTimePickerStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
  },
};

export const HandlerNoAvailability: Story = {
  ...Default,
  name: i18n.t('dateTimePicker.storyName.handlerNoAvailability', 'Handler: No Availability'),
  parameters: { msw: { handlers: dateTimePickerStatusHandlers.noAvailability } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
