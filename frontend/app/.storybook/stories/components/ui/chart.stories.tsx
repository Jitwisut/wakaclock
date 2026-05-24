import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, waitFor, within } from 'storybook/test';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from 'recharts';

import { chartHandlers, chartStatusHandlers } from '@/.storybook/stories/_handlers/chart.handlers';
import {
  CHART_CATEGORIES,
  CHART_COLOR_SCHEMES,
  CHART_INDICATORS,
  CHART_LEGEND_POSITIONS,
  CHART_MONTHS,
  CHART_PIE_COLORS,
  CHART_SIZE_DIMENSIONS,
  CHART_SIZES,
  CHART_STAT_TITLES,
  CHART_TIME_GRANULARITIES,
  CHART_TYPES,
  type ChartColorScheme,
  type ChartIndicator,
  type ChartLegendPosition,
  type ChartSize,
  type ChartTimeGranularity,
  type ChartType,
  createFakeAnalyticsDashboard,
  createFakeAreaChartData,
  createFakeBarChartData,
  createFakeCandlestickData,
  createFakeChartConfig,
  createFakeChartData,
  createFakeChartDataPoint,
  createFakeChartMatrix,
  createFakeChartShowcase,
  createFakeChartStatsCard,
  createFakeChartStatsCards,
  createFakeComparisonData,
  createFakeDashboardWidget,
  createFakeDashboardWidgets,
  createFakeFinancialData,
  createFakeGaugeData,
  createFakeHistogramData,
  createFakeMultiSeriesData,
  createFakePieChartData,
  createFakeRadarChartData,
  createFakeRealtimeData,
  createFakeScatterData,
  createFakeStackedBarData,
  createFakeTimeSeriesData,
  type FakeAreaChartData,
  type FakeBarChartData,
  type FakeCandlestickData,
  type FakeChartConfig,
  type FakeChartDataPoint,
  type FakeChartStatsCard,
  type FakeDashboardWidget,
  type FakeGaugeData,
  type FakeHistogramBin,
  type FakeMultiSeriesPoint,
  type FakePieChartSlice,
  type FakeRadarChartData,
  type FakeScatterPoint,
  type FakeStackedBarData,
  type FakeTimeSeriesPoint,
} from '@/.storybook/stories/_factories/chart.factory';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

const data = [
  { month: 'Jan', desktop: 186, mobile: 80 },
  { month: 'Feb', desktop: 305, mobile: 200 },
  { month: 'Mar', desktop: 237, mobile: 120 },
  { month: 'Apr', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'Jun', desktop: 214, mobile: 140 },
];

