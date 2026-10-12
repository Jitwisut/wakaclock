import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, it, expect, vi } from 'vitest';
import {
  CopilotWeeklyPanel,
  closedUtcWeeks,
} from '@/app/dashboard/(auth)/wakaclock/teams/components/copilot-weekly-panel';
import type { GithubConnection } from '@/lib/wakaclock/github-endpoints';
const state = vi.hoisted(() => ({ user: 'owner', report: vi.fn(), csv: vi.fn(), teams: vi.fn() }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (s: { userId: string }) => unknown) =>
    select({ userId: state.user }),
}));
vi.mock('@/lib/wakaclock/github-endpoints', () => ({
  getCopilotWeeklyReport: state.report,
  exportCopilotWeeklyReport: state.csv,
}));
vi.mock('@/lib/wakaclock/endpoints-v2', () => ({ listOrganizationTeams: state.teams }));
const connection: GithubConnection = {
  can_manage: true,
  configured: true,
  identity: null,
  repositories: [],
  health: { status: 'observed', reason: 'fixture' },
  copilot_weekly_reports: true,
  copilot_weekly_csv: true,
  copilot_daily: {
    configuration: { enabled: true, installation_id: 1, revision: 1, start_day: '2026-01-01' },
    status: 'observed',
    pending_jobs: 0,
    dead_letter_jobs: 0,
    last_success_at: null,
    error_code: null,
    timezone: 'UTC',
    granularity: 'day',
  },
};
const result = {
  status: 'partial',
  cells: [
    { feature: 'all_features', counter: 'generation', value: 0, status: 'partial' },
    { feature: 'all_features', counter: 'acceptance', value: null, status: 'withheld' },
  ],
  organization_timezone: 'Asia/Bangkok',
  window_start: '2026-10-05T00:00:00Z',
  window_end: '2026-10-12T00:00:00Z',
  generation: 2,
  source_revision: 'source',
  publication_id: 'publication',
  provenance: 'github',
  calculation_version: 'v1',
  capture_status: 'unconfirmed',
  ingestion_status: 'reports_ingested',
};
beforeEach(() => {
  state.user = 'owner';
  state.report.mockReset().mockResolvedValue(result);
  state.teams.mockReset().mockResolvedValue([{ id: 'team', name: 'Team A' }]);
  state.csv.mockReset().mockResolvedValue('safe csv');
  sessionStorage.clear();
});
function mount(value = connection, org = 'org') {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (c = value, o = org) => (
    <QueryClientProvider client={cache}>
      <CopilotWeeklyPanel organizationId={o} connection={c} />
    </QueryClientProvider>
  );
  return { ...render(view()), view };
}
it('uses closed UTC weeks independent of Bangkok and never offers the open week', () => {
  expect(closedUtcWeeks(new Date('2026-10-11T18:00:00Z'))[0]).toBe('2026-09-28');
  expect(closedUtcWeeks(new Date('2026-10-12T00:00:00Z'))[0]).toBe('2026-10-05');
});
it('preserves zero, withheld, UTC and capture uncertainty without claiming full adoption', async () => {
  mount();
  await screen.findByText('generation');
  expect(screen.getByText('0')).toBeTruthy();
  expect(screen.getAllByText('withheld').length).toBe(2);
  expect(screen.getByText(/capture: unconfirmed/)).toBeTruthy();
  expect(state.report).toHaveBeenCalledWith('org', expect.any(String), undefined);
});
it('hides cached numbers when account or organization changes and new read fails', async () => {
  const ui = mount();
  await screen.findByText('generation');
  state.user = 'other';
  state.report.mockRejectedValue(Error('access revoked'));
  ui.rerender(ui.view(connection, 'other-org'));
  await screen.findByRole('alert');
  expect(screen.queryByText('generation')).toBeNull();
});
it('disabling integration immediately hides numbers and export', async () => {
  const ui = mount();
  await screen.findByText('generation');
  ui.rerender(ui.view({ ...connection, copilot_weekly_reports: false }));
  expect(screen.queryByText('generation')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Export Copilot weekly CSV' })).toBeNull();
});
it('discards a completed export after scope changes', async () => {
  let resolve: (s: string) => void = () => {};
  state.csv.mockImplementation(
    () =>
      new Promise<string>((r) => {
        resolve = r;
      })
  );
  const create = vi.fn();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
  const ui = mount();
  await screen.findByText('generation');
  fireEvent.click(screen.getByRole('button', { name: 'Export Copilot weekly CSV' }));
  await waitFor(() => expect(state.csv).toHaveBeenCalled());
  state.user = 'other';
  state.report.mockRejectedValue(Error('revoked'));
  ui.rerender(ui.view());
  await screen.findByRole('alert');
  resolve('late csv');
  await waitFor(() => expect(screen.queryByText('generation')).toBeNull());
  expect(create).not.toHaveBeenCalled();
});

it('hides organization numbers and drops export when an owner loses organization permission', async () => {
  let resolve: (s: string) => void = () => {};
  state.csv.mockImplementation(
    () =>
      new Promise<string>((r) => {
        resolve = r;
      })
  );
  const create = vi.fn();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
  const ui = mount();
  await screen.findByText('generation');
  fireEvent.click(screen.getByRole('button', { name: 'Export Copilot weekly CSV' }));
  await waitFor(() => expect(state.csv).toHaveBeenCalled());
  ui.rerender(ui.view({ ...connection, can_manage: false }));
  expect(screen.queryByText('generation')).toBeNull();
  resolve('old owner CSV');
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Export Copilot weekly CSV' })).toBeNull()
  );
  expect(create).not.toHaveBeenCalled();
});
