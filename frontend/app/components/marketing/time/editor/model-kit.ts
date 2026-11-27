import {
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  SphereGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * The model maker's kit for the floating islands (owner 2026-11-27: bigger, richer islands
 * with buildings, cliffs, roots and water; then "sharper and smoother"). Every piece is a
 * small three.js primitive with one colour per vertex, so a whole island or building merges
 * into a single mesh: one draw call however detailed it gets. Natural shapes (trees, bushes,
 * stones, posts) are smooth-shaded and buildings have softly rounded corners, like a well
 * finished resin model; the cliffs and the roofs keep their crisp facets.
 */

/**
 * How a piece is lit: `flat` shows every facet (cliffs, roofs), `smooth` blends the facets
 * into a curved surface (trees, stones, posts), `keep` uses the normals the shape came with
 * (rounded boxes, which carry their own bevels).
 */
export type Shading = 'flat' | 'keep' | 'smooth';

/** One colour per vertex, no uvs, normals for `shading`: ready to merge with other parts. */
export function finish(
  geometry: BufferGeometry,
  colour: (y: number) => Color,
  shading: Shading = 'flat'
) {
  let shaped = geometry;
  if (shading === 'smooth') {
    // Weld coincident corners, then average the normals there: one curved surface.
    shaped.deleteAttribute('normal');
    shaped.deleteAttribute('uv');
    shaped = mergeVertices(shaped, 1e-4);
    shaped.computeVertexNormals();
    if (shaped !== geometry) geometry.dispose();
  }
  const flat = shaped.index ? shaped.toNonIndexed() : shaped;
  if (flat !== shaped) shaped.dispose();
  flat.deleteAttribute('uv');
  const position = flat.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const tint = colour(position.getY(index));
    colours.set([tint.r, tint.g, tint.b], index * 3);
  }
  flat.setAttribute('color', new Float32BufferAttribute(colours, 3));
  if (shading === 'flat') flat.computeVertexNormals();
  return flat;
}

export const solid = (hex: string) => {
  const colour = new Color(hex);
  return () => colour;
};

/**
 * A smooth, repeatable value in [-1, 1] for a point in space. Vertices that share a position
 * (a cylinder's seam) get the same value, so displacing by it never tears a surface.
 */
export function noise3(x: number, y: number, z: number, seed: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 0.618) * 43_758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Roughens a shape: every vertex moves by up to `amount` (m), the same wherever it repeats. */
export function roughen(geometry: BufferGeometry, amount: number, seed: number, keepTop = false) {
  const position = geometry.getAttribute('position');
  let top = -Infinity;
  if (keepTop) {
    for (let index = 0; index < position.count; index += 1) {
      top = Math.max(top, position.getY(index));
    }
  }
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const flat = keepTop && y > top - 1e-3;
    position.setXYZ(
      index,
      x + amount * noise3(x, y, z, seed),
      flat ? y : y + amount * 0.6 * noise3(z, x, y, seed + 1),
      z + amount * noise3(y, z, x, seed + 2)
    );
  }
  return geometry;
}

type Vec3 = readonly [number, number, number];

/** A box centred on `at`, its edges softly rounded (a thin slab gets a thinner bevel). */
export function box(size: Vec3, at: Vec3, hex: string, turn = 0) {
  const bevel = Math.min(0.12, Math.min(...size) * 0.3);
  const geometry = new RoundedBoxGeometry(size[0], size[1], size[2], 2, bevel);
  if (turn) geometry.rotateY(turn);
  geometry.translate(at[0], at[1], at[2]);
  return finish(geometry, solid(hex), 'keep');
}

/** An upright cylinder (or frustum) standing on `at`, smooth-sided with softened rims. */
export function post(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  at: Vec3,
  hex: string,
  sides = 8
) {
  const geometry = new CylinderGeometry(radiusTop, radiusBottom, height, Math.max(sides, 14), 1);
  geometry.translate(at[0], at[1] + height / 2, at[2]);
  return finish(geometry, solid(hex), 'smooth');
}

/** A cone standing on `at`: a roof or a spire (crisp facets), or a pine's tier (`smooth`). */
export function cone(
  radius: number,
  height: number,
  at: Vec3,
  hex: string,
  sides = 8,
  turn = 0,
  shading: Shading = 'flat'
) {
  const geometry = new ConeGeometry(
    radius,
    height,
    shading === 'smooth' ? Math.max(sides, 16) : sides,
    1
  );
  if (turn) geometry.rotateY(turn);
  geometry.translate(at[0], at[1] + height / 2, at[2]);
  return finish(geometry, solid(hex), shading);
}

/** A dome (half sphere) sitting on `at`. */
export function dome(radius: number, at: Vec3, hex: string, squash = 1) {
  const geometry = new SphereGeometry(radius, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  geometry.scale(1, squash, 1);
  geometry.translate(at[0], at[1], at[2]);
  return finish(geometry, solid(hex), 'smooth');
}

/** A rounded lump (canopy, bush, stone, cloud puff) centred on `at`, smooth all over. */
export function lump(radius: number, at: Vec3, hex: string, squash = 1, detail = 2) {
  const geometry = new IcosahedronGeometry(radius, Math.max(1, detail));
  geometry.scale(1, squash, 1);
  geometry.translate(at[0], at[1], at[2]);
  return finish(geometry, solid(hex), 'smooth');
}

/** A thin rod from `from` to `to`: a root, a rope, a chain, a mast. */
export function rod(from: Vec3, to: Vec3, radius: number, hex: string, tip = radius, sides = 5) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dy, dz);
  const geometry = new CylinderGeometry(tip, radius, length, Math.max(sides, 8), 1);
  // Cylinders stand on y: tip toward +y. Point +y along from→to.
  geometry.translate(0, length / 2, 0);
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.acos(Math.max(-1, Math.min(1, dy / (length || 1))));
  geometry.rotateX(pitch);
  geometry.rotateY(yaw);
  geometry.translate(from[0], from[1], from[2]);
  return finish(geometry, solid(hex), 'smooth');
}
