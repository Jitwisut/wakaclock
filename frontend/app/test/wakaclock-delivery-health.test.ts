import { describe, expect, it } from 'vitest';

import { deliveryHealth, syncSummary } from '@/lib/wakaclock/delivery-health';
import type { DeliveryStatusResponse } from '@/lib/wakaclock/measurement-types';

const now = Date.parse('2026-10-07T05:00:00Z');
function report(
  overrides: Partial<DeliveryStatusResponse['devices'][number]> = {}
): DeliveryStatusResponse {
  return {
    storage: 'postgres',
    devices: [
      {
        capture: {
          pipeline: [
            {
              adapter_id: 'codex',
              execution_surface: 'cli',
              stage: 'context',
              status: 'observed',
              pending: 0,
              failure_count: 0,
              last_observed_at: new Date(now).toISOString(),
              oldest_pending_at: null,
              error_code: null,
              version: 'fixture',
            },
          ],
          schema_version: 1,
          captured_at: new Date(now).toISOString(),
          enabled: true,
          status: 'fresh',
          last_scan_success_at: new Date(now).toISOString(),
          parser_errors: 0,
          pending: 0,
          producer_spool: {
            status: 'observed',
            pending: 0,
            accepted: 0,
            failure_count: 0,
            paused_excluded: 0,
            last_scan_success_at: new Date(now).toISOString(),
          },
          editor_journal: {
            status: 'ready',
            pending: 0,
            dead_letter: 0,
            last_observed_at: new Date(now).toISOString(),
          },
        },
        schema_version: 2,
        age_seconds: 0,
        captured_at: new Date(now).toISOString(),
        received_at: new Date(now).toISOString(),
        device_id: 'device',
        queue_id: 'opaque',
        sequence: 1,
        status: 'fresh',
        pending: 0,
        retry: 0,
        dead_letter: 0,
        oldest_pending_at: null,
        last_successful_delivery_at: new Date(now).toISOString(),
        details: {
          eligible: 0,
          leased: 0,
          next_retry_at: null,
          oldest_event_at: null,
          accepted_total: 1,
          backlog_error: null,
        },
        ...overrides,
      },
    ],
  };
}
describe('delivery completeness', () => {
  it('retains upstream journal problems even when server delivery is complete', () => {
    const data = report();
    data.devices[0].capture!.editor_journal!.pending = 3;
    expect(deliveryHealth(data, false, now).state).toBe('pending');
    data.devices[0].capture!.editor_journal!.status = 'corrupt';
    expect(deliveryHealth(data, false, now).state).toBe('critical');
    data.devices[0].capture!.editor_journal = undefined;
    expect(deliveryHealth(data, false, now).state).toBe('unknown');
  });
  it('keeps producer failures, pending and historical gaps visible after successful delivery', () => {
    const data = report();
    const capture = data.devices[0].capture!;
    capture.producer_spool!.pending = 3;
    expect(deliveryHealth(data, false, now).state).toBe('pending');
    capture.producer_spool!.failure_count = 1;
    expect(deliveryHealth(data, false, now).state).toBe('critical');
    capture.producer_spool!.failure_count = 0;
    capture.producer_spool!.pending = 0;
    capture.editor_journal!.status = 'historical_incomplete';
    expect(deliveryHealth(data, false, now)).toMatchObject({ state: 'warning', incomplete: true });
    capture.editor_journal!.status = 'ready';
    delete capture.producer_spool;
    expect(deliveryHealth(data, false, now).state).toBe('unknown');
  });
  it('new successful delivery never hides the remaining backlog', () => {
    const result = deliveryHealth(
      report({ pending: 1191, oldest_pending_at: new Date(now - 60_000).toISOString() }),
      false,
      now
    );
    expect(result).toMatchObject({ state: 'pending', pending: 1191, incomplete: true });
    expect(deliveryHealth(report(), false, now)).toMatchObject({
      state: 'complete',
      incomplete: false,
    });
  });
  it.each([
    [301, 'warning'],
    [1801, 'critical'],
  ] as const)('escalates at %s seconds', (age, state) => {
    expect(
      deliveryHealth(
        report({ pending: 1, oldest_pending_at: new Date(now - age * 1000).toISOString() }),
        false,
        now
      ).state
    ).toBe(state);
  });
  it('marks old, unavailable and v1 snapshots as unconfirmed', () => {
    expect(
      deliveryHealth(report({ captured_at: new Date(now - 301_000).toISOString() }), false, now)
        .state
    ).toBe('stale');
    expect(deliveryHealth(report({ status: 'unavailable', pending: null }), false, now).state).toBe(
      'unavailable'
    );
    expect(
      deliveryHealth(report({ schema_version: 1, details: undefined }), false, now).state
    ).toBe('unknown');
    expect(deliveryHealth(undefined, true, now).state).toBe('unavailable');
    expect(deliveryHealth(undefined, false, now).incomplete).toBe(true);
  });
  it('escalates auth and recoverable dead letters immediately', () => {
    const data = report();
    data.devices[0].details!.backlog_error = {
      kind: 'auth_401',
      http_status: 403,
      message_code: 'credential_rejected',
      failed_at: new Date(now).toISOString(),
    };
    expect(deliveryHealth(data, false, now).state).toBe('critical');
    expect(deliveryHealth(report({ dead_letter: 1 }), false, now).state).toBe('critical');
    expect(
      deliveryHealth(report({ schema_version: 1, details: undefined, dead_letter: 1 }), false, now)
        .state
    ).toBe('critical');
    data.devices[0].captured_at = new Date(now - 301_000).toISOString();
    expect(deliveryHealth(data, false, now).state).toBe('critical');
  });
  it('does not confuse an empty delivery queue with complete capture', () => {
    const data = report();
    const capture = data.devices[0].capture!;
    capture.parser_errors = 1;
    capture.status = 'parser_failure';
    expect(deliveryHealth(data, false, now)).toMatchObject({ state: 'critical', incomplete: true });
    capture.parser_errors = 0;
    capture.status = 'fresh';
    capture.captured_at = new Date(now - 301_000).toISOString();
    expect(deliveryHealth(data, false, now).state).toBe('stale');
    capture.captured_at = new Date(now).toISOString();
    capture.pending = 2;
    expect(deliveryHealth(data, false, now).incomplete).toBe(true);
  });
});

