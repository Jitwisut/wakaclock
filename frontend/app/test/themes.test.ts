import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_THEME, THEMES } from '@/lib/themes';

const themesCss = readFileSync(join(process.cwd(), 'app/themes.css'), 'utf8');

/**
 * The picker and the stylesheet are two separate lists that have to agree: an entry with
 * no `[data-theme-preset='…']` block is selectable and simply does nothing, which is
 * indistinguishable from a broken theme switcher.
 */
describe('theme presets', () => {
  it('has a stylesheet block for every selectable preset', () => {
    const missing = THEMES.filter(
      (theme) =>
        theme.value !== 'default' && !themesCss.includes(`[data-theme-preset='${theme.value}']`)
    ).map((theme) => theme.value);

    expect(missing).toEqual([]);
  });

  it('keeps "default" free of a block so it falls through to the root scale', () => {
    expect(THEMES.some((theme) => theme.value === 'default')).toBe(true);
    expect(themesCss).not.toContain("[data-theme-preset='default']");
  });

  it('ships the default preset as a real, selectable option', () => {
    expect(THEMES.map((theme) => theme.value)).toContain(DEFAULT_THEME.preset);
  });

  it('gives every preset a unique value and at least one preview swatch', () => {
    const values = THEMES.map((theme) => theme.value);

    expect(new Set(values).size).toBe(values.length);
    expect(THEMES.every((theme) => theme.colors.length > 0)).toBe(true);
    expect(THEMES.every((theme) => theme.name.trim().length > 0)).toBe(true);
  });

  it('defines both light and dark values for every preset block', () => {
    const blocks = themesCss.match(/\[data-theme-preset='[^']+'\][^{]*\{/g) ?? [];

    expect(blocks.length).toBeGreaterThanOrEqual(THEMES.length - 1);

    for (const theme of THEMES) {
      if (theme.value === 'default') continue;

      const start = themesCss.indexOf(`[data-theme-preset='${theme.value}']`);
      const body = themesCss.slice(start, start + 6000);

      expect(body, `${theme.value} has no dark variant`).toContain('@variant dark');
    }
  });
});
