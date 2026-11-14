'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, type ShaderMaterial, Vector3 } from 'three';

import { halfWidthAt, HULL_LENGTH, STERN_X } from './hull';
import { SKY_GLSL } from './sky';
import { voyage } from './state';
import { GERSTNER_GLSL } from './waves';

/** Kelvin wake half-angle: every ship's wake spreads at ~19.5°, whatever its speed. */
const KELVIN = Math.tan((19.5 * Math.PI) / 180);
export const WAKE_LENGTH = 150;

/**
 * The wake surface behind the stern: a grid in ship space, denser near the stern, wide
 * enough for the diverging arms. `wake` = (metres behind the stern, metres off the centre).
 */
export function wakeGeometry(lengthSegments = 140, widthSegments = 28) {
  const positions: number[] = [];
  const params: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= lengthSegments; i += 1) {
    const t = i / lengthSegments;
    const behind = -3 + (WAKE_LENGTH + 3) * t ** 1.7;
    const half = 3.2 + Math.max(0, behind) * KELVIN * 1.25;
    for (let j = 0; j <= widthSegments; j += 1) {
      const across = (j / widthSegments) * 2 - 1;
      const z = across * half;
      positions.push(STERN_X - behind, 0, z);
      params.push(behind, z);
    }
  }
  for (let i = 0; i < lengthSegments; i += 1) {
    for (let j = 0; j < widthSegments; j += 1) {
      const a = i * (widthSegments + 1) + j;
      const b = a + widthSegments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('wake', new BufferAttribute(new Float32Array(params), 2));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * A band hugging the hull at the waterline: `foam` = (station 0 stern → 1 bow, distance
 * out from the hull 0 → 1). Around the stem it wraps forward.
 */
export function bowFoamGeometry(stations = 72, rings = 8) {
  const positions: number[] = [];
  const params: number[] = [];
  const indices: number[] = [];
  const reach = 2.2;
  for (const side of [1, -1] as const) {
    const start = positions.length / 3;
    for (let i = 0; i <= stations; i += 1) {
      const s = 0.02 + (0.98 * i) / stations;
      const width = halfWidthAt(s, 0);
      const x = STERN_X + s * HULL_LENGTH + 0.9 * Math.max(0, s - 0.9) * 10;
      for (let k = 0; k <= rings; k += 1) {
        const e = k / rings;
        const out = e * reach * (0.6 + 0.8 * s);
        positions.push(x + (s > 0.92 ? out * 0.6 : 0), 0, side * (width + out - 0.15));
        params.push(s, e);
      }
    }
    for (let i = 0; i < stations; i += 1) {
      for (let k = 0; k < rings; k += 1) {
        const a = start + i * (rings + 1) + k;
        const b = a + rings + 1;
        if (side === 1) indices.push(a, b, a + 1, a + 1, b, b + 1);
        else indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('foam', new BufferAttribute(new Float32Array(params), 2));
  geometry.setIndex(indices);
  return geometry;
}

const SURFACE_VERTEX = (attribute: string) => /* glsl */ `
${GERSTNER_GLSL}
uniform float uTime;
attribute vec2 ${attribute};
varying vec2 vParams;
varying vec3 vWorld;
void main() {
  vParams = ${attribute};
  vec3 base = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 normal;
  vec3 offset = gerstner(base.xz, uTime, length(base.xz - cameraPosition.xz), normal);
  vec3 world = base + offset + vec3(0.0, 0.04, 0.0);
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const FOAM_COLOR = /* glsl */ `
uniform float uSea;
uniform float uWake;
vec3 foamColor() {
  // Foam takes the light of the sky: warm at golden hour, blue-grey at night.
  vec3 lit = skyGradient(vec3(0.0, 0.35, 0.0)) * 0.5 + srgb(vec3(0.95, 0.9, 0.84)) * 0.6;
  return lit * (0.25 + 0.75 * uDaylight) + srgb(vec3(0.05, 0.06, 0.09)) * (1.0 - uDaylight);
}
`;

const WAKE_FRAGMENT = /* glsl */ `
${SKY_GLSL}
${FOAM_COLOR}
varying vec2 vParams;
varying vec3 vWorld;
void main() {
  float behind = vParams.x;
  float across = abs(vParams.y);
  // The sea moves past the ship: foam is sampled where the water is, so it streams aft.
  vec2 sea = vec2(vWorld.x + uSea, vWorld.z);
  float coarse = fbm(sea * 0.32);
  float fine = fbm(sea * 1.45 + 7.0);

  float trailWidth = 1.5 + max(behind, 0.0) * 0.045;
  float trail = exp(-pow(across / trailWidth, 2.0)) * exp(-max(behind, 0.0) / 60.0);
  trail *= smoothstep(-3.0, 1.5, behind);

  float armCentre = 2.4 + max(behind, 0.0) * ${KELVIN.toFixed(4)};
  float armWidth = 0.55 + max(behind, 0.0) * 0.028;
  float arm = exp(-pow((across - armCentre) / armWidth, 2.0)) * exp(-max(behind, 0.0) / 85.0);
  arm *= smoothstep(0.0, 6.0, behind);
  // Secondary chevrons inside the wedge, the Kelvin pattern's transverse waves.
  float chevrons = 0.5 + 0.5 * sin((behind - across * 1.2) * 1.4 - uTime * 0.6);
  float inside = smoothstep(armCentre, armCentre * 0.4, across) * exp(-max(behind, 0.0) / 45.0) * chevrons * 0.25;

  float churn = trail * (0.55 + 0.9 * coarse) + arm * (0.45 + 0.9 * fine) + inside * fine;
  float foam = smoothstep(0.32, 0.95, churn * (0.65 + 0.7 * fine) * uWake);
  float alpha = foam * 0.9;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(foamColor(), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const BOW_FRAGMENT = /* glsl */ `
${SKY_GLSL}
${FOAM_COLOR}
varying vec2 vParams;
varying vec3 vWorld;
void main() {
  float s = vParams.x;
  float e = vParams.y;
  vec2 sea = vec2(vWorld.x + uSea, vWorld.z);
  float churn = fbm(sea * 0.9 + vec2(0.0, uTime * 0.4));
  float fine = fbm(sea * 2.6 - uTime * 0.3);
  // Heaviest where the stem parts the sea, steady along the run, turbulent at the quarter.
  float strength = (0.35 + 0.65 * smoothstep(0.55, 0.98, s) + 0.25 * smoothstep(0.15, 0.0, s)) * (0.45 + 0.55 * uWake);
  float edge = pow(1.0 - e, 1.4);
  float foam = smoothstep(0.3, 0.85, strength * edge * (0.55 + 0.9 * churn) + fine * 0.2 - e * 0.25);
  if (foam < 0.01) discard;
  gl_FragColor = vec4(foamColor(), foam * 0.92);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function foamUniforms() {
  return {
    uSunDir: { value: new Vector3() },
    uSunElev: { value: 0 },
    uDaylight: { value: 1 },
    uStars: { value: 0 },
    uTime: { value: 0 },
    uFog: { value: 0 },
    uSea: { value: 0 },
    uWake: { value: 1 },
  };
}

function useFoamSync(material: React.RefObject<null | ShaderMaterial>) {
  useFrame(() => {
    const live = material.current?.uniforms as ReturnType<typeof foamUniforms> | undefined;
    if (!live?.uTime) return;
    live.uTime.value = voyage.time;
    live.uDaylight.value = voyage.daylight;
    live.uSunDir.value.copy(voyage.sunDir);
    live.uSunElev.value = voyage.sunElev;
    live.uSea.value = voyage.sea;
    // The wake grows with speed: a drifting ship barely stirs the water.
    live.uWake.value = Math.min(1, Math.max(0.15, voyage.speed / 4.2));
  });
}

/** The stern wake and the bow wave, both riding the same Gerstner sea as the ocean. */
export function Wake() {
  const wakeMaterial = useRef<ShaderMaterial>(null);
  const bowMaterial = useRef<ShaderMaterial>(null);
  const wake = useMemo(() => wakeGeometry(), []);
  const bow = useMemo(() => bowFoamGeometry(), []);
  const wakeUniforms = useMemo(() => foamUniforms(), []);
  const bowUniforms = useMemo(() => foamUniforms(), []);
  useEffect(
    () => () => {
      wake.dispose();
      bow.dispose();
    },
    [bow, wake]
  );
  useFoamSync(wakeMaterial);
  useFoamSync(bowMaterial);
  return (
    <group>
      <mesh frustumCulled={false} geometry={wake} renderOrder={2}>
        <shaderMaterial
          depthWrite={false}
          fragmentShader={WAKE_FRAGMENT}
          ref={wakeMaterial}
          transparent
          uniforms={wakeUniforms}
          vertexShader={SURFACE_VERTEX('wake')}
        />
      </mesh>
      <mesh frustumCulled={false} geometry={bow} renderOrder={3}>
        <shaderMaterial
          depthWrite={false}
          fragmentShader={BOW_FRAGMENT}
          ref={bowMaterial}
          transparent
          uniforms={bowUniforms}
          vertexShader={SURFACE_VERTEX('foam')}
        />
      </mesh>
    </group>
  );
}
