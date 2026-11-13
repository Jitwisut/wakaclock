'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  type Group,
  IcosahedronGeometry,
  type InstancedMesh,
  type LineBasicMaterial,
  type MeshBasicMaterial,
  Object3D,
} from 'three';

import { type ActivitySlice, PROJECT_COUNT, seededRandom, type SliceKind } from '../time-data';
import { galaxyVisibility } from '../time-keyframes';
import { getTimeUi, timeMotion } from '../time-store';

import { dotTexture } from './heartbeats';
import { SCENE } from './scene-palette';

const TAU = Math.PI * 2;
const dummy = new Object3D();
const KIND_COLOR: Record<SliceKind, Color> = {
  human: new Color(SCENE.human),
  ai: new Color(SCENE.ai),
  unattributed: new Color(SCENE.unattributed).multiplyScalar(1.8),
};

/** Where each demo project's cluster hangs in space, around and behind the core. */
export const CLUSTER_CENTERS: readonly [number, number, number][] = [
  [-12.5, 4.6, -9],
  [13.5, -2.4, -12],
  [-8.5, -6.2, -19],
  [10.5, 7.2, -23],
];

interface Node {
  kind: SliceKind;
  position: [number, number, number];
  size: number;
}

/**
 * One cluster per demo project. Every node is one session-hour of that project's demo
 * activity, coloured by its dominant kind, laid along two spiral arms in order — so the
 * lines between neighbours trace the project's history outward from its centre.
 */
export function buildClusters(slices: readonly ActivitySlice[], maxNodes: number) {
  const random = seededRandom(4242);
  return Array.from({ length: PROJECT_COUNT }, (_, project) => {
    const buckets = new Map<string, Record<SliceKind, number>>();
    for (const slice of slices) {
      if (slice.project !== project) continue;
      const key = `${slice.day}:${Math.floor(slice.minute / 60)}`;
      const bucket = buckets.get(key) ?? { ai: 0, human: 0, unattributed: 0 };
      bucket[slice.kind] += 1;
      buckets.set(key, bucket);
    }
    const nodes: Node[] = [];
    let index = 0;
    for (const counts of buckets.values()) {
      if (nodes.length >= maxNodes) break;
      const kind = (Object.entries(counts) as [SliceKind, number][]).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] as SliceKind;
      const arm = index % 2;
      const r = 0.35 + Math.sqrt(index / Math.max(1, maxNodes)) * 3.1;
      const angle = arm * Math.PI + r * 1.5 + (random() - 0.5) * 0.5;
      nodes.push({
        kind,
        size: 0.6 + (counts.ai + counts.human + counts.unattributed) / 12,
        position: [
          Math.cos(angle) * r,
          (random() - 0.5) * 0.5 * (1.2 - r / 4),
          Math.sin(angle) * r,
        ],
      });
      index += 1;
    }
    return nodes;
  });
}

function Cluster({
  center,
  nodes,
  seed,
}: {
  center: [number, number, number];
  nodes: Node[];
  seed: number;
}) {
  const group = useRef<Group>(null);
  const mesh = useRef<InstancedMesh>(null);
  const lineMaterial = useRef<LineBasicMaterial>(null);
  const nodeMaterial = useRef<MeshBasicMaterial>(null);
  const glowMaterial = useRef<MeshBasicMaterial>(null);
  const geometry = useMemo(() => new IcosahedronGeometry(0.06, 1), []);
  const dot = useMemo(() => dotTexture(), []);
  const links = useMemo(() => {
    const positions: number[] = [];
    for (let index = 2; index < nodes.length; index += 1) {
      const a = nodes[index - 2]?.position;
      const b = nodes[index]?.position;
      if (a && b) positions.push(...a, ...b);
    }
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    return buffer;
  }, [nodes]);

  useEffect(() => {
    const instance = mesh.current;
    if (!instance) return;
    for (const [index, node] of nodes.entries()) {
      dummy.position.set(...node.position);
      dummy.scale.setScalar(node.size);
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
      instance.setColorAt(index, KIND_COLOR[node.kind]);
    }
    instance.instanceMatrix.needsUpdate = true;
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
  }, [nodes]);

  useEffect(
    () => () => {
      geometry.dispose();
      links.dispose();
      dot.dispose();
    },
    [dot, geometry, links]
  );

  useFrame((_, delta) => {
    const visibility = galaxyVisibility(timeMotion.current);
    if (group.current) {
      group.current.visible = visibility > 0.01;
      group.current.rotation.y += Math.min(delta, 0.1) * (0.05 + seed * 0.01);
    }
    if (visibility <= 0.01) return;
    // The chapter-04 focus control reaches the galaxy too: off-focus kinds dim.
    const { focus } = getTimeUi();
    if (nodeMaterial.current) {
      nodeMaterial.current.opacity = visibility * (focus === 'all' ? 1 : 0.55);
    }
    if (lineMaterial.current) lineMaterial.current.opacity = visibility * 0.22;
    if (glowMaterial.current) glowMaterial.current.opacity = visibility * 0.32;
  });

  return (
    <group position={center} ref={group} rotation={[0.35 + seed * 0.2, seed, 0.15 * seed]}>
      <instancedMesh args={[geometry, undefined, nodes.length]} ref={mesh}>
        <meshBasicMaterial ref={nodeMaterial} toneMapped={false} transparent />
      </instancedMesh>
      <lineSegments geometry={links}>
        <lineBasicMaterial
          blending={AdditiveBlending}
          color={SCENE.human}
          depthWrite={false}
          opacity={0}
          ref={lineMaterial}
          toneMapped={false}
          transparent
        />
      </lineSegments>
      <sprite scale={[3.4, 3.4, 1]}>
        <spriteMaterial
          blending={AdditiveBlending}
          color={SCENE.human}
          depthWrite={false}
          map={dot}
          opacity={0}
          ref={glowMaterial}
          toneMapped={false}
          transparent
        />
      </sprite>
    </group>
  );
}

/** Faint filaments from the core out to each cluster: the projects belong to one history. */
function Filaments() {
  const material = useRef<LineBasicMaterial>(null);
  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (const center of CLUSTER_CENTERS) positions.push(0, 0, 0, ...center);
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    return buffer;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    if (material.current) material.current.opacity = galaxyVisibility(timeMotion.current) * 0.1;
  });
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        blending={AdditiveBlending}
        color={SCENE.ink}
        depthWrite={false}
        opacity={0}
        ref={material}
        transparent
      />
    </lineSegments>
  );
}

/**
 * The Development Galaxy: the demo projects as luminous clusters of interconnected events.
 * Illustrative only — the page labels it as demo data wherever it is visible.
 */
export function Galaxy({ maxNodes, slices }: { maxNodes: number; slices: ActivitySlice[] }) {
  const clusters = useMemo(() => buildClusters(slices, maxNodes), [maxNodes, slices]);
  return (
    <group>
      <Filaments />
      {clusters.map((nodes, index) => (
        <Cluster
          center={CLUSTER_CENTERS[index] as [number, number, number]}
          key={CLUSTER_CENTERS[index]?.join(',')}
          nodes={nodes}
          seed={index / TAU + index * 0.7}
        />
      ))}
    </group>
  );
}
