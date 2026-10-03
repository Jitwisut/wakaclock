import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { useOfficeMedia } from '@/hooks/use-office-media';
import { officeMediaToken } from '@/lib/wakaclock/office';

const mock = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => void>(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  audio: vi.fn(),
  mic: vi.fn(),
  camera: vi.fn(),
  screen: vi.fn(),
  room: null as null | {
    state: string;
    localParticipant: {
      isMicrophoneEnabled: boolean;
      isCameraEnabled: boolean;
      isScreenShareEnabled: boolean;
    };
  },
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
    constructor() {
      mock.room = this;
    }
    on(name: string, callback: (...args: unknown[]) => void) {
      mock.handlers.set(name, callback);
      return this;
    }
    removeAllListeners() {
      mock.handlers.clear();
    }
    connect = mock.connect;
    disconnect = mock.disconnect;
    startAudio = mock.audio;
  },
}));
vi.mock('@/lib/wakaclock/office', () => ({ officeMediaToken: vi.fn() }));
beforeEach(() => {
  mock.room = null;
  mock.handlers.clear();
  vi.mocked(officeMediaToken).mockResolvedValue({
    url: 'wss://media.test',
    token: 'fixture',
    zone_id: 'pod',
  });
  for (const action of [
    mock.connect,
    mock.disconnect,
    mock.audio,
    mock.mic,
    mock.camera,
    mock.screen,
  ])
    action.mockResolvedValue(undefined);
});
const emit = (name: string, ...args: unknown[]) => act(() => mock.handlers.get(name)?.(...args));

it('never enables devices outside an enabled pod and explains the missing connection', () => {
  const { result, rerender } = renderHook(
    ({ enabled, room }) => useOfficeMedia(room, 'pod', enabled),
    { initialProps: { enabled: false, room: 'room' as null | string } }
  );
  expect(result.current.status).toBe('Media unavailable');
  act(() => {
    result.current.toggleMic();
    result.current.startAudio();
  });
  expect(result.current.error).toBe('Connect to a pod before enabling devices');
  rerender({ enabled: true, room: null });
  expect(result.current.status).toBe('Join a pod to talk');
  expect(officeMediaToken).not.toHaveBeenCalled();
});

it('manages subscriptions, proximity volume, reconnect and disconnect notifications', async () => {
  const roster = [
    { user_id: 'self', position: { x: 0, y: 0 } },
    { user_id: 'peer', position: { x: 0, y: 0 } },
  ];
  const { result, rerender } = renderHook(
    ({ members }) => useOfficeMedia('room', 'pod', true, members, 'self'),
    { initialProps: { members: roster } }
  );
  await waitFor(() => expect(result.current.ready).toBe(true));
  const audio = { sid: 'audio', kind: 'audio', setVolume: vi.fn() };
  const video = { sid: 'video', kind: 'video' };
  emit('subscribe', audio, {}, { identity: 'peer', name: 'Peer' });
  emit('subscribe', audio, {}, { identity: 'peer', name: 'Renamed' });
  emit('subscribe', video, {}, { identity: 'peer' });
  expect(result.current.tracks).toHaveLength(2);
  expect(result.current.tracks[0].username).toBe('Renamed');
  expect(audio.setVolume).toHaveBeenLastCalledWith(1);
  rerender({
    members: [
      { user_id: 'self', position: { x: 0, y: 0 } },
      { user_id: 'peer', position: { x: 10000, y: 10000 } },
    ],
  });
  expect(audio.setVolume).toHaveBeenLastCalledWith(0.2);
  rerender({ members: [] });
  expect(audio.setVolume).toHaveBeenLastCalledWith(1);
  emit('unsubscribe', video);
  expect(result.current.tracks).toHaveLength(1);
  emit('subscribe', { kind: 'video' }, {}, { identity: 'fallback' });
  expect(result.current.tracks[1].key).toBe('fallback-video');
  Object.assign(mock.room!.localParticipant, {
    isMicrophoneEnabled: true,
    isCameraEnabled: true,
    isScreenShareEnabled: true,
  });
  emit('published');
  expect(result.current.mic).toBe(true);
  expect(result.current.camera).toBe(true);
  expect(result.current.screenShare).toBe(true);
  emit('reconnecting');
  expect(result.current.status).toBe('Reconnecting media…');
  emit('reconnected');
  expect(result.current.ready).toBe(true);
  emit('disconnected');
  expect(result.current.tracks).toEqual([]);
  expect(result.current.mic).toBe(false);
  expect(result.current.status).toBe('Media disconnected');
});

