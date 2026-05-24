/**
 * Slider Component Factory
 *
 * Generates fake data for Slider component stories and tests.
 * Supports single value, range, and domain-specific slider configurations.
 *
 * @module slider.factory
 */
import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Slider orientation options
 */
export type SliderOrientation = 'horizontal' | 'vertical';

/**
 * Slider mode - single value or range
 */
export type SliderMode = 'multi' | 'range' | 'single';

/**
 * Slider size variants based on track width/height
 */
export type SliderSize = 'default' | 'full' | 'narrow' | 'wide';

/**
 * Domain-specific slider types
 */
export type SliderDomain =
  | 'age'
  | 'brightness'
  | 'distance'
  | 'opacity'
  | 'percentage'
  | 'price'
  | 'progress'
  | 'quantity'
  | 'rating'
  | 'speed'
  | 'temperature'
  | 'time'
  | 'volume'
  | 'weight'
  | 'zoom';

/**
 * Slider step preset sizes
 */
export type SliderStepPreset = 'coarse' | 'decade' | 'fine' | 'normal';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All slider orientations
 */
export const SLIDER_ORIENTATIONS: SliderOrientation[] = ['horizontal', 'vertical'];

/**
 * All slider modes
 */
export const SLIDER_MODES: SliderMode[] = ['single', 'range', 'multi'];

/**
 * All slider sizes
 */
export const SLIDER_SIZES: SliderSize[] = ['narrow', 'default', 'wide', 'full'];

/**
 * All slider domains
 */
export const SLIDER_DOMAINS: SliderDomain[] = [
  'volume',
  'brightness',
  'price',
  'progress',
  'rating',
  'temperature',
  'percentage',
  'zoom',
  'opacity',
  'speed',
  'weight',
  'distance',
  'time',
  'age',
  'quantity',
];

/**
 * Step presets
 */
export const SLIDER_STEP_PRESETS: SliderStepPreset[] = ['fine', 'normal', 'coarse', 'decade'];

/**
 * Size to width mapping
 */
export const SLIDER_SIZE_WIDTHS: Record<SliderSize, string> = {
  narrow: '200px',
  default: '360px',
  wide: '500px',
  full: '100%',
};

/**
 * Step preset values
 */
export const SLIDER_STEP_VALUES: Record<SliderStepPreset, number> = {
  fine: 0.1,
  normal: 1,
  coarse: 5,
  decade: 10,
};

/**
 * Domain configurations
 */
export const SLIDER_DOMAIN_CONFIGS: Record<
  SliderDomain,
  {
    ariaLabel: string;
    defaultValue: number;
    label: string;
    max: number;
    min: number;
    step: number;
    unit: string;
  }
