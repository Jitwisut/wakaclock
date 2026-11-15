import { seededRandom } from '../time-data';

import { formatCoded } from './charts';
import { LINES_PER_STOP, STOP_COUNT, TEXT_LEFT, TEXT_RIGHT } from './file-plan';

/**
 * The story game's state and rules (owner decision 2026-11-15): heartbeats to collect along
 * the file and on the islands, what a tapped tower says, how the room's light turns from
 * afternoon to night as the day goes on, and whether the day is over. Pure data and a tiny
 * subscription, so the scene (writing) and the page overlay (reading) share it without
 * React renders per frame.
 */

export interface Heart {
  id: number;
  /** On the file: the line it floats over (the visitor's cursor collects it in passing). */
  line: number;
  /** On an island instead: the place's stop (tap to collect); 0 for hearts on the file. */
  stop: number;
  /** Across the line (world x) for a file heart; ignored on islands. */
  x: number;
}

/** Hearts on the file between two stops, and one hidden on every island. */
const ROUTE_PER_STRETCH = 2;

function plantHearts(): Heart[] {
  const random = seededRandom(707);
  const hearts: Heart[] = [];
  for (let stretch = 0; stretch < STOP_COUNT; stretch += 1) {
    for (let index = 0; index < ROUTE_PER_STRETCH; index += 1) {
      hearts.push({
        id: hearts.length,
        line: stretch * LINES_PER_STOP + 12 + index * 15 + Math.floor(random() * 6),
        stop: 0,
        x: TEXT_LEFT + 4 + random() * (TEXT_RIGHT - TEXT_LEFT - 8),
      });
    }
  }
  for (let stop = 1; stop <= STOP_COUNT; stop += 1) {
    hearts.push({ id: hearts.length, line: 0, stop, x: 0 });
  }
  return hearts;
}

export const HEARTS: readonly Heart[] = plantHearts();

/** Whether a file heart has been reached by a cursor that has typed down to `line`. */
export function heartReached(heart: Heart, line: number) {
  return heart.stop === 0 && line >= heart.line;
}

/* ---------- shared state ---------- */

export const play = {
  /** Hearts collected, by id. */
  hearts: new Set<number>(),
  /** The day is over: the visitor went past the last stop. */
  ended: false,
  /** Which day this is: a new day starts the typing over (the scene watches it). */
  day: 0,
  /** Changes on every update, for `useSyncExternalStore`. */
  version: 0,
  /** A tapped tower's readout and where on screen it was tapped (client px). */
  tip: null as { at: number; text: string; x: number; y: number } | null,
};

const listeners = new Set<() => void>();

export function subscribePlay(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function playVersion() {
  return play.version;
}

function changed() {
  play.version += 1;
  for (const listener of listeners) listener();
}

export function collectHeart(id: number) {
  if (play.hearts.has(id)) return false;
  play.hearts.add(id);
  changed();
  return true;
}

export function showTip(text: string, x: number, y: number) {
  play.tip = { at: Date.now(), text, x, y };
  changed();
}

export function endDay(ended = true) {
  if (play.ended === ended) return;
  play.ended = ended;
  changed();
}

/** A new day: nothing collected, nothing typed, the end card gone. */
export function resetDay() {
  play.hearts.clear();
  play.ended = false;
  play.day += 1;
  play.tip = null;
  changed();
}

/* ---------- what things say ---------- */

/** Minutes of demo time one metre of tower stands for. */
export const MINUTES_PER_METRE = 12;

/** A tapped tower's readout: "You 1h 36m · AI 0h 24m" in the page's language. */
export function towerText(human: number, ai: number, labels: { ai: string; you: string }) {
  const you = `${labels.you} ${formatCoded(human * MINUTES_PER_METRE)}`;
  return ai > 0 ? `${you} · ${labels.ai} ${formatCoded(ai * MINUTES_PER_METRE)}` : you;
}

/* ---------- the day's light ---------- */

export interface DayLight {
  /** The distant room lights (out of focus): how lit. */
  glow: number;
  /** The desk lamp's strength. */
  lamp: number;
  /** Fill light in the room. */
  room: number;
  warmth: number;
  /** The window: strength, and how warm (1 golden sun → 0 blue night). */
  window: number;
}

const KEYS: readonly (readonly [number, DayLight])[] = [
  [0, { lamp: 1.6, room: 1, window: 1.7, warmth: 0.55, glow: 0.12 }],
  [0.45, { lamp: 3.6, room: 0.8, window: 1.1, warmth: 1, glow: 0.2 }],
  [0.8, { lamp: 4.8, room: 0.55, window: 0.45, warmth: 0.25, glow: 0.3 }],
  [1, { lamp: 5.2, room: 0.45, window: 0.3, warmth: 0, glow: 0.36 }],
];

/**
 * The room's light at a point of the day (0 = the start of the tour, 1 = the last stop):
 * bright afternoon through the window, a golden evening with the lamp coming on, then night
 * with only the lamp. `ended` turns the lamp down for the end of the day.
 */
export function dayLight(progress: number, ended = false): DayLight {
  const p = Math.min(1, Math.max(0, progress));
  let index = 0;
  while (index < KEYS.length - 2 && p > (KEYS[index + 1] as (typeof KEYS)[number])[0]) index += 1;
  const [from, a] = KEYS[index] as (typeof KEYS)[number];
  const [to, b] = KEYS[index + 1] as (typeof KEYS)[number];
  const t = (p - from) / (to - from);
  const mix = (key: keyof DayLight) => a[key] + (b[key] - a[key]) * t;
  const light = {
    lamp: mix('lamp'),
    room: mix('room'),
    window: mix('window'),
    warmth: mix('warmth'),
    glow: mix('glow'),
  };
  return ended ? { ...light, lamp: light.lamp * 0.25, room: light.room * 0.7 } : light;
}
