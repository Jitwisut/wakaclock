'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useMemo, useRef, useState } from 'react';

import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { NoToneMapping, SRGBColorSpace } from 'three';

import { generateDemoDays } from '../time-data';
import { setTimeUi } from '../time-store';

import { Burst } from './burst';
import { Dust, Heartbeats } from './heartbeats';
import { BLOOM_BASE, MidnightDirector } from './midnight-director';
import { PointerProbe } from './pointer-probe';
import { SCENE } from './scene-palette';
import { Shockwaves } from './shockwaves';
import { TimeRig } from './time-rig';
import { TimeRings } from './time-rings';

import type { TimeSceneQuality } from '../time-quality';
import type { BloomEffect } from 'postprocessing';

/** Marks the scene ready after its first rendered frame, so the still can fade out. */
function FirstFrame() {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    setTimeUi({ sceneStatus: 'ready' });
  });
  return null;
}

/**
 * The time ring: today's 24-hour dial with the week receding behind it. Loaded with
 * `next/dynamic` after first paint, so none of three.js is on the critical path.
 */
export default function TimeCanvas({
  active,
  quality,
}: {
  active: boolean;
  quality: TimeSceneQuality;
}) {
  const slices = useMemo(() => generateDemoDays(quality.days), [quality.days]);
  const [dpr, setDpr] = useState(Math.min(quality.maxDpr, 1.5));
  const [bloom, setBloom] = useState(quality.bloom);
  const bloomEffect = useRef<BloomEffect | null>(null);

  return (
    <Canvas
      camera={{ fov: 36, near: 0.1, far: 80, position: [1.4, 0.6, 8.2] }}
      dpr={dpr}
      frameloop={active ? 'always' : 'never'}
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
      {/* Adaptive quality: lower the pixel ratio when frames drop, raise it when idle. */}
      <PerformanceMonitor
        bounds={() => [45, 58]}
        flipflops={3}
        onChange={({ factor }) => setDpr(Math.max(1, Math.min(quality.maxDpr, 1 + factor)))}
        onFallback={() => {
          // Struggling device: drop the expensive glow first, then the resolution.
          setBloom(false);
          setDpr(1);
        }}
      />
      <TimeRig parallax={quality.parallax} />
      <MidnightDirector bloom={bloomEffect} />
      <TimeRings bloom={bloom} days={quality.days} slices={slices} />
      <Shockwaves />
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