> = {
  volume: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 50,
    unit: '%',
    label: i18n.t('factory.slider.volume', 'Volume'),
    ariaLabel: i18n.t('factory.slider.volumeControl', 'Volume control'),
  },
  brightness: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 75,
    unit: '%',
    label: i18n.t('factory.slider.brightness', 'Brightness'),
    ariaLabel: i18n.t('factory.slider.brightnessControl', 'Brightness control'),
  },
  price: {
    min: 0,
    max: 1000,
    step: 10,
    defaultValue: 250,
    unit: '$',
    label: i18n.t('factory.slider.price', 'Price'),
    ariaLabel: i18n.t('factory.slider.priceFilter', 'Price filter'),
  },
  progress: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
    unit: '%',
    label: i18n.t('factory.slider.progress', 'Progress'),
    ariaLabel: i18n.t('factory.slider.progressIndicator', 'Progress indicator'),
  },
  rating: {
    min: 0,
    max: 5,
    step: 0.5,
    defaultValue: 3,
    unit: '★',
    label: i18n.t('factory.slider.rating', 'Rating'),
    ariaLabel: i18n.t('factory.slider.ratingSelector', 'Rating selector'),
  },
  temperature: {
    min: 16,
    max: 30,
    step: 0.5,
    defaultValue: 22,
    unit: '°C',
    label: i18n.t('factory.slider.temperature', 'Temperature'),
    ariaLabel: i18n.t('factory.slider.temperatureSetting', 'Temperature setting'),
  },
  percentage: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 50,
    unit: '%',
    label: i18n.t('factory.slider.percentage', 'Percentage'),
    ariaLabel: i18n.t('factory.slider.percentageSelector', 'Percentage selector'),
  },
  zoom: {
    min: 25,
    max: 400,
    step: 25,
    defaultValue: 100,
    unit: '%',
    label: i18n.t('factory.slider.zoom', 'Zoom'),
    ariaLabel: i18n.t('factory.slider.zoomLevel', 'Zoom level'),
  },
  opacity: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 100,
    unit: '%',
    label: i18n.t('factory.slider.opacity', 'Opacity'),
    ariaLabel: i18n.t('factory.slider.opacityControl', 'Opacity control'),
  },
  speed: {
    min: 0.25,
    max: 2,
    step: 0.25,
    defaultValue: 1,
    unit: 'x',
    label: i18n.t('factory.slider.speed', 'Speed'),
    ariaLabel: i18n.t('factory.slider.playbackSpeed', 'Playback speed'),
  },
  weight: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 70,
    unit: 'kg',
    label: i18n.t('factory.slider.weight', 'Weight'),
    ariaLabel: i18n.t('factory.slider.weightSelector', 'Weight selector'),
  },
  distance: {
    min: 0,
    max: 100,
    step: 5,
    defaultValue: 25,
    unit: 'km',
    label: i18n.t('factory.slider.distance', 'Distance'),
    ariaLabel: i18n.t('factory.slider.distanceFilter', 'Distance filter'),
  },
  time: {
    min: 0,
    max: 24,
    step: 1,
    defaultValue: 12,
    unit: 'h',
    label: i18n.t('factory.slider.time', 'Time'),
    ariaLabel: i18n.t('factory.slider.timeSelector', 'Time selector'),
  },
  age: {
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 25,
    unit: 'years',
    label: i18n.t('factory.slider.age', 'Age'),
    ariaLabel: i18n.t('factory.slider.ageFilter', 'Age filter'),
  },
  quantity: {
    min: 1,
    max: 100,
    step: 1,
    defaultValue: 1,
    unit: '',
    label: i18n.t('factory.slider.quantity', 'Quantity'),
    ariaLabel: i18n.t('factory.slider.quantitySelector', 'Quantity selector'),
  },
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base slider configuration
 */
export interface FakeSlider {
  ariaDescribedby?: string;
  ariaLabel: string;
  ariaLabelledby?: string;
  className?: string;
  defaultValue: number[];
  disabled: boolean;
  id: string;
  inverted: boolean;
  max: number;
  min: number;
  minStepsBetweenThumbs: number;
  mode: SliderMode;
  orientation: SliderOrientation;
  step: number;
  testId: string;
  value: number[];
}

/**
 * Single value slider
 */
export interface FakeSliderSingle extends FakeSlider {
  defaultValue: [number];
  mode: 'single';
  value: [number];
}

/**
 * Range slider with two thumbs
 */
export interface FakeSliderRange extends FakeSlider {
  defaultValue: [number, number];
  mode: 'range';
  value: [number, number];
}

/**
 * Multi-thumb slider
 */
export interface FakeSliderMulti extends FakeSlider {
  defaultValue: number[];
  mode: 'multi';
  thumbCount: number;
  value: number[];
}

/**
 * Domain-specific slider
 */
export interface FakeSliderWithDomain extends FakeSlider {
  domain: SliderDomain;
  formatValue?: (value: number) => string;
  label: string;
  showUnit: boolean;
  showValue: boolean;
  unit: string;
}

/**
 * Slider with labels and ticks
 */
export interface FakeSliderWithLabels extends FakeSlider {
  labels: { label: string; value: number }[];
  showLabels: boolean;
  showTicks: boolean;
  tickCount: number;
}

/**
 * Price range slider for e-commerce
 */
export interface FakePriceRangeSlider extends FakeSliderRange {
  currency: string;
  currencySymbol: string;
  formatPrice: (value: number) => string;
  maxPrice: number;
  minPrice: number;
}

/**
 * Time range slider
 */
export interface FakeTimeRangeSlider extends FakeSliderRange {
  endTime: number;
  formatTime: (hours: number) => string;
  startTime: number;
}

/**
 * Color/gradient slider
 */
export interface FakeColorSlider extends FakeSliderSingle {
  colorType: 'alpha' | 'hue' | 'lightness' | 'saturation';
  colorValue: number;
  previewColor: string;
}

