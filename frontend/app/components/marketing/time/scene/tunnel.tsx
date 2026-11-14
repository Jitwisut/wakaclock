'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  type Group,
  type InstancedMesh,
  type LineBasicMaterial,
  type MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';

import {
  type ActivitySlice,
  MINUTES_PER_DAY,
  seededRandom,
  SLICE_MINUTES,
  type SliceKind,
} from '../time-data';
import { TUNNEL_DAY_LENGTH, TUNNEL_START, tunnelVisibility } from '../time-keyframes';
import { getTimeUi, timeMotion } from '../time-store';

import { MATERIALS, SCENE } from './scene-palette';

const TAU = Math.PI * 2;
const dummy = new Object3D();
const RADIUS = 3.6;
const RIB_SPACING = 4;
const KIND_COLOR: Record<SliceKind, Color> = {
  human: new Color(SCENE.human),
  ai: new Color(SCENE.ai),
  unattributed: new Color(SCENE.unattributed).multiplyScalar(1.6),
};
const FLASH = new Color(SCENE.highlight);
const scratch = new Color();
const UNIT: [number, number, number] = [1, 1, 1];

/** Depth of a moment in the tunnel: today nearest the core, earlier days further down. */
export function tunnelDepth(day: number, minute: number): number {
  return TUNNEL_START - (day + minute / MINUTES_PER_DAY) * TUNNEL_DAY_LENGTH;
}

interface Marker {
  kind: SliceKind;
  x: number;
  y: number;
  z: number;
}

/**
 * Turns the demo days into the tunnel's event markers. Heartbeats are small pulses on the
 * walls, sessions larger nodes nearer the axis, and the end of most sessions a vertical
 * pillar standing for a commit. All illustrative, and labelled as demo data on the page.
 */
export function buildTunnelEvents(slices: readonly ActivitySlice[], maxPulses: number) {
  const random = seededRandom(9090);
  const pulses: Marker[] = [];
  const sessions: Marker[] = [];
  const commits: Marker[] = [];
  const every = Math.max(1, Math.ceil(slices.length / maxPulses));
  let previous: ActivitySlice | undefined;
  let sessionStart: ActivitySlice | undefined;
  const counts: Record<SliceKind, number> = { ai: 0, human: 0, unattributed: 0 };

  const closeSession = (last: ActivitySlice) => {
    if (!sessionStart) return;
    const kind = (Object.entries(counts) as [SliceKind, number][]).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] as SliceKind;
    const angle = lane(sessionStart.project);
    sessions.push({
      kind,
      x: Math.cos(angle) * RADIUS * 0.45,
      y: Math.sin(angle) * RADIUS * 0.45,
      z: tunnelDepth(sessionStart.day, sessionStart.minute),
    });
    if (random() < 0.7) {
      const side = angle + Math.PI * 0.18;
      commits.push({
        kind,
        x: Math.cos(side) * RADIUS * 0.8,
        y: Math.sin(side) * RADIUS * 0.8,
        z: tunnelDepth(last.day, last.minute + SLICE_MINUTES),
      });
    }
    counts.ai = 0;
    counts.human = 0;
    counts.unattributed = 0;
  };

  for (const [index, slice] of slices.entries()) {
    const continues =
      previous &&
      previous.day === slice.day &&
      previous.project === slice.project &&
      previous.minute + SLICE_MINUTES === slice.minute;
    if (!continues) {
      if (previous) closeSession(previous);
      sessionStart = slice;
    }
    counts[slice.kind] += 1;
    if (index % every === 0) {
      const angle = lane(slice.project) + (random() - 0.5) * 0.9;
      const r = RADIUS * (0.86 + random() * 0.08);
      pulses.push({
        kind: slice.kind,
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        z: tunnelDepth(slice.day, slice.minute),
      });
    }
    previous = slice;
  }
  if (previous) closeSession(previous);
  return { pulses, sessions, commits };
}

/** The angle of a demo project's lane around the tunnel. */
function lane(project: number) {
  return (project / 4) * TAU + 0.4;
}

/** 0 → 1 as a marker comes up ahead of the camera, peaking just before it passes. */
function activation(markerZ: number, cameraZ: number) {
  const ahead = cameraZ - markerZ;
  if (ahead < -2) return 0.25;
  if (ahead > 26) return 0.12;
  if (ahead < 0) return 0.25 + (1 + ahead / 2) * 0.75;
  return Math.max(0.12, 1 - ahead / 26);
}

