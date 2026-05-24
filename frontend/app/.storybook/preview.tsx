/**
 * Storybook Preview Configuration
 * ================================
 * Enterprise-grade configuration for production Storybook deployments.
 *
 * Features:
 * - Type-safe configuration with full TypeScript support
 * - Error boundary decorator for graceful error handling
 * - Console-to-Actions integration for debugging
 * - MSW (Mock Service Worker) integration for API mocking
 * - Theme provider integration with next-themes
 * - Performance monitoring and cleanup
 * - Memory leak prevention with proper effect cleanup
 *
 * @see https://storybook.js.org/docs/configure
 * @see https://storybook.js.org/docs/writing-stories/decorators
 */

import '../app/globals.css';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

import { DecoratorHelpers } from '@storybook/addon-themes';
import { ThemeProvider, useTheme } from 'next-themes';
import { action } from 'storybook/actions';

import { ActiveThemeProvider } from '@/components/active-theme';
import { Toaster } from '@/components/ui/sonner';
import { fontVariables } from '@/lib/fonts';
import type { ThemeContentLayout, ThemeRadius, ThemeScale } from '@/lib/themes';
import { cn } from '@/lib/utils';

import {
  STORYBOOK_GLOBAL_TYPES,
  STORYBOOK_I18N,
  STORYBOOK_MSW_INITIALIZE_OPTIONS,
  STORYBOOK_PREVIEW_INITIAL_GLOBALS,
  STORYBOOK_PREVIEW_PARAMETERS,
  STORYBOOK_THEME_CONTENT_LAYOUT_ITEMS,
  STORYBOOK_THEME_NAMES,
  STORYBOOK_THEME_PRESET_ITEMS,
  STORYBOOK_THEME_RADIUS_ITEMS,
  STORYBOOK_THEME_SCALE_ITEMS,
} from './ssot';

import type { Preview, StoryContext } from '@storybook/nextjs-vite';
import type {
  Context as MswContext,
  InitializeOptions as MswInitializeOptions,
} from 'msw-storybook-addon';

// =============================================================================
// Constants
// =============================================================================

const STORYBOOK_THEME_STORAGE_KEY = 'storybook-theme';

const THEME_PRESET_VALUES = new Set(STORYBOOK_THEME_PRESET_ITEMS.map((item) => item.value));
const THEME_RADIUS_VALUES = new Set<ThemeRadius>(
  STORYBOOK_THEME_RADIUS_ITEMS.map((item) => item.value)
);
const THEME_SCALE_VALUES = new Set<ThemeScale>(
  STORYBOOK_THEME_SCALE_ITEMS.map((item) => item.value)
);
const THEME_CONTENT_LAYOUT_VALUES = new Set<ThemeContentLayout>(
  STORYBOOK_THEME_CONTENT_LAYOUT_ITEMS.map((item) => item.value)
);

// =============================================================================
// Hooks
// =============================================================================

/**
 * Isomorphic useLayoutEffect that works in SSR environments.
 * Falls back to useEffect on the server to avoid React warnings.
 */
const useIsomorphicLayoutEffect =
  typeof document === 'undefined' ? React.useEffect : React.useLayoutEffect;

// =============================================================================
// Initialization
// =============================================================================

// Combined initialization block for browser environment
// @see https://github.com/storybookjs/storybook/issues/32028
if ('window' in globalThis && 'document' in globalThis) {
  try {
    // Clear persisted theme to ensure consistent boot state
    window.localStorage.removeItem(STORYBOOK_THEME_STORAGE_KEY);

    // Initialize theme state for @storybook/addon-themes
    DecoratorHelpers.initializeThemeState([...STORYBOOK_THEME_NAMES], 'light');

    // Set deterministic defaults before first render
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');

    // Performance mark for debugging
    if (window.performance?.mark) {
      window.performance.mark('storybook-preview-init');
    }
  } catch {
    // Silently fail - initialization errors should not break Storybook
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Type-safe enum value coercion with fallback.
 */
function coerceEnumValue<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return typeof value === 'string' && allowed.has(value as T) ? (value as T) : fallback;
}

// =============================================================================
// MSW (Mock Service Worker) Integration
// =============================================================================

type MswAddon = {
  initialize: (options?: MswInitializeOptions) => unknown;
  mswLoader: (context: MswContext) => Promise<Record<string, never>>;
};

let mswAddonPromise: null | Promise<MswAddon> = null;

if (typeof window !== 'undefined') {
  // Eagerly initialize MSW when Storybook loads for faster story rendering
  mswAddonPromise = import('msw-storybook-addon').then((addon) => {
    addon.initialize(STORYBOOK_MSW_INITIALIZE_OPTIONS);
    return addon as MswAddon;
  });
}

/**
 * MSW loader that ensures initialization before each story.
 */
const mswLoaderWithInit: MswAddon['mswLoader'] = async (context) => {
  if (typeof window === 'undefined' || !mswAddonPromise) return {};

  const { mswLoader } = await mswAddonPromise;
  return mswLoader(context);
};

// =============================================================================
// Error Boundary
// =============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  storyId?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  hasError: boolean;
}

