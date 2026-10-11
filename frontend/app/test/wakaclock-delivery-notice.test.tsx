import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import {
  DeliveryStatusNotice,
  IncompleteTimeBadge,
} from '@/components/wakaclock/delivery-status-notice';

const mock = vi.hoisted(() => ({
  userId: 'notice-user',
  health: {
    state: 'warning',
    incomplete: true,
    message: 'Pending over 5 minutes',
    pending: 1191,
    deadLetter: 0,
    devices: [{ device_id: 'device', queue_id: 'queue', pending: 1191, dead_letter: 0 }],
  },
  warning: vi.fn(),
  success: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock('@/hooks/use-delivery-health', () => ({ useDeliveryHealth: () => mock.health }));
vi.mock('@/lib/wakaclock/user-store', () => ({
  useWakaclockUserStore: (select: (value: { userId: string }) => unknown) => select(mock),
}));
vi.mock('sonner', () => ({
  toast: { warning: mock.warning, success: mock.success, dismiss: mock.dismiss },
}));
beforeEach(() => {
  mock.userId += '-next';
  mock.health.state = 'warning';
  mock.health.incomplete = true;
  mock.health.pending = 1191;
  mock.health.message = 'Pending over 5 minutes';
});

it('keeps backlog visible without repeating notifications on unchanged polls or navigation', () => {
  const view = render(<DeliveryStatusNotice />);
  expect(screen.getByRole('status')).toHaveTextContent('Pending: 1191');
  expect(mock.warning).toHaveBeenCalledTimes(1);
  mock.health.pending = 1000;
  view.rerender(<DeliveryStatusNotice />);
  expect(mock.warning).toHaveBeenCalledTimes(1);
  view.unmount();
  render(<DeliveryStatusNotice />);
  expect(mock.warning).toHaveBeenCalledTimes(1);
});

it('dismisses the problem on recovery and renders unavailable/stale/auth as incomplete', () => {
  const view = render(
    <>
      <DeliveryStatusNotice />
      <IncompleteTimeBadge />
    </>
  );
  for (const state of ['stale', 'unavailable', 'critical']) {
    mock.health.state = state;
    mock.health.message = state;
    view.rerender(
      <>
        <DeliveryStatusNotice />
        <IncompleteTimeBadge />
      </>
    );
    expect(screen.getAllByText(/ข้อมูลยังไม่ครบ/)).toHaveLength(2);
  }
  expect(screen.getByRole('alert')).toHaveTextContent('critical');
  mock.health.state = 'complete';
  mock.health.incomplete = false;
  mock.health.pending = 0;
  mock.health.message = 'Backlog delivered';
  view.rerender(
    <>
      <DeliveryStatusNotice />
      <IncompleteTimeBadge />
    </>
  );
  expect(screen.queryByText(/ข้อมูลยังไม่ครบ/)).not.toBeInTheDocument();
  expect(mock.dismiss).toHaveBeenCalledWith(`delivery-${mock.userId}`);
  expect(mock.success).toHaveBeenCalledTimes(1);
});

const DEFAULT_DEVICES = mock.health.devices;
const at = '2026-10-07T05:00:00Z';

it('stays quiet until a user is signed in', () => {
  const previous = mock.userId;
  mock.userId = null as unknown as string;
  render(<DeliveryStatusNotice />);
  expect(screen.getByRole('status')).toHaveTextContent('Pending: 1191');
  expect(mock.warning).not.toHaveBeenCalled();
  mock.userId = previous;
});

it('does not announce a recovery on first sight, nor warn for a plain pending queue', () => {
  mock.health.state = 'complete';
  mock.health.incomplete = false;
  const view = render(<DeliveryStatusNotice />);
  expect(mock.dismiss).toHaveBeenCalledWith(`delivery-${mock.userId}`);
  expect(mock.success).not.toHaveBeenCalled();
  mock.health.state = 'pending';
  view.rerender(<DeliveryStatusNotice />);
  expect(mock.warning).not.toHaveBeenCalled();
});

it('lists every reported delivery detail and marks missing counts as unknown', () => {
  mock.health.devices = [
    {
      device_id: 'abcdef1234567890',
      queue_id: 'queue',
      pending: null,
      dead_letter: undefined,
      capture: { status: 'fresh', last_scan_success_at: at, parser_errors: 0, pending: 0 },
      details: {
        eligible: 1,
        leased: 0,
        accepted_total: 5,
        next_retry_at: at,
        oldest_event_at: at,
        backlog_error: { message_code: 'auth_401', http_status: 401, failed_at: at },
      },
      last_successful_delivery_at: at,
    },
  ] as unknown as typeof DEFAULT_DEVICES;
  try {
    render(<DeliveryStatusNotice />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Pending: unknown · Dead letters: unknown');
    expect(status).toHaveTextContent('abcdef12 · capture fresh');
    expect(status).toHaveTextContent('auth_401 (HTTP 401) at');
    expect(status).toHaveTextContent(new Date(at).toLocaleString());
  } finally {
    mock.health.devices = DEFAULT_DEVICES;
  }
});