it('context failure and parser failure remain visible while heartbeat delivery is pending', () => {
  const data = report({ pending: 2, oldest_pending_at: new Date(now - 60000).toISOString() });
  data.devices[0].capture!.parser_errors = 1;
  expect(deliveryHealth(data, false, now).state).toBe('critical');
  data.devices[0].capture!.parser_errors = 0;
  data.devices[0].capture!.pipeline![0].status = 'auth_required';
  expect(deliveryHealth(data, false, now).state).toBe('critical');
  data.devices[0].capture!.pipeline![0].status = 'observed';
  delete data.devices[0].capture!.pipeline;
  expect(deliveryHealth(data, false, now).state).toBe('unknown');
});

describe('on-demand clients without a background collector', () => {
  function onDemand(overrides: Partial<DeliveryStatusResponse['devices'][number]> = {}) {
    const data = report(overrides);
    const capture = data.devices[0].capture!;
    // Leftover state of an uninstalled collector: disabled, stale, old parser errors.
    Object.assign(capture, {
      enabled: false,
      status: 'disabled',
      captured_at: new Date(now - 2 * 86_400_000).toISOString(),
      parser_errors: 6,
    });
    delete capture.producer_spool;
    delete capture.pipeline;
    return data;
  }

  it('treats an emptied queue with a ready journal as complete', () => {
    expect(deliveryHealth(onDemand(), false, now)).toMatchObject({
      state: 'complete',
      incomplete: false,
    });
  });

  it('does not call an idle, emptied on-demand snapshot stale', () => {
    const old = new Date(now - 600_000).toISOString();
    expect(deliveryHealth(onDemand({ captured_at: old, received_at: old }), false, now).state).toBe(
      'complete'
    );
    expect(
      deliveryHealth(onDemand({ captured_at: old, received_at: old, pending: 2 }), false, now).state
    ).toBe('stale');
  });

  it('still reports backlog, journal and reported producer failures', () => {
    expect(
      deliveryHealth(
        onDemand({ pending: 1, oldest_pending_at: new Date(now - 1801_000).toISOString() }),
        false,
        now
      ).state
    ).toBe('critical');
    const journal = onDemand();
    journal.devices[0].capture!.editor_journal!.status = 'corrupt';
    expect(deliveryHealth(journal, false, now).state).toBe('critical');
    const spool = onDemand();
    spool.devices[0].capture!.producer_spool = {
      status: 'observed',
      pending: null,
      accepted: 0,
      failure_count: 0,
      paused_excluded: 0,
      last_scan_success_at: new Date(now).toISOString(),
    };
    expect(deliveryHealth(spool, false, now).state).toBe('unknown');
    const pipeline = onDemand();
    pipeline.devices[0].capture!.pipeline = report().devices[0].capture!.pipeline!.map((stage) => ({
      ...stage,
      status: 'auth_required',
    }));
    expect(deliveryHealth(pipeline, false, now).state).toBe('critical');
  });

  it('treats a device with no capture object as an editor that is not running', () => {
    const data = report();
    delete data.devices[0].capture;
    expect(deliveryHealth(data, false, now).state).toBe('complete');
  });

  it('treats a closed or idle editor with nothing pending as complete', () => {
    const old = new Date(now - 3_600_000).toISOString();
    for (const status of ['ready', 'stale', 'stopped', 'unavailable'] as const) {
      for (const pending of [0, null]) {
        const data = onDemand();
        Object.assign(data.devices[0].capture!.editor_journal!, {
          status,
          pending,
          last_observed_at: old,
        });
        expect(deliveryHealth(data, false, now).state).toBe('complete');
      }
    }
    const missing = onDemand();
    delete missing.devices[0].capture!.editor_journal;
    expect(deliveryHealth(missing, false, now).state).toBe('complete');
  });

  it('still reports editor activity the journal has not handed off', () => {
    const stale = onDemand();
    Object.assign(stale.devices[0].capture!.editor_journal!, { status: 'stale', pending: 3 });
    expect(deliveryHealth(stale, false, now).state).toBe('stale');
    const waiting = onDemand();
    waiting.devices[0].capture!.editor_journal!.pending = 2;
    expect(deliveryHealth(waiting, false, now).state).toBe('pending');
    const dead = onDemand();
    Object.assign(dead.devices[0].capture!.editor_journal!, { status: 'stale', dead_letter: 1 });
    expect(deliveryHealth(dead, false, now).state).toBe('critical');
    const paused = onDemand();
    paused.devices[0].capture!.editor_journal!.status = 'paused_by_user';
    expect(deliveryHealth(paused, false, now).state).toBe('unavailable');
  });
});

