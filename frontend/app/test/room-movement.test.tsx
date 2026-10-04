import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { useRoomMovement } from '@/hooks/use-room-movement';
import { updatePresenceMemberV2 } from '@/lib/wakaclock/endpoints-v2';
import type { PresenceV2Snapshot } from '@/lib/wakaclock/types';

vi.mock('@/lib/wakaclock/endpoints-v2', () => ({ updatePresenceMemberV2: vi.fn() }));
vi.mock('@/lib/wakaclock/presence-client', () => ({ getPresenceClientId: () => 'test-client' }));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

it('sends another move after an idle throttle window, including leaving the desk', async () => {
  vi.useFakeTimers();
  const snapshot = {
    zones: [{ id: 'desk', center_x: 25, center_y: 25, width: 20, height: 20 }],
  } as PresenceV2Snapshot;
  vi.mocked(updatePresenceMemberV2).mockResolvedValue(snapshot);
  const { result } = renderHook(() =>
    useRoomMovement({ roomId: 'room', snapshot, onSnapshot: vi.fn() })
  );
  await act(async () => result.current.move({ x: 25, y: 25 }));
  await act(async () => vi.advanceTimersByTime(1000));
  await act(async () => result.current.move({ x: 60, y: 60 }));
  expect(updatePresenceMemberV2).toHaveBeenCalledTimes(2);
  expect(updatePresenceMemberV2).toHaveBeenLastCalledWith(
    'room',
    expect.objectContaining({ position: { x: 60, y: 60 }, zone_id: null })
  );
});

it('coalesces rapid moves, increases sequence and rejects responses from an earlier room', async () => {
  vi.useFakeTimers();
  const snapshot = { zones: [] } as unknown as PresenceV2Snapshot;
  let resolve!: (value: PresenceV2Snapshot) => void;
  const next = vi.fn();
  vi.mocked(updatePresenceMemberV2)
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    )
    .mockResolvedValue(snapshot);
  const view = renderHook(({ roomId }) => useRoomMovement({ roomId, snapshot, onSnapshot: next }), {
    initialProps: { roomId: 'one' },
  });
  act(() => {
    view.result.current.move({ x: 10, y: 10 });
    view.result.current.move({ x: 20, y: 20 });
    view.result.current.move({ x: 30, y: 30 });
  });
  expect(updatePresenceMemberV2).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(250));
  expect(updatePresenceMemberV2).toHaveBeenLastCalledWith(
    'one',
    expect.objectContaining({ position: { x: 30, y: 30 }, client_seq: 2 })
  );
  view.rerender({ roomId: 'two' });
  next.mockClear();
  await act(async () => resolve(snapshot));
  expect(next).not.toHaveBeenCalled();
});
it('does not apply an old movement acknowledgement after a newer one in the same room', async () => {
  vi.useFakeTimers();
  const snapshot = { zones: [] } as unknown as PresenceV2Snapshot;
  const next = vi.fn();
  let resolve!: (value: PresenceV2Snapshot) => void;
  vi.mocked(updatePresenceMemberV2)
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    )
    .mockResolvedValue(snapshot);
  const { result } = renderHook(() =>
    useRoomMovement({ roomId: 'one', snapshot, onSnapshot: next })
  );
  act(() => {
    result.current.move({ x: 10, y: 10 });
    result.current.move({ x: 20, y: 20 });
  });
  await act(async () => vi.advanceTimersByTimeAsync(250));
  expect(next).toHaveBeenCalledTimes(1);
  await act(async () => resolve(snapshot));
  expect(next).toHaveBeenCalledTimes(1);
});
it('reports a current-room failure, but ignores moves without a room or snapshot', async () => {
  vi.useFakeTimers();
  const snapshot = { zones: [] } as unknown as PresenceV2Snapshot;
  const onError = vi.fn();
  vi.mocked(updatePresenceMemberV2).mockRejectedValue(new Error('offline'));
  const view = renderHook(
    ({ roomId, data }: { roomId: null | string; data: null | PresenceV2Snapshot }) =>
      useRoomMovement({ roomId, snapshot: data, onSnapshot: vi.fn(), onError }),
    { initialProps: { roomId: null as string | null, data: snapshot as PresenceV2Snapshot | null } }
  );
  act(() => view.result.current.move({ x: 0, y: 0 }));
  expect(updatePresenceMemberV2).not.toHaveBeenCalled();
  view.rerender({ roomId: 'one', data: null });
  act(() => view.result.current.move({ x: 0, y: 0 }));
  expect(updatePresenceMemberV2).not.toHaveBeenCalled();
  view.rerender({ roomId: 'one', data: snapshot });
  await act(async () => view.result.current.move({ x: 0, y: 0 }));
  expect(onError).toHaveBeenCalledTimes(1);
  view.unmount();
});

it('does not report an old room movement failure in the newly selected room', async () => {
  const snapshot = { zones: [] } as unknown as PresenceV2Snapshot;
  let reject!: (error: Error) => void;
  vi.mocked(updatePresenceMemberV2).mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    })
  );
  const onError = vi.fn();
  const view = renderHook(
    ({ roomId }) => useRoomMovement({ roomId, snapshot, onSnapshot: vi.fn(), onError }),
    {
      initialProps: { roomId: 'old' },
    }
  );
  act(() => view.result.current.move({ x: 20, y: 20 }));
  view.rerender({ roomId: 'new' });
  await act(async () => reject(new Error('late failure')));
  expect(onError).not.toHaveBeenCalled();
});

it('handles a failed move when the caller does not request error notifications', async () => {
  const snapshot = { zones: [] } as unknown as PresenceV2Snapshot;
  vi.mocked(updatePresenceMemberV2).mockRejectedValueOnce(new Error('offline'));
  const onSnapshot = vi.fn();
  const { result } = renderHook(() => useRoomMovement({ roomId: 'room', snapshot, onSnapshot }));
  await act(async () => result.current.move({ x: 20, y: 20 }));
  expect(updatePresenceMemberV2).toHaveBeenCalledOnce();
  expect(onSnapshot).not.toHaveBeenCalled();
});
