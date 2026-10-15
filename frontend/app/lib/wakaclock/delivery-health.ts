import type { DeliveryStatusResponse } from '@/lib/wakaclock/measurement-types';
import { assessPipeline, healthRank } from '@/lib/wakaclock/pipeline-health';

export interface DeliveryHealth {
  deadLetter: number;
  incomplete: boolean;
  message: string;
  pending: number;
  state: 'complete' | 'critical' | 'pending' | 'stale' | 'unavailable' | 'unknown' | 'warning';
}

/** A successful new send is separate from a fully reconciled queue. Missing v2
 * details and old snapshots cannot establish completeness. */
// Each branch is one ordered delivery/pipeline signal; splitting it would obscure the precedence.
// eslint-disable-next-line sonarjs/cognitive-complexity
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
  // Upstream critical failures stay visible even while server delivery is pending.
  if (
    devices.some(
      (device) =>
        device.capture &&
        (device.capture.parser_errors > 0 || device.capture.status === 'parser_failure')
    )
  ) {
    state = 'critical';
    message = 'Capture failed to parse activity. Retained events still need processing.';
  }
  if (state === 'complete') {
    const capture = devices.map((device) => device.capture);
    if (capture.some((c) => c && (c.parser_errors > 0 || c.status === 'parser_failure'))) {
      state = 'critical';
      message =
        'Capture failed to parse activity. Delivery may be complete while events remain uncaptured.';
    } else if (capture.some((c) => c && now - Date.parse(c.captured_at) > 300_000)) {
      state = 'stale';
      message = 'Capture status is stale. Data completeness is unconfirmed.';
    } else if (
      capture.some((c) => c && (c.status !== 'fresh' || !c.last_scan_success_at || c.pending > 0))
    ) {
      state = 'unavailable';
      message = 'Capture is unavailable or events await processing. Data remains incomplete.';
    } else if (capture.some((c) => !c || !c.enabled)) {
      state = 'unknown';
      message =
        'Capture details not available or capture is disabled. Update/check the local collector.';
    }
  }
  const journals = devices.map((device) => device.capture?.editor_journal);
  if (
    journals.some(
      (journal) =>
        journal &&
        (journal.dead_letter > 0 || ['corrupt', 'write_failure', 'locked'].includes(journal.status))
    )
  ) {
    state = 'critical';
    message =
      'Editor capture needs attention. Durable journal or handoff failed; queued data is retained.';
  } else if (state === 'complete') {
    if (journals.some((journal) => !journal || journal.pending == null)) {
      state = 'unknown';
      message = 'Editor journal details not available. Completion remains unconfirmed.';
    } else if (
      journals.some(
        (journal) =>
          journal &&
          (journal.status === 'stale' || now - Date.parse(journal.last_observed_at) > 300_000)
      )
    ) {
      state = 'stale';
      message = 'Editor journal status is stale. Check the local client.';
    } else if (journals.some((journal) => journal && journal.status !== 'ready')) {
      state = 'unavailable';
      message = 'Editor capture is paused or unavailable. Existing data is retained.';
    } else if (journals.some((journal) => (journal?.pending ?? 0) > 0)) {
      state = 'pending';
      message =
        'Editor activity awaits durable CLI handoff. An empty server queue does not confirm completeness.';
    }
  }
  const spools = devices.map((device) => device.capture?.producer_spool);
  if (
    spools.some((spool) => spool && (spool.status === 'capture_failure' || spool.failure_count > 0))
  ) {
    state = 'critical';
    message =
      'Producer spool needs attention. Retained metadata has not completed durable handoff.';
  } else if (
    journals.some((journal) => journal?.status === 'historical_incomplete') &&
    ['complete', 'unavailable'].includes(state)
  ) {
    state = 'warning';
    message = 'Journal can accept new activity, but recovered history remains incomplete.';
  } else if (state === 'complete') {
    if (
      spools.some(
        (spool) =>
          !spool ||
          spool.pending == null ||
          !spool.last_scan_success_at ||
          spool.status === 'unconfirmed'
      )
    ) {
      state = 'unknown';
      message =
        'Producer capture details are unconfirmed. An empty queue does not establish complete capture.';
    } else if (
      spools.some((spool) => spool && now - Date.parse(spool.last_scan_success_at!) > 300_000)
    ) {
      state = 'stale';
      message = 'Producer spool observation is stale. Data completeness is unconfirmed.';
    } else if (
      spools.some((spool) => spool && (spool.pending! > 0 || spool.status !== 'observed'))
    ) {
      state = 'pending';
      message =
        'Producer metadata awaits durable handoff. Keep retained data and check the local collector.';
    }
  }
  for (const device of devices) {
    const pipeline = assessPipeline(device.capture?.pipeline, now);
    if (healthRank[pipeline.state] > healthRank[state]) {
      ({ state } = pipeline);
      message = pipeline.stage
        ? `${pipeline.stage.adapter_id}/${pipeline.stage.execution_surface} ${pipeline.stage.stage}: ${pipeline.stage.status}. Data completeness remains unconfirmed.`
        : 'Context and pipeline details are unavailable. Update/check the local client.';
    }
  }
  return { incomplete: state !== 'complete', state, pending, deadLetter, message };
}
