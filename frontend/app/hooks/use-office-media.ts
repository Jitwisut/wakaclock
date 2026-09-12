'use client';
import * as React from 'react';

import {
  type RemoteAudioTrack,
  type RemoteParticipant,
  type RemoteTrack,
  Room,
  RoomEvent,
} from 'livekit-client';

import { podAudioVolume } from '@/lib/presence/proximity';
import { officeMediaToken } from '@/lib/wakaclock/office';

export interface OfficeMediaTrack {
  key: string;
  track: RemoteTrack;
  userId: string;
  username: string;
}
export function useOfficeMedia(
  roomId: null | string,
  zoneId: null | string,
  enabled: boolean,
  roster?: ReadonlyArray<{ position: { x: number; y: number } | null; user_id: string }>,
  userId?: string
) {
  const roomRef = React.useRef<null | Room>(null);
  const [tracks, setTracks] = React.useState<OfficeMediaTrack[]>([]);
  const [status, setStatus] = React.useState('Join a pod to talk');
  const [error, setError] = React.useState<null | string>(null);
  const [mic, setMic] = React.useState(false);
  const [camera, setCamera] = React.useState(false);
  const [screenShare, setScreenShare] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [retry, setRetry] = React.useState(0);
  React.useEffect(() => {
    setBusy(false);
    setTracks([]);
    setMic(false);
    setCamera(false);
    setScreenShare(false);
    setError(null);
    if (!roomId || !zoneId || !enabled) {
      setStatus(enabled ? 'Join a pod to talk' : 'Media unavailable');
      return;
    }
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    let disposed = false;
    const sync = () => {
      setMic(room.localParticipant.isMicrophoneEnabled);
      setCamera(room.localParticipant.isCameraEnabled);
      setScreenShare(room.localParticipant.isScreenShareEnabled);
    };
    const subscribed = (
      track: RemoteTrack,
      _publication: unknown,
      participant: RemoteParticipant
    ) =>
      setTracks((old) => [
        ...old.filter((t) => t.key !== track.sid),
        {
          key: track.sid ?? `${participant.identity}-${track.kind}`,
          track,
          username: participant.name ?? participant.identity,
          userId: participant.identity,
        },
      ]);
    room.on(RoomEvent.TrackSubscribed, subscribed);
    room.on(RoomEvent.TrackUnsubscribed, (track) =>
      setTracks((old) => old.filter((t) => t.track !== track))
    );
    room
      .on(RoomEvent.LocalTrackPublished, sync)
      .on(RoomEvent.LocalTrackUnpublished, sync)
      .on(RoomEvent.TrackMuted, sync)
      .on(RoomEvent.TrackUnmuted, sync);
    room.on(RoomEvent.Reconnecting, () => setStatus('Reconnecting media…'));
    room.on(RoomEvent.Reconnected, () => setStatus('Pod audio connected'));
    room.on(RoomEvent.Disconnected, () => {
      setStatus('Media disconnected');
      setTracks([]);
      setMic(false);
      setCamera(false);
      setScreenShare(false);
    });
    setStatus('Connecting media…');
    void (async () => {
      try {
        const credentials = await officeMediaToken(roomId);
        if (disposed) return;
        if (credentials.zone_id !== zoneId) throw new Error('Your pod changed. Reconnect media.');
        await room.connect(credentials.url, credentials.token);
        if (disposed) {
          await room.disconnect();
          return;
        }
        setStatus('Pod audio connected');
      } catch (error_) {
        if (!disposed) {
          setError(error_ instanceof Error ? error_.message : 'Media connection failed');
          setStatus('Media disconnected');
        }
      }
    })();
    return () => {
      disposed = true;
      roomRef.current = null;
      room.removeAllListeners();
      void room.disconnect();
    };
  }, [roomId, zoneId, enabled, retry]);
  React.useEffect(() => {
    const listener = roster?.find((member) => member.user_id === userId)?.position;
    for (const item of tracks) {
      if (item.track.kind !== 'audio') continue;
      const speaker = roster?.find((member) => member.user_id === item.userId)?.position;
      (item.track as RemoteAudioTrack).setVolume(
        listener && speaker ? podAudioVolume(listener, speaker) : 1
      );
    }
  }, [roster, userId, tracks]);

  const toggle = async (kind: 'camera' | 'mic' | 'screen') => {
    const room = roomRef.current;
    if (busy) return;
    const participant = room?.localParticipant;
    const stopping = {
      mic: participant?.isMicrophoneEnabled,
      camera: participant?.isCameraEnabled,
      screen: participant?.isScreenShareEnabled,
    }[kind];
    if (!room || (room.state !== 'connected' && !stopping)) {
      setError('Connect to a pod before enabling devices');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (kind === 'mic') {
        await room.localParticipant.setMicrophoneEnabled(
          !room.localParticipant.isMicrophoneEnabled
        );
      }
      if (kind === 'camera') {
        await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled);
      }
      if (kind === 'screen') {
        await room.localParticipant.setScreenShareEnabled(
          !room.localParticipant.isScreenShareEnabled
        );
      }
      if (roomRef.current !== room) {
        await room.disconnect();
        return;
      }
      setMic(room.localParticipant.isMicrophoneEnabled);
      setCamera(room.localParticipant.isCameraEnabled);
      setScreenShare(room.localParticipant.isScreenShareEnabled);
    } catch (error_) {
      if (roomRef.current !== room) return;
      setError(error_ instanceof Error ? error_.message : 'Device permission denied');
    } finally {
      if (roomRef.current === room) setBusy(false);
    }
  };
  return {
    mic,
    camera,
    screenShare,
    tracks,
    status,
    error,
    busy,
    canConnect: Boolean(roomId && zoneId && enabled),
    ready: status === 'Pod audio connected',
    toggleMic: () => void toggle('mic'),
    toggleCamera: () => void toggle('camera'),
    toggleScreenShare: () => void toggle('screen'),
    reconnect: () => setRetry((n) => n + 1),
    startAudio: () => {
      void roomRef.current
        ?.startAudio()
        .catch(() => setError('Playback was blocked. Try enabling playback again.'));
    },
  };
}
export type OfficeMedia = ReturnType<typeof useOfficeMedia>;

export { Track } from 'livekit-client';