it('toggles all devices, prevents overlapping requests, and reports blocked playback', async () => {
  const { result } = renderHook(() => useOfficeMedia('room', 'pod', true));
  await waitFor(() => expect(result.current.ready).toBe(true));
  let release!: () => void;
  mock.camera.mockImplementation(async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    mock.room!.localParticipant.isCameraEnabled = true;
  });
  act(() => result.current.toggleCamera());
  await waitFor(() => expect(result.current.busy).toBe(true));
  act(() => result.current.toggleMic());
  expect(mock.mic).not.toHaveBeenCalled();
  await act(async () => release());
  expect(result.current.camera).toBe(true);
  mock.screen.mockImplementation(async () => {
    mock.room!.localParticipant.isScreenShareEnabled = true;
  });
  await act(async () => result.current.toggleScreenShare());
  expect(result.current.screenShare).toBe(true);
  mock.mic.mockImplementation(async () => {
    mock.room!.localParticipant.isMicrophoneEnabled = true;
  });
  await act(async () => result.current.toggleMic());
  expect(result.current.mic).toBe(true);
  mock.audio.mockRejectedValue(new Error('blocked'));
  await act(async () => result.current.startAudio());
  expect(result.current.error).toBe('Playback was blocked. Try enabling playback again.');
  mock.room!.state = 'reconnecting';
  mock.room!.localParticipant.isMicrophoneEnabled = false;
  await act(async () => result.current.toggleMic());
  expect(result.current.error).toBe('Connect to a pod before enabling devices');
  mock.screen.mockRejectedValue('denied');
  await act(async () => result.current.toggleScreenShare());
  expect(result.current.error).toBe('Device permission denied');
});

it('handles changed pods and retries connection failures without enabling devices', async () => {
  vi.mocked(officeMediaToken).mockResolvedValueOnce({
    url: 'wss://media.test',
    token: 'fixture',
    zone_id: 'other',
  });
  const { result } = renderHook(() => useOfficeMedia('room', 'pod', true));
  await waitFor(() => expect(result.current.error).toBe('Your pod changed. Reconnect media.'));
  mock.connect.mockRejectedValueOnce('offline');
  act(() => result.current.reconnect());
  await waitFor(() => expect(result.current.error).toBe('Media connection failed'));
  act(() => result.current.reconnect());
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(mock.mic).not.toHaveBeenCalled();
});

it('discards late credentials and connections after leaving the pod', async () => {
  let token!: (value: Awaited<ReturnType<typeof officeMediaToken>>) => void;
  vi.mocked(officeMediaToken).mockReturnValueOnce(
    new Promise((resolve) => {
      token = resolve;
    })
  );
  const first = renderHook(() => useOfficeMedia('room', 'pod', true));
  first.unmount();
  await act(async () => token({ url: 'wss://media.test', token: 'fixture', zone_id: 'pod' }));
  expect(mock.connect).not.toHaveBeenCalled();
  let connect!: () => void;
  mock.connect.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      connect = resolve;
    })
  );
  const second = renderHook(() => useOfficeMedia('room', 'pod', true));
  await waitFor(() => expect(mock.connect).toHaveBeenCalledOnce());
  second.unmount();
  const calls = mock.disconnect.mock.calls.length;
  await act(async () => connect());
  expect(mock.disconnect.mock.calls.length).toBe(calls + 1);
});

it.each([false, true])(
  'ignores a late device completion after leaving (reject=%s)',
  async (reject) => {
    let complete!: () => void;
    mock.mic.mockReturnValueOnce(
      new Promise<void>((resolve, fail) => {
        complete = () => (reject ? fail(new Error('denied')) : resolve());
      })
    );
    const { result, unmount } = renderHook(() => useOfficeMedia('room', 'pod', true));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.toggleMic());
    unmount();
    await act(async () => complete());
    expect(mock.disconnect).toHaveBeenCalled();
  }
);
