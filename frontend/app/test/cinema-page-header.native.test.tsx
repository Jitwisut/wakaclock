import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CinemaSceneProvider } from '@/components/layout/cinema/cinema-scene-context';
import { WakaclockPageHeader } from '@/components/wakaclock/page-header';

const analytics = {
  item: { href: '/dashboard/wakaclock/analytics/timeline', title: 'Analytics' },
  number: '02',
};

describe('Cinema page opener', () => {
  it('prints the rail scene number and section above the headline', () => {
    render(
      <CinemaSceneProvider value={analytics}>
        <WakaclockPageHeader
          actions={<button type="button">7d</button>}
          description="Canonical time."
          title="Activity Timeline"
        >
          <nav aria-label="Views" />
        </WakaclockPageHeader>
      </CinemaSceneProvider>
    );
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('· Analytics')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Activity Timeline' })
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Views' })).toBeInTheDocument();
  });

  it('omits the section when it is the page itself, and the label outside the shell', () => {
    const { rerender } = render(
      <CinemaSceneProvider value={{ ...analytics, item: { ...analytics.item, title: 'Insights' } }}>
        <WakaclockPageHeader title="Insights" />
      </CinemaSceneProvider>
    );
    expect(screen.queryByText(/· /)).not.toBeInTheDocument();
    rerender(<WakaclockPageHeader title="Insights" />);
    expect(screen.queryByText('02')).not.toBeInTheDocument();
  });
});