it('reports stale editor journal and producer spool observations', () => {
  const journal = report();
  journal.devices[0].capture!.editor_journal!.last_observed_at = new Date(
    now - 301_000
  ).toISOString();
  expect(deliveryHealth(journal, false, now).state).toBe('stale');
  const spool = report();
  spool.devices[0].capture!.producer_spool!.last_scan_success_at = new Date(
    now - 301_000
  ).toISOString();
  expect(deliveryHealth(spool, false, now).state).toBe('stale');
});

it('treats an unreported dead-letter count as zero', () => {
  expect(deliveryHealth(report({ dead_letter: null }), false, now).deadLetter).toBe(0);
});

describe('sync summary', () => {
  const backlog = (kind: null | string, pending = 2128) =>
    report({
      pending,
      oldest_pending_at: pending ? '2026-10-06T09:51:01Z' : null,
      details: {
        eligible: 0,
        leased: 0,
        next_retry_at: null,
        oldest_event_at: null,
        accepted_total: 1,
        backlog_error: kind
          ? { kind, message_code: 'x', http_status: null, failed_at: '2026-10-07T04:00:00Z' }
          : null,
      },
    });
  const summarize = (data: DeliveryStatusResponse) =>
    syncSummary(deliveryHealth(data, false, now), data.devices);

  it('reports a fully delivered queue as synced', () => {
    expect(summarize(report())).toMatchObject({ tone: 'ok', title: 'All activity synced' });
  });
  it('names the reported cause instead of the raw pipeline readout', () => {
    expect(summarize(backlog('network'))).toMatchObject({
      tone: 'attention',
      title: "Can't reach the server",
    });
    expect(summarize(backlog('network')).detail).toMatch(
      /^2,128 heartbeats saved on your device since /
    );
    expect(summarize(backlog('auth_401')).title).toBe('API key not accepted');
    expect(summarize(backlog('payment_402')).title).toBe('Subscription needed to sync');
    expect(summarize(backlog('server_error')).title).toBe('Server asked to retry later');
    expect(summarize(backlog('validation')).title).toBe('Sending 2,128 queued heartbeats');
  });
  it('does not blame the server for an upstream capture failure', () => {
    const data = backlog('network');
    data.devices[0].capture!.editor_journal!.status = 'corrupt';
    expect(summarize(data)).toMatchObject({
      tone: 'attention',
      title: 'Capture needs attention',
      detail: expect.stringMatching(/^Editor capture needs attention/),
    });
  });
  it('keeps a fresh queue amber and singular', () => {
    const data = backlog('network', 1);
    data.devices[0].oldest_pending_at = new Date(now - 60_000).toISOString();
    expect(summarize(data)).toMatchObject({ tone: 'syncing' });
    expect(summarize(data).detail).toMatch(/^1 heartbeat saved/);
    data.devices[0].oldest_pending_at = null;
    expect(summarize(data).detail).toBe(
      '1 heartbeat saved on your device. They will send automatically when the server is reachable.'
    );
  });
  it('ignores a stale error once the queue is empty and falls back to the health message', () => {
    const data = backlog('network', 0);
    data.devices[0].capture!.editor_journal!.pending = 3;
    const health = deliveryHealth(data, false, now);
    expect(syncSummary(health, data.devices)).toEqual({
      tone: 'syncing',
      title: 'Sync not confirmed',
      detail: health.message,
    });
    expect(syncSummary(health, [{ ...data.devices[0], pending: null }]).title).toBe(
      'Sync not confirmed'
    );
  });
});
