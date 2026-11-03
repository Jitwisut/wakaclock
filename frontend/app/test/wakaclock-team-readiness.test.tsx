import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TeamReadinessPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-readiness-panel';
import { wakaclockKeys } from '@/lib/wakaclock/query-keys';

const mocks = vi.hoisted(() => ({ read: vi.fn(), user: 'alice', token: 'session-a' }));
vi.mock('@/lib/wakaclock/team-readiness-endpoints', () => ({ getTeamReadiness: mocks.read }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (selector: (value: { userId: string; token: string }) => unknown) =>
    selector({ userId: mocks.user, token: mocks.token }),
}));
vi.mock('@/lib/wakaclock/session', () => ({
  getSessionObservation: (token: string) => (token === 'session-a' ? 1 : 2),
}));
const response = {
  production_ready: false,
  checkout_available: false,
  build: 'a'.repeat(40),
  evaluated_at: '2026-11-02T00:00:00Z',
  evidence_details: {
    schema_version: 1,
    external_certification: 'unconfirmed',
    unsupported_scope_present: false,
    local: [],
    external: [
      {
        gate: 'restore_drill',
        recorded_passed: true,
        evidence_ref: 'fixture/restore.json',
        checked_at: '2026-11-01T00:00:00Z',
        build: 'a'.repeat(40),
        build_matches_current: true,
        metadata_status: 'recorded',
        reason: 'recorded_metadata_only',
        certified: false,
      },
    ],
  },
};
beforeEach(() => {
  mocks.user = 'alice';
  mocks.token = 'session-a';
  mocks.read.mockReset().mockResolvedValue(response);
});
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (org = 'org') => (
    <QueryClientProvider client={client}>
      <TeamReadinessPanel organizationId={org} />
    </QueryClientProvider>
  );
  return { client, ui };
}
it('loads only on explicit review and labels external records without certifying or enabling anything', async () => {
  const { ui } = setup();
  render(ui());
  expect(mocks.read).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Review release evidence (Owner/Admin)' }));
  await screen.findByText(/Evidence reference: fixture\/restore.json/);
  expect(screen.getByText(/External certification: unconfirmed/)).toBeInTheDocument();
  expect(screen.getByText(/recorded result passed/)).toBeInTheDocument();
  expect(screen.getByText(/No local records available/)).toBeInTheDocument();
  expect(screen.getByText(/do not enable production or Checkout/)).toBeInTheDocument();
});
it('hides old evidence on reload failure and never caches a credential in the query key', async () => {
  const { client, ui } = setup();
  render(ui());
  fireEvent.click(screen.getByRole('button', { name: 'Review release evidence (Owner/Admin)' }));
  await screen.findByText(/Evidence reference: fixture\/restore.json/);
  expect(JSON.stringify(wakaclockKeys.teamReadiness('alice', 'org', 'session-a'))).not.toContain(
    'session-a'
  );
  mocks.read.mockRejectedValue(Error('permission changed'));
  await act(() =>
    client.invalidateQueries({ queryKey: wakaclockKeys.teamReadiness('alice', 'org', 'session-a') })
  );
  await waitFor(() =>
    expect(screen.queryByText(/Evidence reference: fixture\/restore.json/)).not.toBeInTheDocument()
  );
});
it('does not reuse a pending result after account, session or organization changes', async () => {
  let finish!: (value: typeof response) => void;
  mocks.read.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { ui } = setup();
  const view = render(ui());
  fireEvent.click(screen.getByRole('button', { name: 'Review release evidence (Owner/Admin)' }));
  await waitFor(() => expect(mocks.read).toHaveBeenCalledOnce());
  mocks.user = 'bob';
  mocks.token = 'session-b';
  view.rerender(ui('other-org'));
  await act(async () => {
    finish(response);
  });
  expect(screen.queryByText(/Evidence reference: fixture\/restore.json/)).not.toBeInTheDocument();
});
it('keeps old servers and malformed evidence details explicitly unavailable', async () => {
  mocks.read.mockResolvedValue({
    ...response,
    evidence_details: { schema_version: 1, external: null },
  });
  const { ui } = setup();
  render(ui());
  fireEvent.click(screen.getByRole('button', { name: 'Review release evidence (Owner/Admin)' }));
  expect(await screen.findByText(/Evidence details are unavailable/)).toBeInTheDocument();
  expect(screen.queryByText(/recorded result passed/)).not.toBeInTheDocument();
});
