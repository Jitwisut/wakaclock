'use client';

import * as React from 'react';

import { useMutation } from '@tanstack/react-query';
import {
  ConstructionIcon,
  DoorOpenIcon,
  LinkIcon,
  UsersRoundIcon,
  WifiIcon,
  WifiOffIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CharacterAvatar } from '@/components/wakaclock/presence/character-avatar';
import { gameBodyFont, gameHeadingFont } from '@/components/wakaclock/presence/game-fonts';
import '@/components/wakaclock/presence/game-theme.css';
import { RoomCanvas } from '@/components/wakaclock/presence/room-canvas';
import { RequireUser } from '@/components/wakaclock/require-user';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import {
  createOrg,
  createPresenceRoom,
  createTeam,
  joinPresenceRoom,
  leavePresenceRoom,
  presenceStreamUrl,
} from '@/lib/wakaclock/endpoints';
import type { PresenceRoomSnapshot, PresenceRosterEntry } from '@/lib/wakaclock/types';
import { useWakaclockUserStore } from '@/lib/wakaclock/user-store';

const headingStyle: React.CSSProperties = { fontFamily: 'var(--font-game-heading)' };

// Extracted so each CSS custom property is written once — sonarjs flags repeated string
// literals, and these tokens are reused across nearly every element on this page.
const GAME_SURFACE = 'var(--game-surface)';
const GAME_SURFACE_BORDER = 'var(--game-surface-border)';
const GAME_TEXT_MUTED = 'var(--game-text-muted)';
const GAME_PRIMARY = 'var(--game-primary)';
const GAME_PRIMARY_FG = 'var(--game-primary-fg)';

const mutedTextStyle: React.CSSProperties = { color: GAME_TEXT_MUTED };
const surfaceCardStyle: React.CSSProperties = { background: GAME_SURFACE, borderColor: GAME_SURFACE_BORDER };
const primaryButtonStyle: React.CSSProperties = {
  background: GAME_PRIMARY,
  color: GAME_PRIMARY_FG,
  borderColor: GAME_PRIMARY,
};

/** Hard-edged, unblurred offset shadow — a pixel-art panel/button "sits" on this rather
 * than casting a soft claymorphism shadow. Pairs with the `.wakaclock-pixel-press`
 * class (game-theme.css) for the hover/active lift-and-press illusion. */
function pixelShadow(): React.CSSProperties {
  return { boxShadow: '4px 4px 0 var(--game-shadow-color)' };
}

// ---------------------------------------------------------------------------
// Room persistence — see the module doc below for the bug this closes.
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

function PrototypeBadge() {
  return (
    <span
      className="wakaclock-pixel-press inline-flex items-center gap-1.5 border-4 px-3 py-1.5 text-xs font-bold"
      style={{ ...surfaceCardStyle, ...pixelShadow() }}
    >
      <ConstructionIcon aria-hidden className="size-3.5" style={{ color: GAME_PRIMARY }} />
      Prototype
    </span>
  );
}

