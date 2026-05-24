import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Animation duration preset categories
 */
export type AnimationDuration = 'fast' | 'instant' | 'normal' | 'slow' | 'very-slow';

/**
 * Easing function types for animation
 */
export type AnimationEasing = 'ease-in-out' | 'ease-in' | 'ease-out' | 'linear' | 'spring';

/**
 * Number format types
 */
export type NumberFormat =
  | 'compact'
  | 'currency'
  | 'decimal'
  | 'integer'
  | 'ordinal'
  | 'percentage';

/**
 * Metric category types for realistic data
 */
export type MetricCategory =
  | 'conversion'
  | 'engagement'
  | 'finance'
  | 'performance'
  | 'social'
  | 'users';

/**
 * Animation direction
 */
export type AnimationDirection = 'down' | 'up';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Duration presets in seconds
 */
export const ANIMATION_DURATIONS: Record<AnimationDuration, number> = {
  fast: 0.5,
  instant: 0,
  normal: 1,
  slow: 2,
  'very-slow': 3,
};

/**
 * All duration preset names
 */
export const ANIMATION_DURATION_NAMES: AnimationDuration[] = [
  'fast',
  'instant',
  'normal',
  'slow',
  'very-slow',
];

/**
 * All easing function types
 */
export const ANIMATION_EASINGS: AnimationEasing[] = [
  'ease-in',
  'ease-in-out',
  'ease-out',
  'linear',
  'spring',
];

/**
 * All number format types
 */
export const NUMBER_FORMATS: NumberFormat[] = [
  'compact',
  'currency',
  'decimal',
  'integer',
  'ordinal',
  'percentage',
];

/**
 * All metric categories
 */
export const METRIC_CATEGORIES: MetricCategory[] = [
  'conversion',
  'engagement',
  'finance',
  'performance',
  'social',
  'users',
];

/**
 * Animation directions
 */
export const ANIMATION_DIRECTIONS: AnimationDirection[] = ['down', 'up'];

/**
 * Currency symbols
 */
export const CURRENCY_SYMBOLS = ['$', '€', '£', '¥', '₹'];

/**
 * Metric labels by category
 */
export const METRIC_LABELS: Record<MetricCategory, string[]> = {
  conversion: [
    i18n.t('factory.countAnimation.conversionRate', 'Conversion Rate'),
    i18n.t('factory.countAnimation.clickthroughRate', 'Click-through Rate'),
    i18n.t('factory.countAnimation.bounceRate', 'Bounce Rate'),
    i18n.t('factory.countAnimation.cartAbandonment', 'Cart Abandonment'),
    i18n.t('factory.countAnimation.signupRate', 'Sign-up Rate'),
  ],
  engagement: [
    i18n.t('factory.countAnimation.pageViews', 'Page Views'),
    i18n.t('factory.countAnimation.sessionDuration', 'Session Duration'),
    i18n.t('factory.countAnimation.pagesPerSession', 'Pages per Session'),
    i18n.t('factory.countAnimation.activeUsers', 'Active Users'),
    i18n.t('factory.countAnimation.returningUsers', 'Returning Users'),
  ],
  finance: [
    i18n.t('factory.countAnimation.revenue', 'Revenue'),
    i18n.t('factory.countAnimation.profit', 'Profit'),
    i18n.t('factory.countAnimation.sales', 'Sales'),
    i18n.t('factory.countAnimation.averageOrder', 'Average Order'),
    i18n.t('factory.countAnimation.totalTransactions', 'Total Transactions'),
  ],
  performance: [
    i18n.t('factory.countAnimation.loadTime', 'Load Time'),
    i18n.t('factory.countAnimation.responseTime', 'Response Time'),
    i18n.t('factory.countAnimation.uptime', 'Uptime'),
    i18n.t('factory.countAnimation.errorRate', 'Error Rate'),
    i18n.t('factory.countAnimation.throughput', 'Throughput'),
  ],
  social: [
    i18n.t('factory.countAnimation.followers', 'Followers'),
    i18n.t('factory.countAnimation.likes', 'Likes'),
    i18n.t('factory.countAnimation.shares', 'Shares'),
    i18n.t('factory.countAnimation.comments', 'Comments'),
    i18n.t('factory.countAnimation.mentions', 'Mentions'),
  ],
  users: [
    i18n.t('factory.countAnimation.totalUsers', 'Total Users'),
    i18n.t('factory.countAnimation.newUsers', 'New Users'),
    i18n.t('factory.countAnimation.activeUsers', 'Active Users'),
    i18n.t('factory.countAnimation.premiumUsers', 'Premium Users'),
    i18n.t('factory.countAnimation.onlineUsers', 'Online Users'),
  ],
};

