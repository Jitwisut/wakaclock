import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { TeamPriceQuotePanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-price-quote-panel';
import { WakaclockError } from '@/lib/wakaclock/client';
import { formatStripePrice } from '@/lib/wakaclock/team-billing-money';

const mocks = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn(), confirm: vi.fn() }));
vi.mock('@/lib/wakaclock/team-billing-endpoints', () => ({
  createTeamPriceQuote: mocks.create,
  getTeamPriceQuote: mocks.get,
  confirmTeamTestCheckout: mocks.confirm,
}));
const sample = () => ({
  id: 'quote-1',
  amount_minor: '12345',
  currency: 'usd',
  package_seats: 10,
  observed_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 600_000).toISOString(),
  tax_behavior: 'exclusive',
  total_due_minor: null,
  checkout_available: false,
});
beforeEach(() => {
  mocks.confirm
    .mockReset()
    .mockResolvedValue({ quote_id: 'quote-1', operation_id: 'op-1', payment_verified: false });
  mocks.create.mockReset().mockImplementation(async () => sample());
  mocks.get.mockReset().mockImplementation(async () => sample());
});
afterEach(() => vi.restoreAllMocks());
function mount() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = (customer: string | undefined = 'customer:1') => (
    <QueryClientProvider client={cache}>
      <TeamPriceQuotePanel customer={customer} organizationId="org" userId="owner" />
    </QueryClientProvider>
  );
  return { ...render(view()), cache, view };
}
it('shows provider-checked package price and unknown total only after authenticated readback', async () => {
  const v = mount();
  expect(mocks.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('View package price'));
  await screen.findByText(/Package price: USD 123.45 per month for 10 developers/);
  expect(mocks.create).toHaveBeenCalledWith('org', expect.any(String), 10);
  expect(mocks.get).toHaveBeenCalledWith('org', 'quote-1', expect.any(AbortSignal));
  expect(screen.getByText(/Total due: unavailable/)).toBeInTheDocument();
  expect(screen.queryByText('Pay')).not.toBeInTheDocument();
  mocks.get.mockRejectedValue(new WakaclockError('owner access revoked', 403));
  await act(() => v.cache.invalidateQueries());
  await screen.findByText('owner access revoked');
  expect(screen.queryByText(/Package price:/)).not.toBeInTheDocument();
});
it('reuses an ID when the POST response is lost, and never displays an old quote on retry failure', async () => {
  mocks.create.mockRejectedValueOnce(new WakaclockError('response lost', null));
  mount();
  fireEvent.click(screen.getByText('View package price'));
  await screen.findByText('response lost');
  const id = mocks.create.mock.calls[0][1];
  fireEvent.click(screen.getByText('View package price'));
  await screen.findByText(/Package price: USD/);
  expect(mocks.create.mock.calls[1][1]).toBe(id);
  mocks.create.mockRejectedValue(new WakaclockError('catalog not available', 503));
  fireEvent.click(screen.getByText('View package price'));
  await screen.findByText('catalog not available');
  expect(screen.queryByText(/Package price:/)).not.toBeInTheDocument();
});
it('discards price display when package or customer revision changes', async () => {
  const v = mount();
  fireEvent.click(screen.getByText('View package price'));
  await screen.findByText(/Package price: USD/);
  fireEvent.change(screen.getByLabelText('Developer seats'), { target: { value: '25' } });
  expect(screen.queryByText(/Package price:/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Developer seats'), { target: { value: '10' } });
  v.rerender(v.view('customer:2'));
  expect(screen.queryByText(/Package price:/)).not.toBeInTheDocument();
});
it('does not reveal a late price response after customer scope disappears', async () => {
  let resolve!: (value: ReturnType<typeof sample>) => void;
  mocks.create.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const v = mount();
  fireEvent.click(screen.getByText('View package price'));
  await waitFor(() => expect(mocks.create).toHaveBeenCalled());
  v.rerender(v.view(''));
  await act(async () => resolve(sample()));
  expect(screen.queryByText(/Package price:/)).not.toBeInTheDocument();
  expect(mocks.get).not.toHaveBeenCalled();
});
it('hides an expired quote and requests a new ID instead of extending the original', async () => {
  const old = { ...sample(), expires_at: new Date(Date.now() - 1000).toISOString() };
  mocks.get.mockResolvedValue(old);
  mount();
  fireEvent.click(screen.getByText('View package price'));
  await screen.findByText('Price preview expired. Request an updated price.');
  expect(screen.queryByText(/Package price:/)).not.toBeInTheDocument();
  const id = mocks.create.mock.calls[0][1];
  fireEvent.click(screen.getByText('View package price'));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
  expect(mocks.create.mock.calls[1][1]).not.toBe(id);
});
it('updates expiration even while a previously rendered page stays open', async () => {
  const old = { ...sample(), expires_at: new Date(Date.now() + 20_000).toISOString() };
  mocks.get.mockResolvedValue(old);
  mount();
  fireEvent.click(screen.getByText('View package price'));
  await screen.findByText(/Package price: USD/);
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse(old.expires_at) + 1);
  await waitFor(
    () =>
      expect(
        screen.getByText('Price preview expired. Request an updated price.')
      ).toBeInTheDocument(),
    { timeout: 2500 }
  );
  expect(screen.queryByText(/Package price:/)).not.toBeInTheDocument();
});
it('formats charge amounts exactly, including Stripe special units, without floating point rounding', () => {
  expect(formatStripePrice('9007199254740993', 'usd')).toBe('USD 90,071,992,547,409.93');
  expect(formatStripePrice('123', 'jpy')).toBe('JPY 123');
  expect(formatStripePrice('123', 'mga')).toBe('MGA 123');
  expect(formatStripePrice('500', 'ugx')).toBe('UGX 5.00');
  expect(formatStripePrice('500', 'isk')).toBe('ISK 5.00');
  expect(formatStripePrice('501', 'isk')).toBeNull();
  expect(formatStripePrice('123', 'huf')).toBe('HUF 1.23');
  expect(formatStripePrice('123', 'twd')).toBe('TWD 1.23');
  expect(formatStripePrice('0', 'thb')).toBe('THB 0.00');
  for (const amount of ['-1', '1.5', '1e3', '', '01'])
    expect(formatStripePrice(amount, 'usd')).toBeNull();
  expect(formatStripePrice('1', '<usd>')).toBeNull();
});

it('connects the server-authorized test quote to durable confirmation', async () => {
  mocks.get.mockImplementation(async () => ({
    ...sample(),
    test_checkout_confirmation_available: true,
  }));
  mount();
  fireEvent.click(screen.getByText('View package price'));
  await screen.findByText('Prepare test Checkout');
  expect(screen.getByText('Prepare test Checkout')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Confirm test package'));
  fireEvent.click(screen.getByText('Prepare test Checkout'));
  await screen.findByText(/Test request saved/);
  expect(mocks.confirm).toHaveBeenCalledWith('org', 'quote-1');
  expect(screen.queryByText('Preview only. Purchasing is not available.')).not.toBeInTheDocument();
});