/**
 * Coding presence — Phase 7 prototype (plan.md), retro-arcade/pixel-art skin, group
 * co-working sessions (plan.md 7.4).
 *
 * A room can optionally be created "for a team" — that flow creates a minimal org+team
 * (see `handlers/v1/orgs.rs` for the deliberately small scope: this is not the full
 * org-management surface plan.md 6.1 eventually describes) and labels the room with the
 * team's real, permission-checked name rather than free text.
 *
 * Positions on the canvas are synced server-side, not local-only — every viewer's SSE
 * stream carries everyone's coordinates, which is what makes "two characters dragged
 * together" a trustworthy signal to build a recorded co-working session on. Dragging
 * two characters close plays a celebration burst *and* reports the pairing to the
 * server; staying apart for more than the agreed 3-minute grace period ends that
 * session. See `room-canvas.tsx` for the clustering logic.
 *
 * Room membership survives navigating away and back (`ROOM_STORAGE_KEY` below): the
 * current room id is mirrored into `localStorage`, and on mount `PresenceApp` replays a
 * `POST .../join` for whatever id was stored — the join endpoint is idempotent, so this
 * is safe to call even when the membership never actually lapsed. Before this, `roomId`
 * lived only in React state, so switching to another dashboard page (which unmounts
 * this component), switching browser tabs, or reloading all dropped the user back to
 * the lobby even though they were still a member server-side and had never clicked
 * "Leave".
 */
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
      className="flex flex-col items-center gap-8 border-4 p-8 text-center sm:p-12"
      style={{ ...surfaceCardStyle, ...pixelShadow() }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-16 items-center justify-center border-4" style={surfaceCardStyle}>
          <UsersRoundIcon className="size-8" style={{ color: GAME_PRIMARY }} />
        </div>
        <h2 className="text-lg leading-relaxed font-bold" style={headingStyle}>
          Open a room, see who&apos;s here
        </h2>
        <p className="max-w-sm text-base" style={mutedTextStyle}>
          Your teammates show up as sprites the moment they start coding — no status to
          set by hand.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <label className="text-left text-sm font-bold" htmlFor="team-name" style={mutedTextStyle}>
          Team name (optional)
        </label>
        <div className="flex gap-2">
          <Input
            className="h-12 border-4 text-base"
            id="team-name"
            onChange={(e) => onTeamNameChange(e.target.value)}
            placeholder="e.g. Backend Squad"
            style={{ borderColor: GAME_SURFACE_BORDER }}
            value={teamName}
          />
        </div>

        <Button
          className="wakaclock-pixel-press h-12 border-4 text-base font-bold"
          disabled={!teamName.trim() || creatingTeamRoom}
          onClick={onCreateTeamRoom}
          style={{ ...primaryButtonStyle, ...pixelShadow() }}
        >
          {creatingTeamRoom ? 'Creating…' : `Create ${teamName.trim() || 'team'} room`}
        </Button>

        <div className="flex items-center gap-2 py-1">
          <span className="h-1 flex-1" style={{ background: GAME_SURFACE_BORDER }} />
          <span className="text-sm font-bold" style={mutedTextStyle}>
            OR
          </span>
          <span className="h-1 flex-1" style={{ background: GAME_SURFACE_BORDER }} />
        </div>

        <Button
          className="wakaclock-pixel-press h-11 border-4 font-bold"
          disabled={creatingRoom}
          onClick={onCreateRoom}
          style={{ ...surfaceCardStyle, ...pixelShadow() }}
          variant="outline"
        >
          {creatingRoom ? 'Creating…' : 'Create a room without a team'}
        </Button>

        <div className="flex items-center gap-2 py-1">
          <span className="h-1 flex-1" style={{ background: GAME_SURFACE_BORDER }} />
          <span className="text-sm font-bold" style={mutedTextStyle}>
            OR
          </span>
          <span className="h-1 flex-1" style={{ background: GAME_SURFACE_BORDER }} />
        </div>

        <div className="flex gap-2">
          <Input
            aria-label="Room link or id"
            className="h-12 border-4 text-base"
            onChange={(e) => onJoinCodeChange(e.target.value)}
            placeholder="Paste a room link or id"
            style={{ borderColor: GAME_SURFACE_BORDER }}
            value={joinCode}
          />
          <Button
            className="wakaclock-pixel-press h-12 border-4 px-5 text-base font-bold"
            disabled={!joinCode.trim() || joining}
            onClick={onJoin}
            style={{ ...surfaceCardStyle, ...pixelShadow(), color: 'var(--game-text)' }}
          >
            Join
          </Button>
        </div>
      </div>
    </div>
  );
}

