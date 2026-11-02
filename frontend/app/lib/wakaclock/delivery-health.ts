import type { DeliveryStatusResponse } from '@/lib/wakaclock/measurement-types';
import { assessPipeline, healthRank } from '@/lib/wakaclock/pipeline-health';

export interface DeliveryHealth {
  deadLetter: number;
  incomplete: boolean;
  message: string;
  pending: number;
  state: 'complete' | 'critical' | 'pending' | 'stale' | 'unavailable' | 'unknown' | 'warning';
}

type DeliveryDevice = DeliveryStatusResponse['devices'][number];

const BACKLOG_ATTENTION_MESSAGE =
  'Delivery needs attention: an old backlog, permissions or recoverable dead letters remain. Any stale or missing details leave completion unconfirmed.';

/** No background collector on this device (never installed, or uninstalled):
 * the client runs on demand, so collector evidence is not expected. */
const isOnDemand = (device: DeliveryDevice) => !device.capture || device.capture.enabled === false;

/** An on-demand client only reports when it runs. An idle, emptied queue is
 * still the latest truth, not a stale snapshot. */
const isIdleOnDemand = (device: DeliveryDevice) =>
  isOnDemand(device) && !device.pending && !device.dead_letter;

/** On an on-demand device a closed or idle editor (or one that exited before its final
 * report) leaves a journal that is stopped, unavailable, stale or an aged-out ready with
 * nothing pending: the editor is not running, which is not missing data. */
const isClosedEditor = (device: DeliveryDevice) => {
  if (!isOnDemand(device)) return false;
  const journal = device.capture?.editor_journal;
  if (!journal) return true;
  return (
    !journal.dead_letter &&
    !journal.pending &&
    ['ready', 'stale', 'stopped', 'unavailable'].includes(journal.status)
  );
};

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
    message = BACKLOG_ATTENTION_MESSAGE;
  } else if (unavailable || devices.some((device) => device.status === 'unavailable')) {
    state = 'unavailable';
    message = 'Delivery status unavailable. Check the local client for queued data.';
  } else if (
    devices.some(
      (device) =>
        !isIdleOnDemand(device) &&
        (device.status === 'stale' ||
          now - Date.parse(device.captured_at) > 300_000 ||
          now - Date.parse(device.received_at) > 300_000)
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
        !isOnDemand(device) &&
        (device.capture!.parser_errors > 0 || device.capture!.status === 'parser_failure')
    )
  ) {
    state = 'critical';
    message = 'Capture failed to parse activity. Retained events still need processing.';
  }
  if (state === 'complete') {
    // Only installed collectors are judged; on-demand devices report no collector.
    const capture = devices
      .filter((device) => !isOnDemand(device))
      .map((device) => device.capture!);
    if (capture.some((c) => now - Date.parse(c.captured_at) > 300_000)) {
      state = 'stale';
      message = 'Capture status is stale. Data completeness is unconfirmed.';
    } else if (
      capture.some((c) => c.status !== 'fresh' || !c.last_scan_success_at || c.pending > 0)
    ) {
      state = 'unavailable';
      message = 'Capture is unavailable or events await processing. Data remains incomplete.';
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
    const open = devices
      .filter((device) => !isClosedEditor(device))
      .map((device) => device.capture?.editor_journal);
    if (open.some((journal) => !journal || journal.pending == null)) {
      state = 'unknown';
      message = 'Editor journal details not available. Completion remains unconfirmed.';
    } else if (
      open.some(
        (journal) =>
          journal &&
          (journal.status === 'stale' || now - Date.parse(journal.last_observed_at) > 300_000)
      )
    ) {
      state = 'stale';
      message = 'Editor journal status is stale. Check the local client.';
    } else if (open.some((journal) => journal && journal.status !== 'ready')) {
      state = 'unavailable';
      message = 'Editor capture is paused or unavailable. Existing data is retained.';
    } else if (open.some((journal) => journal!.pending! > 0)) {
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
      devices.some((device, index) => {
        const spool = spools[index];
        if (!spool) return !isOnDemand(device);
        return (
          spool.pending == null || !spool.last_scan_success_at || spool.status === 'unconfirmed'
        );
      })
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
    if (isOnDemand(device) && !device.capture?.pipeline?.length) continue;
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

export type SyncTone = 'attention' | 'ok' | 'syncing';

export interface SyncSummary {
  detail: string;
  title: string;
  tone: SyncTone;
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** One plain-language line for the header indicator and the Sync status page.
 * It reads the same `deliveryHealth` state (no new thresholds) and names the
 * reported cause instead of listing every pipeline field. */
export function syncSummary(
  health: Pick<DeliveryHealth, 'message' | 'pending' | 'state'>,
  devices: DeliveryDevice[]
): SyncSummary {
  if (health.state === 'complete') {
    return { tone: 'ok', title: 'All activity synced', detail: health.message };
  }
  const tone: SyncTone = health.state === 'critical' ? 'attention' : 'syncing';
  // Capture, journal or spool failures outrank the delivery backlog in deliveryHealth;
  // say so rather than blaming the server for them.
  if (health.state === 'critical' && health.message !== BACKLOG_ATTENTION_MESSAGE) {
    return { tone, title: 'Capture needs attention', detail: health.message };
  }
  // A recorded error only explains a queue that still holds rows.
  const waiting = devices.filter((device) => (device.pending ?? 0) > 0);
  const kinds = new Set(waiting.map((device) => device.details?.backlog_error?.kind));
  const oldest = waiting
    .map((device) => device.oldest_pending_at)
    .filter(Boolean)
    .sort()[0];
  const since = oldest ? ` since ${formatWhen(oldest)}` : '';
  const queued = `${health.pending.toLocaleString()} heartbeat${health.pending === 1 ? '' : 's'} saved on your device${since}`;
  if (kinds.has('auth_401')) {
    return {
      tone,
      title: 'API key not accepted',
      detail: `${queued}. Update the API key in your editor to resume sending.`,
    };
  }
  if (kinds.has('payment_402')) {
    return {
      tone,
      title: 'Subscription needed to sync',
      detail: `${queued}. They will send once your plan is active.`,
    };
  }
  if (kinds.has('network')) {
    return {
      tone,
      title: "Can't reach the server",
      detail: `${queued}. They will send automatically when the server is reachable.`,
    };
  }
  if (kinds.has('server_error')) {
    return {
      tone,
      title: 'Server asked to retry later',
      detail: `${queued}. Retrying automatically.`,
    };
  }
  if (health.pending > 0) {
    return {
      tone,
      title: `Sending ${health.pending.toLocaleString()} queued heartbeats`,
      detail: 'Totals may rise as queued activity arrives.',
    };
  }
  return { tone, title: 'Sync not confirmed', detail: health.message };
}
