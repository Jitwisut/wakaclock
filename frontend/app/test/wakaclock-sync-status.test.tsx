import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import WakaclockSyncPage from '@/app/dashboard/(auth)/wakaclock/sync/page';
import { SyncStatusIndicator } from '@/components/wakaclock/sync-status-indicator';
import { getDeliveryStatus } from '@/lib/wakaclock/endpoints-v2';
import type { DeliveryStatusResponse } from '@/lib/wakaclock/measurement-types';

const state = vi.hoisted(() => ({ user: 'sync-user' as null | string }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (value: { userId: null | string }) => unknown) =>
    select({ userId: state.user }),
}));
vi.mock('@/components/wakaclock/require-user', () => ({
  RequireUser: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/lib/wakaclock/endpoints-v2', () => ({ getDeliveryStatus: vi.fn() }));

const fresh = () => new Date().toISOString();
function device(
  overrides: Partial<DeliveryStatusResponse['devices'][number]> = {}
): DeliveryStatusResponse['devices'][number] {
  return {
    age_seconds: 0,
    captured_at: fresh(),
    received_at: fresh(),
    dead_letter: 0,
    device_id: 'd45c2c4b-device',
    queue_id: 'queue',
    sequence: 1,
    schema_version: 2,
    status: 'fresh',
    retry: null,
    pending: 2128,
    oldest_pending_at: '2026-10-18T09:51:01Z',
    last_successful_delivery_at: fresh(),
    capture: null,
    details: {
      accepted_total: 37930,
      eligible: 0,
      leased: 0,
      next_retry_at: fresh(),
      oldest_event_at: '2026-10-18T09:51:01Z',
      backlog_error: {
        kind: 'network',
        message_code: 'connect_failed',
        http_status: null,
        failed_at: fresh(),
      },
    },
    ...overrides,
  };
}
function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
beforeEach(() => {
  state.user = 'sync-user';
});

it('shows a coloured dot whose popover names the cause and links to Sync status', async () => {
  vi.mocked(getDeliveryStatus).mockResolvedValue({ storage: 'postgres', devices: [device()] });
  renderWithClient(<SyncStatusIndicator />);
  const trigger = await screen.findByRole('button', {
    name: "Sync status: Can't reach the server",
  });
  expect(trigger).toHaveAttribute('data-sync-tone', 'attention');
  fireEvent.click(trigger);
  expect(await screen.findByText(/2,128 heartbeats saved on your device/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open sync status' })).toHaveAttribute(
    'href',
    '/dashboard/wakaclock/sync'
  );
});

it('shows a calm dot when everything is delivered, and nothing without a session', async () => {
  vi.mocked(getDeliveryStatus).mockResolvedValue({
    storage: 'postgres',
    devices: [device({ pending: 0, oldest_pending_at: null })],
  });
  const view = renderWithClient(<SyncStatusIndicator />);
  expect(
    await screen.findByRole('button', { name: 'Sync status: All activity synced' })
  ).toHaveAttribute('data-sync-tone', 'ok');
  view.unmount();
  state.user = null;
  const empty = renderWithClient(<SyncStatusIndicator />);
  expect(empty.container).toBeEmptyDOMElement();
});

it('summarises each device in plain language with the readout behind a toggle', async () => {
  vi.mocked(getDeliveryStatus).mockResolvedValue({
    storage: 'postgres',
    devices: [device(), device({ device_id: 'ffffeeee-other', queue_id: 'q2', pending: null })],
  });
  renderWithClient(<WakaclockSyncPage />);
  expect(await screen.findByRole('heading', { name: 'Sync status' })).toBeInTheDocument();
  expect(await screen.findByText("Can't reach the server")).toBeInTheDocument();
  expect(screen.getByText('Unknown')).toBeInTheDocument();
  expect(screen.getByText('0 could not be sent')).toBeInTheDocument();
  expect(screen.getByText(/2128 waiting/)).toBeInTheDocument();
  expect(screen.getByText(/Queue size unknown/)).toBeInTheDocument();
  expect(screen.queryByText(/backlog error connect_failed/)).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: /Technical details/ })[0]);
  expect(await screen.findByText(/backlog error connect_failed/)).toBeInTheDocument();
});

it('reports totals once every queue is known, and an empty state with no devices', async () => {
  vi.mocked(getDeliveryStatus).mockResolvedValueOnce({
    storage: 'postgres',
    devices: [
      device({
        dead_letter: null,
        oldest_pending_at: null,
        last_successful_delivery_at: null,
        details: null,
      }),
    ],
  });
  const view = renderWithClient(<WakaclockSyncPage />);
  expect(await screen.findByText('2,128')).toBeInTheDocument();
  expect(screen.queryByText(/could not be sent/)).not.toBeInTheDocument();
  expect(screen.getAllByText('—')).toHaveLength(3);
  view.unmount();
  vi.mocked(getDeliveryStatus).mockResolvedValueOnce({ storage: 'postgres', devices: [] });
  const empty = renderWithClient(<WakaclockSyncPage />);
  expect(await screen.findByText('No device has reported yet')).toBeInTheDocument();
  empty.unmount();
  // Without a session the query never runs.
  state.user = null;
  vi.mocked(getDeliveryStatus).mockClear();
  renderWithClient(<WakaclockSyncPage />);
  expect(await screen.findByText('No device has reported yet')).toBeInTheDocument();
  expect(getDeliveryStatus).not.toHaveBeenCalled();
});
