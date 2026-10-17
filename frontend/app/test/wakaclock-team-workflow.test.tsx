import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TeamComparisonPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-comparison-panel';
import { TeamOnboardingPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-onboarding-panel';
const mocks = vi.hoisted(() => ({
  user: 'owner',
  comparison: vi.fn(),
  connection: vi.fn(),
  teams: vi.fn(),
  health: vi.fn(),
  consent: vi.fn(),
}));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (s: (v: { userId: string }) => unknown) => s({ userId: mocks.user }),
}));
vi.mock('@/lib/wakaclock/github-endpoints', () => ({ getGithubConnection: mocks.connection }));
vi.mock('@/lib/wakaclock/endpoints-v2', () => ({ listOrganizationTeams: mocks.teams }));
vi.mock('@/lib/wakaclock/team-endpoints', () => ({
  getTeamWeeklyComparison: mocks.comparison,
  getTeamMeasurementHealth: mocks.health,
  getTeamConsent: mocks.consent,
}));
const result = {
  baseline: {
    week_start: '2026-09-28',
    timezone: 'Asia/Bangkok',
    generation: 1,
    measurement_health: ['capture_unconfirmed'],
  },
  followup: {
    week_start: '2026-10-05',
    timezone: 'Asia/Bangkok',
    generation: 1,
    measurement_health: ['capture_unconfirmed'],
  },
  changes: [
    {
      metric: 'observed_cost',
      unit: 'micro_usd',
      baseline_value: '0',
      followup_value: '10',
      difference: '10',
      percent_change: null,
      baseline_coverage: null,
      followup_coverage: null,
      reason: 'baseline_zero_percent_unavailable',
      status: 'observed_difference',
    },
  ],
  calculation_version: 'v1',
  pricing_changed: null,
};
beforeEach(() => {
  mocks.user = 'owner';
  mocks.comparison.mockReset().mockResolvedValue(result);
  mocks.connection.mockReset().mockResolvedValue({
    can_manage: true,
    copilot_weekly_reports: true,
    copilot_daily: { configuration: { enabled: true } },
    identity: null,
    health: { status: 'unconfirmed' },
  });
  mocks.teams.mockReset().mockResolvedValue([{ id: 'team', name: 'Team A' }]);
  mocks.consent.mockReset().mockResolvedValue({ share_aggregate: false, share_individual: false });
  mocks.health.mockReset().mockResolvedValue({
    own: { capture: { status: 'unconfirmed' }, delivery: { status: 'observed' } },
    restore: { status: 'unavailable' },
  });
});
function mount(onboarding = false) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (org = 'org') => (
    <QueryClientProvider client={cache}>
      {onboarding ? (
        <TeamOnboardingPanel organizationId={org} />
      ) : (
        <TeamComparisonPanel organizationId={org} organizationTimezone="Asia/Bangkok" />
      )}
    </QueryClientProvider>
  );
  return { ...render(view()), view };
}
it('preserves zero, unconfirmed coverage and unavailable percent without a causal claim', async () => {
  mount();
  await screen.findByText('observed_cost · micro_usd');
  expect(screen.getByText('0')).toBeTruthy();
  expect(screen.getByText('Unavailable')).toBeTruthy();
  expect(screen.getByText('Unconfirmed → Unconfirmed')).toBeTruthy();
  expect(screen.getByText(/do not establish/)).toBeTruthy();
});
it('keeps Copilot UTC separate from organization cost weeks', async () => {
  mount();
  await screen.findByText('observed_cost · micro_usd');
  fireEvent.change(screen.getByLabelText('Comparison family'), { target: { value: 'copilot' } });
  await waitFor(() =>
    expect(mocks.comparison).toHaveBeenLastCalledWith(
      'org',
      'copilot',
      expect.any(String),
      expect.any(String),
      'UTC',
      undefined
    )
  );
});
it('hides old numbers on account/organization switch and failed read', async () => {
  const ui = mount();
  await screen.findByText('observed_cost · micro_usd');
  mocks.user = 'other';
  mocks.comparison.mockRejectedValue(Error('revoked'));
  ui.rerender(ui.view('other-org'));
  await screen.findByRole('alert');
  expect(screen.queryByText('observed_cost · micro_usd')).toBeNull();
});
it('permission loss removes organization numbers after current scope reload', async () => {
  const ui = mount();
  await screen.findByText('observed_cost · micro_usd');
  mocks.connection.mockResolvedValue({ can_manage: false, copilot_weekly_reports: true });
  mocks.user = 'member';
  ui.rerender(ui.view());
  await screen.findByText('Select your team');
  expect(screen.queryByText('observed_cost · micro_usd')).toBeNull();
});
it('onboarding respects private choice and does not turn empty delivery into complete capture', async () => {
  mount(true);
  await screen.findByText(/private by choice/);
  expect(screen.getByText(/capture unconfirmed; delivery observed/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /consent|sharing/i })).toBeNull();
  expect(screen.getByText(/does not verify complete capture/)).toBeTruthy();
});

it('hides cached Copilot comparisons immediately when provider configuration is disabled', async () => {
  const ui = mount();
  await screen.findByText('observed_cost · micro_usd');
  fireEvent.change(screen.getByLabelText('Comparison family'), { target: { value: 'copilot' } });
  await waitFor(() =>
    expect(mocks.comparison).toHaveBeenLastCalledWith(
      'org',
      'copilot',
      expect.any(String),
      expect.any(String),
      'UTC',
      undefined
    )
  );
  mocks.connection.mockResolvedValue({
    can_manage: true,
    copilot_weekly_reports: true,
    copilot_daily: { configuration: { enabled: false } },
  });
  mocks.user = 'reconfigured';
  ui.rerender(ui.view());
  await waitFor(() => expect(screen.queryByText('observed_cost · micro_usd')).toBeNull());
});