/**
 * Value ranges by metric category
 */
export const METRIC_RANGES: Record<MetricCategory, { max: number; min: number }> = {
  conversion: { max: 100, min: 0 },
  engagement: { max: 1_000_000, min: 100 },
  finance: { max: 1_000_000, min: 1000 },
  performance: { max: 100, min: 0 },
  social: { max: 10_000_000, min: 0 },
  users: { max: 100_000, min: 100 },
};

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Base count animation configuration
 */
export interface FakeCountAnimation {
  direction: AnimationDirection;
  duration: number;
  from: number;
  id: string;
  value: number;
}

/**
 * Count animation with formatting
 */
export interface FakeCountAnimationFormatted extends FakeCountAnimation {
  decimalPlaces: number;
  format: NumberFormat;
  locale: string;
  prefix?: string;
  suffix?: string;
}

/**
 * Count animation for metrics/KPIs
 */
export interface FakeMetricAnimation extends FakeCountAnimation {
  category: MetricCategory;
  changePercent: number;
  changeType: 'decrease' | 'increase' | 'neutral';
  description?: string;
  icon?: string;
  label: string;
}

/**
 * Count animation for currency values
 */
export interface FakeCurrencyAnimation extends FakeCountAnimation {
  currencyCode: string;
  currencySymbol: string;
  decimalPlaces: number;
}

/**
 * Count animation for percentages
 */
export interface FakePercentageAnimation extends FakeCountAnimation {
  color: string;
  decimalPlaces: number;
  showSign: boolean;
}

/**
 * Count animation with comparison
 */
export interface FakeComparisonAnimation extends FakeCountAnimation {
  changeAmount: number;
  changePercent: number;
  comparisonLabel: string;
  previousValue: number;
}

/**
 * Dashboard stat card configuration
 */
export interface FakeDashboardStat {
  changePercent: number;
  changeType: 'decrease' | 'increase' | 'neutral';
  countAnimation: FakeCountAnimation;
  description: string;
  icon: string;
  label: string;
}

/**
 * Countdown timer configuration
 */
export interface FakeCountdownTimer {
  days: FakeCountAnimation;
  hours: FakeCountAnimation;
  id: string;
  label: string;
  minutes: FakeCountAnimation;
  seconds: FakeCountAnimation;
  targetDate: Date;
}

/**
 * Progress counter configuration
 */
export interface FakeProgressCounter {
  countAnimation: FakeCountAnimation;
  current: number;
  id: string;
  label: string;
  percentage: number;
  total: number;
}

/**
 * Animation sequence for multiple values
 */
export interface FakeAnimationSequence {
  animations: FakeCountAnimation[];
  id: string;
  staggerDelay: number;
  totalDuration: number;
}

/**
 * Count animation matrix for visual testing
 */
export interface FakeCountAnimationMatrix {
  combinations: Array<{
    duration: number;
    durationLabel: string;
    from: number;
    value: number;
  }>;
}

/**
 * Count animation showcase collection
 */
export interface FakeCountAnimationShowcase {
  comparisonAnimations: FakeComparisonAnimation[];
  currencyAnimations: FakeCurrencyAnimation[];
  dashboardStats: FakeDashboardStat[];
  metricAnimations: FakeMetricAnimation[];
  percentageAnimations: FakePercentageAnimation[];
}

// =============================================================================
// FACTORY FUNCTIONS - Basic
// =============================================================================

/**
 * Create a basic count animation configuration
 */
