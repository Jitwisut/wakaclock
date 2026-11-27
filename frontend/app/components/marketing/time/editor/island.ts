import { type BufferGeometry, CircleGeometry, Color, CylinderGeometry, PlaneGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { seededRandom } from '../time-data';

import { ISLAND_TOP } from './file-plan';
import { cone, finish, lump, post, rod, roughen, solid } from './model-kit';

/**
 * The floating island every landmark stands on. First built 2026-11-15 as a grassy cap over a
 * tapering rock; rebuilt 2026-11-27 (owner: bigger, far more detailed, like a sky island) —
 * 40% wider, with a cliff of stacked strata and hanging rock, roots and vines trailing from
 * the rim, a mix of trees, and a pond whose stream runs off the edge as a waterfall (the
 * falling water itself is drawn in sky.tsx). Still one mesh with vertex colours and flat
 * facets per island, in the site's muted dusk tones: nothing here glows.
 */

/** Radius of the island's grassy top (1.4 × the first build's 12.5). */
export const ISLAND_RADIUS = 17.5;
/** How far down the island's rock reaches below its grass (m): earth, then four strata. */
export const ISLAND_DEPTH = 3.5 + 3 + 3 + 2.8 + 2.6;

const GRASS = '#55705a';
const GRASS_EDGE = '#456049';
const EARTH = '#73573f';
const STRATA = ['#6f6c70', '#5d6170', '#4e5363', '#3c4150'] as const;
const ROCK_DEEP = '#2f333f';
const STONE = '#6a7080';
const MOSS = '#5c6e52';
const TRUNK = '#4a3628';
const ROOT = '#5b4632';
const VINE = '#3f5a43';
const LEAVES = ['#35513f', '#3f5d48', '#2f4838', '#4a6347'] as const;
/** One muted autumn tree here and there, so the greens are not all one note. */
const AUTUMN = '#86683f';
const WATER = '#4f7d86';

/** A smooth, repeatable wobble around the rim: the same angle always bends the same way. */
export function rimWobble(angle: number, phase: number) {
  return (
    0.5 * Math.sin(angle * 3 + phase) +
    0.3 * Math.sin(angle * 5 + phase * 1.7) +
    0.2 * Math.sin(angle * 9 + phase * 0.6)
  );
}

/** Pushes every rim vertex in or out by the wobble at its angle (centre vertices stay put). */
function wobble(geometry: BufferGeometry, amount: number, phase: number, ringPhase = 0) {
  const position = geometry.getAttribute('position');
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const radius = Math.hypot(x, z);
    if (radius < 1e-3) continue;
    const angle = Math.atan2(z, x);
    const y = position.getY(index);
    const scale = 1 + amount * rimWobble(angle, phase + y * ringPhase);
    position.setXYZ(index, x * scale, y, z * scale);
  }
  return geometry;
}

/** A point on the island's top at `angle` (radians round +y, from +x toward +z) and `radius`. */
function onTop(angle: number, radius: number, lift = 0): [number, number, number] {
  return [Math.cos(angle) * radius, ISLAND_TOP + lift, Math.sin(angle) * radius];
}

/** Smallest angle between two directions. */
function apart(a: number, b: number) {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(d, Math.PI * 2 - d);
}

export interface Slot {
  /** Around the island (radians, from +x toward +z: +z faces the arriving camera). */
  angle: number;
  radius: number;
}

/**
 * Where things go on one place's island. The camera arrives from +z (and a little +x); the
 * file lies toward +x. So the waterfall spills off the front-left, toward the camera and away
 * from the code; the place's own building stands to the chart's left as the camera sees it,
 * a little back, so the chart never hides it; cottages fill the back. The chart keeps the
 * middle.
 */
export interface IslandPlan {
  cottages: readonly Slot[];
  landmark: Slot;
  phase: number;
  /** The pond's centre on the grass, and the waterfall's lip on the rim. */
  pond: Slot;
  waterfall: Slot;
}

