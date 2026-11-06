import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { breadcrumbFor, ToolbarBreadcrumb } from '@/components/layout/header/toolbar-breadcrumb';

const nav = vi.hoisted(() => ({ pathname: '/dashboard/wakaclock/analytics/projects/abc' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

describe('ToolbarBreadcrumb', () => {
  it('links the section and marks the current view', () => {
    nav.pathname = '/dashboard/wakaclock/analytics/projects/abc';
    render(<ToolbarBreadcrumb />);
    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute(
      'href',
      '/dashboard/wakaclock/analytics/timeline'
    );
    expect(screen.getByText('Projects')).toHaveAttribute('aria-current', 'page');
  });

  it('renders nothing outside the navigation', () => {
    nav.pathname = '/pricing';
    const { container } = render(<ToolbarBreadcrumb />);
    expect(container).toBeEmptyDOMElement();
    expect(breadcrumbFor('/pricing')).toEqual([]);
  });
});
