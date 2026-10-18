'use client';

import { useEffect, useRef, useState } from 'react';

import { useTimeUi } from './time-store';

import type { TimeCopyShape } from './time-copy';
import type { TimeUi } from './time-store';

/** The count never reaches 100 sooner than this, so a cached visit still gets its opening. */
export const INTRO_MIN_MS = 1400;
/** Past this (from navigation start) the curtain opens anyway; a late scene fades in behind. */
export const INTRO_MAX_MS = 7000;
/** Frames the scene runs behind the curtain after its first one: shaders warm, motion settles. */
export const INTRO_WARM_MS = 700;
/** The letterbox opening, matched to the `tx-intro-*` keyframes in time.css. */
export const INTRO_REVEAL_MS = 2100;
/** A beat at 100 before the bars part. */
export const INTRO_HOLD_MS = 180;
/** When the CSS failsafe clears an un-hydrated curtain (`tx-intro-failsafe` in time.css). */
export const INTRO_FAILSAFE_MS = 4500;

export type IntroPhase = 'done' | 'loading' | 'reveal';

export interface IntroSignals {
  forced: boolean;
  pageLoaded: boolean;
  status: TimeUi['sceneStatus'];
  warm: boolean;
}

/** How far real loading has got: page, scene code requested, first frame, warmed up. */
export function introGoal({ forced, pageLoaded, status, warm }: IntroSignals): number {
  if (forced || warm || status === 'fallback') return 1;
  if (status === 'ready') return 0.9;
  if (status === 'loading') return 0.62;
  return pageLoaded ? 0.3 : 0.12;
}

/** The milestone after `goal`: the count creeps towards it while a stage is still running. */
function nextGoal(goal: number) {
  if (goal < 0.3) return 0.3;
  if (goal < 0.62) return 0.62;
  return goal < 0.9 ? 0.9 : 1;
}

/**
 * Advances the shown fraction for one frame. It eases towards the reached milestone, creeps
 * part of the way to the next one so the number never stalls, and is held to the elapsed
 * share of the minimum duration.
 */
export function stepIntro(
  shown: number,
  goal: number,
  waitedMs: number,
  elapsedMs: number,
  deltaMs: number
): number {
  const creep = goal < 1 ? (nextGoal(goal) - goal) * 0.7 * (1 - Math.exp(-waitedMs / 1800)) : 0;
  const cap = Math.min(goal + creep, elapsedMs / INTRO_MIN_MS);
  const next = shown + (cap - shown) * (1 - Math.exp(-deltaMs / 160));
  return cap - next < 0.004 ? Math.max(shown, cap) : Math.max(shown, next);
}

/** Which loading step the count is on, for the caption under it. */
export function introStep(shown: number) {
  if (shown < 0.62) return 0;
  return shown < 0.9 ? 1 : 2;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The opening of the homepage: a count from 000 to 100 that follows the scene actually
 * loading, then letterbox bars part like a film's first shot while the camera pushes in.
 * Server-rendered so nothing shows before it; CSS clears it on its own if scripts have not
 * taken over in time, and reduced motion skips it.
 */
export function TimeIntro({ copy, rootId }: { copy: TimeCopyShape['loader']; rootId: string }) {
  const status = useTimeUi((state) => state.sceneStatus);
  const [phase, setPhase] = useState<IntroPhase>('loading');
  const [live, setLive] = useState(false);
  const [shown, setShown] = useState(0);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [warm, setWarm] = useState(false);
  const [forced, setForced] = useState(false);
  const signals = useRef({ goal: 0, since: 0 });

  const goal = introGoal({ forced, pageLoaded, status, warm });
  useEffect(() => {
    signals.current = { goal, since: performance.now() };
  }, [goal]);

  useEffect(() => {
    setLive(true);
    // Hydrated after the CSS failsafe already cleared the curtain: do not bring it back.
    if (prefersReducedMotion() || performance.now() > INTRO_FAILSAFE_MS) {
      setPhase('done');
      return;
    }
    const markLoaded = () => setPageLoaded(true);
    if (document.readyState === 'complete') markLoaded();
    else window.addEventListener('load', markLoaded, { once: true });
    const force = globalThis.setTimeout(
      () => setForced(true),
      Math.max(0, INTRO_MAX_MS - performance.now())
    );
    return () => {
      window.removeEventListener('load', markLoaded);
      globalThis.clearTimeout(force);
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    const id = globalThis.setTimeout(() => setWarm(true), INTRO_WARM_MS);
    return () => globalThis.clearTimeout(id);
  }, [status]);

  useEffect(() => {
    if (phase !== 'loading' || !live) return;
    const started = performance.now();
    let last = started;
    let frame = requestAnimationFrame(function tick() {
      const now = performance.now();
      const { goal: reached, since } = signals.current;
      // Read before the update runs: React may call the updater after `last` moves on.
      const waited = now - since;
      const elapsed = now - started;
      const delta = now - last;
      setShown((value) => stepIntro(value, reached, waited, elapsed, delta));
      last = now;
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [live, phase]);

  useEffect(() => {
    if (phase === 'loading' && shown >= 1) {
      const id = globalThis.setTimeout(() => setPhase('reveal'), INTRO_HOLD_MS);
      return () => globalThis.clearTimeout(id);
    }
    if (phase !== 'reveal') return;
    const id = globalThis.setTimeout(() => setPhase('done'), INTRO_REVEAL_MS);
    return () => globalThis.clearTimeout(id);
  }, [phase, shown]);

  // The page dresses for the opening: the stage pushes in and the hero waits for it.
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(`#${rootId}`);
    if (live && root) root.dataset.intro = phase;
  }, [live, phase, rootId]);

  if (phase === 'done') return null;
  const count = Math.floor(shown * 100);
  return (
    <div aria-hidden="true" className="tx-intro" data-live={live || undefined} data-phase={phase}>
      <div className="tx-intro-bar" data-side="top" />
      <div className="tx-intro-bar" data-side="bottom" />
      <span className="tx-intro-flare" />
      <div className="tx-intro-core">
        <p className="tx-intro-count">{String(count).padStart(3, '0')}</p>
        <p className="tx-intro-label">
          {copy.label}
          <span>{copy.steps[introStep(shown)]}</span>
        </p>
        <span className="tx-intro-track">
          <span style={{ transform: `scaleX(${shown})` }} />
        </span>
      </div>
    </div>
  );
}
