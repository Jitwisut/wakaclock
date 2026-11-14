'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  type Mesh,
  type ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

import { SKY_GLSL } from './sky';
import { voyage } from './state';
import { GERSTNER_GLSL } from './waves';

const SKY_RADIUS = 1800;

function skyUniforms() {
  return {
    uSunDir: { value: new Vector3() },
    uSunElev: { value: 0 },
    uDaylight: { value: 1 },
    uStars: { value: 0 },
    uTime: { value: 0 },
    uFog: { value: 0 },
  };
}

type SkyUniforms = ReturnType<typeof skyUniforms>;

/** Copies this frame's sky state into a material's live uniforms. */
function syncSky(material: null | ShaderMaterial) {
  const live = material?.uniforms as SkyUniforms | undefined;
  if (!live?.uSunDir) return;
  live.uSunDir.value.copy(voyage.sunDir);
  live.uSunElev.value = voyage.sunElev;
  live.uDaylight.value = voyage.daylight;
  live.uStars.value = voyage.stars;
  live.uTime.value = voyage.time;
  live.uFog.value = voyage.fog;
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
  gl_Position.z = gl_Position.w; // always at the far plane
}
`;

const SKY_FRAGMENT = /* glsl */ `
${SKY_GLSL}
varying vec3 vWorld;
void main() {
  vec3 dir = normalize(vWorld - cameraPosition);
  vec3 color = skyGradient(dir) + sunLight(dir, 1.0);
  vec4 cloud = clouds(dir);
  color = mix(color, cloud.rgb, cloud.a);
  color += vec3(stars(dir)) * uStars * (1.0 - cloud.a);
  // Sea mist thickens toward the horizon (and everywhere when the fog is called in).
  vec3 mist = skyGradient(vec3(dir.x, 0.02, dir.z));
  color = mix(color, mist, (1.0 - smoothstep(0.0, 0.12, dir.y)) * 0.55 + uFog * 0.35);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** The sky dome: follows the camera so the horizon never comes closer. */
export function SkyDome() {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => new SphereGeometry(SKY_RADIUS, 48, 24), []);
  const uniforms = useMemo(() => skyUniforms(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
    syncSky(material.current);
  });
  return (
    <mesh frustumCulled={false} geometry={geometry} ref={mesh} renderOrder={-10}>
      <shaderMaterial
        depthWrite={false}
        fragmentShader={SKY_FRAGMENT}
        ref={material}
        side={BackSide}
        uniforms={uniforms}
        vertexShader={SKY_VERTEX}
      />
    </mesh>
  );
}

/**
 * A square grid of `segments`², dense at the centre and stretched toward the edges
 * (|u|^power), reaching `extent` metres: fine wave detail near the camera, horizon-wide
 * coverage from a single draw.
 */
