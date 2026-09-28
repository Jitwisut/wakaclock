'use client';

import * as React from 'react';

import { diffSnapshots, type PresenceActivityEvent } from '@/lib/presence/presence-status';
import type { PresenceV2Snapshot } from '@/lib/wakaclock/types';

const MAX_EVENTS = 30;

/**
 * Room activity since this page was opened, derived from consecutive SSE snapshots.
 * There is no server-side presence event log, so this is intentionally session-local:
 * it resets when you switch rooms or reload.
 */
export function usePresenceActivity(snapshot: null | PresenceV2Snapshot): PresenceActivityEvent[] {
  const [events, setEvents] = React.useState<PresenceActivityEvent[]>([]);
  const previous = React.useRef<null | PresenceV2Snapshot>(null);
  const roomId = snapshot?.room.id ?? null;

  React.useEffect(() => {
    previous.current = null;
    setEvents([]);
  }, [roomId]);

  React.useEffect(() => {
    if (!snapshot) return;
    const last = previous.current;
    previous.current = snapshot;
    if (!last || snapshot.version <= last.version) return;
    const next = diffSnapshots(last, snapshot);
    if (next.length > 0) setEvents((current) => [...next, ...current].slice(0, MAX_EVENTS));
  }, [snapshot]);

  return events;
}
