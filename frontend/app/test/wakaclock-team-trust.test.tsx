import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamTrustPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-trust-panel';
import { closedWeeks } from '@/lib/wakaclock/team-weeks';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';
const mocks = vi.hoisted(() => ({ health: vi.fn(), toast: vi.fn(), user: 'alice' }));
vi.mock('@/lib/wakaclock/team-endpoints', () => ({ getTeamMeasurementHealth: mocks.health }));
vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (s: (value: { userId: string }) => unknown) => s({ userId: mocks.user }),
}));
const state = (status: string) => ({ status, reason: 'snapshot', updated_at: null });
const health = (status: string) => ({
  checked_at: '2026-10-08T00:00:00Z',
  report_timezone: 'Asia/Bangkok',
  own: { capture: state('unconfirmed'), delivery: state(status) },
  team: {
    capture: state('withheld'),
    delivery: state('withheld'),
    integration: state('unconfirmed'),
    retention: state('unconfirmed'),
  },
  restore: state('observed'),
});
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.user = 'alice';
});
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (org = 'org') => (
    <QueryClientProvider client={client}>
      <TeamTrustPanel organizationId={org} />
    </QueryClientProvider>
  );
  return { client, ui };
}
describe('closed weekly reports and Trust', () => {
  it('uses organization calendar and never includes an unfinished week', () => {
    const weeks = closedWeeks('Asia/Bangkok', new Date('2026-10-04T18:00:00Z'));
    expect(weeks[0]).toEqual({ start: '2026-09-28', end: '2026-10-04' });
    expect(closedWeeks('UTC', new Date('2026-10-04T18:00:00Z'))[0]).toEqual({
      start: '2026-09-21',
      end: '2026-09-27',
    });
  });
  it('distinguishes unavailable capture from empty delivery, suppresses group detail', async () => {
    mocks.health.mockResolvedValue(health('observed'));
    const { ui } = setup();
    render(ui());
    expect(await screen.findByText('Your capture: unconfirmed · snapshot')).toBeInTheDocument();
    expect(screen.getByText(/Team capture and delivery: withheld/)).toBeInTheDocument();
    expect(
      screen.getByText(/An empty queue does not confirm complete capture/)
    ).toBeInTheDocument();
  });
  it('notifies once on a transition and hides old results after a failed refetch', async () => {
    mocks.health.mockResolvedValue(health('pending'));
    const { client, ui } = setup();
    render(ui());
    await screen.findByText('Your delivery: pending · snapshot');
    mocks.health.mockResolvedValue(health('pending'));
    await act(() =>
      client.invalidateQueries({ queryKey: wakaclockKeys.teamHealth('alice', 'org') })
    );
    expect(mocks.toast).not.toHaveBeenCalled();
    mocks.health.mockResolvedValue(health('observed'));
    await act(() =>
      client.invalidateQueries({ queryKey: wakaclockKeys.teamHealth('alice', 'org') })
    );
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    mocks.health.mockRejectedValue(new Error('unavailable'));
    await act(() =>
      client.invalidateQueries({ queryKey: wakaclockKeys.teamHealth('alice', 'org') })
    );
    await waitFor(() =>
      expect(screen.queryByText('Your delivery: observed · snapshot')).not.toBeInTheDocument()
    );
  });
  it('keeps missing admission evidence unconfirmed on older servers', async () => {
    mocks.health.mockResolvedValue(health('observed'));
    const { ui } = setup();
    render(ui());
    expect(
      await screen.findByText('Team usage processing: unconfirmed · admission_details_unavailable')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A completed scan does not confirm complete capture/)
    ).toBeInTheDocument();
  });
  it('notifies only on admission state changes and hides detail when scope is withheld', async () => {
    const response = (status: string) => ({
      ...health('observed'),
      team: { ...health('observed').team, usage_admission: state(status) },
    });
    mocks.health.mockResolvedValue(response('pending'));
    const { client, ui } = setup();
    render(ui());
    await screen.findByText('Team usage processing: pending · snapshot');
    await act(() =>
      client.invalidateQueries({ queryKey: wakaclockKeys.teamHealth('alice', 'org') })
    );
    expect(mocks.toast).not.toHaveBeenCalled();
    mocks.health.mockResolvedValue(response('observed'));
    await act(() =>
      client.invalidateQueries({ queryKey: wakaclockKeys.teamHealth('alice', 'org') })
    );
    await screen.findByText('Team usage processing: observed · snapshot');
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    mocks.health.mockResolvedValue(response('withheld'));
    await act(() =>
      client.invalidateQueries({ queryKey: wakaclockKeys.teamHealth('alice', 'org') })
    );
    await screen.findByText('Team usage processing: withheld · snapshot');
    expect(
      screen.queryByText('Team usage processing: observed · snapshot')
    ).not.toBeInTheDocument();
  });
  it('does not show previous account or organization data', async () => {
    mocks.health.mockResolvedValue(health('pending'));
    const { ui } = setup();
    const view = render(ui());
    await screen.findByText('Your delivery: pending · snapshot');
    mocks.user = 'bob';
    mocks.health.mockImplementation(() => new Promise(() => {}));
    view.rerender(ui('other'));
    expect(screen.queryByText('Your delivery: pending · snapshot')).not.toBeInTheDocument();
  });
});
