import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ActiveThemeProvider } from '@/components/active-theme';
import { CinemaSection } from '@/components/wakaclock/cinema-section';
import { RouteTransition } from '@/components/wakaclock/route-transition';
import { TimeCoreDial } from '@/components/wakaclock/time-core/time-core-dial';
import { DEFAULT_THEME } from '@/lib/themes';
import { buildTimeCore } from '@/lib/wakaclock/time-core';

describe('CinemaSection', () => {
  it('labels the section with its numbered headline, aside and actions', () => {
    render(
      <CinemaSection
        actions={<button type="button">Range</button>}
        aside="the aside"
        id="s1"
        number="02"
        title="The range"
      >
        <p>content</p>
      </CinemaSection>
    );
    expect(screen.getByRole('region', { name: 'The range' })).toHaveTextContent('02');
    expect(screen.getByText('the aside')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Range' })).toBeInTheDocument();
  });

  it('renders without aside or actions', () => {
    render(
      <CinemaSection id="s2" number="03" title="Bare">
        <p>content</p>
      </CinemaSection>
    );
    expect(screen.getByRole('heading', { name: 'Bare' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('RouteTransition', () => {
  it('wraps the page for Cinema and for the other presets', () => {
    const { unmount } = render(<RouteTransition>cinema page</RouteTransition>);
    expect(screen.getByText('cinema page')).toHaveAttribute('data-slot', 'route-transition');
    unmount();
    render(
      <ActiveThemeProvider initialTheme={{ ...DEFAULT_THEME, preset: 'retro-pixel' }}>
        <RouteTransition>classic page</RouteTransition>
      </ActiveThemeProvider>
    );
    expect(screen.getByText('classic page')).toHaveAttribute('data-slot', 'route-transition');
  });
});

describe('TimeCoreDial', () => {
  const start = 1_793_984_400;
  const model = buildTimeCore({
    data: [
      {
        category: 'coding',
        duration_seconds: 14 * 3600,
        end: start + 14 * 3600,
        entity: 'a',
        heartbeat_count: 1,
        language: null,
        project: 'long',
        start,
      },
      {
        category: 'coding',
        duration_seconds: 600,
        end: start + 15 * 3600 + 600,
        entity: 'b',
        heartbeat_count: 1,
        language: null,
        project: 'short',
        start: start + 15 * 3600,
      },
    ],
    date: '2026-11-06',
    range_end: start + 86_400,
    range_start: start,
    total: 0,
  });

  it('draws rings, dims the unfocused ones and uses the long arc flag past 12 hours', () => {
    const { container } = render(<TimeCoreDial focusedRing={0} model={model} />);
    const rings = container.querySelectorAll('g');
    expect(rings).toHaveLength(2);
    expect(rings[0]).toHaveAttribute('opacity', '1');
    expect(rings[1]).toHaveAttribute('opacity', '0.25');
    expect(container.querySelector('path')?.getAttribute('d')).toMatch(/ 0 1 1 /);
    expect(screen.getByTestId('time-core-dial')).toHaveTextContent('00061218');
  });

  it('draws only the clock face before data arrives', () => {
    const { container } = render(<TimeCoreDial focusedRing={null} model={null} />);
    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(container.querySelectorAll('line')).toHaveLength(24);
  });
});
