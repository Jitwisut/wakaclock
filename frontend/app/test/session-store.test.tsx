import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WakaclockUserProvider, useWakaclockUserStore } from '@/lib/wakaclock/user-store';
import { getCurrentToken, notifyUnauthorized } from '@/lib/wakaclock/session';
function token(payload: unknown) {
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}
const session = { userId: 'owner', username: 'Ada', token: token({ exp: 9999999999 }) };
function Probe() {
  const state = useWakaclockUserStore((s) => s);
  return (
    <>
      <p>{state.hydrated ? (state.username ?? 'Signed out') : 'Hydrating'}</p>
      <button onClick={() => state.setSession(session)}>Sign in</button>
      <button onClick={state.logout}>Sign out</button>
    </>
  );
}
function mount() {
  return render(
    <WakaclockUserProvider>
      <Probe />
    </WakaclockUserProvider>
  );
}
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
it('hydrates a valid session, mirrors its token and clears both persistence and token on logout or rejection', () => {
  localStorage.setItem('wakaclock-session', JSON.stringify(session));
  mount();
  expect(screen.getByText('Ada')).toBeVisible();
  expect(getCurrentToken()).toBe(session.token);
  fireEvent.click(screen.getByText('Sign out'));
  expect(screen.getByText('Signed out')).toBeVisible();
  expect(getCurrentToken()).toBeNull();
  expect(JSON.parse(localStorage.getItem('wakaclock-session')!)).toMatchObject({ token: null });
  fireEvent.click(screen.getByText('Sign in'));
  expect(getCurrentToken()).toBe(session.token);
  act(() => notifyUnauthorized());
  expect(screen.getByText('Signed out')).toBeVisible();
});
it.each(['plain', 'head.%%%.signature', token({}), token({ exp: 1 }), token({ exp: 'future' })])(
  'does not hydrate an expired or malformed token: %s',
  (invalid) => {
    localStorage.setItem('wakaclock-session', JSON.stringify({ ...session, token: invalid }));
    mount();
    expect(screen.getByText('Signed out')).toBeVisible();
    expect(getCurrentToken()).toBeNull();
  }
);
it.each([
  '{bad json',
  'null',
  JSON.stringify({ userId: 'owner' }),
  JSON.stringify({ ...session, username: '' }),
])('recovers from invalid persisted state: %s', (raw) => {
  localStorage.setItem('wakaclock-session', raw);
  mount();
  expect(screen.getByText('Signed out')).toBeVisible();
});
it('keeps an in-memory session usable when browser persistence is denied', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage denied');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage denied');
  });
  mount();
  expect(screen.getByText('Signed out')).toBeVisible();
  fireEvent.click(screen.getByText('Sign in'));
  expect(screen.getByText('Ada')).toBeVisible();
  expect(getCurrentToken()).toBe(session.token);
});
it('requires a provider instead of silently exposing a shared anonymous store', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => render(<Probe />)).toThrow(
    'useWakaclockUserStore must be used within a WakaclockUserProvider'
  );
  error.mockRestore();
});
