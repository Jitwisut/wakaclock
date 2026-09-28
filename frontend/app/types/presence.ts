import type {
  PresenceRosterEntry,
  PresenceState,
  PresenceStatusMessage,
} from '@/lib/wakaclock/types';

import type { SpriteAppearance } from './sprite';

/**
 * UI-layer presence types. Deliberately a thin, presentation-shaped layer over the real
 * API types (`PresenceRosterEntry` etc. in `lib/wakaclock/types.ts`) rather than a
 * throwaway mock shape — this page is wired to the real backend built for Phase 7
 * (rooms, SSE roster, server-synced positions, co-working sessions), not static data,
 * so these types describe what the UI actually renders while `toPresenceUser` below is
 * the one place that adapts a real API response into it.
 *
 * `x`/`y` are percentages (0-100) of the playground's own width/height, not pixels —
 * that's what makes a dragged position mean the same thing at any viewport size. The
 * server itself is unit-agnostic (`update_position` just persists two numbers), so nothing
 * backend-side needs to change for this to be true.
 */
export interface PresenceUser {
  appearance?: SpriteAppearance;
  avatar?: string;
  /** Unix seconds until which the member asked not to be disturbed, if they did. */
  focusUntil?: number;
  id: string;
  isCurrentUser: boolean;
  /** Real backend states are `coding | idle | offline` — kept as-is rather than
   * collapsing to just `coding | idle`, since dropping "offline" would throw away a
   * signal the server already computes from heartbeat recency. */
  status: PresenceState;
  /** A message the member chose to share, if any — see `PresenceStatusMessage`. */
  statusMessage?: PresenceStatusMessage;
  username: string;
  x: number;
  y: number;
  zoneId?: null | string;
}

export interface PresenceRoom {
  id: string;
  isLive: boolean;
  memberCount: number;
  name: string;
}

export interface CurrentUser {
  id: string;
  username: string;
}

/** Where a freshly-joined member with no synced position yet should appear — the
 * playground's rough centre, so a first-time joiner isn't stacked in a corner. */
export const DEFAULT_SPAWN_POSITION = { x: 46, y: 46 } as const;

/** Converts a real `PresenceRosterEntry` (from the SSE snapshot) into the shape this
 * page's components render. The only real transformation is defaulting position for
 * members who haven't been dragged yet — everything else is a direct field mapping. */
export function toPresenceUser(entry: PresenceRosterEntry, currentUserId: string): PresenceUser {
  return {
    id: entry.user_id,
    username: entry.username,
    status: entry.state,
    statusMessage: entry.status,
    focusUntil: entry.focus_until,
    isCurrentUser: entry.user_id === currentUserId,
    x: entry.position?.x ?? DEFAULT_SPAWN_POSITION.x,
    y: entry.position?.y ?? DEFAULT_SPAWN_POSITION.y,
    zoneId: entry.zone_id,
  };
}
