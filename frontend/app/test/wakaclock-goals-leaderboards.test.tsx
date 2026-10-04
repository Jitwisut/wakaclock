import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GoalsPage from '@/app/dashboard/(auth)/wakaclock/goals/page';
import LeaderboardsPage from '@/app/dashboard/(auth)/wakaclock/leaderboards/page';

import { toast } from 'sonner';
import {
  createGoal,
  deleteGoal,
  createLeaderboard,
  addLeaderboardMember,
  removeLeaderboardMember,
} from '@/lib/wakaclock/endpoints-v2';
import { getProjects } from '@/lib/wakaclock/endpoints';

import type { Goal, Leaderboard } from '@/lib/wakaclock/types';

/**
 * These mount the real pages rather than a panel in isolation. Both compile and both
 * pass a typecheck without ever having been rendered, and a page that throws on first
 * paint fails in exactly that gap — a bad date, a missing provider, a hook called
 * conditionally. Rendering them is the only thing that proves they work at all.
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const session = vi.hoisted(() => ({ userId: 'user-1' as null | string }));

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
  useWakaclockUserStore: (selector: (state: { userId: null | string }) => unknown) =>
    selector(session),
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
  session.userId = 'user-1';
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

it.each([
  ['goals', <GoalsPage />],
  ['leaderboards', <LeaderboardsPage />],
])('does not query private %s without an authenticated owner', async (_name, page) => {
  session.userId = null;
  renderPage(page as React.ReactElement);
  await act(async () => {});
  expect(v2.listGoals).not.toHaveBeenCalled();
  expect(v2.getGoalProgress).not.toHaveBeenCalled();
  expect(v2.listLeaderboards).not.toHaveBeenCalled();
  expect(v2.listLeaderboardMembers).not.toHaveBeenCalled();
  expect(getProjects).not.toHaveBeenCalled();
});

it('uses UTC for new goals when the browser cannot resolve a timezone', async () => {
  const options = Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...options,
    timeZone: '',
  });
  v2.listGoals.mockResolvedValue([]);
  vi.mocked(createGoal).mockResolvedValue(goal);
  renderPage(<GoalsPage />);
  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'UTC goal' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create goal' }));
  await waitFor(() =>
    expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'UTC' }))
  );
  expect(await screen.findByText('No goals yet. Create one above.')).toBeVisible();
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

it('creates a scoped goal using trimmed fields and refreshes the list after saving', async () => {
  v2.listGoals.mockResolvedValue([]);
  vi.mocked(getProjects).mockResolvedValue({ data: [{ name: 'Lab' }] } as Awaited<
    ReturnType<typeof getProjects>
  >);
  vi.mocked(createGoal).mockResolvedValue(goal);
  renderPage(<GoalsPage />);
  const create = await screen.findByRole('button', { name: 'Create goal' });
  expect(create).toBeDisabled();
  fireEvent.submit(create.closest('form')!);
  expect(createGoal).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Focus  ' } });
  fireEvent.change(screen.getByLabelText('Target (hours)'), { target: { value: '0' } });
  expect(create).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Target (hours)'), { target: { value: '1.5' } });
  fireEvent.change(screen.getByLabelText('Measure'), { target: { value: 'ai_time' } });
  fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'weekly' } });
  fireEvent.change(screen.getByLabelText('Goal is to spend'), { target: { value: 'maximum' } });
  fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'project' } });
  await waitFor(() => expect(getProjects).toHaveBeenCalled());
  await waitFor(() =>
    expect(document.querySelector('datalist option')).toHaveAttribute('value', 'Lab')
  );
  fireEvent.change(screen.getByLabelText('Which one'), { target: { value: '  Lab  ' } });
  fireEvent.click(create);
  await waitFor(() =>
    expect(createGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Focus',
        metric: 'ai_time',
        period: 'weekly',
        direction: 'maximum',
        target_seconds: 5400,
        filter_kind: 'project',
        filter_value: 'Lab',
      })
    )
  );
  await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''));
  expect(v2.listGoals.mock.calls.length).toBeGreaterThan(1);
});
it('keeps an unsuccessful goal submission editable and reports deletion errors without claiming success', async () => {
  v2.listGoals.mockResolvedValue([goal]);
  v2.getGoalProgress.mockResolvedValue({
    coverage: 1,
    current_seconds: 9000,
    target_seconds: 7200,
    percentage: 125,
    on_track: true,
  });
  let reject!: (error: Error) => void;
  vi.mocked(createGoal).mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail;
    })
  );
  vi.mocked(deleteGoal).mockRejectedValueOnce(new Error('delete denied'));
  renderPage(<GoalsPage />);
  await screen.findByText('Two focused hours');
  expect(await screen.findByText('On track · 100%')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New' } });
  fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'language' } });
  expect(screen.getByLabelText('Which one')).toHaveAttribute('placeholder', 'Rust');
  fireEvent.click(screen.getByRole('button', { name: 'Create goal' }));
  expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled();
  expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({ filter_value: null }));
  await act(async () => reject(new Error('create denied')));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('create denied'));
  expect(screen.getByLabelText('Name')).toHaveValue('New');
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('delete denied'));
  vi.mocked(deleteGoal).mockResolvedValueOnce(undefined);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Goal deleted'));
});
it('shows unsupported goal metadata without losing the row and clamps measured progress below zero', async () => {
  v2.listGoals.mockResolvedValue([
    { ...goal, metric: 'future_metric', period: 'future_period', filter_value: 'Lab' },
  ]);
  v2.getGoalProgress.mockResolvedValue({
    coverage: 1,
    current_seconds: 0,
    target_seconds: 7200,
    percentage: -5,
    on_track: false,
  });
  renderPage(<GoalsPage />);
  expect(await screen.findByText('future_metric · future_period · Lab')).toBeVisible();
  expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
});
it('creates an unfiltered goal with no scope value', async () => {
  v2.listGoals.mockResolvedValue([]);
  vi.mocked(createGoal).mockResolvedValue(goal);
  renderPage(<GoalsPage />);
  await screen.findByText('No goals yet. Create one above.');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'All work' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create goal' }));
  await waitFor(() =>
    expect(createGoal).toHaveBeenCalledWith(
      expect.objectContaining({ filter_kind: 'all', filter_value: null })
    )
  );
});

it('creates a leaderboard with selected visibility, metric and period, retaining errors for retry', async () => {
  v2.listLeaderboards.mockResolvedValue([]);
  let reject!: (error: Error) => void;
  vi.mocked(createLeaderboard).mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    })
  );
  renderPage(<LeaderboardsPage />);
  await screen.findByText('No leaderboards yet. Create one above.');
  fireEvent.change(screen.getByLabelText('Measure'), { target: { value: 'ai_spend' } });
  fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'monthly' } });
  fireEvent.change(screen.getByLabelText('Visibility'), { target: { value: 'public' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create leaderboard' }));
  expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled();
  expect(createLeaderboard).toHaveBeenCalledWith({
    metric: 'ai_spend',
    period: 'monthly',
    visibility: 'public',
  });
  await act(async () => reject(new Error('create unavailable')));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('create unavailable'));
  vi.mocked(createLeaderboard).mockResolvedValueOnce(board);
  fireEvent.click(screen.getByRole('button', { name: 'Create leaderboard' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Leaderboard created'));
  expect(v2.listLeaderboards.mock.calls.length).toBeGreaterThan(1);
});
it('adds and removes members, prevents empty submissions and retains failed requests for retry', async () => {
  v2.listLeaderboards.mockResolvedValue([
    {
      ...board,
      visibility: 'public',
      metric: 'future',
      period: 'future',
      language: 'Rust',
      country: 'TH',
    },
  ]);
  v2.listLeaderboardMembers.mockResolvedValue([
    { username: 'Ada', user_id: 'member', joined_at: '2026-10-01' },
  ]);
  vi.mocked(addLeaderboardMember).mockRejectedValueOnce(new Error('add denied'));
  vi.mocked(removeLeaderboardMember).mockRejectedValueOnce(new Error('remove denied'));
  renderPage(<LeaderboardsPage />);
  expect(await screen.findByText('future · future · Rust · TH')).toBeVisible();
  await screen.findByText('Ada');
  const input = screen.getByLabelText('Add by user id');
  const add = screen.getByRole('button', { name: 'Add' });
  expect(add).toBeDisabled();
  fireEvent.submit(input.closest('form')!);
  expect(addLeaderboardMember).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '  member  ' } });
  fireEvent.click(add);
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('add denied'));
  expect(addLeaderboardMember).toHaveBeenCalledWith('board-1', 'member');
  expect(input).toHaveValue('  member  ');
  vi.mocked(addLeaderboardMember).mockResolvedValueOnce(undefined);
  fireEvent.click(add);
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Member added'));
  expect(input).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('remove denied'));
  vi.mocked(removeLeaderboardMember).mockResolvedValueOnce(undefined);
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Member removed'));
  expect(removeLeaderboardMember).toHaveBeenCalledWith('board-1', 'member');
});
