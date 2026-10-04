'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useMemo, useRef, useState } from 'react';

import { Html } from '@react-three/drei';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { DoubleSide, type Mesh, type Vector3 } from 'three';

import { DEMO_PROJECTS, type DemoBlock, formatClock, formatMinutes } from '../experience-data';
import { setUi } from '../experience-store';

import { sceneStateAt } from './keyframes';
import { story } from './story-clock';

import type { ExperienceCopyShape } from '../experience-copy';

const RADIUS = 2.6;
const DAY_HEIGHT = 0.34;
const TAU = Math.PI * 2;

/**
 * Hover detail for the spiral. The marks are placed on the GPU, so they cannot be
 * raycast directly; instead an invisible cylinder at the spiral's radius is hit-tested and
 * the hit point is converted back to (day, minute) — the same mapping the shader uses —
 * then looked up in the data. Enabled only while the spiral is actually on screen.
 */
export function HoverProbe({
  blocks,
  copy,
  days,
  locale,
}: {
  blocks: readonly DemoBlock[];
  copy: ExperienceCopyShape;
  days: number;
  locale: 'en' | 'th';
}) {
  const mesh = useRef<Mesh>(null);
  const [hit, setHit] = useState<{ block: number; point: Vector3 } | null>(null);
  const byDay = useMemo(() => {
    const map = new Map<number, number[]>();
    blocks.forEach((block, index) => {
      const list = map.get(block.day) ?? [];
      list.push(index);
      map.set(block.day, list);
    });
    return map;
  }, [blocks]);
  const active = useRef(false);

  useFrame(() => {
    const { stage } = sceneStateAt(story.current);
    const next = stage > 0.85 && stage < 1.35;
    if (next !== active.current) {
      active.current = next;
      if (mesh.current) mesh.current.visible = next;
      if (!next) {
        setHit(null);
        setUi({ hoverBlock: -1 });
      }
    }
  });

  const onMove = (event: ThreeEvent<PointerEvent>) => {
    if (!active.current) return;
    const { point } = event;
    const turn = (Math.atan2(point.z, point.x) / TAU + 1) % 1;
    const minute = turn * 1440;
    const day = Math.round(point.y / DAY_HEIGHT + days / 2 - turn);
    let best = -1;
    let bestDistance = 24;
    for (const index of byDay.get(day) ?? []) {
      const block = blocks[index];
      const distance = Math.max(
        0,
        block.startMin - minute,
        minute - (block.startMin + block.durationMin)
      );
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
    setUi({ hoverBlock: best });
    setHit(best === -1 ? null : { block: best, point: point.clone() });
  };

  const onLeave = () => {
    setHit(null);
    setUi({ hoverBlock: -1 });
  };

  const block = hit ? blocks[hit.block] : undefined;
  const kindLabel = block
    ? [
        copy.humanAi.kinds.human.label,
        copy.humanAi.kinds.ai.label,
        copy.humanAi.kinds.unattributed.label,
      ][block.kind]
    : '';
  return (
    <>
      <mesh onPointerLeave={onLeave} onPointerMove={onMove} ref={mesh} visible={false}>
        <cylinderGeometry
          args={[RADIUS + 0.4, RADIUS + 0.4, days * DAY_HEIGHT + 0.6, 48, 1, true]}
        />
        <meshBasicMaterial colorWrite={false} depthWrite={false} side={DoubleSide} />
      </mesh>
      {block && hit ? (
        <Html center={false} pointerEvents="none" position={hit.point} zIndexRange={[20, 10]}>
          <div className="axx-probe" role="presentation">
            <span className="axx-probe-kicker">{copy.demoBadge}</span>
            <strong>{DEMO_PROJECTS[block.project]}</strong>
            <span>
              {formatClock(block.startMin)}–{formatClock(block.startMin + block.durationMin)} ·{' '}
              {formatMinutes(block.durationMin, locale)}
            </span>
            <span data-kind={block.kind}>{kindLabel}</span>
          </div>
        </Html>
      ) : null}
    </>
  );
}
