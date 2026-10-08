'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, type Mesh, type MeshBasicMaterial, RingGeometry } from 'three';

import { RING_RADIUS } from '../time-keyframes';
import { pulseShape, waveShape } from '../time-midnight';
import { timeMotion } from '../time-store';

import { SCENE } from './scene-palette';

function apply(mesh: Mesh | null, shape: { opacity: number; scale: number }) {
  if (!mesh) return;
  mesh.visible = shape.opacity > 0.005;
  mesh.scale.setScalar(shape.scale);
  (mesh.material as MeshBasicMaterial).opacity = shape.opacity;
}

/** The midnight shockwave and the per-chapter pulse: thin rings racing out from the dial. */
export function Shockwaves() {
  const midnight = useRef<Mesh>(null);
  const pulse = useRef<Mesh>(null);
  const geometry = useMemo(
    () => new RingGeometry(RING_RADIUS * 0.985, RING_RADIUS * 1.015, 160),
    []
  );

  useFrame(() => {
    apply(midnight.current, waveShape(timeMotion.wave));
    apply(pulse.current, pulseShape(timeMotion.pulseAge));
  });

  return (
    <group>
      {[midnight, pulse].map((ref, index) => (
        <mesh
          geometry={geometry}
          key={index === 0 ? 'midnight' : 'pulse'}
          ref={ref}
          visible={false}
        >
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={SCENE.highlight}
            depthWrite={false}
            toneMapped={false}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}
