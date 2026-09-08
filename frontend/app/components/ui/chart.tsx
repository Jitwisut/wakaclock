'use client';

import * as React from 'react';
import * as RechartsPrimitive from 'recharts';

import { cn } from '@/lib/utils';

/** Theme CSS selectors for light and dark modes */
const THEMES = { light: '', dark: '.dark' } as const;

/**
 * Chart configuration type
 * @see https://recharts.org/en-US
 */
export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

/** Chart context props for internal use */
type ChartContextProps = {
  config: ChartConfig;
};

/** Chart context for sharing configuration */
const ChartContext = React.createContext<ChartContextProps | null>(null);

/** Hook to access chart context */
function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />');
  }

  return context;
}

/** ChartContainer component props */
export type ChartContainerProps = React.ComponentProps<'div'> & {
  /** Chart configuration for colors and labels */
  config: ChartConfig;
  /** Chart children (ResponsiveContainer content) */
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
  /**
   * Custom test ID for testing
   * @default 'chart'
   */
  testId?: string;
};

/**
 * ChartContainer component - Responsive chart wrapper
 *
 * @description
 * A wrapper component that provides responsive sizing, theme integration,
 * and configuration context for Recharts-based visualizations.
 *
 * ## Features
 * - **Responsive**: Automatically resizes to container
 * - **Theming**: CSS variable-based color configuration
 * - **Dark Mode**: Automatic light/dark theme support
 * - **Configuration**: Centralized label and color config
 *
 * ## Use Cases
 * - Dashboard analytics charts
 * - Data visualizations
 * - Statistics displays
 * - Real-time data monitoring
 *
 * ## Accessibility
 * - Chart colors configurable for contrast
 * - Tooltips for data point details
 * - Legends for data series identification
 *
 * @example
 * ```tsx
 * const chartConfig = {
 *   desktop: { label: "Desktop", color: "hsl(var(--chart-1))" },
 *   mobile: { label: "Mobile", color: "hsl(var(--chart-2))" },
 * } satisfies ChartConfig;
 *
 * <ChartContainer config={chartConfig}>
 *   <BarChart data={data}>
 *     <Bar dataKey="desktop" fill="var(--color-desktop)" />
 *     <Bar dataKey="mobile" fill="var(--color-mobile)" />
 *     <ChartTooltip content={<ChartTooltipContent />} />
 *     <ChartLegend content={<ChartLegendContent />} />
 *   </BarChart>
 * </ChartContainer>
 * ```
 *
 * @see https://recharts.org
 */
const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ id, className, children, config, testId = 'chart', ...props }, ref) => {
    const uniqueId = React.useId();
    const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`;
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          data-slot="chart"
          data-testid={testId}
          data-chart={chartId}
          className={cn(
            "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video min-h-[200px] min-w-0 justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
            className
          )}
          {...props}
        >
          <ChartStyle id={chartId} config={config} />
          {mounted && (
            <RechartsPrimitive.ResponsiveContainer
              debounce={50}
              height="100%"
              minHeight={200}
              minWidth={0}
              width="100%"
            >
              {children}
            </RechartsPrimitive.ResponsiveContainer>
          )}
        </div>
      </ChartContext.Provider>
    );
  }
);
ChartContainer.displayName = 'ChartContainer';

/** ChartStyle component - generates CSS variables for chart colors */
const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, config]) => config.theme || config.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join('\n')}
}
`
          )
          .join('\n'),
      }}
    />
  );
};

/** ChartTooltip component props */
export type ChartTooltipProps = React.ComponentProps<typeof RechartsPrimitive.Tooltip>;

/** ChartTooltip component - Recharts tooltip wrapper */
const ChartTooltip = RechartsPrimitive.Tooltip;

/** Tooltip payload item structure */
interface TooltipPayloadItem {
  value?: string | number;
  name?: string;
  dataKey?: string | number;
  color?: string;
  payload?: Record<string, unknown> & { fill?: string };
  type?: 'none';
  graphicalItemId: string;
}

/** ChartTooltipContent component props */
export type ChartTooltipContentProps = Omit<
  React.ComponentProps<typeof RechartsPrimitive.Tooltip>,
  'payload' | 'label'
> &
  React.ComponentProps<'div'> & {
    /** Tooltip payload data */
    payload?: TooltipPayloadItem[];
    /** Tooltip label */
    label?: string | number;
    /** Hide the label */
    hideLabel?: boolean;
    /** Hide the indicator */
    hideIndicator?: boolean;
    /** Indicator style */
    indicator?: 'line' | 'dot' | 'dashed';
    /** Key for item name */
    nameKey?: string;
    /** Key for label */
    labelKey?: string;
    /**
     * Custom test ID for testing
     * @default 'chart-tooltip'
     */
    testId?: string;
  };

