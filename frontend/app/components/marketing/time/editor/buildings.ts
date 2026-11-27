import { type BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { seededRandom } from '../time-data';

import { ISLAND_TOP } from './file-plan';
import { type IslandPlan, type Slot } from './island';
import { box, cone, dome, lump, post, rod } from './model-kit';

/**
 * The buildings on each place's island (owner 2026-11-27: "creative buildings", themed on
 * each place's name). The bar chart keeps the middle of every island — it is what the scene
 * is about — and the place's own building stands behind it: a lighthouse, a clock tower,
 * twin lanterns, a market, a moored sky ship, a pier, a domed library, a signal mast, a
 * pagoda, a tavern; cottages and a stepping-stone path fill the rest. Muted model-maker's
 * colours; only windows and lanterns light up, and only as the evening falls.
 *
 * Each place comes out as two geometries (the building, and the parts that glow) plus the
 * anchors where something moves: a clock's hands, a lantern's beam, a chimney's smoke.
 */

const WALL = '#cdbf9f';
const STONE = '#9a917f';
const WOOD = '#5a4330';
const SLATE = '#4a5068';
const RUST = '#8a4f3c';
const GOLD = '#b8914f';
const TEAL = '#4f8a82';
const CREAM = '#d9d2c3';
const PATH = '#8c8577';

type Vec3 = [number, number, number];

export interface Anchors {
  /** The clock face's centre and the way it faces (the clock tower). */
  clock?: { at: Vec3; facing: number };
  /** Lanterns whose light sweeps or blinks (lighthouse, signal, twin lights). */
  lights: Vec3[];
  /** Chimneys that smoke (tavern, cottages). */
  smoke: Vec3[];
}

export interface Building {
  anchors: Anchors;
  body: BufferGeometry;
  glow: BufferGeometry;
}

/** What one theme puts on the ground at the origin, facing +z. */
interface Kit {
  anchors: Anchors;
  body: BufferGeometry[];
  glow: BufferGeometry[];
}

const g = ISLAND_TOP;

function kit(): Kit {
  return { anchors: { lights: [], smoke: [] }, body: [], glow: [] };
}

/** A window pane on a wall facing +z (or turned by `turn`). */
function pane(k: Kit, at: Vec3, size: [number, number] = [0.5, 0.7], turn = 0) {
  k.glow.push(box([size[0], size[1], 0.08], at, '#f2c27a', turn));
}

/** A four-sided roof over a w × d footprint whose eaves sit at `y`. */
function roof(k: Kit, w: number, d: number, y: number, height: number, hex: string) {
  const top = cone(Math.SQRT1_2, height, [0, 0, 0], hex, 4, Math.PI / 4);
  top.scale(w + 0.5, 1, d + 0.5);
  top.translate(0, y, 0);
  k.body.push(top);
}

function lighthouse(k: Kit) {
  k.body.push(post(2, 2.2, 1, [0, g, 0], STONE, 10));
  const bands = [CREAM, RUST, CREAM, RUST];
  for (const [index, colour] of bands.entries()) {
    const r0 = 1.45 - index * 0.1;
    k.body.push(post(r0 - 0.1, r0, 2.3, [0, g + 1 + index * 2.3, 0], colour, 12));
  }
  const top = g + 1 + bands.length * 2.3;
  k.body.push(post(1.7, 1.7, 0.3, [0, top, 0], WOOD, 12));
  k.glow.push(post(0.85, 0.85, 1.3, [0, top + 0.3, 0], '#f2c27a', 10));
  k.body.push(dome(1, [0, top + 1.6, 0], GOLD, 0.9));
  k.body.push(rod([0, top + 2.4, 0], [0, top + 3.4, 0], 0.08, GOLD));
  k.anchors.lights.push([0, top + 0.95, 0]);
  for (let index = 0; index < 3; index += 1) pane(k, [0, g + 3 + index * 2.3, 1.34], [0.35, 0.6]);
  // The keeper's cottage at its foot.
  k.body.push(box([2.6, 1.8, 2.2], [2.9, g + 0.9, 0.6], WALL));
  roof(k, 2.6, 2.2, g + 1.8, 1.3, SLATE);
  pane(k, [2.9, g + 1, 1.75]);
}

function clocktower(k: Kit) {
  k.body.push(box([3.4, 0.8, 3.4], [0, g + 0.4, 0], STONE));
  k.body.push(box([2.6, 8.6, 2.6], [0, g + 5.1, 0], STONE));
  k.body.push(box([3.2, 3, 3.2], [0, g + 10.9, 0], WALL));
  roof(k, 3.2, 3.2, g + 12.4, 4.4, SLATE);
  k.body.push(rod([0, g + 16.6, 0], [0, g + 17.6, 0], 0.07, GOLD));
  // The clock face on the front, the hands drawn by the scene.
  const face = post(1.2, 1.2, 0.12, [0, 0, 0], CREAM, 24);
  face.rotateX(Math.PI / 2);
  face.translate(0, g + 10.9, 1.66);
  k.body.push(face);
  k.anchors.clock = { at: [0, g + 10.9, 1.78], facing: 0 };
  for (let index = 0; index < 3; index += 1) pane(k, [0, g + 2.6 + index * 2.4, 1.32], [0.4, 1]);
}

function twinlights(k: Kit) {
  for (const [side, cap] of [
    [-2.4, GOLD],
    [2.4, TEAL],
  ] as const) {
    k.body.push(post(1.2, 1.4, 0.8, [side, g, 0], STONE, 8));
    k.body.push(post(0.75, 0.95, 8, [side, g + 0.8, 0], WALL, 8));
    k.glow.push(post(0.6, 0.6, 1, [side, g + 8.8, 0], '#f2c27a', 8));
    k.body.push(cone(1.05, 1.8, [side, g + 9.8, 0], cap, 8, 0, 'smooth'));
    k.anchors.lights.push([side, g + 9.3, 0]);
    pane(k, [side, g + 4, 0.82], [0.3, 0.8]);
  }
  // A rope bridge between them, planks hung on it.
  k.body.push(rod([-1.7, g + 7, 0.2], [1.7, g + 7, 0.2], 0.05, WOOD));
  k.body.push(rod([-1.7, g + 7, -0.4], [1.7, g + 7, -0.4], 0.05, WOOD));
  for (let index = 0; index < 6; index += 1) {
    const x = -1.4 + index * 0.56;
    const sag = 0.35 * Math.sin((index / 5) * Math.PI);
    k.body.push(box([0.4, 0.06, 0.7], [x, g + 6.85 - sag, -0.1], WOOD));
  }
}

function market(k: Kit) {
  const awnings = [GOLD, TEAL, RUST, CREAM];
  for (const [index, colour] of awnings.entries()) {
    const x = (index - 1.5) * 2.9;
    const z = index % 2 ? -0.8 : 0.6;
    k.body.push(box([2.2, 0.9, 1.2], [x, g + 0.45, z], WOOD));
    for (const [px, pz] of [
      [-1, -0.6],
      [1, -0.6],
      [-1, 0.6],
      [1, 0.6],
    ] as const) {
      k.body.push(post(0.06, 0.06, 2.4, [x + px, g, z + pz], WOOD, 4));
    }
    const awning = box([2.5, 0.1, 1.7], [x, g + 2.5, z + 0.1], colour);
    k.body.push(awning);
    k.body.push(lump(0.3, [x - 0.5, g + 1.1, z], index % 2 ? GOLD : '#7a8f5a', 0.8));
    k.body.push(lump(0.25, [x + 0.4, g + 1.05, z + 0.2], '#a2683f', 0.8));
  }
  // A string of lanterns over the stalls.
  k.body.push(rod([-6, g + 3.4, 0], [6, g + 3.4, 0], 0.03, WOOD));
  for (let index = 0; index < 7; index += 1) {
    k.glow.push(lump(0.16, [-5.4 + index * 1.8, g + 3.15, 0], '#f2c27a', 1.2));
  }
  k.body.push(post(0.5, 0.6, 0.5, [0, g, 2.4], STONE, 10));
}

function ship(k: Kit) {
  // A sky ship moored on its cradle: hull, deck house, mast and sail, and its gas envelope.
  k.body.push(box([0.4, 1.2, 4], [-1.4, g + 0.6, 0], WOOD));
  k.body.push(box([0.4, 1.2, 4], [1.4, g + 0.6, 0], WOOD));
  const hull = lump(1, [0, 0, 0], WOOD, 1, 1);
  hull.scale(1.9, 1.1, 4.4);
  hull.translate(0, g + 2.3, 0);
  k.body.push(hull);
  k.body.push(box([3.2, 0.2, 7.6], [0, g + 2.9, 0], '#7a5d40'));
  k.body.push(box([1.8, 1.3, 2], [0, g + 3.6, -2.2], WALL));
  pane(k, [0, g + 3.7, -1.18], [0.9, 0.4]);
  k.body.push(rod([0, g + 3, 0.8], [0, g + 11, 0.8], 0.12, WOOD));
  k.body.push(box([0.06, 3.6, 3], [0, g + 7, 1.6], CREAM));
  const envelope = lump(1, [0, 0, 0], GOLD, 1, 1);
  envelope.scale(2.2, 1.6, 4.6);
  envelope.translate(0, g + 13.2, 0);
  k.body.push(envelope);
  for (const z of [-3, 3]) k.body.push(rod([0, g + 3, z], [0, g + 11.8, z * 0.7], 0.03, WOOD));
  k.glow.push(lump(0.22, [0, g + 3.4, 3.7], '#f2c27a', 1.2));
}

function dock(k: Kit) {
  // A pier reaching off the island's edge, posts, a boathouse and a crane.
  k.body.push(box([2.2, 0.25, 9], [0, g + 0.5, 3.4], '#7a5d40'));
  for (let index = 0; index < 5; index += 1) {
    const z = -0.6 + index * 2;
    for (const x of [-1, 1]) k.body.push(post(0.12, 0.14, 1.6, [x, g - 0.8, z], WOOD, 5));
  }
  for (const z of [3, 7]) {
    k.body.push(post(0.09, 0.09, 1.4, [1.1, g + 0.6, z], WOOD, 5));
    k.glow.push(lump(0.18, [1.1, g + 2.15, z], '#f2c27a', 1.2));
  }
  k.body.push(box([3.4, 2.4, 3], [-3, g + 1.2, -1.6], WALL));
  roof(k, 3.4, 3, g + 2.4, 1.6, RUST);
  pane(k, [-3, g + 1.3, -0.06], [0.8, 0.7]);
  k.body.push(rod([2.4, g, -1.4], [2.4, g + 6, -1.4], 0.14, WOOD));
  k.body.push(rod([2.4, g + 6, -1.4], [2.4, g + 5.6, 3.2], 0.09, WOOD));
  k.body.push(rod([2.4, g + 5.6, 3.2], [2.4, g + 3.4, 3.2], 0.02, '#3b3b3b'));
  k.body.push(box([0.8, 0.8, 0.8], [2.4, g + 3, 3.2], '#7a5d40'));
  for (const [x, z] of [
    [-0.6, 0.2],
    [0.5, -0.1],
  ] as const) {
    k.body.push(post(0.32, 0.36, 0.8, [x, g + 0.62, z], '#6b4a30', 8));
  }
}

function library(k: Kit) {
  k.body.push(post(4.2, 4.4, 0.6, [0, g, 0], STONE, 16));
  k.body.push(post(3, 3, 4.2, [0, g + 0.6, 0], WALL, 16));
  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    k.body.push(
      post(0.2, 0.22, 4.2, [Math.cos(angle) * 3.6, g + 0.6, Math.sin(angle) * 3.6], CREAM, 6)
    );
  }
  k.body.push(post(3.9, 3.9, 0.35, [0, g + 4.8, 0], CREAM, 16));
  k.body.push(dome(3.2, [0, g + 5.15, 0], GOLD, 0.85));
  k.body.push(post(0.6, 0.6, 1.2, [0, g + 7.8, 0], CREAM, 8));
  k.body.push(dome(0.7, [0, g + 9, 0], GOLD));
  for (let index = 0; index < 5; index += 1) {
    const angle = Math.PI / 2 + (index - 2) * 0.5;
    pane(
      k,
      [Math.cos(angle) * 3.02, g + 2.6, Math.sin(angle) * 3.02],
      [0.6, 1.5],
      Math.PI / 2 - angle
    );
  }
  for (let step = 0; step < 3; step += 1) {
    k.body.push(box([2.6, 0.2, 0.6], [0, g + 0.1 + step * 0.2, 4.6 - step * 0.5], STONE));
  }
}