export function islandPlan(seed: number): IslandPlan {
  const random = seededRandom(seed * 7 + 1);
  const fall = 1.75 + random() * 0.5;
  // Left of the chart as the camera arrives (it looks in from about 1.2 rad), a little back.
  const back = 2.95 + random() * 0.3;
  return {
    phase: random() * 6.28,
    waterfall: { angle: fall, radius: ISLAND_RADIUS },
    pond: { angle: fall, radius: 13.4 },
    landmark: { angle: back, radius: 12.8 },
    cottages: [
      { angle: back + 0.95 + random() * 0.2, radius: 14.3 },
      { angle: back + 1.55 + random() * 0.2, radius: 13.6 },
      { angle: back + 2.3 + random() * 0.2, radius: 14.4 },
    ],
  };
}

/** Is `angle` clear of the plan's buildings and water (for trees and stones)? */
function clearOf(plan: IslandPlan, angle: number, radius: number) {
  if (apart(angle, plan.waterfall.angle) < 0.36) return false;
  if (apart(angle, plan.landmark.angle) < 0.42 && radius > 10.5) return false;
  return plan.cottages.every((slot) => apart(angle, slot.angle) > 0.28 || radius < 11);
}

/** One tree in one of four shapes, standing on `at`. */
function tree(parts: BufferGeometry[], at: [number, number, number], size: number, kind: number) {
  const [x, y, z] = at;
  const leaves = LEAVES[kind % LEAVES.length] as string;
  if (kind % 4 === 0) {
    // A pine: three tiers.
    parts.push(post(0.2 * size, 0.3 * size, 1.4 * size, at, TRUNK, 6));
    for (let tier = 0; tier < 3; tier += 1) {
      parts.push(
        cone(
          (1.5 - tier * 0.38) * size,
          1.5 * size,
          [x, y + (0.9 + tier * 0.75) * size, z],
          leaves,
          7
        )
      );
    }
  } else if (kind % 4 === 1) {
    // A broad tree: two or three canopy lumps.
    parts.push(post(0.18 * size, 0.28 * size, 1.9 * size, at, TRUNK, 6));
    parts.push(lump(1.25 * size, [x, y + 2.4 * size, z], leaves, 0.85));
    parts.push(lump(0.95 * size, [x + 0.7 * size, y + 2 * size, z + 0.3 * size], leaves, 0.9));
    parts.push(lump(0.8 * size, [x - 0.6 * size, y + 2.1 * size, z - 0.4 * size], leaves, 0.9));
  } else if (kind % 4 === 2) {
    // A cypress: one tall slim lump.
    parts.push(post(0.12 * size, 0.18 * size, 0.6 * size, at, TRUNK, 5));
    parts.push(lump(0.7 * size, [x, y + 2 * size, z], leaves, 2.4));
  } else {
    // A round autumn tree.
    parts.push(post(0.18 * size, 0.26 * size, 1.6 * size, at, TRUNK, 6));
    parts.push(lump(1.15 * size, [x, y + 2.2 * size, z], AUTUMN, 0.95));
  }
}

type Random = () => number;

