import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GoalsPage from '@/app/dashboard/(auth)/wakaclock/goals/page';
import LeaderboardsPage from '@/app/dashboard/(auth)/wakaclock/leaderboards/page';

import type { Goal, Leaderboard } from '@/lib/wakaclock/types';

/**
 * These mount the real pages rather than a panel in isolation. Both compile and both
 * pass a typecheck without ever having been rendered, and a page that throws on first
 * paint fails in exactly that gap — a bad date, a missing provider, a hook called
 * conditionally. Rendering them is the only thing that proves they work at all.
 */

const v2 = vi.hoisted(() => ({
  getCapabilities: vi.fn(),
  getGoalProgress: vi.fn(),
  listGoals: vi.fn(),
  listLeaderboardMembers: vi.fn(),
  listLeaderboards: vi.fn(),
}));

vi.mock('@/lib/wakaclock/endpoints-v2', () => ({
  addLeaderboardMember: vi.fn(),
  createGoal: vi.fn(),
  createLeaderboard: vi.fn(),
  deleteGoal: vi.fn(),
  getCapabilities: v2.getCapabilities,
  getGoalProgress: v2.getGoalProgress,
  listGoalProgress: vi.fn(),
  listGoals: v2.listGoals,
  listLeaderboardMembers: v2.listLeaderboardMembers,
  listLeaderboards: v2.listLeaderboards,
  removeLeaderboardMember: vi.fn(),
}));

vi.mock('@/lib/wakaclock/endpoints', () => ({
  getProjects: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('@/components/wakaclock/require-user', () => ({
  RequireUser: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (state: { userId: string }) => unknown) =>
    selector({ userId: 'user-1' }),
}));

const goal: Goal = {
  created_at: '2026-08-01T00:00:00Z',
  direction: 'minimum',
  ends_on: null,
  filter_kind: 'all',
  filter_value: null,
  id: 'goal-1',
  metric: 'time',
  name: 'Two focused hours',
  period: 'daily',
  priority: 0,
  public: false,
  starts_on: '2026-08-01',
  target_seconds: 7200,
  timezone: 'UTC',
  updated_at: '2026-08-01T00:00:00Z',
};

const board: Leaderboard = {
  anonymous: false,
  country: null,
  created_at: '2026-08-01T00:00:00Z',
  id: 'board-1',
  language: null,
  metric: 'time',
  organization_id: null,
  owner_user_id: 'user-1',
  period: 'weekly',
  visibility: 'private',
};

function renderPage(page: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  v2.getCapabilities.mockResolvedValue({
    features: [
      {
        api: '/leaderboards',
        available: true,
        key: 'private_leaderboards',
        status: 'beta',
      },
    ],
    postgres_enabled: true,
  });
});

describe('Goals page', () => {
  it('renders a goal with its measured progress', async () => {
    v2.listGoals.mockResolvedValue([goal]);
    v2.getGoalProgress.mockResolvedValue({
      coverage: 1,
      current_seconds: 3600,
      direction: 'minimum',
      goal_id: 'goal-1',
      on_track: false,
      percentage: 50,
      period: 'daily',
      target_seconds: 7200,
    });

    renderPage(<GoalsPage />);

    expect(await screen.findByText('Two focused hours')).toBeInTheDocument();
    expect(await screen.findByText('1h 0m of 2h 0m')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /Two focused hours progress/ })).toHaveAttribute(
      'aria-valuenow',
      '50'
    );
  });

  /**
   * The distinction the whole product is built on: nothing measured is not the same
   * claim as measured zero.
   */
  it('says there is nothing to measure rather than showing 0%', async () => {
    v2.listGoals.mockResolvedValue([goal]);
    v2.getGoalProgress.mockResolvedValue({
      coverage: 0,
      current_seconds: 0,
      direction: 'minimum',
      goal_id: 'goal-1',
      on_track: false,
      percentage: 0,
      period: 'daily',
      target_seconds: 7200,
    });

    renderPage(<GoalsPage />);

    expect(await screen.findByText(/No activity recorded in this period yet/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

describe('Leaderboards page', () => {
  it('renders a board and its members', async () => {
    v2.listLeaderboards.mockResolvedValue([board]);
    v2.listLeaderboardMembers.mockResolvedValue([
      { joined_at: '2026-08-01T00:00:00Z', user_id: 'user-1', username: 'jit' },
    ]);

    renderPage(<LeaderboardsPage />);

    expect(await screen.findByText(/All coding time · Weekly/)).toBeInTheDocument();
    expect(await screen.findByText('jit')).toBeInTheDocument();
  });

  it('explains an unavailable deployment without calling the disabled endpoint', async () => {
    v2.getCapabilities.mockResolvedValue({
      features: [
        {
          api: '/leaderboards',
          available: false,
          key: 'private_leaderboards',
          status: 'disabled',
        },
      ],
      postgres_enabled: true,
    });

    renderPage(<LeaderboardsPage />);

    expect(
      await screen.findByText(/Leaderboards is unavailable in this deployment/)
    ).toBeInTheDocument();
    expect(screen.queryByText('New leaderboard')).not.toBeInTheDocument();
    expect(v2.listLeaderboards).not.toHaveBeenCalled();
  });
});
