import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PixelOfficeDirectory } from '@/components/presence/PixelOfficeDirectory';
import { PresenceHeader } from '@/components/presence/PresenceHeader';
import {
  secondsUntilEndOfDay,
  STATUS_MAX_CHARS,
  StatusComposer,
  statusExpiryLabel,
} from '@/components/presence/StatusComposer';
import { usePresenceStatus } from '@/hooks/use-presence-status';
import type { PresenceStatusMessage } from '@/lib/wakaclock/types';
import { toPresenceUser } from '@/types/presence';

const api = vi.hoisted(() => ({
  clear: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('@/lib/wakaclock/endpoints-v2', () => ({
  clearMyPresenceStatusV2: api.clear,
  getMyPresenceStatusV2: api.get,
  setMyPresenceStatusV2: api.set,
}));

const status: PresenceStatusMessage = {
  emoji: '🐛',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  text: 'Fixing bugs',
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('status helpers', () => {
  it('counts to local midnight with a five-minute floor', () => {
    expect(secondsUntilEndOfDay(new Date(2026, 8, 29, 22, 0, 0))).toBe(7200);
    expect(secondsUntilEndOfDay(new Date(2026, 8, 29, 23, 59, 0))).toBe(300);
  });

  it('describes when a status clears', () => {
    const now = 1_000_000;
    expect(statusExpiryLabel(1000 + 30 * 60, now)).toBe('clears in 30m');
    expect(statusExpiryLabel(1000 + 3 * 3600, now)).toBe('clears in 3h');
    expect(statusExpiryLabel(1000 + 2 * 86400, now)).toBe('clears in 2d');
    expect(statusExpiryLabel(0, now)).toBe('clears in 0m');
  });

  it('maps a roster status onto the UI user', () => {
    const user = toPresenceUser(
      { position: null, state: 'idle', status, user_id: 'u', username: 'amy', zone_id: null },
      'u'
    );
    expect(user.statusMessage).toEqual(status);
    expect(user.isCurrentUser).toBe(true);
  });
});

describe('StatusComposer', () => {
  function renderComposer(overrides: Partial<React.ComponentProps<typeof StatusComposer>> = {}) {
    const props = {
      error: null,
      onClear: vi.fn(async () => true),
      onClose: vi.fn(),
      onSave: vi.fn(async () => true),
      saving: false,
      status: null,
      ...overrides,
    };
    render(<StatusComposer {...props} />);
    return props;
  }

  it('shares a typed status with the chosen emoji and expiry, then closes', async () => {
    const props = renderComposer();
    const input = screen.getByRole('textbox', { name: 'Status text' });

    expect(input).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Share status' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '  Refactoring presence  ' } });
    expect(screen.getByText(`24/${STATUS_MAX_CHARS}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use 🚀' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Share status' }));

    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(props.onSave).toHaveBeenCalledWith('Refactoring presence', '🚀', 1800);
  });

  it('fills from a suggestion, can drop the emoji, and uses end of day', async () => {
    const props = renderComposer();

    fireEvent.click(screen.getByRole('button', { name: /Open to pairing/ }));
    expect(screen.getByRole('textbox', { name: 'Status text' })).toHaveValue('Open to pairing');
    fireEvent.click(screen.getByRole('button', { name: 'Use 🤝' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'today' } });
    fireEvent.submit(screen.getByRole('textbox', { name: 'Status text' }).closest('form')!);

    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    expect(props.onSave).toHaveBeenCalledWith('Open to pairing', null, expect.any(Number));
  });

  it('stays open when saving fails, and ignores submits while busy or empty', async () => {
    const props = renderComposer({
      error: 'status text cannot be empty',
      onSave: vi.fn(async () => false),
    });

    expect(screen.getByRole('alert')).toHaveTextContent('status text cannot be empty');
    fireEvent.submit(screen.getByRole('textbox', { name: 'Status text' }).closest('form')!);
    expect(props.onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Status text' }), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Share status' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('prefills an existing status and clears it', async () => {
    const props = renderComposer({ status: { ...status, emoji: null } });

    expect(screen.getByRole('textbox', { name: 'Status text' })).toHaveValue('Fixing bugs');
    expect(screen.getByText(/Your status · clears in/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use 🎯' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Clear status' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Close status editor' }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps the editor open when clearing fails', async () => {
    const props = renderComposer({ onClear: vi.fn(async () => false), status });

    fireEvent.click(screen.getByRole('button', { name: 'Clear status' }));
    await waitFor(() => expect(props.onClear).toHaveBeenCalled());
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('shows a busy state while saving', () => {
    renderComposer({ saving: true, status });

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear status' })).toBeDisabled();
  });
});

describe('usePresenceStatus', () => {
  it('loads, saves and clears, and forgets a status once it expires', async () => {
    api.get.mockResolvedValue(status);
    const { result } = renderHook(() => usePresenceStatus(true));
    await waitFor(() => expect(result.current.status).toEqual(status));

    const next = { ...status, expires_at: Math.floor(Date.now() / 1000) + 1 };
    api.set.mockResolvedValue(next);
    await act(async () => {
      expect(await result.current.save('Pairing', null, 300)).toBe(true);
    });
    expect(api.set).toHaveBeenCalledWith('Pairing', null, 300);
    await waitFor(() => expect(result.current.status).toBeNull(), { timeout: 2500 });

    api.clear.mockResolvedValue(undefined);
    await act(async () => {
      expect(await result.current.clear()).toBe(true);
    });
    expect(result.current.status).toBeNull();
  });

  it('reports load, save and clear failures', async () => {
    api.get.mockRejectedValue(new Error('Redis is required for Presence v2'));
    const { result } = renderHook(() => usePresenceStatus(true));
    await waitFor(() => expect(result.current.error).toBe('Redis is required for Presence v2'));

    api.set.mockRejectedValue('nope');
    await act(async () => {
      expect(await result.current.save('x', null, 300)).toBe(false);
    });
    expect(result.current.error).toBe('Could not save your status');

    api.clear.mockRejectedValue(new Error('down'));
    await act(async () => {
      expect(await result.current.clear()).toBe(false);
    });
    expect(result.current.error).toBe('down');
  });

  it('does nothing until enabled, and ignores a load that lands after unmount', async () => {
    renderHook(() => usePresenceStatus(false));
    expect(api.get).not.toHaveBeenCalled();

    let resolve!: (value: PresenceStatusMessage) => void;
    api.get.mockReturnValue(new Promise((r) => (resolve = r)));
    const loaded = renderHook(() => usePresenceStatus(true));
    loaded.unmount();
    await act(async () => resolve(status));

    let reject!: (error: Error) => void;
    api.get.mockReturnValue(new Promise((_, r) => (reject = r)));
    const failed = renderHook(() => usePresenceStatus(true));
    failed.unmount();
    await act(async () => reject(new Error('late')));
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('falls back to a generic message for a non-Error load failure', async () => {
    api.get.mockRejectedValue('nope');
    const { result } = renderHook(() => usePresenceStatus(true));

    await waitFor(() => expect(result.current.error).toBe('Could not load your status'));
  });
});

describe('status in the header and roster', () => {
  it('offers to set a status, or edit the current one', () => {
    const onEdit = vi.fn();
    const { rerender } = render(<PresenceHeader onEditStatus={onEdit} username="me" />);
    fireEvent.click(screen.getByRole('button', { name: 'Set a status' }));
    expect(onEdit).toHaveBeenCalled();

    rerender(<PresenceHeader myStatus={status} onEditStatus={onEdit} username="me" />);
    expect(screen.getByRole('button', { name: 'Edit your status: Fixing bugs' })).toHaveTextContent(
      '🐛'
    );

    rerender(<PresenceHeader myStatus={{ ...status, emoji: null }} onEditStatus={onEdit} />);
    expect(
      screen.getByRole('button', { name: 'Edit your status: Fixing bugs' })
    ).not.toHaveTextContent('🐛');
  });

  it('shows each member’s own message in the roster', () => {
    render(
      <PixelOfficeDirectory
        reducedMotion
        users={[
          {
            id: 'a',
            isCurrentUser: false,
            status: 'coding',
            statusMessage: status,
            username: 'amy',
            x: 1,
            y: 1,
          },
          {
            id: 'b',
            isCurrentUser: false,
            status: 'idle',
            statusMessage: { ...status, emoji: null, text: 'Reviewing' },
            username: 'bo',
            x: 1,
            y: 1,
          },
        ]}
        zones={[]}
      />
    );

    expect(screen.getByTitle('Fixing bugs')).toHaveTextContent('🐛 Fixing bugs');
    expect(screen.getByTitle('Reviewing')).toHaveTextContent(/^Reviewing$/);
  });
});
