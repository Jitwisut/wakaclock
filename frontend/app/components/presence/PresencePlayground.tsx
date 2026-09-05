'use client';

import * as React from 'react';

import { PixelBush, PixelFlower, PixelRock, PixelTree } from '@/components/presence/PresenceDecoration';
import { PresencePlayer } from '@/components/presence/PresencePlayer';
import type { PresenceUser } from '@/types/presence';

interface PresenceZoneView {
  center_x: number;
  center_y: number;
  height: number;
  id: string;
  label: string;
  width: number;
}

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
  onZoneChange?: (zoneId: null | string) => void;
  reducedMotion: boolean;
  sessions?: { participantIds: string[]; zoneId: string }[];
  users: PresenceUser[];
  zones?: PresenceZoneView[];
}

/**
 * The pixel-art field itself: grass texture + scenery + every roster member rendered as
 * a `PresencePlayer`. Shared-session highlighting is derived from the server snapshot;
 * merely being nearby never starts or implies a session. The parent owns the
 * `PUT /presence/rooms/:room_id/me` persistence call; this component stays presentational
 * and only reports the authenticated avatar's next position.
 */
export function PresencePlayground({
  currentUserId,
  onMoveCurrentUser,
  onZoneChange,
  reducedMotion,
  sessions = [],
  users,
  zones = [],
}: PresencePlaygroundProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const me = users.find((u) => u.id === currentUserId);

  const nearbyIds = React.useMemo(() => {
    if (!me) return new Set<string>();
    const activeSession = sessions.find((session) => session.participantIds.includes(me.id));
    if (activeSession) return new Set(activeSession.participantIds.filter((id) => id !== me.id));
    return new Set<string>();
  }, [me, sessions]);

  const handleMove = React.useCallback(
    (next: { x: number; y: number }) => {
      onMoveCurrentUser(next);
      if (onZoneChange) {
        const zone = zones.find(
          (candidate) =>
            next.x >= candidate.center_x - candidate.width / 2 &&
            next.x <= candidate.center_x + candidate.width / 2 &&
            next.y >= candidate.center_y - candidate.height / 2 &&
            next.y <= candidate.center_y + candidate.height / 2
        );
        onZoneChange(zone?.id ?? null);
      }
    },
    [onMoveCurrentUser, onZoneChange, zones]
  );

  const handleEnterZone = React.useCallback(() => {
    if (!me) return;
    const currentZone = zones.find(
      (zone) =>
        me.x >= zone.center_x - zone.width / 2 &&
        me.x <= zone.center_x + zone.width / 2 &&
        me.y >= zone.center_y - zone.height / 2 &&
        me.y <= zone.center_y + zone.height / 2
    );
    if (currentZone) {
      handleMove({ x: 50, y: 50 });
      return;
    }
    const nearest = zones.reduce<null | PresenceZoneView>((candidate, zone) => {
      if (!candidate) return zone;
      const candidateDistance = (candidate.center_x - me.x) ** 2 + (candidate.center_y - me.y) ** 2;
      const zoneDistance = (zone.center_x - me.x) ** 2 + (zone.center_y - me.y) ** 2;
      return zoneDistance < candidateDistance ? zone : candidate;
    }, null);
    if (nearest) handleMove({ x: nearest.center_x, y: nearest.center_y });
  }, [handleMove, me, zones]);

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

      {zones.map((zone) => {
        const session = sessions.find((candidate) => candidate.zoneId === zone.id);
        const occupantCount = users.filter((user) => user.zoneId === zone.id).length;
        let availability = 'Available';
        if (session) availability = `${session.participantIds.length} together`;
        else if (occupantCount > 0) availability = 'Waiting';
        return (
          <div
            aria-label={`${zone.label}, ${occupantCount} occupant${occupantCount === 1 ? '' : 's'}`}
            className="presence-zone pointer-events-none absolute border-2 border-dashed px-2 py-1 text-[9px] font-bold"
            key={zone.id}
            style={{
              left: `${zone.center_x - zone.width / 2}%`,
              top: `${zone.center_y - zone.height / 2}%`,
              width: `${zone.width}%`,
              height: `${zone.height}%`,
              borderColor: session ? 'var(--presence-live)' : 'var(--presence-border)',
              background: session ? 'rgba(45, 213, 118, 0.12)' : 'rgba(255, 249, 233, 0.12)',
            }}
          >
            <span style={{ color: session ? 'var(--presence-live)' : 'var(--presence-text-muted)' }}>
              {zone.label} · {availability}
            </span>
          </div>
        );
      })}

      {users.map((user) => (
        <PresencePlayer
          containerRef={containerRef}
          isNearby={nearbyIds.has(user.id)}
          key={user.id}
          onEnterZone={user.isCurrentUser ? handleEnterZone : undefined}
          onMove={user.isCurrentUser ? handleMove : undefined}
          reducedMotion={reducedMotion}
          user={user}
        />
      ))}
    </div>
  );
}
