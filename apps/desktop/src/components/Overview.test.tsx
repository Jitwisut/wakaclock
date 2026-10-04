// @vitest-environment jsdom
/**
 * Offline-reliability Phase 04 — what the Overview says while the server is
 * unreachable. The rule these pin: an unknown total is never rendered as zero,
 * and a delivery problem is never presented as a tracker problem.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Overview } from './Overview';
import type { DashboardSnapshot } from '../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function snapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return {
    today_seconds: 0,
    today_text: '0m',
    heartbeat_count: 0,
    queued_seconds: 0,
    api_connected: true,
    runtime: {
      status: 'active',
      app_name: 'Code',
      app_identifier: 'com.microsoft.VSCode',
      category: 'coding',
      idle_seconds: 0,
      last_heartbeat_at: null,
      last_error: null,
    },
    session_seconds: 0,
    category_seconds: {},
    connection_state: 'online',
    confirmed_seconds: 0,
    display_total_seconds: 0,
    queued_heartbeats: 0,
    orphaned_heartbeats: 0,
    last_confirmed_at: null,
    server_snapshot_stale: false,
    coalesced_intents: 0,
    ...overrides,
  };
}

describe('Overview offline presentation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(next: DashboardSnapshot) {
    act(() => {
      root.render(<Overview loading={false} onRefresh={vi.fn()} snapshot={next} />);
    });
    return container.textContent ?? '';
  }

  it('offline_card_shows_queue_count_and_duration', () => {
    const text = render(
      snapshot({
        connection_state: 'offline',
        api_connected: false,
        queued_heartbeats: 5,
        queued_seconds: 75,
      }),
    );

    expect(text).toContain('Offline');
    expect(text).toContain('5 queued');
    expect(text).toContain('1m');
    // The old copy claimed protection without ever saying how much was held.
    expect(text).not.toContain('offline queue protected');
  });

  it('unknown_confirmed_total_is_not_rendered_as_zero', () => {
    const text = render(
      snapshot({
        connection_state: 'offline',
        api_connected: false,
        confirmed_seconds: null,
        display_total_seconds: null,
        today_text: 'Unknown',
        queued_heartbeats: 2,
        queued_seconds: 30,
      }),
    );

    expect(text).toContain('Unknown');
    expect(text).toContain('no server total read yet');
    expect(text).not.toContain('0m heartbeats');
  });

  it('stale_confirmed_total_is_labelled', () => {
    const text = render(
      snapshot({
        connection_state: 'offline',
        api_connected: false,
        confirmed_seconds: 1800,
        display_total_seconds: 1875,
        today_text: '31m',
        heartbeat_count: 12,
        queued_heartbeats: 5,
        queued_seconds: 75,
        last_confirmed_at: Math.floor(Date.now() / 1000) - 600,
        server_snapshot_stale: true,
      }),
    );

    expect(text).toContain('31m');
    expect(text).toContain('last confirmed 10m ago');
  });

  it('tracker_error_and_cloud_offline_are_presented_separately', () => {
    const offlineButTracking = render(
      snapshot({
        connection_state: 'offline',
        api_connected: false,
        queued_heartbeats: 1,
        queued_seconds: 15,
        runtime: { ...snapshot().runtime, status: 'active', last_error: null },
      }),
    );
    expect(offlineButTracking).toContain('Offline');
    expect(offlineButTracking).toContain('ACTIVE');

    const trackerBroken = render(
      snapshot({
        connection_state: 'online',
        runtime: {
          ...snapshot().runtime,
          status: 'unavailable',
          last_error: 'accessibility permission denied',
        },
      }),
    );
    expect(trackerBroken).toContain('Connected');
    expect(trackerBroken).toContain('accessibility permission denied');
  });

  it('a_rejected_key_is_not_reported_as_an_outage', () => {
    const text = render(
      snapshot({ connection_state: 'auth_rejected', api_connected: true, queued_heartbeats: 3, queued_seconds: 45 }),
    );

    expect(text).toContain('Key rejected');
    expect(text).not.toContain('Offline');
  });
});
