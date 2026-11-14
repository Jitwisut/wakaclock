import { type ActivitySlice, MINUTES_PER_DAY, SLICE_MINUTES } from '../time-data';

import { STERN_X } from './hull';

/**
 * The chip log. Sailors measured a voyage by dropping a weighted board astern and counting
 * the knots that ran out — the origin of both "log" and "knots". In the Voyage Log every
 * heartbeat an editor sends drops one lit marker astern. Markers a slice apart touch and
 * read as one duration block; a long gap leaves dark water, which is exactly how the page
 * says time is counted. Earlier days keep floating further back: history is never trimmed.
 *
 * All positions here come from the seeded demo days; the page labels them as demo data.
 */

/** Metres of wake per minute of history. */
export const METRES_PER_MINUTE = 0.08;
/** The newest marker splashes down just astern. */
export const DROP_OFFSET = 1.6;

export interface LogMarker {
  /** Minutes since the marker was dropped (0 = this moment). */
  age: number;
  kind: ActivitySlice['kind'];
  /** Lantern that lit for it: one lantern per supported editor. */
  lantern: number;
  /** Ship-space position on the undisturbed water plane. */
  x: number;
  z: number;
}

/** Minutes between a slice and the clock hand, counting earlier days back from today. */
export function sliceAge(slice: ActivitySlice, hand: number) {
  return slice.day * MINUTES_PER_DAY + hand - slice.minute;
}

/** Which editor's lantern a demo heartbeat belongs to (deterministic, for the pulse). */
export function lanternFor(slice: ActivitySlice, lanterns: number) {
  if (lanterns <= 0) return -1;
  const session = Math.floor(slice.minute / 60) * 7 + slice.project * 13 + slice.day * 3;
  return session % lanterns;
}

/**
 * Every marker dropped by the time the clock reads `hand`, in ship space. Today's slices
 * the hand has not reached yet are not in the water.
 */
export function chipLogMarkers(
  slices: readonly ActivitySlice[],
  hand: number,
  lanterns: number
): LogMarker[] {
  const markers: LogMarker[] = [];
  for (const slice of slices) {
    const age = sliceAge(slice, hand);
    if (age < 0) continue;
    const behind = DROP_OFFSET + age * METRES_PER_MINUTE;
    markers.push({
      kind: slice.kind,
      x: STERN_X - behind,
      // The log line streams nearly straight astern, swaying gently in the wake.
      z: Math.sin(age * 0.021) * 0.7 + Math.sin(age * 0.0047) * 1.4,
      age,
      lantern: lanternFor(slice, lanterns),
    });
  }
  return markers;
}

/** The newest marker at the hand, if a heartbeat is due at this minute. */
export function latestDrop(slices: readonly ActivitySlice[], hand: number) {
  let latest: ActivitySlice | undefined;
  for (const slice of slices) {
    if (slice.day !== 0 || slice.minute > hand) continue;
    if (hand - slice.minute >= SLICE_MINUTES) continue;
    if (!latest || slice.minute > latest.minute) latest = slice;
  }
  return latest;
}