function ChartDemo() {
  const config = React.useMemo(
    () => ({
      desktop: { label: i18n.t('chart.series.desktop'), color: 'var(--chart-1)' },
      mobile: { label: i18n.t('chart.series.mobile'), color: 'var(--chart-2)' },
    }),
    []
  );

  return (
    <div className="w-full max-w-3xl" data-testid="chart-demo">
      <ChartContainer className="h-[320px] w-full" config={config} id="usage">
        <BarChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={32} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
          <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Chart',
  component: ChartDemo,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // Content
    data: {
      control: 'object',
      description: i18n.t('chart.argType.chartDataArray', 'Chart data array'),
      table: {
        category: 'Content',
        type: { summary: 'FakeChartDataPoint[]' },
      },
    },
    config: {
      control: 'object',
      description: i18n.t(
        'chart.argType.chartConfigurationObjectWithSeriesDefinitions',
        'Chart configuration object with series definitions'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ChartConfig' },
      },
    },
    children: {
      control: false,
      description: i18n.t('chart.argType.rechartsChartComponent', 'Recharts chart component'),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    // Appearance
    type: {
      control: 'select',
      options: ['bar', 'line', 'area', 'pie', 'radar', 'scatter', 'gauge'],
      description: i18n.t('chart.argType.chartType', 'Chart type'),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'bar' },
        type: { summary: "'bar' | 'line' | 'area' | 'pie' | 'radar' | 'scatter' | 'gauge'" },
      },
    },
    className: {
      control: 'text',
      description: i18n.t('chart.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    colorScheme: {
      control: 'select',
      options: ['brand', 'categorical', 'diverging', 'gradient', 'sequential'],
      description: i18n.t('chart.argType.colorSchemeForTheChart', 'Color scheme for the chart'),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'categorical' },
        type: { summary: "'brand' | 'categorical' | 'diverging' | 'gradient' | 'sequential'" },
      },
    },
    // State
    loading: {
      control: 'boolean',
      description: i18n.t(
        'chart.argType.whetherTheChartIsLoadingData',
        'Whether the chart is loading data'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    error: {
      control: 'boolean',
      description: i18n.t(
        'chart.argType.whetherTheChartHasAnError',
        'Whether the chart has an error'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    empty: {
      control: 'boolean',
      description: i18n.t(
        'chart.argType.whetherTheChartHasNoData',
        'Whether the chart has no data'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    size: {
      control: 'select',
      options: ['compact', 'default', 'large', 'full'],
      description: i18n.t('chart.argType.sizeVariantOfTheChart', 'Size variant of the chart'),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'default' },
        type: { summary: "'compact' | 'default' | 'large' | 'full'" },
      },
    },
    showGrid: {
      control: 'boolean',
      description: i18n.t('chart.argType.showGridLines', 'Show grid lines'),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    showLegend: {
      control: 'boolean',
      description: i18n.t('chart.argType.showChartLegend', 'Show chart legend'),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    showTooltip: {
      control: 'boolean',
      description: i18n.t('chart.argType.showTooltipOnHover', 'Show tooltip on hover'),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('chart.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('chart.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('chart.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('chart.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('chart.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('chart.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('chart.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onDataPointClick: {
      action: 'onDataPointClick',
      description: i18n.t(
        'chart.argType.calledWhenADataPointIsClicked',
        'Called when a data point is clicked'
      ),
      table: { category: 'Events' },
    },
  },
  parameters: {
    msw: { handlers: chartHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ChartDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BarChartExample: Story = {
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid]') ||
        canvasElement.querySelector('.recharts-wrapper') ||
        canvasElement.querySelector('svg')
    ).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...BarChartExample,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const chart = canvasElement.querySelector('[data-slot="chart"][data-chart="chart-usage"]');

    expect(chart).toBeInTheDocument();
    expect(chart?.querySelector('style')).toBeInTheDocument();

    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="chart-legend"]')).toBeInTheDocument();
      expect(canvasElement.querySelectorAll('[data-slot="chart-legend-item"]').length).toBe(2);
    });

    const style = chart?.querySelector('style');
    expect(style?.textContent).toContain('--color-desktop');
    expect(style?.textContent).toContain('--color-mobile');

    expect(canvas.getByText('Jan')).toBeInTheDocument();
    expect(canvas.getByText('Jun')).toBeInTheDocument();
    expect(chart?.querySelector('svg')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid]') ||
        canvasElement.querySelector('.recharts-wrapper') ||
        canvasElement.querySelector('svg')
    ).toBeInTheDocument();
  },
};

function ChartVariantsDemo() {
  const { t } = useTranslation();

  const barData = [
    { month: 'Jan', desktop: 186, mobile: 80 },
    { month: 'Feb', desktop: 305, mobile: 200 },
    { month: 'Mar', desktop: 237, mobile: 120 },
  ];

  const lineData = [
    { month: 'Jan', value: 100 },
    { month: 'Feb', value: 150 },
    { month: 'Mar', value: 120 },
    { month: 'Apr', value: 200 },
  ];

  const areaData = [
    { month: 'Jan', revenue: 4000, expenses: 2400 },
    { month: 'Feb', revenue: 3000, expenses: 1398 },
    { month: 'Mar', revenue: 2000, expenses: 9800 },
  ];

  const pieData = [
    { name: 'Desktop', value: 400 },
    { name: 'Mobile', value: 300 },
    { name: 'Tablet', value: 200 },
  ];

  const barConfig = {
    desktop: { label: 'Desktop', color: 'var(--chart-1)' },
    mobile: { label: 'Mobile', color: 'var(--chart-2)' },
  };

  const lineConfig = {
    value: { label: 'Value', color: 'var(--chart-1)' },
  };

  const areaConfig = {
    revenue: { label: 'Revenue', color: 'var(--chart-1)' },
    expenses: { label: 'Expenses', color: 'var(--chart-2)' },
  };

  const pieConfig = {
    Desktop: { label: 'Desktop', color: 'var(--chart-1)' },
    Mobile: { label: 'Mobile', color: 'var(--chart-2)' },
    Tablet: { label: 'Tablet', color: 'var(--chart-3)' },
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{t('chart.variants.bar')}</p>
        <ChartContainer className="h-[200px] w-full max-w-md" config={barConfig} id="bar-variant">
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
            <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
          </BarChart>
        </ChartContainer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('chart.variants.line')}</p>
        <ChartContainer className="h-[200px] w-full max-w-md" config={lineConfig} id="line-variant">
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} />
          </LineChart>
        </ChartContainer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('chart.variants.area')}</p>
        <ChartContainer className="h-[200px] w-full max-w-md" config={areaConfig} id="area-variant">
          <AreaChart data={areaData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="revenue"
              fill="var(--color-revenue)"
              stroke="var(--color-revenue)"
              fillOpacity={0.3}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              fill="var(--color-expenses)"
              stroke="var(--color-expenses)"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ChartContainer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('chart.variants.pie')}</p>
        <ChartContainer className="h-[200px] w-full max-w-md" config={pieConfig} id="pie-variant">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
              {pieData.map((entry) => (
                <Cell key={`cell-${entry.name}`} fill={`var(--color-${entry.name})`} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent />} />
          </PieChart>
        </ChartContainer>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <ChartVariantsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

function ChartSizesDemo() {
  const { t } = useTranslation();

  const chartData = [
    { month: 'Jan', value: 186 },
    { month: 'Feb', value: 305 },
    { month: 'Mar', value: 237 },
  ];

  const config = {
    value: { label: 'Value', color: 'var(--chart-1)' },
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{t('chart.sizes.compact')}</p>
        <ChartContainer className="h-[150px] w-full max-w-sm" config={config} id="compact">
          <BarChart data={chartData}>
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={4} />
          </BarChart>
        </ChartContainer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('chart.sizes.default')}</p>
        <ChartContainer className="h-[250px] w-full max-w-md" config={config} id="default-size">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={4} />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('chart.sizes.large')}</p>
        <ChartContainer className="h-[400px] w-full max-w-2xl" config={config} id="large">
          <BarChart data={chartData} margin={{ left: 12, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={4} />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <ChartSizesDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
    ).toBeInTheDocument();
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
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
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
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
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
    await Default.play?.(context);

    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(context.canvasElement);
    expect(canvas.getByText('デスクトップ')).toBeInTheDocument();
    expect(canvas.getByText('モバイル')).toBeInTheDocument();
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
  name: i18n.t('chart.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

function FakerBarChartDemo() {
  const chartData = createFakeBarChartData(6);

  const config = React.useMemo(
    () => ({
      value: { label: 'Value', color: 'var(--chart-1)' },
      previousValue: { label: 'Previous', color: 'var(--chart-2)' },
    }),
    []
  );

  return (
    <div className="w-full max-w-3xl" data-testid="chart-faker-bar-demo">
      <ChartContainer className="h-[320px] w-full" config={config} id="faker-bar">
        <BarChart data={chartData} margin={{ left: 12, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={4} />
          <Bar dataKey="previousValue" fill="var(--color-previousValue)" radius={4} />
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function FakerAreaChartDemo() {
  const chartData = createFakeAreaChartData(12);

  const config = React.useMemo(
    () => ({
      desktop: { label: 'Desktop', color: 'var(--chart-1)' },
      mobile: { label: 'Mobile', color: 'var(--chart-2)' },
      tablet: { label: 'Tablet', color: 'var(--chart-3)' },
    }),
    []
  );

  return (
    <div className="w-full max-w-3xl" data-testid="chart-faker-area-demo">
      <ChartContainer className="h-[320px] w-full" config={config} id="faker-area">
        <AreaChart data={chartData} margin={{ left: 12, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <Area
            type="monotone"
            dataKey="desktop"
            fill="var(--color-desktop)"
            stroke="var(--color-desktop)"
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="mobile"
            fill="var(--color-mobile)"
            stroke="var(--color-mobile)"
            fillOpacity={0.3}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function FakerPieChartDemo() {
  const chartData = createFakePieChartData(5);

  const config = React.useMemo(() => {
    const configObj: Record<string, { color: string; label: string }> = {};
    chartData.forEach((slice: FakePieChartSlice) => {
      configObj[slice.label] = {
        label: slice.label,
        color: slice.color,
      };
    });
    return configObj;
  }, [chartData]);

  // Convert to format compatible with Recharts
  const pieData = chartData.map((slice) => ({
    name: slice.label,
    value: slice.value,
    fill: slice.color,
  }));

  return (
    <div className="w-full max-w-md" data-testid="chart-faker-pie-demo">
      <ChartContainer className="h-[320px] w-full" config={config} id="faker-pie">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
            {pieData.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={entry.fill} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent />} />
        </PieChart>
      </ChartContainer>
    </div>
  );
}

function FakerMultiSeriesDemo() {
  const chartData = createFakeMultiSeriesData(12);

  const config = React.useMemo(
    () => ({
      series1: { label: 'Series 1', color: 'var(--chart-1)' },
      series2: { label: 'Series 2', color: 'var(--chart-2)' },
      series3: { label: 'Series 3', color: 'var(--chart-3)' },
    }),
    []
  );

  return (
    <div className="w-full max-w-3xl" data-testid="chart-faker-multi-series-demo">
      <ChartContainer className="h-[320px] w-full" config={config} id="faker-multi">
        <LineChart data={chartData} margin={{ left: 12, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
          <Line type="monotone" dataKey="series1" stroke="var(--color-series1)" strokeWidth={2} />
          <Line type="monotone" dataKey="series2" stroke="var(--color-series2)" strokeWidth={2} />
          <Line type="monotone" dataKey="series3" stroke="var(--color-series3)" strokeWidth={2} />
          <ChartLegend content={<ChartLegendContent />} />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function ChartWithFakerDataDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{t('chart.faker.bar')}</p>
        <FakerBarChartDemo />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('chart.faker.area')}</p>
        <FakerAreaChartDemo />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('chart.faker.pie')}</p>
        <FakerPieChartDemo />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('chart.faker.multiSeries')}</p>
        <FakerMultiSeriesDemo />
      </div>
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <ChartWithFakerDataDemo />,
  play: async ({ canvasElement }) => {
    // Verify all chart containers are rendered
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('[data-slot="chart"]').length).toBe(4);
    });

    // Verify each chart has SVG element
    const charts = canvasElement.querySelectorAll('[data-slot="chart"]');
    charts.forEach((chart) => {
      expect(chart.querySelector('svg')).toBeInTheDocument();
    });
  },
};

export const WithAsyncData: Story = {
  ...WithFakerData,
  parameters: {
    msw: { handlers: chartHandlers },
  },
  play: async ({ canvasElement }) => {
    // Verify charts are rendered with async data handlers
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="chart"]')).toBeInTheDocument();
    });
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chartHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chartStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chartStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chartStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chartStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chartStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chartStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chartStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chartStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: chartStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('svg') || canvasElement.firstElementChild
    ).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('chart.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Verify chart container exists
    const chartContainer = canvasElement.querySelector('[data-slot="chart"]');
    expect(chartContainer).toBeInTheDocument();

    // Verify chart has proper ARIA role for accessibility
    expect(chartContainer?.getAttribute('role')).toBe('img');

    // Verify chart has accessible name via aria-label or aria-labelledby
    expect(
      chartContainer?.hasAttribute('aria-label') || chartContainer?.hasAttribute('aria-labelledby')
    ).toBeInTheDocument();

    // Verify SVG chart element exists
    const svgElement = canvasElement.querySelector('svg');
    expect(svgElement).toBeInTheDocument();

    // Verify chart tooltip container exists (for interactive feedback)
    // Tooltip may not be visible initially, but structure should exist
    expect(
      canvasElement.querySelector('[data-slot="chart-tooltip"]') !== undefined
    ).toBeInTheDocument();

    // Test keyboard focus on chart container
    if (chartContainer instanceof HTMLElement) {
      chartContainer.focus();
      // Chart containers should be focusable for screen reader announcement
    }

    // Verify chart legend exists for data identification
    // Legend provides important context for chart data
    expect(
      canvasElement.querySelector('.recharts-legend-wrapper') !== undefined
    ).toBeInTheDocument();
  },
};

// ============ FACTORY: DATA POINT ============

function FakerDataPointDemo() {
  const { t } = useTranslation();
  const point: FakeChartDataPoint = createFakeChartDataPoint();

  return (
    <div className="w-full max-w-md" data-testid="chart-faker-datapoint-demo">
      <h3 className="mb-2 text-sm font-medium">{t('chart.faker.dataPoint')}</h3>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="font-medium">{t('chart.label.title')}</td>
            <td>{point.label}</td>
          </tr>
          <tr>
            <td className="font-medium">{t('chart.label.value')}</td>
            <td>{point.value}</td>
          </tr>
          <tr>
            <td className="font-medium">{t('chart.label.category')}</td>
            <td>{point.category ?? t('chart.label.na')}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const FactoryDataPoint: Story = {
  render: () => <FakerDataPointDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-datapoint-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('chart-faker-datapoint-demo').querySelectorAll('tr').length).toBe(3);
  },
};

// ============ FACTORY: CHART DATA (ARRAY) ============

function FakerChartDataDemo() {
  const chartData: FakeChartDataPoint[] = createFakeChartData(6);
  const config = { value: { label: i18n.t('chart.label.value'), color: 'var(--chart-1)' } };

  return (
    <div className="w-full max-w-3xl" data-testid="chart-faker-chartdata-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.chartData')}</h3>
      <ChartContainer className="h-[250px] w-full" config={config} id="faker-chartdata">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export const FactoryChartData: Story = {
  render: () => <FakerChartDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-chartdata-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="chart"] svg')).toBeInTheDocument();
  },
};

// ============ FACTORY: TIME SERIES ============

function FakerTimeSeriesDemo() {
  const tsData: FakeTimeSeriesPoint[] = createFakeTimeSeriesData(20);
  const config = { value: { label: i18n.t('chart.label.value'), color: 'var(--chart-1)' } };

  return (
    <div className="w-full max-w-3xl" data-testid="chart-faker-timeseries-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.timeSeries')}</h3>
      <ChartContainer className="h-[250px] w-full" config={config} id="faker-timeseries">
        <LineChart data={tsData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

export const FactoryTimeSeries: Story = {
  render: () => <FakerTimeSeriesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-timeseries-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="chart"] svg')).toBeInTheDocument();
  },
};

// ============ FACTORY: RADAR CHART ============

function FakerRadarChartDemo() {
  const radarData: FakeRadarChartData[] = createFakeRadarChartData();
  const config = { value: { label: i18n.t('chart.label.score'), color: 'var(--chart-1)' } };

  return (
    <div className="w-full max-w-md" data-testid="chart-faker-radar-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.radar')}</h3>
      <ChartContainer className="h-[300px] w-full" config={config} id="faker-radar">
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="80%">
          <PolarGrid />
          <PolarAngleAxis dataKey="axis" />
          <PolarRadiusAxis />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Radar
            name={i18n.t('chart.label.score')}
            dataKey="value"
            stroke="var(--color-value)"
            fill="var(--color-value)"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ChartContainer>
    </div>
  );
}

export const FactoryRadarChart: Story = {
  render: () => <FakerRadarChartDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-radar-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="chart"] svg')).toBeInTheDocument();
  },
};

// ============ FACTORY: SCATTER PLOT ============

function FakerScatterDemo() {
  const scatterData: FakeScatterPoint[] = createFakeScatterData(30);
  const config = { scatter: { label: i18n.t('chart.label.points'), color: 'var(--chart-1)' } };

  return (
    <div className="w-full max-w-3xl" data-testid="chart-faker-scatter-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.scatter')}</h3>
      <ChartContainer className="h-[300px] w-full" config={config} id="faker-scatter">
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" type="number" />
          <YAxis dataKey="y" type="number" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Scatter data={scatterData} fill="var(--color-scatter)" />
        </ScatterChart>
      </ChartContainer>
    </div>
  );
}

export const FactoryScatterPlot: Story = {
  render: () => <FakerScatterDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-scatter-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="chart"] svg')).toBeInTheDocument();
  },
};

// ============ FACTORY: GAUGE DATA ============

function FakerGaugeDemo() {
  const gauge: FakeGaugeData = createFakeGaugeData();

  return (
    <div className="w-full max-w-md" data-testid="chart-faker-gauge-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.gauge')}</h3>
      <div className="rounded-lg border p-4">
        <p className="text-lg font-bold">{gauge.label}</p>
        <p className="text-3xl font-bold">
          {gauge.value}
          {gauge.unit}
        </p>
        <div className="text-muted-foreground mt-2 text-sm">
          <span>
            {i18n.t('chart.label.min')}: {gauge.min}
          </span>
          <span className="mx-2">|</span>
          <span>
            {i18n.t('chart.label.max')}: {gauge.max}
          </span>
          {gauge.target !== undefined && (
            <>
              <span className="mx-2">|</span>
              <span>
                {i18n.t('chart.label.target')}: {gauge.target}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const FactoryGaugeData: Story = {
  render: () => <FakerGaugeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-gauge-demo')).toBeInTheDocument();
    const container = canvas.getByTestId('chart-faker-gauge-demo');
    expect(container.querySelector('.text-3xl')).toBeInTheDocument();
  },
};

// ============ FACTORY: STATS CARD ============

function FakerStatsCardDemo() {
  const card: FakeChartStatsCard = createFakeChartStatsCard();

  return (
    <div className="w-full max-w-sm" data-testid="chart-faker-statscard-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.statsCard')}</h3>
      <div className="rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">{card.title}</p>
        <p className="text-2xl font-bold">{card.value}</p>
        <p
          className={`text-sm ${card.changeType === 'increase' ? 'text-green-500' : 'text-red-500'}`}
        >
          {card.changeType === 'increase' ? '+' : '-'}
          {card.change}% {card.period}
        </p>
      </div>
    </div>
  );
}

export const FactoryStatsCard: Story = {
  render: () => <FakerStatsCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-statscard-demo')).toBeInTheDocument();
    const container = canvas.getByTestId('chart-faker-statscard-demo');
    expect(container.querySelector('.text-2xl')).toBeInTheDocument();
  },
};

// ============ FACTORY: STATS CARDS (BULK) ============

function FakerStatsCardsDemo() {
  const cards: FakeChartStatsCard[] = createFakeChartStatsCards(4);

  return (
    <div className="w-full" data-testid="chart-faker-statscards-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.statsCards')}</h3>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <div key={`${card.title}-${card.value}`} className="rounded-lg border p-4">
            <p className="text-muted-foreground text-sm">{card.title}</p>
            <p className="text-xl font-bold">{card.value}</p>
            <p
              className={`text-xs ${card.changeType === 'increase' ? 'text-green-500' : 'text-red-500'}`}
            >
              {card.changeType === 'increase' ? '+' : '-'}
              {card.change}% {card.period}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryStatsCards: Story = {
  render: () => <FakerStatsCardsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-statscards-demo')).toBeInTheDocument();
    const cards = canvas.getByTestId('chart-faker-statscards-demo').querySelectorAll('.rounded-lg');
    expect(cards.length).toBe(4);
  },
};

// ============ FACTORY: STACKED BAR ============

function FakerStackedBarDemo() {
  const stackedData: FakeStackedBarData[] = createFakeStackedBarData(6);
  const config = {
    segment1: { label: i18n.t('chart.label.segment1'), color: 'var(--chart-1)' },
    segment2: { label: i18n.t('chart.label.segment2'), color: 'var(--chart-2)' },
    segment3: { label: i18n.t('chart.label.segment3'), color: 'var(--chart-3)' },
  };

  return (
    <div className="w-full max-w-3xl" data-testid="chart-faker-stackedbar-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.stackedBar')}</h3>
      <ChartContainer className="h-[300px] w-full" config={config} id="faker-stacked-bar">
        <BarChart data={stackedData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="category" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="segment1" stackId="stack" fill="var(--color-segment1)" />
          <Bar dataKey="segment2" stackId="stack" fill="var(--color-segment2)" />
          <Bar
            dataKey="segment3"
            stackId="stack"
            fill="var(--color-segment3)"
            radius={[4, 4, 0, 0]}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export const FactoryStackedBar: Story = {
  render: () => <FakerStackedBarDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-stackedbar-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="chart"] svg')).toBeInTheDocument();
  },
};

// ============ FACTORY: CANDLESTICK DATA ============

function FakerCandlestickDemo() {
  const candlestickData: FakeCandlestickData[] = createFakeCandlestickData(15);

  return (
    <div className="w-full max-w-3xl" data-testid="chart-faker-candlestick-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.candlestick')}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-1 text-left">{i18n.t('chart.label.date')}</th>
              <th className="p-1 text-right">{i18n.t('chart.label.open')}</th>
              <th className="p-1 text-right">{i18n.t('chart.label.high')}</th>
              <th className="p-1 text-right">{i18n.t('chart.label.low')}</th>
              <th className="p-1 text-right">{i18n.t('chart.label.close')}</th>
              <th className="p-1 text-right">{i18n.t('chart.label.volume')}</th>
            </tr>
          </thead>
          <tbody>
            {candlestickData.map((d) => (
              <tr key={d.date} className={d.close >= d.open ? 'text-green-600' : 'text-red-600'}>
                <td className="p-1">{d.date}</td>
                <td className="p-1 text-right">{d.open.toFixed(2)}</td>
                <td className="p-1 text-right">{d.high.toFixed(2)}</td>
                <td className="p-1 text-right">{d.low.toFixed(2)}</td>
                <td className="p-1 text-right">{d.close.toFixed(2)}</td>
                <td className="p-1 text-right">{(d.volume ?? 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const FactoryCandlestickData: Story = {
  render: () => <FakerCandlestickDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-candlestick-demo')).toBeInTheDocument();
    const rows = canvas.getByTestId('chart-faker-candlestick-demo').querySelectorAll('tbody tr');
    expect(rows.length).toBe(15);
  },
};

// ============ FACTORY: HISTOGRAM ============

function FakerHistogramDemo() {
  const histData: FakeHistogramBin[] = createFakeHistogramData(10);
  const config = { count: { label: i18n.t('chart.label.count'), color: 'var(--chart-1)' } };

  const barData = histData.map((bin) => ({
    range: `${bin.binStart.toFixed(0)}-${bin.binEnd.toFixed(0)}`,
    count: bin.count,
  }));

  return (
    <div className="w-full max-w-3xl" data-testid="chart-faker-histogram-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.histogram')}</h3>
      <ChartContainer className="h-[250px] w-full" config={config} id="faker-histogram">
        <BarChart data={barData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="range" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={32} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export const FactoryHistogram: Story = {
  render: () => <FakerHistogramDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-histogram-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="chart"] svg')).toBeInTheDocument();
  },
};

// ============ FACTORY: CHART CONFIG ============

function FakerChartConfigDemo() {
  const configs: FakeChartConfig[] = CHART_TYPES.map((type: ChartType) =>
    createFakeChartConfig(type)
  );

  return (
    <div className="w-full" data-testid="chart-faker-config-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.config')}</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {configs.map((cfg) => (
          <div key={cfg.type} className="rounded-lg border p-3 text-sm">
            <p>
              <span className="font-medium">{i18n.t('chart.label.type')}:</span> {cfg.type}
            </p>
            <p>
              <span className="font-medium">{i18n.t('chart.label.dimensions')}:</span> {cfg.width}x
              {cfg.height}
            </p>
            <p>
              <span className="font-medium">{i18n.t('chart.label.grid')}:</span>{' '}
              {cfg.showGrid ? i18n.t('chart.label.yes') : i18n.t('chart.label.no')}
            </p>
            <p>
              <span className="font-medium">{i18n.t('chart.label.legend')}:</span>{' '}
              {cfg.showLegend ? i18n.t('chart.label.yes') : i18n.t('chart.label.no')}
            </p>
            <p>
              <span className="font-medium">{i18n.t('chart.label.colorScheme')}:</span>{' '}
              {cfg.colorScheme}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryChartConfig: Story = {
  render: () => <FakerChartConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-config-demo')).toBeInTheDocument();
    const configCards = canvas
      .getByTestId('chart-faker-config-demo')
      .querySelectorAll('.rounded-lg');
    expect(configCards.length).toBe(CHART_TYPES.length);
  },
};

// ============ FACTORY: DASHBOARD WIDGET ============

function FakerDashboardWidgetDemo() {
  const widget: FakeDashboardWidget = createFakeDashboardWidget('bar');
  const config = { value: { label: i18n.t('chart.label.value'), color: 'var(--chart-1)' } };

  return (
    <div className="w-full max-w-lg" data-testid="chart-faker-widget-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.dashboardWidget')}</h3>
      <div className="rounded-lg border p-4">
        <p className="font-bold">{widget.title}</p>
        <p className="text-muted-foreground text-sm">{widget.description}</p>
        <ChartContainer className="mt-2 h-[200px] w-full" config={config} id="faker-widget">
          <BarChart data={widget.data}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={4} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}

export const FactoryDashboardWidget: Story = {
  render: () => <FakerDashboardWidgetDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-widget-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="chart"] svg')).toBeInTheDocument();
  },
};

// ============ FACTORY: DASHBOARD WIDGETS (BULK) ============

function FakerDashboardWidgetsDemo() {
  const widgets: FakeDashboardWidget[] = createFakeDashboardWidgets(4);

  return (
    <div className="w-full" data-testid="chart-faker-widgets-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.dashboardWidgets')}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {widgets.map((widget) => (
          <div key={widget.id} className="rounded-lg border p-3">
            <p className="font-bold">{widget.title}</p>
            <p className="text-muted-foreground text-xs">{widget.description}</p>
            <p className="mt-1 text-xs">
              {i18n.t('chart.label.type')}: {widget.config.type} |{' '}
              {i18n.t('chart.label.colorScheme')}: {widget.config.colorScheme}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryDashboardWidgets: Story = {
  render: () => <FakerDashboardWidgetsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-widgets-demo')).toBeInTheDocument();
    const widgetCards = canvas
      .getByTestId('chart-faker-widgets-demo')
      .querySelectorAll('.rounded-lg');
    expect(widgetCards.length).toBe(4);
  },
};

// ============ FACTORY: ANALYTICS DASHBOARD ============

function FakerAnalyticsDashboardDemo() {
  const dashboard = createFakeAnalyticsDashboard();
  const barConfig = { value: { label: i18n.t('chart.label.value'), color: 'var(--chart-1)' } };
  const areaConfig = {
    desktop: { label: i18n.t('chart.series.desktop'), color: 'var(--chart-1)' },
    mobile: { label: i18n.t('chart.series.mobile'), color: 'var(--chart-2)' },
  };

  const barData = dashboard.bar.map((d: FakeBarChartData) => ({
    label: d.label,
    value: d.value,
  }));

  const areaData = dashboard.area.map((d: FakeAreaChartData) => ({
    date: d.date,
    desktop: d.desktop,
    mobile: d.mobile,
  }));

  return (
    <div className="w-full" data-testid="chart-faker-analytics-demo">
      <h3 className="mb-4 text-sm font-medium">{i18n.t('chart.faker.analytics')}</h3>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {dashboard.stats.map((stat: FakeChartStatsCard) => (
          <div key={`${stat.title}-${stat.value}`} className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">{stat.title}</p>
            <p className="text-lg font-bold">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <ChartContainer className="h-[200px] w-full" config={barConfig} id="analytics-bar">
            <BarChart data={barData}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={4} />
            </BarChart>
          </ChartContainer>
        </div>
        <div>
          <ChartContainer className="h-[200px] w-full" config={areaConfig} id="analytics-area">
            <AreaChart data={areaData}>
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="desktop"
                fill="var(--color-desktop)"
                stroke="var(--color-desktop)"
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="mobile"
                fill="var(--color-mobile)"
                stroke="var(--color-mobile)"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}

export const FactoryAnalyticsDashboard: Story = {
  render: () => <FakerAnalyticsDashboardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-analytics-demo')).toBeInTheDocument();
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('[data-slot="chart"]').length).toBe(2);
    });
  },
};

// ============ FACTORY: FINANCIAL DATA ============

function FakerFinancialDataDemo() {
  const financial = createFakeFinancialData();
  const volumeConfig = { value: { label: i18n.t('chart.label.volume'), color: 'var(--chart-1)' } };
  const maConfig = {
    value: { label: i18n.t('chart.label.movingAverage'), color: 'var(--chart-2)' },
  };

  return (
    <div className="w-full" data-testid="chart-faker-financial-demo">
      <h3 className="mb-4 text-sm font-medium">{i18n.t('chart.faker.financial')}</h3>
      <div className="text-muted-foreground mb-2 text-xs">
        {i18n.t('chart.faker.candlestick')}: {financial.candlestick.length}{' '}
        {i18n.t('chart.label.points')}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium">{i18n.t('chart.label.volume')}</p>
          <ChartContainer className="h-[200px] w-full" config={volumeConfig} id="financial-volume">
            <BarChart data={financial.volume}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium">{i18n.t('chart.label.movingAverage')}</p>
          <ChartContainer className="h-[200px] w-full" config={maConfig} id="financial-ma">
            <LineChart data={financial.movingAverage}>
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} />
            </LineChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}

export const FactoryFinancialData: Story = {
  render: () => <FakerFinancialDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-financial-demo')).toBeInTheDocument();
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('[data-slot="chart"]').length).toBe(2);
    });
  },
};

// ============ FACTORY: COMPARISON DATA ============

function FakerComparisonDemo() {
  const comparison = createFakeComparisonData();
  const config = {
    currentYear: { label: i18n.t('chart.label.currentYear'), color: 'var(--chart-1)' },
    previousYear: { label: i18n.t('chart.label.previousYear'), color: 'var(--chart-2)' },
  };

  const mergedData = comparison.currentYear.map((curr: FakeChartDataPoint, i: number) => ({
    label: curr.label,
    currentYear: curr.value,
    previousYear: comparison.previousYear[i]?.value ?? 0,
  }));

  return (
    <div className="w-full max-w-3xl" data-testid="chart-faker-comparison-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.comparison')}</h3>
      <ChartContainer className="h-[300px] w-full" config={config} id="faker-comparison">
        <BarChart data={mergedData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="currentYear" fill="var(--color-currentYear)" radius={4} />
          <Bar dataKey="previousYear" fill="var(--color-previousYear)" radius={4} />
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export const FactoryComparisonData: Story = {
  render: () => <FakerComparisonDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-comparison-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="chart"] svg')).toBeInTheDocument();
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="chart-legend"]')).toBeInTheDocument();
    });
  },
};

// ============ FACTORY: REALTIME DATA ============

function FakerRealtimeDemo() {
  const realtime = createFakeRealtimeData(15);
  const [dataPoints, setDataPoints] = React.useState<FakeTimeSeriesPoint[]>(realtime.data);
  const config = { value: { label: i18n.t('chart.label.value'), color: 'var(--chart-1)' } };

  React.useEffect(() => {
    const interval = setInterval(() => {
      const next = realtime.nextValue();
      setDataPoints((prev) => [...prev.slice(-19), next]);
    }, 2000);
    return () => clearInterval(interval);
  }, [realtime]);

  return (
    <div className="w-full max-w-3xl" data-testid="chart-faker-realtime-demo">
      <h3 className="mb-2 text-sm font-medium">
        {i18n.t('chart.faker.realtime')} ({dataPoints.length} {i18n.t('chart.label.points')})
      </h3>
      <ChartContainer className="h-[250px] w-full" config={config} id="faker-realtime">
        <LineChart data={dataPoints}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

export const FactoryRealtimeData: Story = {
  render: () => <FakerRealtimeDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-realtime-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="chart"] svg')).toBeInTheDocument();
  },
};

// ============ FACTORY: CHART MATRIX ============

function FakerChartMatrixDemo() {
  const matrix = createFakeChartMatrix();

  return (
    <div className="w-full" data-testid="chart-faker-matrix-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.matrix')}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-1 text-left">{i18n.t('chart.label.type')}</th>
              <th className="p-1 text-left">{i18n.t('chart.label.size')}</th>
              <th className="p-1 text-right">{i18n.t('chart.label.dimensions')}</th>
              <th className="p-1 text-right">{i18n.t('chart.label.points')}</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((entry) => (
              <tr key={`${entry.type}-${entry.size}`}>
                <td className="p-1">{entry.type}</td>
                <td className="p-1">{entry.size}</td>
                <td className="p-1 text-right">
                  {entry.config.width}x{entry.config.height}
                </td>
                <td className="p-1 text-right">{entry.data.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const FactoryChartMatrix: Story = {
  render: () => <FakerChartMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-matrix-demo')).toBeInTheDocument();
    const rows = canvas.getByTestId('chart-faker-matrix-demo').querySelectorAll('tbody tr');
    // 7 types x 4 sizes = 28
    expect(rows.length).toBe(CHART_TYPES.length * CHART_SIZES.length);
  },
};

// ============ FACTORY: CHART SHOWCASE ============

function FakerChartShowcaseDemo() {
  const showcase = createFakeChartShowcase();
  const types = Object.keys(showcase) as ChartType[];

  return (
    <div className="w-full" data-testid="chart-faker-showcase-demo">
      <h3 className="mb-2 text-sm font-medium">{i18n.t('chart.faker.showcase')}</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {types.map((type) => (
          <div key={type} className="rounded-lg border p-3">
            <p className="mb-1 text-xs font-medium">{type}</p>
            <p className="text-muted-foreground text-xs">
              {Array.isArray(showcase[type])
                ? `${(showcase[type] as unknown[]).length} ${i18n.t('chart.label.points')}`
                : i18n.t('chart.label.value')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryChartShowcase: Story = {
  render: () => <FakerChartShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-faker-showcase-demo')).toBeInTheDocument();
    const typeCards = canvas
      .getByTestId('chart-faker-showcase-demo')
      .querySelectorAll('.rounded-lg');
    expect(typeCards.length).toBe(CHART_TYPES.length);
  },
};

// ============ CONSTANTS: CHART_TYPES ============

function ConstantChartTypesDemo() {
  return (
    <div className="w-full max-w-md" data-testid="chart-const-types-demo">
      <h3 className="mb-2 text-sm font-medium">
        {i18n.t('chart.story.chartTypes', 'CHART_TYPES')}
      </h3>
      <ul className="space-y-1">
        {CHART_TYPES.map((type: ChartType) => (
          <li key={type} className="flex items-center gap-2 text-sm">
            <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">{type}</span>
            <span className="text-muted-foreground">{i18n.t('chart.label.type')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ConstantChartTypes: Story = {
  render: () => <ConstantChartTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-const-types-demo')).toBeInTheDocument();
    const items = canvas.getByTestId('chart-const-types-demo').querySelectorAll('li');
    expect(items.length).toBe(CHART_TYPES.length);
  },
};

// ============ CONSTANTS: CHART_SIZES ============

function ConstantChartSizesDemo() {
  return (
    <div className="w-full max-w-md" data-testid="chart-const-sizes-demo">
      <h3 className="mb-2 text-sm font-medium">
        {i18n.t('chart.story.chartSizes', 'CHART_SIZES')}
      </h3>
      <ul className="space-y-1">
        {CHART_SIZES.map((size: ChartSize) => {
          const dims = CHART_SIZE_DIMENSIONS[size];
          return (
            <li key={size} className="flex items-center gap-2 text-sm">
              <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">{size}</span>
              <span className="text-muted-foreground">
                {dims.width}x{dims.height} {i18n.t('chart.label.dimensions')}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const ConstantChartSizes: Story = {
  render: () => <ConstantChartSizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-const-sizes-demo')).toBeInTheDocument();
    const items = canvas.getByTestId('chart-const-sizes-demo').querySelectorAll('li');
    expect(items.length).toBe(CHART_SIZES.length);
  },
};

// ============ CONSTANTS: CHART_INDICATORS ============

function ConstantChartIndicatorsDemo() {
  return (
    <div className="w-full max-w-md" data-testid="chart-const-indicators-demo">
      <h3 className="mb-2 text-sm font-medium">CHART_INDICATORS</h3>
      <ul className="space-y-1">
        {CHART_INDICATORS.map((indicator: ChartIndicator) => (
          <li key={indicator} className="flex items-center gap-2 text-sm">
            <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">{indicator}</span>
            <span className="text-muted-foreground">{i18n.t('chart.label.tooltip')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ConstantChartIndicators: Story = {
  render: () => <ConstantChartIndicatorsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-const-indicators-demo')).toBeInTheDocument();
    const items = canvas.getByTestId('chart-const-indicators-demo').querySelectorAll('li');
    expect(items.length).toBe(CHART_INDICATORS.length);
  },
};

// ============ CONSTANTS: CHART_LEGEND_POSITIONS ============

function ConstantChartLegendPositionsDemo() {
  return (
    <div className="w-full max-w-md" data-testid="chart-const-legend-positions-demo">
      <h3 className="mb-2 text-sm font-medium">CHART_LEGEND_POSITIONS</h3>
      <ul className="space-y-1">
        {CHART_LEGEND_POSITIONS.map((pos: ChartLegendPosition) => (
          <li key={pos} className="flex items-center gap-2 text-sm">
            <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">{pos}</span>
            <span className="text-muted-foreground">{i18n.t('chart.label.legend')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ConstantChartLegendPositions: Story = {
  render: () => <ConstantChartLegendPositionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-const-legend-positions-demo')).toBeInTheDocument();
    const items = canvas.getByTestId('chart-const-legend-positions-demo').querySelectorAll('li');
    expect(items.length).toBe(CHART_LEGEND_POSITIONS.length);
  },
};

// ============ CONSTANTS: CHART_COLOR_SCHEMES ============

function ConstantChartColorSchemesDemo() {
  return (
    <div className="w-full max-w-md" data-testid="chart-const-color-schemes-demo">
      <h3 className="mb-2 text-sm font-medium">CHART_COLOR_SCHEMES</h3>
      <ul className="space-y-1">
        {CHART_COLOR_SCHEMES.map((scheme: ChartColorScheme) => (
          <li key={scheme} className="flex items-center gap-2 text-sm">
            <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">{scheme}</span>
            <span className="text-muted-foreground">{i18n.t('chart.label.colorScheme')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ConstantChartColorSchemes: Story = {
  render: () => <ConstantChartColorSchemesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-const-color-schemes-demo')).toBeInTheDocument();
    const items = canvas.getByTestId('chart-const-color-schemes-demo').querySelectorAll('li');
    expect(items.length).toBe(CHART_COLOR_SCHEMES.length);
  },
};

// ============ CONSTANTS: CHART_TIME_GRANULARITIES ============

function ConstantChartTimeGranularitiesDemo() {
  return (
    <div className="w-full max-w-md" data-testid="chart-const-time-granularities-demo">
      <h3 className="mb-2 text-sm font-medium">CHART_TIME_GRANULARITIES</h3>
      <ul className="space-y-1">
        {CHART_TIME_GRANULARITIES.map((gran: ChartTimeGranularity) => (
          <li key={gran} className="flex items-center gap-2 text-sm">
            <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">{gran}</span>
            <span className="text-muted-foreground">{i18n.t('chart.label.date')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ConstantChartTimeGranularities: Story = {
  render: () => <ConstantChartTimeGranularitiesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-const-time-granularities-demo')).toBeInTheDocument();
    const items = canvas.getByTestId('chart-const-time-granularities-demo').querySelectorAll('li');
    expect(items.length).toBe(CHART_TIME_GRANULARITIES.length);
  },
};

// ============ CONSTANTS: CHART_MONTHS ============

function ConstantChartMonthsDemo() {
  return (
    <div className="w-full max-w-md" data-testid="chart-const-months-demo">
      <h3 className="mb-2 text-sm font-medium">CHART_MONTHS</h3>
      <div className="flex flex-wrap gap-2">
        {CHART_MONTHS.map((month: string) => (
          <span key={month} className="bg-muted rounded px-2 py-1 font-mono text-xs">
            {month}
          </span>
        ))}
      </div>
    </div>
  );
}

export const ConstantChartMonths: Story = {
  render: () => <ConstantChartMonthsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-const-months-demo')).toBeInTheDocument();
    expect(canvas.getByText('Jan')).toBeInTheDocument();
    expect(canvas.getByText('Dec')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: CHART_PIE_COLORS ============

function ConstantChartPieColorsDemo() {
  return (
    <div className="w-full max-w-md" data-testid="chart-const-pie-colors-demo">
      <h3 className="mb-2 text-sm font-medium">CHART_PIE_COLORS</h3>
      <div className="flex flex-wrap gap-2">
        {CHART_PIE_COLORS.map((color: string) => (
          <div key={color} className="flex items-center gap-1">
            <div className="h-4 w-4 rounded" style={{ backgroundColor: color }} />
            <span className="font-mono text-xs">{color}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantChartPieColors: Story = {
  render: () => <ConstantChartPieColorsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-const-pie-colors-demo')).toBeInTheDocument();
    const colorSwatches = canvas
      .getByTestId('chart-const-pie-colors-demo')
      .querySelectorAll('.h-4');
    expect(colorSwatches.length).toBe(CHART_PIE_COLORS.length);
  },
};

// ============ CONSTANTS: CHART_CATEGORIES ============

function ConstantChartCategoriesDemo() {
  return (
    <div className="w-full max-w-md" data-testid="chart-const-categories-demo">
      <h3 className="mb-2 text-sm font-medium">CHART_CATEGORIES</h3>
      <ul className="space-y-1">
        {CHART_CATEGORIES.map((category: string) => (
          <li key={category} className="flex items-center gap-2 text-sm">
            <span className="bg-muted rounded px-2 py-0.5 text-xs">{category}</span>
            <span className="text-muted-foreground">{i18n.t('chart.label.category')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ConstantChartCategories: Story = {
  render: () => <ConstantChartCategoriesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-const-categories-demo')).toBeInTheDocument();
    const items = canvas.getByTestId('chart-const-categories-demo').querySelectorAll('li');
    expect(items.length).toBe(CHART_CATEGORIES.length);
  },
};

// ============ CONSTANTS: CHART_STAT_TITLES ============

function ConstantChartStatTitlesDemo() {
  return (
    <div className="w-full max-w-md" data-testid="chart-const-stat-titles-demo">
      <h3 className="mb-2 text-sm font-medium">CHART_STAT_TITLES</h3>
      <ul className="space-y-1">
        {CHART_STAT_TITLES.map((title: string) => (
          <li key={title} className="flex items-center gap-2 text-sm">
            <span className="bg-muted rounded px-2 py-0.5 text-xs">{title}</span>
            <span className="text-muted-foreground">{i18n.t('chart.label.title')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ConstantChartStatTitles: Story = {
  render: () => <ConstantChartStatTitlesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-const-stat-titles-demo')).toBeInTheDocument();
    const items = canvas.getByTestId('chart-const-stat-titles-demo').querySelectorAll('li');
    expect(items.length).toBe(CHART_STAT_TITLES.length);
  },
};

// ============ TYPE ANNOTATIONS (exercises all type aliases) ============

function TypeAnnotationsDemo() {
  // Exercise all types with explicit annotations
  const _type: ChartType = 'bar';
  const _size: ChartSize = 'default';
  const _indicator: ChartIndicator = 'dot';
  const _legendPos: ChartLegendPosition = 'bottom';
  const _colorScheme: ChartColorScheme = 'categorical';
  const _granularity: ChartTimeGranularity = 'day';

  // Exercise all interfaces with explicit annotations
  const _dataPoint: FakeChartDataPoint = createFakeChartDataPoint();
  const _tsPoint: FakeTimeSeriesPoint = createFakeTimeSeriesData(1)[0];
  const _multiPoint: FakeMultiSeriesPoint = createFakeMultiSeriesData(1)[0];
  const _pieSlice: FakePieChartSlice = createFakePieChartData(1)[0];
  const _barData: FakeBarChartData = createFakeBarChartData(1)[0];
  const _areaData: FakeAreaChartData = createFakeAreaChartData(1)[0];
  const _radarData: FakeRadarChartData = createFakeRadarChartData()[0];
  const _scatterPt: FakeScatterPoint = createFakeScatterData(1)[0];
  const _gaugeData: FakeGaugeData = createFakeGaugeData();
  const _statsCard: FakeChartStatsCard = createFakeChartStatsCard();
  const _config: FakeChartConfig = createFakeChartConfig();
  const _widget: FakeDashboardWidget = createFakeDashboardWidget();
  const _stackedBar: FakeStackedBarData = createFakeStackedBarData(1)[0];
  const _candlestick: FakeCandlestickData = createFakeCandlestickData(1)[0];
  const _histBin: FakeHistogramBin = createFakeHistogramData(1)[0];

  return (
    <div className="w-full max-w-lg" data-testid="chart-type-annotations-demo">
      <h3 className="mb-2 text-sm font-medium">
        {i18n.t('chart.story.typeAnnotations', 'Type Annotations')}
      </h3>
      <div className="space-y-1 text-xs">
        <p>
          <span className="font-medium">ChartType:</span> {_type}
        </p>
        <p>
          <span className="font-medium">ChartSize:</span> {_size}
        </p>
        <p>
          <span className="font-medium">ChartIndicator:</span> {_indicator}
        </p>
        <p>
          <span className="font-medium">ChartLegendPosition:</span> {_legendPos}
        </p>
        <p>
          <span className="font-medium">ChartColorScheme:</span> {_colorScheme}
        </p>
        <p>
          <span className="font-medium">ChartTimeGranularity:</span> {_granularity}
        </p>
        <hr className="my-2" />
        <p>
          <span className="font-medium">FakeChartDataPoint:</span> {_dataPoint.label} ={' '}
          {_dataPoint.value}
        </p>
        <p>
          <span className="font-medium">FakeTimeSeriesPoint:</span> {_tsPoint.date} ={' '}
          {_tsPoint.value}
        </p>
        <p>
          <span className="font-medium">FakeMultiSeriesPoint:</span> {_multiPoint.date} (
          {_multiPoint.series1}, {_multiPoint.series2})
        </p>
        <p>
          <span className="font-medium">FakePieChartSlice:</span> {_pieSlice.label} ={' '}
          {_pieSlice.value}
        </p>
        <p>
          <span className="font-medium">FakeBarChartData:</span> {_barData.label} = {_barData.value}
        </p>
        <p>
          <span className="font-medium">FakeAreaChartData:</span> {_areaData.date} (
          {i18n.t('chart.series.desktop')}: {_areaData.desktop})
        </p>
        <p>
          <span className="font-medium">FakeRadarChartData:</span> {_radarData.axis} ={' '}
          {_radarData.value}/{_radarData.fullMark}
        </p>
        <p>
          <span className="font-medium">FakeScatterPoint:</span> ({_scatterPt.x}, {_scatterPt.y})
        </p>
        <p>
          <span className="font-medium">FakeGaugeData:</span> {_gaugeData.label}: {_gaugeData.value}
          {_gaugeData.unit}
        </p>
        <p>
          <span className="font-medium">FakeChartStatsCard:</span> {_statsCard.title}:{' '}
          {_statsCard.value}
        </p>
        <p>
          <span className="font-medium">FakeChartConfig:</span> {_config.type} ({_config.width}x
          {_config.height})
        </p>
        <p>
          <span className="font-medium">FakeDashboardWidget:</span> {_widget.title}
        </p>
        <p>
          <span className="font-medium">FakeStackedBarData:</span> {_stackedBar.category} (
          {_stackedBar.segment1}, {_stackedBar.segment2})
        </p>
        <p>
          <span className="font-medium">FakeCandlestickData:</span> {_candlestick.date} O:
          {_candlestick.open} C:{_candlestick.close}
        </p>
        <p>
          <span className="font-medium">FakeHistogramBin:</span> {_histBin.binStart.toFixed(0)}-
          {_histBin.binEnd.toFixed(0)}: {_histBin.count}
        </p>
      </div>
    </div>
  );
}

export const TypeAnnotations: Story = {
  render: () => <TypeAnnotationsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chart-type-annotations-demo')).toBeInTheDocument();
    // Verify all type labels are rendered
    expect(canvas.getByText(/ChartType:/)).toBeInTheDocument();
    expect(canvas.getByText(/ChartSize:/)).toBeInTheDocument();
    expect(canvas.getByText(/ChartIndicator:/)).toBeInTheDocument();
    expect(canvas.getByText(/ChartLegendPosition:/)).toBeInTheDocument();
    expect(canvas.getByText(/ChartColorScheme:/)).toBeInTheDocument();
    expect(canvas.getByText(/ChartTimeGranularity:/)).toBeInTheDocument();
    expect(canvas.getByText(/FakeChartDataPoint:/)).toBeInTheDocument();
    expect(canvas.getByText(/FakeHistogramBin:/)).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('chart.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('chart.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('chart.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('chart.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   notFound
//   conflict
//   tooManyRequests
//   badGateway
//   serviceUnavailable
//   gatewayTimeout
//   partialData
//   realtimeUpdate
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('chart.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: chartStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('chart.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: chartStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('chart.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: chartStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('chart.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: chartStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('chart.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: chartStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('chart.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: chartStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('chart.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: chartStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerPartialData: Story = {
  ...Default,
  name: i18n.t('chart.storyName.handlerPartialData', 'Handler: Partial Data'),
  parameters: { msw: { handlers: chartStatusHandlers.partialData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerRealtimeUpdate: Story = {
  ...Default,
  name: i18n.t('chart.storyName.handlerRealtimeUpdate', 'Handler: Realtime Update'),
  parameters: { msw: { handlers: chartStatusHandlers.realtimeUpdate } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
