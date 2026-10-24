import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TeamActionsPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-actions-panel';
const mocks = vi.hoisted(() => ({
  user: 'owner',
  list: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  history: vi.fn(),
  comparison: vi.fn(),
  teams: vi.fn(),
  members: vi.fn(),
}));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (s: (v: { userId: string }) => unknown) => s({ userId: mocks.user }),
}));
vi.mock('@/lib/wakaclock/team-action-endpoints', () => ({
  getTeamActions: mocks.list,
  saveTeamAction: mocks.save,
  deleteTeamAction: mocks.remove,
  getTeamActionHistory: mocks.history,
  getTeamActionComparison: mocks.comparison,
}));
vi.mock('@/lib/wakaclock/endpoints-v2', () => ({
  listOrganizationTeams: mocks.teams,
  listOrganizationMembers: mocks.members,
  listTeamMembers: mocks.members,
}));
const action = {
  id: 'a',
  organization_id: 'org',
  team_id: null,
  owner_id: 'owner',
  title: 'Improve review flow',
  focus: 'review_flow',
  family: 'team_cost',
  baseline_week: '2026-09-28',
  followup_week: '2026-10-05',
  timezone: 'Asia/Bangkok',
  status: 'active',
  revision: 2,
  created_by: 'owner',
  changed_by: 'owner',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-02T00:00:00Z',
};
beforeEach(() => {
  mocks.user = 'owner';
  mocks.list
    .mockReset()
    .mockResolvedValue({ actions: [action], next_cursor: null, can_manage: true });
  mocks.save.mockReset().mockResolvedValue(action);
  mocks.remove.mockReset().mockResolvedValue({ id: 'a', revision: 3, deleted: true });
  mocks.history.mockReset().mockResolvedValue({ changes: [action], next_revision: null });
  mocks.comparison
    .mockReset()
    .mockResolvedValue({
      action_id: 'a',
      action_revision: 2,
      report: {
        baseline: { week_start: '2026-09-28', timezone: 'Asia/Bangkok' },
        followup: { week_start: '2026-10-05', timezone: 'Asia/Bangkok' },
        changes: [
          {
            metric: 'estimated_ai_cost',
            unit: 'micro_usd',
            baseline_value: '0',
            followup_value: null,
            difference: null,
            baseline_coverage: 1,
            followup_coverage: null,
          },
        ],
      },
    });
  mocks.teams.mockReset().mockResolvedValue([{ id: 't', name: 'Team A' }]);
  mocks.members
    .mockReset()
    .mockResolvedValue([{ user_id: 'owner', username: 'Owner', deactivated_at: null }]);
  let n = 0;
  vi.stubGlobal('crypto', {
    randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  });
});
afterEach(() => vi.unstubAllGlobals());
function mount() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = (org = 'org') => (
    <QueryClientProvider client={cache}>
      <TeamActionsPanel organizationId={org} timezone="Asia/Bangkok" />
    </QueryClientProvider>
  );
  return { ...render(view()), cache, view };
}
it('uses stable request identity to retry an unconfirmed save, and keeps the CAS revision', async () => {
  mount();
  await waitFor(() => expect(screen.getByText('Edit action')).not.toBeDisabled());
  fireEvent.click(screen.getByText('Edit action'));
  fireEvent.change(screen.getByLabelText('Action title'), {
    target: { value: 'Evaluate the review process' },
  });
  mocks.save.mockRejectedValueOnce(new Error('response lost'));
  fireEvent.click(screen.getByText('Save action'));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Action title')).toHaveValue('Evaluate the review process');
  const accepted = mocks.save.mock.calls[0];
  expect(accepted[3].expected_revision).toBe(2);
  fireEvent.click(screen.getByText('Save action'));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
  expect(mocks.save.mock.calls[1]).toEqual(accepted);
});
it('requires confirmation before deletion and sends the current revision', async () => {
  mount();
  await screen.findByText('Delete action');
  fireEvent.click(screen.getByText('Delete action'));
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(screen.getByRole('alertdialog')).toBeVisible();
  fireEvent.click(screen.getByText('Confirm delete'));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalled());
  expect(mocks.remove.mock.calls[0][1].revision).toBe(2);
});
it('closes existing actions, form and history when account/org changes or a read fails', async () => {
  const { rerender, view } = mount();
  await screen.findByText('Improve review flow');
  fireEvent.click(screen.getByText('History'));
  await screen.findByText('Change history');
  fireEvent.click(screen.getByText('Edit action'));
  mocks.user = 'another';
  mocks.list.mockRejectedValue(new Error('denied'));
  rerender(view('other'));
  await screen.findByText(/Actions unavailable/);
  expect(screen.queryByText('Improve review flow')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Action title')).not.toBeInTheDocument();
  expect(screen.queryByText('Change history')).not.toBeInTheDocument();
});
it('hides edit controls and abandons the form after management rights are lost', async () => {
  const { cache } = mount();
  await waitFor(() => expect(screen.getByText('Edit action')).not.toBeDisabled());
  fireEvent.click(screen.getByText('Edit action'));
  expect(screen.getByLabelText('Action title')).toBeVisible();
  mocks.list.mockResolvedValue({ actions: [action], next_cursor: null, can_manage: false });
  await cache.invalidateQueries();
  await waitFor(() => expect(screen.queryByLabelText('Action title')).not.toBeInTheDocument());
  expect(screen.queryByText('Delete action')).not.toBeInTheDocument();
  expect(screen.getByText('Improve review flow')).toBeVisible();
});
it('keeps Copilot action counters in UTC and does not create an analytics consent', async () => {
  mount();
  await waitFor(() => expect(screen.getByText('New improvement action')).not.toBeDisabled());
  fireEvent.click(screen.getByText('New improvement action'));
  fireEvent.change(screen.getByLabelText('Action metric family'), { target: { value: 'copilot' } });
  expect(screen.getByText('Copilot counters · UTC')).toBeInTheDocument();
  expect(screen.getByText(/Assignment does not enable sharing/)).toBeVisible();
});
it('shows the admitted action comparison with zero and unavailable kept distinct', async () => {
  mount();
  await screen.findByText('Compare weeks');
  fireEvent.click(screen.getByText('Compare weeks'));
  await screen.findByRole('region', { name: 'Action comparison' });
  expect(mocks.comparison).toHaveBeenCalledWith('org', 'a', undefined);
  expect(screen.getByText('0')).toBeVisible();
  expect(screen.getAllByText('unavailable')).toHaveLength(2);
  expect(screen.getByText(/not the owner's personal activity/)).toBeVisible();
});
it('withholds a comparison if the action revision changes during the request', async () => {
  mocks.comparison.mockResolvedValue({
    action_id: 'a',
    action_revision: 3,
    report: { changes: [] },
  });
  mount();
  await screen.findByText('Compare weeks');
  fireEvent.click(screen.getByText('Compare weeks'));
  await screen.findByText(/Comparison unavailable/);
  expect(screen.queryByRole('region', { name: 'Action comparison' })).not.toBeInTheDocument();
});
