'use client';

import * as React from 'react';

import { useThemeConfig } from '@/components/active-theme';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type ThemePreset, THEMES } from '@/lib/themes';

/** Labels configuration for PresetSelector component */
export type PresetSelectorLabels = {
  /** Main label for the selector */
  label?: string;
  /** Placeholder text for the select */
  placeholder?: string;
};

/**
 * PresetSelector component props
 *
 * @description Props for the theme preset selector.
 */
export type PresetSelectorProps = {
  /** Custom labels for the component */
  labels?: PresetSelectorLabels;
  /**
   * Custom test ID for testing
   * @default 'preset-selector'
   */
  testId?: string;
} & React.ComponentPropsWithoutRef<'div'>;

/**
 * PresetSelector component - Theme preset selector
 *
 * @description
 * A dropdown selector for choosing from available theme presets.
 * Each preset defines a complete color scheme.
 *
 * ## Features
 * - **Multiple Presets**: Default, blue, green, rose, etc.
 * - **Color Preview**: Shows preset colors in dropdown
 * - **Instant Apply**: Changes theme immediately
 *
 * @example
 * ```tsx
 * <PresetSelector labels={{ label: 'Theme:' }} />
 * ```
 */
const PresetSelector = React.forwardRef<HTMLDivElement, PresetSelectorProps>(
  ({ labels, testId = 'preset-selector', ...props }, ref) => {
    const { theme, setTheme } = useThemeConfig();
    const labelId = React.useId();

    const label = labels?.label ?? 'Theme preset:';
    const placeholder = labels?.placeholder ?? 'Select a theme';

    // Only the preset changes. Spreading DEFAULT_THEME here also reset radius, scale and
    // content layout, so picking a colour scheme silently discarded the other three
    // choices the customizer had just been used to make.
    const handlePreset = (value: string) => {
      setTheme({ ...theme, preset: value as ThemePreset });
    };

    return (
      <div
        aria-labelledby={labelId}
        className="flex flex-col gap-4"
        data-slot="preset-selector"
        data-testid={testId}
        ref={ref}
        role="group"
        {...props}
      >
        <Label data-testid="preset-selector-label" id={labelId}>
          {label}
        </Label>
        <Select onValueChange={(value) => handlePreset(value)} value={theme.preset}>
          <SelectTrigger
            aria-labelledby={labelId}
            className="w-full"
            data-testid="preset-selector-trigger"
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent align="end" data-testid="preset-selector-content">
            {THEMES.map((themeItem) => (
              <SelectItem key={themeItem.name} value={themeItem.value}>
                <div className="flex shrink-0 gap-1">
                  {themeItem.colors.map((color) => (
                    <span
                      className="size-2 rounded-full"
                      key={color}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                {themeItem.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
);

PresetSelector.displayName = 'PresetSelector';

export { PresetSelector };
