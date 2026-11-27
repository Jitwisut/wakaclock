'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  type Group,
  IcosahedronGeometry,
  type InstancedMesh,
  type Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  type Points,
  type PointsMaterial,
  RepeatWrapping,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { dotTexture } from '../scene/heartbeats';
import { seededRandom } from '../time-data';
import { timeMotion } from '../time-store';
import { voyage } from '../voyage/state';

import { type Anchors } from './buildings';
import { eveningLevel } from './desk';
import { GUTTER_RIGHT, ISLAND_TOP, LANDMARK_X, stopBase } from './file-plan';
import { ISLAND_DEPTH, ISLAND_RADIUS, type IslandPlan } from './island';
import { cone, finish, lump, post, rod, solid } from './model-kit';

/**
 * The sky round each floating island (owner 2026-11-27, after a reference of sky islands):
 * a pond's waterfall spilling off the rim into a bank of cotton-wool clouds with mist and a
 * faint rainbow, little islets drifting nearby with lanterns hung on chains, birds circling
 * the island the tour is at, fireflies and lit windows as the evening falls, smoke from the
 * chimneys. Still a model on a desk: the clouds are cotton wool, the water is resin, nothing
 * is neon and nothing adds light — the lamp and the evening do the lighting.
 */

/** How far below the grass the cloud bank sits, round the island's rock and its rod (m). */
const CLOUD_DEPTH = ISLAND_DEPTH - 3.5;
/** How far the falling water drops before it vanishes into the clouds (m). */
const FALL = ISLAND_DEPTH - 2.5;
/** The arriving camera's direction on the island (radians from +x toward +z). */
const TOWARD_CAMERA = 1.2;
/** The island's turn in the world (see Landmarks): its +x points this far from the file. */
const ISLAND_TURN = 0.5;

/** Whether a direction on the island points into the file (world +x): clouds keep off it. */
export function overFile(angle: number) {
  return Math.cos(angle - ISLAND_TURN) > 0.35;
}

/** Whether a point on the island (local x, z) lies over the file or its line numbers. */
export function overCode(x: number, z: number) {
  const worldX = LANDMARK_X + x * Math.cos(ISLAND_TURN) + z * Math.sin(ISLAND_TURN);
  return worldX > GUTTER_RIGHT - 4;
}

/* ---------- shared materials ---------- */

/** Streaks of falling water: a tall tile of soft vertical stripes, scrolled every frame. */
function streakTexture() {
  const width = 32;
  const height = 128;
  const data = new Uint8Array(width * height * 4);
  const random = seededRandom(23);
  const columns = Array.from({ length: width }, () => 0.35 + random() * 0.65);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const wave = 0.5 + 0.5 * Math.sin((y / height) * Math.PI * 2 * (2 + (x % 3)) + x);
      const value = Math.round(255 * Math.min(1, (columns[x] as number) * (0.55 + 0.45 * wave)));
      data.set([value, value, value, 255], (y * width + x) * 4);
    }
  }
  const texture = new DataTexture(data, width, height);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export interface SkyMaterials {
  cloud: MeshStandardMaterial;
  fall: MeshBasicMaterial;
  glow: MeshStandardMaterial;
  rainbow: MeshBasicMaterial;
  streaks: DataTexture;
  water: MeshStandardMaterial;
}

export function makeSkyMaterials(): SkyMaterials {
  const streaks = streakTexture();
  return {
    streaks,
    // Cotton wool: pale, matte and a little self-lit, so it stays soft white in lamplight.
    cloud: new MeshStandardMaterial({
      color: '#f3ede4',
      emissive: '#4a4036',
      emissiveIntensity: 0.55,
      metalness: 0,
      roughness: 1,
    }),
    fall: new MeshBasicMaterial({
      alphaMap: streaks,
      color: '#c9dcdc',
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
      vertexColors: true,
    }),
    glow: new MeshStandardMaterial({
      color: '#3a3328',
      emissive: '#f2b56a',
      emissiveIntensity: 0.15,
      roughness: 0.6,
    }),
    rainbow: new MeshBasicMaterial({
      depthWrite: false,
      opacity: 0.2,
      side: DoubleSide,
      transparent: true,
      vertexColors: true,
    }),
    water: new MeshStandardMaterial({
      color: '#4f7d86',
      metalness: 0.15,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      roughness: 0.12,
    }),
  };
}

