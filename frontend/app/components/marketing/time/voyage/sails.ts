import { BufferAttribute, BufferGeometry } from 'three';

/**
 * Square sails. Each sail hangs from a yard: in its own space the head lies along Z at
 * y = 0, the cloth falls toward −Y, and the wind (from astern) fills it toward +X. The belly
 * is a closed-form function of (u across, v down, time), evaluated identically here and in
 * the vertex shader, and it is exactly zero along the head — sails never tear off a yard.
 */

export interface SailSpec {
  /** Depth of the belly at full wind, in metres. */
  depth: number;
  /** Width of the foot; square sails flare a little toward the foot. */
  foot: number;
  /** Width of the head (along the yard). */
  head: number;
  height: number;
  /** Phase offset so sails never move in lockstep. */
  phase: number;
}

/**
 * Displacement of the cloth toward +X at (u, v), t seconds. Three layers: the broad belly
 * (slow breathing), mid-frequency cloth movement and a quick flutter that only reaches the
 * free foot. `wind` scales the whole response (0 calm, 1 full).
 */
export function sailBillow(u: number, v: number, t: number, spec: SailSpec, wind = 1): number {
  const across = 0.3 + 0.7 * Math.sin(Math.PI * u);
  const down = Math.sin(Math.PI * 0.5 * v) * (1 - 0.35 * v * v);
  const breathe = 1 + 0.07 * Math.sin(t * 0.8 + spec.phase);
  const belly = spec.depth * across * down * breathe;
  const cloth = 0.035 * Math.sin(u * 7 + t * 2.1 + spec.phase) * v;
  const flutter = 0.028 * v ** 5 * Math.sin(u * 17 + t * 7.3 + spec.phase * 3);
  return (belly + cloth + flutter) * wind;
}

/**
 * The flat sail before billowing: a grid with uv (u across 0→1, v down 0→1) on the plane
 * x = 0. `sail` carries (u, v) for the shader.
 */
export function buildSailGeometry(spec: SailSpec, columns = 18, rows = 16) {
  const positions: number[] = [];
  const params: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= rows; j += 1) {
    const v = j / rows;
    const width = spec.head + (spec.foot - spec.head) * v;
    // The foot is cut with a shallow upward curve (a roach in reverse) so it reads as cloth.
    for (let i = 0; i <= columns; i += 1) {
      const u = i / columns;
      const footCurve = v === 1 ? 0.12 * Math.sin(Math.PI * u) : 0;
      positions.push(0, -v * spec.height + footCurve, (u - 0.5) * width);
      params.push(u, v);
      uvs.push(u, 1 - v);
    }
  }
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < columns; i += 1) {
      const a = j * (columns + 1) + i;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('sail', new BufferAttribute(new Float32Array(params), 2));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Billowing moves vertices up to `depth` along +X: keep culling honest.
  geometry.computeBoundingSphere();
  if (geometry.boundingSphere) geometry.boundingSphere.radius += spec.depth * 1.2;
  return geometry;
}

/** The same billow in GLSL, for MeshStandardMaterial.onBeforeCompile. */
export const SAIL_GLSL = /* glsl */ `
uniform float uTime;
uniform float uWind;
uniform float uDepth;
uniform float uPhase;
attribute vec2 sail;

float sailBillow(vec2 p) {
  float u = p.x;
  float v = p.y;
  float across = 0.3 + 0.7 * sin(3.14159265 * u);
  float down = sin(3.14159265 * 0.5 * v) * (1.0 - 0.35 * v * v);
  float breathe = 1.0 + 0.07 * sin(uTime * 0.8 + uPhase);
  float belly = uDepth * across * down * breathe;
  float cloth = 0.035 * sin(u * 7.0 + uTime * 2.1 + uPhase) * v;
  float flutter = 0.028 * pow(v, 5.0) * sin(u * 17.0 + uTime * 7.3 + uPhase * 3.0);
  return (belly + cloth + flutter) * uWind;
}
`;
