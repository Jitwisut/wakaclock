'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedBufferAttribute,
  LineBasicMaterial,
  ShaderMaterial,
  Vector4,
} from 'three';

import { getUi } from '../experience-store';

import { activityFragmentShader, activityVertexShader } from './activity-shader';
import { sceneStateAt } from './keyframes';
import { blendSwatch } from './palette';
import { story } from './story-clock';

import type { AttributionKind } from '../experience-copy';
import type { DemoBlock } from '../experience-data';

const FOCUS: Record<AttributionKind, readonly [number, number, number]> = {
  all: [1, 1, 1],
  human: [1, 0.1, 0.12],
  ai: [0.1, 1, 0.12],
  unattributed: [0.1, 0.1, 1],
};

const TAU = Math.PI * 2;
const RADIUS = 2.6;
const DAY_HEIGHT = 0.34;

function buildGeometry(blocks: readonly DemoBlock[]) {
  const geometry = new BoxGeometry(1, 1, 1);
  const count = blocks.length;
  const block = new Float32Array(count * 4);
  const meta = new Float32Array(count * 3);
  blocks.forEach((entry, index) => {
    block.set([entry.day, entry.startMin, entry.durationMin, entry.project], index * 4);
    // A stable pseudo-random stagger so marks assemble in waves rather than all at once.
    const seed = (Math.sin(index * 12.9898 + entry.day * 78.233) * 43_758.5453) % 1;
    meta.set([entry.kind, Math.abs(seed), index], index * 3);
  });
  geometry.setAttribute('aBlock', new InstancedBufferAttribute(block, 4));
  geometry.setAttribute('aMeta', new InstancedBufferAttribute(meta, 3));
  return geometry;
}

/**
 * Thin threads between each AI agent run and the human block right before it in the same
 * session, drawn at the split layout. They are what makes the two systems read as
 * *interconnected* rather than as two unrelated charts.
 */
function buildConnectors(blocks: readonly DemoBlock[], days: number) {
  const points: number[] = [];
  let lastHuman: DemoBlock | undefined;
  let previous: DemoBlock | undefined;
  const at = (entry: DemoBlock, radius: number) => {
    const mid = (entry.startMin + entry.durationMin / 2) / 1440;
    const angle = mid * TAU;
    const y = (entry.day + mid - days / 2) * DAY_HEIGHT;
    return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
  };
  for (const entry of blocks) {
    if (previous?.session !== entry.session) lastHuman = undefined;
    if (entry.kind === 0) lastHuman = entry;
    // Connect only the first block of each AI run, so a thread marks a hand-off.
    if (entry.kind === 1 && previous?.kind !== 1 && lastHuman) {
      points.push(...at(lastHuman, RADIUS * 0.66), ...at(entry, RADIUS * 1.32));
    }
    previous = entry;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
  return geometry;
}

export function ActivityField({ blocks, days }: { blocks: readonly DemoBlock[]; days: number }) {
  const geometry = useMemo(() => buildGeometry(blocks), [blocks]);
  const connectorGeometry = useMemo(() => buildConnectors(blocks, days), [blocks, days]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: activityVertexShader,
        fragmentShader: activityFragmentShader,
        uniforms: {
          uStage: { value: 0 },
          uDays: { value: days },
          uTime: { value: 0 },
          uHoverBlock: { value: -1 },
          uHoverProject: { value: -1 },
          uFocus: { value: new Vector4(1, 1, 1, 1) },
          uKindMix: { value: 0 },
          uBg: { value: new Color() },
          uInk: { value: new Color() },
          uHuman: { value: new Color() },
          uAi: { value: new Color() },
          uUnknown: { value: new Color() },
          uHighlight: { value: new Color() },
          uFogNear: { value: 9 },
          uFogFar: { value: 30 },
          uPresence: { value: 1 },
        },
      }),
    [days]
  );
  const lineMaterial = useMemo(
    () => new LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    []
  );

  // R3F disposes objects it creates from JSX, not ones handed to it as props.
  useEffect(
    () => () => {
      geometry.dispose();
      connectorGeometry.dispose();
      material.dispose();
      lineMaterial.dispose();
    },
    [geometry, connectorGeometry, material, lineMaterial]
  );

  useFrame((state) => {
    const g = story.current;
    const { stage, dusk, kindMix, presence } = sceneStateAt(g);
    const ui = getUi();
    const u = material.uniforms;
    u.uStage.value = stage;
    u.uTime.value = state.clock.elapsedTime;
    u.uKindMix.value = kindMix;
    u.uPresence.value = presence;
    u.uHoverBlock.value = ui.hoverBlock;
    u.uHoverProject.value = ui.hoverProject;
    const focus = FOCUS[ui.hoverKind ?? ui.focus];
    const f = u.uFocus.value as Vector4;
    // Ease focus changes so selecting a category is a transition, not a cut.
    f.x += (focus[0] - f.x) * 0.12;
    f.y += (focus[1] - f.y) * 0.12;
    f.z += (focus[2] - f.z) * 0.12;
    blendSwatch(u.uBg.value, 'bg', dusk);
    blendSwatch(u.uInk.value, 'ink', dusk);
    blendSwatch(u.uHuman.value, 'human', dusk);
    blendSwatch(u.uAi.value, 'ai', dusk);
    blendSwatch(u.uUnknown.value, 'unknown', dusk);
    blendSwatch(u.uHighlight.value, 'highlight', dusk);

    const split = Math.max(0, 1 - Math.abs(stage - 2) * 1.6);
    blendSwatch(lineMaterial.color, 'line', dusk);
    lineMaterial.opacity = split * kindMix * 0.55 * Math.min(f.y + 0.15, 1);
  });

  return (
    <>
      <instancedMesh
        args={[geometry, material, blocks.length]}
        frustumCulled={false}
        renderOrder={0}
      />
      <lineSegments geometry={connectorGeometry} material={lineMaterial} renderOrder={1} />
    </>
  );
}