/** Runs once per frame for all islands: the water's streaks fall, the lights follow the day. */
export function SkyClock({ materials }: { materials: SkyMaterials }) {
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    materials.streaks.offset.y += delta * 0.55;
    const evening = eveningLevel();
    materials.glow.emissiveIntensity = 0.15 + 1.7 * evening;
    // A rainbow wants daylight: it fades as the evening comes.
    materials.rainbow.opacity = 0.2 * (1 - evening);
  });
  return null;
}

/* ---------- the waterfall ---------- */

/**
 * The falling water as a ribbon off the lip: it leaves the rim, bows outward and drops into
 * the cloud bank, widening as it falls. Its alpha (vertex colour .a) fades at the edges and
 * at the bottom, where the mist takes over.
 */
export function buildFall(plan: IslandPlan): BufferGeometry {
  const rows = 24;
  const ribbon = new PlaneGeometry(1, 1, 4, rows);
  const position = ribbon.getAttribute('position');
  const colours = new Float32Array(position.count * 4);
  const { angle } = plan.waterfall;
  const out = { x: Math.cos(angle), z: Math.sin(angle) };
  const side = { x: -out.z, z: out.x };
  for (let index = 0; index < position.count; index += 1) {
    const across = position.getX(index); // −0.5 … 0.5
    const t = 0.5 - position.getY(index); // 0 at the lip, 1 at the bottom
    const width = 1.2 + 1.6 * t;
    const reach = ISLAND_RADIUS + 0.4 + 2.2 * Math.sqrt(t) - 0.6 * t;
    const x = out.x * reach + side.x * across * width;
    const z = out.z * reach + side.z * across * width;
    position.setXYZ(index, x, ISLAND_TOP + 0.15 - t * FALL, z);
    const edge = 1 - Math.abs(across) * 1.6;
    const alpha = Math.max(0, edge) * (t > 0.75 ? (1 - t) / 0.25 : 1) * 0.85;
    colours.set([1, 1, 1, alpha], index * 4);
  }
  ribbon.setAttribute('color', new Float32BufferAttribute(colours, 4));
  ribbon.computeVertexNormals();
  return ribbon;
}

/** Foam at the lip and spray where the water meets the clouds, as one small lumpy mesh. */
function buildFoam(plan: IslandPlan, seed: number) {
  const random = seededRandom(seed);
  const { angle } = plan.waterfall;
  const parts: BufferGeometry[] = [];
  for (let index = 0; index < 5; index += 1) {
    const reach = ISLAND_RADIUS + 0.2 + random() * 0.6;
    const spread = angle + (random() - 0.5) * 0.12;
    parts.push(
      lump(
        0.35 + random() * 0.25,
        [Math.cos(spread) * reach, ISLAND_TOP + 0.25, Math.sin(spread) * reach],
        '#e6ecea',
        0.6
      )
    );
  }
  const merged = mergeGeometries(parts, false) as BufferGeometry;
  for (const part of parts) part.dispose();
  return merged;
}

/** Spray sprites where the fall meets the cloud bank. */
function mistGeometry(plan: IslandPlan, count: number) {
  const random = seededRandom(Math.round(plan.phase * 1000));
  const { angle } = plan.waterfall;
  const reach = ISLAND_RADIUS + 1.8;
  const position = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const spread = angle + (random() - 0.5) * 0.25;
    position.set(
      [
        Math.cos(spread) * (reach + random() * 2),
        ISLAND_TOP - FALL * (0.7 + random() * 0.3),
        Math.sin(spread) * (reach + random() * 2),
      ],
      index * 3
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  return geometry;
}

/** Five thin bands, red to violet, arched over the waterfall's spray and facing the camera. */
export function buildRainbow(plan: IslandPlan) {
  const bands = ['#c97a6a', '#cda36a', '#b9b977', '#7fa58f', '#7d86b0'];
  const parts = bands.map((hex, index) => {
    const arc = new TorusGeometry(4.4 - index * 0.28, 0.13, 4, 28, Math.PI);
    const colour = new Color(hex);
    const position = arc.getAttribute('position');
    const colours = new Float32Array(position.count * 4);
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      // Faint at its feet, fullest at the top of the arch.
      const up = Math.max(0, position.getY(vertex)) / 4.4;
      colours.set([colour.r, colour.g, colour.b, 0.3 + 0.7 * up], vertex * 4);
    }
    arc.setAttribute('color', new Float32BufferAttribute(colours, 4));
    return arc;
  });
  const merged = mergeGeometries(parts, false) as BufferGeometry;
  for (const part of parts) part.dispose();
  const { angle } = plan.waterfall;
  const reach = ISLAND_RADIUS + 3;
  // Arch faces the arriving camera, its feet in the spray.
  merged.rotateY(Math.PI / 2 - TOWARD_CAMERA);
  merged.translate(Math.cos(angle) * reach, ISLAND_TOP - FALL * 0.75, Math.sin(angle) * reach);
  return merged;
}

