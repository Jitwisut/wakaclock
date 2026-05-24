import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import type {
  FakeColorSlider,
  FakeFormSlider,
  FakeMediaSlider,
  FakePriceRangeSlider,
  FakeSlider,
  FakeSliderMulti,
  FakeSliderRange,
  FakeSliderSingle,
  FakeSliderWithDomain,
  FakeSliderWithLabels,
  FakeTimeRangeSlider,
  SliderDomain,
  SliderMode,
  SliderOrientation,
  SliderSize,
  SliderStepPreset,
} from '@/.storybook/stories/_factories/slider.factory';
import {
  createFakeBrightnessSlider,
  createFakeColorSlider,
  createFakeFormSlider,
  createFakeMediaSlider,
  createFakePriceRangeSlider,
  createFakeRatingSlider,
  createFakeSlider,
  createFakeSliderMulti,
  createFakeSliderRange,
  createFakeSliders,
  createFakeSliderSingle,
  createFakeSliderWithDomain,
  createFakeSliderWithLabels,
  createFakeSpeedSlider,
  createFakeTemperatureSlider,
  createFakeTimeRangeSlider,
  createFakeVolumeSlider,
  createFakeZoomSlider,
  createSliderDomainMatrix,
  createSliderModeMatrix,
  createSliderOrientationMatrix,
  createSliderShowcase,
  createSliderSizeMatrix,
  createSliderStepMatrix,
  createSliderTestData,
  SLIDER_DOMAIN_CONFIGS,
  SLIDER_DOMAINS,
  SLIDER_MODES,
  SLIDER_ORIENTATIONS,
  SLIDER_SIZE_WIDTHS,
  SLIDER_SIZES,
  SLIDER_STEP_PRESETS,
  SLIDER_STEP_VALUES,
} from '@/.storybook/stories/_factories/slider.factory';
import {
  sliderHandlers,
  sliderStatusHandlers,
} from '@/.storybook/stories/_handlers/slider.handlers';

import { Slider } from '@/components/ui/slider';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

type SliderSingleDemoProps = {
  ariaLabel?: string;
  initialValue?: number;
  labelPrefix?: string;
};

function SliderSingleDemo({
  ariaLabel = 'Value',
  initialValue = 40,
  labelPrefix = 'Value',
}: SliderSingleDemoProps) {
  const [value, setValue] = React.useState<number[]>([initialValue]);
  return (
    <div
      className="w-[360px] space-y-2"
      data-slider-demo
      data-slider-kind="single"
      data-slider-value={value[0]}
    >
      <div className="text-sm" data-slider-display data-slider-display-kind="single">
        {labelPrefix}: {value[0]}
      </div>
      <Slider aria-label={ariaLabel} onValueChange={setValue} value={value} />
    </div>
  );
}

type SliderRangeDemoProps = {
  ariaLabel?: string;
  initialValue?: number[];
  labelPrefix?: string;
};

function SliderRangeDemo({
  ariaLabel = 'Range',
  initialValue = [20, 80],
  labelPrefix = 'Range',
}: SliderRangeDemoProps) {
  const [value, setValue] = React.useState<number[]>(initialValue);
  return (
    <div
      className="w-[360px] space-y-2"
      data-slider-demo
      data-slider-kind="range"
      data-slider-range-end={value[1]}
      data-slider-range-start={value[0]}
    >
      <div className="text-sm" data-slider-display data-slider-display-kind="range">
        {labelPrefix}: {value[0]} – {value[1]}
      </div>
      <Slider aria-label={ariaLabel} onValueChange={setValue} value={value} />
    </div>
  );
}

function I18nSliderSingleDemo() {
  const { t } = useTranslation();

  return (
    <SliderSingleDemo
      ariaLabel={t('slider.ariaLabel.value')}
      initialValue={40}
      labelPrefix={t('slider.valueLabel')}
    />
  );
}

