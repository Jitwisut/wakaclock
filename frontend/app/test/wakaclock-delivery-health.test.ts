import { describe, expect, it } from 'vitest';

import { deliveryHealth } from '@/lib/wakaclock/delivery-health';
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
    delete data.devices[0].capture;
    expect(deliveryHealth(data, false, now)).toMatchObject({ state: 'unknown', incomplete: true });
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

  it('keeps requiring editor journal evidence when no capture object is sent', () => {
    const data = report();
    delete data.devices[0].capture;
    expect(deliveryHealth(data, false, now).message).toMatch(/Editor journal details/);
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
