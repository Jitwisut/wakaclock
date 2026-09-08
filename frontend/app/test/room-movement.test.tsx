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