function signal(k: Kit) {
  // A lattice mast: four legs, cross braces, a beacon and flags.
  const height = 13;
  for (const [x, z] of [
    [-1.6, -1.6],
    [1.6, -1.6],
    [1.6, 1.6],
    [-1.6, 1.6],
  ] as const) {
    k.body.push(rod([x, g, z], [x * 0.2, g + height, z * 0.2], 0.12, '#6e6a66'));
  }
  for (let level = 1; level < 5; level += 1) {
    const y = g + (level / 5) * height;
    const r = 1.6 * (1 - (level / 5) * 0.8);
    for (const [ax, az, bx, bz] of [
      [-r, -r, r, -r],
      [r, -r, r, r],
      [r, r, -r, r],
      [-r, r, -r, -r],
    ] as const) {
      k.body.push(rod([ax, y, az], [bx, y, bz], 0.05, '#6e6a66'));
    }
  }
  k.body.push(box([1, 0.3, 1], [0, g + height + 0.15, 0], SLATE));
  k.glow.push(lump(0.42, [0, g + height + 0.7, 0], '#f2c27a', 1, 1));
  k.anchors.lights.push([0, g + height + 0.7, 0]);
  k.body.push(rod([0.4, g + height, 0], [0.4, g + height + 2.6, 0], 0.05, WOOD));
  k.body.push(box([1.2, 0.6, 0.04], [1.05, g + height + 2.2, 0], GOLD));
  k.body.push(box([1, 0.5, 0.04], [0.95, g + height + 1.5, 0], TEAL));
  k.body.push(box([2.2, 1.8, 2], [3.2, g + 0.9, 1], WALL));
  roof(k, 2.2, 2, g + 1.8, 1.2, SLATE);
  pane(k, [3.2, g + 1, 2.04]);
}

