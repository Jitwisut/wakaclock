'use client';

import * as React from 'react';

import { useMutation } from '@tanstack/react-query';
import { SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';

import '@/components/presence/presence-theme.css';
import { presenceBodyFont, presenceHeadingFont } from '@/components/presence/presence-fonts';
import { PresenceHeader } from '@/components/presence/PresenceHeader';
import { PresencePlayground } from '@/components/presence/PresencePlayground';
import { RoomInviteBar } from '@/components/presence/RoomInviteBar';
import { RoomStatusCard } from '@/components/presence/RoomStatusCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RequireUser } from '@/components/wakaclock/require-user';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import {
  createOrg,
  createPresenceRoom,
  createTeam,
  joinPresenceRoom,
  leavePresenceRoom,
  leaveSession,
  presenceStreamUrl,
  startOrJoinSession,
  updatePresencePosition,
} from '@/lib/wakaclock/endpoints';
import type { PresenceRoomSnapshot, PresenceRosterEntry } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';
import { toPresenceUser } from '@/types/presence';

/** Matches the answer given when this feature was scoped: apart briefly still counts as
 * the same co-working session — only a sustained 3-minute separation ends it. */
const LEAVE_GRACE_MS = 3 * 60 * 1000;

// Extracted so each CSS custom property is written once — sonarjs flags repeated string
// literals, and these tokens are reused across nearly every element on this page.
const PRESENCE_BORDER = 'var(--presence-border)';
const PRESENCE_PANEL = 'var(--presence-panel)';
const PRESENCE_TEXT_MUTED = 'var(--presence-text-muted)';
const PRESENCE_DANGER = 'var(--presence-danger)';

// ---------------------------------------------------------------------------
// Room persistence — survives navigating away/back, browser tab switches, and
// reloads. `roomId` used to live only in React state, so any of those dropped the user
// back to the lobby even though they were still a member server-side and had never
// clicked "Leave". `join` is idempotent server-side, so replaying it on mount is safe.
// ---------------------------------------------------------------------------

const ROOM_STORAGE_KEY = 'wakaclock.presence.roomId';

function readStoredRoomId(): null | string {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ROOM_STORAGE_KEY);
}

function writeStoredRoomId(roomId: null | string): void {
  if (typeof window === 'undefined') return;
  if (roomId) {
    window.localStorage.setItem(ROOM_STORAGE_KEY, roomId);
  } else {
    window.localStorage.removeItem(ROOM_STORAGE_KEY);
  }
}

function PresenceLobby({
  creatingRoom,
  creatingTeamRoom,
  joinCode,
  joining,
  onCreateRoom,
  onCreateTeamRoom,
  onJoin,
  onJoinCodeChange,
  teamName,
  onTeamNameChange,
}: {
  creatingRoom: boolean;
  creatingTeamRoom: boolean;
  joinCode: string;
  joining: boolean;
  onCreateRoom: () => void;
  onCreateTeamRoom: () => void;
  onJoin: () => void;
  onJoinCodeChange: (value: string) => void;
  onTeamNameChange: (value: string) => void;
  teamName: string;
}) {
  return (
    <div
      className="presence-panel presence-pixel-shadow flex flex-col items-center gap-8 border-2 p-8 text-center sm:p-12"
      style={{ background: PRESENCE_PANEL, borderColor: PRESENCE_BORDER }}
    >
      <div>
        <h2
          className="text-base leading-relaxed font-bold"
          style={{ fontFamily: 'var(--font-presence-heading)' }}
        >
          Open a room, see who&apos;s here
        </h2>
        <p className="mt-3 max-w-sm text-sm" style={{ color: PRESENCE_TEXT_MUTED }}>
          Your teammates show up as sprites the moment they start coding — no status to
          set by hand.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <label
          className="text-left text-xs font-bold"
          htmlFor="team-name"
          style={{ color: PRESENCE_TEXT_MUTED }}
        >
          Team name (optional)
        </label>
        <Input
          className="presence-input h-11 border-2 text-sm"
          id="team-name"
          onChange={(e) => onTeamNameChange(e.target.value)}
          placeholder="e.g. Backend Squad"
          style={{ borderColor: PRESENCE_BORDER }}
          value={teamName}
        />

        <Button
          className="presence-pixel-shadow-sm presence-pixel-press h-11 border-2 text-sm font-bold text-white"
          disabled={!teamName.trim() || creatingTeamRoom}
          onClick={onCreateTeamRoom}
          style={{ background: PRESENCE_DANGER, borderColor: PRESENCE_BORDER }}
        >
          {creatingTeamRoom ? 'Creating…' : `Create ${teamName.trim() || 'team'} room`}
        </Button>

        <div className="flex items-center gap-2 py-1">
          <span className="h-px flex-1" style={{ background: PRESENCE_BORDER }} />
          <span className="text-xs font-bold" style={{ color: PRESENCE_TEXT_MUTED }}>
            OR
          </span>
          <span className="h-px flex-1" style={{ background: PRESENCE_BORDER }} />
        </div>

        <Button
          className="presence-pixel-shadow-sm presence-pixel-press h-11 border-2 text-sm font-bold"
          disabled={creatingRoom}
          onClick={onCreateRoom}
          style={{ background: PRESENCE_PANEL, borderColor: PRESENCE_BORDER }}
          variant="outline"
        >
          {creatingRoom ? 'Creating…' : 'Create a room without a team'}
        </Button>

        <div className="flex items-center gap-2 py-1">
          <span className="h-px flex-1" style={{ background: PRESENCE_BORDER }} />
          <span className="text-xs font-bold" style={{ color: PRESENCE_TEXT_MUTED }}>
            OR
          </span>
          <span className="h-px flex-1" style={{ background: PRESENCE_BORDER }} />
        </div>

        <div className="flex gap-2">
          <Input
            aria-label="Room link or id"
            className="presence-input h-11 border-2 text-sm"
            onChange={(e) => onJoinCodeChange(e.target.value)}
            placeholder="Paste a room link or id"
            style={{ borderColor: PRESENCE_BORDER }}
            value={joinCode}
          />
          <Button
            className="presence-pixel-shadow-sm presence-pixel-press h-11 border-2 px-5 text-sm font-bold"
            disabled={!joinCode.trim() || joining}
            onClick={onJoin}
            style={{ background: PRESENCE_PANEL, borderColor: PRESENCE_BORDER }}
          >
            Join
          </Button>
        </div>
      </div>
    </div>
  );
}

