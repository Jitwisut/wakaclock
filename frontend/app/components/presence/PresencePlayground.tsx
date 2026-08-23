'use client';

import * as React from 'react';

import { PixelBush, PixelFlower, PixelRock, PixelTree } from '@/components/presence/PresenceDecoration';
import { PresencePlayer } from '@/components/presence/PresencePlayer';
import { findNearbyUsers } from '@/lib/presence/proximity';
import type { PresenceUser } from '@/types/presence';

/**
 * Corner clusters plus a light scatter of small decorations — enough for the field to
 * read as a place, not a bare green rectangle, without crowding the centre where
 * players actually stand. Positions are fixed percentages chosen to sit near the edges;
 * nothing is placed in the middle third of either axis.
 */
const DECORATIONS: { node: React.ReactNode; x: number; y: number }[] = [
  { node: <PixelTree />, x: 4, y: 6 },
  { node: <PixelBush />, x: 11, y: 14 },
  { node: <PixelRock />, x: 5, y: 22 },
  { node: <PixelTree />, x: 90, y: 5 },
  { node: <PixelBush />, x: 83, y: 12 },
  { node: <PixelFlower variant={0} />, x: 92, y: 18 },
  { node: <PixelTree />, x: 6, y: 82 },
  { node: <PixelTree />, x: 13, y: 88 },
  { node: <PixelBush />, x: 4, y: 70 },
  { node: <PixelRock />, x: 15, y: 74 },
  { node: <PixelFlower variant={1} />, x: 88, y: 84 },
  { node: <PixelFlower variant={2} />, x: 93, y: 90 },
  { node: <PixelBush />, x: 85, y: 78 },
  { node: <PixelFlower variant={0} />, x: 25, y: 8 },
  { node: <PixelFlower variant={1} />, x: 70, y: 92 },
  { node: <PixelRock />, x: 92, y: 55 },
];

interface PresencePlaygroundProps {
  currentUserId: string;
  onMoveCurrentUser: (next: { x: number; y: number }) => void;
  onNearbyChange?: (nearbyIds: string[]) => void;
  reducedMotion: boolean;
  users: PresenceUser[];
}

/**
 * The pixel-art field itself: grass texture + scenery + every roster member rendered as
 * a `PresencePlayer`. Proximity is re-evaluated whenever the roster changes (i.e. on
 * every SSE tick, since positions are server-synced — see `page.tsx`) using
 * `lib/presence/proximity.ts`; `onNearbyChange` is how the parent turns "who's close to
 * me right now" into an actual co-working session call, kept out of this component so
 * it stays presentational.
 */
export function PresencePlayground({
  currentUserId,
  onMoveCurrentUser,
  onNearbyChange,
  reducedMotion,
  users,
}: PresencePlaygroundProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const me = users.find((u) => u.id === currentUserId);

  React.useEffect(() => {
    if (!me || !onNearbyChange) return;
    const nearby = findNearbyUsers(me, users);
    onNearbyChange(nearby.map((u) => u.id));
    // `users` changes identity every SSE tick even when unrelated fields differ, which
    // is exactly when proximity needs re-checking — including the whole array is
    // intentional, not a missed-dependency oversight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.x, me?.y, users]);

  const nearbyIds = React.useMemo(() => {
    if (!me) return new Set<string>();
    return new Set(findNearbyUsers(me, users).map((u) => u.id));
  }, [me, users]);

  return (
    <div
      aria-label="Presence field — drag your character to move"
      className="presence-field relative min-h-[350px] w-full overflow-hidden border-[3px] sm:min-h-[420px] lg:min-h-[480px]"
      ref={containerRef}
      style={{ borderColor: 'var(--presence-border)' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {DECORATIONS.map((d, i) => (
          // Static decoration list, index is a stable and correct key — nothing here is
          // inserted, removed, or reordered at runtime.
          // eslint-disable-next-line react/no-array-index-key
          <div className="absolute" key={i} style={{ left: `${d.x}%`, top: `${d.y}%` }}>
            {d.node}
          </div>
        ))}
      </div>

      {users.map((user) => (
        <PresencePlayer
          containerRef={containerRef}
          isNearby={nearbyIds.has(user.id)}
          key={`${user.id}-${user.x.toFixed(1)}-${user.y.toFixed(1)}`}
          onMove={user.isCurrentUser ? onMoveCurrentUser : undefined}
          reducedMotion={reducedMotion}
          user={user}
        />
      ))}
    </div>
  );
}
