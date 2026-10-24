import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TeamSummaryPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-summary-panel';
const mocks = vi.hoisted(() => ({
  user: 'owner',
  token: 'session-a',
  summary: vi.fn(),
  export: vi.fn(),
  connection: vi.fn(),
  teams: vi.fn(),
  download: vi.fn(),
}));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (s: (v: { userId: string; token: string }) => unknown) =>
    s({ userId: mocks.user, token: mocks.token }),
}));
vi.mock('@/lib/wakaclock/session', () => ({ getCurrentToken: () => mocks.token }));
vi.mock('@/lib/wakaclock/github-endpoints', () => ({ getGithubConnection: mocks.connection }));
vi.mock('@/lib/wakaclock/endpoints-v2', () => ({ listOrganizationTeams: mocks.teams }));
vi.mock('@/lib/wakaclock/team-summary-endpoints', () => ({
  getTeamWeeklySummary: mocks.summary,
  exportTeamWeeklySummary: mocks.export,
}));
const data = {
  week_start: '2026-10-05',
  timezone: 'Asia/Bangkok',
  data_status: 'partial',
  checked_at: '2026-10-14T00:00:00Z',
  measurement_health: ['capture_unconfirmed'],
  action_snapshot_at: '2026-10-14T00:00:00Z',
  actions: [
    { id: 'a', owner_id: 'owner', title: 'Improve coverage', status: 'active', revision: 1 },
  ],
  actions_next_cursor: null,
  cells: [
    {
      metric: 'estimated_cost',
      dimension: 'all',
      value: '18446744073709551615',
      unit: 'micro_usd',
      status: 'partial',
      reason: null,
      coverage: null,
      provenance: 'canonical',
      updated_at: null,
      calculation_version: 'v1',
      provider_definition_version: null,
      pricing_versions: [],
    },
    {
      metric: 'unknown_cost',
      dimension: 'all',
      value: null,
      unit: 'micro_usd',
      status: 'withheld',
      reason: 'privacy',
      coverage: null,
      provenance: 'canonical',
      updated_at: null,
      calculation_version: 'v1',
      provider_definition_version: null,
      pricing_versions: [],
    },
    {
      metric: 'observed_counter',
      dimension: 'all',
      value: '0',
      unit: 'counter',
      status: 'complete',
      reason: null,
      coverage: 1,
      provenance: 'provider',
      updated_at: null,
      calculation_version: 'v1',
      provider_definition_version: 'provider-v1',
      pricing_versions: [],
    },
  ],
};
beforeEach(() => {
  mocks.user = 'owner';
  mocks.token = 'session-a';
  mocks.summary.mockReset().mockResolvedValue(data);
  mocks.export.mockReset().mockResolvedValue('safe csv');
  mocks.connection.mockReset().mockResolvedValue({
    can_manage: true,
    copilot_weekly_reports: true,
    copilot_daily: { configuration: { enabled: true } },
  });
  mocks.teams.mockReset().mockResolvedValue([{ id: 'team', name: 'Team A' }]);
  mocks.download.mockReset();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(mocks.download);
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});
function mount() {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (org = 'org') => (
    <QueryClientProvider client={cache}>
      <TeamSummaryPanel organizationId={org} organizationTimezone="Asia/Bangkok" />
    </QueryClientProvider>
  );
  return { ...render(view()), view, cache };
}
it('keeps exact decimal, zero and unknown separate; actions are current metadata', async () => {
  mount();
  await screen.findByText('18446744073709551615 · micro_usd');
  expect(screen.getByText('Unavailable · micro_usd')).toBeTruthy();
  expect(screen.getByText('0 · counter')).toBeTruthy();
  expect(screen.getByText(/not historical task status/)).toBeTruthy();
  expect(screen.getByText(/capture_unconfirmed/)).toBeTruthy();
});
it('uses Copilot UTC and filtered pages while exporting the whole scope', async () => {
  mocks.summary.mockResolvedValue({ ...data, actions_next_cursor: 'page-2' });
  mount();
  await screen.findByText('18446744073709551615 · micro_usd');
  fireEvent.change(screen.getByLabelText('Summary family'), { target: { value: 'copilot' } });
  await waitFor(() =>
    expect(mocks.summary).toHaveBeenLastCalledWith(
      'org',
      expect.objectContaining({ family: 'copilot', timezone: 'UTC' })
    )
  );
  await screen.findByRole('button', { name: 'Next action page' });
  fireEvent.click(screen.getByRole('button', { name: 'Next action page' }));
  await waitFor(() =>
    expect(mocks.summary).toHaveBeenLastCalledWith(
      'org',
      expect.objectContaining({ actions_after: 'page-2' })
    )
  );
  await screen.findByRole('button', { name: 'Export full weekly summary CSV' });
  fireEvent.click(screen.getByRole('button', { name: 'Export full weekly summary CSV' }));
  await waitFor(() => expect(mocks.download).toHaveBeenCalledOnce());
  expect(mocks.export.mock.calls[0][1]).not.toHaveProperty('actions_after');
});
it('hides old metrics on account/organization switch and read failure', async () => {
  const ui = mount();
  await screen.findByText('18446744073709551615 · micro_usd');
  mocks.user = 'other';
  mocks.token = 'other-token';
  mocks.summary.mockRejectedValue(Error('revoked'));
  ui.rerender(ui.view('other-org'));
  await screen.findByRole('alert');
  expect(screen.queryByText('18446744073709551615 · micro_usd')).toBeNull();
});
it('cancels an in-flight download when account/scope changes', async () => {
  let resolve: (s: string) => void = () => undefined;
  mocks.export.mockImplementation(
    () =>
      new Promise<string>((r) => {
        resolve = r;
      })
  );
  const ui = mount();
  await screen.findByText('18446744073709551615 · micro_usd');
  fireEvent.click(screen.getByRole('button', { name: 'Export full weekly summary CSV' }));
  await waitFor(() => expect(mocks.export).toHaveBeenCalledOnce());
  mocks.user = 'other';
  mocks.token = 'other-token';
  ui.rerender(ui.view('other-org'));
  resolve('private old csv');
  await waitFor(() => expect(mocks.export.mock.calls[0][2].aborted).toBe(true));
  expect(mocks.download).not.toHaveBeenCalled();
});
it('disables cached provider data when current configuration is unavailable', async () => {
  const ui = mount();
  fireEvent.change(screen.getByLabelText('Summary family'), { target: { value: 'copilot' } });
  await screen.findByText('18446744073709551615 · micro_usd');
  mocks.connection.mockResolvedValue({
    can_manage: true,
    copilot_weekly_reports: true,
    copilot_daily: { configuration: { enabled: false } },
  });
  await ui.cache.invalidateQueries();
  await waitFor(() => expect(screen.queryByText('18446744073709551615 · micro_usd')).toBeNull());
  expect(screen.queryByRole('button', { name: 'Export full weekly summary CSV' })).toBeNull();
});
it('reports export failure without downloading partial data', async () => {
  mocks.export.mockRejectedValue(Error('projection changed'));
  mount();
  await screen.findByRole('button', { name: 'Export full weekly summary CSV' });
  fireEvent.click(screen.getByRole('button', { name: 'Export full weekly summary CSV' }));
  await screen.findByText(/Export unavailable or changed/);
  expect(screen.queryByText('18446744073709551615 · micro_usd')).toBeNull();
  expect(mocks.download).not.toHaveBeenCalled();
});

it('cancels pending CSV after a same-account action page loses its projection', async () => {
  let resolve: (s: string) => void = () => undefined;
  mocks.summary.mockResolvedValue({ ...data, actions_next_cursor: 'page-2' });
  mocks.export.mockImplementation(
    () =>
      new Promise<string>((r) => {
        resolve = r;
      })
  );
  mount();
  await screen.findByRole('button', { name: 'Export full weekly summary CSV' });
  fireEvent.click(screen.getByRole('button', { name: 'Export full weekly summary CSV' }));
  await waitFor(() => expect(mocks.export).toHaveBeenCalledOnce());
  mocks.summary.mockRejectedValue(Error('projection changed'));
  fireEvent.click(screen.getByRole('button', { name: 'Next action page' }));
  await screen.findByRole('alert');
  resolve('old private export');
  await waitFor(() => expect(mocks.export.mock.calls[0][2].aborted).toBe(true));
  expect(mocks.download).not.toHaveBeenCalled();
});
