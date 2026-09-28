import type { PresenceState, PresenceV2Snapshot } from '@/lib/wakaclock/types';

/**
 * One vocabulary for the three live states the server derives (`derive_state_at` in
 * `backend/api/src/infrastructure/redis_presence.rs`). The windows below mirror its
 * `CODING_WINDOW_SECONDS` (120) and `IDLE_WINDOW_SECONDS` (300). "offline" is labelled
 * "Inactive" because a roster member is, by definition, still in the room — the state
 * only says their editor has gone quiet, not that they left.
 */
export const PRESENCE_STATUS: Record<
  PresenceState,
  { description: string; glyph: string; label: string; order: number }
> = {
  coding: {
    description: 'Editor activity in the last 2 minutes',
    glyph: '⚡',
    label: 'Coding',
    order: 0,
  },
  idle: {
    description: 'Last editor activity 2–5 minutes ago',
    glyph: '☕',
    label: 'Idle',
    order: 1,
  },
  offline: {
    description: 'In the room, but no editor activity for over 5 minutes',
    glyph: '☾',
    label: 'Inactive',
    order: 2,
  },
};

export const PRESENCE_STATES = ['coding', 'idle', 'offline'] as const satisfies PresenceState[];

export type PresenceCounts = Record<PresenceState, number>;

export function countStates(states: readonly PresenceState[]): PresenceCounts {
  const counts: PresenceCounts = { coding: 0, idle: 0, offline: 0 };
  for (const state of states) counts[state] += 1;
  return counts;
}

/** A one-line read of the room, built only from roster states. */
export function presenceHeadline(counts: PresenceCounts): string {
  const total = counts.coding + counts.idle + counts.offline;
  if (total === 0) return 'Nobody is in this room right now.';
  if (total === 1) {
    return counts.coding === 1
      ? 'You have the room to yourself and you are coding.'
      : 'You have the room to yourself.';
  }
  if (counts.coding === 0) return `${total} people here · nobody is coding right now.`;
  return `${counts.coding} of ${total} people here ${counts.coding === 1 ? 'is' : 'are'} coding right now.`;
}

export type PresenceActivityKind = 'joined' | 'left' | 'session_ended' | 'session_started';

export interface PresenceActivityEvent {
  at: number;
  id: string;
  kind: PresenceActivityKind;
  text: string;
}

type SnapshotLike = Pick<PresenceV2Snapshot, 'roster' | 'server_time' | 'sessions' | 'zones'>;

/**
 * Social events between two consecutive room snapshots: who joined or left the room,
 * and which co-working sessions started or ended. Deliberately NOT coding/idle
 * transitions — those are a per-person activity trace, and presence is not a monitoring
 * tool. Everything here is already visible on the floor; this only gives it a memory
 * for as long as the page is open.
 */
export function diffSnapshots(
  previous: null | SnapshotLike,
  next: SnapshotLike
): PresenceActivityEvent[] {
  if (!previous) return [];
  const at = next.server_time;
  const events: PresenceActivityEvent[] = [];
  const before = new Map(previous.roster.map((entry) => [entry.user_id, entry.username]));
  const after = new Map(next.roster.map((entry) => [entry.user_id, entry.username]));
  const zoneLabel = (zoneId: string) =>
    next.zones.find((zone) => zone.id === zoneId)?.label ??
    previous.zones.find((zone) => zone.id === zoneId)?.label ??
    'a pod';

  for (const [userId, username] of after) {
    if (!before.has(userId)) {
      events.push({
        at,
        id: `joined-${userId}-${at}`,
        kind: 'joined',
        text: `${username} joined the room`,
      });
    }
  }
  for (const [userId, username] of before) {
    if (!after.has(userId)) {
      events.push({
        at,
        id: `left-${userId}-${at}`,
        kind: 'left',
        text: `${username} left the room`,
      });
    }
  }

  const beforeSessions = new Map(previous.sessions.map((session) => [session.session_id, session]));
  const afterSessions = new Map(next.sessions.map((session) => [session.session_id, session]));
  for (const [id, session] of afterSessions) {
    if (!beforeSessions.has(id)) {
      const names = session.participants.map((participant) => participant.username).join(', ');
      events.push({
        at,
        id: `started-${id}`,
        kind: 'session_started',
        text: `Co-working started at ${zoneLabel(session.zone_id)} · ${names}`,
      });
    }
  }
  for (const [id, session] of beforeSessions) {
    if (!afterSessions.has(id)) {
      events.push({
        at,
        id: `ended-${id}`,
        kind: 'session_ended',
        text: `Co-working ended at ${zoneLabel(session.zone_id)}`,
      });
    }
  }
  return events;
}

/** Percentage change for a previous-period comparison, or null when it is meaningless. */
export function percentChange(current: number, previous: number): null | number {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function formatPresenceDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}
