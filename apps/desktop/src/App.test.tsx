// @vitest-environment jsdom
/**
 * Offline-reliability Phase 00 — desktop polling regression harness.
 *
 * `it.fails(...)` marks an OFF-0x contract that is broken on the pre-fix code; the
 * phase that fixes it changes it to `it(...)`. Never weaken the assertion.
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

  // OFF-07: the 5s interval calls `dashboard_snapshot` again while the previous
  // call is still waiting on a hung HTTP request, stacking one request per tick.
  it.fails('desktop_refresh_is_single_flight', async () => {
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
