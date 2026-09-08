'use client';

import * as React from 'react';

import { LogOutIcon } from 'lucide-react';

import {
  PixelDeskCluster,
  PixelFicus,
  PixelServerRack,
  PixelWaterCooler,
  PixelWhiteboard,
} from '@/components/presence/OfficeProps';
import {
  PixelBush,
  PixelFlower,
  PixelRock,
  PixelTree,
} from '@/components/presence/PresenceDecoration';
import { PresencePlayer } from '@/components/presence/PresencePlayer';
import { SeatedOccupant } from '@/components/presence/SeatedOccupant';
import {
  deskSlotOffsets,
  freeSlotIndex,
  nearestSlotIndex,
  seatAnchor,
  standingSpotNear,
  zoneAt,
  zoneContains,
} from '@/lib/presence/floor-geometry';
import type { PresenceUser } from '@/types/presence';

interface PresencePlaygroundProps {
  currentUserId: string;
  heightScale?: number;
  onMoveCurrentUser: (next: { x: number; y: number }) => void;
  onZoneChange?: (zoneId: null | string) => void;
  reducedMotion: boolean;
  sessions?: { participantIds: string[]; zoneId: string }[];
  users: PresenceUser[];
  zones?: PresenceZoneView[];
}

interface PresenceZoneView {
  center_x: number;
  center_y: number;
  height: number;
  id: string;
  label: string;
  width: number;
}

const border = 'var(--presence-border)';
const panel = 'var(--presence-panel)';
const muted = 'var(--presence-text-muted)';
const live = 'var(--presence-live)';
const headingFont = 'var(--font-presence-heading)';

/**
 * Pod plaque colours lifted from the reference prototype's department pods — a
 * zone keeps the same tint every time it renders by hashing its id.
 */
const POD_TINTS = [
  '#4392d1',
  '#4382d6',
  '#cc3b8d',
  '#3cb87e',
  '#e68c2e',
  '#df8b29',
  '#a935d9',
  '#43bf5f',
  '#4cd49c',
  '#d6b72a',
] as const;

function podTint(zoneId: string): string {
  let hash = 0;
  for (const char of zoneId) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return POD_TINTS[hash % POD_TINTS.length];
}