/* ---------- the cloud bank ---------- */

/** A cotton-wool cloud: a big round puff with smaller ones heaped round it, flat underneath. */
function heap(
  puffs: { at: [number, number, number]; size: [number, number, number] }[],
  centre: [number, number, number],
  size: number,
  random: () => number
) {
  const turn = random() * Math.PI * 2;
  const pieces = [
    [0, 0.25, 0, 1.15],
    [0.95, 0, 0.15, 0.8],
    [-0.9, 0.02, -0.1, 0.78],
    [0.3, -0.05, 0.75, 0.7],
    [-0.35, 0.05, -0.75, 0.65],
  ] as const;
  for (const [x, y, z, scale] of pieces) {
    const r = size * scale * (0.85 + random() * 0.3);
    const ax = x * Math.cos(turn) - z * Math.sin(turn);
    const az = x * Math.sin(turn) + z * Math.cos(turn);
    if (overCode(centre[0] + ax * size, centre[2] + az * size)) continue;
    puffs.push({
      at: [centre[0] + ax * size, centre[1] + y * size, centre[2] + az * size],
      size: [r, r * 0.72, r],
    });
  }
}

/** Cotton-wool clouds round one island's rock and rod, and a few higher ones beside it. */
export function cloudPuffs(seed: number, detail: number) {
  const random = seededRandom(seed * 5 + 9);
  const puffs: { at: [number, number, number]; size: [number, number, number] }[] = [];
  const low = Math.round(4 + 6 * detail);
  for (let index = 0; index < low; index += 1) {
    const angle = (index / low) * Math.PI * 2 + random() * 0.5;
    if (overFile(angle)) continue;
    const reach = 5 + random() * (ISLAND_RADIUS - 2);
    heap(
      puffs,
      [Math.cos(angle) * reach, ISLAND_TOP - CLOUD_DEPTH - random() * 2, Math.sin(angle) * reach],
      2 + random() * 1.6,
      random
    );
  }
  const high = Math.round(1 + 2 * detail);
  for (let index = 0; index < high; index += 1) {
    const angle = Math.PI * (0.9 + random() * 1.4);
    if (overFile(angle)) continue;
    const reach = ISLAND_RADIUS + 8 + random() * 10;
    heap(
      puffs,
      [Math.cos(angle) * reach, ISLAND_TOP + 5 + random() * 12, Math.sin(angle) * reach],
      1.4 + random() * 1.2,
      random
    );
  }
  return puffs;
}

const dummy = new Object3D();

