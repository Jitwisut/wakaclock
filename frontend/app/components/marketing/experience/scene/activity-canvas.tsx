'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { NoToneMapping, SRGBColorSpace } from 'three';

import { generateDemoActivity } from '../experience-data';
import { setUi } from '../experience-store';

import { ActivityField } from './activity-field';
import { CameraRig } from './camera-rig';
import { HoverProbe } from './hover-probe';
import { jumpStory } from './story-clock';

import type { ExperienceCopyShape } from '../experience-copy';

export interface SceneQuality {
  days: number;
  interactive: boolean;
  /** Upper bound for the device pixel ratio; the monitor may lower it further. */
  maxDpr: number;
}

/** Reports "first frame rendered" exactly once — the loader's last real step. */
function FirstFrame() {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    setUi({ loadStep: 3, sceneStatus: 'ready' });
  });
  return null;
}

/**
 * Renderer configuration and scene graph. Loaded with `next/dynamic` after first paint, so
 * none of three.js is on the critical path for the headline or the answer paragraph.
 */
export default function ActivityCanvas({
  active,
  copy,
  locale,
  quality,
}: {
  active: boolean;
  copy: ExperienceCopyShape;
  locale: 'en' | 'th';
  quality: SceneQuality;
}) {
  const blocks = useMemo(() => generateDemoActivity(quality.days), [quality.days]);
  const [dpr, setDpr] = useState(Math.min(quality.maxDpr, 1.5));

  useEffect(() => {
    // Start on the composition that matches the current scroll position.
    jumpStory();
    setUi({ loadStep: 2 });
  }, []);

  return (
    <Canvas
      camera={{ fov: 34, near: 0.1, far: 60, position: [1.6, 0.2, 8.8] }}
      dpr={dpr}
      eventPrefix="client"
      frameloop={active ? 'always' : 'never'}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        outputColorSpace: SRGBColorSpace,
        // Scene colours are matched to the page's CSS tokens, so no tone mapping.
        toneMapping: NoToneMapping,
      }}
    >
      {/* Adaptive quality: step the pixel ratio down when frames drop, back up when idle. */}
      <PerformanceMonitor
        bounds={() => [45, 58]}
        flipflops={3}
        onChange={({ factor }) => setDpr(Math.max(1, Math.min(quality.maxDpr, 1 + factor)))}
        onFallback={() => setDpr(1)}
      />
      <CameraRig parallax={quality.interactive} />
      <ActivityField blocks={blocks} days={quality.days} />
      {quality.interactive ? (
        <HoverProbe blocks={blocks} copy={copy} days={quality.days} locale={locale} />
      ) : null}
      <FirstFrame />
    </Canvas>
  );
}
