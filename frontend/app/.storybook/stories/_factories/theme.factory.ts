import { faker } from '@faker-js/faker';
import i18n from 'i18next';

faker.seed(12_345);

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

/** Theme preset variant */
export type ThemePreset =
  | 'blossom'
  | 'default'
  | 'forest'
  | 'midnight'
  | 'ocean'
  | 'sunset'
  | 'underground';

/** Color mode variant */
export type ColorMode = 'dark' | 'light' | 'system';

/** Content layout variant */
export type ContentLayout = 'centered' | 'full' | 'wide';

/** Theme radius variant */
export type ThemeRadius = 'full' | 'lg' | 'md' | 'none' | 'sm' | 'xl';

/** Theme scale variant */
export type ThemeScale = 'compact' | 'default' | 'lg' | 'none' | 'sm' | 'spacious' | 'xs';

/** Sidebar mode variant */
export type SidebarMode = 'collapsed' | 'default' | 'floating' | 'icon' | 'off';

/** Font family variant */
export type FontFamily = 'mono' | 'sans' | 'serif' | 'system';

/** Accent color variant */
export type AccentColor =
  | 'amber'
  | 'blue'
  | 'cyan'
  | 'emerald'
  | 'fuchsia'
  | 'green'
  | 'indigo'
  | 'lime'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'red'
  | 'rose'
  | 'sky'
  | 'teal'
  | 'violet'
  | 'yellow';

// ═══════════════════════════════════════════════════════════════
// INTERFACE (Shape of Generated Data)
// ═══════════════════════════════════════════════════════════════

export interface ThemeConfig {
  accentColor: AccentColor;
  animations: boolean;
  colorMode: ColorMode;
  contentLayout: ContentLayout;
  fontFamily: FontFamily;
  fontSize: number;
  highContrast: boolean;
  id: string;
  preset: ThemePreset;
  radius: ThemeRadius;
  reducedMotion: boolean;
  scale: ThemeScale;
  sidebarMode: SidebarMode;
  syncWithSystem: boolean;
  updatedAt: string;
  userId?: string;
}

export interface ThemePresetInfo {
  colors: {
    accent: string;
    background: string;
    foreground: string;
    muted: string;
    primary: string;
    secondary: string;
  };
  description: string;
  id: ThemePreset;
  isDark: boolean;
  name: string;
  thumbnail?: string;
}

export interface ThemeCustomization {
  borderRadius: number;
  customCSS?: string;
  fontScale: number;
  id: string;
  lineHeight: number;
  name: string;
  spacing: number;
}

export interface ThemeExport {
  config: ThemeConfig;
  createdAt: string;
  exportFormat: 'css' | 'json' | 'tailwind';
  id: string;
  name: string;
  version: string;
}

export interface ThemeHistory {
  action: 'applied' | 'created' | 'deleted' | 'modified' | 'reset';
  configSnapshot: ThemeConfig;
  id: string;
  timestamp: string;
  userId: string;
}