function CloudBank({
  detail,
  material,
  seed,
}: {
  detail: number;
  material: MeshStandardMaterial;
  seed: number;
}) {
  const puffs = useMemo(() => cloudPuffs(seed, detail), [detail, seed]);
  // Rounder puffs where the device can afford them.
  const geometry = useMemo(() => new IcosahedronGeometry(1, detail >= 1 ? 2 : 1), [detail]);
  const bank = useRef<InstancedMesh>(null);
  const drift = useRef<Group>(null);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const mesh = bank.current;
    if (!mesh) return;
    for (const [index, puff] of puffs.entries()) {
      dummy.position.set(...puff.at);
      dummy.scale.set(...puff.size);
      dummy.rotation.set(0, index, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [puffs]);
  useFrame(() => {
    const group = drift.current;
    if (!group) return;
    group.rotation.y = Math.sin(voyage.time * 0.05 + seed) * 0.12;
    group.position.y = Math.sin(voyage.time * 0.3 + seed) * 0.25;
  });
  return (
    <group ref={drift}>
      <instancedMesh args={[geometry, material, puffs.length]} receiveShadow ref={bank} />
    </group>
  );
}

/* ---------- islets with lanterns ---------- */

export interface Islet {
  at: [number, number, number];
  hut: boolean;
  lantern: boolean;
  size: number;
}

export function isletPlan(seed: number, detail: number): Islet[] {
  const random = seededRandom(seed * 11 + 5);
  const count = Math.round(1 + 3 * detail);
  const islets: Islet[] = [];
  for (let index = 0; index < count * 3 && islets.length < count; index += 1) {
    const angle = Math.PI * (0.7 + random() * 1.6);
    if (overFile(angle)) continue;
    const reach = ISLAND_RADIUS + 5 + random() * 7;
    if (overCode(Math.cos(angle) * (reach + 3), Math.sin(angle) * (reach + 3))) continue;
    islets.push({
      at: [Math.cos(angle) * reach, ISLAND_TOP + 1 + random() * 9, Math.sin(angle) * reach],
      size: 1.4 + random() * 1.6,
      hut: random() > 0.55,
      lantern: random() > 0.25,
    });
  }
  return islets;
}

/** One small floating rock: a grassy cap, a rock cone, a tree or a hut, maybe a lantern. */
function buildIslet(islet: Islet, seed: number) {
  const random = seededRandom(seed);
  const body: BufferGeometry[] = [];
  const glow: BufferGeometry[] = [];
  const s = islet.size;
  body.push(post(s, s * 0.9, 0.5 * s, [0, -0.5 * s, 0], '#55705a', 9));
  const rock = cone(s * 0.85, s * 2.2, [0, 0, 0], '#4e5363', 8);
  rock.rotateX(Math.PI);
  rock.translate(0, -0.45 * s, 0);
  body.push(rock);
  if (islet.hut) {
    body.push(post(0.45 * s, 0.5 * s, 0.6 * s, [0, 0, 0], '#cdbf9f', 6));
    body.push(cone(0.65 * s, 0.6 * s, [0, 0.6 * s, 0], '#8a4f3c', 6));
  } else {
    body.push(post(0.08 * s, 0.12 * s, 0.6 * s, [0.2, 0, 0], '#4a3628', 5));
    body.push(lump(0.5 * s, [0.2, 0.9 * s, 0], '#3f5d48', 1.1));
  }
  if (islet.lantern) {
    const length = 2 + random() * 2.5;
    const bottom = -0.45 * s - 2.2 * s * 0.6;
    // A chain of links, then the lantern.
    for (let link = 0; link < 4; link += 1) {
      const y0 = bottom - (link / 4) * length;
      const y1 = bottom - ((link + 1) / 4) * length + 0.05;
      body.push(rod([0, y0, 0], [0, y1, 0], 0.04, '#4b4540'));
    }
    const y = bottom - length;
    body.push(cone(0.28, 0.25, [0, y - 0.05, 0], '#4b4540', 6));
    glow.push(post(0.2, 0.22, 0.42, [0, y - 0.5, 0], '#f2c27a', 6));
  }
  for (const part of [...body, ...glow]) part.translate(...islet.at);
  return { body, glow };
}

function Islets({
  detail,
  glow,
  ground,
  seed,
}: {
  detail: number;
  glow: MeshStandardMaterial;
  ground: MeshStandardMaterial;
  seed: number;
}) {
  const geometry = useMemo(() => {
    const islets = isletPlan(seed, detail);
    const body: BufferGeometry[] = [];
    const lights: BufferGeometry[] = [];
    for (const [index, islet] of islets.entries()) {
      const built = buildIslet(islet, seed * 31 + index);
      body.push(...built.body);
      lights.push(...built.glow);
    }
    const merge = (parts: BufferGeometry[]) => {
      if (parts.length === 0) return null;
      const merged = mergeGeometries(parts, false) as BufferGeometry;
      for (const part of parts) part.dispose();
      return merged;
    };
    return { body: merge(body), glow: merge(lights) };
  }, [detail, seed]);
  useEffect(
    () => () => {
      geometry.body?.dispose();
      geometry.glow?.dispose();
    },
    [geometry]
  );
  const float = useRef<Group>(null);
  useFrame(() => {
    const group = float.current;
    if (!group) return;
    group.position.y = Math.sin(voyage.time * 0.42 + seed * 0.7) * 0.6;
    group.rotation.y = Math.sin(voyage.time * 0.07 + seed) * 0.05;
  });
  return (
    <group ref={float}>
      {geometry.body ? <mesh geometry={geometry.body} material={ground} /> : null}
      {geometry.glow ? <mesh geometry={geometry.glow} material={glow} /> : null}
    </group>
  );
}

/* ---------- small moving things ---------- */

/** A points geometry that starts at fixed homes (the frame loop moves them round them). */
function usePointSwarm(homes: Float32Array) {
  return useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(homes), 3));
    return geometry;
  }, [homes]);
}

