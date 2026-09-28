'use client';

import * as React from 'react';

import {
  ActivityIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CopyIcon,
  DoorOpenIcon,
  HandshakeIcon,
  InfoIcon,
  LinkIcon,
  LogInIcon,
  LogOutIcon,
  MousePointerClickIcon,
  PlusIcon,
  PowerIcon,
  RefreshCwIcon,
  UsersIcon,
} from 'lucide-react';
import { animate, motion, useMotionValue, useMotionValueEvent } from 'motion/react';

import { HistoryList } from '@/components/presence/HistoryList';
import { PresencePlayground } from '@/components/presence/PresencePlayground';
import type { PresenceWeeklySummary } from '@/hooks/use-coworking-history';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { freeSlotIndex, seatAnchor, standingSpotNear } from '@/lib/presence/floor-geometry';
import {
  formatPresenceDuration,
  percentChange,
  PRESENCE_STATES,
  PRESENCE_STATUS,
  type PresenceActivityEvent,
  type PresenceActivityKind,
  type PresenceCounts,
  presenceHeadline,
} from '@/lib/presence/presence-status';
import type {
  PresenceHistoryItem,
  PresenceV2Room,
  PresenceV2RoomData,
  PresenceV2Session,
  PresenceV2Snapshot,
} from '@/lib/wakaclock/types';
import { DEFAULT_SPAWN_POSITION, type PresenceUser } from '@/types/presence';

import styles from './presence-chrome.module.css';