/** The cliff: strata stepping inward with ledges, then a crooked spike, with hanging rock. */
function addCliff(
  parts: BufferGeometry[],
  random: Random,
  seed: number,
  phase: number,
  detail: number
) {
  const R = ISLAND_RADIUS;
  // Each tier overlaps the one above a little so the ledges never show a gap.
  const tiers = [
    { top: R - 2.1, bottom: R * 0.74, height: 3 },
    { top: R * 0.7, bottom: R * 0.48, height: 3 },
    { top: R * 0.46, bottom: R * 0.22, height: 2.8 },
    { top: R * 0.2, bottom: 0.5, height: 2.6 },
  ];
  const lean = (random() - 0.5) * 0.3;
  let y = ISLAND_TOP - 3.5;
  for (const [index, tier] of tiers.entries()) {
    const shape = new CylinderGeometry(tier.top, tier.bottom, tier.height + 0.3, 18, 3);
    wobble(shape, 0.16 + index * 0.03, phase + 1.1 + index, 0.3);
    roughen(shape, 0.55, seed + index * 17);
    const position = shape.getAttribute('position');
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const down = 0.5 - position.getY(vertex) / tier.height;
      position.setX(vertex, position.getX(vertex) + lean * (index + down) * 1.6);
    }
    shape.translate(0, y - tier.height / 2, 0);
    const upper = new Color(STRATA[index] as string);
    const lower = new Color(index === tiers.length - 1 ? ROCK_DEEP : (STRATA[index + 1] as string));
    const top = y;
    parts.push(
      finish(shape, (vy) =>
        upper.clone().lerp(lower, Math.min(1, Math.max(0, (top - vy) / tier.height)))
      )
    );
    // Hanging rock under each ledge.
    if (index < tiers.length - 1) {
      const drops = Math.round(4 + 5 * detail);
      for (let drop = 0; drop < drops; drop += 1) {
        const angle = random() * Math.PI * 2;
        const reach = tier.bottom * (0.55 + random() * 0.4);
        const length = 1.4 + random() * 2.6;
        const spike = cone(0.5 + random() * 0.6, length, [0, 0, 0], STRATA[index + 1] as string, 6);
        spike.rotateX(Math.PI);
        spike.translate(
          Math.cos(angle) * reach + lean * (index + 1) * 1.6,
          y - tier.height + 0.2,
          Math.sin(angle) * reach
        );
        parts.push(spike);
      }
    }
    y -= tier.height;
  }
}

/** Roots and vines trailing from under the rim (none where the waterfall spills). */
function addTrails(parts: BufferGeometry[], random: Random, plan: IslandPlan, detail: number) {
  const R = ISLAND_RADIUS;
  const trails = Math.round(8 + 14 * detail);
  for (let index = 0; index < trails; index += 1) {
    const angle = random() * Math.PI * 2;
    if (apart(angle, plan.waterfall.angle) < 0.25) continue;
    const reach = R - 1.6 - random() * 0.8;
    const start: [number, number, number] = [
      Math.cos(angle) * reach,
      ISLAND_TOP - 2.2 - random() * 1.2,
      Math.sin(angle) * reach,
    ];
    const isVine = index % 3 !== 0;
    const length = isVine ? 3 + random() * 5 : 2 + random() * 3;
    const out = 0.3 + random() * 0.5;
    const mid: [number, number, number] = [
      start[0] * (1 + out / R),
      start[1] - length * 0.5,
      start[2] * (1 + out / R),
    ];
    const end: [number, number, number] = [
      mid[0] + (random() - 0.5) * 0.8,
      start[1] - length,
      mid[2] + (random() - 0.5) * 0.8,
    ];
    const colour = isVine ? VINE : ROOT;
    const thick = isVine ? 0.08 : 0.16;
    parts.push(rod(start, mid, thick, colour, thick * 0.8, 4));
    parts.push(rod(mid, end, thick * 0.8, colour, 0.02, 4));
    if (isVine && detail > 0.5) parts.push(lump(0.28, end, VINE, 1.4));
  }
}

/** Stones, boulders and trees on the grass, clear of the chart, the buildings and the water. */
function addDressing(parts: BufferGeometry[], random: Random, plan: IslandPlan, detail: number) {
  const R = ISLAND_RADIUS;
  // Stones and mossy boulders on the grass, clear of the chart in the middle.
  const stones = Math.round(4 + 6 * detail);
  for (let index = 0; index < stones; index += 1) {
    const angle = random() * Math.PI * 2;
    const reach = 11.5 + random() * (R - 13);
    if (!clearOf(plan, angle, reach)) continue;
    const size = 0.4 + random() * 0.8;
    const at = onTop(angle, reach, size * 0.2);
    parts.push(lump(size, at, index % 3 === 0 ? MOSS : STONE, 0.6));
  }

  // Trees: a ring of mixed woodland round the chart, thickest at the back (−z), only low
  // bushes at the front so the chart stays in view.
  const trees = Math.round(8 + 16 * detail);
  for (let index = 0; index < trees; index += 1) {
    const angle = random() * Math.PI * 2;
    const reach = 11.6 + random() * (R - 12.8);
    if (!clearOf(plan, angle, reach)) continue;
    const front = Math.sin(angle) > 0.35;
    const at = onTop(angle, reach);
    if (front) {
      parts.push(
        lump(0.7 + random() * 0.6, [at[0], at[1] + 0.45, at[2]], LEAVES[index % 4] as string, 0.75)
      );
    } else {
      tree(parts, at, 0.9 + random() * 0.9, Math.floor(random() * 4));
    }
  }
}

