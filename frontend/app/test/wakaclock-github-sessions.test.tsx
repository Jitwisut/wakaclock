import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { TeamGithubSessions } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-github-sessions';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';

const api = vi.hoisted(() => ({
  user: 'member-a' as null | string,
  decide: vi.fn(),
  history: vi.fn(),
  propose: vi.fn(),
  receipt: vi.fn(),
  relations: vi.fn(),
  replace: vi.fn(),
  retry: vi.fn(),
  sessions: vi.fn(),
  work: vi.fn(),
}));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (s: { userId: null | string }) => unknown) =>
    select({ userId: api.user }),
}));
vi.mock('@/lib/wakaclock/github-endpoints', () => ({
  decideGithubLink: api.decide,
  getGithubLinkHistory: api.history,
  getGithubOwnReceipt: api.receipt,
  getGithubOwnWorkPage: api.work,
  getGithubRelationships: api.relations,
  getGithubSessions: api.sessions,
  proposeGithubLink: api.propose,
  replaceGithubLink: api.replace,
  retryGithubContexts: api.retry,
}));

const SESSION = 'b'.repeat(64);
const session = (extra: Record<string, unknown> = {}) => ({
  session_id: SESSION,
  started_at: '2026-10-08T00:00:00Z',
  last_event_at: '2026-10-08T01:00:00Z',
  reason: 'repository_branch_commit',
  candidates: [{ repository_id: 'repo', external_id: 7, number: 7 }],
  links: [],
  ...extra,
});
const sessionsPage = (items: unknown[], next: null | string = null) => ({
  items,
  next,
  context_health: { capture_status: 'unconfirmed', pending: 2, dead_letter: 0 },
});
const workPage = (next: null | string = null) => ({
  items: [
    { repository_id: 'repo', external_id: 7, number: 7, kind: 'pull_request', state: 'open' },
    { repository_id: 'repo', external_id: 8, number: 8, kind: 'issue', state: 'open' },
  ],
  next,
});
const confirmedLink = {
  id: 'link-a',
  repository_id: 'repo',
  work_item_id: 7,
  status: 'confirmed',
  revision: 4,
};

/** Calls a control's React click handler even when it is disabled, to exercise guards. */
function invokeClick(element: HTMLElement) {
  const key = Object.keys(element).find((name) => name.startsWith('__reactProps$')) as string;
  act(() => {
    (element as unknown as Record<string, { onClick: () => void }>)[key].onClick();
  });
}

function view() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client}>
      <TeamGithubSessions organizationId="org" />
    </QueryClientProvider>
  );
  return { ...render(tree()), client, tree };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.user = 'member-a';
  api.sessions.mockResolvedValue(sessionsPage([session()]));
  api.work.mockResolvedValue(workPage());
  api.history.mockResolvedValue({ items: [], next: null });
  api.receipt.mockResolvedValue({
    estimated_cost_microusd: { value: 2_000_000, reason: null, status: 'observed' },
    sharing: 'individual',
    cost_until: '2026-10-09T00:00:00Z',
    calculation_version: 'merged_pr_cost_v1',
    sessions: [
      { link_id: 's1', allocation: 'full', cost_microusd: { value: 500_000, reason: null } },
      { link_id: 's2', allocation: 'shared', cost_microusd: { value: null, reason: null } },
    ],
    next: null,
  });
  api.relations.mockResolvedValue({
    coverage: 'observed',
    next: null,
    items: [
      {
        event_id: 'e1',
        relationship: 'closes',
        action: 'added',
        source_at: '2026-10-08T02:00:00Z',
        observed_at: '2026-10-08T02:05:00Z',
        url: 'https://github.com/acme/app/issues/3',
      },
      {
        event_id: 'e2',
        relationship: 'references',
        action: 'added',
        source_at: null,
        observed_at: '2026-10-08T02:06:00Z',
        url: null,
      },
    ],
  });
  for (const fn of [api.decide, api.replace, api.retry]) fn.mockResolvedValue({});
  api.propose.mockResolvedValue({ id: 'link-new', revision: 1 });
});

it('reads nothing without a signed-in user', () => {
  api.user = null;
  view();
  expect(api.sessions).not.toHaveBeenCalled();
  expect(api.work).not.toHaveBeenCalled();
});

