import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TeamGithubPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-github-panel';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';

const state = vi.hoisted(() => ({
  user: 'member-a',
  connection: vi.fn(),
  propose: vi.fn(),
  decide: vi.fn(),
  receipt: vi.fn(),
  teams: vi.fn(),
  installations: vi.fn(),
  projects: vi.fn(),
  suggestions: vi.fn(),
  work: vi.fn(),
}));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (s: { userId: string }) => unknown) =>
    select({ userId: state.user }),
}));
vi.mock('@/lib/wakaclock/endpoints-v2', () => ({ listOrganizationTeams: state.teams }));
vi.mock('@/lib/wakaclock/team-endpoints', () => ({ getTeamWorkReceipt: state.receipt }));
vi.mock('@/lib/wakaclock/github-endpoints', () => ({
  getGithubConnection: state.connection,
  getGithubInstallations: state.installations,
  getGithubProjects: state.projects,
  getGithubSuggestions: state.suggestions,
  getGithubWorkPage: state.work,
  proposeGithubLink: state.propose,
  decideGithubLink: state.decide,
}));
beforeEach(() => {
  state.user = 'member-a';
  state.teams.mockResolvedValue([]);
  state.installations.mockResolvedValue({
    install_url: 'https://github.com/apps/test/installations/new',
    installations: [],
  });
  state.projects.mockResolvedValue({ projects: [], repositories: [] });
  state.suggestions.mockResolvedValue([
    {
      session_id: 'a'.repeat(64),
      repository_id: 'repo',
      status: 'proposed',
      evidence: 'repository_branch_commit',
      candidates: [{ external_id: 1, number: 7 }],
    },
  ]);
  state.work.mockResolvedValue({
    items: [
      {
        repository_id: 'repo',
        external_id: 1,
        number: 7,
        kind: 'pull_request',
        state: 'open',
        url: 'https://github.com/fixture/repo/pull/7',
        ci: { status: 'unavailable' },
        review_wait_seconds: { value: null },
        ready_to_merge_seconds: { value: null },
        synced_at: '2026-10-08T00:00:00Z',
      },
    ],
    next: null,
  });
  state.connection.mockResolvedValue({
    configured: true,
    can_manage: true,
    identity: { login: 'verified-member-a' },
    repositories: [],
    health: { status: 'observed', reason: 'scoped_reconciliation' },
  });
  state.receipt.mockResolvedValue({
    estimated_cost_microusd: { value: null, reason: 'unknown_price' },
    sharing: 'individual_opt_in_only',
    sessions: [],
  });
  state.decide.mockResolvedValue({});
});
function panel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client}>
      <TeamGithubPanel organizationId="org" />
    </QueryClientProvider>
  );
  return { ...render(tree()), client, tree };
}
it('stops a link confirmation after the account changes while proposal is in flight', async () => {
  let resolve!: (value: unknown) => void;
  state.propose.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    })
  );
  const view = panel();
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm PR #7' }));
  await waitFor(() => expect(state.propose).toHaveBeenCalledTimes(1));
  state.user = 'member-b';
  state.connection.mockReturnValue(new Promise(() => {}));
  view.rerender(view.tree());
  await act(async () => {
    resolve({ id: 'link-a' });
  });
  expect(state.decide).not.toHaveBeenCalled();
  expect(screen.queryByText(/verified-member-a/)).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByRole('link', { name: 'PR #7' })).not.toBeInTheDocument()
  );
});
it('closes cached work and receipt metadata when the connection reload fails', async () => {
  const view = panel();
  expect(await screen.findByRole('link', { name: 'PR #7' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View receipt' }));
  expect(await screen.findByText(/unknown_price/)).toBeInTheDocument();
  expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
  state.connection.mockRejectedValue(new Error('repository authorization revoked'));
  await act(async () => {
    await view.client.invalidateQueries({ queryKey: wakaclockKeys.teamGithub('member-a', 'org') });
  });
  await waitFor(() =>
    expect(screen.queryByRole('link', { name: 'PR #7' })).not.toBeInTheDocument()
  );
  expect(screen.queryByText(/unknown_price/)).not.toBeInTheDocument();
});
