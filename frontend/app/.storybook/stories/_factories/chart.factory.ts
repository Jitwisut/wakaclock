import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ TYPE DEFINITIONS ============

/** Chart type variants */
export type ChartType = 'area' | 'bar' | 'gauge' | 'line' | 'pie' | 'radar' | 'scatter';

/** Chart size variants */
export type ChartSize = 'compact' | 'default' | 'full' | 'large';

/** Tooltip indicator style */
export type ChartIndicator = 'dashed' | 'dot' | 'line';

/** Legend position */
export type ChartLegendPosition = 'bottom' | 'left' | 'right' | 'top';

/** Chart color scheme */
export type ChartColorScheme = 'brand' | 'categorical' | 'diverging' | 'gradient' | 'sequential';

/** Time granularity for time series */
export type ChartTimeGranularity = 'day' | 'hour' | 'minute' | 'month' | 'week' | 'year';

/** Interface for basic chart data point */
export interface FakeChartDataPoint {
  /** Data category */
  category?: string;
  /** Point label */
  label: string;
  /** Point value */
  value: number;
}

/** Interface for time series data point */
export interface FakeTimeSeriesPoint {
  /** ISO date string */
  date: string;
  /** Point value */
  value: number;
}

/** Interface for multi-series data point */
export interface FakeMultiSeriesPoint {
  /** Date label */
  date: string;
  /** Series 1 value */
  series1: number;
  /** Series 2 value */
  series2: number;
  /** Optional series 3 value */
  series3?: number;
}

/** Interface for pie chart slice */
export interface FakePieChartSlice {
  /** Slice color */
  color: string;
  /** Slice label */
  label: string;
  /** Slice value */
  value: number;
}

/** Interface for bar chart data */
export interface FakeBarChartData {
  /** Bar label */
  label: string;
  /** Previous period value */
  previousValue?: number;
  /** Current value */
  value: number;
}

/** Interface for area chart data */
export interface FakeAreaChartData {
  /** Date label */
  date: string;
  /** Desktop traffic */
  desktop: number;
  /** Mobile traffic */
  mobile: number;
  /** Tablet traffic */
  tablet?: number;
}

/** Interface for radar chart data */
export interface FakeRadarChartData {
  /** Axis label */
  axis: string;
  /** Maximum value */
  fullMark: number;
  /** Current value */
  value: number;
}

/** Interface for scatter plot point */
export interface FakeScatterPoint {
  /** Point label */
  label?: string;
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Z coordinate (bubble size) */
  z?: number;
}

/** Interface for gauge data */
export interface FakeGaugeData {
  /** Gauge label */
  label: string;
  /** Maximum value */
  max: number;
  /** Minimum value */
  min: number;
  /** Target value */
  target?: number;
  /** Value unit */
  unit: string;
  /** Current value */
  value: number;
}

/** Interface for stats card */
export interface FakeChartStatsCard {
  /** Change percentage */
  change: number;
  /** Direction of change */
  changeType: 'decrease' | 'increase';
  /** Comparison period */
  period: string;
  /** Card title */
  title: string;
  /** Display value */
  value: string;
}

/** Interface for chart configuration */
export interface FakeChartConfig {
  /** Color scheme */
  colorScheme: ChartColorScheme;
  /** Chart height */
  height: number;
  /** Show grid lines */
  showGrid: boolean;
  /** Show legend */
  showLegend: boolean;
  /** Show tooltip */
  showTooltip: boolean;
  /** Chart type */
  type: ChartType;
  /** Chart width */
  width: number;
}

/** Interface for dashboard widget */
export interface FakeDashboardWidget {
  /** Chart configuration */
  config: FakeChartConfig;
  /** Widget data */
  data: FakeChartDataPoint[];
  /** Widget description */
  description: string;
  /** Unique identifier */
  id: string;
  /** Widget title */
  title: string;
}

/** Interface for stacked bar data */
export interface FakeStackedBarData {
  /** Category label */
  category: string;
  /** Stack segment 1 */
  segment1: number;
  /** Stack segment 2 */
  segment2: number;
  /** Stack segment 3 */
  segment3?: number;
}

/** Interface for candlestick data */
export interface FakeCandlestickData {
  /** Close price */
  close: number;
  /** Date label */
  date: string;
  /** High price */
  high: number;
  /** Low price */
  low: number;
  /** Open price */
  open: number;
  /** Trading volume */
  volume?: number;
}

/** Interface for histogram data */
export interface FakeHistogramBin {
  /** Bin range end */
  binEnd: number;
  /** Bin range start */
  binStart: number;
  /** Count in bin */
  count: number;
}