export interface ThemePreference {
  autoSwitch: boolean;
  darkScheduleEnd: string;
  darkScheduleStart: string;
  followSystemTheme: boolean;
  id: string;
  preferredDarkPreset: ThemePreset;
  preferredLightPreset: ThemePreset;
  userId: string;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS (Used in Stories for Iteration)
// ═══════════════════════════════════════════════════════════════

export const THEME_PRESET_IDS: ThemePreset[] = [
  'default',
  'underground',
  'midnight',
  'blossom',
  'forest',
  'ocean',
  'sunset',
];

export const COLOR_MODES: ColorMode[] = ['light', 'dark', 'system'];

export const CONTENT_LAYOUTS: ContentLayout[] = ['full', 'wide', 'centered'];

export const THEME_RADII: ThemeRadius[] = ['none', 'sm', 'md', 'lg', 'xl', 'full'];

export const THEME_SCALES: ThemeScale[] = [
  'compact',
  'xs',
  'sm',
  'none',
  'default',
  'lg',
  'spacious',
];

export const SIDEBAR_MODES: SidebarMode[] = ['default', 'collapsed', 'icon', 'floating', 'off'];

export const FONT_FAMILIES: FontFamily[] = ['system', 'sans', 'serif', 'mono'];

export const ACCENT_COLORS: AccentColor[] = [
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
];

export const THEME_PRESETS: ThemePresetInfo[] = [
  {
    id: 'default',
    name: i18n.t('factory.theme.default', 'Default'),
    description: i18n.t(
      'factory.theme.theStandardThemeWithNeutral',
      'The standard theme with neutral colors'
    ),
    isDark: false,
    colors: {
      primary: '#0f172a',
      secondary: '#64748b',
      accent: '#3b82f6',
      background: '#ffffff',
      foreground: '#0f172a',
      muted: '#f1f5f9',
    },
  },
  {
    id: 'underground',
    name: i18n.t('factory.theme.underground', 'Underground'),
    description: i18n.t(
      'factory.theme.darkAndMoodyWithPurple',
      'Dark and moody with purple accents'
    ),
    isDark: true,
    colors: {
      primary: '#1e1b4b',
      secondary: '#6366f1',
      accent: '#8b5cf6',
      background: '#0f0f23',
      foreground: '#e2e8f0',
      muted: '#1e1b4b',
    },
  },
  {
    id: 'midnight',
    name: i18n.t('factory.theme.midnight', 'Midnight'),
    description: i18n.t('factory.theme.deepBlueTonesForNight', 'Deep blue tones for night owls'),
    isDark: true,
    colors: {
      primary: '#0c1929',
      secondary: '#1e3a5f',
      accent: '#60a5fa',
      background: '#020617',
      foreground: '#e2e8f0',
      muted: '#1e293b',
    },
  },
  {
    id: 'blossom',
    name: i18n.t('factory.theme.blossom', 'Blossom'),
    description: i18n.t('factory.theme.softPinkAndRoseTones', 'Soft pink and rose tones'),
    isDark: false,
    colors: {
      primary: '#831843',
      secondary: '#f472b6',
      accent: '#ec4899',
      background: '#fdf2f8',
      foreground: '#831843',
      muted: '#fce7f3',
    },
  },
  {
    id: 'forest',
    name: i18n.t('factory.theme.forest', 'Forest'),
    description: i18n.t(
      'factory.theme.naturalGreensInspiredByNature',
      'Natural greens inspired by nature'
    ),
    isDark: false,
    colors: {
      primary: '#14532d',
      secondary: '#22c55e',
      accent: '#16a34a',
      background: '#f0fdf4',
      foreground: '#14532d',
      muted: '#dcfce7',
    },
  },
  {
    id: 'ocean',
    name: i18n.t('factory.theme.ocean', 'Ocean'),
    description: i18n.t('factory.theme.calmBlueTonesLikeThe', 'Calm blue tones like the sea'),
    isDark: false,
    colors: {
      primary: '#164e63',
      secondary: '#06b6d4',
      accent: '#0891b2',
      background: '#ecfeff',
      foreground: '#164e63',
      muted: '#cffafe',
    },
  },
  {
    id: 'sunset',
    name: i18n.t('factory.theme.sunset', 'Sunset'),
    description: i18n.t('factory.theme.warmOrangeAndAmberHues', 'Warm orange and amber hues'),
    isDark: false,
    colors: {
      primary: '#7c2d12',
      secondary: '#f97316',
      accent: '#ea580c',
      background: '#fff7ed',
      foreground: '#7c2d12',
      muted: '#ffedd5',
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// SINGLE ITEM FACTORY
// ═══════════════════════════════════════════════════════════════

export function createFakeThemeConfig(overrides?: Partial<ThemeConfig>): ThemeConfig {
  return {
    id: faker.string.uuid(),
    preset: faker.helpers.arrayElement(THEME_PRESET_IDS),
    colorMode: faker.helpers.arrayElement(COLOR_MODES),
    contentLayout: faker.helpers.arrayElement(CONTENT_LAYOUTS),
    radius: faker.helpers.arrayElement(THEME_RADII),
    scale: faker.helpers.arrayElement(THEME_SCALES),
    sidebarMode: faker.helpers.arrayElement(SIDEBAR_MODES),
    fontFamily: faker.helpers.arrayElement(FONT_FAMILIES),
    fontSize: faker.helpers.arrayElement([12, 14, 16, 18, 20]),
    accentColor: faker.helpers.arrayElement(ACCENT_COLORS),
    animations: faker.datatype.boolean({ probability: 0.9 }),
    reducedMotion: faker.datatype.boolean({ probability: 0.1 }),
    highContrast: faker.datatype.boolean({ probability: 0.1 }),
    syncWithSystem: faker.datatype.boolean({ probability: 0.5 }),
    updatedAt: faker.date.recent().toISOString(),
    userId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.8 }),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// BULK FACTORY (For Lists/Tables)
// ═══════════════════════════════════════════════════════════════

export function createFakeThemeConfigs(
  count: number,
  overrides?: Partial<ThemeConfig>
): ThemeConfig[] {
  return Array.from({ length: count }, () => createFakeThemeConfig(overrides));
}

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED FACTORIES (For Specific Scenarios)
// ═══════════════════════════════════════════════════════════════

/** Create the default theme config */
export function createDefaultThemeConfig(): ThemeConfig {
  return createFakeThemeConfig({
    preset: 'default',
    colorMode: 'system',
    contentLayout: 'full',
    radius: 'md',
    scale: 'default',
    sidebarMode: 'default',
    fontFamily: 'system',
    fontSize: 16,
    accentColor: 'blue',
    animations: true,
    reducedMotion: false,
    highContrast: false,
    syncWithSystem: true,
  });
}

/** Create a dark mode config */
export function createDarkThemeConfig(): ThemeConfig {
  return createFakeThemeConfig({
    preset: faker.helpers.arrayElement(['midnight', 'underground']),
    colorMode: 'dark',
    animations: true,
  });
}

/** Create a light mode config */
export function createLightThemeConfig(): ThemeConfig {
  return createFakeThemeConfig({
    preset: faker.helpers.arrayElement(['default', 'blossom', 'forest', 'ocean']),
    colorMode: 'light',
  });
}

/** Create an accessible theme config */
export function createAccessibleThemeConfig(): ThemeConfig {
  return createFakeThemeConfig({
    reducedMotion: true,
    highContrast: true,
    animations: false,
    fontSize: 18,
    scale: 'lg',
  });
}

/** Create a compact theme config */
export function createCompactThemeConfig(): ThemeConfig {
  return createFakeThemeConfig({
    scale: 'compact',
    fontSize: 14,
    radius: 'sm',
    contentLayout: 'full',
    sidebarMode: 'icon',
  });
}

/** Create a spacious theme config */
export function createSpaciousThemeConfig(): ThemeConfig {
  return createFakeThemeConfig({
    scale: 'spacious',
    fontSize: 18,
    radius: 'lg',
    contentLayout: 'wide',
    sidebarMode: 'default',
  });
}

/** Create configs for all presets */
export function createFakeThemeConfigsWithAllPresets(): ThemeConfig[] {
  return THEME_PRESET_IDS.map((preset) => createFakeThemeConfig({ preset }));
}

/** Create configs for all color modes */
export function createFakeThemeConfigsWithAllColorModes(): ThemeConfig[] {
  return COLOR_MODES.map((colorMode) => createFakeThemeConfig({ colorMode }));
}

/** Create configs for all radii */
export function createFakeThemeConfigsWithAllRadii(): ThemeConfig[] {
  return THEME_RADII.map((radius) => createFakeThemeConfig({ radius }));
}

/** Create configs for all scales */
export function createFakeThemeConfigsWithAllScales(): ThemeConfig[] {
  return THEME_SCALES.map((scale) => createFakeThemeConfig({ scale }));
}

/** Create configs for all accent colors */
export function createFakeThemeConfigsWithAllAccents(): ThemeConfig[] {
  return ACCENT_COLORS.map((accentColor) => createFakeThemeConfig({ accentColor }));
}

// ═══════════════════════════════════════════════════════════════
// PRESET INFO FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeThemePresetInfo(overrides?: Partial<ThemePresetInfo>): ThemePresetInfo {
  const preset = overrides?.id ?? faker.helpers.arrayElement(THEME_PRESET_IDS);
  const existingPreset = THEME_PRESETS.find((p) => p.id === preset);

  if (existingPreset) {
    return { ...existingPreset, ...overrides };
  }

  return {
    id: preset,
    name: faker.commerce.productName(),
    description: faker.lorem.sentence(),
    isDark: faker.datatype.boolean(),
    colors: {
      primary: faker.color.rgb({ format: 'hex' }),
      secondary: faker.color.rgb({ format: 'hex' }),
      accent: faker.color.rgb({ format: 'hex' }),
      background: faker.color.rgb({ format: 'hex' }),
      foreground: faker.color.rgb({ format: 'hex' }),
      muted: faker.color.rgb({ format: 'hex' }),
    },
    thumbnail: faker.helpers.maybe(() => faker.image.urlPicsumPhotos({ width: 200, height: 150 }), {
      probability: 0.5,
    }),
    ...overrides,
  };
}

export function createFakeThemePresets(count: number = 6): ThemePresetInfo[] {
  return THEME_PRESETS.slice(0, Math.min(count, THEME_PRESETS.length));
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMIZATION FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeThemeCustomization(
  overrides?: Partial<ThemeCustomization>
): ThemeCustomization {
  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement([
      i18n.t('factory.theme.myCustomTheme', 'My Custom Theme'),
      i18n.t('factory.theme.workTheme', 'Work Theme'),
      i18n.t('factory.theme.nightMode', 'Night Mode'),
      i18n.t('factory.theme.personal', 'Personal'),
    ]),
    borderRadius: faker.number.int({ min: 0, max: 24 }),
    spacing: faker.number.float({ min: 0.5, max: 2, fractionDigits: 1 }),
    fontScale: faker.number.float({ min: 0.8, max: 1.5, fractionDigits: 2 }),
    lineHeight: faker.number.float({ min: 1.2, max: 2, fractionDigits: 1 }),
    customCSS: faker.helpers.maybe(
      () => i18n.t('factory.theme.rootCustomvarFf0000', ':root { --custom-var: #ff0000; }'),
      { probability: 0.2 }
    ),
    ...overrides,
  };
}

export function createFakeThemeCustomizations(count: number): ThemeCustomization[] {
  return Array.from({ length: count }, () => createFakeThemeCustomization());
}

// ═══════════════════════════════════════════════════════════════
// EXPORT FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeThemeExport(overrides?: Partial<ThemeExport>): ThemeExport {
  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement([
      i18n.t('factory.theme.myTheme', 'My Theme'),
      i18n.t('factory.theme.customDark', 'Custom Dark'),
      i18n.t('factory.theme.workSetup', 'Work Setup'),
      i18n.t('factory.theme.minimal', 'Minimal'),
    ]),
    config: createFakeThemeConfig(),
    exportFormat: faker.helpers.arrayElement(['json', 'css', 'tailwind']),
    version: faker.system.semver(),
    createdAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export function createFakeThemeExports(count: number): ThemeExport[] {
  return Array.from({ length: count }, () => createFakeThemeExport());
}

// ═══════════════════════════════════════════════════════════════
// HISTORY FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeThemeHistory(overrides?: Partial<ThemeHistory>): ThemeHistory {
  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    action: faker.helpers.arrayElement(['created', 'modified', 'applied', 'reset', 'deleted']),
    configSnapshot: createFakeThemeConfig(),
    timestamp: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export function createFakeThemeHistories(count: number): ThemeHistory[] {
  return Array.from({ length: count }, () => createFakeThemeHistory());
}

// ═══════════════════════════════════════════════════════════════
// PREFERENCE FACTORIES
// ═══════════════════════════════════════════════════════════════

export function createFakeThemePreference(overrides?: Partial<ThemePreference>): ThemePreference {
  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    followSystemTheme: faker.datatype.boolean({ probability: 0.6 }),
    autoSwitch: faker.datatype.boolean({ probability: 0.4 }),
    preferredLightPreset: faker.helpers.arrayElement(['default', 'blossom', 'forest', 'ocean']),
    preferredDarkPreset: faker.helpers.arrayElement(['midnight', 'underground']),
    darkScheduleStart: faker.helpers.arrayElement(['18:00', '19:00', '20:00', '21:00']),
    darkScheduleEnd: faker.helpers.arrayElement(['06:00', '07:00', '08:00']),
    ...overrides,
  };
}

export function createFakeThemePreferences(count: number): ThemePreference[] {
  return Array.from({ length: count }, () => createFakeThemePreference());
}

// ═══════════════════════════════════════════════════════════════
// MATRIX FACTORIES (For Visual Regression)
// ═══════════════════════════════════════════════════════════════

/** Create preset × colorMode matrix for visual testing */
export function createFakeThemePresetColorModeMatrix(): ThemeConfig[][] {
  return THEME_PRESET_IDS.map((preset) =>
    COLOR_MODES.map((colorMode) => createFakeThemeConfig({ preset, colorMode }))
  );
}

/** Create preset × radius matrix for visual testing */
export function createFakeThemePresetRadiusMatrix(): ThemeConfig[][] {
  return THEME_PRESET_IDS.map((preset) =>
    THEME_RADII.map((radius) => createFakeThemeConfig({ preset, radius }))
  );
}

/** Create colorMode × scale matrix for visual testing */
export function createFakeThemeColorModeScaleMatrix(): ThemeConfig[][] {
  return COLOR_MODES.map((colorMode) =>
    THEME_SCALES.map((scale) => createFakeThemeConfig({ colorMode, scale }))
  );
}

/** Create accentColor × colorMode matrix for visual testing */
export function createFakeThemeAccentColorModeMatrix(): ThemeConfig[][] {
  return ACCENT_COLORS.map((accentColor) =>
    COLOR_MODES.map((colorMode) => createFakeThemeConfig({ accentColor, colorMode }))
  );
}

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE FEATURE FACTORIES
// ═══════════════════════════════════════════════════════════════

/** Create a fully featured enterprise theme config */
export function createFakeEnterpriseThemeConfig(): ThemeConfig {
  return createFakeThemeConfig({
    preset: 'default',
    colorMode: 'system',
    syncWithSystem: true,
    animations: true,
    reducedMotion: false,
    highContrast: false,
    accentColor: 'blue',
    fontFamily: 'system',
    fontSize: 16,
    scale: 'default',
    radius: 'md',
    contentLayout: 'full',
    sidebarMode: 'default',
  });
}

/** Create all enterprise theme combinations for testing */
export function createFakeEnterpriseThemeSet(): ThemeConfig[] {
  return [
    createDefaultThemeConfig(),
    createDarkThemeConfig(),
    createLightThemeConfig(),
    createAccessibleThemeConfig(),
    createCompactThemeConfig(),
    createSpaciousThemeConfig(),
  ];
}

/** Create a theme showcase with all key variants */
export function createFakeThemeShowcase(): {
  accessible: ThemeConfig;
  colorModes: ThemeConfig[];
  compact: ThemeConfig;
  dark: ThemeConfig;
  default: ThemeConfig;
  light: ThemeConfig;
  presets: ThemePresetInfo[];
  spacious: ThemeConfig;
} {
  return {
    default: createDefaultThemeConfig(),
    dark: createDarkThemeConfig(),
    light: createLightThemeConfig(),
    accessible: createAccessibleThemeConfig(),
    compact: createCompactThemeConfig(),
    spacious: createSpaciousThemeConfig(),
    presets: createFakeThemePresets(),
    colorModes: createFakeThemeConfigsWithAllColorModes(),
  };
}
