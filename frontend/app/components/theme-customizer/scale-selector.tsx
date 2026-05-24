'use client';

import * as React from 'react';

import { BanIcon } from 'lucide-react';

import { useThemeConfig } from '@/components/active-theme';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ThemeScale } from '@/lib/themes';

/** Labels configuration for ThemeScaleSelector component */
export type ThemeScaleSelectorLabels = {
  /** Main label for the selector */
  label?: string;
  /** Label for large scale option */
  lg?: string;
  /** Label for no scale option */
  none?: string;
  /** Label for extra small scale option */
  xs?: string;
};

/**
 * ThemeScaleSelector component props
 *
 * @description Props for the UI scale selector.
 */
export type ThemeScaleSelectorProps = {
  /** Custom labels for the component */
  labels?: ThemeScaleSelectorLabels;
  /**
   * Custom test ID for testing
   * @default 'scale-selector'
   */
  testId?: string;
} & React.ComponentPropsWithoutRef<'div'>;

/**
 * ThemeScaleSelector component - UI scale/density selector
 *
 * @description
 * A toggle group for selecting the global UI scale/density.
 * Affects font sizes and spacing throughout the application.
 *
 * ## Features
 * - **Three Options**: None (default), XS (compact), LG (spacious)
 * - **Global Effect**: Changes CSS custom properties
 * - **i18n Ready**: Customizable labels
 *
 * ## Use Cases
 * - Accessibility: Users with vision needs
 * - Density preference: Compact vs spacious UI
 * - Device adaptation: Different screen sizes
 *
 * @example
 * ```tsx
 * <ThemeScaleSelector labels={{ label: 'UI Density:' }} />
 * ```
 */
const ThemeScaleSelector = React.forwardRef<HTMLDivElement, ThemeScaleSelectorProps>(
  ({ labels, testId = 'scale-selector', ...props }, ref) => {
    const { theme, setTheme } = useThemeConfig();
    const labelId = React.useId();

    const label = labels?.label ?? 'Scale:';
    const none = labels?.none ?? 'None';
    const xs = labels?.xs ?? 'Extra small';
    const lg = labels?.lg ?? 'Large';

    return (
      <div
        className="flex flex-col gap-4"
        data-slot="scale-selector"
        data-testid={testId}
        ref={ref}
        {...props}
      >
        <Label data-testid={`${testId}-label`} id={labelId}>
          {label}
        </Label>
        <div>
          <ToggleGroup
            aria-labelledby={labelId}
            className="*:border-input w-full gap-3 *:rounded-md *:border"
            data-testid={`${testId}-group`}
            onValueChange={(value) => {
              if (!value) return;
              setTheme({ ...theme, scale: value as ThemeScale });
            }}
            type="single"
            value={theme.scale}
          >
            <ToggleGroupItem
              aria-label={none}
              data-testid={`${testId}-none`}
              value="none"
              variant="outline"
            >
              <BanIcon />
            </ToggleGroupItem>
            <ToggleGroupItem
              aria-label={xs}
              className="text-xs data-[variant=outline]:border-l-1"
              data-testid={`${testId}-sm`}
              value="sm"
              variant="outline"
            >
              XS
            </ToggleGroupItem>
            <ToggleGroupItem
              aria-label={lg}
              className="text-xs data-[variant=outline]:border-l-1"
              data-testid={`${testId}-lg`}
              value="lg"
              variant="outline"
            >
              LG
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    );
  }
);

ThemeScaleSelector.displayName = 'ThemeScaleSelector';

export { ThemeScaleSelector };
