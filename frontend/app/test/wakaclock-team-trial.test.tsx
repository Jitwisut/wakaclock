import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TeamTrialPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-trial-panel';
import { WakaclockError } from '@/lib/wakaclock/client';
import type { TeamTrialStatus } from '@/lib/wakaclock/team-trial-endpoints';

const mocks = vi.hoisted(() => ({ get: vi.fn(), start: vi.fn(), recover: vi.fn() }));
vi.mock('@/lib/wakaclock/team-trial-endpoints', () => ({
  getTeamTrial: mocks.get,
  startTeamTrial: mocks.start,
  recoverTeamTrial: mocks.recover,
}));
function sample(): TeamTrialStatus {
  return {
    disposition: 'not_started',
    package_seats: null,
    developer_seats: 1,
    trial_started_at: null,
    trial_ends_at: null,
    entitlement_revision: null,
    observed_at: new Date().toISOString(),
    can_start: true,
    recovery: null,
    reason: null,
    analytics_status: 'unconfirmed',
    analytics_reason: 'independent_privacy_proof_pending',
    trial_days: 14,
    packages: [10, 25, 50, 100],
    payment_card_required: false,
    personal_capture_affected: false,
  };
}
beforeEach(() => {
  mocks.get.mockReset().mockImplementation(async () => sample());
  mocks.start.mockReset().mockResolvedValue(sample());
  mocks.recover.mockReset().mockResolvedValue(sample());
});
function mount() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = (org = 'org', user = 'owner') => (
    <QueryClientProvider client={cache}>
      <TeamTrialPanel organizationId={org} userId={user} />
    </QueryClientProvider>
  );
  return { ...render(view()), view, cache };
}
it('does not request or activate a trial until explicit Owner review and confirmation', async () => {
  const active = {
    ...sample(),
    disposition: 'active',
    can_start: false,
    package_seats: 10,
    entitlement_revision: 1,
    trial_started_at: '2026-10-27T00:00:00Z',
    trial_ends_at: '2026-11-10T00:00:00Z',
  } as TeamTrialStatus;
  mocks.start.mockImplementation(async () => {
    mocks.get.mockResolvedValue(active);
    return active;
  });
  mount();
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Team trial (Owner)'));
  const start = await screen.findByText('Start no-card trial');
  expect(start).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Confirm trial action'));
  fireEvent.click(start);
  await waitFor(() => expect(mocks.start).toHaveBeenCalledWith('org', 10));
  await screen.findByText('Trial status: active');
  expect(screen.getByText(/Analytics remain withheld/)).toBeInTheDocument();
  expect(screen.queryByText('Start no-card trial')).not.toBeInTheDocument();
});
it('requires a package large enough without automatically choosing seats or removing members', async () => {
  mocks.get.mockResolvedValue({ ...sample(), developer_seats: 25 });
  mount();
  fireEvent.click(screen.getByText('Team trial (Owner)'));
  await screen.findByText('Trial status: not_started');
  expect(screen.queryByText('Start no-card trial')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Trial developer package'), { target: { value: '25' } });
  expect(screen.getByText('Start no-card trial')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Confirm trial action'));
  fireEvent.click(screen.getByText('Start no-card trial'));
  await waitFor(() => expect(mocks.start).toHaveBeenCalledWith('org', 25));
});
it('a lost activation response requires readback and recovers the same initial transition', async () => {
  mocks.start.mockRejectedValue(new WakaclockError('response lost', null));
  const saved = {
    ...sample(),
    disposition: 'recovery_required',
    can_start: false,
    package_seats: 10,
    entitlement_revision: 1,
    trial_started_at: '2026-10-27T00:00:00Z',
    trial_ends_at: '2026-11-10T00:00:00Z',
    recovery: { transition_id: 'original-transition', expected_revision: 1 },
  } as TeamTrialStatus;
  mount();
  fireEvent.click(screen.getByText('Team trial (Owner)'));
  fireEvent.click(await screen.findByLabelText('Confirm trial action'));
  fireEvent.click(screen.getByText('Start no-card trial'));
  await screen.findByText('response lost');
  expect(screen.queryByText('Trial status: not_started')).not.toBeInTheDocument();
  mocks.get.mockResolvedValue(saved);
  fireEvent.click(screen.getByText('Reload trial status'));
  const recover = await screen.findByText('Recover original trial');
  expect(recover).toBeDisabled();
  expect(screen.getByText('Trial ends: 2026-11-10T00:00:00Z')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Confirm trial action'));
  fireEvent.click(recover);
  await waitFor(() => expect(mocks.recover).toHaveBeenCalledWith('org', 'original-transition', 1));
  expect(mocks.start).toHaveBeenCalledTimes(1);
});
it.each([404, 503])(
  'unavailable status %s never means a new trial is available',
  async (status) => {
    mocks.get.mockRejectedValue(new WakaclockError('trial unavailable', status));
    mount();
    fireEvent.click(screen.getByText('Team trial (Owner)'));
    await screen.findByText('trial unavailable');
    expect(screen.queryByText('Start no-card trial')).not.toBeInTheDocument();
    expect(screen.queryByText('Recover original trial')).not.toBeInTheDocument();
  }
);
it('hides previous data on permission loss and discards old account/organization responses', async () => {
  const v = mount();
  fireEvent.click(screen.getByText('Team trial (Owner)'));
  await screen.findByText('Trial status: not_started');
  mocks.get.mockRejectedValue(new WakaclockError('Owner required', 403));
  fireEvent.click(screen.getByText('Reload trial status'));
  await screen.findByText('Owner required');
  expect(screen.queryByText('Trial status: not_started')).not.toBeInTheDocument();
  let complete!: (value: TeamTrialStatus) => void;
  mocks.get.mockImplementation(
    () =>
      new Promise((done) => {
        complete = done;
      })
  );
  fireEvent.click(screen.getByText('Reload trial status'));
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(3));
  v.rerender(v.view('other-org', 'other-owner'));
  await act(async () => complete(sample()));
  expect(screen.queryByText('Start no-card trial')).not.toBeInTheDocument();
  expect(screen.getByText('Team trial (Owner)')).toBeInTheDocument();
  expect(mocks.start).not.toHaveBeenCalled();
});
it.each(['unconfirmed', 'expired', 'subscription_managed'])(
  'never restarts a %s trial',
  async (disposition) => {
    mocks.get.mockResolvedValue({ ...sample(), disposition, can_start: false });
    mount();
    fireEvent.click(screen.getByText('Team trial (Owner)'));
    await screen.findByText(`Trial status: ${disposition}`);
    expect(screen.queryByText('Start no-card trial')).not.toBeInTheDocument();
    expect(screen.queryByText('Recover original trial')).not.toBeInTheDocument();
  }
);
it('does not accept an incompatible trial duration or generate a client-side replacement window', async () => {
  mocks.get.mockResolvedValue({ ...sample(), trial_days: 30 });
  mount();
  fireEvent.click(screen.getByText('Team trial (Owner)'));
  await screen.findByText(/trial contract is unavailable/);
  expect(screen.queryByText('Start no-card trial')).not.toBeInTheDocument();
  expect(screen.queryByText(/Trial ends:/)).not.toBeInTheDocument();
});