/**
 * Audio/video progress slider
 */
export interface FakeMediaSlider extends FakeSliderSingle {
  bufferedPercentage: number;
  currentTime: number;
  duration: number;
  formatTime: (seconds: number) => string;
}

/**
 * Form slider with validation
 */
export interface FakeFormSlider extends FakeSlider {
  errorMessage?: string;
  helpText?: string;
  name: string;
  required: boolean;
  validationState: 'invalid' | 'pending' | 'valid' | 'warning';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a random value within range respecting step
 */
function generateSteppedValue(min: number, max: number, step: number): number {
  const steps = Math.floor((max - min) / step);
  const randomSteps = faker.number.int({ min: 0, max: steps });
  return Math.round((min + randomSteps * step) * 100) / 100;
}

/**
 * Generate sorted range values
 */
function generateRangeValues(min: number, max: number, step: number): [number, number] {
  const value1 = generateSteppedValue(min, max, step);
  const value2 = generateSteppedValue(min, max, step);
  return value1 <= value2 ? [value1, value2] : [value2, value1];
}

/**
 * Format time from hours to HH:MM
 */
function formatHoursToTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Format seconds to MM:SS
 */
function formatSecondsToTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ============================================================================
// BASE FACTORIES
// ============================================================================

/**
 * Create a basic fake slider
 */
export function createFakeSlider(overrides?: Partial<FakeSlider>): FakeSlider {
  const min = overrides?.min ?? 0;
  const max = overrides?.max ?? 100;
  const step = overrides?.step ?? 1;
  const mode = overrides?.mode ?? faker.helpers.arrayElement(SLIDER_MODES);

  let value: number[];
  let defaultValue: number[];

  if (mode === 'single') {
    const singleValue = generateSteppedValue(min, max, step);
    value = [singleValue];
    defaultValue = [singleValue];
  } else if (mode === 'range') {
    const rangeValue = generateRangeValues(min, max, step);
    value = rangeValue;
    defaultValue = rangeValue;
  } else {
    const thumbCount = faker.number.int({ min: 3, max: 5 });
    const multiValues = Array.from({ length: thumbCount }, () =>
      generateSteppedValue(min, max, step)
    ).sort((a, b) => a - b);
    value = multiValues;
    defaultValue = multiValues;
  }

  return {
    id: faker.string.uuid(),
    mode,
    orientation: faker.helpers.arrayElement(SLIDER_ORIENTATIONS),
    min,
    max,
    step,
    value: overrides?.value ?? value,
    defaultValue: overrides?.defaultValue ?? defaultValue,
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    inverted: faker.datatype.boolean({ probability: 0.1 }),
    minStepsBetweenThumbs: mode === 'range' ? faker.number.int({ min: 0, max: 5 }) : 0,
    ariaLabel: faker.helpers.arrayElement([
      i18n.t('factory.slider.valueSelector', 'Value selector'),
      i18n.t('factory.slider.rangeSlider', 'Range slider'),
      i18n.t('factory.slider.adjustValue', 'Adjust value'),
      i18n.t('factory.slider.selectRange', 'Select range'),
    ]),
    ariaLabelledby: faker.helpers.maybe(() => `label-${faker.string.alphanumeric(6)}`, {
      probability: 0.3,
    }),
    ariaDescribedby: faker.helpers.maybe(() => `desc-${faker.string.alphanumeric(6)}`, {
      probability: 0.2,
    }),
    className: faker.helpers.maybe(
      () => `w-[${faker.helpers.arrayElement(['200px', '360px', '500px'])}]`,
      {
        probability: 0.5,
      }
    ),
    testId: `slider-${faker.string.alphanumeric(8)}`,
    ...overrides,
  };
}

/**
 * Create multiple fake sliders
 */
export function createFakeSliders(count: number, overrides?: Partial<FakeSlider>): FakeSlider[] {
  return Array.from({ length: count }, () => createFakeSlider(overrides));
}

// ============================================================================
// SINGLE VALUE FACTORIES
// ============================================================================

/**
 * Create a single value slider
 */
export function createFakeSliderSingle(overrides?: Partial<FakeSliderSingle>): FakeSliderSingle {
  const min = overrides?.min ?? 0;
  const max = overrides?.max ?? 100;
  const step = overrides?.step ?? 1;
  const singleValue = generateSteppedValue(min, max, step);

  return {
    ...createFakeSlider({ ...overrides, mode: 'single' }),
    mode: 'single',
    value: (overrides?.value ?? [singleValue]) as [number],
    defaultValue: (overrides?.defaultValue ?? [singleValue]) as [number],
  } as FakeSliderSingle;
}

// ============================================================================
// RANGE FACTORIES
// ============================================================================

/**
 * Create a range slider
 */
export function createFakeSliderRange(overrides?: Partial<FakeSliderRange>): FakeSliderRange {
  const min = overrides?.min ?? 0;
  const max = overrides?.max ?? 100;
  const step = overrides?.step ?? 1;
  const rangeValue = generateRangeValues(min, max, step);

  return {
    ...createFakeSlider({ ...overrides, mode: 'range' }),
    mode: 'range',
    value: overrides?.value ?? rangeValue,
    defaultValue: overrides?.defaultValue ?? rangeValue,
  } as FakeSliderRange;
}

// ============================================================================
// MULTI-THUMB FACTORIES
// ============================================================================

/**
 * Create a multi-thumb slider
 */
export function createFakeSliderMulti(
  thumbCount = 3,
  overrides?: Partial<FakeSliderMulti>
): FakeSliderMulti {
  const min = overrides?.min ?? 0;
  const max = overrides?.max ?? 100;
  const step = overrides?.step ?? 1;

  const multiValues = Array.from({ length: thumbCount }, () =>
    generateSteppedValue(min, max, step)
  ).sort((a, b) => a - b);

  return {
    ...createFakeSlider({ ...overrides, mode: 'multi' }),
    mode: 'multi',
    value: overrides?.value ?? multiValues,
    defaultValue: overrides?.defaultValue ?? multiValues,
    thumbCount,
  } as FakeSliderMulti;
}

// ============================================================================
// DOMAIN-SPECIFIC FACTORIES
// ============================================================================

/**
 * Create a domain-specific slider
 */
export function createFakeSliderWithDomain(
  domain: SliderDomain,
  overrides?: Partial<FakeSliderWithDomain>
): FakeSliderWithDomain {
  const config = SLIDER_DOMAIN_CONFIGS[domain];

  // Extract value-related props and mode to handle tuple type separately
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { value, defaultValue, mode: _mode, ...restOverrides } = overrides ?? {};

  const singleSliderOverrides: Partial<FakeSliderSingle> = {
    min: config.min,
    max: config.max,
    step: config.step,
    ariaLabel: config.ariaLabel,
    ...(restOverrides as Omit<Partial<FakeSlider>, 'defaultValue' | 'mode' | 'value'>),
  };

  // Add value/defaultValue with proper tuple typing if provided
  if (value !== undefined) {
    singleSliderOverrides.value = value as [number];
  }
  if (defaultValue !== undefined) {
    singleSliderOverrides.defaultValue = defaultValue as [number];
  }

  return {
    ...createFakeSliderSingle(singleSliderOverrides),
    domain,
    unit: config.unit,
    label: config.label,
    showValue: true,
    showUnit: true,
    formatValue: (v: number) => `${v}${config.unit}`,
    ...overrides,
  } as FakeSliderWithDomain;
}

/**
 * Create a volume slider
 */
export function createFakeVolumeSlider(
  overrides?: Partial<FakeSliderWithDomain>
): FakeSliderWithDomain {
  return createFakeSliderWithDomain('volume', {
    value: [faker.number.int({ min: 0, max: 100 })],
    ...overrides,
  });
}

/**
 * Create a brightness slider
 */
export function createFakeBrightnessSlider(
  overrides?: Partial<FakeSliderWithDomain>
): FakeSliderWithDomain {
  return createFakeSliderWithDomain('brightness', {
    value: [faker.number.int({ min: 25, max: 100 })],
    ...overrides,
  });
}

/**
 * Create a temperature slider
 */
export function createFakeTemperatureSlider(
  overrides?: Partial<FakeSliderWithDomain>
): FakeSliderWithDomain {
  return createFakeSliderWithDomain('temperature', {
    value: [faker.number.float({ min: 18, max: 26, fractionDigits: 1 })],
    ...overrides,
  });
}

/**
 * Create a zoom slider
 */
export function createFakeZoomSlider(
  overrides?: Partial<FakeSliderWithDomain>
): FakeSliderWithDomain {
  return createFakeSliderWithDomain('zoom', {
    value: [faker.helpers.arrayElement([50, 75, 100, 125, 150, 200])],
    ...overrides,
  });
}

/**
 * Create a rating slider
 */
export function createFakeRatingSlider(
  overrides?: Partial<FakeSliderWithDomain>
): FakeSliderWithDomain {
  return createFakeSliderWithDomain('rating', {
    value: [faker.number.float({ min: 0, max: 5, fractionDigits: 1 })],
    ...overrides,
  });
}

/**
 * Create a playback speed slider
 */
export function createFakeSpeedSlider(
  overrides?: Partial<FakeSliderWithDomain>
): FakeSliderWithDomain {
  return createFakeSliderWithDomain('speed', {
    value: [faker.helpers.arrayElement([0.5, 0.75, 1, 1.25, 1.5, 2])],
    ...overrides,
  });
}

// ============================================================================
// E-COMMERCE FACTORIES
// ============================================================================

/**
 * Create a price range slider
 */
export function createFakePriceRangeSlider(
  overrides?: Partial<FakePriceRangeSlider>
): FakePriceRangeSlider {
  const minPrice = overrides?.minPrice ?? 0;
  const maxPrice = overrides?.maxPrice ?? 1000;
  const currency = overrides?.currency ?? faker.helpers.arrayElement(['USD', 'EUR', 'GBP', 'JPY']);

  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  };

