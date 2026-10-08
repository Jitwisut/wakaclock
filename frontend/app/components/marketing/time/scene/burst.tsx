'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  type Points,
  type PointsMaterial,
} from 'three';

import { seededRandom } from '../time-data';
import { RING_RADIUS } from '../time-keyframes';
import { timeMotion } from '../time-store';

import { SCENE } from './scene-palette';

/** Heartbeats flung outward from the dial at the stroke of midnight. */
export function Burst({ count }: { count: number }) {
  const points = useRef<Points>(null);
  const seeds = useMemo(() => {
    const random = seededRandom(24);
    return Array.from({ length: count }, () => ({
      angle: random() * Math.PI * 2,
      reach: 1.4 + random() * 4.2,
      lift: (random() - 0.5) * 2.4,
    }));
  }, [count]);
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    result.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    return result;
  }, [count]);
  const tint = useMemo(() => new Color(SCENE.highlight), []);

  useFrame(() => {
    const mesh = points.current;
    if (!mesh) return;
    const { burst } = timeMotion;
    mesh.visible = burst > 0 && burst < 1;
    if (!mesh.visible) return;
    const eased = 1 - (1 - burst) ** 3;
    const position = geometry.getAttribute('position') as BufferAttribute;
    seeds.forEach((seed, index) => {
      const radius = RING_RADIUS + eased * seed.reach;
      position.setXYZ(
        index,
        Math.cos(seed.angle) * radius,
        Math.sin(seed.angle) * radius,
        eased * seed.lift
      );
    });
    position.needsUpdate = true;
    const material = mesh.material as PointsMaterial;
    material.opacity = (1 - burst) ** 1.2;
    material.color.copy(tint);
  });

  return (
    <points frustumCulled={false} geometry={geometry} ref={points} visible={false}>
      <pointsMaterial
        blending={AdditiveBlending}
        depthWrite={false}
        size={0.07}
        sizeAttenuation
        toneMapped={false}
        transparent
      />
    </points>
  );
}