function trading(k: Kit) {
  // A pagoda: three storeys, each under a wide gold-edged roof.
  const storeys = [
    { w: 4.4, h: 2.6 },
    { w: 3.4, h: 2.2 },
    { w: 2.5, h: 1.9 },
  ];
  let y = g;
  k.body.push(box([5.4, 0.6, 5.4], [0, y + 0.3, 0], STONE));
  y += 0.6;
  for (const [index, storey] of storeys.entries()) {
    k.body.push(
      box([storey.w, storey.h, storey.w], [0, y + storey.h / 2, 0], index % 2 ? WALL : '#b8a789')
    );
    pane(k, [0, y + storey.h / 2, storey.w / 2 + 0.02], [0.9, 0.8]);
    y += storey.h;
    const eaves = cone(Math.SQRT1_2, 1.3, [0, 0, 0], RUST, 4, Math.PI / 4);
    eaves.scale(storey.w + 2.2, 1, storey.w + 2.2);
    eaves.translate(0, y - 0.2, 0);
    k.body.push(eaves);
    y += 0.9;
  }
  k.body.push(cone(0.35, 3, [0, y - 0.6, 0], GOLD, 8, 0, 'smooth'));
  for (let ring = 0; ring < 3; ring += 1) {
    k.body.push(post(0.5, 0.5, 0.12, [0, y + ring * 0.6, 0], GOLD, 10));
  }
}