// ============ CONSTANTS FOR ITERATION ============

/** All chart types */
export const CHART_TYPES: ChartType[] = ['area', 'bar', 'gauge', 'line', 'pie', 'radar', 'scatter'];

/** All chart sizes */
export const CHART_SIZES: ChartSize[] = ['compact', 'default', 'full', 'large'];

/** All tooltip indicator styles */
export const CHART_INDICATORS: ChartIndicator[] = ['dashed', 'dot', 'line'];

/** All legend positions */
export const CHART_LEGEND_POSITIONS: ChartLegendPosition[] = ['bottom', 'left', 'right', 'top'];

/** All color schemes */
export const CHART_COLOR_SCHEMES: ChartColorScheme[] = [
  'brand',
  'categorical',
  'diverging',
  'gradient',
  'sequential',
];

/** All time granularities */
export const CHART_TIME_GRANULARITIES: ChartTimeGranularity[] = [
  'day',
  'hour',
  'minute',
  'month',
  'week',
  'year',
];

/** Month labels for charts */
export const CHART_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Default pie chart colors */
export const CHART_PIE_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

/** Common chart categories */
export const CHART_CATEGORIES = [
  i18n.t('factory.chart.electronics', 'Electronics'),
  i18n.t('factory.chart.clothing', 'Clothing'),
  i18n.t('factory.chart.foodBeverages', 'Food & Beverages'),
  i18n.t('factory.chart.homeGarden', 'Home & Garden'),
  i18n.t('factory.chart.sports', 'Sports'),
  i18n.t('factory.chart.books', 'Books'),
  i18n.t('factory.chart.toys', 'Toys'),
  i18n.t('factory.chart.health', 'Health'),
];

/** Dashboard stat titles */
export const CHART_STAT_TITLES = [
  i18n.t('factory.chart.totalRevenue', 'Total Revenue'),
  i18n.t('factory.chart.activeUsers', 'Active Users'),
  i18n.t('factory.chart.newCustomers', 'New Customers'),
  i18n.t('factory.chart.totalOrders', 'Total Orders'),
  i18n.t('factory.chart.conversionRate', 'Conversion Rate'),
  i18n.t('factory.chart.averageOrderValue', 'Average Order Value'),
];

/** Size-based dimensions */
export const CHART_SIZE_DIMENSIONS: Record<ChartSize, { height: number; width: number }> = {
  compact: { height: 150, width: 300 },
  default: { height: 250, width: 500 },
  full: { height: 400, width: 800 },
  large: { height: 350, width: 700 },
};

// ============ SINGLE ITEM FACTORIES ============

/**
 * Creates a single chart data point
 * @param overrides - Optional partial overrides
 * @returns A chart data point
 */
export function createFakeChartDataPoint(
  overrides?: Partial<FakeChartDataPoint>
): FakeChartDataPoint {
  return {
    label: faker.helpers.arrayElement(CHART_MONTHS),
    value: faker.number.int({ min: 100, max: 10_000 }),
    category: faker.helpers.arrayElement(CHART_CATEGORIES),
    ...overrides,
  };
}

/**
 * Creates chart data array
 * @param count - Number of data points
 * @returns Array of chart data points
 */
export function createFakeChartData(count: number = 12): FakeChartDataPoint[] {
  return CHART_MONTHS.slice(0, count).map((label) => ({
    label,
    value: faker.number.int({ min: 100, max: 10_000 }),
    category: faker.helpers.arrayElement([
      i18n.t('factory.chart.sales', 'Sales'),
      i18n.t('factory.chart.revenue', 'Revenue'),
      i18n.t('factory.chart.profit', 'Profit'),
    ]),
  }));
}

/**
 * Creates time series data
 * @param points - Number of points
 * @returns Array of time series points
 */
export function createFakeTimeSeriesData(points: number = 30): FakeTimeSeriesPoint[] {
  const data: FakeTimeSeriesPoint[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - points);

  for (let i = 0; i < points; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    data.push({
      date: date.toISOString().split('T')[0],
      value: faker.number.int({ min: 0, max: 1000 }),
    });
  }

  return data;
}

/**
 * Creates multi-series data
 * @param points - Number of points
 * @returns Array of multi-series points
 */