function PresenceApp() {
  const currentUserId = useWakaclockUserStore((s) => s.userId) ?? '';
  const reducedMotion = useReducedMotion();
  const [roomId, setRoomId] = React.useState<null | string>(() => readStoredRoomId());
  const [teamNameInput, setTeamNameInput] = React.useState('');
  const [roomTeamName, setRoomTeamName] = React.useState<null | string>(null);
  const [joinCode, setJoinCode] = React.useState('');
  const [roster, setRoster] = React.useState<PresenceRosterEntry[]>([]);
  const [connected, setConnected] = React.useState(false);

  // Co-working session bookkeeping — see the module doc's `LEAVE_GRACE_MS` note.
  // Client-side de-dup cache only, to avoid re-sending `startOrJoinSession` every SSE
  // tick for a pairing already reported; the real session state lives on the server.
  const clusteredWithRef = React.useRef(new Set<string>());
  const leaveTimerRef = React.useRef<null | number>(null);

  const createRoomMutation = useMutation({
    mutationFn: () => createPresenceRoom(),
    onSuccess: (data) => {
      setRoomTeamName(null);
      setRoomId(data.room_id);
      writeStoredRoomId(data.room_id);
    },
    onError: () => toast.error('Could not create a room'),
  });

  // Chains org → team → room: the UI only ever asks for one thing, a team name, but a
  // team needs an org to belong to (plan.md 6.1) — so this creates a fresh single-team
  // org behind the scenes rather than surfacing that as a separate step.
  const createTeamRoomMutation = useMutation({
    mutationFn: async (name: string) => {
      const org = await createOrg(name);
      const team = await createTeam(org.data.org_id, name);
      const room = await createPresenceRoom(team.data.team_id);
      return { room, team };
    },
    onSuccess: ({ room, team }) => {
      setRoomTeamName(team.data.name);
      setRoomId(room.room_id);
      writeStoredRoomId(room.room_id);
    },
    onError: () => toast.error('Could not create a team room'),
  });

  const joinMutation = useMutation({
    mutationFn: (id: string) => joinPresenceRoom(id),
    onSuccess: (_data, id) => {
      setRoomId(id);
      writeStoredRoomId(id);
    },
    onError: () => toast.error('Could not join that room — check the link'),
  });

  const leaveMutation = useMutation({
    mutationFn: (id: string) => leavePresenceRoom(id),
    onSettled: () => {
      setRoomId(null);
      setRoomTeamName(null);
      setRoster([]);
      setConnected(false);
      clusteredWithRef.current.clear();
      writeStoredRoomId(null);
    },
  });

  // Runs once on mount: silently re-join whatever room id survived from a previous
  // mount of this page. Falls back to the lobby (clearing the stale id) if the room no
  // longer exists — e.g. the in-memory presence store lost it to a server restart.
  React.useEffect(() => {
    const storedRoomId = readStoredRoomId();
    if (!storedRoomId) return;

    joinPresenceRoom(storedRoomId).catch(() => {
      writeStoredRoomId(null);
      setRoomId(null);
      toast.error('Your previous room is gone — start or join a new one');
    });
  }, []);

  // One SSE connection per active room. EventSource reconnects on its own after a
  // network blip; the effect only needs to tear it down on unmount or room change.
  React.useEffect(() => {
    if (!roomId) return;

    const url = presenceStreamUrl(roomId);
    if (!url) {
      toast.error('No active session — sign in again');
      return;
    }

    const source = new EventSource(url);

    source.addEventListener('open', () => setConnected(true));
    source.addEventListener('error', () => setConnected(false));
    source.addEventListener('message', (event: MessageEvent<string>) => {
      try {
        const snapshot = JSON.parse(event.data) as PresenceRoomSnapshot;
        setRoster(snapshot.roster);
        setRoomTeamName(snapshot.team_name);
      } catch {
        // A malformed tick is not worth surfacing to the user — the next tick corrects it.
      }
    });

    return () => {
      source.close();
      setConnected(false);
    };
  }, [roomId]);

  // Clear a pending grace timer on unmount so it doesn't fire (and call leaveSession)
  // after the component navigating away already left the room some other way.
  React.useEffect(
    () => () => {
      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current);
      }
    },
    []
  );

  const users = React.useMemo(
    () => roster.map((entry) => toPresenceUser(entry, currentUserId)),
    [roster, currentUserId]
  );

  const handleMoveCurrentUser = React.useCallback(
    (next: { x: number; y: number }) => {
      if (!roomId) return;
      void updatePresencePosition(roomId, next.x, next.y);
    },
    [roomId]
  );

  // Proximity → co-working sessions. `PresencePlayground` re-derives "who's nearby"
  // from the (server-synced) roster on every SSE tick and reports it here; this is
  // where that turns into the actual `startOrJoinSession`/`leaveSession` calls.
  const handleNearbyChange = React.useCallback(
    (nearbyIds: string[]) => {
      if (!roomId) return;

      if (nearbyIds.length > 0) {
        if (leaveTimerRef.current !== null) {
          window.clearTimeout(leaveTimerRef.current);
          leaveTimerRef.current = null;
        }
        for (const id of nearbyIds) {
          if (clusteredWithRef.current.has(id)) continue;
          clusteredWithRef.current.add(id);
          void startOrJoinSession(roomId, id);
        }
      } else if (clusteredWithRef.current.size > 0 && leaveTimerRef.current === null) {
        leaveTimerRef.current = window.setTimeout(() => {
          clusteredWithRef.current.clear();
          leaveTimerRef.current = null;
          void leaveSession(roomId);
        }, LEAVE_GRACE_MS);
      }
    },
    [roomId]
  );

  const inviteLink =
    roomId && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${roomId}`
      : null;

  return (
    <div
      className={`${presenceHeadingFont.variable} ${presenceBodyFont.variable} wakaclock-presence-theme p-4 sm:p-8`}
      style={{ fontFamily: 'var(--font-presence-body)' }}
    >
      <PresenceHeader />

      {roomId ? (
        <div className="flex flex-col gap-4">
          <RoomStatusCard
            onLeave={() => leaveMutation.mutate(roomId)}
            room={{
              id: roomId,
              name: roomTeamName ?? 'The room',
              isLive: connected,
              memberCount: users.length,
            }}
          />

          {inviteLink ? <RoomInviteBar url={inviteLink} /> : null}

          <p className="flex items-center gap-1.5 px-1 text-xs font-bold" style={{ color: PRESENCE_TEXT_MUTED }}>
            <SparklesIcon aria-hidden className="size-3.5" style={{ color: '#ffd166' }} />
            Drag your own sprite around — land close to a teammate to start a co-working
            session.
          </p>

          {users.length === 0 ? (
            <div
              className="presence-field flex min-h-[350px] items-center justify-center border-[3px] text-center sm:min-h-[420px]"
              style={{ borderColor: PRESENCE_BORDER }}
            >
              <p className="text-sm font-bold" style={{ color: PRESENCE_BORDER }}>
                Waiting for your teammates to show up…
              </p>
            </div>
          ) : (
            <PresencePlayground
              currentUserId={currentUserId}
              key={roomId}
              onMoveCurrentUser={handleMoveCurrentUser}
              onNearbyChange={handleNearbyChange}
              reducedMotion={reducedMotion}
              users={users}
            />
          )}
        </div>
      ) : (
        <PresenceLobby
          creatingRoom={createRoomMutation.isPending}
          creatingTeamRoom={createTeamRoomMutation.isPending}
          joinCode={joinCode}
          joining={joinMutation.isPending}
          onCreateRoom={() => createRoomMutation.mutate()}
          onCreateTeamRoom={() => createTeamRoomMutation.mutate(teamNameInput.trim())}
          onJoin={() => {
            const id = joinCode.trim().split('room=').pop() ?? joinCode.trim();
            joinMutation.mutate(id);
          }}
          onJoinCodeChange={setJoinCode}
          onTeamNameChange={setTeamNameInput}
          teamName={teamNameInput}
        />
      )}
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
