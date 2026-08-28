import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TopProjects } from '@/app/dashboard/(auth)/wakaclock/components/top-projects';
import { WakaclockError } from '@/lib/wakaclock/client';

import type { ProjectAnalyticsCard } from '@/lib/wakaclock/types';

/**
 * Renders the panel in isolation rather than the overview page. Under vitest 4 coverage
 * counts only files a test imports, so mounting `wakaclock/page.tsx` would drag all seven
 * panels into the report and put each one under the 100% threshold.
 */

const api = vi.hoisted(() => ({ getProjectAnalytics: vi.fn() }));

vi.mock('@/lib/wakaclock/endpoints', () => ({
  getProjectAnalytics: api.getProjectAnalytics,
}));

vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (state: { userId: null | string }) => unknown) =>
    selector({ userId: mockUserId }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// `useWakaclockRange` reads all three of these; without them the hook throws on render.
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/wakaclock',
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

let mockUserId: null | string = 'user-1';

function card(overrides: Partial<ProjectAnalyticsCard> = {}): ProjectAnalyticsCard {
  return {
    ai: { changes: 10, lines_added: 8, lines_deleted: 2, percentage: 40 },
    attribution_coverage_percent: 90,
    estimated_spend: { amount_microusd: 0, coverage_percent: 100, currency: 'USD' },
    human: { changes: 15, lines_added: 12, lines_deleted: 3, percentage: 60 },
    last_activity_at: '2026-08-24T10:00:00Z',
    name: 'wakaclock',
    project_id: '11111111-1111-4111-8111-111111111111',
    prompts: 3,
    repository: 'pattanun-np/wakaclock',
    sessions: 1,
    tokens: {
      cache_read: 0,
      cache_write: 0,
      coverage_percent: 100,
      input: 100,
      output: 50,
      total: 150,
    },
    total_seconds: 7200,
    unattributed: { changes: 0, lines_added: 0, lines_deleted: 0, percentage_of_observed: 0 },
    ...overrides,
  } as ProjectAnalyticsCard;
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TopProjects />
    </QueryClientProvider>
  );
}

describe('TopProjects', () => {
  beforeEach(() => {
    mockUserId = 'user-1';
    api.getProjectAnalytics.mockReset();
  });

  it('links each project name to its detail page, with the duration outside the anchor', async () => {
    api.getProjectAnalytics.mockResolvedValue({
      items: [
        card(),
        card({
          name: 'atoaxis-vscode',
          project_id: '22222222-2222-4222-8222-222222222222',
          total_seconds: 3600,
        }),
      ],
      next_cursor: null,
    });

    renderPanel();

    const link = await screen.findByRole('link', { name: 'wakaclock' });
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('/dashboard/wakaclock/analytics/projects/11111111-1111-4111-8111-111111111111?')
    );
    expect(await screen.findByRole('link', { name: 'atoaxis-vscode' })).toHaveAttribute(
      'href',
      expect.stringContaining(
        '/dashboard/wakaclock/analytics/projects/22222222-2222-4222-8222-222222222222?'
      )
    );

    // The requirement is that the NAME is the link. If the duration ever slips inside the
    // anchor, the accessible name becomes "wakaclock 2h" and this fails.
    expect(within(link).queryByText(/2h/)).toBeNull();
    expect(screen.getByRole('link', { name: 'View all projects' })).toHaveAttribute(
      'href',
      expect.stringContaining('/dashboard/wakaclock/analytics/projects?')
    );
  });

  it('requests the top projects by duration for the default 30-day window', async () => {
    api.getProjectAnalytics.mockResolvedValue({ items: [card()], next_cursor: null });

    renderPanel();

    await waitFor(() => expect(api.getProjectAnalytics).toHaveBeenCalledTimes(1));
    expect(api.getProjectAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 8, order: 'desc', sort: 'duration' })
    );
  });

  it('shows a skeleton while loading', () => {
    api.getProjectAnalytics.mockReturnValue(new Promise(() => {}));

    const { container } = renderPanel();

    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it('surfaces the error message from a failed request', async () => {
    api.getProjectAnalytics.mockRejectedValue(new WakaclockError('Backend unreachable', 500));

    renderPanel();

    expect(await screen.findByText('Backend unreachable')).toBeInTheDocument();
  });

  it('renders an empty state when the range has no projects', async () => {
    api.getProjectAnalytics.mockResolvedValue({ items: [], next_cursor: null });

    renderPanel();

    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('does not fetch before a session has hydrated', () => {
    mockUserId = null;

    renderPanel();

    expect(api.getProjectAnalytics).not.toHaveBeenCalled();
  });
});
