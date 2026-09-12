import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  disconnect: vi.fn(),
  mic: vi.fn(),
  camera: vi.fn(),
  screen: vi.fn(),
  connect: vi.fn(),
}));
vi.mock('livekit-client', () => ({
  RoomEvent: {
    TrackSubscribed: 'subscribe',
    TrackUnsubscribed: 'unsubscribe',
    LocalTrackPublished: 'published',
    LocalTrackUnpublished: 'unpublished',
    TrackMuted: 'mute',
    TrackUnmuted: 'unmute',
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    Disconnected: 'disconnected',
  },
  Track: { Kind: { Audio: 'audio' } },
  Room: class {
    state = 'connected';
    localParticipant = {
      isMicrophoneEnabled: false,
      isCameraEnabled: false,
      isScreenShareEnabled: false,
      setMicrophoneEnabled: mock.mic,
      setCameraEnabled: mock.camera,
      setScreenShareEnabled: mock.screen,
    };
    on() {
      return this;
    }
    removeAllListeners() {}
    connect = mock.connect;
    disconnect = mock.disconnect;
  },
}));
vi.mock('@/lib/wakaclock/office', () => ({
  officeMediaToken: vi
    .fn()
    .mockResolvedValue({ url: 'wss://media.test', token: 'test', zone_id: 'pod-a' }),
}));
import { officeMediaToken } from '@/lib/wakaclock/office';
import { useOfficeMedia } from '@/hooks/use-office-media';
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(officeMediaToken).mockResolvedValue({
    url: 'wss://media.test',
    token: 'test',
    zone_id: 'pod-a',
  });
  mock.connect.mockResolvedValue(undefined);
  mock.disconnect.mockResolvedValue(undefined);
});
describe('Office media', () => {
  it('does not activate devices when joining and disconnects on leaving a pod', async () => {
    const { result, rerender } = renderHook(({ zone }) => useOfficeMedia('room', zone, true), {
      initialProps: { zone: 'pod-a' as string | null },
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(mock.mic).not.toHaveBeenCalled();
    expect(mock.camera).not.toHaveBeenCalled();
    rerender({ zone: null });
    expect(mock.disconnect).toHaveBeenCalled();
    expect(result.current.mic).toBe(false);
  });
  it('keeps the microphone off when device permission fails', async () => {
    mock.mic.mockRejectedValueOnce(new Error('Permission denied'));
    const { result } = renderHook(() => useOfficeMedia('room', 'pod-a', true));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.toggleMic());
    await waitFor(() => expect(result.current.error).toBe('Permission denied'));
    expect(result.current.mic).toBe(false);
  });
});
