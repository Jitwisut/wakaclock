import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { INITIAL_VIEWPORTS, TOOL_ID as VIEWPORT_TOOL_ID } from 'storybook/viewport';

import { DEFAULT_THEME, THEMES } from '../lib/themes';

import { en, ja } from './languages';

import type { Preview } from '@storybook/nextjs-vite';

// =============================================================================
// Storybook SSOT (Single Source of Truth)
//
// Storybook requires separate entrypoints (`main.ts`, `preview.tsx`, `manager.ts`),
// but *values* should be defined here and imported by those files.
// =============================================================================

void i18n.use(initReactI18next).init({
  // Prevent a "flash" where stories render before translations are available.
  // Resources are inlined below, so we can initialize synchronously.
  initImmediate: false,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  supportedLngs: ['en', 'ja'],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  resources: { en, ja },
});

export { i18n as STORYBOOK_I18N };

export const STORYBOOK_BRAND = {
  title: 'template-frontend-rust',
  url: '/',
  target: '_self',
} as const;

export const STORYBOOK_STORY_SORT_ORDER = [
  'Documentation',
  'Foundations',
  ['Components', ['UI', 'Custom', 'Layout', 'Theme Customizer', 'Internal']],
  'Filemap',
] as const;

export const STORYBOOK_PREVIEW_INITIAL_GLOBALS = {
  locale: 'en',
  locales: {
    en: 'English',
    ja: '日本語',
  },
  addonRtl: 'ltr',
  viewport: {
    // Storybook's Viewport tool treats `undefined` as “responsive”.
    // Keeping this unset avoids showing “Reset viewport” by default.
    value: undefined,
    isRotated: false,
  },
  theme: 'light',
  preset: DEFAULT_THEME.preset,
  radius: DEFAULT_THEME.radius,
  scale: DEFAULT_THEME.scale,
  contentLayout: DEFAULT_THEME.contentLayout,
} as const;

export const STORYBOOK_MOCKING_DATE_UTC = Date.UTC(2024, 0, 1, 0, 0, 0);

export const STORYBOOK_MSW_INITIALIZE_OPTIONS = {
  onUnhandledRequest: 'bypass', // Silently pass through unhandled requests to avoid 404 noise
  serviceWorker: {
    url: '/mockServiceWorker.js',
  },
  quiet: true, // Reduce MSW logging noise in console
} as const;

// @storybook/addon-themes registers available theme names through
// `initializeThemeState()` (see `.storybook/preview.tsx`).
export const STORYBOOK_THEME_NAMES = ['light', 'dark'] as const;

export const STORYBOOK_THEME_PRESET_ITEMS = THEMES.map(({ name, value }) => ({
  value,
  title: name,
}));

export const STORYBOOK_THEME_RADIUS_ITEMS = [
  { value: 'default', title: 'Default' },
  { value: 'none', title: 'None' },
  { value: 'sm', title: 'Small' },
  { value: 'md', title: 'Medium' },
  { value: 'lg', title: 'Large' },
  { value: 'xl', title: 'Extra large' },
] as const;

export const STORYBOOK_THEME_SCALE_ITEMS = [
  { value: 'none', title: 'None' },
  { value: 'sm', title: 'Extra small' },
  { value: 'lg', title: 'Large' },
] as const;

export const STORYBOOK_THEME_CONTENT_LAYOUT_ITEMS = [
  { value: 'full', title: 'Full' },
  { value: 'centered', title: 'Centered' },
] as const;

export const STORYBOOK_BACKGROUND_VALUES = [
  { name: 'light', value: '#ffffff' },
  { name: 'dark', value: '#09090b' },
  { name: 'gray', value: '#f4f4f5' },
] as const;

export const STORYBOOK_VIEWPORT_OPTIONS = {
  // Chrome DevTools-style presets + Storybook defaults.
  mobile320: {
    name: 'Mobile 320',
    styles: { width: '320px', height: '568px' },
    type: 'mobile',
  },
  mobile360: {
    name: 'Mobile 360',
    styles: { width: '360px', height: '640px' },
    type: 'mobile',
  },
  mobile375: {
    name: 'Mobile 375',
    styles: { width: '375px', height: '667px' },
    type: 'mobile',
  },
  mobile414: {
    name: 'Mobile 414',
    styles: { width: '414px', height: '896px' },
    type: 'mobile',
  },
  tablet768: {
    name: 'Tablet 768',
    styles: { width: '768px', height: '1024px' },
    type: 'tablet',
  },
  laptop1024: {
    name: 'Laptop 1024',
    styles: { width: '1024px', height: '768px' },
    type: 'desktop',
  },
  ...INITIAL_VIEWPORTS,
  desktop1280: {
    name: 'Desktop 1280',
    styles: { width: '1280px', height: '800px' },
    type: 'desktop',
  },
  desktop1440: {
    name: 'Desktop 1440',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop',
  },
  desktop1536: {
    name: 'Desktop 1536',
    styles: { width: '1536px', height: '960px' },
    type: 'desktop',
  },
  desktop1920: {
    name: 'Desktop 1920',
    styles: { width: '1920px', height: '1080px' },
    type: 'desktop',
  },
} as const;

