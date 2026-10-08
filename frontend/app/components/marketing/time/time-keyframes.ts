/**
 * Camera choreography for the time ring, one keyframe per chapter. The story position `g`
 * runs 0 → CHAPTER_COUNT - 1 as the page scrolls; the rig samples a spline through these
 * keys at `g / (CHAPTER_COUNT - 1)`, so each chapter lands on its own composition.
 *
 * The rings sit in the XY plane: today at z = 0, each earlier day RING_SPACING further back.
 */

export const CHAPTER_COUNT = 6;
export const RING_RADIUS = 2.6;
export const RING_SPACING = 2.4;

type Vec3 = readonly [number, number, number];

export const CAMERA_KEYS: readonly { look: Vec3; pos: Vec3 }[] = [
  // 01 — hero: today's dial, whole, framed to the right of the headline.
  { pos: [1.6, 0.6, 12.5], look: [-2.9, 0.1, 0] },
  // 02 — heartbeats: close on the lit arcs, framed left of the right-hand text.
  { pos: [-3, -1.8, 9.6], look: [2.4, -0.7, -0.6] },
  // 03 — one day: the week recedes behind a centred statement.
  { pos: [5.2, 3.4, 8.2], look: [0, 0.2, -6] },
  // 04 — human + AI: low and oblique across the stack.
  { pos: [6.2, -3.4, 8], look: [-2.2, 0.2, -4] },
  // 05 — the product: high, looking down the stack like a chart.
  { pos: [2.2, 12, 3], look: [-2.4, 0, -7] },
  // 06 — begin: straight down the axis, every day aligned into one tunnel.
  { pos: [0, -1.2, 13.5], look: [0, -2.4, -8] },
];

/**
 * Which chapter a story position belongs to. A chapter takes over just before its top
 * reaches mid-screen, and keeps the stage however tall it is (the pinned track runs long).
 */
export function chapterAt(g: number): number {
  return Math.min(CHAPTER_COUNT - 1, Math.max(0, Math.floor(g + 0.15)));
}

/** Spline parameter for a story position, clamped to [0, 1]. */
export function cameraParameterAt(g: number): number {
  return Math.min(1, Math.max(0, g / (CHAPTER_COUNT - 1)));
}

/**
 * Frame-rate independent easing toward a target: the share of the remaining distance to
 * cover this frame, for a given stiffness.
 */
export function dampFactor(delta: number, stiffness = 3.2): number {
  return 1 - Math.exp(-stiffness * Math.max(0, delta));
}

/**
 * How visible ring `day` is at story position `g`. Today is always shown; the earlier days
 * fade in from chapter 03, when the camera first turns to look down the week.
 */
export function ringOpacity(day: number, g: number): number {
  if (day === 0) return 1;
  const reveal = Math.min(1, Math.max(0, g - 1.4));
  return reveal * Math.max(0.18, 1 - day * 0.12);
}

/* ---------- the clock hand: one scroll through the page is one working day ---------- */

export const DAY_START_MINUTE = 8 * 60;
export const DAY_END_MINUTE = 24 * 60;
/** Brightness of today's arcs the hand has not reached yet: dim, but still readable. */
export const FUTURE_LEVEL = 0.5;
/** How far behind the hand (in minutes) the passing flash and the light sweep reach. */
export const TRAIL_MINUTES = 90;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** Minute of the day the hand points at for a story position: 08:00 at the top, 24:00 at the end. */
export function handMinuteAt(g: number): number {
  return DAY_START_MINUTE + cameraParameterAt(g) * (DAY_END_MINUTE - DAY_START_MINUTE);
}

/** "HH:MM" for a minute of the day. */
export function formatClock(minute: number): string {
  const whole = Math.floor(minute);
  const hours = Math.floor(whole / 60);
  return `${String(hours).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

/** Brightness of one of today's slices: lit once the hand has passed it, dim before. */
export function arcLevel(minute: number, hand: number): number {
  return minute < hand ? 1 : FUTURE_LEVEL;
}

/**
 * Light trailing the hand: 1 right at the hand, fading to 0 TRAIL_MINUTES behind it. "Behind"
 * depends on which way the hand is turning, so scrolling up sweeps the other way.
 */
export function trailAt(minute: number, hand: number, direction: number): number {
  const behind = direction >= 0 ? hand - minute : minute - hand;
  if (behind < 0 || behind > TRAIL_MINUTES) return 0;
  return 1 - behind / TRAIL_MINUTES;
}

/** How strongly the sweep shows for a hand speed in minutes per second (0 when it rests). */
export function sweepStrength(minutesPerSecond: number): number {
  return clamp01(Math.abs(minutesPerSecond) / 240);
}

/* ---------- motion of the week ---------- */

/** Warp amount for a scroll speed in viewport heights per second. */
export function warpTarget(viewportsPerSecond: number): number {
  return clamp01((Math.abs(viewportsPerSecond) - 0.15) / 2.2);
}

/** Depth of a day's ring; warp stretches the week apart like a tunnel. */
export function ringDepth(day: number, warp: number): number {
  return -day * RING_SPACING * (1 + warp * 0.9);
}

/**
 * Spin and tilt of an earlier day's ring. Today never turns (it is the clock), and every
 * ring eases back to flat through the last chapter so the week lines up into one tunnel.
 */
export function ringTwist(day: number, g: number, warp: number): { spin: number; tilt: number } {
  if (day === 0) return { spin: 0, tilt: 0 };
  const settle = 1 - clamp01(g - (CHAPTER_COUNT - 2));
  const direction = day % 2 === 0 ? 1 : -1;
  return {
    spin: direction * (g * 0.32 + warp * 0.6) * (0.4 + day * 0.1) * settle,
    tilt: Math.sin(g * 0.9 + day * 0.7) * 0.09 * day * settle,
  };
}

/* ---------- pointer over the dial ---------- */

/** Minute of the day under a point on today's dial plane (x right, y up). */
export function minuteAtPoint(x: number, y: number): number {
  const turn = (Math.PI / 2 - Math.atan2(y, x)) / (Math.PI * 2);
  return (((turn % 1) + 1) % 1) * 1440;
}

/** Whether a point on the dial plane lies on the lit band of today's ring. */
export function onRingBand(x: number, y: number, tolerance = 0.3): boolean {
  return Math.abs(Math.hypot(x, y) - RING_RADIUS) <= tolerance;
}