/** Fireflies over the island's woods: they come out as the evening falls. */
function Fireflies({ count, seed, stop }: { count: number; seed: number; stop: number }) {
  const homes = useMemo(() => {
    const random = seededRandom(seed * 13 + 1);
    const array = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * (0.9 + random() * 1.5);
      const reach = 11 + random() * (ISLAND_RADIUS - 12);
      array.set(
        [Math.cos(angle) * reach, ISLAND_TOP + 0.6 + random() * 3, Math.sin(angle) * reach],
        index * 3
      );
    }
    return array;
  }, [count, seed]);
  const geometry = usePointSwarm(homes);
  const map = useMemo(() => dotTexture(), []);
  const points = useRef<Points>(null);
  const material = useRef<PointsMaterial>(null);
  useEffect(
    () => () => {
      geometry.dispose();
      map.dispose();
    },
    [geometry, map]
  );
  useFrame(() => {
    const evening = eveningLevel();
    if (material.current) material.current.opacity = 0.85 * evening;
    const mesh = points.current;
    // Only the islands near the tour wander; the rest keep still (and cost nothing).
    if (!mesh || evening < 0.05 || Math.abs(timeMotion.tour - stop) > 1.5) return;
    const position = mesh.geometry.getAttribute('position');
    const t = voyage.time;
    for (let index = 0; index < count; index += 1) {
      const base = index * 3;
      position.setXYZ(
        index,
        (homes[base] as number) + Math.sin(t * 0.7 + index * 1.7) * 0.8,
        (homes[base + 1] as number) + Math.sin(t * 1.1 + index) * 0.4,
        (homes[base + 2] as number) + Math.cos(t * 0.6 + index * 2.3) * 0.8
      );
    }
    position.needsUpdate = true;
  });
  return (
    <points frustumCulled={false} geometry={geometry} ref={points}>
      <pointsMaterial
        color="#e9e2a3"
        depthWrite={false}
        map={map}
        opacity={0}
        ref={material}
        size={0.55}
        transparent
      />
    </points>
  );
}

/** Smoke curling up from each chimney: a few soft puffs that rise, swell and fade. */
function Smoke({
  chimneys,
  stop,
}: {
  chimneys: readonly [number, number, number][];
  stop: number;
}) {
  const per = 6;
  const homes = useMemo(() => {
    const array = new Float32Array(chimneys.length * per * 3);
    for (const [index, at] of chimneys.entries()) {
      for (let puff = 0; puff < per; puff += 1) array.set(at, (index * per + puff) * 3);
    }
    return array;
  }, [chimneys]);
  const geometry = usePointSwarm(homes);
  const map = useMemo(() => dotTexture(), []);
  const points = useRef<Points>(null);
  useEffect(
    () => () => {
      geometry.dispose();
      map.dispose();
    },
    [geometry, map]
  );
  useFrame(() => {
    const mesh = points.current;
    if (!mesh || Math.abs(timeMotion.tour - stop) > 1.5) return;
    const position = mesh.geometry.getAttribute('position');
    const t = voyage.time;
    for (let index = 0; index < chimneys.length * per; index += 1) {
      const age = (t * 0.25 + (index % per) / per) % 1;
      const base = index * 3;
      position.setXYZ(
        index,
        (homes[base] as number) + Math.sin(index + age * 3) * age * 0.9,
        (homes[base + 1] as number) + age * 4,
        (homes[base + 2] as number) + age * 1.2
      );
    }
    position.needsUpdate = true;
  });
  if (chimneys.length === 0) return null;
  return (
    <points frustumCulled={false} geometry={geometry} ref={points}>
      <pointsMaterial
        color="#b9b1a6"
        depthWrite={false}
        map={map}
        opacity={0.32}
        size={1.5}
        transparent
      />
    </points>
  );
}

