'use client';

import { type RefObject, useRef } from 'react';

import { useFrame } from '@react-three/fiber';

import { bloomFade } from '../time-keyframes';
import { MIDNIGHT_START, midnightFrame, nextMidnight } from '../time-midnight';
import { getTimeUi, setTimeUi, timeMotion } from '../time-store';

import type { BloomEffect } from 'postprocessing';

export const BLOOM_BASE = 0.85;

/**
 * Runs the midnight ending and the chapter pulse on real time, after the camera rig and
 * before everything that draws, and publishes their values on `timeMotion`.
 */
export function MidnightDirector({ bloom }: { bloom: RefObject<BloomEffect | null> }) {
  const state = useRef(MIDNIGHT_START);
  const age = useRef(0);
  const lastChapter = useRef<null | number>(null);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    age.current += delta;
    state.current = nextMidnight(state.current, timeMotion.current, delta, age.current);
    const frame = midnightFrame(state.current);
    timeMotion.collapse = frame.collapse;
    timeMotion.flash = frame.flash;
    timeMotion.wave = frame.wave;
    timeMotion.burst = frame.burst;
    setTimeUi({ midnight: frame.newDay });

    // One heartbeat per chapter change; a new one replaces any still running, and the
    // first chapter seen on load does not pulse.
    const { chapter } = getTimeUi();
    if (lastChapter.current !== null && chapter !== lastChapter.current) timeMotion.pulseAge = 0;
    else timeMotion.pulseAge += delta;
    lastChapter.current = chapter;

    if (bloom.current) {
      bloom.current.intensity = (BLOOM_BASE + frame.flash * 2.4) * bloomFade(timeMotion.daylight);
    }
  }, -0.5);

  return null;
}
