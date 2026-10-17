import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  return { ...render(view()), view };
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
