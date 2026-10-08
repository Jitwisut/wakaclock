'use client';

import { useSyncExternalStore } from 'react';

import type { SliceKind } from './time-data';

/**
 * State shared between the HTML chapters and the WebGL scene, mirroring the homepage's
 * experience store: `timeMotion` is mutable and read every frame (no React re-renders),
 * `ui` holds the few discrete values both surfaces render. Zustand is forbidden here.
 */
export const timeMotion = {
  /** Scroll position through the story, 0 → CHAPTER_COUNT - 1. */
  target: 0,
  /** The eased value the camera actually uses. */
  current: 0,
  /** Set on a discontinuous jump (reload, anchor, Home/End): snap instead of sweeping. */
  teleport: true,
  pointerX: 0,
  pointerY: 0,
  /** Scroll speed in viewport heights per second, decayed by the scene each frame. */
  velocity: 0,
  /** Smoothed warp amount, 0–1, written by the camera rig. */
  warp: 0,
  /** Minute of the day the hand points at, and how fast it is turning (minutes/second). */
  hand: 480,
  handSpeed: 0,
  /** Pointer in CSS pixels, for hit-testing what lies under it. */
  clientX: -1,
  clientY: -1,
  /** Midnight ending, written by the scene each frame (see time-midnight.ts). */
  collapse: 0,
  flash: 0,
  wave: 0,
  burst: 0,
  /** Seconds since the last chapter pulse started (large = none running). */
  pulseAge: 99,
  /** Progress through the light page below the story (camera), target and eased. */
  dayTarget: 0,
  dayCurrent: 0,
  /** Dusk-to-daylight blend, 0–1 (palette, glow, veils). */
  dawnTarget: 0,
  daylight: 0,
};

const MOTION_DEFAULTS = { ...timeMotion };

export type TimeFocus = 'all' | SliceKind;

export interface TimeHover {
  kind: SliceKind;
  minute: number;
  x: number;
  y: number;
}

export interface TimeUi {
  chapter: number;
  focus: TimeFocus;
  /** Today's slice under the pointer, for the tooltip. */
  hover: null | TimeHover;
  /** The midnight ending has struck: the clock reads 00:00. */
  midnight: boolean;
  sceneStatus: 'fallback' | 'idle' | 'loading' | 'ready';
}

const INITIAL: TimeUi = {
  chapter: 0,
  focus: 'all',
  hover: null,
  midnight: false,
  sceneStatus: 'idle',
};
let ui: TimeUi = INITIAL;
const listeners = new Set<() => void>();

export function setTimeUi(patch: Partial<TimeUi>) {
  const next = { ...ui, ...patch };
  const keys = Object.keys(patch) as (keyof TimeUi)[];
  if (keys.every((key) => next[key] === ui[key])) return;
  ui = next;
  for (const listener of listeners) listener();
}

export function getTimeUi(): TimeUi {
  return ui;
}

/** Test helper: restore the initial state between cases. */
export function resetTimeUi() {
  ui = INITIAL;
  Object.assign(timeMotion, MOTION_DEFAULTS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTimeUi<T>(select: (state: TimeUi) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(ui),
    () => select(INITIAL)
  );
}