/** The clock tower's hands: they show the demo day's time the readout shows. */
function ClockHands({ clock }: { clock: NonNullable<Anchors['clock']> }) {
  const hour = useRef<Mesh>(null);
  const minute = useRef<Mesh>(null);
  useFrame(() => {
    const minutes = timeMotion.hand;
    if (minute.current) minute.current.rotation.z = -((minutes % 60) / 60) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -(((minutes / 60) % 12) / 12) * Math.PI * 2;
  });
  return (
    <group position={clock.at} rotation={[0, clock.facing, 0]}>
      <mesh ref={hour}>
        <boxGeometry args={[0.14, 0.7, 0.05]} />
        <meshStandardMaterial color="#2c2a28" />
      </mesh>
      <mesh position={[0, 0, 0.03]} ref={minute}>
        <boxGeometry args={[0.09, 1.05, 0.05]} />
        <meshStandardMaterial color="#2c2a28" />
      </mesh>
    </group>
  );
}

/** A lantern's slow sweep (the lighthouse) or blink (the signal mast, twin lights). */
function Beacons({
  lights,
  sweep,
}: {
  lights: readonly [number, number, number][];
  sweep: boolean;
}) {
  const beam = useRef<Group>(null);
  const halos = useRef<Group>(null);
  const geometry = useMemo(() => {
    const shape = new ConeGeometry(2.2, 16, 16, 1, true);
    shape.rotateZ(Math.PI / 2);
    shape.translate(8, 0, 0);
    return shape;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const evening = eveningLevel();
    if (beam.current) {
      beam.current.rotation.y = voyage.time * 0.6;
      const material = (beam.current.children[0] as Mesh | undefined)?.material as
        | MeshBasicMaterial
        | undefined;
      if (material) material.opacity = 0.1 * evening;
    }
    if (halos.current) {
      const on = 0.5 + 0.5 * Math.sin(voyage.time * 2.4);
      for (const child of halos.current.children) child.scale.setScalar(0.6 + 0.5 * on * evening);
    }
  });
  const first = lights[0];
  return (
    <>
      {sweep && first ? (
        <group position={first} ref={beam}>
          <mesh geometry={geometry}>
            <meshBasicMaterial
              color="#f2d39a"
              depthWrite={false}
              opacity={0}
              side={DoubleSide}
              transparent
            />
          </mesh>
        </group>
      ) : null}
      {sweep ? null : (
        <group ref={halos}>
          {lights.map((at) => (
            <mesh key={at.join(',')} position={at}>
              <sphereGeometry args={[0.55, 10, 8]} />
              <meshStandardMaterial color="#3a3328" emissive="#f2b56a" emissiveIntensity={1.4} />
            </mesh>
          ))}
        </group>
      )}
    </>
  );
}

/* ---------- one island's sky ---------- */