function Markers({
  geometry,
  markers,
  scale,
}: {
  geometry: BufferGeometry;
  markers: Marker[];
  scale: [number, number, number];
}) {
  const mesh = useRef<InstancedMesh>(null);
  useEffect(() => {
    const instance = mesh.current;
    if (!instance) return;
    for (const [index, marker] of markers.entries()) {
      dummy.position.set(marker.x, marker.y, marker.z);
      // Pillars stand upright: commits read as vertical energy, whatever wall they are on.
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(...scale);
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
      instance.setColorAt(index, KIND_COLOR[marker.kind]);
    }
    instance.instanceMatrix.needsUpdate = true;
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
  }, [markers, scale]);

  useFrame(({ camera }) => {
    const instance = mesh.current;
    if (!instance || tunnelVisibility(timeMotion.current) <= 0.01) return;
    const { focus } = getTimeUi();
    for (const [index, marker] of markers.entries()) {
      const a = activation(marker.z, camera.position.z);
      scratch.copy(KIND_COLOR[marker.kind]).multiplyScalar(a * 1.4);
      if (a > 0.9) scratch.lerp(FLASH, (a - 0.9) * 4);
      if (focus !== 'all' && focus !== marker.kind) scratch.multiplyScalar(0.2);
      instance.setColorAt(index, scratch);
    }
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
  });

  if (markers.length === 0) return null;
  return (
    <instancedMesh args={[geometry, undefined, markers.length]} frustumCulled={false} ref={mesh}>
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** The corridor's structure: octagonal ribs, four long rails and a lit ring per day. */
function Structure({ days }: { days: number }) {
  const ribs = useRef<InstancedMesh>(null);
  const length = days * TUNNEL_DAY_LENGTH + 8;
  const ribCount = Math.ceil(length / RIB_SPACING);
  const rib = useMemo(() => new TorusGeometry(RADIUS + 0.35, 0.035, 4, 8), []);
  const rails = useMemo(() => {
    const positions: number[] = [];
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * TAU + TAU / 16;
      const x = Math.cos(angle) * (RADIUS + 0.33);
      const y = Math.sin(angle) * (RADIUS + 0.33);
      positions.push(x, y, TUNNEL_START + 4, x, y, TUNNEL_START - length);
    }
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    return buffer;
  }, [length]);
  const dayRings = useMemo(() => {
    const positions: number[] = [];
    for (let day = 0; day <= days; day += 1) {
      const z = tunnelDepth(day, 0);
      for (let index = 0; index < 64; index += 1) {
        const a = (index / 64) * TAU;
        const b = ((index + 1) / 64) * TAU;
        positions.push(Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, z);
        positions.push(Math.cos(b) * RADIUS, Math.sin(b) * RADIUS, z);
      }
    }
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    return buffer;
  }, [days]);
  const railMaterial = useRef<LineBasicMaterial>(null);
  const dayMaterial = useRef<LineBasicMaterial>(null);
  const ribMaterial = useRef<MeshStandardMaterial>(null);

  useEffect(() => {
    const instance = ribs.current;
    if (!instance) return;
    for (let index = 0; index < ribCount; index += 1) {
      dummy.position.set(0, 0, TUNNEL_START - index * RIB_SPACING);
      dummy.rotation.set(0, 0, TAU / 16);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
    }
    instance.instanceMatrix.needsUpdate = true;
  }, [ribCount]);
  useEffect(
    () => () => {
      rib.dispose();
      rails.dispose();
      dayRings.dispose();
    },
    [dayRings, rails, rib]
  );
  useFrame(() => {
    const v = tunnelVisibility(timeMotion.current);
    if (railMaterial.current) railMaterial.current.opacity = v * 0.16;
    if (dayMaterial.current) dayMaterial.current.opacity = v * 0.4;
    if (ribMaterial.current) ribMaterial.current.opacity = v;
  });
  return (
    <>
      <instancedMesh args={[rib, undefined, ribCount]} frustumCulled={false} ref={ribs}>
        <meshStandardMaterial
          color={MATERIALS.aluminium}
          envMapIntensity={0.9}
          metalness={0.9}
          ref={ribMaterial}
          roughness={0.4}
          transparent
        />
      </instancedMesh>
      <lineSegments geometry={rails}>
        <lineBasicMaterial color={SCENE.ink} opacity={0} ref={railMaterial} transparent />
      </lineSegments>
      <lineSegments geometry={dayRings}>
        <lineBasicMaterial
          blending={AdditiveBlending}
          color={SCENE.human}
          depthWrite={false}
          opacity={0}
          ref={dayMaterial}
          toneMapped={false}
          transparent
        />
      </lineSegments>
    </>
  );
}

/**
 * The Flow of Time: a corridor running back from the core in which each demo day's
 * activity stands as event markers — pulses for heartbeats, nodes for sessions, pillars for
 * commits. Markers ahead of the camera light up as their moment is reached.
 */
export function TimeTunnel({
  days,
  maxPulses,
  slices,
}: {
  days: number;
  maxPulses: number;
  slices: ActivitySlice[];
}) {
  const group = useRef<Group>(null);
  const events = useMemo(() => buildTunnelEvents(slices, maxPulses), [maxPulses, slices]);
  const geometries = useMemo(
    () => ({
      pulse: new SphereGeometry(0.04, 8, 6),
      node: new OctahedronGeometry(0.12, 0),
      pillar: new BoxGeometry(0.035, 1.5, 0.035),
    }),
    []
  );
  useEffect(
    () => () => {
      for (const geometry of Object.values(geometries)) geometry.dispose();
    },
    [geometries]
  );
  useFrame(() => {
    if (group.current) group.current.visible = tunnelVisibility(timeMotion.current) > 0.01;
  });
  return (
    <group ref={group}>
      <Structure days={days} />
      <Markers geometry={geometries.pulse} markers={events.pulses} scale={UNIT} />
      <Markers geometry={geometries.node} markers={events.sessions} scale={UNIT} />
      <Markers geometry={geometries.pillar} markers={events.commits} scale={UNIT} />
    </group>
  );
}
