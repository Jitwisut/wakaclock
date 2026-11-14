import {
  type BufferGeometry,
  CylinderGeometry,
  type InstancedMesh,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Vector2,
  Vector3,
} from 'three';

import type { Vec3 } from './rig-plan';

/**
 * Small geometry helpers shared by the ship's parts: placing an instanced unit cylinder
 * between two points (ropes, spars, balusters) and turning profiles (barrels, cannon).
 */

const UP = new Vector3(0, 1, 0);
const start = new Vector3();
const end = new Vector3();
const middle = new Vector3();
const direction = new Vector3();
const rotation = new Quaternion();
const scale = new Vector3();
const matrix = new Matrix4();

/** A unit cylinder (radius 1, height 1, centred) to be stretched between points. */
export function unitCylinder(radialSegments = 6) {
  return new CylinderGeometry(1, 1, 1, radialSegments, 1, true);
}

/** Matrix that maps the unit cylinder onto the segment from → to with the given radius. */
export function segmentMatrix(from: Vec3, to: Vec3, radius: number, target = matrix) {
  start.set(...from);
  end.set(...to);
  middle.addVectors(start, end).multiplyScalar(0.5);
  direction.subVectors(end, start);
  const length = direction.length();
  rotation.setFromUnitVectors(UP, direction.normalize());
  scale.set(radius, length, radius);
  return target.compose(middle, rotation, scale);
}

/** Writes one segment per entry into an instanced unit cylinder. */
export function fillSegments(
  mesh: InstancedMesh,
  segments: readonly { from: Vec3; radius: number; to: Vec3 }[]
) {
  for (const [index, segment] of segments.entries()) {
    mesh.setMatrixAt(index, segmentMatrix(segment.from, segment.to, segment.radius));
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/** A turned shape from (radius, height) pairs: barrels, cannon barrels, capstans, posts. */
export function lathe(profile: readonly [number, number][], segments = 16): BufferGeometry {
  const geometry = new LatheGeometry(
    profile.map(([radius, height]) => new Vector2(radius, height)),
    segments
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** A cask: bulging staves between two heads. Height 1, centred at the origin. */
export function barrelProfile(): [number, number][] {
  const points: [number, number][] = [[0, -0.5]];
  for (let index = 0; index <= 10; index += 1) {
    const t = index / 10;
    points.push([0.36 + Math.sin(Math.PI * t) * 0.08, -0.5 + t]);
  }
  points.push([0, 0.5]);
  return points;
}

/** A cannon barrel along +Y: cascabel, reinforce rings, chase and a swelled muzzle. */
export function cannonProfile(): [number, number][] {
  return [
    [0, -0.62],
    [0.06, -0.66],
    [0.1, -0.6],
    [0.15, -0.55],
    [0.15, -0.38],
    [0.17, -0.36],
    [0.17, -0.3],
    [0.135, -0.28],
    [0.125, 0.05],
    [0.145, 0.07],
    [0.145, 0.12],
    [0.115, 0.14],
    [0.1, 0.52],
    [0.125, 0.56],
    [0.125, 0.62],
    [0.06, 0.62],
    [0.06, 0.4],
  ];
}
