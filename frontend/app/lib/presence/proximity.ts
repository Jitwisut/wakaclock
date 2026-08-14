import type { PresenceUser } from '@/types/presence';

/**
 * How close two players' positions (in playground-percentage units, see
 * `PresenceUser.x`/`y`) need to be before they count as "nearby" and a co-working
 * session should start. Percentage-space, not pixels, so this threshold means the same
 * physical closeness regardless of viewport size — roughly "characters visually
 * touching" on a typical playground width.
 */
export const PROXIMITY_THRESHOLD_PERCENT = 9;

export function calculateDistance(a: Pick<PresenceUser, 'x' | 'y'>, b: Pick<PresenceUser, 'x' | 'y'>): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isNearby(a: Pick<PresenceUser, 'x' | 'y'>, b: Pick<PresenceUser, 'x' | 'y'>): boolean {
  return calculateDistance(a, b) < PROXIMITY_THRESHOLD_PERCENT;
}

/** Every other user currently within range of `user` — the basis for both the visual
 * "nearby" state and for deciding who to report a co-working session with. */
export function findNearbyUsers(user: PresenceUser, others: PresenceUser[]): PresenceUser[] {
  return others.filter((other) => other.id !== user.id && isNearby(user, other));
}