export function createFakeMultiSeriesData(points: number = 12): FakeMultiSeriesPoint[] {
  return CHART_MONTHS.slice(0, points).map((month) => ({
    date: month,
    series1: faker.number.int({ min: 100, max: 5000 }),
    series2: faker.number.int({ min: 100, max: 5000 }),
    series3: faker.datatype.boolean({ probability: 0.7 })
      ? faker.number.int({ min: 100, max: 5000 })
      : undefined,
  }));
}

/**
 * Creates pie chart data
 * @param slices - Number of slices
 * @returns Array of pie chart slices
 */
export function createFakePieChartData(slices: number = 5): FakePieChartSlice[] {
  return CHART_CATEGORIES.slice(0, slices).map((category, index) => ({
    label: category,
    value: faker.number.int({ min: 10, max: 100 }),
    color: CHART_PIE_COLORS[index % CHART_PIE_COLORS.length],
  }));
}

/**
 * Creates bar chart data
 * @param count - Number of bars
 * @returns Array of bar chart data
 */
export function createFakeBarChartData(count: number = 6): FakeBarChartData[] {
  const categories = [
    i18n.t('factory.chart.productA', 'Product A'),
    i18n.t('factory.chart.productB', 'Product B'),
    i18n.t('factory.chart.productC', 'Product C'),
    i18n.t('factory.chart.productD', 'Product D'),
    i18n.t('factory.chart.productE', 'Product E'),
    i18n.t('factory.chart.productF', 'Product F'),
    i18n.t('factory.chart.productG', 'Product G'),
    i18n.t('factory.chart.productH', 'Product H'),
  ];

  return categories.slice(0, count).map((category) => ({
    label: category,
    value: faker.number.int({ min: 50, max: 500 }),
    previousValue: faker.datatype.boolean({ probability: 0.6 })
      ? faker.number.int({ min: 50, max: 500 })
      : undefined,
  }));
}

/**
 * Creates area chart data
 * @param points - Number of points
 * @returns Array of area chart data
 */
export function createFakeAreaChartData(points: number = 12): FakeAreaChartData[] {
  return CHART_MONTHS.slice(0, points).map((month) => ({
    date: month,
    desktop: faker.number.int({ min: 1000, max: 5000 }),
    mobile: faker.number.int({ min: 500, max: 3000 }),
    tablet: faker.datatype.boolean({ probability: 0.7 })
      ? faker.number.int({ min: 200, max: 1500 })
      : undefined,
  }));
}

/**
 * Creates radar chart data
 * @returns Array of radar chart data
 */
export function createFakeRadarChartData(): FakeRadarChartData[] {
  const axes = [
    i18n.t('factory.chart.math', 'Math'),
    i18n.t('factory.chart.chinese', 'Chinese'),
    i18n.t('factory.chart.english', 'English'),
    i18n.t('factory.chart.geography', 'Geography'),
    i18n.t('factory.chart.physics', 'Physics'),
    i18n.t('factory.chart.history', 'History'),
  ];

  return axes.map((axis) => ({
    axis,
    value: faker.number.int({ min: 40, max: 100 }),
    fullMark: 100,
  }));
}

/**
 * Creates scatter plot data
 * @param points - Number of points
 * @returns Array of scatter points
 */
export function createFakeScatterData(points: number = 50): FakeScatterPoint[] {
  return Array.from({ length: points }, () => ({
    x: faker.number.int({ min: 0, max: 100 }),
    y: faker.number.int({ min: 0, max: 100 }),
    z: faker.datatype.boolean({ probability: 0.5 })
      ? faker.number.int({ min: 10, max: 100 })
      : undefined,
    label: faker.datatype.boolean({ probability: 0.2 }) ? faker.lorem.word() : undefined,
  }));
}

/**
 * Creates gauge data
 * @param overrides - Optional overrides
 * @returns Gauge data
 */
export function createFakeGaugeData(overrides?: Partial<FakeGaugeData>): FakeGaugeData {
  const max = faker.helpers.arrayElement([100, 1000, 10_000]);
  const value = faker.number.int({ min: 0, max });

  return {
    value,
    min: 0,
    max,
    target: faker.datatype.boolean({ probability: 0.6 })
      ? faker.number.int({ min: Math.floor(max * 0.5), max: Math.floor(max * 0.9) })
      : undefined,
    label: faker.helpers.arrayElement([
      i18n.t('factory.chart.performance', 'Performance'),
      i18n.t('factory.chart.progress', 'Progress'),
      i18n.t('factory.chart.score', 'Score'),
      i18n.t('factory.chart.rating', 'Rating'),
    ]),
    unit: faker.helpers.arrayElement(['%', 'pts', '', '/100']),
    ...overrides,
  };
}

