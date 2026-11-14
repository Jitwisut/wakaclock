'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';

import { COMPATIBLE_EDITORS } from '../../editor-wall.data';
import { type ActivitySlice, generateDemoDays } from '../time-data';
import { setTimeUi, timeMotion } from '../time-store';
import { AiWind, Spray, VoyageDirector, VoyageLights } from '../voyage/director';
import { Ocean, SkyDome } from '../voyage/environment';
import { HotspotProjector } from '../voyage/hotspot-projector';
import { Islands } from '../voyage/islands';
import { ChipLog, Helm, Lanterns } from '../voyage/log-props';
import { PlaceEffects } from '../voyage/place-fx';
import { Dolphins, Gulls, Route, Whale } from '../voyage/sea-life';
import { Ship } from '../voyage/ship';
import { voyage } from '../voyage/state';
import { Wake } from '../voyage/wake';
import { Fleet, Weather } from '../voyage/weather';

import { MidnightDirector } from './midnight-director';
import { TimeRig } from './time-rig';

import type { TimeSceneQuality } from '../time-quality';
import type { BloomEffect } from 'postprocessing';

/** Seconds of motion the scene's clock starts with, so every cycle opens mid-flight. */
const WARM_START_SECONDS = 3600;

/** Frames between mounting one part of the scene and the next. */
const STAGE_GAP = 2;
const STAGES = 4;

/**
 * Builds the scene a part at a time and draws nothing until all of it is ready.
 *
 * Mounting everything in one frame meant building every geometry and compiling every shader
 * inside it: a freeze of a few hundred milliseconds right as the page appears. Here the sea
 * and sky mount first, then the ship, then the islands, then the effects, a couple of frames
 * apart; the shaders compile off the main thread (`compileAsync`); and only then does the
 * first frame draw and the still fade out. Rendering is taken over (priority 1) so that
 * nothing is drawn, and so nothing compiles synchronously, before that.
 */
function useStagedScene() {
  const [stage, setStage] = useState(0);
  const compiled = useRef(false);
  const compiling = useRef(false);
  const shown = useRef(0);
  const waited = useRef(0);
  useFrame(({ camera, clock, gl, scene }) => {
    if (compiled.current) {
      gl.render(scene, camera);
      // The first draw uploads every buffer and texture: let it pass unseen, and reveal the
      // scene (and start its opening move) on the clean frame after it.
      if (shown.current === 1) {
        clock.elapsedTime += WARM_START_SECONDS;
        setTimeUi({ sceneStatus: 'ready' });
        voyage.shown = true;
      }
      if (shown.current < 2) shown.current += 1;
      return;
    }
    if (stage < STAGES) {
      waited.current += 1;
      if (waited.current >= STAGE_GAP) {
        waited.current = 0;
        setStage(stage + 1);
      }
      return;
    }
    if (compiling.current) return;
    compiling.current = true;
    const finish = () => {
      compiled.current = true;
    };
    // Older three builds and test renderers have no async compile: fall back to drawing.
    const compile = (gl as { compileAsync?: (scene: unknown, camera: unknown) => Promise<unknown> })
      .compileAsync;
    if (compile) void compile.call(gl, scene, camera).then(finish, finish);
    else finish();
  }, 1);
  return stage;
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
      m.warp > 1e-3 ||
      Math.abs(m.handSpeed) > 0.5 ||
      (m.collapse > 0 && m.collapse < 1) ||
      m.wake < 1;
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

function Scene({ quality, slices }: { quality: TimeSceneQuality; slices: ActivitySlice[] }) {
  const stage = useStagedScene();
  // The midnight ending still runs (the clock reads 00:00), without a bloom pass to drive.
  const noBloom = useRef<BloomEffect | null>(null);
  return (
    <>
      <TimeRig parallax={quality.parallax} />
      <VoyageDirector lanterns={COMPATIBLE_EDITORS.length} slices={slices} />
      <MidnightDirector bloom={noBloom} />
      <Invalidator />
      <VoyageLights shadows={quality.shadows} />
      <SkyDome />
      <Ocean segments={quality.oceanSegments} />
      <Fleet>
        {stage >= 1 ? (
          <>
            <Wake />
            <ChipLog slices={slices} />
            <Ship>
              <Helm slices={slices} />
              <Lanterns />
            </Ship>
          </>
        ) : null}
        {stage >= 3 ? (
          <>
            <Spray count={quality.spray} />
            <AiWind count={quality.wind} />
            <Dolphins />
          </>
        ) : null}
      </Fleet>
      {stage >= 2 ? <Islands detail={quality.islandDetail} slices={slices} /> : null}
      {stage >= 3 ? (
        <>
          <PlaceEffects particles={quality.fxParticles} />
          <Weather drops={quality.fxParticles * 5} />
          <Route />
          <Whale />
          <Gulls />
        </>
      ) : null}
      <HotspotProjector />
    </>
  );
}

/**
 * The Voyage Log (owner decision 2026-11-14): a pirate ship crossing a living sunset ocean,
 * whose wake carries the chip log — one lit marker per demo heartbeat. Loaded with
 * `next/dynamic` after first paint, so none of three.js is on the critical path. No text is
 * drawn anywhere in the scene.
 */
export default function TimeCanvas({
  mode,
  quality,
}: {
  mode: 'always' | 'demand';
  quality: TimeSceneQuality;
}) {
  const slices = useMemo(() => generateDemoDays(quality.days), [quality.days]);
  const [factor, setFactor] = useState(1);
  const dpr = 1 + factor * (quality.maxDpr - 1);

  return (
    <Canvas
      camera={{ fov: 38, near: 0.1, far: 4000, position: [26, 7, 34] }}
      dpr={dpr}
      frameloop={mode}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        outputColorSpace: SRGBColorSpace,
        toneMapping: ACESFilmicToneMapping,
      }}
      shadows={quality.shadows ? { type: PCFSoftShadowMap } : false}
    >
      {/* Lowers the resolution only if the device cannot hold the frame rate, in a few
          coarse steps: every change reallocates the drawing buffer, which is itself a hitch. */}
      <PerformanceMonitor
        bounds={() => [40, 58]}
        factor={1}
        flipflops={2}
        onChange={({ factor: next }) => setFactor(Math.round(next * 4) / 4)}
        onFallback={() => setFactor(0.5)}
      />
      <Scene quality={quality} slices={slices} />
    </Canvas>
  );
}
