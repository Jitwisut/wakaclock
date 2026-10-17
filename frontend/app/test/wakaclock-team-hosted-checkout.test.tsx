import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TeamHostedCheckoutLink } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-hosted-checkout-link';
import { WakaclockError } from '@/lib/wakaclock/client';
const get = vi.hoisted(() => vi.fn());
vi.mock('@/lib/wakaclock/team-billing-endpoints', () => ({ getTeamCheckoutDestination: get }));
const response = () => ({
  operation_id: 'op',
  url: 'https://checkout.stripe.com/c/pay/cs_test_fixture#opaque',
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  observed_at: new Date().toISOString(),
});
beforeEach(() => {
  get.mockReset().mockImplementation(async () => response());
});
afterEach(() => vi.restoreAllMocks());
function mount() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = (org = 'org', user = 'owner', revision = 1) => (
    <QueryClientProvider client={cache}>
      <TeamHostedCheckoutLink
        organizationId={org}
        userId={user}
        operation="op"
        revision={revision}
      />
    </QueryClientProvider>
  );
  return { ...render(view()), view };
}
it('requests a fresh link only on click and prevents referrer/opener sharing', async () => {
  mount();
  expect(get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Get test Checkout link'));
  const link = await screen.findByRole('link');
  expect(link).toHaveAttribute('href', response().url);
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(get).toHaveBeenCalledWith('org', 'op', 1);
});
it('rejects untrusted URLs, other operations and expired sessions', async () => {
  const v = mount();
  for (const bad of [
    { url: 'https://checkout.stripe.com.evil.test/c/pay/cs_test_fixture' },
    { operation_id: 'other' },
    { expires_at: '2020-01-01T00:00:00Z' },
    { url: 'https://checkout.stripe.com/c/pay/cs_test_fixture?redirect=evil' },
  ]) {
    get.mockResolvedValue({ ...response(), ...bad });
    fireEvent.click(screen.getByText('Get test Checkout link'));
    await screen.findByText('Checkout destination unavailable; reload status');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  }
  v.unmount();
});
it('clears links on new revision, account or organization', async () => {
  const v = mount();
  fireEvent.click(screen.getByText('Get test Checkout link'));
  await screen.findByRole('link');
  v.rerender(v.view('org', 'owner', 2));
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Get test Checkout link'));
  await screen.findByRole('link');
  v.rerender(v.view('other', 'another', 2));
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('hides a previous link after permission failure and ignores late results for old scope', async () => {
  const v = mount();
  fireEvent.click(screen.getByText('Get test Checkout link'));
  await screen.findByRole('link');
  get.mockRejectedValue(new WakaclockError('billing owner required', 403));
  fireEvent.click(screen.getByText('Get test Checkout link'));
  await screen.findByText('billing owner required');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  get.mockImplementation(() => new Promise(() => {}));
  fireEvent.click(screen.getByText('Get test Checkout link'));
  v.rerender(v.view('other'));
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('removes the ephemeral link after 30 seconds even if provider expiry is later', async () => {
  mount();
  fireEvent.click(screen.getByText('Get test Checkout link'));
  await screen.findByRole('link');
  const later = Date.now() + 31000;
  vi.spyOn(Date, 'now').mockReturnValue(later);
  await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument(), {
    timeout: 2000,
  });
});
