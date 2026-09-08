/**
 * Pod geometry for the presence floor. Everything here works in the same
 * playground-percentage units as `PresenceUser.x`/`y` (0-100 of the floor's own width
 * and height), never pixels — the floor is percent-positioned and its pixel size
 * changes with the zoom control, so a pixel-derived seat would drift.
 */

export interface FloorZone {
  center_x: number;
  center_y: number;
  height: number;
  id: string;
  width: number;
}

export interface FloorPoint {
  x: number;
  y: number;
}

/** Desk slots a pod is drawn with — a wide pod seats two, a narrow one seats one. */
export function deskCountFor(zoneWidth: number): number {
  return zoneWidth >= 22 ? 2 : 1;
}

/**
 * Horizontal desk positions inside a pod, as a percentage of the *pod's* width. These
 * are the same numbers `PodSlots` lays its furniture out with — seating and furniture
 * must agree, so both read them from here.
 */
export function deskSlotOffsets(zoneWidth: number): number[] {
  return deskCountFor(zoneWidth) >= 2 ? [26, 68] : [50];
}

/**
 * How far above a pod's vertical centre a seated character is anchored, as a fraction of
 * the pod's height. The current user's sprite is a fixed-size box anchored on its
 * *centre*, while the pod's furniture desks are anchored on their *bottom* edge at
 * `bottom: 18%`; this offset is what lines the two up, so sitting down puts you on the
 * same desk row as your teammates instead of a sprite-height lower. Well inside the
 * rect either way — the server rejects a position sent with a `zone_id` that does not
 * contain it (`zone.contains` in `handlers/presence_v2.rs`).
 */
const SEAT_LIFT_RATIO = 0.08;

export function zoneContains(zone: FloorZone, position: FloorPoint): boolean {
  return (
    position.x >= zone.center_x - zone.width / 2 &&
    position.x <= zone.center_x + zone.width / 2 &&
    position.y >= zone.center_y - zone.height / 2 &&
    position.y <= zone.center_y + zone.height / 2
  );
}

export function zoneAt<Zone extends FloorZone>(
  zones: Zone[],
  position: FloorPoint
): undefined | Zone {
  return zones.find((zone) => zoneContains(zone, position));
}

/**
 * The anchor a character seated in `slotIndex` of `zone` is drawn at. Dropping into a
 * pod snaps to one of these instead of keeping the raw pointer position — a raw drop
 * near a pod's edge leaves the sprite (a fixed 112px-wide box) hanging outside the
 * rect, which is what this replaces.
 */
export function seatAnchor(zone: FloorZone, slotIndex: number): FloorPoint {
  const offsets = deskSlotOffsets(zone.width);
  const offset = offsets[Math.min(Math.max(slotIndex, 0), offsets.length - 1)];
  return {
    x: zone.center_x - zone.width / 2 + (offset / 100) * zone.width,
    y: zone.center_y - zone.height * SEAT_LIFT_RATIO,
  };
}

/** Rings of candidate offsets, nearest first, used to walk out of a pod. */
const EXIT_RADII = [10, 14, 18, 24, 30, 38, 46, 56];
const EXIT_BEARINGS = 16;

/** Standing up puts the character clear of the pod border rather than a hair outside it:
 * the sprite is drawn around its anchor, so a spot that merely fails `zoneContains`
 * still leaves half of it overlapping the rect. */
const EXIT_CLEARANCE = 5;

/** Keeps a stand-up spot on the floor and away from its very edge. */
function clampToFloor(value: number): number {
  return Math.min(94, Math.max(6, value));
}

/**
 * The closest standing spot to `from` that is inside no pod at all — where "leave the
 * desk" and the keyboard's stand-up both put you. A fixed point such as the floor
 * centre cannot be used: whether it is inside a pod depends entirely on the room's zone
 * geometry, and landing inside one would re-seat you immediately.
 */
export function standingSpotNear(zones: FloorZone[], from: FloorPoint): FloorPoint {
  const free = (point: FloorPoint) =>
    !zones.some((zone) =>
      zoneContains(
        {
          ...zone,
          height: zone.height + EXIT_CLEARANCE * 2,
          width: zone.width + EXIT_CLEARANCE * 2,
        },
        point
      )
    );
  if (free(from)) return from;

  for (const radius of EXIT_RADII) {
    for (let step = 0; step < EXIT_BEARINGS; step += 1) {
      // Start pointing straight down and sweep outwards, so stepping away from a desk
      // reads as pushing the chair back rather than teleporting across the room.
      const angle = Math.PI / 2 + (step % 2 === 0 ? 1 : -1) * Math.ceil(step / 2) * (Math.PI / 8);
      const candidate = {
        x: clampToFloor(from.x + Math.cos(angle) * radius),
        y: clampToFloor(from.y + Math.sin(angle) * radius),
      };
      if (free(candidate)) return candidate;
    }
  }
  return { x: clampToFloor(from.x), y: clampToFloor(from.y) };
}

/** Which desk slot a point inside `zone` is sitting at — used to hide the furniture
 * desk the character is standing on top of. */
export function nearestSlotIndex(zone: FloorZone, position: FloorPoint): number {
  const offsets = deskSlotOffsets(zone.width);
  const left = zone.center_x - zone.width / 2;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [index, offset] of offsets.entries()) {
    const distance = Math.abs(left + (offset / 100) * zone.width - position.x);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

/** The slot a new arrival should take: the first one the pod's existing occupants have
 * not filled, or the last slot once the pod is full. */
export function freeSlotIndex(zone: FloorZone, occupantCount: number): number {
  return Math.min(occupantCount, deskSlotOffsets(zone.width).length - 1);
}
