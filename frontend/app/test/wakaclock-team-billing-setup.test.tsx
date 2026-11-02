import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { TeamBillingSetupPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-billing-setup-panel';
import { WakaclockError } from '@/lib/wakaclock/client';

const mocks = vi.hoisted(() => ({
  user: 'owner',
  get: vi.fn(),
  prepare: vi.fn(),
  recover: vi.fn(),
  quote: vi.fn(),
  readQuote: vi.fn(),
  checkout: vi.fn(),
  checkoutRecover: vi.fn(),
  destination: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (f: (s: { userId: string }) => unknown) => f({ userId: mocks.user }),
}));
vi.mock('@/lib/wakaclock/team-billing-endpoints', () => ({
  getTeamCustomer: mocks.get,
  prepareTeamCustomer: mocks.prepare,
  recoverTeamCustomer: mocks.recover,
  createTeamPriceQuote: mocks.quote,
  getTeamPriceQuote: mocks.readQuote,
  getTeamCheckout: mocks.checkout,
  recoverTeamCheckout: mocks.checkoutRecover,
  getTeamCheckoutDestination: mocks.destination,
  confirmTeamTestCheckout: mocks.confirm,
}));
const pending = {
  operation_id: 'op-1',
  revision: 2,
  disposition: 'recovery_required',
  last_error_code: 'idempotency_window_unconfirmed',
  observed_at: null,
  retry_at: '2026-10-14T00:00:00Z',
  lookup_only: false,
};
beforeEach(() => {
  mocks.user = 'owner';
  mocks.get.mockReset().mockResolvedValue(pending);
  mocks.prepare.mockReset().mockResolvedValue(null);
  mocks.recover.mockReset().mockResolvedValue(undefined);
  mocks.checkout.mockReset().mockResolvedValue({
    operation_id: 'checkout-1',
    quote_id: 'quote-1',
    revision: 2,
    disposition: 'recovery_required',
    last_error_code: 'checkout_not_found_unconfirmed',
    observed_at: null,
    retry_at: '2026-10-27T00:00:00Z',
    lookup_only: true,
    checkout_available: false,
    payment_verified: false,
  });
  mocks.checkoutRecover.mockReset().mockResolvedValue(undefined);
  mocks.destination.mockReset().mockResolvedValue({
    operation_id: 'checkout-1',
    url: 'https://checkout.stripe.com/c/pay/cs_test_fixture#opaque',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    observed_at: new Date().toISOString(),
  });
  const quote = {
    id: 'quote-1',
    amount_minor: '1000',
    currency: 'usd',
    package_seats: 10,
    observed_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 600000).toISOString(),
    tax_behavior: 'exclusive',
    total_due_minor: null,
    checkout_available: false,
    test_checkout_confirmation_available: true,
  };
  mocks.quote.mockReset().mockResolvedValue(quote);
  mocks.readQuote.mockReset().mockResolvedValue(quote);
  mocks.confirm
    .mockReset()
    .mockResolvedValue({ quote_id: quote.id, operation_id: 'checkout-1', payment_verified: false });
});
function mount() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = (org = 'org') => (
    <QueryClientProvider client={cache}>
      <TeamBillingSetupPanel organizationId={org} />
    </QueryClientProvider>
  );
  return { ...render(view()), view, cache };
}
it('requires deliberate setup and never treats customer verification as paid access', async () => {
  mocks.get
    .mockResolvedValueOnce(null)
    .mockResolvedValue({ ...pending, disposition: 'verified', last_error_code: null });
  mount();
  expect(mocks.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Billing setup (Owner)'));
  fireEvent.click(await screen.findByText('Prepare billing customer'));
  await screen.findByText(/Customer creation verified/);
  expect(mocks.prepare).toHaveBeenCalledWith('org');
  expect(screen.getByText(/Checkout and paid access remain unavailable/)).toBeInTheDocument();
  expect(mocks.recover).not.toHaveBeenCalled();
});
it('requires confirmation bound to the shown operation and revision', async () => {
  mount();
  fireEvent.click(screen.getByText('Billing setup (Owner)'));
  const recover = await screen.findByText('Check existing customer');
  expect(recover).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Confirm existing customer recovery'));
  mocks.get.mockResolvedValue({
    ...pending,
    revision: 3,
    disposition: 'pending',
    lookup_only: true,
  });
  fireEvent.click(recover);
  await waitFor(() => expect(mocks.recover).toHaveBeenCalledWith('org', 'op-1', 2));
  await screen.findByText(/Checking the existing customer/);
  expect(mocks.prepare).not.toHaveBeenCalled();
});
it('hides stale state on a rejected recovery and requires a new confirmation after reload', async () => {
  mocks.recover.mockRejectedValue(new WakaclockError('changed; reload', 409));
  mount();
  fireEvent.click(screen.getByText('Billing setup (Owner)'));
  fireEvent.click(await screen.findByLabelText('Confirm existing customer recovery'));
  fireEvent.click(screen.getByText('Check existing customer'));
  await screen.findByText('changed; reload');
  expect(screen.queryByText('Status: recovery_required')).not.toBeInTheDocument();
  mocks.get.mockResolvedValue({ ...pending, revision: 4 });
  fireEvent.click(screen.getByText('Reload billing status'));
  expect(await screen.findByLabelText('Confirm existing customer recovery')).not.toBeChecked();
  expect(screen.getByText('Check existing customer')).toBeDisabled();
});
it('discards a previous organization and account view while requests are pending', async () => {
  const v = mount();
  fireEvent.click(screen.getByText('Billing setup (Owner)'));
  fireEvent.click(await screen.findByLabelText('Confirm existing customer recovery'));
  v.rerender(v.view('other-org'));
  expect(screen.queryByLabelText('Confirm existing customer recovery')).not.toBeInTheDocument();
  mocks.get.mockImplementation(() => new Promise(() => {}));
  fireEvent.click(screen.getByText('Billing setup (Owner)'));
  expect(screen.queryByText('Check existing customer')).not.toBeInTheDocument();
  mocks.user = 'other-account';
  v.rerender(v.view('other-org'));
  expect(screen.getByText('Billing setup (Owner)')).toBeInTheDocument();
  expect(mocks.recover).not.toHaveBeenCalled();
});
it('does not show cached verification after permission loss', async () => {
  mocks.get.mockResolvedValue({ ...pending, disposition: 'verified' });
  mount();
  fireEvent.click(screen.getByText('Billing setup (Owner)'));
  await screen.findByText(/Customer creation verified/);
  mocks.get.mockRejectedValue(new WakaclockError('billing owner required', 403));
  fireEvent.click(screen.getByText('Reload billing status'));
  await screen.findByText('billing owner required');
  expect(screen.queryByText(/Customer creation verified/)).not.toBeInTheDocument();
});

it('suspends an open nested Checkout and ephemeral URL while its parent Owner check is pending', async () => {
  const verified = { ...pending, disposition: 'verified', last_error_code: null };
  mocks.get.mockResolvedValue(verified);
  const open = {
    ...pending,
    operation_id: 'checkout-1',
    quote_id: 'quote-1',
    disposition: 'session_open',
    test_checkout_destination_available: true,
  };
  mocks.checkout.mockResolvedValue(open);
  mount();
  fireEvent.click(screen.getByText('Billing setup (Owner)'));
  fireEvent.click(await screen.findByText('Existing Checkout (Owner)'));
  fireEvent.click(await screen.findByText('Get test Checkout link'));
  await screen.findByRole('link', { name: 'Open Stripe test Checkout' });
  let resolve!: (value: typeof verified) => void;
  mocks.get.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  fireEvent.click(screen.getByText('Reload billing status'));
  await waitFor(() =>
    expect(screen.queryByText('Checkout status: session_open')).not.toBeInTheDocument()
  );
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.queryByText('View package price')).not.toBeInTheDocument();
  await act(async () => resolve(verified));
  await screen.findByText('Checkout status: session_open');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(mocks.destination).toHaveBeenCalledTimes(1);
});