  const currencySymbol = currencySymbols[currency] || '$';
  const rangeValue = generateRangeValues(minPrice, maxPrice, 10);

  return {
    ...createFakeSliderRange({
      min: minPrice,
      max: maxPrice,
      step: 10,
      value: rangeValue,
      defaultValue: rangeValue,
      ariaLabel: i18n.t('factory.slider.priceRangeFilter', 'Price range filter'),
      ...overrides,
    }),
    currency,
    currencySymbol,
    minPrice,
    maxPrice,
    formatPrice: (value: number) => `${currencySymbol}${value.toLocaleString()}`,
  } as FakePriceRangeSlider;
}

// ============================================================================
// TIME FACTORIES
// ============================================================================

/**
 * Create a time range slider (hours of day)
 */
export function createFakeTimeRangeSlider(
  overrides?: Partial<FakeTimeRangeSlider>
): FakeTimeRangeSlider {
  const startTime = faker.number.int({ min: 0, max: 12 });
  const endTime = faker.number.int({ min: startTime + 1, max: 24 });

  return {
    ...createFakeSliderRange({
      min: 0,
      max: 24,
      step: 1,
      value: [startTime, endTime],
      defaultValue: [startTime, endTime],
      ariaLabel: i18n.t('factory.slider.timeRangeSelector', 'Time range selector'),
      ...overrides,
    }),
    startTime,
    endTime,
    formatTime: formatHoursToTime,
  } as FakeTimeRangeSlider;
}