const meta = {
  title: 'Components/UI/Slider',
  component: Slider,
  tags: ['autodocs'],
  args: {
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    onValueChange: fn(),
    onValueCommit: fn(),
  },
  parameters: {
    msw: { handlers: sliderHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Value
    value: {
      control: 'object',
      description: i18n.t(
        'slider.argType.controlledValueAsArraySingleOrRange',
        'Controlled value as array (single or range)'
      ),
      table: {
        category: 'Value',
        type: { summary: 'number[]' },
      },
    },
    defaultValue: {
      control: 'object',
      description: i18n.t(
        'slider.argType.initialValueForUncontrolledSlider',
        'Initial value for uncontrolled slider'
      ),
      table: {
        category: 'Value',
        type: { summary: 'number[]' },
      },
    },
    // Range
    min: {
      control: { type: 'number', min: 0, max: 1000 },
      description: i18n.t('slider.argType.minimumAllowedValue', 'Minimum allowed value'),
      table: {
        category: 'Range',
        defaultValue: { summary: '0' },
        type: { summary: 'number' },
      },
    },
    max: {
      control: { type: 'number', min: 0, max: 1000 },
      description: i18n.t('slider.argType.maximumAllowedValue', 'Maximum allowed value'),
      table: {
        category: 'Range',
        defaultValue: { summary: '100' },
        type: { summary: 'number' },
      },
    },
    step: {
      control: { type: 'number', min: 0.1, max: 100, step: 0.1 },
      description: i18n.t(
        'slider.argType.stepIncrementBetweenValues',
        'Step increment between values'
      ),
      table: {
        category: 'Range',
        defaultValue: { summary: '1' },
        type: { summary: 'number' },
      },
    },
    minStepsBetweenThumbs: {
      control: { type: 'number', min: 0, max: 100 },
      description: i18n.t(
        'slider.argType.minimumStepsBetweenThumbsInRangeMode',
        'Minimum steps between thumbs in range mode'
      ),
      table: {
        category: 'Range',
        defaultValue: { summary: '0' },
        type: { summary: 'number' },
      },
    },
    // Layout
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: i18n.t('slider.argType.orientationOfTheSlider', 'Orientation of the slider'),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'horizontal' },
        type: { summary: "'horizontal' | 'vertical'" },
      },
    },
    inverted: {
      control: 'boolean',
      description: i18n.t(
        'slider.argType.whetherTheSliderDirectionIsInverted',
        'Whether the slider direction is inverted'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // State
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'slider.argType.whetherTheSliderIsDisabled',
        'Whether the slider is disabled'
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
        'slider.argType.additionalCssClassesForCustomStyling',
        'Additional CSS classes for custom styling'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // Accessibility
    'aria-label': {
      control: 'text',
      description: i18n.t(
        'slider.argType.accessibleLabelForScreenReaders',
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
        'slider.argType.idOfElementLabelingTheSlider',
        'ID of element labeling the slider'
      ),
      table: {
        category: 'Accessibility',
        type: { summary: 'string' },
      },
    },
    // Events
    onValueChange: {
      action: 'onValueChange',
      description: i18n.t(
        'slider.argType.calledWhenSliderValueChanges',
        'Called when slider value changes'
      ),
      table: { category: 'Events' },
    },
    onValueCommit: {
      action: 'onValueCommit',
      description: i18n.t(
        'slider.argType.calledWhenSliderValueIsCommittedOnMouseUp',
        'Called when slider value is committed (on mouse up)'
      ),
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof Slider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Single: Story = {
  render: () => <SliderSingleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-kind="single"]')).toBeInTheDocument();
    expect(canvas.getByText(/Value:/)).toBeInTheDocument();
  },
};

export const Range: Story = {
  render: () => <SliderRangeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-kind="range"]')).toBeInTheDocument();
    expect(canvas.getByText(/Range:/)).toBeInTheDocument();
    const thumbs = canvasElement.querySelectorAll('[data-slot="slider-thumb"]');
    expect(thumbs.length).toBe(2);
  },
};