/** ChartTooltipContent component - customizable tooltip content */
const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  (
    {
      active,
      payload,
      className,
      indicator = 'dot',
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
      testId = 'chart-tooltip',
    },
    ref
  ) => {
    const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null;
      }

      const [item] = payload;
      const key = `${labelKey || item?.dataKey || item?.name || 'value'}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === 'string'
          ? config[label as keyof typeof config]?.label || label
          : itemConfig?.label;

      if (labelFormatter) {
        return (
          <div className={cn('font-medium', labelClassName)}>{labelFormatter(value, payload)}</div>
        );
      }

      if (!value) {
        return null;
      }

      return <div className={cn('font-medium', labelClassName)}>{value}</div>;
    }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

    if (!active || !payload?.length) {
      return null;
    }

    const nestLabel = payload.length === 1 && indicator !== 'dot';

    return (
      <div
        ref={ref}
        data-slot="chart-tooltip"
        data-testid={testId}
        className={cn(
          'border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
          className
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || 'value'}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const indicatorColor = color || item.payload?.fill || item.color;

            return (
              <div
                key={item.dataKey}
                data-slot="chart-tooltip-item"
                data-testid={`${testId}-item`}
                className={cn(
                  '[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5',
                  indicator === 'dot' && 'items-center'
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(
                    item.value,
                    item.name,
                    item as Parameters<typeof formatter>[2],
                    index,
                    payload as Parameters<typeof formatter>[4]
                  )
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn(
                            'shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)',
                            {
                              'h-2.5 w-2.5': indicator === 'dot',
                              'w-1': indicator === 'line',
                              'w-0 border-[1.5px] border-dashed bg-transparent':
                                indicator === 'dashed',
                              'my-0.5': nestLabel && indicator === 'dashed',
                            }
                          )}
                          style={
                            {
                              '--color-bg': indicatorColor,
                              '--color-border': indicatorColor,
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        'flex flex-1 justify-between leading-none',
                        nestLabel ? 'items-end' : 'items-center'
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label || item.name}
                        </span>
                      </div>
                      {item.value && (
                        <span className="text-foreground font-mono font-medium tabular-nums">
                          {item.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = 'ChartTooltipContent';

/** ChartLegend component props */
export type ChartLegendProps = React.ComponentProps<typeof RechartsPrimitive.Legend>;

/** ChartLegend component - Recharts legend wrapper */
const ChartLegend = RechartsPrimitive.Legend;

/** Legend payload item structure */
interface LegendPayloadItem {
  value?: string | number;
  dataKey?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
  type?: string;
  id?: string;
}

/** ChartLegendContent component props */
export type ChartLegendContentProps = React.ComponentProps<'div'> & {
  /** Hide the icon */
  hideIcon?: boolean;
  /** Key for item name */
  nameKey?: string;
  /** Legend payload data */
  payload?: LegendPayloadItem[];
  /** Vertical alignment */
  verticalAlign?: 'top' | 'bottom' | 'middle';
  /**
   * Custom test ID for testing
   * @default 'chart-legend'
   */
  testId?: string;
};

/** ChartLegendContent component - customizable legend content */
const ChartLegendContent = React.forwardRef<HTMLDivElement, ChartLegendContentProps>(
  (
    {
      className,
      hideIcon = false,
      payload = [],
      verticalAlign = 'bottom',
      nameKey,
      testId = 'chart-legend',
    },
    ref
  ) => {
    const { config } = useChart();

    if (!payload?.length) {
      return null;
    }

    return (
      <div
        ref={ref}
        data-slot="chart-legend"
        data-testid={testId}
        className={cn(
          'flex items-center justify-center gap-4',
          verticalAlign === 'top' ? 'pb-3' : 'pt-3',
          className
        )}
      >
        {payload.map((item) => {
          const key = `${nameKey || item.dataKey || 'value'}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);

          return (
            <div
              key={item.value}
              data-slot="chart-legend-item"
              data-testid={`${testId}-item`}
              className={cn(
                '[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3'
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          );
        })}
      </div>
    );
  }
);
ChartLegendContent.displayName = 'ChartLegendContent';

/** Helper to extract item config from a payload */
function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  const payloadPayload =
    'payload' in payload && typeof payload.payload === 'object' && payload.payload !== null
      ? payload.payload
      : undefined;

  let configLabelKey: string = key;

  if (key in payload && typeof payload[key as keyof typeof payload] === 'string') {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === 'string'
  ) {
    configLabelKey = payloadPayload[key as keyof typeof payloadPayload] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key as keyof typeof config];
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
};
