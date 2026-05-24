'use client';

import * as React from 'react';

import { useTheme } from 'next-themes';

import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

/** Labels configuration for ColorModeSelector component */
export type ColorModeSelectorLabels = {
  /** Label for dark mode option */
  dark?: string;
  /** Main label for the selector */
  label?: string;
  /** Label for light mode option */
  light?: string;
};

/**
 * ColorModeSelector component props
 *
 * @description Props for the light/dark mode toggle.
 */
export type ColorModeSelectorProps = {
  /** Custom labels for the component */
  labels?: ColorModeSelectorLabels;
  /**
   * Custom test ID for testing
   * @default 'color-mode-selector'
   */
  testId?: string;
} & React.ComponentPropsWithoutRef<'div'>;

/**
 * ColorModeSelector component - Light/dark mode toggle
 *
 * @description
 * A toggle group for switching between light and dark color modes.
 * Integrates with next-themes for persistence.
 *
 * ## Features
 * - **Two Modes**: Light and dark
 * - **Persistence**: Saves preference via next-themes
 * - **i18n Ready**: Customizable labels
 *
 * @example
 * ```tsx
 * <ColorModeSelector labels={{ light: 'Day', dark: 'Night' }} />
 * ```
 */
const ColorModeSelector = React.forwardRef<HTMLDivElement, ColorModeSelectorProps>(
  ({ labels, testId = 'color-mode-selector', ...props }, ref) => {
    const { theme, setTheme } = useTheme();
    const toggleGroupId = React.useId();

    const label = labels?.label ?? 'Color mode:';
    const light = labels?.light ?? 'Light';
    const dark = labels?.dark ?? 'Dark';

    return (
      <div
        aria-labelledby={`${toggleGroupId}-label`}
        className="flex flex-col gap-4"
        data-slot="color-mode-selector"
        data-testid={testId}
        ref={ref}
        role="group"
        {...props}
      >
        <Label
          data-testid="color-mode-selector-label"
          htmlFor={toggleGroupId}
          id={`${toggleGroupId}-label`}
        >
          {label}
        </Label>
        <ToggleGroup
          className="*:border-input w-full gap-4 *:rounded-md *:border"
          data-testid="color-mode-selector-group"
          id={toggleGroupId}
          onValueChange={(value) => {
            if (!value) return;
            setTheme(value);
          }}
          type="single"
          value={theme}
        >
          <ToggleGroupItem data-testid="color-mode-selector-light" value="light" variant="outline">
            {light}
          </ToggleGroupItem>
          <ToggleGroupItem
            className="data-[variant=outline]:border-l-1"
            data-testid="color-mode-selector-dark"
            value="dark"
            variant="outline"
          >
            {dark}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  }
);

ColorModeSelector.displayName = 'ColorModeSelector';

export { ColorModeSelector };