export function createFakeCountAnimation(
  overrides?: Partial<FakeCountAnimation>
): FakeCountAnimation {
  const from = faker.number.int({ max: 100, min: 0 });
  const value = faker.number.int({ max: 10_000, min: from });

  return {
    direction: from < value ? 'up' : 'down',
    duration: faker.helpers.arrayElement(Object.values(ANIMATION_DURATIONS)),
    from,
    id: faker.string.uuid(),
    value,
    ...overrides,
  };
}

/**
 * Create multiple count animations
 */
export function createFakeCountAnimations(count: number): FakeCountAnimation[] {
  return Array.from({ length: count }, () => createFakeCountAnimation());
}

/**
 * Create a count animation with formatting
 */
export function createFakeCountAnimationFormatted(
  overrides?: Partial<FakeCountAnimationFormatted>
): FakeCountAnimationFormatted {
  const format = faker.helpers.arrayElement(NUMBER_FORMATS);
  const decimalPlaces = format === 'percentage' || format === 'decimal' ? 2 : 0;

  return {
    ...createFakeCountAnimation(),
    decimalPlaces,
    format,
    locale: faker.helpers.arrayElement(['en-US', 'en-GB', 'de-DE', 'ja-JP', 'fr-FR']),
    prefix: faker.helpers.maybe(() => faker.helpers.arrayElement(['$', '€', '+', '-']), {
      probability: 0.3,
    }),
    suffix: faker.helpers.maybe(() => faker.helpers.arrayElement(['%', 'k', 'M', 'B']), {
      probability: 0.3,
    }),
    ...overrides,
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Metric Animations
// =============================================================================

/**
 * Determine change type based on percentage
 */
function getChangeType(percent: number): 'decrease' | 'increase' | 'neutral' {
  if (percent > 0.5) return 'increase';
  if (percent < -0.5) return 'decrease';
  return 'neutral';
}

/**
 * Create a metric animation for dashboards
 */
export function createFakeMetricAnimation(
  overrides?: Partial<FakeMetricAnimation>
): FakeMetricAnimation {
  const category = faker.helpers.arrayElement(METRIC_CATEGORIES);
  const range = METRIC_RANGES[category];
  const value = faker.number.int({ max: range.max, min: range.min });
  const changePercent = faker.number.float({ fractionDigits: 1, max: 50, min: -50 });

  return {
    ...createFakeCountAnimation({ value }),
    category,
    changePercent,
    changeType: getChangeType(changePercent),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 }),
    icon: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          'TrendingUp',
          'TrendingDown',
          i18n.t('factory.countAnimation.users', 'Users'),
          'DollarSign',
          i18n.t('factory.countAnimation.activity', 'Activity'),
        ]),
      { probability: 0.6 }
    ),
    label: faker.helpers.arrayElement(METRIC_LABELS[category]),
    ...overrides,
  };
}

/**
 * Create multiple metric animations
 */
export function createFakeMetricAnimations(count: number): FakeMetricAnimation[] {
  return Array.from({ length: count }, () => createFakeMetricAnimation());
}

/**
 * Create metric animations for a specific category
 */
export function createFakeCategoryMetrics(
  category: MetricCategory,
  count: number = 3
): FakeMetricAnimation[] {
  return Array.from({ length: count }, () => createFakeMetricAnimation({ category }));
}

// =============================================================================
// FACTORY FUNCTIONS - Currency Animations
// =============================================================================

/**
 * Create a currency count animation
 */
export function createFakeCurrencyAnimation(
  overrides?: Partial<FakeCurrencyAnimation>
): FakeCurrencyAnimation {
  const currencyData = [
    { code: 'USD', symbol: '$' },
    { code: 'EUR', symbol: '€' },
    { code: 'GBP', symbol: '£' },
    { code: 'JPY', symbol: '¥' },
    { code: 'INR', symbol: '₹' },
  ];
  const currency = faker.helpers.arrayElement(currencyData);

  return {
    ...createFakeCountAnimation({
      value: faker.number.int({ max: 1_000_000, min: 100 }),
    }),
    currencyCode: currency.code,
    currencySymbol: currency.symbol,
    decimalPlaces: currency.code === 'JPY' ? 0 : 2,
    ...overrides,
  };
}

