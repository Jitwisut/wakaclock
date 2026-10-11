import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { SessionRepositoryBinding } from '@/app/dashboard/(auth)/wakaclock/teams/components/session-repository-binding';
import * as github from '@/lib/wakaclock/github-endpoints';
const identity = vi.hoisted(() => ({ userId: 'owner' }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (s: { userId: string }) => unknown) => select(identity),
}));
vi.mock('@/lib/wakaclock/github-endpoints', () => ({
  getSessionRepositoryBinding: vi.fn(),
  getGithubProjects: vi.fn(),
  setSessionRepositoryBinding: vi.fn(),
}));
const current = {
  session_id: 'session',
  repository_id: 'repo',
  revision: 1,
  request_id: 'original',
  effective_at: '2026-10-12T00:00:00Z',
  provenance: 'user_confirmed' as const,
  status: 'active' as const,
};
beforeEach(() => {
  identity.userId = 'owner';
  vi.mocked(github.getSessionRepositoryBinding).mockResolvedValue({
    current,
    revision: 1,
    history: [current],
    next: null,
  });
  vi.mocked(github.getGithubProjects).mockResolvedValue({
    projects: [],
    repositories: [{ full_name: 'fixture/private', repository_id: 'repo' }],
  });
  vi.mocked(github.setSessionRepositoryBinding).mockResolvedValue({ ...current, revision: 2 });
});
function setup() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    cache,
    view: render(
      <QueryClientProvider client={cache}>
        <SessionRepositoryBinding organizationId="org" sessionId="session" />
      </QueryClientProvider>
    ),
  };
}
it('confirms and removes with canonical session, revision and an idempotency key, keeping provenance visible', async () => {
  setup();
  fireEvent.click(screen.getByText('Repository confirmation'));
  await screen.findByText('fixture/private');
  fireEvent.change(screen.getByLabelText('Repository for this session'), {
    target: { value: 'repo' },
  });
  fireEvent.click(screen.getByText('Confirm repository'));
  await waitFor(() => expect(github.setSessionRepositoryBinding).toHaveBeenCalledTimes(1));
  expect(vi.mocked(github.setSessionRepositoryBinding).mock.calls[0]).toEqual([
    'org',
    expect.objectContaining({
      session_id: 'session',
      repository_id: 'repo',
      expected_revision: 1,
      request_id: expect.stringMatching(/^[a-f0-9-]{36}$/),
    }),
  ]);
  await waitFor(() => expect(screen.getByText('Remove repository confirmation')).toBeEnabled());
  fireEvent.click(screen.getByText('Remove repository confirmation'));
  await waitFor(() => expect(github.setSessionRepositoryBinding).toHaveBeenCalledTimes(2));
  expect(vi.mocked(github.setSessionRepositoryBinding).mock.calls[1][1].repository_id).toBeNull();
  expect(screen.getByText(/Historical branch\/commit/)).toBeInTheDocument();
});
it('hides old data immediately on account switch and failed reload', async () => {
  const { view, cache } = setup();
  fireEvent.click(screen.getByText('Repository confirmation'));
  await screen.findByText('fixture/private');
  identity.userId = 'other';
  vi.mocked(github.getSessionRepositoryBinding).mockRejectedValue(new Error('Permission changed'));
  view.rerender(
    <QueryClientProvider client={cache}>
      <SessionRepositoryBinding organizationId="org" sessionId="session" />
    </QueryClientProvider>
  );
  expect(screen.queryByText('fixture/private')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Repository confirmation'));
  await waitFor(() =>
    expect(screen.queryByLabelText('Repository for this session')).not.toBeInTheDocument()
  );
  expect(github.setSessionRepositoryBinding).not.toHaveBeenCalled();
});

it('hides repository/history while consent changes and after a permission reload fails', async () => {
  const { cache } = setup();
  fireEvent.click(screen.getByText('Repository confirmation'));
  await screen.findByText('fixture/private');
  let finish!: () => void;
  const mutation = cache.getMutationCache().build(cache, {
    mutationKey: ['team-sharing', 'owner', 'org'],
    mutationFn: () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  });
  let pending!: Promise<void>;
  act(() => {
    pending = mutation.execute(undefined);
  });
  await waitFor(() => expect(screen.queryByText('fixture/private')).not.toBeInTheDocument());
  expect(screen.queryByLabelText('Repository confirmation history')).not.toBeInTheDocument();
  vi.mocked(github.getSessionRepositoryBinding).mockRejectedValue(new Error('Consent withdrawn'));
  await act(async () => {
    finish();
    await pending;
    await cache.invalidateQueries({ queryKey: ['wakaclock', 'team-github', 'owner', 'org'] });
  });
  await waitFor(() => expect(screen.queryByText('fixture/private')).not.toBeInTheDocument());
});