function tavern(k: Kit) {
  k.body.push(box([5, 3, 3.8], [0, g + 1.5, 0], WALL));
  // Timber framing on the front.
  for (const x of [-2.4, -0.8, 0.8, 2.4]) {
    k.body.push(box([0.16, 3, 0.1], [x, g + 1.5, 1.94], WOOD));
  }
  k.body.push(box([5, 0.16, 0.1], [0, g + 1.6, 1.94], WOOD));
  roof(k, 5, 3.8, g + 3, 2.4, RUST);
  k.body.push(box([0.8, 2.6, 0.8], [1.6, g + 4.4, -0.6], STONE));
  k.anchors.smoke.push([1.6, g + 5.9, -0.6]);
  k.body.push(box([1, 1.8, 0.1], [0, g + 0.9, 1.95], WOOD));
  for (const x of [-1.6, 1.6]) pane(k, [x, g + 1.2, 1.96], [0.8, 0.7]);
  pane(k, [-0.8, g + 2.35, 1.96], [0.6, 0.5]);
  pane(k, [0.8, g + 2.35, 1.96], [0.6, 0.5]);
  k.body.push(rod([3, g, 2.4], [3, g + 2.6, 2.4], 0.06, WOOD));
  k.body.push(rod([3, g + 2.6, 2.4], [3.9, g + 2.6, 2.4], 0.05, WOOD));
  k.body.push(box([0.8, 0.6, 0.06], [3.5, g + 2.15, 2.4], GOLD));
  for (const [x, z] of [
    [-3, 1.6],
    [-3.2, 0.6],
  ] as const) {
    k.body.push(post(0.35, 0.4, 0.9, [x, g, z], '#6b4a30', 8));
  }
}

