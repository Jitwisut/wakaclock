import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TeamCheckoutStatusPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-checkout-status-panel';
import { WakaclockError } from '@/lib/wakaclock/client';
const mocks = vi.hoisted(() => ({ get: vi.fn(), recover: vi.fn(), destination: vi.fn() }));
vi.mock('@/lib/wakaclock/team-billing-endpoints', () => ({
  getTeamCheckout: mocks.get,
  recoverTeamCheckout: mocks.recover,
  getTeamCheckoutDestination: mocks.destination,
}));
const pending = {
  operation_id: 'op-1',
  quote_id: 'quote-1',
  revision: 2,
  disposition: 'recovery_required',
  last_error_code: 'checkout_not_found_unconfirmed',
  observed_at: null,
  retry_at: '2026-10-15T00:00:00Z',
  lookup_only: false,
  checkout_available: false,
  payment_verified: false,
};
beforeEach(() => {
  mocks.get.mockReset().mockResolvedValue(pending);
  mocks.recover.mockReset().mockResolvedValue(undefined);
});
function mount() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = (org = 'org', user = 'owner') => (
    <QueryClientProvider client={cache}>
      <TeamCheckoutStatusPanel organizationId={org} userId={user} />
    </QueryClientProvider>
  );
  return { ...render(view()), view };
}
it('loads deliberately and never turns a bound subscription into payment', async () => {
  mocks.get.mockResolvedValue({ ...pending, disposition: 'bound' });
  mount();
  expect(mocks.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Existing Checkout (Owner)'));
  await screen.findByText(/Subscription identity linked/);
  expect(screen.getByText(/This does not confirm payment or paid access/)).toBeInTheDocument();
  expect(screen.queryByText('Check existing Checkout')).not.toBeInTheDocument();
});
it('requires confirmation tied to the current operation and revision', async () => {
  mount();
  fireEvent.click(screen.getByText('Existing Checkout (Owner)'));
  const button = await screen.findByText('Check existing Checkout');
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Confirm existing Checkout recovery'));
  mocks.get.mockResolvedValue({
    ...pending,
    revision: 3,
    disposition: 'pending',
    lookup_only: true,
  });
  fireEvent.click(button);
  await waitFor(() => expect(mocks.recover).toHaveBeenCalledWith('org', 'op-1', 2));
  await screen.findByText(/Read-only recovery/);
  expect(screen.queryByText('Check existing Checkout')).not.toBeInTheDocument();
});
it('hides old data on conflict and requires fresh confirmation', async () => {
  mocks.recover.mockRejectedValue(new WakaclockError('checkout changed; reload', 409));
  mount();
  fireEvent.click(screen.getByText('Existing Checkout (Owner)'));
  fireEvent.click(await screen.findByLabelText('Confirm existing Checkout recovery'));
  fireEvent.click(screen.getByText('Check existing Checkout'));
  await screen.findByText('checkout changed; reload');
  expect(screen.queryByText('Checkout status: recovery_required')).not.toBeInTheDocument();
  mocks.get.mockResolvedValue({ ...pending, revision: 4 });
  fireEvent.click(screen.getByText('Reload Checkout status'));
  expect(await screen.findByLabelText('Confirm existing Checkout recovery')).not.toBeChecked();
});
it('clears the old account and organization even while requests are pending', async () => {
  const v = mount();
  fireEvent.click(screen.getByText('Existing Checkout (Owner)'));
  fireEvent.click(await screen.findByLabelText('Confirm existing Checkout recovery'));
  v.rerender(v.view('other-org'));
  expect(screen.queryByText('Check existing Checkout')).not.toBeInTheDocument();
  mocks.get.mockImplementation(() => new Promise(() => {}));
  fireEvent.click(screen.getByText('Existing Checkout (Owner)'));
  v.rerender(v.view('other-org', 'other-owner'));
  expect(screen.getByText('Existing Checkout (Owner)')).toBeInTheDocument();
  expect(screen.queryByText('Checkout status: recovery_required')).not.toBeInTheDocument();
  expect(mocks.recover).not.toHaveBeenCalled();
});
it('hides cached results after permission loss and distinguishes no record', async () => {
  mocks.get.mockResolvedValueOnce(null).mockResolvedValue(pending);
  mount();
  fireEvent.click(screen.getByText('Existing Checkout (Owner)'));
  await screen.findByText(/No existing purchase request/);
  fireEvent.click(screen.getByText('Reload Checkout status'));
  await screen.findByText('Check existing Checkout');
  mocks.get.mockRejectedValue(new WakaclockError('billing owner required', 403));
  fireEvent.click(screen.getByText('Reload Checkout status'));
  await screen.findByText('billing owner required');
  expect(screen.queryByText('Check existing Checkout')).not.toBeInTheDocument();
});

it('offers the fresh hosted link only for an open session with server capability', async () => {
  mocks.get.mockResolvedValue({
    ...pending,
    disposition: 'session_open',
    test_checkout_destination_available: true,
  });
  mocks.destination.mockResolvedValue({
    operation_id: 'op-1',
    url: 'https://checkout.stripe.com/c/pay/cs_test_fixture#opaque',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    observed_at: new Date().toISOString(),
  });
  mount();
  fireEvent.click(screen.getByText('Existing Checkout (Owner)'));
  fireEvent.click(await screen.findByText('Get test Checkout link'));
  expect(await screen.findByRole('link', { name: 'Open Stripe test Checkout' })).toHaveAttribute(
    'target',
    '_blank'
  );
  expect(mocks.destination).toHaveBeenCalledWith('org', 'op-1', 2);
});

it('displays fresh test invoice evidence but removes it when reloading loses permission', async () => {
  const now=Date.now();
  mocks.get.mockResolvedValue({...pending,disposition:'bound',invoice_assessment:{
    state:'settled',reason:'matching_invoice_coverage',calculation_version:1,livemode:false,
    observed_at:new Date(now-1000).toISOString(),valid_until:new Date(now+290000).toISOString(),
    covered_until:new Date(now+86400000).toISOString(),package_seats:10,access_granted:false,
  }});
  mount(); fireEvent.click(screen.getByText('Existing Checkout (Owner)'));
  await screen.findByText('Invoice coverage: settled');
  expect(screen.getByText('Billing mode: test')).toBeInTheDocument();
  expect(screen.getByText(/Paid access has not been activated/)).toBeInTheDocument();
  mocks.get.mockRejectedValue(new WakaclockError('Owner access required',403));
  fireEvent.click(screen.getByText('Reload Checkout status'));
  await screen.findByText('Owner access required');
  expect(screen.queryByText('Invoice coverage: settled')).not.toBeInTheDocument();
});
