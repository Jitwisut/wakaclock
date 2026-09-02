'use client';

import * as React from 'react';

import { toast } from 'sonner';

import '@/components/presence/presence-theme.css';
import { presenceBodyFont, presenceHeadingFont } from '@/components/presence/presence-fonts';
import { PresenceHeader } from '@/components/presence/PresenceHeader';
import {
  ActiveRoomView,
  AvailabilityMessage,
  LobbyView,
} from '@/components/presence/PresenceRoomViews';
import { RequireUser } from '@/components/wakaclock/require-user';
import { useCapabilities } from '@/hooks/use-capabilities';
import { useCoworkingHistory } from '@/hooks/use-coworking-history';
import { usePresenceStream } from '@/hooks/use-presence-stream';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useRoomMovement } from '@/hooks/use-room-movement';
import {
  createPresenceInviteV2,
  createPresenceRoomV2,
  endPresenceRoomV2,
  getPresenceRoomV2,
  joinPresenceRoomV2,
  leavePresenceRoomV2,
  listPresenceRooms,
  resolvePresenceInviteV2,
  revokePresenceInviteV2,
} from '@/lib/wakaclock/endpoints-v2';
import { getPresenceClientId } from '@/lib/wakaclock/presence-client';
import type { PresenceV2Room, PresenceV2RoomData, PresenceV2Session } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';
import { toPresenceUser } from '@/types/presence';

const ROOM_STORAGE_KEY = 'wakaclock.presence.v2.roomId';
const INVITE_TOKEN_KEY = 'wakaclock.presence.v2.inviteToken';