// ============================================================================
// MEDIA FACTORIES
// ============================================================================

/**
 * Create a media progress slider
 */
export function createFakeMediaSlider(overrides?: Partial<FakeMediaSlider>): FakeMediaSlider {
  const duration = overrides?.duration ?? faker.number.int({ min: 60, max: 3600 });
  const currentTime = faker.number.int({ min: 0, max: duration });
  const bufferedPercentage = faker.number.int({ min: currentTime, max: duration });

  return {
    ...createFakeSliderSingle({
      min: 0,
      max: duration,
      step: 1,
      value: [currentTime],
      defaultValue: [0],
      ariaLabel: i18n.t('factory.slider.seekSlider', 'Seek slider'),
      ...overrides,
    }),
    currentTime,
    duration,
    bufferedPercentage: Math.round((bufferedPercentage / duration) * 100),
    formatTime: formatSecondsToTime,
  } as FakeMediaSlider;
}

// ============================================================================
// COLOR FACTORIES
// ============================================================================

/**
 * Create a color component slider (hue, saturation, lightness, alpha)
 */
export function createFakeColorSlider(
  colorType: 'alpha' | 'hue' | 'lightness' | 'saturation' = 'hue',
  overrides?: Partial<FakeColorSlider>
): FakeColorSlider {
  const configs = {
    hue: { min: 0, max: 360, step: 1, label: i18n.t('factory.slider.hue', 'Hue') },
    saturation: {
      min: 0,
      max: 100,
      step: 1,
      label: i18n.t('factory.slider.saturation', 'Saturation'),
    },
    lightness: {
      min: 0,
      max: 100,
      step: 1,
      label: i18n.t('factory.slider.lightness', 'Lightness'),
    },
    alpha: { min: 0, max: 100, step: 1, label: i18n.t('factory.slider.alpha', 'Alpha') },
  };

  const config = configs[colorType];
  const colorValue = faker.number.int({ min: config.min, max: config.max });

  let previewColor: string;
  switch (colorType) {
    case 'hue': {
      previewColor = `hsl(${colorValue}, 100%, 50%)`;
      break;
    }
    case 'saturation': {
      previewColor = `hsl(200, ${colorValue}%, 50%)`;
      break;
    }
    case 'lightness': {
      previewColor = `hsl(200, 100%, ${colorValue}%)`;
      break;
    }
    case 'alpha': {
      previewColor = `hsla(200, 100%, 50%, ${colorValue / 100})`;
      break;
    }
    default: {
      previewColor = `hsl(0, 0%, 50%)`;
      break;
    }
  }

  return {
    ...createFakeSliderSingle({
      min: config.min,
      max: config.max,
      step: config.step,
      value: [colorValue],
      defaultValue: [colorValue],
      ariaLabel: `${config.label} slider`,
      ...overrides,
    }),
    colorType,
    colorValue,
    previewColor,
  } as FakeColorSlider;
}

