export const DEFAULT_THEME = {
  preset: 'retro-pixel',
  radius: 'default',
  scale: 'none',
  contentLayout: 'full',
} as const;

export type ThemePreset = string;
export type ThemeRadius = 'default' | 'lg' | 'md' | 'none' | 'sm' | 'xl';
export type ThemeScale = 'lg' | 'none' | 'sm';
export type ThemeContentLayout = 'centered' | 'full';

export type ThemeType = {
  contentLayout: ThemeContentLayout;
  preset: ThemePreset;
  radius: ThemeRadius;
  scale: ThemeScale;
};

/**
 * Every entry here must have a matching `[data-theme-preset='<value>']` block in
 * `app/themes.css` — the selector is what actually swaps the tokens. `default` is the
 * exception: it deliberately has no block and falls through to the `:root` scale.
 *
 * `colors` are preview swatches shown in the picker, not tokens; they are the 700 and 600
 * stops of each preset's primary and secondary ramps.
 */
export const THEMES = [
  {
    name: 'Retro Pixel 3D',
    value: 'retro-pixel',
    colors: ['oklch(0.5583 0.2075 27.32)'],
  },
  {
    name: 'Default',
    value: 'default',
    colors: ['oklch(0.33 0 0)'],
  },
  {
    name: 'Underground',
    value: 'underground',
    colors: ['oklch(0.5315 0.0694 156.19)'],
  },
  {
    name: 'Rose Garden',
    value: 'rose-garden',
    colors: ['oklch(0.5827 0.2418 12.23)'],
  },
  {
    name: 'Lake View',
    value: 'lake-view',
    colors: ['oklch(0.765 0.177 163.22)'],
  },
  {
    name: 'Sunset Glow',
    value: 'sunset-glow',
    colors: ['oklch(0.5827 0.2187 36.98)'],
  },
  {
    name: 'Forest Whisper',
    value: 'forest-whisper',
    colors: ['oklch(0.5276 0.1072 182.22)'],
  },
  {
    name: 'Ocean Breeze',
    value: 'ocean-breeze',
    colors: ['oklch(0.59 0.20 277.12)'],
  },
  {
    name: 'Lavender Dream',
    value: 'lavender-dream',
    colors: ['oklch(0.71 0.16 293.54)'],
  },
  {
    name: 'Nord',
    value: 'nord',
    colors: ['oklch(0.5315 0.063 232)', 'oklch(0.5748 0.074 152)'],
  },
  {
    name: 'Dracula',
    value: 'dracula',
    colors: ['oklch(0.5315 0.098 295)', 'oklch(0.5748 0.113 330)'],
  },
  {
    name: 'Solarized',
    value: 'solarized',
    colors: ['oklch(0.5315 0.0805 245)', 'oklch(0.5748 0.0783 196)'],
  },
  {
    name: 'Gruvbox',
    value: 'gruvbox',
    colors: ['oklch(0.5315 0.091 55)', 'oklch(0.5748 0.087 130)'],
  },
  {
    name: 'Tokyo Night',
    value: 'tokyo-night',
    colors: ['oklch(0.5315 0.091 258)', 'oklch(0.5748 0.104 315)'],
  },
  {
    name: 'Paper Mono',
    value: 'paper-mono',
    colors: ['oklch(0.4416 0 0)', 'oklch(0.5748 0.1305 25)'],
  },
];
