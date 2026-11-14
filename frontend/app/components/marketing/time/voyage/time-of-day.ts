import { DAY_END_MINUTE, DAY_START_MINUTE } from '../time-keyframes';

/**
 * The light follows the page's clock (owner decision 2026-11-14): the story opens at golden
 * hour, the sun sets as the reader scrolls, the lanterns take over at dusk and the voyage
 * reaches night as the clock reaches midnight. One number — the clock hand's minute —
 * drives the sun, the sky, the exposure and the lanterns.
 */

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smooth(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Progress through the story's day, 0 at the first chapter, 1 at midnight. */
export function dayProgress(handMinute: number) {
  return clamp01((handMinute - DAY_START_MINUTE) / (DAY_END_MINUTE - DAY_START_MINUTE));
}

/** Sun elevation in radians: ~9° at the opening, the horizon around chapter 03, night by 06. */
export function sunElevation(progress: number) {
  return 0.16 - 0.48 * clamp01(progress) ** 1.4;
}

/** The sun's azimuth: low behind the ship, on its side of the opening frame. */
export const SUN_AZIMUTH = Math.atan2(-0.96, -0.28);

/** Unit vector toward the sun. */
export function sunDirection(elevation: number): [number, number, number] {
  const flat = Math.cos(elevation);
  return [Math.cos(SUN_AZIMUTH) * flat, Math.sin(elevation), Math.sin(SUN_AZIMUTH) * flat];
}

/** 1 in full daylight, 0 at night; twilight in between. */
export function daylight(elevation: number) {
  return smooth(-0.2, 0.08, elevation);
}

/** How strongly the lanterns burn: barely at golden hour, fully after sunset. */
export function lanternLevel(elevation: number) {
  return 0.25 + 0.75 * smooth(0.06, -0.12, elevation);
}

/** Tone-mapping exposure: brighter at dusk so the scene never goes muddy, calm at night. */
export function exposureFor(elevation: number) {
  return 0.62 + 0.38 * smooth(-0.32, -0.04, elevation);
}

/** Star visibility. */
export function starLevel(elevation: number) {
  return smooth(-0.1, -0.26, elevation);
}