// ============================================================================
// FORM FACTORIES
// ============================================================================

/**
 * Create a form slider with validation
 */
export function createFakeFormSlider(overrides?: Partial<FakeFormSlider>): FakeFormSlider {
  const validationState = faker.helpers.arrayElement<'invalid' | 'pending' | 'valid' | 'warning'>([
    'valid',
    'invalid',
    'warning',
    'pending',
  ]);

  return {
    ...createFakeSlider(overrides),
    name: faker.helpers.arrayElement(['rating', 'priority', 'quantity', 'percentage', 'score']),
    required: faker.datatype.boolean({ probability: 0.5 }),
    validationState,
    errorMessage:
      validationState === 'invalid'
        ? faker.helpers.arrayElement([
            i18n.t('factory.slider.valueIsRequired', 'Value is required'),
            i18n.t('factory.slider.valueMustBeAtLeast', 'Value must be at least 10'),
            i18n.t('factory.slider.valueExceedsMaximumAllowed', 'Value exceeds maximum allowed'),
          ])
        : undefined,
    helpText: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.slider.useTheSliderToSelect', 'Use the slider to select a value'),
          i18n.t('factory.slider.dragTheHandleToAdjust', 'Drag the handle to adjust'),
          i18n.t('factory.slider.pressArrowKeysForFine', 'Press arrow keys for fine control'),
        ]),
      { probability: 0.5 }
    ),
    ...overrides,
  } as FakeFormSlider;
}

// ============================================================================
// LABELED SLIDER FACTORIES
// ============================================================================

/**
 * Create a slider with labels and ticks
 */
