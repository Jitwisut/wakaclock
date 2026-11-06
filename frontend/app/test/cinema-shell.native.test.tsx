import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardShell } from '@/components/layout/dashboard-shell';

import type { NavGroup } from '@/components/layout/sidebar/nav-items';

const nav = vi.hoisted(() => ({ pathname: '/dashboard/wakaclock/analytics/projects', query: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.query),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const groups = vi.hoisted((): NavGroup[] => [
  {
    title: 'AtoAxis',
    items: [
      { title: 'Overview', href: '/dashboard/wakaclock' },
      {
        title: 'Analytics',
        href: '/dashboard/wakaclock/analytics/timeline',
        isNew: true,
        items: [
          { title: 'Activity Timeline', href: '/dashboard/wakaclock/analytics/timeline' },
          { title: 'Projects', href: '/dashboard/wakaclock/analytics/projects' },
        ],
      },
      { title: 'Settings', href: '/dashboard/wakaclock/settings' },
    ],
  },
]);
vi.mock('@/hooks/use-visible-nav-items', () => ({ useVisibleNavItems: () => groups }));

// Header controls have their own suites; here they are inert placeholders.
const stub = vi.hoisted(() => (name: string) => () => (
  // eslint-disable-next-line react/display-name -- inert test placeholder
  <span data-testid={`stub-${name}`} />
));
vi.mock('@/components/layout/header/search', () => ({ Search: stub('search') }));
vi.mock('@/components/layout/header/notifications', () => ({
  Notifications: stub('notifications'),
}));
vi.mock('@/components/layout/header/theme-switch', () => ({ ThemeSwitch: stub('theme') }));
vi.mock('@/components/layout/header/user-menu', () => ({ UserMenu: stub('user-menu') }));
vi.mock('@/components/theme-customizer', () => ({ ThemeCustomizerPanel: stub('customizer') }));
vi.mock('@/components/wakaclock/subscription-badge', () => ({
  SubscriptionBadge: stub('subscription'),
}));
vi.mock('@/components/wakaclock/sync-status-indicator', () => ({
  SyncStatusIndicator: stub('sync'),
}));
vi.mock('@/components/wakaclock/user-switcher', () => ({ UserSwitcher: stub('switcher') }));
vi.mock('@/components/layout/sidebar/sidebar-level-badge', () => ({
  SidebarLevelBadge: stub('level'),
}));
vi.mock('@/components/layout/header', () => ({ SiteHeader: stub('site-header') }));
vi.mock('@/components/layout/sidebar/app-sidebar', () => ({ AppSidebar: stub('app-sidebar') }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (state: { logout: () => void }) => unknown) =>
    selector({ logout: vi.fn() }),
}));

beforeEach(() => {
  nav.pathname = '/dashboard/wakaclock/analytics/projects';
  nav.query = '';
});

describe('Cinema shell', () => {
  it('numbers the scenes, marks the current one and lists its views', () => {
    render(
      <DashboardShell defaultOpen>
        <p>page body</p>
      </DashboardShell>
    );

    expect(screen.getByRole('main')).toHaveTextContent('page body');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#cinema-main'
    );
    const rail = screen.getByTestId('cinema-rail');
    const primary = within(rail).getByRole('navigation', { name: 'Primary' });
    const analytics = within(primary).getByRole('link', { name: /Analytics/ });
    expect(analytics).toHaveAttribute('data-active', 'true');
    expect(analytics).not.toHaveAttribute('aria-current');
    expect(analytics).toHaveTextContent('02');
    expect(analytics).toHaveTextContent('New');
    expect(within(primary).getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    const slate = screen.getByTestId('cinema-slate');
    const crumbs = within(slate).getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Analytics' })).toBeInTheDocument();
    expect(within(crumbs).getByText('Projects')).toHaveAttribute('aria-current', 'page');
  });

  it('keeps analytics filters when moving between analytics views', () => {
    nav.query = 'start=2026-11-01&end=2026-11-06';
    render(
      <DashboardShell defaultOpen>
        <p>body</p>
      </DashboardShell>
    );
    expect(screen.getByRole('link', { name: 'Activity Timeline' })).toHaveAttribute(
      'href',
      '/dashboard/wakaclock/analytics/timeline?start=2026-11-01&end=2026-11-06'
    );
  });

  it('collapses the rail to icons with tooltips', () => {
    nav.pathname = '/dashboard/wakaclock/settings';
    render(
      <DashboardShell defaultOpen={false}>
        <p>body</p>
      </DashboardShell>
    );
    const toggle = screen.getByTestId('cinema-rail-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName('Expand navigation');
    expect(screen.getByRole('link', { name: /Settings/ })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Collapse navigation');
  });

  it('opens the full-screen index on small screens and closes it on navigation', () => {
    const { rerender } = render(
      <DashboardShell defaultOpen>
        <p>body</p>
      </DashboardShell>
    );
    fireEvent.click(screen.getByTestId('cinema-index-open'));
    const index = screen.getByTestId('cinema-index');
    expect(within(index).getByText('Index')).toBeInTheDocument();
    expect(within(index).getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    fireEvent.click(within(index).getByRole('link', { name: 'Activity Timeline' }));
    expect(screen.queryByTestId('cinema-index')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cinema-index-open'));
    fireEvent.click(
      within(screen.getByTestId('cinema-index')).getByRole('link', { name: 'Settings' })
    );
    expect(screen.queryByTestId('cinema-index')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cinema-index-open'));
    nav.pathname = '/dashboard/wakaclock/settings';
    act(() => {
      rerender(
        <DashboardShell defaultOpen>
          <p>body</p>
        </DashboardShell>
      );
    });
    expect(screen.queryByTestId('cinema-index')).not.toBeInTheDocument();
  });

  it('shows no scene number or trail outside the navigation', () => {
    nav.pathname = '/elsewhere';
    render(
      <DashboardShell defaultOpen>
        <p>body</p>
      </DashboardShell>
    );
    const slate = screen.getByTestId('cinema-slate');
    expect(within(slate).queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });
});
