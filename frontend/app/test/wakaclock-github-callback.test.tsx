import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import GithubCallbackPage from '@/app/dashboard/(auth)/wakaclock/teams/github/callback/page';
const state = vi.hoisted(() => ({ user: 'member-a' as null | string, finish: vi.fn() }));
vi.mock('@/lib/wakaclock/github-endpoints', () => ({ finishGithubAuthorization: state.finish }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (s: { userId: null | string }) => unknown) =>
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
it('asks to start again when the callback arrives without its state or code', () => {
  window.history.replaceState(null, '', '/dashboard/wakaclock/teams/github/callback');
  render(<GithubCallbackPage />);
  expect(screen.getByRole('status')).toHaveTextContent('Authorization callback incomplete');
  expect(state.finish).not.toHaveBeenCalled();
});
it('waits for the signed-in account before exchanging the code', () => {
  state.user = null;
  render(<GithubCallbackPage />);
  expect(screen.getByRole('status')).toHaveTextContent('Sign in with the AtoAxis account');
  expect(state.finish).not.toHaveBeenCalled();
});
it('reports a failed verification, and ignores one that lands after leaving the page', async () => {
  state.finish.mockRejectedValueOnce(new Error('denied'));
  const first = render(<GithubCallbackPage />);
  expect(await screen.findByText(/Authorization could not be verified/)).toBeInTheDocument();
  first.unmount();

  let reject!: (reason: unknown) => void;
  state.finish.mockReturnValueOnce(
    new Promise((_, fail) => {
      reject = fail;
    })
  );
  // The first visit stripped the code from the URL; a second callback brings a fresh one.
  window.history.replaceState(
    null,
    '',
    '/dashboard/wakaclock/teams/github/callback?state=two-use&code=private-code'
  );
  const second = render(<GithubCallbackPage />);
  expect(state.finish).toHaveBeenCalledTimes(2);
  second.unmount();
  await act(async () => {
    reject(new Error('late'));
  });
  expect(screen.queryByText(/Authorization could not be verified/)).not.toBeInTheDocument();
});
