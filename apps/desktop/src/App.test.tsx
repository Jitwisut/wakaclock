// @vitest-environment jsdom
/**
 * Offline-reliability Phase 00 — desktop polling regression harness.
 *
 * This started as a failing baseline test in Phase 00 and is enforced since
 * Phase 05. Never weaken the assertion.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSnapshot, DesktopSettings } from './types';

const snapshot = vi.fn<() => Promise<DashboardSnapshot>>();
const settings = vi.fn<() => Promise<DesktopSettings>>();

vi.mock('./lib/tauri', () => ({
  desktopApi: {
    snapshot: () => snapshot(),
    settings: () => settings(),
    updateSettings: vi.fn(),
    refreshNow: vi.fn(),
  },
}));

// Imported after the mock so App binds to the fake desktop API.
const { default: App } = await import('./App');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

describe('desktop dashboard polling', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    snapshot.mockReset();
    settings.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('desktop_interval_and_manual_refresh_share_one_in_flight_request', async () => {
    settings.mockResolvedValue({
      enabled: true,
      idle_timeout_seconds: 300,
      private_mode: false,
      title_tracking: false,
      denied_app_names: [],
      denied_window_patterns: [],
      rules: [],
    } as never);
    let resolveSnapshot: ((value: never) => void) | undefined;
    snapshot.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSnapshot = resolve as (value: never) => void;
        }),
    );

    await act(async () => {
      root.render(<App />);
    });
    expect(snapshot).toHaveBeenCalledTimes(1);

    // Interval ticks and the manual Refresh button while that request hangs:
    // every one of them collapses into the single queued follow-up.
    for (let tick = 0; tick < 4; tick += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
    }
    const refreshButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Refresh'),
    );
    await act(async () => {
      refreshButton?.click();
      refreshButton?.click();
    });
    expect(snapshot).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSnapshot?.(undefined as never);
      await vi.advanceTimersByTimeAsync(0);
    });

    // Exactly one follow-up for everything that arrived while it was in flight.
    expect(snapshot).toHaveBeenCalledTimes(2);
  });

  // OFF-07: the 5s interval calls `dashboard_snapshot` again while the previous
  // call is still waiting on a hung HTTP request, stacking one request per tick.
  it('desktop_refresh_is_single_flight', async () => {
    settings.mockReturnValue(never());
    snapshot.mockReturnValue(never());

    await act(async () => {
      root.render(<App />);
    });
    // The initial load issues one snapshot request that never completes.
    expect(snapshot).toHaveBeenCalledTimes(1);

    // Thirty seconds of fake time while that request hangs.
    for (let tick = 0; tick < 6; tick += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
    }

    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});
