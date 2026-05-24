'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '@/lib/utils';

/**
 * Slider component props
 *
 * @description Props for the Slider range input component.
 * @see https://www.radix-ui.com/primitives/docs/components/slider
 */
export type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  /**
   * Custom test ID for testing
   * @default 'slider'
   */
  testId?: string;
};

/**
 * Slider component - Range input with single or multiple thumbs
 *
 * @description
 * A draggable range selector that supports single values or ranges
 * with full keyboard accessibility and ARIA support.
 *
 * ## Features
 * - **Single/Range**: One thumb or two for min/max range
 * - **Orientation**: Horizontal (default) or vertical
 * - **Step Control**: Configure step increments
 * - **Keyboard Support**: Arrow keys, Home, End, PageUp/Down
 * - **Value Labels**: aria-valuetext for screen readers
 *
 * ## Use Cases
 * - Volume/brightness controls
 * - Price range filters
 * - Zoom controls
 * - Rating inputs
 * - Progress adjustment
 *
 * ## Accessibility
 * - Keyboard navigation with Arrow keys
 * - aria-valuemin, aria-valuemax, aria-valuenow
 * - aria-valuetext with readable format
 * - Focus indicators on thumbs
 *
 * @example
 * ```tsx
 * // Single value slider
 * <Slider defaultValue={[50]} max={100} step={1} />
 *
 * // Range slider (two thumbs)
 * <Slider defaultValue={[25, 75]} max={100} step={1} />
 *
 * // Controlled slider
 * const [value, setValue] = React.useState([50]);
 * <Slider value={value} onValueChange={setValue} />
 *
 * // Vertical slider
 * <Slider
 *   orientation="vertical"
 *   defaultValue={[50]}
 *   className="h-48"
 * />
 *
 * // With step
 * <Slider defaultValue={[50]} step={10} max={100} />
 *
 * // Price range filter
 * <div className="space-y-4">
 *   <div className="flex justify-between text-sm">
 *     <span>${priceRange[0]}</span>
 *     <span>${priceRange[1]}</span>
 *   </div>
 *   <Slider
 *     value={priceRange}
 *     onValueChange={setPriceRange}
 *     min={0}
 *     max={1000}
 *     step={10}
 *   />
 * </div>
 * ```
 *
 * @see https://www.radix-ui.com/primitives/docs/components/slider
 */
const Slider = React.forwardRef<React.ComponentRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, defaultValue, value, min = 0, max = 100, testId = 'slider', ...props }, ref) => {
    const _values = React.useMemo(
      () =>
        Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max],
      [value, defaultValue, min, max]
    );

    // Safe value bounds for aria-valuetext
    const safeValues = React.useMemo(
      () => _values.map((v) => Math.min(Math.max(v ?? 0, min), max)),
      [_values, min, max]
    );

    return (
      <SliderPrimitive.Root
        ref={ref}
        data-slot="slider"
        data-testid={testId}
        defaultValue={defaultValue}
        value={value}
        min={min}
        max={max}
        className={cn(
          'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
          className
        )}
        {...props}
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          data-testid={`${testId}-track`}
          className={cn(
            'bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5'
          )}
        >
          <SliderPrimitive.Range
            data-slot="slider-range"
            data-testid={`${testId}-range`}
            className={cn(
              'bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full'
            )}
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            data-testid={`${testId}-thumb-${index}`}
            key={`slider-thumb-${index}`}
            aria-valuetext={`${safeValues[index]} of ${max}`}
            className="border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Root>
    );
  }
);
Slider.displayName = 'Slider';

export { Slider };