it('says an empty page proves nothing about capture, and pages sessions', async () => {
  api.sessions
    .mockResolvedValueOnce(sessionsPage([], 'sessions-2'))
    .mockResolvedValueOnce(sessionsPage([session()]))
    .mockResolvedValue(sessionsPage([]));
  view();
  expect(await screen.findByText(/does not prove capture is complete/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next session page' }));
  await waitFor(() => expect(api.sessions).toHaveBeenCalledWith('org', 'sessions-2'));
  expect(await screen.findByText(/repository_branch_commit/)).toBeInTheDocument();
  invokeClick(screen.getByRole('button', { name: 'Next session page' }));
  fireEvent.click(await screen.findByRole('button', { name: 'First session page' }));
  await waitFor(() => expect(api.sessions).toHaveBeenLastCalledWith('org', undefined));
});

it('confirms and rejects candidates, retries verification and reports a failed change', async () => {
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm candidate PR #7' }));
  await waitFor(() => expect(api.decide).toHaveBeenCalledWith('org', 'link-new', 'confirmed', 1));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Reject candidate PR #7' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reject candidate PR #7' }));
  await waitFor(() => expect(api.decide).toHaveBeenCalledWith('org', 'link-new', 'rejected', 1));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Retry context verification' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry context verification' }));
  await waitFor(() => expect(api.retry).toHaveBeenCalledWith('org'));
  api.retry.mockRejectedValueOnce(new Error('no'));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Retry context verification' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry context verification' }));
  expect(await screen.findByText(/The work link could not change/)).toBeInTheDocument();
});

