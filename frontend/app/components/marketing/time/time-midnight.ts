import { CHAPTER_COUNT } from './time-keyframes';

/**
 * The midnight ending. When the scroll reaches the end of the day, the whole week collapses
 * into one ring (the bigger picture), a flash and a shockwave go out, heartbeats burst
 * outward, and the clock turns over to 00:00 — a new day. It plays once on real time, comes
 * to rest, and re-arms only after the visitor scrolls well back up.
 */

const END = CHAPTER_COUNT - 1;
/** `current` only approaches the end asymptotically, so fire just short of it. */
export const MIDNIGHT_FIRE_AT = END - 0.03;
/** A clear gap below the trigger, so resting near the threshold cannot retrigger it. */
export const MIDNIGHT_REARM_BELOW = END - 0.4;
/** The scene's first second belongs to the grow-in; the ending waits for it. */
export const MIDNIGHT_MIN_SCENE_AGE = 1;
export const MIDNIGHT_DURATION = 3;
/** When the clock reads 00:00: the moment of the flash. */
export const MIDNIGHT_STRIKE = 0.9;

export type MidnightPhase = 'armed' | 'done' | 'playing';
export interface MidnightState {
  elapsed: number;
  phase: MidnightPhase;
}

export const MIDNIGHT_START: MidnightState = { phase: 'armed', elapsed: 0 };

export function nextMidnight(
  state: MidnightState,
  g: number,
  delta: number,
  sceneAge: number
): MidnightState {
  if (state.phase !== 'armed' && g < MIDNIGHT_REARM_BELOW) return MIDNIGHT_START;
  if (state.phase === 'armed') {
    const ready = g >= MIDNIGHT_FIRE_AT && sceneAge >= MIDNIGHT_MIN_SCENE_AGE;
    return ready ? { phase: 'playing', elapsed: 0 } : state;
  }
  if (state.phase === 'playing') {
    const elapsed = state.elapsed + Math.min(Math.max(delta, 0), 0.1);
    return elapsed >= MIDNIGHT_DURATION
      ? { phase: 'done', elapsed: MIDNIGHT_DURATION }
      : { phase: 'playing', elapsed };
  }
  return state;
}

function window01(t: number, start: number, end: number) {
  return Math.min(1, Math.max(0, (t - start) / (end - start)));
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

export interface MidnightFrame {
  /** 0 → 1: heartbeats bursting outward. */
  burst: number;
  /** 0 → 1: the week's rings slide into today's. Stays merged once done. */
  collapse: number;
  /** Flash at the strike, decaying. */
  flash: number;
  /** True from the strike onward: the clock reads 00:00, a new day. */
  newDay: boolean;
  /** 0 → 1: the shockwave travelling outward (0 and 1 are both invisible). */
  wave: number;
}

const REST: MidnightFrame = { collapse: 0, flash: 0, wave: 0, burst: 0, newDay: false };

/** Every effect value for a moment of the sequence. */
export function midnightFrame(state: MidnightState): MidnightFrame {
  if (state.phase === 'armed') return REST;
  const t = state.elapsed;
  const sinceStrike = t - MIDNIGHT_STRIKE;
  return {
    collapse: easeInOut(window01(t, 0, MIDNIGHT_STRIKE)),
    flash: sinceStrike < 0 ? 0 : Math.max(0, 1 - sinceStrike / 0.8),
    wave: window01(t, MIDNIGHT_STRIKE, MIDNIGHT_STRIKE + 1.5),
    burst: window01(t, MIDNIGHT_STRIKE, MIDNIGHT_STRIKE + 1.8),
    newDay: sinceStrike >= 0,
  };
}

/** Shockwave ring for a 0–1 progress: grows from the dial outward and fades. */
export function waveShape(progress: number): { opacity: number; scale: number } {
  if (progress <= 0 || progress >= 1) return { opacity: 0, scale: 1 };
  return { opacity: (1 - progress) ** 1.5, scale: 1 + progress * 3.2 };
}

/** The chapter pulse: a smaller wave, about a second long, `age` seconds after it started. */
export const PULSE_SECONDS = 1.1;
export function pulseShape(age: number): { opacity: number; scale: number; throb: number } {
  if (age < 0 || age >= PULSE_SECONDS) return { opacity: 0, scale: 1, throb: 0 };
  const progress = age / PULSE_SECONDS;
  return {
    opacity: 0.55 * (1 - progress) ** 2,
    scale: 1 + progress * 1.4,
    // The dial itself beats once: a quick swell that settles.
    throb: Math.sin(Math.min(1, progress * 2.5) * Math.PI) * 0.035,
  };
}
