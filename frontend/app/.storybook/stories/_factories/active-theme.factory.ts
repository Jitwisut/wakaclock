import { faker } from '@faker-js/faker';

// ============ TYPE DEFINITIONS ============

/** Theme preset option */
export type ActiveThemePreset =
  | 'default'
  | 'forest-whisper'
  | 'lake-view'
  | 'rose-garden'
  | 'sunset-glow'
  | 'underground';

/** Theme radius option */
export type ActiveThemeRadius = 'default' | 'lg' | 'md' | 'none' | 'sm' | 'xl';

/** Theme mode */
export type ActiveThemeMode = 'dark' | 'light' | 'system';

/** Interface for fake active theme data */
export interface FakeActiveTheme {
  /** Content layout style */
  contentLayout: 'centered' | 'full';
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Theme mode */
  mode: ActiveThemeMode;
  /** Theme preset name */
  preset: ActiveThemePreset;
  /** Primary color value */
  primaryColor: string;
  /** Border radius setting */
  radius: ActiveThemeRadius;
  /** Scale setting */
  scale: 'lg' | 'none' | 'sm';
}

/** Interface for theme configuration */
export interface FakeActiveThemeConfig {
  /** Whether cookies are persisted */
  persistToCookies: boolean;
  /** Theme preset */
  preset: ActiveThemePreset;
  /** Border radius */
  radius: ActiveThemeRadius;
  /** Scale setting */
  scale: 'lg' | 'none' | 'sm';
}

// ============ CONSTANTS FOR ITERATION ============

/** All theme preset options */
export const ACTIVE_THEME_PRESETS: ActiveThemePreset[] = [
  'default',
  'forest-whisper',
  'lake-view',
  'rose-garden',
  'sunset-glow',
  'underground',
];

/** All theme radius options */
export const ACTIVE_THEME_RADII: ActiveThemeRadius[] = ['default', 'lg', 'md', 'none', 'sm', 'xl'];

/** All theme mode options */
export const ACTIVE_THEME_MODES: ActiveThemeMode[] = ['dark', 'light', 'system'];

/** Primary color values by preset */
export const ACTIVE_THEME_COLORS: Record<ActiveThemePreset, string> = {
  default: 'oklch(0.33 0 0)',
  'forest-whisper': 'oklch(0.5276 0.1072 182.22)',
  'lake-view': 'oklch(0.765 0.177 163.22)',
  'rose-garden': 'oklch(0.5827 0.2418 12.23)',
  'sunset-glow': 'oklch(0.5827 0.2187 36.98)',
  underground: 'oklch(0.5315 0.0694 156.19)',
};

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake active theme
 * @param overrides - Optional partial overrides
 * @returns A fake active theme
 */
export function createFakeActiveTheme(overrides?: Partial<FakeActiveTheme>): FakeActiveTheme {
  const preset = faker.helpers.arrayElement(ACTIVE_THEME_PRESETS);

  return {
    id: faker.string.uuid(),
    label: preset.charAt(0).toUpperCase() + preset.slice(1).replaceAll('-', ' '),
    preset,
    radius: faker.helpers.arrayElement(ACTIVE_THEME_RADII),
    scale: faker.helpers.arrayElement(['none', 'sm', 'lg'] as const),
    contentLayout: faker.helpers.arrayElement(['full', 'centered'] as const),
    mode: faker.helpers.arrayElement(ACTIVE_THEME_MODES),
    primaryColor: ACTIVE_THEME_COLORS[preset],
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake active themes
 * @param count - Number of themes to generate
 * @returns Array of fake active themes
 */
export function createFakeActiveThemes(count: number): FakeActiveTheme[] {
  return Array.from({ length: count }, () => createFakeActiveTheme());
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a dark mode theme
 * @param preset - Optional preset
 * @returns A dark mode theme
 */
export function createFakeDarkTheme(preset?: ActiveThemePreset): FakeActiveTheme {
  return createFakeActiveTheme({
    mode: 'dark',
    preset: preset ?? faker.helpers.arrayElement(ACTIVE_THEME_PRESETS),
  });
}

/**
 * Creates a light mode theme
 * @param preset - Optional preset
 * @returns A light mode theme
 */
export function createFakeLightTheme(preset?: ActiveThemePreset): FakeActiveTheme {
  return createFakeActiveTheme({
    mode: 'light',
    preset: preset ?? faker.helpers.arrayElement(ACTIVE_THEME_PRESETS),
  });
}

/**
 * Creates themes for all presets
 * @returns Array with one theme per preset
 */
export function createFakeActiveThemesByPreset(): FakeActiveTheme[] {
  return ACTIVE_THEME_PRESETS.map((preset) =>
    createFakeActiveTheme({
      id: `preset-${preset}`,
      preset,
      label: preset.charAt(0).toUpperCase() + preset.slice(1).replaceAll('-', ' '),
    })
  );
}

/**
 * Creates a theme configuration
 * @param scenario - Configuration scenario
 * @returns Theme configuration
 */
export function createFakeActiveThemeConfig(
  scenario: 'default' | 'large' | 'minimal' = 'default'
): FakeActiveThemeConfig {
  const configs: Record<string, FakeActiveThemeConfig> = {
    default: {
      preset: 'default',
      radius: 'default',
      scale: 'none',
      persistToCookies: true,
    },
    large: {
      preset: 'lake-view',
      radius: 'xl',
      scale: 'lg',
      persistToCookies: true,
    },
    minimal: {
      preset: 'underground',
      radius: 'none',
      scale: 'sm',
      persistToCookies: false,
    },
  };

  return configs[scenario];
}
