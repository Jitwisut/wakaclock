import type { DeliveryStatusResponse } from '@/lib/wakaclock/measurement-types';

export interface DeliveryHealth {
  deadLetter: number;
  incomplete: boolean;
  message: string;
  pending: number;
  state: 'complete' | 'critical' | 'pending' | 'stale' | 'unavailable' | 'unknown' | 'warning';
}

/** A successful new send is separate from a fully reconciled queue. Missing v2
 * details and old snapshots cannot establish completeness. */
export function deliveryHealth(
  data: DeliveryStatusResponse | undefined,
  unavailable = false,
  now = Date.now()
): DeliveryHealth {
  const devices = data?.devices ?? [];
  const pending = devices.reduce((n, device) => n + (device.pending ?? 0), 0);
  const deadLetter = devices.reduce((n, device) => n + (device.dead_letter ?? 0), 0);
  let state: DeliveryHealth['state'] = 'complete';
  let message = 'Backlog delivered — all reported queues are acknowledged.';
  const oldestAge = Math.max(
    0,
    ...devices.map((device) =>
      device.oldest_pending_at ? (now - Date.parse(device.oldest_pending_at)) / 1000 : 0
    )
  );
  const critical =
    deadLetter > 0 ||
    oldestAge > 1800 ||
    devices.some((device) =>
      ['auth_401', 'payment_402'].includes(device.details?.backlog_error?.kind ?? '')
    );
  if (critical) {
    state = 'critical';
    message =
      'Delivery needs attention: an old backlog, permissions or recoverable dead letters remain. Any stale or missing details leave completion unconfirmed.';
  } else if (unavailable || devices.some((device) => device.status === 'unavailable')) {
    state = 'unavailable';
    message = 'Delivery status unavailable. Check the local client for queued data.';
  } else if (
    devices.some(
      (device) =>
        device.status === 'stale' ||
        now - Date.parse(device.captured_at) > 300_000 ||
        now - Date.parse(device.received_at) > 300_000
    )
  ) {
    state = 'stale';
    message = 'Delivery snapshot is stale (over 5 minutes). Queue completion is unconfirmed.';
  } else if (
    devices.length === 0 ||
    devices.some((device) => device.schema_version !== 2 || !device.details)
  ) {
    state = 'unknown';
    message =
      'Delivery details not available. Update the client; data completeness is unconfirmed.';
  } else if (pending > 0 && oldestAge > 300) {
    state = 'warning';
    message = 'Heartbeats have been pending for over 5 minutes. Automatic retry is active.';
  } else if (pending > 0) {
    state = 'pending';
    message =
      'Heartbeats are pending. A new successful send does not confirm the backlog is complete.';
  }
  if (state === 'complete') {
    const capture = devices.map((device) => device.capture);
    if (capture.some((c) => c && (c.parser_errors > 0 || c.status === 'parser_failure'))) {
      state = 'critical';
      message = 'Capture failed to parse activity. Delivery may be complete while events remain uncaptured.';
    } else if (capture.some((c) => c && now - Date.parse(c.captured_at) > 300_000)) {
      state = 'stale';
      message = 'Capture status is stale. Data completeness is unconfirmed.';
    } else if (capture.some((c) => c && (c.status !== 'fresh' || !c.last_scan_success_at || c.pending > 0))) {
      state = 'unavailable';
      message = 'Capture is unavailable or events await processing. Data remains incomplete.';
    } else if (capture.some((c) => !c || !c.enabled)) {
      state = 'unknown';
      message = 'Capture details not available or capture is disabled. Update/check the local collector.';
    }
  }
  return { incomplete: state !== 'complete', state, pending, deadLetter, message };
}
