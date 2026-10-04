import type { PresenceUser } from '@/types/presence';

export function calculateDistance(
  a: Pick<PresenceUser, 'x' | 'y'>,
  b: Pick<PresenceUser, 'x' | 'y'>
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Audible falloff inside an authorized pod; access isolation is enforced by the media server. */
export function podAudioVolume(
  a: Pick<PresenceUser, 'x' | 'y'>,
  b: Pick<PresenceUser, 'x' | 'y'>
): number {
  const distance = calculateDistance(a, b);
  return Number.isFinite(distance) ? Math.max(0.2, 1 - distance / 35) : 0;
}