export const STORYBOOK_PREVIEW_PARAMETERS = {
  // Date / time determinism (storybook-addon-mock-date)
  mockingDate: STORYBOOK_MOCKING_DATE_UTC,

  // i18n
  i18n,

  // MSW
  msw: {
    handlers: [],
  },

  // Actions (avoid argTypesRegex; prefer explicit `fn()` in stories)
  actions: {},

  // Controls
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /date$/i,
    },
  },

  // Layout
  layout: 'centered',

  // Backgrounds
  backgrounds: {
    default: 'light',
    values: STORYBOOK_BACKGROUND_VALUES,
  },

  // Viewport
  viewport: {
    options: STORYBOOK_VIEWPORT_OPTIONS,
  },

  // Next.js
  nextjs: {
    appDirectory: true,
    navigation: {
      pathname: '/dashboard/default',
      query: {},
    },
  },

  // A11y - Comprehensive WCAG checking with axe-core
  a11y: {
    context: '#storybook-root',
    manual: false,
    options: {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
    },
  },

  // Docs
  docs: {
    codePanel: true,
    // Override docs canvas background to respect theme
    // @see https://github.com/storybookjs/storybook/discussions/25183
    canvas: {
      // Use Tailwind's bg-background class with !important to override CSS-in-JS
      className: '!bg-background',
    },
  },

  // Options
  options: {
    storySort: {
      order: STORYBOOK_STORY_SORT_ORDER,
    },
  },
} as const;

// Locale items for storybook-react-i18next toolbar
export const STORYBOOK_LOCALE_ITEMS = [
  { value: 'en', title: 'English', right: '🇺🇸' },
  { value: 'ja', title: '日本語', right: '🇯🇵' },
] as const;

export const STORYBOOK_GLOBAL_TYPES: NonNullable<Preview['globalTypes']> = {
  // Theme mode (light/dark) - explicit registration for URL params
  theme: {
    name: 'Theme',
    description: 'Global theme mode',
    toolbar: {
      title: 'Theme',
      icon: 'circlehollow',
      items: [
        { value: 'light', title: 'Light', icon: 'sun' },
        { value: 'dark', title: 'Dark', icon: 'moon' },
      ],
      dynamicTitle: true,
    },
  },
  // i18n locale (required for URL params and toolbar to work)
  locale: {
    name: 'Locale',
    description: 'Internationalization locale',
    toolbar: {
      title: 'Locale',
      icon: 'globe',
      items: [...STORYBOOK_LOCALE_ITEMS],
      dynamicTitle: true,
    },
  },
  preset: {
    description: 'Theme preset (design system tokens)',
    defaultValue: DEFAULT_THEME.preset,
    toolbar: {
      title: 'Preset',
      icon: 'paintbrush',
      items: [...STORYBOOK_THEME_PRESET_ITEMS],
      dynamicTitle: true,
    },
  },
  radius: {
    description: 'Border radius scale',
    defaultValue: DEFAULT_THEME.radius,
    toolbar: {
      title: 'Radius',
      icon: 'circle',
      items: [...STORYBOOK_THEME_RADIUS_ITEMS],
      dynamicTitle: true,
    },
  },
  scale: {
    description: 'Density scale',
    defaultValue: DEFAULT_THEME.scale,
    toolbar: {
      title: 'Scale',
      icon: 'paragraph',
      items: [...STORYBOOK_THEME_SCALE_ITEMS],
      dynamicTitle: true,
    },
  },
  contentLayout: {
    description: 'Content layout style',
    defaultValue: DEFAULT_THEME.contentLayout,
    toolbar: {
      title: 'Content',
      icon: 'sidebar',
      items: [...STORYBOOK_THEME_CONTENT_LAYOUT_ITEMS],
      dynamicTitle: true,
    },
  },
};

export const STORYBOOK_MANAGER_LAYOUT_CUSTOMISATIONS = {
  showPanel: () => true,
  showSidebar: () => true,
  showToolbar: () => true,
} as const;

export const STORYBOOK_MANAGER_TOOLBAR = {
  // Ensure the integrated Viewport tool is available globally.
  [VIEWPORT_TOOL_ID]: { hidden: false },
};

export const STORYBOOK_MANAGER_SIDEBAR = {
  showRoots: true,
  collapsedRoots: ['Filemap'],
};

export const STORYBOOK_VIEWPORT_TOOL_MATCH = ({ viewMode }: { viewMode: string }) =>
  viewMode === 'story' || viewMode === 'docs';

export const FILEMAP_META_PREVIEW_TABS = {
  // Hide addon panels for filemap entries (they’re internal coverage, not UI docs).
  'storybook/docs/panel': { hidden: true },
  'storybook/actions/panel': { hidden: true },
  'addon-controls': { hidden: true },
  'storybook/interactions/panel': { hidden: true },
  'storybook/a11y/panel': { hidden: true },
  'storybook/viewport/panel': { hidden: true },
  'STORYBOOK_ADDON_DESIGNS/panel': { hidden: true },
  'storybook-design-token/panel': { hidden: true },
} as const;

export const FILEMAP_META_PARAMETERS = {
  controls: { disable: true },
  actions: { disable: true },
  a11y: { disable: true },
  consoleToActions: { enabled: false },
  previewTabs: FILEMAP_META_PREVIEW_TABS,
} as const;
