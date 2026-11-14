import { BufferAttribute, BufferGeometry } from 'three';

/**
 * The ship's hull, lofted from cross-sections. The ship lies along X with the bow at +X,
 * the waterline at y = 0 and the centreline at z = 0. Everything that sits on the ship
 * (deck, rails, gunports, masts) reads its shape from these same functions, so fittings
 * follow the curve of the hull instead of being placed by eye.
 */

export const HULL_LENGTH = 17;
export const STERN_X = -HULL_LENGTH / 2;
export const BOW_X = HULL_LENGTH / 2;
export const MAX_HALF_BEAM = 2.55;
/** Height of the main deck above the waterline amidships. */
export const DECK_HEIGHT = 1.25;
/** Bulwarks stand this far above the deck. */
export const BULWARK = 0.95;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smooth(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Position along the hull, 0 at the stern to 1 at the bow. */
export function stationAt(x: number) {
  return clamp01((x - STERN_X) / HULL_LENGTH);
}

/** Maximum half-breadth of the section at s: a broad transom, full midships, a fine bow. */
export function halfBeam(s: number) {
  if (s <= 0.42) return MAX_HALF_BEAM * (1 - 0.3 * ((0.42 - s) / 0.42) ** 2);
  const t = (s - 0.42) / 0.58;
  return MAX_HALF_BEAM * Math.max(0, 1 - t ** 2.3);
}

/** Depth of the keel below the waterline: the forefoot sweeps up into the stem. */
export function keelDepth(s: number) {
  return 2.25 - 0.25 * smooth(0.25, 0, s) - 1.55 * smooth(0.72, 1, s) ** 1.4;
}

/** The deck line: low amidships, a raised quarterdeck aft and a forecastle forward. */
export function deckHeight(s: number) {
  return DECK_HEIGHT + 1.45 * smooth(0.36, 0.26, s) + 0.85 * smooth(0.8, 0.9, s);
}

/** Top of the bulwark (the sheer), which also climbs toward bow and stern. */
export function sheerHeight(s: number) {
  return deckHeight(s) + BULWARK + 0.35 * smooth(0.12, 0, s) + 0.4 * smooth(0.92, 1, s);
}

/**
 * Half-breadth of the section at s and height y: a rounded bilge below the waterline
 * (super-ellipse into the keel) and a gentle tumblehome above it.
 */
export function halfWidthAt(s: number, y: number) {
  const beam = halfBeam(s);
  if (y < 0) {
    const depth = keelDepth(s);
    const r = clamp01(-y / depth);
    return beam * (1 - r ** 2.6) ** (1 / 2.6);
  }
  const top = sheerHeight(s);
  return beam * (1 - 0.13 * clamp01(y / top) ** 2);
}

/** X of the hull at station s and height fraction v: a raked stem and a sloped transom. */
export function hullX(s: number, v: number) {
  const base = STERN_X + s * HULL_LENGTH;
  const stemRake = 1.6 * v ** 1.6 * smooth(0.86, 1, s);
  const transomRake = -0.7 * v * smooth(0.06, 0, s);
  return base + stemRake + transomRake;
}

export interface HullGeometry {
  /** The deck surface: x along the ship, z across, y on the deck line. */
  deck: BufferGeometry;
  /** Both sides of the hull plus the transom, with UVs in metres for the planking. */
  hull: BufferGeometry;
}

/** Height of row v (0 keel → 1 sheer) at station s. */
function rowHeight(s: number, v: number) {
  const depth = keelDepth(s);
  const top = sheerHeight(s);
  return -depth + (depth + top) * v;
}

interface Mesh {
  indices: number[];
  positions: number[];
  shade: number[];
  uvs: number[];
}

/** Vertex shade: 0 below the boot-top, 1 for the topsides (the paint texture follows). */
function shadeFor(y: number) {
  return y < 0.22 ? 0 : 1;
}

/** One side of the hull: a grid of stations × rows, wound to face outward. */
function loftSide(mesh: Mesh, side: -1 | 1, stations: number, rows: number) {
  const start = mesh.positions.length / 3;
  for (let i = 0; i < stations; i += 1) {
    const s = i / (stations - 1);
    for (let j = 0; j < rows; j += 1) {
      const v = j / (rows - 1);
      const y = rowHeight(s, v);
      const x = hullX(s, v);
      mesh.positions.push(x, y, side * halfWidthAt(s, y));
      mesh.uvs.push(x, y);
      mesh.shade.push(shadeFor(y));
    }
  }
  for (let i = 0; i < stations - 1; i += 1) {
    for (let j = 0; j < rows - 1; j += 1) {
      const a = start + i * rows + j;
      const b = a + rows;
      if (side === 1) mesh.indices.push(a, b, a + 1, a + 1, b, b + 1);
      else mesh.indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
}

/** The transom: a fan across the stern section from starboard to port. */
function loftTransom(mesh: Mesh, rows: number) {
  const start = mesh.positions.length / 3;
  const centerY = (rowHeight(0, 0) + rowHeight(0, 1)) / 2;
  mesh.positions.push(hullX(0, 0.5), centerY, 0);
  mesh.uvs.push(0, centerY);
  mesh.shade.push(1);
  const rowsAcross = [
    ...Array.from({ length: rows }, (_, j) => ({ j, side: 1 })),
    ...Array.from({ length: rows }, (_, j) => ({ j: rows - 1 - j, side: -1 })),
  ];
  for (const { j, side } of rowsAcross) {
    const v = j / (rows - 1);
    const y = rowHeight(0, v);
    const z = side * halfWidthAt(0, y);
    mesh.positions.push(hullX(0, v), y, z);
    mesh.uvs.push(z, y);
    mesh.shade.push(shadeFor(y));
  }
  for (let k = 0; k < rowsAcross.length - 1; k += 1) {
    mesh.indices.push(start, start + 2 + k, start + 1 + k);
  }
}

/** The deck surface: one strip of quads per station, inside the hull at deck height. */
function loftDeck(stations: number, across = 9) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < stations; i += 1) {
    const s = Math.min(i / (stations - 1), 0.985);
    const y = deckHeight(s);
    const width = halfWidthAt(s, y) - 0.04;
    const x = STERN_X + s * HULL_LENGTH;
    for (let k = 0; k < across; k += 1) {
      const z = -width + (2 * width * k) / (across - 1);
      positions.push(x, y, z);
      uvs.push(x, z);
    }
  }
  for (let i = 0; i < stations - 1; i += 1) {
    for (let k = 0; k < across - 1; k += 1) {
      const a = i * across + k;
      const b = a + across;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const deck = new BufferGeometry();
  deck.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  deck.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  deck.setIndex(indices);
  deck.computeVertexNormals();
  deck.computeBoundingSphere();
  return deck;
}

/**
 * Lofts the hull: `stations` sections stern → bow, each with `rows` points keel → sheer per
 * side, plus the transom and the deck. Normals are computed from the final positions, so
 * the bilge reads smoothly.
 */
export function buildHull(stations = 56, rows = 18): HullGeometry {
  const mesh: Mesh = { positions: [], uvs: [], shade: [], indices: [] };
  loftSide(mesh, 1, stations, rows);
  loftSide(mesh, -1, stations, rows);
  loftTransom(mesh, rows);
  const hull = new BufferGeometry();
  hull.setAttribute('position', new BufferAttribute(new Float32Array(mesh.positions), 3));
  hull.setAttribute('uv', new BufferAttribute(new Float32Array(mesh.uvs), 2));
  hull.setAttribute('shade', new BufferAttribute(new Float32Array(mesh.shade), 1));
  hull.setIndex(mesh.indices);
  hull.computeVertexNormals();
  hull.computeBoundingSphere();
  return { hull, deck: loftDeck(stations) };
}

/**
 * Points along the top of the bulwark on one side, stern → bow: where rails, belaying pins
 * and shroud chainplates attach.
 */
export function gunwalePoints(count: number, side: -1 | 1, from = 0.02, to = 0.95) {
  return Array.from({ length: count }, (_, index) => {
    const s = from + ((to - from) * index) / Math.max(1, count - 1);
    const y = sheerHeight(s);
    return [hullX(s, 1), y, side * halfWidthAt(s, y)] as [number, number, number];
  });
}