/**
 * Create multiple currency animations
 */
export function createFakeCurrencyAnimations(count: number): FakeCurrencyAnimation[] {
  return Array.from({ length: count }, () => createFakeCurrencyAnimation());
}

// =============================================================================
// FACTORY FUNCTIONS - Percentage Animations
// =============================================================================

/**
 * Get color key based on percentage value
 */
function getColorKey(v: number): string {
  if (v >= 70) return 'high';
  if (v >= 40) return 'medium';
  return 'low';
}

/**
 * Create a percentage count animation
 */
export function createFakePercentageAnimation(
  overrides?: Partial<FakePercentageAnimation>
): FakePercentageAnimation {
  const value = faker.number.float({ fractionDigits: 1, max: 100, min: 0 });
  const colorMap: Record<string, string> = {
    high: 'green',
    low: 'red',
    medium: 'yellow',
  };

  return {
    ...createFakeCountAnimation({ value }),
    color: colorMap[getColorKey(value)],
    decimalPlaces: 1,
    showSign: faker.datatype.boolean({ probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Create multiple percentage animations
 */
export function createFakePercentageAnimations(count: number): FakePercentageAnimation[] {
  return Array.from({ length: count }, () => createFakePercentageAnimation());
}

// =============================================================================
// FACTORY FUNCTIONS - Comparison Animations
// =============================================================================

/**
 * Create a comparison count animation
 */
export function createFakeComparisonAnimation(
  overrides?: Partial<FakeComparisonAnimation>
): FakeComparisonAnimation {
  const previousValue = faker.number.int({ max: 5000, min: 100 });
  const value = faker.number.int({ max: 10_000, min: 50 });
  const changeAmount = value - previousValue;
  const changePercent = (changeAmount / previousValue) * 100;

  return {
    ...createFakeCountAnimation({ value }),
    changeAmount,
    changePercent: Math.round(changePercent * 10) / 10,
    comparisonLabel: faker.helpers.arrayElement([
      i18n.t('factory.countAnimation.vsLastMonth', 'vs last month'),
      i18n.t('factory.countAnimation.vsLastWeek', 'vs last week'),
      i18n.t('factory.countAnimation.vsLastYear', 'vs last year'),
      i18n.t('factory.countAnimation.vsPreviousPeriod', 'vs previous period'),
      i18n.t('factory.countAnimation.vsTarget', 'vs target'),
    ]),
    previousValue,
    ...overrides,
  };
}

/**
 * Create multiple comparison animations
 */
export function createFakeComparisonAnimations(count: number): FakeComparisonAnimation[] {
  return Array.from({ length: count }, () => createFakeComparisonAnimation());
}

// =============================================================================
// FACTORY FUNCTIONS - Dashboard Stats
// =============================================================================

/**
 * Create a dashboard stat card configuration
 */
export function createFakeDashboardStat(overrides?: Partial<FakeDashboardStat>): FakeDashboardStat {
  const metric = createFakeMetricAnimation();

  return {
    changePercent: metric.changePercent,
    changeType: metric.changeType,
    countAnimation: {
      direction: metric.direction,
      duration: metric.duration,
      from: metric.from,
      id: metric.id,
      value: metric.value,
    },
    description:
      metric.description ||
      i18n.t('factory.countAnimation.currentStatistics', 'Current {{label}} statistics', {
        label: metric.label.toLowerCase(),
      }),
    icon: metric.icon || i18n.t('factory.countAnimation.activity', 'Activity'),
    label: metric.label,
    ...overrides,
  };
}

/**
 * Create multiple dashboard stats
 */
export function createFakeDashboardStats(count: number): FakeDashboardStat[] {
  return Array.from({ length: count }, () => createFakeDashboardStat());
}

/**
 * Create a complete dashboard stats set (common KPIs)
 */
export function createFakeDashboardStatsSet(): FakeDashboardStat[] {
  const categories: MetricCategory[] = ['users', 'finance', 'conversion', 'engagement'];

  return categories.map((category) => {
    const metric = createFakeMetricAnimation({ category });
    return createFakeDashboardStat({
      changePercent: metric.changePercent,
      changeType: metric.changeType,
      countAnimation: {
        direction: metric.direction,
        duration: ANIMATION_DURATIONS.normal,
        from: 0,
        id: metric.id,
        value: metric.value,
      },
      icon: metric.icon || i18n.t('factory.countAnimation.activity', 'Activity'),
      label: metric.label,
    });
  });
}

// =============================================================================
// FACTORY FUNCTIONS - Countdown Timer
// =============================================================================

/**
 * Create a countdown timer configuration
 */
export function createFakeCountdownTimer(
  overrides?: Partial<FakeCountdownTimer>
): FakeCountdownTimer {
  const futureDate = faker.date.future({ years: 1 });
  const now = new Date();
  const diff = futureDate.getTime() - now.getTime();

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    days: createFakeCountAnimation({ duration: 0, from: days, value: 0 }),
    hours: createFakeCountAnimation({ duration: 0, from: hours, value: 0 }),
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.countAnimation.saleEndsIn', 'Sale Ends In'),
      i18n.t('factory.countAnimation.eventStartsIn', 'Event Starts In'),
      i18n.t('factory.countAnimation.offerExpiresIn', 'Offer Expires In'),
      i18n.t('factory.countAnimation.timeRemaining', 'Time Remaining'),
      i18n.t('factory.countAnimation.countdown', 'Countdown'),
    ]),
    minutes: createFakeCountAnimation({ duration: 0, from: minutes, value: 0 }),
    seconds: createFakeCountAnimation({ duration: 0, from: seconds, value: 0 }),
    targetDate: futureDate,
    ...overrides,
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Progress Counter
// =============================================================================

/**
 * Create a progress counter configuration
 */
export function createFakeProgressCounter(
  overrides?: Partial<FakeProgressCounter>
): FakeProgressCounter {
  const total = faker.number.int({ max: 1000, min: 100 });
  const current = faker.number.int({ max: total, min: 0 });
  const percentage = Math.round((current / total) * 100);

  return {
    countAnimation: createFakeCountAnimation({
      duration: ANIMATION_DURATIONS.normal,
      from: 0,
      value: current,
    }),
    current,
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.countAnimation.tasksCompleted', 'Tasks Completed'),
      i18n.t('factory.countAnimation.filesUploaded', 'Files Uploaded'),
      i18n.t('factory.countAnimation.progress', 'Progress'),
      i18n.t('factory.countAnimation.downloads', 'Downloads'),
      i18n.t('factory.countAnimation.goalsReached', 'Goals Reached'),
    ]),
    percentage,
    total,
    ...overrides,
  };
}

/**
 * Create multiple progress counters
 */
export function createFakeProgressCounters(count: number): FakeProgressCounter[] {
  return Array.from({ length: count }, () => createFakeProgressCounter());
}

// =============================================================================
// FACTORY FUNCTIONS - Animation Sequence
// =============================================================================

/**
 * Create an animation sequence for staggered animations
 */
export function createFakeAnimationSequence(
  count: number = 4,
  overrides?: Partial<FakeAnimationSequence>
): FakeAnimationSequence {
  const baseDuration = ANIMATION_DURATIONS.normal;
  const staggerDelay = 0.1;

  return {
    animations: Array.from({ length: count }, () =>
      createFakeCountAnimation({
        duration: baseDuration,
        from: 0,
        value: faker.number.int({ max: 10_000, min: 100 }),
      })
    ),
    id: faker.string.uuid(),
    staggerDelay,
    totalDuration: baseDuration + (count - 1) * staggerDelay,
    ...overrides,
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Matrix & Visual Testing
// =============================================================================

/**
 * Create a count animation matrix for visual testing
 */
export function createFakeCountAnimationMatrix(): FakeCountAnimationMatrix {
  const combinations: FakeCountAnimationMatrix['combinations'] = [];

  for (const [durationLabel, duration] of Object.entries(ANIMATION_DURATIONS)) {
    combinations.push({
      duration,
      durationLabel,
      from: 0,
      value: faker.number.int({ max: 10_000, min: 1000 }),
    });
  }

  return { combinations };
}

/**
 * Create animations for all duration presets
 */
export function createFakeDurationPresetAnimations(): Array<
  { preset: string } & FakeCountAnimation
> {
  return Object.entries(ANIMATION_DURATIONS).map(([preset, duration]) => ({
    ...createFakeCountAnimation({ duration }),
    preset,
  }));
}

/**
 * Create animations for different value ranges
 */
export function createFakeValueRangeAnimations(): FakeCountAnimation[] {
  const ranges = [
    { label: i18n.t('factory.countAnimation.small', 'Small'), max: 100, min: 0 },
    { label: i18n.t('factory.countAnimation.medium', 'Medium'), max: 1000, min: 100 },
    { label: i18n.t('factory.countAnimation.large', 'Large'), max: 10_000, min: 1000 },
    {
      label: i18n.t('factory.countAnimation.veryLarge', 'Very Large'),
      max: 1_000_000,
      min: 10_000,
    },
  ];

  return ranges.map((range) =>
    createFakeCountAnimation({
      value: faker.number.int({ max: range.max, min: range.min }),
    })
  );
}

// =============================================================================
// FACTORY FUNCTIONS - Showcase
// =============================================================================

/**
 * Create a comprehensive count animation showcase
 */
export function createFakeCountAnimationShowcase(): FakeCountAnimationShowcase {
  return {
    comparisonAnimations: createFakeComparisonAnimations(3),
    currencyAnimations: createFakeCurrencyAnimations(4),
    dashboardStats: createFakeDashboardStatsSet(),
    metricAnimations: createFakeMetricAnimations(4),
    percentageAnimations: createFakePercentageAnimations(3),
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Specific Use Cases
// =============================================================================

/**
 * Create a revenue counter animation
 */
export function createFakeRevenueAnimation(currencyCode: string = 'USD'): FakeCurrencyAnimation {
  const currencySymbols: Record<string, string> = {
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    USD: '$',
  };

  return createFakeCurrencyAnimation({
    currencyCode,
    currencySymbol: currencySymbols[currencyCode] || '$',
    value: faker.number.int({ max: 500_000, min: 10_000 }),
  });
}

/**
 * Create a user count animation
 */
export function createFakeUserCountAnimation(): FakeMetricAnimation {
  return createFakeMetricAnimation({
    category: 'users',
    icon: i18n.t('factory.countAnimation.users', 'Users'),
    label: faker.helpers.arrayElement([
      i18n.t('factory.countAnimation.totalUsers', 'Total Users'),
      i18n.t('factory.countAnimation.activeUsers', 'Active Users'),
      i18n.t('factory.countAnimation.newUsers', 'New Users'),
      i18n.t('factory.countAnimation.onlineUsers', 'Online Users'),
    ]),
    value: faker.number.int({ max: 50_000, min: 100 }),
  });
}

/**
 * Create a score animation (0-100)
 */
export function createFakeScoreAnimation(
  _label: string = i18n.t('factory.countAnimation.score', 'Score')
): FakeCountAnimation {
  return createFakeCountAnimation({
    from: 0,
    value: faker.number.int({ max: 100, min: 0 }),
  });
}

/**
 * Create a rating animation (0-5)
 */
export function createFakeRatingAnimation(): FakeCountAnimationFormatted {
  return createFakeCountAnimationFormatted({
    decimalPlaces: 1,
    format: 'decimal',
    from: 0,
    suffix: '/5',
    value: faker.number.float({ fractionDigits: 1, max: 5, min: 1 }),
  });
}

/**
 * Create countdown to midnight animation
 */
export function createFakeMidnightCountdown(): FakeCountdownTimer {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  const diff = midnight.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return createFakeCountdownTimer({
    days: createFakeCountAnimation({ duration: 0, from: 0, value: 0 }),
    hours: createFakeCountAnimation({ duration: 0, from: hours, value: 0 }),
    label: i18n.t('factory.countAnimation.timeUntilMidnight', 'Time Until Midnight'),
    minutes: createFakeCountAnimation({ duration: 0, from: minutes, value: 0 }),
    seconds: createFakeCountAnimation({ duration: 0, from: seconds, value: 0 }),
    targetDate: midnight,
  });
}
