import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Home } from 'lucide-react';
import { NavMain, type NavGroup } from '@/components/layout/sidebar/nav-main';
import { SidebarProvider } from '@/components/ui/sidebar';
const state = vi.hoisted(() => ({
  pathname: '/dashboard/wakaclock/analytics/timeline',
  mobile: false,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams('source=ai'),
}));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => state.mobile }));
vi.mock('@/hooks/use-visible-nav-items', () => ({
  useVisibleNavItems: (items: NavGroup[]) => items,
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));
const groups: NavGroup[] = [
  {
    title: 'Work',
    items: [
      {
        title: 'Analytics',
        href: '/dashboard/wakaclock/analytics',
        icon: Home,
        isNew: true,
        isComing: true,
        isDataBadge: '5',
        items: [
          { title: 'Timeline', href: '/dashboard/wakaclock/analytics/timeline' },
          { title: 'Heatmap', href: '/dashboard/wakaclock/analytics/heatmap', newTab: true },
        ],
      },
      { title: 'Settings', href: '/settings', newTab: true, icon: Home },
      { title: 'Home', href: '/' },
    ],
  },
];
beforeEach(() => {
  state.pathname = '/dashboard/wakaclock/analytics/timeline';
  state.mobile = false;
});
it('marks the active destination, preserves filters for subpages and renders configured badges', () => {
  const view = render(
    <SidebarProvider>
      <NavMain
        items={groups}
        labels={{ comingBadge: 'Soon', newBadge: 'Fresh', loading: 'Please wait' }}
      />
    </SidebarProvider>
  );
  const timeline = screen.getByRole('link', { name: 'Timeline' });
  expect(timeline).toHaveAttribute('aria-current', 'page');
  expect(timeline).toHaveAttribute('href', '/dashboard/wakaclock/analytics/timeline?source=ai');
  expect(screen.getByRole('link', { name: 'Heatmap' })).toHaveAttribute('target', '_blank');
  expect(screen.getByText('Soon')).toBeVisible();
  expect(screen.getByText('Fresh')).toBeVisible();
  expect(screen.getByText('5')).toBeVisible();
  state.pathname = '/settings';
  view.rerender(
    <SidebarProvider>
      <NavMain items={groups} />
    </SidebarProvider>
  );
  expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Timeline' })).not.toHaveAttribute('aria-current');
  expect(screen.getByText('Coming')).toBeVisible();
  expect(screen.getByText('New')).toBeVisible();
});
it.each([false, true])(
  'opens nested destinations from the collapsed menu (mobile=%s)',
  async (mobile) => {
    state.mobile = mobile;
    state.pathname = '/elsewhere';
    const items = [{ ...groups[0], items: [{ ...groups[0].items[0], icon: undefined }] }];
    render(
      <SidebarProvider defaultOpen={false}>
        <NavMain items={items} />
      </SidebarProvider>
    );
    fireEvent.pointerDown(screen.getAllByRole('button', { name: 'Analytics' })[0], {
      button: 0,
      ctrlKey: false,
    });
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Timeline' })).toHaveAttribute(
      'href',
      '/dashboard/wakaclock/analytics/timeline'
    );
  }
);
it('uses default navigation and opens the matching parent for a nested project path', () => {
  state.pathname = '/dashboard/wakaclock/analytics/projects/project-id';
  render(
    <SidebarProvider>
      <NavMain />
    </SidebarProvider>
  );
  const project = screen.getByRole('link', { name: 'Projects' });
  expect(project).toHaveAttribute('aria-current', 'page');
  expect(project.getAttribute('href')).toContain('project_id=project-id');
});
