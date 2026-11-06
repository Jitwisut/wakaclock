import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DashboardShell } from '@/components/layout/dashboard-shell';

vi.mock('@/components/layout/header', () => ({
  SiteHeader: () => <header data-testid="site-header" />,
}));
vi.mock('@/components/layout/sidebar/app-sidebar', () => ({
  AppSidebar: () => <nav data-testid="app-sidebar" />,
}));
vi.mock('@/components/layout/cinema/cinema-shell', () => ({
  CinemaShell: () => <div data-testid="cinema-rail" />,
}));

describe('DashboardShell (classic presets)', () => {
  it('keeps the inset sidebar and site header', () => {
    render(
      <DashboardShell defaultOpen>
        <p>page body</p>
      </DashboardShell>
    );
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('site-header')).toBeInTheDocument();
    expect(screen.getByText('page body')).toBeInTheDocument();
    expect(screen.queryByTestId('cinema-rail')).not.toBeInTheDocument();
  });
});