export function IslandSky({
  anchors,
  detail,
  ground,
  id,
  materials,
  plan,
  seed,
  stop,
}: {
  anchors: Anchors;
  detail: number;
  ground: MeshStandardMaterial;
  id: string;
  materials: SkyMaterials;
  plan: IslandPlan;
  seed: number;
  stop: number;
}) {
  const shapes = useMemo(() => {
    const rainbow = seed % 3 === 0 && detail > 0.5 ? buildRainbow(plan) : null;
    return {
      fall: buildFall(plan),
      foam: buildFoam(plan, seed),
      mist: mistGeometry(plan, Math.round(6 + 8 * detail)),
      rainbow,
    };
  }, [detail, plan, seed]);
  const map = useMemo(() => dotTexture(), []);
  useEffect(
    () => () => {
      shapes.fall.dispose();
      shapes.foam.dispose();
      shapes.mist.dispose();
      shapes.rainbow?.dispose();
      map.dispose();
    },
    [map, shapes]
  );
  const mist = useRef<PointsMaterial>(null);
  useFrame(() => {
    if (mist.current) mist.current.opacity = 0.32 + 0.08 * Math.sin(voyage.time * 1.3 + seed);
  });
  const fireflies = Math.round(8 + 14 * detail);
  return (
    <>
      <mesh geometry={shapes.fall} material={materials.fall} renderOrder={2} />
      <mesh geometry={shapes.foam} material={ground} />
      <points frustumCulled={false} geometry={shapes.mist}>
        <pointsMaterial
          color="#e2e8e6"
          depthWrite={false}
          map={map}
          opacity={0.35}
          ref={mist}
          size={5}
          transparent
        />
      </points>
      {shapes.rainbow ? (
        <mesh geometry={shapes.rainbow} material={materials.rainbow} renderOrder={3} />
      ) : null}
      <CloudBank detail={detail} material={materials.cloud} seed={seed} />
      <Islets detail={detail} glow={materials.glow} ground={ground} seed={seed} />
      <Fireflies count={fireflies} seed={seed} stop={stop} />
      <Smoke chimneys={anchors.smoke} stop={stop} />
      {anchors.clock ? <ClockHands clock={anchors.clock} /> : null}
      {anchors.lights.length > 0 ? (
        <Beacons lights={anchors.lights} sweep={id === 'lighthouse'} />
      ) : null}
    </>
  );
}

/* ---------- birds ---------- */

/** A bird in flight: two wing panels in a shallow V, built once and instanced. */
/** One wing: flat on the air, then tipped up from the body into a shallow V. */
function wing(sign: number) {
  const panel = new PlaneGeometry(1.1, 0.32);
  panel.rotateX(-Math.PI / 2);
  panel.translate(0.55 * sign, 0, 0);
  panel.rotateZ(0.25 * sign);
  return panel;
}

function birdGeometry() {
  const body = mergeGeometries([wing(1), wing(-1)], false) as BufferGeometry;
  return finish(body, solid('#2b2a2e'));
}

/**
 * A few small flocks wheeling round the island the tour is at: they follow the visit from
 * island to island. Dark silhouettes, so they read against the clouds and the evening alike.
 */
export function Birds({ count }: { count: number }) {
  const geometry = useMemo(() => birdGeometry(), []);
  const material = useMemo(
    () => new MeshBasicMaterial({ side: DoubleSide, vertexColors: true }),
    []
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  const flock = useRef<InstancedMesh>(null);
  const centre = useRef<[number, number, number]>([0, 0, 0]);
  const birds = useMemo(() => {
    const random = seededRandom(91);
    return Array.from({ length: count }, (_, index) => ({
      flock: index % 3,
      offset: [random() * 3 - 1.5, random() * 1.6, random() * 3 - 1.5] as const,
      phase: random() * 6.28,
    }));
  }, [count]);
  useFrame((_, rawDelta) => {
    const mesh = flock.current;
    if (!mesh) return;
    const stop = Math.min(10, Math.max(1, Math.round(timeMotion.tour) || 1));
    const [x, y, z] = stopBase(stop);
    const target = centre.current;
    const ease = Math.min(1, Math.min(rawDelta, 0.1) * 0.6);
    target[0] += (x - target[0]) * ease;
    target[1] += (y - target[1]) * ease;
    target[2] += (z - target[2]) * ease;
    const t = voyage.time;
    for (const [index, bird] of birds.entries()) {
      const radius = 26 + bird.flock * 5;
      const speed = 0.16 + bird.flock * 0.03;
      const around = t * speed * (bird.flock === 1 ? -1 : 1) + bird.flock * 2.1;
      dummy.position.set(
        target[0] + Math.cos(around) * radius + bird.offset[0],
        target[1] + 22 + bird.flock * 4 + bird.offset[1] + Math.sin(t * 0.8 + bird.phase) * 0.6,
        target[2] + Math.sin(around) * radius + bird.offset[2]
      );
      // Face along the circle; flap by folding the wings (y scale).
      dummy.rotation.set(0, -around + (bird.flock === 1 ? Math.PI : 0), 0);
      const flap = Math.sin(t * 9 + bird.phase);
      dummy.scale.set(1.2, 1 + flap * 0.9, 1.2);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh args={[geometry, material, count]} frustumCulled={false} ref={flock} />;
}
