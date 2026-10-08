'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useMemo, useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  type LineBasicMaterial,
  type LineSegments,
  type Points,
  type PointsMaterial,
  Vector3,
} from 'three';

import { type ActivitySlice, pointOnRing, seededRandom, SLICE_MINUTES } from '../time-data';
import { RING_RADIUS, RING_SPACING } from '../time-keyframes';
import { timeMotion } from '../time-store';

import { DAY, SCENE } from './scene-palette';

const DUST_NIGHT = new Color(SCENE.ink);
const DUST_DAY = new Color(DAY.ink);

/** Soft round sprite so points read as glowing dots rather than squares. */
function dotTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

/**
 * Heartbeats arriving: each particle drifts in from outside the dial and settles onto one of
 * today's lit slices, fading as it lands, then starts again somewhere else.
 */
export function Heartbeats({ count, slices }: { count: number; slices: ActivitySlice[] }) {
  const points = useRef<Points>(null);
  const today = useMemo(() => slices.filter((slice) => slice.day === 0), [slices]);
  const texture = useMemo(() => dotTexture(), []);
  const seeds = useMemo(() => {
    const random = seededRandom(7);
    return Array.from({ length: count }, () => ({
      slice: Math.floor(random() * today.length),
      phase: random(),
      speed: 0.12 + random() * 0.18,
      lift: 0.8 + random() * 1.6,
      drift: (random() - 0.5) * 0.9,
    }));
  }, [count, today.length]);

  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    result.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    result.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));
    return result;
  }, [count]);

  const tint = useMemo(() => new Color(SCENE.highlight), []);

  useFrame((_, delta) => {
    if (!points.current || today.length === 0) return;
    const position = geometry.getAttribute('position') as BufferAttribute;
    const color = geometry.getAttribute('color') as BufferAttribute;
    seeds.forEach((seed, index) => {
      seed.phase += delta * seed.speed;
      if (seed.phase >= 1) {
        seed.phase -= 1;
        seed.slice = (seed.slice + 37) % today.length;
      }
      const slice = today[seed.slice] as ActivitySlice;
      const t = seed.phase;
      const eased = 1 - (1 - t) ** 3;
      const radius = RING_RADIUS + (1 - eased) * seed.lift;
      const [x, y] = pointOnRing(slice.minute + SLICE_MINUTES / 2, radius);
      position.setXYZ(index, x, y, (1 - eased) * seed.drift);
      // Fade in quickly, glow on approach, fade as it lands.
      // Additive points vanish on the light page: they fade out with the dusk.
      const brightness = Math.min(1, t * 6) * (1 - t ** 4) * (1 - timeMotion.daylight);
      color.setXYZ(index, tint.r * brightness, tint.g * brightness, tint.b * brightness);
    });
    position.needsUpdate = true;
    color.needsUpdate = true;
    (points.current.material as PointsMaterial).size = 0.11 * (1 + timeMotion.warp * 0.9);
  });

  return (
    <points frustumCulled={false} geometry={geometry} ref={points}>
      <pointsMaterial
        blending={AdditiveBlending}
        depthWrite={false}
        map={texture}
        size={0.11}
        sizeAttenuation
        toneMapped={false}
        transparent
        vertexColors
      />
    </points>
  );
}

/**
 * Dust through the volume of the week. At rest each mote is a pin-prick; scrolling fast
 * stretches every mote into a streak along the tunnel, the warp's sense of speed.
 */
const projected = new Vector3();
const REPEL_RADIUS = 0.2;

/**
 * Dust through the volume of the week. At rest each mote is a pin-prick; scrolling fast
 * stretches every mote into a streak along the tunnel, the warp's sense of speed. With a
 * mouse, motes near the cursor drift aside and settle back once it moves on.
 */
export function Dust({
  count,
  days,
  interactive,
}: {
  count: number;
  days: number;
  interactive: boolean;
}) {
  const { camera, size } = useThree();
  const lines = useRef<LineSegments>(null);
  const anchors = useMemo(() => {
    const random = seededRandom(11);
    return Array.from({ length: count }, () => [
      (random() - 0.5) * 16,
      (random() - 0.5) * 10,
      3 - random() * (days * RING_SPACING + 6),
    ]);
  }, [count, days]);
  const offsets = useMemo(() => new Float32Array(count * 2), [count]);
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    result.setAttribute('position', new BufferAttribute(new Float32Array(count * 6), 3));
    return result;
  }, [count]);
  const state = useRef({ stretch: -1, x: Number.NaN, y: Number.NaN, settling: false });

  useFrame(() => {
    const length = 0.03 + timeMotion.warp * 2.2;
    const material = lines.current?.material as LineBasicMaterial | undefined;
    if (material) {
      const { daylight, warp } = timeMotion;
      material.opacity = (0.28 + warp * 0.45) * (1 - daylight * 0.4);
      material.color.copy(DUST_NIGHT).lerp(DUST_DAY, daylight);
    }
    const last = state.current;
    const moved = interactive && (timeMotion.pointerX !== last.x || timeMotion.pointerY !== last.y);
    const stretched = Math.abs(length - last.stretch) >= 0.002;
    if (!stretched && !moved && !last.settling) return;
    last.stretch = length;
    last.x = timeMotion.pointerX;
    last.y = timeMotion.pointerY;

    const aspect = size.width / Math.max(1, size.height);
    let settling = false;
    const position = geometry.getAttribute('position') as BufferAttribute;
    anchors.forEach(([ax, ay, az], index) => {
      const x = ax as number;
      const y = ay as number;
      const z = az as number;
      let pushX = 0;
      let pushY = 0;
      if (interactive) {
        projected.set(x, y, z).project(camera);
        const dx = (projected.x - timeMotion.pointerX) * aspect;
        const dy = projected.y - timeMotion.pointerY;
        const distance = Math.hypot(dx, dy);
        if (distance < REPEL_RADIUS && distance > 1e-4 && projected.z < 1) {
          const strength = ((REPEL_RADIUS - distance) / REPEL_RADIUS) * 0.9;
          pushX = (dx / distance) * strength;
          pushY = (dy / distance) * strength;
        }
      }
      const ox = offsets[index * 2] as number;
      const oy = offsets[index * 2 + 1] as number;
      const nx = ox + (pushX - ox) * 0.12;
      const ny = oy + (pushY - oy) * 0.12;
      offsets[index * 2] = nx;
      offsets[index * 2 + 1] = ny;
      if (Math.abs(nx - pushX) > 0.002 || Math.abs(ny - pushY) > 0.002) settling = true;
      position.setXYZ(index * 2, x + nx, y + ny, z);
      position.setXYZ(index * 2 + 1, x + nx, y + ny, z - length);
    });
    last.settling = settling;
    position.needsUpdate = true;
  });

  return (
    <lineSegments frustumCulled={false} geometry={geometry} ref={lines}>
      <lineBasicMaterial color={SCENE.ink} depthWrite={false} transparent />
    </lineSegments>
  );
}
