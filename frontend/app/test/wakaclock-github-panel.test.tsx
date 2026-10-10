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
  sessions: vi.fn(),
  history: vi.fn(),
  replace: vi.fn(),
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
  getGithubSessions: state.sessions,
  getGithubOwnWorkPage: state.work,
  getGithubLinkHistory: state.history,
  replaceGithubLink: state.replace,
  retryGithubContexts: vi.fn(),
  getGithubOwnReceipt: state.receipt,
  getGithubRelationships: vi
    .fn()
    .mockResolvedValue({ items: [], next: null, coverage: 'observed' }),
  getGithubWorkPage: state.work,
  proposeGithubLink: state.propose,
  decideGithubLink: state.decide,
}));
beforeEach(() => {
  vi.clearAllMocks();
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
  state.sessions.mockResolvedValue({
    items: [
      {
        session_id: 'a'.repeat(64),
        started_at: '2026-10-08T00:00:00Z',
        last_event_at: '2026-10-08T00:01:00Z',
        reason: 'repository_branch_commit',
        candidates: [{ repository_id: 'repo', external_id: 1, number: 7 }],
        links: [],
      },
    ],
    next: null,
    context_health: { capture_status: 'unconfirmed', pending: 1, dead_letter: 0 },
  });
  state.history.mockResolvedValue({ items: [], next: null });
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
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm candidate PR #7' }));
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

it('uses revisions for withdrawal and atomic replacement, and closes stale history on failure', async () => {
  state.sessions.mockResolvedValue({
    items: [
      {
        session_id: 'a'.repeat(64),
        started_at: '2026-10-08T00:00:00Z',
        last_event_at: '2026-10-08T00:01:00Z',
        reason: 'repository_branch_commit',
        candidates: [],
        links: [
          {
            id: 'link-a',
            repository_id: 'repo',
            work_item_id: 1,
            status: 'confirmed',
            revision: 3,
          },
        ],
      },
    ],
    next: null,
    context_health: { capture_status: 'unconfirmed', pending: 0, dead_letter: 0 },
  });
  state.history.mockResolvedValue({
    items: [
      { id: 'history-a', changed_at: '2026-10-08T00:01:00Z', status: 'confirmed', revision: 3 },
    ],
    next: null,
  });
  state.replace.mockResolvedValue({});
  const view = panel();
  fireEvent.change(await screen.findByRole('combobox', { name: 'Work to link or replace' }), {
    target: { value: 'repo:1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Replace with selected PR' }));
  await waitFor(() =>
    expect(state.replace).toHaveBeenCalledWith(
      'org',
      expect.objectContaining({ id: 'link-a', revision: 3 }),
      'repo',
      1
    )
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Withdraw link' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw link' }));
  await waitFor(() => expect(state.decide).toHaveBeenCalledWith('org', 'link-a', 'withdrawn', 3));
  fireEvent.click(screen.getByRole('button', { name: 'Link history' }));
  expect(await screen.findByText(/2026-10-08T00:01:00Z · confirmed/)).toBeInTheDocument();
  state.history.mockRejectedValue(new Error('sharing revoked'));
  await act(async () => {
    await view.client.invalidateQueries({ queryKey: wakaclockKeys.teamGithub('member-a', 'org') });
  });
  await waitFor(() =>
    expect(screen.queryByText(/2026-10-08T00:01:00Z · confirmed/)).not.toBeInTheDocument()
  );
});
it('does not display cached session or receipt data after a failed reload', async () => {
  const view = panel();
  expect(await screen.findByText(/repository_branch_commit/)).toBeInTheDocument();
  state.sessions.mockRejectedValue(new Error('scope revoked'));
  await act(async () => {
    await view.client.invalidateQueries({ queryKey: wakaclockKeys.teamGithub('member-a', 'org') });
  });
  await waitFor(() =>
    expect(screen.queryByText(/repository_branch_commit/)).not.toBeInTheDocument()
  );
});
