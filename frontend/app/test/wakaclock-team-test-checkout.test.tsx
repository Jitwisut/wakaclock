import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TeamTestCheckoutConfirmation } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-test-checkout-confirmation';
import { WakaclockError } from '@/lib/wakaclock/client';
import type { TeamPriceQuote } from '@/lib/wakaclock/team-billing-endpoints';
const send = vi.hoisted(() => vi.fn());
vi.mock('@/lib/wakaclock/team-billing-endpoints', () => ({ confirmTeamTestCheckout: send }));
const quote = (): TeamPriceQuote => ({
  id: 'q1',
  package_seats: 10,
  currency: 'usd',
  amount_minor: '2500',
  tax_behavior: 'exclusive',
  catalog_revision: '1',
  catalog_sha256: 'hash',
  observed_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 600000).toISOString(),
  interval: 'month',
  quantity: 1,
  total_due_minor: null,
  checkout_available: false,
  test_checkout_confirmation_available: true,
});
beforeEach(() => {
  send
    .mockReset()
    .mockResolvedValue({ quote_id: 'q1', operation_id: 'op1', payment_verified: false });
});
function mount(q = quote()) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = (org = 'org', user = 'owner', value = q) => (
    <QueryClientProvider client={cache}>
      <TeamTestCheckoutConfirmation organizationId={org} userId={user} quote={value} />
    </QueryClientProvider>
  );
  return { ...render(view()), view };
}
it('does not offer checkout without the additive server capability', () => {
  mount({ ...quote(), test_checkout_confirmation_available: undefined });
  expect(screen.queryByText('Prepare test Checkout')).not.toBeInTheDocument();
  expect(send).not.toHaveBeenCalled();
});
it('requires confirmation and reports only the durable test request', async () => {
  mount();
  expect(screen.getByText('Prepare test Checkout')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Confirm test package'));
  fireEvent.click(screen.getByText('Prepare test Checkout'));
  await screen.findByText(/Test request saved/);
  expect(send).toHaveBeenCalledWith('org', 'q1');
  expect(screen.getByText(/Payment remains unconfirmed/)).toBeInTheDocument();
});
it('retries the same quote after response loss', async () => {
  send.mockRejectedValueOnce(new WakaclockError('network unavailable', 503));
  mount();
  fireEvent.click(screen.getByLabelText('Confirm test package'));
  fireEvent.click(screen.getByText('Prepare test Checkout'));
  fireEvent.click(await screen.findByText('Retry same test request'));
  await screen.findByText(/Test request saved/);
  expect(send.mock.calls.map((args) => args.slice(0, 2))).toEqual([
    ['org', 'q1'],
    ['org', 'q1'],
  ]);
});
it('clears confirmation when account, organization or quote changes', () => {
  const v = mount();
  fireEvent.click(screen.getByLabelText('Confirm test package'));
  v.rerender(v.view('other'));
  expect(screen.getByLabelText('Confirm test package')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('Confirm test package'));
  v.rerender(v.view('other', 'another-owner'));
  expect(screen.getByLabelText('Confirm test package')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('Confirm test package'));
  v.rerender(v.view('other', 'another-owner', { ...quote(), id: 'q2' }));
  expect(screen.getByLabelText('Confirm test package')).not.toBeChecked();
});
it('rejects expired quotes and clears confirmation after access loss', async () => {
  const v = mount({ ...quote(), expires_at: '2020-01-01T00:00:00Z' });
  fireEvent.click(screen.getByLabelText('Confirm test package'));
  expect(screen.getByText('Prepare test Checkout')).toBeDisabled();
  v.rerender(v.view('org', 'owner', { ...quote(), id: 'q2' }));
  send.mockRejectedValue(new WakaclockError('billing owner required', 403));
  fireEvent.click(screen.getByLabelText('Confirm test package'));
  fireEvent.click(screen.getByText('Prepare test Checkout'));
  await screen.findByText('billing owner required');
  await waitFor(() => expect(screen.getByLabelText('Confirm test package')).not.toBeChecked());
});
