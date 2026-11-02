'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef, useState } from 'react';

import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Color, type Fog, NoToneMapping, SRGBColorSpace } from 'three';

import { generateDemoDays } from '../time-data';
import { setTimeUi, timeMotion } from '../time-store';

import { Burst } from './burst';
import { CodeFragments } from './code-fragments';
import { Dust, Heartbeats } from './heartbeats';
import { Helix } from './helix';
import { BLOOM_BASE, MidnightDirector } from './midnight-director';
import { PointerProbe } from './pointer-probe';
import { DAY, SCENE } from './scene-palette';
import { Shockwaves } from './shockwaves';
import { TimeCity } from './time-city';
import { TimeRig } from './time-rig';
import { TimeRings } from './time-rings';

import type { TimeSceneQuality } from '../time-quality';
import type { BloomEffect } from 'postprocessing';

/** Below this monitor factor (sustained slow frames) the bloom pass is dropped. */
const BLOOM_MIN_FACTOR = 0.5;

/** Seconds of motion the scene's clock starts with, so every cycle opens mid-flight. */
const WARM_START_SECONDS = 3600;

/**
 * Marks the scene ready after its first rendered frame, so the still can fade out, and
 * moves its clock on: the code and the helix are mid-cycle, as if long under way.
 */
function FirstFrame() {
  const done = useRef(false);
  useFrame(({ clock }) => {
    if (done.current) return;
    done.current = true;
    clock.elapsedTime += WARM_START_SECONDS;
    setTimeUi({ sceneStatus: 'ready' });
  });
  return null;
}

const NIGHT_BG = new Color(SCENE.bg);
const DAY_BG = new Color(DAY.bg);

/** Lerps the scene's background and fog from dusk to daylight. */
function DaylightGrade() {
  const { scene } = useThree();
  const last = useRef(-1);
  useFrame(() => {
    const t = Math.round(timeMotion.daylight * 200) / 200;
    if (t === last.current) return;
    last.current = t;
    if (scene.background instanceof Color) scene.background.copy(NIGHT_BG).lerp(DAY_BG, t);
    (scene.fog as Fog | null)?.color.copy(NIGHT_BG).lerp(DAY_BG, t);
  });
  return null;
}

/**
 * In on-demand mode, asks for a frame whenever something could change the picture: a
 * scroll, the pointer, a resize, or an animation that has not come to rest yet.
 */
function Invalidator() {
  const { invalidate } = useThree();
  useFrame(() => {
    const m = timeMotion;
    const settling =
      Math.abs(m.target - m.current) > 1e-4 ||
      Math.abs(m.dayTarget - m.dayCurrent) > 1e-4 ||
      Math.abs(m.dawnTarget - m.daylight) > 1e-3 ||
      m.warp > 1e-3 ||
      Math.abs(m.handSpeed) > 0.5 ||
      (m.collapse > 0 && m.collapse < 1) ||
      (m.wave > 0 && m.wave < 1) ||
      m.pulseAge < 1.2;
    if (settling) invalidate();
  });
  useEffect(() => {
    const wake = () => invalidate();
    for (const type of ['scroll', 'pointermove', 'resize'] as const) {
      window.addEventListener(type, wake, { passive: true });
    }
    return () => {
      for (const type of ['scroll', 'pointermove', 'resize'] as const) {
        window.removeEventListener(type, wake);
      }
    };
  }, [invalidate]);
  return null;
}

/**
 * The time ring: today's 24-hour dial with the week receding behind it. Loaded with
 * `next/dynamic` after first paint, so none of three.js is on the critical path.
 */
export default function TimeCanvas({
  mode,
  quality,
}: {
  mode: 'always' | 'demand';
  quality: TimeSceneQuality;
}) {
  const slices = useMemo(() => generateDemoDays(quality.days), [quality.days]);
  // Opens at the tier's full quality; the monitor only steps it down on sustained slow
  // frames. (Starting at half and climbing took ~10 s to look right on a fast machine.)
  const [factor, setFactor] = useState(1);
  const [bloom, setBloom] = useState(quality.bloom);
  const dpr = 1 + factor * (quality.maxDpr - 1);
  const bloomEffect = useRef<BloomEffect | null>(null);

  return (
    <Canvas
      camera={{ fov: 36, near: 0.1, far: 80, position: [1.4, 0.6, 8.2] }}
      dpr={dpr}
      frameloop={mode}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        outputColorSpace: SRGBColorSpace,
        // Colours are matched to the page's CSS tokens, so no tone mapping.
        toneMapping: NoToneMapping,
      }}
    >
      <color args={[SCENE.bg]} attach="background" />
      <fog args={[SCENE.bg, 11, 34]} attach="fog" />
      {/* Adaptive quality: lower the pixel ratio when frames drop, raise it when they
          recover. No flip-flop fallback: drei counts every step up as a flip, so a fast
          machine climbing back to full quality would trip it and lose the glow for good. */}
      <PerformanceMonitor
        bounds={() => [45, 58]}
        factor={1}
        onChange={({ factor: next }) => {
          setFactor(next);
          // Struggling device: the expensive glow goes for good once the resolution has
          // already been cut well down.
          if (next < BLOOM_MIN_FACTOR) setBloom(false);
        }}
      />
      <TimeRig parallax={quality.parallax} />
      <DaylightGrade />
      <Invalidator />
      <MidnightDirector bloom={bloomEffect} />
      <TimeRings bloom={bloom} days={quality.days} slices={slices} />
      <Shockwaves />
      <CodeFragments count={quality.parallax ? 8 : 4} dim={bloom} slices={slices} />
      <Helix count={quality.particles} dim={bloom} />
      <TimeCity days={quality.days} slices={slices} />
      <Heartbeats count={quality.particles} slices={slices} />
      <Burst count={quality.particles + 60} />
      <Dust count={quality.particles * 2} days={quality.days} interactive={quality.parallax} />
      {quality.parallax ? <PointerProbe slices={slices} /> : null}
      {bloom ? (
        <EffectComposer multisampling={4}>
          <Bloom
            intensity={BLOOM_BASE}
            luminanceSmoothing={0.25}
            luminanceThreshold={0.32}
            mipmapBlur
            ref={bloomEffect}
          />
        </EffectComposer>
      ) : null}
      <FirstFrame />
    </Canvas>
  );
}