/**
 * Creates a stats card
 * @param overrides - Optional overrides
 * @returns Stats card data
 */
export function createFakeChartStatsCard(
  overrides?: Partial<FakeChartStatsCard>
): FakeChartStatsCard {
  const changeType = faker.helpers.arrayElement<'decrease' | 'increase'>(['increase', 'decrease']);

  return {
    title: faker.helpers.arrayElement(CHART_STAT_TITLES),
    value: faker.helpers.arrayElement([
      `$${faker.number.int({ min: 1000, max: 99_999 }).toLocaleString()}`,
      faker.number.int({ min: 100, max: 9999 }).toLocaleString(),
      `${faker.number.float({ min: 0.1, max: 99.9, fractionDigits: 1 })}%`,
    ]),
    change: faker.number.float({ min: 0.1, max: 25, fractionDigits: 1 }),
    changeType,
    period: faker.helpers.arrayElement([
      i18n.t('factory.chart.vsLastWeek', 'vs last week'),
      i18n.t('factory.chart.vsLastMonth', 'vs last month'),
      i18n.t('factory.chart.vsLastYear', 'vs last year'),
    ]),
    ...overrides,
  };
}

// ============ BULK FACTORIES ============

/**
 * Creates multiple stats cards
 * @param count - Number of cards
 * @returns Array of stats cards
 */
export function createFakeChartStatsCards(count: number = 4): FakeChartStatsCard[] {
  return Array.from({ length: count }, () => createFakeChartStatsCard());
}

/**
 * Creates stacked bar chart data
 * @param count - Number of categories
 * @returns Array of stacked bar data
 */
export function createFakeStackedBarData(count: number = 6): FakeStackedBarData[] {
  return CHART_CATEGORIES.slice(0, count).map((category) => ({
    category,
    segment1: faker.number.int({ min: 100, max: 500 }),
    segment2: faker.number.int({ min: 100, max: 500 }),
    segment3: faker.datatype.boolean({ probability: 0.5 })
      ? faker.number.int({ min: 50, max: 300 })
      : undefined,
  }));
}

/**
 * Creates candlestick chart data
 * @param days - Number of days
 * @returns Array of candlestick data
 */
export function createFakeCandlestickData(days: number = 30): FakeCandlestickData[] {
  const data: FakeCandlestickData[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  let previousClose = faker.number.float({ min: 100, max: 200, fractionDigits: 2 });

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const open = previousClose + faker.number.float({ min: -5, max: 5, fractionDigits: 2 });
    const close = open + faker.number.float({ min: -10, max: 10, fractionDigits: 2 });
    const high = Math.max(open, close) + faker.number.float({ min: 0, max: 5, fractionDigits: 2 });
    const low = Math.min(open, close) - faker.number.float({ min: 0, max: 5, fractionDigits: 2 });

    data.push({
      date: date.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: faker.number.int({ min: 100_000, max: 10_000_000 }),
    });

    previousClose = close;
  }

  return data;
}

/**
 * Creates histogram data
 * @param bins - Number of bins
 * @returns Array of histogram bins
 */
export function createFakeHistogramData(bins: number = 10): FakeHistogramBin[] {
  const binSize = 100 / bins;

  return Array.from({ length: bins }, (_, i) => ({
    binStart: i * binSize,
    binEnd: (i + 1) * binSize,
    count: faker.number.int({
      min: 5,
      max: 50 + Math.floor(30 * Math.sin(((i - bins / 2) * Math.PI) / bins)),
    }),
  }));
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates chart configuration
 * @param type - Chart type
 * @returns Chart configuration
 */
export function createFakeChartConfig(type: ChartType = 'bar'): FakeChartConfig {
  const size = faker.helpers.arrayElement(CHART_SIZES);
  const dimensions = CHART_SIZE_DIMENSIONS[size];

  return {
    type,
    ...dimensions,
    showGrid: faker.datatype.boolean({ probability: 0.8 }),
    showLegend: faker.datatype.boolean({ probability: 0.7 }),
    showTooltip: true,
    colorScheme: faker.helpers.arrayElement(CHART_COLOR_SCHEMES),
  };
}

/**
 * Creates dashboard widget
 * @param type - Chart type
 * @returns Dashboard widget
 */
export function createFakeDashboardWidget(type?: ChartType): FakeDashboardWidget {
  const chartType = type ?? faker.helpers.arrayElement(CHART_TYPES);

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.chart.salesOverview', 'Sales Overview'),
      i18n.t('factory.chart.userActivity', 'User Activity'),
      i18n.t('factory.chart.revenueTrends', 'Revenue Trends'),
      i18n.t('factory.chart.performanceMetrics', 'Performance Metrics'),
      i18n.t('factory.chart.trafficAnalysis', 'Traffic Analysis'),
      i18n.t('factory.chart.conversionFunnel', 'Conversion Funnel'),
    ]),
    description: faker.lorem.sentence(),
    config: createFakeChartConfig(chartType),
    data: createFakeChartData(6),
  };
}