/** The pond's bank and the stones round it: the water (buildIslandWater) sits on them. */
function addPond(parts: BufferGeometry[], plan: IslandPlan) {
  const { phase } = plan;
  const pondAt = onTop(plan.pond.angle, plan.pond.radius);
  const bank = new CylinderGeometry(2.7, 2.9, 0.3, 14, 1);
  bank.translate(pondAt[0], ISLAND_TOP + 0.05, pondAt[2]);
  parts.push(finish(bank, solid(STONE)));
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2 + phase;
    parts.push(
      lump(
        0.45,
        [pondAt[0] + Math.cos(angle) * 2.8, ISLAND_TOP + 0.25, pondAt[2] + Math.sin(angle) * 2.8],
        STONE,
        0.6
      )
    );
  }
}

/**
 * The whole island for one place, as a single geometry. `seed` varies its shape and dressing;
 * `detail` (0–1, the quality tier) thins the roots, vines and trees on smaller devices.
 */
export function buildIsland(seed: number, detail = 1): BufferGeometry {
  const random = seededRandom(seed);
  const plan = islandPlan(seed);
  const { phase } = plan;
  const R = ISLAND_RADIUS;
  const parts: BufferGeometry[] = [];

  // The grassy cap: its top face is the island's surface.
  const cap = wobble(new CylinderGeometry(R, R - 0.8, 1.6, 22, 1), 0.08, phase);
  cap.translate(0, ISLAND_TOP - 0.8, 0);
  const grass = new Color(GRASS);
  const edge = new Color(GRASS_EDGE);
  parts.push(finish(cap, (y) => (y > ISLAND_TOP - 0.05 ? grass : edge)));

  // A band of earth under the grass.
  const earth = wobble(new CylinderGeometry(R - 0.7, R - 2.2, 2.2, 22, 2), 0.09, phase + 0.3);
  roughen(earth, 0.25, seed);
  earth.translate(0, ISLAND_TOP - 2.6, 0);
  parts.push(finish(earth, solid(EARTH)));

  addCliff(parts, random, seed, phase, detail);
  addTrails(parts, random, plan, detail);
  addDressing(parts, random, plan, detail);
  addPond(parts, plan);

  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return merged as BufferGeometry;
}

/**
 * The island's still water: the pond and the stream from it to the rim, as one flat
 * geometry just above the grass (drawn with a glossy material of its own).
 */
export function buildIslandWater(seed: number): BufferGeometry {
  const plan = islandPlan(seed);
  const pond = new CircleGeometry(2.45, 18);
  pond.rotateX(-Math.PI / 2);
  const [px, , pz] = onTop(plan.pond.angle, plan.pond.radius);
  pond.translate(px, ISLAND_TOP + 0.22, pz);
  // The stream: from the pond's edge out over the lip.
  const length = ISLAND_RADIUS + 0.6 - plan.pond.radius;
  const stream = new PlaneGeometry(1.3, length, 1, 4);
  stream.rotateX(-Math.PI / 2);
  stream.translate(0, 0, length / 2);
  stream.rotateY(Math.PI / 2 - plan.pond.angle);
  stream.translate(px, ISLAND_TOP + 0.21, pz);
  const parts = [pond, stream].map((part) => finish(part, solid(WATER)));
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return merged as BufferGeometry;
}
