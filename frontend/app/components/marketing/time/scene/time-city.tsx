'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  type Group,
  type InstancedMesh,
  Object3D,
  Vector3,
} from 'three';

import { type ActivitySlice, type SliceKind } from '../time-data';
import { blockRise, hourlyBlocks } from '../time-effects';
import { timeMotion } from '../time-store';

import { DAY } from './scene-palette';

/** Where the city stands: under the ring, a little behind it. */
export const CITY_ORIGIN = new Vector3(0, -3.6, -1.5);
const HOUR_STEP = 0.44;
const DAY_STEP = 0.72;
const MAX_HEIGHT = 2.4;
const PLINTH = 0.05;

const KIND: Record<SliceKind, Color> = {
  human: new Color(DAY.human),
  ai: new Color(DAY.ai),
  unattributed: new Color(DAY.unattributed),
};
const EMPTY = new Color('#d6d2c4');
const dummy = new Object3D();

/**
 * The light page's set piece: the week's demo hours standing as a city under the ring,
 * one block per hour, its height the minutes of coding in it. The blocks rise in a wave
 * as the visitor scrolls the page, driven by scroll alone (no clock), so on-demand
 * rendering never freezes it halfway.
 */
export function TimeCity({ days, slices }: { days: number; slices: ActivitySlice[] }) {
  const group = useRef<Group>(null);
  const blocksMesh = useRef<InstancedMesh>(null);
  const shown = useRef(-1);
  const blocks = useMemo(() => hourlyBlocks(slices, days), [days, slices]);
  const geometry = useMemo(() => new BoxGeometry(0.34, 1, 0.56).translate(0, 0.5, 0), []);
  const grid = useMemo(() => {
    const points: Vector3[] = [];
    const width = 24 * HOUR_STEP;
    const depth = days * DAY_STEP;
    for (let day = 0; day <= days; day += 1) {
      const z = -day * DAY_STEP + DAY_STEP / 2;
      points.push(new Vector3(-width / 2, 0, z), new Vector3(width / 2, 0, z));
    }
    for (let hour = 0; hour <= 24; hour += 6) {
      const x = (hour - 12) * HOUR_STEP;
      points.push(new Vector3(x, 0, DAY_STEP / 2), new Vector3(x, 0, DAY_STEP / 2 - depth));
    }
    return new BufferGeometry().setFromPoints(points);
  }, [days]);

  useEffect(() => {
    const mesh = blocksMesh.current;
    if (!mesh) return;
    blocks.forEach((block, index) => {
      mesh.setColorAt(index, block.minutes > 0 ? KIND[block.kind] : EMPTY);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [blocks]);

  useFrame(() => {
    const root = group.current;
    const mesh = blocksMesh.current;
    if (!root || !mesh) return;
    const progress = timeMotion.dayCurrent;
    root.visible = progress > 0.01;
    if (!root.visible) return;
    const rounded = Math.round(progress * 400) / 400;
    if (rounded === shown.current) return;
    shown.current = rounded;
    blocks.forEach((block, index) => {
      const rise = blockRise(block.day, block.hour, progress);
      const height = PLINTH + (block.minutes / 60) * MAX_HEIGHT;
      dummy.position.set((block.hour - 11.5) * HOUR_STEP, 0, -block.day * DAY_STEP);
      dummy.scale.set(1, Math.max(0.001, height * rise), 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={CITY_ORIGIN} ref={group} visible={false}>
      <ambientLight intensity={1.4} />
      <directionalLight intensity={1.6} position={[6, 12, 8]} />
      <instancedMesh
        args={[geometry, undefined, blocks.length]}
        frustumCulled={false}
        ref={blocksMesh}
      >
        <meshLambertMaterial />
      </instancedMesh>
      <lineSegments geometry={grid}>
        <lineBasicMaterial color={DAY.ink} opacity={0.18} transparent />
      </lineSegments>
    </group>
  );
}