/**
 * Production-grade error boundary for graceful error handling in stories.
 * Prevents a single story error from breaking the entire Storybook.
 */
class StoryErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, storyId } = this.props;

    // Log error for debugging
    const storyIdSuffix = storyId ? ` in ${storyId}` : '';
    console.error(`[Storybook] Story error${storyIdSuffix}:`, error, errorInfo);

    // Call custom error handler if provided
    onError?.(error, errorInfo);

    // Report to Actions panel
    try {
      action('story-error')({
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        storyId,
      });
    } catch {
      // Ignore action errors
    }
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          style={{
            padding: '24px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h3 style={{ margin: '0 0 8px', color: '#dc2626', fontSize: '16px', fontWeight: 600 }}>
            {STORYBOOK_I18N.t('preview.errorBoundary.title', 'Story Error')}
          </h3>
          <p style={{ margin: '0 0 16px', color: '#7f1d1d', fontSize: '14px' }}>
            {STORYBOOK_I18N.t(
              'preview.errorBoundary.description',
              'An error occurred while rendering this story.'
            )}
          </p>
          <pre
            style={{
              padding: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '200px',
              color: '#374151',
            }}
          >
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
            type="button"
          >
            {STORYBOOK_I18N.t('preview.errorBoundary.retry', 'Retry')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// Console-to-Actions Integration
// =============================================================================

interface ConsoleToActionsOptions {
  /** Patterns to exclude from console capture */
  consoleExclude?: RegExp[];
  /** Patterns to include in console capture (if set, only matching logs are captured) */
  consoleInclude?: RegExp[];
  /** Enable/disable console capture */
  enabled?: boolean;
  /** Prefix Action Logger entries with "Title / Story" */
  includeStoryPrefix?: boolean;
  /** Forward console output to the browser console */
  mirrorToConsole?: boolean;
  /** Patterns to exclude from Actions panel */
  panelExclude?: RegExp[];
  /** Patterns to include in Actions panel */
  panelInclude?: RegExp[];
}

interface ConsoleToActionsStoryContext {
  id?: string;
  name?: string;
  parameters?: Record<string, unknown>;
  title?: string;
  viewMode?: string;
}

const DEFAULT_CONSOLE_OPTIONS: Pick<ConsoleToActionsOptions, 'consoleExclude' | 'panelExclude'> &
  Required<Pick<ConsoleToActionsOptions, 'includeStoryPrefix' | 'mirrorToConsole'>> = {
  includeStoryPrefix: true,
  mirrorToConsole: true,
  panelExclude: [/^\[HMR\]/, /^\[vite\]/, /^\[Storybook\]/, /^\[MSW\]/],
  consoleExclude: [],
};

function argsToSearchText(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      return '';
    })
    .filter(Boolean)
    .join(' ');
}

function matchesAny(text: string, patterns: RegExp[] | undefined): boolean {
  if (!patterns || patterns.length === 0) return false;
  return patterns.some((re) => re.test(text));
}

function shouldForward(
  text: string,
  include: RegExp[] | undefined,
  exclude: RegExp[] | undefined
): boolean {
  if (include && include.length > 0) return matchesAny(text, include);
  if (exclude && exclude.length > 0) return !matchesAny(text, exclude);
  return true;
}

function getConsoleOptions(context: ConsoleToActionsStoryContext): ConsoleToActionsOptions {
  const storyOptions = (context.parameters?.consoleToActions ?? {}) as ConsoleToActionsOptions;
  return { ...DEFAULT_CONSOLE_OPTIONS, ...storyOptions };
}

/**
 * Component that captures console output and forwards it to the Storybook Actions panel.
 * Properly cleans up on unmount to prevent memory leaks.
 */
function ConsoleToActions({
  children,
  context,
}: {
  children: ReactNode;
  context: ConsoleToActionsStoryContext;
}): React.ReactElement {
  const options = getConsoleOptions(context);

  React.useEffect(() => {
    if (options.enabled === false) return;

    const prefix = options.includeStoryPrefix
      ? `${context.title ?? STORYBOOK_I18N.t('preview.consoleToActions.unknownTitle', 'Unknown')} / ${context.name ?? STORYBOOK_I18N.t('preview.consoleToActions.defaultStoryName', 'Story')}`
      : null;

    const logAction = action('console.log');
    const warnAction = action('console.warn');
    const errorAction = action('console.error');

    // Store original console methods
    const original = {
      log: globalThis.console.log,
      info: globalThis.console.info,
      warn: globalThis.console.warn,
      error: globalThis.console.error,
      debug: globalThis.console.debug,
    };

    const wrap =
      (
        originalFn: (...args: unknown[]) => void,
        panelFn: (...args: unknown[]) => void,
        panelInclude: RegExp[] | undefined,
        panelExclude: RegExp[] | undefined,
        consoleInclude: RegExp[] | undefined,
        consoleExclude: RegExp[] | undefined
      ) =>
      (...args: unknown[]) => {
        const text = argsToSearchText(args);

        // Forward to Actions panel
        if (shouldForward(text, panelInclude, panelExclude)) {
          try {
            if (prefix) panelFn(prefix, ...args);
            else panelFn(...args);
          } catch {
            // Ignore action errors
          }
        }

        // Mirror to browser console
        if (options.mirrorToConsole && shouldForward(text, consoleInclude, consoleExclude)) {
          try {
            originalFn(...args);
          } catch {
            // Ignore console errors
          }
        }
      };

    // Wrap console methods
    globalThis.console.log = wrap(
      original.log,
      logAction,
      options.panelInclude,
      options.panelExclude,
      options.consoleInclude,
      options.consoleExclude
    );
    globalThis.console.info = wrap(
      original.info,
      logAction,
      options.panelInclude,
      options.panelExclude,
      options.consoleInclude,
      options.consoleExclude
    );
    globalThis.console.debug = wrap(
      original.debug,
      logAction,
      options.panelInclude,
      options.panelExclude,
      options.consoleInclude,
      options.consoleExclude
    );
    globalThis.console.warn = wrap(
      original.warn,
      warnAction,
      options.panelInclude,
      options.panelExclude,
      options.consoleInclude,
      options.consoleExclude
    );
    globalThis.console.error = wrap(
      original.error,
      errorAction,
      options.panelInclude,
      options.panelExclude,
      options.consoleInclude,
      options.consoleExclude
    );

    // Cleanup: restore original console methods
    return () => {
      globalThis.console.log = original.log;
      globalThis.console.info = original.info;
      globalThis.console.warn = original.warn;
      globalThis.console.error = original.error;
      globalThis.console.debug = original.debug;
    };
  }, [
    context.id,
    context.name,
    context.title,
    options.consoleExclude,
    options.consoleInclude,
    options.enabled,
    options.includeStoryPrefix,
    options.mirrorToConsole,
    options.panelExclude,
    options.panelInclude,
  ]);

  return children as React.ReactElement;
}

// =============================================================================
// Theme Synchronization Components
// =============================================================================

/**
 * Syncs the next-themes provider with Storybook's theme global.
 */
function ThemeSync({ theme }: { theme: string }): null {
  const { setTheme } = useTheme();

  useIsomorphicLayoutEffect(() => {
    setTheme(theme);
  }, [setTheme, theme]);

  return null;
}

/**
 * Syncs HTML document attributes (lang, dir) with Storybook globals.
 */
function HtmlSync({ dir, lang }: { dir: string; lang: string }): null {
  useIsomorphicLayoutEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  return null;
}

/**
 * Syncs i18next language with Storybook's locale global.
 * This ensures translations update when the locale toolbar changes.
 */
function I18nSync({ locale }: { locale: string }): null {
  useIsomorphicLayoutEffect(() => {
    if (STORYBOOK_I18N.language !== locale) {
      void STORYBOOK_I18N.changeLanguage(locale);
    }
  }, [locale]);

  return null;
}

/**
 * Syncs body class names with theme configuration.
 * Properly cleans up classes on unmount.
 */
function BodyClassSync({ className }: { className: string }): null {
  useIsomorphicLayoutEffect(() => {
    const classes = className.split(/\s+/).filter(Boolean);
    if (classes.length === 0) return;

    document.body.classList.add(...classes);

    return () => {
      document.body.classList.remove(...classes);
    };
  }, [className]);

  return null;
}

/**
 * Syncs body data attributes with theme configuration.
 * Properly cleans up attributes on unmount.
 */
function BodyThemeAttributesSync({
  contentLayout,
  preset,
  radius,
  scale,
}: {
  contentLayout: string;
  preset: string;
  radius: string;
  scale: string;
}): null {
  useIsomorphicLayoutEffect(() => {
    const entries: [string, string][] = [
      ['data-theme-content-layout', contentLayout],
      ['data-theme-preset', preset],
      ['data-theme-radius', radius],
      ['data-theme-scale', scale],
    ];

    for (const [key, value] of entries) {
      document.body.setAttribute(key, value);
    }

    return () => {
      for (const [key] of entries) {
        document.body.removeAttribute(key);
      }
    };
  }, [contentLayout, preset, radius, scale]);

  return null;
}

/**
 * Syncs backgrounds with theme to override Storybook's CSS-in-JS.
 * Uses setProperty with 'important' since CSS !important rules don't win.
 * @see https://github.com/hipstersmoothie/storybook-dark-mode/issues/235
 * @see https://github.com/storybookjs/storybook/discussions/25183
 */
function DocsBackgroundSync({ theme }: { theme: 'dark' | 'light' }): null {
  useIsomorphicLayoutEffect(() => {
    const BG_COLOR_PROP = 'background-color';
    const bgColor = theme === 'dark' ? 'oklch(0.141 0.004 285.83)' : 'oklch(1 0 0)';
    const containerSelector = '.docs-story, .sbdocs-preview';

    // Apply to body
    document.body.style.setProperty(BG_COLOR_PROP, bgColor, 'important');

    // Apply to docs containers (delayed to catch lazy-loaded elements)
    const applyToContainers = () => {
      document.querySelectorAll<HTMLElement>(containerSelector).forEach((el) => {
        el.style.setProperty(BG_COLOR_PROP, bgColor, 'important');
      });
    };

    applyToContainers();
    const timer = setTimeout(applyToContainers, 500);

    // Cleanup: remove styles to prevent state leakage
    // @see https://github.com/storybookjs/storybook/issues/26994
    return () => {
      clearTimeout(timer);
      document.body.style.removeProperty(BG_COLOR_PROP);
      document.querySelectorAll<HTMLElement>(containerSelector).forEach((el) => {
        el.style.removeProperty(BG_COLOR_PROP);
      });
    };
  }, [theme]);

  return null;
}

// =============================================================================
// Decorators
// =============================================================================

/**
 * Higher-order component that wraps stories with console-to-actions functionality.
 */
function withConsoleToActions() {
  return (storyFn: React.FC, context: ConsoleToActionsStoryContext) => {
    const StoryRenderer = storyFn;
    return (
      <ConsoleToActions context={context}>
        <StoryRenderer />
      </ConsoleToActions>
    );
  };
}

/**
 * Higher-order component that wraps stories with error boundary.
 */
function withErrorBoundary() {
  return (storyFn: React.FC, context: StoryContext) => {
    const StoryRenderer = storyFn;
    return (
      <StoryErrorBoundary storyId={context.id}>
        <StoryRenderer />
      </StoryErrorBoundary>
    );
  };
}

/**
 * Main theme decorator that provides all necessary context providers.
 */
function withThemeProvider(storyFn: React.FC, context: StoryContext) {
  const StoryRenderer = storyFn;
  const globals = context.globals ?? {};
  const theme = ((globals.theme as string | undefined) ?? 'light') as 'dark' | 'light';
  const dir = ((globals.addonRtl as string | undefined) ?? 'ltr') as 'ltr' | 'rtl';
  const lang = ((globals.locale as string | undefined) ?? 'en') as string;

  const safeTheme = theme === 'dark' ? 'dark' : 'light';
  const safeDir = dir === 'rtl' ? 'rtl' : 'ltr';
  // Handle Storybook's _reset value (used when resetting globals via URL params)
  const safeLang =
    typeof lang === 'string' && lang.length > 0 && !lang.startsWith('_') ? lang : 'en';

  const initialTheme = {
    preset: coerceEnumValue<string>(
      globals.preset,
      THEME_PRESET_VALUES,
      STORYBOOK_PREVIEW_INITIAL_GLOBALS.preset
    ),
    radius: coerceEnumValue<ThemeRadius>(
      globals.radius,
      THEME_RADIUS_VALUES,
      STORYBOOK_PREVIEW_INITIAL_GLOBALS.radius
    ),
    scale: coerceEnumValue<ThemeScale>(
      globals.scale,
      THEME_SCALE_VALUES,
      STORYBOOK_PREVIEW_INITIAL_GLOBALS.scale
    ),
    contentLayout: coerceEnumValue<ThemeContentLayout>(
      globals.contentLayout,
      THEME_CONTENT_LAYOUT_VALUES,
      STORYBOOK_PREVIEW_INITIAL_GLOBALS.contentLayout
    ),
  };

  const bodyClassName = cn('bg-background text-foreground group/layout font-sans', fontVariables);
  const isFullscreen = context.parameters.layout === 'fullscreen';
  const containerClassName = isFullscreen
    ? 'min-h-svh w-full text-foreground'
    : 'p-6 text-foreground';
  const containerStyle: React.CSSProperties = { width: '100%' };

  // Mirror the app's "content layout" behavior
  if (initialTheme.contentLayout === 'centered') {
    containerStyle.margin = '0 auto';
    containerStyle.maxWidth = '1280px';
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={safeTheme}
      disableTransitionOnChange
      enableSystem={false}
      storageKey={STORYBOOK_THEME_STORAGE_KEY}
    >
      <ThemeSync theme={safeTheme} />
      <HtmlSync dir={safeDir} lang={safeLang} />
      <I18nSync locale={safeLang} />
      <BodyClassSync className={bodyClassName} />
      <DocsBackgroundSync theme={safeTheme} />
      <BodyThemeAttributesSync
        contentLayout={initialTheme.contentLayout}
        preset={initialTheme.preset}
        radius={initialTheme.radius}
        scale={initialTheme.scale}
      />
      <ActiveThemeProvider initialTheme={initialTheme} persistToCookies={false}>
        <div
          className={containerClassName}
          data-theme-content-layout={initialTheme.contentLayout}
          data-theme-preset={initialTheme.preset}
          data-theme-radius={initialTheme.radius}
          data-theme-scale={initialTheme.scale}
          dir={safeDir}
          style={containerStyle}
        >
          <StoryRenderer />
        </div>
        <Toaster position="top-center" richColors />
      </ActiveThemeProvider>
    </ThemeProvider>
  );
}

// =============================================================================
// Preview Configuration Export
// =============================================================================

export default {
  // Initial Globals (used by storybook-react-i18next and theme addons)
  initialGlobals: STORYBOOK_PREVIEW_INITIAL_GLOBALS,

  // Parameters (controls, actions, docs, a11y, etc.)
  parameters: STORYBOOK_PREVIEW_PARAMETERS,

  // Global Types (toolbar controls)
  globalTypes: STORYBOOK_GLOBAL_TYPES,

  // Decorators (applied in order: first decorator wraps the outermost layer)
  decorators: [withConsoleToActions(), withErrorBoundary(), withThemeProvider],

  // Loaders (async data loading before story render)
  loaders: [mswLoaderWithInit],

  // Tags (enable autodocs for all stories by default)
  tags: ['autodocs'],
} satisfies Preview;