function readInviteContext(): { inviteToken: null | string; roomId: null | string } {
  if (typeof window === 'undefined') return { inviteToken: null, roomId: null };
  const roomId = new URLSearchParams(window.location.search).get('room');
  const hash = window.location.hash.replace(/^#/, '');
  const inviteToken = new URLSearchParams(hash).get('invite');
  return { inviteToken, roomId };
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function PresenceApp() {
  const currentUserId = useWakaclockUserStore((state) => state.userId) ?? '';
  const reducedMotion = useReducedMotion();
  const { isLoading: capabilitiesLoading, presenceV2Available } = useCapabilities();
  const [rooms, setRooms] = React.useState<PresenceV2Room[]>([]);
  const [roomPreview, setRoomPreview] = React.useState<null | PresenceV2RoomData>(null);
  const [activeRoom, setActiveRoom] = React.useState<null | PresenceV2RoomData>(null);
  const [roomName, setRoomName] = React.useState('');
  const [expiry, setExpiry] = React.useState('86400');
  const [inviteUrl, setInviteUrl] = React.useState<null | string>(null);
  const [inviteId, setInviteId] = React.useState<null | string>(null);
  const [inviteToken, setInviteToken] = React.useState<null | string>(null);
  const [loading, setLoading] = React.useState(true);
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<null | string>(null);
  const history = useCoworkingHistory(Boolean(activeRoom));
  const presenceStream = usePresenceStream(activeRoom?.id ?? null, inviteToken);
  const { applySnapshot, reconnect, reconnectStopped, snapshot, status: streamStatus } =
    presenceStream;
  const connected = streamStatus === 'live';
  const stale = streamStatus === 'stale';

  const refreshRooms = React.useCallback(async () => {
    if (presenceV2Available === false) {
      setLoading(false);
      setError('Presence v2 is not enabled on this server');
      return;
    }
    setLoading(true);
    try {
      setRooms(await listPresenceRooms());
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Presence is unavailable');
    } finally {
      setLoading(false);
    }
  }, [presenceV2Available]);

  React.useEffect(() => {
    void refreshRooms();
    const { inviteToken: token, roomId } = readInviteContext();
    if (token) {
      setInviteToken(token);
      window.localStorage.setItem(INVITE_TOKEN_KEY, token);
    }
    const storedRoomId = window.localStorage.getItem(ROOM_STORAGE_KEY);
    const previewRoomId = roomId ?? storedRoomId;

    async function loadPreview() {
      try {
        if (token && !previewRoomId) {
          setRoomPreview(await resolvePresenceInviteV2(token));
          return;
        }
        if (previewRoomId) {
          setRoomPreview(await getPresenceRoomV2(previewRoomId));
        }
      } catch {
        if (token) {
          setError('This invite is invalid or has been revoked');
        }
        if (previewRoomId) {
          window.localStorage.removeItem(ROOM_STORAGE_KEY);
        }
      }
    }

    if (presenceV2Available !== false) void loadPreview();
  }, [presenceV2Available, refreshRooms]);

  const users = React.useMemo(
    () =>
      snapshot?.roster.map((entry) =>
        toPresenceUser(
          {
            ...entry,
            position: entry.position,
            state: entry.state,
          },
          currentUserId
        )
      ) ?? [],
    [currentUserId, snapshot]
  );

  const activeSession = snapshot?.sessions.find((session) =>
    session.participants.some((participant) => participant.user_id === currentUserId)
  );
  const previewUnavailable = Boolean(
    roomPreview?.ended_at || (roomPreview?.expires_at && new Date(roomPreview.expires_at).getTime() <= Date.now())
  );
  const previousSessionRef = React.useRef<null | PresenceV2Session>(null);
  React.useEffect(() => {
    const previous = previousSessionRef.current;
    if (previous && (!activeSession || previous.session_id !== activeSession.session_id)) {
      toast.success(`Co-working session ended · ${formatDuration(Math.max(0, Math.floor(Date.now() / 1000) - previous.started_at))}`);
    }
    previousSessionRef.current = activeSession ?? null;
  }, [activeSession]);
  const stateCounts = React.useMemo(
    () =>
      users.reduce(
        (counts, user) => {
          counts[user.status] += 1;
          return counts;
        },
        { coding: 0, idle: 0, offline: 0 } as Record<'coding' | 'idle' | 'offline', number>
      ),
    [users]
  );

  const handleOpenRoom = React.useCallback(async (room: PresenceV2Room) => {
    try {
      setRoomPreview(await getPresenceRoomV2(room.id));
      setInviteToken(null);
      window.localStorage.removeItem(INVITE_TOKEN_KEY);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not open room');
    }
  }, []);

  const handleJoin = React.useCallback(async () => {
    if (!roomPreview) return;
    setWorking(true);
    try {
      const joined = await joinPresenceRoomV2(
        roomPreview.id,
        inviteToken ?? undefined,
        getPresenceClientId()
      );
      applySnapshot(joined);
      setActiveRoom(roomPreview);
      setRoomPreview(null);
      setInviteToken(null);
      window.localStorage.setItem(ROOM_STORAGE_KEY, roomPreview.id);
      window.localStorage.removeItem(INVITE_TOKEN_KEY);
      setError(null);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not join room');
    } finally {
      setWorking(false);
    }
  }, [applySnapshot, inviteToken, roomPreview]);

  const handleCreate = React.useCallback(async () => {
    if (!roomName.trim()) return;
    setWorking(true);
    try {
      const room = await createPresenceRoomV2(roomName.trim(), Number(expiry));
      const invite = await createPresenceInviteV2(room.id, Number(expiry));
      const url = `${window.location.origin}${window.location.pathname}#invite=${invite.invite_url_token}`;
      setInviteUrl(url);
      setInviteId(invite.id);
      setActiveRoom(room);
      setRoomName('');
      window.localStorage.setItem(ROOM_STORAGE_KEY, room.id);
      await refreshRooms();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not create room');
    } finally {
      setWorking(false);
    }
  }, [expiry, refreshRooms, roomName]);

  const { move: handleMove } = useRoomMovement({
    onError: () => toast.error('Could not update your position'),
    onSnapshot: applySnapshot,
    roomId: activeRoom?.id ?? null,
    snapshot,
  });
  const handleReturnToSession = React.useCallback(() => {
    if (!activeSession || !snapshot) return;
    const zone = snapshot.zones.find((candidate) => candidate.id === activeSession.zone_id);
    if (zone) handleMove({ x: zone.center_x, y: zone.center_y });
  }, [activeSession, handleMove, snapshot]);

  const handleLeave = React.useCallback(async () => {
    if (!activeRoom) return;
    setWorking(true);
    try {
      await leavePresenceRoomV2(activeRoom.id);
      setActiveRoom(null);
      setInviteUrl(null);
      setInviteId(null);
      setInviteToken(null);
      window.localStorage.removeItem(ROOM_STORAGE_KEY);
      window.localStorage.removeItem(INVITE_TOKEN_KEY);
      await refreshRooms();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not leave room');
    } finally {
      setWorking(false);
    }
  }, [activeRoom, refreshRooms]);

  const handleEnd = React.useCallback(async () => {
    if (!activeRoom) return;
    setWorking(true);
    try {
      await endPresenceRoomV2(activeRoom.id);
      setActiveRoom(null);
      setInviteUrl(null);
      setInviteId(null);
      setInviteToken(null);
      window.localStorage.removeItem(ROOM_STORAGE_KEY);
      window.localStorage.removeItem(INVITE_TOKEN_KEY);
      toast.success('Room ended');
      await refreshRooms();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not end room');
    } finally {
      setWorking(false);
    }
  }, [activeRoom, refreshRooms]);

  const handleCopy = React.useCallback(async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite link copied');
  }, [inviteUrl]);

  const handleRevokeInvite = React.useCallback(async () => {
    if (!activeRoom || !inviteId) return;
    try {
      await revokePresenceInviteV2(activeRoom.id, inviteId);
      setInviteUrl(null);
      setInviteId(null);
      toast.success('Invite revoked');
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not revoke invite');
    }
  }, [activeRoom, inviteId]);

  const handleCancelPreview = React.useCallback(() => {
    setRoomPreview(null);
    setInviteToken(null);
    window.localStorage.removeItem(INVITE_TOKEN_KEY);
  }, []);

  const teamRooms = rooms.filter((room) => room.kind === 'team');
  const adhocRooms = rooms.filter((room) => room.kind === 'adhoc');

  let content: React.ReactNode;
  if (capabilitiesLoading || presenceV2Available === false) {
    content = (
      <AvailabilityMessage
        loading={capabilitiesLoading}
        unavailable={presenceV2Available === false}
      />
    );
  } else if (activeRoom && snapshot) {
    content = (
      <ActiveRoomView
        activeRoom={activeRoom}
        activeSession={activeSession}
        connected={connected}
        currentUserId={currentUserId}
        history={history}
        inviteId={inviteId}
        inviteUrl={inviteUrl}
        onCopyInvite={handleCopy}
        onEnd={handleEnd}
        onLeave={handleLeave}
        onMove={handleMove}
        onReconnect={reconnect}
        onReturnToSession={handleReturnToSession}
        onRevokeInvite={handleRevokeInvite}
        reconnectStopped={reconnectStopped}
        reducedMotion={reducedMotion}
        snapshot={snapshot}
        stale={stale}
        stateCounts={stateCounts}
        users={users}
        working={working}
      />
    );
  } else {
    content = (
      <LobbyView
        adhocRooms={adhocRooms}
        error={error}
        expiry={expiry}
        loading={loading}
        onCancelPreview={handleCancelPreview}
        onCreate={handleCreate}
        onExpiryChange={setExpiry}
        onJoin={handleJoin}
        onOpenRoom={(room) => void handleOpenRoom(room)}
        onRefresh={refreshRooms}
        onRoomNameChange={setRoomName}
        previewUnavailable={previewUnavailable}
        roomName={roomName}
        roomPreview={roomPreview}
        teamRooms={teamRooms}
        working={working}
      />
    );
  }

  return (
    <div
      className={`${presenceHeadingFont.variable} ${presenceBodyFont.variable} wakaclock-presence-theme p-4 sm:p-8`}
      style={{ fontFamily: 'var(--font-presence-body)' }}
    >
      <PresenceHeader />
      {content}
    </div>
  );

}

export default function PresencePage() {
  return (
    <RequireUser>
      <PresenceApp />
    </RequireUser>
  );
}