/**
 * Creates multiple dashboard widgets
 * @param count - Number of widgets
 * @returns Array of dashboard widgets
 */
export function createFakeDashboardWidgets(count: number = 4): FakeDashboardWidget[] {
  return Array.from({ length: count }, () => createFakeDashboardWidget());
}

/**
 * Creates a complete analytics dashboard data set
 * @returns Dashboard data with multiple chart types
 */
export function createFakeAnalyticsDashboard(): {
  area: FakeAreaChartData[];
  bar: FakeBarChartData[];
  pie: FakePieChartSlice[];
  stats: FakeChartStatsCard[];
  timeSeries: FakeTimeSeriesPoint[];
} {
  return {
    stats: createFakeChartStatsCards(4),
    bar: createFakeBarChartData(6),
    area: createFakeAreaChartData(12),
    pie: createFakePieChartData(5),
    timeSeries: createFakeTimeSeriesData(30),
  };
}

/**
 * Creates financial chart data set
 * @returns Financial data with candlestick and volume
 */
export function createFakeFinancialData(): {
  candlestick: FakeCandlestickData[];
  movingAverage: FakeTimeSeriesPoint[];
  volume: FakeBarChartData[];
} {
  const candlestick = createFakeCandlestickData(60);

  return {
    candlestick,
    volume: candlestick.slice(-30).map((d) => ({
      label: d.date,
      value: d.volume ?? 0,
    })),
    movingAverage: candlestick.slice(-30).map((d) => ({
      date: d.date,
      value: (d.open + d.close) / 2,
    })),
  };
}

/**
 * Creates comparison chart data (year over year)
 * @returns Comparison data
 */
export function createFakeComparisonData(): {
  currentYear: FakeChartDataPoint[];
  previousYear: FakeChartDataPoint[];
} {
  return {
    currentYear: CHART_MONTHS.map((label) => ({
      label,
      value: faker.number.int({ min: 1000, max: 5000 }),
    })),
    previousYear: CHART_MONTHS.map((label) => ({
      label,
      value: faker.number.int({ min: 800, max: 4000 }),
    })),
  };
}

/**
 * Creates real-time streaming data simulation
 * @param points - Number of initial points
 * @returns Data with streaming simulation
 */
export function createFakeRealtimeData(points: number = 20): {
  data: FakeTimeSeriesPoint[];
  nextValue: () => FakeTimeSeriesPoint;
} {
  const data = createFakeTimeSeriesData(points);
  let lastValue = data[data.length - 1].value;

  return {
    data,
    nextValue: () => {
      const change = faker.number.int({ min: -50, max: 50 });
      lastValue = Math.max(0, Math.min(1000, lastValue + change));
      return {
        date: new Date().toISOString(),
        value: lastValue,
      };
    },
  };
}

// ============ MATRIX FACTORY ============

/**
 * Creates a matrix of chart configurations for visual testing
 * @returns Matrix of chart type × size combinations
 */
export function createFakeChartMatrix(): Array<{
  config: FakeChartConfig;
  data: FakeChartDataPoint[];
  size: ChartSize;
  type: ChartType;
}> {
  const matrix: Array<{
    config: FakeChartConfig;
    data: FakeChartDataPoint[];
    size: ChartSize;
    type: ChartType;
  }> = [];

  for (const type of CHART_TYPES) {
    for (const size of CHART_SIZES) {
      matrix.push({
        type,
        size,
        config: {
          ...createFakeChartConfig(type),
          ...CHART_SIZE_DIMENSIONS[size],
        },
        data: createFakeChartData(6),
      });
    }
  }

  return matrix;
}

/**
 * Creates showcase of all chart types
 * @returns Object with data for each chart type
 */
export function createFakeChartShowcase(): Record<ChartType, unknown> {
  return {
    area: createFakeAreaChartData(12),
    bar: createFakeBarChartData(6),
    gauge: createFakeGaugeData(),
    line: createFakeMultiSeriesData(12),
    pie: createFakePieChartData(6),
    radar: createFakeRadarChartData(),
    scatter: createFakeScatterData(30),
  };
}
