'use client';

import * as React from 'react';

import { CopyIcon, DoorOpenIcon, LinkIcon, RefreshCwIcon, UsersIcon } from 'lucide-react';

import { HistoryList } from '@/components/presence/HistoryList';
import { PresencePlayground } from '@/components/presence/PresencePlayground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PresenceWeeklySummary } from '@/hooks/use-coworking-history';
import type {
  PresenceHistoryItem,
  PresenceV2Room,
  PresenceV2RoomData,
  PresenceV2Session,
  PresenceV2Snapshot,
} from '@/lib/wakaclock/types';
import type { PresenceUser } from '@/types/presence';

const border = 'var(--presence-border)';
const panel = 'var(--presence-panel)';
const muted = 'var(--presence-text-muted)';
const danger = 'var(--presence-danger)';
const live = 'var(--presence-live)';
const soft = 'var(--presence-bg-soft)';
const headingFont = 'var(--font-presence-heading)';

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function formatExpiry(value: null | string): string {
  if (!value) return 'Persistent team room';
  const date = new Date(value);
  return `Expires ${date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

function roomLabel(room: PresenceV2Room): string {
  return room.kind === 'team' ? `Team room · ${room.name}` : `Quick room · ${room.name}`;
}

function connectionLabel(connected: boolean, stale: boolean): string {
  if (connected) return 'Live';
  if (stale) return 'Stale · reconnecting';
  return 'Connecting';
}


function SessionBar({
  currentUserId,
  onReturn,
  session,
}: {
  currentUserId: string;
  onReturn?: () => void;
  session: PresenceV2Session;
}) {
  const [now, setNow] = React.useState(() => Math.floor(Date.now() / 1000));
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const participants = session.participants.filter(
    (participant) => participant.user_id !== currentUserId
  );
  const leavingUntil = session.leaving_deadlines[currentUserId];
  const graceRemaining = leavingUntil ? Math.max(0, leavingUntil - now) : 0;
  const partnerLabel =
    participants.length > 0
      ? `With ${participants.map((participant) => participant.username).join(', ')}`
      : 'Your table';

  return (
    <div
      className="presence-panel presence-pixel-shadow flex flex-wrap items-center justify-between gap-4 border-2 p-4"
      style={{ background: '#e8fff0', borderColor: border }}
    >
      <div className="flex items-center gap-3">
        <span className="presence-live-dot size-3 rounded-full" style={{ background: live }} />
        <div>
          <p className="text-xs font-bold uppercase" style={{ color: muted }}>
            Co-working session
          </p>
          <p className="text-sm font-bold">{partnerLabel}</p>
        </div>
      </div>
      {graceRemaining > 0 ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: live }}>
            Return within {formatDuration(graceRemaining)}
          </span>
          {onReturn ? (
            <Button
              className="border-2"
              onClick={onReturn}
              style={{ background: panel, borderColor: border }}
              variant="outline"
            >
              Return to session
            </Button>
          ) : null}
        </div>
      ) : (
        <span className="text-sm font-bold" style={{ color: live }}>
          {formatDuration(now - session.started_at)}
        </span>
      )}
    </div>
  );
}

export function RoomList({
  rooms,
  onOpen,
}: {
  onOpen: (room: PresenceV2Room) => void;
  rooms: PresenceV2Room[];
}) {
  if (rooms.length === 0) {
    return (
      <p
        className="border-2 border-dashed p-4 text-center text-sm"
        style={{ borderColor: border, color: muted }}
      >
        No team rooms yet. Create a quick room to invite teammates.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rooms.map((room) => (
        <button
          className="presence-pixel-shadow-sm presence-pixel-press flex items-center justify-between gap-4 border-2 p-4 text-left"
          key={room.id}
          onClick={() => onOpen(room)}
          style={{ background: panel, borderColor: border }}
          type="button"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{roomLabel(room)}</span>
            <span className="mt-1 block text-xs" style={{ color: muted }}>
              {formatExpiry(room.expires_at)}
            </span>
          </span>
          <UsersIcon aria-hidden className="size-5 shrink-0" style={{ color: muted }} />
        </button>
      ))}
    </div>
  );
}

interface HistoryState {
  error: null | string;
  items: PresenceHistoryItem[];
  loading: boolean;
  reload: () => Promise<void>;
  weeklySummary: null | PresenceWeeklySummary;
}

interface ActiveRoomViewProps {
  activeRoom: PresenceV2RoomData;
  activeSession?: PresenceV2Session;
  connected: boolean;
  currentUserId: string;
  floorHeightScale?: number;
  history: HistoryState;
  inviteId: null | string;
  inviteUrl: null | string;
  onCopyInvite: () => Promise<void>;
  onEnd: () => Promise<void>;
  onLeave: () => Promise<void>;
  onMove: (position: { x: number; y: number }) => void;
  onReconnect: () => void;
  onReturnToSession: () => void;
  onRevokeInvite: () => Promise<void>;
  reconnectStopped: boolean;
  reducedMotion: boolean;
  snapshot: PresenceV2Snapshot;
  stale: boolean;
  stateCounts: Record<'coding' | 'idle' | 'offline', number>;
  users: PresenceUser[];
  working: boolean;
}

export function ActiveRoomView({
  activeRoom,
  activeSession,
  connected,
  currentUserId,
  floorHeightScale = 1,
  history,
  inviteId,
  inviteUrl,
  onCopyInvite,
  onEnd,
  onLeave,
  onMove,
  onReconnect,
  onReturnToSession,
  onRevokeInvite,
  reconnectStopped,
  reducedMotion,
  snapshot,
  stale,
  stateCounts,
  users,
  working,
}: ActiveRoomViewProps) {
  const statusLabel = connectionLabel(connected, stale);
  const isOwner = activeRoom.kind === 'adhoc' && activeRoom.owner_user_id === currentUserId;
  const playgroundSessions = snapshot.sessions.map((session) => ({
    participantIds: session.participants.map((participant) => participant.user_id),
    zoneId: session.zone_id,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div
        className="presence-panel presence-pixel-shadow flex flex-wrap items-center justify-between gap-4 border-2 p-5"
        style={{ background: panel, borderColor: border }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex size-11 items-center justify-center border-2"
            style={{ background: soft, borderColor: border }}
          >
            <UsersIcon aria-hidden className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: headingFont }}>
              {activeRoom.name}
            </h2>
            <p className="text-xs font-bold" style={{ color: connected ? live : muted }}>
              {statusLabel} · {snapshot.roster.length} here · coding {stateCounts.coding} · idle{' '}
              {stateCounts.idle} · offline {stateCounts.offline}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner ? (
            <Button
              className="presence-pixel-shadow-sm presence-pixel-press border-2"
              disabled={working}
              onClick={() => void onEnd()}
              style={{ background: danger, borderColor: border, color: 'white' }}
            >
              End room
            </Button>
          ) : null}
          <Button
            className="presence-pixel-shadow-sm presence-pixel-press border-2"
            disabled={working}
            onClick={() => void onLeave()}
            style={{ background: panel, borderColor: border }}
            variant="outline"
          >
            <DoorOpenIcon aria-hidden className="size-4" />
            Leave room
          </Button>
        </div>
      </div>

      {inviteUrl ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div
            className="flex min-w-0 flex-1 items-center gap-2 border-2 px-3"
            style={{ background: panel, borderColor: border }}
          >
            <LinkIcon aria-hidden className="size-4 shrink-0" style={{ color: muted }} />
            <input
              aria-label="Room invite link"
              className="w-full truncate bg-transparent text-xs outline-none"
              readOnly
              value={inviteUrl}
            />
          </div>
          <Button
            className="presence-pixel-shadow-sm presence-pixel-press border-2"
            onClick={() => void onCopyInvite()}
            style={{ background: danger, borderColor: border, color: 'white' }}
          >
            <CopyIcon aria-hidden className="size-4" /> Copy invite
          </Button>
          {inviteId ? (
            <Button
              className="presence-pixel-shadow-sm presence-pixel-press border-2"
              onClick={() => void onRevokeInvite()}
              style={{ background: panel, borderColor: border }}
              variant="outline"
            >
              Revoke
            </Button>
          ) : null}
        </div>
      ) : null}

      {activeSession ? (
        <SessionBar
          currentUserId={currentUserId}
          onReturn={onReturnToSession}
          session={activeSession}
        />
      ) : null}

      {reconnectStopped ? (
        <Button
          className="presence-pixel-shadow-sm presence-pixel-press self-start border-2"
          onClick={onReconnect}
          style={{ background: danger, borderColor: border, color: 'white' }}
        >
          Reconnect
        </Button>
      ) : null}

      <p className="px-1 text-xs font-bold" style={{ color: muted }}>
        Walk your sprite onto a pod to make your availability explicit. A second teammate
        entering the same pod starts a shared co-working session.
      </p>

      <div className="hidden md:block">
        <PresencePlayground
          currentUserId={currentUserId}
          heightScale={floorHeightScale}
          onMoveCurrentUser={onMove}
          reducedMotion={reducedMotion}
          sessions={playgroundSessions}
          users={users}
          zones={snapshot.zones}
        />
      </div>
      <div aria-label="Collaboration pods" className="grid gap-2 md:hidden">
        {snapshot.zones.map((zone) => {
          const occupied = snapshot.roster.filter((entry) => entry.zone_id === zone.id).length;
          const atZone = snapshot.roster.some(
            (entry) => entry.user_id === currentUserId && entry.zone_id === zone.id
          );
          const nextPosition = atZone
            ? { x: 50, y: 50 }
            : { x: zone.center_x, y: zone.center_y };
          return (
            <div
              className="flex items-center justify-between gap-3 border-2 p-3"
              key={zone.id}
              style={{ background: panel, borderColor: border }}
            >
              <div>
                <p className="text-sm font-bold">{zone.label}</p>
                <p className="text-xs" style={{ color: muted }}>
                  {occupied} occupant{occupied === 1 ? '' : 's'}
                </p>
              </div>
              <Button
                className="border-2"
                onClick={() => onMove(nextPosition)}
                style={{
                  background: atZone ? soft : danger,
                  borderColor: border,
                  color: atZone ? 'inherit' : 'white',
                }}
              >
                {atZone ? 'Leave table' : 'Join table'}
              </Button>
            </div>
          );
        })}
      </div>

      <section
        className="presence-panel presence-pixel-shadow border-2 p-5"
        style={{ background: panel, borderColor: border }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase" style={{ color: muted }}>
              History
            </p>
            <h3 className="mt-1 text-lg font-bold">Your co-working today</h3>
          </div>
          <Button
            className="presence-pixel-shadow-sm presence-pixel-press border-2"
            onClick={() => void history.reload()}
            style={{ background: panel, borderColor: border }}
            variant="outline"
          >
            Refresh
          </Button>
        </div>
        <div className="mt-4">
          <HistoryList items={history.items} loading={history.loading} />
          {history.weeklySummary ? (
            <div
              className="mt-3 grid gap-2 border-2 p-3 text-xs sm:grid-cols-3"
              style={{ background: soft, borderColor: border }}
            >
              <span>
                <strong>Weekly sessions:</strong> {history.weeklySummary.sessions}
              </span>
              <span>
                <strong>Collaboration time:</strong>{' '}
                {formatDuration(history.weeklySummary.durationSeconds)}
              </span>
              <span>
                <strong>Active days:</strong> {history.weeklySummary.activeDays}
              </span>
            </div>
          ) : null}
          {history.error ? (
            <p className="mt-3 text-xs" style={{ color: danger }}>
              {history.error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

interface LobbyViewProps {
  adhocRooms: PresenceV2Room[];
  error: null | string;
  expiry: string;
  loading: boolean;
  onCancelPreview: () => void;
  onCreate: () => Promise<void>;
  onExpiryChange: (value: string) => void;
  onJoin: () => Promise<void>;
  onOpenRoom: (room: PresenceV2Room) => void;
  onRefresh: () => Promise<void>;
  onRoomNameChange: (value: string) => void;
  previewUnavailable: boolean;
  roomName: string;
  roomPreview: null | PresenceV2RoomData;
  teamRooms: PresenceV2Room[];
  working: boolean;
}

export function LobbyView({
  adhocRooms,
  error,
  expiry,
  loading,
  onCancelPreview,
  onCreate,
  onExpiryChange,
  onJoin,
  onOpenRoom,
  onRefresh,
  onRoomNameChange,
  previewUnavailable,
  roomName,
  roomPreview,
  teamRooms,
  working,
}: LobbyViewProps) {
  return (
    <div className="flex flex-col gap-5">
      {roomPreview ? (
        <div
          className="presence-panel presence-pixel-shadow border-2 p-6"
          style={{ background: panel, borderColor: border }}
        >
          <p className="text-xs font-bold uppercase" style={{ color: muted }}>
            Join preview
          </p>
          <h2
            className="mt-2 text-xl font-bold"
            style={{ fontFamily: headingFont }}
          >
            {roomLabel(roomPreview)}
          </h2>
          <p className="mt-2 text-sm" style={{ color: previewUnavailable ? danger : muted }}>
            {previewUnavailable
              ? 'This room or invite has expired.'
              : `${formatExpiry(roomPreview.expires_at)} · 3 collaboration tables`}
          </p>
          <div className="mt-5 flex gap-3">
            <Button
              className="presence-pixel-shadow-sm presence-pixel-press border-2 text-white"
              disabled={working || previewUnavailable}
              onClick={() => void onJoin()}
              style={{ background: danger, borderColor: border }}
            >
              {working ? 'Joining…' : 'Join room'}
            </Button>
            <Button
              className="presence-pixel-shadow-sm presence-pixel-press border-2"
              onClick={onCancelPreview}
              style={{ background: panel, borderColor: border }}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className="presence-panel presence-pixel-shadow border-2 p-6 sm:p-8"
        style={{ background: panel, borderColor: border }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase" style={{ color: muted }}>
              My teams
            </p>
            <h2
              className="mt-2 text-xl font-bold"
              style={{ fontFamily: headingFont }}
            >
              Choose a room to show up
            </h2>
            <p className="mt-2 max-w-xl text-sm" style={{ color: muted }}>
              Live counts stay private until you join. Once inside, everyone who can see the room
              appears in the roster too.
            </p>
          </div>
          <Button
            className="presence-pixel-shadow-sm presence-pixel-press border-2"
            onClick={() => void onRefresh()}
            style={{ background: panel, borderColor: border }}
            variant="outline"
          >
            <RefreshCwIcon aria-hidden className="size-4" /> Refresh
          </Button>
        </div>
        <div className="mt-5">
          {loading ? (
            <p className="text-sm" style={{ color: muted }}>
              Loading rooms…
            </p>
          ) : (
            <RoomList onOpen={onOpenRoom} rooms={teamRooms} />
          )}
        </div>
      </div>

      {adhocRooms.length > 0 ? (
        <div
          className="presence-panel presence-pixel-shadow border-2 p-6 sm:p-8"
          style={{ background: panel, borderColor: border }}
        >
          <p className="text-xs font-bold uppercase" style={{ color: muted }}>
            Recent ad-hoc rooms
          </p>
          <div className="mt-4">
            <RoomList onOpen={onOpenRoom} rooms={adhocRooms} />
          </div>
        </div>
      ) : null}

      <div
        className="presence-panel presence-pixel-shadow border-2 p-6 sm:p-8"
        style={{ background: panel, borderColor: border }}
      >
        <p className="text-xs font-bold uppercase" style={{ color: muted }}>
          Quick room
        </p>
        <h2
          className="mt-2 text-lg font-bold"
          style={{ fontFamily: headingFont }}
        >
          Start a temporary co-working room
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <Input
            className="presence-input h-11 border-2"
            onChange={(event) => onRoomNameChange(event.target.value)}
            placeholder="e.g. Friday pairing"
            style={{ borderColor: border }}
            value={roomName}
          />
          <select
            aria-label="Room expiry"
            className="presence-input h-11 border-2 px-3 text-sm"
            onChange={(event) => onExpiryChange(event.target.value)}
            style={{ borderColor: border }}
            value={expiry}
          >
            <option value="3600">1 hour</option>
            <option value="86400">24 hours</option>
            <option value="604800">7 days</option>
          </select>
          <Button
            className="presence-pixel-shadow-sm presence-pixel-press h-11 border-2 text-white"
            disabled={roomName.trim().length === 0 || working}
            onClick={() => void onCreate()}
            style={{ background: danger, borderColor: border }}
          >
            {working ? 'Creating…' : 'Create room'}
          </Button>
        </div>
        {error ? (
          <p className="mt-3 text-sm" style={{ color: danger }}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function AvailabilityMessage({
  loading,
  unavailable,
}: {
  loading: boolean;
  unavailable: boolean;
}) {
  if (!loading && !unavailable) return null;
  return (
    <div
      className="presence-panel presence-pixel-shadow border-2 p-6"
      style={{ background: panel, borderColor: border }}
    >
      {loading ? (
        <p className="text-sm" style={{ color: muted }}>
          Checking Presence availability…
        </p>
      ) : (
        <p className="text-sm" style={{ color: danger }}>
          Presence v2 is not enabled on this server. Ask an administrator to set
          PRESENCE_V2_ENABLED=true with PostgreSQL and Redis configured.
        </p>
      )}
    </div>
  );
}