function tintFill(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/**
 * Ambient furniture — pointer-events-none so it never intercepts a drag. Fixed
 * percentages keep everything near the edges, clear of the centre where players
 * stand and where the pods sit.
 */
const DECORATIONS: { node: React.ReactNode; x: number; y: number }[] = [
  { node: <PixelWaterCooler />, x: 2, y: 4 },
  { node: <PixelFicus />, x: 9, y: 3 },
  { node: <PixelWhiteboard />, x: 78, y: 3 },
  { node: <PixelServerRack />, x: 93, y: 2 },
  { node: <PixelFicus />, x: 3, y: 82 },
  { node: <PixelBush />, x: 12, y: 88 },
  { node: <PixelFlower variant={0} />, x: 20, y: 92 },
  { node: <PixelRock />, x: 92, y: 84 },
  { node: <PixelFlower variant={1} />, x: 88, y: 92 },
  { node: <PixelTree />, x: 96, y: 46 },
];

/**
 * Desk slots inside a pod rect. A slot with an occupant shows that person seated
 * (see `SeatedOccupant`); an empty slot shows bare desk furniture; the slot the current
 * user has taken is left empty, because their own draggable sprite is drawn there. The
 * slot layer is pointer-events-none so it never blocks the current user dragging across
 * it.
 */
function PodSlots({
  offsets,
  reducedMotion,
  seated,
  selfSlot,
  tone,
}: {
  offsets: number[];
  reducedMotion: boolean;
  seated: PresenceUser[];
  selfSlot: null | number;
  tone: string;
}) {
  // Occupants fill the slots in order, stepping over the one the current user sits in.
  const slotOwners: (PresenceUser | undefined)[] = offsets.map(() => undefined);
  let cursor = 0;
  for (const occupant of seated) {
    while (cursor < offsets.length && cursor === selfSlot) cursor += 1;
    if (cursor >= offsets.length) break;
    slotOwners[cursor] = occupant;
    cursor += 1;
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {offsets.map((left, index) => {
        if (index === selfSlot) return null;
        const occupant = slotOwners[index];
        return (
          <div
            className="office-cast-shadow absolute -translate-x-1/2"
            key={left}
            style={{ bottom: '18%', left: `${left}%` }}
          >
            {occupant ? (
              <SeatedOccupant reducedMotion={reducedMotion} screenTone={tone} user={occupant} />
            ) : (
              <PixelDeskCluster screenTone={tone} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OfficeMinimap({ me, zones }: { me: PresenceUser | undefined; zones: PresenceZoneView[] }) {
  return (
    <div
      aria-hidden
      className="presence-pixel-shadow-sm absolute right-3 bottom-3 hidden border-2 p-1.5 sm:block"
      style={{ background: 'var(--presence-bg-soft)', borderColor: border }}
    >
      <div
        className="relative h-16 w-28 overflow-hidden border"
        style={{ background: 'var(--office-floor-b)', borderColor: border }}
      >
        {zones.map((zone) => (
          <span
            className="absolute"
            key={zone.id}
            style={{
              background: tintFill(podTint(zone.id), 0.9),
              height: `${zone.height}%`,
              left: `${zone.center_x - zone.width / 2}%`,
              top: `${zone.center_y - zone.height / 2}%`,
              width: `${zone.width}%`,
            }}
          />
        ))}
        {me ? (
          <span
            className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2"
            style={{
              background: 'var(--presence-danger)',
              left: `${me.x}%`,
              outline: `1px solid ${panel}`,
              top: `${me.y}%`,
            }}
          />
        ) : null}
      </div>
      <p
        className="mt-1 text-center text-[8px] font-bold tracking-widest"
        style={{ color: muted, fontFamily: headingFont }}
      >
        FLOOR RADAR
      </p>
    </div>
  );
}

/**
 * The drag-to-a-pod floor. Zones keep their real percent geometry (hit-tested by
 * `useRoomMovement`); this only dresses each rect as a 16-bit "department pod".
 * Every roster member renders exactly once as a positioned `PresencePlayer` —
 * the desks inside a pod are furniture, not people.
 */
export function PresencePlayground({
  currentUserId,
  heightScale = 1,
  onMoveCurrentUser,
  onZoneChange,
  reducedMotion,
  sessions = [],
  users,
  zones = [],
}: PresencePlaygroundProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const me = users.find((user) => user.id === currentUserId);
  const myDeskZone = me ? zoneAt(zones, me) : undefined;

  const nearbyIds = React.useMemo(() => {
    if (!me) return new Set<string>();
    const activeSession = sessions.find((session) => session.participantIds.includes(me.id));
    if (activeSession) return new Set(activeSession.participantIds.filter((id) => id !== me.id));
    return new Set<string>();
  }, [me, sessions]);

  // Everyone standing in a pod (except you — you stay the draggable sprite) is drawn
  // seated at that pod's desks, up to its slot count. They are then not also drawn as
  // a free sprite, so each roster member renders exactly once.
  const seatedByZone = React.useMemo(() => {
    const map = new Map<string, PresenceUser[]>();
    for (const zone of zones) {
      const zoneOccupants = users.filter((user) => user.zoneId === zone.id && !user.isCurrentUser);
      map.set(zone.id, zoneOccupants);
    }
    return map;
  }, [users, zones]);

  const seatedIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const [zoneId, list] of seatedByZone) {
      const zone = zones.find((candidate) => candidate.id === zoneId);
      if (!zone) continue;
      const capacity = deskSlotOffsets(zone.width).length - (myDeskZone?.id === zoneId ? 1 : 0);
      for (const user of list.slice(0, Math.max(0, capacity))) ids.add(user.id);
    }
    return ids;
  }, [myDeskZone, seatedByZone, zones]);

  const handleMove = React.useCallback(
    (next: { x: number; y: number }) => {
      onMoveCurrentUser(next);
      onZoneChange?.(zoneAt(zones, next)?.id ?? null);
    },
    [onMoveCurrentUser, onZoneChange, zones]
  );

  /**
   * A pointer drop inside a pod lands on the desk slot nearest the drop rather than on
   * the raw pointer position. Without this a drop near a pod's edge parks the
   * fixed-size sprite half outside the rect, and two people in one pod overlap.
   */
  const resolveDrop = React.useCallback(
    (position: { x: number; y: number }) => {
      const zone = zoneAt(zones, position);
      return zone ? seatAnchor(zone, nearestSlotIndex(zone, position)) : position;
    },
    [zones]
  );

  const handleLeaveDesk = React.useCallback(() => {
    if (!me) return;
    handleMove(standingSpotNear(zones, me));
  }, [handleMove, me, zones]);

  const handleEnterZone = React.useCallback(() => {
    if (!me) return;
    if (zoneAt(zones, me)) {
      handleLeaveDesk();
      return;
    }
    const nearest = zones.reduce<null | PresenceZoneView>((candidate, zone) => {
      if (!candidate) return zone;
      const candidateDistance = (candidate.center_x - me.x) ** 2 + (candidate.center_y - me.y) ** 2;
      const zoneDistance = (zone.center_x - me.x) ** 2 + (zone.center_y - me.y) ** 2;
      return zoneDistance < candidateDistance ? zone : candidate;
    }, null);
    if (nearest) {
      const occupants = seatedByZone.get(nearest.id) ?? [];
      handleMove(seatAnchor(nearest, freeSlotIndex(nearest, occupants.length)));
    }
  }, [handleLeaveDesk, handleMove, me, seatedByZone, zones]);

  // Render order is sorted by id and never filtered, so an SSE snapshot that hands the
  // roster back in a different order cannot make React reorder these nodes. Moving the
  // current user's button mid-drag used to cancel the gesture outright (see the note in
  // `PresencePlayer`), which is why seated members struggled to drag themselves out.
  const orderedUsers = React.useMemo(
    () => [...users].sort((left, right) => left.id.localeCompare(right.id)),
    [users]
  );

  const minHeight = Math.round(460 * Math.max(0.6, Math.min(1.4, heightScale)));

  return (
    <div
      aria-label="Office floor — drag your character onto a pod to join it"
      className="office-floor relative w-full overflow-hidden border-[3px]"
      ref={containerRef}
      style={{ borderColor: border, minHeight: `${minHeight}px` }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {DECORATIONS.map((decoration) => (
          <div
            className="absolute"
            key={`${decoration.x}-${decoration.y}`}
            style={{ left: `${decoration.x}%`, top: `${decoration.y}%` }}
          >
            {decoration.node}
          </div>
        ))}
      </div>

      {zones.map((zone) => {
        const session = sessions.find((candidate) => candidate.zoneId === zone.id);
        const occupants = users.filter((user) => user.zoneId === zone.id).length;
        const tint = podTint(zone.id);
        const seated = seatedByZone.get(zone.id) ?? [];
        const selfSlot = me && myDeskZone?.id === zone.id ? nearestSlotIndex(zone, me) : null;
        return (
          <div
            aria-label={`${zone.label} pod, ${occupants} ${occupants === 1 ? 'person' : 'people'}`}
            className="pointer-events-none absolute border-2"
            key={zone.id}
            style={{
              background: tintFill(tint, session ? 0.26 : 0.18),
              borderColor: session ? live : border,
              boxShadow: '4px 4px 0 rgba(21, 20, 66, 0.35)',
              height: `${zone.height}%`,
              left: `${zone.center_x - zone.width / 2}%`,
              top: `${zone.center_y - zone.height / 2}%`,
              width: `${zone.width}%`,
            }}
          >
            {session && !reducedMotion ? (
              <span
                className="office-proximity-ring absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                style={{ borderColor: live }}
              />
            ) : null}
            <div
              className="absolute -top-3 left-2 flex items-center gap-1.5 border px-1.5 py-0.5 text-[9px] font-bold text-white"
              style={{ background: tint, borderColor: border, fontFamily: headingFont }}
            >
              <span className="tracking-wide">{zone.label}</span>
              <span className="px-1 text-[8px]" style={{ background: 'rgba(21, 20, 66, 0.35)' }}>
                {session ? `${session.participantIds.length} together` : `${occupants} here`}
              </span>
            </div>
            <PodSlots
              offsets={deskSlotOffsets(zone.width)}
              reducedMotion={reducedMotion}
              seated={seated}
              selfSlot={selfSlot}
              tone={tint}
            />
          </div>
        );
      })}

      {orderedUsers.map((user) =>
        seatedIds.has(user.id) ? null : (
          <PresencePlayer
            atDesk={user.isCurrentUser ? Boolean(myDeskZone) : undefined}
            containerRef={containerRef}
            isDeskPosition={(position) => zones.some((zone) => zoneContains(zone, position))}
            isNearby={nearbyIds.has(user.id)}
            key={user.id}
            onEnterZone={user.isCurrentUser ? handleEnterZone : undefined}
            onMove={user.isCurrentUser ? handleMove : undefined}
            reducedMotion={reducedMotion}
            resolveDrop={user.isCurrentUser ? resolveDrop : undefined}
            user={user}
          />
        )
      )}

      {myDeskZone ? (
        <button
          className="presence-pixel-shadow-sm presence-pixel-press absolute top-3 right-3 z-40 flex items-center gap-1.5 border-2 px-2.5 py-1.5 text-[10px] font-bold"
          onClick={handleLeaveDesk}
          style={{ background: panel, borderColor: border, fontFamily: headingFont }}
          type="button"
        >
          <LogOutIcon aria-hidden className="size-3.5" />
          Leave desk
        </button>
      ) : null}

      <div
        className="presence-pixel-shadow-sm absolute bottom-3 left-3 hidden max-w-[15rem] border-2 px-2.5 py-1.5 text-[9px] font-bold sm:block"
        style={{ background: panel, borderColor: border, color: muted, fontFamily: headingFont }}
      >
        Drag your sprite onto a pod · or focus it and use the arrow keys · Enter sits down at the
        nearest pod and stands you back up
      </div>

      <OfficeMinimap me={me} zones={zones} />
    </div>
  );
}