it('confirms the selected PR, pages work and guards a missing selection', async () => {
  api.work.mockImplementation(async (_org: string, after?: string) =>
    workPage(after ? null : 'work-2')
  );
  view();
  const confirm = await screen.findByRole('button', { name: 'Confirm selected PR' });
  expect(confirm).toBeDisabled();
  invokeClick(confirm);
  expect(api.propose).not.toHaveBeenCalled();
  // Only pull requests are offered as link targets.
  expect(screen.queryByRole('option', { name: /#8/ })).toBeNull();
  fireEvent.change(screen.getByRole('combobox', { name: 'Work to link or replace' }), {
    target: { value: 'repo:7' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm selected PR' }));
  await waitFor(() => expect(api.propose).toHaveBeenCalledWith('org', SESSION, 'repo', 7));

  await waitFor(() => expect(screen.getByRole('button', { name: 'Next work page' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Next work page' }));
  await waitFor(() => expect(api.work).toHaveBeenCalledWith('org', 'work-2'));
  const next = await screen.findByRole('button', { name: 'Next work page' });
  invokeClick(next);
  fireEvent.click(await screen.findByRole('button', { name: 'First work page' }));
  await waitFor(() => expect(api.work).toHaveBeenLastCalledWith('org', undefined));
});

it('disables linking while work metadata is reloading or unavailable', async () => {
  api.sessions.mockResolvedValue(sessionsPage([session({ candidates: [], links: [] })]));
  const page = view();
  fireEvent.change(await screen.findByRole('combobox', { name: 'Work to link or replace' }), {
    target: { value: 'repo:7' },
  });
  expect(screen.getByRole('button', { name: 'Confirm selected PR' })).toBeEnabled();

  let finish!: (value: unknown) => void;
  api.work.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  await act(async () => {
    void page.client.invalidateQueries({
      queryKey: wakaclockKeys.teamGithubOwnWork('member-a', 'org', undefined),
    });
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Confirm selected PR' })).toBeDisabled()
  );
  await act(async () => {
    finish(workPage());
  });

  api.work.mockRejectedValueOnce(new Error('revoked'));
  await act(async () => {
    await page.client.invalidateQueries({
      queryKey: wakaclockKeys.teamGithubOwnWork('member-a', 'org', undefined),
    });
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Confirm selected PR' })).toBeDisabled()
  );
});

it('replaces a confirmed link, guards a missing selection and pages its history', async () => {
  api.sessions.mockResolvedValue(
    sessionsPage([session({ candidates: [], links: [confirmedLink] })])
  );
  api.history
    .mockResolvedValueOnce({
      items: [
        { id: 'h1', changed_at: '2026-10-08T03:00:00Z', status: 'confirmed', revision: null },
      ],
      next: 'history-2',
    })
    .mockResolvedValue({ items: [], next: null });
  view();
  const replace = await screen.findByRole('button', { name: 'Replace with selected PR' });
  invokeClick(replace);
  expect(api.replace).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Confirm selected PR' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Link history' }));
  expect(await screen.findByText(/revision legacy unavailable/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next history page' }));
  await waitFor(() => expect(api.history).toHaveBeenCalledWith('org', 'link-a', 'history-2'));
  invokeClick(await screen.findByRole('button', { name: 'Next history page' }));
});

it('shows your receipt and Issue relations, pages them and closes them on failure', async () => {
  api.sessions.mockResolvedValue(
    sessionsPage([session({ candidates: [], links: [confirmedLink] })])
  );
  api.receipt
    .mockResolvedValueOnce({
      estimated_cost_microusd: { value: null, reason: null, status: 'partial' },
      sharing: 'individual',
      cost_until: null,
      calculation_version: 'merged_pr_cost_v1',
      sessions: [],
      next: 'receipt-2',
    })
    .mockResolvedValueOnce({
      estimated_cost_microusd: { value: null, reason: 'unknown_price', status: 'partial' },
      sharing: 'individual',
      cost_until: null,
      calculation_version: 'merged_pr_cost_v1',
      sessions: [
        {
          link_id: 's3',
          allocation: 'full',
          cost_microusd: { value: null, reason: 'unknown_price' },
        },
      ],
      next: null,
    });
  api.relations
    .mockResolvedValueOnce({ coverage: 'observed', next: 'relations-2', items: [] })
    .mockResolvedValueOnce({
      coverage: 'observed',
      next: null,
      items: [
        {
          event_id: 'e1',
          relationship: 'closes',
          action: 'added',
          source_at: '2026-10-08T02:00:00Z',
          observed_at: '2026-10-08T02:05:00Z',
          url: 'https://github.com/acme/app/issues/3',
        },
        {
          event_id: 'e2',
          relationship: 'references',
          action: 'added',
          source_at: null,
          observed_at: '2026-10-08T02:06:00Z',
          url: null,
        },
      ],
    })
    .mockRejectedValue(new Error('gone'));
  const page = view();
  fireEvent.click(await screen.findByRole('button', { name: 'Your receipt and Issue relations' }));
  expect(await screen.findByText(/Your estimated AI cost: unavailable/)).toBeInTheDocument();
  expect(screen.getByText(/Usage cutoff: PR not merged/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next receipt page' }));
  expect(await screen.findByText(/Your estimated AI cost: unknown_price/)).toBeInTheDocument();
  expect(screen.getByText(/full · unknown_price/)).toBeInTheDocument();
  invokeClick(screen.getByRole('button', { name: 'Next receipt page' }));

  fireEvent.click(await screen.findByRole('button', { name: 'Next relationship page' }));
  expect(await screen.findByRole('link', { name: 'Related Issue' })).toBeInTheDocument();
  expect(screen.getByText(/references · added · Event: unavailable/)).toBeInTheDocument();
  invokeClick(screen.getByRole('button', { name: 'Next relationship page' }));

  api.receipt.mockRejectedValueOnce(new Error('revoked'));
  await act(async () => {
    await page.client.invalidateQueries({ queryKey: wakaclockKeys.teamGithub('member-a', 'org') });
  });
  await waitFor(() => expect(screen.queryByText(/Your estimated AI cost/)).toBeNull());
  expect(screen.queryByRole('link', { name: 'Related Issue' })).toBeNull();
});

it('shows a priced receipt with its merge cutoff', async () => {
  api.sessions.mockResolvedValue(
    sessionsPage([session({ candidates: [], links: [confirmedLink] })])
  );
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Your receipt and Issue relations' }));
  expect(await screen.findByText(/Your estimated AI cost: \$2.000000/)).toBeInTheDocument();
  expect(screen.getByText(/Usage cutoff: 2026-10-09T00:00:00Z/)).toBeInTheDocument();
  expect(screen.getByText(/full · \$0.500000/)).toBeInTheDocument();
  expect(screen.getByText(/shared · unavailable/)).toBeInTheDocument();
});

it('drops a decision whose proposal returns after the account changed', async () => {
  let finish!: (value: unknown) => void;
  api.propose.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  const page = view();
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm candidate PR #7' }));
  await waitFor(() => expect(api.propose).toHaveBeenCalledTimes(1));
  api.user = 'member-b';
  page.rerender(page.tree());
  await act(async () => {
    finish({ id: 'link-late', revision: 1 });
  });
  expect(api.decide).not.toHaveBeenCalled();
});
