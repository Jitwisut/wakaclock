'use client';

import * as React from 'react';

import { BanIcon } from 'lucide-react';

import { useThemeConfig } from '@/components/active-theme';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ThemeRadius } from '@/lib/themes';

/** Labels configuration for ThemeRadiusSelector component */
export type ThemeRadiusSelectorLabels = {
  /** Main label for the selector */
  label?: string;
  /** Label for large radius option */
  lg?: string;
  /** Label for medium radius option */
  md?: string;
  /** Label for no radius option */
  none?: string;
  /** Label for small radius option */
  sm?: string;
  /** Label for extra large radius option */
  xl?: string;
};

/**
 * ThemeRadiusSelector component props
 *
 * @description Props for the border radius selector.
 */
export type ThemeRadiusSelectorProps = {
  /** Custom labels for the component */
  labels?: ThemeRadiusSelectorLabels;
  /**
   * Custom test ID for testing
   * @default 'radius-selector'
   */
  testId?: string;
} & React.ComponentPropsWithoutRef<'div'>;

/**
 * ThemeRadiusSelector component - Border radius selector
 *
 * @description
 * A toggle group for selecting the global border radius size.
 * Affects all rounded corners in the application.
 *
 * ## Options
 * - **None**: Sharp corners (0px)
 * - **SM**: Small radius
 * - **MD**: Medium radius (default)
 * - **LG**: Large radius
 * - **XL**: Extra large radius
 *
 * @example
 * ```tsx
 * <ThemeRadiusSelector labels={{ label: 'Corners:' }} />
 * ```
 */
const ThemeRadiusSelector = React.forwardRef<HTMLDivElement, ThemeRadiusSelectorProps>(
  ({ labels, testId = 'radius-selector', ...props }, ref) => {
    const { theme, setTheme } = useThemeConfig();
    const labelId = React.useId();

    const label = labels?.label ?? 'Radius:';
    const none = labels?.none ?? 'None';
    const sm = labels?.sm ?? 'Small';
    const md = labels?.md ?? 'Medium';
    const lg = labels?.lg ?? 'Large';
    const xl = labels?.xl ?? 'Extra large';

    return (
      <div
        className="flex flex-col gap-4"
        data-slot="radius-selector"
        data-testid={testId}
        ref={ref}
        {...props}
      >
        <Label data-testid="radius-selector-label" id={labelId}>
          {label}
        </Label>
        <ToggleGroup
          aria-labelledby={labelId}
          className="*:border-input w-full gap-3 *:rounded-md *:border"
          data-testid="radius-selector-group"
          onValueChange={(value) => {
            if (!value) return;
            setTheme({ ...theme, radius: value as ThemeRadius });
          }}
          type="single"
          value={theme.radius}
        >
          <ToggleGroupItem
            aria-label={none}
            data-testid="radius-selector-none"
            value="none"
            variant="outline"
          >
            <BanIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            aria-label={sm}
            className="text-xs data-[variant=outline]:border-l-1"
            data-testid="radius-selector-sm"
            value="sm"
            variant="outline"
          >
            SM
          </ToggleGroupItem>
          <ToggleGroupItem
            aria-label={md}
            className="text-xs data-[variant=outline]:border-l-1"
            data-testid="radius-selector-md"
            value="md"
            variant="outline"
          >
            MD
          </ToggleGroupItem>
          <ToggleGroupItem
            aria-label={lg}
            className="text-xs data-[variant=outline]:border-l-1"
            data-testid="radius-selector-lg"
            value="lg"
            variant="outline"
          >
            LG
          </ToggleGroupItem>
          <ToggleGroupItem
            aria-label={xl}
            className="text-xs data-[variant=outline]:border-l-1"
            data-testid="radius-selector-xl"
            value="xl"
            variant="outline"
          >
            XL
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  }
);

ThemeRadiusSelector.displayName = 'ThemeRadiusSelector';

export { ThemeRadiusSelector };
