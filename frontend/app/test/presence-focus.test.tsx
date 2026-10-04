import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FocusControl, formatFocusClock } from '@/components/presence/FocusControl';
import { focusingUntil, PixelOfficeDirectory } from '@/components/presence/PixelOfficeDirectory';
import { PresenceHeader } from '@/components/presence/PresenceHeader';
import {
  clampFocusSeconds,
  FOCUS_MAX_SECONDS,
  FOCUS_MIN_SECONDS,
  type PresenceFocusController,
  usePresenceFocus,
} from '@/hooks/use-presence-focus';
import { toPresenceUser } from '@/types/presence';

const api = vi.hoisted(() => ({ end: vi.fn(), get: vi.fn(), start: vi.fn() }));

vi.mock('@/lib/wakaclock/endpoints-v2', () => ({
  endMyPresenceFocusV2: api.end,
  getMyPresenceFocusV2: api.get,
  startMyPresenceFocusV2: api.start,
}));

const inAnHour = () => Math.floor(Date.now() / 1000) + 3600;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('focus helpers', () => {
  it('clamps durations to the server bounds', () => {
    expect(clampFocusSeconds(60)).toBe(FOCUS_MIN_SECONDS);
    expect(clampFocusSeconds(24 * 3600)).toBe(FOCUS_MAX_SECONDS);
    expect(clampFocusSeconds(1500.4)).toBe(1500);
  });

  it('only counts a focus block while it is running', () => {
    const user = toPresenceUser(
      {
        focus_until: 2000,
        position: null,
        state: 'coding',
        user_id: 'u',
        username: 'amy',
        zone_id: null,
      },
      'x'
    );
    expect(focusingUntil(user, 1999)).toBe(2000);
    expect(focusingUntil(user, 2000)).toBeNull();
    expect(focusingUntil({ ...user, focusUntil: undefined }, 0)).toBeNull();
    expect(formatFocusClock(2000)).toMatch(/\d/);
  });
});

describe('usePresenceFocus', () => {
  it('loads, starts, ends, and drops a block once it is over', async () => {
    api.get.mockResolvedValue({ until: inAnHour() });
    const { result } = renderHook(() => usePresenceFocus(true));
    await waitFor(() => expect(result.current.active).toBe(true));

    api.start.mockResolvedValue({ until: Math.floor(Date.now() / 1000) + 1 });
    await act(async () => {
      expect(await result.current.start(60)).toBe(true);
    });
    expect(api.start).toHaveBeenCalledWith(FOCUS_MIN_SECONDS);
    await waitFor(() => expect(result.current.active).toBe(false), { timeout: 2500 });

    api.start.mockResolvedValue(null);
    await act(async () => {
      await result.current.start(600);
    });
    expect(result.current.until).toBeNull();

    api.end.mockResolvedValue(undefined);
    await act(async () => {
      expect(await result.current.end()).toBe(true);
    });
  });

  it('reports failures and treats a missing block as inactive', async () => {
    api.get.mockResolvedValue(null);
    const { result } = renderHook(() => usePresenceFocus(true));
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(result.current.active).toBe(false);

    api.start.mockRejectedValue(new Error('focus must last between 5 minutes and 8 hours'));
    await act(async () => {
      expect(await result.current.start(600)).toBe(false);
    });
    expect(result.current.error).toBe('focus must last between 5 minutes and 8 hours');

    api.end.mockRejectedValue('down');
    await act(async () => {
      expect(await result.current.end()).toBe(false);
    });
    expect(result.current.error).toBe('Could not end focus mode');
  });

  it('handles load errors, stays idle when disabled, and ignores late responses', async () => {
    api.get.mockRejectedValueOnce('nope');
    const failing = renderHook(() => usePresenceFocus(true));
    await waitFor(() => expect(failing.result.current.error).toBe('Could not load focus mode'));

    api.get.mockRejectedValueOnce(new Error('Redis is required for Presence v2'));
    const failingError = renderHook(() => usePresenceFocus(true));
    await waitFor(() =>
      expect(failingError.result.current.error).toBe('Redis is required for Presence v2')
    );

    api.start.mockRejectedValueOnce('nope');
    await act(async () => {
      await failingError.result.current.start(600);
    });
    expect(failingError.result.current.error).toBe('Could not start focus mode');

    api.get.mockClear();
    renderHook(() => usePresenceFocus(false));
    expect(api.get).not.toHaveBeenCalled();

    let resolve!: (value: { until: number }) => void;
    api.get.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const late = renderHook(() => usePresenceFocus(true));
    late.unmount();
    await act(async () => resolve({ until: inAnHour() }));

    let reject!: (error: Error) => void;
    api.get.mockReturnValueOnce(new Promise((_, r) => (reject = r)));
    const lateError = renderHook(() => usePresenceFocus(true));
    lateError.unmount();
    await act(async () => reject(new Error('late')));
  });
});

function controller(overrides: Partial<PresenceFocusController> = {}): PresenceFocusController {
  return {
    active: false,
    busy: false,
    end: vi.fn(async () => true),
    error: null,
    start: vi.fn(async () => true),
    until: null,
    ...overrides,
  };
}

describe('FocusControl', () => {
  it('starts a focus block from the menu and closes it', async () => {
    const focus = controller();
    render(<FocusControl focus={focus} />);

    fireEvent.click(screen.getByRole('button', { name: /Focus/ }));
    expect(screen.getByRole('group', { name: 'Start focus mode' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '50 min' }));

    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Start focus mode' })).toBeNull()
    );
    expect(focus.start).toHaveBeenCalledWith(3000);
  });

  it('keeps the menu open with the error when starting fails', async () => {
    const focus = controller({
      error: 'Could not start focus mode',
      start: vi.fn(async () => false),
    });
    render(<FocusControl focus={focus} />);

    fireEvent.click(screen.getByRole('button', { name: /Focus/ }));
    fireEvent.click(screen.getByRole('button', { name: '25 min' }));

    await waitFor(() => expect(focus.start).toHaveBeenCalled());
    expect(screen.getByRole('alert')).toHaveTextContent('Could not start focus mode');
    expect(screen.getByRole('group', { name: 'Start focus mode' })).toBeInTheDocument();
  });

  it('shows the running block with an end action and any error', () => {
    const focus = controller({
      active: true,
      error: 'Could not end focus mode',
      until: inAnHour(),
    });
    render(<FocusControl focus={focus} />);

    expect(screen.getByRole('status')).toHaveTextContent(/Focusing until/);
    fireEvent.click(screen.getByRole('button', { name: 'End focus mode' }));
    expect(focus.end).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not end focus mode');
  });

  it('shows a running block without an error line', () => {
    render(<FocusControl focus={controller({ active: true, until: inAnHour() })} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('focus in the header and roster', () => {
  it('renders the focus slot in the header', () => {
    render(<PresenceHeader focusControl={<span>focus-slot</span>} />);

    expect(screen.getByText('focus-slot')).toBeInTheDocument();
  });

  it('badges members who are focusing, until their block ends', () => {
    const now = 1_000;
    render(
      <PixelOfficeDirectory
        reducedMotion
        serverTime={now}
        users={[
          {
            focusUntil: 2_000,
            id: 'a',
            isCurrentUser: false,
            status: 'coding',
            username: 'amy',
            x: 1,
            y: 1,
          },
          {
            focusUntil: 900,
            id: 'b',
            isCurrentUser: false,
            status: 'idle',
            username: 'bo',
            x: 1,
            y: 1,
          },
        ]}
        zones={[]}
      />
    );

    expect(screen.getAllByLabelText(/^Focusing until/)).toHaveLength(1);
  });
});
