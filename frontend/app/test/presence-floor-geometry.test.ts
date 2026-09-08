import { describe, expect, it } from 'vitest';

import {
  deskCountFor,
  deskSlotOffsets,
  freeSlotIndex,
  nearestSlotIndex,
  seatAnchor,
  standingSpotNear,
  zoneAt,
  zoneContains,
} from '@/lib/presence/floor-geometry';

/** The geometry `ensure_zones` in `repository/presence.rs` seeds every room with. */
const ZONES = [
  { center_x: 25, center_y: 30, height: 24, id: 'a', width: 22 },
  { center_x: 75, center_y: 30, height: 24, id: 'b', width: 22 },
  { center_x: 50, center_y: 72, height: 24, id: 'c', width: 22 },
];

describe('floor geometry', () => {
  it('reads a pod as two desks when it is wide enough for two', () => {
    expect(deskCountFor(22)).toBe(2);
    expect(deskCountFor(14)).toBe(1);
    expect(deskSlotOffsets(22)).toEqual([26, 68]);
    expect(deskSlotOffsets(14)).toEqual([50]);
  });

  it('hit-tests a pod rect', () => {
    expect(zoneContains(ZONES[0], { x: 25, y: 30 })).toBe(true);
    expect(zoneContains(ZONES[0], { x: 13.9, y: 30 })).toBe(false);
    expect(zoneAt(ZONES, { x: 50, y: 72 })?.id).toBe('c');
    expect(zoneAt(ZONES, { x: 50, y: 50 })).toBeUndefined();
  });

  it('seats a drop on a desk slot well inside the pod', () => {
    const seat = seatAnchor(ZONES[2], 1);
    expect(seat).toEqual({ x: 39 + 0.68 * 22, y: 72 - 24 * 0.08 });
    // The server rejects a position sent with a zone_id whose rect does not contain it.
    for (const slot of [0, 1])
      expect(zoneContains(ZONES[2], seatAnchor(ZONES[2], slot))).toBe(true);
  });

  it('clamps an out-of-range slot onto a real desk', () => {
    expect(seatAnchor(ZONES[0], 9)).toEqual(seatAnchor(ZONES[0], 1));
    expect(seatAnchor(ZONES[0], -3)).toEqual(seatAnchor(ZONES[0], 0));
  });

  it('picks the desk nearest the drop, and the first free desk for a blind join', () => {
    expect(nearestSlotIndex(ZONES[2], { x: 41, y: 72 })).toBe(0);
    expect(nearestSlotIndex(ZONES[2], { x: 59, y: 72 })).toBe(1);
    expect(freeSlotIndex(ZONES[2], 0)).toBe(0);
    expect(freeSlotIndex(ZONES[2], 1)).toBe(1);
    expect(freeSlotIndex(ZONES[2], 5)).toBe(1);
  });

  it('stands you up clear of every pod, not merely a hair outside one', () => {
    // Every seat in the room, so a bad bearing sweep cannot pass by landing one lucky
    // exit in open floor while another drops into the pod next door.
    for (const zone of ZONES) {
      for (const slot of [0, 1]) {
        const spot = standingSpotNear(ZONES, seatAnchor(zone, slot));
        expect(zoneAt(ZONES, spot)).toBeUndefined();
        for (const other of ZONES) {
          const clearX = Math.abs(spot.x - other.center_x) > other.width / 2 + 4;
          const clearY = Math.abs(spot.y - other.center_y) > other.height / 2 + 4;
          expect(clearX || clearY).toBe(true);
        }
      }
    }
  });

  it('leaves a position that is already clear of every pod alone', () => {
    expect(standingSpotNear(ZONES, { x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
  });

  it('still returns a clamped point when every pod overlaps the floor', () => {
    const everywhere = [{ center_x: 50, center_y: 50, height: 400, id: 'all', width: 400 }];
    expect(standingSpotNear(everywhere, { x: 120, y: -20 })).toEqual({ x: 94, y: 6 });
  });
});