function formatExpiry(value: null | string): string {
  if (!value) return 'Persistent team room';
  const date = new Date(value);
  return `Expires ${date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

function previewDetail(room: PresenceV2RoomData): string {
  const pods = room.zones.length;
  return `${formatExpiry(room.expires_at)} · ${pods} co-working ${pods === 1 ? 'pod' : 'pods'}`;
}

function AnimatedNumber({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(value);
  const [shown, setShown] = React.useState(value);
  useMotionValueEvent(motionValue, 'change', (latest) => setShown(Math.round(latest)));
  React.useEffect(() => {
    if (reduced) {
      motionValue.jump(value);
      setShown(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [motionValue, reduced, value]);
  return (
    <>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{value}</span>
    </>
  );
}

function SessionBar({
  currentUserId,
  now,
  onReturn,
  session,
}: {
  currentUserId: string;
  now: number;
  onReturn: () => void;
  session: PresenceV2Session;
}) {
  const participants = session.participants.filter(
    (participant) => participant.user_id !== currentUserId
  );
  const leavingUntil = session.leaving_deadlines[currentUserId];
  const graceRemaining = leavingUntil ? Math.max(0, leavingUntil - now) : 0;
  const partnerLabel =
    participants.length > 0
      ? `With ${participants.map((participant) => participant.username).join(', ')}`
      : 'Your table — waiting for a teammate';

  return (
    <div className={styles.session}>
      <div className="flex items-center gap-3">
        <span aria-hidden className={`${styles.dot} ${styles.coding} ${styles.dotPulse}`} />
        <div>
          <p className={styles.eyebrow}>Co-working session</p>
          <p className="text-sm font-semibold">{partnerLabel}</p>
        </div>
      </div>
      {graceRemaining > 0 ? (
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: 'var(--pc-idle)' }}>
            Return within {formatPresenceDuration(graceRemaining)}
          </span>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onReturn} type="button">
            Return to session
          </button>
        </div>
      ) : (
        <span className={styles.sessionTime}>
          {formatPresenceDuration(now - session.started_at)}
        </span>
      )}
    </div>
  );
}

/** Room-at-a-glance: counts per live state, their split, and live co-working. */
export function RoomPulse({
  counts,
  pods,
  podsOccupied,
  sessions,
}: {
  counts: PresenceCounts;
  pods: number;
  podsOccupied: number;
  sessions: number;
}) {
  const total = counts.coding + counts.idle + counts.offline;
  return (
    <section aria-labelledby="pulse-heading" className={`${styles.panel} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={styles.eyebrow}>Right now</p>
          <h2 className={styles.title} id="pulse-heading">
            {presenceHeadline(counts)}
          </h2>
        </div>
        <span className={styles.pill}>
          <HandshakeIcon aria-hidden className="size-3.5" />
          <strong>{sessions}</strong> co-working {sessions === 1 ? 'session' : 'sessions'} ·{' '}
          <strong>
            {podsOccupied}/{pods}
          </strong>{' '}
          pods in use
        </span>
      </div>
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            <UsersIcon aria-hidden className="size-3.5" /> In room
          </span>
          <span className={styles.metricValue}>
            <AnimatedNumber value={total} />
          </span>
          <span className={styles.metricSub}>Everyone connected to this room</span>
        </div>
        {PRESENCE_STATES.map((state) => (
          <div
            className={`${styles.metric} ${styles[state]}`}
            key={state}
            title={PRESENCE_STATUS[state].description}
          >
            <span className={styles.metricLabel}>
              <span aria-hidden>{PRESENCE_STATUS[state].glyph}</span> {PRESENCE_STATUS[state].label}
            </span>
            <span className={styles.metricValue}>
              <AnimatedNumber value={counts[state]} />
            </span>
            <span className={styles.metricSub}>{PRESENCE_STATUS[state].description}</span>
          </div>
        ))}
      </div>
      {total > 0 ? (
        <div
          aria-label={PRESENCE_STATES.map(
            (state) => `${counts[state]} ${PRESENCE_STATUS[state].label.toLowerCase()}`
          ).join(', ')}
          className={styles.distribution}
          role="img"
        >
          {PRESENCE_STATES.map((state) => (
            <span className={styles[state]} key={state} style={{ flexGrow: counts[state] }} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

const FEED_ICON_CLASS = 'size-3.5';
const LIVE_COLOR = { color: 'var(--pc-coding)' };
const FAINT_COLOR = { color: 'var(--pc-faint)' };

const FEED_ICON: Record<PresenceActivityKind, React.ReactNode> = {
  joined: <LogInIcon aria-hidden className={FEED_ICON_CLASS} style={LIVE_COLOR} />,
  left: <LogOutIcon aria-hidden className={FEED_ICON_CLASS} style={FAINT_COLOR} />,
  session_ended: <HandshakeIcon aria-hidden className={FEED_ICON_CLASS} style={FAINT_COLOR} />,
  session_started: <HandshakeIcon aria-hidden className={FEED_ICON_CLASS} style={LIVE_COLOR} />,
};

/** Joins, leaves and co-working sessions since this page was opened. */
export function ActivityFeed({ events }: { events: PresenceActivityEvent[] }) {
  return (
    <section aria-labelledby="feed-heading" className={`${styles.panel} flex flex-col gap-3`}>
      <div>
        <p className={styles.eyebrow}>Room activity</p>
        <h2 className={styles.title} id="feed-heading">
          Since you opened this page
        </h2>
      </div>
      {events.length === 0 ? (
        <p className={`${styles.faint} text-sm`}>
          Joins, leaves and co-working sessions will appear here as they happen.
        </p>
      ) : (
        <ol aria-live="polite" className={styles.feed}>
          {events.map((event) => (
            <motion.li
              animate={{ opacity: 1, x: 0 }}
              className={styles.feedItem}
              initial={{ opacity: 0, x: -6 }}
              key={event.id}
            >
              <time className={styles.feedTime} dateTime={new Date(event.at * 1000).toISOString()}>
                {new Date(event.at * 1000).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
              {FEED_ICON[event.kind]}
              <span>{event.text}</span>
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  );
}

interface HistoryState {
  error: null | string;
  items: PresenceHistoryItem[];
  loading: boolean;
  previousSummary: null | PresenceWeeklySummary;
  reload: () => Promise<void>;
  weeklySummary: null | PresenceWeeklySummary;
}

function Delta({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return null;
  const change = percentChange(current, previous);
  if (change === null) {
    return current > 0 ? (
      <span className={`${styles.delta} ${styles.deltaUp}`}>New this week</span>
    ) : null;
  }
  if (Math.abs(change) < 0.5) {
    return <span className={`${styles.delta} ${styles.faint}`}>Same as last week</span>;
  }
  const up = change > 0;
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span
      className={`${styles.delta} ${up ? styles.deltaUp : styles.deltaDown} inline-flex items-center gap-0.5`}
    >
      <Icon aria-hidden className="size-3" />
      {up ? '+' : ''}
      {change.toFixed(0)}% vs last week
    </span>
  );
}

/** Your own co-working: today's sessions and the last 7 days against the 7 before. */
export function CoworkingHistoryPanel({ history }: { history: HistoryState }) {
  const week = history.weeklySummary;
  const previous = history.previousSummary ?? undefined;
  const tiles = week
    ? [
        {
          current: week.sessions,
          label: 'Sessions',
          previous: previous?.sessions,
          value: String(week.sessions),
        },
        {
          current: week.durationSeconds,
          label: 'Together',
          previous: previous?.durationSeconds,
          value: formatPresenceDuration(week.durationSeconds),
        },
        {
          current: week.activeDays,
          label: 'Active days',
          previous: previous?.activeDays,
          value: `${week.activeDays}/7`,
        },
      ]
    : [];

  return (
    <section aria-labelledby="history-heading" className={`${styles.panel} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={styles.eyebrow}>Your co-working</p>
          <h2 className={styles.title} id="history-heading">
            Last 7 days
          </h2>
        </div>
        <button
          aria-label="Refresh co-working history"
          className={`${styles.btn} ${styles.btnIcon}`}
          disabled={history.loading}
          onClick={() => void history.reload()}
          type="button"
        >
          <RefreshCwIcon
            aria-hidden
            className={`size-4 ${history.loading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>
      {week ? (
        <div className={styles.summary}>
          {tiles.map((tile) => (
            <div className={styles.metric} key={tile.label}>
              <span className={styles.metricLabel}>{tile.label}</span>
              <span className={styles.metricValue} style={{ fontSize: '1.35rem' }}>
                {tile.value}
              </span>
              <Delta current={tile.current} previous={tile.previous} />
            </div>
          ))}
        </div>
      ) : null}
      {!week && history.loading ? <div className={`${styles.skeleton} h-20`} /> : null}
      <div className="flex flex-col gap-2">
        <p className={styles.eyebrow}>Today</p>
        <HistoryList
          items={history.items}
          loading={history.loading && history.items.length === 0}
        />
      </div>
      {history.error ? (
        <p className={styles.errorText} role="alert">
          {history.error}{' '}
          <button className="underline" onClick={() => void history.reload()} type="button">
            Retry
          </button>
        </p>
      ) : null}
    </section>
  );
}

interface ActiveRoomViewProps {
  activeRoom: PresenceV2RoomData;
  activeSession?: PresenceV2Session;
  currentUserId: string;
  floorHeightScale?: number;
  inviteId: null | string;
  inviteUrl: null | string;
  onCopyInvite: () => Promise<void>;
  onEnd: () => Promise<void>;
  onLeave: () => Promise<void>;
  onMove: (position: { x: number; y: number }) => void;
  onReturnToSession: () => void;
  onRevokeInvite: () => Promise<void>;
  reducedMotion: boolean;
  snapshot: PresenceV2Snapshot;
  stateCounts: PresenceCounts;
  users: PresenceUser[];
  working: boolean;
}

export function ActiveRoomView({
  activeRoom,
  activeSession,
  currentUserId,
  floorHeightScale = 1,
  inviteId,
  inviteUrl,
  onCopyInvite,
  onEnd,
  onLeave,
  onMove,
  onReturnToSession,
  onRevokeInvite,
  reducedMotion,
  snapshot,
  stateCounts,
  users,
  working,
}: ActiveRoomViewProps) {
  const isOwner = activeRoom.kind === 'adhoc' && activeRoom.owner_user_id === currentUserId;
  const playgroundSessions = snapshot.sessions.map((session) => ({
    participantIds: session.participants.map((participant) => participant.user_id),
    zoneId: session.zone_id,
  }));
  const me = users.find((user) => user.isCurrentUser);
  const myPosition = me ? { x: me.x, y: me.y } : DEFAULT_SPAWN_POSITION;
  const podsOccupied = new Set(
    snapshot.roster.map((entry) => entry.zone_id).filter((zoneId) => zoneId !== null)
  ).size;

  // Session timers tick locally between snapshots, anchored to the server clock.
  const [now, setNow] = React.useState(snapshot.server_time);
  React.useEffect(() => {
    setNow(snapshot.server_time);
    const started = Date.now();
    const timer = window.setInterval(
      () => setNow(snapshot.server_time + Math.floor((Date.now() - started) / 1000)),
      15_000
    );
    return () => window.clearInterval(timer);
  }, [snapshot.server_time]);

  return (
    <div className="flex flex-col gap-4">
      <section className={styles.panel}>
        <div className={styles.roomHead}>
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden className={styles.roomIcon}>
              <UsersIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-bold tracking-tight">{activeRoom.name}</h2>
                <span className={styles.tag}>
                  {activeRoom.kind === 'team' ? 'Team room' : 'Quick room'}
                </span>
              </div>
              <p className={`${styles.faint} text-xs`}>{formatExpiry(activeRoom.expires_at)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner ? (
              <button
                className={`${styles.btn} ${styles.btnDanger}`}
                disabled={working}
                onClick={() => void onEnd()}
                type="button"
              >
                <PowerIcon aria-hidden className="size-4" /> End room
              </button>
            ) : null}
            <button
              className={styles.btn}
              disabled={working}
              onClick={() => void onLeave()}
              type="button"
            >
              <DoorOpenIcon aria-hidden className="size-4" /> Leave room
            </button>
          </div>
        </div>

        {inviteUrl ? (
          <div className={styles.invite}>
            <div className={styles.inviteField}>
              <LinkIcon
                aria-hidden
                className="size-4 shrink-0"
                style={{ color: 'var(--pc-faint)' }}
              />
              <input aria-label="Room invite link" readOnly value={inviteUrl} />
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => void onCopyInvite()}
              type="button"
            >
              <CopyIcon aria-hidden className="size-4" /> Copy invite
            </button>
            {inviteId ? (
              <button className={styles.btn} onClick={() => void onRevokeInvite()} type="button">
                Revoke
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <RoomPulse
        counts={stateCounts}
        pods={snapshot.zones.length}
        podsOccupied={podsOccupied}
        sessions={snapshot.sessions.length}
      />

      {activeSession ? (
        <SessionBar
          currentUserId={currentUserId}
          now={now}
          onReturn={onReturnToSession}
          session={activeSession}
        />
      ) : null}

      <div className={`${styles.floorFrame} hidden md:block`}>
        <p className={styles.floorHint}>
          <MousePointerClickIcon aria-hidden className="size-3.5" />
          Walk onto a pod to show you&apos;re available. A second teammate at the same pod starts a
          co-working session.
        </p>
        <div className={`wakaclock-presence-theme ${styles.pixel}`} style={{ borderRadius: 14 }}>
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
      </div>

      <section
        aria-label="Collaboration pods"
        className={`${styles.panel} flex flex-col gap-2 md:hidden`}
      >
        <p className={styles.eyebrow}>Pods</p>
        {snapshot.zones.map((zone) => {
          const occupied = snapshot.roster.filter((entry) => entry.zone_id === zone.id).length;
          const atZone = snapshot.roster.some(
            (entry) => entry.user_id === currentUserId && entry.zone_id === zone.id
          );
          // Leaving has to be computed from the room's real zones — a fixed point such
          // as the floor centre can itself sit inside a pod, which would re-seat you.
          const nextPosition = atZone
            ? standingSpotNear(snapshot.zones, myPosition)
            : seatAnchor(zone, freeSlotIndex(zone, occupied));
          return (
            <div className={styles.member} key={zone.id}>
              <div className={styles.memberBody}>
                <p className={styles.memberName}>{zone.label}</p>
                <p className={styles.memberMeta}>
                  {occupied} {occupied === 1 ? 'person' : 'people'} here
                </p>
              </div>
              <button
                className={`${styles.btn} ${atZone ? '' : styles.btnPrimary}`}
                onClick={() => onMove(nextPosition)}
                type="button"
              >
                {atZone ? 'Leave table' : 'Join table'}
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export function RoomList({
  emptyText,
  onOpen,
  rooms,
}: {
  emptyText: string;
  onOpen: (room: PresenceV2Room) => void;
  rooms: PresenceV2Room[];
}) {
  if (rooms.length === 0) {
    return (
      <div className={styles.empty}>
        <UsersIcon aria-hidden className="size-5" />
        {emptyText}
      </div>
    );
  }
  return (
    <div className={styles.roomGrid}>
      {rooms.map((room) => (
        <button
          className={styles.roomCard}
          key={room.id}
          onClick={() => onOpen(room)}
          type="button"
        >
          <span aria-hidden className={styles.roomIcon}>
            <UsersIcon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{room.name}</span>
              <span className={styles.tag}>{room.kind === 'team' ? 'Team' : 'Quick'}</span>
            </span>
            <span className={`${styles.faint} mt-0.5 block text-xs`}>
              {formatExpiry(room.expires_at)}
            </span>
          </span>
          <ArrowUpRightIcon
            aria-hidden
            className="size-4 shrink-0"
            style={{ color: 'var(--pc-faint)' }}
          />
        </button>
      ))}
    </div>
  );
}

/** How the three live states are derived — the answer to "what does Idle mean?". */
export function PresenceGuide() {
  return (
    <section aria-labelledby="guide-heading" className={`${styles.panel} flex flex-col gap-4`}>
      <div>
        <p className={styles.eyebrow}>How presence works</p>
        <h2 className={styles.title} id="guide-heading">
          Status comes from your editor
        </h2>
      </div>
      <div className={styles.legend}>
        {PRESENCE_STATES.map((state) => (
          <div className={styles.legendRow} key={state}>
            <span className={`${styles.status} ${styles[state]}`}>
              <span aria-hidden>{PRESENCE_STATUS[state].glyph}</span>
              {PRESENCE_STATUS[state].label}
            </span>
            <span className={styles.muted}>{PRESENCE_STATUS[state].description}</span>
          </div>
        ))}
      </div>
      <p className={`${styles.faint} flex gap-2 text-xs leading-relaxed`}>
        <InfoIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Only people inside a room see each other, and only as a live status — never projects or
        files. Presence is for coordinating, not for evaluating anyone.
      </p>
    </section>
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
    <div className="flex flex-col gap-4">
      {roomPreview ? (
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          aria-labelledby="preview-heading"
          className={styles.panel}
          initial={{ opacity: 0, y: 8 }}
          style={{ borderColor: 'rgb(124 140 255 / 0.45)' }}
        >
          <p className={styles.eyebrow}>Join preview</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight" id="preview-heading">
              {roomPreview.name}
            </h2>
            <span className={styles.tag}>
              {roomPreview.kind === 'team' ? 'Team room' : 'Quick room'}
            </span>
          </div>
          <p className={`mt-1 text-sm ${previewUnavailable ? styles.errorText : styles.muted}`}>
            {previewUnavailable ? 'This room or invite has expired.' : previewDetail(roomPreview)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={working || previewUnavailable}
              onClick={() => void onJoin()}
              type="button"
            >
              <LogInIcon aria-hidden className="size-4" />
              {working ? 'Joining…' : 'Join room'}
            </button>
            <button className={styles.btn} onClick={onCancelPreview} type="button">
              Cancel
            </button>
          </div>
        </motion.section>
      ) : null}

      <section aria-labelledby="rooms-heading" className={`${styles.panel} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={styles.eyebrow}>Your rooms</p>
            <h2 className={styles.title} id="rooms-heading">
              Choose a room to show up in
            </h2>
            <p className={`${styles.muted} mt-1 max-w-xl text-sm`}>
              Who is inside stays private until you join. Once you do, everyone in the room sees
              your status too.
            </p>
          </div>
          <button
            className={styles.btn}
            disabled={loading}
            onClick={() => void onRefresh()}
            type="button"
          >
            <RefreshCwIcon aria-hidden className={`size-4 ${loading ? 'animate-spin' : ''}`} />{' '}
            Refresh
          </button>
        </div>
        {loading ? (
          <div className={styles.roomGrid}>
            <div className={`${styles.skeleton} h-[70px]`} />
            <div className={`${styles.skeleton} h-[70px]`} />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <p className={styles.eyebrow}>Team rooms</p>
              <RoomList
                emptyText="No team rooms yet. Start a quick room below and share the invite."
                onOpen={onOpenRoom}
                rooms={teamRooms}
              />
            </div>
            {adhocRooms.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className={styles.eyebrow}>Recent quick rooms</p>
                <RoomList emptyText="" onOpen={onOpenRoom} rooms={adhocRooms} />
              </div>
            ) : null}
          </>
        )}
        {error ? (
          <p className={styles.errorText} role="alert">
            {error}{' '}
            <button className="underline" onClick={() => void onRefresh()} type="button">
              Retry
            </button>
          </p>
        ) : null}
      </section>

      <section aria-labelledby="create-heading" className={styles.panel}>
        <p className={styles.eyebrow}>Quick room</p>
        <h2 className={styles.title} id="create-heading">
          Start a temporary co-working room
        </h2>
        <form
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_160px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (roomName.trim().length > 0 && !working) void onCreate();
          }}
        >
          <label className="min-w-0">
            <span className="sr-only">Room name</span>
            <input
              className={styles.input}
              maxLength={80}
              onChange={(event) => onRoomNameChange(event.target.value)}
              placeholder="e.g. Friday pairing"
              value={roomName}
            />
          </label>
          <select
            aria-label="Room expiry"
            className={styles.input}
            onChange={(event) => onExpiryChange(event.target.value)}
            value={expiry}
          >
            <option value="3600">1 hour</option>
            <option value="86400">24 hours</option>
            <option value="604800">7 days</option>
          </select>
          <button
            className={`${styles.btn} ${styles.btnPrimary} min-h-[42px]`}
            disabled={roomName.trim().length === 0 || working}
            type="submit"
          >
            <PlusIcon aria-hidden className="size-4" />
            {working ? 'Creating…' : 'Create room'}
          </button>
        </form>
        <p className={`${styles.faint} mt-2 flex items-center gap-1.5 text-xs`}>
          <ActivityIcon aria-hidden className="size-3.5" />
          You get an invite link to share as soon as the room exists.
        </p>
      </section>
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
    <section className={styles.panel}>
      {loading ? (
        <div className="flex flex-col gap-3" role="status">
          <span className="sr-only">Checking Presence availability…</span>
          <div className={`${styles.skeleton} h-6 w-48`} />
          <div className={`${styles.skeleton} h-16`} />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className={styles.eyebrow}>Unavailable</p>
          <h2 className={styles.title}>Presence isn&apos;t enabled on this server</h2>
          <p className={`${styles.muted} text-sm`}>
            Ask an administrator to set PRESENCE_V2_ENABLED=true with PostgreSQL and Redis
            configured.
          </p>
        </div>
      )}
    </section>
  );
}
