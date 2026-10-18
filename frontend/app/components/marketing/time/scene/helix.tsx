'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  type Group,
  type LineBasicMaterial,
} from 'three';

import { helixFocus, helixPoint, type HelixStrand, helixVisibility } from '../time-effects';
import { dampFactor } from '../time-keyframes';
import { getTimeUi, timeMotion } from '../time-store';

import { dotTexture } from './heartbeats';
import { SCENE } from './scene-palette';

const STRANDS: HelixStrand[] = ['human', 'ai'];
const RUNG_EVERY = 4;

/**
 * Chapter 04: a human strand and an AI strand braided down the week's tunnel, in the same
 * colours as the arcs. The chapter's focus control pulls the braid apart and dims the side
 * that is not in focus; "Unattributed" dims both.
 */
export function Helix({ count, dim }: { count: number; dim: boolean }) {
  const group = useRef<Group>(null);
  const rungs = useRef<LineBasicMaterial>(null);
  const eased = useRef({ ai: 1, human: 1, spread: 0 });
  const dot = useMemo(() => dotTexture(), []);
  const colors = useMemo(() => ({ human: new Color(SCENE.human), ai: new Color(SCENE.ai) }), []);
  const strands = useMemo(
    () =>
      STRANDS.map(() => {
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
        geometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));
        return geometry;
      }),
    [count]
  );
  const rungGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    const pairs = Math.ceil(count / RUNG_EVERY);
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(pairs * 6), 3));
    return geometry;
  }, [count]);

  useFrame(({ clock }, delta) => {
    const root = group.current;
    if (!root) return;
    const visibility = helixVisibility(timeMotion.current) * (1 - timeMotion.daylight);
    root.visible = visibility > 0.01;
    if (!root.visible) return;

    const wanted = helixFocus(getTimeUi().focus);
    const ease = dampFactor(delta, 4);
    const state = eased.current;
    state.ai += (wanted.ai - state.ai) * ease;
    state.human += (wanted.human - state.human) * ease;
    state.spread += (wanted.spread - state.spread) * ease;
    const phase = timeMotion.current * 1.4 + clock.elapsedTime * 0.25;
    const glow = visibility * (dim ? 0.85 : 1.2);

    strands.forEach((geometry, strandIndex) => {
      const strand = STRANDS[strandIndex] as HelixStrand;
      const position = geometry.getAttribute('position') as BufferAttribute;
      const color = geometry.getAttribute('color') as BufferAttribute;
      const level = state[strand] * glow;
      const tint = colors[strand];
      for (let index = 0; index < count; index += 1) {
        const [x, y, z] = helixPoint(index, count, strand, phase, state.spread);
        position.setXYZ(index, x, y, z);
        // A soft shimmer runs down each strand.
        const pulse = 0.65 + 0.35 * Math.sin(index * 0.35 - clock.elapsedTime * 3);
        color.setXYZ(index, tint.r * level * pulse, tint.g * level * pulse, tint.b * level * pulse);
      }
      position.needsUpdate = true;
      color.needsUpdate = true;
    });

    const rungPosition = rungGeometry.getAttribute('position') as BufferAttribute;
    for (let index = 0, pair = 0; index < count; index += RUNG_EVERY, pair += 1) {
      const [hx, hy, hz] = helixPoint(index, count, 'human', phase, state.spread);
      const [ax, ay, az] = helixPoint(index, count, 'ai', phase, state.spread);
      rungPosition.setXYZ(pair * 2, hx, hy, hz);
      rungPosition.setXYZ(pair * 2 + 1, ax, ay, az);
    }
    rungPosition.needsUpdate = true;
    if (rungs.current) rungs.current.opacity = 0.22 * visibility * (1 - state.spread * 0.7);
  });

  return (
    <group ref={group} visible={false}>
      {strands.map((geometry, index) => (
        <points frustumCulled={false} geometry={geometry} key={STRANDS[index]}>
          <pointsMaterial
            blending={AdditiveBlending}
            depthWrite={false}
            map={dot}
            size={0.24}
            sizeAttenuation
            toneMapped={false}
            transparent
            vertexColors
          />
        </points>
      ))}
      <lineSegments frustumCulled={false} geometry={rungGeometry}>
        <lineBasicMaterial color={SCENE.ink} depthWrite={false} ref={rungs} transparent />
      </lineSegments>
    </group>
  );
}
