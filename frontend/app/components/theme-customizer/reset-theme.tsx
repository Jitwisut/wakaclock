'use client';

import * as React from 'react';

import { useThemeConfig } from '@/components/active-theme';
import { Button } from '@/components/ui/button';
import { DEFAULT_THEME } from '@/lib/themes';

/** Labels configuration for ResetThemeButton component */
export type ResetThemeButtonLabels = {
  /** Button text label */
  text?: string;
};

/**
 * ResetThemeButton component props
 *
 * @description Props for the theme reset button.
 */
export type ResetThemeButtonProps = {
  /** Custom labels for the component */
  labels?: ResetThemeButtonLabels;
  /**
   * Custom test ID for testing
   * @default 'reset-theme-button'
   */
  testId?: string;
} & React.ComponentPropsWithoutRef<typeof Button>;

/**
 * ResetThemeButton component - Reset all theme settings
 *
 * @description
 * A destructive button that resets all theme customizations
 * back to the default theme configuration.
 *
 * ## Features
 * - **Full Reset**: Restores preset, scale, radius, layout
 * - **Visual Warning**: Destructive variant styling
 * - **i18n Ready**: Customizable button text
 *
 * ## Use Cases
 * - Undo customizations: Start fresh
 * - Troubleshooting: Reset broken configurations
 * - Demo reset: Clear user changes
 *
 * @example
 * ```tsx
 * <ResetThemeButton labels={{ text: 'Restore Defaults' }} />
 * ```
 */
const ResetThemeButton = React.forwardRef<HTMLButtonElement, ResetThemeButtonProps>(
  ({ labels, testId = 'reset-theme-button', ...props }, ref) => {
    const { setTheme } = useThemeConfig();

    const text = labels?.text ?? 'Reset to Default';

    const resetThemeHandle = () => {
      setTheme(DEFAULT_THEME);
    };

    return (
      <Button
        aria-label={text}
        className="mt-4 w-full"
        data-slot="reset-theme"
        data-testid={testId}
        onClick={resetThemeHandle}
        ref={ref}
        type="button"
        variant="destructive"
        {...props}
      >
        {text}
      </Button>
    );
  }
);

ResetThemeButton.displayName = 'ResetThemeButton';

export { ResetThemeButton };
