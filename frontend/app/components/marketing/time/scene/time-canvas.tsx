'use client';

import { useEffect, useRef, useState } from 'react';

import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, N8AO, TiltShift2, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';

import { Desk, Lamp, Monitor, RingClock, RoomGlow, RoomLight } from '../editor/desk';
import { Figures, StoryProjector } from '../editor/figures';
import { RouteHearts } from '../editor/hearts';
import { ScenePicker } from '../editor/pick';
import { CodeFile, Cursors, EditorDirector, Landmarks } from '../editor/scene';
import { setTimeUi, timeMotion } from '../time-store';
import { HotspotProjector } from '../voyage/hotspot-projector';
import { voyage } from '../voyage/state';
import { TOUR } from '../voyage/world-places';

import { TimeRig } from './time-rig';

import type { TimeSceneQuality } from '../time-quality';

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
function useStagedScene(post: boolean) {
  const [stage, setStage] = useState(0);
  /** All shaders compiled: drawing may begin (state, so the effect pass can switch on). */
  const [ready, setReady] = useState(false);
  const compiled = useRef(false);
  const compiling = useRef(false);
  const shown = useRef(0);
  const waited = useRef(0);
  useFrame(({ camera, clock, gl, scene }) => {
    if (compiled.current) {
      // With the effect pass on, it draws the frame (at the same priority); not us as well.
      if (!post) gl.render(scene, camera);
      // The effect pass switches on with the `ready` commit and compiles its own shaders on
      // its first frame: count frames toward the reveal only once it is drawing.
      else if (!ready) return;
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
      setReady(true);
    };
    // Older three builds and test renderers have no async compile: fall back to drawing.
    const compile = (gl as { compileAsync?: (scene: unknown, camera: unknown) => Promise<unknown> })
      .compileAsync;
    if (compile) void compile.call(gl, scene, camera).then(finish, finish);
    else finish();
  }, 1);
  return { ready, stage };
}

/**
 * The miniature's lens (owner decision 2026-11-15, full tier only): soft ambient occlusion
 * where parts meet, a gentle tilt-shift that softens only the far edge of the frame (the
 * band with the islands and the figurines stays sharp — uv y 0.4, low on the screen), and the tone mapping the renderer gives up to the pass.
 * Off until the scene has compiled; its own shaders compile on its first frame, and the
 * staged loader holds the reveal until after that frame (measured: ~120 ms, unseen).
 */
function MiniatureLens({ on }: { on: boolean }) {
  return (
    <EffectComposer enabled={on} enableNormalPass={false} multisampling={4}>
      <N8AO
        aoRadius={2.6}
        color="#120c08"
        distanceFalloff={1.2}
        halfRes
        intensity={2.4}
        quality="medium"
      />
      <TiltShift2 blur={0.05} end={[1, 0.4]} start={[0, 0.4]} taper={0.75} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
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

function Scene({ quality }: { quality: TimeSceneQuality }) {
  const post = quality.bloom;
  const { ready, stage } = useStagedScene(post);
  return (
    <>
      <TimeRig parallax={quality.parallax} />
      <EditorDirector />
      <Invalidator />
      <RoomLight stops={TOUR.length} />
      <ScenePicker />
      <Lamp shadows={quality.shadows} />
      <RoomGlow />
      <Desk />
      <CodeFile />
      {stage >= 1 ? (
        <>
          <Cursors />
          <Figures />
          <RouteHearts />
        </>
      ) : null}
      {stage >= 2 ? <Landmarks particles={quality.fxParticles} /> : null}
      {stage >= 3 ? (
        <>
          <RingClock stops={TOUR.length} />
          <Monitor />
        </>
      ) : null}
      <HotspotProjector />
      <StoryProjector />
      {post ? <MiniatureLens on={ready} /> : null}
    </>
  );
}

/**
 * The lowest pixel ratio the performance monitor may drop to. On a high-density screen the
 * full tier never goes below 1.5: at 1 or 1.25 the token bars' edges and the glyphs went
 * visibly soft (owner asked for a sharper scene, 2026-11-15).
 */
export function dprFloor(maxDpr: number, deviceRatio = globalThis.devicePixelRatio ?? 1) {
  if (maxDpr < 2 || deviceRatio < 2) return 1;
  return 1.5;
}

/**
 * The editor world (owner decision 2026-11-15): one enormous source file seen as a landscape,
 * travelled with the cursor. Loaded with `next/dynamic` after first paint, so none of
 * three.js is on the critical path. No text is drawn anywhere in the scene.
 */
export default function TimeCanvas({
  mode,
  quality,
}: {
  mode: 'always' | 'demand';
  quality: TimeSceneQuality;
}) {
  const [factor, setFactor] = useState(1);
  const dpr = Math.max(dprFloor(quality.maxDpr), 1 + factor * (quality.maxDpr - 1));

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
      <Scene quality={quality} />
    </Canvas>
  );
}