const THEMES: Record<string, (k: Kit) => void> = {
  lighthouse,
  clocktower,
  twinlights,
  market,
  ship,
  dock,
  library,
  signal,
  trading,
  tavern,
};

/** A small cottage, `variant` picking its colours. */
function cottage(k: Kit, variant: number) {
  const roofs = [SLATE, RUST, '#5b6b52'];
  const walls = [WALL, '#bfae8c', CREAM];
  k.body.push(box([2.4, 1.9, 2.2], [0, g + 0.95, 0], walls[variant % 3] as string));
  roof(k, 2.4, 2.2, g + 1.9, 1.4, roofs[variant % 3] as string);
  k.body.push(box([0.6, 1.1, 0.06], [-0.5, g + 0.55, 1.13], WOOD));
  pane(k, [0.55, g + 1.05, 1.13], [0.5, 0.5]);
  k.body.push(box([0.4, 1.2, 0.4], [0.7, g + 2.6, -0.4], STONE));
  k.anchors.smoke.push([0.7, g + 3.3, -0.4]);
}

/** The arriving camera's direction on the island (radians from +x toward +z). */
const TOWARD_CAMERA = 1.2;

/**
 * Which way a place's building faces. Most turn to the arriving camera; the pier reaches out
 * over the edge; the market's long row of stalls runs along the rim, facing the middle, so
 * it never reaches into the chart.
 */
function facingFor(id: string, slot: Slot) {
  if (id === 'dock') return slot.angle;
  if (id === 'market') return slot.angle + Math.PI;
  return TOWARD_CAMERA;
}

