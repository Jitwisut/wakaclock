import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import GithubCallbackPage from '@/app/dashboard/(auth)/wakaclock/teams/github/callback/page';
const state = vi.hoisted(() => ({ user: 'member-a', finish: vi.fn() }));
vi.mock('@/lib/wakaclock/github-endpoints', () => ({ finishGithubAuthorization: state.finish }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (s: { userId: string }) => unknown) =>
    selector({ userId: state.user }),
}));
beforeEach(() => {
  state.user = 'member-a';
  window.history.replaceState(
    null,
    '',
    '/dashboard/wakaclock/teams/github/callback?state=one-use&code=private-code'
  );
});
it('exchanges a single-use callback once under Strict Mode and removes code from URL', async () => {
  state.finish.mockResolvedValue({ login: 'verified' });
  render(
    <React.StrictMode>
      <GithubCallbackPage />
    </React.StrictMode>
  );
  expect(await screen.findByText(/GitHub identity verified/)).toBeInTheDocument();
  expect(state.finish).toHaveBeenCalledTimes(1);
  expect(window.location.search).toBe('');
});
it('does not attach an in-flight authorization result to a different account', async () => {
  let finish!: (value: unknown) => void;
  state.finish.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const view = render(<GithubCallbackPage />);
  state.user = 'member-b';
  view.rerender(<GithubCallbackPage />);
  await act(async () => {
    finish({});
  });
  expect(screen.getByText(/Account changed during authorization/)).toBeInTheDocument();
  expect(screen.queryByText(/GitHub identity verified/)).not.toBeInTheDocument();
  expect(state.finish).toHaveBeenCalledTimes(1);
});