export function oceanGrid(segments: number, extent: number, power = 3) {
  const count = segments + 1;
  const positions = new Float32Array(count * count * 3);
  let offset = 0;
  for (let j = 0; j < count; j += 1) {
    const v = (j / segments) * 2 - 1;
    const z = Math.sign(v) * Math.abs(v) ** power * extent;
    for (let i = 0; i < count; i += 1) {
      const u = (i / segments) * 2 - 1;
      const x = Math.sign(u) * Math.abs(u) ** power * extent;
      positions[offset] = x;
      positions[offset + 1] = 0;
      positions[offset + 2] = z;
      offset += 3;
    }
  }
  const indices = new Uint32Array(segments * segments * 6);
  offset = 0;
  for (let j = 0; j < segments; j += 1) {
    for (let i = 0; i < segments; i += 1) {
      const a = j * count + i;
      const b = a + count;
      indices.set([a, b, a + 1, a + 1, b, b + 1], offset);
      offset += 6;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  return geometry;
}

const OCEAN_VERTEX = /* glsl */ `
${GERSTNER_GLSL}
uniform float uTime;
uniform vec2 uCenter;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight;
void main() {
  vec2 p = position.xz + uCenter;
  float distanceToEye = length(p - cameraPosition.xz);
  vec3 normal;
  vec3 offset = gerstner(p, uTime, distanceToEye, normal);
  vec3 world = vec3(p.x, 0.0, p.y) + offset;
  vWorld = world;
  vNormal = normal;
  vHeight = offset.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const OCEAN_FRAGMENT = /* glsl */ `
${SKY_GLSL}
uniform float uSea;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight;

// Fine directional ripples for the glitter: analytic, so their normals are exact.
vec3 rippleNormal(vec2 p, float t, float fade) {
  vec2 n = vec2(0.0);
  vec2 d1 = normalize(vec2(1.0, 0.3));
  vec2 d2 = normalize(vec2(0.6, -1.0));
  vec2 d3 = normalize(vec2(-0.2, 1.0));
  vec2 d4 = normalize(vec2(1.0, -0.7));
  n += d1 * cos(dot(d1, p) * 1.9 - t * 3.3) * 0.16;
  n += d2 * cos(dot(d2, p) * 3.3 - t * 4.4) * 0.12;
  n += d3 * cos(dot(d3, p) * 5.7 - t * 5.9) * 0.09;
  n += d4 * cos(dot(d4, p) * 9.1 - t * 7.6) * 0.07;
  n += (vec2(valueNoise(p * 0.9 + t * 0.35), valueNoise(p * 0.9 - t * 0.3)) - 0.5) * 0.28;
  n += (vec2(valueNoise(p * 3.1 + t * 0.9), valueNoise(p * 3.1 - t * 0.8)) - 0.5) * 0.16;
  return normalize(vec3(-n.x * fade, 1.0, -n.y * fade));
}

void main() {
  vec3 toEye = cameraPosition - vWorld;
  float dist = length(toEye);
  vec3 V = toEye / dist;
  vec2 sea = vec2(vWorld.x + uSea, vWorld.z);
  float detailFade = 1.0 - smoothstep(40.0, 420.0, dist);
  vec3 ripple = rippleNormal(sea, uTime, detailFade);
  // Combine swell and ripple normals (whiteout blend).
  vec3 N = normalize(vec3(vNormal.xz + ripple.xz, vNormal.y * ripple.y).xzy);
  N = normalize(vec3(N.x, max(N.y, 0.05), N.z));

  float cosTheta = clamp(dot(N, V), 0.0, 1.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - cosTheta, 5.0);

  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 reflection = skyGradient(R) + sunLight(R, 0.0) * 0.6;

  // Body colour: navy in the troughs, deep teal, turquoise where the crests let light through.
  vec3 deep = srgb(vec3(0.02, 0.09, 0.14));
  vec3 teal = srgb(vec3(0.03, 0.27, 0.3));
  vec3 turquoise = srgb(vec3(0.12, 0.55, 0.52));
  float crest = smoothstep(-0.6, 1.3, vHeight);
  vec3 body = mix(deep, teal, crest * 0.8);
  vec3 L = normalize(uSunDir);
  float through = pow(max(dot(V, -L), 0.0), 3.0) * smoothstep(0.0, 1.2, vHeight);
  body += turquoise * through * 0.9 * uDaylight;
  body *= 0.35 + 0.65 * uDaylight;

  // Reflection is softened a touch so the water keeps its body colour at grazing angles.
  vec3 color = mix(body, reflection, fresnel * 0.82);

  // The sun corridor: a sharp lobe on the rippled normal breaks into glints.
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 900.0) * 7.0 + pow(max(dot(N, H), 0.0), 120.0) * 0.6;
  float above = smoothstep(-0.04, 0.03, uSunElev);
  color += srgb(vec3(1.0, 0.78, 0.48)) * spec * above;

  // Crest foam: only on the steepest, highest water, broken up by noise.
  float foamNoise = fbm(sea * 0.7 + uTime * 0.15);
  float foam = smoothstep(1.05, 1.6, vHeight + foamNoise * 0.7) * (1.0 - smoothstep(60.0, 260.0, dist));
  color = mix(color, srgb(vec3(0.86, 0.84, 0.8)) * (0.35 + 0.65 * uDaylight), foam * 0.55);

  // Atmospheric haze toward the horizon, into the same sky the dome draws.
  vec3 horizonDir = normalize(vec3(-V.x, 0.015, -V.z));
  vec3 haze = skyGradient(horizonDir) + sunLight(horizonDir, 0.0) * 0.35;
  float hazeAmount = 1.0 - exp(-dist * (0.0011 + uFog * 0.006));
  color = mix(color, haze, clamp(hazeAmount, 0.0, 1.0));

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** The living ocean: one Gerstner-displaced grid that travels with the camera. */
export function Ocean({ segments }: { segments: number }) {
  const material = useRef<ShaderMaterial>(null);
  const mesh = useRef<Mesh>(null);
  const geometry = useMemo(() => oceanGrid(segments, 2600, 3), [segments]);
  const uniforms = useMemo(
    () => ({ ...skyUniforms(), uCenter: { value: [0, 0] }, uSea: { value: 0 } }),
    []
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ camera }) => {
    syncSky(material.current);
    const live = material.current?.uniforms as
      | { uCenter: { value: number[] }; uSea: { value: number } }
      | undefined;
    if (live?.uCenter) {
      live.uCenter.value[0] = camera.position.x;
      live.uCenter.value[1] = camera.position.z;
      live.uSea.value = voyage.sea;
    }
  });
  return (
    <mesh frustumCulled={false} geometry={geometry} ref={mesh} renderOrder={-5}>
      <shaderMaterial
        fragmentShader={OCEAN_FRAGMENT}
        ref={material}
        uniforms={uniforms}
        vertexShader={OCEAN_VERTEX}
      />
    </mesh>
  );
}
