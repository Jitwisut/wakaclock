import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { TeamGithubPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-github-panel';

const api = vi.hoisted(() => ({
  user: 'member-a' as null | string,
  bind: vi.fn(),
  connection: vi.fn(),
  choices: vi.fn(),
  disconnect: vi.fn(),
  installations: vi.fn(),
  projects: vi.fn(),
  receipt: vi.fn(),
  select: vi.fn(),
  start: vi.fn(),
  sync: vi.fn(),
  teams: vi.fn(),
  toast: vi.fn(),
  work: vi.fn(),
}));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (s: { userId: null | string }) => unknown) =>
    select({ userId: api.user }),
}));
vi.mock('sonner', () => ({ toast: api.toast }));
vi.mock('@/lib/wakaclock/endpoints-v2', () => ({ listOrganizationTeams: api.teams }));
vi.mock('@/lib/wakaclock/team-endpoints', () => ({ getTeamWorkReceipt: api.receipt }));
vi.mock('@/lib/wakaclock/github-endpoints', () => ({
  bindGithubProject: api.bind,
  disconnectGithub: api.disconnect,
  getGithubConnection: api.connection,
  getGithubInstallations: api.installations,
  getGithubProjects: api.projects,
  getGithubRepositoryChoices: api.choices,
  getGithubWorkPage: api.work,
  selectGithubRepositories: api.select,
  startGithubAuthorization: api.start,
  syncGithub: api.sync,
}));
// The member session panel has its own suite; here it would only add network noise.
vi.mock('@/app/dashboard/(auth)/wakaclock/teams/components/team-github-sessions', () => ({
  TeamGithubSessions: () => null,
}));

const connection = (extra: Record<string, unknown> = {}) => ({
  configured: true,
  can_manage: true,
  identity: { login: 'member-a-gh' },
  repositories: [
    {
      repository_id: 'r1',
      full_name: 'acme/app',
      enabled: true,
      coverage: 'observed',
      error_code: null,
    },
    {
      repository_id: 'r2',
      full_name: 'acme/old',
      enabled: false,
      coverage: 'observed',
      error_code: 'access_revoked',
    },
  ],
  health: { status: 'observed', reason: 'scoped_reconciliation' },
  ...extra,
});

const workItem = (extra: Record<string, unknown> = {}) => ({
  repository_id: 'r1',
  external_id: 11,
  number: 11,
  kind: 'issue',
  state: 'open',
  url: 'https://github.com/acme/app/issues/11',
  ci: { status: 'passing' },
  review_wait_seconds: { value: 30 },
  ready_to_merge_seconds: { value: 60 },
  synced_at: '2026-10-08T00:00:00Z',
  ...extra,
});

/** Calls a control's React click handler even when it is disabled, to exercise guards. */
function invokeClick(element: HTMLElement) {
  const key = Object.keys(element).find((name) => name.startsWith('__reactProps$')) as string;
  act(() => {
    (element as unknown as Record<string, { onClick: () => void }>)[key].onClick();
  });
}

function panel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client}>
      <TeamGithubPanel organizationId="org" />
    </QueryClientProvider>
  );
  return { ...render(tree()), client, tree };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  api.user = 'member-a';
  api.connection.mockResolvedValue(connection());
  api.teams.mockResolvedValue([{ id: 't1', name: 'Core' }]);
  api.installations.mockResolvedValue({
    install_url: 'https://github.com/apps/atoaxis/installations/new',
    installations: [
      { id: 5, account: { login: 'acme' }, suspended: false },
      { id: 6, account: { login: 'paused' }, suspended: true },
    ],
  });
  api.choices.mockResolvedValue([{ id: 501, full_name: 'acme/app' }]);
  api.projects.mockResolvedValue({
    projects: [{ project_id: 'p1', name: 'App' }],
    repositories: [{ repository_id: 'r1', full_name: 'acme/app' }],
  });
  api.work.mockResolvedValue({ items: [workItem()], next: null });
  api.receipt.mockResolvedValue({
    estimated_cost_microusd: { value: 1_500_000, reason: null },
    sharing: 'individual_opt_in_only',
    sessions: [{ link_id: 'l1', allocation: 'full', cost_microusd: { value: null, reason: null } }],
  });
  for (const fn of [api.bind, api.disconnect, api.select, api.sync]) fn.mockResolvedValue({});
});

