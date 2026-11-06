import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ActiveThemeProvider } from '@/components/active-theme';
import { LayoutSwitch } from '@/components/wakaclock/layout-switch';
import { DEFAULT_THEME } from '@/lib/themes';

const both = <LayoutSwitch classic={<p>classic layout</p>} native={<p>native layout</p>} />;

describe('LayoutSwitch', () => {
  it('uses the rebuilt layout for Motion Native, the default preset', () => {
    render(both);
    expect(screen.getByText('native layout')).toBeInTheDocument();
    expect(screen.queryByText('classic layout')).not.toBeInTheDocument();
  });

  it('keeps the original layout for every other preset', () => {
    render(
      <ActiveThemeProvider initialTheme={{ ...DEFAULT_THEME, preset: 'retro-pixel' }}>
        {both}
      </ActiveThemeProvider>
    );
    expect(screen.getByText('classic layout')).toBeInTheDocument();
    expect(screen.queryByText('native layout')).not.toBeInTheDocument();
  });
});