it('a nested permission failure hides all billing data until an explicit fresh parent check succeeds', async () => {
  const verified = { ...pending, disposition: 'verified', last_error_code: null };
  mocks.get.mockResolvedValue(verified);
  const v = mount();
  fireEvent.click(screen.getByText('Billing setup (Owner)'));
  fireEvent.click(await screen.findByText('Existing Checkout (Owner)'));
  fireEvent.click(await screen.findByLabelText('Confirm existing Checkout recovery'));
  mocks.checkout.mockRejectedValue(new WakaclockError('billing owner required', 403));
  fireEvent.click(screen.getByText('Reload Checkout status'));
  await screen.findByText('billing owner required');
  expect(screen.queryByText(/Customer creation verified/)).not.toBeInTheDocument();
  expect(screen.queryByText('View package price')).not.toBeInTheDocument();
  expect(screen.queryByText('Check existing Checkout')).not.toBeInTheDocument();
  // An unrelated observer/poll success must not clear the explicit denial.
  await act(() => v.cache.invalidateQueries());
  expect(screen.queryByText(/Customer creation verified/)).not.toBeInTheDocument();
  mocks.checkout.mockResolvedValue({ ...pending, operation_id: 'checkout-1', quote_id: 'quote-1' });
  fireEvent.click(screen.getByText('Reload billing status'));
  await screen.findByText(/Customer creation verified/);
  const confirmation = await screen.findByLabelText('Confirm existing Checkout recovery');
  expect(confirmation).not.toBeChecked();
  expect(screen.getByText('Check existing Checkout')).toBeDisabled();
});

