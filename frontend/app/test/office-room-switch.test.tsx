import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { podAudioVolume } from '@/lib/presence/proximity';
import { useRoomMovement } from '@/hooks/use-room-movement';
import { updatePresenceMemberV2 } from '@/lib/wakaclock/endpoints-v2';
import type { PresenceV2Snapshot } from '@/lib/wakaclock/types';

vi.mock('@/lib/wakaclock/endpoints-v2', () => ({ updatePresenceMemberV2: vi.fn() }));
vi.mock('@/lib/wakaclock/presence-client', () => ({ getPresenceClientId: () => 'client' }));

it('ignores an old movement response after moving into another room', async () => {
  let resolve!: (snapshot: PresenceV2Snapshot) => void;
  vi.mocked(updatePresenceMemberV2).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  const onSnapshot = vi.fn();
  const snapshot = { zones: [] } as unknown as PresenceV2Snapshot;
  const { result, rerender } = renderHook(
    ({ roomId }) => useRoomMovement({ roomId, snapshot, onSnapshot }),
    { initialProps: { roomId: 'old-room' } }
  );
  act(() => result.current.move({ x: 30, y: 40 }));
  rerender({ roomId: 'new-room' });
  await act(async () => {
    resolve(snapshot);
  });
  expect(onSnapshot).not.toHaveBeenCalled();
});

it('reduces audio with distance inside a pod while preserving audibility', () => {
  const listener = { x: 25, y: 30 };
  expect(podAudioVolume(listener, listener)).toBe(1);
  expect(podAudioVolume(listener, { x: 35, y: 30 })).toBeLessThan(1);
  expect(podAudioVolume(listener, { x: 100, y: 100 })).toBe(0.2);
});

it('mutes invalid coordinates instead of passing NaN to media volume', () => {
  expect(podAudioVolume({ x: NaN, y: 0 }, { x: 0, y: 0 })).toBe(0);
  expect(podAudioVolume({ x: 0, y: 0 }, { x: Infinity, y: 0 })).toBe(0);
});
