import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TeamCancellationPanel } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-cancellation-panel';
import { TeamBillingOwnerBoundary } from '@/app/dashboard/(auth)/wakaclock/teams/components/team-billing-owner-boundary';
import { WakaclockError } from '@/lib/wakaclock/client';
import type {
  TeamCancellationStatus,
  TeamCancellationView,
} from '@/lib/wakaclock/team-cancellation-endpoints';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  accept: vi.fn(),
  recover: vi.fn(),
  denied: vi.fn(),
}));
vi.mock('@/lib/wakaclock/team-cancellation-endpoints', () => ({
  getTeamCancellation: mocks.get,
  acceptTeamCancellation: mocks.accept,
  recoverTeamCancellation: mocks.recover,
}));
const id = '018b9a45-1111-4222-8333-444444444444';
function view(): TeamCancellationView {
  return {
    schema_version: 1,
    operation: null,
    checked_at: new Date().toISOString(),
    selection: {
      binding_revision: 2,
      source_revision: 8,
      period_end: new Date(Date.now() + 86400000).toISOString(),
      provider_observed_at: new Date().toISOString(),
      confirmation_expires_at: new Date(Date.now() + 120000).toISOString(),
    },
  };
}
function saved(): TeamCancellationStatus {
  return {
    schema_version: 1,
    operation_id: id,
    revision: 1,
    accepted_at: new Date().toISOString(),
    expected_period_end: new Date(Date.now() + 86400000).toISOString(),
    requested_by_current_owner: true,
    authorization_current_owner: true,
    acceptance: 'observed',
    provider_disposition: null,
    reason: 'awaiting_provider_read',
    dispatch_available: false,
    state: 'pending',
    read_only: false,
    retry_at: new Date().toISOString(),
    last_error_code: null,
    provider_observed_at: null,
    worker_configured: true,
    observed_at: new Date().toISOString(),
  };
}
function scope(client: QueryClient, available = true, user = 'user', org = 'org') {
  return (
    <QueryClientProvider client={client}>
      <TeamBillingOwnerBoundary key={`${user}:${org}`}>
        <TeamCancellationPanel
          organizationId={org}
          userId={user}
          authority={{ available, observation: 'fresh-owner' }}
          onAccessLost={mocks.denied}
        />
      </TeamBillingOwnerBoundary>
    </QueryClientProvider>
  );
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return { ...render(scope(client)), client };
}
beforeEach(() => {
  mocks.get.mockReset().mockResolvedValue(view());
  mocks.accept.mockReset().mockResolvedValue(saved());
  mocks.recover.mockReset().mockResolvedValue(saved());
  mocks.denied.mockReset();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
});
it('requires an explicit fresh boundary confirmation and reads the original request after acceptance', async () => {
  const terms = view();
  mocks.get.mockImplementation(async (_org, operation) =>
    operation
      ? {
          schema_version: 1,
          operation: saved(),
          selection: null,
          checked_at: new Date().toISOString(),
        }
      : terms
  );
  mount();
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.accept).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Cancel at period end (Owner)'));
  const button = await screen.findByText('Request period-end cancellation');
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Confirm cancellation action'));
  fireEvent.click(button);
  await waitFor(() =>
    expect(mocks.accept).toHaveBeenCalledWith('org', {
      operation_id: id,
      expected_binding_revision: 2,
      expected_source_revision: 8,
      expected_period_end: terms.selection!.period_end,
      confirm: true,
    })
  );
  await screen.findByText('Cancellation state: pending');
  expect(screen.getByText('Provider evidence: unconfirmed')).toBeInTheDocument();
  expect(screen.queryByText('Request period-end cancellation')).not.toBeInTheDocument();
});
it('a lost response retains the original ID and terms for an explicitly confirmed retry', async () => {
  mocks.get.mockImplementation(async (_org, operation) => {
    if (operation) throw new WakaclockError('original unconfirmed', 503);
    return view();
  });
  mocks.accept.mockRejectedValue(new WakaclockError('response lost', null));
  mount();
  fireEvent.click(screen.getByText('Cancel at period end (Owner)'));
  await screen.findByText('Request period-end cancellation');
  fireEvent.click(screen.getByLabelText('Confirm cancellation action'));
  fireEvent.click(screen.getByText('Request period-end cancellation'));
  await screen.findByText('Retry original cancellation request');
  const previousChecks = mocks.get.mock.calls.length;
  // Manual inspection must not strand an uncommitted original request when
  // resetting the transient mutation error. Its frozen identity remains retryable.
  fireEvent.click(screen.getByText('Reload cancellation status'));
  await waitFor(() => expect(mocks.get.mock.calls.length).toBeGreaterThan(previousChecks));
  const retry = await screen.findByText('Retry original cancellation request');
  expect(retry).toBeDisabled();
  const first = mocks.accept.mock.calls[0][1];
  fireEvent.click(screen.getByLabelText('Confirm original cancellation retry'));
  fireEvent.click(retry);
  await waitFor(() => expect(mocks.accept).toHaveBeenCalledTimes(2));
  expect(mocks.accept.mock.calls[1][1]).toEqual(first);
  expect(mocks.get.mock.calls.some((call) => call[1] === id)).toBe(true);
});
it('suspends subscription details and confirmation immediately when the parent authority is unavailable', async () => {
  const mounted = mount();
  fireEvent.click(screen.getByText('Cancel at period end (Owner)'));
  await screen.findByText('Request period-end cancellation');
  fireEvent.click(screen.getByLabelText('Confirm cancellation action'));
  mounted.rerender(scope(mounted.client, false));
  expect(screen.queryByText('Request period-end cancellation')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Confirm cancellation action')).not.toBeInTheDocument();
  expect(mocks.accept).not.toHaveBeenCalled();
});
it('read-only recovery uses the saved operation and authorization revision', async () => {
  const operation = {
    ...saved(),
    state: 'recovery_required' as const,
    read_only: true,
    revision: 4,
  };
  mocks.get.mockResolvedValue({
    schema_version: 1,
    operation,
    selection: null,
    checked_at: new Date().toISOString(),
  });
  mount();
  fireEvent.click(screen.getByText('Cancel at period end (Owner)'));
  const button = await screen.findByText('Check existing cancellation');
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Confirm cancellation action'));
  fireEvent.click(button);
  await waitFor(() => expect(mocks.recover).toHaveBeenCalledWith('org', id, 4));
  expect(mocks.accept).not.toHaveBeenCalled();
});
it('offers explicit read-only recovery to a new Owner even while an old request is still pending', async () => {
  mocks.get.mockResolvedValue({
    schema_version: 1,
    operation: {
      ...saved(),
      requested_by_current_owner: false,
      authorization_current_owner: false,
    },
    selection: null,
    checked_at: new Date().toISOString(),
  });
  mount();
  fireEvent.click(screen.getByText('Cancel at period end (Owner)'));
  const button = await screen.findByText('Check existing cancellation');
  fireEvent.click(screen.getByLabelText('Confirm cancellation action'));
  fireEvent.click(button);
  await waitFor(() => expect(mocks.recover).toHaveBeenCalledWith('org', id, 1));
  expect(mocks.accept).not.toHaveBeenCalled();
});
it('does not offer a mutation using expired selection evidence or synthesize a provider success', async () => {
  const expired = view();
  expired.selection!.confirmation_expires_at = new Date(Date.now() - 1000).toISOString();
  mocks.get.mockResolvedValue(expired);
  mount();
  fireEvent.click(screen.getByText('Cancel at period end (Owner)'));
  await screen.findByText(
    'No current subscription terms are confirmed. Reload before requesting cancellation.'
  );
  expect(screen.queryByText('Request period-end cancellation')).not.toBeInTheDocument();
  expect(mocks.accept).not.toHaveBeenCalled();
});
it('reports a child permission denial and never sends a mutation from stale cached details', async () => {
  mocks.get.mockRejectedValue(new WakaclockError('Owner required', 403));
  mount();
  fireEvent.click(screen.getByText('Cancel at period end (Owner)'));
  await waitFor(() => expect(mocks.denied).toHaveBeenCalled());
  expect(screen.queryByText('Request period-end cancellation')).not.toBeInTheDocument();
  expect(mocks.accept).not.toHaveBeenCalled();
});
