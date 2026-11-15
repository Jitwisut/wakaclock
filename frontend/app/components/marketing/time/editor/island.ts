import {
  type BufferGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { seededRandom } from '../time-data';

import { ISLAND_TOP } from './file-plan';

/**
 * The floating island every landmark stands on (owner decision 2026-11-15): a grassy cap, a
 * band of earth, a rocky underside that tapers to a point, a few stones and low trees. Built
 * once per place as a single mesh with vertex colours and flat facets, so ten islands cost
 * ten draw calls. Colours stay muted, in the site's dusk tones: nothing here glows.
 */

/** Radius of the island's grassy top. Its surface height is `ISLAND_TOP` in file-plan. */
export const ISLAND_RADIUS = 12.5;

const GRASS = '#55705a';
const GRASS_EDGE = '#456049';
const EARTH = '#73573f';
const ROCK = '#5a5f70';
const ROCK_DEEP = '#343846';
const STONE = '#6a7080';
const TRUNK = '#4a3628';
const LEAVES = ['#35513f', '#3f5d48', '#2f4838'] as const;

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

/** Flat facets, no uvs, one colour per vertex: ready to merge with the island's other parts. */
function finish(geometry: BufferGeometry, colour: (y: number) => Color) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  flat.deleteAttribute('uv');
  const position = flat.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const tint = colour(position.getY(index));
    colours.set([tint.r, tint.g, tint.b], index * 3);
  }
  flat.setAttribute('color', new Float32BufferAttribute(colours, 3));
  flat.computeVertexNormals();
  return flat;
}

const solid = (hex: string) => {
  const colour = new Color(hex);
  return () => colour;
};

/** The whole island for one place, as a single geometry. `seed` varies its shape and dressing. */
export function buildIsland(seed: number): BufferGeometry {
  const random = seededRandom(seed);
  const phase = random() * 6.28;
  const parts: BufferGeometry[] = [];

  // The grassy cap: its top face is the island's surface.
  const cap = wobble(
    new CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 0.6, 1.4, 14, 1),
    0.1,
    phase
  );
  cap.translate(0, ISLAND_TOP - 0.7, 0);
  const grass = new Color(GRASS);
  const edge = new Color(GRASS_EDGE);
  parts.push(finish(cap, (y) => (y > ISLAND_TOP - 0.05 ? grass : edge)));

  // A band of earth under the grass.
  const earth = wobble(
    new CylinderGeometry(ISLAND_RADIUS - 0.6, ISLAND_RADIUS - 1.6, 1.6, 14, 1),
    0.11,
    phase + 0.3
  );
  earth.translate(0, ISLAND_TOP - 2.2, 0);
  parts.push(finish(earth, solid(EARTH)));

  // The rocky underside, tapering to a blunt point and a little crooked.
  // Shallow enough to float clear of the desk on its rod.
  const depth = 6.5 + random() * 2.5;
  const under = new CylinderGeometry(ISLAND_RADIUS - 1.6, 0.8, depth, 14, 5);
  wobble(under, 0.18, phase + 1.1, 0.35);
  const lean = (random() - 0.5) * 0.25;
  const position = under.getAttribute('position');
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    const down = 0.5 - y / depth; // 0 at the top, 1 at the point
    position.setX(index, position.getX(index) + lean * down * depth * 0.5);
  }
  under.translate(0, ISLAND_TOP - 3 - depth / 2, 0);
  const rock = new Color(ROCK);
  const deep = new Color(ROCK_DEEP);
  const top = ISLAND_TOP - 3;
  parts.push(
    finish(under, (y) => rock.clone().lerp(deep, Math.min(1, Math.max(0, (top - y) / depth))))
  );

  // Stones on the grass, kept clear of the middle where the landmark stands.
  for (let index = 0; index < 4; index += 1) {
    const angle = random() * Math.PI * 2;
    const reach = 9 + random() * 2.2;
    const size = 0.5 + random() * 0.7;
    const stone = new DodecahedronGeometry(size, 0);
    stone.scale(1, 0.6, 1);
    stone.translate(Math.cos(angle) * reach, ISLAND_TOP + size * 0.25, Math.sin(angle) * reach);
    parts.push(finish(stone, solid(STONE)));
  }

  // A few low trees toward the back of the island (−z, away from the arriving camera).
  const trees = 2 + Math.floor(random() * 3);
  for (let index = 0; index < trees; index += 1) {
    const angle = Math.PI * (1.15 + random() * 0.7);
    const reach = 8.4 + random() * 2.6;
    const x = Math.cos(angle) * reach;
    const z = Math.sin(angle) * reach;
    const height = 2.6 + random() * 2.2;
    const trunk = new CylinderGeometry(0.22, 0.32, height * 0.5, 6, 1);
    trunk.translate(x, ISLAND_TOP + height * 0.25, z);
    parts.push(finish(trunk, solid(TRUNK)));
    const leaves = LEAVES[index % LEAVES.length] as string;
    for (let tier = 0; tier < 2; tier += 1) {
      const radius = (1.7 - tier * 0.5) * (height / 3.4);
      const cone = new CylinderGeometry(0.05, radius, height * 0.55, 7, 1);
      cone.translate(x, ISLAND_TOP + height * (0.55 + tier * 0.3), z);
      parts.push(finish(cone, solid(leaves)));
    }
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return merged as BufferGeometry;
}
