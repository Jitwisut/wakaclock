/**
 * The `--mkt-*` custom properties as plain strings.
 *
 * Marketing components style through inline `style` props rather than Tailwind colour
 * utilities, because the palette lives in `app/(marketing)/marketing.css` and is scoped
 * to `.wakaclock-marketing` instead of the Tailwind theme. Naming the repeated ones here
 * keeps a token rename to a single edit.
 */
export const MKT_ACCENT = 'var(--mkt-accent)';
export const MKT_ACCENT_FG = 'var(--mkt-accent-fg)';
export const MKT_BORDER = 'var(--mkt-border)';
export const MKT_BG_ELEVATED = 'var(--mkt-bg-elevated)';
export const MKT_FG = 'var(--mkt-fg)';
export const MKT_FG_MUTED = 'var(--mkt-fg-muted)';

/** Pixel display face, with the body mono as the fallback Thai and non-Latin copy uses. */
export const MKT_DISPLAY_FONT = 'var(--font-mkt-display), var(--font-mkt-body), monospace';
export const MKT_MONO_FONT = 'var(--font-mkt-body), ui-monospace, monospace';