it.each(['price', 'hosted link', 'test confirmation'])(
  'a denied %s also clears sibling billing views',
  async (action) => {
    mocks.get.mockResolvedValue({ ...pending, disposition: 'verified', last_error_code: null });
    const denied = new WakaclockError('Owner access changed', 403);
    mount();
    fireEvent.click(screen.getByText('Billing setup (Owner)'));
    await screen.findByText(/Customer creation verified/);
    if (action === 'hosted link') {
      mocks.checkout.mockResolvedValue({
        ...pending,
        operation_id: 'checkout-1',
        disposition: 'session_open',
        test_checkout_destination_available: true,
      });
      mocks.destination.mockRejectedValue(denied);
      fireEvent.click(screen.getByText('Existing Checkout (Owner)'));
      fireEvent.click(await screen.findByText('Get test Checkout link'));
    } else {
      if (action === 'price') mocks.quote.mockRejectedValue(denied);
      else mocks.confirm.mockRejectedValue(denied);
      fireEvent.click(screen.getByText('View package price'));
      if (action === 'test confirmation') {
        fireEvent.click(await screen.findByLabelText('Confirm test package'));
        fireEvent.click(screen.getByText('Prepare test Checkout'));
      }
    }
    await screen.findByText('Owner access changed');
    expect(screen.queryByText(/Customer creation verified/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Package price:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Confirm test package')).not.toBeInTheDocument();
  }
);

it('does not let an older successful Owner reload clear a newer nested denial', async () => {
  const verified = { ...pending, disposition: 'verified', last_error_code: null };
  mocks.get.mockResolvedValue(verified);
  let denyCheckout!: (error: unknown) => void;
  mocks.checkout.mockImplementationOnce(
    () =>
      new Promise((_done, reject) => {
        denyCheckout = reject;
      })
  );
  mount();
  fireEvent.click(screen.getByText('Billing setup (Owner)'));
  fireEvent.click(await screen.findByText('Existing Checkout (Owner)'));
  await waitFor(() => expect(mocks.checkout).toHaveBeenCalled());
  let completeOlderReload!: (value: typeof verified) => void;
  mocks.get.mockImplementationOnce(
    () =>
      new Promise((done) => {
        completeOlderReload = done;
      })
  );
  fireEvent.click(screen.getByText('Reload billing status'));
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  await act(async () => denyCheckout(new WakaclockError('Newer owner denial', 403)));
  await act(async () => completeOlderReload(verified));
  await screen.findByText('Newer owner denial');
  expect(screen.queryByText(/Customer creation verified/)).not.toBeInTheDocument();
  expect(screen.queryByText('View package price')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Reload billing status'));
  await screen.findByText(/Customer creation verified/);
});
