/**
 * Illustrative demo activity for the time ring. Deterministic (seeded), so the server-rendered
 * still drawing and the WebGL scene show the same day, and every reload looks the same. These
 * are not customer data and carry no counting semantics — the page always labels them as
 * demo data.
 */

export type SliceKind = 'ai' | 'human' | 'unattributed';

export interface ActivitySlice {
  /** 0 = today, 1 = yesterday, … */
  day: number;
  kind: SliceKind;
  /** Minute of the day the slice starts at, 0–1439. */
  minute: number;
  project: number;
}

export const MINUTES_PER_DAY = 1440;
export const SLICE_MINUTES = 5;
export const PROJECT_COUNT = 4;

/** mulberry32: tiny, fast, seedable. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 1_831_565_813) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pickKind(roll: number): SliceKind {
  if (roll < 0.62) return 'human';
  if (roll < 0.86) return 'ai';
  return 'unattributed';
}

/**
 * Coding sessions for `days` days, cut into 5-minute slices. Sessions start no earlier than
 * 08:00, never overlap, and end before midnight.
 */
export function generateDemoDays(days: number, seed = 20_261_007): ActivitySlice[] {
  const random = seededRandom(seed);
  const slices: ActivitySlice[] = [];
  for (let day = 0; day < days; day += 1) {
    let cursor = 8 * 60 + Math.floor(random() * 90);
    const sessions = 4 + Math.floor(random() * 4);
    for (let session = 0; session < sessions; session += 1) {
      const length = (8 + Math.floor(random() * 28)) * SLICE_MINUTES;
      const end = Math.min(cursor + length, MINUTES_PER_DAY - SLICE_MINUTES);
      const project = Math.floor(random() * PROJECT_COUNT);
      let kind = pickKind(random());
      for (let minute = cursor; minute < end; minute += SLICE_MINUTES) {
        // Kinds change inside a session, the way an agent hands work back and forth.
        if (random() < 0.08) kind = pickKind(random());
        slices.push({ day, minute, kind, project });
      }
      cursor = end + (15 + Math.floor(random() * 60));
      if (cursor >= MINUTES_PER_DAY - 60) break;
    }
  }
  return slices;
}

/** Angle on the dial: midnight at 12 o'clock, running clockwise, in radians. */
export function angleForMinute(minute: number): number {
  return Math.PI / 2 - (minute / MINUTES_PER_DAY) * Math.PI * 2;
}

/** Point on a ring of `radius` lying in the XY plane at depth `z`. */
export function pointOnRing(minute: number, radius: number, z = 0): [number, number, number] {
  const angle = angleForMinute(minute);
  return [Math.cos(angle) * radius, Math.sin(angle) * radius, z];
}

/** Share of today's slices per kind, for the legend beside the scene. */
export function kindShares(slices: readonly ActivitySlice[], day = 0): Record<SliceKind, number> {
  const counts: Record<SliceKind, number> = { ai: 0, human: 0, unattributed: 0 };
  let total = 0;
  for (const slice of slices) {
    if (slice.day !== day) continue;
    counts[slice.kind] += 1;
    total += 1;
  }
  if (total === 0) return counts;
  return {
    ai: counts.ai / total,
    human: counts.human / total,
    unattributed: counts.unattributed / total,
  };
}

/** SVG arc path along a circle centred at (cx, cy), from minute `start` to `end`. */
export function arcPath(cx: number, cy: number, radius: number, start: number, end: number) {
  const [x1, y1] = pointOnRing(start, radius);
  const [x2, y2] = pointOnRing(end, radius);
  const large = end - start > MINUTES_PER_DAY / 2 ? 1 : 0;
  // SVG's y axis points down, so the clockwise dial flips sign on y.
  return `M${(cx + x1).toFixed(2)} ${(cy - y1).toFixed(2)}A${radius} ${radius} 0 ${large} 1 ${(cx + x2).toFixed(2)} ${(cy - y2).toFixed(2)}`;
}

/** Merge consecutive slices of one day into runs of the same kind, for drawing arcs. */
export function sliceRuns(slices: readonly ActivitySlice[], day = 0) {
  const runs: { end: number; kind: SliceKind; start: number }[] = [];
  for (const slice of slices) {
    if (slice.day !== day) continue;
    const last = runs.at(-1);
    if (last && last.kind === slice.kind && last.end === slice.minute) {
      last.end = slice.minute + SLICE_MINUTES;
    } else {
      runs.push({ start: slice.minute, end: slice.minute + SLICE_MINUTES, kind: slice.kind });
    }
  }
  return runs;
}

/** The slice of `day` covering a minute of the day, if any. */
export function sliceAt(
  slices: readonly ActivitySlice[],
  minute: number,
  day = 0
): ActivitySlice | undefined {
  return slices.find(
    (slice) => slice.day === day && minute >= slice.minute && minute < slice.minute + SLICE_MINUTES
  );
}
