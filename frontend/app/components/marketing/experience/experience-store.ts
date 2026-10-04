'use client';

import { useSyncExternalStore } from 'react';

import type { AttributionKind } from './experience-copy';

/**
 * Shared state between the HTML chapters and the WebGL scene.
 *
 * Two kinds of value live here:
 * - `motion` is written every scroll/pointer event and read every animation frame. It is a
 *   plain mutable object on purpose — routing 60 updates a second through React state
 *   would re-render the page for nothing.
 * - `ui` holds the few discrete choices (focused attribution kind, hovered project) that
 *   both React surfaces render. It is exposed through `useSyncExternalStore`.
 *
 * Zustand is forbidden in this repo, and a Context would force the scene and the chapters
 * under one provider even though they mount at different times.
 */

export const motion = {
  /** Scroll position through the story, 0 → 6 (one unit per chapter). */
  target: 0,
  /**
   * Set when `target` moved discontinuously — scroll restoration on reload, an anchor
   * link, a jump to the top. The scene snaps instead of easing, so it never sweeps through
   * every chapter's geometry on the way to where the visitor actually is.
   */
  teleport: false,
  /** Pointer position in [-1, 1], used for camera parallax. */
  pointerX: 0,
  pointerY: 0,
};

export interface ExperienceUi {
  /** Discrete chapter index derived from `motion.target`, for the rail and the cursor. */
  chapter: number;
  focus: AttributionKind;
  /** Block index under the pointer in the scene, or -1. */
  hoverBlock: number;
  hoverKind: AttributionKind | null;
  hoverProject: number;
  loadStep: number;
  sceneStatus: 'fallback' | 'idle' | 'loading' | 'ready';
}

let ui: ExperienceUi = {
  hoverBlock: -1,
  focus: 'all',
  hoverKind: null,
  hoverProject: -1,
  chapter: 0,
  sceneStatus: 'idle',
  loadStep: 0,
};

const listeners = new Set<() => void>();

export function setUi(patch: Partial<ExperienceUi>) {
  let changed = false;
  for (const key of Object.keys(patch) as (keyof ExperienceUi)[]) {
    if (ui[key] !== patch[key]) changed = true;
  }
  if (!changed) return;
  ui = { ...ui, ...patch };
  listeners.forEach((listener) => listener());
}

export function getUi() {
  return ui;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useExperienceUi<T>(select: (state: ExperienceUi) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(ui),
    () => select(ui)
  );
}