export const Playground: Story = {
  ...Single,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

function VariantsDemo() {
  return (
    <div className="space-y-8">
      <div className="w-[360px] space-y-2">
        <p className="text-sm font-medium">{i18n.t('slider.variants.singleValue')}</p>
        <Slider
          defaultValue={[50]}
          aria-label={i18n.t('slider.story.singleValue', 'Single value')}
        />
      </div>
      <div className="w-[360px] space-y-2">
        <p className="text-sm font-medium">{i18n.t('slider.variants.range')}</p>
        <Slider defaultValue={[25, 75]} aria-label={i18n.t('slider.story.range', 'Range')} />
      </div>
      <div className="w-[360px] space-y-2">
        <p className="text-sm font-medium">{i18n.t('slider.variants.disabled')}</p>
        <Slider
          defaultValue={[40]}
          disabled
          aria-label={i18n.t('slider.story.disabled', 'Disabled')}
        />
      </div>
      <div className="w-[360px] space-y-2">
        <p className="text-sm font-medium">{i18n.t('slider.variants.withSteps')}</p>
        <Slider
          defaultValue={[30]}
          step={10}
          aria-label={i18n.t('slider.story.withSteps', 'With steps')}
        />
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sliders = canvasElement.querySelectorAll('[data-slot="slider"]');
    expect(sliders.length).toBe(4);
    expect(canvas.getByText(/Single Value/i)).toBeInTheDocument();
    expect(canvas.getByText(/Range/i)).toBeInTheDocument();
    expect(canvas.getByText(/Disabled/i)).toBeInTheDocument();
    expect(canvas.getByText(/With Steps/i)).toBeInTheDocument();
  },
};

function SizesDemo() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('slider.sizes.narrow')}</p>
        <Slider
          defaultValue={[50]}
          className="w-[200px]"
          aria-label={i18n.t('slider.story.narrow', 'Narrow')}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('slider.sizes.default')}</p>
        <Slider
          defaultValue={[50]}
          className="w-[360px]"
          aria-label={i18n.t('slider.story.default', 'Default')}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('slider.sizes.wide')}</p>
        <Slider
          defaultValue={[50]}
          className="w-[500px]"
          aria-label={i18n.t('slider.story.wide', 'Wide')}
        />
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sliders = canvasElement.querySelectorAll('[data-slot="slider"]');
    expect(sliders.length).toBe(3);
    expect(canvas.getByText(/Narrow/i)).toBeInTheDocument();
    expect(canvas.getByText(/Default/i)).toBeInTheDocument();
    expect(canvas.getByText(/Wide/i)).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const demoRoot = canvasElement.querySelector('[data-slider-demo][data-slider-kind="single"]');

    if (!(demoRoot instanceof HTMLElement)) {
      throw new Error('Slider demo root was not found.');
    }

    expect(demoRoot.getAttribute('data-slider-value')).toBe('40');

    const slider = demoRoot.querySelector('[data-slot="slider"]');
    if (!(slider instanceof HTMLElement)) {
      throw new Error('Slider root was not found.');
    }

    const thumbs = slider.querySelectorAll('[data-slot="slider-thumb"]');
    expect(thumbs.length).toBe(1);

    const thumb = thumbs[0];
    if (!(thumb instanceof HTMLElement)) {
      throw new Error('Slider thumb was not found.');
    }

    thumb.focus();

    await userEvent.keyboard('{ArrowRight}');

    await waitFor(() => {
      expect(thumb.getAttribute('aria-valuenow')).toBe('41');
    });

    await waitFor(() => expect(demoRoot.getAttribute('data-slider-value')).toBe('41'));

    await userEvent.keyboard('{ArrowLeft}');

    await waitFor(() => {
      expect(thumb.getAttribute('aria-valuenow')).toBe('40');
    });

    await waitFor(() => expect(demoRoot.getAttribute('data-slider-value')).toBe('40'));
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
    const thumb = canvasElement.querySelector('[data-slot="slider-thumb"]');
    expect(thumb).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
    const thumb = canvasElement.querySelector('[data-slot="slider-thumb"]');
    expect(thumb).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('slider.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: () => <I18nSliderSingleDemo />,
  play: async (context) => {
    const root = context.canvasElement;

    if (!root.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(root.ownerDocument.documentElement.lang).toBe('ja');

    const display = root.querySelector('[data-slider-display]');

    if (!(display instanceof HTMLElement)) {
      throw new Error('Slider display was not found.');
    }

    expect(display.textContent).toContain('値');

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
  name: i18n.t('slider.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
  name: i18n.t('slider.storyName.accessibility', 'Accessibility'),
  render: () => (
    <div className="w-[360px] space-y-4">
      <div className="space-y-2">
        <label htmlFor="a11y-slider" id="a11y-slider-label" className="text-sm font-medium">
          Volume
        </label>
        <Slider
          id="a11y-slider"
          defaultValue={[50]}
          aria-labelledby="a11y-slider-label"
          aria-describedby="a11y-slider-desc"
          data-testid="a11y-slider"
        />
        <p id="a11y-slider-desc" className="text-muted-foreground text-sm">
          Use arrow keys to adjust the value.
        </p>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const slider = canvasElement.querySelector('[data-testid="a11y-slider"]') as HTMLElement;
    const thumb = slider.querySelector('[data-slot="slider-thumb"]') as HTMLElement;

    // Verify slider has proper role
    expect(slider.getAttribute('role')).toBe('group');

    // Verify thumb has proper role and ARIA attributes
    expect(thumb.getAttribute('role')).toBe('slider');
    expect(thumb.getAttribute('aria-valuenow')).toBe('50');
    expect(thumb.getAttribute('aria-valuemin')).toBe('0');
    expect(thumb.getAttribute('aria-valuemax')).toBe('100');

    // Focus the thumb
    thumb.focus();
    expect(thumb).toHaveFocus();

    // Test keyboard navigation - Arrow Right to increase
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(thumb.getAttribute('aria-valuenow')).toBe('51');
    });

    // Arrow Left to decrease
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(thumb.getAttribute('aria-valuenow')).toBe('50');
    });

    // Home key to go to minimum
    await userEvent.keyboard('{Home}');
    await waitFor(() => {
      expect(thumb.getAttribute('aria-valuenow')).toBe('0');
    });

    // End key to go to maximum
    await userEvent.keyboard('{End}');
    await waitFor(() => {
      expect(thumb.getAttribute('aria-valuenow')).toBe('100');
    });
  },
};

