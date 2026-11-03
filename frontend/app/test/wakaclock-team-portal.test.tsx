import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TeamPortalLink } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-portal-link';
import { WakaclockError } from '@/lib/wakaclock/client';
import { isTeamPortalUrl, type TeamPortalDestination } from '@/lib/wakaclock/team-portal-endpoints';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/wakaclock/team-portal-endpoints', async (original) => ({
  ...(await original<typeof import('@/lib/wakaclock/team-portal-endpoints')>()),
  getTeamPortalDestination: mocks.get,
}));
function sample(request: string): TeamPortalDestination {
  const at = Date.now();
  return {
    request_id: request,
    url: 'https://billing.stripe.com/p/session/fixture_token',
    observed_at: new Date(at).toISOString(),
    display_until: new Date(at + 30_000).toISOString(),
    provider_expires_at: null,
    purposes: ['invoice_history', 'payment_method_update'],
    payment_or_access_confirmed: false,
  };
}
beforeEach(() => {
  mocks.get
    .mockReset()
    .mockImplementation(async (_org: string, request: string) => sample(request));
});
afterEach(() => vi.useRealTimers());
function mount(onAccessLost = vi.fn()) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false, gcTime: 0 } },
  });
  const view = (org = 'org', user = 'owner', customer: string | undefined = 'operation:1') => (
    <QueryClientProvider client={cache}>
      <TeamPortalLink
        organizationId={org}
        userId={user}
        customer={customer}
        onAccessLost={onAccessLost}
      />
    </QueryClientProvider>
  );
  return { ...render(view()), view, cache, onAccessLost };
}
it('only requests a destination after explicit action and prevents opener/referrer disclosure', async () => {
  mount();
  expect(mocks.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Get billing portal link'));
  const link = await screen.findByRole('link', { name: 'Open Stripe billing portal' });
  expect(mocks.get).toHaveBeenCalledTimes(1);
  expect(link).toHaveAttribute('href', 'https://billing.stripe.com/p/session/fixture_token');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(screen.getByText(/does not confirm payment or analytics access/)).toBeInTheDocument();
});
it.each([
  { url: 'https://evil.example' },
  { request_id: 'another-request' },
  { payment_or_access_confirmed: true },
  { provider_expires_at: '2026-10-27T00:00:00Z' },
  { purposes: ['subscription_cancel'] },
  { purposes: [] },
  { observed_at: 'unknown' },
  { display_until: '2000-01-01T00:00:00Z' },
])('does not show an unconfirmed provider response %j', async (changed) => {
  mocks.get.mockImplementation(async (_org: string, request: string) => ({
    ...sample(request),
    ...changed,
  }));
  mount();
  fireEvent.click(screen.getByText('Get billing portal link'));
  await screen.findByText('Portal destination unavailable; reload billing status');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('uses the same request identity for an immediate retry after an unknown outcome', async () => {
  mocks.get.mockRejectedValueOnce(new WakaclockError('response lost', null));
  mount();
  fireEvent.click(screen.getByText('Get billing portal link'));
  await screen.findByText('response lost');
  const first = mocks.get.mock.calls[0][1];
  fireEvent.click(screen.getByText('Retry portal check'));
  await screen.findByRole('link');
  expect(mocks.get.mock.calls[1][1]).toBe(first);
});
it('reports revoked Owner access without an automatic retry or leaked destination', async () => {
  mocks.get.mockRejectedValueOnce(new WakaclockError('billing owner required', 403));
  const { onAccessLost } = mount();
  fireEvent.click(screen.getByText('Get billing portal link'));
  await waitFor(() => expect(onAccessLost).toHaveBeenCalledTimes(1));
  expect(mocks.get).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  const first = mocks.get.mock.calls[0][1];
  fireEvent.click(screen.getByText('Retry portal check'));
  await screen.findByRole('link');
  expect(mocks.get.mock.calls[1][1]).not.toBe(first);
});
it('never renders an old in-flight destination into a different account, org or customer', async () => {
  let finish!: (result: TeamPortalDestination) => void;
  mocks.get.mockImplementationOnce(
    () =>
      new Promise<TeamPortalDestination>((resolve) => {
        finish = resolve;
      })
  );
  const { rerender, view } = mount();
  fireEvent.click(screen.getByText('Get billing portal link'));
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
  const first = mocks.get.mock.calls[0][1];
  rerender(view('another-org', 'another-owner', 'another-operation:2'));
  await act(async () => finish(sample(first)));
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(mocks.get).toHaveBeenCalledTimes(1);
});
it('removes a destination when the verified customer is no longer present', async () => {
  const { rerender, view } = mount();
  fireEvent.click(screen.getByText('Get billing portal link'));
  await screen.findByRole('link');
  // Empty proof unmounts the entire customer scope; no cached URL is retained.
  rerender(view('org', 'owner', ''));
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('hides the link when the local display window expires without claiming provider revocation', async () => {
  const { cache } = mount();
  fireEvent.click(screen.getByText('Get billing portal link'));
  await screen.findByRole('link');
  // The interval was registered with real timers: mock wall time, and let one
  // observation tick see the expiration instead of sleeping for thirty seconds.
  const observed = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(observed + 31_000);
  await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument(), {
    timeout: 2000,
  });
  expect(screen.getByText(/does not revoke a link already copied/)).toBeInTheDocument();
  clock.mockRestore();
  cache.clear();
});
it('accepts both provider URL forms and rejects alternate origins and extra fields', () => {
  for (const url of [
    'https://billing.stripe.com/p/session/a_B',
    'https://billing.stripe.com/p/session?secret=a_B',
  ]) {
    expect(isTeamPortalUrl(url)).toBe(true);
  }
  for (const url of [
    'http://billing.stripe.com/p/session/a',
    'https://billing.stripe.com.evil.example/p/session/a',
    'https://owner@billing.stripe.com/p/session/a',
    'https://billing.stripe.com/p/session/a#fragment',
    'https://billing.stripe.com/p/session?secret=a&secret=b',
    'https://billing.stripe.com/p/session/a?redirect=1',
    'https://billing.stripe.com/p/session?secret=a%2Fb',
  ]) {
    expect(isTeamPortalUrl(url)).toBe(false);
  }
});
