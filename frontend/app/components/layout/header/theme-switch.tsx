'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';

/**
 * Labels for the ThemeSwitch component
 */
export interface ThemeSwitchLabels {
  toggleTheme?: string;
}

/**
 * ThemeSwitch component props
 *
 * @description Props for the light/dark theme toggle button.
 */
export interface ThemeSwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Customizable labels for internationalization */
  labels?: ThemeSwitchLabels;
  /**
   * Custom test ID for testing
   * @default 'header-theme-switch'
   */
  testId?: string;
}

/**
 * ThemeSwitch component - Toggle between light and dark themes
 *
 * @description
 * A button that toggles between light and dark color modes.
 * Displays sun/moon icon based on current theme state.
 *
 * ## Features
 * - **Visual Indicator**: Sun (light) / Moon (dark) icons
 * - **Instant Toggle**: Immediate theme switch
 * - **Persistence**: Theme saved via next-themes
 * - **SSR Safe**: Renders null until mounted
 *
 * ## Accessibility
 * - `aria-pressed` indicates current state
 * - Dynamic aria-label describes action
 * - Screen reader text in sr-only span
 *
 * @example
 * ```tsx
 * <ThemeSwitch labels={{ toggleTheme: 'Switch theme' }} />
 * ```
 */
const ThemeSwitch = React.forwardRef<HTMLButtonElement, ThemeSwitchProps>(
  ({ labels, testId = 'header-theme-switch', ...props }, ref) => {
    const [mounted, setMounted] = useState(false);
    const { theme, setTheme } = useTheme();
    const toggleThemeLabel = labels?.toggleTheme ?? 'Toggle theme';

    useEffect(() => {
      setMounted(true);
    }, []);

    if (!mounted) {
      return null;
    }

    return (
      <Button
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        aria-pressed={theme === 'dark'}
        className="relative"
        data-slot="theme-switch"
        data-testid={testId}
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        ref={ref}
        size="icon"
        type="button"
        variant="ghost"
        {...props}
      >
        {theme === 'light' ? <SunIcon /> : <MoonIcon />}
        <span className="sr-only">{toggleThemeLabel}</span>
      </Button>
    );
  }
);

ThemeSwitch.displayName = 'ThemeSwitch';

export { ThemeSwitch };
export default ThemeSwitch;