/** Moves a theme's parts and anchors from the origin to `slot`, turned to face `facing`. */
function place(k: Kit, slot: Slot, facing: number) {
  const turn = Math.PI / 2 - facing;
  const x = Math.cos(slot.angle) * slot.radius;
  const z = Math.sin(slot.angle) * slot.radius;
  for (const part of [...k.body, ...k.glow]) {
    part.rotateY(turn);
    part.translate(x, 0, z);
  }
  const move = (at: Vec3): Vec3 => {
    const v = new Vector3(...at).applyAxisAngle(new Vector3(0, 1, 0), turn);
    return [v.x + x, v.y, v.z + z];
  };
  k.anchors.lights = k.anchors.lights.map(move);
  k.anchors.smoke = k.anchors.smoke.map(move);
  if (k.anchors.clock) {
    k.anchors.clock = { at: move(k.anchors.clock.at), facing: turn };
  }
}

/**
 * Gives a building an `outlineNormal` per vertex: the average of every face normal meeting
 * at that point. The outline shell (scene.tsx) pushes the surface out along it, so the shell
 * stays closed round corners where the faces' own normals would split it apart.
 */
export function addOutlineNormals(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const sums = new Map<string, [number, number, number]>();
  const keyAt = (index: number) =>
    `${position.getX(index).toFixed(3)},${position.getY(index).toFixed(3)},${position.getZ(index).toFixed(3)}`;
  for (let index = 0; index < position.count; index += 1) {
    const key = keyAt(index);
    const sum = sums.get(key) ?? [0, 0, 0];
    sum[0] += normal.getX(index);
    sum[1] += normal.getY(index);
    sum[2] += normal.getZ(index);
    sums.set(key, sum);
  }
  const out = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const [x, y, z] = sums.get(keyAt(index)) as [number, number, number];
    const length = Math.hypot(x, y, z) || 1;
    out.set([x / length, y / length, z / length], index * 3);
  }
  geometry.setAttribute('outlineNormal', new Float32BufferAttribute(out, 3));
  return geometry;
}

function merge(parts: BufferGeometry[]) {
  const merged = mergeGeometries(parts, false) as BufferGeometry;
  for (const part of parts) part.dispose();
  return merged;
}

/**
 * Everything built on one place's island: its themed building at the back over the chart,
 * cottages round it, and a path of stepping stones from the chart to the building.
 */
export function buildPlace(id: string, plan: IslandPlan, seed: number, detail = 1): Building {
  const all = kit();
  const theme = kit();
  (THEMES[id] ?? tavern)(theme);
  place(theme, plan.landmark, facingFor(id, plan.landmark));
  const houses = Math.max(1, Math.round(plan.cottages.length * Math.min(1, 0.4 + detail)));
  const cottages = plan.cottages.slice(0, houses).map((slot, index) => {
    const house = kit();
    cottage(house, seed + index);
    // Each faces the middle of the island.
    place(house, slot, slot.angle + Math.PI);
    return house;
  });
  for (const part of [theme, ...cottages]) {
    all.body.push(...part.body);
    all.glow.push(...part.glow);
    all.anchors.lights.push(...part.anchors.lights);
    all.anchors.smoke.push(...part.anchors.smoke);
    if (part.anchors.clock) all.anchors.clock = part.anchors.clock;
  }
  // Stepping stones from the chart's edge out to the building.
  const random = seededRandom(seed * 3 + 11);
  for (let index = 0; index < 5; index += 1) {
    const reach = 8.4 + index * ((plan.landmark.radius - 11) / 4);
    const angle = plan.landmark.angle + (random() - 0.5) * 0.16 + Math.PI * 0.03 * Math.sin(index);
    const stone = post(
      0.55,
      0.6,
      0.1,
      [Math.cos(angle) * reach, g, Math.sin(angle) * reach],
      PATH,
      7
    );
    all.body.push(stone);
  }
  return {
    anchors: all.anchors,
    body: addOutlineNormals(merge(all.body)),
    glow: merge(all.glow),
  };
}