function PresenceRoom({
  connected,
  currentUserId,
  inviteLink,
  onLeave,
  reducedMotion,
  roomId,
  roster,
  teamName,
}: {
  connected: boolean;
  currentUserId: string;
  inviteLink: null | string;
  onLeave: () => void;
  reducedMotion: boolean;
  roomId: string;
  roster: PresenceRosterEntry[];
  teamName: null | string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-4 p-5"
        style={{ ...surfaceCardStyle, ...pixelShadow() }}
      >
        <div>
          <h2 className="flex items-center gap-2 text-base leading-relaxed font-bold" style={headingStyle}>
            {teamName ?? 'The room'}
          </h2>
          <p
            className="mt-2 flex items-center gap-1.5 text-sm font-bold"
            style={{ color: connected ? 'var(--game-accent)' : GAME_TEXT_MUTED }}
          >
            {connected ? (
              <WifiIcon aria-hidden className="size-4" />
            ) : (
              <WifiOffIcon aria-hidden className="size-4" />
            )}
            {connected ? 'Live' : 'Reconnecting…'}
            <span aria-hidden>·</span>
            {roster.length} here
          </p>
        </div>
        <Button
          className="wakaclock-pixel-press h-10 gap-1.5 border-4 font-bold"
          onClick={onLeave}
          style={{ ...surfaceCardStyle, ...pixelShadow(), color: 'var(--game-text)' }}
        >
          <DoorOpenIcon aria-hidden className="size-4" />
          Leave
        </Button>
      </div>

      {inviteLink ? (
        <div className="flex items-center gap-2">
          <div className="flex h-11 flex-1 items-center gap-2 border-4 px-3" style={surfaceCardStyle}>
            <LinkIcon aria-hidden className="size-4 shrink-0" style={mutedTextStyle} />
            <input
              aria-label="Invite link"
              className="w-full truncate bg-transparent text-sm outline-none"
              readOnly
              value={inviteLink}
            />
          </div>
          <Button
            className="wakaclock-pixel-press h-11 border-4 px-4 text-sm font-bold"
            onClick={() => {
              void navigator.clipboard.writeText(inviteLink);
              toast.success('Invite link copied');
            }}
            style={{ ...primaryButtonStyle, ...pixelShadow() }}
          >
            Copy
          </Button>
        </div>
      ) : null}

      <p className="px-1 text-sm font-bold" style={mutedTextStyle}>
        Drag your own sprite around — land close to a teammate to start a co-working
        session.
      </p>

      {roster.length === 0 ? (
        <div
          className="wakaclock-game-canvas flex min-h-80 flex-col items-center justify-center gap-2 border-4 text-center"
          style={{ borderColor: GAME_SURFACE_BORDER }}
        >
          <CharacterAvatar color="#B24BF3" reducedMotion={reducedMotion} state="idle" username="You" />
          <p className="text-sm font-bold" style={mutedTextStyle}>
            Waiting for your teammates to show up…
          </p>
        </div>
      ) : (
        <RoomCanvas
          currentUserId={currentUserId}
          key={roomId}
          reducedMotion={reducedMotion}
          roomId={roomId}
          roster={roster}
        />
      )}
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
      writeStoredRoomId(null);
    },
  });

  // Runs once on mount only: if a room id survived from a previous mount of this page
  // (navigating away and back, a browser tab switch, or a reload — see the module doc
  // above), silently re-join it. `join` is idempotent server-side, so this is safe to
  // fire even when membership never actually lapsed. It only needs to do anything when
  // the room genuinely no longer exists (e.g. the in-memory presence store lost it to a
  // server restart — plan.md 7.1 notes this store doesn't survive one) — in that case,
  // fall back to the lobby instead of leaving the UI stuck showing a dead room.
  React.useEffect(() => {
    const storedRoomId = readStoredRoomId();
    if (!storedRoomId) return;

    joinPresenceRoom(storedRoomId).catch(() => {
      writeStoredRoomId(null);
      setRoomId(null);
      toast.error('Your previous room is gone — start or join a new one');
    });
    // Intentionally runs once: explicit create/join flows above manage their own
    // membership and storage from here on, this only re-establishes it after a remount.
  }, []);

  // Opens one SSE connection per active room. EventSource reconnects automatically on
  // its own after a network blip; the effect only needs to tear it down on unmount or
  // when the room changes.
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

  const inviteLink =
    roomId && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${roomId}`
      : null;

  return (
    <div
      className={`${gameHeadingFont.variable} ${gameBodyFont.variable} wakaclock-game-theme p-4 sm:p-8`}
      style={{ fontFamily: 'var(--font-game-body)' }}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl leading-relaxed font-bold sm:text-2xl" style={headingStyle}>
            Coding presence
          </h1>
          <p className="mt-2 text-base" style={mutedTextStyle}>
            See who&apos;s actually coding right now — driven by real activity, not a status
            anyone sets.
          </p>
        </div>
        <PrototypeBadge />
      </div>

      {roomId ? (
        <PresenceRoom
          connected={connected}
          currentUserId={currentUserId}
          inviteLink={inviteLink}
          onLeave={() => leaveMutation.mutate(roomId)}
          reducedMotion={reducedMotion}
          roomId={roomId}
          roster={roster}
          teamName={roomTeamName}
        />
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
