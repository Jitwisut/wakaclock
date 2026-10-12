import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, it, expect, vi } from 'vitest';
import { CopilotDailyPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/copilot-daily-panel';
import type { GithubConnection } from '@/lib/wakaclock/github-endpoints';
const state = vi.hoisted(() => ({ user: 'member-a', day: vi.fn(), configure: vi.fn() }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (s: { userId: string }) => unknown) =>
    select({ userId: state.user }),
}));
vi.mock('@/lib/wakaclock/github-endpoints', () => ({
  getCopilotSelfDay: state.day,
  configureCopilotDaily: state.configure,
}));
const connection: GithubConnection = {
  can_manage: true,
  configured: true,
  identity: null,
  repositories: [],
  health: { status: 'observed', reason: 'test' },
  copilot_daily: {
    status: 'observed',
    configuration: { installation_id: 7, enabled: true, start_day: '2026-10-01', revision: 4 },
    pending_jobs: 0,
    dead_letter_jobs: 0,
    last_success_at: null,
    error_code: null,
    timezone: 'UTC',
    granularity: 'provider_user_day_feature',
  },
};
const result = {
  day: '2026-10-11',
  timezone: 'UTC',
  coverage: 'partial',
  features: [
    {
      feature: 'code_completion',
      counters: { accepted: 0, suggested: null },
      observed_at: '2026-10-12T00:00:00Z',
    },
  ],
  tokens: null,
  model: null,
  estimated_cost: null,
};
beforeEach(() => {
  state.user = 'member-a';
  state.day.mockReset().mockResolvedValue(result);
  state.configure.mockReset().mockResolvedValue({});
});
it('keeps nullable counters distinct from zero and carries config revision without enabling consent', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cache}>
      <CopilotDailyPanel organizationId="org" connection={connection} />
    </QueryClientProvider>
  );
  await screen.findByText('code_completion');
  expect(screen.getByText('0')).toBeTruthy();
  expect(screen.getByText('unavailable')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Enable / resync daily reports' }));
  await waitFor(() =>
    expect(state.configure).toHaveBeenCalledWith(
      'org',
      expect.objectContaining({ installation_id: 7, expected_revision: 4, enabled: true })
    )
  );
  expect(screen.getByText(/does not expand App permissions/)).toBeTruthy();
});
it('removes old counters when a new account fails to reload, and does not expose an old cached report', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = () => (
    <QueryClientProvider client={cache}>
      <CopilotDailyPanel organizationId="org" connection={connection} />
    </QueryClientProvider>
  );
  const ui = render(view());
  await screen.findByText('code_completion');
  state.user = 'member-b';
  state.day.mockRejectedValue(Error('consent revoked'));
  ui.rerender(view());
  await screen.findByRole('alert');
  expect(screen.queryByText('code_completion')).toBeNull();
  expect(state.day.mock.calls.every((c) => c[0] === 'org')).toBe(true);
});

it('hides a cached self report immediately when the connector is disabled', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (value: GithubConnection) => (
    <QueryClientProvider client={cache}>
      <CopilotDailyPanel organizationId="org" connection={value} />
    </QueryClientProvider>
  );
  const ui = render(view(connection));
  await screen.findByText('code_completion');
  ui.rerender(
    view({
      ...connection,
      copilot_daily: {
        ...connection.copilot_daily!,
        configuration: { ...connection.copilot_daily!.configuration!, enabled: false },
      },
    })
  );
  expect(screen.queryByText('code_completion')).toBeNull();
});