export function createFakeSliderWithLabels(
  overrides?: Partial<FakeSliderWithLabels>
): FakeSliderWithLabels {
  const min = overrides?.min ?? 0;
  const max = overrides?.max ?? 100;
  const tickCount = overrides?.tickCount ?? 5;

  const step = (max - min) / (tickCount - 1);
  const labels = Array.from({ length: tickCount }, (_, i) => {
    const value = Math.round(min + i * step);
    return {
      value,
      label: `${value}`,
    };
  });

  return {
    ...createFakeSlider(overrides),
    showLabels: true,
    showTicks: true,
    tickCount,
    labels,
    ...overrides,
  } as FakeSliderWithLabels;
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Create a matrix of sliders by orientation
 */
export function createSliderOrientationMatrix(): {
  orientation: SliderOrientation;
  slider: FakeSlider;
}[] {
  return SLIDER_ORIENTATIONS.map((orientation) => ({
    orientation,
    slider: createFakeSlider({ orientation }),
  }));
}

/**
 * Create a matrix of sliders by mode
 */
export function createSliderModeMatrix(): { mode: SliderMode; slider: FakeSlider }[] {
  return SLIDER_MODES.map((mode) => ({
    mode,
    slider: createFakeSlider({ mode }),
  }));
}

/**
 * Create a matrix of sliders by size
 */
export function createSliderSizeMatrix(): {
  size: SliderSize;
  slider: FakeSlider;
  width: string;
}[] {
  return SLIDER_SIZES.map((size) => ({
    size,
    width: SLIDER_SIZE_WIDTHS[size],
    slider: createFakeSlider({ className: `w-[${SLIDER_SIZE_WIDTHS[size]}]` }),
  }));
}

/**
 * Create a matrix of domain-specific sliders
 */
export function createSliderDomainMatrix(): {
  domain: SliderDomain;
  slider: FakeSliderWithDomain;
}[] {
  return SLIDER_DOMAINS.map((domain) => ({
    domain,
    slider: createFakeSliderWithDomain(domain),
  }));
}

/**
 * Create a matrix of step presets
 */
export function createSliderStepMatrix(): {
  preset: SliderStepPreset;
  slider: FakeSlider;
  step: number;
}[] {
  return SLIDER_STEP_PRESETS.map((preset) => ({
    preset,
    step: SLIDER_STEP_VALUES[preset],
    slider: createFakeSlider({ step: SLIDER_STEP_VALUES[preset] }),
  }));
}

// ============================================================================
// SHOWCASE FACTORIES
// ============================================================================

/**
 * Create comprehensive slider test data
 */
export function createSliderTestData(): {
  basic: FakeSlider;
  brightness: FakeSliderWithDomain;
  colorAlpha: FakeColorSlider;
  colorHue: FakeColorSlider;
  colorLightness: FakeColorSlider;
  colorSaturation: FakeColorSlider;
  disabled: FakeSlider;
  form: FakeFormSlider;
  inverted: FakeSlider;
  labeled: FakeSliderWithLabels;
  media: FakeMediaSlider;
  multi: FakeSliderMulti;
  priceRange: FakePriceRangeSlider;
  range: FakeSliderRange;
  rating: FakeSliderWithDomain;
  single: FakeSliderSingle;
  speed: FakeSliderWithDomain;
  temperature: FakeSliderWithDomain;
  timeRange: FakeTimeRangeSlider;
  vertical: FakeSlider;
  volume: FakeSliderWithDomain;
  zoom: FakeSliderWithDomain;
} {
  return {
    basic: createFakeSlider(),
    single: createFakeSliderSingle(),
    range: createFakeSliderRange(),
    multi: createFakeSliderMulti(4),
    volume: createFakeVolumeSlider(),
    brightness: createFakeBrightnessSlider(),
    temperature: createFakeTemperatureSlider(),
    zoom: createFakeZoomSlider(),
    rating: createFakeRatingSlider(),
    speed: createFakeSpeedSlider(),
    priceRange: createFakePriceRangeSlider(),
    timeRange: createFakeTimeRangeSlider(),
    media: createFakeMediaSlider(),
    colorHue: createFakeColorSlider('hue'),
    colorSaturation: createFakeColorSlider('saturation'),
    colorLightness: createFakeColorSlider('lightness'),
    colorAlpha: createFakeColorSlider('alpha'),
    form: createFakeFormSlider(),
    labeled: createFakeSliderWithLabels(),
    disabled: createFakeSlider({ disabled: true }),
    inverted: createFakeSlider({ inverted: true }),
    vertical: createFakeSlider({ orientation: 'vertical' }),
  };
}

/**
 * Create a showcase of all slider variants
 */
export function createSliderShowcase(): {
  domainMatrix: ReturnType<typeof createSliderDomainMatrix>;
  modeMatrix: ReturnType<typeof createSliderModeMatrix>;
  orientationMatrix: ReturnType<typeof createSliderOrientationMatrix>;
  sizeMatrix: ReturnType<typeof createSliderSizeMatrix>;
  stepMatrix: ReturnType<typeof createSliderStepMatrix>;
  testData: ReturnType<typeof createSliderTestData>;
} {
  return {
    orientationMatrix: createSliderOrientationMatrix(),
    modeMatrix: createSliderModeMatrix(),
    sizeMatrix: createSliderSizeMatrix(),
    domainMatrix: createSliderDomainMatrix(),
    stepMatrix: createSliderStepMatrix(),
    testData: createSliderTestData(),
  };
}