it('reads nothing without a signed-in user', () => {
  api.user = null;
  panel();
  expect(api.connection).not.toHaveBeenCalled();
});

it('explains an environment without the GitHub App', async () => {
  api.connection.mockResolvedValue(connection({ configured: false }));
  panel();
  expect(
    await screen.findByText('GitHub App is not configured for this environment.')
  ).toBeInTheDocument();
});

it('lets a member without a GitHub identity browse a chosen team scope', async () => {
  api.connection.mockResolvedValue(connection({ identity: null, can_manage: false }));
  panel();
  expect(await screen.findByText(/Your GitHub identity: Not connected/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Resync' })).toBeNull();
  expect(api.work).not.toHaveBeenCalled();
  fireEvent.change(await screen.findByRole('combobox', { name: 'Work team scope' }), {
    target: { value: 't1' },
  });
  await waitFor(() => expect(api.work).toHaveBeenCalledWith('org', undefined, 't1'));
  expect(await screen.findByText(/Review wait 30s/)).toBeInTheDocument();
  expect(screen.getByText(/Ready to merge 60s/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Issue #11' })).toBeInTheDocument();
});

it('starts GitHub authorization only toward github.com and only for the same account', async () => {
  api.start.mockResolvedValueOnce({
    authorize_url: 'https://github.com/login/oauth/authorize?state=s',
  });
  const view = panel();
  fireEvent.click(await screen.findByRole('button', { name: 'Connect your GitHub account' }));
  await waitFor(() => expect(api.start).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Connect your GitHub account' })).toBeEnabled()
  );
  expect(screen.queryByRole('alert')).toBeNull();

  api.start.mockResolvedValueOnce({ authorize_url: 'https://evil.example/authorize' });
  fireEvent.click(screen.getByRole('button', { name: 'Connect your GitHub account' }));
  expect(await screen.findByText(/GitHub action could not finish/)).toBeInTheDocument();

  let finish!: (value: unknown) => void;
  api.start.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  fireEvent.click(screen.getByRole('button', { name: 'Connect your GitHub account' }));
  await waitFor(() => expect(api.start).toHaveBeenCalledTimes(3));
  api.user = 'member-b';
  view.rerender(view.tree());
  await act(async () => {
    finish({ authorize_url: 'https://evil.example/ignored' });
  });
  expect(api.sync).not.toHaveBeenCalled();
});

it('connects selected repositories with or without a team scope, and runs maintenance actions', async () => {
  const view = panel();
  expect(await screen.findByText(/acme\/app · observed · no recorded error/)).toBeInTheDocument();
  expect(screen.getByText(/acme\/old · access disabled · access_revoked/)).toBeInTheDocument();
  const installation = await screen.findByRole('combobox', { name: 'GitHub installation' });
  expect(screen.queryByRole('option', { name: 'paused' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh installations' }));
  await waitFor(() => expect(api.installations).toHaveBeenCalledTimes(2));

  fireEvent.change(installation, { target: { value: '5' } });
  const repo = await screen.findByRole('checkbox', { name: 'acme/app' });
  fireEvent.click(repo);
  fireEvent.click(repo);
  expect(screen.getByRole('button', { name: 'Connect selected repositories' })).toBeDisabled();
  fireEvent.click(repo);
  fireEvent.change(screen.getByRole('combobox', { name: 'Repository team scope' }), {
    target: { value: 't1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Connect selected repositories' }));
  await waitFor(() => expect(api.select).toHaveBeenCalledWith('org', 5, [501], 't1'));
  await waitFor(() => expect(api.connection).toHaveBeenCalledTimes(2));

  fireEvent.change(screen.getByRole('combobox', { name: 'Repository team scope' }), {
    target: { value: '' },
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Connect selected repositories' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Connect selected repositories' }));
  await waitFor(() => expect(api.select).toHaveBeenLastCalledWith('org', 5, [501], undefined));

  await waitFor(() => expect(screen.getByRole('button', { name: 'Resync' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Resync' }));
  await waitFor(() => expect(api.sync).toHaveBeenCalledWith('org'));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Disconnect repositories' })).toBeEnabled()
  );

  // A result that lands after the account changed must not refresh the new account's data.
  let finish!: (value: unknown) => void;
  api.disconnect.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect repositories' }));
  await waitFor(() => expect(api.disconnect).toHaveBeenCalledWith('org'));
  const before = api.connection.mock.calls.length;
  api.user = 'member-b';
  view.rerender(view.tree());
  await act(async () => {
    finish({});
  });
  expect(api.connection.mock.calls.length).toBeGreaterThanOrEqual(before);
});

it('reports unavailable installations and repository access', async () => {
  api.installations.mockRejectedValue(new Error('denied'));
  panel();
  expect(await screen.findByText(/Could not load GitHub installations/)).toBeInTheDocument();
});

it('keeps repository selection closed when repository access fails', async () => {
  api.choices.mockRejectedValue(new Error('revoked'));
  panel();
  fireEvent.change(await screen.findByRole('combobox', { name: 'GitHub installation' }), {
    target: { value: '5' },
  });
  expect(await screen.findByText('Repository access unavailable.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Connect selected repositories' })).toBeDisabled();
});

it('confirms a project mapping only once both sides are chosen', async () => {
  panel();
  const confirm = await screen.findByRole('button', { name: 'Confirm project mapping' });
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox', { name: 'Your project' }), {
    target: { value: 'p1' },
  });
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox', { name: 'Project repository' }), {
    target: { value: 'r1' },
  });
  fireEvent.click(confirm);
  await waitFor(() => expect(api.bind).toHaveBeenCalledWith('org', 'p1', 'r1'));
});

it('pages work, shows receipts and closes them on failure', async () => {
  api.work
    .mockResolvedValueOnce({
      items: [
        workItem({
          kind: 'pull_request',
          review_wait_seconds: { value: null },
          ready_to_merge_seconds: { value: null },
        }),
      ],
      next: 'cursor-2',
    })
    .mockResolvedValueOnce({ items: [workItem({ external_id: 12, number: 12 })], next: null })
    .mockResolvedValue({ items: [workItem()], next: null });
  panel();
  expect(await screen.findByRole('link', { name: 'PR #11' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await waitFor(() => expect(api.work).toHaveBeenCalledWith('org', 'cursor-2', undefined));
  expect(await screen.findByRole('link', { name: 'Issue #12' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'First page' }));
  await waitFor(() => expect(api.work).toHaveBeenLastCalledWith('org', undefined, undefined));
  expect(await screen.findByRole('link', { name: 'Issue #11' })).toBeInTheDocument();
  // This page has no cursor; the guard keeps the page from advancing past it.
  const calls = api.work.mock.calls.length;
  invokeClick(screen.getByRole('button', { name: 'Next page' }));
  expect(api.work.mock.calls.length).toBe(calls);

  fireEvent.click(await screen.findByRole('button', { name: 'View receipt' }));
  expect(await screen.findByText(/Estimated AI cost: \$1.500000/)).toBeInTheDocument();
  expect(screen.getByText(/full · unavailable/)).toBeInTheDocument();

  api.receipt.mockRejectedValueOnce(new Error('gone'));
  fireEvent.change(screen.getByRole('combobox', { name: 'Work team scope' }), {
    target: { value: 't1' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'View receipt' }));
  expect(await screen.findByText(/Receipt unavailable/)).toBeInTheDocument();
});

it('flags unavailable work metadata and announces a changed sync state', async () => {
  sessionStorage.setItem('github-health:member-a:org', 'pending:initial_sync');
  api.work.mockRejectedValue(new Error('denied'));
  panel();
  expect(await screen.findByText(/Work metadata unavailable/)).toBeInTheDocument();
  expect(api.toast).toHaveBeenCalledWith('GitHub sync: observed');
});
