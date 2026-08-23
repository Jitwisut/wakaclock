'use client';

import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import Cookies from 'js-cookie';

import type { ThemeType } from '@/lib/themes';
import { DEFAULT_THEME } from '@/lib/themes';
import { cn } from '@/lib/utils';

function setThemeCookie(key: string, value: null | string) {
  if (typeof window === 'undefined') return;

  if (!value) {
    Cookies.remove(key, { path: '/' });
  } else {
    Cookies.set(key, value, {
      path: '/',
      expires: 365,
      sameSite: 'Lax',
      secure: window.location.protocol === 'https:',
    });
  }
}

/** Theme context type for accessing and updating theme configuration */
export interface ThemeContextType {
  /** Function to update the current theme */
  setTheme: (theme: ThemeType) => void;
  /** Current theme configuration */
  theme: ThemeType;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * ActiveThemeProvider component props
 *
 * @description Props for the theme provider component.
 */
export interface ActiveThemeProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Child elements to render within the provider */
  children: React.ReactNode;
  /** Initial theme configuration */
  initialTheme?: ThemeType;
  /** Whether to persist theme settings to cookies */
  persistToCookies?: boolean;
  /**
   * Custom test ID for testing
   * @default 'active-theme-provider'
   */
  testId?: string;
}

/**
 * ActiveThemeProvider component - Theme context provider
 *
 * @description
 * Provides theme configuration context to the application and manages
 * theme state with optional cookie persistence.
 *
 * ## Features
 * - **Theme Context**: Provides theme settings to child components
 * - **Cookie Persistence**: Saves preferences across sessions
 * - **Multiple Theme Aspects**: Radius, preset, scale, layout
 * - **SSR Compatible**: Works with server-side rendering
 *
 * ## Use Cases
 * - Application-wide theming
 * - Theme customization panels
 * - User preference persistence
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ActiveThemeProvider>
 *   <App />
 * </ActiveThemeProvider>
 *
 * // With initial theme
 * <ActiveThemeProvider initialTheme={{ preset: 'blue', radius: 'lg' }}>
 *   <App />
 * </ActiveThemeProvider>
 *
 * // Using the hook
 * function ThemeToggle() {
 *   const { theme, setTheme } = useThemeConfig();
 *   return <button onClick={() => setTheme({ ...theme, preset: 'green' })}>
 *     Change Theme
 *   </button>;
 * }
 * ```
 */
const ActiveThemeProvider = React.forwardRef<HTMLDivElement, ActiveThemeProviderProps>(
  (
    {
      children,
      className,
      initialTheme,
      persistToCookies = true,
      testId = 'active-theme-provider',
      ...props
    },
    ref
  ) => {
    const [theme, setTheme] = useState<ThemeType>(() => initialTheme || DEFAULT_THEME);

    useEffect(() => {
      if (!initialTheme) return;
      setTheme((currentTheme) => {
        if (
          currentTheme.contentLayout === initialTheme.contentLayout &&
          currentTheme.preset === initialTheme.preset &&
          currentTheme.radius === initialTheme.radius &&
          currentTheme.scale === initialTheme.scale
        ) {
          return currentTheme;
        }
        return initialTheme;
      });
    }, [
      initialTheme,
      initialTheme?.contentLayout,
      initialTheme?.preset,
      initialTheme?.radius,
      initialTheme?.scale,
    ]);

    // Mirrored onto <body> as well, because Radix renders popovers, dialogs, dropdowns
    // and toasts into a portal outside this subtree; without the attributes there they
    // would fall back to the default palette while the page around them is themed.
    useEffect(() => {
      if (typeof document === 'undefined') return;
      const { body } = document;
      const keepDefaultsInDataset = !persistToCookies;

      if (theme.radius !== 'default' || keepDefaultsInDataset) {
        if (persistToCookies) setThemeCookie('theme_radius', theme.radius);
        body.dataset.themeRadius = theme.radius;
      } else {
        if (persistToCookies) setThemeCookie('theme_radius', null);
        delete body.dataset.themeRadius;
      }

      if (theme.preset !== 'default' || keepDefaultsInDataset) {
        if (persistToCookies) setThemeCookie('theme_preset', theme.preset);
        body.dataset.themePreset = theme.preset;
      } else {
        if (persistToCookies) setThemeCookie('theme_preset', null);
        delete body.dataset.themePreset;
      }

      if (persistToCookies) setThemeCookie('theme_content_layout', theme.contentLayout);
      body.dataset.themeContentLayout = theme.contentLayout;

      if (theme.scale !== 'none' || keepDefaultsInDataset) {
        if (persistToCookies) setThemeCookie('theme_scale', theme.scale);
        body.dataset.themeScale = theme.scale;
      } else {
        if (persistToCookies) setThemeCookie('theme_scale', null);
        delete body.dataset.themeScale;
      }
    }, [persistToCookies, theme.preset, theme.radius, theme.scale, theme.contentLayout]);

    return (
      <ThemeContext.Provider value={{ theme, setTheme }}>
        {/*
          The theme attributes are rendered here, from state, rather than written to this
          element in an effect. Two things depend on that:

          1. They are present in the server HTML (state is seeded from `initialTheme`,
             which the dashboard layout reads from cookies), so the first paint already
             carries the right preset instead of flashing the default.
          2. They re-render when the preset changes. An attribute placed on some other
             element from a request cookie cannot, and because `themes.css` targets
             `[data-theme-preset='…']` anywhere in the tree, that stale copy would win over
             <body> for everything inside it — which is exactly how preset switching came
             to look like it did nothing.

          `group/layout` lives here too so the centered-content variants resolve against
          the same element that carries `data-theme-content-layout`.
        */}
        <div
          className={cn('group/layout', className)}
          data-slot="active-theme-provider"
          data-testid={testId}
          data-theme-content-layout={theme.contentLayout}
          data-theme-preset={theme.preset === 'default' ? undefined : theme.preset}
          data-theme-radius={theme.radius === 'default' ? undefined : theme.radius}
          data-theme-scale={theme.scale === 'none' ? undefined : theme.scale}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      </ThemeContext.Provider>
    );
  }
);
ActiveThemeProvider.displayName = 'ActiveThemeProvider';

/** Hook to access theme configuration from ActiveThemeProvider context */
function useThemeConfig(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeConfig must be used within an ActiveThemeProvider');
  }
  return context;
}
useThemeConfig.displayName = 'useThemeConfig';

export { ActiveThemeProvider, useThemeConfig };
