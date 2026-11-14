import { Color, Vector3 } from 'three';

/**
 * Per-frame values every part of the voyage reads: written once a frame by the director
 * (voyage-director.tsx), read by the sky, ocean, ship, lanterns and wake. Mutable on purpose
 * — nothing here re-renders React.
 */
export const voyage = {
  sunDir: new Vector3(0, 0.15, -1).normalize(),
  sunElev: 0.15,
  daylight: 1,
  stars: 0,
  lanterns: 0.25,
  /** Sunlight colour for the key light, warmer as the sun sinks. */
  sunColor: new Color('#ffcf98'),
  /** 0–1 emphasis for each kind, eased from the chapter-04 focus control. */
  human: 1,
  ai: 1,
  fog: 0,
  /** Scene seconds, shared so wake, sails and markers stay in step. */
  time: 0,
  /** Ship speed through the water (m/s), and how far the sea has streamed past (m). */
  speed: 4.2,
  sea: 0,
  /** The clock hand, minutes since midnight. */
  hand: 480,
  /** Index of the lantern most recently lit by a heartbeat, and how long ago. */
  pulseLantern: -1,
  pulseAge: 99,
  /** The place whose opening effect is playing, seconds since it opened, and its level. */
  fxPlace: '',
  fxAge: 99,
  fxOn: 0,
};

/**
 * A place's opening effect: `age` in seconds since it was opened and `on`, its eased 0–1
 * level while it stays open. Both rest (99, 0) for every other place.
 */
export function placeFx(id: string) {
  return voyage.fxPlace === id ? { age: voyage.fxAge, on: voyage.fxOn } : FX_REST;
}
const FX_REST = { age: 99, on: 0 };

/** A burst that peaks right after opening and has faded `seconds` later. */
export function fxBurst(age: number, seconds = 3) {
  if (age >= seconds) return 0;
  const t = age / seconds;
  return Math.min(1, t * 12) * (1 - t) ** 2;
}

/** Restore defaults between tests. */
export function resetVoyage() {
  voyage.sunDir.set(0, 0.15, -1).normalize();
  voyage.sunElev = 0.15;
  voyage.daylight = 1;
  voyage.stars = 0;
  voyage.lanterns = 0.25;
  voyage.sunColor.set('#ffcf98');
  voyage.human = 1;
  voyage.ai = 1;
  voyage.fog = 0;
  voyage.time = 0;
  voyage.speed = 4.2;
  voyage.sea = 0;
  voyage.hand = 480;
  voyage.pulseLantern = -1;
  voyage.pulseAge = 99;
  voyage.fxPlace = '';
  voyage.fxAge = 99;
  voyage.fxOn = 0;
}