// ============ MSW + FAKER STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const sliders = createFakeSliders(5, { mode: 'single' });

    return (
      <div className="w-[360px] space-y-6" data-testid="faker-slider">
        {sliders.map((slider) => (
          <div key={slider.id} className="space-y-2">
            <div className="text-sm font-medium">{slider.ariaLabel}</div>
            <Slider
              aria-label={slider.ariaLabel}
              data-slider-faker-item
              defaultValue={slider.defaultValue}
              disabled={slider.disabled}
              max={slider.max}
              min={slider.min}
              step={slider.step}
            />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="faker-slider"]');
    expect(container).toBeInTheDocument();

    const sliders = canvasElement.querySelectorAll('[data-slider-faker-item]');
    expect(sliders.length).toBe(5);
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
    const thumb = canvasElement.querySelector('[data-slot="slider-thumb"]');
    expect(thumb).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const SuccessHandler: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const Error429TooManyRequests: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: sliderStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-demo]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSlider ============

function FakeSliderBasicDemo() {
  const { t } = useTranslation();
  const slider: FakeSlider = createFakeSlider({ mode: 'single' });

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-slider-basic">
      <p className="text-sm font-medium">{t('slider.valueLabel')}</p>
      <Slider
        aria-label={slider.ariaLabel}
        defaultValue={slider.defaultValue}
        disabled={slider.disabled}
        max={slider.max}
        min={slider.min}
        step={slider.step}
      />
    </div>
  );
}

export const FakeSliderBasic: Story = {
  render: () => <FakeSliderBasicDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-slider-basic"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvas.getByText(/Value/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSliderSingle ============

function FakeSliderSingleDemo() {
  const slider: FakeSliderSingle = createFakeSliderSingle();
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-slider-single">
      <p className="text-sm font-medium">
        {i18n.t('slider.valueLabel')}: {value[0]}
      </p>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
    </div>
  );
}

export const FakeSliderSingleStory: Story = {
  name: i18n.t('slider.storyName.fakeSliderSingleStory', 'Factory: Single Slider'),
  render: () => <FakeSliderSingleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-slider-single"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    const thumbs = canvasElement.querySelectorAll('[data-slot="slider-thumb"]');
    expect(thumbs.length).toBe(1);
    expect(canvas.getByText(/Value/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSliderRange ============

function FakeSliderRangeDemo() {
  const slider: FakeSliderRange = createFakeSliderRange();
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-slider-range">
      <p className="text-sm font-medium">
        {i18n.t('slider.rangeLabel')}: {value[0]} – {value[1]}
      </p>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        minStepsBetweenThumbs={slider.minStepsBetweenThumbs}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
    </div>
  );
}

export const FakeSliderRangeStory: Story = {
  name: i18n.t('slider.storyName.fakeSliderRangeStory', 'Factory: Range Slider'),
  render: () => <FakeSliderRangeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-slider-range"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    const thumbs = canvasElement.querySelectorAll('[data-slot="slider-thumb"]');
    expect(thumbs.length).toBe(2);
    expect(canvas.getByText(/Range/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSliderMulti ============

function FakeSliderMultiDemo() {
  const slider: FakeSliderMulti = createFakeSliderMulti(4);
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-slider-multi">
      <p className="text-sm font-medium">
        {i18n.t('slider.mode.multi')}: {value.join(', ')}
      </p>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
    </div>
  );
}

export const FakeSliderMultiStory: Story = {
  name: i18n.t('slider.storyName.fakeSliderMultiStory', 'Factory: Multi-Thumb Slider'),
  render: () => <FakeSliderMultiDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-slider-multi"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    const thumbs = canvasElement.querySelectorAll('[data-slot="slider-thumb"]');
    expect(thumbs.length).toBe(4);
    expect(canvas.getByText(/Multi-Thumb/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSliderWithDomain ============

function FakeSliderWithDomainDemo() {
  const slider: FakeSliderWithDomain = createFakeSliderWithDomain('volume');
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-slider-domain">
      <p className="text-sm font-medium">
        {i18n.t('slider.domain.volume')}: {value[0]}
        {slider.unit}
      </p>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
    </div>
  );
}

export const FakeSliderWithDomainStory: Story = {
  name: i18n.t('slider.storyName.fakeSliderWithDomainStory', 'Factory: Domain Slider'),
  render: () => <FakeSliderWithDomainDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-slider-domain"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvas.getByText(/Volume/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeVolumeSlider ============

function FakeVolumeSliderDemo() {
  const slider: FakeSliderWithDomain = createFakeVolumeSlider();
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-volume-slider">
      <p className="text-sm font-medium">
        {i18n.t('slider.domain.volume')}: {value[0]}
        {slider.unit}
      </p>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
    </div>
  );
}

export const FakeVolumeSliderStory: Story = {
  name: i18n.t('slider.storyName.fakeVolumeSliderStory', 'Factory: Volume Slider'),
  render: () => <FakeVolumeSliderDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-volume-slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvas.getByText(/Volume/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeBrightnessSlider ============

function FakeBrightnessSliderDemo() {
  const slider: FakeSliderWithDomain = createFakeBrightnessSlider();
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-brightness-slider">
      <p className="text-sm font-medium">
        {i18n.t('slider.domain.brightness')}: {value[0]}
        {slider.unit}
      </p>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
    </div>
  );
}

export const FakeBrightnessSliderStory: Story = {
  name: i18n.t('slider.storyName.fakeBrightnessSliderStory', 'Factory: Brightness Slider'),
  render: () => <FakeBrightnessSliderDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="fake-brightness-slider"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvas.getByText(/Brightness/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeTemperatureSlider ============

function FakeTemperatureSliderDemo() {
  const slider: FakeSliderWithDomain = createFakeTemperatureSlider();
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-temperature-slider">
      <p className="text-sm font-medium">
        {i18n.t('slider.domain.temperature')}: {value[0]}
        {slider.unit}
      </p>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
    </div>
  );
}

export const FakeTemperatureSliderStory: Story = {
  name: i18n.t('slider.storyName.fakeTemperatureSliderStory', 'Factory: Temperature Slider'),
  render: () => <FakeTemperatureSliderDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvasElement.querySelector('[data-testid="fake-temperature-slider"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvas.getByText(/Temperature/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeZoomSlider ============

function FakeZoomSliderDemo() {
  const slider: FakeSliderWithDomain = createFakeZoomSlider();
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-zoom-slider">
      <p className="text-sm font-medium">
        {i18n.t('slider.domain.zoom')}: {value[0]}
        {slider.unit}
      </p>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
    </div>
  );
}

export const FakeZoomSliderStory: Story = {
  name: i18n.t('slider.storyName.fakeZoomSliderStory', 'Factory: Zoom Slider'),
  render: () => <FakeZoomSliderDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-zoom-slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvas.getByText(/Zoom/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeRatingSlider ============

function FakeRatingSliderDemo() {
  const slider: FakeSliderWithDomain = createFakeRatingSlider();
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-rating-slider">
      <p className="text-sm font-medium">
        {i18n.t('slider.domain.rating')}: {value[0]}
        {slider.unit}
      </p>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
    </div>
  );
}

export const FakeRatingSliderStory: Story = {
  name: i18n.t('slider.storyName.fakeRatingSliderStory', 'Factory: Rating Slider'),
  render: () => <FakeRatingSliderDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-rating-slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvas.getByText(/Rating/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSpeedSlider ============

function FakeSpeedSliderDemo() {
  const slider: FakeSliderWithDomain = createFakeSpeedSlider();
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-speed-slider">
      <p className="text-sm font-medium">
        {i18n.t('slider.domain.speed')}: {value[0]}
        {slider.unit}
      </p>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
    </div>
  );
}

export const FakeSpeedSliderStory: Story = {
  name: i18n.t('slider.storyName.fakeSpeedSliderStory', 'Factory: Speed Slider'),
  render: () => <FakeSpeedSliderDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-speed-slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvas.getByText(/Speed/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakePriceRangeSlider ============

function FakePriceRangeSliderDemo() {
  const slider: FakePriceRangeSlider = createFakePriceRangeSlider();
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-price-slider">
      <p className="text-sm font-medium">
        {i18n.t('slider.domain.price')}: {slider.formatPrice(value[0])} –{' '}
        {slider.formatPrice(value[1])}
      </p>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
    </div>
  );
}

export const FakePriceRangeSliderStory: Story = {
  name: i18n.t('slider.storyName.fakePriceRangeSliderStory', 'Factory: Price Range Slider'),
  render: () => <FakePriceRangeSliderDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-price-slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    const thumbs = canvasElement.querySelectorAll('[data-slot="slider-thumb"]');
    expect(thumbs.length).toBe(2);
    expect(canvas.getByText(/Price Range/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeTimeRangeSlider ============

function FakeTimeRangeSliderDemo() {
  const slider: FakeTimeRangeSlider = createFakeTimeRangeSlider();
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-time-slider">
      <p className="text-sm font-medium">
        {i18n.t('slider.domain.time')}: {slider.formatTime(value[0])} –{' '}
        {slider.formatTime(value[1])}
      </p>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
    </div>
  );
}

export const FakeTimeRangeSliderStory: Story = {
  name: i18n.t('slider.storyName.fakeTimeRangeSliderStory', 'Factory: Time Range Slider'),
  render: () => <FakeTimeRangeSliderDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-time-slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    const thumbs = canvasElement.querySelectorAll('[data-slot="slider-thumb"]');
    expect(thumbs.length).toBe(2);
    expect(canvas.getByText(/Time Range/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeMediaSlider ============

function FakeMediaSliderDemo() {
  const slider: FakeMediaSlider = createFakeMediaSlider();
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-media-slider">
      <p className="text-sm font-medium">
        {i18n.t('slider.domain.media')}: {slider.formatTime(value[0])} /{' '}
        {slider.formatTime(slider.duration)}
      </p>
      <div className="text-muted-foreground text-xs">Buffered: {slider.bufferedPercentage}%</div>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
    </div>
  );
}

export const FakeMediaSliderStory: Story = {
  name: i18n.t('slider.storyName.fakeMediaSliderStory', 'Factory: Media Slider'),
  render: () => <FakeMediaSliderDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-media-slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvas.getByText(/Media Progress/i)).toBeInTheDocument();
    expect(canvas.getByText(/Buffered/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeColorSlider ============

function FakeColorSliderDemo() {
  const hueSlider: FakeColorSlider = createFakeColorSlider('hue');
  const satSlider: FakeColorSlider = createFakeColorSlider('saturation');
  const lightSlider: FakeColorSlider = createFakeColorSlider('lightness');
  const alphaSlider: FakeColorSlider = createFakeColorSlider('alpha');
  const sliders = [hueSlider, satSlider, lightSlider, alphaSlider];

  return (
    <div className="w-[360px] space-y-4" data-testid="fake-color-slider">
      <p className="text-sm font-medium">{i18n.t('slider.domain.color')}</p>
      {sliders.map((slider) => (
        <div key={slider.colorType} className="space-y-1" data-color-type={slider.colorType}>
          <div className="flex items-center gap-2">
            <span className="text-xs capitalize">{slider.colorType}</span>
            <span
              className="inline-block h-4 w-4 rounded border"
              style={{ backgroundColor: slider.previewColor }}
            />
          </div>
          <Slider
            aria-label={slider.ariaLabel}
            defaultValue={slider.defaultValue}
            max={slider.max}
            min={slider.min}
            step={slider.step}
          />
        </div>
      ))}
    </div>
  );
}

export const FakeColorSliderStory: Story = {
  name: i18n.t('slider.storyName.fakeColorSliderStory', 'Factory: Color Slider'),
  render: () => <FakeColorSliderDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-color-slider"]')).toBeInTheDocument();
    const sliders = canvasElement.querySelectorAll('[data-slot="slider"]');
    expect(sliders.length).toBe(4);
    expect(canvasElement.querySelector('[data-color-type="hue"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-color-type="saturation"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-color-type="lightness"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-color-type="alpha"]')).toBeInTheDocument();
    expect(canvas.getByText(/Color Picker/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeFormSlider ============

function FakeFormSliderDemo() {
  const { t } = useTranslation();
  const slider: FakeFormSlider = createFakeFormSlider();
  const [value, setValue] = React.useState<number[]>(slider.value);

  const validationColors: Record<string, string> = {
    valid: 'text-green-600',
    invalid: 'text-red-600',
    warning: 'text-yellow-600',
    pending: 'text-blue-600',
  };

  return (
    <div className="w-[360px] space-y-2" data-testid="fake-form-slider">
      <label className="text-sm font-medium" htmlFor={slider.id}>
        {t('slider.form.label')}: {slider.name}
        {slider.required && <span className="text-red-500"> *{t('slider.form.required')}</span>}
      </label>
      <Slider
        aria-label={slider.ariaLabel}
        id={slider.id}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">{slider.helpText}</span>
        <span
          className={`text-xs ${validationColors[slider.validationState]}`}
          data-validation={slider.validationState}
        >
          {t('slider.form.validation')}: {slider.validationState}
        </span>
      </div>
      {slider.errorMessage && (
        <p className="text-destructive text-xs" data-error-message>
          {slider.errorMessage}
        </p>
      )}
    </div>
  );
}

export const FakeFormSliderStory: Story = {
  name: i18n.t('slider.storyName.fakeFormSliderStory', 'Factory: Form Slider'),
  render: () => <FakeFormSliderDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-form-slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvas.getByText(/Form Slider/i)).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-validation]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSliderWithLabels ============

function FakeSliderWithLabelsDemo() {
  const slider: FakeSliderWithLabels = createFakeSliderWithLabels({
    min: 0,
    max: 100,
    tickCount: 6,
  });
  const [value, setValue] = React.useState<number[]>(slider.value);

  return (
    <div className="w-[360px] space-y-4" data-testid="fake-labeled-slider">
      <p className="text-sm font-medium">
        {i18n.t('slider.labels.title')}: {value[0]}
      </p>
      <Slider
        aria-label={slider.ariaLabel}
        max={slider.max}
        min={slider.min}
        onValueChange={setValue}
        step={slider.step}
        value={value}
      />
      {slider.showLabels && (
        <div className="flex justify-between" data-slider-labels>
          {slider.labels.map((label) => (
            <span key={label.value} className="text-muted-foreground text-xs">
              {label.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const FakeSliderWithLabelsStory: Story = {
  name: i18n.t('slider.storyName.fakeSliderWithLabelsStory', 'Factory: Labeled Slider'),
  render: () => <FakeSliderWithLabelsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fake-labeled-slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slider-labels]')).toBeInTheDocument();
    expect(canvas.getByText(/Labeled Slider/i)).toBeInTheDocument();
    // Verify labels are present
    expect(canvas.getByText('0')).toBeInTheDocument();
    expect(canvas.getByText('100')).toBeInTheDocument();
  },
};

// ============ FACTORY: createSliderOrientationMatrix + SLIDER_ORIENTATIONS ============

function OrientationMatrixDemo() {
  const { t } = useTranslation();
  const matrix = createSliderOrientationMatrix();
  const orientations: SliderOrientation[] = SLIDER_ORIENTATIONS;

  return (
    <div className="space-y-8" data-testid="orientation-matrix">
      {matrix.map(({ orientation, slider }) => (
        <div
          key={orientation}
          className={orientation === 'vertical' ? 'h-[200px]' : 'w-[360px]'}
          data-orientation={orientation}
        >
          <p className="text-sm font-medium">
            {t(`slider.orientation.${orientation}`)} ({orientations.length} total)
          </p>
          <Slider
            aria-label={slider.ariaLabel}
            defaultValue={slider.defaultValue}
            max={slider.max}
            min={slider.min}
            orientation={orientation}
            step={slider.step}
          />
        </div>
      ))}
    </div>
  );
}

export const OrientationMatrix: Story = {
  name: i18n.t('slider.storyName.orientationMatrix', 'Matrix: Orientations'),
  render: () => <OrientationMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="orientation-matrix"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-orientation="horizontal"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-orientation="vertical"]')).toBeInTheDocument();
    const sliders = canvasElement.querySelectorAll('[data-slot="slider"]');
    expect(sliders.length).toBe(2);
  },
};

// ============ FACTORY: createSliderModeMatrix + SLIDER_MODES ============

function ModeMatrixDemo() {
  const matrix = createSliderModeMatrix();
  const modes: SliderMode[] = SLIDER_MODES;

  return (
    <div className="space-y-8" data-testid="mode-matrix">
      {matrix.map(({ mode, slider }) => (
        <div key={mode} className="w-[360px]" data-mode={mode}>
          <p className="text-sm font-medium">
            {i18n.t(`slider.mode.${mode}`)} ({modes.length} modes)
          </p>
          <Slider
            aria-label={slider.ariaLabel}
            defaultValue={slider.defaultValue}
            max={slider.max}
            min={slider.min}
            step={slider.step}
          />
        </div>
      ))}
    </div>
  );
}

export const ModeMatrix: Story = {
  name: i18n.t('slider.storyName.modeMatrix', 'Matrix: Modes'),
  render: () => <ModeMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="mode-matrix"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-mode="single"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-mode="range"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-mode="multi"]')).toBeInTheDocument();
    const sliders = canvasElement.querySelectorAll('[data-slot="slider"]');
    expect(sliders.length).toBe(3);
  },
};

// ============ FACTORY: createSliderSizeMatrix + SLIDER_SIZES + SLIDER_SIZE_WIDTHS ============

function SizeMatrixDemo() {
  const matrix = createSliderSizeMatrix();
  const sizes: SliderSize[] = SLIDER_SIZES;

  return (
    <div className="space-y-8" data-testid="size-matrix">
      {matrix.map(({ size, width, slider }) => (
        <div key={size} data-size={size}>
          <p className="text-sm font-medium">
            {size} ({width}) — {sizes.length} sizes, widths: {SLIDER_SIZE_WIDTHS[size]}
          </p>
          <div style={{ width }}>
            <Slider
              aria-label={slider.ariaLabel}
              defaultValue={slider.defaultValue}
              max={slider.max}
              min={slider.min}
              step={slider.step}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export const SizeMatrix: Story = {
  name: i18n.t('slider.storyName.sizeMatrix', 'Matrix: Sizes'),
  render: () => <SizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="size-matrix"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-size="narrow"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-size="default"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-size="wide"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-size="full"]')).toBeInTheDocument();
    const sliders = canvasElement.querySelectorAll('[data-slot="slider"]');
    expect(sliders.length).toBe(4);
    expect(canvas.getByText(/narrow/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createSliderDomainMatrix + SLIDER_DOMAINS + SLIDER_DOMAIN_CONFIGS ============

function DomainMatrixDemo() {
  const matrix = createSliderDomainMatrix();
  const domains: SliderDomain[] = SLIDER_DOMAINS;

  return (
    <div className="space-y-6" data-testid="domain-matrix">
      <p className="text-sm font-medium">
        {i18n.t('slider.showcase.title')} — {domains.length} domains
      </p>
      {matrix.map(({ domain, slider }) => {
        const config = SLIDER_DOMAIN_CONFIGS[domain];
        return (
          <div key={domain} className="w-[360px]" data-domain={domain}>
            <p className="text-xs font-medium">
              {config.label} ({config.min}–{config.max} {config.unit})
            </p>
            <Slider
              aria-label={slider.ariaLabel}
              defaultValue={slider.defaultValue}
              max={slider.max}
              min={slider.min}
              step={slider.step}
            />
          </div>
        );
      })}
    </div>
  );
}

export const DomainMatrix: Story = {
  name: i18n.t('slider.storyName.domainMatrix', 'Matrix: Domains'),
  render: () => <DomainMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="domain-matrix"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-domain="volume"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-domain="brightness"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-domain="price"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-domain="temperature"]')).toBeInTheDocument();
    const sliders = canvasElement.querySelectorAll('[data-slot="slider"]');
    expect(sliders.length).toBe(15);
  },
};

// ============ FACTORY: createSliderStepMatrix + SLIDER_STEP_PRESETS + SLIDER_STEP_VALUES ============

function StepMatrixDemo() {
  const matrix = createSliderStepMatrix();
  const presets: SliderStepPreset[] = SLIDER_STEP_PRESETS;

  return (
    <div className="space-y-8" data-testid="step-matrix">
      {matrix.map(({ preset, step, slider }) => (
        <div key={preset} className="w-[360px]" data-step-preset={preset}>
          <p className="text-sm font-medium">
            {i18n.t(`slider.step.${preset}`)} — step: {step}, presets: {presets.length}, values:{' '}
            {SLIDER_STEP_VALUES[preset]}
          </p>
          <Slider
            aria-label={slider.ariaLabel}
            defaultValue={slider.defaultValue}
            max={slider.max}
            min={slider.min}
            step={step}
          />
        </div>
      ))}
    </div>
  );
}

export const StepMatrix: Story = {
  name: i18n.t('slider.storyName.stepMatrix', 'Matrix: Steps'),
  render: () => <StepMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="step-matrix"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-step-preset="fine"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-step-preset="normal"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-step-preset="coarse"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-step-preset="decade"]')).toBeInTheDocument();
    const sliders = canvasElement.querySelectorAll('[data-slot="slider"]');
    expect(sliders.length).toBe(4);
  },
};

// ============ FACTORY: createSliderTestData ============

function TestDataDemo() {
  const testData = createSliderTestData();

  const entries = Object.entries(testData) as [string, FakeSlider][];

  return (
    <div className="space-y-4" data-testid="test-data">
      <p className="text-sm font-medium">
        {i18n.t('slider.testData.title')} — {entries.length} items
      </p>
      {entries.map(([key, slider]) => (
        <div key={key} className="w-[360px]" data-test-data-key={key}>
          <p className="text-xs font-medium">{key}</p>
          <Slider
            aria-label={slider.ariaLabel}
            defaultValue={slider.defaultValue}
            disabled={slider.disabled}
            max={slider.max}
            min={slider.min}
            step={slider.step}
          />
        </div>
      ))}
    </div>
  );
}

export const TestData: Story = {
  name: i18n.t('slider.storyName.testData', 'Factory: Test Data'),
  render: () => <TestDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="test-data"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-test-data-key="basic"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-test-data-key="single"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-test-data-key="range"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-test-data-key="multi"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-test-data-key="volume"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-test-data-key="media"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-test-data-key="form"]')).toBeInTheDocument();
    const sliders = canvasElement.querySelectorAll('[data-slot="slider"]');
    expect(sliders.length).toBe(22);
    expect(canvas.getByText(/Test Data/i)).toBeInTheDocument();
  },
};

// ============ FACTORY: createSliderShowcase ============

function ShowcaseDemo() {
  const showcase = createSliderShowcase();

  return (
    <div className="space-y-8" data-testid="showcase">
      <p className="text-sm font-medium">
        {i18n.t('slider.showcase.title')} — orientations: {showcase.orientationMatrix.length},
        modes: {showcase.modeMatrix.length}, sizes: {showcase.sizeMatrix.length}, domains:{' '}
        {showcase.domainMatrix.length}, steps: {showcase.stepMatrix.length}
      </p>
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase">
          {i18n.t('slider.story.orientationMatrix', 'Orientation Matrix')}
        </h3>
        <div className="flex gap-4" data-showcase-section="orientations">
          {showcase.orientationMatrix.map(({ orientation, slider }) => (
            <div
              key={orientation}
              className={orientation === 'vertical' ? 'h-[150px]' : 'w-[200px]'}
            >
              <Slider
                aria-label={slider.ariaLabel}
                defaultValue={slider.defaultValue}
                max={slider.max}
                min={slider.min}
                orientation={orientation}
                step={slider.step}
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase">
          {i18n.t('slider.story.modeMatrix', 'Mode Matrix')}
        </h3>
        <div className="space-y-4" data-showcase-section="modes">
          {showcase.modeMatrix.map(({ mode, slider }) => (
            <div key={mode} className="w-[300px]">
              <p className="text-xs">{mode}</p>
              <Slider
                aria-label={slider.ariaLabel}
                defaultValue={slider.defaultValue}
                max={slider.max}
                min={slider.min}
                step={slider.step}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const Showcase: Story = {
  name: i18n.t('slider.storyName.showcase', 'Factory: Showcase'),
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="showcase"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-showcase-section="orientations"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-showcase-section="modes"]')).toBeInTheDocument();
    expect(canvas.getByText(/Slider Showcase/i)).toBeInTheDocument();
    const sliders = canvasElement.querySelectorAll('[data-slot="slider"]');
    expect(sliders.length).toBeGreaterThanOrEqual(5);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('slider.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('slider.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('slider.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('slider.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
